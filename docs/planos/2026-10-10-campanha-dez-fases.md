# A campanha em dez fases: o desenho (I-TERRENO-CAMPANHA-DEZ-FASES-DESENHO)

Pedido do operador (2026-10-10): ler no KaM Remake como uma fase é construída (os desafios, o
estilo de cenário, a posição da vegetação e dos recursos naturais) e criar dez fases para o jogo,
adaptadas ao sertão, com os mapas prontos para editar no Tiled.

A narrativa, os nomes e o que cada missão pede já estão em `pianco-campanha-10-missoes.md` (F22). Este
documento não reescreve a história: ele transforma cada missão em **mapa e dado de missão**.

**O que vem do KaM e o que não vem.** O clone (`D:\projetos-pessoal\kam_remake`, `731a8a4`) tem o
código que lê e roda uma missão e uma campanha. Ele **não** tem os mapas das campanhas, que vêm com os
dados do jogo. E o CLAUDE.md §9 proíbe qualquer mapa do jogo de 1998, inclusive como referência de
transferência. Por isso a parte 1 cita só código, e os mapas da parte 3 são desenho nosso. O que é
princípio de desenho de mapa de RTS, e não vem do clone, está marcado **[princípio]**.

---

## 1. Como o KaM monta uma missão (citações do clone)

**O roteiro da missão é uma lista de comandos.** O tipo `TKMCommandType`
(`src/mission/KM_MissionScript.pas:15`) e os textos dos comandos (`src/mission/KM_MissionScript.pas:85-144`)
mostram as quatro camadas de uma fase:

| Camada | Comandos do KaM | Linha |
|---|---|---|
| O mapa | `SET_MAP` (o arquivo de terreno à parte) | `KM_MissionScript.pas:85` |
| O que cada lado tem no começo | `SET_HOUSE`, `SET_UNIT`, `SET_GROUP`, `SET_STREET`, `SET_FIELD`, `SET_STOCK`/`ADD_WARE` | `:90`, `:110`, `:125`, `:111`, `:112`, `:116` |
| O que o jogador pode construir | `BLOCK_HOUSE`, `RELEASE_HOUSE`, `BLOCK_UNIT` | `:105`, `:106`, `:104` |
| Vitória e derrota | `ADD_GOAL`, `ADD_LOST_GOAL` | `:108`, `:109` |
| O inimigo | `SET_AI_START_POSITION`, `SET_AI_DEFENSE`, `SET_AI_ATTACK`, `ATTACK_POSITION` | `:142-144`, `:128` |

