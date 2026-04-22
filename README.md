# Domus
Domus é uma aplicação full stack para controle financeiro pessoal,
desenvolvida com foco em arquitetura limpa, segurança e escalabilidade.

## Visão geral
O sistema permite gerenciar receitas, despesas e investimentos,
oferecendo um dashboard financeiro com dados mensais, projeções anuais
e importação automática de extratos bancários.

## Repositórios
- 🔗 Back-end (Spring Boot): https://github.com/IgorAugussto/Domus_BackEnd
- 🔗 Front-end (React): https://github.com/IgorAugussto/Domus_FrontEnd
- 🔗 Infraestrutura (Docker): https://github.com/IgorAugussto/Domus_Infra
- 🔗 Microserviço Python: https://github.com/IgorAugussto/Domus_BackEnd_Py

## Stack

### Back-end
- Java 17 + Spring Boot
- Spring Security + JWT (autenticação stateless)
- Hibernate + JPA
- PostgreSQL (Supabase em produção)

### Front-end
- React + TypeScript
- Tailwind CSS
- Recharts (gráficos e projeções)
- Axios

### Microserviço
- Python + Flask
- Processamento de extratos CSV e OFX (Nubank)

### Infraestrutura
- Docker & Docker Compose
- CI/CD com GitHub Actions
- Backend na AWS EC2 com SSL (Let's Encrypt + PKCS12)
- Frontend hospedado no AWS S3 + CloudFront

## Funcionalidades

### Receitas
- Cadastro de receitas com categoria, frequência e data
- Suporte a receitas únicas e mensais recorrentes
- Edição e exclusão

### Despesas
- Cadastro manual com categoria, frequência, tipo de pagamento e parcelas
- Importação automática de extratos bancários (CSV e OFX do Nubank)
- Detecção automática de parcelas (`Parcela X/Y`) com cálculo de meses restantes
- Classificação automática de categoria por palavras-chave
- Edição e exclusão

### Investimentos
- Cadastro com tipo, rentabilidade esperada e prazo
- Projeção de valor futuro com juros compostos

### Pagamentos
- Aba dedicada para acompanhamento de despesas por mês
- Navegação entre meses (anterior/próximo)
- Status de pago/pendente independente por mês
- Suporte a despesas parceladas — aparece em cada mês ativo automaticamente
- Botão "Pagar todos do mês"
- Filtros por status: Todos, Pendentes, Pagos

### Dashboard
- KPIs mensais: Renda Total, Despesas, Investimentos e Patrimônio Líquido
- Gráfico de área com visão anual (12 meses) e mensal (dia a dia)
- Navegação por mês clicando diretamente no gráfico
- Gráficos de pizza: Despesas por Categoria e Alocação de Investimentos
- Meta de gastos com linha de referência no gráfico (persistida no localStorage)

## Arquitetura

```
Usuário
    ↓ HTTPS
AWS CloudFront (CDN)
    ↓ serve arquivos estáticos
AWS S3 (Frontend React)

Usuário
    ↓ HTTPS (domusapp.dev.br:8443)
Backend Java (AWS EC2 — SSL via Let's Encrypt)
    ↓ HTTP interno
Microserviço Python (AWS EC2 :5000)
    ↓
Banco de dados PostgreSQL (Supabase)
```

## CI/CD
Três pipelines independentes via GitHub Actions:

- **Frontend** — build, sync para o bucket S3 e invalidação de cache do CloudFront
- **Backend Java** — build Maven, push para Docker Hub e deploy na EC2 com SSL
- **Microserviço Python** — build e deploy na EC2

## Destaques técnicos
- Autenticação stateless com JWT
- API REST organizada por domínio
- Frontend hospedado no S3 com distribuição global via CloudFront
- Backend com SSL via Let's Encrypt — certificado PKCS12 montado via volume Docker
- Comunicação frontend → backend 100% HTTPS sem proxy intermediário
- Importação de extratos com detecção automática de parcelas e categorias
- Status de pagamento por mês em tabela dedicada (`payment_status`)
- Projeções financeiras com juros compostos no backend
- Domínio próprio: [domusapp.dev.br](https://domusapp.dev.br)

---
Projeto desenvolvido de forma independente.
