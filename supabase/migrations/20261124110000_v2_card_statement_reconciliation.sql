-- Domus v2.1 — prévia e conferência de faturas de cartão.
--
-- O mês informado representa o mês de fechamento: para fechamento no dia 10,
-- a fatura 2026-11 contém compras de 11/10 a 10/11. A migração é aditiva e
-- não reclassifica lançamentos ou altera faturas existentes.

begin;

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
      o.value,
      case
        when o.purchase_at is not null then o.purchase_at::date
        else make_date(
          extract(year from charge_month)::integer,
          extract(month from charge_month)::integer,
          least(
            extract(day from o.start_date)::integer,
            extract(day from date_trunc('month', charge_month) + interval '1 month - 1 day')::integer
          )
        )
      end as charge_date
    from public.outgoing o
    cross join lateral generate_series(
      date_trunc('month', o.start_date)::date,
      date_trunc('month', o.start_date + ((o.duration_in_months - 1) || ' months')::interval)::date,
      interval '1 month'
    ) as charge_month
    where o.user_id = owner_id
      and o.credit_card_id = p_credit_card_id
      and o.payment_type = 'Cartão de Crédito'
  )
  select id, description, value, charge_date
  from scheduled_charges
  where charge_date > previous_cycle_end and charge_date <= cycle_end
  order by charge_date, id;
end;
$$;

create or replace function public.domus_reconcile_card_statement(
  p_credit_card_id bigint,
  p_statement_month date,
  p_bank_total numeric,
  p_notes text default null
)
returns table (
  statement_id bigint,
  calculated_total numeric,
  bank_total numeric,
  difference numeric,
  reconciliation_status varchar,
  reconciled_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  owner_id bigint := public.ensure_current_domus_user();
  calculated numeric(38, 2);
  next_status varchar(30);
  next_reconciled_at timestamptz;
begin
  if p_bank_total is null or p_bank_total < 0 then
    raise exception 'Informe um total da fatura válido' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.credit_cards c
    where c.id = p_credit_card_id and c.user_id = owner_id and c.active
  ) then
    raise exception 'Cartão não encontrado' using errcode = 'P0002';
  end if;

  select coalesce(sum(item.value), 0) into calculated
  from public.domus_card_statement_items(p_credit_card_id, p_statement_month) item;

  next_status := case when calculated = p_bank_total then 'reconciled' else 'needs_review' end;
  next_reconciled_at := case when next_status = 'reconciled' then timezone('utc', now()) else null end;

  return query
  insert into public.credit_card_statements (
    credit_card_id, statement_month, bank_total, calculated_total,
    reconciliation_status, reconciled_at, notes, updated_at
  ) values (
    p_credit_card_id, p_statement_month, p_bank_total, calculated,
    next_status, next_reconciled_at, nullif(trim(p_notes), ''), timezone('utc', now())
  )
  on conflict (credit_card_id, statement_month) do update set
    bank_total = excluded.bank_total,
    calculated_total = excluded.calculated_total,
    reconciliation_status = excluded.reconciliation_status,
    reconciled_at = excluded.reconciled_at,
    notes = excluded.notes,
    updated_at = timezone('utc', now())
  returning id, calculated_total, bank_total, difference, reconciliation_status, reconciled_at;
end;
$$;

revoke all on function public.domus_card_statement_items(bigint, date) from public;
revoke all on function public.domus_reconcile_card_statement(bigint, date, numeric, text) from public;
grant execute on function public.domus_card_statement_items(bigint, date) to authenticated;
grant execute on function public.domus_reconcile_card_statement(bigint, date, numeric, text) to authenticated;

commit;
