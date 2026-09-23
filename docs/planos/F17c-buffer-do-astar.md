# F17c — Buffer do A* reaproveitado · plano de implementação

**Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, inline.
> Os passos usam `- [ ]` para acompanhamento. `subagent-driven-development` e
> `dispatching-parallel-agents` estão **proibidos** (CLAUDE.md §11).

**Objetivo:** o custo de uma busca de A* deixa de ser proporcional à **área do
mapa**. Hoje toda busca aloca e preenche `Float64Array(largura*altura)` +
`Int32Array(largura*altura)` — 48 KB por chamada a 64², 768 KB a 256² — e por
isso a mesma caminhada de 3 tiles custa 7,6× mais num mapa maior.

**Arquitetura:** os três vetores viram **rascunho de módulo**, e a inicialização
por `fill` vira **marca de geração**: cada célula guarda em que busca foi
escrita, e marca diferente da geração atual lê como "não visitada". O rascunho
**cresce e nunca encolhe**, então um mapa maior reaproveita o buffer do menor.
Nenhuma mudança de comportamento: mesmo custo, mesmo caminho, mesmo desempate,
mesmo `null`.

**Stack:** Vitest headless. Nenhuma tela, nenhum screenshot — a feature é 100%
`src/sim/`.

**Fonte do critério:** `BUILD_PLAN.md`, item `### F17c — Buffer do A*
reaproveitado`. O critério **não se reescreve aqui**.

---

## Resposta aos dois pontos do operador

### 1. Reentrância: não existe caminho hoje, e a guarda barata existe

**Confirmado por leitura, não por suposição:**

- `buscarCaminho` tem **8 chamadores**, todos em `src/sim/`: `jobs.ts:300`,
  `:303`, `:318`, `:331`, `:346` e `systems/serfs.ts:75`, `:142`, `:181`. Todos
  são chamadas de topo. Nenhum entrega callback para a busca — **a busca não
  aceita callback nenhum**.
- Dentro de `executar`, a única chamada para fora do módulo é
  `footprintsDe(state, dados)` → `caixaDoPredio` (`src/sim/footprint.ts`), que
  importa **só tipos** (`Predio`, `GameData`). Não alcança pathfinding.
- O resto do corpo são closures locais (`andavel`, `retoDoTerreno`,
  `diagonalDoTerreno`, `heuristica`, o heap), `Math.*`, `Set` e indexação de
  vetor tipado.

**Portanto: nenhuma busca chama outra hoje.** O risco é de amanhã — alguém
acrescenta um custo de terreno que consulta algo, ou um callback de teste.

**A guarda barata:** um booleano de módulo `rascunhoEmUso`, ligado em
`ocuparRascunho()` e desligado em `liberarRascunho()` dentro de `try/finally`,
que **lança** se já estiver ligado. Custo: um teste de booleano por busca.
`throw new Error` é o idioma que `sim/` já usa para estado impossível
(`loader.ts`, `jobs.ts:123`, `obra.ts:21`).

**E ela é provável — não fica só como comentário.** Há uma costura legítima
para exercitá-la sem andaime em código de produção: `dados` é fornecido pelo
chamador e `dados.movimento.ticksPorTile.aPe` é lido **durante** a busca
(`retoDoTerreno`, e `Object.values(aPe)` no cálculo da heurística). Um teste
passa um `dados` com um *getter* em `aPe.grama` que dispara uma segunda busca:
reentrância de verdade, guarda acusando de verdade. É artificial de propósito —
prova que a guarda **acusa**, não que o jogo faz isso.

### 2. `tests/F10-astar.test.ts` não muda — e por pouco

**Esta é a decisão de desenho mais importante do plano.** O item do BUILD_PLAN
pede que `estatisticasDeBusca()` passe a expor a contagem de alocação. **Fazer
isso literalmente quebraria a F10:**

```
tests/F10-astar.test.ts:357, 365, 372, 388, 409, 424
  expect(estatisticasDeBusca()).toEqual({ execucoes: 1, acertos: 1 });
```

