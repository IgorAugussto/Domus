import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../ui-components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui-components/card";
import { Input } from "../ui-components/input";
import { Label } from "../ui-components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui-components/select";
import { financialAccountService, normalizeMoney, type FinancialAccount } from "../service/financialAccountService";
import { cashMovementService, newRequestKey, type CashKind, type CashMovement } from "../service/cashMovementService";
import { incomeService, type Income } from "../service/incomeService";
import { costService, type Cost } from "../service/costService";
import { creditCardService, type CreditCard } from "../service/creditCardService";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const errorMessage = (error: unknown) => typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "Confira sua conexão e tente novamente.";

export function CashMovementsPage() {
  const { search } = useLocation();
  const initialParams = useRef(new URLSearchParams(search));
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<CashKind>(() => initialParams.current.get("kind") === "statement" ? "statement" : initialParams.current.get("kind") === "expense" ? "expense" : "income");
  const [account, setAccount] = useState("");
  const [source, setSource] = useState(() => initialParams.current.get("source") ?? "");
  const [month, setMonth] = useState(() => initialParams.current.get("month") ?? today().slice(0, 7));
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expectedAmount, setExpectedAmount] = useState("");
  const expectedKey = useRef(newRequestKey());
  const [sourceCheck, setSourceCheck] = useState<{ key: string; total: string | null; error: string | null } | null>(null);
  const requestKey = useRef(newRequestKey());
  const reverseKeys = useRef<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const [nextAccounts, nextIncomes, nextCosts, nextCards, nextMovements] = await Promise.all([
        financialAccountService.list(), incomeService.getAll(), costService.getAll(), creditCardService.getAll(), cashMovementService.list(),
      ]);
      setAccounts(nextAccounts); setIncomes(nextIncomes); setCosts(nextCosts); setCards(nextCards); setMovements(nextMovements); setRevision(value => value + 1);
      if (initialParams.current.get("kind") === "expense") {
        const planned = nextCosts.find(item => String(item.id) === initialParams.current.get("source"))?.plannedAccountId;
        if (planned) setAccount(current => current || String(planned));
      }
      return true;
    } catch { setMessage("Não foi possível carregar as movimentações. Confira sua conexão."); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sourceKey = `${kind}:${source}:${month}:${revision}`;
  const sourceTotal = sourceCheck?.key === sourceKey ? sourceCheck.total : null;
  const sourceTotalError = sourceCheck?.key === sourceKey ? sourceCheck.error : null;
  useEffect(() => {
    let active = true;
    if (source && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      Promise.all([cashMovementService.sourceTotal(kind, Number(source), month), kind === "income" ? cashMovementService.incomeExpected(Number(source), month) : Promise.resolve(null)])
        .then(([value, expected]) => { if (active) { setSourceCheck({ key: sourceKey, total: value, error: null }); if (expected !== null) setExpectedAmount(expected); } })
        .catch(error => { if (active) setSourceCheck({ key: sourceKey, total: null, error: errorMessage(error) }); });
    }
    return () => { active = false; };
  }, [kind, source, month, sourceKey]);

  const options = kind === "income" ? incomes.map(item => ({ value: String(item.id), label: item.description }))
    : kind === "expense" ? costs.filter(item => item.paymentType !== "Cartão de Crédito").map(item => ({ value: String(item.id), label: item.description }))
    : cards.map(item => ({ value: String(item.id), label: `${item.nickname || item.brand} •••• ${item.lastFourDigits}` }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = normalizeMoney(amount);
    if (sourceTotalError || sourceTotal === null) { setMessage("Aguarde a consulta do total já registrado ou verifique sua conexão."); return; }
    if (!account || !source || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !date || value === null || Number(value) <= 0) { setMessage("Informe conta, lançamento, competência, data e valor positivo."); return; }
    setBusy(true); setMessage("");
    try {
      await cashMovementService.record({ accountId: Number(account), kind, amount: value, date, sourceId: Number(source), month, requestKey: requestKey.current, note });
      requestKey.current = newRequestKey(); setAmount(""); setNote("");
      if (await load()) setMessage("Movimentação registrada e saldo atualizado.");
    } catch (error) { await load(); setMessage(`Não foi possível registrar: ${errorMessage(error)}. Se a conexão falhou, confira o histórico antes de tentar novamente.`); }
    finally { setBusy(false); }
  };
  const saveExpected = async () => {
    const value = normalizeMoney(expectedAmount);
    if (!source || sourceTotal === null || value === null || Number(value) <= 0) { setMessage("Informe um valor previsto positivo com até duas casas decimais."); return; }
    setBusy(true); setMessage("");
    try { await cashMovementService.setIncomeExpected(Number(source), month, value, expectedKey.current); expectedKey.current = newRequestKey(); if (await load()) setMessage("Previsão alterada somente para este mês."); }
    catch (error) { await load(); setMessage(`Não foi possível alterar a previsão: ${errorMessage(error)}.`); }
    finally { setBusy(false); }
  };
  const reverse = async (item: CashMovement) => {
    if (!window.confirm("Estornar esta movimentação? O saldo será corrigido e o histórico preservado.")) return;
    setBusy(true); setMessage("");
    const key = reverseKeys.current[item.movement_id] ?? newRequestKey(); reverseKeys.current[item.movement_id] = key;
    try { await cashMovementService.reverse(item.movement_id, key); if (await load()) setMessage("Movimentação estornada."); }
    catch (error) { setMessage(`Não foi possível estornar: ${errorMessage(error)}.`); }
    finally { setBusy(false); }
  };
  const labels: Record<CashMovement["kind"], string> = { income: "Recebimento", expense: "Pagamento de despesa", statement: "Pagamento de fatura", reversal: "Estorno" };
  const sourceLabel = (item: CashMovement) => {
    if (item.kind === "income") return incomes.find(value => Number(value.id) === item.income_id)?.description ?? "Receita";
    if (item.kind === "expense") return costs.find(value => value.id === item.outgoing_id)?.description ?? "Despesa";
    if (item.kind === "statement") { const card = cards.find(value => value.id === item.credit_card_id); return card ? `${card.nickname || card.brand} •••• ${card.lastFourDigits}` : "Fatura"; }
    return `Movimentação ${item.reversal_of}`;
  };

  return <div className="space-y-6">
    <div><h2 className="text-xl font-bold" style={{ color: "var(--financial-trust)" }}>Movimentações</h2><p className="mt-1 text-sm">Registre apenas valores que ainda não foram incluídos no saldo informado da conta.</p></div>
    {message && <p role="status">{message}</p>}
    {loading ? <p>Carregando...</p> : <>
      <Card><CardHeader><CardTitle>Registrar entrada ou saída</CardTitle></CardHeader><CardContent>
        {accounts.length === 0 ? <p>Cadastre uma conta em Contas e saldos antes de registrar movimentações.</p> : <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div><Label>Tipo</Label><Select value={kind} onValueChange={value => { setKind(value as CashKind); setSource(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Recebimento de receita</SelectItem><SelectItem value="expense">Pagamento de despesa</SelectItem><SelectItem value="statement">Pagamento de fatura</SelectItem></SelectContent></Select></div>
          <div><Label>Conta</Label><Select value={account} onValueChange={setAccount}><SelectTrigger><SelectValue placeholder="Escolha a conta" /></SelectTrigger><SelectContent>{accounts.map(item => <SelectItem key={item.account_id} value={String(item.account_id)}>{item.name} · {item.holder_name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>{kind === "income" ? "Receita" : kind === "expense" ? "Despesa" : "Cartão"}</Label><Select value={source} onValueChange={value => { setSource(value); if (kind === "expense") { const planned = costs.find(item => String(item.id) === value)?.plannedAccountId; if (planned) setAccount(String(planned)); } }}><SelectTrigger><SelectValue placeholder="Escolha um lançamento" /></SelectTrigger><SelectContent>{options.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>{options.length === 0 && <p className="text-sm">Nenhuma opção cadastrada.</p>}</div>
          <div><Label htmlFor="cash-month">{kind === "statement" ? "Mês de fechamento da fatura" : "Mês de referência"}</Label><Input id="cash-month" type="month" value={month} onChange={e => setMonth(e.target.value)} required /></div>
          {source && <p className="text-sm md:col-span-2">{sourceTotalError ? `Não foi possível consultar: ${sourceTotalError}` : sourceTotal === null ? "Consultando total já registrado..." : `Total já registrado nesta referência: ${money(sourceTotal)}`}</p>}
          {kind === "income" && source && <div className="md:col-span-2 space-y-2"><Label htmlFor="income-month-expected">Receita prevista neste mês (R$)</Label><div className="flex flex-wrap gap-2"><Input id="income-month-expected" className="max-w-xs" inputMode="decimal" value={expectedAmount} onChange={event => setExpectedAmount(event.target.value)} /><Button type="button" variant="outline" disabled={busy || sourceTotal === null || !!sourceTotalError} onClick={() => void saveExpected()}>Alterar previsão deste mês</Button></div><p className="text-xs">A alteração não registra recebimento nem muda os outros meses.</p></div>}
          <div><Label htmlFor="cash-date">Data em que o dinheiro {kind === "income" ? "entrou" : "saiu"}</Label><Input id="cash-date" type="date" max={today()} value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div><Label htmlFor="cash-amount">Valor efetivo (R$)</Label><Input id="cash-amount" inputMode="decimal" placeholder="Ex.: 150,00" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
          <div className="md:col-span-2"><Label htmlFor="cash-note">Observação (opcional)</Label><Input id="cash-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></div>
          <Button type="submit" disabled={busy || sourceTotal === null || !!sourceTotalError}>Registrar movimentação</Button>
        </form>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Últimas 200 movimentações</CardTitle></CardHeader><CardContent className="space-y-3">{movements.length === 0 ? <p>Nenhuma movimentação registrada.</p> : movements.map(item => <div key={item.movement_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <div><p className="font-semibold">{labels[item.kind]} · {sourceLabel(item)}</p><p className="text-sm">{item.effective_date.split("-").reverse().join("/")} · {accounts.find(a => a.account_id === item.account_id)?.name ?? "Conta"}{item.source_month ? ` · referência ${item.source_month.slice(0, 7)}` : ""}{item.reversed ? " · Estornada" : ""}</p>{item.note && <p className="text-sm">{item.note}</p>}</div>
        <div className="flex items-center gap-3"><strong>{money(item.signed_amount)}</strong>{item.kind !== "reversal" && !item.reversed && <Button type="button" variant="outline" disabled={busy} onClick={() => void reverse(item)}>Estornar</Button>}</div>
      </div>)}</CardContent></Card>
    </>}
  </div>;
}
