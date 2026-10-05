# GCIT Arena — install on an existing CTFd

This folder is a finished CTFd theme. The CSS and JavaScript are already built. Copy the folder in, select it in the admin panel, and restart CTFd. No Node.js, Yarn, or `yarn build` is required on the server.

Built and checked against **CTFd 3.8.7**. Use it on a 3.8.x instance. It will not drop cleanly onto CTFd 3.5 or older, because those versions use a different theme layout.

## 1. Copy the folder

The directory that already contains the stock themes `core` and `admin` is the themes directory. On a normal checkout that path is:

```text
CTFd/themes/gcit-arena
```

Inside the official Docker image it is:

```text
/opt/CTFd/CTFd/themes/gcit-arena
```

The folder name must stay **`gcit-arena`**. The logo, hero image, and notification sounds are requested by that name. Renaming the folder, or nesting it (for example `themes/student/gcit-arena`), makes those files 404 and the theme will not appear in the theme dropdown.

The copy must include:

| Path | Why it is required |
|---|---|
| `templates/` | Pages CTFd renders |
| `static/manifest.json` | Tells CTFd which built CSS/JS files to load |
| `static/assets/` | Built CSS and JavaScript |
| `static/img/` | Logo and hero image |
| `static/sounds/` | Notification sounds |
| `static/webfonts/` | Icon fonts |

`assets/` is the source used to rebuild the theme. It is safe to include and is not read at runtime. Do **not** copy `node_modules/`. It is large and unused on the server.

### Docker

If the themes directory is not mounted from the host, a copy made only on the host never reaches the container. Copy into the path above inside the running container, or bind-mount the folder:

```text
/path/on/host/gcit-arena:/opt/CTFd/CTFd/themes/gcit-arena
```

A `docker cp` into a container disappears the next time that container is recreated. A bind mount survives restarts.

## 2. Restart CTFd

Restart the CTFd process (or the `ctfd` container) after the folder is in place. CTFd caches the asset manifest in memory. A restart is what makes the new files the ones actually served, especially if an older `gcit-arena` folder was already there.

Then hard-refresh the browser (Ctrl+F5) so it does not keep the previous theme's CSS.

## 3. Turn the theme on

1. Log in as an admin.
2. Open **Admin Panel → Config → Theme**.
3. Set **Theme** to `gcit-arena`.
4. Click **Update**.

Leave **Primary Color → Build CSS** alone. This theme ships its own palette (green, orange, and blue on a dark background). The color builder does not restyle it.

Open the public home page. You should see the dark GCIT Arena hero, the mountain graphic on the right, and the green terminal block. If the page is still the stock light CTFd theme, the folder is not in the themes directory the process is reading, or the theme was not saved.

## 4. Visibility settings that the theme expects

The theme only displays data CTFd already exposes. It does not add API routes. These admin settings control which of the new widgets have anything to show.

**Admin Panel → Config → Visibility**

| Setting | Suggested value | What stays empty if it is hidden |
|---|---|---|
| Challenge Visibility | Public (or Private, once users are logged in) | Challenge board, skill-tree view, category icons |
| Account Visibility | Public | Scoreboard names, podium, activity ticker |
| Score Visibility | Public | Scores, rank movement, live solve counters, first-blood markers |

**Admin Panel → Config → Settings** (or the equivalent time fields)

- Set the CTF **start** and **end** if you want the countdown bar and the terminal `status` command to report the schedule. With no schedule, those widgets simply say the event is not time-limited.

User mode can be **users** or **teams**. The scoreboard, rival comparison, and navbar HUD follow whichever mode is active. Team profile pages exist only in teams mode.

## 5. Optional: keep the visit streak across devices

By default the visit streak and "already seen" achievement toasts live in each browser (`localStorage`). To make that cosmetic state follow a user who logs in on another device, add one custom field. No code change and no new API.

**Admin Panel → Config → Fields → Add User Field**

| Setting | Value |
|---|---|
| Name | `GCIT Progress` |
| Type | Text |
| Public | off |
| Editable | on |

The name must match exactly, including the space and capitalization. If the field is missing, the theme keeps working and stores the streak in that browser only.

## 6. What each page does, after the theme is on

Nothing else has to be configured for these. They appear from the data already in the CTF.

- **Home.** Activity ticker, terminal (`help`, `rules`, `status`, `clear`), and counters for total solves, active players, and challenges.
- **Scoreboard.** Top-3 podium, rank arrows against the last positions stored in that browser, and a chart. A logged-in player can click another row to compare that line with their own. Their own row is marked **you** and cannot be selected as a rival.
- **Challenges.** Category icons, a skill-tree toggle, a first-blood marker when a challenge has 0 or 1 solve, a copy button on connection strings, and a short flash when a flag is right or wrong.
- **Profile and team.** Rank, RPG title from the point total, achievement badges, and a category radar chart once the player has solves in at least three categories.
- **Navbar (while logged in).** Rank, points, solve count, level bar, and a sound on/off button. A correct flag plays a short tone and a confetti burst. Both can be muted.

## 7. Do not do these

- Do not rename the folder.
- Do not delete `static/` and expect the server to compile `assets/`.
- Do not run `yarn install` or `yarn build` on the server unless someone is actively editing the theme source.
- Do not point **Theme Header** or **Theme Footer** at files from another theme.

## 8. If it does not look right

| What you see | What to check |
|---|---|
| `gcit-arena` is not in the theme dropdown | The folder is not a direct child of the themes directory the running process uses. In Docker, confirm the path inside the container. |
| Theme is selected, but the site has no styling | `static/manifest.json` or `static/assets/` was left out of the copy. Restart CTFd after putting them back. |
| Styling is an older mix of this theme | The browser or CTFd is holding a cached manifest. Restart CTFd and hard-refresh. |
| Logo or hero image is missing | `static/img/` was left out, or the folder was renamed. |
| Scoreboard and counters are blank | Score visibility or account visibility is not Public, or the event has no solves yet. |
| Navbar HUD never appears | The visitor is not logged in. The HUD is only rendered for an authenticated user. |
| Streak resets on another computer | The `GCIT Progress` field was not created, or its name does not match exactly. |

Fonts are loaded from Google Fonts. If that host is blocked, text falls back to the system font. The layout still works.
