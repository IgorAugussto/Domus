-- Mantém a duração em meses e calcula ocorrências anuais sem reescrever dados antigos.
begin;
alter table public.outgoing add column if not exists installment_total numeric;
alter table public.outgoing add constraint outgoing_installment_total_valid check (
  installment_total is null or
  (frequency = 'Monthly' and duration_in_months > 1 and installment_total >= duration_in_months * 0.01
    and installment_total = round(installment_total, 2)
    and value = (floor(installment_total * 100 / duration_in_months)
      + case when mod(installment_total * 100, duration_in_months) > 0 then 1 else 0 end) / 100)
);

-- Resto em centavos é distribuído nas primeiras parcelas.
create or replace function public.domus_installment_value(p_value numeric, p_total numeric, p_count integer, p_index integer)
returns numeric language sql immutable set search_path = public, pg_catalog as $$
  select case when p_total is null then p_value else
    (floor(p_total * 100 / p_count) + case when p_index < mod(p_total * 100, p_count) then 1 else 0 end) / 100 end;
$$;
revoke all on function public.domus_installment_value(numeric, numeric, integer, integer) from public;
grant execute on function public.domus_installment_value(numeric, numeric, integer, integer) to authenticated;

create or replace function public.domus_expense_occurs(p_start date, p_duration integer, p_frequency varchar, p_month date)
returns boolean language sql immutable set search_path = public, pg_catalog as $$
  select p_month >= date_trunc('month', p_start)::date
    and p_month < (date_trunc('month', p_start) + (p_duration || ' months')::interval)::date
    and (coalesce(p_frequency, '') not in ('Annually', 'Yearly') or
      ((extract(year from p_month)::integer - extract(year from p_start)::integer) * 12
        + extract(month from p_month)::integer - extract(month from p_start)::integer) % 12 = 0);
$$;
revoke all on function public.domus_expense_occurs(date, integer, varchar, date) from public;
grant execute on function public.domus_expense_occurs(date, integer, varchar, date) to authenticated;
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
    and o.payment_type in ('Cartão de Crédito', 'Boleto')
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

  if item.payment_type not in ('Cartão de Crédito', 'Boleto')
     or not public.domus_expense_occurs(item.start_date, item.duration_in_months, item.frequency, target_month) then
    raise exception 'Despesa não está ativa no mês informado' using errcode = '22023';
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
    coalesce((select sum(i.value) from public.income i, owner
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
    coalesce((select sum(i.value) from public.income i, owner, bounds
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

create or replace function public.domus_card_statement_items(
  p_credit_card_id bigint,
  p_statement_month date
)
returns table (
  outgoing_id bigint,
  description varchar,
  value numeric,
  transaction_date date
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  owner_id bigint := public.ensure_current_domus_user();
  closing_day smallint;
  cycle_end date;
  previous_cycle_end date;
begin
  if p_statement_month <> date_trunc('month', p_statement_month)::date then
    raise exception 'O mês da fatura deve ser informado no primeiro dia do mês' using errcode = '22007';
  end if;

  select c.statement_closing_day into closing_day
  from public.credit_cards c
  where c.id = p_credit_card_id and c.user_id = owner_id and c.active;

  if not found then
    raise exception 'Cartão não encontrado' using errcode = 'P0002';
  end if;
  if closing_day is null then
    raise exception 'Informe o dia de fechamento do cartão antes de conferir a fatura' using errcode = '22023';
  end if;

  cycle_end := least(
    p_statement_month + (closing_day - 1),
    (date_trunc('month', p_statement_month) + interval '1 month - 1 day')::date
  );
  previous_cycle_end := least(
    (p_statement_month - interval '1 month')::date + (closing_day - 1),
    (date_trunc('month', p_statement_month - interval '1 month') + interval '1 month - 1 day')::date
  );

  return query
  with scheduled_charges as (
    select
      o.id,
      o.description,
      public.domus_installment_value(o.value, o.installment_total, o.duration_in_months, ((extract(year from charge_month)::integer - extract(year from o.start_date)::integer) * 12 + extract(month from charge_month)::integer - extract(month from o.start_date)::integer)) as value,
      make_date(
          extract(year from charge_month)::integer,
          extract(month from charge_month)::integer,
          least(
            extract(day from purchase.date)::integer,
            extract(day from date_trunc('month', charge_month) + interval '1 month - 1 day')::integer
          )
        ) as charge_date
    from public.outgoing o
    cross join lateral (select coalesce((o.purchase_at at time zone 'America/Sao_Paulo')::date, o.start_date) as date) purchase
    cross join lateral generate_series(
      date_trunc('month', purchase.date)::date,
      date_trunc('month', purchase.date + ((o.duration_in_months - 1) || ' months')::interval)::date,
      interval '1 month'
    ) as charge_month
    where o.user_id = owner_id
      and o.credit_card_id = p_credit_card_id
      and o.payment_type = 'Cartão de Crédito'
      and public.domus_expense_occurs(purchase.date, o.duration_in_months, o.frequency, charge_month::date)
  )
  select sc.id, sc.description, sc.value, sc.charge_date
  from scheduled_charges sc
  where sc.charge_date >= previous_cycle_end and sc.charge_date < cycle_end
  order by sc.charge_date, sc.id;
end;
$$;

revoke all on function public.domus_monthly_payments(varchar) from public;
revoke all on function public.domus_set_payment_status(bigint, varchar, boolean) from public;
revoke all on function public.domus_year_projection(integer) from public;
revoke all on function public.domus_current_month_projection() from public;
revoke all on function public.domus_card_statement_items(bigint, date) from public;
grant execute on function public.domus_monthly_payments(varchar), public.domus_set_payment_status(bigint, varchar, boolean), public.domus_year_projection(integer), public.domus_current_month_projection(), public.domus_card_statement_items(bigint, date) to authenticated;
commit;
