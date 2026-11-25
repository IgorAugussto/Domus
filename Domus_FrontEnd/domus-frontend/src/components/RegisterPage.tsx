import { Navigate } from "react-router-dom";

// Usuários do Domus são provisionados pelo administrador no Supabase Auth.
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
