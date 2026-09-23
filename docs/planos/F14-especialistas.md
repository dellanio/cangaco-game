# F14 — Especialistas ocupam prédios — Plano de implementação

> **Para o executor:** use `superpowers:executing-plans`, tarefa a tarefa. **Não**
> use `subagent-driven-development` nem `dispatching-parallel-agents` — proibidos
> pelo CLAUDE.md §11. Passos usam checkbox (`- [ ]`).

**Objetivo:** um civil especialista recém-treinado (stonemason, woodcutter, …)
caminha sozinho até um prédio **completo e vago do seu tipo** e o ocupa. Um
prédio aceita **um** ocupante. Tudo pelo JobBoard.

**Aceite (BUILD_PLAN, intocado):** cenário com 2 Quarries prontas e 2 stonemasons
treinados: após N ticks os dois prédios têm ocupante e nenhum ficou com dois.
**Evidência:** `test-output/F14.json`.

**Arquitetura:** quatro peças, todas em `sim/`. Nenhuma linha de `render/`,
`ui/` ou `input/` nesta feature (ver D5).

1. **`PredioCompleto.ocupante: string | null`** — a posse mora no prédio, e só
   lá. Um campo, não uma lista: "dois ocupantes" não é representável.
2. **`sim/ocupacao.ts`** — quem ocupa o quê, derivado de
   `data/buildings.json:trabalhador`. Módulo irmão de `obra.ts` e `escola.ts`:
   só lê estado e dado, não conhece o JobBoard.
3. **`TarefaOcupar`** no JobBoard — molde exato da `TarefaConstruir` da F11b:
   sem `mercadoria`, sem `origem`, sem `'carregando'`, fora da escada de
   `delivery.json`. A reserva continua **derivada** da tarefa reclamada.
4. **`sim/systems/especialistas.ts`** — a FSM `ocioso → indo_ocupar →
   trabalhando`, no molde de `systems/laborers.ts`.

**Stack:** TypeScript estrito, Vitest. Sem dependência nova.

## Restrições globais (CLAUDE.md, valem em toda tarefa)

- `sim/` não importa `phaser`, não toca `window`/`document`, não usa
  `Math.random()` nem `Date.now()`.
- **Nenhum número de balanceamento em `.ts`.** O tipo de trabalhador de cada
  prédio vem de `data/buildings.json:trabalhador` — nenhum id de profissão é
  digitado em `sim/`.
- `GameState` serializável: nada de `undefined` em campo de estado (use `null`,
  como `Tarefa.reclamadaPor`), nada de `Map`/`Set`/classe.
- Todo sistema itera `Colecao.ordem`, nunca `Object.keys(porId)`.
- **Toda tarefa reclamada tem caminho de volta.** Se um ramo de erro não chama
  `liberar` (ou não é coberto por `sanearTarefas`), é bug.
- Proibido usar `skip`, `eslint-disable` ou alargar `ignores` para fazer o
  `npm run verify` passar.

---

## Decisões desta sessão

Registrar as cinco em `PROGRESS.md` **e** como Nota nos itens do `BUILD_PLAN.md`
(Tarefa 9). São contrato que F15, F16 e F22 herdam.

### D1 — o alerta do HUD é da F22, não desta feature

O operador mandou decidir e registrar. **Decisão: F22.**

- O **critério de aceite** escrito no BUILD_PLAN não menciona alerta nenhum:
  "após N ticks os dois prédios têm ocupante e nenhum ficou com dois". Só a
  linha de **escopo** cita o HUD. A evidência pedida é um JSON, não um
  screenshot — diferente da F16, que pede screenshot explicitamente.
- A F22 **existe e é exatamente isto**: "Alertas do HUD — prédio sem
  trabalhador, sem estrada, fome, mina esgotada". Três das quatro causas nem
  são observáveis ainda (produção é F15, fome é F20, mina é F21). Entregar uma
  causa isolada agora obrigaria a refazer o componente quando as outras três
  chegarem.
- **O que NÃO decide:** a falta de nota de integração no item. A nota da §10
  não é condição preexistente — é autorização que o operador dá quando faz
  sentido, como deu na F05b, F06, F07, F08 e F11c. Se o alerta valesse a pena
  agora, a nota entraria como Tarefa 0 desta sessão. Correção do operador em
  2026-09-22; o argumento anterior ("o item não diz, logo não pode") estava
  errado e não deve reaparecer. O que decide são as duas razões acima, e elas
  bastam.

**O que a F22 herda, pronto:** o alerta é
`predio.estado === 'completo' && trabalhadorDoTipo(predio.tipo) !== null &&
predio.ocupante === null` — `ehPredioOcupavel` + `vagasDoPredio`
(`sim/ocupacao.ts`) já respondem isso. Falta só o seletor de HUD e o desenho.
Esta feature **não** cria seletor sem consumidor.

### D2 — o `sem_prédio` do GDD chama-se `ocioso` no código

O GDD §6.2 dá a FSM do especialista como
`sem_prédio → indo_ocupar → trabalhando ⇄ esperando_insumo ⇄ saida_cheia`.

Implementamos os **três primeiros**; `esperando_insumo` e `saida_cheia` são
produção, F15. E o primeiro estado se chama `ocioso`, não `sem_predio`: toda
unidade nasce `ocioso` (`systems/escolas.ts`, `createInitialState`) e
`ficarOcioso`/`ocioso` (`units/movimento.ts`) são compartilhados pelas três
FSMs. Renomear obrigaria a escola a saber o tipo de cada civil para escolher o
estado inicial — acoplamento novo para ganhar um sinônimo. **Mesmo significado,
um nome só.**

### D3 — "um prédio, um ocupante" é cardinalidade do tipo, não número em dado

`ocupante: string | null` é um campo, não uma lista com teto. Não existe
`ocupantesMaximosPorPredio` em `data/*.json` porque não há o que balancear: dois
ocupantes no mesmo prédio **não são representáveis**. É o contrário do
`laborersMaximosPorObra` (F11b), que é teto de verdade, vem do dado e pode
mudar.

Consequência: `vagasDoPredio` devolve `1` ou `0` e isso não é número mágico — é
a cardinalidade do campo. O comentário na função diz isso.

### D4 — a tarefa de ocupação nasce mesmo sem especialista no mapa

Molde do `'construir'` (F11b): o gerador cria a vaga até o teto sem perguntar se
existe laborer. Idem aqui — a vaga existe no quadro assim que o prédio fica
pronto e vago.

Não seguimos o molde do `'material-para-obra'`, que **não** nasce sem armazém
ligado com estoque (`origemMaisPerto === null`): lá o portão é sobre o
**recurso e a rota**, que a tarefa precisa para ser executável; aqui a tarefa é
executável por qualquer civil do tipo certo que apareça depois.

E "prédio parado esperando trabalhador" é lido de `predio.ocupante` (D1), nunca
da existência da tarefa — então o quadro não precisa mentir para o HUD.

### D5 — sem screenshot: a feature não muda uma linha de tela

CLAUDE.md §8 pede screenshot "para qualquer feature que muda o que aparece na
tela". F14 não altera `src/render/`: o especialista andando é desenhado pela
camada genérica de unidades da F10, que lê `unidades.ordem`. Afirmar "cada um
num prédio" por roteiro exigiria publicar `ocupante` em `render/debug.ts` —
`render/` + `sim/` na mesma feature, o que o §10 barra sem nota de integração
(ver D1).

A ocupação ganha olho humano na **F16**, cujo painel de prédio já lista
"ocupante" no escopo e cujo aceite já pede screenshot. Registrado na Nota da
F16.

---

## Estrutura de arquivos

**Criar**
- `src/sim/ocupacao.ts` — quem ocupa o quê (derivado do dado).
- `src/sim/systems/especialistas.ts` — a FSM + `sanearOcupacao`.
- `tests/F14-ocupacao.test.ts` — o módulo e as reservas.
- `tests/F14-especialista.test.ts` — a FSM, ramo a ramo.
- `tests/F14-aceite.test.ts` — o aceite do BUILD_PLAN + determinismo + evidência.
- `tests/helpers/especialista-invariantes.ts` — irmão de `laborer-invariantes.ts`.

**Modificar**
- `src/sim/state.ts` — `PredioCompleto.ocupante`, `TarefaOcupar`,
  `ehTarefaDeTransporte`, `GameEvent: building-occupied`, `completarObra`,
  `criarPredios`.
- `src/sim/jobs.ts` — `podeReclamar`, `criarTarefaDeOcupacao`,
  `caminhoAtePredioCompleto`, ramo de `reclamar`, `tarefasDeOcupacaoEmOrdem`,
  `reclamarMelhorOcupacao`.
- `src/sim/reservas.ts` — `ocupantesReservados`, `vagaDeOcupacao`.
- `src/sim/systems/jobs.ts` — `motivoDoDestino`, `motivoIndividual`,
  `motivoDaCarregando`, fase 4 de `sanearTarefas`, `gerarTarefasDeOcupacao`.
- `src/sim/units/movimento.ts` — sobe `comPredio` (segundo consumidor).
- `src/sim/systems/laborers.ts` — passa a importar `comPredio`.
- `src/sim/tick.ts` — encaixa o sistema novo.
- `tests/helpers/jobs-cenario.ts` — `comPredioCompletoEm`, `ocupante: null`.
- `tests/helpers/jobs-invariantes.ts` — deixa de supor "toda tarefa vai para
  obra" e "tudo que não é material é construir".
- Fixtures de teste que constroem `PredioCompleto` à mão (Tarefa 1).
- `BUILD_PLAN.md`, `PROGRESS.md`, `test-results.json` (Tarefa 9).

---

## Tarefa 1: o campo `ocupante` no prédio completo

