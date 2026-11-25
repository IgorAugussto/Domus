import { Redirect } from "expo-router";

// O projeto não oferece cadastro público. Usuários são provisionados pelo
// administrador no Supabase Auth.
export default function RegisterScreen() {
  return <Redirect href="/login" />;
}
