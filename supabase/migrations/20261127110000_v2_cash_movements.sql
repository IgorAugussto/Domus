-- Movimentos efetivos vinculados a contas. Não cria nem modifica lançamentos existentes.
begin;

alter table public.outgoing add column if not exists planned_account_id bigint references public.financial_accounts(id);

create or replace function public.domus_validate_planned_account()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if new.planned_account_id is not null and not exists (
    select 1 from public.financial_accounts a where a.id = new.planned_account_id
      and a.user_id = new.user_id and a.user_id = public.current_domus_user_id()
  ) then raise exception 'Conta não encontrada' using errcode = '42501'; end if;
  return new;
end;
$$;
revoke all on function public.domus_validate_planned_account() from public, anon, authenticated;
create trigger domus_validate_outgoing_planned_account before insert or update of planned_account_id, user_id
  on public.outgoing for each row execute function public.domus_validate_planned_account();

create table public.income_monthly_overrides (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id),
  income_id bigint not null references public.income(id) on delete restrict,
  source_month date not null check (extract(day from source_month) = 1),
  value numeric(14,2) not null check (value > 0),
  request_key text not null check (length(request_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);
create index income_monthly_overrides_lookup_idx on public.income_monthly_overrides(income_id, source_month, id desc);
alter table public.income_monthly_overrides enable row level security;
revoke all on public.income_monthly_overrides from public, anon, authenticated;
create policy income_monthly_overrides_owner_read on public.income_monthly_overrides for select to authenticated
  using (user_id = public.current_domus_user_id());
grant select on public.income_monthly_overrides to authenticated;

create or replace function public.domus_income_month_value(p_income_id bigint, p_source_month date)
returns text language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); item public.income%rowtype; result numeric;
begin
  if p_source_month is null or extract(day from p_source_month) <> 1 then raise exception 'Competência inválida' using errcode = '22023'; end if;
  select * into item from public.income i where i.id = p_income_id and i.user_id = owner_id;
  if not found then raise exception 'Receita não encontrada' using errcode = 'P0002'; end if;
  if date_trunc('month', item.start_date)::date > p_source_month
    or (item.end_date is not null and date_trunc('month', item.end_date)::date < p_source_month)
    or (not coalesce(item.recurring, false) and date_trunc('month', item.start_date)::date <> p_source_month) then
    raise exception 'Receita não está prevista nessa competência' using errcode = '22023';
  end if;
  select x.value into result from public.income_monthly_overrides x
    where x.user_id = owner_id and x.income_id = p_income_id and x.source_month = p_source_month order by x.id desc limit 1;
  return coalesce(result, item.value)::text;
end;
$$;

create or replace function public.domus_set_income_month_value(p_income_id bigint, p_source_month date, p_value numeric, p_request_key text)
returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); existing public.income_monthly_overrides%rowtype;
begin
  if p_value is null or p_value <= 0 or p_value <> round(p_value, 2) or p_value > 999999999999.99 then
    raise exception 'Informe um valor positivo com até duas casas decimais' using errcode = '22023';
  end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'Identificador da solicitação inválido' using errcode = '22023'; end if;
  perform 1 from public.income i where i.id = p_income_id and i.user_id = owner_id for update;
  if not found then raise exception 'Receita não encontrada' using errcode = 'P0002'; end if;
  perform public.domus_income_month_value(p_income_id, p_source_month);
  select * into existing from public.income_monthly_overrides x where x.user_id = owner_id and x.request_key = p_request_key;
  if found then
    if existing.income_id = p_income_id and existing.source_month = p_source_month and existing.value = p_value then return; end if;
    raise exception 'Identificador já usado para outro ajuste' using errcode = '23505';
  end if;
  insert into public.income_monthly_overrides(user_id, income_id, source_month, value, request_key)
    values (owner_id, p_income_id, p_source_month, p_value, p_request_key);
end;
$$;

revoke all on function public.domus_income_month_value(bigint, date) from public, anon;
revoke all on function public.domus_set_income_month_value(bigint, date, numeric, text) from public, anon;
grant execute on function public.domus_income_month_value(bigint, date) to authenticated;
grant execute on function public.domus_set_income_month_value(bigint, date, numeric, text) to authenticated;

