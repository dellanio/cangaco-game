# F18a — Zoom da câmera (render + input)

> **Para quem executa:** este plano é para execução INLINE, tarefa a tarefa, na
> sessão que o escreveu. **Não** use `subagent-driven-development` nem
> `dispatching-parallel-agents` (CLAUDE.md §11). Os passos usam `- [ ]`.

**Objetivo:** a câmera ganha zoom em passos discretos lidos de `data/`, pela roda
do mouse, ancorado no cursor — e a conversão grid↔pixel da F04 passa a declarar a
escala em que trabalha, com a ida e volta provada em todos os níveis.

**Arquitetura:** `grid.ts` continua aritmética pura de ZERO imports e ganha
`escala` como parâmetro explícito nas três conversões. Quem desenha trabalha em
**pixels de mundo** e passa a constante `ESCALA_DO_MUNDO`; quem converte pixel de
**tela** passa o zoom. Os níveis e o nível inicial saem de `data/terrain.json`
pelo funil `render/mapa.ts`. A cena liga a roda do mouse em `camera.setZoom` e
ancora no cursor usando o próprio `getWorldPoint` do Phaser, duas vezes.

**Stack:** TypeScript estrito, Vitest headless, Playwright por `tools/shot.js`.

**Fonte do critério:** `BUILD_PLAN.md`, item "F18a — Zoom da câmera (render +
input)" (linhas 1026–1044), que encerra a Nota da F05b (linhas 86–89). Este plano
não reescreve nenhum dos dois.

---

## Restrições globais

- **`src/sim/` não muda.** Zoom é câmera, não regra: a simulação não sabe que ele
  existe. Se a implementação parecer pedir campo no `GameState` ou comando novo,
  **pare e reporte**.
- `src/render/grid.ts` continua com **zero imports** — guarda estrutural em
  `tests/F04-grid-ortogonal.test.ts` (`ARITMETICA_PURA_EM_RENDER`).
- Só `render/mapa.ts` e `render/predios.ts` podem ler `../sim/data` (guarda dos
  funis, mesma F04). Os níveis de zoom entram por `mapa.ts`.
- Os níveis são **dado de render**, e `npm run validate:data` precisa aceitá-los
  (Nota do BUILD_PLAN). Não são balanceamento de simulação.
- **O nível inicial é 1.** É o que faz todo roteiro já validado (F06, F07, F08,
  F11c, F16b, F17b, F17d, F17e, F17f) continuar verde sem uma linha alterada: a
  geometria deles assume escala 1, e vão continuar abrindo em escala 1.
- Nenhuma dependência nova.
- Evidência: `test-output/F18a.json` + `screenshots/F18a-*.png`.

---

## A decisão de projeto que o executor precisa entender antes de escrever código

Sob o Phaser, **o objeto desenhado vive em pixels de mundo e a câmera aplica o
zoom**. Um retângulo em `(gx*64, gy*64)` aparece no lugar certo em qualquer zoom
sem que ninguém multiplique nada. E `camera.getWorldPoint(x, y)` já **inverte** o
zoom: ele devolve mundo a partir de pixel de tela.

Disso saem duas consequências que mandam no desenho desta feature:

1. **Multiplicar pela escala no caminho do ponteiro seria dividir duas vezes.**
   O ponto que chega em `screenToGrid` hoje já passou por `getWorldPoint`, ou
   seja, já é mundo. Ele continua passando `ESCALA_DO_MUNDO`. Quem trocar isso
   pelo zoom quebra o clique em todo nível diferente de 1 — e o roteiro da
   Tarefa 4 existe justamente para acusar isso.
2. **O consumidor real da escala ≠ 1 está nos roteiros.** Todo roteiro calcula
   `canvas.left + gx * TILE_PX - camera.scrollX` à mão. Essa fórmula é falsa sob
   zoom: tela = `(mundo − scroll) * zoom`. O helper novo em `tools/shots/_canvas.js`
   é quem passa a carregar a fórmula certa, e o roteiro da F18a prova que ela
   bate com a realidade — ele clica por ela no zoom mínimo e no máximo e afirma
   qual tile o jogo destacou.

Então: o parâmetro `escala` entra em `grid.ts` porque a Nota da F05b manda e
porque a invariante passa a ser verificável nos níveis; o caminho de produção em
TS continua zoom-agnóstico **por construção**, e isso é informação para o
PROGRESS, não lacuna.

---

## Mapa de arquivos

| arquivo | o que acontece |
|---|---|
| `data/terrain.json` | bloco `zoom`: `niveis` e `inicial` |
| `tools/data-rules.js` | valida o bloco: níveis crescentes, > 0, `inicial` na lista, `tile_px * nivel` inteiro |
| `src/render/grid.ts` | `escala` obrigatória nas três conversões + `ESCALA_DO_MUNDO` |
| `src/render/zoom.ts` | **novo**: aritmética pura dos níveis (`proximoNivel`), zero imports |
| `src/render/mapa.ts` | `ConfigDoMapa.zoom: { niveis, inicial }` |
| `src/render/debug.ts` | `camera.zoom` |
| `src/render/scenes/WorldScene.ts` | roda do mouse, `setZoom`, ancoragem no cursor, publicação |
| `src/render/estradas.ts`, `planta-fantasma.ts`, `unidades.ts` | passam `ESCALA_DO_MUNDO` |
| `tests/F04-grid-ortogonal.test.ts` | chamadas ganham o argumento; guarda dos puros ganha `zoom.ts` |
| `tests/F18a-zoom.test.ts` | **novo**: ida e volta × níveis, `proximoNivel`, dado |
| `tools/shots/_canvas.js` | **novo helper** `pontoDoTileNaTela`, ciente de zoom |
| `tools/shots/F18a.js` | **novo**: mesmo ponto de mouse no mínimo e no máximo |

---

## Tarefa 1 — o dado: níveis de zoom em `data/`, validados

