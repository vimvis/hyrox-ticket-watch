import { getEvents, getWatchers } from "@/lib/data-store";
import { scrapeHyroxTicketAvailability } from "@/lib/services/hyrox-scraper";
import { queueTicketAvailableEmail } from "@/lib/services/email";

export async function runMonitorJob(userId = "user-demo") {
  const watcherResult = await getWatchers(userId);
  const eventResult = await getEvents();
  const watchers = watcherResult.items;
  const options = watchers.map((watcher) => watcher.ticketOption);
  const primaryEvent = eventResult.items[0];

  const scrapeResult = primaryEvent
    ? await scrapeHyroxTicketAvailability(primaryEvent.ticketUrl, options)
    : {
        mode: "mock" as const,
        pageUrl: "",
        observations: [],
      };

  const observationMap = new Map(
    scrapeResult.observations.map((observation) => [observation.ticketOptionId, observation]),
  );

  const evaluatedWatchers = watchers.map((watcher) => {
    const observation = observationMap.get(watcher.ticketOptionId);
    const effectiveStatus =
      observation && observation.status !== "unknown" ? observation.status : watcher.lastKnownStatus;

    return {
      watcher,
      observation,
      effectiveStatus,
    };
  });

  const availableWatchers = evaluatedWatchers.filter((item) => item.effectiveStatus === "available");
  const soldOutWatchers = evaluatedWatchers.filter((item) => item.effectiveStatus === "sold_out");

  const notifications = await Promise.all(
    availableWatchers.map(({ watcher }) =>
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
    scrapeMode: scrapeResult.mode,
    scrapeUrl: scrapeResult.pageUrl,
    observations: scrapeResult.observations,
    executedAt: new Date().toISOString(),
  };
}
