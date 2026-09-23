# F17f — O primeiro sprite real (armazém): plano de implementação

> **Para o executor:** implemente tarefa a tarefa, na ordem. Cada tarefa termina
> em commit. Nenhuma tarefa toca `src/sim/`.

**Objetivo:** o armazém deixa de ser retângulo e passa a ser desenhado por PNG
nos três estágios que existem hoje (`marcacao`, `madeira`, `completo`), enquanto
os outros 27 prédios continuam placeholder — e o jogo não quebra por isso.

**O que esta feature existe para fixar** (não é o desenho): o formato do
`assets/manifest.json`, a estrutura de pastas que os outros 27 prédios vão
herdar, a convenção de nome de arquivo por prédio e por estágio, a **dimensão**
derivada do footprint e a **ancoragem** no grid ortogonal.

**Arquitetura:** o manifesto é o único lugar que liga id de prédio a arquivo. A
resolução é função pura, sem import, testada headless; a leitura dos arquivos é
`import.meta.glob` do Vite num módulo fino e separado, para o teste nunca
depender do bundler. A cena carrega no `preload()` só o que o manifesto declara
**e** o bundler resolveu — nenhuma URL inventada, logo nenhum 404 (o runner de
screenshot reprova por erro de console).

**Stack:** nenhuma dependência nova. A derivação dos PNGs usa o Chromium do
Playwright, que já é devDependency — ver Tarefa 2.

**Spec:** CLAUDE.md §9 (arte e assets) + a mensagem do operador de 2026-09-23
(os quatro pontos, respondidos abaixo).

---

## Id e lugar na fila (proposta, a confirmar na Tarefa 1)

**Id: `F17f`. Lugar: logo depois da `F17c`, ANTES da `F17d` e da `F17e`.**

As letras são id, não ordem — **a ordem é a do arquivo**, como a nota da F17b já
diz, e o precedente existe: `F16a`, `F16c`, `F16b` aparecem nessa ordem no
`BUILD_PLAN.md` e foram executadas nessa ordem.

Por que na frente da F17d/F17e: a arte fornecida tem **exatamente três estágios**,
que são exatamente os três de hoje. A F17e transforma três em seis. Se ela vier
antes, o armazém nasce metade sprite, metade retângulo, e a foto que o operador
pede para julgar escala fica poluída. Fixando a convenção agora, a F17e ganha uma
regra escrita para estágio sem arte (Tarefa 6, passo 4).

**Não é feature de integração**: toca `src/render/`, `assets/`, `tools/`,
`tests/` e `.gitignore`. **Não toca `src/sim/` nem `src/ui/`** — logo não precisa
da exceção da §10, e não pode ganhar uma por conveniência no meio do caminho.

---

## Respostas aos quatro pontos do operador

### 1. O `assets/manifest.json` — ele não existe

Verificado: `git log --all -- assets/manifest.json` não devolve **nenhum**
commit, e o arquivo não está na árvore. `assets/` tem só `.gitkeep`. Não há,
portanto, formato a "usar como está": o que existe é a **lista de campos da §9
do CLAUDE.md** — `id`, `tipo`, `footprint` em tiles, `tamanho` em px, `anchor`,
`estados`, `licença` e `origem` (id da base ou semente que gerou).

Esses oito campos cobrem o caso e **não vou mudá-los**. O que a §9 não fixa, e
esta feature precisa decidir, são três coisas — propostas, com a razão:

| Lacuna | Proposta | Por quê |
|---|---|---|
| forma de `estados` | mapa `estágio → caminho de arquivo` | a busca fica direta (`estados[estagio]`), e a F17e só acrescenta chave |
| base do caminho | relativo ao **próprio manifesto** (`sprites/storehouse/...`) | move a pasta inteira sem reescrever entrada |
| o que é `tamanho` | os **px reais do PNG derivado**, e `footprint` os tiles | é a diferença entre os dois que o teste da Tarefa 3 usa como guarda |

**Uma lacuna fica aberta e é do operador:** a §9 manda guardar *"o id ou a semente
que a ferramenta devolveu"*. As imagens vieram prontas, sem semente. O campo
`origem` vai apontar para o arquivo base e trazer `"semente": null` com uma nota
explícita. Se a semente existir em algum lugar, ela entra aqui — sem isso, um
frame só se ajusta refazendo o conjunto, que é exatamente o que a §9 quer evitar.

### 2. A dimensão: a convenção 192×192 não bate com a arte, e o número é 192×128

Medido nos seis PNGs (`assets/edificios/*/*.png`), com cabeçalho IHDR e bbox de
alpha:

