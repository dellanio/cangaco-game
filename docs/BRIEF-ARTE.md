# BRIEF-ARTE: como produzir a arte do jogo

> Documento único para quem vai gerar e derivar a arte sem conhecer o projeto.
> Escrito em 2026-09-26, com o repositório em `4a1b65d`. O que está marcado
> **[testado]** foi executado nessa versão. O que está marcado **[lido]** foi tirado
> do código ou do dado, sem execução. Se o repositório andou, confira antes de confiar.
>
> O `CLAUDE.md` e o `AGENTS.md` continuam valendo inteiros. Este documento não
> revoga nenhuma regra deles. Ele reúne o que importa para a arte.

---

## 1. O que é o jogo

Um RTS de vila ambientado no sertão nordestino, que roda no browser. O jogador planta
prédios, estradas e roçados, e os habitantes trabalham sozinhos.
O mundo é um grid **ortogonal** de tiles de **64 px**, e a câmera é **top-down 3/4**,
fixa, sem rotação.
Existem dois registros de arte. No mundo, arte **pintada à mão**, com cor e volume. Na
interface, **xilogravura de cordel**: preto sobre papel, traço grosso (GDD §9.7).
Mecânica inspirada em *Knights and Merchants* (1998). **Nenhum asset desse jogo entra
aqui**, nem como referência de estilo.

---

## 2. A projeção

**A regra.** A base do prédio é um **retângulo com arestas horizontais**, alinhado ao
grid quadrado. A câmera fica alta e à frente, olhando para baixo, e enxerga a fachada
da frente **e para dentro do telhado**. As linhas do chão correm na horizontal e na
vertical da imagem, nunca em diagonal.

**O que ela não é.**

- **Não é isométrica.** Isométrico põe o chão em losango de proporção 2:1. Losango não
  cabe num footprint quadrado com nenhum fator de escala.
- **Não é elevação frontal.** Fachada chapada, sem ver o telhado por cima, também
  está errada.

**O caso medido.** O armazém atual (`assets/base/storehouse/`) veio isométrico. Depois
de derivado, o prédio completo cobre só cerca de 39 % do quadrado de chão de 3×3 tiles
que ele ocupa, e o resto fica vazio. A medida está na nota do `assets/manifest.json`.
Esse defeito é o **BUG-H** no `BUGS.md`, com severidade `feio`. A correção é arte,
não código: refazer os seis estágios do armazém. Em conversa antiga ele aparece como
"BUG-F", mas esse id é de outro bug, já corrigido. Use BUG-H.

**A referência aprovada** é `assets/base/woodcutters/` (Casa do Lenhador), em especial
`casa_lenhador_03_completo.png`. O prompt que a gerou está em
`docs/arte-prompt-higgsfield.md`. A frase-chave da câmera é
"tabletop model photographed from a step ladder".

---

## 3. A convenção de arquivo

### Tamanho e âncora

- **A largura manda.** A largura do sprite derivado é `footprint[0] × 64` px. Um prédio
  de 3 tiles de largura tem 192 px. Um de 4 tem 256 px.
- **A altura é livre.** Ela é o que a arte der, na mesma escala. Não estique para
  quadrado.
- **Âncora na borda inferior, no centro:** `anchor [0.5, 1]`. A borda de baixo do PNG
  encosta na borda de baixo do footprint.
- **Fundo transparente.** Nada de chão no sprite (seção 5).

### Onde fica cada arquivo

| O quê | Pasta | Entra no jogo? |
|---|---|---|
| Base, a imagem grande que a ferramenta gerou | `assets/base/<id>/` | Não. É registro de geração. |
| Derivado, o sprite que o jogo carrega | `assets/sprites/<id>/` | Sim. |
| Índice de tudo | `assets/manifest.json` | Sim. |

`<id>` é o **id neutro em inglês** do `data/buildings.json` (`storehouse`, `quarry`,
`woodcutters`), nunca o nome do tema.

