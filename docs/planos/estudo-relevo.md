# Estudo: relevo pseudo-3D, chão e vegetação

**Estado: aprovado pelo operador com ajustes (2026-09-30), seção 7. Sem implementação:** nenhum código, dado ou sim foi alterado.

**Fontes:**
- `kam_remake`, commit `731a8a4` (2026-09-25), clone fora do repositório. Foi lido como
  referência de **comportamento**, conforme `tools/kam-medir.md`. Nenhum sprite, tabela ou valor
  numérico do KaM foi copiado para cá: os limiares e as constantes aparecem só por nome, com
  arquivo e linha.
- O código desta branch (`dellanio/avaliacao-animacao`).
- O contrato da branch de arte (`git show noru-novos-sprites:skills/pianco-render-contract/SKILL.md`).
- A pesquisa web das técnicas de chão e vegetação (seção 6, fontes no fim).

---

## 1. Como o KaM faz

### 1.1 Onde a altura mora

- **Um byte por tile**, no registro do terreno: `Height` em `TKMTerrainTileBasic` e `fHeight` em
  `TKMTerrainTile` (`src/terrain/KM_TerrainTypes.pas:81`, `:91`, `:123`).
- **Na prática, é altura de vértice.** O quad do tile (X, Y) é desenhado com as alturas de quatro
  registros: (X, Y), (X+1, Y), (X, Y+1) e (X+1, Y+1) (`src/render/KM_RenderTerrain.pas:527-536`).
  O valor do tile é o canto de cima e da esquerda do quadrado. O mapa tem uma linha e uma coluna a
  mais de vértices que o necessário, e a última fileira não aparece (o comentário em
  `KM_Terrain.pas:5126-5128`).
- **A faixa:**
  - é um byte;
  - o jogo tem um valor padrão e uma variação aleatória pequena num mapa novo
    (`HEIGHT_DEFAULT` e `HEIGHT_RAND_VALUE`, `KM_TerrainTypes.pas:173`, `:181`; o uso está em
    `KM_Terrain.pas:407`);
  - só o editor limita o teto (`SetHeight`, `KM_TerrainTypes.pas:320-327`, por uma opção do
    editor).
- **Há duas alturas por vértice.**
  - `Height` é a da regra.
  - `RenderHeight` é a do desenho (`TKMTerrainTileExt`, `KM_TerrainTypes.pas:147-151`). A
    diferença é que a de desenho pode ser **forçada a plana** por uma camada de depuração
    (`mlFlatTerrain`, `GetRenderHeight`, `KM_TerrainTypes.pas:311-317`).

  O desenho e a regra já são separados no próprio KaM.

### 1.2 Como o terreno é desenhado com altura

- **O vértice sobe na tela.** O y de tela do vértice é o y do grid **menos** a altura dividida por
  uma constante fixa (`CELL_HEIGHT_DIV`, `KM_Defaults.pas:14`, "controlls terrains pseudo-3d
  look"). O quad vira um trapézio. É uma projeção só em y: o x não muda, e a câmera continua
  top-down fixa (`KM_RenderTerrain.pas:533-536`). A altura máxima equivale a poucos tiles de
  deslocamento.
- **A sombra vem da inclinação e é pré-calculada** (`UpdateLighting`, `KM_Terrain.pas:4551-4576`):
  - a luz do vértice é a altura dele **menos a média de dois vizinhos de um lado** (o de baixo e o
    da esquerda), presa entre −1 e 1;
  - por isso a luz é **direcional e fixa no mundo**: um lado do morro clareia e o outro escurece;
  - a água tem mais contraste (`:4566-4570`);
  - a borda do mapa vai para o preto (`:4557-4558`);
  - o valor fica guardado por vértice (`Light`, `RenderLight`) e só é recalculado quando a altura
    muda: ao aplainar, `KM_Terrain.pas:4459`.
- **O clique inverte a altura.** O cursor na tela é convertido de volta ao grid procurando em qual
  faixa de y deslocado ele cai (`ConvertCursorToMapCoord`, `KM_Terrain.pas:5061-5097`). Sem isso,
  clicar num morro acertaria o tile de trás.

### 1.3 Como sprites acompanham a altura

- **Unidade:** o y de tela sai da altura **interpolada** no ponto em que ela está
  (`RenderFlatToHeight`, `KM_Terrain.pas:5118-5135`, uma interpolação bilinear dos 4 vértices). O
  sprite sobe junto com o chão (`KM_RenderPool.pas:1053`). A carga do serf também sobe
  (`:1106`), e o mesmo vale para a bandeira da tropa (`:1175`).
- **Árvores e objetos do mapa:** `RenderHeightAt` no tile (`KM_RenderPool.pas:621`, `:647`,
  `:710`).
- **Casa e pilhas:** **uma altura só para a casa inteira**, a do vértice da entrada. O sprite da
  casa, as pilhas e a animação de trabalho usam o mesmo `LandExt[aLoc.Y+1, aLoc.X].RenderHeight`
  (`KM_RenderPool.pas:731`, `:740`, `:775`, `:867`, `:889-890`). Funciona porque o lote foi **aplainado** antes de
  construir (1.4).
- **Ordem de desenho:**
  - a lista de sprites é ordenada pelo **y do pé no chão plano** (`Feet.Y`, `KM_RenderPool.pas:17`,
    "Z ordering (Y only)", e `SortRenderList` em `:1997-2051`), e não pelo y já deslocado;
  - o terreno inteiro é desenhado **antes** de todos os sprites (`RenderBase`,
    `KM_RenderPool.pas:314`).
- **Consequência:** **não há oclusão por morro.** Uma unidade atrás de um morro é desenhada por
  cima dele. O KaM aceita isso, porque o relevo é baixo.

### 1.4 O que a altura muda na SIMULAÇÃO

| Efeito | Visual ou regra | Onde |
|---|---|---|
| **Passável a pé** | regra: o tile com diferença grande entre seus 4 vértices não é andável | `CheckHeightPass(hpWalking)`, `KM_Terrain.pas:4870-4919`; usado na passabilidade, `:3769-3812` |
| **Construir** | regra: limiar de declive **mais estrito** que o de andar para casa comum; a mina usa um limiar próprio, igual ao de andar | `hpBuilding`, `hpBuildingMines`, `KM_Terrain.pas:4912-4917`; uso em `:1252`, `:3798` |
| **Aplainar a obra** | regra: o laborer **cava** o lote tile a tile, e cada passo puxa os 4 vértices para a média dos vizinhos. O último passo aplaina duas vezes, "to ensure it really is flat" | `KM_UnitTaskBuild.pas:729-741`; `DoFlattenTerrain`, `KM_Terrain.pas:4405-4466` |
| **Aplainar a estrada** | regra: quem constrói a estrada aplaina o tile "slightly on and around the road" | `KM_UnitTaskBuild.pas:276` |
| Aplainar sem prender ninguém | regra: depois de mexer, confere os 9 tiles em volta e desfaz se alguém ficaria preso (`EnsureWalkable`), com recursão limitada | `KM_Terrain.pas:4410-4413`, `:4453-4455`; `TrySetTileHeight`, `:715-755` |
| **Velocidade de caminhada** | **nenhum efeito.** A pasta `units/actions` não lê altura | `grep` sem resultado em `units/actions` |
| **Custo no pathfinding** | **nenhum**, além da passabilidade acima | `grep` sem resultado em `pathfinding` |
| **Alcance de tiro** | **só visual:** o projétil começa e termina na altura desenhada, e a torre soma um deslocamento de desenho. O alcance não muda | `KM_Projectiles.pas:232`, `:265-267` |
| **Visão (névoa)** | **nenhum efeito** achado | `grep` sem resultado em `hands` e `fog` |
| Árvore em declive | regra: a queda da árvore confere a inclinação em volta | `KM_Terrain.pas:2767` |

**Resumo.** No KaM, a altura é **visual** (relevo e luz) **mais três regras**:
1. o declive bloqueia o passo;
2. o declive bloqueia a construção;
3. obra e estrada aplainam o chão.

O próprio comentário do código diz que o bloqueio por declive "is really just a backup (it's more
important for building than walking)" (`KM_Terrain.pas:4893-4895`).

