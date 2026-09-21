# BUILD_PLAN — cangaço

Fila de trabalho. **Uma feature por sessão**, na ordem. Cada feature tem uma
chave correspondente em `test-results.json`, que começa em `false`.

Como ler cada item:

- **Escopo**: o que entra. O que não está aqui não entra.
- **Aceite**: condição verificável por máquina. É o que o avaliador checa.
- **Evidência**: o arquivo que precisa ser aberto antes de marcar `passes: true`.

Regra: se o aceite não puder ser verificado sem um humano interpretando, o item
está mal escrito — corrija o item antes de implementar.

---

## Fase 0 — Fundação (sem jogo ainda)

### F01 — Esqueleto do projeto
- **Escopo**: Vite + TypeScript estrito + Vitest + ESLint. Estrutura de pastas da
  seção 3 do CLAUDE.md, com `sim/`, `render/`, `ui/`, `input/`, `data/`,
  `tests/`, `tools/`. Scripts do `package.json`. Um teste trivial verde.
- **Aceite**: `npm run test`, `npm run typecheck` e `npm run lint` saem com
  código 0. `src/sim/` existe e não tem nenhum import.
- **Evidência**: `test-output/F01.json`

### F02 — GameState e o contrato do tick
- **Escopo**: tipos de `GameState`, `Command`, `GameEvent`. `step(state, commands)`
  pura, retornando novo estado. RNG semeado em `sim/rng.ts`. Nenhum sistema ainda:
  o tick só incrementa `state.tick`.
- **Aceite**: teste que roda 1000 ticks a partir da mesma semente duas vezes e
  compara `JSON.stringify` dos dois estados finais — idênticos. Teste que
  confirma que `step` não muta o estado de entrada.
- **Evidência**: `test-output/F02.json`
- **Nota**: `tests/helpers/determinism.ts` (`compararComESemSave`) é o teste
  canônico de determinismo do projeto. A F23 estende, não reescreve.

### F03 — Dados, escala de tempo e validação
- **Escopo**: carregar os nove arquivos de `data/` (`time`, `buildings`,
  `production`, `units`, `combat`, `condition`, `delivery`, `terrain`,
  `economy`), aplicar as escalas de `time.json` e converter toda duração para
  ticks inteiros no carregamento. Schema + `npm run validate:data`.
- **Aceite**: `validate:data` sai com código 0. Testes que confirmam:
  28 prédios; `hp === (timber + stone) * 50` em todos eles; todo
  `desbloqueadoPor` aponta para um id existente; o grafo de desbloqueio não tem
  ciclo e tem raiz única (`storehouse`); toda duração convertida é inteira;
  trocar `escalas.economia` de 2.0 para 3.0 muda as taxas na proporção esperada
  e **não** muda nenhum valor dos grupos `movimento`, `construcao` ou `combate`.
- **Evidência**: `test-output/F03.json`

### F04 — Grid ortogonal e câmera
- **Escopo**: `render/grid.ts` com `gridToScreen` e `screenToGrid` (grid quadrado,
  tile de 64 px, arte top-down 3/4). Cena Phaser com tilemap ortogonal, mapa
  64×64 de grama. Câmera com arrasto e limites. Highlight do tile sob o mouse.
  Depth sorting por `y`, com culling do que está fora da câmera.
- **Aceite**: teste unitário de ida e volta — para 1000 coordenadas aleatórias
  (RNG semeado), `screenToGrid(gridToScreen(p)) === p`. Screenshot mostrando o
  mapa desenhado e um tile destacado.
- **Evidência**: `test-output/F04.json` + `screenshots/F04-*.png`

---

## Fase A — Loop de construção jogável

O critério de aceite da fase inteira, do GDD: partindo do estado inicial, o
jogador consegue, só com o mouse, construir 2 Woodcutter's, 1 Quarry e 1 Sawmill
conectados por estrada, treinar os trabalhadores e ver o estoque subir. Nenhum
prédio surge sem clique do jogador.

### F05a — Estado inicial
- **Escopo**: cenário inicial da seção 3.2 do GDD (Storehouse e Schoolhouse
  prontos, estoque, 4 serfs, 2 laborers) vivo dentro de `sim/`, vindo inteiro de
  `data/economy.json`. `npm run sim` deixa de ser stub. Nada de render, nada de
  UI — o formato de prédio e unidade no `GameState` é herdado por F07, F10, F11
  e F14, e é revisado isolado, sem decisão de tela no meio.
