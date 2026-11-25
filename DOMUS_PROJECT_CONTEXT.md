# Domus — contexto completo do projeto

> Documento de referência para uso como arquivo de contexto em um Projeto do ChatGPT.
> Ele descreve o funcionamento observado no código atual do repositório, não um plano futuro.

## 1. O que é o Domus

Domus é uma aplicação full stack de controle financeiro pessoal. O usuário pode registrar e acompanhar:

- receitas;
- despesas e despesas parceladas;
- investimentos;
- pagamentos mensais;
- cartões de crédito, principalmente na variante desktop;
- importação de extratos bancários;
- dashboard com totais, projeções e gráficos.

O sistema possui três clientes para a mesma API Java:

1. frontend web React, publicado como aplicação estática;
2. aplicativo desktop Electron, baseado em uma variante própria do frontend;
3. aplicativo mobile Expo/React Native.

O backend principal é uma API REST Spring Boot. O processamento pesado de arquivos de extrato é realizado por um microserviço Flask em Python. PostgreSQL é o banco principal e RabbitMQ coordena a importação assíncrona de extratos.

## 2. Arquitetura geral

```text
Usuário
  ├── Frontend Web React/Vite
  ├── Desktop Electron + React/Vite
  └── Mobile Expo/React Native
          │
          │ HTTP/HTTPS + cookie JWT
          ▼
API Spring Boot
  ├── autenticação e autorização
  ├── regras financeiras
  ├── persistência JPA/Hibernate
  ├── migrações Flyway
  └── RabbitMQ para importações assíncronas
          │                 │
          ▼                 ▼
PostgreSQL          Microserviço Flask/Python
                    CSV, OFX e PDF
```

### Componentes do repositório

| Pasta | Responsabilidade | Tecnologia principal |
|---|---|---|
| `Domus_FrontEnd/domus-frontend` | Aplicação web | React, TypeScript, Vite, Tailwind |
| `Domus_FrontEnd_Exe/domus-frontend` | Aplicação desktop | React, Vite, Electron |
| `Domus_BackEnd/domus` | API e regras de negócio | Java 17, Spring Boot, JPA |
| `domus_python` | Leitura e normalização de extratos | Python, Flask, pandas, pdfplumber |
| `Domus_Mobile` | Aplicação mobile | Expo, React Native, Expo Router, NativeWind |

## 3. Autenticação e sessão

### Login

O fluxo é baseado em JWT armazenado em cookie HttpOnly:

1. o cliente envia email e senha para `POST /api/auth/login`;
2. o backend autentica o usuário usando Spring Security e BCrypt;
3. o backend gera a sessão JWT e grava o cookie;
4. os clientes usam Axios com `withCredentials: true` para enviar o cookie automaticamente;
5. no carregamento inicial, o cliente chama `GET /api/auth/me` para descobrir se a sessão ainda é válida.

O JavaScript do frontend não acessa o token diretamente. Isso reduz a exposição do JWT ao código da interface.

### Rotas públicas

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- endpoints de actuator liberados pela configuração do backend

As demais rotas exigem autenticação. O backend é stateless: não mantém uma sessão HTTP tradicional.

### Tratamento de sessão expirada

O Axios dos clientes trata respostas 401 e 403:

- web e desktop redirecionam para `/login`;
- mobile navega para `/login` usando Expo Router;
- verificações silenciosas de sessão usam a flag `_silentAuth` para evitar redirecionamento indevido;
- falhas de rede e respostas 5xx podem ser repetidas até três vezes, com espera crescente.

O CORS do backend permite as origens usadas pelo web, desktop local e ambientes publicados. Como cookies são usados, `allowCredentials` precisa permanecer habilitado e as origens devem continuar alinhadas com os clientes.

## 4. Funcionalidades do usuário

### 4.1 Receitas

O usuário pode criar, listar, editar e excluir receitas. Uma receita possui, em linhas gerais:

- descrição;
- valor;
- data inicial;
- data final quando aplicável;
- categoria;
- frequência;
- indicação de recorrência.

Endpoints principais:

- `POST /api/income`
- `GET /api/income`
- `GET /api/income/total`
- `PUT /api/income/{id}`
- `DELETE /api/income/{id}`

### 4.2 Despesas

As despesas podem ser cadastradas manualmente ou criadas a partir de um extrato importado. Os dados incluem:

- valor;
- descrição;
- data inicial;
- categoria;
- frequência;
- duração em meses;
- tipo de pagamento, como cartão de crédito ou boleto;
- indicação de pagamento.

