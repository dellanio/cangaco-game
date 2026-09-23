# F15 — Produção: Quarry, Woodcutter's, Sawmill — Plano de implementação

> **Para o executor:** use `superpowers:executing-plans`, tarefa a tarefa. **Não**
> use `subagent-driven-development` nem `dispatching-parallel-agents` — proibidos
> pelo CLAUDE.md §11. Passos usam checkbox (`- [ ]`).

**Objetivo:** um prédio completo, ocupado e ligado ao armazém por estrada executa
ciclos de produção: consome o que a receita pede da gaveta `entrada`, deposita o
que ela rende na gaveta `saida`, e um serf leva o resultado ao armazém. A Quarry
consome um veio finito e para quando ele acaba.

**Aceite (BUILD_PLAN, intocado):** cenário completo, 3000 ticks. O estoque de
stone e timber é maior que zero e cresce monotonicamente enquanto houver rocha e
árvore. Nenhum trabalhador em `ocioso` por mais de X ticks consecutivos.

**Evidência:** `test-output/F15.json`.

**Spec:** `BUILD_PLAN.md` (item F15, com as quatro Notas) + `docs/GDD.md` §4.5,
§5.1, §5.2, §6.2 e §6.3.

---

## 0. As respostas aos quatro pontos do operador

Leia esta seção antes das tarefas: ela é o que o operador precisa aprovar.

### Ponto 1 — os números, antes de mexer em qualquer taxa

**Medido nesta sessão** (probe descartável que carregou `src/sim/data/index.ts`
pelo Vite e imprimiu `gameData.producao` e `gameData.conversoes`; o probe foi
apagado — a proteção permanente é a Tarefa 2):

| receita | taxa declarada (`production.json`, por minuto, escala 1.0) | período convertido (escala `economia` = 2.0, 10 Hz) |
|---|---|---|
| `quarry.sai.stone` | 1,8 | **167 ticks** por stone |
| `woodcutters.sai.tree_trunk` | 0,55 | **545 ticks** por tronco |
| `sawmill.entra.tree_trunk` | 1,1 | **273 ticks** por tronco |
| `sawmill.sai.timber` | 2,2 | **136 ticks** por timber |

**O oráculo do GDD §4.5 aplicado à cadeia da madeira** — atenção: isto é
**aritmética sobre os números acima, não medição de simulação**. A produção ainda
não existe, então não há corrida para medir. É hipótese, nomeada como tal:

- 2 Woodcutter's oferecem 2 troncos a cada 545 ticks = **1 tronco por 272,5 ticks**.
- 1 Sawmill pede **1 tronco por 273 ticks**.
- Sobra de oferta: **0,18 %** — cerca de um tronco de excedente a cada 150 000
  ticks. Não é fila infinita, e não é serraria ociosa.

A proporção **2 Woodcutter's : 1 Sawmill** do GDD §4.5 já está *codificada* nas
taxas; o que faltava era um consumidor delas.

Projeção para os 3000 ticks do aceite (também aritmética, não medida):

- Quarry: `floor(3000 / 167)` = **17 stone** (uma pedreira).
- Woodcutter's: `floor(3000 / 545)` = 5 troncos cada, **10 troncos** (dois).
- Sawmill: `floor(3000 / 273)` = 10 ciclos = **20 timber**, exatamente o que os
  dois lenhadores entregam. O limite é a oferta de tronco, não a serraria.

**Decisão: nenhuma taxa é ajustada neste plano.** O que o cenário longo vai medir
de verdade não são as taxas — é o **buffer** e o **transporte**:
`production.json:estoqueInternoPorPredio` é `{ entrada: 5, saida: 5 }`, e a
serraria só recebe tronco no ombro de um serf. Se algum prédio ficar parado no
cenário da F15b, o primeiro suspeito é o buffer ou a logística, **não** a taxa.
Qualquer ajuste de número sai daí, vai para `BALANCE_LOG.md` e é aplicado **em
lote** (CLAUDE.md §12), depois da corrida medida — nunca antes dela.

### Ponto 2 — onde mora o veio (decisão **D2**, contrato que a F21 herda)

**Verificado:** não existe camada de terreno na simulação. `GameState` não tem
mapa de tiles; `sim/pathfinding.ts` só bloqueia *footprint* de prédio e limite de
mapa; o `'terreno'` de `MotivoDeRecusa` é declarado e inalcançável desde a F06,
com Nota no próprio item F06 dizendo que ele só ganha uso "quando o mapa tiver
terreno variado". Nenhuma feature antes da F17 produz esse mapa.

**Decisão: o veio mora no PRÉDIO**, em `PredioCompleto.producao.veio: number |
null`, semeado no instante em que a obra vira `'completo'`, a partir de
`data/production.json: predios.<id>.veio.rendimento`. Ausente no dado =
renovável (`null`), que é o caso do Woodcutter's (ele replanta — `modos` em
`production.json`) e da Sawmill.

Por que não inventar a camada de terreno aqui: ela é uma feature inteira
(geração de mapa, recusa de posicionamento por terreno, render do terreno, custo
de movimento por tile) e não está na fila. Criá-la de lado dentro da F15 seria
exatamente a "refatoração ampla não pedida" do CLAUDE.md §10.

**O que a F21 herda, literalmente:** o campo `producao.veio`, o decremento por
unidade de saída, o estado terminal e o evento `vein-exhausted`. O que muda lá é
**só o inicializador**: hoje o rendimento vem do dado do tipo; quando existir
camada de terreno, ele passa a ser função dos tiles de rocha sob e ao redor do
prédio. Nenhum sistema precisa mudar para isso acontecer. Esta frase vira Nota no
item F21 do `BUILD_PLAN.md` (Tarefa 0) — contrato de feature futura mora na fila,
não só no PROGRESS.

**O estado terminal, e por que não é travamento silencioso:** com o veio
esgotado o especialista fica em `esperando_insumo` — a rocha *é* o insumo que
não vem mais. Não é rótulo único para causas opostas: "esperando tronco" e "veio
esgotado" se distinguem compondo o estado que já existe (`producao.veio === 0`),
sem estado novo na FSM e sem texto genérico. É esse mesmo predicado que a F22 lê
para o alerta "mina esgotada", e o evento `vein-exhausted` marca o instante.

### Ponto 3 — o nível 6 da escada

`data/delivery.json` nível 6 é `saida-cheia-para-armazem`. Ele nasce na **F15b**
como um tipo novo de `Tarefa` cujo `tipo` é **exatamente esse id** — é assim que
`nivelDoTipo` acha o nível sem ninguém digitar `6` em `.ts` (o mesmo contrato que
a F13 usou para o nível 2).

**Interpretação registrada (D3), porque o rótulo engana:** o gatilho é **haver
mercadoria na gaveta `saida`**, não a gaveta estar *cheia*. Esperar encher
garantiria o gargalo que o nível existe para evitar: a pedreira encheria 5 pedras
(835 ticks), pararia em `saida_cheia`, e o GDD §6.2 diz que `saida_cheia`
"sinaliza que a logística é o gargalo" — isto é, é exceção, não regime
permanente. O id do dado fica intocado; o que este plano registra é o que ele
significa.

### Ponto 4 — as duas situações em que o HUD engana

O HUD lê `estoqueDosArmazens` (decisão do operador, pós-F10: o número tem que
prever o que o jogador pode gastar). As duas situações, decididas juntas, com
**um mecanismo só** — e nenhuma linha de `render/` ou `ui/`:

