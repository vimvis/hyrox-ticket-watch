import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const targetUrl =
  process.env.HYROX_MONITOR_URL_OVERRIDE ||
  "https://korea.hyrox.com/event/airasia-hyrox-incheon-season-25-26-h48hij?useEmbed=true";
const outputDir = path.resolve(process.cwd(), "tmp", "hyrox-diagnostics");

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests: Array<{ method: string; url: string; resourceType: string }> = [];
  const responses: Array<{ status: number; url: string; contentType: string | null }> = [];

  page.on("request", (request) => {
    requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
  });

  page.on("response", async (response) => {
    responses.push({
      status: response.status(),
      url: response.url(),
      contentType: response.headers()["content-type"] ?? null,
    });
  });

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: Number(process.env.HYROX_MONITOR_TIMEOUT_MS ?? "20000"),
  });

  await page.waitForTimeout(5000);

  const bodyText = await page.locator("body").innerText();
  const bodyHtml = await page.locator("body").innerHTML();
  const title = await page.title();

  await browser.close();

  await writeFile(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        targetUrl,
        title,
        requestCount: requests.length,
        responseCount: responses.length,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  await writeFile(path.join(outputDir, "requests.json"), JSON.stringify(requests, null, 2));
  await writeFile(path.join(outputDir, "responses.json"), JSON.stringify(responses, null, 2));
  await writeFile(path.join(outputDir, "body.txt"), bodyText);
  await writeFile(path.join(outputDir, "body.html"), bodyHtml);

  console.log(`HYROX diagnostics written to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
