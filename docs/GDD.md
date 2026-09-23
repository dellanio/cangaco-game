# cangaço — Game Design Document

> Documento de design. Descreve **o que** o jogo é e **como ele se comporta**,
> nunca como o código é organizado — isso está em `CLAUDE.md`. A fila de
> implementação está em `BUILD_PLAN.md`. Todo número citado aqui vive em
> `data/*.json`; este documento explica o porquê, os arquivos guardam o valor.
>
> **Mecânica** herdada de *Knights and Merchants: The Shattered Kingdom*
> (Joymania / TopWare, 1998), da expansão *The Peasants Rebellion* (2001) e do
> *KaM Remake*. **Ambientação original**: sertão nordestino em registro de
> cordel, descrita na seção 9 e mapeada em `data/theme-sertao.json`.
>
> **Legenda de confiança**
> - **[fonte]**: confirmado em wiki, fórum oficial ou walkthrough.
> - **[geral]**: comportamento conhecido do jogo, sem número exato nas fontes.
> - **[proposta]**: decisão de design da nossa versão. **Não é do jogo original.**
>
> **Uso dos assets:** nada de copiar sprites, sons, mapas, nomes de facções ou
> textos do jogo original, inclusive como imagem de referência em ferramentas de
> transferência de estilo. Estilo e mecânica, sim; cópia de arte, não.

---

## 0. Os dois princípios que definem o jogo

Se algo neste documento entrar em conflito com os dois pontos abaixo, os dois
pontos vencem.

1. **Os civis não são controlados diretamente.** O jogador controla a cidade
   **colocando planos**: planta de construção, estrada, campo. Laborers e serfs
   pegam essas tarefas sozinhos **[fonte]**.
2. **Só os militares são controlados diretamente** — selecionar, mover, virar,
   atacar **[fonte]**.

O loop de controle **não é** "selecionar aldeão e mandar construir". É **"abrir o
menu de construção, posicionar a planta, ligar com estrada"**. O jogador precisa
*sentir* que manda: a planta aparece na hora, os laborers correm até ela, os
serfs trazem material, a obra sobe em etapas visíveis.

**Regra de ouro:** nenhuma construção nasce sem ação do jogador. A cidade nunca
se expande sozinha.

---

## 1. Loop principal

### 1.1 Loop macro

1. **Planejar**: menu Build, escolher construção, posicionar a planta (porta ao sul) **[fonte]**.
2. **Conectar**: estrada da porta até a rede. Sem estrada, o prédio não serve para nada **[fonte]**.
3. **Observar a obra**: laborer nivela, serfs trazem timber e stone, laborers erguem **[fonte]**.
4. **Treinar**: na Schoolhouse, 1 ouro por unidade **[fonte]**. Prédio sem trabalhador fica parado.
5. **Balancear**: distribuição, bloqueio no armazém, mais prédios na cadeia que estiver gargalando.
6. **Alimentar**: comida no Inn. Sem comida, os civis morrem **[fonte]**.
7. **Militarizar**: Recruit mais equipamento, Barracks, tropa **[fonte]**.
8. **Comandar o exército** **[fonte]**.
9. **Cumprir o objetivo** **[fonte]**.

### 1.2 Loop micro (a sensação de controle)

```
clique no botão de prédio
  → planta fantasma segue o mouse (verde = pode, vermelho = não pode)
  → clique confirma
  → marcação no chão aparece
  → laborer se desloca
  → serfs trazem material
  → obra sobe em 3 estágios visíveis
  → prédio completo desbloqueia novos botões no menu
```

**[proposta]** Cada seta precisa de retorno visual e sonoro imediato. Ver seção 10.

### 1.3 Ordem de abertura recomendada (referência de ritmo) [fonte]

Primeiros 15–20 min no ritmo original: 2 Woodcutter's e 1 Quarry → 3 Quarries e
1–2 Woodcutter's → 1 Sawmill e 1–2 Woodcutter's → 1 Farm, 1 Gold mine, 1 Coal
mine → 1 Farm, 1 Metallurgist's, 1 Sawmill. Resultado: 5 Quarry, 6 Woodcutter's,
2 Sawmill, 1 Farm, 1 Gold mine, 1 Coal mine, 1 Metallurgist's.

**[proposta]** Na nossa escala de tempo (seção 11), isso deve caber em 8–10
minutos. Se não couber, o ritmo está errado — não o jogador.

---

## 2. Esquema de controle

### 2.1 Mouse

| Ação | Controle | Confiança |
|---|---|---|
| Selecionar prédio, unidade ou grupo | Clique esquerdo | [geral] |
| Posicionar planta, estrada ou campo | Clique esquerdo com a ferramenta ativa | [fonte] |
| Arrastar estrada | Segurar e arrastar tile a tile | [proposta] |
| Cancelar ferramenta | `Esc` ou clique direito sem seleção | [proposta] |
| Mover grupo militar | Clique direito no destino | [fonte] |
| Definir direção da formação | Segurar clique direito, rosa dos ventos, soltar na direção | [fonte] |
| Virar sem mover | Segurar clique direito sobre os pés do líder e soltar na nova direção | [fonte] |
| Atacar | Clique direito em inimigo; corpo a corpo carrega ao contato | [fonte] |
| Mover a câmera | Arrastar com o botão do meio, borda da tela ou `WASD` | [proposta] |
| Zoom | Roda do mouse | [proposta] |

### 2.2 Teclado [proposta]

`B` Build · `R` estrada · `F` campo · `Delete` demolir · `Esc` cancela ·
`Ctrl+1..9` salva grupo · `1..9` seleciona grupo · `Espaço` pula para o último
alerta · `+`/`-` velocidade de jogo · `P` pausa. A pausa também é automática
ao ocultar a aba do navegador, mas voltar à aba **não** retoma: o jogador
despausa com `P`.

### 2.3 Comandos de prédio