**(a) Pedra parada na saída da Quarry: não é distorção, e nada muda.** É limitada
a `estoqueInternoPorPredio.saida` = 5 por produtor, é drenada continuamente pelo
nível 6, e é literalmente pedra que o jogador **não pode** gastar — nem a estrada
(F08) nem a obra (F10) tiram de lá. O HUD está certo por definição.

**(b) Ouro parado na entrada da Schoolhouse depois de um cancelamento: é
vazamento de verdade, e se conserta na ESCADA.** Nasce o nível 7
(`excedente-para-armazem`, já no dado): mercadoria parada numa gaveta de um
prédio que **não a pede mais** volta ao armazém por tarefa. O ouro reaparece no
HUD porque volta a estar no armazém — e não porque o HUD passou a mentir menos.

Por que esta saída e não "o HUD distingue": ela resolve as duas de uma vez, cabe
inteira em `sim/`, e o item F15 **não** tem nota de feature de integração — sem
essa nota o CLAUDE.md §10 proíbe tocar `sim/` e `render/` na mesma feature, e
nota é autorização que o operador concede, não coisa que se infere.
Se ele preferir a saída pela tela, é ele quem escreve a nota na fila primeiro.

---

## 1. A divisão proposta: F15a e F15b

A F15 não cabe numa sessão. Contagem honesta do que ela pede: mudar a forma do
dado de produção e seu validador, acrescentar campo ao `PredioCompleto`, dois
estados de FSM, o veio, **dois** tipos novos de `Tarefa` (níveis 6 e 7) com toda
a máquina de reserva/saneamento/entrega que eles arrastam, o cenário longo e a
calibração. A F13 foi partida pelo mesmo motivo e o corte funcionou.

**Proposta (CLAUDE.md §6 — quebrar em sub-itens, registrar, entregar o primeiro):**

| item | escopo | aceite |
|---|---|---|
| **F15a — o ciclo de produção** | receita como ciclo no dado; `PredioCompleto.producao`; `trabalhando ⇄ esperando_insumo ⇄ saida_cheia`; veio e esgotamento; eventos | cenário de 1000 ticks com Quarry ocupada e ligada: `estoque.saida.stone` cresce de 1 em 1 a cada 167 ticks até o teto de 5, o especialista nunca fica `ocioso`, e a Sawmill sem tronco fica em `esperando_insumo`. Sem transporte. |
| **F15b — a entrega e a calibração** | níveis 6 e 7 da escada; serf leva ao armazém; o excedente parado volta; cenário de 3000 ticks; os números medidos | **o aceite da F15, intocado** |

O critério de aceite da F15 **não é reescrito**: ele é atribuído inteiro à F15b.
A F15a ganha um critério novo e estritamente mais fraco, que é um recorte do
primeiro. `test-results.json` passa a ter `F15a-producao-ciclo` e
`F15b-producao-entrega` no lugar de `F15-producao-basica`, como a F13 tem duas
chaves.

**Aprovado pelo operador (2026-09-22), com um enquadramento melhor que o meu: o
corte é pela CAMADA, não pelo tema.** F15a = o prédio produz na gaveta `saida` e
o veio esgota. F15b = a entrega ao armazém (níveis 6 e 7) e o cenário longo. E
uma condição explícita: **a calibração não sai da Fase A** — ela é o que prova
que o jogo tem ritmo, e o aceite da F17 depende dela. As duas ficam antes da F16
na fila.

**Este plano detalha a F15a inteira.** A F15b ganha plano próprio quando a F15a
fechar, escrito já com os números medidos na mão — foi assim que a F13b foi feita
(`docs/planos/F13b-painel-escola.md`). O esboço dela está na seção 6.

---

## 2. Arquitetura da F15a

Cinco peças, todas em `sim/` e em `data/`. **Nenhuma linha** de `src/render/`,
`src/ui/` ou `src/input/`.

1. **A receita vira um CICLO, no carregamento** (`data/types.ts`, `loader.ts`).
   Hoje `gameData.producao.receitas[tipo]` guarda *ticks por unidade*, um número
   por mercadoria. Consumir isso exigiria um relógio por mercadoria dentro do
   estado. Em vez disso o carregador deriva, uma vez, **um** ciclo por prédio:
   `ticksDoCiclo` = o maior período entre `entra` e `sai`, e as quantidades
   inteiras `round(ticksDoCiclo / período)`.

2. **`PredioCompleto.producao: Producao | null`** — `{ progresso, veio }`. `null`
   quando o tipo não tem receita (armazém, escola), no molde de `ocupante`.

3. **`sim/producao.ts`** — derivações puras, irmão de `obra.ts`, `escola.ts` e
   `ocupacao.ts`: lê estado e dado, não conhece o JobBoard.

4. **A FSM do especialista ganha os dois estados que faltavam**
   (`systems/especialistas.ts`). Quem avança o relógio do prédio é o **ocupante**
   — o GDD §6.2 põe `esperando_insumo` e `saida_cheia` na FSM dele, prédio sem
   ocupante não produz (Nota da F14), e "um prédio, um ocupante" torna avanço
   duplo irrepresentável. **Nenhum sistema novo, nenhuma ordem nova no `step()`.**

5. **Regra de dado** (`tools/data-rules.js`) — o arredondamento das quantidades
   não pode distorcer a razão declarada.

### Por que o ciclo é o modelo certo (e não uma invenção)

Aplicando a regra "ciclo = o período mais lento, quantidades = razão dos
períodos" às **21 receitas** de `production.json`, saem exatamente as proporções
que o GDD §4.2 e §5.2 descrevem em palavras — sem nenhuma delas estar escrita em
lugar nenhum como quantidade:

| receita | ciclo derivado | o que o GDD diz |
|---|---|---|
| `sawmill` | 273 ticks: 1 tronco → 2 timber | "1 tronco → 2 timber" |
| `bakery` | 246 ticks: 1 flour → 2 loaves | "2 pães por farinha" |
| `butchers` | 200 ticks: 1 pig → 3 sausages | "3 salsichas por porco" |
| `tannery` | 600 ticks: 1 skin → 2 leather | "skin → 2 leather" |
| `metallurgists` | 600 ticks: 1 gold_ore + 1 coal → 2 gold | "gold ore + coal → 2 gold" |
| `swine_farm` | 600 ticks: 4 corn → 1 pig + 1 skin | "4 corn por porco" |
| `weapons_workshop` | 375 ticks: 2 timber → 1 arma | "2 timber → arma de madeira" |

Vinte e uma receitas, nenhuma exceção. **Medido** (script sobre `production.json`
+ `time.json`, 2026-09-22): contra a razão declarada nas taxas, o desvio da
quantidade inteira é **0,00 % nas 21** — as razões do dado são inteiras de
propósito. O arredondamento em ticks chega a **0,5 %** de distância do inteiro
(butchers: `200/67 = 2,985` → 3), e é essa folga que a regra da Tarefa 2 limita.

### Restrições globais (valem para toda tarefa)

- TypeScript estrito, **sem `any`** em `sim/`. Nenhum import de `phaser`.
- **Nenhum número de balanceamento em `.ts`.** Ciclo, quantidades e rendimento do
  veio vêm de `data/production.json`, convertidos **uma vez** no carregamento.
- **Sem `Math.random()` e sem `Date.now()`** em `sim/`. Iteração de mercadoria na
  ordem de `dados.economia.mercadorias`, nunca `Object.keys`.
