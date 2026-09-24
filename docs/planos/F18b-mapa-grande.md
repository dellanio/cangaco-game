# F18b — Mapa padrão maior (128×128)

> **Para quem executa:** este plano é para execução INLINE, tarefa a tarefa, na
> sessão que o escreveu. **Não** use `subagent-driven-development` nem
> `dispatching-parallel-agents` (CLAUDE.md §11). Os passos usam `- [ ]`.

**Objetivo:** o mapa padrão passa de 64×64 a 128×128 — quatro vezes a área
jogável — sem que nada além de `data/terrain.json` precise mudar de valor, e com
prova de que nada no jogo escala com a área do mapa.

**Arquitetura:** o tamanho do mapa já é dado (`terrain.mapaPadrao`), lido por
`src/sim/{placement,selectors,estradas,pathfinding}.ts` e pelo funil
`src/render/mapa.ts`. A feature é, em essência, **uma linha de dado** — e o
trabalho real é (a) destravar o único teste que presumia o valor antigo,
(b) deixar um guarda permanente de que o valor é dado e não presunção, e
(c) provar por medida e por tela que o mapa novo é jogável.

**Fila:** entra como **F18b**, logo depois da F18a e antes da F18 (Farm). A letra
segue a convenção da F17b–F17f: não é subdivisão da F18, é "depois da F18a, ainda
na Fase B". O item dependia da F17c (buffer do A*) e da F18a (zoom) — as duas
fechadas.

**Planos de referência:** `docs/planos/F17c-buffer-do-astar.md` (de onde vinha o
custo), `docs/planos/F18a-zoom-da-camera.md` (a navegação).

## Restrições globais

- `src/sim/` sem `phaser`, sem `window`/`document`/`performance`, sem
  `Math.random()`/`Date.now()`.
- Número de balanceamento vive em `data/*.json`. Esta feature **muda um número
  de dado e nenhum número de código**.
- `npm run verify` verde antes de escrever `test-results.json` (hook, selo de
  15 minutos).
- Não tocar `src/render/` e `src/sim/` na mesma feature — aqui **nenhum dos
  dois muda**: a feature é `data/` + `tests/` + `tools/`.

---

## As três perguntas do operador, respondidas antes do código

### 1. A medida, refeita depois da F17c

Probe de sessão (arquivo temporário, já apagado; **não é cobertura permanente**),
cenário com seis obras ligadas ao armazém por rua de verdade, 48 tarefas
abertas, duas passadas para não medir compilação, ordem dos tamanhos invertida
para não medir ordem de JIT:

| medida | 64² | 128² | 256² |
|---|---|---|---|
| busca curta A* (3 tiles), cache de par frio | 2,7 µs | 3,5 µs | 2,6 µs |
| cardápio de um serf (`reclamarMelhor`, 48 tarefas, cache frio) | 0,17 ms | 0,17 ms | 0,22 ms |
| `JSON.stringify(estado)` | 2,5 KB | 2,5 KB | 2,5 KB |
| `step()` completo | 0,80 ms | 0,65 ms | 0,79 ms |
| rascunho do A* (uma vez, cresce e não encolhe) | 64 KB | 256 KB | 1024 KB |
| tiles desenhados por quadro (zoom 0,5 / 1 / 2) | 875 / 234 / 88 | 875 / 234 / 88 | — |

**Linha de base registrada na Nota da F17c, antes da correção:** busca curta
40 / 94 / 303 µs (7,6×) e cardápio do serf ocioso 1,58 ms a 64² contra
**6,03 ms a 256²** — "dez serfs ociosos comeriam 60 ms de um tick de 100 ms".

Depois da F17c: o crescimento sumiu. O que resta a 256² é 1,3× no cardápio
(0,17 → 0,22 ms), não 3,8×; dez serfs ociosos custam 2,2 ms de um tick de 100 ms.
O custo de render é **idêntico** — 875/234/88 tiles por nível de zoom a 64² e a
128², medido pelo roteiro da F18a rodando nos dois tamanhos.

