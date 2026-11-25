import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  configureNativeListener,
  drainNativeEvents,
  hasNotificationAccess,
  nativeListenerAvailable,
  openNotificationAccessSettings,
  requestCaptureRefresh,
} from "@/src/poc/notificationListener";
import { isSamePurchase, parseNotification } from "@/src/poc/notificationParser";
import {
  clearPocRecords,
  DEFAULT_SETTINGS,
  loadPocRecords,
  loadPocSettings,
  savePocRecords,
  savePocSettings,
} from "@/src/poc/notificationStore";
import type { PocSettings, PocSource, PocTransaction } from "@/src/poc/notificationTypes";
import { notificationSyncErrorMessage, syncNotificationRecord } from "@/src/poc/notificationSync";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const SOURCE_OPTIONS: { key: PocSource; label: string; packageName: string; testOnly?: boolean }[] = [
  { key: "simulator", label: "Simulador Domus", packageName: "domus.simulator" },
  { key: "google_wallet", label: "Carteira do Google", packageName: "com.google.android.apps.walletnfcrel" },
  { key: "nubank", label: "Nubank", packageName: "com.nu.production" },
  { key: "whatsapp", label: "WhatsApp (somente teste)", packageName: "com.whatsapp", testOnly: true },
];

const FORMAT_OPTIONS = [
  { label: "Carteira do Google", value: "google_wallet" },
  { label: "Nubank", value: "nubank" },
];

const currency = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatAmountInput(value: string): string {
  return value.replace(/[^\d,\.]/g, "");
}