- `GameState` serializável: `null` e nunca `undefined` nos campos novos.
- Um `fsm` fora do GDD §6.2 é **erro** (save corrompido), não valor ignorado.
- Proibido alargar `ignores`, usar `skip` ou `eslint-disable` para fazer o
  `npm run verify` passar (CLAUDE.md §10).
- Todo commit termina com a linha de atribuição:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## 3. Mapa de arquivos da F15a

**Criar**
- `src/sim/producao.ts` — derivações puras da produção.
- `tests/F15a-receita.test.ts` — o ciclo derivado do dado.
- `tests/F15a-producao.test.ts` — as derivações, a FSM e o veio.
- `tests/F15a-aceite.test.ts` — o cenário de 1000 ticks + `test-output/F15a.json`.
- `tests/helpers/producao-cenario.ts` — cenário reusável (irmão de
  `tests/helpers/escola-cenario.ts`).

**Modificar**
- `data/production.json` — `veio.rendimento` na `quarry`.
- `src/sim/data/raw.ts` — tipo do campo novo.
- `src/sim/data/types.ts` — `ReceitaDePredio` no lugar de `ProducaoPredio`.
- `src/sim/data/loader.ts:119-144` — deriva o ciclo.
- `tools/data-rules.js` + `tools/data-rules.d.ts` + `tools/validate-data.js`.
- `src/sim/state.ts` — `Producao`, `PredioCompleto.producao`, dois `GameEvent`,
  `producaoParaTipo` ao lado de `capacidadeParaTipo:494`, uso em
  `completarObra:529` e em `criarPredios`.
- `src/sim/systems/especialistas.ts:112-128` — `passoTrabalhando` e os dois
  estados novos.
- Fixtures de `PredioCompleto` nos testes existentes — `producao: null` (mesmo
  fallout que `ocupante: null` causou na F14).

**Não tocar:** `src/render/`, `src/ui/`, `src/input/`, `src/sim/jobs.ts`,
`src/sim/reservas.ts`, `src/sim/systems/jobs.ts`. Tudo isso é F15b.

---

## 4. Tarefas da F15a

### Tarefa 0 — o corte na fila, antes de qualquer código

**Arquivos:** `BUILD_PLAN.md`, `test-results.json` (só com o aval do operador),
`PROGRESS.md`.

- [ ] **Passo 1: levar a seção 1 deste plano ao operador e esperar o aval.**
      Sem o aval, **pare aqui**: partir a fila sem autorização é reordenar o
      backlog, que o CLAUDE.md §11 proíbe.
- [ ] **Passo 2: escrever os sub-itens `F15a` e `F15b` no `BUILD_PLAN.md`**, no
      lugar do item F15, preservando **palavra por palavra** o Escopo, o Aceite,
      a Evidência e as quatro Notas atuais dentro do item F15b.
- [ ] **Passo 3: acrescentar a Nota do veio ao item F21** (o texto da seção 0,
      ponto 2, parágrafo "O que a F21 herda").
- [ ] **Passo 4: acrescentar ao item F22** que `vein-exhausted` e
      `producao.veio === 0` são o que o alerta "mina esgotada" lê — ele nasce
      pronto aqui, como `predio.ocupante === null` nasceu pronto na F14.
- [ ] **Passo 5: commit.**

```bash
git add BUILD_PLAN.md test-results.json PROGRESS.md docs/planos/F15-producao.md
git commit -m "docs(F15): corte em F15a/F15b e as notas de contrato para F21 e F22"
```

### Tarefa 1 — a receita como ciclo, no carregamento

**Arquivos:**
- Modificar: `src/sim/data/types.ts:39-57`, `src/sim/data/loader.ts:119-144`,
  `src/sim/data/raw.ts`, `data/production.json`
- Testar: `tests/F15a-receita.test.ts` (criar)

**Interfaces — Produz** (todo o resto do plano depende destes nomes):

```ts
export interface ReceitaDePredio {
  /** Ticks de um ciclo completo. Inteiro >= 1. */
  readonly ticksDoCiclo: Ticks;
  /** Unidades consumidas da gaveta `entrada` no INICIO do ciclo. */
  readonly entra: Readonly<Record<string, number>>;
  /** Unidades depositadas na gaveta `saida` no FIM do ciclo. */
  readonly sai: Readonly<Record<string, number>>;
  /** Unidades de SAIDA que o veio ainda rende quando o predio nasce;
   *  `null` = nao esgota (renovavel). */
  readonly rendimentoDoVeio: number | null;
}
export type ProducaoReceitas = Readonly<Record<string, ReceitaDePredio>>;
```

