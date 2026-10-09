// Builds site/games.json from every public repo on the GitHub account.
// No dependencies. Needs GITHUB_TOKEN (or GH_TOKEN) in the environment.
import { access, readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const readJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(new URL(p, root), "utf8")); } catch { return fallback; }
};

const config = await readJson("data/config.json", {});
const overrides = await readJson("data/overrides.json", {});
const scores = await readJson("data/scores.json", {});
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function gh(path, { raw = false } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "vibe-arcade-builder",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (raw) return res;
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

const globToRegex = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
const excludes = (config.exclude || []).map(globToRegex);
const isExcluded = (name) => excludes.some((re) => re.test(name));

async function listRepos(owner) {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/users/${owner}/repos?per_page=100&page=${page}&type=owner`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

// Commit count, first and latest commit via the Link header trick (2 requests per repo).
async function commitStats(owner, repo) {
  const res = await gh(`/repos/${owner}/${repo}/commits?per_page=1`, { raw: true });
  if (!res.ok) return null;
  const [latest] = await res.json();
  if (!latest) return null;
  const last = (res.headers.get("link") || "").match(/[?&]page=(\d+)>; rel="last"/);
  const count = last ? Number(last[1]) : 1;
  let first = latest;
  if (count > 1) [first] = await gh(`/repos/${owner}/${repo}/commits?per_page=1&page=${count}`);
  return {
    count,
    sha: latest.sha,
    firstAt: first.commit.author.date,
    lastAt: latest.commit.author.date,
  };
}

// Pull <title> and og:image from the play page.
async function pageMeta(url) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { alive: false };
    const html = await res.text();
    const meta = (prop) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"))?.[1];
    return {
      alive: true,
      title: html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim(),
      image: meta("og:image") ? new URL(meta("og:image"), url).href : null,
      touch: /ontouchstart|touchstart|pointerdown|virtual-joystick|mobile/i.test(html),
    };
  } catch {
    return { alive: false };
  }
}

// Best-guess theme from the words in the description. Override in data/overrides.json.
const THEME_WORDS = {
  space: /\b(space|lunar|moon|rocket|orbit|star|galaxy|asteroid|alien)\b/i,
  mech: /\b(mech|robot|tank|biped|armou?r)\b/i,
  cozy: /\b(paper ?route|farm|cozy|garden|village|town|herald|delivery)\b/i,
  fantasy: /\b(jrpg|rpg|dragon|wyrm|quest|dungeon|knight|wizard|sword)\b/i,
  dark: /\b(dark|crypt|skeleton|horror|undead)\b/i,
  retro: /\b(90s|80s|1985|arcade|pixel|8-bit|16-bit|homage|retro)\b/i,
};
const guessTheme = (text) => Object.keys(THEME_WORDS).find((t) => THEME_WORDS[t].test(text)) || "arcade";

const ENGINES = { GDScript: "Godot", Rust: "Rust/WASM", TypeScript: "TypeScript", JavaScript: "JavaScript" };
const prettify = (name) => name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const DAY = 86400000;
const exists = (p) => access(new URL(p, root)).then(() => true, () => false);

const owner = config.owner;
const repos = (await listRepos(owner)).filter(
  (r) => !r.private && !r.archived && (config.includeForks || !r.fork) && !isExcluded(r.name) && !overrides[r.name]?.hidden,
);

const games = [];
for (const r of repos) {
  const o = overrides[r.name] || {};
  const pages = r.has_pages ? await gh(`/repos/${owner}/${r.name}/pages`) : null;
  const playUrl = o.playUrl || r.homepage || pages?.html_url || null;
  const [commits, meta] = await Promise.all([commitStats(owner, r.name), playUrl ? pageMeta(playUrl) : {}]);
  const lastAt = commits?.lastAt || r.pushed_at;
  const idleDays = (Date.now() - new Date(lastAt)) / DAY;
  const buildHours = commits ? (new Date(commits.lastAt) - new Date(commits.firstAt)) / 3600000 : null;
  const description = o.description || r.description || "";
  const score = commits && scores[r.name];

  games.push({
    name: r.name,
    title: o.title || meta.title || prettify(r.name),
    description,
    repoUrl: r.html_url,
    playUrl,
    playAlive: playUrl ? meta.alive : null,
    thumbnail:
      o.thumbnail ||
      meta.image ||
      ((await exists(`site/thumbs/${r.name}.png`)) ? `thumbs/${r.name}.png` : `https://opengraph.githubassets.com/1/${owner}/${r.name}`),
    needsScreenshot: !o.thumbnail && !meta.image && !!playUrl && meta.alive !== false,
    createdAt: r.created_at,
    year: new Date(r.created_at).getUTCFullYear(),
    lastCommitAt: lastAt,
    commits: commits?.count ?? null,
    buildHours,
    engine: ENGINES[r.language] || r.language || null,
    stars: r.stargazers_count,
    theme: o.theme || guessTheme(`${r.name} ${description}`),
    tags: o.tags || r.topics || [],
    touch: meta.touch || false,
    featured: !!o.featured,
    model: o.model || null,
    status: o.status || (playUrl && meta.alive === false ? "broken" : idleDays > (config.abandonedAfterDays ?? 120) ? "abandoned" : "playable"),
    score: score ? { value: score.score, verdict: score.verdict, stale: score.sha !== commits.sha } : null,
    sha: commits?.sha || null,
  });
  console.log(`✓ ${r.name}  ${commits?.count ?? "?"} commits  ${playUrl ? (meta.alive ? "live" : "DEAD LINK") : "no play url"}`);
}

games.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const out = { title: config.siteTitle || "Games", owner, generatedAt: new Date().toISOString(), games };
await writeFile(new URL("site/games.json", root), JSON.stringify(out, null, 2) + "\n");

// RSS of the newest 50 games.
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const siteUrl = config.siteUrl || `https://${owner}.github.io/`;
const items = games.slice(0, 50).map((g) => `  <item>
    <title>${esc(g.title)}</title>
    <link>${esc(g.playUrl || g.repoUrl)}</link>
    <guid>${esc(g.repoUrl)}</guid>
    <pubDate>${new Date(g.createdAt).toUTCString()}</pubDate>
    <description>${esc(g.description)}</description>
  </item>`).join("\n");
await writeFile(new URL("site/feed.xml", root), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(out.title)}</title>
  <link>${esc(siteUrl)}</link>
  <description>New games</description>
${items}
</channel></rss>
`);
console.log(`\nWrote ${games.length} games to site/games.json and site/feed.xml`);
