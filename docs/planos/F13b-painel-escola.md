# F13b — Schoolhouse: painel da fila — Plano de implementação

> **Para o executor:** use `superpowers:executing-plans`, tarefa a tarefa. **Não**
> use `subagent-driven-development` nem `dispatching-parallel-agents` — proibidos
> pelo CLAUDE.md §11. Passos usam checkbox (`- [ ]`).

**Objetivo:** clicar na escola abre um painel com os 5 slots da fila, um botão por
tipo de civil e um botão de cancelar por item. O item `aguardando` **diz por que
está parado**, derivado do estado. O painel emite `EnqueueTraining` e
`CancelTraining` (já existentes, F13a) e nunca muta `GameState`.

**Arquitetura:** quatro peças, uma por camada, e nenhuma decisão de jogo fora de
`sim/`.

1. **`sim/selectors.ts`** — `painelDaEscola(state, predioId)` devolve tudo que o
   painel desenha, inclusive o **motivo** de cada item parado. `predioNoTile`
   responde "que prédio está neste tile". Puros, sem estado novo.
2. **`src/input/selecao.ts`** — qual prédio está selecionado. É estado de
   **interface**, como a `ferramenta` da F06: some com `Esc` e **nunca** entra em
   `GameState`.
3. **`src/ui/painel-escola.ts`** — DOM. Lê o seletor, escreve HTML, emite comando.
4. **`tools/shots/F13b.js`** — o roteiro: constrói a rua, enfileira por clique,
   cancela por clique, confirma a fila **no estado** e captura.

**Stack:** TypeScript estrito, DOM puro (sem framework), Playwright para a
evidência visual. Vitest roda em `environment: 'node'` — **não há jsdom**, então
`src/ui/` não tem teste unitário neste projeto: quem prova a interface é o
roteiro. O que dá para testar em Vitest é o seletor, e é lá que a lógica mora.

**Spec:** `BUILD_PLAN.md`, item **F13b** (linhas 296-308). Aceite, textual:
*"screenshot do painel com a fila cheia, e roteiro que enfileira por clique e
confirma a fila no estado"*. Evidência: `screenshots/F13b-*.png`.

---

## Restrições globais

- **Feature de integração.** A Nota do item F13b autoriza tocar `src/ui/`,
  `src/input/` e `src/render/` na mesma feature — é a exceção explícita da §10,
  e **vale só para esta**.
- `sim/` continua puro e determinístico: nada de `phaser`, `window`, `document`,
  `Math.random`, `Date.now`. O que entra em `sim/` aqui é **seletor**, não sistema.
- **Nenhum número de balanceamento em `.ts`**: `slotsDeFila`, `custoOuroPorUnidade`
  e `ticksPorTreino` vêm de `data/economy.json`; a lista de civis vem de
  `data/units.json`.
- **Todo rótulo vem de `data/theme-sertao.json`.** `sim/` não o lê (barrado em
  `eslint.config.mjs`); `ui/` lê, como `hud.ts` e `menu-build.ts` já fazem.
- **O painel não muta estado.** Só emite `Command` pela `sessao`.
- O roteiro não digita número que o JSON também saiba (regra da casa, F06/F08).

---

## Decisões desta sessão

Registrar as quatro em `PROGRESS.md` **e** como Nota no item F13b do
`BUILD_PLAN.md` (contrato que a F14/F16 herdam).

### D1 — o painel abre por clique próprio, não pela ponte de harness

A Nota do BUILD_PLAN manda decidir aqui. **Decisão: clique próprio, mínimo
viável.** Com a ferramenta em `'nenhum'` (nenhuma planta na mão), clicar num tile
ocupado por uma **schoolhouse completa** seleciona o prédio e abre o painel; `Esc`
e clicar fora fecham.

Por quê e não a ponte: a ponte de harness é superfície de teste, não de jogador
(a própria `EstadoDebug` diz isso), e um painel que só abre pelo Playwright não é
a feature. Por que não antecipar a F16: a seleção aqui **só reconhece escola**, e
o painel é específico. A F16 troca `selecao.ts` por seleção genérica e o painel
genérico passa a hospedar este bloco — nada do que existe aqui vira dívida.

### D2 — os dois motivos, e o que eles não distinguem

O estado **permite** separar "ouro a caminho" de "sem ouro", sem campo novo:

- existe tarefa `'ouro-para-escola'` com `destino` = esta escola → **`'a-caminho'`**;
- não existe → **`'sem-ouro'`**.

O sinal é confiável porque `gerarTarefasDeOuro` (`sim/systems/jobs.ts:209-225`) só
cria a tarefa quando `origemMaisPerto` acha um armazém com ouro **não reservado** e
**alcançável por estrada**. Tarefa no quadro = o ouro existe e foi destinado a esta
escola.

**Limitação a registrar:** `origemMaisPerto` devolve `null` por dois motivos
diferentes — não há ouro, ou não há rota (a escola não está ligada ao armazém por
estrada). Os dois caem em `'sem-ouro'` e **leem igual no painel**. Separá-los
exigiria um seletor novo sobre `estradas.ts`; **fora do escopo da F13b**. Por isso
o rótulo do tema é neutro ("Esperando dinheiro"), verdadeiro nos dois casos, e não
"sem dinheiro no armazém", que seria mentira no caso da rota.

### D3 — o motivo é da FILA, não do item