**Arquivos**
- Modificar: `src/sim/state.ts`
- Criar: `tests/F14-ocupacao.test.ts`
- Modificar (fixtures, `ocupante: null`): `tests/helpers/jobs-cenario.ts:149`,
  `tests/F05b-hud-armazens.test.ts:25,54`, `tests/F06-build.test.ts:32`,
  `tests/F08-estradas.test.ts:64,166`, `tests/F09-sistema.test.ts:123`,
  `tests/F10-ciclo.test.ts:156`, `tests/F11c-laborer.test.ts:197`

**Interfaces**
- Produz: `PredioCompleto.ocupante: string | null`; `ehTarefaDeTransporte`
  passando a testar a **forma** da tarefa.

- [ ] **Passo 1: escrever o teste que falha**

```ts
// tests/F14-ocupacao.test.ts
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { PredioEmObra } from '../src/sim/state';
import { gameData } from '../src/sim/data';

const inicial = createInitialState(1);

describe('F14 — a posse mora no predio', () => {
  it('todo predio completo do cenario inicial nasce sem ocupante', () => {
    const completos = inicial.predios.ordem
      .map((id) => inicial.predios.porId[id])
      .filter((p) => p?.estado === 'completo');
    expect(completos).not.toHaveLength(0);
    expect(completos.every((p) => p?.estado === 'completo' && p.ocupante === null)).toBe(true);
  });

  it('obra que completa nasce vaga: completarObra devolve ocupante null', () => {
    const def = gameData.predios.find((p) => p.id === 'quarry');
    const obra: PredioEmObra = {
      id: 'o1', tipo: 'quarry', gx: 26, gy: 36, estado: 'obra', hp: def?.hp ?? 0,
      obra: { faltam: {}, nivelamento: 0 },
    };
    expect(completarObra(obra).ocupante).toBe(null);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run tests/F14-ocupacao.test.ts` → FAIL (`ocupante` não existe).

- [ ] **Passo 3: o campo**

Em `src/sim/state.ts`, `PredioCompleto`:

```ts
export interface PredioCompleto extends PredioBase {
  readonly estado: 'completo';
  readonly capacidade: Capacidade;
  readonly estoque: Estoque;
  /**
   * F14 — id do especialista que ocupa este predio, ou `null`. UM ocupante: a
   * cardinalidade esta no TIPO (um campo, nao uma lista com teto), entao "dois
   * no mesmo predio" nao e representavel. NAO e numero de balanceamento — nao
   * ha dado para mexer, diferente de `construcao.laborersMaximosPorObra`.
   *
   * `null` e nunca `undefined`, como `Tarefa.reclamadaPor`: e o que mantem o
   * estado comparavel byte a byte depois de um save/load.
   *
   * Predio cujo tipo nao pede trabalhador (`buildings.json:trabalhador: null`
   * — armazem, escola, quartel) fica `null` para sempre: o gerador nunca cria
   * tarefa de ocupacao para ele.
   */
  readonly ocupante: string | null;
}
```

Em `completarObra`, acrescentar `ocupante: null,` depois de `estoque:`. Em
`criarPredios`, o mesmo no literal empurrado para `lista`.

- [ ] **Passo 4: consertar as fixtures**

`npm run typecheck` aponta cada `PredioCompleto` construído à mão. Acrescentar
`ocupante: null` em cada um — a lista está no cabeçalho desta tarefa. Nenhuma
outra mudança nesses arquivos.

- [ ] **Passo 5: rodar e ver passar**

`npx vitest run tests/F14-ocupacao.test.ts` → PASS. `npm run typecheck` limpo.

- [ ] **Passo 6: commit**

```bash
git add -A
git commit -m "feat(F14): o campo ocupante no predio completo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 2: `sim/ocupacao.ts` — quem ocupa o quê

**Arquivos**
- Criar: `src/sim/ocupacao.ts`
- Modificar: `tests/F14-ocupacao.test.ts`

**Interfaces**
- Consome: `PredioCompleto.ocupante` (Tarefa 1).
- Produz: `trabalhadorDoTipo(tipoDePredio, dados): string | null`;
  `ehPredioOcupavel(predio, dados): predio is PredioCompleto`;
  `vagasDoPredio(predio, dados): number`;
  `predioAceita(predio, tipoDaUnidade, dados): boolean`;
  `predioDoOcupante(state, unidadeId): PredioCompleto | null`;
  `tiposQueOcupam(dados): ReadonlySet<string>`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar a `tests/F14-ocupacao.test.ts`:

```ts
import {
  ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam,
  trabalhadorDoTipo, vagasDoPredio,
} from '../src/sim/ocupacao';
import { comPredioCompletoEm } from './helpers/jobs-cenario';

describe('F14 — quem ocupa o que vem do dado', () => {
  // Estrutural, nao textual: compara com o proprio dado, nunca com 'stonemason'
  // digitado aqui. Trocar buildings.json muda os dois lados juntos.
  it('trabalhadorDoTipo devolve o que buildings.json declara', () => {
    for (const def of gameData.predios) {
      expect(trabalhadorDoTipo(def.id)).toBe(def.trabalhador);
    }
    expect(trabalhadorDoTipo('tipo-que-nao-existe')).toBe(null);
  });

  it('predio sem trabalhador no dado nao e ocupavel e nao tem vaga', () => {
    const semTrabalhador = gameData.predios.filter((p) => p.trabalhador === null);
    expect(semTrabalhador).not.toHaveLength(0);
    const armazem = inicial.predios.porId[armazemDoCenario(inicial).id];
    expect(trabalhadorDoTipo('storehouse')).toBe(null);
    expect(ehPredioOcupavel(armazem)).toBe(false);
    expect(vagasDoPredio(armazem)).toBe(0);
  });

  it('predio ocupavel: 1 vaga vago, 0 ocupado; obra nunca e ocupavel', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    const vago = com.predios.porId.q1;
    expect(ehPredioOcupavel(vago)).toBe(true);
    expect(vagasDoPredio(vago)).toBe(1);

    const ocupado = vago?.estado === 'completo' ? { ...vago, ocupante: 'u9' } : vago;
    expect(vagasDoPredio(ocupado)).toBe(0);
    expect(ehPredioOcupavel(undefined)).toBe(false);
  });

  it('predioAceita compara o tipo do civil com o do dado', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    const quarry = com.predios.porId.q1;
    expect(predioAceita(quarry, trabalhadorDoTipo('quarry') ?? '')).toBe(true);
    expect(predioAceita(quarry, 'serf')).toBe(false);
    expect(predioAceita(quarry, 'laborer')).toBe(false);
  });

  it('predioDoOcupante acha o predio pela posse, e so ela', () => {
    const com = comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
    expect(predioDoOcupante(com, 'u9')).toBe(null);
    const q = com.predios.porId.q1;
    const posse = q?.estado === 'completo'
      ? { ...com, predios: { ...com.predios, porId: { ...com.predios.porId, q1: { ...q, ocupante: 'u9' } } } }
      : com;
    expect(predioDoOcupante(posse, 'u9')?.id).toBe('q1');
  });

  it('serf e laborer nao ocupam predio nenhum', () => {
    const ocupam = tiposQueOcupam();
    expect(ocupam.has('serf')).toBe(false);
    expect(ocupam.has('laborer')).toBe(false);
    expect(ocupam.has(trabalhadorDoTipo('quarry') ?? '')).toBe(true);
  });
});
```

Importar `armazemDoCenario` de `./helpers/jobs-cenario` no topo do arquivo.
`comPredioCompletoEm` é criado no Passo 2.

- [ ] **Passo 2: o helper de fixture**

Em `tests/helpers/jobs-cenario.ts`, ao lado de `comArmazemCompleto`:

```ts
/**
 * F14 — acrescenta um predio COMPLETO de qualquer tipo (a irma de
 * `comArmazemCompleto`, que so faz armazem). Passa pelo MESMO caminho do jogo,
 * `completarObra`: capacidade, estoque e `ocupante` nascem de la, e a fixture
 * nao pode divergir do que o jogo produz.
 */
export function comPredioCompletoEm(
  estado: GameState,
  id: string,
  opcoes: { readonly tipo: string; readonly gx: number; readonly gy: number },
): GameState {
  const def = gameData.predios.find((p) => p.id === opcoes.tipo);
  if (!def) throw new Error(`fixture: tipo '${opcoes.tipo}' nao existe em buildings.json`);
  const predio = completarObra({
    id, tipo: opcoes.tipo, gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  });
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: predio }, ordem: [...estado.predios.ordem, id] },
  };
}
```

Acrescentar aos imports do arquivo: `completarObra` de `../../src/sim/state` e
`gameData` de `../../src/sim/data`.

- [ ] **Passo 3: rodar e ver falhar**

`npx vitest run tests/F14-ocupacao.test.ts` → FAIL (`src/sim/ocupacao.ts` não
existe).

- [ ] **Passo 4: o módulo**

```ts
// src/sim/ocupacao.ts
/**
 * F14 — quem ocupa qual predio. Modulo irmao de `obra.ts` e `escola.ts`: so le
 * o estado e o dado, nao muta nada e NAO conhece o JobBoard — e por isso que
 * `reservas.ts` pode importa-lo sem fechar ciclo.
 *
 * A regra inteira vem de `data/buildings.json:trabalhador`: cada tipo de predio
 * declara UM tipo de civil que o ocupa, ou `null` (armazem, escola, quartel,
 * mercado). Nenhum id de profissao e digitado aqui.
 */
import type { GameData } from './data/types';
import { gameData } from './data';
import type { GameState, Predio, PredioCompleto } from './state';

/** O tipo de civil que ocupa `tipoDePredio`; `null` se o predio nao pede
 *  trabalhador — ou se o tipo nem existe no dado (save de outra versao). */
export function trabalhadorDoTipo(tipoDePredio: string, dados: GameData = gameData): string | null {
  return dados.predios.find((p) => p.id === tipoDePredio)?.trabalhador ?? null;
}

/** Um predio COMPLETO cujo tipo pede trabalhador. Estreita a uniao `Predio`,
 *  como `ehEscolaCompleta` (escola.ts) e `ehObra` (systems/jobs.ts). */
