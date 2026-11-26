# Domus v2.1 — backup do planejamento e decisões

**Atualizado em 26 de novembro de 2026**

Este documento reúne o contexto e as decisões conversadas sobre o Motor de Inteligência Financeira. Serve como cópia de referência para guardar fora do repositório e retomar o trabalho depois. Não contém senhas nem credenciais. É um backup do planejamento, não um backup do código-fonte nem dos dados do Supabase.

## 1. Visão do projeto

O Domus é um aplicativo de controle financeiro pessoal. A versão 2.1 usa Supabase para autenticação e dados, com Android em Expo/React Native e desktop em Electron/Ubuntu. A versão web em localhost serve para testes rápidos. A meta é manter baixo custo, sem novos servidores ou serviços pagos; gratuidade permanente não é garantida.

O Motor de Inteligência Financeira ampliará o Domus para ajudar a entender a situação financeira, acompanhar o fluxo de caixa, projetar receitas e despesas e simular decisões de compra. Diagnóstico, projeção e avaliação de compra devem ser apresentados separadamente. Nenhuma simulação deve criar uma despesa automaticamente.

## 2. Estado informado do projeto

Segundo o histórico entregue pelo usuário, as fases 0 a 4 da migração Supabase foram realizadas: captura Android de notificações, autenticação e segurança, CRUD financeiro, sincronização e revisão de capturas, filtros e conferência de faturas. O uso cotidiano continuará revelando ajustes necessários. A infraestrutura AWS antiga está desligada e a importação de extratos ficou no backlog.

O projeto Supabase existente é `svxdmuthiycwgqgxpwyn`. O cadastro público e o login anônimo foram informados como desativados. Os dados financeiros antigos foram apagados uma vez com aprovação do usuário; **não repetir a limpeza e não apagar os dados novos**.

A correção da prévia de faturas foi registrada na migração `20261125120000_v2_fix_card_statement_items_ambiguity.sql`, aplicada ao projeto remoto e verificada com uma fatura sem itens. Esse teste não comprova todos os casos de parcelamento e fechamento.

A fase A do planejamento do motor foi concluída funcionalmente: as principais escolhas e um exemplo de fluxo de caixa foram discutidos. Detalhes técnicos e exemplos adicionais serão tratados nas fases pertinentes. O motor, as contas financeiras com saldos e as novas projeções descritas neste documento **ainda não foram implementados**.

## 3. Princípios e limites

- Priorizar Android e Electron/Ubuntu; manter a web útil para testes quando possível.
- Utilizar Supabase, TypeScript e os aplicativos existentes, sem exigir servidor adicional ou serviço pago.
- Nunca colocar segredos, senhas ou credenciais administrativas no código, neste documento ou nos aplicativos.
- Alterações no banco devem ser migrações SQL versionadas no Git, com RLS, permissões mínimas e testes apropriados. Aplicação remota exige autorização específica; não fazer operação destrutiva sem aprovação explícita.
- Preservar compras e dados já cadastrados. Não inventar saldo inicial, histórico, recebimento ou pagamento.
- Estratégias personalizadas de recomendação permanecem no backlog. Importador de extratos, integração bancária, IA generativa e alertas externos também não são requisitos atuais.
- O layout pode mudar para acomodar o módulo; indicadores adicionais podem ser incluídos abaixo do dashboard principal.

## 4. Contas e visão do casal

Inicialmente haverá duas contas financeiras: uma do usuário e uma da esposa. Somente o usuário utilizará o aplicativo. O Domus deve mostrar informações e saldo de cada conta, além de uma visão conjunta do casal. Essa escolha não exige criar duas contas de autenticação.

O usuário informará os saldos de abertura. Quando o saldo do Domus não corresponder ao do banco, será possível registrar um ajuste, preservando o histórico. Transferências entre as duas contas ficam fora do escopo inicial; quando ocorrerem fora do app, o usuário ajustará os saldos manualmente.

## 5. Fluxo de caixa

O objetivo é saber quanto dinheiro há agora e quanto deverá restar depois dos compromissos futuros. O app deverá mostrar, por conta e para o casal:

1. **Saldo atual:** considera pagamentos e recebimentos efetivamente confirmados.
2. **Saldo após despesas futuras:** parte do saldo atual e mostra o efeito dos compromissos selecionados, principalmente faturas de cartão, identificando o período considerado.
3. **Projeção por data:** considera entradas e saídas previstas, deixando claro quais receitas ainda não foram recebidas e quais pagamentos ainda não foram feitos.

