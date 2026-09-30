# F24c — A Casa do Gibão por encomenda, com um insumo por peça: plano

Decisão do operador (2026-09-29): "F24c: aprovada, e é a próxima tarefa. [...] confira a
receita da Casa do Gibão contra o KaM [...] se o gibão estiver consumindo madeira, é receita
trocada. Corrija (com teste que reprova antes da correção) e então aplique a mesma regra de
encomenda da D-PRODUCAO-03 [...] Todas as oficinas de guerra ficam com a mesma regra." E:
"Encomendas: mantenha +1 por clique e adicione Shift+clique = +10."

## A conferência (feita antes do código)

- KaM (clone 731a8a4), `WARFARE_COSTS`, `KM_ResWares.pas:73-75`: escudo de madeira =
  `(wtNone, wtTimber)`, gibão = `(wtNone, wtLeather)`. Uma madeira por escudo, um couro por
  gibão.
- Aqui, `data/production.json:29`: `armory_workshop: entra { leather 1, timber 1 } → sai
  { leather_armor 1, wooden_shield 1 }`, sem `escolheSaida`. Cada ciclo come couro E madeira
  e entrega as duas peças. **Confirmado: o gibão consome madeira** (e o escudo, couro). A
  receita não é trocada — é conjunta; o efeito é o que o operador descreveu.
- `PickOrder` do KaM (`KM_Houses.pas:1585-1600`): a partir da última peça feita, a primeira
  com encomenda > 0, gaveta de saída não cheia **e insumo dela na entrada**. Peça encomendada
  sem insumo é **pulada**, e a próxima com insumo sai. Hoje o `escolhaNoComecoDoCiclo` escolhe
  sem olhar insumo; nas três oficinas de hoje o insumo é o mesmo para todas as saídas, então
  pular ou esperar dá no mesmo. Na Casa do Gibão não dá.
- `NeedsPlayerOrder` do KaM: as quatro casas de guerra (ferraria de armas, de armaduras,
  oficina de armas, Casa do Gibão). O estábulo não (uma saída).

## O modelo (sim)

1. **Dado:** `armory_workshop` ganha `escolheSaida: true` e `entraPorSaida: {
   leather_armor: { leather: 1.0 }, wooden_shield: { timber: 1.0 } }`, na mesma unidade de
   `entra` (unidades por minuto). `entra` continua a lista do que o prédio PEDE ao
   transporte (a demanda de insumo lê `entra`, `sim/insumo.ts`), como a Casa do Gibão do KaM
   pede couro e madeira.
2. **Carregador:** `ReceitaDePredio.entraPorSaida: Record<saída, Record<insumo, qtd>> | null`,
   convertido para quantidade por ciclo como `entra`. Recusa: sem `escolheSaida`; chave fora
   de `sai`; insumo fora de `entra`. O período entra no `ticksDoCiclo` (o máximo) como os
   outros.
3. **validate:data:** as mesmas três regras (`producao/entra-por-saida`), mais o guarda "toda
   receita com duas saídas ou mais em que alguma saída é requisito de soldado escolhe a saída"
   (`producao/oficina-de-guerra-sem-encomenda`).
4. **`sim/producao.ts`:**
   - `insumoDaSaida(receita, saída)`: `entraPorSaida[saída] ?? entra`.
   - `escolhaNoComecoDoCiclo` passa a pular a saída sem insumo, como o `PickOrder`. Devolve
     `'sem-insumo'` quando há encomenda e nenhuma tem insumo (o especialista fica
     `esperando_insumo`, como hoje); `null` continua "nada encomendado".
   - `temInsumoPara(predio, entra)` e `consumirInsumosPara(predio, entra)`; `temInsumo` e
     `consumirInsumos` viram atalho com `receita.entra` (chamadores de hoje intactos).
5. **`systems/especialistas.ts`:** no começo do ciclo cobra `insumoDaSaida(receita,
   escolha.emCurso)` na receita que escolhe; o resto, `receita.entra`.
6. Save de antes com ciclo da Casa do Gibão em curso: entrega a peça na posição `proxima`
   (o caminho que a 03a já tem para save sem `emCurso`); o insumo já pago dos dois fica
   pago. Aceito, PARA REVISÃO.

## A tela (ui, sem render)

- `src/ui/painel-predio.ts`: Shift+clique no − / + da encomenda anda 10
  (`comandoDeEncomenda(..., ±10)`, que já corta em 0..máxima). O texto do botão não muda; o
  `title` diz "Shift: 10" (tema).
- `tools/shots/F24c.js`: a Casa do Gibão no painel, `Shift` + mouse.down/150/up no + do
  escudo com o jogo andando (§8): o escudo vai a 10.

## Aceite

`tests/F24c-casa-do-gibao-por-encomenda.test.ts`, tudo pelo `step`:

1. **Reprova antes da correção:** Casa do Gibão com couro e SEM madeira, gibão encomendado:
   sai um gibão, o couro desce 1 e nenhum escudo nasce. (Hoje: nada sai, falta madeira.)
2. O contrário: só madeira, escudo encomendado: sai o escudo, a madeira desce 1, couro
   intacto.
3. Nasce parada: couro e madeira na entrada, encomenda zero em cada peça, e nenhum ciclo na
   janela.
4. O `PickOrder`: gibão e escudo encomendados, só madeira na entrada: o escudo sai primeiro,
   e o gibão continua devendo 1.
5. O aviso: cumprida a encomenda, `production-order-completed` da Casa do Gibão, uma vez.
6. A cadeia inteira (F24b) com a Casa do Gibão encomendada: gibão e escudo chegam ao
   armazém. O teste da F24b passa a encomendar (a regra dele mudou: era "faz as duas sem
   pedir").
7. Guarda estrutural: toda oficina de guerra (duas saídas ou mais, alguma requisito de
   soldado) escolhe a saída, no dado real; e a regra do validate acusa a cópia adulterada.
8. Invariantes do JobBoard e da FSM sem violação.

UI: `tests/D-PRODUCAO-03b-painel-encomenda.test.ts` ganha o caso do Shift (+10, e −10 que
para no zero). Screenshot da Casa do Gibão com a encomenda de 10.

## PARA REVISÃO

- O `entra` da Casa do Gibão continua pedindo couro e madeira mesmo sem encomenda (o KaM
  pede também; o liga/desliga da entrega, `gicHouseArmorWSDeliveryToggle`, é a lacuna 7 da
  frente 4b).
- Pular a peça sem insumo muda a ordem das peças quando falta insumo de uma só; nas outras
  três oficinas não muda nada (insumo igual para todas as saídas).
