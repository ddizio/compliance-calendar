import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";

export const SITES = ["Chicago", "Gurnee", "Englewood", "Leuna", "Carnegie", "Fairfield"];
export const CATEGORIES = ["Air", "Water/Wastewater", "SPCC", "Waste", "Chemical Inventory", "Safety", "Permits/Fees", "Reporting"];
export const FREQUENCIES = ["Monthly", "Quarterly", "Semi-Annual", "Annual", "Multi-Year", "One-Time"];
export const STATUSES = ["Not Started", "In Progress", "Completed", "N/A"];
export const INSPECTION_TYPES = ["", "Agency Inspection", "Agency Visit", "Third Party", "Supplier Audit", "Internal"];

const TOKEN_HOURS = 12;

// ── environment ──────────────────────────────────────────────────────────────
const env = (k) => (typeof Netlify !== "undefined" && Netlify.env ? Netlify.env.get(k) : process.env[k]) || "";

export function passcodeFor(role) {
  if (role === "admin") return env("ADMIN_PASSCODE");
  if (role === "viewer") return env("VIEW_PASSCODE");
  const site = SITES.find((s) => s.toLowerCase() === role);
  return site ? env(`SITE_PASSCODE_${site.toUpperCase()}`) : "";
}
export const viewRequiresLogin = () => !!env("VIEW_PASSCODE");
function secret() {
  const s = env("AUTH_SECRET");
  if (!s || s.length < 16) throw new HttpError(500, "Server not configured: AUTH_SECRET must be set (16+ characters).");
  return s;
}

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

// ── tokens ───────────────────────────────────────────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64url");
function sign(payload) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
function safeEq(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function login({ role, passcode, name }) {
  role = String(role || "").toLowerCase();
  name = String(name || "").trim().slice(0, 60);
  const valid = ["admin", "viewer", ...SITES.map((s) => s.toLowerCase())];
  if (!valid.includes(role)) throw new HttpError(400, "Unknown role.");
  if (!name) throw new HttpError(400, "Enter your name so changes are attributed to you.");
  const expected = passcodeFor(role);
  if (!expected) throw new HttpError(403, "This role has no passcode configured. Ask the site administrator.");
  if (!safeEq(expected, passcode || "")) throw new HttpError(401, "Incorrect passcode.");
  const exp = Date.now() + TOKEN_HOURS * 3600e3;
  const payload = b64u(JSON.stringify({ r: role, n: name, exp }));
  return { token: `${payload}.${sign(payload)}`, role, name, exp };
}

export function userFrom(req) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!tok.includes(".")) return null;
  const [payload, sig] = tok.split(".");
  if (!safeEq(sign(payload), sig)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return { role: p.r, name: p.n };
  } catch { return null; }
}

export const isAdmin = (u) => u && u.role === "admin";
export const canEditSite = (u, site) => !!u && (u.role === "admin" || u.role === String(site).toLowerCase());

// ── store ────────────────────────────────────────────────────────────────────
let _store;
export async function store() {
  if (globalThis.__TEST_STORE__) return globalThis.__TEST_STORE__;
  if (!_store) {
    const { getStore } = await import("@netlify/blobs");
    _store = getStore({ name: "compliance", consistency: "strong" });
  }
  return _store;
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

export async function bumpRev(s, by) {
  const rev = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  await s.setJSON("meta/rev", { rev, by, at: new Date().toISOString() });
  return rev;
}
export async function getRev(s) {
  const r = await s.get("meta/rev", { type: "json" });
  return r ? r.rev : "0";
}

export async function logEvent(s, entry) {
  const at = new Date().toISOString();
  const key = `log/${at}-${randomBytes(3).toString("hex")}`;
  await s.setJSON(key, { at, ...entry }, { onlyIfNew: true });
}

// ── validation ───────────────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isDate(v) {
  if (!DATE_RE.test(v)) return false;
  const dt = new Date(v + "T00:00:00Z");
  return !isNaN(dt) && dt.toISOString().slice(0, 10) === v;
}
// latest calendar date anywhere on earth right now (so no time zone is rejected)
const latestToday = () => new Date(Date.now() + 14 * 3600e3).toISOString().slice(0, 10);
const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);

/** Apply a status change. Returns the patched fields. */
export function statusPatch(task, body, user) {
  const status = body.status ?? task.status;
  if (!STATUSES.includes(status)) throw new HttpError(400, `Invalid status "${status}".`);
  const out = { status, statusNote: str(body.statusNote ?? task.statusNote, 1000) };
  if (status === "Completed") {
    const cd = body.completedDate === "due" ? task.dueDate : (body.completedDate ?? task.completedDate);
    if (!isDate(cd)) throw new HttpError(400, "A completion date (YYYY-MM-DD) is required to mark a task Completed.");
    if (cd > latestToday()) throw new HttpError(400, "Completion date can't be in the future.");
    out.completedDate = cd;
    out.completedBy = str(body.completedBy || (task.status === "Completed" && task.completedBy) || user.name, 60);
  } else {
    out.completedDate = "";
    out.completedBy = "";
  }
  if (status === "N/A" && !out.statusNote) throw new HttpError(400, "Add a note explaining why this task is N/A — it is excluded from the KPI.");
  return out;
}

/** Admin-only full field validation for create/edit. */
export function detailFields(body, base = {}) {
  const f = {
    site: body.site ?? base.site,
    category: body.category ?? base.category,
    title: str(body.title ?? base.title, 200),
    dueDate: body.dueDate ?? base.dueDate,
    frequency: body.frequency ?? base.frequency,
    submittedTo: str(body.submittedTo ?? base.submittedTo, 300),
    responsible: str(body.responsible ?? base.responsible, 80),
    citation: str(body.citation ?? base.citation, 300),
    inspectionType: body.inspectionType ?? base.inspectionType ?? "",
    notes: str(body.notes ?? base.notes, 2000),
  };
  if (!SITES.includes(f.site)) throw new HttpError(400, "Choose a valid site.");
  if (!CATEGORIES.includes(f.category)) throw new HttpError(400, "Choose a valid category.");
  if (!FREQUENCIES.includes(f.frequency)) throw new HttpError(400, "Choose a valid frequency.");
  if (!INSPECTION_TYPES.includes(f.inspectionType)) throw new HttpError(400, "Choose a valid inspection type.");
  if (!f.title) throw new HttpError(400, "Task name is required.");
  if (!isDate(f.dueDate)) throw new HttpError(400, "Due date must be a valid date.");
  f.year = Number(f.dueDate.slice(0, 4));
  return f;
}

export function newId(site, title, dueDate) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${site.toLowerCase()}-${dueDate}-${slug}-${randomBytes(2).toString("hex")}`;
}
