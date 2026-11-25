import type { NativeNotificationEvent, PocSource, PocTransaction } from "./notificationTypes";

const BRL = /(?:R\$|BRL)\s*([\d.]+(?:,[\d]{1,2})?|[\d]+(?:\.[\d]{1,2})?)/i;
const CARD = /(?:final|••|\*\*|\.\.\.)\s*([0-9]{4})/i;
const DOMUS_TEST = /\[DOMUS[- ]TESTE\]/i;

function amountToCents(value: string): number | null {
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function normalizeMerchant(value: string): string {
  return value
    .replace(/\[DOMUS[- ]TESTE\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "");
}

function sourceForEvent(event: NativeNotificationEvent): PocSource {
  if (event.simulated) {
    const value = `${event.title} ${event.text}`.toLowerCase();
    if (event.title.toLowerCase().includes("compra no crédito aprovada")) return "nubank";
    if (value.includes("wallet") || value.includes("carteira") || value.includes("com nubank")) return "google_wallet";
    return "simulator";
  }
  if (event.packageName === "com.google.android.apps.walletnfcrel") return "google_wallet";
  if (event.packageName === "com.nu.production") return "nubank";
  if (event.packageName === "com.whatsapp") return "whatsapp";
  return "simulator";
}

function merchantForEvent(source: PocSource, title: string, text: string): string {
  if (source === "google_wallet") {
    return normalizeMerchant(title || text.split(/\s+R\$/i)[0]);
  }
  const match = text.match(/\b(?:em|no estabelecimento)\s+(.+?)(?=\s+(?:para|no cartão|no cartao|cartão|cartao)\b|$)/i);
  return normalizeMerchant(match?.[1] ?? title ?? text);
}

function occurredAtFromEvent(event: NativeNotificationEvent): string {
  const time = `${event.title} ${event.text}`.match(/\b(?:às|as)\s+(\d{2}):(\d{2})\b/i);
  if (!time) return new Date(event.postedAt).toISOString();
  const date = new Date(event.postedAt);
  date.setHours(Number(time[1]), Number(time[2]), 0, 0);
  return date.toISOString();
}

export function parseNotification(event: NativeNotificationEvent): Omit<PocTransaction, "id" | "status" | "duplicateCount"> | null {
  const source = sourceForEvent(event);
  const combined = `${event.title} ${event.text}`;
  if (source === "whatsapp" && !DOMUS_TEST.test(combined)) return null;
  if (!/(r\$|brl)/i.test(combined)) return null;

  const amountMatch = combined.match(BRL);
  const amountCents = amountMatch ? amountToCents(amountMatch[1]) : null;
  if (!amountCents) return null;

  const merchant = merchantForEvent(source, event.title, event.text);
  if (!merchant) return null;

  return {
    origin: event.simulated ? "simulated" : "real",
    source,
    sourcePackage: event.packageName,
    amountCents,
    merchant,
    cardLastFour: combined.match(CARD)?.[1],
    occurredAt: occurredAtFromEvent(event),
    receivedAt: new Date().toISOString(),
    rawTitle: event.title,
    rawText: event.text,
  };
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isSamePurchase(a: PocTransaction, b: Omit<PocTransaction, "id" | "status" | "duplicateCount">): boolean {
  if (a.amountCents !== b.amountCents) return false;
  if (normalized(a.merchant) !== normalized(b.merchant)) return false;
  if (a.cardLastFour && b.cardLastFour && a.cardLastFour !== b.cardLastFour) return false;
  return Math.abs(new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()) <= 5 * 60 * 1000;
}