**Files:**
- Modify: `data/terrain.json`
- Modify: `tools/data-rules.js`
- Modify: `src/sim/data/types.ts`, `src/sim/data/loader.ts` (só o tipo/leitura de `terreno`, se houver)
- Modify: `src/render/mapa.ts`
- Test: `tests/F18a-zoom.test.ts` (parte do dado)

**Interfaces:**
- Produz: `configDoMapa.zoom: { readonly niveis: readonly number[]; readonly inicial: number }`.

**Por que os níveis são estes:** `0.5, 0.75, 1, 1.5, 2`. Três razões, e nenhuma é
gosto: (a) `1` precisa estar na lista e ser o inicial, senão todo roteiro
validado muda de geometria; (b) `tile_px * nivel` é inteiro em todos —
`32, 48, 64, 96, 128` —, e é isso que mantém a ida e volta exata sem depender de
sorte de ponto flutuante; (c) a Nota do BUILD_PLAN mede que a 64² com tile de 64 e
viewport de 1280×720 o jogador vê 20×11 tiles: em `0.5` ele vê 40×22, que é o
enquadramento de navegação que falta hoje.

- [ ] **Passo 1: escrever o teste que falha** — `tests/F18a-zoom.test.ts`, primeiro bloco

```ts
/**
 * F18a — zoom da camera. Plano em `docs/planos/F18a-zoom-da-camera.md`.
 *
 * Zoom e CAMERA, nao regra: nada aqui toca `src/sim/`. O que este arquivo prova
 * e a aritmetica — a ida e volta da F04 continua exata em todos os niveis, e a
 * lista de niveis vem do dado, nao digitada no codigo.
 */
import { describe, it, expect } from 'vitest';
import { configDoMapa } from '../src/render/mapa';
import { gameData } from '../src/sim/data';

describe('F18a — os niveis de zoom vem de data/terrain.json', () => {
  it('configDoMapa.zoom espelha gameData.terreno.zoom', () => {
    expect([...configDoMapa.zoom.niveis]).toEqual([...gameData.terreno.zoom.niveis]);
    expect(configDoMapa.zoom.inicial).toBe(gameData.terreno.zoom.inicial);
  });

  it('o nivel inicial e 1: e o que mantem a geometria de todo roteiro ja validado', () => {
    expect(configDoMapa.zoom.inicial).toBe(1);
    expect(configDoMapa.zoom.niveis).toContain(1);
  });

  it('os niveis sao crescentes, positivos e sem repeticao', () => {
    const n = configDoMapa.zoom.niveis;
    expect(n.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n.length; i++) {
      expect(n[i], `nivel ${i}`).toBeGreaterThan(0);
      if (i > 0) expect(n[i], `nivel ${i}`).toBeGreaterThan(n[i - 1]);
    }
  });

  it('tilePx * nivel e INTEIRO em todo nivel: e o que mantem a ida e volta exata', () => {
    for (const nivel of configDoMapa.zoom.niveis) {
      expect(Number.isInteger(configDoMapa.tilePx * nivel), `nivel ${nivel}`).toBe(true);
    }
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run tests/F18a-zoom.test.ts`
Esperado: FALHA — `gameData.terreno.zoom` é `undefined`.

- [ ] **Passo 3: o dado** — em `data/terrain.json`, ao lado de `mapaPadrao`

```json
"zoom": {
  "_doc": "Dado de RENDER, nao balanceamento (CLAUDE.md §2.3 fala de custo, tempo, capacidade e proporcao): zoom nao muda regra nenhuma. Passos discretos, crescentes. tile_px * nivel e inteiro em todos — 32, 48, 64, 96, 128 —, que e o que mantem a ida e volta da F04 exata sem depender de sorte de ponto flutuante. O inicial e 1 porque todo roteiro de screenshot ja validado assume escala 1.",
  "niveis": [0.5, 0.75, 1, 1.5, 2],
  "inicial": 1
}
```

- [ ] **Passo 4: a regra de validação** — `tools/data-rules.js`

Acrescentar a função e registrá-la junto das outras de `terrain` (procure
`validarEstradaDoTerreno` ou equivalente e siga o mesmo registro):

```js
// F18a — zoom e dado de render. Valida a FORMA e a propriedade que o resto do
// codigo assume: passos crescentes, o neutro presente, e tile_px * nivel inteiro
// (sem isso a ida e volta grid<->pixel acumula erro de float e o clique erra o
// tile em zoom nao-neutro).
function validarZoomDoTerreno(dados, erros) {
  const terrain = dados.terrain;
  if (!terrain) return;
  const zoom = terrain.zoom;
  if (!zoom || typeof zoom !== 'object') {
    erros.push('forma/terrain: terrain.zoom precisa existir (F18a)');
    return;
  }
  if (!Array.isArray(zoom.niveis) || zoom.niveis.length < 3) {
    erros.push('forma/terrain: terrain.zoom.niveis precisa ser lista com pelo menos 3 niveis');
    return;
  }
  let anterior = 0;
  for (const nivel of zoom.niveis) {
    if (typeof nivel !== 'number' || !(nivel > 0)) {
      erros.push(`forma/terrain: terrain.zoom.niveis tem nivel invalido '${nivel}' (precisa ser numero > 0)`);
      continue;
    }
    if (nivel <= anterior) {
      erros.push(`forma/terrain: terrain.zoom.niveis precisa ser crescente e sem repeticao (${nivel} depois de ${anterior})`);
    }
    anterior = nivel;
    if (!Number.isInteger(terrain.tile_px * nivel)) {
      erros.push(
        `forma/terrain: tile_px (${terrain.tile_px}) vezes o nivel de zoom ${nivel} nao e inteiro; `
        + 'a ida e volta grid<->pixel deixaria de ser exata',
      );
    }
  }
  if (!zoom.niveis.includes(zoom.inicial)) {
    erros.push(`forma/terrain: terrain.zoom.inicial (${zoom.inicial}) precisa ser um dos niveis`);
  }
}
```

