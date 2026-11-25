import { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, Pressable, ScrollView } from "react-native";
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EditEntityModal } from "@/components/EditEntityModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { FeedbackToast } from "@/components/FeedbackToast";
import { incomeService, type Income } from "@/services/incomeService";
import { incomeCategoryLabels } from "@/utils/labels/incomeCategoryLabels";
import { incomeDescriptionLabel } from "@/utils/labels/incomeDescriptionLabel";
import { frequencyLabels } from "@/utils/labels/frequencyLabels";

const CATEGORY_OPTIONS = [
  { label: "Salário", value: "Salary" },
  { label: "Freelance", value: "Freelance" },
  { label: "Bônus", value: "Bonus" },
  { label: "Retorno de Investimentos", value: "Investment" },
  { label: "Presente", value: "Gift" },
  { label: "Outros", value: "Other" },
];

const FREQUENCY_OPTIONS = [
  { label: "Única", value: "One-time" },
  { label: "Mensal", value: "Monthly" },
];

const PERIOD_FILTER_OPTIONS = [{ label: "Todo o período", value: "ALL" }, { label: "Este mês", value: "CURRENT_MONTH" }, { label: "Mês anterior", value: "PREVIOUS_MONTH" }];
const FREQUENCY_FILTER_OPTIONS = [{ label: "Todas as frequências", value: "ALL" }, ...FREQUENCY_OPTIONS];

