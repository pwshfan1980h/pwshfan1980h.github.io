# Vibe Arcade: intent

A public directory of every vibe-coded game on the `pwshfan1980h` GitHub account. Visitors see themed cards, pick one and play it in the browser.

## Goals

1. **Zero-touch growth.** A new game shows up with no edits here: push a public repo with GitHub Pages turned on and the nightly build adds it. This has to keep working at hundreds of games.
2. **Each card answers four things**: what it looks like (thumbnail), what it is (description), where to play it, and where the code is.
3. **Browse by time.** Grouped by year (2026, 2027, …), with sort and filter by year, theme and score, plus search.
4. **Light tracking for fun**: commit count, time from first to last commit, last update, an AI critic score and verdict, and dead-link detection.
5. **Themed but readable.** Each card is styled to match its game's genre, but the layout stays consistent so a grid of hundreds still scans well.

## Non-goals

- No backend, database, accounts, comments or likes. It's a static site on GitHub Pages.
- No hand-written page per game. The game's own repo and README are the detail page.
- No framework or bundler. Plain HTML, CSS and JS in `site/`; the build scripts run on Node.
- Not a resume or portfolio of non-game work. Resume and other non-game repos stay excluded.

## Principles

- **The game repo is the source of truth.** Its description, Pages URL, topics and `og:image` feed the card. Fix data in the game repo first, and use `data/overrides.json` only for things a repo can't express (theme, featured, hidden, custom blurb).
- **Cheap to re-run.** The AI scores are cached by commit sha and screenshots are cached as files. A nightly run should cost almost nothing when nothing changed.
- **Fail soft.** One broken repo or dead link marks its own card; it never breaks the build.

## Where things go

| Path | What it is | Edited by |
|---|---|---|
| `data/config.json` | GitHub owner, site title, exclude globs, "dormant after N days" | you |
| `data/overrides.json` | Per-game fixes keyed by repo name | you |
| `data/scores.json` | AI score cache (sha-keyed) | `scripts/score.mjs` only |
| `scripts/build.mjs` | GitHub API → `site/games.json` + `site/feed.xml` | code |
| `scripts/screenshot.mjs` | Playwright captures for games with no `og:image` → `site/thumbs/` | code |
| `scripts/score.mjs` | Claude critic → `data/scores.json` | code |
| `site/` | The deployed static site (index, style, app, generated JSON/RSS, thumbs) | code + generated |
| `.github/workflows/build.yml` | Nightly + on-push build, score, commit caches, deploy Pages | code |
| `.claude/skills/arcade/` | How Claude should work in this repo | you / Claude |

Generated files (`site/games.json`, `site/feed.xml`, `site/thumbs/*`, `data/scores.json`) are committed by the bot. Don't hand-edit them; change the inputs and rebuild.

## Backlog (cheap ideas, roughly in order)

- [ ] Stats page: games per year, average score per year, theme mix.
- [ ] "On this day": games from the same date in earlier years.
- [ ] Hover-preview GIFs (record a few seconds with Playwright).
- [ ] Record which AI model/tool built each game (`model` override, or a `built-with-*` repo topic).
- [ ] Controls badges (keyboard / touch / gamepad) read from the README.
- [ ] Featured shelf at the top for `featured: true`.
- [ ] Trigger a rebuild from game repos on push (repository_dispatch) instead of waiting for the nightly run.