- [ ] **Passo 5: o tipo e o funil**

Em `src/sim/data/types.ts`, no tipo de `terreno`, acrescentar
`zoom: { niveis: readonly number[]; inicial: number }` (siga a forma exata que
`mapaPadrao` já usa no arquivo — se o loader copiar campo a campo, copie este
junto; se espelhar o JSON inteiro, nada a fazer além do tipo).

Em `src/render/mapa.ts`:

```ts
export interface ConfigDoMapa {
  readonly tilePx: number;
  readonly largura: number;
  readonly altura: number;
  readonly larguraPx: number;
  readonly alturaPx: number;
  /** F18a — os passos de zoom e o neutro, de `data/terrain.json`. Dado de
   *  render: nenhum sistema de `sim/` sabe que zoom existe. */
  readonly zoom: { readonly niveis: readonly number[]; readonly inicial: number };
}

export function criarConfigDoMapa(): ConfigDoMapa {
  const { tilePx, mapaPadrao, zoom } = gameData.terreno;
  return {
    tilePx,
    largura: mapaPadrao.largura,
    altura: mapaPadrao.altura,
    larguraPx: mapaPadrao.largura * tilePx,
    alturaPx: mapaPadrao.altura * tilePx,
    zoom: { niveis: zoom.niveis, inicial: zoom.inicial },
  };
}
```

- [ ] **Passo 6: rodar e ver passar**

Rodar: `npx vitest run tests/F18a-zoom.test.ts` → PASSA.
Rodar: `npm run validate:data` → OK.
Rodar: `npm run typecheck` → sem erro.

- [ ] **Passo 7: provar que a regra ACUSA, não só que não acusa à toa (probe)**

Editar `data/terrain.json` à mão, trocando um nível por `0.7` (`64 * 0.7 = 44.8`),
rodar `npm run validate:data` e conferir que ele **reprova** com a mensagem do
`tile_px`. Depois desfazer. Registrar em `PROGRESS.md` na Tarefa 5 que isto foi
um probe de sessão, e que a proteção permanente é a regra em `data-rules.js`
rodando no `npm run verify` (§8).

- [ ] **Passo 8: commit**

```bash
git add data/terrain.json tools/data-rules.js src/sim/data/types.ts src/render/mapa.ts tests/F18a-zoom.test.ts
git commit -m "feat(F18a): os niveis de zoom viram dado de render validado"
```

---

## Tarefa 2 — `grid.ts` declara a escala, e `zoom.ts` anda pelos níveis

**Files:**
- Modify: `src/render/grid.ts`
- Create: `src/render/zoom.ts`
- Modify: `tests/F04-grid-ortogonal.test.ts`
- Modify: `tests/F18a-zoom.test.ts`
- Modify: `src/render/estradas.ts`, `src/render/planta-fantasma.ts`, `src/render/unidades.ts`, `src/render/scenes/WorldScene.ts`

**Interfaces:**
- Produz:
  - `ESCALA_DO_MUNDO = 1`
  - `gridToScreen(tile: Tile, tilePx: number, escala: number): Ponto`
  - `gridToScreenCentro(tile: Tile, tilePx: number, escala: number): Ponto`
  - `screenToGrid(ponto: Ponto, tilePx: number, escala: number): Tile`
  - `proximoNivel(niveis: readonly number[], atual: number, direcao: number): number`

**Por que num commit só:** o terceiro parâmetro é **obrigatório** — opcional com
default seria a mesma coisa que não existir, e a Nota da F05b pede que a conversão
**declare** a escala. Obrigatório significa que `npm run typecheck` fica vermelho
até o último chamador acompanhar, e commit que não compila não é entrega (mesma
lição da Tarefa 1 da F17e).

- [ ] **Passo 1: escrever o teste que falha** — acrescentar a `tests/F18a-zoom.test.ts`