> Correção de um número herdado: a Nota da F17c diz `JSON.stringify(estado)` =
> 29 KB nos três tamanhos. O estado **inicial** mede 1,4 KB, e o cenário de seis
> obras mede 2,5 KB. Os 29 KB são de um cenário mais adiantado. O que a nota
> afirmava — que o tamanho **não varia com a área do mapa** — continua certo, e é
> o que importa: `GameState` não guarda tile.

### 2. O tamanho: 128×128, e por quê

- **A campanha quer duas cidades com espaço para explorar.** A vila da F17
  ocupou dez tiles de footprint; uma cidade completa (28 tipos de prédio, campos
  e ruas) cabe com folga em 40×40. Duas delas mais a separação dão ~110 tiles de
  lado. 128² comporta; 256² deixaria ~170 tiles de grama que nada preenche antes
  da F28.
- **Navegação.** No zoom mínimo (0,5) o quadro mostra 875 tiles: 5,3% de um 128²
  contra 1,3% de um 256². Atravessar um 256² de ponta a ponta no zoom mínimo são
  sete telas por eixo. A F18a deu zoom para navegar 64²; ela não torna 256²
  confortável.
- **Custo não é argumento** (é o que a tabela acima mostra): nenhuma das cinco
  medidas escala com a área. A única que cresce é o rascunho do A*, uma alocação
  só, e mesmo a 256² é 1 MB.
- **128 = 2 × 64.** O centro do mapa vai de (32,32) a (64,64): o deslocamento é
  exatamente +32 em cada eixo. Isso torna a F18c (abaixo) uma translação uniforme
  em vez de um recálculo caso a caso.

### 3. Onde a vila nasce

**Decisão: a vila nasce onde já nasce** — `storehouse` em (29,30) e
`schoolhouse` em (34,30), `spawnDeUnidades` em (30,34), tudo intocado em
`data/economy.json`. O mapa cresce para o sul e o leste.

O argumento, e o custo da alternativa, medidos e não supostos:

- No 128² isso põe a vila no **quadrante noroeste**, com 29 tiles de folga a
  oeste e 30 ao norte — mais do que a vila inteira da F17 (dez tiles) — e deixa o
  quadrante sudeste, ~98×97 tiles, livre para a segunda cidade que a campanha
  prevê. Um mapa de campanha com a cidade do jogador a noroeste e a outra a
  sudeste é desenho de mapa, não acidente.
- A câmera **já abre centrada na vila** (`centroDaVila`), então o jogador não vê
  a vila "no canto": vê a vila no meio da tela e mais terra a sudeste.
- **Centralizar hoje custa uma feature inteira, e o custo foi contado:** a
  posição absoluta da vila está escrita à mão em ~20 arquivos de fixture de teste
  e em 15 roteiros de screenshot (~64 literais de coordenada vizinhos à vila,
  dentro de 508 literais de tile em `tests/`), e há ~100 chamadas diretas de
  `createInitialState(1)` que herdariam a posição nova.
- O defeito real não é a posição da vila: é que **as fixtures dependem da
  coordenada absoluta em vez de derivá-la do armazém**. Isso volta a doer a cada
  mudança de mapa. Está escrito como **F18c** na fila, com esse nome, e mover a
  vila para o centro é a *prova* de que a fixture parou de depender.

---

## Estrutura de arquivos

- **Muda:** `data/terrain.json` — `mapaPadrao` 64 → 128 (e um `_doc` explica por
  que 128 e não 256).
- **Muda:** `tests/F10-astar.test.ts` — o oráculo e o sorteio passam a
  **declarar** o mapa em que trabalham, em vez de herdar o mapa publicado.
  Nenhuma asserção, nenhuma regra do oráculo e nenhum caso mudam.
