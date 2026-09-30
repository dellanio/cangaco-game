# Plano: legibilidade da logística e animação direcional das unidades

**Estado: proposta, esperando aprovação do operador. Nada aqui foi implementado.**
Branch `dellanio/avaliacao-animacao`, worktree próprio. Não interrompe o D-TRANSPORTE-03
(classes de importância do KaM): o plano entra depois do T2 dele ou em sessão separada.

Módulos (`docs/siglas.md`): **TELA** para o que muda `src/render/`, **ARTE** para o que muda
`assets/`. Um item que mexe nos dois vira dois itens. As siglas abaixo são as próximas livres
(D-TELA-03 em diante, D-ARTE-01 em diante) e são **proposta**: ganham número definitivo quando
entrarem no `BUILD_PLAN.md`.

**Nada muda em `src/sim/`.** Todo item deste plano só lê o `GameState`.

---

## 0. Ordem pedida pelo operador

1. **Legibilidade da logística** (item 14): a carga sobre o serf e o estoque na casa, com os
   ícones que já existem.
2. **Piloto do serf, ponta a ponta** (item 12): sprite de depuração → manifesto → render →
   roteiro de tela.
3. **O resto**, e só depois do piloto aprovado: as outras 27 unidades, a virada, o olhar para o
   alvo, o atlas e o carregamento por presença.

A medida do KaM (item 15) já está feita e entra na seção 4, como tabela. A animação de trabalho
dentro do prédio **fica fora** da primeira leva: aqui só entra a medida.

---

## 1. Decisões do operador (2026-09-30)

Registradas como decisões, não como perguntas.

