# Agente do microserviço Python

## Stack e comandos

- Flask 3, Flask-Limiter, pandas e pdfplumber.
- Porta padrão 5000; endpoint principal `POST /processar-extrato`; health check `GET /health`.
- Rode `python -m pytest` usando o ambiente correto. Dependências de teste estão em `requirements-dev.txt`.

## Skills especializadas

- Parsing financeiro: CSV Nubank, OFX SGML e PDF Itaú, com entradas imperfeitas e layouts variáveis.
- Normalização de transações: valor positivo, data ISO, categoria, frequência e campos de parcelas.
- Regras de domínio: `CATEGORY_MAP` e `PARCELA_PATTERNS` alimentam o contrato consumido pelo backend Java.
- API Flask: multipart upload, validação de extensão/conteúdo, status HTTP e rate limiting.
- Testes de regressão: cada alteração de parser deve incluir casos mínimos e casos inválidos.

## Invariantes

- Débitos são retornados como valores positivos; créditos/estornos OFX são ignorados conforme a regra atual.
- Transações inválidas ou sem valor útil não devem contaminar o resultado.
- Não remova compatibilidade com `description`, `amount`, `startDate`, `category`, `frequency`, `durationInMonths`, `installmentNumber`, `totalInstallments`, `paymentType` e `paid` sem atualizar o backend.
- Não salve arquivos enviados em disco sem necessidade; trate conteúdo em memória e não registre dados bancários.
- O serviço deve continuar sendo chamável pelo backend via `STATEMENT_SERVICE_URL`.
