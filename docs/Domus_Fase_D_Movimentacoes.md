# Domus — fase D: movimentações efetivas

Implementação preparada para revisão; a migração remota ainda depende de autorização específica. A fase preserva as contas, os saldos, os lançamentos e as marcações de pagamento existentes. Não cria movimentos retroativos automaticamente nem transforma a marcação antiga em pagamento com conta.

- Uma movimentação registra conta, data efetiva, valor, competência e receita, despesa ou cartão associado. Recebimentos aumentam o saldo; pagamentos diminuem. Admite entradas e pagamentos em partes.
- Pix ou débito único pode ser cadastrado como já pago: despesa e movimentação são gravadas atomicamente. Se estiver apenas previsto, permanece sem movimentação. A conta prevista é opcional e pode ser escolhida no pagamento.
- Para cartão, registra-se o pagamento da fatura, identificado por cartão e mês de fechamento; compras individuais não geram saída de conta. A conferência continua separada do pagamento. O histórico informa quanto já foi registrado para cada referência e permite estorno sem apagar registros.
- Cada solicitação possui chave para repetição segura em caso de perda de resposta. A interface orienta conferir o histórico se houver falha de conexão. Datas futuras e anteriores ao saldo inicial ou ao último ajuste em dia anterior são recusadas para evitar reintroduzir no saldo valores possivelmente já incluídos. No mesmo dia, o usuário deve registrar somente operações ainda não incluídas no saldo confirmado.
- Uma receita pode ter a previsão alterada apenas em determinada competência, sem mudar os demais meses. Recebimentos parciais não alteram a previsão automaticamente. O ajuste de previsão é registrado em histórico.
- Marcações antigas em Pagamentos não têm conta/data nem alteram saldo. Permanecem visíveis como marcação anterior; pagamentos reais devem ser registrados em Movimentações. Uma despesa com pagamento efetivo ativo não pode ter valor, data ou frequência alterados sem estorno prévio. Receitas ou despesas com histórico financeiro não podem ser excluídas fisicamente.
- Transferências próprias continuam fora do escopo. Projeção futura de caixa continua nas fases seguintes; o saldo da fase D contempla apenas movimentações efetivas registradas.

A migração `20261127110000_v2_cash_movements.sql` adiciona tabelas, funções, RLS e validações; não modifica dados financeiros existentes ao ser aplicada. Os testes isolados usam dados fictícios e não substituem a validação funcional em web, Android e Electron nem uma verificação de RLS no ambiente Supabase completo.
