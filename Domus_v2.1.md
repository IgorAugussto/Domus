# Domus — arquitetura proposta v2.1

> 19/11/2026 · Documento de planejamento. Complementa o contexto técnico original; não representa funcionalidades já implementadas.

## 1. Objetivo e escopo

Manter o Domus como aplicativo de controle financeiro pessoal, com receitas, despesas, parcelas, cartões, investimentos, pagamentos mensais e dashboard. Priorizar Android (Expo/React Native) e desktop Ubuntu (Electron/React), com sincronização via Supabase e custo recorrente pretendido de R$ 0.

O importador CSV/OFX/PDF deixa de ser requisito desta versão. A captura de compras por notificações bancárias e a conferência manual das faturas passam a ser a estratégia principal. O frontend web fica fora do escopo prioritário, sem decisão de exclusão definitiva.

## 2. Arquitetura

```text
Android — Expo/React Native + módulo Kotlin
   NotificationListenerService → parser → fila local
                    ↓
              Supabase Auth + API/RPC
                    ↓
          PostgreSQL + RLS + funções SQL
                    ↑
Ubuntu — Electron/React
```

Os clientes acessam a API do Supabase com chave pública e sessão autenticada, nunca com credenciais administrativas do banco ou service_role. Não há necessidade prevista de servidor Java, Python, RabbitMQ ou EC2 em operação contínua após a migração validada. Realtime é opcional; atualização na abertura/retorno à tela já atende ao requisito inicial de sincronização.

O sistema atual usa Spring Boot para autenticação, domínio e persistência; Python e RabbitMQ para importação. Essas responsabilidades não desaparecem automaticamente com a retirada do importador. Preservar código e histórico Git, bem como backup do banco, até concluir a transição.

## 3. Evidência real: notificações Android

O print fornecido apresenta duas notificações às 08:22 referentes aparentemente à mesma compra:

- Carteira do Google: título `LOJAS AUT`; texto `R$ 12,90 com Nubank Mastercard Platinum ••6156`.
- Nubank: título de compra no crédito aprovada; texto visível `Compra de R$ 12,90 APROVADA em LOJAS AUT para o cartão com final ...`.

A notificação da Carteira do Google contém estabelecimento, valor, emissor/bandeira e final do cartão. A do Nubank está truncada na imagem; seu conteúdo integral precisa ser coletado no dispositivo. A coincidência de horário, valor e estabelecimento demonstra um cenário concreto de potencial duplicidade. O print não comprova cobertura de todas as compras nem acesso programático aos campos.

### Registro esperado para a compra de exemplo

| Campo | Valor |
|---|---|
| Descrição | LOJAS AUT |
| Valor | 12,90 BRL |
| Cartão | Nubank Mastercard Platinum, final 6156 |
| Data/hora | 19/11/2026 08:22 (hora local exibida) |
| Origem | Carteira do Google |
| Revisão | Não revisada |
| Categoria / parcelas | A determinar |

O final pode corresponder ao cartão virtual/tokenizado da carteira e não ao físico; permitir associação manual de identificadores ao cartão cadastrado.

## 4. Captura e processamento

1. Solicitar consentimento e acesso especial às notificações do Android.
2. Implementar NotificationListenerService em Kotlin, integrado ao Expo por módulo nativo e development build (não Expo Go). expo-notifications isoladamente não lê notificações de outros apps.
3. Filtrar aplicativos permitidos pelo identificador de pacote verificado no aparelho. Começar pela Carteira do Google e testar Nubank como fonte complementar.
4. Extrair título, texto e campos expandidos disponíveis; normalizar moeda, descrição, horário e identificador do cartão. Ignorar mensagens sem relação com compras, recusas e avisos gerais.
5. Persistir evento mínimo em fila local durável; sincronizar com sessão válida, retry e idempotência. Não depender de a interface React estar aberta. Validar comportamento com tela bloqueada, reinício, falta de internet e economia de bateria.
6. Criar automaticamente despesas de alta confiança como não revisadas; encaminhar casos ambíguos (cartão desconhecido, possível duplicidade, parcela incerta) para revisão. Não presumir compra à vista quando faltarem dados suficientes.
7. Atualizar dashboard e disponibilizar registro ao desktop após sincronização.

