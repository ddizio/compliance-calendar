# Vantage Environmental Compliance Calendar

A shared web app for tracking site environmental compliance tasks, hosted on Netlify.

- **Dashboard** — % on-time completion by site (the KPI), overdue items, monthly heat map, live activity feed
- **Task list** — filter by site / month / category / frequency / status; update status; bulk back-fill; CSV export
- **Calendar** — 12-month view, color-coded by site
- **Live** — every open browser checks for changes every 15 seconds, so the dashboard reflects edits from any site within seconds
- **Site-level permissions** — each site's editors can update only their site's tasks; administrators can edit everything and add/delete tasks
- **Audit trail** — every change is logged with the person's name, time, and before/after values

## How it works

| Piece | What it is |
|---|---|
| `public/` | The web page (HTML/CSS/JS, no build step) |
| `netlify/functions/api.mjs` | The server API (`/api/*`) — login, read/update tasks, activity log |
| `netlify/lib/seed.mjs` | The starting 2026 task list, loaded once on first run |
| Netlify Blobs | Netlify's built-in storage; holds tasks and the change log. No database to set up. |

After the first load, **the app's storage is the source of truth** — make changes in the app, not in `seed.mjs`.

## Deploy (about 15 minutes)

You need a Netlify account. Drag-and-drop deploys **won't work** for this app because the server function needs a build step to install its one dependency — use option A or B.

### A. From GitHub (recommended — easiest to update later)
1. Create a new private GitHub repository and upload the contents of this folder (keep the folder structure).
2. In Netlify: **Add new project → Import an existing project → GitHub** → pick the repo.
3. Netlify reads `netlify.toml` automatically. Leave build command blank; publish directory is `public`.
4. Before the first deploy (or right after), add the environment variables below under **Project configuration → Environment variables**, then **Deploys → Trigger deploy**.

### B. From your computer with the Netlify CLI
```bash
npm install -g netlify-cli
cd vantage-compliance
netlify login
netlify init          # create the project
# add environment variables (below) in the Netlify UI, then:
netlify deploy --prod
```

## Environment variables (passcodes)

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | Yes | Random string, 32+ characters. Signs login sessions. Never share. |
| `ADMIN_PASSCODE` | Yes | Administrator login — edit all sites, add/edit/delete tasks |
| `SITE_PASSCODE_CHICAGO` | Per site | Chicago editors |
| `SITE_PASSCODE_GURNEE` | Per site | Gurnee editors |
| `SITE_PASSCODE_ENGLEWOOD` | Per site | Englewood editors |
| `SITE_PASSCODE_LEUNA` | Per site | Leuna editors |
| `SITE_PASSCODE_CARNEGIE` | Per site | Carnegie editors |
| `SITE_PASSCODE_FAIRFIELD` | Per site | Fairfield editors |
| `VIEW_PASSCODE` | Recommended | If set, **everyone** must sign in even to view. If not set, anyone with the link can view (but not edit). |

A site with no passcode set simply has no editor login (only admins can update it).
Change a passcode any time in Netlify → redeploy. Existing sessions last up to 12 hours; to sign everyone out immediately, also change `AUTH_SECRET`.

Generate a strong `AUTH_SECRET` with e.g. `openssl rand -hex 32`, or any password manager's generator.

## First-day checklist

1. Sign in as Administrator and confirm the task list looks right.
2. **Back-fill 2026 completions.** At launch every task due before today shows *Overdue*, so the KPI starts near 0%. Site editors (or you) select completed tasks in the Task list and use the bulk bar: *Completed → on each task's due date* (if done on time) or a specific date. Only back-fill what you can document — every change is logged with the person's name.
3. Mark tasks that don't apply as **N/A** with a reason (excluded from the KPI).
4. Share the link and each site's passcode with that site's EHS lead.

## The KPI

- A task counts toward the rate once its due date has passed, or once it is completed (whichever comes first).
- **On-time rate = tasks completed on or before their due date ÷ those tasks.** N/A tasks are excluded.
- Overdue (past due, still open) counts against the rate until closed out; completing it late moves it to *Completed late*, which still counts against the rate.
- Target bands are set at the top of `public/app.js`: `KPI_TARGET = 95`, `KPI_WATCH = 85`.

## Common changes

- **Add a site:** add it to `SITES` in `netlify/lib/core.mjs` and a color in `SITE_COLORS` in `public/app.js`, add a `SITE_PASSCODE_<NAME>` variable, redeploy.
- **Add tasks:** use **+ Add task** in the app (admin). For many at once, add them to `seed.mjs` only *before* first launch; after that, use the app.
- **Next year:** add 2027 tasks via the app; the Year picker shows every year that has tasks.

## Limits to know

- Passcodes are shared per site, not individual accounts; the name typed at sign-in is recorded on every change but is not verified. For individual Microsoft logins, the Power Apps + SharePoint design remains the path.
- Netlify Blobs is intended for light workloads — fine for a few hundred tasks and dozens of users.
