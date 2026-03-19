import { getWatchers } from "@/lib/data-store";
import { queueTicketAvailableEmail } from "@/lib/services/email";

export async function runMonitorJob(userId = "user-demo") {
  const watcherResult = await getWatchers(userId);
  const watchers = watcherResult.items;

  const availableWatchers = watchers.filter((watcher) => watcher.lastKnownStatus === "available");
  const soldOutWatchers = watchers.filter((watcher) => watcher.lastKnownStatus === "sold_out");

  const notifications = await Promise.all(
    availableWatchers.map((watcher) =>
      queueTicketAvailableEmail({
        to: "member@ticketwatch.kr",
        subject: `[HYROX 알림] ${watcher.ticketOption.displayLabel} 구매 가능`,
        eventName: watcher.ticketOption.eventName,
        ticketLabel: watcher.ticketOption.displayLabel,
        detectedAt: new Date().toISOString(),
        purchaseUrl: "https://korea.hyrox.com/event/airasia-hyrox-incheon-season-25-26-h48hij?useEmbed=true",
      }),
    ),
  );

  return {
    mode: watcherResult.mode,
    runId: crypto.randomUUID(),
    status: "success" as const,
    checkedOptionsCount: watchers.length,
    availableCount: availableWatchers.length,
    soldOutCount: soldOutWatchers.length,
    notificationsQueued: notifications.length,
    notificationMode: notifications[0]?.mode ?? "mock",
    executedAt: new Date().toISOString(),
  };
}
