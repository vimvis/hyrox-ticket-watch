import {
  createNotification,
  findUserById,
  getEvents,
  getWatchers,
  updateWatcherStatus,
} from "@/lib/data-store";
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
  const executedAt = new Date().toISOString();

  const evaluatedWatchers = watchers.map((watcher) => {
    const observation = observationMap.get(watcher.ticketOptionId);
    const effectiveStatus =
      observation && observation.status !== "unknown" ? observation.status : watcher.lastKnownStatus;
    const shouldNotify = effectiveStatus === "available" && watcher.lastKnownStatus !== "available";

    return {
      watcher,
      observation,
      effectiveStatus,
      shouldNotify,
    };
  });

  const availableWatchers = evaluatedWatchers.filter((item) => item.effectiveStatus === "available");
  const soldOutWatchers = evaluatedWatchers.filter((item) => item.effectiveStatus === "sold_out");

  await Promise.all(
    evaluatedWatchers.map(({ watcher, effectiveStatus }) =>
      updateWatcherStatus({
        watcherId: watcher.id,
        status: effectiveStatus,
        checkedAt: executedAt,
      }),
    ),
  );

  const notifications = await Promise.all(
    evaluatedWatchers
      .filter((item) => item.shouldNotify)
      .map(async ({ watcher }) => {
        const user = await findUserById(watcher.userId);

        if (!user) {
          await createNotification({
            userId: watcher.userId,
            ticketWatcherId: watcher.id,
            recipient: "unknown-user",
            subject: `[HYROX 알림] ${watcher.ticketOption.displayLabel} 구매 가능`,
            payload: {
              eventName: watcher.ticketOption.eventName,
              ticketLabel: watcher.ticketOption.displayLabel,
              detectedAt: executedAt,
              purchaseUrl: watcher.ticketOption.sourceSelector?.url ?? primaryEvent?.ticketUrl ?? "",
            },
            status: "failed",
            errorMessage: "user-not-found",
          });

          return {
            mode: "mock" as const,
            queued: false,
            provider: "mock-email",
            errorMessage: "user-not-found",
          };
        }

        const emailResult = await queueTicketAvailableEmail({
          to: user.email,
          subject: `[HYROX 알림] ${watcher.ticketOption.displayLabel} 구매 가능`,
          eventName: watcher.ticketOption.eventName,
          ticketLabel: watcher.ticketOption.displayLabel,
          detectedAt: executedAt,
          purchaseUrl: watcher.ticketOption.sourceSelector?.url ?? primaryEvent?.ticketUrl ?? "",
        });

        await createNotification({
          userId: watcher.userId,
          ticketWatcherId: watcher.id,
          recipient: user.email,
          subject: `[HYROX 알림] ${watcher.ticketOption.displayLabel} 구매 가능`,
          payload: {
            eventName: watcher.ticketOption.eventName,
            ticketLabel: watcher.ticketOption.displayLabel,
            detectedAt: executedAt,
            purchaseUrl: watcher.ticketOption.sourceSelector?.url ?? primaryEvent?.ticketUrl ?? "",
            provider: emailResult.provider,
          },
          status: emailResult.queued ? "queued" : "failed",
          sentAt: emailResult.queued ? executedAt : null,
          errorMessage: "errorMessage" in emailResult ? (emailResult.errorMessage ?? null) : null,
        });

        if (emailResult.queued) {
          await updateWatcherStatus({
            watcherId: watcher.id,
            status: "available",
            checkedAt: executedAt,
            notifiedAt: executedAt,
          });
        }

        return emailResult;
      }),
  );

  return {
    mode: watcherResult.mode,
    runId: crypto.randomUUID(),
    status: "success" as const,
    checkedOptionsCount: watchers.length,
    availableCount: availableWatchers.length,
    soldOutCount: soldOutWatchers.length,
    notificationsQueued: notifications.filter((item) => item.queued).length,
    notificationMode: notifications[0]?.mode ?? "mock",
    scrapeMode: scrapeResult.mode,
    scrapeUrl: scrapeResult.pageUrl,
    observations: scrapeResult.observations,
    executedAt,
  };
}