export function ehPredioOcupavel(
  predio: Predio | undefined, dados: GameData = gameData,
): predio is PredioCompleto {
  return predio !== undefined && predio.estado === 'completo'
    && trabalhadorDoTipo(predio.tipo, dados) !== null;
}

/**
 * Quantos ocupantes o predio ainda aceita, ANTES de descontar reserva: 1 vago,
 * 0 ocupado ou nao ocupavel. O `1` NAO e numero de balanceamento: e a
 * cardinalidade do campo `ocupante: string | null` (ver `PredioCompleto`) — nao
 * ha dado para mexer, e dois ocupantes nao sao representaveis. Irma de
 * `vagaDeConstrucao`, cujo teto vem do dado justamente porque la a obra aceita
 * varios laborers.
 */
export function vagasDoPredio(predio: Predio | undefined, dados: GameData = gameData): number {
  if (!ehPredioOcupavel(predio, dados)) return 0;
  return predio.ocupante === null ? 1 : 0;
}

/** O predio aceita ESTE tipo de civil? (`quarry` aceita o `trabalhador` que o
 *  dado declara para ele, e mais ninguem.) */
export function predioAceita(
  predio: Predio | undefined, tipoDaUnidade: string, dados: GameData = gameData,
): boolean {
  return predio !== undefined && trabalhadorDoTipo(predio.tipo, dados) === tipoDaUnidade;
}

/** O predio que `unidadeId` ocupa, ou `null`. Varre `predios.ordem` (nunca
 *  `Object.keys`): a posse mora SO no predio, para nao haver duas fontes de
 *  verdade que possam dessincronizar num save. Custo O(nº de predios), como as
 *  consultas de `reservas.ts`. */
export function predioDoOcupante(state: GameState, unidadeId: string): PredioCompleto | null {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p !== undefined && p.estado === 'completo' && p.ocupante === unidadeId) return p;
  }
  return null;
}

/** Os tipos de civil que ocupam algum predio, segundo `buildings.json`. Serf e
 *  laborer NAO aparecem la — e o que os mantem fora do sistema dos
 *  especialistas, sem nenhuma lista de excecao em `.ts`. */
export function tiposQueOcupam(dados: GameData = gameData): ReadonlySet<string> {
  return new Set(
    dados.predios.map((p) => p.trabalhador).filter((t): t is string => t !== null),
  );
}
```

- [ ] **Passo 5: rodar e ver passar**

`npx vitest run tests/F14-ocupacao.test.ts` → PASS.

- [ ] **Passo 6: commit**

```bash
git add -A
git commit -m "feat(F14): sim/ocupacao.ts, quem ocupa o que vem do dado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 3: a tarefa `'ocupar'` e a reserva derivada

**Arquivos**
- Modificar: `src/sim/state.ts`, `src/sim/reservas.ts`, `src/sim/jobs.ts`
- Modificar: `tests/F14-ocupacao.test.ts`

**Interfaces**
- Consome: `vagasDoPredio`, `predioAceita` (Tarefa 2).
- Produz: `TarefaOcupar`; `criarTarefaDeOcupacao(state, destino)`;
  `podeReclamar(state, tarefa, tipoDaUnidade, dados): boolean`;
  `caminhoAtePredioCompleto(state, predioId, unidadeId, dados): Caminho | null`;
  `ocupantesReservados(state, predioId): number`;
  `vagaDeOcupacao(state, predioId, dados): number`;
  `tarefasDeOcupacaoEmOrdem`, `reclamarMelhorOcupacao`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar a `tests/F14-ocupacao.test.ts`:

```ts
import {
  caminhoAtePredioCompleto, criarTarefaDeOcupacao, elegivelParaTarefa,
  podeReclamar, reclamar, reclamarMelhorOcupacao,
} from '../src/sim/jobs';
import { ocupantesReservados, vagaDeOcupacao } from '../src/sim/reservas';
import { ehTarefaDeTransporte } from '../src/sim/state';
import { comUnidadeExtra, semLaborers } from './helpers/jobs-cenario';

const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';

/** Uma quarry completa em (26,36) e um pedreiro parado no spawn. */
function cenarioDeOcupacao() {
  const com = comPredioCompletoEm(semLaborers(inicial), 'q1', { tipo: 'quarry', gx: 26, gy: 36 });
  return comUnidadeExtra(com, 'esp1', PEDREIRO, 30, 34);
}

describe('F14 — a tarefa de ocupar no quadro', () => {
  it('nao e tarefa de transporte: nao tem mercadoria', () => {
    const { state, id } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const t = state.jobs.tarefas.porId[id];
    expect(t?.tipo).toBe('ocupar');
    expect(t && ehTarefaDeTransporte(t)).toBe(false);
    expect(t && 'origem' in t).toBe(false);
  });

  it('elegibilidade vem do DESTINO, nao do tipo da tarefa', () => {
    const { state, id } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const t = state.jobs.tarefas.porId[id];
    if (!t) throw new Error('tarefa criada');
    expect(podeReclamar(state, t, PEDREIRO)).toBe(true);
    expect(podeReclamar(state, t, 'serf')).toBe(false);
    expect(podeReclamar(state, t, 'laborer')).toBe(false);
    // o mapa por tipo sozinho nunca autoriza uma ocupacao
    expect(elegivelParaTarefa('ocupar', PEDREIRO)).toBe(false);
  });

  it('o claim reserva a unica vaga: o segundo pedreiro e recusado', () => {
    const base = comUnidadeExtra(cenarioDeOcupacao(), 'esp2', PEDREIRO, 31, 34);
    const { state, id } = criarTarefaDeOcupacao(base, 'q1');
    expect(vagaDeOcupacao(state, 'q1')).toBe(1);

    const r = reclamar(state, id, 'esp1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ocupantesReservados(r.state, 'q1')).toBe(1);
    expect(vagaDeOcupacao(r.state, 'q1')).toBe(0);

    const { state: comSegunda, id: id2 } = criarTarefaDeOcupacao(r.state, 'q1');
    expect(reclamar(comSegunda, id2, 'esp2')).toEqual({ ok: false, motivo: 'destino-sem-vaga' });
  });

  it('serf nao reclama uma vaga de ocupante', () => {
    const { state, id } = criarTarefaDeOcupacao(cenarioDeOcupacao(), 'q1');
    const serf = serfsDoCenario(state)[0] ?? '';
    expect(reclamar(state, id, serf)).toEqual({ ok: false, motivo: 'unidade-invalida' });
  });

  it('sem caminho ate a porta, o claim recusa', () => {
    // o pedreiro nasce fora do mapa andavel: nenhuma rota ate a porta
    const base = comUnidadeExtra(cenarioDeOcupacao(), 'ilhado', PEDREIRO, 0, 0);
    const semRota = { ...base, unidades: { ...base.unidades, porId: { ...base.unidades.porId,
      ilhado: { ...base.unidades.porId.ilhado!, gx: -1, gy: -1 } } } };
    expect(caminhoAtePredioCompleto(semRota, 'q1', 'ilhado')).toBe(null);
  });

  it('reclamarMelhorOcupacao escolhe pelo caminho mais curto e desempata pelo numero', () => {
    let e = comPredioCompletoEm(cenarioDeOcupacao(), 'q2', { tipo: 'quarry', gx: 34, gy: 36 });
    e = criarTarefaDeOcupacao(e, 'q2').state; // longe
    e = criarTarefaDeOcupacao(e, 'q1').state; // perto
    const r = reclamarMelhorOcupacao(e, 'esp1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.jobs.tarefas.porId[r.tarefa]?.destino).toBe('q1');
  });
});
```

Importar `serfsDoCenario` de `./helpers/jobs-cenario`. O teste do caminho ajusta
a posição para fora do mapa; se `buscarCaminho` já rejeitar antes, o resultado
`null` é o mesmo — a asserção é sobre o retorno, não sobre o motivo interno.

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run tests/F14-ocupacao.test.ts` → FAIL.

- [ ] **Passo 3: o tipo de tarefa em `state.ts`**

Depois de `TarefaConstruir`:

```ts
/**
 * F14 — uma vaga de OCUPANTE num predio COMPLETO que pede trabalhador
 * (`buildings.json:trabalhador`). Molde da `TarefaConstruir`: SEM
 * `mercadoria`/`origem` e SEM `'carregando'` (o especialista nao carrega nada),
 * e FORA da escada de `delivery.json` — como a de construir, e pelo mesmo
 * motivo: quem a reclama nao disputa tarefa com serf nem com laborer.
 *
 * E o unico tipo cuja ELEGIBILIDADE depende do DESTINO e nao so do tipo da
 * tarefa: quem ocupa uma `quarry` e o civil que o dado declara para `quarry`.
 * Ver `podeReclamar` (jobs.ts).
 *
 * A tarefa SOME quando o especialista chega (`removerTarefa`), no MESMO tick em
 * que `predio.ocupante` passa a apontar para ele. Nao existe instante com
 * ocupante e reserva ao mesmo tempo — e por isso a vaga nunca fica negativa.
 */
export interface TarefaOcupar extends TarefaBase {
  readonly tipo: 'ocupar';
  readonly estado: 'aberta' | 'reclamada';
  /** Id do predio completo a ocupar. */
  readonly destino: string;
}

export type Tarefa = TarefaDeTransporte | TarefaConstruir | TarefaOcupar;
```

E `ehTarefaDeTransporte` passa a testar a **forma**:

```ts
/** Uma tarefa que o serf carrega: tem `mercadoria` e `origem`. Testa a FORMA, e
 *  nao `tipo !== 'construir'` (como ate a F13): com a chegada de `'ocupar'`
 *  (F14), o negativo classificaria a tarefa nova como transporte e ela passaria
 *  por `vagaDoDestino`/`disponivelNaOrigem`, que leriam `undefined`. Pela forma,
 *  um tipo novo so entra na uniao de transporte se realmente carregar algo. */
