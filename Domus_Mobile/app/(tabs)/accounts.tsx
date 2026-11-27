import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { financialAccountService, balanceTotal, normalizeMoney, type FinancialAccount, type AccountAdjustment } from "@/services/financialAccountService";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const readableDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
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
    catch { setLoadFailed(true); Alert.alert("Não foi possível carregar as contas", "Confira sua conexão e tente novamente."); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    const value = normalizeMoney(opening);
    if (!name.trim() || !holder.trim() || value === null || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localToday()) { Alert.alert("Confira os dados", "Informe conta, titular, saldo e data válida."); return; }
    setBusy(true);
    try { await financialAccountService.create(name.trim(), holder.trim(), value, date); setName(""); setHolder(""); setOpening(""); setDate(localToday()); if (await load()) Alert.alert("Conta cadastrada"); }
    catch { Alert.alert("Não foi possível cadastrar", "Confira os dados e a conexão."); }
    finally { setBusy(false); }
  };
  const adjust = async () => {
    const value = normalizeMoney(amount);
    if (selected === null || value === null) { Alert.alert("Confira o saldo", "Use até duas casas decimais."); return; }
    setBusy(true);
    try {
      await financialAccountService.adjust(selected, value, note);
      setSelected(null); setAmount(""); setNote(""); setHistoryId(null);
      if (await load()) Alert.alert("Saldo atualizado", "O ajuste foi registrado no histórico.");
    } catch { Alert.alert("Não foi possível atualizar o saldo", "Tente novamente."); }
    finally { setBusy(false); }
  };
  const showHistory = async (id: number) => {
    if (historyId === id) { setHistoryId(null); return; }
    setHistoryId(null);
    try { setHistory(await financialAccountService.history(id)); setHistoryId(id); }
    catch { Alert.alert("Não foi possível carregar o histórico"); }
  };
  const total = balanceTotal(accounts);
  return <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
    <ScreenHeader title="Contas e saldos" subtitle="Saldos informados por você" icon="wallet" />
    <Text className="text-sm text-cardForeground dark:text-cardForegroundDark">Pagamentos e recebimentos ainda não atualizam estes saldos automaticamente.</Text>
    <Card><CardHeader><CardTitle>Saldo conjunto informado</CardTitle></CardHeader><CardContent><Text className="text-cardForeground dark:text-cardForegroundDark">{loading ? "Carregando..." : loadFailed ? "Não foi possível carregar o saldo." : accounts.length === 0 ? "Cadastre uma conta para começar." : total === null ? "Total indisponível" : money(total)}</Text></CardContent></Card>
    <Card><CardHeader><CardTitle>Cadastrar conta</CardTitle></CardHeader><CardContent className="gap-3">
      <View><Label>Nome da conta</Label><Input value={name} onChangeText={setName} maxLength={100} /></View>
      <View><Label>Titular</Label><Input value={holder} onChangeText={setHolder} maxLength={100} /></View>
      <View><Label>Saldo informado (R$)</Label><Input keyboardType="decimal-pad" placeholder="Ex.: 1000,50" value={opening} onChangeText={setOpening} /></View>
      <View><Label>Data desse saldo (AAAA-MM-DD)</Label><Input value={date} onChangeText={setDate} placeholder="2026-01-31" /></View>
      <Button disabled={busy} onPress={create}>Cadastrar conta</Button>
    </CardContent></Card>
    {accounts.map(account => <Card key={account.account_id}><CardHeader><CardTitle>{account.name} · {account.holder_name}</CardTitle></CardHeader><CardContent className="gap-3">
      <Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">Saldo informado: {money(Number(account.balance))}</Text>
      <Text className="text-sm text-mutedForeground dark:text-mutedForegroundDark">Data do saldo inicial: {readableDate(account.opening_date)} · Último registro: {new Date(account.confirmed_at).toLocaleString("pt-BR")}</Text>
      <Button variant="outline" onPress={() => { setSelected(account.account_id); setAmount(account.balance); setNote(""); }}>Atualizar saldo</Button>
      <Button variant="outline" onPress={() => void showHistory(account.account_id)}>{historyId === account.account_id ? "Ocultar histórico" : "Ver histórico"}</Button>
      {selected === account.account_id && <View className="gap-2"><Label>Saldo confirmado no banco (R$)</Label><Input keyboardType="decimal-pad" value={amount} onChangeText={setAmount} /><Label>Observação (opcional)</Label><Input value={note} onChangeText={setNote} maxLength={500} /><Button disabled={busy} onPress={adjust}>Salvar ajuste</Button><Button variant="outline" onPress={() => setSelected(null)}>Cancelar</Button></View>}
      {historyId === account.account_id && <View className="gap-1"><Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">Últimos 20 ajustes</Text>{history.length === 0 ? <Text>Nenhum ajuste registrado.</Text> : history.map(item => <Text key={item.adjustment_id} className="text-sm text-cardForeground dark:text-cardForegroundDark">{new Date(item.created_at).toLocaleString("pt-BR")} · {money(Number(item.delta))} · saldo {money(Number(item.confirmed_balance))}{item.note ? ` · ${item.note}` : ""}</Text>)}</View>}
    </CardContent></Card>)}
  </ScrollView>;
}