- **Luz × espelho.** A luz lateral fixa do contrato (`pianco-render-contract` `:38`, "do alto à
  esquerda") quebra o espelho da F-SPR (arte das unidades por direção): espelhado, o `l` vira `o`
  com a luz vindo da direita. **Decisão: luz de cima, sem componente lateral, para o espelho
  valer.** Isso vira divergência a propor ao contrato da branch de arte (seção 8). A branch não é
  editada daqui: o operador leva ao Codex.
- **Civis com 8 direções, como os militares.** O A* anda em diagonal, e com espelho 8 direções
  custam 5 desenhos. A F-SPR muda (seção 5.1).
- **Nome dos quadros.** O contrato ganha a convenção `{unidade}/{estado}/{direcao}/{nnnn}`, com
  as direções em português (`n ne l se s so o no`) e os quadros num atlas. O texto proposto está
  na seção 8; a branch não é editada.
- **A máscara de facção continua adiada**, como o contrato diz (`:42`, "Não implementar nesta
  etapa"). Este plano não a consome. A seção 5.8 só registra onde ela vai entrar.

---

## 2. O que existe hoje

Tudo nesta seção foi **verificado** abrindo o arquivo ou rodando o comando nesta sessão.

### Render

| O quê | Onde |
|---|---|
| As 8 direções, em sentido horário a partir do norte: `n ne l se s so o no` | `src/render/manifesto.ts:216` |
| O oeste é espelho: `o→l`, `no→ne`, `so→se` | `src/render/manifesto.ts:221` |
| A chave do estado é `"<pose>:<direcao>"`, um arquivo por chave | `src/render/manifesto.ts:226` |
| A direção sai do passo: com 4 manda o eixo dominante; com 8, o eixo menor que a metade do maior conta como zero | `src/render/manifesto.ts:235-249` |
| A direção declarada no arquivo vence; sem ela, o oeste cai no espelho; com 4 direções, uma diagonal devolve `null` | `src/render/manifesto.ts:259-279` |
| A direção vem do passo entre o tick anterior e o atual; parada, a unidade mantém a última | `src/render/unidades.ts:25-26`, `:138-139` |
| O `setFlipX` do espelho | `src/render/unidades.ts:196` |
| A pose única que o render pede hoje é `parado`, e o comentário diz que a animação acrescenta poses sem mudar a chave | `src/render/manifesto.ts:222` |
| A carga sobre a unidade é **texto** com o nome do tema (BUG-O) | `src/render/unidades.ts:275-278`, `src/render/rotulo-da-carga.ts` |
| O estoque na casa já existe: a pilha da F-VIVO-a, com até 5 unidades (3 embaixo, 2 em cima), entrada e saída, as 4 maiores do armazém, a Bodega e a obra | `src/render/pilhas.ts:1-27`, `src/render/scenes/WorldScene.ts:1431`, `:1789-1817` |
| Sem PNG `pilha` no manifesto, a pilha é um quadrado com a cor do tema | `WorldScene.ts:1799-1812` |
| A animação de trabalho do prédio já existe, com placeholder (F-VIVO-b) | `test-results.json`, `"F-VIVO-b-trabalho": passes true` |

### Dados e assets

- `data/units.json` tem **28 tipos**: 14 civis, 9 militares (scout e knight montados) e 5
  mercenários (vagabond montado). **Nenhum** declara `direcoesDeSprite` hoje. A nota da F-SPR
  (arte das unidades por direção) em `BUILD_PLAN.md:1874` diz "civis 4, militares 8", então a
  nota está desatualizada em relação ao dado. **A conferir no piloto:** qual caminho
  `src/render/direcoes-de-sprite.ts` segue quando o campo falta. O comentário do arquivo, na
  linha 6, diz "`null`: sem direcao, sem sprite, fica o placeholder".
- A entrada do serf no manifesto tem `tamanho [64, 96]`, `anchor [0.5, 1]` e `parado:n`,
  `parado:l` e `parado:s` apontando **para o mesmo PNG**.
- **Ícones de mercadoria que já existem.** São 8 de 28:

  | Mercadoria | Arquivo |
  |---|---|
  | `timber` | `sprites/ui/hud-timber.png` (e `resource-plank.png`) |
  | `stone` | `sprites/ui/hud-stone.png` |
  | `gold` | `sprites/ui/hud-gold.png` |
  | `corn`, `fish`, `coal`, `iron_ore`, `gold_ore` | `sprites/resources/*.png`, os recursos do mapa, 64×64 |

  O `comida` do HUD é genérico: não serve de ícone de uma mercadoria. `grapes` é recurso do mapa,
  não mercadoria (a mercadoria é `wine`). O manifesto não tem `icones.mercadorias` e nenhuma
  entrada `tipo: "pilha"`.

### Sim, só leitura

- O A* anda em 8 vizinhos, e a diagonal custa `ticksPorTileDiagonal`: `src/sim/pathfinding.ts:2-7`.
  **Com isso, 32 direções ficam descartadas**, porque o movimento só produz 8 vetores.
- O passo na estrada é mais rápido que na grama (`pathfinding.ts:271-279`). É o caso em que um
  walk preso ao relógio faria o pé deslizar.
- A sim já tem `Unidade.direcao?` (0..7):
  - no combate, ela vira para o alvo (`src/sim/systems/combate.ts:100`, `:145`);
  - na formação, ela vira para a direção final (`src/sim/systems/marcha.ts:193`);
  - na carga, ela segue a direção do líder (`src/sim/systems/carga.ts:92`).

  **O render ainda não lê esse campo.**

### Documento de fase que já existe

`docs/fase-animacao-vida-do-mundo.md` §14 "UNIDADES" (commit `c75e98e`, a pesquisa do operador)
já fala de animação de unidade:
- animações iniciais `idle`, `walk`, `work` e `carry`;
- camadas `body`, `head`, `hat`, `arm`, `tool`, `load` e `shadow`;
- **direções civis `north`, `east` e `south`, com `west = mirror(east)`**, ou seja, 4 direções.

As 4 direções **divergem da decisão de 2026-09-30** (civis com 8). O `carry` e a camada `load`
são o "no braço" do KaM (seção 3). Este plano não edita aquele documento. **Pergunta ao
operador:** o §14 dele passa a apontar para este plano, ou fica como pesquisa histórica?

### Contrato da branch de arte

Fonte: `git show noru-novos-sprites:skills/pianco-render-contract/SKILL.md`.

- `:14`: pés no centro inferior, `anchor [0.5, 1]` e a mesma linha de base em todos os quadros.
- `:38`: luz do alto à esquerda, com os planos ajustados em cada uma das 8 direções. É isso que
  quebra o espelho.
- `:42`: a máscara de facção em cinza, como segundo sprite com `setTint` no mesmo atlas. Pendente
  e adiada.
- **Não diz nada** sobre quadros, estados animados, fps, nome de quadro, atlas, espelho ou mão da
  arma.

---

## 3. Leva 1: legibilidade da logística (item 14)

O render lê o que a sim já tem (`fsmData.carga`, o estoque dos prédios). Não entra arte nova:
só os ícones listados na seção 2.

### D-ARTE-01: o manifesto aponta os ícones de mercadoria existentes

- **O que muda:** `assets/manifest.json` ganha `icones.mercadorias`, com as 8 mercadorias da
  tabela da seção 2, cada uma apontando para o arquivo que já existe. Nenhum PNG novo.
- **Aceite:** o `tests/F17f-manifesto.test.ts` valida que:
  - todo id é mercadoria de `economia.mercadorias`;
  - todo arquivo existe.

  Cada regra tem um caso que reprova, num manifesto escrito no teste.
- É ARTE porque muda `assets/`. Por isso vem antes das duas de TELA.

### D-TELA-03a: a carga sobre o serf com ícone

- **Regra:** a cadeia do que se desenha sobre a unidade é:
  1. o ícone da mercadoria, quando existe;
  2. o texto de hoje, sem ícone.

  Nenhuma carga some. A função pura `marcaDaCarga(mercadoria, manifesto)` devolve
  `{como: 'icone', chave}` ou `{como: 'texto', rotulo}`, no molde de `rotuloDaCarga`.
- **Não-regressão:** o teste do BUG-O (`tests/BUG-O-rotulo-da-carga.test.ts`) continua afirmando
  que toda mercadoria tem nome. A asserção nova é mais estrita: para as 8 com ícone, o
  `debug` da unidade reporta `ícone`, e não texto.
- **Roteiro:** um serf levando tábua (ícone) e um levando farinha (texto). Despausado pelo menos
  um passo (CLAUDE.md §8). A screenshot é aberta.
- **Referência do KaM** (medido, seção 4): o original não põe ícone acima do serf. Ele desenha a
  mercadoria **no braço**, como uma camada própria: `SerfCarry` tem 28 mercadorias × 8 direções
  × **8 quadros** (`unit.dat`), sincronizada com o passo (`AddUnitCarry`,
  `KM_RenderPool.pas:1092-1107`). **O ícone é o substituto barato, não a forma final.** O "no
  braço" custaria 28 × 5 × 8 = 1 120 quadros desenhados com espelho. Fica registrado, fora deste
  plano.

### D-TELA-03b: o estoque da casa com ícone

- **Regra:** a pilha da F-VIVO-a (estoque de entrada e saída) já desenha. Muda só a cadeia da
  textura: PNG `pilha` → ícone da mercadoria → quadrado com a cor do tema. Posição, teto 5 e
  3 + 2 não mudam.
- **Aceite:** um teste puro da cadeia nos três degraus. Os testes da F-VIVO-a continuam verdes.
  O roteiro da F-VIVO-a roda e é conferido pelo código de saída. Um roteiro novo mostra a pedreira
  (pedra com ícone) e o moinho (entrada `corn` com ícone, saída `flour` com quadrado), e a
  screenshot é aberta.
- **Divergência com o KaM** (medida na seção 4): o original **não mostra pilha no armazém**
  (`Store` não tem `SupplyIn` nem `SupplyOut`). A F-VIVO-a mostra as quatro maiores por decisão
  do operador (2026-09-26). Não muda aqui. Fica anotado para o operador.

---

## 4. Medida do KaM (item 15)

> **A versão completa**, com a animação `haIdle` (ocioso), a região de cada animação no
> desenho, o mastro e as bandeiras, e o que o trabalhador faz sem insumo, está em
> `docs/kam-casas-animacao-e-pilhas.md`, o insumo da skill de arte do Codex. A tabela abaixo é o
> resumo do que este plano usa.
>
> **Relacionado:** o BUG-V (`BUGS.md`, o especialista trabalha e espera fora da casa). No KaM, o
> trabalhador de dentro fica invisível, e quem mostra que ele está lá é a animação da **casa**
> (`haIdle`, `haWork`). Se o BUG-V for corrigido nesse sentido, o estado `trabalhar` da unidade
> (seção 5.2) só vale para quem trabalha fora: lenhador, fazendeiro, pescador, pedreiro e
> laborer.

**Fonte:**
- `houses.dat` e `houses.rx` de `D:\SteamLibrary\...\Knights and Merchants Historical Version`;
- o código do `kam_remake` em `%TEMP%\kam_remake_codex_projection_20260927`, commit `731a8a4`
  (2026-09-25).

**Como foi medido.** Duas sondas no scratchpad desta sessão, com o layout de
`TKMHouseSpecLegacy` (`KM_ResHouses.pas:21-47`) e o leitor de cabeçalho `.rx` de
`tools/kam-medir.js:86`:
- `SupplyIn` e `SupplyOut` são `[4 mercadorias][5 quantidades]` de id de sprite;
- `Anim[haWork1..haWork5, haSmoke]` dá o `Count`.

Nada foi copiado para o repositório. **O `tools/kam-medir.js` não lê as pilhas hoje.** Se o
operador quiser a medida reproduzível, o leitor ganha o campo `pilhas` num item próprio.

**Como o KaM desenha a pilha** (`AddHouseSupply`, `KM_RenderPool.pas:878-949`):
- a pilha **não é empilhada unidade a unidade**: é **um sprite por quantidade**, de 1 a 5, com a
  posição embutida no pivot do sprite;
- a quantidade é `min(estoque, MAX_WARES_IN_HOUSE)`, com `MAX_WARES_IN_HOUSE = 5`
  (`KM_Defaults.pas:299`);
- a oficina desenha a saída por peça encomendada, e não por mercadoria.

O teto 5 da F-VIVO-a bate com o original.

**Como o KaM anima o trabalho** (`AddHouseWork`, `KM_RenderPool.pas:827-875`): `haWork1..5`
("Start, InProgress, …, Finish", `KM_Defaults.pas:765`), com um quadro por passo de animação do
prédio. `haSmoke` roda contínua.

**Legenda da tabela:**
- **E/S** é o número de pilhas de entrada e de saída;
- **pé** é onde a pilha de 1 unidade encosta no chão, em fração do sprite da casa (x da esquerda,
  y do topo), comparável às `ancoras` do nosso manifesto;
- **Trabalho** lista os quadros de `Work1..Work5` diferentes de zero;
- as mercadorias são as do nosso `economia.mercadorias`.

| KaM → nosso id | Trabalho (quadros) | Fumaça | Entrada: pé (x,y) | Saída: pé (x,y) |
|---|---|---|---|---|
| Sawmill → `sawmill` | W1 30, W2 10, W5 30 | — | 1: (0,13; 0,85) | 1: (0,38; 0,64) |
| IronSmithy → `iron_smithy` | W2 30, W3 30 | 4 | 2: (0,75; 0,88) (0,19; 0,83) | 1: (0,90; 0,67) |
| WeaponSmithy → `weapon_smithy` | W1..W5 30 cada | 4 | 2: (0,10; 0,76) (0,12; 0,93) | 3: todas em (0,84; ~0,8) |
| CoalMine → `coal_mine` | W1 30, W2 15, W5 30 | — | — | 1: (0,14; 0,93) |
| IronMine → `iron_mine` | W2 16 | — | — | 1: (0,75; 0,83) |
| GoldMine → `gold_mine` | W2 16 | — | 1 (*) | 1: (0,81; 0,89) |
| Fishermans → `fishermans` | **nenhum** | — | — | 1: (0,69; 0,95) |
| Bakery → `bakery` | W2 24, W3 30 | 4 | 1: (0,12; 0,82) | 1: (0,16; 0,92) |
| Farm → `farm` | **nenhum** | — | — | 1: (0,77; 0,90) |
| Woodcutters → `woodcutters` | **nenhum** | — | — | 1: (0,13; 1,01) |
| ArmorSmithy → `armor_smithy` | W2..W5 30 cada | 4 | 2: (0,39; 0,91) (0,10; 0,78) | 2: (0,45; 0,98) (0,46; 0,98) |
| Store → `storehouse` | **nenhum** | — | **nenhuma** | **nenhuma** |
| Stables → `stables` | W1..W5 30 cada | — | 1: (0,47; 0,68) | — (os cavalos são animais) |
| School → `schoolhouse` | W1..W5 30 cada | — | — | — |
| Quarry → `quarry` | W2 18, W5 30 | — | — | 1: (0,72; 0,85) |
| Metallurgists → `metallurgists` | W2 28, W3 30, W4 30 | 4 | 2: (0,13; 0,97) (0,21; 0,81) | 1: (0,69; 0,87) |
| Swine → `swine_farm` | W2 30, W3 30 | — | 1: (0,14; 0,63) | 2: (0,49; 0,40) (0,47; 0,89) |
| WatchTower → `watchtower` | W2 1 (quadro fixo) | — | — | — |
| TownHall → `town_hall` | **nenhum** | — | — | — |
| WeaponWorkshop → `weapons_workshop` | W1 16, W2..W5 30 | — | 1: (0,13; 0,96) | 3: todas em (0,51; ~0,78) |
| ArmorWorkshop → `armory_workshop` | W2..W4 30 cada | — | 2: (0,25; 0,75) (0,29; 0,85) | 2: (0,55; 0,94) (0,55; 0,91) |
| Barracks → `barracks` | **nenhum** | — | — | — |
| Mill → `mill` | W2 8 | — | 1: (0,72; 0,84) | 1: (0,24; 1,00) |
| Butchers → `butchers` | W1 15, W2 27, W3 30, W4 3 | — | 1: (0,47; 0,83) | 1: (0,28; 0,85) |
| Tannery → `tannery` | W1 29, W2 12 | 4 | 1: (0,27; 1,00) | 1: (0,80; 0,83) |
| Inn → `inn` | **nenhum** | — | 4: (0,30; 0,66) (0,19; 0,80) (0,44; 0,64) (0,47; 0,64) | — |
| Vineyard → `wineyard` | W1 30, W2 24, W5 28 | — | — | 1: (0,58; 0,80) |
| SiegeWorkshop → (não temos) | W2..W4 30 | — | 2, com 3 e 4 sprites | — |

**Unidades por pilha:** sempre **5** sprites (1..5 unidades), menos na SiegeWorkshop, com 3 e 4.

**(*)** A GoldMine tem 5 sprites de entrada, mas `WareInput` vazio (`-1`). É **hipótese** que
seja resto de dado sem uso. A mina não recebe insumo no remake.

**O que a tabela diz para nós.** Isto é leitura, não decisão:
- **Não animam no original:** fazenda, lenhador, pescador, armazém, prefeitura, quartel e
  estalagem. Lenhador, fazendeiro e pescador trabalham **fora**, como unidade (o `trabalho` do
  `kam-medir`). As animações de trabalho de unidade medidas no `unit.dat` são as do lenhador,
  fazendeiro, pescador e pedreiro, em 8 direções.
- A entrada fica quase sempre à **esquerda** (x < 0,5) e a saída à direita ou na frente. Isso
  bate com o padrão da F-VIVO ("entrada à esquerda da porta, saída à direita").
- **Referência de quadros de unidade no KaM** (`unit.dat`, direção S):

  | Ação | A pé | Montado (scout, knight, vagabond) |
  |---|---|---|
  | walk | 8 | 6 |
  | die | 15 | 17 |
  | golpe do militar | 12 | 12 |

  O arco tem 18 e a besta 28. O KaM não tem idle separado: a unidade parada usa um quadro do
  walk.

---

## 5. Decisões propostas: animação de unidade

### 5.1 Direções: F-SPR atualizada

- **Proposto:** todo tipo a pé e montado declara `direcoesDeSprite: 8` em `data/units.json`. O
  campo é lido só pelo render. A nota da F-SPR em `BUILD_PLAN.md:1874` passa a dizer "8 para
  todos, 5 desenhadas com espelho".
- A quantidade de direções **desenhadas** não vira campo novo. Ela sai do que existe no atlas: com
  `o` desenhado, a regra de hoje (`manifesto.ts:259-279`, "a direção declarada vence") já usa o
  arquivo e não espelha. Um tipo assimétrico (seção 7) desenha 8 sem mudança de código.
- **Montados em 16:** ficam para depois do piloto de arte, como pedido. O movimento só produz 8
  vetores (seção 2), então 16 só ganharia na virada suavizada. Não entra na primeira leva.

### 5.2 Estados e quadros

Os nomes em português seguem a pose `parado` que já existe:

| Estado | Quadros | Laço | Quem tem |
|---|---|---|---|
| `parado` | 4 | sim | todos |
| `andar` | 12 (ou 8, seção 6) | sim | todos |
| `atacar` | 6 | sim | militares e mercenários |
| `trabalhar` | 6 | sim | civis que trabalham (não o serf, não o recruta) |
| `morrer` | 6 | **não**, para no último | todos |

Os fps (10–12) e os parâmetros do walk ficam na **entrada do manifesto**, por estado. São dado de
render, não número em `.ts` (CLAUDE.md §2.3, pelo espírito).

### 5.3 O relógio da animação

- **Proposto:** o relógio é o **tempo de jogo** (tick + fração da interpolação), e não o relógio
  de parede. Três motivos:
  1. é o que o KaM faz (`AnimStep` por tick);
  2. é o que a F-VIVO-b (animação de trabalho do prédio) já faz;
  3. deixa o roteiro determinístico com `?pausado` e passo a passo.
- **Consequência:** na velocidade 3x, o `parado` também roda 3x. A velocidade de jogo continua
  fora da sim, porque o relógio é do render.

### 5.4 Walk preso à distância

- A função pura é `quadroDoAndar(distanciaAcumulada, tilesPorCiclo, quadros)`, com o quadro igual
  a `floor(distanciaAcumulada / tilesPorCiclo × quadros) mod quadros`.
- A `distanciaAcumulada` é memória de render por unidade, como a memória da interpolação
  (`interpolacao.ts`). Ela soma a distância euclidiana da posição **desenhada**, e por isso a
  diagonal anda √2 no mesmo tempo que a sim cobra.
- `tilesPorCiclo` fica no manifesto, por tipo. É a passada: quanto a unidade avança num ciclo
  completo de pés.
- **O que isso garante:** quadros por tile constantes na estrada, na grama, carregada ou não e em
  1x ou 3x. O pé não desliza porque o quadro não depende do relógio.
- **Teste:** a mesma sequência de posições a duas velocidades diferentes dá a mesma contagem de
  quadros por tile. A unidade parada não avança o quadro.

### 5.5 Virada suavizada (só render)

- A função pura é `direcaoNaVirada(anterior, nova, tempoDesdeATroca, passo)`:
  - com diferença maior que 45°, o render mostra a direção intermediária, de 45° em 45°, com cada
    degrau durando `passo`;
  - no empate de 180°, gira no **sentido horário**, para ser determinístico.
- **Proposto:** `passo` de 0,7 tick de jogo (70 ms em 1x). Uma virada de 90° gasta 1 passo, uma
  de 135° gasta 2 e uma de 180° gasta 3 (≈ 210 ms). A outra opção está na seção 12.
- Parada, a unidade não vira sozinha. O walk continua avançando durante a virada.

### 5.6 Para onde a unidade olha

A ordem de precedência é:

1. **A `direcao` da sim, quando existe.** Ela vale para o militar em luta (`combate.ts:100`,
   `:145`), em formação (`marcha.ts:193`) e em carga (`carga.ts:92`). O render converte 0..7
   para `n ne l se s so o no`, na mesma ordem horária a partir do norte. **A conferir no piloto
   militar:** se 0 é norte na sim. `passoDaDirecao` em `combate.ts:40` é quem diz.
2. **Trabalhando:** o tile do trabalho. **Hipótese a conferir:** se o `fsmData` do civil que
   colhe tem o tile de destino. Se não tiver, a unidade mantém a última direção do passo, que já
   aponta para o alvo porque ela andou até lá.
3. **Andando:** o vetor do passo (hoje).
4. **Parada:** a última direção (hoje).

### 5.7 Memória

A conta assume quadro de 64×96 RGBA = 24 576 bytes, sem trim e sem máscara. Os montados são
maiores (96×128), então esta conta é o **piso** para eles.

| | walk 12 | walk 8 |
|---|---|---|
| 8 direções desenhadas | 6 176 quadros ≈ **145 MiB** | 5 280 ≈ 124 MiB |
| 5 direções (espelho) | 3 860 ≈ **90 MiB** | 3 300 ≈ 77 MiB |

A estimativa do pedido (~142 MiB) bate com a linha de 8 direções e walk 12. Três formas de
reduzir:

1. **Espelho:** −37%, pela conta acima.
2. **Trim no atlas:** uma unidade de 64×96 ocupa bem menos que o quadro. O ganho é
   **hipótese** até o piloto: a medida sai da área recortada do atlas do serf de depuração e,
   depois, da arte real.
3. **Carregar só os tipos presentes no mapa:** o `preload` lê as unidades do estado inicial e da
   lista do que a partida pode produzir. **Risco:** o tipo produzido no meio da partida (recruta
   → militar) precisa de carga tardia. O placeholder do §9 cobre o intervalo sem quebrar. É o
   mesmo cuidado do "cache do carregamento não filtra o runtime".

**Onde medir.** A asserção permanente vai num eixo determinístico: o `debug.memoriaDeTexturas`
soma `largura × altura × 4` de toda textura carregada, pelo `TextureManager`. A memória real de
GPU (CDP, `chrome://gpu`) é **evidência da sessão**, em `test-output/`, e nunca entra em `expect`
(CLAUDE.md §8).

### 5.8 Máscara de facção: adiada

Não entra. Quando entrar, o formato da seção 5.9 já reserva o lugar: um quadro irmão
`{unidade}/{estado}/{direcao}/{nnnn}_mascara` no mesmo atlas, desenhado como segundo sprite no
mesmo container, com `setTint(corDoBando)` (`cor-do-bando.ts`) e o mesmo `flipX`.

### 5.9 Formato no manifesto

Proposta, alinhada à convenção decidida:

```json
{
  "id": "serf", "tipo": "unidade", "footprint": [1, 1],
  "tamanho": [64, 96], "anchor": [0.5, 1],
  "atlas": "sprites/units/serf/serf.json",
  "animacoes": {
    "parado":    { "quadros": 4,  "fps": 10, "laco": true },
    "andar":     { "quadros": 12, "tilesPorCiclo": 2, "laco": true },
    "morrer":    { "quadros": 6,  "fps": 10, "laco": false }
  },
  "licenca": "...", "origem": { "...": "..." }
}
```

- Os quadros dentro do atlas se chamam `serf/andar/se/0003`, de base 0 e com 4 dígitos. As
  direções que o atlas não tem caem no espelho.
- `estados` (o formato de hoje, `"pose:direcao"` → PNG) **continua aceito**, para a arte parada
  que já existe. O render tenta `atlas` primeiro e depois `estados`. Os dois formatos convivem até
  a última unidade migrar.
- **Anchor com trim:** o atlas guarda o tamanho de origem (`sourceSize`) e o recorte
  (`spriteSourceSize`). **Hipótese a confirmar no piloto:** se o Phaser 3 aplica a origem
  `[0.5, 1]` ao tamanho de origem, e não ao recorte. Se aplicar ao recorte, os pés pulam de quadro
  para quadro. O roteiro do piloto afirma o y do pé em todos os quadros.
- **O validador** (`tests/F17f-manifesto.test.ts`) ganha regras, cada uma com um caso que
  reprova:
  - todo quadro que `animacoes` promete existe no atlas;
  - toda direção desenhada tem os mesmos `quadros`;
  - `tamanho` é igual ao `sourceSize` de todo quadro.

---

## 6. Custo de arte (item 11): o número que decide

Os quadros **desenhados** são contados pela tabela da seção 5.2:

| Grupo | Tipos | Quadros por direção |
|---|---|---|
| Sem `trabalhar` e sem `atacar` (serf, recruit) | 2 | 4 + 12 + 6 = **22** |
| Os outros 26 (12 civis com `trabalhar`, 14 com `atacar`) | 26 | 4 + 12 + 6 + 6 = **28** |

| | walk 12, 8 dir | walk 12, 5 dir (espelho) | walk 8, 8 dir | walk 8, 5 dir |
|---|---|---|---|---|
| serf (e recruit) | 176 | **110** | 144 | 90 |
| cada um dos outros 26 | 224 | **140** | 192 | 120 |
| **total das 28** | **6 176** | **3 860** | **5 280** | **3 300** |

- O espelho corta **2 316** quadros (−37,5%). O walk 8 no lugar de 12 corta mais **560** com
  espelho (−14,5%).
- O KaM usa walk **8** em todo humano a pé (seção 4). É evidência de que 8 lê bem nessa escala.
  **Recomendação:** 5 direções com espelho e walk 8, 3 300 quadros. O piloto desenha o serf com
  walk 12 **e** walk 8, porque o sprite de depuração não custa nada, e o operador escolhe vendo
  lado a lado. A escolha vale para as 28.
- **Fora da conta:** a máscara de facção (adiada) e a carga no braço, que custaria mais 1 120 e
  é substituída pelo ícone.

---

## 7. Espelhamento (item 10): o que quebra

O espelho troca a mão. Numa unidade que olha para `l`, o que está na mão direita aparece na
esquerda quando ela olha para `o`.

| Elemento | Onde aparece | Quebra? |
|---|---|---|
| Arma de uma mão (machado, espada, facão) | axe_fighter, sword_fighter, militia, rogue, barbarian, warrior | a arma troca de mão |
| Escudo no braço oposto | sword_fighter, com escudo de madeira ou de ferro (`wooden_shield`, `iron_shield`) | escudo e arma trocam de lado |
| Arco e besta | bowman, crossbowman | a mão do arco troca. É o mais visível, porque o arco é grande |
| Lança e pique | lance_carrier, pikeman | a lança é quase simétrica no eixo do corpo: quebra pouco |
| Ferramenta de civil (machado, enxada, martelo, rede) | woodcutter, farmer, laborer, stonemason, fisherman, blacksmith | troca de mão; no `trabalhar`, o golpe muda de lado |
| Montado | scout, knight, vagabond | a lança do knight e a espada do scout trocam de lado; o cavalo é simétrico |
| Faixa, lenço amarrado de um lado, bornal ou cartucheira a tiracolo | a vestimenta do sertão, em qualquer tipo | a alça muda de ombro |
| A máscara de facção (`:42`: lenço grande + faixa ou chapéu) | todos | espelha junto com a base, por ser o mesmo quadro com `flipX`. **Não quebra**, desde que o lenço não seja assimétrico de propósito |
| A luz lateral | todos | **resolvido** pela decisão do operador: luz de cima |

**O contrato** (`:38` e `:42`) não diz nada sobre mão nem assimetria. A proposta de texto está na
seção 8.

**Recomendação:** espelhar todos na primeira leva. Com 64×96 a zoom 0,5, a troca de mão é
difícil de ver, e o KaM tem arte de mesma escala. O tipo que o operador reprovar vendo o espelho
desenha as 8 direções, sem código novo (seção 5.1). **A conferir no piloto militar**, e não no
serf: o serf não carrega nada na mão.

---

## 8. Divergências a propor ao contrato da branch de arte

Nada aqui foi editado na `noru-novos-sprites`. O operador leva ao Codex.

1. **`:38` (luz).** No lugar de "Luz fixa no mundo, do alto à esquerda do mapa", propor:
   > Luz de cima, sem componente lateral: sombra e realce são simétricos em relação ao eixo
   > vertical do sprite, para que as direções do oeste sejam o espelho (`flipX`) das do leste.
   > Nas oito direções, os planos do corpo mudam com a orientação, mas nunca com o lado.
2. **Um parágrafo novo, "Animação de unidade"**, proposto:
   > Unidade animada vem num atlas por unidade (`assets/sprites/units/<id>/<id>.png` + `.json`),
   > com quadros nomeados `{unidade}/{estado}/{direcao}/{nnnn}`. `estado` ∈ `parado`, `andar`,
   > `atacar`, `trabalhar`, `morrer`. `direcao` ∈ `n ne l se s so o no`. `nnnn` é de base 0 e
   > tem 4 dígitos. Desenham-se `n ne l se s`; `so o no` saem do espelho de `se l ne`, e só são
   > desenhadas quando o tipo for declarado assimétrico. Todos os quadros de uma unidade têm o
   > mesmo tamanho de origem, com os pés em `[0.5, 1]` e a mesma linha de base. O recorte (trim)
   > é permitido, e o atlas guarda o tamanho de origem. Quadros por estado e fps ficam na
   > entrada do manifesto (`animacoes`).
3. **Um parágrafo novo, "Assimetria"**, proposto:
   > Arma, escudo e ferramenta trocam de mão no espelho, e isso é aceito. Se o operador reprovar
   > o espelho de um tipo, esse tipo desenha as oito direções.
4. **`:42` (máscara).** Acrescentar o nome do quadro da máscara:
   > `{unidade}/{estado}/{direcao}/{nnnn}_mascara`, no mesmo atlas, espelhado junto com a base.

   Continua adiado.
5. **`:28` (manifesto).** Acrescentar que a entrada de unidade pode trazer `atlas` e `animacoes`
   no lugar de `estados`.

---

## 9. Sprites de depuração

- **O que desenham:** uma silhueta com a cor do bando, uma **seta** apontando a direção, a
  **sigla da direção** (`se`) e o **número do quadro** (`03`) escritos, um traço nos pés (a linha
  de base) e, no `andar`, a perna da frente alternando. A diferença de um quadro para o próximo
  é legível na screenshot.
- **Onde nascem (proposto):** `tools/gerar-sprites-depuracao.js`, no molde do
  `derivar-icones.js`. Usa o Chromium do Playwright, que já é devDependency, sem dependência
  nova. Ele grava:
  - o atlas PNG + JSON em `assets/depuracao/<id>/`, com os mesmos nomes de quadro da seção 5.9;
  - a entrada num `assets/manifest-depuracao.json`, **separado** do manifesto do jogo.
- O jogo só lê esses arquivos com `?depuracao=<id>` na URL. Assim, o piloto exercita o **mesmo
  caminho de carga** (`load.atlas`) que a arte real vai usar.
- **Por que não gerar em tempo de execução (canvas no Phaser):** seria mais barato, mas não
  testaria o `load.atlas`, o trim nem o validador do manifesto. Justamente o que a arte vai
  quebrar.
- Os sprites de depuração não são arte do jogo: não entram em `assets/sprites/` nem no bundle
  sem a flag (seção 12).

---

## 10. Ordem de implementação

Cada item tem aceite, teste e evidência, pela Definition of Done do CLAUDE.md §7. Um item por
sessão.

### Leva 1: logística (item 14)

| Sigla (proposta) | O quê | Evidência |
|---|---|---|
| D-ARTE-01 | `icones.mercadorias` no manifesto, com os 8 que existem | teste do manifesto com caso que reprova |
| D-TELA-03a | a carga sobre o serf com ícone, e texto sem ícone | teste puro + roteiro despausado + screenshot |
| D-TELA-03b | a pilha da casa com ícone: PNG `pilha` → ícone → quadrado | teste puro + roteiro F-VIVO-a pelo código de saída + roteiro novo + screenshot |

### Leva 2: piloto do serf, ponta a ponta (item 12)

| Sigla (proposta) | O quê | Evidência |
|---|---|---|
| D-ARTE-02 | `tools/gerar-sprites-depuracao.js` e o atlas de depuração do serf, com walk 12 e walk 8 | atlas gerado; teste: todo quadro prometido existe |
| D-TELA-04a | o manifesto aceita `atlas` + `animacoes` ao lado de `estados`; o validador ganha as regras da seção 5.9 | teste com caso que reprova em cada regra |
| D-TELA-04b | o render do serf: `direcoesDeSprite: 8` no serf, o quadro por estado (`parado` e `andar`), o walk preso à distância e o y do pé constante | testes puros (5.3, 5.4) + roteiro |
| D-TELA-04c | o roteiro de tela: uma **vitrine** (`?vitrine=serf`), só render, com as 8 direções × os quadros, e o serf andando numa partida (tick a tick, a direção e o quadro saem no `debug`) | 2 screenshots abertas: a vitrine e a partida |
| D-TELA-04d | a virada suavizada no serf | teste puro (90°, 135°, 180°, o empate) + roteiro com a virada capturada no degrau intermediário |
| D-TELA-04e | a medida de memória: `debug.memoriaDeTexturas`, com e sem trim, com e sem espelho | número em `test-output/`, com asserção no eixo de bytes |

**Parada para aprovação do operador** depois da D-TELA-04e: walk 8 ou 12, o passo da virada, o
espelho e o formato.

### Leva 3: generalização

Só depois do piloto aprovado:

| Sigla (proposta) | O quê |
|---|---|
| D-TELA-05a | `direcoesDeSprite: 8` nos 28 tipos, e a nota da F-SPR atualizada no BUILD_PLAN |
| D-TELA-05b | o olhar pela `direcao` da sim (militares), e o piloto de um militar com o sprite de depuração, para conferir o espelho da arma (seção 7) |
| D-TELA-05c | `atacar`, `trabalhar` e `morrer`, com `morrer` sem laço e o corpo mantido até a sim remover a unidade |
| D-TELA-05d | carregar só os tipos presentes, com carga tardia do tipo produzido em partida |
| (depois) | a máscara de facção, os montados em 16 direções e a carga no braço, cada um por decisão do operador |

---

## 11. Riscos

- **O anchor com trim no Phaser** (5.9). Se estiver errado, os pés pulam. O piloto afirma o y do
  pé em todos os quadros antes de generalizar.
- **Tipo produzido em partida sem textura carregada** (5.7). O placeholder cobre o intervalo, e o
  teste da D-TELA-05d cria um militar no meio da partida.
- **A conversão de `direcao` 0..7 da sim para as siglas.** Se a origem ou o sentido divergirem, o
  militar olha para o lado errado. É conferido no `passoDaDirecao` antes da D-TELA-05b.
- **O walk depende da posição desenhada.** A interpolação assenta sem interpolar num salto maior
  que `saltoMaximo` (`interpolacao.ts:20`). Nesse caso a distância acumulada não pode somar o
  salto, ou o walk gira várias voltas num quadro. O teste cobre esse caso.
- **Roteiro pausado não exerce animação** (CLAUDE.md §8). Todo roteiro de animação despausa pelo
  menos um passo e afirma que o quadro avançou.
- **Custo de arte sem walk definido.** Se a arte começar antes da escolha entre walk 8 e 12, o
  retrabalho é de 560 quadros ou mais. A arte do serf espera o fim da Leva 2.

---

## 12. Perguntas em aberto

1. **O passo da virada:**
   - um degrau de 45° a cada 70 ms, com a de 180° gastando ~210 ms (proposto); ou
   - uma intermediária só, ~70 ms, qualquer que seja o ângulo.
2. **Carga sem ícone:** manter o texto de hoje (proposto, nada some) ou passar ao quadrado com a
   cor do tema, como a pilha?
3. **Sprites de depuração no git:** `assets/depuracao/` versionado (proposto: o roteiro precisa
   deles e o gerador não roda no `verify`) ou gerado no roteiro e ignorado?
4. **O armazém:** mantém as 4 pilhas da F-VIVO-a (decisão de 2026-09-26) ou segue o KaM, que não
   mostra pilha no armazém?
5. **Leitor de pilhas no `kam-medir.js`:** tornar reproduzível a medida da seção 4 (hoje ela é
   sonda de scratchpad) ou deixar como medida da sessão?
