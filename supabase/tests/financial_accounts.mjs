// Schema descartável em memória; não executar em banco remoto.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`create role authenticated; create role anon;
    create table public.users (id bigint primary key); insert into public.users values (1), (2);
    create function public.current_domus_user_id() returns bigint language sql stable as $$ select nullif(current_setting('test.owner', true), '')::bigint $$;
    create function public.ensure_current_domus_user() returns bigint language plpgsql stable as $$
      begin if public.current_domus_user_id() is null then raise exception 'Autenticação obrigatória'; end if; return public.current_domus_user_id(); end $$;
    grant execute on function public.current_domus_user_id() to authenticated;
  `);
  await db.exec(await readFile('supabase/migrations/20261127100000_v2_financial_accounts.sql', 'utf8'));
  await db.exec("set role authenticated; select set_config('test.owner', '1', false)");
  const create = async (name, balance) => (await db.query('select public.domus_create_financial_account($1,$2,$3,current_date) as id', [name, 'Titular', balance])).rows[0].id;
  const first = await create('Conta A', '1000.00');
  await create('Conta B', '500.00');
  await db.query('select public.domus_adjust_financial_account($1,$2,$3)', [first, '850.50', 'Conferência']);
  let balances = (await db.query('select name,balance from public.domus_financial_account_balances()')).rows;
  assert.deepEqual(balances, [{name:'Conta A',balance:'850.50'},{name:'Conta B',balance:'500.00'}]);
  let entries=(await db.query('select delta::text, confirmed_balance::text from public.financial_account_adjustments')).rows;
  assert.deepEqual(entries, [{delta:'-149.50', confirmed_balance:'850.50'}]);
  assert.equal((await db.query('select * from public.domus_financial_account_history($1)', [first])).rows.length, 1);
  await assert.rejects(() => db.query('update public.financial_accounts set opening_balance = 0'), /permission denied/);
  await assert.rejects(() => db.query("select public.domus_adjust_financial_account($1, 10.001, null)", [first]), /até duas casas/);
  await db.exec("select set_config('test.owner', '2', false)");
  assert.deepEqual((await db.query('select * from public.domus_financial_account_balances()')).rows, []);
  assert.deepEqual((await db.query('select * from public.financial_accounts')).rows, []);
  assert.deepEqual((await db.query('select * from public.financial_account_adjustments')).rows, []);
  await assert.rejects(() => db.query('select public.domus_adjust_financial_account($1,0,null)', [first]), /Conta não encontrada/);
  await assert.rejects(() => db.query('select * from public.domus_financial_account_history($1)', [first]), /Conta não encontrada/);
  await create('Conta de outra pessoa', '25.00');
  assert.equal((await db.query('select * from public.domus_financial_account_balances()')).rows.length, 1);
  await db.exec("select set_config('test.owner', '1', false)");
  assert.equal((await db.query('select * from public.domus_financial_account_balances()')).rows.length, 2);
  await assert.rejects(() => db.query("select public.domus_create_financial_account('Futura','Titular',1,current_date + 1)"), /não seja futura/);
  await db.exec("reset role; set role anon");
  await assert.rejects(() => db.query('select * from public.domus_financial_account_balances()'), /permission denied/);
  await assert.rejects(() => db.query('select * from public.financial_accounts'), /permission denied/);
  console.log('OK: saldos, histórico, isolamento de proprietários e acesso anônimo');
} finally { await db.close(); }
