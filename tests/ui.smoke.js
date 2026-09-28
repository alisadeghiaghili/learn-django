/**
 * Headless UI smoke for LearnDjango.
 *
 * Run: node tests/ui.smoke.js
 */

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

async function main() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    ({ chromium } = require("playwright-core"));
  }

  const candidates = [
    process.env.CHROMIUM_PATH,
    "C:\\Users\\alisa\\AppData\\Local\\ms-playwright\\chromium-1148\\chrome-win\\chrome.exe",
  ].filter(Boolean);
  const executablePath = candidates.find((p) => p && fs.existsSync(p));
  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1) Intro dialog
  const introUrl = pathToFileURL(path.join(__dirname, "..", "index.html")).href;
  await page.goto(introUrl);
  await page.waitForSelector("#dialog .dialog-panel");
  await page.screenshot({ path: path.join(outDir, "01-intro.png") });

  // 2) Level found-07 mid-progress
  const fileUrl =
    pathToFileURL(path.join(__dirname, "..", "index.html")).href +
    "?NODEMO&level=found-07";
  await page.goto(fileUrl);
  await page.waitForSelector("#terminal-input");

  const run = async (line) => {
    await page.fill("#terminal-input", line);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(60);
  };

  await run("middleware Common");
  await run("url /blog/ blog.post_list");
  await run("view blog post_list template:blog/post_list.html");
  await run("template blog post_list.html");
  await page.screenshot({ path: path.join(outDir, "02-wired.png") });

  await run("request /blog/");

  const log = await page.textContent("#terminal-log");
  if (!log.includes("LEVEL CLEAR")) {
    throw new Error("expected LEVEL CLEAR, got:\n" + log.slice(-500));
  }

  const nodes = await page.locator("#graph g[data-node-id]").count();
  if (nodes < 4) {
    throw new Error(`expected graph nodes, found ${nodes}`);
  }

  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, "03-cleared.png") });

  // 3) Levels browser
  await page.goto(fileUrl);
  await page.waitForSelector("#btn-levels");
  // close nothing — NODEMO skips intro
  await page.click("#btn-levels");
  await page.waitForSelector(".level-card");
  await page.screenshot({ path: path.join(outDir, "04-levels.png") });

  await browser.close();
  console.log("ui smoke ok — screenshots in output/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
