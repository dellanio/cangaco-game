# C-IA-04 — o terceiro grupo da IA (dado + sim do cenário) — ANDAIME

Pedido do operador (2026-09-29): "faça o barato — um terceiro grupo de 9 fora das posições,
no dado da escaramuça". Na partida, a IA nunca atacou. O `atacarComASobra` (F28-IA, o
ataque) só age com `tamanhoDoGrupo` (9) militares ociosos fora das posições, e a escaramuça
dá 12, todos nas posições. Sem economia e sem reposição, a sobra nunca existe.

## ANDAIME: a condição de saída

Este grupo é o que a economia da IA ainda não produz. **Ele sai quando a C-IA-02 (economia da
IA) der à IA uma sobra que vem da reposição do quartel.** Aí o `atacantes` da escaramuça volta
a `quantidade: 0`, ou o bloco sai do dado e o `criarEscaramuca` deixa de ler o campo. A
condição fica escrita no `_doc` do bloco, na nota do item no BUILD_PLAN e no PROGRESS.

## O desenho

- `data/escaramuca.json` ganha um bloco `atacantes`:
  - `{ "tipo": "militia", "quantidade": 9, "ponto": { "gx": 80, "gy": 77 } }`, com o `_doc`
    do andaime;
  - o ponto fica a leste do quartel da IA, longe das posições: a "frente" está em (67,67) e o
    "arco" em (73,66);
  - nascem nos tiles de `tilesDoGrupo(ponto, quantidade)`, ociosos e sem posição.
- `src/sim/cenario.ts` faz nascer os atacantes depois das posições, pela mesma `nascer`.
- **Nenhuma regra de IA muda.**
  - Em paz, a IA não ataca (C-IA-03b), e o `guarnecer` só põe na posição quem é do tipo da
    posição e só quando há vaga. A "frente" tem 9 de 9, e o "arco" é de distância.
  - Quando a paz acaba, o `atacarComASobra` já vê 9 ociosos livres e os manda ao prédio
    prioritário do jogador mais perto.
  - **PARA REVISÃO:** se a "frente" perder homens ANTES do fim da paz, o `guarnecer` puxa
    atacantes para ela, e o ataque pode não sair. Em paz não há combate, então esse caso
    não acontece na escaramuça de hoje.
- `tools/data-rules.js` passa a exigir que `atacantes.tipo` seja militar e que `quantidade`
  seja um inteiro ≥ 0.
- `tools/transladar-mundo.js` translada `atacantes.ponto` junto com o resto.

## Testes

`tests/C-IA-04-terceiro-grupo.test.ts`:

1. O cenário nasce com 9 militares da IA fora de qualquer posição, ociosos, em tiles
   distintos que não repetem os tiles das posições.
2. Em paz, até o último tick da paz, nenhum deles sai de `ocioso`.
3. **Aceite:** no tick seguinte ao fim da paz, os 9 estão em `indo_atacar` contra um prédio
   do jogador. Rodando mais, um prédio do jogador perde HP, ou seja, a IA chegou e bateu.
   O jogador não dá ordem nenhuma.

## Onde isso mexe na partida

- A IA passa a ter 21 militares, e os testes que contam a tropa dela mudam:
  - C-IA-03a (cenário de escaramuça);
  - C-IA-03b (peacetime e tropas);
  - C-IA-03c (jogar pela tela).
- A partida headless da C-IA-03b, a que vence caçando a tropa, pode mudar de resultado.
  Ela passa a ter 9 inimigos a mais, que vêm ao jogador. Se mudar, o número vai medido para
  o PROGRESS, e o aceite é ajustado lá, sem afrouxar asserção: o que muda é a contagem
  esperada, com o porquê.