Endpoints principais:

- `POST /api/costs`
- `GET /api/costs`
- `GET /api/costs/total`
- `PUT /api/costs/{id}`
- `DELETE /api/costs/{id}`

O frontend converte o campo de entrada `amount` para o campo `value` esperado pelo backend. Essa compatibilidade deve ser preservada ao alterar o contrato.

### 4.3 Parcelas e recorrência

O domínio diferencia despesas únicas de despesas mensais ou parceladas. A importação identifica textos como:

- `Parcela X/Y`;
- `02/12` no fim da descrição;
- formatos equivalentes sem espaço.

Quando uma parcela é encontrada, o sistema calcula a parcela atual, o total de parcelas e quantos meses ainda devem ser considerados. A descrição também é limpa para não manter o marcador da parcela.

Essas regras afetam a listagem de despesas, pagamentos mensais e projeções. Uma alteração no parser ou na entidade `Outgoing` deve ser avaliada junto com dashboard e pagamentos.

### 4.4 Investimentos

O usuário pode criar, listar, editar e excluir investimentos. O investimento possui valor, descrição, datas, tipo e retorno esperado.

O backend calcula projeções de valor futuro usando o retorno esperado e juros compostos. O dashboard utiliza esses dados para mostrar investimentos e patrimônio projetado.

Endpoints principais:

- `POST /api/investments`
- `GET /api/investments`
- `GET /api/investments/total`
- `PUT /api/investments/{id}`
- `DELETE /api/investments/{id}`

### 4.5 Pagamentos mensais

O pagamento de uma despesa não é apenas uma propriedade global da despesa. O sistema possui uma tabela de status por despesa e mês.

Isso permite que uma despesa recorrente ou parcelada apareça em vários meses, com status independente em cada mês. A tela permite:

- navegar para o mês anterior ou seguinte;
- filtrar todos, pendentes ou pagos;
- marcar uma despesa como paga ou pendente;
- pagar todas as despesas do mês.

Endpoints:

- `GET /api/payment-status`
- `PUT /api/payment-status/{outgoingId}`

O identificador de mês usa o formato `YYYY-MM` no backend.

### 4.6 Dashboard

O dashboard combina dados de receitas, despesas e investimentos. Ele apresenta:

- renda total;
- despesas totais;
- investimentos;
- patrimônio líquido;
- projeção anual mês a mês;
- visão mensal por dia;
- despesas agrupadas por categoria;
- alocação de investimentos;
- meta de gastos.

Endpoints:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/projection/year`
- `GET /api/dashboard/projection/month`
- `GET /api/dashboard/summary/monthly?month=YYYY-MM`

No frontend web, a meta de gastos é persistida em `localStorage` e pode ser desenhada como referência no gráfico. No mobile, a meta é exibida, mas a linha de referência ainda não é desenhada sobre o gráfico.

## 5. Importação de extratos

### Arquivos aceitos

O backend aceita arquivos com extensão:

- `.csv`;
- `.ofx`;
- `.pdf`.

O frontend mobile usa `expo-document-picker`. Web e desktop têm fluxos equivalentes integrados à tela de despesas.

### Fluxo assíncrono

```text
Cliente
  │ POST /api/statement/import
  │ arquivo + dueDate + creditCardId opcional
  ▼
Backend grava ImportJob no PostgreSQL
  │
  ├── publica apenas o jobId no RabbitMQ
  ▼
Consumer RabbitMQ
  │ marca PROCESSING
  │ busca os bytes no banco
  │ chama o serviço Python
  │ cria despesas a partir do resultado
  │ marca DONE ou ERROR
  ▼
