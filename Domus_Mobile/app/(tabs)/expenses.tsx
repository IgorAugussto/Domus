import { useState, useEffect, useMemo, useRef } from "react";
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
import { creditCardService, type CreditCard } from "@/services/creditCardService";
import { financialAccountService, type FinancialAccount } from "@/services/financialAccountService";
import { newRequestKey } from "@/services/cashMovementService";
import { statementService, type PickedStatementFile } from "@/services/statementService";
import { formatInstallmentParts, splitInstallmentTotal } from "@/utils/installments";
import { expenseCategoryLabels } from "@/utils/labels/expenseCategoryLabels";
import { expenseDescriptionLabel } from "@/utils/labels/expenseDescriptionLabel";
import { frequencyLabels } from "@/utils/labels/frequencyLabels";

const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  { label: "Anual", value: "Yearly" },
];

const PAYMENT_TYPE_OPTIONS = [
  { label: "Cartão de Crédito", value: "Cartão de Crédito" },
  { label: "Boleto", value: "Boleto" },
  { label: "Pix", value: "Pix" },
  { label: "Débito", value: "Débito" },
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
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [plannedAccountId, setPlannedAccountId] = useState("");
  const [paidNow, setPaidNow] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const immediateKey = useRef(newRequestKey());
  const [amountMode, setAmountMode] = useState<"installment" | "total">("installment");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [costs, setCosts] = useState<Cost[]>([]);
  const [frequency, setFrequency] = useState("");
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [creditCardId, setCreditCardId] = useState("");
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
    financialAccountService.list().then(setAccounts).catch(() => setToast({ message: "Não foi possível carregar as contas.", type: "error" }));
    creditCardService.getAll().then(setCreditCards).catch(() => setToast({ message: "Não foi possível carregar os cartões.", type: "error" }));
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

    if (paymentType === "Cartão de Crédito" && !creditCardId) {
      setToast({ message: "Selecione o cartão da compra.", type: "error" });
      return;
    }

    const count = Number(duration);
    const installments = frequency === "Monthly" && amountMode === "total" && count > 1 ? splitInstallmentTotal(amount, count) : null;
    if (frequency === "Monthly" && amountMode === "total" && count > 1 && !installments) {
      setToast({ message: "Informe um total válido com até duas casas decimais e ao menos um centavo por parcela.", type: "error" });
      return;
    }
    if (frequency !== "One-time" && (!Number.isSafeInteger(count) || count < 1)) {
      setToast({ message: "Informe uma duração inteira e positiva.", type: "error" });
      return;
    }
    if (!paymentType || !frequency) { setToast({ message: "Selecione a frequência e o tipo de pagamento.", type: "error" }); return; }
    if (paidNow && !plannedAccountId) { setToast({ message: "Selecione a conta do pagamento.", type: "error" }); return; }
    if (paidNow && (frequency !== "One-time" || (paymentType !== "Pix" && paymentType !== "Débito"))) { setToast({ message: "O pagamento no cadastro é disponível para Pix ou débito únicos.", type: "error" }); return; }
    setSavingExpense(true);
    try {
      if (paidNow && (paymentType === "Pix" || paymentType === "Débito")) {
        await costService.createImmediate({ description: description || category, amount: Number(amount), date, category, paymentType, accountId: Number(plannedAccountId), requestKey: immediateKey.current });
        immediateKey.current = newRequestKey();
      } else await costService.create({
        description: description || category,
        amount: installments?.first ?? Number(amount),
        installmentTotal: installments?.total ?? null,
        startDate: date,
        category,
        frequency,
        durationInMonths: frequency === "One-time" ? 1 : frequency === "Yearly" ? count * 12 : count,
        paymentType: paymentType as PaymentType,
        paid: false,
        creditCardId: paymentType === "Cartão de Crédito" ? Number(creditCardId) : undefined,
        plannedAccountId: plannedAccountId ? Number(plannedAccountId) : null,
      });

      await loadCosts();
      setToast({ message: "Despesa salva com sucesso", type: "success" });

      setAmount("");
      setAmountMode("installment");
      setCategory("");
      setDescription("");
      setPaymentType("");
      setPlannedAccountId("");
      setPaidNow(false);
      setCreditCardId("");
      setFrequency("");
      setDuration("");
      setDate(dayjs().format("YYYY-MM-DD"));
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      setToast({ message: typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "Erro ao salvar despesa. Tente novamente.", type: "error" });
    } finally { setSavingExpense(false); }
  };

  const handleDeleteCost = async () => {
    if (!selectedCost) return;
    try {
      await costService.delete(selectedCost.id);
      await loadCosts();
      setShowDelete(false);
    } catch (error) {
      console.error("Erro ao deletar cost:", error);
      setToast({ message: typeof error === "object" && error !== null && "code" in error && error.code === "23503" ? "Esta despesa possui movimentações e não pode ser excluída." : "Não foi possível excluir a despesa.", type: "error" });
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
      setToast({ message: typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "Não foi possível editar a despesa.", type: "error" });
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
              <Label>{frequency === "Monthly" ? (amountMode === "total" ? "Valor total da compra" : "Valor por mês") : "Valor"}</Label>
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
                  setPaidNow(v === "One-time" && (paymentType === "Pix" || paymentType === "Débito"));
                  setDuration(v === "One-time" ? "1" : "");
                }}
                options={FREQUENCY_OPTIONS}
                placeholder="Selecionar frequência"
              />
            </View>

            {frequency === "Monthly" && (
              <View>
                <Label>O valor informado é</Label>
                <Select value={amountMode} onValueChange={(value) => setAmountMode(value as "installment" | "total")} options={[{ label: "Valor de cada parcela", value: "installment" }, { label: "Valor total da compra", value: "total" }]} />
              </View>
            )}
            {frequency === "Monthly" && amount && Number(duration) > 1 ? (() => {
              const split = amountMode === "total" ? splitInstallmentTotal(amount, Number(duration)) : null;
              return <Text className="text-cardForeground dark:text-cardForegroundDark">{amountMode === "total" ? (split ? `Total: ${formatCurrency(split.total)} · ${formatInstallmentParts(split.total, Number(duration))}` : "Informe um total válido para calcular as parcelas.") : `Total previsto: ${formatCurrency(Number(amount) * Number(duration))} · ${duration} × ${formatCurrency(Number(amount))} por mês`}</Text>;
            })() : null}

            <View>
              <Label>Tipo de Pagamento</Label>
              <Select
                value={paymentType}
                onValueChange={(v) => { setPaymentType(v as PaymentType); setPaidNow(frequency === "One-time" && (v === "Pix" || v === "Débito")); if (v !== "Cartão de Crédito") setCreditCardId(""); }}
                options={PAYMENT_TYPE_OPTIONS}
                placeholder="Selecionar tipo de pagamento"
              />
            </View>

            {paymentType === "Cartão de Crédito" && (
              <View>
                <Label>Cartão</Label>
                {creditCards.length ? <Select value={creditCardId} onValueChange={setCreditCardId} options={creditCards.map((card) => ({ value: String(card.id), label: `${card.nickname || card.brand} •••• ${card.lastFourDigits}` }))} placeholder="Selecionar cartão" /> : <Text>Cadastre um cartão em Mais → Cartões antes de continuar.</Text>}
              </View>
            )}

            {paymentType !== "" && <View><Label>Conta prevista{paidNow ? " (obrigatória)" : " (opcional)"}</Label>{accounts.length ? <Select value={plannedAccountId} onValueChange={value => setPlannedAccountId(value === "none" ? "" : value)} options={[{ value: "none", label: "Sem conta definida" }, ...accounts.map(item => ({ value: String(item.account_id), label: `${item.name} · ${item.holder_name}` }))]} placeholder="Selecionar conta" /> : <Text className="text-cardForeground dark:text-cardForegroundDark">Cadastre uma conta em Contas e saldos.</Text>}</View>}
            {(paymentType === "Pix" || paymentType === "Débito") && frequency === "One-time" && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: paidNow }} onPress={() => setPaidNow(!paidNow)} className="flex-row items-center gap-2"><Ionicons name={paidNow ? "checkbox" : "square-outline"} size={22} color="#3b82f6" /><Text className="text-cardForeground dark:text-cardForegroundDark">Já pago: descontar da conta na data informada</Text></Pressable>}

            {frequency !== "" && frequency !== "One-time" && (
              <View>
                <Label>{frequency === "Yearly" ? "Número de anos" : "Número de parcelas"}</Label>
                <Input keyboardType="number-pad" value={duration} onChangeText={setDuration} />
              </View>
            )}

            <View>
              <Label>Descrição (opcional)</Label>
              <Textarea placeholder="Descrição da despesa" value={description} onChangeText={setDescription} />
            </View>

            <Button
              onPress={handleSubmit}
              disabled={savingExpense || !amount || !category || !date}
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
                      {item.frequency === "Monthly" && item.durationInMonths > 1 && (
                        <Text className="mt-1 text-sm text-cardForeground dark:text-cardForegroundDark">Total previsto: {formatCurrency(item.installmentTotal ?? item.value * item.durationInMonths)} · {item.installmentTotal != null ? formatInstallmentParts(item.installmentTotal, item.durationInMonths) : `${item.durationInMonths} × ${formatCurrency(item.value)} por mês`}</Text>
                      )}
                      {item.origin === "notification" && (
                        <Text className={`mt-1 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.reviewed ? "bg-financial-trustLight text-financial-trust dark:bg-financial-trustLightDark dark:text-financial-trustDark" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"}`}>{item.reviewed ? "CAPTURADA · REVISADA" : "CAPTURADA · PENDENTE"}</Text>
                      )}
                    </View>

                    <View className="flex-row items-center gap-4">
                      <Text className="font-bold text-financial-danger dark:text-financial-dangerDark">
                        {formatCurrency(item.value)}
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
          creditCards={creditCards}
          financialAccounts={accounts}
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