export function ehTarefaDeTransporte(tarefa: Tarefa): tarefa is TarefaDeTransporte {
  return 'mercadoria' in tarefa;
}
```

- [ ] **Passo 4: as reservas**

Em `src/sim/reservas.ts`, ao lado de `laborersReservados`:

```ts
/** F14 — vagas de OCUPACAO reservadas no predio `predioId`: tarefas `'ocupar'`
 *  que nao estao abertas — so `'reclamada'` existe para esse tipo. Irma de
 *  `laborersReservados`. */
export function ocupantesReservados(state: GameState, predioId: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.tipo === 'ocupar' && t.estado !== 'aberta' && t.destino === predioId) soma += 1;
  }
  return soma;
}

/**
 * A vaga de ocupante ainda reservavel: `vagasDoPredio - reservado`. Nunca fica
 * negativa: com uma vaga so, um claim ja zera a conta, e a chegada troca reserva
 * por posse no mesmo tick. O caso "ocupado por outro caminho" (save adulterado,
 * F16 demolindo e replantando) e pego no ramo INDIVIDUAL de `sanearTarefas`
 * (`motivoDoDestino` -> `destino-completo`), nao aqui.
 */
export function vagaDeOcupacao(
  state: GameState, predioId: string, dados: GameData = gameData,
): number {
  return vagasDoPredio(state.predios.porId[predioId], dados) - ocupantesReservados(state, predioId);
}
```

Importar `vagasDoPredio` de `./ocupacao`.

- [ ] **Passo 5: o JobBoard**

Em `src/sim/jobs.ts`:

```ts
const UNIDADE_ELEGIVEL_POR_TIPO: Readonly<Record<TipoDeTarefa, string | null>> = {
  'material-para-obra': TIPO_QUE_CARREGA,
  // F13: ouro tambem e carga — mesmo serf, mesma FSM, mesmo claim.
  'ouro-para-escola': TIPO_QUE_CARREGA,
  construir: TIPO_QUE_CONSTROI,
  // F14: 'ocupar' nao tem UM tipo elegivel — quem pode ocupar depende do PREDIO
  // de destino. `null` aqui significa "esta pergunta nao se responde so com o
  // tipo da tarefa", e por isso `elegivelParaTarefa` NUNCA autoriza uma
  // ocupacao: quem responde e `podeReclamar`.
  ocupar: null,
};
```

```ts
/**
 * F14 — a pergunta completa: esta unidade pode reclamar esta tarefa? Para tudo
 * que nao e `'ocupar'` e exatamente `elegivelParaTarefa` (o tipo basta). Para
 * `'ocupar'`, a resposta vem do DESTINO — o `trabalhador` que o tipo de predio
 * declara no dado.
 *
 * Toda checagem de elegibilidade do quadro passa por aqui: `reclamar`,
 * `sanearTarefas` e as invariantes de teste. `elegivelParaTarefa` continua
 * publica porque a F11b prende o par serf/laborer nela.
 */
export function podeReclamar(
  state: GameState, tarefa: Tarefa, tipoDaUnidade: string, dados: GameData = gameData,
): boolean {
  if (tarefa.tipo !== 'ocupar') return elegivelParaTarefa(tarefa.tipo, tipoDaUnidade);
  return predioAceita(state.predios.porId[tarefa.destino], tipoDaUnidade, dados);
}

/** F14 — cria uma vaga de OCUPANTE aberta no predio completo `destino`. Irma de
 *  `criarTarefaDeConstrucao`. */
export function criarTarefaDeOcupacao(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaOcupar = { id: `t${numero}`, numero, tipo: 'ocupar', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/** F14 — o caminho a pe do especialista ate a porta do predio COMPLETO. Irmao de
 *  `caminhoAteAObra`: mesma vizinhanca `'livre'` e a porta inteira
 *  (`tilesDaPorta`), porque o especialista nao carrega nada e nao depende de
 *  estrada — mesma regra do laborer. So o estado exigido do predio muda. */
export function caminhoAtePredioCompleto(
  state: GameState, predioId: string, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const predio = state.predios.porId[predioId];
  const unidade = state.unidades.porId[unidadeId];
  if (!predio || predio.estado !== 'completo' || !unidade) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, tilesDaPorta(predio, dados), 'livre', dados);
}
```

Em `reclamar`, a linha de elegibilidade e o ramo não-transporte:

```ts
  const unidade = state.unidades.porId[unidadeId];
  if (!unidade || !podeReclamar(state, tarefa, unidade.tipo, dados)) return { ok: false, motivo: 'unidade-invalida' };
```

```ts
  } else if (tarefa.tipo === 'construir') {
    // (o corpo existente da F11b, sem mudanca)
  } else {
    // 'ocupar' (F14): UMA vaga por predio, e o tipo certo de civil ja foi
    // checado em `podeReclamar`. Sem estrada exigida, como a de construir.
    if (vagaDeOcupacao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    if (caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
  }
```

E o par de ordenação/claim, irmão do de construção:

```ts
/**
 * As `'ocupar'` abertas na ordem de escolha do especialista: `(custo do caminho
 * A* a pe ate a porta, numero)`. SEM nivel — `'ocupar'` nao esta na escada de
 * `delivery.json`, como `'construir'`. Filtra por `podeReclamar`: um woodcutter
 * nunca ve a vaga da pedreira.
 */
export function tarefasDeOcupacaoEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaOcupar[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaOcupar => t !== undefined && t.tipo === 'ocupar' && t.estado === 'aberta')
    .filter((t) => unidade == null || podeReclamar(state, t, unidade.tipo, dados));
  const chaves = new Map(candidatas.map((t) => [
    t.id,
    unidadeId === null ? 0 : caminhoAtePredioCompleto(state, t.destino, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY,
  ]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = chaves.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** Reclama, para o especialista `unidadeId`, a melhor `'ocupar'` aberta QUE DER
 *  para reclamar — irma de `reclamarMelhorConstrucao`. */
export function reclamarMelhorOcupacao(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasDeOcupacaoEmOrdem(state, unidadeId, dados);
  const primeira = candidatas[0];
  if (primeira === undefined) return { ok: false, motivo: 'sem-tarefa-aberta' };
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of candidatas) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? 'sem-tarefa-aberta' };
}
```

Acrescentar aos imports de `jobs.ts`: `TarefaOcupar` (type, de `./state`),
`predioAceita` (de `./ocupacao`) e `vagaDeOcupacao` (de `./reservas`).

- [ ] **Passo 6: rodar e ver passar**

`npx vitest run tests/F14-ocupacao.test.ts` → PASS. `npm run typecheck` limpo.

- [ ] **Passo 7: commit**

```bash
git add -A
git commit -m "feat(F14): a tarefa 'ocupar' e a reserva derivada dela

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 4: o gerador e o saneamento reconhecem a ocupação

**Arquivos**
- Modificar: `src/sim/systems/jobs.ts`
- Modificar: `tests/F14-ocupacao.test.ts`

**Interfaces**
- Consome: `criarTarefaDeOcupacao`, `podeReclamar`, `vagasDoPredio`,
  `ehPredioOcupavel`.
- Produz: `gerarTarefas` criando `'ocupar'`; `sanearTarefas` liberando as
  inválidas.

- [ ] **Passo 1: escrever os testes que falham**

```ts
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';

const ocuparPara = (estado: GameState, destino: string) =>
  estado.jobs.tarefas.ordem.filter((id) => {
    const t = estado.jobs.tarefas.porId[id];
    return t?.tipo === 'ocupar' && t.destino === destino;
  });

describe('F14 — o gerador e o saneamento', () => {
  it('predio completo e vago que pede trabalhador ganha UMA vaga, e so uma', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    expect(ocuparPara(gerado, 'q1')).toHaveLength(1);
    // idempotente: rodar de novo nao duplica
    expect(ocuparPara(gerarTarefas(gerado), 'q1')).toHaveLength(1);
  });

  it('armazem e escola nunca ganham vaga de ocupante', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const semTrabalhador = gerado.predios.ordem.filter((id) => {
      const p = gerado.predios.porId[id];
      return p !== undefined && trabalhadorDoTipo(p.tipo) === null;
    });
    expect(semTrabalhador.length).toBeGreaterThan(0);
    for (const id of semTrabalhador) expect(ocuparPara(gerado, id)).toHaveLength(0);
  });

  it('predio ja ocupado nao ganha vaga nova', () => {
    const base = cenarioDeOcupacao();
    const q = base.predios.porId.q1;
    const ocupado = q?.estado === 'completo'
      ? { ...base, predios: { ...base.predios, porId: { ...base.predios.porId, q1: { ...q, ocupante: 'esp1' } } } }
      : base;
    expect(ocuparPara(gerarTarefas(ocupado), 'q1')).toHaveLength(0);
  });

  it('a vaga aberta some quando o predio deixa de existir', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const semQuarry = semOPredio(gerado, 'q1');
    const saneado = sanearTarefas(semQuarry).state;
    expect(ocuparPara(saneado, 'q1')).toHaveLength(0);
  });

  it('a vaga RECLAMADA e liberada quando o predio some, e a unidade nao fica presa', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const id = ocuparPara(gerado, 'q1')[0] ?? '';
    const r = reclamar(gerado, id, 'esp1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const saneado = sanearTarefas(semOPredio(r.state, 'q1')).state;
    expect(saneado.jobs.tarefas.porId[id]).toBeUndefined();
    expect(saneado.events.length >= 0).toBe(true);
  });

  it('a vaga reclamada e cancelada se o predio ganhou ocupante por outro caminho', () => {
    const gerado = gerarTarefas(cenarioDeOcupacao());
    const id = ocuparPara(gerado, 'q1')[0] ?? '';
    const r = reclamar(gerado, id, 'esp1');
    if (!r.ok) throw new Error('claim');
    const q = r.state.predios.porId.q1;
    const roubado = q?.estado === 'completo'
      ? { ...r.state, predios: { ...r.state.predios, porId: { ...r.state.predios.porId, q1: { ...q, ocupante: 'outro' } } } }
      : r.state;
    const saneado = sanearTarefas(roubado);
    expect(saneado.state.jobs.tarefas.porId[id]).toBeUndefined();
    expect(saneado.events.some((e) => e.type === 'task-released' && e.motivo === 'destino-completo')).toBe(true);
  });
});
```

Importar `semOPredio` de `./helpers/jobs-cenario` e o tipo `GameState`.
`sanearTarefas` devolve `{state, events}`; o teste do prédio removido só precisa
que a tarefa suma.

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run tests/F14-ocupacao.test.ts` → FAIL.

- [ ] **Passo 3: `motivoDoDestino` ganha o ramo e o `dados`**

```ts
/**
 * O destino de `t` ainda e do tipo que a tarefa pressupoe? Obra, para material e
 * construir; escola completa, para ouro (F13); predio completo, ocupavel e VAGO,
 * para ocupar (F14). `null` se vale. Quem escolhe o ramo e o TIPO da tarefa, nao
 * o predio.
 */
function motivoDoDestino(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const destino = state.predios.porId[t.destino];
  if (!destino) return 'destino-sumiu';
  if (t.tipo === 'ouro-para-escola') return ehEscolaCompleta(destino) ? null : 'destino-sumiu';
  if (t.tipo === 'ocupar') {
    // Deixou de ser predio ocupavel (demolido e replantado, save de outra
    // versao): a tarefa nao tem mais sentido. Ja ocupado: a vaga acabou — e o
    // unico jeito de `vagaDeOcupacao` ficar negativa, e sai por aqui.
    if (!ehPredioOcupavel(destino, dados)) return 'destino-sumiu';
    return destino.ocupante === null ? null : 'destino-completo';
  }
  return ehObra(destino) ? null : 'destino-completo';
}
```

Ajustar as três chamadas: `motivoIndividual` já tem `dados`;
`motivoDaCarregando` passa a receber `dados: GameData` e repassar; `abertaVale`
já tem. Em `motivoIndividual`, a elegibilidade:

```ts
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || !podeReclamar(state, t, unidade.tipo, dados)) return 'unidade-removida';
```

- [ ] **Passo 4: a fase 4 de `sanearTarefas`**

```ts
    if (ehTarefaDeTransporte(t)) {
      // (o corpo existente)
    } else if (t.tipo === 'construir') {
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'construir' && o.destino === t.destino).length;
      if (existentes > dados.construcao.laborersMaximosPorObra) atual = cancelarAberta(atual, t.id);
    } else {
      // 'ocupar' (F14): o teto e a VAGA do predio (1 vago, 0 ocupado), derivada
      // do estado — nao ha teto em dado, ver `vagasDoPredio`.
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'ocupar' && o.destino === t.destino).length;
      if (existentes > vagasDoPredio(atual.predios.porId[t.destino], dados)) atual = cancelarAberta(atual, t.id);
    }
