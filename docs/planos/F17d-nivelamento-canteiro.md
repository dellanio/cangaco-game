# F17d — Nivelamento visível no canteiro · plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, inline.
> Os passos usam `- [ ]` para acompanhamento. `subagent-driven-development` e
> `dispatching-parallel-agents` estão **proibidos** (CLAUDE.md §11).

**Objetivo:** olhando o mapa **sem selecionar nada**, o jogador vê o canteiro de
uma obra ficar plano tile a tile enquanto o laborer nivela, e distingue "ainda
sendo nivelada" de "pronta para receber material". O painel da obra selecionada
passa a dizer a mesma coisa, com o mesmo número.

**Arquitetura:** a informação já está no estado (`PredioEmObra.obra.nivelamento`)
e o alvo já está no dado (`alvoDeNivelamento = área do footprint ×
construcao.ticksNivelamentoPorTile`). A aritmética que transforma esses dois
números em "N tiles prontos + fração do tile em curso" vira um arquivo puro em
`src/render/`, do mesmo feitio de `estagio-obra.ts` e `medidor-obra.ts` (zero
imports, testável headless). A cena desenha; o painel chama a **mesma função**.

**Stack:** Vitest (headless) para a aritmética e para o seletor, Playwright via
`npm run shot` para a tela.

**Fonte do critério:** `BUILD_PLAN.md`, item **F17d** (escrito antes deste
plano, com as cinco notas). Escopo herdado: `docs/planos/F17b-material-na-obra.md`
(o diff de `atualizarPredios`, o funil `render/predios.ts`, o par mapa+painel) e
a F11c (`estagio-obra.ts`).

---

## Números medidos nesta sessão (fonte para os testes, não literais para copiar)

Lidos pelo dado real, via sonda temporária (`gameData` + `alvoDeNivelamento`):

| chave | valor |
|---|---|
| `construcao.ticksNivelamentoPorTile` | `10` |
| `gold_mine` `tamanho` `[2,1]` | 2 tiles, `alvo = 20` |
| `barracks` `tamanho` `[4,4]` | 16 tiles, `alvo = 160` |
| `woodcutters` `tamanho` `[3,2]` | 6 tiles, `alvo = 60` |

Consequência que o roteiro usa: **10 ticks de nivelamento = exatamente 1 tile**,
então avançar de 10 em 10 nunca pula um tile inteiro. É o que garante que o
screenshot do canteiro pela metade é alcançável, e não sorte.

**Nos testes esses números são derivados, nunca digitados**: o teste chama
`alvoDeNivelamento(tipo, gameData)` e lê `def.tamanho`. Literal digitado passaria
a valer sozinho se o dado mudasse (guarda estrutural, CLAUDE.md §2.3).

---

## Restrições globais

- **`src/sim/` não muda nas tarefas 1 a 6.** Nem campo em `state`, nem comando,
  nem seletor novo. Se alguma dessas tarefas parecer pedir seletor novo ou campo
  novo, **pare e reporte** — instrução literal do item da fila.
- A **Tarefa 0 é a exceção nomeada pelo operador** e a única coisa desta sessão
  que abre `src/sim/`: ela corrige um defeito da **F16b**, sai em commit próprio
  `fix(F16b): ...`, antes de tudo. É o mesmo tratamento do filtro `quantidade > 0`
  (`e014a0c`, que também mexeu em `src/sim/selectors.ts` e em
  `tests/F16b-painel.test.ts`, e em nada mais da sim).
- Esta feature toca `src/render/` **e** `src/ui/`. É exceção à §10 e está
  **escrita no item da fila**, antes do código. Vale para a F17d e só.
- Nenhum número de balanceamento em `.ts`: alvo e footprint saem de
  `data/buildings.json`/`construcao` pelo funil (`render/predios.ts` na cena,
  `painelDoPredio` no painel). **Cor, tamanho de bloco e opacidade não são
  balanceamento** — são desenho, e ficam no `.ts` da cena como o resto do
  placeholder já fica.
- `render/` só pode importar `../sim/data` em `mapa.ts` e `predios.ts` — teste
  estrutural em `tests/F04-grid-ortogonal.test.ts:138`. O arquivo novo de
  aritmética **não importa nada**.
- `ui/` **não** lê `sim/data` (topo de `menu-build.ts`). É por isso que o total
  de tiles do painel vem do **seletor**, e não de `render/predios.ts`: importar o
  funil arrastaria `sim/data` para dentro de `ui/` por transitividade.
- Todo rótulo que o jogador lê vem de `data/theme-sertao.json` (§9).
- Placeholder é comportamento normal (§9): o canteiro é geometria, não arte.

---

## 0. Escopo e decisões

**No escopo:**
- desenhar o canteiro de uma obra no mapa, tile a tile, a partir de
  `obra.nivelamento`;
- o painel dizer, em número, quanto do terreno já foi aplainado;
- o medidor de material da F17b ficar **esmaecido** enquanto nivela e **aceso**
  quando termina — é o que distingue "sendo nivelada" de "pronta para receber
  material" sem texto nenhum.

**Fora do escopo**, e não entra por conveniência:
- **o laborer andando sobre o canteiro.** Decisão do operador (2026-09-23):
  `render/` desenhar a unidade fora da posição que está em `sim/` quebraria "o
  render lê o estado, não decide", e desenhar caminhada falsa mente sobre uma
  regra que não existe. Está congelado em `IDEIAS.md`.
- qualquer mudança em regra de nivelamento (velocidade, número de laborers);
- os estágios visuais da obra — é a **F17e**, que herda daqui só a fronteira
  "já nivelou".

### D1 — a fração do tile em curso entra na chave do diff, quantizada em oitavos

`atualizarPredios` pula o redesenho quando `(estado, estágio, assinatura)` não
muda, e o nivelamento **não mexe em `estado` nem em `estágio`**. Sem a leitura do
nivelamento na chave, o canteiro nasce correto e congela para sempre — e um
screenshot único passa assim mesmo. É a armadilha já medida na F17b (D3 daquele
plano).

A fração entra **quantizada em oitavos** (0..7): a chave fica testável e o
redesenho fica limitado a 8 por tile, em vez de um float diferente a cada tick.

**E o desenho usa o mesmo valor quantizado.** É isso que fecha o buraco de
verdade: se a cena desenhasse a fração contínua e a chave guardasse o oitavo,
existiria mudança visível que a chave não vê. Desenhando os oitavos, "mesma
chave ⇒ mesmo desenho" é verdade por construção, e o teste afirma isso.

### D2 — a aritmética é uma função só, para mapa e painel

Mesmo motivo do `medidor-obra.ts` na F17b: duas contas para o mesmo número acabam
divergindo. O roteiro confere painel contra mapa no fim, e não contra número
digitado no roteiro.

### D3 — por que a Tarefa 0 precisa de `tiles` no seletor, e não só de `feito`/`alvo`

O painel precisa dizer **em tiles** ("3/6"), que é a unidade que o jogador vê no
mapa — e `ui/` não pode derivar tiles de `alvo` sem conhecer
`ticksNivelamentoPorTile`, que mora em `sim/data`. Os três números saem juntos de
`painelDoPredio`, num campo só.

Poderiam sair em dois commits (a Tarefa 0 com `{feito, alvo}`, a tarefa do painel
acrescentando `tiles`), mas isso abriria `src/sim/` **duas vezes** — e as tarefas
1 a 6 não podem. Um campo, um commit, na tarefa autorizada.

A conta de "quantos tiles" fica **inline na Tarefa 0** e é **substituída por
`canteiroDaObra` na Tarefa 4**. É uma linha reescrita, de propósito: a Tarefa 0
tem de ficar completa sozinha (é correção de outra feature e sai em commit
próprio), e a Tarefa 4 é quem unifica a aritmética com o mapa.

---

## Estrutura de arquivos

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `src/sim/selectors.ts` | campo `nivelamento` em `PainelDoPredio` | **0** (`fix(F16b)`) |
| `src/ui/painel-predio.ts` | linha de nivelamento no lugar do "Em obra 0%" | **0**, depois **4** |
| `data/theme-sertao.json` | rótulo `painelPredio.nivelando` | **0** |
| `src/render/nivelamento-obra.ts` | **novo.** Aritmética pura, zero imports | **1** |
| `src/render/predios.ts` | `alvoDeNivelamento` no funil `AparenciaDoPredio` | **2** |
| `src/render/debug.ts` | `canteirosDeObra` no contrato do harness | **3** |
| `src/render/scenes/WorldScene.ts` | chave do diff, desenho do canteiro, medidor esmaecido | **3** |
| `tests/F17d-nivelamento.test.ts` | **novo.** Aritmética + funil + evidência | **1**, **2** |
| `tests/F16b-painel.test.ts` | o seletor novo | **0** |
| `tests/F04-grid-ortogonal.test.ts` | guarda "zero imports" generalizada | **1** |
| `tools/shots/F17d.js` | **novo.** Roteiro de tela | **5** |

---

