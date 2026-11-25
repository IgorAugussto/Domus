import { useState, useEffect, useMemo } from "react";
import { View, Text, FlatList, Pressable, ScrollView, ActivityIndicator } from "react-native";
import dayjs from "dayjs";
import * as DocumentPicker from "expo-document-picker";
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
import { costService, type Cost, type PaymentType } from "@/services/costService";
import { statementService, type PickedStatementFile } from "@/services/statementService";
import { expenseCategoryLabels } from "@/utils/labels/expenseCategoryLabels";
import { expenseDescriptionLabel } from "@/utils/labels/expenseDescriptionLabel";
import { frequencyLabels } from "@/utils/labels/frequencyLabels";

const CATEGORY_OPTIONS = [
  { label: "Alimentação", value: "Food & Dining" },
  { label: "Transporte", value: "Transportation" },
  { label: "Compras", value: "Shopping" },
  { label: "Lazer", value: "Entertainment" },
  { label: "Contas e Serviços", value: "Bills & Utilities" },
  { label: "Saúde", value: "Healthcare" },
  { label: "Educação", value: "Education" },
  { label: "Outros", value: "Other" },
];

const FREQUENCY_OPTIONS = [
  { label: "Único", value: "One-time" },
  { label: "Mensal", value: "Monthly" },
];

const PAYMENT_TYPE_OPTIONS = [
  { label: "Cartão de Crédito", value: "Cartão de Crédito" },
  { label: "Boleto", value: "Boleto" },
];

const PERIOD_FILTER_OPTIONS = [
  { label: "Todo o período", value: "ALL" },
  { label: "Este mês", value: "CURRENT_MONTH" },
  { label: "Mês anterior", value: "PREVIOUS_MONTH" },
];

const ORIGIN_FILTER_OPTIONS = [
  { label: "Todas as origens", value: "ALL" },
  { label: "Lançadas manualmente", value: "manual" },
  { label: "Capturadas por notificação", value: "notification" },
  { label: "Importadas", value: "statement_import" },
];

const REVIEW_FILTER_OPTIONS = [
  { label: "Todas", value: "ALL" },
  { label: "Pendentes de revisão", value: "PENDING" },
  { label: "Revisadas", value: "REVIEWED" },
];