### Nomes

- **Base:** `assets/base/<id>/<id>_<n>_<estagio>.png`, com 1536 px de largura
  (`docs/spec-arte-predios.md`) **[lido]**. As duas bases existentes não seguem essa
  convenção: usam o nome em português (`armazem_03_completo.png`,
  `casa_lenhador_03_completo.png`). Arte nova segue a convenção.
- **Derivado:** `assets/sprites/<id>/<id>_<estagio>.png`, com o estágio da seção 4
  **[lido do manifest]**.
- **Ícone do menu:** `assets/sprites/<id>/icone.png`, 72×72.

### O comando que funciona

Não existe script `npm` para arte. Os derivadores rodam direto com `node`, à mão, e a
saída é commitada.

```bash
node tools/derivar-sprites.js     # base -> sprite do prédio
node tools/derivar-icones.js      # base -> ícone 72x72 do menu
```

**[testado]** `node tools/derivar-sprites.js` na `main` regrava os três PNG do armazém
**byte a byte iguais** aos commitados (`git status` limpo depois) e imprime o tamanho
para o manifest, 192×135.
**[lido]** `derivar-icones.js` não foi executado nesta verificação.

**O derivador não é genérico.** Três limitações, todas lidas no arquivo:

1. **A lista de alvos é escrita à mão.** A constante `ALVOS` no topo de
   `tools/derivar-sprites.js` só tem os três arquivos do armazém. Para um prédio novo,
   é preciso acrescentar um par `{ base, saida }` por estágio.
2. **A largura é fixa em 192 px** (`LARGURA_ALVO = 192`). Serve só para prédio de
   3 tiles de largura. Prédios de 2 ou 4 tiles exigem que a largura venha de
   `footprint[0] × 64`. Isso é mudança de ferramenta e precisa de plano.
3. **Um recorte só para todos os alvos.** Ele junta as bounding boxes de todos os
   `ALVOS` e recorta um retângulo comum. Com dois prédios na lista, o recorte de um
   contamina o outro. Rode um prédio de cada vez, ou torne o recorte por prédio.

Ele usa o Chromium do Playwright, que já vem instalado com o projeto.

### A entrada no manifest

Todo sprite precisa de uma entrada em `assets/manifest.json`, dentro de `assets`.
**[testado]** Esta entrada, com os PNG derivados, fez a casa do lenhador aparecer
desenhada na tela:

```json
{
  "id": "woodcutters",
  "tipo": "predio",
  "footprint": [3, 2],
  "tamanho": [192, 179],
  "anchor": [0.5, 1],
  "estados": {
    "estrutura": "sprites/woodcutters/woodcutters_estrutura.png",
    "completo": "sprites/woodcutters/woodcutters_completo.png"
  },
  "licenca": "arte propria do projeto, fornecida pelo operador em <data>",
  "origem": {
    "base": "base/woodcutters/casa_lenhador_03_completo.png",
    "semente": null,
    "nota": "como foi derivado, e o id ou a semente da ferramenta, se houver"
  }
}
```

Regras que o teste `tests/F17f-manifesto.test.ts` confere **[lido]**:

- `anchor` é `[0.5, 1]`.
- O arquivo de cada estado existe e tem exatamente o `tamanho` declarado.
- `tamanho[0]` é igual a `footprint[0] × 64`.
- `footprint` é igual ao do `data/buildings.json`.

`footprint` é `[largura, profundidade]` em tiles. `estados` pode ter só parte dos seis
estágios. O estágio que falta vira retângulo placeholder na tela.

### Arte nova não reprova teste nenhum

Desde 2026-09-26 o `tests/F17f-manifesto.test.ts` não fixa quem tem arte. A lista vem
do manifesto, e as regras do resolvedor são provadas com um manifesto escrito no
próprio teste (`docs/planos/F17f-lista-derivada.md`).

