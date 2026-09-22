# F12 — Desbloqueio por conclusão — Plano de implementação

> **Para o executor:** use `superpowers:executing-plans` tarefa a tarefa. **Não**
> use `subagent-driven-development` nem `dispatching-parallel-agents` — proibidos
> pelo CLAUDE.md §11. Passos usam checkbox (`- [ ]`).

**Objetivo:** ligar o evento `building-completed` (que a F11c já emite e ninguém
consome) a `registrarTipoConstruido`, de modo que concluir um prédio libere os
filhos dele na árvore de `data/buildings.json`.

**Arquitetura:** uma função pura nova em `src/sim/desbloqueio.ts` que dobra os
eventos de um tick sobre `registrarTipoConstruido`, chamada **uma vez** no fim do
`step()`. Nenhum sistema novo, nenhum campo novo no `GameState`, nenhuma mudança
em `render/` ou `ui/`.

**Spec:** `BUILD_PLAN.md`, seção "F12 — Desbloqueio por conclusão" (linhas
230-262). O critério de aceite vem de lá, **intocado** (CLAUDE.md §11).

---

## Context

O desbloqueio já existe inteiro e está testado (F06): `estaDesbloqueado` consulta
`state.tiposJaConstruidos`, `registrarTipoConstruido` acrescenta um tipo à lista,
e `opcoesDoMenuBuild` transforma isso nas linhas do painel. O que falta é **um fio
de ligação**: hoje o único produtor de `tiposJaConstruidos` é `createInitialState`
(`state.ts:472`, via `tiposCompletos`), e o comentário em
`desbloqueio.ts:33-34` diz literalmente *"Quem chama é o sistema que conclui obras
(a F12 liga isto ao `step()`); até lá o único produtor é o `createInitialState`."*

A F11c fechou o outro lado do fio: `sistemaDosLaborers` emite
`{ type: 'building-completed', predio, tipo }` no tick exato em que `completarObra`
troca `PredioEmObra` por `PredioCompleto` (`laborers.ts:167`), e **deliberadamente
não** chama `registrarTipoConstruido` (`state.ts:376-377`).

**Resultado pretendido:** um Woodcutter's plantado pela UI, conduzido até
`'completo'` só pelo `step()`, libera a Sawmill; a Sawmill concluída libera a Farm
e os demais filhos dela. Evidência em `test-output/F12.json`.

---

## Instruções do operador nesta sessão (replicadas — não reabrir)

1. **O gancho já existe.** `building-completed` é o ponto de ligação; ligá-lo a
   `registrarTipoConstruido` é *tudo* que muda no contrato de desbloqueio. Nada
   de detectar a transição varrendo `predios` e comparando com o tick anterior.
2. **O aceite foi reescrito quando `menuBuildInicial` esvaziou** e agora exige
   conduzir a obra até `'completo'` pelo `step()`, sem injetar prédio pronto —
   o que só passou a ser possível depois da F11c. **Confirmar que o teste usa o
   caminho real**: `PlaceBlueprint` de verdade, `step()` de verdade, nenhuma
   fixture que fabrique um `PredioCompleto`.
3. Nada além da F12.

---

## Estado verificado do código (base do plano)

Tudo abaixo foi confirmado por leitura nesta sessão, arquivo e linha.

| Fato | Onde |
|---|---|
| `estaDesbloqueado` = `menuBuildInicial` **ou** `desbloqueadoPor ∈ tiposJaConstruidos` | `src/sim/desbloqueio.ts:20-28` |
| `registrarTipoConstruido` existe, é puro e idempotente; **ninguém chama** | `src/sim/desbloqueio.ts:36-39` |
| `GameEvent` já tem `building-completed` (7º membro), com `predio` e `tipo` | `src/sim/state.ts:68-77` |
| `sistemaDosLaborers` emite o evento ao completar; não registra nada | `src/sim/systems/laborers.ts:163-168` |
| `step()` monta o retorno campo a campo, com `tiposJaConstruidos: atual.tiposJaConstruidos` | `src/sim/tick.ts:77-87` |
| Ordem do tick: comandos → `sanearTarefas` → serfs → laborers → `gerarTarefas` | `src/sim/tick.ts:71-75` |
| `aplicarPlaceBlueprint` cria a obra com `nivelamento: 0` e id `p${proximoId}`; **não debita estoque** | `src/sim/systems/build.ts:46-55` |
| `canPlace` recusa com `'bloqueado'` quando `estaDesbloqueado` é falso | `src/sim/placement.ts:50` |
| `opcoesDoMenuBuild` devolve `{ id, custo, tamanho, desbloqueado, requer }` | `src/sim/selectors.ts:206-219` |
| O painel relê `opcoesDoMenuBuild(estado)` a cada `atualizar()` e reescreve `aria-disabled` | `src/ui/menu-build.ts:140-147` |
| `menuBuildInicial: []` — o desbloqueio vem **todo** da árvore | `data/economy.json:12` |
| Estado inicial: Storehouse (29,30) e Schoolhouse (34,30), ambos completos; estoque 40 timber / 30 stone | `data/economy.json:5-10` |

**A árvore, na parte que este plano usa** (`data/buildings.json:6-33`):

| Prédio | `desbloqueadoPor` | `tamanho` | custo | `hp` |
|---|---|---|---|---|
| `woodcutters` | `schoolhouse` | `[3,2]` | 3 timber + 2 stone | 250 |
| `sawmill` | `woodcutters` | `[4,2]` | 4 timber + 3 stone | 350 |
| `farm`, `wineyard`, `fishermans`, `gold_mine`, `coal_mine`, `iron_mine`, `weapons_workshop`, `barracks`, `marketplace` | `sawmill` | — | — | — |

