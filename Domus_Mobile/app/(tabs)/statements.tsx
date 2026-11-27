import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { cardStatementService, type CardStatementItem, type ReconciledStatement } from "@/services/cardStatementService";
import { creditCardService, type CreditCard } from "@/services/creditCardService";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const currentMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
const addMonths = (yearMonth: string, offset: number) => { const [year, month] = yearMonth.split("-").map(Number); const date = new Date(year, month - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const monthLabel = (yearMonth: string) => `${MONTH_NAMES[Number(yearMonth.slice(5)) - 1]} ${yearMonth.slice(0, 4)}`;
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const parseCurrency = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

export default function StatementsScreen() {
  const router = useRouter();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [yearMonth, setYearMonth] = useState(currentMonth());
  const [items, setItems] = useState<CardStatementItem[]>([]);
  const [bankTotal, setBankTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ReconciledStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedCard = cards.find((card) => String(card.id) === selectedCardId);
  const calculatedTotal = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const registeredCards = await creditCardService.getAll();
      setCards(registeredCards);
      setSelectedCardId((current) => current || (registeredCards[0] ? String(registeredCards[0].id) : ""));
    } catch {
      Alert.alert("Não foi possível carregar cartões", "Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const preview = useCallback(async () => {
    if (!selectedCardId) return;
    setPreviewing(true);
    setResult(null);
    try {
      setItems(await cardStatementService.preview(Number(selectedCardId), yearMonth));
    } catch (error) {
      setItems([]);
      Alert.alert("Não foi possível calcular a fatura", error instanceof Error ? error.message : "Verifique o cartão e tente novamente.");
    } finally {
      setPreviewing(false);
    }
  }, [selectedCardId, yearMonth]);

  useEffect(() => { preview(); }, [preview]);

  const reconcile = async () => {
    const total = parseCurrency(bankTotal);
    if (!Number.isFinite(total) || total < 0) {
      Alert.alert("Total inválido", "Informe o total exibido pelo banco, por exemplo: 123,45.");
      return;
    }
    if (!selectedCardId) return;
    setSaving(true);
    try {
      const saved = await cardStatementService.reconcile(Number(selectedCardId), yearMonth, total, notes);
      setResult(saved);
      Alert.alert(saved.reconciliationStatus === "reconciled" ? "Fatura conferida" : "Fatura com diferença", saved.reconciliationStatus === "reconciled" ? "O total calculado é igual ao informado pelo banco." : `Diferença: ${currency(saved.difference)}. Revise os lançamentos antes de marcar a fatura como paga.`);
    } catch (error) {
      Alert.alert("Não foi possível salvar a conferência", error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-white dark:bg-slate-900"><ActivityIndicator size="large" /></View>;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Conferir fatura" subtitle="Compare o total calculado com o valor informado pelo banco" icon="receipt" />

      {cards.length === 0 ? <Card><CardContent className="gap-2 py-8"><Text className="text-center font-semibold text-cardForeground dark:text-cardForegroundDark">Cadastre um cartão antes de conferir uma fatura.</Text><Text className="text-center text-sm text-mutedForeground dark:text-mutedForegroundDark">Em Cartões e faturas, informe ao menos o dia de fechamento.</Text></CardContent></Card> : <>
        <Card><CardContent className="gap-3 pt-4">
          <Select value={selectedCardId} onValueChange={setSelectedCardId} options={cards.map((card) => ({ label: `${card.nickname?.trim() || card.brand} •••• ${card.lastFourDigits}`, value: String(card.id) }))} placeholder="Selecionar cartão" />
          <View className="flex-row items-center justify-between"><Pressable className="rounded-lg border border-border px-3 py-2 dark:border-borderDark" onPress={() => setYearMonth((current) => addMonths(current, -1))}><Text className="text-sm text-cardForeground dark:text-cardForegroundDark">← Anterior</Text></Pressable><Text className="font-semibold text-financial-trust dark:text-financial-trustDark">{monthLabel(yearMonth)}</Text><Pressable className="rounded-lg border border-border px-3 py-2 dark:border-borderDark" onPress={() => setYearMonth((current) => addMonths(current, 1))}><Text className="text-sm text-cardForeground dark:text-cardForegroundDark">Próximo →</Text></Pressable></View>
          <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{selectedCard?.statementClosingDay ? `Ciclo: a partir do fechamento anterior até a véspera do fechamento deste mês.` : "Este cartão ainda não possui dia de fechamento cadastrado."}</Text>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Prévia calculada</CardTitle></CardHeader><CardContent className="gap-3">
          {previewing ? <ActivityIndicator /> : <><View className="flex-row items-end justify-between"><Text className="text-sm text-mutedForeground dark:text-mutedForegroundDark">{items.length} lançamento(s) no ciclo</Text><Text className="text-xl font-bold text-cardForeground dark:text-cardForegroundDark">{currency(calculatedTotal)}</Text></View>{items.length === 0 ? <Text className="text-sm text-mutedForeground dark:text-mutedForegroundDark">Nenhuma despesa deste cartão foi encontrada neste ciclo.</Text> : items.map((item) => <View key={`${item.outgoingId}-${item.transactionDate}`} className="flex-row justify-between gap-3 border-t border-border pt-2 dark:border-borderDark"><View className="flex-1"><Text className="text-sm text-cardForeground dark:text-cardForegroundDark">{item.description}</Text><Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{new Date(`${item.transactionDate}T12:00:00`).toLocaleDateString("pt-BR")}</Text></View><Text className="font-medium text-cardForeground dark:text-cardForegroundDark">{currency(item.value)}</Text></View>)}</>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Valor do banco</CardTitle></CardHeader><CardContent className="gap-3"><Input value={bankTotal} onChangeText={setBankTotal} keyboardType="decimal-pad" placeholder="Ex. 123,45" /><Input value={notes} onChangeText={setNotes} placeholder="Observação (opcional)" /><Button onPress={reconcile} disabled={saving || previewing}>{saving ? "Salvando..." : "Conferir e salvar"}</Button><Button variant="outline" onPress={() => router.push({ pathname: "./cash-movements", params: { kind: "statement", source: selectedCardId, month: yearMonth } })}>Registrar pagamento da fatura</Button>{result && <Text className={result.reconciliationStatus === "reconciled" ? "text-sm text-financial-success dark:text-financial-successDark" : "text-sm text-financial-danger dark:text-financial-dangerDark"}>{result.reconciliationStatus === "reconciled" ? "Conferida: os valores coincidem." : `Diferença registrada: ${currency(result.difference)}.`}</Text>}<Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Conferir uma fatura não a marca como paga. O pagamento continua sendo controlado separadamente.</Text></CardContent></Card>
      </>}
    </ScrollView>
  );
}
