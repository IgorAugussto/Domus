// Banco isolado, com schema mínimo; não executar contra banco remoto.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`create role authenticated;
    create table public.credit_cards (id bigint primary key, user_id bigint, active boolean, statement_closing_day smallint);
    create table public.outgoing (id bigint primary key, user_id bigint, credit_card_id bigint, payment_type varchar, description varchar, value numeric, start_date date, duration_in_months integer, purchase_at timestamptz, frequency varchar, category varchar);
    create table public.income (user_id bigint, value numeric, recurring boolean, start_date date, end_date date, frequency varchar);
    create table public.investments (user_id bigint, value numeric, expected_return numeric, start_date date, end_date date);
    create table public.payment_status (outgoing_id bigint, year_month varchar, paid boolean, created_at timestamptz, updated_at timestamptz, unique(outgoing_id,year_month));
    create function public.ensure_current_domus_user() returns bigint language plpgsql stable as $$ begin if nullif(current_setting('test.owner', true), '') is null then raise exception 'Autenticação obrigatória'; end if; return current_setting('test.owner')::bigint; end $$;
    select set_config('test.owner', '1', false);
    insert into credit_cards values (1,1,true,7);
  `);
  await db.exec(await readFile('supabase/migrations/20261126123000_v2_annual_expenses.sql', 'utf8'));
  await db.exec(`insert into outgoing (id,user_id,credit_card_id,payment_type,description,value,start_date,duration_in_months,frequency,category,installment_total) values
    (1,1,1,'Cartão de Crédito','parcelado',33.34,'2026-11-08',3,'Monthly','Other',100),
    (2,1,1,'Cartão de Crédito','anual',300,'2026-11-08',36,'Yearly','Other',null),
    (3,1,1,'Cartão de Crédito','legado',20,'2026-11-08',2,'Monthly','Other',null),
    (4,2,1,'Cartão de Crédito','outro',999,'2026-11-08',2,'Monthly','Other',null);`);
  const month = async m => (await db.query('select outgoing_id::int as id, value::text as value from public.domus_monthly_payments($1) order by outgoing_id', [m])).rows;
  assert.deepEqual(await month('2026-11'), [{id:1,value:'33.3400000000000000'},{id:2,value:'300'},{id:3,value:'20'}]);
  assert.deepEqual(await month('2026-12'), [{id:1,value:'33.3300000000000000'},{id:3,value:'20'}]);
  assert.deepEqual(await month('2027-01'), [{id:1,value:'33.3300000000000000'}]);
  assert.deepEqual(await month('2027-11'), [{id:2,value:'300'}]);
  assert.deepEqual(await month('2029-11'), []);
  let r=(await db.query("select sum(value)::numeric as total from public.domus_card_statement_items(1,'2026-12-01')")).rows[0]; assert.equal(Number(r.total),353.34);
  r=(await db.query("select expenses from public.domus_year_projection(2027) where month = '2027-01'")).rows[0]; assert.equal(Number(r.expenses),33.33);
  await assert.rejects(() => db.query("select * from public.domus_set_payment_status(2,'2026-12',true)"), /não está ativa/);
  await db.query("select * from public.domus_set_payment_status(2,'2027-11',true)");
  await assert.rejects(() => db.query("insert into outgoing (id,user_id,value,frequency,start_date,duration_in_months,installment_total) values (5,1,33.33,'Monthly','2026-01-01',3,100)"), /outgoing_installment_total_valid/);
  await db.exec("select set_config('test.owner', '2', false)");
  assert.deepEqual(await month('2026-11'), [{id:4,value:'999'}]);
  await assert.rejects(() => db.query("select * from public.domus_card_statement_items(1,'2026-12-01')"), /Cartão não encontrado/);
  await db.exec("select set_config('test.owner', '', false)");
  await assert.rejects(() => month('2026-11'), /Autenticação obrigatória/);
  console.log('OK: parcelas exatas, anual, faturas, projeção, pagamentos, legado e isolamento');
} finally { await db.close(); }