- **Schoolhouse**: fila de 5 slots, 1 ouro cada **[fonte]** (5 no wiki do Remake, 6 no guia da Steam; adotamos 5 **[proposta]**).
- **Woodcutter's**: modo só cortar / só replantar / ambos **[fonte]**.
- **Oficinas**: quantas de cada arma produzir **[geral]**.
- **Barracks**: tipo de soldado a treinar **[fonte]**.
- **Storehouse**: bloquear ou liberar cada item **[fonte]**.
- **Qualquer prédio**: demolir, pausar, ligar/desligar reparo **[geral]**.
- **Unidade civil**: *Dismiss*, volta à escola e some, sem reembolso **[fonte]**.

### 2.4 Comandos militares

| Comando | Efeito | Confiança |
|---|---|---|
| **Storm attack** | Acelera temporariamente; carrega em linha reta e fica incontrolável até bater em algo. Serve para escapar de flechas e torres | [fonte] |
| Formação (+/− colunas) | Grupo recomendado de 9 a 15 | [fonte] |
| Halt, Split, Link | Parar, dividir, unir | [geral] |
| Feed | Serfs levam comida ao grupo em campo | [fonte] |
| Arqueiros | Só atiram na direção em que estão virados | [fonte] |

---

## 3. Estado inicial

### 3.1 No original [fonte]

Varia por missão. Missão 2: só um Storehouse mais 8 Axe Fighters, 6 Bowmen e 12
Militia. Missão 1: vários prédios básicos, Barracks, 10 Axe Fighters e 50
Militia. Quantidades de mercadorias iniciais não constam nas fontes.

### 3.2 Nosso modo "cidade do zero" [proposta]

Storehouse e Schoolhouse prontos; 20 gold, 40 timber, 30 stone, 15 loaves,
10 sausages; 4 serfs e 2 laborers. Menu Build inicial: Quarry, Woodcutter's e
Inn. Valores em `data/economy.json`.

---

## 4. Sistema de recursos

### 4.1 As 28 mercadorias

| Categoria | Itens |
|---|---|
| Construção | Tree trunks, **Timber**, **Stone** |
| Mineração e metal | Gold ore, **Gold**, Coal, Iron ore, Iron |
| Agricultura e animal | Corn, Flour, Pigs, Skins, Leather, Horses |
| Comida | **Loaves**, **Sausages**, **Wine**, **Fish** |
| Armas | Hand axes, Swords, Lances, Pikes, Longbows, Crossbows |
| Armaduras e escudos | Leather armor, Iron armor, Wooden shields, Iron shields |

Os três que o jogador sente o tempo todo: **Gold**, **Timber** e **Stone**.

### 4.2 Fontes e destinos [fonte]

| Recurso | Vem de | Vai para |
|---|---|---|
| Stone | Quarry | Prédios, estradas, munição de Watchtower |
| Tree trunks | Woodcutter's | Sawmill |
| Timber | Sawmill (1 tronco → 2 timber) | Prédios, campos de uva, oficinas |
| Gold | Metallurgist's (gold ore + coal → 2 gold) | Schoolhouse, Town hall |
| Corn | Farm (~15 campos) | Mill, Swine farm, Stables |
| Loaves | Mill → Bakery (2 pães por farinha) | Inn |
| Sausages | Swine farm → Butcher's (3 por porco) | Inn |
| Wine | Wineyard (9 campos de uva) | Inn |
| Fish | Fisherman's (**finito**) | Inn |
| Iron | Iron mine + Coal → Iron smithy | Weapon smithy, Armor smithy |

### 4.3 Comida e fome [fonte]

- Todos os civis ficam com fome. **Não existe limite de população**: ela é
  limitada pela comida.
- Inn: 8 comensais simultâneos, 5 unidades de cada comida estocadas.
- Restauração: Wine **30%**, Loaves **40%**, Fish **50%**, Sausages **60%**.
  (O vinho foi aumentado de 20% para 30% no Remake **[fonte]**.)
- Civil precisa de **2 comidas diferentes** para chegar a 100%. Militar enche com
  **1 item qualquer**.
- Militares não vão ao Inn; serfs levam comida no comando **Feed**.

Durações e limiares em `data/condition.json`. Ver seção 11.

### 4.4 Controles de economia

- **Armazém**: bloquear item a item. O guia do original sugere manter só Timber,
  Stone, Bread, Sausage, Wine, Fish e Gold **[fonte]**.
- **Menu de distribuição**: reparte recursos disputados entre consumidores **[fonte]**.
- **Marketplace** (só no Remake): taxa fixa, máximo de 10 serfs negociando **[fonte]**.

### 4.5 Proporções de referência [fonte]

- 2 Woodcutter's : 1 Sawmill
- 1 Farm : 1 Mill; 1 Mill : 1 Bakery
- 1,63 Farm : 1 Swine farm; 2 Farms : 1 Stables
- 3 Swine farms : 1 Butcher's e 1 Tannery
- 1 Iron smithy : 1 Weapon smithy (ou 2 a 3 Armor smithies)
- +1 Farm a cada 5 prédios que consomem milho; idem Coal mine.

**Estas proporções são o alvo real de fidelidade.** Os tempos exatos não estão
publicados em lugar nenhum; as proporções estão. Um cenário longo que as respeite
não pode acumular fila infinita nem deixar prédio ocioso — é o oráculo de
calibração da F15 e da F20.

---

## 5. Árvore de construções

### 5.1 Regras de construção [fonte]

- Planta com porta ao **sul**; precisa de estrada até a rede.
- Etapas: laborer nivela → serfs entregam timber e stone → laborers montam a
  estrutura de madeira e depois a de pedra.
- **HP total = (timber + stone) × 50**, e **marteladas = HP ÷ 5**. Verificado
  contra os 28 prédios do Remake, sem uma exceção. Cada material entregue
  habilita 50 HP de martelada; a obra só termina quando o laborer martela tudo.
  Isso vira regra de validação em `data/buildings.json`.
