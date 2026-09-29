# C-TELA-02 — o marcador de destino (render + input)

Pedido do operador (2026-09-29): o tile do destino de uma ordem de mover fica marcado por
~1 s e some, como no Civilization. É estado da tela e não entra na sim. `src/sim/` não muda.

## O desenho

- `src/render/marcador-de-destino.ts`, puro e sem Phaser:
  - `marcadorVisivel(marcador, agoraMs, duracaoMs)` → `{ tile, fracao } | null`;
  - `fracao` vai de 0 a 1 e faz o marcador desbotar;
  - `null` quando não há marcador ou o tempo passou.
- `WorldScene`:
  - `marcarDestino(tile)` guarda `{ tile, desdeMs: this.time.now }`;
  - `apagarDestino()` zera;
  - no `POST_RENDER`, um `Graphics` na profundidade da seleção desenha, no tile, um anel e
    quatro cantos na cor da seleção, com alfa `1 - fracao`;
  - publica `marcadorDeDestino: { gx, gy } | null` no debug, para o roteiro.
- `JogoLigado` (`render/game.ts`) repassa os dois métodos.
- `main.ts`:
  - no `aoOrdenar`, quando a ordem é `MoveUnits`, chama `jogo.marcarDestino(tile)`. A marca
    aparece no clique, mesmo pausado: é o retorno imediato do GDD §10;
  - se o tick trouxer a recusa da marcha pela paz, chama `jogo.apagarDestino()`, porque
    uma marca num destino que ninguém vai alcançar mente. O teste usa `recusaDaPaz(eventos)`,
    exportado de `ui/aviso-de-ordem.ts`, que passa a ser o que o `textoDaRecusa` usa.
- A duração, `segundosDoMarcador: 1`, fica em `theme-sertao.json`, no bloco `ordem`, ao lado
  do `segundosNaTela` da C-TELA-01 (mensagem da ordem recusada). O `terrain.json` passa pelo
  `gameData` da sim, e esta feature não toca a sim.
- **PARA REVISÃO:** o botão direito em prédio inimigo (`AttackBuilding`) não marca. O
  pedido fala da ordem de mover, e o alvo do ataque já é o próprio prédio.

## Testes

- `tests/C-TELA-02-marcador-de-destino.test.ts`, headless:
  1. no instante 0, visível com fração 0;
  2. na metade, fração 0,5;
  3. em `duracaoMs` e depois, `null`;
  4. sem marcador, `null`;
  5. `recusaDaPaz` devolve o motivo da última recusa militar da paz, ou `null`.
- Roteiro `tools/shots/C-TELA-02.js`, na escaramuça:
  - seleciona a tropa pela caixa;
  - com o jogo despausado (§8), botão direito num tile dentro da cerca, apertando com
    `mouse.down`, esperando 150 ms e soltando com `mouse.up`;
  - afirma que `marcadorDeDestino` é o tile clicado e captura a tela;
  - espera 1,5 s e afirma `null`;
  - botão direito fora da cerca: a marca aparece e some quando a recusa chega.
