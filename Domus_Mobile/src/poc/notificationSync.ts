import { supabase } from "@/lib/supabase";
import type { PocSource, PocTransaction } from "./notificationTypes";

type IngestResult = {
  event_id: number;
  outgoing_id: number | null;
  deduplicated: boolean;
};

export function notificationSyncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const message = typeof value.message === "string" ? value.message : "Falha ao sincronizar";
    const detail = typeof value.details === "string" && value.details ? ` (${value.details})` : "";
    const code = typeof value.code === "string" && value.code ? ` [${value.code}]` : "";
    return `${message}${detail}${code}`;
  }
  return "Falha ao sincronizar";
}

function remoteSource(source: PocSource): "google_wallet" | "nubank" | "whatsapp" | "manual_test" {
  if (source === "simulator") return "manual_test";
  return source;
}

export async function syncNotificationRecord(record: PocTransaction): Promise<IngestResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Faça login antes de sincronizar notificações.");

  // A RPC recebe somente dados financeiros normalizados. Texto/título bruto
  // continuam apenas no armazenamento local do Android.
  const { data, error } = await supabase.rpc("ingest_notification_event", {
    p_event_key: record.id,
    p_source: remoteSource(record.source),
    p_source_package: record.sourcePackage,
    p_amount: record.amountCents / 100,
    p_merchant: record.merchant,
    p_credit_card_id: null,
    p_occurred_at: record.occurredAt,
    p_simulated: record.origin === "simulated" || record.source === "whatsapp",
  });

  if (error) throw error;
  const result = (data as IngestResult[] | null)?.[0];
  if (!result) throw new Error("A sincronização não retornou resultado.");
  return result;
}
