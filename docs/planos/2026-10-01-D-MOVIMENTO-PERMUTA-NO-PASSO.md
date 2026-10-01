# Plano: D-MOVIMENTO-PERMUTA-NO-PASSO — a permuta de frente não adianta o caminho

Pedido do operador (2026-10-01): o "bug 5" da lista de pendências, a permuta da D-MOVIMENTO-01
(colisão civil). **Só plano. Nenhum código.** O id é novo, pelo conteúdo, e o `git grep` na `main`
não o achou.

## 0. Contexto

- A colisão civil **fechou desligada em definitivo** (`data/units.json`
  `movimento.colisaoCivil.ligada: false`; GDD §6.4; PROGRESS de 2026-09-29, "D-MOVIMENTO-01 encerrado").
- O mecanismo ficou no código, desligado e coberto por 31 testes (`src/sim/colisao.ts`,
  `tests/D-MOVIMENTO-01a-colisao-civil.test.ts`).
- O defeito existe **só com a chave ligada**. Com ela desligada, `sistemaDaPermuta` sai na primeira
  linha (`src/sim/colisao.ts:276`), e o jogo não o vê.
- **Consequência:** consertar não muda a partida de hoje. O conserto só importa se a colisão voltar
  um dia. A primeira pergunta ao operador (§6) é se vale consertar ou se o mecanismo sai.

## 1. O defeito (registrado)

`BUILD_PLAN.md:6316-6321`, medido em 2026-09-29:
- duas unidades de frente, em 20 tiles, chegam em **95 ticks, contra 100** sem colisão;
- sozinha, ou em fila, a unidade faz 100 nos dois modos, então o movimento normal está certo.

**Ressalva:** a sonda que mediu isso foi apagada, e não há teste permanente com esse número. A
Tarefa 1 do §5 refaz a medida antes de qualquer código.

## 2. A causa (lida no código nesta sessão)

`src/sim/colisao.ts`:
1. **Só o meu passo é conferido** (`:286`): eu permuto quando `progresso + 1 >= custoDoPasso`. O
   passo do outro (`o`) não é conferido. O outro pode estar no começo do passo dele, e mesmo assim
   vai para o meu tile **na hora**, com `progresso: 0` (`:297-298`). Ele ganha o que faltava do
   passo em curso, até um passo inteiro.
2. **O `andar` do mesmo tick soma 1 no passo seguinte**, para os dois (`:272-273`, registrado como
   "custo conhecido" no plano da D-MOVIMENTO-01j, `docs/planos/2026-09-28-D1-colisao-civil.md` §11).
   A permuta roda antes das FSMs (`src/sim/tick.ts:250`), e o `andar` da FSM já conta o tick da
   permuta como o primeiro do passo seguinte.

**Hipótese, não medida separadamente:** o 1 explica a maior parte dos 5 ticks em 20 tiles, e o 2
explica 1 tick por permuta. A Tarefa 1 separa as duas causas.

## 3. A referência do KaM

Clone `D:\projetos-pessoal\kam_remake`, commit `731a8a4`. Arquivo
`src/units/actions/KM_UnitActionWalkTo.pas`:

- **`:125`:** `EXCHANGE_TIMEOUT = 0`. A troca com quem vem de frente é imediata, sem espera.
- **`:776-778`:** a troca só é pedida se o oponente não está em outra troca (`not fDoExchange`) e
  **não está no meio de um passo** (`not fDoesWalking`). O comentário diz: "Unit not yet arrived
  on tile, wait till it does, otherwise there might be 2 units on one tile".
- **`:1155` e `:1325`:** `fDoesWalking` volta a `False` no começo de cada atualização, e vira
  `True` quando a unidade dá um passo de animação. Ou seja, quem está entre dois tiles não troca.
- **`:787-796`:** se o próximo-do-próximo do oponente é o meu tile, os dois marcam a troca
  (`PerformExchange(KMPOINT_ZERO)`, `fDoExchange := True`). O comentário diz: "They both will
  exchange next tick".
