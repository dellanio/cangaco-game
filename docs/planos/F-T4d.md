# F-T4d — O pescador sai para a água, em partida (plano)

> Plano do item `F-T4d` do `BUILD_PLAN.md` (escrito nesta sessão, 2026-09-25, branch
> `fable-lote-sim`, a pedido do operador). O pescador tem `colheita` desde a F-T4a e
> a água existe desde a F-T1, mas ele só foi exercitado em FIXTURE
> (`cenarioDePescador*`, cabana injetada e ocupada à mão). O pedido: **medir antes de
> planejar** — em partida, ele anda até a margem? colhe? o cardume esgota? e o que
> acontece com o prédio quando o último cardume ao alcance seca — o caminho do veio
> esgotado da F21b, ou outro? *"Se já funcionar inteiro, a feature é a medição e o
> guarda permanente. Não invente trabalho para preencher o item."*

---

## 1. Medido antes de planejar (sonda `zz-`, apagada; os números ficaram)

Cenário: a abertura da Fase A (`aberturaDaFaseA` + `comandosNoTick`) mais a Casa do
Pescador **por comando** — a posição NÃO é digitada: varredura por `canPlace` das
caixas com porta na rua da abertura, escolhendo a que tem mais cardume alcançável
(`tileAlcancavelParaColheita`) ao alcance — e o treino do pescador. Rendimento do
peixe sobrescrito para **1 por tile** (`comRendimentoPorTile`, o mesmo andaime da
F-T4a), porque com os 20 do dado o esgotamento levaria ~170 mil ticks.

| Fato | Medido |
|---|---|
| `fishermans` desbloqueia | tick **1236** (a serraria completa) |
| a cabana cabe em (31,27) com a porta na rua do ramo da abertura (x=32) | `canPlace` ok, **31** cardumes ao alcance, **22** com margem no tick 1400 |
| planta / completa / ligada / ocupada | 1236 / 1864 / 1864 / **2086** |
| primeira saída do pescador | 2087, `indo_colher` |
| onde ele pesca | **(28,24)**, Chebyshev **1** do cardume (29,24), tile andável, **não é água** |
| primeiro peixe produzido / no armazém (pela rua) | 2527 / **2647** |
| peixes até secar tudo que tem margem | **19**, o último no tick **10744** |
| depois disso | `esperando_insumo` desde **10745**; `colher` reclamadas: 0 |
| cardumes que sobram ao alcance | **12**, todos com `tileAlcancavelParaColheita === false` — interior de água |
| `vein-exhausted` / alerta `veio-esgotado` | **NUNCA** |
| o que a cabana dizia no fim | `sem-trabalhador` — o pescador **morreu de fome** no tick 14058 (a abertura não tem Bodega; os seis civis iniciais morrem no 12000) |
| recusas de comando | zero |

## 2. O que a medição decide

- **Anda, colhe, entrega, e o regime `nunca` funciona em partida**: tudo o que a F-T4a
  afirmou na fixture vale na abertura, por comando. O peixe chega ao armazém pela rua.
- **A resposta à pergunta do operador é "OUTRO caminho, e é defeito"**: quando o último
  cardume COM MARGEM seca e sobra só interior de água, o pescador para em
  `esperando_insumo` e o prédio **fica mudo** — nem o evento nem o alerta da F21b.
  Causa, lida no código: a escolha do tile (`especialistas.ts:228`) filtra por
  `tileAlcancavelParaColheita`, e `semRecursoAoAlcance` (`producao.ts:105`), que
  alimenta o alerta `veio-esgotado` (F22) e o evento `vein-exhausted`, **não** — conta
  os 12 tiles de interior como "recurso ao alcance". É o predicado de elegibilidade
  discordando de si mesmo nos dois lados, a mesma classe que a F-T2c consertou no eixo
  da quantidade, agora no eixo da aproximação. Rocha e milho se pisam e nunca sentiram
  a diferença; água sente.
- **Não é lacuna de aceite de outra feature, é a pergunta desta**: o item da F-T4d
  pergunta exatamente "o que acontece com o prédio quando o último cardume ao alcance
  seca". A F-T4a (c) passa porque a fixture dela tinha UM cardume e nenhum interior.
- **A fome não é achado desta feature**: a abertura não tem Bodega, e a F20b diz que o
  civil morre em 12 000 ticks. A janela da medição (ocupado 2086 → seco 10745) cabe
  antes disso, e o teste para lá.

## 3. O que a feature entrega

1. **Três linhas de `sim/`**: `semRecursoAoAlcance` (o evento) e `semTrabalhoAoAlcance`
   (o alerta, via `algumTileTrabalhavel`, que ganhou o parâmetro `elegivel`, neutro por
   padrão) passam o mesmo `elegivel` que a escolha usa. Medido em duas etapas: só com a
   primeira, o evento saiu no 10744 e o alerta continuou mudo — o alerta da F22 tem a
   sua própria pergunta (`semTrabalhoAoAlcance`, a "irmã larga" que conta pousio) e ela
   tinha o mesmo defeito. Com as duas, o esgotamento da cabana em partida emite
   `vein-exhausted` e o prédio diz `veio-esgotado` no mesmo tick — **o mesmo caminho da
   F21b**.
2. **O guarda permanente** `tests/F-T4d-pescador-em-partida.test.ts`: a corrida acima,
   posição derivada, rendimento 1, e as afirmações: (a) ele pesca da margem (Chebyshev
   1, andável, não água) e o peixe chega ao armazém; (b) os cardumes com margem secam e
   **saem** do estado, os de interior **ficam**; (c) no tick do último peixe o prédio
   emite `vein-exhausted` UMA vez, diz `veio-esgotado`, o pescador fica no mesmo estado
   de espera do mineiro da F21b (afirmado contra o cenário dela, não contra o rótulo) e
   nada fica reclamado; (d) a propriedade que o defeito violava: em todo tick da
   corrida, `semRecursoAoAlcance` é verdadeiro **se e só se** a escolha do tile devolve
   `null` — provado que acusa: com o `elegivel` neutro no lugar, o teste reprova.
3. Evidência `test-output/F-T4d.json` com os marcos e a tabela acima.

## 4. Fora do escopo

- A Bodega da abertura (a fome mata todo mundo no 12 000): é o cenário da F-CAL, não
  desta. O teste para antes.
- A cabana com **só** interior ao alcance desde o nascimento (lago grande): a F-T4a (d)
  já cobre a escolha; com a correção, o alerta apareceria no tick 1 — comportamento
  certo, e não é afirmado aqui para não inventar cenário.
- `algumTileTrabalhavel` (o alerta `sem-campo` do Roçado) tem a mesma forma e continua
  sem o filtro de aproximação: milho se pisa, e um tile de milho debaixo de footprint é
  o caso da nota herdada da F18, não desta feature. Registrado, não tocado.