`ouroNecessario` é um agregado da escola (itens `aguardando` × custo − caixa). Não
existe "o ouro deste item". Então **todo item `aguardando` mostra o mesmo motivo**,
que é a leitura literal do que o operador pediu: *"se há demanda de ouro e a escola
não o recebeu, o painel diz que espera ouro"*. Quando `ouroNecessario === 0` (o
ouro já está na gaveta e a escola cobra no próximo tick, ou o item só aguarda a
vez) o motivo é `null` e o painel diz "na fila".

### D4 — progresso é derivado, não guardado

`progresso = (ticksPorTreino − restam) / ticksPorTreino`, em `[0, 1)`. `ItemDeFila`
não ganha campo. Item `aguardando` tem `progresso: 0`.

---

## Estrutura de arquivos

| Arquivo | O quê |
|---|---|
| `src/sim/selectors.ts` | **modificar** — `predioNoTile`, `painelDaEscola`, tipos |
| `tests/F13b-painel.test.ts` | **criar** — o seletor, headless |
| `data/theme-sertao.json` | **modificar** — bloco `painelEscola` |
| `src/input/selecao.ts` | **criar** — o prédio selecionado (interface, não jogo) |
| `src/input/colocar.ts` | **modificar** — ramo do modo `'nenhum'` em `aoClicar` |
| `src/ui/painel-escola.ts` | **criar** — o DOM do painel |
| `index.html` | **modificar** — `<aside id="painel-escola">` + CSS |
| `src/main.ts` | **modificar** — fiação |
| `src/render/debug.ts` | **modificar** — `filaDeTreino` para o roteiro afirmar |
| `src/render/scenes/WorldScene.ts` | **modificar** — publica `filaDeTreino` no POST_RENDER |
| `tools/shots/F13b.js` | **criar** — o roteiro |

**O painel é sobreposição, não coluna nova.** O grid do `index.html` tem duas
colunas (`#jogo`, `#menu-build`) e o roteiro da F06 afirma
`canvas.right <= painel.left`. Uma terceira coluna encolheria o canvas e
**reprovaria a F06**. O `#painel-escola` mora na mesma célula do `#jogo`, com
`place-self`, e some com `hidden`.

---

## Task 1: o seletor `predioNoTile`

**Files:**
- Modify: `src/sim/selectors.ts`
- Test: `tests/F13b-painel.test.ts` (criar)

**Interfaces:**
- Consome: `caixaDoPredio` (`sim/footprint.ts`), já importado em `selectors.ts`.
- Produz: `predioNoTile(state, gx, gy, dados?): string | null` — id do prédio cujo
  footprint cobre o tile, ou `null`. Usado pela Task 6 (`main.ts`).

- [ ] **Step 1: escrever o teste que falha**

```ts
// tests/F13b-painel.test.ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { predioNoTile } from '../src/sim/selectors';
import { gameData } from '../src/sim/data';

const inicial = createInitialState(gameData.economia.estadoInicial.semente);
const escolaDoDado = gameData.economia.estadoInicial.predios
  .find((p) => p.id === 'schoolhouse')!;

describe('F13b — predioNoTile', () => {
  it('acha o predio pelo footprint inteiro, nao so pelo canto', () => {
    const canto = predioNoTile(inicial, escolaDoDado.gx, escolaDoDado.gy);
    expect(canto).not.toBeNull();
    expect(inicial.predios.porId[canto!]!.tipo).toBe('schoolhouse');
    // um tile adiante na diagonal ainda e a escola (ela e maior que 1x1)
    expect(predioNoTile(inicial, escolaDoDado.gx + 1, escolaDoDado.gy + 1)).toBe(canto);
  });

  it('tile vazio devolve null', () => {
    expect(predioNoTile(inicial, 0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F13b-painel.test.ts`
Esperado: FAIL — `predioNoTile` não é exportado por `selectors.ts`.
(Se o nome do arquivo divergir do `include` `tests/**/*.test.ts`, corrija o nome,
não o config.)

- [ ] **Step 3: implementar**

```ts
/**
 * F13b — que predio ocupa este tile. Varre `predios.ordem` (nunca
 * `Object.keys`) e usa o footprint inteiro, nao o canto: clicar no meio de uma
 * escola 3x3 tem que selecionar a escola. `null` em tile vazio.
 */
export function predioNoTile(
  state: GameState, gx: number, gy: number, dados: GameData = gameData,
): string | null {
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    if (predio === undefined) continue;
    const caixa = caixaDoPredio(predio, dados);
    if (caixa === null) continue;
    if (gx >= caixa.x0 && gx < caixa.x1 && gy >= caixa.y0 && gy < caixa.y1) return id;
  }
  return null;
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run tests/F13b-painel.test.ts`
Esperado: PASS (2 testes).

- [ ] **Step 5: commit**

```bash
git add src/sim/selectors.ts tests/F13b-painel.test.ts
git commit -m "feat(F13b): predioNoTile, o seletor que responde o clique no mapa"
```

---

## Task 2: o seletor `painelDaEscola`

**Files:**
- Modify: `src/sim/selectors.ts`
- Test: `tests/F13b-painel.test.ts`

**Interfaces:**
- Consome: `ehEscolaCompleta`, `filaDaEscola`, `ouroNecessario`, `custoDeTreino`
  (`sim/escola.ts`); `state.jobs.tarefas` (`Colecao<Tarefa>`).
- Produz, para a Task 5 (`ui/painel-escola.ts`):