## Tarefa 0 — `fix(F16b)`: o painel dizia "Em obra 0%" durante todo o nivelamento

**Por que é defeito da F16b, e não escolha desta feature:** `progresso` é
`predio.hp / def.hp` (`sim/selectors.ts:442`) e `hp` só sobe com o martelo. Uma
obra recém-plantada e uma obra que já esperou 60 ticks de nivelamento escrevem a
mesma coisa — "Em obra 0%" — e o jogador não tem como distinguir "está sendo
preparada" de "está parada esperando material". Decisão do operador, 2026-09-23:
tarefa própria, commit `fix(F16b): ...`, antes de qualquer coisa da F17d.

**Files:**
- Modify: `src/sim/selectors.ts` (interface `PainelDoPredio` ~:348, corpo de
  `painelDoPredio` ~:437)
- Modify: `src/ui/painel-predio.ts` (`desenharObra`, :82-118)
- Modify: `data/theme-sertao.json` (bloco `painelPredio`)
- Test: `tests/F16b-painel.test.ts`

**Interfaces:**
- Produces: `PainelDoPredio.nivelamento: { readonly feito: number; readonly alvo:
  number; readonly tiles: number } | null` — `null` em prédio completo. A Tarefa 4
  consome os três campos.

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/F16b-painel.test.ts`, depois do bloco "correção do defeito da F16b"
(:116-139), acrescentar. Importar `alvoDeNivelamento` de `../src/sim/obra` no
topo (`custoDoPredio` já vem de lá):

```ts
  // --- correcao da F16b (achada ao planejar a F17d) ---
  // `progresso` e `hp / hpTotal`, e `hp` so sobe com o martelo: durante TODO o
  // nivelamento o painel escrevia "Em obra 0%". A obra recem-plantada e a que ja
  // esperou 60 ticks de nivelamento diziam a mesma coisa.

  it('F16b (correcao): obra recem-posta traz o nivelamento zerado, com alvo e tiles do DADO', () => {
    const p = painelDoPredio(comObra, OBRA);
    const def = gameData.predios.find((b) => b.id === 'quarry');
    expect(def).toBeDefined();
    if (def === undefined) return;
    const [largura, altura] = def.tamanho;
    expect(p?.nivelamento).toEqual({
      feito: 0,
      // igualdade contra a MESMA funcao que a sim usa para nivelar
      // (`systems/laborers.ts`), nunca contra um literal digitado aqui
      alvo: alvoDeNivelamento('quarry', gameData),
      tiles: (largura ?? 0) * (altura ?? 0),
    });
  });

  it('F16b (correcao): obra JA NIVELADA se distingue da recem-posta', () => {
    const alvo = alvoDeNivelamento('quarry', gameData);
    // `comObra` do helper ja nasce nivelada por default (jobs-cenario.ts)
    const pronta = comObraEm(inicial, 'obra-plana', { gx: 26, gy: 34, faltam: {} });
    expect(painelDoPredio(pronta, 'obra-plana')?.nivelamento)
      .toMatchObject({ feito: alvo, alvo });
    // e as duas continuam com o MESMO progresso: e exatamente por isso que
    // "Em obra 0%" nao servia para distinguir uma da outra.
    expect(painelDoPredio(pronta, 'obra-plana')?.progresso).toBe(0);
    expect(painelDoPredio(comObra, OBRA)?.progresso).toBe(0);
  });

  it('F16b (correcao): predio completo nao tem nivelamento', () => {
    expect(painelDoPredio(pedreira, PEDREIRA)?.nivelamento).toBeNull();
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/F16b-painel.test.ts`
Expected: FAIL — `nivelamento` não existe em `PainelDoPredio`.

- [ ] **Step 3: O campo no seletor**

Em `src/sim/selectors.ts`, na interface `PainelDoPredio`, depois de `faltam`
(:360):

```ts
  /**
   * F16b (correcao, achada ao planejar a F17d): quanto do terreno da obra ja foi
   * aplainado. `null` no predio completo.
   *
   * Existe porque `progresso` (`hp / hpTotal`) e ZERO durante todo o
   * nivelamento — `hp` so sobe com o martelo —, e sem isto o painel escrevia
   * "Em obra 0%" tanto na obra recem-plantada quanto na que ja esperou o
   * nivelamento inteiro. Sao estados diferentes para o jogador: um ainda vai
   * demorar, o outro so espera material.
   *
   * `tiles` vem junto de proposito: e a unidade que o jogador ve no mapa, e
   * `ui/` nao pode deriva-la de `alvo` sem ler `ticksNivelamentoPorTile` de
   * `sim/data` — coisa que `ui/` nao faz (topo de `menu-build.ts`).
   */
  readonly nivelamento: {
    readonly feito: number;
    readonly alvo: number;
    readonly tiles: number;
  } | null;
```

Importar `alvoDeNivelamento` no topo do arquivo, ao lado de `custoDoPredio`:

```ts
import { alvoDeNivelamento, custoDoPredio } from './obra';
```

(se o import de `custoDoPredio` já existir noutra forma, acrescentar o nome à
lista existente em vez de criar uma segunda linha de import do mesmo módulo.)

No corpo de `painelDoPredio`, no ramo `predio.estado === 'obra'` (:446):

```ts
  if (predio.estado === 'obra') {
    const [largura, altura] = def.tamanho;
    return {
      ...comum,
      estado: 'obra',
      faltam: faltamDaObra(predio, def, dados),
      nivelamento: {
        feito: predio.obra.nivelamento,
        alvo: alvoDeNivelamento(predio.tipo, dados),
        tiles: (largura ?? 0) * (altura ?? 0),
      },
      ocupante: null,
      estoque: null,
      temProducao: false,
      pausado: false,
    };
  }
```

E no `return` do prédio completo (:459), acrescentar `nivelamento: null,` logo
depois de `faltam: null,`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/F16b-painel.test.ts`
Expected: PASS.

- [ ] **Step 5: O rótulo no tema**

Em `data/theme-sertao.json`, no bloco `painelPredio`, logo depois de `"emObra"`:

```json
    "nivelando": "Aplainando o chão",
```

`theme-sertao.json` não entra em `validate:data` (é a camada temática, CLAUDE.md
§9; `tools/data-rules.js:5` diz isso explicitamente), então não há schema a
atualizar.

- [ ] **Step 6: A linha do painel**

Em `src/ui/painel-predio.ts`, trocar a primeira linha de `desenharObra` (:85):

```ts
function desenharObra(
  raiz: HTMLElement, dados: PainelDoPredio, custo: Readonly<Record<string, number>>,
): void {
  // Correcao da F16b: "Em obra 0%" durante todo o nivelamento dizia a mesma coisa
  // para a obra recem-plantada e para a que so espera material — `progresso` e
  // `hp / hpTotal`, e `hp` so sobe com o martelo. Enquanto nivela, o painel diz o
  // que esta REALMENTE acontecendo, na unidade que o mapa mostra: tiles.
  const nivelamento = dados.nivelamento;
  if (nivelamento !== null && nivelamento.feito < nivelamento.alvo) {
    // A conta inline sai na F17d, substituida por `canteiroDaObra` — a mesma que
    // o mapa usa. Aqui ela fica porque esta correcao precisa fechar sozinha, em
    // commit proprio, antes daquela feature existir.
    const ticksPorTile = nivelamento.tiles > 0 ? nivelamento.alvo / nivelamento.tiles : 0;
    const prontos = ticksPorTile > 0
      ? Math.min(nivelamento.tiles, Math.floor(nivelamento.feito / ticksPorTile))
      : nivelamento.tiles;
    const l = linha('nivelamento', rotulos.nivelando, `${prontos}/${nivelamento.tiles}`);
    l.dataset.tilesProntos = String(prontos);
    l.dataset.tilesTotais = String(nivelamento.tiles);
    raiz.append(l);
  } else {
    raiz.append(linha('obra', rotulos.emObra, `${Math.round(dados.progresso * 100)}%`));
  }
  const faltam = dados.faltam ?? [];
```

O resto de `desenharObra` (o bloco `material` da F17b) **não muda**.

- [ ] **Step 7: Verificar e commitar**

```bash
npm run verify
git add src/sim/selectors.ts src/ui/painel-predio.ts data/theme-sertao.json tests/F16b-painel.test.ts docs/planos/F17d-nivelamento-canteiro.md
git commit -m "$(cat <<'EOF'
fix(F16b): o painel dizia "Em obra 0%" durante todo o nivelamento

`progresso` e `hp / hpTotal` e `hp` so sobe com o martelo, entao a obra
recem-plantada e a que ja esperou o nivelamento inteiro escreviam a mesma
coisa. Sao estados diferentes para o jogador: um ainda vai demorar, o outro
so espera material.

`painelDoPredio` ganha `nivelamento` (feito, alvo, tiles) e o painel escreve
"Aplainando o chao N/M" enquanto nivela. `tiles` vai junto porque e a unidade
que o mapa mostra e `ui/` nao le `sim/data`.

Achado ao planejar a F17d; o operador mandou corrigir em commit proprio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarefa 1 — `render/nivelamento-obra.ts`: a aritmética pura

**Files:**
- Create: `src/render/nivelamento-obra.ts`
- Create: `tests/F17d-nivelamento.test.ts`
- Modify: `tests/F04-grid-ortogonal.test.ts:115-141` (guarda "zero imports")

**Interfaces:**
- Produces:
  - `interface CanteiroDaObra { readonly tilesProntos: number; readonly tilesTotais: number; readonly oitavosDoTileEmCurso: number; readonly nivelada: boolean }`
  - `canteiroDaObra(nivelamento: number, alvo: number, tilesTotais: number): CanteiroDaObra`
  - `chaveDoCanteiro(canteiro: CanteiroDaObra | null): string`
- Consome: nada. **Zero imports** é requisito, não estilo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/F17d-nivelamento.test.ts`:

```ts
/**
 * F17d — a aritmetica do canteiro de uma obra. Plano em
 * `docs/planos/F17d-nivelamento-canteiro.md`.
 *
 * `nivelamento-obra.ts` e aritmetica pura SEM IMPORT NENHUM, como
 * `estagio-obra.ts` (F11c) e `medidor-obra.ts` (F17b): e o que o deixa dentro da
 * regra estrutural de `render/` — so `mapa.ts` e `predios.ts` podem falar com
 * `sim/data` (guarda em `tests/F04-grid-ortogonal.test.ts`). Alvo e footprint
 * chegam por parametro, nunca lidos de dentro.
 *
 * Todo numero esperado e DERIVADO do dado (`alvoDeNivelamento`, `def.tamanho`).
 * Literal digitado aqui passaria a valer sozinho se `buildings.json` mudasse.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { alvoDeNivelamento } from '../src/sim/obra';
import { canteiroDaObra, chaveDoCanteiro } from '../src/render/nivelamento-obra';
import { gravarEvidencia } from './helpers/evidence';

function tilesDoTipo(tipo: string): number {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (def === undefined) throw new Error(`tipo '${tipo}' nao existe em buildings.json`);
  const [largura, altura] = def.tamanho;
  return (largura ?? 0) * (altura ?? 0);
}

// Os dois footprints que o aceite do BUILD_PLAN nomeia: o menor (2 tiles) e um
// grande (16). Os valores saem do dado, nao de literal.
const MINA = { tipo: 'gold_mine', tiles: tilesDoTipo('gold_mine'), alvo: alvoDeNivelamento('gold_mine', gameData) };
const QUARTEL = { tipo: 'barracks', tiles: tilesDoTipo('barracks'), alvo: alvoDeNivelamento('barracks', gameData) };

describe('F17d — a aritmetica do canteiro', () => {
  it('os dois footprints do aceite sao mesmo 2 e 16 tiles no dado de hoje', () => {
    // Guarda do PROPRIO teste: se alguem mudar o tamanho desses predios, os
    // casos abaixo deixam de exercer "pequeno" e "grande" e este caso avisa.
    expect(MINA.tiles).toBe(2);
    expect(QUARTEL.tiles).toBe(16);
  });

  it('nivelamento 0: nenhum tile pronto, nada de fracao, nao nivelada', () => {
    for (const p of [MINA, QUARTEL]) {
      expect(canteiroDaObra(0, p.alvo, p.tiles), p.tipo).toEqual({
        tilesProntos: 0, tilesTotais: p.tiles, oitavosDoTileEmCurso: 0, nivelada: false,
      });
    }
  });

  it('nivelamento = alvo: TODOS os tiles prontos e nivelada', () => {
    for (const p of [MINA, QUARTEL]) {
      expect(canteiroDaObra(p.alvo, p.alvo, p.tiles), p.tipo).toEqual({
        tilesProntos: p.tiles, tilesTotais: p.tiles, oitavosDoTileEmCurso: 0, nivelada: true,
      });
    }
  });

  it('um tile inteiro de nivelamento vale um tile pronto, sem fracao sobrando', () => {
    const ticksPorTile = MINA.alvo / MINA.tiles;
    expect(canteiroDaObra(ticksPorTile, MINA.alvo, MINA.tiles)).toEqual({
      tilesProntos: 1, tilesTotais: MINA.tiles, oitavosDoTileEmCurso: 0, nivelada: false,
    });
  });

  it('meio tile vira 4 oitavos, e o tile ainda nao conta como pronto', () => {
    const ticksPorTile = QUARTEL.alvo / QUARTEL.tiles;
    const c = canteiroDaObra(ticksPorTile * 2.5, QUARTEL.alvo, QUARTEL.tiles);
    expect(c.tilesProntos).toBe(2);
    expect(c.oitavosDoTileEmCurso).toBe(4);
    expect(c.nivelada).toBe(false);
  });

  it('a fracao nunca chega a 8 oitavos: 8/8 e o tile seguinte pronto', () => {
    const ticksPorTile = QUARTEL.alvo / QUARTEL.tiles;
    for (let n = 0; n <= QUARTEL.alvo; n++) {
      const c = canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles);
      expect(c.oitavosDoTileEmCurso, `n=${n}`).toBeGreaterThanOrEqual(0);
      expect(c.oitavosDoTileEmCurso, `n=${n}`).toBeLessThanOrEqual(7);
      expect(c.tilesProntos, `n=${n}`).toBeLessThanOrEqual(QUARTEL.tiles);
    }
    void ticksPorTile;
  });

  it('nivelamento acima do alvo nao passa do footprint (o estado tem teto, o desenho tambem)', () => {
    expect(canteiroDaObra(MINA.alvo * 3, MINA.alvo, MINA.tiles)).toEqual({
      tilesProntos: MINA.tiles, tilesTotais: MINA.tiles, oitavosDoTileEmCurso: 0, nivelada: true,
    });
  });

  it('nivelamento negativo nao produz tile negativo', () => {
    expect(canteiroDaObra(-5, MINA.alvo, MINA.tiles).tilesProntos).toBe(0);
  });

  it('footprint ou alvo zerado (tipo desconhecido, placeholder do §9) nao quebra: nasce nivelada', () => {
    expect(canteiroDaObra(0, 0, 0)).toEqual({
      tilesProntos: 0, tilesTotais: 0, oitavosDoTileEmCurso: 0, nivelada: true,
    });
  });

  it('o canteiro enche monotonicamente: tile pronto nunca volta atras', () => {
    let anterior = -1;
    for (let n = 0; n <= QUARTEL.alvo; n++) {
      const prontos = canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles).tilesProntos;
      expect(prontos, `n=${n}`).toBeGreaterThanOrEqual(anterior);
      anterior = prontos;
    }
    expect(anterior).toBe(QUARTEL.tiles);
  });
});

describe('F17d — a chave do diff (D1: a armadilha da F17b)', () => {
  it('predio completo nao tem canteiro, e a chave e vazia', () => {
    expect(chaveDoCanteiro(null)).toBe('');
  });

  it('a chave muda a cada oitavo e SO a cada oitavo', () => {
    // Isto e o que faz a cena redesenhar: `atualizarPredios` pula o redesenho
    // quando a chave nao muda, e nivelar nao mexe em `estado` nem em `estagio`.
    const chaves = new Set<string>();
    for (let n = 0; n <= QUARTEL.alvo; n++) {
      chaves.add(chaveDoCanteiro(canteiroDaObra(n, QUARTEL.alvo, QUARTEL.tiles)));
    }
    // 16 tiles x 8 oitavos, mais o estado final nivelado (fracao 0 de novo, mas
    // com tilesProntos = 16), menos as repeticoes de oitavo dentro de um tick.
    const ticksPorTile = QUARTEL.alvo / QUARTEL.tiles;
    const oitavosDistintosPorTile = Math.min(8, ticksPorTile);
    expect(chaves.size).toBe(QUARTEL.tiles * oitavosDistintosPorTile + 1);
  });

  it('mesma chave implica mesmo desenho: os campos que a cena usa sao os que a chave carrega', () => {
    // Guarda estrutural do D1: a cena desenha a fracao QUANTIZADA. Se ela
    // desenhasse a fracao continua, existiria mudanca visivel que a chave nao ve.
    const a = canteiroDaObra(3, QUARTEL.alvo, QUARTEL.tiles);
    const b = canteiroDaObra(4, QUARTEL.alvo, QUARTEL.tiles);
    if (chaveDoCanteiro(a) === chaveDoCanteiro(b)) {
      expect(a).toEqual(b);
    } else {
      expect(a).not.toEqual(b);
    }
  });
});

describe('F17d — guarda estrutural do arquivo puro', () => {
  it('src/render/nivelamento-obra.ts nao importa nada', () => {
    expect(/^\s*import\b/m.test(readFileSync('src/render/nivelamento-obra.ts', 'utf-8'))).toBe(false);
  });
});
```

> Nota sobre `chaves.size`: com `ticksNivelamentoPorTile = 10` medido hoje, cada
> tile leva 10 ticks e produz 8 oitavos distintos (dois ticks caem no mesmo
> oitavo), então `16 × 8 + 1 = 129`. A expressão acima deriva isso do dado em vez
> de fixar 129 — se `ticksNivelamentoPorTile` cair para 4, o teste continua
> correto sozinho.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/F17d-nivelamento.test.ts`
Expected: FAIL — `src/render/nivelamento-obra.ts` não existe.

- [ ] **Step 3: Escrever o módulo**

Criar `src/render/nivelamento-obra.ts`:

```ts
/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem Phaser), como
 * `estagio-obra.ts` (F11c) e `medidor-obra.ts` (F17b): quanto do terreno de uma
 * obra ja foi aplainado.
 *
 * O estado guarda `PredioEmObra.obra.nivelamento`, que sobe +1 por laborer por
 * tick com teto no alvo (`sim/systems/laborers.ts`); o alvo e `area do footprint
 * x construcao.ticksNivelamentoPorTile` (`sim/obra.ts`). Logo o numero de tiles
 * ja aplainados e `floor(nivelamento / ticksPorTile)`, e o resto da divisao e a
 * fracao do tile em curso. Nada disso e informacao nova: e a mesma informacao,
 * olhada com a lente da tela.
 *
 * `ticksPorTile` sai de `alvo / tilesTotais` em vez de virar um terceiro
 * parametro: assim os dois numeros que entram sao os dois que o resto do jogo ja
 * conhece, e nao ha como passar um trio inconsistente.
 *
 * A fracao do tile em curso sai QUANTIZADA EM OITAVOS, e e nessa forma que ela
 * entra na chave do diff da cena E no desenho. Se o desenho usasse a fracao
 * continua, existiria mudanca visivel que a chave nao ve — e o canteiro
 * congelaria na tela sem nenhum teste reprovar (armadilha medida na F17b).
 *
 * F17d desenha isto de duas formas — tiles no mapa e `N/M` no painel. Uma funcao
 * so, de proposito: duas contas para o mesmo numero acabam divergindo.
 */
export interface CanteiroDaObra {
  /** Tiles do footprint ja aplainados. Nunca passa de `tilesTotais`. */
  readonly tilesProntos: number;
  /** Area do footprint, em tiles. */
  readonly tilesTotais: number;
  /** Fracao do tile em curso, em oitavos: 0..7. Vale 0 quando nao ha tile em curso. */
  readonly oitavosDoTileEmCurso: number;
  /** Terreno inteiro aplainado: a obra ja pode receber material. */
  readonly nivelada: boolean;
}

const OITAVOS = 8;

export function canteiroDaObra(
  nivelamento: number, alvo: number, tilesTotais: number,
): CanteiroDaObra {
  const tiles = Math.max(0, Math.floor(tilesTotais));
  // Tipo sem footprint ou sem alvo cai no placeholder do §9: sem terreno para
  // aplainar, nada a esperar. `nivelada: true` e o que mantem o medidor de
  // material aceso em vez de esmaecido para sempre.
  if (tiles <= 0 || alvo <= 0) {
    return { tilesProntos: 0, tilesTotais: tiles, oitavosDoTileEmCurso: 0, nivelada: true };
  }
  // O estado ja tem teto no alvo (`laborers.ts`); o piso e o teto aqui existem
  // porque o dado pode mudar entre um save e outro, e um `nivelamento` fora da
  // faixa viraria tile negativo ou canteiro maior que o predio.
  const feito = Math.min(Math.max(0, nivelamento), alvo);
  const ticksPorTile = alvo / tiles;
  const prontos = Math.min(tiles, Math.floor(feito / ticksPorTile));
  const nivelada = prontos >= tiles;
  const resto = feito - prontos * ticksPorTile;
  const oitavos = nivelada
    ? 0
    : Math.min(OITAVOS - 1, Math.floor((resto / ticksPorTile) * OITAVOS));
  return { tilesProntos: prontos, tilesTotais: tiles, oitavosDoTileEmCurso: oitavos, nivelada };
}

/**
 * A leitura do canteiro reduzida a uma string, para a chave do diff de
 * `atualizarPredios`. `null` (predio completo, sem canteiro) da string vazia.
 *
 * Carrega EXATAMENTE os campos que o desenho usa. E o que torna "mesma chave
 * implica mesmo desenho" verdade por construcao, e nao por disciplina.
 */
export function chaveDoCanteiro(canteiro: CanteiroDaObra | null): string {
  if (canteiro === null) return '';
  return `${canteiro.tilesProntos}/${canteiro.tilesTotais}:${canteiro.oitavosDoTileEmCurso}`;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/F17d-nivelamento.test.ts`
Expected: PASS.

- [ ] **Step 5: Generalizar a guarda "zero imports" da F04**

`tests/F04-grid-ortogonal.test.ts` só guarda `grid.ts`. `estagio-obra.ts` e
`medidor-obra.ts` prometem o mesmo no comentário e nada verifica. Trocar
`gridTsTemImport` (`:115-118`) por:

```ts
/** Os arquivos de `render/` que sao aritmetica pura: prometem ZERO import no
 *  proprio comentario, e e essa promessa que os mantem fora da regra dos funis.
 *  Guarda generalizada na F17d — ate ela, so `grid.ts` era verificado. */
const ARITMETICA_PURA_EM_RENDER = [
  'src/render/grid.ts',
  'src/render/estagio-obra.ts',
  'src/render/medidor-obra.ts',
  'src/render/nivelamento-obra.ts',
];

function arquivosPurosComImport(): string[] {
  return ARITMETICA_PURA_EM_RENDER
    .filter((f) => /^\s*import\b/m.test(readFileSync(f, 'utf-8')));
}
```

Trocar o caso `:134-136` por:

```ts
  it('os arquivos de aritmetica pura de src/render/ nao importam nada', () => {
    expect(arquivosPurosComImport()).toEqual([]);
  });
```

E, no `gravarEvidencia` do fim do arquivo (`:170`), trocar
`gridTsSemImport: !gridTsTemImport(),` por:

```ts
      aritmeticaPuraSemImport: { arquivos: ARITMETICA_PURA_EM_RENDER, comImport: arquivosPurosComImport() },
```

- [ ] **Step 6: Provar que a guarda ACUSA, não só que não acusa à toa**

Prova temporária (probe — evidência da sessão, não cobertura contínua; §8):

```bash
printf "import { gridToScreen } from './grid';\nvoid gridToScreen;\n" >> src/render/nivelamento-obra.ts
npx vitest run tests/F04-grid-ortogonal.test.ts tests/F17d-nivelamento.test.ts 2>&1 | tail -20
git checkout -- src/render/nivelamento-obra.ts 2>/dev/null || true
```

Expected: os DOIS casos reprovam (o da F04 e o da F17d), e voltam ao verde depois
do `git checkout`. Se o arquivo ainda não estiver no git, remover as duas linhas
à mão. Registrar o resultado no `PROGRESS.md` **como probe**, nunca como
cobertura permanente — a cobertura permanente é a guarda generalizada do Step 5.

- [ ] **Step 7: Verificar e commitar**

```bash
npm run verify
git add src/render/nivelamento-obra.ts tests/F17d-nivelamento.test.ts tests/F04-grid-ortogonal.test.ts
git commit -m "$(cat <<'EOF'
feat(F17d): a aritmetica do canteiro, pura e sem import

`canteiroDaObra(nivelamento, alvo, tilesTotais)` devolve tiles prontos, a
fracao do tile em curso em OITAVOS e se a obra ja esta nivelada.
`chaveDoCanteiro` reduz isso a string para a chave do diff da cena.

Os oitavos nao sao detalhe: a chave e o desenho usam o MESMO valor
quantizado, entao "mesma chave implica mesmo desenho" vale por construcao.

A guarda "zero imports" da F04 deixa de valer so para `grid.ts` e passa a
cobrir os quatro arquivos de aritmetica pura de `render/`.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarefa 2 — o alvo por tipo entra no funil `render/predios.ts`

**Files:**
- Modify: `src/render/predios.ts`
- Test: `tests/F17d-nivelamento.test.ts` (novo `describe`)

**Interfaces:**
- Consome: `canteiroDaObra` (Tarefa 1).
- Produces: `AparenciaDoPredio.alvoDeNivelamento: number`. A Tarefa 3 consome.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `tests/F17d-nivelamento.test.ts`, e acrescentar
`import { aparenciaDoPredio } from '../src/render/predios';` no topo:

```ts
describe('F17d — o funil entrega o alvo do dado', () => {
  it('a aparencia traz o MESMO alvo que a sim usa para nivelar', () => {
    for (const tipo of ['gold_mine', 'barracks', 'quarry', 'woodcutters', 'storehouse']) {
      // igualdade contra a funcao da sim, nunca contra literal: e o unico jeito
      // de o mapa e a simulacao nao divergirem quando `buildings.json` mudar
      expect(aparenciaDoPredio(tipo).alvoDeNivelamento, tipo)
        .toBe(alvoDeNivelamento(tipo, gameData));
    }
  });

  it('tipo desconhecido cai no placeholder do §9: alvo 0, e o jogo nao quebra', () => {
    // `alvoDeNivelamento` da sim LANCA para tipo inexistente; o funil nao pode
    // lancar, porque placeholder e comportamento normal (CLAUDE.md §9).
    expect(() => alvoDeNivelamento('nao-existe', gameData)).toThrow();
    expect(aparenciaDoPredio('nao-existe').alvoDeNivelamento).toBe(0);
  });

  it('o canteiro de uma obra recem-posta, pelo funil, e o footprint inteiro por aplainar', () => {
    const a = aparenciaDoPredio('woodcutters');
    const c = canteiroDaObra(0, a.alvoDeNivelamento, a.largura * a.altura);
    expect(c).toEqual({
      tilesProntos: 0,
      tilesTotais: a.largura * a.altura,
      oitavosDoTileEmCurso: 0,
      nivelada: false,
    });
    gravarEvidencia('F17d', {
      feature: 'F17d-nivelamento-canteiro',
      ticksNivelamentoPorTile: gameData.construcao.ticksNivelamentoPorTile,
      porTipo: ['gold_mine', 'barracks', 'woodcutters'].map((tipo) => {
        const ap = aparenciaDoPredio(tipo);
        const tiles = ap.largura * ap.altura;
        return {
          tipo,
          tiles,
          alvo: ap.alvoDeNivelamento,
          recemPosta: canteiroDaObra(0, ap.alvoDeNivelamento, tiles),
          nivelada: canteiroDaObra(ap.alvoDeNivelamento, ap.alvoDeNivelamento, tiles),
        };
      }),
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run tests/F17d-nivelamento.test.ts`
Expected: FAIL — `alvoDeNivelamento` não existe em `AparenciaDoPredio`.

- [ ] **Step 3: Acrescentar o campo ao funil**

Em `src/render/predios.ts`, trocar o import de `../sim/obra` e a interface:

```ts
import { alvoDeNivelamento, custoDoPredio } from '../sim/obra';
```

```ts
  /** F17b: o custo em material, do dado. O medidor da obra desenha
   *  `custo - faltam`; sem isto a cena nao tem o denominador. */
  readonly custo: Readonly<Record<string, number>>;
  /** F17d: `area do footprint x ticksNivelamentoPorTile`, do dado. O canteiro
   *  desenha `nivelamento / (alvo / tiles)`; sem isto a cena nao tem o
   *  denominador. Vale 0 no placeholder de tipo desconhecido. */
  readonly alvoDeNivelamento: number;
```

Em `construirAparencias`:

```ts
    porTipo[p.id] = {
      largura, altura, nome: temaDePredios[p.id]?.nome ?? p.id, hpTotal: p.hp,
      custo: custoDoPredio(p),
      alvoDeNivelamento: alvoDeNivelamento(p.id),
    };
```

E no fallback de `aparenciaDoPredio`:

```ts
  return aparencias[tipo]
    ?? { largura: 1, altura: 1, nome: tipo, hpTotal: 0, custo: {}, alvoDeNivelamento: 0 };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run tests/F17d-nivelamento.test.ts tests/F17b-medidor-obra.test.ts`
Expected: PASS nos dois (o segundo prova que o funil da F17b não regrediu).

- [ ] **Step 5: Commitar**

```bash
npm run verify
git add src/render/predios.ts tests/F17d-nivelamento.test.ts
git commit -m "$(cat <<'EOF'
feat(F17d): o alvo de nivelamento entra em AparenciaDoPredio

Pelo funil que ja importa `sim/obra` para o `custoDoPredio` — nenhum arquivo
novo de `render/` passa a ler `sim/data`. Tipo desconhecido cai em alvo 0 em
vez de propagar o `throw` da sim: placeholder e comportamento normal (§9).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarefa 3 — a cena desenha o canteiro, e a chave do diff aprende a vê-lo

**Files:**
- Modify: `src/render/debug.ts` (interface `EstadoDebug` e `publicarEstadoDebug`)
- Modify: `src/render/scenes/WorldScene.ts` (`atualizarPredios` :211-273,
  `criarPredio` :301-319, `desenharMedidor` :372-392, e um método novo)

**Interfaces:**
- Consome: `canteiroDaObra`, `chaveDoCanteiro`, `CanteiroDaObra` (Tarefa 1);
  `AparenciaDoPredio.alvoDeNivelamento` (Tarefa 2).
- Produces: `EstadoDebug.canteirosDeObra: Readonly<Record<string, CanteiroDaObra>>`.
  A Tarefa 5 (roteiro) consome.

- [ ] **Step 1: O campo no contrato do harness**

Em `src/render/debug.ts`, importar o tipo:

```ts
import type { CanteiroDaObra } from './nivelamento-obra';
```

E acrescentar à interface `EstadoDebug`, logo depois de `medidoresDeObra` (:51):

```ts
  /** F17d — o canteiro de cada OBRA desenhada agora, por id: quantos tiles do
   *  footprint ja foram aplainados, a fracao do tile em curso em oitavos e se o
   *  terreno acabou. Obra apenas; predio completo nao entra, como em
   *  `medidoresDeObra`. O roteiro afirma sobre isto, nunca por pixel (§8) — e e
   *  o que permite medir o canteiro ENCHENDO contra a primeira leitura, em vez
   *  de so conferir que ele nasceu certo. */
  canteirosDeObra: Readonly<Record<string, CanteiroDaObra>>;
```

E a inicialização em `publicarEstadoDebug`, depois de `medidoresDeObra: {},` (:133):

```ts
    canteirosDeObra: {},
```

- [ ] **Step 2: A chave do diff e a publicação**

Em `src/render/scenes/WorldScene.ts`, acrescentar ao import de render:

```ts
import { canteiroDaObra, chaveDoCanteiro } from '../nivelamento-obra';
import type { CanteiroDaObra } from '../nivelamento-obra';
```

Trocar o comentário de `atualizarPredios` (:203-210) para incluir o canteiro:

```ts
  /** Diff por id, estagio, assinatura do medidor (F17b) E leitura do canteiro (F17d)
   *  contra o que ja esta desenhado: id novo cria, id sumido destroi, mesmo id sem
   *  nada mudado nao mexe. O estagio (F11c: `estagio-obra.ts`) entra na chave, nao so
   *  o `estado` — uma obra que so avanca de `hp` (marcacao -> madeira, ou vira
   *  `'completo'`) mantem o id e precisa ser redesenhada. Sem o diff, redesenhar do
   *  zero a cada chamada recriaria os prédios todo frame. `desenhados` e memoria de
   *  render local da cena — handle do sprite que ela mesma criou, nao estado de jogo
   *  guardado em sprite (§10). */
```

Dentro do laço, declarar o acumulador junto dos outros (`:227`):

```ts
    // F17d: o canteiro de cada obra, para o roteiro. Mesmo criterio de `medidores`.
    const canteiros: Record<string, CanteiroDaObra> = {};
```

E, logo depois do bloco do medidor (`:248`), antes da `assinatura`:

```ts
      // F17d: o canteiro so existe para obra, como o medidor. Predio completo nao
      // tem `obra.nivelamento` (uniao discriminada em `sim/state.ts`).
      const canteiro = predio.estado === 'obra'
        ? canteiroDaObra(
          predio.obra.nivelamento, aparencia.alvoDeNivelamento, aparencia.largura * aparencia.altura,
        )
        : null;
      if (canteiro !== null) canteiros[id] = canteiro;
      // D3 da F17b, agora tambem para o nivelamento: nivelar nao mexe em `estado`
      // nem em `estagio` — `hp` so sobe depois, com o martelo. Sem a leitura do
      // canteiro na chave, ele nasceria certo no primeiro desenho e congelaria ali
      // para sempre, e um screenshot unico passaria assim mesmo. A fracao entra
      // QUANTIZADA em oitavos (`chaveDoCanteiro`): redesenho limitado a 8 por tile,
      // e chave testavel, em vez de um float diferente a cada tick.
      const assinatura = `${linhas.map((l) => l.entregue).join(',')}|${chaveDoCanteiro(canteiro)}`;
```

(a linha antiga `const assinatura = linhas.map((l) => l.entregue).join(',');` some.)

Trocar a criação (`:257-260`) para passar o canteiro:

```ts
      this.desenhados.set(id, {
        estado: predio.estado, estagio, assinatura,
        objeto: this.criarPredio(predio, estagio, linhas, canteiro, tilePx),
      });
```

E publicar, junto das outras (`:271`):

```ts
    debug.canteirosDeObra = canteiros;
```

`debug.medidoresDeObra` **não muda de forma** — requisito de não-regressão do
item da fila.

- [ ] **Step 3: O desenho**

Em `criarPredio` (:301), receber o canteiro e desenhá-lo **debaixo** do corpo:

```ts
  private criarPredio(
    predio: Predio, estagio: EstagioDaObra, linhas: readonly LinhaDoMedidor[],
    canteiro: CanteiroDaObra | null, tilePx: number,
  ): Phaser.GameObjects.Container {
    const { largura, altura, nome } = aparenciaDoPredio(predio.tipo);
    const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx);
    const larguraPx = largura * tilePx;
    const alturaPx = altura * tilePx;

    const sprite = this.spriteDoPredio(predio.tipo, estagio);
    const corpo = sprite === null
      ? this.desenharPlaceholder(estagio, nome, larguraPx, alturaPx)
      : [this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx)];

    // O canteiro vai PRIMEIRO no container: ele e o chao, e o corpo da obra fica
    // por cima. O medidor da F17b continua por ultimo.
    const container = this.add.container(canto.x, canto.y, [
      ...this.desenharCanteiro(canteiro, largura, tilePx),
      ...corpo,
      ...this.desenharMedidor(linhas, larguraPx, alturaPx, canteiro === null || canteiro.nivelada),
    ]);
    container.setDepth(depthDeY(canto.y + alturaPx));
    return container;
  }
