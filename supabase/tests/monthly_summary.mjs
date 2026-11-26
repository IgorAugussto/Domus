// Requires PGlite installed separately; see statement_cycle.mjs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to the local PGlite entry point');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`create role authenticated;
    create function public.domus_year_projection(integer)
    returns table (month varchar, income numeric, expenses numeric, investments numeric)
    language sql as $$ values ('2026-01'::varchar, 1000, 300, 100),
      ('2026-02'::varchar, 2000, 500, 100), ('2026-03'::varchar, 0, 200, 100) $$;`);
  await db.exec(await readFile('supabase/migrations/20261126121000_v2_fix_monthly_summary.sql', 'utf8'));
  const query = async month => (await db.query('select income::int, expenses::int, net_worth::int, savings_rate::int from public.domus_monthly_summary($1)', [month])).rows[0];
  assert.deepEqual(await query('2026-02'), { income: 2000, expenses: 500, net_worth: 2200, savings_rate: 75 });
  assert.deepEqual(await query('2026-03'), { income: 0, expenses: 200, net_worth: 2000, savings_rate: null });
  console.log('OK: renda do mês, acumulado previsto e taxa indisponível sem renda');
} finally { await db.close(); }