| arquivo | canvas | conteúdo (bbox) | razão |
|---|---|---|---|
| `armazem_01_obra` | 1536×1024 | 1454×961 em (0,63) | 1,513 |
| `armazem_02_estrutura` | 1536×1024 | 1498×964 em (0,30) | 1,554 |
| `armazem_03_completo` | 1536×1024 | 1514×1007 em (0,17) | 1,503 |
| `casa_lenhador_01_obra` | 1536×1024 | 1414×973 em (73,30) | 1,453 |
| `casa_lenhador_02_estrutura` | **1223×1286** | 1180×1235 | 0,955 |
| `casa_lenhador_03_completo` | **1223×1286** | 1176×1145 | 1,027 |

Três conclusões, e a primeira é boa notícia:

- **1536 = 192 × 8, exato.** O armazém está gerado em 8× a largura de um
  footprint de 3 tiles. Escalando o canvas inteiro por 1/8 sai **192×128**.
- **Não é 192×192, e forçar seria esticar a arte 1,5× na vertical.** A razão da
  fonte é 3:2. A convenção de 192×192 pressupõe a projeção 3/4 do §9.3, onde o
  chão de um 3×3 é um quadrado; em isométrico ele é um losango mais largo que
  alto. É a divergência de perspectiva que o operador já registrou como
  conhecida. **Reporto a medida e não forço**: a regra que esta feature fixa é
  **a largura manda** — `tamanho[0] === footprint[0] × tile_px` —, e a altura é o
  que a arte der, gravada no manifesto e verificada contra o arquivo.
- **Os três estágios do armazém NÃO estão registrados entre si**: bboxes
  1454×961, 1498×964 e 1514×1007, com offsets diferentes. Recortar cada um pelo
  seu conteúdo faria o prédio **pular de posição ao trocar de estágio**. Por isso
  a derivação escala **o canvas inteiro**, sem recorte: os três compartilham o
  quadro de 1536×1024 e o registro se preserva por construção.

Observação menor, da fonte e não nossa: em `armazem_01` e `armazem_03` o
conteúdo encosta na borda (x=0, y=1024) — a arte está cortada no original, e o
corte continua no derivado.

**A `casa_lenhador` tem dois canvas diferentes** (1536×1024 e 1223×1286) entre
os próprios estágios. Não entra nesta feature (só o armazém entra), mas quando
entrar, **1223 não é múltiplo de 192** e os estágios não estão registrados: vai
precisar de regeração ou de um recorte combinado com o operador. Fica dito
agora, não na hora.

### 3. A ancoragem

`anchor: [0.5, 1]` — meio na horizontal, **borda inferior**, posicionado no
**meio da borda de baixo do retângulo do footprint**. Na cena, o container de um
prédio já nasce no canto superior esquerdo do footprint (`gridToScreen`), então:

```ts
imagem.setOrigin(0.5, 1);
imagem.setPosition(larguraPx / 2, alturaPx);   // larguraPx = 3*tilePx, alturaPx = 3*tilePx
imagem.setScale((largura * tilePx) / tamanho[0]);  // escala pela LARGURA, nunca por dois eixos
```

Escalar por `largura/tamanho[0]` (e não por dois fatores) é o que impede o
esticão do ponto 2 e o que faz o sprite sobreviver ao zoom da F18a sem tocar
neste código.

Com 192×128 ancorado embaixo, o prédio ocupa a metade inferior do quadrado de
chão e o terço de cima do footprint mostra o solo. É consequência da perspectiva
isométrica, é esperado, e é uma das coisas que a screenshot da Tarefa 5 existe
para deixar o operador ver.

### 4. Placeholder e sprite convivem, e o teste prova os dois lados

O caminho é o mesmo dos dois lados — muda só a resposta do resolvedor:

- `assetDoPredio(manifesto, 'storehouse')` devolve a entrada → a cena desenha a
  imagem;
- `assetDoPredio(manifesto, 'quarry')` devolve `null` → a cena desenha o
  retângulo com o nome, exatamente como hoje.

Duas asserções em teste headless (Tarefa 3) e duas no roteiro (Tarefa 5), esta
segunda lendo o campo de depuração novo `spritesDePredio`, nunca pixel.

---

## Dois achados que mudam a execução (ler antes de começar)

### A. As imagens **não estão** no repositório — `*.png` está no `.gitignore`

```
$ git ls-files assets
assets/.gitkeep

$ git check-ignore -v assets/edificios/armazem/armazem_03_completo.png
.gitignore:4:*.png	assets/edificios/armazem/armazem_03_completo.png
```

