// Requires PGlite installed separately; see statement_cycle.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to the local PGlite entry point');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`create role authenticated;
    create function public.ensure_current_domus_user() returns bigint language sql stable as $$ select 1::bigint $$;
    create table public.income (user_id bigint, value numeric, recurring boolean, start_date date, end_date date);
    create table public.outgoing (user_id bigint, value numeric, start_date date, duration_in_months integer);
    create table public.investments (user_id bigint, value numeric, expected_return numeric, start_date date, end_date date);
    insert into income values
      (1, 1000, true, (date_trunc('month', current_date) - interval '1 month' + interval '9 days')::date, null),
      (2, 9999, true, (date_trunc('month', current_date) - interval '1 month')::date, null);
    insert into outgoing values
      (1, 200, (date_trunc('month', current_date) - interval '1 month' + interval '4 days')::date, 3),
      (2, 9999, current_date, 1);
  `);
  await db.exec(await readFile('supabase/migrations/20261126122000_v2_fix_daily_projection.sql', 'utf8'));
  const result = (await db.query('select sum(income)::int as income, sum(expenses)::int as expenses, count(*) filter (where income > 0)::int as income_days, count(*) filter (where expenses > 0)::int as expense_days from public.domus_current_month_projection()')).rows[0];
  assert.deepEqual(result, { income: 1000, expenses: 200, income_days: 1, expense_days: 1 });
  console.log('OK: receitas e despesas aparecem uma vez no mês e respeitam o dono');
} finally { await db.close(); }
