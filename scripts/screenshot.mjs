// Screenshots play pages that have no og:image, saving site/thumbs/<name>.png.
// Existing thumbs are kept; delete one to re-shoot it. Run build.mjs again afterwards.
import { access, mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const root = new URL("..", import.meta.url);
const { games } = JSON.parse(await readFile(new URL("site/games.json", root), "utf8"));
const todo = [];
for (const g of games.filter((g) => g.needsScreenshot)) {
  const file = new URL(`site/thumbs/${g.name}.png`, root);
  if (await access(file).then(() => false, () => true)) todo.push([g, file]);
}
if (!todo.length) process.exit(console.log("No screenshots needed."));

await mkdir(new URL("site/thumbs/", root), { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [g, file] of todo) {
  try {
    await page.goto(g.playUrl, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(8000); // let engines (Godot, Three.js) boot past their splash
    await page.screenshot({ path: file.pathname });
    console.log(`📸 ${g.name}`);
  } catch (e) {
    console.log(`✗ ${g.name}: ${e.message.split("\n")[0]}`);
  }
}
await browser.close();