- [ ] **Passo 1: escrever o teste que falha** (`tests/F15a-receita.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';

describe('F15a — a receita e um CICLO, derivado no carregamento', () => {
  it('quarry: 167 ticks por ciclo, 1 stone, veio finito', () => {
    const r = gameData.producao.receitas.quarry;
    expect(r).toBeDefined();
    expect(r?.ticksDoCiclo).toBe(167);
    expect(r?.entra).toEqual({});
    expect(r?.sai).toEqual({ stone: 1 });
    expect(r?.rendimentoDoVeio).toBeGreaterThan(0);
  });

  it('sawmill: 1 tronco -> 2 timber, a razao do GDD §4.2 saindo das TAXAS', () => {
    const r = gameData.producao.receitas.sawmill;
    expect(r?.ticksDoCiclo).toBe(273);
    expect(r?.entra).toEqual({ tree_trunk: 1 });
    expect(r?.sai).toEqual({ timber: 2 });
    expect(r?.rendimentoDoVeio).toBeNull();
  });

  it('woodcutters: 545 ticks por tronco, sem veio (ele replanta)', () => {
    const r = gameData.producao.receitas.woodcutters;
    expect(r?.ticksDoCiclo).toBe(545);
    expect(r?.sai).toEqual({ tree_trunk: 1 });
    expect(r?.rendimentoDoVeio).toBeNull();
  });

  it('TODA receita tem ciclo inteiro >= 1 e so quantidades inteiras >= 1', () => {
    for (const [id, r] of Object.entries(gameData.producao.receitas)) {
      expect(Number.isInteger(r.ticksDoCiclo), id).toBe(true);
      expect(r.ticksDoCiclo, id).toBeGreaterThanOrEqual(1);
      for (const q of [...Object.values(r.entra), ...Object.values(r.sai)]) {
        expect(Number.isInteger(q), id).toBe(true);
        expect(q, id).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Passo 2: rodar e ver falhar.**
      `npx vitest run tests/F15a-receita.test.ts`
      Esperado: FALHA — `ticksDoCiclo` não existe (hoje `receitas.quarry` é
      `{ entra: {}, sai: { stone: 167 } }`).

- [ ] **Passo 3: acrescentar o campo ao dado.** Em `data/production.json`, na
      `quarry` (e **só** nela — rendimento de mina é dado da F21):

```json
"quarry": {
  "entra": {},
  "sai": { "stone": 1.8 },
  "veio": { "rendimento": 200 },
  "notas": "consome o veio de rocha; esgota. rendimento e [proposta]: ~200 pedras, da ordem de uma partida (duracaoAlvoDePartida_min em time.json). Calibrar em lote, BALANCE_LOG."
}
```

      E o campo correspondente em `src/sim/data/raw.ts`, no molde dos opcionais
      que já existem lá (`notas`, `modos`, `campos`).

- [ ] **Passo 4: derivar o ciclo no carregador**, substituindo o corpo de
      `loader.ts:119-144`. As chamadas a `registrar(...)` **continuam como
      estão** — a auditoria de conversão da F03 não perde nenhuma linha; o ciclo
      é derivado dos ticks já registrados:

```ts
// --- producao: a receita vira um CICLO (F15a) ---
// Cada taxa vira um periodo em ticks, como antes (a auditoria de conversao da
// F03 continua linha a linha). O CICLO e o periodo mais LENTO entre entra e
// sai; as quantidades sao a razao dos periodos, arredondada uma unica vez.
// E isso que reproduz "1 tronco -> 2 timber" sem a quantidade estar escrita
// em lugar nenhum: ela e a razao de duas taxas.
const receitas: Record<string, ReceitaDePredio> = {};
for (const [predioId, def] of Object.entries(raw.production.predios)) {
  const periodos: Record<'entra' | 'sai', Record<string, Ticks>> = { entra: {}, sai: {} };
  for (const gaveta of ['entra', 'sai'] as const) {
    for (const [mercadoria, taxa] of Object.entries(def[gaveta])) {
      periodos[gaveta][mercadoria] = registrar(
        `production.predios.${predioId}.${gaveta}.${mercadoria}`,
        raw.production.escala, taxa, 'unidadesPorMinuto',
        taxaParaTicksPorUnidade(taxa, escalaDaProducao, tickHz),
      );
    }
  }
  const todos = [...Object.values(periodos.entra), ...Object.values(periodos.sai)];
  if (todos.length === 0) {
    throw new Error(`loadGameData: receita '${predioId}' nao declara nem entrada nem saida`);
  }
  const ticksDoCiclo = Math.max(...todos);
  const quantidades = (p: Record<string, Ticks>): Record<string, number> => {
    const q: Record<string, number> = {};
    for (const [mercadoria, periodo] of Object.entries(p)) {
      q[mercadoria] = Math.round(ticksDoCiclo / periodo);
    }
    return q;
  };
  receitas[predioId] = {
    ticksDoCiclo,
    entra: quantidades(periodos.entra),
    sai: quantidades(periodos.sai),
    rendimentoDoVeio: def.veio?.rendimento ?? null,
  };
}
```

> `escalaDaProducao` e `tickHz` são os mesmos valores que o trecho atual já
> calcula; mantenha os nomes locais que estiverem lá.

- [ ] **Passo 5: rodar até passar.**
      `npx vitest run tests/F15a-receita.test.ts` → PASSA.
      `npm run typecheck` → limpo. `capacidadeParaTipo` (`state.ts:499`) usa
      `tipoId in dados.producao.receitas`, que continua válido — **não mude essa
      linha**.

- [ ] **Passo 6: commit.**

```bash
git add data/production.json src/sim/data/ tests/F15a-receita.test.ts
git commit -m "feat(F15a): a receita de producao vira um ciclo com quantidades inteiras"
```

### Tarefa 2 — a regra de dado que congela o arredondamento

**Arquivos:**
- Modificar: `tools/data-rules.js`, `tools/data-rules.d.ts`, `tools/validate-data.js`
- Testar: `tests/F03-dados-validados.test.ts` (acrescentar), `npm run validate:data`

**Interfaces — Consome:** `dados.production`, `dados.time`, `dados.buildings`.
**Produz:** nada novo exportado — `validarProducao(dados, erros)` **já existe**
(`tools/data-rules.js:114`, com `producao/predio-inexistente` e
`producao/taxa-nao-positiva`) e ganha as verificações novas. A porta continua
sendo `validarTudo`, e o teste entra como **fixture** na tabela de
`tests/F03-dados-validados.test.ts`, no molde das outras: quebra uma cópia do
dado real e espera o id da regra.

**A regra mede sobre os TICKS, não sobre as taxas cruas.** Corrige o que eu tinha
escrito: a distorção que interessa é a que o **arredondamento em ticks** pode
introduzir, e ela depende da escala. Se alguém trocar `escalas.economia` por um
valor que faça uma receita perder a proporção, o dado ficou ruim de verdade e a
regra tem que acusar. Por isso ela replica a derivação do carregador.

- [ ] **Passo 1: escrever o teste que falha**, acrescentando a
      `tests/F03-dados-validados.test.ts`. Ele precisa provar que a regra
      **acusa**, não só que não acusa à toa (a lição da F14):

```ts
// tres fixtures novas na tabela existente
{ nome: 'bakery com razao que o arredondamento distorce', regraEsperada: 'producao/razao-distorcida',
  // 1.9 timber por 1 flour: a quantidade inteira vira 2, 5,3 % acima do declarado
  quebrar: (d) => { d.production.predios.bakery.sai.loaves = 1.9; } },
{ nome: 'veio com rendimento fracionario', regraEsperada: 'producao/veio-invalido',
  quebrar: (d) => { d.production.predios.quarry.veio.rendimento = 2.5; } },
{ nome: 'veio com rendimento zero', regraEsperada: 'producao/veio-invalido',
  quebrar: (d) => { d.production.predios.quarry.veio.rendimento = 0; } },
```

> A tabela de fixtures **já prova que a regra acusa** — é para isso que ela
> existe. O caso "aceita o dado de verdade" também já está coberto: o teste roda
> `validarTudo` no dado real e exige zero erro.

- [ ] **Passo 2: rodar e ver falhar.**
      `npx vitest run tests/F03-dados-validados.test.ts` → FALHA: as três
      fixtures quebram o dado e **nenhum erro é reportado**.

- [ ] **Passo 3: estender `validarProducao`** em `tools/data-rules.js`, na forma
      do arquivo (`erros.push('<id-da-regra>: <mensagem>')`):

```js
// F15a — o carregador deriva a receita em CICLO: periodo da taxa mais lenta, e
// quantidade = razao dos periodos, arredondada. A regra replica a derivacao e
// confere que a quantidade inteira ainda representa a proporcao DECLARADA nas
// taxas. Mede sobre TICKS de proposito: e o arredondamento em ticks que pode
// distorcer, e ele depende de `escalas.economia`.
const TOLERANCIA_DA_RAZAO = 0.02; // medido no dado atual: desvio 0,00 % nas 21 receitas

function periodoEmTicks(taxaPorMinuto, escala, tickHz) {
  return Math.round((60 * tickHz) / (taxaPorMinuto * escala));
}
```

      e, dentro do laço que já percorre `production.predios`:

```js
    const taxas = { ...((def && def.entra) || {}), ...((def && def.sai) || {}) };
    const positivas = Object.entries(taxas).filter(([, t]) => t > 0);
    if (positivas.length > 0 && escala > 0) {
      const periodos = positivas.map(([m, t]) => [m, periodoEmTicks(t, escala, tickHz)]);
      const ciclo = Math.max(...periodos.map(([, p]) => p));
      const menorTaxa = Math.min(...positivas.map(([, t]) => t));
      for (const [mercadoria, periodo] of periodos) {
        const inteira = Math.round(ciclo / periodo);
        const declarada = taxas[mercadoria] / menorTaxa;
        if (inteira < 1) {
          erros.push(`producao/quantidade-zero: production.predios.${id}.${mercadoria} rende 0 unidade por ciclo`);
        } else if (Math.abs(inteira - declarada) / declarada > TOLERANCIA_DA_RAZAO) {
          erros.push(
            `producao/razao-distorcida: production.predios.${id}.${mercadoria} vira ${inteira} por ciclo, `
            + `mas a taxa declara ${declarada.toFixed(3)} (tolerancia ${TOLERANCIA_DA_RAZAO * 100}%)`,
          );
        }
      }
    }
    const veio = def && def.veio;
    if (veio !== undefined && veio !== null) {
      const r = veio.rendimento;
      if (!Number.isInteger(r) || r < 1) {
        erros.push(`producao/veio-invalido: production.predios.${id}.veio.rendimento=${r} (inteiro >= 1)`);
      }
    }
```

- [ ] **Passo 4: rodar.** `npm run validate:data` → 0 erros no dado real.
      `npx vitest run tests/F03-dados-validados.test.ts` → PASSA, com as três
      fixtures acusando.
- [ ] **Passo 5: commit.**

```bash
git add tools/ tests/F03-dados-validados.test.ts
git commit -m "feat(F15a): validate:data recusa receita cuja razao o arredondamento distorce"
```

### Tarefa 3 — o campo `producao` no estado

**Arquivos:**
- Modificar: `src/sim/state.ts` (tipos, `GameEvent`, `producaoParaTipo` ao lado
  de `capacidadeParaTipo:494`, `completarObra:529`, `criarPredios`)
- Testar: `tests/F15a-producao.test.ts` (criar, primeira parte)

**Interfaces — Produz:**

```ts
export interface Producao {
  /** Ticks ja trabalhados no ciclo em curso, de 0 ate `ticksDoCiclo`. Igual a
   *  `ticksDoCiclo` significa CICLO PRONTO esperando caber na saida. */
  readonly progresso: number;
  /** Unidades de saida que o veio ainda rende. `null` = nao esgota. 0 = esgotado. */
  readonly veio: number | null;
}
// em PredioCompleto:  readonly producao: Producao | null;

// em GameEvent:
| { readonly type: 'goods-produced'; readonly predio: string; readonly mercadoria: string; readonly quantidade: number }
| { readonly type: 'vein-exhausted'; readonly predio: string; readonly tipo: string }
```

- [ ] **Passo 1: escrever o teste que falha:**

```ts
it('predio de producao nasce com relogio zerado e veio semeado do dado', () => {
  const quarry = completarObra(obraDe('quarry'));
  expect(quarry.producao).toEqual({
    progresso: 0, veio: gameData.producao.receitas.quarry?.rendimentoDoVeio,
  });
});

it('sawmill nasce sem veio; armazem e escola nascem sem producao', () => {
  expect(completarObra(obraDe('sawmill')).producao).toEqual({ progresso: 0, veio: null });
  const estado = createInitialState(1);
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p?.estado === 'completo') expect(p.producao).toBeNull(); // storehouse e schoolhouse
  }
});

