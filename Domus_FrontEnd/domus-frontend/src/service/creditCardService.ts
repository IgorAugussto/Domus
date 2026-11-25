import { currentDomusUserId, requireData } from "../lib/financial";
import { supabase } from "../lib/supabase";

export interface CreditCard { id: number; brand: string; lastFourDigits: string; nickname?: string; active: boolean; statementClosingDay?: number; dueDay?: number; }
export interface CreditCardCreateInput { brand: string; lastFourDigits: string; nickname?: string; statementClosingDay?: number; dueDay?: number; }
type Row = { id:number; brand:string; last_four_digits:string; nickname:string|null; active:boolean; statement_closing_day:number|null; due_day:number|null };
const map = (row: Row): CreditCard => ({ id:row.id, brand:row.brand, lastFourDigits:row.last_four_digits, nickname:row.nickname ?? undefined, active:row.active, statementClosingDay:row.statement_closing_day ?? undefined, dueDay:row.due_day ?? undefined });

export const creditCardService = {
  async getAll(): Promise<CreditCard[]> { const { data, error } = await supabase.from("credit_cards").select("id,brand,last_four_digits,nickname,active,statement_closing_day,due_day").eq("active", true).order("created_at", { ascending:false }); if (error) throw error; return ((data ?? []) as Row[]).map(map); },
  async create(input: CreditCardCreateInput): Promise<CreditCard> { if (!/^\d{4}$/.test(input.lastFourDigits)) throw new Error("Informe exatamente 4 dígitos numéricos."); for (const [label, day] of [["Fechamento", input.statementClosingDay], ["Vencimento", input.dueDay]] as const) if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) throw new Error(`${label} deve estar entre 1 e 31.`); const userId = await currentDomusUserId(); const { data, error } = await supabase.from("credit_cards").insert({ user_id:userId, brand:input.brand, last_four_digits:input.lastFourDigits, nickname:input.nickname?.trim() || null, statement_closing_day:input.statementClosingDay ?? null, due_day:input.dueDay ?? null, active:true }).select("id,brand,last_four_digits,nickname,active,statement_closing_day,due_day").single(); return map(requireData(data as Row | null, error)); },
};
