# GCIT Arena

Custom CTFd theme for Gyalpozhing College of Information Technology — dark cyber/hacker aesthetic with official GCIT brand colors.

## Develop

```bash
cd CTFd/themes/gcit-arena
yarn install
yarn dev    # watch build
yarn build  # production build
```

`yarn install` also installs a local git pre-commit hook (`scripts/install-hooks.js` →
`hooks/pre-commit`) that rebuilds `static/` automatically whenever a commit stages
changes under `assets/`, so a stale hashed bundle can never get committed. It's
theme-scoped and machine-local — it only touches this folder's build output and your
own `.git/hooks/`, never CTFd's backend/API code. Re-run it any time with
`yarn hooks:install`. Before pushing, `yarn verify` gives the same guarantee in CI-style
form (build + fail if `static/` differs from what's committed).

## Activate

Admin Panel → Config → Themes → select **gcit-arena** → Update.

## Cross-device gamification sync (optional)

The visit streak and "seen achievement" toasts in `assets/js/gamification.js` are
cosmetic and normally live only in the visitor's browser (`localStorage`). To let them
follow a user across devices — with **no code changes, no new API** — create one
custom field from the existing admin UI:

**Admin Panel → Config → Fields → Add User Field**

| Setting | Value |
|---|---|
| Name | `GCIT Progress` |
| Type | Text |
| Public | off |
| Editable | on |

Once that field exists, `assets/js/utils/profileSync.js` reads/writes it through
CTFd's existing `GET/PATCH /api/v1/users/me` endpoint (the same one CTFd already uses
for a user editing their own profile fields) to merge streak/seen-badge state across
devices. If the field is never created, everything silently falls back to the original
localStorage-only behavior — nothing breaks.

## Structure

- `assets/` — SCSS/JS sources (edit these)
- `static/` — Vite output + `manifest.json` (served at runtime)
- `templates/` — Jinja2 templates

## Logo

Placeholder hexagon mark lives at `assets/img/logo-placeholder.svg`. Replace with official GCIT assets when available, then rebuild.
