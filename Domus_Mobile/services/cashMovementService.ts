import { supabase } from "../lib/supabase";
export type CashKind = "income" | "expense" | "statement";
export interface CashMovement {
  movement_id: number;
  account_id: number;
  kind: CashKind | "reversal";
  amount: string;
  signed_amount: string;
  effective_date: string;
  source_month: string | null;
  income_id: number | null;
  outgoing_id: number | null;
  credit_card_id: number | null;
  reversal_of: number | null;
  reversed: boolean;
  note: string | null;
}
export function newRequestKey() { return `domus-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
export const cashMovementService = {
  async list(): Promise<CashMovement[]> {
    const { data, error } = await supabase.rpc("domus_list_cash_movements");
    if (error) throw error;
    return (data ?? []) as CashMovement[];
  },
  async sourceTotal(kind: CashKind, sourceId: number, month: string): Promise<string> {
    const { data, error } = await supabase.rpc("domus_cash_source_total", { p_kind: kind, p_source_id: sourceId, p_source_month: `${month}-01` });
    if (error) throw error;
    return String(data);
  },
  async incomeExpected(incomeId: number, month: string): Promise<string> {
    const { data, error } = await supabase.rpc("domus_income_month_value", { p_income_id: incomeId, p_source_month: `${month}-01` });
    if (error) throw error;
    return String(data);
  },
  async setIncomeExpected(incomeId: number, month: string, value: string, requestKey: string): Promise<void> {
    const { error } = await supabase.rpc("domus_set_income_month_value", { p_income_id: incomeId, p_source_month: `${month}-01`, p_value: value, p_request_key: requestKey });
    if (error) throw error;
  },
  async record(input: { accountId: number; kind: CashKind; amount: string; date: string; sourceId: number; month: string; requestKey: string; note: string }): Promise<void> {
    const { error } = await supabase.rpc("domus_record_cash_movement", { p_account_id: input.accountId, p_kind: input.kind, p_amount: input.amount, p_effective_date: input.date, p_source_id: input.sourceId, p_source_month: `${input.month}-01`, p_request_key: input.requestKey, p_note: input.note.trim() || null });
    if (error) throw error;
  },
  async reverse(id: number, key: string): Promise<void> {
    const { error } = await supabase.rpc("domus_reverse_cash_movement", { p_movement_id: id, p_request_key: key, p_note: null });
    if (error) throw error;
  },
};
