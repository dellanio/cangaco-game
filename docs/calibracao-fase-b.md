# Calibração da Fase B — cadeia de comida (2026-09-25)

Texto do diário de balanceamento para o lote da cadeia de comida, escrito em
arquivo próprio porque `BALANCE_LOG.md` estava sendo editado por outra sessão
no mesmo dia. O operador faz o merge para o diário.

Branch: `calibracao-fase-b`. Arquivos alterados: `data/production.json`,
`data/resources.json` e uma asserção em `tests/F19-cadeia-do-pao.test.ts`.

---

## A frase que resume

**A taxa de 2014 pressupunha que colher era o ciclo todo.** `farm.sai.corn 1.22`
(medição da comunidade) era o intervalo de *entrega* do jogo original, onde o
fazendeiro já andava até o campo e semeava. A F18 pôs o plantio e a F-T3 pôs a
caminhada em cima desse número, e a colheita sozinha (246 ticks) passou a ocupar
o ciclo inteiro do moinho (246). A fazenda ficou 75 % mais lenta que o moinho
por construção, e nenhum ajuste de reposição, alcance ou tiles fecha isso.

---

## Como foi medido

`tools/sim.js` não tem cenário com fazenda (o oráculo é madeira e pedra), e
`tools/` estava fora do escopo desta branch. A medição usou um runner de
scratchpad que espelha o `sim.js` (mesmo `vite.ssrLoadModule`) e monta o
`cenarioDaCadeiaDoPao` de `tests/helpers/producao-cenario.ts` com o dado
sobrescrito em memória, mais um segundo cenário: fazenda na vila
(`cenarioDeFazendaSemCampo`), moinho e padaria na mesma rua, Bodega, e um
`PlowField` de 4 tiles a 3 a 6 tiles da fazenda, arado por um laborer. Prova de
sessão, não cobertura contínua: a proteção permanente é o teto e o piso de
`tests/F19-cadeia-do-pao.test.ts`, que derivam do dado.

---

## Diagnóstico: onde o tempo do roceiro vai

Ticks por milho entregue, medidos em 24 000 ticks, com o dado de antes:

| Fase | Campo longe (cenário F19) | Campo colado (vila) |
|---|---|---|
| colhendo no tile (`ticksDoCiclo`) | 243 | 239 |
| ida + volta ao tile | 103 | 99 |
| plantando (300 ÷ 4 milhos do tile) | 78 | 75 |
| comer / reocupar | 10 | 11 |
| **por milho entregue** | **432** | **424** |
| moinho em `esperando_insumo` | 43 % | 42 % |
| padaria em `esperando_insumo` | 43 % | 42 % |

O que isso alimentava: uma vila 1 Roçado : 1 Moinho : 1 Padaria sustenta 20
civis. Com 27 (os 6 iniciais mais os 20 que o ouro inicial treina) ela **morre
inteira** em 36 000 ticks: primeira morte no tick 26 400, e é o roceiro. Sem
roceiro não há milho, e no fim não há um civil vivo. Não é "alimenta pouco", é
colapso, porque quem come primeiro é arbitrário.

---

## A conta dos dois números

Orçamento por milho entregue, com alvo no ciclo do moinho (246 ticks), que é a
proporção 1 Farm : 1 Mill do GDD §4.5:

```
colheita + plantio/4 = 246 − 105 (viagem) − 10 (refeição) ≈ 131 ticks
```

**`resources.json: corn.reposicao.segundos_base` 60 → 30** (300 → 150 ticks)

- Com 60 s o plantio custa 75 por milho, e para caber nos 131 a colheita teria
  de cair a ~56 ticks: mais curta que a caminhada. O jogador veria o roceiro
  andar mais do que colher.
- Com 30 s são 37,5 por milho e a colheita fica em 100. O plantio segue sendo
  fase visível, 1,5× uma colheita (o primeiro ciclo de toda fazenda é de plantio).
- Não é 20 s porque aí o plantio ficaria mais curto que uma colheita.

**`production.json: farm.sai.corn` 1.22 → 3.0** (246 → 100 ticks de colheita)

- 100 + 37,5 + 105 + 10 = ~252 por milho entregue, contra 246 do moinho: a
  fazenda fica 2 % mais lenta que o moinho, do mesmo lado em que a madeira ficou
  na F15b (272,5 contra 273). Milho não se acumula.
- Por que não 2,4: colheita de 125, ~275 por milho, moinho 10 % ocioso.
- Por que não 3,5 ou mais: a colheita ficaria mais curta que a caminhada.

---

## Antes e depois