Seis asserções com `toEqual` sobre o objeto **inteiro**. Um campo novo as
reprova todas — e a instrução do operador é parar e reportar se a implementação
precisar tocar esse arquivo.

**Saída, sem tocar em nada da F10:** a contagem vai num **export novo**,
`estatisticasDoRascunho()`, com objeto próprio. `EstatisticasDeBusca` e
`estatisticasDeBusca()` ficam byte a byte como estão. E o conceito fica mais
honesto: execuções e acertos são sobre *busca e cache*; alocação é sobre o
*rascunho*. Coisas diferentes, funções diferentes.

`zerarEstatisticasDeBusca()` passa a zerar também o contador novo — mudança de
comportamento invisível para a F10, que chama a função no `beforeEach` e nunca
observa o contador novo. `tests/F10-falhas.test.ts:628` faz
`{ ...estatisticasDeBusca() }` num objeto de evidência; como a função não muda,
também não é afetado.

---

## Restrições globais

- **Invariante 1**: `src/sim/` sem `phaser`, `window`, `document`,
  `performance`. O lint já barra (`eslint.config.mjs`, bloco
  `files: ['src/sim/**/*.ts']`). A medição de tempo do aceite vive em `tests/`,
  **não** em `sim/` — o bloco do lint é escopado a `src/sim/**`.
- **Invariante 2**: determinismo. O rascunho é rascunho: toda célula é escrita
  antes de ser lida, garantido pela marca de geração. Nada dele entra no
  `GameState`, então F02 e F23 não o enxergam.
- **Invariante 3**: `GERACAO_MAXIMA = 0x7fffffff` **não é número de
  balanceamento** — é o limite de representação de `Int32Array`, como
  `largura * altura` é aritmética de índice. Não vai para `data/`.
- **CLAUDE.md §10**: se algo reprovar, a correção **nunca** é `skip`,
  `eslint-disable` nem ampliar `ignores`.
- Feature de `sim/` pura: **não tocar `src/render/`, `src/ui/`, `src/input/`**.

---

## Task 1 — o rascunho reaproveitado, a guarda e o contador

**Arquivos:**
- Modificar: `src/sim/pathfinding.ts`
- Criar: `tests/F17c-buffer.test.ts`

**Interfaces produzidas** (o que a Task 2 e a Task 3 consomem):
```ts
export interface EstatisticasDoRascunho {
  readonly alocacoes: number;   // quantas vezes o rascunho foi CRIADO
  readonly capacidade: number;  // em celulas (largura * altura do maior mapa ja visto)
}
export function estatisticasDoRascunho(): EstatisticasDoRascunho;
```
`EstatisticasDeBusca`, `estatisticasDeBusca` e a assinatura de `buscarCaminho`
**não mudam**.

- [ ] **Passo 1: escrever o teste que reprova**

`tests/F17c-buffer.test.ts`:

```ts
/**
 * F17c — o rascunho do A* e reaproveitado: o custo de preparar uma busca nao
 * cresce com a area do mapa.
 *
 * O GUARDA PERMANENTE desta feature e a CONTAGEM DE ALOCACAO, nao o cronometro:
 * ela e deterministica e nao depende de relogio nem de maquina. O numero medido
 * do aceite esta no teste do tempo, mais adiante no arquivo.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import {
  buscarCaminho, estatisticasDeBusca, estatisticasDoRascunho, zerarEstatisticasDeBusca,
} from '../src/sim/pathfinding';
import { inicial, tile } from './helpers/jobs-cenario';

const TAMANHOS = [64, 128, 256] as const;

/** O mesmo dado, com outro tamanho de mapa. `step` e `buscarCaminho` ja recebem
 *  `dados` por parametro — nada em `data/` muda para esta medicao. */
function dadosCom(n: number): GameData {
  return { ...gameData, terreno: { ...gameData.terreno, mapaPadrao: { largura: n, altura: n } } };
}

/** Busca curta (3 tiles) com origem INEDITA a cada volta: a chave do cache por
 *  par origem-destino nunca repete, entao toda chamada executa de verdade. */
function buscaCurtaInedita(estado: ReturnType<typeof inicialDoCenario>, dados: GameData, i: number): void {
  const x = 2 + (i % 40);
  const y = 20 + Math.floor(i / 40);
  buscarCaminho(estado, tile(x, y), [tile(x + 3, y)], 'livre', dados);
}
function inicialDoCenario(): typeof inicial { return inicial; }

describe('F17c — o rascunho do A* nao se aloca por busca', () => {
  beforeEach(() => { zerarEstatisticasDeBusca(); });

  it('900 buscas ineditas em tres tamanhos de mapa alocam no maximo uma vez por tamanho', () => {
    for (const n of TAMANHOS) {
      // `dados` hoisted de proposito: os caches de estrada e footprint sao
      // chaveados pela REFERENCIA de `dados`; criar um objeto por busca
      // recriaria esses caches e mediria outra coisa.
      const dados = dadosCom(n);
      for (let i = 0; i < 300; i += 1) buscaCurtaInedita(inicial, dados, i);
    }
    expect(estatisticasDeBusca().execucoes).toBe(900);
    expect(estatisticasDeBusca().acertos).toBe(0);
    expect(estatisticasDoRascunho().alocacoes).toBeLessThanOrEqual(TAMANHOS.length);
  });

  it('com o rascunho ja grande o bastante, mais 900 buscas nao alocam nada', () => {
    const porTamanho = TAMANHOS.map((n) => dadosCom(n));
    porTamanho.forEach((dados) => { for (let i = 0; i < 5; i += 1) buscaCurtaInedita(inicial, dados, i); });
    zerarEstatisticasDeBusca();
    porTamanho.forEach((dados) => {
      for (let i = 1000; i < 1300; i += 1) buscaCurtaInedita(inicial, dados, i);
    });
    expect(estatisticasDeBusca().execucoes).toBe(900);
    expect(estatisticasDoRascunho().alocacoes).toBe(0);
  });

  it('o rascunho cresce e nao encolhe: depois do mapa grande, o pequeno reaproveita', () => {
    const grande = dadosCom(256);
    buscaCurtaInedita(inicial, grande, 0);
    const capacidadeNoGrande = estatisticasDoRascunho().capacidade;
    expect(capacidadeNoGrande).toBeGreaterThanOrEqual(256 * 256);
    zerarEstatisticasDeBusca();
    const pequeno = dadosCom(64);
    for (let i = 0; i < 50; i += 1) buscaCurtaInedita(inicial, pequeno, i);
    expect(estatisticasDoRascunho().alocacoes).toBe(0);
    expect(estatisticasDoRascunho().capacidade).toBe(capacidadeNoGrande);
  });
});
```

> **Nota para quem executa:** o helper `inicial` de `tests/helpers/jobs-cenario.ts`
> é uma **constante** (`export const inicial = createInitialState(1)`), não uma
> função. Use-a direto; apague os dois helpers de tipo do rascunho acima
> (`inicialDoCenario`) e tipe o parâmetro como `GameState` importado de
> `../src/sim/state`. Eles estão aí só para deixar a intenção explícita.

- [ ] **Passo 2: rodar e ver reprovar**

`npx vitest run tests/F17c-buffer.test.ts`
Esperado: **erro de compilação** — `estatisticasDoRascunho` não existe.

- [ ] **Passo 3: o rascunho de módulo, a guarda e o contador**

Em `src/sim/pathfinding.ts`, logo depois de `let acertos = 0;` (linha 71):