**Dois tipos de objetivo.** `TKMGoalType` (`src/mission/KM_MapTypes.pas:20-24`): o de vitória ("tem de
ser verdade para vencer") e o de sobrevivência ("tem de continuar verdade, senão perde"). O `ADD_GOAL`
cria o de vitória (`src/mission/KM_MissionScript_Standard.pas:728-741`) e o `ADD_LOST_GOAL` o de
sobrevivência (`src/mission/KM_MissionScript_Standard.pas:744`).

**As condições são poucas e sobre coisas do mundo.** `TKMGoalCondition`
(`src/mission/KM_MapTypes.pas:27-38`): destruir os prédios-chave de um lado, destruir as tropas, os
ativos militares, ou deixar passar um tempo. O próprio código comenta que dá para criar condições novas
("We can come up with our own", `KM_MapTypes.pas:37`). As que o KaM ainda aceita estão em
`GOALS_SUPPORTED` (`src/mission/KM_MapTypes.pas:55`).

**Dois modos de missão.** `TKMissionMode = (mmBuilding, mmFighting)` (`src/mission/KM_MapTypes.pas:42`).
O `SET_TACTIC` põe a missão em modo de luta (`src/mission/KM_MissionScript_Standard.pas:231-234`): o
jogador comanda só a tropa que recebeu, sem economia.

**O que se pode construir é tirado, não dado.** O `BLOCK_HOUSE` tranca um prédio para aquele lado
(`src/mission/KM_MissionScript_Standard.pas:581-584`). A árvore de desbloqueio continua valendo, e a
missão restringe por cima. É a "camada de permissão por fase" do GDD (§ do armazém adicional).

**A campanha libera uma missão por vez.** `TKMCampaign.UnlockNextMission`
(`src/mission/KM_Campaigns.pas:990-995`) marca a missão como vencida e libera a seguinte.

---

## 2. O nosso vocabulário de missão (derivado da parte 1)

Cada fase é um arquivo `data/campanha/fase-NN-<local>.json` com:

- **`mapa`**: o mesmo formato do `data/maps/sertao-128.json` (`largura`, `altura`, `legenda`,
  `linhas`, `recursos`), 128x128 (o `terrain.mapaPadrao` de hoje).
- **`modo`**: `construir` (`mmBuilding`) ou `lutar` (`mmFighting`, só a tropa inicial).
- **`lados`**: o jogador (lado 0) e cada inimigo, com `predios` (id, gx, gy), `unidades` (tipo,
  quantidade, ponto) e `estoque`. É o `SET_HOUSE`/`SET_UNIT`/`SET_GROUP`/`SET_STOCK`.
- **`libera`**: os prédios e tropas que a fase acrescenta ao que as anteriores liberaram (o
  `RELEASE_HOUSE` acumulado). O que não está liberado até a fase fica trancado (o `BLOCK_HOUSE`).
- **`objetivos.vitoria`** e **`objetivos.derrota`** (o `ADD_GOAL` e o `ADD_LOST_GOAL`), com as
  condições:

| Condição | Sentido | Origem |
|---|---|---|
| `destruir` (`lado`, `alvo`: prédios, tropas, ou ids) | vitória | `gcBuildings`, `gcTroops` |
| `perder` (`predios` ou `tropas`) | derrota | os mesmos, no `ADD_LOST_GOAL` |
| `sobreviver` (`ondas`) | vitória | `gcTime` com ataques marcados |
| `manter` (`predio`, `segundos`) | vitória | condição nova (o KaM permite, `KM_MapTypes.pas:37`) |
| `proteger` (`predio`) | derrota se cair | condição nova |
| `capturar` (`unidade`) | vitória | condição nova (pede regra de sim) |
| `prazo` (`segundos`) | derrota | condição nova |

- **`ondas`**: os ataques marcados (`SET_AI_ATTACK`/`ATTACK_POSITION`): quando, de onde, quem.
  Durações em segundos na escala 1.0, grupo `combate`, como manda o CLAUDE.md §5.
- **`desafio`** e **`narrativa`**: o texto, que vem do `pianco-campanha-10-missoes.md`.

A camada de missão **não roda ainda**: este vocabulário é o contrato para o item de sim que vai
ler os objetivos, as ondas e o desbloqueio por fase.

---

## 3. As dez fases

**Convenções de mapa [princípio].**
- O início do jogador sempre tem, a poucos tiles, árvore e pedra para os dois primeiros prédios,
  e nunca minério: o minério fica longe e pede expansão.
- Entre o jogador e o inimigo há sempre um passo, e o passo é o desafio da fase.
- Na caatinga a vegetação é esparsa, em manchas, e no brejo (fase 6) é densa.
- A pedra fica em lajedos (rocha rasa) e na rocha ao pé da serra.
- O minério fica no anel de rocha em volta da montanha, como no `sertao-128`.
- O peixe fica na água a um passo da margem.
- O roçado (campo arado) fica perto da água.
- A cana fica em manchas de chão bom, só do brejo para o litoral.

**Os ids.** Os nomes do documento da campanha (escola, couto, monjolo) correspondem aos ids da sim
pelo `theme-sertao.json`. Os prédios que o documento não cita (Canavial, Torre de Pedra, Igreja,
Açude) entram nas fases marcados **[proposta]**, para o operador confirmar.

| Fase | Local | Modo | Vitória | Derrota | Libera |
|---|---|---|---|---|---|
| 1 | Piancó | construir | destruir o acampamento do Cabo Branco | perder Armazém e Casa do Coronel | schoolhouse, quarry, woodcutters, sawmill, inn, barracks, weapons_workshop; Cabra (militia) |
| 2 | Patos | construir | destruir o entreposto | perder a vila; prazo | farm, mill, bakery, swine_farm, butchers, tannery, armory_workshop; Cabra de Gibão, Bodoqueiro |
| 3 | Soledade | construir | destruir os dois postos | perder as tropas | gold_mine, coal_mine, metallurgists |
| 4 | Boqueirão | construir | sobreviver a seis ondas | perder o Açude | fishermans; Aguilhadeiro; **[proposta]** reservoir, watchtower |
| 5 | Campina Grande | construir | manter a Feira | perder a Feira ou a vila | marketplace, armazém adicional |
| 6 | Areia | construir | destruir a Fundição inimiga | perder as tropas | iron_mine, iron_smithy; **[proposta]** wineyard |
| 7 | Itabaiana | lutar | capturar Vicente no posto de comando | perder as tropas | weapon_smithy, armor_smithy; Valente, Ferrão, Cabra de Fogo |
| 8 | Santa Rita | construir | destruir engenhos, celeiros e cocheiras | prazo | stables; Vaqueiro, Capitão do Bando |
| 9 | João Pessoa | lutar | tomar a cidade | a Casa do Coronel inimiga cair; perder as tropas | town_hall (os jagunços pagos); **[proposta]** church |
| 10 | Cabedelo | lutar | tomar o forte antes do embarque | prazo (o navio parte) | nada |

### Fase 1 — Piancó: "O que é nosso"
- **Mapa:** caatinga aberta, chão de terra (grama) com areia em manchas. O jogador está no noroeste.
  No centro fica o **Olho d'Água**: uma cacimba (lago pequeno, com peixe), e o acampamento do Cabo
  Branco a leste dela. As árvores ficam em manchas esparsas em volta do início. A pedra é **um
  lajedo só**, pequeno, perto do início: "pedra é o gargalo". Uma serra baixa a sudeste guarda o
  mapa e não tem minério.
- **Inimigo:** um acampamento (quartel e armazém) com uma guarda pequena. As três ondas pequenas vêm
  pelo leste, espaçadas para dar tempo de treinar.

### Fase 2 — Patos: "A aliança"
- **Mapa:** um riacho seco (areia com poços de água) corta o mapa de oeste a leste. A **terra boa**
  (campo arado) fica na margem, do lado do jogador: é a cadeia de comida. O entreposto do Cabo Branco
  fica do outro lado, a nordeste, e há **dois vaus**: o riacho só se atravessa nas passagens de areia
  entre os poços. A pedra e a árvore são médias.
- **Inimigo:** o entreposto (armazém, quartel, um roçado). Há prazo: a derrota vem se o tempo acabar.

### Fase 3 — Soledade: "Cavalo é bicho de rico"
- **Mapa:** um **corredor**. Duas serras, ao norte e ao sul, deixam um vale de oeste a leste, e o
  **desvio** (a passagem) estreita no meio, onde ficam os dois postos. Pelas serras há dois **atalhos**
  estreitos, que são o flanco por onde os Vaqueiros chegam. O ouro e o carvão ficam no pé da serra do
  lado do jogador, que acabou de liberar o garimpo. Tem muita pedra.
- **Inimigo:** dois postos (torre e quartel) no estreito, e três Vaqueiros que atacam pelo atalho.

### Fase 4 — Boqueirão: "Água parada"
- **Mapa:** o **açude grande** ocupa o centro-norte (muito peixe). A vila fica na margem sul,
  **cercada de serra**: há uma entrada larga ao sul e duas estreitas, a oeste e a leste. Não há para
  onde crescer. Tem pouca terra de roçado e pouca árvore: o peixe segura a vila.
- **Inimigo:** não tem vila no mapa. São seis ondas, que vêm pelas três entradas.

### Fase 5 — Campina Grande: "A feira"
- **Mapa:** um **planalto aberto** (o agreste), com muita grama e caminhos em todas as direções. A
  **Feira** fica no centro, já construída e do jogador. A vila do jogador fica a oeste. O assédio vem
  do norte e do leste. Há dois lajedos e terra de roçado espalhada: o desafio é manter duas rotas.
- **Inimigo:** sem base no mapa. Grupos pequenos e constantes cortam a estrada e caçam o carregador.

### Fase 6 — Areia: "O brejo"
- **Mapa:** o **brejo**: verde, mata densa e dois **córregos** com peixe. Há manchas de **cana** e
  serra a leste, com **ferro** e carvão. A Fundição inimiga fica atrás da serra, a leste, e se chega
  a ela por um vale.
- **Inimigo:** a fundição e a vila dela, com Valentes e dois Cabras de Fogo. O jogador ainda não tem
  arma de ferro: vence pelo número, pelo terreno e pela investida.

### Fase 7 — Itabaiana: "O que ela estava fazendo"
- **Mapa:** o posto de comando fica no centro-leste, num morro cercado de rocha, com duas entradas.
  A **rota de fuga** sai do posto para leste, por um caminho entre serras até a borda do mapa. O
  jogador começa a oeste com **dois grupos**: um vai ao posto e o outro corta a fuga.
- **Inimigo:** a guarda do posto e Vicente (a unidade a capturar, ainda sem regra de sim).

### Fase 8 — Santa Rita: "Cortar a cana"
- **Mapa:** a **várzea** do litoral, com canaviais grandes (cana) em quase todo o mapa e o rio ao sul.
  Os **quatro alvos** ficam longe uns dos outros: dois engenhos (moinho), o celeiro (armazém) e a
  cocheira. O jogador começa no noroeste, com cavalaria. O prazo é curto.
- **Inimigo:** Aguilhadeiros guardando os alvos, que é a resposta à cavalaria.

### Fase 9 — João Pessoa: "Casa de tijolo"
- **Mapa:** a **capital** murada. O muro é de rocha, com um portão (o que Januária abre) e uma
  passagem estreita. Dentro, as ruas são estreitas (corredores de 1 a 2 tiles entre quarteirões de
  rocha) e as torres ficam nos cantos. A **Casa do Coronel** inimiga fica no meio e não pode cair.
- **Inimigo:** torres, a guarnição e a Casa do Coronel protegida.

### Fase 10 — Cabedelo: "Onde o rio acaba"
- **Mapa:** o **litoral**. O mar ocupa a borda leste e o rio desce do oeste até a barra. O **forte**
  fica numa península ao norte da barra, e o **ancoradouro**, na praia de areia ao sul. São duas
  frentes, e o jogador começa a oeste com tropa insuficiente para as duas.
- **Inimigo:** todas as unidades do jogo, o forte (quartel e torres) e o ancoradouro.

---

## 4. O que fica para depois (não é desta leva)

- **A camada de missão na sim:** escolher a fase, rodar as ondas, avaliar os objetivos e trancar o que
  a fase não libera. É sim, com aceite próprio, e com as decisões do operador. Por exemplo, o
  "capturar" da fase 7 e o "navio" da fase 10 não têm regra hoje.
- **O mapa maior (fase 8):** depende de o tamanho do mundo deixar de ser um só (`terrain.mapaPadrao`).
- **O terreno de brejo (fase 6):** hoje o vocabulário de terreno não tem "brejo". A fase usa grama,
  mata densa e córregos. Um tipo novo de chão seria arte e regra novas.