### 1.5 Editor e formato do mapa

- **O arquivo do mapa guarda a altura** com um byte por tile, junto com camada, objeto e rotação
  (`KM_TerrainUtils.pas:82`, gravação; `:144`, `:159`, leitura).
- **O editor** tem pincel de altura com forma, tamanho, declive e velocidade, subindo ou
  igualando; altura constante; e altura por tipo de terreno (`KM_TerrainPainter.pas:1435-1600`).
- O gerador aleatório também escreve altura (`KM_Terrain.pas:609-622`, no copiar e colar do
  editor).

---

## 2. O nosso jogo hoje

### Como o chão é desenhado

Tudo no plano: **Tilemaps ortogonais do Phaser, tile de 64×64** (`data/terrain.json`,
`tile_px: 64`), empilhados em várias camadas de `TilemapLayer`:

| Camada | Onde |
|---|---|
| chão (uma tira de terrenos; o índice do tile é o código) | `criarTilemap`, `WorldScene.ts:1293-1300`; a textura em `:703` |
| borda da água, com 16 máscaras cardinais | `WorldScene.ts:765-790` |
| areia–grama | `:811-830` |
| rocha–grama (lajedo) | `:851-870` |
| detalhes do terreno (decalques geométricos, 3 variantes, sem `Math.random`) | `:899-990` |
| recursos | `:1105` |

- A vegetação é **um `Image` por tile** com árvore (`vegetacaoDesenhada`, `WorldScene.ts:151-159`).
- **Nenhum shader ou pipeline customizado** no render: um `grep` por `pipeline`, `postFX`,
  `preFX`, `Mesh` e `add.shader` em `src/render` não achou nada.
- **O renderizador continua `Phaser.AUTO`** (`src/render/game.ts:48`). **Conferido em
  2026-09-30:** na `main` (`f67e994`) também é `type: Phaser.AUTO`, e um `git log --all -S
  "Phaser.WEBGL"` não acha a troca em nenhuma branch. WebGL não é garantido: `AUTO` pode cair no
  Canvas (contrato de arte, "Render conferido"). **Isso pesa na opção A:** no Phaser 3, o `tint`
  de sprite é recurso só do WebGL. No Canvas, o tint dos sprites pela luz (decisão 5) não
  aparece. Ver o risco em 3.A.
- **Nenhum `setTint` no render hoje:** um `grep` por `setTint`, `.tint` e `tintFill` em
  `src/render` e `src/ui` não achou nada. O tint da luz não disputa com outro uso.
- Phaser `3.90.0` (`package.json`).

### Ordem de desenho

- `depthDeY(worldY) = worldY`: quem está mais ao sul desenha por cima (`src/render/grid.ts:117-119`).
- A unidade usa o y do centro mais o desvio de desenho (`unidades.ts:273-274`).
- O pé é o y da tela. É o mesmo princípio do KaM (`Feet.Y`), só que sem altura.

### O clique