- **Muda:** `tests/F04-grid-ortogonal.test.ts` — o pin do valor publicado
  (`toEqual({largura:64,altura:64})`) acompanha o dado, como o pin de `tilePx`
  na linha de cima.
- **Cria:** `tests/F18b-mapa.test.ts` — o guarda permanente e a evidência.
- **Cria:** `tools/shots/F18b.js` — o roteiro do aceite visual.
- **Muda:** `BUILD_PLAN.md` (item F18b + item F18c), `PROGRESS.md`,
  `test-results.json`.

**Nada em `src/`.**

---

## Tarefa 1 — Destravar o oráculo da F10 (o travamento, sondado antes)

A sonda já foi feita: com `mapaPadrao` em 128×128, `npm run verify` reprova em
**dois** lugares, e um deles é `tests/F10-astar.test.ts`, que **estoura o timeout
de 5 s** em `modo livre, semente 1`.

**Por que trava, lido no arquivo, não suposto:** a linha 25 é
`const { largura, altura } = gameData.terreno.mapaPadrao;` e
`tileLivreSorteado` (linha 116) sorteia `gx` em `[0, largura)`. Com 128², origem
e alvo passam a cair a 100+ tiles de distância, e o oráculo — relaxamento em fila
com `Array.shift()` e `Map<string,number>`, de propósito burro para ser
independente — inunda 16 384 células em vez de 4 096, em 40 mapas × 4 sementes.

**Por que isto NÃO é "mudar o teste para o verde passar" (§10), e por que é
reportado mesmo assim:** a Nota da F17c diz que `tests/F10-astar.test.ts` **não
muda**, e que se precisar mudar é para parar e reportar. A nota protege o
**oráculo**: as regras, as asserções, os casos. O que muda aqui é só **o tamanho
do mapa que a fixture sorteia** — que a fixture já presumia ser 64, porque ela
espalha prédio na faixa `4 + sorteio(52)`, ou seja `[4,55]`. O oráculo, os
`expect`, as sementes e a contagem de casos ficam iguais. **Isto vai escrito no
relatório final e no `PROGRESS.md` como desvio consciente da Nota da F17c, não
como detalhe.**

- [ ] **Passo 1: confirmar o estado de partida, antes de tocar em nada**

```bash
npx vitest run tests/F10-astar.test.ts
```
Esperado **antes** da mudança de dado: verde (mapa ainda é 64²). Guarde o tempo
total impresso — ele é a linha de base do passo 4.

- [ ] **Passo 2: declarar o mapa da fixture**

Em `tests/F10-astar.test.ts`, trocar a linha 25 por um tamanho **declarado**,
com o motivo escrito:

```ts
/**
 * O mapa em que esta propriedade e provada, DECLARADO — nao herdado de
 * `terrain.mapaPadrao`. A fixture sempre presumiu 64: `mapaSorteado` espalha
 * predio em `4 + sorteio(52)`, a faixa [4,55]. Herdar o valor publicado fazia o
 * oraculo (relaxamento em fila, de proposito burro) inundar a area inteira do
 * mapa novo — a 128x128 ele estoura o timeout de 5 s sem que nada do A* tenha
 * mudado. O que se prova aqui e o CUSTO do A* contra um segundo algoritmo, e
 * isso nao depende de quantos tiles vazios existem alem da faixa sorteada.
 */
const LADO_DO_MAPA_DA_PROPRIEDADE = 64;
const largura = LADO_DO_MAPA_DA_PROPRIEDADE;
const altura = LADO_DO_MAPA_DA_PROPRIEDADE;
const DADOS_DA_PROPRIEDADE: GameData = {
  ...gameData,
  terreno: { ...gameData.terreno, mapaPadrao: { largura, altura } },
};
```

- [ ] **Passo 3: o A* e o oráculo olham o MESMO mapa**

Nos `it.each` de propriedade (os que chamam `custoDoOraculo`), passar
`DADOS_DA_PROPRIEDADE` nos dois lados da comparação:

```ts
const esperado = custoDoOraculo(estado, de, alvos, 'livre', DADOS_DA_PROPRIEDADE);
const achado = buscarCaminho(estado, de, alvos, 'livre', DADOS_DA_PROPRIEDADE);
```

Isto é obrigatório, não cosmético: se o oráculo parar em 64 e o A* enxergar 128,
um desvio por fora da faixa existiria só para um dos dois, e a propriedade
acusaria uma divergência que não existe.

Conferir, com `grep -n "custoDoOraculo(" tests/F10-astar.test.ts`, que **todo**
sítio de comparação recebe o mesmo `dados` nos dois lados. Os demais
`buscarCaminho` do arquivo (cenários fixos pequenos, junto da vila) **não
mudam**: eles não comparam com o oráculo e não dependem da borda.

- [ ] **Passo 4: rodar com o dado ainda em 64² — tem de continuar verde**

```bash
npx vitest run tests/F10-astar.test.ts
```
Esperado: PASS, mesmo número de testes, tempo igual ao do passo 1. É isso que
prova que a mudança é neutra: com `mapaPadrao` ainda em 64, declarar 64 não muda
nada.

- [ ] **Passo 5: commit**

```bash
git add tests/F10-astar.test.ts
git commit -m "test(F18b): o oraculo do A* declara o mapa em que prova, em vez de herdar"
```

---

## Tarefa 2 — O dado muda

- [ ] **Passo 1: `data/terrain.json`**

Trocar `"mapaPadrao": { "largura": 64, "altura": 64 }` por `128`/`128`, e
acrescentar, ao lado, o `_doc` que registra a escolha (o arquivo já usa `_doc`
no bloco `zoom`):

```json
  "mapaPadrao": { "largura": 128, "altura": 128 },
  "_docMapaPadrao": "128 e nao 256: uma cidade completa cabe em 40x40, a campanha quer duas com espaco entre elas (~110 tiles de lado), e no zoom minimo o quadro mostra 875 tiles — 5,3% de um 128x128 contra 1,3% de um 256x256. Custo nao foi criterio: medido em 2026-09-23, depois da F17c, nada escala com a area do mapa (docs/planos/F18b-mapa-grande.md). A vila inicial de data/economy.json NAO se move; ela ocupa o quadrante noroeste de proposito, e o sudeste fica para a segunda cidade (F18c).",
```

- [ ] **Passo 2: `npm run validate:data`**

Esperado: `9 arquivos, 0 erros`. A chave `_docMapaPadrao` precisa ser aceita pelo
schema — se `tools/data-schema.js` reprovar chave desconhecida em `terrain`,
**registrar a chave no schema** (é dado novo legítimo, e o arquivo já tem `_doc`
e `_docMenuBuildInicial` em outros lugares). Não remover o `_doc` para o
validador passar.

A regra `economia/posicao` (já existente em `tools/data-rules.js`) continua sendo
o guarda de que a vila cabe no mapa: ela compara o footprint de cada prédio
inicial com `mapaPadrao`. Nada a acrescentar.

- [ ] **Passo 3: o pin da F04 acompanha o dado**

`tests/F04-grid-ortogonal.test.ts:99` afirma
`expect(gameData.terreno.mapaPadrao).toEqual({ largura: 64, altura: 64 })`.
É um **pin de valor publicado**, irmão do pin de `tilePx` na linha 93
(`// rastreado ate data/terrain.json`), e ele acompanha o dado:

```ts
    expect(gameData.terreno.mapaPadrao).toEqual({ largura: 128, altura: 128 }); // rastreado ate data/terrain.json: mapaPadrao
```

As duas linhas acima dele (o espelho `configDoMapa` ↔ `gameData`) são o guarda
estrutural e não mudam.

- [ ] **Passo 4: `npm run verify`**

Esperado: EXIT=0. Se algum teste além destes reprovar, **parar e reportar** — a
sonda de 2026-09-23 encontrou exatamente dois (F04 e F10), e um terceiro seria
achado novo.