```ts
export type MotivoDeEspera = 'a-caminho' | 'sem-ouro';

export interface ItemDoPainelDeTreino {
  readonly id: string;
  /** Id NEUTRO do civil (`stonemason`). Quem traduz e o tema, em `ui/`. */
  readonly unidade: string;
  readonly estado: 'aguardando' | 'treinando';
  /** [0,1). Vale 0 em `aguardando`. Derivado de `restam` (D4). */
  readonly progresso: number;
  /** Por que este item nao comecou. `null` quando treina ou quando o ouro ja chegou. */
  readonly motivo: MotivoDeEspera | null;
}

export interface PainelDaEscola {
  readonly predio: string;
  readonly slots: number;
  readonly itens: readonly ItemDoPainelDeTreino[];
  readonly podeEnfileirar: boolean;
  /** Os civis de `units.json`, em ordem do dado. Um botao por tipo. */
  readonly tiposTreinaveis: readonly string[];
  readonly custoPorUnidade: number;
}
```

- [ ] **Step 1: escrever os testes que falham**

Acrescentar ao mesmo arquivo. Reaproveita os helpers da F13a
(`tests/helpers/escola-cenario.ts`) — abra o arquivo antes e use os nomes que
existem lá (`comOuroNoArmazem`, `comEstradas`, `comOuroNaEscola`, `pedir`,
`ESCOLA`, `avancar`); **não** invente helper novo se já houver um equivalente.

```ts
describe('F13b — painelDaEscola', () => {
  it('prédio que não é escola completa devolve null', () => {
    const armazem = inicial.predios.ordem
      .find((id) => inicial.predios.porId[id]!.tipo === 'storehouse')!;
    expect(painelDaEscola(inicial, armazem)).toBeNull();
    expect(painelDaEscola(inicial, 'p999')).toBeNull();
  });

  it('escola vazia: nenhum item, slots e custo vindos do dado, todos os civis', () => {
    const painel = painelDaEscola(inicial, ESCOLA)!;
    expect(painel.itens).toEqual([]);
    expect(painel.slots).toBe(gameData.economia.schoolhouse.slotsDeFila);
    expect(painel.custoPorUnidade).toBe(gameData.economia.schoolhouse.custoOuroPorUnidade);
    expect(painel.tiposTreinaveis).toEqual(gameData.unidades.civis.tipos.map((c) => c.id));
    expect(painel.podeEnfileirar).toBe(true);
  });

  it('sem ouro alcançável o item aguardando diz `sem-ouro`', () => {
    // estado inicial NAO tem estrada: `origemMaisPerto` nao acha rota, nenhuma
    // tarefa nasce. E o caso que o jogador ve e nao entende (D2).
    const semRua = avancar(step(inicial, [pedir(ESCOLA, 'stonemason')]), 3);
    const painel = painelDaEscola(semRua, ESCOLA)!;
    expect(painel.itens.map((i) => [i.estado, i.motivo]))
      .toEqual([['aguardando', 'sem-ouro']]);
    expect(painel.itens[0]!.progresso).toBe(0);
  });

  it('com rua e ouro no armazém o motivo vira `a-caminho`', () => {
    const cenario = comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 3);
    const comTarefa = avancar(step(cenario, [pedir(ESCOLA, 'stonemason')]), 3);
    expect(comTarefa.jobs.tarefas.ordem.length).toBeGreaterThan(0);
    expect(painelDaEscola(comTarefa, ESCOLA)!.itens[0]!.motivo).toBe('a-caminho');
  });

  it('treinando: progresso cresce com o tick e o motivo some', () => {
    const cheia = comOuroNaEscola(step(inicial, [pedir(ESCOLA, 'stonemason')]), ESCOLA, CUSTO);
    const meio = avancar(cheia, 1 + Math.floor(TICKS / 2));
    const item = painelDaEscola(meio, ESCOLA)!.itens[0]!;
    expect(item.estado).toBe('treinando');
    expect(item.motivo).toBeNull();
    expect(item.progresso).toBeGreaterThan(0.4);
    expect(item.progresso).toBeLessThan(1);
  });

  it('fila no teto: `podeEnfileirar` fecha', () => {
    const teto = step(inicial, Array.from({ length: SLOTS }, () => pedir(ESCOLA, 'serf')));
    const painel = painelDaEscola(teto, ESCOLA)!;
    expect(painel.itens).toHaveLength(SLOTS);
    expect(painel.podeEnfileirar).toBe(false);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F13b-painel.test.ts`
Esperado: FAIL — `painelDaEscola` não existe.

- [ ] **Step 3: implementar**

