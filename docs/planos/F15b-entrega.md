# F15b — Entrega ao armazém e calibração — plano de implementação

**Goal:** fechar o laço da economia: o que um prédio produz sai pela porta nas
costas de um serf, o que um prédio consome chega pela mesma porta, e o que ficou
parado onde ninguém mais o quer volta ao armazém — para então medir, no cenário
oráculo do GDD §4.5, se as taxas de `production.json` têm ritmo.

**Architecture:** nenhum sistema novo. Os níveis 4–7 da escada de
`data/delivery.json` entram como quatro tipos a mais na união `Tarefa`, atendidos
pelo MESMO serf, pelo MESMO claim e pela MESMA reserva dupla da F09/F13. O que
hoje está preso a "origem é armazém, destino é obra ou escola" vira tabela por
tipo de tarefa. A demanda de insumo e o excedente são a MESMA função com o sinal
trocado: `alvoDeEntrada − estoque`.

**Tech Stack:** TypeScript estrito puro em `src/sim/`, Vitest headless, o CLI
`npm run sim` (Vite `ssrLoadModule`) para a corrida longa de calibração. Zero
dependência nova. Nada de `render/` nem de `ui/` (decisão D4 do operador, já
escrita na fila).

**Spec:** `BUILD_PLAN.md`, item **F15b — Produção: entrega ao armazém e
calibração** (escopo, aceite, evidência e sete notas). O GDD §4.5 (proporções de
referência) e §6.2 (`saida_cheia` é sinal de gargalo) são o oráculo.
`docs/planos/F15-producao.md` §6 é o esboço que este plano substitui.

## Global Constraints

Copiadas do CLAUDE.md. Valem para toda tarefa abaixo, sem repetição.

- `src/sim/` não importa `phaser` e não toca `window`, `document`, `canvas` ou
  `performance`.
- Determinismo: tick fixo, nada de `Math.random()` nem `Date.now()` em `sim/`.
- Nenhum número de balanceamento digitado em `.ts`. Nível da escada só por `id`
  (`nivelDoTipo`), capacidade e taxa só de `data/*.json`.
- `GameState` serializável: sem função, sem classe, sem `Map`, `null` nunca
  `undefined`.
- Toda tarefa reclamada tem caminho de volta: todo ramo de erro chama `liberar`.
- Proibido desativar, ignorar ou excluir código da verificação para fazer o
  `npm run verify` passar. Sem `skip`, sem `eslint-disable`, sem alargar
  `ignores`.
- Uma feature por sessão. Commit `feat(F15b): <resumo>`.
- `test-results.json` só depois de `npm run verify` verde (selo de 15 min).

---

## 0. Os quatro pontos do operador

### Ponto 1 — níveis 6 e 7

Ambos entram. O nível 7 (`excedente-para-armazem`) fecha, como decidido na F15a,
a janela do ouro parado na gaveta `entrada` da Schoolhouse: cancelada a fila, a
demanda vira 0, o ouro vira excedente e uma tarefa de nível 7 o traz de volta ao
armazém — onde o HUD o enxerga. **Uma regra só, na origem; a tela não muda.**

### Ponto 2 — o cenário oráculo, e o achado que muda o tamanho da feature

**O cenário do ponto 2 não roda com os níveis 6 e 7 sozinhos.** Este é o achado
central desta sessão e está detalhado na §1. Em uma linha: a Sawmill consome
`tree_trunk` da gaveta `entrada`, e **nada** enche a gaveta `entrada` de um
produtor a não ser os níveis **4** e **5**. Sem eles a Sawmill fica em
`esperando_insumo` para sempre e "tempo até o primeiro timber chegar ao armazém"
não tem resposta — é `Infinity`, não um número a calibrar.

Recomendação: **alargar a F15b para os níveis 4–7** e quebrá-la em dois
sub-itens na fila. A §1 traz a alternativa, caso o operador prefira não alargar.

Os números do ponto 2 (fila acumulando, prédio ocioso, ticks até o primeiro
timber no armazém) saem da **Tarefa 8**, medidos pelo `npm run sim`, e vão para
o operador **antes de qualquer ajuste de taxa**. Nenhuma taxa muda nesta sessão
sem ordem dele — `production.json` sai desta feature byte a byte igual, exceto
`rendimento` se ele mandar.

### Ponto 3 — quanto dura o veio de 200

A resposta honesta hoje: **não sei, e a aritmética mente.** A conta fácil (200
unidades × 167 ticks = 33 400 ticks = 55,7 min) pressupõe a pedreira trabalhando
sem parar um tick sequer. No cenário real ela para: a gaveta `saida` tem teto 5,
e assim que enche o pedreiro vai a `saida_cheia` e o relógio congela até um serf
levar uma pedra embora (verificado na F15a: no tick 1116 a gaveta encheu e o
progresso ficou parado em 167 até o fim da corrida). O tempo real do veio é
33 400 ticks **mais** a soma de todas as esperas por serf, e essa soma depende da
distância da estrada, do número de serfs e da disputa com as outras tarefas.

Por isso a medição é uma corrida de verdade (Tarefa 8), com o veio **reduzido por
dado injetado** para caber em tempo de teste, e a extrapolação declarada como o
que é: regra de três sobre um tempo médio por unidade medido, não fato. Se o
operador quiser o número exato do veio de 200, é uma corrida de ~40 000 ticks no
CLI — roda, mas fora da suíte (a suíte inteira hoje leva segundos; 40 000 ticks
não entram nela).

### Ponto 4 — BUG-001

**Cabe.** O conserto é local, no único lugar que conclui uma obra
(`passoMartelando`, `src/sim/systems/laborers.ts`): quando a obra vira
`completo`, cancelar as tarefas `construir` IRMÃS daquele destino, não só a do
laborer que martelou a última. Fica na Tarefa 9, com commit próprio, de modo que
o operador possa recusá-la sozinha sem desfazer a feature.

---

## 1. O achado de escopo: os níveis 4 e 5

### O que o código diz

- `src/sim/producao.ts` (F15a): um produtor com `entra` na receita só avança o
  relógio se a gaveta `entrada` tiver o insumo. Sem ele, `fsm = 'esperando_insumo'`
  e `progresso` congelado — verificado na F15a, `test-output/F15a.json`,
  `cenariosControlados.serrariaSemTronco`: 300 ticks, progresso 0.
- `data/production.json`: `sawmill.entra = { tree_trunk: 1.1 }`.
- `src/sim/systems/serfs.ts`, `passoEntregando`: a carga só sabe entrar em dois
  lugares — `faltam` de uma obra (nível 3) e a gaveta `entrada` de uma escola
  (nível 2). **Nenhum caminho leva `tree_trunk` para dentro de uma Sawmill.**
- `data/delivery.json`: os únicos níveis que descrevem "insumo → produtor" são o
  **4** (`insumo-producao-parada`) e o **5** (`insumo-producao-baixa`).

### Por que não dá para empurrar para depois

O aceite da **F17 — aceite da Fase A** (o último item da fila) exige, no mesmo
cenário, "estoque de timber maior que o inicial" com 2 Woodcutter's e 1 Sawmill.
Entre a F15b e a F17 está a **F16** (painel de seleção e demolição —
`render/`/`ui/`) e nada mais. **Nenhuma feature da fila é dona dos níveis 4 e 5.**
Deixá-los de fora significa que a F17 os implementa por baixo do pano, ou que o
aceite da Fase A não fecha.

E há a regra que já custou uma sessão antes: *espera indefinida não é
balanceamento*. Entregar uma Sawmill que fica em `esperando_insumo` para sempre
não é um número a calibrar, é um travamento de regra.

### As duas saídas

**(A) Alargar para 4–7 — recomendado.** A F15b passa a ser a escada inteira do
produtor. É trabalho de um sistema só (o mesmo gerador, a mesma reserva, a mesma
FSM de serf) e o custo marginal dos níveis 4/5 sobre o 6/7 é pequeno: uma função
de alvo, dois tipos na união, um ramo em `passoEntregando`. Por CLAUDE.md §6 isso
vira **dois sub-itens no BUILD_PLAN**, e esta sessão entrega o primeiro:

- **F15b-1 — a escada do produtor (níveis 4, 5, 6 e 7).** Tarefas 1–7 e 9.
  Aceite: cada nível dispara, reserva, entrega e cancela; a Sawmill alimentada
  por serf produz timber; o ouro cancelado volta da escola ao armazém.
- **F15b-2 — o cenário longo e a calibração.** Tarefa 8. Aceite: o dos 3000
  ticks já escrito na fila, mais os números do ponto 2 e a duração medida do
  veio. É este que vira `"passes": true` em `F15b-producao-entrega`.

**(B) Manter 6 e 7 só.** Entrega metade do laço. O relatório do ponto 2 vira: "a
Quarry enche o armazém de stone; a Sawmill nunca produziu porque nada entrega
tronco a ela; tempo até o primeiro timber: não ocorreu". É um resultado honesto e
publicável, mas não é o oráculo do GDD §4.5, e joga os níveis 4/5 para dentro da
F17.

