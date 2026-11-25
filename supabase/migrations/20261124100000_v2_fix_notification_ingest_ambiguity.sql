-- Corrige a ambiguidade entre a coluna notification_events.outgoing_id e o
-- parâmetro de saída outgoing_id da RPC. A correção é somente na função;
-- nenhum evento, lançamento ou dado financeiro é removido ou alterado.

begin;

create or replace function public.ingest_notification_event(
  p_event_key varchar,
  p_source varchar,
  p_source_package varchar,
  p_amount numeric,
  p_merchant varchar,
  p_credit_card_id bigint,
  p_occurred_at timestamptz,
  p_simulated boolean default false
)
returns table (event_id bigint, outgoing_id bigint, deduplicated boolean)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  owner_id bigint := public.ensure_current_domus_user();
  normalized_merchant varchar(255);
  existing_event public.notification_events%rowtype;
  created_event_id bigint;
  created_outgoing_id bigint;
begin
  if p_event_key is null or length(trim(p_event_key)) < 8 then
    raise exception 'event_key inválida' using errcode = '22023';
  end if;
  if p_source not in ('google_wallet', 'nubank', 'whatsapp', 'manual_test', 'other') then
    raise exception 'source inválida' using errcode = '22023';
  end if;
  if p_source = 'whatsapp' and not p_simulated then
    raise exception 'WhatsApp é permitido apenas para eventos de teste' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor deve ser positivo' using errcode = '22023';
  end if;
  if p_merchant is null or length(trim(p_merchant)) = 0 then
    raise exception 'Estabelecimento obrigatório' using errcode = '22023';
  end if;
  if p_occurred_at is null then
    raise exception 'Horário da compra obrigatório' using errcode = '22023';
  end if;
  if p_credit_card_id is not null and not public.owns_credit_card(p_credit_card_id) then
    raise exception 'Cartão não pertence ao usuário autenticado' using errcode = '42501';
  end if;

  normalized_merchant := lower(regexp_replace(trim(p_merchant), '\s+', ' ', 'g'));

  perform pg_advisory_xact_lock(hashtext(
    owner_id::text || '|' || normalized_merchant || '|' || p_amount::text || '|' || coalesce(p_credit_card_id::text, 'none')
  ));

  select * into existing_event
  from public.notification_events
  where user_id = owner_id
    and event_key = p_event_key;

  if found then
    return query select existing_event.id, existing_event.outgoing_id, true;
    return;
  end if;

  -- O alias elimina a colisão com o parâmetro de saída outgoing_id desta RPC.
  select * into existing_event
  from public.notification_events as candidate
  where candidate.user_id = owner_id
    and candidate.source <> p_source
    and candidate.amount = p_amount
    and candidate.merchant_normalized = normalized_merchant
    and candidate.credit_card_id is not distinct from p_credit_card_id
    and abs(extract(epoch from (candidate.occurred_at - p_occurred_at))) <= 300
    and candidate.outgoing_id is not null
  order by candidate.occurred_at desc
  limit 1
  for update;

  if found then
    insert into public.notification_events (
      user_id, event_key, source, source_package, amount, merchant,
      merchant_normalized, credit_card_id, outgoing_id, occurred_at,
      processed_at, state, simulated
    ) values (
      owner_id, trim(p_event_key), p_source, nullif(trim(p_source_package), ''),
      p_amount, trim(p_merchant), normalized_merchant, p_credit_card_id,
      existing_event.outgoing_id, p_occurred_at, timezone('utc', now()),
      'duplicate', p_simulated
    ) returning id into created_event_id;

    return query select created_event_id, existing_event.outgoing_id, true;
    return;
  end if;

  insert into public.outgoing (
    value, description, start_date, frequency, duration_in_months, category,
    payment_type, paid, user_id, credit_card_id, origin, reviewed, purchase_at,
    competence_month
  ) values (
    p_amount, trim(p_merchant), p_occurred_at::date, 'One-time', 1, 'Other',
    'Cartão de Crédito', false, owner_id, p_credit_card_id, 'notification',
    false, p_occurred_at, date_trunc('month', p_occurred_at)::date
  ) returning id into created_outgoing_id;

  insert into public.notification_events (
    user_id, event_key, source, source_package, amount, merchant,
    merchant_normalized, credit_card_id, outgoing_id, occurred_at,
    processed_at, state, simulated
  ) values (
    owner_id, trim(p_event_key), p_source, nullif(trim(p_source_package), ''),
    p_amount, trim(p_merchant), normalized_merchant, p_credit_card_id,
    created_outgoing_id, p_occurred_at, timezone('utc', now()), 'review', p_simulated
  ) returning id into created_event_id;

  return query select created_event_id, created_outgoing_id, false;
end;
$$;

revoke all on function public.ingest_notification_event(varchar, varchar, varchar, numeric, varchar, bigint, timestamptz, boolean) from public;
grant execute on function public.ingest_notification_event(varchar, varchar, varchar, numeric, varchar, bigint, timestamptz, boolean) to authenticated;

commit;
