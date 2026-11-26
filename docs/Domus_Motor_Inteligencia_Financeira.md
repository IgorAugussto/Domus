# Domus — Motor de Inteligência Financeira

**Especificação funcional e técnica proposta | v1.0 | 25/11/2026**

Complemento de `Domus_v2.1.md`. Não representa código implementado. Destinado ao Codex para análise, planejamento e implementação incremental mediante aprovação.

## 1. Objetivo e escopo

Transformar o Domus em ferramenta de apoio à decisão: entender o presente, projetar o futuro e avaliar compras antes de assumir compromissos. Manter três dimensões separadas: diagnóstico financeiro, projeção e recomendação de uma decisão específica. Uma boa compra não implica boa saúde financeira geral.

Inclui análise de receitas, despesas, parcelas, investimentos, liquidez, metas, simulação à vista e parcelada, comparação de datas e cartões, recomendações explicáveis e lista de intenções de compra. Perfis de estratégia (conservador, equilibrado, urgente, menor custo etc.) ficam no backlog por decisão do usuário. Não usar IA generativa, integração bancária ou serviços pagos como dependência.

## 2. Arquitetura e tecnologias

| Tecnologia | Responsabilidade |
|---|---|
| Supabase Auth + supabase-js | Sessão autenticada e acesso aos dados |
| PostgreSQL, SQL, views e RPC | Integridade, ownership, recorrências, parcelas, ciclos e snapshot financeiro consistente |
| TypeScript puro | Motor determinístico compartilhado de projeção, simulação, classificação e explicação |
| Expo / React Native | Interface Android |
| Electron / React | Interface desktop Ubuntu |
| Kotlin | Captura de notificações já prevista na v2.1; não participa da recomendação |
| Zod (proposto) | Validação dos contratos de entrada e saída |
| decimal.js (proposto) | Aritmética decimal de juros e cálculos financeiros; valores monetários persistidos em numeric e transportados sem perda de precisão |
| Vitest (proposto) | Testes unitários e de integração do motor |
| Supabase CLI, Docker e pgTAP (propostos) | Banco local, migrações e testes SQL/RLS |

Reutilizar dependências equivalentes existentes após auditoria. Não impor monorepo ou trocar gerenciador de pacotes sem necessidade. Meta de custo recorrente R$ 0, sujeita aos limites do plano Supabase e volume de dados.

Fluxo: PostgreSQL/RLS → RPC de snapshot autenticado → motor TypeScript compartilhado → telas Android/Desktop. SQL é fonte canônica dos compromissos e invariantes; TypeScript calcula cenários hipotéticos sem duplicar regras de geração de parcelas. Nenhuma simulação grava despesa ou altera saldo. Cálculos podem ocorrer localmente com snapshot autorizado; se desatualizado, mostrar data e limitar confiança. Não usar service_role nos clientes. Não reintroduzir Java, Python, RabbitMQ ou EC2.

Estrutura lógica sugerida (adaptar ao repositório):

```text
packages/financial-engine/src/
  contracts.ts
  money.ts
  diagnostics.ts
  forecast.ts
  scenarios.ts
  constraints.ts
  ranking.ts
  explanations.ts
  index.ts
  tests/
supabase/migrations/
supabase/tests/
```

## 3. Auditoria e dados necessários

A v2.1 preserva income, outgoing, investments, payment_status e credit_cards, prevê credit_card_statements e captura de notificações. Não comprova a existência de contas bancárias, saldo inicial, recebimento efetivo de receitas, limite atualizado ou metas. Antes de criar tabelas, inspecionar entidades, migrations, serviços Java legados e clientes. Validar significado de value, duration_in_months, frequency, start_date, transaction_date, status mensal, aportes e juros. Não assumir que valor é parcela ou total sem verificar.

Modelo complementar candidato, não DDL aprovado:

| Conceito | Dados mínimos |
|---|---|
| financial_accounts | proprietário, nome, tipo, moeda, saldo inicial e data de referência |
| account_movements | conta, valor, data efetiva, origem/vínculo, tipo, transferência correlacionada |
| income_receipts | vínculo à receita/competência, valor efetivamente recebido, data, conta |
| financial_preferences | margem mínima, aporte desejado, reserva-alvo em meses, horizonte |
| financial_goals | valor-alvo, prazo, prioridade, recursos destinados |
| purchase_intents | descrição, preço, prioridade, prazo, condições de pagamento, estado |
| card limit snapshot | limite disponível informado, data da atualização, cartão |

