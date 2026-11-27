import { useState } from "react";
import Navigation from "../components/Navigation";
import { Outlet, useNavigate } from "react-router-dom";
import { authService } from "../service/authService";

export default function PrivateLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("domus-sidebar-collapsed") === "true"; }
    catch { return false; }
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("domus-sidebar-collapsed", String(next)); } catch { /* A preferência é opcional. */ }
  };

  const handlePageChange = (page: string) => {
    navigate(`/${page}`);
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate("/login");
  };

  return (
    <>
      <Navigation onPageChange={handlePageChange} onLogout={handleLogout} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className={`min-w-0 p-4 transition-[margin] duration-200 sm:p-6 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <Outlet />
      </main>
    </>
  );
}