- Concluir um prédio **desbloqueia** os próximos da árvore.

### 5.2 Tabela completa [fonte]

| Prédio | Tam. | Timber | Stone | HP | Desbloqueado por | Trabalhador | Entrada → Saída |
|---|---|---|---|---|---|---|---|
| Storehouse | 3×3 | 6 | 5 | 550 | inicial / Sawmill | — | armazena tudo |
| Schoolhouse | 3×3 | 6 | 5 | 550 | Storehouse | — | 1 gold → 1 civil |
| Inn | 4×3 | 6 | 5 | 550 | Storehouse | — | comida → alimenta civis |
| Quarry | 3×2 | 3 | 2 | 250 | Schoolhouse | Stonemason | rocha → stone |
| Woodcutter's | 3×2 | 3 | 2 | 250 | Schoolhouse | Woodcutter | árvores → tree trunk |
| Watchtower | 2×2 | 3 | 2 | 250 | Quarry | Recruit | até 5 stone → pedrada |
| Sawmill | 4×2 | 4 | 3 | 350 | Woodcutter's | Carpenter | 1 trunk → 2 timber |
| Farm | 4×3 | 4 | 3 | 350 | Sawmill | Farmer | ~15 campos → corn |
| Wineyard | 3×2 | 4 | 3 | 350 | Sawmill | Farmer | 9 campos → wine |
| Fisherman's | 3×2 | 4 | 3 | 350 | Sawmill | Fisherman | lago → fish |
| Gold mine | 2×1 | 3 | 2 | 250 | Sawmill | Miner | veio → gold ore (esgota) |
| Coal mine | 3×2 | 3 | 2 | 250 | Sawmill | Miner | → coal |
| Iron mine | 3×1 | 3 | 2 | 250 | Sawmill | Miner | veio → iron ore |
| Weapons workshop | 4×2 | 4 | 3 | 350 | Sawmill | Carpenter | 2 timber → arma de madeira |
| Barracks | 4×4 | 6 | 6 | 600 | Sawmill | — | recruit + equipamento → soldado |
| Marketplace\* | 4×3 | 6 | 5 | 550 | Sawmill | — | troca de recursos |
| Mill | 3×3 | 4 | 3 | 350 | Farm | Baker | corn → flour |
| Bakery | 3×3 | 4 | 3 | 350 | Mill | Baker | flour → 2 loaves |
| Swine farm | 4×3 | 4 | 3 | 350 | Farm | Animal breeder | corn → pigs + skins |
| Stables | 4×3 | 6 | 5 | 550 | Farm | Animal breeder | corn → horses |
| Butcher's | 3×3 | 4 | 3 | 350 | Swine farm | Butcher | pig → 3 sausages |
| Tannery | 3×2 | 4 | 3 | 350 | Swine farm | Butcher | skin → 2 leather |
| Armory workshop | 3×3 | 4 | 3 | 350 | Tannery | Carpenter | leather → leather armor; timber → wooden shield |
| Metallurgist's | 3×3 | 4 | 3 | 350 | Gold mine | Metallurgist | gold ore + coal → 2 gold |
| Town hall | 4×3 | 6 | 5 | 550 | Metallurgist's | — | gold → mercenários |
| Iron smithy | 4×2 | 4 | 3 | 350 | Iron mine | Metallurgist | iron ore + coal → iron |
| Weapon smithy | 4×2 | 4 | 3 | 350 | Iron smithy | Blacksmith | iron + coal → arma de ferro |
| Armor smithy | 4×3 | 4 | 3 | 350 | Iron smithy | Blacksmith | iron + coal → armadura de ferro |

\* Marketplace existe só no Remake. Town hall existe na versão Steam/TPR e no Remake.

### 5.3 Árvore de desbloqueio

```
Storehouse
├── Inn
└── Schoolhouse
    ├── Quarry
    │   └── Watchtower
    └── Woodcutter's
        └── Sawmill
            ├── Storehouse (adicional)
            ├── Barracks
            ├── Weapons workshop
            ├── Marketplace
            ├── Fisherman's
            ├── Wineyard
            ├── Coal mine
            ├── Gold mine
            │   └── Metallurgist's
            │       └── Town hall
            ├── Iron mine
            │   └── Iron smithy
            │       ├── Weapon smithy
            │       └── Armor smithy
            └── Farm
                ├── Mill
                │   └── Bakery
                ├── Stables
                └── Swine farm
                    ├── Butcher's
                    └── Tannery
                        └── Armory workshop
```


**A árvore diz o que cada prédio EXIGE; a fase diz o que está DISPONÍVEL.**
São duas camadas, e a raiz do desenho acima é a primeira delas. O `Storehouse`
no topo é o armazém que a partida já dá de pé — ele não é construível de graça;
o que o jogador constrói é o **`Storehouse (adicional)`**, pendurado na Sawmill,
e é isso que `buildings.json` grava em `storehouse.desbloqueadoPor: "sawmill"`.
Logo o grafo do dado **não tem raiz** e fecha um ciclo de propósito: quem abre a
partida é o que já está construído (`economy.estadoInicial.predios`), não um pai
nulo.

**Decisão do operador, 2026-09-23.** No original, a disponibilidade do armazém
adicional é decisão de **fase**, não só da árvore: as primeiras missões permitem
um só armazém, e do meio da campanha em diante o jogo libera mais. Hoje o jogo
tem uma configuração só — sandbox —, então a árvore basta e nada mais é preciso.
Quando a campanha existir, ela ganha uma **camada de permissão por fase** por
cima da árvore: a fase restringe o que a árvore já autorizou, nunca o contrário.
O campo `economy.estadoInicial.menuBuildInicial` é o lugar natural dela, e hoje
só pode ficar vazio, porque a regra que o valida (`economia/menu-inicial`) ainda
exige raiz sem pai — algo que a árvore não tem mais. Quem for implementar a fase
revisita aquela regra; não é esquecimento.
### 5.4 Estradas e campos

