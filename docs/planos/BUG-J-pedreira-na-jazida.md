# Plano — BUG-J: a pedreira sobre a jazida recusada com `porta-sem-saida`

> Pedido do operador em 2026-09-26: medir quantas posições do mapa isso afeta antes de
> propor conserto. Raro: registrar e não mexer. Comum: corrigir o gerador, não o `canPlace`.

## A premissa, conferida no dado

O operador escreveu "é o veio nascendo na borda sul do prédio". O código diz outra coisa:
a checagem da porta (`src/sim/placement.ts`, fim de `canPlace`) só pergunta **terreno**
(`ehTransponivel`); veio é **recurso**. A F21b não mudou um tile de terreno — ela trocou 46
recursos `rock` por veio (311 → 265). O roteiro F-TP escolhe o alvo sozinho ("o ponto com
mais rocha ao alcance entre os que aceitam a pedreira"), mas só conferia o footprint em grama,
não a porta. Com menos rocha, o melhor ponto pulou de **(105,92)**, porta `ggg`, para
**(79,91)**, porta `ggr`: o tile (81,93) é terreno `rocha`, intransponível, e o jogo recusa
com razão.

## A medida (sonda `tests/zz-sonda-bug-j.test.ts`, apagada; `canPlace` real em todo o mapa)

| | posições |
|---|---|
| total de cantos da pedreira (3×2) | 16 002 |
| `ok` | 13 653 |
| `porta-sem-saida` | 271 |
| com rocha ao alcance (6, Chebyshev) e válidas | **1 604** |
| com rocha ao alcance e recusadas pela porta | **108** (6 %) |
| lajedos (componentes de rocha, vizinhança de 8) | 25 |
| lajedos sem NENHUMA posição válida ao alcance | **0** |
| lajedos em que a porta tira a posição que mais cobre aquele lajedo | **0** |
| das 10 posições que mais cobrem rocha no mapa, recusadas | 3 (inclusive a 1ª, a do roteiro) |

**Raro, e sem perda para o jogador:** todo lajedo tem posição válida que cobre tanto dele
quanto a melhor recusada. O que se perde é a posição que soma rocha de lajedos vizinhos, e
ela é recusada pela regra certa (porta em rocha).

## Decisão (minha, marcada para revisão do operador)

- **Não mexo no gerador nem no `canPlace`.**
- **Conserto o seletor do roteiro F-TP:** `cabeComPorta` confere footprint em grama e porta
  no mapa e em terreno transponível (`terrain.intransponivel`), a mesma pergunta do
  `canPlace`. É o que o comentário do seletor já prometia ("entre os que a aceitam").
- O BUG-J sai do `BUGS.md` no mesmo commit.