- **`:1267-1286`:** a troca **é um passo**: `Inc(fNodePos)`, `PositionNext` e `UnitSwap`, com
  `IsExchanging` para deslizar. **`:1313-1325`:** o deslocamento segue na velocidade normal de
  andar (`GetEffectiveWalkSpeed`).

**O que o KaM diz, em uma linha:** a troca só começa com os dois parados sobre o tile, e dura um
passo inteiro, como andar. Ninguém ganha tempo.

## 4. A proposta

Duas mudanças em `sistemaDaPermuta` e no `andar`, só com a chave ligada:

1. **Permutar só quando o passo dos dois vence no mesmo tick.** A condição de `:286` passa a valer
   também para `o`, com o custo do passo dele até o meu tile. Se só o meu venceu, eu espero (conto
   `bloqueado`, como hoje). No tick em que os dois vencem, a permuta acontece. É o `fDoesWalking`
   do KaM traduzido para o tick.
2. **Quem permutou não soma o tick no `andar`.** A permuta é o passo daquele tick. Hoje o
   `permutou` é um `Set` local (`:278`). Ele passa a ser devolvido a `step`, e o `andar` não soma
   `progresso` para quem está nele. Ele vive só dentro de um tick e não entra no `GameState`, que
   continua serializável.
- **A permuta forçada** (`:293`, no teto `ticksTrocaForcada`) segue a mesma regra 2. A regra 1 não
  se aplica a ela, porque o outro está parado por definição (preso). Fica escrito no aceite.
- **Fora do escopo:** ligar a chave, e qualquer número de `data/`.

## 5. Ordem e aceite (escrito antes do código)

**Tarefa 1 (só medida, antes do código):** o teste novo `tests/D-MOVIMENTO-PERMUTA-NO-PASSO.test.ts`
liga a chave por um `GameData` do teste (o mesmo molde dos 31 testes da 01a), roda pelo `step`, e
grava em `test-output/` as chegadas nestes casos:
- duas de frente em 20 tiles;
- uma sozinha;
- duas em fila.

Ele afirma o caso de hoje: de frente, a chegada é **menor** que sozinha. Se não reproduzir os 95
contra 100, **para e reporta**.

**Aceite do conserto:**
1. com a chave ligada, duas unidades de frente em 20 tiles chegam **no mesmo tick** em que uma
   sozinha chega, pelo `step`. Nem antes, nem depois de mais que o tick da espera do passo do
   outro, que o teste mede e escreve;
2. a permuta não acontece no tick em que só o meu passo venceu: um caso armado com o outro no começo
   do passo dele mostra os dois nos tiles de origem nesse tick, e trocados no tick em que o passo
   dele vence;
3. quem permutou não ganha tick: o `progresso` dos dois no tick seguinte à permuta é 1, e não 2;
4. a invariante "um civil por tile" (D-MOVIMENTO-01j) segue valendo em todo tick dos casos acima;
5. **com a chave desligada, nada muda:** a suíte inteira e a transladada continuam verdes, e o
   estado de um cenário longo (a abertura da F17, 6 000 ticks) é byte a byte igual ao da `main`
   (`salvar` igual);
6. os 31 testes da D-MOVIMENTO-01a continuam verdes. Se algum afirma o tick ganho, ele muda junto,
   com a asserção mais estrita, nunca removida.

**Toca `src/sim/`:** não entra no filtro do dia (sem `src/sim/`). Espera o operador.

## 6. Perguntas ao operador

1. **Consertar ou remover?** O mecanismo está desligado em definitivo, são ~500 linhas em
   `colisao.ts`, e a decisão de manter ou remover já era sua (PROGRESS de 2026-09-29). Se for
   remover, este plano morre e o item é outro: a remoção, com os 31 testes.
2. Se consertar: a permuta forçada fica com a regra 2 só (proposto), ou também espera o passo do
   outro?
