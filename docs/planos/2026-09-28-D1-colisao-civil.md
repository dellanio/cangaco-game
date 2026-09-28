# Plano — D1: civis colidem (levantamento e custo, ANTES de código)

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