Liberados no estado inicial (`tiposJaConstruidos = ['storehouse','schoolhouse']`):
`schoolhouse`, `inn` (filhos de storehouse) e `quarry`, `woodcutters` (filhos de
schoolhouse). **`sawmill` fica de fora** — é o elo que o aceite testa.

**Nada de dado novo.** `validate:data` não muda: nenhum JSON é tocado.

---

## Arquitetura

### Onde o evento é consumido

Uma função pura em `src/sim/desbloqueio.ts` — **o mesmo arquivo** de
`registrarTipoConstruido`, porque é a mesma preocupação e o arquivo já é o lar
único de "o que libera o quê". Nenhum arquivo novo, nenhum sistema novo: isto não
tem relógio nem FSM, é uma reação a eventos já anunciados.

```
registrarConclusoes(state, events) = events
  .filter(e => e.type === 'building-completed')
  .reduce((s, e) => registrarTipoConstruido(s, e.tipo), state)
```

### Onde entra no tick

No **fim** do `step()`, depois de todos os sistemas, sobre a lista `events`
completa do tick:

```
comandos → sanearTarefas → serfs → laborers → gerarTarefas → registrarConclusoes
```

Três razões, nesta ordem de peso:

1. **Não depende de quem concluiu.** Hoje só `sistemaDosLaborers` emite
   `building-completed`. Amanhã pode ser outro (F16 demolir/reconstruir, um
   cheat de teste, um sistema de reparo). Lendo a lista de eventos do tick
   inteiro, a F12 não precisa saber o nome de nenhum sistema.
2. **Não muda mais nada.** Nenhum sistema do tick lê `tiposJaConstruidos` —
   confirmado: os únicos leitores são `estaDesbloqueado` (chamado por
   `canPlace`, que roda na fase de **comandos**) e `opcoesDoMenuBuild` (render).
   Então a posição dentro do tick é livre, e a do fim é a mais barata de
   justificar.
3. **O desbloqueio vale para o clique seguinte, que é o correto.** Comandos
   rodam no início do tick. Uma obra que fecha no tick `t` libera os filhos para
   os comandos de `t+1`. O jogador nunca vê a diferença (o painel lê o estado
   *depois* do tick), e a alternativa — liberar no meio do próprio tick — não
   tem consumidor.

### O que NÃO muda

- **Nada em `render/` nem em `ui/`.** `menu-build.ts:140-147` já relê o seletor a
  cada `atualizar(estado)` e reescreve `aria-disabled`; "o menu Build reflete na
  hora" sai de graça. Isso mantém a F12 **só de `sim/`**, sem precisar da exceção
  de feature de integração da §10 — e o BUILD_PLAN não a concede a ela.
- **Nenhum JSON.** Sem `validate:data` novo, sem schema novo.
- **O desbloqueio continua permanente.** Demolir não re-bloqueia; isso já está em
  `desbloqueio.ts:12-15` e travado por três testes da F06. A F12 não toca nisso.

### A queda esperada na suíte da F11c (o ponto de maior risco)

`tests/F11c-laborer.test.ts:500` afirma hoje:

```ts
expect(atual.tiposJaConstruidos).toEqual(tiposAntes); // registrarTipoConstruido e da F12
```

Isso foi escrito **como guarda de fronteira** enquanto ninguém consumia o evento.
A F12 é exatamente a feature que o inverte: depois dela, o Quarry daquele cenário
**entra** no histórico. O mesmo vale para o campo `tiposJaConstruidosNaoMudou` da
evidência gravada em `test-output/F11c.json`.

Isto **não enfraquece o aceite da F11c**, que é "Quarry 3 timber + 2 stone, 250 HP,
após a entrega dos 5 materiais o HP é 250 e o prédio fica `completo`, screenshots
dos três estágios" (`BUILD_PLAN.md:191-193`) — `tiposJaConstruidos` não aparece
nele. Mas é mudança de **valor asserido em suíte de outra feature**, então tem
portão de parada escrito (Task 2).

**A guarda não some, muda de lar e de nível.** O que a F11c queria travar
("concluir obra não desbloqueia por conta própria") vira, na F12, uma invariante
por tick, asserida no teste desta feature:

- o histórico cresceu neste tick ⟹ houve `building-completed` neste tick
  (não há desbloqueio silencioso);
- houve `building-completed` de um tipo ainda ausente ⟹ o histórico agora o contém
  (não há desbloqueio perdido).

Note que não é um "se e somente se" simples: um **segundo** Quarry concluído emite
o evento e **não** faz a lista crescer (`registrarTipoConstruido` é idempotente).
As duas implicações acima são a forma correta, e é assim que o teste as escreve.

---

## File Structure

| Arquivo | O quê |
|---|---|
| `src/sim/desbloqueio.ts` | **modificar** — `registrarConclusoes`, ao lado de `registrarTipoConstruido` |
| `src/sim/tick.ts` | **modificar** — uma chamada no fim do `step()` |
| `src/sim/state.ts` | **modificar** — só o comentário do evento (linhas 68-73), que diz "até a F12 ligar" |
| `tests/F12-desbloqueio.test.ts` | **criar** — unidade + o aceite headless em 4 passos |
| `tests/F11c-laborer.test.ts` | **modificar** — a asserção invertida e o campo da evidência (Task 2) |
| `PROGRESS.md`, `BUILD_PLAN.md`, `test-results.json` | **modificar** — Task 4 |

---

## Global Constraints

- `src/sim/` não importa `phaser`, não toca `window`/`document`/`canvas`, não usa
  `Math.random()` nem `Date.now()`.
- Nenhum número de balanceamento em `.ts`. (Esta feature não introduz número
  nenhum: a árvore inteira já está em `data/buildings.json`.)
