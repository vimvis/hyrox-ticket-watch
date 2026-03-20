import type { Page } from "playwright";

import { getHyroxMonitorTimeoutMs, getHyroxMonitorUrlOverride } from "@/lib/env";
import {
  extractVivenuEventIdFromNextData,
  extractVivenuTicketsFromNextData,
  matchVivenuTicketForOption,
  type VivenuTicket,
} from "@/lib/services/vivenu-next-data";
import type { TicketObservation, TicketOption } from "@/lib/types";

const SOLD_OUT_SIGNALS = ["sold out", "soldout", "unavailable", "waitlist only"];
const AVAILABLE_SIGNALS = ["buy now", "book now", "register now", "add to cart", "checkout"];

function normalizeText(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function extractVivenuEventId(input: string) {
  const apiMatch = input.match(/api\/public\/events\/([a-z0-9]+)\/availabilities/i);

  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  const jsonMatch = input.match(/"id":"([a-z0-9]{24})"/i);
  return jsonMatch?.[1] ?? null;
}

function extractNextDataJson(input: string) {
  const match = input.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  return match?.[1] ?? null;
}

function buildNeedles(option: TicketOption) {
  const selectorHints = option.sourceSelector?.textMustInclude ?? [];

  return [option.divisionName, option.categoryName, option.displayLabel, ...selectorHints]
    .map(normalizeText)
    .filter(Boolean);
}

function detectStatusFromText(text: string, option: TicketOption): Omit<TicketObservation, "ticketOptionId"> {
  const normalized = normalizeText(text);
  const soldOutSignals = option.sourceSelector?.soldOutText?.map(normalizeText) ?? SOLD_OUT_SIGNALS;
  const availableSignals =
    option.sourceSelector?.availableText?.map(normalizeText) ?? AVAILABLE_SIGNALS;
  const needles = buildNeedles(option);

  const hasNeedle = needles.some((needle) => normalized.includes(needle));
  const matchedSignal =
    soldOutSignals.find((signal) => normalized.includes(signal)) ??
    availableSignals.find((signal) => normalized.includes(signal));

  if (hasNeedle && soldOutSignals.some((signal) => normalized.includes(signal))) {
    return {
      status: "sold_out",
      method: "fetch",
      signal: matchedSignal ?? "sold-out-signal",
      matchedText: normalized.slice(0, 220),
    };
  }

  if (hasNeedle && availableSignals.some((signal) => normalized.includes(signal))) {
    return {
      status: "available",
      method: "fetch",
      signal: matchedSignal ?? "available-signal",
      matchedText: normalized.slice(0, 220),
    };
  }

  return {
    status: "unknown",
    method: "fetch",
    signal: hasNeedle ? "matching-option-no-status-signal" : "option-text-not-found",
    matchedText: normalized.slice(0, 220),
  };
}

async function fetchTicketPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getHyroxMonitorTimeoutMs());

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`fetch-failed-${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAvailabilitySummary(eventId: string) {
  const response = await fetch(`https://vivenu.com/api/public/events/${eventId}/availabilities`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`availability-fetch-failed-${response.status}`);
  }

  return (await response.json()) as {
    checkout?: {
      allowed?: boolean;
    };
  };
}

async function tryPlaywrightText(url: string) {
  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: getHyroxMonitorTimeoutMs(),
    });

    const text = await page.locator("body").innerText();
    await browser.close();
    return text;
  } catch (error) {
    return `playwright-unavailable:${error instanceof Error ? error.message : "unknown-error"}`;
  }
}

function buildCheckoutUrl(pageUrl: string, eventId: string) {
  return new URL(`/checkout/${eventId}`, pageUrl).toString();
}

function inferCheckoutCategory(option: TicketOption) {
  if (option.divisionCode.includes("doubles")) {
    return "Doubles";
  }

  if (option.divisionCode.includes("relay")) {
    return "Relay";
  }

  if (option.divisionCode.includes("spectator")) {
    return "Spectator";
  }

  return "Singles";
}

function inferCheckoutClass(option: TicketOption) {
  if (option.categoryCode.includes("pro")) {
    return "Pro";
  }

  if (option.categoryCode.includes("open")) {
    return "Open";
  }

  return null;
}

function inferCheckoutGender(option: TicketOption) {
  if (option.divisionCode.includes("mixed")) {
    return "Mixed";
  }

  if (option.divisionCode.includes("women")) {
    return "Women";
  }

  if (option.divisionCode.includes("men")) {
    return "Men";
  }

  return null;
}

async function clickIfPresent(page: Page, role: "button" | "link", label: string) {
  const locator =
    role === "button"
      ? page.getByRole("button", { name: new RegExp(`^${label}$`, "i") })
      : page.getByRole("link", { name: new RegExp(label, "i") });

  if (!(await locator.count())) {
    return false;
  }

  await locator.first().click().catch(() => null);
  await page.waitForTimeout(2000);
  return true;
}