**Isto é decisão do operador** — alargar escopo por conta própria é o
anti-padrão da §10, e a nota de exceção precisa estar escrita na fila ANTES do
código (Tarefa 0). O plano abaixo está escrito para a saída (A); se for (B),
apagam-se a Tarefa 2 no que toca aos níveis 4/5, o ramo de insumo da Tarefa 4, o
ramo da gaveta `entrada` de destino na Tarefa 5, e a Tarefa 8 vira o relatório
reduzido.

---

## 2. Decisões de arquitetura

**D1 — `alvoDeEntrada`: uma função, dois sinais.** Quanto um prédio *quer* na
gaveta `entrada` de uma mercadoria. Produtor: a capacidade `entrada` repartida na
proporção da receita (`entra`), que é o único jeito de não inventar um número
novo — a Sawmill, com `entra = { tree_trunk: 1 }` e capacidade 5, quer 5; um
prédio de duas entradas em razão 1:1 quer 2 e 2 (a sobra da divisão vai para a
mercadoria de maior `entra`, desempate por nome, para ser determinístico).
Escola: `ouroNecessario`. Demanda de insumo (níveis 4/5) = `alvo − estoque`.
Excedente (nível 7) = `estoque − alvo`. A mesma conta, o sinal trocado.

**D2 — o nível 4 e o nível 5 são o MESMO pedido, com urgência diferente.** 4 =
o prédio está parado agora (precisa de `m` e `estoque[m] === 0`); 5 = tem algum,
mas abaixo do alvo. O tipo é **fotografado na criação** da tarefa e nunca muda
para tarefa `reclamada` ou `carregando` — tirar a carga da mão de um serf porque
a urgência mudou é como se perde entrega. Só tarefa **aberta** é re-tipada, e de
graça: `abertaVale` devolve `false`, `sanearTarefas` a cancela e `gerarTarefas`
cria a irmã com o tipo certo no MESMO tick.

**D3 — nível 6 dispara com `saida > 0`, não com a gaveta cheia.** Já escrito na
fila como nota do operador; o GDD §6.2 trata `saida_cheia` como sinal de
gargalo, não como regime normal. O nome do nível no dado
(`saida-cheia-para-armazem`) descreve o *sintoma que ele evita*, não a condição
de disparo.

**D4 — gaveta de origem por tipo.** Níveis 1–6 tiram da gaveta `saida`; o nível
7 tira da `entrada` (é lá que o excedente fica preso: ouro na escola, insumo que
sobrou). Vira tabela `GAVETA_DE_ORIGEM_POR_TIPO`, irmã da tabela de elegibilidade
já existente, com `Record` exaustivo — tipo novo sem entrada não compila.

**D5 — armazém como destino não tem teto.** A capacidade do armazém é ilimitada
no dado. `demandaNoDestino` devolve `Number.POSITIVE_INFINITY` para os níveis
6/7. Isso não afrouxa nada: o teto real dessas tarefas é a **origem** — só existe
tarefa para o que está lá, e `disponivelNaOrigem` desconta o reservado.
`sanearTarefas` continua cancelando pela origem, e o passo que hoje limita
tarefas abertas por `demandaNoDestino` passa a limitar pelo disponível na origem
quando a demanda é infinita.

**D6 — o `X` do aceite.** Interpretação conservadora enquanto o operador não
decidir (CLAUDE.md §14): `X = dados.entrega.ticksAlertaTarefaSemCandidato`
(30 s → 300 ticks, número do dado, não digitado), e **"trabalhador" =
especialista com prédio**. Serf e laborer passam por `ocioso` legitimamente entre
tarefas; um especialista ocioso por 300 ticks é a economia travada. Vai como
pergunta na §6.

**D7 — calibrar é medir, não estimar.** Toda taxa fica como está nesta feature.
A Tarefa 8 produz números; o ajuste, se houver, é em lote no `BALANCE_LOG.md`
(CLAUDE.md §12 — ajustar o milho quebra o pão).

**D8 — a invariante de destino precisa ACUSAR.** `tests/helpers/jobs-invariantes.ts`
tem um `switch` por tipo de tarefa dizendo que forma o destino deve ter. Ganha os
quatro tipos novos, e ganha um teste que **constrói um estado violado de
propósito** e exige que o helper reclame. Um guarda que nunca acusou não é guarda.

**D9 — nada em `render/` nem `ui/`.** Já decidido pelo operador na nota D4 da
fila: sem nota de feature de integração, o vazamento se conserta na origem.

---

## 3. Mapa de arquivos