it('producao e `null`, nunca `undefined` — o JSON tem que sobreviver', () => {
  const ida = createInitialState(1);
  expect(JSON.parse(JSON.stringify(ida))).toEqual(ida);
});
```

- [ ] **Passo 2: rodar e ver falhar.** FALHA: `producao` não existe.
- [ ] **Passo 3: implementar.** Ao lado de `capacidadeParaTipo` (`state.ts:494`),
      no mesmo molde:

```ts
/** F15a — o relogio de producao de um predio recem-nascido. `null` quando o
 *  tipo nao tem receita (armazem, escola): nao ha o que representar, e `null`
 *  em vez de `{ progresso: 0 }` mantem "nao produz" irrepresentavel como
 *  "produz parado". Mesmo molde de `ocupante` (F14). */
function producaoParaTipo(tipoId: string, dados: GameData): Producao | null {
  const receita = dados.producao.receitas[tipoId];
  return receita === undefined ? null : { progresso: 0, veio: receita.rendimentoDoVeio };
}
```

      Chamar em `completarObra` e em `criarPredios`, exatamente onde
      `capacidadeParaTipo` já é chamada.

- [ ] **Passo 4: consertar o fallout dos fixtures.** Todo literal de
      `PredioCompleto` nos testes precisa de `producao: null` (ou do valor certo
      para um produtor). `npm run typecheck` lista todos — é o mesmo fallout que
      `ocupante: null` causou na F14.
- [ ] **Passo 5: rodar.** `npx vitest run` → tudo verde. `npm run typecheck` → limpo.
- [ ] **Passo 6: commit.**

```bash
git add src/sim/state.ts tests/
git commit -m "feat(F15a): PredioCompleto.producao — o relogio do ciclo e o veio"
```

### Tarefa 4 — `sim/producao.ts`, as derivações puras

**Arquivos:**
- Criar: `src/sim/producao.ts`
- Testar: `tests/F15a-producao.test.ts` (segunda parte)

**Interfaces — Produz:**

```ts
export function receitaDoTipo(tipo: string, dados?: GameData): ReceitaDePredio | null;
/** Predio COMPLETO cujo tipo tem receita. Estreita a uniao, como `ehPredioOcupavel`. */
export function ehPredioProdutivo(predio: Predio | undefined, dados?: GameData): predio is PredioCompleto;
/** A gaveta `entrada` tem tudo que o ciclo consome? */
export function temInsumo(predio: PredioCompleto, receita: ReceitaDePredio): boolean;
/** Debita de `entrada` o que o ciclo consome. Pressupoe `temInsumo`. */
/* Na execucao o parametro `dados` caiu: debitar so precisa das chaves da receita. */
export function consumirInsumos(predio: PredioCompleto, receita: ReceitaDePredio): PredioCompleto;
/** O que o ciclo rende cabe na gaveta `saida`, respeitando `capacidade.saida`? */
export function cabeNaSaida(predio: PredioCompleto, receita: ReceitaDePredio): boolean;
/** Unidades de saida de UM ciclo (a soma de `sai`). */
export function unidadesPorCiclo(receita: ReceitaDePredio): number;
/** O veio nao rende mais um ciclo inteiro. `false` quando `veio === null`. */
export function veioEsgotado(producao: Producao, receita: ReceitaDePredio): boolean;
```

- [ ] **Passo 1: escrever os testes que falham** — um por função, com o caso de
      borda que importa:

```ts
it('temInsumo exige TODAS as mercadorias da receita, nao uma', () => {
  const m = produtor('metallurgists', { entrada: { gold_ore: 1 } });
  expect(temInsumo(m, receita('metallurgists'))).toBe(false); // falta coal
});

it('consumirInsumos debita so o que o ciclo pede e nao toca na saida', () => {
  const s = consumirInsumos(produtor('sawmill', { entrada: { tree_trunk: 3 } }), receita('sawmill'));
  expect(s.estoque.entrada.tree_trunk).toBe(2);
  expect(s.estoque.saida).toEqual({});
});

it('cabeNaSaida respeita a capacidade da GAVETA, nao o total do predio', () => {
  // capacidade.saida = 5, ciclo da sawmill rende 2
  expect(cabeNaSaida(produtor('sawmill', { saida: { timber: 4 } }), receita('sawmill'))).toBe(false);
  expect(cabeNaSaida(produtor('sawmill', { saida: { timber: 3 } }), receita('sawmill'))).toBe(true);
});

it('veioEsgotado e falso para receita renovavel, mesmo com o relogio cheio', () => {
  expect(veioEsgotado({ progresso: 999, veio: null }, receita('sawmill'))).toBe(false);
});

