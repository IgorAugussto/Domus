# Domus Mobile

Versão mobile (Expo / React Native) do [Domus](../../Domus_FrontEnd/domus-frontend), o controlador de finanças pessoais. Consome a mesma API Java usada pelo app web.

## Escopo desta versão (paridade com o web)

- Login e Registro
- Dashboard (KPIs, gráfico anual/mensal, despesas por categoria, alocação de investimentos, meta de gastos)
- Receitas (cadastrar / listar / editar / excluir)
- Despesas (cadastrar / listar / editar / excluir)
- Investimentos (cadastrar / listar / editar / excluir)
- Pagamentos (navegação por mês, filtro por status, marcar pago/pendente, pagar todos do mês)
- Importar Extrato (CSV/OFX/PDF via `expo-document-picker`, com polling de status do job assíncrono), integrado na tela de Despesas

## Rodando localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Configure a URL da API em `.env` (`EXPO_PUBLIC_API_URL`):
   - **iOS Simulator**: `http://localhost:8080/api` funciona normalmente.
   - **Android Emulator**: use `http://10.0.2.2:8080/api` (o emulador não enxerga `localhost` da máquina host).
   - **Dispositivo físico via Expo Go**: use o IP da sua máquina na rede local, ex: `http://192.168.0.10:8080/api`.

3. Suba o backend Java (mesma API do `domus-frontend`).

4. Inicie o app:

   ```bash
   npx expo start
   ```

## Autenticação

A sessão usa cookie HttpOnly (`POST /auth/login`, `GET /auth/me`), igual ao app web — sem token manual no client. O stack de rede nativo do iOS/Android mantém o cookie jar automaticamente, então deve funcionar sem biblioteca extra. **Ainda não foi validado em emulador/dispositivo real** (ambiente de desenvolvimento sem simulador disponível) — ao testar, confirme que login → fechar o app → reabrir mantém a sessão. Se a sessão não persistir, o fallback é a lib `@react-native-cookies/cookies`.

## Limitações conhecidas desta primeira versão

- Campos de data são inputs de texto no formato `AAAA-MM-DD` (não há date picker nativo integrado ainda).
- A meta de gastos é salva e exibida como texto acima do gráfico, mas não desenha uma linha de referência sobre o gráfico (diferente do web, que usa `ReferenceLine` do Recharts).
- Seleção de mês no gráfico anual é feita por uma lista de chips roláveis abaixo do gráfico, em vez de clicar diretamente no eixo X.

## Estrutura

Mesma organização conceitual do `domus-frontend` (`lib/api.ts`, `services/*`, `context/*`, `utils/labels/*`), adaptada para Expo Router:

- `app/(auth)/` — login e registro (rotas públicas)
- `app/(tabs)/` — Dashboard, Receitas, Despesas, Investimentos, Pagamentos (rotas protegidas)
- `components/ui/` — primitivos de UI com NativeWind (Card, Button, Input, Label, Select, TextArea)

## Laboratório local de notificações

O app possui uma aba `Laboratório` para validar a captura sem realizar compras. A POC:

- mantém configurações, fila nativa e registros em `AsyncStorage`/`SharedPreferences` no dispositivo;
- emite notificações locais reais do Android nos formatos Carteira do Google e Nubank;
- testa uma compra duplicada em duas fontes e duas compras distintas com o mesmo valor;
- marca cada registro como `SIMULADA` ou `REAL`;
- separa a captura real (Carteira do Google/Nubank) do modo de testes;
- só permite monitorar WhatsApp no modo de testes e aceita apenas mensagens com o marcador `[DOMUS TESTE]`;
- mantém a captura e o texto bruto somente no dispositivo; pela ação explícita
  **Sincronizar**, envia ao Supabase apenas os campos financeiros normalizados
  (valor, estabelecimento, data, origem e identificador idempotente). Não envia
  título ou corpo bruto da notificação.

Após entrar com sua conta Supabase, a tela **Revisar lançamentos sincronizados**
mostra as capturas pendentes e permite confirmá-las. Essa tela usa as mesmas
políticas RLS que web e Electron.

O `NotificationListenerService` exige um development build Android, não Expo Go. Para validar:

1. Ative a captura de notificações na aba Laboratório.
2. Selecione Carteira do Google e/ou Nubank e abra o acesso especial às notificações.
3. Para simulações, ative também o modo de testes e selecione `Simulador Domus`.
4. Emita uma notificação simulada, depois use os botões de duplicidade e de mesmo valor.
5. Ao ativar a captura, o listener também verifica notificações ainda visíveis na central do Android.

O módulo nativo está em `modules/domus-notification-listener/` e o parser/deduplicação em `src/poc/`.

## Supabase (Fase 2)

O login agora usa Supabase Auth. Sem incluir valores no Git, configure localmente
as variáveis públicas já disponíveis no projeto Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

O primeiro login chama a função SQL `ensure_current_domus_user`, definida nas
migrações versionadas em `../supabase/migrations/`. Portanto, aplique as
migrações antes de validar o login. O cadastro público não existe no aplicativo:
o usuário é provisionado administrativamente no Supabase Auth.