Adaptar entidades existentes em vez de duplicá-las. Registrar saldo de abertura informado pelo usuário, não inventar histórico. Separar saldo contábil registrado de saldo confirmado pelo banco; sem integração bancária, saldo depende de registros e conferência manual. Permitir ajustes auditáveis. Transferências entre contas próprias não são receita/despesa; aportes são saída de caixa e movimentação patrimonial, não consumo; resgates não são salário. Pagamento de fatura é liquidação de obrigação, não segunda despesa. Separar competência, vencimento e pagamento efetivo. Não contar reserva/investimentos ilíquidos como caixa livre. Não considerar crédito como renda.

Toda mudança de schema deve ser versionada, com RLS, grants mínimos, ownership de relacionamentos, constraints e testes com duas contas e sem sessão. Respeitar baseline Flyway e mecanismo único de migração. Não aplicar mudanças remotas ou destrutivas sem aprovação. O usuário já dispensou backup dos dados financeiros antigos e desligou AWS; isso não autoriza apagar dados novos nem executar DDL indiscriminadamente.

## 4. Diagnóstico financeiro

Exibir separadamente: renda prevista e recebida; despesas por categoria e competência; obrigações a vencer; comprometimento da renda; sobra orçamentária; caixa registrado; patrimônio líquido (ativos menos passivos quando conhecidos); capacidade de poupança; evolução de consumo; reserva de emergência em meses; previsão de faturas e parcelas restantes.

Fórmulas: comprometimento = despesas/receita prevista × 100; sobra = receita prevista − despesas previstas; cobertura de reserva = reserva líquida elegível / média mensal de despesas essenciais. Renda zero ou denominador desconhecido implica indicador indisponível, não zero. Diferenciar despesa realizada, prevista e estimada. Não criar score global de saúde financeira nesta fase. Comparar categorias em períodos equivalentes, sem misturar mês parcial com mês completo.

## 5. Projeção financeira

Horizonte inicial sugerido de 12 meses, estendido até a última parcela e demais compromissos relevantes. Gerar snapshot com data de referência, moeda BRL, timezone do usuário (inicialmente America/Sao_Paulo), receitas e despesas por data, faturas, saldos, metas, preferências e qualidade dos dados.

Para cada mês m:

- R[m] = receitas previstas.
- D[m] = despesas previstas (fixas, recorrentes, parcelas, variáveis estimadas, tarifas e juros; sem duplicar faturas).
- S[m] = R[m] − D[m].
- P[m] = aportes planejados não incluídos em D[m].
- M[m] = margem de segurança definida pelo usuário.
- H[m] = S[m] − P[m] − M[m] (folga acima da política financeira).
- Caixa final = caixa inicial + entradas efetivas/previstas − saídas efetivas/previstas, usando datas de liquidação; transportar saldo para o período seguinte. Verificar também o menor caixa intramês, pois sobra mensal positiva não garante dinheiro no vencimento.

Despesas variáveis: proposta inicial de média dos últimos três meses completos, excluindo itens já projetados e eventos extraordinários identificados. Se histórico insuficiente, permitir orçamento manual e sinalizar baixa confiança; nunca presumir zero. Mostrar cenário base e cenário de estresse (ex.: aumento configurável das despesas variáveis ou queda da renda); percentuais são hipóteses, não probabilidades. Receitas incertas, notificações não revisadas e faturas divergentes devem aparecer como fontes de incerteza. Recalcular após alterações de dados.

## 6. Política financeira pessoal

Configurar margem mínima em reais ou percentual da renda (uma modalidade por vez), aporte mensal desejado, meses de reserva de emergência e metas com prazos. Não impor percentuais universais. Reserva-alvo = despesas essenciais mensais × meses desejados. Distinguir saldo reservado, saldo livre e recursos já comprometidos com metas. Se a reserva estiver abaixo da meta, mostrar déficit de reserva; não classificar automaticamente toda compra como impossível. Definir com usuário se cada objetivo é obrigatório ou flexível; até definição, mostrar violações explicitamente e não emitir aprovação irrestrita.

## 7. Simulador de intenção de compra

Entradas: descrição, valor à vista, preço total parcelado ou taxa/condições reais, número de parcelas oferecidas, data pretendida, cartão/conta, entrada, prioridade e prazo máximo de espera. Não inventar descontos, taxas, parcelamentos ou limite. Cenários futuros usam condições atuais como hipótese e devem ser reconfirmados.