```ts
/**
 * F17c — RASCUNHO REAPROVEITADO.
 *
 * Antes, cada busca alocava `Float64Array(largura*altura)` e
 * `Int32Array(largura*altura)` e preenchia os dois: 48 KB por chamada num mapa
 * 64x64, 768 KB num 256x256. O custo era da AREA DO MAPA, nao do caminho — uma
 * caminhada de 3 tiles custava 7,6x mais no mapa grande (medido em 2026-09-23).
 *
 * Agora os vetores vivem aqui e `marca[i] === geracaoAtual` diz se `g[i]` e
 * `pai[i]` valem para ESTA busca. Marca velha le como "nao visitado", que era o
 * papel do `+Infinity` e do `-1`. Zerar deixa de ser necessario.
 *
 * O rascunho CRESCE E NUNCA ENCOLHE: depois de um mapa grande, o pequeno
 * reaproveita o mesmo vetor (os indices sao `y * largura + x`, sempre dentro).
 */
let rascunhoCapacidade = 0;
let rascunhoG = new Float64Array(0);
let rascunhoPai = new Int32Array(0);
let rascunhoMarca = new Int32Array(0);
let geracaoAtual = 0;
let alocacoesDeRascunho = 0;
let rascunhoEmUso = false;

/** Limite de representacao de `Int32Array`, nao numero de balanceamento. */
const GERACAO_MAXIMA = 0x7fffffff;

export interface EstatisticasDoRascunho {
  readonly alocacoes: number;
  readonly capacidade: number;
}

/** F17c — quantas vezes o rascunho foi CRIADO (nao por busca: por tamanho novo).
 *  Fica separado de `estatisticasDeBusca()` de proposito: execucoes e acertos
 *  sao sobre busca e cache, isto e sobre memoria. */
export function estatisticasDoRascunho(): EstatisticasDoRascunho {
  return { alocacoes: alocacoesDeRascunho, capacidade: rascunhoCapacidade };
}

function ocuparRascunho(total: number): void {
  // O A* NAO e reentrante: as duas buscas dividiriam o mesmo rascunho e uma
  // sobrescreveria a outra em silencio. Hoje nenhum caminho do codigo faz isso
  // (a busca nao aceita callback e a unica chamada externa dela, `footprintsDe`,
  // so importa tipos); a guarda existe para o dia em que alguem tentar.
  if (rascunhoEmUso) {
    throw new Error('pathfinding.ts: busca de A* reentrante — o rascunho e unico e nao aguenta duas buscas ao mesmo tempo.');
  }
  rascunhoEmUso = true;
  if (total > rascunhoCapacidade) {
    rascunhoG = new Float64Array(total);
    rascunhoPai = new Int32Array(total);
    rascunhoMarca = new Int32Array(total);
    rascunhoCapacidade = total;
    geracaoAtual = 0; // vetor novo vem zerado: nenhuma geracao anterior vale
    alocacoesDeRascunho += 1;
  }
  if (geracaoAtual >= GERACAO_MAXIMA) {
    rascunhoMarca.fill(0);
    geracaoAtual = 0;
  }
  geracaoAtual += 1;
}

function liberarRascunho(): void {
  rascunhoEmUso = false;
}
```

E `zerarEstatisticasDeBusca()` (linha ~78) passa a zerar também o contador novo:

```ts
export function zerarEstatisticasDeBusca(): void {
  execucoes = 0;
  acertos = 0;
  alocacoesDeRascunho = 0; // F17c — contador de instrumentacao, como os outros dois
}
```

- [ ] **Passo 4: o invólucro com `try/finally`**

Renomear a função `executar` (linha 190) para `executarComRascunho` — **só o
nome**, nenhuma outra mudança nesta função neste passo — e criar o invólucro
com a mesma assinatura logo acima dela:

```ts
/** F17c — ocupa o rascunho unico e garante a devolucao em qualquer saida,
 *  inclusive excecao. Envolve a funcao INTEIRA, e nao so o laco: assim a
 *  guarda tambem cobre `footprintsDe` e a leitura de `dados`. */
function executar(
  state: Pick<GameState, 'predios'>, estrada: Uint8Array, de: TileDeGrid, alvos: readonly number[],
  modo: ModoDeBusca, dados: GameData,
): Caminho | null {
  const { largura, altura } = dados.terreno.mapaPadrao;
  ocuparRascunho(largura * altura);
  try {
    return executarComRascunho(state, estrada, de, alvos, modo, dados);
  } finally {
    liberarRascunho();
  }
}
```