export default function ExpensesScreen() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [costs, setCosts] = useState<Cost[]>([]);
  const [frequency, setFrequency] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType | "">("");
  const [duration, setDuration] = useState("");

  const [selectedCost, setSelectedCost] = useState<Cost | null>(null);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deletingCost, setDeletingCost] = useState<Cost | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [reviewFilter, setReviewFilter] = useState("ALL");

  // ── Estados do import de extrato ──
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PickedStatementFile | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [importJobId, setImportJobId] = useState<string | null>(null);

  useEffect(() => {
    loadCosts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Polling de status do job de importação ───────────────────────────────
  useEffect(() => {
    if (!importJobId) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 60 × 2s = 2 minutos de timeout máximo

    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const statusData = await statementService.getStatus(importJobId);

        if (statusData.status === "DONE" && statusData.result) {
          clearInterval(pollInterval);
          setImportJobId(null);
          setImporting(false);
          await loadCosts();

          const { saved, total, skipped, errors } = statusData.result;
          if (errors.length > 0) {
            setToast({ message: `${saved} de ${total} despesas importadas. ${errors.length} erro(s).`, type: "error" });
          } else if (skipped > 0 && saved === 0) {
            setToast({ message: `Nenhuma nova despesa. ${skipped} já estavam cadastradas.`, type: "success" });
          } else if (skipped > 0) {
            setToast({ message: `${saved} novas despesas importadas. ${skipped} já existiam e foram ignoradas.`, type: "success" });
          } else {
            setToast({ message: `${saved} despesas importadas com sucesso!`, type: "success" });
          }
        } else if (statusData.status === "ERROR") {
          clearInterval(pollInterval);
          setImportJobId(null);
          setImporting(false);
          setToast({ message: "Erro ao processar extrato. Tente novamente.", type: "error" });
        } else if (attempts >= MAX_ATTEMPTS) {
          clearInterval(pollInterval);
          setImportJobId(null);
          setImporting(false);
          setToast({ message: "Tempo de espera excedido. Tente novamente.", type: "error" });
        }
        // PENDING / PROCESSING → continua aguardando
      } catch (err) {
        console.error("Erro ao verificar status do job:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [importJobId]);

  const loadCosts = async () => {
    try {
      const data = await costService.getAll();
      setCosts(data);
    } catch (err) {
      console.error("Erro ao carregar costs:", err);
    }
  };

  const handleSubmit = async () => {
    if (!amount || !category || !date) {
      setToast({ message: "Preencha todos os campos", type: "error" });
      return;
    }

    if (frequency !== "One-time" && !duration) {
      setToast({ message: "Informe a duração para despesas recorrentes", type: "error" });
      return;
    }

    try {
      await costService.create({
        description: description || category,
        amount: Number(amount),
        startDate: date,
        category,
        frequency,
        durationInMonths: frequency === "One-time" ? 1 : Number(duration),
        paymentType: paymentType as PaymentType,
        paid: false,
      });

      await loadCosts();
      setToast({ message: "Despesa salva com sucesso", type: "success" });

      setAmount("");
      setCategory("");
      setDescription("");
      setPaymentType("");
      setFrequency("");
      setDuration("");
      setDate(dayjs().format("YYYY-MM-DD"));
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      setToast({ message: "Erro ao salvar despesa. Tente novamente.", type: "error" });
    }
  };

  const handleDeleteCost = async () => {
    if (!selectedCost) return;
    try {
      await costService.delete(selectedCost.id);
      await loadCosts();
      setShowDelete(false);
    } catch (error) {
      console.error("Erro ao deletar cost:", error);
      setToast({ message: "Erro ao deletar despesa.", type: "error" });
    }
  };

  const handleEditCost = async (data: Record<string, unknown>) => {
    if (!editingCost) return;
    try {
      await costService.update(editingCost.id, data);
      await loadCosts();
      setShowEdit(false);
      setEditingCost(null);
    } catch (error) {
      console.error("Erro ao editar cost:", error);
      setToast({ message: "Erro ao editar despesa.", type: "error" });
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "application/pdf", "*/*"],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const name = asset.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".ofx") && !name.endsWith(".pdf")) {
      setToast({ message: "Formato inválido. Envie um arquivo CSV, OFX ou PDF.", type: "error" });
      return;
    }

    setSelectedFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, webFile: asset.file });
    setDueDate("");
  };

  const handleImport = async () => {
    if (!selectedFile || !dueDate) return;

    setImporting(true);
    try {
      const { jobId } = await statementService.import(selectedFile, dueDate);
      setSelectedFile(null);
      setDueDate("");
      setImportJobId(jobId);
    } catch (error) {
      console.error("Erro ao enviar extrato:", error);
      setToast({ message: "Erro ao enviar arquivo. Tente novamente.", type: "error" });
      setImporting(false);
    }
  };

  const categoryFilterOptions = useMemo(
    () => [{ label: "Todas as categorias", value: "ALL" }, ...CATEGORY_OPTIONS],
    [],
  );

  const filteredCosts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return costs.filter((cost) => {
      const transactionDate = dayjs(cost.purchaseAt ?? cost.startDate);
      const matchesSearch = !term || [cost.description, cost.category]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(term));
      const matchesPeriod = periodFilter === "ALL"
        || (periodFilter === "CURRENT_MONTH" && transactionDate.isSame(dayjs(), "month"))
        || (periodFilter === "PREVIOUS_MONTH" && transactionDate.isSame(dayjs().subtract(1, "month"), "month"));
      const matchesCategory = categoryFilter === "ALL" || cost.category === categoryFilter;
      const matchesOrigin = originFilter === "ALL" || cost.origin === originFilter;
      const pendingReview = cost.origin === "notification" && !cost.reviewed;
      const matchesReview = reviewFilter === "ALL"
        || (reviewFilter === "PENDING" && pendingReview)
        || (reviewFilter === "REVIEWED" && !pendingReview);
      return matchesSearch && matchesPeriod && matchesCategory && matchesOrigin && matchesReview;
    });
  }, [categoryFilter, costs, originFilter, periodFilter, reviewFilter, search]);

  const hasActiveFilters = Boolean(search || periodFilter !== "ALL" || categoryFilter !== "ALL" || originFilter !== "ALL" || reviewFilter !== "ALL");
  const clearFilters = () => {
    setSearch("");
    setPeriodFilter("ALL");
    setCategoryFilter("ALL");
    setOriginFilter("ALL");
    setReviewFilter("ALL");
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-900">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-28" keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Despesas" subtitle="Controle seus gastos e compromissos" icon="cash" color="#ef4444" backgroundClassName="bg-financial-dangerLight dark:bg-financial-dangerLightDark" />

        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Ionicons name="cloud-upload-outline" size={18} color="#3b82f6" />
              <CardTitle>Importar Extrato</CardTitle>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            <Text className="text-sm text-mutedForeground dark:text-mutedForegroundDark">
              Importe seu extrato do Nubank (CSV ou OFX) ou do Itaú (PDF). As despesas serão adicionadas
              automaticamente como &ldquo;Cartão de Crédito&rdquo;.
            </Text>

            {importing && importJobId && (
              <View className="flex-row items-center gap-3 px-4 py-3 rounded-lg border border-financial-trust bg-financial-trustLight dark:bg-financial-trustLightDark">
                <ActivityIndicator size="small" />
                <Text className="flex-1 text-sm text-financial-trust dark:text-financial-trustDark">
                  Processando extrato em segundo plano… você pode usar o app normalmente.
                </Text>
              </View>
            )}

            {!importing && (
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={handlePickFile}
                  className="px-4 py-2 rounded-lg border border-financial-trust bg-financial-trustLight dark:bg-financial-trustLightDark"
                >
                  <Text className="text-sm font-medium text-financial-trust dark:text-financial-trustDark">
                    {selectedFile ? `📄 ${selectedFile.name}` : "Selecionar arquivo"}
                  </Text>
                </Pressable>

                {selectedFile && (
                  <Pressable
                    onPress={() => {
                      setSelectedFile(null);
                      setDueDate("");
                    }}
                  >
                    <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">✕ Cancelar</Text>
                  </Pressable>
                )}
              </View>
            )}

            {selectedFile && (
              <View className="gap-2 p-3 rounded-lg border border-financial-trust bg-financial-trustLight dark:bg-financial-trustLightDark">
                <Label>📅 Qual é a data de vencimento desta fatura?</Label>
                <Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">
                  Todas as despesas importadas serão alocadas nesta data.
                </Text>
                <Input value={dueDate} onChangeText={setDueDate} placeholder="2026-01-31" />

                {dueDate && !importing && (
                  <Button onPress={handleImport} className="self-start bg-financial-trust dark:bg-financial-trustDark">
                    Subir Arquivo
                  </Button>
                )}
              </View>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova Despesa</CardTitle>
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
              <Select
                value={frequency}
                onValueChange={(v) => {
                  setFrequency(v);
                  setDuration(v === "One-time" ? "1" : "");
                }}
                options={FREQUENCY_OPTIONS}
                placeholder="Selecionar frequência"
              />
            </View>

            <View>
              <Label>Tipo de Pagamento</Label>
              <Select
                value={paymentType}
                onValueChange={(v) => setPaymentType(v as PaymentType)}
                options={PAYMENT_TYPE_OPTIONS}
                placeholder="Selecionar tipo de pagamento"
              />
            </View>

            {frequency !== "" && frequency !== "One-time" && (
              <View>
                <Label>Número de parcelas</Label>
                <Input keyboardType="number-pad" value={duration} onChangeText={setDuration} />
              </View>
            )}

            <View>
              <Label>Descrição (opcional)</Label>
              <Textarea placeholder="Descrição da despesa" value={description} onChangeText={setDescription} />
            </View>

            <Button
              onPress={handleSubmit}
              disabled={!amount || !category || !date}
              className="bg-financial-danger dark:bg-financial-dangerDark"
            >
              Adicionar Despesa
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1"><CardTitle>Despesas</CardTitle><Text className="text-xs text-mutedForeground dark:text-mutedForegroundDark">{filteredCosts.length} de {costs.length} lançamento(s)</Text></View>
              {hasActiveFilters && <Button size="sm" variant="ghost" onPress={clearFilters}>Limpar filtros</Button>}
            </View>
          </CardHeader>
          <CardContent className="gap-4">
            <Input value={search} onChangeText={setSearch} placeholder="Buscar por estabelecimento ou categoria" returnKeyType="search" />
            <View className="gap-3">
              <Select value={periodFilter} onValueChange={setPeriodFilter} options={PERIOD_FILTER_OPTIONS} placeholder="Período" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter} options={categoryFilterOptions} placeholder="Categoria" />
              <Select value={originFilter} onValueChange={setOriginFilter} options={ORIGIN_FILTER_OPTIONS} placeholder="Origem" />
              <Select value={reviewFilter} onValueChange={setReviewFilter} options={REVIEW_FILTER_OPTIONS} placeholder="Revisão" />
            </View>
            {costs.length === 0 ? (
              <Text className="text-center py-4 text-mutedForeground dark:text-mutedForegroundDark">
                Nenhuma despesa cadastrada ainda
              </Text>
            ) : filteredCosts.length === 0 ? (
              <View className="items-center gap-2 py-8"><Ionicons name="funnel-outline" size={28} color="#94a3b8" /><Text className="text-center font-medium text-cardForeground dark:text-cardForegroundDark">Nenhuma despesa encontrada</Text><Text className="text-center text-sm text-mutedForeground dark:text-mutedForegroundDark">Ajuste ou limpe os filtros para ver outros lançamentos.</Text></View>
            ) : (
              <FlatList
                data={filteredCosts}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View className="h-3" />}
                renderItem={({ item }) => (
                  <View className="p-3 rounded-lg border border-border dark:border-borderDark flex-row justify-between items-center">
                    <View className="flex-1 pr-2">
                      <Text className="text-cardForeground dark:text-cardForegroundDark">
                        {item.description && item.description.trim() !== ""
                          ? (expenseDescriptionLabel[item.description] ?? item.description)
                          : (expenseCategoryLabels[item.category] ?? item.category)}
                        {" - "}
                        {frequencyLabels[item.frequency] ?? item.frequency}
                      </Text>
                      {item.startDate && (
                        <Text className="text-xs mt-0.5 text-mutedForeground dark:text-mutedForegroundDark">
                          {dayjs(item.purchaseAt ?? item.startDate).format("DD [de] MMMM [de] YYYY")}
                        </Text>
                      )}
                      {item.origin === "notification" && (
                        <Text className={`mt-1 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.reviewed ? "bg-financial-trustLight text-financial-trust dark:bg-financial-trustLightDark dark:text-financial-trustDark" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"}`}>{item.reviewed ? "CAPTURADA · REVISADA" : "CAPTURADA · PENDENTE"}</Text>
                      )}
                    </View>

                    <View className="flex-row items-center gap-4">
                      <Text className="font-bold text-financial-danger dark:text-financial-dangerDark">
                        R$ {item.value}
                      </Text>

                      <Pressable
                        onPress={() => {
                          setEditingCost(item);
                          setShowEdit(true);
                        }}
                      >
                        <Ionicons name="create-outline" size={20} color="#3b82f6" />
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setDeletingCost(item);
                          setSelectedCost(item);
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

      {editingCost && (
        <EditEntityModal
          open={showEdit}
          title="Editar despesa"
          initialData={editingCost as unknown as Record<string, unknown>}
          showDurationInMonths
          showExpenseCategories
          onSave={handleEditCost}
          onCancel={() => {
            setShowEdit(false);
            setEditingCost(null);
          }}
        />
      )}

      {deletingCost && (
        <DeleteConfirmModal
          open={showDelete}
          title="Excluir despesa?"
          description="Esta ação não pode ser desfeita. Esta despesa será removida permanentemente."
          onConfirm={handleDeleteCost}
          onCancel={() => {
            setShowDelete(false);
            setDeletingCost(null);
            setSelectedCost(null);
          }}
        />
      )}

      {toast && <FeedbackToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </View>
  );
}