Gerar alternativas: à vista agora, parcelado agora, à vista ou parcelado em meses futuros até horizonte configurado, e não comprar. Para parcelas sem juros dividir total em centavos e distribuir resíduo deterministamente. Com juros usar total informado ou fórmula compatível com oferta (por exemplo Price: prestação = principal × i / (1 − (1+i)^(-n)), se aplicável); incluir tarifas e entrada, mostrar custo total. Respeitar fechamento/vencimento real e regra de limite do emissor, inclusive comprometimento do valor integral quando aplicável. Se limite desconhecido, indicar verificação necessária. Não supor que data da compra é data da primeira parcela.

Para cada cenário, aplicar eventos hipotéticos ao snapshot e recalcular toda a duração da obrigação. Comparar cenário sem compra e com compra: parcela, custo total, sobra mensal, menor sobra, meses abaixo da margem, déficit, caixa mínimo intramês, reserva, aportes, metas e limite. Não usar dinheiro acumulado implicitamente sem demonstrar sua origem. Separar viabilidade de caixa e sustentabilidade do orçamento.

## 8. Validação e recomendação

Primeiro avaliar restrições, depois classificar. Estados: inviável (restrição comprovada, como limite insuficiente ou caixa negativo sem cobertura); atenção (margem/meta violada, orçamento deficitário coberto por caixa ou cenário de estresse ruim); compatível com política (critérios atendidos e dados suficientes); inconclusivo (dados críticos ausentes). Nunca apresentar cenário inconclusivo como seguro. Mostrar alternativas e causas mesmo quando nenhuma for compatível.

Critérios de pontuação propostos, sujeitos à validação com usuário:

| Critério | Peso |
|---|---:|
| Segurança do orçamento | 30% |
| Preservação da reserva | 25% |
| Manutenção de aportes | 20% |
| Custo total | 15% |
| Atendimento à prioridade/prazo | 10% |

Cada componente varia de 0 a 100. Proposta inicial de normalização (clamp limita a 0–1): orçamento = 100 × clamp(menor sobra após aportes / margem desejada), com margem zero tratada por regra explícita (100 se sobra não negativa, 0 caso contrário); reserva = 100 × clamp(menor reserva projetada / reserva-alvo), alvo zero implica não aplicável; aportes = 100 × clamp(aportes preservados / aportes planejados), zero planejado implica não aplicável; custo = 100 × menor custo total entre alternativas de aquisição comparáveis / custo do cenário (preços positivos); prazo = 100 × clamp(1 − espera / tolerância), tolerância zero implica 100 apenas se imediato. Usar tolerância informada, não inferir urgência. Comparar custos para mesma aquisição, não incluir cenário de não compra na normalização. Critério não aplicável pode ter peso redistribuído proporcionalmente e isso deve ser exibido; dado desconhecido não é não aplicável e impede score completo. Score = soma ponderada dos componentes aplicáveis. Não usar score para superar restrições. Classificar por estado primeiro, depois score; desempate proposto: menor custo, menor duração da dívida, menor espera. Mostrar também alternativas não dominadas (trade-offs). Não tratar score como probabilidade nem garantia; pesos e fórmulas são hipóteses a testar. Evitar penalizar duas vezes a mesma meta sem avaliar sensibilidade.

Explicações determinísticas por templates e códigos de motivo (MARGIN_BREACH, CASH_SHORTFALL, LIMIT_INSUFFICIENT, RESERVE_IMPACT, GOAL_DELAY, MISSING_DATA, etc.). Exemplo: “Aguardar março preserva sua margem de R$ 500 durante todo o parcelamento; em fevereiro a sobra cairia para R$ 200.” Toda frase deve derivar de métricas calculadas. Se a projeção base já viola uma meta, distinguir problema preexistente de impacto incremental. Não recomendar crédito mais longo ou com juros automaticamente.

## 9. Exemplo de referência

Compra fictícia de R$ 4.800 sem juros, primeira parcela no mês indicado. Sobras antes da compra, já descontados aportes: dez R$ 900, jan R$ 700, fev R$ 600, mar R$ 1.550, abr R$ 1.800, mai em diante R$ 2.100 (hipótese). Margem mínima R$ 500.

| Cenário | Parcela | Menor sobra durante parcelas | Resultado orçamentário |
|---|---:|---:|---|
| Dezembro, 6x | R$ 800 | −R$ 200 | Déficit mensal em jan/fev |
| Dezembro, 12x | R$ 400 | R$ 200 | Abaixo da margem em jan/fev |
| Março, 6x | R$ 800 | R$ 750 | Preserva margem |
| Março, 12x | R$ 400 | R$ 1.150 | Preserva margem, dívida mais longa |