function amountToCents(value: string): number | null {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function amountText(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function NotificationLabScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<PocSettings>(DEFAULT_SETTINGS);
  const [records, setRecords] = useState<PocTransaction[]>([]);
  const [accessGranted, setAccessGranted] = useState(false);
  const [amount, setAmount] = useState("12,90");
  const [merchant, setMerchant] = useState("LOJAS AUT");
  const [time, setTime] = useState(currentTime());
  const [lastFour, setLastFour] = useState("6156");
  const [format, setFormat] = useState("google_wallet");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [savedSettings, savedRecords] = await Promise.all([loadPocSettings(), loadPocRecords()]);
    setSettings(savedSettings);
    setRecords(savedRecords);
    configureNativeListener(savedSettings);
    if (savedSettings.captureEnabled) requestCaptureRefresh();
    setAccessGranted(hasNotificationAccess());
  }, []);

  const processNativeEvents = useCallback(async () => {
    const events = drainNativeEvents();
    if (events.length === 0) return;

    const current = await loadPocRecords();
    for (const event of events) {
      if (current.some((record) => record.id === event.id)) continue;
      const parsed = parseNotification(event);
      if (!parsed) continue;

      const duplicate = current.find((record) => isSamePurchase(record, parsed));
      if (duplicate) {
        duplicate.duplicateCount += 1;
        current.unshift({
          ...parsed,
          id: event.id,
          status: "duplicate",
          duplicateOf: duplicate.id,
          duplicateCount: 0,
          syncStatus: "local",
        });
      } else {
        current.unshift({
          ...parsed,
          id: event.id,
          status: "accepted",
          duplicateCount: 0,
          syncStatus: "local",
        });
      }
      await savePocRecords(current);
    }
    setRecords(current);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(processNativeEvents, 1500);
    return () => clearInterval(timer);
  }, [processNativeEvents, refresh]);

  const persistSettings = async (next: PocSettings, refreshListener = false) => {
    setSettings(next);
    await savePocSettings(next);
    configureNativeListener(next);
    if (refreshListener && next.captureEnabled) requestCaptureRefresh();
  };

  const toggleSource = async (source: PocSource) => {
    const nextSources = settings.monitoredSources.includes(source)
      ? settings.monitoredSources.filter((item) => item !== source)
      : [...settings.monitoredSources, source];
    const next = { ...settings, monitoredSources: nextSources };
    await persistSettings(next, true);
  };

  const toggleCapture = async () => {
    await persistSettings({ ...settings, captureEnabled: !settings.captureEnabled }, true);
  };

  const toggleTestMode = async () => {
    const next = { ...settings, testMode: !settings.testMode };
    await persistSettings(next, true);
  };

  const postLocalNotification = async (source: string, notificationTitle: string, notificationBody: string) => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("domus-poc", {
        name: "Domus POC",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      if (requested.status !== "granted") {
        throw new Error("Permissão para notificações locais não concedida");
      }
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: { domusPoc: true, simulatedSource: source },
      },
      trigger: Platform.OS === "android"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            repeats: false,
            channelId: "domus-poc",
          }
        : null,
    });
  };

  const simulate = async (duplicatePair: boolean, distinctPurchase: boolean) => {
    const amountCents = amountToCents(amount);
    const cleanLastFour = lastFour.replace(/\D/g, "").slice(-4);
    if (!settings.testMode) {
      Alert.alert("Modo de testes desativado", "Ative o modo de testes antes de emitir uma simulação.");
      return;
    }
    if (!settings.captureEnabled) {
      Alert.alert("Captura desativada", "Ative a captura de notificações antes de emitir uma simulação.");
      return;
    }
    if (!amountCents || !merchant.trim() || cleanLastFour.length !== 4) {
      Alert.alert("Dados incompletos", "Informe valor, estabelecimento e exatamente quatro dígitos do cartão.");
      return;
    }
    setBusy(true);
    try {
      const simulatedMerchant = distinctPurchase ? `${merchant.trim()} EXPRESS` : merchant.trim();
      const simulatedAmount = amountText(amountCents);
      const selectedFormat = duplicatePair ? "google_wallet" : format;

      if (selectedFormat === "google_wallet") {
        await postLocalNotification(
          selectedFormat,
          simulatedMerchant,
          `R$ ${simulatedAmount} com Nubank Mastercard Platinum ••${cleanLastFour} às ${time}`,
        );
      } else {
        await postLocalNotification(
          selectedFormat,
          "Compra no crédito aprovada",
          `Compra de R$ ${simulatedAmount} APROVADA em ${simulatedMerchant} para o cartão com final ${cleanLastFour} às ${time}`,
        );
      }

      if (duplicatePair) {
        await postLocalNotification(
          "nubank",
          "Compra no crédito aprovada",
          `Compra de R$ ${simulatedAmount} APROVADA em ${simulatedMerchant} para o cartão com final ${cleanLastFour} às ${time}`,
        );
      }
      setTimeout(processNativeEvents, 700);
    } finally {
      setBusy(false);
    }
  };

  const clearRecords = () => {
    Alert.alert("Limpar registros locais?", "Somente os dados da POC neste dispositivo serão removidos.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: async () => {
          await clearPocRecords();
          setRecords([]);
        },
      },
    ]);
  };

  const syncPendingRecords = async () => {
    const current = await loadPocRecords();
    const pending = current.filter((record) => record.syncStatus !== "synced");
    if (pending.length === 0) {
      Alert.alert("Sincronização", "Não há registros pendentes.");
      return;
    }

    setSyncing(true);
    let synced = 0;
    for (const record of pending) {
      record.syncStatus = "syncing";
      record.syncError = undefined;
      await savePocRecords(current);
      try {
        const result = await syncNotificationRecord(record);
        record.syncStatus = "synced";
        record.remoteEventId = result.event_id;
        record.remoteOutgoingId = result.outgoing_id ?? undefined;
        record.remotelyDeduplicated = result.deduplicated;
        synced += 1;
      } catch (error) {
        record.syncStatus = "failed";
        record.syncError = notificationSyncErrorMessage(error);
        console.error("Falha ao sincronizar captura", { eventId: record.id, error: record.syncError });
      }
      await savePocRecords(current);
    }
    setRecords([...current]);
    setSyncing(false);
    Alert.alert("Sincronização concluída", `${synced} de ${pending.length} registro(s) enviados.`);
  };

  const simulatedCount = useMemo(() => records.filter((record) => record.origin === "simulated").length, [records]);
  const realCount = records.length - simulatedCount;
  const pendingSyncCount = records.filter((record) => record.syncStatus !== "synced").length;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Ferramentas de desenvolvimento" subtitle="Teste de captura; sincronização manual envia somente dados normalizados" icon="flask" color="#d97706" backgroundClassName="bg-amber-100 dark:bg-amber-900/30" />

      <Card>
        <CardHeader><CardTitle>Captura e modo de testes</CardTitle></CardHeader>
        <CardContent className="gap-3">
          <Pressable onPress={toggleCapture} className="flex-row items-center justify-between rounded-lg border border-border dark:border-borderDark p-3">
            <View className="flex-1 pr-3">
              <Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">Captura de notificações</Text>
              <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Necessária para Google Wallet e Nubank</Text>
            </View>
            <View className={`h-7 w-12 rounded-full p-1 ${settings.captureEnabled ? "bg-financial-success" : "bg-slate-300 dark:bg-slate-700"}`}>
              <View className={`h-5 w-5 rounded-full bg-white ${settings.captureEnabled ? "ml-5" : "ml-0"}`} />
            </View>
          </Pressable>
          <Pressable onPress={toggleTestMode} className="flex-row items-center justify-between rounded-lg border border-border dark:border-borderDark p-3">
            <View className="flex-1 pr-3">
              <Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">Modo de testes</Text>
              <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Usado somente para simulações e WhatsApp</Text>
            </View>
            <View className={`h-7 w-12 rounded-full p-1 ${settings.testMode ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"}`}>
              <View className={`h-5 w-5 rounded-full bg-white ${settings.testMode ? "ml-5" : "ml-0"}`} />
            </View>
          </Pressable>

          <Text className="font-semibold text-cardForeground dark:text-cardForegroundDark">Aplicativos monitorados</Text>
          {settings.captureEnabled && accessGranted && (
            <Text className="text-xs text-financial-success dark:text-financial-successDark">
              Notificações ainda visíveis serão verificadas ao atualizar a captura.
            </Text>
          )}
          {SOURCE_OPTIONS.map((option) => {
            const selected = settings.monitoredSources.includes(option.key);
            const disabled = option.testOnly && !settings.testMode;
            return (
              <Pressable
                key={option.key}
                disabled={disabled}
                onPress={() => toggleSource(option.key)}
                className={`flex-row items-center gap-3 rounded-lg border p-3 ${disabled ? "opacity-40" : "border-border dark:border-borderDark"}`}
              >
                <Ionicons name={selected && !disabled ? "checkbox" : "square-outline"} size={22} color={selected && !disabled ? "#d97706" : "#94a3b8"} />
                <View className="flex-1">
                  <Text className="text-cardForeground dark:text-cardForegroundDark">{option.label}</Text>
                  <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{option.packageName}</Text>
                </View>
              </Pressable>
            );
          })}

          {nativeListenerAvailable() ? (
            <>
              <Text className="text-sm text-mutedForeground dark:text-mutedForegroundDark">
                Acesso ao NotificationListenerService: {accessGranted ? "concedido" : "não concedido"}
              </Text>
              <Button variant="outline" onPress={() => { openNotificationAccessSettings(); setTimeout(() => setAccessGranted(hasNotificationAccess()), 1000); }}>
                Abrir acesso às notificações
              </Button>
            </>
          ) : (
            <Text className="text-sm text-amber-700 dark:text-amber-300">O listener nativo exige Android e development build.</Text>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Simular notificação financeira</CardTitle></CardHeader>
        <CardContent className="gap-3">
          <Text className="text-xs text-amber-700 dark:text-amber-300">As notificações abaixo são reais no Android, mas marcadas como SIMULADAS e processadas somente localmente.</Text>
          <View><Text className="mb-1 text-sm text-cardForeground dark:text-cardForegroundDark">Formato</Text><Select value={format} onValueChange={setFormat} options={FORMAT_OPTIONS} /></View>
          <View><Text className="mb-1 text-sm text-cardForeground dark:text-cardForegroundDark">Valor</Text><Input value={amount} onChangeText={(value) => setAmount(formatAmountInput(value))} keyboardType="decimal-pad" /></View>
          <View><Text className="mb-1 text-sm text-cardForeground dark:text-cardForegroundDark">Estabelecimento</Text><Input value={merchant} onChangeText={setMerchant} /></View>
          <View><Text className="mb-1 text-sm text-cardForeground dark:text-cardForegroundDark">Horário (HH:mm)</Text><Input value={time} onChangeText={setTime} /></View>
          <View><Text className="mb-1 text-sm text-cardForeground dark:text-cardForegroundDark">Final do cartão</Text><Input value={lastFour} onChangeText={setLastFour} keyboardType="number-pad" maxLength={4} /></View>
          <Button disabled={busy || !settings.testMode || !settings.captureEnabled} onPress={() => simulate(false, false)}>{busy ? "Emitindo..." : "Emitir notificação simulada"}</Button>
          <Button variant="outline" disabled={busy || !settings.testMode || !settings.captureEnabled} onPress={() => simulate(true, false)}>Simular a mesma compra em Wallet + Nubank</Button>
          <Button variant="outline" disabled={busy || !settings.testMode || !settings.captureEnabled} onPress={() => simulate(false, true)}>Simular compra distinta com mesmo valor</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between gap-2"><CardTitle>Registros locais</CardTitle><View className="flex-row gap-2"><Button size="sm" variant="outline" disabled={syncing || pendingSyncCount === 0} onPress={syncPendingRecords}>{syncing ? "Sincronizando..." : `Sincronizar (${pendingSyncCount})`}</Button><Button size="sm" variant="ghost" onPress={clearRecords}>Limpar</Button></View></View>
        </CardHeader>
        <CardContent className="gap-3">
          <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Simulados: {simulatedCount} · Reais: {realCount} · Total: {records.length} · Pendentes de envio: {pendingSyncCount}</Text>
          <Button variant="outline" onPress={() => router.push("./review")}>Revisar lançamentos sincronizados</Button>
          {records.length === 0 ? <Text className="py-4 text-center text-mutedForeground dark:text-mutedForegroundDark">Nenhuma notificação financeira capturada.</Text> : records.map((record) => (
            <View key={record.id} className="rounded-lg border border-border dark:border-borderDark p-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-semibold text-cardForeground dark:text-cardForegroundDark">{record.merchant}</Text>
                <Text className="font-bold text-financial-danger dark:text-financial-dangerDark">{currency(record.amountCents)}</Text>
              </View>
              <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{record.origin === "simulated" ? "SIMULADA" : "REAL"} · {record.source} · final {record.cardLastFour ?? "----"}</Text>
              <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{new Date(record.occurredAt).toLocaleString("pt-BR")} · local: {record.status === "duplicate" ? "POSSÍVEL DUPLICATA" : "ACEITA"} · duplicidades: {record.duplicateCount}</Text>
              <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">Envio: {record.syncStatus ?? "local"}{record.remotelyDeduplicated ? " · duplicada no banco" : ""}{record.syncError ? ` · ${record.syncError}` : ""}</Text>
            </View>
          ))}
        </CardContent>
      </Card>
    </ScrollView>
  );
}
