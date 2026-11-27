const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCentavos, sumCentavos, accountsFromBalances, snapshotFromAccounts } = require(process.env.DOMUS_FINANCIAL_TEST_MODULE);

test("interpreta valores e soma centavos sem erros de ponto flutuante", () => {
  assert.equal(parseCentavos("0.10"), 10);
  assert.equal(parseCentavos("-2.9"), -290);
  assert.equal(sumCentavos([parseCentavos("0.10"), parseCentavos("0.20")]), 30);
  for (const value of ["1.001", "1e3", "1,20", "NaN", "9999999999999.00"]) assert.equal(parseCentavos(value), null);
  assert.equal(sumCentavos([Number.MAX_SAFE_INTEGER, 1]), null);
});

test("registra contas separadas e não confunde dados ausentes com zero", () => {
  const rows = [
    { account_id: 1, name: "Conta A", holder_name: "A", balance: "1000.00", confirmed_at: "2026-11-27T12:00:00Z" },
    { account_id: 2, name: "Conta B", holder_name: "B", balance: "-10.25", confirmed_at: "2026-11-27T12:00:00Z" },
  ];
  const accounts = accountsFromBalances(rows);
  assert.equal(accounts.status, "complete");
  assert.deepEqual(accounts.items.map(item => item.balance), [100000, -1025]);
  assert.equal(sumCentavos(accounts.items.map(item => item.balance)), 98975);
  assert.equal(accountsFromBalances([rows[0], rows[0]]).status, "unavailable");
  assert.equal(accountsFromBalances([{ ...rows[0], balance: "?" }]).status, "unavailable");
  const snapshot = snapshotFromAccounts({ referenceDate: "2026-11-27", capturedAt: "2026-11-27T12:00:00Z", accounts });
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.events.status, "unavailable");
  assert.deepEqual(accountsFromBalances([]), { status: "complete", items: [] });
});
