const path = require("path");
const { pathToFileURL } = require("url");

async function main() {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Users\\alisa\\AppData\\Local\\ms-playwright\\chromium-1148\\chrome-win\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(
    pathToFileURL(path.join(__dirname, "..", "index.html")).href + "?NODEMO",
    { waitUntil: "networkidle" }
  );
  await page.waitForSelector(".brand-mark");
  const box = await page.locator("header.topbar").boundingBox();
  await page.screenshot({
    path: path.join(__dirname, "..", "output", "08-header.png"),
    clip: box,
  });
  const mark = await page.locator(".brand-mark").evaluate((img) => ({
    w: img.naturalWidth,
    h: img.naturalHeight,
    complete: img.complete,
  }));
  console.log("brand-mark", mark);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
