# Testes isolados das funções financeiras

Estes testes criam um banco descartável em memória com PGlite e dados fictícios. Não executá-los contra o projeto remoto; eles usam um schema mínimo de teste e não substituem testes de integração com o schema Supabase completo, autenticação real e RLS.

Exemplo com Node.js e PGlite instalados separadamente em um diretório temporário:

```sh
npm install --prefix /tmp/domus-phase-b --no-save --no-package-lock @electric-sql/pglite
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/statement_cycle.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/monthly_summary.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/daily_projection.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/annual_installments.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/financial_accounts.mjs
node supabase/tests/financial_accounts_ui.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/cash_movements.mjs
```

Os testes cobrem ciclos e parcelas, resumo mensal, distribuição diária, contas, ajustes e movimentações. A preparação de autenticação e tabelas usa substitutos mínimos, não credenciais nem dados reais.