```ts
import {
  gridToScreen, gridToScreenCentro, screenToGrid, ESCALA_DO_MUNDO,
} from '../src/render/grid';
import { proximoNivel } from '../src/render/zoom';
import { createRng, nextInt, nextFloat } from '../src/sim/rng';
import { gravarEvidencia } from './helpers/evidence';

const NIVEIS = configDoMapa.zoom.niveis;
const TILE = configDoMapa.tilePx;

describe('F18a — ACEITE: a ida e volta da F04 vale em TODO nivel de zoom', () => {
  it.each([...NIVEIS])('1000 coordenadas com RNG semeado, escala %s', (escala) => {
    let rng = createRng(Math.round(20260923 + escala * 1000));
    for (let i = 0; i < 1000; i++) {
      const px = nextInt(rng, -50, 200); rng = px.rng;
      const py = nextInt(rng, -50, 200); rng = py.rng;
      const tile = { gx: px.value, gy: py.value };
      expect(screenToGrid(gridToScreen(tile, TILE, escala), TILE, escala)).toEqual(tile);
    }
  });

  it.each([...NIVEIS])('jitter dentro do tile ainda volta ao mesmo tile, escala %s', (escala) => {
    let rng = createRng(Math.round(777 + escala * 1000));
    for (let i = 0; i < 500; i++) {
      const px = nextInt(rng, -50, 200); rng = px.rng;
      const py = nextInt(rng, -50, 200); rng = py.rng;
      const tile = { gx: px.value, gy: py.value };
      const canto = gridToScreen(tile, TILE, escala);
      const jx = nextFloat(rng); rng = jx.rng;
      const jy = nextFloat(rng); rng = jy.rng;
      const dentro = {
        x: canto.x + jx.value * TILE * escala,
        y: canto.y + jy.value * TILE * escala,
      };
      expect(screenToGrid(dentro, TILE, escala)).toEqual(tile);
    }
  });

  it('a escala neutra devolve exatamente o pixel de mundo', () => {
    expect(ESCALA_DO_MUNDO).toBe(1);
    expect(gridToScreen({ gx: 3, gy: 4 }, 64, ESCALA_DO_MUNDO)).toEqual({ x: 192, y: 256 });
    expect(gridToScreenCentro({ gx: 3, gy: 4 }, 64, ESCALA_DO_MUNDO)).toEqual({ x: 224, y: 288 });
  });

  it('escala dobrada dobra o pixel, e o centro acompanha', () => {
    expect(gridToScreen({ gx: 3, gy: 4 }, 64, 2)).toEqual({ x: 384, y: 512 });
    expect(gridToScreenCentro({ gx: 3, gy: 4 }, 64, 2)).toEqual({ x: 448, y: 576 });
  });

  it('escala <= 0 lanca, como tilePx <= 0 (F04): nao divide por zero em silencio', () => {
    expect(() => gridToScreen({ gx: 0, gy: 0 }, 64, 0)).toThrow();
    expect(() => screenToGrid({ x: 0, y: 0 }, 64, -1)).toThrow();
  });
});

describe('F18a — proximoNivel: passos discretos, com as pontas fechadas', () => {
  it('anda um passo para cada lado', () => {
    expect(proximoNivel(NIVEIS, 1, +1)).toBe(NIVEIS[NIVEIS.indexOf(1) + 1]);
    expect(proximoNivel(NIVEIS, 1, -1)).toBe(NIVEIS[NIVEIS.indexOf(1) - 1]);
  });

  it('nas pontas fica parado, nunca sai da lista', () => {
    const menor = NIVEIS[0];
    const maior = NIVEIS[NIVEIS.length - 1];
    expect(proximoNivel(NIVEIS, menor, -1)).toBe(menor);
    expect(proximoNivel(NIVEIS, maior, +1)).toBe(maior);
  });

  it('varrendo a lista inteira: todo resultado e um nivel da lista', () => {
    for (const nivel of NIVEIS) {
      for (const direcao of [-1, +1]) {
        expect(NIVEIS).toContain(proximoNivel(NIVEIS, nivel, direcao));
      }
    }
  });

  it('nivel fora da lista cai no mais proximo, e nao trava a roda do mouse', () => {
    expect(NIVEIS).toContain(proximoNivel(NIVEIS, 0.61, +1));
    expect(NIVEIS).toContain(proximoNivel(NIVEIS, 999, -1));
  });

  it('grava a evidencia', () => {
    gravarEvidencia('F18a', {
      feature: 'F18a-zoom-da-camera',
      tilePx: TILE,
      niveis: [...NIVEIS],
      inicial: configDoMapa.zoom.inicial,
      porNivel: NIVEIS.map((escala) => ({
        escala,
        tilePxNaTela: TILE * escala,
        cantoDoTile_10_10: gridToScreen({ gx: 10, gy: 10 }, TILE, escala),
        idaEVoltaExata: screenToGrid(gridToScreen({ gx: 10, gy: 10 }, TILE, escala), TILE, escala),
        passoAcima: proximoNivel(NIVEIS, escala, +1),
        passoAbaixo: proximoNivel(NIVEIS, escala, -1),
      })),
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run tests/F18a-zoom.test.ts`
Esperado: FALHA — `ESCALA_DO_MUNDO` e `proximoNivel` não existem.

- [ ] **Passo 3: `src/render/grid.ts`**

Trocar o cabeçalho e as três conversões (o resto do arquivo fica):

```ts
/**
 * Conversao grid <-> pixel. Funcao pura, ZERO import — nem Phaser, nem sim/,
 * nem window. E o que torna a ida e volta testavel headless (CLAUDE.md §4:
 * grid ORTOGONAL, tiles quadrados — nao isometrico, nada de losango).
 *
 * `tilePx` e `escala` sao sempre parametro, nunca constante aqui: a ida e volta
 * e propriedade da matematica, nao uma coincidencia do numero que
 * `data/terrain.json` guarda hoje. Quem le o dado e `render/mapa.ts`.
 *
 * F18a — a ESCALA. A F05b deixou escrito que estas funcoes eram cegas a zoom e
 * que precisariam do parametro quando ele entrasse. `escala` diz quantos pixels
 * do espaco de saida valem um pixel de MUNDO:
 *
 *   - quem DESENHA trabalha em pixel de mundo e passa `ESCALA_DO_MUNDO`. Sob o
 *     Phaser o zoom e transformacao de CAMERA: o objeto fica em coordenada de
 *     mundo e aparece no lugar certo em qualquer nivel, sem ninguem multiplicar.
 *   - quem converte pixel de TELA que ainda NAO passou pela camera passa o nivel
 *     de zoom. E o caso dos roteiros de screenshot, que calculam a posicao do
 *     tile no canvas por fora do Phaser.
 *
 * O caminho do ponteiro na cena passa `ESCALA_DO_MUNDO` de proposito: o ponto
 * ja veio de `camera.getWorldPoint`, que JA inverteu o zoom. Passar o nivel ali
 * dividiria duas vezes.
 */
```

