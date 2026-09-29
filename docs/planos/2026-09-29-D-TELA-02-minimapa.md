# D-TELA-02 — minimapa (render + ui)

Pedido do operador (2026-09-29): o minimapa, com quatro coisas:
- o terreno pintado;
- os prédios por lado, em vermelho e azul;
- a vista atual marcada;
- o clique movendo a câmera.

O item da fila (antes F33) não tinha corpo, então o escopo é este, e **o aceite é um
roteiro**, como os outros itens do lote.

## Como está

- `#minimapa` é só a moldura (UI-barra-a): um `.placeholder` com o texto do tema e a faixa
  da rosa. Por cima ficam o carimbo de pausa (F11a) e o contador da paz (C-IA-03c).
- `render/mapa.ts` já entrega `terrenoDeRender`: um código por tile e a cor de cada código,
  do tema. É a mesma grade que a cena pinta.
- `render/cor-do-bando.ts` dá a cor de cada lado (C-IA-03c), e `render/predios.ts`
  (`caixaDeTipoNoMapa`) dá o footprint de cada tipo.

## O desenho

- `src/render/minimapa.ts` (novo, puro, sem phaser e sem DOM), a aritmética:
  - `enquadrar(largura, altura, caixaPx)`: quantos px de minimapa cabem por tile. O mapa
    inteiro cabe na caixa, com a proporção mantida e centrado;
  - `retanguloNoMinimapa(caixaEmTiles, enquadro)`: um prédio ou a vista, em px de minimapa;
  - `vistaEmTiles(worldView, tilePx)`: o retângulo da câmera em tiles;
  - `tileDoMinimapa(px, py, enquadro, largura, altura)`: o tile sob o clique, preso ao
    mapa;
  - `pixelsDoTerreno(terreno)`: um RGBA por tile, a partir de `codigos` e `cores`.
- `src/ui/minimapa.ts` (novo, DOM):
  - um `<canvas>` no lugar do `.placeholder`;
  - o terreno vai para um canvas fora da tela UMA vez, porque o terreno é fixo na partida;
  - a cada quadro (`requestAnimationFrame`) ele desenha o terreno, os prédios do último
    estado na cor do bando e a vista em traço claro. A vista anda com a câmera mesmo com o
    jogo pausado, e é por isso que o redesenho é por quadro e não por tick;
  - `pointerdown` e arrasto sobre o canvas chamam `centrarEm(tile)`.
  - Ele não importa `render/mapa.ts` nem `sim/data`. `main.ts` entrega o terreno, o tamanho
    e as funções de câmera, como fez com a lista de mercadorias da C-TELA-05.
- A cena (`WorldScene`) ganha:
  - `vistaDaCamera()`: o `worldView`;
  - `centrarCameraEm(tile)`: `camera.centerOn` no centro do tile. O `setBounds` da F04
    prende na borda.
  - `JogoLigado` repassa as duas.
- Debug: `window.__cangaco.estado().minimapa` diz quantos prédios foram desenhados e qual
  retângulo de vista, em px de minimapa, para o roteiro afirmar número e não pixel da
  captura.

Isto não toca `sim/`.

## Testes

- `tests/D-TELA-02-minimapa.test.ts`:
  - o enquadro de 128×128 numa caixa larga fica centrado e com escala `min`;
  - o `tileDoMinimapa` inverte o `retanguloNoMinimapa` e prende nas bordas;
  - `vistaEmTiles` converte o `worldView`;
  - `pixelsDoTerreno` pinta cada tile com a cor do código dele;
  - `render/minimapa.ts` não importa `sim/data` nem phaser. Isto é estrutural: o
    F04 (grid ortogonal) já varre `render/`.
- O roteiro `tools/shots/D-TELA-02.js` é o **aceite**. Na escaramuça:
  1. o minimapa tem o canvas, e os prédios desenhados são os do estado. A cor no pixel do
     prédio do jogador é a do bando 0, e a do prédio da IA é a do bando 1 (leitura do
     canvas, `getImageData`);
  2. um clique despausado, seguro 150 ms, sobre a vila da IA no minimapa leva a câmera para
     lá. O centro da vista fica a menos de 2 tiles do tile clicado, e o retângulo da vista
     no minimapa acompanha;
  3. a captura mostra o minimapa.

## PARA REVISÃO

- Não desenha unidades, recursos (árvore, pedra), estrada, nem névoa: não estavam no
  pedido.
- O terreno que muda na partida não repinta: ponte e terraplenagem não existem hoje.
  Quando existirem, o cache do terreno tem de invalidar.
