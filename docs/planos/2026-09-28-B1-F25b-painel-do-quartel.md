# Plano — F25b, o painel do quartel

Pedido do operador (2026-09-28): *"faz o F25b, o painel do quartel"*. O escopo do
BUILD_PLAN é uma linha só: *"Recrutas dentro, requisitos na gaveta, um botão por tipo que
manda `TrainSoldier` e desabilita o que não cabe, dizendo o motivo. Screenshot com o
roteiro despausado da §8."* O item diz "Falta escrever" e **não tem aceite**. O aceite
abaixo foi escrito nesta sessão, pela leitura mais conservadora, e está PARA REVISÃO.

## Sim (só seletor, nenhuma regra nova)
- `PainelDoPredio.quartel`: `null` fora do quartel completo. Traz:
  - `recrutas`;
  - `tipos`, na ordem de `units.json: militares.tipos`, cada um com `tipo`,
    `requisitos`, `faltam` (os requisitos sem unidade na gaveta) e `motivo`.
- O `motivo` é o de `motivoDaRecusaDeSoldado`, **a mesma função que o comando usa**. A
  tela não tem uma segunda regra.
- `porta-bloqueada` fica fora do seletor: ela depende de `tileDeSaida`, do sistema. Se
  acontecer, o comando recusa com o motivo. PARA REVISÃO.

## UI
- Uma linha `quartel` com os recrutas (`data-recrutas`).
- Um botão por tipo: o nome vem do tema (`militares.<id>.nome`) e a lista de requisitos
  vem dos nomes de mercadoria. Os `data-` são `tipo` e `motivo`.
- Botão desabilitado diz o motivo:
  - "falta X, Y", listando as mercadorias que faltam;
  - "sem recruta".
- O clique emite `TrainSoldier { predio, tipo }`.

## Aceite (escrito nesta sessão, PARA REVISÃO)
- (a) O seletor devolve os 9 tipos. Com os requisitos do `militia` (1 `hand_axe`) e 1
  recruta, só o `militia` fica sem motivo. Sem recruta, todos dão `sem-recruta`. Os
  `faltam` batem com a gaveta.
- (b) Para todo estado de um conjunto de fixtures, o `motivo` do seletor é igual ao
  motivo com que o `TrainSoldier` daquele tipo é recusado, ou `null` quando ele é aceito.
- (c) Na tela, com o jogo andando: o botão habilitado forma o soldado, os recrutas caem
  de 1 e o soldado aparece; o desabilitado diz o motivo com o texto do tema. Screenshot.
