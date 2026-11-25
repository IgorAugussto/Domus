-- Corrige a ambiguidade entre o campo de retorno outgoing_id e a coluna usada
-- pelo ON CONFLICT na RPC de pagamento.

begin;

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
  on conflict on constraint uq_payment_outgoing_month do update
    set paid = excluded.paid, updated_at = excluded.updated_at;

  return query select item.id, item.description, item.value, item.category,
    item.payment_type, item.frequency, item.start_date, p_year_month, p_paid, item.credit_card_id;
end;
$$;

revoke all on function public.domus_set_payment_status(bigint, varchar, boolean) from public;
grant execute on function public.domus_set_payment_status(bigint, varchar, boolean) to authenticated;

commit;