- **Estrada: 1 stone por tile** **[proposta]**, feita por laborers. Ela é
  requisito de funcionamento do prédio, não só atalho **[fonte]**.
- **Estrada dá 30% de bônus de velocidade** **[proposta]**. Implementado como
  custo de movimento no A*: estrada 1,0 e grama 1,30. O caminho mais barato passa
  pela estrada sozinho, sem regra especial.
- Estradas diagonais funcionam se nada bloquear a passagem **[fonte]**.
- **Divergência consciente do original (decisão do operador, Fase A) [proposta]:** a estrada
  liga só em **4 direções**. A fidelidade ao original fica congelada em `IDEIAS.md` até a
  Fase A fechar.
- Campo de milho: arado por laborer, sem custo de material **[proposta]**.
- Campo de uva: **1 timber** por campo **[fonte]**.
- Boa prática do original: estrada ao redor de todos os prédios desde cedo e pelo
  menos 2 rotas entre prédios relacionados **[fonte]**.

---

## 6. Autonomia: quem controla o quê

### 6.1 Divisão de controle [fonte]

| Unidade | Controle do jogador | Comportamento autônomo |
|---|---|---|
| **Serf** | Nenhum direto. Indireto: quantos treinar, onde há estrada, bloqueios, distribuição | Busca e entrega mercadorias; leva comida à tropa no Feed |
| **Laborer** | Nenhum direto. Indireto: onde ficam plantas, estradas e campos | Nivela, constrói, faz estradas, campos e vinhas; repara |
| **Especialistas** | Nenhum direto. Indireto: construir e configurar o prédio | Ocupa um prédio vago do seu tipo e produz |
| **Recruit** | Indireto: treinar e enviar ao quartel ou à torre | Ocupa torre ou vira soldado |
| **Todos os civis** | Dismiss | Vão ao Inn quando com fome |
| **Militares** | **Direto** | Carregam ao contato; arqueiros atiram à frente |

### 6.2 Máquinas de estado dos civis [proposta]

Estes são os estados canônicos. Qualquer outro precisa entrar aqui antes de
existir no jogo.

**Serf** — `ocioso → indo_buscar → carregando → indo_entregar → entregando → ocioso`

Saídas de erro obrigatórias: se a origem perder o recurso, se o destino sumir ou
encher, ou se o caminho for cortado, vai para `devolvendo` (leva a carga ao
armazém mais próximo) e libera a tarefa.

**Laborer** — `ocioso → indo_a_obra → nivelando → esperando_material → martelando → ocioso`

`esperando_material` é estado real e visível, não travamento: o laborer fica na
obra. Obra demolida devolve o laborer a `ocioso` na hora.

**Especialista** — `sem_prédio → indo_ocupar → trabalhando ⇄ esperando_insumo ⇄ saida_cheia`,
com `indo_comer → comendo` a partir de `trabalhando`.

`saida_cheia` sinaliza que a logística é o gargalo e gera alerta no HUD.

### 6.3 Central de tarefas (JobBoard)

Nenhuma unidade escolhe tarefa varrendo o mundo. Toda tarefa nasce no JobBoard e
é reclamada, com **reserva dupla** — a unidade de recurso na origem e a vaga no
destino. Sem isso, dois serfs pegam a mesma pedra e um prédio recebe mais do que
cabe.

Escada de prioridade (`data/delivery.json`):

1. Comida → Inn **[fonte]**
2. Ouro → Schoolhouse **[fonte]**
3. Material → obra já nivelada **[proposta]**
4. Insumo → produção parada por falta de insumo **[proposta]**
5. Insumo → produção com estoque baixo **[proposta]**
6. Saída cheia → armazém **[proposta]**
7. Excedente → armazém **[proposta]**

Os dois primeiros níveis são do próprio Remake: entregar comida ao Inn é a maior
prioridade e entregar ouro à escola é a segunda **[fonte]**.

Desempate dentro do mesmo nível: **menor distância de caminho a pé**, depois
menor id de tarefa (determinismo). Nunca distância euclidiana — é erro conhecido
do próprio Remake, que fazia o trabalhador escolher alvo do outro lado da
montanha **[fonte]**.

### 6.4 Movimento

- Grid **ortogonal**, vizinhança 8, A* com cache por par origem-destino.
- Velocidade base 1,0 tile/s a pé e 1,66 tile/s montado **[proposta]**, mantendo
  a razão 1:1,666 do Remake **[fonte]**.
- Custo de movimento por terreno em `data/terrain.json`.
- Civis não colidem entre si, para não travar a logística. Militares colidem.
- **Névoa não afeta pathfinding nem JobBoard.** O A* enxerga o mapa inteiro, a
  tarefa se cria e se reclama igual no escuro, e o serf acha o armazém que o
  jogador não está vendo. A névoa é sobre o que o **jogador** sabe, nunca sobre
  o que a unidade sabe — ver §6.5.

### 6.5 Visão e névoa de guerra [proposta]

O original tem névoa; nós ainda não. O número já existe e está sem consumidor: a
tabela do Anexo A (§12.2) dá **visão 9 tiles** para quase toda unidade e **18
para o Scout**, e `data/units.json` já carrega o campo `visao`. Esta seção é
quem consome.

**Os dois níveis, e eles são diferentes de propósito:**

| O que | Nível | Regra |
|---|---|---|
| Terreno, e prédio próprio | **apresentação** | o que nunca foi descoberto aparece escuro; o que já foi fica desenhado como estava na última vez que se viu. A simulação não muda. |
| Unidade e prédio **inimigos** | **regra** | só existem para o jogador enquanto estão em tiles visíveis **agora**. Fora deles não aparecem na tela, não aparecem em painel nem no minimapa, e não podem ser alvo de ordem. |

Sem o nível de regra para o inimigo, a névoa é decoração: o jogador leria pelo
painel e pelo minimapa o que a tela escondeu.

**Duas camadas por tile, por facção:**

