# F-T2c — A escolha do tile nasce no JobBoard, com reserva

> Plano de implementacao da feature ja escolhida. O criterio de aceite vem do
> `BUILD_PLAN.md` (item F-T2c, perna 6 da F-T2) e nao e reescrito aqui.

**Objetivo:** encerrar a divida declarada na F-T2a — a pedreira escolhe o tile
por varredura dentro do proprio alcance, sem reserva. Depois desta feature, o
tile vem de uma tarefa do JobBoard, reservado, com `release` em todo ramo.

**Aceite (BUILD_PLAN):** *dois especialistas reclamando no mesmo tick recebem
tiles distintos.* Evidencia em `test-output/F-T2c.json`.

**Escopo:** `src/sim/` apenas. O item NAO tem nota de integracao e NAO pede
screenshot — nada de `src/render/`, nada de `tools/shots/`.

---

## Decisoes de desenho (tomadas antes do codigo)

**D1 — a reserva e do TILE INTEIRO, nao de unidades dentro dele.** O aceite
escrito pelo operador diz "nunca colhem o mesmo tile no mesmo tick". Uma reserva
por quantidade (o molde de `reservadoNaOrigem`) deixaria duas pedreiras cavando
15 unidades do mesmo lajedo, uma unidade cada, e passaria a formulacao por cima.
Um tile e um LUGAR: quem esta cavando nele o ocupa.

**Consequencia declarada:** duas pedreiras cujo unico tile de rocha comum e o
mesmo se alternam mal — quem pede primeiro e quem vem antes em `unidades.ordem`
(ver D6), entao a mesma pedreira reclama o tile a cada ciclo e a outra fica em
`esperando_insumo` ate o tile secar. Nao e espera indefinida (o tile seca, e ai
as duas ficam esgotadas pelo mesmo predicado), mas e injusto. Fica registrado no
`PROGRESS.md`; round-robin entre predios e mudanca de design e nao entra aqui.

**D2 — a reserva vale desde `aberta`, como em assentar-estrada.** Criar a
tarefa e o que compromete o tile. Sem isso, duas tarefas nasceriam no mesmo tile
no mesmo `gerarTarefas` e o claim teria de desempatar depois — exatamente o
estado que a F-T2a declarou como divida. O `reclamar` mesmo assim reconfere
(tile ainda existe, ainda tem o bastante, nao ha outra tarefa nele): claim
atomico nao confia na criacao.

**D3 — o tile e a ORIGEM, e o campo se chama `origemTile`.** Nao `destinoTile`:
`ehTarefaDeAssentamento` classifica por FORMA e um segundo tipo com
`destinoTile` passaria a ser lido como tarefa de assentar estrada em
`sanearTarefas`, no verificador e no claim. Alem de evitar a colisao, o nome
esta certo: o recurso sai do tile e entra no predio.

**D4 — o predicado de esgotamento passa a ser POR TILE.** `semRecursoAoAlcance`
somava o alcance inteiro; com a reserva exclusiva, quem produz um ciclo e UM
tile. Se o predicado continuasse somando, um predio com dois tiles de 1 unidade
e um ciclo de 2 ficaria eternamente sem tarefa possivel e sem se declarar
esgotado — espera indefinida. Os dois lados passam a perguntar a mesma coisa:
existe tile ao alcance com `>= unidadesPorCiclo`? Hoje a resposta e identica a
antiga (quarry tem ciclo de 1 e rocha rende 15 por tile); a diferenca so aparece
em receita futura.

**D5 — quem claima e o OCUPANTE, e ele acha a tarefa pelo PREDIO.** O rotulo da
FSM do especialista e recalculado todo tick e `comFsm` zera `fsmData`: guardar o
id da tarefa ali seria perde-lo na primeira troca de rotulo. A tarefa se acha por
`destino === predio.id`, e so os predios com colheita entram na varredura.

**D6 — quem CRIA a tarefa e o ocupante que vai colher, no mesmo tick do claim
(decidido durante a execucao, contra o que D2 e a Tarefa 5 planejavam).** O
plano mandava criar no `gerarTarefas`. Isso foi implementado e MEDIDO: 7 testes
de F15a, F16c e F-T2a reprovaram, todos por um tick de atraso. `gerarTarefas`
roda no FIM do passo, depois dos especialistas, entao a tarefa nascida no tick N
so seria reclamada no tick N+1 — o primeiro ciclo de toda pedreira do jogo
atrasaria um tick, e a pedreira despausada perderia um tick a mais. Nenhuma
assercao foi afrouxada: o mecanismo e que estava errado.

