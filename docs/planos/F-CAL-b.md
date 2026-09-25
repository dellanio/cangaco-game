# F-CAL-b — as quatro afirmações do aceite (plano)

> Plano de implementação do sub-item `F-CAL-b` do `BUILD_PLAN.md`. O critério de
> aceite é o que está escrito lá; este documento não o reescreve. O que ele faz é
> registrar o que foi **medido antes de escrever código**, e por que a feature foi
> quebrada em dois sub-itens no meio da sessão (2026-09-25, branch `fable-lote-sim`).

**O que a F-CAL-a deixou:** `tests/helpers/cal-vila.ts` (`vilaDaCalibracao` +
`comandosDaVilaNoTick`), a vila fechada no tick 7148, o Moinho ocupado em 4062, a
Padaria em 5392, e um sinal contrário ao item (c): **corn 14** no armazém no tick
7148.

**Ordem do operador para esta sessão (palavras dele):** *"Meça antes de corrigir:
separe rampa de regime. [...] Se o milho estabilizar num patamar depois disso, esse
patamar é o critério novo e o aceite se reescreve com a medição ao lado. Se crescer
sem parar, é a fazenda produzindo mais do que a cadeia consome — balanceamento, e eu
decido. Não gire número sem eu ver."*

---

## 1. Medido antes de planejar (duas sondas `zz-`, apagadas; os números ficaram)

Sonda 1: a vila da F-CAL-a por **36 000 ticks**, os 13 de ouro que sobram dos 20
treinando serfs depois que a vila fecha, janela de 1000 ticks para separar rampa de
regime. Sonda 2: as fases do roceiro por milho na abertura **e** no cenário "longe"
do doc (`cenarioDaCadeiaDoPao`, F19), mais um traço tick a tick do roceiro.

| Fato | Medido |
|---|---|
| milho no armazém, a cada 1000 ticks de 12 000 a 36 000 | 29, 31, 34, 37, 40, 42, 46, 49, 51, 54, 58, 62, 63, 66, 70, 73, 76, 78, 82, 85, 87, 90, 94, 96, **99** |
| inclinação depois do tick 12 000 | **+3 por 1000 ticks, constante** — não é rampa, é regime |
| milhos produzidos por janela de 1000 (regime) | 7 (às vezes 6 ou 8) |
| loaves produzidos por janela de 1000 (regime) | 8 = 4 ciclos do moinho × 2,44/1,22 |
| intervalo entre milhos (regime, > 12 000) | **143,2** médio; padrão 103, 103, 103, 253 |
| ciclo do moinho (`receitas.mill.ticksDoCiclo`) | **246** |
| (a) intervalo dentro de ±10 % de 246? | **NÃO** — 143 é 58 % do ciclo |
| (b) moinho / padaria em `esperando_insumo` | **41 / 28 ticks** em ~31 000 ocupados (0,13 % / 0,09 %); **zero** depois de 12 000 |
| (c) milho nunca acima de 1? | **NÃO** — máximo 99, e sobe sem parar |
| (d) mortes em 36 000 ticks, 26 civis (6 + 20 do ouro) | **zero**; 110 loaves sobrando no armazém |
| recusas de comando em 36 000 ticks | **zero** |
| custo de parede da corrida | 9,7 s isolada (36 000 ticks; 270 ms/1000) |

**As fases do roceiro por milho — a tabela do doc, refeita nos dois cenários:**

| Fase | Longe (`cenarioDaCadeiaDoPao`, F19) | Abertura (`vilaDaCalibracao`) |
|---|---|---|
| colhendo | 100 | 100 |
| ida ao tile (`indo_colher`) | 54,4 | **1** |
| volta (`voltando`) | 50,5 | **1** |
| plantando (150 ÷ 4) | 36,1 | 32–37 |
| transição (`trabalhando`) | 1,3 | 1,2 |
| **por milho** | **247,4** | **135,6 – 143,2** |

## 2. O que estes números decidem

