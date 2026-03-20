import type { EventSummary, TicketOption } from "@/lib/types";

const HYROX_TICKET_URL =
  "https://korea.hyrox.com/event/airasia-hyrox-incheon-season-25-26-h48hij?useEmbed=true";

export const hyroxIncheonTicketOptions: TicketOption[] = [
  {
    id: "ticket-men-open-sat",
    eventId: "event-hyrox-incheon",
    eventName: "HYROX Incheon",
    eventDate: "2026-05-16",
    weekdayLabel: "토",
    divisionCode: "men-singles",
    divisionName: "Men Singles",
    categoryCode: "open",
    categoryName: "Open",
    displayLabel: "2026-05-16 (토) / Men Singles / Open",
    sourceSelector: {
      url: HYROX_TICKET_URL,
      textMustInclude: ["airasia | hyrox incheon | season 25/26", "songdo convensia", "05/15/2026"],
      soldOutText: ["sold out", "soldout", "unavailable"],
      availableText: ["buy now", "book now", "register now", "add to cart"],
      vivenuNameIncludes: ["hyrox men", "남자 오픈", "saturday"],
      vivenuNameExcludes: ["pro", "doubles"],
    },
  },
  {
    id: "ticket-men-pro-sat",
    eventId: "event-hyrox-incheon",
    eventName: "HYROX Incheon",
    eventDate: "2026-05-16",
    weekdayLabel: "토",
    divisionCode: "pro-men",
    divisionName: "Pro Men",
    categoryCode: "pro",
    categoryName: "Pro",
    displayLabel: "2026-05-16 (토) / Pro Men / Pro",
    sourceSelector: {
      url: HYROX_TICKET_URL,
      textMustInclude: ["airasia | hyrox incheon | season 25/26", "songdo convensia", "05/15/2026"],
      soldOutText: ["sold out", "soldout", "unavailable"],
      availableText: ["buy now", "book now", "register now", "add to cart"],
      vivenuNameIncludes: ["hyrox pro men", "남자 프로", "saturday"],
      vivenuNameExcludes: ["doubles"],
    },
  },
  {
    id: "ticket-mixed-open-sun",
    eventId: "event-hyrox-incheon",
    eventName: "HYROX Incheon",
    eventDate: "2026-05-17",
    weekdayLabel: "일",
    divisionCode: "mixed-doubles",
    divisionName: "Mixed Doubles",
    categoryCode: "open",
    categoryName: "Open",
    displayLabel: "2026-05-17 (일) / Mixed Doubles / Open",
    sourceSelector: {
      url: HYROX_TICKET_URL,
      textMustInclude: ["airasia | hyrox incheon | season 25/26", "songdo convensia", "05/17/2026"],
      soldOutText: ["sold out", "soldout", "unavailable"],
      availableText: ["buy now", "book now", "register now", "add to cart"],
      vivenuNameIncludes: ["mixed", "open", "sunday"],
      vivenuNameExcludes: ["men", "women", "pro"],
    },
  },
];

export const hyroxIncheonEvent: EventSummary = {
  id: "event-hyrox-incheon",
  slug: "hyrox-incheon",
  name: "HYROX Incheon",
  location: "Incheon, KR",
  eventUrl: "https://hyrox.com/event/hyrox-incheon/",
  ticketUrl: HYROX_TICKET_URL,
  ticketOptions: hyroxIncheonTicketOptions,
};