A tarefa de colheita nao tem fila de pretendentes — o unico que pode reclama-la
e o ocupante daquele predio — entao ficar aberta um tick nao compra nada. Ela
passa a nascer em `garantirColheita`, que escolhe o tile ja descontando os
reservados, cria e reclama em seguida; o `reclamar` refaz as conferencias por
conta propria, como manda D2. **O release deste ramo e estrutural**: se o claim
falha, o estado com a tarefa criada e descartado inteiro e o chamador continua
com o estado de antes. `gerarTarefasDeColheita` nao existe.

---

## Arquivos

- **Modificar** `src/sim/state.ts` — `TarefaColher`, uniao, `ehTarefaDeColheita`.
- **Modificar** `src/sim/recursos.ts` — `colherDoTile`, `melhorTileDeColheita`;
  `colher` (varredura do alcance) sai.
- **Modificar** `src/sim/producao.ts` — `semRecursoAoAlcance` por tile (D4).
- **Modificar** `src/sim/reservas.ts` — `tilesReservadosParaColheita`.
- **Modificar** `src/sim/jobs.ts` — `criarTarefaDeColheita`, elegibilidade,
  ramo do `reclamar`, `tarefaDeColheitaDoPredio`.
- **Modificar** `src/sim/systems/jobs.ts` — `gerarTarefasDeColheita`,
  `motivoDoDestino`, `motivoIndividual`, teto de abertas.
- **Modificar** `src/sim/systems/especialistas.ts` — portao do ciclo e deposito.
- **Modificar** `tests/helpers/jobs-invariantes.ts` — caso do switch exaustivo
  e a invariante "um tile, uma tarefa".
- **Modificar** `tests/F-T2a-recursos.test.ts`, `tests/F-T2b-obstaculo.test.ts` —
  migracao de `colher` para `colherDoTile` (mesma assercao, API nova).
- **Criar** `tests/F-T2c-colheita-jobboard.test.ts`.

---

## Tarefa 1 — o tipo e a reserva derivada

`state.ts` ganha `TarefaColher` (`tipo: 'colher'`, `estado: aberta|reclamada`,
`destino` do predio completo, `origemTile`, `recurso`, `quantidade`) e o
predicado `ehTarefaDeColheita`. `reservas.ts` ganha
`tilesReservadosParaColheita(state, excetoTarefa)`: um tile entra no conjunto se
QUALQUER tarefa de colheita o aponta, aberta ou reclamada (D1/D2).

- [ ] Teste: uma tarefa poe o tile no conjunto; `excetoTarefa` o tira.
- [ ] `npm run typecheck` acusa os switch exaustivos que faltam tratar.

## Tarefa 2 — a escolha pura e a colheita de um tile

`recursos.ts`:
`melhorTileDeColheita(state, predio, colheita, minimo, reservados, dados)` e a
varredura da F-T2a, intacta na ordem (`tilesDeColheita`, oeste->leste), com dois
filtros novos: `quantidade >= minimo` e o tile fora de `reservados`. E a funcao
pura que o BUILD_PLAN manda reaproveitar.
`colherDoTile(state, chaveDoTile, quantidade, dados)` tira de UM tile e aplica o
regime (`nunca` apaga a entrada).

- [ ] Teste: mesma ordem de escolha da F-T2a sem reservas; pula o reservado.
- [ ] `colher` sai; os 3 usos em teste viram `colherDoTile`.

## Tarefa 3 — o predicado de esgotamento por tile

`semRecursoAoAlcance` passa a ser `melhorTileDeColheita(..., unidadesPorCiclo,
conjunto vazio) === null` — sem reservas, porque a pergunta e sobre o MAPA (e o
que o alerta da F22 e o evento `vein-exhausted` querem saber), nao sobre a
vizinha.

- [ ] `tests/F15a-producao.test.ts` (1 tile, 1 e 2 unidades, ciclo de 2) continua
      verde sem tocar na assercao.

## Tarefa 4 — criacao, elegibilidade e claim

`jobs.ts`:

