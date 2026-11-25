import { currentDomusUserId, requireData } from "@/lib/financial";
import { supabase } from "@/lib/supabase";

export interface CreditCard {
  id: number;
  brand: string;
  lastFourDigits: string;
  nickname?: string;
  active: boolean;
  statementClosingDay?: number;
  dueDay?: number;
}

export interface CardAlias {
  id: number;
  creditCardId: number;
  alias: string;
  aliasKind: "physical" | "virtual" | "token" | "manual";
}

export interface CreditCardCreateInput {
  brand: string;
  lastFourDigits: string;
  nickname?: string;
  statementClosingDay?: number;
  dueDay?: number;
}

type CardRow = {
  id: number;
  brand: string;
  last_four_digits: string;
  nickname: string | null;
  active: boolean;
  statement_closing_day: number | null;
  due_day: number | null;
};

type AliasRow = { id: number; credit_card_id: number; alias: string; alias_kind: CardAlias["aliasKind"] };

const mapCard = (row: CardRow): CreditCard => ({
  id: row.id,
  brand: row.brand,
  lastFourDigits: row.last_four_digits,
  nickname: row.nickname ?? undefined,
  active: row.active,
  statementClosingDay: row.statement_closing_day ?? undefined,
  dueDay: row.due_day ?? undefined,
});

const mapAlias = (row: AliasRow): CardAlias => ({
  id: row.id,
  creditCardId: row.credit_card_id,
  alias: row.alias,
  aliasKind: row.alias_kind,
});

function validateDay(value: number | undefined, label: string) {
  if (value != null && (!Number.isInteger(value) || value < 1 || value > 31)) {
    throw new Error(`${label} deve estar entre 1 e 31.`);
  }
}

export const creditCardService = {
  async getAll(): Promise<CreditCard[]> {
    const { data, error } = await supabase
      .from("credit_cards")
      .select("id,brand,last_four_digits,nickname,active,statement_closing_day,due_day")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as CardRow[]).map(mapCard);
  },

  async create(input: CreditCardCreateInput): Promise<CreditCard> {
    if (!/^\d{4}$/.test(input.lastFourDigits)) throw new Error("Informe exatamente 4 dígitos numéricos.");
    validateDay(input.statementClosingDay, "O dia de fechamento");
    validateDay(input.dueDay, "O dia de vencimento");

    const userId = await currentDomusUserId();
    const { data, error } = await supabase
      .from("credit_cards")
      .insert({
        user_id: userId,
        brand: input.brand,
        last_four_digits: input.lastFourDigits,
        nickname: input.nickname?.trim() || null,
        statement_closing_day: input.statementClosingDay ?? null,
        due_day: input.dueDay ?? null,
        active: true,
      })
      .select("id,brand,last_four_digits,nickname,active,statement_closing_day,due_day")
      .single();
    return mapCard(requireData(data as CardRow | null, error));
  },

  async getAliases(creditCardId: number): Promise<CardAlias[]> {
    const { data, error } = await supabase
      .from("card_aliases")
      .select("id,credit_card_id,alias,alias_kind")
      .eq("credit_card_id", creditCardId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as AliasRow[]).map(mapAlias);
  },

  async addAlias(creditCardId: number, alias: string, aliasKind: CardAlias["aliasKind"] = "token"): Promise<CardAlias> {
    const normalized = alias.trim();
    if (!normalized) throw new Error("Informe o identificador do cartão.");
    const { data, error } = await supabase
      .from("card_aliases")
      .insert({ credit_card_id: creditCardId, alias: normalized, alias_kind: aliasKind })
      .select("id,credit_card_id,alias,alias_kind")
      .single();
    return mapAlias(requireData(data as AliasRow | null, error));
  },

  async deactivate(id: number): Promise<void> {
    const { error } = await supabase.from("credit_cards").update({ active: false }).eq("id", id);
    if (error) throw error;
  },
};
