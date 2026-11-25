# Agente do repositório Frontend Web

Este diretório contém o wrapper do frontend web, seu workflow de GitHub Actions e o app em `domus-frontend/`. Para código dentro do app, leia também `domus-frontend/AGENTS.md`.

## Skills especializadas

- React/TypeScript/Vite: componentes, rotas, hooks, tipos e build.
- Contrato HTTP: Axios, cookies JWT, retries, erros e payloads da API Java.
- UI financeira: dashboard, categorias, parcelas, pagamentos, metas e gráficos Recharts.
- CI/CD web: lint/build e publicação S3 + invalidação CloudFront.

## Cuidados

- O workflow usa Node 18 e `npm ci`; mantenha `package-lock.json` consistente com `package.json`.
- A build de CI injeta `VITE_API_URL=/api`; não codifique URLs de produção no componente.
- Mudanças de endpoint devem ser conferidas também no desktop e no mobile.
- Não altere o workflow de deploy, bucket, distribuição ou secrets sem pedido explícito.