it('veioEsgotado ja e verdade quando o veio nao rende um CICLO inteiro', () => {
  const r = { ...receita('quarry'), sai: { stone: 2 } };
  expect(veioEsgotado({ progresso: 0, veio: 1 }, r)).toBe(true);
});
```

- [ ] **Passo 2: rodar e ver falhar.** FALHA: módulo não existe.
- [ ] **Passo 3: implementar `src/sim/producao.ts`.** Zero import de `jobs.ts`
      (é o que permite `especialistas.ts` importar os dois sem ciclo). A iteração
      de mercadoria usa as chaves da **receita** (fixas no carregamento) ou
      `dados.economia.mercadorias`, nunca `Object.keys` de estoque vindo do save.
- [ ] **Passo 4: rodar até passar.** `npx vitest run tests/F15a-producao.test.ts`.
- [ ] **Passo 5: commit.**

```bash
git add src/sim/producao.ts tests/F15a-producao.test.ts
git commit -m "feat(F15a): sim/producao.ts — as derivacoes puras do ciclo"
```

### Tarefa 5 — a FSM produz

**Arquivos:**
- Modificar: `src/sim/systems/especialistas.ts:112-128`
- Testar: `tests/F15a-producao.test.ts` (terceira parte),
  `tests/helpers/producao-cenario.ts` (criar)

**Interfaces — Consome:** tudo da Tarefa 4, mais `predioLigadoAoArmazem`
(`sim/estradas.ts`) e `predioDoOcupante` (`sim/ocupacao.ts`).

A FSM inteira passa a ser, conforme o GDD §6.2:

```
ocioso -> indo_ocupar -> trabalhando  <->  esperando_insumo
                              ^
                              +--------->  saida_cheia
```

Os três estados de produção compartilham **um** handler: o rótulo é recalculado
do prédio a cada tick, então não existe estado da FSM que discorde do estado do
prédio (a mesma razão pela qual a posse mora só no prédio, F14).

- [ ] **Passo 1: escrever os testes que falham.** Um por regra, cada um com o
      tick exato — nada de "depois de um tempo":

```ts
it('pedreira ocupada e ligada deposita 1 stone a cada 167 ticks', () => {
  let s = cenarioDePedreira();               // quarry completa, ocupada, com estrada ate o armazem
  s = avancar(s, 166);
  expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
  s = avancar(s, 1);
  expect(saidaDe(s, 'q1').stone).toBe(1);    // tick 167
  s = avancar(s, 167);
  expect(saidaDe(s, 'q1').stone).toBe(2);    // tick 334, intervalo EXATO
});

it('predio sem ocupante nao produz (Nota da F14)', () => {
  const s = avancar(semOcupante(cenarioDePedreira()), 400);
  expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
});

it('predio sem ligacao ao armazem nao produz e fica em `saida_cheia`', () => {
  const s = avancar(semEstrada(cenarioDePedreira()), 400);
  expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
  expect(progressoDe(s, 'q1')).toBe(0);        // o relogio nem comeca
  expect(fsmDe(s, 'u1')).toBe('saida_cheia');  // D6: nao escoa, GDD §5.1 + §6.2
});

it('saida cheia: para em `saida_cheia` e NAO perde o ciclo pronto', () => {
  const s = avancar(cenarioDePedreira(), 167 * 6);
  expect(saidaDe(s, 'q1').stone).toBe(5);                   // o teto da gaveta
  expect(fsmDe(s, 'u1')).toBe('saida_cheia');
  expect(progressoDe(s, 'q1')).toBe(167);                   // pronto, so nao coube
  const depois = avancar(comEspacoNaSaida(s), 1);
  expect(saidaDe(depois, 'q1').stone).toBe(5);              // depositou no tick seguinte
  expect(fsmDe(depois, 'u1')).toBe('trabalhando');
});

it('sawmill sem tronco fica em `esperando_insumo` e nao gasta relogio', () => {
  const s = avancar(cenarioDeSerraria(), 300);
  expect(fsmDe(s, 'u2')).toBe('esperando_insumo');
  expect(progressoDe(s, 's1')).toBe(0);
});

it('sawmill com 1 tronco consome 1 e rende 2 timber em 273 ticks', () => {
  let s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 1 });
  s = avancar(s, 1);
  expect(entradaDe(s, 's1').tree_trunk).toBe(0);            // cobrado no INICIO do ciclo
  s = avancar(s, 272);
  expect(saidaDe(s, 's1').timber).toBe(2);
});

it('veio esgota: evento no tick exato, e depois a pedreira nao produz mais', () => {
  const dadosCurtos = comRendimento(gameData, 'quarry', 2);  // 2 pedras e acabou
  expect(eventosNoTick(cenarioDePedreira(), 334, dadosCurtos)).toContainEqual(
    { type: 'vein-exhausted', predio: 'q1', tipo: 'quarry' },
  );
  const s = avancar(cenarioDePedreira(), 167 * 5, dadosCurtos);
  expect(saidaDe(s, 'q1').stone).toBe(2);
  expect(veioDe(s, 'q1')).toBe(0);
  expect(fsmDe(s, 'u1')).toBe('esperando_insumo');
});
```

> O último teste injeta um `GameData` com rendimento 2 **pelo parâmetro `dados`**
> que toda função de `sim/` já aceita. Não se fabrica estado de veio por fixture
> e não se muda `data/production.json` para o teste passar: o caminho é o dado de
> verdade, com outro número.

- [ ] **Passo 2: rodar e ver falhar.** FALHA: hoje `passoTrabalhando` só checa a
      posse e devolve o estado intacto.
- [ ] **Passo 3: implementar.** Substituir `passoTrabalhando` por:

```ts
/** Devolve o MESMO estado quando o rotulo nao muda: um tick de producao normal
 *  nao realoca a unidade. Molde de `sanearOcupacao`. */
function comFsm(state: GameState, u: Unidade, fsm: string): Passo {
  return u.fsm === fsm ? semEventos(state) : semEventos(comUnidade(state, { ...u, fsm, fsmData: {} }));
}

/**
 * O ciclo de producao (F15a), um tick. Quem o avanca e o OCUPANTE: predio sem
 * ocupante nao produz (Nota da F14) e "um predio, um ocupante" (F14) torna
 * avanco duplo irrepresentavel.
 *
 * O rotulo da FSM e RECALCULADO do predio a cada tick — nao existe
 * `esperando_insumo` gravado que discorde do estoque de verdade.
 */
