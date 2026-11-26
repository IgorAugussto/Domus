# Domus v2.1 — fase A: decisões e questões em aberto

Documento de trabalho para retomar a conversa. Registra as respostas do usuário; não aprova implementação nem alteração do banco. Complementa `Domus_Plano_Motor_Inteligencia.md` e a especificação do motor.

## Decisões registradas

- Uma compra parcelada pode ser cadastrada pelo valor total ou pelo valor de cada parcela, à escolha do usuário. Mostrar o valor total e quanto compromete a receita por mês. Ao informar o total, dividir entre as parcelas com ajuste determinístico dos centavos para que a soma corresponda ao total; ao informar a parcela, calcular o total a partir do valor e da quantidade.
- Apresentação desejada: compra de R$ 1.200 em 6 parcelas de R$ 200 mostra R$ 200 em cada mês aplicável no fluxo e gráfico; nos detalhes da compra/fatura, destacar R$ 1.200 como total da compra e R$ 200 por mês de forma visível. Distinguir total da compra do total da fatura, que pode incluir outras compras.
- Compras parceladas já cadastradas serão preservadas e apresentadas para conferência do total e das parcelas na implementação futura; não alterar seus valores automaticamente antes da revisão do usuário.
- Na revisão de compra capturada por notificação com valor **acima de R$ 100**, perguntar se foi parcelada; se sim, solicitar a quantidade de parcelas. Para valores iguais ou inferiores a R$ 100, permitir editar o parcelamento manualmente, mesmo sem pergunta automática.
- Receitas e despesas recorrentes continuam até o usuário encerrá-las. Além de lançamentos únicos e mensais, manter frequência anual por enquanto.
- Compra feita no dia de fechamento do cartão deve ir para a fatura seguinte: cartão que fecha dia 7, compra no dia 7 entra na fatura que fecha no mês seguinte. Revisar a compatibilidade com o ciclo já implementado antes de alterá-lo.
- O app terá duas contas financeiras inicialmente: uma do usuário e outra da esposa. Somente o usuário opera o app; a interface deve mostrar dados por conta e uma visão conjunta do casal. Isso não define, por si só, novas contas de autenticação.
- Uma receita como salário é prevista nos meses seguintes até encerramento. O usuário recebe antes do dia 10; a data exata prevista deve ser informada sem pressupor um dia fixo. A previsão não aumenta o saldo até o usuário confirmar o recebimento. Deve ser possível ajustar o valor somente no mês em que variou, sem alterar a série inteira, e registrar recebimentos em partes.
- Ao cadastrar despesa futura, escolher a conta prevista e poder alterá-la no pagamento. Permitir pagamentos parciais de faturas e outras despesas, e recebimentos em partes. Um pagamento fica previsto no vencimento até confirmação, quando se registra a data efetiva; pagamentos parciais reduzem o saldo e mantêm o restante pendente. Transferências entre contas ficam fora do escopo inicial; o usuário ajustará saldos manualmente quando necessário.
- Permitir ajuste de saldo quando divergir do banco, preservando histórico do ajuste.
- Investimentos devem permitir registrar aportes e resgates, escolhendo a conta de origem ou destino. Oferecer atualização manual do valor e taxa anual estimada opcional. Proposta para revisão: taxa efetiva anual, conversão mensal `(1 + taxa anual)^(1/12) - 1` e nova projeção a partir do último valor e data informados; valores anteriores e ajustes permanecem auditáveis. A projeção não é saldo confirmado e não cria rendimento ou movimentação efetiva automaticamente; aportes e resgates posteriores alteram a base na data correspondente. A taxa legada `expected_return` usa outra convenção na projeção atual: não reinterpretá-la sem revisão e decisão explícita. Recursos elegíveis podem ser identificados como reserva de emergência; ela é protegida por padrão e o usuário indicará no app quando decidir utilizá-la.
- Metas financeiras podem ter recursos separados ou não, conforme escolha do usuário. A margem mínima mensal pode ser definida em reais ou percentual, escolhido ao configurar a meta. Permitir definir aporte mensal desejado e alertar quando não couber.
- O layout pode mudar; informações adicionais podem aparecer abaixo do dashboard principal.
- Com dados insuficientes, mostrar análise parcial e informações faltantes, sem afirmar que a compra é segura.

## Fluxo de caixa — ponto prioritário para discussão

O usuário quer saber quanto ainda possui após cada movimentação. Exemplo: ele e a esposa recebem no dia 10; Pix e compras no débito devem refletir no saldo da conta quando o dinheiro sai. Compras no crédito geram obrigação da fatura, cujo impacto no caixa ocorre no pagamento, na data efetiva; o vencimento é a data prevista e pode ser diferente da data de pagamento. Mostrar impacto previsto por vencimento sem descontá-lo duas vezes quando for pago. A compra no crédito continua aparecendo como consumo/compromisso, separadamente do saldo disponível.

Correção posterior: o usuário informou que recebe antes do dia 10; o dia 10 era apenas exemplo, não uma data fixa. Pix e débito pagos no momento do cadastro reduzem imediatamente o saldo da conta; despesas futuras ficam previstas até o pagamento ser confirmado. Receitas previstas aguardam confirmação para entrar no saldo efetivo.

O usuário confirmou o exemplo de fluxo e quer visualizar tanto o saldo atual efetivo quanto o saldo projetado com as despesas futuras, especialmente faturas de cartão. Mostrar por conta e para o casal, explicitando período/data, receitas previstas incluídas ou não e incertezas. Uma visão de saldo após compromissos futuros deve indicar claramente se considera apenas o saldo atual menos despesas ou também receitas futuras, para evitar confundir dinheiro atual com previsão. Pix, débito, boleto e outros pagamentos reduzem o saldo quando efetivamente pagos; a data de vencimento por si só não confirma pagamento. Cartão reduz o saldo na liquidação da fatura, uma vez por pagamento, sem somar novamente as compras como saída de caixa.

Exemplo validado pelo usuário: saldo inicial R$ 1.000; Pix de R$ 100 deixa R$ 900; compra no cartão de R$ 1.200 em 6 vezes mantém R$ 900 e cria obrigações futuras; salário previsto de R$ 2.000 não muda o saldo até confirmação, quando passa a R$ 2.900; pagamento de R$ 150 de fatura de R$ 200 deixa saldo de R$ 2.750 e R$ 50 pendentes. As demais parcelas permanecem previstas nos respectivos ciclos.

O guia deverá separar saldo registrado atual, movimentações efetivas e projeção futura por data, por conta e para o casal. Confirmar como tratar pagamentos antecipados, atrasados, parciais, limites e ausência de informações; não presumir saldo ou recebimento efetivo apenas porque existe uma previsão. Reserva protegida e recursos alocados não podem ser contados duas vezes como disponíveis. Transferência entre contas permanece fora do escopo inicial; discutir como refletir no saldo eventuais movimentações que o usuário fizer fora do app.

## Perguntas pendentes para retomar

1. Fluxo de caixa: detalhar exemplos adicionais de recebimentos em partes e saldos por conta durante o desenho da implementação.
2. Investimentos: validar a proposta de taxa efetiva anual e definir arredondamento e tratamento da taxa legada antes de implementá-la.

As demais decisões sobre critérios, metas, limites, juros e exemplos devem ser discutidas antes da fase afetada. Estratégias personalizadas continuam no backlog.