```ts
/**
 * F13b — tudo que o painel da escola desenha, num objeto so. Mora aqui, e nao
 * em `ui/`, porque `ui/` nao varre estado (CLAUDE.md §3): o painel recebe isto
 * pronto e so escreve DOM.
 *
 * O MOTIVO e da fila, nao do item (D2/D3): `ouroNecessario` e um agregado da
 * escola, e a existencia de uma tarefa `ouro-para-escola` para este destino e o
 * que separa "ja vem" de "nao vem". Ausencia de tarefa tambem cobre "nao ha rota
 * ate o armazem" — os dois leem igual, e o rotulo do tema e neutro por isso.
 */
export function painelDaEscola(
  state: GameState, predioId: string, dados: GameData = gameData,
): PainelDaEscola | null {
  const escola = state.predios.porId[predioId];
  if (!ehEscolaCompleta(escola)) return null;

  const faltaOuro = ouroNecessario(state, predioId, dados) > 0;
  const temTarefa = state.jobs.tarefas.ordem.some((id) => {
    const tarefa = state.jobs.tarefas.porId[id];
    return tarefa !== undefined
      && tarefa.tipo === 'ouro-para-escola' && tarefa.destino === predioId;
  });
  const motivo: MotivoDeEspera | null = !faltaOuro ? null : temTarefa ? 'a-caminho' : 'sem-ouro';
  const total = dados.economia.schoolhouse.ticksPorTreino;

  const itens = filaDaEscola(state, predioId).map((item) => ({
    id: item.id,
    unidade: item.unidade,
    estado: item.estado,
    progresso: item.estado === 'treinando' ? (total - item.restam) / total : 0,
    motivo: item.estado === 'treinando' ? null : motivo,
  }));

  return {
    predio: predioId,
    slots: dados.economia.schoolhouse.slotsDeFila,
    itens,
    podeEnfileirar: itens.length < dados.economia.schoolhouse.slotsDeFila,
    tiposTreinaveis: dados.unidades.civis.tipos.map((civil) => civil.id),
    custoPorUnidade: custoDeTreino(dados),
  };
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run tests/F13b-painel.test.ts`
Esperado: PASS (8 testes). Se `ticksPorTreino` não existir com esse nome em
`GameData`, use o nome real do carregador (`src/sim/data/loader.ts:272-276`) —
não invente campo.

- [ ] **Step 5: commit**

```bash
git add src/sim/selectors.ts tests/F13b-painel.test.ts
git commit -m "feat(F13b): painelDaEscola, com o motivo da espera derivado do estado"
```

---

## Task 3: os rótulos no tema

**Files:**
- Modify: `data/theme-sertao.json`

**Interfaces:**
- Produz, para a Task 5: `temaSertao.painelEscola` e `temaSertao.civis[id].nome`
  (este já existe).

- [ ] **Step 1: acrescentar o bloco, ao lado de `menuBuild`**

```json
"painelEscola": {
  "titulo": "Escola",
  "fila": "Fila",
  "vazio": "Ninguém em treinamento.",
  "treinando": "treinando",
  "naFila": "na fila",
  "esperandoOuro": "Esperando dinheiro",
  "ouroACaminho": "Dinheiro a caminho",
  "cancelar": "Cancelar",
  "cancelarItem": "tirar da fila",
  "fechar": "Fechar",
  "custo": "custa",
  "filaCheia": "Fila cheia"
}
```

O texto de `esperandoOuro` é **neutro de propósito** (D2): vale tanto para "não há
ouro" quanto para "não há rota até o armazém".

- [ ] **Step 2: conferir que o dado continua válido**

Run: `npm run validate:data`
Esperado: `validate:data — 9 arquivos, 0 erros. OK.`
(O tema não tem schema — `tools/data-rules.js:5` o cita, mas nenhuma regra o lê.
Não crie schema para ele nesta feature; seria escopo novo.)

- [ ] **Step 3: commit**

```bash
git add data/theme-sertao.json
git commit -m "feat(F13b): rotulos do painel da escola no tema"
```

---

## Task 4: a seleção, estado de interface

**Files:**
- Create: `src/input/selecao.ts`
- Modify: `src/input/colocar.ts`

**Interfaces:**
- Produz: `criarSelecao(): Selecao` com `predio: string | null`,
  `selecionar(id | null)`, `aoMudar(cb)`. Consumido pela Task 5 e pela Task 6.
- Modifica `criarEntradaDoMapa(ferramenta, emitir, aoClicarSemFerramenta?)`: o
  terceiro parâmetro é **opcional**, para não quebrar os testes que já chamam com
  dois argumentos.

- [ ] **Step 1: escrever `src/input/selecao.ts`**

```ts
/**
 * F13b — qual predio o jogador tem aberto. E estado de INTERFACE, irmao da
 * `ferramenta` (F06): nunca entra em `GameState`, nao e salvo e nao afeta a
 * simulacao. Some com `Esc`.
 *
 * So guarda o id. Se o predio for demolido, quem le descobre pelo seletor
 * (`painelDaEscola` devolve `null`) — nao ha assinatura de estado aqui.
 */
export interface Selecao {
  readonly predio: string | null;
  selecionar(predio: string | null): void;
  aoMudar(ouvinte: (predio: string | null) => void): void;
}

export function criarSelecao(): Selecao {
  let predio: string | null = null;
  const ouvintes: ((predio: string | null) => void)[] = [];
  return {
    get predio() {
      return predio;
    },
    selecionar(novo) {
      if (novo === predio) return;
      predio = novo;
      for (const ouvinte of ouvintes) ouvinte(predio);
    },
    aoMudar(ouvinte) {
      ouvintes.push(ouvinte);
    },
  };
}
```

- [ ] **Step 2: ligar o clique sem ferramenta em `colocar.ts`**

No `aoClicar`, acrescentar o ramo final. O comentário de cabeçalho do arquivo
ganha a linha do modo `nenhum`:

```ts
    aoClicar(tile) {
      if (ferramenta.modo === 'predio' && ferramenta.predioAtivo !== null) {
        emitir({ type: 'PlaceBlueprint', buildingId: ferramenta.predioAtivo, gx: tile.gx, gy: tile.gy });
      } else if (ferramenta.modo === 'estrada' || ferramenta.modo === 'demolir-estrada') {
        arrasto = [tile];
      } else {
        // modo `nenhum` (F13b): nao emite comando nenhum — so avisa quem cuida da
        // selecao. Quem resolve "que predio e este tile" e `main.ts`, que tem o
        // estado; `input/` continua sem conhecer `GameState`.
        aoClicarSemFerramenta?.(tile);
      }
    },
```

