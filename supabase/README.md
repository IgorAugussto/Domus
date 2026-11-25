# Migrações Supabase — Domus v2.1

As migrações deste diretório são a fonte de verdade do schema v2.1. Elas não
substituem nem alteram o histórico Flyway em `Domus_BackEnd/`; o backend Java
permanece congelado durante a transição.

## Decisão operacional registrada — 22/11/2026

O operador autorizou aplicar estas migrações diretamente no projeto Supabase
existente. Dados financeiros e infraestrutura legados não precisam ser
preservados, pois a versão anterior será descartada caso a transição não seja
concluída.

As migrações atuais continuam sendo aditivas e não fazem `DROP`, `TRUNCATE` ou
remoção de dados. Uma futura exclusão física de tabelas, credenciais legadas ou
arquivos deverá identificar os alvos e receber aprovação específica antes de
ser executada.

## Ordem e segurança

1. Não aplique scripts manualmente no SQL Editor e depois via CLI.
2. Vincule a CLI ao projeto apenas no ambiente autorizado, sem versionar tokens,
   senha do banco ou `service_role`.
3. Revise o SQL, aplique via CLI no projeto autorizado e não misture aplicação
   manual pelo SQL Editor com `supabase db push`.
4. Após aplicar, valide RLS, grants e RPCs no próprio projeto autorizado antes
   de conectar os clientes v2.
5. A remoção de `users.password`, `import_jobs`, Flyway ou tabelas antigas é uma
   etapa posterior e requer aprovação explícita.

## Verificações após aplicar

- sem sessão: não lê nem altera tabelas financeiras;
- usuário A: cria e vê apenas os próprios registros;
- usuário B: não lê nem altera registros de A, inclusive `payment_status`;
- `ensure_current_domus_user()` cria/vincula o perfil bigint para a identidade
  Supabase Auth atual;
- duas chamadas de `ingest_notification_event` com a mesma `event_key` retornam
  a mesma despesa;
- Wallet e Nubank para a mesma compra produzem uma única despesa e dois eventos;
- duas compras iguais da mesma fonte continuam como despesas separadas;
- `notification_events` não contém texto bruto de notificações.