`screenToGrid` é `floor(x / lado), floor(y / lado)` (`grid.ts:111-114`). A cena chama esse
helper em quatro lugares (`WorldScene.ts:401`, `:451`, `:463`, `:484`).

### Na sim

- **Não há altura.** A única coisa parecida é o **nivelamento da obra** (F11c): um contador de
  ticks por obra (`Obra.nivelamento`, `sim/state.ts:699-705`). O alvo é **derivado da área do
  footprint** (`alvoDeNivelamento`, `sim/obra.ts:28`), e não de declive.
- É o "aplainar" do KaM **sem terreno para aplainar**: hoje custa o mesmo tempo em qualquer lugar.
- `montanha` e `rocha` são **tipos de terreno** (`data/terrain.json`), e não altura.

### O que teria de mudar, por opção

A seção 3 detalha. Em resumo:
- **A** acrescenta uma camada.
- **B** troca o `TilemapLayer` do chão por malha, e troca `screenToGrid` e o y de todo sprite.
- **C** põe altura no `GameState`.

---

## 3. As opções, da mais barata à mais cara

### Opção A: só sombreamento

**Aprovada pelo operador (2026-09-30)**, para depois da arte de terreno da F-TR, e **só com
relevo suave**. As decisões estão na seção 7.

- **O jogador vê** ondulações **pela luz**: encostas claras e escuras, fundos de vale mais
  escuros. Nada sai do lugar, e o clique acerta como hoje.
- **Restrição: só relevo suave.** A altura só de render nunca faz uma encosta **parecer
  intransitável**. O que tem de parecer obstáculo continua sendo **tile de montanha ou rocha**,
  como hoje, porque esses tipos a sim bloqueia de fato. Assim a sombra nunca sugere um obstáculo
  que a sim não tem. Na prática:
  - o gerador limita o declive máximo da altura só de render;
  - a altura "grande" só existe sob `montanha`, que já é intransponível;
  - um teste do gerador afirma o declive máximo fora de `montanha` e `rocha`.
- **No render:**
  - um **mapa de luz por vértice**, calculado uma vez no carregamento a partir da altura só de
    render. A luz vem da direção decidida: **de cima, inclinada levemente para o sul, sem
    componente leste–oeste** (seção 4);
  - desenhado como **uma imagem pequena** (um pixel por vértice, 129×129) esticada sobre o mundo
    com filtro linear e blend **MULTIPLY**, entre o chão e os sprites.

  É uma textura e uma chamada de desenho, sem shader e sem pipeline customizado: `Image` com
  `setBlendMode`, que existe no Phaser 3 e no 4. A altura vem do gerador de mapa
  (`tools/gerar-mapa.js`, com ruído semeado a partir dos tipos: `montanha` alta, `agua` baixa),
  num arquivo de dado lido **só pelo render**.
- **Como a encosta iluminada fica mais clara que o plano, se MULTIPLY só escurece:**
  - **(a) Fator base menor que 1 no plano.** O plano recebe `k`. **0,85 é hipótese** (o valor da captura) até a arte de terreno da F-TR
    existir: o valor final mora em `data/` e é calibrado pela arte (seção 7, item 14). A encosta
    virada para a luz sobe até 1,0, e a encosta de costas cai abaixo de `k`. Uma camada só. A
    arte é **calibrada** para ser vista a `k`: a folha de contato do pipeline de arte aplica `k`
    antes do portão visual, ou o artista pinta 1/`k` mais claro.
  - **(b) Duas camadas:** MULTIPLY para a sombra e SCREEN (ou ADD) para o realce. A arte fica
    como está.
  - **Captura comparativa** (2026-09-30, grama `grama*.png`, mandacaru, facheiro, umbuzeiro, o
    serf e a pedreira da arte atual, zoom 0,5, altura sintética suave): o arquivo é
    `screenshots/estudo-relevo-luz-1.png`, que **não entra no git** (`screenshots/` está no
    `.gitignore`). O gerador está no scratchpad desta sessão (`luz-relevo.cjs`) e se reproduz
    com a arte da branch. O que se viu:
    - em **(b)**, o SCREEN **lava a grama** na encosta iluminada, que fica leitosa e sem
      saturação;
    - também em (b), o sprite sobre a encosta clara fica **mais escuro que o chão**, porque o
      `setTint` só escurece e não acompanha o realce. O mandacaru no canto de cima, à esquerda,
      parece recortado;
    - em **(a)**, chão e sprites ficam **no mesmo tom** em toda encosta.
  - **Recomendação: (a)**, com `k` em `data/` como número de render e calibrado na folha de
    contato. Ela é a única em que o sprite acompanha o chão com um `setTint` simples. A (b)
    pediria um tint aditivo (Phaser 4, `TintModes`, a conferir) ou um segundo sprite em SCREEN
    por objeto.
- **A luz chega aos sprites (obrigatório, decisão do operador).** Árvore, prédio, recurso,
  pilha e unidade recebem `setTint` com o fator do vértice **sob o pé**. É o mesmo fator do chão
  naquele ponto, interpolado como no `RenderFlatToHeight` do KaM. Objeto fixo recebe o tint uma
  vez, ao nascer. Unidade recebe quando **muda de tile**. Sem isso, o que está na encosta escura
  parece recortado.
- **Na sim:** nada.
- **Desempenho:**
  - a camada: uma textura de ~65 KB e um quad;
  - o tint: uma conta por objeto fixo ao nascer, mais uma por unidade a cada troca de tile, com
    centenas de unidades trocando de tile poucas vezes por segundo.

  Desprezível.
