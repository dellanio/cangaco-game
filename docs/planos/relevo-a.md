# Relevo, opção A: plano de implementação

> **Para quem executa:** o plano é executado nesta sessão, tarefa a tarefa (sem subagente, CLAUDE.md
> §11). Os passos usam checkbox (`- [ ]`).

**Estado: PLANO APROVADO pelo operador (2026-09-30), com as mudanças da seção "Mudanças do
operador" logo abaixo.** Nenhum código foi escrito. A implementação só começa **depois do rebase
sobre a D-TELA-06 da `main`**, a que faz o jogo exigir WebGL.

## Mudanças do operador na aprovação (2026-09-30)

Registradas como decisões. Elas valem sobre qualquer trecho do plano que diga o contrário.

1. **Sigla.** A D-TELA-06 já existe na `main` (o jogo exige WebGL), ainda sem commit. A luz do
   relevo usa o **próximo id livre de D-TELA**, conferido no `BUILD_PLAN.md` **da `main` depois do
   commit dela**, e não no desta branch. Até lá, o plano escreve **D-TELA-xx**. O `xx` é trocado
   em tudo (título, teste, roteiro, commit) logo depois do rebase.
2. **A Tarefa 0 espera.** Primeiro o commit da D-TELA-06 na `main`, depois o rebase desta branch
   sobre ela. Só então a sonda do WebGL no Chromium e a linha de base.
3. **Máquina compartilhada.** A `main` está numa leva longa.
   - Roteiros desta branch rodam **só na porta 5177**, com
     `CANGACO_SHOT_PORTA=5177 npm run shot -- <nome>`.
   - A porta é conferida **antes** de cada roteiro. O `tools/shot.js` já recusa porta ocupada
     (`mensagemDePortaOcupada`); a conferência antes é para não disparar à toa.
   - **`npm run verify` não roda** enquanto o operador não disser que a leva da `main` acabou.
     Até lá, os commits de código esperam: o `verify` antes de cada commit continua valendo, e
     por isso o commit espera o `verify`, e não o contrário.
   - **Nunca matar processo.** Porta ocupada: **parar e reportar.**
4. **`PROGRESS.md` não é editado nesta branch.** As notas da sessão vão na seção "Notas da
   implementação", no fim deste arquivo. O bloco do PROGRESS entra no merge.
5. **`k = 0,85` e a arte.** Vai uma nota para o contrato de arte, na seção "Texto proposto para o
   contrato de arte" abaixo. É texto proposto: a branch de arte não é editada daqui.
6. **Tint da unidade.** Na captura, conferir se o brilho **salta** quando a unidade cruza de
   tile. Se saltar, o tint passa a ser **interpolado pela posição**, e não mais por troca de tile
   (Tarefa 4, passo 3a).

## Texto proposto para o contrato de arte

Destino: a seção `## Cor, valores e luz` de
`noru-novos-sprites:skills/pianco-render-contract/SKILL.md`. **Não foi editado lá:** o operador
leva ao Codex.

> **Sprite visto sob o fator do plano.** Com o relevo ligado, o render multiplica **todo** sprite
> (prédio, unidade, árvore, recurso, pilha) pelo fator de luz do chão sob o pé. No plano, esse
> fator é `k` (`data/relevo.json`, `fatorDoPlano`, hoje **0,85, hipótese** até a arte de terreno
> da F-TR). Numa encosta virada para o sul ele sobe até 1,0, e numa virada para o norte cai abaixo
> de `k`. Por isso:
> - o sprite é **pintado sabendo que será visto a ×`k`**, como o tile de terreno: a folha de
>   contato aplica `k` antes do portão visual, e o valor mais claro da arte (cal, brilho de telha,
>   céu refletido) precisa continuar lendo como claro a ×`k`;
> - não se compensa clareando o sprite inteiro por 1/`k`, o que estouraria os brancos a 1,0. Se a
>   folha de contato mostrar a arte apagada a ×`k`, o ajuste é no valor da arte ou no `k`, e é
>   decisão do operador;
> - o tint é multiplicativo e só escurece. Brilho próprio (fogo da forja, fumaça clara) também
>   escurece com a encosta. Se um dia isso incomodar, é camada separada sem tint, e não arte mais
>   clara.

**Objetivo:** mostrar o relevo suave pela luz (opção A do estudo): uma camada MULTIPLY entre o chão
e os sprites, mais o `setTint` dos sprites pela luz sob o pé. Tudo **desligado por padrão**.

**Arquitetura:**
- A altura é **só de render**. Ela sai de `tools/gerar-mapa.js` (tipos de terreno mais ruído
  semeado) para um arquivo próprio, `data/maps/sertao-128.relevo.json`, que só o render lê.
- A conta da luz é pura, em `src/render/relevo.ts`, e testada no Vitest sem Phaser.
- O que toca o Phaser mora em `src/render/camada-de-relevo.ts`.
- O `WorldScene.ts` ganha quatro ganchos de uma linha cada, e o `unidades.ts` ganha um parâmetro.

**Stack:** TypeScript, Phaser 3.90 (só `Image`, `setBlendMode` e `setTint`: sem shader e sem
pipeline), Vitest e Playwright.