| | Antes | Depois |
|---|---|---|
| `farm.sai.corn` / min | 1,22 | 3,0 |
| `corn.reposicao.segundos_base` | 60 | 30 |
| colheita (`ticksDoCiclo`) | 246 | 100 |
| plantio (`reposicao.ticks`) | 300 | 150 |
| ticks por milho entregue (longe / vila) | 432 / 424 | 249 / 243 |
| moinho em `esperando_insumo` | 43 % | 2 % |
| padaria em `esperando_insumo` | 43 % | 3 % |
| milho máximo parado no armazém | 1 | 1 |
| primeiro milho, fazenda já ocupada (cenário F19) | 651 | 355 |
| primeiro cuscuz após a ordem de arar (vila) | 1 299 | 1 003 |
| 20 civis, 36 000 ticks | 0 mortes | 0 mortes |
| 27 civis, 36 000 ticks | 27 mortes (todos) | 0 mortes, cuscuz sobrando |
| 39 civis, 36 000 ticks | — | 0 mortes, Bodega vazia 22 % do tempo |
| ciclo fechado de um tile | 300 + 4 × ~351 = ~1 700 | 150 + 4 × ~205 = ~970 |

Uma cadeia 1:1:1 passa a sustentar ~35 civis só com cuscuz (um cuscuz a cada
~130 ticks contra um por civil a cada 4 800), e mais com carne de sol ao lado.

Os ramos que dependem da fazenda voltam a bater com `proporcoesDeReferencia`:
1,63 fazendas dão um milho a cada ~153 ticks contra os 150 que `swine_farm`
pede; 2 fazendas dão um a cada ~125 contra os 150 de `stables`. O `_aviso` da
tabela foi reescrito no próprio dado para dizer isso.

---

## O que NÃO mudou, e por quê

- **`corn.reposicao` não é o parafuso que manda.** Pesa 17 % do tempo do
  roceiro. O "15× a aradura" do diário compara dois números pequenos entre si.
  Baixou de 60 para 30 como parte da conta, não como causa.
- **`corn.aradura.segundos_base` (4,0) fica.** 20 ticks por tile, uma vez na
  vida do tile: 2 % de um ciclo fechado. Irrelevante.
- **`farm.colheita.alcance_tiles` (4) fica.** Com 37 tiles ao alcance o roceiro
  usa **1**, o tempo todo: ele replanta o tile que acabou de secar antes de ir ao
  seguinte (`melhorTileParaPlantio`, mesma ordem da colheita). Alcance decide
  onde a fazenda pode existir, não quanto produz.
- **Número de tiles é irrelevante para a vazão.** 4 tiles na vila deram a mesma
  vazão que 37 no cenário longe (424 contra 432). O roceiro é serial: um tile,
  um ciclo, uma viagem. Mais tiles só importam se um dia houver mais de um
  roceiro por fazenda, e isso é design, não número.
- **A caminhada (~100 ticks por milho) fica na conta de propósito.** Ela é a
  mesma com o campo colado e com o campo longe: é a saída pela porta e o
  contorno do footprint 4×3, não a distância. O original também tinha
  fazendeiro andando, e o 1,22 de 2014 já a incluía. Encurtar `ticksDoCiclo`
  para *esconder* a caminhada seria desfazer a F-T3; o que se recalibrou foi a
  colheita, e a caminhada continua na tela.
- **`corn.rendimentoPorTile` (4) fica.** Dobrar para 8 diluiria o plantio na
  mesma medida que baixar a reposição, mas mudaria a frase de design "quatro
  ciclos de colheita para um de plantio" sem ganho: o mesmo efeito saiu de um
  número que já estava marcado como proposta.
- **Moinho, padaria, `condition.json` e as proporções do GDD ficam.** O alvo é
  a proporção 1:1:1; o que estava fora dela era a fazenda.
- **Pedreira, lenhador e minas não foram tocados.** Têm o mesmo padrão (a F-T3
  pôs a viagem em cima de `ticksDoCiclo`: pedreira 167 → 250-266 medido), mas
  estão fora deste lote, que é a cadeia de comida. Fica para o próximo.

---

## O teste que caiu

`tests/F19-cadeia-do-pao.test.ts:185`, cenário sem moinho, afirmava que o
**último estado do roceiro antes de morrer de fome** é `trabalhando`. Com o
ciclo novo ele morre em `indo_colher`. A intenção escrita no comentário é "a
fazenda continua produzindo enquanto vive", e a linha anterior já prova isso
com milho produzido > 0. A asserção codificava em que fase do ciclo o roceiro
calhava de estar no tick da morte, uma coincidência dos números antigos.
Corrigida (autorização do operador, 2026-09-25) para aceitar qualquer fase
produtiva da F-T3: `trabalhando`, `indo_colher`, `colhendo`, `voltando`. O que
ela exclui continua excluído: `esperando_insumo`, `saida_cheia`, `ocioso` e os
estados de fome.
