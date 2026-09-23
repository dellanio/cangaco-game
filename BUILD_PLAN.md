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
  UI — o formato de prédio e unidade no `GameState` é herdado por F07, F10, F11c
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
- **Nota**: `gridToScreen`/`screenToGrid` (F04) são cegas a zoom — a conversão
  assume escala 1. Quando o zoom entrar (GDD §2.1, roda do mouse), as duas
  precisam de um parâmetro de escala e o teste de ida e volta precisa varrê-lo.
  Hoje nenhum item da fila agenda zoom.
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
### F08 — Estradas
- **Escopo**: ferramenta de estrada com arrasto tile a tile. Custo em stone por
  tile. Grafo de conectividade e função `isConnected(from, to)`. Demolir.
- **Aceite**: teste que desenha uma estrada em L entre dois pontos e confirma
  `isConnected` verdadeiro; remove um tile do meio e confirma falso. Screenshot
  da estrada desenhada.
- **Evidência**: `test-output/F08.json` + `screenshots/F08-*.png`
### F09 — JobBoard
- **Escopo**: criação, `claim`, `release`, reserva de recurso na origem e de vaga
  no destino. Prioridade simples e desempate determinístico. Sem unidade ainda.
- **Aceite**: teste que cria 1 tarefa e 2 unidades e confirma que só uma faz
  `claim`. Teste que confirma que após `claim` a quantidade disponível na origem
  cai e a reservada sobe. Teste que confirma que `release` restaura exatamente o
  estado anterior.
- **Evidência**: `test-output/F09.json`
### F10 — FSM do Serf (transporte)
- **Escopo**: estados `ocioso → indo_buscar → carregando → indo_entregar →
  entregando`. Movimento sobre o grafo de estradas. Consome tarefas do JobBoard.
  Falha graciosa quando o caminho some no meio.
- **Aceite**: cenário com armazém contendo 10 stone e uma obra pedindo 2 stone.
  Após N ticks, a obra recebeu 2 e o armazém tem 8. Teste de falha: demolir a
  obra com o serf a caminho e confirmar que a carga volta ao armazém e a tarefa
  é liberada.
- **Evidência**: `test-output/F10.json`
### F11a — Laço de tempo fixo (10 Hz)
- **Escopo**: timer de `TICK_MS` chamando `sessao.passo()`, com acumulador e fonte
  de tempo injetada. Velocidade de jogo 1x/2x/3x, com opções e padrão vindos de
  `data/time.json`, nas teclas `+` e `-`. Pausa do jogador (`P`) e pausa
  automática e **assimétrica** (`visibilitychange` pausa ao ocultar a aba; voltar
  à aba **não** retoma). O laço **nasce pausado** quando a URL tem `?pausado`.
  Aviso visual único de pausa e de velocidade. Interpolação de render entre
  ticks. O destino do gancho `avancar` da F10. **Nada em `src/sim/`** — o
  `step()`, a FSM e a fila não mudam; muda só quem chama `passo()`.
- **Aceite**:
  1. Com relógio falso a 1x, `N` ms produzem `⌊N/tickMs⌋` passos e o resto sobra
     no acumulador; a 2x e 3x o número é proporcional.
  2. Mesma lista de comandos e mesmo número de passos produzem `JSON.stringify`
     idêntico a 1x e a 3x — a velocidade acelera o relógio, nunca a simulação.
  3. Interpolação: α=0 devolve a posição do tick anterior, α=1 a do atual, α=½ o
     meio; salto acima do limiar assenta sem interpolar.
  4. Pausado, com 1 s de relógio falso: zero passos, `tick` e posições idênticos.
     `retomar()` volta a avançar **sem rajada** — o tempo parado não é recuperado.
  5. Um quadro muito longo (ex.: 10 s) roda no máximo `MAX_PASSOS_POR_QUADRO`.
  6. `avancar(n)` lança se o timer não estiver pausado.
  7. `npm run validate:data` reprova `velocidadeDeJogo` com `padrao` fora de
     `opcoes` e com `opcoes` vazio.
  8. Screenshots: pausado com o aviso, 2x com o aviso, 1x sem o aviso.
  9. `npm run shot` de F04 a F10 continua verde.
  10. `visibilitychange` é assimétrico: ocultar a aba pausa; torná-la visível não
      retoma, e quem já tinha pausado com `P` continua pausado ao voltar.
  11. Abrir com `?pausado` deixa o laço pausado antes do primeiro quadro (`tick`
      é 0 quando `pronto` fica verdadeiro), e **rodar `npm run shot -- F10` três
      vezes seguidas dá o mesmo resultado**.