- **Aceite**: `npm run sim -- inicial --ticks 0` imprime exatamente os valores
  da tabela. O estado sobrevive ao round-trip por JSON. `compararComESemSave`
  (F02) continua passando com o estado povoado.
- **Evidência**: `test-output/F05a.json`

### F05b — HUD e a vila na tela
- **Escopo**: os dois prédios (posição vinda de `economy.json`, meio do mapa)
  desenhados no mapa, `camera.centerOn` na abertura. HUD de topo com gold,
  timber, stone, comida e população, lendo `estoqueTotal`/`contagemPorTipo`
  (F05a) — o HUD não varre prédios por conta própria. Nomes na tela vêm de
  `data/theme-sertao.json`, não dos ids da simulação.
- **Aceite**: screenshot com o HUD legível e os dois prédios no mapa.
- **Evidência**: `test-output/F05b.json` + `screenshots/F05b-*.png`
- ~~**Nota**: `main.ts` entrega o estado ao render e ao HUD por uma função de
  atualização — `atualizar(state)` — nunca guardando uma referência no momento
  da criação. Quando o laço de tempo fixo entrar (F11), é só passar a chamá-la
  a cada tick; se o render capturar o estado inicial e ler dele direto, a
  chegada do laço vira refatoração em vez de ligação.~~ Cumprida na F05b:
  `iniciarJogo()`/`montarHud()` devolvem `{ atualizar }`, `main.ts` chama as
  duas a partir de uma função só.
- ~~**Nota**: `tools/shots/F04.js` hoje assume `camera.scrollX/scrollY === 0`
  (`TILE_ALVO` fixo). Com `camera.centerOn` nesta feature isso deixa de ser
  verdade. O roteiro tem que parar de assumir scroll fixo — ler
  `camera.scrollX/scrollY` de `window.__cangaco` e calcular o tile esperado a
  partir do estado real, afirmando a relação (tile sob o mouse ↔ pixel dado a
  câmera atual), não uma coordenada literal. `npm run shot -- F04` precisa
  passar antes de fechar esta feature.~~ Cumprida na F05b: `npm run shot --
  F04` passa lendo o scroll publicado, sem presumir onde a câmera abriu.
- **Nota**: `gridToScreen`/`screenToGrid` (F04) são cegas a zoom — a conversão
  assume escala 1. Quando o zoom entrar (GDD §2.1, roda do mouse), as duas
  precisam de um parâmetro de escala e o teste de ida e volta precisa varrê-lo.
  Hoje nenhum item da fila agenda zoom.
- **Nota**: esta é uma **feature de integração** — é a exceção explícita que a
  §10 do CLAUDE.md exige para tocar `src/sim/` e `src/render/` na mesma
  feature. O escopo dela é literalmente ligar o estado da F05a à tela: os
  selectors novos entram em `sim/`, o desenho e a câmera em `render/`, o HUD em
  `ui/`. Nenhuma regra de jogo muda de lado. Nenhuma outra feature da fila
  herda esta permissão: ela vale para a F05b e só.

### F06 — Menu Build e planta fantasma
- **Escopo**: painel lateral com os prédios desbloqueados e seu custo; bloqueados
  em cinza com "requer X". Planta seguindo o mouse, verde quando pode e vermelha
  quando não pode (sobreposição, borda do mapa). `Esc` cancela.
- **Aceite**: teste da função `canPlace(state, buildingId, x, y)` cobrindo:
  sobreposição com prédio, fora do mapa, prédio não desbloqueado. Screenshots
  dos dois estados da planta, verde e vermelha.
- **Evidência**: `test-output/F06.json` + `screenshots/F06-*.png`
- **Nota**: "terreno inválido" saiu do aceite — o mapa não tem terreno variado
  nem feature que o produza, e um caso que nunca dispara numa partida real é
  andaime, não verificação. `MotivoDeRecusa` já declara `'terreno'`,
  inalcançável hoje; `canPlace` ganha essa recusa quando o mapa tiver terreno
  variado. O GDD já a exige: Fisherman's precisa de lago, mina precisa de veio
  na montanha, estrada precisa de solo transponível.
