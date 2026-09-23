# PROGRESS

## Contratos vigentes

(origem: F05a)

- **Coleção indexada por id, com `ordem` explícita ao lado do `Record`.**
  `predios`/`unidades` são `{ porId, ordem }`. O `Record` dá acesso O(1); o
  array `ordem` existe porque a ordem de iteração de `Object.keys` num objeto
  JS não é uma garantia da linguagem para chave não numérica — só "na
  prática" os motores atuais preservam inserção. Todo sistema futuro varre
  `ordem`, nunca `Object.keys(porId)`. Os ids também são não numéricos
  (`p1`, `u3`, ...), que é uma segunda garantia independente da primeira.
- **Estoque e capacidade têm a mesma forma: duas gavetas, `entrada` e
  `saida`.** Decisão do operador, corrigindo um desenho meu que deixava
  `estoque` plano enquanto `capacidade` já tinha as duas gavetas. A razão:
  a F09 reserva vaga no destino, e numa Bakery a vaga de farinha é na entrada
  e a de pão é na saída — com estoque plano o JobBoard teria que inventar
  essa separação no meio, exatamente o cenário que modelar a capacidade cedo
  queria evitar. O armazém é o caso especial: capacidade `null` nas duas
  gavetas (de `economy.storehouse.capacidade`), e o estoque inicial inteiro
  entra em `saida` — é de lá que o serf retira. Um prédio de produção nasce
  com capacidade `{ entrada: 5, saida: 5 }` (de
  `production.estoqueInternoPorPredio`, que o carregador não expunha e passou
  a expor) e as duas gavetas de estoque vazias. A schoolhouse (nem armazém,
  nem produção) nasce sem limite e sem estoque.

(origem: F07)

### O contrato da obra (herdado por F09, F10, F11, F12 e F16 — aprovado pelo operador)

`Predio` virou **união discriminada por `estado`**: `PredioCompleto` (com
`capacidade` e `estoque`, como antes) e `PredioEmObra` (com `obra: { faltam }`, sem
`capacidade` nem `estoque`). Um prédio em obra sem `obra`, ou completo sem
`estoque`, não é representável.

- **`hp` da obra = HP já martelado**, de 0 até `def.hp`. O total vem do dado
  (`buildings.json` valida `(timber + stone) × 50`); não é guardado no estado.
- **`faltam` = o que ainda precisa ser entregue**, por mercadoria. Nasce igual ao
  custo do dado. O entregue é `custo − faltam`. Reservas de vaga (F09) **não**
  moram no prédio: moram no JobBoard.
- **Obra não guarda mercadoria.** O que o serf entrega **sai do estoque do armazém
  e entra em `faltam`** (decrementa): é aí que o custo é debitado, nunca no clique.

| Feature | Uso do contrato |
|---|---|
| **F09** JobBoard | destino de material = prédio `'obra'`; vaga = `faltam[m]` menos as reservas do próprio JobBoard |
| **F10** serf | entregar 1 de `m`: `faltam[m] −= 1` **e** `estoque.saida[m] −= 1` no armazém (aceite da F10: obra pedindo 2 stone recebe 2, armazém 10→8) |
| **F11** laborer | martelar `hp += hpPorMartelada` enquanto `hp < teto`, com `entregues = Σ_m (custo[m] − faltam[m])` e `teto = entregues × hpPorMaterialEntregue`; ao `hp === def.hp` reconstrói como `'completo'` (com `capacidade`/`estoque` do tipo, hoje privados em `state.ts`) |
| **F12** | ao virar `'completo'`, chama `registrarTipoConstruido`; obra não desbloqueia |
| **F16a** demolir (feito) | remove o prédio; devolução = `floor(devolucaoAoDemolir × (custo − faltam))` por mercadoria (`entreguesPorMercadoria`, com `faltam = {}` no prédio completo) **mais o estoque interno inteiro**, no armazém completo mais próximo alcançável por estrada; sem armazém alcançável, perde-se |
| render | estágio visual derivado de `hp` e `def.hp`, sem campo extra |

**Fora do contrato, de propósito:** o **nivelamento**. Sem consumidor hoje, sem
campo hoje; está registrado na Nota do item F11 do `BUILD_PLAN.md` (não só aqui),
porque é a F11 quem vai acrescentar campo em `Obra`. Também registrado lá: o
Escopo da F11 diz "cada material entregue soma 50 HP", e o contrato lê isso como o
GDD §5.1 diz — a entrega **habilita** 50 HP de martelada, e a martelada soma ao
`hp`.

(origem: F08)

### O contrato de `estradas` (herdado por F09, F10 e F15 — aprovado pelo operador)

`GameState.estradas: Readonly<Record<string, true>>` — chave `"gx,gy"`, só tiles **de pé**.

- `ehEstrada(estradas, tile)` é **O(1)** (lookup): é o que o A* do serf (F10) pergunta a
  cada passo.
- "Existe caminho de A até B?" é **O(1) amortizado** por um **índice de componentes
  conexos**, construído uma vez por mudança de estrada e **memoizado pela referência**
  de `state.estradas` (`WeakMap` em `sim/estradas.ts`). `step()` carrega a mesma
  referência enquanto nenhum comando de estrada muda algo; então os milhares de
  perguntas de um tick (F09) custam um lookup, não uma busca.
- **Não se guardam componentes no estado:** seria dado derivado serializado, que
  poderia ficar inconsistente com os tiles. O `WeakMap` é memória de cache, não estado
  de jogo: função pura da referência imutável, não entra no JSON, não afeta determinismo.
  (Se o operador preferir zero estado de módulo, a alternativa é guardar `componentes`
  no `GameState` — ao preço de uma segunda fonte de verdade.)