```

O método novo, logo antes de `desenharMedidor`:

```ts
  /** F17d — o canteiro: um retangulo de terra aplainada por tile ja nivelado, na
   *  ordem em que o laborer aplaina (linha a linha, da esquerda para a direita).
   *  O tile em curso entra parcial, pela fracao QUANTIZADA em oitavos que a chave
   *  do diff tambem carrega (`nivelamento-obra.ts`) — desenhar a fracao continua
   *  aqui criaria mudanca visivel que a chave nao ve.
   *
   *  Placeholder geometrico (§9), como o medidor da F17b. A pergunta que ele
   *  responde ("esta obra ja pode receber material, ou ainda esta sendo
   *  preparada?") e de longe, sem clicar. Vazio para predio completo.
   *
   *  Cor e opacidade sao DESENHO, nao balanceamento: ficam aqui, como o resto do
   *  placeholder ja fica (§2.3 fala de custo, tempo, capacidade e proporcao). */
  private desenharCanteiro(
    canteiro: CanteiroDaObra | null, larguraEmTiles: number, tilePx: number,
  ): Phaser.GameObjects.GameObject[] {
    if (canteiro === null || canteiro.tilesTotais <= 0) return [];
    const COR = 0x8a6a4a;
    const OPACIDADE = 0.55;
    const OITAVOS = 8;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const porLinha = Math.max(1, larguraEmTiles);
    const bloco = (n: number, largura: number): void => {
      if (largura <= 0) return;
      const coluna = n % porLinha;
      const fileira = Math.floor(n / porLinha);
      // origem no canto superior esquerdo do tile: o tile em curso enche da
      // esquerda para a direita, e nao a partir do centro
      const r = this.add.rectangle(
        coluna * tilePx, fileira * tilePx, largura, tilePx, COR, OPACIDADE,
      );
      r.setOrigin(0, 0);
      objetos.push(r);
    };
    for (let n = 0; n < canteiro.tilesProntos; n++) bloco(n, tilePx);
    bloco(canteiro.tilesProntos, (canteiro.oitavosDoTileEmCurso / OITAVOS) * tilePx);
    return objetos;
  }
