import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from '../lib/supabase';

interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  nome?: string;
}

export const authService = {

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    assertSupabaseConfigured();
    const { data: result, error } = await supabase.auth.signInWithPassword(data);
    if (error) throw error;
    if (!result.user) throw new Error('O Supabase não retornou o usuário autenticado.');
    const { error: profileError } = await supabase.rpc('ensure_current_domus_user');
    if (profileError) throw profileError;
    return {
      id: result.user.id,
      email: result.user.email ?? data.email,
      nome: typeof result.user.user_metadata.name === 'string' ? result.user.user_metadata.name : undefined,
    };
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getMe: async (): Promise<AuthResponse | null> => {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { error: profileError } = await supabase.rpc('ensure_current_domus_user');
    if (profileError) throw profileError;
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      nome: typeof data.user.user_metadata.name === 'string' ? data.user.user_metadata.name : undefined,
    };
  },

};
