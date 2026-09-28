# Plano — D1: civis colidem (levantamento e custo, ANTES de código)

> **Sigla nova (2026-09-28, `docs/siglas.md`): D-MOVIMENTO-01 (colisão civil).** Sub-itens: 01a (antes D1a), 01b (D1b), 01c (D1a-2), 01d (D1a-3), 01e (D1c), 01f (D1d). O nome deste arquivo fica, porque o PROGRESS o cita.

Pedido do operador (2026-09-28): *"As unidades civis colidem entre si. O congestionamento de
serfs é mecânica do jogo [...] Corrija o GDD e implemente. Antes de escrever código, leia no
kam_remake COMO eles resolvem o encontro."* **Status: espera o operador.** Nada foi escrito
em `src/`.

## 0. O GDD hoje
- §6.4: *"Civis não colidem entre si, para não travar a logística. Militares colidem."* Essa
  frase está no GDD desde a F03, e a F18f a cita como regra vigente.
- §5.4: *"Boa prática do original: estrada ao redor de todos os prédios desde cedo e pelo
  menos 2 rotas entre prédios relacionados **[fonte]**."* A boa prática está lá; o **porquê**
  (congestionamento) não está escrito.
- Portanto não é o código contradizendo o GDD: é o GDD tendo decidido "não colidem". A
  mudança reverte uma decisão de desenho.

## 1. Como o kam_remake resolve o encontro (fonte lida; caminhos relativos a `src/`)

### 1.1 O A* trata unidade como obstáculo? **Não, no caminho normal.**
- A colisão é resolvida **no passo de andar**: `TKMUnitActionWalkTo.DoUnitInteraction`
  (`units/actions/KM_UnitActionWalkTo.pas:1012-1080`), chamada a cada passo. Se o próximo tile
  tem unidade (`gTerrain.HasUnit`), o passo não sai até a interação se resolver.
- O A* só olha unidades no **modo desvio** (`Route_MakeAvoid`,
  `pathfinding/KM_PathFinding.pas:186-230`, `MovementCost :278-306`), e mesmo assim por
  **custo**, não como parede:
  - tile com unidade **ocupada** (ação `Locked`: trabalhando, entrando em casa): +200
    (20 tiles);
  - tile com unidade na estrada: +15 (1,5 tile). Quem está **andando** não pesa: o comentário
    é "se estamos andando, o pathfinding não deve rodear a gente"
    (`KM_Units.pas:2399-2401`, `PathfindingShouldAvoid`);
  - sair da estrada no desvio: +25.
- **Consequência para nós:** o A* e o cache dele ficam como estão. A colisão entra em
  `andar`, onde a C5 já pôs a dos militares.

### 1.2 Dois se encontrando num corredor de 1 tile
As constantes estão em `KM_UnitActionWalkTo.pas:119-131`. Um tick do KaM tem 100 ms.

| Situação | Solução | Espera antes |
|---|---|---|
| O outro vem **de frente** (o próximo tile dele é o meu) | **troca**: os dois "se atravessam" logicamente e andam lado a lado no desenho (`IntSolutionExchange`, `:754-815`) | **0 ticks** |
| O outro está **parado à toa** (Stay, sem `Locked`) | **empurra**: ele vai a um tile livre por `GetOutOfTheWay` (`IntSolutionPush`, `:713-751`) | 1 tick |
| Um vizinho do meu alvo quer trocar comigo | troca com ele (`IntSolutionDodge`) | 5, e depois a cada 8 |
| O outro está **ocupado** (`Locked`) | **replaneja** com `Route_MakeAvoid` (`IntSolutionAvoid`) | 10, e depois a cada 50 |
| Nada acima serviu | **passo para o lado**, para um tile livre junto do alvo (`IntSolutionSideStep`) | 10, e depois a cada 15 |
| Esperando há muito | entra em "esperando", e **outro pode forçar a troca com ele** | 40 |
| O destino está ocupado por quem trabalha | `fDestBlocked`: prioridade zero, espera até liberar, e pode ser empurrado ou trocado | ao replanejar |

- **Ninguém recua e ninguém desiste.** O andar nunca é cancelado por causa de unidade; só
  por obstáculo de terreno (`CheckForObstacle`, que refaz a rota).
