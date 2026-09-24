# F18e — Estrada diagonal — plano de implementação

> **Para quem executa:** os passos usam caixa (`- [ ]`) para acompanhamento.
> Uma tarefa por vez, com teste e commit próprios.

**Objetivo:** a estrada liga em 8 direções, **sem cortar quina de prédio**, e o
arrasto desenha a diagonal em vez da escadinha ortogonal. Sem isso a rua perde
para a grama acima de ~34° e a F18d (entrega de construção em modo livre)
tornaria a estrada opcional em metade dos traçados.

**Arquitetura:** a regra da quina já existe no A* de `sim/pathfinding.ts` para o
modo `'livre'` (`andavel(nx,y) && andavel(x,ny)`), mas hoje ela é avaliada
contra o **mapa de estradas** quando o modo é `'estrada'` — e por isso a
diagonal de rua só existe dentro de um bloco 2×2. A correção é uma só: o passo
diagonal passa a exigir que as duas quinas **não estejam bloqueadas por
prédio**, em qualquer modo. O índice de componentes de `sim/estradas.ts` passa a
usar exatamente o mesmo predicado, que é o que mantém verde a equivalência
*"por estrada, o A* acha caminho se e somente se `isConnected` acha"*.

**Stack:** TypeScript estrito, Vitest, Playwright. Sem dependência nova.

**Fila:** F18e, item em `BUILD_PLAN.md:1102`. Aceite e Notas vêm de lá, intocados.

## Restrições globais

- `src/sim/` não importa `phaser`, não toca `window`/`document`, não usa
  `Math.random()`/`Date.now()`.
- Nenhum número de balanceamento em `.ts`: o custo do passo diagonal já vem de
  `data/time.json` × `data/terrain.json` via `loader.ts` (`ticksPorTileDiagonal`).
- **Esta feature toca `src/sim/`, `src/input/` e `src/render/`.** A §10 do
  CLAUDE.md exige que a exceção esteja escrita no item da fila: a Tarefa 0
  escreve a nota **antes** de qualquer código.
- O índice de estradas continua sendo memoização de função pura: o `WeakMap` não
  entra no `GameState` e não muda resultado nenhum.

## Decisão de projeto que o item não fixava

O aceite escrito diz que dois tiles em diagonal **não** ligam "quando os dois
ortogonais entre eles estão ocupados". O escopo, na frase anterior, manda usar
"a mesma regra que o A* já usa em modo `'livre'`" — e essa é **mais estrita**:
basta **uma** quina bloqueada para proibir o passo. Implemento a mais estrita,
que satisfaz o aceite escrito e o torna um caso particular; os dois casos (uma
quina, duas quinas) viram teste. Registrado em `PROGRESS.md` como refinamento do
aceite, não como mudança dele.

Consequência de assinatura: conectividade passa a depender de **prédios**, não
só de `estradas`. `indiceDeEstradas(estradas)` vira `indiceDeEstradas(state, dados)`
e a memoização passa a ser por par (`estradas`, `predios.ordem`) — a mesma chave
que `footprintsDe` de `pathfinding.ts` já usa, que só muda quando um prédio
nasce ou morre, não a cada tick de obra.

## Arquivos

- Modificar: `BUILD_PLAN.md` (nota de integração), `data/terrain.json`
  (`bonusVelocidade` sai), `src/sim/pathfinding.ts` (predicado da quina),
  `src/sim/estradas.ts` (índice e BFS em 8 vizinhos), `src/sim/jobs.ts` e
  `src/sim/selectors.ts` (assinatura), `src/input/arrasto.ts` (linha 8-conectada),
  `src/render/estradas.ts` (o vínculo inclinado).
- Testes: `tests/F08-estradas.test.ts` (reescrita da diagonal),
  `tests/F08-arrasto.test.ts` (reescrita da escadinha), `tests/F10-astar.test.ts`
  (oráculo + equivalência com prédios), `tests/F18e-diagonal.test.ts` (novo).
- Roteiro: `tools/shots/F18e.js` (novo).

---

### Tarefa 0: a nota de integração no item da fila

- [ ] **Passo 1:** acrescentar ao item `### F18e` do `BUILD_PLAN.md` a nota
      **"esta é uma feature de integração"**, com o motivo (o arrasto é `input/`,
      a ligação é `sim/`, o tile inclinado é `render/`, e desenhar a diagonal sem
      ligá-la seria mentira na tela) e a validade (vale só aqui, não se herda).