- **Evidência**: `test-output/F11a.json` + `screenshots/F11a-*.png`
### F11b — JobBoard: tarefa de construir
- **Escopo**: `Tarefa` vira união discriminada (`material-para-obra` |
  `construir`). `reclamar` generaliza a elegibilidade por tipo de unidade
  (serf só material, laborer só construir — não disputam tarefa).
  `laborersMaximosPorObra: 4` em `buildings.json` (`construcao`), validado
  como inteiro ≥ 1. `gerarTarefas` cria até esse número de tarefas de
  construir por obra, sem checar armazém/estrada (o laborer não carrega
  material). `sanearTarefas` cobre os ramos novos. **Sem FSM de laborer**: as
  tarefas nascem e podem ser reclamadas, mas nada as consome ainda.
- **Aceite**: teste que um laborer reclama uma tarefa de construir e um serf é
  recusado (e vice-versa para material). Teste que a quinta reclamação numa
  obra com teto 4 é recusada com `destino-sem-vaga`. Teste que `gerarTarefas`
  cria exatamente `laborersMaximosPorObra` tarefas de construir por obra,
  mesmo sem estrada. `npm run test` inteiro (F01–F11a) continua verde.
- **Evidência**: `test-output/F11b.json`
- **Nota**: sem screenshot — feature só de `sim/`.

### F11c — FSM do Laborer (construção em etapas)
- **Escopo**: nivelar terreno → esperar material → martelar, consumindo as
  tarefas `'construir'` da F11b. HP subindo conforme o GDD: cada material
  entregue soma 50 HP, cada martelada soma 5. Três estágios visuais:
  marcação, estrutura de madeira, prédio completo.
- **Aceite**: cenário com Quarry (3 timber + 2 stone, 250 HP). Após a entrega dos
  5 materiais o HP é 250 e o prédio fica `completo`. Screenshots dos três
  estágios.
- **Evidência**: `test-output/F11c.json` + `screenshots/F11c-*.png`
- **Nota**: esta é uma **feature de integração** — é a exceção explícita que a
  §10 do CLAUDE.md exige para tocar `src/sim/` e `src/render/` na mesma feature.
  Cada camada recebe só o que é dela: `sim/` ganha a FSM do laborer, o campo de
  nivelamento em `Obra`, o teto de HP e o portão de `gerarTarefas`; `render/`
  ganha os três estágios visuais da obra e o desenho do laborer. Nenhuma regra de
  jogo muda de lado. Nenhuma outra feature da fila herda esta permissão: ela vale
  para a F11c e só.
- **Nota**: **o nivelamento está fora do contrato da obra.** A `Obra` da F07 tem
  só `faltam` (materiais ainda a entregar, por mercadoria) e o `hp` do prédio
  (HP já martelado, de 0 até `def.hp`). "Nivelar terreno → esperar material →
  martelar" não tem campo, e o GDD §5.1 põe o laborer nivelando *antes* de os
  serfs entregarem. **É a F11c quem acrescenta o que precisar em `Obra`** — por
  exemplo, o progresso do nivelamento — e quem decide se a entrega espera por ele.
