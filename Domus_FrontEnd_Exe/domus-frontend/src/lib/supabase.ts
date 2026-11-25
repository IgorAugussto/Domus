import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const transientStorage = new Map<string, string>();

const secureStorage: SupportedStorage = {
  getItem: async (key) => {
    if (window.domusDesktop?.sessionStorage) return window.domusDesktop.sessionStorage.get(key);
    return transientStorage.get(key) ?? null;
  },
  setItem: async (key, value) => {
    if (window.domusDesktop?.sessionStorage) return window.domusDesktop.sessionStorage.set(key, value);
    transientStorage.set(key, value);
  },
  removeItem: async (key) => {
    if (window.domusDesktop?.sessionStorage) return window.domusDesktop.sessionStorage.remove(key);
    transientStorage.delete(key);
  },
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente local.",
    );
  }
}

// Fora do Electron (por exemplo, preview no navegador), a sessão é apenas de
// memória. O app empacotado usa safeStorage do Electron por IPC.
export const supabase = createClient(
  supabaseUrl ?? "https://not-configured.invalid",
  supabasePublishableKey ?? "not-configured",
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