- [ ] **Passo 2:** trocar a nota do `bonusVelocidade` de "pendente de decisão"
      para a decisão do operador de 2026-09-23: apaga nesta feature.
- [ ] **Passo 3:** commit `docs(F18e): a nota de integração, antes do código`.

### Tarefa 1: a quina no A* — a diagonal de estrada passa a existir

**Arquivo:** `src/sim/pathfinding.ts` (dentro de `executarComRascunho`).

- [ ] **Passo 1: teste que falha** em `tests/F18e-diagonal.test.ts`:
      dois tiles de estrada só em diagonal — `buscarCaminho(..., 'estrada')`
      devolve caminho de custo `ticksPorTileDiagonal.aPe.estrada`; com prédio
      numa das quinas, `null`.
- [ ] **Passo 2:** `npx vitest run tests/F18e-diagonal.test.ts` → FAIL (`null`).
- [ ] **Passo 3:** trocar o teste da quina por um predicado próprio:

```ts
// A quina e a mesma regra nos dois modos: o que proibe o passo diagonal e
// PREDIO na quina, nao "a quina nao ser estrada" — senao a rua so viraria em
// bloco 2x2 e a estrada diagonal (F18e) nao existiria.
const quinaLivre = (x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= largura || y >= altura) return false;
  const i = y * largura + x;
  return bloqueado[i] === 0 || liberados.has(i);
};
```

      e usar `if (diagonal && !(quinaLivre(nx, y) && quinaLivre(x, ny))) continue;`.
      Em modo `'livre'`, `quinaLivre` é literalmente o `andavel` de hoje — nada muda.
- [ ] **Passo 4:** `npx vitest run tests/F18e-diagonal.test.ts` → PASS.
- [ ] **Passo 5:** `npx vitest run tests/F10-astar.test.ts` → a equivalência
      **falha** aqui de propósito (o A* liga o que `isConnected` ainda desliga).
      É a Tarefa 2 que a fecha; não afrouxar o teste.

### Tarefa 2: o índice de componentes em 8 vizinhos

**Arquivo:** `src/sim/estradas.ts`.

- [ ] **Passo 1: teste que falha** — reescrever `tests/F08-estradas.test.ts:254`
      (*"diagonal NAO liga"*) para a regra nova, mantendo o título honesto
      (`diagonal liga; a quina de predio corta`), com os três casos: diagonal
      limpa liga; uma quina com prédio não liga; duas quinas com prédio não liga.
- [ ] **Passo 2:** rodar → FAIL.
- [ ] **Passo 3:** `VIZINHOS` vira 8 direções; `construirIndice` e
      `buscarDistancia` recusam o passo diagonal quando qualquer quina é prédio.
      `indiceDeEstradas(state, dados)` memoizado por (`estradas`, `predios.ordem`);
      `componenteDe(state, tile, dados)`; `distanciaPorEstrada` recebe `state`.
      Propagar em `jobs.ts:279-280` e `estradas.ts:231` (`predioLigadoAoArmazem`).
- [ ] **Passo 4:** rodar `F08-estradas`, `F10-astar`, `F09-*`, `F15b-*` → PASS.
      A equivalência da Tarefa 1 fecha aqui.
- [ ] **Passo 5:** no `tests/F10-astar.test.ts`, o oráculo passa a usar o mesmo
      predicado de quina (`!bloqueados.has(...)`), e a propriedade da
      equivalência ganha `predios: sorteio(4)` — **mais estrita** que hoje
      (`predios: 0`), porque passa a exercitar a quina nos dois lados.
- [ ] **Passo 6:** commit `feat(F18e): a estrada liga em diagonal, sem cortar quina`.

### Tarefa 3: o arrasto desenha a diagonal

**Arquivo:** `src/input/arrasto.ts`.

- [ ] **Passo 1: teste que falha** — em `tests/F08-arrasto.test.ts`, trocar
      *"em diagonal sai uma escada"* por *"em diagonal sai a linha inclinada"*:
      `tilesEntre(t(0,0), t(3,3))` tem 4 tiles; e na propriedade de 500 pares,
      `toHaveLength(Math.max(|dx|,|dy|) + 1)` com vizinhança de Chebyshev 1.