- **Nota**: esta é uma **feature de integração** — é a exceção explícita que a
  §10 do CLAUDE.md exige para tocar `src/sim/`, `src/render/`, `src/ui/` e
  `src/input/` na mesma feature. Cada camada recebe só o que é dela: `sim/`
  ganha `canPlace` e o desbloqueio; `render/` desenha a planta; `ui/` monta o
  painel e o layout; `input/` nasce com a ferramenta ativa e o teclado. Nenhum
  comando é emitido (o `PlaceBlueprint` é a F07) e nenhuma regra de jogo muda de
  lado. Nenhuma outra feature da fila herda esta permissão: ela vale para a F06
  e só.

### F07 — Comando de posicionar planta
- **Escopo**: clique confirma e emite `PlaceBlueprint`. O estado ganha uma obra
  pendente com HP 0 e a lista de materiais faltantes. Marcação visível no chão.
  O custo **não** sai do estoque no momento do clique; ele é consumido na entrega.
- **Aceite**: teste que emite `PlaceBlueprint` e confirma que o estado tem uma
  obra com os materiais corretos vindos de `buildings.json`, e que um segundo
  comando na mesma posição é rejeitado.
- **Evidência**: `test-output/F07.json` + `screenshots/F07-*.png`
- **Atenção**: `Command` é `never` desde a F02. Ao acrescentar o primeiro
  membro, escreva o `switch` em `step()` com `default` atribuindo a `never`
  — a checagem de exaustividade não existe hoje e nada vai avisar.
- **Nota**: esta é uma **feature de integração** — é a exceção explícita que a
  §10 do CLAUDE.md exige para tocar `src/sim/`, `src/render/`, `src/input/` e o
  laço externo (`main.ts`) na mesma feature. Cada camada recebe só o que é dela:
  `sim/` ganha o comando, o `switch` do `step()` e o formato da obra; `input/`
  transforma o clique em comando; `render/` desenha a marcação no chão; a
  `Sessão` (`src/sessao.ts`) e o `main.ts` ligam os três. Nenhuma regra de jogo
  muda de lado. Nenhuma outra feature da fila herda esta permissão: ela vale para
  a F07 e só.
- **Nota**: a fila de comandos e a `Sessão` (dona do `GameState` e da fila)
  nascem aqui. O disparo é **provisório e por comando**: cada clique enfileira e
  roda um `passo()`, então o `tick` avança 1 por comando até a F11, que traz o
  relógio de 10 Hz e passa a chamar `passo()` num timer. A mudança da F11 é só
  quem dispara; a fila e a `Sessão` não mudam.
  
### F08 — Estradas
- **Escopo**: ferramenta de estrada com arrasto tile a tile. Custo em stone por
  tile. Grafo de conectividade e função `isConnected(from, to)`. Demolir.
- **Aceite**: teste que desenha uma estrada em L entre dois pontos e confirma
  `isConnected` verdadeiro; remove um tile do meio e confirma falso. Screenshot
  da estrada desenhada.
- **Evidência**: `test-output/F08.json` + `screenshots/F08-*.png`
- **Nota**: esta é uma **feature de integração** — é a exceção explícita que a
  §10 do CLAUDE.md exige para tocar `src/sim/`, `src/input/`, `src/render/` e
  `src/ui/` na mesma feature. Cada camada recebe só o que é dela: `sim/` ganha o
  estado das estradas, os dois comandos, o custo e o grafo de conectividade;
  `input/` faz o arrasto; `render/` desenha a estrada e a prévia; `ui/` ganha os
  botões de ferramenta. Nenhuma regra de jogo muda de lado. Nenhuma outra feature
  da fila herda esta permissão: ela vale para a F08 e só.
- **Nota**: **desvio provisório da regra "o custo sai na entrega".** A estrada
  não tem canteiro nem viagem de material: o aceite exige que o tile exista e
  conecte no próprio comando, e serf (F10) e laborer (F11) ainda não existem. Por
  isso, na F08, `PlaceRoad` debita a pedra **no comando**, dos armazéns completos
  (gaveta `saida`, depois `entrada`, em `predios.ordem`), e o tile nasce pronto.
  **Demolir devolve** `floor(removidos × estrada.devolucaoAoDemolir)` de pedra
  (`terrain.json`, `0.5`; decisão do operador — sem isso corrigir traçado seria
  punitivo), ao mesmo armazém de onde sairia o débito; o arredondamento é por
  comando. O GDD §5.4 diz "feita por laborers": quando a F11 chegar, o operador
  decide se a estrada continua instantânea ou vira canteiro por tile (campo novo,
  separado do que já está de pé) e o débito migra para a entrega.