`buscarCaminho` continua chamando `executar` — nenhuma mudança na linha 185.

- [ ] **Passo 5: trocar os dois vetores locais pelo rascunho**

Dentro de `executarComRascunho`, substituir as linhas 240–242:

```ts
  const total = largura * altura;
  const g = new Float64Array(total).fill(Number.POSITIVE_INFINITY);
  const pai = new Int32Array(total).fill(-1);
```

por:

```ts
  // F17c — o rascunho ja foi ocupado e a geracao ja foi virada pelo involucro.
  // `marca[i] !== geracao` e o que antes era `g[i] === +Infinity`.
  const g = rascunhoG;
  const pai = rascunhoPai;
  const marca = rascunhoMarca;
  const geracao = geracaoAtual;
  const gDe = (i: number): number => (marca[i] === geracao ? (g[i] as number) : Number.POSITIVE_INFINITY);
```

E os três pontos de leitura/escrita:

| linha | antes | depois |
|---|---|---|
| 289 | `g[inicio] = 0;` | `marca[inicio] = geracao; g[inicio] = 0;` |
| 293 | `if (gAtual !== g[idx]) continue;` | `if (gAtual !== gDe(idx)) continue;` |
| 311–313 | `if (novo < (g[vizinho] as number)) { g[vizinho] = novo; pai[vizinho] = idx;` | `if (novo < gDe(vizinho)) { marca[vizinho] = geracao; g[vizinho] = novo; pai[vizinho] = idx;` |

`pai` não precisa de inicialização: só é lido na reconstrução do caminho, e todo
nó do caminho foi marcado quando o `pai` dele foi escrito.

> **Cuidado com o lint:** `total` deixa de ser usado dentro de
> `executarComRascunho` — apagar a linha, senão `@typescript-eslint/no-unused-vars`
> reprova.

- [ ] **Passo 6: rodar o teste novo e a F10 inteira**

```
npx vitest run tests/F17c-buffer.test.ts tests/F10-astar.test.ts tests/F10-falhas.test.ts
```
Esperado: **tudo verde, e `tests/F10-astar.test.ts` sem uma linha alterada** —
é o oráculo Bellman-Ford independente (4 sementes × 40 mapas no modo livre,
× 60 redes no modo estrada, mais a equivalência com `isConnected`) provando que
o comportamento não mudou. **Se precisar editar esse arquivo, PARE e reporte.**

- [ ] **Passo 7: commit**

```bash
git add src/sim/pathfinding.ts tests/F17c-buffer.test.ts
git commit -m "feat(F17c): rascunho do A* reaproveitado com marca de geracao"
```

---

## Task 2 — a guarda acusa

**Arquivos:** modificar `tests/F17c-buffer.test.ts`.

**Consome da Task 1:** `ocuparRascunho` lançando quando `rascunhoEmUso`.

- [ ] **Passo 1: escrever o teste**

```ts
describe('F17c — o A* nao e reentrante, e a guarda diz isso em voz alta', () => {
  beforeEach(() => { zerarEstatisticasDeBusca(); });

  // Reentrancia de verdade, por uma costura que existe mesmo: `dados` vem do
  // chamador e `dados.movimento.ticksPorTile.aPe` e lido DURANTE a busca. Nenhum
  // caminho do jogo faz isto — o teste existe para provar que a guarda ACUSA, e
  // nao so que ela nao acusa a toa.
  it('uma busca disparada de dentro de outra e recusada', () => {
    const base = gameData.movimento.ticksPorTile.aPe;
    let leituras = 0;
    const aPe = {
      estrada: base.estrada,
      campoArado: base.campoArado,
      areia: base.areia,
      get grama(): number {
        leituras += 1;
        if (leituras === 1) buscarCaminho(inicial, tile(3, 3), [tile(6, 3)], 'livre');
        return base.grama;
      },
    };
    const dados: GameData = {
      ...gameData,
      movimento: { ...gameData.movimento, ticksPorTile: { ...gameData.movimento.ticksPorTile, aPe } },
    };
    expect(() => buscarCaminho(inicial, tile(10, 10), [tile(14, 10)], 'livre', dados))
      .toThrow(/reentrante/);
    expect(leituras).toBeGreaterThan(0); // a costura foi mesmo exercitada
  });

  // Se a guarda travasse o rascunho ao explodir, todo o resto da partida pararia.
  it('depois da recusa o rascunho volta a servir: a busca seguinte e normal', () => {
    const caminho = buscarCaminho(inicial, tile(10, 10), [tile(14, 10)], 'livre');
    expect(caminho).not.toBeNull();
    expect(caminho?.tiles.length).toBe(4);
  });
});
```