- [ ] **Step 3: typecheck e a bateria inteira**

Run: `npm run typecheck && npx vitest run`
Esperado: PASS, 627+ testes. O parâmetro novo é opcional, então nenhuma chamada
existente quebra. Se algum teste de `colocar.ts` afirmar "clique sem ferramenta
não faz nada", ele continua válido: **nenhum comando** é emitido.

- [ ] **Step 4: commit**

```bash
git add src/input/selecao.ts src/input/colocar.ts
git commit -m "feat(F13b): selecao de predio como estado de interface"
```

---

## Task 5: o painel

**Files:**
- Create: `src/ui/painel-escola.ts`
- Modify: `index.html`

**Interfaces:**
- Consome: `painelDaEscola`, `PainelDaEscola` (Task 2); `Selecao` (Task 4);
  `temaSertao.painelEscola` (Task 3); `Command` (`sim/commands.ts`).
- Produz: `montarPainelEscola(selecao, emitir): PainelEscola` com
  `atualizar(estado: GameState): void`, chamado pela Task 6.

- [ ] **Step 1: marcação e CSS em `index.html`**

Dentro do `<style>`, depois das regras de `#menu-build`:

```css
    /* F13b: SOBREPOSICAO na celula do canvas, nao coluna nova. Uma terceira
       coluna encolheria o canvas e reprovaria o roteiro da F06, que afirma
       canvas.right <= painel.left. */
    #painel-escola {
      grid-column: 1; grid-row: 2; place-self: end start; margin: 12px;
      box-sizing: border-box; width: 260px; max-height: calc(100% - 24px);
      overflow-y: auto; padding: 8px; border: 2px solid #3a3226; border-radius: 4px;
      background: #1e1a14; color: #ede3d0;
      font: 14px/1.3 system-ui, sans-serif;
      display: flex; flex-direction: column; gap: 6px;
    }
    #painel-escola[hidden] { display: none; }
    #painel-escola h2 { margin: 0 0 2px; font-size: 15px; font-weight: 700; }
    #painel-escola .slot {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 6px; border: 1px solid #3a3226; border-radius: 3px;
      background: #2a241b;
    }
    #painel-escola .slot[data-estado="vazio"] { opacity: 0.35; }
    #painel-escola .slot .nome { font-weight: 700; flex: 1; }
    #painel-escola .slot .motivo { color: #c9974b; font-size: 12px; }
    #painel-escola .slot .progresso { opacity: 0.75; font-variant-numeric: tabular-nums; }
    #painel-escola .tipos { display: flex; flex-wrap: wrap; gap: 4px; }
    #painel-escola .tipos button, #painel-escola .slot button {
      border: 1px solid #3a3226; border-radius: 3px; background: #2a241b;
      color: inherit; font: inherit; font-size: 12px; padding: 3px 6px; cursor: pointer;
    }
    #painel-escola button[aria-disabled="true"] { cursor: not-allowed; opacity: 0.45; }
```

E no `<body>`, depois do `#jogo`:

```html
    <aside id="painel-escola" hidden></aside>
```

- [ ] **Step 2: escrever `src/ui/painel-escola.ts`**

