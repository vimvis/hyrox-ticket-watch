import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

import { hyroxIncheonEvent, hyroxIncheonTicketOptions } from "@/lib/hyrox-config";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = hashSync("password123", 10);

  const event = await prisma.event.upsert({
    where: { slug: hyroxIncheonEvent.slug },
    update: {},
    create: {
      slug: hyroxIncheonEvent.slug,
      name: hyroxIncheonEvent.name,
      eventUrl: hyroxIncheonEvent.eventUrl,
      ticketUrl: hyroxIncheonEvent.ticketUrl,
      location: hyroxIncheonEvent.location,
      startDate: new Date("2026-05-15"),
      endDate: new Date("2026-05-17"),
    },
  });

  const menSingles = hyroxIncheonTicketOptions[0];
  const proMen = hyroxIncheonTicketOptions[1];
  const mixedDoubles = hyroxIncheonTicketOptions[2];

  await prisma.ticketOption.upsert({
    where: {
      eventId_eventDate_divisionCode_categoryCode: {
        eventId: event.id,
        eventDate: new Date("2026-05-16"),
        divisionCode: menSingles.divisionCode,
        categoryCode: menSingles.categoryCode,
      },
    },
    update: {},
    create: {
      eventId: event.id,
      eventDate: new Date("2026-05-16"),
      weekdayLabel: menSingles.weekdayLabel,
      divisionCode: menSingles.divisionCode,
      divisionName: menSingles.divisionName,
      categoryCode: menSingles.categoryCode,
      categoryName: menSingles.categoryName,
      displayLabel: menSingles.displayLabel,
      sourceSelector: menSingles.sourceSelector ?? undefined,
    },
  });

  await prisma.ticketOption.upsert({
    where: {
      eventId_eventDate_divisionCode_categoryCode: {
        eventId: event.id,
        eventDate: new Date("2026-05-16"),
        divisionCode: proMen.divisionCode,
        categoryCode: proMen.categoryCode,
      },
    },
    update: {},
    create: {
      eventId: event.id,
      eventDate: new Date("2026-05-16"),
      weekdayLabel: proMen.weekdayLabel,
      divisionCode: proMen.divisionCode,
      divisionName: proMen.divisionName,
      categoryCode: proMen.categoryCode,
      categoryName: proMen.categoryName,
      displayLabel: proMen.displayLabel,
      sourceSelector: proMen.sourceSelector ?? undefined,
    },
  });

  const mixedOption = await prisma.ticketOption.upsert({
    where: {
      eventId_eventDate_divisionCode_categoryCode: {
        eventId: event.id,
        eventDate: new Date("2026-05-17"),
        divisionCode: mixedDoubles.divisionCode,
        categoryCode: mixedDoubles.categoryCode,
      },
    },
    update: {},
    create: {
      eventId: event.id,
      eventDate: new Date("2026-05-17"),
      weekdayLabel: mixedDoubles.weekdayLabel,
      divisionCode: mixedDoubles.divisionCode,
      divisionName: mixedDoubles.divisionName,
      categoryCode: mixedDoubles.categoryCode,
      categoryName: mixedDoubles.categoryName,
      displayLabel: mixedDoubles.displayLabel,
      sourceSelector: mixedDoubles.sourceSelector ?? undefined,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "member@ticketwatch.kr" },
    update: {
      passwordHash,
      name: "Demo Member",
    },
    create: {
      email: "member@ticketwatch.kr",
      passwordHash,
      name: "Demo Member",
    },
  });

  await prisma.ticketWatcher.upsert({
    where: {
      userId_ticketOptionId: {
        userId: user.id,
        ticketOptionId: mixedOption.id,
      },
    },
    update: {
      lastKnownStatus: "available",
      lastCheckedAt: new Date("2026-03-19T09:00:00+09:00"),
      lastNotifiedAt: new Date("2026-03-19T09:01:00+09:00"),
    },
    create: {
      userId: user.id,
      ticketOptionId: mixedOption.id,
      lastKnownStatus: "available",
      lastCheckedAt: new Date("2026-03-19T09:00:00+09:00"),
      lastNotifiedAt: new Date("2026-03-19T09:01:00+09:00"),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