Pix, débito, boleto e pagamentos semelhantes reduzem o saldo quando são efetivamente pagos. Pix e débito pagos no momento do cadastro devem refletir no saldo imediatamente. Uma despesa futura permanece prevista até o pagamento ser confirmado.

Uma compra no cartão aparece como consumo e obrigação da fatura, mas não reduz imediatamente o saldo bancário. O saldo diminui quando o pagamento da fatura é registrado. O vencimento é uma data prevista e não comprova pagamento. Uma compra não deve ser descontada duas vezes ao pagar a fatura.

### Exemplo aprovado

| Momento | Evento | Saldo |
|---|---|---:|
| Início | Saldo inicial | R$ 1.000 |
| Dia 5 | Pix pago de R$ 100 | R$ 900 |
| Dia 8 | Compra no cartão de R$ 1.200 em 6 parcelas | R$ 900 |
| Dia 9 | Salário de R$ 2.000 previsto, ainda sem confirmação | R$ 900 |
| Dia 10 | Recebimento do salário confirmado | R$ 2.900 |
| Dia 14 | Pagamento de R$ 150 de uma fatura de R$ 200 | R$ 2.750 |

Após o pagamento parcial, restam R$ 50 pendentes nessa fatura. As demais parcelas ficam previstas nas faturas correspondentes. As datas são apenas ilustrativas: o usuário informou que recebe antes do dia 10 e não definiu uma data fixa neste planejamento.

## 6. Receitas e pagamentos

- Salário e outras receitas recorrentes continuam previstos até serem encerrados pelo usuário. O recebimento só aumenta o saldo quando confirmado.
- Quando o valor variar em um mês, deve ser possível ajustar aquele mês sem mudar os demais. Permitir recebimentos em partes.
- Despesas recorrentes também continuam até serem encerradas. Por enquanto, manter frequências única, mensal e anual.
- Ao cadastrar uma despesa futura, escolher a conta prevista e permitir trocá-la na hora do pagamento.
- Permitir pagamento parcial de faturas e de outras despesas. O valor pago afeta o saldo na data efetiva e o restante continua pendente.
- Pagamentos previstos para um vencimento podem ser antecipados ou atrasados; após confirmação, o fluxo usa a data real.

## 7. Compras parceladas e cartão

Uma compra parcelada poderá ser cadastrada pelo **valor total** ou pelo **valor de cada parcela**, à escolha do usuário. O Domus mostrará o total da compra e seu impacto mensal. Se o total não dividir igualmente em centavos, o ajuste das parcelas deve preservar a soma exata.

Exemplo: uma compra de R$ 1.200 em 6 parcelas de R$ 200 aparece com R$ 200 nos meses aplicáveis no fluxo e no gráfico. Nos detalhes, o total de R$ 1.200 ficará em destaque e “6 × R$ 200” também será visível. Identificar o total da compra separadamente do total da fatura, que pode incluir outras compras.

As compras parceladas já cadastradas devem ser preservadas e apresentadas para o usuário conferir; seus valores não devem ser alterados automaticamente antes da revisão.

Na revisão de compras capturadas por notificação com valor **acima de R$ 100**, o app deve perguntar se foram parceladas e, em caso positivo, solicitar a quantidade. Para valores de até R$ 100, manter a possibilidade de editar o parcelamento manualmente.

Para os bancos usados pelo usuário, uma compra feita **no dia do fechamento** vai para a fatura que fecha no mês seguinte. Exemplo: cartão que fecha dia 7; compra no dia 7 entra na fatura que fecha no mês seguinte. A regra atual do sistema inclui o dia de fechamento no ciclo que está fechando: essa diferença precisa ser revisada e testada antes de qualquer alteração. O mês de fechamento e o mês de vencimento não devem ser confundidos.

## 8. Investimentos, reserva e metas

Investimentos devem permitir registrar aportes e resgates, com a conta de origem ou destino. O usuário poderá atualizar o valor manualmente e, opcionalmente, informar uma taxa anual estimada. Proposta: usar o último valor e sua data como ponto de partida da estimativa futura; identificar claramente que rendimento estimado não é saldo confirmado.

A proposta técnica de taxa efetiva anual e a compatibilidade com a taxa já usada pelo sistema ainda precisam de análise antes da implementação. Não reinterpretar dados legados automaticamente.