A linha 4 do `.gitignore` é `*.png`, global — pega screenshots (de propósito) e
pega arte (não de propósito). Há ainda, **não commitada**, uma linha
`assets/edificios` acrescentada ao fim do arquivo.

Sem resolver isso, a feature não pode ser entregue: a §9 exige imagem base
**versionada** (*"sem isso não há como voltar e ajustar um frame sem refazer o
conjunto inteiro"*) e o jogo precisa dos derivados no repositório para rodar em
qualquer clone.

A mudança é estreita e vai na Tarefa 1:

```gitignore
*.png
!assets/**/*.png
```

`screenshots/` e `test-output/` continuam ignorados pela regra de diretório das
linhas 2 e 3, que não depende da extensão. **A linha solta `assets/edificios`
precisa sair** — regra posterior vence, e ela anularia a negação.

**Custo, para decisão do operador:** o trio do armazém pesa **7,0 MB**
(2,0 + 2,4 + 2,4). Os seis arquivos de hoje, 12,9 MB. Se os 28 prédios × 3
estágios entrarem nesse tamanho, são **~170 MB** de base no histórico do git,
que não encolhe. Esta feature commita o trio do armazém (7 MB) e os três
derivados (~0,1 MB). A política para os outros 27 é decisão do operador e **não**
se decide aqui; a alternativa óbvia, se 170 MB incomodar, é versionar a base já
reduzida (768×512 ≈ 500 KB), aceitando perder resolução para regeração futura.

### B. Não há carregamento de asset nenhum hoje

`grep "this.load\." src/render/` não devolve nada: a `WorldScene` não tem
`preload()`, não existe `vite.config.*` e não existe `public/`. Esta feature
cria o caminho inteiro. Por isso a Tarefa 4 é maior que as outras, e por isso o
`import.meta.glob` (que resolve em build) é preferível a URL montada em string
(que falha em runtime, e o runner de screenshot **reprova por erro de console**).

---

## Estrutura de pastas e nome de arquivo (a proposta que a feature fixa)

```
assets/
  manifest.json                 índice único: id -> footprint, tamanho, anchor, estados, origem
  base/                         canônico, versionado, NUNCA carregado pelo jogo
    storehouse/
      storehouse_obra.png           1536x1024 (o que o operador entregou)
      storehouse_estrutura.png
      storehouse_completo.png
  sprites/                      derivado, é o que o jogo carrega
    storehouse/
      storehouse_marcacao.png       192x128
      storehouse_madeira.png
      storehouse_completo.png
  edificios/                    caixa de entrada do operador; sai da árvore conforme cada prédio entra
```

Três decisões dentro disso, com a razão:

1. **A pasta é o id NEUTRO da simulação** (`storehouse`), não o nome temático
   (`armazem`). A §9 é explícita: o tema alimenta só a tela, e **nenhuma regra
   pode depender do tema**. Caminho de asset indexado por `armazem` faria o
   render depender de `theme-sertao.json` para achar arquivo — trocar o tema
   quebraria o jogo. Os outros 27 herdam isto: `woodcutters/`, `watchtower/`,
   `quarry/`. (As pastas de hoje: `armazem`→`storehouse`,
   `casa_lenhador`→`woodcutters`, `mirante`→`watchtower`, `pedreira`→`quarry`;
   `sobrado` não tem correspondência óbvia em `buildings.json` — fica onde está
   até o operador dizer qual prédio é.)
2. **O derivado se chama pelo estágio do render** (`_marcacao`, `_madeira`,
   `_completo`), sem número de ordem: número é uma segunda fonte de verdade que
   sai de sincronia. A **base** mantém o nome que o operador deu, porque ela é o
   registro da geração.
3. **Nada parseia nome de arquivo.** Quem mapeia é o `estados` do manifesto.
   Renomear um arquivo é editar uma linha do manifesto, e o teste da Tarefa 3
   acusa se o arquivo não existir. A convenção acima é documentação, não contrato
   de código — e é por isso que ela pode evoluir sem quebrar nada.

---

## Restrições globais

- **`src/sim/` não muda.** Nenhum arquivo novo em `sim/`, nenhum import novo
  saindo de lá. Se a implementação parecer pedir, **pare e reporte**.
- **`src/ui/` não muda.** Não é feature de integração.
- Nenhum arquivo de `src/render/` além dos dois funis (`mapa.ts`, `predios.ts`)
  importa `../sim/data` — guarda estrutural em `tests/F04-grid-ortogonal.test.ts`.
  Os arquivos novos de `render/` **não** importam `sim/data`: recebem tipo e
  estágio por parâmetro.
- Nenhuma dependência npm nova.
- Tile = **64 px** (`data/terrain.json: tile_px`), lido pelo funil `mapa.ts`;
  nenhum arquivo novo escreve 64 na mão.
- O runner de screenshot **reprova por erro de console**: nenhum 404, nenhum
  `loaderror` do Phaser no caminho feliz.
- `npm run verify` tem de fechar verde no fim (Tarefa 6), conferindo o código de
  saída **do comando inteiro**.

---

## Tarefa 1 — o item na fila e o `.gitignore`

**Arquivos:** modificar `BUILD_PLAN.md`, `.gitignore`.

- [ ] **Passo 1:** escrever o item `### F17f — O primeiro sprite real (armazém)`
      no `BUILD_PLAN.md`, **entre a F17c e a F17d**, com Escopo, Aceite,
      Evidência e as notas: (a) não é feature de integração, só `render/`;
      (b) a divergência de perspectiva do §9.3 é **conhecida e a substituir** —
      a arte é isométrica, a convenção do projeto é 3/4 sobre grid ortogonal, e
      esta feature valida manifesto, dimensão e ancoragem, **não** a arte;
      (c) 192×128 e o porquê de não ser 192×192, com a medida; (d) por que vem
      antes da F17d/F17e.
- [ ] **Passo 2:** no `.gitignore`, acrescentar `!assets/**/*.png` logo abaixo de
      `*.png` e **remover** a linha solta `assets/edificios` do fim do arquivo.
- [ ] **Passo 3:** `git status --porcelain` — conferir que
      `assets/edificios/**/*.png` passou a aparecer como não rastreado (a prova
      de que a negação pegou).
- [ ] **Passo 4:** commit `docs(F17f): item na fila e a arte deixa de ser ignorada`.

## Tarefa 2 — a base versionada e a derivação 1536×1024 → 192×128

**Arquivos:** criar `tools/derivar-sprites.js`; mover
`assets/edificios/armazem/*.png` para `assets/base/storehouse/`; criar
`assets/sprites/storehouse/*.png`.

Por que Playwright e não Pillow: o Chromium do Playwright já é devDependency
(`npm run shot` depende dele), e Pillow adicionaria Python ao toolchain do
projeto por um passo que roda uma vez. A qualidade de um `drawImage` com
`imageSmoothingQuality: 'high'` numa redução de 8× é suficiente para o que esta
feature valida.

- [ ] **Passo 1:** mover e renomear (`git mv` não serve — os arquivos ainda não
      estão rastreados; use `mv` e deixe o `git add` da Tarefa criar):
      `armazem_01_obra.png` → `assets/base/storehouse/storehouse_obra.png`,
      `_02_estrutura` → `storehouse_estrutura.png`,
      `_03_completo` → `storehouse_completo.png`.
- [ ] **Passo 2:** escrever `tools/derivar-sprites.js`:

```js
#!/usr/bin/env node
'use strict';

// Deriva o sprite de jogo a partir da IMAGEM BASE (CLAUDE.md §9: toda geracao
// deriva da base versionada). Roda a mao, nao entra em `npm run verify`:
// a saida e commitada, entao o jogo nunca depende deste script para subir.
//
//   node tools/derivar-sprites.js
//
// Escala o CANVAS INTEIRO, sem recorte pelo conteudo: os tres estagios do
// armazem tem bbox de alpha diferente (1454x961, 1498x964, 1514x1007) e
// recortar cada um pelo seu faria o predio PULAR ao trocar de estagio.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..', 'assets');
const ALVOS = [
  { base: 'base/storehouse/storehouse_obra.png',      saida: 'sprites/storehouse/storehouse_marcacao.png' },
  { base: 'base/storehouse/storehouse_estrutura.png', saida: 'sprites/storehouse/storehouse_madeira.png' },
  { base: 'base/storehouse/storehouse_completo.png',  saida: 'sprites/storehouse/storehouse_completo.png' },
];
const LARGURA_ALVO = 192; // 3 tiles x 64 px. A ALTURA sai da razao da fonte.

async function main() {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  for (const alvo of ALVOS) {
    const origem = path.join(RAIZ, alvo.base);
    const b64 = fs.readFileSync(origem).toString('base64');
    const resultado = await pagina.evaluate(async ({ b64, largura }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const escala = largura / img.width;
      const altura = Math.round(img.height * escala);
      const canvas = document.createElement('canvas');
      canvas.width = largura; canvas.height = altura;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, largura, altura);
      return { dados: canvas.toDataURL('image/png').split(',')[1], largura, altura, fonte: [img.width, img.height] };
    }, { b64, largura: LARGURA_ALVO });
    const destino = path.join(RAIZ, alvo.saida);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(resultado.dados, 'base64'));
    console.log(`${alvo.base} ${resultado.fonte.join('x')} -> ${alvo.saida} ${resultado.largura}x${resultado.altura}`);
  }
  await navegador.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Passo 3:** `node tools/derivar-sprites.js`. Esperado: três linhas
      `1536x1024 -> 192x128`. **Se qualquer uma sair diferente de 192x128, pare
      e reporte a medida** — é o ponto 2 do operador.
- [ ] **Passo 4:** conferir o tamanho dos derivados em disco (esperado: dezenas
      de KB cada, não MB) e commitar
      `feat(F17f): base do armazem versionada e os tres sprites derivados`.

## Tarefa 3 — o manifesto e o resolvedor puro (teste primeiro)

**Arquivos:** criar `assets/manifest.json`, `src/render/manifesto.ts`,
`tests/F17f-manifesto.test.ts`.

**Produz para as tarefas seguintes:**
`assetDoPredio(manifesto, tipo): EntradaDeAsset | null` e
`arquivoDoEstagio(entrada, estagio): string | null`.

- [ ] **Passo 1: escrever o teste, que falha** (`tests/F17f-manifesto.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { assetDoPredio, arquivoDoEstagio } from '../src/render/manifesto';
import type { Manifesto } from '../src/render/manifesto';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;

/** Largura e altura do IHDR, os primeiros 24 bytes de um PNG. Sem dependencia:
 *  ler o cabecalho e o que prova que o arquivo TEM a dimensao declarada. */
function dimensaoDoPng(caminho: string): readonly [number, number] {
  const b = readFileSync(caminho);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('F17f — o manifesto descreve a arte que existe', () => {
  it('toda entrada tem os oito campos da §9', () => {
    for (const e of manifesto.assets) {
      expect(typeof e.id).toBe('string');
      expect(e.tipo).toBe('predio');
      expect(e.footprint).toHaveLength(2);
      expect(e.tamanho).toHaveLength(2);
      expect(e.anchor).toEqual([0.5, 1]);
      expect(Object.keys(e.estados).length).toBeGreaterThan(0);
      expect(typeof e.licenca).toBe('string');
      expect(e.origem.base).toBeTruthy();
    }
  });

  it('todo arquivo declarado existe e tem a dimensao declarada', () => {
    for (const e of manifesto.assets) {
      for (const rel of Object.values(e.estados)) {
        const caminho = `assets/${rel}`;
        expect(existsSync(caminho), caminho).toBe(true);
        expect(dimensaoDoPng(caminho), caminho).toEqual(e.tamanho);
      }
      expect(existsSync(`assets/${e.origem.base}`)).toBe(true);
    }
  });

  // A convencao que esta feature existe para fixar: a LARGURA manda.
  it('a largura em px e a largura do footprint em tiles vezes o tile', () => {
    for (const e of manifesto.assets) {
      expect(e.tamanho[0]).toBe(e.footprint[0] * gameData.terreno.tilePx);
    }
  });

  it('o footprint do manifesto bate com o de buildings.json', () => {
    for (const e of manifesto.assets) {
      const def = gameData.predios.find((p) => p.id === e.id);
      expect(def, `manifesto declara '${e.id}', que nao existe em buildings.json`).toBeTruthy();
      expect([...e.footprint]).toEqual([...(def?.tamanho ?? [])]);
    }
  });

  it('o armazem tem arte nos tres estagios e a pedreira nao tem nenhuma', () => {
    const armazem = assetDoPredio(manifesto, 'storehouse');
    expect(armazem).not.toBeNull();
    expect(arquivoDoEstagio(armazem!, 'marcacao')).toBe('sprites/storehouse/storehouse_marcacao.png');
    expect(arquivoDoEstagio(armazem!, 'madeira')).toBeTruthy();
    expect(arquivoDoEstagio(armazem!, 'completo')).toBeTruthy();

    // O outro lado do §9: predio sem PNG resolve NULL, e a cena desenha o retangulo.
    expect(assetDoPredio(manifesto, 'quarry')).toBeNull();
    expect(assetDoPredio(manifesto, 'tipo_que_nao_existe')).toBeNull();
  });

  it('estagio sem arte resolve null, mesmo num predio que tem arte', () => {
    const armazem = assetDoPredio(manifesto, 'storehouse');
    expect(arquivoDoEstagio(armazem!, 'estagio_futuro_da_F17e')).toBeNull();
  });

  it('grava a evidencia', () => {
    gravarEvidencia('F17f', {
      feature: 'F17f-primeiro-sprite',
      entradas: manifesto.assets.map((e) => ({
        id: e.id, footprint: e.footprint, tamanho: e.tamanho, anchor: e.anchor,
        estados: Object.keys(e.estados), origem: e.origem,
      })),
      prediosSemArte: gameData.predios.filter((p) => !assetDoPredio(manifesto, p.id)).length,
      perspectiva: 'ISOMETRICA — divergente do §9.3 (3/4 sobre grid ortogonal). Conhecida, a substituir.',
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar** — `npx vitest run tests/F17f-manifesto.test.ts`.
      Esperado: erro de módulo (`src/render/manifesto.ts` não existe).

- [ ] **Passo 3: escrever `src/render/manifesto.ts`** — sem import nenhum, como
      `estagio-obra.ts` e `medidor-obra.ts`:

```ts
/**
 * O indice de arte do jogo (CLAUDE.md §9), lido por quem desenha. ZERO imports:
 * o manifesto chega como parametro, o tipo de predio tambem. Este arquivo NAO
 * sabe que existe Phaser, nem `sim/data`, nem tema.
 *
 * Nada aqui parseia nome de arquivo: quem mapeia estagio -> arquivo e o campo
 * `estados`. Renomear arte e editar o manifesto, e o teste acusa se o arquivo
 * declarado nao existir.
 */
export interface OrigemDoAsset {
  /** Caminho da imagem base versionada, relativo a `assets/`. */
  readonly base: string;
  /** A semente que a ferramenta devolveu, quando houver (§9). */
  readonly semente: string | null;
  readonly nota?: string;
}

export interface EntradaDeAsset {
  readonly id: string;              // id NEUTRO da simulacao, nunca o nome do tema
  readonly tipo: 'predio';
  readonly footprint: readonly [number, number];  // em tiles
  readonly tamanho: readonly [number, number];    // em px, do arquivo derivado
  readonly anchor: readonly [number, number];     // [0.5, 1]: meio, borda de baixo
  readonly estados: Readonly<Record<string, string>>; // estagio -> caminho relativo a `assets/`
  readonly licenca: string;
  readonly origem: OrigemDoAsset;
}

export interface Manifesto {
  readonly versao: number;
  readonly assets: readonly EntradaDeAsset[];
}

export function assetDoPredio(manifesto: Manifesto, tipo: string): EntradaDeAsset | null {
  return manifesto.assets.find((e) => e.tipo === 'predio' && e.id === tipo) ?? null;
}

export function arquivoDoEstagio(entrada: EntradaDeAsset, estagio: string): string | null {
  return entrada.estados[estagio] ?? null;
}

/** A chave de textura no Phaser. Uma so funcao para quem carrega e quem desenha:
 *  duas formas de montar a mesma chave e como elas divergem (licao da F17b). */
export function chaveDaTextura(id: string, estagio: string): string {
  return `predio:${id}:${estagio}`;
}
```

- [ ] **Passo 4: escrever `assets/manifest.json`**:

```json
{
  "_doc": "Indice de arte (CLAUDE.md §9). `estados` mapeia o estagio do render (render/estagio-obra.ts) para o arquivo derivado; caminhos relativos a assets/. `tamanho` e o px REAL do derivado e `footprint` os tiles: a largura em px e sempre footprint[0] * tile_px, e a altura e o que a arte der.",
  "versao": 1,
  "assets": [
    {
      "id": "storehouse",
      "tipo": "predio",
      "footprint": [3, 3],
      "tamanho": [192, 128],
      "anchor": [0.5, 1],
      "estados": {
        "marcacao": "sprites/storehouse/storehouse_marcacao.png",
        "madeira": "sprites/storehouse/storehouse_madeira.png",
        "completo": "sprites/storehouse/storehouse_completo.png"
      },
      "licenca": "arte propria do projeto, fornecida pelo operador em 2026-09-23",
      "origem": {
        "base": "base/storehouse/storehouse_completo.png",
        "semente": null,
        "nota": "PERSPECTIVA ISOMETRICA, divergente do §9.3 (3/4 sobre grid ortogonal): conhecida e a substituir. Gerada fora do repositorio; a semente nao foi fornecida, entao um frame so se ajusta refazendo o conjunto."
      }
    }
  ]
}
```

- [ ] **Passo 5:** rodar até verde e commitar
      `feat(F17f): manifesto de assets e o resolvedor, com guarda de dimensao`.

## Tarefa 4 — a cena carrega e desenha

**Arquivos:** criar `src/render/sprites-urls.ts`; modificar
`src/render/scenes/WorldScene.ts`, `src/render/debug.ts`.

- [ ] **Passo 1: `src/render/sprites-urls.ts`** — o único arquivo que fala com o
      bundler, isolado para que nenhum teste dependa dele:

```ts
/**
 * As URLs dos sprites, resolvidas pelo Vite em tempo de build. Isolado num
 * arquivo so porque `import.meta.glob` e do bundler: o resto de `render/`
 * recebe este mapa por parametro e continua testavel em Node.
 *
 * Arquivo que o manifesto declara e o glob nao resolveu NAO e carregado — e o
 * que impede um 404, que o runner de screenshot trata como reprovacao.
 */
const modulos = import.meta.glob('../../assets/sprites/**/*.png', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

/** `sprites/storehouse/x.png` (como o manifesto escreve) -> URL servida. */
export const urlsDeSprites: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(modulos).map(([chave, url]) => [chave.replace('../../assets/', ''), url]),
);
```

- [ ] **Passo 2: `preload()` na `WorldScene`** (a cena não tinha nenhum):

```ts
preload(): void {
  for (const entrada of manifesto.assets) {
    for (const [estagio, rel] of Object.entries(entrada.estados)) {
      const url = urlsDeSprites[rel];
      if (!url) continue; // declarado mas nao resolvido: fica placeholder, sem 404
      this.load.image(chaveDaTextura(entrada.id, estagio), url);
    }
  }
}
```

- [ ] **Passo 3: desenhar** — em `criarPredio`, antes do retângulo:

```ts
const entrada = assetDoPredio(manifesto, predio.tipo);
const chave = entrada ? chaveDaTextura(entrada.id, estagio) : null;
const temTextura = chave !== null && this.textures.exists(chave);

const corpo: Phaser.GameObjects.GameObject[] = [];
if (temTextura && entrada) {
  const imagem = this.add.image(larguraPx / 2, alturaPx, chave);
  imagem.setOrigin(entrada.anchor[0], entrada.anchor[1]);
  // Escala por UM fator, o da largura: dois fatores esticariam a arte, e a
  // altura do sprite nao e a do footprint (192x128 para um 3x3). E o que
  // mantem o desenho certo quando o zoom da F18a mudar `tilePx`.
  imagem.setScale(larguraPx / entrada.tamanho[0]);
  corpo.push(imagem);
} else {
  // §9: sem PNG, o retangulo com o nome E o desenho. Nao e falha.
  ... (o retangulo e o rotulo de hoje, sem mudanca) ...
}
```

      e o container passa a receber `[...corpo, ...this.desenharMedidor(...)]`.

- [ ] **Passo 4: campo de depuração** em `debug.ts` e preenchido em
      `atualizarPredios`:

```ts
/** F17f — a textura com que cada predio foi desenhado, ou null quando ele caiu
 *  no placeholder do §9. O roteiro afirma sobre isto, nunca por pixel. */
spritesDePredio: Readonly<Record<string, string | null>>;
```

- [ ] **Passo 5:** `npm run typecheck`, `npm run lint`, `npx vitest run` (o teste
      estrutural da F04 tem de continuar verde: nenhum arquivo novo de `render/`
      importa `sim/data`). Commit `feat(F17f): a cena carrega o manifesto e
      desenha o armazem com sprite`.

## Tarefa 5 — a screenshot que o operador pede

**Arquivos:** criar `tools/shots/F17f.js`.

O que a foto precisa ter junto, para julgar escala: **o armazém real, um prédio
placeholder e uma unidade**. O estado inicial já entrega os três — `storehouse`
completo em (29,30), `schoolhouse` em (34,30) sem arte, e as seis unidades em
y=34 —, e a cena já abre centrada na vila (`centroDaVila`).

- [ ] **Passo 1:** escrever o roteiro nos moldes do `tools/shots/F17b.js`
      (mesmo `ctx`: `page`, `capturar`, `estado`, `afirmar`), afirmando pelo
      estado e não por pixel:
      - `spritesDePredio[p1] === 'predio:storehouse:completo'`
      - `spritesDePredio[p2] === null` (a escola caiu no placeholder)
      - nenhum erro de console (o runner já reprova sozinho)
      - `unidadesRenderizadas.length > 0` — a unidade está no quadro
- [ ] **Passo 2:** capturar `F17f-1-armazem-placeholder-unidade.png`.
- [ ] **Passo 3:** plantar um `storehouse` (o estoque inicial tem 40 timber e
      30 stone, sobra) ao lado, afirmar `estagiosDeObraRenderizados.marcacao >= 1`
      e `spritesDePredio[novo] === 'predio:storehouse:marcacao'`, e capturar
      `F17f-2-obra-marcacao.png`.
- [ ] **Passo 4:** avançar em passos de 50 (um `avancar` seco e grande estoura o
      frame — lição da F16b) até o `hp` subir, com teto explícito de 1000 ticks;
      afirmar `spritesDePredio[novo] === 'predio:storehouse:madeira'` e capturar
      `F17f-3-obra-madeira.png`. **Se o teto estourar, não afrouxe: pare e
      reporte** — significa que a obra não anda, e isso é outro assunto.
- [ ] **Passo 5:** `npm run shot -- F17f`, conferindo o **código de saída**.
      **Abrir com Read apenas `F17f-1`** — é a foto da pergunta de escala. As
      outras duas valem pelo código de saída e pelas asserções (§8: imagem é o
      que mais pesa na janela).
- [ ] **Passo 6:** commit `feat(F17f): roteiro e screenshot do armazem ao lado do
      placeholder`.

## Tarefa 6 — fechar

- [ ] **Passo 1:** `npm run verify` — conferir o código de saída **do comando
      inteiro**, não a última linha de um `tail`.
- [ ] **Passo 2:** `test-results.json`, dentro dos 15 minutos do selo:
      `"F17f-primeiro-sprite": { "passes": true }`, depois de
      `"F17c-buffer-do-astar"`.
- [ ] **Passo 3:** `PROGRESS.md`, seção `## F17f — O primeiro sprite real
      (2026-09-__)`, separando **verificado** de **hipótese**. Registrar: que o
      manifesto **não existia** e nasceu aqui; a medida 1536×1024 → 192×128 e por
      que não é 192×192; que os três estágios da fonte não estão registrados
      entre si e por isso a derivação não recorta; a mudança do `.gitignore` e o
      custo de 7 MB do trio, com a projeção de ~170 MB para 28 prédios como
      **decisão pendente do operador**; a perspectiva isométrica como divergência
      conhecida; e que `tools/derivar-sprites.js` roda a mão e **não** entra no
      `verify`.
- [ ] **Passo 4:** acrescentar **uma Nota** ao item `F17e` no `BUILD_PLAN.md`:
      estágio declarado no manifesto sem arquivo, ou estágio novo sem entrada,
      **cai no retângulo daquele estágio** — nunca no sprite do estágio vizinho.
      Mostrar arte errada esconde arte faltando; o retângulo a denuncia.
- [ ] **Passo 5:** commit final `feat(F17f): <resumo>`.

---

## Autorrevisão

**Cobertura dos quatro pontos:** (1) manifesto — respondido acima, com o achado
de que ele não existe; formato nas Tarefas 3 e a lacuna da semente registrada.
(2) Convenção — medida reportada, 192×128, sem forçar; a guarda
`tamanho[0] === footprint[0] * tile_px` roda em todo `npm run test`. (3)
Coexistência — Tarefa 3 passos 1 e 5 (os dois lados em teste puro) e Tarefa 5
passo 1 (os dois lados na tela). (4) Screenshot com os três elementos — Tarefa 5.

**Riscos conhecidos, com o que fazer:**

1. **`import.meta.glob` fora de `src/`.** O padrão aponta para `../../assets/`,
   dentro da raiz do projeto, o que o Vite aceita; não há `vite.config.*` e a
   raiz é o diretório do projeto. Se falhar, a saída é um `vite.config.ts` com
   `publicDir: 'assets'` — **e isso é mudança de escopo**: pare, registre e
   reporte antes de fazer.
2. **Tamanho do bundle em dev.** Três PNGs de ~40 KB não pesam. A base de 7 MB
   **não** é carregada: só `assets/sprites/**` entra no glob.
3. **Filtragem de textura.** Um sprite de 192 px desenhado em 192 px não reamostra;
   ao mudar `tilePx` (F18a) vai reamostrar, e aí a decisão entre `NEAREST` e
   `LINEAR` é da F18a, não desta.
4. **A feature é grande** — seis tarefas, e a 4 cria o caminho de carregamento do
   zero. Se não couber numa sessão, o corte natural é **depois da Tarefa 3**:
   manifesto, derivação e guarda entregues e commitados, sem tela; o resto vira
   `F17g` no `BUILD_PLAN.md`, registrado em `PROGRESS.md`. Feature pela metade
   **sem registro** é o pior resultado possível (CLAUDE.md §6).
