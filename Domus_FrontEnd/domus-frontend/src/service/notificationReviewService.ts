import { supabase } from "../lib/supabase";

export interface NotificationReviewItem {
  id: number;
  description: string;
  value: number;
  category: string;
  purchaseAt: string | null;
  createdAt: string | null;
  simulated: boolean;
  sources: string[];
  eventCount: number;
}

type OutgoingRow = {
  id: number;
  description: string;
  value: number | string;
  category: string | null;
  purchase_at: string | null;
  created_at: string | null;
};

type EventRow = {
  outgoing_id: number | null;
  source: string;
  simulated: boolean;
};

export const notificationReviewService = {
  async getPending(): Promise<NotificationReviewItem[]> {
    const { data: outgoing, error: outgoingError } = await supabase
      .from("outgoing")
      .select("id,description,value,category,purchase_at,created_at")
      .eq("origin", "notification")
      .eq("reviewed", false)
      .order("purchase_at", { ascending: false, nullsFirst: false });

    if (outgoingError) throw outgoingError;
    const rows = (outgoing ?? []) as OutgoingRow[];
    if (rows.length === 0) return [];

    const { data: events, error: eventsError } = await supabase
      .from("notification_events")
      .select("outgoing_id,source,simulated")
      .in("outgoing_id", rows.map((row) => row.id));
    if (eventsError) throw eventsError;

    const byOutgoing = new Map<number, EventRow[]>();
    for (const event of (events ?? []) as EventRow[]) {
      if (event.outgoing_id == null) continue;
      byOutgoing.set(event.outgoing_id, [...(byOutgoing.get(event.outgoing_id) ?? []), event]);
    }

    return rows.map((row) => {
      const related = byOutgoing.get(row.id) ?? [];
      return {
        id: row.id,
        description: row.description,
        value: Number(row.value),
        category: row.category ?? "Other",
        purchaseAt: row.purchase_at,
        createdAt: row.created_at,
        simulated: related.some((event) => event.simulated),
        sources: [...new Set(related.map((event) => event.source))],
        eventCount: related.length,
      };
    });
  },

  async markReviewed(id: number): Promise<void> {
    const { error } = await supabase.from("outgoing").update({ reviewed: true }).eq("id", id);
    if (error) throw error;
  },
};
