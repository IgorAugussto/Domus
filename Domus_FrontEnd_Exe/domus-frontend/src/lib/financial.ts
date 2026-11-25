import { supabase } from "./supabase";

export async function currentDomusUserId(): Promise<number> {
  const { data, error } = await supabase.rpc("current_domus_user_id");
  if (error) throw error;
  if (data == null) throw new Error("Perfil financeiro não encontrado. Faça login novamente.");
  return Number(data);
}

export function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw error;
  if (data === null) throw new Error("O Supabase não retornou dados.");
  return data;
}
