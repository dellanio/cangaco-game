# D-PRODUCAO-01b — Insumo escasso dividido entre fundição e ferrarias: plano

Segunda metade da D-PRODUCAO-01 (plano-mãe:
`2026-09-29-D-PRODUCAO-01-ferro-e-ferrarias.md`). O desenho foi fechado antes do código,
nesta ordem: causa lida no código, regra lida no fonte do KaM, desenho e testes.

## O defeito (medido na sonda da 01a)

Uma mina de carvão e três consumidores. Em 12 000 ticks a fundição recebeu 39 carvões, a
ferraria de armas 7 e a de armaduras **0**. Com as gavetas vazias, as três tarefas de
insumo empatam no nível `parada`. `ordenarTarefasDoSerf` (`sim/jobs.ts`) desempata pelo
custo A*, e vence sempre quem está mais perto.

A tarefa aberta não guarda a vez. `abertaVale` cancela a aberta quando a origem esvazia,
e o gerador recria todas na ordem de `predios.ordem`. Por isso a memória tem de estar no
destino.

## O KaM (`KM_HandLogistics.pas`, 731a8a4)

- `TryCalculateBidBasic` :1512-1530. Para a fundição e as casas com `NeedsPlayerOrder`
  (`KM_ResHouses.pas`: ferraria de armas, de armaduras, as duas oficinas e a de cerco),
  com a oferta em até 2 e o destino com até 1 na gaveta, o lance **ignora a distância**:
  `5 + (5 - distr)*4 + KaMRandom(16 - 3*distr)`.
- `TryCalculateBid` :1613-1618 soma 20 por unidade já na gaveta. Esta parte não entra: ela
  vale para toda casa, e mexer nela é o lote de balanceamento.

## Desenho (interpretação conservadora, PARA REVISÃO)

- **Dado** `delivery.divisaoDoEscasso`: `tipos` (iron_smithy, weapon_smithy,
  armor_smithy, weapons_workshop, armory_workshop), `ofertaMaxima` 2 e `gavetaMaxima` 1.
  A regra de dado confere se cada tipo tem receita com entrada e se os limites são
  inteiros ≥ 0.
- **Estado** `PredioCompleto.ultimaEntrega?`: o tick da última entrega de insumo, por
  mercadoria. Só os tipos acima ganham o campo, e só a entrega o escreve (`serfs.ts`).
  Na guarda de opcionais, ele é `persiste`.
- **Ordem**: a tarefa que disputa (insumo, tipo da lista, oferta ≤ 2, gaveta ≤ 1) perde a
  perna de entrega no custo e fica só com a do serf até a origem. O caminho inteiro ainda
  tem de existir. Entre duas que disputam, o desempate é a vez: quem recebeu há mais
  tempo, e quem nunca recebeu vem antes de todos. O `KaMRandom` vira a vez, para a sim
  seguir determinística sem gastar o RNG.
- A distribuição (`distr`) do lance do KaM não entra. Hoje ela é 5 em todos os pares, e o
  termo seria constante.

## Aceite

1. Na cadeia do ferro, pelo `step`, a ferraria de armaduras recebe carvão e faz uma peça
   dentro do teto de 5 000 ticks.
2. Em 6 000 ticks, a razão menor/maior do carvão entre os três fica ≥ 0,22. O modelo
   revogado dá 0 e o novo mediu 0,45; o piso fica na metade do medido (memória "aceite de
   modelo afirma razão").
3. Direto na ordem das tarefas:
   - no escasso, a vez decide e a distância não;
   - com oferta farta, a ordem é a de antes;
   - destino com a gaveta acima do limite sai da disputa.
4. Só quem divide ganha `ultimaEntrega`. O quadro fica sem violação.
5. A regra acusa: desligada, o teste cai.

Sem screenshot: nada muda na tela.
