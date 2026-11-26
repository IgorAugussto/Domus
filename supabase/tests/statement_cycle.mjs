// Isolated PostgreSQL-compatible test. Requires PGlite installed separately.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/tests/statement_cycle.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to the local PGlite entry point');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`
    create role authenticated;
    create table public.credit_cards (id bigint primary key, user_id bigint, active boolean, statement_closing_day smallint);
    create table public.outgoing (id bigint primary key, user_id bigint, credit_card_id bigint, payment_type text,
      description varchar, value numeric, start_date date, duration_in_months integer, purchase_at timestamptz);
    create function public.ensure_current_domus_user() returns bigint language sql stable as $$
      select nullif(current_setting('test.owner', true), '')::bigint
    $$;
    insert into public.credit_cards values (1, 1, true, 7), (2, 2, true, 7), (3, 1, true, null), (4, 1, true, 31);
    insert into public.outgoing values
      (1, 1, 1, 'Cartão de Crédito', 'before', 10, '2026-11-06', 1, null),
      (2, 1, 1, 'Cartão de Crédito', 'on close', 20, '2026-11-07', 1, null),
      (3, 1, 1, 'Cartão de Crédito', 'captured instalments', 200, '2026-11-08', 3, '2026-11-08 12:00:00-03'),
      (4, 2, 1, 'Cartão de Crédito', 'other owner', 999, '2026-11-06', 1, null),
      (5, 1, 1, 'Boleto', 'wrong type', 999, '2026-11-06', 1, null),
      (6, 1, 4, 'Cartão de Crédito', 'month end', 50, '2028-01-31', 2, null);
    select set_config('test.owner', '1', false);
  `);
  await db.exec(await readFile('supabase/migrations/20261126120000_v2_fix_statement_cycle.sql', 'utf8'));
  async function rows(card, month) {
    return (await db.query('select outgoing_id::int as id, value::text as value, transaction_date::text as date from public.domus_card_statement_items($1, $2)', [card, month])).rows;
  }
  assert.deepEqual(await rows(1, '2026-11-01'), [{ id: 1, value: '10', date: '2026-11-06' }]);
  assert.deepEqual(await rows(1, '2026-12-01'), [
    { id: 2, value: '20', date: '2026-11-07' },
    { id: 3, value: '200', date: '2026-11-08' },
  ]);
  assert.deepEqual(await rows(1, '2027-01-01'), [{ id: 3, value: '200', date: '2026-12-08' }]);
  assert.deepEqual(await rows(1, '2027-02-01'), [{ id: 3, value: '200', date: '2027-01-08' }]);
  assert.deepEqual(await rows(1, '2027-03-01'), []);
  assert.deepEqual(await rows(4, '2028-02-01'), [{ id: 6, value: '50', date: '2028-01-31' }]);
  assert.deepEqual(await rows(4, '2028-03-01'), [{ id: 6, value: '50', date: '2028-02-29' }]);
  await assert.rejects(() => rows(2, '2026-11-01'), /Cartão não encontrado/);
  await assert.rejects(() => rows(3, '2026-11-01'), /dia de fechamento/);
  await assert.rejects(() => rows(1, '2026-11-02'), /primeiro dia/);
  console.log('OK: ciclos, fechamento, parcelas capturadas, fim de mês e validação de acesso');
} finally { await db.close(); }
