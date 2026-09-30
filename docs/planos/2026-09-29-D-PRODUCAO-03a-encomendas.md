# D-PRODUCAO-03a — Encomendas das oficinas, a regra (sim): plano

Lote do operador (2026-09-29). Decisão do operador, registrada no BUILD_PLAN: "a
encomenda nasce em zero, só inicia ciclo com encomenda > 0, desconta 1 por ciclo e avisa
quando todas zeram, como no KaM". A troca do aceite da F24a está aprovada e entra aqui.

## O KaM (conferido no fonte, clone 731a8a4)

- `KM_Houses.pas:544`: `fWareOrder[I] := 0` no `Create`.
- `:1560`: `SetWareOrder` faz `EnsureRange(aValue, 0, MAX_WARES_ORDER)`;
  `KM_Defaults.pas:301`: `MAX_WARES_ORDER = 999`.
- `PickOrder` (:1575-1651), no começo de cada ciclo: procura a partir da saída **seguinte à
  última produzida** (`fLastOrderProduced`) a primeira com `WareOrder > 0`, saída não cheia
  e insumo presente; faz `Dec(fWareOrder[Result])` e marca que há mensagem a dar. Sem
  escolha e com todas em zero, dá `TX_MSG_ORDER_COMPLETED` uma vez.

## O que existe (verificado no código)

- `EscolhaDeSaida { cota, proxima }` (`sim/state.ts`): a cota é PESO, o rodízio expandido
  repete cada saída `cota[m]` vezes e `proxima` é a posição nele. Nasce com 1 em cada saída
  (`producaoParaTipo` em `state.ts`, `escolhaInicial` em `producao.ts`).
- `saidasDoCiclo` decide a saída **no depósito**; `escolhaDepoisDoDeposito` anda o rodízio.
- `SetProductionQuota` (`sim/cota.ts`, `systems/cota.ts`) substitui a cota e zera
  `proxima`; tudo zero é recusa `cota-vazia`.
- Três receitas com `escolheSaida`: `weapons_workshop`, `weapon_smithy`, `armor_smithy`.
  A escaramuça da IA não tem nenhuma (`data/escaramuca.json`); nenhum cenário de partida
  nasce com oficina. Quem roda oficina em teste: `tests/F24a-armas.test.ts`, a fixture
  `cenarioDaCadeiaDoFerro` (D-PRODUCAO-01a/01b) e o guarda do `step`.

## A regra nova

1. `EscolhaDeSaida` vira encomenda: `cota[m]` é o que **falta** fazer de `m`. `proxima` é o
   índice, na lista das saídas da receita em ordem de `economia.mercadorias`, de onde a
   próxima procura começa. Campo novo opcional `emCurso?: string`: a saída que o ciclo em
   andamento vai entregar.
2. A oficina nasce com a encomenda **toda em zero** (`producaoParaTipo`, `escolhaInicial`).
3. **Começo de ciclo** (`produzir`, `progresso === 0`, receita com `escolheSaida`): antes do
   insumo, escolhe a saída como o `PickOrder` — a partir de `proxima`, a primeira com
   `cota > 0`. Nenhuma: não começa, não cobra insumo, rótulo `trabalhando` (o mesmo da pausa:
   é escolha do jogador, não falta de matéria-prima). Achou e há insumo: cobra o insumo,
   desconta 1 da escolhida, grava `emCurso` e `proxima = índice + 1`.
   - O KaM também pula a saída de gaveta cheia. Aqui o teto é da gaveta inteira
     (`cabeNaSaida`), igual para todas as saídas; a checagem fica no depósito, como hoje.
   - O insumo é um só para todas as saídas da receita (`entra` único), então a checagem por
     saída do KaM não tem caso aqui.
4. **Depósito**: entrega `emCurso` e o apaga. Se, depois disso, toda a encomenda está em
   zero, emite `production-order-completed { predio }` — o aviso do KaM, que sai no fim do
   último ciclo encomendado. Save de antes da 03a com ciclo em curso e sem `emCurso`: entrega
   a saída na posição `proxima` (sem descontar), para o insumo já pago não sumir.
