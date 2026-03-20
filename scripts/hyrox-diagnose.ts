import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { extractVivenuTicketsFromNextData } from "../src/lib/services/vivenu-next-data";

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
  const interestingBodies: Array<{
    url: string;
    status: number;
    contentType: string | null;
    body: string;
  }> = [];

  page.on("request", (request) => {
    requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
  });

  page.on("response", async (response) => {
    const contentType = response.headers()["content-type"] ?? null;
    const url = response.url();

    responses.push({
      status: response.status(),
      url,
      contentType,
    });

    if (
      url.includes("/availabilities") ||
      url.includes("/web/api/") ||
      response.request().resourceType() === "fetch" ||
      response.request().resourceType() === "xhr"
    ) {
      try {
        interestingBodies.push({
          url,
          status: response.status(),
          contentType,
          body: await response.text(),
        });
      } catch {
        interestingBodies.push({
          url,
          status: response.status(),
          contentType,
          body: "[unreadable-response-body]",
        });
      }
    }
  });

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: Number(process.env.HYROX_MONITOR_TIMEOUT_MS ?? "20000"),
  });

  await page.waitForTimeout(5000);

  const bodyText = await page.locator("body").innerText();
  const bodyHtml = await page.locator("body").innerHTML();
  const title = await page.title();
  const nextDataJson =
    (await page.locator('script#__NEXT_DATA__').first().textContent().catch(() => null)) ?? "";
  const extractedTickets = extractVivenuTicketsFromNextData(nextDataJson);

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
  await writeFile(
    path.join(outputDir, "interesting-bodies.json"),
    JSON.stringify(interestingBodies, null, 2),
  );
  await writeFile(path.join(outputDir, "body.txt"), bodyText);
  await writeFile(path.join(outputDir, "body.html"), bodyHtml);
  await writeFile(path.join(outputDir, "next-data.json"), nextDataJson);
  await writeFile(path.join(outputDir, "tickets.json"), JSON.stringify(extractedTickets, null, 2));

  console.log(`HYROX diagnostics written to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