- `GameState` continua serializável: `tiposJaConstruidos` já é `readonly string[]`.
- Nenhum id de prédio digitado em `src/sim/desbloqueio.ts` — a regra que o arquivo
  declara no próprio comentário (`:15`) e que a F12 não pode quebrar.
- Definition of Done do CLAUDE.md §7. **Sem screenshot** nesta feature, por
  decisão escrita no BUILD_PLAN (`:249-250`): conduzir uma obra até o fim só com
  cliques é roteiro da F17.
- Não tocar em `render/` nem em `ui/`.

---

## Tarefas

### Task 0 — branch

- [ ] **Passo 1: confirmar árvore limpa e sair de `main`**

```bash
git status --short
git switch -c F12
```

---

### Task 1 — `registrarConclusoes`: a dobra pura sobre os eventos

**Files:**
- Modify: `src/sim/desbloqueio.ts`
- Test: `tests/F12-desbloqueio.test.ts` (criar)

**Interfaces:**
- Consome: `registrarTipoConstruido(state, tipo) -> GameState` (já existe,
  `desbloqueio.ts:36`); `GameEvent` (`state.ts:20-77`).
- Produz: `registrarConclusoes(state: GameState, events: readonly GameEvent[]) -> GameState`,
  consumida pela Task 2 em `tick.ts`.

- [ ] **Passo 1: escrever o teste que falha**

Criar `tests/F12-desbloqueio.test.ts` com:

```ts
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameEvent, GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { estaDesbloqueado, registrarConclusoes } from '../src/sim/desbloqueio';

const inicial = createInitialState(1);

const concluido = (predio: string, tipo: string): GameEvent =>
  ({ type: 'building-completed', predio, tipo });

/** Os ids liberados AGORA, calculados do dado — nunca uma lista digitada. */
const liberados = (e: GameState): string[] =>
  gameData.predios.filter((p) => estaDesbloqueado(e, p.id)).map((p) => p.id);

describe('F12 — registrarConclusoes: a dobra dos eventos do tick', () => {
  it('tick sem building-completed devolve o MESMO estado (identidade, nao copia)', () => {
    const outros: GameEvent[] = [
      { type: 'tick-advanced', tick: 1 },
      { type: 'building-completed', predio: 'p9', tipo: 'storehouse' }, // ja no historico
    ];
    expect(registrarConclusoes(inicial, [outros[0] as GameEvent])).toBe(inicial);
    expect(registrarConclusoes(inicial, outros)).toBe(inicial); // idempotente por tipo
  });

  it('um building-completed acrescenta o tipo e libera os filhos dele', () => {
    const depois = registrarConclusoes(inicial, [concluido('p7', 'woodcutters')]);
    expect(depois.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
    expect(estaDesbloqueado(inicial, 'sawmill')).toBe(false);
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(true);
  });

  it('dois eventos no mesmo tick registram os dois, na ordem dos eventos', () => {
    const depois = registrarConclusoes(inicial, [
      concluido('p7', 'woodcutters'), concluido('p8', 'quarry'),
    ]);
    expect(depois.tiposJaConstruidos)
      .toEqual([...inicial.tiposJaConstruidos, 'woodcutters', 'quarry']);
  });

  it('dois eventos do MESMO tipo no mesmo tick registram uma vez so', () => {
    const depois = registrarConclusoes(inicial, [
      concluido('p7', 'woodcutters'), concluido('p8', 'woodcutters'),
    ]);
    expect(depois.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
  });

  it('nao muta o estado recebido', () => {
    const congelado = Object.freeze({
      ...inicial, tiposJaConstruidos: Object.freeze([...inicial.tiposJaConstruidos]),
    }) as GameState;
    const antes = liberados(congelado);
    registrarConclusoes(congelado, [concluido('p7', 'woodcutters')]);
    expect(liberados(congelado)).toEqual(antes);
  });
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

```bash
npx vitest run tests/F12-desbloqueio.test.ts
```

Esperado: FAIL — `registrarConclusoes` não é exportada por `src/sim/desbloqueio.ts`
(erro de import/`undefined is not a function`), não um `expect` que não bate.

- [ ] **Passo 3: implementar**

Em `src/sim/desbloqueio.ts`, trocar a primeira linha de import para incluir o
tipo do evento:

```ts
import type { GameEvent, GameState } from './state';
```

e acrescentar, **no fim do arquivo** (depois de `registrarTipoConstruido`):

```ts
/**
 * F12 — o gancho do desbloqueio: os eventos de UM tick, dobrados sobre
 * `registrarTipoConstruido`. Pura e idempotente por herança dele — dois
 * `building-completed` do mesmo tipo no mesmo tick registram uma vez só, e um
 * tick sem nenhum devolve o MESMO estado (identidade, não cópia).
 *
 * Por que ler EVENTO e não comparar `predios` com o tick anterior: a transição
 * já é anunciada por quem a faz (`sistemaDosLaborers`, F11c) e o evento é o
 * contrato registrado no BUILD_PLAN. Redescobrir a transição por diferença de
 * estado seria uma segunda fonte de verdade — e amarraria o desbloqueio ao
 * sistema que hoje por acaso conclui obras.
 *
 * Continua sem nenhum id de prédio: o `tipo` vem do evento, a árvore vem do dado.
 */