create table public.financial_cash_movements (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id),
  account_id bigint not null references public.financial_accounts(id),
  kind text not null check (kind in ('income', 'expense', 'statement', 'reversal')),
  amount numeric(14,2) not null check (amount > 0),
  signed_amount numeric(14,2) not null,
  effective_date date not null,
  source_month date,
  income_id bigint references public.income(id) on delete restrict,
  outgoing_id bigint references public.outgoing(id) on delete restrict,
  credit_card_id bigint references public.credit_cards(id) on delete restrict,
  reversal_of bigint unique references public.financial_cash_movements(id),
  request_key text not null check (length(request_key) between 16 and 128),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint financial_cash_movements_request_unique unique (user_id, request_key),
  constraint financial_cash_movements_source_month_check check (source_month is null or extract(day from source_month) = 1),
  constraint financial_cash_movements_source_check check (
    (kind = 'income' and income_id is not null and outgoing_id is null and credit_card_id is null and reversal_of is null and source_month is not null and signed_amount = amount)
    or (kind = 'expense' and income_id is null and outgoing_id is not null and credit_card_id is null and reversal_of is null and source_month is not null and signed_amount = -amount)
    or (kind = 'statement' and income_id is null and outgoing_id is null and credit_card_id is not null and reversal_of is null and source_month is not null and signed_amount = -amount)
    or (kind = 'reversal' and income_id is null and outgoing_id is null and credit_card_id is null and reversal_of is not null and source_month is null and abs(signed_amount) = amount)
  )
);
create index financial_cash_movements_account_idx on public.financial_cash_movements(account_id, effective_date, id);
create index financial_cash_movements_income_idx on public.financial_cash_movements(income_id, source_month) where income_id is not null;
create index financial_cash_movements_outgoing_idx on public.financial_cash_movements(outgoing_id, source_month) where outgoing_id is not null;
create index financial_cash_movements_card_idx on public.financial_cash_movements(credit_card_id, source_month) where credit_card_id is not null;

alter table public.financial_cash_movements enable row level security;
revoke all on public.financial_cash_movements from public, anon, authenticated;
create policy financial_cash_movements_owner_read on public.financial_cash_movements for select to authenticated
  using (user_id = public.current_domus_user_id());
grant select on public.financial_cash_movements to authenticated;

-- Não reinterpreta uma despesa que já tenha pagamento efetivo ativo.
create or replace function public.domus_protect_paid_expense()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if (new.value, new.start_date, new.duration_in_months, new.frequency, new.payment_type, new.installment_total, new.user_id)
     is distinct from
     (old.value, old.start_date, old.duration_in_months, old.frequency, old.payment_type, old.installment_total, old.user_id)
     and exists (select 1 from public.financial_cash_movements m
       where m.kind = 'expense' and m.outgoing_id = old.id
         and not exists (select 1 from public.financial_cash_movements r where r.reversal_of = m.id)) then
    raise exception 'A despesa tem pagamento registrado; estorne-o antes de alterar valor, data ou frequência' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.domus_protect_paid_expense() from public, anon, authenticated;
create trigger domus_protect_paid_expense before update of value, start_date, duration_in_months, frequency, payment_type, installment_total, user_id
  on public.outgoing for each row execute function public.domus_protect_paid_expense();