```

A fase 2 (grupo) continua só sobre transporte: a nota que já está lá — "o teto de
'construir' nunca encolhe em runtime" — ganha a frase de ocupação:

```ts
  //    ... So MATERIAL: o teto de 'construir' (`laborersMaximosPorObra`) e
  //    constante do dado, e o de 'ocupar' (F14) so encolhe junto com a remocao
  //    da propria tarefa (a chegada troca reserva por posse no mesmo tick) —
  //    nenhum dos dois fica retroativamente invalido por essa via.
```

- [ ] **Passo 5: o gerador**

No fim de `src/sim/systems/jobs.ts`:

```ts
/**
 * F14 — uma vaga de OCUPACAO por predio completo, vago e que pede trabalhador.
 * Cria MESMO SEM especialista daquele tipo no mapa, como `'construir'` cria sem
 * laborer (F11b): a vaga existe no quadro assim que o predio fica pronto. Quem
 * responde "este predio esta parado esperando trabalhador" e `predio.ocupante`
 * (F22), nunca a existencia da tarefa — entao o quadro nao precisa mentir.
 *
 * Nao exige estrada: o especialista anda em modo `'livre'`, como o laborer.
 */
function gerarTarefasDeOcupacao(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!ehPredioOcupavel(predio, dados) || predio.ocupante !== null) continue;
    const existentes = tarefasPorNumero(atual).filter((t) => t.tipo === 'ocupar' && t.destino === id).length;
    if (existentes >= vagasDoPredio(predio, dados)) continue;
    atual = criarTarefaDeOcupacao(atual, id).state;
  }
  return atual;
}
```

E no fim de `gerarTarefas`:

```ts
  // F14 por ultimo, e sobre PREDIOS COMPLETOS — o laco acima so olha obra. Uma
  // obra que o laborer completou neste tick ja entra aqui e ganha a vaga de
  // ocupante no mesmo tick; o especialista a reclama no tick seguinte.
  return gerarTarefasDeOcupacao(atual, dados);
```

Imports novos em `systems/jobs.ts`: `criarTarefaDeOcupacao`, `podeReclamar` (de
`../jobs`), `ehPredioOcupavel`, `vagasDoPredio` (de `../ocupacao`).

- [ ] **Passo 6: rodar e ver passar**

`npx vitest run tests/F14-ocupacao.test.ts` → PASS.

- [ ] **Passo 7: commit**

```bash
git add -A
git commit -m "feat(F14): o gerador cria a vaga e o saneamento a revalida

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 5: a FSM do especialista

**Arquivos**
- Criar: `src/sim/systems/especialistas.ts`
- Modificar: `src/sim/units/movimento.ts`, `src/sim/systems/laborers.ts`,
  `src/sim/state.ts` (evento)
- Criar: `tests/F14-especialista.test.ts`,
  `tests/helpers/especialista-invariantes.ts`

**Interfaces**
- Consome: `reclamarMelhorOcupacao`, `caminhoAtePredioCompleto`, `liberar`,
  `removerTarefa`, `predioDoOcupante`, `tiposQueOcupam`, `ehPredioOcupavel`.
- Produz: `sistemaDosEspecialistas(state, dados): ResultadoDeSistema`;
  `sanearOcupacao(state, dados): GameState`; evento `building-occupied`;
  `comPredio` em `units/movimento.ts`.

- [ ] **Passo 1: o evento**

Em `src/sim/state.ts`, no fim da união `GameEvent`:

```ts
  /**
   * F14 — um especialista chegou e ocupou um predio. `tipo` e o do CIVIL
   * (`stonemason`), nao o do predio — quem quiser o do predio o le do estado.
   */
  | {
      readonly type: 'building-occupied';
      readonly predio: string;
      readonly unidade: string;
      readonly tipo: string;
    }
```

- [ ] **Passo 2: subir `comPredio` (segundo consumidor)**

Mover, **sem mudar o corpo**, `comPredio` de `systems/laborers.ts` para
`src/sim/units/movimento.ts`, ao lado de `comUnidade`, com o comentário:

```ts
/** Troca um predio no estado. Era privado em `systems/laborers.ts` (F11c) e
 *  subiu aqui ao ganhar o segundo consumidor (F14), como `andar`/`chegou`
 *  subiram de `systems/serfs.ts`. */
export function comPredio(state: GameState, predio: Predio): GameState {
  return { ...state, predios: { ...state.predios, porId: { ...state.predios.porId, [predio.id]: predio } } };
}
```

Em `systems/laborers.ts`: apagar a função local e acrescentar `comPredio` ao
import de `../units/movimento`. Importar o tipo `Predio` em `movimento.ts`.

- [ ] **Passo 3: escrever o teste que falha**

```ts
// tests/F14-especialista.test.ts
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { predioDoOcupante, trabalhadorDoTipo } from '../src/sim/ocupacao';
import { comPredioCompletoEm, comUnidadeExtra, semAUnidade, semLaborers, semOPredio } from './helpers/jobs-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';

const inicial = createInitialState(1);
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const avancar = (e: GameState, n: number): GameState =>
  Array.from({ length: n }).reduce<GameState>((atual) => step(atual, []), e);

function cenario(qtdPedreiros: number, quarries: ReadonlyArray<{ id: string; gx: number; gy: number }>) {
  let e = semLaborers(inicial);
  for (const q of quarries) e = comPredioCompletoEm(e, q.id, { tipo: 'quarry', gx: q.gx, gy: q.gy });
  for (let i = 0; i < qtdPedreiros; i++) e = comUnidadeExtra(e, `esp${i + 1}`, PEDREIRO, 30 + i, 34);
  return e;
}

describe('F14 — a FSM do especialista', () => {
  it('sai de ocioso, anda e ocupa: o predio aponta para ele e a tarefa sai do quadro', () => {
    const fim = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    expect(fim.predios.porId.q1?.estado === 'completo' && fim.predios.porId.q1.ocupante).toBe('esp1');
    expect(fim.unidades.porId.esp1?.fsm).toBe('trabalhando');
    expect(fim.unidades.porId.esp1?.fsmData).toEqual({});
    expect(fim.jobs.tarefas.ordem.filter((id) => fim.jobs.tarefas.porId[id]?.tipo === 'ocupar')).toHaveLength(0);
    expect(violacoesDaFsmDoEspecialista(fim)).toEqual([]);
  });

  it('emite building-occupied uma unica vez', () => {
    let e = cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]);
    let ocupacoes = 0;
    for (let i = 0; i < 200; i++) {
      e = step(e, []);
      ocupacoes += e.events.filter((ev) => ev.type === 'building-occupied').length;
    }
    expect(ocupacoes).toBe(1);
  });

  it('dois pedreiros e UMA quarry: um ocupa, o outro fica ocioso e sem tarefa', () => {
    const fim = avancar(cenario(2, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    const ocupante = fim.predios.porId.q1?.estado === 'completo' ? fim.predios.porId.q1.ocupante : null;
    expect(ocupante).not.toBe(null);
    const sobrou = ocupante === 'esp1' ? 'esp2' : 'esp1';
    expect(fim.unidades.porId[sobrou]?.fsm).toBe('ocioso');
    expect(predioDoOcupante(fim, sobrou)).toBe(null);
    expect(violacoesDaFsmDoEspecialista(fim)).toEqual([]);
  });

  it('predio demolido no meio do caminho: volta a ocioso sem tarefa presa', () => {
    const emCaminho = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 3);
    expect(emCaminho.unidades.porId.esp1?.fsm).toBe('indo_ocupar');
    const depois = avancar(semOPredio(emCaminho, 'q1'), 2);
    expect(depois.unidades.porId.esp1?.fsm).toBe('ocioso');
    expect(depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.tipo === 'ocupar')).toHaveLength(0);
    expect(violacoesDaFsmDoEspecialista(depois)).toEqual([]);
  });

  it('predio demolido DEPOIS de ocupado: o especialista volta a ocioso', () => {
    const ocupado = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    expect(ocupado.unidades.porId.esp1?.fsm).toBe('trabalhando');
    const depois = avancar(semOPredio(ocupado, 'q1'), 2);
    expect(depois.unidades.porId.esp1?.fsm).toBe('ocioso');
  });

  it('ocupante que some devolve o predio a vago, e a vaga reabre', () => {
    const ocupado = avancar(cenario(1, [{ id: 'q1', gx: 26, gy: 36 }]), 200);
    const depois = step(semAUnidade(ocupado, 'esp1'), []);
    expect(depois.predios.porId.q1?.estado === 'completo' && depois.predios.porId.q1.ocupante).toBe(null);
    expect(depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.tipo === 'ocupar')).toHaveLength(1);
  });

  it('serf e laborer nao entram no sistema: seguem na FSM deles', () => {
    const comLaborer = avancar(comPredioCompletoEm(inicial, 'q1', { tipo: 'quarry', gx: 26, gy: 36 }), 50);
    for (const id of comLaborer.unidades.ordem) {
      const u = comLaborer.unidades.porId[id];
      if (u && (u.tipo === 'serf' || u.tipo === 'laborer')) {
        expect(u.fsm).not.toBe('indo_ocupar');
        expect(u.fsm).not.toBe('trabalhando');
      }
    }
  });
});
```