**[testado] O teste de fumaça.** A partir da `main` em `828a3d4`, num worktree limpo:

1. o armazém trocado por seis estágios com nomes novos
   (`storehouse_<estagio>.png`), e os três sprites antigos apagados;
2. depois disso, a pedreira com seis estágios e a casa do lenhador com dois,
   acrescentadas.

Nos dois passos, `npm run verify` terminou com código 0: 103 arquivos e 1434 testes
verdes. Os PNG da medida eram imagens vazias com a dimensão certa, porque o teste só
lê o cabeçalho. **Não há parada por arte nova.** Se um teste reprovar ao entrar arte,
é um defeito de verdade no manifest ou nos arquivos, e a mensagem diz qual.

A única regra que sobra sobre nomes de estado: toda chave de `estados` tem de ser um
dos seis estágios da seção 4. Chave com outro nome reprova, porque nunca apareceria na
tela.

---

## 4. Os seis estágios

Um prédio passa por seis imagens enquanto é construído. O render escolhe o estágio pelo
progresso da obra (`src/render/estagio-obra.ts`) **[lido]**.

**Mesmo canvas.** Os seis arquivos-base de um prédio têm o **mesmo tamanho de canvas**
e o prédio **na mesma posição** dentro dele. O derivador recorta todos pela **união das
bounding boxes**, de modo que o prédio não pula de um estágio para o outro. Se os
canvas forem diferentes, a união não significa nada e o prédio pula.

**O caso real.** As bases da casa do lenhador violam essa regra **[testado, cabeçalho
dos PNG]**:

| Arquivo | Canvas |
|---|---|
| `casa_lenhador_01_obra.png` | 1536 × 1024 |
| `casa_lenhador_02_estrutura.png` | 1223 × 1286 |
| `casa_lenhador_03_completo.png` | 1223 × 1286 |

Só os estágios 02 e 03 são coerentes entre si. **[testado]** Derivados juntos, deram
192×179. O 01 precisa ser refeito no canvas dos outros.

**O que cada estágio mostra** (`docs/spec-arte-predios.md`, `estagio-obra.ts` e os
rótulos em `data/theme-sertao.json`) **[lido]**:

| # | Estágio (chave no manifest) | O que aparece | Rótulo na tela |
|---|---|---|---|
| 1 | `marcacao` | Estacas e barbante no chão, marcando o contorno. | marcação no chão |
| 2 | `fundacao` | Alicerce de pedra baixo, no contorno do prédio. | alicerce pronto |
| 3 | `estrutura` | Armação de madeira em pé sobre o alicerce, sem parede. | armação de madeira |
| 4 | `paredes` | Taipa subindo entre os esteios, telhado ainda aberto. | paredes subindo |
| 5 | `cobertura` | Paredes prontas, telhado com parte das telhas. | telhado por fechar |
| 6 | `completo` | O prédio pronto. | — |

- **Prédio não tem animação.** Nenhum trabalhador, animal ou fumaça dentro do sprite.
- O GDD §9.6 ainda fala em três estágios. Está desatualizado: o código usa seis.
- O armazém usa hoje só `marcacao`, `estrutura` e `completo`. Os outros três caem no
  placeholder.

---

## 5. O que nunca entra no sprite

O sprite do prédio tem **só o prédio**. Fora dele:

- chão, terreno, grama, terra batida sob o prédio;
- pedra solta, lajedo, rocha;
- vegetação: cacto, árvore, mato, folhas;
- recurso natural: tora, pedra bruta, água, cardume, milho em pé.

**O porquê.** O terreno e os recursos são desenhados pelo jogo, tile a tile, a partir
do estado da simulação. Recurso acaba. Uma pedreira com pedra pintada no sprite parece
ter pedra para sempre, inclusive depois de o lajedo secar e o jogo parar de extrair.
O jogador passa a ver uma coisa e o jogo a fazer outra. Pelo mesmo motivo, a casa do
lenhador não tem mata em volta: a mata acaba.