- **Testes e roteiros.** Conferido em 2026-09-30:
  - **nenhum roteiro afirma cor de pixel do mundo.** O único que lê pixel é o D-TELA-02, e ele lê
    o canvas **do minimapa** (`#minimapa canvas.mapa`, `tools/shots/D-TELA-02.js:50-54`), que a
    camada não toca;
  - o F18i declara "Afirma ESTADO e MEDICAO, nao pixel" (`tools/shots/F18i.js:3`). Os
    `reamostrar` do F-T1, F-T2a, F-TP, F18a, F18b e F21b reamostram **estado** do `debug`, e não
    pixel;
  - nenhum teste compara screenshot com referência (`grep` por `toHaveScreenshot`, `pixelmatch`
    e `toMatchImageSnapshot` sem resultado).

  **O risco que sobra é de revisão, não de teste.** As capturas mudam de tom, então quem abrir a
  evidência de uma feature antiga depois da camada vê outro tom. Mitigação: a camada **desligada
  por flag** (seção 7), com um roteiro próprio que a liga. E todo roteiro novo que precisar
  afirmar cor de chão tem de ler com a flag desligada.
- **Riscos:**
  - **Canvas (resolvido por decisão do operador):** com `Phaser.AUTO` caindo no Canvas, o
    `setTint` não aparece e os sprites ficam sem luz sobre um chão com luz. **A opção A depende da
    troca para `Phaser.WEBGL` na `main`, feita antes da implementação do relevo** (seção 7,
    item 13);
  - o relevo pintado pode mentir. Mitigado pela restrição de relevo suave acima;
  - multiplicar a luz sobre um tile que **já tem luz pintada** dá sombra dupla. Mitigado pelo tile
    albedo (seção 4).

### Opção B: relevo visual

- **O jogador vê** o chão subir e descer de verdade. Unidades sobem o morro, prédios pousam numa
  altura, e o horizonte do morro tapa o chão de trás. **A sim continua plana.**
- **No render:**
  - **O chão sai do `TilemapLayer`**, que é plano por construção, e vira malha com vértices
    deslocados em y.
    - No Phaser 3 existe `Mesh`, mas cada camada de chão (chão, 3 transições, detalhes,
      recursos) precisaria da sua malha, com UV por quad: ~65 mil vértices por camada num mapa de
      128×128, para seis camadas.
    - A outra saída é um pipeline WebGL próprio.
    - **No Phaser 4, `Mesh` e `Plane` foram removidos sem substituto**, e pipelines viraram
      render nodes, que precisam ser reescritos (fontes 1, 2, 3). Ou seja, B em Phaser 3 é
      código que **morre na migração**.
  - **Todo sprite ganha `-altura(x, y)` no y de tela.** É aritmética, com a altura interpolada
    como no `RenderFlatToHeight`. A **ordem de desenho continua pelo pé plano**, como no KaM, e
    aceita a falta de oclusão por morro.
  - **`screenToGrid` tem de inverter a altura**, com uma busca por faixa como a do
    `ConvertCursorToMapCoord`. São os quatro pontos de clique da cena e todo roteiro que clica
    por coordenada.
  - O prédio precisa de **chão plano** sob o lote. Sem a regra de aplainar (C), o render teria de
    "achatar" a altura desenhada sob o footprint, uma mentira visual controlada, ou pousar o
    prédio numa altura e deixar o chão atravessá-lo.
- **Na sim:** nada.
- **Desempenho:**
  - o chão em malha sai de ~6 camadas de tilemap com culling para ~6 malhas **sem culling
    automático**. É preciso partir em blocos (chunks de 16×16) para não enviar o mapa inteiro a
    cada quadro;
  - somar altura a centenas de sprites é barato;
  - o gargalo é o chão, não as unidades.
- **Testes e roteiros:**
  - com a altura **zero em todo o mapa atual**, nada muda. É o caminho seguro de entrega;
  - quando a altura entrar, todo roteiro que clica por pixel precisa passar pelo helper novo;
  - os roteiros que afirmam y de tela de unidade ou prédio (a F-SPR, o anchor) mudam de número.
- **Riscos:**
  - a morte na migração para o Phaser 4 (acima);
  - o relevo **mente mais que em A**: parece morro alto, e a unidade sobe sem esforço e constrói
    em cima.

### Opção C: relevo com regra

- **O jogador vê** B, **e o relevo passa a importar**:
  - encosta íngreme não se anda e não se constrói;
  - a obra começa aplainando o lote, e o operário cava;
  - a estrada aplaina o que atravessa.

  É o KaM completo (1.4).
- **No render:** B.
- **Na sim:**
  - **A altura entra no `GameState`**, porque aplainar muda o mapa em partida. São 129×129
    inteiros, com o save versionado.
  - **Passabilidade** por declive, no mesmo lugar que hoje lê o tipo de terreno.
  - **`canPlace`** com o limiar de declive, que é dado em `data/terrain.json`.
  - **O `nivelamento` da obra (F11c) ganha sentido físico:** o alvo passa a vir do declive do
    lote, e não só da área, e cada passo mexe na altura com média **inteira** determinística.
  - **Estrada** aplainando.
  - O guarda "aplainar não prende ninguém", o `EnsureWalkable` do KaM, que é justamente a classe
    de bug de espera indefinida que este projeto já persegue.
- **Desempenho:** a sim ganha um array e uma conta por passo de obra. O render é o de B.
- **Testes e roteiros:**
  - com altura zero, **nenhum** teste muda de resultado;
  - com altura, o gerador de mapa passa a filtrar lote e estrada por declive (a lição de
    "orçamento pago à vista é restrição do gerador");
  - os cenários de calibração mudam de tempo de obra;
  - pede determinismo com save/load e com um mapa transladado.