export function registrarConclusoes(
  state: GameState, events: readonly GameEvent[],
): GameState {
  let atual = state;
  for (const evento of events) {
    if (evento.type === 'building-completed') atual = registrarTipoConstruido(atual, evento.tipo);
  }
  return atual;
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

```bash
npx vitest run tests/F12-desbloqueio.test.ts
npm run typecheck && npm run lint
```

Esperado: 5 testes PASS, typecheck e lint limpos.

- [ ] **Passo 5: commit**

```bash
git add src/sim/desbloqueio.ts tests/F12-desbloqueio.test.ts
git commit -m "feat(F12): registrarConclusoes, a dobra dos eventos do tick (Task 1)"
```

---

### Task 2 — ligar no `step()` e adaptar a guarda de fronteira da F11c

**Files:**
- Modify: `src/sim/tick.ts`
- Modify: `src/sim/state.ts` (só o comentário de `building-completed`)
- Modify: `tests/F11c-laborer.test.ts:500` e o campo da evidência em `:526`
- Test: `tests/F12-desbloqueio.test.ts`

**Interfaces:**
- Consome: `registrarConclusoes` (Task 1).
- Produz: `step()` passa a mover `tiposJaConstruidos`. É disso que o aceite da
  Task 3 depende.

> **Por que a mudança na F11c vem NESTE commit, e não num separado:** a ligação em
> `tick.ts` é o que derruba a asserção. Separá-las deixaria a suíte vermelha num
> commit, e o CLAUDE.md §7 exige `npm run test` verde por feature entregue. As duas
> são a mesma mudança vista de dois lados.

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar a `tests/F12-desbloqueio.test.ts` (e completar o bloco de imports do
topo com `import { step } from '../src/sim/tick';`):

```ts
describe('F12 — o step() consome o evento', () => {
  it('um tick sem conclusao nao mexe no historico', () => {
    const depois = step(inicial, []);
    expect(depois.tiposJaConstruidos).toEqual(inicial.tiposJaConstruidos);
  });

  it('o historico do estado devolvido pelo step ja conta a conclusao do proprio tick', () => {
    // Nao se fabrica o evento: o proximo teste (Task 3) o produz pelo caminho real.
    // Aqui prova-se so que o step LE a lista de eventos que ele mesmo montou, e que o
    // campo `tiposJaConstruidos` do retorno vem de depois da dobra, nao de antes.
    const comConclusao = registrarConclusoes(inicial, [concluido('p7', 'woodcutters')]);
    const depois = step(comConclusao, []);
    expect(depois.tiposJaConstruidos).toContain('woodcutters'); // sobrevive ao tick
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(true);
  });
});
```

- [ ] **Passo 2: rodar a suíte inteira e ver as DUAS coisas**

```bash
npx vitest run tests/F12-desbloqueio.test.ts tests/F11c-laborer.test.ts
```

Esperado: os novos testes da F12 **passam já** (não dependem da ligação — são o
piso), e `tests/F11c-laborer.test.ts` continua **verde**, porque a ligação ainda
não existe. Este passo é a foto do "antes": anote que a F11c está verde aqui.

- [ ] **Passo 3: ligar no `tick.ts`**

Acrescentar o import (junto dos outros de `./`, em ordem alfabética — depois de
`./data` e antes de `./systems/build`):

```ts
import { registrarConclusoes } from './desbloqueio';
```

e, logo depois da linha `events.push(...saneado.events, ...serfs.events, ...laborers.events);`
(`tick.ts:75`), antes do `return`:

```ts
  // F12: o desbloqueio le os eventos do TICK INTEIRO, depois de todos os sistemas — assim
  // nao depende de QUAL sistema concluiu a obra (hoje so o laborer, F11c). Nenhum sistema
  // le `tiposJaConstruidos` (os leitores sao `canPlace`, na fase de comandos, e o seletor do
  // menu, no render), entao a posicao aqui dentro nao muda mais nada: o que ela fixa e que
  // a conclusao do tick `t` vale para os COMANDOS de `t+1`, que e onde o jogador clica.
  // Identidade num tick sem conclusao.
  atual = registrarConclusoes(atual, events);
```

`tick.ts:84` (`tiposJaConstruidos: atual.tiposJaConstruidos`) já colhe o resultado
— **não** mexer no `return`.

- [ ] **Passo 4: rodar e ver a F11c cair**

```bash
npx vitest run tests/F11c-laborer.test.ts
```

Esperado: FAIL em **exatamente um** teste — `o quarry sobe do zero ate completo, so
pelo step()` —, na linha `expect(atual.tiposJaConstruidos).toEqual(tiposAntes)`,
com `quarry` sobrando no recebido. **Se cair mais do que isso, PARE e reporte**:
significa que a ligação mexeu em algo que este plano não previu.

- [ ] **Passo 5: inverter a guarda da F11c, no lugar certo**

Em `tests/F11c-laborer.test.ts`, trocar a linha 500:

```ts
    expect(atual.tiposJaConstruidos).toEqual(tiposAntes); // registrarTipoConstruido e da F12
```

por:

```ts
    // F12 ligou `building-completed` a `registrarTipoConstruido` no `step()`: o tipo agora
    // ENTRA no historico, e a assercao de antes (escrita quando ninguem consumia o evento)
    // deixou de valer. O aceite da F11c nao depende disto — ele e hp 250 + `completo`. O que
    // a guarda antiga protegia ("concluir obra nao desbloqueia sozinho") virou invariante por
    // tick no teste da F12: historico cresceu => houve evento, e vice-versa.
    expect(atual.tiposJaConstruidos).toEqual([...tiposAntes, 'quarry']);
```

e o campo da evidência na linha 526:

```ts
        tiposJaConstruidosNaoMudou: JSON.stringify(atual.tiposJaConstruidos) === JSON.stringify(tiposAntes),
```

por:

```ts
        // F12: era `tiposJaConstruidosNaoMudou`. Virou o seu oposto no mesmo lugar, para a
        // evidencia gravada nao afirmar o que deixou de ser verdade.
        tiposJaConstruidosGanhouOTipoConcluido:
          JSON.stringify(atual.tiposJaConstruidos) === JSON.stringify([...tiposAntes, 'quarry']),
```

- [ ] **Passo 6: atualizar o comentário do evento em `state.ts`**

O comentário de `building-completed` (`state.ts:68-73`) promete uma coisa que
acabou de acontecer. Trocar o miolo:

```ts
       * A obra virou predio COMPLETO (F11c: `hp === def.hp`). Quem emite NAO
       * desbloqueia nada: e o `step()` que, no fim do tick, dobra os eventos com
       * `registrarConclusoes` (`sim/desbloqueio.ts`) e move `tiposJaConstruidos` (F12).
       * Separado de proposito — quem conclui anuncia, quem desbloqueia escuta.
```

E, em `state.ts:376-377`, o comentário de `completarObra` diz *"NAO chama
`registrarTipoConstruido` — quem chama emite `building-completed`; a F12 decide o
que fazer com ele."* Trocar a última oração por: *"a F12 o consome no fim do
`step()` (`registrarConclusoes`)."* **Não** mudar o corpo da função.

- [ ] **Passo 7: rodar a suíte inteira**

```bash
npm run test
```

Esperado: tudo verde, 29 arquivos. Se algum teste **fora** de
`tests/F11c-laborer.test.ts` mudar de resultado, PARE e reporte antes de commitar.

- [ ] **Passo 8: PORTÃO DE PARADA — conferir o diff da F11c**

```bash
git diff tests/F11c-laborer.test.ts
```

Conferir, com os olhos, que mudaram **só** (a) a asserção de
`tiposJaConstruidos`, (b) o campo homônimo da evidência, (c) comentários. **Nenhum**
outro valor asserido da F11c pode ter mudado — em especial
`predioFicouCompleto`, `hpFinal` (250), `hpTotalDoTipo`, `tickFaltamVazio <=
tickHp250`, `tickNivelamentoPronto < tickPrimeiroMaterialCompletado`,
`liberacoesPorPedidoDaUnidade === []`, `buildingCompletedEventos`. Se algum deles
precisou mudar, **parar e reportar** — é sinal de que a F12 alterou comportamento
da F11c, o que não é o combinado.

- [ ] **Passo 9: commit**

```bash
git add src/sim/tick.ts src/sim/state.ts src/sim/desbloqueio.ts tests/F12-desbloqueio.test.ts tests/F11c-laborer.test.ts
git commit -m "feat(F12): step() consome building-completed e move tiposJaConstruidos (Task 2)"
```

---

### Task 3 — o aceite headless do BUILD_PLAN, nos 4 passos

**Files:**
- Modify: `tests/F12-desbloqueio.test.ts`
- Produz: `test-output/F12.json`

**Interfaces:**
- Consome: `step`, `createInitialState`, `opcoesDoMenuBuild`, `estaDesbloqueado`,
  os helpers `comEstradas`/`linhaH`/`linhaV`/`tile` de `tests/helpers/jobs-cenario.ts`
  e `gravarEvidencia` de `tests/helpers/evidence.ts`.

**A geometria, e por que ela é assim.** O armazém fica em (29,30), 3×3, então a
porta (borda sul) é a fileira `y = 33`, colunas 29..31.

- **Woodcutter's** `[3,2]` em **(26,34)** → ocupa x 26..28, y 34..35; porta em
  y=36, colunas 26..28. É a mesma posição que o Quarry da F10/F11c usa, já
  conhecida boa.
- **Sawmill** `[4,2]` em **(24,38)** → ocupa x 24..27, y 38..39; porta em y=40,
  colunas 24..27. Não encosta no Woodcutter's (y 34..35), não sai do mapa, e
  **nenhum tile de estrada cai sobre o footprint** — `canPlace` recusaria com
  `'estrada'`.
- **Ruas:** a coluna x=29 de y=33 a y=40, mais (28,36) para entrar na porta do
  Woodcutter's, mais a fileira y=40 de x=27 a x=29 para entrar na porta da
  Sawmill.

**Por que as ruas vêm de `comEstradas` (fixture) e não de `PlaceRoad`:** o aceite
não fala de estrada, e `PlaceRoad` debita pedra por tile
(`terrain.estrada.custoStonePorTile`). Amarrar o teste de *desbloqueio* ao preço
da estrada faria um rebalanceamento futuro quebrar a F12 por um motivo que não é
dela. Os **prédios**, que é o que o aceite exige, vêm por `PlaceBlueprint` de
verdade. Nenhum prédio pronto é injetado — esta é a checagem que o operador pediu.

- [ ] **Passo 1: escrever o aceite (vermelho por não existir ainda)**

Acrescentar ao topo de `tests/F12-desbloqueio.test.ts` os imports que faltam:

```ts
import { beforeAll, afterAll } from 'vitest';
import type { Command } from '../src/sim/commands';
import { opcoesDoMenuBuild } from '../src/sim/selectors';
import { comEstradas, linhaH, linhaV, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';
```

e, no fim do arquivo:

```ts
/**
 * O aceite do BUILD_PLAN (linhas 233-243), nos quatro passos que ele escreve. O
 * cenario e montado pelo caminho REAL: `PlaceBlueprint` de verdade para cada predio
 * e `step()` para conduzir a obra ate `'completo'`. Nenhum `PredioCompleto` e
 * fabricado por fixture — e disso que o passo 3 do aceite depende, e so a F11c
 * (FSM do laborer) tornou possivel.
 */
describe('F12 — aceite headless do BUILD_PLAN', () => {
  const LENHADOR = { gx: 26, gy: 34 }; // woodcutters [3,2] -> x 26..28, y 34..35; porta y=36
  const SERRARIA = { gx: 24, gy: 38 }; // sawmill     [4,2] -> x 24..27, y 38..39; porta y=40
  const RUAS = [
    ...linhaV(29, 33, 40), // desce da porta do armazem (29,33)
    tile(28, 36),          // entra na porta do lenhador
    ...linhaH(27, 29, 40), // corre a oeste ate a porta da serraria (27,40)
  ];

  const plantar = (buildingId: string, p: { gx: number; gy: number }): Command =>
    ({ type: 'PlaceBlueprint', buildingId, gx: p.gx, gy: p.gy });

  const opcao = (e: GameState, id: string) => opcoesDoMenuBuild(e).find((o) => o.id === id);
  const doTipo = (e: GameState, tipo: string) =>
    e.predios.ordem.map((id) => e.predios.porId[id]).find((p) => p?.tipo === tipo);

  /** Os filhos DIRETOS de um pai, tirados do dado — nunca uma lista digitada. */
  const filhosDe = (pai: string): string[] =>
    gameData.predios.filter((p) => p.desbloqueadoPor === pai).map((p) => p.id);

  /** Roda ate a obra daquele tipo ficar `'completo'`, conferindo a invariante por tick. */
  function conduzir(inicio: GameState, tipo: string): {
    readonly estado: GameState; readonly tick: number;
    readonly semEvento: number[]; readonly semCrescimento: number[];
  } {
    let atual = inicio;
    const semEvento: number[] = [];      // historico cresceu sem ninguem anunciar
    const semCrescimento: number[] = []; // anunciaram tipo novo e o historico nao cresceu
    for (let i = 0; i < 2000 && doTipo(atual, tipo)?.estado !== 'completo'; i += 1) {
      const antes = atual.tiposJaConstruidos;
      atual = step(atual, []);
      const anunciados = atual.events
        .filter((e): e is Extract<GameEvent, { type: 'building-completed' }> => e.type === 'building-completed')
        .map((e) => e.tipo);
      const cresceu = atual.tiposJaConstruidos.length > antes.length;
      if (cresceu && anunciados.length === 0) semEvento.push(atual.tick);
      const novos = anunciados.filter((t) => !antes.includes(t));
      if (novos.some((t) => !atual.tiposJaConstruidos.includes(t))) semCrescimento.push(atual.tick);
    }
    return { estado: atual, tick: atual.tick, semEvento, semCrescimento };
  }

  const base = comEstradas(createInitialState(1), RUAS);

  let comObraDoLenhador: GameState;
  let lenhador: ReturnType<typeof conduzir>;
  let comObraDaSerraria: GameState;
  let serraria: ReturnType<typeof conduzir>;
  let recusasAoPlantar: GameEvent[] = [];

  beforeAll(() => {
    // 2. posiciona o Woodcutter's pela UI (PlaceBlueprint)
    comObraDoLenhador = step(base, [plantar('woodcutters', LENHADOR)]);
    // 3. conduz a obra ate 'completo' so pelo step()
    lenhador = conduzir(comObraDoLenhador, 'woodcutters');
    // 4. repete o elo: agora a Sawmill esta liberada e pode ser plantada
    comObraDaSerraria = step(lenhador.estado, [plantar('sawmill', SERRARIA)]);
    recusasAoPlantar = comObraDaSerraria.events.filter((e) => e.type === 'command-rejected');
    serraria = conduzir(comObraDaSerraria, 'sawmill');
  });

  it('1. o seletor do menu Build mostra a Sawmill bloqueada, exigindo o Woodcutter\'s', () => {
    expect(opcao(base, 'sawmill')?.desbloqueado).toBe(false);
    expect(opcao(base, 'sawmill')?.requer).toBe('woodcutters');
    expect(opcao(base, 'woodcutters')?.desbloqueado).toBe(true); // o pai ja e plantavel
  });

  it('2. com a obra do Woodcutter\'s ainda pendente, a Sawmill continua bloqueada', () => {
    expect(doTipo(comObraDoLenhador, 'woodcutters')?.estado).toBe('obra');
    expect(opcao(comObraDoLenhador, 'sawmill')?.desbloqueado).toBe(false);
    expect(comObraDoLenhador.tiposJaConstruidos).toEqual(base.tiposJaConstruidos);
  });

  it('3. concluida a obra pelo step(), a Sawmill libera e o conjunto cresce pelos filhos diretos', () => {
    expect(doTipo(lenhador.estado, 'woodcutters')?.estado).toBe('completo');
    expect(opcao(lenhador.estado, 'sawmill')?.desbloqueado).toBe(true);
    expect(opcao(lenhador.estado, 'sawmill')?.requer).toBe(null);
    // o conjunto cresceu EXATAMENTE pelos filhos diretos, calculados do dado
    expect(new Set(liberados(lenhador.estado)))
      .toEqual(new Set([...liberados(base), ...filhosDe('woodcutters')]));
    expect(lenhador.semEvento).toEqual([]);
    expect(lenhador.semCrescimento).toEqual([]);
  });

  it('4. repete o elo: a Sawmill concluida libera a Farm e os demais filhos dela', () => {
    expect(recusasAoPlantar).toEqual([]); // liberada de verdade: o comando NAO foi recusado
    expect(doTipo(serraria.estado, 'sawmill')?.estado).toBe('completo');
    expect(estaDesbloqueado(serraria.estado, 'farm')).toBe(true);
    expect(new Set(liberados(serraria.estado)))
      .toEqual(new Set([...liberados(lenhador.estado), ...filhosDe('sawmill')]));
    expect(filhosDe('sawmill')).toContain('farm'); // o elo que o aceite nomeia existe no dado
    expect(serraria.semEvento).toEqual([]);
    expect(serraria.semCrescimento).toEqual([]);
  });

  afterAll(() => {
    gravarEvidencia('F12', {
      feature: 'F12-desbloqueio',
      // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md (linhas 233-243).
      aceite: {
        sawmillBloqueadaNoInicio: opcao(base, 'sawmill')?.desbloqueado === false,
        sawmillRequerNoInicio: opcao(base, 'sawmill')?.requer ?? null,
        obraDoLenhadorPendente: doTipo(comObraDoLenhador, 'woodcutters')?.estado ?? null,
        sawmillBloqueadaComObraPendente: opcao(comObraDoLenhador, 'sawmill')?.desbloqueado === false,
        lenhadorFicouCompleto: doTipo(lenhador.estado, 'woodcutters')?.estado === 'completo',
        tickDoLenhador: lenhador.tick,
        sawmillLiberadaAposConclusao: opcao(lenhador.estado, 'sawmill')?.desbloqueado === true,
        filhosDiretosDeWoodcutters: filhosDe('woodcutters'),
        liberadosCresceramExatamentePelosFilhosDoLenhador:
          JSON.stringify([...liberados(lenhador.estado)].sort())
          === JSON.stringify([...liberados(base), ...filhosDe('woodcutters')].sort()),
        serrariaPlantadaSemRecusa: recusasAoPlantar.length === 0,
        serrariaFicouCompleta: doTipo(serraria.estado, 'sawmill')?.estado === 'completo',
        tickDaSerraria: serraria.tick,
        farmLiberada: estaDesbloqueado(serraria.estado, 'farm'),
        filhosDiretosDeSawmill: filhosDe('sawmill'),
        liberadosCresceramExatamentePelosFilhosDaSerraria:
          JSON.stringify([...liberados(serraria.estado)].sort())
          === JSON.stringify([...liberados(lenhador.estado), ...filhosDe('sawmill')].sort()),
        // a guarda que veio da F11c, agora como invariante por tick:
        ticksComCrescimentoSemEvento: [...lenhador.semEvento, ...serraria.semEvento],
        ticksComEventoNovoSemCrescimento: [...lenhador.semCrescimento, ...serraria.semCrescimento],
        historicoFinal: serraria.estado.tiposJaConstruidos,
      },
    });
  });
});
```

- [ ] **Passo 2: rodar**

```bash
npx vitest run tests/F12-desbloqueio.test.ts
```

Esperado: 9 testes PASS (5 da Task 1, 2 da Task 2, 4 daqui — conferir o total) e
`test-output/F12.json` gravado.

**Se `3.` falhar por a obra não ter completado em 2000 ticks:** o orçamento não é
o problema (o Quarry da F11c, mesmo `[3,2]` e mesmo hp 250, fecha por volta do
tick 233 — ver `test-output/F11c.json`; a Sawmill `[4,2]`, hp 350, custa mais e
ainda assim sobra). Falha aí quer dizer **geometria**: conferir, nesta ordem, se o
`PlaceBlueprint` foi recusado (`command-rejected` no primeiro `step`), se a porta
da obra tem estrada e se o armazém alcança essa porta.

- [ ] **Passo 3: abrir a evidência com Read**

Abrir `test-output/F12.json` com a ferramenta **Read** e conferir, item a item,
contra os 4 passos do aceite no `BUILD_PLAN.md`. CLAUDE.md §7: sem abrir, não se
sabe. Em especial: `ticksComCrescimentoSemEvento` e
`ticksComEventoNovoSemCrescimento` têm de estar **vazios**.

- [ ] **Passo 4: commit**

```bash
git add tests/F12-desbloqueio.test.ts test-output/F12.json
git commit -m "feat(F12): aceite headless em 4 passos, do PlaceBlueprint ao predio de pe (Task 3)"
```

---

### Task 4 — documentação e `test-results.json`

**Files:** `PROGRESS.md`, `BUILD_PLAN.md`, `test-results.json`.

- [ ] **Passo 1: `PROGRESS.md`**

Acrescentar, antes da linha `Histórico das features fechadas:`, um bloco novo:

```markdown
(origem: F12)

### O desbloqueio ligado ao `step()` (verificado)

`building-completed` deixou de ser um evento sem consumidor. `registrarConclusoes`
(`sim/desbloqueio.ts`) dobra os eventos de **um tick** sobre
`registrarTipoConstruido`, e o `step()` a chama **uma vez, no fim**, depois de
todos os sistemas.

- **Lê evento, não diferença de estado.** Quem conclui anuncia; quem desbloqueia
  escuta. Redescobrir a transição comparando `predios` com o tick anterior seria
  uma segunda fonte de verdade, e amarraria o desbloqueio ao sistema que hoje por
  acaso conclui obras (`sistemaDosLaborers`). Qualquer sistema futuro que emita
  `building-completed` é desbloqueado de graça.
- **Posição no tick, e por que ela é livre.** Nenhum sistema lê
  `tiposJaConstruidos` — os leitores são `canPlace` (fase de **comandos**) e
  `opcoesDoMenuBuild` (render). Então a conclusão do tick `t` vale para os
  **comandos de `t+1`**, que é onde o jogador clica; o painel, que lê o estado
  depois do tick, reflete na hora.
- **Zero mudança em `render/` e `ui/`.** `ui/menu-build.ts` já relê
  `opcoesDoMenuBuild(estado)` a cada `atualizar()`. A F12 ficou só em `sim/` e
  **não** precisou da exceção de feature de integração da §10.
- **A guarda da F11c mudou de nível, não sumiu.** `tests/F11c-laborer.test.ts`
  afirmava que `tiposJaConstruidos` não se movia depois de uma obra fechar — era
  guarda de fronteira enquanto ninguém consumia o evento, e a F12 é exatamente
  quem a inverte. O aceite da F11c (hp 250 + `completo` + screenshots) não
  dependia disso. O que ela protegia virou invariante **por tick** no teste da
  F12: histórico cresceu ⟹ houve `building-completed` no tick; anunciaram tipo
  novo ⟹ o histórico passou a contê-lo. Não é "se e somente se": um segundo
  prédio do mesmo tipo anuncia e não faz a lista crescer
  (`registrarTipoConstruido` é idempotente).
- **O aceite usa o caminho real, ponta a ponta** (conferido nesta sessão, a pedido
  do operador): `PlaceBlueprint` de verdade para os dois prédios, `step()` para
  conduzir cada obra até `'completo'`, nenhum `PredioCompleto` fabricado por
  fixture. As **estradas** vêm de fixture de propósito — o aceite não fala delas,
  e `PlaceRoad` debita pedra por tile, o que amarraria a F12 ao preço da estrada.
- **O que continua valendo:** o desbloqueio é permanente (demolir não re-bloqueia,
  F06) e `menuBuildInicial` segue existindo só para raiz sem pai.
```

- [ ] **Passo 2: `BUILD_PLAN.md`**

No item **F16 — painel de seleção e demolir**, acrescentar:

```markdown
- **Nota (origem: F12)**: o desbloqueio já está ligado ao `step()` e é
  **permanente** — `registrarConclusoes` só acrescenta a `tiposJaConstruidos`,
  nunca remove. Demolir o último Woodcutter's **não** re-bloqueia a Sawmill, e
  isso é decisão registrada (`sim/desbloqueio.ts`, travada por três testes da
  F06). A F16 não precisa de ramo nenhum para desbloqueio.
```

- [ ] **Passo 3: `npm run verify` e só então `test-results.json`**

```bash
npm run verify
```

Com o selo de 15 min válido, trocar em `test-results.json`:

```json
  "F12-desbloqueio": { "passes": true },
```

- [ ] **Passo 4: commit**

```bash
git add PROGRESS.md BUILD_PLAN.md test-results.json
git commit -m "feat(F12): documentacao e test-results.json (Task 4)"
```

---

### Task 5 — verificação final, não-regressão e merge

- [ ] **Passo 1: verify**

```bash
npm run verify
```

- [ ] **Passo 2: não-regressão dos roteiros**

A F12 **não tem screenshot próprio** (decisão escrita no `BUILD_PLAN.md:249-250`).
Mas ela muda o que acontece numa partida longa — prédios passam a entrar no
histórico —, então os roteiros que conduzem obra até o fim precisam rodar:

```bash
npm run shot -- F06    # o painel e o desbloqueio pela arvore
npm run shot -- F07
npm run shot -- F10
npm run shot -- F11c
```

Vale o **código de saída**, não abrir a imagem — imagem é o que mais pesa na
janela de contexto (CLAUDE.md §8), e nenhum desses é o roteiro da feature atual.

- [ ] **Passo 3: reabrir a evidência**

Abrir `test-output/F12.json` com **Read** (foi regravado pelo `verify`) e conferir
uma última vez contra os 4 passos do aceite.

- [ ] **Passo 4: merge, sem push**

```bash
git switch main && git merge --no-ff F12
```

**Sem push.**

---

## Verification

| Critério (BUILD_PLAN.md:233-243) | Como se prova |
|---|---|
| 1. Pelo seletor do menu Build, Sawmill bloqueada exigindo Woodcutter's | Task 3, teste `1.`: `opcao(base,'sawmill').desbloqueado === false` e `.requer === 'woodcutters'` |
| 2. Obra pendente **não** desbloqueia | Task 3, teste `2.`: estado `'obra'` e `desbloqueado === false` |
| 3. Obra conduzida a `'completo'` pelo `step()`, sem injetar prédio pronto | Task 3, `conduzir()` roda `step(atual, [])` em laço; o único prédio novo veio de `PlaceBlueprint` |
| 3. Conjunto de liberados cresceu **exatamente** pelos filhos diretos, do dado | Task 3: `new Set(liberados(depois))` vs `new Set([...liberados(antes), ...filhosDe('woodcutters')])`, com `filhosDe` derivado de `gameData.predios` |
| 4. Repete um elo: Sawmill concluída libera Farm e os demais filhos | Task 3, teste `4.`, mesma comparação de conjuntos + `estaDesbloqueado(...,'farm')` |
| `test-output/F12.json` | Task 3 Passo 3 e Task 5 Passo 3, aberto com Read |
| `npm run test` inteiro verde | Task 2 Passo 7, Task 5 Passo 1 |
| Sem `phaser` em `src/sim/` | `npm run lint` (regra já existente) |
| Sem número mágico | `npm run validate:data` + o diff: nenhum JSON muda, nenhum id de prédio entra em `desbloqueio.ts` |

**Riscos, em ordem:**

1. **A queda da F11c (Task 2).** É a única mudança de valor asserido em suíte de
   outra feature, e tem portão de parada escrito no Passo 8. O esperado é
   **exatamente um** teste caindo, por **exatamente uma** linha. Mais do que isso
   = parar e reportar.
2. **A geometria da Sawmill (Task 3).** `canPlace` recusa footprint sobre estrada,
   e a Sawmill `[4,2]` é o primeiro prédio deste tamanho posto num teste. O Passo 2
   traz a ordem de diagnóstico (recusa → porta com estrada → armazém alcança).
3. **Efeito colateral em partida longa.** Qualquer teste ou roteiro que rode
   centenas de ticks agora vê `tiposJaConstruidos` crescer e o menu ganhar linhas.
   O `npm run test` da Task 2 Passo 7 e os quatro roteiros da Task 5 Passo 2 são o
   que cobre isso.