```

- [ ] **Step 4: O medidor de material esmaecido, não escondido**

Trocar a assinatura e o corpo de `desenharMedidor` (:372):

```ts
  private desenharMedidor(
    linhas: readonly LinhaDoMedidor[], larguraPx: number, alturaPx: number, aceso: boolean,
  ): Phaser.GameObjects.GameObject[] {
    const LADO = 8;
    const VAO = 2;
    // F17d: enquanto o terreno esta sendo aplainado, a obra ainda nao recebe
    // material — o medidor fica ESMAECIDO, nunca escondido. Escondido mudaria o
    // que o roteiro da F17b conta; esmaecido responde "ainda nao e a vez dele"
    // sem apagar o denominador que o jogador ja aprendeu a ler.
    const OPACIDADE = aceso ? 1 : 0.3;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    linhas.forEach((linha, i) => {
      const larguraDaFileira = linha.total * LADO + (linha.total - 1) * VAO;
      const x0 = (larguraPx - larguraDaFileira) / 2 + LADO / 2;
      // de baixo para cima: a ultima fileira encosta no pe do retangulo
      const y = alturaPx - 6 - (linhas.length - 1 - i) * (LADO + VAO);
      for (let n = 0; n < linha.total; n++) {
        const cheio = n < linha.entregue;
        const bloco = this.add.rectangle(x0 + n * (LADO + VAO), y, LADO, LADO,
          0xede3d0, (cheio ? 1 : 0) * OPACIDADE);
        bloco.setStrokeStyle(1, 0xede3d0, (cheio ? 1 : 0.5) * OPACIDADE);
        objetos.push(bloco);
      }
    });
    return objetos;
  }