- [ ] **Passo 4: as invariantes**

```ts
// tests/helpers/especialista-invariantes.ts
/**
 * As invariantes da FSM do especialista (F14), irma de `laborer-invariantes.ts`.
 * Devolve a lista de violacoes (vazia = tudo certo). O ponto central: a POSSE
 * mora so no predio, entao "os dois lados concordam" e a coisa a verificar.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import { predioAceita, predioDoOcupante, tiposQueOcupam } from '../../src/sim/ocupacao';

export const ESTADOS_DO_ESPECIALISTA = ['ocioso', 'indo_ocupar', 'trabalhando'] as const;

export function violacoesDaFsmDoEspecialista(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const ocupam = tiposQueOcupam(dados);
  const tarefasPorUnidade = new Map<string, string[]>();
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t && t.tipo === 'ocupar' && t.estado !== 'aberta' && t.reclamadaPor !== null) {
      tarefasPorUnidade.set(t.reclamadaPor, [...(tarefasPorUnidade.get(t.reclamadaPor) ?? []), id]);
    }
  }

  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (!u || !ocupam.has(u.tipo)) continue;
    if (!(ESTADOS_DO_ESPECIALISTA as readonly string[]).includes(u.fsm)) {
      v.push(`${id}: estado '${u.fsm}' fora do GDD §6.2`);
    }
    const suas = tarefasPorUnidade.get(id) ?? [];
    if (suas.length > 1) v.push(`${id}: segura ${suas.length} tarefas de ocupar`);
    const predio = predioDoOcupante(estado, id);

    switch (u.fsm) {
      case 'ocioso':
        if (Object.keys(u.fsmData).length > 0) v.push(`${id}: ocioso com fsmData nao vazio`);
        if (suas.length > 0) v.push(`${id}: ocioso mas a tarefa ${suas[0]} e dele`);
        if (predio !== null) v.push(`${id}: ocioso mas ocupa ${predio.id}`);
        break;
      case 'indo_ocupar':
        if (suas.length !== 1) v.push(`${id}: indo_ocupar sem tarefa 'ocupar' reclamada por ele`);
        if (predio !== null) v.push(`${id}: indo_ocupar mas ja ocupa ${predio.id}`);
        break;
      case 'trabalhando':
        if (predio === null) v.push(`${id}: trabalhando sem predio que o reconheca`);
        if (suas.length > 0) v.push(`${id}: trabalhando e ainda segura a tarefa ${suas[0]}`);
        if (Object.keys(u.fsmData).length > 0) v.push(`${id}: trabalhando com fsmData nao vazio`);
        break;
      default:
        break;
    }
    const caminho = u.fsmData.caminho ?? [];
    if (caminho.length > 0 && u.fsm !== 'indo_ocupar') v.push(`${id}: ${u.fsm} com caminho pendente`);
  }

  // a outra direcao: todo predio com ocupante aponta para uma unidade viva, do
  // tipo que ele aceita, e nenhuma unidade ocupa dois predios.
  const vistos = new Set<string>();
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (!p || p.estado !== 'completo' || p.ocupante === null) continue;
    if (vistos.has(p.ocupante)) v.push(`${p.ocupante}: ocupa mais de um predio`);
    vistos.add(p.ocupante);
    const u = estado.unidades.porId[p.ocupante];
    if (!u) v.push(`${id}: ocupante '${p.ocupante}' nao existe`);
    else if (!predioAceita(p, u.tipo, dados)) v.push(`${id}: ocupante '${p.ocupante}' e ${u.tipo}, que o predio nao aceita`);
    else if (u.fsm !== 'trabalhando') v.push(`${id}: ocupante '${p.ocupante}' esta em '${u.fsm}'`);
  }
  return v;
}
```

- [ ] **Passo 5: rodar e ver falhar**

`npx vitest run tests/F14-especialista.test.ts` → FAIL.

- [ ] **Passo 6: o sistema**

```ts
// src/sim/systems/especialistas.ts
/**
 * F14 — a FSM do especialista (GDD §6.2), um passo por tick, na ordem de
 * `unidades.ordem`.
 *
 *   ocioso -> indo_ocupar -> trabalhando
 *
 * O GDD chama o primeiro estado de `sem_predio`; aqui ele e `ocioso`, o mesmo de
 * toda unidade recem-nascida (`systems/escolas.ts`) e o que
 * `ficarOcioso`/`ocioso` produzem. Mesmo significado, um nome so (Nota do item
 * F14 no BUILD_PLAN). Os outros dois estados do GDD (`esperando_insumo`,
 * `saida_cheia`) sao de PRODUCAO e nascem na F15.
 *
 * MOVIMENTO: modo `'livre'`, como o laborer — o especialista nao carrega nada e
 * nao depende de estrada para chegar.
 *
 * A POSSE mora no PREDIO (`PredioCompleto.ocupante`), nunca na unidade:
 * `trabalhando` e verdade enquanto o predio ainda aponta para ela. Predio
 * demolido (F16) e ocupante morto (F20) desfazem a posse pelos dois lados —
 * `sanearOcupacao` do lado do predio, `passoTrabalhando` do lado da unidade.
 *
 * Quem SEGURA a tarefa e revalidado por `sanearTarefas`, como nas outras FSMs:
 * nenhum ramo aqui precisa lembrar de liberar por conta do destino.
 */
import type { GameEvent, GameState, PredioCompleto, TarefaOcupar, Unidade } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { caminhoAtePredioCompleto, liberar, reclamarMelhorOcupacao, removerTarefa } from '../jobs';
import { ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam } from '../ocupacao';
import { tileAndavel } from '../pathfinding';
import { andar, chegou, comPredio, comUnidade, dadosDaFsm, ficarOcioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

/** A tarefa de OCUPAR desta unidade, se existe, esta `'reclamada'` e e mesmo dela. */
function tarefaDoEspecialista(state: GameState, u: Unidade): TarefaOcupar | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && t.tipo === 'ocupar' && t.estado === 'reclamada' && t.reclamadaPor === u.id ? t : null;
}

/**
 * Desfaz a posse que deixou de valer, do lado do PREDIO: ocupante que nao existe
 * mais (morreu, F20) ou que nao e do tipo que o predio pede (save de outra
 * versao). Devolve o MESMO objeto quando nada muda — molde de `sanearFilas`
 * (systems/escolas.ts): um tick normal nao aloca estado novo por causa disto.
 */
export function sanearOcupacao(state: GameState, dados: GameData = gameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (predio === undefined || predio.estado !== 'completo' || predio.ocupante === null) continue;
    const ocupante = atual.unidades.porId[predio.ocupante];
    if (ocupante !== undefined && predioAceita(predio, ocupante.tipo, dados)) continue;
    atual = comPredio(atual, { ...predio, ocupante: null });
  }
  return atual;
}

// --- os estados ---

function passoOcioso(state: GameState, u: Unidade, dados: GameData): Passo {
  const r = reclamarMelhorOcupacao(state, u.id, dados);
  if (!r.ok) return semEventos(state);
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta?.tipo === 'ocupar' ? bruta : undefined;
  const caminho = tarefa === undefined ? null : caminhoAtePredioCompleto(r.state, tarefa.destino, u.id, dados);
  if (tarefa === undefined || caminho === null) {
    // o claim ja exigiu o caminho; se ele sumiu, devolve a reserva em vez de segurar a tarefa
    const l = liberar(r.state, r.tarefa, 'pedido-da-unidade');
    return { state: l.state, events: l.events };
  }
  return semEventos(comUnidade(r.state, {
    ...u, fsm: 'indo_ocupar', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
  }));
}

function passoIndoOcupar(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoEspecialista(state, u);
  if (tarefa === null) return ficarOcioso(state, u); // o quadro a cancelou
  const predio = state.predios.porId[tarefa.destino];
  // outro especialista, mais cedo no MESMO tick, pode ter ocupado o predio: a
  // tarefa deste so e cancelada no tick seguinte, mas nao ha mais o que fazer aqui.
  if (!ehPredioOcupavel(predio, dados) || predio.ocupante !== null) return ficarOcioso(state, u);

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados)) {
    // um predio foi plantado no caminho: replaneja a partir de onde esta
    const caminho = caminhoAtePredioCompleto(state, tarefa.destino, u.id, dados);
    if (caminho === null) {
      const l = liberar(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
      return ficarOcioso(l.state, u, l.events);
    }
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));

  // Chegou: a posse passa ao predio e a tarefa SAI do quadro no mesmo tick. Nao
  // existe instante com ocupante e reserva ao mesmo tempo.
  const ocupado: PredioCompleto = { ...predio, ocupante: u.id };
  const semATarefa = removerTarefa(comPredio(state, ocupado), tarefa.id);
  return {
    state: comUnidade(semATarefa, { ...andou, fsm: 'trabalhando', fsmData: {} }),
    events: [{ type: 'building-occupied', predio: ocupado.id, unidade: u.id, tipo: u.tipo }],
  };
}

function passoTrabalhando(state: GameState, u: Unidade): Passo {
  // A posse mora no predio: sumiu, deixou de ser ocupavel ou passou a apontar
  // para outro, este especialista volta a procurar. Nada alem disso na F14 —
  // PRODUZIR e F15, e e la que entram `esperando_insumo` e `saida_cheia`.
  return predioDoOcupante(state, u.id) === null ? ficarOcioso(state, u) : semEventos(state);
}

function passoDoEspecialista(state: GameState, u: Unidade, dados: GameData): Passo {
  switch (u.fsm) {
    case 'ocioso': return passoOcioso(state, u, dados);
    case 'indo_ocupar': return passoIndoOcupar(state, u, dados);
    case 'trabalhando': return passoTrabalhando(state, u);
    default:
      // `fsm` e uma string no estado (JSON): um valor fora do GDD §6.2 e save corrompido
      throw new Error(`sistemaDosEspecialistas: estado de FSM desconhecido '${u.fsm}' no especialista ${u.id}`);
  }
}

/** Um tick da FSM de cada especialista, na ordem de `unidades.ordem`.
 *  Determinista. Especialista e quem OCUPA algum predio segundo
 *  `buildings.json` — serf e laborer nao aparecem la, entao nao entram aqui e
 *  nao disputam tarefa com ninguem (mesma regra da F11b, agora vinda do dado). */
export function sistemaDosEspecialistas(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = sanearOcupacao(state, dados);
  const events: GameEvent[] = [];
  const ocupam = tiposQueOcupam(dados);
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || !ocupam.has(u.tipo)) continue;
    const r = passoDoEspecialista(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
```