| Arquivo | O quê |
|---|---|
| `BUILD_PLAN.md` | **modificar** — o corte em F15b-1/F15b-2 e a nota de escopo (Tarefa 0) |
| `src/sim/insumo.ts` | **criar** — `alvoDeEntrada`, `demandaDeInsumo`, `excedenteNaEntrada`, `produtorParado`. Puro, só lê estado e dado |
| `src/sim/state.ts` | **modificar** — quatro interfaces de tarefa novas, entram em `TarefaDeTransporte`; a tabela de gavetas (ver ciclo na Tarefa 3) |
| `src/sim/jobs.ts` | **modificar** — `criarTarefaDeInsumo`, `criarTarefaParaArmazem`, `gavetaDeOrigem`, elegibilidade |
| `src/sim/reservas.ts` | **modificar** — `disponivelNaOrigem`/`reservadoNaOrigem` cientes da gaveta; `demandaNoDestino` com os seis ramos |
| `src/sim/systems/jobs.ts` | **modificar** — geradores dos níveis 4/5/6/7; `motivoIndividual`, `abertaVale`, `origemMaisPerto` e o passo 4 de `sanearTarefas` generalizados |
| `src/sim/systems/serfs.ts` | **modificar** — coleta da gaveta certa; entrega no destino certo |
| `src/sim/systems/laborers.ts` | **modificar** — BUG-001 (Tarefa 9) |
| `tests/helpers/jobs-invariantes.ts` | **modificar** — `switch` exaustivo com os tipos novos (D8) |
| `tests/F15b-entrega.test.ts` | **criar** — os testes de unidade e os cenários por nível |
| `tests/F15b-aceite.test.ts` | **criar** — o cenário de 3000 ticks, grava `test-output/F15.json` |
| `tools/sim.js` | **modificar** — cenário `oraculo` (2 Woodcutter's + 1 Sawmill + Quarry) |
| `BALANCE_LOG.md` | **modificar** — os números medidos (Tarefa 8) |
| `BUGS.md` | **modificar** — BUG-001 sai no commit que o corrige (Tarefa 9) |
| `PROGRESS.md` | **modificar** — fecho da sessão |

---

## 4. Tarefas

### Tarefa 0 — o corte na fila, antes de qualquer código

**Files:** Modify: `BUILD_PLAN.md` (item F15b)

Sem código e sem teste: é a autorização de escopo virando texto. Um agente futuro
lendo só o BUILD_PLAN precisa entender por que a F15b tem quatro níveis e não
dois.

- [ ] **Step 1: quebrar o item F15b em F15b-1 e F15b-2**, preservando o texto do
      aceite atual dentro de F15b-2 e todas as sete notas existentes (nenhuma
      nota do operador se perde no corte).

- [ ] **Step 2: escrever a nota de escopo em F15b-1**, com este teor:

```markdown
- **Nota (alargamento de escopo, decisão do operador em <data>)**: o escopo
  original dizia níveis **6 e 7**. Os níveis **4** (`insumo-producao-parada`) e
  **5** (`insumo-producao-baixa`) entram junto porque **nada mais na fila é dono
  deles** e sem eles a Sawmill nunca recebe `tree_trunk`: fica em
  `esperando_insumo` para sempre (F15a, `test-output/F15a.json`,
  `cenariosControlados.serrariaSemTronco`). O cenário oráculo do GDD §4.5
  (2 Woodcutter's : 1 Sawmill) e o aceite da **F17** ("estoque de timber maior
  que o inicial") dependem dos quatro níveis, não de dois.
```

- [ ] **Step 3: registrar em F15b-2 que é ele quem vira `"passes": true`** em
      `test-results.json`, e que `test-output/F15.json` é a evidência combinada.

- [ ] **Step 4: Commit**

```bash
git add BUILD_PLAN.md
git commit -m "docs(F15b): o corte da fila em F15b-1 e F15b-2 e a nota de escopo"
```

---

### Tarefa 1 — `sim/insumo.ts`: o alvo, a demanda e o excedente

**Files:**
- Create: `src/sim/insumo.ts`
- Test: `tests/F15b-entrega.test.ts`

**Interfaces:**
- Consumes: `GameState` (`state.ts`); `GameData` (`data/types.ts`);
  `ouroNecessario` (`escola.ts`); `MERCADORIA_DE_OURO` (`state.ts`).
- Produces:
  - `alvoDeEntrada(state, predioId, mercadoria, dados?): number`
  - `demandaDeInsumo(state, predioId, mercadoria, dados?): number`
  - `excedenteNaEntrada(state, predioId, mercadoria, dados?): number`
  - `produtorParado(state, predioId, mercadoria, dados?): boolean`

- [ ] **Step 1: escrever o teste que falha**

```ts
// tests/F15b-entrega.test.ts
import { describe, expect, it } from 'vitest';
import { alvoDeEntrada, demandaDeInsumo, excedenteNaEntrada, produtorParado } from '../src/sim/insumo';
import { gameData } from '../src/sim/data';

describe('F15b — alvo da gaveta de entrada', () => {
  it('produtor de uma entrada so quer a gaveta inteira', () => {
    const state = comPredioCompleto('sawmill', { entrada: {}, saida: {} });
    expect(alvoDeEntrada(state, 'p5', 'tree_trunk'))
      .toBe(gameData.producao.estoqueInterno.entrada);
  });

  it('mercadoria que a receita nao pede tem alvo zero', () => {
    const state = comPredioCompleto('sawmill', { entrada: {}, saida: {} });
    expect(alvoDeEntrada(state, 'p5', 'stone')).toBe(0);
  });

  it('escola: o alvo e a demanda da fila, nao a capacidade', () => {
    const state = comEscolaNaFila(2);
    expect(alvoDeEntrada(state, 'p2', MERCADORIA_DE_OURO))
      .toBe(ouroNecessario(state, 'p2'));
  });

  it('demanda de insumo desconta o que ja esta na gaveta', () => {
    const state = comPredioCompleto('sawmill', { entrada: { tree_trunk: 2 }, saida: {} });
    expect(demandaDeInsumo(state, 'p5', 'tree_trunk'))
      .toBe(gameData.producao.estoqueInterno.entrada - 2);
  });

  it('excedente e a mesma conta com o sinal trocado, nunca negativo', () => {
    const parado = comEscolaComOuroEFilaVazia(1);
    expect(excedenteNaEntrada(parado, 'p2', MERCADORIA_DE_OURO)).toBe(1);
    const normal = comPredioCompleto('sawmill', { entrada: { tree_trunk: 2 }, saida: {} });
    expect(excedenteNaEntrada(normal, 'p5', 'tree_trunk')).toBe(0);
  });

  it('demanda e excedente nunca sao positivos ao mesmo tempo', () => {
    for (const q of [0, 1, 3, 5, 9]) {
      const s = comPredioCompleto('sawmill', { entrada: { tree_trunk: q }, saida: {} });
      const d = demandaDeInsumo(s, 'p5', 'tree_trunk');
      const e = excedenteNaEntrada(s, 'p5', 'tree_trunk');
      expect(Math.min(d, e)).toBe(0);
    }
  });

  it('parada (nivel 4) e ter zero do que a receita pede', () => {
    expect(produtorParado(comPredioCompleto('sawmill', { entrada: {}, saida: {} }), 'p5', 'tree_trunk')).toBe(true);
    expect(produtorParado(comPredioCompleto('sawmill', { entrada: { tree_trunk: 1 }, saida: {} }), 'p5', 'tree_trunk')).toBe(false);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F15b-entrega.test.ts`
Expected: FAIL — `Cannot find module '../src/sim/insumo'`

- [ ] **Step 3: implementar**

```ts
// src/sim/insumo.ts
/**
 * F15b — quanto um predio QUER na gaveta `entrada`, e o que sobra dela.
 *
 * Uma funcao so para os dois lados da escada: a demanda de insumo (niveis 4 e 5)
 * e `alvo - estoque`, e o excedente (nivel 7) e `estoque - alvo`. Escrever as
 * duas contas separadas seria a garantia de que um dia elas discordam e uma
 * mercadoria fica indo e voltando entre o armazem e o predio.
 *
 * Nenhum numero aqui: a capacidade vem de `production.json`
 * (`estoqueInternoPorPredio.entrada`) e a proporcao, da receita ja derivada no
 * carregamento. Este modulo depende so de tipos do estado e de `escola.ts` — nao
 * de `estradas`/`pathfinding`, para nao criar ciclo com `jobs.ts`.
 */
import type { GameState } from './state';
import { MERCADORIA_DE_OURO } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { ouroNecessario } from './escola';

/**
 * A capacidade da gaveta `entrada` repartida na proporcao da receita. Com uma
 * entrada so, e a gaveta inteira. Com duas, e proporcional a `entra` — e a sobra
 * da divisao vai para a de maior `entra`, desempate por nome da mercadoria para
 * nao depender da ordem das chaves (determinismo).
 */
function alvoDoProdutor(
  entra: Readonly<Record<string, number>>, capacidade: number, mercadoria: string,
): number {
  const chaves = Object.keys(entra);
  const total = chaves.reduce((a, m) => a + (entra[m] ?? 0), 0);
  if (total === 0 || !(mercadoria in entra)) return 0;
  const parte = (m: string): number => Math.floor(((entra[m] ?? 0) * capacidade) / total);
  const sobra = capacidade - chaves.reduce((s, m) => s + parte(m), 0);
  const principal = [...chaves].sort(
    (a, b) => (entra[b] ?? 0) - (entra[a] ?? 0) || a.localeCompare(b),
  )[0];
  return parte(mercadoria) + (mercadoria === principal ? sobra : 0);
}

export function alvoDeEntrada(
  state: GameState, predioId: string, mercadoria: string, dados: GameData = gameData,
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  const receita = dados.producao.receitas[predio.tipo];
  if (receita) return alvoDoProdutor(receita.entra, dados.producao.estoqueInterno.entrada, mercadoria);
  if (mercadoria === MERCADORIA_DE_OURO) return ouroNecessario(state, predioId, dados);
  return 0;
}

/** Niveis 4 e 5: o que ainda falta chegar. Nunca negativo. */
export function demandaDeInsumo(
  state: GameState, predioId: string, mercadoria: string, dados: GameData = gameData,
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  return Math.max(
    0,
    alvoDeEntrada(state, predioId, mercadoria, dados) - (predio.estoque.entrada[mercadoria] ?? 0),
  );
}

/** Nivel 7: o que esta na gaveta alem do alvo. Nunca negativo. */
export function excedenteNaEntrada(
  state: GameState, predioId: string, mercadoria: string, dados: GameData = gameData,
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  return Math.max(
    0,
    (predio.estoque.entrada[mercadoria] ?? 0) - alvoDeEntrada(state, predioId, mercadoria, dados),
  );
}

/** Nivel 4 (parada) contra nivel 5 (baixa): o predio precisa de `mercadoria` e
 *  nao tem NENHUMA. E o unico criterio — "parada" e falta, nao lentidao. */
export function produtorParado(
  state: GameState, predioId: string, mercadoria: string, dados: GameData = gameData,
): boolean {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return false;
  const receita = dados.producao.receitas[predio.tipo];
  if (!receita || !(mercadoria in receita.entra)) return false;
  return (predio.estoque.entrada[mercadoria] ?? 0) === 0;
}
```

**Nome do campo de capacidade:** o exemplo acima usa
`dados.producao.estoqueInterno.entrada`. Se o tipo derivado do carregamento
(`src/sim/data/types.ts`) expuser esse campo com outro nome, **use o nome que já
existe** — não crie um segundo nome para a mesma coisa, e não leia
`estoqueInternoPorPredio` cru do JSON. `src/sim/producao.ts` (F15a) já lê essa
capacidade: copie de lá.

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run tests/F15b-entrega.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sim/insumo.ts tests/F15b-entrega.test.ts
git commit -m "feat(F15b): sim/insumo.ts — o alvo da gaveta de entrada e os dois sinais"
```

---

### Tarefa 2 — os quatro tipos de tarefa e a tabela de gavetas

**Files:**
- Modify: `src/sim/state.ts` (união `Tarefa`, `TarefaDeTransporte`)
- Modify: `src/sim/jobs.ts` (`criarTarefaDeInsumo`, `criarTarefaParaArmazem`,
  `gavetaDeOrigem`, elegibilidade)
- Modify: `tests/helpers/jobs-invariantes.ts` (D8)
- Test: `tests/F15b-entrega.test.ts`

**Interfaces:**
- Consumes: `TarefaDeCarga`, `inserirTarefa` (privada de `jobs.ts`),
  `nivelDoTipo`, `ehTarefaDeTransporte`.
- Produces: os tipos `'insumo-producao-parada'`, `'insumo-producao-baixa'`,
  `'saida-cheia-para-armazem'`, `'excedente-para-armazem'`;
  `criarTarefaDeInsumo(state, { mercadoria, origem, destino, parada })`,
  `criarTarefaParaArmazem(state, { mercadoria, origem, destino, excedente })`,
  `gavetaDeOrigem(tipo): 'entrada' | 'saida'`.

- [ ] **Step 1: escrever o teste que falha**

```ts
describe('F15b — os quatro tipos entram na escada', () => {
  it('cada tipo novo tem nivel em delivery.json, na ordem certa', () => {
    expect(nivelDoTipo('insumo-producao-parada')).toBe(4);
    expect(nivelDoTipo('insumo-producao-baixa')).toBe(5);
    expect(nivelDoTipo('saida-cheia-para-armazem')).toBe(6);
    expect(nivelDoTipo('excedente-para-armazem')).toBe(7);
    expect(nivelDoTipo('insumo-producao-parada'))
      .toBeLessThan(nivelDoTipo('insumo-producao-baixa'));
    expect(nivelDoTipo('material-para-obra'))
      .toBeLessThan(nivelDoTipo('insumo-producao-parada'));
  });

  it('os quatro sao tarefas de TRANSPORTE pela forma', () => {
    const { state, id } = criarTarefaParaArmazem(base, {
      mercadoria: MERCADORIA_DE_OURO, origem: 'p2', destino: ID_DO_ARMAZEM, excedente: true,
    });
    expect(ehTarefaDeTransporte(state.jobs.tarefas.porId[id]!)).toBe(true);
  });

  it('a flag escolhe o tipo, e o tipo fica fotografado', () => {
    const parada = criarTarefaDeInsumo(base, { mercadoria: 'tree_trunk', origem: ID_DO_ARMAZEM, destino: 'p5', parada: true });
    expect(parada.state.jobs.tarefas.porId[parada.id]!.tipo).toBe('insumo-producao-parada');
    const baixa = criarTarefaDeInsumo(base, { mercadoria: 'tree_trunk', origem: ID_DO_ARMAZEM, destino: 'p5', parada: false });
    expect(baixa.state.jobs.tarefas.porId[baixa.id]!.tipo).toBe('insumo-producao-baixa');
  });

  it('a gaveta de origem e `saida` para 1-6 e `entrada` so para o nivel 7', () => {
    expect(gavetaDeOrigem('material-para-obra')).toBe('saida');
    expect(gavetaDeOrigem('ouro-para-escola')).toBe('saida');
    expect(gavetaDeOrigem('insumo-producao-parada')).toBe('saida');
    expect(gavetaDeOrigem('insumo-producao-baixa')).toBe('saida');
    expect(gavetaDeOrigem('saida-cheia-para-armazem')).toBe('saida');
    expect(gavetaDeOrigem('excedente-para-armazem')).toBe('entrada');
  });

  it('so o serf e elegivel para os quatro', () => {
    for (const t of ['insumo-producao-parada', 'insumo-producao-baixa',
                     'saida-cheia-para-armazem', 'excedente-para-armazem'] as const) {
      expect(elegivelParaTarefa(t, TIPO_QUE_CARREGA)).toBe(true);
      expect(elegivelParaTarefa(t, TIPO_QUE_CONSTROI)).toBe(false);
    }
  });
});

describe('F15b — o helper de invariantes ACUSA (D8)', () => {
  it('reclama de tarefa de nivel 6 cujo destino nao e armazem', () => {
    const torto = comTarefaCrua(base, {
      id: 't99', numero: 99, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
      origem: 'p9', destino: 'p9', estado: 'aberta', reclamadaPor: null,
    });
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('reclama de tarefa de nivel 4 cujo destino nao produz nada', () => {
    const torto = comTarefaCrua(base, {
      id: 't98', numero: 98, tipo: 'insumo-producao-parada', mercadoria: 'tree_trunk',
      origem: ID_DO_ARMAZEM, destino: ID_DO_ARMAZEM, estado: 'aberta', reclamadaPor: null,
    });
    expect(violacoesDeInvariantes(torto)).not.toEqual([]);
  });

  it('nao reclama do estado certo', () => {
    const certo = comTarefaCrua(comPedreiraComEstoque(1), {
      id: 't97', numero: 97, tipo: 'saida-cheia-para-armazem', mercadoria: 'stone',
      origem: 'p9', destino: ID_DO_ARMAZEM, estado: 'aberta', reclamadaPor: null,
    });
    expect(violacoesDeInvariantes(certo)).toEqual([]);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F15b-entrega.test.ts -t 'escada'`
Expected: FAIL — os tipos não existem na união; `nivelDoTipo` nem é chamado
porque o TypeScript recusa a string.

- [ ] **Step 3: implementar**

```ts
// src/sim/state.ts — depois de TarefaOuroParaEscola

/**
 * F15b — niveis 4 e 5 da escada: uma unidade de insumo do armazem ate a gaveta
 * `entrada` de um produtor. Dois tipos e nao um com flag porque o NIVEL e a
 * unica diferenca, e nivel mora no tipo (`nivelDoTipo`, `delivery.json`).
 *
 * O tipo e fotografado na criacao e nunca muda depois de reclamada: a urgencia
 * pode mudar debaixo de um serf que ja esta com o tronco na mao, e trocar o tipo
 * ali seria trocar a tarefa por outra sem devolver reserva. Tarefa ABERTA que
 * perdeu a urgencia e cancelada por `abertaVale` e recriada no mesmo tick.
 */
export interface TarefaInsumoProducaoParada extends TarefaDeCarga {
  readonly tipo: 'insumo-producao-parada';
}
export interface TarefaInsumoProducaoBaixa extends TarefaDeCarga {
  readonly tipo: 'insumo-producao-baixa';
}

/**
 * F15b — nivel 6: a gaveta `saida` de um produtor ate o armazem. Dispara com
 * estoque > 0, NAO com a gaveta cheia (BUILD_PLAN F15b/D3): esperar encher faria
 * de `saida_cheia` o regime permanente, e o GDD §6.2 a descreve como gargalo.
 * E o primeiro tipo em que a ORIGEM nao e armazem.
 */
export interface TarefaSaidaCheiaParaArmazem extends TarefaDeCarga {
  readonly tipo: 'saida-cheia-para-armazem';
}

/**
 * F15b — nivel 7: mercadoria parada na gaveta `entrada` de um predio que nao a
 * pede mais, de volta ao armazem. E o que fecha o ouro preso na escola depois de
 * a fila ser cancelada (BUILD_PLAN F15b, nota D4 do operador): o conserto e na
 * origem, e o HUD continua com uma regra so. Unico tipo cuja origem e a gaveta
 * `entrada`.
 */
export interface TarefaExcedenteParaArmazem extends TarefaDeCarga {
  readonly tipo: 'excedente-para-armazem';
}

export type TarefaDeTransporte =
  | TarefaMaterialParaObra
  | TarefaOuroParaEscola
  | TarefaInsumoProducaoParada
  | TarefaInsumoProducaoBaixa
  | TarefaSaidaCheiaParaArmazem
  | TarefaExcedenteParaArmazem;

/** O tipo de uma tarefa que CARREGA. Derivado da uniao, nunca escrito a mao. */
export type TipoDeTransporte = TarefaDeTransporte['tipo'];

/**
 * De que gaveta do predio de ORIGEM a carga sai. Exaustivo por construcao: um
 * tipo novo sem linha aqui nao compila, e o autor e obrigado a decidir em vez de
 * herdar `saida` por omissao. Mora em `state.ts` e nao em `jobs.ts` porque
 * `reservas.ts` precisa dela e nao importa `jobs.ts` (evitar o ciclo).
 */
export const GAVETA_DE_ORIGEM_POR_TIPO: Readonly<Record<TipoDeTransporte, 'entrada' | 'saida'>> = {
  'material-para-obra': 'saida',
  'ouro-para-escola': 'saida',
  'insumo-producao-parada': 'saida',
  'insumo-producao-baixa': 'saida',
  'saida-cheia-para-armazem': 'saida',
  'excedente-para-armazem': 'entrada',
};

export function gavetaDeOrigem(tipo: TipoDeTransporte): 'entrada' | 'saida' {
  return GAVETA_DE_ORIGEM_POR_TIPO[tipo];
}
```

```ts
// src/sim/jobs.ts — irmas de criarTarefa/criarTarefaDeOuro

/** F15b — niveis 4 e 5: uma unidade de insumo do armazem `origem` ate o produtor
 *  `destino`. `parada` escolhe o NIVEL, e o nivel mora no tipo. */
export function criarTarefaDeInsumo(
  state: GameState,
  campos: {
    readonly mercadoria: string; readonly origem: string;
    readonly destino: string; readonly parada: boolean;
  },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaInsumoProducaoParada | TarefaInsumoProducaoBaixa = {
    id: `t${numero}`, numero,
    tipo: campos.parada ? 'insumo-producao-parada' : 'insumo-producao-baixa',
    mercadoria: campos.mercadoria, origem: campos.origem, destino: campos.destino,
    estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F15b — niveis 6 e 7: uma unidade do predio `origem` de volta ao armazem.
 *  `excedente` escolhe o nivel E a gaveta de onde a carga sai (D4). */
export function criarTarefaParaArmazem(
  state: GameState,
  campos: {
    readonly mercadoria: string; readonly origem: string;
    readonly destino: string; readonly excedente: boolean;
  },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaSaidaCheiaParaArmazem | TarefaExcedenteParaArmazem = {
    id: `t${numero}`, numero,
    tipo: campos.excedente ? 'excedente-para-armazem' : 'saida-cheia-para-armazem',
    mercadoria: campos.mercadoria, origem: campos.origem, destino: campos.destino,
    estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}
```

E a tabela de elegibilidade (`UNIDADE_ELEGIVEL_POR_TIPO` ou equivalente em
`jobs.ts`) ganha os quatro tipos apontando para `TIPO_QUE_CARREGA` — o compilador
vai exigir, porque o `Record` é exaustivo sobre `TipoDeTarefa`.

Em `tests/helpers/jobs-invariantes.ts`, o `switch` de destino ganha:
`'insumo-producao-parada'` e `'insumo-producao-baixa'` exigem destino `completo`
com receita que tem a mercadoria em `entra`; `'saida-cheia-para-armazem'` e
`'excedente-para-armazem'` exigem destino armazém completo **e** origem prédio
completo que não seja armazém.

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run tests/F15b-entrega.test.ts`
Expected: PASS, inclusive os dois testes que exigem que o helper ACUSE.

- [ ] **Step 5: Commit**

```bash
git add src/sim/state.ts src/sim/jobs.ts tests/
git commit -m "feat(F15b): os quatro tipos da escada e a gaveta de origem por tipo"
```

---

### Tarefa 3 — as reservas cientes da gaveta

**Files:**
- Modify: `src/sim/reservas.ts`
- Test: `tests/F15b-entrega.test.ts`

**Interfaces:**
- Consumes: `gavetaDeOrigem`, `GAVETA_DE_ORIGEM_POR_TIPO` (Tarefa 2, em
  `state.ts` — `reservas.ts` **não** pode importar `jobs.ts`, que importa
  `estradas`/`pathfinding` e criaria ciclo); `demandaDeInsumo` (Tarefa 1).
- Produces:
  - `reservadoNaOrigem(state, predioId, mercadoria, gaveta?): number`
  - `disponivelNaOrigem(state, predioId, mercadoria, gaveta?): number`
  - `demandaNoDestino(state, tarefa, dados?): number` com os seis ramos.

O parâmetro `gaveta` entra com padrão `'saida'` para que nenhuma das chamadas
existentes (F08, F09, F10, F13) mude de comportamento.

- [ ] **Step 1: escrever o teste que falha**

```ts
describe('F15b — reserva por gaveta', () => {
  it('reserva na origem conta so a MESMA gaveta', () => {
    // uma tarefa de nivel 6 (gaveta saida) e uma de nivel 7 (gaveta entrada),
    // mesma mercadoria, mesmo predio: uma nao reserva a unidade da outra
    const s = comDuasTarefasReclamadasNoMesmoPredio();
    expect(reservadoNaOrigem(s, 'p9', 'stone', 'saida')).toBe(1);
    expect(reservadoNaOrigem(s, 'p9', 'stone', 'entrada')).toBe(1);
  });

  it('disponivel na origem de nivel 6 le a gaveta saida do PRODUTOR', () => {
    const s = comPedreiraComEstoque(3);
    expect(disponivelNaOrigem(s, 'p9', 'stone', 'saida')).toBe(3);
  });

  it('disponivel na origem de nivel 7 le a gaveta entrada', () => {
    const s = comEscolaComOuroEFilaVazia(1);
    expect(disponivelNaOrigem(s, 'p2', MERCADORIA_DE_OURO, 'entrada')).toBe(1);
    expect(disponivelNaOrigem(s, 'p2', MERCADORIA_DE_OURO, 'saida')).toBe(0);
  });

  it('a chamada antiga, sem gaveta, continua lendo `saida`', () => {
    const s = comArmazemComEstoque({ stone: 4 });
    expect(disponivelNaOrigem(s, ID_DO_ARMAZEM, 'stone')).toBe(4);
  });

  it('destino armazem nao tem teto', () => {
    expect(demandaNoDestino(s, tarefaDeNivel6)).toBe(Number.POSITIVE_INFINITY);
    expect(demandaNoDestino(s, tarefaDeNivel7)).toBe(Number.POSITIVE_INFINITY);
  });

  it('destino produtor pede exatamente a demanda de insumo', () => {
    expect(demandaNoDestino(s, tarefaDeNivel4))
      .toBe(demandaDeInsumo(s, 'p5', 'tree_trunk'));
  });

  it('tarefa de insumo apontando para armazem pede zero (sanear cancela)', () => {
    expect(demandaNoDestino(s, insumoComDestinoErrado)).toBe(0);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F15b-entrega.test.ts -t 'reserva por gaveta'`
Expected: FAIL — `disponivelNaOrigem` lê sempre `saida`; `demandaNoDestino` cai
no ramo do ouro (é o `else` atual) e devolve `ouroNecessario` para tudo que não
é material.

- [ ] **Step 3: implementar**

```ts
export function reservadoNaOrigem(
  state: GameState, predioId: string, mercadoria: string,
  gaveta: 'entrada' | 'saida' = 'saida',
): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && ehTarefaDeTransporte(t) && t.estado === 'reclamada'
        && t.origem === predioId && t.mercadoria === mercadoria
        && gavetaDeOrigem(t.tipo) === gaveta) soma += 1;
  }
  return soma;
}

/** O que um serf ainda pode reservar na origem: `gaveta - reservado`. A gaveta
 *  vem do TIPO da tarefa (F15b/D4): ate o nivel 6 e `saida`; o nivel 7 tira da
 *  `entrada`, que e onde o excedente fica preso. So predio completo — e nao mais
 *  so armazem: a origem de uma tarefa de nivel 6 e o proprio produtor. */
export function disponivelNaOrigem(
  state: GameState, predioId: string, mercadoria: string,
  gaveta: 'entrada' | 'saida' = 'saida',
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  return (predio.estoque[gaveta][mercadoria] ?? 0)
    - reservadoNaOrigem(state, predioId, mercadoria, gaveta);
}

export function demandaNoDestino(
  state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData,
): number {
  switch (tarefa.tipo) {
    case 'material-para-obra': {
      const predio = state.predios.porId[tarefa.destino];
      if (!predio || predio.estado !== 'obra') return 0;
      return predio.obra.faltam[tarefa.mercadoria] ?? 0;
    }
    case 'ouro-para-escola':
      return ouroNecessario(state, tarefa.destino, dados);
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa':
      return demandaDeInsumo(state, tarefa.destino, tarefa.mercadoria, dados);
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem':
      // O armazem nao tem teto de gaveta (F15b/D5). Quem limita estas tarefas e
      // a ORIGEM: so existe tarefa para o que esta la, e `disponivelNaOrigem` ja
      // desconta o reservado.
      return ehArmazemCompleto(state.predios.porId[tarefa.destino])
        ? Number.POSITIVE_INFINITY : 0;
  }
}
```

- [ ] **Step 4: rodar a suíte inteira**

Run: `npm run test`
As reservas são o coração da F09/F10/F13. Se alguma delas quebrar aqui é
regressão de verdade, não teste desatualizado — leia antes de mexer na asserção.

- [ ] **Step 5: Commit**

```bash
git add src/sim/reservas.ts tests/
git commit -m "feat(F15b): reserva e disponibilidade por gaveta, destino armazem sem teto"
```

---

### Tarefa 4 — os geradores dos níveis 4, 5, 6 e 7

**Files:**
- Modify: `src/sim/systems/jobs.ts`
- Test: `tests/F15b-entrega.test.ts`

**Interfaces:**
- Consumes: `demandaDeInsumo`, `excedenteNaEntrada`, `produtorParado` (Tarefa 1);
  `criarTarefaDeInsumo`, `criarTarefaParaArmazem`, `gavetaDeOrigem` (Tarefa 2);
  `disponivelNaOrigem` com gaveta (Tarefa 3).
- Produces: `gerarTarefasDeInsumo` e `gerarTarefasParaArmazem` (privadas,
  chamadas por `gerarTarefas`); `destinoMaisPerto(state, origem, dados)`.

Os quatro pontos que hoje assumem "origem é armazém" e precisam de ramo, todos
em `src/sim/systems/jobs.ts`:

1. `motivoIndividual` — `if (!ehArmazemCompleto(origem)) return 'origem-sumiu'`
   passa a exigir só "prédio completo", e para os níveis 1–5 continua exigindo
   armazém. A forma exigida vem do tipo.
2. `abertaVale` — mesma checagem, e as comparações `demandaNoDestino < 1` e
   `disponivelNaOrigem < 1` passam a usar a gaveta do tipo. **É aqui que a
   re-tipagem do D2 acontece de graça:** a aberta de nível 4 cuja urgência virou
   "baixa" deixa de valer, é cancelada e o gerador cria a de nível 5 no mesmo
   tick.
3. `origemMaisPerto` — varre `armazensCompletos`; para os níveis 6/7 a origem já
   é conhecida (é o prédio que tem a sobra) e quem se escolhe é o **destino**,
   pelo `destinoMaisPerto` novo, com o mesmo desempate (menor distância de
   caminho real, depois menor id).
4. `sanearTarefas`, passo 4 — o teto de tarefas abertas por grupo: com
   `demandaNoDestino` infinita, o teto passa a ser `disponivelNaOrigem` na gaveta
   do tipo.

- [ ] **Step 1: escrever o teste que falha**

```ts
describe('F15b — nivel 6: a saida do produtor vai ao armazem', () => {
  it('pedreira com stone na saida gera tarefa para o armazem', () => {
    const s = gerarTarefas(comPedreiraComEstoque(1));
    const t = tarefasDoTipo(s, 'saida-cheia-para-armazem');
    expect(t).toHaveLength(1);
    expect(t[0]!.origem).toBe('p9');
    expect(t[0]!.destino).toBe(ID_DO_ARMAZEM);
    expect(t[0]!.mercadoria).toBe('stone');
  });

  it('uma tarefa por unidade, e nao gera segunda para a unidade ja reservada', () => {
    const s = gerarTarefas(reclamarPrimeira(gerarTarefas(comPedreiraComEstoque(1))));
    expect(tarefasDoTipo(s, 'saida-cheia-para-armazem')).toHaveLength(1);
  });

  it('gaveta vazia nao gera nada', () => {
    expect(tarefasDoTipo(gerarTarefas(comPedreiraComEstoque(0)), 'saida-cheia-para-armazem')).toEqual([]);
  });

  it('produtor sem estrada ate o armazem nao gera tarefa', () => {
    expect(tarefasDoTipo(gerarTarefas(pedreiraIlhada(3)), 'saida-cheia-para-armazem')).toEqual([]);
  });
});

describe('F15b — niveis 4 e 5: o insumo chega ao produtor', () => {
  it('sawmill vazia pede como PARADA; sawmill com 2 pede como BAIXA', () => {
    const s = gerarTarefas(duasSerrarias({ p5: 0, p6: 2 }));
    expect(tipoDaTarefaPara(s, 'p5')).toBe('insumo-producao-parada');
    expect(tipoDaTarefaPara(s, 'p6')).toBe('insumo-producao-baixa');
  });

  it('a parada e servida antes da baixa (ordem da escada)', () => {
    const s = gerarTarefas(duasSerrarias({ p5: 0, p6: 2 }));
    expect(primeiraNaOrdemDeAtendimento(s).destino).toBe('p5');
  });

  it('nao gera mais tarefas do que cabe na gaveta', () => {
    const s = gerarTarefas(umaSerraria(0, /* armazem */ { tree_trunk: 99 }));
    expect(tarefasParaODestino(s, 'p5')).toHaveLength(gameData.producao.estoqueInterno.entrada);
  });

  it('nao gera mais tarefas do que ha tronco no armazem', () => {
    const s = gerarTarefas(umaSerraria(0, { tree_trunk: 2 }));
    expect(tarefasParaODestino(s, 'p5')).toHaveLength(2);
  });

  it('tarefa ABERTA e re-tipada quando a urgencia muda, no mesmo tick', () => {
    // p5 estava parada (nivel 4) e recebeu tronco por outro caminho
    const depois = gerarTarefas(sanearTarefas(comTroncoJaChegado).state);
    expect(tipoDaTarefaPara(depois, 'p5')).toBe('insumo-producao-baixa');
  });

  it('tarefa RECLAMADA nao muda de tipo nem e cancelada por mudanca de urgencia', () => {
    const depois = sanearTarefas(comReclamadaEUrgenciaMudada).state;
    expect(tarefaDe(depois, 't1')!.tipo).toBe('insumo-producao-parada');
    expect(tarefaDe(depois, 't1')!.estado).toBe('reclamada');
  });
});

describe('F15b — nivel 7: o excedente volta', () => {
  it('escola com fila cancelada devolve o ouro ao armazem', () => {
    const s = gerarTarefas(comEscolaComOuroEFilaVazia(1));
    const t = tarefasDoTipo(s, 'excedente-para-armazem');
    expect(t).toHaveLength(1);
    expect(t[0]!.mercadoria).toBe(MERCADORIA_DE_OURO);
    expect(t[0]!.origem).toBe('p2');
    expect(t[0]!.destino).toBe(ID_DO_ARMAZEM);
  });

  it('NAO dispara enquanto a fila ainda quer o ouro', () => {
    expect(tarefasDoTipo(gerarTarefas(comEscolaNaFila(2)), 'excedente-para-armazem')).toEqual([]);
  });

  it('o armazem nunca e origem de tarefa de excedente (nao devolve a si mesmo)', () => {
    const s = gerarTarefas(comArmazemComEstoque({ stone: 5 }));
    expect(tarefasDoTipo(s, 'excedente-para-armazem')).toEqual([]);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F15b-entrega.test.ts -t 'nivel'`
Expected: FAIL — nenhuma tarefa é gerada (os geradores não existem).

- [ ] **Step 3: implementar** os dois geradores, chamados por `gerarTarefas`
depois de `gerarTarefasDeOuro` e antes de `gerarTarefasDeOcupacao` (a ordem de
criação não decide prioridade — quem decide é `nivelDoTipo` no atendimento —,
mas manter a ordem da escada deixa os ids em ordem legível na evidência).

`gerarTarefasDeInsumo`: para cada prédio completo com receita que tem `entra`,
para cada mercadoria de `entra`, calcula `demandaDeInsumo` menos
`reservadoNoDestino`, escolhe o armazém mais perto com `disponivelNaOrigem > 0`,
e cria `min(demanda, disponível)` tarefas com `parada = produtorParado(...)`.

`gerarTarefasParaArmazem`: para cada prédio completo **que não é armazém**, para
cada mercadoria com `disponivelNaOrigem(..., 'saida') > 0` cria tarefas de nível
6 até esgotar o disponível; para cada mercadoria com
`excedenteNaEntrada(...) > reservadoNaOrigem(..., 'entrada')` cria tarefas de
nível 7. Destino: `destinoMaisPerto`. Sem armazém alcançável, não cria — e não é
travamento: é o mesmo silêncio de uma obra sem estrada, já coberto pelo aceite.

- [ ] **Step 4: rodar a suíte inteira**

Run: `npm run test`

- [ ] **Step 5: Commit**

```bash
git add src/sim/systems/jobs.ts tests/
git commit -m "feat(F15b): geradores dos niveis 4, 5, 6 e 7 e a origem generalizada"
```

---

### Tarefa 5 — o serf coleta da gaveta certa e entrega no lugar certo

**Files:**
- Modify: `src/sim/systems/serfs.ts` (`passoCarregando`, `passoEntregando`)
- Test: `tests/F15b-entrega.test.ts`

**Interfaces:**
- Consumes: `gavetaDeOrigem` (Tarefa 2).
- Produces: `depositarNoArmazem(state, predioId, mercadoria): GameState`
  (extraída de `passoDevolvendo`, que já faz exatamente isso).

Hoje `passoCarregando` decrementa sempre `origem.estoque.saida[m]` e
`passoEntregando` tem dois ramos (`entregarOuro`, `entregarMaterial`). O depósito
no armazém **já existe** em `passoDevolvendo` — é o mesmo código que os níveis 6
e 7 precisam. Extraia; não escreva uma terceira cópia.

- [ ] **Step 1: escrever o teste que falha**

```ts
describe('F15b — o serf e as gavetas', () => {
  it('nivel 7 tira da gaveta ENTRADA da origem, nao da saida', () => {
    const antes = predio(comSerfNaEscola, 'p2').estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
    const depois = passoCarregando(comSerfNaEscola, tarefaNivel7);
    expect(predio(depois, 'p2').estoque.entrada[MERCADORIA_DE_OURO]).toBe(antes - 1);
    expect(predio(depois, 'p2').estoque.saida[MERCADORIA_DE_OURO] ?? 0).toBe(0);
  });

  it('nivel 6 tira da gaveta SAIDA do produtor', () => {
    const depois = passoCarregando(comSerfNaPedreira, tarefaNivel6);
    expect(predio(depois, 'p9').estoque.saida.stone).toBe(2);
  });

  it('nivel 4 entrega na gaveta ENTRADA do produtor', () => {
    const depois = passoEntregando(comSerfNaSawmill, tarefaNivel4);
    expect(predio(depois, 'p5').estoque.entrada.tree_trunk).toBe(1);
  });

  it('nivel 6 deposita na saida do armazem, como a devolucao', () => {
    const antes = predio(comSerfNoArmazem, ID_DO_ARMAZEM).estoque.saida.stone ?? 0;
    const depois = passoEntregando(comSerfNoArmazem, tarefaNivel6);
    expect(predio(depois, ID_DO_ARMAZEM).estoque.saida.stone).toBe(antes + 1);
  });

  it('nenhuma unidade de mercadoria some nem se duplica no trajeto', () => {
    for (const cenario of quatroCenarios) {
      const antes = totalNoMundo(cenario.state, cenario.mercadoria);
      const depois = rodarAteEntregar(cenario);
      expect(totalNoMundo(depois, cenario.mercadoria)).toBe(antes);
    }
  });

  it('a tarefa sai do quadro e o serf volta a ocioso nos quatro tipos', () => {
    for (const c of quatroCenarios) {
      const depois = passoEntregando(c.state, c.tarefa);
      expect(depois.jobs.tarefas.porId[c.tarefa.id]).toBeUndefined();
      expect(unidade(depois, c.serf).fsm).toBe('ocioso');
    }
  });
});
```

O teste de conservação (`nenhuma unidade some nem se duplica`) é o que pega o
erro clássico deste passo: decrementar uma gaveta e incrementar outra, ou
esquecer de decrementar e criar mercadoria do nada.

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F15b-entrega.test.ts -t 'gavetas'`
Expected: FAIL — a carga do nível 7 some (decrementa uma gaveta vazia) e a
entrega do nível 4 não chega a lugar nenhum.

- [ ] **Step 3: implementar**: `passoCarregando` usa `gavetaDeOrigem(tarefa.tipo)`;
`passoEntregando` ganha uma tabela de destino por tipo — `faltam` (nível 3),
`entrada` da escola (nível 2), `entrada` do produtor (níveis 4/5),
`depositarNoArmazem` (níveis 6/7) — exaustiva como a de gavetas.

- [ ] **Step 4: rodar a suíte inteira**

Run: `npm run test`

- [ ] **Step 5: Commit**

```bash
git add src/sim/systems/serfs.ts tests/
git commit -m "feat(F15b): o serf coleta da gaveta do tipo e entrega no destino do tipo"
```

---

### Tarefa 6 — o ciclo fechado, de ponta a ponta

**Files:**
- Test: `tests/F15b-entrega.test.ts`

Nenhum código novo: é o teste que prova que as cinco tarefas anteriores se
encaixam. Se ele não passar sem tocar em `src/`, alguma das anteriores mentiu.

- [ ] **Step 1: escrever o teste**

```ts
describe('F15b — o ciclo fechado', () => {
  it('caminho real: a pedra sai da pedreira e chega ao armazem', () => {
    let s = cenarioComPedreiraOcupadaELigada();
    const antes = estoqueDosArmazens(s).stone ?? 0;
    for (let i = 0; i < 600; i++) s = step(s, []);
    expect(estoqueDosArmazens(s).stone ?? 0).toBeGreaterThan(antes);
  });

  it('caminho real: a sawmill alimentada por serf produz timber', () => {
    let s = cenarioComSawmillOcupadaEArmazemComTroncos(3);
    for (let i = 0; i < 900; i++) s = step(s, []);
    expect(predio(s, 'p5').estoque.entrada.tree_trunk ?? 0).toBeGreaterThan(0);
    expect(estoqueDosArmazens(s).timber ?? 0).toBeGreaterThan(0);
  });

  it('a pedreira nao fica presa em saida_cheia para sempre', () => {
    let s = cenarioComPedreiraOcupadaELigada();
    let maiorSequenciaCheia = 0, atual = 0;
    for (let i = 0; i < 1500; i++) {
      s = step(s, []);
      atual = unidade(s, ocupanteDe(s, 'p9')).fsm === 'saida_cheia' ? atual + 1 : 0;
      maiorSequenciaCheia = Math.max(maiorSequenciaCheia, atual);
    }
    expect(maiorSequenciaCheia).toBeLessThan(gameData.entrega.ticksAlertaTarefaSemCandidato);
  });

  it('o ouro cancelado volta da escola ao armazem (D4 do operador)', () => {
    let s = escolaComOuroParadoEFilaCancelada();
    const antes = estoqueDosArmazens(s).gold ?? 0;
    for (let i = 0; i < 300; i++) s = step(s, []);
    expect(estoqueDosArmazens(s).gold).toBe(antes + 1);
    expect(predio(s, 'p2').estoque.entrada.gold ?? 0).toBe(0);
  });

  it('nenhuma invariante do quadro e violada em nenhum tick', () => {
    let s = cenarioComPedreiraOcupadaELigada();
    for (let i = 0; i < 600; i++) {
      s = step(s, []);
      expect(violacoesDeInvariantes(s)).toEqual([]);
    }
  });

  it('determinismo: mesma semente, mesmos comandos, mesmo estado final', () => {
    const a = rodar(cenarioComPedreiraOcupadaELigada(), 600);
    const b = rodar(cenarioComPedreiraOcupadaELigada(), 600);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: rodar**

Run: `npx vitest run tests/F15b-entrega.test.ts`
Expected: PASS sem tocar em `src/`.

- [ ] **Step 3: Commit**

```bash
git add tests/F15b-entrega.test.ts
git commit -m "test(F15b): o ciclo fechado produtor -> serf -> armazem -> produtor"
```

---

### Tarefa 7 — o aceite de 3000 ticks e a evidência

**Files:**
- Create: `tests/F15b-aceite.test.ts`
- Produce: `test-output/F15.json`

O aceite escrito na fila, palavra por palavra: "cenário completo, 3000 ticks. O
estoque de stone e timber é maior que zero e cresce monotonicamente enquanto
houver rocha e árvore. Nenhum trabalhador em `ocioso` por mais de X ticks
consecutivos" — com `X` e "trabalhador" lidos como na **D6**, e a leitura
registrada no JSON de evidência para o operador poder discordar por escrito.

**Atenção à palavra "monotonicamente".** O estoque dos armazéns **cai** de modo
legítimo quando um serf coleta material para uma obra ou insumo para a Sawmill —
é o consumo, não uma perda. O aceite só faz sentido sobre a **soma acumulada
entregue**, ou sobre um cenário sem obra pendente. O cenário do aceite não terá
obra em curso depois do aquecimento, e a série medida é a do estoque dos
armazéns; se ainda assim houver queda por consumo da Sawmill, a métrica passa a
ser `stone/timber já produzidos` (acumulado, monotônico por construção), e a
troca fica registrada no JSON e no PROGRESS.

- [ ] **Step 1: escrever o teste de aceite**

```ts
it('3000 ticks: stone e timber crescem e nenhum especialista trava', () => {
  let s = cenarioOraculo(); // 2 woodcutters + 1 sawmill + 1 quarry, ocupados e ligados
  const serie: Array<{ tick: number; stone: number; timber: number }> = [];
  const ocioDesde: Record<string, number> = {};
  let maiorOcio = 0;
  let primeiroStone: number | null = null;
  let primeiroTimber: number | null = null;

  for (let i = 0; i < 3000; i++) {
    s = step(s, []);
    const e = estoqueDosArmazens(s);
    const stone = e.stone ?? 0, timber = e.timber ?? 0;
    if (primeiroStone === null && stone > 0) primeiroStone = s.tick;
    if (primeiroTimber === null && timber > 0) primeiroTimber = s.tick;
    serie.push({ tick: s.tick, stone, timber });
    maiorOcio = Math.max(maiorOcio, medirOcioDeEspecialistas(s, ocioDesde));
  }

  const quedas = serie.filter((p, i) => i > 0
    && (p.stone < serie[i - 1]!.stone || p.timber < serie[i - 1]!.timber));
  expect(quedas).toEqual([]);
  expect(serie.at(-1)!.stone).toBeGreaterThan(0);
  expect(serie.at(-1)!.timber).toBeGreaterThan(0);
  expect(maiorOcio).toBeLessThanOrEqual(gameData.entrega.ticksAlertaTarefaSemCandidato);
});
```

`medirOcioDeEspecialistas` conta ticks consecutivos em `ocioso` **só** de unidade
que é ocupante de prédio (D6), e zera a contagem quando a FSM muda.

Se a medição real ficar acima de 300, **não afrouxe o limite**: é achado do ponto
2 e vai para o relatório e para o `BALANCE_LOG.md` como está.

- [ ] **Step 2: rodar e ler o resultado de verdade**

Run: `npx vitest run tests/F15b-aceite.test.ts`
Se falhar, o número que falhou é dado do ponto 2, não um teste a consertar.

- [ ] **Step 3: gravar `test-output/F15.json`** com: o dado usado (ciclos,
      capacidades, rendimento), o cenário (prédios, estradas, serfs, semente), a
      série amostrada a cada 100 ticks (não os 3000 pontos), o tick do primeiro
      stone e do primeiro timber no armazém, o maior ócio de especialista, as
      tarefas abertas por nível ao longo do tempo, e **a leitura do `X` e de
      "trabalhador"** escrita em texto.

- [ ] **Step 4: abrir a evidência com Read** — CLAUDE.md §7 exige que o critério
      seja verificado com evidência aberta, não descrita de memória.

- [ ] **Step 5: Commit**

```bash
git add tests/F15b-aceite.test.ts test-output/F15.json
git commit -m "feat(F15b): o aceite de 3000 ticks e a evidencia"
```

---

### Tarefa 8 — o oráculo do GDD §4.5: medir antes de ajustar

**Files:**
- Modify: `tools/sim.js` (cenário `oraculo`)
- Modify: `BALANCE_LOG.md`

Esta é a tarefa que responde aos pontos 2 e 3 do operador. **Nenhuma taxa muda
aqui.** A saída é um relatório.

- [ ] **Step 1: cenário `oraculo` no `tools/sim.js`**, no molde do cenário
      `producao` da F15a (estradas injetadas no estado, prédios por
      `PlaceBlueprint`, especialistas por `EnqueueTraining`): 2 Woodcutter's,
      1 Sawmill, 1 Quarry — a proporção `woodcutters_por_sawmill: 2` que o próprio
      `production.json` declara como oráculo.

- [ ] **Step 2: `imprimirOraculo(state)`** — por prédio: fsm do ocupante,
      progresso, veio, gavetas `entrada` e `saida`; global: tarefas abertas por
      nível, ticks acumulados de `esperando_insumo` e `saida_cheia` por prédio,
      ticks de ócio por especialista, estoque dos armazéns.

- [ ] **Step 3: rodar e anotar**

```bash
npm run sim -- oraculo --ticks 3000
npm run sim -- oraculo --ticks 12000
```

Os números a extrair, exatamente os que o operador pediu:

1. **fila acumulando** — tarefas abertas de cada nível ao longo do tempo. Fila
   que só cresce = os serfs não dão conta; fila sempre vazia = sobra serf.
2. **prédio ocioso** — ticks em `esperando_insumo` e em `saida_cheia` por prédio.
   `saida_cheia` alto = a entrega é o gargalo; `esperando_insumo` alto na Sawmill
   = 2 Woodcutter's não bastam **nesta escala de tempo** (a razão de ciclos
   derivados é 545 ticks por tronco contra 273 ticks por ciclo de serraria — dois
   cortadores alimentam uma serraria com folga de um tick por ciclo, e essa folga
   é o que a corrida vai confirmar ou desmentir com a entrega no meio).
3. **tempo até o primeiro timber no armazém** — em ticks e em minutos de jogo.

- [ ] **Step 4: medir o veio (ponto 3)** — rodar o cenário com o veio reduzido por
      dado injetado (ex.: 20), medir os ticks do primeiro ao último depósito,
      dividir por 20 = **ticks reais por unidade de pedra, com espera de serf
      incluída**. Multiplicar por 200 e **declarar a extrapolação como
      extrapolação**. Se a corrida completa couber em tempo aceitável no CLI,
      rodar e usar o número medido — e dizer qual dos dois é.

- [ ] **Step 5: escrever no `BALANCE_LOG.md`** os números medidos, com data,
      cenário, semente e o comando que reproduz. **Sem ajustar nada** —
      CLAUDE.md §12: balanceamento se ajusta em lote, e o lote ainda não fechou.

- [ ] **Step 6: Commit**

```bash
git add tools/sim.js BALANCE_LOG.md
git commit -m "feat(F15b): cenario oraculo do GDD 4.5 e os numeros medidos"
```

---

### Tarefa 9 — BUG-001 (ponto 4)

**Files:**
- Modify: `src/sim/systems/laborers.ts` (`passoMartelando`)
- Modify: `BUGS.md`
- Test: `tests/F15b-entrega.test.ts`

Causa: `passoMartelando` faz
`removerTarefa(comPredio(state, completo), tarefa.id)` — tira do quadro só a
tarefa do laborer que deu a última martelada. As irmãs daquela obra sobrevivem
até `sanearTarefas` as cancelar no tick seguinte.

- [ ] **Step 1: escrever o teste que falha**

```ts
describe('F15b — BUG-001', () => {
  it('no TICK em que a obra vira completa, nenhuma tarefa construir aponta para ela', () => {
    let s = obraAUmaMarteladaDoFim(); // com tres laborers na obra
    s = step(s, []);
    expect(predio(s, 'p9').estado).toBe('completo');
    expect(tarefasDoTipo(s, 'construir').filter((t) => t.destino === 'p9')).toEqual([]);
  });

  it('os outros laborers voltam a ocioso, sem reserva pendurada', () => {
    const s = step(obraAUmaMarteladaDoFim(), []);
    for (const u of laborersDe(s)) expect(u.fsm).toBe('ocioso');
    expect(laborersReservados(s, 'p9')).toBe(0);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run tests/F15b-entrega.test.ts -t 'BUG-001'`
Expected: FAIL com 2 tarefas sobrando (as irmãs).

- [ ] **Step 3: implementar** — no ramo que completa a obra, cancelar as
      `construir` daquele destino: abertas removidas, reclamadas por `liberar`
      com `'destino-completo'` (o motivo já existe e já cancela em vez de
      reabrir, em vez de inventar um motivo novo). Os outros laborers já caem em
      `ficarOcioso` quando a tarefa some.

- [ ] **Step 4: rodar a suíte inteira**

Run: `npm run test`
Atenção ao aceite da F15a: `violacoes.noTickDaObraConcluida` deve passar de três
entradas a zero. Se o teste da F15a afirmar as três entradas, ele precisa ser
atualizado — e a atualização vira nota no PROGRESS, porque é o bug saindo, não o
aceite mudando.

- [ ] **Step 5: tirar o BUG-001 do `BUGS.md`** no mesmo commit (CLAUDE.md §12).

- [ ] **Step 6: Commit**

```bash
git add src/sim/systems/laborers.ts BUGS.md tests/
git commit -m "fix(F15b): BUG-001 — a obra concluida cancela as tarefas construir irmas"
```

---

### Tarefa 10 — o fecho

- [ ] **Step 1:** `npm run verify` (typecheck + lint + validate:data + test).
- [ ] **Step 2:** os roteiros de não-regressão visual, **só código de saída**,
      sem abrir imagem (CLAUDE.md §8 — esta feature não muda a tela).
- [ ] **Step 3:** `PROGRESS.md` — decisões D1–D9, o **verificado** separado da
      **hipótese** (a extrapolação do veio é hipótese, nomeada como tal), o que
      ficou aberto, e a pergunta do `X` se o operador ainda não tiver respondido.
- [ ] **Step 4:** `test-results.json` → `"F15b-producao-entrega": true` **só
      depois** do selo, e só quando F15b-2 (Tarefa 8) estiver entregue.
- [ ] **Step 5:** Commit `feat(F15b): <resumo>`.

---

## 5. Para copiar ao PROGRESS.md e às Notas do BUILD_PLAN

Cada contrato herdado vai como **Nota no item da feature que o herda**, não só no
PROGRESS:

- **F17** herda: o cenário `oraculo` do `tools/sim.js` e os números do
  `BALANCE_LOG.md` são a linha de base do aceite da Fase A. Se as taxas mudarem
  entre uma coisa e outra, a linha de base morre junto e precisa ser remedida.
- **F20** herda: `alvoDeEntrada` reparte a gaveta `entrada` na proporção da
  receita, com a sobra da divisão indo para a mercadoria de maior `entra`. O
  primeiro prédio de **duas** entradas reais (`metallurgists`, `iron_smithy`) é o
  primeiro teste de verdade dessa regra — até lá ela só foi exercitada com uma
  entrada só.
- **F16** herda: nada de `render/`/`ui/` saiu desta feature (D9). O painel de
  seleção é que vai mostrar as gavetas `entrada`/`saida`.
- **F21** herda: o nível 7 devolve excedente de qualquer prédio, inclusive de
  prédio que o jogador mandou demolir — verificar quando a demolição existir.

## 6. Perguntas ao operador

1. **Escopo (bloqueante para a Tarefa 1 em diante):** alargar a F15b para os
   níveis **4–7** com o corte em F15b-1/F15b-2 (saída A, recomendada), ou manter
   6 e 7 e relatar a Sawmill parada (saída B)? Ver §1.
2. **O `X` do aceite:** confirma `ticksAlertaTarefaSemCandidato` (300 ticks) e
   "trabalhador" = **especialista**? Na ausência de resposta implemento assim e
   registro como interpretação conservadora (CLAUDE.md §14).
3. **O veio de 200:** aceita a extrapolação medida (veio curto + regra de três
   com a espera real incluída), ou quer a corrida completa de ~40 000 ticks no
   CLI?

## 7. Auto-revisão

**Cobertura da spec.** Escopo (níveis 6 e 7) → Tarefas 2, 4, 5. Aceite dos 3000
ticks → Tarefa 7. Evidência `test-output/F15.json` → Tarefa 7, Step 3. Nota
"calibração não sai da Fase A" → Tarefa 8. Nota do `rendimento: 200` → Tarefa 8,
Step 4. Nota D3 (`saida > 0`) → D3 + Tarefa 4. Nota do `X` → D6 + Tarefa 7 +
pergunta 2. Nota do HUD/`estoqueDosArmazens` → Tarefas 6 e 7 medem por
`estoqueDosArmazens`, que é onde os dois seletores divergem pela primeira vez.
Nota do ouro parado na escola → Tarefa 4 (gerador do nível 7) e Tarefa 6 (teste
de ponta a ponta). Nota D4 (sem `render/`/`ui/`) → D9, nenhum arquivo de tela no
mapa da §3. Nota da F09 (cada produtor alarga `Tarefa.tipo` e referencia o nível
por `id`) → Tarefa 2. **Gap declarado:** os níveis 4 e 5 não estão na spec — é a
§1, e é decisão do operador. **Segundo gap declarado:** a palavra
"monotonicamente" do aceite não sobrevive ao consumo de insumo; a leitura e a
alternativa estão na Tarefa 7.

**Placeholders.** Nenhum "TBD". Os nomes de fixture citados nos testes
(`comPredioCompleto`, `cenarioOraculo`, `obraAUmaMarteladaDoFim`) são helpers a
escrever na própria tarefa, no molde dos que `tests/` já tem; onde o helper **já
existe** (`violacoesDeInvariantes`, `estoqueDosArmazens`, `laborersReservados`)
está dito. O único ponto com folga deliberada é o nome do campo de capacidade
derivada (`producao.estoqueInterno.entrada`), com a instrução explícita de usar o
nome que o loader já expõe — `src/sim/producao.ts` já lê essa capacidade.

**Consistência de tipos.** `gavetaDeOrigem(tipo)` é o mesmo nome na Tarefa 2
(produz), 3 (reserva) e 5 (serf), e mora em `state.ts` justamente para que a
Tarefa 3 não crie ciclo — `reservas.ts` hoje não importa `jobs.ts`, e o
comentário do topo de `reservas.ts` diz por quê. `demandaDeInsumo` e
`excedenteNaEntrada` são os mesmos da Tarefa 1 na 3 e na 4.
`criarTarefaParaArmazem` cobre os níveis 6 e 7 com a flag `excedente`, e
`criarTarefaDeInsumo` os níveis 4 e 5 com a flag `parada` — duas funções, quatro
tipos, e o tipo fotografado na criação (D2). `TipoDeTransporte` é derivado de
`TarefaDeTransporte['tipo']`, como `TipoDeTarefa` já é de `Tarefa['tipo']`.
