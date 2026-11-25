import { Navigate } from "react-router-dom";

// O projeto não oferece cadastro público. Usuários são provisionados pelo
// administrador no Supabase Auth.
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
