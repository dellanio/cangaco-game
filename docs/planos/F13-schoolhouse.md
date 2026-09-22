# F13 — Schoolhouse: fila de treino — Plano de implementação

> **Para o executor:** use `superpowers:executing-plans` tarefa a tarefa. **Não**
> use `subagent-driven-development` nem `dispatching-parallel-agents` — proibidos
> pelo CLAUDE.md §11. Passos usam checkbox (`- [ ]`).

**Objetivo:** a escola treina civis. O jogador enfileira até 5 pedidos; cada um
consome 1 ouro **no instante em que o treino começa**; o ouro chega à escola pelo
serf, por uma tarefa nova do JobBoard (nível 2 da escada, `ouro-para-escola`); ao
fim do treino nasce uma unidade na porta da escola.

**Arquitetura:** três peças novas em `sim/`, nenhuma em `render/`.
1. **Estado**: `GameState.treino` — a fila de cada escola, por id de prédio.
2. **Sistema**: `sim/systems/escolas.ts` — aplica os dois comandos novos e roda um
   passo de fila por tick (cobra, conta, faz nascer).
3. **Transporte**: `TarefaOuroParaEscola`, irmã de `TarefaMaterialParaObra` sob uma
   base comum `TarefaDeCarga` — o mesmo serf, o mesmo claim, a mesma reserva
   dupla, com o **nível 2** da escada finalmente tendo produtor.

**Tech stack:** TypeScript estrito, Vitest. Nada novo.

**Spec:** `BUILD_PLAN.md`, item "F13 — Schoolhouse: fila de treino" (linhas
264-276) — reescrito pela Task 0 em **F13a** (simulação, esta sessão) e **F13b**
(painel), sem mudar substância do aceite. As duas decisões de interpretação que a
Task 0 registra estão em "Decisões", abaixo.

---

## Context

O que já existe e este plano **reusa sem alterar a forma**:

- **O JobBoard** (F09/F10/F11b): `Tarefa` é união discriminada por `tipo`; a
  reserva dupla é **derivada** das tarefas (`sim/reservas.ts`), nunca um campo;
  `sanearTarefas` revalida tudo todo tick e `gerarTarefas` cria o que falta.
- **A FSM do serf** (F10, `sim/systems/serfs.ts`): `ocioso → indo_buscar →
  carregando → indo_entregar → entregando → ocioso`, com `devolvendo` como saída
  de erro. Ela já sabe coletar de um armazém e andar por estrada; **só o passo de
  entrega sabe que o destino é uma obra**, e é o único ponto que generaliza aqui.
- **A escada de `data/delivery.json`**: o id `ouro-para-escola` está lá no nível 2
  desde a F03, **sem produtor**. `nivelDoTipo(tipo)` lê o nível pelo id — nenhum
  número de nível entra em `.ts`.
- **Os números da escola já estão no dado e já são carregados**
  (`data/economy.json:schoolhouse` → `GameData.economia.schoolhouse`):
  `custoOuroPorUnidade: 1`, `slotsDeFila: 5`, `ticksPorTreino` (convertido de
  `segundosPorTreino_base: 30` na escala `construcao`, = **150 ticks**),
  `reembolsoSeNaoIniciado: true`. Nenhum dado novo precisa ser escrito.
- **O estoque de duas gavetas** (F05a): o ouro entregue entra na gaveta `entrada`
  da escola; o serf sempre retira da gaveta `saida` do armazém. A escola tem
  capacidade `{ entrada: null, saida: null }` (sem limite) — quem limita a
  entrega é a **demanda da fila**, não a capacidade.

**Resultado pretendido:** partindo do estado inicial (Storehouse e Schoolhouse
completos, ligados por estrada), três `EnqueueTraining` com 3 de ouro no armazém
produzem três civis novos, o ouro termina em 0 nos dois prédios, e um quarto
pedido fica esperando ouro que não existe — sem travar nada.

---

## Decisões (registrar em `PROGRESS.md` e nas Notas do `BUILD_PLAN.md`)