```

O número de blocos **não muda** — só a opacidade. `medidoresDeObra` continua
idêntico, e o roteiro da F17b conta número, não pixel.

- [ ] **Step 5: Verificar e commitar**

```bash
npm run verify
```

Expected: verde. `npm run typecheck` reprova se algum `criarPredio` ou
`desenharMedidor` tiver ficado com a assinatura velha.

```bash
git add src/render/debug.ts src/render/scenes/WorldScene.ts
git commit -m "$(cat <<'EOF'
feat(F17d): a cena desenha o canteiro, e o diff aprende a ve-lo

Um retangulo de terra por tile aplainado, mais o tile em curso pela fracao
quantizada. A leitura do canteiro entra na assinatura do diff: nivelar nao
mexe em `estado` nem em `estagio`, entao sem isso o canteiro nasceria certo e
congelaria para sempre — a armadilha que a F17b ja mediu no medidor.

O medidor de material fica esmaecido enquanto o terreno esta sendo aplainado,
nunca escondido: o numero de blocos nao muda e `medidoresDeObra` mantem a
forma, entao o roteiro da F17b continua valendo.

`debug.canteirosDeObra` publica a leitura para o roteiro afirmar sobre numero,
nunca sobre pixel.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarefa 4 — o painel passa a usar a mesma aritmética do mapa