```ts
// Painel da fila de treino da escola (F13b). So le o estado (via
// `painelDaEscola`, seletor puro de sim/) e emite comando; nao muta GameState,
// nao importa phaser e nao varre predios por conta propria (CLAUDE.md §3, §10).
import type { GameState } from '../sim/state';
import type { Command } from '../sim/commands';
import { painelDaEscola } from '../sim/selectors';
import type { ItemDoPainelDeTreino, PainelDaEscola } from '../sim/selectors';
import type { Selecao } from '../input/selecao';
import temaSertao from '../../data/theme-sertao.json';

export interface PainelEscola {
  atualizar(estado: GameState): void;
}

const t = temaSertao.painelEscola;
type TemaDeCivis = Readonly<Record<string, { readonly nome: string } | undefined>>;
const temaDeCivis = temaSertao.civis as TemaDeCivis;

function nomeDoCivil(id: string): string {
  return temaDeCivis[id]?.nome ?? id;
}

function textoDoMotivo(item: ItemDoPainelDeTreino): string {
  if (item.estado === 'treinando') return `${t.treinando} ${Math.round(item.progresso * 100)}%`;
  if (item.motivo === 'sem-ouro') return t.esperandoOuro;
  if (item.motivo === 'a-caminho') return t.ouroACaminho;
  return t.naFila;
}

/**
 * Reescreve o painel inteiro a cada `atualizar`. E barato (no maximo 5 slots +
 * os tipos) e evita o bug classico de reaproveitar no de item cancelado.
 */
export function montarPainelEscola(
  selecao: Selecao, emitir: (comando: Command) => void,
): PainelEscola {
  const raiz = document.getElementById('painel-escola');
  if (!raiz) throw new Error('painel-escola: #painel-escola nao existe no index.html');

  function desenhar(dados: PainelDaEscola): void {
    raiz!.replaceChildren();

    const titulo = document.createElement('h2');
    titulo.textContent = t.titulo;
    raiz!.append(titulo);

    for (let i = 0; i < dados.slots; i++) {
      const item = dados.itens[i];
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = String(i);
      slot.dataset.estado = item?.estado ?? 'vazio';

      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = item ? nomeDoCivil(item.unidade) : '—';
      slot.append(nome);

      if (item) {
        slot.dataset.item = item.id;
        slot.dataset.unidade = item.unidade;
        if (item.motivo !== null) slot.dataset.motivo = item.motivo;

        const detalhe = document.createElement('span');
        detalhe.className = item.estado === 'treinando' ? 'progresso' : 'motivo';
        detalhe.textContent = textoDoMotivo(item);

        const cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.dataset.cancelar = item.id;
        cancelar.title = t.cancelarItem;
        cancelar.textContent = '×';
        cancelar.addEventListener('click', () => {
          emitir({ type: 'CancelTraining', predio: dados.predio, item: item.id });
        });

        slot.append(detalhe, cancelar);
      }
      raiz!.append(slot);
    }

    const tipos = document.createElement('div');
    tipos.className = 'tipos';
    for (const tipo of dados.tiposTreinaveis) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.dataset.treinar = tipo;
      botao.textContent = nomeDoCivil(tipo);
      botao.title = `${t.custo} ${dados.custoPorUnidade}`;
      // aria-disabled e nao `disabled`, como no menu Build (F06): o clique chega
      // e e ignorado aqui, entao o roteiro consegue provar que nao enfileirou.
      botao.setAttribute('aria-disabled', String(!dados.podeEnfileirar));
      botao.addEventListener('click', () => {
        if (botao.getAttribute('aria-disabled') === 'true') return;
        emitir({ type: 'EnqueueTraining', predio: dados.predio, unidade: tipo });
      });
      tipos.append(botao);
    }
    raiz!.append(tipos);

    if (!dados.podeEnfileirar) {
      const cheia = document.createElement('span');
      cheia.className = 'motivo';
      cheia.dataset.filaCheia = 'true';
      cheia.textContent = t.filaCheia;
      raiz!.append(cheia);
    }
  }

  return {
    atualizar(estado) {
      const id = selecao.predio;
      const dados = id === null ? null : painelDaEscola(estado, id);
      // Predio demolido, ou que nunca foi escola: o painel fecha sozinho. Nao
      // mexe na selecao — quem a limpa e o `Esc` e o clique no mapa.
      if (dados === null) {
        raiz.hidden = true;
        raiz.replaceChildren();
        return;
      }
      raiz.hidden = false;
      desenhar(dados);
    },
  };
}
```

- [ ] **Step 3: typecheck e lint**

Run: `npm run typecheck && npm run lint`
Esperado: sem saída. Se o lint reclamar do `raiz!` dentro de `desenhar`, promova
`raiz` a const estreitada (`const painel = raiz;`) e use `painel` — **não**
acrescente `eslint-disable` (§10).

- [ ] **Step 4: commit**

```bash
git add src/ui/painel-escola.ts index.html
git commit -m "feat(F13b): o painel da escola, com os 5 slots e o motivo da espera"
```

---

## Task 6: a fiação, e a fila no harness

**Files:**
- Modify: `src/main.ts`
- Modify: `src/input/teclado.ts` (só se o `Esc` não for genérico o bastante)
- Modify: `src/render/debug.ts`
- Modify: `src/render/scenes/WorldScene.ts`

**Interfaces:**
- Consome tudo das Tasks 1, 2, 4 e 5.
- Produz: `window.__cangaco.filaDeTreino` — o `state.treino` do tick desenhado,
  para o roteiro (Task 7) "confirmar a fila no estado".

- [ ] **Step 1: publicar a fila no harness**

Em `src/render/debug.ts`, ao lado de `tick`, no `EstadoDebug`:

```ts
  /** F13b — `GameState.treino` do tick desenhado: a fila de cada escola, por id de
   *  predio. E o que o roteiro afirma quando o aceite pede "a fila no estado". */
  filaDeTreino: Readonly<Record<string, readonly ItemDeFila[]>>;
```

E `filaDeTreino: {}` no objeto de `publicarEstadoDebug`. No `WorldScene`, no mesmo
ponto do POST_RENDER em que `tick` já é escrito:

```ts
    this.debug.filaDeTreino = estado.treino;
```

- [ ] **Step 2: fiar em `main.ts`**

```ts
import { montarPainelEscola } from './ui/painel-escola';
import { criarSelecao } from './input/selecao';
import { predioNoTile } from './sim/selectors';

const selecao = criarSelecao();

// So enfileira. Quem roda o passo que aplica o comando e o laco.
const entrada = criarEntradaDoMapa(
  ferramenta,
  (comando) => {
    sessao.enviar(comando);
  },
  // Clique sem ferramenta (F13b): abre o painel do predio clicado. Quem sabe o
  // estado e a sessao — `input/` so entrega o tile.
  (tile) => {
    selecao.selecionar(predioNoTile(sessao.estado, tile.gx, tile.gy));
  },
);
```

Depois do `montarMenuBuild`:

```ts
const painelEscola = montarPainelEscola(selecao, (comando) => {
  sessao.enviar(comando);
});
```

Em `atualizar`, e também no `aoMudar` da seleção (o painel tem que abrir no
clique, sem esperar o próximo tick — com o jogo pausado não viria nenhum):

```ts
function atualizar(s: GameState): void {
  jogo.atualizar(s);
  hud.atualizar(s);
  menu.atualizar(s);
  painelEscola.atualizar(s);
}

selecao.aoMudar(() => {
  painelEscola.atualizar(sessao.estado);
});
```

