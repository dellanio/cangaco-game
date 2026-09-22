# F11b — JobBoard: tarefa de construir — Implementation Plan (aprovado)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans
> task-by-task. **Não** use superpowers:subagent-driven-development nem
> dispatching-parallel-agents — proibidos pelo CLAUDE.md §11 deste projeto.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** aprovado pelo operador em 2026-09-21, com quatro ajustes (ver
"Ajustes do operador" abaixo). Substitui o rascunho em
`docs/superpowers/plans/2026-09-21-f11b-jobboard-construir.md` (removido).

**Goal:** Alargar o JobBoard (`sim/`, só) para um segundo tipo de tarefa,
`'construir'`, que o laborer vai reclamar na F11c. `Tarefa` vira união
discriminada; `reclamar` generaliza a checagem de unidade elegível; o gerador
cria até `laborersMaximosPorObra` tarefas de construir por obra.

**Architecture:** `Tarefa` passa de interface única para união discriminada
por `tipo` (`TarefaMaterialParaObra | TarefaConstruir`), seguindo o mesmo
molde que `Predio = PredioCompleto | PredioEmObra` (F07). A elegibilidade
serf/laborer é uma função pura (`elegivelParaTarefa`) que substitui o
`unidade.tipo !== TIPO_QUE_CARREGA` hardcoded. `reclamar`, `sanearTarefas` e
`gerarTarefas` passam a ramificar por `tarefa.tipo`. **Sem FSM de laborer
nesta feature** — as tarefas `'construir'` nascem e podem ser reclamadas, mas
nada as consome ainda (isso é a F11c, que vem a seguir).

**Nota sobre TDD nesta feature:** uma migração de tipo para união
discriminada não se divide em passos independentemente verdes sem criar
andaime descartável — o mesmo vale para `Predio` na F07, que não teve esse
andaime. As Tasks 2 a 9 formam um único arco vermelho-até-verde: cada uma tem
teste novo para o comportamento que acrescenta, mas `npm run typecheck` só
fecha limpo ao fim da Task 9, e `npm run test` (suíte inteira) só fecha verde
ao fim da Task 10. Isso é esperado, não um desvio do processo.

**Tech Stack:** TypeScript estrito, Vitest.

