# Agente do repositório Desktop

Este diretório contém a variante Electron do frontend. O app fica em `domus-frontend/`; leia também o `AGENTS.md` dentro dele.

## Skills especializadas

- React/TypeScript/Vite: mesmas regras do frontend web, respeitando divergências da variante desktop.
- Electron seguro: processo principal, preload, `contextIsolation`, `sandbox` e `nodeIntegration: false`.
- Empacotamento Windows: electron-builder, NSIS, ícone, `dist`, `release` e single-instance lock.
- Integração web-desktop: servidor estático local em `127.0.0.1:5173`, logging e links externos.

## Cuidados

- Esta variante já possui funcionalidades ausentes no web, como cartões de crédito; não force paridade sem verificar o backend.
- A origem `http://localhost:5173` precisa continuar compatível com o CORS do backend.
- Nunca exponha APIs Node ao renderer além do contrato mínimo do preload.
- Não gere ou comite `release/`, instaladores, logs ou credenciais.