- **Riscos:**
  - é **design novo, que o GDD não cobre**. Pelo `CLAUDE.md` §12, vai para `IDEIAS.md` e é
    decisão do operador;
  - muda o balanceamento de tempo de obra;
  - multiplica as regras de passabilidade.

### Comparação

| | A: sombra | B: relevo visual | C: relevo com regra |
|---|---|---|---|
| O jogador vê | morro pela luz | morro de verdade | morro de verdade que pesa |
| Render | +1 imagem com MULTIPLY (fator base) e `setTint` nos sprites | chão em malha, y de sprite, clique invertido | o de B |
| Sim | nada | nada | altura no estado, passabilidade, canPlace, aplainar |
| Shader ou pipeline próprio | **não** | sim (Mesh ou pipeline) | sim |
| Phaser 4 | passa igual | Mesh removido; reescrever | reescrever |
| Desempenho | ~zero | o chão pesa; precisa de chunks | o de B, mais pouco na sim |
| Testes existentes | nenhum afirma pixel do mundo; só o tom das capturas | nada com altura zero; cliques depois | nada com altura zero; cenários depois |
| Custo | ~1 sessão de TELA e 1 de gerador | várias sessões de TELA | B mais várias de sim e design |

---

## 4. A interação com a arte nova

O contrato está em `noru-novos-sprites:skills/pianco-render-contract/SKILL.md`.

| Ponto do contrato | A | B | C |
|---|---|---|---|
| **Âncora nos pés** (`anchor [0.5, 1]`) | nada muda | **é o que faz B funcionar**: o pé recebe a altura. Nada muda na arte | igual a B |
| **Luz fixa "do alto à esquerda"** | **muda** (decisão do operador, 2026-09-30): uma luz só no mundo, **de cima, inclinada levemente para o sul, sem leste–oeste**. O mapa de luz do relevo usa a mesma direção da luz pintada | idem | idem |
| **Sombra de contato** (até ~4 px) | nada muda | a sombra pintada vai junto com o sprite. A sombra "blob" do render teria de seguir a altura | idem |
| **Tiles de terreno e transições** (16 máscaras cardinais, `process-terrain-edges.mjs`) | **o tile não pode ter luz direcional pintada**: tem de ser albedo, só cor e material. A luz vem do mapa. Com isso, o tile também fica seguro para girar e espelhar (seção 6) | igual a A. Mais: a transição continua 2D sobre a malha, e o gerador não muda | igual a B |
| **Encostas** | nenhum tile novo | nenhum tile novo, se o declive for suave como no KaM. Barranco íngreme (penhasco) pediria tiles de face vertical, que o KaM não tem | idem, e o declive íngreme vira "não passa" |
| **Prédios** | nada | a base do prédio precisa de chão plano ou de um "pé" de terra pintado. Com C, o chão fica plano pela regra | chão plano pela regra, nada novo |

### O que o contrato precisa mudar

As duas mudanças estão aprovadas pelo operador (2026-09-30). Os textos abaixo são **propostas para
o contrato da branch de arte**; a branch não é editada daqui, e o operador leva ao Codex.

**Por que não do norte.** Com câmera top-down 3/4, o jogador vê as fachadas **sul**. Uma luz do
norte deixaria todas elas em contraluz. Por isso a luz vem de cima e se inclina levemente para o
**sul**, o lado da câmera. Sem componente leste–oeste, o espelho das unidades continua valendo, e
as encostas norte e sul ainda se distinguem pela luz.

**Texto proposto 1: substitui o parágrafo "Luz fixa no mundo, do alto à esquerda do mapa"
(`## Cor, valores e luz`).**

> **Uma luz só no mundo, para chão, prédio e unidade:** de cima, inclinada levemente para o sul
> (o lado da câmera), **sem componente leste–oeste**. A fachada sul, que é a que o jogador vê,
> recebe luz. As faces leste e oeste de um volume recebem a mesma luz, em espelho, e por isso as
> direções do oeste de uma unidade são o espelho (`flipX`) das do leste. Nas oito direções, os
> planos do corpo mudam com a orientação (o que olha para o sul clareia, o que olha para o norte
> escurece), mas nunca com o lado. Sombras internas projetadas continuam obrigatórias (beiral,
> aba do chapéu, braço e arma, telha, copa, bloco) e caem **para o norte e para baixo**. A sombra
> de contato na base continua curta, até ~4 px no derivado 1×. O relevo do chão é sombreado pelo
> render com esta mesma direção, e o render aplica ao sprite o fator de luz do chão sob o pé: não
> pinte variação de luz de encosta no sprite.

**Texto proposto 2: um parágrafo novo, "Tile de terreno", na mesma seção.**

> **Tile de terreno é albedo:** só cor e material, **sem luz direcional pintada**. Não há lado
> claro nem lado escuro no tile, nem sombra projetada de fora dele. Permitidos: a variação de
> material (grão, fibra, seixo) e a oclusão pequena de fresta **dentro** do material, simétrica.
> O tile tem de funcionar **girado de 90° e espelhado** sem denunciar a operação, porque o render
> gira, espelha e tonaliza por semente para quebrar a repetição. A luz do mundo e o relevo vêm do
> render. O tile é calibrado para ser visto sob o fator de luz do plano (`k`, em `data/`): a
> folha de contato aplica `k` antes do portão visual. As máscaras de transição seguem a mesma
> regra.

Nada muda na âncora, no tamanho nem nas máscaras de facção.

---

## 5. Recomendação sobre o relevo

Aprovada pelo operador, com os ajustes da seção 7.

