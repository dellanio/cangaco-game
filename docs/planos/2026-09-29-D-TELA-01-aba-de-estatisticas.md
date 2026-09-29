# D-TELA-01 — aba de estatísticas

**Item da fila (lote do operador, item 4):** "aba de estatísticas: prédios e trabalhadores por
tipo, com os ociosos em destaque." É a linha do GDD §7.2 ("Aba Estatísticas | Prédios e
trabalhadores por tipo; ociosos em destaque | P1").

## O que existe hoje (conferido)

- A aba `estatisticas` já abre: `ABAS_TRANCADAS` é só `['distribuicao']`, em
  `src/ui/barra.ts:25`. O comentário da linha 24 ainda cita a D-TELA-01 como trancada.
- O corpo dela é `#estatisticas` (`index.html:29`): um `h2` "Estado da vila" e o `#hud` com
  os cinco recursos. Não há prédio nem trabalhador por tipo.
- `sim/selectors.ts` tem a `contagemPorTipo`, que soma todas as unidades sem olhar o lado, e
  nenhuma noção de ocioso.

## A regra (interpretação conservadora, PARA REVISÃO)

Um seletor puro em `sim/selectors.ts`:
`estatisticasDaVila(state, dados = gameData, lado = LADO_DO_JOGADOR)`.

- **Prédios:** os do lado, por tipo, na ordem de `buildings.json`, e só os tipos com algum.
  Dá `completos` e `emObra` separados, porque a obra ainda não trabalha.
- **Trabalhadores:** os civis do lado (`classeDaUnidade === 'civil'`), por tipo, na ordem de
  `units.json: civis.tipos`, e só os tipos com algum. Dá `total` e `ociosos`:
  - **especialista** (tipo em `tiposQueOcupam`): ocioso é quem não ocupa prédio
    (`predioDoOcupante === null`). Quem está no prédio esperando insumo não é ocioso: essa
    falta já tem alerta próprio (F22);
  - **serf e peão** (fora de `tiposQueOcupam`): ocioso é `fsm === 'ocioso'`, ou seja, sem
    tarefa;
  - **recruta:** `ociosos: null`, porque esperar no quartel é o papel dele. Contar recruta
    como ocioso acenderia o destaque em toda vila com quartel.
- O militar fica de fora: a barra já dá civil/militar, e o militar não é trabalhador.

## Tela (`src/ui/estatisticas.ts`, novo)

- `montarEstatisticas()` monta uma vez, dentro de `#estatisticas`, depois do `#hud`, duas
  listas com título: "Prédios" e "Gente". Devolve `{ atualizar(estado) }`.
- Cada linha tem o nome do tema e o número. A linha de prédio mostra `completos` e, com obra,
  `+N em obra`. A de gente mostra `total` e, com ocioso, `N parados`, com
  `data-ociosos="N"` e a classe `ocioso`, que o CSS pinta na cor de alerta.
- As linhas só são recriadas quando o conjunto de tipos muda. No resto, só muda o
  `textContent`, como no `hud.ts`.
- Os textos vão no tema (`theme-sertao.json: barra.estatisticas`). O `sim/` não lê o tema.
- `main.ts` chama `estatisticas.atualizar(s)` junto dos outros.
- `barra.ts:24`: o comentário deixa de citar a D-TELA-01.

**§10:** a feature toca `sim/selectors.ts`, com um seletor puro, e `ui/`. Não toca
`src/render/`: é o mesmo desenho do `hud.ts`.

## Testes (`tests/D-TELA-01-estatisticas.test.ts`)

1. A vila inicial: os prédios batem com o estado por tipo, e o total de gente bate com a
   `populacaoPorGrupo(...).civil`.
2. O prédio da IA e o civil da IA não entram na conta do jogador (escaramuça).
3. Uma obra conta em `emObra`, não em `completos`.
4. Serf com tarefa não é ocioso, e serf `ocioso` é. Especialista fora de prédio é ocioso, e
   dentro não é, mesmo parado.
5. O recruta dá `ociosos: null`.
6. A ordem é a do dado (prédio por `buildings.json`, gente por `civis.tipos`), e não há
   linha com zero.

## Roteiro (`tools/shots/D-TELA-01.js`)

1. Uma nova escaramuça. Despausa (§8), clica na aba Estatísticas com o botão seguro 150 ms e
   pausa.
2. `body[data-corpo="estatisticas"]`, e as linhas de prédio batem, por tipo, com o
   `prediosDoEstado` do jogador.
3. A soma das linhas de gente bate com o civil de `#hud [data-campo="populacao"]`.
4. Pelo menos uma linha com `data-ociosos` maior que zero tem a classe `ocioso`, e nenhuma
   linha sem ocioso a tem.
5. Captura `D-TELA-01-1.png`: a evidência, aberta com Read.

Não-regressão: UI-barra-a, D-TELA-02 e C-COMIDA-01d pelo código de saída.
