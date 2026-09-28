# Plano — C2b: o projétil no ar, na tela (fila do operador, item 2, parte de render)

A C2a pôs o voo na sim (`state.projeteis`). A C2b desenha isso, e **só** isso: toca
`src/render/` e o roteiro, nada em `src/sim/`.

## O que muda na tela
- **Cada projétil em `state.projeteis` vira um desenho na posição do voo.** A fração é
  `(voo − restantes + alfa) / voo`, em [0, 1], com o `alfa` do relógio (F11a), o mesmo que
  interpola as unidades.
  - A posição é a reta do centro do tile de origem ao centro do alvo, mais um **arco**:
    altura = `ALTURA_DO_ARCO × distância × sen(π · fração)`, como a parábola do KaM
    (`KM_Projectiles.pas:386-388`).
  - A flecha e o virote são um traço curto na direção do voo; a funda e a pedra, um
    círculo. Cores e tamanhos são constantes de render.
  - A pedra sai do meio do lote da torre, como o traço antigo.
- **O traço instantâneo da pedra (F28b) sai.** Um risco que chega na hora desmente a pedra
  que voa. Os contadores de debug (`pedrasDaTorre`, `ultimaPedra`) continuam vindo do
  `stone-thrown`, e o roteiro F28b segue lendo os mesmos campos.
- **Debug novo:** `projeteisNoAr`, com um item por projétil desenhado (`projetil`,
  `fracao`, e a posição em tiles). É o que o roteiro afirma, nunca o pixel.

## Módulo puro
`src/render/projeteis.ts`: `posicaoDoProjetil(p, alfa)` devolve `{ gx, gy, altura, fracao }`.
Não importa nada da sim, só o tipo. Tem teste headless.

## Aceite
- (a) Headless: a fração vai de 0 no lançamento a 1 na chegada; o ponto do meio fica na
  metade da reta, com a altura máxima; os extremos têm altura 0; `alfa` avança dentro do
  tick.
- (b) Tela: o roteiro `tools/shots/C2.js` carrega um duelo (arqueiro contra alvo a 6
  tiles), roda despausado e afirma um projétil no ar com fração estritamente entre 0 e 1.
  Captura a screenshot com a flecha no meio do voo.
- (c) Não-regressão: F28b, F26b e F34 verdes.