1. **Agora (custo zero de código):** os dois textos da seção 4 vão para o contrato de arte (tile
   albedo e girável; uma luz de cima, inclinada para o sul, sem leste–oeste). É o que não se pode
   fazer depois sem redesenhar os tiles. O operador leva ao Codex.
2. **Opção A, depois da arte de terreno da F-TR (tratamento visual do terreno e dos recursos):**
   - **só relevo suave**;
   - **(a) fator base menor que 1**;
   - **tint obrigatório nos sprites**.

   Entra em **branch nova a partir da `main`**, com a camada **desligada por flag**, o código
   isolado num módulo próprio de render e merge rápido. Os itens:
   - de ferramenta: o gerador escreve a altura só de render, com o teste do declive máximo;
   - de TELA: a camada de luz e o tint.

   Passa intacta para o Phaser 4.
3. **B e C para o `IDEIAS.md`**, a reavaliar junto com a decisão de migrar para o Phaser 4:
   - B em Phaser 3 é código que morre na migração (Mesh removido);
   - C é design novo;
   - o nivelamento da F11c é o ponto da sim onde C se encaixaria;
   - o tilemap do Phaser 4 fica para o estudo de migração.

   O texto proposto para o `IDEIAS.md` está na seção 7. **Não foi escrito lá:** este commit leva
   só este arquivo.

---

## 6. Chão e vegetação: técnicas 2D modernas

O KaM entra aqui **só como comportamento**: tipos de terreno, onde nascem recursos e árvores,
onde se constrói. As técnicas abaixo vêm de outras fontes. Conta usada: mapa de 128×128 =
16 384 tiles; na tela, até ~875 tiles no zoom mínimo (`data/terrain.json`, `_docMapaPadrao`).

### 6.1 Transição entre terrenos

| Técnica | Exemplo real | Arte | Render | Shader próprio? | Phaser 4 | Pipeline de arte da `noru-novos-sprites` |
|---|---|---|---|---|---|---|
| **16 máscaras cardinais** (o que temos: F-TR, `process-terrain-edges.mjs`) | este jogo; Factorio usa transições pré-renderizadas entre dois terrenos (fonte 5) | 16 por par de terrenos. Hoje são 3 pares (água–areia, areia–grama, rocha–grama) = 48 | 1 `TilemapLayer` por par, com culling. Barato | não | `TilemapLayer` continua; pode ir a `TilemapGPULayer`, com custo fixo por pixel (fonte 1) | já existe. **Limite:** só olha os 4 vizinhos cardinais, e a quina diagonal sai quadrada |
| **Dual-grid** (Stålberg; jess::codes) | repositórios Unity e Godot de jess::codes; Excalibur.js (fontes 6, 7, 8) | **16 por par**, ou 5–6 se o desenho for simétrico e girável, com **quina redonda e diagonal certa** | 1 `TilemapLayer` **deslocado meio tile**: o mesmo custo de hoje | não | igual ao de hoje | **troca o gerador**: `process-terrain-edges.mjs` passa a gerar as 16 combinações de **quatro cantos** em vez de quatro lados. O número de arquivos é o mesmo. A regra de jogo continua no grid lógico |
| **Texture splatting** (mistura por shader com mapa de pesos) | Wikipedia; o artigo "Advanced Terrain Texture Splatting", com mistura por altura do material (fontes 9, 10) | **1 textura girável por terreno** (6), mais o mapa de pesos gerado. Nenhuma transição desenhada | um passo de shader sobre o chão, com custo por pixel. Barato em WebGL | **sim**: pipeline no Phaser 3, ou `Shader` com 4–6 texturas | pipeline vira render node (**reescrever**); o `Shader` muda de assinatura (fonte 3) | **aposenta** o gerador de transições. O pipeline de arte passa a entregar texturas contínuas |

### 6.2 Quebrar a repetição

| Técnica | Exemplo | Arte | Render | Shader? | Phaser 4 | Pipeline de arte |
|---|---|---|---|---|---|---|
| **Variação por tile com hash semeado** (espelho, rotação de 90°, leve tom por tile) | Inigo Quilez, "texture repetition": deslocamento e reorientação aleatórios por tile (fonte 11) | **0**. As 4 variantes de chão que já existem somam | propriedades do `Tile` do Phaser 3 (`flipX`, `rotation`, `tint`), sem custo por quadro | não | a conferir se o `TilemapGPULayer` aceita rotação e tom por tile (a fonte não diz); o `TilemapLayer` aceita | o tile tem de ser **girável**: albedo sem luz direcional (seção 4) |
| **IQ em shader** (mistura suave de padrões) | fonte 11 | 0 | por pixel | sim | reescrever | idem |

### 6.3 Decalques

| Técnica | Exemplo | Arte | Render | Shader? | Phaser 4 | Pipeline de arte |
|---|---|---|---|---|---|---|
| **Decalque como sprite** (tufo, pedra, rachadura, gravetos), com posição por **Poisson-disc** semeado | os "decoratives" do Factorio (fontes 4, 5) | ~10–20 sprites pequenos por tema (caatinga: tufo seco, seixo, rachadura, folha de mandacaru caída) | centenas a poucos milhares de `Image` fixas; no Phaser 3, `Blitter` para lotes; no 4, `SpriteGPULayer` numa chamada (fonte 1) | não | melhora | **já temos a camada**: `detalhes-terreno`, geométrica, 3 variantes, densidade em `theme-sertao.json`. Falta a arte de verdade e sair do grid (hoje, um por tile) |

### 6.4 Vegetação