- **Nota**: "Demolir", aqui, é demolir **tiles de estrada**. Demolir prédio é da
  F16 (painel de seleção e demolição).

### F09 — JobBoard
- **Escopo**: criação, `claim`, `release`, reserva de recurso na origem e de vaga
  no destino. Prioridade simples e desempate determinístico. Sem unidade ainda.
- **Aceite**: teste que cria 1 tarefa e 2 unidades e confirma que só uma faz
  `claim`. Teste que confirma que após `claim` a quantidade disponível na origem
  cai e a reservada sobe. Teste que confirma que `release` restaura exatamente o
  estado anterior.
- **Evidência**: `test-output/F09.json`
- **Nota**: a rede de estradas (F08) se consulta por `isConnected(state, from,
  to)`, em `src/sim/estradas.ts`: O(1) entre mudanças de estrada (índice de
  componentes memoizado pela referência de `state.estradas`), conectividade em 4
  direções, e `false` para tile que não é estrada. O JobBoard **não cria tarefa
  para destino sem ligação** (`predioLigadoAoArmazem`, mesmo arquivo). E o débito
  de pedra da estrada (`PlaceRoad`) hoje tira do estoque total dos armazéns: assim
  que o JobBoard reservar pedra na origem, esse débito só pode tirar do
  **disponível** (estoque − reservado), senão a estrada come pedra já prometida a
  uma obra.

### F10 — FSM do Serf (transporte)
- **Escopo**: estados `ocioso → indo_buscar → carregando → indo_entregar →
  entregando`. Movimento sobre o grafo de estradas. Consome tarefas do JobBoard.
  Falha graciosa quando o caminho some no meio.
- **Aceite**: cenário com armazém contendo 10 stone e uma obra pedindo 2 stone.
  Após N ticks, a obra recebeu 2 e o armazém tem 8. Teste de falha: demolir a
  obra com o serf a caminho e confirmar que a carga volta ao armazém e a tarefa
  é liberada.
- **Evidência**: `test-output/F10.json`
- **Nota**: o movimento sobre estrada usa o contrato da F08: `ehEstrada(estradas,
  tile)` é O(1) (lookup), a conectividade é em 4 direções, e o A* usa
  `terreno.custoDeMovimento.estrada` (1.0) contra `grama` (1.30). Quando
  `state.estradas` muda (referência nova) e o caminho de um serf some, o serf
  **solta a reserva** e a tarefa é liberada — a F08 não mexe em unidade nem em
  tarefa, quem reage é quem consome. `terreno.estrada.obrigatoriaParaEntrega` é
  `true`: sem ligação, não há entrega.
- **Nota**: **o JobBoard (F09) é a interface do serf.** As funções são
  `reclamar(state, tarefaId, unidadeId)` (atômico: reserva a unidade de recurso na
  origem **e** a vaga no destino, ou não reserva nada), `liberar(state, tarefaId,
  motivo)` e `reclamarMelhor(state, unidadeId)` (ordem `(nível, distância,
  número)`), em `src/sim/jobs.ts`. **A reserva é derivada das tarefas
  `reclamada`**, não um contador à parte. O `sanearTarefas` (todo tick) já libera
  sozinho por unidade removida, caminho cortado, origem ou destino sumidos ou sem
  recurso/vaga; a FSM do serf **só precisa chamar `liberar('pedido-da-unidade')`**
  nos seus estados de erro (`devolvendo`).
- **Nota**: **o ciclo real da tarefa é em duas fases, e é a F10 quem o cria.** A F09
  não tem `concluir`. *Coleta*: a reserva da origem vira carga na unidade
  (`estoque.saida[m] − 1`, item em `fsmData`); *entrega*: a vaga vira `faltam[m] −
  1`. Entre as duas a tarefa mantém só a reserva do destino, então `Tarefa` ganha
  o estado `carregando`. O serf carrega **uma** unidade por viagem (decisão do operador, pós-F10: é o que o sprite
  carregando pressupõe, GDD §10, e o que o aceite conta; uma tarefa =
  uma unidade; não há dado de capacidade — se houver, `Tarefa` ganha `quantidade`).
