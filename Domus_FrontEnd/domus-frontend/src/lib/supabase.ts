import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente local.",
    );
  }
}

export const supabase = createClient(
  supabaseUrl ?? "https://not-configured.invalid",
  supabasePublishableKey ?? "not-configured",
  {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  },
);
