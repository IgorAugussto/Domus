/** Divide um valor em centavos sem perder o resto. */
export function splitInstallmentTotal(input: string, count: number) {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || !Number.isSafeInteger(count) || count < 2) return null;
  const [whole, fractional = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < count) return null;
  const baseCents = Math.floor(cents / count);
  const remainder = cents % count;
  return { total: cents / 100, first: (baseCents + (remainder > 0 ? 1 : 0)) / 100, last: baseCents / 100, remainder };
}

export function formatInstallmentParts(total: number, count: number): string {
  const split = splitInstallmentTotal(total.toFixed(2), count);
  if (!split) return `${count} parcelas`;
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return split.remainder === 0 ? `${count} × ${money(split.last)}` : `${split.remainder} × ${money(split.first)} + ${count - split.remainder} × ${money(split.last)}`;
}