**Fonte única:** `docs/planos/estudo-relevo.md`, inteiro, inclusive a seção 7 ("Decisões do
operador (2026-09-30)").

**Branch:** `dellanio/relevo-a`, criada da `main` em `76dbcc8` nesta worktree
(`implementacao-relevo`). Sem merge: ele espera a `main` limpa e a aprovação do operador.

## Restrições globais

- **Só a opção A.** Nada de B, C, splatting, vento ou agrupamento de matas.
- **A flag nasce desligada** (`data/relevo.json`, `"ligado": false`). Com ela desligada, nenhum
  teste, roteiro ou captura muda em relação à `main`.
- **Proteção de renderizador:** se o renderizador ativo não for WebGL, a camada **e** o tint ficam
  desligados, mesmo com a flag ligada. A troca de `Phaser.AUTO` para `Phaser.WEBGL`
  (`src/render/game.ts:48`) **não** é feita aqui.
- **Nada na sim:** nenhum arquivo de `src/sim/` muda, nada entra no `GameState`, e o `sim/` não
  importa o arquivo de altura nem o `data/relevo.json`. Um teste estrutural guarda isso.
- **Só relevo suave:** fora de `montanha` e `rocha`, a diferença entre os 4 vértices de um tile é
  no máximo `decliveMaximoEmDegraus`. O que tem de parecer intransitável continua sendo tile de
  montanha ou rocha.
- **Luz do mundo:** de cima, inclinada levemente para o sul, **sem componente leste–oeste**. O
  dado não tem campo leste–oeste, de propósito.
- **Fator do plano `k = 0,85`**, em `data/relevo.json` e **marcado como hipótese** até a arte de
  terreno da F-TR existir.
- **Tint obrigatório** em árvore, prédio, recurso, pilha e unidade, pela luz do vértice sob o pé:
  - objeto fixo: uma vez, ao nascer;
  - unidade: a cada mudança de tile.
- `src/render/` e `tools/` mudam. `src/sim/` não muda, e a regra do §10 (render e sim na mesma
  feature) não é acionada.
- `verify` roda antes de cada commit, **só depois de o operador liberar** (mudança 3). Nenhum
  `skip`, `eslint-disable` ou `ignores` novo.
- Roteiro só na **porta 5177**, conferida antes; porta ocupada é parar e reportar, e nunca matar
  processo (mudança 3).

## Siglas e fila

Pelo `docs/siglas.md` ("se muda os dois, são dois itens"), são **dois itens** da Fase D:

| Sigla | Nome | Onde |
|---|---|---|
| **D-TERRENO-01** | altura só de render no gerador de mapa | `tools/`, `data/` |
| **D-TELA-xx** | luz do relevo: camada MULTIPLY e tint dos sprites | `src/render/` |

A D-TERRENO-01 foi conferida em todas as branches locais: não há TERRENO no esquema novo. **Ela
também é reconferida no `BUILD_PLAN.md` da `main` depois do rebase**, junto com o id da D-TELA-xx
(mudança 1).

Os dois entram no `BUILD_PLAN.md` com o aceite abaixo, e no `test-results.json` só depois do
Definition of Done (§7).

**A D-TELA-xx não é "feature de integração":** ela não toca em `src/sim/`.

---

## O que muda, onde

| Arquivo | Muda | Tarefa |
|---|---|---|
| `data/relevo.json` | **novo.** Os números do relevo, a flag e a hipótese de `k` | 1 |
| `data/maps/sertao-128.relevo.json` | **novo, emitido.** A altura por vértice | 1 |
| `tools/gerar-mapa.js` | emite o segundo arquivo, com o próprio RNG. O `sertao-128.json` sai **byte a byte igual** | 1 |
| `tools/data-schema.js`, `tools/data-rules.js` | `relevo` entra em `ARQUIVOS_DA_INTERFACE`, com a regra própria | 1 |
| `tests/D-TERRENO-01-relevo-do-gerador.test.ts` | **novo** | 1 |
| `src/render/relevo.ts` | **novo, puro.** Lê a altura, calcula a luz, amostra sob o pé, decide se liga | 2 |
| `tests/D-TELA-xx-luz-do-relevo.test.ts` | **novo.** A conta da luz, a decisão de ligar e a guarda estrutural | 2 |
| `src/render/camada-de-relevo.ts` | **novo, Phaser.** A textura, a imagem MULTIPLY e o tint | 3 |
| `src/render/scenes/WorldScene.ts` | **4 ganchos** (abaixo) | 3 |
| `src/render/unidades.ts` | parâmetro opcional `luz`, e uma linha no `atualizar` | 3 |
| `src/render/debug.ts` | campo **opcional** `relevo?`, só escrito com a flag pedida | 3 |
| `tools/shots/D-TELA-xx.js` | **novo.** O roteiro com a flag ligada | 4 |
| `BUILD_PLAN.md`, `test-results.json` | os itens e as chaves (o `PROGRESS.md` **não**: mudança 4) | 5 |

### Os ganchos no `WorldScene.ts`

São **quatro**, e todos são `null`-seguros: com a flag desligada, `this.luz` é `null` e nenhum
deles faz nada.

1. **Campo:** `private luz: LuzDoRelevo | null = null;`, junto dos outros campos de memória de
   render (perto de `:154`).
2. **`create()`**, logo depois de `criarCamadaDeRecursos` (`:317`) e **antes** do primeiro
   `atualizarPredios` (`:331`):

   ```ts
   this.luz = criarCamadaDeRelevo(this, configDoMapa, window.location.search, estado);
   ```

   Na mesma função, `criarCamadaDeUnidades(this, tilePx)` (`:339`) passa a receber `this.luz`.
3. **Vegetação e rocha:** no fim de `desenharVegetacao`, depois do `this.add.image(...)` (`:1195`):

   ```ts
   this.luz?.tingir(imagem, pe.x, pe.y, `vegetacao:${chave}`);
   ```

4. **Prédio, com pilhas, trabalho e animais:** no fim de `criarPredio`, antes do `return`
   (`:1654`):

   ```ts
   this.luz?.tingirContainer(container, canto.x + larguraPx / 2, canto.y + alturaPx, `predio:${predio.id}`);
   ```

**Nada mais** no `WorldScene.ts`.

### Profundidade da camada

A camada vai em depth **3**:
- **acima** do chão, das transições, da grade, dos recursos (0,5), da estrada (1) e do canteiro de
  campo (2), que recebem a luz pelo MULTIPLY;
- **abaixo** de todo sprite, cujo depth é o y do pé (`depthDeY`), sempre ≥ ~30 px.

O número é constante de TELA no módulo, como `DEPTH_DA_ESTRADA`.

### Formato do arquivo de altura

É o `data/maps/sertao-128.relevo.json`, emitido. Ele segue o estilo do mapa: uma linha de texto
por fileira, para o diff do git ficar legível.

```json
{
  "id": "sertao-128",
  "_doc": "Altura SO DE RENDER (opcao A, docs/planos/estudo-relevo.md). EMITIDO por tools/gerar-mapa.js. sim/ nunca le este arquivo. Uma linha por fileira de VERTICES: o tile (gx,gy) tem os cantos (gx,gy), (gx+1,gy), (gx,gy+1) e (gx+1,gy+1). Um char por vertice, na legenda: 0-9 e depois a-z, o degrau inteiro de 0 a 35.",
  "gerador": "tools/gerar-mapa.js",
  "mapa": "data/maps/sertao-128.json",
  "semente": 20260930,
  "largura": 129,
  "altura": 129,
  "linhas": [
    "4444455566...",
    "..."
  ]
}
```

- **O vértice é o canto do tile**, como no KaM (estudo 1.1). São `(L+1)×(A+1)` vértices.
- **Degrau inteiro de 0 a 35**, com um char base-36. O teto é do formato, e não balanceamento.
- A semente é **própria**: um `mulberry32` separado, depois do terreno e dos recursos, e por isso o
  `sertao-128.json` não muda. Quem guarda isso é o teste F-D3, que já compara o emitido com o
  disco.
- O `--conferir` passa a conferir os dois arquivos.

### `data/relevo.json`

```json
{
  "_doc": "Relevo SO DE RENDER, opcao A (docs/planos/estudo-relevo.md, secao 7). sim/ nunca le este arquivo. `ligado` e a flag: false ate a arte de terreno da F-TR entrar. `?relevo` na URL liga para o roteiro. Sem WebGL a camada e o tint ficam desligados mesmo ligado.",
  "ligado": false,
  "fatorDoPlano": 0.85,
  "_hipotese_fatorDoPlano": "HIPOTESE: e o valor da captura do estudo (2026-09-30), nao calibrado. Calibrar na folha de contato quando a arte de terreno da F-TR existir (estudo, secao 7, item 14).",
  "fatorMinimo": 0.5,
  "pxDeMundoPorDegrau": 8,
  "luz": {
    "_doc": "De cima, inclinada levemente para o sul, SEM componente leste-oeste (decisao do operador, 2026-09-30). Nao ha campo leste-oeste de proposito.",
    "inclinacaoParaOSulGraus": 30
  },
  "geracao": {
    "semente": 20260930,
    "celulaDoRuidoEmTiles": 12,
    "amplitudeDoRuidoEmDegraus": 4,
    "decliveMaximoEmDegraus": 2,
    "tiposSemLimiteDeDeclive": ["montanha", "rocha"],
    "basePorTipo": { "agua": 0, "areia": 2, "campoArado": 4, "grama": 4, "rocha": 5, "montanha": 14 }
  }
}
```

**A validação** (`validate:data`, regra `interface/relevo`) exige:
- `0 < fatorMinimo ≤ fatorDoPlano ≤ 1`;
- `0 < inclinacaoParaOSulGraus < 90`;
- `basePorTipo` cobrindo todo tipo da legenda do mapa;
- base e amplitude dentro de 0–35;
- `decliveMaximoEmDegraus ≥ 1`;
- todo tipo de `tiposSemLimiteDeDeclive` sendo tipo do mapa.

**Os números da geração e da luz são ponto de partida**, a conferir na captura da Tarefa 4. Com
`pxDeMundoPorDegrau` 8, o declive máximo de 2 degraus dá uma encosta de 16 px por tile de 64
(~14°). Com a luz a 30° para o sul e `k` 0,85, isso dá:

| Encosta | Fator |
|---|---|
| virada para o sul | ~0,94 |
| plano | 0,85 |
| virada para o norte | ~0,71 |
| leste ou oeste | ~0,82 (iguais entre si) |

### A conta da luz

É o Lambert com a luz `L = (0, sen θ, cos θ)`, com y para o sul, e normalizada pelo plano.

```
g  = gradiente da altura no vértice (diferença central), em px de mundo por px de mundo
n  = normalizar(-gx, -gy, 1)
f  = k · (n·L) / cos θ, preso em [fatorMinimo, 1]
```

- O plano dá exatamente `k`.
- Com `Lx = 0`, `gx` e `−gx` dão o mesmo fator: é o que o teste afirma para "sem leste–oeste".
- A amostra sob o pé é **bilinear** entre os 4 vértices do tile, como o `RenderFlatToHeight` do
  KaM. Fora do mapa, a coordenada é presa à borda.

---

## Foco de revisão

Os casos que nenhum aceite escrito cobre e que mais podem morder:

1. **Flag ligada no Canvas:** a camada **e** o tint ficam desligados, os dois juntos. Teste da
   decisão `relevoAtivo` na Tarefa 2; o debug diz `ativo: false, motivo: 'canvas'`.
2. **Sprite recriado perde o tint:** a árvore que cresce (`desenharVegetacao` destrói e recria) e
   a obra que muda de estágio (`criarPredio` recria o container). O tint vive **no ponto de
   criação**, e não num passe único no `create`. O roteiro afirma o fator de um prédio depois de
   uma troca de estágio.
3. **Unidade cuja imagem nasce depois:** o placeholder vira sprite quando a arte resolve. O tint
   "por troca de tile" guarda o último tile num `WeakMap` indexado pela **imagem**, então imagem
   nova é tingida mesmo sem troca de tile. Teste puro do `precisaRetingir`.
4. **UI dentro do container não escurece:** medidor, texto e rótulo continuam legíveis. Só
   `Image` (e `Sprite`, que herda dela) recebe tint; `Graphics`, `Shape` e `Text` não. O
   placeholder geométrico também fica sem luz, o que é aceito: placeholder é comportamento
   normal (§9). A Tarefa 3 confere os tipos do `desenharMedidor` e do `desenharBandeira` antes de
   fechar.
5. **Borda do mapa e coordenada negativa:** o desvio de desenho da unidade (F18f) pode pôr o pé a
   poucos px fora do mapa. A amostra prende a coordenada, e o teste cobre (−5, −5) e
   (largura·64 + 5, …).

**Fora do foco, e registrado:** o `tools/transladar-mundo.js` (F18c) não translada a altura. Com a
flag desligada é irrelevante, porque a suíte transladada roda a sim, e a sim não lê altura. Vira
nota no item D-TELA-xx do `BUILD_PLAN.md`.

---

## Tarefa 0: rebase, linha de base e sonda do WebGL (sem commit)

**Não roda antes** do commit da D-TELA-06 na `main` (mudança 2). Duas perguntas precisam de
resposta **antes** de construir (a lição de sondar o travamento antes de construir em cima).

- [ ] **Passo 0: o rebase.**
  - `git status` limpo nesta worktree.
  - `git log main` mostra o commit da D-TELA-06, e o `git status` do diretório da `main` está
    limpo (a leva terminou o commit dela).
  - `git rebase main`.
  - Ler o `BUILD_PLAN.md` da `main`: o próximo id livre de D-TELA substitui o `xx` em todo este
    arquivo, e a D-TERRENO-01 é reconferida.
  - Ler o que a D-TELA-06 mudou no `src/render/game.ts` e em volta: se o jogo passou a exigir
    WebGL, a proteção de renderizador continua no plano (é pedido do operador), mas o caso Canvas
    deixa de acontecer na prática. Registro isso nas "Notas da implementação".
- [ ] **Passo 1: linha de base dos roteiros, na `main` rebaseada, antes de qualquer código.**
  - A porta 5177 é conferida antes (`curl -s -o /dev/null -w '%{http_code}' localhost:5177`, que
    tem de falhar). Se estiver ocupada, **paro e reporto**, sem matar processo.
  - Rodar cada `tools/shots/*.js` que não começa com `_`, um por vez, com
    `CANGACO_SHOT_PORTA=5177`. Cada roteiro sobe e derruba o próprio servidor: o `shot.js` recusa
    porta que já responde.
  - Gravar no scratchpad `linha-de-base.json`, no formato
    `{ roteiro: { saida, pngs: { nome: sha256 } } }`.
  - É a referência do "iguais aos da `main`". Não entra no git.
- [ ] **Passo 2: a sonda do WebGL.** Um roteiro temporário, `tools/shots/zz-sonda-webgl.js`, que
  faz:

  ```js
  const webgl = await page.evaluate(() => {
    const c = document.querySelector('#jogo canvas');
    return Boolean(c && (c.getContext('webgl2') || c.getContext('webgl')));
  });
  ```

  `getContext('webgl')` num canvas que já tem contexto 2D devolve `null`, e num canvas WebGL
  devolve o contexto existente. A sonda não muda nada no jogo.
- [ ] **Passo 3: decidir.**
  - Se o Chromium do runner **não** der WebGL depois do rebase, o roteiro da Tarefa 4 não tem
    como mostrar a luz. **Paro e reporto**, sem contornar.
  - Se der, apago a sonda: `git status` sem o `zz-`.

## Tarefa 1: D-TERRENO-01, a altura só de render no gerador

**Arquivos:** `data/relevo.json` (novo), `tools/gerar-mapa.js`, `tools/data-schema.js`,
`tools/data-rules.js`, `data/maps/sertao-128.relevo.json` (emitido) e
`tests/D-TERRENO-01-relevo-do-gerador.test.ts` (novo).

**Interfaces:**
- **Produz**, no `module.exports` do `gerar-mapa.js`:
  - `montarRelevo(grade, cfg) -> { largura, altura, h: number[] }` (row-major, `(L+1)×(A+1)`);
  - `montarArquivoDeRelevo() -> objeto do arquivo`;
  - `serializarRelevo(arquivo) -> string`;
  - `forcarDecliveMaximo(h, grade, cfg)`, que muta e devolve o número de vértices baixados;
  - `declivesForaDoLimite(h, grade, cfg) -> Array<[gx, gy, amplitude]>`.

- [ ] **Passo 1: o teste que falha.** `tests/D-TERRENO-01-relevo-do-gerador.test.ts`:
  - **Determinismo:** duas chamadas de `montarArquivoDeRelevo()` dão o mesmo `serializarRelevo`,
    igual ao arquivo no disco (com o CRLF normalizado, como no F-D3). Uma semente diferente
    (`cfg` com `semente + 1`) dá outro `h`.
  - **Declive máximo:** `declivesForaDoLimite` é **vazio** no arquivo do disco.
  - **A guarda acusa:** uma grade 3×3 de grama com um vértice a +5 dá uma lista não vazia. Depois
    de `forcarDecliveMaximo`, a lista fica vazia e o vértice fica ≤ `min + D`.
  - **Não é plano por acaso:** fora de montanha e rocha, existe tile com amplitude > 0, e a
    amplitude global é ≥ `decliveMaximoEmDegraus` (senão o teste do declive passaria num mapa
    liso).
  - **Montanha é mais alta:** a média dos vértices interiores de montanha (os 4 tiles em volta
    são montanha) é maior que a média dos vértices só de grama.
  - **Faixa:** todo degrau está em 0–35.
  - **Formato:** `linhas.length === altura + 1`, cada linha com `largura + 1` chars da legenda.
- [ ] **Passo 2:** `npx vitest run tests/D-TERRENO-01-relevo-do-gerador.test.ts` falha
  (`montarArquivoDeRelevo is not a function`).
- [ ] **Passo 3: implementar no `gerar-mapa.js`.** O esboço:

  ```js
  const RELEVO = require(path.join(RAIZ, 'data', 'relevo.json'));
  const SAIDA_DO_RELEVO = path.join(RAIZ, 'data', 'maps', `${ID}.relevo.json`);
  const DIGITOS = '0123456789abcdefghijklmnopqrstuvwxyz'; // formato: degrau 0..35

  /** Ruido de valor semeado: grade grossa, interpolacao bilinear com smoothstep. So
   *  + - * / e floor: nada de Math.sin, para o numero nao depender do motor. */
  function ruidoDeValor(rng, largura, altura, celula) {
    const gl = Math.ceil(largura / celula) + 2;
    const ga = Math.ceil(altura / celula) + 2;
    const grossa = Array.from({ length: gl * ga }, () => rng());
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const cx = x / celula, cy = y / celula;
      const ix = Math.floor(cx), iy = Math.floor(cy);
      const fx = s(cx - ix), fy = s(cy - iy);
      const g = (i, j) => grossa[j * gl + i];
      const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * fx;
      const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * fx;
      return a + (b - a) * fy;
    };
  }

  /** Os tiles (ate 4) que tocam o vertice (vx,vy). */
  function tilesDoVertice(vx, vy, largura, altura) {
    const tiles = [];
    for (const [gx, gy] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]]) {
      if (gx >= 0 && gy >= 0 && gx < largura && gy < altura) tiles.push([gx, gy]);
    }
    return tiles;
  }

  function cantos(gx, gy, vl) {
    return [gy * vl + gx, gy * vl + gx + 1, (gy + 1) * vl + gx, (gy + 1) * vl + gx + 1];
  }

  function limitado(grade, gx, gy, cfg) {
    return !cfg.tiposSemLimiteDeDeclive.includes(grade[gy][gx]);
  }

  /** So BAIXA vertice: a altura e inteira, nao cresce e tem piso, entao o laco termina. */
  function forcarDecliveMaximo(h, grade, cfg) {
    const altura = grade.length, largura = grade[0].length, vl = largura + 1;
    let baixados = 0;
    for (let mudou = true; mudou;) {
      mudou = false;
      for (let gy = 0; gy < altura; gy += 1) for (let gx = 0; gx < largura; gx += 1) {
        if (!limitado(grade, gx, gy, cfg)) continue;
        const c = cantos(gx, gy, vl);
        const teto = Math.min(...c.map((i) => h[i])) + cfg.decliveMaximoEmDegraus;
        for (const i of c) if (h[i] > teto) { h[i] = teto; baixados += 1; mudou = true; }
      }
    }
    return baixados;
  }

  function declivesForaDoLimite(h, grade, cfg) {
    const altura = grade.length, largura = grade[0].length, vl = largura + 1, fora = [];
    for (let gy = 0; gy < altura; gy += 1) for (let gx = 0; gx < largura; gx += 1) {
      if (!limitado(grade, gx, gy, cfg)) continue;
      const v = cantos(gx, gy, vl).map((i) => h[i]);
      const amp = Math.max(...v) - Math.min(...v);
      if (amp > cfg.decliveMaximoEmDegraus) fora.push([gx, gy, amp]);
    }
    return fora;
  }

  function montarRelevo(grade, cfg) {
    const altura = grade.length, largura = grade[0].length;
    const vl = largura + 1, va = altura + 1;
    const ruido = ruidoDeValor(mulberry32(cfg.semente), vl, va, cfg.celulaDoRuidoEmTiles);
    const h = new Array(vl * va);
    for (let vy = 0; vy < va; vy += 1) for (let vx = 0; vx < vl; vx += 1) {
      const tiles = tilesDoVertice(vx, vy, largura, altura);
      const base = tiles.reduce((s, [gx, gy]) => s + cfg.basePorTipo[grade[gy][gx]], 0) / tiles.length;
      const bruto = Math.round(base + cfg.amplitudeDoRuidoEmDegraus * ruido(vx, vy));
      h[vy * vl + vx] = Math.max(0, Math.min(DIGITOS.length - 1, bruto));
    }
    forcarDecliveMaximo(h, grade, cfg);
    return { largura: vl, altura: va, h };
  }
  ```

  Mais, no mesmo arquivo:
  - `montarArquivoDeRelevo()`: chama `gerar()` de novo (é determinístico) para ter a `grade`, e
    monta o objeto do formato acima;
  - `serializarRelevo()`: uma linha por fileira, como `serializar`;
  - `main()`: escreve e confere os **dois** arquivos. O `sertao-128.json` segue pelo mesmo caminho
    de hoje, sem mudar nada nele.
- [ ] **Passo 4: validação.**
  - `tools/data-schema.js`: `ARQUIVOS_DA_INTERFACE = ['theme-sertao', 'menu-build', 'relevo']`.
  - `tools/data-rules.js`: `validarRelevo(dados, interfaceUi)`, com as regras da seção
    `data/relevo.json`, chamada de dentro de `validarInterface`.
  - No teste: uma cópia com `fatorDoPlano: 1.2` reprova com `interface/relevo`. O caminho é o
    `--dir` que o `validate-data.js` já aceita.
- [ ] **Passo 5:** `node tools/gerar-mapa.js` escreve o `.relevo.json`, e depois:
  - `git diff --stat data/maps/sertao-128.json` fica **vazio**;
  - `node tools/gerar-mapa.js --conferir` sai 0.
- [ ] **Passo 6:** o teste novo passa, e `npm run verify` passa inteiro.
- [ ] **Passo 7: commit.**

  ```
  feat(D-TERRENO-01): altura so de render no gerador de mapa, com teto de declive
  ```

## Tarefa 2: D-TELA-xx, a conta pura da luz

**Arquivos:** `src/render/relevo.ts` (novo) e `tests/D-TELA-xx-luz-do-relevo.test.ts` (novo).

**Interfaces:**
- **Consome** `data/relevo.json` e `data/maps/sertao-128.relevo.json`, por import estático de
  JSON, como o `mapa.ts` faz com o tema. `relevo.ts` é o **único** arquivo do projeto que importa o
  arquivo de altura.
- **Produz:**

  ```ts
  export interface ParametrosDaLuz {
    readonly fatorDoPlano: number;
    readonly fatorMinimo: number;
    readonly pxDeMundoPorDegrau: number;
    readonly inclinacaoParaOSulGraus: number;
  }
  export interface AlturasDoRelevo { readonly largura: number; readonly altura: number; readonly h: Uint8Array }
  export interface MapaDeLuz { readonly largura: number; readonly altura: number; readonly fator: Float32Array }
  export const parametrosDaLuz: ParametrosDaLuz;           // de data/relevo.json
  export function lerAlturas(arquivo: { largura: number; altura: number; linhas: readonly string[] }): AlturasDoRelevo;
  export function alturasDoMapa(): AlturasDoRelevo;       // o arquivo emitido
  export function calcularLuz(alt: AlturasDoRelevo, p: ParametrosDaLuz, tilePx: number): MapaDeLuz;
  export function fatorEm(luz: MapaDeLuz, xMundo: number, yMundo: number, tilePx: number): number; // bilinear, preso na borda
  export function tintDoFator(f: number): number;         // 0xRRGGBB cinza, round(f*255)
  export function relevoPedido(busca: string, ligadoNoDado: boolean): boolean; // dado || ?relevo
  export type DecisaoDoRelevo =
    | { readonly ativo: true }
    | { readonly ativo: false; readonly motivo: 'desligado' | 'canvas' };
  export function decidirRelevo(pedido: boolean, webgl: boolean): DecisaoDoRelevo;
  export function tileDoPe(x: number, y: number, tilePx: number): string; // "gx,gy", para o retingir
  ```

- [ ] **Passo 1: o teste que falha.** `tests/D-TELA-xx-luz-do-relevo.test.ts`:
  - **Plano dá `k`:** tudo a 5 dá `fator === fatorDoPlano` em todo vértice interior.
  - **Sul clareia, norte escurece:** uma rampa que desce para o sul (h diminuindo com y) dá
    `> k` e `≤ 1`. A rampa espelhada dá `< k` e `≥ fatorMinimo`.
  - **Sem leste–oeste:** a rampa para leste e a rampa para oeste dão o **mesmo** fator (igualdade
    exata), `≤ k`.
  - **Bilinear:** no vértice, dá o valor do vértice; no centro do tile, a média dos 4.
  - **Presa à borda:** (−5, −5) dá o fator do vértice (0, 0), e fora pela direita e por baixo, o
    do canto.
  - **`tintDoFator`:** 1 dá `0xffffff`, 0,85 dá `0xd9d9d9`, e é monotônico.
  - **Decisão:**
    - `decidirRelevo(false, true)` dá `{ ativo: false, motivo: 'desligado' }`;
    - `decidirRelevo(true, false)` dá `{ ativo: false, motivo: 'canvas' }`;
    - `decidirRelevo(true, true)` dá `{ ativo: true }`;
    - `relevoPedido('?pausado', false)` dá `false`, e `relevoPedido('?pausado&relevo', false)` dá
      `true`.
  - **Padrão desligado:** `import relevo from '../data/relevo.json'` tem `ligado === false`.
  - **Hipótese marcada:** `_hipotese_fatorDoPlano` existe e cita `F-TR`.
  - **Guarda estrutural** (import, não substring de número):
    - nenhum arquivo de `src/sim/**` tem import que resolva para `data/relevo.json` ou
      `data/maps/*.relevo.json`;
    - em `src/`, só `src/render/relevo.ts` importa o arquivo de altura.

    O `import` é extraído com a mesma leitura que o teste estrutural da F04 usa, que vou
    conferir e reutilizar em vez de inventar outra.
  - **O arquivo real:** `calcularLuz(alturasDoMapa(), parametrosDaLuz, 64)` tem todo fator em
    `[fatorMinimo, 1]`, e existe fator `> k` e `< k` (o mapa tem relevo).
- [ ] **Passo 2:** o teste falha (o módulo não existe).
- [ ] **Passo 3: implementar `relevo.ts`.** O núcleo:

  ```ts
  export function calcularLuz(alt: AlturasDoRelevo, p: ParametrosDaLuz, tilePx: number): MapaDeLuz {
    const { largura, altura, h } = alt;
    const theta = (p.inclinacaoParaOSulGraus * Math.PI) / 180;
    const ly = Math.sin(theta), lz = Math.cos(theta); // lx = 0: sem leste-oeste (decisao 2026-09-30)
    const escala = p.pxDeMundoPorDegrau / tilePx;     // degrau por tile -> px por px
    const fator = new Float32Array(largura * altura);
    const em = (x: number, y: number): number =>
      h[Math.min(altura - 1, Math.max(0, y)) * largura + Math.min(largura - 1, Math.max(0, x))]!;
    for (let y = 0; y < altura; y += 1) for (let x = 0; x < largura; x += 1) {
      const gx = ((em(x + 1, y) - em(x - 1, y)) / 2) * escala;
      const gy = ((em(x, y + 1) - em(x, y - 1)) / 2) * escala;
      const nDotL = (-gy * ly + lz) / Math.hypot(gx, gy, 1);
      fator[y * largura + x] = Math.min(1, Math.max(p.fatorMinimo, (p.fatorDoPlano * nDotL) / lz));
    }
    return { largura, altura, fator };
  }
  ```

  - `fatorEm`: vértice `(x/tilePx, y/tilePx)`, preso a `[0, largura-1]`, e a interpolação bilinear
    dos 4.
  - `relevoPedido`: `ligadoNoDado || new URLSearchParams(busca).has('relevo')`.
- [ ] **Passo 4:** o teste passa; `npm run verify` passa.
- [ ] **Passo 5: commit.**

  ```
  feat(D-TELA-xx): conta pura da luz do relevo (sul, sem leste-oeste, k do dado)
  ```

## Tarefa 3: D-TELA-xx, a camada MULTIPLY, o tint e os ganchos

**Arquivos:**
- novo: `src/render/camada-de-relevo.ts`;
- mudam: `src/render/scenes/WorldScene.ts` (os 4 ganchos), `src/render/unidades.ts` e
  `src/render/debug.ts`.

**Interfaces:**
- **Consome** tudo de `relevo.ts`.
- **Produz:**

  ```ts
  export interface LuzDoRelevo {
    /** Tinge um Image/Sprite com o fator sob o pe. Uma vez: objeto fixo. */
    tingir(obj: Phaser.GameObjects.GameObject, xPe: number, yPe: number, rotulo: string): void;
    /** Tinge todo Image/Sprite do container (recursivo), com o mesmo fator do pe do predio. */
    tingirContainer(c: Phaser.GameObjects.Container, xPe: number, yPe: number, rotulo: string): void;
    /** Unidade: so retinge quando o tile do pe muda, ou quando a imagem e nova. */
    tingirSeMudouDeTile(img: Phaser.GameObjects.Image | null, xPe: number, yPe: number, rotulo: string): void;
  }
  export function criarCamadaDeRelevo(
    cena: Phaser.Scene, config: ConfigDoMapa, busca: string, debug: EstadoDebug,
  ): LuzDoRelevo | null;
  ```

  No `debug.ts`, um campo **opcional**, escrito **só** quando a flag foi pedida. Com a flag
  desligada, o `window.__cangaco` fica idêntico ao da `main`.

  ```ts
  relevo?: {
    ativo: boolean;
    motivo: 'desligado' | 'canvas' | null;
    renderizador: 'webgl' | 'canvas';
    fatorDoPlano: number;
    vertices: [number, number];
    /** rotulo -> fator aplicado: 'predio:<id>', 'unidade:<id>', 'vegetacao:<gx,gy>'. */
    fatores: Record<string, number>;
  };
  ```

- [ ] **Passo 1: `criarCamadaDeRelevo`.**
  - Decide, e devolve `null` se desligado:

    ```ts
    const pedido = relevoPedido(busca, dados.ligado);
    const webgl = cena.game.renderer.type === Phaser.WEBGL;
    ```

    Pedido e sem WebGL: escreve `debug.relevo` com `ativo: false, motivo: 'canvas'` e devolve
    `null`. Assim, **camada e tint caem juntos.**
  - Ativo:
    - `calcularLuz`;
    - uma `CanvasTexture` de `largura × altura` (129×129), um pixel cinza por vértice
      (`round(f·255)`), com `setFilter(LINEAR)`;
    - `cena.add.image(-tilePx/2, -tilePx/2, chave).setOrigin(0).setDisplaySize(largura·tilePx, altura·tilePx)`,
      que põe o centro do texel (i, j) no vértice (i·tilePx, j·tilePx);
    - `.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(DEPTH_DA_LUZ)`, com `DEPTH_DA_LUZ = 3`.
  - O tint: `setTint(tintDoFator(fatorEm(...)))` em `instanceof Phaser.GameObjects.Image`, e
    `tingirContainer` desce por `container.list`, recursivo. Todo tint escreve
    `debug.relevo.fatores[rotulo]`.
  - O `tingirSeMudouDeTile` guarda `WeakMap<Image, string>` com o `tileDoPe`.
- [ ] **Passo 2: os 4 ganchos no `WorldScene.ts`** (seção "Os ganchos"). Mais, no `unidades.ts`:
  - `criarCamadaDeUnidades(cena, tilePx, luz: LuzDoRelevo | null = null)`;
  - no `atualizar`, depois do `setPosition` (`:279`):

    ```ts
    luz?.tingirSeMudouDeTile(item.imagem, centro.x + desvio.x, centro.y + desvio.y, `unidade:${id}`);
    ```

- [ ] **Passo 3:** conferir no código que `desenharMedidor` e `desenharBandeira` devolvem
  `Graphics`, `Rectangle` ou `Text`, e não `Image`.
  - Se algum devolver `Image` de UI (o medidor), `tingirContainer` pula esse objeto por uma marca
    explícita (`setData('semLuz', true)` no ponto de criação), e não por posição na lista.
  - A bandeira é objeto do mundo e **recebe** a luz.
- [ ] **Passo 4:** `npm run verify` passa.
- [ ] **Passo 5: regressão rápida com a flag desligada.** Três roteiros que cobrem o que os ganchos
  tocam: `F-TR` (terreno e recurso), `F-VIVO-a` (prédio com pilha) e `F10` (unidade). Saída 0 e
  sha256 dos PNGs iguais à linha de base da Tarefa 0.
  - Se um sha divergir, rodar o mesmo roteiro de novo na linha de base, numa worktree temporária
    na `main`, para separar ruído de captura de mudança real. O resultado vai para as "Notas
    da implementação".
- [ ] **Passo 6: commit.**

  ```
  feat(D-TELA-xx): camada MULTIPLY do relevo e tint dos sprites, atras da flag e do WebGL
  ```

## Tarefa 4: D-TELA-xx, o roteiro com a flag ligada

**Arquivos:** `tools/shots/D-TELA-xx.js` (novo).

- [ ] **Passo 1: o roteiro.**
  - Reabre com `?pausado&relevo`, como o `_sem-arte.js` faz com `?semArte`.
  - Afirma, pelo `window.__cangaco.relevo`:
    - `ativo === true` e `renderizador === 'webgl'`;
    - `vertices` igual a `[largura + 1, altura + 1]` do mapa.
  - **Escolhe o lugar pelo dado, sem coordenada digitada.** Lê `data/maps/sertao-128.json` e o
    `.relevo.json`, e acha, perto da vila, um retângulo de tela que contenha **grama, areia e
    rocha**, e um tile de encosta (amplitude = `decliveMaximoEmDegraus`) onde a planta de um
    prédio pequeno passe no `canPlace`.
  - Põe o prédio pelo comando de colocar que os roteiros já usam, e centra a câmera ali.
  - A árvore é uma do mapa dentro do quadro. O serf é o da vila, avançado até entrar no quadro
    (`avancar(n)`), ou o quadro inclui o armazém.
  - **Afirma os fatores:**
    - `fatores['predio:<id>']`, `fatores['vegetacao:<gx,gy>']` e `fatores['unidade:<id>']`
      existem e ficam em `[fatorMinimo, 1]`;
    - o fator do prédio na encosta é **≠ `fatorDoPlano`**.
  - Avança o bastante para a obra trocar de estágio e afirma que `fatores['predio:<id>']` foi
    escrito de novo (Foco de revisão 2).
  - **Um passo despausado** (`press('p')`, `waitForTimeout(150)`, `press('p')`), para o serf trocar
    de tile e o `fatores['unidade:<id>']` mudar ou se manter coerente com o tile novo. É a lição
    do roteiro pausado (§8).
  - Captura:
    - `screenshots/D-TELA-xx-1.png`: o quadro com relevo;
    - `screenshots/D-TELA-xx-2.png`: o mesmo quadro, recarregado **sem** `?relevo`, para a
      comparação lado a lado.
  - **O salto de brilho da unidade (mudança 6).** O roteiro segue um serf andando por uma
    encosta, despausado em passos curtos. A cada quadro registra `fatores['unidade:<id>']` e o x,
    y desenhado, e grava a série em `test-output/D-TELA-xx-tint-da-unidade.json`. Captura duas
    imagens coladas: `screenshots/D-TELA-xx-3.png` com o serf no último quadro antes de cruzar o
    tile, e `-4.png` com ele no primeiro quadro depois.
- [ ] **Passo 2:** `CANGACO_SHOT_PORTA=5177 npm run shot -- D-TELA-xx` sai 0, com a porta
  conferida antes.
- [ ] **Passo 3: abrir as duas capturas com Read** (evidência da feature atual, §8). O que olhar:
  - encosta clara ao sul e escura ao norte;
  - sprites no mesmo tom do chão, sem recorte;
  - grama, areia e rocha no quadro;
  - nenhuma encosta que pareça parede fora de montanha.

  Se os números de partida (amplitude, `pxDeMundoPorDegrau`, inclinação) derem relevo invisível
  ou exagerado, ajusto **só** `data/relevo.json` e regenero. Os números novos e o motivo vão para
  as "Notas da implementação". `k` fica em 0,85: ele espera a F-TR.
- [ ] **Passo 3a: o salto do tint da unidade.** Abrir `-3.png` e `-4.png`, e ler a série do
  JSON.
  - **Salta** se a diferença de fator na troca de tile for perceptível na captura (o serf muda
    de tom de um quadro para o outro, com o chão em volta contínuo). O número vai junto: a
    diferença de fator na troca contra a maior diferença entre quadros dentro do mesmo tile.
  - **Se saltar**, o tint passa a ser **interpolado pela posição**:
    - `tingirSeMudouDeTile` vira `tingirPelaPosicao`, que retinge quando o fator arredondado
      para o tint (`tintDoFator`) muda, e não quando o tile muda;
    - o custo continua sendo uma conta por unidade por quadro, e um `setTint` só quando o cinza
      muda de degrau (256 degraus);
    - o teste puro da Tarefa 2 ganha o caso: andar meio tile muda o tint sem trocar de tile;
    - a decisão e as duas capturas vão para as "Notas da implementação". O "a cada mudança de
      tile" do pedido original fica registrado como substituído por decisão do operador
      (mudança 6).
  - Se não saltar, fica por tile, com a medida registrada.
- [ ] **Passo 4:** `npm run verify` (só depois de liberado, mudança 3), e depois o commit.

  ```
  feat(D-TELA-xx): roteiro do relevo ligado (grama, areia, rocha; serf, arvore e predio na encosta)
  ```

## Tarefa 5: regressão completa, fila e registro

- [ ] **Passo 1: todos os roteiros com a flag desligada**, no mesmo procedimento da Tarefa 0.
  - Comparar com a linha de base: **código de saída igual em todos**, e sha256 por PNG.
  - PNG divergente: rodar de novo na linha de base (worktree temporária na `main`) e classificar
    como ruído (a `main` diverge dela mesma) ou mudança real.
  - Mudança real é **defeito desta branch**: conserto antes de seguir.
  - A tabela de resultado vai para `test-output/relevo-a-regressao.json`.
- [ ] **Passo 2: `BUILD_PLAN.md`**, na Fase D, com as siglas e o nome ao lado:
  - **D-TERRENO-01 (altura só de render no gerador de mapa)**, com o aceite da Tarefa 1;
  - **D-TELA-xx (luz do relevo: camada MULTIPLY e tint)**, com o aceite das Tarefas 2 a 4;
  - na nota da D-TELA-xx:
    - ligar a flag por padrão espera a arte de terreno da F-TR;
    - calibrar `k` na folha de contato;
    - o `transladar-mundo.js` não translada a altura;
    - a troca para `Phaser.WEBGL` é item próprio da `main`.
- [ ] **Passo 3: `test-results.json`.** As duas chaves com `passes: true`, só depois do `npm run
  verify` (o hook exige o selo de 15 minutos).
- [ ] **Passo 4: sem `PROGRESS.md` (mudança 4).** As "Notas da implementação", no fim deste
  arquivo, ficam completas. Elas separam o que foi verificado do que é hipótese:
  - `k = 0,85` é hipótese;
  - os números de geração são de partida;
  - o WebGL do runner foi medido pela sonda da Tarefa 0;
  - o resultado da conferência do salto do tint.

  Delas sai, **no merge**, o bloco do PROGRESS: já vai escrito lá, pronto para colar.
- [ ] **Passo 5: commit.**

  ```
  docs(D-TELA-xx): fila, test-results e notas do relevo A
  ```

- [ ] **Passo 6: relatório ao operador.**
  - O resumo e a tabela de estado.
  - O `git diff --stat main...dellanio/relevo-a`.
  - **Sem merge.**

---

## Autoconferência contra o pedido

| Pedido | Onde |
|---|---|
| Branch `dellanio/relevo-a` da `main`, em worktree própria | feito (`76dbcc8`, worktree `implementacao-relevo`) |
| Só a opção A | Restrições globais; nada de B, C, splatting, vento ou matas em nenhuma tarefa |
| Flag desligada por padrão, nada muda com ela desligada | `data/relevo.json` `ligado: false`; `debug.relevo` só com a flag pedida; Tarefa 3 passo 5; Tarefa 5 passo 1 |
| Sem WebGL, camada e tint desligados | `decidirRelevo` (Tarefa 2) e `criarCamadaDeRelevo` devolvendo `null` (Tarefa 3) |
| Não trocar para `Phaser.WEBGL` | `game.ts` fora da lista de arquivos; a sonda da Tarefa 0 decide se dá para seguir |
| Módulo isolado e o mínimo de ganchos no `WorldScene.ts` | 2 módulos novos; 4 ganchos de uma linha |
| Altura só de render, do gerador, lida só pelo render | Tarefa 1; guarda estrutural na Tarefa 2 |
| Relevo suave com teste do declive máximo | `forcarDecliveMaximo` e `declivesForaDoLimite`, com o teste que acusa |
| Luz de cima, inclinada para o sul, sem leste–oeste | `L = (0, sen θ, cos θ)`; o teste de igualdade leste = oeste |
| `k < 1` em `data/`, marcado como hipótese (0,85) | `data/relevo.json` `_hipotese_fatorDoPlano`; teste |
| Tint em árvore, prédio, recurso e unidade; fixo uma vez, unidade por tile | Tarefa 3; Foco de revisão 2 e 3 |
| `verify` e roteiros iguais com a flag desligada | Tarefas 0, 3 e 5 |
| Roteiro com a flag ligada (grama, areia, rocha; serf, árvore e prédio na encosta) | Tarefa 4 |
| Teste do gerador: determinístico pela semente e dentro do declive | Tarefa 1 |
| Notas neste arquivo (PROGRESS no merge), verify antes de cada commit, commits pequenos | Tarefas 1 a 5; mudanças 3 e 4 |
| Resumo e `diff --stat`, sem merge | Tarefa 5 passo 6 |
| Sigla livre conferida na `main` depois do commit dela | mudança 1; Tarefa 0 passo 0 |
| Porta 5177, verify só liberado, nunca matar processo | mudança 3; Restrições globais |
| Nota de `k` para o contrato de arte | "Texto proposto para o contrato de arte" |
| Conferir o salto do tint da unidade, interpolar se saltar | Tarefa 4 passos 1 e 3a |

---

## Notas da implementação

Preenchidas durante a execução. Separam o **verificado** (com o comando ou o arquivo aberto) da
**hipótese**. O bloco do `PROGRESS.md` sai daqui no merge.

- **Hipótese:** `k = 0,85`, até a arte de terreno da F-TR (estudo, seção 7, item 14).
- (vazio até a Tarefa 0)