Março em 6x é alternativa interessante por preservar margem e encerrar dívida antes de 12x. Não é recomendação definitiva sem caixa, limite, reserva, prazo e condições reais; não atribuir pontuação inventada. Compra à vista depende de caixa acumulado e não apenas da sobra de um mês.

## 10. Interface e intenções de compra

Dashboard: indicadores independentes, gráficos de evolução, previsão de faturas e alertas explicáveis. Tela de projeção: receitas/despesas, parcelas, caixa e margem, por mês e detalhe por vencimento. Tela “Posso comprar?”: formulário, comparação lado a lado, gráfico antes/depois, pior mês, custo total, motivos, limitações e data de atualização. Configurações: política financeira. Lista de intenções: salvar, editar, priorizar, arquivar, recalcular quando dados mudarem; não criar despesa automaticamente. Simular intenções isoladas e em conjunto, sem presumir que todas serão compradas. Alertas inicialmente dentro do app, sem serviço de monitoramento contínuo. Interface em português, valores BRL, acessibilidade e paridade Android/Ubuntu.

## 11. Contratos e implementação

Funções puras propostas: `diagnose(snapshot)`, `forecast(snapshot, horizon)`, `generateScenarios(intent, snapshot)`, `simulate(snapshot, scenario)`, `validate(result, policy)`, `rank(results, policy)`, `explain(result)`. Tipos versionados: FinancialSnapshot, FinancialPolicy, PurchaseIntent, PaymentScenario, MonthlyProjection, ScenarioResult, Recommendation. Injetar data de referência; não depender do relógio interno, rede ou UI. Retornar valores exatos, status, métricas, razões, premissas, dados faltantes e versão do motor. Não persistir projeções derivadas inicialmente; salvar intenção e preferências, recalcular. Se histórico de recomendação for necessário depois, registrar snapshot/versionamento minimizado. Usar centavos inteiros seguros ou decimal exato, arredondamento documentado; nunca ponto flutuante binário para somar dinheiro.

## 12. Fases de entrega

1. Auditoria do repositório e proposta de contratos/schema; confirmar regras legadas, dados faltantes e decisões com usuário. Nenhuma alteração nesta etapa.
2. Fundamentos: contas/saldos/recebimentos, preferências, metas e snapshot; migrações locais e RLS. Depende do núcleo financeiro v2.1 validado.
3. Diagnóstico e projeção: cálculos canônicos, estimativas, qualidade de dados, testes e telas.
4. Simulador: cenários, juros, faturas, caixa, restrições e comparação; sem score até validar métricas.
5. Recomendação: normalização, pesos, explicações, testes de sensibilidade e validação com exemplos reais anonimizados ou fictícios.
6. Intenções de compra e insights; paridade Android/Desktop, testes de integração e revisão final.

Planejar contratos desde a migração v2.1, mas não bloquear a PoC de notificações nem antecipar implementação antes da base financeira. Cada fase deve entregar código revisável, testes, instruções de execução, limitações e aprovação antes de alterações remotas.

## 13. Critérios de aceite e testes

- Mesma entrada e versão produzem mesmo resultado nos dois clientes; simulação não altera registros.
- Exemplo da seção 9 reproduz valores exatos; soma das parcelas coincide com total até o centavo.
- Testar renda zero, histórico insuficiente, valores inválidos, mês parcial, ano bissexto, fechamento/vencimento, juros, desconto à vista, estorno, parcelas que atravessam horizonte e despesas recorrentes encerradas.
- Testar saldo inicial, transferência, aporte, resgate, pagamento de fatura sem duplicidade, recebimento atrasado, caixa negativo antes do salário, limite insuficiente, reserva protegida e metas concorrentes.
- Cenários com dados faltantes não recebem aprovação definitiva; projeções exibem premissas e incertezas.
- Cenários inviáveis não vencem por score; pesos e desempates determinísticos; explicações correspondem às métricas; comparar cenários de estresse e sensibilidade.
- RLS impede leitura/mutação cruzada e acesso anônimo, inclusive RPCs; nenhuma credencial administrativa ou dado financeiro em logs.
- Testes unitários, integração SQL/RLS e testes de fluxo nos clientes; fixtures fictícias versionadas.

## 14. Pendências e backlog

Confirmar modelo real de contas e saldos, semântica de parcelas/receitas, política de reserva e aportes, normalização/pesos, horizonte, tratamento de renda variável e condições de cartão. Não assumir que notificações cobrem todas as compras. Estratégias de recomendação personalizadas ficam explicitamente para depois; IA conversacional, integração bancária e alertas externos também não são requisitos desta entrega. Nenhum código ou banco foi alterado por esta especificação.
