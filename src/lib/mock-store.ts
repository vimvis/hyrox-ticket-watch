import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import type { AppUser, EventSummary, Watcher, WatcherWithOption } from "@/lib/types";
import { hyroxIncheonEvent, hyroxIncheonTicketOptions } from "@/lib/hyrox-config";

const ticketOptions = hyroxIncheonTicketOptions;
const events: EventSummary[] = [hyroxIncheonEvent];

const users: AppUser[] = [
  {
    id: "user-demo",
    email: "member@ticketwatch.kr",
    name: "Demo Member",
    createdAt: new Date("2026-03-19T00:00:00.000Z").toISOString(),
  },
];

const userPasswordHashes = new Map<string, string>([
  ["member@ticketwatch.kr", hashSync("password123", 10)],
]);

const watchers: Watcher[] = [
  {
    id: "watcher-1",
    userId: "user-demo",
    ticketOptionId: "ticket-men-open-sat",
    lastKnownStatus: "sold_out",
    lastCheckedAt: "2026-03-19T00:00:00.000Z",
    lastNotifiedAt: null,
  },
  {
    id: "watcher-2",
    userId: "user-demo",
    ticketOptionId: "ticket-mixed-open-sun",
    lastKnownStatus: "available",
    lastCheckedAt: "2026-03-19T00:00:00.000Z",
    lastNotifiedAt: "2026-03-19T00:01:00.000Z",
  },
];

const notifications: Array<{
  id: string;
  userId: string;
  ticketWatcherId: string;
  recipient: string;
  subject: string;
  payload: unknown | null;
  status: "queued" | "sent" | "failed";
  sentAt: string | null;
  createdAt: string;
}> = [];

export function getEvents() {
  return events;
}

export function getWatchers(userId?: string): WatcherWithOption[] {
  return watchers
    .filter((watcher) => (userId ? watcher.userId === userId : true))
    .map((watcher) => ({
      ...watcher,
      ticketOption: ticketOptions.find((option) => option.id === watcher.ticketOptionId)!,
    }));
}

export function addWatcher(input: { userId: string; ticketOptionId: string }) {
  const exists = watchers.find(
    (watcher) =>
      watcher.userId === input.userId && watcher.ticketOptionId === input.ticketOptionId,
  );

  if (exists) {
    return exists;
  }

  const watcher: Watcher = {
    id: randomUUID(),
    userId: input.userId,
    ticketOptionId: input.ticketOptionId,
    lastKnownStatus: "unknown",
    lastCheckedAt: null,
    lastNotifiedAt: null,
  };

  watchers.unshift(watcher);

  return watcher;
}

export function createUser(input: { email: string; name?: string; passwordHash: string }) {
  const user: AppUser = {
    id: randomUUID(),
    email: input.email,
    name: input.name ?? null,
    createdAt: new Date().toISOString(),
  };

  users.unshift(user);
  userPasswordHashes.set(input.email.toLowerCase(), input.passwordHash);

  return user;
}

export function findUserByEmail(email: string) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findUserById(userId: string) {
  return users.find((user) => user.id === userId) ?? null;
}

export function getStoredPasswordHash(email: string) {
  return userPasswordHashes.get(email.toLowerCase()) ?? null;
}

export function updateWatcherStatus(input: {
  watcherId: string;
  status: Watcher["lastKnownStatus"];
  checkedAt: string;
  notifiedAt?: string | null;
}) {
  const watcher = watchers.find((item) => item.id === input.watcherId);

  if (!watcher) {
    return null;
  }

  watcher.lastKnownStatus = input.status;
  watcher.lastCheckedAt = input.checkedAt;

  if (typeof input.notifiedAt !== "undefined") {
    watcher.lastNotifiedAt = input.notifiedAt;
  }

  return watcher;
}

export function createNotification(input: {
  userId: string;
  ticketWatcherId: string;
  recipient: string;
  subject: string;
  payload: unknown | null;
  status: "queued" | "sent" | "failed";
  sentAt?: string | null;
}) {
  const record = {
    id: randomUUID(),
    userId: input.userId,
    ticketWatcherId: input.ticketWatcherId,
    recipient: input.recipient,
    subject: input.subject,
    payload: input.payload,
    status: input.status,
    sentAt: input.sentAt ?? null,
    createdAt: new Date().toISOString(),
  };

  notifications.unshift(record);

  return record;
}