- **Nota**: teto de HP durante a obra: `entregues = Σ_m (custo[m] − faltam[m])`
  e `teto = entregues × hpPorMaterialEntregue`. A soma é sobre mercadorias, cada
  material vale `hpPorMaterialEntregue`; não se somam quantidades de mercadorias
  diferentes como uma grandeza só. O Escopo diz "cada material entregue soma 50
  HP"; o contrato lê isso como o GDD §5.1 diz — a entrega **habilita** 50 HP de
  martelada, e a martelada (`hpPorMartelada`) é o que soma ao `hp`. Ao
  `hp === def.hp` a obra vira `'completo'` e **só isso**: a F11c não chama
  `registrarTipoConstruido` — ligar o desbloqueio a essa transição é da F12.
- **Nota**: **"obra já nivelada" é portão da criação de tarefa** — mas só para
  a tarefa de MATERIAL (nível 3 da escada de `delivery.json`, "material → obra
  **já nivelada**"); a tarefa de CONSTRUIR (F11b) não tem esse portão, o
  laborer nivela antes de o material contar como entregável. A F09/F11b ainda
  não tinham como avaliar isso (a `Obra` não tem campo de nivelamento) e o
  gerador cria tarefa de material para **toda obra ligada por estrada**, sem
  predicado "sempre verdadeiro". A F11c acrescenta o campo de nivelamento em
  `Obra` **e** o portão em `gerarTarefas` (`src/sim/systems/jobs.ts`),
  decidindo se a entrega de material espera o laborer terminar de nivelar.
- **Nota**: **o que a F10 deixa para a F11c.** `carregando` e `entregando` duram **um
  tick** cada (não há tempo de manuseio no dado). A entrega faz `Obra.faltam` chegar a 0
  e **não completa nada**: virar `'completo'` é da martelada (esta feature). A
  interpolação entre ticks da posição do serf é da F11a, não desta.

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
- **Nota (origem: F11c)**: o gancho já existe. A F11c emite
  `{ type: 'building-completed', predio, tipo }` (`GameEvent`, `state.ts`) no
  exato tick em que `sistemaDosLaborers` chama `completarObra` — verificado, um
  evento por prédio, nunca chamando `registrarTipoConstruido` sozinho. A F12
  só precisa **consumir** esse evento (varrer `state.events` por
  `'building-completed'` e chamar `registrarTipoConstruido(tipo)`), não
  detectar a transição por conta própria.

### F13a — Schoolhouse: fila de treino (simulação)
- **Escopo**: fila de até 5 slots por escola, um pedido por tipo de trabalhador,
  1 gold por unidade **cobrado ao iniciar o treino**; a unidade nasce na porta da
  escola. O ouro chega pelo serf: nasce aqui o produtor do nível 2 da escada
  (`ouro-para-escola`).
- **Aceite**: teste headless que, do estado inicial com 3 de ouro no armazém,
  enfileira 3 unidades, conduz por `step()` e confirma: o ouro sai do armazém e
  chega à escola pelo serf, ouro 0 nos dois prédios ao fim, as 3 unidades criadas
  (uma por `ticksPorTreino` do dado) e nascidas na porta da escola; um 4º pedido
  sem ouro fica em `aguardando` para sempre, sem unidade e sem gasto; e um pedido
  além do teto de slots é recusado com `command-rejected`.
- **Evidência**: `test-output/F13a.json`
- **Nota**: **o nível 2 da escada (ouro → Schoolhouse) nasce aqui.** Na F09 só o
  nível 3 (material → obra) tem produtor; o nível 2 tem a escola, mas não tinha
  **demanda de ouro** — quem a cria é a fila de treino. Ao acrescentar o produtor,
  alargar `Tarefa.tipo` (hoje o literal `'material-para-obra'`) e acrescentar o tipo
  na escada por `id` em `data/delivery.json`, sem digitar o número do nível em `.ts`.
- **Nota**: sem screenshot — nada em `render/` ou `ui/` muda aqui, e o painel é a
  F13b.
- **Nota (D2)**: "tenta a quarta sem ouro e confirma rejeição", do aceite
  original, vale como **recusa de iniciar o treino**: cobrar ao iniciar e recusar
  o enfileiramento por falta de ouro se excluem — se enfileirar exigisse ouro
  presente, a fila nunca criaria a demanda que faz o ouro vir. A recusa de comando
  de verdade fica coberta pelo teto de slots e pelo prédio que não é escola.
- **Nota (D1)**: a unidade nasce no primeiro tile andável da **porta da escola**
  (borda sul). `economy.json:estadoInicial.spawnDeUnidades` continua sendo só o
  canto do cenário inicial; não vale para prédio em runtime.
- **Nota (D3)**: o preço lido é `economy.schoolhouse.custoOuroPorUnidade`.
  `units.json:civis.tipos[].custoOuro` (hoje 1 para todos) continua sem leitor —
  quando um civil custar diferente, é ele que passa a mandar, e o campo da escola
  vira o padrão. Quem for mexer nisso mexe nos dois.

### F13b — Schoolhouse: painel da fila (interface)
- **Escopo**: painel com os 5 slots, um botão por tipo de trabalhador e
  cancelamento de item, emitindo `EnqueueTraining`/`CancelTraining` (já
  existentes, F13a). Lê o estado, não o muta.
- **Aceite**: screenshot do painel com a fila cheia, e roteiro que enfileira por
  clique e confirma a fila no estado.
- **Evidência**: `screenshots/F13b-*.png`
- **Nota**: **feature de integração** (CLAUDE.md §10): pode tocar `src/ui/`,
  `src/input/` e `src/render/` na mesma feature, porque o painel precisa abrir a
  partir do prédio clicado.
- **Nota**: a seleção de prédio é da F16. Decidir na sessão da F13b se o painel
  abre por clique próprio (mínimo viável, sem painel genérico) ou pela ponte de
  harness; não antecipar a F16.
- **Nota (D1, decidido na F13b)**: **clique próprio**, mínimo viável. Com a
  ferramenta em `'nenhum'`, clicar num tile do footprint de uma schoolhouse
  completa abre o painel (`predioNoTile` + `src/input/selecao.ts`); `Esc` e clique
  fora fecham. A ponte de harness foi recusada: é superfície de teste, e um painel
  que só abre pelo Playwright não é a feature.
- **Nota (D2, decisão do operador)**: o item `aguardando` mostra **três** motivos
  distintos, não um rótulo neutro — `sem-estrada`, `sem-ouro` e `a-caminho`.
  Porque as causas pedem ações opostas: sem estrada é um arrasto de dez segundos,
  sem dinheiro é garimpo e metalurgia. Os três saem de composição, **sem campo
  novo**: tarefa `'ouro-para-escola'` no quadro ⇒ `a-caminho`;
  `!predioLigadoAoArmazem` (F08) ⇒ `sem-estrada`; senão `sem-ouro`.
- **Nota (D3)**: o motivo é da **fila**, não do item — `ouroNecessario` é um
  agregado da escola. Com o ouro já na gaveta `entrada` o motivo é `null` e o
  painel diz "na fila". Quem quiser motivo por item precisa de estado novo.

### F14 — Especialistas ocupam prédios
- **Escopo**: trabalhador treinado caminha até um prédio vago do seu tipo e o
  ocupa. Prédio sem trabalhador fica parado e o HUD alerta.
- **Aceite**: cenário com 2 Quarries prontas e 2 stonemasons treinados: após N
  ticks os dois prédios têm ocupante e nenhum ficou com dois.
- **Evidência**: `test-output/F14.json`
- **Nota (D1, decisão registrada)**: **o alerta de "prédio sem trabalhador" é da
  F22, não desta feature.** O critério de aceite acima não o menciona e a
  evidência que ele pede é JSON, sem screenshot; e a F22 faz os quatro alertas
  com UM mecanismo só, sendo que três das causas (sem estrada, fome, mina
  esgotada) nem são observáveis antes da F15/F20/F21 — entregar uma causa
  isolada agora obrigaria a refazer o componente lá. A ausência de nota de
  integração no item **não** entra no argumento: a nota é autorização que o
  operador concede quando faz sentido, não condição preexistente.
- **Nota (D2)**: a FSM entregue é `ocioso → indo_ocupar → trabalhando`. O
  `sem_prédio` do GDD §6.2 chama-se `ocioso` no código, porque toda unidade
  nasce assim e `ficarOcioso`/`ocioso` são compartilhados por todas as FSMs.
  `esperando_insumo` e `saida_cheia` são de PRODUÇÃO e nascem na F15.
- **Nota (D3)**: **"um prédio, um ocupante" mora no tipo**, em
  `PredioCompleto.ocupante: string | null`. Não há `ocupantesMaximosPorPredio`
  em dado porque não há o que balancear — dois ocupantes não são
  representáveis. Diferente do `laborersMaximosPorObra`, que é teto de verdade.
- **Nota (D4)**: a vaga de ocupação **nasce mesmo sem especialista no mapa**,
  como a de construir (F11b), e **não exige estrada** — o especialista anda em
  modo `'livre'`, como o laborer.

### F15a — Produção: o ciclo e o veio
- **Escopo**: ciclo de produção por tempo, saída depositada na gaveta `saida` do
  prédio. Quarry esgota o veio de pedra. **Sem transporte** — levar a saída ao
  armazém é a F15b.
- **Aceite**: cenário de 1000 ticks, caminho real (planta, obra concluída,
  especialista treinado na escola e ocupando). A pedreira ocupada e ligada por
  estrada deposita stone na gaveta `saida` em intervalos **exatos e iguais**, até
  o teto da gaveta, e o especialista nunca passa por `ocioso`. Uma serraria sem
  tronco fica em `esperando_insumo` sem gastar relógio. Com o veio curto (dado
  injetado), a produção para e `vein-exhausted` sai **uma vez**.
- **Evidência**: `test-output/F15a.json`
- **Nota (origem: F14)**: prédio sem `ocupante` **não produz** — a pergunta é
  `ehPredioOcupavel(predio) && predio.ocupante === null` (`sim/ocupacao.ts`). É
  nesta feature que "fica parado" ganha significado observável, e é aqui que
  entram `esperando_insumo` e `saida_cheia` (GDD §6.2).
- **Nota**: prédio **sem ligação** ao armazém (`predioLigadoAoArmazem`, F08) **não
  produz** — a estrada é requisito de funcionamento (GDD §5.1).
- **Nota (D6, decisão do operador)**: prédio sem estrada fica em **`saida_cheia`**,
  com o relógio do ciclo congelado. Prédio que não escoa é exatamente o que o GDD
  §6.2 descreve por `saida_cheia` ("a logística é o gargalo"), e sem estrada o
  escoamento é impossível — o caso extremo, não um caso novo. **Nenhum estado de
  FSM fora da lista do GDD §6.2.** A causa continua observável sem estado novo
  (`predioLigadoAoArmazem === false`), que é o que o alerta "sem estrada" da F22 lê.
- **Nota (D1)**: a receita é um **ciclo**, derivado **uma vez no carregamento**:
  `ticksDoCiclo` é o período da taxa mais lenta entre `entra` e `sai`, e as
  quantidades são a razão dos períodos, arredondada ali. É isso que faz "1 tronco
  → 2 timber" sair das **taxas**, sem a quantidade estar digitada em lugar nenhum.
  `tools/data-rules.js` recusa receita cuja razão o arredondamento distorça acima
  de 2 %.
- **Nota (D2, contrato que a F21 herda)**: o veio mora no **prédio**
  (`PredioCompleto.producao.veio`), semeado de `data/production.json` no instante
  da conclusão. Não há camada de terreno na sim e nenhuma feature antes da F17
  produz uma.
- **Nota (D7)**: `modos` do Woodcutter's (`cortar`/`replantar`/`ambos`) continua
  **sem leitor**. Aqui o lenhador replanta, e por isso o veio dele é `null`.
  Escolher modo é comando de prédio (GDD §2.3) — F16.

### F15b — Produção: entrega ao armazém e calibração
- **Escopo**: níveis **6** (`saida-cheia-para-armazem`) e **7**
  (`excedente-para-armazem`) da escada de `data/delivery.json`; o serf leva a
  saída do produtor ao armazém e devolve ao armazém a mercadoria parada em prédio
  que não a pede mais. Cenário longo de calibração.
- **Aceite**: cenário completo, 3000 ticks. O estoque de stone e timber é maior
  que zero e cresce monotonicamente enquanto houver rocha e árvore. Nenhum
  trabalhador em `ocioso` por mais de X ticks consecutivos.
- **Evidência**: `test-output/F15.json`
- **Nota (operador)**: a **calibração não sai da Fase A** — ela é o que prova que
  o jogo tem ritmo, e o aceite da F17 depende dela.
- **Nota (a calibrar aqui)**: `production.json: quarry.veio.rendimento = 200` é
  ponto de partida aprovado pelo operador (~55 min de produção contínua na escala
  2.0 — quase uma partida inteira de uma Quarry, que casa com o original, onde se
  constroem várias e elas se esgotam). Ver `BALANCE_LOG.md`.
- **Nota (D3)**: o nível 6 dispara com **estoque > 0** na gaveta `saida`, não com
  a gaveta cheia. Esperar encher faria de `saida_cheia` o regime permanente, e o
  GDD §6.2 a descreve como **sinal de gargalo**.
- **Nota (o `X` do aceite)**: "mais de X ticks" precisa virar número **do dado**,
  não digitado em `.ts`. Candidato:
  `delivery.alertaTarefaSemCandidato_segundos` (30 s → 300 ticks), que é o próprio
  limiar que o dado declara para "isto está parado tempo demais". E "trabalhador"
  precisa ser lido como **especialista**: serf entre tarefas passa por `ocioso`
  legitimamente. Decidir com o operador antes de começar.
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
- **Nota (origem: revisão da F13a)**: **mesmo assunto da nota acima — o número que o
  jogador lê contra o que existe.** Há uma janela real em que ouro fica parado na gaveta
  `entrada` da Schoolhouse: o ouro do segundo item chega enquanto o primeiro treina, e se
  o jogador cancelar a fila inteira nesse intervalo o ouro fica lá. Não se perde (o
  próximo `EnqueueTraining` o consome) e **não** volta ao armazém, então some do HUD, que
  lê `estoqueDosArmazens`. A F13a não trata disso — o aceite dela não fala de
  cancelamento. Decidir aqui, junto com a divergência dos dois seletores: ou a mercadoria
  parada em prédio volta por tarefa, ou o HUD passa a distingui-la. Não é balanceamento.
- **Nota (D4, decisão do operador)**: **resolvido pelo nível 7**, não pela tela. O
  vazamento se conserta na origem e o HUD continua com **uma regra só** — conta
  armazéns. A pedra parada na saída de um produtor **não** é distorção: é limitada
  ao buffer, drenada pelo nível 6, e é pedra que o jogador não pode gastar.
  **Sem nota de feature de integração; nada de `render/` nem de `ui/` aqui.**
- **Nota (origem: F09)** — *a primeira linha desta nota está faltando no arquivo;
  preservada literalmente como estava, sem reconstituir o que se perdeu:*
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
- **Nota (origem: F14)**: o "ocupante" do painel é `PredioCompleto.ocupante`, um
  id de unidade ou `null`. É nesta feature que a ocupação ganha evidência
  visual (o aceite da F16 já pede screenshot; o da F14 não). Demolir prédio
  ocupado tem que devolver o especialista a `ocioso` — o caminho existe
  (`passoTrabalhando`, que lê a posse do prédio), mas quem o prova pelo comando
  real é este item.
- **Nota**: **a falha "obra demolida com o serf a caminho" foi provada na F10 por
  injeção**, tirando a obra do estado com um helper de teste (`semOPredio`), porque
  não existe comando de demolir prédio antes desta feature. A F10 garante o caminho —
  `sanearTarefas` cancela a tarefa e o serf carregado vai a `devolvendo`, deposita e
  fica `ocioso` — mas **esta feature repete o teste pelo comando real**, com o serf
  carregando e com o serf ainda indo buscar, e confirma que a carga voltou ao armazém.
- **Nota (origem: revisão da F13a)**: **dois casos de teste que esta feature deve cobrir**,
  os dois só alcançáveis com o comando real de demolir. (1) **Escola demolida com tarefa
  `ouro-para-escola` já reclamada.** O ramo existe (`motivoDoDestino` em
  `sim/systems/jobs.ts`) mas é código sem teste: o `destino-sumiu` coberto pela F09 e pela
  F10 é o ramo de *material*, e o teste da F13a demole a escola sem tarefa no quadro.
  (2) **Estrada da porta demolida com um item de treino já pago.** Se a porta sul ficar
  intransitável, `tileDeSaida` devolve `null` e o item pronto segura com o ouro já
  cobrado (`sim/systems/escolas.ts`). Hoje não acontece, porque o ouro só chega por porta
  que é estrada — hipótese não confirmada por execução, registrada como tal na F13a. **Se
  travar, é travamento de regra, não balanceamento, e se resolve aqui**: item pronto sem
  saída precisa de destino (esperar é aceitável só se a porta puder voltar a existir).
- **Nota (origem: F13b)**: **contrato herdado.** `src/input/selecao.ts` (só guarda o
  id do prédio aberto, estado de interface, nunca `GameState`), `predioNoTile`
  (`sim/selectors.ts`) e o `<aside id="painel-escola">` são o **mínimo** da F13b: a
  seleção só reconhece schoolhouse e o painel é específico. A seleção genérica desta
  feature **substitui** a `selecao.ts` e hospeda o bloco da escola como um trecho do
  painel de prédio qualquer — `painelDaEscola` continua sendo a fonte. O `Esc` é **um
  só ouvinte** (`src/input/teclado.ts`): larga a ferramenta e fecha o painel; não
  criar um segundo `keydown` na página.
- **Nota (origem: F12)**: o desbloqueio já está ligado ao `step()` e é
  **permanente** — `registrarConclusoes` só acrescenta a `tiposJaConstruidos`,
  nunca remove. Demolir o último Woodcutter's **não** re-bloqueia a Sawmill, e isso
  é decisão registrada (`sim/desbloqueio.ts`, travada por testes da F06). A F16 não
  precisa de ramo nenhum para desbloqueio.

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
- **Nota (origem: F15a — contrato herdado)**: o veio mora no **prédio**, em
  `PredioCompleto.producao.veio`, semeado de `data/production.json`
  (`predios.<id>.veio.rendimento`) no instante em que a obra vira `'completo'`.
  Campo ausente no dado = renovável (`null`). **Esta feature herda prontos** o
  campo, o decremento por unidade de saída, o estado terminal (`esperando_insumo`
  com `veio === 0` — a rocha é o insumo que não vem mais) e o evento
  `vein-exhausted`. Quando existir camada de terreno (não existe hoje, e nenhuma
  feature antes da F17 produz uma), **só o inicializador muda**: o rendimento
  passa a ser função dos tiles sob e ao redor do prédio. Nenhum sistema precisa
  mudar para isso acontecer.
### F22 — Alertas do HUD
- Prédio sem trabalhador, sem estrada, fome, mina esgotada.
- **Nota (origem: F15a)**: "mina esgotada" também **nasce pronta**: é
  `predio.producao.veio === 0` num prédio completo, e o evento `vein-exhausted`
  marca o instante em que isso passa a valer. "Sem estrada" é
  `predioLigadoAoArmazem(state, predio) === false` — a F15a congela o ciclo nesse
  caso sem criar estado de FSM novo, justamente para que o alerta leia o predicado
  e não um rótulo. Falta **só o mecanismo de exibição**.
- **Nota (origem: F14)**: a derivação de "prédio sem trabalhador" **nasce pronta
  na F14**: é `predio.ocupante === null` num prédio completo cujo tipo pede
  trabalhador — `ehPredioOcupavel` + `vagasDoPredio`, em `sim/ocupacao.ts`. O
  que falta aqui é **só o mecanismo de exibição**, o mesmo que serve as outras
  três causas. A F14 não entregou nada de tela, de propósito.
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
