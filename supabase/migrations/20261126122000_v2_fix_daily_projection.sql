-- Gráfico diário mostra cada receita e despesa na data prevista, uma vez por mês ativo.
begin;
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
    coalesce((select sum(o.value) from public.outgoing o, owner, bounds
      where o.user_id = owner.id
        and date_trunc('month', o.start_date)::date <= bounds.start_month
        and date_trunc('month', o.start_date + ((o.duration_in_months - 1) || ' months')::interval)::date >= bounds.start_month
        and days.day = bounds.start_month + least(extract(day from o.start_date)::integer, extract(day from bounds.end_month)::integer) - 1), 0),
    coalesce((select sum(inv.value * power(1 + (inv.expected_return / 100 / 12),
      ((extract(year from days.day)::integer - extract(year from inv.start_date)::integer) * 12 + extract(month from days.day)::integer - extract(month from inv.start_date)::integer)))
      from public.investments inv, owner
      where inv.user_id = owner.id and days.day between inv.start_date and inv.end_date), 0)
  from days order by days.day;
$$;
revoke all on function public.domus_current_month_projection() from public;
grant execute on function public.domus_current_month_projection() to authenticated;
commit;
