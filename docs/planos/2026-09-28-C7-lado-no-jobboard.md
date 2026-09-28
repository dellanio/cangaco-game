# Plano — C7: o lado filtrando o JobBoard (fila do operador, item 7; fecha o BUG-N1)

> **Registro honesto:** este arquivo foi escrito DURANTE a execução, não antes, contra a
> regra do operador ("salve o plano antes de executar"). O plano estava só na conversa.

Pedido: *"O lado filtrando o JobBoard. Conserte agora, antes de o inimigo ter economia.
Contrato herdado que quebra depois é o pior tipo."* Adiantado na fila porque é o conserto
do BUG-N1 do avaliador: o recruta do jogador se alistava no quartel inimigo.

## Dois níveis
1. **Claim (`reclamar`, `src/sim/jobs.ts`):** todo prédio que a tarefa toca (`origem`,
   `destino`) tem de ser do lado da unidade, senão `unidade-invalida`. Toda atribuição passa
   por `reclamar` (conferido), então isso cobre serf, laborer, recruta, especialista e quem
   vai comer.
2. **Geração e escolha de armazém:** `armazensCompletos(state, lado?)` filtra por lado, e
   quem escolhe passa o lado:
   - a origem do insumo (`origemMaisPerto`) usa o lado do destino;
   - a sobra (`destinoMaisPerto`) usa o lado da origem;
   - a ligação por rua (`predioLigadoAoArmazem`) usa o lado do prédio;
   - a devolução da demolição usa o lado do prédio;
   - a carga do serf (`armazemMaisProximo`, com o parâmetro `lado` novo) usa o lado de
     quem carrega;
   - o armazém-alvo do `devolvendo` passa a exigir o mesmo lado.
   - Sem isso o gerador criaria a tarefa "armazém do jogador → quartel inimigo", que
     ninguém pode reclamar e que fica aberta para sempre.

## Fora (PARA REVISÃO)
- **Tarefa de tile sem prédio** (assentar estrada, arar): estrada e campo não têm lado no
  estado. Só o jogador planeja estrada e campo hoje.
- **A medida global da prévia de estrada** (`pedraDisponivel`) segue somando todos os
  armazéns.
- **Tarefa entre lados diferentes vinda de save antigo:** não é saneada. Hoje não há como
  nascer uma.

## Aceite
- (a) O caso do avaliador: o quartel inimigo ligado à vila fica com 0 recrutas e 0 armas;
  o mesmo quartel do jogador recebe.
- (b) A obra inimiga fica com hp 0; a do jogador é martelada.
- (c) A todo tick: nenhuma reclamada toca prédio de outro lado, e nenhuma tarefa, nem
  aberta, liga origem e destino de lados diferentes.
- (d) A carga volta ao armazém do lado de quem carrega, mesmo com o de outro lado mais
  perto.
- (e) Determinismo.
