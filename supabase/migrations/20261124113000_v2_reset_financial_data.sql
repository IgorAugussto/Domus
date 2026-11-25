-- Domus v2.1 — reinício deliberado dos dados financeiros.
--
-- Migração destrutiva, aprovada pelo proprietário do projeto em 24/11/2026.
-- Preserva auth.users, public.users, o schema, RLS, políticas e funções.
-- Remove apenas registros financeiros, capturas e metadados de importação.

begin;

delete from public.payment_status;
delete from public.notification_events;
delete from public.credit_card_statements;
delete from public.card_aliases;
delete from public.import_jobs;
delete from public.outgoing;
delete from public.income;
delete from public.investments;
delete from public.credit_cards;

commit;
