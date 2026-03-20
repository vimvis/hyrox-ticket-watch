type VivenuTicket = {
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