| Técnica | Exemplo | Arte | Render | Shader? | Phaser 4 | Pipeline de arte |
|---|---|---|---|---|---|---|
| **Variação por instância** (escala ±10%, espelho, tom leve) com hash do tile | prática comum em RTS e colônia; no Phaser, é `setScale`, `setFlipX`, `setTint` por `Image` | 0 | zero por quadro | não | igual | a árvore precisa **aguentar o espelho** (luz sem componente leste–oeste, seção 4) |
| **Agrupar matas por ruído** (manchas densas e ralas no lugar de salpicado uniforme) | geração procedural clássica | 0 | 0 | não | igual | **item de gameplay, não ajuste visual** (decisão do operador): a árvore é recurso da sim, então agrupar muda a distribuição de madeira. Vive no **gerador** (`tools/gerar-mapa.js`), é **item separado com teste** (seção 7) e não faz parte da opção A |
| **Vento com shader** | shaders de "2D wind sway" do Godot: o vértice de cima desloca com o tempo, e a base fica presa (fonte 12) | 0, se a arte tiver a base no pé | por vértice, barato | **sim** | reescrever como render node ou filter | nenhum. **Só com o Phaser 4** (decisão do operador) |
| **Vento sem shader** | **um cálculo por quadro no `update`**: para cada árvore **visível**, uma rotação pequena em torno do pé igual a `A · sen(ω·t + fase)`, com a fase por semente do tile. **Não é um tween por árvore** (decisão do operador) | 0 | um laço sobre as árvores visíveis no quadro. A câmera já filtra quem está na vista, com centenas no máximo a zoom 0,5 | não | igual | nenhum. É render puro, no `update()` da cena, como a câmera da F-D2 (`WorldScene.ts`, comentário do `update`): não é lógica de jogo (§10) |

### 6.5 Como isso combina com o relevo

- **A (luz) combina com tudo.** É uma camada MULTIPLY por cima do chão, seja qual for a técnica
  de transição, e por baixo dos sprites. A única exigência é o **tile albedo**.
- **B (malha) empurra para o splatting.** Deslocar seis `TilemapLayer` é o caro de B. Uma malha
  única com shader de splatting desenha **todos** os terrenos numa passada. Se um dia houver B,
  o chão deveria virar malha com splatting, e é por isso que B e C pertencem à migração para o
  Phaser 4.
- **Decalques e vegetação** recebem a altura como qualquer sprite (em B). Em A, recebem a luz do
  vértice sob o pé como `setTint`, **obrigatório** (decisão do operador), e sem shader.
- **A variação por tile e a luz se multiplicam.** O tom por semente do tile (6.2) e o fator de
  luz (A) caem no mesmo pixel. O tom por tile tem de ser pequeno para não parecer relevo.
- **Risco da variação por tile, igual ao da opção A:** as capturas mudam, mas nenhum roteiro
  afirma cor de pixel do mundo (conferido, 3.A). O risco próprio da variação é outro: um roteiro
  que afirme **`flipX` ou `rotation`** de tile. Hoje nenhum afirma: um `grep` por `flipX` e `.rotation` em `tools/shots` e `tests` não
  achou nada, e a contagem de terreno visível da F-T1 é por tipo (`terrenoVisivel`), que a
  variação não muda. A variação também fica atrás de flag.

### 6.6 Recomendação para o chão e a vegetação

1. **Manter as 16 máscaras** (sem shader, sobrevive ao Phaser 4). Propor à branch de arte
   **avaliar o dual-grid** como a próxima versão do `process-terrain-edges.mjs`: o mesmo número
   de tiles, quina redonda, e muda só o gerador e o índice da camada.
2. **Tile albedo e girável** no contrato (seção 4). Destrava o relevo A e a quebra de repetição
   com arte zero.
3. **Variação por tile com hash**, no render. Barata e sem arte.
4. **Decalques com arte de verdade** na camada que já existe, saindo do grid por Poisson semeado.
5. **Vegetação:**
   - variação por instância no render;
   - agrupamento por ruído no gerador de mapa, como **item de gameplay separado, com teste**;
   - vento com shader **só com o Phaser 4**. Antes disso, se entrar, é a versão sem shader: um
     cálculo por quadro no `update`, e não tween.
6. **Splatting:** só com o Phaser 4, e só se B entrar.

**Combinação aprovada:**
> relevo **A** (suave, fator base, tint nos sprites), mais 16 máscaras (dual-grid proposto ao
> Codex), mais variação por tile, mais decalques espalhados fora do grid, mais variação por
> árvore.

O agrupamento de matas vem à parte, como gameplay.

Nenhum shader próprio, nada na sim, e tudo sobrevive à migração para o Phaser 4. O que precisa
acontecer **agora** é só o contrato de arte (seção 4).

---

## 7. Decisões do operador (2026-09-30)

Registradas como decisões, não como perguntas.

1. **Opção A aprovada**, para **depois da arte de terreno da F-TR** (tratamento visual do
   terreno e dos recursos). **Só relevo suave**, em ondulações. Encosta que pareça intransitável
   continua sendo **tile de montanha ou rocha**, como hoje, para a sombra nunca sugerir um
   obstáculo que a sim não tem (3.A, "Restrição").
2. **Luz do mundo: de cima, inclinada levemente para o sul (o lado da câmera), sem componente
   leste–oeste.** É a mesma luz para chão, prédio e unidade. **Não usar luz do norte**: com
   câmera top-down 3/4, ela deixaria em contraluz as fachadas sul, que são as que o jogador vê.
   A luz mantém o espelho das unidades e as sombras nas encostas norte e sul. O texto para o
   contrato está na seção 4.
