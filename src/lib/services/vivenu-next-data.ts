import type { TicketOption } from "@/lib/types";

export type VivenuTicket = {
  id: string;
  name: string;
  active?: boolean;
  conditionalAvailability?: boolean;
  conditionalAvailabilityMode?: string | null;
  price?: number;
  displayPrice?: number;
  relevancyDate?: {
    start?: string;
    end?: string;
  };
};

function walkForEventId(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = walkForEventId(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record._id === "string" &&
    typeof record.sellerId === "string" &&
    Array.isArray(record.tickets)
  ) {
    return record._id;
  }

  for (const entry of Object.values(record)) {
    const nested = walkForEventId(entry);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeSearchText(input: string) {
  return input
    .toLowerCase()
    .replace(/[|/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDefaultDayWord(option: TicketOption) {
  if (option.weekdayLabel === "토") {
    return "saturday";
  }

  if (option.weekdayLabel === "일") {
    return "sunday";
  }

  return "friday";
}

function getFallbackIncludes(option: TicketOption) {
  return [option.divisionName, option.categoryName, getDefaultDayWord(option)];
}

function walkForTickets(value: unknown, found: VivenuTicket[]) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => walkForTickets(item, found));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.name === "string" &&
    typeof record._id === "string" &&
    (typeof record.price === "number" || typeof record.displayPrice === "number")
  ) {
    found.push({
      id: record._id,
      name: record.name,
      active: typeof record.active === "boolean" ? record.active : undefined,
      conditionalAvailability:
        typeof record.conditionalAvailability === "boolean"
          ? record.conditionalAvailability
          : undefined,
      conditionalAvailabilityMode:
        typeof record.conditionalAvailabilityMode === "string"
          ? record.conditionalAvailabilityMode
          : null,
      price: typeof record.price === "number" ? record.price : undefined,
      displayPrice: typeof record.displayPrice === "number" ? record.displayPrice : undefined,
      relevancyDate:
        record.relevancyDate && typeof record.relevancyDate === "object"
          ? {
              start:
                typeof (record.relevancyDate as Record<string, unknown>).start === "string"
                  ? ((record.relevancyDate as Record<string, unknown>).start as string)
                  : undefined,
              end:
                typeof (record.relevancyDate as Record<string, unknown>).end === "string"
                  ? ((record.relevancyDate as Record<string, unknown>).end as string)
                  : undefined,
            }
          : undefined,
    });
  }

  Object.values(record).forEach((entry) => walkForTickets(entry, found));
}

export function extractVivenuTicketsFromNextData(nextDataJson: string) {
  try {
    const parsed = JSON.parse(nextDataJson) as unknown;
    const found: VivenuTicket[] = [];
    walkForTickets(parsed, found);

    const deduped = new Map<string, VivenuTicket>();
    found.forEach((ticket) => {
      if (!deduped.has(ticket.id)) {
        deduped.set(ticket.id, ticket);
      }
    });

    return Array.from(deduped.values());
  } catch {
    return [];
  }
}

export function extractVivenuEventIdFromNextData(nextDataJson: string) {
  try {
    const parsed = JSON.parse(nextDataJson) as unknown;
    return walkForEventId(parsed);
  } catch {
    return null;
  }
}

export function matchVivenuTicketForOption(option: TicketOption, tickets: VivenuTicket[]) {
  const includes = (
    option.sourceSelector?.vivenuNameIncludes?.length
      ? option.sourceSelector.vivenuNameIncludes
      : getFallbackIncludes(option)
  )
    .map(normalizeSearchText)
    .filter(Boolean);
  const excludes = (option.sourceSelector?.vivenuNameExcludes ?? [])
    .map(normalizeSearchText)
    .filter(Boolean);

  const scored = tickets
    .map((ticket) => {
      const normalizedName = normalizeSearchText(ticket.name);
      const includeMatches = includes.filter((needle) => normalizedName.includes(needle));
      const excludeMatches = excludes.filter((needle) => normalizedName.includes(needle));

      let score = includeMatches.length * 10;
      if (normalizedName.includes(getDefaultDayWord(option))) {
        score += 2;
      }
      if (ticket.active) {
        score += 1;
      }
      if (ticket.conditionalAvailability === false) {
        score += 1;
      }
      score -= excludeMatches.length * 20;

      return {
        ticket,
        score,
        includeMatches,
        excludeMatches,
      };
    })
    .filter((entry) => entry.includeMatches.length > 0 && entry.excludeMatches.length === 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.ticket ?? null;
}
