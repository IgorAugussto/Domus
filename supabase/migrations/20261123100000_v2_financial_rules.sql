-- Domus v2.1 — invariantes financeiras e consultas compartilhadas.
-- Migração exclusivamente aditiva. As regras antes concentradas nos services
-- Java passam a ficar no banco para que Android e desktop tenham o mesmo
-- resultado sob RLS.

begin;

alter table public.income alter column created_at set default timezone('utc', now());
alter table public.outgoing alter column created_at set default timezone('utc', now());
alter table public.investments alter column created_at set default timezone('utc', now());
alter table public.payment_status alter column created_at set default timezone('utc', now());
alter table public.credit_cards alter column created_at set default timezone('utc', now());

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'income_value_positive') then
    alter table public.income add constraint income_value_positive check (value > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'outgoing_value_positive') then
    alter table public.outgoing add constraint outgoing_value_positive check (value > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'outgoing_duration_positive') then
    alter table public.outgoing add constraint outgoing_duration_positive check (duration_in_months > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'investment_value_positive') then
    alter table public.investments add constraint investment_value_positive check (value > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credit_cards_last_four_digits') then
    alter table public.credit_cards add constraint credit_cards_last_four_digits check (last_four_digits ~ '^[0-9]{4}$') not valid;
  end if;
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
  select o.id, o.description, o.value, o.category, o.payment_type, o.frequency,
         o.start_date, p_year_month,
         coalesce(ps.paid, false), o.credit_card_id
  from public.outgoing o
  cross join owner
  cross join target
  left join public.payment_status ps
    on ps.outgoing_id = o.id and ps.year_month = p_year_month
  where o.user_id = owner.id
    and o.payment_type in ('Cartão de Crédito', 'Boleto')
    and date_trunc('month', o.start_date)::date <= target.month_start
    and date_trunc('month', o.start_date + ((o.duration_in_months - 1) || ' months')::interval)::date >= target.month_start
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
  if item.payment_type not in ('Cartão de Crédito', 'Boleto')
     or date_trunc('month', item.start_date)::date > target_month
     or date_trunc('month', item.start_date + ((item.duration_in_months - 1) || ' months')::interval)::date < target_month then
    raise exception 'Despesa não está ativa no mês informado' using errcode = '22023';
  end if;

  insert into public.payment_status (outgoing_id, year_month, paid, created_at, updated_at)
  values (item.id, p_year_month, p_paid, timezone('utc', now()), timezone('utc', now()))
  on conflict (outgoing_id, year_month) do update
    set paid = excluded.paid, updated_at = excluded.updated_at;

  return query select item.id, item.description, item.value, item.category,
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
    coalesce((select sum(i.value) from public.income i, owner
      where i.user_id = owner.id
        and ((coalesce(i.recurring, false) and date_trunc('month', i.start_date)::date <= m.month_start
             and (i.end_date is null or date_trunc('month', i.end_date)::date >= m.month_start))
          or (not coalesce(i.recurring, false) and date_trunc('month', i.start_date)::date = m.month_start))), 0),
    coalesce((select sum(o.value) from public.outgoing o, owner
      where o.user_id = owner.id
        and date_trunc('month', o.start_date)::date <= m.month_start
        and date_trunc('month', o.start_date + ((o.duration_in_months - 1) || ' months')::interval)::date >= m.month_start), 0),
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

create or replace function public.domus_monthly_summary(p_year_month varchar)
returns table (month varchar, income numeric, expenses numeric, investments numeric, net_worth numeric, savings_rate numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with projection as (
    select * from public.domus_year_projection(left(p_year_month, 4)::integer)
  ), balance as (
    select p.*, sum(p.income - p.expenses) over (order by p.month) as calculated_net_worth
    from projection p
  )
  select b.month, b.calculated_net_worth + b.expenses, b.expenses, b.investments,
         b.calculated_net_worth,
         case when b.calculated_net_worth + b.expenses > 0
           then b.calculated_net_worth / (b.calculated_net_worth + b.expenses) * 100 else 0 end
  from balance b where b.month = p_year_month;
$$;

create or replace function public.domus_current_month_projection()
returns table (month varchar, income numeric, expenses numeric, investments numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with owner as (select public.ensure_current_domus_user() as id), days as (
    select d::date as day from generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '1 month - 1 day', interval '1 day') d
  )
  select to_char(days.day, 'YYYY-MM-DD'),
    coalesce((select sum(i.value) from public.income i, owner where i.user_id = owner.id
      and days.day >= i.start_date and (i.end_date is null or days.day <= i.end_date)
      and ((coalesce(i.recurring, false) and i.frequency = 'Monthly') or (not coalesce(i.recurring, false) and days.day = i.start_date))), 0),
    coalesce((select sum(o.value) from public.outgoing o, owner where o.user_id = owner.id
      and days.day >= o.start_date and days.day <= (o.start_date + (o.duration_in_months || ' months')::interval)::date), 0),
    coalesce((select sum(inv.value * power(1 + (inv.expected_return / 100 / 12),
      ((extract(year from days.day)::integer - extract(year from inv.start_date)::integer) * 12 + extract(month from days.day)::integer - extract(month from inv.start_date)::integer)))
      from public.investments inv, owner where inv.user_id = owner.id and days.day between inv.start_date and inv.end_date), 0)
  from days order by days.day;
$$;

revoke all on function public.domus_monthly_payments(varchar) from public;
revoke all on function public.domus_set_payment_status(bigint, varchar, boolean) from public;
revoke all on function public.domus_year_projection(integer) from public;
revoke all on function public.domus_monthly_summary(varchar) from public;
revoke all on function public.domus_current_month_projection() from public;
grant execute on function public.domus_monthly_payments(varchar) to authenticated;
grant execute on function public.domus_set_payment_status(bigint, varchar, boolean) to authenticated;
grant execute on function public.domus_year_projection(integer) to authenticated;
grant execute on function public.domus_monthly_summary(varchar) to authenticated;
grant execute on function public.domus_current_month_projection() to authenticated;

commit;
