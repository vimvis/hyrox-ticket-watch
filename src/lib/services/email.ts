import { getResendApiKey, getResendFromEmail, hasResendApiKey } from "@/lib/env";

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getResendFromEmail(),
      to: [input.to],
      subject: input.subject,
      text: [
        `${input.eventName} 티켓 상태가 구매 가능으로 감지되었습니다.`,
        "",
        `조건: ${input.ticketLabel}`,
        `감지 시각: ${input.detectedAt}`,
        `구매 링크: ${input.purchaseUrl}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      mode: "provider" as const,
      queued: false,
      provider: "resend",
      errorMessage: errorText,
      preview: input,
    };
  }

  const payload = (await response.json()) as { id?: string };

  return {
    mode: "provider" as const,
    queued: true,
    provider: "resend",
    messageId: payload.id ?? null,
    preview: input,
  };
}