### Duplicidades e ajustes

Usar identificador estável por evento e restrição única no banco para reenvios. Para eventos de fontes diferentes, comparar usuário, cartão associado, valor em centavos, estabelecimento normalizado e proximidade temporal. A janela temporal é parâmetro a calibrar com testes. Não tratar esse conjunto como chave única definitiva: compras legítimas iguais podem ocorrer em sequência. Priorizar uma fonte por compra, vincular eventos corroborantes e colocar coincidências incertas em revisão. Usar operação transacional para evitar concorrência.

Estornos, cancelamentos e diferenças entre autorização e lançamento final devem ser revisáveis. Não apagar despesas automaticamente apenas por receber uma notificação de estorno ambígua.

## 5. Conferência de faturas

No fechamento, consultar o total da fatura no banco, selecionar cartão e ciclo no Domus, comparar totais e corrigir divergências manualmente. Guardar valor informado, valor calculado, diferença, data de conferência e observação. Separar estado de conferência do estado de pagamento. Reabrir a conferência se lançamentos relevantes mudarem.

Considerar fechamento, vencimento, competência, parcelas, juros, tarifas, estornos, créditos e saldo anterior conforme a composição da fatura. Não confundir pagamento da fatura com nova despesa de consumo. Totais iguais não provam correspondência individual de todas as compras.

## 6. Modelo de dados proposto

Preservar os conceitos existentes Income, Outgoing, Investments, PaymentStatus e CreditCard. Preservar IDs bigint e relacionamentos atuais; propor vínculo UUID único com auth.users por migração. Usar os nomes físicos existentes sempre que possível.

| Entidade | Responsabilidade |
|---|---|
| credit_cards | Cartão, fechamento, vencimento e titular proprietário |
| card_aliases | Identificadores físicos/virtuais associados ao cartão |
| outgoing | Valor decimal exato, descrição, categoria, origem, revisão, compra e competência |
| notification_events | Identificador de evento, fonte, dados mínimos normalizados, estado e vínculo com despesa |
| credit_card_statements | Cartão, ciclo, total bancário/calculado, diferença e estado de conferência |
| payment_status | Estado de pagamento por despesa e mês (YYYY-MM) |
| income / investments | Receitas e investimentos existentes |

Todas as tabelas de usuário devem ter políticas RLS para leitura e mutação, inclusive validação de ownership dos relacionamentos. Aplicar constraints, índices e operações atômicas. Não guardar conteúdo de notificações não financeiras; minimizar retenção de texto bruto e evitar dados bancários em logs. Proteger a sessão e a fila local. Prever exclusão de dados e revogação de permissão.

## 7. Regras financeiras e migração

Migrar autenticação JWT por cookie/Spring Security para Supabase Auth; planejar associação das contas existentes e eventual redefinição de senha. Substituir os services Axios dos clientes gradualmente pelo SDK Supabase. Manter regras de recorrência, parcelas, status mensal, receitas, juros compostos dos investimentos e projeções de dashboard. Concentrar invariantes e cálculos compartilhados em SQL, views com segurança apropriada e RPCs; usar TypeScript compartilhado para apresentação e validações auxiliares. Testar equivalência de resultados com a API Java atual.

Versionar novas migrações SQL sem reescrever migrações Flyway já aplicadas; definir um único mecanismo responsável pelo schema na nova arquitetura. Não executar alterações destrutivas antes de backup e validação. Garantir paridade de cartões no mobile e desktop. O empacotamento desktop original é Windows/NSIS; validar build Linux e armazenamento seguro da sessão.

## 8. Plano de implementação

