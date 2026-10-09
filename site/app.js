const $ = (s) => document.querySelector(s);
const state = { q: "", sort: "new", theme: "", year: "" };
let data;

const fmtSpan = (h) => {
  if (h == null) return null;
  if (h < 1) return "built in <1 hr";
  if (h < 48) return `built in ${Math.round(h)} hr`;
  return `${Math.round(h / 24)} days of work`;
};
const ago = (iso) => {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d < 1 ? "today" : d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`;
};

const SORTS = {
  new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  old: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  score: (a, b) => (b.score?.value ?? -1) - (a.score?.value ?? -1),
  commits: (a, b) => (b.commits ?? 0) - (a.commits ?? 0),
  quick: (a, b) => (a.buildHours ?? 1e9) - (b.buildHours ?? 1e9),
  updated: (a, b) => new Date(b.lastCommitAt) - new Date(a.lastCommitAt),
};

function card(g) {
  const el = $("#card").content.firstElementChild.cloneNode(true);
  el.id = `g-${g.name}`;
  el.dataset.theme = g.theme;
  const thumb = el.querySelector(".thumb");
  thumb.href = g.playUrl || g.repoUrl;
  thumb.setAttribute("aria-label", `Play ${g.title}`);
  el.querySelector("img").src = g.thumbnail;
  const status = el.querySelector(".status");
  const isNew = Date.now() - new Date(g.createdAt) < 14 * 86400000;
  const s = isNew && g.status !== "broken" ? "new" : g.status;
  status.textContent = { new: "new", broken: "link down", abandoned: "dormant", wip: "WIP" }[s] ?? "";
  status.dataset.s = s;
  status.hidden = !status.textContent;
  if (g.score) {
    const badge = el.querySelector(".score");
    badge.hidden = false;
    badge.textContent = `★ ${g.score.value.toFixed(1)}`;
    badge.title = "AI critic score";
    const v = el.querySelector(".verdict");
    v.hidden = false;
    v.textContent = `“${g.score.verdict}”`;
  }
  el.querySelector(".title").textContent = g.title;
  el.querySelector(".desc").textContent = g.description;
  const meta = [g.engine, g.commits != null && `${g.commits} commit${g.commits === 1 ? "" : "s"}`, fmtSpan(g.buildHours), `updated ${ago(g.lastCommitAt)}`, g.touch && "📱 touch", g.model, ...g.tags];
  el.querySelector(".meta").append(...meta.filter(Boolean).map((t) => Object.assign(document.createElement("li"), { textContent: t })));
  const play = el.querySelector(".play");
  if (g.playUrl) play.href = g.playUrl;
  else { play.setAttribute("aria-disabled", "true"); play.textContent = "No web build"; }
  el.querySelector(".code").href = g.repoUrl;
  return el;
}

function render() {
  const q = state.q.toLowerCase();
  const list = data.games
    .filter((g) => !state.theme || g.theme === state.theme)
    .filter((g) => !state.year || String(g.year) === state.year)
    .filter((g) => !q || `${g.title} ${g.description} ${g.engine} ${g.tags.join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => (b.featured - a.featured) || SORTS[state.sort](a, b));

  const main = $("#list");
  main.replaceChildren();
  if (!list.length) return main.append(Object.assign(document.createElement("p"), { className: "empty", textContent: "No games match." }));

  // Group under year headers when sorting by date; one flat grid otherwise.
  const byYear = state.sort === "new" || state.sort === "old";
  const groups = byYear ? Object.entries(Object.groupBy(list, (g) => g.year)).sort(([a], [b]) => (state.sort === "new" ? b - a : a - b)) : [[null, list]];
  for (const [year, games] of groups) {
    if (year) {
      const h = document.createElement("h2");
      h.className = "year-head";
      h.innerHTML = `${year} <small>${games.length} game${games.length === 1 ? "" : "s"}</small>`;
      main.append(h);
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.append(...games.map(card));
    main.append(grid);
  }
}

function controls() {
  const years = [...new Set(data.games.map((g) => g.year))].sort((a, b) => b - a);
  const yearBox = $("#years");
  for (const y of ["", ...years]) {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: y || "All years" });
    b.setAttribute("aria-pressed", String(String(y) === state.year));
    b.onclick = () => {
      state.year = String(y);
      yearBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      sync();
    };
    yearBox.append(b);
  }
  for (const t of [...new Set(data.games.map((g) => g.theme))].sort()) {
    $("#theme").append(new Option(t[0].toUpperCase() + t.slice(1), t));
  }
  for (const id of ["q", "sort", "theme"]) {
    $(`#${id}`).value = state[id];
    $(`#${id}`).addEventListener("input", (e) => { state[id] = e.target.value; sync(); });
  }
  $("#random").onclick = () => {
    const live = data.games.filter((g) => g.playUrl && g.status !== "broken");
    const g = live[Math.floor(Math.random() * live.length)];
    Object.assign(state, { q: "", theme: "", year: "" });
    $("#q").value = $("#theme").value = "";
    yearBox.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", String(i === 0)));
    sync();
    const el = document.getElementById(`g-${g.name}`);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash");
  };
}

// Keep filters in the URL so a filtered view can be shared.
function sync() {
  const p = new URLSearchParams(Object.entries(state).filter(([k, v]) => v && !(k === "sort" && v === "new")));
  history.replaceState(null, "", p.size ? `?${p}` : location.pathname);
  render();
}

function stats() {
  const g = data.games;
  const scored = g.filter((x) => x.score);
  const items = [
    ["games", g.length],
    ["commits", g.reduce((n, x) => n + (x.commits || 0), 0).toLocaleString()],
    ["years", new Set(g.map((x) => x.year)).size],
    scored.length && ["avg AI score", (scored.reduce((n, x) => n + x.score.value, 0) / scored.length).toFixed(1)],
  ].filter(Boolean);
  $("#stats").innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

(async () => {
  data = await (await fetch("games.json")).json();
  Object.assign(state, Object.fromEntries(new URLSearchParams(location.search)));
  document.title = $("#site-title").textContent = data.title;
  $("#generated").textContent = `Updated ${new Date(data.generatedAt).toLocaleDateString()}`;
  $("#gh-link").href = `https://github.com/${data.owner}`;
  stats();
  controls();
  render();
})();
