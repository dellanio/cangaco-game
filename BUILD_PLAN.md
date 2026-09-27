# BUILD_PLAN — cangaço

Fila de trabalho. **Uma feature por sessão**, na ordem. **A fila é este
arquivo**, não o `test-results.json`.

A chave em `test-results.json` **nasce quando a feature fecha**, com
`"passes": true`, e o portão do hook é o que a controla. Feature não iniciada
**não tem chave** — chave `false` para as 30 e tantas features que ainda não
começaram é ruído que não informa nada. *(Corrigido em 2026-09-24: o cabeçalho
mandava criar a chave em `false` desde o começo, e nenhuma sessão jamais fez
isso — a divergência apareceu ao escrever a F-T1. Decisão do operador: a prática
está certa e o cabeçalho estava errado.)*

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
- **Nota (BUG-002 fechado em 2026-09-23 — e a natureza do defeito)**: o armazém
  era **permanentemente não construível**: `desbloqueadoPor: null` com
  `menuBuildInicial` vazio. Corrigido no dado — `storehouse.desbloqueadoPor`
  passa a `"sawmill"`, que é o que o GDD §5.2 escreve ("inicial / Sawmill") e o
  que a árvore do §5.3 desenha (`Storehouse (adicional)` pendurado na Serraria).
  O aceite ganhou o **passo 5**: com a Serraria concluída, o armazém adicional
  libera e **planta de verdade** (dois armazéns no estado, sem `command-rejected`).
- **Nota (a correção tirou a raiz da árvore, e a regra de dados mudou junto)**: com
  o armazém ganhando pai, **nenhum** dos 28 prédios tem `desbloqueadoPor: null`, e
  o grafo fecha um ciclo de propósito (`storehouse → sawmill → woodcutters →
  schoolhouse → storehouse`). As regras `predios/raiz-unica` e `predios/ciclo`
  reprovavam exatamente isso. Elas foram **reconfiguradas para o caso legítimo**,
  não afrouxadas (§10): a semente deixou de ser "pai nulo" e passou a ser o que
  já está de pé na abertura (`economy.estadoInicial.predios` + `menuBuildInicial`),
  e o invariante virou **alcance** — `predios/alcance` acusa todo prédio que exista
  no JSON e nunca no jogo, que é o que aquelas duas sempre protegeram de fato.
  `predios/ciclo` sobrevive só para ciclo que a semente não toca.
- **Nota (a disponibilidade é decisão de FASE, não só da árvore — decisão do
  operador, 2026-09-23)**: no original, as primeiras missões permitem **um só**
  armazém, e do meio da campanha em diante o jogo libera mais. A árvore diz o que
  cada prédio **exige**; a fase diz o que está **disponível** naquela missão. Hoje
  o jogo tem uma configuração só (sandbox), então a árvore basta e nada mais é
  preciso. Quando a campanha existir, ela ganha uma camada de permissão por fase
  por cima: a fase **restringe** o que a árvore autorizou, nunca o contrário.
  Escrito também no GDD §5.3. **O que quem implementar a fase herda**:
  `menuBuildInicial` é o lugar natural dela e hoje **só pode ficar vazio** — a
  regra `economia/menu-inicial` ainda exige raiz sem pai, e não existe mais
  nenhuma. Revisitar aquela regra faz parte do trabalho da fase; não é
  esquecimento. O ramo `desbloqueadoPor: null` continua vivo no código e no tipo
  (`PredioData` declara `string | null` à mão, senão a inferência do JSON o
  estreitaria para `string`) e se prova com dado sintético em `tests/F06`.

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
- **Aceite** (reescrito em 2026-09-24, ver nota D3):
  (a) screenshot do painel com a fila cheia, e roteiro que enfileira por clique e
  confirma a fila no estado;
  (b) **cancelamento**, com o laço andando: o roteiro despausa, aperta o `x` de
  um item por 150 ms (`mouse.down` / `waitForTimeout(150)` / `mouse.up`, nunca
  `page.click()`) e confirma pelo **estado** que a fila encolheu de N para N-1 —
  medido nos dois lados do gesto, não descrito.
- **Evidência**: `screenshots/F13b-*.png`
- **Nota**: **feature de integração** (CLAUDE.md §10): pode tocar `src/ui/`,
  `src/input/` e `src/render/` na mesma feature, porque o painel precisa abrir a
  partir do prédio clicado.
- **Nota**: a seleção de prédio é da F16b. Decidir na sessão da F13b se o painel
  abre por clique próprio (mínimo viável, sem painel genérico) ou pela ponte de
  harness; não antecipar a F16.
- **Nota (D1, decidido na F13b)**: **clique próprio**, mínimo viável. Com a
  ferramenta em `'nenhum'`, clicar num tile do footprint de uma schoolhouse
  completa abre o painel (`predioNoTile` + `src/input/selecao.ts`); `Esc` e clique
  fora fecham. A ponte de harness foi recusada: é superfície de teste, e um painel
  que só abre pelo Playwright não é a feature.
- **Nota (D3, decisão do operador — aceite reescrito, não chave virada)**: o
  aceite original cobria **enfileirar** e não **cancelar**; o cancelamento só
  aparecia no *Escopo*. Resultado: a F13b continuou verde com o `x` quebrado
  (BUG-B), porque o critério nunca pediu a perna que quebrou. É o mesmo defeito
  de critério escrito antes do código que já apareceu na **F12**, na **F15a** e
  na **F15b** — aceite que descreve o caminho feliz e cala sobre a operação
  inversa. A perna (b) existe para isso, e o "com o laço andando" não é detalhe
  de implementação: é a única condição em que o defeito aparece (CLAUDE.md §8).
  A chave em `test-results.json` **não** foi virada: o roteiro já cumpre as duas
  pernas desde `8f118af`, e o passo do cancelamento foi provado nos dois
  sentidos — desligado o conserto de `painel-predio.ts`, ele falha.
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
- **Aceite**: cenário de 1300 ticks, caminho real (planta, obra concluída,
  especialista treinado na escola e ocupando). A pedreira ocupada e ligada por
  estrada deposita stone na gaveta `saida` em intervalos **exatos e iguais**, até
  o teto da gaveta, e o especialista **não volta** a `ocioso` depois de ocupar.
  Uma serraria sem tronco fica em `esperando_insumo` sem gastar relógio. Com o
  veio curto (dado injetado), a produção para e `vein-exhausted` sai **uma vez**.
- **Correção do aceite (F15a, medida)**: o texto original dizia 1000 ticks e
  "nunca passa por `ocioso`". Os dois estavam errados, e a medição está em
  `test-output/F15a.json`. (a) o caminho real gasta 281 ticks até a ocupação
  (stonemason treinado no tick 179, obra `completo` em 240, ocupada em 281) e 5
  ciclos de 167 ticks custam outros 835 — a gaveta só enche no tick 1116, e o
  rótulo `saida_cheia` só aparece no 1283, quando o 6º ciclo fica pronto sem
  onde cair. 1000 ticks não alcançam nada disso. (b) **toda** unidade nasce
  `ocioso` na escola; o que a feature garante é que ela não *regride* a
  `ocioso` depois de ocupar. As duas cláusulas passaram a ser verificadas com
  esses números.
- **Evidência**: `test-output/F15a.json`
- **Nota (origem: F14)**: prédio sem `ocupante` **não produz** — a pergunta é
  `ehPredioOcupavel(predio) && predio.ocupante === null` (`sim/ocupacao.ts`). É
  nesta feature que "fica parado" ganha significado observável, e é aqui que
  entram `esperando_insumo` e `saida_cheia` (GDD §6.2).
- ~~**Nota**: prédio **sem ligação** ao armazém (`predioLigadoAoArmazem`, F08) **não
  produz** — a estrada é requisito de funcionamento (GDD §5.1).~~ **REVOGADA**
  (operador, 2026-09-25) — ver abaixo.
- ~~**Nota (D6, decisão do operador)**: prédio sem estrada fica em **`saida_cheia`**,
  com o relógio do ciclo congelado.~~ **REVOGADA pelo operador em 2026-09-25**, e o
  portão saiu de `sim/systems/especialistas.ts`. A razão dele: *"a estrada serve para
  escoar, não para trabalhar; o lenhador corta árvore com machado, não com carroça."*
  Ele registrou também que a D6 **nasceu errada**: foi escrita na F16c raciocinando
  sobre pausa e modo, sem pensar em produção sem estrada; o texto real da GDD §5.1
  ("planta com porta ao sul; precisa de estrada até a rede") é regra de
  **posicionamento** e nunca disse que a produção para. O que vale hoje: prédio
  desligado **produz** e para em `saida_cheia` quando a **gaveta** enche
  (`production.estoqueInternoPorPredio`), pelo caminho normal. **Nenhum estado de FSM
  fora da lista do GDD §6.2**, como antes. O jogador continua avisado: a causa
  `'sem-estrada'` do alerta deriva direto de `predioLigadoAoArmazem === false` em
  `sim/selectors.ts`, sem passar pela produção. O aceite invertido está em
  `tests/F15a-producao.test.ts` ("prédio sem ligação ao armazém PRODUZ, e para quando
  a gaveta enche"), na mesma posição da asserção antiga, de propósito.
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
  Escolher modo é comando de prédio (GDD §2.3) — F16c.

### F15b-1 — Produção: a escada do produtor (níveis 4, 5, 6 e 7)
- **Escopo**: níveis **4** (`insumo-producao-parada`), **5**
  (`insumo-producao-baixa`), **6** (`saida-cheia-para-armazem`) e **7**
  (`excedente-para-armazem`) da escada de `data/delivery.json`. O serf leva
  insumo do armazém à gaveta `entrada` de um produtor, leva a gaveta `saida` de
  um produtor ao armazém, e devolve ao armazém a mercadoria parada em prédio que
  não a pede mais.
- **Aceite**: (a) pedreira ocupada e ligada por estrada com `saida > 0` gera
  tarefa de nível 6 e o stone chega ao armazém; (b) Sawmill sem tronco gera
  nível 4, Sawmill com estoque parcial gera nível 5, e alimentada por serf o
  `progresso` dela avança; (c) escola com fila cancelada devolve o ouro ao
  armazém pelo nível 7 e a gaveta `entrada` fica vazia; (d) nenhuma unidade de
  mercadoria some nem se duplica no trajeto, e nenhuma invariante do JobBoard é
  violada em nenhum tick da corrida.
- **Evidência**: `test-output/F15b-escada.json`
- **Nota (alargamento de escopo, decisão do operador em 2026-09-23)**: o escopo
  original desta feature dizia níveis **6 e 7** só. Os níveis **4** e **5**
  entram junto, e a razão está registrada como o operador a deu: **erro de
  sequenciamento na escrita da F15** — ela foi escrita pensando em quem
  *produz*, e passou despercebido que a Sawmill *consome*. Não é escopo
  alargado por conveniência de quem implementa. O fato que torna o conserto
  obrigatório aqui: **nada mais na fila é dono dos níveis 4 e 5**, e sem eles
  nenhuma carga entra na gaveta `entrada` de um produtor — a Sawmill fica em
  `esperando_insumo` para sempre (F15a, `test-output/F15a.json`,
  `cenariosControlados.serrariaSemTronco`: 300 ticks, progresso 0). O cenário
  oráculo do GDD §4.5 (2 Woodcutter's : 1 Sawmill) e o aceite da **F17**
  ("estoque de timber maior que o inicial") dependem dos quatro níveis.
- **Nota (D3)**: o nível 6 dispara com **estoque > 0** na gaveta `saida`, não com
  a gaveta cheia. Esperar encher faria de `saida_cheia` o regime permanente, e o
  GDD §6.2 a descreve como **sinal de gargalo**. O nome do nível no dado
  (`saida-cheia-para-armazem`) descreve o sintoma que ele evita, não a condição
  de disparo.
- **Nota (D2, urgência fotografada)**: os níveis 4 e 5 são o mesmo pedido com
  urgência diferente — 4 é "precisa e tem zero", 5 é "tem menos que o alvo". O
  tipo é decidido na **criação** da tarefa e **nunca muda** depois de `reclamada`
  ou `carregando`: trocar o tipo com a carga na mão do serf é trocar a tarefa
  sem devolver a reserva. Só tarefa **aberta** é re-tipada, e de graça, por
  `abertaVale` → `sanearTarefas` → `gerarTarefas` no mesmo tick.
- **Nota (D4, decisão do operador)**: o ouro parado na entrada da escola é
  **resolvido pelo nível 7**, não pela tela. O vazamento se conserta na origem e
  o HUD continua com **uma regra só** — conta armazéns. A pedra parada na saída
  de um produtor **não** é distorção: é limitada ao buffer, drenada pelo nível 6,
  e é pedra que o jogador não pode gastar. **Sem nota de feature de integração;
  nada de `render/` nem de `ui/` aqui.**
- **Nota (origem: revisão da F13a)**: há uma janela real em que ouro fica parado
  na gaveta `entrada` da Schoolhouse: o ouro do segundo item chega enquanto o
  primeiro treina, e se o jogador cancelar a fila inteira nesse intervalo o ouro
  fica lá. Não se perde (o próximo `EnqueueTraining` o consome) e, até esta
  feature, **não** voltava ao armazém — sumia do HUD, que lê
  `estoqueDosArmazens`. A F13a não trata disso; o aceite dela não fala de
  cancelamento. É o nível 7 que fecha.
- **Nota**: **o que o HUD conta está decidido (operador, pós-F10): o estoque dos ARMAZÉNS.** O
  número da barra precisa prever o que o jogador pode gastar, e a estrada (F08) e as obras (F10)
  só tiram de armazém; somar a saída de uma pedreira mostraria pedra que ninguém consegue usar. O
  HUD lê `estoqueDosArmazens` (`sim/selectors.ts`) para **gold, timber e stone**; `estoqueTotal`
  continua para outros usos. **Reservado não é descontado** (a pedra ainda está lá; a prévia da
  estrada já explica a recusa) e a mercadoria em trânsito, na mão de um serf, não conta. O teste
  com uma pedreira de estoque próprio já existe (`tests/F05b-hud-armazens.test.ts`); aqui vale
  repeti-lo com a produção real. **Fica em aberto para a F20:** o campo **Comida** do HUD
  continua em `comidaTotal` (que usa `estoqueTotal`) — decidir, quando o Inn existir, se comida
  também é só a dos armazéns.
- **Nota (origem: F09)** — *a primeira linha desta nota está faltando no arquivo;
  preservada literalmente como estava, sem reconstituir o que se perdeu:*
  insumo → produção com estoque baixo, saída cheia → armazém, excedente → armazém):
  a F09 só implementa o nível 3 (material → obra). Cada produtor alarga
  `Tarefa.tipo` e referencia o nível por `id` em `data/delivery.json`. E o
  `alertaTarefaSemCandidato_segundos` (alerta de HUD para tarefa sem candidato) só
  passa a ter consumidor quando existir o alerta — a F09 não o usa.
- **Nota (contrato que a F20 herda)**: `alvoDeEntrada` (`sim/insumo.ts`) reparte a
  capacidade da gaveta `entrada` na **proporção da receita**, com a sobra da
  divisão indo para a mercadoria de maior `entra` (desempate por nome, para ser
  determinístico). Aqui ela só é exercitada com receitas de **uma** entrada. O
  primeiro prédio de duas entradas reais (`metallurgists`, `iron_smithy`) é o
  primeiro teste de verdade dessa regra.

### F15b-2 — Produção: o cenário oráculo e a calibração
- **Escopo**: o cenário longo do GDD §4.5 (2 Woodcutter's : 1 Sawmill, com serfs
  entregando), a medição que ele produz e a calibração do `rendimento` do veio.
  **Mede antes de ajustar**: nenhuma taxa muda sem os números na mão.
- **Aceite**: cenário completo, 3000 ticks. O **acumulado produzido** de stone e
  timber é maior que zero e cresce monotonicamente enquanto houver rocha e
  árvore. Nenhum **especialista** em `ocioso` por mais de
  `delivery.alertaTarefaSemCandidato_segundos` (30 s → 300 ticks) consecutivos.
- **Correção do aceite (F15b, decisão do operador em 2026-09-23)**: o texto
  original dizia "o **estoque** de stone e timber (...) cresce
  monotonicamente". Está errado, e a razão é estrutural, não de balanceamento:
  **o saldo do armazém cai de modo legítimo**, porque é de lá que o serf tira o
  tronco que leva à Sawmill (nível 4/5) e o material que leva à obra (nível 3).
  Um critério de monotonicidade sobre o saldo reprovaria exatamente o
  comportamento que esta feature existe para criar. O que cresce
  monotonicamente é o **acumulado produzido** — a soma de tudo que saiu de um
  ciclo de produção, que por construção nunca decresce. O `X` do ócio também
  saiu do limbo: `ticksAlertaTarefaSemCandidato` (300), e **"trabalhador" =
  especialista** (confirmado pelo operador) — serf e laborer passam por `ocioso`
  legitimamente entre tarefas.
- **Evidência**: `test-output/F15.json`
- **Nota (operador)**: a **calibração não sai da Fase A** — ela é o que prova que
  o jogo tem ritmo, e o aceite da F17 depende dela.
- **Nota (a calibrar aqui)**: `production.json: quarry.veio.rendimento = 200` é
  ponto de partida aprovado pelo operador (~55 min de produção contínua na escala
  2.0 — quase uma partida inteira de uma Quarry, que casa com o original, onde se
  constroem várias e elas se esgotam). Ver `BALANCE_LOG.md`.
- **Nota (como medir o veio, decisão do operador em 2026-09-23)**: **medir com
  veio curto e extrapolar, declarando a extrapolação como extrapolação.** A
  aritmética direta (200 × ticks do ciclo) mente, porque pressupõe a pedreira
  trabalhando sem parar — e a F15a mostrou ela congelando em `saida_cheia` com a
  gaveta cheia (tick 1116). O tempo real inclui toda espera por serf. **Não
  gastar 40 mil ticks de CLI nesta sessão**; se o número extrapolado parecer fora
  de escala com o jogo rodando, aí vale a corrida longa.
- **Nota (contrato que a F17 herda)**: o cenário `oraculo` de `tools/sim.js` e os
  números do `BALANCE_LOG.md` são a linha de base do aceite da Fase A. Se as
  taxas mudarem entre uma coisa e outra, a linha de base morre junto e precisa
  ser remedida.

### F16a — Demolir prédio (sim)
- **Escopo**: comando `DemolishBuilding` na união `Command`, devolução do
  material de construção **e do estoque interno** ao armazém, e a limpeza das
  tarefas, filas e ocupação pelo saneamento do mesmo tick. Só `src/sim/`.
- **Aceite**: teste que demole um prédio com tarefa em curso **pelo comando
  real** e confirma que nenhuma tarefa órfã sobrou no JobBoard e nenhum serf
  ficou travado.
- **Evidência**: `test-output/F16a.json`. **Sem screenshot**: esta metade não
  muda um pixel; o screenshot que o escopo da F16 pedia é da F16b.
- **Nota (corte da F16 — decisão do operador, 2026-09-23)**: a F16 virou três
  itens, nesta ordem: **F16a** (demolir, sim) → **F16c** (pausar e modos, sim) →
  **F16b** (painel, integração). Razão registrada como ele a deu: a metade de
  `sim/` carrega as duas notas mais delicadas da fila (escola com tarefa de ouro
  reclamada; estrada da porta com treino já pago), e se a segunda travasse ele
  queria o travamento numa feature focada. A nota de integração ele autorizaria
  se a metade de `sim/` fosse trivial; não é. **A F16a e a F16c não tocam
  `render/`, `ui/` nem `input/` e por isso não levam nota de integração.**
- **Nota (origem: F10)**: **a falha "obra demolida com o serf a caminho" foi
  provada na F10 por injeção**, tirando a obra do estado com um helper de teste
  (`semOPredio`), porque não existe comando de demolir prédio antes desta
  feature. A F10 garante o caminho — `sanearTarefas` cancela a tarefa e o serf
  carregado vai a `devolvendo`, deposita e fica `ocioso` — mas **esta feature
  repete o teste pelo comando real**, com o serf carregando e com o serf ainda
  indo buscar, e confirma que a carga voltou ao armazém.
- **Nota (origem: revisão da F13a)**: **dois casos de teste que esta feature deve
  cobrir**, os dois só alcançáveis com o comando real de demolir. (1) **Escola
  demolida com tarefa `ouro-para-escola` já reclamada.** O ramo existe
  (`motivoDoDestino` em `sim/systems/jobs.ts`) mas é código sem teste: o
  `destino-sumiu` coberto pela F09 e pela F10 é o ramo de *material*, e o teste
  da F13a demole a escola sem tarefa no quadro. (2) **Estrada da porta demolida
  com um item de treino já pago.** A hipótese da F13a era que a porta ficaria
  intransitável e o item pronto seguraria com o ouro já cobrado. **Medida na
  Tarefa 1 da sessão, antes de escrever qualquer código: a hipótese é falsa.**
  `tileDeSaida` pergunta por `tileAndavel(..., 'livre')` e estrada não entra
  nessa conta, então com os três tiles da porta demolidos a unidade nasce
  normalmente e o ouro não fica preso (`tests/F16a-porta.test.ts`, caso 1a;
  medição em `test-output/F16a-porta.json`). A via que trava de verdade é a
  porta coberta por **footprint**, e ela era alcançável porque `canPlace`
  aceitava a planta ali — é o achado que corrige a F06, na nota abaixo. Com
  aquela recusa no lugar, o `if (tile === null) continue` de
  `systems/escolas.ts` vira defesa sem caminho de jogo, não código morto.
- **Nota (origem: F14)**: demolir prédio **ocupado** tem que devolver o
  especialista a `ocioso`. O caminho existe — `passoProduzindo`
  (`sim/systems/especialistas.ts`) lê a posse do prédio; a nota antiga da F16
  chamava essa função de `passoTrabalhando`, nome que não existe no código — e
  quem o prova pelo comando real é este item. A **evidência visual** da ocupação
  (`PredioCompleto.ocupante` no painel) migrou para a F16b, que é quem tem
  screenshot.
- **Nota (devolução do estoque interno — decisão do operador, 2026-09-23)**: o
  estoque das gavetas do prédio demolido vai **integralmente para o armazém
  completo mais próximo alcançável**; sem armazém alcançável **se perde, e o
  teste declara esse caso**. É o mesmo que o serf já faz em `devolvendo`. Razão
  dele: os níveis 6 e 7 da escada existem desde a F15b exatamente para trazer
  essas mercadorias de volta, então destruir o que o jogador recuperaria
  esperando um tick pune quem demole rápido — e a conservação de bens é uma das
  invariantes mais fortes do projeto, que não se troca por simplicidade.
- **Nota (achado da F16a que corrige a F06 — decisão do operador, 2026-09-23)**:
  `canPlace` só checa footprint contra footprint, então hoje é possível plantar
  em cima da **porta** de um prédio existente e deixá-lo sem saída. O buraco é da
  F06 e a correção vai lá: **`canPlace` recusa posicionamento que cubra a borda
  sul de um prédio existente, ou que deixe a própria borda sul fora do mapa, com
  motivo próprio** — uma regra, um motivo, uma checagem ("a borda sul precisa
  estar no mapa e livre"). A razão que fecha o caso da borda do mapa: prédio
  colado nela nunca poderá receber entrega, porque não há onde passar a estrada;
  recusar não é rigor, é impedir que o jogador construa algo que nasce inútil.
  **Consequência medida, além das duas formas que o operador nomeou**: dois
  prédios deixam de poder se encostar na VERTICAL, nos dois sentidos — o de
  baixo cobriria a porta do de cima, e o de cima teria a própria porta coberta.
  Encostar na horizontal continua valendo. Três casos da F06 foram atualizados
  por isso (`tests/F06-build.test.ts`), com o motivo escrito ao lado de cada um.
- **Nota (origem: F12)**: o desbloqueio já está ligado ao `step()` e é
  **permanente** — `registrarConclusoes` só acrescenta a `tiposJaConstruidos`,
  nunca remove. Demolir o último Woodcutter's **não** re-bloqueia a Sawmill, e
  isso é decisão registrada (`sim/desbloqueio.ts`, travada por testes da F06).
  Nenhum ramo de desbloqueio é preciso aqui.

### F16c — Pausar e modos (sim)
- **Escopo**: `pausar` como estado de prédio ganha **campo em `PredioCompleto` e
  leitor no sistema de produção**, com comando próprio. Só `src/sim/`. Os `modos`
  do Woodcutter's **saíram do escopo** — ver a Nota da emenda.
- **Aceite**: teste que pausa um prédio em produção e confirma que o ciclo para
  segundo a semântica decidida, e que despausar retoma sem perder nem duplicar
  mercadoria.
- **Evidência**: `test-output/F16c.json`. Sem screenshot: o botão é da F16b.
- **Nota (ordem — decisão do operador, 2026-09-23)**: este item vem **antes da
  F16b**, e não depois, porque o botão pausar está no escopo escrito da F16 e um
  painel sem ele é entrega pela metade. A F16b monta o botão sobre comando que já
  existe, em vez de nascer com um buraco.
- **Nota (origem: F15a, D7)**: `modos` do Woodcutter's continua **sem leitor**
  desde a F15a; lá o lenhador replanta sempre, e por isso o veio dele é `null`.
  Escolher modo é comando de prédio (GDD §2.3).
- **Nota (semântica de pausar — decisão do operador, 2026-09-23)**: o GDD gasta
  uma linha `[geral]` em pausar (§2.3) e não diz a semântica; a pergunta estava
  aberta aqui e foi **fechada assim: pausar congela o relógio de produção daquele
  prédio, e nada mais**. (a) a gaveta `saida` **continua escoando** — congelá-la
  criaria mercadoria que nenhuma regra libera; (b) **nenhuma tarefa de transporte
  é cancelada** e o gerador continua até o alvo de sempre — o destino é validado
  pelo TIPO do prédio (`motivoDoDestino`), então não há órfã, e zerar o alvo
  mandaria a gaveta de entrada de volta ao armazém pelo nível 7 a cada pausa;
  (c) **o ocupante fica**, com rótulo `trabalhando` — prédio pausado e vago
  anunciaria vaga e puxaria um especialista para sentar parado, tirando-o de um
  prédio que produziria. Um campo (`PredioCompleto.pausado`), um leitor (o topo
  de `produzir`), nenhum estado de FSM novo: "pausado" se compõe do campo mais o
  ocupante. Plano e alternativas rejeitadas em `docs/planos/F16c-pausar.md` §3.
- **Nota (emenda do aceite — decisão do operador, 2026-09-23)**: a cláusula "teste
  que troca o modo do Woodcutter's e confirma que o comportamento do lenhador
  acompanha" **saiu do aceite**. Razão: **o comportamento que o modo governaria
  não existe**, e cumprir o critério exigiria fabricá-lo. `ambos` é o
  comportamento de hoje; `replantar` (não produzir) seria `pausar` com outro nome;
  `cortar` exigiria estoque finito de árvore no terreno — e não há camada de
  terreno na sim (é por isso que o veio mora no prédio, F15a/D2). **Pré-condição
  para voltar**: a camada de terreno com árvore, hoje **sem dono na fila** — mesmo
  tratamento do `terreno` da F06. O campo `modos` continua em
  `data/production.json`, **sem leitor e com `notas` dizendo isso**, para que a
  próxima sessão não ache que alguém esqueceu de ligá-lo. Registrado também em
  `IDEIAS.md`, que é onde a camada de terreno acumula dependentes.
- **Nota (recusa do comando)**: `SetBuildingPaused` é recusado com
  `command-rejected` em dois casos — `predio-inexistente` e `predio-em-obra`
  (pausar obra, isto é "parar de martelar", é feature que ninguém escreveu; a
  leitura conservadora do §14 é recusar). Prédio completo **sem receita**
  (armazém, escola, quartel) é aceito: o campo é do prédio, não da receita, e
  pausá-lo simplesmente não tem leitor. **Sem evento próprio de pausa** — decisão
  do operador: evento sem consumidor não nasce; quem precisar cria na feature que
  o consome.

### F16b — Painel de seleção e demolição (integração)
- **Escopo**: clicar em prédio mostra nome, HP ou progresso de obra, ocupante,
  estoque de entrada e saída, botões pausar e demolir — os dois apoiados em
  comando que já existe (F16a e F16c).
- **Aceite**: screenshot do painel de um prédio completo e ocupado, e roteiro que
  demole por clique e confirma o prédio fora do estado.
- **Evidência**: `screenshots/F16b-*.png`
- **Nota**: **feature de integração** (CLAUDE.md §10): pode tocar `src/ui/`,
  `src/input/` e `src/render/` na mesma feature, porque o painel precisa abrir a
  partir do prédio clicado e desenhar o que a sim já decide. Autorizada pelo
  operador em 2026-09-23, escrita aqui **antes do código**. A exceção é **só
  deste item**: a F16a e a F16c não a herdam.
- **Nota (origem: F13b)**: **contrato herdado.** `src/input/selecao.ts` (só guarda
  o id do prédio aberto, estado de interface, nunca `GameState`), `predioNoTile`
  (`sim/selectors.ts`) e o `<aside id="painel-escola">` são o **mínimo** da F13b: a
  seleção só reconhece schoolhouse e o painel é específico. A seleção genérica
  desta feature **substitui** a `selecao.ts` e hospeda o bloco da escola como um
  trecho do painel de prédio qualquer — `painelDaEscola` continua sendo a fonte.
  O `Esc` é **um só ouvinte** (`src/input/teclado.ts`): larga a ferramenta e
  fecha o painel; não criar um segundo `keydown` na página.
- **Nota (origem: F14)**: o "ocupante" do painel é `PredioCompleto.ocupante`, um
  id de unidade ou `null`. É nesta feature que a ocupação ganha **evidência
  visual** — o aceite daqui pede screenshot, o da F14 não pedia.
- **Nota (origem: F16c — contrato herdado)**: o botão pausar emite
  `SetBuildingPaused { predio, pausado }` com o **valor explícito**, nunca um
  alternador: reenviar o comando não pode inverter o estado, e mandar o valor que
  o prédio já tem é no-op silencioso na sim. O painel compõe "pausado" de
  **`predio.pausado` + o ocupante** — não existe rótulo de FSM `pausado` para
  ler, e o especialista de um prédio pausado continua em `trabalhando`, de
  propósito. **Não há evento de pausa**: se a tela precisar de um (som, toast),
  ela nasce aqui, na feature que o consome. O botão só faz sentido em prédio com
  `producao !== null`; a sim aceita pausar qualquer prédio completo, então quem
  esconde o botão em armazém/escola/quartel é a tela.

### F17 — Aceite da Fase A (integração)
- **Escopo**: roteiro Playwright que executa a sessão inteira do critério de
  aceite do GDD, só com cliques.
- **Aceite**: o roteiro conclui com 2 Woodcutter's, 1 Quarry e 1 Sawmill
  completos e ocupados, ligados por estrada, e o estoque de timber maior que o
  inicial. Screenshot final da vila.
- **Evidência**: `test-output/F17.json` + `screenshots/F17-final.png`
- **Nota (origem: F16a — consequência medida da regra da porta)**: desde a F16a
  o `canPlace` recusa com `porta-sem-saida` todo prédio cuja borda sul (a porta,
  GDD §5.1) caia fora do mapa ou sob o footprint de outro. A checagem é
  simétrica, então **dois prédios não podem se encostar na vertical, nos dois
  sentidos**; na horizontal continua valendo. Decisão do operador (2026-09-23):
  a regra fica — encostar na vertical quebraria a entrega, e recusar no clique é
  melhor que o jogador descobrir que o prédio nunca recebe material.
  **Esta feature mede a consequência**: ao montar a abertura recomendada (2
  Woodcutter's, 1 Quarry, 1 Sawmill) ligadas por estrada, registre se a vila
  cabe confortavelmente ou se o espaçamento forçado a deixa mais esparsa do que
  o GDD §1.3 sugere. **Se ficar apertado, a saída é reduzir a porta a UMA coluna
  em vez da borda sul inteira — não afrouxar a regra.** Ver `BALANCE_LOG.md`
  [2026-09-23].
- **Nota (origem: F16b — a cadeia já foi medida)**: a F16b rodou a cadeia inteira
  da Fase A pelo caminho do jogador (rua → planta → obra → escola treina → o
  especialista ocupa) e **gravou os ticks de cada etapa** em
  `docs/planos/F16b-painel-predio.md` §7 (o JSON cru fica em
  `test-output/F16b-sonda.json`, que o git **ignora** — por isso a medição foi
  copiada para arquivo versionado): treino começa em 29, termina em 179, obra
  completa em 220, ocupação em 241, primeira pedra em 408 (semente
  `20260920`, uma pedreira). **Compare contra esses números em vez de descobrir
  de novo**: se baterem, esta feature é confirmação; se divergirem muito, algo
  entre as duas sessões mudou o balanceamento e isso é o achado. Herda também
  `tools/shots/F16b.js` (a geometria da rua e do encaixe da pedreira já validada
  contra a regra da porta) e `window.__cangaco.prediosDoEstado`, que dá tipo,
  estado, posição, `pausado` e `ocupante` de cada prédio — é por ali que o
  roteiro acha o id de um prédio recém-construído, que não tem id previsível.
- **Nota (origem: F16b — armadilha medida)**: **não afirme o conteúdo da gaveta
  `saida` de um prédio de produção.** A sonda mediu: a pedreira fica com a gaveta
  vazia quase o tempo todo (o carregador leva a pedra assim que ela sai — pedra
  presente em 2 de 24 amostras). Estoque cheio se prova no **armazém**, que é
  onde ele para. O aceite desta feature já pede `timber` acima do inicial, o que
  é a forma certa; não troque por "a serraria tem tábua na gaveta".

### F17b — Material entregue visível na obra (integração)
- **Escopo**: olhando o mapa, **sem selecionar nada**, o jogador vê em cada obra
  quanto de cada material já chegou e quanto falta — blocos geométricos, um por
  unidade, cheio = entregue (placeholder do §9, não arte). O painel da obra
  selecionada passa a escrever `chegou/total` por material, inclusive o material
  já completo. A informação já existe: `PredioEmObra.obra.faltam` mais o custo do
  dado; entregue é `custo − faltam`.
- **Aceite**: teste headless da aritmética do medidor (inclusive o material com
  falta 0, que a gaveta `faltam` do seletor hoje esconde), e roteiro que planta
  uma obra, afirma todos os materiais em 0, avança até uma entrega chegar e
  afirma a soma de `entregue` **maior que a primeira leitura** — não maior que
  zero. Screenshot da obra com o medidor cheio e do painel.
- **Evidência**: `test-output/F17b.json` + `screenshots/F17b-2-cheio.png` +
  `screenshots/F17b-3-painel.png`
- **Nota**: **feature de integração** (CLAUDE.md §10): pode tocar `src/render/`
  e `src/ui/` na mesma feature, porque o mesmo número aparece nos dois lugares e
  ter duas contas para ele é como elas divergem. **`src/sim/` não muda** —
  instrução explícita do operador (2026-09-23), escrita aqui antes do código.
  Se a implementação parecer pedir seletor novo, **pare e reporte**.
- **Nota (origem: F16b — o que o painel já faz e o que não faz)**: o painel já
  desenha "Em obra N%" e a gaveta "Falta chegar" (`desenharObra`,
  `src/ui/painel-predio.ts`). *Quanto falta* já está na tela desde a F16b, para
  a obra **selecionada**. O que não existe em lugar nenhum é (a) *quanto já
  chegou* — `linhasDeEstoque` filtra `quantidade > 0`, então o material
  inteiramente entregue **some** da gaveta e o jogador não distingue "a pedra
  chegou" de "esta obra nunca pediu pedra" — e (b) qualquer sinal **no mapa**:
  duas obras, uma abastecida e uma faminta, são pixel a pixel idênticas até que
  um laborer martele. O GDD §1.2 lista "serfs trazem material" como uma seta
  própria do loop micro, separada de "obra sobe em 3 estágios visíveis"; hoje só
  o segundo sinal existe (F11c, `estagio-obra.ts`).
- **Nota (origem: F11c — armadilha medida no diff da cena)**: `atualizarPredios`
  pula o redesenho quando `(id, estado, estagio)` não mudou. Uma entrega **não**
  muda `hp`, logo não muda o estágio: sem pôr a leitura do medidor na chave do
  diff, ele nasce correto e **congela para sempre**, e um screenshot único passa
  assim mesmo. É por isso que o aceite pede o medidor *enchendo*, medido contra
  a primeira leitura.
- **Nota**: a letra `b` aqui não é subdivisão da F17 — é "depois do aceite da
  Fase A, ainda na Fase A". A ordem do arquivo é a ordem de execução, e esta
  feature executa a seguir; numerar entre F17 e F18 renumeraria a Fase B inteira.
- **Plano**: `docs/planos/F17b-material-na-obra.md`

### F17c — Buffer do A* reaproveitado
- **Escopo**: `src/sim/pathfinding.ts`. Hoje toda busca aloca e preenche
  `Float64Array(largura*altura)` + `Int32Array(largura*altura)` — 48 KB por
  chamada a 64², 768 KB a 256². Trocar por **buffer reaproveitado com número de
  geração**: os arrays vivem no módulo, e em vez de `fill` a cada busca, cada
  célula carrega a geração em que foi escrita; geração diferente da atual lê
  como "não visitada". O buffer se recria só quando `largura*altura` muda.
  **Só `sim/`. Nenhuma mudança de comportamento**: mesmo custo, mesmo caminho,
  mesmo desempate, mesma resposta `null`.
- **Aceite**: o custo de uma **busca curta não cresce com o tamanho do mapa**.
  Medir a mesma caminhada de 3 tiles a 64², 128² e 256², com o cache de par
  origem-destino frio, e mostrar os três números. Linha de base medida em
  2026-09-23, antes da correção: **40 µs / 94 µs / 303 µs — 7,6×**.
- **Evidência**: `test-output/F17c.json` com a tabela dos três tamanhos.
- **Nota (a prova de que nada mudou)**: `tests/F10-astar.test.ts` já traz o
  **oráculo independente** — relaxamento em fila (Bellman-Ford, sem heap e sem
  heurística), 4 sementes × 40 mapas no modo livre e × 60 redes no modo estrada,
  mais a equivalência com `isConnected` da F08. É esse arquivo que prova a
  não-regressão desta feature; ele **não muda**. Se precisar mudar, pare e
  reporte: ou o comportamento mudou, ou o teste estava frouxo.
- **Nota (o guarda permanente é estrutural, não cronômetro)**: o aceite pede um
  número medido, e número medido é evidência **da sessão**. A cobertura que fica
  é **contagem de alocação**: um **export novo**, `estatisticasDoRascunho()`,
  com objeto próprio, diz quantas vezes o buffer foi criado; e o teste faz N
  buscas distribuídas pelos três tamanhos e afirma **no máximo uma alocação por
  tamanho distinto** — não N.
  *(Correção de 2026-09-23, do operador: este item dizia "`estatisticasDeBusca()`
  passa a expor". Estaria errado — `tests/F10-astar.test.ts` tem **seis
  asserções `toEqual` sobre o objeto inteiro** de `EstatisticasDeBusca`, nas
  linhas 357, 365, 372, 388, 409 e 424; um campo novo derrubaria as seis, e a
  nota acima manda parar e reportar se esse arquivo precisar mudar. A separação
  é melhor de qualquer forma: busca e cache num lugar, memória em outro.)*
  Isso é determinístico e não depende de relógio. Se um limite de tempo também
  entrar no teste, ele é frouxo e traz o número medido no comentário; se vier a
  oscilar, a correção é a razão mais larga com o motivo escrito, **nunca `skip`
  nem tirar o caso da verificação** (CLAUDE.md §10).
- **Nota (a pureza continua de pé)**: o buffer é rascunho de módulo, como os
  caches de `estrada`/`bloqueado` e o contador de `estatisticasDeBusca` que já
  existem ali. Ele **não entra no `GameState`**, logo save/load e a comparação
  byte a byte da F02/F23 não o enxergam. Duas condições que precisam valer e
  estar escritas no código: toda célula é escrita antes de ser lida (é o que a
  marca de geração garante), e o A* **não é reentrante** — nenhuma busca pode
  começar dentro de outra, porque as duas dividiriam o mesmo rascunho.
- **Nota (por que agora, antes de qualquer mapa maior)**: medido em 2026-09-23
  a 64², 128² e 256² — o custo é da **área do mapa**, não do caminho: a mesma
  caminhada de 3 tiles custa 7,6× mais a 256². Nada mais degrada com o mapa
  (BFS de estrada acompanha o comprimento da rua; `JSON.stringify(estado)` fica
  em 29 KB nos três; culling desenha 234 tiles nos três). Com o cache frio — e
  ele invalida **a cada estrada construída e a cada prédio plantado** — o
  cardápio de um serf ocioso custa 1,58 ms a 64² e **6,03 ms a 256²**: dez serfs
  ociosos comeriam 60 ms de um tick de 100 ms.

### F17f — O primeiro sprite real: o armazém
- **Escopo**: o armazém deixa de ser retângulo e passa a ser desenhado por **PNG**
  nos três estágios de hoje (`marcacao`, `madeira`, `completo`). Os outros 27
  prédios **continuam placeholder, e o jogo não quebra por isso**. O que esta
  feature existe para fixar não é o desenho: é o **formato do
  `assets/manifest.json`**, a **estrutura de pastas** que os outros 27 herdam, a
  **convenção de nome** por prédio e por estágio, a **dimensão** derivada do
  footprint e a **ancoragem** no grid ortogonal. Plano em
  `docs/planos/F17f-primeiro-sprite.md`.
- **Aceite**: teste headless que prova **os dois lados** do §9 — `storehouse`
  resolve os três arquivos, `quarry` resolve `null` e cai no retângulo — mais a
  guarda de convenção `tamanho[0] === footprint[0] × tilePx` e a conferência de
  que todo arquivo declarado **existe** e tem no cabeçalho a dimensão declarada.
  Screenshot do armazém real **ao lado de um prédio placeholder e de uma
  unidade**, para julgar escala: o GDD diz que o civil tem cerca da altura de uma
  porta, e isso nunca foi visto.
- **Evidência**: `test-output/F17f.json` +
  `screenshots/F17f-1-armazem-placeholder-unidade.png` +
  `screenshots/F17f-2-obra-placeholder-ao-lado-do-sprite.png`
- **Nota (as fotos de obra do armazém não existem, e por quê — 2026-09-23)**: a
  evidência dizia `F17f-2-obra-marcacao` e `F17f-3-obra-madeira`. **Não há como
  pôr os dois na tela**: o armazém é permanentemente não construível
  (`desbloqueadoPor: null` com `menuBuildInicial` vazio — era o BUG-002), então o
  único prédio com arte nunca estava em obra. Os três estágios continuam provados
  no teste headless, que resolve os três arquivos e confere a dimensão de cada um;
  o que ficou faltando é só a prova **na tela**. **O BUG-002 foi corrigido no
  mesmo dia** (ver a Nota da F12): o armazém adicional agora planta, e as duas
  fotos passaram a ser possíveis — elas **não foram capturadas**, porque conduzir
  uma obra até `madeira` por clique é o roteiro grande que pertence à F17. Quem
  quiser fechá-las tem o caminho pronto: Casa do Lenhador → Serraria → Armazém.
  No lugar delas, a foto 2 prova o outro lado do §9 com uma obra de
  `woodcutters` (sem arte, rectângulo) **ao lado** do armazém com sprite, no mesmo
  quadro: é a convivência que a feature existe para garantir.
- **Nota (não é feature de integração)**: toca `src/render/`, `assets/`, `tools/`
  e `tests/`. **`src/sim/` e `src/ui/` não mudam** — logo não precisa da exceção
  do §10, e não ganha uma no meio do caminho. Se a implementação parecer pedir
  campo novo em `sim/`, **pare e reporte**.
- **Nota (a dimensão é 192×128, não 192×192 — medido em 2026-09-23)**: a fonte é
  1536×1024, e **1536 = 192 × 8 exato**, então a redução por 8 é limpa. Mas a
  razão é **3:2**: forçar 192×192 esticaria a arte 1,5× na vertical. A regra que
  esta feature fixa é **a largura manda** — `tamanho[0] = footprint[0] × tilePx` —
  e a **altura é o que a arte der**, gravada no manifesto e conferida contra o
  cabeçalho do PNG. O desenho escala por **um** fator, o da largura; dois fatores
  esticam, e é isso que o teste impede.
- **Nota (os três estágios não estão registrados entre si)**: bbox de alpha de
  1454×961, 1498×964 e 1514×1007, com offsets diferentes. Recortar cada estágio
  pelo seu conteúdo faria o prédio **pular de posição** ao trocar de estágio: a
  derivação escala o **canvas inteiro**, sem recorte, e o registro se preserva
  por construção.
- **Nota (perspectiva divergente, conhecida e a substituir)**: a arte fornecida é
  **isométrica**; a convenção do projeto (§9.3 do CLAUDE.md) é **3/4 sobre grid
  ortogonal**. Usada assim mesmo, por decisão do operador de 2026-09-23: o
  objetivo é validar manifesto, dimensão e ancoragem, **não a arte final**. Fica
  registrado no `origem.nota` do manifesto e na evidência do teste. É também a
  razão de o prédio ocupar a metade de baixo do quadrado de chão — em isométrico
  o chão de um 3×3 é losango, mais largo que alto.
- **Nota (por que antes da F17d e da F17e)**: a arte entregue tem exatamente os
  **três** estágios que existem hoje, e a F17e transforma três em seis. Se ela
  vier antes, o armazém nasce metade sprite e metade retângulo, e a foto de
  escala fica poluída. As letras são id, não ordem — **a ordem é a do arquivo**,
  como a F16a/F16c/F16b já demonstram.

### F17d — Nivelamento visível no canteiro (integração)
- **Escopo**: olhando o mapa, **sem selecionar nada**, o jogador vê o canteiro de
  uma obra ficar plano **tile a tile** enquanto o laborer nivela, e distingue uma
  obra ainda sendo nivelada de uma **pronta para receber material**. A informação
  já existe e nunca foi olhada com esta lente: o alvo é `área do footprint ×
  ticksNivelamentoPorTile` (`sim/obra.ts:28-33`) e `nivelamento` sobe `+1` por
  laborer por tick, com teto no alvo (`sim/systems/laborers.ts:121`) — logo
  `tilesProntos = floor(nivelamento / ticksNivelamentoPorTile)` é a **contagem
  exata de tiles já aplainados**, e o resto da divisão dá a fração do tile em
  curso. Aritmética pura em `render/nivelamento-obra.ts`, **zero imports**, como
  `medidor-obra.ts`; o alvo por tipo entra em `AparenciaDoPredio` pelo funil
  `render/predios.ts`, que já importa `sim/obra` para o `custoDoPredio`.
- **Aceite**: teste headless da aritmética — `nivelamento = 0` dá 0 tiles,
  `= alvo` dá todos e `nivelada`, com footprint de 2 tiles (`gold_mine`) e de 16
  (`barracks`). Roteiro que planta uma obra, lê `tilesProntos` **no tick da
  planta** e afirma, depois de avançar, **maior que a primeira leitura** — não
  maior que zero. Screenshot do canteiro pela metade e do canteiro plano com o
  medidor de material aceso.
- **Evidência**: `test-output/F17d.json` + `screenshots/F17d-1-nivelando.png` +
  `screenshots/F17d-2-nivelada.png`
- **Nota (Tarefa 0 — correção da F16b, commit próprio)**: o painel escreve
  **"Em obra 0%" durante todo o nivelamento**, porque `progresso` é
  `predio.hp / def.hp` (`sim/selectors.ts:442`) e `hp` só sobe com o martelo.
  Isso é **defeito do painel da F16b**, não escolha desta feature — mesmo
  tratamento do filtro `quantidade > 0` (commit `e014a0c`, `fix(F16b)`).
  Vai numa tarefa própria, a **primeira**, com commit `fix(F16b): ...`, antes de
  qualquer coisa desta feature. Decisão do operador, 2026-09-23.
- **Nota**: **feature de integração** (CLAUDE.md §10), escrita aqui **antes** do
  código: pode tocar `src/render/` e `src/ui/` na mesma feature, pelo mesmo
  motivo da F17b — o mesmo número aparece no mapa e no painel, e ter duas contas
  para ele é como elas divergem. **`src/sim/` não muda.** Se a implementação
  parecer pedir seletor novo ou campo novo, **pare e reporte**. Esta permissão
  vale para a F17d e só; nenhuma outra feature da fila a herda.
- **Nota (armadilha já medida na F17b)**: `atualizarPredios` pula o redesenho
  quando `(id, estado, estagio, assinatura do medidor)` não muda, e o
  nivelamento **não mexe em `estado` nem em `estagio`**. Sem a leitura do
  nivelamento na chave do diff, o canteiro nasce correto e **congela para
  sempre**, e um screenshot único passa assim mesmo — é por isso que o aceite
  pede o canteiro *enchendo*, medido contra a primeira leitura. A fração do tile
  em curso entra na chave **quantizada em oitavos**: redesenho limitado e chave
  testável, em vez de um float diferente a cada tick.
- **Nota (não-regressão)**: o roteiro da F17b tem de continuar passando,
  conferido pelo **código de saída**, sem abrir a imagem. Por isso o medidor de
  material durante o nivelamento fica **esmaecido, não escondido**, e
  `debug.medidoresDeObra` não muda de forma.
- **Nota (o laborer continua parado, e é de propósito)**: decisão do operador,
  2026-09-23. `render/` desenhar a unidade deslizando sobre o canteiro, fora da
  posição que está em `sim/`, quebraria *"o render lê o estado, não decide"* —
  hoje seria inofensivo porque civil não é selecionável, e é exatamente por isso
  que a divergência apareceria mais tarde sem ninguém lembrar da causa. E é pior
  em fidelidade: no original o laborer **caminha de verdade**; desenhar caminhada
  falsa mente sobre uma regra que não existe, em vez de assumir que ela falta.
  O laborer percorrendo o canteiro está congelado em `IDEIAS.md`.

### F17e — Estágios visuais da obra: cinco, não três
- **Nota (2026-09-26): substituída pela F17g.** O operador trocou os seis estágios
  pela revelação contínua de duas imagens. O que está abaixo é o registro do que foi
  entregue; o modelo vigente é o da F17g.
- **Escopo**: `estagioDaObra` (`render/estagio-obra.ts`) passa de três valores a
  **seis** — cinco em obra mais o completo. **Sem tocar em `sim/`**: as fronteiras
  saem de `hp`, de `hpTotal` e do "já nivelou" da F17d.

  | estágio | fronteira | o que o jogador vê |
  |---|---|---|
  | `marcacao` | `hp === 0` e **não** nivelada | estacas e corda, terreno irregular |
  | `fundacao` | `hp === 0` e nivelada | canteiro plano, alicerce — **pronta para material** |
  | `estrutura` | `0 < hp*3 ≤ hpTotal` | madeira: postes e vigas |
  | `paredes` | `hp*3 ≤ hpTotal*2` | pedra subindo até meia altura |
  | `cobertura` | `hp < hpTotal` | volume cheio, telhado por fechar |
  | `completo` | `hp ≥ hpTotal` | o prédio |

  As fronteiras se escrevem em **aritmética inteira** (`hp * 3 <= hpTotal`),
  nunca `hp / hpTotal <= 1/3`: a `barracks` tem 600 de HP e a fronteira cai
  exatamente em 200, e comparação de float ali é sorteio.
- **Aceite**: tabela dos **dois lados de cada fronteira** em teste headless, mais
  a propriedade de **monotonicidade** — varrendo `hp` de 0 a `hpTotal`, o estágio
  nunca anda para trás. Roteiro que observa os seis num mesmo cenário, afirmando
  por `debug.estagiosDeObraRenderizados` que **todos apareceram**, e salvando um
  PNG por estágio.
- **Evidência**: `test-output/F17e.json` + `screenshots/F17e-*.png`. **Abrir com
  Read só os dois novos do meio** (`paredes`, `cobertura`); os outros valem pelo
  código de saída do roteiro. A regra fica escrita aqui para ser regra, não
  improviso na hora: imagem é o que mais pesa na janela de contexto
  (CLAUDE.md §8).
- **Nota (correção de aceite, 2026-09-23)**: a F11c fixou **três** estágios
  (`marcacao`, `madeira`, `completo`) e o `estagio-obra.ts` ainda diz isso no
  comentário de topo. A decisão de três **foi minha e estava errada**: a pesquisa
  do original descreve estrutura de madeira e depois de pedra, e o relato do
  operador é de cinco ou mais. O PROGRESS (origem F11c) já registrava a saída —
  *"a mesma função pura pode dividir a fase do meio pela fração de `hp`"*. Esta
  feature executa aquela frase; o aceite da F11c não é reaberto.
- **Nota (os limiares são constantes de desenho, não balanceamento)**: decisão do
  operador, 2026-09-23. O `3` e o `2` entram como **constantes nomeadas** em
  `estagio-obra.ts`, com a razão escrita ao lado: um jogador não distingue
  fronteira em 1/3 de fronteira em 0,35 — distingue a casa subindo. A guarda
  estrutural do arquivo (**zero imports**, `tests/F04-grid-ortogonal.test.ts`)
  não deixa ele ler `data/`; se um dia virarem dado, passam pelo funil
  `render/predios.ts`, como o custo e o alvo de nivelamento.
- **Nota (o dado permitiria um degrau por material — e não é o que se faz aqui)**:
  conferido nos 28 prédios de `data/buildings.json`, **`hp === 50 × (timber +
  stone)` em todos**, e `hpPorMaterialEntregue` é 50 — logo fração de HP **é**
  fração de material. Um degrau por material daria 5 na `quarry` e 12 na
  `barracks`: de graça com placeholder geométrico, **doze desenhos** com arte de
  verdade. Fica registrado porque o dado sustenta a ideia sem campo novo, se um
  dia for o caminho.
- **Nota (placeholder e arte)**: contorno vazado, retângulo baixo, três patamares
  de altura e cor por camada distinguem os seis **sem uma linha de arte**
  (CLAUDE.md §9 — placeholder é comportamento normal). O que só faz sentido com
  arte de verdade: a leitura de madeira contra pedra, o andaime, a silhueta do
  telhado e a textura do terreno aplainado da F17d. A função pura não muda quando
  a arte chegar; troca o desenho, não a fronteira.
- **Nota (o que esta feature herda da F17d)**: só a fronteira
  `marcacao`/`fundacao` precisa saber se a obra já nivelou. Se a ordem inverter,
  `estagioDaObra` mantém a assinatura de dois argumentos e `fundacao` espera —
  os outros cinco valores não dependem da F17d.
- **Nota (o que esta feature herda da F17f — estágio sem arquivo cai no retângulo
  DELE)**: a F17f fixou o contrato do manifesto com **três** estágios; esta feature
  transforma três em **seis**, e o armazém terá arte para três deles e nenhuma para
  os outros. O resolvedor já responde a isso e **não precisa mudar**:
  `arquivoDoEstagio` devolve `null` para estágio ausente em `estados`, e
  `spriteDoPredio` (`render/scenes/WorldScene.ts`) cai no placeholder **daquele
  estágio**. O que não pode acontecer, e o que uma implementação apressada faria,
  é herdar o sprite do estágio vizinho: um prédio em `paredes` desenhado com o PNG
  de `estrutura` mente sobre o progresso, que é justamente o que esta feature
  existe para mostrar. Meio sprite e meio retângulo no mesmo prédio é **feio e
  correto**; sprite errado é só errado.


---

## Fase B — Comida e crescimento

### F18a — Zoom da câmera (render + input)
- **Escopo**: `gridToScreen`/`screenToGrid` (F04) passam a receber um nível de
  escala; câmera com zoom pela roda do mouse (GDD §2.1), em passos discretos
  lidos de `data/`, ancorado no cursor (o tile sob o ponteiro não se move).
  Limites de câmera recalculados por nível. **Nada em `src/sim/`** — zoom é
  câmera, não regra; a simulação não sabe que ele existe.
- **Aceite**: o teste de ida e volta da F04 varrendo os níveis — 1000
  coordenadas (RNG semeado) × cada nível, `screenToGrid(gridToScreen(p, z), z)
  === p`. Mais screenshot no zoom mínimo e no máximo com o mesmo ponto de mouse
  destacando o mesmo tile.
- **Evidência**: `test-output/F18a.json` + `screenshots/F18a-*.png`
- **Nota**: encerra a nota da F05b. Os níveis de zoom são dado de render em
  `data/` e `npm run validate:data` precisa aceitá-los; não são balanceamento
  de simulação.
- **Nota (medido em 2026-09-23)**: culling e custo de quadro são planos com o
  tamanho do mapa — 234 tiles desenhados e ~16,6 ms/quadro a 64², 128² e 256².
  O zoom é necessidade de **navegação**, não de desempenho. **O item que
  aumentar `mapaPadrao` depende deste** e da F17c: a 256², com tile de 64 px e
  viewport de 1280×720, o jogador enxerga 20×11 tiles — 0,35% do mapa.

### F18b — O mapa padrão passa a 128×128
- **Escopo**: `data/terrain.json` publica `mapaPadrao` 128×128 (quatro vezes a
  área da Fase A) e um guarda de que a simulação roda em **qualquer** tamanho
  declarado. **Nada em `src/`** — o tamanho já era dado, lido por `configDoMapa`
  no render e por `terreno.mapaPadrao` na busca de caminho. Depende da F17c
  (buffer do A*) e da F18a (zoom), as duas fechadas.
- **Aceite**: `tests/F18b-mapa.test.ts` roda estado inicial + 30 ticks e as
  bordas de busca em 64×64, 128×128, 256×256 e **97×61** (retangular, nenhum
  lado potência de dois), e prova que o estado serializado não cresce com a
  área. Mais roteiro que leva a câmera até o canto (127,127) — tile que no 64²
  não existe — e afirma que o jogo o destaca sob o ponteiro.
- **Evidência**: `test-output/F18b.json` + `screenshots/F18b-*.png`
- **Nota (a medida, refeita em 2026-09-23 depois da F17c)**: nada escala com a
  área. Busca curta 2,7 / 3,5 / 2,6 µs; cardápio de um serf ocioso 0,17 / 0,17 /
  0,22 ms; tick 0,80 / 0,65 / 0,79 ms; estado serializado 2,5 KB **idêntico**
  nos três (64² / 128² / 256²). A linha de base da Nota da F17c, antes da
  correção, era 40 / 94 / 303 µs na busca e 1,58 → 6,03 ms no cardápio: dez
  serfs ociosos custavam 60 ms de um tick de 100 ms, e hoje custam 2,2 ms. O
  único número que cresce é o rascunho do A* (64 / 256 / 1024 KB), que é
  capacidade máxima já vista, não alocação por busca.
- **Nota (por que 128 e não 256)**: custo **não** foi o critério — ver acima.
  Uma cidade completa cabe em 40×40 tiles e a campanha prevê duas com espaço
  entre elas (~110 tiles de lado); 256² deixaria ~170 tiles de grama que nada
  preenche antes da F28. Navegação: no zoom mínimo o quadro mostra 850 tiles,
  5,2% de um 128² contra 1,3% de um 256². E 128 = 2×64 faz a centralização
  futura ser uma translação uniforme de +32.
- **Nota (a vila não se moveu)**: `storehouse` (29,30), `schoolhouse` (34,30) e
  spawn (30,34) ficam onde estavam; o mapa cresce para sul e leste. A vila passa
  a ocupar o quadrante noroeste, com 29 tiles de folga a oeste e 30 ao norte
  (mais que a vila inteira da F17, que ocupou dez), e sobra ~98×97 a sudeste
  para a segunda cidade da campanha. Centralizar hoje custaria os ~20 arquivos
  de fixture e 15 roteiros da **F18c** — o defeito real tem nome e está na fila.
- **Nota (desvio consciente da Nota da F17c)**: aquela nota manda parar e
  reportar se `tests/F10-astar.test.ts` precisar mudar. Ele mudou: a fixture
  **declara** o mapa de 64² em que prova, em vez de herdar o publicado. O
  oráculo — regras, asserções, casos — está intocado; o que mudou é o tamanho do
  mapa que a fixture sorteia, que ela já assumia pela faixa [4,55]. Provado
  neutro com o dado ainda em 64² (33 testes, 2,96 s contra 3,02 s) **antes** de
  o dado mudar.

### F18c — Fixtures param de depender da posição absoluta da vila (quebrada em F18c-1 e F18c-2)
- **Escopo**: `tests/helpers/*` e os roteiros de `tools/shots/` deixam de
  escrever a coordenada da vila à mão e passam a derivá-la do armazém do
  cenário. A prova de que funcionou é mover a vila para o **centro** do mapa
  (`data/economy.json`: +32 em cada eixo — storehouse (61,62), schoolhouse
  (66,62), spawn (62,66)) sem que nenhuma asserção mude.
- **Aceite**: regra nova em `tools/data-rules.js` — o centro da caixa que
  envolve os prédios iniciais fica a no máximo 2 tiles do centro de
  `mapaPadrao` — reprovando antes e passando depois; `npm run verify` verde e os
  roteiros de screenshot verdes por código de saída.
- **Nota (o tamanho, contado na F18b, não estimado)**: ~20 arquivos de fixture e
  15 roteiros carregam posição absoluta (~64 literais vizinhos da vila entre 508
  literais de tile), e há ~100 chamadas diretas de `createInitialState(1)`. Não
  é um `sed`: cada literal tem de ser lido. Se não couber numa sessão, quebre
  por arquivo.
- **Nota (medida em 2026-09-26, noite 8 — o item parou antes de começar)**: com a
  vila movida +32 só no `economy.json`, **48 de 108 arquivos de teste reprovam (147
  testes)**, mais do que o teto de 20 arquivos e 15 roteiros que o operador deu. Os
  roteiros não foram rodados. A contagem cresceu porque, desde este item, o mapa
  passou a ter **geografia autoral presa à vila**. `tools/gerar-mapa.js` escreve à mão
  o `LAJEDO_DA_VILA` (24,31), o açude do norte, o mato do nascente e o roçado da
  abertura, e protege o quadrante noroeste "até o tile 71" porque os testes usam
  coordenada literal. Mover a vila é, portanto, também mover a geografia e gerar o
  mapa de novo, o que muda os números que a F-CAL-b calibrou nesse mapa. Isso é
  decisão do operador, não uma migração mecânica. Lista e hipótese de divisão no
  `PROGRESS.md` (noite 8).

- **Decisão do operador (2026-09-26)**: quebrar em duas. **F18c-1 agora**: os
  literais dos testes passam a ser derivados, e a vila não se move. **F18c-2 depois
  da Fase C**: mover a vila de verdade, o que exige gerar o mapa de novo e refazer a
  calibração. O porquê: derivar os literais é o que protege contra a próxima mudança
  de abertura, e isso já mordeu na F-T4b. Recentrar não vale antes de o combate
  existir. O aceite original, a regra do centro da caixa em `tools/data-rules.js`,
  passa para a F18c-2.
- **Nota (a divisão medida em 2026-09-26, não estimada)**: o oráculo de "não há
  literal absoluto" é **transladar o mundo inteiro** sem dar a volta. O mapa vai para
  160×160, com uma faixa de grama de 32 tiles a oeste e ao norte, e vila, recursos e
  `mapaPadrao` andam +32 juntos. Assim, toda distância relativa fica igual, e só cai
  quem escreveu coordenada absoluta. Com isso:
  - **46 arquivos reprovam com o mundo transladado.** Eles têm literal absoluto e são
    o escopo da F18c-1. São os 39 que também caem com só a vila movida, mais 7 que só
    caem aqui (F18-ciclo-do-roceiro, F19, F19b, F21, F21b, F23 e F04). Esses 7
    escrevem a posição de uma feição do mapa: a fazenda do nascente, a mina da serra.
  - **9 dos 48 arquivos originais passam com o mundo transladado.** Eles só dependem
    da geografia em volta da vila e são da F18c-2: BUG-G-preso-no-footprint, F06-build,
    F17-aceite, F-CAL-a, F-CAL-b, F-T4b-geometria, F-T4b-lenhador,
    F-T4d-pescador-em-partida e F-VIVO-a-pilhas.
  - Dos 46, 4 afirmam o próprio arquivo do mapa (F04 com 128×128, F-D3-geografia com
    o texto gerado, F-T1-terreno e F18b-mapa com tiles do mapa). Para esses, trocar
    de mapa é mudar o contrato. Cada um se confere na F18c-1c, sem migração às cegas.
  - Uma coordenada tem duas âncoras possíveis. Ou é **relativa à vila** e se deriva do
    armazém (a câmera da F05b, o prédio vizinho da F09). Ou é **relativa a uma
    feição** e se deriva do mapa (a pedreira `q1` perto da rocha, a fazenda `f1` na
    terra de plantio, o pescador na água). Derivar a segunda do armazém passaria na
    translação e cairia na F18c-2.

### F18c-1a — Os dois helpers de cenário derivam a posição
- **Escopo**: `tests/helpers/producao-cenario.ts` e `tests/helpers/fome-cenario.ts`
  deixam de escrever `(26,34)`, `(32,34)`, `(112,30)`, as ruas até `(108,34)` e o
  pescador em `(32,27)`/`(45,26)`/`(91,37)`. Passam a procurar a posição. A
  pedreira fica perto da rocha mais próxima do armazém, a fazenda e o vinhedo na
  terra de plantio, o pescador na margem. Tudo com o `canPlace` e o alcance que a
  sim já expõe. Só `tests/` e o instrumento de medida em `tools/`; nada em `src/`.
- **Aceite**: com o mundo transladado +32 (instrumento
  `tools/transladar-mundo.js`, que escreve e reverte), nenhum arquivo reprova com
  `fixture: '<id>' nao ficou ligado`. Com o mundo no lugar, `npm run verify` fica
  verde e **nenhuma asserção muda de valor**: a posição derivada no mapa de hoje é a
  mesma de antes, ou a diferença vai escrita no `PROGRESS.md` com o motivo.
- **Evidência**: `test-output/F18c-1a.json` com a lista de arquivos que reprovam
  transladados, antes e depois.

### F18c-1b — Literais diretos nos testes
- **Escopo**: os arquivos dos 46 que não caem pelos helpers: F05b, F09-jobboard,
  F09-sistema, F10-desempate, F10-falhas, F10-fsm, F11c, F13a-aceite, F13a-ouro,
  F13b, F14, F15a-aceite, F16a-porta, F18d-1a, F18d-1b, e os 7 que só caem
  transladados. A lista exata é a que sobrar depois da F18c-1a. Cada literal se lê e
  ganha uma âncora: a vila ou a feição.
- **Aceite**: com o mundo transladado, só os arquivos de mapa da F18c-1c
  reprovam. `npm run verify` fica verde com o mundo no lugar.

### F18c-1c — Os arquivos de mapa e o guarda permanente
- **Escopo**: decidir, um a um, o que F04, F-D3, F-T1 e F18b afirmam do arquivo do
  mapa, e se isso é contrato ou literal. Depois, transformar a translação em regra
  que roda sempre. Uma saída, **não decidida**: um `vitest` com `alias` que troca os
  três JSON por cópias transladadas geradas na hora, sem escrever em `data/`.
- **Aceite**: a translação roda automaticamente e reprova ao se reintroduzir um
  literal (prova com o literal plantado), e fica verde sem ele.

### F18e — Estrada diagonal
- **Escopo**: a estrada passa a ligar em 8 direções, **sem cortar quina** — a
  mesma regra que o A* já usa em modo `'livre'`. Três partes: (a) o arrasto
  de `input/` interpola em diagonal em vez de subir a escadinha ortogonal;
  (b) `isConnected`/`indiceDeEstradas` passam a 8 vizinhos com a proibição de
  quina; (c) `render/` desenha o tile inclinado. O custo por tile em
  `terrain.json` não muda.
- **Aceite**: dois tiles só em diagonal passam a estar conectados, e **não
  passam** quando os dois ortogonais entre eles estão ocupados (a quina não
  corta). O teste de equivalência de `tests/F10-astar.test.ts` (*"por estrada,
  o A* acha caminho se e somente se `isConnected` acha"*) continua verde sem
  ser afrouxado — ele é o que prende as duas metades. `tests/F08-estradas.test.ts:254`
  (*"diagonal NÃO liga"*) é reescrito para afirmar a regra nova, não apagado.
  Screenshot de uma estrada em diagonal desenhada por arrasto.
- **Evidência**: `test-output/F18e.json` + `screenshots/F18e-*.png`
- **Nota (a ordem da fila é a do arquivo, não a do id)**: este item vem **antes**
  da F18d de propósito — precedente: `F17f` já está fisicamente antes de `F17d` e
  `F17e`. O id da F18d foi fixado pelo operador antes deste item existir e não
  se renomeia.
- **Nota (por que promovida do `IDEIAS.md`, com a medida)**: medido na sessão de
  2026-09-23, a partir de `terrain.json` × `time.json` × `units.json`: passo de
  estrada 5 ticks, grama reta 7, grama **diagonal 9**; e no modo `'estrada'` a
  diagonal não existe (`F10-astar.test.ts:315`), então a rua é 4-conectada na
  prática. Para um trajeto `dx × dy` (`dx ≥ dy`), estrada custa `5dx + 5dy` e a
  perna livre custa `7dx + 2dy`: a rua **perde** acima de `dy/dx = 2/3`, ou seja
  ~34°. Com a F18d (entrega de construção em modo livre) isso tornaria a estrada
  opcional em metade dos traçados. A alternativa era subir `custoDeMovimento.grama`
  de 1,30 para ≥1,45, que desacelera serf, laborer e especialista em 15% para
  consertar geometria — lote de balanceamento, não ajuste, e por isso recusada
  (registrada em `BALANCE_LOG.md`).
- **Nota (medir de novo depois)**: o ponto de virada acima é **aritmética sobre o
  dado**, não `npm run sim`. Refazer a conta com a diagonal ligada faz parte da
  evidência: com quina proibida, o trajeto diagonal passa a custar `7` por passo
  (`round(√2 × 1,00 ÷ 2 × 10)`) contra `9` da grama, e a rua deve ganhar em
  **todo** ângulo. Se não ganhar, o número é que está errado, e aí sim é balanceamento.
- **Nota (segundo dado morto — decisão do operador, 2026-09-23: apaga nesta feature)**:
  `terrain.json` tinha `estrada.bonusVelocidade: 1.30` com **zero leitores** em
  `src/`, `tools/`, `tests/` — nem sequer um comentário, ao contrário do
  `obrigatoriaParaEntrega`. O bônus real emerge de `custoDeMovimento.estrada`
  (1,00) contra `.grama` (1,30), e dá 1,4 efetivo pelo arredondamento de 10 Hz
  (`BALANCE_LOG`). O operador decidiu apagá-lo aqui, pelo mesmo motivo do
  primeiro: número que parece configurável e não configura nada faz alguém mexer
  nele esperando efeito. Pedido junto: uma regra de `validate:data` para "campo
  de dado sem leitor é erro", **se couber sem inchar**; se não couber, a
  observação vai para o `PROGRESS.md` com a varredura medida.
- **Nota (esta é uma feature de integração)**: é a exceção explícita que a §10 do
  CLAUDE.md exige para tocar `src/sim/` e `src/render/` na mesma feature, e ela
  vale **só aqui** — não se herda para a F18d-1 nem para nenhuma outra. O motivo
  é que as três partes são a mesma regra: o arrasto que interpola é `input/`, a
  ligação em 8 vizinhos é `sim/`, e o tile inclinado é `render/`. Desenhar a
  diagonal sem ligá-la (ou ligá-la sem desenhá-la) seria uma tela que mente
  sobre o estado, e nenhuma das metades tem aceite verificável sozinha: o
  screenshot do item afirma uma rua que o grafo precisa estar ligando.
- **Nota (o que NÃO entra)**: o custo de movimento diagonal já existe e está
  exercitado (`ticksPorTileDiagonal`); esta feature não o cria. E não mexe em
  `colisao`/`intransponivel`: quina proibida é regra de **ligação**, não de
  passagem.

### F18d-1a — Modo de entrega por nível: construir anda livre (sim)
- **Nota (a F18d-1 virou duas, medido em 2026-09-24)**: o item original trazia
  duas regras num item só — o `modo` por nível e a estrada-canteiro. A segunda
  cria uma tarefa cujo **destino é um tile**, e hoje `destino` é id de prédio em
  **59 ocorrências** de `src/sim/` — 12 delas `predios.porId[<tarefa>.destino]`
  direto — espalhadas por **8 arquivos** (`jobs.ts`, `obra.ts`, `reservas.ts`,
  `selectors.ts` e `systems/{jobs,serfs,laborers,especialistas}.ts`). As duas
  juntas não cabem numa sessão, e CLAUDE.md §6 manda quebrar em sub-itens e
  entregar o primeiro. **O aceite não foi reescrito**: cada metade ficou com a
  metade dele que já estava escrita, palavra por palavra.
- **Escopo**: o item (b) do original. `delivery.json` publica
  `"modo": "livre" | "estrada"` por nível: nível 3 em **livre**; níveis 1, 2, 4,
  5, 6 e 7 em **estrada**. Quem lê o campo é um helper irmão de `nivelDoTipo`
  (`modoDoTipo`, `sim/jobs.ts`), e ele é passado por **tipo de tarefa** aos call
  sites; nenhum sistema digita `'estrada'` ou `'livre'` para tarefa de
  transporte. `obrigatoriaParaEntrega` já saiu de `terrain.json` (ver Nota).
- **Aceite**: a primeira casa sobe **sem nenhuma estrada no mapa** — planta a
  obra, o serf entrega o material andando livre, o prédio fica `completo`; e no
  mesmo cenário a pedreira pronta **não** escoa: a saída enche e o pedreiro vai
  a `saida_cheia`, até a rua existir. `tests/F09-sistema.test.ts:214` reescrito
  para afirmar a regra nova (origem do nível 3 por distância **a pé**), com o
  número medido ao lado.
- **Evidência**: `test-output/F18d-1a.json`
- **Nota**: sem screenshot — feature só de `sim/` e `data/`.
- **Nota (decisão do operador, 2026-09-23 — a regra tem dois lados)**: entregar
  material **numa construção** (obra, tile de estrada planejado, comida para
  tropa em campo) anda livre, por qualquer tile — é assim que a primeira casa
  sobe sem rua. **Coletar de produção** (saída da Quarry, insumo do Sawmill,
  excedente para o armazém) **exige** estrada: sem rua o material fica parado na
  gaveta. O critério que separa os dois é o **destino**: porta de prédio pronto →
  estrada; canteiro, tile planejado ou unidade em campo → livre. Fonte: o jogo
  original; contradiz o que está implementado desde a F10.
- **Nota (nível 2 é coleta; o Feed da tropa não é o nível 1)**: `ouro-para-escola`
  fica em **estrada** — a escola está pronta, tem porta, e o ouro é insumo dela;
  treinar não é construir. Consequência verificada: o motivo `sem-estrada` da
  F13b e o alerta `sem-estrada` da F22 **mantêm produtor**. O nível 1 de
  `delivery.json` é literalmente `"comida -> inn"`, prédio com porta, logo
  estrada; alimentar tropa em campo aberto (GDD §2.4) é **tipo novo**, irmão de
  `'assentar-estrada'`, e nasce na F20/F28 — não é o nível 1.
- **Nota (`obrigatoriaParaEntrega` é dado morto, medido na sessão de 2026-09-23)**:
  o campo aparece três vezes no repositório — `data/terrain.json` e **dois
  comentários** (`sim/pathfinding.ts:17`, `sim/systems/serfs.ts:21`). **Nenhum
  leitor.** A regra está codificada no literal `'estrada'` passado em quatro
  call sites. Trocá-lo para `false` não mudaria nada e nenhum teste acusaria.
  Ele foi citado repetidamente como a fonte da regra — inclusive pelo operador —
  e nunca foi lido por linha nenhuma de código. Saiu do `terrain.json` na sessão
  em que isso foi medido, antes desta feature; o substituto com leitor de verdade
  é o `modo` por nível em `delivery.json`.
- **Nota (a regra mora em dez lugares, não em um)**: `jobs.ts:270`
  (`portasDeEstrada`), `jobs.ts:~277` (`portasDeColeta`, filtra ao componente da
  entrega), `jobs.ts:303` (`planoDaTarefa`), `jobs.ts:346` (`custoDaTarefa`),
  `systems/serfs.ts:142` e `:181` (rota carregada e replanejamento),
  `systems/jobs.ts` (`origemMaisPerto`/`destinoMaisPerto`, que **não criam
  tarefa** sem ligação), `systems/jobs.ts` (`sanearTarefas`, que cancela quando a
  rota some), `systems/especialistas.ts:184` (`saida_cheia`), `selectors.ts:271`
  e `:563`. Quem implementar passa o modo por **tipo de tarefa** nesses pontos;
  não há uma checagem única para virar.
- **Nota (correção medida da Nota acima, 2026-09-24)**: dos dez lugares, **três
  não mudam**: `systems/especialistas.ts:184` (`saida_cheia`), `selectors.ts:271`
  (`motivoDaEspera` da escola) e `selectors.ts:563` (causa `sem-estrada` da F22)
  perguntam todos ao mesmo `predioLigadoAoArmazem`, e ele serve os níveis 2, 6 e
  7 — os três em **estrada**. Verificado abrindo os três. `systems/jobs.ts`
  também se parte: `origemMaisPerto` é do nível 3 e passa a medir **a pé**;
  `destinoMaisPerto` é dos níveis 6/7 e continua por estrada.
- **Nota (o que quebra, contado por tipo de tarefa e não por título)**: 14
  asserções em 5 arquivos, todos exercitando **só** `'material-para-obra'` —
  `F09-sistema` (5: `:76`, `:173`, `:207`, `:214`, `:232`), `F10-desempate`
  (3: `:72`, `:82`, `:95`), `F10-falhas` (4: `:160`, `:170`, `:191`, `:205`),
  `F09-jobboard` (1: `:270`), `F10-ciclo` (1: `:142`). Ficam **intactos**
  `F15b-entrega` (52 its, níveis 4–7), `F22-alertas` (17), `F13a-ouro` (12),
  `F13b-painel` (14), `F08-estradas` (41), `F09-estrada-reserva` (7) e
  `F10-astar` (26).
- **Nota (a mudança de comportamento com mais risco — decisão do operador,
  2026-09-23)**: hoje a origem do material sai de `origemMaisPerto`, que mede
  **por estrada**. Com o nível 3 livre, a origem passa a ser a de menor caminho
  **a pé**, e o desempate `menorDistanciaDeCaminhoReal` de `delivery.json` passa
  a significar coisas diferentes por nível. Vai nesta feature, não depois;
  `F09-sistema.test.ts:214` é o teste que codifica o comportamento antigo e é
  reescrito para o novo, com o número medido ao lado, como nas outras Notas
  desta F18d.

### F18d-1b — Estrada como canteiro (sim)
- **Nota (o que a F18e deixou pronto, 2026-09-24)**: a rede de estradas agora
  depende dos **prédios** (a quina que eles tapam corta a ligação diagonal), e por
  isso `indiceDeEstradas`, `componenteDe`, `isConnected` e `distanciaPorEstrada`
  recebem `EstadoDaRede` (`Pick<GameState, 'estradas' | 'predios'>`), não mais só
  `estradas`. O `estradasPlanejadas` desta feature **não** entra nesse índice: tile
  planejado não liga nada até o laborer assentar, que é o próprio aceite. Se ele
  precisar de índice próprio, é índice separado, com a mesma regra de quina — o
  único lugar onde ela mora é o `passoPermitido` de `sim/estradas.ts`.
- **Escopo**: o item (a) do original. Campo novo `estradasPlanejadas` no
  `GameState`, separado de `estradas`; `PlaceRoad` **reserva** a pedra e planta o
  tile planejado; variante de tarefa `'assentar-estrada'` (destino é tile, não
  prédio); o laborer assenta e é o **assentamento** que debita a pedra;
  `DemolishRoad` parte a entrada em três conjuntos — de pé (devolve
  `floor(n × devolucaoAoDemolir)`, como hoje), planejado (devolve 0, libera a
  reserva e a tarefa), nem um nem outro (no-op).
- **Aceite**: a rua desenhada não liga nada no tick do comando e liga depois que
  o laborer assenta; a pedra sai do armazém exatamente uma vez, no assentamento.
- **Evidência**: `test-output/F18d-1b.json`
- **Nota**: sem screenshot — feature só de `sim/` e `data/`.
- **Nota (o que a F18d-1a deixou pronto)**: `'assentar-estrada'` nasce em
  **livre** pelo mecanismo que já existe — entra na escada de `delivery.json`
  com `"modo": "livre"` e o `modoDoTipo` responde por ela. Se esta feature
  precisar digitar `'livre'` em algum sistema, a F18d-1a ficou incompleta.
- **Nota (o preço do destino de tile, medido em 2026-09-24)**: `destino` é id de
  prédio em 59 ocorrências de `src/sim/`, 12 delas `predios.porId[…destino]`
  direto (ver a Nota da quebra, na F18d-1a). É aqui que esse custo é pago: o
  `motivoDoDestino`, o `vagaDoDestino` e as reservas passam a ter um ramo que
  não olha `predios.porId`.

### F18d-2 — Estrada planejada na tela (integração)
- **Escopo**: `render/` desenha o tile planejado distinto do tile de pé, e os
  roteiros de `tools/shots/` migram para a ordem nova (o arrasto planeja; a
  contagem de estrada de pé sobe com o tempo).
- **Aceite**: o roteiro afirma, no mesmo cenário, **planejados** subindo no
  arrasto e **de pé** subindo depois — a asserção fica mais estrita que a de
  hoje, não só diferente, e a soma fecha. Screenshot com os dois estados na
  mesma tela.
- **Evidência**: `test-output/F18d-2-shot.json` + `screenshots/F18d-2-*.png`
- **Nota (esta é uma feature de integração)**: é a exceção explícita que a §10 do
  CLAUDE.md exige para tocar `src/sim/` e `src/render/` na mesma feature — e ela
  só vale aqui, não se herda da F11c nem da F18d-1. `sim/` só recebe o que a
  F18d-1b deixou; se algo de regra aparecer nesta feature, é sinal de que a
  F18d-1b ficou incompleta.
- **Nota (o tamanho, medido na sessão de 2026-09-23)**: **10 roteiros** afirmam
  `estradasRenderizadas` em **25 asserções** — `F08` (6), `F22` (4), `F17` (3),
  `F13b`/`F16b`/`F17b`/`F17d`/`F17e` (2 cada), `F10` (1), `F11a` (1). Os 10
  arquivos que semeiam `estradas:` direto no estado (8 testes + `jobs-cenario.ts`
  e `producao-cenario.ts`) **não** mudam: eles não passam pelo comando.
- **Nota (o que a F18e deixou pronto, 2026-09-24)**: três heranças. (1)
  `camadaDeEstradas.atualizar` recebe o `GameState` inteiro (ou `null`), não mais
  `estradas`, e redesenha quando **`estradas` ou `predios.ordem`** trocam de
  referência — a camada de planejadas segue a mesma forma. (2) Quem diz onde há
  ligação diagonal é `pontesDiagonais(state)`, de `sim/estradas.ts`: o desenho do
  tile planejado **não** reimplementa a regra da quina, pergunta. (3) `tilesEntre`
  é 8-conectado desde a F18e, então um arrasto em 45° de `n` passos vira `n + 1`
  tiles, não `2n + 1`; os roteiros que contam tiles de arrasto diagonal já estão
  na conta nova (ver `tools/shots/F18e.js`).
- **Nota (a janela entre as duas)**: entre a F18d-1b e esta, a estrada planejada
  existe no estado e **não aparece na tela**. É feio e está registrado de
  propósito: o alternativo era empurrar `render/` para dentro do slice de `sim/`
  sem a nota de integração.

### F18f — Unidade empilhada não some (render)
- **Escopo**: `render/unidades.ts` desloca o desenho de cada unidade dentro do
  tile, por um deslocamento derivado do **id**, e soma o mesmo `dy` ao `depth`
  para que a de baixo fique na frente (leitura 3/4). **Render puro**: nada em
  `sim/`, nada em `data/`, nenhuma mudança na regra de colisão — civis continuam
  podendo ocupar o mesmo tile, como decidido na F03.
- **Aceite**: num cenário com pilha medida, o roteiro afirma que as **N**
  unidades do mesmo tile têm **N centros desenhados distintos**, e a menor
  distância entre pares é ≥ o raio do anel. Screenshot com a pilha.
- **Evidência**: `test-output/F18f-shot.json` + `screenshots/F18f-*.png`
- **Nota (a medição que originou o item, 2026-09-24)**: sonda em cenário com rua
  e pedreira, 700 ticks, 140 quadros amostrados. **As 6 unidades do cenário na
  MESMA posição desenhada exata** — `(38,33)`, o tile de porta da obra da
  pedreira —, no tick 232; **116 dos 140 quadros** com alguma pilha exata.
  Empilhar é o caso **normal**, não a exceção. A foto do fim mostrava **3
  quadrados para 6 unidades**. O render já cria um container **por id**
  (`render/unidades.ts`, um por unidade viva): as N existem na display list; o
  que as esconde é `gridToScreenCentro` ser função pura do tile (mesmo tile =
  mesmo pixel) com `depthDeY(worldY)` igual (mesmo y = mesmo depth), e o
  quadrado ser opaco. Oclusão total, não parcial.
- **Nota (o limite, medido)**: o quadrado da unidade tem lado `0.5` tile (32 px a
  64 px/tile). Para ele **não sair do tile**, o centro anda no máximo **±0.25
  tile = ±16 px**. Seis unidades num anel desse raio ficam a ~16 px umas das
  outras: quadrados de 32 px **continuam se sobrepondo pela metade**. Decisão do
  operador: **sobreposição parcial é aceita** — ver que são várias já é melhor
  que ver uma. As duas saídas para separação real ficam **registradas e não
  valem agora**: (a) encolher o desenho da unidade; (b) deixar o deslocamento
  vazar do tile. Revisitar só se o playtest **com sprite** pedir.
- **Nota (derivar do id, e o que isso custa)**: o deslocamento vem do **sufixo
  numérico do id** (`u7` -> 7) módulo o número de posições do anel. A alternativa
  — agrupar por tile no quadro e espalhar pelo índice no grupo — garantiria N
  distintos sempre, mas faz a unidade **saltar** quando outra entra ou sai do
  tile dela; derivar do id não salta nunca. O preço é a colisão: duas unidades
  cujos ids são congruentes módulo o anel, no mesmo tile, continuam exatamente
  em cima uma da outra. O anel tem **6 posições**: é a pilha máxima medida, e é o
  único anel em que a **corda entre vizinhos iguala o raio** — com 8 posições os
  vizinhos ficariam a 0,77 do raio um do outro, e o "≥ o raio do anel" do aceite
  afirmaria uma separação que o desenho não entrega. Com ids sequenciais
  (`u3`..`u8`) os 6 slots são distintos e nenhuma pilha do cenário atual colide.
  Fica registrado como limite conhecido, não resolvido.
- **Nota**: sem `Math.random()` e sem `Date.now()` — a foto tem de repetir.

### F-T1 — Camada de terreno base (dado + sim + render mínimo, integração)
- **Escopo**: o mapa deixa de ser liso. (a) arquivo de mapa versionado em
  `data/maps/<id>.json`, com schema em `npm run validate:data`; (b) carregamento
  **fora do `GameState`**, congelado por `src/sim/freeze.ts` como o resto de
  `GameData`; (c) `tipoDoTile(gx, gy)` como **única** porta de leitura; (d) o
  motivo `'terreno'` de `canPlace` (`src/sim/placement.ts`, declarado e
  inalcançável desde a F06) passa a ser alcançável; (e) o A* passa a somar os
  **quatro** custos de terreno que o loader já monta — hoje conhece dois — e a
  recusar o intransponível. **Nenhum recurso natural** — é a F-T2. Mais o
  **desenho mínimo** do item seguinte.
- **Escopo de render — desenho MÍNIMO (decisão do operador, 2026-09-24)**: uma
  **cor por tipo de terreno** no tilemap que já existe, e nada mais. Sem textura,
  sem transição entre terrenos, sem arte. É o suficiente para a tela **não
  mentir**: o jogador vê onde há água antes de a construção ser recusada.
- **Aceite**, quatro pernas, e nenhuma passa por acidente:
  1. **A recusa nomeia o terreno.** `canPlace` sobre água devolve
     `motivo === 'terreno'`, e o teste afirma o **motivo**, não só a recusa — o
     vocabulário de `MotivoDeRecusa` existe justamente para separar isto de
     "ocupado" e de "porta sem saída".
  2. **O caminho desvia, e desiste.** Com um lago no meio, o A* devolve caminho
     **sem nenhum tile de água** e mais caro que a mesma viagem no mapa liso;
     com o lago fechando a passagem, devolve `null`. As duas metades, não uma.
  3. **O custo foi remedido, não estimado.** Mesma harness da F17c
     (`buscaCurtaInedita`), mapa liso contra mapa com terreno, número gravado em
     `test-output/F-T1.json`, e o teto do teste escrito **com o número medido** —
     é a regra dos testes de tempo do `BUGS.md`, e a razão da F17c oscila entre
     0,4 e 3,1 nesta máquina.
  4. **Nada do que está de pé quebra.** A suíte de hoje (66 arquivos, 1045
     testes) continua verde **sem mudar fixture**: o mapa padrão nasce com a
     região da vila inicial (`economy.json`, storehouse em 29,30 — medido na
     F18b) inteira em terreno construível.
- **Evidência**: `test-output/F-T1.json` + `screenshots/F-T1-*.png`
- **Nota (por que o terreno fica fora do estado, com o número)**: medido em
  2026-09-24 sobre 128² = 16 384 tiles, com `JSON.stringify`: `Record` denso de 1
  campo por tile = **0,35 MB**; de 2 campos = 0,55 MB; de 3 = 0,85 MB. O estado
  inteiro de hoje é **29 KB e constante** em 64², 128² e 256² (tabela da F18b) —
  pôr o terreno dentro multiplicaria o save por doze para guardar **dado
  imutável**. O que não está no estado não pode divergir: o determinismo fica
  mais forte, não mais fraco.
- **Nota (formato do arquivo — decisão minha, §7.4 da proposta, registrada para
  veto barato)**: camada base como **linhas de caracteres** (`"ggggwwwgg…"`),
  128 linhas de 128 chars ≈ 16 KB de texto que um humano lê no diff do git; os
  recursos (F-T2) como **lista esparsa** `[{ tipo, gx, gy, quantidade }]`, nunca
  16 384 objetos. Escolhi pelo diff: o git é quem vai revisar mapa, e matriz de
  objeto não se revisa.
- **Nota (quem escreve o primeiro mapa — decisão minha, §7.5)**: gerador em
  `tools/` que **emite o arquivo** a partir de uma semente escrita no cabeçalho
  do próprio arquivo; o arquivo é o que entra no git e o que o jogo carrega. O
  jogo **nunca** roda o gerador. Isso respeita o Anexo B do GDD (*"mapas feitos à
  mão"*, sem geração procedural no MVP) e a entrada congelada do `IDEIAS.md`:
  gerar é ferramenta de autoria, não runtime. Se o mapa emitido não servir,
  edita-se o arquivo à mão e a semente vira registro histórico.
- **Nota (save/load)**: o save guarda `mapa: "<id>"` **mais o hash do arquivo**.
  Carregar um save com mapa diferente falha **na hora**, em vez de divergir 300
  ticks depois — que é o modo de falha caro.
- **Nota (dado que hoje não tem leitor, e ganha um aqui)**: `intransponivel`
  (`["agua","rocha","montanha","predio"]`) chega em `GameData`
  (`src/sim/data/loader.ts:276`) e **nenhum sistema o consulta** — grep em `src/`
  devolve só o loader e o `types.ts`. `campoArado 1.45` e `areia 1.50` estão na
  matriz de custo e o A* nunca os alcança (`src/sim/pathfinding.ts:8-9` diz o
  porquê). Esta feature é quem dá leitor aos três. O que sobrar sem leitor ao
  fim dela **sai do dado**, em vez de virar folclore.
- **Nota (balanceamento, em bloco)**: com terreno variado os **tempos de viagem
  mudam**, e isso mexe em número já calibrado (oráculo da F15b). As observações
  vão para o `BALANCE_LOG.md` e se ajustam **em lote** depois da F-T2 — nunca
  item a item, que é como o milho quebra o pão.
- **Nota de integração (CLAUDE.md §10 — escrita ANTES do código,
  2026-09-24)**: **esta feature é de integração.** Ela toca `src/sim/` **e**
  `src/render/` de propósito, e a exceção do §10 está registrada aqui, no item,
  antes de existir uma linha de código — como manda a regra, e como a F18d-2 já
  fez. A razão é a mesma da F18d-1: **a tela não pode mentir por uma feature
  inteira**. Terreno que existe só na simulação transforma toda recusa de
  construção em bug aparente. O render continua **lendo** o estado e o mapa, sem
  decidir nada.
- **Nota (o que o desenho mínimo NÃO é)**: textura, transição entre terrenos,
  árvore com silhueta e veio na montanha ficam para o item de render único
  depois da F-T2 — um item, não três. Cor chapada por tipo é o piso; qualquer
  coisa além disso nesta feature é escopo que ninguém pediu.
- **Nota (GDD — decisão minha, §7.7)**: o GDD §4 ganha a seção de recursos
  naturais **no commit da feature que a torna verdadeira**, nunca antes. Doc que
  descreve o que não existe é pior que doc faltando.

### F-D — Descoberta: o jogo diz o que existe, e o mapa não esconde

**Origem (turnos F–H, 2026-09-24)**: três sessões de jogo do operador acharam o
mesmo defeito por três portas. Ele ficou preso na ferramenta de construir porque
nada anuncia o `Esc` (BUG-A); descobriu que o botão do meio move a câmera só
quando alguém contou; e achou o lago só depois de alguém dizer onde procurar.
*"O jogador não vai ter quem diga."* As três features abaixo fecham isso pela
raiz: o jogo **anuncia** os controles, dá o gesto que todo mundo tenta primeiro
e abre num lugar onde há o que ver.

**Ordem (decisão do operador)**: F-D1 → F-D2 → F-D3 → **F-T2b**. A F-D3 vem antes
da F-T2b de propósito: a F-T2b semeia árvores no mapa, e é mais barato semear com
a geografia já corrigida do que regravar 900 tiles depois.

#### F-D1 — A tela de ajuda: o jogo diz quais teclas existem
- **Por que primeiro**: é o mais barato e ataca a causa. Hoje nada no jogo anuncia
  `Esc`, `R`, `P`, `+`/`-`, o botão do meio ou a roda — e a F06 já devia ter
  trazido isso.
- **Escopo**: sobreposição HTML sobre o canvas, aberta por `H` **e** `F1`, fechada
  por `Esc` ou pelo mesmo `H`/`F1`. Todo texto vem de `data/theme-sertao.json`,
  como todo texto que o jogador lê. Mais um lembrete discreto no primeiro
  carregamento (*"`H` para os controles"*), que some no primeiro `H` e não volta —
  a marca fica em `localStorage`, que é coisa de `ui/`, **nunca** de `GameState`.
- **Aceite**:
  1. `H` e `F1` abrem; `Esc` e o segundo `H` fecham. O `F1` precisa de
     `preventDefault`, senão abre a ajuda do navegador.
  2. **A tela não mente.** O roteiro afirma que cada tecla listada **existe no
     código**: a lista da tela é comparada com um inventário exportado por
     `input/`, **não** com a tabela do GDD §2.2.
  3. Nenhum rótulo é id neutro: todos saem do tema.
  4. O lembrete aparece na primeira partida e não na segunda.
- **Evidência**: `screenshots/F-D1-*.png` e `test-output/F-D1-shot.json`
- **Nota (decisão do operador, turno H)**: o aceite (b) comparar com o **código** e
  não com o GDD é a decisão certa. Hoje `B`, `F`, `Delete`, `1..9`, `Ctrl+1..9` e
  `Espaço` estão na tabela do GDD e **não existem** no código. *"Listar tecla que
  não existe é trocar jogador perdido por jogador enganado."*
- **Nota de integração (CLAUDE.md §10)**: **feature de integração** — pode tocar
  `src/ui/` e `src/input/` na mesma feature, porque o inventário de teclas mora em
  `input/` e quem o mostra é `ui/`. **Não toca `src/sim/`.**
- **Nota (contrato herdado)**: o inventário de teclas que a F-D1 exporta é a fonte
  única de "que tecla existe". Toda feature que acrescentar tecla (F-D2, F26)
  acrescenta **ali**, e a tela de ajuda passa a listá-la sem tocar em `ui/`.

#### F-D2 — Navegação por setas e espaço + arrastar
- **Por quê**: seta todo mundo tenta; botão do meio quase ninguém. Não se remove
  nada — o botão do meio continua funcionando.
- **Escopo**: as setas movem a câmera a passo constante por tick de render;
  `Espaço` segurado + arrastar move a câmera **independente da ferramenta ativa**
  (padrão de editor), e o cursor muda enquanto o espaço está apertado, senão o
  gesto continua invisível. Entra junto, **como higiene, não como urgência**:
  `preventDefault` no `mousedown` do botão do meio, para o ícone de autoscroll do
  navegador não aparecer.
- **Aceite**:
  1. Cada seta move a câmera na direção certa e o roteiro afirma o `scrollX`/
     `scrollY` publicado; segurar acelera até um teto lido de `data/terrain.json`,
     nunca digitado em `.ts`.
  2. O clamp da F04 continua valendo nas quatro bordas.
  3. **`Espaço` + arrastar move a câmera com a planta de prédio na mão, e não
     planta nada** — é a perna que prova a independência da ferramenta.
  4. `Espaço` sem arrastar não rola a página nem dispara o botão focado do menu.
  5. Não-regressão: `npm run shot -- F04` e `F18a` saída 0.
- **Evidência**: `test-output/F-D2-shot.json`
- **Nota (decisão do operador, turno H — o conflito do `Espaço`)**: leitura
  conservadora. **Setas e `Espaço` são da câmera**, `WASD` é sinônimo das setas, e
  o "pular para o último alerta" do GDD §2.2 fica **sem tecla** até alguém lhe dar
  uma. O **GDD §2.2 se corrige nesta feature**, não depois: tabela que descreve
  teclas que não existem é o que a F-D1 acabou de proibir.
- **Nota de integração (CLAUDE.md §10)**: **feature de integração** — toca
  `src/input/` e `src/render/` (a câmera). **Não toca `src/sim/`**: câmera é
  render, e nada disto entra no `GameState`.

#### F-D3 — Reserva por raio em volta da vila (gerador de mapa)
- **Por quê**: *"eu achei o lago depois de alguém me dizer onde procurar."* Hoje
  `tools/gerar-mapa.js` usa `LIVRE_A_PARTIR_DE = 72`, uma **faixa** que reserva
  31,6% do mapa e empurra lago, lajedo e mato para longe da vila — fora do alcance
  de qualquer zoom da abertura. A reserva existe para a vila caber; a forma dela é
  que está errada.
- **Escopo**: trocar a faixa por uma **reserva por raio** em volta da vila inicial
  no gerador. O raio e o que ele reserva são **dado**, não número digitado no
  `.js`. O mapa é regravado (`data/maps/sertao-128.json`) e a semente registrada.
- **Aceite**:
  1. **A abertura mostra terreno variado sem o jogador precisar procurar**: no
     retângulo visível da câmera inicial, medido do estado e não descrito,
     aparecem pelo menos **dois tipos de recurso** e **três tipos de terreno**.
     Screenshot da abertura junto.
  2. **A vila continua construível**: nenhum recurso e nenhum terreno
     intransponível sob o footprint dos prédios iniciais nem sob a estrada
     inicial. Guarda automatizada, dentro do `npm run verify`.
  3. Mesma semente = mesmo mapa, byte a byte.
  4. Não-regressão: os roteiros que dependem da geografia (`F-T1`, `F-T2a`,
     `F16b`) saída 0.
- **Evidência**: `screenshots/F-D3-*.png` + `test-output/F-D3.json`
- **Nota (não é feature de integração)**: `tools/` e `data/`. Se algum roteiro
  precisar de ajuste de coordenada, é não-regressão da geografia, não render novo.
- **Nota (reavaliar o BUG-C depois desta)**: a pedreira do roteiro da F22 fica em
  (38,31) e o lajedo da vila termina em `gx 26` — **zero** tiles de pedra ao
  alcance 6, medido em 2026-09-24. A F-D3 mexe exatamente nessa geografia, então o
  conserto do BUG-C espera por ela em vez de mover a pedreira duas vezes.

#### F-D4 — A unidade diz o ofício, não o id (render) — ENTREGUE 2026-09-25
- **Por quê**: pedido do operador em 2026-09-25, com o relato dele: *"as unidades
  mostram ids (u3, u7) no retângulo, e isso não diz nada ao jogador"*. O nome do
  ofício já existia no tema desde sempre; a tela é que não o lia.
- **Escopo**: o retângulo da unidade passa a trazer o nome do ofício
  (`Carregador`, `Obreiro`, `Cabra da Pedreira`), vindo de
  `data/theme-sertao.json` **pelo tipo neutro**, como todo texto visível (§9).
  Nada digitado em `.ts`: `src/render/nome-de-unidade.ts` é o funil, e tipo sem
  verbete no tema **reprova** em vez de virar rótulo genérico — mesmo desenho do
  `nomeDoRecurso` da F-TA. O id continua na ponte de debug
  (`UnidadeRenderizada.id`), que é por onde os roteiros identificam unidade.
- **Não é feature de integração**: só `src/render/`. `sim/` não foi tocado.
- **A decisão do encaixe, que o operador pediu por escrito — texto FORA do
  quadrado, e não apelido curto no tema**. Medido pelo roteiro, não estimado: o
  quadrado tem meio tile, **32 px**; `Obreiro` desenha **51 px** e `Carregador`,
  **71 px** (`test-output/F-D4-shot.json`). Ou seja, **nem o nome mais curto dos
  civis cabe dentro** — caber exigiria apelido de ~5 caracteres, que não é
  palavra do tema, e que morreria junto com o placeholder no dia em que o sprite
  substituir o retângulo (§9). O texto foi para baixo do quadrado, ancorado pelo
  topo (`ALTURA_DO_NOME_EM_LADOS`), onde continua valendo quando o quadrado virar
  sprite.
- **Aceite** (verificado): (a) o texto desenhado é **igual** ao de
  `theme-sertao.json` para o tipo da unidade, comparado no roteiro contra o
  arquivo; (b) nenhum rótulo contém o id; (c) todo tipo de `data/units.json` tem
  verbete no tema, e tipo desconhecido **joga** (`tests/F-D4-nome-da-unidade.test.ts`);
  (d) o rótulo acompanha a unidade que anda; (e) screenshot.
- **Evidência**: `test-output/F-D4.json`, `test-output/F-D4-shot.json`,
  `screenshots/F-D4-*.png`.
- **Nota (§8, o gesto despausado)**: o roteiro aperta `[data-predio="quarry"]`
  dentro do `#menu-build`, então roda esse passo **despausado**, com
  `mouse.down` / 150 ms / `mouse.up`. Ele também desenha a rua **antes** de
  plantar: sem estrada ligando a obra ao armazém a tarefa de material não nasce
  (F18d) e a vila ficaria parada por regra — o roteiro estaria medindo outra
  coisa. Isso foi medido: as duas primeiras versões do roteiro esperaram 600
  ticks por um movimento que não podia acontecer.
- **Observação registrada, sem mudança**: com a vila de 6 unidades os rótulos
  ficam legíveis, mas dois `Obreiro` em tiles vizinhos já se encostam
  (`screenshots/F-D4-3-oficio-de-perto.png`). Numa vila de 40 unidades isso vira
  parede de texto. Mostrar o nome só ao passar o mouse, só na unidade
  selecionada, ou só acima de um nível de zoom é mudança de desenho — está em
  `IDEIAS.md`, não aqui.

### F-T2 — Camada de recursos no mapa (sim + render mínimo, integração)

> **Quebra em sub-itens (CLAUDE.md §6, 2026-09-24)**: o item atravessa dado,
> `GameState`, produção, JobBoard, A* e render, e as seis pernas não fecham numa
> sessão. Ele **não** foi reescrito nem reordenado — o escopo, as seis pernas e
> as notas abaixo continuam sendo o contrato inteiro, e as três partes só dizem
> **em que ordem** elas fecham. O que o operador mandou lembrar está preservado e
> repartido, sem sair da feature: *o rendimento por tile substitui o veio: 200 da
> F15a* e *o exploit de demolir-e-reconstruir morre como primeira perna do
> aceite* ficam na **F-T2a**; *a árvore como obstáculo tem a re-medição do A*
> escrita como tarefa de dentro* fica na **F-T2b**, que é a parte que torna a
> árvore obstáculo — a medição continua sendo tarefa de dentro da parte que muda
> o A*, que é o que a regra pede. A F-T2 só fecha quando as três fecharem.

- **Escopo**: `state.recursos`, **esparso e dentro do `GameState`**, com a mesma
  forma e a mesma chave de `state.estradas` —
  `Readonly<Record<"gx,gy", { tipo: string; quantidade: number }>>`. Um
  mecanismo de esgotamento com **três regimes declarados no dado, por tipo**:
  `nunca` (a entrada sai do mapa ao zerar e o tile volta a ser terreno base),
  `porAcao` (a entrada **fica** com `quantidade 0` — *cortada* é diferente de
  *inexistente*) e `porTempo` (sobe sozinha, taxa em `data/`). Um mecanismo, três
  regimes; **não** três sistemas. Primeiro consumidor: a **Quarry**, que já tem
  esgotamento, evento `vein-exhausted` e alerta — só a **fonte** muda, do prédio
  para o tile. Árvore entra como recurso **e como obstáculo**. Mais o
  **desenho mínimo** do item seguinte.
- **Escopo de render — desenho MÍNIMO (decisão do operador, 2026-09-24)**: um
  **marcador por tipo de recurso** sobre o tile, e nada mais. Sem arte, sem
  silhueta. O jogador precisa ver onde há rocha, árvore e veio antes de plantar
  a pedreira, e precisa ver o tile **esgotar**.
- **Aceite**, e as duas primeiras pernas são as que não passam por acidente:
  1. **O exploit da F16a morre, e a asserção é ele.** Demolir a pedreira
     esgotada e reconstruir no mesmo tile **não** devolve pedra: o teste roda até
     o esgotamento, demole, reconstrói, roda de novo e afirma produção **zero**.
     Hoje isso devolve 200 pedras por meio custo de construção.
  2. **O lugar passa a importar, e o número prova.** Duas pedreiras iguais em
     dois lugares do mesmo mapa produzem **totais diferentes** até esgotar, e o
     total de cada uma é a soma dos tiles de rocha ao alcance dela — os dois
     números gravados na evidência. É o que separa esta feature de trocar o 200
     de lugar.
  3. **Os três regimes se distinguem no estado.** Tile de rocha zerado **sai** de
     `state.recursos`; tile de árvore cortada **fica**, com `quantidade 0`. O
     teste afirma a diferença entre os dois, que é a pré-condição escrita no
     `IDEIAS.md` para os modos do Woodcutter's.
  4. **Determinismo e save.** Mesma semente, 500 ticks, dois estados idênticos
     byte a byte com recursos **parcialmente** esgotados (nem vazios, nem
     cheios); `compararComESemSave` da F02/F23 continua verde **sem código
     novo** — `Record` de string para objeto simples, sem `Map`, sem função, sem
     ciclo. +30 KB no save, medido: 900 tiles de recurso.
  5. **O A* com floresta foi remedido.** Decisão do operador (2026-09-24):
     **árvore é obstáculo**, e a re-medição é **tarefa dentro desta feature**,
     não depois. Vizinhança 8 com obstáculo **esparso** é caso diferente do mapa
     liso da F18b: cada árvore reprova a regra de quina (`quinaLivre`,
     `src/sim/pathfinding.ts:423`) nas diagonais que a tocam, e a fronteira do A*
     cresce. Medir busca **curta e longa**, mapa vazio contra mapa com a
     densidade de floresta do mapa padrão, µs e nós expandidos gravados em
     `test-output/F-T2.json`, teto escrito com o número medido.
  6. **Ninguém varre o mapa para escolher alvo.** A escolha de tile continua
     nascendo como **tarefa do JobBoard**, com origem já resolvida e reservada no
     `claim`; o teste prova pelo comportamento — dois especialistas que reclamam
     no mesmo tick recebem tiles **distintos**, e o `release` devolve a reserva.
     Varrer o mapa é o anti-padrão do CLAUDE.md §10, e recurso no mapa é a maior
     tentação de quebrá-lo desde a F09.
- **Evidência**: `test-output/F-T2.json` + `screenshots/F-T2-*.png`
- **Nota (isto substitui o veio do prédio — decisão do operador, 2026-09-24)**:
  **rendimento por tile, não no prédio.** `ReceitaDePredio.rendimentoDoVeio` e
  `PredioCompleto.producao.veio` deixam de ser a fonte; `quarry.veio.rendimento
  = 200` de `data/production.json` (contrato da F15a) sai, e o total passa a ser
  função dos tiles de rocha ao alcance. **É o ponto de maior risco do pacote** e
  está escrito aqui de propósito: a Nota da F21 dizia *"só o inicializador
  muda"*, e isso virou meia verdade — com o recurso no tile, quem decrementa
  deixa de ser o ciclo de produção e passa a ser a colheita.
- **Nota (o que sai de outros arquivos neste commit)**: a entrada *"Demolir e
  reconstruir renova o veio da Quarry"* sai do `IDEIAS.md` **no commit desta
  feature** — ela morre sozinha, não se conserta. A entrada *"Terreno de mapa
  variado"* se divide em duas, e os dois dependentes registrados se separam
  junto: o motivo `'terreno'` do `canPlace` é da F-T1, os **modos do
  Woodcutter's** são desta.
- **Nota (cardume — decisão minha, §7.2, registrada para veto barato)**: regime
  **`nunca`**. O GDD marca o estoque do lago como finito **[fonte]**
  (`fishermans.notas`, em `data/production.json`, diz *"estoque do lago e
  finito"* e nada implementa), e regeneração seria invenção nossa em cima de
  fonte. O custo de errar é **um campo de dado**: trocar para `porTempo` é uma
  linha em `data/`, sem tocar em sistema — é exatamente isso que os três regimes
  compram. Consequência herdada, não nova: Fisherman's com cardume seco cai na
  entrada já aberta do `IDEIAS.md` sobre prédio esgotado que não devolve o
  trabalhador.
- **Nota de integração (CLAUDE.md §10 — escrita ANTES do código,
  2026-09-24)**: **esta feature é de integração**, pelo mesmo motivo e com a
  mesma fronteira da F-T1: floresta que existe só para o A* faz o caminho
  desviar de nada, aos olhos do jogador. O render lê; não decide.

#### F-T2a — O recurso está no mapa e no estado, e a Quarry colhe o tile
- **Fecha as pernas 1, 2, 3 e 4** do aceite acima, na íntegra, e mais nada.
- **Escopo**: o dado dos recursos (tipo, regime, rendimento por tile, alcance da
  colheita) e a camada de recurso no arquivo de mapa, emitida pelo mesmo gerador
  de autoria da F-T1; `state.recursos` esparso, com a forma e a chave de
  `state.estradas`; o mecanismo de esgotamento com os três regimes; a **Quarry**
  como primeira consumidora — `producao.veio` deixa de ser a fonte,
  `rendimentoDoVeio` sai do dado, do carregador e do tipo, e quem decrementa
  passa a ser a colheita do tile. Render: o **marcador de rocha**, e só ele.
- **Nota (dívida declarada, e quem a fecha)**: nesta parte a pedreira escolhe o
  tile por varredura determinística **limitada ao próprio alcance**, dentro do
  sistema de produção. Quem varre é o **prédio**, não a unidade, então não é o
  anti-padrão do §10 — que fala de unidade escolhendo tarefa varrendo o mundo —,
  mas também **não** é a reserva no `claim` que a perna 6 exige. Consequência
  enquanto durar: duas pedreiras com alcances sobrepostos podem mirar o mesmo
  tile no mesmo tick; a colheita é aplicada em ordem de prédio e nenhuma
  quantidade fica negativa, então o efeito é uma colher a menos, não estado
  inválido. Estado intermediário **declarado**, não prática aprovada: quem o
  encerra é a F-T2c.
- **Nota (o que a árvore ainda não é aqui)**: a árvore nasce no mapa e no estado
  como recurso de regime `porAcao` — ela precisa existir para a perna 3, que é
  justamente a diferença entre *cortada* e *inexistente* —, mas **não** bloqueia
  passo nesta parte, e o A* não muda uma linha. Obstáculo é a F-T2b, junto da
  medição que ele obriga; mudar o A* sem medir na mesma parte é o que a decisão
  do operador proibiu.
- **Nota (o que sai de outros arquivos no commit desta parte)**: a entrada
  *"Demolir e reconstruir renova o veio da Quarry"* sai do `IDEIAS.md` aqui — é
  aqui que ela morre. Os **modos do Woodcutter's**, que a entrada *"Terreno de
  mapa variado"* deixou pendurados, ganham a pré-condição (a distinção de regime)
  aqui, mas continuam sendo item futuro: pré-condição não é implementação.
- **Nota de integração (CLAUDE.md §10)**: vale a da F-T2, escrita acima antes de
  qualquer código. Esta parte toca `src/sim/` e `src/render/` pelo mesmo motivo:
  recurso que só a simulação enxerga faz o jogador plantar a pedreira no escuro.
- **Evidência**: `test-output/F-T2a.json` + `screenshots/F-T2a-*.png`

#### F-T2b — A árvore é obstáculo, e o A* é re-medido
- **Fecha a perna 5** do aceite acima, com a re-medição dentro dela, mais o
  **marcador de árvore** no render.
- **Escopo**: o recurso que a F-T2a já pôs no mapa passa a reprovar o passo, pela
  mesma porta de leitura que o terreno usa; a medição de busca curta e longa,
  mapa vazio contra a densidade de floresta do mapa padrão, µs **e nós
  expandidos**, com o teto escrito a partir do número medido.
- **Nota (a medição não cabe em `estatisticasDeBusca()`)**: a F10 afirma o
  retorno dela com `toEqual`, então campo novo ali reprova a suíte inteira. Os
  nós expandidos saem por acessor próprio, e não por crescimento do objeto que
  outra feature já congelou.
- **Nota (o mapa mudou de contrato na F-D3, 2026-09-24)**: até a F-D3,
  `tools/gerar-mapa.js` reservava o quadrante noroeste inteiro
  (`LIVRE_A_PARTIR_DE = 72`) e **descartava em silêncio** todo aglomerado de
  floresta que caísse lá. A faixa saiu: a árvore agora nasce no miolo do mapa,
  inclusive perto dos cenários de teste. Medido na semente 20260924, com o mapa
  já regravado:
  - **16 tiles de árvore em `gx 19..27 × gy 46..48`**, ao sul-oeste do pátio dos
    cenários, onde antes não havia nenhuma;
  - o **mato do nascente**, autoral, em `gx 37..42 × gy 22..27` — dentro do
    quadro de abertura, a nordeste da vila;
  - **nenhum** dos 70 pares `gx:/gy:` literais de `tests/`, `tools/shots/` e
    `src/` cai sobre árvore (conferido na F-D3). O único par sobre terreno
    intransponível é `(92,46)`, o lago, que a `F-T1-terreno` usa de propósito.
  Hoje isso não quebra nada porque árvore não bloqueia. **Esta feature é a que
  faz bloquear**: o pátio dos cenários deixa de ser chão livre por construção, e
  as coordenadas acima são as primeiras a conferir se algum cenário reprovar.
- **Evidência**: `test-output/F-T2b.json` + `screenshots/F-T2b-*.png`

#### F-T2c — A escolha do tile nasce no JobBoard, com reserva
- **Fecha a perna 6** do aceite acima, e encerra a dívida declarada na F-T2a.
- **Escopo**: a varredura por alcance da F-T2a vira **tarefa do JobBoard**, com a
  origem resolvida e **reservada** no `claim` e devolvida no `release`. A função
  pura que escolhe o tile não é jogada fora: ela vira o candidato que a tarefa
  reserva. Prova por comportamento — dois especialistas reclamando no mesmo tick
  recebem tiles distintos.
- **Evidência**: `test-output/F-T2c.json`

### F-SPR — Carregamento de sprite de terreno, recurso, vegetação e unidade (render; ENTREGUE 2026-09-26)
- **Origem — ordem do operador, leva noturna de 2026-09-26, item 5**: "Sem arte
  nenhuma: só o carregamento, com fallback para o placeholder atual quando não houver
  PNG." Plano em `docs/planos/F-SPR-carregamento.md`. **Render puro**: nada em
  `src/sim/`, nada em `data/`, e `assets/manifest.json` intocado (não há arte para
  declarar; o que mudou foi o tipo que o lê).
- **Aceite**: (1) o manifesto aceita `terreno`, `recurso`, `vegetacao` e `unidade`
  **sem mudar a entrada de prédio** — mesmos oito campos, mesma chave
  `predio:<id>:<estagio>`, e as regras de prédio da F17f continuam valendo sobre as
  entradas `predio`; (2) o teste prova os dois lados para cada camada (arte declarada
  e carregada resolve; sem entrada, estado ou arquivo, cai no placeholder); (3) o
  roteiro mostra a tela de hoje intacta, com a cena publicando arte só para o id que o
  manifesto declara.
- **Evidência**: `test-output/F-SPR-carregamento.json` +
  `screenshots/F-SPR-*.png` (roteiro `F-SPR`).
- **O contrato que a arte herda (decisões minhas, marcadas para o operador revisar)**:
  - **Chave**: `<tipo>:<id>:<estado>` para todo tipo. Para prédio é a de antes.
  - **Terreno** (`tipo: "terreno"`, `id` = tipo de `render/mapa.ts`, estado
    `padrao`) e **recurso** (`tipo: "recurso"`, estado `presente`) são **textura de
    tile**: a imagem é redimensionada para `tilePx × tilePx` dentro da tira que vira
    tileset. Índice do tile, código, `putTileAt` e as contagens do roteiro não mudam.
    O esgotado continua sendo o marcador único.
  - **Vegetação** (`tipo: "vegetacao"`, `id` = id do recurso, `tree`, estado
    `presente`) é **sprite**, não textura: uma imagem por tile presente, no tamanho
    do arquivo, com o `anchor` no meio da borda de baixo do tile e depth pelo pé. A
    célula da tira fica vazia. Um id não pode ser `recurso` e `vegetacao` ao mesmo
    tempo (guarda em `tests/F-SPR-carregamento.test.ts`).
  - **Unidade** (`tipo: "unidade"`, `id` = tipo neutro) usa **um arquivo por
    direção**, não folha. Estado `"<pose>:<direcao>"`, com as direções
    `n ne l se s so o no`, e hoje só a pose `parado`. **Oeste é espelho**: `o`, `no`
    e `so` sem arquivo usam `l`, `ne` e `se` com `flipX`, de modo que 4 direções
    custam 3 arquivos e 8 custam 5. Quantas direções cada tipo tem vem de
    `data/units.json` (`direcoesDeSprite`: civis 4, militares 8); os mercenários não
    declaram e ficam no retângulo. O `anchor` cai na posição desenhada da unidade.
  - **Nenhum tamanho é calculado** fora do prédio: sprite sai no `tamanho` do
    arquivo, e textura de tile sai no `tilePx`. O fator de transbordo do prédio
    (correção do BRIEF-ARTE, 2026-09-26) **não passa por este código**.
- **O que NÃO mudou e vai mudar com o fator de transbordo**: o desenho de **prédio**
  continua forçando a largura do footprint (`WorldScene.desenharSprite`,
  `setScale(larguraPx / entrada.tamanho[0])`), e a F17f continua afirmando
  `tamanho[0] === footprint[0] × tilePx` (`tests/F17f-manifesto.test.ts`, teste "a
  largura em px…"). As duas coisas são a regra "largura = footprint × 64" que o
  operador marcou como errada. Não foram mexidas aqui porque a convenção nova espera a
  medição do operador; quando ela vier, mudam juntas.

### F-TR — Tratamento visual do terreno e dos recursos (render)
- **Nota herdada da F-SPR (2026-09-26)**: o **carregamento** já existe. Esta feature
  é **arte + transição**: declarar as entradas `terreno`/`recurso`/`vegetacao` no
  manifesto (contrato no item F-SPR, logo acima) e acrescentar o que a F-SPR não fez —
  o tile de transição entre terrenos, que precisa de estado novo na entrada de
  terreno (hoje só `padrao`), e o esgotado por tipo. A árvore com depth sorting já
  está resolvida como sprite de vegetação.
- **Posição e forma — decisão do operador, 2026-09-24**: **um item, não três.**
  Ele vem **depois da F-T2**, quando as duas camadas já existirem; o desenho do
  **especialista fora do prédio** não está aqui, vai junto da F-T3.
- **Escopo**: o tratamento decente do que a F-T1 e a F-T2 desenharam como cor
  chapada e marcador: textura por tipo de terreno, **transição entre terrenos**,
  árvore com silhueta (e com o depth sorting que a leitura 3/4 exige), veio
  aparente na montanha. **Render puro**: nada em `src/sim/`, nada em `data/`
  além do manifesto de asset, nenhuma regra nova. Placeholder continua sendo
  comportamento normal (CLAUDE.md §9): tipo sem PNG cai na cor chapada da F-T1.
- **Aceite**: o roteiro afirma, no mesmo cenário, que tiles de tipos diferentes
  desenham **texturas diferentes** e que a fronteira entre dois tipos usa o tile
  de transição; screenshot do mapa com água, grama, areia, floresta e serra no
  mesmo quadro. Nenhum teste de `sim/` muda — se algum mudar, o escopo vazou.
- **Evidência**: `test-output/F-TR-shot.json` + `screenshots/F-TR-*.png`
- **Nota herdada da F18 (2026-09-24, medida na tela)**: hoje **todo tile de
  quantidade zero divide um código só** (`esgotado`, em `render/mapa.ts`), então
  o campo em pousio e o lajedo já cavado desenham o **mesmo marcador escuro** —
  visível em `screenshots/F18-1-o-campo-arado-em-pousio.png`, onde os 65 tiles do
  roçado aparecem como diamantes escuros sobre a terra marrom. São estados
  **opostos** para quem joga: um é trabalho por fazer, o outro é fonte acabada. A
  correção é arte por tipo, que é o escopo desta feature; não foi feita na F18
  porque mexer aí é `src/render/` e a F18 não é feature de integração.

### F18 — Farm e campos de milho
- **Escopo**: a fazenda passa a depender de **tile arável no mapa**. O campo é
  recurso de regime `porAcao` (arar e semear repõe; colher consome), criado pela
  F-T2 e consumido aqui — esta feature **não inventa** mecânica de campo, ela é
  **consumidora** dela. `terrain.json.campos.milho.tilesPorFarm = 15` e o
  duplicado em `production.json.wineyard` (9 tiles, 1 timber) ganham leitor **ou
  saem**: hoje nenhum dos dois tem um (grep em `src/` não acha leitor), e os dois
  não podem continuar sendo a mesma verdade escrita em dois lugares.
- **Aceite**, as duas pernas de sempre, com a condição reescrita: **fazenda sem
  campo não produz** passa a significar **fazenda sem tile arável alcançável não
  produz** — condição de **mapa**, não número no prédio. (a) fazenda posta em
  região sem tile arável ao alcance fica parada, com a causa nomeada no alerta
  (F22), e o teste afirma a **causa**, não só a parada; (b) a mesma fazenda, no
  mesmo mapa, com tiles aráveis ao alcance, produz milho — e a produção **para**
  quando os tiles se esgotam e **volta** quando o campo é replantado.
- **Evidência**: `test-output/F18.json`
- **Nota (a ordem mudou, e o número da frase com ela)**: a proposta chamava esta
  feature de **terceira** consumidora do módulo, na fila F-T1 → F-T2 → F-T3 →
  F18. Com o corte aprovado pelo operador (2026-09-24) a F-T3 foi para **depois
  da F20**, então na ordem real a F18 é a **segunda** consumidora de
  `state.recursos` — a Quarry, dentro da F-T2, é a primeira. A frase da proposta
  fica registrada aqui para que ninguém a leia como contradição.
- **Nota (o fazendeiro ainda NÃO anda, e é decisão, não esquecimento)**: quem ara
  e planta é o **fazendeiro**, não o obreiro (correção do operador, 2026-09-24) —
  mas a **locomoção** do especialista é a F-T3, que vem depois da comida. Aqui o
  campo é tile de verdade, com esgotamento de verdade, e o fazendeiro continua
  dentro do prédio: o trabalho no campo é **abstração de tempo**, como toda
  produção de hoje. O render **não** pode desenhar o fazendeiro andando até o
  campo enquanto isso valer — seria desenhar regra que não existe, o mesmo motivo
  que tirou o laborer caminhando da F17d.
- **Nota (fechada em 2026-09-24, o que os dois duplicados viraram)**: os dois
  saíram, como o escopo autorizava. `terrain.json.campos` foi removido inteiro
  (milho e uva); `production.json.wineyard` perdeu `campos: 9` e
  `timberPorCampo: 1`, que viraram **frase** na nota da própria receita, para os
  dois números da uva não se perderem. A regra passou a ser outra e mora em dois
  lugares com leitor: o alcance está em `production.json:receitas.<t>.colheita`
  e o custo de plantar em `resources.json:tipos.<t>.reposicao.custo`.
- **Nota (o campo NÃO está no arquivo de mapa, e é de propósito)**: a camada de
  milho é **derivada do terreno** — `resources.json:tipos.corn.terreno =
  "campoArado"` e o carregador varre as linhas do mapa. `mapa.recursos` continua
  sem uma linha de milho, e `campoArado` ganhou o leitor que lhe faltava (até
  aqui ele só existia na matriz de custo do A*). Terra arável tem **uma** verdade,
  e não um desenho de terreno que poderia divergir de uma lista de tiles.
- **Nota (o que caiu da proposta anterior)**: `docs/planos/F18-F19-proposta-de-item.md`
  §2 propunha `state.campos` derivado da posição da fazenda e §4 propunha o
  fazendeiro não sair nunca. As duas caem com a decisão de arquitetura de
  2026-09-24 (`docs/planos/recursos-naturais-proposta.md`); o documento fica como
  registro do que foi considerado.
- **Nota (o operador REVOGOU a premissa desta feature em 2026-09-25)**: o campo deixa
  de nascer do mapa e passa a ser **desenhado pelo jogador**, com duas ferramentas no
  menu Construir ao lado de Estrada. O diagnóstico que levou à decisão está medido em
  `PROGRESS.md` e o plano inteiro em `docs/planos/campo-desenhado-pelo-jogador.md` — o
  resumo: no mapa publicado **nenhuma** posição a menos de 37 tiles do armazém tem
  tile arável ao alcance, então a fazenda da abertura não podia produzir em lugar
  nenhum perto da vila. O que desta feature **sobrevive** à reversão (medido, não
  suposto): o predicado `semTrabalhoAoAlcance` e o alerta `sem-campo`, o ciclo
  arar→semear→colher→pousio do regime `porAcao`, e o roceiro que sai até o tile
  (F-T3). O que cai é só `resources.json: corn.terreno` — e só se o operador escolher
  a opção B do plano, que custa **16 arquivos de teste / 33 testes** (medido
  removendo a chave e rodando a suíte). A fila **não** foi reordenada: os itens novos
  nascem quando o operador decidir a ordem.
### F-TP — A planta fantasma mostra o alcance de colheita (render + input)
- **Origem — decisão do operador, 2026-09-24**, a partir da medição que descartou
  o ramo (b) do BUG-C: em **85,5 %** da área jogável não há um tile de rocha ao
  alcance 6 (fração com ao menos um tile: alcance 3 → 8,6 %, 6 → 14,5 %,
  12 → 26,5 %, 20 → 45,0 %; a rocha vem em **11 lajedos**, não espalhada). O
  jogador planta a pedreira e ela **nasce parada**, e hoje ele só descobre pelo
  alerta da F22, depois do fato. **O desenho está certo — plantar longe é escolha
  legítima. O que chega tarde é o retorno.**
- **É regra da CLASSE, não da Quarry.** Vale para todo prédio cuja receita tem
  `colheita` em `data/production.json`: hoje só a `quarry`, amanhã o lenhador, o
  roceiro (F18), o pescador e o mineiro (F21). Nenhum id de prédio e nenhum id de
  recurso digitado em `.ts` — o alcance, o recurso e a cor saem do dado, como a
  paleta de recursos da F-T2a já sai. Prédio novo com `colheita` no dado ganha a
  prévia **sem uma linha de código**, e é isso que o aceite afirma.
- **Escopo**: enquanto a planta fantasma está sob o cursor (a prévia da F08, que
  já segue o mouse), ela mostra:
  (a) **o alcance de colheita desenhado sobre o grid**, a partir da CAIXA da
  planta, em Chebyshev — o mesmo `alcance_tiles` que a simulação usa, lido do
  dado, nunca uma segunda cópia da regra em `src/render/`;
  (b) **quantos tiles daquele recurso caem dentro dele**, e quanto isso dá em
  unidades (`quantidade` somada, que é o que a pedreira vai realmente tirar);
  (c) **nada**, quando a receita do prédio não tem `colheita` — armazém, escola e
  serraria não ganham moldura nenhuma.
- **A recusa NÃO entra** (decisão do operador): plantar longe continua valendo e
  `placement.ts` **não** ganha motivo novo de recusa. Zero tile mostra `0`; não
  bloqueia, não pinta de vermelho como impedimento, não pede confirmação.
- **Nota de integração (CLAUDE.md §10 — escrita aqui ANTES do código, e é o que
  autoriza a exceção)**: a contagem tem de sair da **mesma função** que a sim usa,
  senão a prévia e o prédio podem discordar. Hoje `tilesDeColheita` recebe um
  `PredioCompleto` e a fantasma não é prédio nenhum. Esta feature pode extrair, em
  `src/sim/recursos.ts`, o núcleo que recebe a **caixa** em vez do prédio, e
  deixar a assinatura de hoje chamando esse núcleo. **É a única mudança
  autorizada em `src/sim/` aqui**, é refatoração de assinatura e não pode trazer
  regra nova, número novo nem campo novo em `GameState`. Se o escopo pedir mais
  que isso, pare e registre.
- **Aceite**, com o roteiro cumprindo a §8 (despausa, `mouse.down` /
  `waitForTimeout(150)` / `mouse.up`, pausa de volta):
  (a) com a fantasma da pedreira **sobre o lajedo**, a prévia diz N > 0 tiles;
  movida para uma região sem rocha, diz **0** — e em nenhum dos dois casos o
  clique é recusado;
  (b) **a fantasma e o prédio concordam**: o N que a prévia mostra num tile é
  igual ao que `tilesDeColheita` devolve para o prédio **plantado naquele mesmo
  tile**. Esta é a perna estrutural, e é ela que impede a segunda cópia da regra;
  (c) prédio sem `colheita` na receita não desenha alcance nenhum.
- **Evidência**: `test-output/F-TP-shot.json` + `screenshots/F-TP-*.png`
- **Posição na fila — decisão do operador, 2026-09-24 (revisada no mesmo dia)**:
  vem **antes da F18**, e não depois. A nota anterior dizia o contrário, com a
  razão de que o roceiro já existiria e a prévia nasceria cobrindo os dois; ele
  reordenou ao disparar as três features seguidas. **A consequência é real e está
  registrada**: no momento em que esta feature entrou, a única receita com
  `colheita` no dado era a `quarry`, então a regra da classe **não pôde** ser
  provada por um segundo prédio de verdade. Ela é provada por um tipo de prédio
  **fabricado** em `GameData` clonado dentro do teste
  (`tests/F-TP-alcance-previa.test.ts`), que é prova estrutural e não varre o
  fonte atrás de nome. Quando a F18 chegar, o roceiro herda a prévia sem uma
  linha de código — e isso é o que o teste da classe já afirma.

### F19 — Mill e Bakery (cadeia do pão)
- **O item começou com uma tarefa de MEDIR, não de implementar — decisão do
  operador, 2026-09-24**: a cadeia `corn → flour → loaves` podia já funcionar sem
  código novo, porque a produção é genérica desde a F15a e as tarefas de insumo
  entre prédios existem desde a F15b. *"Meça primeiro e me diga o que faltou; o
  escopo é o que faltar."*
- **Resultado da medição: nada faltou.** A cadeia fecha inteira no cenário
  1 Fazenda : 1 Moinho : 1 Padaria — a proporção que o próprio
  `production.json` publica. Primeiro milho no tick 546, primeiro fubá em 885,
  primeiro cuscuz em **1256**; 68 cuscuzes em 12 000 ticks, que é **99,6 % do
  teto que a fazenda permite**. Nenhuma gaveta represada no fim. O dado bate com
  o GDD §5.2 linha a linha e o tema já traz **Fubá** e **Cuscuz**.
- **Escopo, portanto**: a prova, a evidência, e o que a medição expôs — nada
  além. `tests/F19-cadeia-do-pao.test.ts` transforma a sonda em cobertura
  permanente (sonda prova o momento, §8), e `cenarioDaCadeiaDoPao` entra no
  helper de produção.
- **Aceite** (todo marco derivado do dado, nenhum digitado):
  1. **a cadeia fecha**: partindo da linha de base do tick 0, o cuscuz aparece —
     e nunca antes de `plantio + ciclo da fazenda + ciclo do moinho + ciclo da
     padaria`, que é o piso que nenhum transporte pode furar;
  2. **o elo do meio é real**: a mesma vila **sem o moinho** não faz um cuscuz, e
     o milho se acumula. É o que impede o aceite de passar por uma padaria que
     fabrique pão do nada — o mesmo defeito que a F18 encontrou na fazenda;
  3. **a vazão é limitada pela FONTE**: o cuscuz entregue cabe no teto de dois
     pães por milho e fica acima de 85 % dele;
  4. **o cenário é o oráculo**: a contagem de prédios do cenário bate com
     `proporcoesDeReferencia`, lido do JSON cru;
  5. **o jogador alcança a cadeia**: `opcoesDoMenuBuild` libera `mill` com a
     fazenda construída e mantém `bakery` bloqueada, `requer: "mill"`, enquanto
     não houver moinho.
- **Evidência**: `test-output/F19.json`
- **Sem screenshot, e o motivo é o da F18**: nada muda na tela (nenhuma linha de
  `src/render/`), e o harness não constrói prédio — moinho e padaria estão atrás
  da fazenda, que está atrás da serraria.
- **Nota (o oráculo não tem leitor em `sim/`, e é de propósito)**:
  `proporcoesDeReferencia` não passa pelo carregador — é número de referência
  para medir, não regra de jogo. Quem passou a lê-lo é o teste de medição, e com
  isso ele deixou de ser dado sem leitor.
### F-TA — O painel do extrator mostra o que resta ao alcance (sim + ui + render)
- **Posição na fila — pedido do operador, 2026-09-24**: *"O painel da pedreira
  mostra quanto resta do recurso ao alcance? O rendimento por tile existe desde a
  F-T2a e é limitado — 15 por tile, com o tile secando. Se a informação não
  estiver no painel, ponha: é dado que já está no estado, e sem ela eu não sei se
  a pedreira vai durar mais cinco minutos ou mais uma hora."* Vem antes da F-T3
  porque é **leitura, não mecânica**: o número existe desde a F-T2a e só não chega
  à tela.
- **Escopo**: nenhuma mecânica nova, nenhum comando novo, nada em `state`.
  `painelDoPredio` passa a devolver `colheita: { recurso, tiles, unidades } | null`
  — o MESMO par que `colheitaAoAlcanceDaCaixa` já entrega à planta fantasma
  (F-TP) —, e o painel escreve uma linha. Prédio em obra e prédio de tipo sem
  `colheita` na receita: `null`, e o painel não escreve linha nenhuma (a mesma
  distinção que `pedeTrabalhador` já faz: "não se aplica" não é "zero").
- **Aceite**:
  1. **Regra da classe, não da Quarry.** Nenhum id de prédio e nenhum id de
     recurso digitado no código novo: um tipo **fabricado** com `colheita` na
     receita ganha a linha sem alteração de código, como
     `tests/F-TP-alcance-previa.test.ts` já prova para a prévia.
  2. **O painel e a prévia dizem o mesmo número.** Afirmado comparando a saída do
     seletor com a de `previaDeAlcance` no mesmo tile e no mesmo estado — não duas
     contas escritas duas vezes. Se divergirem, a tela promete o que a pedreira
     não entrega, que é o defeito que a F-TP existiu para não criar.
  3. **A linha acompanha o esgotamento.** Colher até o veio secar muda o par
     `(tiles, unidades)` no painel; tile de regime `porAcao` com `quantidade: 0`
     entra como **zero**, não desaparece — é a diferença entre cortado e
     inexistente que o regime guarda.
  4. **Screenshot com a linha legível no painel da pedreira.** O roteiro clica em
     `#painel-predio`, então cumpre o §8: pelo menos um passo despausa (`press('p')`)
     e usa `mouse.down` / `waitForTimeout(150)` / `mouse.up`, e pausa de volta.
- **Evidência**: `test-output/F-TA.json` + `screenshots/F-TA-*.png`
- **Nota de integração (CLAUDE.md §10 — escrita antes do código)**: a feature toca
  `src/sim/selectors.ts` (campo novo no seletor puro), `src/ui/painel-predio.ts` e
  um arquivo **novo** em `src/render/`, para onde sai o rótulo que hoje mora em
  `alcance-de-colheita.ts` — painel e prévia têm de usar a **mesma frase**, e duas
  cópias do molde divergiriam. A extração é necessária porque `ui/` **não pode**
  importar `alcance-de-colheita.ts`: ele importa `render/mapa.ts`, que é funil para
  `sim/data`, e `ui/` não lê `sim/data` (cabeçalho de `menu-build.ts`). O módulo
  novo lê **só o tema**.
- **Fora do escopo**: mudar o que a prévia mostra, mudar o texto do tema, e
  qualquer coisa sobre o especialista fora do prédio — isso é F-T3.

### F-T3 — O especialista sai do prédio (sim + render, integração)
- **Posição na fila — ANTES da F20, decisão do operador, 2026-09-24 (revisão da
  dele mesma)**: ela estava depois da F20 com o argumento de que *"locomoção podia
  esperar o jogo ter pão"*. Ele antecipou com a razão escrita: **a F19 enfraqueceu
  esse argumento** — a cadeia de comida já fecha sem código novo, e o que falta é
  só a F20 —, e jogando, *"colher pedra de dentro do prédio é a mesma coisa que me
  incomodou na estrada instantânea: o jogo esconde o trabalho"*. O primeiro caso
  continua sendo o pedreiro, *"o único em que só a locomoção é nova"*. **Ele pediu
  o plano antes da execução**, respondendo as três perguntas que a FSM obriga (as
  três estão no aceite 2, e o plano é `docs/planos/F-T3-especialista-sai.md`).
  Registro do que caiu: o argumento antigo continua válido para a F-T1 e a F-T2,
  que vieram antes da comida por serem **pré-condição** de mecânica de cinco
  prédios e do campo da F18; esta é a caminhada que torna a saída visível.
- **Escopo**: FSM nova para o ocupante de prédio extrator: sai, anda até o tile
  de recurso, colhe, volta, entrega. Estado explícito em `unit.fsm` e
  `unit.fsmData` serializável, sem `setTimeout`, sem async. **Primeiro caso: o
  pedreiro** — é o único em que **só a locomoção** é nova; o resto da mecânica
  dele já está de pé e medido desde a F15a. Lenhador e fazendeiro herdam, e não
  entram nesta feature.
- **Aceite**:
  1. **Ele anda, e o caminho é o do jogo.** O pedreiro sai do prédio, chega ao
     tile de rocha pelo A* (não por teleporte, não por contador), colhe e volta —
     o teste afirma a sequência de tiles e o tick de cada transição.
  2. **"Ocupado, mas fora" é respondido por todo predicado que lê `ocupante`.**
     Esta é a perna cara, e é o motivo de a feature existir sozinha: o painel da
     F16b não pode dizer "sem trabalhador"; o alerta `sem-trabalhador` da F22
     **não** pode disparar; demolir o prédio com o ocupante no campo não pode
     deixar unidade órfã nem tarefa reclamada sem `release`. Um caso de teste
     para cada um dos três.
  3. **Determinismo no meio do passo.** Save e load com o pedreiro **a caminho**
     (nem no prédio, nem no tile) e 200 ticks depois: estado idêntico byte a byte
     ao que não passou por save.
- **Evidência**: `test-output/F-T3.json`
- **Nota herdada da F18 (2026-09-24)**: `tilesDeColheita` inclui os tiles **sob o
  próprio footprint** do prédio. Enquanto o especialista fica dentro do prédio
  isso é inofensivo — o cenário da F18 evita o caso por posicionamento, e o
  aceite não depende dele. **Quando ele sair, passa a ser bug**: o roceiro andaria
  até um tile que está debaixo da própria fazenda. Resolver aqui, junto com o
  caminho; não antes.
- **O que o BUG-F fechou e o que sobrou (2026-09-24, medido)**: a recusa de
  construir sobre recurso fechou o caso da **rocha** e da **árvore** — prédio novo
  não nasce mais em cima deles, e nenhum prédio do cenário inicial cobre recurso
  (guarda permanente em `tests/F05a-estado-inicial.test.ts`). **Sobrou o milho, e
  de propósito**: a bandeira `bloqueiaConstrucao` é `false` para `corn` porque
  milho é tile que o jogador plantou e pousio é recurso com `quantidade: 0`.
  Medido: **215** âncoras de `farm` que `canPlace` aceita cobrem tile de milho.
  Então o travamento da nota acima **continua vivo pela fazenda**, e é aqui que ele
  morre — a solução é `tilesDeColheita` (ou quem escolhe o tile) descartar tile que
  o próprio footprint cobre, não ampliar a recusa de `canPlace`.
- **Corte autorizado pelo operador (2026-09-24)**: se a Tarefa 4 do plano
  (`docs/planos/F-T3-especialista-sai.md` — trocar a escolha do tile pelo
  predicado de alcançabilidade) estragar **mais que poucas asserções** das
  features herdadas, quebrar em **F-T3a** (caminho, ida e volta, ciclo em campo)
  e **F-T3b** (elegibilidade do tile e o milho debaixo do footprint), entregar a
  primeira e registrar a segunda como item próprio. *"Se a Tarefa 4 estragar mais
  que poucas asserções, quebre e entregue o primeiro."*
- **Nota de integração (CLAUDE.md §10 — decisão do operador, 2026-09-24)**: o
  **desenho do especialista fora do prédio vai junto desta feature**, não em item
  separado — mesma razão da F-T1 e da F-T2: unidade que a simulação põe no campo
  e a tela deixa dentro do prédio é tela que mente. A exceção do §10 está escrita
  aqui, antes do código.
- **FECHADA em 2026-09-25**, com os três aceites medidos em `test-output/F-T3.json`
  e abertos com Read: o ciclo da pedreira transita em **1 / 50 / 217 / 266** ticks
  (`trabalhando → indo_colher → colhendo → voltando`), a pedra cai na gaveta no tick
  da **chegada**; com o pedreiro a **2 tiles** do footprint o painel continua
  nomeando o ocupante, `alertasDoPredio` vem **vazio** e demolir devolve unidade
  `ocioso` com `fsmData` limpo e zero tarefa de colheita reclamada; e o save no
  tick **37** (fora da porta, caminho pela metade, passo em curso) dá estado
  idêntico 200 ticks depois. A nota de integração se cumpriu **sem uma linha em
  `src/render/`** — `src/render/unidades.ts` já desenha toda unidade de
  `state.unidades` e `posicaoDaUnidade` interpola por `fsmData.caminho` sem olhar
  `fsm` —, e quem prova isso é `tools/shots/F-T3.js`, que afirma o tile
  **desenhado** saindo do footprint e da porta (36 asserções,
  `screenshots/F-T3-1-pedreiro-no-campo.png`).
- **O corte autorizado não foi usado**: a Tarefa 4 não estragou "mais que poucas
  asserções", então **não houve F-T3a/F-T3b** — a feature saiu inteira. O que a
  herança obrigou reescrever está listado em `PROGRESS.md` (2026-09-25).
- **A queda de vazão foi medida e nenhum número mudou**: `BALANCE_LOG.md`
  (2026-09-25) — pedreira 167 → 266 ticks por pedra no cenário de teste e 250 no
  oráculo, fazenda 246 → 351. Calibrar isso agora quebraria o lote fechado pelo
  operador em 2026-09-24.

### F-T4a — O pescador sai para colher (dado + aceite; ENTREGUE 2026-09-25)
- **Por que existe**: a F-T3 entregou a caminhada como **regra de classe** — prédio
  com `colheita` na receita manda o ocupante ao tile —, mas a Casa do Pescador
  ainda produzia peixe **do nada** (`production.json:fishermans` tinha `sai` e
  nenhuma `colheita`). Esta é a metade do F-T4 que **não depende de decisão de
  design**: o açude já existe no mapa desde a F-T2a e ninguém mais depende do
  peixe.
- **Escopo entregue**: `fishermans` ganhou
  `colheita: { recurso: fish, alcance_tiles: 6 }`. **Zero linha de simulação** —
  caminhada, reserva de JobBoard, regime de esgotamento e aproximação por vizinho
  andável já existiam. Feature de **dado mais aceite**.
- **O que ela estreia, e a F-T3 não cobria**: o peixe é o primeiro recurso
  **inalcançável por dentro**. Rocha e milho se pisam; água não, e `fish.regime`
  é `nunca` (o tile some do estado em vez de ficar em zero, como a árvore). Então
  a margem não é detalhe de caminho: é a única posição de trabalho que existe.
- **Critério de aceite** (os quatro acenos do operador, 2026-09-25; plano em
  `docs/planos/F-T4-lenhador-e-pescador.md`):
  1. o pescador larga a porta, anda tile a tile e o tile em que fica `colhendo`
     está a Chebyshev **1** do cardume reservado, **não é** o tile do cardume, e é
     andável — e o peixe entra na gaveta no tick da **volta**;
  2. esgotado o único cardume ao alcance, a entrada **sai** de `state.recursos`,
     nenhuma tarefa fica reclamada, o pescador volta ao **mesmo** estado de espera
     de quem espera insumo (afirmado contra a serraria de gaveta vazia, não contra
     o rótulo digitado) e o prédio passa a dizer `veio-esgotado`;
  3. no lago grande, em 200 ticks, **todo** tile escolhido é de margem — a
     asserção compara com `tileAlcancavelParaColheita`, não com coordenada;
  4. **FORMA** da distribuição medida, não média (lição do BUG-C).
- **Evidência**: `tests/F-T4-pescador.test.ts` (11 testes), `test-output/F-T4a.json`
  (forma), `test-output/F-T4a-shot.json` (57 afirmações) e
  `screenshots/F-T4a-1-pescador-na-margem.png` — o tile **desenhado** do pescador
  fora do footprint, em areia, encostado em três tiles de cardume que são todos
  água, com o painel ainda dizendo quem trabalha ali.
- **Números medidos** (ficam aqui porque a F-T4b herda os da árvore):
  `fish` 274 tiles em **2 lagos** (243 e 31), **95 alcançáveis** (1 900 de 5 480
  unidades), o lago grande com **70 tiles de margem em 243** — e água nunca abre.
  `tree` 350 tiles em **12 capoeiras** (68, 56, 47, 45, 41, 40, 20, 18, 6, 5, 2,
  2), **301 alcançáveis hoje e 350 no fim**, porque árvore cortada vira andável.
  Alcance 6 é **a calibrar**, com a conta em `BALANCE_LOG.md` (2026-09-25).

### F-T4b — O lenhador sai para colher (ENTREGUE 2026-09-25)
- **O que falta**: `woodcutters` ganhar `colheita: { recurso: tree, ... }`, pelo
  mesmo caminho da F-T4a. O código já serve; o **dado** é que não fecha.
- **Por que está bloqueado, medido antes de escrever qualquer linha** (Medição 2
  do plano, sonda da sessão; **remedido em 2026-09-25 a pedido do operador**, que
  quis escolher a saída com o número na mão — `test-output/F-T4b-reprovacoes.json`
  e `test-output/F-T4b-geometria-da-mata.json`): com `colheita { tree, 6 }` no
  lenhador, **3 de 1 400 reprovam**. Só com o pescador: **0**. As três, com a
  asserção literal:
  1. `tests/F15a-receita.test.ts:39` — `expect(r?.colheita).toBeNull()` recebe
     `{ recurso: 'tree', alcance: 6 }`. É **texto do dado**: a asserção afirma a
     ausência, e se reescreve na tarefa que muda o dado. Não é sintoma de jogo.
  2. `tests/F15b-aceite.test.ts:237` — `expect(acumulado.timber).toBeGreaterThan(0)`
     recebe **0**: em 3 000 ticks o cenário oráculo não produz **nenhuma** tábua.
     `stone` continua > 0, então o que quebra é a mata, não a colheita.
  3. `tests/F17-aceite.test.ts:109` — `expect(noArmazem['timber']).toBeGreaterThan(40)`
     recebe **27**. Pior que a de cima: o timber não fica parado, **cai de 40 para
     27** — a vila gasta tábua nas obras e não repõe nenhuma. O marco da Fase A
     deixa de fechar.
- **A geometria, corrigida**: a nota antiga dizia "12 tiles" para os dois casos, e
  **12 é o número do oráculo**. Medido tile a tile: os lenhadores do oráculo
  (18,34 e 22,34) têm 0 árvore em alcance 6, 8 e 10, **7 em 12**, mínimo **11**;
  os da abertura da Fase A (9,31 e 12,31) têm **0 até o alcance 12** e precisam de
  **14** para ver **uma** árvore (13 em 16, 38 em 20). Armazém em (29,30); a
  árvore alcançável mais perto dele é (37,23), a **8**.
- **A pergunta que a fila não responde sozinha**: *onde a abertura da Fase A
  planta o lenhador, agora que ele precisa de mata a 12 tiles da vila?* Consertar
  é **mudar a geometria da abertura** (`tests/helpers/abertura.ts`, com a
  invariante escrita de "altura igual nos quatro" e a rua reta até a escola):
  a pedreira quer o lajedo da vila e o lenhador quer a mata. Isso não é
  não-regressão de fixture, é **redesenhar o aceite do marco F17** — e marco é
  decisão do operador (CLAUDE.md §12 e §14).
- **As três saídas possíveis, para ele escolher** (nenhuma implementada), agora
  com o custo medido de cada uma:
  - **(a) mover a abertura da Fase A para perto de uma capoeira**, reescrevendo a
    invariante de geometria junto. **É a mais barata das três, e por uma margem
    que a nota antiga não mostrava**: existem **2 946** posições legais (`canPlace`)
    com árvore alcançável em **alcance 6, o de hoje**. As mais próximas do armazém
    ficam a **3 tiles** — (29,27) com 1 árvore, (30,27) com 2, (31,27) com 3,
    (32,27) com 5 — e (33,27) a 4 tiles com 8. Para uma mata que sustente a
    serraria: **(18,41) a 11 tiles com 12 árvores**, e (17,44)/(18,44)/(19,44) a
    **14 tiles com 27/24/20**. Não mexe em alcance nem em mapa; o preço é a rua
    mais comprida e a invariante de "altura igual nos quatro" reescrita.
  - **(b) dar ao lenhador alcance maior que 6.** A medição **derruba esta saída
    como estava escrita**: 12 resolve o oráculo (7 árvores) e **não resolve a
    abertura da Fase A**, que só vê árvore em **14**. Alcance 14 cobre boa parte
    da vila e torna a regra de alcance quase decorativa — e ainda assim entrega
    **1** árvore ao lenhador da abertura.
  - **(c) semear uma capoeira pequena na reserva da vila**: muda
    `tools/gerar-mapa.js` e **move tiles que fixtures já usam** — a mesma classe de
    efeito colateral que a F21b mediu nos lajedos (46 tiles de rocha viraram veio,
    `BALANCE_LOG.md` 2026-09-25).
- **DECISÃO DO OPERADOR, 2026-09-25: saída (a), mover a abertura.** O argumento
  dele, com o número da medição na mão: *"é a única que não mexe em alcance nem em
  mapa"* — a (b) tornaria a regra de alcance decorativa e a (c) move tiles que
  fixtures já usam. A posição se escolhe **pelo mesmo critério da F-D3**: a
  abertura tem de ter **mato, rocha e terra ao alcance, sem o jogador procurar**.
  E a cláusula dele, que decide o resto: *"se nenhuma posição tiver três coisas
  juntas, o gerador é que ajusta, não a vila"*.
- **Medido antes de mexer** (`test-output/F-T4b-para-onde-a-abertura-vai.json`):
  **o gerador não precisa ajustar — a vila resolve, mas não em fila única.**
  - A fila de hoje tem **13 tiles de largura**, com os dois lenhadores numa ponta
    e a pedreira na outra. Varrendo o mapa inteiro nessa forma: 14 720 posições,
    **10 880** onde a fila cabe, **1 745** com mata para os dois lenhadores e só
    **133** que também têm rocha para a pedreira. E as 133 não servem: a mais
    perto do armazém (a **7 tiles**) tem **1 árvore e 1 rocha**; a primeira com
    **≥ 5 de cada** está a **54 tiles**, com rua em L de **91 tiles** — contra os
    26 de hoje, num armazém que abre com **30 de stone**. Fila única está morta.
  - A causa é geográfica e simples: **o lajedo e a mata ficam em lados opostos da
    vila**. O lajedo da vila é a oeste (22..26 × 29..33, BUG-F) e a árvore
    alcançável mais próxima é (37,23), a **nordeste**. Nenhuma linha de 13 tiles
    alcança os dois; **dois grupos alcançam**.
  - **Separando, as três coisas estão juntas a 3–5 tiles do armazém** (que está em
    29..31 × 30..32): par de lenhadores em **(32,27) com 5 e 9 árvores** (3 tiles),
    **(33,27) com 8 e 9** (4), **(34,27) com 9 e 9** (5) — 2 167 pares legais no
    mapa; pedreira em **(26,27)…(29,27) com 12–13 rochas** (3 tiles) — 1 604
    posições legais. Terra arável não é restrição em lugar nenhum: **13 725 tiles**
    aráveis no mapa, 179–193 no raio de qualquer sítio medido.
- **A posição escolhida é REGRA, não coordenada.** O helper de hoje já deriva
  ("recua até caber"); a nova derivação mantém o estilo — a pedreira continua
  ancorada no lajedo a oeste e o **par de lenhadores passa a varrer para leste na
  linha de porta ao norte até a primeira coluna em que os dois tenham árvore
  alcançável**. Com o mapa publicado isso cai em (32,27). Nenhum número digitado
  em `.ts` ou `.js`.
- **Consequência medida, como o operador pediu** — *"os roteiros que plantam na
  abertura mudam de coordenada; meça quantos antes de mexer"*: **duas derivações**
  e **nenhuma coordenada fixa**. A geometria está escrita à mão em dois lugares que
  precisam continuar idênticos: `tests/helpers/abertura.ts` (headless) e
  `tools/shots/F17.js` (tela). Só elas citam `inicioDaFila`/`gyDaFila`. Os
  consumidores seguem de graça: `tests/F17-aceite.test.ts` tem **9 `expect` e
  nenhum nomeia a geometria** (ele afirma resultado — quatro completos, ocupados,
  ligados, timber entregue), e `tests/helpers/bodega-cenario.ts` deriva a própria
  posição a leste do armazém, sem depender da fila. O que **muda de texto** são as
  invariantes da fila única: "altura igual nos quatro" e "uma rua reta serve todos"
  deixam de valer, e é isso que a tarefa tem de reescrever, não coordenada.
  Cuidado já visto na medição: o par em (32,27) ocupa x32..37 na linha y27..29, e
  a linha de porta dele (y=30) cruza a coluna da escola (34..36) — `canPlace`
  aprova (a porta tem saída), mas a rua precisa contornar, e não é mais uma reta.
- **Armadilha da sonda, registrada para não custar duas vezes**: varrer a fila com
  `canPlace` dá **zero** posições em todo o mapa, e não por geometria — a
  `sawmill` nasce `bloqueado` (`desbloqueadoPor: woodcutters`) e só é plantada
  depois que uma casa de lenhador fica completa. Quem medir geometria tem de
  aceitar o motivo `'bloqueado'`; senão o resultado nulo parece resposta.
- **ENTREGUE 2026-09-25.** `woodcutters` ganhou `colheita { tree, alcance 6 }` e a
  abertura virou **dois grupos**, pela regra, não por coordenada. O que a sessão
  mediu e onde a evidência está:
  - **A geometria saiu de UMA cópia**: `tools/geometria-da-abertura.mjs` (+ `.d.mts`
    escrito à mão), com os predicados injetados pelo chamador — a sim do lado do
    headless, os JSON crus do lado do roteiro. `tests/F-T4b-geometria.test.ts` é o
    guarda das duas pontas, e ele **acusa** (o terceiro teste cega um predicado de
    um lado só e exige que a geometria mude).
  - **Onde a vila nasceu**: serraria (15,31) e pedreira (19,31), **as mesmas de
    antes**; par de lenhadores em **(34,27) e (37,27)**, com **9 árvores ao alcance
    cada um** — não (32,27), como a nota acima previa, porque a escolha é do MAIOR
    MÍNIMO e a rua precisa caber no orçamento (abaixo).
  - **O orçamento da rua, que quase derrubou a feature**: `PlaceRoad` é tudo ou
    nada e paga **à vista no tick 0**. A primeira rua em L custou **31 de pedra**
    contra **30** no armazém — o comando saiu `sem-pedra`, **nenhum** tile subiu e
    os quatro prédios ficaram completos e **desligados** para sempre. A correção
    não foi afrouxar: o que liga um prédio é **UMA porta dele ser estrada**
    (`predioLigadoAoArmazem`), então a rua encurtou para o mínimo e o módulo passou
    a **estourar** se ela não couber, com a reserva da primeira casa de lenhador e
    da pedreira descontada. Resultado: **26 tiles**, a mesma folga de 4 que a fila
    antiga tinha por acidente.
  - **As três reprovações, verdes sem asserção afrouxada**: F15a com a forma
    inteira da `colheita` (mais estrita que o `toBeNull()` que substituiu, e com um
    teste de classe novo para TODA `colheita` declarada); F15b com o oráculo
    derivando a posição dos lenhadores da mesma regra da abertura (ele tinha
    (18,34)/(22,34) digitados, com **0 árvore** ao alcance); F17 sem um toque —
    os 9 `expect` dele não nomeiam geometria, como a medição prometia.
  - **A perna nova** (`tests/F-T4b-lenhador.test.ts`, evidência em
    `test-output/F-T4b-lenhador.json`): partindo do estado inicial, o ocupante
    **anda** — ocupa no tick 499, reclama a árvore (39,22) a **5 tiles** do
    footprint, colhe encostado nela (Chebyshev 1, de tile pisável, com a árvore não
    pisável), primeira tora no **1247**, e entrega **3 toras e 2 tábuas** ao
    armazém. O teste (d) guarda a premissa: se a mata encostar na casa, ele reprova
    em vez de virar um sai-e-volta.
  - **O roteiro da tela** ganhou o ramo vertical (`arrastosDaRede`, o mesmo
    algoritmo de `arrastosDaRua` generalizado — a forma antiga agora **recusa**
    trecho vertical em vez de achatar) e o **passo despausado da §8** no primeiro
    pedido de treino. `screenshots/F17-5-final.png`: o par ao norte, a rua em L, os
    carregadores levando `tree_trunk` e o HUD com **41 de tábua** contra 40 iniciais.
- **Nota de herança**: quem pegar este item herda da F-T4a a regra de classe já
  provada, o predicado `tileAlcancavelParaColheita` e os números da árvore acima —
  e herda também que, ao contrário do peixe, **a árvore abre o anel seguinte ao
  ser cortada** (`tree.regime: porAcao`, quantidade 0 e tile andável), então o
  alcance útil do lenhador CRESCE com o uso. O aceite dele não pode afirmar
  contagem fixa de tiles ao alcance ao longo do tempo.

### F-T4d — O pescador sai para a água, em partida (ENTREGUE 2026-09-25)
- **Por que existe** (pedido do operador, 2026-09-25): o pescador tem `colheita` desde
  a F-T4a e a água existe desde a F-T1, mas ele só foi exercitado em FIXTURE (cabana
  injetada e ocupada à mão). *"Meça antes de planejar: ele anda até a margem? Colhe? O
  cardume esgota? E o que acontece com o prédio quando o último cardume ao alcance seca
  — o mesmo caminho do veio esgotado da F21b, ou outro? Se já funcionar inteiro, a
  feature é a medição e o guarda permanente."* Plano e números: `docs/planos/F-T4d.md`.
- **Medido em partida** (abertura + cabana por comando, posição derivada por `canPlace`
  e cardume alcançável, rendimento 1 por tile como na F-T4a): anda (sai em 2087), pesca
  DA MARGEM em (28,24), a Chebyshev 1 do cardume, tile andável e não água; o peixe chega
  ao armazém pela rua (2647); os **19** cardumes com margem secam (o último em 10744) e
  saem do estado. **E aí o caminho era OUTRO, e era defeito**: sobravam **12** tiles de
  interior de água ao alcance, que ninguém alcança, e `semRecursoAoAlcance` os contava
  como recurso — o pescador parava em `esperando_insumo` sem `vein-exhausted` e sem
  `veio-esgotado`. A escolha do tile (`especialistas.ts`) filtra por
  `tileAlcancavelParaColheita`; a pergunta do esgotamento não filtrava. Predicado de
  elegibilidade discordando de si mesmo nos dois lados — a classe da F-T2c, no eixo da
  aproximação.
- **Escopo entregue**: **três linhas de `sim/`** (`producao.ts`: `semRecursoAoAlcance`
  e `semTrabalhoAoAlcance` passam o mesmo `elegivel` da escolha; `recursos.ts`:
  `algumTileTrabalhavel` ganha o parâmetro, neutro por padrão) e o guarda
  `tests/F-T4d-pescador-em-partida.test.ts`, visto vermelho antes de cada uma das duas
  correções (evento, depois alerta).
- **Aceite**: (a) em partida, o pescador colhe da margem — tile a Chebyshev 1 do cardume
  reservado, andável, não água — e o peixe entra no armazém; (b) os cardumes com margem
  secam e **saem** de `state.recursos`; os de interior **ficam**; (c) no tick do último
  peixe o prédio emite `vein-exhausted` **uma vez**, diz `veio-esgotado`, o pescador fica
  no **mesmo** estado de espera do mineiro da F21b (afirmado contra aquele cenário, não
  contra o rótulo) e nada fica reclamado — o **mesmo caminho** da F21b; (d) em todo tick
  da corrida, `semRecursoAoAlcance` ⇔ a escolha do tile devolve `null`.
- **Evidência**: `test-output/F-T4d.json`.
- **Fora do escopo**: a fome da abertura (sem Bodega, os civis morrem no 12 000 — o teste
  para antes); o alerta `sem-campo` do Roçado (`algumTileTrabalhavel`), que tem a mesma
  forma e não filtra aproximação: milho se pisa, e é a nota herdada da F18.

### F19b — A segunda comida: Malhada e Casa de Carne (medir primeiro)
- **Posição na fila — decisão do operador, 2026-09-24**: **antes da F20**, com a
  razão escrita: *"O GDD §4.3 diz que civil só satura com pelo menos DUAS comidas
  diferentes, e hoje só o cuscuz fecha. A F20 depende disto."* E o item começou,
  como a F19, com uma tarefa de **MEDIR**, não de implementar: *"Comece medindo,
  como na F19: a cadeia pode já funcionar sem código novo. O escopo é o que
  faltar."*
- **Resultado da medição: nada faltou** (sonda da sessão, 20 000 ticks, cenário
  1 Fazenda : 1 Malhada : 1 Casa de Carne, ligado por estrada a um armazém, com 4
  serfs). Primeiro milho entregue no tick **546**, primeiro bode em **1984**,
  primeira carne de sol em **2276**, e no armazém em **2359**. Em 20 000 ticks:
  **61 milhos, 15 bodes, 15 couros, 42 carnes** — e a conta fecha sem sobra, porque
  a granja consome 4 milhos por bode (`pigs = ⌊61/4⌋ = 15`) e o açougue rende 3
  carnes por bode. A produção é genérica desde a F15a, a tarefa de insumo entre
  prédios existe desde a F15b, e **a gaveta de saída com DUAS mercadorias já era
  prevista** (`cabeNaSaida` soma a gaveta inteira: *"a granja enche a mesma gaveta
  com porco e couro"*).
- **Premissa conferida no dado**: o armazém da abertura **já abre com carne de
  sol** — `economy.json estadoInicial.estoque` traz `loaves: 15` **e**
  `sausages: 10`. A premissa do pedido é sobre **produção**, não sobre estoque: até
  aqui só a cadeia do pão fechava. Por isso todo número desta feature é medido
  **contra a linha de base do tick 0**; contra zero absoluto, o aceite passaria com
  o presente da abertura e não com uma carne produzida.
- **Escopo, portanto**: a prova, a evidência, e o que a medição expôs — nada além.
  `tests/F19b-cadeia-da-carne.test.ts` transforma a sonda em cobertura permanente
  (sonda prova o momento, §8), e `cenarioDaCadeiaDaCarne` (mais as duas variações
  negativas) entra no helper de produção. **Nenhuma linha de `src/`**: nem `sim/`,
  nem `render/`, nem `data/`.
- **Aceite** (todo marco derivado do dado, nenhum digitado):
  1. **a carne de sol chega AO ARMAZÉM, pelo caminho real**: partindo de
     `createInitialState` e da linha de base do tick 0, o saldo de `sausages` nos
     armazéns sobe — e nunca antes de
     `plantio + ciclo da fazenda + ciclo da granja + ciclo do açougue`, o piso que
     nenhum transporte pode furar. Nada é injetado em gaveta: o milho sai do tile,
     o serf carrega, e a carne entra no armazém por tarefa de transporte;
  2. **os dois elos do meio são reais**: a mesma vila **sem a Malhada** não produz
     uma carne (o milho se acumula no armazém e o carneador fica em
     `esperando_insumo`), e **sem a Fazenda** não nasce um bode. É o que impede o
     aceite de passar por um açougue que fabrique carne do nada — o defeito que a
     F18 encontrou na fazenda e a F19 no moinho;
  3. **nada se perde na cadeia**: o bode produzido cabe no teto que o milho permite
     (`⌊milho / entra.corn⌋`, derivado da receita) e a carne cabe em
     `sai.sausages × bode`; acima de 85 % do teto, que é a tolerância de
     **transporte** medida (deu 93 %), não de balanceamento;
  4. **o couro é saída de verdade, e não a única**: a granja enche a mesma gaveta
     com bode **e** couro (`unidadesPorCiclo === 2`) e o couro chega ao armazém
     junto. Uma receita de duas saídas que entregasse só a primeira passaria no
     critério 1 e cai aqui;
  5. **o jogador alcança a cadeia pela árvore**: na vila inicial `swine_farm` está
     bloqueada com `requer: 'farm'` e `butchers` com `requer: 'swine_farm'`; com a
     fazenda construída, a Malhada libera.
- **Evidência**: `test-output/F19b.json`
- **Sem screenshot, e o motivo é o da F18 e da F19**: nenhuma linha de
  `src/render/` muda, e o harness de captura não constrói prédio — Malhada e Casa
  de Carne estão atrás da Fazenda, que está atrás da Serraria.
- **Nota (o cenário NÃO é o oráculo, ao contrário da F19, e isso é medição)**:
  `proporcoesDeReferencia` pede **1,63 fazenda por Malhada** e **3 Malhadas por
  Casa de Carne**; o cenário é 1 : 1 : 1, mínimo que prova a cadeia. Medido:
  o criador passa **55 %** e o carneador **86 %** do tempo em `esperando_insumo`,
  e a razão real ficou em **2,19 fazendas por Malhada** (a fazenda entrega um
  milho a cada ~328 ticks e a Malhada quer um a cada 150) — mesma causa que a F19
  já registrou para o pão, o custo do plantio da F18. O elo que **não** depende da
  fazenda, `swine_farm_por_butchers: 3`, bate com a medição e continua de pé.
  Números vão para o `BALANCE_LOG.md`; **nenhum é ajustado aqui** (o lote é da F20).
- **Nota herdada para a F20 (escrita antes dela)**: `condition.json` traz
  `restauracaoPorComida.sausages: 0.60` contra `loaves: 0.40`, e a regra das duas
  comidas está em `regraCivil` como **prosa** — texto que nenhum sistema lê. A F20
  decide como a regra entra no dado; esta feature só garante que as duas comidas
  **existem produzidas**.
- **Fora do escopo**: o couro não tem consumidor construído. `tannery`
  (`skins → leather`) está no dado e liberada pela árvore, e a cadeia do couro é a
  **F24**. Aqui o couro só precisa chegar ao armazém sem travar a granja.

### F20 — Inn, fome e consumo
- **QUEBRADA EM TRÊS SUB-ITENS — F20a, F20b, F20c (decisão minha, 2026-09-24, para o
  operador revisar).** A F20 como escrita é de várias sessões, e a ordem entre as partes
  **não é preferência, é dependência medida**: `condition.json` dá 20 min efetivos de
  condição cheia para um civil na escala 2, o que são **12 000 ticks** a 10 Hz. Entregar o
  dreno antes de existir lugar para comer mata todo civil dentro da janela dos testes
  longos que já rodam (F19 a 12 000 ticks, F19b a 20 000) — não é risco, é aritmética do
  dado. Então a Bodega recebendo comida vem primeiro, sozinha e completa.
  - **F20a** — a Bodega recebe comida (só `src/sim/`). Não muda o comportamento de nada
    que exista hoje, porque **nenhum cenário atual tem Bodega**.
  - **F20b** — condição, dreno, comer na Bodega, morte e os três casos de "a unidade
    sumiu" (só `src/sim/`). Indivisível: dreno sem morte não fecha o aceite escrito, e
    morte sem os três casos deixa prédio com ocupante fantasma.
  - **F20c** — o marcador de fome no mundo (só `src/render/`), com screenshot.
  - **Consequência da quebra**: cada sub-item fica dentro de **uma** camada, então a
    exceção da §10 escrita abaixo **deixa de ser necessária** — o que é mais estrito que a
    nota, não menos. Ela continua valendo se o operador preferir reunir os itens.
- **Nota herdada da F19 (2026-09-24) — o prédio que para por falta de insumo é
  MUDO**: as causas da F22 são `sem-trabalhador`, `sem-estrada`, `veio-esgotado`
  e `sem-campo`. Uma padaria sem fubá não produz alerta nenhum, e a medição da
  F19 mostra por que a causa não é trivial: na cadeia calibrada, o moinho passa
  **26 %** e a padaria **29 %** do tempo em `esperando_insumo` — esse é o regime
  normal, não a falha. Uma causa nova precisaria de **limiar** (tempo parado, ou
  estoque zero na cadeia inteira), e limiar é desenho. **Decisão do operador**, e
  cai aqui porque é com a fome que o silêncio fica caro.

#### F20a — A Bodega recebe comida (sim)
O **nível 1** da escada de `delivery.json` (`comida-para-inn`, a prioridade mais alta de
todas) é o único que nunca teve implementação: o id está no dado desde a F03 e não há
gerador, tipo de tarefa nem leitor. Esta feature o escreve. A Bodega (`inn`, Taverna em
`theme-sertao.json`) já existe em `data/buildings.json` (4×3, timber 6, stone 5,
`desbloqueadoPor: storehouse`, `trabalhador: null` — ela não tem especialista e não tem
receita), e `data/condition.json` já diz quanto ela guarda:
`inn.estoquePorTipoDeComida: 5`, por **tipo** de comida.
- **Conferido no dado e no código (2026-09-24)**: `condition.json` chega ao carregador
  como `dados.condicao` (`src/sim/data/loader.ts:414-434`), e **nenhum sistema o lê** —
  esta feature é a primeira leitora de `inn`, como a F20b será a de `limiares`. A
  `capacidade` da Bodega é `{ entrada: null, saida: null }` (`state.ts:capacidadeParaTipo`:
  prédio sem receita e sem ser armazém não tem teto de gaveta), então **o teto de 5 vem de
  `condition.json`, não de `capacidade`** — e é isso que o alvo desta feature calcula.
- **Aceite 1 — o tipo novo entra nas tabelas exaustivas.** `nivelDoTipo('comida-para-inn')`
  é 1 e `modoDoTipo` é `estrada`, os dois lidos do dado; e o tipo aparece em
  `GAVETA_DE_ORIGEM_POR_TIPO`, `ORIGEM_ESPERADA_POR_TIPO` e `UNIDADE_ELEGIVEL_POR_TIPO`.
  As três são `Record` exaustivo: tipo novo sem linha **não compila**, e o guarda é
  estrutural, não textual.
- **Aceite 2 — a demanda é derivada, nunca digitada.** Para cada comida de
  `condition.restauracaoPorComida`, o alvo na gaveta `entrada` da Bodega é
  `condition.inn.estoquePorTipoDeComida`; para qualquer outra mercadoria (ouro, pedra,
  tronco) o alvo é **zero** e nenhuma tarefa nasce. O teste deriva a lista de comidas das
  chaves do dado e afirma o alvo contra o número do dado.
- **Aceite 3 — pelo caminho real, do estado inicial.** Partindo de `createInitialState`, o
  jogador planta a Bodega (`PlaceBlueprint`) e a rua (`PlaceRoad`), os 2 laborers a
  constroem com o timber e a pedra da abertura, e os serfs levam `loaves` e `sausages` do
  armazém até ela. Aceite: a gaveta `entrada` da Bodega chega a **5 de cada uma das duas
  comidas que a abertura tem** e **para aí** — não vira 6, nenhuma tarefa nova nasce, e o
  saldo do armazém cai exatamente 5 + 5 (conservação de bens). É caminho real de verdade,
  ao contrário do da F19b: a Bodega só pede `storehouse`, que já está de pé no tick 0.
- **Aceite 4 — a prioridade 1 é obedecida.** Com uma obra nivelada pedindo material
  (nível 3) e a Bodega vazia no mesmo tick, o serf ocioso escolhe a **comida**. Eixo
  determinístico: a ordem de `tarefasEmOrdem`, não tempo de relógio.
- **Aceite 5 — comida que não existe não gera tarefa.** `restauracaoPorComida` lista
  `wine` e `fish`, que não têm produtor nem estoque em nenhum cenário. Nenhuma tarefa nasce
  para elas — a tarefa só nasce com origem que **ofereça** (`origemMaisPerto` devolve
  `null`), e é o mesmo predicado que impede unidade esperando o que nunca chega.
- **Aceite 6 — o ramo de erro devolve a reserva.** Bodega demolida com serf em rota: a
  tarefa é cancelada, a reserva volta e a carga é devolvida ao armazém pelo caminho que
  `destinoQueRecebe`/`comecarADevolver` já dão — afirmado **para o tipo novo**, porque
  "toda tarefa reclamada precisa ter caminho de volta" (CLAUDE.md §5).
- **Não-regressão que esta feature tem de escrever** (a regra: o roteiro que afirma o texto
  substituído codifica o defeito). `tests/F18d-1a-modo.test.ts:32-39` afirma hoje, em
  comentário e **por omissão da lista**, que *"`comida-para-inn` (nível 1) ainda não é tipo
  de tarefa — nasce na F20"*. Esta feature **move `comida-para-inn` para dentro da lista
  dos tipos que existem** e apaga o comentário: a asserção nova é mais estrita, não só
  diferente.
- **Fora do escopo, e é o que sobra para a F20b**: ninguém **come**. A comida entra na
  Bodega, chega ao teto e fica lá. Nenhuma unidade tem `condicao`, nada dreno, ninguém
  morre. A Bodega também não ganha painel nem ícone — `render/` não é tocado.

#### F20b — Fome: condição, dreno, comer na Bodega e morte (sim)
Depende da F20a: sem comida na Bodega, o dreno é só uma forma lenta de matar a aldeia.
Indivisível — dreno sem morte não fecha o aceite escrito, e morte sem os três casos de "a
unidade sumiu" deixa prédio com ocupante fantasma.
- Restauração por tipo de comida e regra das duas comidas diferentes, conforme o
  GDD. Aceite: cenário longo em que a população sobrevive; cenário sem comida em
  que morre — e a morte é registrada em evento, não em log solto.
- **Nota**: **revisitar a carga do serf quando uma unidade puder morrer carregando.** Na F10 a carga
  vive em `fsmData.carga` e **se perde** com a unidade removida (o `sanearTarefas` cancela a tarefa
  `carregando` e o gerador recria; o teste afirma "exatamente 1 unidade perdida"). Decisão do
  operador: fica assim **por enquanto**, porque não existe item no chão e nenhuma unidade morre antes
  desta feature ou do combate. Esta feature decide se a carga cai no tile e é recolhida (item no chão,
  tarefa ou estado novo no GDD §6.2) ou se continua perdida — e ajusta o teste de conservação de bens.
- **A morte a 0 % está confirmada no GDD, em dois lugares** (conferido 2026-09-24):
  §2, linha 54 — *"Sem comida, os civis morrem"* — e §11.3, linha 795 — *"Alerta visual a
  35 %, o civil sai para comer a 50 %, morre a 0 %."* O dado concorda: `limiares.morte: 0.0`.
  Então **sim**: unidade que chega a 0 % morre, e isso não é interpretação.
- **O que "morrer" significa para quem estava no meio de alguma coisa** — três casos, e
  hoje **nenhum tem caminho**, porque nunca morreu ninguém. O saneamento que existe cobre o
  caso espelho ("o prédio sumiu": `sanearTarefas`, `sanearFilas`, `passoProduzindo`, ver o
  cabeçalho de `systems/demolicao.ts`). A morte estreia **"a unidade sumiu"**, e ele não existe:
  1. **O especialista dentro do prédio.** `predio.ocupante` guarda o **id** da unidade e é
     **fonte de verdade única** (`ocupacao.ts:59`, e o comentário de lá diz por quê). Morto o
     ocupante sem mexer no prédio, `ocupante` aponta para unidade que não existe: o prédio
     parece com trabalhador, não produz, e a vaga nunca volta ao mercado. A morte **tem** de
     zerar `ocupante` no mesmo tick.
  2. **O produtor no meio do ciclo** (o fazendeiro do pedido). Decidir se o progresso parcial
     do ciclo **se perde** (ciclo recomeça com o próximo ocupante) ou **fica** no prédio. E se
     o tile de campo reservado por ele volta ao mercado — se não voltar, terra arada fica
     presa para sempre.
  3. **O serf com pedra na mão.** Já está na nota da carga, acima: hoje a carga **se perde**,
     e a decisão do operador foi "assim por enquanto, porque ninguém morre". Esta feature é a
     que tira o "por enquanto".
  Os três entram no aceite como caso de teste separado, e o evento de morte que o aceite já
  pede é o que o render usa para o retorno na tela.
- **Custo que a quebra deixa visível, e entra no escopo desta feature**: os cenários longos
  que já rodam passam de 12 000 ticks (F19 a 12 000, F19b a 20 000) e **não têm Bodega**.
  Com o dreno ligado, os civis deles morrem e os testes das duas cadeias quebram. Adaptar
  esses cenários (Bodega abastecida, ou a decisão explícita de que aquele cenário roda com
  a fome desligada por dado) **faz parte desta feature**, e é a prova de que a fome é real:
  cadeia que continuava produzindo com todos mortos seria a evidência de que o dreno não
  chegou à unidade.
- **Como a condição é guardada (decisão a tomar, e a conservadora está escrita)**: em
  **ticks restantes** (inteiro), nunca em fração de ponto flutuante acumulada tick a tick —
  fração somada 12 000 vezes é erro de arredondamento entrando no determinismo. A fração
  que o GDD e os limiares falam (`0.50`, `0.35`) é **derivada** na leitura
  (`ticksRestantes / ticksDeCondicaoCheia`), e os limiares viram inteiro **uma vez, no
  carregamento**, com `Math.round`, como manda a §5.
- **A regra das duas comidas, conferida no dado**: `restauracaoPorComida` dá
  `wine 0.30`, `loaves 0.40`, `fish 0.50`, `sausages 0.60` — o **máximo de uma comida só é
  0.60**, e `loaves + sausages` dá exatamente **1.00**. Então a leitura conservadora, e a
  única que o dado sustenta, é *"cada tipo de comida contribui a sua restauração no máximo
  uma vez por refeição"*: o civil só enche 100 % com duas comidas diferentes porque nenhuma
  sozinha chega a 1.0, e não por uma regra escrita à parte. `regraCivil` e `regraMilitar`
  são **prosa** em `condition.json`, que nenhum sistema lê; esta feature decide se a prosa
  vira campo lido ou se o número já responde. Se o dado não sustentar o que o GDD diz,
  **vale o dado** e a divergência é registrada.

#### F20c — Marcador de fome no mundo (render)
Depende da F20b: o marcador lê `unidade.condicao`, que só existe depois dela. Só
`src/render/` — e por isso a exceção da §10 escrita abaixo não é usada.
- **Como o roteiro chega a um civil com fome**: `window.__cangaco.avancar(n)` (o mesmo
  gancho que todo roteiro usa) adianta os milhares de ticks com o laço pausado, sem
  depender de tempo de parede. Se a corrida ficar longa demais para o roteiro, a
  alternativa é um cenário de captura com a condição semeada — **nunca** um número de
  limiar digitado em `.ts`.
- **Retorno visual que falta — marcador de fome no mundo, sobre a unidade** (pedido do
  operador, 2026-09-24). Não basta o alerta do HUD: o jogador precisa ver **quem**
  está passando fome, no mapa. **Não é marcador permanente** — todo civil fica com
  fome o tempo todo, e ícone sempre aceso vira ruído. Ele aparece **a partir de um
  limiar**, e o limiar vem de `data/condition.json`, nunca de número em `.ts`.
  - **Conferido no dado (2026-09-24)**: `condition.json` → `limiares.alertaVisual: 0.35`,
    `limiares.civilVaiComer: 0.50`, `limiares.morte: 0.0`. São os 35 % e 50 % do pedido,
    e hoje `limiares` **chega ao carregador** (`data/loader.ts:429`) mas **nenhum sistema
    o lê** — esta feature é a primeira leitora.
  - **O que a ordem dos dois números significa, e é decisão a tomar**: a condição cai de
    100 a 0, então ela cruza **50 % primeiro** (sai para comer) e **35 % depois**. Com
    `alertaVisual` abaixo de `civilVaiComer`, o marcador **não** é "ele vai comer" — é
    "ele foi e não conseguiu", ou seja, marcador de **falha de abastecimento**. Isso é o
    que dá a propriedade de não virar ruído, e contradiz a frase do **GDD §7 (linha 727)**:
    *"Fome: ícone sobre a cabeça do civil antes de ele sair para comer."* Uma das duas
    está errada. Interpretação conservadora a implementar: **vale o dado** (35 %,
    marcador de falha), e a frase do GDD é que se corrige — mas **decisão do operador**.
  - **Exceção da §10 escrita ANTES do código**: esta feature **é de integração** e pode
    tocar `src/sim/` e `src/render/` no mesmo commit. A razão: o dreno da condição, o
    consumo no Inn e a morte são sim; o marcador sobre a cabeça é render, e lê o mesmo
    `unidade.condicao` que a sim acabou de escrever. Separar em duas features deixaria a
    primeira sem retorno visível nenhum.
  - Aceite do marcador: unidade acima do limiar **não** tem marcador; a mesma unidade
    abaixo dele tem; e **screenshot** — é mudança de tela (§8). O roteiro roda pelo
    menos um passo despausado se tocar em `#hud` ou `#alertas`.
  - **Nota (o que a F20c NÃO fez, e por quê — 2026-09-25, decisão minha para o operador
    revisar)**: a causa **`fome` no HUD** ficou de fora. A Nota da F22 diz que "quem fizer
    F20 ou F28 acrescenta causa em `CAUSAS_DE_ALERTA`, derivação em `temCausa` e o rótulo
    em `theme-sertao.json: alertas.causas`", e isso é `src/sim/` **mais** `src/ui/` — duas
    camadas que este item exclui por escrito ("Só `src/render/`"). Não estendi a exceção
    da §10 por conta própria: exceção vale escrita antes do código, e esta foi escrita para
    a F20 inteira, que o próprio operador quebrou em três itens de uma camada cada. Além
    disso o alerta do HUD é por **prédio** (`alertasDoEstado` varre `predios.ordem` e
    devolve `{predio, tipo, causa}`), e fome é de **gente** — ou o alerta ganha entidade
    nova, ou a causa entra torta. **Falta item na fila**, e ele é de desenho, não mecânico.
  - **Entregue em 2026-09-25**: `src/render/marcador-de-fome.ts` (reexporta `emAlertaDeFome`,
    identidade provada no teste), rótulo em `theme-sertao.json: marcadores.fome`, campos
    `marcadorDeFome` e `fracaoDeCondicao` em `UnidadeRenderizada`,
    `tests/F20c-marcador-de-fome.test.ts` e `tools/shots/F20c.js`. A frase do **GDD §7
    linha 727** já tinha sido corrigida pelo operador em 2026-09-24 a favor do dado.
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
  **Corrigido em 2026-09-24, e a correção importa para quem pegar este item**: a
  camada de terreno ganhou dono na fila (F-T1/F-T2), e *"só o inicializador
  muda"* virou **meia verdade** — com o recurso no tile, quem decrementa deixa de
  ser o ciclo de produção e passa a ser a colheita. Quando esta feature for pega,
  o veio do prédio **já não existe**: ouro, carvão e ferro herdam a camada da
  F-T2 prontos, e **esta feature encolhe** para o metalúrgico e a cadeia do
  ouro.
- **Nota (achado da F16a, 2026-09-23)**: enquanto o veio for semeado na
  **conclusão da obra**, demolir e reconstruir a Quarry sobre o mesmo tile
  devolve o veio **cheio** por metade do custo de construção
  (`buildings.construcao.devolucaoAoDemolir = 0.5`). O tamanho:
  `production.json` dá `quarry.veio.rendimento = 200` — 200 pedras renovadas
  de graça, não um detalhe. **É esta feature que decide** se o veio passa a ser
  do terreno; se passar, o exploit some sozinho. A F16a não é dona disso e não
  mexeu.
  **Dono definido em 2026-09-24: é a F-T2**, não esta. O veio passa para o tile,
  o exploit morre sozinho, e a asserção que prova a morte é a primeira perna do
  aceite de lá. A entrada correspondente sai do `IDEIAS.md` no commit da F-T2.

- **Corrigido de novo em 2026-09-25, e desta vez conferido em arquivo**: a
  premissa acima — *"ouro, carvão e ferro herdam a camada da F-T2 prontos"* — é
  **falsa**. Verificado: `data/resources.json` declara só `rock`, `tree`, `fish`
  e `corn`; o mapa emitido por `data/maps/sertao-128.json` carrega só `rock`,
  `tree` e `fish`; `data/production.json` dá `gold_mine.colheita === null`, e sem
  `colheita` na receita não existe tile de onde tirar. O campo
  `PredioCompleto.producao.veio` **também não existe mais** (removido pela
  F-T2a: o total foi para o tile). Nada de veio foi herdado — só a cadeia. A
  mina de hoje produz para sempre, e essa perna virou a **F21b**.
- **Escopo (decisão minha, 2026-09-25, marcada para o operador revisar)**: medir
  antes de escrever, como na F19/F19b. A sonda `tests/zz-probe-F21.test.ts`
  mostrou que a cadeia `gold_mine` + `coal_mine` → `metallurgists` → escola
  **já fecha sem uma linha de código novo**: primeiro carvão no tick 250,
  primeiro minério em 300, primeiro ouro fundido em 981, ouro no armazém em
  1030. Então a entrega desta feature é o **guarda permanente** da cadeia mais o
  registro honesto do que não fecha — não inventei a mina que esgota nem dado de
  minério que ninguém produz.
- **Aceite** (o que o teste afirma, em `tests/F21-cadeia-do-ouro.test.ts`):
  1. partindo de **ouro zero no mundo inteiro** (o estoque de abertura é zerado
     na gaveta `saida` do armazém), rodar a cadeia faz o ouro aparecer no
     armazém sem nenhum comando além do posicionamento, com minério e carvão
     também em trânsito, e as invariantes do JobBoard limpas no fim;
  2. o primeiro ouro do mundo está **dentro da metalurgia**, não no armazém —
     quem fabrica é ela;
  3. **contra-exemplo nos dois lados**: sem a mina de carvão o ouro fica em 0 com
     minério sobrando, e sem a mina de ouro fica em 0 com carvão sobrando. As
     duas entradas são obrigatórias;
  4. a escola treina um `stonemason` pagando com ouro **minerado** — contagem de
     pedreiros 0 → 1 e exatamente 1 de ouro a menos no mundo.
- **Evidência**: `test-output/F21.json` (linha de base, marcos, estoques no tick
  4000, os dois contra-exemplos e a seção `oQueNaoFecha`). **Sem screenshot**: o
  HUD já mostra `gold` desde a F05b e nenhuma linha de `src/render/` ou
  `src/ui/` foi tocada — a feature é só de `sim/` + teste.

### F18h — Terra de plantio desenhada pelo jogador (sim + dado)
- **Origem — decisão do operador, 2026-09-25**, que REVOGA a premissa da F18 (o
  campo derivado do terreno do mapa). O diagnóstico medido está em `PROGRESS.md` e
  o plano inteiro em `docs/planos/campo-desenhado-pelo-jogador.md`; o número que
  decidiu: no mapa publicado **nenhuma** posição a menos de **37 tiles** do armazém
  tem tile arável ao alcance da receita, então a fazenda da abertura não podia
  produzir em lugar nenhum perto da vila. Passa **à frente da F21b** por decisão do
  operador: *"fazenda que não pode ser construída é bug de jogabilidade; mina que
  não esgota ninguém sentiu"*.
- **Escopo — o jogador manda arar, o obreiro ara.** O molde é a estrada, peça por
  peça, e nenhum mecanismo novo:
  1. **dado**: `resources.json: tipos.<t>.aradura = { terrenoPermitido, segundos_base }`.
     Tipo **sem** `aradura` não se desenha; hoje só o `corn` tem. A duração vira tick
     uma vez, no carregamento, e o caminho se registra em `tools/data-schema.js`
     (uma linha por tipo, como a `reposicao` já faz).
  2. **estado**: `state.camposPlanejados: Readonly<Record<string, string>>` — o
     canteiro do campo, irmão de `estradasPlanejadas`. Guarda o **recurso** por tile
     (e não `true`) porque a ferramenta é por cultura, e a cana vai usar o mesmo
     canteiro sem um segundo campo de estado.
  3. **comando**: `PlowField { recurso, tiles }`, irmão de `PlaceRoad` — um arrasto
     é um comando, tudo ou nada, recusa emite `command-rejected` com motivo e tile.
  4. **tarefa**: `'arar'`, nível **9** de `delivery.json`, modo `livre`, só do
     laborer, **uma por tile planejado**. Sem `mercadoria` e sem `origem`: o milho
     não custa nada (GDD §5.4), e reserva de material sem material a reservar seria
     caminho sem consumidor.
  5. **fim do ciclo**: o tile sai do canteiro e entra em `state.recursos` como
     `{ tipo, quantidade: quantidadeInicial }` — pousio. Daí em diante o ciclo do
     roceiro (F18 + F-T3) corre **intocado**: plantar, crescer, colher, pousio.
- **O ajuste do gerador vai JUNTO deste item** (exigência do operador: *"sem ele a
  ferramenta resolve metade do problema"*): `tools/gerar-mapa.js` passa a emitir uma
  mancha pequena de `campoArado` dentro do quadrante da vila, pelo molde e pelo
  motivo do `LAJEDO_DA_VILA` da F-D3 — a partida tem de abrir com o que arar à vista,
  como abre com o que cortar. As duas manchas grandes **ficam** (decisão do operador:
  elas são terra já arada e dão razão para explorar o mapa).
- **Aceite**, três pernas:
  - **(a) a fazenda do operador passa a produzir.** No cenário real dele
    (`cenarioDeFazendaSemCampo`: mapa `sertao-128`, fazenda na vila, roceiro dentro,
    ligada por estrada, alerta `sem-campo`), um `PlowField` sobre tiles de grama ao
    alcance dela faz o alerta sumir e o milho aparecer. O teste afirma a
    **transição**: no tick do comando, zero milho e `sem-campo` presente; depois,
    milho > 0 e `sem-campo` ausente. Nenhuma mancha do mapa participa — os tiles são
    grama que o jogador mandou arar.
  - **(b) as recusas e o caminho de volta.** Fora do mapa, terreno que a `aradura`
    não admite, recurso em cima, prédio em cima e estrada em cima **recusam** com o
    motivo nomeado e **não** sujam o canteiro; e tarefa de arar cujo tile saiu do
    canteiro cai com `'destino-sumiu'`, com o laborer voltando a `ocioso` — o mesmo
    caminho de volta que a estrada já tem.
  - **(c) o gerador resolve a abertura.** No `sertao-128` regravado existe posição de
    fazenda a **menos de 15 tiles** do armazém com tile arável ao alcance, medida
    pelo mesmo predicado que a produção usa (hoje a mais próxima está a 37). O teste
    mede a distância e a escreve na evidência.
- **Evidência**: `test-output/F18h.json` (com a distância medida da perna (c) e o
  tick em que o primeiro milho entrou na gaveta).
- **Nota (as quatro decisões do operador, 2026-09-25, e o porquê de cada uma)**:
  1. **as manchas do mapa ficam** — custo zero em teste (tirá-las custaria 16
     arquivos / 33 testes, medido) e função de design: terra já arada é razão para
     explorar;
  2. **o campo passa à frente da F21b**;
  3. **o id neutro da cultura da cachaça é `grapes`**, não `cane` — trocar obrigaria
     a mexer em `wineyard` e `wine`, e o id neutro é da simulação, não do tema (o
     tema já escreve "Cana");
  4. **quem paga o material por tile é o laborer que ara**, no mesmo movimento do
     assentar estrada, e não o especialista replantando — é o molde que já existe, e
     mantém "o jogador manda, o obreiro faz".
- **Nota (a cana NÃO entra aqui, e o que ela espera é o Canavial)**: conferido no
  dado — `production.json: wineyard` é `entra: {}` / `sai: { wine: 0.5 }`, **sem
  `colheita`**. Tile de cana não teria colhedor e o prédio fabricaria cachaça do
  nada. O que a cana espera é o **Canavial virar consumidor**, e **não** a F18g (que
  segue adiada por outro motivo): há dois caminhos já publicados que cobram material
  por tile sem carregar nada — a estrada (reserva na gaveta `saida` e debita ao
  assentar, `sim/estradas.ts:404-442`) e o plantio (`reposicao.custo` cobrado da
  gaveta `entrada`, `systems/especialistas.ts: iniciarPlantio`). **Contrato para o
  item do Canavial, quando ele for escrito**: `grapes` ganha `aradura` com custo por
  tile, e o pagamento é a reserva-e-débito do laborer, decisão 4 acima. Esta nota se
  muda para o item dele no dia em que ele nascer.
- **Nota (`ehTarefaDeAssentamento` deixa de classificar por FORMA)**: o doc de
  `TarefaAssentarEstrada` avisava que "um segundo tipo com `destinoTile` passaria a
  ser lido como tarefa de estrada em `sanearTarefas`, no claim e no verificador". A
  `'arar'` é esse segundo tipo. O predicado passa a ser por **tipo**, com um irmão
  `ehTarefaDeAradura` e um `ehTarefaDeTile` (a forma) onde os dois querem a mesma
  coisa — a viagem até o tile. Não é refatoração ampla: é o guarda que o próprio
  arquivo mandou consertar antes de acrescentar o tipo, e o compilador aponta cada
  site que assumia a equivalência.
- **Nota (o alcance da colheita passou a perguntar ao ESTADO, e não ao mapa)**:
  descoberto durante a implementação, com o tile virando milho e o alerta `sem-campo`
  ficando na tela. `tilesDeColheita`/`tilesDeColheitaNaCaixa` filtravam os candidatos
  por uma camada derivada de `dados.mapa.recursos[tipo]`, memoizada por `GameData` —
  o retrato de `state.recursos` no tick 0. Com o campo desenhado em tempo de partida
  esse modelo fica errado por construção: o tile arado nasce no estado sem nunca ter
  estado no mapa, e a fazenda não o veria nunca. As duas funções passam a receber
  `state` e a filtrar por `state.recursos[k]?.tipo`; o que continua memoizado é a
  **moldura** (a caixa + alcance, que é do mapa e não muda). Custo por chamada: de
  O(1) para O(tiles da moldura), uma consulta de objeto por tile, sem realocar a
  moldura. No tick 0 a resposta é idêntica à antiga — `recursosIniciais` é exatamente
  a camada do mapa —, e é isso que a suíte inteira verde comprova.
- **Depende de**: nada além do que está de pé (F18, F18d-1b, F-T2c, F-T3).

### F18i — A terra de plantio na tela (render + ui + input)
- **Escopo**: a ferramenta que a F18h tornou possível fica **visível e clicável**.
  Molde da estrada, do mesmo jeito: uma ferramenta nova no menu Construir ao lado de
  Estrada, arrasto 8-conectado (`input/arrasto.ts`), um arrasto = um `PlowField`
  (`input/colocar.ts`, `ModoDaFerramenta`), e uma camada de **tile planejado**
  distinta do campo pronto (`render/`).
- **Feature de INTEGRAÇÃO, e por isso toca `sim/` e `render/` no mesmo item**
  (exceção da §10, escrita aqui antes do código). O que entra em `sim/` é **só** a
  borracha: **decisão do operador, 2026-09-25** — *"A borracha entra na F18i, não vira
  item novo. O jogador vai errar o traçado do campo como erra o da estrada — e a
  estrada tem `DemolishRoad` desde a F08. Ferramenta de criar sem ferramenta de
  desfazer é armadilha, e a assimetria entre as duas seria arbitrária para quem
  joga."* Escopo mínimo dele: **`UnplanField { tiles }`** desfaz tile de campo
  **PLANEJADO**, exatamente como o ramo DESENHADO do `DemolishRoad` — sai do canteiro,
  devolve zero (nada foi gasto), nunca é recusado, tile sem canteiro é no-op, e a
  tarefa de arar perde o destino e cai em `sanearTarefas` com `'destino-sumiu'`, que é
  o caminho de volta que a F18h já publicou e testou. **Campo já arado NÃO se apaga**:
  é recurso do tile, e recurso não se remove por comando — a mesma regra que vale para
  a rocha. Por isso o comando se chama `UnplanField` e não `DemolishField`: o nome diz
  o que ele alcança.
- **A lista de ferramentas vem do DADO, não de um literal**: uma por tipo de
  `resources.json` com bloco `aradura`. Hoje isso desenha **uma** — a terra de milho.
  Botão morto para a cana não nasce (ela não tem colhedor; ver a Nota da F18h), e no
  dia em que o Canavial entrar a ferramenta dele aparece sem ninguém tocar em `ui/`.
- **Aceite**: o roteiro afirma, no mesmo cenário, **planejados** subindo no arrasto e
  **campo pronto** subindo depois, com a soma fechando — a mesma asserção estrita que
  a F18d-2 usa para a estrada. Screenshot com os dois estados na mesma tela. E a
  borracha, no mesmo roteiro: um arrasto com ela sobre tiles planejados **derruba o
  canteiro** e **não** mexe no campo já arado, com a mesma soma conferida.
- **Aceite da borracha em `sim/`, headless**: `UnplanField` sobre tile planejado
  esvazia o canteiro e derruba a tarefa com `'destino-sumiu'`; sobre tile já arado é
  **no-op** (o recurso fica); sobre chão vazio é no-op; e o laborer que estava arando
  volta a `ocioso` sem violar invariante.
- **Evidência**: `test-output/F18i-shot.json` + `screenshots/F18i-*.png` +
  `test-output/F18i.json` (a perna headless da borracha)
- **Nota (§8 — o roteiro toca `#menu-build`, então roda despausado)**: pelo menos um
  passo faz `press('p')`, `mouse.down` / `waitForTimeout(150)` / `mouse.up` e pausa de
  volta. `page.click()` em página pausada não exerce o gesto do jogador, e foi assim
  que o BUG-B passou por todo roteiro existente.
- **Depende de**: F18h.

### F21b — A mina esgota: minério no tile (sim + dado)
- **Por que existe**: a F21 fechou a cadeia do ouro, mas `gold_mine`,
  `coal_mine` e `iron_mine` **produzem para sempre**. O contrato herdado da F15a
  dizia que o veio viria pronto da F-T2; não veio (ver a nota corrigida da F21).
  Esta é a dívida, escrita para não virar folclore.
- **O que falta, em três pedaços**:
  1. **dado**: `data/resources.json` não tem tipo de minério. Precisa de
     `gold_ore`, `coal` e `iron_ore` como recurso de tile, com rendimento e
     regra de reposição (minério **não** repõe, ao contrário da árvore);
  2. **mapa**: `tools/` não emite nenhum tile de minério em `sertao-128.json`. A
     montanha tem 453 tiles e hoje é só obstáculo;
  3. **receita**: `production.json` precisa de `colheita` nas três minas, e aí o
     mineiro passa a sair do prédio — a caminhada já existe desde a F-T3, é de
     classe e vem do dado.
- **Pergunta de design RESPONDIDA pelo operador em 2026-09-25: só os adjacentes,
  nunca o tile sob o prédio.** O argumento dele é que o BUG-F já respondeu: desde
  a correção de 2026-09-24 a construção é **recusada sobre recurso que bloqueia**
  (`src/sim/placement.ts:108`, `recursoBloqueiaConstrucao`, bandeira por tipo em
  `data/resources.json`). Se o minério nascer com `bloqueiaConstrucao: true` —
  como a rocha e a árvore —, **nenhuma mina pode ser plantada em cima dele**, e
  colher o tile de baixo seria colher um tile que não pode existir. A mina fica
  igual à pedreira: colhe o que alcança em volta.
- **Posição na fila, decidida pelo operador em 2026-09-25: é a PRÓXIMA**, antes da
  F23b. O porquê dele: *"hoje o garimpo produz do nada — é a última
  inconsistência do módulo de recursos, e a mesma que a F-T2a corrigiu na
  pedreira"*.
- **Depende de**: nada além da F21. **Não** depende da F23.
- **Escopo**: `dado + mapa`. `src/sim/` **não é tocado** — colheita já é regra de
  classe desde a F-T3, e o alerta `veio-esgotado` já sai de `fonteSemTrabalho`
  (`sim/selectors.ts`) para todo recurso sem `reposicao`. `src/render/` e
  `src/ui/` também não: a cor do tipo novo sai de `theme-sertao.json:recursos` e
  o nome de `theme-sertao.json:plantaFantasma.recursos`, os dois lidos por
  código que já existe. O minério mora **na montanha** e só nela: todo tile de
  `rocha` já tem `rock` (298 de 298), e veio solto na grama seria recurso
  bloqueando construção no meio do pasto.
- **Aceite**: com uma mina plantada ao lado de um veio, o painel dela diz
  quantos tiles de minério há ao alcance e quantas unidades sobram; a mina
  produz, e o total no mapa **cai** na mesma medida do que ela entregou (medido
  contra a linha de base do tick 0, não contra zero); com o veio zerado a
  entrada **sai** de `state.recursos` (regime `nunca`), a mina para e o HUD da
  F22 acusa `veio-esgotado` **sem o jogador clicar nela**; `canPlace` recusa a
  mina sobre o veio. Guarda estrutural: todo tipo de recurso tem **cor e nome no
  tema** — hoje a falta só aparece quando o render carrega.
- **Evidência** (nomes corrigidos ao fim da sessão: a medição saiu em quatro
  arquivos, um por perna do aceite, e não em um `F21b.json` único):
  `test-output/F21b-veios-no-mapa.json` (o minério semeado é alcançável),
  `test-output/F21b-mina-esgota.json` (o que ela entrega sai do chão),
  `test-output/F21b-veio-esgotado.json` (veio zerado → mina para e alerta),
  `test-output/F21b-recusa-sobre-o-veio.json` (`canPlace` recusa) +
  `test-output/F21b-shot.json` + `screenshots/F21b-*.png`
- **Nota (Escopo, Aceite e Evidência foram escritos na sessão da F21b,
  2026-09-25)**: o item só tinha Por que existe, O que falta, a Pergunta de
  design e a Posição na fila. Os três blocos acima são interpretação da linha
  "o que falta", pela leitura mais conservadora (§14) — mesmo precedente da Nota
  da F22. O resto do item está intocado. Plano em
  `docs/planos/F21b-mina-esgota.md`.
- **Nota (premissa da pergunta de design, 2026-09-25)**: a resposta do operador
  ("só os adjacentes, nunca o tile sob o prédio") vale inteira, mas o argumento
  dela — minério com `bloqueiaConstrucao: true` — não é o que a faz valer.
  `canPlace` confere **terreno antes de recurso** e montanha é intransponível:
  a recusa acontece uma linha antes, e a bandeira nunca seria lida. O minério
  nasce com `bloqueiaConstrucao: false`, pelo mesmo `_doc` que o `fish` já tem
  para o cardume na água (duas regras para o mesmo fato divergem na primeira
  mudança). **Fechado em 2026-09-25: o operador aceitou a correção** — "recusa
  sai em `terreno`, meu argumento do BUG-F não se aplicava ao veio" — e pediu que
  ficasse escrito que **a premissa era dele**, não uma leitura minha do que ele
  teria dito. A decisão dele ("só os adjacentes") nunca esteve em dúvida; o que
  caiu foi o motivo, e o motivo é o que a próxima sessão herda.

### ~~F-T4c — Os três mineiros herdam caminhada~~ (ENTREGUE pela F21b, 2026-09-25)
- **Item criado já riscado.** Ele nunca chegou a existir como linha da fila: era a
  **terceira** da ordem de três que o operador deu em 2026-09-25 (1. F-T4,
  2. F21b, 3. "os três mineiros herdam caminhada"). Entra aqui para o histórico
  não perder a decisão — e entra riscado porque a F21b o consumiu: declarar
  `colheita` nas três minas fez a **regra de classe** da F-T3 agir sozinha, sem
  uma linha de simulação nova.
- **Medido, não inferido** (`test-output/F21b-mineiro-anda.json`, 2026-09-25): a
  pergunta do operador foi "confirme que os mineiros **andam** até o veio, não só
  que a mina produz". Os dois mineiros do cenário do ouro, tick a tick —
  **carvão**: ciclo de 293 ticks, FSM `indo_colher → colhendo → voltando →
  trabalhando`, **293 de 293 ticks fora do footprint da casa**, salto máximo de
  **1 tile por tick**, parou em (97,107) para colher o veio (98,106);
  **ouro**: 410 ticks, mesma sequência, parou em (92,99) para o veio (93,98), a
  **6 tiles** da porta no ponto mais distante. Nos dois, o tile onde o mineiro
  fica é **andável** e o tile do veio **não é** (serra), e a distância no momento
  de colher é **exatamente 1** — ele vai até a beirada, como o pescador da F-T4a
  vai até a margem.
- **Cobertura permanente, não só sonda**: a sonda foi apagada e virou o bloco
  **(8)** de `tests/F21b-mina-esgota.test.ts` (4 testes): sequência de FSM, salto
  ≤ 1 por tick, Chebyshev 1 ao veio reclamado durante `colhendo`, tile do mineiro
  andável e tile do veio não, mineiro fora do footprint — mais um teste **(d)**
  que afirma que a fixture continua exercitando caminhada (o veio está a mais de
  1 do prédio), para o caso não degenerar em "sai pela porta e volta" se o mapa
  mudar.

### F22 — Alertas do HUD
- Prédio sem trabalhador, sem estrada, fome, mina esgotada.
- **Escopo**: o jogador descobre que um prédio está parado **sem clicar nele**.
  Um seletor puro (`alertasDoEstado`, `sim/selectors.ts`) deriva a lista do
  `GameState` — nenhum campo novo, nenhum evento — e `src/ui/alertas.ts` a
  escreve em HTML sobre o canvas, traduzindo pelo tema. `src/render/` não é
  tocado. Só entram as causas com **produtor no dado publicado hoje**:
  `sem-trabalhador` (F14), `sem-estrada` (F08) e `veio-esgotado` (F15a).
- **Aceite**: com a pedreira completa e sem cabra treinado, o aviso aparece no
  HUD sozinho, sem seleção, com o rótulo do tema e a contagem; **pausar pelo
  painel apaga o aviso inteiro** e retomar o traz de volta; cortar a estrada
  acrescenta o segundo aviso sem tirar o primeiro. O jogo **abre sem aviso** e
  obra não alerta. Guarda estrutural: o conjunto de `CAUSAS_DE_ALERTA` é
  exatamente o que os cenários do aceite conseguem produzir, e exatamente o
  conjunto de rótulos do tema — causa sem produtor ou sem texto reprova o
  `npm run verify`.
- **Evidência**: `test-output/F22.json` + `test-output/F22-shot.json` +
  `screenshots/F22-*.png`
- **Nota (o critério acima foi escrito na sessão da F22, 2026-09-23)**: o item
  só tinha a linha de causas e as quatro Notas abaixo. Escopo, Aceite e
  Evidência são interpretação da linha de causas, pela leitura mais
  conservadora (§14) — registrada em `PROGRESS.md`. As Notas estão intocadas.
- **Nota (correção da Nota da F15a, medida na F22)**: "mina esgotada" **tem**
  produtor hoje, ao contrário do que se supunha ao antecipar o item:
  `data/production.json` dá `veio.rendimento: 200` à `quarry`, que é construível
  desde a Fase A. Por isso `veio-esgotado` entrou. E o alerta sai do **predicado
  do runtime** (`veioEsgotado`, `sim/producao.ts`), não de `veio === 0` como a
  Nota da F15a escreveu: é `veioEsgotado` que congela o ciclo, e ele reprova já
  em `veio < unidadesPorCiclo` — com receita de 2 por ciclo o prédio para com
  `veio === 1`, e alertar só no zero avisaria tarde.
- **Nota (o que ficou de fora, e para qual feature)**: `fome` não tem produtor
  antes da **F20** (não há consumo nem estado de fome) e `sendo atacado` não tem
  antes da **F28** (não há combate). Nenhuma das duas existe no código, nem como
  constante comentada — é a regra do `terreno` na F06. Quem fizer a F20 ou a F28
  acrescenta a causa em `CAUSAS_DE_ALERTA`, a derivação em `temCausa` e o rótulo
  em `theme-sertao.json: alertas.causas`; os três guardas já obrigam os três.
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
- **Nota (origem: F16c)**: todo alerta de "prédio parado" tem de ler
  **`predio.pausado`** e **não alertar em pausa deliberada** — o jogador que
  pausou sabe que parou; avisá-lo é ruído, e é o caminho mais curto para ele
  desligar os alertas. Cuidado com o rótulo: o especialista de um prédio pausado
  continua em `trabalhando` (a pausa não é estado de FSM), então nenhum alerta
  pode ser derivado do rótulo — só do campo, como "sem estrada" se deriva do
  predicado.
- **Nota (origem: F16b)**: o painel de prédio (`src/ui/painel-predio.ts`) já
  **mostra** as três causas por prédio selecionado — ocupante vago, prédio parado
  e as gavetas. O que falta aqui é o alerta **sem seleção**, no HUD: o jogador
  não pode precisar clicar em cada prédio para descobrir que um está parado. Reuse
  `painelDoPredio` (`sim/selectors.ts`) como a derivação por prédio; ele já separa
  `pedeTrabalhador` de `ocupante === null`, que é exatamente a distinção que o
  alerta precisa — **prédio que não pede trabalhador nunca pode alertar** "sem
  trabalhador", e por isso são dois campos e não um.
### F23 — Save e load
- Aceite: salvar num tick qualquer, carregar e rodar 500 ticks produz o mesmo
  estado que rodar 500 ticks sem salvar. É o teste que prova que a invariante 2
  continua de pé.
- Reusar `compararComESemSave` de `tests/helpers/determinism.ts`, criado na F02,
  com o estado povoado. Não escrever um segundo teste de save/load.
- **Nota (contrato herdado da F-T1, 2026-09-24)**: o terreno **não está no
  `GameState`** — ele vive em `GameData`, carregado de `data/maps/<id>.json`. O
  save precisa, portanto, guardar **qual mapa** a partida usava: `mapa: "<id>"`
  mais o **hash do arquivo**. Carregar um save com outro mapa (ou com o mesmo id
  e o arquivo editado) tem de falhar **na hora**, e não divergir 300 ticks
  depois, que é o modo de falha caro. O campo `hash` **não** foi criado na F-T1
  de propósito: dado sem leitor vira folclore, e o leitor é esta feature. Quem
  o escrever aqui gera o hash no **carregamento**, uma vez, a partir do texto do
  arquivo — nunca a cada tick.

- **ENTREGUE em 2026-09-25**: `src/sim/save.ts` (`salvar` → texto, `carregar` →
  estado ou erro com motivo) e `src/sim/data/hash.ts` (FNV-1a 32 bits). O hash do
  mapa nasce em `loader.ts:carregarMapa`, **uma vez no carregamento**, e virou
  `GameData.mapa.hash` — o campo que a F-T1 deixou de propósito para esta
  feature. O teste é `tests/F23-save-e-load.test.ts` (10 testes) e reusa
  `compararComESemSave` com o par `salvar`/`carregar` real no lugar do
  `JSON.parse(JSON.stringify(...))`, sobre o cenário da cadeia do ouro, salvando
  no **tick 301** (escolhido por condição: serf no meio de um passo, com carga e
  tarefa reclamada). Evidência: `test-output/F23.json`.
- **Nota (medida, e ela muda quem lê este item depois)**: o aceite escrito — 500
  ticks depois do load — **não pega tudo**. Medido em `tests/zz-probe-F23.test.ts`:
  ele reprova semente de rng trocada, passo pela metade zerado e carga perdida,
  mas **passa** com o JobBoard inteiro apagado, porque a vila regenera a tarefa e
  reconverge byte a byte. Quem pega essa perda é a igualdade **no instante do
  load**, que por isso virou asserção separada no mesmo arquivo. Quem mexer no
  teste no futuro: os dois eixos são necessários; tirar um abre um buraco medido.
- **Fora do escopo, por decisão minha (2026-09-25)**: **nada na tela**. O aceite
  escrito é de `sim/`, `src/ui/` e `src/render/` não foram tocados, e pôr botão
  exigiria a nota de feature de integração **escrita antes** (§10). O jogador
  ainda não salva partida pela tela: isso é a **F23b**.

### F23b — Salvar e carregar pela tela (ui + input)
- **Por que existe**: a F23 entregou o formato e a garantia, não o gesto. Hoje
  só um teste chama `salvar`/`carregar`; o jogador não tem como guardar partida.
- **Escopo previsto**: botão (ou tecla) no HUD que chama `salvar(estado)` e
  guarda o texto no `localStorage`, e outro que lê, chama `carregar` e substitui
  o estado do laço externo. O erro de `carregar` já vem com motivo em português
  pronto para virar aviso na tela — mapa trocado, mapa editado, versão velha.
- **É feature de integração** (`sim/` + `ui/`): a nota do §10 tem de estar escrita
  neste item **antes** de o código começar. Está: esta linha é ela.
- **Aceite previsto**: roteiro de Playwright que salva, recarrega a página, carrega
  e mostra a mesma aldeia; mais um passo **despausado** com `mouse.down` /
  `waitForTimeout(150)` / `mouse.up` no botão (§8), e screenshot.
- **Posição na fila, decidida pelo operador em 2026-09-25: DEPOIS da F21b.** O
  porquê dele: *"save funciona headless, e a tela é conveniência"* — a garantia
  já está entregue e testada na F23; o que falta aqui é o gesto.
- **ENTREGUE em 2026-09-26.** Não tocou em `sim/` nem em `render/`. O que entrou:
  - `Sessao.substituir`, que descarta a fila;
  - `src/arquivo-da-partida.ts`, puro e com a gaveta injetada: uma partida só, na
    chave `cangaco:partida`;
  - `src/ui/arquivo.ts`, com os botões **Guardar** e **Retomar**.

  Os botões ficam numa seção "Partida" **no topo da tela de ajuda (H), e não na
  barra**. O motivo é medido: com a prancha fechada, o lembrete e o carimbo, a barra
  de 1280 px chega a 1163, e os botões iam até 1364. **Fica assim por decisão do
  operador (2026-09-26)**, com a razão de design dele: *"salvar não é ação de jogo, é
  ação de sessão."* A barra é do jogo. Botão de sessão que surgir depois vai para a
  mesma seção da ajuda, não para a barra.
  - Teste: `tests/F23b-arquivo-da-partida.test.ts`.
  - Roteiro: `tools/shots/F23b.js`, com um passo despausado e a obra plantada antes
    de guardar.
  - Evidência: `test-output/F23b.json` e `screenshots/F23b-{1,2,3}`.

### F18g — A pedra da estrada vira carga que viaja (sim)
- **Escopo**: hoje a pedra da estrada **não viaja**: ela é reservada no armazém
  quando a tarefa `'assentar-estrada'` nasce e é debitada daquele mesmo armazém
  no tick do assentamento (`comOTileAssentado`). Esta feature troca isso pelo
  transporte visível do original: **tarefa de material com destino-tile**, o serf
  leva a pedra até o tile do canteiro, o **laborer espera no tile** até ela
  chegar, e o **débito acontece na entrega**, não no assentamento.
- **Aceite**: num cenário com rua desenhada, o teste afirma (a) que uma carga de
  pedra **existe em trânsito** (serf com `carga` a caminho do tile), (b) que o
  laborer **espera no tile** enquanto ela não chega, (c) que a pedra sai do
  armazém na **entrega** e (d) que a conservação de bens fecha com a pedra
  **parada no tile** contada.
- **Evidência**: `test-output/F18g.json`
- **Nota (por que a F18d-1b evitou isso, 2026-09-24)**: foi decisão registrada,
  não esquecimento. O item da F18d-1a já media o preço do destino-tile —
  `destino` é id de prédio em 59 ocorrências de `src/sim/`, 14 delas
  `predios.porId[…destino]` direto — e a F18d-1b pagou esse preço **só** para a
  tarefa do laborer, que não reserva vaga no destino nem entrega carga. A
  variante de **carga** com destino-tile é a parte que ficou de fora, e o aceite
  escrito da F18d-1b ("a pedra sai do armazém exatamente uma vez, no
  assentamento") descreve fielmente o que foi construído. **O aceite é que estava
  incompleto**: no original o transporte visível é mecânica, não decoração.
  Decisão do operador (2026-09-24), com o porquê dele.
- **Nota (o custo, medido em 2026-09-24)**: **~12 pontos de ramificação em 3
  arquivos de `sim/`**, mais um campo de estado e duas FSMs:
  - `sim/reservas.ts` (4): `reservadoNoDestino`, `demandaNoDestino`,
    `destinoEhArmazem`, `vagaNoDestino` — todos leem `predios.porId[t.destino]`;
  - `sim/systems/jobs.ts` (4): `motivoDoDestino` (já tem ramo de tile para
    `assentar-estrada`; ganha o de carga), elegibilidade, geração e a
    deduplicação por destino;
  - `sim/systems/serfs.ts` (4): as **2** chamadas de `portasDaTarefa` (tile não
    tem porta), a entrega — hoje três ramos, obra/escola/armazém, ganha o quarto
    — e o `task-completed`, que hoje carrega `destino` de prédio;
  - **1 campo de estado novo**: onde a pedra entregue descansa. O desenho barato
    é um mapa **paralelo** (`pedraNoCanteiro`), que deixa intactos os **31
    arquivos** que leem `estradasPlanejadas`; mudar o valor de `true` para objeto
    quebraria os 7 acessos `=== true` e todos os leitores;
  - **2 FSMs**: o laborer (hoje `esperando_material` **recusa** assentamento em
    dois `if` explícitos, e `passoIndoAoTile` vai direto a `martelando`) e o
    serf (o alvo deixa de ser porta de prédio);
  - **demolir ganha o 4º caso**: canteiro **com pedra entregue**. Hoje o canteiro
    devolve 0 porque nada foi gasto; a pedra no tile é física e tem de voltar —
    para qual armazém é decisão nova;
  - **conservação de bens**: `bensPorMercadoria`
    (`tests/helpers/serf-invariantes.ts:94`, **1** helper) passa a contar a pedra
    parada no tile; **7** arquivos de teste dependem dele;
  - **órbita de testes**: **89** testes nas suítes que tocam o caminho (F08 43,
    as cinco suítes F18d-1b 31, F18d-1a 8, F09-estrada-reserva 7). Nem todos
    mudam; os **2** do aceite da F18d-1b **invertem por definição**.
  - **De graça**: some o caso especial de `reservas.ts` — a reserva desde
    `'aberta'`, que existe hoje **só** para o assentamento. Com carga de verdade,
    a reserva volta a ser a normal, de reclamar.
- **Nota (não cabe em uma sessão — quebra proposta)**: entregar isto inteiro
  cruza estado novo, duas FSMs, o comando de demolir e ~89 testes em órbita.
  Proposta, **a confirmar pelo operador junto com a posição na fila**: **F18g-1**
  = a carga chega e descansa no tile (campo de estado, variante de carga com
  destino-tile, débito na entrega, conservação); **F18g-2** = o laborer espera no
  tile, a demolição do canteiro com pedra, e o aceite completo.
- **Nota (posição na fila — decidida pelo operador em 2026-09-24)**: **depois da
  Fase B inteira**, e por isso este item está no fim dela. O argumento dele, para
  que ninguém a puxe para frente sem decidir de novo: o **custo é de feature
  grande em `sim/`** (12 ramificações, 2 FSMs, ~89 testes em órbita) e o **ganho
  é visual** — as duas guardas medidas na sonda já impedem estrada de graça (sem
  pagador a tarefa não nasce; pagador que seca derruba a tarefa e o tile fica no
  canteiro). Fidelidade ao original importa, **mas não antes de o jogo ter
  comida**. Quem quiser antecipar, decide de novo e registra aqui.
- **Nota (quanto a F23 encareceu a F18g — medido em 2026-09-25, a pedido do
  operador)**: **quase nada, e o que encarece não é a F23 e sim a F23b.**
  - **O campo novo custa 2 lugares, os dois em `sim/`.** Medido pondo
    `readonly pedraNoCanteiro: Readonly<Record<string, number>>` no `GameState` e
    rodando `tsc`: exatamente **2** erros `TS2741` — `createInitialState`
    (`src/sim/state.ts:1098`) e o literal que o `step` devolve
    (`src/sim/tick.ts:136`). **Zero** arquivo de teste quebra: os 21 arquivos que
    citam `: GameState = {` montam por *spread* de um estado existente. (O campo
    foi removido depois da medição; nada ficou no fonte.)
  - **`save.ts` não muda uma linha.** `salvar` põe o `estado` inteiro no
    envelope e serializa; `carregar` valida versão, id do mapa, hash e
    `typeof estado.tick === 'number'` — e **nada mais da forma do estado**.
    Ninguém enumera `keyof GameState` em `src/`, `tests/` ou `tools/` (grep sem
    resultado). Campo novo entra e sai de graça.
  - **A versão do save: 1 linha, e só enquanto a F18g vier ANTES da F23b.** Um
    save de versão 1 escrito antes da F18g não tem o campo, e `carregar` o
    aceitaria (ele não confere a forma do estado): o jogo receberia
    `pedraNoCanteiro === undefined`, que só aparece quando alguém assenta
    estrada. A saída barata é subir `VERSAO_DO_SAVE` para 2 — a recusa e a
    mensagem já existem, e o teste da F23 lê a constante, não o número, então
    **nenhum teste muda**. O que decide o preço é a base instalada, e ela hoje é
    **zero**: os únicos chamadores de `salvar`/`carregar` são dois arquivos de
    teste, e nada em `src/` grava save em `localStorage` ou em disco (o único
    `localStorage` de `src/` é o lembrete da F-D1, em `ui/ajuda.ts`). **Depois da
    F23b** existem partidas salvas na máquina de quem joga, e a mesma subida de
    versão vira regressão visível: aí seria preciso um ramo de migração e o teste
    dele. **Recomendação: se a F18g entrar, que entre antes da F23b.**
  - **`compararComESemSave` cobre, mas precisa de perna nova.** Cobre
    *estruturalmente*: ela compara o estado inteiro em JSON, então campo que não
    sobrevive ao round-trip quebra lá sem mudar o helper — que já aceita
    `roundTrip` desde a F23. O que falta é **exercitar**: o cenário da F23
    (`cenarioDaCadeiaDoOuro`) injeta estradas **prontas** e nunca planeja uma
    (`tests/helpers/producao-cenario.ts:33`), então `pedraNoCanteiro` ficaria
    `{}` durante toda a comparação; e a perna de determinismo da F08
    (`tests/F08-estradas.test.ts:507`) atravessa o save com canteiro, mas com
    `reviverPorJson` e em 12 ticks, antes de qualquer entrega. A perna nova é **1
    teste na suíte da F18g** (~25 linhas, **0** linha no helper): salvar num tick
    escolhido pela condição *"há pedra parada em tile"*, afirmar que o campo não
    está vazio nesse tick (o padrão da F08, linhas 518-521) **e** afirmar a
    igualdade no **instante** do load — o ponto cego medido na sonda da F23 vale
    aqui igual, porque reserva e tarefa a vila sabe refazer sozinha.
  - **O que NÃO mudou**: os ~12 pontos de ramificação, as 2 FSMs, o 4º caso do
    demolir e os ~89 testes em órbita da nota de 2026-09-24 seguem valendo. A F23
    acrescentou **1 linha** (a versão) e **1 perna de teste**.
- **Nota (MUDANÇA DE ACEITE, decidida pelo operador em 2026-09-25 — leia antes de
  começar)**: o escopo escrito acima **não alivia** o orçamento da abertura, e quem
  pegar a feature precisa saber disso **antes**, não no meio.
  **O que foi medido:** `PlaceRoad` é tudo-ou-nada e o portão que aperta a abertura é
  a **reserva no instante do comando**, não o débito. `canPlaceRoad` soma
  `novos.length * custoStonePorTile` e recusa o trecho **inteiro** com `sem-pedra` se
  passar de `pedraDisponivel` (`src/sim/estradas.ts:538-539`), que é o reservável na
  gaveta `saida` dos armazéns completos. É **isso** que faz o estoque inicial ser
  restrição de GEOMETRIA: na F-T4b a rua de 31 tiles contra 30 de pedra recusou
  inteira, nenhum tile subiu, e a vila ficou com os quatro prédios completos e
  desligados. Mover o débito do assentamento para a entrega — o escopo desta feature —
  **não toca nesse portão**: o orçamento da abertura fica exatamente tão apertado
  quanto hoje.
  **Registro de erro do operador (palavras dele, 2026-09-25):** ele havia dito que a
  F18g aliviaria a restrição *"sem ninguém pedir"*, e pediu que ficasse escrito que
  **estava errado**. Não alivia. Aliviar é escopo NOVO, e é por isso que esta nota é
  mudança de **aceite** e não consequência dela.
  **As duas opções, e o que cada uma custa.** O operador decide **quando a feature
  chegar**; quem implementar não escolhe sozinho.
  - **Opção A — a reserva vira por tile.** Tira o teto agregado de `canPlaceRoad`
    (as 2 linhas do `sem-pedra`) e deixa o canteiro inteiro ser desenhado; as tarefas
    nascem conforme a pedra aparece. **Custo baixo em código, e a máquina já existe**:
    `aplicarPlaceRoad` já cria uma tarefa por tile e já **para** quando
    `criarTarefaDeAssentamento` devolve `null`, e o próprio comentário dele diz que
    *"um tile pode ficar desenhado SEM tarefa... o `gerarTarefas` remenda quando houver
    pedra"* (`src/sim/systems/estradas.ts:38-42`). O que se paga:
    · **9 asserções de `sem-pedra`** em 3 suítes mais o helper (`F08-estradas` 2,
    `F09-estrada-reserva` 3, `F18d-1b-tarefa` 2, `tests/helpers/abertura.ts` 2)
    **invertem de sentido** — e a de `abertura.ts` é a guarda de orçamento do gerador,
    que vira pessimista (ver a dívida no fim desta nota);
    · o motivo `'sem-pedra'` do tipo `ResultadoDeEstrada` (`estradas.ts:39`) fica
    **sem produtor**; ou some, ou passa a ser por tile;
    · **a recusa NÃO é feedback perdido, e isto foi medido**: `command-rejected` não
    tem **nenhum** consumidor fora de `sim/` (só `src/input/colocar.ts:54`, num
    comentário) — hoje o jogador que pede rua sem pedra não vê nada. A dívida real é a
    inversa: com a Opção A o canteiro vira o feedback ("desenhado e esperando pedra"),
    e mostrar isso é trabalho de `render`/`ui`, ou seja **outra** feature, com a nota
    de integração da §10 escrita no item dela;
    · **risco de desenho**: rua desenhada de graça é um arrasto imenso que a vila
    nunca termina. As duas guardas medidas na sonda da F18d-1b continuam de pé (sem
    pagador a tarefa não nasce), mas o canteiro passa a crescer sem limite.
  - **Opção B — o arrasto vira parcial.** `canPlaceRoad` mantém a conta e devolve o
    **prefixo que cabe**, e `aplicarPlaceRoad` desenha só ele. **Custo maior, e o
    caro não é código**:
    · quebra o contrato "tudo ou nada" que está escrito em `src/sim/commands.ts:28-38`
    e que o **`PlowField` cita como molde** (*"Tudo ou nada, como o `PlaceRoad`"*) —
    mexer num decide pelo outro, ou os dois divergem de propósito;
    · `ResultadoDeEstrada.ok` ganha "quantos ficaram de fora", e todo leitor de `ok`
    passa a ter de olhar isso: a prévia do render (`src/render/debug.ts:99`, que pinta
    o que o trecho custaria) e o arrasto do input;
    · **o custo de design, que é o verdadeiro**: qual prefixo? A ordem dos tiles é o
    gesto do jogador (`input/arrasto.ts`), então aceitar parcial é **decidir geometria
    no lugar dele** — cortar um L no meio deixa um trecho que não liga nada, e o
    jogador paga pedra por rua inútil sem ter pedido. Se esta opção for escolhida, o
    item precisa dizer **onde** corta e o que acontece com o resto do gesto (some,
    fica planejado sem tarefa, ou vira recusa).
  **A dívida que nasce em qualquer das duas:** se o portão afrouxar, o guarda de
  orçamento do gerador (`rua.length * custoStonePorTile + reserva >
  estoqueInicialDeStone`, em `tools/geometria-da-abertura.mjs`) passa a ser
  **pessimista** — vai recusar geometria que a partida sustenta, porque a pedreira
  produz enquanto a rua sobe. Aí ele deixa de ser guarda e vira teto falso: revisite-o
  no mesmo commit, junto com o 4º teste de `tests/F-T4b-geometria.test.ts`, que é quem
  afirma que a mensagem carrega as duas medidas.
  **Contexto de balanceamento:** o estoque inicial subiu de 30 para 34 por decisão do
  operador em 2026-09-25 (entrada no `BALANCE_LOG.md`), o que tirou a abertura do fio
  de navalha — mas isso é margem, não conserto do portão. O portão continua igual.
- **ENTREGUE em 2026-09-25 (branch `fable-lote-sim`), pela Opção A — decisão do
  operador.** Plano: `docs/planos/F18g.md`. Guarda permanente:
  `tests/F18g-pedra-viaja.test.ts` (as quatro afirmações medidas tick a tick numa
  corrida só, o serf que devolve quando o tile some com a pedra na mão, e a perna do
  save); evidência `test-output/F18g.json`.
  - **O que existe agora**: `pedra-para-canteiro` (carga de serf, nível 8 da escada,
    `livre`; reserva ao reclamar, como toda carga), `GameState.pedraNoCanteiro` (mapa
    paralelo ao canteiro), `TarefaAssentarEstrada` só com o tile (nasce para todo tile,
    sem pagador), `canPlaceRoad` sem `'sem-pedra'` (o motivo saiu do tipo), o laborer
    em `esperando_material` NO tile e o claim dele exigindo pedra no tile ou a caminho
    (`tileDeEstradaTrabalhavel`, espelho de `obraTrabalhavel` — sem isso, 2 de pedra e 30
    tiles deixam dois laborers esperando onde a pedra nunca chega). O 4º caso do demolir:
    tile desenhado com pedra entregue devolve a pedra **inteira** ao primeiro armazém.
    `VERSAO_DO_SAVE` 1 → 2, base instalada zero.
  - **As duas pontas, remedidas (o operador pediu).** A escolha "ligar tudo de uma vez
    contra escalonado" **não sobreviveu como recusa, e sobreviveu como travamento**. Na
    abertura (rua de 26 tiles), com a pedra viajando por tile: **27 de pedra fecha a
    Fase A (serraria ligada em 2691), 26 trava** — 23 tiles de pé, pedreira e segunda
    casa em obra aos 12 000 ticks, porque a rua assenta com toda pedra que aparece e a
    obra da pedreira nunca recebe as 2 dela. Com 34, fecha em 1319 e o estoque toca 0
    no tick 1012. O guarda do gerador (`rua + 4 ≤ estoque`, ou seja ≥ 30) ficou
    **pessimista por 3** em relação ao limiar medido (27), **de propósito**: o limiar de
    1 é de ordem de tick, e a mensagem dele agora diz o que ele protege (travamento, não
    recusa). A ponta "escalonado" não foi remedida: a tensão entre as duas escolhas
    deixou de ser "cabe ou não cabe" e virou "quanto tempo a vila fica sem pedra".
  - **Os tetos remedidos**: F-CAL-a fecha em **9465** (era 7148; a Bodega espera a pedra
    dos 3 tiles dela e dos 5 da obra chegarem da pedreira, atrás do material de obra na
    escada), teto 9000 → 12 000. F17 (5300) não mudou. E "a rua vem primeiro" no
    cenário da calibração passou a significar rua DE PÉ: sem esse guarda o Moinho subia
    e ficava ocupado com a porta no canteiro (medido, 2993 e `ligadoAoArmazem: false`).
  - **Dívidas registradas, não resolvidas (o operador mandou)**: (1) `command-rejected`
    continua sem consumidor fora de `sim/`; com a Opção A o feedback do "sem pedra" é o
    próprio canteiro desenhado esperando, e a **pedra parada no tile** (`pedraNoCanteiro`)
    é invisível na tela — feature de `render`, com a nota de integração da §10 no item
    dela; (2) rua desenhada de graça é arrasto sem limite: as guardas ficam (sem pagador
    a carga não nasce, e o laborer não vai), mas o canteiro cresce até onde o jogador
    quiser e come a pedra na ordem em que ela aparece.

### F-CAL — A calibração medida na abertura (aceite; a última medição da Fase B)
- **Por que existe** (decisão do operador, 2026-09-25, ao mergear a
  `calibracao-fase-b`): o lote da cadeia de comida foi medido em dois cenários que
  **não passam pela abertura** — o da cadeia do pão, no norte do mapa, e um cenário
  da vila montado à mão (`docs/calibracao-fase-b.md`, "Depois do merge"). A F-T4b
  mudou a abertura para dois grupos com os lenhadores a leste, e a re-medição saiu
  idêntica **por construção**, não por prova. *"É a única medição que ainda falta
  para dizer que a Fase B está calibrada, e a caminhada é o termo que pode mudar."*
- **Escopo**: um cenário que **passa pela abertura** — `aberturaDaFaseA`
  (`tests/helpers/abertura.ts`, a mesma que `cenarioOraculo` e a F17 usam), mais
  Roçado, Moinho, Padaria e Bodega plantados **ao lado dos dois grupos**, e o campo
  desenhado pelo jogador com `PlowField` colado à fazenda. Zero linha de simulação:
  é cenário e medição. O cenário do F17 já monta quase tudo.
- **QUEBRADA EM DOIS SUB-ITENS em 2026-09-25**, pela regra do `CLAUDE.md` §6 ("se a
  feature se revelar maior do que uma sessão, não improvise"). O motivo é **medido**,
  não impressão: o cenário que o aceite pressupõe **não existe e não nasce sozinho** —
  na abertura pura `mill` e `bakery` **nunca** desbloqueiam, porque dependem de `farm`
  e `mill` **construídos**, e a `farm` só abre no tick **1110**. Montar a vila da
  cadeia de comida é trabalho de uma sessão; medir é de outra. **O aceite escrito
  abaixo não mudou uma palavra** — ele é, inteiro, o da F-CAL-b. Plano de
  implementação e números da sonda: `docs/planos/F-CAL.md`.

#### F-CAL-a — a vila da cadeia de comida sobe pela abertura
- **Escopo**: `tests/helpers/cal-vila.ts` — a abertura mais Roçado, Moinho, Padaria e
  Bodega, os três treinos novos (roceiro e dois padeiros) e o `PlowField` colado à
  fazenda. As posições saem dos **predicados da sim** (`caixaDeTipo`,
  `recursoBloqueiaConstrucao`, `canPlaceRoad`, `canPlowField`), varrendo a linha de
  porta a partir das bordas dos dois grupos — **nenhuma coordenada digitada**, pela
  mesma regra que a F-T4b usou. A ordem dos comandos reage ao **estado**, como
  `comandosNoTick` já faz: cada prédio é plantado quando está desbloqueado e o
  material cabe, nunca num tick escolhido a dedo.
- **Aceite**: os oito prédios completos, os sete com ocupante, o campo arado e
  **zero recusa de comando**, dentro de um teto de ticks medido nesta sessão.
  Cada caixa tem **uma porta que é tile da rua da abertura**, afirmado por predicado
  e não por coordenada.
- **Evidência**: `test-output/F-CAL-cenario.json` com o tick de cada marco, a lista de
  recusas (vazia) e o custo de parede da corrida — este último **como número da
  corrida, nunca em `expect`** (`CLAUDE.md` §8).
- **Nota (medido antes de planejar, 2026-09-25, sonda já apagada)**: `farm` desbloqueia
  em 1110, `inn` em 1; a abertura fecha o critério da F17 em 3993; no tick 8000 o
  armazém tem 63 timber, 32 stone e 16 de ouro, com **0** recusa em 8000 ticks. Os
  quatro prédios custam 18 timber + 14 stone e os treinos 3 de ouro: **cabe**. O custo
  de parede da abertura pura é 117 ms/1000 ticks, então as janelas da F-CAL-b (24 000 e
  36 000) encostam no orçamento de 10 s dos casos lentos — se encostarem, são **dois
  casos**, não um teto afrouxado.
- **Fora do escopo**: nenhuma afirmação de calibração. A F-CAL-a prova que a vila
  **chega lá**; se os números estão certos é pergunta da F-CAL-b.

#### F-CAL-b — as quatro afirmações do aceite
- **Depende de**: F-CAL-a, ENTREGUE em 2026-09-25. O que ela herda é
  `tests/helpers/cal-vila.ts` (`vilaDaCalibracao` + `comandosDaVilaNoTick`) e o teto
  medido lá: a vila inteira fecha — oito completos, sete ocupados, campo arado, zero
  recusa — no tick **7148**, com o Moinho ocupado em 4062 e a Padaria em 5392.
- **Nota (medido na F-CAL-a, e as duas coisas mudam o tamanho desta)**:
  1. **O orçamento de relógio é o risco real, e ele dobra sob carga.** A corrida de
     7148 ticks levou 2,0 s isolada e **4,4 s dentro da suíte** (103 workers
     disputando a máquina) — 619 ms/1000 ticks contra 210 ms. Na mesma proporção,
     36 000 ticks passam de **20 s**. O teto padrão do Vitest (5 s) já reprovou a
     F-CAL-a uma vez por isso, e o conserto foi `timeout` explícito, que **não é
     asserção de tempo** (§8). Planeje as duas janelas como **dois casos**, cada um
     com `timeout` próprio — e o número de relógio vai para o JSON, nunca para um
     `expect`.
  2. **O item (c) do aceite já tem um sinal contrário, e ele é medida, não palpite**:
     no tick 7148 o armazém tinha **corn 14**, não ≤ 1. O Moinho só ocupou em 4062,
     então há 4000 ticks de milho entrando sem quem moa. Se o critério (c) reprovar,
     a pergunta é se ele descreve o regime ou a rampa — e isso é decisão do operador,
     não conserto do teste.
- **Aceite**: rodar ≥ 24 000 ticks e afirmar, no eixo determinístico, (a) o intervalo
  de entrega da fazenda (`ticks por milho`, do evento `goods-produced`) dentro de
  **±10 % do ciclo do moinho** (`receitas.mill.ticksDoCiclo`, do dado — não 246
  digitado); (b) moinho e padaria com `esperando_insumo` abaixo de 10 % dos ticks;
  (c) milho nunca acima de 1 no armazém; (d) com os civis da abertura mais os que 20
  de ouro treinam, **nenhuma morte de fome** em 36 000 ticks. O termo a comparar com
  `docs/calibracao-fase-b.md` é **ida + volta do roceiro por milho** (~100 nos dois
  cenários de lá): é o único que a geometria da abertura pode mudar.
- **Se falhar**: registrar os dois números (longe / vila / abertura) no
  `BALANCE_LOG.md` e **não girar** `farm.sai.corn` sozinho — a conta do doc diz qual
  termo mudou, e só ele se ajusta.
- **Evidência**: `test-output/F-CAL.json` com o tempo do roceiro por fase (como a
  tabela do doc) e as quatro afirmações.
- **Fora do escopo**: pedreira, lenhador e minas — mesmo padrão, próximo lote
  (hipótese registrada no `BALANCE_LOG.md`, 2026-09-25).
- **QUEBRADA EM DOIS em 2026-09-25 (branch `fable-lote-sim`), pela §6 — o aceite acima
  não mudou uma palavra.** Medido antes de escrever (`docs/planos/F-CAL-b.md`): **(a) e
  (c) reprovam, e é regime, não rampa.** O milho sobe +3 a cada 1000 ticks do 12 000 ao
  36 000 (99 no fim) com o Moinho 100 % em `trabalhando`; a fazenda entrega um milho a
  cada **143** ticks contra **246** do moinho. O termo que mudou é o que o item dizia:
  **ida + volta = 2**, não ~100 — o campo da abertura começa a Chebyshev 1 da porta e
  `alvosDeAproximacao` (`src/sim/aproximacao.ts:43-53`) deixa o roceiro colher **do tile
  da porta**, sem andar. O operador reservou este ramo para si (*"se crescer sem parar...
  balanceamento, e eu decido. Não gire número sem eu ver"*): as três saídas estão no
  `BALANCE_LOG.md` (2026-09-25). (b) e (d) passam com folga e continuam passando em
  qualquer das três.
  - **F-CAL-b1 — a corrida e as duas afirmações que não dependem da decisão (ENTREGUE
    2026-09-25)**: `tests/F-CAL-b-calibracao.test.ts`, 36 000 ticks da vila da F-CAL-a
    com o ouro que sobra treinando serfs (população 6 → 26). Afirma **(b)** — moinho 0,2 %
    e padaria 0,15 % em `esperando_insumo` até 24 000, com a janela provada real (ocupam
    antes da metade dela) — e **(d)** — zero `unit-starved` em 36 000, população = inicial
    + ouro — mais zero recusa e a fazenda entregando até o fim. **As quatro medidas** vão
    para `test-output/F-CAL.json`, cada uma com `passa` e `asserido`, e a tabela do
    roceiro por fase (abertura: 100 / 1 / 1 / 37 — longe: 100 / 54 / 50 / 36). Corrida de
    10,4 s isolada; `timeout` explícito de 90 s, que não é asserção de tempo (§8).
  - **F-CAL-b2 — decisão do operador tomada (2026-09-25), e BLOQUEADA pela medição dela.**
    Ele escolheu a saída (iii), com o porquê dele: *"a vazão da fazenda depende de onde o
    jogador põe o campo, e isso é decisão dele, não número a fixar. Girar
    farm.sai.corn fecharia para uma geometria e quebraria a outra — que é exatamente o
    erro do lote 1, agora medido."* A (ii) está fora: *"desfaz uma escolha da F-T3 por
    motivo de balanceamento, e a F-T3 tem razão própria (o roceiro não pisa no que vai
    colher)."* O aceite pedido: (a) e (c) descrevem a FAIXA — a fazenda sustenta o
    moinho com o campo colado e no alcance máximo, e o milho não cresce sem limite no
    segundo; campo colado sobrando milho é **recompensa por posicionar bem**, não
    defeito. E a saída dele: *"se 'sustenta nas duas' virar afirmação vazia, pare e me
    diga, e aí o número volta à mesa."*
    **Medido (`BALANCE_LOG.md`, 2026-09-25): no alcance máximo a fazenda entrega um milho a
    cada 346 ticks e o moinho fica 22,5 % esperando** (colado: 143 e 0,1 %). "Sustenta
    nas duas" é falsa; o aceite não foi escrito e o número voltou à mesa. O doc da
    calibração já tem o número medido ao lado da premissa morta. Achado de lado: BUG-G
    (`BUGS.md`, trava), que matou a vila nas medidas a 2 e 3 tiles.
  - **F-CAL-b2 — a decisão do operador que não tinha chegado, APLICADA em 2026-09-26.** A
    decisão diz: **o critério (b) vale para o campo do lado da porta; `farm.sai.corn`
    continua 3.0**; a prévia de alcance que distingue o lado da porta foi para o `IDEIAS.md`.
    (a) e (c) foram reescritos, com a tabela das três geometrias ao lado (`BALANCE_LOG.md`,
    2026-09-25, sonda apagada, vila da F-CAL-a por 36 000 ticks, só o campo mudando de lugar):

    | campo | ticks por milho | 1 Roçado alimenta | moinho esperando | milho máx. | mortes |
    |---|---|---|---|---|---|
    | colado à porta (sul) | 143 | 1,72 moinho | 0,1 % | 98, subindo | 0 |
    | atrás, 1 tile | 299 | 0,82 moinho | 10,1 % | 5 | 0 |
    | atrás, 4 tiles (alcance máx.) | 346 | 0,71 moinho | 22,5 % | 4 | 0 |

    - **Aceite (a), reescrito:** com o campo do lado da porta, a fazenda **sustenta** o
      moinho: o intervalo médio de entrega até 24 000 é **≤** `receitas.mill.ticksDoCiclo`.
      Sem piso, porque a sobra do lado da porta é recompensa por posicionar bem. Com o campo
      atrás a fazenda não sustenta, como a tabela mostra, e isso é aceito.
    - **Aceite (b):** fica como está, valendo para o campo do lado da porta. A F-CAL-b1 já afirma.
    - **Aceite (c), reescrito:** "milho nunca acima de 1" deixa de ser critério. Do lado da
      porta o milho sobra e sobe (98 em 36 000), e isso é recompensa, não defeito. Longe da
      porta o moinho come tudo (máximo de 4 a 5), mas isso é medida de sonda, sem asserção
      permanente: a suíte não roda a geometria longe, e o BUG-G (trava) matou a vila a 2 e
      3 tiles. A evidência grava o (c) com `asserido: false` e o porquê.
      **Dependência, não escolha (operador, 2026-09-26):** a sonda do (c) está sem asserção
      **porque o BUG-G mata a vila** com o campo a 2 e 3 tiles. Não é por ser frouxa de
      propósito. O BUG-G foi corrigido em 2026-09-26 (`passoAndavel`,
      `tests/BUG-G-preso-no-footprint.test.ts`), então o (c) longe da porta **pode** virar
      asserção: uma corrida de 36 000 ticks com o campo atrás, afirmando o teto de milho medido
      e zero mortes. A tabela acima foi medida antes da pedra 30 e do conserto. Uma asserção
      nova parte de uma medição nova, não dessa tabela.
      **Fica como sonda (operador, 2026-09-26).** O bloqueio **deixou de ser o BUG-G e passou a
      ser prioridade**: virar asserção exige a corrida longa e a medição nova, e a Fase C está
      começando. O caminho está livre para quando alguém quiser; nada no código impede.
    - **Entregue:** `tests/F-CAL-b-calibracao.test.ts` ganhou o `it` de (a) sobre a mesma
      corrida (141,6 ≤ 246). A reescrita de (a) e (c) é interpretação minha, a mais
      conservadora, e fica **marcada para o operador revisar** (`PROGRESS.md`, 2026-09-26).
  - **(texto anterior) F-CAL-b2 — (a) e (c), depois da decisão do operador**: dois `it` sobre a mesma
    corrida, com o texto que a decisão fixar. Se a saída for número (`farm.sai.corn`), o
    aceite fica como está; se for regra (`aproximacao.ts`, tile pisável = só o tile), é
    feature de `sim/` e o doc volta a valer; se for aceitar 1 Roçado : 1,7 Moinho com
    campo colado, o aceite se reescreve com a medição ao lado e
    `proporcoesDeReferencia` diz isso.
### F-CANA — O Canavial colhe cana, a mina colhe sem sair (sim + dado; ENTREGUE 2026-09-26)

Casos 2 e 4 do prédio vivo (`docs/BRIEF-ARTE.md` §4a). Decisão do operador: corrigir o
**dado**, não os casos.

- **Aceite:**
  - (a) o Canavial (`wineyard`) tem `colheita` de `grapes`. `grapes` é **cana-de-açúcar**,
    cultura que o jogador ara (bloco `aradura`), sem terreno de mapa. O Canavial planta,
    sai, corta e volta, e a cachaça sai do partido arado, não do nada. O milho ao alcance
    fica intocado. Sem partido, ele espera em `esperando_insumo`.
  - (b) as três minas mantêm `colheita` e declaram `colheita.aDistancia: true`. O mineiro
    fica em `trabalhando` o ciclo inteiro, sem sair do lugar. O tile do veio continua
    reclamado e perde exatamente o que o ciclo entregou. Com a bandeira desligada, a
    mesma fixture volta a andar.
  - (c) `recurso/sem-instancia` isenta pelo **dado** (bloco `aradura`) a cultura que o
    jogador ara. A cultura sem `aradura` e sem tile continua reprovando.
- **Entregue:**
  - `tests/F-CANA-canavial-e-mina.test.ts` cobre (a) e o recorte "só as minas têm a bandeira".
  - `tests/F21b-mina-esgota.test.ts` (8) foi reescrito para (b); ele afirmava a regra antiga.
  - `tests/F03-dados-validados.test.ts` cobre (c), nos dois sentidos.
- **Nota para a feature de render do prédio vivo:** o Canavial é caso 2 e as minas são
  caso 4 a partir daqui. A tabela do brief já está assim.

### F-CANA-b — A mancha de cana da vila (gerador + dado)
- **Origem (decisão do operador, 2026-09-26, BUG-L)**: *"o conserto é o mesmo da
  fazenda: o gerador semeia uma mancha de cana perto da vila, como fez com o lajedo e o
  roçado."* A F-CANA deixou `grapes` sem nenhum tile de mapa: só existe o que o jogador
  ara. É a situação do milho antes do `ROCADO_DA_VILA` da F18h
  (`tools/gerar-mapa.js:218`).
- **Escopo**: `tools/gerar-mapa.js` pousa uma mancha pequena de cana perto da vila, com o
  mesmo recorte do roçado: fora da folga, à vista da abertura, e depois de tudo o que
  sorteia, para não deslocar o RNG. O mapa é gerado de novo.
- **Aceite**:
  - (a) no mapa padrão existe pelo menos um tile de `grapes` ao alcance de um Canavial
    posto perto da vila, e o Canavial planta ali sem o jogador arar antes.
  - (b) o roteiro `F18` volta ao verde.
  - (c) os 9 arquivos de geografia continuam verdes no mapa novo.
- **Nota (hipótese, não medida)**: a mancha sozinha pode não bastar para o (b).
  - `tiposQueNascemVazios()` (`tools/shots/F18.js:103`) lê `quantidadeInicial` do dado,
    e a cana continua nascendo em 0, como o milho.
  - O mais provável é que a premissa do roteiro passe de "só o milho nasce vazio" para
    "só cultura com `aradura` nasce vazia". A conta do "esgotado" teria então de somar
    os tiles das duas.
  - Confira no passo 0, antes de gerar o mapa. A nota da F18c-2 sobre
    `FORA_DO_MUNDO_TRANSLADADO` vale aqui também.
- **Chave**: a F-CANA fica `false` pelo BUG-L (`errado`) e volta a `true` quando esta
  entregar. A F18 fica `true`: o aceite escrito dela passa (decisão do operador).
- **Entregue (2026-09-26, noite 16).**
  - A mancha é a `CANAVIAL_DA_VILA`, (36,40) com raio 2, 13 tiles. Espelha o roçado do
    outro lado do eixo da vila.
  - Ela entra na camada **esparsa**, como o lajedo, e não como terreno novo. A cana não
    tem `terreno`, e um chão novo pediria cor no render.
  - Vai por último em `gerarRecursos`, depois dos veios, e o resto do mapa sai
    idêntico.
  - A hipótese da Nota se confirmou: o roteiro F18 passou a afirmar "vazio = cultura
    com `aradura`" e soma a cana do quadro ao `esgotado`.
  - O teste da F-CANA fotografava toda a cana do mundo. Passou a fotografar a cana ao
    alcance do `c1`.
  - **Medido:** o quadro de abertura (1280×720) cobre y 25,9..37,1, e o roçado e a
    cana começam em y=38. "À vista da abertura" vale no critério do roçado (a folga
    encostada), não no quadro. O roteiro `F-CANA-b` desce a câmera.

### F-CAMPO — O campo cresce no tile, sozinho (proposta; não implementar antes do sim do operador)
- **Origem (operador, 2026-09-26, BUG-O)**: *"O roceiro preso não é bug de escolha: é o
  modelo. O certo é o crescimento correr NO TILE, em paralelo, independente do roceiro —
  como no KaM."* E o modelo, decidido por ele:
  - o tile tem quatro estados: **terra, semeado, crescendo, maduro**;
  - terra → semeado: o trabalhador vai até o tile e semeia (**primeira visita**);
  - semeado → crescendo → maduro: **por tempo**, sozinho, em todos os tiles semeados ao
    mesmo tempo, sem o trabalhador lá;
  - maduro → terra: o trabalhador volta, colhe e leva ao prédio (**segunda visita**);
  - vale para o milho e para a cana do mesmo jeito; muda só o tempo de crescer e o sprite.
- **Quebra (§10: sim e render não se tocam na mesma feature)**:
  - **F-CAMPO-a (sim + dado)**: estado do tile, escolha do tile, crescimento por tempo.
  - **F-CAMPO-b (render)**: o sprite do estado, desenhado sobre o tile (BRIEF-ARTE §4a,
    tipo `cultura`). Placeholder até a arte existir, como todo asset.
- **Estado da F-CAMPO-a (2026-09-27): implementada na branch `f-campo-a` (commit
  `10b5869`, `wip`), aceite REPROVA, chave `false`, fora da `main`.** Números do operador
  (semear 9 s, crescer 30 s, rodízio, claim recusa tile verde) marcados para revisão. O
  que a medida mostrou (tabelas em `docs/planos/F-CAMPO-a.md`, na branch):
  - com C = 150, **nenhuma** regra de escolha faz 12 tiles renderem mais que 1: o gargalo
    é o roceiro (uma viagem por unidade colhida), não o relógio;
  - o rodízio semeia o anel inteiro antes de colher: a fazenda de 37 tiles tem a primeira
    saída no t5051 (era ~500), e 11 testes caem (F18 ×6, F19 ×2, F-CANA, F-CANA-b, F-T3);
  - "colher antes" devolve a primeira saída ao t501 e 24 milhos em 6000, mas é a regra
    que a Pergunta 3 recusou.
  - **Espera o operador**, uma de quatro: aceitar o custo de partida do rodízio (e
    reescrever F18/F19); trocar a regra para colher antes; subir C (12 > 1 só com C
    grande); ou reescrever o aceite (com C = 150, o BUG-O é espera visual, não vazão).
  - **Decisão do operador (2026-09-27): nenhuma das quatro.** O defeito, na leitura
    dele, é o roceiro fazer uma viagem por unidade colhida, quando no KaM o fazendeiro
    "colhe e leva a carga". Mandou medir no kam_remake antes de mexer.
  - **Medida no kam_remake (2026-09-27, fonte lida, `reyandme/kam_remake` master):**
    - *Verificado no código:* `CutCorn` (`KM_Terrain.pas`) exige o tile no estágio 5 e
      zera a idade: **um corte, de um tile, por viagem**. O plano do fazendeiro
      (`KM_UnitWorkPlan.pas:356`) é `ResourcePlan(wtNone,0,wtNone,0,wtCorn)`, com
      `ProdCount1 := gRes.Houses[fHome].ResProductionX` (`:128`), e a entrega é
      `WareAddToOut(Product1, ProdCount1)` (`KM_UnitTaskMining.pas:415`). A colheita tem 6
      ciclos de animação, o plantio 10. O crescimento é `CORN_AGE_FULL = 6400 div
      TERRAIN_PACE`, com o tile atualizado a cada 200 ticks: **~6400 ticks, ~640 s**.
    - *Não verificado:* o valor de `ResProductionX` da fazenda vem do binário
      `data/defines/houses.dat`, que não está no repositório. O único override no código é
      o pescador (`:= 1`). As fontes secundárias dizem **um milho por colheita**
      ([guia Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=1227250653),
      [wiki Corn](https://kamremake.wiki.gg/wiki/Corn),
      [wiki Farmer](https://kamremake.wiki.gg/wiki/Farmer)).
    - **A premissa não se confirma.** No KaM o tile rende 1 e a viagem traz 1 (o
      número por viagem é hipótese forte, não fato lido). O que faz 12 a 15 campos
      valerem lá é outra coisa: o crescimento (~6400 ticks) é **30× a viagem**. Aqui
      C = 150 é mais curto que uma viagem (~205), e por isso 12 tiles rendem como 1.
      A rajada de partida também é do KaM: o fazendeiro semeia todos os campos e espera
      ([fórum Steam](https://steamcommunity.com/app/253900/discussions/0/540734792682225900/)).
      O atraso do rodízio (t5051) é o mesmo comportamento, não um sintoma de outro defeito.
    - **Onde o nosso difere do KaM:** aqui o tile maduro rende **4**
      (`resources.json: corn.rendimentoPorTile`), colhidos em 4 viagens. No KaM, 1 em 1.
      "Levar a carga" teria leitura aqui: uma viagem traz os 4 do tile. Conta, sem rodar:
      150 + 4 × 100 + 105 = 655 por tile, ou ~164 por milho, contra 242,5 hoje. Isso
      **não** está no KaM e muda a vazão de toda fazenda, então é decisão, não conserto.
  - **Espera o operador, de novo:** (i) a carga do tile numa viagem, que não é do KaM; ou
    (ii) a razão do KaM, com crescimento muito maior que a viagem, rendimento 1 por tile e
    mais tiles. Isso é o C grande da lista anterior, agora com o porquê medido. Nada foi
    implementado. A branch `f-campo-a` segue parada.
  - **Atualização (2026-09-27, noite): o "1 por viagem" do KaM está LIDO**, não é mais
    provável: `ResProductionX` da farm = 1 no `houses.dat` da instalação do operador (tabela
    no `BALANCE_LOG.md`, entrada "REFERÊNCIA"). O corte do KaM leva 96 ticks, contra 100
    nossos, e o milho cresce em 6 400 ticks.
  - **Decisão do operador (2026-09-27): subir o crescer**, não 4 por viagem nem o KaM
    inteiro. O campo passa a ser investimento de longo prazo, e o rodízio "semeia doze e
    espera", como no original. Pediu medida antes de girar.
  - **Medida (sonda temporária, apagada; branch `f-campo-a` com semear 9 s):**
    - método: `cenarioDeFazenda`, com só os N tiles de milho mais perto;
    - gaveta de saída esvaziada e condição do roceiro reposta a cada tick. A fome fica
      fora: a condição inicial vem do `gameData` global, e não do dado injetado;
    - 30 000 ticks. A vazão é medida na **segunda metade**, em ticks por milho.

    | crescer (ticks) | 1 tile | 2 tiles | 4 tiles | 12 tiles | 12 ÷ 1 | 1º milho, 12 tiles |
    |---|---|---|---|---|---|---|
    | 150 (hoje) | 211 | 181 | 188 | 203 | **1,04×** | 1 523 (1 tile: 378) |
    | 600 | 313 | 242 | 205 | 203 | 1,54× | 1 523 |
    | 800 | 375 | 268 | 208 | 203 | 1,85× | 1 523 |
    | **1 650** | 600 | 375 | 246 | **195** | **3,1×** | **1 899** (1 tile: 1 878) |
    | 3 000 | 938 | 500 | 341 | 211 | 4,4× | 3 249 |
    | 10 700 | 3 750 | 1 875 | 938 | 577 | 6,5× | 10 949 |

  - **Leitura (verificada nas linhas acima):**
    - **O teto é o roceiro, não o relógio.** A fazenda saturada dá **~195–211 ticks por
      milho** em qualquer crescer até 3 000. Esse é o `farm.sai.corn` 3,0 mais a
      caminhada, e ele **não muda com o crescer**. O crescer só decide quantos tiles
      são precisos para chegar ao teto.
    - **Com 600 ou 800, doze não valem mais que quatro.** Quatro já saturam o roceiro
      (205–208). Doze valem 1,5–1,9× um tile, e os oito a mais ficam parados.
    - **Doze passam a valer com crescer ≈ 1 650.** Com 12 tiles o roceiro chega ao teto
      (195); com 4 fica a 246. **O atraso do rodízio some:** o 1º milho vem no 1 899,
      contra 1 878 com 1 tile, porque o crescer já é maior que semear doze (~1 500). É
      o "semeia doze e espera" do KaM. Com 3 000, doze mal chegam ao teto (211); com
      10 700 não chegam (577).
    - **Efeito no `farm.sai.corn`: nenhum giro necessário** se a fazenda tiver tiles
      para saturar, porque o teto é o mesmo de hoje. O custo cai em quem tem poucos
      tiles e no começo da cadeia. O 1º milho vai de ~378 para ~1 880, e isso mexe em
      tudo que mede a partida: F18, F19, a Bodega da F-CAL-a, e a vila da F-CAL-a, que
      tem 8 tiles. **Nada disso foi rodado com o crescer novo.**
  - **Proposta (não girada):** `corn` e `grapes`, `reposicao.crescer_segundos_base` 30 →
    **330**, ou seja, 1 650 ticks na escala 2,0. É o menor crescer medido em que doze
    tiles saturam o roceiro. Com semear 9 s, ele custa ~21 ticks de rodízio. O teto do
    KaM (6 400 com rendimento 1) fica acima e não se copia, porque aqui o tile rende 4.
    **Antes de girar**, falta rodar F18, F19 e F-CAL-a com 330 e contar o que cai.
  - **Decisão do operador (2026-09-27, noite): crescer 1 650.** *"Um campo que demora é
    jogo; um campo inútil é bug."* Regra para o giro: se um teste reprovar afirmando
    comportamento, parar; se for número de primeira saída, corrigir com a medida ao
    lado.
  - **Girado na branch, PARADO antes da `main`** (`f-campo-a`, commit `f70322c`, com a
    `main` mesclada). A suíte inteira dá **12 reprovações**:
    - **1 nova, e é número:** F18h, "um PlowField ... entrega milho". A janela é de
      2 000 ticks, e o 1º milho sai `null` dentro dela. Pode ser
      corrigida com a medida, e **não foi**, porque o giro parou pelas outras 11.
    - **11 que já caíam com crescer 30**, com os mesmos valores. Vêm do **modelo**
      F-CAMPO-a, não do 1 650, e várias afirmam **comportamento** do modelo antigo:
      - F18-ciclo-do-roceiro ×3: "replanta o MESMO tile", "o prédio LARGA", "durante o
        PLANTIO o roceiro não sai";
      - F18-rocado ×3: "a série tem o degrau e o patamar", "o patamar é o campo vazio",
        "planta e DEBITA";
      - F-CANA, F-CANA-b e F-T3, uma cada: plantio dentro do prédio, ciclo perdido;
      - F19 ×2: o 1º milho no 5 051 (esperado 250), o mesmo com 30 e com 1 650, e 48
        cuscuz para um teto de 88,5.
    - **O F19 não melhora com 1 650.** A fazenda dele tem 37 tiles ao alcance, e o 1º milho sai
      no 5 051 tanto com 30 quanto com 1 650. **Hipótese** (não medida): semear o anel
      inteiro leva mais que o crescer, então o rodízio semeia tudo antes de colher. Se
      for isso, o 1 650 só resolve fazenda pequena.
  - **F-CAL-a com 1 650 (medido por sonda, apagada):**

    | crescer | 1º milho | 1º cuscuz | Bodega pronta | 1ª comida na Bodega | morte até 16 000 |
    |---|---|---|---|---|---|
    | 30 (branch) | 3 994 | 6 580 | 8 222 | 8 327 | nenhuma |
    | 1 650 (branch) | 5 218 | 6 545 | 8 279 | 8 421 | nenhuma |

    - A fome não aperta: a comida chega à Bodega 3 579 ticks antes do teto de 12 000.
    - O milho atrasa 1 224 ticks e não chega ao cuscuz, porque a padaria só fica pronta
      no 6 188. Quem segura a Bodega é a obra, não o campo.
    - A `main` (modelo antigo) dá a Bodega no 8 009.
  - **Espera o operador:** as 11 reprovações de comportamento são reescrever F18/F19
    para o modelo novo. E o F19 pede
    decidir a fazenda de 37 tiles.
  - **Decisões do operador (2026-09-27, noite 4):** reescrever os testes que afirmam o
    modelo revogado, *"cada um com o motivo ao lado"*, e parar em qualquer um que afirme
    algo que continua valendo. A fazenda de 37 tiles se conserta pelo alcance, no dado.
    O crescer 1 650 entra na `main` junto com os testes reescritos.
  - **Alcance medido na F19** (branch `f-campo-a`, sonda apagada; o cuscuz é o
    acumulado até 12 000):

    | `farm.colheita.alcance_tiles` | tiles arados ao alcance | 1º milho | cuscuz até 12 000 |
    |---|---|---|---|
    | 1 | 5 | 1 878 | 61 |
    | **2** | **14** | **1 899** | **60** |
    | 3 | 25 | 3 282 | 49 |
    | 4 (antes) | 37 | 5 051 | 34 |

    - O alcance 1 quebra a vila da calibração: *"o Roçado em 37,30 não tem NENHUM tile
      arável e alcançável ao alcance 1"* (BUG-G, F-CAL-a, F-CAL-b, F-VIVO-a caem no
      carregamento).
    - **Escolhi 2:** é o menor que não quebra nada, e dá 14 tiles, perto dos ~15 campos
      por fazenda do GDD. **Hipótese** (não medida): o anel de 2 ainda comporta ~44
      tiles, e quem arar muito mais que ~20 ali pode repetir o atraso.
    - O Canavial também tem `alcance_tiles: 4`, com a nota "é o da fazenda". Ficou 4:
      pergunta em aberto.
  - **Reescrita (branch `f-campo-a`, `0733718`, verificada):** F18-ciclo ×3, F-CANA,
    F-CANA-b e F19 (1º milho, fases produtivas), cada um com o que caiu e o que continua
    ao lado. O F-T3-caminho ×2 e o F-T3-ciclo mudaram só de geometria ou de teto
    (alcance 2 e crescer), com a mesma afirmação. A F18h, que o 1 650 sozinho derrubava,
    volta a passar com o alcance 2. typecheck, lint e validate:data limpos.
  - **PARADO — 5 testes afirmam o que continua valendo, e ainda reprovam:**
    - **F18-rocado ×3:** o aceite da F18 ("produz, para quando zeram, volta após
      replantio" e "planta e DEBITA") continua válido. Reprova só no relógio, porque a
      fixture tem 14 tiles e o rodízio semeia todos antes de colher. **Proposta:** uma
      fixture de 1 tile ao alcance, com os ticks derivados de novo. A afirmação fica a
      mesma.
    - **F19 "vazão ≥ 85 % do teto" e "nenhuma gaveta represada":** a entrada do moinho
      termina cheia (m1 5 de 5), e o cuscuz dá 74. **Hipótese da causa:** a fazenda
      passou a entregar mais que o moinho consome, e o oráculo 1:1:1 com
      `farm.sai.corn` 3,0 foi calibrado no modelo antigo. Recalibrar é lote de
      balanceamento (`BALANCE_LOG.md`, 2026-09-27), decisão do operador.
    - **Consequência:** o crescer 1 650 **não** entra na `main` nesta sessão, porque a
      suíte ficaria vermelha com 5.
- **O que é hoje (medido, 2026-09-26)**:
  - `avancarPlantio` (`sim/systems/especialistas.ts:395-406`) ocupa o roceiro por
    `reposicao.ticks` = 150 (30 s na escala `economia` 2,0), que cobre arar, semear **e
    crescer**. O tile não guarda relógio (`resources.json: corn.reposicao._doc`,
    `regenerar` em `sim/recursos.ts`).
  - `melhorTileDeColheita` (`sim/recursos.ts:277`) e `melhorTileParaPlantio` (`:333`)
    devolvem o **primeiro** tile na ordem canônica, e a fazenda só planta se não há
    maduro. O tile que acabou de secar é o primeiro de novo: fica preso.
  - Em 6000 ticks: roceiro 1 tile de 37 (24 milhos); canavial com 12 arados, 1 tile (8
    de cana, o mesmo que com 1 arado).
- **Pergunta 1 — quantos sprites por cultura (resposta proposta)**: **quatro imagens**,
  mas não uma por estado.
  - **Terra não é sprite.** Ela já é o chão `campoArado` que o mapa desenha (F18i).
  - **Crescendo precisa de dois.** Com um só, entre semear e amadurecer o tile muda uma
    vez, e o jogador vê troca, não crescimento. Dois (`crescendo_1`, `crescendo_2`)
    dão três passos visíveis até o maduro.
  - O conjunto fica `semeado`, `crescendo_1`, `crescendo_2`, `maduro`. É a regra do
    animal da Malhada: a sim não tem idade, e o render escolhe o quadro pela fração do
    tempo de crescer (`(tick - semeadoEm) / crescer`).
  - Maduro colhido pela metade (quantidade 3, 2, 1) usa o mesmo `maduro`. Isto é
    hipótese de legibilidade: dá para medir no roteiro da F-CAMPO-b e acrescentar
    `colhido` só se não se ler.
- **Pergunta 2 — vazão da fazenda com doze tiles (conta, número intocado)**:
  - Escala `economia` 2,0: 1 s de dado = 5 ticks. Colheita de `farm.sai.corn` 3.0 =
    100 ticks. Ida e volta ao tile ≈ 105 (medido na calibração, igual com o campo colado
    ou longe). Refeição ≈ 10 por milho.
  - **Hoje:** 150 de plantio + 4 × (100 + 105) = 970 por tile, ou 242,5 por milho, e
    ≈ 250 com a refeição. A sonda desta noite deu 24 milhos em 6000 ticks, 250 por
    milho, e bate.
  - **No modelo novo**, o trabalhador gasta por tile W = (105 + S) + 4 × (100 + 105) =
    925 + S, onde S é o tempo de semear. **O crescer (C) sai da conta dele.**
    - S = 45 ticks (9 s): 242,5 + 10 ≈ 250 por milho, **igual a hoje**, e o 3.0 da
      calibração continua fechando 1 Roçado : 1 Moinho (ciclo do moinho 246).
    - S = 20 (4 s, o da aradura): ≈ 246 por milho, 2 % mais rápido.
  - **Doze tiles não fazem doze vezes mais milho.** O roceiro é um só, e a vazão é
    `min(teto do trabalhador, 4·N / (W + C))` milhos por tick.
    - O que os doze compram é esconder o crescer: o trabalhador não fica ocioso quando
      (N − 1) · W ≥ C.
    - Com W ≈ 950: 2 tiles bastam se C ≤ 950; 5 tiles se C = 3000 (5 min de jogo a
      1x); os 12 saturam até C ≈ 10 400.
  - **Com 1 tile**, o crescer volta para a conta: por milho = (925 + S + C) / 4 + 10.
    C = 150 dá ≈ 290; C = 3000 dá ≈ 1000.
  - **O que o operador decide com isto:**
    - C, que diz quantos tiles uma fazenda "pede". O jogador ara doze e os doze giram,
      mas com C curto a vazão já satura em dois.
    - S, que deixa o 3.0 intacto com 45.
  - **Questão que a conta abre (não decidida):** "duas visitas por ciclo" contra
    `rendimentoPorTile` 4.
    - Hoje o tile maduro rende 4, e cada milho é uma ida ao tile: são 5 visitas por
      ciclo, não 2.
    - Se a segunda visita traz o tile inteiro, W = 210 + S + 400 e o milho sai a
      ≈ 174 ticks. Isso é 43 % mais rápido, o moinho vira o gargalo, e o 3.0 cai.
    - Se o tile passa a render 1, o milho sai a ≈ 350 ticks, 40 % mais lento.
    - Os três caminhos mexem na calibração de modo diferente. A escolha é do operador,
      e o número não gira antes dela.
- **Pergunta 3 — semear ou colher (regra proposta)**: **rodízio**. O prédio guarda o
  último tile que tocou (`prod.cursor`, uma chave), e a busca começa **depois** dele na
  ordem canônica. O primeiro tile que precisa de trabalho, maduro para colher **ou**
  terra para semear, é o escolhido.
  - Nenhum dos dois esfomeia: cada tile ao alcance é visitado no máximo uma volta
    depois de ficar pronto. "Sempre colher antes" semearia só até o primeiro
    amadurecer, e com C curto dois tiles bastariam para nunca faltar maduro: os outros
    dez nunca seriam semeados, que é a objeção do operador.
  - É **regra de classe**: vale para pedreira, lenhador e mina, onde não muda vazão
    (quem esgota já avança), e mata o "sempre o primeiro" em todos.
  - A alternativa, "quem espera há mais tempo", pede um carimbo de tick também na
    terra, e não compra nada que o rodízio não dê.
  - O rodízio troca a intenção escrita em `melhorTileParaPlantio` ("replantar o tile
    que acabou de secar antes do seguinte"). Essa intenção era o defeito.
- **O campo como estado que avança por tick (medido)**:
  - Nada avança por tick. O tile guarda **quando** foi semeado (`semeadoEm: number |
    null`; `null` é terra), e maduro é derivado: `tick ≥ semeadoEm + crescer`.
  - Sem varredura por tick, sem contador por tile, e serializável (é número).
  - A colheita reclama pelo JobBoard só tile derivado maduro. A quantidade 4 nasce no
    primeiro claim ou na maturação. É decisão de implementação, que a F-CAMPO-a mede
    contra o save da F23.
  - **Custo do campo novo, medido compilando** (campo obrigatório em `RecursoNoTile`,
    revertido): **41 erros**.
    - 5 na `sim/`: `campos.ts` 1, `recursos.ts` 4.
    - 36 em teste: 24 só na `F-T2b`, por tiles literais.
  - Alternativa: coleção própria `state.semeaduras`, só dos tiles semeados. Não foi
    medida.
  - O `_doc` de `corn.reposicao` diz que "relógio por tile custaria um campo de estado
    em cada um deles". É esse o preço, e agora ele tem número.
- **A cana**: o mesmo modelo, o mesmo código. `grapes` já é `porAcao` com os números do
  milho. Muda só `crescer` no dado e o sprite. O BUG-N (cana em pousio parecendo mato
  cortado) é o estado **terra** da cana, e continua com a sessão do render.
- **Dado**: `resources.json: tipos.<t>.reposicao` ganha `crescer` e `semear` em
  segundos, grupo `economia`, convertidos no carregamento. `segundos_base` 30 sai: hoje
  ele soma os dois, e ninguém mais o lê. Os valores são decisão do operador (Pergunta 2).
- **Aceite (proposto)**:
  - (a) com 12 tiles arados ao alcance, em 6000 ticks os 12 são semeados e ≥ 10 chegam
    a maduro. Eixo determinístico: tiles distintos tocados.
  - (b) o crescimento corre com o roceiro longe: dois tiles semeados em ticks
    diferentes amadurecem cada um no seu `semeadoEm + crescer`, sem visita no meio.
  - (c) a vazão com 12 tiles e C ≤ W fica a ≤ 5 % da de hoje (≈ 24 em 6000), e o
    1 Roçado : 1 Moinho segue fechando. O mesmo vale para a cana.
  - (d) nenhum tile ao alcance fica mais de uma volta do rodízio sem ser tocado, em
    pedreira, lenhador e mina também.
- **Chave**: F18 fica `true`. O aceite escrito dela ("produz, para quando esgota, volta
  quando replanta") passa com um tile só, e isso é lacuna de aceite (BUG-O).
- **Pergunta em aberto**: a frase do operador sobre os sprites chegou cortada em
  *"desenhada pelo render sobre o tile, nunca"*. O BRIEF-ARTE não completa a frase.

### F17g — A obra revelada pelo hp: madeira e pedra (render)
- **Origem (decisão do operador, 2026-09-26)**: *"troque pela revelação contínua. Duas
  imagens — madeira e pedra — reveladas conforme o hp sobe."* Ela substitui os seis
  estágios da F17e. O aceite da F17e não é reaberto: a F17e entregou o que pedia. Esta
  feature troca o modelo. A arte já segue a regra nova (`docs/BRIEF-ARTE.md` §4).
- **Escopo**: `render/estagio-obra.ts` troca as seis fronteiras por uma **função de
  revelação**. Ela continua em `render/`, pura, com **zero imports**, e a entrada
  continua sendo o `hp`:
  `revelacaoDaObra(hp, hpTotal, timber, stone) -> { madeira: [num, den], pedra: [num, den] }`.
  - As frações saem em **par inteiro** (numerador, denominador), e o render divide só na
    hora de desenhar. É a mesma razão da F17e: a comparação de fronteira não pode ser
    feita em float.
  - Fase da madeira: `hpMadeira = hpTotal × timber / (timber + stone)`. Nos 28 prédios,
    `hp = 50 × (timber + stone)`, então isso é o hp da última tábua.
  - Com `hp ≤ hpMadeira`, a madeira vale `hp / hpMadeira` e a pedra vale 0.
  - Com `hp > hpMadeira`, a madeira vale 1 e a pedra vale
    `(hp − hpMadeira) / (hpTotal − hpMadeira)`.
  - O custo chega pelo funil `render/predios.ts`, como o alvo de nivelamento: a função
    não lê `data/`.
- **O desenho**: `madeira` e `completo` do manifesto, os dois no mesmo canvas, recortados
  **de baixo para cima** pela fração. A madeira fica embaixo e a pedra (o `completo`) por
  cima. Sem PNG, o placeholder faz o mesmo com dois retângulos de cor distinta,
  subindo. Antes da primeira martelada (`hp === 0`), a tela mostra o canteiro da F17d e
  a pilha da F-VIVO-a, como hoje.
- **Contrato que muda**: as chaves de `estados` passam a ser `madeira` e `completo`. A
  regra do manifesto (F17f) recusa as outras quatro. O `storehouse_madeira.png` que já
  existe volta a valer como `madeira`. `debug.estagiosDeObraRenderizados` vira
  `debug.revelacaoDasObras`: o prédio e as duas frações.
- **Os rótulos**: o painel e o medidor da obra deixam de nomear seis estágios e passam a
  duas fases. O tema troca as seis chaves por `madeira` e `pedra` ("madeira subindo",
  "pedra subindo"). O texto final é do tema, não desta nota.
- **Aceite**:
  - Tabela headless dos **dois lados da virada** madeira→pedra em 3 prédios de custo
    diferente: 3/2, 4/3 e 6/6.
  - **Monotonicidade**: varrendo `hp` de 0 a `hpTotal`, nenhuma das duas frações
    diminui, e a soma cresce estritamente a cada 50 de hp.
  - Roteiro que planta uma obra e fotografa três momentos: metade da madeira, virada e
    metade da pedra. Ele afirma pelo `debug` que as frações da tela são as da função.
- **Evidência**: `test-output/F17g.json` + `screenshots/F17g-*.png`. Abrir com Read só o
  do meio da pedra.
- **Nota (o que se perde da arte, medido no worktree do Codex em 59ff42e)**: 24 bases e
  24 derivados de `marcacao`, `fundacao`, `paredes` e `cobertura`, em seis prédios. O
  `estrutura` e o `completo` continuam valendo.
- **Nota (entrega, 2026-09-26): o fallback do operador manda.** *"Prédio sem o par continua
  como está hoje."* Na entrega, as seis chaves continuam aceitas, o placeholder sem PNG
  continua com seis estágios e `estagiosDeObraRenderizados` continua existindo (só o
  fallback), com `revelacaoDasObras` ao lado. Só revela a obra cujo manifesto tem
  `madeira` + `completo` **e** cujas duas texturas carregaram. Os rótulos madeira/pedra
  do tema não foram criados, porque a revelação não escreve texto. Para registrar o par:
  as chaves `madeira` e `completo` em `estados`, e nada mais.
- **Nota (operador, 2026-09-26, depois da entrega):**
  - O `marcacao` do armazém foi **apagado** do manifesto. Era chave morta desde a F17g, e
    quem registrasse a arte não saberia que podia tirar.
  - O placeholder de dois retângulos subindo foi **descartado, não vira item**. O fallback
    dos seis estágios já mostra a obra crescendo, e o placeholder some quando a arte chega.
  - Os rótulos madeira/pedra no tema: confirmado não criar, porque nada os lê.

### F-ESC — A escala do prédio: altura máxima pela largura (render + ferramenta; proposta, não implementar antes do sim do operador)
- **Origem:** pedido do operador, 2026-09-27: medir a altura real dos seis sprites
  contra a largura do footprint e propor a regra "altura máxima como múltiplo da
  largura". Nesta sessão houve **medida e proposta**, nenhum código.
- **Medida (verificada, 2026-09-27)**, lida do cabeçalho IHDR de
  `assets/sprites/<id>/<id>_completo.png`. Nenhum PNG foi aberto. Tile = 64 px.

  | sprite | footprint | arquivo (px) | largura do footprint | altura / largura | altura − fundo×64 |
  |---|---|---|---|---|---|
  | storehouse | 3×3 | 192×198 | 192 | **1,03** | +6 |
  | schoolhouse | 3×3 | 192×192 | 192 | 1,00 | 0 |
  | woodcutters | 3×2 | 192×182 | 192 | 0,95 | +54 |
  | quarry | 3×2 | 192×149 | 192 | 0,78 | +21 |
  | inn | 4×3 | 256×178 | 256 | 0,70 | −14 |
  | sawmill | 4×2 | 256×157 | 256 | **0,61** | +29 |

  Hoje a altura sai da proporção da arte: o derivador corta pelo alfa e escala para
  a largura do footprint (`tools/derivar-sprites.js:84-93`,
  `alturaAlvo = round(recorte.altura × larguraAlvo / recorte.largura)`). Nada limita
  a altura. A faixa é **0,61 a 1,03** da largura.
- **Divergência — confirmada pelo operador (2026-09-27): era o zoom 2×.** O operador citou a Casa do Coronel com
  cerca de 380 px de altura. O arquivo tem 192. **Confirmado pelo operador:** ele viu o
  prédio no zoom 2× (tile de 128 px; os degraus são 32/48/64/96/128), onde 192 × 2 = 384.
  Se ele mediu a base (`assets/base/`, cerca de 1223×1286), o número é outro. A regra
  abaixo vale sobre o **sprite derivado**, não sobre a base.
- **Regra proposta** (para revisão):
  `altura ≤ k × largura desenhada`, com **k = 1,0** e **exceção por prédio no
  dado**, para a torre (F28/F28b) e para o que vier com vocação vertical.
  - Por que 1,0: é o teto que a arte já respeita quase inteira (cinco de seis). No
    3/4 sobre grid quadrado, um prédio mais alto do que largo lê como torre. A
    exceção existe para quando isso for intencional.
  - O que muda **hoje** com k = 1,0: só o armazém, 198 → 192. Isso é −3 % em escala
    uniforme, 186×192 desenhado, e continua ancorado em [0,5, 1]. Nenhum outro sprite
    muda.
  - Alternativa: k = 1,05, que não muda nenhum sprite de hoje e aceita a
    folga do armazém. Recomendo 1,0, porque a folga não tem motivo na arte.
  - **Decisão do operador (2026-09-27): k = 1,0.** "Regra que não muda nenhum sprite não
    é regra." A alternativa 1,05 sai.
  - **Sobre o fator de transbordo** (correção do BRIEF-ARTE, 2026-09-26): ele
    continua esperando o número do operador. Ele multiplica a largura, e a regra
    acima limita a altura **relativa** a essa largura. As duas compõem:
    `largura = footprint × 64 × fator`, `altura ≤ k × largura`. Esta proposta não
    inventa o fator.
  - Onde vive k: `data/terrain.json`, ao lado de `tile_px`. A cena e o teste o leem
    pelo `gameData.terreno.tilePx`. O derivador **não** lê o dado: tem `TILE_PX = 64`
    fixo (`tools/derivar-sprites.js:24`), e passa a ler os dois números do JSON.
    **Decisão do operador (2026-09-27): "corrija junto"**. O `TILE_PX = 64` do derivador
    vira leitura de `data/terrain.json: tile_px` no mesmo commit da F-ESC, não antes. A
    exceção fica na entrada do prédio no `assets/manifest.json`. **A sim não usa k**:
    ele entra pelo loader só porque o `terreno` já vem de lá; se o operador preferir,
    k fica só no manifesto.
- **Os três lugares que mudam juntos** (mapeados e lidos, nenhum editado):
  1. `src/render/scenes/WorldScene.ts:868-872`, `desenharSprite`:
     `setScale(larguraPx / tamanho[0])` passa a
     `min(larguraPx / tamanho[0], k × larguraPx / tamanho[1])`. **Render**: fica para
     quando a outra sessão sair de `src/render/`.
  2. `tests/F17f-manifesto.test.ts:103-105`: além de
     `tamanho[0] === footprint[0] × tilePx` (ou × fator, quando vier), afirma
     `tamanho[1] ≤ k × tamanho[0]`, salvo a exceção declarada.
  3. `tools/derivar-sprites.js:84-93`: se `alturaAlvo > k × larguraAlvo`, escala pela
     altura e a largura cai junto. Isso **regenera o armazém**, e o derivado versionado
     muda, o que é decisão de arte (CLAUDE.md §9).
  - Só o item 1 está em `src/render/`. Os itens 2 e 3 não são render, mas o 3 muda
    asset versionado e o 2 afirma o que o 3 produz. Por isso os três vão num commit só.
- **Aceite (a escrever na implementação, rascunho):**
  - a) nenhum sprite de prédio no manifesto passa de `k × largura` sem exceção
    declarada (F17f);
  - b) o armazém derivado sai com altura ≤ largura;
  - c) screenshot do roteiro da F17 mostra os seis prédios, e o
    `test-output/F-ESC.json` grava a caixa desenhada de cada um, medida no passo e
    não descrita.
- **Espera:** k já está decidido (1,0). Faltam a exceção por prédio, o fator de
  transbordo (se ele quiser as duas mudanças no mesmo commit) e a tabela da régua do
  homem abaixo. Continua sem implementar: o item 1 é render, e a outra sessão está lá.
- **Extensão (pedido do operador, 2026-09-27): a régua é o HOMEM, não o tile.** Na tela
  dele, a árvore saiu do tamanho do serf e o mandacaru mais alto que a casa. Pediu a
  tabela em alturas de cangaceiro (H) e o desvio de cada asset atual. **Nada aplicado.**
  - **Medida (verificada, 2026-09-27):** altura visível = linhas com alfa > 16, lida
    do PNG por script. Nenhuma imagem foi aberta com Read. A fonte é a branch
    `feat/ui-world-polish` em `f9e7b5a`, que é a arte que a tela mostra hoje. Nessa
    branch o armazém derivado tem 192×182, e na `main` ainda 192×198: a tabela de
    cima é da `main`. **H = serf, 73 px.** As unidades vão de 69 (laborer) a 77 (Cabra),
    e o knight tem 98, montado.
  - Alvo (operador): casa térrea ~2,5 H = 182 px; sobrado ~3,5 H = 255; mandacaru ~2,2 H
    = 161; árvore adulta ~3,0 H = 219; arbusto ~0,6 H = 44.

    | asset | classe (alvo) | visível (px) | em H | alvo (px) | desvio |
    |---|---|---|---|---|---|
    | storehouse | térrea | 182 | 2,49 | 182 | 0 % |
    | woodcutters | térrea | 182 | 2,49 | 182 | 0 % |
    | inn | térrea | 178 | 2,44 | 182 | −2 % |
    | sawmill | térrea | 157 | 2,15 | 182 | −14 % |
    | quarry | térrea | 149 | 2,04 | 182 | −18 % |
    | schoolhouse | sobrado (hipótese) | 179 | 2,45 | 255 | **−30 %** |
    | tree | árvore | 77 | 1,05 | 219 | **−65 %** |
    | umbuzeiro | árvore (hipótese) | 62 | 0,85 | 219 | **−72 %** |
    | mandacaru | mandacaru | 120 | 1,64 | 161 | −25 % |
    | facheiro | mandacaru? (operador) | 120 | 1,64 | 161 | −25 % |
    | xique-xique | mandacaru ou arbusto? (operador) | 120 | 1,64 | 161 / 44 | −25 % / +173 % |
    | macambira | arbusto | 64 | 0,88 | 44 | **+46 %** |

  - **O que a tabela confirma:** "árvore do tamanho do serf" é medida: 77 contra 73. A
    árvore é o maior desvio da tabela.
  - **O que ela não confirma:** "mandacaru mais alto que a casa" **não** se reproduz em
    altura total (120 contra 149 a 182). **Hipótese:** o olho compara com a *elevação*
    da casa (do chão ao cume), não com a caixa inteira. A caixa inclui a profundidade do
    telhado em 3/4. A conta ingênua `altura − fundo × 64` dá de −14 a +54 px, abaixo do
    mandacaru, o que é compatível. Para ter a elevação de verdade, é preciso medir
    beiral e cume na arte, e isso não foi medido. **A comparação casa × planta em H
    fica frouxa até essa medida existir**, porque a altura total da casa não é a mesma
    grandeza da altura da planta.
  - **Conflito com k = 1,0 (para decisão):** o sobrado a 3,5 H = 255 px num footprint
    3 (192 px) dá 1,33 × largura, e k = 1,0 o recusa. As saídas são um fator de
    transbordo ≥ 1,33 para ele, uma exceção por prédio no manifesto, ou o sobrado
    ocupar 4 de largura. A térrea a 2,5 H = 182 cabe em k = 1,0 só com footprint ≥ 3:
    prédio de 2 de largura (128 px) teria o mesmo conflito. Hoje não há nenhum entre os
    seis. A vegetação **não** está sob k, que é regra de prédio; a árvore a 219 px sobre
    1 tile é o que o alvo pede.
  - **Decisão do operador (2026-09-27): exceção por prédio, declarada no dado.** k = 1,0 é
    o padrão; o sobrado, de dois andares, e a torre declaram o próprio fator. **O
    footprint não muda para caber arte:** é dado de simulação. A saída "sobrado em
    largura 4" está descartada.
  - **A árvore (operador, 2026-09-27):** 1,05 H contra 3,0 H da tabela, **−65 %**. É o
    maior desvio da régua e o mais visível na tela: o serf é quase do tamanho da árvore
    que ele derruba. **Não se mexe agora:** a arte é da outra sessão. O número fica
    registrado aqui para quando ela entrar.
  - **Medida no KaM original (2026-09-27, `tools/kam-medir.js`, cabeçalho dos `.rx`
    da instalação do operador).** A tabela e a leitura estão no `docs/BRIEF-ARTE.md`,
    bloco "MEDIDO NO KAM". O que toca esta feature:
    - **k = 1,0 é o KaM.** Sem a torre, a altura sobre a largura do sprite vai de 0,61 a
      1,02 (mediana 0,76) nos 27 prédios. **A única exceção é a torre de vigia: 1,27.**
      É a mesma regra que o operador decidiu: padrão 1,0, exceção declarada.
    - **Árvore:** a adulta do KaM mede 2,2–3,25 H (mediana 2,65 H), com H = serf. O
      alvo 3,0 H está dentro da faixa, perto do topo. A nossa, com 1,05 H, fica abaixo
      da menor árvore do KaM.
    - **O footprint não vem do `houses.dat`:** o `BuildArea` do binário não é o lote.
      O lote é o `PlanYX` do código do kam_remake, conferido no `KM_Terrain.pas`.
  - **Decisão do operador (2026-09-27): fator de transbordo de largura 1,0, com
    exceções.** Não 1,15. O 1,15 do KaM provavelmente inclui a sombra, que o KaM desenha
    dentro do sprite e nós não. Sem ela, o 1,02 medido confirma o limite. Com isso
    `largura = footprint × 64` continua valendo para o padrão, e a exceção se declara no
    dado, prédio a prédio.
  - **Decisão do operador (2026-09-27): a tradução é pelo HOMEM, não pelo lote.** A
    térrea fica com **182 px** (2,5 H), e não com 159 (0,83 × 192). *"O jogador julga o
    prédio contra as pessoas que andam ao lado, não contra um tile que ele não
    enxerga."* **Consequência, esperada e não defeito:** o nosso tile vale 0,88 H, e o do
    KaM 1,0 H, então os nossos prédios transbordam mais do lote do que os de lá.
  - **Espera, depois destas duas decisões:** só a outra sessão sair de `src/render/`
    (item 1) e a lista das exceções por prédio (sobrado, torre).
  - **Classificação em aberto (operador):** Casa do Coronel como sobrado é hipótese
    minha, pelo nome. O umbuzeiro como árvore adulta também. Facheiro e xique-xique
    ficam para o operador: o facheiro é colunar como o mandacaru, e o xique-xique é
    baixo e rasteiro, o que puxaria para arbusto.
  - **Registro de arte:** a regra ("a régua é o homem; toda arte nova declara sua
    altura em H antes de ser gerada") está em `docs/BRIEF-ARTE.md`, seção "Tamanho e
    âncora".

### F-VIVO — O prédio vivo: trabalho, estoque e animais (render)

Camadas ancoradas sobre o sprite estático (`docs/BRIEF-ARTE.md` §4a): laço de trabalho,
fumaça, pilha por unidade na entrada e na saída, animais do curral. Só render: nada em `sim/`.

- **F-VIVO-c e F-VIVO-d fora da fila (decisão do operador, 2026-09-27)**: são render, e
  outra sessão trabalha em `src/render/` e `src/ui/` numa branch. Voltam à fila quando
  ela mergear. A ordem delas não muda.

- **Nota (decisões do operador, 2026-09-26):**
  - Estoque **por unidade**: 28 imagens, e o render empilha até 5.
  - Laço de 8 quadros, e 4 na luz. A duração vem de repetir o laço.
  - A idade dos animais o render **deriva** do progresso da receita. A sim não muda.
  - O caso 1 não tem animação.
  - A regra do zoom está no brief.
  - Armazém: 4 pontos, mostrando as quatro mercadorias mais abundantes. A ordem é por
    quantidade, com desempate pela ordem de `economia.mercadorias`. **Se isso fizer o
    armazém piscar quando duas mercadorias se alternam, reportar ao operador**; a saída é
    fixar a ordem pelo dado.
- **Nota (revogada pelo operador em 2026-09-26):** os tipos novos iam entrar no
  manifesto só nesta feature. Eles entram antes, na **F-VIVO-0**, para destravar a
  derivação da arte.
- **Medição do kam_remake: os estágios de obra** (2026-09-26, lida no código da `master`
  em `src/houses/KM_Houses.pas` e `src/render/KM_RenderPool.pas`, com o detalhe no
  `PROGRESS.md`).
  - O original **não tem 20 imagens de obra.** Cada casa tem duas imagens, a de madeira
    (`WoodPic`) e a de pedra (`StonePic`). As duas se **revelam aos poucos** por alpha
    test, com um progresso contínuo de 0 a 1: primeiro toda a madeira, depois a pedra
    por cima, com a madeira ainda visível embaixo.
  - Cada martelada soma 5 de esforço, e cada material vale 50, ou seja, 10 marteladas.
    Os "mais de 20 estágios" são esses **degraus da revelação**
    (10 × (madeira + pedra) por casa), e não arte.
  - **O material na obra é uma pilha por quantidade:** o sprite `260+n-1` para a
    madeira e `267+n-1` para a pedra, cada um num ponto próprio da casa
    (`BuildSupply[material, n]`). O que aparece é o que foi entregue e ainda não foi
    pregado. É o **mesmo mecanismo** do estoque da casa pronta (`AddHouseSupply`), e
    fica ao lado do trabalho (`AddHouseWork`). Peça de obra, estoque e trabalho são,
    portanto, camadas sobre a imagem da casa. A obra, porém, não é uma pilha de 20
    imagens.
  - **O que isso muda aqui:** a pilha da obra entra na F-VIVO como quarto uso da
    `pilha`. A tábua e a pedra já estão entre as 28 mercadorias, então não há arte
    nova. ~~As seis imagens da F17e ficam~~ — **respondido pelo operador
    (2026-09-26, noite 7): as seis saem, e a obra passa a ser duas imagens reveladas
    pelo hp (F17g, BRIEF-ARTE §4).** A pilha da obra não muda com isso: ela lê
    `faltam` e `hp`, não o estágio.

A feature é grande (três camadas e quatro usos da pilha) e sai em **cinco sub-itens**,
cada um com seu aceite, na ordem da tabela. A F-VIVO-0 destrava o Codex. Os outros só
leem `GameState`: **nenhum toca em `sim/`**.

| sub-item | o que entra | depende de |
|---|---|---|
| F-VIVO-0 | o manifesto aceita `trabalho`, `pilha` e `animal`, e o campo `ancoras` na entrada de prédio; o `F17f` valida os dois | — |
| F-VIVO-a | a pilha: estoque de entrada e saída, armazém com as quatro maiores, Bodega e obra | 0 |
| F-VIVO-b | o trabalho: laços por caso, repetição pela duração do ciclo, fumaça e luz das minas | 0 |
| F-VIVO-c | os animais: 5 no curral, com a idade derivada do progresso | 0, a |
| F-VIVO-d | o roteiro de conjunto: uma aldeia com os cinco casos, capturada a 0,75, para que a hipótese do zoom no brief vire medida | a, b, c |

**Regras comuns aos sub-itens** (decisões minhas, marcadas para o operador revisar):
- **Arte que falta vira placeholder, nunca buraco** (CLAUDE.md §9), para que cada
  sub-item se verifique sem arte:
  - a pilha sem PNG é um quadrado de ¼ de tile, com a cor de `theme-sertao.json`
    (**entregue com ⅕**, na F-VIVO-a: com ¼, as quatro pilhas do armazém se sobrepõem
    numa base de 3 tiles — decisão de implementação, registrada no PROGRESS);
  - o quadro de trabalho sem PNG é um retângulo na `area`, com `<laco>_<n>` escrito;
  - o animal sem PNG é um losango do tamanho da idade.
- **Prédio sem `ancoras` usa âncoras padrão, derivadas do footprint.** A entrada fica à
  esquerda da porta e a saída à direita, ambas na linha da base; o curral vai em fila
  sobre a metade de trás. O padrão serve só ao placeholder: quando a entrada declara
  `ancoras`, valem as declaradas.
- **Cada camada é uma função pura**, que lê o estado e devolve o que desenhar, como
  `estagio-obra.ts`. O Phaser só desenha a lista. O teste afirma a função em Node, sem
  tela, e o roteiro afirma o contador `debug`.

**Aceite da F-VIVO-0.**
- `EntradaDeCamada` aceita os tipos `trabalho`, `pilha` e `animal`. O
  `tests/F17f-manifesto.test.ts` valida cada um pelas regras do brief §4a:
  - `pilha`: o `id` está em `economia.mercadorias`, e o único estado é `unidade`;
  - `animal`: o `id` é mercadoria de saída de uma receita de criação, com os estados
    `idade{1..3}_{1..4}`;
  - `trabalho`: o `id` é prédio com receita, ou `fumaca`; os estados são os laços do
    caso daquele prédio, de 1 a 8 (`luz_1..4` nas minas); e todos os quadros do mesmo
    prédio têm o mesmo `tamanho`.
- `EntradaDeAsset` aceita `ancoras` opcional, e o teste valida que:
  - as frações estão em [0, 1];
  - em `area`, `x0 < x1` e `y0 < y1`;
  - a contagem de pontos de estoque bate com `entra` e `sai` da receita (4 de entrada na
    Bodega, 4 no armazém);
  - `curral` tem 5 pontos e só aparece na Malhada e na Cocheira;
  - `obra` tem um ponto por material de `custoDoPredio`;
  - as áreas não se sobrepõem: os pontos de estoque e do curral ficam fora de `area`.
- Cada regra tem um **caso que reprova** no teste, num manifesto escrito no próprio
  teste (o molde da F17f de 2026-09-26). **Não toca em `assets/`.**

**Aceite da F-VIVO-a (a pilha).**
- `pilhasDoPredio(predio, dados)` é pura e devolve (ponto, mercadoria, n), com
  `n = min(quantidade, 5)`, empilhados três embaixo e dois em cima:
  - no prédio completo, as gavetas `entrada` e `saida`, na ordem da receita;
  - no armazém, as quatro mercadorias de maior quantidade, com desempate pela ordem de
    `economia.mercadorias`;
  - na Bodega, as quatro comidas;
  - **na obra**, a tábua e a pedra entregues e ainda não pregadas:
    `entregues − ⌈hp / hpPorMaterialEntregue⌉`, com o consumo saindo **primeiro da
    tábua**, como no original. A unidade sai da pilha quando a primeira martelada começa
    nela, como no `IncBuildingProgress`. O valor é derivado, sem campo novo na sim.
- O teste afirma a tabela de cada caso, os dois lados do teto 5, o desempate do armazém
  e a obra em três momentos: nada entregue, entregue sem martelada e tudo pregado.
- **Teste do pisca.** Num cenário longo (a vila da calibração, 6 000 ticks), conta
  quantas vezes o conjunto das quatro do armazém muda. Se passar de uma troca por 100
  ticks em média, **o sub-item para e reporta ao operador** (nota do operador acima). O
  número vai para `test-output/F-VIVO-a.json`.
- `npm run shot -- F-VIVO-a` mostra uma obra com pilha, uma pedreira com saída e o
  armazém, e afirma `debug.pilhasDesenhadas` por prédio. A screenshot é aberta.
- **Entregue (2026-09-26, noite 8).** Pisca: 6 trocas em 6 000 ticks (0,1 por 100).
  Roteiro na geometria da F-T3 (a da F16b não tem rocha ao alcance).

**Aceite da F-VIVO-b (o trabalho).**
- `quadroDeTrabalho(predio, unidade, tick, dados)` é pura e devolve (laco, n) ou `null`:
  - caso 1: `null`, e só fumaça, quando o prédio declara `fumaca`;
  - caso 2: `inicio`, `meio` e `fim` pelos terços do `progresso` da receita, com o `meio`
    repetido até encher o terço;
  - casos 3 e 5: `laco1` e `laco2` se alternando a cada laço completo;
  - caso 4: `luz`.
- Sem ocupante, parado por falta de insumo, com a saída cheia ou pausado, o resultado é
  `null`. **Prédio parado não anima.** O número de repetições vem de `ticksDoCiclo`; o
  render não inventa duração.
- O teste afirma, por caso:
  - a sequência de um ciclo inteiro;
  - o `null` nos quatro estados parados;
  - que o `n` avança e volta a 1 sem pulo.
- O roteiro despausa 3 s e afirma que `debug.quadrosDeTrabalho` avançou nos prédios
  ocupados e ficou parado no pausado. Faz a captura.
- **Entregue (2026-09-26, noite 12).** `src/render/trabalho.ts`,
  `tests/F-VIVO-b-trabalho.test.ts`, evidência em `test-output/F-VIVO-b.json`, roteiro
  `tools/shots/F-VIVO-b.js`. Um quadro por tick (`TICKS_POR_QUADRO = 1`). No caso 2
  o relógio anda com o trabalhador no tile (`colhendo`), e o laço aparece no prédio
  enquanto ele está no campo: pergunta em aberto no `PROGRESS.md`.

**Aceite da F-VIVO-c (os animais).**
- `animaisDoCurral(predio, dados)` é pura e devolve 5 posições, com a idade de 1 a 3
  **derivada do progresso**: a posição i tem idade `1 + ⌊3·frac(p + i/5)⌋`. A
  defasagem existe para que os cinco não cresçam juntos. Prédio vazio ou sem insumo tem
  o curral vazio.
- O teste afirma:
  - a idade nos dois lados de cada fronteira;
  - que ela nunca volta dentro de um ciclo, exceto na posição que acabou de virar
    mercadoria;
  - o curral vazio.
- Roteiro com a Malhada ocupada e alimentada, com a screenshot aberta.

**Aceite da F-VIVO-d.** Uma aldeia com os cinco casos, capturada a 0,75. O roteiro
grava em `test-output/F-VIVO-d.json` o tamanho em px de cada camada, e o
`docs/BRIEF-ARTE.md` troca a "hipótese até medir" da regra do zoom pelo número medido.

---

### UI-barra-a — A barra lateral única (ui + roteiros)

- **Origem:** decisão do operador, 2026-09-26, sobre a medição e a proposta em
  `docs/propostas/barra-lateral-unica.md`. O desenho que vale está na seção "Decisões
  do operador" desse arquivo.
- **Posição na fila:** escrita aqui depois da F-VIVO. A ordem entre ela, a F-VIVO-c/d
  e a Fase C é decisão do operador.
- **A razão é a seleção.** A 1280×720, o mapa cai para 58,9 % quando há prédio
  escolhido, porque o balcão se soma à coluna. O ganho em repouso é pequeno.
- **Escopo:** `index.html`, `src/ui/`, CSS, `data/theme-sertao.json` e roteiros.
  **Nada em `sim/` nem em `src/render/`.**
  - O minimapa é da F33 (render). Aqui é só a moldura com o placeholder.
- **O desenho:**
  - uma coluna à **esquerda**, **fixa em 260 px**, na altura inteira;
  - nada no topo nem embaixo;
  - não recolhe;
  - de cima para baixo:
    1. logo com moldura;
    2. logo abaixo da logo, a dica do H, com a regra da F-D1: só na primeira partida,
       até o primeiro H, independente de alerta (operador, 2026-09-26: o pé é o último
       lugar onde o jogador novo olha);
    3. minimapa (reservado), com o carimbo PAUSADO e a velocidade;
    4. os cinco recursos em lista;
    5. a faixa fixa de alertas, **vazia quando não há alerta**;
    6. as abas do GDD §7.1: Construir, Distribuição (cadeado), Estatísticas (cadeado)
       e Opções;
    7. o corpo da aba: a grade de hoje (5 × 40 px, bloqueado com cadeado) **ou**, com
       seleção, o painel do prédio empilhado, com a fila da escola dentro do painel da
       Casa do Coronel;
    8. a faixa da marca com o lema.
  - O balcão (`#balcao`, `data-balcao`, a alça) e o `data-prancha` saem.
  - O `#hud` como faixa sai. O destino de cada peça está na tabela da proposta.
  - A aba Construir com seleção volta à grade, como o `Esc`.
- **Tema:**
  - `painelPredio.hp` = "Vida";
  - o lema "TERRA FORTE, GENTE VALENTE";
  - o rótulo curto `civis.<id>.curto`: por enquanto só `stonemason` = "Pedreiro",
    **já no tema** (2026-09-26). **Esta feature é quem o lê.** O botão de engajar usa o
    curto, se houver; o slot da fila e o `title` usam o `nome`.
- **Arte:** logo, moldura e silhueta do cangaceiro entram por decisão humana (§9). Até
  lá, placeholder com o `id` escrito. A marca é **cortada na borda da barra**: nada
  transborda sobre o canvas.
- **Aceite:**
  - A 1280×720 e a 1920×1080, com e sem prédio escolhido, o canvas mede
    (W − 260) × H. A área **não muda** com a seleção.
  - `canvas.left >= barra.right`. Nenhum elemento da barra, marca inclusa, intercepta
    clique sobre o canvas: amostra de `elementFromPoint` na coluna de x = barra.right
    + 1.
  - A barra não passa da altura da tela. O que não cabe rola **dentro do corpo da aba**.
    O roteiro mede e registra a altura do corpo a 720 e a 1080.
  - Escolher um prédio troca a grade pelo painel. `Esc` e a aba Construir voltam à
    grade. A escola mostra a fila, e o engajar em **2 colunas com rolagem** (decisão do
    operador: 3 colunas só cabiam raspando). Nenhum botão de engajar tem
    `scrollWidth > clientWidth`.
  - Os alertas continuam clicáveis e levando a câmera (o roteiro da F22 passa com os
    seletores novos). Um alerta que aparece não desloca a grade (altura fixa medida).
  - Os roteiros que citam `#hud`, `#menu-build`/`data-prancha` ou `#balcao` são
    atualizados:
    - na medição, 11, 10 e 2;
    - no F06, "canvas abaixo do HUD" sai e a asserção de lado se inverte;
    - os passos que clicam na barra seguem a §8 do CLAUDE.md: despausado, segurando
      150 ms.
  - Screenshot a 1280×720 com a escola escolhida, aberto.
- **Fora:** o minimapa real (F33), Distribuição (F31), Estatísticas (F32), a arte da
  marca e a tela cheia (`IDEIAS.md`).
- **Entregue (2026-09-26, noite 14).** Duas coisas que o operador pediu depois de ver
  a barra entraram aqui, porque o defeito nasceu com ela:
  - a **sombra do pé**: `data-ha-mais` no `#corpo-aba`, com a regra pura
    `haConteudoAbaixo` em `ui/barra.ts`; ela some no fim da rolagem;
  - o **cartão que piscava** sob o mouse parado: a guarda fica no `pointerleave` do
    ícone, em `ui/menu-build.ts`.
  Os dois têm asserção no roteiro. O helper `pontoParaApertar`, em
  `tools/shots/_canvas.js`, é o aperto que rola até o botão e reprova se ele estiver
  coberto.

### F-DEV — O `npm run dev` recusa porta ocupada e não deixa órfão (ferramenta)
- **Origem (operador, 2026-09-26):** o BUG-K consertou o `tools/shot.js`, mas o
  `npm run dev` continua deixando órfão.
- **O padrão, verificado nesta sessão:**
  - `"dev": "vite"` sobe o servidor por `npm` → `cmd.exe` → `node vite.js`.
  - Parar o `npm` mata o `cmd` e deixa o `node vite.js`, neto, escutando a porta.
  - Foi o caso do `npm run dev` da UI-barra-a (PIDs 4064/32576). Ele ficou de pé
    depois de o agente dizer que estava desligado, e a carga dele derrubou o
    `npm run verify` por timeout duas vezes.
  - Sem `--strictPort`, o vite seguinte pula calado para a próxima porta livre. O
    órfão continua servindo a árvore velha, e ninguém avisa.
  - É o mesmo defeito que o BUG-K matou no roteiro, com as duas armas prontas em
    `tools/shot.js`: `portaJaResponde` (recusa antes de subir) e `derrubarServidor`
    (`taskkill /pid <p> /T /F`, desce a árvore).
- **Escopo:**
  - Um `tools/dev.js` que o `"dev"` do `package.json` chama. Ele pergunta à porta
    (5173, ou `CANGACO_DEV_PORTA`) antes de subir.
  - Se ela já responde, recusa com a mesma frase do roteiro, que nomeia o
    `netstat -ano | findstr :<porta>`, e sai com código ≠ 0.
  - Se está livre, sobe o vite com `--strictPort` e, no `SIGINT`/`SIGTERM`/`exit`,
    derruba a árvore inteira por `taskkill /T`.
  - As duas funções saem de `tools/shot.js` para um módulo comum, e o roteiro passa a
    importá-las. Duas cópias da mesma defesa divergem.
- **Aceite:**
  - (a) com um servidor qualquer escutando a porta, `npm run dev` sai com código ≠ 0,
    a mensagem nomeia a porta, e nenhum vite novo fica de pé;
  - (b) com a porta livre, `npm run dev` sobe e responde, e depois de parado (Ctrl+C,
    ou kill do pid do `npm`) nenhum processo escuta a porta, conferido por `netstat`;
  - (c) os roteiros seguem verdes com o módulo comum.
- **Fora:** matar o dono da porta ocupada. Recusar e nomear basta: o dono pode ser
  a sessão de outra pessoa (os 5188/5189 desta noite eram do operador).
- **Entregue (2026-09-26, noite 17).** `tools/dev.js` + `tools/_servidor.js`. Além do
  escopo, uma vigia: matar só o pid do `npm` não manda sinal a ninguém, então o
  `dev.js` pergunta a cada segundo se o pai (`cmd`) e o avô (`npm`) seguem vivos, e
  derruba a árvore do vite quando um morre. Ctrl+C não tem prova automatizada.

## Fase C — Militar

### F24a — As armas separadas nas seis do GDD (dado + sim)
- **Origem (decisão do operador, 2026-09-26)**: *"separe nas seis do GDD §4.1 — facão,
  peixeira, aguilhada, ferrão, bodoque, bacamarte. O Anexo A diz qual tropa usa cada uma,
  e sem isso o Quartel não tem o que consumir."* É pré-requisito da Fase C e entra
  **antes da F24**. O detalhe medido está no `IDEIAS.md` (armas genéricas), e este item o
  tira de lá.
- **O que já existe, medido em 2026-09-26**: os seis ids e as quatro proteções **já estão**
  em `economy.json` `mercadorias`: `hand_axe`, `sword`, `lance`, `pike`, `longbow`,
  `crossbow`, `leather_armor`, `iron_armor`, `wooden_shield` e `iron_shield`. O tema já os
  nomeia: Facão, Peixeira, Aguilhada, Ferrão, Bodoque, Bacamarte. O que falta é **quem
  produz**. Três receitas saem com ids agregados, fora da lista, e a saída some
  (`depositar`, nota da F24):

  | Prédio | Receita hoje | Passa a sair (GDD §4.1) |
  |---|---|---|
  | `weapons_workshop` | `arma_madeira` | `hand_axe` (facão), `lance` (aguilhada), `longbow` (bodoque) |
  | `weapon_smithy` | `arma_ferro` | `sword` (peixeira), `pike` (ferrão), `crossbow` (bacamarte) |
  | `armor_smithy` | `armadura_ferro` | `iron_armor`, `iron_shield` |

  A `armory_workshop` já sai com ids certos (`leather_armor` + `wooden_shield`).
- **Quem usa cada uma (Anexo A §12.1)**:

  | Arma | Tropa |
  |---|---|
  | facão (`hand_axe`) | Militia, Axe fighter, Scout |
  | peixeira (`sword`) | Sword fighter, Knight |
  | aguilhada (`lance`) | Lance carrier |
  | ferrão (`pike`) | Pikeman |
  | bodoque (`longbow`) | Bowman |
  | bacamarte (`crossbow`) | Crossbowman |

- **Escopo**:
  - As três receitas passam a declarar as saídas possíveis.
  - A oficina escolhe **qual** fazer a cada ciclo, pela **cota por arma** do GDD §2.3
    (*"Oficinas: quantas de cada arma produzir"*). O comando novo fixa a cota. Sem cota,
    o default é rodízio fixo na ordem da tabela. É determinístico e não usa RNG.
  - Uma regra no `validate:data` recusa qualquer id em `production.receitas.*.sai` fora
    de `economy.mercadorias`. É a regra que a nota da F24 pede.
  - Os três ids agregados saem do dado e do tema.
- **Aceite**:
  - Cada uma das três oficinas, pelo caminho real (construída, ocupada, abastecida),
    deposita no armazém **cada** uma das suas saídas numa corrida longa, com o rodízio
    default.
  - Com a cota fixada pelo comando, só sai a arma pedida.
  - `validate:data` reprova um `data/` sintético com `arma_madeira` numa receita.
  - Nenhum id de `production.receitas.*.sai` fica fora de `economy.mercadorias`, provado
    por igualdade de conjuntos e não por varredura de texto.
- **Fora**: o painel da cota (ui) é sub-item, se a feature não couber numa sessão.
  Nenhuma tropa consome arma aqui: isso é a F25.
- **Nota (pilha)**: com os ids reais, a pilha de cada arma é a da mercadoria
  (`docs/BRIEF-ARTE.md` §4a). A nota da F24 sobre pilhas fica atendida aqui.
- **Entregue (2026-09-26)**: `tests/F24a-armas.test.ts`, evidência em
  `test-output/F24a.json`. Comando `SetProductionQuota { predio, cota }`; marca
  `escolheSaida` na receita; `producao/saida-desconhecida` no `validate:data`. O painel
  da cota ficou de fora e é o sub-item **F24a-ui**, que ainda não foi escrito.

### F24 — Weapons workshop e cadeia de couro
- **Nota (F24a entregue, 2026-09-26)**: as duas notas abaixo **já estão atendidas pela
  F24a**, e ficam aqui como histórico. As três casas saem armas reais, que chegam ao
  armazém pelo caminho real. A regra `producao/saida-desconhecida` existe, e a saída
  tem pilha. O que resta da F24 é a cadeia de couro.
- **Nota (decisão do operador, 2026-09-26): as pilhas das armas nascem com as armas.**
  A Casa de Armas de Madeira, a Ferraria e a Casa do Ferro produzem `arma_madeira`,
  `arma_ferro` e `armadura_ferro`, que não estão em `economia.mercadorias`. Por isso a
  saída delas não tem pilha no estoque visível (`docs/BRIEF-ARTE.md` §4a), e isso não é
  defeito de arte nem de render. É a mesma lacuna das seis armas do GDD §4.1, registrada
  no `IDEIAS.md` como pré-requisito da Fase C. Quando o Quartel existir e as armas
  tiverem id em `economy.json`, cada uma ganha a sua `pilha` (uma imagem por mercadoria)
  e os pontos de saída desses três prédios passam a mostrar alguma coisa.
- **Nota (medido em 2026-09-26, panorama dos 28 prédios, `PROGRESS.md`): hoje a saída SOME.**
  `depositar` (`src/sim/systems/especialistas.ts`) só deposita o que está em
  `economia.mercadorias`. Por isso as três casas consomem o insumo, fecham o ciclo e não
  entregam nada, sem evento `goods-produced`. O aceite da F24 herda duas coisas:
  - a saída das três casas chega ao armazém, pelo caminho real;
  - uma regra no `validate:data` que recusa id em `production.receitas.*.sai` fora de
    `economy.mercadorias`. Hoje nenhuma regra confere isso, e por isso o buraco passou.
### F25 — Barracks e criação de soldado
- **Nota (decisão do operador, 2026-09-26): a arte dos mercenários espera o Quartel.**
  Os cinco mercenários (`rebel`, `rogue`, `vagabond`, `barbarian`, `warrior`) ficaram
  fora da arte: `data/units.json` não declara `direcoesDeSprite` para eles e
  `data/theme-sertao.json` não descreve a arma. O operador decide as duas lacunas
  quando o Quartel existir. Até lá, `docs/BRIEF-ARTE.md` manda não gerar mercenário.
### F26 — Seleção e movimento de grupo
- **Nota (herdada da F18f, 2026-09-24)**: o desenho da unidade sai do centro do
  tile por um deslocamento de até ±16 px derivado do id. **O teste de acerto do
  clique tem de usar a MESMA função de deslocamento** — se ele mirar o centro do
  tile, o clique erra a unidade por até 16 px, e erra mais quanto mais cheio o
  tile estiver, que é justamente onde selecionar importa.
### F27 — Formação, virar e storm attack
### F28 — Combate e IA inimiga simples

### F28b — Torre de Pedra: o recruta atira pedra de cima (sim + render)
- **Feature de integração (§10 do CLAUDE.md; decisão do operador, 2026-09-27)**: toca
  `src/sim/` (munição, alvo, tiro) e `src/render/` (o tiro na tela) no mesmo item, por
  exceção escrita aqui. A exceção vale **só** para esta feature; nenhuma outra a herda.
- **Origem (decisão do operador, 2026-09-26)**: *"A Torre é defesa e entra com a Fase
  C."* Hoje a `watchtower` constrói, mas é casca (panorama dos 28 prédios, `PROGRESS.md`
  2026-09-26 noite 3). Ela vem depois da F28 porque atira em inimigo, e inimigo só
  existe lá.
- **O que o dado já diz** (GDD §5.2, `data/combat.json` `watchtower`): 2×2, ocupada por
  um **Recruit**. Guarda até **5 pedras** (`municao_stone_max`), atira até **6 tiles**
  (`alcance_tiles`) e **mata num golpe** (`mataEmUmGolpe`). O abastecimento de pedra
  passa pelo JobBoard, como o de qualquer prédio consumidor.
- **Escopo**: o Recruit ocupa a torre, a pedra chega como insumo e cada tiro gasta uma.
  A escolha do alvo usa ordem determinística: o inimigo mais perto e, no empate, o de
  menor id. O tiro é evento (`state.events`). A pedra que cai não volta.
- **Aceite**: uma torre abastecida mata inimigos dentro do alcance até a pedra acabar e
  não atira fora dele. A contagem de pedras gastas é igual à de mortos. Sem pedra, a
  torre não atira, e o painel diz por quê.
- **Fora**: a névoa de guerra que a torre revela (GDD §6.5) fica para depois, com
  registro.
---

### F18c-2 — Recentrar a vila
- **Escopo**: o gerador deriva da vila o lajedo, o açude, o mato e o roçado, a vila
  vai para o centro, o mapa é gerado de novo e a calibração da F-CAL-b é refeita.
- **Aceite**: o original da F18c, com a regra do centro da caixa em
  `tools/data-rules.js`, mais os 9 arquivos de geografia verdes no mapa novo.
- **Nota (fica aqui de propósito)**: o item está depois da Fase C por decisão do
  operador (2026-09-26); a origem e a medida estão na F18c, na Fase B.
- **Nota (herdada da F18c-1c)**: `npm run verify` roda a suite no mundo transladado
  (`vitest.transladado.config.mts`). Os testes em `FORA_DO_MUNDO_TRANSLADADO`
  afirmam o arquivo do mapa, e o mapa novo desta feature os toca: o F-D3 (byte a
  byte) e o "publica 128x128" / "área ×4" do F18b. O guarda de borda do F18b já roda
  em mapa liso sem prédio (decisão do operador), e por isso a vila recentrada em
  (63,63) não o derruba. Confira a lista antes de gerar o mapa.

## Fase D — Profundidade

### F29 — Ferro e smithies
### F30 — Armazém com toggles por mercadoria
### F31 — Menu de distribuição
### F32 — Aba de estatísticas
### F33 — Minimapa
### F34 — Condições de vitória e derrota (escaramuça)

### F35 — Feira: trocar mercadoria (sim + ui)
- **Origem (decisão do operador, 2026-09-26)**: item escrito para a casca não ficar sem
  fila. *"A Feira e a Prefeitura podem esperar."* Hoje o `marketplace` constrói e não
  faz nada.
- **O que o dado já diz** (GDD §4.4, `economy.json` `marketplace`): **taxa fixa** e no
  máximo **10 serfs** negociando. Existe só no Remake (GDD §5.2 \*).
- **Escopo (escrito em 2026-09-27, leitura conservadora, para revisão)**:
  - **Dado.** Hoje `economy.json:marketplace` tem só `taxaFixa: true` e `maxSerfs: 10`
    (conferido). A taxa entra no mesmo objeto como **número único**: quantas unidades de
    A se entregam por uma de B, para qualquer par de `economia.mercadorias`. O schema a
    valida em `tools/data-schema.js`. O valor é do operador; sem ele o item não começa.
  - **Comando.** `SetTrade { predio, da, para, quantidade }` (união de `commands.ts`) fixa
    uma ordem permanente na feira: trocar A por B até `quantidade` de B. Quantidade 0
    cancela. Uma ordem por feira. Tudo é recusado com motivo: prédio que não é feira
    completa, A = B, mercadoria fora da lista.
  - **Fluxo, pelo JobBoard.** A feira é consumidora de A e produtora de B: pede A ao
    armazém como qualquer insumo (tarefa de serf, reserva na origem e na vaga), e com
    `taxa` de A na gaveta de entrada fecha **uma** troca no tick: debita A e credita
    1 de B na gaveta de saída, que os serfs escoam como de qualquer prédio. Sem ciclo e
    sem trabalhador: `buildings.json` não lhe dá `trabalhador`. Trocar no tick em que o
    insumo completa é a leitura mais conservadora, porque o GDD não fala em tempo de
    troca, e duração nova seria número inventado.
  - **Os 10 serfs.** No máximo `maxSerfs` tarefas reclamadas com a feira como origem ou
    destino ao mesmo tempo. A 11ª fica aberta até uma fechar. É a leitura literal do
    GDD §4.4 ("máximo de 10 serfs negociando").
  - **UI.** O painel da feira mostra a ordem, o que falta de A e quantas trocas já saíram.
  - **Fora**: tabela por mercadoria (decisão abaixo), preço que varia com o uso e troca
    com outro jogador.
- **Decisão do operador (2026-09-27)**: **uma taxa só, fixa**, para todo par. A tabela
  por mercadoria sai de vez. Continua faltando o **valor** da taxa, que é do operador:
  sem ele o item não começa.
- **Decisão do operador (2026-09-27, noite): taxa 2 para 1.** O jogador dá duas unidades
  de A e recebe uma de B. *"Troca deve custar, senão a Feira vira atalho para toda
  escassez."* O item pode começar: `economy.json:marketplace.taxa = 2`.
- **Aceite**:
  - (a) com a ordem "B por A" e A no armazém, B chega ao armazém. O A debitado é igual a
    `taxa` × o B creditado, somado na corrida inteira.
  - (b) nunca há mais de `maxSerfs` tarefas da feira reclamadas no mesmo tick, conferido
    em todo tick de um cenário com 20 serfs ociosos.
  - (c) sem A no armazém a troca espera, nenhum B aparece, e o painel diz por quê
    (screenshot, com o roteiro despausado da §8).
  - (d) cancelar a ordem com A a caminho larga as tarefas pelo `release`, sem A perdido:
    a soma de A no mundo, no armazém, nas gavetas e nos serfs, fica igual.

### F36 — Prefeitura: mercenários pagos em ouro (sim + ui)
- **Origem (decisão do operador, 2026-09-26)**: pode esperar. Depende da F25 (soldado
  existir) e dos mercenários ganharem arte e arma (nota da F25).
- **O que o dado já diz** (GDD Anexo A): ouro por mercenário, **pronto na hora**. Rebel
  custa 2, Rogue 3, Vagabond 5, Barbarian 7 e Warrior 8. O `town_hall` recebe ouro do
  Metallurgist's (GDD §4.2).
- **Escopo (escrito em 2026-09-27, leitura conservadora, para revisão)**:
  - **Dado (conferido).** `units.json:mercenarios.tipos` já traz os cinco com
    `custoOuro` 2/3/5/7/8 e os atributos. `buildings.json:town_hall` não tem
    `trabalhador` (4×3, desbloqueado pela Metalurgia). Não entra número novo.
  - **O ouro chega como insumo.** A Prefeitura pede `gold` ao armazém pelo JobBoard, com
    a tarefa de ouro da escola (F13a) como molde, e o custo sai da gaveta de **entrada**
    dela, não do armazém. É a leitura do GDD §4.2, "o `town_hall` recebe ouro do
    Metallurgist's".
    Há uma diferença, conferida em `src/sim/escola.ts:66` (`ouroNecessario`): a escola
    pede ouro pela **fila**, isto é, itens que não começaram vezes o custo, menos o que
    está na gaveta. A Prefeitura contrata na hora e não tem fila, então precisa de um
    **alvo de estoque**, e esse número não existe em `data/`.
    **Decisão do operador (2026-09-27): o alvo é 8**, o custo do mais caro. Ele é lido do
    dado (o máximo de `custoOuro`), não é digitado nem vira campo novo.
  - **Comando.** `HireMercenary { predio, tipo }` em `commands.ts`. Com `custoOuro` na
    gaveta, debita e cria a unidade militar do tipo na aproximação da porta, **no mesmo
    tick** ("pronto na hora", GDD Anexo A). Sem fila e sem duração. Recusa com motivo:
    prédio que não é Prefeitura completa, tipo desconhecido, ouro insuficiente.
  - **Dois comandos no mesmo tick** leem o estado velho. O segundo é recusado se o
    primeiro esvaziou a gaveta, e a regra é conferida em sequência, dentro do `step`.
  - **O mercenário** é unidade militar comum a partir dali: ordem direta (F26), combate
    (F28). Não consome arma, recruta nem escola.
  - **UI.** O painel da Prefeitura mostra o ouro na gaveta e um botão por tipo, com o
    custo. O botão sem ouro fica desabilitado e diz o que falta.
  - **Fora**: a arte e a arma dos mercenários (nota da F25; `docs/BRIEF-ARTE.md` manda
    não gerar) e o limite de mercenários por partida, que o GDD não fixa.
- **Aceite**:
  - (a) com ouro na gaveta, `HireMercenary` debita exatamente o `custoOuro` do tipo e a
    unidade existe no tick do comando, junto à porta.
  - (b) sem ouro suficiente, o comando é recusado com motivo e o estado fica igual
    (comparação byte a byte).
  - (c) com ouro para um só, dois comandos no mesmo tick: o primeiro passa e o segundo é
    recusado.
  - (d) nenhum recruta, arma ou escola muda de estado na contratação.
  - (e) o painel mostra os cinco custos e desabilita o que não cabe (screenshot, com o
    roteiro despausado da §8).
---

## Regras da fila

- Fase A inteira antes de qualquer item da Fase B. Sem exceção.
- Item da Fase B em diante só é detalhado quando a fase anterior fechar. Detalhar
  agora é desperdício, porque o que você aprende na Fase A muda o resto.
- Se uma feature reprovar duas vezes seguidas na avaliação, pare o loop e escreva
  em `PROGRESS.md` o motivo. Insistir uma terceira vez com o mesmo prompt é
  queimar crédito.