**Spec:** Decisões do operador (replicadas abaixo) + `BUILD_PLAN.md` (item
F11b, dividido pela Task 11) + `PROGRESS.md` (contrato do JobBoard, "origem:
F09").

## Ajustes do operador (aplicados neste documento)

1. **Um arquivo de teste só para esta feature.** Todo teste novo desta
   feature vive em `tests/F11b-jobboard.test.ts` (criado na Task 2, alargado
   pelas Tasks 3, 4, 5, 7, 8) — nada entra em `tests/F09-*.test.ts`. O
   `afterAll` desse arquivo chama `gravarEvidencia('F11b', {...})` no molde de
   `tests/F09-sistema.test.ts` (ver o `afterAll` de lá). A Task 12 só abre
   `test-output/F11b.json` com Read.
2. **Referências cruzadas atualizadas na Task 11** — listadas linha a linha
   (BUILD_PLAN.md e PROGRESS.md, conforme pedido; `docs/historico/F01-F11a.md`
   fica de fora por ser arquivo morto/congelado, e `IDEIAS.md` foi incluído
   por ter o mesmo tipo de referência cruzada, sinalizado separadamente).
3. **Execução em branch.** `git switch -c F11b` antes da Task 1. Commits
   vermelhos das Tasks 2–9 ficam no branch. Ao final, com `verify` verde,
   `git switch main && git merge --no-ff F11b`. Sem push.
4. **Revisão do diff da Task 10.** Ao fim da Task 10, `git diff` dos arquivos
   de teste F09/F10 editados, para confirmar que nenhum valor esperado
   (`expect(...).toBe/toEqual/toHaveLength(...)`) mudou — só filtros
   acrescentados. Se algum valor mudou, parar e reportar antes de commitar.

## Global Constraints

- `src/sim/` não importa `phaser`, não toca `window`/`document`/`canvas`.
- Nenhum número de balanceamento novo em `.ts`: `laborersMaximosPorObra` vem
  de `data/buildings.json` (`construcao.laborersMaximosPorObra`), nunca
  hardcoded.
- `'construir'` **não entra** na escada de `data/delivery.json`: serf e
  laborer não disputam tarefa (decisão do operador, não reabrir).
- Posse da obra é só pelo JobBoard — nenhum campo de posse em `Obra`, nenhuma
  unidade varre `predios.ordem` para achar trabalho.
- `npm run test`, `npm run typecheck`, `npm run lint`, `npm run validate:data`
  verdes ao fim (Definition of Done, CLAUDE.md §7).

---

## Decisões do operador replicadas aqui (não reabrir)

1. **Posse pelo JobBoard.** `Tarefa` vira união discriminada com um `tipo:
   'construir'`. Sem campo de posse em `Obra`. `'construir'` não entra na
   escada de `delivery.json`. Quem decide quem reclama é o tipo de unidade —
   generaliza a checagem "a unidade é serf" do `reclamar`.
2. **Vários laborers por obra, com teto.** `laborersMaximosPorObra: 4` em
   `buildings.json`, dentro de `construcao`, validado como inteiro ≥ 1. O
   gerador cria até esse número de tarefas de construir por obra.
3. **Estágios visuais** (hp-derivados, `render/`, função pura) são da F11c,
   não desta feature — só registrados aqui como contrato futuro (Task 11).
4. **F11b vira duas features**, e esta é só a primeira (JobBoard, sim only).

---

## Task 0: branch

- [ ] **Step 1**

```bash
git status   # confirmar working tree limpo antes de ramificar
git switch -c F11b
```

---

## Task 1: Dado — `laborersMaximosPorObra`

**Files:**
- Modify: `data/buildings.json` (bloco `construcao`)
- Modify: `src/sim/data/types.ts` (`ConstrucaoData`)
- Modify: `src/sim/data/loader.ts` (montagem de `construcao`)
- Modify: `tools/data-rules.js` (`validarPredios`)
- Test: `tests/F03-dados-validados.test.ts`

**Interfaces:**
- Produces: `GameData.construcao.laborersMaximosPorObra: number` — lido por
  `sim/reservas.ts` (Task 5) e `sim/systems/jobs.ts` (Tasks 7–8).

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `tests/F03-dados-validados.test.ts` (mesmo padrão dos
testes de `hpPorMartelada` já existentes no arquivo):

```ts
describe('F11b — buildings.construcao.laborersMaximosPorObra', () => {
  it('o dado real e um inteiro >= 1', () => {
    expect(Number.isInteger(gameData.construcao.laborersMaximosPorObra)).toBe(true);
    expect(gameData.construcao.laborersMaximosPorObra).toBeGreaterThanOrEqual(1);
  });

  it('validate:data reprova nao-inteiro e reprova < 1', () => {
    const dados = dadosReais();
    const naoInteiro = { ...dados, buildings: { ...dados.buildings, construcao: { ...dados.buildings.construcao, laborersMaximosPorObra: 2.5 } } };
    expect(validarTudo(naoInteiro).some((e) => e.startsWith('predios/laborers-maximos-por-obra'))).toBe(true);

    const zero = { ...dados, buildings: { ...dados.buildings, construcao: { ...dados.buildings.construcao, laborersMaximosPorObra: 0 } } };
    expect(validarTudo(zero).some((e) => e.startsWith('predios/laborers-maximos-por-obra'))).toBe(true);
  });
});
```

Se o arquivo não tiver um helper `dadosReais()` pronto, usar o mesmo padrão de
`dadosReaisComEscada` de `tests/F09-escada.test.ts` (ler os nove arquivos de
`data/` com `ARQUIVOS` de `tools/data-schema.js`), sem o `escada` sobrescrito.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- F03-dados-validados`
Expected: FAIL — `gameData.construcao.laborersMaximosPorObra` é `undefined`.

- [ ] **Step 3: Dado — `buildings.json`**

Bloco `construcao`:

```json
{
  "hpPorMaterialEntregue": 50,
  "hpPorMartelada": 5,
  "laborersMaximosPorObra": 4,
  "segundosPorMartelada_base": 1,
  "segundosNivelamentoPorTile_base": 2,
  "escala": "construcao",
  "devolucaoAoDemolir": 0.5
}
```

- [ ] **Step 4: Tipo — `src/sim/data/types.ts`**

```ts
export interface ConstrucaoData {
  readonly hpPorMaterialEntregue: number;
  readonly hpPorMartelada: number;
  readonly laborersMaximosPorObra: number;
  readonly ticksPorMartelada: Ticks;
  readonly ticksNivelamentoPorTile: Ticks;
  readonly devolucaoAoDemolir: number;
}
```

- [ ] **Step 5: Loader — `src/sim/data/loader.ts`**

No literal `construcao`, acrescentar o passe direto (sem escala — é
contagem, não duração):

```ts
  const construcao: ConstrucaoData = {
    hpPorMaterialEntregue: raw.buildings.construcao.hpPorMaterialEntregue,
    hpPorMartelada: raw.buildings.construcao.hpPorMartelada,
    laborersMaximosPorObra: raw.buildings.construcao.laborersMaximosPorObra,
    ticksPorMartelada: registrar(/* ... inalterado ... */),
    ticksNivelamentoPorTile: registrar(/* ... inalterado ... */),
    devolucaoAoDemolir: raw.buildings.construcao.devolucaoAoDemolir,
  };
```

- [ ] **Step 6: Validação — `tools/data-rules.js`**

Em `validarPredios`, logo após a extração de `hpPorMartelada`:

```js
  const laborersMaximosPorObra = dados.buildings && dados.buildings.construcao
    && dados.buildings.construcao.laborersMaximosPorObra;
  if (!(Number.isInteger(laborersMaximosPorObra) && laborersMaximosPorObra >= 1)) {
    erros.push(`predios/laborers-maximos-por-obra: buildings.construcao.laborersMaximosPorObra=${laborersMaximosPorObra}, precisa ser inteiro >= 1`);
  }
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npm run test -- F03-dados-validados && npm run validate:data`

- [ ] **Step 8: Commit**

```bash
git add data/buildings.json src/sim/data/types.ts src/sim/data/loader.ts tools/data-rules.js tests/F03-dados-validados.test.ts
git commit -m "feat(F11b): laborersMaximosPorObra em buildings.json, validado"
```

---

## Task 2: `Tarefa` vira união discriminada + criar `tests/F11b-jobboard.test.ts`

**Files:**
- Modify: `src/sim/state.ts`
- Create: `tests/F11b-jobboard.test.ts` (todo teste novo da feature vai aqui
  — ajuste 1 do operador)

**Interfaces:**
- Produces: `TipoDeTarefa = 'material-para-obra' | 'construir'`;
  `TarefaMaterialParaObra`, `TarefaConstruir`, `Tarefa = TarefaMaterialParaObra
  | TarefaConstruir` — todo o resto do plano consome estes três tipos.

- [ ] **Step 1: Criar `tests/F11b-jobboard.test.ts` com o teste que falha**

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState, Tarefa, TarefaConstruir } from '../src/sim/state';
import { gravarEvidencia } from './helpers/evidence';
import {
  cenarioLigado, comObra, comTarefas, comUnidadeEm, inicial, laborersDoCenario, serfsDoCenario,
} from './helpers/jobs-cenario';

describe('F11b — Tarefa vira uniao discriminada', () => {
  it('uma tarefa de construir (sem mercadoria/origem) sobrevive ao JSON de ida e volta', () => {
    const construir: TarefaConstruir = { id: 't1', numero: 1, tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null };
    const estado = comTarefas(cenarioLigado(), [construir]);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
    expect(estado.jobs.tarefas.porId.t1).not.toHaveProperty('mercadoria');
    expect(estado.jobs.tarefas.porId.t1).not.toHaveProperty('origem');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run typecheck`
Expected: FAIL — `TarefaConstruir` não existe ainda em `state.ts`.

- [ ] **Step 3: Escrever a união em `src/sim/state.ts`**

Substituir o bloco atual de `TipoDeTarefa` e `Tarefa` (linhas 160–197) por:

```ts
/**
 * O tipo da tarefa. `'material-para-obra'` (nivel 3 da escada de
 * `delivery.json`) e `'construir'` (F11b — o laborer nivela/martela; NAO
 * entra na escada, decisao do operador: serf e laborer nao disputam tarefa).
 * Cada feature que criar um produtor novo (F13, F15, F20) alarga este tipo.
 */
export type TipoDeTarefa = 'material-para-obra' | 'construir';

interface TarefaBase {
  /** `t<numero>`, do mesmo contador `proximoId` de predios e unidades. */
  readonly id: string;
  /** O desempate compara ESTE numero; comparar a string errararia ('t10' < 't2'). */
  readonly numero: number;
  /** Id da unidade que a reclamou; `null` (nunca `undefined`) se aberta. */
  readonly reclamadaPor: string | null;
}

/**
 * CONTRATO HERDADO (F10, F11b, F13, F15) — a tarefa original do JobBoard
 * (F09): uma unidade de recurso, de um armazem ATE uma obra. So o serf
 * (`TIPO_QUE_CARREGA`) e elegivel.
 *
 * Ciclo (F10): `aberta` -> `reclamada` -> `carregando` -> (entrega: some).
 */
export interface TarefaMaterialParaObra extends TarefaBase {
  readonly tipo: 'material-para-obra';
  readonly estado: 'aberta' | 'reclamada' | 'carregando';
  readonly mercadoria: string;
  /** Id do armazem de onde a unidade sai. */
  readonly origem: string;
  /** Id da obra que recebe. */
  readonly destino: string;
}

/**
 * F11b — uma vaga de trabalho de construcao numa obra. So o laborer
 * (`TIPO_QUE_CONSTROI`) e elegivel. SEM `mercadoria`/`origem`: nao carrega
 * nada, e por isso SEM `'carregando'` no `estado` — o ciclo e so `aberta ->
 * reclamada -> (a obra completa: a F11c decide como a tarefa sai do quadro)`.
 * A vaga e o TETO `construcao.laborersMaximosPorObra` (dado), nao um campo
 * em `Obra` — a posse continua so no JobBoard (decisao do operador).
 */
export interface TarefaConstruir extends TarefaBase {
  readonly tipo: 'construir';
  readonly estado: 'aberta' | 'reclamada';
  /** Id da obra. */
  readonly destino: string;
}

/**
 * CONTRATO HERDADO (F10, F11b, F11c, F13, F15) — uma unidade de trabalho do
 * JobBoard. Uniao discriminada por `tipo`, no molde de `Predio` (F07): uma
 * tarefa de construir com `mercadoria`, ou uma de material sem `origem`, NAO
 * e representavel.
 *
 * A RESERVA nao e um campo: e DERIVADA das tarefas (`sim/reservas.ts`). Ver
 * `elegivelParaTarefa` (`sim/jobs.ts`) para quem pode reclamar cada tipo.
 */
export type Tarefa = TarefaMaterialParaObra | TarefaConstruir;
```

O resto de `state.ts` não muda: `JobBoard.tarefas: Colecao<Tarefa>` já era
genérico sobre `Tarefa`.

- [ ] **Step 4: Rodar e confirmar (parcialmente) — esperado MAIS erros**

Run: `npm run typecheck`
Expected: ainda FAIL, agora em `jobs.ts`, `reservas.ts`, `systems/jobs.ts`,
`systems/serfs.ts` e nos test helpers — exatamente os que as Tasks 3–9
corrigem. Confirmar que os erros são só nesses arquivos antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add src/sim/state.ts tests/F11b-jobboard.test.ts
git commit -m "feat(F11b): Tarefa vira uniao discriminada (material-para-obra | construir)"
```

(Commit intermediário com o typecheck vermelho é aceitável — ver a nota de
TDD no cabeçalho.)

---

## Task 3: elegibilidade + criação da tarefa de construir

**Files:**
- Modify: `src/sim/jobs.ts`
- Modify: `tests/F11b-jobboard.test.ts`

**Interfaces:**
- Consumes: `TarefaConstruir`, `TarefaMaterialParaObra`, `Tarefa`,
  `TipoDeTarefa` (Task 2).
- Produces: `TIPO_QUE_CONSTROI = 'laborer'`; `elegivelParaTarefa(tipoDaTarefa,
  tipoDaUnidade): boolean`; `criarTarefaDeConstrucao(state, destino): {
  state, id }` — consumido pela Task 8.

- [ ] **Step 1: Acrescentar o teste que falha em `tests/F11b-jobboard.test.ts`**

```ts
import { criarTarefaDeConstrucao, elegivelParaTarefa, TIPO_QUE_CONSTROI } from '../src/sim/jobs';

describe('F11b — elegibilidade por tipo de tarefa', () => {
  it('material-para-obra so e elegivel para serf; construir so para laborer', () => {
    expect(elegivelParaTarefa('material-para-obra', 'serf')).toBe(true);
    expect(elegivelParaTarefa('material-para-obra', 'laborer')).toBe(false);
    expect(elegivelParaTarefa('construir', 'laborer')).toBe(true);
    expect(elegivelParaTarefa('construir', 'serf')).toBe(false);
  });

  it('TIPO_QUE_CONSTROI e laborer', () => {
    expect(TIPO_QUE_CONSTROI).toBe('laborer');
  });

  it('criarTarefaDeConstrucao cria uma tarefa aberta, sem mercadoria/origem', () => {
    const { state, id } = criarTarefaDeConstrucao(inicial, 'obra-a');
    const t = state.jobs.tarefas.porId[id];
    expect(t).toEqual({ id, numero: expect.any(Number), tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 3: Implementar em `src/sim/jobs.ts`**

Import de `TarefaConstruir`, `TarefaMaterialParaObra` no topo.

Logo abaixo de `TIPO_QUE_CARREGA`:

```ts
/** So o laborer constroi. Id estrutural, como `TIPO_QUE_CARREGA`. */
export const TIPO_QUE_CONSTROI = 'laborer';

const UNIDADE_ELEGIVEL_POR_TIPO: Readonly<Record<TipoDeTarefa, string>> = {
  'material-para-obra': TIPO_QUE_CARREGA,
  construir: TIPO_QUE_CONSTROI,
};

/** Generaliza a checagem "a unidade e serf": cada tipo de tarefa tem UM tipo
 *  de unidade elegivel — serf e laborer nao disputam tarefa (decisao do
 *  operador, F11b). */
export function elegivelParaTarefa(tipoDaTarefa: TipoDeTarefa, tipoDaUnidade: string): boolean {
  return UNIDADE_ELEGIVEL_POR_TIPO[tipoDaTarefa] === tipoDaUnidade;
}
```

Substituir `criarTarefa` por uma versão que reusa um helper privado, e
acrescentar `criarTarefaDeConstrucao`:

```ts
function inserirTarefa(state: GameState, tarefa: Tarefa): { readonly state: GameState; readonly id: string } {
  return {
    id: tarefa.id,
    state: {
      ...state,
      proximoId: tarefa.numero + 1,
      jobs: {
        tarefas: {
          porId: { ...state.jobs.tarefas.porId, [tarefa.id]: tarefa },
          ordem: [...state.jobs.tarefas.ordem, tarefa.id],
        },
      },
    },
  };
}

/** Cria uma tarefa de material ABERTA (nao reserva nada). O id e o numero vem
 *  do contador `proximoId`, compartilhado com predios e unidades. */
export function criarTarefa(
  state: GameState,
  campos: { readonly mercadoria: string; readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaMaterialParaObra = {
    id: `t${numero}`, numero, tipo: 'material-para-obra', mercadoria: campos.mercadoria,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F11b — cria uma vaga de construcao ABERTA na obra `destino`. Sem
 *  mercadoria/origem: o laborer nao carrega material. */
export function criarTarefaDeConstrucao(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaConstruir = { id: `t${numero}`, numero, tipo: 'construir', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}
```

(`criarTarefa` perdia o parâmetro opcional `tipo?:` — nenhum chamador o
usava. Removê-lo é simplificação, não mudança de contrato observável.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 5: Commit**

```bash
git add src/sim/jobs.ts tests/F11b-jobboard.test.ts
git commit -m "feat(F11b): elegivelParaTarefa e criarTarefaDeConstrucao"
```

---

## Task 4: restringir caminho/custo/ordenação a `material-para-obra`

**Files:**
- Modify: `src/sim/jobs.ts`
- Modify: `tests/F11b-jobboard.test.ts`

**Interfaces:**
- Consumes: `TarefaMaterialParaObra` (Task 2), `elegivelParaTarefa` (Task 3).
- Produces: `distanciaDaTarefa`, `portasDeColeta`, `planoDaTarefa`,
  `custoDaTarefa` tipados por `TarefaMaterialParaObra`; `tarefasEmOrdem`
  devolve `TarefaMaterialParaObra[]` e nunca mais chama `nivelDoTipo` sobre
  uma tarefa `'construir'`.

- [ ] **Step 1: Acrescentar o teste que falha**

```ts
import { tarefaDe, tile } from './helpers/jobs-cenario';
import { tarefasEmOrdem } from '../src/sim/jobs';

describe('F11b — tarefasEmOrdem exclui construir da escada', () => {
  it('nao quebra com uma tarefa de construir no quadro', () => {
    const [serf1] = serfsDoCenario(inicial);
    if (!serf1) throw new Error('fixture: sem serf');
    const material = tarefaDe({ numero: 1 });
    const construir: TarefaConstruir = { id: 't2', numero: 2, tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null };
    const estado = comTarefas(cenarioLigado(), [material, construir]);
    expect(() => tarefasEmOrdem(estado)).not.toThrow();
    expect(tarefasEmOrdem(estado).map((t) => t.id)).toEqual(['t1']);
    expect(tarefasEmOrdem(estado, serf1).map((t) => t.id)).toEqual(['t1']);
  });
});
```

(Ajustar imports já presentes no topo do arquivo em vez de duplicar.)

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- F11b-jobboard`
Expected: FAIL — `nivelDoTipo('construir', ...)` lança hoje.

- [ ] **Step 3: Implementar em `src/sim/jobs.ts`**

Trocar as assinaturas de `distanciaDaTarefa`, `portasDeColeta`,
`planoDaTarefa`, `custoDaTarefa` de `tarefa: Tarefa` para `tarefa:
TarefaMaterialParaObra` — corpo inalterado.

Substituir `tarefasEmOrdem`:

```ts
/**
 * As tarefas de MATERIAL abertas na ordem de escolha: `(nivel, custo A* em
 * ticks, numero)`. `'construir'` fica fora — nao esta na escada de
 * `delivery.json` (decisao do operador, F11b: serf e laborer nao disputam
 * tarefa). Com `unidadeId` filtra tambem por elegibilidade antes de ordenar.
 */
export function tarefasEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaMaterialParaObra[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaMaterialParaObra => t !== undefined && t.tipo === 'material-para-obra' && t.estado === 'aberta')
    .filter((t) => unidade === null || elegivelParaTarefa(t.tipo, unidade.tipo));
  const chaves = new Map(candidatas.map((t) => [t.id, {
    nivel: nivelDoTipo(t.tipo, dados),
    custo: custoDaTarefa(state, t, unidadeId, dados) ?? Number.POSITIVE_INFINITY,
  }]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id);
    const cb = chaves.get(b.id);
    if (!ca || !cb) return 0;
    if (ca.nivel !== cb.nivel) return ca.nivel - cb.nivel;
    if (ca.custo !== cb.custo) return ca.custo < cb.custo ? -1 : 1;
    return a.numero - b.numero;
  });
}
```

`reclamarMelhor` não muda de corpo.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 5: Commit**

```bash
git add src/sim/jobs.ts tests/F11b-jobboard.test.ts
git commit -m "feat(F11b): tarefasEmOrdem exclui construir da escada de material"
```

---

## Task 5: `reclamar` ramifica por tipo; vaga de construção

**Files:**
- Modify: `src/sim/reservas.ts`
- Modify: `src/sim/jobs.ts` (`reclamar`)
- Modify: `tests/F11b-jobboard.test.ts`

**Interfaces:**
- Consumes: `TarefaConstruir`/`TarefaMaterialParaObra` (Task 2),
  `elegivelParaTarefa` (Task 3), `dados.construcao.laborersMaximosPorObra`
  (Task 1).
- Produces: `laborersReservados(state, obraId): number`,
  `vagaDeConstrucao(state, obraId, dados?): number`.

- [ ] **Step 1: Acrescentar o teste que falha**

```ts
import { reclamar } from '../src/sim/jobs';

describe('F11b — reclamar tarefa de construir', () => {
  const base = () => criarTarefaDeConstrucao(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 } }), 'obra-a');

  it('so laborer reclama; serf e recusado com unidade-invalida', () => {
    const [serf1] = serfsDoCenario(inicial);
    const [laborer1] = laborersDoCenario(inicial);
    if (!serf1 || !laborer1) throw new Error('fixture: sem serf/laborer');
    const { state, id } = base();
    expect(reclamar(state, id, serf1)).toEqual({ ok: false, motivo: 'unidade-invalida' });
    expect(reclamar(state, id, laborer1).ok).toBe(true);
  });

  it('respeita o teto de laborersMaximosPorObra (4 no dado real)', () => {
    const laborers = laborersDoCenario(inicial);
    let estado = base().state;
    for (let i = 0; i < gameData.construcao.laborersMaximosPorObra; i++) {
      const l = laborers[i] ?? `laborer-extra-${i}`; // ver Step 3: garantir laborers suficientes no cenario
      const { state: comMaisUma, id } = criarTarefaDeConstrucao(estado, 'obra-a');
      const r = reclamar(comMaisUma, id, l);
      expect(r.ok, `laborer #${i}`).toBe(true);
      estado = r.ok ? r.state : comMaisUma;
    }
    const { state: comAQuinta, id: quinta } = criarTarefaDeConstrucao(estado, 'obra-a');
    const quintoLaborer = laborers[gameData.construcao.laborersMaximosPorObra] ?? 'laborer-extra-quinto';
    expect(reclamar(comAQuinta, quinta, quintoLaborer)).toMatchObject({ ok: false, motivo: 'destino-sem-vaga' });
  });
});
```

**Nota de implementação:** confirmar no Step 3 quantos `laborer` o cenário
inicial (`data/economy.json`) tem. Se forem menos que
`laborersMaximosPorObra + 1`, usar `comUnidadeEm` para reposicionar
serfs/laborers extras do cenário como laborers ad hoc não é possível (tipo é
fixo) — nesse caso, construir o cenário do teste do teto criando unidades
extra diretamente via um helper novo em `jobs-cenario.ts` (`comLaborerExtra`
ou similar) em vez de depender só de `laborersDoCenario`. Decidir isso ao
rodar o Step 2 e ver o array real.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 3: Implementar `vagaDeConstrucao` em `src/sim/reservas.ts`**

```ts
import type { GameState } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
```

No fim do arquivo:

```ts
/** Vagas de CONSTRUCAO (F11b) reservadas na obra `predioId`: tarefas
 *  `'construir'` que nao estao abertas — so `'reclamada'` existe para esse
 *  tipo (sem `'carregando'`, o laborer nao carrega nada). */
export function laborersReservados(state: GameState, predioId: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.tipo === 'construir' && t.estado !== 'aberta' && t.destino === predioId) soma += 1;
  }
  return soma;
}

/** A vaga de laborer ainda reservavel na obra: teto (dado) - reservado. So
 *  obra. O teto nunca encolhe em runtime (e constante do dado), diferente de
 *  `faltam` — por isso nao ha checagem de grupo equivalente em
 *  `sanearTarefas` para este tipo (ver o comentario la). */
export function vagaDeConstrucao(state: GameState, predioId: string, dados: GameData = gameData): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'obra') return 0;
  return dados.construcao.laborersMaximosPorObra - laborersReservados(state, predioId);
}
```

- [ ] **Step 4: `reclamar` ramifica — `src/sim/jobs.ts`**

```ts
export function reclamar(
  state: GameState, tarefaId: string, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaim {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa) return { ok: false, motivo: 'tarefa-inexistente' };
  if (tarefa.estado !== 'aberta') return { ok: false, motivo: 'tarefa-ja-reclamada' };

  const unidade = state.unidades.porId[unidadeId];
  if (!unidade || !elegivelParaTarefa(tarefa.tipo, unidade.tipo)) return { ok: false, motivo: 'unidade-invalida' };
  if (unidadeJaTemTarefa(state, unidadeId)) return { ok: false, motivo: 'unidade-ocupada' };

  if (tarefa.tipo === 'material-para-obra') {
    if (disponivelNaOrigem(state, tarefa.origem, tarefa.mercadoria) < 1) return { ok: false, motivo: 'origem-sem-recurso' };
    if (vagaNoDestino(state, tarefa.destino, tarefa.mercadoria) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    if (custoDaTarefa(state, tarefa, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
  } else {
    // 'construir': sem mercadoria/origem e sem checagem de caminho ainda. A
    // F09 tambem nao checava caminho antes de existir um consumidor (o F10
    // acrescentou, para o serf); a F11c decide se o laborer precisa da mesma
    // protecao quando ganhar FSM.
    if (vagaDeConstrucao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
  }

  const reclamada: Tarefa = { ...tarefa, estado: 'reclamada', reclamadaPor: unidadeId };
  return {
    ok: true,
    state: {
      ...state,
      jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: reclamada }, ordem: state.jobs.tarefas.ordem } },
    },
  };
}
```

Acrescentar `vagaDeConstrucao` ao import de `./reservas`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 6: Commit**

```bash
git add src/sim/reservas.ts src/sim/jobs.ts tests/F11b-jobboard.test.ts tests/helpers/jobs-cenario.ts
git commit -m "feat(F11b): reclamar ramifica por tipo; vagaDeConstrucao com teto do dado"
```

---

## Task 6: compat do serf — `tarefaDoSerf` estreita para material

**Files:**
- Modify: `src/sim/systems/serfs.ts`
- Test: nenhum novo (a suíte F10 existente é a evidência — Task 10 confirma)

- [ ] **Step 1: Confirmar o erro de tipo**

Run: `npm run typecheck`
Expected: erro em `src/sim/systems/serfs.ts` — `Property 'mercadoria' does
not exist on type 'Tarefa'`.

- [ ] **Step 2: Implementar**

```ts
/** A tarefa de MATERIAL do serf, se ela existe, esta no estado esperado e e
 *  mesmo dele. So serf reclama material-para-obra (`elegivelParaTarefa`,
 *  F11b) — o filtro de tipo aqui e so para o compilador estreitar o tipo, o
 *  serf nunca segura uma tarefa 'construir' em runtime. */
function tarefaDoSerf(state: GameState, u: Unidade, estado: Tarefa['estado']): TarefaMaterialParaObra | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && t.tipo === 'material-para-obra' && t.estado === estado && t.reclamadaPor === u.id ? t : null;
}
```

Acrescentar `TarefaMaterialParaObra` ao import de `'../state'`.

- [ ] **Step 3: Rodar e confirmar**

Run: `npm run typecheck`
Expected: `src/sim/systems/serfs.ts` limpo.

- [ ] **Step 4: Commit**

```bash
git add src/sim/systems/serfs.ts
git commit -m "fix(F11b): tarefaDoSerf estreita para TarefaMaterialParaObra"
```

---

## Task 7: `sanearTarefas` cobre os ramos de `'construir'`

**Files:**
- Modify: `src/sim/systems/jobs.ts`
- Modify: `tests/F11b-jobboard.test.ts`

- [ ] **Step 1: Acrescentar o teste que falha**

```ts
import { sanearTarefas } from '../src/sim/systems/jobs';
import { semAUnidade, semOPredio } from './helpers/jobs-cenario';

