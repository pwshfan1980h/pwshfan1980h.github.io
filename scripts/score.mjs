// AI-judges each game from its README, description, stats and thumbnail.
// Cached in data/scores.json by commit sha, so a game is only re-scored after new commits.
// Needs ANTHROPIC_API_KEY (or an `ant auth login` profile). Run build.mjs before and after.
import { readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const root = new URL("..", import.meta.url);
const scoresFile = new URL("data/scores.json", root);
const { owner, games } = JSON.parse(await readFile(new URL("site/games.json", root), "utf8"));
const scores = JSON.parse(await readFile(scoresFile, "utf8").catch(() => "{}"));
const force = process.argv.includes("--force");
const client = new Anthropic();

const RUBRIC = `You are a blunt but fair indie game critic judging small "vibe coded" browser games
(built quickly with AI help). Score 1-10 using this rubric, then average into one overall score:
- Fun: is there a clear core loop that seems enjoyable?
- Polish: art direction, feel, UI, presentation.
- Originality: a fresh idea or twist versus a plain clone.
- Completeness: win/lose states, progression, does it seem finished and working.
Most quick prototypes land 4-6. Reserve 9-10 for exceptional work. Judge only what the evidence shows.`;

const schema = {
  type: "object",
  properties: {
    fun: { type: "integer" },
    polish: { type: "integer" },
    originality: { type: "integer" },
    completeness: { type: "integer" },
    score: { type: "number", description: "Overall 1-10, one decimal" },
    verdict: { type: "string", description: "One punchy sentence, max 20 words" },
  },
  required: ["fun", "polish", "originality", "completeness", "score", "verdict"],
  additionalProperties: false,
};

async function readme(name) {
  const res = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/HEAD/README.md`);
  return res.ok ? (await res.text()).slice(0, 20000) : "(no README)";
}

for (const g of games) {
  if (!g.sha || (!force && scores[g.name]?.sha === g.sha)) continue;
  const facts = { title: g.title, description: g.description, engine: g.engine, commits: g.commits, daysOfWork: +(g.buildHours / 24).toFixed(1), playable: g.playAlive };
  const content = [
    { type: "text", text: `Game facts: ${JSON.stringify(facts)}\n\nREADME:\n${await readme(g.name)}` },
  ];
  if (/^https?:/.test(g.thumbnail) && !g.thumbnail.includes("opengraph.githubassets.com")) {
    content.unshift({ type: "image", source: { type: "url", url: g.thumbnail } });
  }
  try {
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: RUBRIC,
      messages: [{ role: "user", content }],
    });
    if (msg.stop_reason === "refusal") throw new Error("model declined");
    const result = JSON.parse(msg.content.find((b) => b.type === "text").text);
    scores[g.name] = { ...result, sha: g.sha, scoredAt: new Date().toISOString() };
    console.log(`★ ${g.name}: ${result.score} — ${result.verdict}`);
  } catch (e) {
    console.log(`✗ ${g.name}: ${e.message}`);
  }
}
await writeFile(scoresFile, JSON.stringify(scores, null, 2) + "\n");
