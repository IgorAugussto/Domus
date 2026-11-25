-- Domus v2.1 — compatibilidade de geração de IDs bigint.
--
-- O diagnóstico do banco legado indicou que algumas PKs bigint podem não ter
-- DEFAULT/sequence associados. Esta migração só cria e associa uma sequence
-- quando pg_get_serial_sequence não encontra uma já configurada.

begin;

do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('public.users', 'id', 'public.users_id_seq'),
      ('public.income', 'id', 'public.income_id_seq'),
      ('public.outgoing', 'id', 'public.outgoing_id_seq'),
      ('public.investments', 'id', 'public.investments_id_seq'),
      ('public.payment_status', 'id', 'public.payment_status_id_seq'),
      ('public.credit_cards', 'id', 'public.credit_cards_id_seq')
    ) as values_to_fix(table_name, column_name, sequence_name)
  loop
    if pg_get_serial_sequence(item.table_name, item.column_name) is null then
      execute format('create sequence if not exists %s', item.sequence_name);
      execute format('alter sequence %s owned by %s.%I', item.sequence_name, item.table_name, item.column_name);
      execute format(
        'select setval(%L, coalesce((select max(%I) from %s), 0) + 1, false)',
        item.sequence_name,
        item.column_name,
        item.table_name
      );
      execute format(
        'alter table %s alter column %I set default nextval(%L::regclass)',
        item.table_name,
        item.column_name,
        item.sequence_name
      );
    end if;
  end loop;
end;
$$;

commit;
