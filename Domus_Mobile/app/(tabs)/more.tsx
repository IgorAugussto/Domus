import { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MenuRow } from "@/components/ui/MenuRow";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useAuth } from "@/hooks/use-auth";

export default function MoreScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      Alert.alert("Não foi possível sair", "Tente novamente.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Mais" subtitle={user?.email} icon="apps" />

      <Card>
        <CardHeader><CardTitle>Financeiro</CardTitle></CardHeader>
        <CardContent className="gap-1">
          <MenuRow title="Investimentos" description="Acompanhe sua carteira e rentabilidade" icon="trending-up" color="#f59e0b" backgroundClassName="bg-financial-investmentLight dark:bg-financial-investmentLightDark" onPress={() => router.push("./investments")} />
          <MenuRow title="Cartões e faturas" description="Cadastre cartões e prepare a conferência da fatura" icon="card" color="#3b82f6" onPress={() => router.push("./cards")} />
          <MenuRow title="Conferir fatura" description="Compare a fatura do banco com os seus lançamentos" icon="receipt" color="#16a34a" onPress={() => router.push("./statements")} />
          <MenuRow title="Revisar capturas" description="Confira compras recebidas por notificação" icon="checkmark-done" color="#3b82f6" onPress={() => router.push("./review")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Utilitários</CardTitle></CardHeader>
        <CardContent className="gap-1">
          <MenuRow title="Ferramentas de desenvolvimento" description="Configure a captura e teste notificações" icon="flask" color="#d97706" backgroundClassName="bg-amber-100 dark:bg-amber-900/30" onPress={() => router.push("./notification-lab")} />
          <Text className="px-3 pt-1 text-xs text-mutedForeground dark:text-mutedForegroundDark">As simulações ficam isoladas e não interferem no fluxo financeiro normal.</Text>
        </CardContent>
      </Card>

      <Button variant="destructive" disabled={loggingOut} onPress={handleLogout}>{loggingOut ? "Saindo..." : "Sair"}</Button>
    </ScrollView>
  );
}