- **Rampa contra regime, respondido: é regime.** A hipótese da F-CAL-a ("14 pode ser
  acúmulo de quando ninguém moía") está **morta**: depois que o Moinho ocupa (4062) o
  milho continua subindo +3 a cada 1000 ticks até o fim, e o moinho passa 100 % do
  tempo em `trabalhando` de 12 000 em diante. A fazenda entrega ~7 milhos por 1000
  ticks e o moinho consome ~4 (1 por 246). A diferença é o que se acumula.

- **O termo que mudou é exatamente o que o item dizia que podia mudar: a caminhada.**
  No doc ela vale ~105 por milho e a calibração de `farm.sai.corn` 1,22 → 3,0 foi
  feita **com ela na conta** (100 + 37,5 + 105 + 10 ≈ 252 ≈ 246). Na abertura ela
  vale **2**. O traço tick a tick mostra por quê: o roceiro fica em
  `colhendo (37,33)` — **o tile da porta, na rua** — sem dar um passo. O campo
  começa em y=34, a Chebyshev 1 da porta, e `alvosDeAproximacao`
  (`src/sim/aproximacao.ts:43-53`) põe *"o próprio tile primeiro (custo zero para quem
  já está nele), depois os oito vizinhos andáveis"*: a porta é vizinha do tile e
  custa zero, então o A* a escolhe. É a regra da F-T3 funcionando como foi escrita
  (*"o alvo é o tile MAIS os oito vizinhos"*), não defeito — mas a consequência é que
  **campo colado à porta tem caminhada zero**, e a frase do doc *"a caminhada é a
  mesma com o campo colado e com o campo longe: é a saída pela porta e o contorno do
  footprint, não a distância"* está **falsa**: no cenário longe o campo fica ao NORTE
  da fazenda e o roceiro contorna o footprint (7 tiles, 54 ticks cada perna); na
  abertura o campo fica ao SUL, na porta, e não há contorno.

- **Isto é balanceamento, e a decisão é do operador.** Ele antecipou este ramo
  ("se crescer sem parar... eu decido. Não gire número sem eu ver"). Nenhum número
  girado, nenhum aceite reescrito. As saídas que a medição deixa prontas estão no
  `BALANCE_LOG.md` (entrada de 2026-09-25) e na Nota do item.

## 3. Quebra em dois sub-itens (CLAUDE.md §6: "não improvise")

Duas das quatro afirmações passam **e continuam passando em qualquer das saídas de
balanceamento** — (b) porque o moinho fica ainda mais alimentado, (d) porque 26
civis já sobrevivem com 110 de sobra. As outras duas dependem de decisão que não é
minha. Entregar as duas que dependem como estão seria commitar teste vermelho;
afrouxá-las seria girar o aceite sem o operador ver.

- **F-CAL-b1 (esta sessão)**: a corrida de 36 000 ticks no `tests/`, com as **quatro**
  medidas gravadas em `test-output/F-CAL.json` (a tabela por fase do roceiro e as
  quatro afirmações com o valor medido e `passa`), e as **duas** asserções que não
  dependem da decisão: (b) e (d). Mais zero recusa e população = 6 + 20.
- **F-CAL-b2 (depois da decisão do operador)**: as asserções (a) e (c), com o texto
  que a decisão fixar. Cabe em uma sessão curta: é acrescentar dois `it` sobre a
  mesma corrida.

## 4. Tarefas da F-CAL-b1

1. `tests/F-CAL-b-calibracao.test.ts`: um `beforeAll` roda a corrida uma vez (36 000
   ticks, `timeout` explícito: **9,7 s medidos isolados**, ~2,2× dentro da suíte pela
   razão da F-CAL-a); os `it` leem a medição. `timeout` não é asserção de tempo (§8).
2. `BALANCE_LOG.md`: a entrada com longe / abertura / a causa em `aproximacao.ts` e
   as saídas.
3. `BUILD_PLAN.md`: o item vira b1 + b2, aceite intacto, Nota com a medição.
4. `docs/calibracao-fase-b.md`: a frase falsa sobre a caminhada marcada no próprio
   arquivo (premissa morta se marca no dado, não só no diário).
5. Sondas `zz-` apagadas. `npm run verify`, `test-results.json`, commit.
