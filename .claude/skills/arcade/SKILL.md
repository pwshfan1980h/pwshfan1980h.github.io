---
name: arcade
description: Understand and manage the Vibe Arcade repo (pwshfan1980h.github.io), the auto-built directory of the user's games. Use when adding a new game or game idea, hiding, re-theming or fixing a game's card, changing site goals or layout, running the build/screenshot scripts, planning a game, or deciding where a file or change belongs. Keep this skill updated whenever the repo's behaviour or workflow changes.
---

# Vibe Arcade

Read `INTENT.md` first. It holds the goals, non-goals and the "where things go" table. If a request conflicts with a goal or non-goal, say so before doing it. If the user changes direction, update `INTENT.md` in the same change.

## How the repo works

- **Live site:** https://pwshfan1980h.github.io/ · **repo:** `pwshfan1980h/pwshfan1980h.github.io` · **local:** `~/Projects/game-drawing-board-and-landing-page`
- **Discovery is automatic.** `scripts/build.mjs` lists every public, non-fork, non-archived repo on the `pwshfan1980h` account, skips anything matching `data/config.json` `exclude`, and builds one card per repo into `site/games.json` (plus `site/feed.xml`).
- **Where each card field comes from:**

  | Card field | Source, in priority order |
  |---|---|
  | title | override `title` → play page `<title>` → prettified repo name |
  | description | override → repo description |
  | play link | override `playUrl` → repo homepage → GitHub Pages URL |
  | thumbnail | override → play page `og:image` → `site/thumbs/<repo>.png` screenshot → GitHub's generated card |
  | tags | override `tags` → repo topics |
  | theme | override → first matching regex in `THEME_WORDS` (build.mjs) → `arcade` |
  | commits / build time / updated | GitHub commits API (first → last commit) |
  | status | override → `broken` (play link dead) → `abandoned` (no commits in `abandonedAfterDays`) → `playable` |
  | score | `data/scores.json` (parked: every card shows "★ TBD") |

- **Badges** (`site/app.js`): `wip` → WIP, `broken` → "link down", `abandoned` → "dormant". A `playable` game created in the last 14 days shows NEW.
- **CI** (`.github/workflows/build.yml`): on push to main, nightly at 09:17 UTC, and by manual dispatch, it runs build → screenshot → build again, commits generated files as `arcade-bot` with `[skip ci]`, then deploys `site/` to Pages. The bot commits, so **always `git pull --rebase` before committing here.**
- **The site** is plain `site/index.html` + `style.css` + `app.js`: themed cards grouped by year, search, sort, theme/year filters, a random-game button, URL-synced filters.

## Lifecycle of a game

1. **Idea:** plan in `ideas/<slug>/DESIGN.md` here (gitignored). Plan only; don't create a repo or code until asked. Check `~/Projects/game-asset-cache` (read its `AGENTS.md`) for art and sound that fits.
2. **Repo created** (only when the user asks): create `~/Projects/<slug>`, move the plan into its gitignored `plans/`, and add tracked `README.md` (pitch only, no plan details), `CLAUDE.md` (points at `plans/DESIGN.md`, plan-privacy rule, stack, asset rules, arcade listing steps) and `.gitignore` (with `plans/`). Create it public with a description and topics. Then here, add `"<slug>": { "theme": "...", "status": "wip" }` to `data/overrides.json`, rebuild, commit and push. `auto-party-story` was set up this way; copy it.
3. **Playable:** the game deploys to its own Pages site with a 1200×630 `og:image`. Remove `"status": "wip"` from the override and the nightly build (or a push here) picks it up.
4. **Dormant or retired:** happens automatically after `abandonedAfterDays`. To remove a game from the site, use `hidden: true`.

## Decide where a change belongs

Work through these in order and stop at the first that fits:

1. **Wrong or missing card data** (description, play link, thumbnail, tags): fix it in the *game's own repo* when possible:
   - description → `gh repo edit pwshfan1980h/<repo> --description "..."`
   - play link → enable Pages, or `gh repo edit … --homepage <url>`
   - tags → `gh repo edit … --add-topic <tag>`
   - thumbnail → add `<meta property="og:image" content="…/preview.png">` (1200×630) to the game's `index.html`
   These are outward-facing edits to another repo, so confirm with the user first.
2. **Things a repo can't express** (theme, featured, hidden, custom title or blurb, `model`, `status`): edit `data/overrides.json`, keyed by repo name.
3. **Account-wide rules** (exclude a repo pattern, site title, dormant threshold): edit `data/config.json`. Non-game repos (resume, the arcade itself, `*.github.io`) belong in `exclude`.
4. **Game plans:** never in tracked files. Use `ideas/<slug>/` here before the repo exists, and the game repo's `plans/` after. Never `git add -f` them or copy plan contents into READMEs, code comments or commit messages.
5. **How data is gathered:** edit `scripts/*.mjs`.
6. **How it looks:** edit `site/index.html`, `site/style.css` or `site/app.js`.

Never hand-edit generated files: `site/games.json`, `site/feed.xml`, `site/thumbs/*`, `data/scores.json`. Change the inputs and rebuild.

## Common tasks

- **Rebuild locally:** `GITHUB_TOKEN=$(gh auth token) npm run build`, then `npm run serve` (or `python3 -m http.server -d site`).
- **Re-shoot a thumbnail:** delete `site/thumbs/<repo>.png`, then `npm run shots`. Only games without an `og:image` get screenshots.
- **Scores:** parked and shown as TBD. The user doesn't want an API key used, so never add `ANTHROPIC_API_KEY` to CI or run `scripts/score.mjs` without being asked.
- **Add a theme:** add a regex to `THEME_WORDS` in `scripts/build.mjs` (order matters; the first match wins) and a `.card[data-theme="<name>"]` block in `site/style.css` that sets the `--c-*` variables (including `--c-on-accent` for Play button text). Load any new Google Font in `site/index.html`. Add the name to the theme list in `data/overrides.json` `_help`.
- **Hide a game:** `"<repo>": { "hidden": true }` in overrides. To drop a whole class of repos, add a glob to `config.exclude` instead.
- **Check a deploy:** `gh run list -L1`, then `curl -s https://pwshfan1980h.github.io/games.json`.

## Checks before finishing

- Run the build and confirm the game count and any `DEAD LINK` lines look right.
- For visual changes, screenshot the page at 1300px and 390px wide with Playwright and look for horizontal scroll, unreadable Play buttons on any theme, and broken images.
- Keep it static: no backend, no framework, no bundler (see the non-goals).
- When an idea from the backlog in `INTENT.md` ships, tick it there.

## Keep this skill current

This skill is the manual for the repo. **In the same change** as any edit that alters behaviour or workflow (a new override field, status, badge, theme, script, CI step, config key, or lifecycle step), update the matching section here and the table in `INTENT.md`. If something here turns out to be wrong, fix it on the spot. Commit skill updates alongside the code they describe.
