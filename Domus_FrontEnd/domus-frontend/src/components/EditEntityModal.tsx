import { useState, useEffect } from "react";
import { splitInstallmentTotal } from "../utils/installments";
import { Button } from "../ui-components/button";
import { Input } from "../ui-components/input";
import { Label } from "../ui-components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui-components/select";
import { Textarea } from "../ui-components/textArea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../ui-components/card";

type EditFormData = {
  amount: string;
  startDate: string;
  endDate: string;
  category: string;
  frequency: string;
  description: string;
  durationInMonths: string;
  expectedReturn: string;
  typeInvestments: string;
};

const emptyForm: EditFormData = {
  amount: "",
  startDate: "",
  endDate: "",
  category: "",
  frequency: "",
  description: "",
  durationInMonths: "",
  expectedReturn: "",
  typeInvestments: "",
};

interface EditEntityModalProps {
  open: boolean;
  title: string;
  initialData: Record<string, unknown>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  showDurationInMonths?: boolean;
  showExpenseCategories?: boolean;
  showFieldsInvestments?: boolean;
  creditCards?: { id: number; brand: string; nickname?: string; lastFourDigits: string }[];
  financialAccounts?: { account_id: number; name: string; holder_name: string }[];
}

export function EditEntityModal({
  open,
  title,
  initialData,
  onSave,
  onCancel,
  showDurationInMonths = false,
  showExpenseCategories = false,
  showFieldsInvestments = false,
  creditCards = [],
  financialAccounts = [],
}: EditEntityModalProps) {
  const [formData, setFormData] = useState<EditFormData>(emptyForm);
  const [selectedCard, setSelectedCard] = useState("");
  const [plannedAccount, setPlannedAccount] = useState("none");
  const [cardError, setCardError] = useState(false);
  const [amountMode, setAmountMode] = useState<"installment" | "total">("installment");
  const [amountError, setAmountError] = useState(false);

  useEffect(() => {
    if (!initialData) return;

    setAmountMode(initialData.installmentTotal != null ? "total" : "installment");
    setAmountError(false);
    setSelectedCard(String(initialData.creditCardId ?? ""));
    setPlannedAccount(initialData.plannedAccountId == null ? "none" : String(initialData.plannedAccountId));
    setCardError(false);
    setFormData({
      amount: String(initialData.installmentTotal ?? initialData.value ?? initialData.amount ?? ""),
      startDate: String(initialData.startDate ?? ""),
      endDate: String(initialData.endDate ?? ""),
      category: String(initialData.category ?? ""),
      frequency: String(initialData.frequency ?? ""),
      description: String(initialData.description ?? ""),
      durationInMonths: String(initialData.durationInMonths ?? ""),
      expectedReturn: String(initialData.expectedReturn ?? ""),
      typeInvestments: String(initialData.typeInvestments ?? ""),
    });
  }, [initialData]);

  if (!open) return null;

  const handleChange = (field: keyof EditFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    if (showExpenseCategories && initialData.paymentType === "Cartão de Crédito" && !selectedCard) { setCardError(true); return; }
    const split = showExpenseCategories && formData.frequency === "Monthly" && amountMode === "total" && Number(formData.durationInMonths) > 1 ? splitInstallmentTotal(formData.amount, Number(formData.durationInMonths)) : null;
    if (showExpenseCategories && formData.frequency === "Monthly" && amountMode === "total" && Number(formData.durationInMonths) > 1 && !split) { setAmountError(true); return; }
    onSave({
      installmentTotal: showExpenseCategories ? split?.total ?? null : undefined,
      plannedAccountId: showExpenseCategories ? (plannedAccount === "none" ? null : Number(plannedAccount)) : undefined,
      creditCardId: showExpenseCategories && initialData.paymentType === "Cartão de Crédito" ? Number(selectedCard) : undefined,
      ...formData,
      amount: split?.first ?? Number(formData.amount),
      durationInMonths: showDurationInMonths
        ? Number(formData.durationInMonths)
        : undefined,
      expectedReturn: showFieldsInvestments
        ? Number(formData.expectedReturn)
        : undefined,
      typeInvestments: showFieldsInvestments
        ? formData.typeInvestments
        : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-xl shadow-2xl">
        <CardHeader className="border-b">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* AMOUNT + START DATE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{showExpenseCategories && formData.frequency === "Monthly" ? (amountMode === "total" ? "Valor total da compra" : "Valor por mês") : "Valor"}</Label>
              <Input
                type="number"
                value={formData.amount || ""}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Input
                type="date"
                value={formData.startDate || ""}
                onChange={(e) => handleChange("startDate", e.target.value)}
              />
            </div>
          </div>

          {showExpenseCategories && initialData.paymentType === "Cartão de Crédito" && (
            <div className="space-y-2">
              <Label>Cartão</Label>
              <Select value={selectedCard} onValueChange={(value) => { setSelectedCard(value); setCardError(false); }}>
                <SelectTrigger className="select-trigger"><SelectValue placeholder="Selecionar cartão" /></SelectTrigger>
                <SelectContent className="select-content">{creditCards.map((card) => <SelectItem key={card.id} className="select-item" style={{ color: "var(--card-foreground)" }} value={String(card.id)}>{card.nickname || card.brand} •••• {card.lastFourDigits}</SelectItem>)}</SelectContent>
              </Select>
              {cardError && <p role="alert">Selecione o cartão da compra.</p>}
              {!creditCards.length && <p>Cadastre um cartão na aba Cartões.</p>}
            </div>
          )}

          {amountError && <p role="alert">Informe um total válido com até duas casas decimais e ao menos um centavo por parcela.</p>}

          {showExpenseCategories && <div className="space-y-2"><Label>Conta prevista</Label><Select value={plannedAccount} onValueChange={setPlannedAccount}><SelectTrigger className="select-trigger"><SelectValue /></SelectTrigger><SelectContent className="select-content"><SelectItem className="select-item" value="none">Sem conta definida</SelectItem>{financialAccounts.map(account => <SelectItem className="select-item" key={account.account_id} value={String(account.account_id)}>{account.name} · {account.holder_name}</SelectItem>)}</SelectContent></Select></div>}

          {/* INVESTMENTS ONLY */}
          {showFieldsInvestments && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Investimento</Label>
                  <Select
                    value={formData.typeInvestments}
                    onValueChange={(v) => handleChange("typeInvestments", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select investment type" />
                    </SelectTrigger>
                    <SelectContent className="select-content">
                      <SelectItem className="select-item" value="Stocks">
                        Ações
                      </SelectItem>
                      <SelectItem className="select-item" value="Bonds">
                        Renda Fixa
                      </SelectItem>
                      <SelectItem className="select-item" value="Real Estate">
                        Imóveis
                      </SelectItem>
                      <SelectItem className="select-item" value="Crypto">
                        Criptomoedas
                      </SelectItem>
                      <SelectItem className="select-item" value="Mutual Funds">
                        Fundos de Investimento
                      </SelectItem>
                      <SelectItem className="select-item" value="ETF">
                        ETF
                      </SelectItem>
                      <SelectItem className="select-item" value="Savings">
                        Poupança
                      </SelectItem>
                      <SelectItem className="select-item" value="Other">
                        Outros
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rentabilidade Esperada (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.expectedReturn || ""}
                    onChange={(e) =>
                      handleChange("expectedReturn", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Término</Label>
                <Input
                  type="date"
                  value={formData.endDate || ""}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                />
              </div>
            </>
          )}

          {/* CATEGORY + FREQUENCY (NOT INVESTMENTS) */}
          {!showFieldsInvestments && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => handleChange("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>

                  {showExpenseCategories ? (
                    <SelectContent>
                      <SelectItem className="select-item" value="Food & Dining">
                        Alimentação
                      </SelectItem>
                      <SelectItem
                        className="select-item"
                        value="Transportation"
                      >
                        Transporte
                      </SelectItem>
                      <SelectItem className="select-item" value="Shopping">
                        Compras
                      </SelectItem>
                      <SelectItem className="select-item" value="Entertainment">
                        Entretenimento
                      </SelectItem>
                      <SelectItem
                        className="select-item"
                        value="Bills & Utilities"
                      >
                        Contas e Serviços
                      </SelectItem>
                      <SelectItem className="select-item" value="Healthcare">
                        Saúde
                      </SelectItem>
                      <SelectItem className="select-item" value="Education">
                        Educação
                      </SelectItem>
                      <SelectItem className="select-item" value="Other">
                        Outro
                      </SelectItem>
                    </SelectContent>
                  ) : (
                    <SelectContent>
                      <SelectItem className="select-item" value="Salary">
                        Salário
                      </SelectItem>
                      <SelectItem className="select-item" value="Freelance">
                        Freelance
                      </SelectItem>
                      <SelectItem className="select-item" value="Bonus">
                        Bônus
                      </SelectItem>
                      <SelectItem className="select-item" value="Investment">
                        Investimento
                      </SelectItem>
                      <SelectItem className="select-item" value="Other">
                        Outro
                      </SelectItem>
                    </SelectContent>
                  )}
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(v) => handleChange("frequency", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem className="select-item" value="One-time">
                      Único
                    </SelectItem>
                    <SelectItem className="select-item" value="Monthly">
                      Mensal
                    </SelectItem>
                    {showExpenseCategories && <SelectItem className="select-item" value="Yearly">Anual</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* DESCRIPTION */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={formData.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          {/* DURATION (EXPENSES ONLY) */}
          {showDurationInMonths && (
            <div className="space-y-2">
              <Label>Duração (meses)</Label>
              <Input
                type="number"
                min={1}
                value={formData.durationInMonths || ""}
                onChange={(e) =>
                  handleChange("durationInMonths", e.target.value)
                }
              />
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-5 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
              className="cursor-pointer"
            >
              Cancelar
            </Button>

            <Button
              onClick={handleSave}
              className="cursor-pointer"
              style={{
                background: "var(--financial-income)",
                color: "white",
              }}
            >
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