Cliente consulta GET /api/statement/status/{jobId}
```

O endpoint de envio responde `202 Accepted` rapidamente com um `jobId`. O arquivo não é enviado dentro da mensagem RabbitMQ; os bytes permanecem na tabela de jobs e a mensagem contém apenas o identificador.

### Estados do job

O fluxo possui estados equivalentes a:

- aguardando processamento;
- processamento em andamento;
- concluído;
- erro.

O cliente faz polling do status até receber conclusão ou erro. O job é validado para impedir que um usuário consulte o job de outro usuário.

### Microserviço Python

O serviço Flask roda normalmente na porta 5000 e expõe:

- `GET /health`;
- `POST /processar-extrato`.

Ele retorna transações normalizadas com campos usados pelo backend:

```json
{
  "description": "Descrição limpa",
  "amount": 100.5,
  "startDate": "2024-01-15",
  "category": "Food & Dining",
  "frequency": "One-time",
  "durationInMonths": 1,
  "installmentNumber": 0,
  "totalInstallments": 0,
  "paymentType": "Cartão de Crédito",
  "paid": false
}
```

### Regras atuais de parsing

- CSV: espera colunas `date`, `title` e `amount`.
- OFX: extrai `DTPOSTED`, `TRNAMT` e `MEMO`; créditos e estornos positivos são ignorados.
- PDF Itaú: usa regras específicas para layout, transações, compras parceladas e faturas futuras.
- Valores retornados são positivos para despesas.
- Valores zero ou inválidos são ignorados.
- Categorias são inferidas por palavras-chave, como supermercado, Uber, farmácia, Netflix e escola.
- Quando nenhuma palavra-chave corresponde, a categoria é `Other`.

## 6. Backend Java

O backend fica em `Domus_BackEnd/domus` e usa uma organização por camadas:

- `controller/`: endpoints HTTP;
- `service/`: regras de negócio;
- `repository/`: acesso ao banco;
- `entity/`: entidades JPA;
- `dto/`: objetos de entrada e saída da API;
- `config/`: segurança e configuração da aplicação;
- `messaging/`: RabbitMQ;
- `exception/`: erros de negócio e tratamento global;
- `src/main/resources/db/migration/`: migrações Flyway.

### Entidades principais

- `User`: usuário e dados de autenticação;
- `Income`: receitas;
- `Outgoing`: despesas;
- `Investments`: investimentos;
- `PaymentStatus`: estado de pagamento por despesa e mês;
- `CreditCard`: cartão e últimos quatro dígitos;
- `ImportJob`: arquivo e estado da importação.

O ownership dos registros é importante: os services devem sempre limitar os dados ao usuário autenticado.

### Banco e migrações

PostgreSQL é usado em desenvolvimento/produção. Os testes usam H2. O Hibernate está configurado para validar o schema e o Flyway é o responsável pelas mudanças estruturais.

As migrações existentes incluem schema inicial, ajuste de retorno de investimentos, criação de jobs de importação e criação de cartões de crédito. Novas mudanças estruturais devem receber uma nova migração versionada e não editar migrações já aplicadas.

## 7. Frontend web

O frontend web está em `Domus_FrontEnd/domus-frontend`.

### Organização

- `src/components/`: páginas e componentes de domínio;
- `src/layouts/`: layout protegido;
- `src/context/`: autenticação e tema;
- `src/hooks/`: hooks reutilizáveis;
- `src/service/`: serviços Axios por domínio;
- `src/lib/api.ts`: cliente Axios, cookie, retries e tratamento de sessão;
- `src/ui-components/`: primitivas reutilizáveis;
- `src/utils/`: formatadores e labels;
- `public/`: logo e assets públicos.

Rotas visíveis principais:

- `/login`;
- `/register`;
- `/dashboard`;
- `/income`;
- `/expenses`;
- `/investments`;
- `/payments`.

O conteúdo protegido fica dentro de `PrivateLayout`. O tema claro/escuro é mantido por contexto. Gráficos usam Recharts e a estilização usa Tailwind.

### Publicação

O pipeline do frontend instala dependências, roda lint, verifica tipos/build e, na branch principal, sincroniza `dist/` com S3 e invalida o CloudFront.

## 8. Aplicativo desktop

O desktop está em `Domus_FrontEnd_Exe/domus-frontend`.

Ele reutiliza o modelo React do web, mas possui:

- processo principal Electron em `electron/main.cjs`;
- preload em `electron/preload.cjs`;
- logging com `electron-log`;
- servidor estático local para o build de produção;
- single-instance lock;
- abertura de links externos no navegador padrão;
- empacotamento Windows com electron-builder e NSIS.

O renderer usa `http://localhost:5173` como origem local. Essa origem precisa continuar liberada no CORS do backend.

A variante desktop possui uma tela/serviço de cartões de crédito que não está presente na mesma forma no frontend web atual. Portanto, mudanças feitas no web não devem ser copiadas automaticamente para o desktop sem comparar os arquivos.

## 9. Aplicativo mobile

O mobile está em `Domus_Mobile` e usa Expo Router.

### Navegação

