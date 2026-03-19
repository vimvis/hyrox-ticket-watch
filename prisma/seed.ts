import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = hashSync("password123", 10);

  const event = await prisma.event.upsert({
    where: { slug: "hyrox-incheon" },
    update: {},
    create: {
      slug: "hyrox-incheon",
      name: "HYROX Incheon",
      eventUrl: "https://hyrox.com/event/hyrox-incheon/",
      ticketUrl: "https://korea.hyrox.com/event/airasia-hyrox-incheon-season-25-26-h48hij?useEmbed=true",
      location: "Incheon, KR",
      startDate: new Date("2026-05-15"),
      endDate: new Date("2026-05-17"),
    },
  });

  await prisma.ticketOption.upsert({
    where: {
      eventId_eventDate_divisionCode_categoryCode: {
        eventId: event.id,
        eventDate: new Date("2026-05-16"),
        divisionCode: "men-singles",
        categoryCode: "open",
      },
    },
    update: {},
    create: {
      eventId: event.id,
      eventDate: new Date("2026-05-16"),
      weekdayLabel: "토",
      divisionCode: "men-singles",
      divisionName: "Men Singles",
      categoryCode: "open",
      categoryName: "Open",
      displayLabel: "2026-05-16 (토) / Men Singles / Open",
    },
  });

  await prisma.ticketOption.upsert({
    where: {
      eventId_eventDate_divisionCode_categoryCode: {
        eventId: event.id,
        eventDate: new Date("2026-05-16"),
        divisionCode: "pro-men",
        categoryCode: "pro",
      },
    },
    update: {},
    create: {
      eventId: event.id,
      eventDate: new Date("2026-05-16"),
      weekdayLabel: "토",
      divisionCode: "pro-men",
      divisionName: "Pro Men",
      categoryCode: "pro",
      categoryName: "Pro",
      displayLabel: "2026-05-16 (토) / Pro Men / Pro",
    },
  });

  const mixedOption = await prisma.ticketOption.upsert({
    where: {
      eventId_eventDate_divisionCode_categoryCode: {
        eventId: event.id,
        eventDate: new Date("2026-05-17"),
        divisionCode: "mixed-doubles",
        categoryCode: "open",
      },
    },
    update: {},
    create: {
      eventId: event.id,
      eventDate: new Date("2026-05-17"),
      weekdayLabel: "일",
      divisionCode: "mixed-doubles",
      divisionName: "Mixed Doubles",
      categoryCode: "open",
      categoryName: "Open",
      displayLabel: "2026-05-17 (일) / Mixed Doubles / Open",
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