- [ ] **Step 3: o `Esc` fecha o painel**

Abra `src/input/teclado.ts`. O `Esc` já desativa a ferramenta. Acrescente a
seleção **pelo mesmo caminho**, sem duplicar o listener:

```ts
// O Esc e um so: larga a ferramenta E fecha o painel aberto (F13b).
```

Se `ligarTeclado` receber só a `ferramenta`, passe a `selecao` como segundo
parâmetro opcional e chame `selecao?.selecionar(null)` no ramo do `Esc`. Não crie
um segundo `addEventListener('keydown')` na página.

- [ ] **Step 4: typecheck, lint, bateria**

Run: `npm run typecheck && npm run lint && npx vitest run`
Esperado: tudo verde.

- [ ] **Step 5: commit**

```bash
git add src/main.ts src/input/teclado.ts src/render/debug.ts src/render/scenes/WorldScene.ts
git commit -m "feat(F13b): fiacao do painel e a fila de treino no harness"
```

---

## Task 7: o roteiro e a evidência visual

**Files:**
- Create: `tools/shots/F13b.js`

**Interfaces:**
- Consome: `window.__cangaco` (`filaDeTreino`, `camera`, `avancar`), o DOM do
  painel (`[data-treinar]`, `[data-cancelar]`, `[data-slot]`, `[data-motivo]`).
- Produz: `screenshots/F13b-1.png` (fila cheia, esperando dinheiro),
  `screenshots/F13b-2.png` (com rua: treinando e dinheiro a caminho) e
  `test-output/F13b-shot.json` (o runner grava sozinho).

- [ ] **Step 1: escrever o roteiro**

Molde e helpers vindos de `tools/shots/F08.js` (que já constrói a rua do armazém
até a escola, com a geometria tirada do JSON — **copie de lá**, não redesenhe).
Esqueleto, na ordem:

```js
'use strict';
// Roteiro da F13b. Afirma ESTADO e DOM, nao pixel. Todo numero esperado vem do
// JSON: slots, custo e duracao do treino sao do economy.json.
const { retanguloDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const unidades = require('../../data/units.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = 64;
const ESCOLA_NO_DADO = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
const SLOTS = economia.schoolhouse.slotsDeFila;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  // ... pontoDoTile e avancar, como na F08 ...

  // 1. o painel nasce fechado
  afirmar(await page.isHidden('#painel-escola'), 'o painel deveria nascer fechado');

  // 2. clicar na escola (no MEIO do footprint, nao no canto: prova o predioNoTile)
  const meio = await pontoDoTile({ gx: ESCOLA_NO_DADO.gx + 1, gy: ESCOLA_NO_DADO.gy + 1 });
  await page.mouse.click(meio.x, meio.y);
  await esperarFrame();
  afirmar(await page.isVisible('#painel-escola'), 'clicar na escola deveria abrir o painel');
  afirmar(
    (await page.$$('#painel-escola [data-slot]')).length === SLOTS,
    `o painel deveria ter ${SLOTS} slots`,
  );

  // 3. enfileirar por CLIQUE ate encher, e conferir a fila NO ESTADO
  const tipo = unidades.civis.tipos[0].id;
  for (let i = 0; i < SLOTS; i++) {
    await page.click(`#painel-escola [data-treinar="${tipo}"]`);
    await avancar(1);
    await esperarFrame();
  }
  const escolaId = Object.keys((await estado()).filaDeTreino)[0];
  const fila = (await estado()).filaDeTreino[escolaId];
  afirmar(fila.length === SLOTS, `a fila no estado deveria ter ${SLOTS} itens, veio ${fila.length}`);
  afirmar(fila.every((i) => i.unidade === tipo), 'a fila deveria ser do tipo clicado');

  // 4. sem rua ate o armazem nao ha tarefa: todo item diz "esperando dinheiro" (D2)
  const motivos = await page.$$eval('#painel-escola [data-slot][data-motivo]',
    (ns) => ns.map((n) => n.dataset.motivo));
  afirmar(motivos.length === SLOTS && motivos.every((m) => m === 'sem-ouro'),
    `sem rua todos os itens deveriam dizer sem-ouro, veio ${JSON.stringify(motivos)}`);
  afirmar((await page.textContent('#painel-escola')).includes(tema.painelEscola.esperandoOuro),
    'o painel deveria mostrar o rotulo do tema, nao o id do motivo');
  afirmar(await page.getAttribute(`#painel-escola [data-treinar="${tipo}"]`, 'aria-disabled') === 'true',
    'com a fila cheia os botoes de treinar deveriam estar aria-disabled');

  await capturar('F13b-1'); // ACEITE: o painel com a fila cheia

  // 5. cancelar um item pelo X: a fila encolhe no ESTADO
  await page.click(`#painel-escola [data-cancelar="${fila[SLOTS - 1].id}"]`);
  await avancar(1);
  await esperarFrame();
  afirmar((await estado()).filaDeTreino[escolaId].length === SLOTS - 1,
    'cancelar deveria tirar o item da fila no estado');

  // 6. construir a rua (geometria da F08) e deixar o serf trabalhar:
  //    o motivo vira `a-caminho` e o primeiro item passa a `treinando`
  // ... arrasto da estrada, como na F08 ...
  await avancar(30);
  await esperarFrame();
  const depois = await page.$$eval('#painel-escola [data-slot][data-estado]',
    (ns) => ns.map((n) => ({ estado: n.dataset.estado, motivo: n.dataset.motivo })));
  afirmar(depois.some((s) => s.estado === 'treinando'),
    `com rua e dinheiro algum item deveria estar treinando, veio ${JSON.stringify(depois)}`);

  await capturar('F13b-2'); // treinando + dinheiro a caminho

  // 7. Esc fecha
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar(await page.isHidden('#painel-escola'), 'o Esc deveria fechar o painel');
}