- [ ] **Passo 5: commit**

```bash
git add data/terrain.json tests/F04-grid-ortogonal.test.ts tools/data-schema.js
git commit -m "feat(F18b): o mapa padrao passa a 128x128"
```

---

## Tarefa 3 — O guarda permanente: o tamanho do mapa é dado, não presunção

O que esta feature deixa para sempre **não** é o número medido (§8: medida é
evidência da sessão). É a prova de que nenhum caminho da simulação presume o
valor publicado — foi exatamente essa presunção, escondida numa fixture, que a
sonda encontrou.

- [ ] **Passo 1: escrever o teste que falha se alguém presumir o tamanho**

`tests/F18b-mapa.test.ts`:

```ts
/**
 * F18b — o tamanho do mapa e DADO. Plano em `docs/planos/F18b-mapa-grande.md`.
 *
 * O guarda permanente desta feature nao e o numero medido: e que a simulacao
 * inteira roda em QUALQUER tamanho declarado, inclusive um retangulo que nao e
 * potencia de dois. Foi uma presuncao de 64 escondida numa fixture que travou a
 * mudanca de mapa; este teste e o que acusa a proxima.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { buscarCaminho } from '../src/sim/pathfinding';
import { configDoMapa } from '../src/render/mapa';
import { gravarEvidencia } from './helpers/evidence';

function dadosCom(largura: number, altura: number): GameData {
  return { ...gameData, terreno: { ...gameData.terreno, mapaPadrao: { largura, altura } } };
}

/** 97x61: retangular, e nenhum dos dois lados e potencia de dois. Se algum
 *  codigo presumir quadrado ou potencia de dois, quebra aqui. */
const TAMANHOS: readonly (readonly [number, number])[] = [
  [64, 64], [128, 128], [256, 256], [97, 61],
];

describe('F18b — o mapa publicado', () => {
  it('data/terrain.json publica 128x128, e o render espelha', () => {
    expect(gameData.terreno.mapaPadrao).toEqual({ largura: 128, altura: 128 });
    expect(configDoMapa.largura).toBe(gameData.terreno.mapaPadrao.largura);
    expect(configDoMapa.altura).toBe(gameData.terreno.mapaPadrao.altura);
  });

  it('a area jogavel quadruplicou em relacao ao 64x64 da Fase A', () => {
    const { largura, altura } = gameData.terreno.mapaPadrao;
    expect(largura * altura).toBe(4 * 64 * 64);
  });
});

describe('F18b — GUARDA: nada presume o tamanho do mapa', () => {
  it.each(TAMANHOS)('o estado inicial nasce e anda em %ix%i', (largura, altura) => {
    const dados = dadosCom(largura, altura);
    let estado = createInitialState(gameData.economia.estadoInicial.semente, dados);
    for (let t = 0; t < 30; t += 1) estado = step(estado, [], dados);
    expect(estado.tick).toBe(30);
    expect(estado.predios.ordem.length).toBeGreaterThan(0);
    expect(estado.unidades.ordem.length).toBeGreaterThan(0);
  });

  it.each(TAMANHOS)('a borda do mapa e a declarada, nao a publicada: %ix%i', (largura, altura) => {
    const dados = dadosCom(largura, altura);
    const estado = createInitialState(1, dados);
    const dentro = { gx: largura - 1, gy: altura - 1 };
    const fora = { gx: largura, gy: altura - 1 };
    expect(buscarCaminho(estado, dentro, [dentro], 'livre', dados)?.custo).toBe(0);
    expect(buscarCaminho(estado, dentro, [fora], 'livre', dados)).toBeNull();
  });

  it('o tamanho do estado serializado NAO cresce com a area do mapa', () => {
    const bytes = TAMANHOS.map(([l, a]) => JSON.stringify(createInitialState(1, dadosCom(l, a))).length);
    // GameState nao guarda tile: os quatro sao o MESMO numero, nao "parecidos".
    expect(new Set(bytes).size).toBe(1);
  });

  it('grava a evidencia do aceite', () => {
    gravarEvidencia('F18b', {
      feature: 'F18b-mapa-grande',
      mapaPadrao: gameData.terreno.mapaPadrao,
      areaEmTiles: gameData.terreno.mapaPadrao.largura * gameData.terreno.mapaPadrao.altura,
      areaAntes: 64 * 64,
      porTamanho: TAMANHOS.map(([l, a]) => ({
        mapa: `${l}x${a}`,
        bytesDoEstadoInicial: JSON.stringify(createInitialState(1, dadosCom(l, a))).length,
      })),
    });
  });
});
```