**Pode entrar**, porque é parte do prédio e não muda com o jogo: a cerca de vara do
próprio prédio, a pilha de lenha cortada, uma ferramenta encostada, o varal. Na dúvida,
pergunte: "isso some quando o recurso acaba?". Se some, fica de fora.

O molde de prompt da spec já traz isso: `No raw, uncut rock`, e o prompt negativo com
mata e folhas (`docs/spec-arte-predios.md`, `docs/arte-prompt-higgsfield.md`).

---

## 6. A lista do que falta

Tudo abaixo foi tirado do dado (`data/*.json`) nesta data **[lido]**.

### Prédios (28)

Estado de hoje: só o armazém tem sprite, e errado (isométrico). A casa do lenhador tem
base aprovada e ícone, mas **não tem sprite de jogo** em `assets/sprites/woodcutters/`.

| id | Nome no jogo | Footprint | Largura do sprite |
|---|---|---|---|
| storehouse | Armazém | 3×3 | 192 |
| schoolhouse | Casa do Coronel | 3×3 | 192 |
| inn | Bodega | 4×3 | 256 |
| quarry | Pedreira | 3×2 | 192 |
| woodcutters | Casa do Lenhador | 3×2 | 192 |
| watchtower | Torre de Pedra | 2×2 | 128 |
| sawmill | Serraria | 4×2 | 256 |
| farm | Roçado de Milho | 4×3 | 256 |
| wineyard | Canavial | 3×2 | 192 |
| fishermans | Casa do Pescador | 3×2 | 192 |
| gold_mine | Garimpo | 2×1 | 128 |
| coal_mine | Jazida de Carvão | 3×2 | 192 |
| iron_mine | Mina de Ferro | 3×1 | 192 |
| weapons_workshop | Casa de Armas de Madeira | 4×2 | 256 |
| barracks | Quartel do Bando | 4×4 | 256 |
| marketplace | Feira | 4×3 | 256 |
| mill | Moinho | 3×3 | 192 |
| bakery | Padaria | 3×3 | 192 |
| swine_farm | Malhada | 4×3 | 256 |
| stables | Cocheira | 4×3 | 256 |
| butchers | Casa de Carne | 3×3 | 192 |
| tannery | Curtume | 3×2 | 192 |
| armory_workshop | Casa do Gibão | 3×3 | 192 |
| metallurgists | Fundição | 3×3 | 192 |
| town_hall | Mercenários | 4×3 | 256 |
| iron_smithy | Forja | 4×2 | 256 |
| weapon_smithy | Ferraria | 4×2 | 256 |
| armor_smithy | Casa do Ferro | 4×3 | 256 |

São seis estágios por prédio: 168 imagens no total. As duas facções usam **os mesmos
prédios**. Só a cor do lenço e da bandeira muda: vermelho `#D64B3F` e azul `#3F72D6`.

### Unidades (28)

Hoje **nenhuma** unidade tem sprite. O jogo desenha um quadrado de 32 px com o nome em
cima. Não existe ainda caminho de código para carregar sprite de unidade (seção 8).

**Regras do GDD §9.5:**

- Civil usa **chapéu de palha**. Militar usa **chapéu de couro de aba virada**. A
  silhueta do chapéu é o que distingue um do outro a 32 px.
- Os civis são **um corpo só com uma ferramenta diferente na mão**. Desenhe o corpo uma
  vez e troque a camada do item.
- Com espelho horizontal, 4 direções custam 3 desenhos (norte, leste, sul) e 8 direções
  custam 5 (norte, nordeste, leste, sudeste, sul). O lado oeste é o espelho.

**Civis: 4 direções** (`data/units.json`, `direcoesDeSprite: 4`)