O app permitirá identificar dinheiro ou investimentos elegíveis como reserva de emergência. A reserva fica protegida por padrão, e o usuário informa no aplicativo quando decidir usá-la. Uma meta pode ou não ter dinheiro separado, conforme escolha do usuário; recursos reservados não devem ser contados duas vezes.

Será possível definir uma margem mínima mensal, em reais ou percentual, e um aporte mensal desejado. O Domus deve alertar quando o aporte não couber. Com informações insuficientes, mostrar uma análise parcial e o que falta, sem afirmar que a compra é segura.

## 9. Diagnóstico técnico e cuidados

A revisão do repositório encontrou receitas, despesas, investimentos, cartões, estados mensais e conferência de faturas. Não encontrou, nas migrações e serviços examinados, um modelo próprio para contas com saldo efetivo, recebimentos, movimentações, metas e intenções; isso não comprova o schema remoto completo.

Há pontos a verificar com testes antes de apoiar decisões financeiras nas projeções atuais:

- Algumas funções tratam despesas como ocorrências mensais sem aplicar todas as frequências presentes na interface.
- As projeções anual e diária usam regras diferentes; o resumo usa um acumulado chamado patrimônio, que não comprova patrimônio real.
- A prévia de fatura pode repetir a mesma data de compra para despesas com `purchase_at` e duração maior que um mês. É um risco identificado na leitura e precisa ser confirmado por testes.
- O ciclo atual do cartão conflita com a regra acordada para compras no dia do fechamento.
- Clientes atuais convertem valores para `Number`; o motor precisará de transporte e cálculo monetário que preservem centavos.

Uma biblioteca TypeScript compartilhada entre Android e desktop parece viável. Antes de adotá-la, testar integração com Expo/Metro, Vite e empacotamento Electron. As regras de dados e compromissos deverão ter fonte canônica; simulações serão determinísticas, locais e sem gravação de despesas.

## 10. Fases propostas

| Fase | Entrega | Situação |
|---|---|---|
| A | Contratos funcionais, decisões e exemplo de referência | Concluída como planejamento funcional |
| B | Validar e corrigir divergências comprovadas no núcleo existente | Aguardando aprovação para iniciar |
| C | Contas e saldo de abertura, com segurança e telas mínimas | Planejada |
| D | Recebimentos e pagamentos efetivos, incluindo parciais e faturas | Planejada |
| E | Snapshot financeiro e biblioteca TypeScript compartilhada | Planejada |
| F | Diagnóstico e projeção de caixa, com incertezas | Planejada |
| G | Margem, reserva, aportes e metas | Planejada |
| H | Simulador de compra e comparação de cenários | Planejada |
| I | Classificação e explicações; pontuação somente após validação | Planejada |
| J | Intenções de compra e evolução dos insights | Planejada |

A ordem pode ser refinada conforme os resultados; nenhuma fase está autorizada a iniciar automaticamente. Transferências entre contas não integram o escopo inicial, mesmo que algum planejamento anterior tenha considerado essa possibilidade. Estratégias personalizadas continuam no backlog.

## 11. Pontos a detalhar nas próximas fases

- Confirmar a interpretação dos registros parcelados antigos com o usuário, sem alterações automáticas.
- Testar exemplos adicionais de recebimentos parciais, datas diferentes, duas contas e faturas com mais de uma compra.
- Definir o tratamento de dias não úteis, primeira parcela, vencimento e limite do cartão quando as informações forem conhecidas.
- Definir precisão, arredondamento e compatibilidade da taxa anual de investimento com os dados legados.
- Definir horizonte e sinalização de informações desatualizadas. Uma ausência de dados críticos não deve resultar em aprovação definitiva.
- Revisar os critérios e pesos antes de criar qualquer pontuação de recomendação. Uma pontuação não deve superar uma restrição financeira comprovada.

## 12. Documentos de referência no repositório

- `docs/Domus_v2.1.md`: arquitetura e planejamento geral.
- `docs/Domus_Motor_Inteligencia_Financeira.md`: especificação proposta do novo módulo.
- `docs/Domus_Plano_Motor_Inteligencia.md`: auditoria e plano incremental; algumas perguntas antigas foram respondidas posteriormente.
- `docs/Domus_Fase_A_Decisoes.md`: registro de decisões da fase A.

Quando um planejamento mais antigo divergir de uma decisão posterior registrada aqui, seguir a decisão posterior e revisar o documento anterior na fase adequada. Guardar também backups separados do repositório e dos dados, pois este arquivo contém apenas o planejamento.