**Files:**
- Modify: `src/ui/painel-predio.ts` (`desenharObra`, o bloco escrito na Tarefa 0)

**Interfaces:**
- Consome: `canteiroDaObra` (Tarefa 1), `PainelDoPredio.nivelamento` (Tarefa 0).

- [ ] **Step 1: Trocar a conta inline pela função**

No import da F17b (`:25`), acrescentar:

```ts
import { medidorDaObra } from '../render/medidor-obra';
import { canteiroDaObra } from '../render/nivelamento-obra';
```

E, em `desenharObra`, trocar o bloco inline da Tarefa 0 por:

```ts
  const nivelamento = dados.nivelamento;
  const canteiro = nivelamento === null
    ? null
    : canteiroDaObra(nivelamento.feito, nivelamento.alvo, nivelamento.tiles);
  if (canteiro !== null && !canteiro.nivelada) {
    // A MESMA funcao que a cena desenha no mapa (F17d). Como `medidor-obra.ts`,
    // o arquivo nao tem import nenhum, entao traze-lo para ca nao abre o caminho
    // que `menu-build.ts` fechou de proposito: `ui/` continua sem ler `sim/data`.
    // Os tres numeros vem do seletor justamente por isso.
    const l = linha('nivelamento', rotulos.nivelando, `${canteiro.tilesProntos}/${canteiro.tilesTotais}`);
    l.dataset.tilesProntos = String(canteiro.tilesProntos);
    l.dataset.tilesTotais = String(canteiro.tilesTotais);
    raiz.append(l);
  } else {
    raiz.append(linha('obra', rotulos.emObra, `${Math.round(dados.progresso * 100)}%`));
  }
```

- [ ] **Step 2: Verificar**

Run: `npm run verify`
Expected: verde. O comportamento não muda (a conta é a mesma); o que muda é
haver **uma** conta.

- [ ] **Step 3: Commitar**

```bash
git add src/ui/painel-predio.ts
git commit -m "$(cat <<'EOF'
feat(F17d): o painel usa a mesma aritmetica do canteiro que o mapa

A conta inline que a correcao da F16b deixou sai, e entra `canteiroDaObra` —
a mesma funcao que a cena desenha. Duas contas para o mesmo numero acabam
divergindo, e o roteiro confere painel contra mapa por isso.

`ui/` continua sem ler `sim/data`: `nivelamento-obra.ts` nao importa nada e os
tres numeros chegam pelo seletor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarefa 5 — o roteiro de tela

**Files:**
- Create: `tools/shots/F17d.js`

**Interfaces:**
- Consome: `window.__cangaco.canteirosDeObra` (Tarefa 3), os atributos
  `data-tiles-prontos` / `data-tiles-totais` do painel (Tarefa 4).
- Produz: `screenshots/F17d-1-nivelando.png`, `screenshots/F17d-2-nivelada.png`,
  `test-output/F17d-shot.json`.

**A ordem das capturas importa:** o runner numera por ordem de chamada
(`screenshots/<feature>-<n>-<passo>.png`), e a evidência escrita no BUILD_PLAN é
`F17d-1-nivelando.png` e `F17d-2-nivelada.png`. Nenhuma captura antes dessas
duas.

- [ ] **Step 1: Escrever o roteiro**

Criar `tools/shots/F17d.js`:

```js
'use strict';