> **Nota:** `TerrenoTipo` é `'estrada' | 'grama' | 'campoArado' | 'areia'` — o
> objeto precisa das quatro chaves, senão o tipo reprova. Se o teste passar sem
> `leituras > 0`, a costura mudou: **não afrouxe a asserção**, investigue.

- [ ] **Passo 2: rodar**

`npx vitest run tests/F17c-buffer.test.ts` — verde.

- [ ] **Passo 3: commit**

```bash
git commit -am "feat(F17c): a guarda de reentrancia acusa, e o rascunho volta a servir"
```

---

## Task 3 — o aceite: medir os três tamanhos

**Arquivos:** modificar `tests/F17c-buffer.test.ts`.

O aceite do BUILD_PLAN: *"o custo de uma busca curta não cresce com o tamanho do
mapa. Medir a mesma caminhada de 3 tiles a 64², 128² e 256², com o cache de par
origem-destino frio, e mostrar os três números. Linha de base medida em
2026-09-23, antes da correção: 40 µs / 94 µs / 303 µs — 7,6×."*

- [ ] **Passo 1: escrever o teste de medição**

```ts
import { gravarEvidencia } from './helpers/evidence';

// Linha de base medida em 2026-09-23, ANTES desta feature, na mesma maquina:
// 40 / 94 / 303 us por busca curta — razao 7,6x entre 256x256 e 64x64.
const RAZAO_ANTES = 7.6;
// Teto FROUXO de proposito: o esperado depois da correcao e ~1,0, e microbench
// em maquina compartilhada oscila. 3,0 ainda separa "nao cresce" de 7,6x com
// folga. Se vier a oscilar, a correcao e alargar o teto COM O MOTIVO ESCRITO —
// nunca `skip`, nunca tirar o caso da verificacao (CLAUDE.md 10).
const RAZAO_MAXIMA = 3.0;
const BUSCAS = 400;

describe('F17c — aceite: a busca curta nao paga pela area do mapa', () => {
  it('mede 64x64, 128x128 e 256x256 e mostra os tres', () => {
    const medidas = TAMANHOS.map((n) => {
      const dados = dadosCom(n);
      for (let i = 0; i < 100; i += 1) buscaCurtaInedita(inicial, dados, 5000 + i); // aquece JIT e caches por tamanho
      zerarEstatisticasDeBusca();
      const t0 = performance.now();
      for (let i = 0; i < BUSCAS; i += 1) buscaCurtaInedita(inicial, dados, 10_000 + i);
      const ms = performance.now() - t0;
      expect(estatisticasDeBusca().execucoes).toBe(BUSCAS); // cache frio: mediu busca, nao acerto
      expect(estatisticasDeBusca().acertos).toBe(0);
      return { mapa: `${n}x${n}`, tiles: n * n, usPorBuscaCurta: (ms * 1000) / BUSCAS };
    });

    const menor = medidas[0]?.usPorBuscaCurta ?? 0;
    const maior = medidas[medidas.length - 1]?.usPorBuscaCurta ?? 0;
    const razao = maior / menor;
    gravarEvidencia('F17c', {
      feature: 'F17c-buffer-do-astar',
      oQueSeMede: 'a mesma caminhada de 3 tiles, cache de par origem-destino frio, em tres tamanhos de mapa',
      buscasPorTamanho: BUSCAS,
      medidas: medidas.map((m) => ({ ...m, usPorBuscaCurta: Math.round(m.usPorBuscaCurta * 10) / 10 })),
      razao256sobre64: Math.round(razao * 100) / 100,
      razaoAntesDaFeature: RAZAO_ANTES,
      tetoDoTeste: RAZAO_MAXIMA,
      alocacoesDeRascunho: estatisticasDoRascunho().alocacoes,
    });
    expect(razao).toBeLessThan(RAZAO_MAXIMA);
  });
});
```

