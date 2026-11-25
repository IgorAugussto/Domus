-- Domus v2.1 — identidade, RLS e permissões mínimas.
--
-- Esta migração é aditiva: não exclui tabelas, colunas ou dados legados.
-- Ela pressupõe o endurecimento emergencial já feito no painel (RLS ativo e
-- grants revogados) e o torna reproduzível no Git.
--
-- NÃO aplique este arquivo manualmente e depois via Supabase CLI. Escolha um
-- único mecanismo por ambiente e registre a versão aplicada.

begin;

-- A tabela pública users permanece como perfil interno e ponte para os IDs
-- bigint já usados pelas tabelas financeiras. A senha legada deixa de ser
-- obrigatória para novos perfis: credenciais novas pertencem exclusivamente ao
-- Supabase Auth; hashes existentes não são alterados nesta migração.
alter table public.users
  add column if not exists auth_user_id uuid;

alter table public.users
  alter column password drop not null;

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_auth_user_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete restrict;
  end if;
end;
$$;

-- Tabelas legadas e financeiras continuam com RLS ativo. A migração não usa
-- FORCE RLS porque os scripts administrativos do Supabase precisam continuar
-- operando com a role proprietária.
alter table public.users enable row level security;
alter table public.income enable row level security;
alter table public.outgoing enable row level security;
alter table public.investments enable row level security;
alter table public.payment_status enable row level security;
alter table public.credit_cards enable row level security;
alter table public.import_jobs enable row level security;

-- Nenhum cliente recebe acesso às credenciais legadas, jobs de importação ou
-- histórico do Flyway. O importador permanece fora do escopo da v2.1.
revoke all privileges on table
  public.users,
  public.import_jobs,
  public.flyway_schema_history
from anon, authenticated, public;

-- Repete de forma versionada a contenção aplicada manualmente antes da v2.1.
revoke all privileges on table
  public.income,
  public.outgoing,
  public.investments,
  public.payment_status,
  public.credit_cards
from anon, authenticated, public;

-- Retorna o perfil bigint do usuário autenticado sem expor public.users à
-- Data API. auth.uid() vem do JWT validado pelo Supabase, nunca do payload do
-- cliente.
create or replace function public.current_domus_user_id()
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  profile_id bigint;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id into profile_id
  from public.users
  where auth_user_id = auth.uid();

  return profile_id;
end;
$$;

-- Cria ou vincula o perfil interno do usuário autenticado. O e-mail é lido
-- diretamente de auth.users dentro da função; nunca é fornecido pelo cliente.
-- Quando houver um registro legado com o mesmo e-mail ainda sem vínculo, ele é
-- associado apenas a esta identidade autenticada.
create or replace function public.ensure_current_domus_user()
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  authenticated_user_id uuid := auth.uid();
  authenticated_email text;
  authenticated_name text;
  profile_id bigint;
begin
  if authenticated_user_id is null then
    raise exception 'Autenticação obrigatória' using errcode = '42501';
  end if;

  select email, nullif(raw_user_meta_data ->> 'name', '')
    into authenticated_email, authenticated_name
  from auth.users
  where id = authenticated_user_id;

  if authenticated_email is null then
    raise exception 'Usuário Auth não encontrado' using errcode = 'P0002';
  end if;

  select id into profile_id
  from public.users
  where auth_user_id = authenticated_user_id;

  if profile_id is not null then
    return profile_id;
  end if;

  select id into profile_id
  from public.users
  where lower(email) = lower(authenticated_email)
    and auth_user_id is null;

  if profile_id is not null then
    update public.users
       set auth_user_id = authenticated_user_id,
           name = coalesce(name, authenticated_name)
     where id = profile_id;
    return profile_id;
  end if;

  insert into public.users (email, password, name, created_at, auth_user_id)
  values (authenticated_email, null, authenticated_name, timezone('utc', now()), authenticated_user_id)
  returning id into profile_id;

  return profile_id;
end;
$$;

-- Também prepara automaticamente perfis para usuários Auth criados depois da
-- migração. Conflito de e-mail já associado a outro UUID falha de propósito,
-- exigindo intervenção administrativa em vez de tomar posse de dados alheios.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.users (email, password, name, created_at, auth_user_id)
  values (
    new.email,
    null,
    nullif(new.raw_user_meta_data ->> 'name', ''),
    timezone('utc', now()),
    new.id
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        name = coalesce(public.users.name, excluded.name)
    where public.users.auth_user_id is null;

  if not exists (select 1 from public.users where auth_user_id = new.id) then
    raise exception 'E-mail já vinculado a outra identidade Auth';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_domus'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    execute 'create trigger on_auth_user_created_domus
      after insert on auth.users
      for each row execute procedure public.handle_new_auth_user()';
  end if;
end;
$$;

-- Funções auxiliares usadas nas políticas. Elas evitam conceder SELECT sobre
-- public.users ao cliente e validam ownership de relações indiretas.
create or replace function public.owns_credit_card(target_card_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.credit_cards card
    where card.id = target_card_id
      and card.user_id = public.current_domus_user_id()
  );
$$;

create or replace function public.owns_outgoing(target_outgoing_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.outgoing item
    where item.id = target_outgoing_id
      and item.user_id = public.current_domus_user_id()
  );
$$;

revoke all on function public.current_domus_user_id() from public;
revoke all on function public.ensure_current_domus_user() from public;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.owns_credit_card(bigint) from public;
revoke all on function public.owns_outgoing(bigint) from public;

grant execute on function public.current_domus_user_id() to authenticated;
grant execute on function public.ensure_current_domus_user() to authenticated;
grant execute on function public.owns_credit_card(bigint) to authenticated;
grant execute on function public.owns_outgoing(bigint) to authenticated;

-- RLS definitiva dos conceitos financeiros já existentes. As políticas de
-- escrita conferem tanto o dono da linha quanto, quando aplicável, o dono do
-- cartão relacionado.
create policy domus_income_owner
  on public.income
  for all to authenticated
  using (user_id = public.current_domus_user_id())
  with check (user_id = public.current_domus_user_id());

create policy domus_investments_owner
  on public.investments
  for all to authenticated
  using (user_id = public.current_domus_user_id())
  with check (user_id = public.current_domus_user_id());

create policy domus_credit_cards_owner
  on public.credit_cards
  for all to authenticated
  using (user_id = public.current_domus_user_id())
  with check (user_id = public.current_domus_user_id());

create policy domus_outgoing_owner
  on public.outgoing
  for all to authenticated
  using (user_id = public.current_domus_user_id())
  with check (
    user_id = public.current_domus_user_id()
    and (credit_card_id is null or public.owns_credit_card(credit_card_id))
  );

create policy domus_payment_status_owner
  on public.payment_status
  for all to authenticated
  using (public.owns_outgoing(outgoing_id))
  with check (public.owns_outgoing(outgoing_id));

grant select, insert, update, delete on table
  public.income,
  public.outgoing,
  public.investments,
  public.payment_status,
  public.credit_cards
to authenticated;

-- Algumas instalações legadas podem ter PKs sem defaults/sequences. Só concede
-- uso às sequences existentes, sem supor que todas elas existam.
do $$
declare
  sequence_name text;
begin
  foreach sequence_name in array array[
    'public.income_id_seq',
    'public.outgoing_id_seq',
    'public.investments_id_seq',
    'public.payment_status_id_seq',
    'public.credit_cards_id_seq'
  ] loop
    if to_regclass(sequence_name) is not null then
      execute format('grant usage, select on sequence %s to authenticated', sequence_name);
    end if;
  end loop;
end;
$$;

commit;
