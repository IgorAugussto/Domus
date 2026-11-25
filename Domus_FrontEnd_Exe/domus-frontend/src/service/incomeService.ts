import { currentDomusUserId, requireData, withoutUndefined } from "../lib/financial";
import { supabase } from "../lib/supabase";

export interface Income { id?: string; description: string; value: number; startDate: string; endDate: string; frequency: string; recurring: boolean; category: string; }
export interface IncomeCreateInput { amount: number; description: string; startDate: string; endDate: string; recurring: boolean; category: string; frequency: string; }
export interface IncomeUpdateInput { amount?: number; description?: string; startDate?: string; endDate?: string; recurring?: boolean; category?: string; frequency?: string; }
type IncomeRow = { id: number; description: string; value: number | string; start_date: string; end_date: string | null; frequency: string; recurring: boolean | null; category: string | null; };
const mapIncome = (row: IncomeRow): Income => ({ id: String(row.id), description: row.description, value: Number(row.value), startDate: row.start_date, endDate: row.end_date ?? "", frequency: row.frequency, recurring: Boolean(row.recurring), category: row.category ?? "" });

export const incomeService = {
  create: async (data: IncomeCreateInput) => {
    const userId = await currentDomusUserId(); const endDate = data.frequency === "Monthly" ? addYear(data.startDate) : data.endDate || null;
    const { data: row, error } = await supabase.from("income").insert({ user_id: userId, value: data.amount, description: data.description, start_date: data.startDate, end_date: endDate, recurring: data.frequency === "Monthly", category: data.category, frequency: data.frequency }).select().single();
    return mapIncome(requireData(row as IncomeRow | null, error));
  },
  getAll: async (): Promise<Income[]> => { const { data, error } = await supabase.from("income").select("id,description,value,start_date,end_date,frequency,recurring,category").order("start_date", { ascending: true }); if (error) throw error; return (data as IncomeRow[]).map(mapIncome); },
  getTotal: async () => (await incomeService.getAll()).reduce((total, item) => total + item.value, 0),
  update: async (id: number, data: IncomeUpdateInput) => { const patch = withoutUndefined({ value: data.amount, description: data.description, start_date: data.startDate, end_date: data.frequency === "Monthly" && data.startDate ? addYear(data.startDate) : data.endDate, recurring: data.frequency === undefined ? data.recurring : data.frequency === "Monthly", category: data.category, frequency: data.frequency }); const { data: row, error } = await supabase.from("income").update(patch).eq("id", id).select().single(); return mapIncome(requireData(row as IncomeRow | null, error)); },
  delete: async (id: number) => { const { error } = await supabase.from("income").delete().eq("id", id); if (error) throw error; },
};
function addYear(date: string) { const value = new Date(`${date}T00:00:00`); value.setFullYear(value.getFullYear() + 1); return value.toISOString().slice(0, 10); }