- `descoberto` — já foi visto alguma vez. **Monotônico**: nunca volta a
  escurecer. É progresso do jogador e **entra no save**.
- `visivel` — está sendo visto **agora**. **Derivado**, recomputado dentro de
  `step()` a partir das posições das unidades e dos prédios mais o raio de
  `data/units.json`. Não precisa ser salvo: sai idêntico depois do load, porque
  deriva de estado determinístico.

**Quem enxerga, e as duas lacunas que o Anexo A não cobre:**

- **Unidade militar**: raio da tabela do §12.2 — 9, e 18 para o Scout.
- **Civil**: **visão 9**, declarada em `data/units.json` como já está para os
  militares. Não é detalhe: sem isso a vila nasce dentro da própria névoa.
- **Prédio**: revela o próprio footprint mais um **raio pequeno fixo**. É a
  decisão conservadora: enquanto não existir torre de vigia, nenhum prédio
  ganha campo `visao` em `data/buildings.json`.

**Exploração não é objetivo.** Ver §8.2: nenhuma condição de vitória depende de
descobrir mapa.

**Duas consequências de implementação que precisam estar escritas antes de
alguém começar** (medidas em 2026-09-23, ver `PROGRESS.md`):

1. `descoberto` é uma camada de `largura × altura` e o `GameState` é JSON
   comparado byte a byte (F02, F23). O estado inteiro mede hoje **29 KB**; um
   `number[]` de um inteiro por tile são 4 096 entradas a 64² e **65 536 a
   256²**. A forma é **empacotada, 1 bit por tile** — 128 inteiros de 32 bits a
   64², 2 048 a 256² — e `visivel` **não se guarda**. Empacotamento é formato,
   não balanceamento: não fere a invariante 3.
2. Recompor `visivel` é limpar `largura × altura` e carimbar o disco de cada
   unidade, **todo tick**. É o mesmo formato de problema que o A* tinha antes da
   F17c: buffer do tamanho do mapa por operação. A saída é a mesma — buffer
   reaproveitado com marca de geração em vez de limpar, ou carimbo só de quem se
   moveu.

**Pré-requisito que ainda não existe: facção.** Névoa é por facção, e não há
`faccao` nem `dono` em `src/sim/state.ts` — todo prédio e toda unidade são do
jogador. Esse conceito chega com a IA inimiga (F28), e a névoa não é
implementável antes dele. Por isso esta seção não tem item na fila.

---

## 7. Interface

### 7.1 Estrutura do original [fonte]

Barra lateral com abas Build, Distribuição, Estatísticas e Opções, e painel
contextual do item selecionado abaixo.

### 7.2 Telas da nossa versão [proposta]

| Elemento | Conteúdo | Prioridade |
|---|---|---|
| Barra de recursos | Gold, Timber, Stone, comida total, população civil/militar | P0 |
| Menu Build | Prédios desbloqueados, custo, tooltip de entrada/saída; bloqueados em cinza com "requer X" | P0 |
| Planta fantasma | Segue o mouse, verde/vermelho, porta ao sul | P0 |
| Painel de prédio | Nome, HP ou progresso, ocupante, estoques, pausar, demolir, modo | P0 |
| Painel da Schoolhouse | Fila de 5 slots, botões por tipo, custo 1 gold | P0 |
| Alertas | Sem trabalhador, sem estrada, fome, mina esgotada, sob ataque | P1 |
| Painel do Storehouse | 28 mercadorias, quantidade e toggle aceitar/bloquear | P1 |
| Painel de grupo militar | Tipo, quantidade, condição, Halt/Split/Link/Formação/Feed/Storm | P1 |
| Aba Estatísticas | Prédios e trabalhadores por tipo; ociosos em destaque | P1 |
| Controle de velocidade | 1x, 2x, 3x | P1 |
| Aba Distribuição | Sliders por recurso disputado | P2 |
| Camada de névoa | Escuro no não-descoberto; inimigo só onde se vê agora (§6.5) | P1 |
| Minimapa | Terreno, prédios, unidades, câmera | P2 |

### 7.3 Regras de UI [proposta]

- Nenhum painel esconde o mapa por completo.
- Todo custo aparece antes da ação, nunca só depois do erro.
- Todo alerta é clicável e leva a câmera ao problema.
- Mensagem em linguagem de jogador: "Sem estrada até o armazém", não
  "path unreachable".

---

## 8. Vitória e derrota

### 8.1 Original [fonte]

Campanha de 20 missões, de ~5 minutos a mais de 7 horas cada. Objetivos típicos:
construir a cidade e destruir o assentamento ou o exército inimigo; em algumas
missões, sobreviver a ondas de ataque. A derrota não é explicitada nas fontes.

### 8.2 Nossa versão [proposta]

- **Sandbox (MVP)**: sem vitória. Metas opcionais: "tenha 20 trabalhadores",
  "produza 50 pães", "treine 10 soldados".
- **Escaramuça**: vitória ao destruir Storehouse, Schoolhouse e Barracks inimigos
  e todas as tropas. Derrota ao perder os próprios Storehouse **e** Schoolhouse
  **e** todas as tropas. Peacetime configurável.
- **Exploração não é objetivo.** Descobrir mapa não conta para vitória nenhuma;
  a névoa (§6.5) é sobre informação, não sobre meta.
- **Duração-alvo de partida: 60 minutos.** É o número que justifica a escala de
  tempo da seção 11. Se o playtest mostrar partidas de 90 minutos, o problema é a
  escala, não o jogador.

---

## 9. Tema e guia de estilo visual

A mecânica é do Knights and Merchants. A ambientação é original: **sertão
nordestino em registro de cordel**. Nada nesta seção altera regra de jogo — os
ids da simulação seguem neutros (`quarry`, `serf`, `loaves`) e os nomes que o
jogador vê vêm de `data/theme-sertao.json`. Trocar de tema é trocar esse arquivo.

### 9.1 Premissas do tema

