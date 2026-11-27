import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui-components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui-components/card";
import { Input } from "../ui-components/input";
import { Label } from "../ui-components/label";
import { financialAccountService, balanceTotal, normalizeMoney, type FinancialAccount, type AccountAdjustment } from "../service/financialAccountService";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const readableDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export function FinancialAccountsPage() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [holder, setHolder] = useState("");
  const [opening, setOpening] = useState("");
  const [date, setDate] = useState(localToday);
  const [selected, setSelected] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [history, setHistory] = useState<AccountAdjustment[]>([]);

  const load = useCallback(async () => {
    try { setAccounts(await financialAccountService.list()); setLoadFailed(false); return true; }
    catch { setLoadFailed(true); setMessage("Não foi possível carregar as contas. Tente novamente."); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = normalizeMoney(opening);
    if (!name.trim() || !holder.trim() || value === null || !date) { setMessage("Informe conta, titular, saldo e data válidos."); return; }
    setBusy(true); setMessage("");
    try {
      await financialAccountService.create(name.trim(), holder.trim(), value, date);
      setName(""); setHolder(""); setOpening(""); setDate(localToday());
      if (await load()) setMessage("Conta cadastrada.");
    } catch { setMessage("Não foi possível cadastrar. Confira os dados e a conexão."); }
    finally { setBusy(false); }
  };
  const adjust = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = normalizeMoney(amount);
    if (selected === null || value === null) { setMessage("Informe o saldo confirmado, com até duas casas decimais."); return; }
    setBusy(true); setMessage("");
    try {
      await financialAccountService.adjust(selected, value, note);
      setSelected(null); setAmount(""); setNote(""); setHistoryId(null);
      if (await load()) setMessage("Saldo atualizado; ajuste registrado no histórico.");
    } catch { setMessage("Não foi possível atualizar o saldo. Tente novamente."); }
    finally { setBusy(false); }
  };
  const showHistory = async (id: number) => {
    if (historyId === id) { setHistoryId(null); return; }
    setHistoryId(null); setMessage("");
    try { setHistory(await financialAccountService.history(id)); setHistoryId(id); }
    catch { setMessage("Não foi possível carregar o histórico."); }
  };
  const total = balanceTotal(accounts);

  return <div className="space-y-6">
    <div><h2 className="text-xl font-bold" style={{ color: "var(--financial-trust)" }}>Contas e saldos</h2><p className="mt-1 text-sm" style={{ color: "var(--card-foreground)" }}>Saldos informados por você. Pagamentos e recebimentos ainda não os atualizam automaticamente.</p></div>
    {message && <p role="status" style={{ color: "var(--card-foreground)" }}>{message}</p>}
    <Card><CardHeader><CardTitle>Saldo conjunto informado</CardTitle></CardHeader><CardContent>{loading ? "Carregando..." : loadFailed ? "Não foi possível carregar o saldo." : accounts.length === 0 ? "Cadastre uma conta para começar." : total === null ? "Total indisponível" : <strong>{money(total)}</strong>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Cadastrar conta</CardTitle></CardHeader><CardContent>
      <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
        <div><Label htmlFor="account-name">Nome da conta</Label><Input id="account-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></div>
        <div><Label htmlFor="account-holder">Titular</Label><Input id="account-holder" value={holder} onChange={e => setHolder(e.target.value)} maxLength={100} required /></div>
        <div><Label htmlFor="account-opening">Saldo informado (R$)</Label><Input id="account-opening" inputMode="decimal" placeholder="Ex.: 1000,50" value={opening} onChange={e => setOpening(e.target.value)} required /></div>
        <div><Label htmlFor="account-date">Data desse saldo</Label><Input id="account-date" type="date" max={localToday()} value={date} onChange={e => setDate(e.target.value)} required /></div>
        <Button disabled={busy} type="submit">Cadastrar conta</Button>
      </form>
    </CardContent></Card>
    {accounts.map(account => <Card key={account.account_id}><CardHeader><CardTitle>{account.name} · {account.holder_name}</CardTitle></CardHeader><CardContent className="space-y-3">
      <p>Saldo informado: <strong>{money(Number(account.balance))}</strong></p>
      <p className="text-sm">Data do saldo inicial: {readableDate(account.opening_date)} · Último registro: {new Date(account.confirmed_at).toLocaleString("pt-BR")}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => { setSelected(account.account_id); setAmount(account.balance); setNote(""); }}>Atualizar saldo</Button><Button type="button" variant="outline" onClick={() => void showHistory(account.account_id)}>{historyId === account.account_id ? "Ocultar histórico" : "Ver histórico"}</Button></div>
      {selected === account.account_id && <form onSubmit={adjust} className="space-y-2"><Label htmlFor={`adjust-${account.account_id}`}>Saldo confirmado no banco (R$)</Label><Input id={`adjust-${account.account_id}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required /><Label htmlFor={`note-${account.account_id}`}>Observação (opcional)</Label><Input id={`note-${account.account_id}`} value={note} maxLength={500} onChange={e => setNote(e.target.value)} /><div className="flex gap-2"><Button disabled={busy} type="submit">Salvar ajuste</Button><Button variant="outline" type="button" onClick={() => setSelected(null)}>Cancelar</Button></div></form>}
      {historyId === account.account_id && <div><h3 className="font-semibold">Últimos 20 ajustes</h3>{history.length === 0 ? <p>Nenhum ajuste registrado.</p> : <ul className="space-y-1">{history.map(item => <li key={item.adjustment_id} className="text-sm">{new Date(item.created_at).toLocaleString("pt-BR")} · {money(Number(item.delta))} · saldo {money(Number(item.confirmed_balance))}{item.note ? ` · ${item.note}` : ""}</li>)}</ul>}</div>}
    </CardContent></Card>)}
  </div>;
}
