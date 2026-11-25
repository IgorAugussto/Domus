// src/components/IncomePage.tsx
import React, { useState, useEffect } from "react";
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
import { Plus, Wallet } from "lucide-react";
import { incomeService } from "../service/incomeService";
import type { Income } from "../service/incomeService";
import { EditEntityModal } from "./EditEntityModal";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { FeedbackToast } from "./FeedbackToast";
import { incomeCategoryLabels } from "../utils/labels/incomeCategoryLabels";
import { incomeDescriptionLabel } from "../utils/labels/incomeDescriptionLabel";
import { frequencyLabels } from "../utils/labels/frequencyLabels";

export default function IncomePage() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [frequency, setFrequency] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deletingIncome, setDeletingIncome] = useState<Income | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
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

    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !category || !date) {
      setToast({
        message: "Preencha todos os campos",
        type: "error",
      });
      return;
    }

    try {
      await incomeService.create({
        description: description || `${category}`,
        amount: Number(amount),
        category,
        frequency,
        startDate: date,
        endDate: date,
        recurring: frequency !== "One-time",
      });

      await loadIncomes();

      setToast({
        message: "Receita salva com sucesso",
        type: "success",
      });

      // Limpa o formulário
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
    } catch (error) {
      console.error("Erro ao salvar receita:", error);
      setToast({
        message: "Erro ao salvar receita. Tente novamente.",
        type: "error",
      });
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
      alert("Erro ao deletar renda.");
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
      alert("Erro ao editar income.");
    }
  };

  const filteredIncomes = incomes.filter((income) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const dateValue = new Date(`${income.startDate}T00:00:00`);
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (!term || `${income.description} ${income.category}`.toLocaleLowerCase("pt-BR").includes(term))
      && (categoryFilter === "ALL" || income.category === categoryFilter)
      && (frequencyFilter === "ALL" || income.frequency === frequencyFilter)
      && (periodFilter === "ALL" || (periodFilter === "CURRENT_MONTH" && dateValue.getFullYear() === now.getFullYear() && dateValue.getMonth() === now.getMonth()) || (periodFilter === "PREVIOUS_MONTH" && dateValue.getFullYear() === previousMonth.getFullYear() && dateValue.getMonth() === previousMonth.getMonth()));
  });

  return (
    <div className="space-y-6">
      {/* TÍTULO */}
      <div className="flex items-center gap-2">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: "var(--financial-income-light)" }}
        >
          <Wallet
            className="h-6 w-6"
            style={{ color: "var(--financial-income)" }}
          />
        </div>
        <h1
          className="text-3xl font-bold"
          style={{ color: "var(--financial-income)" }}
        >
          Adicionar Renda
        </h1>
      </div>

      {/* FORMULÁRIO */}
      <Card
        style={{
          background: "var(--card)",
          borderColor: "var(--financial-income)",
          color: "var(--card-foreground)",
        }}
      >
        <CardHeader style={{ background: "var(--financial-income-light)" }}>
          <CardTitle
            className="flex items-center gap-2"
            style={{ color: "var(--financial-income)" }}
          >
            <Plus className="h-5 w-5" />
            Nova Renda
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição ou categoria" />
            <Select value={periodFilter} onValueChange={setPeriodFilter}><SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todo o período</SelectItem><SelectItem value="CURRENT_MONTH">Este mês</SelectItem><SelectItem value="PREVIOUS_MONTH">Mês anterior</SelectItem></SelectContent></Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas as categorias</SelectItem><SelectItem value="Salary">Salário</SelectItem><SelectItem value="Freelance">Freelance</SelectItem><SelectItem value="Bonus">Bônus</SelectItem><SelectItem value="Investment">Investimento</SelectItem><SelectItem value="Gift">Presente</SelectItem><SelectItem value="Other">Outros</SelectItem></SelectContent></Select>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}><SelectTrigger><SelectValue placeholder="Frequência" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todas as frequências</SelectItem><SelectItem value="One-time">Única</SelectItem><SelectItem value="Monthly">Mensal</SelectItem></SelectContent></Select>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  required
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger
                    className="select-trigger"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <SelectValue placeholder="Selecionar Categoria" />
                  </SelectTrigger>
                  <SelectContent className="select-content">
                    <SelectItem className="select-item" value="Salary">
                      Salário
                    </SelectItem>
                    <SelectItem className="select-item" value="Freelance">
                      Freelance
                    </SelectItem>
                    <SelectItem className="select-item" value="Bonus">
                      Bonus
                    </SelectItem>
                    <SelectItem className="select-item" value="Investment">
                      Retorno de Investimentos
                    </SelectItem>
                    <SelectItem className="select-item" value="Gift">
                      Presente
                    </SelectItem>
                    <SelectItem className="select-item" value="Other">
                      Outros
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="select-trigger">
                    <SelectValue placeholder="Selecionar Frequência" />
                  </SelectTrigger>
                  <SelectContent className="select-content">
                    <SelectItem className="select-item" value="One-time">
                      Única
                    </SelectItem>
                    {/* <SelectItem className="select-item" value="Weekly">
                      Weekly
                    </SelectItem>
                    <SelectItem className="select-item" value="Bi-weekly">
                      Bi-weekly
                    </SelectItem>*/}
                    <SelectItem className="select-item" value="Monthly">
                      Mensal
                    </SelectItem>
                    {/*<SelectItem className="select-item" value="Quarterly">
                      Quarterly
                    </SelectItem>
                    <SelectItem className="select-item" value="Annually">
                      Annually
                    </SelectItem>*/}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Detalhes adicionais sobre a renda"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              style={{ background: "var(--financial-income)", color: "white" }}
            >
              Adicionar Renda
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* LISTA DE INCOME */}
      <Card style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--card-foreground)" }}>
            Rendas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incomes.length === 0 ? (
            <p
              className="text-center py-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              No income added yet
            </p>
          ) : filteredIncomes.length === 0 ? (
            <p className="py-8 text-center" style={{ color: "var(--muted-foreground)" }}>Nenhuma receita encontrada para os filtros selecionados.</p>
          ) : (
            <ul className="space-y-3">
              {filteredIncomes.map((inc) => (
                <li
                  key={inc.id}
                  className="p-3 rounded-lg border"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--card)",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span>
                        {inc.description && inc.description.trim() !== ""
                          ? (incomeDescriptionLabel[inc.description] ??
                            inc.description)
                          : (incomeCategoryLabels[inc.category] ??
                            inc.category)}
                        {" - "}
                        {frequencyLabels[inc.frequency] ?? inc.frequency}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <strong style={{ color: "var(--financial-income)" }}>
                        ${inc.value}
                      </strong>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingIncome(inc);
                          setShowEdit(true);
                        }}
                        className="hover:opacity-70 cursor-pointer"
                        title="Edit income"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeletingIncome(inc);
                          setSelectedIncome(inc);
                          setShowDelete(true);
                        }}
                        className="hover:opacity-70 cursor-pointer"
                        title="Delete income"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* MODAL EDIT */}
      {editingIncome && (
        <EditEntityModal
          open={showEdit}
          title="Edit income"
          initialData={editingIncome as unknown as Record<string, unknown>}
          onSave={handleEditIncome}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {/* MODAL DELETE */}
      {deletingIncome && (
        <DeleteConfirmModal
          open={showDelete}
          title="Delete income?"
          description="This action cannot be undone. This income will be permanently removed."
          onConfirm={handleDeleteIncome}
          onCancel={() => {
            setShowDelete(false);
            setDeletingIncome(null);
            setSelectedIncome(null);
          }}
        />
      )}

      {toast && (
        <FeedbackToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