```ts
/** A escala de quem trabalha em pixel de mundo. Nomeada, e nao `1` solto no
 *  chamador, para que o eixo exista a vista de quem le o codigo. */
export const ESCALA_DO_MUNDO = 1;

function validarEscala(tilePx: number, escala: number): void {
  if (!(tilePx > 0)) {
    throw new Error(`grid: tilePx precisa ser > 0 (recebeu ${tilePx}).`);
  }
  if (!(escala > 0)) {
    throw new Error(`grid: escala precisa ser > 0 (recebeu ${escala}).`);
  }
}

/** Canto superior-esquerdo do tile, em pixels do espaco de `escala`. */
export function gridToScreen(tile: Tile, tilePx: number, escala: number): Ponto {
  validarEscala(tilePx, escala);
  const lado = tilePx * escala;
  return { x: tile.gx * lado, y: tile.gy * lado };
}

/** Centro do tile — util para posicionar sprite/highlight. */
export function gridToScreenCentro(tile: Tile, tilePx: number, escala: number): Ponto {
  validarEscala(tilePx, escala);
  const lado = tilePx * escala;
  return { x: tile.gx * lado + lado / 2, y: tile.gy * lado + lado / 2 };
}

/**
 * Ponto -> tile. `Math.floor`, nunca `round` nem truncamento por `| 0`: floor e
 * o unico que acerta coordenada negativa (`floor(-1/64) === -1`, mas
 * `-1/64 | 0 === 0`) e o unico que faz qualquer ponto dentro do tile voltar
 * para o mesmo tile — nao so os cantos.
 */
export function screenToGrid(ponto: Ponto, tilePx: number, escala: number): Tile {
  validarEscala(tilePx, escala);
  const lado = tilePx * escala;
  return { gx: Math.floor(ponto.x / lado), gy: Math.floor(ponto.y / lado) };
}
```

A função `validarTilePx` some; `validarEscala` ocupa o lugar dela.

- [ ] **Passo 4: `src/render/zoom.ts`** (novo, zero imports)

```ts
/**
 * F18a — os passos de zoom. Aritmetica pura, ZERO imports, como `grid.ts` e os
 * outros tres puros de `render/` (guarda em `tests/F04-grid-ortogonal.test.ts`).
 * A lista de niveis chega por parametro, vinda de `data/terrain.json` pelo funil
 * `render/mapa.ts`: este arquivo nao le dado nenhum.
 *
 * Zoom NAO e regra de jogo. Nada aqui entra em `GameState`, e `src/sim/` nao
 * sabe que zoom existe.
 */

/**
 * O proximo nivel na direcao pedida (`+1` aproxima, `-1` afasta), preso nas
 * pontas: na ponta a roda do mouse nao faz nada em vez de sair da lista.
 *
 * `atual` fora da lista cai no mais PROXIMO antes de andar. Isso nao e caso
 * teorico: um nivel salvo de uma lista antiga, ou um `setZoom` de outro caminho,
 * travariam a roda para sempre se a busca fosse por igualdade exata.
 */
export function proximoNivel(
  niveis: readonly number[], atual: number, direcao: number,
): number {
  if (niveis.length === 0) throw new Error('zoom: a lista de niveis nao pode ser vazia');
  let iMaisProximo = 0;
  for (let i = 1; i < niveis.length; i++) {
    if (Math.abs(niveis[i] - atual) < Math.abs(niveis[iMaisProximo] - atual)) iMaisProximo = i;
  }
  const passo = direcao > 0 ? 1 : -1;
  const alvo = iMaisProximo + passo;
  if (alvo < 0 || alvo >= niveis.length) return niveis[iMaisProximo];
  return niveis[alvo];
}
```

- [ ] **Passo 5: os chamadores que desenham**

Em cada um, acrescentar `ESCALA_DO_MUNDO` como terceiro argumento e importá-lo de
`./grid` (em `WorldScene.ts`, de `../grid`):

- `src/render/estradas.ts`: três chamadas de `gridToScreen`.
- `src/render/planta-fantasma.ts`: uma chamada de `gridToScreen`.
- `src/render/unidades.ts`: uma chamada de `gridToScreenCentro`.
- `src/render/scenes/WorldScene.ts`: `gridToScreen` do highlight, `gridToScreen`
  do prédio, e **as três** `screenToGrid` do ponteiro (`pointermove`,
  `pointerdown`, `pointerup`).

Nas três do ponteiro, acrescentar o comentário que impede a regressão:

```ts
      // F18a: ESCALA_DO_MUNDO, e nao o nivel de zoom. `getWorldPoint` ja
      // inverteu o zoom da camera — passar o nivel aqui dividiria duas vezes e
      // o clique erraria o tile em todo nivel diferente de 1.
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
```

- [ ] **Passo 6: `tests/F04-grid-ortogonal.test.ts`**

Duas coisas. Primeiro, todas as chamadas ganham `ESCALA_DO_MUNDO` (importado de
`../src/render/grid`) — a F04 continua provando exatamente o que provava, agora
dizendo em que escala. O teste de `tilePx <= 0` ganha a irmã da escala:

```ts
  it('tilePx <= 0 lanca erro em vez de dividir por zero em silencio', () => {
    expect(() => gridToScreen({ gx: 0, gy: 0 }, 0, ESCALA_DO_MUNDO)).toThrow();
    expect(() => screenToGrid({ x: 0, y: 0 }, -1, ESCALA_DO_MUNDO)).toThrow();
  });

  // F18a: a escala entrou como segundo divisor; ela erra igual se for zero.
  it('escala <= 0 lanca pelo mesmo motivo que tilePx <= 0', () => {
    expect(() => gridToScreen({ gx: 0, gy: 0 }, 64, 0)).toThrow();
    expect(() => screenToGrid({ x: 0, y: 0 }, 64, -1)).toThrow();
  });
```

Segundo, `zoom.ts` entra na lista dos puros — é a guarda que o mantém sem import:

```ts
const ARITMETICA_PURA_EM_RENDER = [
  join('src', 'render', 'grid.ts'),
  join('src', 'render', 'estagio-obra.ts'),
  join('src', 'render', 'medidor-obra.ts'),
  join('src', 'render', 'nivelamento-obra.ts'),
  join('src', 'render', 'zoom.ts'),
];
```

- [ ] **Passo 7: verificar**

Rodar: `npm run typecheck` → sem erro (é o que prova que nenhum chamador ficou
para trás).
Rodar: `npm run test` → verde.
Rodar: `npm run lint` → sem erro.

- [ ] **Passo 8: commit**

