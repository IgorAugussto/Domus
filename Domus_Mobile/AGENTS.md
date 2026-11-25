# Agente do app Mobile

## Stack e comandos

- Expo SDK 54, React Native 0.81, Expo Router, TypeScript, NativeWind e React Navigation.
- Rode `npm run lint`; use `npm run start`, `npm run android`, `npm run ios` ou `npm run web` conforme o alvo.
- A URL da API vem de `EXPO_PUBLIC_API_URL`; variáveis `EXPO_PUBLIC_*` entram no bundle e não são segredos.

## Skills especializadas

- Navegação Expo Router: grupos `(auth)` e `(tabs)`, layouts e `AuthGate` em `app/`.
- UI nativa: componentes em `components/`, tema em `constants/` e `context/`, estilos NativeWind em `global.css`.
- Integração API: services em `services/`, Axios em `lib/api.ts`, autenticação e redirecionamento com `expo-router`.
- UX mobile: safe areas, teclado, gestos, haptics, loading, erro, acessibilidade e diferenças entre Android/iOS/web.
- Domínio financeiro: mantenha paridade de payload com web/backend sem presumir que o layout desktop se aplica ao celular.

## Regras

- Preserve o fluxo de autenticação: `AuthProvider` + `AuthGate`, cookie/credenciais e redirecionamento para `/login` em 401/403.
- Não coloque tokens, senhas ou chaves nos arquivos `app.json`, `.env` ou código versionado.
- Ao criar uma tela, defina a rota/layout correto, estados de loading/erro/vazio e teste ao menos em um alvo nativo quando possível.
- Não execute `scripts/reset-project.js` como parte de uma correção normal: ele pode remover/reescrever estrutura inicial.