- [ ] **Passo 2: rodar**

```bash
npx vitest run tests/F18b-mapa.test.ts
```
Esperado: PASS.

- [ ] **Passo 3: provar que o guarda ACUSA (probe de sessão, não cobertura)**

Editar temporariamente `tileAndavel` em `src/sim/pathfinding.ts` para ler
`gameData.terreno.mapaPadrao` em vez do `dados` recebido; rodar o arquivo;
conferir que o caso `97x61` reprova. **Desfazer com `git checkout`.** Registrar
no `PROGRESS.md` como probe — a proteção permanente é o teste rodando dentro do
`npm run verify`, e as duas são coisas distintas (§8).

- [ ] **Passo 4: `npm run verify` e ler `test-output/F18b.json` com Read**

- [ ] **Passo 5: commit**

```bash
git add tests/F18b-mapa.test.ts
git commit -m "test(F18b): o guarda de que o tamanho do mapa e dado, nao presuncao"
```

---

## Tarefa 4 — O aceite visual: existe mapa além do que havia

Um mapa quatro vezes maior que ninguém consegue ver não foi entregue. O roteiro
prova, com número publicado pela cena, que a câmera alcança um canto que no
64² não existia.

- [ ] **Passo 1: escrever `tools/shots/F18b.js`**

O roteiro, em prosa antes de código: abre o jogo; afirma que o canto sudeste do
mapa vem de `data/terrain.json` (`require('../../data/terrain.json')`, como o
F18a faz com os níveis de zoom) e é `(127,127)` — um tile que **não existe** num
64²; leva a câmera até lá pelo caminho que a cena já expõe; **reamostra o
ponteiro** e afirma que `tileSobMouse` é o tile do canto; captura. Depois volta
ao zoom mínimo, captura o quanto do mapa cabe num quadro e registra por
`afirmar(true, 'medida: ...')` quantos tiles o quadro desenhou.

Regras herdadas da F18a, que já custaram defeito:
- **Reamostrar o ponteiro** depois de mover a câmera: `tileSobMouse` só se
  atualiza no `pointermove`, e sem reamostrar a afirmação passa sozinha lendo o
  valor de antes.
- Usar `pontoDoTileNaTela(canvas, tile, camera, tilePx)` de
  `tools/shots/_canvas.js`, que já é ciente de zoom; a fórmula antiga
  (`canvas.left + gx*TILE - scrollX`) só vale em zoom 1.
- Afirmar **número publicado**, nunca pixel.

- [ ] **Passo 2: rodar**

```bash
npm run shot -- F18b
```
Esperado: EXIT=0, afirmações todas verdes, `errosDeConsole: []`.

- [ ] **Passo 3: abrir com Read a captura desta feature**

Só a desta feature (§8: imagem é o que mais pesa na janela).

- [ ] **Passo 4: não-regressão pelos roteiros já validados, por CÓDIGO DE SAÍDA**

```bash
for n in F04 F06 F07 F08 F16b F17 F17e F18a; do npm run shot -- $n; echo "$n EXIT=$?"; done
```
Esperado: EXIT=0 em todos. **Não abrir essas imagens com Read.** Sonda de
2026-09-23 com o mapa já em 128²: os oito deram EXIT=0, e o F18a mediu
875/234/88 tiles por nível de zoom — os mesmos números do 64².

