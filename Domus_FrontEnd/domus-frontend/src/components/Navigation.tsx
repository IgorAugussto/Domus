import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BarChart3, BellRing, CreditCard, DollarSign, Home, IdCard, LogOut, Menu, Moon, ReceiptText, Sun, TrendingUp, Wallet, X } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

type Page = "dashboard" | "accounts" | "income" | "expenses" | "investments" | "payments" | "cards" | "statements" | "review";
interface NavigationProps {
  onPageChange: (page: Page) => void;
  onLogout: () => void;
}

const sections: { title: string; pages: { id: Page; label: string; icon: typeof Home }[] }[] = [
  { title: "Visão geral", pages: [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "accounts", label: "Contas e saldos", icon: Wallet },
  ] },
  { title: "Finanças", pages: [
    { id: "income", label: "Receitas", icon: TrendingUp },
    { id: "expenses", label: "Despesas", icon: DollarSign },
    { id: "investments", label: "Investimentos", icon: BarChart3 },
    { id: "payments", label: "Pagamentos", icon: CreditCard },
  ] },
  { title: "Cartões", pages: [
    { id: "cards", label: "Cartões", icon: IdCard },
    { id: "statements", label: "Faturas", icon: ReceiptText },
    { id: "review", label: "Revisar capturas", icon: BellRing },
  ] },
];

export default function Navigation({ onPageChange, onLogout }: NavigationProps) {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const currentPage = pathname.replace(/^\//, "") as Page;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return <>
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 shadow-sm sm:px-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="domus-navigation" className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--financial-trust-light)] focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden" style={{ color: "var(--card-foreground)" }}>
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
      <div className="hidden w-10 lg:block" />
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2" aria-label="Domus">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: "linear-gradient(135deg, #2563eb, #059669)" }}><Home size={19} /></span>
        <span className="text-xl font-bold tracking-tight" style={{ color: "var(--card-foreground)" }}>Domus</span>
      </div>
      <button type="button" onClick={toggleTheme} aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--financial-trust-light)] focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "var(--card-foreground)" }}>
        {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
      </button>
    </header>

    {open && <button type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/50 lg:hidden" />}
    <aside id="domus-navigation" aria-label="Menu principal" className={`fixed bottom-0 left-0 top-16 z-40 flex w-64 flex-col border-r shadow-lg transition-transform duration-200 lg:translate-x-0 lg:shadow-none ${open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
        {sections.map(section => <div key={section.title}>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--card-foreground)", opacity: 0.6 }}>{section.title}</p>
          <div className="space-y-1">{section.pages.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return <button key={id} type="button" aria-current={active ? "page" : undefined} onClick={() => { onPageChange(id); setOpen(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-[var(--financial-trust-light)] focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: active ? "var(--financial-trust)" : "var(--card-foreground)", backgroundColor: active ? "var(--financial-trust-light)" : undefined }}>
              <Icon size={19} aria-hidden="true" /><span className="flex-1">{label}</span>{active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--financial-trust)" }} />}
            </button>;
          })}</div>
        </div>)}
      </nav>
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}><button type="button" onClick={() => { setOpen(false); onLogout(); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-[var(--financial-danger-light)] focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "var(--card-foreground)" }}><LogOut size={19} /> Sair</button></div>
    </aside>
  </>;
}