```bash
git add src/render/grid.ts src/render/zoom.ts src/render/estradas.ts \
  src/render/planta-fantasma.ts src/render/unidades.ts src/render/scenes/WorldScene.ts \
  tests/F04-grid-ortogonal.test.ts tests/F18a-zoom.test.ts
git commit -m "feat(F18a): a conversao grid<->pixel declara a escala em que trabalha"
```

---

## Tarefa 3 — a roda do mouse move a câmera, ancorada no cursor

**Files:**
- Modify: `src/render/scenes/WorldScene.ts`
- Modify: `src/render/debug.ts`

**Interfaces:**
- Consome: `configDoMapa.zoom` (Tarefa 1), `proximoNivel` (Tarefa 2).
- Produz: `window.__cangaco.camera.zoom` — é sobre isto que o roteiro afirma,
  nunca por pixel (§8).

**A ancoragem, e por que ela não reimplementa a câmera do Phaser:** o tile sob o
cursor não pode se mexer. A conta poderia ser deduzida da convenção de midpoint
do Phaser — e errar por um detalhe de origem ou de `followOffset` que ninguém
lembra. Em vez disso, pergunte ao próprio Phaser **duas vezes**: qual ponto de
mundo está sob o cursor antes, e qual está depois de mudar o zoom; a diferença é
exatamente o quanto o scroll tem de andar. Vale para qualquer convenção interna.

- [ ] **Passo 1: `src/render/debug.ts`** — publicar o nível

```ts
  camera: { readonly scrollX: number; readonly scrollY: number; readonly zoom: number };
```

e no inicializador:

```ts
    camera: { scrollX: 0, scrollY: 0, zoom: 1 },
```

- [ ] **Passo 2: `src/render/scenes/WorldScene.ts`** — o nível inicial

Logo depois de `camera.setBounds(0, 0, larguraPx, alturaPx);`:

```ts
    // F18a: o nivel de abertura vem do dado e e 1 hoje. Nao e detalhe: todo
    // roteiro de screenshot ja validado calcula a posicao do tile no canvas
    // assumindo escala 1, e continua valendo enquanto o inicial for 1.
    let nivelDeZoom = configDoMapa.zoom.inicial;
    camera.setZoom(nivelDeZoom);
```

(`configDoMapa` já está importado no arquivo; confira o nome local em uso.)

- [ ] **Passo 3: a roda do mouse**

Junto dos outros `this.input.on(...)`:

```ts
    // F18a — zoom pela roda do mouse (GDD §2.1), em passos discretos do dado.
    // Rolar para CIMA (deltaY < 0) aproxima. Nada disto vira comando: zoom e
    // camera, e `src/sim/` nao sabe que ele existe.
    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer, _objetos: unknown[], _dx: number, dy: number,
    ) => {
      const proximo = proximoNivel(configDoMapa.zoom.niveis, nivelDeZoom, dy < 0 ? +1 : -1);
      if (proximo === nivelDeZoom) return; // ja esta na ponta: nao mexe em nada

      // Ancoragem no cursor: o tile sob o ponteiro nao pode se mexer. Perguntar
      // ao Phaser antes e depois vale para qualquer convencao interna de
      // midpoint/origem — deduzir a formula a mao erraria em silencio.
      const antes = camera.getWorldPoint(pointer.x, pointer.y);
      nivelDeZoom = proximo;
      camera.setZoom(nivelDeZoom);
      const depois = camera.getWorldPoint(pointer.x, pointer.y);
      camera.scrollX += antes.x - depois.x;
      camera.scrollY += antes.y - depois.y;
    });
```

- [ ] **Passo 4: publicar no POST_RENDER**

Trocar a linha da câmera por:

```ts
      // O zoom sai daqui pelo mesmo motivo que o scroll: e no preRender que o
      // clamp de `setBounds` acontece, entao este e o valor ja limitado.
      estado.camera = { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
```

- [ ] **Passo 5: verificar**

Rodar: `npm run typecheck && npm run lint && npm run test` → sem erro.
Rodar: `npm run shot -- F06` e `npm run shot -- F16b` → **EXIT 0** nos dois. É a
checagem de que abrir em zoom 1 manteve a geometria dos roteiros validados. **Não
abrir imagem** (§8).

- [ ] **Passo 6: commit**

```bash
git add src/render/scenes/WorldScene.ts src/render/debug.ts
git commit -m "feat(F18a): a roda do mouse muda o zoom, ancorado no cursor"
```

---

## Tarefa 4 — o roteiro: o mesmo ponto de mouse, no mínimo e no máximo

**Files:**
- Modify: `tools/shots/_canvas.js`
- Create: `tools/shots/F18a.js`

**Interfaces:**
- Consome: `window.__cangaco.camera.zoom`, `.tileSobMouse` (F04/F06).
- Produz: `pontoDoTileNaTela(canvas, tile, camera, tilePx)` em `_canvas.js`, que
  os roteiros futuros passam a usar quando houver zoom em jogo.

**O que o aceite pede, literalmente:** "screenshot no zoom mínimo e no máximo com
o mesmo ponto de mouse destacando o mesmo tile". Então o roteiro **fixa um ponto
de tela**, leva a câmera ao mínimo e ao máximo pela roda, e afirma que
`tileSobMouse` é o mesmo nos dois — que é a ancoragem, medida por número.

- [ ] **Passo 1: o helper em `tools/shots/_canvas.js`**

```js
/**
 * F18a — a posicao de um tile no canvas, ciente de zoom.
 *
 * Ate a F18a todo roteiro calculava `canvas.left + gx * TILE_PX - camera.scrollX`
 * a mao, e essa formula so vale em zoom 1: com zoom, tela = (mundo - scroll) * zoom.
 * Enquanto o nivel inicial for 1 os roteiros antigos continuam certos; qualquer
 * roteiro que MEXA no zoom tem de passar por aqui.
 *
 * `camera` e o `window.__cangaco.camera` publicado pela cena: { scrollX, scrollY, zoom }.
 */
function pontoDoTileNaTela(canvas, tile, camera, tilePx) {
  const centroDoMundoX = tile.gx * tilePx + tilePx / 2;
  const centroDoMundoY = tile.gy * tilePx + tilePx / 2;
  return {
    x: canvas.left + (centroDoMundoX - camera.scrollX) * camera.zoom,
    y: canvas.top + (centroDoMundoY - camera.scrollY) * camera.zoom,
  };
}
```

