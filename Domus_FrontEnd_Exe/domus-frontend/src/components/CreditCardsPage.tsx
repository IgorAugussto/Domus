// =====================================================================
// CreditCardsPage.tsx — Aba "Cartões"
// =====================================================================

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui-components/card";
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
import { CreditCard as CreditCardIcon, Plus } from "lucide-react";
import { FeedbackToast } from "./FeedbackToast";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { creditCardService, type CreditCard } from "../service/creditCardService";
import { paymentStatusService, type PaymentMonthItem } from "../service/paymentStatusService";

const BRAND_OPTIONS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outro"];

const MONTH_NAMES: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março",
  "04": "Abril",   "05": "Maio",      "06": "Junho",
  "07": "Julho",   "08": "Agosto",    "09": "Setembro",
  "10": "Outubro", "11": "Novembro",  "12": "Dezembro",
};

function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return `${MONTH_NAMES[month] ?? month} ${year}`;
}

function addMonths(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function cardLabel(card: CreditCard): string {
  const name = card.nickname?.trim() ? card.nickname : card.brand;
  return `${name} •••• ${card.lastFourDigits}`;
}

export function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── Formulário de cadastro ──
  const [brand, setBrand] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [nickname, setNickname] = useState("");

  // ── Exclusão (soft delete) ──
  const [deletingCard, setDeletingCard] = useState<CreditCard | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  // ── Filtro de gastos por cartão ──
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [yearMonth, setYearMonth] = useState<string>(getCurrentYearMonth());
  const [payments, setPayments] = useState<PaymentMonthItem[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selectedCardId) {
      setPayments([]);
      return;
    }
    setLoadingPayments(true);
    paymentStatusService
      .getByMonth(yearMonth)
      .then(setPayments)
      .catch(() => setToast({ message: "Erro ao carregar gastos.", type: "error" }))
      .finally(() => setLoadingPayments(false));
  }, [selectedCardId, yearMonth]);

  const loadCards = async () => {
    setLoading(true);
    try {
      const data = await creditCardService.getAll();
      setCards(data);
    } catch {
      setToast({ message: "Erro ao carregar cartões.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brand || !/^\d{4}$/.test(lastFourDigits)) {
      setToast({ message: "Preencha a bandeira e os 4 últimos dígitos.", type: "error" });
      return;
    }

    try {
      await creditCardService.create({
        brand,
        lastFourDigits,
        nickname: nickname.trim() || undefined,
      });
      await loadCards();
      setBrand("");
      setLastFourDigits("");
      setNickname("");
      setToast({ message: "Cartão cadastrado com sucesso!", type: "success" });
    } catch {
      setToast({ message: "Erro ao cadastrar cartão.", type: "error" });
    }
  };

  const handleDeactivate = async () => {
    if (!deletingCard) return;
    try {
      await creditCardService.deactivate(deletingCard.id);
      await loadCards();
      if (selectedCardId === String(deletingCard.id)) {
        setSelectedCardId("");
      }
      setToast({ message: "Cartão removido.", type: "success" });
    } catch {
      setToast({ message: "Erro ao remover cartão.", type: "error" });
    } finally {
      setShowDelete(false);
      setDeletingCard(null);
    }
  };

  const filteredPayments = useMemo(() => {
    if (!selectedCardId) return [];
    return payments.filter((p) => String(p.creditCardId ?? "") === selectedCardId);
  }, [payments, selectedCardId]);

  const filteredTotal = filteredPayments.reduce((acc, p) => acc + Number(p.value), 0);

  return (
    <div className="space-y-6 px-1">
      {/* ── Cabeçalho ── */}
      <div>
        <h2
          className="text-xl font-bold flex items-center gap-2"
          style={{ color: "var(--financial-trust)" }}
        >
          <CreditCardIcon className="h-5 w-5" />
          Cartões
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Cadastre seus cartões e filtre os gastos por cartão
        </p>
      </div>

      {/* ── Cadastro de cartão ── */}
      <Card style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: "var(--card-foreground)" }}>
            <Plus className="h-5 w-5" />
            Novo Cartão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Bandeira</Label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger className="select-trigger" id="brand">
                    <SelectValue placeholder="Selecionar bandeira" />
                  </SelectTrigger>
                  <SelectContent className="select-content">
                    {BRAND_OPTIONS.map((option) => (
                      <SelectItem key={option} className="select-item" value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastFourDigits">Últimos 4 dígitos</Label>
                <Input
                  id="lastFourDigits"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  value={lastFourDigits}
                  onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Apelido (opcional)</Label>
                <Input
                  id="nickname"
                  type="text"
                  placeholder="Ex: Nubank Roxinho"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            <Button
              type="submit"
              style={{ background: "var(--financial-trust)", color: "white" }}
            >
              Cadastrar Cartão
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Lista de cartões ── */}
      <Card style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--card-foreground)" }}>Meus Cartões</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p style={{ color: "var(--muted-foreground)" }}>Carregando cartões...</p>
          ) : cards.length === 0 ? (
            <p className="text-center py-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Nenhum cartão cadastrado ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <li
                  key={card.id}
                  className="p-3 rounded-lg border flex justify-between items-center gap-3"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}
                >
                  <span className="font-medium" style={{ color: "var(--card-foreground)" }}>
                    {cardLabel(card)}
                  </span>
                  <button
                    type="button"
                    title="Remover cartão"
                    onClick={() => {
                      setDeletingCard(card);
                      setShowDelete(true);
                    }}
                    className="hover:opacity-70 cursor-pointer"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Filtro de gastos por cartão ── */}
      <Card style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--card-foreground)" }}>Gastos por Cartão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filterCard">Cartão</Label>
              <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                <SelectTrigger className="select-trigger" id="filterCard">
                  <SelectValue placeholder="Selecionar cartão" />
                </SelectTrigger>
                <SelectContent className="select-content">
                  {cards.map((card) => (
                    <SelectItem key={card.id} className="select-item" value={String(card.id)}>
                      {cardLabel(card)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setYearMonth((ym) => addMonths(ym, -1))}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                ← Anterior
              </button>
              <span className="font-semibold text-sm" style={{ color: "var(--financial-trust)" }}>
                {formatYearMonth(yearMonth)}
              </span>
              <button
                type="button"
                onClick={() => setYearMonth((ym) => addMonths(ym, 1))}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                Próximo →
              </button>
            </div>
          </div>

          {!selectedCardId ? (
            <p className="text-center py-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Selecione um cartão para ver os gastos do mês.
            </p>
          ) : loadingPayments ? (
            <p style={{ color: "var(--muted-foreground)" }}>Carregando gastos...</p>
          ) : filteredPayments.length === 0 ? (
            <p className="text-center py-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Nenhum gasto encontrado para este cartão em {formatYearMonth(yearMonth)}.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {filteredPayments.map((item) => (
                  <li
                    key={item.outgoingId}
                    className="p-3 rounded-lg border flex justify-between items-center gap-3"
                    style={{ borderColor: "var(--border)", background: "var(--card)" }}
                  >
                    <span style={{ color: "var(--card-foreground)" }}>{item.description}</span>
                    <strong style={{ color: "var(--financial-danger)" }}>
                      R$ {Number(item.value).toFixed(2)}
                    </strong>
                  </li>
                ))}
              </ul>
              <div className="text-right font-bold text-sm" style={{ color: "var(--card-foreground)" }}>
                Total: R$ {filteredTotal.toFixed(2)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {deletingCard && (
        <DeleteConfirmModal
          open={showDelete}
          title="Remover cartão?"
          description="O cartão será removido da lista, mas as despesas já associadas a ele serão preservadas."
          onConfirm={handleDeactivate}
          onCancel={() => {
            setShowDelete(false);
            setDeletingCard(null);
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
