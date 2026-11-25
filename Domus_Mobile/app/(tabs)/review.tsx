import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Select } from "@/components/ui/Select";
import { creditCardService, type CreditCard } from "@/services/creditCardService";
import { notificationReviewService, type NotificationReviewItem } from "@/services/notificationReviewService";

const sourceLabel: Record<string, string> = {
  google_wallet: "Carteira do Google",
  nubank: "Nubank",
  whatsapp: "WhatsApp (teste)",
  manual_test: "Simulador Domus",
};

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string | null) => value
  ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  : "Horário não informado";

export default function NotificationReviewScreen() {
  const [items, setItems] = useState<NotificationReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, registeredCards] = await Promise.all([notificationReviewService.getPending(), creditCardService.getAll()]);
      setItems(pending);
      setCards(registeredCards);
      setSelectedCards(Object.fromEntries(pending.map((item) => [item.id, item.creditCardId ? String(item.creditCardId) : ""])));
    } catch {
      setError("Não foi possível carregar os lançamentos capturados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markReviewed = async (id: number) => {
    setReviewingId(id);
    setError(null);
    try {
      await notificationReviewService.markReviewed(id, selectedCards[id] ? Number(selectedCards[id]) : undefined);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Não foi possível confirmar o lançamento.");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1"><ScreenHeader title="Revisar capturas" subtitle="Confirme lançamentos vindos das notificações" icon="checkmark-done" /></View>
        <Button variant="outline" size="sm" onPress={load} disabled={loading}>
          <Ionicons name="refresh" size={18} color="#3b82f6" />
          <Text className="text-sm font-semibold text-cardForeground dark:text-cardForegroundDark">Atualizar</Text>
        </Button>
      </View>

      {error && <Text className="rounded-lg bg-red-50 p-3 text-sm text-financial-danger dark:bg-red-950">{error}</Text>}
      {loading ? (
        <View className="items-center gap-3 py-12"><ActivityIndicator size="large" /><Text className="text-mutedForeground dark:text-mutedForegroundDark">Carregando capturas...</Text></View>
      ) : items.length === 0 ? (
        <Card><CardContent className="items-center gap-2 py-10"><Ionicons name="checkmark-circle" size={32} color="#16a34a" /><Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">Nenhum lançamento pendente.</Text><Text className="text-center text-sm text-mutedForeground dark:text-mutedForegroundDark">As notificações sincronizadas aparecerão aqui.</Text></CardContent></Card>
      ) : items.map((item) => (
        <Card key={item.id} className="border-amber-200 dark:border-amber-900">
          <CardHeader className="gap-2">
            <View className="flex-row items-start justify-between gap-3"><CardTitle className="flex-1">{item.description}</CardTitle><Text className="font-bold text-financial-danger dark:text-financial-dangerDark">{currency(item.value)}</Text></View>
            <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{dateTime(item.purchaseAt ?? item.createdAt)} · {item.category}{item.simulated ? " · SIMULADA" : ""}</Text>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800"><Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Fonte{item.sources.length === 1 ? "" : "s"}: {item.sources.map((source) => sourceLabel[source] ?? source).join(", ") || "não identificada"}{item.eventCount > 1 ? ` · ${item.eventCount} notificações corroboraram esta compra` : ""}</Text></View>
            {cards.length > 0 && <View className="gap-1"><Text className="text-xs font-medium text-cardForeground dark:text-cardForegroundDark">Cartão da compra (opcional)</Text><Select value={selectedCards[item.id] ?? ""} onValueChange={(value) => setSelectedCards((current) => ({ ...current, [item.id]: value }))} options={[{ label: "Não associar agora", value: "" }, ...cards.map((card) => ({ label: `${card.nickname?.trim() || card.brand} •••• ${card.lastFourDigits}`, value: String(card.id) }))]} placeholder="Selecionar cartão" /></View>}
            <Button onPress={() => markReviewed(item.id)} disabled={reviewingId === item.id}>{reviewingId === item.id ? "Confirmando..." : "Confirmar lançamento"}</Button>
          </CardContent>
        </Card>
      ))}
    </ScrollView>
  );
}
