import type { Prisma } from "@prisma/client";

import type { EventSummary, TicketOption, TicketStatus, WatcherWithOption } from "@/lib/types";
import { hasDatabaseUrl } from "@/lib/env";
import {
  addWatcher as addMockWatcher,
  createUser as createMockUser,
  findUserByEmail as findMockUserByEmail,
  findUserById as findMockUserById,
  getEvents as getMockEvents,
  getStoredPasswordHash as getMockStoredPasswordHash,
  getWatchers as getMockWatchers,
} from "@/lib/mock-store";
import { getPrismaClient } from "@/lib/prisma";

type CreateUserInput = {
  email: string;
  name?: string;
  passwordHash: string;
};

type CreateWatcherInput = {
  userId: string;
  ticketOptionId: string;
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

type EventRecord = Prisma.EventGetPayload<{
  include: {
    ticketOptions: true;
  };
}>;

type WatcherRecord = Prisma.TicketWatcherGetPayload<{
  include: {
    ticketOption: {
      include: {
        event: true;
      };
    };
  };
}>;

function mapEventRecord(event: EventRecord): EventSummary {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    location: event.location ?? "",
    eventUrl: event.eventUrl,
    ticketUrl: event.ticketUrl,
    ticketOptions: event.ticketOptions.map((option) => ({
      id: option.id,
      eventId: event.id,
      eventName: event.name,
      eventDate: toIsoDate(option.eventDate),
      weekdayLabel: option.weekdayLabel,
      divisionCode: option.divisionCode,
      divisionName: option.divisionName,
      categoryCode: option.categoryCode,
      categoryName: option.categoryName,
      displayLabel: option.displayLabel,
      sourceSelector:
        option.sourceSelector && typeof option.sourceSelector === "object"
          ? (option.sourceSelector as TicketOption["sourceSelector"])
          : null,
    })),
  };
}

function mapWatcherRecord(watcher: WatcherRecord): WatcherWithOption {
  return {
    id: watcher.id,
    userId: watcher.userId,
    ticketOptionId: watcher.ticketOptionId,
    lastKnownStatus: watcher.lastKnownStatus as TicketStatus,
    lastCheckedAt: watcher.lastCheckedAt?.toISOString() ?? null,
    lastNotifiedAt: watcher.lastNotifiedAt?.toISOString() ?? null,
    ticketOption: {
      id: watcher.ticketOption.id,
      eventId: watcher.ticketOption.eventId,
      eventName: watcher.ticketOption.event.name,
      eventDate: toIsoDate(watcher.ticketOption.eventDate),
      weekdayLabel: watcher.ticketOption.weekdayLabel,
      divisionCode: watcher.ticketOption.divisionCode,
      divisionName: watcher.ticketOption.divisionName,
      categoryCode: watcher.ticketOption.categoryCode,
      categoryName: watcher.ticketOption.categoryName,
      displayLabel: watcher.ticketOption.displayLabel,
      sourceSelector:
        watcher.ticketOption.sourceSelector && typeof watcher.ticketOption.sourceSelector === "object"
          ? (watcher.ticketOption.sourceSelector as TicketOption["sourceSelector"])
          : null,
    },
  };
}

export async function getEvents() {
  if (!hasDatabaseUrl()) {
    return {
      mode: "mock" as const,
      items: getMockEvents(),
    };
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      mode: "mock" as const,
      items: getMockEvents(),
    };
  }

  const records = await prisma.event.findMany({
    where: { isActive: true },
    include: {
      ticketOptions: {
        where: { isActive: true },
        orderBy: [{ eventDate: "asc" }, { divisionName: "asc" }, { categoryName: "asc" }],
      },
    },
    orderBy: { startDate: "asc" },
  });

  return {
    mode: "database" as const,
    items: records.map(mapEventRecord),
  };
}

export async function getWatchers(userId: string) {
  if (!hasDatabaseUrl()) {
    return {
      mode: "mock" as const,
      items: getMockWatchers(userId),
    };
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      mode: "mock" as const,
      items: getMockWatchers(userId),
    };
  }

  const records = await prisma.ticketWatcher.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      ticketOption: {
        include: {
          event: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    mode: "database" as const,
    items: records.map(mapWatcherRecord),
  };
}

export async function addWatcher(input: CreateWatcherInput) {
  if (!hasDatabaseUrl()) {
    return {
      mode: "mock" as const,
      item: addMockWatcher(input),
    };
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      mode: "mock" as const,
      item: addMockWatcher(input),
    };
  }

  const watcher = await prisma.ticketWatcher.upsert({
    where: {
      userId_ticketOptionId: {
        userId: input.userId,
        ticketOptionId: input.ticketOptionId,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      userId: input.userId,
      ticketOptionId: input.ticketOptionId,
    },
  });

  return {
    mode: "database" as const,
    item: {
      id: watcher.id,
      userId: watcher.userId,
      ticketOptionId: watcher.ticketOptionId,
      lastKnownStatus: watcher.lastKnownStatus as TicketStatus,
      lastCheckedAt: watcher.lastCheckedAt?.toISOString() ?? null,
      lastNotifiedAt: watcher.lastNotifiedAt?.toISOString() ?? null,
    },
  };
}

export async function createUser(input: CreateUserInput) {
  if (!hasDatabaseUrl()) {
    return {
      mode: "mock" as const,
      user: createMockUser(input),
    };
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      mode: "mock" as const,
      user: createMockUser(input),
    };
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
    },
  });

  return {
    mode: "database" as const,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

export async function findUserByEmail(email: string) {
  if (!hasDatabaseUrl()) {
    return findMockUserByEmail(email);
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return findMockUserByEmail(email);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function findUserById(userId: string) {
  if (!hasDatabaseUrl()) {
    return findMockUserById(userId);
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return findMockUserById(userId);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getStoredPasswordHash(email: string) {
  if (!hasDatabaseUrl()) {
    return getMockStoredPasswordHash(email);
  }

  const prisma = getPrismaClient();

  if (!prisma) {
    return getMockStoredPasswordHash(email);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });

  return user?.passwordHash ?? null;
}