**D1 — Onde a unidade treinada aparece: na porta da própria escola.**
O tile é o primeiro de `tilesDaPorta(escola)` (a borda sul, GDD §4: "planta com
porta ao sul") que seja andável. **Não** é `economy.json:estadoInicial.
spawnDeUnidades` — aquele campo está *dentro* de `estadoInicial`, é o canto de
onde os 4 serfs e 2 laborers do cenário inicial nascem, e usá-lo faria duas
escolas em pontas opostas do mapa cuspirem unidades no mesmo tile. A porta é
derivada do prédio, não é dado novo, e é por onde o ouro entrou.
*Se nenhum tile da porta for andável, o item fica pronto e segura* — não é espera
indefinida na prática: o ouro só chega à escola por porta que é estrada, e tile de
estrada é andável; uma escola sem porta andável nunca chegou a cobrar o ouro.

**D2 — "tenta a quarta sem ouro e confirma rejeição" (aceite do BUILD_PLAN) é
recusa de *iniciar o treino*, não recusa do comando de enfileirar.**
Cobrar ao iniciar (regra do operador) e recusar o enfileiramento por falta de ouro
são incompatíveis: se enfileirar exigisse ouro presente, a fila nunca poderia
**criar demanda** de ouro — e a demanda da fila é exatamente o produtor do nível 2
da escada que esta feature traz. Então: o quarto pedido entra na fila, fica em
`aguardando`, nenhuma unidade nasce e nenhum ouro é gasto. O teste afirma as duas
coisas — e afirma também uma recusa de comando de verdade (fila cheia, prédio que
não é escola), para que "rejeição" não fique sem cobertura.

**D3 — o preço vem de `economia.schoolhouse.custoOuroPorUnidade`**, não de
`units.json:civis.tipos[].custoOuro` (que hoje também vale 1 para todo civil e
continua **sem leitor**). Razão: `slotsDeFila`, `ticksPorTreino` e
`reembolsoSeNaoIniciado` são todos regra *da escola*, e o GDD §7 descreve a
Schoolhouse como "1 gold → 1 civil". O dia em que um civil custar diferente dos
outros, quem lê passa a ser o campo por tipo e o campo da escola vira o padrão —
isso vai na Nota do item, não no código de hoje.

**D4 — a fila mora fora de `Predio`.** `GameState.treino` é um
`Record<idDePredio, ItemDeFila[]>`, e **escola sem fila não tem entrada** (`{}`,
nunca `{ p2: [] }` — senão dois estados iguais teriam JSON diferente e o teste de
determinismo mentiria). Pôr `fila` em `PredioCompleto` tornaria representável uma
Pedreira com fila de treino, contra o mesmo princípio que fez `Predio` e `Tarefa`
serem uniões discriminadas (F07/F11b).

---

## Global Constraints (CLAUDE.md, valem para toda tarefa)

- `src/sim/` não importa `phaser`, não toca `window`/`document`/`performance`,
  não usa `Math.random()` nem `Date.now()`.
- Toda duração em **ticks**; nenhum número de balanceamento digitado em `.ts`
  (custo, slots e duração do treino vêm de `GameData.economia.schoolhouse`).
- `GameState` serializável: sem função, sem `Map`, sem `undefined` — campo
  ausente é **omitido**.
- Ids de simulação em inglês (`schoolhouse`, `gold`, `serf`); nomes de código em
  português, como o resto de `sim/`.
- `npm run verify` (typecheck + lint + validate:data + test) tem que passar antes
  de qualquer escrita em `test-results.json`.
- **Esta feature não toca `src/render/` nem `src/ui/`** — por isso não precisa da
  exceção de "feature de integração" da §10 (a F13b precisará, e a Task 0 escreve
  isso no item dela).

---

## Estrutura de arquivos

| Arquivo | O que faz | Tarefa |
|---|---|---|
| `BUILD_PLAN.md` | quebra F13 em F13a/F13b, com as decisões como Nota | 0 |
| `src/sim/state.ts` | `ItemDeFila`, `GameState.treino`, `TarefaDeCarga`/`TarefaOuroParaEscola`, `MERCADORIA_DE_OURO`, `ID_DA_ESCOLA`, eventos novos | 1, 5 |
| `src/sim/commands.ts` | `EnqueueTraining`, `CancelTraining` | 1, 2 |
| `src/sim/escola.ts` **(novo)** | derivados puros da escola: `ehEscolaCompleta`, `filaDaEscola`, `comFila`, `ouroNecessario`, `custoDeTreino`, `MotivoDeRecusaDeTreino`. **Não importa `estradas` nem `pathfinding`** (`reservas.ts` o importa, e `estradas.ts` importa `reservas.ts` — importar de volta fecharia ciclo) | 1 |
| `src/sim/systems/escolas.ts` **(novo)** | `aplicarEnqueueTraining`, `aplicarCancelTraining`, `sanearFilas`, `sistemaDasEscolas`, `tileDeSaida` | 1, 2, 3 |
| `src/sim/reservas.ts` | `demandaNoDestino`, `vagaDoDestino`, `vagaDeOuroNaEscola`; `reservado*` passam a contar qualquer tarefa de carga | 5 |
| `src/sim/jobs.ts` | elegibilidade e `criarTarefaDeOuro`; `planoDaTarefa`/`custoDaTarefa`/`tarefasEmOrdem`/`reclamar` passam a falar `TarefaDeTransporte` | 5, 6 |
| `src/sim/systems/jobs.ts` | `gerarTarefasDeOuro`; saneamento do tipo novo | 6 |
| `src/sim/systems/serfs.ts` | entrega por tipo de tarefa (obra × escola) | 7 |
| `src/sim/tick.ts` | despacha os dois comandos; chama `sistemaDasEscolas` | 1, 3 |
| `tools/data-rules.js` | `validarPoliticaDeTreino` | 4 |
| `tests/F13a-fila.test.ts` **(novo)** | comandos, cobrança, cancelamento, nascimento | 1-4 |
| `tests/F13a-ouro.test.ts` **(novo)** | tarefa de ouro: reserva, escada, geração, saneamento, entrega | 5-7 |
| `tests/F13a-aceite.test.ts` **(novo)** | o aceite do BUILD_PLAN ponta a ponta + evidência | 8 |
| `tests/helpers/escola-cenario.ts` **(novo)** | fixtures: estrada armazém↔escola, ouro no armazém, fila montada | 1 |
| `PROGRESS.md` | contrato novo e decisões | 9 |

---

## Task 0: quebrar a fila e registrar as decisões

**Files:** Modify `BUILD_PLAN.md:264-276`

A F13 inteira (fila + cobrança + produtor do nível 2 + generalização da entrega +
painel + screenshot) não cabe numa sessão. CLAUDE.md §6 manda quebrar em sub-itens
**antes** de implementar, como a F11 foi quebrada em F11a/b/c.

- [ ] **Passo 1: substituir o item F13 por dois**, preservando Escopo, Aceite e
      Evidência (nada de reescrever critério — só repartir):

```markdown
### F13a — Schoolhouse: fila de treino (simulação)
- **Escopo**: fila de até 5 slots por escola, um pedido por tipo de trabalhador,
  1 gold por unidade **cobrado ao iniciar o treino**; a unidade nasce na porta da
  escola. O ouro chega pelo serf: nasce aqui o produtor do nível 2 da escada
  (`ouro-para-escola`).
- **Aceite**: teste headless que, do estado inicial com 3 de ouro no armazém,
  enfileira 3 unidades, conduz por `step()` e confirma: o ouro sai do armazém e
  chega à escola pelo serf, ouro 0 nos dois prédios ao fim, as 3 unidades criadas
  (uma por `ticksPorTreino` do dado) e nascidas na porta da escola; um 4º pedido
  sem ouro fica em `aguardando` para sempre, sem unidade e sem gasto; e um 6º
  pedido (fila cheia) é recusado com `command-rejected`.
- **Evidência**: `test-output/F13a.json`
- **Nota**: sem screenshot — nada em `render/` ou `ui/` muda aqui, e o painel é a
  F13b.
- **Nota (D2)**: "tenta a quarta sem ouro e confirma rejeição", do aceite
  original, vale como **recusa de iniciar o treino**: cobrar ao iniciar e recusar
  o enfileiramento por falta de ouro se excluem — se enfileirar exigisse ouro
  presente, a fila nunca criaria a demanda que faz o ouro vir.
- **Nota (D1)**: a unidade nasce no primeiro tile andável da **porta da escola**
  (borda sul). `economy.json:estadoInicial.spawnDeUnidades` continua sendo só o
  canto do cenário inicial; não vale para prédio em runtime.
- **Nota (D3)**: o preço lido é `economy.schoolhouse.custoOuroPorUnidade`.
  `units.json:civis.tipos[].custoOuro` (hoje 1 para todos) continua sem leitor —
  quando um civil custar diferente, é ele que passa a mandar, e o campo da escola
  vira o padrão. Quem for mexer nisso mexe nos dois.

### F13b — Schoolhouse: painel da fila (interface)
- **Escopo**: painel com os 5 slots, um botão por tipo de trabalhador e
  cancelamento de item, emitindo `EnqueueTraining`/`CancelTraining` (já
  existentes, F13a). Lê o estado, não o muta.
- **Aceite**: screenshot do painel com a fila cheia, e roteiro que enfileira por
  clique e confirma a fila no estado.
- **Evidência**: `screenshots/F13b-*.png`
- **Nota**: **feature de integração** (CLAUDE.md §10): pode tocar `src/ui/`,
  `src/input/` e `src/render/` na mesma feature, porque o painel precisa abrir a
  partir do prédio clicado.
- **Nota**: a seleção de prédio é da F16. Decidir na sessão da F13b se o painel
  abre por clique próprio (mínimo viável, sem painel genérico) ou pela ponte de
  harness; não antecipar a F16.
```

- [ ] **Passo 2: commit**

```bash
git add BUILD_PLAN.md docs/planos/F13-schoolhouse.md
git commit -m "feat(F13a): quebra a F13 em F13a (sim) e F13b (painel) e registra as decisoes"
```

---

## Task 1: a fila no estado e o comando de enfileirar

**Files:**
- Modify: `src/sim/state.ts`, `src/sim/commands.ts`, `src/sim/tick.ts`
- Create: `src/sim/escola.ts`, `src/sim/systems/escolas.ts`,
  `tests/helpers/escola-cenario.ts`, `tests/F13a-fila.test.ts`

**Interfaces:**
- Produz: `ItemDeFila`, `GameState.treino`, `ID_DA_ESCOLA`,
  `MERCADORIA_DE_OURO` (`state.ts`); `ehEscolaCompleta`, `filaDaEscola`,
  `comFila`, `custoDeTreino`, `MotivoDeRecusaDeTreino` (`escola.ts`);
  `aplicarEnqueueTraining` (`systems/escolas.ts`).
- Consome: `Colecao`, `PredioCompleto`, `GameData.economia.schoolhouse`.

- [ ] **Passo 1: escrever o teste que falha** (`tests/F13a-fila.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { filaDaEscola } from '../src/sim/escola';
import { escolaDoCenario } from './helpers/escola-cenario';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;

describe('F13a — EnqueueTraining', () => {
  it('escola sem pedido nao tem entrada em `treino` (fila vazia e ausencia)', () => {
    expect(inicial.treino).toEqual({});
    expect(filaDaEscola(inicial, ESCOLA)).toEqual([]);
  });

  it('tres pedidos entram na ordem, todos `aguardando`', () => {
    const depois = step(inicial, [
      { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'stonemason' },
      { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'woodcutter' },
      { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'serf' },
    ]);
    expect(filaDaEscola(depois, ESCOLA).map((i) => i.unidade))
      .toEqual(['stonemason', 'woodcutter', 'serf']);
    expect(filaDaEscola(depois, ESCOLA).every((i) => i.estado === 'aguardando')).toBe(true);
    // ids saem do mesmo contador de predios/unidades/tarefas
    expect(new Set(filaDaEscola(depois, ESCOLA).map((i) => i.id)).size).toBe(3);
  });

  it('passa do teto de slots: o excedente e recusado, a fila para no teto', () => {
    const slots = gameData.economia.schoolhouse.slotsDeFila;
    const pedidos = Array.from({ length: slots + 1 }, () =>
      ({ type: 'EnqueueTraining', predio: ESCOLA, unidade: 'serf' }) as const);
    const depois = step(inicial, pedidos);
    expect(filaDaEscola(depois, ESCOLA)).toHaveLength(slots);
    expect(depois.events).toContainEqual({
      type: 'command-rejected', command: 'EnqueueTraining',
      predio: ESCOLA, unidade: 'serf', motivo: 'fila-cheia',
    });
  });

  it('recusa prédio que nao existe, prédio que nao e escola e tipo desconhecido', () => {
    const armazem = inicial.predios.ordem.find((id) => inicial.predios.porId[id]?.tipo === 'storehouse');
    const motivos = step(inicial, [
      { type: 'EnqueueTraining', predio: 'p999', unidade: 'serf' },
      { type: 'EnqueueTraining', predio: armazem as string, unidade: 'serf' },
      { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'cangaceiro' },
    ]).events.flatMap((e) => (e.type === 'command-rejected' && e.command === 'EnqueueTraining' ? [e.motivo] : []));
    expect(motivos).toEqual(['predio-inexistente', 'nao-e-escola', 'unidade-desconhecida']);
    expect(step(inicial, []).treino).toEqual({});
  });
});
```

`tests/helpers/escola-cenario.ts` nasce com o mínimo desta tarefa:

```ts
import type { GameState, PredioCompleto } from '../../src/sim/state';
import { ID_DA_ESCOLA } from '../../src/sim/state';

/** A escola do cenario inicial (p2). Falha alto se o cenario mudar. */
export function escolaDoCenario(estado: GameState): PredioCompleto {
  const p = estado.predios.ordem.map((id) => estado.predios.porId[id])
    .find((x) => x?.tipo === ID_DA_ESCOLA);
  if (!p || p.estado !== 'completo') throw new Error('fixture: cenario sem escola completa');
  return p;
}
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run tests/F13a-fila.test.ts`
Expected: FAIL — `treino` não existe em `GameState`, `EnqueueTraining` não é
`Command`, `src/sim/escola.ts` não existe.

- [ ] **Passo 3: implementar**

`src/sim/state.ts` — ao lado de `ID_DO_ARMAZEM`:

```ts
/** Id estrutural do prédio que treina (chave de `economy.json:schoolhouse`), como
 *  `ID_DO_ARMAZEM`. Não é balanceamento: os números continuam no dado. */
export const ID_DA_ESCOLA = 'schoolhouse';

/** A mercadoria que a escola consome. Id estrutural, não número. */
export const MERCADORIA_DE_OURO = 'gold';
```

```ts
/**
 * F13 — um pedido na fila de uma escola. União discriminada por `estado`: um item
 * que ainda não começou NÃO tem `restam`, e um em treino tem sempre `restam >= 1`
 * (ao chegar a 0 a unidade nasce e o item sai da fila no mesmo tick).
 *
 * O ouro é cobrado na TRANSIÇÃO `aguardando -> treinando` (GDD §2.3 e
 * `economy.schoolhouse.reembolsoSeNaoIniciado`): cancelar um `aguardando` não
 * devolve nada porque nada saiu; cancelar um `treinando` perde o ouro já gasto.
 */
export type ItemDeFila =
  | { readonly id: string; readonly unidade: string; readonly estado: 'aguardando' }
  | { readonly id: string; readonly unidade: string; readonly estado: 'treinando'; readonly restam: number };
```

No `GameState`, depois de `jobs`:

```ts
  /**
   * F13 — a fila de treino de cada escola, por id de PRÉDIO. Escola sem pedido
   * **não tem entrada** (nunca `{ p2: [] }`): dois estados iguais precisam ter o
   * mesmo JSON, ou o teste de determinismo mente. A fila mora aqui, e não em
   * `PredioCompleto`, para não tornar representável uma Pedreira com fila.
   */
  readonly treino: Readonly<Record<string, readonly ItemDeFila[]>>;
```

`createInitialState` ganha `treino: {}`; `step()` devolve `treino: atual.treino`.

`GameEvent` ganha a recusa (o `motivo` vem de `escola.ts`, como
`MotivoDeRecusa` vem de `placement.ts`):

```ts
  | {
      /** `EnqueueTraining` recusado; o estado não mudou. */
      readonly type: 'command-rejected';
      readonly command: 'EnqueueTraining';
      readonly predio: string;
      readonly unidade: string;
      readonly motivo: MotivoDeRecusaDeTreino;
    }
```

`src/sim/commands.ts`:

```ts
  | {
      /**
       * Enfileira UM pedido de treino na escola `predio`. Não debita ouro: o
       * custo sai quando o treino COMEÇA (F13, `sistemaDasEscolas`). Recusado
       * (evento `command-rejected`) se o prédio não é escola completa, se a fila
       * está no teto de `economy.schoolhouse.slotsDeFila`, ou se `unidade` não é
       * um civil de `units.json`.
       */
      readonly type: 'EnqueueTraining';
      readonly predio: string;
      /** Id do civil em `data/units.json` civis.tipos. */
      readonly unidade: string;
    }
```

`src/sim/escola.ts` (derivados puros; **sem** `estradas`/`pathfinding`):

```ts
export type MotivoDeRecusaDeTreino =
  | 'predio-inexistente' | 'nao-e-escola' | 'escola-em-obra'
  | 'fila-cheia' | 'unidade-desconhecida';

export const ehEscolaCompleta = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DA_ESCOLA;

export function filaDaEscola(state: GameState, predioId: string): readonly ItemDeFila[] {
  return state.treino[predioId] ?? [];
}

/** Grava a fila de uma escola. Fila vazia APAGA a entrada (ver `GameState.treino`). */
export function comFila(state: GameState, predioId: string, itens: readonly ItemDeFila[]): GameState {
  const treino = { ...state.treino };
  if (itens.length === 0) delete treino[predioId]; else treino[predioId] = itens;
  return { ...state, treino };
}

export const custoDeTreino = (dados: GameData = gameData): number =>
  dados.economia.schoolhouse.custoOuroPorUnidade;

export const ehCivilConhecido = (tipo: string, dados: GameData = gameData): boolean =>
  dados.unidades.civis.tipos.some((c) => c.id === tipo);
```

`src/sim/systems/escolas.ts`:

```ts
export function aplicarEnqueueTraining(
  state: GameState, comando: Extract<Command, { type: 'EnqueueTraining' }>, dados: GameData = gameData,
): ResultadoDeSistema {
  const recusar = (motivo: MotivoDeRecusaDeTreino): ResultadoDeSistema => ({
    state,
    events: [{ type: 'command-rejected', command: 'EnqueueTraining', predio: comando.predio, unidade: comando.unidade, motivo }],
  });
  const predio = state.predios.porId[comando.predio];
  if (predio === undefined) return recusar('predio-inexistente');
  if (predio.tipo !== ID_DA_ESCOLA) return recusar('nao-e-escola');
  if (!ehEscolaCompleta(predio)) return recusar('escola-em-obra');
  if (!ehCivilConhecido(comando.unidade, dados)) return recusar('unidade-desconhecida');

  const fila = filaDaEscola(state, comando.predio);
  if (fila.length >= dados.economia.schoolhouse.slotsDeFila) return recusar('fila-cheia');

  const numero = state.proximoId;
  const item: ItemDeFila = { id: `f${numero}`, unidade: comando.unidade, estado: 'aguardando' };
  return { state: comFila({ ...state, proximoId: numero + 1 }, comando.predio, [...fila, item]), events: [] };
}
```

`tick.ts` ganha o `case 'EnqueueTraining'` no `switch` (o `never` do `default`
obriga).

- [ ] **Passo 4: rodar até passar**

Run: `npx vitest run tests/F13a-fila.test.ts`
Expected: PASS. Depois `npm run test` inteiro — nenhuma suite anterior pode
mudar (o campo novo nasce `{}` e nada o lê ainda).

- [ ] **Passo 5: commit**

```bash
git add src/sim/state.ts src/sim/commands.ts src/sim/escola.ts src/sim/systems/escolas.ts src/sim/tick.ts tests/
git commit -m "feat(F13a): GameState.treino e o comando EnqueueTraining (Task 1)"
```

---

## Task 2: cancelar um item da fila

**Files:** Modify `src/sim/commands.ts`, `src/sim/systems/escolas.ts`,
`src/sim/tick.ts`, `tests/F13a-fila.test.ts`

**Interfaces:** Produz `aplicarCancelTraining`. Consome `comFila`, `filaDaEscola`.

- [ ] **Passo 1: teste que falha**

```ts
describe('F13a — CancelTraining', () => {
  const comTres = step(inicial, ['stonemason', 'woodcutter', 'serf'].map((u) =>
    ({ type: 'EnqueueTraining', predio: ESCOLA, unidade: u }) as const));

  it('tira o item pedido e preserva a ordem dos outros', () => {
    const alvo = filaDaEscola(comTres, ESCOLA)[1] as ItemDeFila;
    const depois = step(comTres, [{ type: 'CancelTraining', predio: ESCOLA, item: alvo.id }]);
    expect(filaDaEscola(depois, ESCOLA).map((i) => i.unidade)).toEqual(['stonemason', 'serf']);
  });

  it('cancelar o ultimo item APAGA a entrada de `treino` (fila vazia e ausencia)', () => {
    const um = step(inicial, [{ type: 'EnqueueTraining', predio: ESCOLA, unidade: 'serf' }]);
    const item = filaDaEscola(um, ESCOLA)[0] as ItemDeFila;
    expect(step(um, [{ type: 'CancelTraining', predio: ESCOLA, item: item.id }]).treino).toEqual({});
  });

  it('item inexistente e escola inexistente sao no-op, nunca recusa', () => {
    const depois = step(comTres, [
      { type: 'CancelTraining', predio: ESCOLA, item: 'f999' },
      { type: 'CancelTraining', predio: 'p999', item: 'f1' },
    ]);
    expect(filaDaEscola(depois, ESCOLA)).toHaveLength(3);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar** — `CancelTraining` não é `Command`.

- [ ] **Passo 3: implementar.** `CancelTraining { predio, item }`, **nunca
      recusado** (como `DemolishRoad`: o que não existe é ignorado):

```ts
/** Tira o item da fila. Item ou escola inexistentes: no-op. NÃO devolve ouro — o
 *  item `aguardando` nunca pagou, e o `treinando` já gastou (F13, D2). */
export function aplicarCancelTraining(
  state: GameState, comando: Extract<Command, { type: 'CancelTraining' }>,
): ResultadoDeSistema {
  const fila = filaDaEscola(state, comando.predio);
  const restante = fila.filter((i) => i.id !== comando.item);
  if (restante.length === fila.length) return { state, events: [] };
  return { state: comFila(state, comando.predio, restante), events: [] };
}
```

- [ ] **Passo 4: rodar até passar** (`npx vitest run tests/F13a-fila.test.ts`).
- [ ] **Passo 5: commit** — `feat(F13a): CancelTraining, sem devolucao de ouro (Task 2)`

---

## Task 3: o sistema — cobra, conta e faz nascer

**Files:** Modify `src/sim/systems/escolas.ts`, `src/sim/tick.ts`,
`tests/helpers/escola-cenario.ts`, `tests/F13a-fila.test.ts`

**Interfaces:**
- Produz: `sistemaDasEscolas(state, dados): ResultadoDeSistema`, `sanearFilas`,
  `tileDeSaida(state, escola, dados): TileDeGrid | null`, evento
  `{ type: 'unit-trained', predio, unidade, tipo }`.
- Consome: `tilesDaPorta` (`estradas.ts`), `tileAndavel` (`pathfinding.ts`),
  `dados.economia.schoolhouse.ticksPorTreino`.

> O ouro é posto na escola **por fixture** nesta tarefa. Isso não é andaime do
> aceite: o produtor real (serf) chega na Task 7, e o aceite da Task 8 não usa
> fixture nenhuma de ouro na escola — ele parte do armazém.

- [ ] **Passo 1: teste que falha**

```ts
describe('F13a — sistemaDasEscolas', () => {
  const ticks = gameData.economia.schoolhouse.ticksPorTreino;
  const custo = gameData.economia.schoolhouse.custoOuroPorUnidade;
  const base = comOuroNaEscola(step(inicial, [
    { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'stonemason' },
  ]), ESCOLA, custo);

  it('cobra o ouro NO TICK em que o treino comeca, e so entao conta', () => {
    const t1 = step(base, []);
    expect(ouroNaEscola(t1, ESCOLA)).toBe(0);
    expect(filaDaEscola(t1, ESCOLA)[0]).toEqual(
      { id: expect.any(String), unidade: 'stonemason', estado: 'treinando', restam: ticks });
  });

  it('sem ouro na escola o item fica `aguardando` e nada e gasto', () => {
    const semOuro = step(inicial, [{ type: 'EnqueueTraining', predio: ESCOLA, unidade: 'serf' }]);
    const depois = avancar(semOuro, 50);
    expect(filaDaEscola(depois, ESCOLA)[0]?.estado).toBe('aguardando');
    expect(contagemPorTipo(depois).serf).toBe(contagemPorTipo(inicial).serf);
  });

  it('ao fim do treino a unidade nasce na PORTA da escola e o item sai da fila', () => {
    const fim = avancar(base, ticks + 1);
    const escola = escolaDoCenario(fim);
    const porta = tilesDaPorta(escola)[0];
    const nova = fim.unidades.ordem.filter((id) => !inicial.unidades.porId[id]);
    expect(nova).toHaveLength(1);
    const u = fim.unidades.porId[nova[0] as string];
    expect(u?.tipo).toBe('stonemason');
    expect({ gx: u?.gx, gy: u?.gy }).toEqual(porta);
    expect(u?.fsm).toBe('ocioso');
    expect(fim.treino).toEqual({});
    expect(fim.events).toContainEqual({ type: 'unit-trained', predio: ESCOLA, unidade: nova[0], tipo: 'stonemason' });
  });

  it('treina UM item por vez, na ordem da fila', () => {
    const dois = comOuroNaEscola(step(base, [
      { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'woodcutter' }]), ESCOLA, custo * 2);
    const meio = avancar(dois, 5);
    expect(filaDaEscola(meio, ESCOLA).map((i) => i.estado)).toEqual(['treinando', 'aguardando']);
  });

  it('escola demolida leva a fila junto (saneamento)', () => {
    const semEscola = semOPredio(base, ESCOLA);
    expect(step(semEscola, []).treino).toEqual({});
  });
});
```

Helpers novos em `escola-cenario.ts`: `comOuroNaEscola(estado, id, ouro)` (grava
`estoque.entrada.gold`), `ouroNaEscola(estado, id)`, `avancar(estado, n)` (n ×
`step(estado, [])`).

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar `sistemaDasEscolas`**, com estas regras escritas em
      comentário porque cada uma é decisão:

```ts
/**
 * Um passo de fila por escola, por tick, na ordem de `predios.ordem`.
 *
 *  - SÓ O PRIMEIRO item da fila anda: a escola treina um de cada vez (GDD §2.3).
 *  - `aguardando -> treinando` COBRA `custoDeTreino` da gaveta `entrada` da
 *    própria escola. Sem ouro suficiente, o item espera — não é travamento: a
 *    demanda da fila é o que faz `gerarTarefas` pedir ouro ao armazém (Task 6).
 *  - O tick que cobra NÃO conta como tick de treino: `restam` nasce cheio e a
 *    contagem começa no tick seguinte (um treino custa `ticksPorTreino + 1`
 *    ticks de relógio, e é isso que o teste afirma).
 *  - `restam` chega a 0: nasce a unidade na porta (D1), o item sai, evento
 *    `unit-trained`. `restam` nunca fica gravado como 0.
 */
export function sistemaDasEscolas(state: GameState, dados: GameData = gameData): ResultadoDeSistema
```

`sanearFilas(state)` roda primeiro e apaga fila de prédio que não é escola
completa (demolição, F16; escola que voltou a obra não é representável hoje).
**Devolve o mesmo objeto se nada muda** (identidade, como `registrarConclusoes`).

`tileDeSaida` (em `systems/escolas.ts`, não em `escola.ts`, para não fechar
ciclo com `reservas.ts`):

```ts
/** D1: o primeiro tile ANDÁVEL da porta (borda sul). `null` se nenhum — a
 *  unidade pronta espera; na prática inalcançável, porque o ouro só chega por
 *  porta que é estrada, e estrada é andável. */
export function tileDeSaida(state: GameState, escola: PredioCompleto, dados: GameData = gameData): TileDeGrid | null {
  return tilesDaPorta(escola, dados).find((t) => tileAndavel(state, t, 'livre', dados)) ?? null;
}
```

`tick.ts`: a chamada entra **depois dos laborers e antes de `gerarTarefas`** —
mesmo motivo da F11c: o ouro entregue neste tick já começa o treino neste tick, e
o ouro consumido neste tick já abre a demanda do próximo pedido antes do gerador
rodar.

```ts
const laborers = sistemaDosLaborers(serfs.state, dados);
const escolas = sistemaDasEscolas(laborers.state, dados);
atual = gerarTarefas(escolas.state, dados);
events.push(...saneado.events, ...serfs.events, ...laborers.events, ...escolas.events);
```

- [ ] **Passo 4: rodar até passar**, depois `npm run test` inteiro.
- [ ] **Passo 5: commit** — `feat(F13a): sistemaDasEscolas cobra, conta e faz nascer na porta (Task 3)`

---

## Task 4: a regra do cancelamento × ouro, e o dado que a sustenta

**Files:** Modify `tools/data-rules.js`, `tests/F13a-fila.test.ts`;
Test: `tests/F03-dados-validados.test.ts` (só conferir que segue verde)

- [ ] **Passo 1: teste que falha**

```ts
it('cancelar ANTES de comecar nao custa ouro; cancelar DEPOIS nao devolve', () => {
  const custo = gameData.economia.schoolhouse.custoOuroPorUnidade;
  const dois = comOuroNaEscola(step(inicial, [
    { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'serf' },
    { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'laborer' },
  ]), ESCOLA, custo);                         // ouro para UM treino

  const comecou = step(dois, []);             // o primeiro cobra e comeca
  expect(ouroNaEscola(comecou, ESCOLA)).toBe(0);

  const segundo = filaDaEscola(comecou, ESCOLA)[1] as ItemDeFila;
  const cancelaOQueEspera = step(comecou, [{ type: 'CancelTraining', predio: ESCOLA, item: segundo.id }]);
  expect(ouroNaEscola(cancelaOQueEspera, ESCOLA)).toBe(0);   // nada a devolver: nunca pagou

  const primeiro = filaDaEscola(comecou, ESCOLA)[0] as ItemDeFila;
  const cancelaOQueTreina = step(comecou, [{ type: 'CancelTraining', predio: ESCOLA, item: primeiro.id }]);
  expect(ouroNaEscola(cancelaOQueTreina, ESCOLA)).toBe(0);   // gasto e gasto
  expect(contagemPorTipo(avancar(cancelaOQueTreina, 200)).serf).toBe(contagemPorTipo(inicial).serf);
});
```

- [ ] **Passo 2: rodar** — deve **passar** se as Tasks 2 e 3 estiverem certas. Se
      passar de primeira, o teste ainda vale: é a regra do BUILD_PLAN escrita como
      afirmação. (Se falhar, o bug está no ponto de cobrança.)

- [ ] **Passo 3: fechar o dado** em `tools/data-rules.js` — sem isto,
      `reembolsoSeNaoIniciado` é um campo que ninguém lê e que pode ser editado
      para `false` sem nada mudar no jogo (dado morto mentindo):

```js
// F13: a sim cobra o ouro ao INICIAR o treino. A politica alternativa
// (cobrar ao enfileirar e reembolsar quem for cancelado antes de comecar) NAO
// esta implementada — se o dado pudesse dize-la, o arquivo mentiria.
function validarPoliticaDeTreino(dados, erros) {
  const escola = (dados.economy && dados.economy.schoolhouse) || {};
  if (escola.reembolsoSeNaoIniciado !== true) {
    erros.push("economia/escola: economy.schoolhouse.reembolsoSeNaoIniciado precisa ser true — a sim cobra o ouro ao INICIAR o treino (F13a); 'false' nao esta implementado");
  }
  if (!Number.isInteger(escola.slotsDeFila) || escola.slotsDeFila < 1) {
    erros.push('economia/escola: slotsDeFila precisa ser inteiro >= 1');
  }
  if (!Number.isInteger(escola.custoOuroPorUnidade) || escola.custoOuroPorUnidade < 0) {
    erros.push('economia/escola: custoOuroPorUnidade precisa ser inteiro >= 0');
  }
}
```

Registrar em `validarTudo`.

- [ ] **Passo 4: rodar** `npm run validate:data` (deve passar) e
      `npx vitest run tests/F03-dados-validados.test.ts`.
- [ ] **Passo 5: commit** — `feat(F13a): cancelamento x ouro e a regra de dado que a sustenta (Task 4)`

---

## Task 5: `ouro-para-escola` — o tipo, a demanda e a reserva

**Files:** Modify `src/sim/state.ts`, `src/sim/escola.ts`, `src/sim/reservas.ts`,
`src/sim/jobs.ts`; Create `tests/F13a-ouro.test.ts`

**Interfaces:**
- Produz: `TarefaDeCarga`, `TarefaOuroParaEscola`, `TarefaDeTransporte`,
  `ehTarefaDeTransporte` (`state.ts`); `ouroNecessario` (`escola.ts`);
  `demandaNoDestino`, `vagaDoDestino`, `vagaDeOuroNaEscola` (`reservas.ts`);
  `criarTarefaDeOuro` (`jobs.ts`).
- Consome: `nivelDoTipo` (já lê o nível pelo id, sem mudança).

- [ ] **Passo 1: teste que falha** (`tests/F13a-ouro.test.ts`)

```ts
describe('F13a — a tarefa de ouro no quadro', () => {
  it('o nivel vem do dado, e ouro ganha de material', () => {
    expect(nivelDoTipo('ouro-para-escola')).toBe(2);
    expect(nivelDoTipo('ouro-para-escola')).toBeLessThan(nivelDoTipo('material-para-obra'));
  });

  it('so serf e elegivel', () => {
    expect(elegivelParaTarefa('ouro-para-escola', 'serf')).toBe(true);
    expect(elegivelParaTarefa('ouro-para-escola', 'laborer')).toBe(false);
  });

  it('a demanda e (itens aguardando x custo) - o ouro que a escola ja tem', () => {
    const custo = custoDeTreino();
    const tres = step(inicial, ['serf', 'serf', 'serf'].map((u) =>
      ({ type: 'EnqueueTraining', predio: ESCOLA, unidade: u }) as const));
    expect(ouroNecessario(tres, ESCOLA)).toBe(3 * custo);
    expect(ouroNecessario(comOuroNaEscola(tres, ESCOLA, custo), ESCOLA)).toBe(2 * custo);
    expect(ouroNecessario(inicial, ESCOLA)).toBe(0);
    // item que JA comecou nao pede ouro de novo (ele pagou)
    const comecou = step(comOuroNaEscola(tres, ESCOLA, custo), []);
    expect(ouroNecessario(comecou, ESCOLA)).toBe(2 * custo);
  });

  it('a vaga desconta a reserva, e a reserva e derivada da tarefa', () => {
    const tres = comEstradas(step(inicial, [ /* 3 pedidos */ ]), RUAS);
    const { state: comTarefa, id } = criarTarefaDeOuro(tres, { origem: ARMAZEM, destino: ESCOLA });
    expect(vagaDeOuroNaEscola(comTarefa, ESCOLA)).toBe(3);          // aberta nao reserva
    const reclamada = reclamar(comOuro(comTarefa, ARMAZEM, 3), id, SERF);
    expect(reclamada.ok).toBe(true);
    expect(vagaDeOuroNaEscola((reclamada as { state: GameState }).state, ESCOLA)).toBe(2);
  });

  it('claim recusado quando a escola nao pede nada', () => {
    const semFila = comOuro(comEstradas(inicial, RUAS), ARMAZEM, 3);
    const { state, id } = criarTarefaDeOuro(semFila, { origem: ARMAZEM, destino: ESCOLA });
    expect(reclamar(state, id, SERF)).toEqual({ ok: false, motivo: 'destino-sem-vaga' });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar.**

`state.ts` — a base comum e as duas irmãs (o comentário da
`TarefaMaterialParaObra` existente migra sem perder nada):

```ts
/** F13 — o que toda tarefa de CARGA tem: uma unidade de mercadoria, de um armazém
 *  até um destino. O que muda entre os tipos é só ONDE a carga entra na chegada
 *  (obra: `faltam--`; escola: `estoque.entrada++`) e o nível na escada. */
interface TarefaDeCarga extends TarefaBase {
  readonly estado: 'aberta' | 'reclamada' | 'carregando';
  readonly mercadoria: string;
  readonly origem: string;
  readonly destino: string;
}

export interface TarefaMaterialParaObra extends TarefaDeCarga { readonly tipo: 'material-para-obra'; }

/** F13 — nível 2 da escada (`delivery.json:ouro-para-escola`): ouro do armazém até
 *  uma escola COMPLETA. A vaga no destino não é capacidade (a escola não tem
 *  limite): é a DEMANDA DA FILA, `ouroNecessario` (`sim/escola.ts`). */
export interface TarefaOuroParaEscola extends TarefaDeCarga { readonly tipo: 'ouro-para-escola'; }

export type TarefaDeTransporte = TarefaMaterialParaObra | TarefaOuroParaEscola;
export type Tarefa = TarefaDeTransporte | TarefaConstruir;
/** Derivado da união: acrescentar um tipo de tarefa não exige editar esta linha. */
export type TipoDeTarefa = Tarefa['tipo'];

export const ehTarefaDeTransporte = (t: Tarefa): t is TarefaDeTransporte => t.tipo !== 'construir';
```

`escola.ts`:

```ts
/** O ouro que a fila desta escola ainda precisa receber: os itens que NÃO
 *  começaram, vezes o custo, menos o que já está na gaveta `entrada`. Nunca
 *  negativo. Item em treino já pagou e não conta. */
export function ouroNecessario(state: GameState, predioId: string, dados: GameData = gameData): number {
  const escola = state.predios.porId[predioId];
  if (!ehEscolaCompleta(escola)) return 0;
  const aguardando = filaDaEscola(state, predioId).filter((i) => i.estado === 'aguardando').length;
  const emCaixa = escola.estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
  return Math.max(0, aguardando * custoDeTreino(dados) - emCaixa);
}
```

`reservas.ts`: `reservadoNaOrigem`/`reservadoNoDestino` trocam
`t.tipo === 'material-para-obra'` por `ehTarefaDeTransporte(t)` (uma tarefa de
construir nunca tem mercadoria, então o filtro por mercadoria já a excluía de
fato; a mudança é de tipo, não de comportamento — teste de regressão: as suites
F09/F10 seguem verdes). Somam-se:

```ts
/** Quantas tarefas de transporte o destino ainda PEDE, sem descontar reserva:
 *  obra -> `faltam[m]`; escola -> `ouroNecessario`. */
export function demandaNoDestino(state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData): number

/** `demandaNoDestino - reservadoNoDestino`. Pode ficar NEGATIVA quando a demanda
 *  encolhe debaixo de uma reserva (fila cancelada com serf a caminho): é o sinal
 *  que `sanearTarefas` usa para cancelar a tarefa. */
export function vagaDoDestino(state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData): number

/** Atalho por id, para quem não tem a tarefa na mão (o gerador). */
export function vagaDeOuroNaEscola(state: GameState, predioId: string, dados: GameData = gameData): number
```

`vagaNoDestino(state, predioId, mercadoria)` (F09) **continua existindo e
inalterada** — é o que as suites antigas chamam, e `demandaNoDestino` a reusa
para o ramo de obra.

`jobs.ts`: `UNIDADE_ELEGIVEL_POR_TIPO['ouro-para-escola'] = TIPO_QUE_CARREGA`;
`criarTarefaDeOuro(state, { origem, destino })` (irmã de `criarTarefa`, com
`mercadoria: MERCADORIA_DE_OURO`); `planoDaTarefa`, `custoDaTarefa`,
`distanciaDaTarefa`, `portasDeColeta` e `marcarCarregando` passam a receber
`TarefaDeTransporte` (o corpo não muda: eles só leem `origem`/`destino`/
`mercadoria`); e o ramo de `reclamar`:

```ts
  if (ehTarefaDeTransporte(tarefa)) {
    if (disponivelNaOrigem(state, tarefa.origem, tarefa.mercadoria) < 1) return { ok: false, motivo: 'origem-sem-recurso' };
    if (vagaDoDestino(state, tarefa, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    if (custoDaTarefa(state, tarefa, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
  } else { /* construir, como hoje */ }
```

- [ ] **Passo 4: rodar até passar** — `npx vitest run tests/F13a-ouro.test.ts`,
      depois `npm run test` (as suites F09/F10/F11 são a rede de regressão da
      generalização; nenhuma pode mudar de resultado).
- [ ] **Passo 5: commit** — `feat(F13a): TarefaOuroParaEscola, demanda da fila como vaga no destino (Task 5)`

---

## Task 6: o gerador e o saneamento da tarefa de ouro

**Files:** Modify `src/sim/systems/jobs.ts`, `src/sim/jobs.ts`;
Test: `tests/F13a-ouro.test.ts`

- [ ] **Passo 1: teste que falha**

```ts
it('a fila com demanda faz nascer tarefa de ouro do armazem ligado', () => {
  const tres = comOuro(comEstradas(step(inicial, TRES_PEDIDOS), RUAS), ARMAZEM, 3);
  const depois = step(tres, []);
  const ouro = tarefasDe(depois, 'ouro-para-escola');
  expect(ouro).toHaveLength(3);
  expect(ouro.every((t) => t.origem === ARMAZEM && t.destino === ESCOLA && t.mercadoria === 'gold')).toBe(true);
});

it('sem estrada ate a escola nao nasce tarefa (a fila espera)', () => {
  const semRua = comOuro(step(inicial, TRES_PEDIDOS), ARMAZEM, 3);
  expect(tarefasDe(step(semRua, []), 'ouro-para-escola')).toHaveLength(0);
});

it('nunca mais tarefas do que a demanda, e o excedente e cancelado', () => {
  const um = comOuro(comEstradas(step(inicial, [UM_PEDIDO]), RUAS), ARMAZEM, 3);
  const comTarefa = step(um, []);
  expect(tarefasDe(comTarefa, 'ouro-para-escola')).toHaveLength(1);
  const item = filaDaEscola(comTarefa, ESCOLA)[0] as ItemDeFila;
  const cancelado = step(comTarefa, [{ type: 'CancelTraining', predio: ESCOLA, item: item.id }]);
  expect(tarefasDe(cancelado, 'ouro-para-escola')).toHaveLength(0);
});

it('ouro na frente de material: a escada ordena, nao a ordem de criacao', () => {
  // cenario com uma obra pedindo stone E uma fila pedindo ouro, ambos alcancaveis
  expect(tarefasEmOrdem(cenario, SERF).map((t) => t.tipo)[0]).toBe('ouro-para-escola');
});
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar.**
  - `gerarTarefasDeOuro(state, dados)` — função própria, chamada por
    `gerarTarefas` **antes** do laço das obras (a escada põe ouro no nível 2 e
    material no 3; a ordem de criação não muda prioridade, mas espelhar a escada
    evita surpresa na leitura do quadro).
  - `origemMaisPerto` passa a aceitar `Predio` em vez de `PredioEmObra` (só usa
    `distanciaEntrePredios`).
  - `motivoIndividual`: para transporte, o destino válido é obra (material) **ou
    escola completa** (ouro); qualquer outra coisa é `'destino-sumiu'`, e a obra
    que virou prédio continua `'destino-completo'`.
  - `abertaVale`: mesma generalização, mais `demandaNoDestino >= 1`.
  - Passo 2 de `sanearTarefas` (grupo): a condição de destino vira
    `vagaDoDestino(atual, t, dados) < 0` — para material é exatamente o
    `faltam < reservado` de hoje, e para ouro é a fila que encolheu.
  - Passo 4 (excedente): teto = `demandaNoDestino`.

- [ ] **Passo 4: rodar até passar**, `npm run test` inteiro. Atenção às suites
      F09/F10/F11: elas varrem `state.jobs.tarefas` e algumas filtram por tipo —
      nenhuma cria fila de treino, então a demanda é 0 e nenhuma tarefa de ouro
      nasce nelas. Se alguma mudar, é regressão de verdade, não ruído.
- [ ] **Passo 5: commit** — `feat(F13a): gerador e saneamento da tarefa de ouro (Task 6)`

---

## Task 7: o serf entrega na escola

**Files:** Modify `src/sim/systems/serfs.ts`, `src/sim/state.ts` (evento);
Test: `tests/F13a-ouro.test.ts`

- [ ] **Passo 1: teste que falha**

```ts
it('o serf leva o ouro do armazem ate a gaveta `entrada` da escola', () => {
  const cenario = comOuro(comEstradas(step(inicial, [UM_PEDIDO]), RUAS), ARMAZEM, 1);
  const fim = avancarAte(cenario, (e) => ouroNaEscola(e, ESCOLA) === 1, 200);
  expect(saidaDe(fim, ARMAZEM).gold ?? 0).toBe(0);
  expect(ouroNaEscola(fim, ESCOLA)).toBe(1);
  expect(tarefasDe(fim, 'ouro-para-escola')).toHaveLength(0);
  expect(fim.events).toContainEqual({ type: 'task-completed', tarefa: expect.any(String), destino: ESCOLA, mercadoria: 'gold' });
});

it('fila cancelada com o serf carregado: ele devolve ao armazem, sem sumico de ouro', () => {
  // cancela o item enquanto a tarefa esta `carregando`
  expect(totalDeOuro(depois)).toBe(totalDeOuro(cenario));   // conservacao
  expect(unidade.fsm).toBe('devolvendo');
});
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar.** Só `passoEntregando` muda de forma; o resto da FSM
      já é genérico (coleta, estrada, devolução):

```ts
/** Onde a carga entra, por tipo de tarefa. Exaustivo: um tipo novo de transporte
 *  sem ramo aqui reprova o typecheck. */
function aplicarEntrega(destino: Predio, tarefa: TarefaDeTransporte): Predio | null
```

- obra + `material-para-obra` → `faltam[m] - 1` (o de hoje);
- escola completa + `ouro-para-escola` → `estoque.entrada[gold] + 1`;
- qualquer combinação inválida → `null`, e o serf entra em `devolvendo` com
  `liberar('destino-completo')`, exatamente como hoje.

O portão de "ainda cabe?" passa a ser `demandaNoDestino(state, tarefa, dados) >= 1`
(para obra é `faltam >= 1`, idêntico ao de hoje).

`tarefaDoSerf` devolve `TarefaDeTransporte`. E o evento `task-completed` troca o
campo `obra` por **`destino`** — o nome deixou de ser verdade quando o destino
passou a poder ser uma escola. Nenhum teste lê esse campo hoje (só filtram por
`type`); conferir com `grep -rn "task-completed" src tests` antes e depois.

- [ ] **Passo 4: rodar até passar**, `npm run test` inteiro.
- [ ] **Passo 5: commit** — `feat(F13a): serf entrega ouro na escola; task-completed passa a falar 'destino' (Task 7)`

---

## Task 8: o aceite headless e a evidência

**Files:** Create `tests/F13a-aceite.test.ts`

Cenário — **nada de fixture de ouro na escola**: o ouro sai do armazém e chega
pelo serf, pelo caminho real.

- estado inicial (Storehouse `p1` em (29,30), Schoolhouse `p2` em (34,30), portas
  na linha y=33; 4 serfs e 2 laborers em (30..35, 34));
- fixture: estrada `linhaH(29, 36, 33)` ligando as duas portas (a estrada vem de
  fixture pelo mesmo motivo da F12: `PlaceRoad` debita pedra e amarraria o aceite
  ao preço da estrada);
- fixture: o ouro do armazém cai de 20 para **3** (é o "com 3 de ouro" do aceite).

- [ ] **Passo 1: escrever o aceite, nos passos que o BUILD_PLAN escreve**

```ts
describe('F13a — aceite headless do BUILD_PLAN', () => {
  it('3 pedidos com 3 de ouro viram 3 civis; o 4o espera sem ouro e sem gasto', () => {
    const cenario = comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 3);
    const enfileirado = step(cenario, TRES_PEDIDOS);

    const fim = avancarAte(enfileirado, (e) => filaDaEscola(e, ESCOLA).length === 0, 1200);

    // 1. o ouro saiu do armazem e foi consumido pela escola
    expect(saidaDe(fim, ARMAZEM).gold ?? 0).toBe(0);
    expect(ouroNaEscola(fim, ESCOLA)).toBe(0);
    // 2. as tres unidades existem, do tipo pedido, na porta da escola
    expect(novasUnidades(inicial, fim).map((u) => u.tipo)).toEqual(['stonemason', 'woodcutter', 'serf']);
    // 3. uma por `ticksPorTreino` (o dado, nunca um numero digitado)
    const nascimentos = ticksDosEventos(fim, 'unit-trained');
    expect(nascimentos[1] - nascimentos[0]).toBeGreaterThanOrEqual(gameData.economia.schoolhouse.ticksPorTreino);
    // 4. o quarto pedido, sem ouro: fica aguardando, nao cria unidade, nao gasta
    const quarto = step(fim, [{ type: 'EnqueueTraining', predio: ESCOLA, unidade: 'baker' }]);
    const depois = avancar(quarto, 400);
    expect(filaDaEscola(depois, ESCOLA).map((i) => i.estado)).toEqual(['aguardando']);
    expect(novasUnidades(fim, depois)).toEqual([]);
    expect(totalDeOuro(depois)).toBe(0);
    // 5. rejeicao de comando de verdade: fila cheia
    expect(recusas(step(depois, PEDIDOS_ATE_ESTOURAR)).map((e) => e.motivo)).toContain('fila-cheia');
  });

  it('determinismo e save/load com a fila em curso', () => {
    compararComESemSave({
      seed: 7, totalTicks: 400, saveAtTick: 120,
      comandosNoTick: (t) => (t === 5 ? TRES_PEDIDOS : []),
      antesDoStep: (e) => (e.tick === 0 ? comOuroNoArmazem(comEstradas(e, RUAS), ARMAZEM, 3) : e),
    });
  });
});
```

- [ ] **Passo 2: rodar e ajustar o orçamento de ticks** (3 × (150 + 1) + viagem;
      1200 ticks é folga). Se a asserção 3 falhar por um tick, é o "tick da
      cobrança" da Task 3 — conferir a conta antes de mexer no número.

- [ ] **Passo 3: gravar a evidência** com `gravarEvidencia('F13a', { ... })`:
      tick de cada `unit-trained`, ouro do armazém e da escola ao longo do
      cenário, tarefas de ouro criadas/concluídas, fila final, posição das três
      unidades novas, e o estado do quarto pedido.

- [ ] **Passo 4: abrir a evidência com Read** (CLAUDE.md §7: sem isto a feature
      não pode ser marcada) e conferir número por número contra o aceite.

- [ ] **Passo 5: commit** — `feat(F13a): aceite headless, do EnqueueTraining ao civil na porta (Task 8)`

---

## Task 9: documentação, verificação e fechamento

**Files:** Modify `PROGRESS.md`, `test-results.json`

- [ ] **Passo 1: `PROGRESS.md`** — uma seção `(origem: F13a)` com: o contrato de
      `GameState.treino` (D4, fila vazia = ausência), o contrato de
      `TarefaDeCarga`/`TarefaDeTransporte` (o que a F15 herda ao criar os níveis
      4-7), as decisões D1/D2/D3, a ordem nova do tick, e o que ficou **fora**:
      o painel (F13b), a unidade treinada que ainda **não ocupa prédio** (F14) e
      não come (F20). Separar verificado de hipótese, como manda a §6.

- [ ] **Passo 2: `npm run verify`** — typecheck, lint, validate:data e test
      verdes; o selo `.verify-ok` vale 15 minutos.

- [ ] **Passo 3: `test-results.json`** — trocar a chave `"F13-schoolhouse-fila"`
      por `"F13a-schoolhouse-fila": { "passes": true }` e
      `"F13b-schoolhouse-painel": { "passes": false }` (mesmo padrão da quebra
      F11a/b/c).

- [ ] **Passo 4: commit** — `feat(F13a): documentacao e test-results.json (Task 9)`

---

## Self-review (feito sobre o BUILD_PLAN antes de executar)

| Requisito do aceite original | Onde é cumprido |
|---|---|
| fila de até 5 slots | Task 1 (teto do dado, `fila-cheia`) |
| um botão por tipo de trabalhador | F13b (painel); o comando aceita qualquer civil de `units.json` — Task 1 |
| 1 gold por unidade | Tasks 3/4, de `custoOuroPorUnidade` (D3) |
| cobrado ao iniciar | Task 3 (transição `aguardando -> treinando`) |
| cancelar devolve o ouro só se não começou | Task 4 |
| 3 unidades com 3 de ouro, ouro 0 | Task 8 |
| criadas após o tempo de treino | Task 8 (intervalo ≥ `ticksPorTreino`) |
| 4ª sem ouro: rejeição | Task 8, na leitura D2 (+ recusa de comando de verdade) |
| screenshot do painel | **F13b** — fora desta sessão, registrado na fila |
| alargar `Tarefa.tipo` junto do produtor | Tasks 5-7 |
| nível na escada por `id`, sem número em `.ts` | Task 5 (`nivelDoTipo`) |

**Pontos de atenção do executor:**
1. `sim/escola.ts` **não pode** importar `estradas.ts` nem `pathfinding.ts`:
   `reservas.ts` importa `escola.ts`, e `estradas.ts` importa `reservas.ts` — o
   ciclo fecharia. Por isso `tileDeSaida` mora em `systems/escolas.ts`.
2. `treino` tem que entrar no objeto devolvido por `step()` (`tick.ts` monta o
   estado campo a campo; esquecer o campo o apaga todo tick, em silêncio).
3. Fila vazia **apaga** a entrada — sempre por `comFila`, nunca à mão.
4. `restam` nunca é gravado como 0.
5. Rodar `npm run test` inteiro ao fim de cada tarefa, não só o arquivo novo:
   as Tasks 5-7 mexem em código que F09, F10 e F11 usam.