| id | Nome no jogo | Item na mão |
|---|---|---|
| serf | Carregador | cesto ou saco nas costas |
| laborer | Obreiro | marreta de madeira |
| stonemason | Cabra da Pedreira | ponteiro e marreta |
| woodcutter | Lenhador | machado |
| carpenter | Carpina | serrote |
| farmer | Roceiro | enxada |
| baker | Forneiro | pá de forno |
| animal_breeder | Criador | cambito |
| butcher | Carneador | faca de ponta |
| fisherman | Pescador | tarrafa |
| miner | Mineiro | picareta e candeeiro |
| metallurgist | Fundidor | tenaz |
| blacksmith | Ferreiro | martelo de forja |
| recruit | Aprendiz | mãos vazias, chapéu de couro novo |

**Militares: 8 direções** (`direcoesDeSprite: 8`)

| id | Nome no jogo | Arma | Montado |
|---|---|---|---|
| militia | Cabra | facão | não |
| axe_fighter | Cabra de Gibão | facão | não |
| sword_fighter | Valente | peixeira longa | não |
| bowman | Bodoqueiro | bodoque | não |
| crossbowman | Cabra de Fogo | bacamarte | não |
| lance_carrier | Aguilhadeiro | aguilhada de vaqueiro | não |
| pikeman | Ferrão | ferrão comprido | não |
| scout | Vaqueiro | facão | sim |
| knight | Capitão do Bando | peixeira e cano de fogo | sim |

**Mercenários (5):** rebel Retirante, rogue Emboscador, vagabond Andarilho (montado),
barbarian Bruto do Mato, warrior Jagunço. **Fora de qualquer leva por enquanto**
(decisão do operador, 2026-09-26). O dado não declara o número de direções deles, o
tema não descreve a arma, e eles ainda não existem no jogo, porque a Fase C, a
militar, não começou. O operador decide quando o Quartel existir. A lacuna está
registrada como nota no item F25 do `BUILD_PLAN.md`. **Não gere mercenário.**

### Terrenos (6)

Hoje cada terreno é uma cor lisa, sem textura e sem transição. O item da fila que
cuida disso é o **F-TR** no `BUILD_PLAN.md`: textura por tipo, tile de transição,
árvore com silhueta.

| id | Hoje | Andável |
|---|---|---|
| grama | `#5E6B4F` | sim |
| campoArado | `#6B4A2E` | sim |
| areia | `#C9974B` | sim |
| agua | `#3C6E8F` | não |
| rocha | `#8A8175` | não |
| montanha | `#5C544B` | não |

A estrada não é terreno. Ela é desenhada por cima na cor `terra` `#B5763A`. O trecho
planejado e ainda não construído é terra translúcida com contorno `terraQueimada`
`#8C4A25`.

### Recursos (7)

Hoje cada recurso é um marcador colorido sobre o tile. O tile que esgotou vira um
marcador escuro (`#2A2622`).

| id | O que é | Hoje | Acaba? |
|---|---|---|---|
| rock | lajedo, pedra da pedreira | `#D8D2C4` | sim |
| tree | árvore, madeira do lenhador | `#3E5D34` | sim, por corte |
| fish | cardume | `#7FB8C9` | sim |
| corn | milho do roçado | `#C9A227` | sim, por colheita |
| coal | carvão | `#3B3A38` | sim |
| iron_ore | minério de ferro | `#A0603C` | sim |
| gold_ore | ouro | `#E8C25A` | sim |

Cada recurso precisa de um desenho **com** recurso e um **esgotado**. O lajedo
esgotado e o roçado em pousio hoje desenham o mesmo marcador; a nota do F-TR pede que
se separem.

### Vegetação e objetos (tema)

- **Vegetação:** mandacaru, xique-xique, juazeiro, umbuzeiro, facheiro, macambira.
- **Objetos:** cerca de vara, pilha de lenha, cacimba, carro de boi, jumento, varal de
  carne de sol.

Nenhum deles tem lugar no código hoje. São lista de desejo do tema.

---

## 7. A paleta e a luz