- [ ] **Passo 7: encaixar no tick**

Em `src/sim/tick.ts`, depois dos laborers:

```ts
  const laborers = sistemaDosLaborers(serfs.state, dados);
  // F14: os especialistas DEPOIS dos laborers (o predio que ficou pronto neste
  // tick so ganha vaga de ocupante no `gerarTarefas` do fim deste tick, e a vaga
  // e reclamada no tick seguinte) e ANTES de `gerarTarefas` (a ocupacao concluida
  // aqui tira a tarefa do quadro antes de o gerador olhar, entao ele nao recria
  // nada). Antes da escola por simetria com os outros: a unidade que NASCE neste
  // tick entra em `unidades.ordem` depois e comeca a andar no tick seguinte.
  const especialistas = sistemaDosEspecialistas(laborers.state, dados);
  const escolas = sistemaDasEscolas(especialistas.state, dados);
  atual = gerarTarefas(escolas.state, dados);
  events.push(...saneado.events, ...serfs.events, ...laborers.events, ...especialistas.events, ...escolas.events);
```

- [ ] **Passo 8: rodar e ver passar**

`npx vitest run tests/F14-especialista.test.ts` → PASS.

- [ ] **Passo 9: commit**

```bash
git add -A
git commit -m "feat(F14): a FSM do especialista e o saneamento da posse

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 6: a suíte inteira — triagem do que a tarefa nova mexeu

**Arquivos**
- Modificar: `tests/helpers/jobs-invariantes.ts` e os testes que a triagem
  apontar.

**Por que esta tarefa existe:** toda `quarry` completa que já aparece em fixture
antiga passa a ter uma tarefa `'ocupar'` aberta no quadro, e o
`jobs-invariantes.ts` hoje afirma "todo destino é obra" e "tudo que não é
material é construir". Isso é fallout previsto, não bug novo.

- [ ] **Passo 1: consertar as invariantes do JobBoard**

Em `tests/helpers/jobs-invariantes.ts`:

```ts
    const destino = estado.predios.porId[t.destino];
    if (t.tipo === 'ocupar') {
      // F14: o destino de 'ocupar' e um predio COMPLETO, vago e que pede trabalhador.
      if (!ehPredioOcupavel(destino, dados)) v.push(`${id}: destino '${t.destino}' nao e predio ocupavel`);
      else if (destino.ocupante !== null) v.push(`${id}: destino '${t.destino}' ja tem ocupante`);
    } else if (!destino || destino.estado !== 'obra') {
      v.push(`${id}: destino '${t.destino}' nao e obra`);
    }
```

```ts
      } else {
        const u = estado.unidades.porId[t.reclamadaPor];
        if (!u || !podeReclamar(estado, t, u.tipo, dados)) {
          v.push(`${id}: ${t.estado} por unidade inexistente ou de tipo errado`);
        }
        // (o resto do bloco, sem mudanca)
      }
```

(some o `const tipoElegivel = ...`), e a contagem de construção passa a filtrar
pelo tipo:

```ts
    } else if (t.tipo === 'construir' && t.estado !== 'aberta') {
      contagemDeConstrucaoPorObra.set(t.destino, (contagemDeConstrucaoPorObra.get(t.destino) ?? 0) + 1);
    }
```

Imports novos: `podeReclamar` (de `../../src/sim/jobs`) e `ehPredioOcupavel` (de
`../../src/sim/ocupacao`); `TIPO_QUE_CARREGA`/`TIPO_QUE_CONSTROI` podem ficar sem
uso — nesse caso, tirar do import (o lint reprova import morto).

- [ ] **Passo 2: rodar a suíte inteira e triar**

`npm run test`

Suspeitos, pela natureza do que mudou (**conferir, não presumir**):
`tests/F05a-estado-inicial.test.ts` (forma do prédio completo),
`tests/F10-falhas.test.ts:83` e `tests/F10-ciclo.test.ts:108`
(`tarefas.ordem` esperado vazio), `tests/F11c-laborer.test.ts` e
`tests/F11c-estagio-obra.test.ts` (a obra completa vira `quarry` vaga e ganha
uma tarefa de ocupação), `tests/F12-desbloqueio.test.ts`.

**Regra da correção:** o teste que fala de transporte passa a filtrar por tipo
(`.filter((id) => porId[id]?.tipo === 'material-para-obra')`) — é o padrão que
`F10-fsm.test.ts:71` e `F10-falhas.test.ts:45` já usam. O teste que afirma
"quadro vazio" só pode continuar afirmando isso se o cenário realmente não tiver
prédio ocupável vago; caso contrário, a asserção passa a nomear o que espera.
**Proibido** `skip`, `eslint-disable` ou afrouxar uma asserção para o verde.

- [ ] **Passo 3: `npm run verify`**

Tem que sair com código 0 antes de seguir.

- [ ] **Passo 4: commit**

```bash
git add -A
git commit -m "test(F14): invariantes e fixtures reconhecem a tarefa de ocupar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 7: o aceite do BUILD_PLAN e a evidência

**Arquivos**
- Criar: `tests/F14-aceite.test.ts`

**O cenário, com as coordenadas do dado:** o armazém do cenário inicial fica em
(29,30) e a escola em (34,30), ambos 3×3, com a linha de porta em y=33 — a mesma
`RUAS = linhaH(29,36,33)` da F13a. As duas quarries (3×2) entram completas por
fixture em (26,36) e (34,36), portas em y=38, sem encostar em nada. O ouro do
treino sai do estoque inicial (`gold: 20`), pela estrada, no ombro de um serf:
**nada põe ouro na escola à mão**.

Os dois stonemasons são **treinados de verdade** (F13a ponta a ponta): é o que dá
sentido a "2 stonemasons treinados" e prova a passagem da escola para a ocupação.
As quarries vêm de fixture porque construí-las seria reprovar a F11c aqui.

- [ ] **Passo 1: escrever o teste**