- **Nota**: **a distância do desempate muda aqui.** Na F09 ela é o comprimento do
  caminho **por estrada** entre as portas de origem e destino (`distanciaPorEstrada`,
  `src/sim/estradas.ts`; 4 direções; só a perna da entrega). A F10 substitui por
  A* real a partir da **posição do serf** (perna até a origem + perna da entrega),
  com `custoDeMovimento` e vizinhança 8; a interface do comparador não muda, muda a
  função de distância. Nunca euclidiana.
- **Nota**: **o cenário de carga da F09 diz se o JobBoard precisa de índice.**
  Enquanto ninguém reclama, o gerador acumula tarefas `abertas` e o `sanearTarefas`
  as revalida todo tick, com as reservas derivadas custando O(tarefas). O número de
  tarefas do cenário com muitas obras está em `test-output/F09.json`
  (`cargaComMuitasObras`); ler antes de decidir entre índice por prédio e deixar como
  está. **Lido na F10:** 20 obras → 100 tarefas simultâneas, sem churn.
- **Nota**: esta é uma **feature de integração** — é a exceção explícita que a
  §10 do CLAUDE.md exige para tocar `src/sim/`, `src/render/` e o laço externo
  (`main.ts`) na mesma feature. Cada camada recebe só o que é dela: `sim/` ganha a
  FSM, o A* e o ciclo em duas fases; `render/` desenha o serf e a carga e publica o
  que desenhou, junto com o gancho `avancar` no bloco de `window.__cangaco` (ponte de
  harness, com prazo na F11); `main.ts` só injeta o callback que chama `passo()`, sem
  timer. `input/` e `ui/` **não** são tocados. Nenhuma regra de jogo muda de lado.
  Nenhuma outra feature da fila herda esta permissão: ela vale para a F10 e só.
- **Nota**: **como o serf se move na tela sem o laço de 10 Hz (que é da F11).** A
  posição visível é função **pura do estado**: `Unidade.gx/gy` é o tile onde ela está,
  e `fsmData` guarda o `caminho` e o `progresso` (ticks no passo em curso), de modo que
  o selector `posicaoDaUnidade` devolve o tile fracionário. O render só lê; não tem
  relógio nem guarda posição anterior. O tempo avança por `avancar(n)`, publicado em
  `window.__cangaco` (chama `sessao.passo()` `n` vezes), usado pelo roteiro de
  screenshot e pelo operador no console — sem tecla, sem botão, sem timer.
- **Nota**: **o que a F11 muda no movimento.** (a) quem chama `passo()` passa a ser um
  timer de `TICK_MS`; (b) o render ganha interpolação **entre ticks** (fração do tempo
  desde o último `passo`) por cima da posição por `progresso`, que continua valendo;
  (c) o roteiro de screenshot precisa **pausar** o timer antes de usar `avancar`; (d) a
  velocidade de jogo 1x/2x/3x acelera o relógio, nunca a sim. A FSM e o `step()` não
  mudam.

### F11 — FSM do Laborer (construção em etapas)
- **Escopo**: nivelar terreno → esperar material → martelar. HP subindo conforme
  o GDD: cada material entregue soma 50 HP, cada martelada soma 5. Três estágios
  visuais: marcação, estrutura de madeira, prédio completo.
- **Aceite**: cenário com Quarry (3 timber + 2 stone, 250 HP). Após a entrega dos
  5 materiais o HP é 250 e o prédio fica `completo`. Screenshots dos três
  estágios.
- **Evidência**: `test-output/F11.json` + `screenshots/F11-*.png`
- **Nota**: **a estrada como canteiro é decisão da F11.** A F08 entrega estrada
  instantânea, com a pedra debitada no comando (ver a Nota de desvio no item F08).
  O GDD §5.4 diz que laborers constroem estrada; se o operador escolher isso, a
  "estrada planejada" entra como **campo novo** no `GameState`, separado de
  `estradas` (que continua sendo só o que está de pé, e é o que `isConnected`
  consulta), e o débito migra do comando para a entrega.
- **Nota**: o laço de tempo fixo a 10 Hz (CLAUDE.md §5, `TICK_MS = 100`) ainda
  não existe e nasce aqui — a F11 é a primeira feature que precisa de
  movimento. Até a F06 `step()` só foi chamado direto por teste; desde a F07 a
  `Sessão` (`src/sessao.ts`) o chama, mas **por comando**, sem relógio e sem
  interpolação de render. A F11 troca o disparo por comando por um timer de
  `TICK_MS` que chama `passo()`; a fila e a `Sessão` não mudam.