3. **Tile de terreno albedo e girável:** só cor e material, sem luz direcional pintada. O texto
   para o contrato está na seção 4.
4. **MULTIPLY só escurece.** Foram comparados o fator base menor que 1 no plano (a) e o MULTIPLY
   mais SCREEN ou ADD (b), numa captura (3.A). **Recomendado: (a).**
5. **A luz chega aos sprites, obrigatoriamente:** `setTint` pela luz do vértice sob o pé, em
   árvore, prédio, recurso, pilha e unidade. Objeto fixo uma vez; unidade a cada mudança de tile.
6. **Vento sem shader: um cálculo por quadro no `update`**, com seno e fase por árvore, só nas
   visíveis. Não é um tween por árvore. **Vento com shader e splatting, só com o Phaser 4.**
7. **Chão e vegetação aprovados:**
   - dual-grid como proposta ao Codex para o `process-terrain-edges.mjs`;
   - variação por tile (espelho, rotação e tom por semente);
   - decalques espalhados fora do grid;
   - variação por árvore.
8. **O agrupamento de matas no gerador é item de gameplay**, porque muda a distribuição de
   recurso. É um **item separado, com teste**, e não ajuste visual. O aceite proposto:
   - o gerador agrupa as árvores por ruído semeado, com o mesmo mapa para a mesma semente;
   - o teste afirma a **mesma quantidade total de árvores** que o gerador de hoje (o
     balanceamento de madeira não muda por acidente) e um índice de agrupamento maior;
   - o teste também afirma que a vila inicial mantém a madeira ao alcance que os cenários de
     calibração pressupõem.

   Se a quantidade total mudar, é balanceamento, e vai para o `BALANCE_LOG.md`.
9. **Dados do KaM:** vale o `tools/kam-medir.md`. Número medido com fonte anotada é permitido. A
   regra mais estrita do pedido do estudo fica revogada. O `docs/kam-casas-animacao-e-pilhas.md`
   não muda.
10. **B e C para o `IDEIAS.md`**, a reavaliar junto com a decisão de migrar para o Phaser 4. O
    tilemap do Phaser 4 fica para o estudo de migração. **O texto proposto** para o
    `IDEIAS.md`, a entrar num commit próprio:
    > **Relevo com malha (B) e com regra (C)**: chão deslocado em y, unidade subindo o morro,
    > clique invertido pela altura (B); e altura no `GameState`, declive que bloqueia passo e
    > construção, obra e estrada aplainando, com o nivelamento da F11c como ponto de encaixe (C).
    > Referência de comportamento: `docs/planos/estudo-relevo.md` §1 e §3. Reavaliar com a
    > decisão de migrar para o Phaser 4: no 3, B depende de `Mesh`, removido no 4.
11. **Implementação:** **branch nova a partir da `main`**, com a camada **desligada por flag**, o
    código isolado num módulo próprio de render e **merge rápido**.
12. **WebGL:** conferido em 2026-09-30, a troca para `Phaser.WEBGL` **não estava na `main`** nem
    em outra branch (seção 2).
13. **A opção A depende da troca para `Phaser.WEBGL` na `main`**, que o operador já tinha decidido
    e que ainda não foi executada. Ela entra **antes** da implementação do relevo, como item
    próprio. O tint dos sprites (item 5) é só do WebGL no Phaser 3.
14. **O fator do plano `k` mora em `data/`**, como número de render, e é **calibrado pela arte**
    na folha de contato. **O 0,85 da captura é hipótese** até a arte de terreno da F-TR existir.
15. **A luz do item 2 está confirmada** como decisão do operador (2026-09-30).

Sem perguntas em aberto neste estudo.

## Fontes da pesquisa web

1. Phaser, "Phaser 3 vs Phaser 4: What Changed", https://phaser.io/news/2026/05/phaser-3-vs-phaser-4
2. Phaser, "Migrating from Phaser 3 to Phaser 4", https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know
3. Phaser, `MIGRATION-GUIDE.md` (v4.0), https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md
4. Factorio, Friday Facts #358, "Alien decoratives", https://factorio.com/blog/post/fff-358
5. Factorio, Friday Facts #199, "The story of tile transitions", https://factorio.com/blog/post/fff-199, e #214, "Concrete rendering", https://www.factorio.com/blog/post/fff-214
6. jess::codes, dual-grid (Unity), https://github.com/jess-hammer/dual-grid-tilemap-system-unity
7. jess::codes, dual-grid (Godot), https://github.com/jess-hammer/dual-grid-tilemap-system-godot
8. Excalibur.js, "Dual Tilemap Autotiling Technique", https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique/
9. Wikipedia, "Texture splatting", https://en.wikipedia.org/wiki/Texture_splatting
10. Game Developer, "Advanced Terrain Texture Splatting", https://www.gamedeveloper.com/programming/advanced-terrain-texture-splatting
11. Inigo Quilez, "Texture repetition", https://iquilezles.org/articles/texturerepetition/
12. Godot Shaders, "2D wind sway", https://godotshaders.com/shader/2d-wind-sway/

**Hipóteses não conferidas nesta sessão:**
- o `TilemapGPULayer` do Phaser 4 (rotação, tom e desempenho) fica para o estudo de migração;
- que o `tint` de sprite é só do WebGL no Phaser 3 vem da documentação do componente `Tint`, e não
  foi testado aqui no Canvas;
- se o Phaser 4 tem um modo de tint aditivo (`TintModes`) que tornaria a opção (b) viável nos
  sprites;
- a afirmação de Poisson-disc nos decoratives do Factorio, que veio do resumo da busca e não da
  leitura do post.
