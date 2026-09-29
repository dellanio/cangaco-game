# F-REPL-d — seletor de modo no painel (ui)

Pedido do operador (lote de 2026-09-29, item 10): o seletor de modo do lenhador no painel. O
contrato está na nota do item F-REPL-d (herdada da F-REPL-b):

- o botão manda `{ type: 'SetBuildingMode', predio, modo }` com o VALOR, sem alternar;
- os modos são as chaves de `receitas[tipo].modos.porModo`, e o atual está em
  `producao.modo`, que sem valor é o `padrao`;
- o seletor aparece para toda receita com `modos !== null`, nunca por
  `tipo === 'woodcutters'`;
- os nomes vêm de `theme-sertao.predios.<tipo>.modos.<id>` (`nome`, `desc`).

**Aceite:** um roteiro, como os outros itens do lote.

## O desenho

- `src/ui/modo-do-predio.ts` (novo, puro):
  - `opcoesDeModo(modos, modoAtual, nomes)` devolve `[{ id, nome, desc, atual }]` na ordem
    do dado, ou `[]` quando a receita não tem modos;
  - `comandoDeModo(predio, id)`.
- `main.ts` entrega a `montarPainelPredio` a função `modosDoTipo(tipo)`, que devolve
  `{ ids, padrao } | null`, lida de `gameData.producao.receitas`. O `ui/` continua sem
  importar `sim/data`, como na C-TELA-05.
- O painel (`painel-predio.ts`), em predio completo com modos, desenha:
  - a linha "Trabalho: <modo atual>" (`data-modo`);
  - um botão por modo nas ações (`data-modo-botao`). O atual fica marcado com
    `aria-pressed` e não é desabilitado, porque mandar o mesmo valor não faz mal. O `title`
    é a `desc` do tema.
- O modo atual é lido de `estado.predios.porId[id].producao.modo`, o mesmo campo que o
  `plantaNoModo` da sim lê.

Isto não toca `sim/`.

## Testes

- `tests/F-REPL-d-seletor-de-modo.test.ts`:
  - no lenhador, duas opções na ordem do dado, com os nomes do tema e a padrão marcada;
  - receita sem modos (serraria) dá `[]`. Uma receita com modos que não é lenhador, feita
    com `GameData` variante, também dá opções: o seletor é por dado, não por tipo;
  - o comando do botão "Cortar" passa pelo `step` real num lenhador completo, e
    `producao.modo` vira `cortar`. Voltar a "Cortar e plantar" também passa;
  - evidência em `test-output/F-REPL-d.json`;
  - o teste grava `test-output/F-REPL-d.save.txt`: a vila com um lenhador completo.
- O roteiro `tools/shots/F-REPL-d.js` é o **aceite**. Ele carrega o save e abre o painel do
  lenhador com o jogo andando. Depois:
  1. a linha diz "Cortar e plantar" (padrão);
  2. clica "Cortar", segurando 150 ms, e a linha vira `cortar`;
  3. clica de volta, e a linha vira `cortar_e_plantar`.

## PARA REVISÃO

- O painel não diz "o modo não muda nada até a mata acabar". A nota deixa isso como decisão
  de tela, e ela não foi pedida.