function produzir(state: GameState, u: Unidade, predio: PredioCompleto, dados: GameData): Passo {
  const receita = receitaDoTipo(predio.tipo, dados);
  const prod = predio.producao;
  // predio ocupavel sem receita nao existe no dado de hoje; se existir, ocupa e nao produz
  if (receita === null || prod === null) return comFsm(state, u, 'trabalhando');
  // GDD §5.1: a estrada e requisito de FUNCIONAMENTO. Predio que nao ESCOA e
  // `saida_cheia` (GDD §6.2, "a logistica e o gargalo") — sem estrada o
  // escoamento e impossivel, o caso extremo do mesmo fenomeno. Ver D6.
  if (!predioLigadoAoArmazem(state, predio, dados)) return comFsm(state, u, 'saida_cheia');
  // ciclo PRONTO de um tick anterior: so falta caber
  if (prod.progresso >= receita.ticksDoCiclo) return depositar(state, u, predio, receita, dados);
  // o veio e o insumo que nao vem mais (D2) — a F22 distingue pelo `veio === 0`
  if (veioEsgotado(prod, receita)) return comFsm(state, u, 'esperando_insumo');
  // inicio de ciclo: cobra os insumos, como a escola cobra o ouro ao iniciar o treino (F13a)
  let atual = predio;
  if (prod.progresso === 0) {
    if (!temInsumo(predio, receita)) return comFsm(state, u, 'esperando_insumo');
    atual = consumirInsumos(predio, receita, dados);
  }
  const avancado: PredioCompleto = {
    ...atual, producao: { progresso: prod.progresso + 1, veio: prod.veio },
  };
  const comRelogio = comPredio(state, avancado);
  return prod.progresso + 1 < receita.ticksDoCiclo
    ? comFsm(comRelogio, u, 'trabalhando')
    : depositar(comRelogio, u, avancado, receita, dados);
}
```

      e `depositar`, que é o único ponto que mexe em `saida` e no veio:

```ts
function depositar(
  state: GameState, u: Unidade, predio: PredioCompleto, receita: ReceitaDePredio, dados: GameData,
): Passo {
  if (!cabeNaSaida(predio, receita)) return comFsm(state, u, 'saida_cheia');
  const saida = { ...predio.estoque.saida };
  const events: GameEvent[] = [];
  // ordem de `economia.mercadorias`, nunca `Object.keys` (contrato da F05a)
  for (const m of dados.economia.mercadorias) {
    const q = receita.sai[m];
    if (q === undefined) continue;
    saida[m] = (saida[m] ?? 0) + q;
    events.push({ type: 'goods-produced', predio: predio.id, mercadoria: m, quantidade: q });
  }
  const veioAntes = predio.producao?.veio ?? null;
  const veio = veioAntes === null ? null : veioAntes - unidadesPorCiclo(receita);
  const depositado: PredioCompleto = {
    ...predio, estoque: { ...predio.estoque, saida }, producao: { progresso: 0, veio },
  };
  if (veio !== null && veioEsgotado({ progresso: 0, veio }, receita)) {
    events.push({ type: 'vein-exhausted', predio: predio.id, tipo: predio.tipo });
  }
  return {
    state: comUnidade(comPredio(state, depositado), { ...u, fsm: 'trabalhando', fsmData: {} }),
    events,
  };
}
```

      E no `switch` de `passoDoEspecialista`, os três rótulos caem no mesmo ramo:

```ts
case 'trabalhando':
case 'esperando_insumo':
case 'saida_cheia': {
  const predio = predioDoOcupante(state, u.id);
  return predio === null ? ficarOcioso(state, u) : produzir(state, u, predio, dados);
}
```

      O `default` que lança continua — um `fsm` fora do GDD §6.2 é save corrompido.
      Atualize também o cabeçalho do arquivo: a frase "sao de PRODUCAO e nascem
      na F15" descreve o que agora existe.

- [ ] **Passo 4: rodar até passar.** `npx vitest run tests/F15a-producao.test.ts`.
- [ ] **Passo 5: rodar a suíte inteira.** `npx vitest run`. O teste de
      determinismo tem que continuar verde: o campo novo entra no JSON e a
      comparação byte a byte o cobre de graça.
- [ ] **Passo 6: commit.**

```bash
git add src/sim/systems/especialistas.ts tests/
git commit -m "feat(F15a): o especialista produz — trabalhando, esperando_insumo e saida_cheia"
```

### Tarefa 6 — o aceite da F15a e a evidência

**Arquivos:**
- Criar: `tests/F15a-aceite.test.ts`
- Modificar: `tools/sim.js` (cenário `producao`), `test-results.json`,
  `PROGRESS.md`

- [ ] **Passo 1: escrever o cenário e o aceite.** O caminho tem que ser o real,
      ponta a ponta, como a F14 exigiu: `PlaceBlueprint` de verdade, obra levada
      a `'completo'` por `step()`, especialista **treinado na escola** com ouro
      atravessando a estrada no ombro de um serf. Nada de `PredioCompleto`
      fabricado por fixture. (Estradas por fixture continuam sendo o combinado —
      `PlaceRoad` debita pedra e amarraria o aceite ao preço da estrada.)

```ts
it('F15a — 1000 ticks: a pedreira produz sem o especialista nunca ficar ocioso', () => {
  const r = rodar(cenarioDeProducao(), 1000);
  expect(r.stoneNaSaida).toBe(5);               // o teto da gaveta, sem transporte ainda
  expect(r.serieDeStone).toEqual(crescenteDe1Em1());
  expect(r.ticksEmOcioso.stonemason).toBe(0);
  expect(r.ticksEmEsperandoInsumo.stonemason).toBe(0);
  expect(r.violacoes).toEqual([]);              // invariantes do JobBoard, tick a tick
});
```

- [ ] **Passo 2: rodar e ver falhar**, depois fazer passar.
- [ ] **Passo 3: gravar `test-output/F15a.json`** pelo helper de evidência das
      features anteriores, com: a série de `estoque.saida.stone` por tick, o tick
      de cada `goods-produced`, o histograma de `fsm` por tick e por unidade, e
      `violacoes: []`.
- [ ] **Passo 4: ABRIR `test-output/F15a.json` com a ferramenta Read** e conferir
      cada número contra o critério. Sem isso a feature não fecha (CLAUDE.md §7 e
      §8) — e o hook recusa a escrita em `test-results.json`.
- [ ] **Passo 5: acrescentar o cenário a `tools/sim.js`** (`CENARIOS.producao`),
      para que `npm run sim -- producao --ticks 1000` reproduza a corrida fora do
      teste.
- [ ] **Passo 6: não-regressão visual, por CÓDIGO DE SAÍDA, sem abrir imagem.**
      `npm run shot -- F11c` e `npm run shot -- F13b` têm que sair 0. Nenhuma
      linha de `render/` foi tocada; o que se verifica é que a tela ainda sobe
      com o campo novo no estado. **Não abra as imagens com Read** — imagem só da
      feature atual, e esta não tem.
- [ ] **Passo 7: `npm run verify`** (typecheck + lint + validate:data + test) →
      exit 0, criando o selo de 15 minutos.
- [ ] **Passo 8: virar a chave** `F15a-producao-ciclo` para `true` em
      `test-results.json`.
- [ ] **Passo 9: atualizar o `PROGRESS.md`** — seção `## F15a`, separando o que
      foi **verificado** (arquivo aberto, comando rodado) do que é **hipótese**.
      A projeção aritmética da seção 0 deste plano entra como **hipótese
      nomeada**, não como fato: ela vira fato na F15b, com a corrida medida.
      As perguntas da seção 8 que o operador não tiver respondido vão para
      `## Perguntas em aberto`.
- [ ] **Passo 10: commit.**

```bash
git add tests/ test-output/F15a.json test-results.json tools/sim.js PROGRESS.md
git commit -m "feat(F15a): o aceite do ciclo de producao e a evidencia"
```

---

## 5. Decisões, para copiar ao `PROGRESS.md` e às Notas do `BUILD_PLAN.md`

- **D1 — a receita é um CICLO, derivado no carregamento.** Ciclo = o período mais
  lento; quantidades = razão dos períodos, `Math.round` uma vez só. Alternativa
  recusada: guardar ticks-por-unidade por mercadoria, que exigiria um relógio por
  mercadoria dentro do `GameState`. O modelo do ciclo reproduz as sete proporções
  que o GDD escreve em palavras, em 21 de 21 receitas, com erro máximo de 0,5 %.
- **D2 — o veio mora no prédio** (`producao.veio`), semeado do dado no instante
  da conclusão. Não há camada de terreno na sim e nenhuma feature antes da F17 a
  produz. **A F21 herda o campo, o decremento, o estado terminal e o evento; só o
  inicializador muda.**
