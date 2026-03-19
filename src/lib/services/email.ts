import { hasResendApiKey } from "@/lib/env";

type TicketAvailableEmailInput = {
  to: string;
  subject: string;
  eventName: string;
  ticketLabel: string;
  detectedAt: string;
  purchaseUrl: string;
};

export async function queueTicketAvailableEmail(input: TicketAvailableEmailInput) {
  if (!hasResendApiKey()) {
    return {
      mode: "mock" as const,
      queued: true,
      provider: "mock-email",
      preview: {
        ...input,
        note: "RESEND_API_KEY 미설정으로 실제 발송 대신 큐 계산만 수행했습니다.",
      },
    };
  }

  return {
    mode: "provider" as const,
    queued: true,
    provider: "resend",
    preview: input,
  };
}