- `UNIDADE_ELEGIVEL_POR_TIPO.colher = null` e `podeReclamar` cai em
  `predioAceita(destino)`, como ocupar: quem colhe numa `quarry` e o civil que o
  dado declara para `quarry`.
- `criarTarefaDeColheita(state, predio, colheita, quantidade, origemTile)`.
- ramo novo no `reclamar`, antes da atribuicao unica:
  - o predio existe, esta completo e `ocupante === unidadeId`, senao
    `destino-sem-trabalho`;
  - o tile ainda tem `>= tarefa.quantidade`, senao `origem-sem-recurso`;
  - nenhuma OUTRA tarefa de colheita aponta o tile, senao `origem-sem-recurso`.
  Sem caminho a checar: o especialista ja esta dentro do predio.
- `tarefaDeColheitaDoPredio(state, predioId)`.

- [ ] Teste: claim recusado com tile reservado por outra tarefa.

## Tarefa 5 — gerar e sanear

`systems/jobs.ts`:

- ~~`gerarTarefasDeColheita` no fim de `gerarTarefas`~~ — **retirado por D6**: a
  criacao foi para `garantirColheita`, em `systems/especialistas.ts`, no mesmo
  tick do claim. O `gerarTarefas` nao ganhou ramo de colheita.
- `motivoDoDestino` caso colher: predio sumiu, nao e completo ou sem receita de
  colheita -> `destino-sumiu`; pausado -> `destino-completo`; tile sem o bastante
  -> `origem-sem-recurso`.
- `motivoIndividual`: reclamada cujo `destino.ocupante !== t.reclamadaPor` ->
  `destino-completo` (cancela; o ocupante novo cria a dele).
- `motivoDoDestino` pergunta pelo ocupante nas `unidades`, e nao so pelo campo do
  predio: `sanearOcupacao` zera o campo mais adiante no tick, e esperar por ele
  prenderia o tile um tick inteiro depois da morte do especialista. Medido pelo
  aceite "ocupante morto devolve o tile".
- teto de abertas: uma tarefa por predio e uma por tile; a de numero maior sai.

- [ ] Teste: pedreira demolida devolve o tile no mesmo tick.

## Tarefa 6 — o especialista

`systems/especialistas.ts`:

- `produzir`, antes de gastar relogio: receita com colheita exige tarefa de
  colheita RECLAMADA por esta unidade. Nao havendo, `garantirColheita` cria a do
  predio no tile livre e reclama (D6) — ou reclama a que ficou aberta por um
  `release` anterior; falhando, `esperando_insumo` (o ciclo nao anda e
  `progresso` nao zera).
- `depositar`: colhe de `tarefa.origemTile` com `colherDoTile` e chama
  `removerTarefa` no mesmo tick — nao existe instante com o recurso na gaveta e
  o tile ainda reservado. O `vein-exhausted` continua saindo pelo mesmo if.
- `passoProduzindo`, ramo "perdeu o predio": `liberar(..., 'pedido-da-unidade')`
  antes de `ficarOcioso`. Sem isso `unidadeJaTemTarefa` prenderia o especialista
  para sempre — ele nunca mais reclamaria uma ocupacao.

## Tarefa 7 — o aceite e a evidencia

`tests/F-T2c-colheita-jobboard.test.ts`:

- **O aceite**: duas pedreiras com alcances sobrepostos, ocupadas, rodando `step`
  por um cenario inteiro; em TODO tick, os tiles apontados por tarefas de
  colheita nao se repetem, e os tiles que perderam quantidade no tick sao
  distintos. Prova por comportamento, como o item pede.
- **A prova de que o guarda acusa**: sem o filtro de reserva a assercao reprova
  (probe da sessao, nao cobertura permanente).
- Release em todo ramo: predio demolido, ocupante morto, tile esgotado, predio
  pausado — cada um devolve o tile ao conjunto livre no mesmo tick.
- `tests/helpers/jobs-invariantes.ts`: caso do switch + "nenhum tile com duas
  tarefas", valendo para TODOS os cenarios que ja rodam `violacoesDeInvariantes`.
- `gravarEvidencia('F-T2c', ...)` com ticks, tarefas criadas e colisoes (zero).

## Tarefa 8 — fechamento

- [ ] `npm run verify`
- [ ] nao-regressao por codigo de saida: `F-T2a`, `F-T2b`, `F22`
- [ ] `PROGRESS.md`, `test-results.json`, commit `feat(F-T2c): ...`