- Fase 0 — prova de conceito Android: capturar exemplos reais da Carteira do Google e Nubank, confirmar campos, duplicidades e funcionamento em segundo plano. Testar compras sem carteira, parcelas, estornos e indisponibilidade de rede.
- Fase 1 — schema, Supabase Auth, RLS, backup e migração de dados em ambiente de teste.
- Fase 2 — migrar CRUD e regras financeiras; validar dashboard, recorrência, investimentos e pagamentos.
- Fase 3 — paridade Android/Ubuntu, captura automática, fila local, deduplicação e revisão.
- Fase 4 — tela de conferência de faturas e testes de ciclo completo.
- Fase 5 — corte de produção, validação de dados, desativação da infraestrutura antiga e plano de rollback.

## 9. Critérios de aceite

- A compra de exemplo gera uma única despesa de R$ 12,90 mesmo com duas notificações; repetição do processamento não duplica lançamento.
- Compras legítimas iguais e próximas podem ser preservadas separadamente.
- Falhas de rede não descartam eventos já capturados; sincronização posterior não duplica despesas.
- Usuário só acessa e altera seus próprios registros, inclusive via RPCs.
- Compras não revisadas são identificáveis, editáveis e conferíveis.
- Faturas, parcelas, pagamentos e projeções conferem com casos de referência do sistema atual.
- Revogação de permissão interrompe captura; dados alheios ao escopo financeiro não são enviados.

## 10. Custos, limitações e decisões pendentes

Meta de R$ 0/mês com Supabase Free, builds locais e distribuição pessoal. Não é garantia: limites, inatividade, condições do plano e eventuais custos de publicação/build precisam ser verificados antes do corte. Manter backups exportáveis.

A captura é restrita ao Android nesta proposta. Notificações podem faltar, variar conforme versão do app ou não informar parcelas. A Carteira do Google não deve ser considerada fonte de todas as transações do cartão. Validar cobertura antes de depender exclusivamente dela. A estratégia de fonte prioritária, janela de deduplicação, regras de revisão e formato final das tabelas são propostas, não decisões confirmadas pelo usuário.

O importador permanece no backlog; reavaliar apenas se a captura e conferência manual não atenderem à rotina. Nada foi implementado, implantado ou testado neste documento.

## 11. Referências de contexto

- DOMUS_PROJECT_CONTEXT.md — descrição do sistema original, especialmente seções 3–6, 8–11 e 13–14.
- Print de notificações Android fornecido em 19/11/2026 — evidência visual utilizada na seção 3. Não reproduzido para evitar exposição de notificações pessoais alheias ao projeto.
- Conversa de planejamento — decisões de escopo e proposta de arquitetura Supabase.


## 12. Divisão de responsabilidades: painel Supabase e Codex

**Painel Supabase (operador):** verificar projeto, Data API, permissões, autenticação, configuração de cadastro e provedores, obter URL e chave pública, criar conta pessoal quando indicado, realizar backup seguro e verificar restauração. Executar somente migrações revisadas se o Codex não tiver acesso remoto autorizado. Validar resultados e registrar versão aplicada. Não compartilhar senha do banco, service_role, tokens ou dados financeiros com o Codex.

**Codex (repositório):** produzir todas as mudanças de schema, grants, RLS, funções, views, RPCs, constraints, índices, migração de dados e testes como código versionado. Criar diretório de migrações Supabase (por exemplo supabase/migrations), estabelecer baseline do banco existente sem reaplicar DDL inicial em produção, preservar histórico Flyway e definir um único mecanismo de migração após o corte. Validar em banco de teste antes de aplicar remotamente. Entregar SQL revisável, ordem, pré-condições, verificações e plano de rollback; não executar alterações remotas sem autorização. Se SQL Editor for usado, reconciliar o histórico de migrações para impedir reaplicação; não executar duas vezes via CLI e painel.

## 13. Diagnóstico do banco existente (19/11/2026)

Fontes: três CSVs Supabase Snippet Processo_Migracao, exportados pelo usuário (colunas, FKs, grants); print Policies; confirmação de Authentication sem usuários.

