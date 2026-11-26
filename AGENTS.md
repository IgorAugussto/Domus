# Domus — instruções gerais para agentes

## Missão do projeto

Domus é uma aplicação de controle financeiro pessoal. O fluxo principal é:

`web / desktop / mobile → API Spring Boot → PostgreSQL`

O processamento de extratos CSV, OFX e PDF é delegado pelo backend ao serviço Flask Python, de forma síncrona ou via RabbitMQ conforme o fluxo.

## Mapa do repositório

- `Domus_FrontEnd/`: frontend web React + TypeScript + Vite, publicado como arquivos estáticos.
- `Domus_FrontEnd_Exe/`: variante desktop Electron; compartilha o domínio visual e a API, mas tem código próprio de Electron.
- `Domus_BackEnd/`: wrapper do repositório do backend, CI e documentação.
- `Domus_BackEnd/domus/`: aplicação Spring Boot, código Java, migrações Flyway e Dockerfile.
- `domus_python/`: microserviço Flask de processamento de extratos.
- `Domus_Mobile/`: app Expo/React Native com Expo Router e NativeWind.
- `.agents/` e `.codex/`: metadados locais; não altere sem solicitação explícita.

Cada área possui um `AGENTS.md` mais específico. Ao atuar nela, leia o arquivo mais profundo aplicável além deste.

## Regras que valem para todo o projeto

- Preserve a separação entre frontend, backend Java, serviço Python e mobile. Não copie uma correção para outra variante sem verificar diferenças reais.
- Garanta paridade funcional entre web, desktop e mobile: as três versões devem permitir acessar e editar os mesmos dados e recursos financeiros, respeitando diferenças nativas inevitáveis. Revise e valide todas as variantes ao entregar funcionalidades ou corrigir contratos; registre diferenças temporárias explicitamente.
- Trate a API como contrato compartilhado. Ao mudar endpoint, autenticação, payload, enum, data ou status HTTP, procure e atualize todos os consumidores web, desktop e mobile.
- Não leia, exponha, commite ou substitua segredos de `.env`, chaves JWT, credenciais de banco, keystore, AWS, Docker Hub ou RabbitMQ. Use variáveis de ambiente e exemplos redigidos.
- Não faça migrações destrutivas nem altere dados de produção. O schema é gerenciado por Flyway; Hibernate deve apenas validar em ambientes normais.
- Mantenha compatibilidade com autenticação JWT em cookie, `withCredentials`, CORS e redirecionamento de sessão. Mudanças de origem/porta exigem revisão no backend e no Electron.
- Preserve categorias, frequência, parcelas, pagamentos mensais e projeções: são regras de domínio, não apenas detalhes de UI.
- Evite alterações automáticas em `node_modules`, `venv`, `target`, `dist`, `build`, `release` e arquivos gerados.
- Prefira mudanças pequenas e localizadas. Antes de refatorar uma estrutura compartilhada, confirme os imports e os consumidores.

## Fluxo de trabalho padrão

1. Identifique o domínio e leia o `AGENTS.md` específico.
2. Inspecione o código relacionado, os testes e o contrato consumido/produzido.
3. Faça a menor alteração coerente com as convenções existentes.
4. Rode validações proporcionais à área alterada e informe o que não pôde ser executado.
5. Revise `git diff` e `git status`; não inclua artefatos ou segredos.

## Validações rápidas

- Frontend web: `cd Domus_FrontEnd/domus-frontend && npm ci && npm run lint && npm run build`
- Desktop Electron: `cd Domus_FrontEnd_Exe/domus-frontend && npm ci && npm run lint && npm run build`; para empacotamento, `npm run electron:pack`.
- Backend: `cd Domus_BackEnd/domus && ./mvnw clean verify` (ou `mvnw.cmd` no Windows).
- Python: `cd domus_python && python -m pytest`.
- Mobile: `cd Domus_Mobile && npm ci && npm run lint`; execute o app em um dispositivo/emulador quando a mudança for visual ou nativa.

Se uma validação exigir serviço externo, banco, RabbitMQ, AWS, credenciais ou rede não disponíveis, não simule sucesso: registre a limitação.

## Critério de conclusão

Uma tarefa só está concluída quando o comportamento pedido foi implementado, os contratos afetados foram revisados, a validação adequada foi executada e o resumo final informa arquivos, testes e limitações.
