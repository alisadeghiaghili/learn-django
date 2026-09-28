const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

async function main() {
  const { chromium } = require("playwright-core");
  const root = path.join(__dirname, "..");
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Users\\alisa\\AppData\\Local\\ms-playwright\\chromium-1148\\chrome-win\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  const html =
    '<!doctype html><html><body style="margin:0;background:#0C4B33">' +
    '<img id="logo" src="favicon.svg" width="256" height="256" alt="" style="display:block"></body></html>';
  fs.writeFileSync(path.join(root, "assets", "_favicon_preview.html"), html);
  await page.goto(
    pathToFileURL(path.join(root, "assets", "_favicon_preview.html")).href,
    { waitUntil: "networkidle" }
  );
  await page.locator("#logo").screenshot({
    path: path.join(root, "assets", "favicon.png"),
  });
  await browser.close();
  console.log("favicon.png", fs.statSync(path.join(root, "assets", "favicon.png")).size);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