- [ ] **Passo 5: commit**

```bash
git add tools/shots/F18b.js
git commit -m "feat(F18b): o roteiro que prova que a camera alcanca o mapa novo"
```

---

## Tarefa 5 — Fila, memória e portão

- [ ] **Passo 1: `BUILD_PLAN.md` — o item F18b, entre a F18a e a F18**

Escopo, aceite (o guarda do tamanho + o roteiro da borda), evidência
(`test-output/F18b.json`, `screenshots/F18b-*.png`) e as Notas: a tabela de
medida, o argumento do 128, a decisão sobre a vila, e o desvio consciente da Nota
da F17c sobre `tests/F10-astar.test.ts`.

- [ ] **Passo 2: `BUILD_PLAN.md` — o item F18c, logo depois**

```
### F18c — As fixtures param de depender da posição absoluta da vila
- **Escopo**: `tests/helpers/*` e os roteiros de `tools/shots/` deixam de
  escrever a coordenada da vila à mão e passam a derivá-la do armazém do
  cenário. A prova de que funcionou é mover a vila para o **centro** do mapa
  (`data/economy.json`: +32 em cada eixo — storehouse (61,62), schoolhouse
  (66,62), spawn (62,66)) sem que nenhuma asserção mude.
- **Aceite**: regra nova em `tools/data-rules.js` — o centro da caixa que
  envolve os prédios iniciais fica a no máximo 2 tiles do centro de
  `mapaPadrao` — reprovando antes e passando depois; `npm run verify` verde e
  os 15 roteiros de screenshot verdes por código de saída.
- **Nota (o tamanho, contado na F18b)**: ~20 arquivos de fixture e 15 roteiros
  carregam a posição absoluta (~64 literais vizinhos à vila), e há ~100
  chamadas diretas de `createInitialState(1)`. Não é um `sed`: cada literal
  tem de ser lido. Se não couber numa sessão, quebre por arquivo.
```

- [ ] **Passo 3: `PROGRESS.md`**

Seção nova antes de `## Perguntas em aberto`, com **Verificado** separado de
**Decidido**, a tabela da medida, o desvio da Nota da F17c dito com todas as
letras, e o probe registrado como distinto da cobertura permanente.

- [ ] **Passo 4: `npm run verify` e então `test-results.json`**

O selo vale 15 minutos. `"F18b-mapa-grande": { "passes": true }`.

- [ ] **Passo 5: commit**

```bash
git add BUILD_PLAN.md PROGRESS.md test-results.json
git commit -m "feat(F18b): mapa padrao 128x128, com a medida e a decisao da vila registradas"
```

---

## Auto-revisão

| Risco | Onde foi tratado |
|---|---|
| "Mudou o teste para o verde passar" (§10) | Tarefa 1 passo 4: a mudança da F10 é provada **neutra** com o dado ainda em 64², antes de o dado mudar. E vai reportada. |
| Medida virar cobertura permanente (§8) | A tabela é evidência da sessão; o guarda que fica é `tests/F18b-mapa.test.ts`, que não cronometra nada. |
| Guarda que não acusa | Tarefa 3 passo 3: probe que quebra `tileAndavel` de propósito e confere que o caso 97×61 reprova. |
| Roteiro que passa sozinho | Tarefa 4 passo 1: reamostrar o ponteiro, defeito já pago na F18a. |
| Número mágico em `.ts` (§2.3) | O único número novo em código é `LADO_DO_MAPA_DA_PROPRIEDADE`, numa **fixture de teste**, declarado com o motivo. `128` aparece em `.ts` só como pin rastreado ao dado. |
| Tocar `src/render/` e `src/sim/` juntos (§10) | Nenhum dos dois muda. |
| Feature maior que a sessão (§6) | O que não cabe está escrito como F18c, com o tamanho contado, não estimado. |