e acrescentar ao `module.exports`.

- [ ] **Passo 2: `tools/shots/F18a.js`**

```js
'use strict';

// Roteiro da F18a — ZOOM DA CAMERA.
//
// O aceite do BUILD_PLAN: "screenshot no zoom minimo e no maximo com o mesmo
// ponto de mouse destacando o mesmo tile". E o que este roteiro mede: um ponto
// de TELA fixo, a camera levada a ponta de baixo e a ponta de cima pela roda, e
// `tileSobMouse` afirmado igual nos dois.
//
// Afirma NUMERO, nunca pixel (§8): `window.__cangaco.camera.zoom` e
// `.tileSobMouse`, publicados pela cena. Os niveis nao estao digitados aqui —
// vem de `data/terrain.json`, o mesmo arquivo que a cena le.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const NIVEIS = terreno.zoom.niveis;
const MENOR = NIVEIS[0];
const MAIOR = NIVEIS[NIVEIS.length - 1];
/** Passos de roda de sobra para atravessar a lista inteira, venha de onde vier. */
const PASSOS = NIVEIS.length + 2;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  /** Roda para cima aproxima (deltaY < 0), como na cena. */
  async function rodar(vezes, deltaY) {
    for (let i = 0; i < vezes; i++) {
      await page.mouse.wheel(0, deltaY);
      await esperarFrame();
    }
    return estado();
  }

  // ---- 0. abertura: o nivel inicial e o do dado ----------------------------
  const inicial = await estado();
  afirmar(
    inicial.camera.zoom === terreno.zoom.inicial,
    `a cena deveria abrir no nivel do dado (${terreno.zoom.inicial}), veio ${inicial.camera.zoom}`,
  );
  afirmar(
    inicial.camera.zoom === 1,
    'o nivel inicial precisa ser 1: e o que mantem a geometria de todo roteiro ja validado',
  );

  // ---- 1. o ponto de mouse, fixo pelo resto do roteiro ---------------------
  // Escolhido pelo tile do centro da vila, que existe em qualquer mapa, e
  // convertido para tela pelo helper ciente de zoom.
  const alvo = inicial.centroDaVila;
  afirmar(alvo !== null && alvo !== undefined, 'o roteiro precisa do centro da vila publicado pela cena');
  const ponto = pontoDoTileNaTela(canvas, alvo, inicial.camera, TILE_PX);
  afirmar(
    ponto.x > canvas.left && ponto.x < canvas.right && ponto.y > canvas.top && ponto.y < canvas.bottom,
    `o ponto de mouse (${Math.round(ponto.x)},${Math.round(ponto.y)}) precisa cair dentro do canvas`,
  );
  await page.mouse.move(ponto.x, ponto.y);
  await esperarFrame();

  const sobOPonto = (await estado()).tileSobMouse;
  afirmar(
    sobOPonto !== null,
    'o ponto escolhido deveria estar sobre um tile do mapa, veio null',
  );

  // ---- 2. ate a ponta de BAIXO --------------------------------------------
  let s = await rodar(PASSOS, +200);
  afirmar(
    s.camera.zoom === MENOR,
    `rolando para baixo a camera deveria parar no menor nivel (${MENOR}), veio ${s.camera.zoom}`,
  );
  const noMinimo = s.tileSobMouse;
  afirmar(
    JSON.stringify(noMinimo) === JSON.stringify(sobOPonto),
    `ancoragem: no zoom minimo o mesmo ponto de mouse deveria estar sobre ${JSON.stringify(sobOPonto)}, veio ${JSON.stringify(noMinimo)}`,
  );
  // Mais tiles no quadro e o que o zoom existe para dar (Nota do BUILD_PLAN:
  // navegacao, nao desempenho).
  const tilesNoMinimo = s.tilesRenderizados;
  await capturar('zoom-minimo');

  // ---- 3. ate a ponta de CIMA ---------------------------------------------
  s = await rodar(PASSOS * 2, -200);
  afirmar(
    s.camera.zoom === MAIOR,
    `rolando para cima a camera deveria parar no maior nivel (${MAIOR}), veio ${s.camera.zoom}`,
  );
  const noMaximo = s.tileSobMouse;
  afirmar(
    JSON.stringify(noMaximo) === JSON.stringify(sobOPonto),
    `ancoragem: no zoom maximo o mesmo ponto de mouse deveria estar sobre ${JSON.stringify(sobOPonto)}, veio ${JSON.stringify(noMaximo)}`,
  );
  const tilesNoMaximo = s.tilesRenderizados;
  afirmar(
    tilesNoMinimo > tilesNoMaximo,
    `no zoom minimo o quadro deveria caber MAIS tiles que no maximo: ${tilesNoMinimo} contra ${tilesNoMaximo}`,
  );
  afirmar(true, `medida: ${tilesNoMinimo} tiles desenhados em zoom ${MENOR}, ${tilesNoMaximo} em zoom ${MAIOR}`);
  await capturar('zoom-maximo');

  // ---- 4. a ponta nao vaza -------------------------------------------------
  s = await rodar(3, -200);
  afirmar(
    s.camera.zoom === MAIOR,
    `no maior nivel a roda nao pode passar da lista, veio ${s.camera.zoom}`,
  );

  // ---- 5. de volta ao neutro, e o clique ainda acerta o tile ---------------
  // O caminho do ponteiro passa ESCALA_DO_MUNDO porque `getWorldPoint` ja
  // inverteu o zoom; se alguem trocar isso pelo nivel, e AQUI que aparece.
  while ((await estado()).camera.zoom > terreno.zoom.inicial) await rodar(1, +200);
  s = await estado();
  afirmar(
    s.camera.zoom === terreno.zoom.inicial,
    `deveria dar para voltar ao nivel inicial pela roda, parou em ${s.camera.zoom}`,
  );
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(sobOPonto),
    `de volta ao neutro o ponto deveria estar sobre ${JSON.stringify(sobOPonto)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  await capturar('zoom-neutro');
}