describe('F11b — sanearTarefas cobre construir', () => {
  it('unidade removida: reabre a mesma tarefa de construir', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    const { state, id } = criarTarefaDeConstrucao(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), 'obra-a');
    const r = reclamar(state, id, laborer1);
    if (!r.ok) throw new Error('fixture: reclamar deveria aceitar');
    const semOLaborer = semAUnidade(r.state, laborer1);
    const { state: saneado } = sanearTarefas(semOLaborer);
    const t = saneado.jobs.tarefas.porId[id];
    expect(t?.estado).toBe('aberta');
    expect(t?.reclamadaPor).toBeNull();
  });

  it('obra demolida: cancela a tarefa de construir (sem tarefa fantasma)', () => {
    const { state, id } = criarTarefaDeConstrucao(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), 'obra-a');
    const semAObra = semOPredio(state, 'obra-a');
    const { state: saneado } = sanearTarefas(semAObra);
    expect(saneado.jobs.tarefas.porId[id]).toBeUndefined();
  });

  it('abertas em excesso: nunca mais construir do que laborersMaximosPorObra', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    for (let i = 0; i < gameData.construcao.laborersMaximosPorObra + 2; i++) {
      estado = criarTarefaDeConstrucao(estado, 'obra-a').state;
    }
    const { state: saneado } = sanearTarefas(estado);
    const construir = saneado.jobs.tarefas.ordem.filter((id) => saneado.jobs.tarefas.porId[id]?.tipo === 'construir');
    expect(construir).toHaveLength(gameData.construcao.laborersMaximosPorObra);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 3: Implementar em `src/sim/systems/jobs.ts`**

Import `elegivelParaTarefa` de `'../jobs'`.

Substituir `motivoIndividual`:

```ts
/** O motivo pelo qual uma tarefa reclamada, sozinha, deixou de valer; `null`
 *  se vale. Ramifica por tipo: material precisa de armazem+estrada; construir
 *  so precisa que a obra ainda exista. */
function motivoIndividual(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || !elegivelParaTarefa(t.tipo, unidade.tipo)) return 'unidade-removida';
  const destino = state.predios.porId[t.destino];
  if (!destino) return 'destino-sumiu';
  if (!ehObra(destino)) return 'destino-completo';
  if (t.tipo !== 'material-para-obra') return null; // construir: nada alem do destino importa
  const origem = state.predios.porId[t.origem];
  if (!ehArmazemCompleto(origem)) return 'origem-sumiu';
  if (distanciaEntrePredios(state, origem, destino, dados) === null) return 'caminho-cortado';
  return null;
}
```

Substituir `abertaVale`:

```ts
/** Uma aberta vale enquanto o destino e obra; material tambem precisa de
 *  origem com algo livre e caminho. */
function abertaVale(state: GameState, t: Tarefa, dados: GameData): boolean {
  if (!ehObra(state.predios.porId[t.destino])) return false;
  if (t.tipo !== 'material-para-obra') return true; // construir: so o destino importa
  if (!ehArmazemCompleto(state.predios.porId[t.origem])) return false;
  if (disponivelNaOrigem(state, t.origem, t.mercadoria) < 1) return false;
  return distanciaDaTarefa(state, t, dados) !== null;
}
```

Substituir o passo 4 de `sanearTarefas` ("abertas em excesso"):

```ts
  // 4. abertas em excesso: nunca mais tarefas (abertas + reclamadas, por
  //    obra e — so material — por mercadoria) do que o teto pede. Material:
  //    teto = faltam[mercadoria] (encolhe com a entrega). Construir: teto =
  //    laborersMaximosPorObra (constante do dado — por isso nao ha checagem
  //    de GRUPO equivalente ao passo 2 para este tipo: o teto nunca cai
  //    abaixo do que ja foi reclamado).
  for (const t of tarefasPorNumero(atual).reverse()) {
    if (t.estado !== 'aberta') continue;
    const destino = atual.predios.porId[t.destino];
    if (t.tipo === 'material-para-obra') {
      const faltam = ehObra(destino) ? destino.obra.faltam[t.mercadoria] ?? 0 : 0;
      const existentes = tarefasPorNumero(atual)
        .filter((o): o is typeof t => o.tipo === 'material-para-obra' && o.destino === t.destino && o.mercadoria === t.mercadoria).length;
      if (existentes > faltam) atual = cancelarAberta(atual, t.id);
    } else {
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'construir' && o.destino === t.destino).length;
      if (existentes > dados.construcao.laborersMaximosPorObra) atual = cancelarAberta(atual, t.id);
    }
  }
```

(O passo 2, "em grupo", **não muda** — o teto de construir é constante,
então uma `'construir'` `reclamada` nunca fica retroativamente inválida por
essa via.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 5: Commit**

```bash
git add src/sim/systems/jobs.ts tests/F11b-jobboard.test.ts
git commit -m "feat(F11b): sanearTarefas cobre reabrir/cancelar/teto de construir"
```

---

## Task 8: `gerarTarefas` cria `'construir'` até o teto + `afterAll`/evidência

**Files:**
- Modify: `src/sim/systems/jobs.ts`
- Modify: `tests/F11b-jobboard.test.ts` (testes + `afterAll` com
  `gravarEvidencia`)

- [ ] **Step 1: Acrescentar os testes que falham**

```ts
import { gerarTarefas } from '../src/sim/systems/jobs';

describe('F11b — gerarTarefas cria construir ate o teto', () => {
  it('cria ate laborersMaximosPorObra tarefas de construir por obra, sem exigir estrada', () => {
    const semEstrada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 } }); // sem comEstradas: nao ligada
    const gerado = gerarTarefas(semEstrada);
    const construir = gerado.jobs.tarefas.ordem.filter((id) => gerado.jobs.tarefas.porId[id]?.tipo === 'construir');
    expect(construir).toHaveLength(gameData.construcao.laborersMaximosPorObra);
    const material = gerado.jobs.tarefas.ordem.filter((id) => gerado.jobs.tarefas.porId[id]?.tipo === 'material-para-obra');
    expect(material).toHaveLength(0); // material continua exigindo estrada
  });

  it('nao duplica construir ja existente: chamar duas vezes fica no teto', () => {
    const obra = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const umaVez = gerarTarefas(obra);
    const duasVezes = gerarTarefas(umaVez);
    const contar = (e: typeof obra) => e.jobs.tarefas.ordem.filter((id) => e.jobs.tarefas.porId[id]?.tipo === 'construir').length;
    expect(contar(duasVezes)).toBe(contar(umaVez));
    expect(contar(umaVez)).toBe(gameData.construcao.laborersMaximosPorObra);
  });
});

afterAll(() => {
  const [serf1] = serfsDoCenario(inicial);
  const [laborer1] = laborersDoCenario(inicial);
  if (!serf1 || !laborer1) throw new Error('evidencia: fixture sem serf/laborer');

  // aceite 1: elegibilidade
  const { state: comConstruirA, id: construirA } = criarTarefaDeConstrucao(
    comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), 'obra-a',
  );
  const serfRecusado = reclamar(comConstruirA, construirA, serf1);
  const laborerAceito = reclamar(comConstruirA, construirA, laborer1);

  // aceite 2: teto de 4 recusando o quinto
  let comQuatro = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
  for (let i = 0; i < gameData.construcao.laborersMaximosPorObra; i++) {
    const { state, id } = criarTarefaDeConstrucao(comQuatro, 'obra-a');
    const r = reclamar(state, id, laborersDoCenario(inicial)[i] ?? laborer1);
    comQuatro = r.ok ? r.state : state;
  }
  const { state: comQuinta, id: quinta } = criarTarefaDeConstrucao(comQuatro, 'obra-a');
  const quintoRecusado = reclamar(comQuinta, quinta, laborer1);

  // aceite 3: gerador cria exatamente o teto, sem estrada
  const semEstrada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 } });
  const gerado = gerarTarefas(semEstrada);
  const construirGeradas = gerado.jobs.tarefas.ordem.filter((id) => gerado.jobs.tarefas.porId[id]?.tipo === 'construir');

  gravarEvidencia('F11b', {
    feature: 'F11b-jobboard-construir',
    // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
    aceite: {
      elegibilidade: {
        serfRecusado,
        laborerAceito: laborerAceito.ok,
      },
      tetoDeQuatroRecusaOQuinto: {
        laborersMaximosPorObra: gameData.construcao.laborersMaximosPorObra,
        quintoRecusado,
      },
      geradorCriaExatamenteOTetoSemEstrada: {
        laborersMaximosPorObra: gameData.construcao.laborersMaximosPorObra,
        construirCriadas: construirGeradas.length,
      },
    },
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- F11b-jobboard`

- [ ] **Step 3: Implementar em `src/sim/systems/jobs.ts`**

Import `criarTarefaDeConstrucao` de `'../jobs'`.

No fim do laço de `gerarTarefas` (depois do laço de mercadorias existente,
dentro do `for (const id of state.predios.ordem)`):

```ts
    // 'construir' (F11b): ate o teto do dado, sem checar armazem/estrada —
    // o laborer nivela/martela sem carregar material (decisao do operador).
    const existentesConstruir = tarefasPorNumero(atual).filter((t) => t.tipo === 'construir' && t.destino === obra.id).length;
    for (let i = existentesConstruir; i < dados.construcao.laborersMaximosPorObra; i++) {
      atual = criarTarefaDeConstrucao(atual, obra.id).state;
    }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- F11b-jobboard`
Expected: PASS, e `test-output/F11b.json` gravado. Abrir com Read para
conferir.

- [ ] **Step 5: Commit**

```bash
git add src/sim/systems/jobs.ts tests/F11b-jobboard.test.ts
git commit -m "feat(F11b): gerarTarefas cria construir ate laborersMaximosPorObra; evidencia"
```

---

## Task 9: test helpers — `jobs-cenario.ts`, `jobs-invariantes.ts`, `serf-invariantes.ts`

**Files:**
- Modify: `tests/helpers/jobs-cenario.ts`
- Modify: `tests/helpers/jobs-invariantes.ts`
- Modify: `tests/helpers/serf-invariantes.ts`
- Test: nenhum novo — infraestrutura de teste; evidência é `npm run
  typecheck` limpo + Task 10 (suíte inteira verde).

**Interfaces:**
- Produces: `tarefaConstruirDe(parcial)` em `jobs-cenario.ts`, para a F11c.

- [ ] **Step 1: Confirmar os erros de tipo**

Run: `npm run typecheck`
Expected: erros em `tarefaDe` (`jobs-cenario.ts`), `nivelDoTipo`/`.origem`
(`jobs-invariantes.ts`) e `dadosDaFsm.carga !== tarefa.mercadoria`
(`serf-invariantes.ts:51`).

- [ ] **Step 2: `tests/helpers/jobs-cenario.ts`**

Estreitar `tarefaDe` para só material e acrescentar a irmã de construir:

```ts
export function tarefaDe(parcial: Partial<TarefaMaterialParaObra> & { readonly numero: number }): TarefaMaterialParaObra {
  return {
    id: `t${parcial.numero}`,
    tipo: 'material-para-obra',
    mercadoria: 'stone',
    origem: armazemDoCenario(inicial).id,
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}

/** F11b — a irmã de `tarefaDe` para tarefas de construir: sem
 *  mercadoria/origem, sem estado `'carregando'`. */
export function tarefaConstruirDe(parcial: Partial<TarefaConstruir> & { readonly numero: number }): TarefaConstruir {
  return {
    id: `t${parcial.numero}`,
    tipo: 'construir',
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}
```

Trocar o import de `Tarefa` por `Tarefa, TarefaConstruir,
TarefaMaterialParaObra`. `comTarefas` continua tipada sobre `Tarefa[]`.

Se a Task 5 precisou de um helper para laborers extras (ver a nota lá),
implementá-lo aqui também.

- [ ] **Step 3: `tests/helpers/jobs-invariantes.ts`**

Ramificar por `t.tipo`:

```ts
  for (const id of tarefas.ordem) {
    const t = tarefas.porId[id];
    if (!t) {
      v.push(`${id}: em ordem mas ausente de porId`);
      continue;
    }
    if (t.id !== `t${t.numero}`) v.push(`${id}: id nao e t<numero>`);
    if (t.numero >= estado.proximoId) v.push(`${id}: numero >= proximoId (colisao futura de id)`);

    const destino = estado.predios.porId[t.destino];
    if (!destino || destino.estado !== 'obra') v.push(`${id}: destino '${t.destino}' nao e obra`);

    if (t.tipo === 'material-para-obra') {
      try {
        nivelDoTipo(t.tipo, dados);
      } catch {
        v.push(`${id}: tipo '${t.tipo}' fora da escada do dado`);
      }
      const origem = estado.predios.porId[t.origem];
      if (t.estado !== 'carregando' && (!origem || origem.estado !== 'completo' || origem.tipo !== ID_DO_ARMAZEM)) {
        v.push(`${id}: origem '${t.origem}' nao e armazem completo`);
      }
      if (t.estado !== 'carregando' && origem && destino && distanciaDaTarefa(estado, t, dados) === null) v.push(`${id}: sem caminho por estrada`);
    }
    // 'construir' fica fora da escada por decisao do operador — nao e violacao.

    if (t.estado === 'aberta' && t.reclamadaPor !== null) v.push(`${id}: aberta mas com reclamadaPor`);
    if (t.estado !== 'aberta') {
      const tipoElegivel = t.tipo === 'material-para-obra' ? TIPO_QUE_CARREGA : TIPO_QUE_CONSTROI;
      if (t.reclamadaPor === null) {
        v.push(`${id}: ${t.estado} sem unidade`);
      } else {
        const u = estado.unidades.porId[t.reclamadaPor];
        if (!u || u.tipo !== tipoElegivel) v.push(`${id}: ${t.estado} por unidade inexistente ou de tipo errado`);
        const outra = unidadesEmUso.get(t.reclamadaPor);
        if (outra !== undefined) v.push(`${id}: a unidade ${t.reclamadaPor} tambem segura ${outra}`);
        unidadesEmUso.set(t.reclamadaPor, id);
      }
      if (t.tipo === 'material-para-obra') {
        if (t.estado === 'reclamada') reservasPorOrigem.add(`${t.origem}|${t.mercadoria}`);
        reservasPorDestino.add(`${t.destino}|${t.mercadoria}`);
      }
    }

    if (t.tipo === 'material-para-obra') {
      const chave = `${t.destino}|${t.mercadoria}`;
      const atual = contagemPorDestino.get(chave) ?? { total: 0, obra: t.destino, mercadoria: t.mercadoria };
      contagemPorDestino.set(chave, { ...atual, total: atual.total + 1 });
    } else if (t.estado !== 'aberta') {
      contagemDeConstrucaoPorObra.set(t.destino, (contagemDeConstrucaoPorObra.get(t.destino) ?? 0) + 1);
    }
  }
```

Acrescentar `const contagemDeConstrucaoPorObra = new Map<string, number>();`
junto às outras `Map`/`Set` no topo da função, e a checagem final simétrica:

```ts
  for (const [obra, reservado] of contagemDeConstrucaoPorObra) {
    if (reservado > dados.construcao.laborersMaximosPorObra) {
      v.push(`${obra}: ${reservado} laborers reclamados para teto=${dados.construcao.laborersMaximosPorObra}`);
    }
  }
```

Acrescentar `TIPO_QUE_CONSTROI` ao import de `'../../src/sim/jobs'`.

- [ ] **Step 4: `tests/helpers/serf-invariantes.ts`**

Linha 51:

```ts
        else if (tarefa && tarefa.tipo === 'material-para-obra' && dadosDaFsm.carga !== tarefa.mercadoria) {
          v.push(`${id}: carga '${dadosDaFsm.carga}' difere da tarefa '${tarefa.mercadoria}'`);
        }
```

- [ ] **Step 5: Rodar e confirmar**

Run: `npm run typecheck`
Expected: limpo em `src/` e `tests/helpers/`. Erros restantes só em
`F09-*`/`F10-*.test.ts` (Task 10 resolve).

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/jobs-cenario.ts tests/helpers/jobs-invariantes.ts tests/helpers/serf-invariantes.ts
git commit -m "test(F11b): helpers de cenario e invariantes cobrem tarefa de construir"
```

---

## Task 10: adaptar a suíte F09/F10 existente (o board agora tem dois tipos)

**Files:**
- Modify: `tests/F09-sistema.test.ts`
- Modify: `tests/F10-ciclo.test.ts`
- Modify: `tests/F10-fsm.test.ts`
- Modify: `tests/F10-falhas.test.ts`
- Modify (se o typecheck apontar): `tests/F09-jobboard.test.ts`,
  `tests/F10-desempate.test.ts`, `tests/F09-estrada-reserva.test.ts`

**Por que esta task existe:** a partir da Task 8, `gerarTarefas` cria tarefas
`'construir'` para TODA obra, mesmo em cenários que só testam entrega de
material. Testes que leem `estado.jobs.tarefas.ordem`/`.porId` **sem filtrar
por tipo** (helpers locais `tarefasDe`, contagens brutas de `.ordem.length`)
agora veem tarefas extras e suas asserções de conteúdo/tamanho exatos
quebram — não porque a lógica de material mudou, mas porque o board deixou
de ter um só tipo.

- [ ] **Step 1: Rodar a suíte inteira e listar as quebras**

Run: `npm run test`
Expected: falhas nos arquivos listados. Padrões já mapeados:

  **Padrão A — helper local `tarefasDe` sem filtro**
  (`tests/F09-sistema.test.ts:31`, `tests/F10-ciclo.test.ts:54`,
  `tests/F10-fsm.test.ts:46`):

  ```ts
  const tarefasDe = (estado: GameState): TarefaMaterialParaObra[] =>
    estado.jobs.tarefas.ordem
      .map((id) => estado.jobs.tarefas.porId[id])
      .filter((t): t is TarefaMaterialParaObra => t !== undefined && t.tipo === 'material-para-obra' /* ... resto do filtro original ... */);
  ```

  **Padrão B — contagem bruta `.ordem.length`**
  (`tests/F09-sistema.test.ts:444,452,456,519`,
  `tests/F10-falhas.test.ts:494,515,617,647`):

  ```ts
  // antes: estado.jobs.tarefas.ordem.length
  // depois:
  estado.jobs.tarefas.ordem.filter((id) => estado.jobs.tarefas.porId[id]?.tipo === 'material-para-obra').length
  ```

  Preferir `tarefasDe(estado).length` se o arquivo já tem o Padrão A.

  **Padrão C — leitura de `.origem`/`.mercadoria`/`.destino` fora de
  `tarefasEmOrdem`** (`tests/F10-fsm.test.ts:325,351,356,365-367`,
  `tests/F09-sistema.test.ts:484,678`): resolvido pelo Padrão A ou por
  estreitar o tipo da variável/parâmetro que produz `alvo`.

- [ ] **Step 2: Aplicar o padrão correspondente a cada quebra**

Não alterar nenhuma asserção de VALOR — só o que está sendo contado/filtrado
muda, para voltar a ser "só as tarefas de material" (o universo implícito
quando o teste foi escrito).

- [ ] **Step 3: Rodar até verde**

Run: `npm run typecheck && npm run test`

- [ ] **Step 4: Revisar o diff antes de commitar (ajuste 4 do operador)**

```bash
git diff -- tests/F09-sistema.test.ts tests/F10-ciclo.test.ts tests/F10-fsm.test.ts tests/F10-falhas.test.ts
```

Ler o diff inteiro. Confirmar que toda linha alterada é: import novo, tipo de
retorno de `tarefasDe`, ou um `.filter(...)`/`.some(...)` acrescentado antes
de um `expect`. **Nenhuma linha `expect(...).toBe(...)`,
`.toEqual(...)`, `.toHaveLength(...)`, `.toMatchObject(...)` pode ter o
valor esperado (o argumento do `expect`, não o que está sendo comparado)
alterado.** Se alguma tiver mudado, parar aqui e reportar ao operador antes
de continuar — não commitar.

- [ ] **Step 5: Commit**

```bash
git add tests/F09-sistema.test.ts tests/F10-ciclo.test.ts tests/F10-fsm.test.ts tests/F10-falhas.test.ts
# + qualquer outro arquivo tocado no Step 2
git commit -m "test(F11b): suite F09/F10 filtra tarefas de material (board agora tem dois tipos)"
```

---

## Task 11: `BUILD_PLAN.md`, `test-results.json`, `PROGRESS.md` + referências cruzadas

**Files:**
- Modify: `BUILD_PLAN.md`
- Modify: `test-results.json`
- Modify: `PROGRESS.md`
- Modify: `IDEIAS.md` (achado fora do escopo original, sinalizado — ver
  abaixo)

- [ ] **Step 1: `BUILD_PLAN.md` — substituir o item F11b atual por dois**

Trocar `### F11b — FSM do Laborer (construção em etapas)` (o item inteiro,
incluindo todas as suas Notas) por `F11b` (este) + `F11c` (o antigo escopo).
Texto de `F11b`:

```markdown
### F11b — JobBoard: tarefa de construir
- **Escopo**: `Tarefa` vira união discriminada (`material-para-obra` |
  `construir`). `reclamar` generaliza a elegibilidade por tipo de unidade
  (serf só material, laborer só construir — não disputam tarefa).
  `laborersMaximosPorObra: 4` em `buildings.json` (`construcao`), validado
  como inteiro ≥ 1. `gerarTarefas` cria até esse número de tarefas de
  construir por obra, sem checar armazém/estrada (o laborer não carrega
  material). `sanearTarefas` cobre os ramos novos. **Sem FSM de laborer**:
  as tarefas nascem e podem ser reclamadas, mas nada as consome ainda.
- **Aceite**: teste que um laborer reclama uma tarefa de construir e um serf
  é recusado (e vice-versa para material). Teste que a quinta reclamação
  numa obra com teto 4 é recusada com `destino-sem-vaga`. Teste que
  `gerarTarefas` cria exatamente `laborersMaximosPorObra` tarefas de
  construir por obra, mesmo sem estrada. `npm run test` inteiro (F01–F11a)
  continua verde.
- **Evidência**: `test-output/F11b.json`
- **Nota**: sem screenshot — feature só de `sim/`.

### F11c — FSM do Laborer (construção em etapas)
- **Escopo**: nivelar terreno → esperar material → martelar, consumindo as
  tarefas `'construir'` da F11b. HP subindo conforme o GDD: cada material
  entregue soma 50 HP, cada martelada soma 5. Três estágios visuais:
  marcação, estrutura de madeira, prédio completo — função pura em
  `render/`, derivada de `hp`/`def.hp`.
- **Aceite**: cenário com Quarry (3 timber + 2 stone, 250 HP). Após a entrega
  dos 5 materiais o HP é 250 e o prédio fica `completo`. Screenshots dos três
  estágios.
- **Evidência**: `test-output/F11c.json` + `screenshots/F11c-*.png`
- **Nota**: feature de integração (§10) — a exceção de tocar `sim/` e
  `render/` na mesma feature vale só para esta.
- (demais notas herdadas do F11b original — nivelamento fora do contrato,
  fórmula do teto de HP, portão "obra já nivelada", registrarTipoConstruido
  é da F12 — continuam válidas, copiadas sem editar do item original.)
```

Copiar as Notas técnicas do F11b original (nivelamento, fórmula do teto de
HP, portão de `gerarTarefas`, "o que a F10 deixa para a F11b") para dentro do
novo F11c, trocando "F11b" por "F11c" em cada uma — são sobre o laborer, não
sobre o JobBoard.

- [ ] **Step 2: Referência cruzada em BUILD_PLAN.md fora do item F11b/F11c**

Achado por `grep -n F11b BUILD_PLAN.md` (linhas do arquivo antes desta
edição):

| Linha | Antes | Depois |
|---|---|---|
| 71 (nota da F05a) | "...é herdado por F07, F10, **F11b** e F14..." | "...é herdado por F07, F10, **F11c** e F14..." |

(As demais ocorrências de "F11b" no grep — linhas 169, 176, 183, 188, 196,
202, 205 — são o próprio item F11b original, já substituído no Step 1; não
são referência de OUTRO item.)

- [ ] **Step 3: `PROGRESS.md`**

`grep -n F11b PROGRESS.md` não retorna nada hoje (as menções ao laborer lá
usam "F11" genérico, não "F11b") — nenhuma linha a trocar por F11c. Só
acrescentar, na seção de contratos vigentes, um bloco novo `(origem: F11b)`
(este É o F11b novo — não precisa de troca):

Documentar: a união discriminada de `Tarefa`, `elegivelParaTarefa` como o
ponto único de "quem pode reclamar o quê", e a lista do que F11c herda
(campo de nivelamento em `Obra`, portão "obra já nivelada" em `gerarTarefas`
— confirmar que ficou **sem** gate para tarefas de material nesta feature,
igual ao código).

- [ ] **Step 4: `IDEIAS.md` — achado no mesmo grep, fora do escopo pedido**

`grep -n F11b IDEIAS.md` (linha 36 do arquivo antes desta edição): "virar
canteiro por tile dobra a F11b e atrasa o aceite da Fase A" — refere-se ao
laborer (o item que dobraria de escopo se a estrada virasse canteiro), não ao
JobBoard. Trocar para F11c. **Sinalizado ao operador**: o pedido original
listou só BUILD_PLAN.md e PROGRESS.md; este é o mesmo tipo de referência
cruzada, encontrado no mesmo grep — incluído aqui, mas fora do escopo
literal do pedido, para revisão.

(`docs/historico/F01-F11a.md` também tem várias menções a "F11b" — **não
tocado**: é arquivo histórico/congelado, registra o que era verdade quando a
F11a fechou, antes desta divisão. Reescrevê-lo falsearia o registro.)

- [ ] **Step 5: `test-results.json`**

```json
  "F11b-jobboard-construir": { "passes": false },
  "F11c-laborer-fsm": { "passes": false },
```

(Substitui a chave `F11b-laborer-construcao`, preservando a posição.)

- [ ] **Step 6: Commit**

```bash
git add BUILD_PLAN.md test-results.json PROGRESS.md IDEIAS.md
git commit -m "docs(F11b): divide o item em F11b (JobBoard) e F11c (FSM do laborer); atualiza referencias cruzadas"
```

---

## Task 12: verificação final, evidência e merge

**Files:** nenhum novo além do que as tasks anteriores já tocaram.

- [ ] **Step 1: Verificação completa**

Run: `npm run verify`
Expected: `typecheck`, `lint`, `validate:data`, `test` todos verdes; gera
`.verify-ok`.

- [ ] **Step 2: Evidência**

Abrir `test-output/F11b.json` com Read (gravado pelo `afterAll` da Task 8) —
não gerar de novo, só confirmar que existe e reflete o aceite.

- [ ] **Step 3: `test-results.json` — só depois do `npm run verify` passar**

Marcar `"F11b-jobboard-construir": { "passes": true }` (o hook de 15 minutos
do CLAUDE.md §13 recusa a escrita se `verify` não rodou recentemente).

- [ ] **Step 4: Commit final no branch**

```bash
git add test-results.json
git commit -m "feat(F11b): JobBoard com tarefa de construir — verificado"
```

- [ ] **Step 5: Merge para main (ajuste 3 do operador — sem push)**

```bash
git switch main
git merge --no-ff F11b
```