- `app/(auth)/`: login e cadastro;
- `app/(tabs)/`: dashboard, receitas, despesas, investimentos e pagamentos;
- `app/_layout.tsx`: providers, tema, navegação e `AuthGate`.

O `AuthGate` observa a autenticação e:

- manda usuários não autenticados para login;
- manda usuários autenticados para as tabs;
- mostra loading enquanto a sessão está sendo carregada.

### Diferenças atuais em relação ao web

- datas ainda são inputs de texto no formato `AAAA-MM-DD`;
- a meta de gastos é exibida, mas não desenha `ReferenceLine` no gráfico;
- a seleção de mês do gráfico usa chips roláveis, não clique direto no eixo;
- o comportamento do cookie HttpOnly em dispositivo/emulador real ainda precisa ser validado; o código atual assume que o stack nativo mantém o cookie jar.

## 10. Ambientes e configuração

As configurações são separadas por ambiente e devem usar variáveis externas para segredos.

Variáveis e integrações relevantes incluem:

- `VITE_API_URL` no web/desktop;
- `EXPO_PUBLIC_API_URL` no mobile;
- `JWT_SECRET` e `JWT_EXPIRATION`;
- credenciais Supabase/PostgreSQL;
- senha do keystore SSL;
- usuário e senha de RabbitMQ;
- URL do serviço Python;
- credenciais administrativas/demo.

Nunca colocar esses valores diretamente neste documento ou em código versionado.

## 11. Deploy e infraestrutura atual

O projeto possui pipelines independentes:

- frontend web: lint/build e deploy para S3 + CloudFront;
- backend Java: testes Maven, imagem Docker, Docker Hub e deploy em EC2;
- microserviço Python: estrutura preparada para build/deploy independente;
- mobile: configuração EAS em `eas.json` para builds de desenvolvimento, preview e produção.

Na produção descrita pelo projeto:

- o frontend é servido por S3/CloudFront;
- o backend roda em container na EC2 com HTTPS na porta 8443;
- o certificado usa PKCS12 montado no container;
- RabbitMQ roda em container na rede Docker `domus-net`;
- PostgreSQL é fornecido pelo Supabase;
- o serviço de extratos é acessado pela URL configurada em `STATEMENT_SERVICE_URL`.

## 12. Comandos de desenvolvimento

```bash
# Frontend web
cd Domus_FrontEnd/domus-frontend
npm install
npm run dev

# Desktop
cd Domus_FrontEnd_Exe/domus-frontend
npm install
npm run electron:dev

# Backend
cd Domus_BackEnd/domus
./mvnw spring-boot:run

# Testes backend
./mvnw clean verify

# Microserviço Python
cd domus_python
python -m pytest

# Mobile
cd Domus_Mobile
npm install
npm run start
```

Para o mobile, a URL depende do alvo: `localhost` no iOS Simulator, `10.0.2.2` no Android Emulator ou o IP da máquina em dispositivo físico.

## 13. Regras importantes para futuras alterações

1. Tratar a API Java como contrato compartilhado entre web, desktop e mobile.
2. Ao alterar DTO, endpoint, enum, datas ou status HTTP, procurar todos os services dos três clientes.
3. Ao alterar parcelas, categorias ou importação, atualizar testes Python e verificar despesas, pagamentos e dashboard.
4. Ao alterar autenticação, revisar cookie, CORS, Axios, Expo Router e Electron.
5. Ao alterar schema, criar migração Flyway nova e revisar testes H2.
6. Não expor segredos, dados bancários, arquivos de extrato ou tokens em logs/documentação.
7. Executar validações da área alterada e declarar limitações quando banco, RabbitMQ, AWS ou dispositivo móvel não estiverem disponíveis.

## 14. Estado atual resumido

O núcleo financeiro está implementado para web, desktop e mobile, com pequenas diferenças de paridade entre clientes. A API Java concentra autenticação, regras, persistência e dashboard. A importação de extratos está desenhada como job assíncrono com RabbitMQ, armazenamento temporário no banco e polling pelo cliente. O microserviço Python contém parsers específicos para formatos de bancos e regras heurísticas de categoria e parcela.

As áreas que exigem mais cuidado em futuras pesquisas ou mudanças são:

- contrato de autenticação por cookie entre plataformas;
- consistência de payloads entre os três clientes;
- regras de recorrência e parcelas;
- status de pagamento por mês;
- idempotência e segurança da importação;
- diferenças de funcionalidade entre web, desktop e mobile;
- configuração de produção e segredos externos.