-- Cada ajuste confirma o saldo considerando também os movimentos efetivos anteriores.
create or replace function public.domus_adjust_financial_account(
  p_account_id bigint, p_confirmed_balance numeric, p_note text default null
) returns void language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); initial_balance numeric; old_balance numeric;
begin
  if p_confirmed_balance is null or p_confirmed_balance <> round(p_confirmed_balance, 2)
     or abs(p_confirmed_balance) > 999999999999.99 then
    raise exception 'Informe um saldo válido com até duas casas decimais' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Observação muito longa' using errcode = '22023'; end if;
  select a.opening_balance into initial_balance from public.financial_accounts a
    where a.id = p_account_id and a.user_id = owner_id for update;
  if not found then raise exception 'Conta não encontrada' using errcode = 'P0002'; end if;
  select initial_balance
    + coalesce((select sum(x.delta) from public.financial_account_adjustments x where x.account_id = p_account_id), 0)
    + coalesce((select sum(m.signed_amount) from public.financial_cash_movements m where m.account_id = p_account_id), 0)
    into old_balance;
  insert into public.financial_account_adjustments (account_id, delta, confirmed_balance, note)
    values (p_account_id, p_confirmed_balance - old_balance, p_confirmed_balance, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.domus_financial_account_balances()
returns table (account_id bigint, name text, holder_name text, opening_date date, balance text, confirmed_at timestamptz)
language sql security definer set search_path = public, pg_catalog as $$
  with owner as (select public.ensure_current_domus_user() as id)
  select a.id, a.name, a.holder_name, a.opening_date,
    (a.opening_balance
      + coalesce((select sum(x.delta) from public.financial_account_adjustments x where x.account_id = a.id), 0)
      + coalesce((select sum(m.signed_amount) from public.financial_cash_movements m where m.account_id = a.id), 0))::text,
    greatest(a.created_at, coalesce((select max(x.created_at) from public.financial_account_adjustments x where x.account_id = a.id), a.created_at),
      coalesce((select max(m.created_at) from public.financial_cash_movements m where m.account_id = a.id), a.created_at))
  from public.financial_accounts a cross join owner
  where a.user_id = owner.id order by a.id;
$$;

-- Eventos imutáveis: o identificador de solicitação permite repetição segura após perda de resposta.
create or replace function public.domus_record_cash_movement(
  p_account_id bigint, p_kind text, p_amount numeric, p_effective_date date,
  p_source_id bigint, p_source_month date, p_request_key text, p_note text default null
) returns bigint language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  owner_id bigint := public.ensure_current_domus_user();
  account_row public.financial_accounts%rowtype;
  existing public.financial_cash_movements%rowtype;
  expense_row public.outgoing%rowtype;
  income_row public.income%rowtype;
  already_paid numeric; expected numeric; movement_id bigint; latest_adjustment date;
begin
  if p_kind not in ('income', 'expense', 'statement') or p_kind is null then raise exception 'Tipo de movimentação inválido' using errcode = '22023'; end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'Identificador da solicitação inválido' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount > 999999999999.99 then raise exception 'Informe um valor positivo com até duas casas decimais' using errcode = '22023'; end if;
  if p_source_month is null or extract(day from p_source_month) <> 1 then raise exception 'Competência inválida' using errcode = '22023'; end if;
  if p_effective_date is null or p_effective_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data efetiva não pode ser futura' using errcode = '22023'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Observação muito longa' using errcode = '22023'; end if;

  select * into account_row from public.financial_accounts a where a.id = p_account_id and a.user_id = owner_id for update;
  if not found then raise exception 'Conta não encontrada' using errcode = 'P0002'; end if;
  select * into existing from public.financial_cash_movements m where m.user_id = owner_id and m.request_key = p_request_key;
  if found then
    if existing.account_id = p_account_id and existing.kind = p_kind and existing.amount = p_amount
      and existing.effective_date = p_effective_date and existing.source_month = p_source_month
      and coalesce(existing.income_id, existing.outgoing_id, existing.credit_card_id) = p_source_id
      and existing.note is not distinct from nullif(trim(p_note), '') then return existing.id; end if;
    raise exception 'Identificador já usado para outra movimentação' using errcode = '23505';
  end if;
  if p_effective_date < account_row.opening_date then raise exception 'A data é anterior ao saldo inicial da conta' using errcode = '22023'; end if;
  select max((x.created_at at time zone 'America/Sao_Paulo')::date) into latest_adjustment
    from public.financial_account_adjustments x where x.account_id = p_account_id;
  if latest_adjustment is not null and p_effective_date < latest_adjustment then
    raise exception 'A data é anterior ao último ajuste de saldo; confirme se o movimento já está incluído no saldo' using errcode = '22023';
  end if;

  if p_kind = 'income' then
    select * into income_row from public.income i where i.id = p_source_id and i.user_id = owner_id for update;
    if not found then raise exception 'Receita não encontrada' using errcode = 'P0002'; end if;
    if date_trunc('month', income_row.start_date)::date > p_source_month
      or (income_row.end_date is not null and date_trunc('month', income_row.end_date)::date < p_source_month)
      or (not coalesce(income_row.recurring, false) and date_trunc('month', income_row.start_date)::date <> p_source_month) then
      raise exception 'Receita não está prevista nessa competência' using errcode = '22023';
    end if;
  elsif p_kind = 'expense' then
    select * into expense_row from public.outgoing o where o.id = p_source_id and o.user_id = owner_id for update;
    if not found then raise exception 'Despesa não encontrada' using errcode = 'P0002'; end if;
    if expense_row.payment_type = 'Cartão de Crédito' then raise exception 'Compras no cartão devem ser pagas pela fatura' using errcode = '22023'; end if;
    if not public.domus_expense_occurs(expense_row.start_date, expense_row.duration_in_months, expense_row.frequency, p_source_month) then
      raise exception 'Despesa não está prevista nessa competência' using errcode = '22023';
    end if;
    expected := public.domus_installment_value(expense_row.value, expense_row.installment_total, expense_row.duration_in_months,
      (extract(year from p_source_month)::integer - extract(year from expense_row.start_date)::integer) * 12 + extract(month from p_source_month)::integer - extract(month from expense_row.start_date)::integer);
    select coalesce(sum(m.amount), 0) into already_paid from public.financial_cash_movements m
      where m.user_id = owner_id and m.kind = 'expense' and m.outgoing_id = p_source_id and m.source_month = p_source_month
      and not exists (select 1 from public.financial_cash_movements r where r.reversal_of = m.id);
    if already_paid + p_amount > expected then raise exception 'O pagamento excede o valor pendente da despesa' using errcode = '22023'; end if;
  else
    perform 1 from public.credit_cards c where c.id = p_source_id and c.user_id = owner_id for update;
    if not found then raise exception 'Cartão não encontrado' using errcode = 'P0002'; end if;
  end if;

  insert into public.financial_cash_movements (user_id, account_id, kind, amount, signed_amount, effective_date,
    source_month, income_id, outgoing_id, credit_card_id, request_key, note)
  values (owner_id, p_account_id, p_kind, p_amount, case when p_kind = 'income' then p_amount else -p_amount end,
    p_effective_date, p_source_month, case when p_kind = 'income' then p_source_id end,
    case when p_kind = 'expense' then p_source_id end, case when p_kind = 'statement' then p_source_id end,
    p_request_key, nullif(trim(p_note), '')) returning id into movement_id;
  return movement_id;
end;
$$;

create or replace function public.domus_reverse_cash_movement(p_movement_id bigint, p_request_key text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); original public.financial_cash_movements%rowtype; existing public.financial_cash_movements%rowtype; reversed_id bigint;
begin
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'Identificador da solicitação inválido' using errcode = '22023'; end if;
  if length(coalesce(p_note, '')) > 500 then raise exception 'Observação muito longa' using errcode = '22023'; end if;
  select * into original from public.financial_cash_movements m where m.id = p_movement_id and m.user_id = owner_id;
  if not found or original.kind = 'reversal' then raise exception 'Movimentação não encontrada' using errcode = 'P0002'; end if;
  perform 1 from public.financial_accounts a where a.id = original.account_id and a.user_id = owner_id for update;
  select * into existing from public.financial_cash_movements m where m.user_id = owner_id and m.request_key = p_request_key;
  if found then
    if existing.kind = 'reversal' and existing.reversal_of = original.id and existing.note is not distinct from nullif(trim(p_note), '') then return existing.id; end if;
    raise exception 'Identificador já usado para outra movimentação' using errcode = '23505';
  end if;
  if exists (select 1 from public.financial_cash_movements m where m.reversal_of = original.id) then raise exception 'Movimentação já estornada' using errcode = '22023'; end if;
  insert into public.financial_cash_movements (user_id, account_id, kind, amount, signed_amount, effective_date, reversal_of, request_key, note)
    values (owner_id, original.account_id, 'reversal', original.amount, -original.signed_amount,
      (now() at time zone 'America/Sao_Paulo')::date, original.id, p_request_key, nullif(trim(p_note), '')) returning id into reversed_id;
  return reversed_id;
end;
$$;

create or replace function public.domus_list_cash_movements()
returns table (
  movement_id bigint, account_id bigint, kind text, amount text, signed_amount text,
  effective_date date, source_month date, income_id bigint, outgoing_id bigint,
  credit_card_id bigint, reversal_of bigint, reversed boolean, note text, created_at timestamptz
) language sql security definer set search_path = public, pg_catalog as $$
  with owner as (select public.ensure_current_domus_user() as id)
  select m.id, m.account_id, m.kind, m.amount::text, m.signed_amount::text,
    m.effective_date, m.source_month, m.income_id, m.outgoing_id, m.credit_card_id,
    m.reversal_of, exists(select 1 from public.financial_cash_movements r where r.reversal_of = m.id), m.note, m.created_at
  from public.financial_cash_movements m cross join owner where m.user_id = owner.id
  order by m.id desc limit 200;
$$;

create or replace function public.domus_cash_expense_totals(p_source_month date)
returns table (outgoing_id bigint, paid_total text, has_cash_movements boolean)
language sql security definer set search_path = public, pg_catalog as $$
  with owner as (select public.ensure_current_domus_user() as id)
  select m.outgoing_id,
    coalesce(sum(m.amount) filter (where not exists (select 1 from public.financial_cash_movements r where r.reversal_of = m.id)), 0)::text,
    true
  from public.financial_cash_movements m cross join owner
  where m.user_id = owner.id and m.kind = 'expense' and m.source_month = p_source_month
  group by m.outgoing_id;
$$;

create or replace function public.domus_cash_source_total(p_kind text, p_source_id bigint, p_source_month date)
returns text language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); total numeric;
begin
  if p_source_month is null or extract(day from p_source_month) <> 1 then raise exception 'Competência inválida' using errcode = '22023'; end if;
  if p_kind = 'income' then
    if not exists (select 1 from public.income i where i.id = p_source_id and i.user_id = owner_id) then raise exception 'Receita não encontrada' using errcode = 'P0002'; end if;
  elsif p_kind = 'expense' then
    if not exists (select 1 from public.outgoing o where o.id = p_source_id and o.user_id = owner_id) then raise exception 'Despesa não encontrada' using errcode = 'P0002'; end if;
  elsif p_kind = 'statement' then
    if not exists (select 1 from public.credit_cards c where c.id = p_source_id and c.user_id = owner_id) then raise exception 'Cartão não encontrado' using errcode = 'P0002'; end if;
  else raise exception 'Tipo de movimentação inválido' using errcode = '22023';
  end if;
  select coalesce(sum(m.amount), 0) into total from public.financial_cash_movements m
    where m.user_id = owner_id and m.kind = p_kind and m.source_month = p_source_month
      and coalesce(m.income_id, m.outgoing_id, m.credit_card_id) = p_source_id
      and not exists (select 1 from public.financial_cash_movements r where r.reversal_of = m.id);
  return total::text;