// Roteiro da F17d — O NIVELAMENTO VISIVEL NO CANTEIRO.
//
// O que ele existe para provar, e que um screenshot unico NAO provaria: o
// canteiro ENCHE. Um canteiro que nasce correto e nunca mais muda passa em
// qualquer foto tirada uma vez so — e era esse o risco do desenho (D1 do plano),
// o mesmo que a F17b mediu no medidor: nivelar nao mexe em `estado` nem em
// `estagio`, que eram a chave inteira do diff de `atualizarPredios`. Por isso a
// medida e SEMPRE contra a PRIMEIRA LEITURA, feita no tick da planta, nunca
// contra zero.
//
// Afirma numero, nunca pixel (§8): o canteiro do mapa sai de
// `window.__cangaco.canteirosDeObra` e o painel sai do DOM. As duas fontes sao
// separadas de proposito, e no fim o roteiro confere uma contra a outra — mapa e
// painel fazem a MESMA conta (`render/nivelamento-obra.ts`), e divergirem seria
// o defeito que a funcao unica existe para impedir.
//
// Geometria: a mesma linha ja validada na F16b e na F17b — rua na linha de porta
// do armazem, o predio novo a direita da escola.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');
const { construcao } = require('../../data/construction.json') || {};

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TIPO_DA_OBRA = 'woodcutters';
/** Um laborer precisa nascer, achar a tarefa e CAMINHAR ate a obra antes do
 *  primeiro tick de nivelamento. A F17b mediu o primeiro material chegando nesta
 *  mesma geometria com folga dentro de 1000 ticks, e o nivelamento acontece
 *  ANTES do material — 1000 e o mesmo teto, com a mesma folga. Falhar por teto E
 *  FALHAR, nao motivo para dormir mais. */
const TETO_ATE_COMECAR = 1000;
/** 10 ticks por tile no dado de hoje: um passo de 10 avanca NO MAXIMO um tile,
 *  entao o canteiro nunca pula de vazio para cheio entre duas leituras. E o que
 *  torna o screenshot do canteiro pela metade alcancavel, e nao sorte. */
const PASSO_DE_AVANCO = 10;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  /** O canteiro que a CENA desenhou para esta obra, no tick desenhado. */
  async function canteiroNoMapa(id) {
    const c = (await estado()).canteirosDeObra[id];
    afirmar(
      c !== undefined && c !== null && typeof c.tilesProntos === 'number',
      `a cena deveria publicar o canteiro da obra ${id}, veio ${JSON.stringify(c)}`,
    );
    return c;
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largObra, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const TILES_DA_OBRA = largObra * altObra;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const obra = { gx: escola.gx + largEs + 1, gy: yRua - altObra };
  const meioDaObra = { gx: obra.gx + Math.floor(largObra / 2), gy: obra.gy };
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: obra.gx + largObra - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;

  // ---- 1. a rua ------------------------------------------------------------
  // Sem rede o laborer nunca chega e o canteiro ficaria em 0 pelo motivo errado —
  // o roteiro reprovaria por teto sem dizer o porque.
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pEsq = await pontoDoTile(pontaEsquerda.gx, pontaEsquerda.gy);
  const pDir = await pontoDoTile(pontaDireita.gx, pontaDireita.gy);
  await arrastarDentroDoCanvas(page, canvas, [pEsq, pDir]);
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await estado()).estradasRenderizadas === tilesDaRua,
    `a rua deveria ter ${tilesDaRua} tiles, veio ${(await estado()).estradasRenderizadas}`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a obra, recem-plantada: o canteiro nasce VAZIO --------------------
  await page.click(`[data-predio="${TIPO_DA_OBRA}"]`);
  await esperarFrame();
  await clicarNoTile(obra.gx, obra.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();

  const doEstado = (await estado()).prediosDoEstado;
  const achado = Object.entries(doEstado).find(([, p]) => p.gx === obra.gx && p.gy === obra.gy);
  afirmar(achado !== undefined, `deveria existir um predio plantado em (${obra.gx},${obra.gy})`);
  const ID_DA_OBRA = achado[0];
  afirmar(achado[1].estado === 'obra', 'o predio recem-plantado deveria estar em obra');

  // A PRIMEIRA LEITURA, no tick da planta. E contra ela que tudo se mede.
  const PRIMEIRA = await canteiroNoMapa(ID_DA_OBRA);
  afirmar(
    PRIMEIRA.tilesProntos === 0 && PRIMEIRA.nivelada === false,
    `obra recem-plantada nao tem tile aplainado nenhum, veio ${JSON.stringify(PRIMEIRA)}`,
  );
  afirmar(
    PRIMEIRA.tilesTotais === TILES_DA_OBRA,
    `o canteiro deveria ter os ${TILES_DA_OBRA} tiles do footprint do dado, veio ${PRIMEIRA.tilesTotais}`,
  );

  // ---- 3. ACEITE: o canteiro ENCHE -----------------------------------------
  let canteiro = PRIMEIRA;
  let ticks = 0;
  while (canteiro.tilesProntos <= PRIMEIRA.tilesProntos && ticks < TETO_ATE_COMECAR) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    // a obra pode ter ficado pronta: ai ela sai de `canteirosDeObra` e a janela
    // do teste se fechou — e isso e falha, nao sucesso.
    const publicado = (await estado()).canteirosDeObra[ID_DA_OBRA];
    afirmar(
      publicado !== undefined,
      `a obra sumiu do canteiro no tick ~${ticks} sem que nenhum tile tivesse sido aplainado`,
    );
    canteiro = publicado;
  }
  // contra a PRIMEIRA LEITURA, e nao contra 0: e o que separa "o canteiro
  // acompanha" de "o canteiro nasceu com um numero e congelou" (D1).
  afirmar(
    canteiro.tilesProntos > PRIMEIRA.tilesProntos,
    `em ${TETO_ATE_COMECAR} ticks nenhum tile foi aplainado: `
      + `${JSON.stringify(PRIMEIRA)} -> ${JSON.stringify(canteiro)}`,
  );
  afirmar(
    canteiro.tilesProntos <= canteiro.tilesTotais,
    `o canteiro nunca passa do footprint, veio ${JSON.stringify(canteiro)}`,
  );

  // ---- 4. o painel diz o mesmo numero, DURANTE o nivelamento ----------------
  // Antes da foto: o painel e sobreposicao no canto do canvas, e precisa estar
  // fechado quando a foto do mapa sair.
  await clicarNoTile(meioDaObra.gx, meioDaObra.gy);
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-predio-aberto')) === ID_DA_OBRA,
    'o clique deveria abrir o painel da obra que o roteiro plantou',
  );
  const noPainel = await page.$eval('#painel-predio .linha.nivelamento', (n) => ({
    prontos: Number(n.dataset.tilesProntos),
    totais: Number(n.dataset.tilesTotais),
    texto: n.textContent,
  }));
  // GUARDA: o painel contra o MAPA, nao contra numero digitado aqui. Os dois
  // chamam `canteiroDaObra`; divergirem seria o que a funcao unica impede.
  const noMapa = await canteiroNoMapa(ID_DA_OBRA);
  afirmar(
    noPainel.prontos === noMapa.tilesProntos && noPainel.totais === noMapa.tilesTotais,
    `painel e mapa deveriam dizer o mesmo: ${JSON.stringify(noPainel)} vs ${JSON.stringify(noMapa)}`,
  );
  afirmar(
    noPainel.texto.includes(tema.painelPredio.nivelando),
    `o rotulo deveria vir do tema ("${tema.painelPredio.nivelando}"), veio ${JSON.stringify(noPainel.texto)}`,
  );
  // O DEFEITO DA F16b que a Tarefa 0 corrigiu: durante o nivelamento o painel
  // NAO pode mais escrever "Em obra 0%" — as duas linhas sao exclusivas.
  afirmar(
    (await page.$('#painel-predio .linha.obra')) === null,
    'durante o nivelamento o painel nao deveria escrever "Em obra 0%" (defeito da F16b)',
  );
  await page.keyboard.press('Escape'); // fecha o painel antes da foto do mapa
  await esperarFrame();

  // ---- 5. FOTO 1: o canteiro pela metade -----------------------------------
  const METADE = Math.ceil(TILES_DA_OBRA / 2);
  while (canteiro.tilesProntos < METADE && !canteiro.nivelada && ticks < TETO_ATE_COMECAR * 2) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    const publicado = (await estado()).canteirosDeObra[ID_DA_OBRA];
    afirmar(publicado !== undefined, `a obra sumiu do canteiro no tick ~${ticks}`);
    canteiro = publicado;
  }
  afirmar(
    canteiro.tilesProntos >= METADE && !canteiro.nivelada,
    `a foto 1 precisa do canteiro PELA METADE (>= ${METADE} e < ${TILES_DA_OBRA}), `
      + `veio ${JSON.stringify(canteiro)}`,
  );
  await capturar('nivelando'); // F17d-1-nivelando.png

  // ---- 6. FOTO 2: o canteiro plano, com o medidor de material aceso --------
  while (!canteiro.nivelada && ticks < TETO_ATE_COMECAR * 3) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    const publicado = (await estado()).canteirosDeObra[ID_DA_OBRA];
    afirmar(
      publicado !== undefined,
      `a obra ficou PRONTA antes de o roteiro fotografar o canteiro plano (tick ~${ticks})`,
    );
    canteiro = publicado;
  }
  afirmar(
    canteiro.nivelada && canteiro.tilesProntos === canteiro.tilesTotais,
    `no fim o canteiro deveria estar plano, veio ${JSON.stringify(canteiro)}`,
  );
  // o medidor de material continua publicado e com a mesma forma: nivelar nao
  // esconde nada, so esmaece — e agora ele esta aceso.
  const medidor = (await estado()).medidoresDeObra[ID_DA_OBRA];
  afirmar(
    Array.isArray(medidor) && medidor.length > 0 && medidor.every((l) => l.total > 0),
    `o medidor de material deveria continuar publicado e com denominador, veio ${JSON.stringify(medidor)}`,
  );
  await capturar('nivelada'); // F17d-2-nivelada.png
}