async function inspectPreciseCheckoutStatus(
  checkoutUrl: string,
  option: TicketOption,
  matchedTicket: VivenuTicket,
): Promise<Omit<TicketObservation, "ticketOptionId"> | null> {
  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(checkoutUrl, {
      waitUntil: "domcontentloaded",
      timeout: getHyroxMonitorTimeoutMs(),
    });
    await page.waitForTimeout(4000);

    const acceptAllButton = page.getByRole("button", { name: /accept all/i });
    if (await acceptAllButton.count()) {
      await acceptAllButton.first().click().catch(() => null);
      await page.waitForTimeout(1000);
    }

    await clickIfPresent(page, "link", inferCheckoutCategory(option));

    const classLabel = inferCheckoutClass(option);
    if (classLabel) {
      await clickIfPresent(page, "button", classLabel);
    }

    const genderLabel = inferCheckoutGender(option);
    if (genderLabel) {
      await clickIfPresent(page, "button", genderLabel);
    }

    const bodyText = await page.locator("body").innerText();
    const buttons = await page.locator("button").evaluateAll((elements) =>
      elements.map((element) => ({
        text: (element.textContent ?? "").trim(),
        ariaLabel: element.getAttribute("aria-label"),
      })),
    );

    await browser.close();

    const normalizedBody = normalizeText(bodyText);
    const normalizedTicketName = normalizeText(matchedTicket.name);
    const exactAddButton = buttons.find((button) =>
      normalizeText(button.ariaLabel ?? "").includes(
        normalizeText(`add 1 ${matchedTicket.name}`),
      ),
    );
    const exactRemoveButton = buttons.find((button) =>
      normalizeText(button.ariaLabel ?? "").includes(
        normalizeText(`remove 1 ${matchedTicket.name}`),
      ),
    );
    const hasExactTicket = normalizedBody.includes(normalizedTicketName);
    const hasSoldOut = normalizedBody.includes("sold out");

    if (exactAddButton) {
      return {
        status: "available",
        method: "playwright",
        signal: `checkout-add-available:${matchedTicket.id}`,
        matchedText: matchedTicket.name,
      };
    }

    if (hasExactTicket && hasSoldOut && !exactRemoveButton) {
      return {
        status: "sold_out",
        method: "playwright",
        signal: `checkout-ticket-sold-out:${matchedTicket.id}`,
        matchedText: matchedTicket.name,
      };
    }

    if (hasExactTicket) {
      return {
        status: "unknown",
        method: "playwright",
        signal: `checkout-ticket-found:${matchedTicket.id}`,
        matchedText: matchedTicket.name,
      };
    }

    return {
      status: "unknown",
      method: "playwright",
      signal: `checkout-ticket-not-found:${matchedTicket.id}`,
      matchedText: matchedTicket.name,
    };
  } catch (error) {
    return {
      status: "unknown",
      method: "playwright",
      signal: `checkout-playwright-error:${error instanceof Error ? error.message : "unknown-error"}`,
      matchedText: matchedTicket.name,
    };
  }
}

export async function scrapeHyroxTicketAvailability(
  ticketUrl: string,
  options: TicketOption[],
): Promise<{
  mode: "fetch" | "playwright" | "mock";
  pageUrl: string;
  observations: TicketObservation[];
}> {
  const pageUrl = getHyroxMonitorUrlOverride() ?? ticketUrl;

  try {
    const html = await fetchTicketPage(pageUrl);
    const text = stripHtml(html);
    const nextDataJson = extractNextDataJson(html);
    const eventId = extractVivenuEventId(html) ?? (nextDataJson ? extractVivenuEventIdFromNextData(nextDataJson) : null);
    const vivenuTickets = nextDataJson ? extractVivenuTicketsFromNextData(nextDataJson) : [];
    const availabilitySummary = eventId ? await fetchAvailabilitySummary(eventId).catch(() => null) : null;
    const checkoutUrl = eventId ? buildCheckoutUrl(pageUrl, eventId) : null;

    return {
      mode: checkoutUrl ? "playwright" : "fetch",
      pageUrl,
      observations: await Promise.all(
        options.map(async (option) => {
          const detected = detectStatusFromText(text, option);
          const matchedVivenuTicket = matchVivenuTicketForOption(option, vivenuTickets);
          const preciseObservation =
            checkoutUrl && matchedVivenuTicket
              ? await inspectPreciseCheckoutStatus(checkoutUrl, option, matchedVivenuTicket)
              : null;

          if (preciseObservation) {
            return {
              ticketOptionId: option.id,
              ...preciseObservation,
            };
          }

          if (
            detected.status === "unknown" &&
            availabilitySummary?.checkout?.allowed === false
          ) {
            return {
              ticketOptionId: option.id,
              ...detected,
              status: "sold_out" as const,
              signal: matchedVivenuTicket
                ? `availability-checkout-blocked:${matchedVivenuTicket.id}`
                : "availability-checkout-blocked",
              matchedText: matchedVivenuTicket?.name ?? detected.matchedText,
            };
          }

          if (
            detected.status === "unknown" &&
            availabilitySummary?.checkout?.allowed === true
          ) {
            return {
              ticketOptionId: option.id,
              ...detected,
              signal: matchedVivenuTicket
                ? `availability-checkout-allowed:${matchedVivenuTicket.id}`
                : "availability-checkout-allowed",
              matchedText: matchedVivenuTicket?.name ?? detected.matchedText,
            };
          }

          if (matchedVivenuTicket) {
            return {
              ticketOptionId: option.id,
              ...detected,
              signal:
                `ticket-definition-found:${matchedVivenuTicket.id}`,
              matchedText: matchedVivenuTicket.name,
            };
          }

          return {
            ticketOptionId: option.id,
            ...detected,
          };
        }),
      ),
    };
  } catch (fetchError) {
    const playwrightText = await tryPlaywrightText(pageUrl);

    if (!playwrightText.startsWith("playwright-unavailable:")) {
      return {
        mode: "playwright",
        pageUrl,
        observations: options.map((option) => ({
          ticketOptionId: option.id,
          ...detectStatusFromText(playwrightText, option),
          method: "playwright",
        })),
      };
    }

    return {
      mode: "mock",
      pageUrl,
      observations: options.map((option) => ({
        ticketOptionId: option.id,
        status: "unknown",
        method: "mock",
        signal:
          fetchError instanceof Error
            ? `fetch-fallback:${fetchError.message}`
            : "fetch-fallback:unknown-error",
      })),
    };
  }
}