end;
$$;

-- Cadastro de Pix/débito já pagos grava despesa e saída de caixa na mesma transação.
create or replace function public.domus_create_immediate_expense(
  p_description varchar, p_amount numeric, p_date date, p_category varchar,
  p_payment_type varchar, p_account_id bigint, p_request_key text
) returns bigint language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); existing public.financial_cash_movements%rowtype;
  original public.outgoing%rowtype; new_id bigint;
begin
  if p_payment_type not in ('Pix', 'Débito') or p_payment_type is null then raise exception 'Tipo de pagamento inválido' using errcode = '22023'; end if;
  if p_description is null or length(trim(p_description)) = 0 or p_category is null or length(trim(p_category)) = 0 then
    raise exception 'Informe a descrição e a categoria' using errcode = '22023';
  end if;
  if p_request_key is null or length(p_request_key) not between 16 and 128 then raise exception 'Identificador da solicitação inválido' using errcode = '22023'; end if;
  perform 1 from public.financial_accounts a where a.id = p_account_id and a.user_id = owner_id for update;
  if not found then raise exception 'Conta não encontrada' using errcode = 'P0002'; end if;
  select * into existing from public.financial_cash_movements m where m.user_id = owner_id and m.request_key = p_request_key;
  if found then
    select * into original from public.outgoing o where o.id = existing.outgoing_id and o.user_id = owner_id;
    if found and existing.kind = 'expense' and existing.account_id = p_account_id and existing.amount = p_amount
      and existing.effective_date = p_date and original.payment_type = p_payment_type
      and original.description = trim(p_description) and original.category = p_category then return original.id; end if;
    raise exception 'Identificador já usado para outra movimentação' using errcode = '23505';
  end if;
  insert into public.outgoing (user_id, description, value, start_date, category, frequency, duration_in_months, payment_type, paid, planned_account_id)
    values (owner_id, trim(p_description), p_amount, p_date, p_category, 'One-time', 1, p_payment_type, true, p_account_id)
    returning id into new_id;
  perform public.domus_record_cash_movement(p_account_id, 'expense', p_amount, p_date, new_id,
    date_trunc('month', p_date)::date, p_request_key, null);
  return new_id;
