# Testes isolados das funções financeiras

Estes testes criam um banco descartável em memória com PGlite e dados fictícios. Não executá-los contra o projeto remoto; eles usam um schema mínimo de teste e não substituem testes de integração com o schema Supabase completo, autenticação real e RLS.

Exemplo com Node.js e PGlite instalados separadamente em um diretório temporário:

```sh
npm install --prefix /tmp/domus-phase-b --no-save --no-package-lock @electric-sql/pglite
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/statement_cycle.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/monthly_summary.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/daily_projection.mjs
PGLITE_MODULE=/tmp/domus-phase-b/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/annual_installments.mjs
```

Os testes cobrem ciclos e parcelas, resumo mensal e distribuição diária de valores. A preparação de autenticação e tabelas usa substitutos mínimos, não credenciais nem dados reais.
