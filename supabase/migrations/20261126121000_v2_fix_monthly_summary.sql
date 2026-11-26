-- Mantém o contrato existente e corrige renda e taxa da competência selecionada.
-- O acumulado anual não representa saldo de conta nem patrimônio líquido.
begin;

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
  select b.month, b.income, b.expenses, b.investments, b.calculated_net_worth,
    case when b.income > 0 then (b.income - b.expenses) / b.income * 100 else null end
  from balance b where b.month = p_year_month;
$$;

revoke all on function public.domus_monthly_summary(varchar) from public;
grant execute on function public.domus_monthly_summary(varchar) to authenticated;
commit;
