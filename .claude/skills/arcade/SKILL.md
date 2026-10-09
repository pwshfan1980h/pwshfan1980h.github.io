---
name: arcade
description: Manage the Vibe Arcade game directory. Use when adding, hiding, re-theming or fixing a game's card, changing site goals or layout, running the build/screenshot/score scripts, or deciding where a file or change belongs in this repo.
---

# Vibe Arcade

Read `INTENT.md` first. It holds the goals, non-goals and the "where things go" table. If a request conflicts with a goal or non-goal, say so before doing it. If the user changes direction, update `INTENT.md` in the same change.

## Decide where a change belongs

Work through these in order and stop at the first that fits:

1. **Wrong or missing card data** (description, play link, thumbnail): fix it in the *game's own repo* when possible:
   - description → `gh repo edit pwshfan1980h/<repo> --description "..."`
   - play link → enable Pages, or `gh repo edit … --homepage <url>`
   - tags → `gh repo edit … --add-topic <tag>` (topics become card tags)
   - thumbnail → add `<meta property="og:image" content="…/preview.png">` (1200×630) to the game's `index.html`
   These are outward-facing edits to another repo, so confirm with the user first.
2. **Things a repo can't express** (theme, featured, hidden, custom title or blurb, `model`, `status`): edit `data/overrides.json`, keyed by repo name.
3. **Account-wide rules** (exclude a repo pattern, site title, dormant threshold): edit `data/config.json`. Non-game repos (resume, the arcade itself, `*.github.io`) belong in `exclude`.
4. **How data is gathered**: edit `scripts/*.mjs`.
5. **Any game plan**: before the game has a repo, `ideas/<game-slug>/DESIGN.md`; after, it moves to the game repo's gitignored `plans/` folder (e.g. `~/Projects/auto-party-story/plans/`). `ideas/` is gitignored, so plans never reach the public repo; never force-add them or copy plan contents into tracked files. Plan only; don't create the repo or scaffold code until asked. Check `~/Projects/game-asset-cache` (read its `AGENTS.md`) for art and sound that fits.
6. **How it looks**: edit `site/index.html`, `site/style.css` or `site/app.js`.

Never hand-edit generated files: `site/games.json`, `site/feed.xml`, `site/thumbs/*`, `data/scores.json`. Change the inputs and rebuild.

## Common tasks

- **Rebuild locally**: `GITHUB_TOKEN=$(gh auth token) npm run build`, then `npm run serve`.
- **Re-shoot a thumbnail**: delete `site/thumbs/<repo>.png`, then `npm run shots`. Only games without an `og:image` get screenshots.
- **Scores**: parked and shown as TBD. The user doesn't want an API key used, so never add `ANTHROPIC_API_KEY` to CI or run `scripts/score.mjs` without being asked.
- **Add a theme**: add a regex to `THEME_WORDS` in `scripts/build.mjs` (order matters; the first match wins) and a `.card[data-theme="<name>"]` block in `site/style.css` that sets the `--c-*` variables (including `--c-on-accent` for Play button text). Load any new Google Font in `site/index.html`. Add the name to the theme list in `data/overrides.json` `_help`.
- **Hide a game**: `"<repo>": { "hidden": true }` in overrides. To drop a whole class of repos, add a glob to `config.exclude` instead.

## Checks before finishing

- Run `npm run build` and confirm the game count and any `DEAD LINK` lines look right.
- For visual changes, screenshot the page at 1300px and 390px wide with Playwright and look for horizontal scroll, unreadable Play buttons on any theme, and broken images.
- Keep it static: no backend, no framework, no bundler (see the non-goals).
- When an idea from the backlog in `INTENT.md` ships, tick it there.
