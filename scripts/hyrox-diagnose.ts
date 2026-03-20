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
  const interactionSnapshots: Array<{
    label: string;
    url: string;
    visibleText: string;
    buttons: Array<{ text: string; ariaLabel: string | null }>;
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

  const baselineRequestCount = requests.length;
  const baselineResponseCount = responses.length;

  const acceptAllButton = page.getByRole("button", { name: /accept all/i });
  if (await acceptAllButton.count()) {
    await acceptAllButton.first().click().catch(() => null);
    await page.waitForTimeout(1500);
  }

  interactionSnapshots.push({
    label: "after-consent",
    url: page.url(),
    visibleText: await page.locator("body").innerText(),
    buttons: await page
      .locator("button")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          text: (element.textContent ?? "").trim(),
          ariaLabel: element.getAttribute("aria-label"),
        })),
      ),
  });

  const buyTicketsButton = page.getByRole("button", { name: /buy tickets/i });
  if (await buyTicketsButton.count()) {
    await buyTicketsButton.first().click().catch(() => null);
    await page
      .waitForURL(/\/checkout\/[a-z0-9]+/i, {
        timeout: Number(process.env.HYROX_MONITOR_TIMEOUT_MS ?? "20000"),
      })
      .catch(() => null);
    await page.waitForLoadState("domcontentloaded").catch(() => null);
    await page.waitForTimeout(4000);
  }

  interactionSnapshots.push({
    label: "after-buy-tickets",
    url: page.url(),
    visibleText: await page.locator("body").innerText(),
    buttons: await page
      .locator("button")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          text: (element.textContent ?? "").trim(),
          ariaLabel: element.getAttribute("aria-label"),
        })),
      ),
  });

  const checkoutTicketMatches = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const lines = bodyText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const interesting = lines.filter(
      (line) =>
        /hyrox|relay|adaptive|spectator/i.test(line) ||
        /sold out|checkout|continue|add to cart|buy now|book now/i.test(line),
    );

    return interesting;
  });
  const checkoutObjectSnapshot = await page.evaluate(() => {
    const checkoutObject = document.querySelector(
      "object#sellmodal-anchor",
    ) as HTMLObjectElement | null;
    const checkoutDocument = checkoutObject?.contentDocument;
    const checkoutBody = checkoutDocument?.body;

    if (!checkoutBody) {
      return null;
    }

    const buttons = Array.from(checkoutBody.querySelectorAll("button")).map((button) => ({
      text: (button.textContent ?? "").trim(),
      ariaLabel: button.getAttribute("aria-label"),
      title: button.getAttribute("title"),
    }));

    return {
      title: checkoutDocument.title,
      text: checkoutBody.innerText,
      html: checkoutBody.innerHTML,
      buttons,
      lines: checkoutBody.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter(
          (line) =>
            /hyrox|relay|adaptive|spectator/i.test(line) ||
            /sold out|checkout|continue|add to cart|buy now|book now/i.test(line),
        ),
    };
  });
  const checkoutObjectUrl = await page.evaluate(() => {
    const checkoutObject = document.querySelector(
      "object#sellmodal-anchor",
    ) as HTMLObjectElement | null;

    return checkoutObject?.getAttribute("data") ?? null;
  });

  const checkoutFlowSnapshots: Array<{
    label: string;
    url: string;
    lines: string[];
    buttons: Array<{ text: string; ariaLabel: string | null }>;
  }> = [];

  if (checkoutObjectUrl) {
    const checkoutPage = await browser.newPage();
    await checkoutPage.goto(new URL(checkoutObjectUrl, targetUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: Number(process.env.HYROX_MONITOR_TIMEOUT_MS ?? "20000"),
    });
    await checkoutPage.waitForTimeout(4000);
    const checkoutAcceptAll = checkoutPage.getByRole("button", { name: /accept all/i });
    if (await checkoutAcceptAll.count()) {
      await checkoutAcceptAll.first().click().catch(() => null);
      await checkoutPage.waitForTimeout(1000);
    }

    const snapshotCheckoutPage = async (label: string) => {
      const lines = await checkoutPage.evaluate(() => {
        return document.body.innerText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .filter(
            (line) =>
              /hyrox|open|pro|men|women|mixed|doubles|relay|adaptive|spectator/i.test(line) ||
              /sold out|few tickets available|tickets available|checkout|continue|add to cart/i.test(
                line,
              ),
          );
      });
      const buttons = await checkoutPage.locator("button").evaluateAll((elements) =>
        elements.map((element) => ({
          text: (element.textContent ?? "").trim(),
          ariaLabel: element.getAttribute("aria-label"),
        })),
      );

      checkoutFlowSnapshots.push({
        label,
        url: checkoutPage.url(),
        lines,
        buttons,
      });
    };

    await snapshotCheckoutPage("checkout-direct");

    for (const category of ["Singles", "Doubles", "Relay", "Spectator"]) {
      const link = checkoutPage.getByRole("link", { name: new RegExp(category, "i") });
      if (await link.count()) {
        await link.first().click().catch(() => null);
        await checkoutPage.waitForTimeout(2000);
        await snapshotCheckoutPage(`category:${category.toLowerCase()}`);

        for (const className of ["Open", "Pro"]) {
          const classButton = checkoutPage.getByRole("button", {
            name: new RegExp(`^${className}$`, "i"),
          });
          if (await classButton.count()) {
            await classButton.first().click().catch(() => null);
            await checkoutPage.waitForTimeout(2000);
            await snapshotCheckoutPage(`category:${category.toLowerCase()}:class:${className.toLowerCase()}`);

            for (const gender of ["Men", "Women", "Mixed"]) {
              const genderButton = checkoutPage.getByRole("button", {
                name: new RegExp(gender, "i"),
              });
              if (await genderButton.count()) {
                await genderButton.first().click().catch(() => null);
                await checkoutPage.waitForTimeout(2000);
                await snapshotCheckoutPage(
                  `category:${category.toLowerCase()}:class:${className.toLowerCase()}:gender:${gender.toLowerCase()}`,
                );
                const backButton = checkoutPage.getByRole("button", { name: /^back$/i });
                if (await backButton.count()) {
                  await backButton.first().click().catch(() => null);
                  await checkoutPage.waitForTimeout(1000);
                }
              }
            }

            const backButton = checkoutPage.getByRole("button", { name: /^back$/i });
            if (await backButton.count()) {
              await backButton.first().click().catch(() => null);
              await checkoutPage.waitForTimeout(1000);
            }
          }
        }

        const backButton = checkoutPage.getByRole("button", { name: /^back$/i });
        if (await backButton.count()) {
          await backButton.first().click().catch(() => null);
          await checkoutPage.waitForTimeout(1000);
        }
      }
    }

    await checkoutPage.close();
  }

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
        interactionRequestCount: requests.length - baselineRequestCount,
        interactionResponseCount: responses.length - baselineResponseCount,
        finalUrl: page.url(),
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
  await writeFile(
    path.join(outputDir, "interaction-snapshots.json"),
    JSON.stringify(interactionSnapshots, null, 2),
  );
  await writeFile(
    path.join(outputDir, "interaction-requests.json"),
    JSON.stringify(requests.slice(baselineRequestCount), null, 2),
  );
  await writeFile(
    path.join(outputDir, "interaction-responses.json"),
    JSON.stringify(responses.slice(baselineResponseCount), null, 2),
  );
  await writeFile(
    path.join(outputDir, "checkout-visible-lines.json"),
    JSON.stringify(checkoutTicketMatches, null, 2),
  );
  await writeFile(
    path.join(outputDir, "checkout-object.json"),
    JSON.stringify(checkoutObjectSnapshot, null, 2),
  );
  await writeFile(
    path.join(outputDir, "checkout-flow.json"),
    JSON.stringify(checkoutFlowSnapshots, null, 2),
  );

  console.log(`HYROX diagnostics written to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