module.exports = { roteiro };
```

- [ ] **Passo 3: rodar**

Rodar: `npm run shot -- F18a`
Esperado: EXIT 0, `screenshots/F18a-1-zoom-minimo.png`, `F18a-2-zoom-maximo.png`,
`F18a-3-zoom-neutro.png`.

**Se a afirmação de ancoragem falhar:** é defeito da Tarefa 3, não do roteiro.
Não afrouxe a asserção para "o tile mudou pouco". O provável é a ordem das três
linhas (`getWorldPoint` antes, `setZoom`, `getWorldPoint` depois, soma no
scroll); o segundo provável é o clamp de `setBounds` comendo parte do ajuste
perto da borda — nesse caso, escolha um ponto de mouse mais ao centro do mapa e
**registre o motivo**. Se nenhuma das duas explicar, **pare e reporte**.

- [ ] **Passo 4: abrir a evidência**

Ler com a ferramenta Read `screenshots/F18a-1-zoom-minimo.png` e
`F18a-2-zoom-maximo.png` — são os dois que o aceite nomeia. Conferir que o mesmo
canto do mapa aparece em duas ampliações diferentes e que o HUD e o menu não
mudaram de tamanho (eles são HTML sobre o canvas, fora da câmera).

Ler `test-output/F18a-shot.json` e conferir a linha `medida:` dos tiles por nível.

- [ ] **Passo 5: commit**

```bash
git add tools/shots/_canvas.js tools/shots/F18a.js
git commit -m "feat(F18a): o roteiro do zoom minimo e maximo no mesmo ponto"
```

---

## Tarefa 5 — fechamento

**Files:**
- Modify: `PROGRESS.md`, `test-results.json`

- [ ] **Passo 1: `npm run verify`** — typecheck + lint + validate:data + test.
      Guardar EXIT e contagem. O selo vale 15 minutos.

- [ ] **Passo 2: não-regressão dos roteiros, por código de saída**

`npm run shot --` para `F06`, `F07`, `F08`, `F11c`, `F16b`, `F17d`, `F17e`.
EXIT 0 em todos. **Não abrir imagem nenhuma** (§8) — a geometria deles depende do
nível inicial ser 1, e é exatamente isso que o código de saída mede.

- [ ] **Passo 3: `PROGRESS.md`**, seção da F18a antes de `## Perguntas em aberto`,
      separando o **verificado** do **decidido**. No decidido, registrar:
  - por que os cinco níveis são estes (o inteiro de `tilePx * nivel`, o neutro em 1);
  - que o caminho do ponteiro passa `ESCALA_DO_MUNDO` e **por quê** (dupla divisão);
  - que o consumidor de escala ≠ 1 hoje é o helper dos roteiros, não a cena — e
    que isso é consequência de o Phaser fazer o zoom na câmera, não lacuna;
  - o probe da regra de `validate:data` como **evidência de sessão**, distinta da
    proteção permanente (§8);
  - a medida de tiles desenhados por nível que o roteiro gravou.

- [ ] **Passo 4: `test-results.json`** — entrada `F18a-zoom-da-camera` com
      `"passes": true`, na forma que as outras linhas usam. O hook só aceita a
      escrita com o selo do verify.

- [ ] **Passo 5: commit**

```bash
git add PROGRESS.md test-results.json docs/planos/F18a-zoom-da-camera.md
git commit -m "feat(F18a): zoom da camera"
```

---

## Definition of Done (CLAUDE.md §7)

- [ ] `npm run test` verde, incluindo `tests/F18a-zoom.test.ts`.
- [ ] `npm run typecheck` e `npm run lint` sem erro.
- [ ] Aceite do BUILD_PLAN verificado com evidência aberta por Read:
      `test-output/F18a.json` (ida e volta × níveis) e
      `screenshots/F18a-1-zoom-minimo.png` / `F18a-2-zoom-maximo.png`.
- [ ] `npm run validate:data` passa, **com os níveis de zoom validados**.
- [ ] Nenhum import de `phaser` em `src/sim/` — e `src/sim/` não mudou.
- [ ] `grid.ts` e `zoom.ts` com zero imports (guarda da F04).
- [ ] Commits feitos, um por tarefa.

---

## Auto-revisão

| risco | onde | como o plano responde |
|---|---|---|
| dividir duas vezes pelo zoom | caminho do ponteiro na cena | `ESCALA_DO_MUNDO` explícito com o porquê no comentário, e o passo 5 do roteiro (voltar ao neutro e reafirmar o tile) acusa se alguém trocar |
| a ancoragem errar por convenção interna do Phaser | `wheel` na cena | pergunta ao próprio Phaser antes e depois, em vez de deduzir a fórmula; o roteiro afirma o tile, não o pixel |
| ida e volta quebrar por float em nível quebrado | `data/terrain.json` | regra em `data-rules.js` exige `tile_px * nivel` inteiro, com probe provando que ela acusa |
| roteiro validado quebrar de tabela | nível inicial | inicial = 1, afirmado no teste **e** no roteiro; não-regressão por código de saída em sete roteiros |
| parâmetro novo sem consumidor real | `escala` | consumidor é o helper de `_canvas.js`, usado pelo roteiro desta feature — e o plano diz isso em vez de fingir que a cena usa |
| feature virar refatoração ampla | três arquivos de desenho | mudança é mecânica (um argumento nomeado) e cabe no mesmo commit da assinatura, porque sem ela não compila |
