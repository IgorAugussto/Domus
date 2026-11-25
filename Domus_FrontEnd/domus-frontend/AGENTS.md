# Agente do app Frontend Web

## Stack e comandos

- React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7.
- Serviços HTTP ficam em `src/service/`; cliente Axios e interceptors em `src/lib/api.ts`.
- Rode `npm run lint` e `npm run build` após mudanças relevantes. `npm run build` também verifica tipos via `tsc -b`.

## Skills especializadas

- Componentização React: páginas em `src/components/`, layout privado em `src/layouts/`, estado transversal em `src/context/`.
- Design system: controles reutilizáveis em `src/ui-components/`; use as primitivas existentes antes de criar outra.
- Dados financeiros: preserve os tipos em `src/types.ts`, formatadores e labels em `src/utils/`.
- Integração API: use os services existentes; não faça Axios direto em páginas sem necessidade clara.
- Acessibilidade e UX: estados de carregamento, erro, vazio, confirmação e feedback devem permanecer explícitos.

## Convenções e invariantes

- Autenticação usa cookie JWT, `withCredentials: true` e redireciona 401/403 para login; alterações no interceptor exigem cuidado com `_silentAuth` e retries.
- `VITE_API_URL` vem do ambiente. Nunca coloque token, senha ou URL secreta no bundle.
- Datas e valores monetários devem passar pelos formatadores existentes; não misture formatos de backend, display e input.
- Para nova funcionalidade, atualize rota, serviço, tipos, estados de loading/erro e feedback quando aplicável.
- Mantenha o escopo visual das páginas; não substitua componentes compartilhados por estilos duplicados.