**Paleta** (`data/theme-sertao.json`, bloco `paleta`) **[lido]**:

| Nome | Hex | Uso |
|---|---|---|
| terra | `#B5763A` | chão batido, estrada |
| terraQueimada | `#8C4A25` | sombra da terra, contorno de estrada |
| ocre | `#C9974B` | areia, parede de taipa |
| telha | `#B4562F` | telha colonial |
| cal | `#EDE3D0` | reboco caiado |
| algodaoCru | `#D9C9A8` | tecido, roupa de civil |
| verdeSeco | `#7C8B6A` | vegetação seca |
| verdeCaatinga | `#5E6B4F` | caatinga, grama |
| madeira | `#5A3F2B` | esteio, porta, cerca |
| couro | `#8A5A32` | chapéu e gibão |
| ceu | `#4E86A8` | céu, só em interface |

**A luz não está no tema.** Ela está no GDD §9.4 e no molde de prompt da spec
**[lido]**:

- a luz vem **de cima e da esquerda**;
- a sombra cai **para baixo e para a direita**;
- é luz de sol forte, sem neblina, com cor quente e nada saturado;
- o contorno é **escuro e sutil**, nem preto puro, nem ausente;
- **escala:** a altura de um civil é mais ou menos a altura de uma porta.

**Arquitetura:** taipa de mão com estrutura de madeira aparente, reboco caiado, telha
colonial, porta e janela em cor forte.

O molde de prompt completo (estilo, paleta, luz, fundo e negativas) está em
`docs/spec-arte-predios.md`. Use-o sem mudar a câmera, que é a parte que já deu errado
uma vez.

---

## 8. Como ver no jogo

Sequência **[testada]** em 2026-09-26, num worktree descartável, com a casa do lenhador:

1. Ponha as bases em `assets/base/woodcutters/`, todas no mesmo canvas.
2. Em `tools/derivar-sprites.js`, troque a constante `ALVOS` pelos pares do prédio:
   ```js
   { base: 'base/woodcutters/casa_lenhador_02_estrutura.png', saida: 'sprites/woodcutters/woodcutters_estrutura.png' },
   { base: 'base/woodcutters/casa_lenhador_03_completo.png',  saida: 'sprites/woodcutters/woodcutters_completo.png' },
   ```
3. Rode o derivador. Ele imprime o tamanho que vai para o manifest:
   ```bash
   node tools/derivar-sprites.js
   ```
   Saída testada: 192×179.
4. Acrescente a entrada em `assets/manifest.json` (modelo na seção 3).
5. Rode a verificação:
   ```bash
   npm run verify
   ```
   Resultado testado: verde, com código 0 (o teste de fumaça da seção 3).
6. Tire o screenshot do cenário de abertura, que planta armazém, casa do lenhador,
   pedreira, escola e estrada:
   ```bash
   npm run shot -- F17
   ```
   Resultado testado: `OK. 6 captura(s)`. O arquivo `screenshots/F17-5-final.png`
   mostrou a casa do lenhador desenhada com o sprite novo, pintada, de telha
   terracota e com pilha de lenha. O armazém continuou isométrico. A Casa do Coronel
   apareceu como retângulo marrom placeholder. Os carregadores apareceram como
   quadrados com o rótulo "Carregador".

Para ver à mão, `npm run dev` sobe o jogo em `http://localhost:5173` **[lido, não
testado nesta verificação]**.

**Cuidados:**

- Os roteiros de screenshot usam a porta fixa 5175. Rode **um de cada vez**, nunca em
  paralelo.
- O passo 2 é edição de ferramenta. Faça-o só se o plano da tarefa mandar.
- **Só prédio aparece hoje.** O manifest aceita só `tipo: "predio"`
  (`src/render/manifesto.ts`). Unidade, terreno e recurso não têm código que carregue
  sprite: pôr um PNG deles em `assets/sprites/` não muda nada na tela. Fazer isso
  aparecer é trabalho de `src/render/`, com item próprio no `BUILD_PLAN.md`.