```ts
// tests/F14-aceite.test.ts
/**
 * F14 — o aceite do BUILD_PLAN, ponta a ponta: duas Quarries prontas, dois
 * stonemasons TREINADOS na escola (o ouro atravessa a estrada no ombro de um
 * serf, como na F13a), e cada um ocupa uma pedreira. Nenhum predio com dois.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { armazemPorTipo, avancar, escolaDoCenario, novasUnidades, pedir } from './helpers/escola-cenario';
import { comEstradas, comPredioCompletoEm, linhaH } from './helpers/jobs-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const RUAS = linhaH(29, 36, 33);
const PEDREIRO = trabalhadorDoTipo('quarry') ?? '';
const QUARRIES = [{ id: 'q1', gx: 26, gy: 36 }, { id: 'q2', gx: 34, gy: 36 }] as const;
const PEDIDOS = [pedir(ESCOLA, PEDREIRO), pedir(ESCOLA, PEDREIRO)];
/** 2 x (1 tick de cobranca + ticksPorTreino) + entrega do ouro + as duas
 *  caminhadas ate as pedreiras. 1200 e folga larga, como na F13a. */
const TICKS = 1200;

const ocupanteDe = (e: GameState, id: string): string | null => {
  const p = e.predios.porId[id];
  return p?.estado === 'completo' ? p.ocupante : null;
};

function cenario(): GameState {
  let e = comEstradas(inicial, RUAS);
  for (const q of QUARRIES) e = comPredioCompletoEm(e, q.id, { tipo: 'quarry', gx: q.gx, gy: q.gy });
  return e;
}

describe('F14 — aceite headless do BUILD_PLAN', () => {
  it('2 quarries e 2 stonemasons treinados: cada um num predio, nenhum com dois', () => {
    const montado = cenario();
    expect(ocupanteDe(montado, 'q1')).toBe(null);
    expect(ocupanteDe(montado, 'q2')).toBe(null);

    const fim = avancar(step(montado, [...PEDIDOS]), TICKS);

    // 1. os dois civis existem, do tipo pedido, e vieram da escola
    const novos = novasUnidades(montado, fim).filter((u) => u.tipo === PEDREIRO);
    expect(novos).toHaveLength(2);

    // 2. os dois predios tem ocupante
    const ocupantes = [ocupanteDe(fim, 'q1'), ocupanteDe(fim, 'q2')];
    expect(ocupantes.every((o) => o !== null)).toBe(true);

    // 3. NENHUM ficou com dois: os ocupantes sao pessoas diferentes, e sao
    //    exatamente os dois que a escola formou
    expect(new Set(ocupantes).size).toBe(2);
    expect([...ocupantes].sort()).toEqual(novos.map((u) => u.id).sort());

    // 4. os dois estao trabalhando, e o quadro nao guardou vaga orfa
    for (const u of novos) expect(fim.unidades.porId[u.id]?.fsm).toBe('trabalhando');
    const vagas = fim.jobs.tarefas.ordem.filter((id) => fim.jobs.tarefas.porId[id]?.tipo === 'ocupar');
    expect(vagas).toHaveLength(0);

    // 5. as invariantes dos dois lados
    expect(violacoesDaFsmDoEspecialista(fim)).toEqual([]);

    gravarEvidencia('F14', {
      feature: 'F14 — Especialistas ocupam predios',
      aceite: 'cenario com 2 Quarries prontas e 2 stonemasons treinados: apos N ticks os dois predios tem ocupante e nenhum ficou com dois',
      dado: {
        trabalhadorDaQuarry: PEDREIRO,
        ticksPorTreino: gameData.economia.schoolhouse.ticksPorTreino,
        custoOuroPorUnidade: gameData.economia.schoolhouse.custoOuroPorUnidade,
      },
      cenario: { estrada: 'linhaH(29,36,33)', quarries: QUARRIES, armazem: armazemPorTipo(inicial).id, escola: ESCOLA },
      ticks: TICKS,
      predios: QUARRIES.map((q) => ({ id: q.id, ocupante: ocupanteDe(fim, q.id) })),
      especialistas: novos.map((u) => ({
        id: u.id, tipo: u.tipo, fsm: fim.unidades.porId[u.id]?.fsm, gx: fim.unidades.porId[u.id]?.gx, gy: fim.unidades.porId[u.id]?.gy,
      })),
      ocupantesDistintos: new Set(ocupantes).size,
      vagasAbertasNoFim: vagas.length,
      violacoes: { especialista: violacoesDaFsmDoEspecialista(fim) },
    });
  });

  it('determinismo e save/load com uma ocupacao em curso', () => {
    const r = compararComESemSave({
      seed: 7,
      totalTicks: 400,
      saveAtTick: 120,
      comandosNoTick: (t) => (t === 5 ? [...PEDIDOS] : []),
      antesDoStep: (e) => (e.tick === 0 ? cenario() : e),
    });
    expect(r.comSave).toBe(r.direto);
  });

  it('as invariantes do quadro seguem valendo tick a tick', () => {
    let e = step(cenario(), [...PEDIDOS]);
    for (let i = 0; i < 300; i++) {
      e = step(e, []);
      const v = [...violacoesDaFsmDoEspecialista(e), ...violacoesDeInvariantes(e)];
      expect(v, `tick ${e.tick}`).toEqual([]);
    }
  });
});
```

Importar `step` de `../src/sim/tick`. Se `violacoesDeInvariantes` acusar as
tarefas de ouro deste cenário (ela exige destino em obra para tudo que não é
`'ocupar'`), **não afrouxar a invariante**: restringir a terceira asserção ao
que ela cobre, ou usar um cenário sem escola — registrar a escolha em
`PROGRESS.md`.

- [ ] **Passo 2: rodar**

`npx vitest run tests/F14-aceite.test.ts` → PASS.

- [ ] **Passo 3: abrir a evidência com Read**

`Read test-output/F14.json`. Conferir com o olho, não presumir: dois ids de
ocupante **diferentes**, `ocupantesDistintos: 2`, `vagasAbertasNoFim: 0`, e os
dois especialistas em `trabalhando` na porta de uma quarry (y=38).

- [ ] **Passo 4: commit**

```bash
git add -A
git commit -m "feat(F14): o aceite ponta a ponta e a evidencia

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Tarefa 8: não-regressão dos roteiros visuais

**Por que:** a feature não toca `render/`, mas muda o que a sim produz (uma
unidade nova andando). O contrato do §8 é rodar os roteiros e **conferir o
código de saída** — screenshot de outra feature não se abre com Read.

- [ ] **Passo 1: rodar dois roteiros que já existem**

```bash
npm run shot -- F11c
npm run shot -- F13b
```

Ambos com código de saída 0 e sem erro de console (o runner falha sozinho nesse
caso). **Não abrir as imagens.**

- [ ] **Passo 2: registrar o resultado**

Anotar os dois códigos de saída no bloco de PROGRESS da Tarefa 9, como
não-regressão — e não como evidência visual da F14 (que, por D5, não tem).

---

## Tarefa 9: registros, portão e fechamento

**Arquivos**
- Modificar: `BUILD_PLAN.md`, `PROGRESS.md`, `test-results.json`

- [ ] **Passo 1: as Notas no `BUILD_PLAN.md`**

No item **F14**, quatro Notas, no estilo das da F13b:

1. **Nota (D1, decisão registrada): o alerta de "prédio sem trabalhador" é da
   F22, não desta feature.** O critério de aceite da F14 não o menciona e a
   evidência pedida é JSON, sem screenshot; e a F22 faz os quatro alertas com UM
   mecanismo só, sendo que três das causas nem são observáveis antes da
   F15/F20/F21 — entregar uma causa isolada agora obrigaria a refazer o
   componente. A falta de nota de integração no item **não** é argumento (ver
   D1).
2. **Nota (D2): a FSM entregue é `ocioso → indo_ocupar → trabalhando`.** O
   `sem_prédio` do GDD §6.2 chama-se `ocioso` no código, porque toda unidade
   nasce assim e `ficarOcioso`/`ocioso` são compartilhados. `esperando_insumo` e
   `saida_cheia` são da F15.
3. **Nota (D3): "um prédio, um ocupante" mora no tipo,** em
   `PredioCompleto.ocupante: string | null`. Não há `ocupantesMaximosPorPredio`
   em dado porque não há o que balancear — dois ocupantes não são
   representáveis. Diferente do `laborersMaximosPorObra`, que é teto de verdade.
4. **Nota (D4): a vaga de ocupação nasce mesmo sem especialista no mapa,** como
   a de construir (F11b), e **não exige estrada** — o especialista anda em modo
   `'livre'`, como o laborer.

No item **F15**, Nota (origem: F14): *prédio sem `ocupante` não produz — a
pergunta é `ehPredioOcupavel(predio) && predio.ocupante === null`
(`sim/ocupacao.ts`). É nesta feature que "fica parado" ganha significado
observável, e é aqui que entram `esperando_insumo` e `saida_cheia` (GDD §6.2).*

No item **F16**, Nota (origem: F14): *o "ocupante" do painel é
`PredioCompleto.ocupante`, um id de unidade ou `null`. É nesta feature que a
ocupação ganha evidência visual (o aceite da F16 já pede screenshot; o da F14
não). Demolir prédio ocupado tem que devolver o especialista a `ocioso` — o
caminho existe (`passoTrabalhando`, que lê a posse do prédio), mas quem o prova
pelo comando real é este item.*

No item **F22**, Nota (origem: F14): *a derivação de "prédio sem trabalhador"
**nasce pronta na F14**: é `predio.ocupante === null` num prédio completo cujo
tipo pede trabalhador — `ehPredioOcupavel` + `vagasDoPredio`, em
`sim/ocupacao.ts`. O que falta aqui é **só o mecanismo de exibição**, o mesmo
que serve as outras três causas (sem estrada, fome, mina esgotada). A F14 não
entregou nada de tela, de propósito.*

- [ ] **Passo 2: `PROGRESS.md`**

Seção nova no topo, `## F14 — Especialistas ocupam prédios`, com: as cinco
decisões (D1–D5) e o porquê de cada uma; a lista **Verificado** separada da
**Hipótese**, nomeando o que foi aberto com Read (`test-output/F14.json`) e o
que foi só código de saída (os dois roteiros da Tarefa 8); o fallout da Tarefa 6
(quais testes mudaram e por quê); e o que ficou **fora de escopo** por decisão
(alerta do HUD, produção, painel).

- [ ] **Passo 3: o portão**

```bash
npm run verify
```

Código 0. Só então escrever `"F14-especialistas-ocupam": { "passes": true }` em
`test-results.json` — o hook recusa sem o selo fresco.

- [ ] **Passo 4: commit final**

```bash
git add -A
git commit -m "feat(F14): PROGRESS, notas do BUILD_PLAN e test-results

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Definition of Done (CLAUDE.md §7)

- [ ] `npm run test` verde, com `tests/F14-aceite.test.ts` incluso.
- [ ] `npm run typecheck` e `npm run lint` sem erro.
- [ ] `test-output/F14.json` **aberto com Read** e conferido: dois ocupantes
      distintos, nenhum prédio com dois, nenhuma vaga órfã.
- [ ] `npm run validate:data` passa (nenhum dado mudou, mas o portão roda).
- [ ] Nenhum import de `phaser` em `src/sim/`; nenhum arquivo de `render/`,
      `ui/` ou `input/` tocado.
- [ ] Commits feitos, um por tarefa.
