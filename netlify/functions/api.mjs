import {
  SITES, CATEGORIES, FREQUENCIES, STATUSES, INSPECTION_TYPES,
  HttpError, login, userFrom, isAdmin, canEditSite, viewRequiresLogin,
  store, mapLimit, bumpRev, getRev, logEvent, statusPatch, detailFields, newId,
} from "../lib/core.mjs";
import { buildSeed } from "../lib/seed.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const STATUS_KEYS = ["status", "completedDate", "completedBy", "statusNote"];
const DETAIL_KEYS = ["site", "category", "title", "dueDate", "frequency", "submittedTo", "responsible", "citation", "inspectionType", "notes"];
const has = (body, keys) => keys.some((k) => Object.prototype.hasOwnProperty.call(body, k));

async function ensureSeeded(s) {
  if (await s.get("meta/seeded")) return;
  const seed = buildSeed();
  await mapLimit(seed, 25, (task) => s.setJSON(`task/${task.id}`, task, { onlyIfNew: true }));
  const { modified } = await s.setJSON("meta/seeded", { at: new Date().toISOString(), count: seed.length }, { onlyIfNew: true });
  if (modified) {
    await logEvent(s, { type: "seed", by: "system", summary: `Loaded ${seed.length} compliance tasks` });
    await bumpRev(s, "system");
  }
}

async function allTasks(s) {
  const { blobs } = await s.list({ prefix: "task/" });
  const tasks = await mapLimit(blobs, 40, (b) => s.get(b.key, { type: "json" }));
  return tasks.filter(Boolean);
}

function diff(before, after, keys) {
  const out = {};
  for (const k of keys) if ((before[k] ?? "") !== (after[k] ?? "")) out[k] = [before[k] ?? "", after[k] ?? ""];
  return out;
}

/** Shared update path for single + bulk edits. */
async function updateTask(s, id, body, user, { bulk = false } = {}) {
  const key = `task/${id}`;
  const got = await s.getWithMetadata(key, { type: "json" });
  if (!got || !got.data) throw new HttpError(404, "Task not found — it may have been deleted.");
  const cur = got.data;
  if (body.expectedUpdatedAt !== undefined && (body.expectedUpdatedAt || "") !== (cur.updatedAt || "")) {
    throw new HttpError(409, `Someone else (${cur.updatedBy || "another user"}) changed this task while you were editing. Review the latest version and try again.`, { current: cur });
  }
  if (!canEditSite(user, cur.site)) throw new HttpError(403, `Your login can't edit ${cur.site} tasks.`);
  const wantsDetails = has(body, DETAIL_KEYS);
  if (wantsDetails && !isAdmin(user)) throw new HttpError(403, "Only administrators can change task details.");

  let next = { ...cur };
  if (wantsDetails) next = { ...next, ...detailFields(body, cur) };
  if (has(body, STATUS_KEYS)) next = { ...next, ...statusPatch(next, body, user) };
  const changes = diff(cur, next, [...DETAIL_KEYS, ...STATUS_KEYS]);
  if (!Object.keys(changes).length) return { task: cur, changed: false };

  next.updatedAt = new Date().toISOString();
  next.updatedBy = user.name;
  const { modified } = await s.setJSON(key, next, { onlyIfMatch: got.etag });
  if (!modified) {
    const latest = await s.get(key, { type: "json" });
    throw new HttpError(409, "This task was changed by someone else a moment ago. Review the latest version and try again.", { current: latest });
  }
  await logEvent(s, { type: "update", id, site: next.site, title: next.title, by: user.name, role: user.role, bulk, changes });
  return { task: next, changed: true };
}