- Schema public: credit_cards, flyway_schema_history, import_jobs, income, investments, outgoing, payment_status, users. RLS desabilitado e sem políticas nas oito tabelas conforme print.
- Grants para anon e authenticated incluem SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER nas sete primeiras tabelas (exceto users, cujo CSV termina após anon DELETE e INSERT). Verificar grants completos, indiretos, de coluna e de funções. Risco de exposição pela Data API; não há evidência de incidente.
- users.id bigint; income, investments, outgoing e credit_cards possuem user_id referenciando users.id. outgoing.credit_card_id e import_jobs.credit_card_id referenciam credit_cards.id; payment_status.outgoing_id referencia outgoing.id. import_jobs usa user_email, sem FK de usuário listada. users.password e import_jobs.file_bytes são sensíveis.
- outgoing já tem transaction_date, start_date, import_hash, duration_in_months, frequency, value numeric e credit_card_id. credit_cards não tem fechamento/vencimento. IDs bigint sem default em várias tabelas: verificar sequências e estratégia Hibernate antes de permitir inserts pelo SDK. Levantar PKs, índices, constraints, funções, triggers e contagens antes de gerar a migração final. CSVs não incluem linhas de dados.

## 14. Backlog obrigatório de migrações para o Codex

1. Registrar no repositório o endurecimento emergencial aplicado no painel, caso exista: habilitar RLS, revogar grants excessivos de anon/authenticated/PUBLIC e revisar privilégios herdados. RLS não protege TRUNCATE. Manter tabelas legadas sensíveis inacessíveis a clientes. Verificar papel utilizado pelo Java antes de mudanças que afetem seu acesso; não assumir que é proprietário ou bypassrls.
2. Proposta de transição: adicionar users.auth_user_id UUID UNIQUE com FK para auth.users(id), inicialmente nullable; vincular contas existentes por procedimento administrativo validado, sem confiar em email fornecido pelo cliente. Preservar bigint e dados. Bloquear acesso direto a users.password e impedir clientes de editar o vínculo; usar tabela de mapeamento privada ou função restrita se necessário. Nunca retornar hashes de senha aos clientes. Planejar remoção posterior da credencial antiga após backup e corte.
3. RLS definitiva para CRUD financeiro: ownership via vínculo autenticado, USING e WITH CHECK; validar que cartão e despesa associados pertencem ao mesmo usuário e que payment_status pertence à despesa do usuário. Conceder somente privilégios necessários a authenticated; nenhum acesso anônimo aos dados financeiros. Revisar funções SECURITY DEFINER, search_path, grants EXECUTE e views; testar com duas contas e sem sessão, não apenas administrador.
4. Criar notification_events e credit_card_statements; card_aliases permanece proposta opcional para cartões tokenizados. Adaptar credit_cards com fechamento/vencimento e outgoing com origem, revisão e dados temporais necessários. Manter import_hash legado sem presumir equivalência com deduplicação de notificações. Criar chaves idempotentes, integridade de ownership, restrições por ciclo de fatura e operações transacionais; não impor unicidade por valor/horário/loja de uma compra.
5. Migrar cálculos financeiros para SQL/RPC/views e TypeScript compartilhado; preservar semântica das parcelas e pagamentos, resolver geração de IDs, timestamps e defaults antes de inserts diretos; testar paridade com Java. Não excluir import_jobs, flyway_schema_history ou credenciais antigas nesta etapa.

## 15. Sequência operacional e pendências

Primeiro confirmar se Java/AWS ainda está ativo e qual papel utiliza. Se nenhum consumidor precisar da Data API, considerar desabilitá-la temporariamente pelo painel como contenção; verificar configuração e dependências. Proteger o acesso público prontamente e documentar a alteração. Backup seguro e validação de restauração antes de migrações estruturais. Depois preparar migrações no Codex, configurar Auth pelo painel, criar conta pessoal e vincular dados na ordem prescrita pelo script revisado; testar e liberar a Data API somente com grants/RLS verificados. Restringir cadastro público se o uso permanecer pessoal. Desativar infraestrutura antiga somente após testes e corte validado.

Nenhuma mudança no Supabase foi executada nesta revisão. Estado do Java, papel de conexão, backup, configuração efetiva da Data API, grants completos e conteúdo real das tabelas ainda não foram verificados. A escolha de mecanismo de migração, vínculo UUID e nomes das novas tabelas são propostas técnicas a validar no repositório; custo zero continua meta, não garantia.