- **D3 — o nível 6 dispara com estoque > 0 na `saida`, não com a gaveta cheia.**
  Esperar encher faria de `saida_cheia` o regime permanente, e o GDD §6.2 o
  descreve como sinal de gargalo.
- **D4 — as duas distorções do HUD se resolvem na escada, não na tela.** A pedra
  na saída da Quarry não é distorção (limitada a 5, drenada pelo nível 6, e é
  pedra que o jogador não pode gastar). O ouro parado na entrada da escola volta
  pelo nível 7. Zero linha de `render/`/`ui/` — e por isso a F15 **não** precisa
  da nota de feature de integração da §10.
- **D5 — a produção é avançada pelo OCUPANTE, não por um sistema novo.** O GDD
  §6.2 põe os dois estados na FSM do especialista; prédio sem ocupante não produz;
  "um prédio, um ocupante" torna avanço duplo irrepresentável. Nenhuma mudança na
  ordem do `step()`.
- **D6 — prédio sem estrada congela o relógio e fica em `saida_cheia`.**
  *(Decidido pelo operador, 2026-09-22, corrigindo a minha proposta: eu tinha
  escrito `trabalhando`.)* Prédio que **não escoa** é exatamente o que o GDD §6.2
  descreve por `saida_cheia` — "a logística é o gargalo" — e sem estrada o
  escoamento é impossível: é o caso extremo do mesmo fenômeno, não um caso novo.
  Isso é melhor que `trabalhando` porque o rótulo passa a dizer a verdade sobre o
  prédio, sem nenhum estado de FSM fora da lista do GDD §6.2. A causa continua
  distinguível sem estado novo (`predioLigadoAoArmazem === false` separa "sem
  estrada" de "gaveta cheia de verdade"), que é o que os alertas da F22 leem.
- **D7 — `modos` do Woodcutter's (`cortar`/`replantar`/`ambos`) continua sem
  leitor.** A F15 não faz árvore acabar: o lenhador replanta, e por isso
  `rendimentoDoVeio` dele é `null`. Escolher modo é comando de prédio (GDD §2.3),
  que é F16. Registrado para não parecer esquecimento.

---

## 6. Esboço da F15b (plano próprio, depois da F15a)

Registrado aqui para que o corte seja auditável, **não** para ser executado agora.

1. **`TarefaSaidaParaArmazem`** (`tipo: 'saida-cheia-para-armazem'`, nível 6) e
   **`TarefaExcedenteParaArmazem`** (`tipo: 'excedente-para-armazem'`, nível 7):
   mesma forma das tarefas de carga, com a origem invertida — origem é o
   **produtor** (gaveta `saida`) ou o prédio com excedente (gaveta `entrada`),
   destino é o **armazém**.
2. **O que já é genérico e não muda:** `planoDaTarefa`, `portasDeColeta`,
   `distanciaDaTarefa`, `custoDaTarefa`, `disponivelNaOrigem` (verificado: só pede
   `estado === 'completo'`, não pede armazém) e `passoCarregando`.
3. **Os quatro pontos que hoje assumem "origem é armazém" e precisam do ramo
   novo:** `motivoIndividual` e `abertaVale` (`systems/jobs.ts`), `origemMaisPerto`
   (que varre `armazensCompletos`) e `demandaNoDestino`/`vagaDoDestino`
   (`reservas.ts`), cuja demanda num armazém é a vaga da gaveta
   (`capacidade.saida === null` = sem limite).
4. **A entrega:** `passoEntregando` ganha o ramo "destino é armazém" — que já
   existe, em `passoDevolvendo`, e pode ser extraído para os dois usarem.
5. **O helper de invariante** `tests/helpers/jobs-invariantes.ts` ganha os dois
   tipos no `switch` exaustivo do destino (destino = armazém completo), **e** um
   teste que prova que ele **acusa** destino errado para cada um — a lição da
   F14, que é cobertura contínua e não probe de sessão.
6. **O cenário de 3000 ticks** com 2 Woodcutter's : 1 Sawmill : 1 Quarry, os
   números medidos, e a comparação com a projeção da seção 0 deste plano.
7. **O `X` do critério de aceite** ("nenhum trabalhador em `ocioso` por mais de X
   ticks") precisa virar número **do dado**, não digitado em `.ts`. Candidato:
   `delivery.alertaTarefaSemCandidato_segundos` (30 s → 300 ticks), que é o
   próprio limiar que o dado declara para "isto está parado tempo demais". E
   "trabalhador" precisa ser lido como **especialista**: serf entre tarefas passa
   por `ocioso` legitimamente. **As duas leituras vão ao operador antes da F15b.**

---

## 7. Auto-revisão

- **Cobertura do spec.** Escopo do item F15 — ciclo por tempo (T1, T5), saída
  depositada no prédio (T5), tarefa de transporte ao armazém (F15b §6.1), Quarry
  esgota o veio (T1, T3, T5). Aceite de 3000 ticks → F15b, intacto. As quatro
  Notas: "sem ocupante não produz" (T5), "sem estrada não produz" (T5/D6), HUD
  (D4), escada/nível por id (D3 + F15b). Nenhum requisito sem tarefa.
- **Consistência de nomes.** `ReceitaDePredio.ticksDoCiclo`/`entra`/`sai`/
  `rendimentoDoVeio`; `Producao.progresso`/`veio`; `receitaDoTipo`,
  `ehPredioProdutivo`, `temInsumo`, `consumirInsumos`, `cabeNaSaida`,
  `unidadesPorCiclo`, `veioEsgotado`, `producaoParaTipo`, `produzir`,
  `depositar`, `comFsm`. Os mesmos nomes nas Tarefas 3, 4 e 5.
- **Sem placeholder.** Todo passo tem comando ou código. Os números 167, 545,
  273 e 136 são medidos, não estimados.
- **Ponto frágil declarado:** os helpers de teste (`cenarioDePedreira`,
  `comRendimento`, `avancar`, `saidaDe`, `progressoDe`, `fsmDe`, `veioDe`,
  `eventosNoTick`) nascem em `tests/helpers/producao-cenario.ts` na Tarefa 5,
  passo 1 — escrevê-los é o primeiro trabalho daquele passo, não um detalhe
  adiado.

---

## 8. As quatro respostas do operador (2026-09-22)

Não são perguntas em aberto: são decisões dele, com o porquê que ele deu.

1. **Corte aprovado, pela CAMADA e não pelo tema.** F15a = produção e veio (o
   prédio produz na gaveta `saida`, o veio esgota). F15b = entrega ao armazém
   (níveis 6 e 7) e o cenário longo de calibração. **A calibração não fica de fora
   da Fase A** — ela é o que prova que o jogo tem ritmo, e o aceite da F17 depende
   dela.
2. **`rendimento: 200` aprovado como ponto de partida, em `data/`.** São ~55 min
   de produção contínua na escala 2.0 — quase uma partida inteira de uma Quarry,
   o que casa com o original, onde se constroem várias e elas se esgotam.
   **Registrado como número a calibrar na F15b** (`BALANCE_LOG.md` + Nota no item
   F15b).
3. **D6 aprovado, com a razão dele, que é melhor que a minha:** prédio que não
   escoa é **`saida_cheia`**, que o GDD §6.2 já prevê. Sem estado novo.
4. **D4(b): fica o nível 7.** O vazamento se resolve na origem e o HUD continua
   com uma regra só — conta armazéns. Sem nota de integração, sem tocar na tela.