5. **`SetProductionQuota`** substitui a encomenda. Faixa `0..encomendaMaxima` inteira, com o
   máximo em dado (`production.json: encomenda.maxima = 999`, o do KaM). Tudo zero passa a
   valer (para a oficina). Acima do máximo é `cota-invalida`, como o negativo. O motivo
   `cota-vazia` sai da união. `proxima` e `emCurso` **ficam** (o KaM não mexe em
   `fLastOrderProduced` ao mudar a encomenda; o ciclo em curso já foi descontado).

## Aceite da 03a

Tudo pelo `step`, em `tests/D-PRODUCAO-03a-encomendas.test.ts`, sobre a cadeia do ferro
com ferro e carvão abastecidos (cenário novo `cenarioDasOficinasAbastecidas`, se a fixture
atual não bastar):

1. A oficina nasce com encomenda zero em cada saída e, sem comando, **não produz nem cobra
   insumo** numa janela em que, encomendada, produz.
2. Encomenda `{ sword: 2, crossbow: 1 }`: saem exatamente 2 espadas e 1 besta, na ordem do
   rodízio (espada, besta, espada), e nada mais.
3. Desconto no começo do ciclo: logo depois de o primeiro ciclo começar, a encomenda da
   escolhida já caiu 1 e `emCurso` a nomeia.
4. `production-order-completed` sai uma vez, no tick do último depósito encomendado, e não
   antes.
5. Encomenda zerada no meio de um ciclo: o ciclo em curso termina e entrega, e não começa
   outro.
6. `SetProductionQuota` com tudo zero é aceito; acima de `encomenda.maxima` é recusado
   (`cota-invalida`); os outros motivos seguem.
7. Save/load no meio de uma encomenda dá o mesmo estado.

`emCurso` entra no guarda do `step` (`tests/GUARDA-step-preserva-opcionais.test.ts`).

Troca do aceite da F24a (aprovada): o caminho real emite a encomenda quando cada oficina fica
pronta, e o teste "rodízio fixo padrão: cota 1" vira "nasce em zero". O caso "só lance"
continua, agora como encomenda. A fixture da cadeia do ferro nasce com encomenda nas duas
ferrarias (grande, para a janela das 01a/01b não esgotar).

## Tarefas

1. Dado: `production.json: encomenda { _doc, maxima }`, `ProducaoData.encomenda`, loader,
   regra em `tools/data-rules.js` (inteiro ≥ 1) com prova de que acusa.
2. Sim: `state.ts` (tipo e `producaoParaTipo`), `producao.ts` (escolha no começo, depósito do
   `emCurso`), `especialistas.ts` (portão da encomenda antes do insumo, evento), `cota.ts`
   (faixa, sem `cota-vazia`), `systems/cota.ts` (manter `proxima`/`emCurso`), `commands.ts`
   (doc), evento novo em `GameEvent`.
3. Testes: o novo, a F24a trocada, a fixture da cadeia do ferro, o guarda.
4. `npm run verify`; BUILD_PLAN (03a ENTREGUE, aceite da F24a trocado), siglas, PROGRESS,
   test-results, commit, push.

Sem screenshot: a 03a não muda a tela (o painel é a 03b). Mas **muda a partida**: oficina
nova fica parada até o jogador encomendar, e até a 03b só há o comando — sem botão. Isso vai
no relatório.

## PARA REVISÃO

- Rótulo `trabalhando` para a oficina sem encomenda (como a pausa), em vez de um estado novo.
- Acima do máximo é recusa, e não o `EnsureRange` do KaM: mantém a regra de recusa que a F24a
  já tinha para o negativo.
- O aviso sai no depósito do último ciclo, e não na próxima tentativa de ciclo como no KaM
  (dá o mesmo instante na prática, sem uma flag a mais no estado).
- A oficina sem encomenda continua pedindo insumo até o alvo da gaveta (o KaM também pede).
