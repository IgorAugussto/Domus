-- Corrige datas das parcelas e a regra de fechamento, sem alterar lançamentos.
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
  )
  select sc.id, sc.description, sc.value, sc.charge_date
  from scheduled_charges sc
  where sc.charge_date >= previous_cycle_end and sc.charge_date < cycle_end
  order by sc.charge_date, sc.id;
end;
$$;

revoke all on function public.domus_card_statement_items(bigint, date) from public;
grant execute on function public.domus_card_statement_items(bigint, date) to authenticated;

commit;
