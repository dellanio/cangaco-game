# F18d-2 — Estrada planejada na tela (integração)

> Plano de implementação da feature já escolhida pela fila. O critério de aceite
> vem do `BUILD_PLAN.md`, intocado.

**Objetivo:** o tile desenhado (`estradasPlanejadas`, F18d-1b) aparece na tela
distinto do tile de pé, e os roteiros de `tools/shots/` passam a afirmar a ordem
nova: o arrasto **planeja**, o tempo **ergue**.

**Aceite (BUILD_PLAN.md, verbatim):** "o roteiro afirma, no mesmo cenário,
**planejados** subindo no arrasto e **de pé** subindo depois — a asserção fica
mais estrita que a de hoje, não só diferente, e a soma fecha. Screenshot com os
dois estados na mesma tela."

**Evidência:** `test-output/F18d-2-shot.json` + `screenshots/F18d-2-*.png`.

---

## Restrições globais

- **Esta é a exceção de integração da §10** — escrita na Nota do item. Ela vale
  **só aqui**. `sim/` recebe **nada de regra nova**: se uma regra aparecer, é
  sinal de que a F18d-1b ficou incompleta, e aí é parar e reportar.
- O render **pergunta, não decide** (§3). Quem sabe onde há ligação diagonal é
  `pontesDiagonais(state)`, de `sim/estradas.ts`.
- Nada de número de balanceamento em `.ts`; cor vem de `data/theme-sertao.json`.
- Roteiro afirma estado e medição, nunca pixel (§8).
- Proibido afrouxar asserção para passar. Toda asserção migrada fica **mais
  estrita** (afirma as duas fases) ou o roteiro para e reporta.

## Decisões de desenho (e por quê)

**D1 — Uma camada só, devolvendo os dois números.**
`CamadaDeEstradas.atualizar` passa a devolver `{ dePe, planejadas }` em vez de
um inteiro. Duas camadas independentes poderiam desenhar estados de ticks
diferentes; uma só lê o mesmo `GameState` e o cache de diff mora num lugar.

**D2 — O canteiro não ganha ponte diagonal.** A ponte (F18e) é o desenho de "há
passagem por aqui". Tile planejado não liga nada — desenhar a ponte nele seria o
render afirmando uma ligação que a sim nega. `pontesDiagonais` continua lendo só
`estradas`, e ninguém reimplementa a regra da quina.

**D3 — O canteiro é a mesma terra, translúcida, com contorno.** Fill `terra` com
alpha baixo + `strokeRect` em `terraQueimada`: lê-se como "aqui vai rua, ainda
não é rua", e não inventa cor fora da paleta do tema. Distinguível na captura sem
depender de pixel: quem afirma é a contagem publicada.

**D4 — O roteiro do aceite é novo (`tools/shots/F18d-2.js`), e o F08 migra.** O
F08 é o roteiro da ferramenta de estrada e tem o texto "o custo SAI no comando",
que virou **falso**: ele é corrigido aqui, com asserção mais estrita (as duas
fases), porque roteiro que afirma o texto substituído codifica o defeito.

**D5 — Esperar a rua ficar de pé é um helper compartilhado.** `erguerRua` em
`tools/shots/_estradas.js`: avança o relógio em blocos até `planejadas === 0`,
com teto, e **falha reportando os dois contadores**. Nenhum roteiro escreve o
laço de espera à mão, e nenhum "espera N ticks" chutado entra no repositório.

---

## Tarefas

### Tarefa 1 — a camada do canteiro e o contador publicado (só `render/`)

- `src/render/estradas.ts`: `atualizar` devolve `ContagemDeEstradas`
  (`{ dePe, planejadas }`); o diff passa a considerar `estradasPlanejadas`
  também; o canteiro é desenhado com fill translúcido + contorno, **sem ponte**.
- `src/render/debug.ts`: `estradasPlanejadasRenderizadas: number`.
- `src/render/scenes/WorldScene.ts`: escreve os dois campos.
- Verificação: `npm run typecheck`/`lint` e um roteiro qualquer que já existia
  continua subindo a cena sem erro de console (`npm run shot -- F04`, código de
  saída).

### Tarefa 2 — `tools/shots/_estradas.js`

`erguerRua(ctx, { tiles, teto })`: lê `estradasPlanejadasRenderizadas` e
`estradasRenderizadas`, avança em blocos de 10 ticks até planejadas chegar a 0
ou estourar o teto, afirma `dePe === tiles` e devolve `{ ticks }`. Mensagem de
falha com os dois contadores e o tick.

### Tarefa 3 — `tools/shots/F18d-2.js`, o roteiro do aceite

Um cenário só, com a rua do F08 (geometria vinda dos JSON):

1. abre: `dePe === 0` e `planejadas === 0`;
2. arrasta e solta: `planejadas === tiles`, `dePe === 0`, **Pedra do HUD
   intacta** (o comando reserva, não gasta) — captura `canteiro-desenhado`;
3. avança um bloco curto: existe um momento com `dePe > 0` **e**
   `planejadas > 0`, e `dePe + planejadas === tiles` — captura
   `metade-erguida`, que é a "screenshot com os dois estados na mesma tela";
4. `erguerRua`: `dePe === tiles`, `planejadas === 0`, e a Pedra caiu
   exatamente `tiles × custoStonePorTile` — captura `rua-de-pe`.

A soma `dePe + planejadas === tiles` é afirmada em **todos** os passos: é ela que
fecha a conta e impede que um tile suma entre os dois conjuntos.

### Tarefa 4 — migrar o F08 e o F18e (os roteiros da ferramenta)

- F08: o cabeçalho perde "o custo SAI no comando"; o passo 3 vira duas fases
  (soltar → planejado e Pedra intacta; `erguerRua` → de pé e Pedra caída); os
  passos 4–6 (demolir, sair do canvas, Esc) passam a afirmar **os dois**
  contadores, porque "não construiu nada" agora tem dois jeitos de ser falso.
- F18e: idem para a diagonal.

### Tarefa 5 — migrar os 9 roteiros que usam a rua como cenário

`F10`, `F11a`, `F13b`, `F16b`, `F17`, `F17b`, `F17d`, `F17e`, `F22`. Um a um,
rodando cada um antes de passar ao próximo. Regra: onde a rua é **precondição**
do que o roteiro mede, entra `erguerRua` logo depois do arrasto; onde a
asserção só conferia que o arrasto funcionou, ela vira a asserção do canteiro
(mais próxima do que o passo realmente prova) **mais** a soma.

Risco conhecido e a medir: erguer a rua consome ~10 ticks por par de tiles, e
esses ticks também andam com a obra e com os serfs do cenário. Se algum roteiro
depender do tick em que estava, o número dele é **remedido**, nunca estimado — e
o que mudou vai para o `PROGRESS.md`.

### Tarefa 6 — evidência, PROGRESS, `test-results.json`, commit

- `npm run shot -- F18d-2` verde; abrir com Read **só** as capturas desta
  feature (§8), e conferir os outros roteiros pelo **código de saída**.
- `npm run verify` verde.
- `PROGRESS.md`: o que mudou no render, o que cada roteiro migrado passou a
  afirmar, os números remedidos e o que ficou aberto.
- `test-results.json` dentro da janela de 15 min do selo, e commit.