async function readBody(req) {
  try { return await req.json(); } catch { throw new HttpError(400, "Request body must be JSON."); }
}

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [route, id] = parts;
  const method = req.method;

  try {
    const user = userFrom(req);
    const s = await store();

    if (route === "session" && method === "GET") {
      return json({
        user, viewRequiresLogin: viewRequiresLogin(),
        options: { sites: SITES, categories: CATEGORIES, frequencies: FREQUENCIES, statuses: STATUSES, inspectionTypes: INSPECTION_TYPES },
      });
    }
    if (route === "login" && method === "POST") return json(login(await readBody(req)));

    // everything below may require a viewer login
    if (viewRequiresLogin() && !user) throw new HttpError(401, "Sign in to view the compliance calendar.");

    if (route === "rev" && method === "GET") {
      await ensureSeeded(s);
      return json({ rev: await getRev(s) });
    }

    if (route === "tasks" && !id && method === "GET") {
      await ensureSeeded(s);
      const rev = await getRev(s); // read rev first so a concurrent write triggers a later refetch
      return json({ rev, tasks: await allTasks(s) });
    }

    if (route === "tasks" && !id && method === "POST") {
      if (!isAdmin(user)) throw new HttpError(403, "Only administrators can add tasks.");
      const body = await readBody(req);
      const f = detailFields(body);
      const task = { id: newId(f.site, f.title, f.dueDate), ...f, status: "Not Started", completedDate: "", completedBy: "", statusNote: "" };
      Object.assign(task, statusPatch(task, body, user));
      task.updatedAt = new Date().toISOString();
      task.updatedBy = user.name;
      await s.setJSON(`task/${task.id}`, task, { onlyIfNew: true });
      await logEvent(s, { type: "create", id: task.id, site: task.site, title: task.title, by: user.name, role: user.role });
      return json({ task, rev: await bumpRev(s, user.name) }, 201);
    }

    if (route === "tasks" && id && method === "PATCH") {
      if (!user) throw new HttpError(401, "Sign in to edit tasks.");
      const { task, changed } = await updateTask(s, id, await readBody(req), user);
      return json({ task, rev: changed ? await bumpRev(s, user.name) : await getRev(s) });
    }

    if (route === "tasks" && id && method === "DELETE") {
      if (!isAdmin(user)) throw new HttpError(403, "Only administrators can delete tasks.");
      const cur = await s.get(`task/${id}`, { type: "json" });
      if (!cur) throw new HttpError(404, "Task not found.");
      await s.delete(`task/${id}`);
      await logEvent(s, { type: "delete", id, site: cur.site, title: cur.title, by: user.name, role: user.role, record: cur });
      return json({ ok: true, rev: await bumpRev(s, user.name) });
    }

    if (route === "bulk" && method === "POST") {
      if (!user) throw new HttpError(401, "Sign in to edit tasks.");
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500) : [];
      if (!ids.length) throw new HttpError(400, "No tasks selected.");
      const patch = {};
      for (const k of STATUS_KEYS) if (k in body) patch[k] = body[k];
      const results = await mapLimit(ids, 10, async (tid) => {
        try { const r = await updateTask(s, tid, patch, user, { bulk: true }); return { id: tid, ok: true, changed: r.changed, task: r.task }; }
        catch (e) { return { id: tid, ok: false, error: e.message }; }
      });
      const rev = results.some((r) => r.changed) ? await bumpRev(s, user.name) : await getRev(s);
      return json({ rev, updated: results.filter((r) => r.ok).map((r) => r.task), failed: results.filter((r) => !r.ok) });
    }

    if (route === "activity" && method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 40, 200);
      const { blobs } = await s.list({ prefix: "log/" });
      const keys = blobs.map((b) => b.key).sort().reverse().slice(0, limit);
      const entries = (await mapLimit(keys, 20, (k) => s.get(k, { type: "json" }))).filter(Boolean);
      return json({ entries: entries.map(({ record, ...e }) => e) });
    }

    throw new HttpError(404, "Not found.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
    console.error(e);
    return json({ error: "Server error. Try again in a moment." }, 500);
  }
};

export const config = { path: "/api/*" };