module.exports = { roteiro };
```

- [ ] **Step 2: rodar**

Run: `npm run shot -- F13b`
Esperado: exit 0, `screenshots/F13b-1.png` e `F13b-2.png` gravados. Erro de
console ou `pageerror` reprova o roteiro — se aparecer, conserte a causa.

Se o passo 6 não alcançar `treinando` em 30 ticks, **meça**: o ouro precisa do
serf indo e voltando. Aumente com base no que o `test-output/F13b-shot.json`
mostrar, não no chute — e registre o número medido como comentário.

- [ ] **Step 3: abrir a evidência**

Abra `screenshots/F13b-1.png` **com a ferramenta Read** e confira, de olho: os 5
slots, o nome do civil vindo do tema, o rótulo "Esperando dinheiro", o botão de
cancelar em cada item, e o canvas **não encolhido** ao lado. Se a tela estiver
preta ou o painel cortado, a feature não está pronta (CLAUDE.md §7).

Abra `F13b-2.png` também: é a que prova o motivo mudando.

- [ ] **Step 4: não-regressão dos roteiros que o layout pode ter quebrado**

Run: `npm run shot -- F06 && npm run shot -- F08`
Esperado: exit 0 nos dois. **Confira o código de saída, não abra as imagens** —
screenshot de outra feature pesa na janela de contexto à toa.
A F06 é a que afirma `canvas.right <= painel.left`; se ela reprovar, a
sobreposição virou coluna e o CSS está errado.

- [ ] **Step 5: commit**

```bash
git add tools/shots/F13b.js screenshots/F13b-1.png screenshots/F13b-2.png
git commit -m "feat(F13b): roteiro do painel e a evidencia visual"
```

---

## Task 8: fechamento

**Files:**
- Modify: `PROGRESS.md`, `BUILD_PLAN.md`, `test-results.json`

- [ ] **Step 1: registrar em `PROGRESS.md`**

Uma seção da F13b com: as quatro decisões (D1-D4), **a limitação da D2 nomeada
como limitação**, e o que ficou de fora por escopo (seleção genérica e painel de
prédio qualquer são F16; nenhum outro prédio abre painel).

Separe **verificado** de **hipótese**, como a §6 manda.

- [ ] **Step 2: as Notas no `BUILD_PLAN.md`**

No item **F13b**: D1 (como o painel abre) e D2 (os dois motivos + a limitação).
No item **F16**: uma linha dizendo que `input/selecao.ts` e o `#painel-escola`
são o mínimo da F13b e que a seleção genérica os substitui — é contrato herdado, e
contrato futuro vai na nota do item da fila, não só no PROGRESS.

- [ ] **Step 3: o portão**

Run: `npm run verify`
Esperado: exit 0. Só então escrever `"F13b-schoolhouse-painel": { "passes": true }`
em `test-results.json` — o selo vale 15 minutos e o hook recusa a escrita sem ele.

- [ ] **Step 4: commit final**

```bash
git add PROGRESS.md BUILD_PLAN.md test-results.json
git commit -m "feat(F13b): PROGRESS, notas e test-results"
```

---

## Self-review (feito sobre o BUILD_PLAN antes de executar)

**Cobertura do aceite.** O aceite tem duas metades.
*"Screenshot do painel com a fila cheia"* → Task 7, passo 4 (`F13b-1`), com a fila
provada em `SLOTS` itens antes da captura. *"Roteiro que enfileira por clique e
confirma a fila no estado"* → Task 7, passo 3: clica `[data-treinar]` e lê
`window.__cangaco.filaDeTreino`, publicado na Task 6. O escopo pede ainda
"cancelamento de item" (Task 7, passo 5) e "um botão por tipo de trabalhador"
(Task 5, `tiposTreinaveis`, derivado de `units.json`).

**Os três pontos do operador.** (1) O motivo derivado está na Task 2, e os **dois**
casos são distinguíveis sem campo novo — a decisão e o que ela *não* separa estão
na D2. (2) O seletor mora em `sim/selectors.ts` e o painel não varre estado: a
única coisa que `ui/` faz é chamar `painelDaEscola`. (3) A marca de integração já
está no item; o plano toca `ui/`, `input/` e `render/` só por isso, e `sim/` só
ganha seletor puro.

**Placeholders.** Nenhum "TBD". Os dois pontos em que o plano manda *medir* em vez
de dar o número — os ticks do passo 6 do roteiro e o nome real do campo de
duração no `GameData` — são deliberados: chutar ali seria pior que abrir o arquivo.

**Consistência de tipos.** `PainelDaEscola`/`ItemDoPainelDeTreino` são definidos na
Task 2 e consumidos com os mesmos nomes na Task 5. `Selecao` nasce na Task 4 e é
consumida nas 5 e 6. `filaDeTreino` nasce na Task 6 e é lida na 7. `predioNoTile`
nasce na 1 e é usado na 6.

**Risco conhecido.** O layout. O `#painel-escola` sobrepõe o canvas de propósito;
se virar coluna, a F06 reprova. Por isso a não-regressão da F06 e da F08 é passo
do plano, e não cortesia.
