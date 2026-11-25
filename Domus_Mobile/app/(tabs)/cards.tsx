import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { creditCardService, type CardAlias, type CreditCard } from "@/services/creditCardService";

const BRAND_OPTIONS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outro"].map((brand) => ({ label: brand, value: brand }));
const ALIAS_KIND_OPTIONS = [
  { label: "Final de cartão virtual", value: "virtual" },
  { label: "Token / carteira digital", value: "token" },
  { label: "Identificador manual", value: "manual" },
] as const;

const cardLabel = (card: CreditCard) => `${card.nickname?.trim() || card.brand} •••• ${card.lastFourDigits}`;

export default function CardsScreen() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [aliases, setAliases] = useState<Record<number, CardAlias[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [nickname, setNickname] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [aliasDrafts, setAliasDrafts] = useState<Record<number, string>>({});
  const [aliasKinds, setAliasKinds] = useState<Record<number, CardAlias["aliasKind"]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextCards = await creditCardService.getAll();
      setCards(nextCards);
      const nextAliases = await Promise.all(nextCards.map(async (card) => [card.id, await creditCardService.getAliases(card.id)] as const));
      setAliases(Object.fromEntries(nextAliases));
    } catch {
      Alert.alert("Não foi possível carregar cartões", "Confira sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCard = async () => {
    if (!brand || !/^\d{4}$/.test(lastFour)) {
      Alert.alert("Dados incompletos", "Selecione a bandeira e informe os 4 últimos dígitos.");
      return;
    }
    setSaving(true);
    try {
      await creditCardService.create({
        brand,
        lastFourDigits: lastFour,
        nickname,
        statementClosingDay: closingDay ? Number(closingDay) : undefined,
        dueDay: dueDay ? Number(dueDay) : undefined,
      });
      setBrand(""); setLastFour(""); setNickname(""); setClosingDay(""); setDueDay("");
      await load();
    } catch (error) {
      Alert.alert("Não foi possível cadastrar", error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const addAlias = async (cardId: number) => {
    const alias = aliasDrafts[cardId] ?? "";
    try {
      await creditCardService.addAlias(cardId, alias, aliasKinds[cardId] ?? "token");
      setAliasDrafts((current) => ({ ...current, [cardId]: "" }));
      const cardAliases = await creditCardService.getAliases(cardId);
      setAliases((current) => ({ ...current, [cardId]: cardAliases }));
    } catch (error) {
      Alert.alert("Não foi possível salvar o identificador", error instanceof Error ? error.message : "Tente novamente.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Cartões e faturas" subtitle="Cadastre ciclos para conferir suas próximas faturas" icon="card" />

      <Card>
        <CardHeader><CardTitle>Novo cartão</CardTitle></CardHeader>
        <CardContent className="gap-3">
          <Select value={brand} onValueChange={setBrand} options={BRAND_OPTIONS} placeholder="Bandeira" />
          <Input value={lastFour} onChangeText={(value) => setLastFour(value.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="Últimos 4 dígitos" />
          <Input value={nickname} onChangeText={setNickname} placeholder="Apelido (opcional): Ex. Nubank" />
          <View className="flex-row gap-3">
            <View className="flex-1"><Input value={closingDay} onChangeText={(value) => setClosingDay(value.replace(/\D/g, "").slice(0, 2))} keyboardType="number-pad" maxLength={2} placeholder="Fechamento" /></View>
            <View className="flex-1"><Input value={dueDay} onChangeText={(value) => setDueDay(value.replace(/\D/g, "").slice(0, 2))} keyboardType="number-pad" maxLength={2} placeholder="Vencimento" /></View>
          </View>
          <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Fechamento e vencimento são opcionais agora, mas necessários para calcular uma fatura por ciclo.</Text>
          <Button onPress={createCard} disabled={saving}>{saving ? "Cadastrando..." : "Cadastrar cartão"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meus cartões</CardTitle></CardHeader>
        <CardContent className="gap-3">
          {loading ? <View className="items-center py-6"><ActivityIndicator /></View> : cards.length === 0 ? <Text className="text-center text-sm text-mutedForeground dark:text-mutedForegroundDark">Cadastre um cartão para associar compras e conferir faturas.</Text> : cards.map((card) => (
            <View key={card.id} className="gap-3 rounded-xl border border-border p-3 dark:border-borderDark">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1"><Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">{cardLabel(card)}</Text><Text className="mt-1 text-xs text-mutedForeground dark:text-mutedForegroundDark">{card.statementClosingDay ? `Fecha dia ${card.statementClosingDay}` : "Fechamento não informado"}{card.dueDay ? ` · vence dia ${card.dueDay}` : ""}</Text></View>
                <Ionicons name="card-outline" size={22} color="#3b82f6" />
              </View>
              {(aliases[card.id] ?? []).length > 0 && <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Identificadores: {(aliases[card.id] ?? []).map((alias) => alias.alias).join(", ")}</Text>}
              <Text className="text-xs font-medium text-cardForeground dark:text-cardForegroundDark">Adicionar final/token alternativo</Text>
              <Select value={aliasKinds[card.id] ?? "token"} onValueChange={(value) => setAliasKinds((current) => ({ ...current, [card.id]: value as CardAlias["aliasKind"] }))} options={[...ALIAS_KIND_OPTIONS]} placeholder="Tipo do identificador" />
              <View className="flex-row gap-2"><View className="flex-1"><Input value={aliasDrafts[card.id] ?? ""} onChangeText={(value) => setAliasDrafts((current) => ({ ...current, [card.id]: value }))} placeholder="Ex. 6156" maxLength={100} /></View><Button size="sm" variant="outline" onPress={() => addAlias(card.id)}>Adicionar</Button></View>
            </View>
          ))}
        </CardContent>
      </Card>
    </ScrollView>
  );
}