- **Nota**: **o nivelamento está fora do contrato da obra.** A `Obra` da F07 tem
  só `faltam` (materiais ainda a entregar, por mercadoria) e o `hp` do prédio
  (HP já martelado, de 0 até `def.hp`). "Nivelar terreno → esperar material →
  martelar" não tem campo, e o GDD §5.1 põe o laborer nivelando *antes* de os
  serfs entregarem. **É a F11 quem acrescenta o que precisar em `Obra`** — por
  exemplo, o progresso do nivelamento — e quem decide se a entrega espera por ele.
- **Nota**: teto de HP durante a obra: `entregues = Σ_m (custo[m] − faltam[m])`
  e `teto = entregues × hpPorMaterialEntregue`. A soma é sobre mercadorias, cada
  material vale `hpPorMaterialEntregue`; não se somam quantidades de mercadorias
  diferentes como uma grandeza só. O Escopo diz "cada material entregue soma 50
  HP"; o contrato lê isso como o GDD §5.1 diz — a entrega **habilita** 50 HP de
  martelada, e a martelada (`hpPorMartelada`) é o que soma ao `hp`. Ao
  `hp === def.hp` a obra vira `'completo'` e chama `registrarTipoConstruido`
  (F12).
- **Nota**: **"obra já nivelada" é portão da criação de tarefa.** O nível 3 da
  escada de `delivery.json` é "material → obra **já nivelada**". A F09 ainda não
  tem como avaliar isso (a `Obra` não tem campo de nivelamento) e o gerador cria
  tarefa de material para **toda obra ligada por estrada**, sem predicado
  "sempre verdadeiro". A F11 acrescenta o campo de nivelamento em `Obra` **e** o
  portão em `gerarTarefas` (`src/sim/systems/jobs.ts`), decidindo se a entrega
  espera o laborer terminar de nivelar.
- **Nota**: **decisão pendente — o gancho `avancar` da F10.** A F10 publica
  `window.__cangaco.avancar(n)` (chama `sessao.passo()` `n` vezes) para o roteiro de
  screenshot mover o serf sem o laço. É uma **ponte de harness que escreve no estado a
  partir do `window` do jogo real**, e nasce marcada para morrer: a F11, ao criar o
  timer, **decide** se ele **some** ou **vira pausar/retomar do timer** — e não fecha a
  feature com ele esquecido. Com o timer rodando e sem pausa, os screenshots deixam de
  ser determinísticos. O comentário `PONTE DE HARNESS DA F10` no código aponta para
  esta nota.
- **Nota**: **o que a F10 deixa para a F11.** `carregando` e `entregando` duram **um
  tick** cada (não há tempo de manuseio no dado). A entrega faz `Obra.faltam` chegar a 0
  e **não completa nada**: virar `'completo'` é da martelada (esta feature). A posição
  visível do serf já é derivada do `progresso`; a F11 só acrescenta a interpolação
  entre ticks (ver a Nota de movimento no item F10).

### F12 — Desbloqueio por conclusão
- **Escopo**: concluir um prédio libera os filhos dele na árvore do GDD. O menu
  Build reflete na hora.
- **Aceite**: teste headless que parte do estado inicial (Storehouse e
  Schoolhouse completos, `menuBuildInicial` vazio) e:
  1. confirma, pelo seletor do menu Build, Sawmill bloqueada exigindo Woodcutter's;
  2. posiciona um Woodcutter's (`PlaceBlueprint`) e, com a obra ainda pendente,
     confirma Sawmill **ainda bloqueada** — obra não desbloqueia;
  3. conduz a obra até `'completo'` pelo `step()`, sem injetar prédio pronto, e
     confirma Sawmill liberada e que o conjunto de liberados cresceu exatamente
     pelos filhos diretos do Woodcutter's em `buildings.json`, calculado do dado
     e sem lista digitada;
  4. repete um elo: conclui a Sawmill e confirma Farm e os demais filhos dela
     liberados.
