/** Monetary values in the contract are safe integers in centavos, never floats. */
export type Centavos = number & { readonly __centavos: unique symbol };

export function parseCentavos(value: string): Centavos | null {
  const match = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = (Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"))) * (match[1] ? -1 : 1);
  return Number.isSafeInteger(cents) ? cents as Centavos : null;
}

export function sumCentavos(values: readonly Centavos[]): Centavos | null {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(total + value)) return null;
    total += value;
  }
  return total as Centavos;
}

/** Missing or incomplete data must not be mistaken for an empty list. */
export type DataSet<T> =
  | { status: "complete"; items: readonly T[] }
  | { status: "partial"; items: readonly T[]; reason: string }
  | { status: "unavailable"; reason: string };

export interface SnapshotAccount {
  id: string;
  name: string;
  holder: string;
  balance: Centavos;
  confirmedAt: string;
}

export interface AccountBalanceRow {
  account_id: number;
  name: string;
  holder_name: string;
  balance: string;
  confirmed_at: string;
}

/** Convert only a successfully loaded, complete account response. */
export function accountsFromBalances(rows: readonly AccountBalanceRow[]): DataSet<SnapshotAccount> {
  const items: SnapshotAccount[] = [];
  const ids = new Set<number>();
  for (const row of rows) {
    const balance = parseCentavos(row.balance);
    if (!Number.isSafeInteger(row.account_id) || row.account_id <= 0 || ids.has(row.account_id) || balance === null) {
      return { status: "unavailable", reason: "Os saldos recebidos são inválidos ou contêm contas duplicadas." };
    }
    ids.add(row.account_id);
    items.push({ id: String(row.account_id), name: row.name, holder: row.holder_name, balance, confirmedAt: row.confirmed_at });
  }
  return { status: "complete", items };
}

/** Actual settlements and planned obligations are separate; a credit purchase is not a cash payment. */
export type FinancialEvent =
  | { id: string; kind: "income_received" | "expense_paid" | "statement_paid"; accountId: string; amount: Centavos; date: string; sourceId: string; sourceMonth: string }
  | { id: string; kind: "reversal"; accountId: string; signedAmount: Centavos; date: string; reversalOf: string }
  | { id: string; kind: "income_expected" | "expense_due" | "statement_due"; accountId: string | null; amount: Centavos; date: string | null; sourceId: string; sourceMonth: string }
  | { id: string; kind: "credit_purchase"; cardId: string; amount: Centavos; date: string | null; sourceId: string };

export interface FinancialSnapshotV1 {
  version: 1;
  currency: "BRL";
  timeZone: "America/Sao_Paulo";
  referenceDate: string;
  capturedAt: string;
  accounts: DataSet<SnapshotAccount>;
  events: DataSet<FinancialEvent>;
}

export function snapshotFromAccounts(input: {
  referenceDate: string;
  capturedAt: string;
  accounts: DataSet<SnapshotAccount>;
}): FinancialSnapshotV1 {
  return {
    version: 1,
    currency: "BRL",
    timeZone: "America/Sao_Paulo",
    ...input,
    events: { status: "unavailable", reason: "Eventos financeiros ainda não foram carregados integralmente." },
  };
}
