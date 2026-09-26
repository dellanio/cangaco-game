# F-VIVO-b — O trabalho: laços por caso (plano)

Critério: `BUILD_PLAN.md`, "Aceite da F-VIVO-b", intocado. Só `src/render/`, testes e
roteiro: **nada em `sim/`** (regra comum da F-VIVO). Sem arte: sem PNG, o quadro é um
retângulo na `area`, com `<laco>_<n>` escrito (regra comum dos sub-itens). O corpo do
prédio fica como está hoje.

## O que a sim oferece (conferido em `sim/systems/especialistas.ts`)

- `producao.progresso` vai de 0 a `ticksDoCiclo`, com +1 por tick de trabalho.
- O rótulo da FSM do ocupante é recalculado a cada tick:
  - `trabalhando` é o relógio dentro do prédio (casos 3, 4 e 5);
  - `colhendo` é o relógio no tile (casos 1 e 2, F-T3);
  - `esperando_insumo` é a falta de insumo;
  - `saida_cheia` é a gaveta cheia;
  - `indo_colher`, `voltando` e `indo_ocupar` são caminhada.
- Pausado: `predio.pausado`. O rótulo continua `trabalhando` (F16c), e por isso a
  pausa se lê no prédio, não na unidade.
- **Achado**: no caso 2 (pedreira, canavial) o relógio anda com o trabalhador **no
  tile** (`colhendo`). A sim não tem uma fase "dentro". O aceite manda o caso 2 pelos
  terços do `progresso`. Então o laço aparece no prédio enquanto o trabalhador está no
  campo. Sigo o aceite à letra e registro a pergunta.

## Desenho

`src/render/trabalho.ts`, puro, só `import type`, como `pilhas.ts`:

- `quadroDeTrabalho(predio, unidade, tick, dados)` devolve `{ laco, n } | null`.
  - **Anima** se: o prédio está completo e não pausado, tem `producao`, o ocupante é
    essa unidade, o rótulo dela é `trabalhando` ou `colhendo` e
    `progresso < ticksDoCiclo`. Fora disso, devolve `null`.
  - O quadro sai do `progresso`, nunca do relógio de parede. `TICKS_POR_QUADRO = 1`: um
    quadro por tick, 8 quadros em 0,8 s. A repetição sai de `ticksDoCiclo`:
    - k = max(1, ⌊T / (F·TPQ)⌋);
    - índice = ⌊p·k·F / T⌋.
    Como k·F ≤ T, o índice sobe no máximo 1 por tick: sem pulo.
  - Caso 2: os terços são ⌊T/3⌋ e ⌊2T/3⌋. `inicio` e `fim` tocam uma vez cada, esticados
    no seu terço, e `meio` se repete k vezes no terço do meio.
  - Casos 3 e 5: k laços que alternam `laco1` e `laco2`.
  - Caso 4: `luz`, 4 quadros, k vezes.
  - Caso 1: sempre `null`.
  - O `tick` não entra: o quadro vem do `progresso`, e é isso que garante que o prédio
    parado não anima. O parâmetro fica com `_` para manter a assinatura do aceite.
- `quadroDaFumaca(predio, unidade, tick, dados)` devolve `n` de 1 a 8, ou `null`. Só
  anima se o prédio declara `ancoras.trabalho.fumaca` e está animando pelo mesmo
  predicado. No caso 1, o predicado é o do ocupante no ciclo. Aqui o `tick` entra,
  porque a fumaça não tem ciclo.
- `areaDoTrabalho(ancoras)`: a declarada, ou a padrão `[0.30, 0.35, 0.70, 0.75]`, que
  fica acima da linha das pilhas (y = 0,92).
- O dado vem do funil `predios.ts`: `dadosDoTrabalho(manifesto)` =
  `{ casos: CASO_DO_PREDIO, ticksDoCiclo, ancoras }`.

Cena:
- `atualizarPredios` calcula o quadro e o põe na assinatura, junto com a pilha. O
  retângulo, ou o PNG `trabalho:<tipo>:<laco>_<n>` quando existir, vai na `area`.
- `debug.quadrosDeTrabalho[id] = { laco, n, sprite }`.

## Aceite

- `tests/F-VIVO-b-trabalho.test.ts`:
  - por caso, a sequência de um ciclo inteiro;
  - o `null` nos quatro estados parados: sem ocupante, sem insumo, saída cheia e
    pausado;
  - `n` avança 0 ou +1 e volta a 1 sem pulo, nas 21 receitas reais;
  - a tabela de casos contra o dado, com um caso que reprova para cada troca de caso:
    - serraria que passa a colher;
    - pedreira que deixa de colher;
    - mina que deixa de colher de dentro;
    - criação sem o animal;
  - uma pedreira real (cenário da F15a) anima no `colhendo` e não anima no
    `esperando_insumo`. Isso confere os rótulos contra a sim.
- `tools/shots/F-VIVO-b.js`:
  1. A pedreira ocupada pelo caminho do jogador (`_pedreira.js`).
  2. Despausa 3 s e amostra a cada 250 ms: ≥ 2 quadros distintos.
  3. Pausa o prédio pelo painel (`data-pausar`), despausa 3 s: nenhum quadro.
  4. Captura.

## Fora

A arte, a F-VIVO-c (animais) e a F-VIVO-d.