- **Época atemporal**, sem data. Registro de literatura de cordel, não
  reconstituição histórica. Arma de fogo existe, mas é rara e cara.
- **Dois bandos rivais** disputando o mesmo sertão. Não é cangaceiro contra
  polícia — a escolha evita tomar partido num tema historicamente contestado e,
  de quebra, corta a conta de arte quase pela metade: **mesma arquitetura e
  mesmos sprites para os dois lados**, mudando só a cor do lenço e da bandeira.
- **Nenhum nome, pessoa ou episódio histórico real.** Bandos fictícios.
- **Nomenclatura regional na UI** (bodega, roçado, gibão, cuscuz), com glossário
  obrigatório no tutorial.

### 9.2 Como o tema se encaixa nas cadeias

Três pontos onde a tradução exigiu decisão, registrados para não serem
redecididos:

1. **Carvão** continua vindo de uma jazida, não de carvoaria que queima lenha.
   Carvão vegetal seria mais fiel ao sertão e dobraria a demanda de lenhador,
   quebrando as proporções da seção 4.5. Fidelidade mecânica venceu.
2. **Armas de fogo** ocupam o lugar dos projéteis do original: bodoque no lugar
   do arco, bacamarte no lugar da besta. O topo corpo a corpo continua sendo a
   peixeira, não um fuzil — senão o pedra-papel-tesoura desaba.
3. **Armadura** vira couro, e aqui a tradução é melhor que o original: o gibão
   de couro do vaqueiro é literalmente armadura de couro, usada contra os
   espinhos da caatinga. O tier superior é gibão reforçado com peitoral de couro
   cru — licença poética dentro do vocabulário.

### 9.3 Perspectiva e grid

- **Top-down 3/4 sobre grid ortogonal**, como no jogo original. O terreno é um
  grid de tiles quadrados visto de um ângulo elevado; a arte é desenhada em
  ângulo, mas o grid por baixo é quadrado. **Não é isométrico**: nada de tiles
  em losango.
- **Tile**: 64×64 px. Um prédio N×M ocupa N×M tiles, retangular.
- **Ancoragem**: borda inferior do footprint.
- **Câmera**: fixa, sem rotação de mundo. Zoom apenas.
- **Elevação de terreno está fora de escopo.** No original, diferença de altura
  maior ou igual a 25 entre os vértices de um tile impedia andar e construir
  estrada, e 18 impedia casas **[fonte]**. Registrado para o futuro.

### 9.4 Aparência

- **Luz**: de cima à esquerda. Sombra para baixo e à direita, sempre.
- **Paleta** (valores em `data/theme-sertao.json`): terra e ocre no chão,
  terracota mais alaranjada que a europeia nas telhas, branco de cal nas
  paredes, bege de algodão cru nas roupas, verde-acinzentado seco na vegetação,
  azul intenso no céu. Nada saturado.
- **Arquitetura**: taipa de mão com estrutura de madeira aparente, reboco caiado,
  telha colonial, porta e janela em cor forte.
- **Vegetação**: mandacaru, xique-xique, juazeiro, umbuzeiro, facheiro,
  macambira. As silhuetas verticais dos cactos são o marco de terreno do jogo —
  leem melhor em top-down que árvore genérica.
- **Contorno**: escuro e sutil, não preto puro, não ausente.
- **Escala**: a altura de um civil equivale aproximadamente à altura de uma
  porta. Toda proporção de prédio se ancora nisso.
- **Fundo**: transparente. Nenhum cenário embutido no sprite do prédio.

### 9.5 Personagens

- Civis usam **chapéu de palha**; militares usam **chapéu de couro de aba
  virada**. A silhueta do chapéu é o que distingue civil de militar a 32 px, e é
  a decisão de arte mais importante do projeto.
- Civis são **um corpo com uma ferramenta diferente na mão**, não catorze
  personagens. Modele e anime o corpo uma vez; troque a camada de item. O
  original fez assim, e é por isso que os aldeões dele parecem primos.
- **Direções**: 8 para militares — a direção é regra de jogo, porque projétil só
  sai para onde a unidade está virada — e 4 para civis na primeira versão. Subir
  civis para 8 é polimento, não bloqueio.
- Com espelhamento horizontal, 8 direções custam 5 desenhos: norte, nordeste,
  leste, sudeste, sul. O lado oeste é o espelho.

### 9.6 Estados de prédio

Três imagens por prédio: marcação no chão, estrutura de madeira, completo.
Variante danificada entra na Fase C.

### 9.7 Interface

A UI usa outro registro: **xilogravura de cordel** — alto contraste, preto sobre
papel, traço grosso. O mundo é colorido e detalhado; a interface é gráfica. Os
dois registros não competem, e a xilogravura é justamente o estilo que
ferramentas de geração reproduzem bem, por ser gráfico e não exigir coerência de
ângulo.

### 9.8 Áudio

Rabeca, zabumba, viola de dez cordas, triângulo e pífano. Ambiente de vento
seco, cigarra, sino da bodega, carro de boi. Efeitos de martelada, machado,
ponteiro na pedra, tiro de bacamarte, berro de bode.

O áudio é o melhor retorno por hora do projeto: não exige coerência entre peças,
como sprite exige, e o jogo *soa* nordestino antes de *parecer*.

### 9.9 Produção de arte

- **Imagem base versionada**: nenhum asset nasce de prompt solto. Cada
  personagem e cada prédio tem um PNG canônico em `assets/base/`; tudo o mais
  deriva dele por referência de estilo, rotação ou inpainting. Guarde o id ou a
  semente junto.
- Nenhum asset do jogo original, em nenhuma forma, inclusive como referência de
  transferência de estilo.
- Licença de todo pack de terceiros registrada em `assets/manifest.json`.

## 10. Feedback e sensação [proposta]

Cada item é verificável em screenshot ou em evento emitido:

