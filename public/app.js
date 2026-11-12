/* Vantage Environmental Compliance Calendar — client */
(() => {
  "use strict";

  // ── settings ──────────────────────────────────────────────────────────────
  const KPI_TARGET = 95;   // % on-time goal (green at/above)
  const KPI_WATCH = 85;    // amber between WATCH and TARGET, red below
  const POLL_MS = 15000;
  const SITE_COLORS = { Chicago: "#015B9A", Gurnee: "#00B388", Carnegie: "#F15F22", Englewood: "#1AB9DE", Leuna: "#8A5A9E", Fairfield: "#C9962B" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MON = MONTHS.map((m) => m.slice(0, 3));

  // ── state ─────────────────────────────────────────────────────────────────
  const S = {
    tasks: [], rev: null, options: null, user: null, token: null, viewRequiresLogin: false,
    view: "dashboard", year: new Date().getFullYear(),
    f: { site: "All", month: "All", cat: "All", freq: "All", status: "All", q: "" },
    selected: new Set(), activity: [], lastSync: null, loaded: false,
  };

  // ── utils ─────────────────────────────────────────────────────────────────
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toLocaleDateString("en-CA");
  const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
  const fmtDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
  const fmtShort = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
  const pct = (n) => (n == null ? "—" : `${Math.round(n * 100)}%`);
  const band = (p) => (p == null ? "none" : p * 100 >= KPI_TARGET ? "good" : p * 100 >= KPI_WATCH ? "warn" : "crit");
  const siteDot = (site) => `<span class="site-dot" style="background:${SITE_COLORS[site] || "#999"}"></span>`;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  function displayStatus(t) {
    if (t.status === "Completed") return t.completedDate && t.completedDate > t.dueDate ? "Late" : "Completed";
    if (t.status === "N/A") return "N/A";
    if (t.dueDate < today()) return "Overdue";
    return t.status;
  }
  const statusLabel = (ds) => (ds === "Late" ? "Completed late" : ds);
  const statusClass = (ds) => ds.replace(/[^A-Za-z]/g, "");
  const statusChip = (t) => { const ds = displayStatus(t); return `<span class="status ${statusClass(ds)}">${statusLabel(ds)}</span>`; };

  const canEdit = (t) => !!S.user && (S.user.role === "admin" || S.user.role === String(t.site).toLowerCase());
  const isAdmin = () => S.user && S.user.role === "admin";

  function toast(msg, bad = false) {
    const el = $("#toast");
    el.textContent = msg; el.className = "toast" + (bad ? " bad" : ""); el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 3600);
  }

  // ── API ───────────────────────────────────────────────────────────────────
  async function api(path, opts = {}) {
    const headers = { "content-type": "application/json" };
    if (S.token) headers.authorization = `Bearer ${S.token}`;
    const res = await fetch(`/api/${path}`, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && S.token && path !== "login") { signOut(true); }
    if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; e.data = data; throw e; }
    return data;
  }

  function setLive(state, text) {
    const el = $("#liveStatus");
    el.className = "live " + state;
    $("#liveText").textContent = text;
  }

  async function loadAll() {
    const data = await api("tasks");
    S.tasks = data.tasks;
    S.rev = data.rev;
    S.loaded = true;
    S.lastSync = new Date();
    for (const id of [...S.selected]) if (!S.tasks.find((t) => t.id === id)) S.selected.delete(id);
    buildYearOptions();
    await loadActivity();
    render();
    setLive("ok", `Live · synced ${S.lastSync.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  }
  async function loadActivity() {
    try { S.activity = (await api("activity?limit=25")).entries; } catch { S.activity = []; }
  }

  async function poll() {
    if (document.hidden) return;
    if (!S.loaded) {
      if (S.options && (!S.viewRequiresLogin || S.user)) { try { await loadAll(); } catch {} }
      return;
    }
    try {
      const { rev } = await api("rev");
      if (rev !== S.rev) { await loadAll(); if (!$("#modalRoot").innerHTML) toast("Updated with the latest changes"); }
      else { S.lastSync = new Date(); setLive("ok", `Live · synced ${S.lastSync.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`); }
    } catch (e) {
      setLive("err", "Offline — retrying");
    }
  }

  function applyUpdated(tasks, rev) {
    for (const nt of tasks) {
      const i = S.tasks.findIndex((t) => t.id === nt.id);
      if (i >= 0) S.tasks[i] = nt; else S.tasks.push(nt);
    }
    // our own write bumped the rev; reload in background so we pick up anyone else's edits too
    S.rev = null;
    render();
    loadAll().catch(() => {});
  }

  // ── session ───────────────────────────────────────────────────────────────
  function restoreSession() {
    const s = store.get("vcc_session");
    if (s && s.exp > Date.now()) { S.token = s.token; S.user = { role: s.role, name: s.name }; }
  }
  function signOut(expired = false) {
    S.token = null; S.user = null; S.selected.clear(); store.del("vcc_session");
    renderUser(); render();
    if (expired) toast("Your session expired — sign in again to edit.", true);
  }
  function roleLabel(role) {
    if (role === "admin") return "Administrator";
    if (role === "viewer") return "Viewer";
    const site = (S.options?.sites || []).find((s) => s.toLowerCase() === role);
    return `${site || role} editor`;
  }
  function renderUser() {
    const b = $("#userBtn");
    if (S.user) { b.innerHTML = `${esc(S.user.name)} · <span style="color:var(--muted);font-weight:500">${esc(roleLabel(S.user.role))}</span> — Sign out`; }
    else b.textContent = "Sign in to edit";
  }

  function openLogin(gate = false) {
    const roles = [["admin", "Administrator (all sites)"], ...S.options.sites.map((s) => [s.toLowerCase(), `${s} site editor`])];
    if (S.viewRequiresLogin) roles.push(["viewer", "Viewer (read only)"]);
    const last = store.get("vcc_last") || {};
    modal(`
      <div class="modal narrow">
        <div class="modal-head"><div><h3>Sign in</h3><div class="hint">Site editors can update tasks for their own site. Administrators can edit everything and add tasks.</div></div>${gate ? "" : '<button class="x" data-close>&times;</button>'}</div>
        <form class="modal-body" id="loginForm">
          <div class="field"><label for="lRole">Role</label><select id="lRole">${roles.map(([v, l]) => `<option value="${v}" ${last.role === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
          <div class="field" style="margin-top:12px"><label for="lName">Your name</label><input type="text" id="lName" autocomplete="name" value="${esc(last.name || "")}" placeholder="Shown on every change you make" required></div>
          <div class="field" style="margin-top:12px"><label for="lPass">Passcode</label><input type="password" id="lPass" autocomplete="current-password" required></div>
          <div class="err" id="lErr" hidden></div>
          <div class="actions"><button class="btn" type="submit">Sign in</button></div>
        </form>
      </div>`, !gate);
    $("#lPass").focus();
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = { role: $("#lRole").value, name: $("#lName").value, passcode: $("#lPass").value };
      try {
        const r = await api("login", { method: "POST", body });
        S.token = r.token; S.user = { role: r.role, name: r.name };
        store.set("vcc_session", r); store.set("vcc_last", { role: r.role, name: r.name });
        closeModal(); renderUser();
        if (!S.loaded) await loadAll(); else render();
        toast(`Signed in as ${r.name}`);
      } catch (err) { const el = $("#lErr"); el.textContent = err.message; el.hidden = false; }
    };
  }

  // ── modal plumbing ────────────────────────────────────────────────────────
  function modal(html, closable = true) {
    const root = $("#modalRoot");
    root.innerHTML = `<div class="overlay">${html}</div>`;
    const ov = root.firstElementChild;
    if (closable) {
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) closeModal(); });
      root.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeModal));
    }
  }
  function closeModal() { $("#modalRoot").innerHTML = ""; }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#modalRoot [data-close]")) closeModal(); });

  // ── tooltip ───────────────────────────────────────────────────────────────
  const tip = $("#tooltip");
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (!el) { tip.hidden = true; return; }
    tip.innerHTML = el.getAttribute("data-tip"); tip.hidden = false;
  });
  document.addEventListener("mousemove", (e) => {
    if (tip.hidden) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });

  // ── KPI maths ─────────────────────────────────────────────────────────────
  // Assessed = tasks whose due date has passed, plus any already completed.
  // On-time % = completed on/before due date ÷ assessed. N/A tasks are excluded.
  function kpi(tasks) {
    const td = today();
    const active = tasks.filter((t) => t.status !== "N/A");
    const assessed = active.filter((t) => t.dueDate < td || t.status === "Completed");
    const onTime = assessed.filter((t) => t.status === "Completed" && t.completedDate <= t.dueDate).length;
    const late = assessed.filter((t) => t.status === "Completed" && t.completedDate > t.dueDate).length;
    const overdue = assessed.filter((t) => t.status !== "Completed").length;
    const completed = active.filter((t) => t.status === "Completed").length;
    const next30 = active.filter((t) => t.status !== "Completed" && t.dueDate >= td && t.dueDate <= addDays(td, 30)).length;
    return {
      total: active.length, assessed: assessed.length, onTime, late, overdue, completed, next30,
      rate: assessed.length ? onTime / assessed.length : null,
      progress: active.length ? completed / active.length : null,
    };
  }
  const yearTasks = () => S.tasks.filter((t) => t.year === S.year);

  // ── views ─────────────────────────────────────────────────────────────────
  function render() {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === S.view));
    ["dashboard", "list", "calendar"].forEach((v) => ($(`#view-${v}`).hidden = v !== S.view));
    if (!S.loaded) return;
    if (S.view === "dashboard") renderDashboard();
    if (S.view === "list") renderList();
    if (S.view === "calendar") renderCalendar();
  }

  function renderDashboard() {
    const tasks = yearTasks();
    const all = kpi(tasks);
    const sites = S.options.sites;
    const td = today();
    const isCurrentYear = S.year === new Date().getFullYear();

    const heroBadge = all.rate == null ? "" : `<span class="badge">${all.rate * 100 >= KPI_TARGET ? "✓ At or above" : "Below"} ${KPI_TARGET}% target</span>`;
    const kpis = `
      <div class="kpis">
        <div class="tile hero">
          <div class="label">On-time completion · all sites · ${S.year}${isCurrentYear ? " year to date" : ""}</div>
          <div class="hero-row"><div class="value">${pct(all.rate)}</div>${heroBadge}</div>
          <div class="note">${all.onTime} of ${all.assessed} tasks due to date were completed on or before their due date</div>
        </div>
        <div class="tile"><div class="label">Overdue — still open</div><div class="value ${all.overdue ? "crit" : ""}">${all.overdue}</div><div class="note">Past due, not marked complete</div></div>
        <div class="tile"><div class="label">Completed late</div><div class="value ${all.late ? "warn" : ""}">${all.late}</div><div class="note">Done after the due date</div></div>
        <div class="tile"><div class="label">Due in next 30 days</div><div class="value">${all.next30}</div><div class="note">Open, through ${fmtShort(addDays(td, 30))}</div></div>
        <div class="tile"><div class="label">${S.year} plan complete</div><div class="value">${pct(all.progress)}</div><div class="meter"><span style="width:${(all.progress || 0) * 100}%"></span></div><div class="note">${all.completed} of ${all.total} tasks</div></div>
      </div>`;

    // site bars
    const rows = sites.map((site) => {
      const k = kpi(tasks.filter((t) => t.site === site));
      const b = band(k.rate);
      const color = { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)" }[b];
      const w = (k.rate || 0) * 100;
      const labelPos = w > 88 ? `right:${100 - w}%;margin-right:8px;color:#fff` : `left:calc(${w}% + 8px)`;
      const bar = k.assessed
        ? `<div class="bar" data-tip="<b>${esc(site)}</b><br>${k.onTime} on time · ${k.late} late · ${k.overdue} overdue<br>${k.assessed} tasks due to date"><div class="track"></div><div class="fill" style="width:${w}%;background:${color}"></div><div class="target" style="left:${KPI_TARGET}%"></div><span class="val" style="${labelPos}">${pct(k.rate)}</span></div>`
        : `<div class="bar"><span class="empty">${k.total ? "No tasks due yet" : "No tasks loaded for this site"}</span></div>`;
      return `<tr class="clickable" data-site="${esc(site)}"><td>${siteDot(site)}${esc(site)}</td><td class="barcell">${bar}</td><td>${k.onTime}</td><td>${k.late}</td><td style="${k.overdue ? "color:var(--crit);font-weight:600" : ""}">${k.overdue}</td><td>${k.assessed}</td><td>${pct(k.progress)}</td></tr>`;
    }).join("");

    // monthly heat grid
    const curMonth = new Date().getMonth();
    const heatRows = sites.map((site) => {
      const cells = MON.map((m, i) => {
        const mt = tasks.filter((t) => t.site === site && Number(t.dueDate.slice(5, 7)) === i + 1);
        const k = kpi(mt);
        if (!mt.length) return `<div class="cell none" data-tip="<b>${esc(site)} · ${MONTHS[i]}</b><br>No tasks">·</div>`;
        if (!k.assessed) return `<div class="cell future" data-tip="<b>${esc(site)} · ${MONTHS[i]}</b><br>${mt.length} task${mt.length > 1 ? "s" : ""} not yet due">${mt.length}</div>`;
        return `<div class="cell ${band(k.rate)}" data-tip="<b>${esc(site)} · ${MONTHS[i]}</b><br>${k.onTime} of ${k.assessed} on time${k.late ? ` · ${k.late} late` : ""}${k.overdue ? ` · ${k.overdue} overdue` : ""}">${Math.round(k.rate * 100)}</div>`;
      }).join("");
      return `<div class="rowlab">${siteDot(site)}${esc(site)}</div>${cells}`;
    }).join("");

    // overdue list (all years — nothing falls off the radar)
    const overdue = S.tasks.filter((t) => displayStatus(t) === "Overdue").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const ovList = overdue.length
      ? `<ul class="item-list">${overdue.slice(0, 12).map((t) => `<li data-open="${esc(t.id)}"><span class="d">${fmtShort(t.dueDate)}${t.year !== S.year ? `<br><span style="font-weight:400">${t.year}</span>` : ""}</span><span><div class="t">${esc(t.title)}</div><div class="m">${siteDot(t.site)}${esc(t.site)} · ${esc(t.category)}${t.responsible ? ` · ${esc(t.responsible)}` : ""}</div></span></li>`).join("")}</ul>${overdue.length > 12 ? `<button class="btn btn-ghost btn-sm" id="seeAllOverdue" style="margin-top:8px">See all ${overdue.length} overdue tasks</button>` : ""}`
      : `<div class="empty-state">Nothing overdue. 🎉</div>`;

    const feed = S.activity.length
      ? `<div class="feed-wrap"><ul class="item-list feed">${groupActivity(S.activity).map(activityRow).join("")}</ul></div>`
      : `<div class="empty-state">No changes recorded yet.</div>`;

    $("#view-dashboard").innerHTML = `
      ${kpis}
      <div class="card">
        <h2>On-time completion by site</h2>
        <p class="sub">${S.year}${isCurrentYear ? " year to date" : ""} · click a site to see its tasks</p>
        <table class="site-table">
          <thead><tr><th>Site</th><th>On-time rate</th><th>On time</th><th>Late</th><th>Overdue</th><th>Due to date</th><th>Plan done</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="legend">
          <span><span class="sw" style="background:var(--good)"></span>≥ ${KPI_TARGET}%</span>
          <span><span class="sw" style="background:var(--warn)"></span>${KPI_WATCH}–${KPI_TARGET - 1}%</span>
          <span><span class="sw" style="background:var(--crit)"></span>&lt; ${KPI_WATCH}%</span>
          <span><span class="tgt"></span>${KPI_TARGET}% target</span>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h2>On-time rate by month</h2>
        <p class="sub">% of tasks due that month completed on time · hatched = tasks not yet due (count shown)</p>
        <div class="heat-wrap"><div class="heat"><div></div>${MON.map((m, i) => `<div class="h" style="${isCurrentYear && i === curMonth ? "color:var(--green-ink);font-weight:600" : ""}">${m}</div>`).join("")}${heatRows}</div></div>
      </div>
      <div class="two-col">
        <div class="card"><h2>Overdue — action needed</h2><p class="sub">Open tasks past their due date, oldest first (all years)</p>${ovList}</div>
        <div class="card"><h2>Recent activity</h2><p class="sub">Latest changes from all sites</p>${feed}</div>
      </div>
      <p class="def"><b>How the KPI is calculated.</b> A task counts toward the rate once its due date has passed or once it is completed, whichever comes first. On-time rate = tasks completed on or before their due date ÷ those tasks. Tasks marked N/A (with a reason) are excluded. Overdue = past due and not yet completed; it counts against the rate until it is closed out.</p>`;

    $("#view-dashboard").querySelectorAll("tr[data-site]").forEach((tr) => (tr.onclick = () => { S.f = { ...S.f, site: tr.dataset.site, status: "All", month: "All" }; switchView("list"); }));
    $("#view-dashboard").querySelectorAll("[data-open]").forEach((li) => (li.onclick = () => openTask(li.dataset.open)));
    const sa = $("#seeAllOverdue");
    if (sa) sa.onclick = () => { S.f = { site: "All", month: "All", cat: "All", freq: "All", status: "Overdue", q: "" }; switchView("list"); };
  }

  // collapse a run of bulk edits by the same person (same minute) into one line
  function groupActivity(entries) {
    const out = [];
    for (const e of entries) {
      const prev = out[out.length - 1];
      if (e.bulk && prev && prev.bulk && prev.by === e.by && prev.at.slice(0, 16) === e.at.slice(0, 16)) {
        prev.n = (prev.n || 1) + 1;
        if (prev.site !== e.site) prev.multiSite = true;
      } else out.push({ ...e });
    }
    return out;
  }

  function activityRow(e) {
    const when = new Date(e.at);
    const ts = when.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    let what = "";
    if (e.type === "seed") what = esc(e.summary);
    else if (e.n > 1) what = `bulk-updated <b>${e.n} tasks</b>${e.changes && e.changes.status ? ` to ${esc(e.changes.status[1])}` : ""}`;
    else if (e.type === "create") what = `added <b>${esc(e.title)}</b>`;
    else if (e.type === "delete") what = `deleted <b>${esc(e.title)}</b>`;
    else {
      const c = e.changes || {};
      if (c.status) what = `set <b>${esc(e.title)}</b> to ${esc(c.status[1])}${c.completedDate && c.completedDate[1] ? ` (${fmtShort(c.completedDate[1])})` : ""}`;
      else if (c.completedDate) what = `changed completion date on <b>${esc(e.title)}</b> to ${fmtShort(c.completedDate[1])}`;
      else what = `edited <b>${esc(e.title)}</b> (${Object.keys(c).map(esc).join(", ")})`;
      if (e.bulk) what += " · bulk";
    }
    if (e.n > 1) return `<li><span class="d">${ts}</span><span><div class="t" style="font-weight:400"><b>${esc(e.by)}</b> ${what}</div><div class="m">${e.multiSite ? "Multiple sites" : siteDot(e.site) + esc(e.site)}</div></span></li>`;
    return `<li${e.id && e.type !== "delete" ? ` data-open="${esc(e.id)}" style="cursor:pointer"` : ""}><span class="d">${ts}</span><span><div class="t" style="font-weight:400">${e.by ? `<b>${esc(e.by)}</b> ` : ""}${what}</div>${e.site ? `<div class="m">${siteDot(e.site)}${esc(e.site)}</div>` : ""}</span></li>`;
  }

  // ── list view ─────────────────────────────────────────────────────────────
  function filtered() {
    const f = S.f, q = f.q.trim().toLowerCase();
    return yearTasks().filter((t) => {
      if (f.site !== "All" && t.site !== f.site) return false;
      if (f.month !== "All" && Number(t.dueDate.slice(5, 7)) !== Number(f.month)) return false;
      if (f.cat !== "All" && t.category !== f.cat) return false;
      if (f.freq !== "All" && t.frequency !== f.freq) return false;
      if (f.status !== "All") {
        const ds = displayStatus(t);
        if (f.status === "Completed" ? !(ds === "Completed" || ds === "Late") : ds !== f.status) return false;
      }
      if (q && ![t.title, t.submittedTo, t.responsible, t.citation, t.notes, t.category].join(" ").toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.site.localeCompare(b.site) || a.title.localeCompare(b.title));
  }

  function siteBar() {
    return `<div class="sitebar">${["All", ...S.options.sites].map((s) => `<button class="sitebtn ${S.f.site === s ? "active" : ""}" data-site="${esc(s)}">${s === "All" ? "All sites" : siteDot(s) + esc(s)}</button>`).join("")}</div>`;
  }
  const opt = (v, cur, label = v) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(label)}</option>`;

  function renderList() {
    const rows = filtered();
    const editable = rows.filter(canEdit);
    const byMonth = {};
    rows.forEach((t) => (byMonth[t.dueDate.slice(0, 7)] ||= []).push(t));
    const allSel = editable.length && editable.every((t) => S.selected.has(t.id));

    const toolbar = `
      ${siteBar()}
      <div class="toolbar">
        <select id="fMonth" aria-label="Month">${opt("All", S.f.month, "All months")}${MONTHS.map((m, i) => opt(i + 1, S.f.month, m)).join("")}</select>
        <select id="fCat" aria-label="Category">${opt("All", S.f.cat, "All categories")}${S.options.categories.map((c) => opt(c, S.f.cat)).join("")}</select>
        <select id="fFreq" aria-label="Frequency">${opt("All", S.f.freq, "All frequencies")}${S.options.frequencies.map((c) => opt(c, S.f.freq)).join("")}</select>
        <select id="fStatus" aria-label="Status">${opt("All", S.f.status, "All statuses")}${["Overdue", "Not Started", "In Progress", "Completed", "Late", "N/A"].map((c) => opt(c, S.f.status, c === "Late" ? "Completed late" : c)).join("")}</select>
        <input type="search" id="fQ" placeholder="Search tasks, agencies, citations…" value="${esc(S.f.q)}" style="min-width:240px">
        <span class="spacer"></span>
        <span class="count">${rows.length} task${rows.length === 1 ? "" : "s"}</span>
        ${editable.length ? `<label class="count" style="display:flex;gap:6px;align-items:center"><input type="checkbox" class="cb" id="selAll" ${allSel ? "checked" : ""}> Select all I can edit</label>` : ""}
        <button class="btn btn-ghost btn-sm" id="exportCsv">Export CSV</button>
        ${isAdmin() ? `<button class="btn btn-sm" id="addTask">+ Add task</button>` : ""}
      </div>`;

    const body = rows.length ? Object.keys(byMonth).sort().map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      const list = byMonth[ym];
      return `<div class="month-block"><div class="month-title">${MONTHS[m - 1]} ${y}<span class="count">${list.length}</span></div>
        <div class="tbl-wrap"><table class="tasks"><colgroup><col class="c-cb"><col class="c-due"><col class="c-site"><col><col class="c-cat"><col class="c-freq"><col class="c-resp"><col class="c-status"><col class="c-done"></colgroup><thead><tr><th></th><th>Due</th><th>Site</th><th>Task</th><th>Category</th><th>Frequency</th><th>Resp.</th><th>Status</th><th>Completed</th></tr></thead><tbody>
        ${list.map((t) => {
          const ds = displayStatus(t), ce = canEdit(t);
          return `<tr data-id="${esc(t.id)}" class="${S.selected.has(t.id) ? "sel" : ""}">
            <td><input type="checkbox" class="cb" data-sel="${esc(t.id)}" ${S.selected.has(t.id) ? "checked" : ""} ${ce ? "" : "disabled"} aria-label="Select"></td>
            <td class="date ${ds === "Overdue" ? "over" : ""}">${fmtShort(t.dueDate)}</td>
            <td><span class="chip">${siteDot(t.site)}${esc(t.site)}</span></td>
            <td><div class="task-name">${esc(t.title)}</div><div class="task-meta">${[t.submittedTo, t.citation, t.inspectionType].filter(Boolean).map(esc).join(" · ")}</div></td>
            <td>${esc(t.category)}</td><td>${esc(t.frequency)}</td><td>${esc(t.responsible) || '<span style="color:var(--muted)">—</span>'}</td>
            <td>${statusChip(t)}</td>
            <td class="date">${t.status === "Completed" ? fmtShort(t.completedDate) : ""}</td></tr>`;
        }).join("")}</tbody></table></div></div>`;
    }).join("") : `<div class="card empty-state" style="text-align:center;padding:40px">No tasks match these filters.</div>`;

    const nSel = S.selected.size;
    const bulk = nSel ? `
      <div class="bulkbar">
        <b>${nSel} selected</b>
        <select id="bStatus">${["Completed", "In Progress", "Not Started"].map((s) => `<option>${s}</option>`).join("")}</select>
        <span id="bDateWrap">completed on <select id="bDateMode"><option value="date">this date</option><option value="due">each task's due date</option></select> <input type="date" id="bDate" value="${today()}" max="${today()}"></span>
        <button class="btn btn-sm" id="bApply">Apply</button>
        <button class="btn btn-ghost btn-sm" id="bClear">Clear</button>
        <span class="hint" style="color:rgba(255,255,255,.7);margin:0">Only back-fill completion dates you can document — every change is logged with your name.</span>
      </div>` : "";

    $("#view-list").innerHTML = toolbar + body + bulk;
    wireList();
  }

  function wireList() {
    const v = $("#view-list");
    v.querySelectorAll(".sitebtn").forEach((b) => (b.onclick = () => { S.f.site = b.dataset.site; render(); }));
    const bind = (id, key) => { const el = $(id); if (el) el.onchange = () => { S.f[key] = el.value; render(); }; };
    bind("#fMonth", "month"); bind("#fCat", "cat"); bind("#fFreq", "freq"); bind("#fStatus", "status");
    const q = $("#fQ");
    q.oninput = () => { S.f.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => { const pos = q.selectionStart; render(); const n = $("#fQ"); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
    v.querySelectorAll("tbody tr").forEach((tr) => (tr.onclick = (e) => { if (e.target.closest("input")) return; openTask(tr.dataset.id); }));
    v.querySelectorAll("[data-sel]").forEach((cb) => (cb.onchange = () => { cb.checked ? S.selected.add(cb.dataset.sel) : S.selected.delete(cb.dataset.sel); render(); }));
    const sa = $("#selAll");
    if (sa) sa.onchange = () => { filtered().filter(canEdit).forEach((t) => (sa.checked ? S.selected.add(t.id) : S.selected.delete(t.id))); render(); };
    $("#exportCsv").onclick = exportCsv;
    const add = $("#addTask"); if (add) add.onclick = () => openTaskForm();
    if (S.selected.size) {
      const sync = () => { $("#bDateWrap").hidden = $("#bStatus").value !== "Completed"; $("#bDate").hidden = $("#bDateMode").value === "due"; };
      $("#bStatus").onchange = sync; $("#bDateMode").onchange = sync; sync();
      $("#bClear").onclick = () => { S.selected.clear(); render(); };
      $("#bApply").onclick = bulkApply;
    }
  }

  async function bulkApply() {
    const status = $("#bStatus").value;
    const body = { ids: [...S.selected], status };
    if (status === "Completed") body.completedDate = $("#bDateMode").value === "due" ? "due" : $("#bDate").value;
    const btn = $("#bApply"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const r = await api("bulk", { method: "POST", body });
      S.selected.clear();
      applyUpdated(r.updated, r.rev);
      toast(r.failed.length ? `${r.updated.length} updated · ${r.failed.length} failed: ${r.failed[0].error}` : `${r.updated.length} task${r.updated.length === 1 ? "" : "s"} updated`, !!r.failed.length);
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = "Apply"; }
  }

  function exportCsv() {
    const cols = ["site", "dueDate", "title", "category", "frequency", "submittedTo", "responsible", "citation", "inspectionType", "status", "completedDate", "completedBy", "statusNote", "notes", "updatedBy", "updatedAt"];
    const rows = filtered().map((t) => cols.map((c) => (c === "status" ? statusLabel(displayStatus(t)) : t[c] ?? "")));
    const csv = [cols, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `compliance-tasks-${S.year}-${today()}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  // ── calendar view ─────────────────────────────────────────────────────────
  function renderCalendar() {
    const tasks = yearTasks().filter((t) => S.f.site === "All" || t.site === S.f.site).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const now = new Date();
    const months = MONTHS.map((m, i) => {
      const list = tasks.filter((t) => Number(t.dueDate.slice(5, 7)) === i + 1);
      const k = kpi(list);
      const current = S.year === now.getFullYear() && i === now.getMonth();
      return `<div class="cal-month">
        <div class="cal-head ${current ? "now" : ""}"><b>${m}</b><span class="count">${list.length} task${list.length === 1 ? "" : "s"}${k.overdue ? ` · <span style="color:var(--crit);font-weight:600">${k.overdue} overdue</span>` : ""}</span></div>
        <div class="cal-items">${list.length ? list.map((t) => {
          const ds = displayStatus(t);
          return `<div class="cal-item ${ds === "Completed" || ds === "Late" ? "done" : ""}" data-open="${esc(t.id)}"><span class="stripe" style="background:${SITE_COLORS[t.site]}"></span><span><div class="ct">${esc(t.title)}</div><div class="cm">${fmtShort(t.dueDate)} · ${esc(t.site)} · <span class="mini ${statusClass(ds)}"></span>${statusLabel(ds)}</div></span></div>`;
        }).join("") : `<div class="empty-state" style="padding:6px">No tasks</div>`}</div></div>`;
    }).join("");
    $("#view-calendar").innerHTML = siteBar() + `<div class="cal">${months}</div>`;
    $("#view-calendar").querySelectorAll(".sitebtn").forEach((b) => (b.onclick = () => { S.f.site = b.dataset.site; render(); }));
    $("#view-calendar").querySelectorAll("[data-open]").forEach((el) => (el.onclick = () => openTask(el.dataset.open)));
  }

  // ── task detail / status editing ──────────────────────────────────────────
  function openTask(id) {
    const t = S.tasks.find((x) => x.id === id);
    if (!t) return toast("That task no longer exists.", true);
    const ce = canEdit(t);
    const field = (label, val, full = false) => `<div class="field ${full ? "full" : ""}"><span class="flabel">${label}</span><span class="v">${val || '<span style="color:var(--muted)">—</span>'}</span></div>`;
    const startStatus = t.status;

    const editor = ce ? `
      <div class="section">
        <span class="flabel">Update status</span>
        <div class="seg" id="seg" style="margin-top:6px">${S.options.statuses.map((s) => `<button type="button" data-s="${esc(s)}" class="${s === startStatus ? "on" : ""}">${esc(s)}</button>`).join("")}</div>
        <div class="fields" style="margin-top:12px" id="doneFields">
          <div class="field"><label for="cDate">Completed on</label><input type="date" id="cDate" max="${today()}" value="${esc(t.completedDate || today())}"></div>
          <div class="field"><label for="cBy">Completed by</label><input type="text" id="cBy" value="${esc(t.completedBy || S.user.name)}"></div>
        </div>
        <div class="field" style="margin-top:12px"><label for="cNote">Status note <span id="noteReq" style="text-transform:none;font-weight:400"></span></label><textarea id="cNote" placeholder="Submission confirmation #, who it was sent to, reason for N/A…">${esc(t.statusNote)}</textarea></div>
        <div class="err" id="tErr" hidden></div>
        <div class="actions">
          ${isAdmin() ? `<button class="btn btn-ghost left" id="editDetails">Edit details</button>` : ""}
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn" id="saveStatus">Save</button>
        </div>
      </div>` : `<div class="readonly-note">${S.user ? `Your login (${esc(roleLabel(S.user.role))}) can view this task but not change it.` : `<a href="#" id="signinLink">Sign in</a> as a ${esc(t.site)} editor or administrator to update this task.`}</div>`;

    modal(`
      <div class="modal">
        <div class="modal-head"><div><h3>${esc(t.title)}</h3><div class="chips"><span class="chip">${siteDot(t.site)}${esc(t.site)}</span><span class="chip">${esc(t.category)}</span><span class="chip">${esc(t.frequency)}</span>${t.inspectionType ? `<span class="chip">${esc(t.inspectionType)}</span>` : ""}${statusChip(t)}</div></div><button class="x" data-close aria-label="Close">&times;</button></div>
        <div class="modal-body">
          <div class="fields">
            ${field("Due date", fmtDate(t.dueDate))}
            ${field("Responsible", esc(t.responsible))}
            ${field("Submitted to", esc(t.submittedTo), true)}
            ${t.citation ? field("Permit / regulatory citation", esc(t.citation), true) : ""}
            ${t.status === "Completed" ? field("Completed", `${fmtDate(t.completedDate)}${t.completedBy ? ` by ${esc(t.completedBy)}` : ""}`) : ""}
            ${t.updatedBy ? field("Last updated", `${esc(t.updatedBy)} · ${new Date(t.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`) : ""}
          </div>
          ${t.notes ? `<div class="field" style="margin-top:12px"><span class="flabel">Requirement notes</span><div class="notes">${esc(t.notes)}</div></div>` : ""}
          ${!ce && t.statusNote ? `<div class="field" style="margin-top:12px"><span class="flabel">Status note</span><div class="notes">${esc(t.statusNote)}</div></div>` : ""}
          ${editor}
        </div>
      </div>`);

    const sl = $("#signinLink"); if (sl) sl.onclick = (e) => { e.preventDefault(); openLogin(); };
    if (!ce) return;
    let chosen = startStatus;
    const sync = () => {
      $("#seg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.s === chosen));
      $("#doneFields").hidden = chosen !== "Completed";
      $("#noteReq").textContent = chosen === "N/A" ? "(required — N/A removes the task from the KPI)" : "(optional)";
    };
    $("#seg").querySelectorAll("button").forEach((b) => (b.onclick = () => { chosen = b.dataset.s; sync(); }));
    sync();
    const ed = $("#editDetails"); if (ed) ed.onclick = () => openTaskForm(t);
    $("#saveStatus").onclick = async () => {
      const body = { status: chosen, statusNote: $("#cNote").value, expectedUpdatedAt: t.updatedAt || "" };
      if (chosen === "Completed") { body.completedDate = $("#cDate").value; body.completedBy = $("#cBy").value; }
      const btn = $("#saveStatus"); btn.disabled = true; btn.textContent = "Saving…";
      try {
        const r = await api(`tasks/${encodeURIComponent(t.id)}`, { method: "PATCH", body });
        closeModal(); applyUpdated([r.task], r.rev); toast("Saved — the dashboard is updated for everyone");
      } catch (e) {
        if (e.status === 409 && e.data.current) { applyUpdated([e.data.current]); }
        const el = $("#tErr"); if (el) { el.textContent = e.message; el.hidden = false; }
        btn.disabled = false; btn.textContent = "Save";
      }
    };
  }

  // ── admin: add / edit details / delete ────────────────────────────────────
  function openTaskForm(t = null) {
    const o = S.options;
    const v = t || { site: S.f.site !== "All" ? S.f.site : o.sites[0], category: o.categories[0], frequency: "Annual", dueDate: today(), inspectionType: "" };
    modal(`
      <div class="modal">
        <div class="modal-head"><h3>${t ? "Edit task details" : "Add compliance task"}</h3><button class="x" data-close>&times;</button></div>
        <form class="modal-body" id="tForm">
          <div class="fields">
            <div class="field full"><label for="aTitle">Task name</label><input type="text" id="aTitle" value="${esc(v.title || "")}" required></div>
            <div class="field"><label for="aSite">Site</label><select id="aSite">${o.sites.map((s) => opt(s, v.site)).join("")}</select></div>
            <div class="field"><label for="aDue">Due date</label><input type="date" id="aDue" value="${esc(v.dueDate)}" required></div>
            <div class="field"><label for="aCat">Category</label><select id="aCat">${o.categories.map((s) => opt(s, v.category)).join("")}</select></div>
            <div class="field"><label for="aFreq">Frequency</label><select id="aFreq">${o.frequencies.map((s) => opt(s, v.frequency)).join("")}</select></div>
            <div class="field full"><label for="aTo">Submitted to (agency / recipient)</label><input type="text" id="aTo" value="${esc(v.submittedTo || "")}"></div>
            <div class="field"><label for="aResp">Responsible</label><input type="text" id="aResp" value="${esc(v.responsible || "")}"></div>
            <div class="field"><label for="aInsp">Inspection type</label><select id="aInsp">${o.inspectionTypes.map((s) => opt(s, v.inspectionType, s || "— none —")).join("")}</select></div>
            <div class="field full"><label for="aCite">Permit / regulatory citation</label><input type="text" id="aCite" value="${esc(v.citation || "")}" placeholder="e.g. Permit #0940-OP24 §III.12; 40 CFR 112.5(b)"></div>
            <div class="field full"><label for="aNotes">Requirement notes</label><textarea id="aNotes">${esc(v.notes || "")}</textarea></div>
          </div>
          <div class="err" id="aErr" hidden></div>
          <div class="actions">
            ${t ? `<button type="button" class="btn btn-danger left" id="aDel">Delete task</button>` : ""}
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn" type="submit">${t ? "Save details" : "Add task"}</button>
          </div>
        </form>
      </div>`);
    $("#aTitle").focus();
    $("#tForm").onsubmit = async (e) => {
      e.preventDefault();
      const body = { title: $("#aTitle").value, site: $("#aSite").value, dueDate: $("#aDue").value, category: $("#aCat").value, frequency: $("#aFreq").value, submittedTo: $("#aTo").value, responsible: $("#aResp").value, inspectionType: $("#aInsp").value, citation: $("#aCite").value, notes: $("#aNotes").value };
      try {
        const r = t
          ? await api(`tasks/${encodeURIComponent(t.id)}`, { method: "PATCH", body: { ...body, expectedUpdatedAt: t.updatedAt || "" } })
          : await api("tasks", { method: "POST", body });
        closeModal(); applyUpdated([r.task], r.rev); toast(t ? "Task updated" : "Task added");
        if (!t && r.task.year !== S.year) { S.year = r.task.year; buildYearOptions(); render(); }
      } catch (err) { const el = $("#aErr"); el.textContent = err.message; el.hidden = false; }
    };
    const del = $("#aDel");
    if (del) del.onclick = async () => {
      if (!confirm(`Delete "${t.title}" for ${t.site}? This removes it for everyone. (A copy is kept in the activity log.)`)) return;
      try {
        const r = await api(`tasks/${encodeURIComponent(t.id)}`, { method: "DELETE" });
        S.tasks = S.tasks.filter((x) => x.id !== t.id); S.selected.delete(t.id);
        closeModal(); applyUpdated([], r.rev); toast("Task deleted");
      } catch (err) { const el = $("#aErr"); el.textContent = err.message; el.hidden = false; }
    };
  }

  // ── chrome ────────────────────────────────────────────────────────────────
  function buildYearOptions() {
    const years = [...new Set([...S.tasks.map((t) => t.year), new Date().getFullYear()])].sort();
    if (!years.includes(S.year)) S.year = years.includes(new Date().getFullYear()) ? new Date().getFullYear() : years[years.length - 1];
    $("#yearSelect").innerHTML = years.map((y) => opt(y, S.year)).join("");
  }
  function switchView(v) { S.view = v; store.set("vcc_view", v); window.scrollTo(0, 0); render(); }

  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => switchView(b.dataset.view)));
  $("#yearSelect").onchange = (e) => { S.year = Number(e.target.value); S.selected.clear(); render(); };
  $("#userBtn").onclick = () => (S.user ? signOut() : openLogin());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });

  async function boot() {
    S.view = store.get("vcc_view") || "dashboard";
    restoreSession();
    render();
    setInterval(poll, POLL_MS);
    try {
      const sess = await api("session");
      S.options = sess.options; S.viewRequiresLogin = sess.viewRequiresLogin;
      if (S.token && !sess.user) { S.token = null; S.user = null; store.del("vcc_session"); }
      renderUser();
      if (S.viewRequiresLogin && !S.user) {
        $(`#view-${S.view}`).innerHTML = `<div class="card gate"><h2>Sign in required</h2><p class="sub">This calendar is restricted to Vantage staff.</p></div>`;
        setLive("", "Signed out");
        openLogin(true);
        return;
      }
      await loadAll();
    } catch (e) {
      setLive("err", "Can't reach server");
      $(`#view-${S.view}`).innerHTML = `<div class="card"><h2>Couldn't load the compliance calendar</h2><p class="sub">${esc(e.message)}</p></div>`;
    }
  }
  boot();
})();