- **Evidência**: `test-output/F12.json`
- **Nota**: o aceite anterior ("conclui uma Schoolhouse e confirma que Quarry e
  Woodcutter's saíram de bloqueado") não testava nada: o estado inicial já tem a
  Schoolhouse completa e a lista `menuBuildInicial` liberava os dois. A lista agora
  só existe para raiz sem pai; o desbloqueio vem da árvore.
- **Nota**: sem screenshot nesta feature. Conduzir uma obra até o fim só com
  cliques é um roteiro grande, e isso pertence à F17, o aceite integrado da fase.
- **Nota**: o desbloqueio é permanente — `estaDesbloqueado` consulta
  `GameState.tiposJaConstruidos` (F06), não a presença atual do prédio. Hoje só o
  estado inicial alimenta essa lista; a F12 liga `registrarTipoConstruido`
  (`sim/desbloqueio.ts`) ao `step()` no momento em que uma obra chega a
  `'completo'`.

### F13 — Schoolhouse: fila de treino
- **Escopo**: painel com fila de até 5 slots, um botão por tipo de trabalhador,
  1 gold por unidade, cobrado ao iniciar. Cancelar item da fila devolve o ouro
  só se ainda não começou.
- **Aceite**: teste que enfileira 3 unidades com 3 de ouro, confirma ouro 0 e as
  3 unidades criadas após o tempo de treino; tenta a quarta sem ouro e confirma
  rejeição. Screenshot do painel com fila cheia.
- **Evidência**: `test-output/F13.json` + `screenshots/F13-*.png`
- **Nota**: **o nível 2 da escada (ouro → Schoolhouse) nasce aqui.** Na F09 só o
  nível 3 (material → obra) tem produtor; o nível 2 tem a escola, mas não tinha
  **demanda de ouro** — quem a cria é a fila de treino. Ao acrescentar o produtor,
  alargar `Tarefa.tipo` (hoje o literal `'material-para-obra'`) e acrescentar o tipo
  na escada por `id` em `data/delivery.json`, sem digitar o número do nível em `.ts`.

### F14 — Especialistas ocupam prédios
- **Escopo**: trabalhador treinado caminha até um prédio vago do seu tipo e o
  ocupa. Prédio sem trabalhador fica parado e o HUD alerta.
- **Aceite**: cenário com 2 Quarries prontas e 2 stonemasons treinados: após N
  ticks os dois prédios têm ocupante e nenhum ficou com dois.
- **Evidência**: `test-output/F14.json`

### F15 — Produção: Quarry, Woodcutter's, Sawmill
- **Escopo**: ciclo de produção por tempo, saída depositada no prédio, tarefa de
  transporte criada para levar ao armazém. Quarry esgota o veio de pedra.
- **Aceite**: cenário completo, 3000 ticks. O estoque de stone e timber é maior
  que zero e cresce monotonicamente enquanto houver rocha e árvore. Nenhum
  trabalhador em `ocioso` por mais de X ticks consecutivos.
- **Evidência**: `test-output/F15.json`
- **Nota**: prédio **sem ligação** ao armazém (`predioLigadoAoArmazem`, F08) **não
  produz** — a estrada é requisito de funcionamento (GDD §5.1).
- **Nota**: **o que o HUD conta está decidido (operador, pós-F10): o estoque dos ARMAZÉNS.** O
  número da barra precisa prever o que o jogador pode gastar, e a estrada (F08) e as obras (F10)
  só tiram de armazém; somar a saída de uma pedreira mostraria pedra que ninguém consegue usar. O
  HUD lê `estoqueDosArmazens` (`sim/selectors.ts`) para **gold, timber e stone**; `estoqueTotal`
  continua para outros usos. **Reservado não é descontado** (a pedra ainda está lá; a prévia da
  estrada já explica a recusa) e a mercadoria em trânsito, na mão de um serf, não conta. Hoje os dois
  seletores dão o mesmo número (nenhum prédio produtivo guarda estoque), e o roteiro da F05b é o
  teste de que a troca não mudou nada visível. **Esta feature** é a primeira em que eles divergem:
  o teste com uma pedreira de estoque próprio já existe (`tests/F05b-hud-armazens.test.ts`); aqui
  vale repeti-lo com a produção real. **Fica em aberto para a F20:** o campo **Comida** do HUD
  continua em `comidaTotal` (que usa `estoqueTotal`) — decidir, quando o Inn existir, se comida
  também é só a dos armazéns.
- **Nota**: **os níveis 4 a 7 da escada nascem aqui** (insumo → produção parada,
  insumo → produção com estoque baixo, saída cheia → armazém, excedente → armazém):
  a F09 só implementa o nível 3 (material → obra). Cada produtor alarga
  `Tarefa.tipo` e referencia o nível por `id` em `data/delivery.json`. E o
  `alertaTarefaSemCandidato_segundos` (alerta de HUD para tarefa sem candidato) só
  passa a ter consumidor quando existir o alerta — a F09 não o usa.

### F16 — Painel de seleção e demolição
- **Escopo**: clicar em prédio mostra nome, HP ou progresso de obra, ocupante,
  estoque de entrada e saída, botões pausar e demolir. Demolir devolve parte do
  material e libera as tarefas ligadas ao prédio.
- **Aceite**: teste que demole um prédio com tarefa em curso e confirma que
  nenhuma tarefa órfã sobrou no JobBoard e nenhum serf ficou travado.
  Screenshot do painel.
- **Evidência**: `test-output/F16.json` + `screenshots/F16-*.png`
- **Nota**: **a falha "obra demolida com o serf a caminho" foi provada na F10 por
  injeção**, tirando a obra do estado com um helper de teste (`semOPredio`), porque
  não existe comando de demolir prédio antes desta feature. A F10 garante o caminho —
  `sanearTarefas` cancela a tarefa e o serf carregado vai a `devolvendo`, deposita e
  fica `ocioso` — mas **esta feature repete o teste pelo comando real**, com o serf
  carregando e com o serf ainda indo buscar, e confirma que a carga voltou ao armazém.

### F17 — Aceite da Fase A (integração)
- **Escopo**: roteiro Playwright que executa a sessão inteira do critério de
  aceite do GDD, só com cliques.
- **Aceite**: o roteiro conclui com 2 Woodcutter's, 1 Quarry e 1 Sawmill
  completos e ocupados, ligados por estrada, e o estoque de timber maior que o
  inicial. Screenshot final da vila.
- **Evidência**: `test-output/F17.json` + `screenshots/F17-final.png`

---

## Fase B — Comida e crescimento

### F18 — Farm e campos de milho
### F19 — Mill e Bakery (cadeia do pão)
### F20 — Inn, fome e consumo
- Restauração por tipo de comida e regra das duas comidas diferentes, conforme o
  GDD. Aceite: cenário longo em que a população sobrevive; cenário sem comida em
  que morre — e a morte é registrada em evento, não em log solto.
- **Nota**: **revisitar a carga do serf quando uma unidade puder morrer carregando.** Na F10 a carga
  vive em `fsmData.carga` e **se perde** com a unidade removida (o `sanearTarefas` cancela a tarefa
  `carregando` e o gerador recria; o teste afirma "exatamente 1 unidade perdida"). Decisão do
  operador: fica assim **por enquanto**, porque não existe item no chão e nenhuma unidade morre antes
  desta feature ou do combate. Esta feature decide se a carga cai no tile e é recolhida (item no chão,
  tarefa ou estado novo no GDD §6.2) ou se continua perdida — e ajusta o teste de conservação de bens.
### F21 — Gold mine, Coal mine e Metallurgist's (ouro renovável)
### F22 — Alertas do HUD
- Prédio sem trabalhador, sem estrada, fome, mina esgotada.
### F23 — Save e load
- Aceite: salvar num tick qualquer, carregar e rodar 500 ticks produz o mesmo
  estado que rodar 500 ticks sem salvar. É o teste que prova que a invariante 2
  continua de pé.
- Reusar `compararComESemSave` de `tests/helpers/determinism.ts`, criado na F02,
  com o estado povoado. Não escrever um segundo teste de save/load.

---

## Fase C — Militar

### F24 — Weapons workshop e cadeia de couro
### F25 — Barracks e criação de soldado
### F26 — Seleção e movimento de grupo
### F27 — Formação, virar e storm attack
### F28 — Combate e IA inimiga simples

---

## Fase D — Profundidade

### F29 — Ferro e smithies
### F30 — Armazém com toggles por mercadoria
### F31 — Menu de distribuição
### F32 — Aba de estatísticas
### F33 — Minimapa
### F34 — Condições de vitória e derrota (escaramuça)

---

## Regras da fila

- Fase A inteira antes de qualquer item da Fase B. Sem exceção.
- Item da Fase B em diante só é detalhado quando a fase anterior fechar. Detalhar
  agora é desperdício, porque o que você aprende na Fase A muda o resto.
- Se uma feature reprovar duas vezes seguidas na avaliação, pare o loop e escreva
  em `PROGRESS.md` o motivo. Insistir uma terceira vez com o mesmo prompt é
  queimar crédito.