- Planta posicionada: som seco, marcação no mesmo frame do clique.
- Estrada sendo arrastada: prévia tile a tile, com o custo acumulado no cursor.
- Serf entregando: o sprite carrega visivelmente o recurso que está levando.
- Martelada: partícula de poeira e som a cada incremento de HP.
- Prédio concluído: fumaça na chaminé, som, e o botão novo do menu piscando uma vez.
- Recurso entrando no armazém: número do HUD com pulso curto.
- Fome: ícone sobre a cabeça do civil antes de ele sair para comer.
- Erro: a planta vermelha diz **por que** não pode, em uma linha, ao lado do cursor.

---

## 11. Balanceamento e configuração

### 11.1 Escala de tempo

O KaM original é lento de propósito, com partidas de horas. Um jogo de browser
não tem esse luxo. Comprimimos o tempo, mas **não com um multiplicador único**,
porque o tempo de reação do jogador não escala junto com a economia.

Quatro grupos, em `data/time.json`:

| Grupo | Escala | Afeta |
|---|---|---|
| `economia` | 2.0 | produção, condição, fome |
| `movimento` | 2.0 | velocidade de deslocamento |
| `construcao` | 2.0 | nivelamento, marteladas, treino na escola |
| `combate` | 1.5 | cadência de ataque, duração do storm |

O combate é mais conservador de propósito: comprimir combate na mesma proporção
da economia torna o microgerenciamento impossível.

**Duas regras que sustentam isso**, detalhadas no `CLAUDE.md`:

1. A conversão de segundos para ticks acontece **uma vez, no carregamento**, com
   arredondamento para inteiro. Converter em tempo de execução quebra o
   determinismo e destrói o oráculo de teste.
2. **Velocidade de jogo** (1x, 2x, 3x escolhido pelo jogador) é outra coisa: ela
   acelera o relógio, não o balanceamento. Nunca misturar as duas.

Ajustar o ritmo depois é editar um número. Nenhuma recodificação.

### 11.2 Produção

Taxas em `data/production.json`, expressas em **unidades por minuto na escala
1.0**. Escolhemos essa unidade porque é a única em que existe medição pública: a
comunidade mediu as taxas do Remake para balancear a IA construtora, rodando
mapas com suprimento infinito por 2 horas e dividindo o total por 120 — valores
que incluem até o tempo que o trabalhador gasta indo comer **[fonte]**.

Dois pontos herdados dessa medição **[fonte]**: a granja de porcos produz cerca
de 0,5 porco por minuto, com 4 alimentações e o abate, e precisa de 1,63 fazenda
para se sustentar; e o valor da serraria é em tábuas, não em troncos — como um
tronco vira duas tábuas, é preciso dividir por dois para calcular a demanda de
lenhador. Essa é a armadilha de leitura mais provável do projeto.

Todo o resto é **[proposta]** a calibrar contra as proporções da seção 4.5.
Uma inconsistência está registrada no próprio arquivo: a taxa do açougue honra a
proporção 3:1 documentada, mas resulta em salsicha mais rápida do que relatos da
comunidade sugerem. Resolver na F20.

### 11.3 Condição e fome

No KaM a condição é medida em **tempo de jogo**: uma nota de versão do Remake
descreve o ajuste em "cerca de 12 minutos a menos de condição" **[fonte]**. E
jogadores relatam que as tropas ficam com fome por volta de 1h21 de partida
**[fonte]** — tempo incompatível com uma sessão de browser.

Valores em `data/condition.json`, escala `economia`:

| | Base (escala 1.0) | Efetivo (escala 2.0) |
|---|---|---|
| Condição cheia, civil | 40 min | **20 min** |
| Condição cheia, militar | 60 min | **30 min** |

Alerta visual a 35%, o civil sai para comer a 50%, morre a 0%.

### 11.4 Combate

A mecânica do original não é dano, é chance de acerto: aproximadamente
`ChanceToHit = (Attack × Direction) / Defence`, com cada acerto tirando um ponto,
unidades a pé morrendo no terceiro golpe e montadas no quarto **[fonte]**.

Duas consequências que corrigem leitura comum da tabela do Anexo A:

- **HP não é vida, é número de golpes até morrer.**
- **Attack não é dano, é chance de acerto.**

Por isso um miliciano consegue, com sorte, matar um cavaleiro — e os próprios
desenvolvedores registram que o Remake pode ser aleatório demais nos resultados
de batalha **[fonte]**.

Nossa fórmula, em `data/combat.json`:

```
attackEfetivo   = alvo montado e attackVsCavalo > 0 ? attackVsCavalo : attack
chanceAcerto    = clamp( (attackEfetivo × multiplicadorDirecao) / (defence × 100), 0.08, 0.92 )
multiplicadorDirecao = frente 1.0 · flanco 1.35 · costas 1.75
```

E a correção que de fato reduz a sorte: **HP dobrado e cadência de ataque
dobrada**. O tempo até a morte fica igual e a variância cai pela metade, porque
o resultado passa a depender de o dobro de dados jogados. O clamp sozinho quase
não muda nada — com a fórmula original um espadachim já acerta 55% contra um
miliciano que acerta 11,7% contra ele; o problema nunca foi a média, foi a
amostra pequena.

A coluna "vs Cavalo" do Anexo A é um valor de Attack **alternativo** usado quando
o alvo é montado, não um bônus percentual.

### 11.5 Onde cada coisa mora

| Arquivo | Conteúdo |
|---|---|
| `data/time.json` | escalas de tempo, tick, velocidade de jogo |
| `data/buildings.json` | footprint, custo, HP, desbloqueio, trabalhador, construção |
| `data/production.json` | taxas, insumos, proporções de referência |
| `data/units.json` | civis e militares: velocidade, golpes, attack, defence, visão |
| `data/combat.json` | fórmula, direção, clamp, multiplicador de HP, torre, storm |
| `data/condition.json` | durações, limiares, restauração por comida, Inn |
| `data/delivery.json` | escada de prioridade, desempate, reserva |
| `data/terrain.json` | tile, estrada, campos, custos de movimento, pathfinding |
| `data/economy.json` | estado inicial, escola, armazém, mercadorias |

