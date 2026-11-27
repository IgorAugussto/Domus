-- Contas e ajustes manuais, sem modificar lançamentos financeiros existentes.
begin;

create table public.financial_accounts (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id),
  name text not null check (length(trim(name)) between 1 and 100),
  holder_name text not null check (length(trim(holder_name)) between 1 and 100),
  opening_balance numeric(14,2) not null,
  opening_date date not null,
  created_at timestamptz not null default now()
);

create table public.financial_account_adjustments (
  id bigint generated always as identity primary key,
  account_id bigint not null references public.financial_accounts(id),
  delta numeric(15,2) not null,
  confirmed_balance numeric(14,2) not null,
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now()
);
create index financial_accounts_user_id_idx on public.financial_accounts(user_id);
create index financial_account_adjustments_account_id_idx on public.financial_account_adjustments(account_id, id);

alter table public.financial_accounts enable row level security;
alter table public.financial_account_adjustments enable row level security;
revoke all on public.financial_accounts, public.financial_account_adjustments from public, anon, authenticated;
create policy financial_accounts_owner_select on public.financial_accounts for select to authenticated
  using (user_id = public.current_domus_user_id());
create policy financial_account_adjustments_owner_select on public.financial_account_adjustments for select to authenticated
  using (exists (select 1 from public.financial_accounts a where a.id = account_id and a.user_id = public.current_domus_user_id()));
grant select on public.financial_accounts, public.financial_account_adjustments to authenticated;

create or replace function public.domus_create_financial_account(
  p_name text, p_holder_name text, p_opening_balance numeric, p_opening_date date
) returns bigint language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user(); new_id bigint;
begin
  if p_name is null or length(trim(p_name)) not between 1 and 100
     or p_holder_name is null or length(trim(p_holder_name)) not between 1 and 100 then
    raise exception 'Informe o nome da conta e do titular' using errcode = '22023';
  end if;
  if p_opening_date is null or p_opening_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe uma data inicial que não seja futura' using errcode = '22023';
  end if;
  if p_opening_balance is null or p_opening_balance <> round(p_opening_balance, 2)
     or abs(p_opening_balance) > 999999999999.99 then
    raise exception 'Informe um saldo válido com até duas casas decimais' using errcode = '22023';
  end if;
  insert into public.financial_accounts (user_id, name, holder_name, opening_balance, opening_date)
  values (owner_id, trim(p_name), trim(p_holder_name), p_opening_balance, p_opening_date)
  returning id into new_id;
  return new_id;
end;
$$;

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
  select initial_balance + coalesce(sum(x.delta), 0) into old_balance
    from public.financial_account_adjustments x where x.account_id = p_account_id;
  insert into public.financial_account_adjustments (account_id, delta, confirmed_balance, note)
    values (p_account_id, p_confirmed_balance - old_balance, p_confirmed_balance, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.domus_financial_account_balances()
returns table (account_id bigint, name text, holder_name text, opening_date date, balance text, confirmed_at timestamptz)
language sql security definer set search_path = public, pg_catalog as $$
  with owner as (select public.ensure_current_domus_user() as id)
  select a.id, a.name, a.holder_name, a.opening_date,
    (a.opening_balance + coalesce(sum(x.delta), 0))::text,
    coalesce(max(x.created_at), a.created_at)
  from public.financial_accounts a cross join owner
    left join public.financial_account_adjustments x on x.account_id = a.id
  where a.user_id = owner.id
  group by a.id order by a.id;
$$;

create or replace function public.domus_financial_account_history(p_account_id bigint)
returns table (adjustment_id bigint, delta text, confirmed_balance text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_catalog as $$
declare owner_id bigint := public.ensure_current_domus_user();
begin
  if not exists (select 1 from public.financial_accounts a where a.id = p_account_id and a.user_id = owner_id) then
    raise exception 'Conta não encontrada' using errcode = 'P0002';
  end if;
  return query select x.id, x.delta::text, x.confirmed_balance::text, x.note, x.created_at
    from public.financial_account_adjustments x where x.account_id = p_account_id
    order by x.id desc limit 20;
end;
$$;

revoke all on function public.domus_create_financial_account(text, text, numeric, date) from public, anon;
revoke all on function public.domus_adjust_financial_account(bigint, numeric, text) from public, anon;
revoke all on function public.domus_financial_account_balances() from public, anon;
revoke all on function public.domus_financial_account_history(bigint) from public, anon;
grant execute on function public.domus_create_financial_account(text, text, numeric, date) to authenticated;
grant execute on function public.domus_adjust_financial_account(bigint, numeric, text) to authenticated;
grant execute on function public.domus_financial_account_balances() to authenticated;
grant execute on function public.domus_financial_account_history(bigint) to authenticated;
commit;