- **Por isso, no KaM dois serfs de frente numa rua de 1 tile NÃO engarrafam:** eles trocam no
  mesmo tick. O engarrafamento do KaM vem de:
  - fila atrás de quem está parado ou devagar;
  - a porta, onde se entra e sai de casa (`TKMUnitActionGoInOut`: *"Unit is walking into
    house, we can wait"*);
  - o vértice diagonal ocupado (dois cruzando em X esperam);
  - quem trabalha em cima da rua (`Locked`).

### 1.3 Deadlock
- **Não há detector global.** O que impede o travamento é local:
  - a troca forçada com quem espera há 40 ticks;
  - o empurrado que não consegue sair tenta outra direção depois de 10 ticks
    (`IntCheckIfPushed`, `PUSHED_TIMEOUT`);
  - quem tem o destino bloqueado vira prioridade zero e aceita ser empurrado ou trocado.
- Como a troca só exige que o tile de um seja andável para o outro, **dois presos um contra o
  outro sempre acabam trocando**.

### 1.4 Militares e civis: a mesma regra?
- **A mesma.** O `WalkTo` é de todo `TKMUnit`, e só animal fica fora da interação
  (`:1043-1045`).
- **Diferença:** o militar não empurra nem troca com **inimigo** que queira lutar
  (`CheckForEnemy`, `:726-730` e `:766-770`): luta em vez disso.
- O `FEAT_UNIT_INTERACTION` está ligado (`common/KM_Defaults.pas:84`). O
  `FEAT_AVOID_UNITS_IN_PATH` (o +1,5 tile na estrada) eu **não localizei**: hipótese, não
  conferida.

## 2. O que existe aqui hoje (C5, só militares)
- Espera `ticksDesvioMilitar` (5 ticks) e depois faz um desvio por busca em largura, que
  trata militares como bloqueados.
- **Não tem troca nem empurrão.** Estendida a civis como está, **travaria na primeira rua de
  1 tile com serfs indo e voltando**, que é o caso mais comum da vila.

## 3. O custo

### 3.1 No A*
- **Nenhum, no caminho normal.** O cache por camada continua válido: unidade não entra na
  camada.
- **O desvio** (análogo ao `Route_MakeAvoid`) é uma busca **sem cache** com custo por
  unidade. Ela roda só depois de 1 s de bloqueio, e depois a cada 5 s. O custo se mede em nós
  expandidos (§8), nunca em relógio.
- **O desvio tem de respeitar o modo da tarefa.** O serf que só anda por estrada não pode
  desviar pela grama; a busca da C5 usa `livre` e precisaria receber o modo.

### 3.2 Quando a rota fecha no meio do caminho
- Por **unidade**: ninguém desiste, como no KaM. Há espera, troca, empurrão, desvio e, no
  fim, a troca forçada. A tarefa **não** é liberada por unidade no caminho.
- Por **terreno** (estrada demolida, prédio novo em cima): o caminho de hoje fica. O
  saneamento libera a tarefa (`caminho-cortado`) e a devolução anda.
- Um caso novo: **destino ocupado por quem está "dentro"** (veja 3.3).

### 3.3 Riscos de travamento que só existem aqui
1. **Especialista "dentro" do prédio fica no tile da porta.** Hoje o `trabalhando` para na
   porta (`systems/especialistas.ts:149`: *"descanso (dentro, trabalhando)"*). Com colisão,
   cada produtor ocupa uma porta para sempre. Vale o mesmo para quem está comendo na Bodega,
   o recruta na torre e o laborer martelando.
   - **Regra necessária:** unidade em estado "dentro" (trabalhando, comendo, ocupante,
     martelando no canteiro) **não ocupa tile para colisão**, como no KaM, onde ela está
     dentro da casa.
   - Essa lista de estados é o ponto mais frágil do item. Esquecer um estado é um
     travamento.
2. **A troca exige mexer em DUAS unidades**, e hoje `andar` devolve uma só. A troca tem de ser
   negociada no tick: a primeira salta para o tile da segunda, e a segunda salta quando o
   passo dela completar. Por alguns ticks as duas **dividem o tile**.
   - A invariante nova tem de aceitar a divisão **só** entre um par em troca. Qualquer outro
     empilhamento é defeito.
3. **O empurrão mexe na unidade parada.** Isso vira um sistema próprio que roda antes do
   movimento: quem está ocioso num tile que alguém quer é movido para um vizinho livre. É
   determinístico pela ordem de `unidades.ordem`.
4. **O serf ocioso se amontoa na porta do armazém.** Hoje eles esperam tarefa ali, e com
   colisão tapam a porta. O empurrão resolve, mas é o cenário de estresse do teste de
   travamento.

### 3.4 Nos testes
- **Pelo menos 21 arquivos de teste criam várias unidades em laço.** Vários as põem **no mesmo
  tile**: o meu F35 põe 20 serfs extras na mesma porta, e há o C7 e fixtures de produção.
  Com colisão, esses cenários passam a começar empilhados.
  - Resolver com o empurrão (que dispersa) muda os tempos deles.
  - Espalhar na fixture muda a fixture.
  - A contagem exata só sai rodando a suíte com a colisão ligada. Proponho isso como o
    primeiro passo medido.
- **A calibração da Fase B** (F-CAL-a, F-CAL-b1/b2, os ciclos e intervalos do oráculo, o
  "nenhum especialista ocioso por mais de 300 ticks" da F15b, as faixas do BALANCE_LOG) foi
  medida com unidades se atravessando.
  - Com colisão, o tempo de entrega **só pode subir ou ficar igual**.
  - Os testes que afirmam **teto** de espera ou **piso** de produção são os candidatos a
    reprovar.
  - Pela regra do BALANCE_LOG, isso é **recalibração em lote**, depois do mecanismo, nunca
    número a número. Não mexo em número de balanceamento neste item.
- **O que continua igual:** A* e custos (F10), cadência, combate e tudo que tem uma unidade
  só.

## 4. O que eu faria (sub-itens de uma sessão cada)
- **D1a — o mecanismo, desligado por dado.**
  - Faz:
    - estados "dentro" que não ocupam tile;
    - troca imediata com quem vem de frente;
    - empurrão do parado;
    - espera, desvio com o modo da tarefa e passo para o lado;
    - troca forçada depois da espera longa;
    - a chave `units.json: colisaoCivil.ligada` (começa `false`).
  - Com a chave desligada, a suíte fica igual, byte a byte.
  - Testes do mecanismo em cenários pequenos:
    - corredor de 1 tile com 2, 4 e 8 serfs em sentidos opostos;
    - porta com 10 ociosos;
    - destino ocupado;
    - diagonal.
  - Uma invariante nova no helper: nenhuma unidade "fora" parada em `bloqueado` além de
    N ticks, e nenhum par no mesmo tile fora de troca.
- **D1b — ligar e medir.**
  - Liga a chave e roda a suíte inteira.
  - Lista cada teste que mudou, separando mecanismo (fixture empilhada) de tempo
    (calibração).
  - Registra no BALANCE_LOG. Não ajusta número.
- **D1c — o aceite do operador.**
  - (1) congestiona: a mesma vila com muitos serfs entrega menos com uma rua que com duas;
  - (2) não trava: em 20 000 ticks da vila cheia, nenhuma unidade fica bloqueada além do
    teto da invariante, e a invariante reprova quando uma sonda tira a troca forçada.
- **D1d — a recalibração em lote**, se o D1b mostrar deriva: um item de balanceamento só.
- **O GDD** (§6.4 e §5.4) é corrigido no D1a, com o mecanismo acima e a fonte.

## 5. O risco que o operador apontou, dito com números
- **Hipótese** (a medir no D1c): pela troca do KaM, **dois serfs de frente não engarrafam**.
  A diferença de uma rua para duas vem da fila atrás de quem para: na porta, no carregar e
  entregar, no vértice diagonal.
- Se a nossa entrega na porta dura 1 tick, **o efeito pode sair pequeno**, e o aceite (1)
  pode não fechar sem outra fonte de parada. Nesse caso, prefiro medir e trazer o número a
  inventar demora na porta.

## 6. Execução do D1a e do D1b (aprovado pelo operador em 2026-09-28)
O operador decidiu:
- a troca de frente entra, como no KaM;
- quem está "dentro" não ocupa tile, e um teste percorre **todos** os estados de FSM e
  reprova estado sem classificação;
- a chave começa desligada, e desligada a suíte fica igual byte a byte;
- o D1b é trazido **antes** do D1c.

### Escopo do D1a (interpretação conservadora)
- **Quem colide:** civil com civil. O pedido diz "as unidades civis colidem entre si".
  - O militar continua com a C5, sem mudança.
  - Civil e militar continuam se atravessando.
  - PERGUNTA registrada no PROGRESS: unificar como no KaM?
- **Classificação** (`src/sim/colisao.ts`, `POSICAO_DO_ESTADO`): cada estado de FSM é
  `dentro` ou `fora`. Estado sem classificação, com a chave ligada, lança erro, como o
  `default` das FSMs. Um teste varre `src/sim` atrás de todo estado escrito ou comparado e
  reprova o que faltar.
  - Dentro:
    - especialista produzindo (`trabalhando`, `esperando_insumo`, `saida_cheia`);
    - comendo (`comendo`);
    - laborer no canteiro (`nivelando`, `esperando_material`, `martelando`).
  - Fora: o resto, **incluindo `carregando` e `entregando` na porta**. É a fila na porta
    do KaM (`GoInOut` ocupa a porta), e é a única fonte de engarrafamento que sobra depois
    da troca.
- **No passo** (`andar`), quando o passo completa e o tile seguinte tem civil "fora":
  - todos os ocupantes vêm para o meu tile → **troca**: entro agora, marco `trocaCom`, e o
    outro sai quando o passo dele completar;
  - senão, espero e conto `bloqueado`:
    - em `desviarDepois`, e a cada `repetirDesvio`: **desvio** por busca em largura, que
      evita os civis parados, no modo `estrada` se o caminho restante é todo de estrada,
      senão `livre`, com a mesma caixa e margem da C5. O passo para o lado do KaM fica
      contido no desvio: os dois contornam o tile ocupado, e não entra um segundo
      mecanismo;
    - em `trocaForcadaDepois`: **troca forçada**, em que entro no tile ocupado e marco
      `trocaCom`. Ninguém espera além disso, por construção;
  - `bloqueado` zera só num passo normal. O desvio não zera o contador, e é isso que
    garante o teto.
- **Empurrão** (`sistemaDoEmpurrao`, antes da fome e das FSMs):
  - o civil `ocioso` no tile que um civil bloqueado há `empurrarDepois` quer é movido
    para o primeiro vizinho livre;
  - vizinhança 8 em ordem fixa, e a ordem das unidades é `unidades.ordem`.
- **Dado:** `units.json colisaoCivil {ligada false, empurrarDepois 0,2 s, desviarDepois
  1,0 s, repetirDesvio 5,0 s, trocaForcadaDepois 4,0 s, margemDoDesvio 4}`, grupo
  `movimento`, registrado no schema. As constantes são as do KaM: 1, 10, 50 e 40 ticks
  de 100 ms. O empurrão é 0,2 s porque 0,1 s a 2,0× daria meio tick.
- **Invariante** (`violacoesDeInvariantes`, só com a chave ligada):
  - estado sem classificação reprova;
  - civil com `bloqueado` acima de `trocaForcada` reprova;
  - num tile com k civis "fora", pelo menos k−1 precisam ter `trocaCom` com alguém do
    mesmo tile.

### Testes do D1a (`tests/D1a-colisao-civil.test.ts`)
- **Classificação completa** pela varredura, com piso de quantidade para a varredura não
  ser vazia.
- **Chave desligada:** o `andar` e o `step` são byte a byte iguais ao código anterior. A
  prova é a suíte inteira, sem nenhuma mudança de teste.
- **Chave ligada:**
  - corredor de 1 tile com 2, 4 e 8 serfs em sentidos opostos: todos chegam, e a
    invariante fica limpa a cada tick;
  - porta com 10 ociosos: o empurrão abre caminho;
  - destino ocupado por um parado que não se empurra: a troca forçada entra no teto;
  - uma sonda que tira a troca forçada faz a invariante reprovar.

### D1b
- Ligar a chave, rodar a suíte inteira, desligar, e classificar cada teste que mudou.
- O resultado vai para o PROGRESS e o BALANCE_LOG. Nenhum número de balanceamento muda.

## 7. D1a-2: o empilhamento de fora do passo (decisões do operador, 2026-09-28)
O operador decidiu:
- as três correções entram;
- a terceira (sair de "dentro" para uma porta ocupada) **mede primeiro o esperar, como o
  KaM**. Dividir o tile só se justifica se o esperar segurar a produção de um jeito que
  apareça na vila, e aí fica registrado com o número;
- tick exato ganha um valor por estado da chave. A faixa foi recusada;
- os 3,3× no A* têm a causa medida. Se estiverem no JobBoard, o conserto é lá.

### Execução
1. **`trocaCom` sai do `fsmData` e vai para a `Unidade`** (campo opcional). As FSMs montam
   a unidade com `{ ...u, fsm, fsmData }`, então o campo sobrevive à transição de estado. O
   `andar` o limpa no próximo passo normal.
2. **O empurrão separa ociosos empilhados.**
   - O civil `ocioso`, parado, que divide o tile com outro civil fora da troca é empurrado
     para o primeiro vizinho livre.
   - Fica o primeiro na ordem de `unidades.ordem` que não é ocioso, ou o primeiro de todos.
3. **Sair de "dentro" espera a porta, como o KaM (`GoInOut`).**
   - Uma passada central no `step`, depois das FSMs, compara o estado de cada civil antes e
     depois:
     - quem **nasceu** neste tick, ou **passou de dentro para fora**;
     - e está num tile com outro civil fora;
     - ganha `saindo` (ticks de espera).
   - Enquanto está `saindo`:
     - não ocupa o tile para ninguém;
     - não dá passo (o `andar` segura);
     - não conta no empilhamento.
   - Com o tile livre, `saindo` some e a unidade sai.
   - **Teto:** passado `ticksTrocaForcada`, sai como na troca forçada, que é a mesma regra
     de todo bloqueado. Ninguém espera para sempre.
   - O ocioso `saindo` é empurrado na hora pelo item 2, porque não tem lugar para esperar.
   - Invariante: `saindo` nunca passa do teto.
4. **Medida do item 3 (sonda, antes de decidir):**
   - a vila da F-CAL com esperar, contra a mesma vila com dividir (a variante em sonda,
     sem commit);
   - o que se compara: os marcos, o cenário fechado e a maior e a soma das esperas de
     `saindo`.
5. **A causa dos 3,3×:**
   - contar as chamadas de `buscarCaminho` por origem (ociosos × tarefas × ticks) na F35(b),
     com a chave desligada e ligada;
   - se a causa for a procura de tarefa a partir de N tiles, o conserto é no JobBoard e vale
     também com a chave desligada.
6. **Tick exato:** F15a e F18d-1a passam a ter um valor esperado por estado da chave,
   medido depois do D1a-2.
7. **Repetir o D1b** e trazer a lista.

## 8. D1a-3 e D1c (decisões do operador, 2026-09-28)
O operador decidiu:
- "todos na porta" ganha um valor por estado da chave, como o tick exato;
- a fixture da F20b espalha os 9 serfs. O empurrão a 2 tiles foi recusado, por ser regra
  nova criada para um teste passar;
- o conserto do JobBoard entra, medido com a chave nos dois estados;
- a chave não liga antes do D1c;
- o aceite (1) do D1c passa a medir **o tempo de espera da mercadoria na gaveta** (o
  transporte), não a produção.

### D1a-3
1. **F13a e C3(b):**
   - desligada, todos na porta, como hoje;
   - ligada, cada um na porta ou num vizinho dela, e nenhum empilhado.
2. **F20b:** os extras nascem em tiles distintos em volta da porta, e não no mesmo tile.
3. **JobBoard:**
   - as recusas de `reclamar` que não precisam de A* saem para
     `recusaSemCaminho(state, tarefa, unidadeId, dados)`. O `reclamar` a usa: a regra fica
     num lugar só;
   - o `reclamarMelhor` descarta a tarefa recusada **antes** de ordenar por custo. A ordem
     total (nível, custo, número) é preservada entre as que sobram, então a tarefa
     reclamada é a mesma;
   - **o que muda:** o motivo da falha, quando todas são recusadas. Passa a ser o da
     primeira recusada em ordem de número, e não em ordem de custo. A sim não lê esse
     motivo (só `if (!r.ok)` em `serfs.ts`);
   - **medida:** as buscas no A* (execuções e acertos de cache) na F35(b), antes e depois,
     com a chave desligada e ligada. A suíte desligada tem de ficar igual.

### D1c (`tests/D1c-colisao-na-vila.test.ts`)
- **Cenário:**
  - o armazém da abertura, com tronco de sobra, e 4 serrarias completas e ocupadas a leste,
    lado a lado, com as portas numa mesma linha de rua;
  - 16 serfs extras em tiles distintos;
  - o tronco vai do armazém às serrarias, e a madeira volta.
- **Uma rua:** um conector do armazém até a linha das serrarias, chegando a um tile de porta
  do armazém.
- **Duas ruas:** o mesmo conector, mais um segundo disjunto, chegando a outro tile de porta
  do armazém e à outra ponta da linha.
- **Medida (Little):**
  - espera média da madeira na gaveta de saída = Σ por tick da madeira nas saídas das
    serrarias ÷ madeira produzida;
  - também a espera do tronco na entrada, e a vazão (madeira que chega ao armazém).
- **Aceite (1):** com a chave ligada, duas ruas **reduzem** a espera na gaveta.
- **Controle:** com a chave desligada, uma rua e duas dão a mesma espera, ou quase. É o que
  prova que a diferença vem da colisão.
- **Aceite (2), não trava:** o cenário de uma rua (o pior) por 20 000 ticks com a chave
  ligada:
  - nenhuma violação de `violacoesDaColisao` em nenhum tick;
  - as invariantes do JobBoard a cada 50 ticks;
  - a madeira continua chegando no último quarto da corrida.
- A chave liga **só** no cenário do D1c, pelo `GameData` do teste. O `units.json` segue
  `false`, e o número volta para o operador antes de ligar.

## 9. D-MOVIMENTO-01g e 01h: os dois empilhamentos, e a escolha de rota (decisões do operador, 2026-09-28)
O operador decidiu:
- **não fechar desligada**: medir a escolha de rota primeiro;
- consertar **antes** de qualquer decisão os dois empilhamentos que sobraram:
  - ociosos parados para sempre no mesmo tile;
  - dois serfs andando juntos sob carga.

### Correção do levantamento (§1.1), achada no fonte ao responder a pergunta 1
- O +1,5 tile por unidade **não** é só do modo desvio. Em **toda** rota **por estrada**,
  qualquer unidade no tile, andando ou parada, soma `AVOID_UNIT_PENALTY` = 15, ou 1,5 tile
  (`KM_PathFinding.pas:278-306`, `FEAT_AVOID_UNITS_IN_PATH = True` em
  `KM_Defaults.pas:85`).
- Fora da estrada, só quem não está andando (`PathfindingShouldAvoid`).
- O +20 de quem trabalha continua sendo só no modo desvio.
- **O KaM não sorteia nem alterna rota.** A distribuição sai do custo de unidade na hora de
  planejar. O cache de rota dele (12 rotas, `TryRouteFromCache`) reaproveita a rota só
  quando ela passa pela origem.

### D-MOVIMENTO-01g — os dois empilhamentos
- Reproduzir cada um num teste antes de consertar.
- Consertar a causa, não a invariante.

### D-MOVIMENTO-01h — a escolha de rota (medida)
- **Pergunta 2:** quanto custa o serf enxergar unidade como custo.
  - Uma busca de rota por estrada com custo extra por unidade civil "fora" no tile, fora o
    alvo, só nos pontos em que o serf **planeja a rota**: a saída para buscar, a perna
    carregada e o replanejamento.
  - A ordenação de tarefas do JobBoard continua na distância sem unidade, com cache: é onde
    está o volume de buscas (§8).
  - O custo por unidade vem do dado (`colisaoCivil.custoPorUnidade_tiles` 1,5), convertido
    em ticks uma vez no carregamento.
- **O que se mede:**
  - buscas sem cache e nós expandidos, contra hoje;
  - o D-MOVIMENTO-01e (aceite da colisão civil), uma rua contra duas, com a espera na
    gaveta.
- **Se duas ruas reduzirem a espera:** a colisão entra, e o 01e fecha com o número. **Se
  não:** a colisão fecha desligada, e o GDD §6.4 volta a dizer que civis não colidem.

### Resultado (2026-09-28): fechado desligado
- A distribuição de rota funciona: a segunda faixa recebe 45% dos carregadores.
- Mesmo assim, duas ruas não reduzem a espera na gaveta e, com carga, pioram.
- Pela regra do operador, a colisão civil fecha desligada, e o GDD §6.4 volta a "civis não
  colidem". Os números estão no PROGRESS (D-MOVIMENTO-01h).
- O D-MOVIMENTO-01e (aceite da colisão civil) não entra no `test-results.json` como `false`:
  entraria na fila como a próxima feature, e o item está encerrado, não pendente.