export default function IncomeScreen() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [frequency, setFrequency] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deletingIncome, setDeletingIncome] = useState<Income | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState("ALL");

  useEffect(() => {
    loadIncomes();
  }, []);

  useEffect(() => {
    if (category === "Salary" && !autoFilled) {
      setFrequency("Monthly");
      setAutoFilled(true);
    }
    if (category !== "Salary") {
      setAutoFilled(false);
    }
  }, [category, autoFilled]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadIncomes = async () => {
    try {
      const data = await incomeService.getAll();
      setIncomes(data);
    } catch (err) {
      console.error("Erro ao carregar incomes:", err);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !category || !date) {
      setToast({ message: "Preencha todos os campos", type: "error" });
      return;
    }

    try {
      await incomeService.create({
        description: description || category,
        amount: Number(amount),
        category,
        frequency,
        startDate: date,
        endDate: date,
        recurring: frequency !== "One-time",
      });

      await loadIncomes();
      setToast({ message: "Receita salva com sucesso", type: "success" });

      setAmount("");
      setCategory("");
      setDescription("");
      setFrequency("");
      setDate(dayjs().format("YYYY-MM-DD"));
    } catch (error) {
      console.error("Erro ao salvar receita:", error);
      setToast({ message: "Erro ao salvar receita. Tente novamente.", type: "error" });
    }
  };

  const handleDeleteIncome = async () => {
    if (!selectedIncome) return;
    try {
      await incomeService.delete(Number(selectedIncome.id));
      await loadIncomes();
      setShowDelete(false);
    } catch (error) {
      console.error("Erro ao deletar income:", error);
      setToast({ message: "Erro ao deletar renda.", type: "error" });
    }
  };

  const handleEditIncome = async (data: Record<string, unknown>) => {
    if (!editingIncome) return;
    try {
      await incomeService.update(Number(editingIncome.id), data);
      await loadIncomes();
      setShowEdit(false);
      setEditingIncome(null);
    } catch (error) {
      console.error("Erro ao editar income:", error);
      setToast({ message: "Erro ao editar renda.", type: "error" });
    }
  };

  const categoryFilterOptions = useMemo(() => [{ label: "Todas as categorias", value: "ALL" }, ...CATEGORY_OPTIONS], []);
  const filteredIncomes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return incomes.filter((income) => {
      const incomeDate = dayjs(income.startDate);
      return (!term || `${income.description} ${income.category}`.toLocaleLowerCase("pt-BR").includes(term))
        && (categoryFilter === "ALL" || income.category === categoryFilter)
        && (frequencyFilter === "ALL" || income.frequency === frequencyFilter)
        && (periodFilter === "ALL"
          || (periodFilter === "CURRENT_MONTH" && incomeDate.isSame(dayjs(), "month"))
          || (periodFilter === "PREVIOUS_MONTH" && incomeDate.isSame(dayjs().subtract(1, "month"), "month")));
    });
  }, [categoryFilter, frequencyFilter, incomes, periodFilter, search]);
  const hasActiveFilters = Boolean(search || periodFilter !== "ALL" || categoryFilter !== "ALL" || frequencyFilter !== "ALL");
  const clearFilters = () => { setSearch(""); setPeriodFilter("ALL"); setCategoryFilter("ALL"); setFrequencyFilter("ALL"); };

  return (
    <View className="flex-1 bg-white dark:bg-slate-900">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Receitas" subtitle="Registre e acompanhe suas entradas" icon="wallet" color="#10b981" backgroundClassName="bg-financial-incomeLight dark:bg-financial-incomeLightDark" />

        <Card>
          <CardHeader>
            <CardTitle>Nova Renda</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            <View>
              <Label>Valor</Label>
              <Input keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={setAmount} />
            </View>

            <View>
              <Label>Data (AAAA-MM-DD)</Label>
              <Input value={date} onChangeText={setDate} placeholder="2026-01-31" />
            </View>

            <View>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory} options={CATEGORY_OPTIONS} placeholder="Selecionar categoria" />
            </View>

            <View>
              <Label>Frequência</Label>
              <Select value={frequency} onValueChange={setFrequency} options={FREQUENCY_OPTIONS} placeholder="Selecionar frequência" />
            </View>

            <View>
              <Label>Descrição (opcional)</Label>
              <Textarea placeholder="Detalhes adicionais sobre a renda" value={description} onChangeText={setDescription} />
            </View>

            <Button
              onPress={handleSubmit}
              disabled={!amount || !category || !date}
              className="bg-financial-income dark:bg-financial-incomeDark"
            >
              Adicionar Renda
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <View className="flex-row items-center justify-between gap-3"><View className="flex-1"><CardTitle>Receitas</CardTitle><Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{filteredIncomes.length} de {incomes.length} lançamento(s)</Text></View>{hasActiveFilters && <Button size="sm" variant="ghost" onPress={clearFilters}>Limpar filtros</Button>}</View>
          </CardHeader>
          <CardContent className="gap-4">
            <Input value={search} onChangeText={setSearch} placeholder="Buscar descrição ou categoria" returnKeyType="search" />
            <View className="gap-3"><Select value={periodFilter} onValueChange={setPeriodFilter} options={PERIOD_FILTER_OPTIONS} placeholder="Período" /><Select value={categoryFilter} onValueChange={setCategoryFilter} options={categoryFilterOptions} placeholder="Categoria" /><Select value={frequencyFilter} onValueChange={setFrequencyFilter} options={FREQUENCY_FILTER_OPTIONS} placeholder="Frequência" /></View>
            {incomes.length === 0 ? (
              <Text className="text-center py-4 text-mutedForeground dark:text-mutedForegroundDark">
                Nenhuma renda cadastrada ainda
              </Text>
            ) : filteredIncomes.length === 0 ? (
              <View className="items-center gap-2 py-8"><Ionicons name="funnel-outline" size={28} color="#94a3b8" /><Text className="font-medium text-cardForeground dark:text-cardForegroundDark">Nenhuma receita encontrada</Text><Text className="text-center text-sm text-mutedForeground dark:text-mutedForegroundDark">Ajuste ou limpe os filtros para ver outros lançamentos.</Text></View>
            ) : (
              <FlatList
                data={filteredIncomes}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View className="h-3" />}
                renderItem={({ item }) => (
                  <View className="p-3 rounded-lg border border-border dark:border-borderDark flex-row justify-between items-center">
                    <View className="flex-1 pr-2">
                      <Text className="text-cardForeground dark:text-cardForegroundDark">
                        {item.description && item.description.trim() !== ""
                          ? (incomeDescriptionLabel[item.description] ?? item.description)
                          : (incomeCategoryLabels[item.category] ?? item.category)}
                        {" - "}
                        {frequencyLabels[item.frequency] ?? item.frequency}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-4">
                      <Text className="font-bold text-financial-income dark:text-financial-incomeDark">
                        R$ {item.value}
                      </Text>

                      <Pressable
                        onPress={() => {
                          setEditingIncome(item);
                          setShowEdit(true);
                        }}
                      >
                        <Ionicons name="create-outline" size={20} color="#3b82f6" />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setDeletingIncome(item);
                          setSelectedIncome(item);
                          setShowDelete(true);
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {editingIncome && (
        <EditEntityModal
          open={showEdit}
          title="Editar renda"
          initialData={editingIncome as unknown as Record<string, unknown>}
          onSave={handleEditIncome}
          onCancel={() => {
            setShowEdit(false);
            setEditingIncome(null);
          }}
        />
      )}

      {deletingIncome && (
        <DeleteConfirmModal
          open={showDelete}
          title="Excluir renda?"
          description="Esta ação não pode ser desfeita. Esta renda será removida permanentemente."
          onConfirm={handleDeleteIncome}
          onCancel={() => {
            setShowDelete(false);
            setDeletingIncome(null);
            setSelectedIncome(null);
          }}
        />
      )}

      {toast && <FeedbackToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </View>
  );
}
