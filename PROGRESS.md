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
| **F16** demolir | remove o prédio; devolução = `devolucaoAoDemolir × (custo − faltam)` |
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

## Perguntas em aberto

_(nenhuma no momento: as três que sobravam foram decididas pelo operador — ver "Ajuste pós-F10".)_