- [ ] **Passo 2: rodar e ler a evidência**

```
npx vitest run tests/F17c-buffer.test.ts
```
Depois **abrir `test-output/F17c.json` com a ferramenta Read** — o item pede os
três números mostrados, e CLAUDE.md §7 diz que evidência não aberta não vale.

- [ ] **Passo 3: commit**

```bash
git commit -am "feat(F17c): o aceite mede os tres tamanhos e grava a evidencia"
```

---

## Task 4 — fechar

- [ ] **Passo 1: `npm run verify`** — typecheck + lint + validate:data + test.
      **Conferir o código de saída do comando inteiro**, não a última linha de
      um `tail` (armadilha que já quase deixou a F17 fechar com typecheck
      vermelho).

- [ ] **Passo 2: marcar no `test-results.json`**, dentro dos 15 minutos do selo:
      `"F17c-buffer-do-astar": { "passes": true }`, logo após
      `"F17b-material-na-obra"`.

- [ ] **Passo 3: `PROGRESS.md`** — seção `## F17c — Buffer do A* reaproveitado
      (AAAA-MM-DD)`, separando **verificado** de **hipótese**. Registrar:
      os três números medidos contra a linha de base 40/94/303; que
      `estatisticasDeBusca()` **não** mudou e por quê (as seis asserções
      `toEqual` da F10); que a guarda de reentrância é real e testada, e que
      **nenhum caminho do código a alcança hoje** — ela é para amanhã.

- [ ] **Passo 4: commit final** `feat(F17c): <resumo>`.

---

## Autorrevisão

**Cobertura do critério do BUILD_PLAN:**

| O que o item pede | Onde |
|---|---|
| Buffer reaproveitado com número de geração | Task 1, passos 3–5 |
| Só `sim/`, sem mudança de comportamento | Task 1, passo 6 (oráculo da F10) |
| Aceite: medir 64², 128², 256² e mostrar os três | Task 3 |
| Evidência `test-output/F17c.json` | Task 3, passo 1 |
| Guarda permanente = contagem de alocação, não cronômetro | Task 1, passo 1 |
| `tests/F10-astar.test.ts` não muda | resolvido pelo export novo (ver acima) |
| A* não reentrante, garantido com mais que comentário | Task 1 (guarda) + Task 2 (prova) |
| Rascunho fora do `GameState` | Task 1, passo 3 — são `let` de módulo |

**Riscos conhecidos, e o que fazer:**

1. **O teste de tempo oscilar.** Teto de 3,0 contra um esperado de ~1,0 e um
   medido-antes de 7,6. Se oscilar: alargar com o motivo escrito. Nunca `skip`.
2. **`performance.now()` em `tests/`.** Permitido — o bloco
   `no-restricted-globals` do lint é escopado a `src/sim/**`. Se por algum
   motivo reprovar, trocar por `process.hrtime.bigint()`, **não** desligar a
   regra.
3. **Orçamento de 5 s do Vitest** (ver BUG-001). 3 tamanhos × 500 buscas: ~50 ms
   depois da correção, ~200 ms antes. Folga larga.
4. **`dados` criado dentro do laço.** Recriar o objeto por busca invalidaria os
   caches de estrada e footprint, que são chaveados pela referência — mediria
   outra coisa. Está hoisted nos três testes, de propósito.
