import { supabase } from "../lib/supabase";

export interface FinancialAccount {
  account_id: number;
  name: string;
  holder_name: string;
  opening_date: string;
  balance: string;
  confirmed_at: string;
}
export interface AccountAdjustment {
  adjustment_id: number;
  delta: string;
  confirmed_balance: string;
  note: string | null;
  created_at: string;
}

export function normalizeMoney(value: string): string | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) return null;
  return normalized;
}

export function balanceTotal(accounts: FinancialAccount[]): number | null {
  let total = 0;
  for (const account of accounts) {
    const match = /^(-?)(\d+)\.(\d{2})$/.exec(account.balance);
    if (!match) return null;
    const cents = (Number(match[2]) * 100 + Number(match[3])) * (match[1] ? -1 : 1);
    total += cents;
    if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(total)) return null;
  }
  return total / 100;
}

export const financialAccountService = {
  async list(): Promise<FinancialAccount[]> {
    const { data, error } = await supabase.rpc("domus_financial_account_balances");
    if (error) throw error;
    return (data ?? []) as FinancialAccount[];
  },
  async history(accountId: number): Promise<AccountAdjustment[]> {
    const { data, error } = await supabase.rpc("domus_financial_account_history", { p_account_id: accountId });
    if (error) throw error;
    return (data ?? []) as AccountAdjustment[];
  },
  async create(name: string, holderName: string, amount: string, date: string): Promise<void> {
    const { error } = await supabase.rpc("domus_create_financial_account", { p_name: name, p_holder_name: holderName, p_opening_balance: amount, p_opening_date: date });
    if (error) throw error;
  },
  async adjust(accountId: number, amount: string, note: string): Promise<void> {
    const { error } = await supabase.rpc("domus_adjust_financial_account", { p_account_id: accountId, p_confirmed_balance: amount, p_note: note.trim() || null });
    if (error) throw error;
  },
};