- [ ] **Passo 2:** rodar → FAIL (7 tiles).
- [ ] **Passo 3:** no laço de `tilesEntre`, o empate `(1+2ix)·ny === (1+2iy)·nx`
      passa a andar nos **dois** eixos no mesmo passo. Sem ponto flutuante,
      como hoje.
- [ ] **Passo 4:** rodar `F08-arrasto` → PASS.
- [ ] **Passo 5:** commit `feat(F18e): o arrasto interpola em diagonal`.

### Tarefa 4: `bonusVelocidade` sai, e a varredura de dado sem leitor

- [ ] **Passo 1:** sonda no scratchpad: para cada caminho de chave folha dos nove
      `data/*.json`, procurar leitor em `src/`, `tools/` e `tests/`. Contar os
      candidatos sem leitor. É **sonda de sessão**, não cobertura.
- [ ] **Passo 2:** apagar `estrada.bonusVelocidade` de `data/terrain.json` e
      reescrever o `_doc` dizendo onde o bônus real mora (`custoDeMovimento`).
- [ ] **Passo 3:** `npm run verify` — se passa, o campo era morto; essa é a prova,
      igual à do `obrigatoriaParaEntrega`.
- [ ] **Passo 4:** decidir a regra do `validate:data` **com a medição na mão**.
      `validarTudo(dados)` é pura sobre JSON e não enxerga `src/`; uma regra de
      "campo sem leitor" seria varredura **textual** de fonte, que é exatamente o
      guarda que este projeto recusa. Se a sonda confirmar ruído alto, fica como
      observação no `PROGRESS.md`, com o número medido e a alternativa estrutural.
- [ ] **Passo 5:** commit `feat(F18e): bonusVelocidade sai do dado; a varredura medida`.

### Tarefa 5: a remedição do ponto de virada

- [ ] **Passo 1:** teste em `tests/F18e-diagonal.test.ts` que, para um leque de
      ângulos (`dy/dx` de 0 a 1), compara `buscarCaminho(..., 'estrada')` sobre
      uma rua diagonal contra a perna livre pela grama no mesmo par de pontos, e
      afirma que **a estrada ganha em todo ângulo**. Números vêm do `gameData`
      carregado, não digitados.
- [ ] **Passo 2:** rodar; gravar o resultado em `test-output/F18e.json`.
- [ ] **Passo 3:** atualizar `BALANCE_LOG.md`: a observação do empate em ~34°
      fica **fechada** por esta feature, com a medida nova ao lado — e rotulada
      como medida do A*, não aritmética de papel.

### Tarefa 6: o tile inclinado na tela

**Arquivo:** `src/render/estradas.ts`.

- [ ] **Passo 1:** na camada do chão, depois dos quadrados, desenhar o **vínculo**
      de cada par de tiles diagonalmente vizinhos: um losango na quina comum,
      da mesma cor, que fecha o buraco entre os dois quadrados. Só quando a
      ligação existe (nenhuma quina com prédio é problema de `sim/`; o render
      desenha o que `estradas` diz, e a quina de prédio esconde o losango sob o
      prédio de qualquer jeito, que tem `depth` maior).
- [ ] **Passo 2:** roteiro `tools/shots/F18e.js`: arrastar em diagonal, afirmar
      `estradasRenderizadas` igual a `max(|dx|,|dy|)+1` (e **não** à escadinha),
      afirmar o custo em pedra pela diferença de estoque, capturar.
- [ ] **Passo 3:** `npm run shot -- F18e` → EXIT 0, `test-output/F18e-shot.json`.
- [ ] **Passo 4:** abrir o screenshot com Read (é a feature atual) e conferir que
      a rua é uma faixa contínua inclinada, não uma fileira de quadrados soltos.
- [ ] **Passo 5:** não-regressão: `npm run shot -- F08`, `F10`, `F11a`, `F22`
      pelo **código de saída**, sem abrir imagem.

### Tarefa 7: fechar

- [ ] `npm run verify` → EXIT 0.
- [ ] `test-results.json`: `"F18e-estrada-diagonal": { "passes": true }`.
- [ ] `PROGRESS.md`: verificado × decidido, o refinamento do aceite, a
      assinatura nova do índice, a sonda de dado sem leitor.
- [ ] Commit `feat(F18e): estrada diagonal na tela e no grafo`.
