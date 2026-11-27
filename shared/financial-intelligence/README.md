# Base do motor financeiro — fase E

Biblioteca TypeScript sem dependências externas, utilizada pela web, Electron e Expo. O contrato `FinancialSnapshotV1` representa a data de referência, contas e eventos separados por tipo. Valores monetários usam centavos inteiros seguros, sem ponto flutuante nas operações; entrada inválida ou soma fora do limite retorna `null`.

Dados têm estado `complete`, `partial` ou `unavailable`. Uma lista vazia só significa ausência de registros quando sua consulta foi concluída integralmente. `snapshotFromAccounts` é uma base parcial: ela não carrega dados por conta própria e informa que os eventos não estão disponíveis. `accountsFromBalances` aceita apenas uma resposta completa de contas obtida com sucesso; erros de consulta devem ser representados como indisponíveis pelo chamador.

O saldo retornado pela RPC é atual, não necessariamente um saldo histórico na data escolhida. Não criar snapshots históricos com esse saldo. Leituras independentes também não formam uma captura transacional: não utilizar este contrato para produzir previsão sem resolver consistência, dados de receitas e despesas, alterações mensais, histórico de liquidações e faturas. Em particular, `domus_list_cash_movements` retorna apenas as últimas 200 movimentações e não pode ser tratado como histórico completo. Compras de crédito e pagamentos de fatura são eventos diferentes e não podem ser deduzidos duas vezes do caixa.

O contrato não gera recorrências, previsões, recomendações nem realiza chamadas de rede. A conversão dos registros reais restantes e a montagem consistente de um retrato completo são dependências para a fase F; não se deve inferir dados ausentes como zero. Nenhum dado pessoal é armazenado pela biblioteca.

Para executar os testes isolados a partir da raiz do repositório, com as dependências web instaladas:

```sh
./Domus_FrontEnd/domus-frontend/node_modules/.bin/tsc shared/financial-intelligence/index.ts --target es2020 --module commonjs --strict --outDir /tmp/domus-phase-e-test
DOMUS_FINANCIAL_TEST_MODULE=/tmp/domus-phase-e-test/index.js node --test shared/financial-intelligence/test.cjs
```
