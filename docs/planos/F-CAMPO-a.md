# F-CAMPO-a — o campo cresce no tile, sozinho (sim + dado)

Item: `BUILD_PLAN.md`, F-CAMPO. Operador (2026-09-27): "comece pela feature 1, com os
números que você propôs — os quatro ficam, marcados para revisão".

## Os quatro números (decisão do operador, para revisão)
- semear: 9 s (45 ticks na escala `economia` 2,0) — o `farm.sai.corn` 3.0 continua fechando.
- crescer: 30 s (150 ticks) — o mesmo intervalo de hoje, agora sem o roceiro.
- rendimento: 4 idas por tile maduro (`rendimentoPorTile` intocado).
- escolha: rodízio.

## Modelo
- `RecursoNoTile.semeadoEm?: number` (opcional: ausente em rocha, árvore e terra).
  Maduro é derivado: `tick >= semeadoEm + ticksDeCrescer`. Nada avança por tick.
- Semear é VIAGEM: `trabalhando -> indo_semear -> semeando -> voltando -> trabalhando`.
  A reserva continua em `producao.plantio` (F18), agora cobrindo ida + semeadura.
  No último tick de semear, o tile vai a `{ quantidade: rendimento, semeadoEm: tick }`.
- Colher: o mesmo ciclo da F-T3, com o tile exigindo maduro (escolha E claim).
- Crescendo conta como trabalho (`tileTrabalhavel`): tile semeado não esgota o
  predio nem acende `sem-campo`; o roceiro espera com `esperando_insumo`.

## Rodízio (só tipo com `reposicao`: milho e cana)
- `producao.cursor?: string`: o último tile escolhido.
- Busca: se o tile do cursor ainda é colhível, continua nele (termina o tile);
  senão, o primeiro depois dele na ordem canônica que é maduro (colher) ou terra
  (semear). Volta ao começo da lista e termina no próprio cursor.
- Pedreira, lenhador, mina, pescador: sem mudança (esgotam e avançam; BUG-O mediu).

## Dado
- `resources.json: corn/grapes.reposicao`: `segundos_base` sai; entram
  `semear_segundos_base` e `crescer_segundos_base`, grupo da `escala` do arquivo.
- `tools/data-schema.js` (4 linhas por tipo) e `data-rules.js` (forma).
- `ReposicaoDeRecurso { ticksDeSemear, ticksDeCrescer, custo }`.

## Aceite (operador)
Com 12 tiles arados e um roceiro, mais de um tile produz em 6000 ticks, e a produção
é maior que com 1 tile. Medido em `cenarioDeCanavial(12)` contra `(1)` e na fazenda.

**Reescrito pelo operador (2026-09-27, noite 6):** afirma a RAZÃO. Com N tiles ao
alcance, a produção é maior que com 1 tile, por margem medida. Em
`tests/F-CAMPO-a-razao.test.ts`: fazenda do norte, 12 000 ticks, 14 tiles contra 1,
46 contra 16 milhos (2,875×), com piso de 2×. O Canavial dá 1,5× e não entrou.

## Risco já visto na conta
Com crescer = 150 < W ≈ 970, o rodízio semeia os 12 antes da primeira colheita
(≈ 12 × 150 ticks sem produzir). A conta prevê que em 6000 ticks 12 tiles podem
render MENOS que 1. Medir antes de afirmar; se reprovar, não girar número nem
trocar a regra: registrar e trazer ao operador.

## Medida (2026-09-27) — o aceite REPROVA; chave `false`, branch `f-campo-a`

Sonda `tests/zz-campo-sonda.test.ts` (apagada; o codigo esta na mensagem do commit
da branch): `step` tick a tick, a gaveta `saida` esvaziada a cada tick (a cena nao
tem serf, e sem isso tudo para em 5), `goods-produced` somado. C = `ticksDeCrescer`
injetado; semear = 45 ticks em todas as linhas. `cana1` = `cenarioDeCanavial(1)`,
`cana12` = `(12)`, `faz` = `cenarioDeFazenda` (37 tiles arados do mapa).

Rodizio (a regra aprovada):

| H | C | cana1 | cana12 (tiles colhidos, 1a saida) | faz (tiles colhidos, 1a saida) |
|---|---|---|---|---|
| 6000 | 150 | 8 | 7 (2, t1550) | 5 (2, t5051) |
| 6000 | 1500 | 4 | 6 (2, t2219) | 5 (2, t5051) |
| 6000 | 3000 | 4 | 4 (1, t3719) | 5 (2, t5051) |
| 20000 | 150 | 17 | 17 (5) | 35 (9) |
| 20000 | 1500 | 11 | 16 (4) | 35 (9) |
| 20000 | 3000 | 8 | 13 (4) | 35 (9) |

"Colher antes" (a variante que o operador recusou na Pergunta 3), medida com a
mesma sonda e revertida — so para dar a escala:

| H | C | cana1 | cana12 (colhidos, semeados, 1a) | faz (colhidos, semeados, 1a) |
|---|---|---|---|---|
| 6000 | 150 | 8 | 8 (2, 3, t955) | 24 (6, 8, t501) |
| 6000 | 1500 | 4 | 6 (2, 12, t2219) | 21 (6, 11, t1834) |
| 20000 | 150 | 17 | 17 (5, 6) | 50 (13, 14) |

Linha de base de antes da F-CAMPO (BUG-O, 2026-09-26, 6000 ticks): roceiro 24
milho de 1 tile; canavial 8 com 12 tiles e 8 com 1.

O que a medida diz (verificado nas tabelas acima):
- Com C = 150 **nenhuma** regra de escolha faz 12 tiles renderem mais que 1: o
  canavial de 1 tile ja da 8, igual a antes. O gargalo e o roceiro — uma ida por
  unidade colhida —, nao o tile esperando crescer. O BUG-O, com C = 150, deixa de
  ser perda de vazao e fica so a espera visivel de um tile.
- 12 > 1 so aparece com C grande (1500: 6 contra 4 em 6000; 16 contra 11 em 20000).
- O rodizio semeia o anel inteiro antes da primeira colheita. Na fazenda de 37
  tiles a primeira saida e no tick 5051 (antes: ~500) e o milho cai de 24 para 5
  em 6000 ticks. Isso quebra a F19 (cadeia do pao) — regressao de feature passada.
- Quebram 11 testes com o modelo novo (lista no PROGRESS). Os da F18/F-T3 afirmam
  o plantio dentro do predio, tick a tick; os da F19 e da F-CANA sao de vazao.

Decisao que espera o operador: ver PROGRESS.md, "F-CAMPO-a reprovou".