end;
$$;

create or replace function public.domus_monthly_payments(p_year_month varchar)
returns table (
  outgoing_id bigint,
  description varchar,
  value numeric,
  category varchar,
  payment_type varchar,
  frequency varchar,
  start_date date,
  year_month varchar,
  paid boolean,
  credit_card_id bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with owner as (select public.ensure_current_domus_user() as id), target as (
    select to_date(p_year_month || '-01', 'YYYY-MM-DD') as month_start
  )
  select o.id, o.description, public.domus_installment_value(o.value, o.installment_total, o.duration_in_months, ((extract(year from target.month_start)::integer - extract(year from o.start_date)::integer) * 12 + extract(month from target.month_start)::integer - extract(month from o.start_date)::integer)), o.category, o.payment_type, o.frequency,
         o.start_date, p_year_month,
         coalesce(ps.paid, false), o.credit_card_id
  from public.outgoing o
  cross join owner
  cross join target
  left join public.payment_status ps
    on ps.outgoing_id = o.id and ps.year_month = p_year_month
  where o.user_id = owner.id
    and o.payment_type in ('Cartão de Crédito', 'Boleto', 'Pix', 'Débito')
    and public.domus_expense_occurs(o.start_date, o.duration_in_months, o.frequency, target.month_start)
  order by o.start_date, o.id;
$$;

create or replace function public.domus_set_payment_status(
  p_outgoing_id bigint,
  p_year_month varchar,
  p_paid boolean
)
returns table (
  outgoing_id bigint,
  description varchar,
  value numeric,
  category varchar,
  payment_type varchar,
  frequency varchar,
  start_date date,
  year_month varchar,
  paid boolean,
  credit_card_id bigint
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
#variable_conflict use_column
declare
  owner_id bigint := public.ensure_current_domus_user();
  item public.outgoing%rowtype;
  target_month date;
begin
  if p_year_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mês inválido' using errcode = '22007';
  end if;

  target_month := to_date(p_year_month || '-01', 'YYYY-MM-DD');
  select * into item from public.outgoing where id = p_outgoing_id and user_id = owner_id;
  if not found then raise exception 'Despesa não encontrada' using errcode = 'P0002'; end if;

  if item.payment_type not in ('Cartão de Crédito', 'Boleto', 'Pix', 'Débito')
     or not public.domus_expense_occurs(item.start_date, item.duration_in_months, item.frequency, target_month) then
    raise exception 'Despesa não está ativa no mês informado' using errcode = '22023';
  end if;

  if exists (select 1 from public.financial_cash_movements m where m.user_id = owner_id and m.kind = 'expense' and m.outgoing_id = p_outgoing_id and m.source_month = target_month) then
    raise exception 'Esta despesa tem movimentações: use a tela Movimentações para registrar ou estornar pagamentos' using errcode = '22023';
  end if;

  insert into public.payment_status (outgoing_id, year_month, paid, created_at, updated_at)
  values (item.id, p_year_month, p_paid, timezone('utc', now()), timezone('utc', now()))
  on conflict (outgoing_id, year_month) do update
    set paid = excluded.paid, updated_at = excluded.updated_at;

  return query select item.id, item.description, public.domus_installment_value(item.value, item.installment_total, item.duration_in_months, ((extract(year from target_month)::integer - extract(year from item.start_date)::integer) * 12 + extract(month from target_month)::integer - extract(month from item.start_date)::integer)), item.category,
    item.payment_type, item.frequency, item.start_date, p_year_month, p_paid, item.credit_card_id;
end;
$$;

create or replace function public.domus_year_projection(p_year integer default extract(year from current_date)::integer)
returns table (month varchar, income numeric, expenses numeric, investments numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with owner as (select public.ensure_current_domus_user() as id), months as (
    select date_trunc('month', make_date(p_year, n, 1))::date as month_start
    from generate_series(1, 12) as n
  )
  select to_char(m.month_start, 'YYYY-MM'),
    coalesce((select sum(coalesce((select x.value from public.income_monthly_overrides x where x.user_id = owner.id and x.income_id = i.id and x.source_month = m.month_start order by x.id desc limit 1), i.value)) from public.income i, owner
      where i.user_id = owner.id
        and ((coalesce(i.recurring, false) and date_trunc('month', i.start_date)::date <= m.month_start
             and (i.end_date is null or date_trunc('month', i.end_date)::date >= m.month_start))
          or (not coalesce(i.recurring, false) and date_trunc('month', i.start_date)::date = m.month_start))), 0),
    coalesce((select sum(public.domus_installment_value(o.value, o.installment_total, o.duration_in_months, ((extract(year from m.month_start)::integer - extract(year from o.start_date)::integer) * 12 + extract(month from m.month_start)::integer - extract(month from o.start_date)::integer))) from public.outgoing o, owner
      where o.user_id = owner.id
        and public.domus_expense_occurs(o.start_date, o.duration_in_months, o.frequency, m.month_start)), 0),
    coalesce((select sum(inv.value * power(1 + (inv.expected_return / 100 / 12),
          ((extract(year from m.month_start)::integer - extract(year from inv.start_date)::integer) * 12 +
           extract(month from m.month_start)::integer - extract(month from inv.start_date)::integer)))
      from public.investments inv, owner
      where inv.user_id = owner.id
        and date_trunc('month', inv.start_date)::date <= m.month_start
        and date_trunc('month', inv.end_date)::date >= m.month_start), 0)
  from months m
  order by m.month_start;
$$;

create or replace function public.domus_current_month_projection()
returns table (month varchar, income numeric, expenses numeric, investments numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with owner as (select public.ensure_current_domus_user() as id), bounds as (
    select date_trunc('month', current_date)::date as start_month,
      (date_trunc('month', current_date) + interval '1 month - 1 day')::date as end_month
  ), days as (
    select d::date as day from bounds,
      generate_series(bounds.start_month, bounds.end_month, interval '1 day') d
  )
  select to_char(days.day, 'YYYY-MM-DD'),
    coalesce((select sum(coalesce((select x.value from public.income_monthly_overrides x where x.user_id = owner.id and x.income_id = i.id and x.source_month = bounds.start_month order by x.id desc limit 1), i.value)) from public.income i, owner, bounds
      where i.user_id = owner.id
        and ((coalesce(i.recurring, false) and date_trunc('month', i.start_date)::date <= bounds.start_month
              and (i.end_date is null or date_trunc('month', i.end_date)::date >= bounds.start_month)
              and days.day = bounds.start_month + least(extract(day from i.start_date)::integer, extract(day from bounds.end_month)::integer) - 1)
          or (not coalesce(i.recurring, false) and days.day = i.start_date))), 0),
    coalesce((select sum(public.domus_installment_value(o.value, o.installment_total, o.duration_in_months, ((extract(year from bounds.start_month)::integer - extract(year from o.start_date)::integer) * 12 + extract(month from bounds.start_month)::integer - extract(month from o.start_date)::integer))) from public.outgoing o, owner, bounds
      where o.user_id = owner.id
        and public.domus_expense_occurs(o.start_date, o.duration_in_months, o.frequency, bounds.start_month)
        and days.day = bounds.start_month + least(extract(day from o.start_date)::integer, extract(day from bounds.end_month)::integer) - 1), 0),
    coalesce((select sum(inv.value * power(1 + (inv.expected_return / 100 / 12),
      ((extract(year from days.day)::integer - extract(year from inv.start_date)::integer) * 12 + extract(month from days.day)::integer - extract(month from inv.start_date)::integer)))
      from public.investments inv, owner
      where inv.user_id = owner.id and days.day between inv.start_date and inv.end_date), 0)
  from days order by days.day;
$$;

revoke all on function public.domus_record_cash_movement(bigint, text, numeric, date, bigint, date, text, text) from public, anon;
revoke all on function public.domus_reverse_cash_movement(bigint, text, text) from public, anon;
revoke all on function public.domus_list_cash_movements() from public, anon;
revoke all on function public.domus_cash_expense_totals(date) from public, anon;
revoke all on function public.domus_cash_source_total(text, bigint, date) from public, anon;
revoke all on function public.domus_create_immediate_expense(varchar, numeric, date, varchar, varchar, bigint, text) from public, anon;
grant execute on function public.domus_record_cash_movement(bigint, text, numeric, date, bigint, date, text, text) to authenticated;
grant execute on function public.domus_reverse_cash_movement(bigint, text, text) to authenticated;
grant execute on function public.domus_list_cash_movements() to authenticated;
grant execute on function public.domus_cash_expense_totals(date) to authenticated;
grant execute on function public.domus_cash_source_total(text, bigint, date) to authenticated;
grant execute on function public.domus_create_immediate_expense(varchar, numeric, date, varchar, varchar, bigint, text) to authenticated;
commit;