- **Conectividade em 4 direções.** O GDD não responde; o arrasto é 4-conectado e diagonal
  seria um atalho por dentro de dois cantos.
  *(Atualização pós-F10: o GDD **não** trazia a linha das diagonais e agora traz — ver "Ajuste
  pós-F10". A decisão é do operador: 4 direções na Fase A, diagonal em `IDEIAS.md`.)*
- **Determinismo:** os ids de componente vêm dos tiles **ordenados** (`gy`, depois `gx`),
  nunca de `Object.keys` na ordem de inserção; o índice depende só do *conjunto*.
- **Só o que está de pé.** Se a F11 fizer laborer construir estrada, a "estrada planejada"
  é **outro campo** (como `obra` é para prédio), e `isConnected` continua respondendo só
  sobre este.
- **API:** `chaveDeTile`, `ehEstrada`, `componenteDe`, `isConnected(state, from, to)`
  (`false` se algum lado não é estrada), `indiceDeEstradas`, `tilesDaPorta`,
  `predioLigadoAoArmazem`, `canPlaceRoad`, `pedraDisponivel`.

(origem: F09)

### O contrato do `JobBoard` (herdado por F10, F11, F13 e F15)

`GameState.jobs: { tarefas: Colecao<Tarefa> }`. `Tarefa`: `id` (`t<numero>`, do **mesmo**
contador `proximoId` de prédios e unidades), `numero`, `tipo` (hoje só
`'material-para-obra'`), `mercadoria`, `origem` (armazém), `destino` (obra), `estado`
(`'aberta' | 'reclamada'`), `reclamadaPor` (`string | null`, nunca `undefined`).

- **A reserva é DERIVADA das tarefas `reclamada`, não um campo** (`sim/reservas.ts`):
  `reservadoNaOrigem`/`reservadoNoDestino` contam tarefas reclamadas; `disponivelNaOrigem`
  = `saida − reservado` (só a gaveta `saida`, só armazém completo); `vagaNoDestino` =
  `faltam − reservado`. Uma tarefa **aberta não reserva nada**. Como a reserva só existe
  *através* da tarefa, `liberar` devolve as duas metades **de uma vez** e não há contador
  para dessincronizar (a lição da F05b: uma fonte de verdade); e o save/load é de graça.
- **API** (`sim/jobs.ts`): `criarTarefa`, `reclamar` (atômico; recusa devolve só o motivo),
  `liberar(state, id, motivo)`, `tarefasEmOrdem`, `reclamarMelhor`, `nivelDoTipo`,
  `distanciaDaTarefa`. **Nada é `Command`:** o jogador não manda serf (§1).
- **`sanearTarefas` roda todo tick** (depois dos comandos, antes de `gerarTarefas`) e
  revalida cada tarefa; o release **não depende de alguém lembrar de chamá-lo**. A F10 só
  precisa chamar `liberar('pedido-da-unidade')` nos estados de erro da FSM do serf.
- **Reabrir × cancelar:** falha só da unidade reabre a mesma tarefa; falha de origem,
  caminho ou destino a **cancela**, e o gerador recria com a origem certa (id novo).
- **Ordem de escolha:** `(nível lido do dado pelo id, distância por estrada, numero)`.

(origem: F10)

### O contrato da FSM (herdado por F11, F13 e F15)

- `Unidade.gx/gy` é o tile onde ela **está**; o movimento em curso vive em `fsmData`
  (`DadosDaFsm`: `tarefa`, `carga`, `caminho` **sem** o tile atual, `progresso` em ticks no
  passo, `armazem`). Campos ausentes são **omitidos**, nunca `undefined`; `{}` vale para laborer e
  serf ocioso. Um estado de FSM fora do GDD é **erro** (save corrompido), não ignorado.
- `Tarefa.estado`: `aberta → reclamada → carregando → (some na entrega)`. A reserva continua
  **derivada**: `reservadoNaOrigem` só conta `reclamada`; `reservadoNoDestino` conta `reclamada`
  **e** `carregando`. `liberar` de uma `carregando` **sempre cancela**.
- Ordem no `step()`: comandos → `sanearTarefas` → **`sistemaDosSerfs`** → `gerarTarefas`. O
  quadro que o serf vê já está saneado, e o que ele libera é recriado no mesmo tick.
- `sanearTarefas` sobre `carregando` olha só **unidade viva, destino e vaga**; na disputa por vaga
  solta a **reclamada antes da carregando** (quem tem carga na mão é o último a perder a vaga). O
  caminho do serf **carregado** é da FSM (só ela tem a posição).
- `posicaoDaUnidade` (`sim/selectors.ts`) é o que o render desenha: função **pura** do estado.
- **`andar` é privado de `systems/serfs.ts`.** O laborer da F11 vai precisar do mesmo movimento:
  extrair **lá**, quando houver o segundo consumidor (não antes, para não criar abstração sem uso).

(origem: F11a)

- **Nota**: o laço de tempo fixo a 10 Hz (CLAUDE.md §5, `TICK_MS = 100`) ainda
  não existe e nasce aqui — a F11a é a primeira feature **com relógio** (o serf
  da F10 já se move; o que não havia era quem fizesse o tempo passar sozinho).
  Até a F06 `step()` só foi chamado direto por teste; desde a F07 a `Sessão`
  (`src/sessao.ts`) o chama, mas **por comando**, sem relógio e sem interpolação
  de render. A F11a troca o disparo por comando por um timer de `TICK_MS` que
  chama `passo()`; a fila e a `Sessão` não mudam.

- **Nota**: **o destino do gancho `avancar` da F10, decidido.** A F10 publica
  `window.__cangaco.avancar(n)` (chama `sessao.passo()` `n` vezes) para o roteiro
  de screenshot mover o serf sem o laço, e a ponte nasceu marcada para morrer.
  Ela **não some**: vira `pausar()` / `retomar()` / `avancar(n)`, e `avancar`
  **lança se o timer estiver rodando**. Com isso ela deixa de ser dívida e passa
  a ser harness legítimo — a trava é o que impede screenshot não determinístico.
  O comentário `PONTE DE HARNESS DA F10` no código aponta para esta nota.

- **Nota**: **a pausa não é só do harness — é do jogador, e precisa de retorno
  visual.** Decisão do operador: o que ficou fora foi o widget de controle, não o
  retorno; o GDD §10 exige retorno imediato para toda ação. Um elemento único
  mostra o texto de pausa quando pausado, a velocidade quando ela é diferente de
  1x, e some em 1x despausado. Rótulos em `data/theme-sertao.json`, como o HUD.

- **Nota**: **a interpolação entre ticks é do render e não toca `sim/`.** A
  posição visível já é função pura do estado (`posicaoDaUnidade`, fração *dentro*
  do tick pelo `progresso`); a F11a acrescenta a fração *entre* ticks por cima,
  guardando a posição do tick anterior como memória de render. O que
  `window.__cangaco.unidadesRenderizadas` publica continua sendo a posição **do
  tick**, determinística — é o que os roteiros afirmam; o α vai em campo próprio.


(origem: F11b)

### O contrato de `Tarefa` como união discriminada (herdado por F11c, F13, F15 — aprovado pelo operador)

`Tarefa` deixou de ser uma interface única e virou `TarefaMaterialParaObra |
TarefaConstruir`, no mesmo molde de `Predio` (F07): uma tarefa de construir
com `mercadoria`, ou uma de material sem `origem`, não é representável.

- **`TarefaMaterialParaObra`** é a tarefa original da F09/F10: `mercadoria`,
  `origem` (armazém), `destino` (obra), `estado: 'aberta' | 'reclamada' |
  'carregando'`. Só o serf (`TIPO_QUE_CARREGA`) é elegível.
- **`TarefaConstruir`** (F11b) é uma vaga de trabalho numa obra: só `destino`,
  sem `mercadoria`/`origem` (o laborer não carrega nada) e sem `'carregando'`
  no `estado` (não há coleta). Só o laborer (`TIPO_QUE_CONSTROI`) é elegível.
  A vaga é o **teto** `data/buildings.json:construcao.laborersMaximosPorObra`
  (4), lido pelo dado — nunca um campo em `Obra`: a posse continua só no
  JobBoard, sem varredura de `predios.ordem` por nenhuma unidade.
- **`elegivelParaTarefa(tipoDaTarefa, tipoDaUnidade)`** (`sim/jobs.ts`) é o
  ponto único de "quem pode reclamar o quê" — generaliza o que antes era um
  `unidade.tipo !== TIPO_QUE_CARREGA` hardcoded em `reclamar`. Serf e laborer
  **não disputam tarefa**: `'construir'` não entra na escada de
  `delivery.json`, e `tarefasEmOrdem`/`nivelDoTipo` nunca a veem.
- **`gerarTarefas` cria `'construir'` para TODA obra**, até o teto, sem checar
  armazém nem estrada (decisão do operador — nivelar/martelar não depende de
  material chegar). Isso significa que, a partir da F11b, **qualquer obra em
  qualquer cenário de teste passa a ter até 4 tarefas de construir no
  quadro**, mesmo sem nenhum laborer para reclamá-las. Testes que contam ou
  filtram `state.jobs.tarefas` sem checar `tipo` quebram por isso — não é
  regressão de material, é o board deixando de ter um só tipo (ver o commit
  "test(F11b): suite F09/F10 filtra tarefas de material" para o padrão de
  correção).
- **Sem FSM de laborer nesta feature.** As tarefas de construir nascem e
  podem ser reclamadas (`reclamar` aceita, sem checagem de caminho — a F09
  também não checava antes de existir um consumidor; o F10 acrescentou isso
  para o serf, e a F11c decide se o laborer precisa do mesmo), mas nada as
  consome: nenhum `sistemaDosLaborers` existe, nenhum `tick.ts` as avança.

### O que a F11c herda (não decidido aqui, só registrado)

- **O campo de nivelamento em `Obra`** continua fora do contrato — a F11b não
  o acrescentou, porque nivelar é comportamento do laborer (F11c), não posse
  do JobBoard.
- **"Obra já nivelada" como portão de `gerarTarefas` continua sem existir**
  para a tarefa de material: o gerador de material desta feature não mudou
  (confirmado no código) — ele cria tarefa de material para toda obra ligada
  por estrada, do jeito que a F09 já fazia. É a F11c quem acrescenta esse
  portão, condicionado ao campo de nivelamento que ela mesma cria.
- **Estágios visuais** (hp-derivados, função pura em `render/`) são só da
  F11c — nada em `render/` mudou nesta feature.

(origem: F11c)

### A FSM do laborer e o fechamento da obra (herdado por F12 — verificado)

`Obra` (F07) ganha o único campo que faltava: `readonly nivelamento: number`
(ticks já acumulados, `state.ts:157-162`). É monotônico — nunca decresce —
então `obraNivelada` nunca fica retroativamente falsa e `sanearTarefas` não
precisou de ramo novo por causa do portão da Task 6.

- **FSM canônica** (GDD §5.1, `sim/systems/laborers.ts`): `ocioso →
  indo_a_obra → nivelando → esperando_material → martelando → ocioso`. Um
  `fsm` fora desta lista é erro (save corrompido), como o serf.
- **As três grandezas derivadas** (`sim/obra.ts`), nunca guardadas no estado:
  `alvoDeNivelamento` (área do footprint × `ticksNivelamentoPorTile`),
  `entreguesNaObra` (Σ por mercadoria de `custo − faltam`), `tetoDeHp`
  (`entregues × hpPorMaterialEntregue`, nunca passando de `def.hp`).
- **`completarObra`** (`state.ts`) troca `PredioEmObra` por `PredioCompleto`
  quando `hp === def.hp`. **Não** chama `registrarTipoConstruido` — isso é da
  F12. Emite `{ type: 'building-completed', predio, tipo }`
  (`GameEvent`, `state.ts:74`) — **este evento é o contrato que a F12
  herda**: ela só precisa consumi-lo (varrer `state.events`), não detectar a
  transição por conta própria (nota espelhada no item F12 do
  `BUILD_PLAN.md`).
- **Obra trabalhável, regra verificada (decisão do operador na aprovação do
  plano, não balanceamento — não vai para `BALANCE_LOG.md`).** Sem ela a
  partida trava em silêncio: um laborer preso em `esperando_material` por
  uma obra sem estoque possível nunca libera, a obra vizinha (que teria
  material) nunca é nivelada, e o portão da Task 6 nunca deixa nascer tarefa
  de material para ela. A regra é derivada, sem estado novo:
  `obraTrabalhavel = !nivelada || hp < teto || existe tarefa de material
  aberta/reclamada/carregando`. Só o handler de `esperando_material` libera
  por essa regra (`'pedido-da-unidade'`, que **reabre**, não cancela); a
  reavaliação que roda ao saltar de `indo_a_obra`/`nivelando`/`martelando`
  **nunca libera** — ela roda antes de `gerarTarefas` no mesmo tick, e uma
  obra que acabou de nivelar ainda não tem tarefa de material nesse instante.
  Testado (Task 5 do plano): duas obras, uma sem material possível — os
  laborers migram para a que tem, ela termina, e quando o estoque da
  primeira aparece eles voltam, sem liberação repetida nem obra abandonada.
- **`sim/units/movimento.ts`**: `andar`, `noTile`, `chegou`, `dadosDaFsm`,
  `comUnidade`, `ficarOcioso` saíram de `systems/serfs.ts` sem mudar de
  corpo — o laborer é o segundo consumidor que o contrato do F10 previa
  (linha 134-135, agora resolvida).
- **Ordem no tick**: comandos → `sanearTarefas` → `sistemaDosSerfs` →
  `sistemaDosLaborers` → `gerarTarefas`. Laborers depois dos serfs e antes do
  gerador: o nivelamento que termina num tick já abre a tarefa de material
  no mesmo tick (é o que o teste de aceite headless confirma,
  `tickNivelamentoPronto < tickPrimeiroMaterialCompletado`).
- **Estágios visuais: três, não quatro.** `estagioDaObra(hp, hpTotal)`
  (`render/estagio-obra.ts`, zero imports) devolve `marcacao` (`hp === 0`),
  `madeira` (`0 < hp < hpTotal`) ou `completo` (`hp >= hpTotal`). O original
  (K&M) sobe em quatro fases (madeira, depois pedra); aqui são três por
  decisão do operador — a mesma função pura pode dividir a fase do meio pela
  fração de `hp` se um dia houver arte para isso.
- **Hipótese, não implementada nesta sessão**: distinguir visualmente
  `esperando_material` de `martelando` (o "estado real e visível" do GDD
  §5.1, marcador sobre o laborer como o `marcadorDeCarga` do serf). O plano
  marcava este passo como separado e destacável, sem comprometer o aceite
  (que é sobre os três estágios da obra, não sobre o laborer); ficou de fora
  por escopo, não por bloqueio — nenhuma pré-condição falta para fazê-lo.

(origem: F12)

### O desbloqueio ligado ao `step()` (verificado)

`building-completed` deixou de ser um evento sem consumidor. `registrarConclusoes`
(`sim/desbloqueio.ts`) dobra os eventos de **um tick** sobre
`registrarTipoConstruido`, e o `step()` a chama **uma vez, no fim**, depois de
todos os sistemas.

- **Lê evento, não diferença de estado.** Quem conclui anuncia; quem desbloqueia
  escuta. Redescobrir a transição comparando `predios` com o tick anterior seria
  uma segunda fonte de verdade, e amarraria o desbloqueio ao sistema que hoje por
  acaso conclui obras (`sistemaDosLaborers`). Qualquer sistema futuro que emita
  `building-completed` fica desbloqueado de graça.
- **Posição no tick, e por que ela é livre.** Nenhum sistema lê
  `tiposJaConstruidos` — os leitores são `canPlace` (fase de **comandos**) e
  `opcoesDoMenuBuild` (render). A conclusão do tick `t` vale, então, para os
  **comandos de `t+1`**, que é onde o jogador clica; o painel, que lê o estado
  depois do tick, reflete na hora.
- **Zero mudança em `render/` e `ui/`.** `ui/menu-build.ts` já relê
  `opcoesDoMenuBuild(estado)` a cada `atualizar()`. A F12 ficou só em `sim/` e
  **não** precisou da exceção de feature de integração da §10.
- **A guarda da F11c mudou de nível, não sumiu.** `tests/F11c-laborer.test.ts`
  afirmava que `tiposJaConstruidos` não se movia depois de uma obra fechar — era
  guarda de fronteira enquanto ninguém consumia o evento, e a F12 é exatamente
  quem a inverte. O aceite da F11c (hp 250 + `completo` + screenshots) não
  dependia disso; conferido por `git diff` que nenhum outro valor asserido mudou.
  O que ela protegia virou invariante **por tick** no teste da F12: histórico
  cresceu ⟹ houve `building-completed` no tick; anunciaram tipo novo ⟹ o
  histórico passou a contê-lo. Não é "se e somente se": um segundo prédio do
  mesmo tipo anuncia e **não** faz a lista crescer (`registrarTipoConstruido` é
  idempotente).
- **O aceite usa o caminho real, ponta a ponta** (conferido nesta sessão, a pedido
  do operador): `PlaceBlueprint` de verdade para os dois prédios, `step()` para
  conduzir cada obra até `'completo'`, nenhum `PredioCompleto` fabricado por
  fixture. As **estradas** vêm de fixture de propósito — o aceite não fala delas,
  e `PlaceRoad` debita pedra por tile, o que amarraria a F12 ao preço da estrada.
- **Números observados** (`test-output/F12.json`, não são alvo de balanceamento):
  o Woodcutter's fecha no tick 233 e a Sawmill no 547, partindo do estoque inicial.
- **O que continua valendo:** o desbloqueio é permanente (demolir não re-bloqueia,
  F06) e `menuBuildInicial` segue existindo só para raiz sem pai.

(origem: F13a)

### A fila de treino e o nível 2 da escada (herdado por F13b, F14 e F15 — verificado)

A F13 foi **quebrada em duas** (CLAUDE.md §6): `F13a` é a simulação, `F13b` é o
painel. O corte está escrito no `BUILD_PLAN.md`, com a marca de **feature de
integração** já no item da F13b — ela é que pode tocar `ui/`, `input/` e
`render/` juntos. A F13a ficou inteira em `sim/`, sem screenshot.

**O que a fila é.** `GameState.treino: Record<predioId, ItemDeFila[]>`, e
`ItemDeFila` é união discriminada por `estado`: `'aguardando'` (só `id` e
`unidade`) ou `'treinando'` (com `restam`, ticks que faltam). Um item aguardando
com relógio, ou treinando sem, não é representável. **Fila vazia apaga a
entrada** — `{}` e `{ p2: [] }` descreveriam o mesmo jogo com JSON diferente, o
que quebraria a comparação byte a byte; todo caminho que mexe em fila passa por
`comFila` (`sim/escola.ts`), que é onde isso é garantido.

**Só o primeiro item da fila anda.** `sistemaDasEscolas` avança exclusivamente
`fila[0]`: `aguardando → treinando` cobra `custoOuroPorUnidade` da gaveta
`entrada` da escola e põe `restam = ticksPorTreino`; daí em diante `restam − 1`
por tick; em 0 a unidade nasce, o item sai da fila e sai um `unit-trained`. **O
tick da cobrança não conta como tick de treino** — por isso o intervalo medido
entre dois nascimentos é 151, e não 150 (`test-output/F13a.json`).

**`Tarefa` virou `TarefaDeTransporte | TarefaConstruir`** (o contrato da F11b
continua valendo, só ganhou um andar): `TarefaDeTransporte =
TarefaMaterialParaObra | TarefaOuroParaEscola`, as duas com `mercadoria`,
`origem`, `destino` e `estado` incluindo `'carregando'`. Reserva, claim,
saneamento e a FSM do serf passaram a falar de **transporte**, não de material —
`ehTarefaDeTransporte` é o ponto único de estreitamento. O nível continua vindo
de `data/delivery.json` por `id` (`nivelDoTipo`); nenhum número de nível foi
digitado em `.ts`.

**A "vaga no destino" de uma tarefa de ouro é a demanda da fila**
(`ouroNecessario` = itens `aguardando` × custo − ouro já na `entrada`), o análogo
exato de `faltam` numa obra. `demandaNoDestino`/`vagaDoDestino` (`sim/reservas.ts`)
escolhem o ramo pelo **tipo da tarefa**, não pelo estado do prédio: uma tarefa de
material apontando para escola pede zero, e é isso que faz `sanearTarefas`
cancelá-la em vez de entregar no lugar errado. Como a demanda **encolhe** quando o
jogador cancela um item, `vagaDoDestino` pode ficar negativa debaixo de uma
reserva — é esse sinal que desfaz o excesso, e o serf já carregado vai para
`devolvendo` em vez de entregar a uma fila que não quer mais o ouro (conservação
do ouro verificada em `tests/F13a-ouro.test.ts`).

**Ordem no `step()`:** comandos → `sanearTarefas` → serfs → laborers →
**escolas** → `gerarTarefas`. A escola roda **depois** dos serfs para cobrar no
mesmo tick em que o ouro chega, e **antes** de `gerarTarefas` para que a demanda
que o gerador lê já esteja atualizada. Consequência observável: a gaveta
`entrada` da escola está em 0 no mesmo tick da entrega — quem prova que o ouro
passou por lá é o item ter saído de `aguardando`.

**O evento `task-completed` trocou o campo `obra` por `destino`.** O nome deixou
de ser verdade quando o destino pode ser uma escola. Ao contrário do que o plano
supunha, **dois testes liam o campo** (`F10-fsm`, `F11c-laborer`) e foram
ajustados no mesmo commit.

Decisões desta sessão (todas registradas também como Nota no item do BUILD_PLAN):

- **D1 — onde a unidade nasce:** no primeiro tile andável da **porta da escola**
  (`tileDeSaida`, em `systems/escolas.ts`). `economy.json:estadoInicial.spawnDeUnidades`
  continua sendo só o canto do cenário inicial: usá-lo em runtime empilharia as
  unidades de todas as escolas no mesmo tile. Verificado na evidência: as três
  nasceram em `(34,33)`, que está em `tilesDaPorta(escola)`.
- **D2 — "rejeição do 4º pedido":** lida como recusa de **iniciar o treino**, não
  de enfileirar. Cobrar ao iniciar e recusar o enfileiramento por falta de ouro se
  excluem — se enfileirar exigisse ouro presente, a fila nunca criaria a demanda
  que faz o ouro vir. A recusa de comando de verdade está coberta por
  `fila-cheia`, `nao-e-escola`, `escola-em-obra` e `unidade-desconhecida`.
- **D3 — o preço lido é `economy.schoolhouse.custoOuroPorUnidade`.**
  `units.json:civis.tipos[].custoOuro` (hoje 1 para todos) **continua sem
  leitor**; quando um civil custar diferente, é ele que passa a mandar.
- **D4 — a política do dado é validada.** `validarPoliticaDeTreino`
  (`tools/data-rules.js`) recusa `reembolsoSeNaoIniciado: false`, `slotsDeFila`
  não inteiro ou < 1, e `custoOuroPorUnidade` fracionário: o dado não pode
  declarar uma política que a sim não implementa.

**O que ficou de fora, por escopo e não por bloqueio:**

- O **painel** (F13b) — nenhum `EnqueueTraining` sai da interface ainda; os dois
  comandos existem e são exercidos por teste.
- **Nenhum consumidor das unidades treinadas.** O `stonemason` nasce ocioso na
  porta e fica lá: ocupar prédio é a F14. Isso é escopo declarado no BUILD_PLAN,
  não a espera indefinida de algo que não pode chegar.
- **Reembolso** não tem caminho de código porque nada é cobrado antes do início;
  `reembolsoSeNaoIniciado: true` no dado descreve a regra, e a regra é "o item
  que ainda não começou não pagou nada".

**Escola demolida no meio do treino (verificado no código, não só no teste):**
`sistemaDasEscolas` chama `sanearFilas` na **primeira linha**, antes de qualquer
decremento, e o laço que avança as filas pula todo prédio que não é
`ehEscolaCompleta`. Como a demolição acontece na fase de **comandos**, que é
anterior a todos os sistemas, não existe tick em que um item avance numa escola
que já caiu. (Hoje não há comando de demolir — é a F16; o teste chega lá por
fixture.)

## Revisão da F12 e da F13a (subagente evaluator, a pedido do operador)

**Veredicto: as duas mantêm `passes: true`.** Todos os critérios de aceite das
duas foram conferidos com evidência aberta (`test-output/F12.json`,
`test-output/F13a.json`, os testes e o código). `npm run verify` com exit 0: 33
arquivos, 627 testes, `validate:data` 9 arquivos / 0 erros. Nenhum import de
`phaser`, nenhum `Math.random`/`Date.now` em `sim/`. Nenhum critério da F13
depende da F13b (ela tem aceite próprio).

Três achados, e o **operador decidiu o destino de cada um**:

1. **Asserção frouxa no aceite da F13a — apertada nesta sessão, não registrada.**
   `tests/F13a-aceite.test.ts` comparava o intervalo entre nascimentos com
   `toBeGreaterThanOrEqual(TICKS)`, que passaria com 900 ticks quando o esperado
   são 151. Virou igualdade exata contra `ticksPorTreino + 1` (o tick que cobra
   não conta como tick de treino). Verificado: o teste passa com a asserção
   estrita.
2. **Ouro parado na gaveta `entrada` da escola → Nota no item F15.** Se o
   jogador cancelar a fila inteira enquanto o ouro do próximo item está a
   caminho, ele fica na escola: não se perde, mas some do HUD, que lê
   `estoqueDosArmazens`. O operador mandou juntar à nota que a F08 já deixou lá
   sobre HUD contra armazéns — **é o mesmo assunto, o número que o jogador lê
   contra o que existe, e não é balanceamento.**
3. **Dois casos de teste → Nota no item F16.** (a) Escola demolida com tarefa
   `ouro-para-escola` já reclamada: o ramo existe em `sanearTarefas` mas é código
   sem teste (o `destino-sumiu` coberto pela F09/F10 é o de *material*). (b)
   Estrada da porta demolida com item de treino já pago: `tileDeSaida` devolve
   `null` e o item segura com o ouro cobrado. **Hipótese, não confirmada por
   execução** — hoje é inalcançável, porque o ouro só chega por porta que é
   estrada e não existe comando de demolir prédio antes da F16. Se travar, é
   travamento de regra, e a F16 resolve.

## F13b — Schoolhouse: painel da fila (interface)

Plano: `docs/planos/F13b-painel-escola.md`. Quatro decisões, todas também como
Nota no item F13b do BUILD_PLAN (e uma no F16, contrato herdado).

**D1 — o painel abre por clique próprio, não pela ponte de harness.** O item
mandava decidir na sessão. Com a ferramenta em `'nenhum'`, clicar em qualquer
tile do footprint de uma schoolhouse completa abre o painel; `Esc` e clique fora
fecham. A ponte foi recusada porque é superfície de teste — um painel que só abre
pelo Playwright não é a feature. Nada disto vira dívida na F16: a seleção genérica
de lá substitui `src/input/selecao.ts` e hospeda este bloco.

**D2 — os três motivos da espera (decisão do operador, não minha).** Eu havia
proposto um rótulo neutro único ("esperando dinheiro"), com a limitação
registrada. **O operador decidiu separar as três causas** porque elas *pedem
ações opostas*: sem estrada é um arrasto de dez segundos, sem dinheiro é garimpo
e metalurgia, e mostrar o mesmo texto nos dois é o defeito da fila parada de novo,
em menor escala. Ele deixou o recuo pronto — voltar ao rótulo neutro se a
separação exigisse mais do que compor o que já existe. **Não exigiu**: sai de
`ouroNecessario` (F13a) + tarefa `'ouro-para-escola'` no quadro +
`predioLigadoAoArmazem` (F08), **zero campo novo em `GameState`**.

| Condição, nesta ordem | Motivo | Rótulo (tema) |
|---|---|---|
| tarefa `'ouro-para-escola'` com `destino` = esta escola | `a-caminho` | "Dinheiro a caminho" |
| `!predioLigadoAoArmazem` | `sem-estrada` | "Sem estrada até o armazém" |
| caso contrário | `sem-ouro` | "Sem dinheiro no armazém" |

A primeira linha é confiável porque `gerarTarefasDeOuro` (`sim/systems/jobs.ts`)
só cria a tarefa quando `origemMaisPerto` acha um armazém com ouro **não
reservado** e **alcançável por estrada**: tarefa no quadro ⇒ o ouro existe e foi
destinado a esta escola.

**D3 — o motivo é da FILA, não do item.** `ouroNecessario` é um agregado
(itens `aguardando` × custo − caixa da escola); não existe "o ouro deste item".
Todo item `aguardando` mostra o mesmo motivo. Com `ouroNecessario === 0` (ouro já
na gaveta `entrada`) o motivo é `null` e o painel diz "na fila" — é o que a
captura `F13b-2` mostra nos três itens atrás do que treina.

**D4 — progresso derivado, não guardado.** `(ticksPorTreino − restam) /
ticksPorTreino`, em `[0,1)`. `ItemDeFila` não ganhou campo.

**Verificado** (evidência aberta nesta sessão):
- `npm run shot -- F13b` exit 0, e as duas capturas abertas com Read.
  `F13b-1-fila-cheia.png`: os 5 slots, "Carregador" vindo do tema, "Sem estrada
  até o armazém" nos cinco, o `×` em cada item, "Fila cheia", e o canvas **não
  encolhido** ao lado do menu. `F13b-2-treinando.png`: a rua desenhada, o Dinheiro
  do HUD caindo 20→16, "treinando 13%" no primeiro slot e "na fila" nos outros.
- O roteiro afirma sobre o **estado**, não sobre o que o painel escreveu:
  `window.__cangaco.filaDeTreino` (o `GameState.treino` do tick desenhado, novo
  em `render/debug.ts`) tem `slotsDeFila` itens depois de enfileirar por clique, e
  `slotsDeFila − 1` depois do `×`.
- A separação das causas é provada na tela com o armazém **cheio** de ouro (o
  roteiro afirma `estoque.gold > 0` antes): se `sem-estrada` e `sem-ouro`
  colapsassem num rótulo só, este passo não distinguiria nada.
- Não-regressão do layout: `npm run shot -- F06` e `-- F08`, exit 0 nos dois
  (código de saída, imagens não abertas — §8). A F06 é a que afirma
  `canvas.right <= painel.left`; o `#painel-escola` é **sobreposição** na célula
  do canvas justamente para não virar terceira coluna.
- `tests/F13b-painel.test.ts`: 14 testes do seletor, headless. `npm run verify`
  exit 0.

**Fora de escopo, declarado:** nenhum outro prédio abre painel, não há HP, nem
ocupante, nem botão de demolir — é tudo F16. `src/ui/` continua sem teste
unitário neste projeto (Vitest roda em `environment: 'node'`, sem jsdom); quem
prova a interface é o roteiro.

## F14 — Especialistas ocupam prédios

Plano: `docs/planos/F14-especialistas.md` (aprovado pelo operador, com uma
correção na D1). Cinco decisões, as quatro primeiras também como Nota no item
F14 do BUILD_PLAN; a D5 fica só aqui.

**D1 — o alerta de "prédio sem trabalhador" é da F22, não desta feature.** O
critério de aceite da F14 não o menciona e a evidência que ele pede é JSON, sem
screenshot; e a F22 faz os quatro alertas com UM mecanismo só, sendo que três
das causas (sem estrada, fome, mina esgotada) nem são observáveis antes da
F15/F20/F21 — entregar uma causa isolada agora obrigaria a refazer o componente
lá. **Correção do operador:** eu havia usado como quarto argumento "a §10 barra
porque o item não tem nota de integração escrita", e isso está errado — a nota
não é condição preexistente, é autorização que ele concede quando faz sentido
(foi assim em F05b, F06, F07, F08 e F11c). Se o alerta valesse a pena agora, a
nota entraria como Tarefa 0. O que decide são as razões de mérito acima. O
argumento errado foi apagado do plano e da Nota para não reaparecer.

**D2 — o `sem_prédio` do GDD §6.2 chama-se `ocioso` no código.** A FSM entregue
é `ocioso → indo_ocupar → trabalhando`. Toda unidade nasce em `ocioso` e
`ficarOcioso`/`ocioso` (`units/movimento.ts`) são compartilhados; um segundo
nome para o mesmo significado obrigaria cada helper a conhecer os dois.
`esperando_insumo` e `saida_cheia` são de PRODUÇÃO e nascem na F15.

**D3 — "um prédio, um ocupante" mora no tipo,** em `PredioCompleto.ocupante:
string | null`. Não existe `ocupantesMaximosPorPredio` em dado porque não há o
que balancear: dois ocupantes não são representáveis. É o oposto do
`laborersMaximosPorObra`, que é teto de verdade e por isso vive no dado.

**D4 — a vaga de ocupação nasce mesmo sem especialista no mapa,** como a de
construir (F11b), e não exige estrada: o especialista anda em modo `'livre'`,
como o laborer. Uma pedreira vaga num mapa sem pedreiro fica com a tarefa
aberta no quadro — é exatamente o estado que a F22 vai querer ler.

**D5 — sem screenshot: a feature não muda uma linha de tela.** Nada de
`src/render/`, `src/ui/` ou `src/input/` foi tocado. A não-regressão visual é a
da Tarefa 8, por código de saída.

**Verificado (aberto com ferramenta ou rodado):**

- `test-output/F14.json`, **aberto com Read**: `q1` tem ocupante `u16`, `q2` tem
  `u15`, ids distintos, os dois `stonemason` em `trabalhando` na linha de porta
  (y=38), `ocupantesDistintos: 2`, `vagasAbertasNoFim: 0`, `violacoes: []`. Os
  dois foram TREINADOS na escola de verdade, com o ouro atravessando a estrada
  no ombro de um serf — nada pôs ouro na escola à mão.
- `npm run verify` exit 0 (typecheck, lint, validate:data 9 arquivos/0 erros,
  e a suíte inteira).
- Suíte: 38 arquivos, 679 testes. Os novos são `tests/F14-ocupacao.test.ts`
  (23), `tests/F14-especialista.test.ts` (7), `tests/F14-aceite.test.ts` (3) e
  `tests/F14-invariantes-destino.test.ts` (5).
- Não-regressão visual (Tarefa 8), **por código de saída, sem abrir imagem**:
  `npm run shot -- F11c` exit 0 (3 capturas), `npm run shot -- F13b` exit 0 (2
  capturas). Não afirmo nada sobre o conteúdo dessas imagens.

**Fallout da triagem (Tarefa 6), com a causa de cada um:**

- `tests/helpers/jobs-invariantes.ts`: aprendeu `'ocupar'` — destino é prédio
  ocupável e vago (não obra), a elegibilidade vem de `podeReclamar` (não do par
  fixo tipo-de-tarefa/tipo-de-unidade), e um prédio nunca tem mais de um
  ocupante reclamado. **Nenhuma asserção foi afrouxada**; a invariante ficou
  mais estrita, não menos.
- `tests/F10-falhas.test.ts` (cenário de carga): a conta que isola as tarefas de
  material do contador compartilhado de ids subtraía só as de construir. As
  obras que os laborers terminam agora viram pedreiras vagas e cunham um id de
  `'ocupar'` cada uma (11 delas, no cenário), que vazavam para `materiaisGerados`
  e faziam o churn acusar 111 em vez de 100. A conta passa a subtrair também
  essas, contadas do estado final — onde "quantas existem" é igual a "quantas
  foram criadas", porque neste cenário ninguém as consome.
- Fixtures de prédio completo em 6 arquivos de teste ganharam `ocupante: null`,
  que é consequência direta do campo novo.

**A invariante de destino, corrigida (decisão do operador, na revisão da F14):**
`violacoesDeInvariantes` (helper de teste) exigia destino em OBRA para toda
tarefa que não fosse `'ocupar'`. A regra nasceu na F09, quando todo destino era
obra, e a **F13** a deixou desatualizada sem que ninguém percebesse — a escola
virou destino de ouro e o helper continuou exigindo obra. Eu havia restringido a
asserção do aceite da F14 e deixado o item em aberto; o operador mandou o
contrário, e com razão: é exatamente o tipo de defeito silencioso que a
invariante existe para pegar. Agora ela exige destino coerente com o TIPO:

| tipo de tarefa | destino exigido |
|---|---|
| `material-para-obra`, `construir` | obra |
| `ouro-para-escola` | escola completa (`ehEscolaCompleta`) |
| `ocupar` | prédio completo que pede trabalhador e está vago (`ehPredioOcupavel`) |

O que vale para quem mexer nisso depois:

- O `switch` de `violacoesDoDestino` é **exaustivo**: um membro novo de `Tarefa`
  sem contrato de destino reprova o `npm run typecheck` (o `never` do `default`),
  em vez de passar calado por um `else` genérico. **Nenhuma tarefa ficou sem
  caso** na correção — os quatro tipos têm contrato.
- Cada caso pergunta pelo **mesmo predicado que a sim usa**, não por uma cópia da
  regra escrita no teste.
- A asserção do aceite da F14 **voltou ao escopo original**: as duas invariantes
  juntas, tick a tick, com a escola treinando.
- `tests/F14-invariantes-destino.test.ts` (5 testes) é novo e prova o sentido que
  faltava. Toda a suíte só chamava o helper sobre estados **sadios**, o que prova
  que ele não acusa falso positivo, mas nunca que ele **acusa** — que é
  justamente como o defeito da F13 passou despercebido. Agora cada tipo com
  destino da espécie errada tem que aparecer na lista. Isso é cobertura contínua,
  não probe de sessão.

**Fora de escopo, declarado:** o alerta do HUD (F22, D1), PRODUZIR (F15 — um
prédio ocupado ainda não faz nada), o painel que mostra o ocupante e a demolição
pelo comando real (F16). Nenhum arquivo de `render/`, `ui/` ou `input/` foi
tocado.

**Para reportar ao operador:** no commit `132fbb7` (F14, Tarefa 1) um `git add
-A` levou junto `.claude/.headroom_wrap_owners.json`, arquivo rastreado desde a
F02 e reescrito automaticamente por uma ferramenta. A §10 do CLAUDE.md proíbe
mexer em `.claude/` e também reescrever histórico, então deixei o commit como
está e passei a usar `git add <paths>` explícito em todos os commits seguintes
desta sessão.

## F15a — Produção: o ciclo e o veio

Plano: `docs/planos/F15-producao.md` (aprovado). O operador partiu a F15 **por
camada**: a F15a faz o prédio produzir na própria gaveta `saida`; levar essa
saída ao armazém (níveis 6 e 7 da escada de `data/delivery.json`) e a calibração
do cenário longo são a F15b — e ele condicionou: "calibração não pode ficar de
fora da Fase A — ela é o que prova que o jogo tem ritmo, e o aceite da F17
depende dela".

### Decisões

**D1 — a receita é um CICLO, não uma taxa por minuto.** `data/production.json`
declara, por prédio, quanto entra e quanto sai a cada ciclo, e
`ticksDoCiclo` é o período da MENOR taxa entre `entra ∪ sai`; as quantidades
saem de `round(ticksDoCiclo / periodo)`. A quarry fica em 167 ticks por 1
`stone`; a sawmill em 273 ticks, 1 `tree_trunk` → 2 `timber`; o Woodcutter's em
545. Uma taxa por minuto convertida tick a tick produziria fração, e fração em
estoque inteiro é não-determinismo disfarçado. `validate:data` passou a **recusar
receita cuja razão o arredondamento distorce** (`tools/data-rules.js`).

**D6 (do operador, com a razão dele) — prédio que não escoa é `saida_cheia`,**
estado que o GDD §6.2 já prevê; nenhum estado novo foi criado. Por isso prédio
**sem estrada** até o armazém também cai em `saida_cheia`: a causa é a mesma do
ponto de vista do especialista — a saída não tem para onde ir.

**D4(b) (do operador) — o nível 7 da escada fica onde está.** "O vazamento se
resolve na origem e o HUD continua com uma regra só — conta armazéns. Sem nota
de integração, sem tocar na tela."

**`rendimento: 200` é ponto de partida, não número calibrado.** Aprovado pelo
operador em `data/production.json` ("~55 minutos de produção contínua na escala
2.0"), com instrução explícita de **registrar como número a calibrar na F15b**.

### Verificado (rodado, e a evidência aberta)

- `npm run verify`: 41 arquivos, **719 testes** verdes; `validate:data` 9
  arquivos, 0 erros.
- `test-output/F15a.json`, aberto com a ferramenta Read. Caminho **real**
  (`PlaceBlueprint quarry (26,34)` + `EnqueueTraining stonemason`, nenhum
  `PredioCompleto` fabricado por fixture): stonemason treinado no tick **179**,
  obra `completo` em **240**, ocupada em **281**; depósitos em **448, 615, 782,
  949, 1116** — intervalos **167, 167, 167, 167**, iguais ao `ticksDoCiclo` do
  dado; gaveta parou no teto (5); veio 200 → **195**, um por unidade; `ocioso`
  depois de ocupar: **0 ticks**; `esperando_insumo`: 0; no fim, `saida_cheia`
  com `progresso === 167` (o ciclo pronto que não cabe).
- Cláusulas de dado injetado, sobre fixture controlada e **rotuladas como tal**
  dentro da evidência: serraria sem tronco fica 300 ticks em `esperando_insumo`
  com `progresso 0` (não gasta relógio); veio curto (`rendimento: 2`) produz 2 e
  para com `veio 0`, e `vein-exhausted` sai **uma vez**.
- `npm run sim -- producao --ticks 1300` reproduz a mesma corrida fora do teste:
  `progresso 167, veio 195, saida stone=5, ocupante u21 (saida_cheia)`.
- Não-regressão visual: `npm run shot -- F11c` e `npm run shot -- F13b`, ambos
  código de saída 0 (3 e 2 capturas). As imagens **não** foram abertas — é
  roteiro de outra feature.

### Correção do critério de aceite (com o número medido)

O aceite da F15a, como eu o escrevi na sessão anterior, era **aritmeticamente
impossível**, e os dois defeitos estão corrigidos no BUILD_PLAN com a medição
junto:

1. **1000 → 1300 ticks.** 5 ciclos são 835 ticks só de produção, depois de 281
   ticks de preparo; e o rótulo `saida_cheia` só aparece no tick **1283**.
2. **"nunca passa por `ocioso`" → "não volta a `ocioso` depois de ocupar".**
   Toda unidade nasce `ocioso` na escola; a cláusula original só poderia passar
   com um teste desenhado para não olhar o começo.

Corrigi o critério em vez de ajustar o teste para caber no critério.

### Contornado, não resolvido: BUG-001

O helper de invariantes acusa 3 tarefas de `construir` apontando para prédio já
completo **no tick 240**, o tick exato da conclusão; `sanearTarefas` as cancela
no tick seguinte e nenhum laborer age sobre elas. Registrado em `BUGS.md` como
`feio` (não quebra critério de aceite escrito nenhum). Não é regressão da F15a:
a F14 nunca cruzou a transição obra → completo com o quadro carregado porque
montava o prédio completo por fixture. O aceite afirma a **forma exata** do
transitório e que **nenhum outro tick** tem violação — inclusive o seguinte.

### Hipótese, nomeada como tal

A projeção do §0 do plano (quanto tempo de jogo os 200 do veio representam na
escala 2.0, e se o ritmo resultante é jogável) é **aritmética em cima do dado,
não medição**. Continua hipótese até a F15b rodar o cenário longo. Nenhum
número de balanceamento foi mexido nesta feature.

### Fora de escopo, declarado

Transporte da saída ao armazém (F15b), escolher `modos` do Woodcutter's (F16,
D7 — o campo segue sem leitor, e por isso o veio do lenhador é `null`), painel e
alerta de prédio parado (F16/F22). Nenhum arquivo de `render/`, `ui/` ou
`input/` foi tocado.

Histórico das features fechadas: docs/historico/F01-F11a.md.

## F15b — Entrega ao armazém e calibração

Plano: `docs/planos/F15b-entrega.md` (aprovado). O operador **alargou o escopo**
de "níveis 6 e 7" para **níveis 4–7** e partiu a feature em **F15b-1** (a escada
do produtor) e **F15b-2** (cenário longo e calibração). A razão, nas palavras
dele: "meu erro de sequenciamento — escrevi a F15 pensando em quem produz e não
notei que a Sawmill consome". Registrado assim, e não como mudança de escopo por
conveniência. A nota de alargamento entrou no `BUILD_PLAN.md` **antes** do
código.

### Decisões

**A origem da tarefa virou simétrica ao destino.** Antes da F15b só o destino
tinha predicado (`demandaNoDestino`/`vagaDoDestino`); a origem era sempre "a
gaveta `saida` do armazém". Agora tem o par `ofertaNaOrigem`/`sobraNaOrigem`, e
a **gaveta** vem do TIPO da tarefa (`gavetaDeOrigem`), nunca de um campo do
estado: nível 6 tira da `saida` do produtor, nível 7 tira da `entrada` da
escola. `reservadoNaOrigem` passou a contar **por gaveta** — sem isso, dois
tipos que saem do mesmo prédio com a mesma mercadoria reservariam a unidade um
do outro.

**No nível 7 a oferta é o EXCEDENTE, não o estoque.** O ouro que a fila da
escola ainda quer está na gaveta `entrada` e não pode voltar ao armazém; seria o
vaivém que `alvoDeEntrada` existe para impedir.

**BUG-001 foi corrigido em commit próprio** (decisão do operador). A obra que
vira prédio cancela as tarefas `construir` irmãs no mesmo tick
(`cancelarConstrucoesDe`), e quem segurava uma delas volta a `ocioso`
(`semOsOrfaos`) — o saneamento roda **antes** dos laborers no tick, então quem
já passou pelo laço precisa ser devolvido pelo concluinte.

### Verificado (evidência aberta nesta sessão)

- `test-output/F15b-escada.json`: as quatro cláusulas (a)–(d) da fila. Nível 6
  leva a pedra da pedreira ao armazém (saída 0 no fim, 33 stone no armazém);
  níveis 4/5 alimentam a Sawmill (3 troncos viram 5 timber no armazém); nível 7
  devolve o ouro parado (escola 0, armazém 20 → 21); conservação exata e
  `violacoesDeInvariantes` vazio em todo tick.
- `test-output/F15.json`, cenário oráculo, 3000 ticks: nenhuma queda no
  acumulado produzido; `piorOcio` de especialista = **0** (o X é 300); fila do
  quadro **nunca** acumulou (zero tarefa `aberta` em todas as amostras de 100 em
  100 ticks); primeira pedra no armazém no tick 207, primeiro tronco no 628,
  primeiro timber no 968.
- **A proporção 2:1 do GDD §4.5 bate quase no tick**: 2 Woodcutter's a 545
  ticks/tronco dão um tronco a cada 272,5 ticks e a Sawmill consome um a cada
  273. O carpinteiro ficou 661 ticks em `esperando_insumo` — **todos em uma
  única sequência, no arranque**, e nenhum depois da primeira entrega.
- **Veio**: medido com veio 20 (zera no tick 3340) e veio 40 (tick 6680) — 167
  ticks por pedra nos dois, exatamente o `ticksDoCiclo`, sem intercepto. **A
  extrapolação para 200 é 33400 ticks ≈ 55,7 min de jogo a 1x, e está declarada
  como extrapolação** em `BALANCE_LOG.md`, não como corrida medida. Nenhuma taxa
  mudou: o ajuste é em lote.
- `npm run verify` verde (796 testes, 44 arquivos). Roteiros de não-regressão
  F08, F10, F11c e F13b rodados: **código de saída 0** nos quatro (screenshot
  não aberto — não é a feature desta sessão).

### Achados registrados, não corrigidos

- **`reclamar` ainda perguntava pela gaveta errada.** O claim checava
  `disponivelNaOrigem(..., 'saida')` enquanto o quadro já criava tarefa de nível
  7 (gaveta `entrada`): o quadro insistia em criar e todo serf recusava, para
  sempre. Corrigido junto (é a mesma feature), mas fica anotado porque é a forma
  exata da "espera indefinida" — a conta do claim e a conta do saneamento
  **precisam ser a mesma função**.
- **Veio esgotado deixa o especialista parado para sempre**: no tick em que o
  veio zera sai `vein-exhausted` e o pedreiro entra em `esperando_insumo` e
  fica (medido: 1000 ticks depois continua lá). Não quebra critério escrito
  nenhum — foi para `IDEIAS.md` como buraco de desenho, não como bug.

### Correção de aceite herdada pela F15a

O aceite da F15a afirmava "a gaveta `saida` entope e o relógio congela". Essa
**premissa deixou de valer por desenho** quando o nível 6 passou a escoar a
gaveta. As cláusulas 2/3/5 foram reescritas com a medição ao lado (a cadência
continua exata e agora cobre a corrida inteira, sem buraco), e o teto da gaveta
e o `saida_cheia` continuam afirmados em `F15a-producao.test.ts`, sobre o
cenário isolado, onde nada escoa. É mudança de premissa, não afrouxamento.

### Fora de escopo, declarado

Nenhuma taxa foi ajustada (o operador pediu medir antes). Nenhum arquivo de
`render/`, `ui/` ou `input/` foi tocado — a F15b-1 tem nota explícita de que
**não** é feature de integração.

## F16a — Demolir prédio (sim)

Plano: `docs/planos/F16a-demolir.md` (aprovado). O operador **partiu a F16 em
três** e fixou a ordem **F16a (sim) → F16c (pausar e modos, sim) → F16b (painel,
integração)**. A razão, como ele a deu: a metade de `sim/` carrega as duas notas
mais delicadas da fila (escola com tarefa de ouro reclamada; estrada da porta com
treino já pago), e se a segunda travasse ele queria o travamento numa feature
focada. A nota de integração do §10 está escrita **só no item F16b**, antes do
código dela; F16a e F16c não tocam `render/`, `ui/` nem `input/` e não a herdam.

### A sonda veio antes do código

A Tarefa 1 foi medir a hipótese da F13a com o comando que já existia
(`DemolishRoad`), **antes** de escrever `DemolishBuilding`. Resultado:

- **A hipótese é falsa** (verificado, `test-output/F16a-porta.json`). `tileDeSaida`
  pergunta por `tileAndavel(..., 'livre')` — estrada não entra na conta —, então
  com os três tiles da porta demolidos a unidade nasce normalmente e o ouro já
  cobrado não fica preso.
- **A via que trava de verdade é outra**: a porta coberta por *footprint*. E ela
  era alcançável pelo jogo, porque `canPlace` só comparava footprint com
  footprint. A nota da F13a no `BUILD_PLAN.md` foi corrigida com essa medição ao
  lado, no mesmo commit.

### Decisões do operador (2026-09-23), com o porquê dele

- **O buraco da porta é da F06, e a correção vai lá**, com motivo próprio e uma
  única checagem: *"a borda sul precisa estar no mapa e livre"* — uma regra, um
  motivo, um lugar. A razão que fechou o caso da borda do mapa: prédio colado
  nela nunca poderá receber entrega, porque não há onde passar a estrada; recusar
  não é rigor, é impedir que o jogador construa algo que nasce inútil.
- **O estoque interno do prédio demolido vai integralmente** ao armazém completo
  mais próximo alcançável, e só se perde quando nenhum está ligado — e aí o teste
  declara a perda com o número. Razão dele: os níveis 6 e 7 da escada existem
  desde a F15b exatamente para trazer essa mercadoria de volta, então destruir o
  que o jogador recuperaria esperando um tick pune quem demole rápido, e
  conservação de bens é invariante forte demais para se trocar por simplicidade.
- **O exploit do veio** (demolir e replantar renova `rendimento`) foi para
  `IDEIAS.md` com o tamanho medido (`rendimento = 200` por metade do custo) e
  para uma nota no item F21, que é quem semeia o veio no terreno. A F16a não é
  dona disso e não o corrige.

### Verificado (evidência aberta nesta sessão)

- `test-output/F16a.json`: o aceite escrito, pelo comando real. Obra demolida com
  o serf **no meio da rua carregando** — tarefa liberada com `destino-sumiu`
  (`resultado: cancelada`), serf passa por `devolvendo` e termina `ocioso`, a
  pedra volta ao armazém (9 → 10), 48 ticks até o quadro ficar quieto e **zero
  violação de invariante em todos eles**. E a corrida irmã com o serf ainda
  `indo_buscar`: nada a devolver, quadro vazio no fim, zero violação.
- Mesmo arquivo: **escola demolida com a tarefa `ouro-para-escola` reclamada** —
  o ramo `ehEscolaCompleta(destino) ? null : 'destino-sumiu'` de
  `systems/jobs.ts`, que não tinha teste. `destino-sumiu`, fila apagada por
  `sanearFilas` (`treino` volta a `{}`, não a `{ escola: [] }`), e o ouro em
  trânsito conservado (1 antes, 1 depois).
- Mesmo arquivo: **prédio ocupado e com estoque** — devolve `{ timber: 1, stone: 4 }`
  (3 de estoque + metade do custo entregue) ao armazém `p1`, e o pedreiro volta a
  `ocioso` sem tarefa órfã. E **sem armazém alcançável**: `devolvido: {}`,
  `armazem: null`, perda declarada de 3 de pedra no total do mapa.
- A devolução **segue o dado**: com a fração injetada em 0 não volta nada, com 1
  volta o custo inteiro, com a fração real volta a metade arredondada para baixo.
  Regra nova em `tools/data-rules.js` valida `buildings.construcao.devolucaoAoDemolir`
  em `[0,1]` — o campo não era validado por nada até hoje.
- `npm run verify` verde: **824 testes, 46 arquivos**, typecheck, lint e
  `validate:data` limpos. Roteiros de não-regressão F06, F08, F10, F11c e F13b:
  **código de saída 0** nos cinco (screenshot não aberto — não é a feature desta
  sessão, e a F16a não muda um pixel).

### Sondas de mutação (prova do momento, não cobertura)

Duas mutações manuais no fonte, revertidas em seguida (md5 conferido). Valem como
evidência **desta sessão**; quem protege daqui para frente são as asserções:

1. Devolução desligada → 4 casos reprovaram. O guarda acusa.
2. `semOPredio` deixando o id em `predios.ordem` (órfão em `porId`) → **os 21
   casos passavam**. Quase todo laço do jogo faz `if (!predio) continue`, então o
   id órfão não quebra nada hoje e apareceria como bug de save meses depois. Daí
   nasceu `violacoesDaColecaoDePredios`, conferido **a cada tick** das corridas;
   com ele, a mesma mutação reprova 5 casos.

### Consequência da regra da porta, além do que foi pedido

A checagem é simétrica, então **dois prédios deixaram de poder se encostar na
vertical, nos dois sentidos**: o de baixo cobriria a porta do de cima, e o de
cima teria a própria porta coberta. Encostar na horizontal continua valendo.
Três casos da F06 foram atualizados por isso, com o motivo escrito ao lado de
cada um, e a consequência está registrada na nota do item F16a do `BUILD_PLAN.md`.
Não é afrouxamento de teste: é a mesma regra que o operador pediu, aplicada nos
dois lados.

**Decisão do operador (2026-09-23), depois de ver a consequência: a regra fica
simétrica.** O porquê dele: encostar na vertical de fato quebraria a entrega, e
recusar no clique é melhor que o jogador descobrir que o prédio nunca recebe
material — é fiel ao original, porta ao sul e estrada obrigatória. Ele mandou
registrar o efeito colateral (proíbe empilhar prédios em coluna; a vila pode
sair mais esparsa do que o GDD §1.3 sugere) no `BALANCE_LOG.md`, para
**verificar na F17** montando a abertura recomendada (2 Woodcutter's, 1 Quarry,
1 Sawmill) e vendo se cabe confortavelmente. A saída que ele já deixou pronta,
se ficar apertado: reduzir a porta a **uma coluna** em vez da borda sul inteira
— não afrouxar a regra. A mesma nota está no item F17 do `BUILD_PLAN.md`, que é
quem herda a medição. Isto é decisão registrada, não pergunta em aberto.

### Fora de escopo, declarado

Nenhum arquivo de `render/`, `ui/` ou `input/` foi tocado. O painel de seleção, o
botão de demolir e o screenshot são da F16b; `pausar` e `modos` são da F16c. O
único refactor foi generalizar `devolverPedra` para
`devolverMercadorias(predios, quantidades, destino)` em `sim/deposito.ts`, com o
`DemolishRoad` chamando-a com o destino de sempre (o primeiro armazém da ordem):
a estrada não tem porta de onde medir distância, e mudar isso alteraria
comportamento testado da F08 sem pedido.

## F16c — Pausar produção (sim)

Plano em `docs/planos/F16c-pausar.md`, escrito e **aprovado pelo operador antes
do código** (2026-09-23), com os três pontos que ele decidiu ponto a ponto. Só
`src/sim/`: nenhum arquivo de `render/`, `ui/` ou `input/` foi tocado, e esta
feature **não herda** a nota de integração, que está escrita só no item F16b.

### A semântica de "pausado" (decisão do operador, com o porquê dele)

> **Pausar congela o relógio de produção daquele prédio, e nada mais.**

Um campo (`PredioCompleto.pausado`), um leitor (a primeira linha de `produzir`,
`sim/systems/especialistas.ts`), nenhum estado novo. As três sub-perguntas que a
nota do item deixara em aberto, respondidas:

- **(a) a gaveta `saida` continua escoando.** O nível 6 da escada não olha o
  produtor, e congelar a gaveta criaria mercadoria presa que nenhuma regra
  libera enquanto o jogador não voltar — travamento de regra, não balanceamento.
- **(b) nenhuma tarefa de transporte é cancelada**, e o gerador continua criando
  até o alvo de sempre. O destino segue válido porque `motivoDoDestino` valida
  pelo **tipo** do prédio, então não há órfã nem ramo novo em `sanearTarefas`; e
  zerar o alvo faria o estoque da `entrada` virar excedente e voltar ao armazém
  pelo nível 7 — pausar e despausar mandaria a mesma mercadoria de ida e de volta.
- **(c) o ocupante fica**, com rótulo `trabalhando`. A razão que o operador
  endossou: prédio pausado e vago **anunciaria vaga** e puxaria um especialista
  para sentar parado, tirando-o de um prédio que produziria. "Pausado" não é
  estado de FSM — a tela o compõe do campo mais o ocupante, uma fonte de verdade
  só, no prédio, como a posse.

Ciclo em curso: `progresso` congela e **não** zera; insumo já consumido continua
consumido; ciclo PRONTO não deposita enquanto pausado e deposita no primeiro tick
depois de despausar. As alternativas rejeitadas, com a razão de cada uma, estão
na tabela do §3 do plano.

**Sem evento de pausa, por decisão do operador.** Eu havia proposto
`building-paused` como gancho da F16b; ele cortou: evento sem consumidor criado
para feature que ainda não existe. O `building-completed` da F11c era diferente
porque a F12 tinha aceite escrito que dependia dele. A F16b lê `predio.pausado`
do estado, como o painel já lê tudo, e cria o evento lá se precisar. A nota do
contrato está no item **F16b**, e a do alerta que não pode disparar em pausa
deliberada, no item **F22**.

### Os modos do Woodcutter's: andaime, não implementados

O operador aprovou a emenda do aceite: a cláusula *"teste que troca o modo do
Woodcutter's e confirma que o comportamento do lenhador acompanha"* **saiu**, com
a razão escrita ao lado no item — o comportamento que o modo governaria não
existe, e cumprir o critério exigiria fabricá-lo. **Verificado** nesta sessão:
`modos` está em `data/production.json` e **não tem leitor** (`ReceitaDePredio`
não carrega o campo; `grep` em `src/sim/data/` e `tools/` não devolve nada);
`data/terrain.json` não tem camada de tiles (só custo de movimento, lista de
intransponíveis e tamanho do mapa); e `woodcutters` não declara `veio`, isto é,
a sim já modela "o lenhador replanta sempre" (F15a, D7). Traduzindo: `ambos` é o
comportamento de hoje, `replantar` seria `pausar` com outro nome e `cortar`
exigiria estoque finito de árvore no terreno.

Ficou registrado em três lugares, como ele pediu: `IDEIAS.md` (entrada própria +
a pré-condição acrescentada à entrada de terreno que existe desde a F06 — ela
agora tem **dois dependentes**, o motivo `'terreno'` do `canPlace` e os modos, o
que aumenta o peso dela na decisão da Fase B), a Nota da emenda no item F16c do
`BUILD_PLAN.md`, e o campo `notas` ao lado do `modos` órfão em
`data/production.json`. A chave `F16c-pausar-e-modos` do `test-results.json`
ficou como estava: renomear mexeria no arquivo do portão sem ganho.

### Verificado (evidência aberta nesta sessão)

- `test-output/F16c.json`, aberto com Read: pedreira pausada no tick com
  `progresso = 3` fica em **3 depois de 200 ticks**, sem nenhum `goods-produced`,
  com o ocupante `u1` intacto em `trabalhando` e **zero violação de invariante em
  todos os ticks**. Despausada, deposita **uma** pedra nos 164 ticks que faltavam
  do ciclo, `progresso` volta a 0 e a pedra no mapa vai de 30 a 31 — nem perda nem
  duplicação.
- Mesmo arquivo, a resposta (a) medida: pedreira **pausada** com 2 de pedra na
  `saida` e um serf no mapa — a gaveta zera, o armazém vai de 30 a 32 e o total
  de pedra no mapa não muda (32 → 32). E a resposta (b): serraria **pausada**
  recebe os 3 troncos do armazém, o quadro termina **vazio** (nenhuma tarefa
  órfã) e nada é produzido durante a pausa.
- `npm run verify` verde: **839 testes, 47 arquivos**, typecheck, lint e
  `validate:data` limpos. Roteiros de não-regressão F10, F11c e F13b: **código de
  saída 0** nos três. Screenshot não foi aberto: a F16c não muda um pixel, o
  botão é da F16b.

### Sondas de mutação (prova do momento, não cobertura)

Quatro mutações manuais no fonte, revertidas em seguida. Valem como evidência
**desta sessão**; quem protege daqui para frente são as asserções de
`tests/F16c-pausar.test.ts`:

1. Leitor apagado (`produzir` sem o `if (predio.pausado)`) → **4 casos
   reprovaram** (1, 2, 3, 4).
2. Leitor invertido (`!predio.pausado`) → os mesmos 4.
3. A alternativa rejeitada **"pausa cancela a tarefa em voo"** (um ramo de
   `pausado` em `motivoDoDestino`) → **o caso 5 reprovou**.
4. A alternativa rejeitada **"pausa solta o ocupante"** (um `&& !predio.pausado`
   em `sanearOcupacao`) → **os casos 1 e 6 reprovaram**.

As duas últimas existem porque os casos 5 e 6 guardam decisões de desenho, não o
leitor: sem elas eu saberia que o leitor funciona, mas não que as respostas (b) e
(c) estão travadas contra uma sessão futura que resolva "melhorar" a pausa.

### Fora de escopo, declarado

Nenhum `modos`, nenhum botão, nenhum evento novo. Não entrou também: pausar
**obra** (recusado com `predio-em-obra` — "parar de martelar" não está escrito em
lugar nenhum) e ligar/desligar reparo (mesma linha `[geral]` do GDD §2.3: não há
HP em queda no jogo, não há o que pausar). Prédio completo **sem receita**
(armazém, escola, quartel) é aceito pelo comando e simplesmente não tem leitor —
quem esconde o botão nesse caso é a tela, e isso está na nota da F16b.

## F16b — Painel de seleção de prédio (2026-09-23)

Plano: `docs/planos/F16b-painel-predio.md`. **Feature de integração**, autorizada
pelo operador e escrita na Nota do item **antes** do código, na sessão da F16a —
conferido no `BUILD_PLAN.md` antes de começar, e a exceção é só deste item.

Um painel para todo prédio: nome temático, firmeza ou progresso de obra,
ocupante, as duas gavetas de estoque, pausar e derrubar. **Nenhum mecanismo
novo** — junta o que cinco features deixaram: `selecao.ts` e `predioNoTile`
(F13b), `DemolishBuilding` (F16a), `SetBuildingPaused` com valor explícito
(F16c), estoque e ciclo (F15), `ocupante` (F14). Zero comando novo, zero campo
novo no `GameState`. Os modos do Woodcutter's **não entraram**: saíram na F16c.

### Decisões

- **D1 — o seletor mora em `sim/selectors.ts`**, junto de `painelDaEscola` e
  `predioNoTile`, e não em `ui/`. Duas razões: `ui/` varrendo `GameState` é o
  anti-padrão do §10, e o Vitest roda em `environment: 'node'` — um seletor em
  `ui/` só teria prova por Playwright, enquanto em `sim/` ele tem teste unitário.
- **D2 — `painelDoPredio` devolve `null` para id fora do estado**, e é isso que
  **fecha o painel sozinho ao demolir**: ninguém manda fechar; o prédio deixou de
  existir e a seleção se limpa. O caso vale para qualquer sumiço futuro.
- **D3 — a ordem das gavetas vem de `economia.mercadorias`** (dado), não de
  `Object.keys` (proibido pelo contrato da F05a) nem de ordem alfabética
  (inventaria ordem em código). O teste e o roteiro **derivam** a ordem esperada
  do dado: uma lista digitada continuaria passando se a fonte mudasse de lugar.
- **D4 — `hp`, `hpTotal` e `progresso` saem do que já existe** (`predio.hp` e o
  `hp` do dado). Obra e prédio de pé usam o mesmo par; o painel escolhe o rótulo.
- **D5 — "não pede trabalhador" e "vago" são dois campos, não um.** O armazém
  **não ganha a linha de ocupante**; a pedreira vazia ganha a linha dizendo "sem
  trabalhador". Um campo só juntaria causas opostas: não cabe ninguém ali × cabe
  e está faltando. A distinção vai inteira para o alerta da F22.
- **D6 — o botão manda o VALOR** (`data-pausar="true|false"`), nunca "inverta o
  que estiver aí": com a tela um tick atrasada, um alternador pausaria o que o
  jogador acabou de retomar. É o contrato herdado da F16c. O botão **só nasce em
  prédio com `producao !== null`**, como a nota daquele item registrou.
- **D7 — derrubar é um clique, sem confirmação. Decisão do operador
  (2026-09-23)**, registrada em `IDEIAS.md` **com o custo** — e não em Perguntas
  em aberto, porque a decisão está tomada e uma pergunta aberta convidaria uma
  sessão futura a reabri-la. O custo registrado: é o único botão que destrói
  trabalho de forma irreversível e a devolução é parcial (0.5), então o erro é
  caro. O que segura o clique acidental hoje é a posição: sozinho no rodapé, com
  cor própria, separado das outras ações.
- **D8 — um painel só; a escola virou uma seção dele.** `painel-escola.ts` deixou
  de ser dono de DOM: exporta `desenharSecaoDaEscola(raiz, dados, emitir)`, não
  chama `getElementById`, não mexe em `hidden` e não conhece a seleção.
  `painelDaEscola` continua sendo a fonte. O `<aside>` foi renomeado
  `#painel-escola` → `#painel-predio`, **mantendo posição e largura** para o
  roteiro da F06 (`canvas.right <= painel.left`) seguir valendo.
- **D9 — o atributo do painel é `data-predio-aberto`**, não `data-predio`: este
  último já é o item do menu Build (F06), e o mesmo atributo em dois papéis faria
  seletor de roteiro pegar o elemento errado.

### A sonda: a cadeia da Fase A, medida (não é cobertura contínua)

Antes de escrever o painel, uma sonda descartável (scratchpad, não commitada)
rodou a cadeia inteira **pelo caminho real, só com comandos** — sem injetar
estado. O operador pediu que ela **medisse**, não só semaforizasse: se a cadeia
fecha, é o aceite da Fase A acontecendo pela primeira vez. Os números ficaram em
**`docs/planos/F16b-painel-predio.md` §7**, para a F17 **comparar em vez de
descobrir**. O JSON cru (`test-output/F16b-sonda.json`) existe na máquina mas o
git **ignora `test-output/`** — por isso a medição foi copiada para arquivo
versionado; artefato ignorado não é linha de base para sessão nenhuma:

| etapa | tick |
|---|---|
| treino começa | 29 |
| treino termina | 179 |
| obra completa | 220 |
| especialista ocupa | 241 |
| primeira pedra produzida | 408 |

Reprodutível: duas execuções, os mesmos ticks. Semente `20260920`, uma pedreira
em (38,31) com a rua em y=33, x 29..40 — geometria derivada do dado, e **sem
nenhum `command-rejected`**, o que confirma de passagem que esse encaixe passa na
regra da porta da F16a.

**Achado que muda roteiro alheio**: a gaveta `saida` da pedreira fica **vazia
quase o tempo todo** — o carregador leva a pedra assim que ela sai (pedra
presente em 2 de 24 amostras entre os ticks 240 e 700). Afirmar conteúdo de
gaveta de prédio de produção **oscila**; estoque cheio se prova no **armazém**.
Foi por isso que o roteiro da F16b não afirma o conteúdo da gaveta da pedreira.
Registrado como Nota na F17.

**A sonda é prova do momento, não cobertura.** O que protege daqui para frente é
`tools/shots/F16b.js`, que roda a mesma cadeia a cada `npm run shot -- F16b`.

### Verificado (evidência aberta nesta sessão)

- `npm run verify` verde: **850 testes, 48 arquivos**; typecheck, lint e
  `validate:data` (9 arquivos, 0 erros) limpos.
- `npm run shot -- F16b`: **OK, 5 capturas**, passando na primeira execução.
  `screenshots/F16b-3-completo-ocupado.png` **aberto com Read** — o painel da
  Pedreira mostra "Firmeza 250/250", "Quem trabalha: Cabra da Pedreira" (nome do
  sertão, não o id `stonemason`), as gavetas "Entra —" e "Sai —", o botão "Parar"
  e o "Derrubar" destacado no rodapé. É o aceite do item: prédio completo e
  ocupado, com a demolição por clique provada no mesmo roteiro.
- `test-output/F16b.json`: o seletor nos cinco casos (completo ocupado, pausado,
  obra, armazém, id inexistente → `null`).
- Não-regressão por **código de saída**: `F13b`, `F06` e `F07` → **0** nos três.
  Screenshot deles não foi aberto (§8: imagem é o que mais pesa na janela).

### Hipótese (não verificada)

- A folga de `TICKS_ATE_OCUPAR = 300` sobre os 241 medidos parece confortável,
  mas só foi observada com **uma** pedreira e o armazém cheio do estado inicial.
  Com a vila da F17 (4 prédios disputando carregadores) a ocupação deve demorar
  mais; quanto, não foi medido nesta sessão.

### Fora de escopo, declarado

Não entraram: modos do Woodcutter's (saíram na F16c), confirmação de demolição
(decidida contra, ver D7), evento de pausa (sem consumidor — a tela lê o campo),
e alerta sem seleção, que é da F22. `src/input/selecao.ts` e
`src/input/teclado.ts` **não foram tocados**: a seleção já era genérica (guarda
só um id); o que era específico da escola era o painel devolver `null` para o
resto.

## F17 — Aceite da Fase A (2026-09-23)

Plano: `docs/planos/F17-aceite.md`; a medição inteira está na §8 dele, porque
`test-output/` é gitignored e número que some não serve a sessão nenhuma.

O critério do BUILD_PLAN, inteiro, em dois lugares: `tests/F17-aceite.test.ts`
(headless) e `tools/shots/F17.js` (cliques). A vila sobe **por comando** nos
dois — não existe ponte para injetar prédio, unidade ou estoque, e é de propósito:
este é o único teste que exercita as sete features da Fase A de uma vez.
**Nada em `src/` foi tocado.**

### Verificado (rodei e abri)

- **O critério é satisfazível como está escrito. Não corrigi critério nenhum.**
  Ele fecha no **tick 3184** (≈5,3 min a 1x); os quatro prédios ficam completos e
  ocupados no **1077** (≈1,8 min). O operador tinha autorizado trocar a medida se
  isso exigisse ≥6000 ticks — **a condição não disparou**.
- Teto do teste = 3184 + 25% = **4000 ticks**, com o comentário dizendo de onde
  veio. Provei que o teste ACUSA: com o teto em 500 ele reprova nomeando o prédio
  e o estado (`woodcutters@16 nao ficou completo: expected 'obra' to be 'completo'`).
- `npm run verify` verde. Regressão por código de saída: F16b, F13b, F08, F07,
  F06, todos 0 — screenshots não abertos, só o código (§8 do CLAUDE.md).
- Aceite visual aberto com Read: `screenshots/F17-5-final.png` — as quatro casas
  em fila com a rua à frente, unidades andando nela, e o HUD em **Tábua 41**
  contra as 40 iniciais.
- **Linha de base da F16b contra quatro prédios** (§8.2 do plano): treino
  idêntico (24/174 contra 29/179), obra +45, ocupação **+286**. A ocupação é o
  único número que estourou, e **a causa não é disputa por carregador**: é a
  ordem da fila de treino — o pedreiro é o terceiro a sair da escola enquanto a
  pedreira, primeira a ficar pronta, espera por ele.
- **Saldo ≠ acumulado**, medido: o marco "primeira entrega" respondia `null` para
  stone **com 17 pedras entregues**, porque comparava o saldo com a linha de base
  do tick 0 e a pedra foi gasta abaixo dela. Corrigido para o primeiro delta
  positivo. O acumulado entregue (15 stone, 8 tronco, 14 tábua até o tick 3184)
  bate por três vias independentes: delta positivo, `task-completed` e
  `goods-produced`.
- As três observações do BALANCE_LOG estão medidas e datadas lá. Resumo: o efeito
  dos laborers existe mas a causa suposta cai (não largam a obra no meio); a
  regra da porta não custou um tile; o gargalo do ritmo é a PEDRA (o armazém
  chegou a 3), não a construção.

### Um defeito real, achado pela sonda e corrigido no cenário

A primeira corrida deu `todos-ocupados: null` com os quatro prédios subindo e
zero recusas. A rua ia da ponta da fila até o armazém e **não alcançava a porta
da escola**: sem estrada até ela o ouro do treino nunca chega, a fila fica em
`sem-estrada` para sempre (o caso que a F13b isolou) e ninguém ocupa nada.
**Não é bug do jogo** — o jogo reportou certo; era geometria errada do cenário.
Corrigido, e protegido por uma guarda que recusa a geometria se escola e armazém
não estiverem na mesma linha de porta.

### Decisões

- **D1 — a ordem dos comandos reage ao ESTADO, não ao relógio.** A serraria é
  plantada no primeiro tick em que `estaDesbloqueado` responde true, não num tick
  fixo. Tick fixo viraria um número mágico que quebra em silêncio quando o
  balanceamento mudar.
- **D2 — "ligados por estrada" não virou campo novo em `render/debug.ts`.** Na
  tela a ligação se prova por CONSEQUÊNCIA, que é mais forte que um booleano:
  material só chega a obra com rede, e cabra treinado só ocupa prédio que recebeu
  material. O booleano está afirmado no headless, onde `predioLigadoAoArmazem` é
  importável.
- **D3 — o desbloqueio se afirma pelo `aria-disabled`, não pela presença.** O
  menu Build mostra o prédio bloqueado de propósito (decisão da F06, com o texto
  do requisito). Afirmar presença teria passado mesmo se a serraria estivesse
  liberada desde sempre — não provaria desbloqueio nenhum.
- **D4 — nenhuma asserção na gaveta `saida` de prédio de produção**, em teste ou
  roteiro, como a nota da F16b no item pedia. Estoque se prova no armazém.
- **D5 — a geometria é derivada do dado**, não digitada: largura e altura saem de
  `caixaDeTipo` (o mesmo caminho que a sim usa), a linha da rua sai da altura do
  armazém, o civil sai de `buildings.trabalhador`. O helper **lança** se os
  quatro prédios tiverem alturas diferentes, em vez de adivinhar.

### Hipóteses (não confirmadas por execução)

- **A ocupação melhoraria enfileirando o pedreiro primeiro.** A causa (ordem da
  fila) está medida; a melhora, não — eu não rodei a variante. É mudança de
  cenário, não de código, e vale a medição quando alguém for mexer no arranque.
- **A abertura do GDD §1.3 inteira (16 prédios) não cabe em 8–10 min por falta de
  pedra.** A aritmética está no BALANCE_LOG (~162 ticks por pedra, 2 de folga no
  fim desta abertura). Não rodei a abertura inteira.

### Detalhe de nomenclatura

O item pede a evidência em `screenshots/F17-final.png`; o runner numera as
capturas e o arquivo é **`screenshots/F17-5-final.png`**. É a convenção fixa do
`tools/shot.js`, igual para toda feature — não renomeei nada.


## Sonda do operador — prioridade do serf ocioso (2026-09-23)

Pergunta dele: *"quando um serf fica ocioso e existe uma obra esperando material,
ele prefere a tarefa da obra à de levar excedente ao armazém? Mostre o teste ou a
medição, não deduza da escada."*

**Resposta: sim, prefere a obra — e a preferência é da ESCADA, não da distância.**

### Verificado (rodado, `tests/sonda-serf-prioridade.test.ts`, arquivo temporário já apagado)

**(a) Laboratório.** Pedreira `q1` em (26,34) com `stone: 2` na gaveta `saida`
(nível 6) **e** `timber: 2` na `entrada`, que a pedreira não consome e por isso
vira excedente (nível 7). Obra em (42,34) pedindo `stone: 2` (nível 3), ligada
pela mesma rua. **Um** serf, nascido em (27,36) — em cima da porta da pedreira,
a ~15 tiles da obra. Passando por `step` de verdade, não por `tarefasEmOrdem`:

- **controle, sem a obra no mapa:** o serf reclama `saida-cheia-para-armazem` no
  tick 2. Prova que a tarefa do armazém existia, era alcançável e ele a pegaria.
- **com os dois lados abertos:** cardápio `{material-para-obra: 2,
  saida-cheia-para-armazem: 2, excedente-para-armazem: 2}`, e ele reclama
  **`material-para-obra`**, no mesmo tick 2.

O controle é o que dá valor ao resultado: sem ele, "foi para a obra" poderia ser
"não conseguiu reclamar a outra". A carga estava aos pés dele e a obra a 15
tiles; escolheu a obra.

**(b) Corrida real — e aqui está o achado que interessa.** Rodando a abertura
inteira da Fase A (4000 ticks, os mesmos comandos do aceite da F17) e anotando
todo claim de serf: **88 escolhas, e `ticksComOsDoisLadosAbertos = 0`.** A
colisão da pergunta **nunca acontece jogando** na Fase A. Distribuição das 88:
`saida-cheia-para-armazem` 51, `material-para-obra` 22, `insumo-producao-parada`
11, `ouro-para-escola` 4 — sempre com um tipo só aberto por vez.

Bate com o que a F15b já tinha medido e está no `BALANCE_LOG`: com 4 serfs a fila
do quadro nunca acumula. A regra existe e está correta; ela é **teoria** na Fase A.

### Cobertura permanente: não existe

Antes da sonda, procurei. `tests/F13a-ouro.test.ts:104` é o **único** teste de
comportamento que compara tipos de nível diferente (ouro 2 na frente de material
3), e mesmo ele afirma sobre `tarefasEmOrdem`, que é a ordenação, não a escolha.
O resto (F13a, F15b) compara `nivelDoTipo` como **dado**, o que prova o arquivo,
não o comportamento. **Não há teste nenhum cobrindo material-para-obra contra os
dois tipos que vão para o armazém.** A sonda foi prova do momento, não cobertura
(CLAUDE.md §8): apagada depois de reportada. Se o operador quiser a regra
protegida, isso é um item de fila, não um efeito colateral desta sessão.


## F17b — Material entregue visível na obra (2026-09-23)

Feature de integração (`render/` + `ui/` na mesma feature, nota escrita no
BUILD_PLAN **antes** do código). **`src/sim/` não mudou** — exceto a Tarefa 0,
que é a correção da F16b e tem commit próprio. Plano em
`docs/planos/F17b-material-na-obra.md`.

### Verificado (comando rodado, evidência aberta)

- `npm run verify` **exit 0**, 866 testes em 51 arquivos (código de saída do
  comando inteiro, não do `tail` — a lição da F17).
- `npm run shot -- F17b` **exit 0**, 24 afirmações, 0 erro de console.
  Evidência em `test-output/F17b-shot.json`.
- `npm run shot -- F16b` **exit 0** (não-regressão do painel; imagem não aberta,
  §8).
- Screenshots abertos com Read: `F17b-2-cheio.png` (os blocos no mapa, tábua
  cheia) e `F17b-3-painel.png` (`Em obra 4%` / `Material  Tábua 3/3  Pedra 0/2`).
  Só estes dois.
- **O medidor enche, medido contra a primeira leitura**: tábua `0/3 → 3/3` em
  ~150 ticks, teto declarado de 1000. É esta a prova de D3 — sem a assinatura
  dos `entregue` na chave do diff de `atualizarPredios`, o medidor nasceria
  correto e congelaria, e uma foto única passaria assim mesmo.
- Painel e mapa conferidos **um contra o outro** no roteiro: mesma
  `medidorDaObra`, mesma saída.

### Correção da F16b (Tarefa 0, commit `e014a0c`)

`gaveta()` do seletor filtra `quantidade > 0`, e o `faltam` da obra usava essa
mesma gaveta: material inteiramente entregue **sumia** e a obra que já recebeu
toda a tábua ficava idêntica à que nunca pediu tábua. Corrigido com
`faltamDaObra`, que deriva a lista do **custo** e não das chaves de `faltam`. O
filtro continua em `gaveta` (sem ele o armazém listaria dezenas de zeros). Isso
virou infraestrutura do medidor: a ORDEM que o painel usa sai de `dados.faltam`.

### Decisões

- **D3 (a que o operador destacou)** — a assinatura `entregue.join(',')` entra na
  chave do diff ao lado de `(estado, estágio)`. Entrega não mexe em `hp`, logo
  não mexe em estágio.
- **Emenda ao D8** — o plano mandava importar `ordemDasMercadorias` de
  `render/predios.ts` no painel. Não importei: aquele arquivo lê `sim/data`, e
  `ui/` não lê `sim/data` de propósito (topo de `menu-build.ts`). A ordem sai de
  `dados.faltam`, que já vem na ordem de `economia.mercadorias` com uma entrada
  por material do custo. O custo continua vindo de `opcoesDoMenuBuild`, como o
  plano pediu. De `render/` o painel importa só `medidor-obra.ts`, que **não tem
  import nenhum**.
- **A gaveta "Falta chegar" saiu do painel da obra.** Com o medidor ao lado, a
  primeira captura mostrou "Tábua 0" logo acima de "Tábua 3/3": duas leituras do
  mesmo número, uma delas pior. `Pedra 0/2` diz tudo o que `Pedra 2` dizia e
  ainda dá o denominador. A asserção do roteiro da F16b foi apontada para
  `[data-gaveta="material"] [data-medidor]`, com o porquê escrito lá; o critério
  de aceite da F16b no BUILD_PLAN **não** foi tocado. `painelPredio.faltaChegar`
  saiu do tema por não ter mais consumidor (grep conferido antes).
- **Tarefas 4 e 5 executadas em ordem trocada** (painel antes do roteiro): a
  Tarefa 4 afirma `[data-medidor]` no DOM, que só existe depois da Tarefa 5.
  Na ordem do plano o roteiro nasceria vermelho por dependência, não por defeito.
- **Ordem da execução**: T0 (`fix(F16b)`), T1+T2, T1b (a escada), T3 (mapa),
  T5 (painel), T4 (roteiro), T6.

### A escada do serf, por decisão do operador (Tarefa 1b)

A sonda virou `tests/F17b-escada-do-serf.test.ts`, cobertura permanente: montagem
adversarial (a carga do armazém **mais perto** que a obra, os dois custos saindo
do A\* real, 0 vs 75), controle sem a obra, e a escolha com os três tipos abertos.
**Provado que o guarda acusa**: invertendo `material-para-obra`→7 e
`excedente-para-armazem`→3 em `data/delivery.json`, ele falha com
`expected 'excedente-para-armazem' to be 'material-para-obra'`; o dado foi
restaurado e `git diff --stat data/delivery.json` voltou vazio.

### Hipótese, não fato

- **O F09 estourou o timeout de 5 s duas vezes** durante a sessão
  (`tests/F09-sistema.test.ts:429`), e passou em todas as corridas seguintes.
  Medido: F09 sozinho 3,50 s na árvore limpa e 3,61 s na minha; suíte inteira
  20,14–20,82 s morna e 29–30 s fria. **Hipótese**: disputa de cache frio entre
  workers paralelos contra um orçamento de 5 s apertado num teste de carga, sem
  relação com esta feature (F09 não chama `painelDoPredio`). Não mexi no
  timeout, não pulei nem ignorei nada (§10). Se voltar, é item de fila.
- O `data-cheio="true"` do painel (destaque verde do material completo) é
  afirmado só pela existência do atributo, não pelo pixel da cor.

## Escala de mapa, névoa e zoom — sessão de medição e projeto (2026-09-23)

Sessão **sem implementação**, a pedido do operador: medir, propor, parar. O que
mudou no repositório foram três documentos — dois itens novos no `BUILD_PLAN.md`
e a §6.5 no GDD. Nenhuma linha de `src/`.

### Verificado — medição de escala do mapa

Cinco sondas headless (descartáveis, fora do repositório) passando `dados` por
parâmetro, que `step` e `buscarCaminho` já aceitam; mais uma em browser, descrita
abaixo. Mapa de grama uniforme nos três tamanhos — portanto estes números são o
**piso**: um mapa 256² real teria obstáculos e caminhos mais longos.

| | 64² | 128² | 256² |
|---|---|---|---|
| A* curto (3 tiles), cache frio — µs/busca | 40 | 94 | **303** |
| A* travessia ponta a ponta — ms/busca | 2,1 | 9,4 | **32,9** |
| Cardápio do serf ocioso (174 tarefas), cache quente — ms | 0,61 | 0,54 | 0,64 |
| Cardápio, cache frio — ms | 1,58 | 2,58 | **6,03** |
| Carga do F09 (20 obras, 300 ticks, sem serfs) — ms | 2680 | 3008 | 3038 |
| Oráculo (600 ticks, com serfs) — ms | 57 | 37 | 28 |
| BFS de estrada, 50 consultas — ms | 0,6 | 1,2 | 1,9 |
| `JSON.stringify(estado)` — KB | 29 | 29 | 29 |
| Tiles desenhados (culling) | 234 | 234 | 234 |
| Heap do browser — MB | 48,1 | 48,1 | 57,5 |
| Quadro mediano — ms | 16,6 | 16,6 | 16,7 |

**Degrada só o A*, e pela preparação, não pelo caminho.**
`src/sim/pathfinding.ts:241-242` aloca e preenche `Float64Array(largura*altura)`
+ `Int32Array(largura*altura)` a cada busca: 48 KB → 192 KB → 768 KB por
chamada. Daí os 7,6× numa caminhada idêntica de 3 tiles. Virou o item **F17c**.

**Não degrada**: o BFS de estrada (`distanciaPorEstrada` só varre tiles de
estrada, memoizado pela referência de `estradas` — acompanha o comprimento da
rua: 62 → 126 → 254 tiles); o tamanho do `GameState` (o mapa não mora nele); o
culling do render; o custo de quadro. Os +9,4 MB de heap a 256² são os 65 536
objetos de tile que `camada.fill(0,0,0,largura,altura)` cria **na abertura** —
custo fixo de boot, não por quadro.

**O cache esconde quase tudo, e é aí que está a armadilha.** O oráculo fez 8
buscas reais e 28 acertos nos três tamanhos. O cache é chaveado nas referências
de `estradas`/`predios.ordem`, ou seja **invalida a cada estrada construída e a
cada prédio plantado**; no tick seguinte cada serf ocioso refaz o cardápio
inteiro. Dez serfs ociosos a 256² = 60 ms num tick de 100 ms.

**Uma medida saiu do headless, de propósito e uma vez só.** Culling não é
observável sem tela. Editei `data/terrain.json` temporariamente para 128 e 256,
rodei um roteiro descartável lendo `tilesRenderizados`, `performance.memory` e 90
quadros de rAF, e depois `git checkout data/terrain.json`, apaguei o roteiro e o
`test-output` dele e conferi `git status` vazio. As outras cinco sondas são
headless.

**Sondas são evidência do momento, não cobertura.** As seis foram apagadas. A
proteção permanente contra a regressão do A* é a contagem de alocação que o
aceite da F17c pede — coisa distinta, escrita no item.

### Decisões do operador

- **A F17c vem antes de qualquer mapa maior.** O buffer por busca é defeito, não
  limite. Ordem dele, revendo a minha proposta, que punha o zoom primeiro.
- **F18a (zoom) aprovada como escrita**, e pela razão medida: navegação, não
  desempenho. A 256², com tile de 64 px e viewport de 1280×720, o jogador
  enxerga 20×11 tiles — 0,35% do mapa.
- **A névoa entra no GDD agora, sem item de fila**, nível de regra para unidade e
  prédio inimigos e nível de apresentação para terreno, com as duas lacunas
  fechadas de forma conservadora (prédio revela footprint mais raio pequeno;
  civil com visão 9 declarada em `data/units.json`). Sem item porque **depende de
  facção**, que não existe em `src/sim/state.ts` e chega com a F28.

### Escrito no GDD

Nova **§6.5 — Visão e névoa de guerra**, logo depois de §6.4, porque é ali que
moram as regras de simulação sobre unidades e porque a §12.2 (Anexo A) deixa de
ser tabela órfã: `visao` 9/18 já está em `data/units.json` desde sempre, sem
consumidor. Mais três edições menores: a linha de **não-regra** na §6.4 — *névoa
não afeta pathfinding nem JobBoard* —, a linha da camada de névoa na tabela de
telas da §7.2 (P1) e *exploração não é objetivo* na §8.2.

A linha de não-regra é a que importa mais do que parece: sem ela, a primeira
sessão que implementar névoa faz o serf se perder no escuro.

### Hipótese, não fato

- A queda do oráculo (57 → 37 → 28 ms) com o mapa **maior** é quase certamente
  ruído de JIT, não ganho real — o cenário faz o mesmo trabalho nos três
  tamanhos. Não investiguei.
- `bootMs` no browser veio 1133 / 688 / 1337 nos três tamanhos: dominado pela
  subida do Vite, não pelo tilemap. Não dá para concluir nada sobre custo de
  abertura a partir desses três números.

## F17c — Buffer do A* reaproveitado (2026-09-23)

Item criado pelo operador na frente da F18a, depois da sessão de medição acima:
*"é defeito, não limite"*. Só `src/sim/` — nenhum arquivo de `render/` ou `ui/`
foi tocado.

### O defeito

`executar` alocava, **por busca**, um `Float64Array(largura*altura)` preenchido
com `+Infinity` e um `Int32Array(largura*altura)` preenchido com `-1`. O custo
de *preparar* a busca era proporcional à **área do mapa**, não ao trabalho feito:
48 KB a 64², 192 KB a 128², 768 KB a 256², para uma caminhada de 3 tiles.

### O conserto

Rascunho no escopo do módulo (`rascunhoG`, `rascunhoPai`, `rascunhoMarca`),
capacidade que **só cresce**, e **marca de geração**: `marca[i] === geracao`
substitui a sentinela `+Infinity`, então nenhum vetor precisa ser limpo entre
buscas. Quando `geracaoAtual` chega a `0x7fffffff` (limite de representação de
`Int32Array`, não número de balanceamento), `marca` é zerado uma vez e a
contagem recomeça. Vetor recém-alocado já vem zerado, então a geração volta a 0
junto — sem isso, uma marca velha de outro vetor poderia coincidir.

### Verificado

- **Aceite, `test-output/F17c.json`** (aberto com Read): 400 buscas de 3 tiles
  com cache frio em cada tamanho, depois de 100 de aquecimento — **10,1 µs a
  64², 4,8 µs a 128², 3,7 µs a 256²**. Razão 256²/64² = **0,37**, contra **7,6**
  medidos antes da feature (40 / 94 / 303 µs). O custo não cresce mais com a
  área; a inversão vem de o 64² rodar primeiro e pagar o JIT do trio.
- **Guarda permanente é estrutural, não cronômetro:** `estatisticasDoRascunho()`
  conta alocações. 900 buscas inéditas espalhadas pelos três tamanhos alocam no
  máximo **3** (uma por tamanho distinto); com o rascunho já grande, mais 900
  alocam **0**; depois do 256², cinquenta buscas a 64² mantêm a capacidade e
  alocam 0. O cronômetro é o aceite; o contador é o que protege daqui em diante.
- **O oráculo Dijkstra da F10 não mudou.** `tests/F10-astar.test.ts` e
  `tests/F10-falhas.test.ts` passam **sem uma linha alterada** — era o ponto 2
  do operador. `git status` durante a Task 1 mostrou só `src/sim/pathfinding.ts`
  e o arquivo de teste novo.
- `npm run verify` verde: **52 arquivos, 873 testes**, 23,2 s.

### Por que a contagem não entrou em `estatisticasDeBusca()`

O texto original do item dizia que entraria. Entraria errado:
`EstatisticasDeBusca` é comparado por **seis asserções `toEqual` sobre o objeto
inteiro** em `tests/F10-astar.test.ts` (linhas 357, 365, 372, 388, 409, 424), e
um campo novo derrubaria as seis — justamente o arquivo que o operador mandou
não tocar. A contagem foi para um export novo, `estatisticasDoRascunho()`, com
objeto próprio. O operador corrigiu o item no BUILD_PLAN antes da execução e
registrou a razão: busca e cache num lugar, memória em outro.

### A guarda de reentrância

`ocuparRascunho` lança se já houver uma busca em curso, e `executar` a solta num
`finally`. **Nenhum caminho do código de hoje a alcança**: os 8 chamadores
(`jobs.ts:300,303,318,331,346`, `systems/serfs.ts:75,142,181`) são todos de
topo, a busca não aceita callback, e a única função externa que ela chama
(`footprintsDe` → `caixaDoPredio`, em `src/sim/footprint.ts`) importa só tipos.
A guarda é para amanhã — e é testada **acusando**, não só não-acusando: o teste
força a reentrância por uma costura real (um getter em
`dados.movimento.ticksPorTile.aPe.grama`, lido durante a busca) e afirma que a
costura foi mesmo exercitada.

### BUG-001 fechado no caminho

`npm run verify` desta sessão estourou o timeout de 5 s em `F09-sistema:429` —
terceira ocorrência, com cache frio, como o registro previa. Apliquei a correção
que o próprio BUG-001 já tinha decidido: **orçamento explícito de 20 s nesse
caso**, comentado com o número medido (3,46 s isolado nesta sessão), e o bug saiu
do `BUGS.md` no mesmo commit. Não é `skip`, não reduz a carga do cenário e não
afrouxa o orçamento global.

### Desvio do plano, registrado

A Task 3 do plano salvo usava índices `5000+i` e `10_000+i` em
`buscaCurtaInedita`. Estariam **fora do mapa**: a função deriva
`y = 12 + floor(i/40)`, então `i = 10_000` daria `y = 262`, além da borda a 64².
Troquei por aquecimento em `[0,99]` e medição em `[100,499]`, dentro dos 640
pares livres da faixa. O cache é chaveado pela referência de `dados`, que muda a
cada tamanho, então repetir índices entre tamanhos não gera acerto de cache — e
o teste afirma `acertos === 0` nos três.

### Hipótese, não fato

- Que o 64² tenha ficado **mais lento** que o 256² (10,1 contra 3,7 µs) é
  quase certamente JIT: ele roda primeiro no laço dos três. Não isolei.
- O teto do teste é 3,0, frouxo de propósito — o medido é 0,37. Se um dia
  oscilar, a correção é alargar o teto **com o motivo escrito**, nunca `skip`.


## F17f — O primeiro sprite real: armazém (2026-09-23)

### Decisões do operador, antes do código (2026-09-23)

- **Base em 1536×1024 versionada; o derivado 192×128 é gerado pela feature.**
  Não se versiona só o derivado: sem a base não há como reajustar um frame sem
  refazer o conjunto (§9). Não se carrega a base: o jogo lê só `assets/sprites/`.
- **Armazenamento não é restrição.** Decisão explícita dele, tomada com o número
  na mesa — ver "A consequência medida" abaixo.
- **As imagens moram por id neutro da simulação.** `assets/edificios/armazem/`
  era caixa de entrada; a base passou a `assets/base/storehouse/`, **mantendo o
  nome que o autor deu aos arquivos** (`armazem_01_obra.png` etc.), porque a base
  é o registro da geração. Quem traduz id → arquivo é o `assets/manifest.json`,
  e nada no código parseia nome de arquivo.
- **Duas regras novas na §9 do CLAUDE.md**: base e derivado entram no git, o jogo
  carrega só `sprites/`; e arquivo de asset não se abre com Read em sessão de
  código — imagem só entra no contexto como evidência da feature atual.

### A consequência medida do versionamento da base

Verificado, com `ls` nos arquivos entregues: o trio do armazém pesa **7,0 MB**
(2,04 + 2,38 + 2,35). Nessa escala, **28 prédios × 3 estágios ≈ 170 MB** de base
no histórico do git. **Histórico não encolhe**: apagar o arquivo depois não
recupera o espaço — só um `filter-repo` recuperaria, e isso é reescrita de
histórico, que o §10 proíbe. O operador tomou a decisão com esse número à vista.

O derivado é outra ordem de grandeza e não pesa: os três de 192×128 somam
dezenas de KB.

### Verificado nesta etapa

- `.gitignore`: `*.png` continua, com `!assets/**/*.png` logo abaixo.
  `git status --porcelain` passou a listar `assets/base/` como não rastreado —
  essa é a prova, não o código de saída do `git check-ignore`, que devolve 0
  tanto para regra quanto para negação. `screenshots/` e `test-output/` seguem
  ignorados: as regras deles são de diretório e não dependem da extensão.
- A linha solta `assets/edificios`, que eu tinha encontrado acrescentada e não
  commitada ao fim do `.gitignore` na sessão de planejamento, **não existe mais**
  na árvore de hoje. Não removi nada: ela já tinha saído.

### O que foi feito, e o que cada peca decidiu

- **O `assets/manifest.json` nao existia.** O CLAUDE.md o cita desde a F01 e
  nenhuma feature o criou — os 28 predios sempre foram retangulo, e retangulo nao
  precisa de manifesto. Esta feature o criou com **uma** entrada (`storehouse`).
  As outras 27 continuam ausentes de proposito: ausencia **e** o placeholder.
- **`src/render/manifesto.ts`, zero imports.** Resolver id -> arquivo e id ->
  chave de textura e logica pura; nao precisa de Phaser nem de `data/`. Fica
  coberto pela guarda estrutural generica de `tests/F04-grid-ortogonal.test.ts`,
  que varre todo arquivo de `src/render/` — nao foi preciso cadastrar o arquivo
  novo em lugar nenhum.
- **A dimensao derivada e 192x128, e nao 192x192.** `1536 = 192 x 8` exato, e a
  razao da arte e 3:2. A regra que a feature fixa: **a largura manda**
  (`tamanho[0] === footprint[0] x tilePx`, com guarda no teste), e a altura e o
  que a arte der, gravada no manifesto e conferida contra o **cabecalho do PNG**
  (bytes 16-23), sem abrir a imagem. O desenho escala por **um** fator.
- **A derivacao nao recorta.** Os tres estagios tem bbox de alpha diferente
  (1454x961, 1498x964, 1514x1007) com offsets diferentes; recortar cada um pelo
  seu conteudo faria o predio **pular** ao trocar de estagio. `tools/derivar-
  sprites.js` escala o canvas inteiro, e o registro se preserva por construcao.
  O preco e a margem transparente: o sprite nao encosta na borda do footprint.
- **`derivar-sprites.js` roda a mao; nao esta no `verify`.** Gerar arte e ato
  humano (§9), e o `verify` nao pode depender de Chromium. O que o `verify`
  garante e o outro lado: o teste headless reprova se um arquivo declarado
  sumir ou mudar de dimensao.
- **`sprites-urls.ts` e o unico arquivo que fala com o bundler.** `import.meta.
  glob` resolve as URLs com hash em build; `sprites.ts` so enfileira o que o
  manifesto declara **e** o glob resolveu. Sem isso o PNG carregaria por caminho
  relativo e quebraria em producao — e o runner de screenshot reprova por erro
  de console, entao um 404 derruba a feature sozinho.
- **`debug.spritesDePredio`**: por id, a chave de textura ou `null`. Os dois
  lados do §9 na **mesma** estrutura — e assim que o roteiro prova que sprite e
  placeholder convivem, sem olhar pixel (§8). A chave de diff de
  `atualizarPredios` nao mudou: textura e funcao de `(tipo, estagio)`, e
  `estagio` ja estava na chave.
- **Um bloco de eslint de um arquivo so** para `derivar-sprites.js`
  (`Buffer`/`document`/`Image`): configurar a regra para o caso legitimo, nao
  ampliar `ignores` nem usar `eslint-disable` (§10).
- **Perspectiva divergente, conhecida.** A arte fornecida e **isometrica**; a
  convencao do projeto (§9.3) e 3/4 sobre grid ortogonal. Usada assim por decisao
  do operador: o objetivo era validar manifesto, dimensao e ancoragem, nao a arte
  final. Registrado no `origem.nota` do manifesto e na Nota do item.

### Verificado (evidencia aberta nesta sessao)

- `npm run verify` — **53 arquivos, 882 testes**, typecheck e lint limpos,
  `validate:data` 9 arquivos / 0 erros. Codigo de saida 0.
- `npm run shot -- F17f` — codigo de saida 0, 2 capturas. O runner reprova por
  erro de console, entao as capturas tambem provam que nenhum asset deu 404.
- `screenshots/F17f-1-armazem-placeholder-unidade.png` **aberto com Read**: o
  armazem desenhado por PNG, a Casa do Coronel como retangulo marrom com o nome
  escrito, e seis unidades no mesmo quadro. A escala fecha com o GDD — a unidade
  (32 px) da mais ou menos a altura da porta do armazem.
- `tests/F17f-manifesto.test.ts` — 9 casos: os tres arquivos do armazem
  resolvem e existem, cada um com a dimensao declarada no cabecalho; `quarry` e
  `schoolhouse` resolvem `null`; **27 dos 28** predios nao tem arte.

### Hipotese, nao verificado

- **A margem transparente do derivado pode desalinhar predios vizinhos.** O
  sprite nao encosta na borda do footprint (consequencia de nao recortar), e na
  foto o armazem parece flutuar um pouco a esquerda do seu quadrado. Nao foi
  medido contra o grid, e nao ha um segundo predio com arte para comparar. Volta
  quando o segundo sprite entrar.

### O que ficou de fora, e por que

- **As fotos dos estagios `marcacao` e `madeira` do armazem.** Impossiveis hoje:
  o armazem e **permanentemente nao construivel** — `data/buildings.json` da a ele
  `"desbloqueadoPor": null` e `menuBuildInicial` esta vazio, entao
  `estaDesbloqueado('storehouse')` e sempre `false`, enquanto a arvore do GDD
  (`docs/GDD.md:262-282`) pendura "Storehouse (adicional)" na **Sawmill**.
  Registrado como **BUG-002**, com a correcao ja escrita (`"desbloqueadoPor":
  "sawmill"`). Os tres estagios continuam provados no teste headless; o que falta
  e so a prova na tela. A Evidencia do item da F17f foi corrigida para o que
  existe, e a foto 2 passou a ser uma obra de `woodcutters` (sem arte) **ao lado**
  do armazem com sprite — a convivencia que a feature existe para garantir.
- **A chave da F12 nao foi virada para `false`.** O aceite dela **como esta
  escrito** (Casa do Lenhador -> Serraria -> Rocado) passa; o que falha e o
  "Storehouse (adicional)" da arvore, que aquele aceite nunca listou. Virar ou
  nao e decisao do operador.
- **`assets/edificios/` continua fora do git.** Sobraram ali os PNGs de
  `casa_lenhador`, que a negacao do `.gitignore` tornou versionaveis. Nao foram
  commitados: sao arte de um predio que esta feature nao cobre, e o que entra em
  `assets/base/` e decisao humana (§9).

## BUG-002 — o armazém adicional exige Serraria (2026-09-23)

Fora da fila: correção de bug com a emenda já escrita, por ordem do operador.
`BUG-002` saiu do `BUGS.md` no mesmo commit que o corrige (§12).

### O que foi feito

- **`data/buildings.json`: `storehouse.desbloqueadoPor` de `null` para
  `"sawmill"`.** É o que o GDD §5.2 sempre disse: o armazém inicial vem de pé no
  cenário, o **adicional** exige Serraria. Enquanto o campo era `null` e
  `menuBuildInicial` estava vazio, `estaDesbloqueado('storehouse')` era `false`
  para sempre — o item nascia cinza e nunca acendia.
- **A árvore perdeu a raiz, e isso é correto.** Com a emenda o grafo fecha o
  ciclo `storehouse → sawmill → woodcutters → schoolhouse → storehouse`, e
  nenhum dos 28 prédios tem mais `desbloqueadoPor: null`. A regra antiga
  (`predios/raiz-unica` + `predios/ciclo` proibindo qualquer ciclo) modelava a
  semente como "pai nulo", e nesse modelo a correção do operador é
  irrepresentável.
- **`tools/data-rules.js`: `predios/raiz-unica` saiu, `predios/ciclo` estreitou,
  entrou `predios/alcance`.** A semente passou a ser **o que está de pé no tick
  0** — `economy.estadoInicial.predios` mais `menuBuildInicial` — e a regra
  verifica alcance a partir dela, por ponto fixo. Ciclo só é erro se **nenhum**
  de seus membros for semente. Isto não é afrouxar a regra para o `verify`
  passar (§10): é a mesma pergunta que `sim/desbloqueio.ts` já responde em
  runtime com `tiposJaConstruidos`, que também nasce do estado inicial. A regra
  nova acusa três coisas que a antiga não acusava — prédio inalcançável, ciclo
  fora da semente, e abertura sem nenhum prédio de pé — e cada uma tem fixture
  em `tests/F03-dados-validados.test.ts`.
- **`src/sim/data/types.ts`: `PredioData` declara `desbloqueadoPor: string |
  null` explicitamente.** Sem isso a inferência do JSON estreitaria o campo para
  `string`, porque hoje não existe nenhum `null` no dado — o tipo seguiria o
  dado do dia e apagaria a capacidade em silêncio.
- **`tools/shots/F06.js`: a afirmação do rótulo neutro virou a sua consequência.**
  O roteiro provava `semRequisito` ("ainda não disponível") pelo armazém, o único
  sem pai; agora afirma que **nenhum** item do menu fica cinza sem dizer do que
  depende, e que a árvore não tem raiz. `src/ui/menu-build.ts` mantém o ramo, com
  comentário dizendo quem volta a produzi-lo (a fase).
- **`docs/GDD.md` §5.3 e as Notas da F12 no `BUILD_PLAN.md`:** as duas camadas
  (árvore = o que cada prédio **exige**; fase = o que está **disponível** naquela
  missão) e a decisão do operador que as separa.
- **Nenhuma linha de `src/sim/` mudou.** `estaDesbloqueado` já lia
  `tiposJaConstruidos`; a correção era só de dado, e o resto foi a verificação
  que descrevia o dado errado.

### Decisão do operador (2026-09-23)

A disponibilidade do armazém adicional é decisão de **fase**, não só da árvore.
No original as primeiras missões permitem um armazém só, e do meio da campanha
em diante o jogo libera mais. Hoje o jogo tem uma configuração só (sandbox), e a
árvore basta; quando a campanha existir, ela ganha uma camada de permissão por
fase. `economy.estadoInicial.menuBuildInicial` é a casa natural dessa camada — e
é ela que volta a dar dono ao rótulo `semRequisito` e ao ramo
`desbloqueadoPor: null`, que por isso ficam vivos no tipo, na regra de dado e nos
testes com dado sintético. Registrado como decisão, não como pergunta em aberto.

### Verificado (evidência aberta nesta sessão)

- **O segundo armazém é plantável de verdade, não por asserção.**
  `tests/F12-desbloqueio.test.ts`, passo 5: a partir do estado com Serraria de
  pé, um `PlaceBlueprint` de `storehouse` passa por `step()` e a contagem de
  prédios do tipo vai de **1 para 2**, com **zero** `command-rejected`. O
  `requer` da opção no menu inicial é `"sawmill"`, e `storehouse` aparece em
  `filhosDe('sawmill')`.
- **`npm run verify` EXIT=0** — typecheck 0 erro, lint 0, `validate:data` 9
  arquivos e 0 erro, 885 testes em 53 arquivos.
- **Não-regressão por código de saída (§8), sem abrir imagem:** `npm run shot --
  F06` EXIT=0 (3 capturas), `F16b` EXIT=0 (5), `F17f` EXIT=0 (2). F06 é o
  roteiro do menu de construção; F16b e F17f são os que leem o armazém do
  cenário.

### O que ficou de fora, e por que

- **A chave da F12 não foi virada para `false` e depois de volta.** O aceite
  escrito dela sempre passou — o que falhava era o "Storehouse (adicional)" da
  árvore, que aquele aceite nunca listou. A lacuna foi fechada acrescentando o
  passo 5 ao teste e a Nota ao item, com o aceite original intacto.
- **As fotos dos estágios `marcacao` e `madeira` do armazém.** Agora são
  **possíveis** (Casa do Lenhador → Serraria → Armazém), e não foram capturadas:
  conduzir uma obra até `madeira` por clique é o roteiro grande da F17, não um
  passo de correção de bug. O cabeçalho de `tools/shots/F17f.js` e a Nota da
  F17f dizem isso.

## Perguntas em aberto

_(nenhuma no momento: as três que sobravam foram decididas pelo operador — ver "Ajuste pós-F10".)_