- Um PNG em `assets/sprites/` que não está no manifest não é carregado. Um estado do
  manifest cujo arquivo falta vira retângulo placeholder. Nada disso quebra o jogo.

---

## 9. O alvo da primeira leva

A primeira leva é o que aparece nos primeiros minutos de toda partida.

### Terreno e vegetação

| Peça | Formato | Observação |
|---|---|---|
| grama, campoArado, areia, agua, rocha, montanha | tile 64×64, repetível | uma textura por tipo |
| transições | tile 64×64 | pelo menos grama com areia e grama com água |
| árvore (`tree`) com madeira e cortada | um sprite por estado | a árvore é mais alta que o tile, com âncora no pé |
| lajedo (`rock`) com pedra e esgotado | tile 64×64 | o esgotado tem de ser distinto do roçado em pousio |
| vegetação decorativa | um sprite por espécie | mandacaru e xique-xique primeiro |

Nada disso aparece na tela até a feature F-TR ser implementada no render.

### Três prédios

Os três são os que a abertura planta primeiro e os que o roteiro F17 mostra.

| id | Nome | Footprint | Sprite | Estado de hoje |
|---|---|---|---|---|
| storehouse | Armazém | 3×3 | 192 px de largura | isométrico, BUG-H: refazer os seis estágios |
| woodcutters | Casa do Lenhador | 3×2 | 192 px de largura | base aprovada para estrutura e completo: refazer a marcação no canvas deles e gerar fundação, paredes e cobertura |
| quarry | Pedreira | 3×2 | 192 px de largura | nada: seis estágios novos, **sem pedra desenhada** |

### Duas unidades

| id | Nome | Direções | Desenhos com espelho | Item |
|---|---|---|---|---|
| serf | Carregador | 4 | 3 (norte, leste, sul) | cesto ou saco nas costas |
| laborer | Obreiro | 4 | 3 (norte, leste, sul) | marreta de madeira |

**Tamanho na tela hoje** **[lido em `src/render/grid.ts`]**. A unidade ocupa meio tile,
32×32 px no zoom 1. O zoom vai de 0,5 a 2, então ela aparece entre 16 e 64 px. O
chapéu precisa ser legível a 32 px. Duas unidades no mesmo tile são deslocadas até
16 px uma da outra (`deslocamentoDaUnidade`), então o sprite tem âncora no pé.

**Marcador de carga.** Hoje o nome da mercadoria aparece em texto acima do carregador
(`fsmData.carga`). O tema tem 31 entradas de mercadoria. Proposta, **ainda não decidida**:

- um desenho do carregador **vazio** e um **carregado**, com o cesto cheio;
- um ícone pequeno da mercadoria por cima, como camada separada, em vez de um
  carregador por mercadoria.

O obreiro não carrega mercadoria. Ele espera o material no canteiro. O desenho dele em
repouso e batendo a marreta basta.

---

## Não mexa

- **`src/sim/`.** Sessão de arte é `assets/`, `tools/` e, com plano, `src/render/`.
- **`test-results.json`.** Quem marca feature como pronta é o operador.
- **`.claude/` e `AGENTS.md`.**
- **Os testes**, em geral. Arte nova não precisa de mudança em teste nenhum (seção 3).

**Uma unidade parada dentro de um prédio** na tela é o **BUG-G**, aberto no `BUGS.md`.
É defeito da simulação, não de sprite nem de profundidade de desenho.

**Dívida de tela que a simulação já tem e a tela ainda não mostra.** Cada item precisa
de item próprio no `BUILD_PLAN.md` antes de código:

- a pedra parada no canteiro da estrada, esperando o obreiro, candidata a um sprite
  pequeno de monte de pedra;
- o carregador levando pedra até um tile de estrada, e não até uma porta;
- o obreiro esperando material no tile;
- o pescador na margem, a um tile da água.