Nenhum desses números pode aparecer em código.

---

## 12. Anexo A — Unidades militares

### 12.1 Requisitos na Barracks [fonte]

| Unidade | Requisitos (sempre + 1 Recruit) |
|---|---|
| Militia | Hand axe |
| Axe fighter | Hand axe + Leather armor + Wooden shield |
| Sword fighter | Sword + Iron armor + Iron shield |
| Bowman | Longbow + Leather armor |
| Crossbowman | Crossbow + Iron armor |
| Lance carrier | Lance + Leather armor |
| Pikeman | Pike + Iron armor |
| Scout | Hand axe + Leather armor + Wooden shield + Horse |
| Knight | Sword + Iron armor + Iron shield + Horse |

Town hall, mercenários pagos em ouro e prontos na hora **[fonte]**: Rebel 2,
Rogue 3, Vagabond 5, Barbarian 7, Warrior 8.

### 12.2 Atributos [fonte]

Lembrete: **HP = golpes até morrer**; **Attack = chance de acerto**.
Velocidade na notação interna do Remake; a razão 1:1,666 é o que importa.

| Unidade | HP | Ataque | vs Cavalo | Defesa | Velocidade | Visão |
|---|---|---|---|---|---|---|
| Militia | 3 | 35 | 0 | 1 | 0.1000 | 9 |
| Axe fighter | 3 | 35 | 0 | 2 | 0.1000 | 9 |
| Sword fighter | 3 | 55 | 0 | 3 | 0.1000 | 9 |
| Bowman | 1 | 60 | 0 | 2 | 0.1000 | 9 |
| Crossbowman | 1 | 120 | 0 | 3 | 0.1000 | 9 |
| Lance carrier | 3 | 25 | 60 | 2 | 0.1000 | 9 |
| Pikeman | 3 | 35 | 80 | 3 | 0.1000 | 9 |
| Scout | 4 | 35 | 0 | 2 | 0.1666 | 18 |
| Knight | 4 | 55 | 0 | 3 | 0.1666 | 9 |
| Barbarian | 4 | 75 | 0 | 2 | 0.1000 | 9 |
| Rebel | 3 | 25 | 50 | 1 | 0.1000 | 9 |
| Rogue | 1 | 60 | 0 | 1 | 0.1000 | 9 |
| Warrior | 4 | 75 | 0 | 2 | 0.1000 | 9 |
| Vagabond | 4 | 35 | 0 | 1 | 0.1666 | 9 |

Pedra-papel-tesoura: lanceiros e piqueiros levam bônus contra cavalaria;
cavalaria é rápida e flanqueia arqueiros; arqueiros castigam infantaria lenta
**[fonte/geral]**.

---

## 13. Anexo B — O que este jogo não é [proposta]

Lista de recusa. Se uma ideia cair aqui, sai de escopo sem discussão.

- Não é um city builder pacífico: o conflito existe e a economia serve a ele.
- Não é reconstituição histórica: nenhum nome, pessoa ou episódio real.
- Não é cangaceiro contra polícia: são dois bandos fictícios rivais.
- Não é medieval europeu. Nada de castelo, cota de malha, espada longa ou gótico.
- Não tem controle direto de civil, em nenhuma circunstância.
- Não é isométrico. Grid ortogonal, arte em 3/4.
- Não tem elevação de terreno no escopo atual.
- Não tem construção instantânea nem compra de prédio pronto.
- Não tem limite de população por casa: a comida é o limite.
- Não tem multiplayer no escopo atual.
- Não tem geração procedural de mapa no MVP: mapas feitos à mão.
- Não reutiliza nenhum asset do jogo original.

---

## Fontes

- [Knights and Merchants: The Shattered Kingdom (Wikipedia)](https://en.wikipedia.org/wiki/Knights_and_Merchants:_The_Shattered_Kingdom)
- KaM Remake Wiki: [Buildings](https://kamremake.wiki.gg/wiki/Buildings), [Units](https://kamremake.wiki.gg/wiki/Units), [Military](https://kamremake.wiki.gg/wiki/Military), [Food](https://kamremake.wiki.gg/wiki/Food), [Serf](https://kamremake.wiki.gg/wiki/Serf), [Laborer](https://kamremake.wiki.gg/wiki/Laborer), [Building ratios](https://kamremake.wiki.gg/wiki/Building_ratios), [Building strategies guide](https://kamremake.wiki.gg/wiki/Tutorial:_Building_strategies_guide)
- [KaM Remake: comparação com o original](https://www.knightsandmerchants.net/information/kam-remake/comparison) — prioridade do serf, vinho 20% → 30%
- [KaM Remake: histórico de versões](https://www.knightsandmerchants.net/information/kam-remake/version-history) — condição em minutos, distância de caminho
- [Fórum: Wares Production Time](https://knightsandmerchants.net/forum/viewtopic.php?t=2081) — medição de recursos por minuto
- [Fórum: Damage formula](https://knightsandmerchants.net/forum/viewtopic.php?t=2492) — chance de acerto
- [Fórum: Hunger Mutator](https://knightsandmerchants.net/forum/viewtopic.php?t=1490) — fome das tropas por volta de 1h21
- [Fórum: Effect of heights on walking/building](https://www.knightsandmerchants.net/forum/viewtopic.php?p=15146) — limites de elevação
- [PCGamingWiki: Knights and Merchants](https://www.pcgamingwiki.com/wiki/Knights_and_Merchants) — perspectiva top-down
- [MobyGames: Isometric vs. Top-Down](https://www.mobygames.com/forum/4/thread/198549/isometric-vs-top-down-again/) — grid quadrado com arte em ângulo
- [Steam Community: Gameplay Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=1227250653) · [KaM Remake FAQ](https://www.kamremake.com/faq/)
