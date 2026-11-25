# Agente do app Desktop Electron

## Stack e comandos

- React 19 + TypeScript + Vite no renderer.
- Electron 33 no processo principal; `electron/main.cjs` e `electron/preload.cjs` são a fronteira de segurança.
- `npm run lint`, `npm run build`, `npm run electron:dev`, `npm run electron:pack`.

## Skills especializadas

- Renderer React: siga a organização de `src/` e as convenções do frontend web, sem assumir que os arquivos são idênticos.
- Segurança Electron: mantenha `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; prefira IPC explícito no preload.
- Ciclo de vida: preserve single-instance lock, servidor estático de produção, tratamento de porta ocupada e abertura de links externos no navegador.
- Observabilidade: use `electron-log` quando apropriado; não grave tokens, senhas ou payloads financeiros sensíveis nos logs.

## Regras de integração

- A porta local 5173 e a origem liberada no backend são acopladas; mudanças exigem revisão dos dois lados.
- O build do Electron inclui `dist/**/*`, `electron/**/*` e `package.json`; não dependa de arquivos que não entram no pacote.
- Valide empacotamento apenas quando a alteração tocar Electron, configuração do builder ou assets.