module.exports = { roteiro };
```

> **Atenção ao escrever o arquivo:** a linha
> `const { construcao } = require('../../data/construction.json') || {};` do
> rascunho acima **não deve existir** — `data/construction.json` não existe
> (verificado nesta sessão) e o roteiro não precisa dele. Remova-a.

- [ ] **Step 2: Rodar o roteiro**

Run: `npm run shot -- F17d`
Expected: `EXIT=0`, e os arquivos `screenshots/F17d-1-nivelando.png` e
`screenshots/F17d-2-nivelada.png` criados.

Se reprovar por teto, **não aumente o teto sem medir**: leia o tick em que parou
na mensagem, e verifique se o laborer chegou (a rua foi criada? `estradasRenderizadas`
bateu?). Teto que falha É falha.

- [ ] **Step 3: Abrir a evidência (a única imagem desta sessão)**

Abrir `screenshots/F17d-1-nivelando.png` com a ferramenta Read — é a feature
atual, e o §8 exige evidência aberta. **Não abrir a segunda nem nenhuma das
outras features**: imagem é o que mais pesa na janela de contexto.

Conferir: o canteiro da obra aparece parcialmente preenchido, e o medidor de
material está esmaecido.

- [ ] **Step 4: Não-regressão dos roteiros vizinhos, por código de saída**

```bash
npm run shot -- F17b; echo "F17b EXIT=$?"
npm run shot -- F16b; echo "F16b EXIT=$?"
npm run shot -- F11c; echo "F11c EXIT=$?"
```

Expected: `EXIT=0` nos três. **Sem abrir nenhuma imagem** (§8, e
`[[screenshot-de-regressao-nao-se-abre-com-read]]`): o que vale aqui é o código
de saída. F17b porque o medidor mudou de opacidade e o diff mudou de chave; F16b
porque o painel da obra mudou de linha; F11c porque `criarPredio` mudou de
assinatura.

- [ ] **Step 5: Commitar**

```bash
git add tools/shots/F17d.js screenshots/F17d-1-nivelando.png screenshots/F17d-2-nivelada.png
git commit -m "$(cat <<'EOF'
feat(F17d): o roteiro de tela do canteiro

Planta uma obra, le `tilesProntos` no TICK DA PLANTA e afirma, depois de
avancar, maior que essa primeira leitura — nunca maior que zero. E o que
separa "o canteiro acompanha" de "o canteiro nasceu certo e congelou".

Confere painel contra mapa (as duas fontes chamam `canteiroDaObra`) e afirma
que durante o nivelamento o painel nao escreve mais "Em obra 0%".

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Tarefa 6 — fechar a feature

- [ ] **Step 1: `npm run verify`**

```bash
npm run verify
```

Expected: typecheck + lint + validate:data + test verdes, `.verify-ok` criado. O
selo vale 15 minutos — os passos seguintes têm de caber nessa janela.

- [ ] **Step 2: Abrir a evidência headless com Read**

Abrir `test-output/F17d.json` com a ferramenta Read e conferir, contra o aceite
do BUILD_PLAN:
- `porTipo` traz `gold_mine` com `tiles: 2` e `barracks` com `tiles: 16`;
- `recemPosta.tilesProntos === 0` nos dois;
- `nivelada.tilesProntos === tiles` e `nivelada.nivelada === true` nos dois.

- [ ] **Step 3: `test-results.json`**

Acrescentar, mantendo a ordem do arquivo (a entrada nova vai no fim, como as
anteriores):

```json
  "F17d-nivelamento-canteiro": { "passes": true }
```

O hook recusa a escrita se o `npm run verify` não tiver passado nos últimos 15
minutos.

- [ ] **Step 4: `PROGRESS.md`**

No topo, uma seção da F17d, separando o que foi **verificado** do que é
**hipótese** (CLAUDE.md §6):

- o que foi feito, e a decisão D3 (por que `tiles` entrou no seletor junto com
  `feito`/`alvo`, e por que a conta inline da Tarefa 0 foi substituída na Tarefa 4);
- a leitura do item da fila que autorizou a Tarefa 0 a abrir `src/sim/`, com o
  precedente `e014a0c` citado;
- a **guarda permanente** (a chave do diff com os oitavos + a guarda de "zero
  imports" generalizada na F04) separada do **probe** do Step 6 da Tarefa 1, que
  é evidência da sessão e não cobertura contínua (§8);
- a medição `ticksNivelamentoPorTile = 10` e a consequência "10 ticks = 1 tile"
  que o roteiro usa;
- os códigos de saída dos três roteiros de não-regressão.

- [ ] **Step 5: Commit final**

```bash
git add PROGRESS.md test-results.json BUILD_PLAN.md
git commit -m "$(cat <<'EOF'
feat(F17d): nivelamento visivel no canteiro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Definition of Done (CLAUDE.md §7)

- [ ] `npm run test` verde, incluindo `tests/F17d-nivelamento.test.ts`
- [ ] `npm run typecheck` e `npm run lint` sem erro
- [ ] `npm run validate:data` passa
- [ ] Aceite verificado com evidência **aberta pela ferramenta Read**:
      `test-output/F17d.json` e `screenshots/F17d-1-nivelando.png`
- [ ] Nenhum import de `phaser` em `src/sim/`; `src/sim/` só tocado na Tarefa 0
- [ ] Roteiros F17b, F16b e F11c com `EXIT=0`, sem abrir imagem
- [ ] Commits feitos (um `fix(F16b)` + cinco `feat(F17d)`)

---

## Auto-revisão do plano

**Cobertura do aceite escrito no BUILD_PLAN:**

| exigência do item | onde |
|---|---|
| `nivelamento = 0` dá 0 tiles | Tarefa 1, caso "nivelamento 0" |
| `= alvo` dá todos e `nivelada` | Tarefa 1, caso "nivelamento = alvo" |
| footprint de 2 (`gold_mine`) e de 16 (`barracks`) | Tarefa 1, `MINA`/`QUARTEL`, derivados do dado |
| roteiro lê `tilesProntos` no tick da planta | Tarefa 5, passo 2 (`PRIMEIRA`) |
| afirma maior que a primeira leitura, não maior que zero | Tarefa 5, passo 3 |
| screenshot do canteiro pela metade | Tarefa 5, passo 5 |
| screenshot do canteiro plano com o medidor aceso | Tarefa 5, passo 6 |
| `test-output/F17d.json` | Tarefa 2, `gravarEvidencia` |
| aritmética pura em `render/nivelamento-obra.ts`, zero imports | Tarefa 1 + guarda da F04 |
| alvo por tipo em `AparenciaDoPredio` pelo funil | Tarefa 2 |
| Tarefa 0 `fix(F16b)` em commit próprio, primeira | Tarefa 0 |
| a fração na chave do diff, quantizada em oitavos | Tarefa 3, `chaveDoCanteiro` |
| roteiro da F17b passando por código de saída | Tarefa 5, passo 4 |
| medidor esmaecido, não escondido | Tarefa 3, passo 4 |
| `debug.medidoresDeObra` não muda de forma | Tarefa 3, passo 2 (campo novo é separado) |
| laborer continua parado | fora do escopo, §0 |

**Consistência de tipos:** `CanteiroDaObra` (Tarefa 1) é consumido com os mesmos
quatro campos na Tarefa 3 (cena e debug) e na Tarefa 4 (painel);
`AparenciaDoPredio.alvoDeNivelamento` (Tarefa 2) é lido só na Tarefa 3;
`PainelDoPredio.nivelamento` (Tarefa 0) é lido só na Tarefa 4, com os três campos
que a Tarefa 0 declara.
