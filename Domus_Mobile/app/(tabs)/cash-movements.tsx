import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { financialAccountService, normalizeMoney, type FinancialAccount } from "@/services/financialAccountService";
import { cashMovementService, newRequestKey, type CashKind, type CashMovement } from "@/services/cashMovementService";
import { incomeService, type Income } from "@/services/incomeService";
import { costService, type Cost } from "@/services/costService";
import { creditCardService, type CreditCard } from "@/services/creditCardService";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: string) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const errorMessage = (error: unknown) => typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "Confira sua conexão e tente novamente.";
const kindOptions = [{ value: "income", label: "Recebimento de receita" }, { value: "expense", label: "Pagamento de despesa" }, { value: "statement", label: "Pagamento de fatura" }];

export default function CashMovementsScreen() {
  const params = useLocalSearchParams<{ kind?: string; source?: string; month?: string }>();
  const initialParams = useRef(params);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<CashKind>(params.kind === "statement" ? "statement" : params.kind === "expense" ? "expense" : "income");
  const [account, setAccount] = useState("");
  const [source, setSource] = useState(params.source ?? "");
  const [month, setMonth] = useState(() => params.month ?? today().slice(0, 7));
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
      const [a, i, o, c, m] = await Promise.all([financialAccountService.list(), incomeService.getAll(), costService.getAll(), creditCardService.getAll(), cashMovementService.list()]);
      setAccounts(a); setIncomes(i); setCosts(o); setCards(c); setMovements(m); setRevision(value => value + 1);
      if (initialParams.current.kind === "expense") {
        const planned = o.find(item => String(item.id) === initialParams.current.source)?.plannedAccountId;
        if (planned) setAccount(current => current || String(planned));
      }
      return true;
    } catch { Alert.alert("Não foi possível carregar", "Confira sua conexão."); return false; }
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
  const options = kind === "income" ? incomes.map(item => ({ value: String(item.id), label: item.description })) : kind === "expense" ? costs.filter(item => item.paymentType !== "Cartão de Crédito").map(item => ({ value: String(item.id), label: item.description })) : cards.map(item => ({ value: String(item.id), label: `${item.nickname || item.brand} •••• ${item.lastFourDigits}` }));
  const submit = async () => {
    const value = normalizeMoney(amount);
    if (sourceTotalError || sourceTotal === null) { Alert.alert("Aguarde a consulta do total já registrado ou verifique sua conexão."); return; }
    if (!account || !source || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today() || value === null || Number(value) <= 0) { Alert.alert("Confira os dados", "Informe conta, lançamento, competência, data e valor positivo."); return; }
    setBusy(true);
    try { await cashMovementService.record({ accountId: Number(account), kind, amount: value, date, sourceId: Number(source), month, requestKey: requestKey.current, note }); requestKey.current = newRequestKey(); setAmount(""); setNote(""); if (await load()) Alert.alert("Movimentação registrada", "O saldo foi atualizado."); }
    catch (error) { await load(); Alert.alert("Não foi possível registrar", `${errorMessage(error)}. Se a conexão falhou, confira o histórico antes de tentar novamente.`); }
    finally { setBusy(false); }
  };
  const saveExpected = async () => {
    const value = normalizeMoney(expectedAmount);
    if (!source || sourceTotal === null || value === null || Number(value) <= 0) { Alert.alert("Informe um valor previsto positivo com até duas casas decimais."); return; }
    setBusy(true);
    try { await cashMovementService.setIncomeExpected(Number(source), month, value, expectedKey.current); expectedKey.current = newRequestKey(); if (await load()) Alert.alert("Previsão alterada somente para este mês."); }
    catch (error) { await load(); Alert.alert("Não foi possível alterar a previsão", errorMessage(error)); }
    finally { setBusy(false); }
  };
  const reverse = (item: CashMovement) => Alert.alert("Estornar movimentação?", "O saldo será corrigido e o histórico preservado.", [
    { text: "Cancelar", style: "cancel" },
    { text: "Estornar", style: "destructive", onPress: async () => { setBusy(true); const key = reverseKeys.current[item.movement_id] ?? newRequestKey(); reverseKeys.current[item.movement_id] = key; try { await cashMovementService.reverse(item.movement_id, key); if (await load()) Alert.alert("Movimentação estornada"); } catch (error) { Alert.alert("Não foi possível estornar", errorMessage(error)); } finally { setBusy(false); } } },
  ]);
  const labels: Record<CashMovement["kind"], string> = { income: "Recebimento", expense: "Pagamento de despesa", statement: "Pagamento de fatura", reversal: "Estorno" };
  const sourceLabel = (item: CashMovement) => {
    if (item.kind === "income") return incomes.find(value => Number(value.id) === item.income_id)?.description ?? "Receita";
    if (item.kind === "expense") return costs.find(value => value.id === item.outgoing_id)?.description ?? "Despesa";
    if (item.kind === "statement") { const card = cards.find(value => value.id === item.credit_card_id); return card ? `${card.nickname || card.brand} •••• ${card.lastFourDigits}` : "Fatura"; }
    return `Movimentação ${item.reversal_of}`;
  };
  return <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
    <ScreenHeader title="Movimentações" subtitle="Entradas e saídas efetivas" icon="swap-vertical" />
    <Text className="text-sm text-cardForeground dark:text-cardForegroundDark">Registre apenas valores que ainda não foram incluídos no saldo informado da conta.</Text>
    {loading ? <Text className="text-cardForeground dark:text-cardForegroundDark">Carregando...</Text> : <>
      <Card><CardHeader><CardTitle>Registrar entrada ou saída</CardTitle></CardHeader><CardContent className="gap-3">
        {accounts.length === 0 ? <Text className="text-cardForeground dark:text-cardForegroundDark">Cadastre uma conta em Contas e saldos antes de registrar movimentações.</Text> : <>
          <View><Label>Tipo</Label><Select value={kind} options={kindOptions} onValueChange={value => { setKind(value as CashKind); setSource(""); }} /></View>
          <View><Label>Conta</Label><Select value={account} onValueChange={setAccount} options={accounts.map(item => ({ value: String(item.account_id), label: `${item.name} · ${item.holder_name}` }))} placeholder="Escolha a conta" /></View>
          <View><Label>{kind === "income" ? "Receita" : kind === "expense" ? "Despesa" : "Cartão"}</Label><Select value={source} onValueChange={value => { setSource(value); if (kind === "expense") { const planned = costs.find(item => String(item.id) === value)?.plannedAccountId; if (planned) setAccount(String(planned)); } }} options={options} placeholder="Escolha um lançamento" />{options.length === 0 && <Text className="text-cardForeground dark:text-cardForegroundDark">Nenhuma opção cadastrada.</Text>}</View>
          <View><Label>{kind === "statement" ? "Mês de fechamento (AAAA-MM)" : "Mês de referência (AAAA-MM)"}</Label><Input value={month} onChangeText={setMonth} placeholder="2026-11" /></View>
          {!!source && <Text className="text-sm text-cardForeground dark:text-cardForegroundDark">{sourceTotalError ? `Não foi possível consultar: ${sourceTotalError}` : sourceTotal === null ? "Consultando total já registrado..." : `Total já registrado nesta referência: ${money(sourceTotal)}`}</Text>}
          {kind === "income" && !!source && <View className="gap-2"><Label>Receita prevista neste mês (R$)</Label><Input keyboardType="decimal-pad" value={expectedAmount} onChangeText={setExpectedAmount} /><Button variant="outline" disabled={busy || sourceTotal === null || !!sourceTotalError} onPress={saveExpected}>Alterar previsão deste mês</Button><Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">A alteração não registra recebimento nem muda os outros meses.</Text></View>}
          <View><Label>Data efetiva (AAAA-MM-DD)</Label><Input value={date} onChangeText={setDate} placeholder="2026-11-27" /></View>
          <View><Label>Valor efetivo (R$)</Label><Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="Ex.: 150,00" /></View>
          <View><Label>Observação (opcional)</Label><Input maxLength={500} value={note} onChangeText={setNote} /></View>
          <Button disabled={busy || sourceTotal === null || !!sourceTotalError} onPress={submit}>Registrar movimentação</Button>
        </>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Últimas 200 movimentações</CardTitle></CardHeader><CardContent className="gap-3">{movements.length === 0 ? <Text className="text-cardForeground dark:text-cardForegroundDark">Nenhuma movimentação registrada.</Text> : movements.map(item => <View key={item.movement_id} className="gap-2 rounded-xl border border-border p-3 dark:border-borderDark">
        <Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">{labels[item.kind]} · {sourceLabel(item)}</Text>
        <Text className="text-sm text-cardForeground dark:text-cardForegroundDark">{item.effective_date.split("-").reverse().join("/")} · {accounts.find(a => a.account_id === item.account_id)?.name ?? "Conta"}{item.source_month ? ` · referência ${item.source_month.slice(0, 7)}` : ""}{item.reversed ? " · Estornada" : ""}</Text>
        <Text className="font-bold text-cardForeground dark:text-cardForegroundDark">{money(item.signed_amount)}</Text>
        {item.note && <Text className="text-cardForeground dark:text-cardForegroundDark">{item.note}</Text>}
        {item.kind !== "reversal" && !item.reversed && <Button variant="outline" disabled={busy} onPress={() => reverse(item)}>Estornar</Button>}
      </View>)}</CardContent></Card>
    </>}
  </ScrollView>;
}
