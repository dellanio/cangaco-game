# BUILD_PLAN — cangaço

Fila de trabalho. **Uma feature de cada vez**, na ordem; a sessão pode seguir
pela fila até o fim do bloco de entrega (CLAUDE.md §11, decisão do operador de
2026-10-02). **A fila é este arquivo**, não o `test-results.json`.

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
- **Nota (BUG-X, especialista dentro da casa — decisão do operador, 2026-10-01)**: casa
  fechada, o trabalhador **sai e fica visível**, como no KaM (`KM_Units.pas:529-600`,
  `ProceedHouseClosedForWorker`: `SetActionGoIn(gdGoOutside)` e `CleanHousePointer`, ele
  perde a casa). O BUG-X entregou só a TELA: o ocupante de prédio pausado se desenha, no
  tile da porta (`src/render/visibilidade.ts`). A parte de SIM — sair de fato e perder a
  posse — contradiz o (c) da nota acima e não está na fila: é item de sim à parte, e
  espera o operador dizer se o (c) cai (pergunta no `PROGRESS.md`, 2026-10-01).
  - **Revogada pela D3 do operador (2026-10-01, leva desatendida).** "Parar a produção" no
    KaM é o modo de entrega (`KM_Houses.pas:904-960`, `UpdateDeliveryMode`), que não mexe
    no trabalhador; quem o põe para fora é "fechar para o trabalhador"
    (`KM_Units.pas:540-546`), outro botão, que o jogo não tem. O (c) fica: pausado, o homem
    fica **dentro**, escondido, e a casa mostra o ocioso (`dentroDaCasa` sem o
    `pausado`). Entregue na tarefa 2 da leva, com a F-VIVO-e.
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
  - **Unidade** (`tipo: "unidade"`, `id` = tipo neutro): **8 direções para todos os
    tipos** (decisão do operador, 2026-09-30; o A* anda em diagonal,
    `sim/pathfinding.ts`). As direções são `n ne l se s so o no`. **Oeste é espelho**:
    `o`, `no` e `so` sem quadro usam `l`, `ne` e `se` com `flipX`, e por isso 8 direções
    custam 5 desenhos. A arte parada de hoje continua em `estados`
    (`"<pose>:<direcao>"`, um arquivo por chave). A arte animada entra em atlas, com
    quadros `{unidade}/{estado}/{direcao}/{nnnn}`, pelo plano
    `docs/planos/2026-09-30-animacao-direcional-de-unidades.md`. O `anchor` cai na
    posição desenhada da unidade.
    **Dado de hoje (conferido em 2026-10-01):** `data/units.json` declara
    `direcoesDeSprite` no `_comum` de cada grupo, civis 8 (`:26`) e militares 8
    (`:106`), e o render o lê (`src/render/direcoes-de-sprite.ts:32`). Os civis passaram
    de 4 a 8 em 2026-10-01, por pedido do operador, antes da D-TELA-05a do plano (que
    fazia o mesmo depois do piloto de arte). A arte civil de hoje só tem `n l s`: a
    diagonal sem quadro cai na HORIZONTAL (`HORIZONTAL_DA_DIAGONAL`,
    `src/render/manifesto.ts`), que é o que o civil de 4 já desenhava no passo diagonal —
    a tela não muda até a arte diagonal entrar (`tests/F-SPR-carregamento.test.ts`). A
    D-TELA-05a foi fechada por este passo (c53f85a): a nota da F-SPR e civis e militares em 8 (os mercenários ficaram sem o campo: D-TELA-05e);
    o que resta é arte diagonal, que entra por decisão humana.
    (O texto proposto em `docs/planos/2026-09-30-vivo-contra-kam-e-texto-das-8-direcoes.md`
    §4.2 dizia que o campo não existia; a leitura do arquivo desmentiu.)
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

- **Arte disponível, entrega incremental (2026-09-27):** F-TR deixou de esperar
  arte. Água–areia, areia–grama e lajedo têm fontes canônicas e famílias de 16
  máscaras N/L/S/O no pipeline local. A implementação entra em commits pequenos,
  sem alterar terreno lógico nem `src/sim/`.
- **Aceite acrescentado — lajedo dinâmico:** no cenário real da pedreira, deixar
  um tile de `rock` esgotar e sair de `state.recursos`; o sprite daquele tile some
  e os quatro vizinhos cardinais são reavaliados. Cada vizinho de rocha ainda
  presente perde exatamente o bit que apontava para o tile removido. Evidência:
  capturas antes/depois e as máscaras publicadas pelo render em
  `test-output/F-TR-shot.json`; a asserção é de comportamento, não de quantidade
  fixa nem de pixel.
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
- **Quebra a/b (2026-09-28, fila da noite, PARA REVISÃO)** — `docs/planos/2026-09-28-7-F-TR.md`.
  No mapa real a água vai de y 24 a 53 e a montanha de y 84 a 119. No zoom mais aberto
  (0,5) a vista tem 40×22 tiles, então nenhum quadro mostra as duas.
  - **F-TR-a** (feita) tem dois quadros do mapa real a 0,5, **açude** e **serra**, cada
    janela achada pelo próprio mapa (`tools/shots/_terreno-tr.js`). Em cada quadro o
    roteiro afirma três coisas:
    - (1) nenhum PNG é dividido entre dois tipos visíveis: o hash do arquivo que o
      manifesto declara, publicado em `debug.texturaDoTerreno`;
    - (2) floresta na tela;
    - (3) cada tile de transição desenhado (`debug.transicoesVisiveis`, lido de volta
      das três camadas de borda) tem a máscara que o mapa manda, e nenhum tile de
      fronteira da janela falta.

    O lajedo dinâmico segue no mesmo roteiro. Evidência:
    `test-output/F-TR-terreno.json` e `screenshots/F-TR-5/6-*.png`.
  - **F-TR-b (feita, 2026-09-28, sessão autônoma).**
    - **Aceite corrigido (decisão do operador, 2026-09-28):** *"no mapa real não cabe.
      Use dois quadros."* O "água, grama, areia, floresta e serra no mesmo quadro" passa
      a ser **os dois quadros da F-TR-a** (açude e serra), cada um com a janela achada
      pelo próprio mapa. **Motivo:** a água vai de y 24 a 53 e a montanha de y 84 a 119;
      a vista a 0,5 tem 40×22 tiles, e nenhuma janela mostra as duas. Um mapa só para a
      foto seria andaime.
    - **Lajedo encolhendo (pedido do operador):** a pedreira da F-T3 come **três** tiles,
      um de cada vez. Depois de cada um, o roteiro afirma que o lajedo perdeu
      exatamente um tile e que **toda** rocha de pé desenha a máscara que o roteiro tira
      sozinho do conjunto de rochas. O que se lê é `debug.lajedoDesenhado`, que é o
      estado da textura lido de volta de cada sprite, e não a máscara recalculada pela
      cena. Tile que saiu e ainda tem sprite também reprova.
    - Sonda: com o redesenho dos vizinhos desligado, o roteiro reprovou
      (`a rocha 24,30 deveria desenhar m14, desenha m15`). A asserção da F-TR-a passava
      com a mesma mutação, porque comparava máscara do estado com máscara do estado.
  - **Continua aberto, fora da a:** o esgotado por tipo (nota da F18 abaixo). O campo em
    pousio e o lajedo cavado ainda dividem o marcador `esgotado`.
  - **Aceite do esgotado por tipo (2026-10-01, pedido do operador; commit próprio antes do código):**
    - **A regra, pura (`src/render/mapa.ts`):** tile de recurso com quantidade 0 de um tipo **com**
      `aradura` em `data/resources.json` (as culturas; hoje `corn` e `grapes`) ganha o código
      `emPousio`. Tile com quantidade 0 de um tipo **sem** `aradura` (lajedo, minério, árvore,
      peixe) continua com o `esgotado`. Teste por tabela, para todo tipo do dado. Nenhum id de
      recurso é digitado no código: quem decide é a presença do bloco `aradura`.
    - **A cor, sem cor nova:** o `emPousio` usa a cor do terreno `campoArado` do tema, e o
      `esgotado` continua com a dele. As duas diferem, e o teste afirma isso pelo tema.
    - **A ponte:** `recursosVisiveis` conta `emPousio` à parte do `esgotado`.
    - **Os roteiros:**
      - o F18 (o roçado em pousio) afirma o pousio pela contagem `emPousio`, e não mais por
        `esgotado`, e que o quadro do roçado tem `esgotado` 0;
      - o F-CANA-b (a cana da vila nasce em pousio) afirma `emPousio` > 0 e `esgotado` 0 na mancha.
      - Captura aberta do roçado: a roça em pousio sem o losango escuro.
    - **Fecha o BUG-N** (cana em pousio parece mato cortado), pelo caminho (a) que ele mesmo
      registrou. Sai do `BUGS.md` no commit do código.
    - **Não-regressão:** os roteiros e testes que contam `esgotado` (F-T2a, F-TR, F-D3; os testes de
      esgotamento da pedreira e da mina) continuam verdes, porque o recurso cavado segue `esgotado`.
    - **Testes que mudam junto, sem afrouxar:**
      - `tests/F-T2a-recursos.test.ts`: as cores passam a ter os tipos + 3 códigos (0, `esgotado` e
        `emPousio`). A árvore cortada continua `esgotado`, e o milho em pousio passa a ser
        `emPousio`;
      - `tests/F21b-mina-esgota.test.ts`: a tabela amputada ganha o campo novo.

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
  - **Decisões do operador (2026-09-27, noite 5), aplicadas e na `main`**
    (`merge(F-CAMPO-a)`, com o `npm run verify` verde):
    - **F18-rocado ×3:** o cenário virou `cenarioDeFazendaDeUmTile`. Mudou o cenário,
      não a asserção.
    - **`farm.sai.corn` 3.0 → 2.0:** a conta dá 247,5 ticks por milho contra 246 do
      moinho. Medido: 260,9. O 2.1 ainda represa. A tabela está no `BALANCE_LOG.md`,
      em Ciclos fechados. A F19 fica em 95,8 % do teto.
    - **Canavial `alcance_tiles` 4 → 2:** medido na vila, fica com 4 tiles alcançáveis
      (eram 8 com 4).
    - **F18h:** a janela do 1º milho passou a ser `2000 + semear + crescer`. Medido:
      2 037.
  - **Estado:** crescer 1 650, alcance 2 e farm 2.0 estão na `main`. **Chave: nenhuma
    ainda.** O aceite do operador (`docs/planos/F-CAMPO-a.md`) passou numa sonda da
    sessão, já apagada: Canavial, 6 000 ticks, 12 tiles → 6 canas, 1 tile → 4. Ainda
    **não tem teste permanente**. O aceite (c) proposto acima (≈ 24 em 6 000) é do
    modelo antigo e precisa de reescrita pelo operador.
  - **Aceite reescrito pelo operador (2026-09-27, noite 6), e PASSA — chave `true`:**
    *"afirme a RAZÃO — com N tiles ao alcance, a produção é maior que com 1 tile, por uma
    margem que você meça agora."* O (c) antigo, ≈ 24 em 6 000, sai.
    - Teste: `tests/F-CAMPO-a-razao.test.ts`, na fazenda do norte, com gaveta esvaziada e
      janela de 12 000. Medido: 14 tiles → 46 milhos; 1 tile → 16. A razão é
      **2,875**, e o piso é **2**. Evidência em `test-output/F-CAMPO-a.json`.
    - **O guarda acusa:** com o crescer de volta a 30 s, deu 46 contra 43 e reprovou.
      O `data/resources.json` foi restaurado depois.
    - O Canavial ficou de fora: dá só 1,5× (15 contra 10). Com ciclo de 600 ticks, a
      colheita domina a volta, e ele satura com 2 a 4 tiles.
  - **Fazenda grande com alcance 2, medida** (sonda apagada; gaveta esvaziada, condição
    reposta):

    | tiles arados | 1º milho | milho até 6 000 | milho até 30 000 |
    |---|---|---|---|
    | 14 (fixture) | 1 949 | 18 | 113 |
    | 16 | 2 103 | 18 | 119 |
    | 20 | 2 464 | 16 | 119 |
    | 30 | 3 205 | 13 | 121 |
    | 40 (todo o anel de 2) | 3 791 | 11 | 135 |

    - O atraso do 1º milho **volta**: acima de ~15 tiles, cada tile a mais soma a sua
      viagem de semear (~115 ticks). Semear o lote passa a custar mais que o crescer
      (1 650).
    - O alcance 2 **limita** o atraso (no máximo 3 791, contra 5 051 com alcance 4),
      mas **não o elimina**. É o "semeia todos e espera" do rodízio.
    - No regime, mais tiles ainda rendem mais.
    - **Decisão do operador (2026-09-27): aceito, como característica.** É o "semeia tudo
      e espera" do KaM: 40 campos são investimento de longo prazo. Colher antes de semear
      foi recusado, porque o roceiro nunca terminaria de semear (`BALANCE_LOG.md`, Ciclos
      fechados). O Canavial a 1,5× abre o próximo lote pelo tempo de colheita.
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

### LOTE3 — As fases da colheita: tile, casa, descanso e carga (dado + sim)
- **Decisão do operador (2026-09-27):** saída (a) do BALANCE_LOG.
  - **Não é mudança de modelo.** É alinhar com a referência: o KaM separa as fases desde
    sempre.
  - A caminhada sai do pathfinding e não tem campo.
  - Plano: `docs/planos/LOTE3-fases-de-colheita.md`, aprovado.
- **LOTE3-b1 — Canavial em fases (26 / 82 / 12 s: a proporção do KaM, o total de hoje).**
  - **O b1 ALINHA O MODELO COM A REFERÊNCIA E NÃO MELHORA A RAZÃO 12 : 1 DO CANAVIAL.**
    O gargalo é o tempo total do canavieiro por unidade, e a repartição só muda ONDE ele
    está (no tile ou dentro da casa), não QUANTO tempo ele gasta. Medir a razão depois do
    b1 e ver ~1,5× é o resultado esperado, não falha da feature. **Quem move a razão é
    o b2.**
  - **Dependência registrada (decisão do operador):** o tile fica reservado até o
    DEPÓSITO, como na mina `aDistancia`. Liberar na chegada pede partir o `depositar`
    em dois, e arrisca consumo em dobro: um `produzir` sem tarefa no meio do ciclo
    reclamaria um segundo tile. Isso só destrava algo quando dois prédios disputarem os
    mesmos tiles. Esse caso não existe hoje, e é ele que reabre a questão.
  - Aceite: `tests/LOTE3-fases-canavial.test.ts`:
    - `ticksNoTile` ticks em `colhendo`;
    - o resto do ciclo em `trabalhando`, dentro da casa;
    - a vazão igual ±1 contra o modelo de antes em 12 000 ticks;
    - pausa, demolição e saída cheia na fase da casa;
    - `validate:data` com `producao/fases` e `producao/sai-conferido`, provadas acusando.
- **LOTE3-b2 — os outros quatro (`quarry`, `woodcutters`, `farm`, `fishermans`) em
  fases, pelo caminho do Canavial. ENTREGUE (2026-09-27, noite 12).**
  - **Decisão do operador (2026-09-27):**
    - a PROPORÇÃO vem do KaM, e não o valor absoluto:
      - fazendeiro 96 no tile e 0 na casa;
      - pedreiro 80 e ~190;
      - lenhador 180 e 0;
      - pescador 328 e 0;
      - descanso 50 em todos.
    - Só o pedreiro e o vinhateiro trabalham dentro da casa. Os outros três voltam e
      depositam.
    - O TOTAL de cada um fica o de antes, para a vazão não mudar.
    - O que muda o total é decisão do operador, depois de ver as fases no lugar.
  - **Números** (segundos na escala 1,0 → ticks na escala 2,0):

    | receita | tile | casa | descanso | total |
    |---|---|---|---|---|
    | quarry | 8,4 → 42 | 19,8 → 99 | 5,2 → 26 | 167 |
    | woodcutters | 66,2 → 331 | 0 | 18,4 → 92 | 423 |
    | farm | 19,8 → 99 | 0 | 10,2 → 51 | 150 |
    | fishermans | 52 → 260 | 0 | 8 → 40 | 300 |

    - `porViagem` 1 em todos. Os 3 por viagem do pedreiro do KaM eram absolutos e
      esperavam o operador: entraram no LOTE3-c, abaixo.
  - **A ordem do ciclo mudou (decisão desta sessão):** o descanso do KaM vem DEPOIS da
    entrega. Aqui ele abre o ciclo seguinte, dentro do prédio e com a tarefa do tile já
    reclamada: descanso → ida → tile → volta → casa (só no pedreiro e no vinhateiro) →
    depósito.
    - Motivo: "voltam e depositam" não cabe com o descanso entre a volta e o depósito,
      como estava no b1.
    - A vazão é a mesma. Só o primeiro ciclo da partida ganha um descanso a mais.
    - Campo novo: `ColheitaDeRecurso.ticksDeDescanso` (0 sem `fases`).
  - Aceite: `tests/LOTE3-fases-quatro.test.ts`, com os quatro:
    - forma do dado;
    - um ciclo limpo com descanso = `ticksDeDescanso`, `colhendo` = `ticksNoTile`, e
      dentro depois da volta = casa + 1 (1 nos três que depositam na chegada);
    - vazão ±1 contra o modelo de antes em 6 000 ticks.
    - Prova de que acusa: saindo no progresso 0 (sem descanso), 5 casos reprovam
      (os quatro e o Canavial).
  - **Aberto, decisão do operador:** girar os totais. A vazão por prédio e a razão N:1
    ficam em `test-output/LOTE3-fases-quatro.json`.
- **LOTE3-c — o pedreiro traz 3 blocos por viagem. ENTREGUE (2026-09-27, noite 13).**
  - **Decisão do operador:** é peça que o KaM tem e nós não. Ele corta a pedra no tile e
    trabalha ela na casa, e o lote justifica o tempo na casa. Vazão declarada mantida:
    fases ×3 (126 / 297 / 78 ticks, ciclo 501), `porViagem` 3, `sai.stone` 1,8.
  - Mecânica: o claim exige o lote inteiro no tile, o tile perde o lote no depósito, e a
    gaveta aceita o lote só se ele couber inteiro (gaveta 5 = um lote de 3).
  - Regra de dado nova: `producao/por-viagem-divide` (o lote divide o rendimento de
    quem nunca repõe; rocha 15 / 3).
  - Aceite: `tests/LOTE3-c-pedreiro-lote.test.ts`, contra o pedreiro de um bloco
    derivado do dado (fases / 3, `sai` 1, que é o dado do b2):
    - taxa declarada igual (±1 tick por pedra);
    - entregue ≥ 1,2× (medido 60 contra 46 em 12 000 ticks) e caminhada por pedra
      menor que metade (medido 30,2 contra 91,4).
    - Prova de que acusa: `porViagem` 1 no dado reprova (20 < 24).
  - **A premissa "pedra por minuto não muda" não se confirmou:** a declarada é a mesma,
    a entregue subiu 30% porque a viagem é paga por lote. Ciclo ~700 manteria a entregue
    neste cenário (hipótese, não medida), mas depende da distância. Ficou 501, como pedido.
  - **Decidido pelo operador (2026-09-27, noite 14):**
    - os +30% entregues ficam; o ciclo ~690 (medido: 45 entregues) foi recusado;
    - a razão 0,90× sem esgotar e o 1,3× do pescador são característica de quem esgota
      (rocha, peixe, minério e, sem replantio, árvore). A razão N:1 só vale para quem
      repõe (milho e cana);
    - os totais NÃO giram: giram quando o jogo mostrar problema.
  - **Lenhador com lote de 2:** medido e não proposto (BALANCE_LOG, LOTE3-c). Na vila de
    calibração ele esgota a mata; o lote não tem casa que o justifique; o KaM não tem;
    e quebraria o 2:1 com a serraria. Reabre com o replantio: item **F-REPL**, abaixo
    (2026-09-27, noite 15).
- **Método, registrado:** o custo de um campo se mede COMPILANDO, não por busca de texto.
  - A contagem por texto dizia "5 sim, 2 render, 13 testes" para `ticksDoCiclo` e
    errava nos dois sentidos: `trabalho.ts` não quebra (lê o `DadosDoTrabalho`
    montado), e `predios.ts` quebra.
  - O `tsc` deu 42 erros ao tirar o campo e 2 ao acrescentar um obrigatório.

### F-REPL — O lenhador replanta: modos cortar e cortar e plantar (dado + sim)

**Decisões do operador (2026-09-27, noite 16), que valem sobre o texto abaixo:**
1. **A árvore nasce SÓ no toco.** O risco da árvore na estrada morre por construção:
   toco é tile que já teve árvore, então nenhum tile novo vira mata. Resta o toco COM
   estrada por cima, e a regra é: **toco sob estrada não rebrota.** Plantar em tile
   virgem (o F-REPL-c) fica para depois, "se alguém sentir falta".
2. **Dois modos, não três**, como no kam_remake (`TWoodcutterMode = (wcm_Chop,
   wcm_ChopAndPlant)`): `cortar` e `cortar_e_plantar`. "Só replantar" era invenção
   nossa: lenhador que só planta não produz. **Padrão: cortar e plantar.**
3. **Sim ao item.** E a premissa da árvore, corrigida e reconhecida pelo operador: ela
   existia antes da F-D3, no noroeste; a F-D3 a trouxe para perto. O operador vinha
   dizendo que ela nasceu lá.

Pedido do operador (2026-09-27, noite 15):
- o lenhador ganha os modos do KaM;
- replantar põe uma árvore num tile vazio ao alcance, e ela cresce por tempo, como o
  campo;
- o padrão é `ambos`, para o jogador que não mexe em nada não ficar sem madeira.

- **Premissa corrigida: `recursos.ts` NÃO trata `porAcao` como terminal.** Verificado
  lendo o código e com uma sonda, já apagada.
  - O regime `porAcao` guarda o tile em 0: `recursos.ts:507` só apaga o `nunca`.
  - O replantio do campo já é genérico:
    - `tilePlantavel` (`recursos.ts:274`) aceita qualquer tipo com `reposicao`, e
      `semearNoTile` e `tileMaduro` (por `semeadoEm`) também;
    - `produzir` entra no rodízio sempre que `reposicaoDe(receita.colheita) !== null`,
      sem olhar se o prédio é fazenda.
  - A árvore é terminal **só porque `tree` não tem `reposicao` em
    `data/resources.json`**. O código já espera o replantio: o comentário de
    `iniciarPlantio` (`especialistas.ts:303`) diz que ele vai cobrar tora.
  - **A sonda:** `cenarioOraculo`, prédio `w1`, 12 000 ticks, com `tree.reposicao`
    injetado com os números do milho e nenhuma linha de código:

    | | troncos | tocos replantados | tocos no fim | parado sem árvore |
    |---|---|---|---|---|
    | hoje | 18 | 0 | 9 | 2 329 ticks |
    | com `reposicao` | 21 | 9 | 0 | 79 ticks |

  - O que falta de verdade:
    - plantar em tile SEM entrada;
    - os modos;
    - duas regras de posição (abaixo).
  - Em `recursos.ts`, isso é um predicado novo e uma linha no rodízio. Nada do que
    existe muda de sentido.

- **Muda três coisas já registradas.** Cada uma ganha nota no lugar de origem, nesta
  mesma sessão.
  1. **O lenhador sai de "quem esgota" e entra em "quem repõe"**, com o milho e a cana
     (BALANCE_LOG, "Característica, não defeito: quem esgota não acelera").
  2. **A razão N:1 passa a valer para ele, e o lote de 2 volta à mesa** (BALANCE_LOG,
     "Lenhador com lote de 2: medido, NÃO proposto"):
     - o motivo 1 da recusa, a mata que acaba, cai;
     - os motivos 2 (sem casa) e 3 (o KaM traz 1) continuam;
     - o motivo 4, o 2:1 com a serraria, precisa ser medido de novo, porque a viagem
       de replantar come tempo do lenhador.
  3. **A árvore ganha estados de crescimento, como o campo**, e isso vai para o
     `docs/BRIEF-ARTE.md`: a entrada `arvore`, proposta, ao lado da `cultura`.

- **Sub-itens, nesta ordem, uma sessão cada.** A quebra evita tocar sim e render na
  mesma feature (§10).
  - **F-REPL-a — o toco rebrota (dado + sim). ENTREGUE (2026-09-27, noite 16).**
    - **Tarefa 1, a sonda, reproduziu o caso**, já apagada: o `PlaceRoad` sobre o toco
      37,23 foi aceito em t2338, a estrada foi assentada em t2493, e a árvore nasceu na
      estrada em t2618. Dois serfs parados na rua (u3, u7) somaram 9 578 ticks×unidade
      dentro do tronco.
    - **A guarda está em `tilePlantavel`** (`sim/recursos.ts`), não no `elegivel`. É o
      predicado único dos dois lados: o rodízio, o alerta e a prévia. Com ela no
      rodízio apenas, o alerta esperaria um trabalho que nunca chega. Vale para todo
      tipo com `reposicao`, como o `canPlowField` já recusa estrada.
    - O canteiro já estava fora, pelo `elegivel`: `tileCobertoPorPredio` bloqueia o
      footprint de todo prédio em `predios.ordem`, qualquer que seja o estado
      (`pathfinding.ts:200-206`). Isto foi lido, não rodado.
    - A unidade em pé no tile quando a árvore nasce sai sozinha: o A* não confere o
      tile de partida. O teste afirma que `buscarCaminho` sai de dentro do tronco. Nas
      corridas do aceite, 0 ticks×unidade dentro de árvore.
    - Número: `semear` 53 s, `crescer` 412,5 s (265 e 2 063 ticks), `[proposta]`.
    - `tree.reposicao` em `data/resources.json`, `[proposta]`, com a proporção do KaM
      (medida; fonte no fim do item):
      - `crescer` = 1,25 × o do milho (KaM: árvore 8 000, milho 6 400);
      - `semear` = 0,8 × o `noTile` do lenhador (KaM: plantar 12 golpes, cortar 15);
      - `custo` vazio. Que o KaM não cobra nada para plantar é hipótese, não
        conferida no fonte.
    - **Guarda de posição, obrigatória: toco coberto por estrada, estrada planejada ou
      canteiro NÃO rebrota.** Três leituras do código:
      - hoje dá para assentar estrada sobre um toco (`estradas.ts:549-553`: árvore em
        0 não bloqueia);
      - `tilePlantavel` não olha estrada;
      - o `elegivel` do rodízio (`tileAlcancavelParaColheita`, `aproximacao.ts:71`)
        exclui só prédio.

      Juntas, elas dizem que o lenhador faria nascer uma árvore no meio da estrada.
      Isso é **hipótese: lida no código, não rodada**. A Tarefa 1 é a sonda que
      reproduz o caso.
    - **Unidade em pé no tile no instante em que a árvore nasce.** A árvore bloqueia o
      passo desde o plantio (`semearNoTile` põe a quantidade cheia). O aceite afirma
      que a unidade não trava: ou ela sai do tile, ou o plantio espera.
    - Sem modos ainda: todo lenhador faz `ambos`, que é o padrão pedido.
  - **F-REPL-b — os modos (sim + dado). ENTREGUE (2026-09-27, noite 16).**
    - **Como ficou**, e onde difere do texto abaixo:
      - `modos` virou objeto, `{ cortar: { planta: false }, cortar_e_plantar: {
        planta: true } }`, com `modoPadrao`. O código lê só `planta`; nenhum nome de
        modo está em `sim/`;
      - o comando é **`SetBuildingMode`**, não `SetWoodcutterMode`. O gatilho é
        o dado: qualquer receita com `modos` aceita, e nenhum tipo está digitado. As
        recusas: `predio-inexistente`, `predio-em-obra`, `sem-modos`, `modo-invalido`;
      - o estado é `Producao.modo`, opcional, no molde da `escolha`: ausente em
        quem não tem modos. O custo foi 1 erro de compilação, contra os 14 do
        `PredioCompleto.modo` obrigatório;
      - o `cortar` não passa pelo rodízio: colhe pelo caminho da rocha. É isso que o
        faz reproduzir byte a byte a corrida sem `reposicao`;
      - o modo vale nos dois lados, `tileTrabalhavel` e rodízio: em `cortar`, toco
        não é trabalho. Vale também para o rótulo do HUD: esgotado em `cortar` é
        `veio-esgotado`, não `sem-campo`;
      - a troca no meio de uma viagem de plantio deixa a viagem terminar, e a
        reserva se solta no `voltarSemTarefa`.
    - **Nota (decisão 2 acima): são dois modos, `cortar` e `cortar_e_plantar`.** O
      `modos` do lenhador em `data/production.json` passa a ter esses dois, e o
      padrão é `cortar_e_plantar`. Onde o texto abaixo diz `ambos`, leia
      `cortar_e_plantar`. O `replantar` sai do escopo e do aceite. Desde a F-REPL-a
      todo lenhador já faz `cortar_e_plantar`; o b acrescenta o `cortar`.
    - `modoPadrao: "ambos"` na receita do lenhador, ao lado de `modos`, com uma regra de
      dado: o padrão tem de estar na lista.
    - Estado e comando:
      - o estado é `PredioCompleto.modo`;
      - o comando é `SetWoodcutterMode`, que leva o valor (não é alternador) e é
        recusado nos mesmos casos do `SetBuildingPaused`.
    - Os modos:
      - `cortar` = só colher: o de hoje, e esgota;
      - `replantar` = só plantar, sem tronco;
      - `ambos` = o rodízio.
    - O leitor é `proximoTrabalhoDoRodizio`, com um filtro de ação. É a "uma linha no
      rodízio" citada acima.
  - **F-REPL-c — plantar em tile vazio (sim + dado). ADIADO (decisão 1 acima): sem
    posição na fila, volta "se alguém sentir falta".**
    - **MEDIDO (2026-09-28, sessão autônoma; `docs/planos/2026-09-28-A19-F-REPL-c-medida.md`):
      não faz falta.** No `cenarioOraculo`, com 2 h de jogo e a fome neutralizada, o
      `cortar_e_plantar` sustenta 17–22 troncos por 10 min, sem queda, na faixa da mata
      virgem. O `cortar` zera no minuto 20. Continua adiado. Reabre se um mapa der mata
      menor que o raio do lenhador.
    - `tree.plantio.terrenoPermitido`, no molde da `aradura`.
    - Predicado novo em `recursos.ts`, irmão do `canPlowField` (`campos.ts:98`). O tile
      precisa estar:
      - em terreno permitido;
      - sem entrada;
      - sem estrada nem estrada planejada;
      - fora de prédio e de canteiro;
      - fora de campo planejado.
    - O novo aqui é a entrada em `state.recursos` que nasce EM PARTIDA. A camada de
      bloqueio do A* é derivada do estado (`camadaDeBloqueio`) e troca de referência
      quando a lista muda, mas antes de confiar nisso leia a memória
      `cache-do-carregamento-nao-filtra-o-runtime`.
    - **Decisão de posição que o GDD não responde** (PROGRESS, "Perguntas em aberto"):
      a árvore nova pode fechar a porta de um prédio ou o único corredor. A
      interpretação conservadora: não plantar no tile de acesso de prédio nem em
      vizinho de estrada.
  - **F-REPL-d — o seletor de modo no painel (ui).** Domínio do Codex.
    - **Nota (contrato herdado da F-REPL-b):**
      - o botão manda `{ type: 'SetBuildingMode', predio, modo }` com o VALOR, não
        alterna;
      - os modos são as chaves de `receitas[tipo].modos.porModo`, e o atual está em
        `producao.modo`;
      - o seletor aparece para toda receita com `modos !== null`, nunca por
        `tipo === 'woodcutters'`;
      - os nomes que o jogador vê já estão no tema (2026-09-27, noite 17), em
        `theme-sertao.predios.<tipo>.modos.<id>`, com `nome` e `desc`. A regra
        `interface/modo-rotulo` exige nome para todo modo do dado e recusa nome
        de modo que o dado não tem;
      - lenhador sozinho numa mata grande: o modo não muda nada até a mata acabar.
        Dois lenhadores na mesma mata replantam cedo (BALANCE_LOG, premissa
        corrigida na noite 17). Se o painel quiser mostrar isso, é decisão de
        tela.
    - **ENTREGUE (2026-09-29, lote do operador, item 10; plano em
      `docs/planos/2026-09-29-F-REPL-d-seletor-de-modo.md`).** Feito nesta sessão, não
      pelo Codex:
      - `ui/modo-do-predio.ts` (`modosDoTipo`, `opcoesDeModo`, `comandoDeModo`);
      - no painel, a linha "Trabalho" (`data-modo`) e um botão por modo
        (`data-modo-botao`), com o atual em `aria-pressed`;
      - `sim/` intocado. **Aceite:** o roteiro `tools/shots/F-REPL-d.js`.
  - **F-REPL-e — os estados da árvore na tela (render).** Quando a arte existir, pelo
    BRIEF-ARTE. Até lá, placeholder, como manda a §9.
    - **ENTREGUE (2026-09-28, fila da noite)** — `docs/planos/2026-09-28-8-F-REPL-e.md`.
      - `render/crescimento.ts`:
        - `estadoDeCrescimento` divide o crescer em `muda`, `crescendo_1` e
          `crescendo_2`, pela fração desde `semeadoEm`;
        - a adulta começa no tick em que o `tileMaduro` da sim diz maduro; o teste
          afirma a equivalência tick a tick.
      - Desenho, do mais específico ao mais genérico:
        - PNG `vegetacao/<id>/<estado>` quando existir;
        - senão, o **placeholder**: a adulta do tile em escala 0,4, 0,6 e 0,8
          (eram 1/4, 2/4 e 3/4; a muda subiu a ~40 % por decisão do operador em
          2026-09-28 — a 1/4 ela não se lia como árvore);
        - sem arte de vegetação, o marcador de hoje.
      - Os estados de crescimento saem do sorteio da espécie, porque o PNG da muda
        não pode virar árvore adulta.
      - Evidência:
        - `test-output/F-REPL-e.json`;
        - `test-output/F-REPL-e-shot.json`;
        - `screenshots/F-REPL-e-*.png`, com a partida carregada no tick do replantio.
  - **Depois do b, não antes: re-medir o lenhador** (BALANCE_LOG):
    - a razão N:1;
    - o 2:1 com a serraria;
    - o lote de 2.

    É medição. Girar número é decisão do operador.

- **Aceite.** Cada sub-item tem o seu; aqui vão os do a e do b, que são de sim.
  - **F-REPL-a:**
    - com a mata toda cortada, os tocos voltam a dar tronco: há tronco entregue DEPOIS
      do tick em que caiu a última árvore adulta. Com `reposicao` nula isto reprova, e
      a prova de que acusa é tirar o bloco do dado;
    - toco sob estrada não rebrota em 12 000 ticks;
    - nenhuma unidade fica num tile de árvore com quantidade > 0;
    - a razão N:1 do lenhador vai para a evidência como número da corrida, não como
      aceite: o total não gira.
  - **F-REPL-b:**
    - `cortar` reproduz, byte a byte, a corrida de hoje contra o dado sem `reposicao`;
    - ~~`replantar` não entrega tronco nenhum e deixa zero toco ao alcance~~ (fora:
      decisão 2);
    - `cortar_e_plantar` é o modo de um prédio recém-construído;
    - o comando com o valor atual é no-op: devolve o MESMO estado.
- **Evidência:** `test-output/F-REPL-a.json` e `test-output/F-REPL-b.json`.
  Screenshot só no e.
- **Custo medido compilando.** Método: acrescentar, rodar `npx tsc --noEmit`, contar,
  reverter. Revertido, e `git status` limpo.
  - `modo` obrigatório em `PredioCompleto`: **14 erros**.
    - 2 em `sim/state.ts`, os dois construtores.
    - 12 em testes que montam prédio literal: F05b ×2, F06, F08 ×2, F09, F10, F24a,
      F-TA, F-TP, F-VIVO-a e `helpers/jobs-cenario.ts`.
  - `SetWoodcutterMode` na união `Command`: **1 erro**, o `switch` exaustivo de
    `tick.ts:110`.
  - `tree.reposicao`: **0 erros**. O tipo já é `ReposicaoDeRecurso | null`
    (`data/types.ts:192`), então é só dado, e o loader já converte
    (`loader.ts:597-650`).
  - `modos` e `modoPadrao`: **não medido**. O loader hoje não lê `modos`, e
    `ReceitaDePredio` ganha tipo novo.
- **Premissas do pedido, conferidas no dado:**
  - **"a árvore existe desde a F-D3":** existia antes, mas só no quadrante noroeste. A
    F-D3 tirou a faixa, e a árvore passou a nascer no miolo e perto da vila (nota da
    F-T2b neste arquivo). O que vale para o replantio: há mata ao alcance do lenhador
    desde a F-D3, e ela bloqueia o passo desde a F-T2.
  - **"`modos` sem leitor desde a F16c":** está sem leitor desde a F15a. A F16c tirou os
    modos do aceite porque não havia árvore no terreno (Nota da emenda, F16c). Hoje o
    grep não acha nenhum leitor em `src/`.
  - **"os modos que o KaM tem: só cortar, só replantar, ambos":** o fonte do KaM Remake
    que consultei tem **dois**. O clone é de 2022-06-01 e fica só no scratchpad.
    - `TWoodcutterMode = (wcm_Chop, wcm_ChopAndPlant)` (`KM_Houses.pas:13`);
    - o botão alterna entre os dois (`KM_GUIGameHouse.pas:720-744`);
    - `replantar` sozinho é nosso, e já estava em `data/production.json`.

    Não conferi o jogo de 1998. O item mantém os três, como pedido; tirar `replantar`
    barateia o b.
- **Fonte dos números do KaM.** Anotada também no BALANCE_LOG; nenhum arquivo do KaM
  entra no repositório.
  - `KM_ResMapElements.pas:71-82`:
    - árvore: `TREE_AGE_1/2/FULL` = 2 400 / 5 000 / 8 000;
    - milho: `CORN_AGE_FULL` = 6 400, na mesma unidade (`TERRAIN_PACE`).
  - `KM_Units_WorkPlan.pas:249-252`: cortar é `ua_Work` ×15 mais 20; plantar, ×12.

### VARREDURA-KAM — cruzar o que supomos com o fonte do KaM (leitura; sem posição na fila)

Pedido do operador (2026-09-27, noite 15). **Sem posição na fila:** roda depois da
F-REPL e antes da Fase C.

- **Por quê:** quatro leituras pontuais do KaM corrigiram quatro coisas que estavam
  erradas havia semanas:
  - a projeção;
  - o modelo de taxa;
  - a árvore;
  - os modos do lenhador (dois, não três).

  Uma varredura provavelmente acha mais. O operador registrou que errou três vezes
  contra o KaM: projeção, modelo de taxa e árvore.
- **Escopo:** cruzar o que está marcado como `[geral]`, `[proposta]` ou hipótese nos
  nossos documentos com o código do kam_remake e com o `houses.dat`. Quatro frentes:
  1. **GDD:** tudo o que está marcado `[geral]`, isto é, comportamento suposto e nunca
     medido.
  2. **BALANCE_LOG:** as observações abertas e as hipóteses.
  3. **PROGRESS:** as decisões do operador marcadas para revisão.
  4. **O que o KaM tem e nós não:** mecânicas inteiras que passaram despercebidas
     porque ninguém foi procurar.
- **Resultado:** uma lista, em documento próprio (`docs/varredura-kam.md`), com cada
  achado em uma de três classes:
  - **correção:** estamos errados;
  - **divergência deliberada:** escolhemos diferente, e o registro diz onde e por quê;
  - **lacuna:** eles têm, nós não.

  Cada achado cita o nosso arquivo e linha, e o arquivo e linha do fonte do KaM.
- **Sem mudar nada.** Nem dado, nem código, nem critério de aceite. Cada correção ou
  lacuna vira proposta para o operador, que decide o que entra na fila.
- **Regras que continuam valendo:**
  - nenhum dado, arte ou arquivo do KaM entra no repositório. O clone fica no
    scratchpad, e só entram os números medidos, com a fonte anotada no BALANCE_LOG;
  - "não conferido no fonte" é hipótese e se escreve como hipótese;
  - o fonte do Remake não é o jogo de 1998: divergência entre os dois se registra,
    não se resolve por palpite.
- **Custo:** leitura grande. Segue a §11 (delegar a leitura ampla a um subagente que
  devolve só o resumo) e cabe em mais de uma sessão; se passar de uma, quebra por
  frente, na ordem 1 → 4.
- **Aceite:** o documento existe; cada item das frentes 1 a 3 tem uma classe ou a
  marca "sem correspondente no KaM"; nenhum arquivo fora de `docs/` e do PROGRESS
  mudou no commit.

### F-ESC — A escala do prédio: altura máxima pela largura (render + ferramenta; proposta, não implementar antes do sim do operador)
- **FORA DA ESPERA POR JANELA (operador, 2026-09-27, noite 10).** O Codex continua em
  `src/render/`: a rota agora é render do Blender com pintura por cima, e ele vai mexer
  no manifesto e no derivador. A F-ESC **depende da arte estabilizar**, não de uma
  janela livre no `render/`: medir a altura dos sprites enquanto a rota de arte muda
  mediria números que vão ser refeitos. Retoma quando o operador disser que a arte
  estabilizou. O item abaixo ("Quando começar") fica como histórico.
- **Quando começar (operador, 2026-09-27):** assim que o Codex sair do `render/`. Ele está
  ajustando o azimute da câmera do Blender e vai mexer nos assets. Até lá, a F-ESC não
  começa.
- **Liberada (operador, 2026-09-27, noite 6):** o Codex leu o kam_remake, e o KaM é
  **ortogonal**:
  - tiles quadrados de 40×40, `glOrtho`, e conversão que não mistura X com Y;
  - estrada por máscara dos quatro vizinhos cardinais;
  - o que parece isométrico é a arte, desenhada em perspectiva oblíqua dentro de
    retângulos.

  O grid quadrado está alinhado com o código real. A F-ESC pode seguir, e a régua do
  homem continua valendo.
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
- **Aceite (escrito na sessão autônoma de 2026-09-28; o rascunho abaixo, riscado, é o
  de antes):**
  - a) nenhum sprite de prédio no manifesto passa de `k × largura do lote` sem exceção
    declarada, e nenhuma exceção declarada já cabe em k
    (`tests/F-ESC-escala.test.ts`, com as três cópias adulteradas que reprovam);
  - b) **k = 1,0 no manifesto (`regraDeAltura.k`), e a exceção de 1,33 declarada no
    próprio prédio (`alturaMaxPorLargura`)**, no armazém e na Casa do Coronel. Isso
    substitui o "armazém derivado com altura ≤ largura" do rascunho, por decisão do
    operador ("exceção por prédio no dado; o sobrado usa 1,33"). **Motivo:** o armazém
    novo tem 254 px de canvas (a madeira da revelação puxa), e 1,33 é o alvo do sobrado,
    3,5 H = 255 px sobre o lote de 192;
  - c) `npm run shot -- F-ESC` roda a abertura da F17 inteira. Com os seis prédios da
    régua de pé, ele lê a caixa **desenhada** de cada sprite completo, tirada da imagem
    (`debug.caixasDesenhadas`: `displayWidth`/`displayHeight`), e afirma
    `h ≤ teto × lote`, com o teto lido do manifesto pelo próprio roteiro. Depois ele
    captura os seis num quadro a 0,5. A tabela vai para `test-output/F-ESC-caixas.json`
    e não para o `F-ESC.json`: o `F-ESC.json` é do teste, que o reescreve a cada
    `npm run test`. Sonda: sem a exceção do armazém e com o render ignorando o teto, o
    roteiro reprova (`'p1' (storehouse) desenha 254.0 px ... passa de 1 x lote`).
  - ~~b) o armazém derivado sai com altura ≤ largura;~~
  - ~~c) screenshot do roteiro da F17 mostra os seis prédios, e o
    `test-output/F-ESC.json` grava a caixa desenhada de cada um.~~
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
- **Implementada a parte de código (2026-09-28, fila noturna 4; plano em
  `docs/planos/2026-09-28-4-F-ESC.md`).** A arte já estabilizou (os 28 prédios têm arte).
  - `assets/manifest.json: regraDeAltura.k = 1,0` e `alturaMaxPorLargura: 1,33` no
    armazém e na Casa do Coronel. O 1,33 é **derivado**, não escolhido: o alvo do
    sobrado do operador, 3,5 H = 255 px, sobre o lote de 3 (192 px).
  - `src/render/escala-predio.ts` (puro): `escalaDoSprite` = mínimo entre a escala do
    lote e `teto × lote / altura`; `violacoesDaAltura` acusa predio alto sem exceção e
    exceção que já cabe em k. A cena (`desenharSprite`, `caixaDoSprite`) escala por ela,
    com o `tilePx` do dado. Com a arte de hoje nenhum sprite muda de tamanho na tela.
  - `tools/derivar-sprites.js` lê `tile_px` de `data/terrain.json` e o teto do
    manifesto (a decisão "corrija junto"). **Não foi rodado:** os caminhos de base dos
    `GRUPOS` apontam para arquivos que o commit `c9b52b3` apagou; o derivador está
    parado desde a rota do Blender.
  - `tests/F-ESC-escala.test.ts`: a regra no manifesto real, as três cópias adulteradas
    (alto sem exceção, exceção morta, exceção retirada) e a escala pura.
  - **PARA REVISÃO (decisões de sessão):** k mora no manifesto e não no
    `data/terrain.json` (a saída que o item deixava; assim a feature não toca `src/sim/`).
    A régua mede o **canvas** (`tamanho`), porque é ele que o render escala.
  - **Achado:** o canvas do armazém (254 px) é puxado pela imagem `madeira`, que ocupa
    212×252; o `completo` visível mede só 196×190 (2,60 H). O armazém completo parece
    uma térrea, não um sobrado — a exceção de 1,33 existe para a madeira.
  - **Achado:** o transbordo de largura decidido é 1,0 com exceção declarada, e o
    armazém e a Casa do Coronel têm canvas de 214 px (1,11 × o lote) sem exceção de
    largura no dado. Ninguém acusa isso hoje (`F17f` só pede `≥`).
- **Tabela da régua, arte nova (medida 2026-09-28 por script, alfa > 16, nenhum PNG
  aberto; H = serf = 73 px).** "visível" é a caixa do `completo`; "lateral" é quanto o
  visível passa (+) ou fica aquém (−) da largura do lote, somados os dois lados.
  Nenhum sprite foi regenerado.

  | prédio | fp | arquivo | visível | em H | alvo (H) | desvio | h/w visível | canvas h / lote | lateral (px) |
  |---|---|---|---|---|---|---|---|---|---|
  | storehouse | 3×3 | 214×254 | 196×190 | 2,60 | 3,5 sobrado | −26 % | 0,97 | 1,32 | 4 |
  | woodcutters | 3×2 | 192×176 | 192×176 | 2,41 | 2,5 térrea | −4 % | 0,92 | 0,92 | 0 |
  | quarry | 3×2 | 192×151 | 189×149 | 2,04 | 2,5 térrea | −18 % | 0,79 | 0,79 | −3 |
  | sawmill | 4×2 | 256×157 | 256×157 | 2,15 | 2,5 térrea | −14 % | 0,61 | 0,61 | 0 |
  | schoolhouse | 3×3 | 214×240 | 214×240 | 3,29 | 3,5 sobrado | −6 % | 1,12 | 1,25 | 22 |
  | inn | 4×3 | 256×178 | 256×178 | 2,44 | 2,5 térrea | −2 % | 0,70 | 0,70 | 0 |
  | watchtower | 2×2 | 128×128 | 103×122 | 1,67 | — | — | 1,18 | 1,00 | −25 |
  | farm | 4×3 | 256×192 | 185×145 | 1,99 | 2,5 térrea | −21 % | 0,78 | 0,75 | −71 |
  | wineyard | 3×2 | 192×128 | 125×90 | 1,23 | 2,5 térrea | **−51 %** | 0,72 | 0,67 | −67 |
  | fishermans | 3×2 | 192×128 | 123×86 | 1,18 | 2,5 térrea | **−53 %** | 0,70 | 0,67 | −69 |
  | gold_mine | 2×1 | 128×96 | 90×84 | 1,15 | 2,5 térrea | **−54 %** | 0,93 | 0,75 | −38 |
  | coal_mine | 3×2 | 192×128 | 116×111 | 1,52 | 2,5 térrea | **−39 %** | 0,96 | 0,67 | −76 |
  | iron_mine | 3×1 | 192×96 | 87×84 | 1,15 | 2,5 térrea | **−54 %** | 0,97 | 0,50 | −105 |
  | weapons_workshop | 4×2 | 256×128 | 120×115 | 1,58 | 2,5 térrea | **−37 %** | 0,96 | 0,50 | −136 |
  | barracks | 4×4 | 256×256 | 221×224 | 3,07 | — | — | 1,01 | 1,00 | −35 |
  | marketplace | 4×3 | 256×192 | 159×109 | 1,49 | 2,5 térrea | **−40 %** | 0,69 | 0,75 | −97 |
  | mill | 3×3 | 192×192 | 170×125 | 1,71 | 2,5 térrea | **−32 %** | 0,74 | 1,00 | −22 |
  | bakery | 3×3 | 192×192 | 161×137 | 1,88 | 2,5 térrea | −25 % | 0,85 | 1,00 | −31 |
  | swine_farm | 4×3 | 256×192 | 153×103 | 1,41 | 2,5 térrea | **−44 %** | 0,67 | 0,75 | −103 |
  | stables | 4×3 | 256×192 | 167×111 | 1,52 | 2,5 térrea | **−39 %** | 0,66 | 0,75 | −89 |
  | butchers | 3×3 | 192×192 | 163×128 | 1,75 | 2,5 térrea | **−30 %** | 0,79 | 1,00 | −29 |
  | tannery | 3×2 | 192×128 | 101×80 | 1,10 | 2,5 térrea | **−56 %** | 0,79 | 0,67 | −91 |
  | armory_workshop | 3×3 | 192×192 | 178×154 | 2,11 | 2,5 térrea | −16 % | 0,87 | 1,00 | −14 |
  | metallurgists | 3×3 | 192×192 | 192×175 | 2,40 | 2,5 térrea | −4 % | 0,91 | 1,00 | 0 |
  | town_hall | 4×3 | 256×192 | 191×185 | 2,53 | 2,5 térrea | +1 % | 0,97 | 0,75 | −65 |
  | iron_smithy | 4×2 | 256×128 | 121×110 | 1,51 | 2,5 térrea | **−40 %** | 0,91 | 0,50 | −135 |
  | weapon_smithy | 4×2 | 256×128 | 122×104 | 1,42 | 2,5 térrea | **−43 %** | 0,85 | 0,50 | −134 |
  | armor_smithy | 4×3 | 256×192 | 185×173 | 2,37 | 2,5 térrea | −5 % | 0,94 | 0,75 | −71 |

  - **Leitura:** as seis primeiras (a régua aprovada) ficam entre −18 % e −2 % da térrea,
    salvo o armazém. **Os 22 prédios da leva nova ficam, em 14 casos, 30 % ou mais abaixo
    do alvo**, e boiam no lote: ferraria, oficina, curtume, mercado e as criações ocupam
    menos de 2/3 da largura (lateral de −90 a −136 px). A torre (1,67 H) e o quartel
    (3,07 H) não têm classe de altura decidida.
  - Vegetação (sem mudança desde 2026-09-27): árvore 77 px (1,05 H), umbuzeiro 62,
    mandacaru, facheiro e xique-xique 120, macambira 64.

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
- **Nota para o render (LOTE3-b1, 2026-09-27):** a receita com colheita ganhou
  `colheita.ticksNoTile`.
  - `ticksDoCiclo` continua sendo o ciclo inteiro, e o render não precisou mudar.
  - No Canavial, de 0 a `ticksNoTile` o canavieiro está no tile, e dali até o fim está
    dentro da casa (`trabalhando`). Com isso a prensa já anima quase só com ele dentro.
  - Animar SÓ na fase da casa pede que o render leia `ticksNoTile`. Fica para quando o
    Codex quiser.
- **Nota para o render (LOTE3-b2, 2026-09-27):** a ordem do ciclo agora é
  `colheita.ticksDeDescanso` dentro do prédio (`trabalhando`, a tarefa já reclamada),
  depois `ticksNoTile` no tile, e o resto até `ticksDoCiclo` dentro da casa.
  - O resto é zero na fazenda, no lenhador e no pescador.
  - Quarry, farm, woodcutters e fishermans também têm fases agora.
  - O relógio de 0 a `ticksDoCiclo` que o render lê não mudou de sentido.
  - Animar só a casa é `ticksDeDescanso + ticksNoTile` a `ticksDoCiclo`.
- **Fechado pelo BUG-X (2026-10-01, decisão do operador): o caso 2 anima só enquanto o
  ocupante está dentro.** A regra é pelo rótulo, não pela fase: `ROTULOS_DE_DENTRO`
  (`trabalhando`) em `src/render/trabalho.ts`, conferido contra `POSICAO_DO_ESTADO` da
  colisão. Anima no descanso e na casa (os dois são `trabalhando`, dentro), fica parado
  com ele no tile (`colhendo`). Os casos 3, 4 e 5 não mudaram. A pergunta em aberto do
  PROGRESS sobre o caso 2 está respondida.
- **Fechado pela F-VIVO-f (2026-10-01): o caso 2 anima só na fase da casa.** Além do
  rótulo, a fase: `quadroDeTrabalho` lê `ticksDeDescanso + ticksNoTile` (de
  `dadosDoTrabalho`, que tira de `gameData.producao.receitas[id].colheita`) e devolve
  `null` antes disso; os terços dividem `[descanso + noTile, ciclo)`. No descanso, com o
  canteiro dentro, vale o ocioso da F-VIVO-e. As notas LOTE3-b1 e LOTE3-b2 acima estão
  cumpridas.

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
- **Nota de implementação (2026-09-28):** `src/render/animais.ts`, teste
  `tests/F-VIVO-c-animais.test.ts`, roteiro `tools/shots/F-VIVO-c.js`. O roteiro carrega
  o save que o teste grava (a cadeia da carne da F19b), pelo botão "carregar". Sem
  `ancoras.curral` no manifesto, os pontos padrão ficam acima do volume da arte nova:
  a âncora vem com a arte. Em aberto para o operador: o curral esvazia entre entregas
  de milho, porque o aceite diz "sem insumo, curral vazio".

**Aceite da F-VIVO-d.** Uma aldeia com os cinco casos, capturada a 0,75. O roteiro
grava em `test-output/F-VIVO-d.json` o tamanho em px de cada camada, e o
`docs/BRIEF-ARTE.md` troca a "hipótese até medir" da regra do zoom pelo número medido.
- **Quebra (2026-09-28, fila da noite; PARA REVISÃO):** os cinco casos não cabem num
  quadro do mapa real. Campo arado, veio da serra e lajedo ficam em lugares diferentes,
  e juntá-los pediria recurso fora do lugar, o andaime que a F21b recusou.
  - **F-VIVO-d1 (feita):** cada caso é medido a 0,75 na cadeia onde mora:
    - carne: guarda, criação e dentro;
    - ouro: luz e dentro;
    - pedreira: transforma.

    O roteiro `tools/shots/F-VIVO-d.js` carrega os saves que
    `tests/F-VIVO-d-aldeia.test.ts` grava e escreve `test-output/F-VIVO-d.json`. O
    brief troca a hipótese pelo número.
  - **F-VIVO-d2 (feita, 2026-09-28, sessão autônoma):** o quadro único com os cinco.
    - **Aceite corrigido (decisão do operador, 2026-09-28):** *"no mapa real não cabe.
      Use dois quadros, ou monte cenário de fixture com os casos juntos."* O "uma
      aldeia com os cinco casos" passa a ser **uma fixture de vitrine**, e não um lugar
      do mapa. **Motivo:** no mapa os cinco moram em três lugares a 20+ tiles um do
      outro, e a vista a 0,75 tem ~21×15.
    - A vitrine é `cenarioDaAldeiaDaSerra` (`tests/helpers/producao-cenario.ts`): a cadeia
      do ouro (luz, dentro), mais uma pedreira no lajedo de verdade da serra
      (transforma), uma fazenda com milho na saída (guarda) e uma Malhada com milho na
      entrada (criação). A posição vem do `canPlace` do jogador, e nenhum recurso sai do
      lugar.
    - O aceite: os cinco alvos ativos no **mesmo** tick (teste), os cinco footprints
      inteiros na vista a 0,75 e os cinco casos publicados (roteiro, 4ª captura).
    - **A vitrine não é partida:** fazenda sem campo e Malhada sem rua não se alcançam
      jogando, e a faixa mostra os alertas disso. Ela serve ao quadro do render, nunca a
      aceite de regra da sim.

#### F-VIVO-e em diante (decisões do operador, 2026-09-30; aplicado em 2026-10-01)

Plano: `docs/planos/2026-09-30-F-VIVO-e-em-diante.md` (e5a7e95). A F-VIVO-0/a/b não se
reescrevem: o que muda nelas entra como sub-item novo. Tudo é **render**: nenhum toca em
`src/sim/`.

| sub-item | o que entra | depende de |
|---|---|---|
| F-VIVO-e | ocioso genérico: casa ocupada e parada ≠ casa vazia (placeholder) | BUG-X, b |
| F-VIVO-f | caso 2 anima só na fase da casa, `[descanso + noTile, ciclo)` | e |
| F-VIVO-g | curral guarda o último quadro enquanto ocupado | c |
| F-VIVO-h | escola anima enquanto há recruta em treino (prioridade baixa) | 0 |

**Aceite da F-VIVO-e (o ocioso).** Prédio completo com receita, **ocupante dentro** e sem
quadro de trabalho desenha o laço `ocioso` (8 quadros, `n = 1 + ⌊tick / TICKS_POR_QUADRO⌋
mod 8`) na `area` de trabalho. "Dentro" é **o mesmo predicado** que esconde a unidade no
BUG-X (`src/render/visibilidade.ts`). Sem PNG, o retângulo da `area` com `ocioso_<n>`. O
manifesto aceita `trabalho` com id `ocioso` (`ocioso_1..8`); `ocioso_9` e duas entradas
`ocioso` reprovam no teste. A fumaça não acompanha o ocioso.
1. `quadroOcioso` e `quadroDeTrabalho` nunca são não-nulos no mesmo prédio no mesmo tick:
   varredura de 6 000 ticks da vila da calibração, contagem em `test-output/F-VIVO-e.json`.
2. Não-nulo em `esperando_insumo` e `saida_cheia` com o ocupante dentro; nulo sem ocupante,
   com ocupante fora (colhendo, indo comer, comendo), em obra e em prédio sem receita.
3. No caso 1, o descanso mostra o ocioso e a fase no tile não mostra nada.
4. O `n` avança e volta a 1 sem pulo.
5. Roteiro despausado (§8): casa ocupada e parada ao lado de casa vazia do mesmo tipo;
   `debug.quadrosOciosos` avança numa e fica ausente na outra.
- **Pausado — DECIDIDO pela D3 do operador (2026-10-01) e entregue.** Pausado, o homem fica
  dentro e o ocioso acende: o KaM não tira o trabalhador ao parar a produção (nota do BUG-X
  na F16c). Aceite 6 em `tests/F-VIVO-e-ocioso.test.ts` (pausa pelo comando, pelo `step`) e
  roteiro `tools/shots/F-VIVO-e-pausado.js`. O texto abaixo é o histórico **e está revogado**: o "pausado: sem ocioso" dele não vale mais. Ela colidia com a decisão do BUG-X do mesmo dia, em que o pausado é a casa
  fechada e o trabalhador **se desenha fora** (`KM_Units.pas:529-600`). As duas juntas dão
  ocioso com o homem visível na porta, que é a divergência que o predicado único existe
  para impedir. Entregue com o predicado único (pausado: sem ocioso), e o teste afirma isso
  como estado atual; a troca é uma linha em `visibilidade.ts` e uma no teste, e decide
  também se o pausado esconde o homem.

**Aceite da F-VIVO-f (o caso 2 na casa).** Na receita com colheita, `quadroDeTrabalho` só
devolve quadro em `[ticksDeDescanso + ticksNoTile, ticksDoCiclo)`; no descanso vale o
ocioso, no tile nada. Os terços dividem a fase da casa. Fecha a nota LOTE3-b2 da F-VIVO-b.
1. Pedreira e Canavial, tick a tick num ciclo: nulo em `[0, descanso + noTile)`, a
   sequência `inicio → meio → fim` inteira no resto.
2. Com o ocupante `colhendo`, nem trabalho nem ocioso.
3. Os números de fase vêm de `gameData.producao…colheita`, não de literal.
4. Roteiro despausado: pedreira com o canteiro fora e pedreira com ele dentro.
- **Entregue (2026-10-01).** `src/render/trabalho.ts` e `src/render/predios.ts`
  (`DadosDoTrabalho` ganhou `ticksDeDescanso` e `ticksNoTile`),
  `tests/F-VIVO-f-caso-2-na-casa.test.ts`, evidência em `test-output/F-VIVO-f.json`,
  roteiro `tools/shots/F-VIVO-f.js`. A F-VIVO-b foi ajustada à regra nova.

**Aceite da F-VIVO-g (o curral guarda).** `curralDesenhado(anterior, atual, ocupado)` em
`src/render/animais.ts`, pura; a memória num `Map` da cena. Depois de carregar partida, o
curral começa vazio até a próxima entrega (memória de tela, não entra no save).
1. Vazio e ocupado → `anterior`; cheio → `atual`; desocupado → vazio.
2. Na cadeia da carne (F19b), pelo `step`, ticks com o curral desenhado vazio e o prédio
   ocupado caem a 0 depois da primeira entrega; antes e depois em `test-output/F-VIVO-g.json`.
3. Roteiro: entre duas entregas, `debug.animaisDoCurral` (`src/render/debug.ts:167`) não
   vazio no curral. *(O plano dizia `debug.animaisDesenhados`, que não existe.)*
- **Entregue (2026-10-01, tarefa 7 da leva).** `curralDesenhado` em `src/render/animais.ts`; a
  memória (`curralGuardado`) na `WorldScene` esvazia quando o tick volta ou salta mais que
  `MAX_PASSOS_POR_QUADRO` (`src/laco.ts`), que é a partida carregada. `tests/F-VIVO-g-curral-guarda.test.ts`,
  evidência em `test-output/F-VIVO-g.json` (1 350 ticks vazios antes, 0 depois), roteiro
  `tools/shots/F-VIVO-g.js`, que reprova no tick 14 863 sem a guarda.

**Aceite da F-VIVO-h (a escola treina; baixa).** Laço `treino_1..8` enquanto a fila da
escola tem item **`treinando`**; fila vazia ou só `aguardando`, nada. **Conferido
(2026-10-01):** a fila é `ItemDeFila` em `src/sim/state.ts:1320`, união discriminada com
`estado: 'aguardando' | 'treinando'` (`:1331`): o render distingue sem mudar a sim. *(O plano
apontava `src/sim/escola.ts`.)* Manifesto com exceção nomeada para `schoolhouse`, e o
`docs/BRIEF-ARTE.md` tira a escola da lista "sem receita".
**Entregue (2026-10-01, leva desatendida, tarefa 8):** `quadroDaEscola` (`src/render/trabalho.ts`),
`ID_DA_ESCOLA` e `LACOS_DA_ESCOLA` (`src/render/manifesto-camadas.ts`), `debug.quadrosDaEscola`.
`tests/F-VIVO-h-escola.test.ts`, evidência em `test-output/F-VIVO-h.json` (150 ticks de laço,
do tick 29 ao 178; o recruta sai no 179 e o laço some nesse tick). Roteiro
`tools/shots/F-VIVO-h.js`, que reprova no tick 30 com a fila desligada na cena.

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
    default. **Trocado pela D-PRODUCAO-03a (decisão do operador, 2026-09-29):** a oficina
    nasce sem encomenda, e o caminho real encomenda cada saída pelo `SetProductionQuota`
    quando a oficina fica pronta; sem encomenda, ela não começa ciclo.
  - Com a cota fixada pelo comando, só sai a arma pedida (desde a 03a, e no máximo o
    encomendado).
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
- **F24b — a cadeia do couro. ENTREGUE (2026-09-29, lote do operador).** Plano
  `docs/planos/2026-09-29-F24b-cadeia-do-couro.md`. O item não tinha aceite escrito para o
  couro; o aceite é o do plano. A sonda fechou a cadeia sem código novo (Malhada → couro
  cru → Curtume → curtido → Casa do Gibão → gibão e escudo no armazém), e o que se entregou
  é o GUARDA: `tests/F24b-cadeia-do-couro.test.ts`, com o contra-exemplo sem o Curtume, na
  fixture `cenarioDaCadeiaDoCouro`. **PARA REVISÃO:** a sigla ficou `F24b`, sub-item da série
  aberta, como a F24a.
- **F24c — a Casa do Gibão escolhe a peça pela encomenda, como no KaM. ENTREGUE
  (2026-09-30; aprovada pelo operador em 2026-09-29).** Plano
  `docs/planos/2026-09-29-F24c-casa-do-gibao-por-encomenda.md`; o aceite é o do plano.
  `armory_workshop` ganhou `escolheSaida` e `entraPorSaida` (gibão = 1 couro, escudo = 1
  madeira); o começo do ciclo pula a peça encomendada sem insumo (o `PickOrder`,
  `KM_Houses.pas:1585-1600`); regra `producao/oficina-de-guerra-sem-encomenda` no
  validate:data; Shift+clique no − / + da encomenda anda 10, com linha na ajuda. Guarda:
  `tests/F24c-casa-do-gibao-por-encomenda.test.ts` (reprova antes da correção); roteiro
  `tools/shots/F24c.js`, com o jogo andando. **PARA REVISÃO:** a sigla ficou `F24c`, como a
  F24b. Texto da proposta, histórico: Hoje `armory_workshop` faz gibão E escudo no mesmo ciclo, comendo
  couro E madeira: é a única oficina de guerra que produz sem encomenda (D-PRODUCAO-03), e
  sem madeira não faz gibão nenhum, mesmo com couro sobrando. No KaM
  (`KM_ResHouses.pas:251-252`, `WARFARE_COSTS` em `KM_ResWares.pas:73-75`, clone 731a8a4) a
  casa faz UMA peça por ciclo pela encomenda, e cada peça come UM insumo: escudo = 1
  madeira, gibão = 1 couro. Alinhar pede **insumo por saída** na receita com
  `escolheSaida` (hoje o `entra` é um só, `sim/producao.ts`): mudança de modelo da sim. O
  total de insumo por peça não muda. O Curtume já bate com o KaM (1 couro cru → 2 curtidos).
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
### F-CERCO-a — Tropa ataca prédio, por ordem (sim)

- **Quebra (fila da noite, 2026-09-28, pela ordem do operador).** A ordem foi:
  *"Comece pelo `lado` (dono) de prédio e unidade. Se ela não couber inteira,
  entregue o dono e pare."* A feature não coube, e ficou quebrada assim:
  - **F-CERCO-a1 — o dono. ENTREGUE.**
    - `lado: number`, obrigatório, em `PredioBase` e `Unidade`, com
      `LADO_DO_JOGADOR = 0` em `sim/state.ts`.
    - Quem cria põe o lado de quem mandou: a abertura e o `PlaceBlueprint` põem o do
      jogador, e o `completarObra` preserva o da obra.
    - A unidade formada herda o lado da escola.
    - `VERSAO_DO_SAVE` foi a 3. O save da versão 2 é **migrado** (`lado` do jogador
      em todo prédio e unidade), por decisão do operador em 2026-09-28: *"Recusar com
      mensagem é correto para dado corrompido, não para versão anterior do meu próprio
      jogo."* A versão 1 continua recusada.
    - Teste: `tests/F-CERCO-a1-lado.test.ts`. A herança é provada com uma escola de
      lado 1.
  - **F-CERCO-a2 — o ataque. ENTREGUE (2026-09-28, sessão autônoma; plano em
    `docs/planos/2026-09-28-A5-F-CERCO-a2.md`).**
    - O comando é `AttackBuilding` e o sistema é `systems/cerco.ts`
      (`indo_atacar` → `atacando`). Ele roda antes do `sanearTarefas`.
    - A queda usa `semOPredio` da demolição, sem devolução.
    - Teste: `tests/F-CERCO-a2-ataque.test.ts`, com os cinco aceites mais o ocupante
      solto.
    - **A cadência é 8 ticks, não 12:** os 1,2 s do dado passam pela escala `combate`
      de `time.json`, que é 1,5 hoje. A proporção com a cadência das unidades se mantém,
      porque a mesma escala vale para as duas.
- **Origem (decisão do operador, 2026-09-28)**: *"ele vem ANTES da F25 (Quartel), não só
  antes da F34. Sem ele o combate não tem objetivo — tropa mata tropa e a partida não
  acaba."* O que a VARREDURA-KAM leu no fonte está em `docs/varredura-kam.md`, frente 4.
- **Regras do KaM, que o operador mandou usar**:
  - **Corpo a corpo tira 2 de HP por golpe, sem sorteio.** Attack e Defence não entram
    (`KM_UnitTaskAttackHouse.pas:191-192`).
  - **Obra inacabada cai mais rápido.** No KaM, vida = progresso − dano
    (`KM_Houses.pas:1175`). Aqui isso sai de graça: o `hp` da obra já é o HP martelado
    (`state.ts`, `PredioBase.hp`). O dano subtrai do `hp`, e não nasce campo novo.
  - **A ordem é explícita. Tropa nunca ataca prédio sozinha.** No KaM só a ordem
    `gicArmyAttackHouse` cria a tarefa (`KM_GameInputProcess.pas:1009`,
    `KM_UnitWarrior.pas:940-962`).
  - Os números estão em `data/combat.json` `ataqueAPredio` (2 corpo a corpo, 1 projétil,
    sem rolagem), com `escala` de combate. Nada de literal no `.ts`.
- **Pré-requisito que o item traz: dono.** Hoje o estado não tem lado; sem lado não
  existe prédio inimigo.
  - O item acrescenta `lado` a `PredioBase` e a `Unidade`. A vila do jogador é o lado 0.
  - **Custo medido compilando (2026-09-28), depois revertido:**
    - no prédio, 27 erros: 3 em `src/sim/` (`state.ts` ×2, `systems/build.ts`) e 24 em testes e fixtures;
    - na unidade, 7 erros: 2 em `src/sim/` (`state.ts`, `systems/escolas.ts`).
- **Tropa antes do Quartel:** o soldado nasce por fixture de teste. A F25 é quem o
  cria em partida, e a ordem pela tela é da F26. Aqui a ordem é o comando
  `AttackBuilding { unidades, predio }` em `commands.ts`.
- **Escopo**:
  - o comando valida o alvo: prédio do próprio lado é recusado, e a recusa não muda o estado;
  - o soldado anda até encostar no prédio e golpeia na **cadência própria do golpe em
    prédio** (`ataqueAPredio.cadencia_segundos_base`, já em ticks no loader como
    `combate.ataqueAPredio.ticksCadencia`), nunca na `cadenciaDeAtaque` das unidades;
  - HP zero leva o prédio pelo mesmo caminho da demolição (`systems/demolicao.ts`,
    F16a). As tarefas são liberadas e o ocupante sai.
  - Evento novo só nasce se o aceite ou a tela o consumirem.
- **Fora**:
  - projétil em prédio (entra com o arqueiro, ver F28);
  - a tela da ordem (F26);
  - fogo no prédio (o KaM tem 8 níveis, `KM_Houses.pas:1352`), que é render e fica para depois, com registro.
- **Decisão do operador (2026-09-28): cadência própria, mais lenta, com 2 por golpe.**
  A nossa `cadenciaDeAtaque_segundos_base` (0,5 s) é dobrada para compensar o HP dobrado
  das unidades, e prédio não tem HP dobrado. Aplicada ao prédio, ele cairia ~2,4× mais
  rápido que no KaM, por acidente e não por decisão. O número é **derivado, não
  escolhido**: 6 + 6 ticks de 100 ms no KaM (`KM_UnitTaskAttackHouse.pas:167`, `:189`)
  = 1,2 s. Os 12 ticks são leitura do fonte, não medida (HIPÓTESE — ABERTA).
- **Aceite**:
  - N soldados com a ordem tiram exatamente 2 × golpes do `hp` de um prédio inimigo;
    o prédio chega a 0 e some, e as invariantes do JobBoard continuam valendo;
  - um soldado encostado num prédio inimigo por T ticks, **sem a ordem**, não tira HP nenhum;
  - uma obra com `hp` h cai em ⌈h/2⌉ golpes, menos que o mesmo prédio completo;
  - uma ordem contra prédio do próprio lado é recusada, e o estado fica igual;
  - a mesma corrida duas vezes dá o mesmo estado.

### F-CERCO-b — Reparo: ligado prédio a prédio, começa desligado (sim)
- **ENTREGUE (2026-09-28, sessão autônoma; plano em `docs/planos/2026-09-28-A6-F-CERCO-b.md`).**
  - `PredioCompleto.reparo`: obrigatório e desligado. O save foi à versão 4, com a
    migração 3 → 4.
  - Comando `SetBuildingRepair`, tarefa `'reparar'` (só o laborer) e regra em
    `sim/reparo.ts`.
  - O gerador cria até `laborersMaximosPorObra`, o mesmo teto da obra.
  - A martelada é a da obra (`ticksPorMartelada`, `hpPorMartelada`).
  - Teste: `tests/F-CERCO-b-reparo.test.ts`, com os quatro aceites mais a recusa e a
    migração.
- **Origem (decisão do operador, 2026-09-28)**: *"item próprio, logo depois. É o
  contrapeso, e sem ele o ataque fica sem resposta. Ligado prédio a prédio e começa
  desligado, como lá."*
- **Regras do KaM**:
  - o reparo devolve 5 de HP por martelada do laborer (`KM_UnitTaskBuild.pas:995-1001`);
  - o prédio só entra na lista se o reparo estiver ligado nele;
  - para o jogador humano, o reparo começa desligado (`KM_Houses.pas:532`, `:1307-1308`).
  - **A nossa martelada já vale 5** (`buildings.json` `hpPorMartelada`). O reparo
    reaproveita a martelada da obra, sem número novo.
- **Escopo**:
  - o comando `SetBuildingRepair { predio, ligado }` (o GDD já lista "ligar/desligar reparo", `GDD.md:153`);
  - o campo nasce desligado;
  - o prédio completo com `hp` abaixo do teto e reparo ligado gera tarefa de reparo no
    JobBoard, e o laborer a reclama;
  - a tarefa tem `release` em todo ramo de erro: prédio demolido, reparo desligado no
    meio, unidade morta.
- **Fora**: o botão no painel do prédio é item de UI à parte, porque §10 não deixa
  misturar sim e render.
- **Aceite**:
  - com o reparo desligado, o prédio danificado não recebe martelada nenhuma;
  - ligado, o `hp` sobe 5 por martelada até o teto e para, e a tarefa some;
  - desligar no meio libera a tarefa, e as reservas voltam;
  - o prédio completo sem dano não gera tarefa, mesmo com o reparo ligado.

### F25 — Barracks e criação de soldado
- **Quebra (sessão autônoma, 2026-09-28; plano em `docs/planos/2026-09-28-A8-F25a-quartel.md`).**
  O item tinha só a nota de arte. O escopo abaixo é leitura conservadora do GDD (§2.3,
  §6.1, Anexo A 12.1), **PARA REVISÃO**.
  - **F25a — a sim. ENTREGUE.**
    - Os requisitos viajam do armazém para a gaveta `entrada` do quartel pela tarefa nova
      `arma-para-quartel` (nível 11 de `delivery.json`, o último). O quartel quer tudo, e
      nada vira excedente.
    - O recruta sem torre se alista pela tarefa `alistar`: anda até a porta e entra, e
      `PredioCompleto.recrutas` sobe.
    - `TrainSoldier { predio, tipo }` consome 1 de cada requisito e 1 recruta, e o soldado
      nasce na porta no mesmo tick, com o lado do quartel.
    - Recusa com motivo: não é quartel, tipo não militar, sem requisito, sem recruta ou
      porta bloqueada.
    - **Dado corrigido:** `horse` → `horses` nos requisitos de batedor e cavaleiro.
      Regra nova no `validate:data` (`validarRequisitosDoQuartel`).
    - Teste: `tests/F25a-quartel.test.ts`.
  - **F25b — o painel do quartel (ui).** Falta escrever. Recrutas dentro, requisitos na
    gaveta, um botão por tipo que manda `TrainSoldier` e desabilita o que não cabe, dizendo
    o motivo. Screenshot com o roteiro despausado da §8.
    - **ENTREGUE (2026-09-28; plano em `docs/planos/2026-09-28-B1-F25b-painel-do-quartel.md`).**
      O item não tinha aceite, e o aceite foi escrito na sessão (PARA REVISÃO):
      - (a) os 9 tipos, e com 1 machado e 1 recruta só o `militia` cabe;
      - (b) o motivo do painel é o do `TrainSoldier`, tipo a tipo, em 6 gavetas;
      - (c) a tela, com o jogo andando: forma, os recrutas caem e o motivo aparece.
      - `PainelDoPredio.quartel` usa o mesmo `motivoDaRecusaDeSoldado` do comando.
        `porta-bloqueada` fica fora do painel e só o comando a diz.
      - Teste `tests/F25b-painel-do-quartel.test.ts` e roteiro `tools/shots/F25b.js`.
- **Nota (decisão do operador, 2026-09-26): a arte dos mercenários espera o Quartel.**
  Os cinco mercenários (`rebel`, `rogue`, `vagabond`, `barbarian`, `warrior`) ficaram
  fora da arte: `data/units.json` não declara `direcoesDeSprite` para eles e
  `data/theme-sertao.json` não descreve a arma. O operador decide as duas lacunas
  quando o Quartel existir. Até lá, `docs/BRIEF-ARTE.md` manda não gerar mercenário.
### F26 — Seleção e movimento de grupo
- **Quebra (sessão autônoma, 2026-09-28; plano em `docs/planos/2026-09-28-A9-F26-grupo.md`).**
  A feature toca a sim e a tela, e a §10 não deixa as duas numa feature que não é de
  integração.
  - **F26a — a ordem de mover (sim). ENTREGUE.**
    - `MoveUnits { unidades, destino }`, com FSM `marchando` → `ocioso`.
    - Cada unidade recebe um tile andável próprio em anéis em volta do destino. Isso não
      é formação (F27).
    - A ordem nova substitui a anterior, inclusive o ataque.
    - Recusa inteira com motivo.
    - Teste: `tests/F26a-marcha.test.ts`.
  - **F26b — selecionar e comandar pela tela (render + input + ui). ENTREGUE.**
    - O acerto mira o desenho (`render/acerto.ts`: centro do tile interpolado mais
      `deslocamentoDaUnidade`) e escolhe o centro mais perto do clique.
    - Shift soma ao grupo; a caixa pega quem tem o centro dentro.
    - O botão direito de mão vazia manda `AttackBuilding` em prédio de outro lado e
      `MoveUnits` no resto.
    - Anel sob cada selecionado; `debug.selecaoMilitar` e `debug.caixaDeSelecao` são lidos
      do desenho.
    - Testes `tests/F26b-selecao.test.ts` e roteiro `tools/shots/F26b.js`. Sonda: o acerto
      pelo centro do tile erra `sold2` no mesmo tile de `sold1`.
- **Nota (herdada da F18f, 2026-09-24)**: o desenho da unidade sai do centro do
  tile por um deslocamento de até ±16 px derivado do id. **O teste de acerto do
  clique tem de usar a MESMA função de deslocamento** — se ele mirar o centro do
  tile, o clique erra a unidade por até 16 px, e erra mais quanto mais cheio o
  tile estiver, que é justamente onde selecionar importa.
### C-COMBATE-01 (antes F27) — Formação, virar e storm attack
- **Nota (correções do operador, 2026-09-28, sobre a VARREDURA-KAM frente 4)**:
  - **A carga acaba por distância, não por tempo:** 12 a 13 tiles, sorteados no RNG da
    sim (`combat.json` `stormAttack.distancia_tiles`; `KM_UnitActionStormAttack.pas:41-49`).
    **Só infantaria corpo a corpo carrega** (`stormAttack.apenas`; `KM_Defaults.pas:685-696`).
  - **Formação:** homens por fileira vão de 1 ao tamanho do grupo
    (`formacao.colunasMax: "tamanhoDoGrupo"`; `KM_UnitGroup.pas:661-666`). Não há tamanho
    recomendado; o "9-15" saiu do GDD e do dado.
- **Quebra (lote do operador, 2026-09-29, item 11).** O item precisa das duas camadas, então
  sai em três. **Nenhum dos três é feature de integração**: a sim e a tela ficam em itens
  separados (§10).
  - **C-COMBATE-01a — formação e virar (sim).** Plano em
    `docs/planos/2026-09-29-C-COMBATE-01a-formacao-e-virar.md`.
    - `MoveUnits` ganha `colunas?` e `direcao?` opcionais. Os homens tomam as fileiras de
      `colunas` de frente para `direcao`, com o centro da primeira fileira no destino, e ao
      chegar viram para `direcao`.
    - Sem os campos, `direcao` é a do primeiro da lista até o destino e `colunas` é
      ⌈√n⌉ (PARA REVISÃO).
    - "Virar sem mover" é o mesmo comando com o destino no tile do primeiro, o líder.
      Não é comando novo.
    - `colunas` fora de `[colunasMin, n]` se prende. `direcao` fora de 0..7 recusa.
    - **ENTREGUE (2026-09-29).** A direção padrão é o octante mais próximo
      (`direcaoAproximada`), não só o sinal de dx e dy. Quem vai para qual vaga é por
      proximidade (`vagasPorProximidade`), com o líder na vaga 0; por índice, virar 180°
      travava dois homens um esperando o outro. O roteiro `C-TELA-03` passou a afirmar
      "marchando + já na vaga = 18" e "18 parados em tiles distintos".
  - **C-COMBATE-01b — storm attack (sim).** Comando `StormAttack { unidades }`. Só a
    `stormAttack.apenas` carrega, em linha reta para a frente, a `multiplicadorVelocidade`,
    por uma distância sorteada no RNG do estado entre `distancia_tiles.min` e `.max`,
    incontrolável até acabar.
    - **ENTREGUE (2026-09-29; `docs/planos/2026-09-29-C-COMBATE-01b-storm-attack.md`).**
      A FSM `em_carga` roda em `systems/carga.ts`. Todos carregam na direção do líder, e o
      passo custa `round(custoDoPasso / multiplicadorVelocidade)`. A carga para no fim da
      distância ou com o tile da frente fechado; a fileira de trás espera o companheiro que
      carrega à frente, em vez de parar. Encostado num inimigo ao chegar num tile, luta.
      `MoveUnits`/`AttackUnit`/`AttackBuilding` pulam quem carrega. A paz recusa com `em-paz`.
  - **C-COMBATE-01c — os controles (tela).** Sobre a seleção da C-TELA-03, no painel do
    grupo:
    - "+/− colunas" manda `MoveUnits` com `colunas` e com o destino no líder;
    - segurar o botão direito e soltar numa direção manda `direcao` (GDD §controles);
    - o botão Storm manda `StormAttack`.
    - A tela guarda as `colunas` da seleção, porque a sim não tem grupo persistente.
    - **Herda da 01a:** os motivos `direcao-invalida` e `colunas-invalidas` ainda não têm
      texto no tema. Hoje a tela nunca manda os campos; quando mandar, a mensagem da
      C-TELA-01 precisa deles.
    - **Herda da 01b:** `StormAttack` entra em `ORDENS_MILITARES` (`ui/aviso-de-ordem.ts`),
      para o aviso da paz; o motivo `sem-infantaria-corpo-a-corpo` precisa de texto no tema.
      Quem está em carga não aceita ordem: a tela não deve fingir que a ordem pegou.
    - **ENTREGUE (2026-09-29; plano em
      `docs/planos/2026-09-29-C-COMBATE-01c-controles-de-formacao.md`).**
      - O painel do grupo ganhou "− N por fileira +" e o botão Investida.
      - O botão direito passou a mandar a ordem ao SOLTAR: o arrasto dá a direção.
      - Quem está em carga sai do grupo da ordem.
      - Os quatro motivos herdados têm texto no tema.
      - O roteiro achou um travamento de marcha, consertado à parte na C-MOVIMENTO-02b (a
        vaga tomada por quem marcha).
      - Aceite: `tests/C-COMBATE-01c-controles.test.ts` e o roteiro
        `tools/shots/C-COMBATE-01c.js`.
### F28 — Combate e IA inimiga simples
- **Quebra (sessão autônoma, 2026-09-28; plano em `docs/planos/2026-09-28-A10-F28-tropa.md`).**
  O pedido era "os tipos de tropa": arco de 90°, alcance de 4 a 11 e escudo contra
  projétil. Só que a sim não tinha combate unidade × unidade.
  - **F28a — o corpo a corpo. ENTREGUE.**
    - `Unidade.direcao?` (0..7; ausente = 4, sul). A regra do golpe fica em
      `sim/combate.ts`: frente se a diferença é de até 45°, flanco a 90°, costas no resto.
      O `attackVsCavalo` soma contra montado, e a chance é a fórmula do dado.
    - `AttackUnit` persegue e luta. O golpe é sorteado no RNG do estado a cada
      `ticksCadenciaDeAtaque` e tira 1 HP; HP 0 dá `unit-killed`.
    - Contato: militar ocioso encostado em militar inimigo luta sem ordem. Contra prédio,
      continua só por ordem.
    - Teste: `tests/F28a-corpo-a-corpo.test.ts`. Taxa sorteada de 0,1753 contra chance de
      0,175 em 3000 golpes.
    - **Achado:** o `pisoAcerto` (0,08) nunca age com o dado de hoje, porque o menor par é
      25/300 = 0,083.
  - **F28d — o arqueiro. ENTREGUE.**
    - Dado:
      - `combat.json: aDistancia.alcanceMinimo_tiles 4` e `alcanceMaximo_tiles 11`, no lugar
        do `alcance_tiles 8`, em distância euclidiana;
      - `escudo` (quem leva `wooden_shield`/`iron_shield` nos requisitos): +1 contra
        flecha e funda, +0,5 contra virote;
      - `units.json`: `projetil` do arqueiro, do besteiro e do bandido;
      - regra nova no `validate:data` (`validarAtiradores`).
    - O atirador ocioso atira no inimigo mais perto que esteja no alcance **e** no arco
      (45° de cada lado, com a borda inclusiva). Ele não se vira sozinho.
    - O projétil cai no tile do alvo e acerta a primeira unidade com HP dali, do próprio
      lado inclusive. Sem voo.
    - `AttackBuilding` aceita o arqueiro: ele para no alcance do prédio e tira 1 HP por
      tiro, sem sorteio.
    - Teste: `tests/F28d-arqueiro.test.ts`.
- **Nota (decisão do operador, 2026-09-28): o alcance mínimo do arqueiro entra no item
  do arqueiro, não sozinho.** Hoje o arqueiro está dentro desta F28.
  - **Divergência registrada:** o KaM atira de 4 a 10,99 tiles ("atira a 4, não a 3";
    `KM_UnitWarrior.pas:837-857`). O nosso `combat.json` `aDistancia.alcance_tiles` diz 8,
    sem mínimo.
  - **A decisão é do operador, quando o arqueiro existir.** O mínimo muda a tática:
    arqueiro encostado não atira, e o KaM faz ele recuar
    (`KM_UnitTaskAttackHouse.pas:98-101`).
  - Herdado da F-CERCO-a: o projétil que cai em prédio inimigo tira **1 de HP, sem
    sorteio** (`KM_Projectiles.pas:325-330`).
- **Nota (correção do operador, 2026-09-28): o arco de tiro é de 90° NO TOTAL**, 45°
  para cada lado de onde o arqueiro está virado (`KM_Terrain.pas:2021-2033`). O campo
  chama `aDistancia.arcoDeTiro_graus_total` porque a ambiguidade entre meio ângulo e
  total era o defeito.
- **Nota (decisão do operador, 2026-09-28): fogo amigo ligado para a flecha.** A flecha
  acerta quem estiver no ponto em que cai, do próprio lado inclusive (`KM_Defaults.pas:397`,
  `KM_Projectiles.pas:320`). O aceite do arqueiro inclui um soldado do próprio lado
  atingido.
- **Nota (decisão do operador, 2026-09-28): escudo defende projétil.** No KaM a tropa
  com escudo ganha defesa extra contra projétil: +1 contra arco e funda, +0,5 contra
  besta (`KM_ResUnits.pas:258-260`). Entra com o arqueiro, e os números vão para o dado
  da tropa, não para o `.ts`.

### F28-IA — IA inimiga mínima (sim)
- **Origem (decisão do operador, 2026-09-28)**: seis pontos, nesta ordem, tirados do laço
  clássico do KaM (`ai/KM_AIGeneral.pas:777-810`; leitura em `docs/varredura-kam.md`,
  frente 4). **Comece pelo ponto 1**, que não depende de nada.
  1. **Posições de defesa** com grupo de 9: ponto, tipo de grupo, raio e linha de frente
     ou de trás (`ai/KM_AITypes.pas:8-11`; 9 homens em 3 por fileira, `KM_AIDefensePos.pas:223-224`).
  2. **Voltar ao ponto** quando o grupo fica ocioso.
  3. **Retaliar** contra quem entra no raio.
  4. **Repor pelo quartel** até 9 por posição (depende da F25).
  5. **Alimentar os famintos** (depende do Feed da F27/F28).
  6. **Um ataque repetido** contra o prédio mais perto quando houver homens suficientes
     (depende da F-CERCO-a).
- **Névoa (decisão conservadora da sessão de 2026-09-28, PARA REVISÃO do operador):
  a IA NÃO respeita a névoa.** É o que o KaM faz: a IA escolhe alvo ignorando a névoa
  (`hands/KM_HandsCollection.pas:523-567`). É **divergência deliberada** da regra do
  GDD §6.5, que esconde o inimigo do jogador: a regra vale para o jogador e não para a
  IA, por escolha e não por descuido. Motivo da escolha conservadora: a névoa ainda
  não existe na sim, e fazê-la valer para a IA pede o modelo de visão por lado antes.
- **Aceite do ponto 1**: um grupo posto numa posição de defesa sai para o inimigo que
  entra no raio e não sai para o que fica fora; a mesma corrida duas vezes dá o mesmo
  estado.
- **Pontos 1, 2 e 3 ENTREGUES juntos (2026-09-28, sessão autônoma; plano em
  `docs/planos/2026-09-28-A12-F28-IA-defesa.md`).** Eles são um sistema só.
  - `GameState.ia?` guarda as posições por lado, criadas pelo cenário.
  - `combat.json: ia` (9 homens, 3 por fileira). O tipo de grupo é derivado da tropa.
  - `systems/ia.ts`:
    - guarnece (frente antes de trás, até 9, do tipo certo);
    - volta ao tile do grupo quando ocioso;
    - sai para o intruso mais perto dentro do raio;
    - retalia contra quem ataca um membro, mesmo de fora do raio;
    - larga o perseguido que sai do raio.
  - **Aceites dos pontos 2 e 3 (escritos na sessão, PARA REVISÃO):** morto o intruso, o
    grupo volta aos seus tiles; o arqueiro que ataca de fora do raio vira alvo.
  - Teste: `tests/F28-IA-defesa.test.ts`.
- **Ponto 4 ENTREGUE (2026-09-28, sessão autônoma).**
  - A posição com menos de 9 pede um soldado por tick ao primeiro quartel completo do
    lado, pelo mesmo `TrainSoldier` da F25a.
  - O tipo é o primeiro de `units.json: militares` do tipo de grupo da posição que o
    quartel consegue formar.
  - Teste: `tests/F28-IA-repor.test.ts`.
- **Ponto 5, agora C-IA-01 (IA alimentar tropas), ENTREGUE em 2026-09-29 como C-COMIDA-01e
  (a IA alimenta a tropa)** — ver o item C-COMIDA-01. O bloqueio abaixo é histórico.
  **Estava BLOQUEADO (sessão autônoma, 2026-09-28):** "alimentar os famintos" não tem
  onde agir. Na sim só o civil sente fome (`sim/condicao.ts: drenaCondicao`, "quando o
  Feed existir, este predicado é o único lugar a mudar"), e o comando `Feed` não existe.
  **Pré-requisito:** fome militar mais o `Feed` (F27/F28), que é item novo, fora da fila
  de hoje.
- **Ponto 6 ENTREGUE (2026-09-28, sessão autônoma).**
  - "Homens suficientes" = um grupo cheio (`tamanhoDoGrupo`, 9) de militares ociosos fora
    das posições (PARA REVISÃO).
  - Todos recebem a ordem de ataque ao prédio de outro lado mais perto do centro deles.
    Caído o prédio, eles ficam ociosos e, se ainda forem 9, atacam o próximo.
  - Teste: `tests/F28-IA-ataque.test.ts`.

### F28b — Torre de Pedra: o recruta atira pedra de cima (sim + render)
- **ENTREGUE (2026-09-28, sessão autônoma; plano em `docs/planos/2026-09-28-A11-F28b-torre.md`).**
  - Alcance **7** (decisão do operador; era 6 em `combat.json`).
  - A pedra chega pelos níveis 4/5 da escada, como a de qualquer consumidor:
    `insumosDoPredio(torre) = stone`, com alvo = `municao_stone_max`.
  - `systems/torre.ts`: a torre ocupada, com pedra e recarga zero, mira o inimigo mais
    perto no alcance (no empate, menor id), gasta 1 pedra e mata a primeira unidade com
    HP do tile, **do próprio lado inclusive**. A pedra não erra, e a recarga é
    `ticksCadenciaDeAtaque`.
  - Tela: o traço da pedra por 0,5 s (evento `stone-thrown`), e o painel com "Pedras n/5"
    e "Sem pedra / Sem recruta: a torre não atira".
  - Teste `tests/F28b-torre.test.ts` e roteiro `tools/shots/F28b.js`.
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
  não atira fora dele. A contagem de pedras gastas é igual à de mortos.
  - **Decisão explícita do operador (2026-09-28): a pedra da torre nunca erra.** No KaM
    ela pode errar se o alvo andou: o sorteio é pela distância entre onde a unidade
    está e onde a pedra cai (`KM_Projectiles.pas:305-306`). Aqui não erra, e é por isso
    que "pedras gastas = mortos" vale. Nas palavras dele: *"erro de pedra é
    aleatoriedade que ninguém vai notar"*. Simplificação escrita, não implícita. Sem pedra, a
  torre não atira, e o painel diz por quê.
  - **Fogo amigo (decisão do operador, 2026-09-28): a pedra mata quem estiver no tile em
    que cai, do próprio lado inclusive**, como no KaM (`KM_Defaults.pas:397`,
    `KM_Projectiles.pas:334`). Aceite: um soldado do lado da torre no tile do alvo
    morre junto. Por isso o aceite é "pedras gastas = inimigos mortos + amigos mortos",
    e a pedra que acerta amigo conta.
- **Fora**: a névoa de guerra que a torre revela (GDD §6.5) fica para depois, com
  registro.

### F28c — Regeneração de HP (sim)
- **ENTREGUE (2026-09-28, sessão autônoma; plano em
  `docs/planos/2026-09-28-A7-F28c-regeneracao.md`).** Decisão do operador: *"1 HP a cada
  10 s; implemente e meça o efeito com o nosso HP dobrado antes de fixar."*
  - **Pré-requisito que o item não dizia:** a unidade não tinha HP na sim.
    - Nasceu `Unidade.hp?`, ausente no civil (o dado não dá HP a civil) e ausente = cheio
      no militar.
    - O teto é `hp × multiplicadorHP` (`sim/vida.ts`).
  - O dado é `combat.json: regeneracao { hp: 1, intervalo_segundos_base: 10 }`, na escala
    `combate`: hoje 67 ticks.
  - O sistema é `systems/regeneracao.ts`. Usa o relógio global, vale inclusive em luta
    e não emite evento.
  - **A medida** (`test-output/F28c.json`): com o HP dobrado, 1 HP a cada 10 s cura
    **metade** da fração de vida por intervalo. De 1 HP ao cheio, o miliciano leva 50 s
    contra 20 s no KaM, e o cavaleiro 70 s contra 30 s. Manter a proporção do KaM seria
    2 HP a cada 10 s. **O número ficou em 1/10 s, o que o operador disse, com a medida à
    vista: PARA REVISÃO.**
- **Origem (decisão do operador, 2026-09-28)**: *"escreva o item, não implemente"*.
- **Regra do KaM**: 1 HP a cada 100 ticks (10 s), inclusive em luta
  (`common/KM_Defaults.pas:360`; `units/KM_Units.pas:2306-2314`).
- **Aberto, a decidir quando o item entrar:** com o nosso `multiplicadorHP` 2, 1 HP a
  cada 10 s regenera na metade da proporção do KaM. A leitura conservadora mantém a
  proporção (2 HP a cada 10 s, ou 1 a cada 5 s); o número vai para `data/combat.json`
  e o operador escolhe.
- **Aceite (rascunho)**: uma unidade ferida e fora de luta volta ao HP cheio no tempo
  que o dado diz, e nunca passa do teto.
---

### B-TERRENO-01 (antes F18c-2) — Recentrar a vila
- **PARADA (decisão do operador, 2026-10-01).** O plano e a medida estão em
  `docs/planos/2026-10-01-B-TERRENO-01-recentrar-a-vila.md`. A medida: folga de pedra −5, pedra
  mínima 35 contra 30 no dado, rua de 35 tiles, e colisão com a defesa da IA da escaramuça.
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

### D-PRODUCAO-01 (antes F29) — Ferro e smithies
- **Nota (regra do operador, 2026-09-29):** estado novo entra na guarda
  `tests/GUARDA-step-preserva-opcionais.test.ts`, que cobra pelo compilador todo opcional
  de `GameState`, `PredioCompleto` e `Producao`. E toda regra de sim nova tem pelo menos um
  teste que passa pelo `step`, não só pelo sistema isolado.
- **Plano:** `docs/planos/2026-09-29-D-PRODUCAO-01-ferro-e-ferrarias.md`. O item não
  tinha aceite; o de baixo vem do GDD §4.2 e §4.5 e da sonda. **Quebrado em dois**
  (CLAUDE.md §6): a sonda mostrou que a cadeia fecha até a arma sem código, e que a
  ferraria de armaduras nunca recebe carvão.
- **D-PRODUCAO-01a — a cadeia do ferro no mapa emitido (guarda). ENTREGUE (2026-09-29).**
  Fixture `cenarioDaCadeiaDoFerro` na encosta norte da serra, posição por `canPlace` e rua
  por `canPlaceRoad`, minas no veio do mapa (a posição de mais veio da caixa).
  - **Aceite:** (1) as duas minas colhem do veio do mapa, e o veio ao alcance cai;
    (2) o ferro nasce na fundição, depois de minério e carvão chegarem a ela; (3) o ferro
    chega às duas ferrarias; (4) a ferraria de armas faz arma com ele, no rodízio de
    peso 1 da F24a; (5) sem a mina de carvão ou sem a de ferro, nenhum ferro; (6) tudo pelo
    `step`, sem violar invariante. `tests/D-PRODUCAO-01a-cadeia-do-ferro.test.ts`.
  - **Não cobre:** a ferraria de armaduras produzir. É a 01b.
- **D-PRODUCAO-01b — insumo escasso dividido entre fundição e ferrarias (sim). ENTREGUE
  (2026-09-29; plano em `docs/planos/2026-09-29-D-PRODUCAO-01b-insumo-escasso.md`).**
  `delivery.divisaoDoEscasso` (tipos, `ofertaMaxima` 2, `gavetaMaxima` 1),
  `PredioCompleto.ultimaEntrega` e a vez em `ordenarTarefasDoSerf`. Carvão em 12 000
  ticks, fundição / armas / armaduras: 39 / 7 / 0 → 23 / 12 / 11.
  - **Aceite:** `tests/D-PRODUCAO-01b-insumo-escasso.test.ts` (a de armaduras faz peça em
    ≤ 5 000; razão menor/maior ≥ 0,22 em 6 000; a ordem direta nos três casos).
  - **PARA REVISÃO:** o `KaMRandom` virou a vez (quem recebeu há mais tempo); a
    distribuição fica fora do lance; os +20 por unidade na gaveta, que valem para toda
    casa, ficam para o lote de balanceamento.
  - **O defeito (medido, sonda da 01a):** uma mina de carvão, três consumidores; em
    12 000 ticks a fundição recebeu 39 carvões, a ferraria de armas 7 e a de armaduras 0.
    Com as gavetas vazias as três tarefas empatam no nível `parada`, e
    `ordenarTarefasDoSerf` (`sim/jobs.ts`) desempata pelo custo A*: vence sempre quem
    está mais perto. É espera indefinida, não balanceamento.
  - **O KaM (`KM_HandLogistics.pas`, 731a8a4):** `TryCalculateBidBasic` :1512-1530 — para
    a fundição e as casas com encomenda, com oferta ≤ 2 e destino com ≤ 1 na gaveta, o
    lance ignora a distância e usa a distribuição mais um aleatório ("weapon and armour
    smiths should get same amount of iron, even if one is closer"); `TryCalculateBid`
    :1613-1618 soma 20 por unidade já na gaveta do destino.
  - **Aceite proposto:** no `cenarioDaCadeiaDoFerro`, a ferraria de armaduras recebe
    carvão e faz peça de armadura dentro do teto, pelo `step`; e nenhum dos três
    consumidores fica sem o insumo escasso enquanto outro recebe.
### D-PRODUCAO-03 — Encomendas das oficinas (o `WareOrder` do KaM)
- **Registrado em 2026-09-29, a pedido do operador. Decisão do operador (2026-09-29): entra
  na fila logo DEPOIS da D-PRODUCAO-01, não junto; a troca do aceite da F24a está
  aprovada e entra na 03a** — encomenda nasce em zero, só inicia ciclo com encomenda > 0,
  desconta 1 por ciclo e avisa quando todas zeram, como no KaM. Até a 03a, o rodízio de
  peso 1 da F24a continua valendo, e as ferrarias da D-PRODUCAO-01 nascem com ele.
- **O que diverge hoje (verificado no código):** a F24a (`sim/cota.ts`, `EscolhaDeSaida`)
  fez a cota como PESO que não se esgota. A oficina nasce com peso 1 em cada saída e produz
  uma de cada em rodízio, sem o jogador pedir nada. O painel da cota (F24a-ui) ficou de
  fora e nunca entrou na fila: hoje a cota só se fixa pelo comando `SetProductionQuota`.
  A VARREDURA-KAM já tinha apontado a divergência (`docs/varredura-kam.md`, "divergências
  que precisam ser declaradas"). A sessão da F24a chamou o rodízio de "conservador", e ele
  é o inverso do KaM.
- **O KaM (conferido no fonte, `KM_Houses.pas` em 731a8a4):** `fWareOrder[I] := 0` no
  `Create`; `SetWareOrder` faz `EnsureRange(aValue, 0, MAX_WARES_ORDER)`; `PickOrder` só
  escolhe saída com `WareOrder > 0`, com saída não cheia e insumo presente, alterna entre
  elas ("6 e 2 saem 12121111") e faz `Dec(fWareOrder[Result])` ao escolher. Quando todas
  zeram, a mensagem `TX_MSG_ORDER_COMPLETED`. O valor de `MAX_WARES_ORDER` está em
  `KM_Defaults` e não foi conferido.
- **Escopo proposto:**
  - **03a — a regra (sim).** `EscolhaDeSaida` passa de peso a encomenda: nasce em zero, e
    oficina sem encomenda não começa ciclo. O desconto é no começo do ciclo, como o
    `PickOrder`, com o rodízio entre as saídas com encomenda > 0. O comando
    `SetProductionQuota` vira encomenda (faixa 0..máximo, com o máximo em dado), e a cota
    vazia deixa de ser recusa. Evento de encomenda cumprida.
    - Muda o aceite escrito da F24a ("com o rodízio default, cada saída chega ao
      armazém"): decisão do operador.
    - A IA não tem oficina na escaramuça hoje (`data/escaramuca.json`), então nada muda
      para ela. Quando tiver, ela emite a encomenda.
    - **ENTREGUE (2026-09-29).** Plano `docs/planos/2026-09-29-D-PRODUCAO-03a-encomendas.md`.
      `EscolhaDeSaida` é encomenda (com `emCurso?`), `production.json: encomenda.maxima`
      (999, o do KaM), evento `production-order-completed`, `cota-vazia` saiu da união.
      **Aceite:** `tests/D-PRODUCAO-03a-encomendas.test.ts`; o da F24a trocado.
      **PARA REVISÃO:** rótulo `trabalhando` sem encomenda (o da pausa); acima do máximo é
      recusa, e não o `EnsureRange` do KaM; o aviso sai no depósito do último ciclo.
      **Até a 03b, a oficina nova fica parada na partida:** só o comando encomenda.
  - **03b — o painel (ui).** No painel da oficina, uma linha por saída com `−`/`+` e a
    encomenda restante, no molde da aba Distribuição, e o alerta de encomenda cumprida.
    - **ENTREGUE (2026-09-29).** Plano `docs/planos/2026-09-29-D-PRODUCAO-03b-painel-encomenda.md`.
      `painelDoPredio.encomenda` (seletor), `ui/encomenda.ts` (o comando do −/+ e o texto
      do aviso), seção "Encomenda" no painel e o aviso "Encomenda cumprida: <prédio>" no
      `#aviso-de-ordem`. **Aceite:** `tests/D-PRODUCAO-03b-painel-encomenda.test.ts` e o
      roteiro `tools/shots/D-PRODUCAO-03.js` (clica com o jogo andando, §8).
      **PARA REVISÃO:** o aviso vai no texto passageiro sobre o mapa, e não como causa nova
      na aba Alertas; um clique é ±1 (o KaM tem ±10 no botão direito); a oficina sem
      encomenda ganha a linha "Sem encomenda", mas o ocupante continua `trabalhando`.
- **Onde encaixar (aprovado):** logo depois da D-PRODUCAO-01. Ela faz a Ferraria de armas
  e a de armaduras, que já têm `escolheSaida`: se a 03a vier antes, as duas nascem
  paradas e o aceite da D-PRODUCAO-01 precisa emitir encomenda. Juntar as duas numa
  sessão só seria feature dupla.
### D-TRANSPORTE-01 (antes F30) — Armazém com toggles por mercadoria
- **Quebrada em dois (2026-09-29, lote do operador, item 5; plano em
  `docs/planos/2026-09-29-D-TRANSPORTE-01-armazem-liga-desliga.md`).** O item não tinha
  aceite escrito. O aceite é o do plano, e sai da linha do GDD §7.2 ("28 mercadorias,
  quantidade e toggle aceitar/bloquear") e do `KM_HouseStore.pas`.
  - **D-TRANSPORTE-01a — a regra (sim). ENTREGUE (2026-09-29).** O campo `naoAceita?` no
    armazém e o comando `SetStorehouseAccept`. A sobra dos níveis 6 e 7 vai ao armazém mais
    perto que aceita a mercadoria. A tarefa aberta ou reclamada para um armazém que passou
    a bloquear cai no saneamento, e a que está `carregando` entrega assim mesmo. O armazém
    novo herda o bloqueio do primeiro do lado.
    - **Aceite:** `tests/D-TRANSPORTE-01a-armazem-aceita.test.ts`.
    - **PARA REVISÃO:** a carga que já está na mão entrega; o KaM abandona. A devolução, o
      reembolso da demolição e a carga de quem morre de fome ignoram o bloqueio.
  - **D-TRANSPORTE-01b — o painel (ui). ENTREGUE (2026-09-29).** O painel do armazém lista as 28 mercadorias, com
    a quantidade e um botão aceitar/bloquear (`SetStorehouseAccept`).
    - **Aceite:** o roteiro `tools/shots/D-TRANSPORTE-01.js` do plano: despausado, com o
      botão seguro 150 ms, o estado ganha e perde o bloqueio, e a linha mostra. Mais
      `tests/D-TRANSPORTE-01b-painel-armazem.test.ts` (o seletor).
    - **PARA REVISÃO:** a lista "Recebe" fica abaixo das gavetas, que continuam (o roteiro
      F16b lê a gaveta do armazém); o nome longo é cortado na grade de 3 colunas e aparece
      inteiro no `title`.
### D-TRANSPORTE-02 (antes F31) — Menu de distribuição
- **Quebrada em dois (2026-09-29, lote do operador, item 6; plano em
  `docs/planos/2026-09-29-D-TRANSPORTE-02-menu-de-distribuicao.md`).** O item não tinha
  aceite escrito. O aceite é o do plano, e sai do GDD §4 e §7.2 e do
  `KM_WareDistribution.pas` / `KM_Houses.pas: UpdateDemands`.
  - **D-TRANSPORTE-02a — a regra (sim). ENTREGUE (2026-09-29).** `delivery.json:
    distribuicao` (o máximo e o padrão por par mercadoria/tipo, só nos insumos
    disputados), `GameState.distribuicao?` (só a diferença do padrão) e o comando
    `SetWareDistribution`. `demandaDeInsumo` pede até `min(alvo, limite)`; o excedente
    continua contra o alvo inteiro, e o que já está dentro fica.
    - **Aceite:** `tests/D-TRANSPORTE-02a-distribuicao.test.ts`.
    - **PARA REVISÃO:** o padrão é 5 em todos os pares, e não o do KaM (anotado no `_doc`
      do dado), para a partida não mudar de balanceamento até o jogador mexer.
    - **Correção na 02b (2026-09-29):** o `step` monta o estado de saída campo a campo e
      descartava `distribuicao` — o limite não sobrevivia a um tick. Agora atravessa, e
      o teste da 02a ganhou o caso "atravessa o step" (reprova sem a correção).
  - **D-TRANSPORTE-02b — a aba (ui). ENTREGUE (2026-09-29).** A aba Distribuição
    destrancada, com uma seção por mercadoria disputada e os botões `−`/`+` por
    consumidor. Seletor puro `distribuicaoDaVila` e tela em `ui/distribuicao.ts`.
    - **Aceite:** `tests/D-TRANSPORTE-02b-aba-distribuicao.test.ts` e o roteiro
      `tools/shots/D-TRANSPORTE-02.js`.
    - **PARA REVISÃO:** botões `−`/`+` de passo 1 no lugar do controle deslizante do KaM.
    - **Nota para a D-PRODUCAO-01 e a F24:** `validarDistribuicao` reprova insumo novo com
      dois ou mais consumidores que não esteja em `distribuicao.padrao`, com todos eles.
### D-TRANSPORTE-03 — Logística do KaM (BUG-U causa B + BUG-V)
- **Autorizada em dois passos, com medida entre eles (operador, 2026-09-30).** Proposta e
  aceite em `docs/planos/2026-09-30-D-TRANSPORTE-03-logistica-kam.md`. Decisões D1 (Bodega
  acima da tropa, divergência no `_doc`), D2 (escola primeiro), D3 (pedra do canteiro na 4,
  com a obra); excedente como oferta comum é decisão do operador e divergência do KaM.
  - **D-TRANSPORTE-03 T1 — classes de importância no lugar da escada + a arma prefere o
    quartel. ESTADO INTERMEDIÁRIO, não entregável (decisão do operador, 2026-09-30); sem
    `passes`** (a chave é da feature inteira, e fecha no T2). Plano: `docs/planos/2026-09-30-D-TRANSPORTE-03-T1-importancia-e-arma.md`.
    - **Aceite:** `tests/D-TRANSPORTE-03-logistica-kam.test.ts` (aceites 1, 2, 7, 8, 10).
    - **Desvio no aceite 1 (PARA REVISÃO):** o 15/15 no quartel está afirmado na corrida
      SEM a carga de pedra. Com a carga (corrida B do BUG-U), 12 das 15 chegam: a pedra da
      escola e a arma estão na mesma classe (5), a pedra fica mais perto e ganha toda vez, e
      as últimas armas esperam como tarefa aberta. Na corrida B o T1 afirma só "nenhuma arma
      ao armazém" e as invariantes.
    - **Aceites BLOQUEANTES do T2 (operador, 2026-09-30; se algum reprovar, parar e trazer):**
      1. corrida B do BUG-U, com a carga de pedra: 15/15 armas no quartel;
      2. na vila da F-CAL (20 000 ticks), ticks de produtor parado por falta de insumo
         ≤ 13 184 e padaria ≤ 696, os números da base antes do T1. Acima disso, trazer a
         causa isolada, não hipótese.
    - **Nota para o T2 e o lote do BALANCE_LOG:** com parada e baixa na mesma classe, o
      tempo de produtor parado por falta de insumo subiu 28 % no cenário da F-CAL (medida
      no PROGRESS, 2026-09-30). A produção não caiu (311 → 312).
  - **D-TRANSPORTE-03 T2 — casamento oferta × demanda + multa do armazém + 20/unidade.**
    Aceites 3, 4, 5, 6, 9, 10 do plano. **ENTREGUE (2026-09-30, mergeado depois do BUG-Y,
    viagem inútil para comer).** Plano: `docs/planos/2026-09-30-D-TRANSPORTE-03-T2-oferta-demanda.md`.
    - **Aceite 2, a métrica (D1 e D2 do operador, 2026-10-01; substitui o bloqueante 2 do
      T1 acima):** na vila da F-CAL (calibração), em 16 000, 20 000 e 30 000 ticks, contra a
      linha de base sem o T2 medida na árvore `8929ba3`:
      - D2: produção por cadeia (soma de `goods-produced`) ≥ floor(base × 0,98), e o déficit
        (base − T2) de cada cadeia em 30 000 ≤ o déficit em 16 000;
      - D1: parada (ticks com o ocupante em `esperando_insumo` ou `saida_cheia`) de serraria,
        moinho e padaria ≤ base × 1,05.
    - **Aceite:** `tests/D-TRANSPORTE-03-T2-oferta-demanda.test.ts` (2, 3, 4, 5, 6, 8, 10) e
      `tests/D-TRANSPORTE-03-logistica-kam.test.ts` (o bloqueante 1, corrida B 15/15).
      `TETO_DE_NOS` 24 700 (medido 22 470, ~10 % de folga).
    - **Nota para quem remedir:** a linha de base é número da corrida, escrita no teste. Se
      o cenário da F-CAL mudar, o aceite 2 remede a base numa árvore sem o T2, e não afrouxa
      os fatores.
### D-TELA-01 (antes F32) — Aba de estatísticas
- **ENTREGUE (2026-09-29, lote do operador, item 4; plano em
  `docs/planos/2026-09-29-D-TELA-01-aba-de-estatisticas.md`).** A aba Estatísticas ganha,
  abaixo dos recursos, duas listas: prédios do jogador por tipo (completos, e as obras à
  parte) e gente por tipo, com os parados em destaque.
  - Seletor puro `estatisticasDaVila` (`sim/selectors.ts`) e tela em `ui/estatisticas.ts`.
  - **Aceite:** `tests/D-TELA-01-estatisticas.test.ts` e o roteiro `tools/shots/D-TELA-01.js`.
  - **PARA REVISÃO:** parado é o especialista sem posto e o carregador ou obreiro sem
    tarefa. O recruta não conta como parado, e o militar fica fora das listas.
### D-TELA-02 (antes F33) — Minimapa
- **ENTREGUE (2026-09-29, lote do operador, item 9; plano em
  `docs/planos/2026-09-29-D-TELA-02-minimapa.md`).** O escopo é o do operador:
  - terreno pintado;
  - prédios por lado, na cor do bando;
  - a vista atual marcada;
  - clique ou arrasto movendo a câmera.
  - A aritmética está em `render/minimapa.ts`, e o canvas em `ui/minimapa.ts`, no lugar do
    placeholder da moldura. **Aceite:** roteiro `tools/shots/D-TELA-02.js`.
  - **PARA REVISÃO:** a moldura da UI-barra-a tem 196×65 px, e o mapa de 128 tiles cabe em
    65×65 (0,51 px por tile). Pausado, o carimbo cobre o meio.
### D-TELA-06 — O jogo exige WebGL
- **ENTREGUE (2026-10-01, decisão do operador).** `Phaser.AUTO` vira `Phaser.WEBGL`: a arte
  nova depende de `setTint`, mipmaps e batching. O portão `render/webgl.ts` pergunta por um
  contexto `webgl` num canvas temporário antes de o jogo carregar (`src/inicio.ts`); sem ele,
  o jogo não inicia e a página diz "Este jogo precisa de WebGL; ative a aceleração de
  hardware do navegador".
  - **Aceite:** o roteiro `tools/shots/D-TELA-06.js` confirma `game.renderer.type ===
    Phaser.WEBGL` e, com o WebGL simulado ausente, que o jogo não inicia e a mensagem
    aparece; `tests/D-TELA-06-webgl.test.ts` prova o portão com documento falso.
### D-TELA-07 — Sinal de pausado no mapa
- **ENTREGUE (2026-09-30).** Pedido do operador: hoje a casa pausada e a casa sem insumo mostram o mesmo
  ocioso (F-VIVO-e, o ocioso genérico; D3). Um ícone pequeno sobre o prédio pausado, com o
  texto do `theme-sertao.json`. Só `src/render/`; a sim já tem `predio.pausado` (F16c).
- ~~Interpretação: o texto é `painelPredio.pausado` ("Parado")~~. **Decisão do operador
  (2026-09-30):** a placa usa a mesma palavra do botão de pausar do painel,
  `painelPredio.pausar` ("Parar", o rótulo que `src/ui/painel-predio.ts` mostra no botão de prédio
  não pausado). Nenhuma chave nova no tema. O ícone é geométrico (placa com duas barras de
  pausa), placeholder do §9 até haver arte.
- **Aceite emendado (2026-09-30, antes do código):** nos aceites 1 e 3, "o texto do tema" é
  `painelPredio.pausar`. O teste compara com o JSON lido do disco e com a mesma chave que o
  painel usa no botão. O roteiro afirma que o texto da placa é igual ao texto do botão de pausar
  do painel de uma serraria NÃO pausada (a `s2`), lido da página.
- **Aceite (escrito antes do código, 2026-09-30):**
  1. Função pura `temSinalDePausado(predio)`: verdadeira só para prédio completo com
     `pausado`; falsa para completo não pausado e para obra. Teste por tabela.
  2. Pelo `step`: duas serrarias ocupadas, `s1` pausada pelo `SetBuildingPaused` e `s2` sem
     insumo (`esperando_insumo`). Guarda do cenário: as duas com o ocioso aceso (a ambiguidade
     de hoje existe). Só a `s1` tem sinal. O teste grava a partida do roteiro.
  3. Roteiro `tools/shots/D-TELA-07.js`, pela ponte (`debug.sinaisDePausado`):
     - passo 0, pausado: só a `s1` tem sinal, o texto é o do tema (lido do JSON, não digitado),
       e a caixa do sinal fica dentro da largura do prédio e acima do meio do corpo;
     - despausa o relógio (§8), 6 leituras a 150 ms: o sinal continua só na `s1`;
     - captura aberta com as duas serrarias lado a lado;
     - retomar a `s1` pelo painel (`[data-pausar]`, `mouse.down` / 150 ms / `mouse.up`, relógio
       correndo): o sinal some.
### D-TELA-LUZ-RELEVO — Luz de relevo (id de 2026-09-30; antes D-TELA-08)
- **ENTREGUE (2026-09-30), desligado por padrão.** Opção A do `docs/planos/estudo-relevo.md`,
  com plano, decisões e notas em `docs/planos/relevo-a.md`. O relevo é só de render: duas camadas
  sobre o chão (sombra em `MULTIPLY`, luz no modo próprio `[DST_COLOR, ONE]`), neutras exatas no
  plano, e o `setTint` dos sprites pela luz sob o pé, preso em 1,0 (o sprite escurece na sombra e
  não recebe o realce). A flag é `data/relevo.json` `ligado: false`; `?relevo` liga para o
  roteiro. Código em `src/render/relevo.ts` (a conta, pura) e `src/render/camada-de-relevo.ts`
  (o Phaser), com 10 linhas de gancho no `WorldScene.ts` e um parâmetro no `unidades.ts`.
- **Aceite (do plano, escrito antes do código):**
  1. com a flag desligada, nenhum teste, roteiro ou captura muda em relação à `main` (linha de
     base dos roteiros contra a branch, código de saída e sha256);
  2. `tests/D-TELA-LUZ-RELEVO.test.ts`: o plano dá 1 exato e texturas neutras (255 e 0); a
     encosta sul clareia e a norte escurece; leste = oeste (sem componente leste–oeste); o tint
     do sprite nunca passa de 1; `src/sim/` não importa o relevo e só `relevo.ts` lê a altura
     (import resolvido);
  3. roteiro `tools/shots/D-TELA-LUZ-RELEVO.js` com `?relevo`: o chão plano é igual pixel a pixel
     com a flag ligada e desligada (e uma encosta difere); árvore, rocha, prédio numa encosta e
     serf tingidos; a obra é retingida quando o container é recriado, já com sprite.
- **CHAVE EM FALSE (decisão do operador, 2026-10-01):** o aceite 1 está sem prova do sha256 (avaliador,
  NEEDS_WORK). Na entrega só 110 de 219 PNG bateram, e a causa atribuída, "chão não determinístico",
  caiu com a D-TELA-CAPTURA-DETERMINISTICA. A refação compara as capturas da `main` (flag desligada)
  com a `main` sem o relevo, com a câmera fixada pela ponte. Se as capturas estáveis baterem, a chave
  volta a true, com a evidência citada aqui.
  - **Método (escrito antes da corrida).** Lado A: as capturas da `main` com a flag desligada. Lado
    B: a mesma `main` com o relevo tirado (o diff de `7a9e038..95b9e74` em `src/` revertido, num
    worktree descartável), rodada pelo `shot:todos`. Uma captura é **estável** quando o tick e a
    câmera são os mesmos nos dois lados (o `<roteiro>-shot.json`). **Critério:** os dois lados
    têm os mesmos códigos de saída, e toda captura estável tem o sha256 igual. A captura instável
    é listada, com o motivo, e não conta. Os 6 pares instáveis já conhecidos ficam registrados como
    tais.
  - **MEDIDO (2026-10-01): a chave NÃO volta.** Lado A: as capturas do `shot:todos` sobre `e2d6aed`,
    89/89 com saída 0. Lado B: o worktree `../cangaco-game-relevo-base` (o relevo tirado de `src/`),
    89 roteiros rodados. O sistema encerrou o comando por falta de memória depois do resumo, e ele
    não foi religado.
    - **Os códigos de saída não batem em 12.** Dois são esperados: os roteiros do próprio relevo, que
      no lado B não têm o que ligar. **Os outros 10 são erro de montagem do lado B, e não do jogo:**
      o worktree novo não tinha os `*.save.txt` da suíte, e copiei-os tarde. São BUG-U, BUG-W,
      BUG-X, BUG-Z, C-COMIDA-01d, C-TELA-05, C2, C4, D-PRODUCAO-03 e D-TELA-07, todos com "save.txt
      nao existe". **Esses 10 roteiros ficaram sem comparação.**
    - Das 205 capturas com par: **176 com o sha256 igual**; 20 noutro tick; 2 com outra câmera
      (C-IA-02a-1 e MATERIAIS-1); 7 diferentes com a mesma câmera e o mesmo tick:
      - 5 dos 6 instáveis conhecidos: C-TELA-01-1, C-TELA-02-1, F-T3-1, F-TR-1 e F28b-1;
      - **F11a-2 (rodando 1x):** o relógio andando, com o alfa 0,5 contra 0,667. É a mesma classe dos
        instáveis (17 208 px, caixa x 558–978, y 424–581);
      - **F24c-1 (a ajuda):** pausado, alfa 1, tick 0 e a mesma câmera, e **difere em 88 136 px**.
        Todos caem na caixa x 562–974, y 27–692, que é a região do painel de ajuda; o mapa em volta
        é idêntico. **Hipótese, não medida:** a rolagem do painel (o `scrollIntoView` do roteiro), e
        não o relevo. A imagem não foi aberta.
    - **Pelo critério escrito, reprova.** Há duas capturas estáveis diferentes fora dos 6 instáveis
      conhecidos (F11a-2 e F24c-1), e 10 roteiros sem par. Para a chave voltar falta: rodar os 10
      roteiros no lado B, com os saves, e explicar a F24c-1. Os dois esperam o operador, porque a
      investigação da captura foi encerrada por decisão dele. Dados da corrida:
      `test-output/shot-todos.json` do worktree e a sonda `comparar-relevo.js` do scratchpad.
- **Decisões do operador incorporadas:** chão plano = 1,0 (sem `k`); tint S1; geometria 12,8 px
  por degrau, **provisória**; o tint da unidade segue a posição do pé (por tile, saltava até 61
  níveis de cinza no pé da serra).
- **Nota (o que fica para depois):**
  - **ligar a flag por padrão** espera a arte de terreno da F-TR (tile sem luz pintada), e com
    ela a recalibração do `pxDeMundoPorDegrau`;
  - **recorte do sprite na encosta de luz:** medido em ~11% (chão contra sprite) na vila e ~10%
    no pé da serra (`tools/shots/D-TELA-LUZ-RELEVO-recorte.js`); hoje não lê como recortado. Se a
    arte nova mostrar recorte, a correção pronta é `tetoDaLuzDoChao` no dado;
  - o `renderer.addBlendMode` é **risco no Phaser 4** (registrado no estudo do relevo);
  - o `tools/transladar-mundo.js` não translada a altura: com a flag desligada é irrelevante, e
    o contrato do arquivo publicado está no `FORA_DO_MUNDO_TRANSLADADO`.

- **Fechamento da comparação (pedido do operador, 2026-10-02: "providenciar"; aceite antes da
  corrida).** As duas pendências que seguravam a chave:
  1. **Os 10 roteiros sem par** (BUG-U, BUG-W, BUG-X, BUG-Z, C-COMIDA-01d, C-TELA-05, C2, C4,
     D-PRODUCAO-03 e D-TELA-07) rodam nos dois lados, com os `*.save.txt` no lugar antes de começar.
     - **Lado A:** a `main` atual, com o relevo desligado, como está.
     - **Lado B:** uma worktree descartável da mesma `main`, com o relevo tirado de `src/`, como na
       corrida de 2026-10-01.

     Os códigos de saída batem, e toda captura estável tem o sha256 igual entre os lados. Os
     instáveis conhecidos (os 6, mais o F11a-2) são listados e não contam.
  2. **A F24c-1 (a ajuda):** a diferença de 88 136 px é explicada por medida. As duas capturas
     são comparadas recortando a caixa do painel de ajuda. Se a diferença some fora da caixa e
     dentro dela é a rolagem (o mesmo conteúdo deslocado), a hipótese se confirma. Senão, a causa
     fica registrada como aberta, e a chave continua false.
  3. **Por medida, e não por julgamento:** a chave volta a `true` só se os dois itens acima
     fecharem. Quem marca o `test-results.json` é o fechamento da fase, com o `verify` completo,
     e não este item.
  4. **Sem mudança de código do jogo** neste item. A worktree do lado B é apagada no fim, e o vite
     órfão é encerrado pela liberação do `shot.js`.
  5. **No PROGRESS:** a tabela dos 10 roteiros (saída A, saída B, capturas iguais e diferentes),
     a medida da F24c-1 e o veredito.

### D-TERRENO-ALTURA — Altura só de render no gerador de mapa (id de 2026-09-30; antes D-TERRENO-01)
- **ENTREGUE (2026-09-30).** `tools/gerar-mapa.js` emite `data/maps/sertao-128.relevo.json`: um
  degrau inteiro (0–35, um char base-36) por vértice, 129 × 129, a partir dos tipos de terreno e
  de um ruído semeado com semente própria (`data/relevo.json`, `geracao`). O `sertao-128.json`
  sai com o mesmo blob. A sim não lê a altura.
- **Aceite (do plano, escrito antes do código):** `tests/D-TERRENO-ALTURA.test.ts`:
  1. a mesma semente emite o mesmo relevo, outra semente outro; o arquivo versionado é byte a
     byte o que a semente emite (contrato do arquivo publicado, fora do mundo transladado como o
     do F-D3);
  2. só relevo suave: fora de `montanha` e `rocha`, os 4 cantos de um tile diferem no máximo
     `decliveMaximoEmDegraus` (2), com a guarda provada nos dois sentidos;
  3. o relevo existe (encostas no teto, montanha mais alta que grama, grama mais alta que água);
  4. `data/relevo.json` validado pelo `validate:data` (regra `interface/relevo`).
- **Nota:** amplitude 12 e célula de ruído 10 são **ponto de partida**, ajustados na captura
  (67,5% do chão com inclinação, 8,2% no teto); a encosta mais forte não lê como parede.
### D-TELA-CAPTURA-DETERMINISTICA — A captura do roteiro não depende do relógio de parede
- **Pedido do operador (2026-10-01). Substitui a D-TELA-CHAO-DETERMINISTICO (abaixo):** a medida
  mostrou o chão já determinístico. Em 21 pares de capturas de 6 roteiros, nenhum diferia com a
  mesma câmera e o mesmo tick (`387d65a`). O que varia entre corridas é **onde está a câmera** e **em
  que tick** a captura é tirada. Os dois saem do tempo de parede dos roteiros: setas seguradas por
  `waitForTimeout`, e passos despausados por tempo.
- **Escopo:**
  - a ponte de debug ganha `fixarCamera({ scrollX?, scrollY? })`. É harness, como `pausar` e
    `avancar`, e não é usada por código de jogo, `ui/` nem `input/`;
  - os helpers de câmera copiados nos roteiros (`centrarNoEixo`, `centrarEm`) passam a pôr a câmera
    no scroll exato pela ponte, e não por setas seguradas por tempo. O roteiro que **testa** a
    navegação por teclado (F-D2) continua com as setas;
  - a captura (`tools/shot.js`) espera o quadro desenhado do mesmo estado antes do screenshot.
- **Fora do escopo:** o tick de quem captura depois de um passo despausado por tempo. A captura
  segue num tick que varia, e a medida diz quantos são.
- **Aceite:**
  1. a `fixarCamera` põe o scroll pedido, e a câmera lida pela ponte devolve o mesmo valor; **coberto (2026-10-01):** `tools/shots/D-TELA-CAPTURA-DETERMINISTICA.js`;
  2. todos os roteiros rodam duas vezes com saída 0. Em cada captura, câmera e tick vêm em
     `quadros`, no `<roteiro>-shot.json`;
  3. **duas corridas do mesmo roteiro dão o mesmo hash** em toda captura com a mesma câmera e o
     mesmo tick. Diferente com câmera e tick iguais reprova (seria o chão, ou outra fonte no desenho);
  4. no PROGRESS, quantas das capturas ficam com hash igual entre as duas corridas, contra as
     110/219 do relevo, e as que mudam por tick, com o roteiro.
- **MEDIDO (2026-10-01), o aceite 3 REPROVA; espera o operador.** Duas corridas de todos os
  roteiros, com a câmera pela ponte (43 roteiros mudaram). Houve 214 pares, e 17 capturas ficaram sem
  par: a 2ª corrida parou no F-VIVO-d, porque a porta 5178 estava presa por um `vite` órfão de uma
  corrida encerrada.
  - **183 iguais** (antes, 110 de 219);
  - 23 diferem porque a captura caiu noutro tick;
  - 2 diferem porque a câmera estava noutro lugar (o F-D2, de propósito, e o C-IA-02a);
  - **6 diferem com a mesma câmera e o mesmo tick**: C-TELA-01, C-TELA-02, F-T3, F-TR, F24c e F28b.
    Diferença pequena e localizada (de 53 a 36 661 pixels), numa caixa em volta do que se move (a
    tropa marchando, o pedreiro no campo, a pedra no ar). **Hipótese, não medida:** a interpolação
    entre ticks (`alfaDeInterpolacao`) segue o relógio de parede quando o roteiro captura com o
    relógio andando. O chão não aparece em nenhuma das 6.
  - ~~Pergunta ao operador~~ **DECIDIDO (operador, 2026-10-01): a captura NÃO passa a pausar o
    relógio. A investigação da captura está ENCERRADA, e a caixa 8×8 da F24c-2 não entra.** O item
    fica sem chave, com os aceites 1 e 2 cumpridos e o 3 reprovado pelos **6 pares instáveis
    registrados**: C-TELA-01-1 (marcha em paz), C-TELA-02-1 (marca no destino), F-T3-1 e F-TR-1
    (pedreiro no campo), F24c-2 (escudo dez) e F28b-1 (pedra no ar). Quem comparar capturas por
    sha256 trata esses 6 como instáveis conhecidos, e não como regressão.
- **Medida da hipótese (aceite de 2026-10-01, antes do código; só medida, para a decisão acima):**
  1. o `tools/shot.js` passa a gravar, em cada captura de `quadros`, se o relógio estava pausado e o
     `alfaDeInterpolacao` que a ponte publicava;
  2. os 6 roteiros (C-TELA-01, C-TELA-02, F-T3, F-TR, F24c e F28b) rodam duas vezes, na mesma árvore;
  3. no PROGRESS, por par com a mesma câmera e o mesmo tick: hash igual ou não, relógio pausado ou
     não, e o alfa nas duas corridas. **A hipótese se confirma** se todo par que difere tiver o
     relógio andando e o alfa diferente entre as corridas, e todo par igual tiver o alfa igual (ou o
     relógio pausado). Caso contrário, ela cai, e a causa fica em aberto.
  Nenhum roteiro muda nesta medida.

### D-TELA-CHAO-DETERMINISTICO — O grão da textura do chão vem da semente do mapa
- **Registrado (2026-10-01, pedido do operador). Não implementado.**
- **Problema (medido pelo operador):** o grão da textura do chão muda a cada execução. Em duas
  corridas dos roteiros na própria `main`, **105 de 219 capturas** saíram diferentes. Com isso,
  comparar captura por sha256 entre corridas não serve para nada: a diferença do chão encobre a
  diferença que interessa.
- **Objetivo:** o chão determinístico pela semente do mapa. A mesma semente e a mesma câmera dão o
  mesmo pixel em toda execução.
- **Fronteira:** é tela (`src/render/`). A semente vem do mapa já carregado, e `sim/` não muda nem
  ganha consumo de RNG.
- **Aceite:** a escrever no plano, num commit próprio antes do código (CLAUDE.md §6, item 10).
- **SUBSTITUÍDO pela D-TELA-CAPTURA-DETERMINISTICA (decisão do operador, 2026-10-01):** a medida
  mostrou o chão já determinístico.
- **PARADO (2026-10-01, leva desatendida 2, item 4): a medida contradiz a premissa; espera o
  operador.** Duas corridas de 6 roteiros (D-TELA-07, F-VIVO-h, BUG-Z, F-TR, F-T1 e F18a; 21 pares de
  capturas, com a câmera e o tick de cada captura gravados pelo `tools/shot.js`):
  - 9 pares com hash igual;
  - 9 diferem porque a captura caiu noutro tick;
  - 3 diferem porque a câmera estava noutro lugar;
  - **0 diferem com a mesma câmera e o mesmo tick.**

  No F16b (painel de seleção), 4 das 5 capturas diferem, com ~730 mil dos ~734 mil pixels do canvas
  mudando, no mesmo tick e com `scrollX` 945,8 contra 861,6. Câmera e tick dependem do relógio de
  parede do roteiro: setas seguradas por `waitForTimeout`, passos despausados por tempo. Nesta amostra
  o chão é determinístico. A amostra parou por falta de memória no sistema (C-IA-03c e F-SPR ficaram
  de fora), e não religuei.
  - **Pergunta ao operador:** o objetivo vira "captura determinística" (câmera posta pela ponte, e a
    captura num tick fixo, e não pelo relógio), ou o item fica como está até alguém achar um caso de
    chão diferente com a mesma câmera e o mesmo tick? A medida de onde veio o "105 de 219" não foi
    refeita aqui.
### D-TELA-05e — Mercenários em 8 direções
- **ENTREGUE (2026-10-01, leva desatendida 2, item 5).** Registrado (2026-10-01, pedido do operador). A decisão de 2026-09-30
  (8 direções para todas as unidades; nota da F-SPR acima) ainda não chegava aos mercenários:
  `data/units.json` declara `direcoesDeSprite: 8` no `_comum` de `civis` (`:26`) e de
  `militares` (`:106`), mas o grupo `mercenarios` (`:249`) não tem `_comum` nem o campo. Os
  cinco tipos (`rebel`, `rogue`, `vagabond`, `barbarian` e `warrior`) ficam no placeholder
  (`src/render/direcoes-de-sprite.ts`).
- **Escopo:** `mercenarios` ganha `direcoesDeSprite: 8`, como os outros grupos. O `vagabond`
  é montado e recebe 8, como o `scout` e o `knight`. **Só render lê o campo:** a sim não muda.
- **Aceite:**
  - o teste da F-SPR (`tests/F-SPR-carregamento.test.ts`) afirma 8 para os 28 tipos, por
    grupo, e não só para civis e militares;
  - o `npm run validate:data` passa.
- **Arte:** fora do escopo. Sem arte de mercenário no manifesto, o placeholder continua. O
  item só faz o dado dizer o que a decisão diz.

### D-SAVE-VILA-PRONTA — O save de teste do operador: a vila pronta, com a casa de armas e o quartel
- **Pedido do operador (2026-10-01).** O jogo NÃO muda: nada em `src/` nem em número de `data/`. O
  operador testa o `7d35788` à noite.
- **Escopo:** uma partida salva em `saves/teste-operador-vila-pronta.txt`, montada pela sim com
  `completarObra`, ocupante na porta, estrada direto no estado, `step` e o comando
  `SetProductionQuota`, como os cenários de teste. Na partida já existem e estão ligados por estrada
  ao armazém:
  - a pedreira, o lenhador e a serraria;
  - a roça de milho e o canavial, nos campos que o mapa já tem na vila;
  - o moinho, a padaria e a Bodega;
  - a casa de armas, com tábua na entrada e uma encomenda;
  - o quartel, com recrutas.

  O inimigo é a vila da IA da escaramuça (`criarEscaramuca`). Não há arma no armazém: a arma do
  quartel só pode sair da casa de armas.
- **Aceite (escrito antes do código):** `tests/D-SAVE-VILA-PRONTA.test.ts`:
  1. o arquivo versionado é byte a byte o que a montagem gera, e o `carregar` do jogo o aceita;
  2. a partida tem os dez tipos pedidos, completos, do jogador e ligados ao armazém. O quartel tem
     recrutas, a casa de armas tem tábua na entrada, e existe prédio da IA. Nenhum prédio do jogador
     abre com alerta;
  3. **a partir do arquivo versionado**, em até 2 000 ticks a casa de armas produz uma arma, um serf
     a retira, e ela entra no quartel;
  4. roteiro `tools/shots/D-SAVE-VILA-PRONTA.js`: o dev server serve o arquivo em `/saves/...`, o
     console o põe no `localStorage` (a chave do save), e o painel H carrega a partida no tick do
     save, com os prédios dela. A captura é aberta.
- **Se o carregar do jogo não aceitar um save gerado assim sem mudar código, o item PARA.**

### D-ARTE-INTEGRA-1 — A arte do Codex na main (integra-arte-1)
- **Aprovada pelo operador (2026-10-01)**, com as exceções de largura dos prédios. As da Bodega
  (1,5) e do canavial (1,303) são **provisórias**.
- **Escopo:**
  - da `noru-novos-sprites` em `57ab2b6`: `skills/`, `assets/base/` e `assets/sprites/`; o manifesto
    dela, mais o `icones.mercadorias` da `main` (D-ARTE-01);
  - por patch desde `b2d9bc3`: a âncora `bandeira` (`manifesto.ts`, `manifesto-camadas.ts`,
    `WorldScene.ts`) e o C10 e o F-ESC;
  - o diretor de arte pelo `b1723ae`.
- **Aceite:**
  1. F17f, `validate:data`, `verify` completo e `shot:todos` com saída 0;
  2. o roteiro `ARTE-VILA` mostra a vila e closes do armazém, padaria, moinho, serraria, terreno e
     vegetação. Cada prédio do close tem PNG (`spritesDePredio`), e as capturas são abertas;
     - **(emenda de 2026-10-01, pedido do operador; antes do código)** closes de pior caso das duas
       exceções provisórias: a Bodega com o canavial e outro vizinho colados, e uma unidade passando
       atrás (ao norte) de um dos dois no instante da captura; e a outra Bodega com a padaria colada.
       Tudo vem do save da vila pronta, sem prédio posto pelo roteiro. As capturas vão também para
       `D:\projetos-pessoal\evidencias\integra-arte-1\`, para o operador reavaliar as duas larguras;
  3. nenhum "alto à esquerda" fora do PROGRESS. O CLAUDE.md §9 aponta para a
     `pianco-sprite-director`.

### D-ARTE-BODEGA-MENOR — A Bodega desenhada a 1,2 do lote, e não a 1,5
- **Decisão do operador (2026-10-01), opção (b), depois de jogar:** a Bodega estava grande demais.
  Ela invadia o lote do canavial e cobria a parede da padaria (closes de pior caso da
  D-ARTE-INTEGRA-1).
- **Escopo:** só o manifesto. A exceção `larguraMaxPorLote` da `inn` passa de 1,5 a **1,2**, como a do
  armazém. O arquivo continua o `inn_completo-D-plus50.png` (384 px), e o render já o encolhe pela
  `escalaDoSprite`, sem deformar: 307 px de largura num lote de 256, com a altura caindo na mesma
  proporção. O `alturaMaxPorLargura` (1,29) fica: com a largura de 1,2, a altura desenhada (264 px)
  ainda passa do lote, então a exceção continua viva. Nenhum PNG novo, nenhum código de render,
  nada em `src/sim/` nem em `data/`.
- **Aceite (escrito antes do código):**
  1. `tests/C10-largura.test.ts` afirma a Bodega com o teto 1,2, pela conta exata, e que a largura
     desenhada é `1,2 × lote` (a `escalaDoSprite` encolhe o arquivo de 384). O canavial continua
     em 1,303;
  2. F17f, `validate:data` e o `verify` completo verdes;
  3. o roteiro `ARTE-VILA` sai 0, e a captura do pior caso da Bodega com o canavial é aberta.
  4. **(emenda de 2026-10-01, antes do código, pela medida)** o F-ESC afirmava que nenhum sprite
     encolhe ("a arte de hoje esta toda dentro da regra"). Com a decisão (b), a Bodega encolhe de
     propósito. A asserção passa a ser exata por prédio: a escala da `inn` é **0,8** (1,2 / 1,5), e a
     de todos os outros continua **1**. Nenhum prédio sai da conta.

### D-ARTE-PESCADOR-BAIXO — A Casa do Pescador mais baixa
- **Pedido do operador (2026-10-01), depois de jogar:** a Casa do Pescador ficou alta demais. O
  arquivo dela tem 192×176, num lote de 192 px (razão 0,917, abaixo do k = 1), então nenhuma regra a
  encolhe hoje.
- **Escopo:** o manifesto ganha `alturaMaxPorLargura: 0.8` na `fishermans`. O render encolhe o
  sprite inteiro, sem deformar: ele desenha 154 px de altura (−13%) e 168 de largura, centrado no
  lote.
  - **O modelo da "exceção morta" (F-ESC e C10) proíbe esse dado, e o modelo está errado.** Hoje a
    exceção é morta quando o arquivo cabe em k, e uma exceção abaixo de k, que encolhe, é acusada.
  - **Troca pelo predicado do runtime:** a exceção é morta quando a escala com ela é a mesma escala
    sem ela (`escalaDoSprite`). Nos dois eixos, `violacoesDaAltura` e `violacoesDaLargura`.
  - Isso é render puro (`src/render/escala-predio.ts`): nada em `src/sim/` nem em número de `data/`.
- **Aceite (escrito antes do código):**
  1. o manifesto real não tem violação nos dois eixos. As exceções de hoje continuam vivas e não
     muda a escala de nenhuma outra (a do F-ESC, por prédio: a Bodega em 0,8, o pescador em
     0,8 × 192 / 176, os outros em 1);
  2. por tabela, nos dois eixos:
     - exceção acima de k num arquivo que cabe em k: **morta** (o caso de hoje continua reprovando);
     - exceção abaixo da razão do arquivo: **viva**;
     - exceção igual a k: **morta**;
     - exceção acima de k num arquivo que passa de k: **viva**;
  3. a Casa do Pescador desenha `0,8 × lote` de altura, pela conta exata, e não deforma (a
     largura e a altura caem na mesma escala);
  4. `verify` completo verde, e o roteiro `F-T4a` (o pescador) sai 0, com a captura aberta.

### D-ARTE-SERF-ANDAR — Piloto do serf: o andar e a carga no braço (arte, pelo Codex)
- **Decisões do operador (2026-10-01):**
  - a carga vai **no braço**, como no KaM (caminho A), e não como ícone sobre a unidade;
  - o andar tem **8 quadros**;
  - **só o serf**, como teste;
  - quem chama o Codex é a sessão Claude.

  O ícone sobre placa escura da D-TELA-03a (ícone da carga no serf) é o que fica no lugar até a
  arte entrar. É ele que o operador viu como "fundo preto".
- **Escopo da arte**, na branch `noru-novos-sprites`, pelas skills dela (`pianco-sprite-director`,
  `pianco-units`, `pianco-animation-planner`), com a luz do `cdcfec5`:
  - **lote 1:** o serf `andar`, sem carga: as 5 direções canônicas (N, NE, E, SE, S; o oeste é
    espelho) × 8 quadros, 64×96, `anchor [0.5, 1]`, a linha dos pés constante;
  - **lote 2:** o serf andando com tábua (`timber`) no braço, a mesma grade.

  **Parada para o operador** depois do lote 2, antes das outras 27 mercadorias (o custo de
  28 × 5 × 8 quadros).
- **Fora do escopo do Codex:** `src/`, `data/` e as entradas `estados` do serf no manifesto. O
  consumidor de animação é da sessão de código, na Leva 2 do plano da animação direcional
  (D-TELA-04a a 04e). A arte chega com uma descrição por quadro, num arquivo ao lado dos PNG.
- **Aceite da arte (escrito antes da geração):**
  1. 40 quadros por lote, com o mesmo tamanho, o mesmo anchor e o pé na mesma linha. O validador
     da `pianco-sprite-tools` passa em todos;
  2. a folha de contato sobre grama, areia e rocha, nos zooms 0,5, 1 e 2, normal e com tint 0,8;
  3. a carga lê como tábua a zoom 1, sem placa nem fundo;
  4. o registro no `SKILL_BUILDER_PROGRESS.md`: o prompt, a referência, os hashes e as gerações
     gastas.

### D-ARTE-PIXEL-ART-CIVIS — Teste do pixel art: as 28 mercadorias, a carga nas mãos e os civis
- **Pedido do operador (2026-10-03, teste de pixel art, branch `serf-pixelart`, sem merge na
  `main`):** "mapear todos os itens do jogo e criar sprites para cada um, seguindo a temática;
  terminando os produtos e o serf, passar para todas as demais profissões". A arte é do PixelLab
  (MCP), no modo `v3`, com canvas de 76 px. O boneco tem cerca de 74 px de altura, a altura do
  laborer (73), aprovada no serf.
- **Decisão da carga (operador, 2026-10-03):** uma pose de carregar com as mãos vazias, e o render
  desenha o sprite da mercadoria entre as mãos, em vez de uma animação por mercadoria. Uma pose
  vale para as 28 mercadorias, e mercadoria nova custa só o sprite dela.
- **Feature de integração de arte e render,** só na branch de teste. Nada em `src/sim/`.
- **Aceite (escrito antes do código, 2026-10-03):**
  1. **As 28 mercadorias** de `economia.mercadorias` têm um sprite em
     `assets/sprites/mercadorias/<id>.png` e uma entrada `icones.mercadorias` no manifesto. O
     validador do manifesto (o `F17f`, as regras da D-ARTE-01) passa nas 28.
  2. **A carga nas mãos:** a regra pura `pontoDaCargaNasMaos(direcao)` diz onde fica a mercadoria
     relativa ao pé, e se ela vai à frente ou atrás do corpo. Os números ficam num dado de render,
     com caso por direção na tabela do teste. O serf com carga e com a animação `carregar` desenha
     o sprite da mercadoria nesse ponto, no lugar do ícone sobre a cabeça. Sem a animação, fica o
     ícone de hoje (D-TELA-03a).
  3. **Os civis em pixel art:** cada profissão de `civis` ganha `atlas` e `animacoes` (parado e
     andar, 8 quadros, 5 direções e o oeste por espelho) no manifesto, com o pé na linha 90 e a
     célula de 64×96. O validador de atlas passa. A profissão que não ficar pronta fica com a arte
     de hoje e entra no relatório.
  4. **No jogo:** o roteiro `D-ARTE-SERF-COMFYUI` sai 0, e a captura com serfs carregando e civis
     andando é aberta.
  5. **Não-regressão:** os testes de manifesto, de animação (D-TELA-04b e D-TELA-05c) e da carga
     (D-TELA-SERF-CARREGANDO) passam, e `git diff main -- src/sim` fica vazio.

### D-ARTE-PIXEL-ART-MILITARES — Os militares em pixel art, o obreiro refeito e o obreiro trabalhando

- **Pedido do operador (2026-10-03, no teste de pixel art):** "Aprovado, gere as unidades militares.
  O laborer ficou ruim, use como inspiração essa imagem" (um obreiro de macacão de brim
  ferrugem, uma alça caída, peito nu, capacete, martelo de unha, barra dobrada e botina) e "a
  animação do laborer construindo os edifícios e ruas já está pronta? Se tiver, crie a arte para
  isso também, e pode fazer o merge no final".
- **O que já existe:** o render já escolhe a ação `trabalhar` para o obreiro que está `nivelando` ou
  `martelando` (`src/render/acao-de-unidade.ts`), e `atacar` para o militar que luta. Falta só a
  arte: a entrada do manifesto sem a animação cai no quadro parado, como hoje.
- **Feature de arte e manifesto.** Nada em `src/sim/`. O render muda num ponto só (aceite 7).
- **Emenda (2026-10-03, antes do código, pela medida):** com o cabra e o obreiro ganhando atlas
  real, o roteiro D-TELA-05c falhou ("corpo inicia no quadro zero"). Hipótese: no `preload` da
  cena, o atlas de depuração e o real do mesmo tipo entram na fila com a mesma chave
  (`unidade:<tipo>:atlas`), e o real ocupa o lugar do de depuração, que é o que tem a morte.
- **Os nove militares da camada sertão:** cabra, cabra de gibão, valente, bodoqueiro, cabra de
  fogo, aguilhadeiro, ferrão, vaqueiro (montado) e capitão do bando (montado). Os mercenários não
  têm entrada no manifesto e ficam de fora.
- **Aceite (escrito antes do código, 2026-10-03):**
  1. **Os sete militares a pé** têm atlas com `parado`, `andar` (8 quadros) e `atacar`, nas 5
     direções canônicas (o oeste por espelho), na célula 64×96 com o pé na linha 90. Os dois
     montados têm `parado`, `andar` e `atacar` numa célula de 128×128, com o pé na linha 122.
     **Emenda (2026-10-03, antes do atlas, pela medida):** o cavalo de lado mede até 108 px de
     largura e não cabe nos 96 px da entrada de hoje; a entrada dos dois passa a `tamanho`
     [128, 128].
  2. **O obreiro refeito** a partir da imagem do operador tem `parado`, `andar` e `trabalhar`
     (golpe de martelo) nas 5 direções, na célula 64×96 com o pé na linha 90.
  3. Cada entrada nova do manifesto aponta para o atlas, e o validador do manifesto (`F17f`) e o
     carregamento (`F-SPR-carregamento`) passam.
  4. **Evidência:** a folha de revisão de cada unidade é aberta, e a captura de um roteiro em que um
     obreiro trabalha mostra o quadro de `trabalhar` do atlas novo.
  5. **Não-regressão:** os testes de manifesto e de animação (D-TELA-04b, D-TELA-05c,
     D-TELA-SERF-CARREGANDO) passam, e `git diff main -- src/sim` continua vazio.
  6. **O merge na `main`** fica autorizado pelo operador ao fim, depois do `verify:rapido` verde,
     sem tocar o trabalho da outra sessão (a névoa).
  7. **No modo `?depuracao=<tipos>`, o atlas de depuração vence o real do mesmo tipo:** a regra pura
     que decide o que o `preload` enfileira não devolve o atlas real de um tipo cujo atlas de
     depuração já entrou (teste por tabela), e o roteiro D-TELA-05c sai 0.

### D-TELA-SERF-CARREGANDO — O serf anda com os braços levando a carga
- **Pedido do operador (2026-10-03, no teste de pixel art):** "o serf está carregando os produtos
  com o braço pra baixo e deveria simular os braços levando um produto". **Feature de integração
  de render e arte:** o render e o manifesto. Nada em `src/sim/`.
- **Escopo:**
  - a arte ganha a animação `carregando` (8 quadros nas 5 direções, o oeste por espelho), com os
    braços dobrados segurando um saco neutro à frente do peito. O ícone da mercadoria continua por
    cima (D-TELA-03a);
  - o render troca o `andar` por `carregando` quando a unidade leva carga (`fsmData.carga`) e a
    entrada do manifesto tem a animação `carregando`. Sem ela, fica o `andar` de hoje. O quadro do
    `carregando` segue a distância, como o `andar`.
- **Aceite (escrito antes do código, 2026-10-03):**
  1. **A regra pura** `animacaoComCarga(acao, temCarga, animacoes)`, por tabela: `andar` com carga e
     com `carregando` no manifesto vira `carregando`; sem carga, sem a animação, ou com outra ação
     (`parado`, `trabalhar`, `atacar`), a ação não muda.
  2. **O atlas** tem `serf/carregando/<dir>/0000..0007` nas 5 direções, e o `F17f-manifesto` (o
     validador de atlas) passa.
  3. **No jogo,** o roteiro `D-ARTE-SERF-COMFYUI` ganha a afirmação: o serf que anda com `carga`
     publica `animacao` `carregando` e um `frame` `serf/carregando/...`, e o que anda sem carga
     publica `andar`. As capturas são abertas.
  4. **Não-regressão:** os testes da D-TELA-05c e da D-TELA-04b e os roteiros `D-TELA-04c` e
     `D-TELA-03` saem 0; `git diff main -- src/sim` vazio.

### D-ARTE-SERF-COMFYUI — O serf animado gerado no ComfyUI local, no jogo
- **Pedido do operador (2026-10-03):** "gere e já atribua no jogo as animações. Quero ver já
  funcionando no jogo". A arte sai do ComfyUI local (SDXL DreamShaper XL Turbo + IP-Adapter Plus +
  ControlNet OpenPose), como no teste-2 aprovado para seguir
  (`D:\projetos-pessoal\cangaco-game-candidatos\arte\D\serf\comfyui-teste-2026-10-03\teste-2\`).
  **Substitui o piloto da D-ARTE-SERF-ANDAR pelo Codex,** que está parado.
- **Escopo: arte e manifesto, sem código.** O render já desenha unidade por atlas e animação no
  jogo normal: o atlas do manifesto é carregado por tipo (D-TELA-05d), e o quadro do andar sai da
  distância andada (D-TELA-04b). Nada muda em `src/`, nem em `data/`.
  - O serf ganha `atlas` e `animacoes` no `assets/manifest.json`: `parado` (1 quadro) e `andar`
    (8 quadros, `tilesPorCiclo` 2), nas 5 direções canônicas (n, ne, l, se, s). O oeste é
    espelho. Os `estados` de hoje continuam como fallback.
  - O atlas fica em `assets/sprites/units/serf/serf.png` + `serf.json`, com quadros de 64×96 sem
    trim, nomeados `serf/<animacao>/<direcao>/<nnnn>`.
  - A base em `assets/base/units/serf-comfyui/`: a imagem de referência do IP-Adapter, os
    esqueletos de pose e o `registro.json`, com o modelo, o prompt, as sementes e os pesos de cada
    quadro. Os brutos (832×1216) ficam nos candidatos, fora do repositório.
- **Aceite (escrito antes da geração, 2026-10-03):**
  1. **O atlas passa no validador da D-TELA-04a** (o `F17f-manifesto`): todo quadro prometido
     existe, toda direção tem o mesmo número de quadros e o `sourceSize` é 64×96. O
     `F-SPR-carregamento` também passa.
  2. **O pé fica numa linha fixa:** em todo quadro, a linha mais baixa com alfa fica a no máximo
     2 px da linha 95. A transformação do bruto para o quadro é a mesma em todos os quadros:
     escala e âncora fixas, e não o recorte pela caixa de cada um.
  - **Emenda do aceite 2 (2026-10-03, antes do processamento; medido no teste de 3 quadros):** o
    modelo não põe o pé na mesma altura em toda imagem, mesmo com a pose fixa. A transformação
    passa a ser:
    - **escala fixa por direção:** a altura do serf parado da direção vai para 86 px, e a mesma
      escala vale para os 8 quadros do andar dela;
    - **eixo horizontal fixo pela pose:** o centro da pose (x = 416 no bruto) vai para a coluna 32;
    - **o pé alinhado por quadro:** a linha mais baixa com alfa vai para a linha 95.

    A medida do aceite 2 (pé a no máximo 2 px da linha 95) continua valendo. A sombra projetada no
    chão, que o modelo desenha, sai junto com o fundo cinza.
  3. **No jogo:** um roteiro novo, `tools/shots/D-ARTE-SERF-COMFYUI.js`, sobre a vila pronta, com
     um passo despausado. A ponte publica, para os serfs na vista, a animação, o quadro e o
     `frame` do atlas. O roteiro afirma pelo menos um serf com `frame` do atlas novo em `andar`
     e o quadro mudando entre dois instantes. As capturas são abertas.
  4. **Não-regressão:** os roteiros `D-TELA-04c` (a vitrine de depuração), `D-TELA-03` (o ícone
     da carga) e `ARTE-VILA` saem 0, e o `verify:rapido` passa.
  - **Emenda do aceite 4 (2026-10-03, antes do código):** o `tools/shots/D-TELA-04c.js` afirma
    "jogo normal deve preservar sprites atuais", ou seja, nenhum serf com `frame`. Era a garantia
    de que o atlas de **depuração** não vazava para o jogo, e este item muda de propósito o jogo
    normal. A asserção passa a ser mais estrita: no jogo normal, todo `frame` de serf é um quadro
    do atlas **real** (existe em `assets/sprites/units/serf/serf.json`), e nenhum é da depuração.
    Com `?depuracao`, o atlas de depuração continua vencendo, como hoje.
  - **Emenda da revisão do operador (2026-10-03, antes do reprocessamento).** Jogando, o operador
    reprovou o tamanho e as poses:
    - o parado e o andar de frente e na diagonal saíram grandes demais perto do laborer;
    - o serf olha para cima;
    - quadros saíram na direção errada;
    - um quadro tem a mão levantada.

    O leste foi aprovado no tamanho. A troca:
    - **uma escala só para todas as direções,** e não uma por direção. As poses foram desenhadas
      todas na mesma escala, então um fator único mantém a proporção entre as direções. Ele é
      calibrado para o andar do leste ficar com a altura que ele tem hoje no jogo: medido, o
      quadro 3 do leste vai da linha 23 à 96, 73 px, a mesma altura do laborer (17 a 90). A
      mediana do andar do leste vai para 73 px;
    - **o pé na linha 90,** como o `parado.png` do laborer e o do serf antigo (medido: a linha de
      baixo do alfa dos dois é a 89). O aceite 2 passa a medir a distância à linha 90;
    - **os quadros reprovados são gerados de novo,** com o prompt de cabeça reta e olhar para a
      frente, e a direção reforçada: o parado e o andar do sul, o parado e o andar do nordeste, os
      quadros 5 a 7 do norte, o 6 do leste e o 6 do sudeste;
    - **o aceite ganha uma medida de tamanho:** em nenhum quadro a largura do alfa passa de 1,25 vez
      a do laborer (42 px, logo no máximo 52 px).
  5. **Limites conhecidos, registrados e não reprovados:** a geração é quadro a quadro, então
     detalhes da roupa podem variar entre quadros (cintilação). A carga continua como ícone sobre
     o serf (D-TELA-03a).

### D-ARTE-CHAO-DE-ROCA — Pedido de arte para o Codex: o chão de roça sob a cana
- **Registrado por decisão do operador (2026-10-01): é pedido de arte para o Codex**, e não
  trabalho desta fila de código. Vem da avaliação da F-TR (o esgotado por tipo, `9fb7b71`): a
  cana em pousio já não usa o losango escuro do esgotado, mas continua sendo losangos soltos
  sobre a grama. O BUG-N (cana em pousio parecia mato cortado) fechou pelo caminho (a), um código
  de pousio próprio. O caminho (b) que ele registrou, **o chão de roça desenhado sob o tile de
  cultura**, é este pedido.
- **O que falta:** o milho em pousio fica sobre o terreno `campoArado`, marrom e derivado do mapa.
  A cana (`grapes` em `data/resources.json`, que **é cana-de-açúcar e não uva**: o `_doc` do
  recurso diz isso) não tem terreno, e fica sobre `grama`. O pedido é a arte do chão de roça da
  cana, a terra de partido com sulco, sob a touceira e sob o tile em pousio. O losango solto deixa
  de ser a única coisa que diz "aqui tem roça".
- **Regras para quem fizer:**
  - as skills de arte (`skills/pianco-sprite-director/SKILL.md` e a especialidade que ela escolhe), com base versionada em `assets/base/` e o
    derivado em `assets/sprites/`;
  - entrada no `assets/manifest.json` com os oito campos do CLAUDE.md §9;
  - nenhum asset do jogo de 1998, em nenhuma forma.
- **Decisão que fica com o operador, e não com quem desenha:** se o chão de roça vira terreno
  próprio no mapa (dado do gerador) ou camada de render sob o tile de cultura. Nenhum número de
  `data/` muda sem essa decisão.
- **Escopo ampliado (operador, 2026-10-02): a arte e a integração, pelo Codex, numa worktree a
  partir da `main`, com merge na `main` no fim.** A decisão acima continua com o operador. Por
  isso a integração segue a interpretação mais conservadora (§14): **camada de render** sob o tile
  de cana, sem terreno novo no mapa e sem nada em `src/sim/` nem em `data/`. O caminho do terreno
  próprio continua aberto.
  - O id do asset é `campoCana`, no padrão do `campoArado`, e é provisório.
  - Só `assets/`, `src/render/`, `tools/shots/` e `tests/`.
- **Aceite (escrito antes da geração e do código, 2026-10-02):**
  1. **A arte:**
     - quatro variantes 64×64 (`padrao`, `v1`, `v2` e `v3`), emendáveis nos quatro lados;
     - o validador da `pianco-sprite-tools` passa em todas;
     - a luz é a do `cdcfec5`;
     - a base vai em `assets/base/`, e o derivado em `assets/sprites/terrain/`;
     - a entrada `campoCana` no `assets/manifest.json` tem os oito campos do §9, no formato do
       `campoArado`.
  2. **A folha de contato,** ao lado da base: o chão em grade 4×4, o chão com a touceira
     `grapes-D.png` por cima e o chão vizinho de `grama` e de `campoArado`. Nos zooms 0,5, 1 e 2,
     normal e com tint 0,8. A zoom 1, o chão da cana se distingue do `campoArado` e da `grama`, e a
     touceira continua legível por cima.
  3. **Registro no `SKILL_BUILDER_PROGRESS.md`:** o prompt, as referências, os sha256 dos PNG e as
     gerações gastas (no máximo 4).
  4. **A regra pura** em `src/render/`, que decide se um tile leva o chão da roça, com teste por
     tabela:
     - o tile de cana, com quantidade > 0 ou em pousio, leva o chão;
     - o milho não leva, porque já tem o `campoArado` do mapa;
     - qualquer outro recurso não leva, nem o tile sem recurso;
     - a relação entre a cana e o `campoCana` fica num lugar só.
  5. **O desenho:** o chão fica acima do terreno e abaixo da touceira, das unidades e dos prédios.
     Sem o PNG carregado, nada é desenhado no lugar dele, e o jogo segue como hoje (placeholder do
     §9). O manifesto continua passando no `tests/F17f-manifesto.test.ts`.
  6. **O roteiro `tools/shots/D-ARTE-CHAO-DE-ROCA.js`,** sobre o save
     `saves/teste-operador-vila-pronta.txt`, como o roteiro `D-SAVE-VILA-PRONTA`:
     - com a câmera nos tiles de cana, a ponte de debug informa quantos chãos de roça estão
       desenhados, e o número é igual ao de tiles de cana na vista, com pelo menos um em pousio
       (pelo `step`, se o save não tiver nenhum);
     - a captura é aberta.
  7. **Não-regressão:** os roteiros `F-TR` e `ARTE-VILA` saem 0, e o `npm run verify:rapido` passa.
     Nada muda em `src/sim/` nem em `data/` (`git diff main -- src/sim data` vazio).

### O mundo vivo: vento, água e poeira (quebra do `docs/fase-animacao-vida-do-mundo.md`, aprovada pelo operador, 2026-10-02)
- **Origem:** o documento é o prompt de pesquisa do operador (`c75e98e`), e não item da fila. Parte
  dele já foi entregue por outros itens: o trabalho, a fumaça e a luz das minas (F-VIVO-b), os
  animais (F-VIVO-c), as pilhas (F-VIVO-a e D-TELA-03b) e as 8 direções (`7aadf98`). O andar do
  carregador está na D-ARTE-SERF-ANDAR. O resto sai nos quatro itens abaixo, **nesta ordem**
  (decisão do operador).
- **O Aseprite fica fora (decisão do operador, 2026-10-02).** Os §2, §20 e §23 do documento pedem
  o Aseprite MCP, mas o operador procura ferramenta que entregue animação **em tom de pintura**,
  e não só pixel art. Outra sessão testa Blender, mesh.ai e outras plataformas. Nenhum item desta
  quebra instala ferramenta nem depende de uma. O `docs/BRIEF-ANIMACAO.md` (§4 do documento)
  espera essa escolha.
- **Regras comuns aos quatro itens:**
  - **Só render.** Nada em `src/sim/` nem em número de `data/` que a sim leia.
  - **O movimento sai do tick, nunca do relógio de parede**, como o laço de trabalho
    (`src/render/trabalho.ts`). O movimento é uma função de `(tick, alfaDeInterpolacao, tile)`.
    Com o jogo pausado, o mesmo tick dá o mesmo quadro. Sem isso, toda captura com árvore ou água
    muda de hash entre corridas.
  - **Nada de `Math.random()`.** A fase de cada objeto sai do tile por hash determinístico, de modo
    que vizinhos não balançam juntos.
  - **Os números de tela ficam num dado de render,** como o `data/relevo.json`, com uma regra no
    `validate:data`.
  - **Pode ir para o Codex** (tabela do `/codex`: `src/render/`, `tools/`, testes de aceite já
    escritos), numa worktree a partir da `main`, com merge na `main` no fim.

#### D-TELA-VENTO-VEGETACAO — O vento e as árvores que balançam
- **Escopo:**
  - um vento global, função pura em `src/render/vento.ts`, com `direcao`, `forca`, `rajada` e o
    tempo em ticks. É o consumidor único dos §6 e §8 do documento: os itens seguintes (a poeira
    e a bandeira) leem o mesmo vento, e nenhum inventa o seu;
  - os números em `data/vento.json`: a direção, a força, a amplitude máxima, o período, a
    rajada (intervalo, duração e velocidade com que ela cruza o mapa) e quais ids de `vegetacao`
    do manifesto balançam. A regra é `interface/vento` em `tools/data-rules.js`;
  - os sprites de vegetação de pé (`vegetacaoDesenhada` no `WorldScene.ts`, hoje o `tree`)
    balançam em volta do pé. A rocha (`rock`, que também é `vegetacao` no manifesto) não balança.
- **Fora do escopo:** o milho e a cana. Eles são células do tilemap, e não sprites, e balançar
  uma célula pede outra técnica. Ficam para depois, com registro no PROGRESS. Também ficam fora a
  água, a poeira e a bandeira, que são os itens seguintes.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A função pura, por tabela, em `tests/D-TELA-VENTO-VEGETACAO.test.ts`:**
     - as mesmas entradas dão a mesma saída, e o mesmo tick com o mesmo alfa dá o mesmo valor;
     - com `forca` 0, o deslocamento é exatamente 0 em todo tile;
     - em nenhum tile, em nenhum tick de uma janela de 2 000 ticks, o deslocamento passa da
       amplitude máxima do dado;
     - não é sincronizado: num bloco de 10×10 tiles, no mesmo tick, a fase não é a mesma em
       todos (conta-se quantos valores distintos há, e o número vai para o
       `test-output/D-TELA-VENTO-VEGETACAO.json`);
     - a rajada atravessa o mapa: o pico chega antes ao tile a montante (pela `direcao`) e depois
       ao tile a jusante, com o atraso dado pela velocidade da rajada no dado, com tolerância de
       1 tick.
  2. **O pé fica parado:** o balanço gira ou inclina o sprite em volta do anchor `[0.5, 1]`. A
     posição do pé na tela é a mesma com e sem vento, afirmada pela função que calcula a
     transformação.
  3. **Quem balança:** a regra pura lê a lista do `data/vento.json`. O `tree` balança e o `rock`
     não. A regra do `validate:data` reprova um id da lista que não existe no manifesto como
     `vegetacao`, e há um caso que reprova escrito no teste.
  4. **A luz do relevo não se perde:** o `tingir` da D-TELA-LUZ-RELEVO continua aplicado ao
     sprite que balança, com a tint lida pelo pé.
  5. **O roteiro `tools/shots/D-TELA-VENTO-VEGETACAO.js`:**
     - pausado, com a câmera posta pela ponte (`fixarCamera`) sobre um mato;
     - a ponte informa quantos sprites balançam, e o número é igual ao de árvores desenhadas
       (`vegetacaoRenderizada` menos as rochas);
     - duas capturas, uma no tick T e outra no T + 5 (pela ponte `avancar`), diferentes na região
       das árvores;
     - o roteiro roda duas vezes, e a captura do tick T tem o mesmo sha256 nas duas corridas;
     - um passo despausado (§8);
     - as capturas são abertas.
  6. **A medida de custo** vai para o PROGRESS como evidência da sessão, e não como asserção (§8):
     o tempo de quadro com e sem vento, na vista mais cheia de árvore do mapa, e quantos sprites
     são atualizados por quadro.
  7. **Não-regressão:**
     - os roteiros `F-SPR`, `F-REPL-e` e `ARTE-VILA` saem 0;
     - o `npm run verify:rapido` passa;
     - `git diff main -- src/sim` vazio, e os arquivos de `data/` que a sim lê ficam intactos.

#### D-TELA-AGUA-VIVA — A água se mexe
- **Escopo (o aceite entra num commit próprio antes do código):** a água (`agua`, com as
  variantes `v1` a `v3` no manifesto) ganha movimento pelo tick. A primeira tentativa é a
  alternância ou o deslocamento das variantes que já existem, sem arte nova. A margem não pisca, e
  o vento (D-TELA-VENTO-VEGETACAO) pode influir, se for barato. Mesmas regras comuns.
- **Escopo fechado (2026-10-02, antes do código):**
  - o tile de água troca de variante (`padrao`, `v1`, `v2` e `v3`, as do manifesto) pelo tick, com
    fase própria por tile, de modo que a água "corre" sem piscar em bloco. Não há arte nova;
  - a borda (`borda-m0` a `borda-m15`) e os outros terrenos não mudam;
  - o vento fica de fora: a D-TELA-VENTO-VEGETACAO corre em paralelo, e acoplar os dois agora
    criaria uma dependência entre worktrees;
  - os números (período em ticks e ordem das variantes) ficam em `data/agua.json`, só de render,
    com a regra `interface/agua` em `tools/data-rules.js`.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A função pura** `varianteDaAgua(config, tick, gx, gy)` em `src/render/agua-viva.ts`, por
     tabela em `tests/D-TELA-AGUA-VIVA.test.ts`:
     - as mesmas entradas dão a mesma saída, e a saída é sempre uma das 4 variantes;
     - num tile, a variante muda no máximo uma vez a cada `periodo` ticks;
     - numa janela de 4 × `periodo` ticks, todo tile passa por pelo menos 2 variantes;
     - num bloco de 10×10 tiles, no mesmo tick, há mais de uma variante (o número vai para o
       `test-output/D-TELA-AGUA-VIVA.json`);
     - a regra do `validate:data` reprova um período ≤ 0 e uma variante que não está no manifesto
       da `agua`, com um caso que reprova escrito no teste.
  2. **Só a água muda:** a regra que decide quais células trocar devolve só tiles cujo terreno é
     `agua`. Uma tabela com água, areia, grama e `campoArado` vizinhos prova isso. A camada da
     borda não é tocada.
  3. **Só a vista paga:** a troca de célula acontece só nos tiles de água dentro da vista da
     câmera, e só quando a variante muda. A ponte de debug publica quantas células foram trocadas
     no último tick. O roteiro afirma que esse número é no máximo o de tiles de água na vista.
  4. **O roteiro `tools/shots/D-TELA-AGUA-VIVA.js`:**
     - pausado, com a câmera posta pela ponte (`fixarCamera`) sobre o açude;
     - a ponte publica a variante de cada tile de água na vista. Entre o tick T e o T + `periodo`
       (pela ponte `avancar`), pelo menos um tile muda, e cada variante publicada é igual à da
       função pura para aquele tick e tile;
     - capturas no T e no T + `periodo`;
     - o roteiro roda duas vezes, e a captura do tick T tem o mesmo sha256 nas duas corridas;
     - um passo despausado (§8);
     - as capturas são abertas.
  5. **A medida de custo** vai para o PROGRESS como evidência da sessão: as células trocadas por
     tick na vista com mais água do mapa e o tempo de quadro com e sem a animação.
  6. **Não-regressão:**
     - os roteiros `F-T1`, `F-TR`, `ARTE-VILA` e `D-ARTE-CHAO-DE-ROCA` saem 0;
     - o `npm run verify:rapido` passa, e `tests/F-SPR-carregamento.test.ts` e
       `tests/F17f-manifesto.test.ts` passam rodados direto. O `vitest related` não alcança teste
       que lê dado por `readFileSync` (achado da D-ARTE-CHAO-DE-ROCA);
     - `git diff main -- src/sim` vazio.

#### D-TELA-POEIRA-AMBIENTE — Poeira e palha no vento
- **Escopo (o aceite entra num commit próprio antes do código):** partículas de poeira e palha
  seca (§10 e §11 do documento), levadas pelo mesmo vento, com densidade limitada e só na vista.
  As partículas são sorteadas por um RNG de render semeado (nunca `Math.random()`), e a sim não
  muda. Depende da D-TELA-VENTO-VEGETACAO.
- **Escopo fechado (2026-10-02, antes do código):**
  - **sem estado:** a lista de partículas de um quadro é uma função pura do tick, do alfa, da vista
    e da semente. Cada partícula nasce num tick sorteado por hash da semente e de um índice, vive
    `vidaTicks` e anda com o vento de `src/render/vento.ts`. Nada acumula de um quadro para o
    outro, então pausado o quadro é o mesmo, e a câmera pode pular sem partícula órfã;
  - **dois tipos:** `poeira` (ponto pequeno, cor de terra) e `palha` (traço curto, cor de palha
    seca). As cores e os números ficam em `data/poeira.json`, só de render, com a regra
    `interface/poeira`;
  - **não nasce sobre água** (`agua` no terreno) e respeita um teto por vista (`maximoNaVista`);
  - **o desenho** é um pool de objetos reaproveitados, sem criar ou destruir por quadro e sem o
    emissor de partículas do Phaser, que sorteia com `Math.random()`. A camada fica acima do chão
    e dos recursos, e abaixo das unidades e dos prédios;
  - **com `forca` 0 no vento, não há partícula.**
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A função pura** `particulasDaPoeira(config, vento, tick, alfa, vista, ehAgua)` em
     `src/render/poeira.ts`, por tabela em `tests/D-TELA-POEIRA-AMBIENTE.test.ts`:
     - as mesmas entradas dão a mesma saída;
     - toda partícula está dentro da vista, e o total é no máximo `maximoNaVista`;
     - nenhuma partícula está sobre um tile em que `ehAgua` é verdadeiro;
     - com `forca` 0, a lista é vazia;
     - uma partícula presente no tick t e no t + 1 (o mesmo `id`) andou no sentido do vento: o
       produto escalar do deslocamento com a `direcao` é positivo;
     - nenhuma partícula vive mais que `vidaTicks`;
     - as duas espécies aparecem numa janela de 200 ticks.
  2. **O dado:** `data/poeira.json` é de interface, e não de jogo. A regra reprova `maximoNaVista`
     ≤ 0, `vidaTicks` ≤ 0 e cor fora de `#rrggbb`, com um caso que reprova escrito no teste. A
     poeira lê o vento do `data/vento.json` e não tem direção nem força próprias.
  3. **O pool:** a ponte de debug publica `poeiraDesenhada` (as partículas visíveis no quadro) e
     `poolDaPoeira` (os objetos criados desde o início). O roteiro afirma que o `poolDaPoeira` não
     passa de `maximoNaVista` depois de 50 ticks com a câmera em dois lugares.
  4. **O roteiro `tools/shots/D-TELA-POEIRA-AMBIENTE.js`:**
     - pausado, com a câmera pela ponte (`fixarCamera`) numa vista de areia e grama;
     - o `poeiraDesenhada` é maior que 0 e no máximo `maximoNaVista`;
     - capturas no tick T e no T + 5 (pela ponte `avancar`);
     - o roteiro roda duas vezes, e a captura do tick T tem o mesmo sha256 nas duas corridas;
     - numa vista sobre o açude, nenhuma partícula visível está sobre tile de água: a ponte publica
       o tile de cada partícula, e o roteiro confere com o terreno do mapa;
     - um passo despausado (§8);
     - as capturas são abertas.
  5. **Não-regressão:**
     - os roteiros `D-TELA-VENTO-VEGETACAO`, `D-TELA-AGUA-VIVA` e `ARTE-VILA` saem 0;
     - o `npm run verify:rapido` passa, e os testes que leem dado por `readFileSync` passam rodados
       direto: `F-SPR-carregamento`, `F17f-manifesto` e os testes do vento, da água e da poeira;
     - `git diff main -- src/sim` vazio.
  6. **Sem medida de tempo pelo intervalo entre quadros:** esse método não mede custo (achado da
     D-TELA-AGUA-VIVA). O custo da poeira entra na D-TELA-CUSTO-DO-QUADRO, depois.
- **Emenda do aceite (2026-10-02, antes do código; pedido do operador, pelo §11 do
  `docs/fase-animacao-vida-do-mundo.md`):** a poeira é **evento**, e não efeito constante. O
  documento diz que "eventos raros geram mais impacto do que efeitos constantes", pede para não
  exagerar na frequência e sugere redemoinhos ocasionais, sem tumbleweed de western. A emenda
  troca o "sempre há partícula até o teto" por dois eventos:
  - **a rajada levanta poeira:** a partícula só nasce num tile em que a rajada do vento está
    passando (`intensidadeDaRajada` de `src/render/vento.ts` acima de `limiarDaRajada`, do dado). A
    poeira cruza o mapa como uma frente, junto com a rajada que já balança as árvores;
  - **o redemoinho raro:** no máximo um redemoinho por vista de cada vez, a cada
    `intervaloDoRedemoinhoTicks` em média. O lugar e o tick saem de um hash da semente. Ele dura
    `duracaoDoRedemoinhoTicks`, e as partículas giram em volta de um centro que anda com o vento;
  - **fora dos dois, nenhuma partícula.**

  O que muda nos aceites:
  - **aceite 1, acrescenta:**
    - fora da rajada e de um redemoinho, a lista é vazia;
    - toda partícula de rajada está num tile em que a intensidade passa do limiar;
    - numa janela de 4 × `intervaloDoRedemoinhoTicks`, numa vista fixa, há pelo menos um
      redemoinho e nunca dois ao mesmo tempo;
    - a fração de ticks com alguma partícula na vista, numa janela de 2 000 ticks, vai para o
      `test-output`. É número da corrida, sem teto, porque o teto é gosto do operador;
  - **aceite 2, acrescenta:** a regra reprova `limiarDaRajada` fora de (0, 1),
    `intervaloDoRedemoinhoTicks` ≤ `duracaoDoRedemoinhoTicks` e duração ≤ 0;
  - **aceite 4, troca** "o `poeiraDesenhada` é maior que 0" por: o roteiro avança pela ponte até
    achar um tick com poeira na vista e um tick sem poeira, no máximo `intervaloTicks` da rajada
    em cada um. As capturas são a com poeira e a sem poeira. A ponte publica
    `rajadaNaVista` (a maior intensidade da vista), e o roteiro afirma que ela passa do limiar no
    tick com poeira de rajada. O sha256 da captura com poeira é igual nas duas corridas, e o tick
    dela também.

#### D-TELA-CUSTO-DO-QUADRO — O custo de cada camada animada, medido dentro do quadro
- **Origem (2026-10-02):** os roteiros do vento e da água mediam o custo pelo intervalo entre
  `requestAnimationFrame`. Isso segue a cadência do navegador, e não o trabalho da cena: pausada,
  sem trabalho nenhum, a água ainda "custava" 5 ms. Este item troca o método.
- **Escopo:** só render e roteiro.
  - O render cronometra, com `performance.now()` (permitido em `src/render/`, nunca em `sim/`), o
    trecho de cada camada animada: vento, água e chão da cana.
  - Ele acumula o tempo e o número de chamadas, e publica os dois na ponte de debug (`custo`), com
    um `zerarCusto()` de harness.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A ponte publica** `custo: { [camada]: { ms, chamadas, itens } }`, em que `itens` são os
     sprites ou células que a camada trabalhou. O `zerarCusto()` zera tudo. Isso é testado em
     `tests/D-TELA-CUSTO-DO-QUADRO.test.ts`, pela função pura que acumula, com relógio injetado.
  2. **O roteiro `tools/shots/D-TELA-CUSTO-DO-QUADRO.js`:**
     - em duas vistas, a mais cheia de árvore e a mais cheia de água;
     - pausado por 60 quadros e depois avançando 60 ticks pela ponte;
     - grava em `test-output/D-TELA-CUSTO-DO-QUADRO.json` o ms por quadro e os itens por quadro de
       cada camada.

     **Asserção só no eixo determinístico (§8):** pausado e com a câmera parada, a água trabalha
     0 células por quadro. Nenhum `expect` de tempo.
  3. **A medida antiga sai:** os roteiros `D-TELA-VENTO-VEGETACAO` e `D-TELA-AGUA-VIVA` deixam de
     medir pelo intervalo entre quadros. O número novo vai para o PROGRESS e corrige os dois
     números antigos, que estão marcados como inválidos.
  4. **Não-regressão:** os roteiros do vento, da água e do chão da cana saem 0; o `verify:rapido`
     passa; `git diff main -- src/sim` vazio.

#### D-TELA-VENTO-NA-VISTA — O vento só trabalha onde a câmera vê
- **Origem (2026-10-02):** o vento atualiza as 350 árvores do mapa a cada quadro, e não só as da
  vista, mesmo pausado. A água já trabalha só na vista e só quando o tick ou a câmera mudam.
  **Depende da D-TELA-CUSTO-DO-QUADRO,** que mede o antes e o depois.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A regra pura** que escolhe quais árvores atualizar, por tabela em
     `tests/D-TELA-VENTO-NA-VISTA.test.ts`: entra a árvore cujo retângulo desenhado (o pé, o anchor
     e o tamanho do manifesto) cruza a vista. A árvore com o pé fora da vista e a copa dentro entra;
     a árvore toda fora não entra.
  2. **Sem trabalho repetido:** com o tick, o alfa e a câmera iguais aos do quadro anterior, o vento
     atualiza 0 sprites. A ponte publica `vegetacaoBalancando` por quadro.
  3. **Sem árvore atrasada:** a árvore que entra na vista por um movimento de câmera, sem tick novo,
     já sai no ângulo do tick atual. A ponte publica o tick da última atualização de cada árvore da
     vista, e o roteiro afirma que é o tick atual depois do `fixarCamera`.
  4. **O roteiro `D-TELA-VENTO-VEGETACAO` muda a asserção:** onde afirmava "balançando = toda a
     vegetação menos as rochas", passa a afirmar "balançando = as árvores na vista" no quadro de um
     tick novo, e 0 no quadro repetido. A asserção nova é mais estrita, e não só diferente.
  5. **A medida:** a D-TELA-CUSTO-DO-QUADRO roda antes e depois, e os dois números vão para o
     PROGRESS, como evidência da corrida.
  6. **Não-regressão:** os roteiros `D-TELA-VENTO-VEGETACAO`, `F-SPR`, `F-REPL-e` e `ARTE-VILA` saem
     0; o `verify:rapido` passa, e o teste do vento passa rodado direto; `git diff main -- src/sim`
     vazio.

#### D-TELA-CACTO-NO-VENTO — O cacto quase não se mexe, e cada árvore balança do seu jeito
- **Origem (2026-10-02, pedido do operador):** o §8 do `docs/fase-animacao-vida-do-mundo.md` diz
  "não faça cactos balançarem como árvores": o mandacaru e o xique-xique se mexem muito menos, o
  juazeiro e o umbuzeiro reagem ao vento. O vento da D-TELA-VENTO-VEGETACAO trata todas iguais,
  porque no manifesto as espécies são **estados** do mesmo id `tree` (`presente`, que é o
  juazeiro, mais `umbuzeiro`, `mandacaru`, `facheiro`, `xique-xique` e `macambira`). O §8 pede
  também uma pequena variação de velocidade e de amplitude por árvore, e não só de fase.
- **Escopo:** só render e dado de render. Nada em `src/sim/`, nenhum id novo no mapa.
  - A espécie do tile sai de uma função pura, tirada do `texturaDaVegetacao` do `WorldScene.ts`,
    que hoje sorteia por hash dentro da cena. A cena e o vento passam a chamar a mesma função.
  - O `data/vento.json` ganha `especies`: amplitude e velocidade relativas por espécie, e a
    `variacaoPorArvore` (a fração máxima de desvio por tile).
  - **Os números de partida são provisórios,** para o operador girar olhando:
    - juazeiro e umbuzeiro 1,0;
    - macambira 0,3;
    - mandacaru, facheiro e xique-xique 0,15.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A espécie é uma função pura** `especieDoTile(especiesCarregadas, gx, gy)`, testada por tabela.
     Para o mesmo conjunto de espécies carregadas, ela devolve o que o `texturaDaVegetacao` devolve
     hoje, e a cena passa a usá-la. Nenhum tile troca de espécie: o teste compara as duas num bloco
     de 128 × 128 antes da troca.
  2. **O cacto quase parado,** por tabela em `tests/D-TELA-CACTO-NO-VENTO.test.ts`. No mesmo tile e
     no mesmo tick, numa janela de 2 000 ticks, o maior deslocamento do mandacaru, do facheiro e do
     xique-xique é no máximo a fração do dado vezes o do juazeiro, e nunca passa da amplitude
     máxima.
  3. **Cada árvore do seu jeito:** dois tiles da mesma espécie têm período e amplitude diferentes,
     dentro da `variacaoPorArvore`. O desvio sai do hash do tile, e não de `Math.random()`.
  4. **O dado:** a regra `interface/vento` reprova uma espécie de `tree` do manifesto sem entrada em
     `especies`, uma entrada que não é espécie do manifesto, amplitude ou velocidade fora de (0, 1]
     e `variacaoPorArvore` fora de [0, 0,5), com um caso que reprova escrito no teste.
  5. **O roteiro `D-TELA-VENTO-VEGETACAO` ganha uma afirmação:** a ponte publica a espécie e o
     ângulo de cada árvore da vista, e, no tick capturado, nenhum cacto tem ângulo maior que a
     fração do dado vezes a amplitude máxima. A captura é aberta.
  6. **Não-regressão:** os roteiros `D-TELA-VENTO-VEGETACAO`, `F-SPR`, `F-REPL-e` e `ARTE-VILA` saem
     0. O `verify:rapido` passa, e o teste do vento, o `F-SPR-carregamento` e o `F17f-manifesto`
     passam rodados direto. `git diff main -- src/sim` vazio.
- **Depende da D-TELA-VENTO-NA-VISTA,** que mexe no mesmo trecho (`atualizarVento`). Entra depois
  dela, para não brigar no rebase.

#### D-TELA-CHAO-DA-CANA-SO-QUANDO-MUDA — O chão da cana só trabalha quando o tick ou a câmera mudam
- **Origem (2026-10-02, medida da D-TELA-CUSTO-DO-QUADRO):** o `atualizarChaoDaCana`
  (`WorldScene.ts`) varre todos os recursos do estado a cada quadro, mesmo pausado e sem nada
  mudando. Medido: cerca de 0,2 ms por quadro, a camada animada mais cara. A água e o vento já só
  trabalham quando o tick ou a câmera mudam. Vai no mesmo pacote da D-TELA-CACTO-NO-VENTO.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **O predicado puro** que decide se o chão da cana precisa ser refeito, por tabela em
     `tests/D-TELA-CHAO-DA-CANA-SO-QUANDO-MUDA.test.ts`:
     - com o tick e a vista iguais aos do quadro anterior, não precisa;
     - com o tick novo, precisa. Os recursos só mudam com o tick;
     - com só a vista nova, refaz só a contagem da vista, sem varrer os recursos;
     - no primeiro quadro, precisa.
  2. **O eixo determinístico:** a ponte publica `recursosVarridosPeloChao` por quadro. O roteiro
     `D-TELA-CUSTO-DO-QUADRO` afirma que ele é 0 com o jogo pausado e a câmera parada, e maior que 0
     no quadro de um tick novo.
  3. **A tela não muda:** o roteiro `D-ARTE-CHAO-DE-ROCA` continua afirmando que o chão desenhado é
     igual à cana na vista. Ele passa a afirmar também que isso vale depois de um `fixarCamera` sem
     tick novo (a contagem da vista acompanha a câmera).
  4. **A medida antes e depois** pelo roteiro do custo vai para o PROGRESS, como evidência da
     corrida, e não como asserção.
  5. **Não-regressão:** os roteiros `D-ARTE-CHAO-DE-ROCA`, `D-TELA-CUSTO-DO-QUADRO` e `ARTE-VILA`
     saem 0; o `verify:rapido` passa; `git diff main -- src/sim` vazio.

#### D-TELA-FUMACA-DA-PADARIA — A padaria trabalhando solta fumaça pela chaminé
- **Origem (2026-10-02):** é o caso C da prova de conceito (§7 e §23 do documento): "padaria
  produz fumaça somente quando apropriado". A F-VIVO-b deixou o encanamento: `quadroDaFumaca` em
  `src/render/trabalho.ts`, que só anda com o prédio trabalhando, e o ponto
  `ancoras.trabalho.fumaca`. **Medido na `main`:** o manifesto não tem entrada `fumaca` nem prédio
  com esse ponto, e por isso nenhuma fumaça aparece no jogo.
- **Escopo:** só render e manifesto. A fumaça é de **partículas**, no mesmo molde sem estado da
  poeira (D-TELA-POEIRA-AMBIENTE), levada pelo vento, sem arte pintada.
  - Se um dia o manifesto ganhar a entrada `fumaca` com quadros, o laço da F-VIVO-b continua
    valendo para quem a declarar, e as partículas são o caminho de quem não tem os quadros.
  - Só a padaria (`bakery`) ganha o ponto da chaminé. A forja e a fundição ficam para depois, com
    registro.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **O ponto:** a entrada `bakery` do manifesto declara `ancoras.trabalho.fumaca` na chaminé
     desenhada. O ponto é medido no PNG da padaria, e o `F17f-manifesto` continua passando.
  2. **A função pura** `particulasDaFumaca(config, vento, tick, alfa, ponto, trabalhandoDesde,
     parouEm)`, por tabela em `tests/D-TELA-FUMACA-DA-PADARIA.test.ts`:
     - as mesmas entradas dão a mesma saída;
     - sem trabalho, a lista é vazia;
     - nenhuma partícula nasce depois do `parouEm`, e todas somem até `parouEm + vidaTicks`. A
       fumaça se desfaz, e não some de uma vez;
     - a partícula sobe (o y diminui com a idade) e se desloca no sentido do vento;
     - o total é no máximo `maximoPorChamine`.
  3. **Quem diz se a padaria trabalha** é o mesmo predicado do `quadroDaFumaca`, e não um
     predicado novo. O `trabalhandoDesde` e o `parouEm` são memória de render por prédio (como a
     `vegetacaoDesenhada`), e não estado da sim.
  4. **O dado:** os números ficam em `data/fumaca.json`, só de render, com a regra
     `interface/fumaca` e um caso que reprova.
  5. **O roteiro `tools/shots/D-TELA-FUMACA-DA-PADARIA.js`,** sobre o save
     `saves/teste-operador-vila-pronta.txt`:
     - com a padaria trabalhando, a ponte publica as partículas dela, maior que 0, e a captura
       mostra a fumaça saindo da chaminé;
     - o roteiro pausa a padaria pelo painel (despausado, §8) e avança `vidaTicks` pela ponte;
     - as partículas dela chegam a 0, e a captura não mostra fumaça;
     - as duas capturas são abertas.
  6. **Não-regressão:** os roteiros `F-VIVO-b`, `D-TELA-POEIRA-AMBIENTE` e `ARTE-VILA` saem 0. O
     `verify:rapido` passa, e o `F17f-manifesto` e o `F-SPR-carregamento` passam rodados direto.
     `git diff main -- src/sim` vazio.
- **Depende da D-TELA-POEIRA-AMBIENTE:** reaproveita o pool e o hash dela.

#### D-TELA-EFEITOS-DO-TRABALHO — Lasca no machado e pó na pedreira
- **Origem (2026-10-02, pedido do operador; §15 do `docs/fase-animacao-vida-do-mundo.md`):** o
  efeito ligado ao trabalho real. Esta primeira entrega cobre dois casos: o lenhador cortando
  solta lasca de madeira, e o pedreiro na pedreira solta pó de pedra. A fagulha da forja vai na
  D-TELA-FUMACA-DA-FORJA, que espera os PNG novos.
- **Escopo:** só render. O efeito nasce no **tile de colheita** do especialista em `colhendo`
  (`src/sim/systems/especialistas.ts`: `fsmData.tarefa` → a tarefa do JobBoard → `origemTile`),
  lido do estado pela ponte, sem mudar a sim. As partículas seguem o molde sem estado da fumaça e
  da poeira (hash da semente, sem `Math.random()`, pool reaproveitado). A lasca cai em arco, e o
  pó sobe e se espalha com o vento.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A regra de quem emite** é uma função pura, por tabela: emite só o `woodcutter` e o
     `stonemason` em `colhendo` com tarefa de tile válida. A mesma unidade em `indo_colher` ou
     `voltando`, outro tipo em `colhendo` e uma tarefa sumida não emitem.
  2. **A função das partículas** `particulasDoTrabalho(config, vento, tick, alfa, emissor,
     colhendoDesde, parouEm)`, por tabela em `tests/D-TELA-EFEITOS-DO-TRABALHO.test.ts`:
     - as mesmas entradas dão a mesma saída;
     - nada nasce antes do `colhendoDesde` nem depois do `parouEm`, e tudo some até
       `parouEm + vidaTicks`;
     - a lasca desce depois de subir (o y passa por um mínimo), e o pó sobe e anda no sentido do
       vento;
     - o total por emissor é no máximo `maximoPorEmissor`;
     - o efeito tem ritmo: a emissão vem em pulsos a cada `intervaloDoGolpeTicks`, e não contínua.
  3. **O dado:** `data/efeitos-do-trabalho.json`, só de interface, por tipo (cor, vida, máximo,
     intervalo do golpe). A regra `interface/efeitos-do-trabalho` tem um caso que reprova por
     campo, e reprova também um tipo que não é unidade de `data/units.json`.
  4. **O desenho:** o pool é próprio e reaproveitado, e só redesenha quando o tick, o alfa ou a
     câmera mudam. O efeito só aparece na vista. A camada fica acima do chão e dos recursos, com o
     `depth` pelo pé do tile de colheita.
  5. **O roteiro `tools/shots/D-TELA-EFEITOS-DO-TRABALHO.js`:**
     - com uma partida montada pela sim no teste, como os outros cenários (lenhador e pedreiro
       ocupando a casa, com árvore e pedra ao alcance);
     - avança pela ponte até um lenhador em `colhendo`, e afirma partículas de lasca no tile dele;
     - faz o mesmo para o pedreiro com pó;
     - avança até o lenhador sair do `colhendo`, e afirma as partículas dele em 0 depois de
       `vidaTicks`;
     - um passo despausado (§8);
     - as capturas são abertas.
  6. **Não-regressão:**
     - os roteiros `F-REPL-e`, `F-T3`, `D-TELA-FUMACA-DA-PADARIA` e `ARTE-VILA` saem 0;
     - o `verify:rapido` passa, e os testes diretos da fumaça, da poeira e de manifesto passam;
     - `git diff main -- src/sim` vazio.

#### D-TELA-AGUA-PEIXE — Ondulação de peixe e o pescador mexendo a água
- **Origem (2026-10-02, pedido do operador; §9 do documento):** círculos ocasionais de peixe e a
  perturbação perto do pescador. A água já troca de variante pelo tick (D-TELA-AGUA-VIVA).
- **Escopo:** só render. Um anel que se abre e some (círculo desenhado, sem arte), em dois casos:
  - **peixe:** raro, num tile de `agua` da vista, com o tile e o tick por hash da semente. No
    máximo `maximoNaVista` de cada vez;
  - **pescador:** o `fisherman` em `colhendo` (o tile da tarefa, como na
    D-TELA-EFEITOS-DO-TRABALHO) abre anéis a cada `intervaloDoPescadorTicks`, enquanto colhe.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A função pura** `aneisDaAgua(config, tick, alfa, vista, ehAgua, pescadores)` em
     `src/render/agua-peixe.ts`, por tabela em `tests/D-TELA-AGUA-PEIXE.test.ts`:
     - as mesmas entradas dão a mesma saída;
     - todo anel está num tile em que `ehAgua` é verdadeiro;
     - o raio cresce e a opacidade cai com a idade, e o anel some em `vidaTicks`;
     - sem pescador, numa vista fixa de água, a fração de ticks com anel de peixe vai para o
       `test-output`, e numa janela de 4 × `intervaloDoPeixeTicks` há pelo menos um anel;
     - com um pescador em `colhendo`, há anel no tile dele a cada `intervaloDoPescadorTicks`; sem
       o `colhendo`, não há.
  2. **O dado:** `data/agua-peixe.json`, só de interface, com a regra `interface/agua-peixe` e um
     caso que reprova por campo.
  3. **O desenho:** pool próprio e reaproveitado, só na vista, e só redesenha quando o tick, o alfa
     ou a câmera mudam. O anel fica acima da água e da borda, e abaixo das unidades.
  4. **A água viva não muda:** o roteiro `D-TELA-AGUA-VIVA` continua com a variante de cada tile
     igual à da função pura.
  5. **O roteiro `tools/shots/D-TELA-AGUA-PEIXE.js`:**
     - na vista do açude, avança pela ponte até um anel de peixe e o captura;
     - com um pescador em `colhendo`, numa partida montada pela sim no teste, afirma o anel no
       tile dele e o captura;
     - o sha256 da captura do peixe é igual nas duas corridas;
     - um passo despausado (§8);
     - as capturas são abertas.
  6. **Não-regressão:**
     - os roteiros `D-TELA-AGUA-VIVA`, `F-T4a`, `D-TELA-POEIRA-AMBIENTE` e `ARTE-VILA` saem 0;
     - o `verify:rapido` passa, e o teste da água passa direto;
     - `git diff main -- src/sim` vazio.

#### D-TELA-FUMACA-DA-FORJA — Fumaça e fagulha na forja e na fundição
- **Origem (2026-10-02, pedido do operador):** a fumaça da padaria (D-TELA-FUMACA-DA-PADARIA)
  deixou de fora a forja (`iron_smithy`) e a fundição (`metallurgists`), e o §15 pede a fagulha
  na forja.
- **Depende dos PNG novos dos 17 prédios** (o PR `arte-17-predios`): o ponto da chaminé sai do
  PNG, e esses dois prédios estão no lote. **Só começa com o PR mergeado na `main`.**
- **Escopo:** só render e manifesto.
  - O `ancoras.trabalho.fumaca` é medido no PNG novo da `iron_smithy` e da `metallurgists`.
  - A fumaça reusa o `particulasDaFumaca` sem mudança.
  - A fagulha é uma segunda espécie de partícula da forja: pontos quentes que sobem rápido e
    somem cedo, em pulsos, só enquanto ela trabalha. A fagulha nasce no ponto do fogo, que é um
    ponto novo no manifesto, `ancoras.trabalho.fogo`, e a regra do manifesto ganha esse ponto.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **Os pontos:** a `iron_smithy` e a `metallurgists` declaram `trabalho.fumaca`, e a
     `iron_smithy` declara também `trabalho.fogo`. Os pontos são medidos no PNG (os pixels e a
     fração vão para o PROGRESS). O `F17f-manifesto` reprova um `fogo` que não é ponto, com um
     caso escrito no teste.
  2. **A fagulha** `particulasDaFagulha(config, tick, alfa, ponto, trabalhandoDesde, parouEm)`,
     pura, por tabela: as mesmas entradas dão a mesma saída; ela sobe; vive menos que a fumaça;
     vem em pulsos; não há nada sem trabalho; e tudo some até `parouEm + vidaTicks`.
  3. **Quem diz se trabalha** é o mesmo predicado do `quadroDaFumaca`, como na padaria.
  4. **O dado:** a fagulha fica em `data/fumaca.json` (um bloco `fagulha`), com a regra
     `interface/fumaca` estendida e um caso que reprova.
  5. **O roteiro `tools/shots/D-TELA-FUMACA-DA-FORJA.js`,** com uma forja e uma fundição
     trabalhando, montadas pela sim no teste como os outros cenários:
     - afirma fumaça nas duas e fagulha na forja;
     - pausa a forja pelo painel (despausado, §8) e afirma as duas em 0 depois da vida;
     - as capturas são abertas.
  6. **Não-regressão:**
     - os roteiros `D-TELA-FUMACA-DA-PADARIA`, `F-VIVO-b` e `ARTE-VILA` saem 0;
     - o `verify:rapido` passa, e o `F17f-manifesto`, o `F-SPR-carregamento`, o `C10-largura` e
       o `F-ESC-escala` passam direto;
     - `git diff main -- src/sim` vazio.

#### D-TELA-COSTURA-DOS-TILES — A tira de tiles ganha margem, e o filtro não puxa o vizinho
- **Origem (2026-10-02, captura do operador):** o chão aparece quadriculado. Há duas causas. A
  de arte é medida e está na D-ARTE-AGUA-GRAMA-SEM-EMENDA. **A de render é hipótese:** o jogo usa
  filtro linear (`pixelArt: false`, `src/render/game.ts`) e monta as tiras de tile coladas, sem
  margem (`addTilesetImage(..., tilePx, tilePx, 0, 0)` no `WorldScene.ts`). Com zoom fracionário,
  a amostragem puxa o pixel do tile vizinho da tira, e aparece uma costura na borda.
- **Escopo:** só render. Toda tira de tile do `WorldScene.ts` (o terreno, as bordas da água, da
  areia e da rocha, os detalhes, o chão da cana e os recursos) é montada com **margem e
  espaçamento** e com a borda de cada tile **duplicada para fora** (extrusão de 1 a 2 px). O
  `addTilesetImage` recebe a margem e o espaçamento certos. Os números da extrusão ficam num dado
  de render ou numa constante de tela comentada, como o `DEPTH_DOS_RECURSOS`.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A função pura de extrusão** (`src/render/extrusao-de-tira.ts`), testada em Node por tabela
     sobre uma tira sintética de 3 tiles de cores chapadas:
     - cada tile sai com a margem preenchida pela própria borda;
     - nenhum pixel de um tile vaza para a margem do outro;
     - a posição de cada tile na tira nova é a que o `addTilesetImage` espera com aquela margem e
       aquele espaçamento.
  2. **A medida da costura, antes e depois,** no roteiro novo `tools/shots/D-TELA-COSTURA-DOS-TILES.js`:
     - numa vista de areia pura (o tile que já emenda: borda 7,0 contra 5,6 no meio) e numa de
       água, nos zooms 1, 0,75 e 1,5;
     - mede, nas linhas e colunas de borda de tile da captura, a diferença média de cor contra as
       linhas vizinhas do meio. Os números de antes e depois vão para o
       `test-output/D-TELA-COSTURA-DOS-TILES.json` e para o PROGRESS;
     - **asserção no eixo determinístico:** com o zoom 1 e a câmera em pixel inteiro, a captura
       do depois é igual à do antes nas células internas. A extrusão não muda o interior de
       nenhum tile;
     - as capturas de zoom fracionário são abertas.
  3. **Nada some e nada se desloca:** os roteiros `F-T1`, `F-TR`, `ARTE-VILA`,
     `D-ARTE-CHAO-DE-ROCA`, `D-TELA-AGUA-VIVA` e `D-TELA-CUSTO-DO-QUADRO` saem 0. A água viva
     continua com a variante de cada tile igual à da função pura, e o chão da cana com a contagem
     igual à da cana na vista.
  4. **Não-regressão:** o `verify:rapido` passa, e os testes que leem o manifesto passam rodados
     direto. `git diff main -- src/sim` vazio.

#### D-ARTE-AGUA-GRAMA-SEM-EMENDA — A água e a grama refeitas para emendar
- **DESCARTADO (decisão do operador, 2026-10-03):** "essa areia ficou péssima, reverta para a grama
  anterior; a água também não resolveu; todo o trabalho dessas worktrees pode ser jogado fora". O
  operador vai produzir os sprites novos depois. A arte da D-ARTE-SOLO-CAATINGA foi revertida
  (`d37fbc3`), e a candidata da D-ARTE-AGUA-GRAMA-SEM-EMENDA foi apagada sem merge. A
  D-TELA-DECALQUES-DE-CAPIM fica sem arte e não entra na fila. A correção de render (a costura e o
  véu) continua na `main`.
- **Origem (medido em 2026-10-02):** a diferença de cor entre a borda esquerda e a direita do
  tile, contra a diferença entre duas colunas vizinhas do meio:
  - `agua.png` 11,1 contra 6,8;
  - `agua-v1.png` 15,9 contra 4,9;
  - `grama-D-v0.png` 18,9 contra 8,7;
  - `areia.png` 7,0 contra 5,6 (a referência do que emenda).

  A água repete também o mesmo detalhe no mesmo canto de todo tile. **Pedido do operador
  (2026-10-02):** regerar **só a grama e a água**, pelo Codex.
- **Escopo:** arte e manifesto.
  - Os 4 estados da `grama` (`padrao`, `v1`, `v2`, `v3`) e os 4 do miolo da `agua`. As 16
    bordas da água (`borda-m0` a `borda-m15`) **não** mudam.
  - O caminho é gerar uma textura grande e sem emenda de cada material e cortar dela 4 tiles de
    64×64 diferentes que emendam entre si, e não 4 rotações do mesmo recorte.
  - **A água é animada** (D-TELA-AGUA-VIVA, a variante troca pelo tick): os 4 tiles da água são
    quadros de uma mesma superfície, deslocada pouco a pouco. Nenhum pode piscar ou destoar.
- **Aceite (escrito antes da geração, 2026-10-02):**
  1. **A emenda, medida pela mesma conta:** em cada um dos 8 PNG novos, a diferença da borda
     esquerda × direita e da de cima × de baixo é no máximo **1,3 vez** a diferença entre duas
     colunas vizinhas do meio. E isso vale **entre pares**: a borda direita de qualquer tile
     contra a esquerda de qualquer outro do mesmo material (os 4 × 4 casos), e o mesmo na vertical.
     A conta e os números vão para o PROGRESS.
  2. **Sem detalhe repetido:** nenhum elemento marcante (bolha, pedra, tufo) cai na mesma posição
     em todos os tiles do material.
  3. **A água anima sem piscar:** a diferença média de cor entre dois quadros consecutivos da água
     é no máximo 1,5 vez a diferença entre colunas vizinhas do meio.
  4. **O estilo e a luz:** pelas skills (`skills/pianco-sprite-director/SKILL.md` e a especialidade
     que ela escolher), com a luz do `cdcfec5` (terreno é albedo, sem luz direcional pintada).
     Nenhum asset do jogo de 1998. As referências limpas da PR #1 valem: nenhuma folha com
     terreno ou sprite atual do jogo entra como referência de geração.
  5. **A base e o manifesto:** a base em `assets/base/terrain/`, e o derivado no **mesmo caminho e
     nome** dos PNG de hoje, para o manifesto só mudar a `origem` e a `licenca`. O registro (o
     prompt, as referências, os sha256 e as gerações gastas, **no máximo 4**) vai no
     `SKILL_BUILDER_PROGRESS.md` da worktree, e a nota da `origem` diz o caminho dele.
  6. **A folha de contato:** uma grade 6×6 de cada material com as 4 variantes misturadas, e a
     água ao lado da borda (as 16 bordas de hoje). É aberta e salva ao lado da base.
  7. **Na tela:** os roteiros `F-T1`, `D-TELA-AGUA-VIVA` e `ARTE-VILA` saem 0, e as capturas da
     água e da grama são abertas. Os testes de manifesto passam rodados direto.

#### D-TELA-VEU-DOS-DETALHES — O véu de tom por tile sai do terreno que tem arte
- **Origem (lido no código em 2026-10-02, pela captura do operador no zoom 2x):** o
  `criarTexturaDeDetalhesDoTerreno` (`WorldScene.ts`) pinta, em cada célula de detalhe, um
  retângulo do tamanho do tile inteiro (`fillRect` com 4,5% de opacidade) que alterna entre o tom
  claro e o escuro do tema, mais um padrão fixo (`onda`, `capim` e outros). O
  `criarCamadaDeDetalhesDoTerreno` sorteia esse véu em `densidade` dos tiles: 55% da água e 38%
  da grama. O resultado é um tom diferente a cada quadrado, o xadrez, qualquer que seja o PNG por
  baixo. A camada é anterior à arte de terreno (F-T1) e serve ao placeholder de cor chapada.
- **Escopo:** só render. O terreno que tem arte carregada no manifesto (o mesmo predicado que já
  troca a cor chapada pela textura em `criarTexturaDeTerreno`) não recebe célula de detalhe. O
  terreno sem arte continua como hoje.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A regra pura** `terrenoRecebeDetalhe(tipo, temArte)`, por tabela: com arte não recebe, sem
     arte recebe. A cena e o teste chamam a mesma função, e a camada lê a lista de tipos com arte
     do mesmo lugar que a tira de terreno.
  2. **A ponte publica `detalhesDoTerrenoPorTipo`,** a contagem de células da camada por tipo. Com o
     manifesto de hoje, a `agua` e a `grama` dão 0. Um tipo sem arte, num manifesto sintético do
     teste, continua com células.
  3. **A medida na tela** (o roteiro novo `tools/shots/D-TELA-VEU-DOS-DETALHES.js`), na vista do
     açude e numa de grama, nos zooms 1 e 2:
     - a diferença média de cor entre o centro de tiles vizinhos do mesmo terreno vai para o
       `test-output` e para o PROGRESS, antes e depois;
     - as capturas são abertas.
  4. **Não-regressão:** os roteiros `F-T1`, `F-TR`, `D-TELA-COSTURA-DOS-TILES`, `D-TELA-AGUA-VIVA`
     e `ARTE-VILA` saem 0; o `verify:rapido` passa; `git diff main -- src/sim` vazio.

#### D-ARTE-SOLO-CAATINGA — O chão da caatinga no começo da seca e os decalques de capim
- **DESCARTADO (decisão do operador, 2026-10-03):** "essa areia ficou péssima, reverta para a grama
  anterior; a água também não resolveu; todo o trabalho dessas worktrees pode ser jogado fora". O
  operador vai produzir os sprites novos depois. A arte da D-ARTE-SOLO-CAATINGA foi revertida
  (`d37fbc3`), e a candidata da D-ARTE-AGUA-GRAMA-SEM-EMENDA foi apagada sem merge. A
  D-TELA-DECALQUES-DE-CAPIM fica sem arte e não entra na fila. A correção de render (a costura e o
  véu) continua na `main`.
- **REABERTO SÓ O SOLO, GERAÇÃO 1 (decisão do operador, 2026-10-03; aceite antes da aplicação).**
  O operador escolheu na pasta de candidatos a `generation-01-raw.png`
  (`D:\projetos-pessoal\cangaco-game-candidatos\arte\D\solo-caatinga\`), que tinha reprovado
  por emenda 1,33 e textura acima do limite de neutralidade. **A neutralidade (aceite 1, segunda
  parte) fica dispensada por ele:** a textura é a que ele quer. Os capins e a água continuam
  descartados.
  - **Aceite:**
    1. os 4 estados da `grama`, nos mesmos caminhos, recortados da geração 1 reduzida sem
       suavização. A pior emenda entre todo par de tiles, nos dois sentidos, é ≤ 1,3 vez o meio;
    2. a base em `assets/base/terrain/` e a `origem` e a `licenca` da `grama` no manifesto, com o
       sha256 do bruto, a redução e os recortes na nota. Nada mais muda no manifesto;
    3. os testes de manifesto passam, e os roteiros `F-T1` e `ARTE-VILA` saem 0, com a captura da
       vila aberta.
- **Pedido do operador (2026-10-02):** a grama verde-oliva da D-ARTE-AGUA-GRAMA-SEM-EMENDA está
  **reprovada como direção**. O chão é solo de caatinga no começo da seca, sem tufos destacados. A
  vida vem de pequenos decalques independentes de capim, palha e verde-oliva, espalhados pelo
  render (D-TELA-DECALQUES-DE-CAPIM), e não pintados no tile.
- **Escopo:** arte e manifesto.
  - **O solo:** os 4 estados da `grama` (`grama-D-v0` a `v3`, mesmos caminhos e nomes). É terra
    clara de caatinga, com grão fino, poucas manchas de terra mais escura e algum resto de folha
    seca miúda, sem tufo, pedra ou elemento que chame o olho. O id continua `grama`, porque mudar
    o id é mexer no mapa e na sim.
  - **Os decalques:** uma entrada nova no manifesto, `capim`, do tipo `vegetacao`, sem
    `vegetacaoQueBalanca` por enquanto, com 8 a 12 estados (`palha-1`… e `oliva-1`…), PNG
    transparentes de 16 a 32 px de largura, anchor `[0.5, 1]`. São tufos baixos, vistos de cima
    em 3/4, com a luz do `cdcfec5`.
- **Aceite (escrito antes da geração, 2026-10-02):**
  1. **O solo emenda,** pela conta da D-ARTE-AGUA-GRAMA-SEM-EMENDA: a borda de cada tile e a de
     todo par de tiles difere no máximo 1,3 vez o meio. **E o solo é neutro:** o desvio padrão da
     luminância de cada tile é no máximo o da `areia.png` de hoje × 1,5, e nenhum elemento
     marcante repete na mesma posição.
  2. **Os decalques:** fundo transparente de verdade (o canto e a borda com alfa 0), o pé na linha
     de baixo, no máximo 32 px de largura, metade palha e metade verde-oliva. O validador da
     `pianco-sprite-tools` passa em todos.
  3. **A folha de contato:** o solo em grade 6×6 com os decalques espalhados por cima, a 30% de
     densidade, nos zooms 0,5, 1 e 2, ao lado da `areia` e da água de hoje. É aberta e salva ao lado
     da base.
  4. **As regras de arte:** as skills, a luz do `cdcfec5` (o solo é albedo, e o decalque tem
     volume com a luz de cima), as referências limpas da PR #1, nenhum asset do jogo de 1998, e a
     base em `assets/base/terrain/` e `assets/base/vegetation/capim/`. No máximo **4 gerações**
     para o solo e os decalques juntos, registradas no `SKILL_BUILDER_PROGRESS.md`.
  5. **O manifesto e os testes:** só a `origem` e a `licenca` da `grama` mudam, e a entrada `capim`
     é nova. O `F17f-manifesto` e o `F-SPR-carregamento` passam, e o `capim` como `vegetacao`
     precisa ser um recurso do mapa ou uma regra nova no `F-SPR`. Se o `F-SPR` reprovar o
     `capim` por não ser recurso do mapa, **PARE e reporte**: a forma do decalque no manifesto é
     decisão da D-TELA-DECALQUES-DE-CAPIM, e não se contorna afrouxando o teste.
  6. **Na tela:** `F-T1` e `ARTE-VILA` saem 0, e a captura da grama é aberta.
- **Emenda do aceite 5 (2026-10-02, antes da geração; o Codex parou no bloqueio previsto):** o
  `tests/F-SPR-carregamento.test.ts:79` exige que toda `vegetacao` do manifesto seja recurso do
  mapa, e o `capim` não é. A forma decidida é **um tipo de camada novo, `decalque`**, e não uma
  `vegetacao`:
  - `TIPOS_DE_CAMADA` (`src/render/manifesto.ts`) ganha `decalque`. O render ainda não desenha esse
    tipo, porque isso é a D-TELA-DECALQUES-DE-CAPIM, e o tipo só existe para o manifesto e o
    validador;
  - a regra do `F-SPR` para `decalque`: o id **não** precisa ser recurso do mapa; todo estado aponta
    um PNG que existe; o anchor é `[0.5, 1]`. Cada regra tem um caso que reprova num manifesto
    sintético, e a regra de `vegetacao` continua igual (o caso `capim` como `vegetacao` continua
    reprovando);
  - a entrada fica `{ "id": "capim", "tipo": "decalque", ... }`, com os oito campos do §9.

  O resto do aceite não muda. Isso é código em `src/render/manifesto.ts` e no teste, permitido nesta
  entrega por esta emenda.

#### D-TELA-DECALQUES-DE-CAPIM — O render espalha os decalques de capim pelo chão
- **DESCARTADO (decisão do operador, 2026-10-03):** "essa areia ficou péssima, reverta para a grama
  anterior; a água também não resolveu; todo o trabalho dessas worktrees pode ser jogado fora". O
  operador vai produzir os sprites novos depois. A arte da D-ARTE-SOLO-CAATINGA foi revertida
  (`d37fbc3`), e a candidata da D-ARTE-AGUA-GRAMA-SEM-EMENDA foi apagada sem merge. A
  D-TELA-DECALQUES-DE-CAPIM fica sem arte e não entra na fila. A correção de render (a costura e o
  véu) continua na `main`.
- **Depende da D-ARTE-SOLO-CAATINGA.** O aceite entra num commit próprio quando a arte estiver na
  `main`, porque a forma da entrada `capim` no manifesto e a densidade dependem dela. Fica
  registrado o escopo: só render, por hash do tile e da semente, várias por tile, com posição,
  giro e escala variando, sem grade, só na vista, só em `grama`, sem cobrir estrada, prédio nem
  recurso, densidade em dado de render e pool reaproveitado.

#### D-TELA-SERRA-POR-LAJEDO — A serra contínua desenhada uma vez por lajedo, baixando com a lavra
- **Decisão do operador (2026-10-03):** a arte aprovada é a `piloto-serra-continua-2026-10-02`
  (`D:\projetos-pessoal\cangaco-game-candidatos\arte\D\rock\piloto-serra-continua-2026-10-02\`),
  e a integração é a **opção A**:
  - uma formação por lajedo;
  - o estado pela fração lavrada do lajedo inteiro;
  - a pedreira continua lavrando tile a tile.

  O operador aprovou com as ressalvas registradas pela noru: entulho nas frentes, parede central
  quase reta, degraus no remanescente e 2 de 5 estados reprovados no validador de luz.
- **A arte (medida em 2026-10-03):** 5 estados de uma formação inteira (`intacta`,
  `frente-esquerda`, `duas-frentes`, `remanescente` e `quase-esgotada`), cada um em `<estado>/rock-1x.png`
  de 256×256 (master `rock-master-2x.png` de 512×512), pivô `[0.5, 1]`. A formação ocupa a largura
  toda do quadro: 256 px = 4 tiles. O esgotado é o chão sem pedra, sem sprite.
- **O mapa (medido):** 49 lajedos de `rock` (componentes 4-conexos). São 26 tiles soltos, e os
  maiores ficam entre 5×9 e 8×8.
- **Escopo:** arte, manifesto e render. **Nada em `src/sim/`,** nem no gerador de mapa, nem em número
  de `data/` que a sim leia.
- **Aceite (escrito antes do código, 2026-10-03):**
  1. **A arte no repositório:**
     - os 5 derivados em `assets/sprites/rock-serra/<estado>.png`;
     - os 5 masters e o bruto `generation-01-raw.png` em `assets/base/rock-serra/`, com o sha256 de
       cada um;
     - uma entrada nova no manifesto, `{ "id": "serra", "tipo": "formacao" }`, com os oito campos do
       §9, os 5 estados, a licença "aprovada pelo operador em 2026-10-03" e as ressalvas na nota.
  2. **O tipo de camada `formacao`:** entra em `TIPOS_DE_CAMADA` (`src/render/manifesto.ts`). A regra
     dele no `tests/F-SPR-carregamento.test.ts`: o id **não** precisa ser recurso do mapa, todo
     estado aponta um PNG que existe e o anchor é `[0.5, 1]`. Cada regra tem um caso que reprova
     num manifesto sintético, e as regras de `vegetacao` e de `recurso` não mudam.
  3. **As funções puras** (num arquivo novo de `src/render/`), por tabela, em
     `tests/D-TELA-SERRA-POR-LAJEDO.test.ts`:
     - `lajedosDoEstado(recursos)`: os componentes 4-conexos de tiles `rock`, **contando também os de
       quantidade 0**, para a identidade do lajedo não mudar com a lavra. Cada um sai com id
       estável, tiles, caixa e a soma restante;
     - `estadoDaSerra(restante, total, limiares)`: o total é o número de tiles × o
       `rendimentoPorTile` lido do dado do recurso (`data/resources.json`, sem número digitado).
       Os limiares, decrescentes, ficam em `data/serra.json`: acima do 1º, `intacta`; depois
       `frente-esquerda`, `duas-frentes`, `remanescente` e `quase-esgotada`; em 0, nenhum sprite;
     - `serraDoLajedo(lajedo, config)`: só lajedo com pelo menos `minimoDeTiles` (dado) recebe a
       serra. O pé fica no meio da borda de baixo da caixa do lajedo, e a escala é a largura da
       caixa ÷ 4 tiles, presa entre `escalaMinima` e `escalaMaxima` (dado);
     - a tabela cobre: um lajedo cheio (intacta), cada limiar, um esgotado (sem sprite), um abaixo
       do mínimo (sem serra) e dois lajedos vizinhos separados por um tile não `rock` (dois ids).
  4. **O desenho:**
     - o lajedo com serra **não** desenha mais o sprite de rocha por tile nem o marcador de esgotado
       dos seus tiles. O lajedo abaixo do mínimo continua exatamente como hoje (as 16 máscaras);
     - a serra é um sprite por lajedo, reaproveitado, com o `depth` pelo pé. Ela só é recalculada
       quando os recursos mudam (o tick), e só na vista;
     - a ponte publica `serrasDesenhadas` (o id, o estado, a fração e a escala de cada uma).
  5. **`data/serra.json`** é dado de interface (`ARQUIVOS_DA_INTERFACE`), com a regra
     `interface/serra`. Ela reprova limiares que não são decrescentes ou que estão fora de (0, 1),
     `minimoDeTiles` < 1 e `escalaMinima` > `escalaMaxima`, cada uma com um caso que reprova.
  6. **O roteiro `tools/shots/D-TELA-SERRA-POR-LAJEDO.js`:** o teste grava um save montado pela sim,
     como os outros cenários, com os lajedos do mapa em frações diferentes de quantidade (um em
     cada estado e um esgotado). O roteiro carrega o save, põe a câmera pela ponte sobre cada um e
     afirma o `estado` publicado contra a função pura. As capturas são abertas, e há um passo
     despausado (§8).
- **Emenda do aceite 3 (2026-10-03, antes do código; achado do Codex, conferido no código):** o
  `rock` tem regime `nunca` (`data/resources.json`), e o tile esgotado **sai do estado**
  (`src/sim/recursos.ts:531`, `delete recursos[chaveDoTile]`). Por isso o `lajedosDoEstado` não
  consegue achar os tiles já lavrados, e o lajedo encolheria e mudaria de identidade com a lavra. A
  troca:
  - **a forma do lajedo vem do mapa inicial,** e não do estado. São os tiles `rock` de
    `recursosIniciais()` (`src/sim/recursos.ts:57`), que é a mesma fonte que semeia o estado no
    começo da partida, lidos pela fronteira do render com a sim (`src/render/mapa.ts`, que já
    importa `sim/`). Os componentes 4-conexos desses tiles dão o id, os tiles e a caixa, que nunca
    mudam;
  - **a quantidade vem do estado:** o restante do lajedo é a soma de `state.recursos` nos tiles
    dele, e um tile ausente conta 0;
  - a função vira `lajedosDoMapa(recursosIniciais)`, que é memoizável porque o mapa não muda, mais
    `restanteDoLajedo(lajedo, recursos)`. A tabela do aceite 3 ganha o caso "tile lavrado até o fim
    some do estado, e o lajedo mantém o id, a caixa e o total". O resto do aceite não muda, e a sim
    continua intocada.
  7. **Não-regressão:**
     - os roteiros `F-TR`, `ARTE-VILA`, `D-SAVE-VILA-PRONTA` e `F-T1` saem 0;
     - **se o `F-TR` (as máscaras do lajedo) reprovar porque o lajedo da vista ganhou a serra,** a
       asserção dele passa a valer para os lajedos abaixo do mínimo, e para os outros ela afirma a
       serra. A asserção nova fica mais estrita, e não só diferente. A troca e o motivo vão para o
       PROGRESS;
     - o `verify:rapido` passa, e os testes que leem o manifesto passam rodados direto;
     - `git diff main -- src/sim tools/gerar-mapa.js data/maps` vazio.

#### D-TELA-LIMPEZA-DO-MUNDO-VIVO — Três ressalvas das revisões de 2026-10-02
- **Origem:** as ressalvas das revisões da sessão Claude no PROGRESS de 2026-10-02. Vai no mesmo
  pacote do `verify-rapido-dado-lido` (abaixo), por decisão do operador.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **O pool da fumaça da padaria demolida é destruído,** e não só escondido. A ponte publica o
     `poolDaFumaca` (já existe). Um teste da regra pura que decide quais chaminés sobram (o
     conjunto de ids de prédio presentes) prova que a chaminé de um prédio que saiu é removida. O
     roteiro `D-TELA-FUMACA-DA-PADARIA` ganha um passo: ele demole a padaria pela ponte de
     comando ou pelo painel (despausado, §8) e afirma que o `poolDaFumaca` cai.
  2. **O teste do cacto fica mais leve:** a guarda de equivalência da espécie (o
     `tests/helpers/textura-da-vegetacao-antes-cacto.txt` compilado com `transpileModule` e
     `new Function`) é trocada por uma **tabela fixa**: os ids de tile e a espécie esperada num
     bloco de 16 × 16, para o conjunto completo de espécies e para dois subconjuntos. A tabela é
     gerada uma vez pela função atual e conferida. O helper `.txt` sai. **A guarda tem de acusar:**
     com o hash trocado, o teste novo reprova (prova da sessão, registrada no PROGRESS).
  3. **O chão da cana na troca de partida:** o predicado `quadroDoChaoDaCanaMudou` recebe também
     uma identidade da partida. Uma partida carregada no mesmo tick, sem recriar a cena, varre os
     recursos de novo. O caso "mesmo tick, partida nova" entra na tabela do
     `tests/D-TELA-CHAO-DA-CANA-SO-QUANDO-MUDA.test.ts`. A identidade é a referência do estado
     carregado ou um contador de carga da ponte, e não um campo novo na sim.
  4. **Não-regressão:**
     - os roteiros `D-TELA-FUMACA-DA-PADARIA`, `D-TELA-VENTO-VEGETACAO`, `D-ARTE-CHAO-DE-ROCA` e
       `D-SAVE-VILA-PRONTA` saem 0;
     - o `verify:rapido` passa;
     - `git diff main -- src/sim` vazio.

#### verify-rapido-dado-lido — O `verify:rapido` roda os testes que leem o dado alterado
- **Origem (medido em 2026-10-02):** a `main` ficou vermelha no `254fe78`. O commit mudou só o
  `assets/manifest.json`. O `vitest related` segue import, e o `tests/F-SPR-carregamento.test.ts`
  lê o manifesto por `readFileSync`, então não entrou na corrida. Aprovado pelo operador em
  2026-10-02. Vai no pacote da D-TELA-LIMPEZA-DO-MUNDO-VIVO.
- **Escopo:** só `scripts/verify-rapido.js` (e um módulo puro em `tools/`, se convier) e o teste
  dos portões. Quando a lista de arquivos alterados (a mesma de hoje: a árvore mais os commits que
  não subiram) tem um arquivo de dado (`assets/manifest.json`, `data/**/*.json` ou
  `saves/*.txt`), o `verify:rapido` acrescenta à lista do `vitest related` os testes cujo fonte
  cita o caminho desse arquivo.
  - É uma busca de texto no fonte do teste, e por isso **a guarda é estrutural do lado do
    resultado:** o teste afirma por comportamento quais testes rodam, e não varre a regra.
  - **Nenhum teste deixa de rodar** em relação a hoje: a lista só cresce.
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A regra pura** `testesQueLeemDado(arquivosAlterados, fontesDosTestes)`, por tabela:
     - o manifesto alterado acha o `F-SPR-carregamento` e o `F17f-manifesto` de um conjunto de
       fontes de teste escrito na tabela;
     - um `data/x.json` acha o teste que cita `data/x.json`, e não o que cita `data/y.json`;
     - um arquivo que não é dado não acrescenta nada;
     - um teste citado por dois dados aparece uma vez.
  2. **Como processo,** no repositório falso do `tests/PORTOES-pre-push.test.ts` (com o vitest
     falso do `CANGACO_VITEST`): um commit que muda só o `assets/manifest.json` faz o vitest falso
     receber o teste que lê o manifesto. Hoje, ele não receberia nada.
  3. **O caso que fez a `main` ficar vermelha, reproduzido:** com o `vitest related` sozinho, o
     teste do manifesto não entra; com a regra nova, entra. Os dois lados são afirmados.
  4. **O selo e o hook não mudam:** os testes de `PORTOES-verify` e `PORTOES-pre-push` passam sem
     alteração de asserção.
  5. **Número da corrida no PROGRESS:** quantos testes o `verify:rapido` roda num commit só de
     manifesto, antes e depois.

#### D-ARTE-BANDEIRA-FACCAO — A bandeira do bando balança no vento
- **Escopo (o aceite entra num commit próprio antes do código):** a bandeira de facção (§13 do
  documento) na cor do bando (`render/cor-do-bando.ts`), balançando com o mesmo vento. **Precisa
  de arte**, e a técnica (quadros pintados ou deformação procedural) espera a ferramenta que o
  operador está escolhendo. Depende da D-TELA-VENTO-VEGETACAO.
- **Escopo fechado (2026-10-02, pedido do operador: "providenciar"; antes do código):** sem arte.
  A bandeira que já existe (`desenharBandeira`, `WorldScene.ts`, C-IA-03c: um mastro e um
  retângulo na cor do bando) ganha o **pano ondulando** por deformação procedural. O pano vira
  uma tira de N segmentos (um polígono), cujo deslocamento vertical sai de uma onda que corre do
  mastro para a ponta, com a força, a direção e a rajada do vento (`src/render/vento.ts`). O
  mastro não se mexe. Quando a arte vier, ela substitui o polígono, e a onda continua sendo a
  mesma função. O id continua `D-ARTE-BANDEIRA-FACCAO` (item antigo não se renomeia).
- **Aceite (escrito antes do código, 2026-10-02):**
  1. **A função pura** `panoDaBandeira(vento, config, tick, alfa, gx, gy)` em
     `src/render/bandeira.ts` devolve os vértices do pano relativos ao mastro. Por tabela em
     `tests/D-ARTE-BANDEIRA-FACCAO.test.ts`:
     - as mesmas entradas dão a mesma saída;
     - o vértice preso ao mastro tem deslocamento 0 em todo tick;
     - a amplitude cresce do mastro para a ponta, e nunca passa de `amplitudeMaximaPx` do dado;
     - com `forca` 0, o pano é o retângulo de hoje (os vértices, com tolerância de 1e-9);
     - na rajada, a amplitude da ponta é maior que fora dela, no mesmo tile;
     - duas bandeiras em tiles diferentes não ondulam em fase (pelo hash do tile).
  2. **O dado:** `data/bandeira.json`, só de interface, com segmentos, amplitude, comprimento de
     onda e velocidade. A regra `interface/bandeira` tem um caso que reprova para cada campo.
  3. **A cor e o dono não mudam:** o pano continua com `corDoBando(lado)`, e o `debug` do dono da
     C-IA-03c continua igual. Os testes e o roteiro da C-IA-03c saem 0.
  4. **Só trabalha quando muda:** a bandeira só é redesenhada quando o tick, o alfa ou a câmera
     mudam, e só a da vista. A ponte publica `bandeirasRedesenhadas` por quadro, e o roteiro afirma
     0 com o jogo pausado e a câmera parada.
  5. **O roteiro `tools/shots/D-ARTE-BANDEIRA-FACCAO.js`:**
     - sobre o save `saves/teste-operador-vila-pronta.txt`, com uma bandeira de cada lado na
       vista, se couber; senão, uma vista por lado;
     - capturas no tick T e no T + 5;
     - o sha256 do tick T é igual nas duas corridas;
     - um passo despausado (§8);
     - as capturas são abertas.
  6. **Não-regressão:**
     - os roteiros `C-IA-03c`, `ARTE-VILA` e `D-TELA-07` (a placa de pausado convive com a
       bandeira) saem 0;
     - o `verify:rapido` passa, e os testes diretos do vento e de manifesto passam;
     - `git diff main -- src/sim` vazio.

### Leva 1 da animação direcional: legibilidade da logística (aprovada pelo operador, 2026-10-01)
Plano: `docs/planos/2026-09-30-animacao-direcional-de-unidades.md`, §3 e §10. **Só a Leva 1 foi
aprovada**: o piloto do serf (Leva 2) e o resto esperam. As siglas são as do plano, citadas pelo
operador no pedido, e o `git grep` na `main` não acha nenhuma delas. **Só render**: nada em
`src/sim/` nem em número de `data/`.
- **O que já existe (conferido na `main`):** a carga sobre a unidade é texto com o nome do tema
  (BUG-O, `src/render/rotulo-da-carga.ts`, `unidades.ts:300-303`). A pilha da F-VIVO-a desenha PNG
  `pilha` ou quadrado com a cor do tema (`WorldScene.ts:1811-1813`, `:1918-1931`), e o manifesto
  não tem nenhuma entrada `tipo: "pilha"`. Ícone de mercadoria não aparece no mundo, e o manifesto
  não tem `icones.mercadorias`.
- **Perguntas do §12 do plano que tocam a Leva 1. Não foram decididas; a parte afetada fica como está:**
  - a 2 (carga sem ícone: texto ou quadrado): a mercadoria sem ícone continua com o texto de hoje,
    sem nenhuma mudança. A troca pelo quadrado espera o operador;
  - a 4 (o armazém mostra pilha?): as pilhas do armazém (F-VIVO-a) não mudam de lugar nem de
    número. A cadeia de textura nova vale onde a pilha já existe.

#### D-ARTE-01 — O manifesto aponta os ícones de mercadoria que já existem
- **Escopo:** `assets/manifest.json` ganha `icones.mercadorias`, nos mesmos quatro campos do
  `icones.hud` (`arquivo`, `tamanho`, `licenca` e `origem`). São as 8 mercadorias do §2 do plano,
  cada uma apontando para um arquivo que já existe: `timber` (`sprites/ui/hud-timber.png`),
  `stone` (`sprites/ui/hud-stone.png`), `gold` (`sprites/ui/hud-gold.png`), e `corn`, `fish`,
  `coal`, `iron_ore` e `gold_ore` (`sprites/resources/<id>.png`). Nenhum PNG novo.
- **Aceite (escrito antes do código):** `tests/F17f-manifesto.test.ts` valida o
  `icones.mercadorias` do manifesto real com uma regra pura de `src/render/`:
  1. todo id é mercadoria de `economia.mercadorias`;
  2. todo arquivo existe, e o `tamanho` é o do cabeçalho do PNG;
  3. cada regra tem um caso que reprova, num manifesto escrito no teste (id que não é mercadoria;
     arquivo que não existe; tamanho errado);
  4. são exatamente as 8 do escopo.

#### D-TELA-03a — O serf mostra o ícone da mercadoria que carrega
- **Escopo:** a cadeia do que se desenha sobre a unidade com carga: (1) o ícone da mercadoria
  (D-ARTE-01), quando o manifesto o declara e o loader o trouxe; (2) senão, o texto de hoje (BUG-O).
  Nenhuma carga some. A função pura `marcaDaCarga` (`src/render/icone-da-mercadoria.ts`) devolve
  `{ como: 'icone', chave }` ou `{ como: 'texto', rotulo }`. O `preload` enfileira os ícones na chave
  `icone:<mercadoria>:mercadoria`.
- **Aceite (escrito antes do código):**
  1. `tests/D-TELA-03-icones.test.ts`: as 8 com ícone dão `icone`; as outras 18 dão `texto`, com o
     nome do tema; ícone declarado e não carregado dá `texto`; o loader enfileira um ícone por
     arquivo resolvido, e nenhum sem ele;
  2. não-regressão: `tests/BUG-O-rotulo-da-carga.test.ts` continua afirmando que toda mercadoria tem
     nome, e o roteiro `C-COMIDA-01d` (o pão como "Cuscuz") sai 0. A ponte ganha `marcaDaCarga` por
     unidade (`icone` | `texto` | null), e o `rotuloDaCarga` continua sendo o nome do tema;
  3. roteiro `tools/shots/D-TELA-03.js`, sobre a partida que `tests/D-TELA-03-logistica.test.ts`
     grava (a oficina de armas com 3 machados na saída e a entrada vazia; o quartel ligado a ela por
     rua; nenhum machado no armazém). Um passo com o jogo andando (§8), e depois o relógio pela
     ponte. O serf com tábua tem `marcaDaCarga` `icone`. O serf que leva o machado da oficina ao
     quartel tem `texto`, com o nome do tema. As capturas são abertas;
  4. o teste da partida afirma, pelo `step`, que a tábua chega à oficina e que o machado sai dela,
     para o roteiro não esperar o que nunca chega.
- **Troca do roteiro do plano:** o plano pedia "um serf com tábua e um com farinha". O operador
  pediu um serf levando arma da oficina ao quartel. A partida da oficina cobre os dois degraus: a
  tábua (com ícone) e o machado (sem ícone, texto). Por isso a farinha sai.

#### D-TELA-03b — A pilha de estoque da casa usa o ícone da mercadoria
- **Escopo:** a pilha da F-VIVO-a muda só a textura, nesta ordem: o PNG `pilha` da mercadoria, o
  ícone dela (D-ARTE-01), o quadrado com a cor do tema. A posição, o teto 5 e o 3 + 2 não mudam. A
  função pura é `fonteDaPilha` (`src/render/icone-da-mercadoria.ts`). A ponte ganha `fonte`
  (`pilha` | `icone` | `quadrado`) por pilha, e o `sprite` continua querendo dizer "PNG `pilha`".
- **Aceite (escrito antes do código):**
  1. `tests/D-TELA-03-icones.test.ts`, a cadeia nos três degraus: com PNG `pilha`, ele vence o
     ícone; sem PNG, o ícone; sem os dois, o quadrado (a mercadoria sem ícone, e o ícone não
     carregado);
  2. os testes da F-VIVO-a continuam verdes, e o roteiro `F-VIVO-a` sai 0;
  3. o roteiro `tools/shots/D-TELA-03.js` (o pedido do operador): a pilha de machado da oficina
     abre com 3 e é `quadrado`. Quando o serf retira um machado, ela cai para 2 no mesmo tick em
     que ele aparece com a carga. A tábua entregue na entrada da oficina vira pilha com `icone`. As
     capturas são abertas;
  4. **troca do roteiro do plano:** a pedreira e o moinho saem. A oficina cobre os dois degraus da
     tela (o ícone e o quadrado), e o degrau do PNG `pilha` fica no teste puro, porque o manifesto
     não tem nenhuma pilha desenhada.
- **ENTREGUES (2026-10-01), a D-TELA-03a e a D-TELA-03b, num commit de código só.** O arquivo puro, o
  `preload` e o roteiro são comuns aos dois; os aceites foram em commits separados, antes.
  - **A placa sob o ícone (decisão de apresentação, pela medida):** a primeira captura mostrou o
    ícone do HUD sumindo. Ele é traço creme (média RGB 233, 213, 167, feito para o painel escuro):
    desaparece na camisa branca do serf, e na grama vira borrão. O ícone passa a ir sobre uma placa
    escura (`COR_DA_PLACA_DO_ICONE`, a mesma `#2c1d12` do fundo do texto da carga e do contorno do
    quadrado), na carga e na pilha. A segunda captura lê a tábua no serf e nas pilhas.
  - **Para o operador ver jogando:** as quatro pilhas do armazém (F-VIVO-a) também passaram a
    mostrar o ícone (tábua, pedra e ouro), e não mais o quadrado de cor.

### Leva 2 da animação direcional: o piloto do serf, só o código (pedido do operador, 2026-10-02)
Plano: `docs/planos/2026-09-30-animacao-direcional-de-unidades.md`, §5 e §10 (Leva 2). O operador
pediu para "providenciar" a Leva 2 sem esperar a arte pintada: o encanamento é provado com
**sprites de depuração** e fica pronto para quando a arte do serf (D-ARTE-SERF-ANDAR) chegar.
- **Decisões aplicadas (as perguntas do §12 do plano que tocam esta leva, resolvidas pela
  proposta do próprio plano, com o pedido do operador de seguir):**
  - o walk tem **8 quadros**, como a decisão do operador para a arte do serf (D-ARTE-SERF-ANDAR,
    2026-10-01). Não há atlas de walk 12;
  - a virada é **um degrau de 45° a cada 70 ms em 1x** (a de 180° gasta ~210 ms), pelo tempo de
    jogo (§5.3 e §5.5);
  - os **sprites de depuração vão para o git** em `assets/depuracao/` (§12, pergunta 3), porque o
    roteiro precisa deles e o gerador não roda no `verify`.

  Se o operador mudar qualquer uma, ela vira emenda do aceite antes do código.
- **Só render e ferramenta.** Nada em `src/sim/` nem em número de `data/` que a sim leia. O serf
  continua com o placeholder ou com a arte parada no jogo normal: o atlas de depuração só entra
  com `?depuracao` ou na vitrine.

#### D-ARTE-02 — O gerador e o atlas de depuração do serf
- **Aceite (escrito antes do código, 2026-10-02):** `tools/gerar-sprites-depuracao.js` gera, a
  partir de formas desenhadas pelo próprio script (sem arte), o atlas
  `assets/depuracao/serf/serf.png` + `serf.json`, com `parado` (4), `andar` (8) e `morrer` (6),
  nas 5 direções canônicas (n, ne, l, se, s), 64×96 e anchor [0.5, 1].
  - Cada quadro mostra a direção e o número desenhados, e o pé numa linha fixa.
  - Rodar o gerador duas vezes dá os mesmos bytes (o sha256 vai para o PROGRESS).
  - O teste afirma que todo quadro prometido existe no `.json` e que o `sourceSize` de todos é
    64×96.

#### D-TELA-04a — O manifesto aceita `atlas` e `animacoes`
- **Aceite (escrito antes do código, 2026-10-02):** o tipo `EntradaDeAsset` de unidade aceita
  `atlas` + `animacoes` ao lado de `estados` (§5.9 do plano). O `tests/F17f-manifesto.test.ts`
  ganha as três regras do §5.9, cada uma com um caso que reprova num manifesto escrito no teste:
  - todo quadro que `animacoes` promete existe no atlas;
  - toda direção desenhada tem os mesmos `quadros`;
  - o `tamanho` é igual ao `sourceSize` de todo quadro.

  O manifesto real **não muda** neste item: a entrada de depuração do serf mora em
  `assets/depuracao/manifesto.json`, validada pelas mesmas regras.

#### D-TELA-04b — O render do serf por animação
- **Aceite (escrito antes do código, 2026-10-02):**
  1. `quadroDoAndar(distanciaAcumulada, tilesPorCiclo, quadros)` (§5.4), por tabela, inclusive o
     salto maior que `saltoMaximo` da interpolação (`interpolacao.ts`), que **não** soma
     distância;
  2. o `parado` roda pelo tempo de jogo (§5.3), e pausado fica no mesmo quadro;
  3. com `?depuracao`, o serf usa o atlas: `atlas` antes de `estados`, e o espelho nas três
     direções do oeste;
  4. **o y do pé é constante** em todos os quadros e direções. O roteiro afirma o y do pé pela
     ponte, e é aqui que se confirma a hipótese do anchor com trim do §5.9.

#### D-TELA-04c — A vitrine e o serf andando na partida
- **Aceite (escrito antes do código, 2026-10-02):**
  - `?vitrine=serf` mostra as 8 direções × os quadros de cada animação, só render;
  - numa partida com `?depuracao`, um serf andando publica, tick a tick, a direção e o quadro no
    `debug`, e o quadro avança com a distância;
  - um passo despausado (§8);
  - as duas capturas (a vitrine e a partida) são abertas.

#### D-TELA-04d — A virada suavizada
- **Aceite (escrito antes do código, 2026-10-02):** a função pura da virada, por tabela: 90° gasta
  1 passo, 135° gasta 2, 180° gasta 3, e o empate escolhe sempre o mesmo sentido. Parado, o serf
  não vira sozinho. O walk continua durante a virada. O roteiro captura uma virada de 180° no
  degrau intermediário.

#### D-TELA-04e — A medida de memória das texturas
- **Aceite (escrito antes do código, 2026-10-02):** o `debug.memoriaDeTexturas` soma
  `largura × altura × 4` de toda textura carregada, pelo `TextureManager`. O roteiro grava em
  `test-output/D-TELA-04e.json` o número com e sem o atlas de depuração. A asserção fica no eixo de
  bytes: com o atlas, a soma cresce exatamente o tamanho do PNG do atlas × 4. A memória real de
  GPU, se medida, é evidência da sessão.
- **Parada para o operador depois da 04e** (§10 do plano): o espelho e o formato, vendo a vitrine.

### Leva 3 da animação direcional — generalização (planejada em 2026-10-03)

Pedido do operador: planejar a Leva 3. Plano e aceites:
`docs/planos/2026-10-03-animacao-leva-3.md`.
Este registro não inicia implementação. A Leva 2 (piloto do serf) foi aprovada;
D-TELA-05a (8 direções) e D-TELA-05e (mercenários em 8 direções) não se repetem.

| Ordem interna | Tarefa | Portão |
|---|---|---|
| 1 | D-ARTE-DEPURACAO-LEVA-TRES — fixtures militares e de trabalho | Só formas de depuração; preservar atlas do serf |
| 2 | D-TELA-05b — direção militar e piloto com arma e escudo | Operador avalia espelho militar antes de generalizar |
| 3 | D-TELA-05c — atacar, trabalhar e morrer | Morte visual definida; sim remove unidade no mesmo tick |
| 4 | D-TELA-05d — carga por tipos presentes e carga tardia | Depende de 05b; independente da decisão de morte |

- **Morte definida e execução autorizada (2026-10-03):** o operador trouxe a
  referência do esqueleto desaparecendo e mandou planejar e executar. O portão M
  agora prevê morte → esqueleto → desaparecimento, só no render; remoção lógica
  imediata. Fixture própria, sem copiar arte do KaM. Emenda no plano antes do código.
- **Fronteira:** nenhum código/dado da sim, arte final, máscara de facção,
  montados em 16 direções ou carga no braço. Fixtures não são arte do jogo.
- **Entrega:** testes e roteiros por tarefa, um commit por tarefa, sem push.
  Operador declara fechamento; verify completo, shot:todos e test:longo com selo
  antes da avaliação. Revisão visual do espelho militar mantém seu portão.

### F34 — Condições de vitória e derrota (escaramuça)
- **ENTREGUE (2026-09-28, sessão autônoma; plano em `docs/planos/2026-09-28-A16-F34-fim.md`).**
  Decisão do operador: *"Vitória: destruir Armazém, Escola e Quartel inimigos e todas as
  tropas. Derrota: perder os três e todas as tropas."*
  - `sim/partida.ts`: escaramuça é a partida com IA (`state.ia`).
    - O lado cai sem nenhum dos três (a obra conta como de pé) e sem militar vivo.
    - A derrota vem antes da vitória, então a perda mútua é derrota.
    - `GameState.partida?` é gravado uma vez, com `match-ended`, e a sim continua.
  - UI: aviso `#fim-de-partida` com o texto do tema (`partida`).
  - Teste `tests/F34-fim.test.ts` e roteiro `tools/shots/F34.js`.
  - **PARA REVISÃO:** sem IA o jogo nunca acaba, e a sim não para no fim (quem para é a
    tela).

### Fila C — dez itens do operador (2026-09-28, depois da sessão autônoma)
Ordem do operador. Cada item tem plano em `docs/planos/2026-09-28-C<n>-*.md`.

- **Decisões do operador que valem para a fila:**
  - colisão militar (GDD §6.4) é item;
  - revidar marchando entra;
  - prédio destruído não devolve material ("demolir é escolha, destruir é perda");
  - o `lado` filtra o JobBoard agora;
  - o `town_hall` segue "Mercenários" no tema;
  - a exceção de largura vira dado, como a de altura.
- **Os itens:**
  1. **C1 — cadência própria para projétil e torre. ENTREGUE.** Medida no fonte do
     kam_remake:
     - a torre recarrega 2,3 s (2 + 1 + 20 ticks, `KM_UnitTaskThrowRock.pas:86-98`);
     - o atirador recarrega a mira mínima mais a animação, com a mira sorteada
       (`KM_UnitWarrior.pas:790-800`).
     - A animação de arco e besta ficou igual à do golpe (0,5 s), um stand-in PARA
       REVISÃO: os quadros estão no `unit.dat` do original, e a medida está pendente.
     - Consertado de passagem: a torre atirava a cada `recarga + 1` ticks.
     - Teste `tests/C1-cadencia.test.ts`.
  2. **C2 — o projétil voa**, com tempo de voo, e erra quem andou. A pedra da torre atinge
     uma unidade só: é o KaM (`KM_Projectiles.pas:333-337`, `UnitsHitTestF`, morte
     instantânea).
     - **C2a (sim): ENTREGUE.** A velocidade vem do KaM (`KM_Projectiles.pas:70`) e é
       convertida em milésimos de tick por tile.
       - `GameState.projeteis?` (opcional; o save não muda de versão) e
         `sistemaDosProjeteis` no começo do tick.
       - A flecha cai no tile do alvo **no lançamento** e atinge quem estiver lá.
       - A pedra persegue o alvo marcado, porque a decisão da F28b ("nunca erra") vale.
       - A recarga da torre soma o voo.
       - Teste `tests/C2-projetil-voa.test.ts`.
       - **PARA REVISÃO:**
         - não há previsão de movimento nem dispersão do KaM;
         - a flecha em prédio continua instantânea.
     - **C2b (render): ENTREGUE.** `render/projeteis.ts` (`posicaoDoProjetil`) interpola a
       fração com o `alfa` do relógio e faz um arco em `sen(π·fração)`.
       - A flecha e o virote viram um traço claro com contorno; a funda e a pedra, um
         círculo.
       - O traço instantâneo da pedra (F28b) saiu, e os contadores de debug ficam.
       - Teste `tests/C2b-projetil-na-tela.test.ts` e roteiro `tools/shots/C2.js`, com a
         screenshot `C2-1-flecha-no-ar.png`.
  3. **C3 — os defeitos do quartel. ENTREGUE.**
     - **Teto:** o quartel guarda até `estoqueInternoPorPredio.entrada` (5) de cada arma.
       O claim e o gerador leem o mesmo teto; os dois são necessários, e cada um tem sua
       sonda.
     - **Recrutas:** voltam ao mapa quando o quartel é demolido ou derrubado.
     - **Painel:** grade de duas colunas; o desabilitado com o visual do `aria-disabled`;
       e o motivo `porta-bloqueada`, que sai da mesma função do comando.
     - Teste `tests/C3-quartel.test.ts`; o roteiro F25b afirma que tudo cabe sem rolar.
  4. **C4 — o botão de reparo (F-CERCO-b). ENTREGUE.**
     - `PainelDoPredio.reparo` traz `ligado`, `danificado` e `emCurso`.
     - O painel tem a linha "Reparo" e o botão "Ligar/Desligar reparo", que manda o
       valor, como o pausar.
     - Teste `tests/C4-reparo.test.ts` e roteiro `tools/shots/C4.js`.
     - PARA REVISÃO: no painel da escola o botão fica abaixo da dobra, e é preciso rolar.
  5. **C5 — colisão militar (GDD §6.4). ENTREGUE.**
     - Em `andar`, o militar não salta para um tile com outro militar; espera
       `desviarDepois` (1 s, o `AVOID_TIMEOUT` do KaM).
     - Depois contorna por uma busca local, que trata os tiles de militares como
       bloqueados.
     - Se o destino tem um militar parado, ele para colado.
     - Civil não colide.
     - Teste `tests/C5-colisao-militar.test.ts`.
     - PARA REVISÃO: sem a troca de lugar e o empurrão do KaM, e dois de frente num
       corredor de 1 tile esperam.
  6. **C6 — revidar enquanto marcha. ENTREGUE.**
     - O corpo a corpo em `marchando` com inimigo encostado luta, como o `CheckForEnemy`
       do KaM (`KM_UnitWarrior.pas:664-702`).
     - Guarda o destino em `Unidade.retomarMarcha?`, e retoma a marcha quando fica sem
       inimigo encostado.
     - Uma ordem nova apaga o destino guardado.
     - O atirador não revida andando.
     - Teste `tests/C6-revidar-marchando.test.ts`.
  7. **C7 — o `lado` filtrando o JobBoard. ENTREGUE, adiantado por ser o conserto do BUG-N1**
     (reprovação da F25a pelo avaliador).
     - O claim exige que todo prédio tocado seja do lado da unidade.
     - A escolha de armazém (origem, destino, ligação, devolução, carga) filtra por lado.
     - Teste `tests/C7-lado-no-jobboard.test.ts`.
     - Fora, PARA REVISÃO: a tarefa de tile sem prédio (estrada, campo), que não tem lado
       no estado.
  8. **C8 — a IA com prioridade de alvo e de tipo de tropa. ENTREGUE.**
     - **Alvo:** o da IA nova do KaM. Primeiro o mais perto entre quartel, armazém, escola e
       prefeitura (`TARGET_HOUSES`); sem nenhum deles, qualquer prédio.
     - **Tropa:** `AI_TROOP_TRAIN_ORDER`, o mais forte que o equipamento permite.
     - As duas listas estão em `combat.json: ia`, com regra de dado.
     - Teste `tests/C8-ia-prioridades.test.ts`.
     - PARA REVISÃO: a Torre no raio (`SCAN_HOUSES`) fica fora.
  9. **C9 — o fim de partida parando o jogo. ENTREGUE.**
     - O laço (`src/laco.ts`) ganhou `encerrar`/`reabrir`: encerrado, `retomar`,
       `alternarPausa` e `avancar` não fazem nada.
     - `acompanharFimDePartida` encerra no estado com `partida` e reabre, pausado, quando
       outro save sem fim é carregado.
     - A sim não muda.
     - Teste `tests/C9-fim-para-o-jogo.test.ts`; o roteiro F34 afirma que o P depois do fim
       não faz o tick andar.
  10. **C10 — a exceção de largura por prédio no dado. ENTREGUE.**
      - `assets/manifest.json` ganhou `regraDeLargura.k = 1,0` e `larguraMaxPorLote` por
        prédio.
      - O render encolhe o que passar do teto, e `violacoesDaLargura` acusa "largo sem
        exceção" e "exceção morta".
      - O armazém e a Casa do Coronel (1,1146) ganharam exceção de 1,12, e a tela não muda.
        PARA REVISÃO: tirar as exceções os encolhe ao lote.
      - Teste `tests/C10-largura.test.ts`; o roteiro F-ESC afirma a largura.
- **D-MOVIMENTO-01 (antes D1) — civis colidem entre si (pedido do operador, 2026-09-28; plano em
  `docs/planos/2026-09-28-D1-colisao-civil.md`).** O GDD §6.4 foi revisto.
  - **D-MOVIMENTO-01a (antes D1a) — o mecanismo, desligado por dado. ENTREGUE.**
    - Troca de frente, empurrão do ocioso, desvio e troca forçada.
    - Estados "dentro" não ocupam tile.
    - Chave `units.json colisaoCivil.ligada = false`.
    - Aceite:
      - todo estado de FSM está classificado, e estado novo sem classificação reprova;
      - desligada, a suíte fica igual sem mudar nenhum teste;
      - ligada, os cenários de corredor, porta, destino ocupado e desvio passam com a
        invariante limpa.
  - **D-MOVIMENTO-01b (antes D1b) — ligar e medir. ENTREGUE (só medida; a lista está no PROGRESS).**
    - 21 testes reprovam por empilhamento vindo de fora do passo (mais 1 guarda do F09, por
      efeito dele).
    - 2 testes afirmam tick exato, 1 mudou de cenário e 1 é de custo.
    - Nenhum teste de calibração reprovou.
  - **D-MOVIMENTO-01c (antes D1a-2) — o empilhamento de fora do passo. ENTREGUE.**
    - `trocaCom` na `Unidade`; o empurrão separa ociosos empilhados; a porta espera como o
      KaM.
    - Esperar contra dividir foi medido na F-CAL, e esperar não segura a produção.
    - O D1b repetido: sobram 5 reprovações, contra 24, e o empilhamento caiu de 21 para 1.
    - F15a e F18d-1a têm valor por estado da chave (a faixa foi recusada).
  - **D-MOVIMENTO-01d (antes D1a-3) — "na porta" por estado da chave, fixture da F20b, JobBoard sem A* na tarefa
    recusada. ENTREGUE.**
    - A F35(b) cai de 287 594 para 6 124 acertos de cache desligada, e de 1 045 289 para
      6 120 ligada, com o mesmo estado final.
    - A F13a ligada expõe um empilhamento permanente de ociosos pela troca forçada. Está
      aberto no PROGRESS.
  - **D-MOVIMENTO-01e (antes D1c) — o aceite do operador. MEDIDO, NÃO FECHA** (tabela no PROGRESS):
    - duas ruas não reduzem a espera da mercadoria na gaveta de forma consistente;
    - o sinal troca entre −7% e +16%, e com a chave desligada as duas dão o mesmo;
    - espera o operador.
  - *O aceite como estava escrito:*
    - (1) congestiona: uma rua entrega menos que duas. Se as duas derem o mesmo, prova que
      a fila existe e que a espera cresce com o número de serfs;
    - (2) não trava: 20 000 ticks sem ninguém acima do teto.
  - **D-MOVIMENTO-01g — os dois empilhamentos residuais. ENTREGUE.**
    - A troca é de duas unidades, e quem passou do teto tem prioridade.
    - O ocioso é empurrado ao tile livre mais perto.
  - **D-MOVIMENTO-01h — a escolha de rota, medida. ENTREGUE (só medida e mecanismo desligado).**
    - O custo de unidade do KaM, +1,5 tile, entra na rota planejada.
    - A segunda faixa passa a receber 45% dos carregadores, e a espera na gaveta não cai.
  - **D-MOVIMENTO-01j — a troca como permuta. ENTREGUE.**
    - Um civil por tile, sempre.
    - A invariante acusa qualquer par.
    - A prioridade não bloqueia a permuta.
  - **FECHADO DESLIGADO, DEFINITIVO, com o mecanismo do KaM** (regra do operador): com a
    porta de 1 tick e com a de 10, duas faixas perdem em 5 das 6 combinações. O GDD §6.4
    registra o resultado como definitivo.
  - **LIÇÃO (vale para qualquer mecanismo com fila, decisão do operador):** "não trava" mede
    **PROGRESSO**, não tempo de espera.
    - Com a porta lenta, a invariante de teto de espera acusava fila legítima (esperas de 32
      a 73 ticks, com a madeira chegando).
    - Se a colisão voltar, a invariante do "não trava" afirma que cada unidade avança (tile,
      entrega, tarefa) dentro de um prazo, e não que ninguém espera mais que N ticks.
  - **Defeito conhecido no mecanismo desligado (medido 2026-09-29, não consertado):** a
    permuta de frente entrega o caminho um passo inteiro mais cedo.
    - Duas unidades de frente em 20 tiles chegam em 95 ticks, contra 100 sem colisão.
    - Sozinha e em fila, 100 e 95 nos dois modos: o movimento normal está certo.
    - Conserto proposto: permutar só quando o passo dos dois vence no mesmo tick, e não somar
      o tick do `andar` em quem permutou.
  - **REABERTO pelo operador (antes da permuta):** o engarrafamento do KaM é fila na porta.
  - **D-MOVIMENTO-01i — a porta lenta (10 ticks, do fonte do KaM). MEDIDO:**
    - sozinha, atrasa a abertura 14%;
    - com a colisão ligada, o mecanismo trava num ciclo de pares.
    - Proposta: D-MOVIMENTO-01j (troca como permuta). Espera o operador.
  - *Antes da reabertura:*
    - O D-MOVIMENTO-01e não se prova. O GDD §6.4 voltou a "civis não colidem", com o
      resultado registrado.
  - **D-MOVIMENTO-01f (antes D1d) — recalibração em lote. CANCELADO: a chave não liga.**, se a chave for ligada de vez.
- **C-COMIDA-01 — fome militar com o Feed (antes F-FEED). APROVADO pelo operador em
  2026-09-29; plano em `docs/planos/2026-09-28-F-FEED-fome-militar.md`** (as decisões
  estão no §7).
  - **Andaime (L8):** a tropa da IA não drena enquanto a IA não tiver armazém, comida e serf.
    Não é divergência de desenho: no KaM a IA tem cidade. Sai quando o item da economia da
    IA entregar.
  - O mercenário sente fome, como todo militar.
  - **C-COMIDA-01a — dado, comando e pedido. ENTREGUE.**
    - `condition.json militar.pedeComidaAbaixoDe` 0,55.
    - `comida-para-tropa` no nível 2 da escada, `livre`, com os de baixo descendo um.
    - `FeedUnits`, `Unidade.pedidoDeComida?` e `resumoDoGrupo`.
    - Regra de dado: `civilVaiComer < pedeComidaAbaixoDe`.
  - **C-COMIDA-01b — a tarefa `comida-para-tropa`, com destino que anda. ENTREGUE.**
    - Carga do armazém do mesmo lado até o militar com pedido: uma por militar, a pé.
    - O serf recalcula quando chega e a tropa está a mais de 1 tile (R8). Adjacente, enche a
      condição, apaga o pedido e emite `unit-fed`.
    - O claim confere o lado do militar (`unidade-invalida`).
  - **C-COMIDA-01c — a fome do militar. ENTREGUE.** Muda os aceites da F20b (fome e morte) e
    da F20c (marcador de fome), com o visto do operador.
    - O militar e o mercenário drenam 1 por tick e morrem a 0. Nunca vão à Bodega.
    - **ANDAIME (L8):** `condition.json militar.iaDrena: false`, e a tropa de lado com
      `state.ia` não drena. **Condição de saída: a IA volta a drenar (o dado vira `true`)
      quando tiver armazém, comida e serf. O item da economia da IA destrava este.**
    - A morte por fome libera no mesmo tick a comida que vinha para o morto.
  - **C-COMIDA-01d + 01f — o painel de grupo com o Alimentar, e o alerta de tropa com fome no
    HUD** (o 01f não é opcional, e é feito junto com o 01d). **ENTREGUE.**
    - `ui/painel-grupo.ts`, com o corpo `grupo` na barra: tipos, a condição do mais faminto,
      "N esperando comida", o botão Alimentar (`FeedUnits`) e "Ninguém com fome".
    - Alerta "Tropa com fome" na faixa da barra (`tropaComFome`), na primeira linha.
  - **C-COMIDA-01e — a IA alimenta a tropa.** É o C-IA-01, antes F28-IA ponto 5, com o
    limiar do civil. **ENTREGUE.** Por posição: se ninguém luta e o mais faminto está abaixo
    de `civilVaiComer`, a IA dá `FeedUnits` aos membros, só se alguém pediria. Com o
    andaime (L8), na partida a tropa da IA não drena; o ponto age quando `iaDrena` virar.
- **C-IA-03 — cenário de escaramuça. O PRÓXIMO (decisão do operador, 2026-09-29), antes da
  C-IA-02:** sem ele nada do combate é jogável. Duas vilas, dois lados, o mapa que já existe;
  começa pelo mínimo, a IA com a vila de pé e tropa, sem economia. Plano em
  `docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md`.
  - **É UM CENÁRIO, NÃO UM SISTEMA DE FASES, e é PROVISÓRIO** (operador, 2026-09-29). Ele é
    montado em código, como os cenários de hoje (`sim/cenario.ts` + `data/escaramuca.json`),
    para haver contra quem jogar. **Quando o sistema de fases (item abaixo) existir, a
    escaramuça vira uma fase como as outras**, e `criarEscaramuca` sai.
  - **O mínimo, e só o mínimo** (operador): duas vilas com prédios de pé e tropa; a IA não
    produz, não constrói e não repõe — defende o que tem com as posições de defesa; o jogador
    ataca, e a vitória e a derrota da F34 disparam de verdade pela primeira vez. A fome da
    tropa da IA segue com o andaime (`iaDrena: false`).
  - **Peacetime entra agora, com valor FIXO** (`data/escaramuca.json`), com contador na
    tela; vira parâmetro de fase depois.
  - **Aceite do operador:** partindo do cenário, eu acho a vila inimiga, ataco, destruo os
    três prédios e vejo a vitória — num roteiro que eu possa abrir. (A F34 exige também a
    tropa da IA morta: vitória = sem armazém, escola e quartel E sem militar.)
  - **C-IA-03a — o cenário na sim. ENTREGUE (2026-09-29).** `data/escaramuca.json`,
    `sim/cenario.ts criarEscaramuca`, `LADO_DA_IA`, regra de dado `validarEscaramuca`, e os
    vazamentos entre lados fechados (desbloqueio só por prédio do jogador; estoque, comida,
    população, avisos e centro da câmera com `lado`, padrão o jogador).
  - **C-IA-03b — peacetime e as tropas (sim). ENTREGUE (2026-09-29).** O jogador nasce com
    18 cabras; a IA com 9 cabras + 3 bodoqueiros nos tiles das posições e o quartel vazio (não
    repõe); peacetime de 10 min de jogo (`peacetime_min_base` 20, escala economia) com a regra
    do KaM: marcha, ataque e treino no quartel recusados `em-paz`, a IA não defende nem repõe
    nem ataca; `peace-ended` no tick exato. A partida headless fecha em vitória (tick 10287).
  - **C-IA-03c — jogar pela tela (integração `ui/` + `render/` + `main.ts`, e um seletor em
    `sim/paz.ts`). ENTREGUE (2026-09-29).** "Nova escaramuça" no painel H e `?escaramuca`;
    o contador `Paz: mm:ss` no quadro do minimapa; a cor de cada bando (vermelho do jogador,
    azul do inimigo, do documento da campanha) no rótulo da unidade e numa bandeira no prédio;
    e o roteiro do aceite, `npm run shot -- C-IA-03c`: da abertura à vitória pelo mouse.
- **SISTEMA DE FASES — a campanha do Piancó em dado. SIGLA A DEFINIR pelo operador** (nenhum
  dos 11 módulos cobre "fase/missão"; módulo novo só por decisão dele — proposta: `FASE`).
  Vem DEPOIS do cenário de escaramuça. A campanha tem 10 missões, cada uma com estado inicial,
  objetivo e inimigo próprios, e isso pede DADO em vez de código. Documento:
  `pianco-campanha-10-missoes.md` (na RAIZ do repositório, não em `docs/`; commit `cce6f40`).
  Quando existir, a escaramuça (C-IA-03) vira uma fase como as outras.
  - **O levantamento que o cenário de escaramuça ensina** (atualizado a cada sub-item da
    C-IA-03; é a entrada do projeto deste sistema):
    - **O que precisou ser configurável** (está em `data/escaramuca.json`): prédios da IA
      com posição; estoque do armazém da IA; conteúdo do quartel da IA; posições de defesa
      (ponto, tipo de grupo, raio, linha) com a tropa de cada uma e onde ela nasce; a tropa
      inicial do jogador; o peacetime.
    - **O que ficou fixo no código:**
      - a vila do jogador é a do jogo livre (`economy.json estadoInicial`), sem variação;
      - os lados são dois, `LADO_DO_JOGADOR` 0 e `LADO_DA_IA` 1, constantes;
      - o objetivo é um só, o da F34 (`sim/partida.ts`: armazém, escola e quartel mais
        tropa); "sobreviver a ondas" ou "escoltar" não cabem;
      - o comportamento da IA é um só (defender, repor, atacar com a sobra), sem parâmetro
        por fase;
      - o mapa é um só, importado em `sim/data/raw.ts`;
      - quem começa a partida é o `main.ts`;
      - o andaime `iaDrena` é global, não por fase;
      - a lista de ordens que o peacetime bloqueia está no código (a do KaM).
    - **O que doeu:**
      - **seletores e desbloqueio supunham um lado só:** HUD, avisos, câmera e menu Build
        somariam a IA (C-IA-03a fechou cinco vazamentos). Toda leitura "do jogador" precisa
        de `lado`;
      - **o gerador de mapa reserva só a vila do jogador:** a vila da IA depende de achar
        área livre à mão. Uma fase precisa declarar as vilas, e o gerador reservar todas;
      - **o balanço de combate é caótico perto do empate:** 18+10 perde por inteiro e 18+9
        vence com 11 (C-IA-03b). Uma fase com inimigo "médio" precisa de margem medida, não
        de número escolhido;
      - **o combate travava** em dois casos que só o cenário exercitou: alvo cercado pelos
        colegas e ataque a prédio sem revidar (BUG-P, corrigido). Cenário novo acha defeito
        de combate velho;
      - **o documento da campanha estava fora de `docs/`:** a referência do operador apontava
        `docs/`, o arquivo está na raiz;
      - **a tela não sabia que existe outro lado:** unidade e prédio do inimigo eram iguais aos
        do jogador (C-IA-03c pôs a cor do bando no rótulo e uma bandeira no prédio). O
        SPRITE continua igual — o cabra inimigo usa lenço vermelho; o sprite por bando é da
        sessão de arte. Uma fase com três bandos pede a cor por lado no dado da fase;
      - **pela tela o jogador só MARCHA e ataca PRÉDIO:** botão direito em unidade inimiga é
        marcha, e a luta nasce do revide (C6/BUG-P). Não existe "atacar esta unidade" no
        mouse, embora a sim tenha o `AttackUnit`;
      - **a fome é assimétrica:** a tropa do jogador drena (66% no fim da paz de 10 min, 46%
        na vitória do roteiro) e a da IA não (andaime L8). Uma fase longa pune só o jogador
        até a C-IA-02;
      - **a partida só começa por botão no painel H ou por URL:** não há tela de escolha de
        modo. Um sistema de fases precisa de um menu de partida.
- **C-IA-02 — economia da IA. APROVADA pelo operador (2026-09-29), DEPOIS da C-IA-03:**
  - o modelo "vila pronta" sem AutoBuild, e um prefeito mínimo que só treina gente — planejar
    cidade fica de fora (o KaM desliga na maioria das missões);
  - **a vila da IA recebe PRODUÇÃO, não só estoque:** estoque acaba, a tropa volta a morrer de
    fome e o andaime nunca sai. Com produção, a condição de saída do andaime (L8) se cumpre
    de verdade.
  - A medição e a proposta original ficam abaixo, como registro.
  - Status anterior: PROPOSTA, aguardava o operador ler a medição
  antes do escopo (pedido do operador, 2026-09-29: "meça no kam_remake primeiro"). Sem
  entrada em `test-results.json` até a aprovação. **Destrava o andaime L8 do C-COMIDA-01:**
  com esta entregue, `condition.json militar.iaDrena` vira `true` e a tropa da IA volta a
  sentir fome.
  - **A medição** (kam_remake, fonte lido na sessão de 2026-09-29):
    1. **A IA constrói a vila, ou a missão já dá pronta?** Nas missões, a vila vem PRONTA.
       - `AutoBuild` é `True` por padrão, com o comentário do próprio fonte: "In KaM it is On
         by default, and most missions turn it off" (`ai/KM_AISetup.pas:67`).
       - O comando de missão `SET_AI_NO_BUILD` põe `AutoBuild := False`
         (`mission/KM_MissionScript_Standard.pas:677`), e as casas e unidades da IA vêm de
         `SET_HOUSE` e `SET_UNIT`.
       - "A maioria desliga" é o comentário do fonte, NÃO uma contagem minha: os arquivos
         de missão não estão no repositório do remake.
    2. **Ela gere produção e transporte como o jogador?** Sim, com o MESMO mecanismo. As
       casas dela produzem com os mesmos ocupantes, e o transporte é a logística da mão
       (`hands/KM_Hand.pas:55`, `fDeliveries: TKMHandLogistics`): serf e pedido iguais
       aos do jogador.
    3. **Treina civis na escola? Reage à falta de comida?**
       - **Treina SEMPRE, com AutoBuild ou sem** (`ai/KM_AIMayor.pas:996`, `CheckUnitCount`
         em `TKMayor.UpdateState`):
         - o cidadão que falta em cada casa;
         - serfs em `SerfsPerHouse` (1) × (casas + construtores/2) (`:255`);
         - construtores e recrutas;
         - só com ouro: produzindo ouro, ou saldo acima de 20 (`:150-152`).
       - **Reagir à falta de comida (construir fazenda, moinho, Inn) é SÓ com AutoBuild**:
         `CheckHouseCount`, `CheckWareFlow` e `CheckRoadsCount` ficam dentro de `if
         fSetup.AutoBuild` (`:1001-1010`). O balanço de comida mora em
         `ai/KM_AIMayorBalance.pas` (`AppendFood`, `:300`; Inn por 80 cidadãos, `:775`).
       - **Alimentar a TROPA vale sempre** (`ai/KM_AIGeneral.pas:316-327`). Aqui já é o
         C-COMIDA-01e.
  - **O nosso lado, conferido no código:**
    - **Não existe partida com IA no jogo.** `state.ia` só nasce em teste e em save; nenhum
      cenário da tela cria a IA (`grep "ia: {"` em `src/` não acha criação).
    - A IA de hoje (F28-IA) defende, repõe pelo quartel e ataca com a sobra.
    - O JobBoard já é por lado (C7), e a tarefa `comida-para-tropa` também (C-COMIDA-01b).
  - **Proposta de escopo, para o operador decidir:** o modelo "missão com vila pronta", que
    é o caso comum do KaM e o mais barato.
    - **(a) O cenário da escaramuça com IA.** Uma vila da IA pronta no mapa, com armazém,
      estoque, escola, quartel, serfs e alguma produção de comida, mais `state.ia` e as
      posições. Hoje ele não existe, e sem ele nada abaixo roda na tela.
    - **(b) O prefeito mínimo**, o `CheckUnitCount` do KaM. A IA dá à escola dela o
      comando de treino que o jogador daria:
      - o especialista que falta em prédio sem ocupante;
      - serfs até 1 por prédio;
      - laborers e recrutas;
      - tudo só com ouro.
    - **(c) Tirar o andaime:** `iaDrena: true`, e o teste longo da IA com fome e comida.
    - **Fora do escopo:** o planejador de cidade (`KM_AICityPlanner`) e o balanço de
      produção (`KM_AIMayorBalance`), o AutoBuild inteiro. A IA não constrói nem reage à
      falta de comida com prédio novo, como a maioria das missões do KaM.
  - **Perguntas ao operador:**
    - Aprova o modelo "vila pronta" sem AutoBuild?
    - O (a) é item próprio, ou parte deste?
    - Que produção de comida a vila da IA recebe (roçado e padaria, ou só estoque)? Só
      estoque acaba, e aí a tropa volta a morrer de fome, que é o que o andaime evita.
- **Siglas:** o esquema novo está em `docs/siglas.md` (decisão do operador, 2026-09-28). O que
  fechou mantém a sigla antiga; os itens abertos migraram.

### Fila da primeira partida — nove pedidos do operador em onze itens (2026-09-29)
Origem: o operador jogou a escaramuça (C-IA-03c) e trouxe o que impede jogar. Ordem dele.
Cada item tem plano em `docs/planos/2026-09-29-<sigla>-*.md`, escrito antes do código.
Decisão de design que o operador não respondeu: interpretação conservadora, registrada no
PROGRESS como PARA REVISÃO.

1. **C-MOVIMENTO-01 — o passo confere o tile antes (sim).** O militar confere o tile
   seguinte ao COMEÇAR o passo, não ao terminá-lo. Hoje ele anda 86% do passo, descobre o
   tile ocupado, segura ali e, ao desviar, volta ao tile de origem: é o "volta ao tile
   anterior" que o operador viu (medido: 25 recuos de ~0,86 tile num grupo de 18).
   - Ocupar, como no KaM (`UnitWalk` move a ocupação no início do passo): quem está no meio
     de um passo ocupa o tile de DESTINO dele; quem está parado ocupa o próprio tile.
   - A conferência do fim do passo fica como rede de segurança da invariante (dois
     militares nunca no mesmo tile).
   - **Aceite:** em (a) dois de frente, (e) grupo de 9 e no grupo de 18, nenhum militar é
     desenhado recuando (`posicaoDaUnidade` nunca se afasta do tile seguinte enquanto
     espera), e a invariante do C5 continua.
2. **C-COMBATE-02 — a cerca da paz (sim).** Diverge do KaM por decisão do operador: na paz,
   `MoveUnits` passa se o destino está a até N tiles (Chebyshev) da caixa de um prédio
   PRONTO do lado de quem manda. Atacar, treinar e contratar continuam recusados. O N vive
   em `data/escaramuca.json`, com a conta no plano.
   - A recusa ganha motivo próprio, `longe-na-paz`, separado de `em-paz`.
   - **Aceite:** mover dentro da cerca na paz anda; fora dela é recusado com `longe-na-paz`;
     `AttackUnit` na paz segue `em-paz`; depois da paz, a cerca não existe.
   - **ENTREGUE (2026-09-29), N = 12.** Muda o aceite da C-IA-03b (peacetime e tropas): a
     marcha longe em paz sai `longe-na-paz`, e não mais `em-paz`. A escaramuça passou a
     transladar junto no mundo transladado (`tools/transladar-mundo.js`).
3. **C-TELA-01 — a mensagem da ordem recusada (ui).** "Em paz — faltam mm:ss" para
   `em-paz`, e "Longe demais na paz" para `longe-na-paz`. **Aceite:** roteiro com as duas.
   - **ENTREGUE (2026-09-29).** `src/ui/aviso-de-ordem.ts`, sobre o mapa, some em 3 s de
     relógio. Roteiro `tools/shots/C-TELA-01.js`. O roteiro da C-IA-03c passou a clicar fora
     da cerca para afirmar "ninguém marcha em paz".
4. **C-TELA-02 — o marcador de destino (render + input).** O tile do destino de uma ordem
   de mover é marcado por ~1 s e some, como no Civilization. É estado da tela: não entra na
   sim. **Aceite:** screenshot com o marcador, e a prova de que ele some.
   - **ENTREGUE (2026-09-29).** `src/render/marcador-de-destino.ts`: some em 1 s
     (`theme-sertao.ordem.segundosDoMarcador`), e a recusa da paz o apaga no tick seguinte.
5. **C-IA-04 — o terceiro grupo da IA (dado + sim do cenário).** Um grupo de 9 fora das
   posições, no dado da escaramuça: a sobra que o `atacarComASobra` já sabe usar.
   - **ANDAIME:** sai quando a C-IA-02 (economia da IA) der à IA uma sobra que vem da
     reposição. A condição de saída vai escrita no dado e no PROGRESS.
   - **ENTREGUE (2026-09-29).** `data/escaramuca.json: atacantes`, com 9 cabras em (80,77).
     Saem para o ataque no tick 6001, um depois da paz, e o primeiro golpe na vila do
     jogador cai no tick 6403.
   - **Aceite:** depois da paz, a IA ataca a vila do jogador na partida headless.
6. **C-TELA-03 — selecionar o grupo pela caixa (ui + input).** O arraste pega todos os
   militares do jogador dentro da caixa, e a ordem de mover leva todos. O plano diz o que a
   F26b (selecionar pela tela) já faz e o que falta. **Aceite:** roteiro que arrasta sobre
   a tropa de 18 e move os 18.
   - **ENTREGUE (2026-09-29).** A caixa pega quem tem o TILE desenhado tocado, não mais o
     centro. A caixa que a mão começa em cima do cabra da ponta pegava 15 de 18. A ajuda (H)
     ganhou o grupo "A tropa", com a caixa e o botão direito. Plano em
     `docs/planos/2026-09-29-C-TELA-03-selecao-de-grupo.md`.
7. **C-TELA-04 — atacar unidade pelo mouse (ui + input).** Botão direito sobre um militar
   inimigo, com tropa selecionada, emite `AttackUnit`. **Aceite:** roteiro.
   - **ENTREGUE (2026-09-29).** A decisão está em `src/ui/ordem-militar.ts`. O acerto passou
     a mirar o CORPO do sprite, e não só o quadrado do pé. Plano em
     `docs/planos/2026-09-29-C-TELA-04-atacar-unidade.md`.
   - **Proposta, não na fila (decisão do operador):** "o grupo que mata o alvo procura o
     próximo inimigo perto" (sim, COMBATE). Com `AttackUnit`, os 18 perseguem um alvo só, e
     quando ele morre todos ficam ociosos. Medido na C-IA-03c: clicar no arqueiro atrás da
     linha mata a tropa inteira.
8. **C-TELA-05 — ordem à Feira (ui).** O painel da Feira emite `SetTrade`. **Aceite:**
   roteiro.
   - **ENTREGUE (2026-09-29).** O rascunho da ordem está em `src/ui/ordem-da-feira.ts`, e o
     painel ganhou "Dar ◀ ▶", "Receber ◀ ▶", "Quanto − +", "Mandar a troca" e "Cancelar a
     troca". Plano em `docs/planos/2026-09-29-C-TELA-05-ordem-a-feira.md`.
9. **D-TELA-02 — minimapa (render + ui).** Já está na fila (Fase D); o escopo é o do
   operador: terreno pintado, prédios por lado (vermelho e azul), a vista atual marcada e o
   clique movendo a câmera.
10. **F-REPL-d — seletor de modo do lenhador no painel (ui).** O contrato está na nota do
    item F-REPL.
11. **C-COMBATE-01 — formação, virar e storm attack.** O item existente, com as notas do KaM
    que ele já traz.

- **Exceção da §10:** nenhum item acima mexe em `sim/` e na tela ao mesmo tempo. A cerca
  (C-COMBATE-02) e a mensagem (C-TELA-01) são dois itens de propósito. Se o C-COMBATE-01
  precisar das duas camadas, ele se quebra em sim e tela, com a nota escrita aqui antes.

### Segunda partida — quatro problemas e dez itens do operador (2026-09-29)
O operador jogou de novo. Os quatro problemas vêm antes da fila. Em cada item, o plano vai
para `docs/planos/` antes do código. Decisão de design em aberto: a leitura conservadora
vai para o PROGRESS como PARA REVISÃO, e o trabalho segue.

**Problemas:**
- **P1. C-COMBATE-02b — a cerca da paz sai (sim + ui, sem render).** O operador: "ela impede
  os meus soldados de avançar no mapa, e não é o que eu quis".
  - Em paz, `MoveUnits` passa para qualquer destino.
  - Atacar unidade, atacar prédio, treinar e contratar continuam recusados com `em-paz`.
  - Saem o `cercaDaPaz_tiles`, o motivo `longe-na-paz` e o texto "Longe demais na paz".
  - Toca `src/sim/` e `src/ui/`, não `src/render/`: a §10 não se aplica.
  - **ENTREGUE (2026-09-29).** A marcha em paz para (60,60) foi aceita, e a tropa chegou no
    tick 293, com a paz até o 6000. `em-paz` também saiu dos motivos da marcha, porque
    nada mais o produz. Os roteiros C-TELA-01, C-TELA-02 e C-IA-03c afirmam a regra nova.
- **P2. D-PRODUCAO-02 — o alcance do lenhador.** Dobrar o raio de busca de árvore e medir a
  vazão antes e depois. Responder se o modo "cortar e plantar" (F-REPL-b) planta de fato.
  - **ENTREGUE (2026-09-29; plano em `docs/planos/2026-09-29-D-PRODUCAO-02-lenhador.md`).**
    - O alcance foi de 6 para 12. A vazão não mudou: ~1 tora por minuto, porque quem limita
      é o ciclo. O alcance só estende a vida da mata rala.
    - O modo não plantava na prática. O rodízio só voltava ao toco depois de cortar toda
      adulta ao alcance: 0 replantios em 11 500 ticks, com 5 tocos no fim.
    - Agora ele replanta o toco que acabou de cortar (`replantaOQueCortou`, só na árvore).
      Na mata da abertura: 3 replantios e 0 tocos, contra 0 e 4. Isso vai PARA REVISÃO:
      custa ~15% dos troncos a curto prazo.
- **P3. C-MOVIMENTO-02 — a tropa ainda trava ao andar.** Repetir a sonda do C-MOVIMENTO-01
  (quantos saltos para trás, e de onde vêm) e achar a causa que sobrou. É o que mais
  atrapalha jogar.
  - **ENTREGUE (2026-09-29; plano em `docs/planos/2026-09-29-C-MOVIMENTO-02-a-tropa-trava.md`).**
    Havia duas causas:
    - a vaga de dentro da formação ficava emparedada, e 2 de 18 esperavam para sempre;
    - a ordem no meio do passo zerava o `progresso`, o que dava 11 saltos para trás.
  - Os consertos: a troca de vaga com o parado, e terminar o passo antes de replanejar. As
    seis ordens da sonda dão 0 salto e 0 preso.
  - **C-MOVIMENTO-02b — a vaga tomada por quem marcha. ENTREGUE (2026-09-29; plano em
    `docs/planos/2026-09-29-C-MOVIMENTO-02b-vaga-tomada-por-quem-marcha.md`).** Achado pelo
    roteiro da C-COMBATE-01c: a tropa em fileiras de 7, mandada ao leste, deixava 3 de 18
    marchando para sempre. A vaga de um estava tomada por outro que marchava, preso atrás de um
    parado, e cada um esperava o outro. Agora os dois trocam de vaga, só quando o preso tem um
    PARADO à frente (quem está só de passagem sai sozinho). Aceite:
    `tests/C-MOVIMENTO-02b-vaga-tomada.test.ts`.
- **P4. O inimigo sem serf** não repõe a fome da própria tropa, e hoje o andaime
  `iaDrena: false` esconde isso. Fica resolvido pela C-IA-02, o item 3 abaixo.

**Fila:**
1. C-COMBATE-01b — storm attack (sim).
2. C-COMBATE-01c — controles de formação (tela).
3. C-IA-02 — economia da IA, em partes: vila pronta, prefeito mínimo que treina, serf e
   comida. O andaime `iaDrena` sai no fim. Quebrada em três (plano em
   `docs/planos/2026-09-29-C-IA-02a-vila-da-ia-com-producao.md`):
   - **C-IA-02a — a vila da IA com produção (dado + cenário). ENTREGUE (2026-09-29).**
     - A escaramuça ganha, do lado da IA:
       - roçado, moinho, padaria e estalagem;
       - a estrada da porta do armazém a cada porta;
       - 8 campos de milho no alcance do roçado;
       - 4 serfs, 1 fazendeiro e 2 padeiros.
     - Nenhuma regra nova.
     - Aceite em `tests/C-IA-02a-vila-da-ia.test.ts`: o pão da IA vai de 20 a 75 em 12000
       ticks, e os 7 civis vivem.
   - **C-IA-02b — o prefeito mínimo (sim). ENTREGUE (2026-09-29).** O `CheckUnitCount` do KaM: a IA pede à escola
     dela o especialista que falta em prédio sem ocupante e serfs até 1 por prédio, só com
     ouro.
     - Nota da C-IA-02a: os civis de hoje nascem do dado (`escaramuca.producao.civis`). Com
       o prefeito, a contagem inicial pode cair, e a escola repõe quem morre.
   - **C-IA-02c — tirar o andaime L8 (dado + teste longo). ENTREGUE (2026-09-29).** `condicao.iaDrena: true`. A
     tropa da IA sente fome e come da produção pelo `comida-para-tropa`.
     - Nota da C-IA-02a: o armazém da IA recebe ~55 pães a cada 9000 ticks (medido). A
       tropa da IA tem 21.
     - Os atacantes da C-IA-04 continuam: a reposição pelo quartel pede armas, e a cadeia
       de armas não é deste item.
     - Nota da C-IA-02b: com 20 de ouro a IA não treina serf (o limiar é `> 20`). A comida
       da tropa sai pelas mãos dos 4 serfs do dado, que já carregam a cadeia do pão.
4. D-TELA-01 — aba de estatísticas: prédios e trabalhadores por tipo, com os ociosos em
   destaque.
5. D-TRANSPORTE-01 — armazém com liga/desliga por mercadoria.
6. D-TRANSPORTE-02 — menu de distribuição.
7. D-PRODUCAO-01 — ferro e ferrarias. ENTREGUE (01a guarda, 01b insumo escasso dividido).
8. D-PRODUCAO-03 — encomendas das oficinas (03a regra, 03b painel). Decisão do operador,
   2026-09-29. ENTREGUE (03a regra, 03b painel).
9. F24, o que resta: a cadeia de couro. ENTREGUE como F24b (guarda); F24c (a Casa do Gibão
   por encomenda) é proposta e espera o operador.
10. As quatro hipóteses do avaliador: CONFERIDAS (2026-09-29; plano em
    `docs/planos/2026-09-29-hipoteses-do-avaliador.md`).
   - BUG-P perde a ordem depois de revidar: fiel ao KaM (`KM_UnitWarrior.pas:716-717,
     740-748`); sem código.
   - a C9 roda ticks a mais: CONFIRMADA e consertada em `src/laco.ts` (o quadro e o
     `avancar` param no passo que encerra ou pausa), aceites (d)-(f) em
     `tests/C9-fim-para-o-jogo.test.ts`.
   - recrutas empilhados: já coberta pela D-MOVIMENTO-01c/01d (a porta e o empurrão).
   - a tela não avisa a recusa em paz: já coberta pela C-TELA-01 (a mensagem da ordem
     recusada).
11. VARREDURA-KAM, as frentes que faltam.

### F35 — Feira: trocar mercadoria (sim + ui)
- **ENTREGUE (2026-09-28, sessão autônoma; plano em `docs/planos/2026-09-28-A17-F35-feira.md`).**
  Taxa 2 para 1 (decisão do operador), em `economy.json:marketplace.taxa`, com regra no
  `validate:data`.
  - `sim/feira.ts` + `systems/feira.ts`: `SetTrade` (0 cancela; recusa com motivo) e uma
    troca por tick com `taxa` de A na entrada. A feira pede A pela escada como insumo,
    alvo = `taxa ×` as trocas restantes.
  - `jobs.ts` (`reclamar`): teto de `maxSerfs` tarefas em curso com a feira na ponta.
  - Painel: a ordem, feitas/quantidade e por que não troca (texto do tema).
  - Teste `tests/F35-feira.test.ts` (aceites a–d, conservação de `A + taxa × B` a cada
    tick) e roteiro `tools/shots/F35.js`.
  - **PARA REVISÃO:** troca instantânea (sem tempo, o GDD não dá).
  - **Decisão do operador (2026-09-28): o cancelamento fica como está.** O A a caminho
    chega à feira e volta ao armazém como excedente, e isso é *"mais correto que largar
    tarefa no meio"*. O aceite (d) foi corrigido para dizer isso; o código não mudou.
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
  - (d) cancelar a ordem com A a caminho não perde A: a soma de A no mundo, no armazém,
    nas gavetas e nos serfs, mais `taxa ×` o B já trocado, fica igual a cada tick. A
    tarefa em curso **não** é largada pelo `release`: ela termina na feira, e o A que
    sobra na gaveta volta ao armazém pelo nível 7 (excedente).
    *Corrigido em 2026-09-28 por decisão do operador.* O texto antigo dizia "larga as
    tarefas pelo `release`". O comportamento entregue é melhor: a mercadoria que já saiu
    termina a viagem e volta pelo caminho normal, em vez de ficar no chão ou exigir um
    ramo novo de devolução no meio do caminho.

### F36 — Prefeitura: mercenários pagos em ouro (sim + ui)
- **ENTREGUE (2026-09-28, sessão autônoma; plano em `docs/planos/2026-09-28-A18-F36-prefeitura.md`).**
  - `sim/prefeitura.ts` + `systems/prefeitura.ts`: `HireMercenary` debita `custoOuro` da
    entrada e cria a unidade na porta andável no mesmo tick (`unit-trained`). Recusas:
    `predio-nao-e-prefeitura`, `tipo-desconhecido`, `sem-ouro`, `porta-bloqueada`.
  - O ouro é insumo (molde da torre), com alvo = o maior `custoOuro` (8), lido do dado.
  - **O mercenário virou militar** em `classeDaUnidade` e em `populacaoPorGrupo`: recebe
    ordem, luta, cerca e conta como tropa na F34.
  - Painel: o ouro e cinco botões com custo; os que não cabem ficam desabilitados e dizem
    quanto falta.
  - Teste `tests/F36-prefeitura.test.ts` e roteiro `tools/shots/F36.js`.
  - **Decisão do operador (2026-09-28): o mercenário é militar para tudo.** *"Ele é tropa
    e deve se comportar como tropa."* A mudança em `classeDaUnidade` atinge cinco sistemas:
    1. a ordem de mover (F26);
    2. o combate (F28);
    3. o ataque a prédio (F-CERCO-a2);
    4. a IA, com posições, reposição e ataque (F28-IA);
    5. o fim de partida, onde ele conta como tropa (F34).
    - E ainda: a contagem militar do HUD (`populacaoPorGrupo`) e a fome, pois ele não drena
      condição, como todo militar até o `Feed` existir.
  - **PARA REVISÃO:** o evento é o mesmo do quartel (`unit-trained`).
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

## As fases E a I — a escaramuça completa, para quem nunca jogou (operador, 2026-10-03)

Decisões do operador, no planejamento de 2026-10-03:
- **O alvo é a escaramuça completa e polida** contra a IA, jogada também por quem nunca viu o
  jogo. "Pronto" quer dizer: alguém de fora abre o link, entende e joga uma partida inteira.
- **Uma worktree por vez, na ordem E → F → H → I.** A regra da fila vale: só a fase da vez é
  detalhada; as outras têm só o escopo, e ganham o detalhe quando a anterior fechar.
- **G é a animação das unidades** (serf, laborer, militares e alguns ofícios), feita por outra
  sessão, com ComfyUI. Ela não está nesta fila.
- **Fora destas fases:** mapas novos e a história do jogo. Ficam para um bloco depois, e o
  operador prevê o Tiled para gerenciar os mapas. Até lá o mapa é o `sertao-128`.
- **Módulo novo `ENTREGA`** (build, carregamento, publicação), aprovado pelo operador
  (`docs/siglas.md`).
- **Publicação no itch.io**, como rascunho com senha. Ela se abre para outras pessoas quando a I
  fechar, e quem abre é o operador.

## Fase E — A casca e a vitrine

O jogo ganha uma porta (menu), uma partida configurável, saves pela tela e uma versão publicada
que o operador joga pelo link. Desde a E, cada fase fecha numa versão publicada.

### Abertura da E: o fechamento da Fase D
- **Escopo:** o fechamento da §13 sobre a `main`: `npm run verify` completo, `npm run test:longo`
  sozinho na máquina (com o selo) e `npm run shot:todos`. As chaves que passam são marcadas em
  `test-results.json`. Reprovação vira registro no `BUGS.md`, com a severidade, e não é corrigida
  aqui.
- Os itens da D **sem código** (chão determinístico, solo de caatinga, decalques de capim, água e
  grama sem emenda, véu dos detalhes, efeitos do trabalho, D-ARTE-02, D-ARTE-SERF-ANDAR) ficam na D.
  Eles não são da E.
- **Aceite:** `test-output/test-longo.json` com o commit do `HEAD` e a suíte verde,
  `test-output/shot-todos.json` com todas as saídas 0, e uma tabela no PROGRESS com as chaves
  marcadas e as que ficaram de fora, com o motivo de cada uma.

### E-TELA-MENU-INICIAL — A porta do jogo
- **Escopo:** abrir `/` mostra o menu antes do jogo: **Novo jogo** (livre ou escaramuça),
  **Continuar** (o último save), **Carregar** e **Ajuda** (a tela de ajuda que já existe; a I
  amplia). O `Phaser.Game` só nasce depois da escolha. Os rótulos vêm de `data/theme-sertao.json`.
  `?escaramuca`, `?pausado` e os outros parâmetros dos roteiros continuam pulando o menu.
- **Aceite:**
  - (a) `/` sem parâmetro mostra o menu, e não existe canvas do Phaser antes da escolha (roteiro);
  - (b) a escaramuça pelo menu nasce com o estado igual ao do `?escaramuca` no tick 0 (igualdade
    do estado serializado);
  - (c) **Continuar** sem save está desabilitado e diz por quê;
  - (d) os roteiros que existem continuam saindo 0, sem mudar uma linha deles;
  - (e) screenshot do menu, e o roteiro despausa e segura o clique 150 ms (§8).

### E-TELA-CONFIGURAR-PARTIDA — A paz da escaramuça se escolhe
- **Feature de integração (sim + tela), declarada aqui antes do código (§10).** O cenário da
  escaramuça recebe a paz como parâmetro, em vez de ler o número fixo.
- **Escopo:** antes da escaramuça, o jogador escolhe a duração da paz (GDD §8.2: "Peacetime
  configurável"). As opções e o padrão ficam em `data/escaramuca.json`, e o padrão é o
  `peacetime_min_base` de hoje. Nada mais se configura nesta fase: mapa e semente esperam o bloco
  dos mapas.
- **Aceite:**
  - (a) a mesma paz com os mesmos comandos dá o mesmo estado, byte a byte;
  - (b) com o padrão, o estado é igual ao da escaramuça de hoje (nenhum teste da C muda);
  - (c) com cada opção, o contador de paz mostra a duração escolhida, e a marcha e o ataque da IA
    são recusados até o tick dela e aceitos depois (pelo `step`);
  - (d) o `validate:data` recusa opção fora do intervalo do KaM (0 a 120 min, de 5 em 5,
    `src/KM_GUIMenuLobby.pas:635-638` a conferir no clone, §15) e padrão fora da lista.

### E-SAVE-GAVETAS — Salvar e carregar pela tela
- **Escopo:** três gavetas com nome, tick e data, mais o **Continuar** do menu (a gaveta salva por
  último). A data é do laço externo (`ui`/`arquivo-da-partida`), nunca da `sim/`. O save de hoje
  vira a gaveta 1 sem perder a partida de quem já tem save.
- **Aceite:**
  - (a) salvar, carregar e rodar N ticks dá o mesmo estado que rodar N ticks sem salvar;
  - (b) o save antigo de gaveta única carrega como gaveta 1;
  - (c) gaveta com save de versão incompatível aparece recusada, com o motivo, e não derruba o menu;
  - (d) roteiro: salvar na 2, voltar ao menu, Continuar abre a 2 (despausado, §8).

### E-ENTREGA-BUILD — O jogo fora do dev server
- **Escopo:** `npm run build` gera um `dist/` que roda num servidor estático qualquer, com os
  sprites de `assets/sprites/` e os dados. Tela de carregamento com o progresso dos assets. A base
  (`assets/base/`) e as páginas de depuração não entram no bundle.
- **Aceite:**
  - (a) roteiro contra o `vite preview` do `dist/`: o menu aparece, a escaramuça começa e anda 300
    ticks, com zero erro de console;
  - (b) nenhum arquivo de `assets/base/` no `dist/` (por listagem);
  - (c) o tamanho do `dist/` e o tempo até o menu vão para `test-output/E-ENTREGA-BUILD.json`,
    como número da corrida, nunca asserção (§8).

### E-ENTREGA-PUBLICACAO — O link para o operador jogar
- **Escopo:** `npm run publicar` envia o `dist/` ao itch.io pelo `butler`, no canal `html5`, com a
  tag `teste-jogo-<n>` como versão. A página do jogo é criada pelo operador como rascunho com
  senha; a chave do `butler` é dele e fica fora do repositório. **Quem publica é o operador:** a
  sessão prepara e testa o comando, e não envia nada sozinha.
- **Aceite:**
  - (a) a regra pura, por tabela: recusa sem a tag `teste-jogo-<n>` no `HEAD`, com a árvore suja,
    sem o selo `completo` do `HEAD` e sem `dist/` do mesmo commit. Passa com os quatro;
  - (b) como processo, com um `butler` falso (`CANGACO_BUTLER`): o comando chega ao `butler` com o
    diretório, o canal e a versão certos, e nada é enviado quando a regra recusa;
  - (c) uma primeira publicação feita pelo operador, com o link registrado no PROGRESS.

## Fase F — A névoa e o adversário

A E fechou e foi mesclada (`1f020e8`, 2026-10-03). O operador mandou abrir a F e detalhá-la sem
perguntas: o que o GDD não decide segue a leitura conservadora, escrita no item, e vai para o
PROGRESS como PARA REVISÃO. A ordem é a da lista.

O que já existe e a F usa: o lado (`lado` em prédio e unidade, F-CERCO-a1), a `visao` 9 dos
militares em `data/units.json` e a decisão de que **a IA ignora a névoa**
(`src/sim/systems/ia.ts:29`), que continua valendo.

### F-TERRENO-NEVOA-DESCOBERTO — O que cada lado vê e já viu (sim)
- **Escopo** (GDD §6.5):
  - `visao` no dado para quem ainda não tem: civil 9 (`data/units.json`), o raio pequeno fixo de
    prédio e o da torre de vigia, que agora existe (`data/buildings.json`). Os números vêm do GDD;
    o raio do prédio e o da torre não estão lá, e a sessão escolhe o menor que deixa a vila do
    tick 0 inteira à vista, com a escolha e a medida no PROGRESS (PARA REVISÃO);
  - `descoberto`: monotônico, por lado, **1 bit por tile**, empacotado em inteiros de 32 bits,
    no `GameState` e no save;
  - `visivel`: derivado, recomposto no `step`, **fora** do estado serializado, com buffer
    reaproveitado (marca de geração ou carimbo só de quem se moveu, GDD §6.5 item 2);
  - só para o lado do jogador. A IA ignora a névoa, e camada sem consumidor não nasce.
- **Aceite:**
  - (a) no tick 0 da escaramuça e do jogo livre, todo tile de prédio e unidade do jogador está
    visível e descoberto;
  - (b) `descoberto` nunca perde um bit em 6 000 ticks da escaramuça, e ganha bits quando a
    tropa marcha (pelo `step`);
  - (c) salvar, carregar e rodar N ticks dá o mesmo estado e o mesmo `visivel` que não salvar;
  - (d) eixo determinístico: os tiles carimbados por tick crescem com as unidades que se moveram,
    e não com `largura × altura` (contagem, com 1 e com 50 unidades andando; razão no PROGRESS);
  - (e) o tamanho do estado serializado antes e depois vai para o PROGRESS, como medida;
  - (f) o campo novo entra na guarda `GUARDA-step-preserva-opcionais` e passa na suíte
    transladada.

### F-COMBATE-ALVO-NA-VISTA — Ordem só contra o inimigo que se vê (sim)
- **Escopo:** `AttackUnit` e `AttackBuilding` do jogador contra alvo que não está em tile
  `visivel` agora são recusados com motivo próprio (`alvo-fora-da-vista`), e o estado fica igual.
  A IA não muda.
- **Medida antes do código:** quantos testes e roteiros que existem dão ordem a alvo fora da
  vista. Eles ganham a vista **pelo caminho do jogo** (uma unidade do jogador perto do alvo), e
  nunca desligando a regra. Se dar a vista mudar o que o teste afirma, o caso vai para o PROGRESS
  como pergunta, e o item segue com os outros.
- **Aceite:**
  - (a) alvo fora da vista: recusa com o motivo, estado igual byte a byte;
  - (b) o mesmo alvo com uma unidade do jogador a menos de `visao` dele: aceito;
  - (c) o alvo que sai da vista no meio do ataque: a regra escrita no PROGRESS (a leitura
    conservadora é a do KaM, que segue o alvo já escolhido; a sessão confere no clone e cita
    `arquivo:linha`, §15) e um teste dela;
  - (d) a IA ataca como antes: os testes da C e da escaramuça saem iguais.

### F-TELA-NEVOA — A névoa na tela, no painel e no minimapa (render + ui)
- **Escopo:** o render lê o `descoberto` e o `visivel` do lado do jogador por um seletor da sim.
  O não descoberto fica escuro; o descoberto fora da vista, esmaecido. Unidade e prédio inimigos
  fora da vista não são desenhados e não aparecem no painel, no minimapa, nos alertas nem no
  clique. O terreno e o prédio próprio aparecem como estão (GDD §6.5, nível de apresentação).
- **Aceite:**
  - (a) screenshot da escaramuça no tick 0 (a vila clara, o resto escuro) e depois de a tropa
    marchar (o caminho descoberto, a tropa inimiga só onde se vê);
  - (b) o minimapa não mostra inimigo fora da vista (pelo dado que ele desenha, no roteiro);
  - (c) clicar onde há um prédio inimigo fora da vista não abre o painel dele (despausado,
    150 ms, §8);
  - (d) o custo da camada nova no quadro, pelos contadores da D-TELA-CUSTO-DO-QUADRO, vai para o
    PROGRESS como medida;
  - (e) os roteiros que existem continuam saindo 0. Roteiro cuja captura muda só pela névoa é
    listado no PROGRESS, com o porquê.

### F-IA-DIFICULDADE — Três níveis de adversário (sim + ui; integração declarada aqui)
- **Escopo:** fácil, normal e difícil em `data/combat.json` (`ia.niveis`). Cada nível troca os
  números que a IA já lê (o tamanho do grupo de ataque, a tropa atacante da escaramuça, o ritmo do
  prefeito) e nada além. **Normal é o jogo de hoje**, sem mudar um número. A escolha entra no
  configurar partida da E (E-TELA-CONFIGURAR-PARTIDA) e no save. Os números de fácil e difícil
  são uma primeira proposta, e vão para o `BALANCE_LOG.md` para o lote de balanceamento.
- **Aceite:**
  - (a) com o normal, o estado é igual ao da escaramuça de hoje, byte a byte;
  - (b) o mesmo nível com os mesmos comandos dá o mesmo estado;
  - (c) com o jogador parado, o tick do primeiro ataque e o tamanho dele ficam em ordem: difícil
    ataca antes ou com mais do que normal, e normal antes ou com mais do que fácil (eixo de tick
    e de contagem; a tabela no PROGRESS);
  - (d) o `validate:data` recusa nível sem `normal` e campo de nível que a IA não lê;
  - (e) screenshot do configurar partida com o nível, e o nível sobrevive ao salvar e carregar.

## Fase G — Animação das unidades (pixel art do PixelLab; planejada em 2026-10-04)

O que já está na `main` (D-ARTE-PIXEL-ART-CIVIS e D-ARTE-PIXEL-ART-MILITARES, 2026-10-03): o serf
(`parado`, `andar` e `carregando`), as 13 profissões civis (`parado` e `andar`), o obreiro com
`trabalhar` e os 9 militares (`parado`, `andar` e `atacar`), tudo em pixel art. Cada um tem 5
direções canônicas, e o oeste sai por espelho. A Fase G fecha o que ainda falta para a unidade
contar o que faz.
O operador mandou planejar e seguir a noite toda (2026-10-04), numa worktree própria, porque a fila
E–I está com outra sessão.

Regras para os quatro itens:
- **São de arte e manifesto.** O render já escolhe a ação (`src/render/acao-de-unidade.ts`) e
  desenha a morte (`src/render/mortes-de-unidades.ts`); só falta o quadro no atlas. Nada em `src/sim/`.
  Se algum item precisar mudar código do render, o aceite ganha uma emenda num commit próprio antes.
- **O método é o da D-ARTE-PIXEL-ART:** PixelLab v3, personagem de 76 px (os montados têm 104). O
  andar sai do `skeleton-v3 walking-8-frames`, e as outras ações do `v3` com descrição, 8 quadros,
  uma direção por chamada. Cada personagem fica com o id em
  `cangaco-game-candidatos/arte/pixelart/ids.json` e no `origem.nota` do manifesto.
- **Toda animação nova é conferida numa folha de revisão aberta antes de entrar no atlas.** O que
  sair ruim é gerado de novo, ou fica de fora e entra no relatório. Não entra no jogo arte que eu
  não vi.
- **Orçamento:** ~500 das 1 363 gerações que restam no ciclo (renova em 2026-11-03). Se um item
  passar do dobro da estimativa dele, ele para e entra em `## Perguntas em aberto`.
- **Merge na `main`** só com `git status` limpo lá e sem a outra sessão no meio de um item. Se não
  der na madrugada, a branch fica pronta e o operador decide.

### G-ARTE-TRABALHO-DOS-OFICIOS — Quem trabalha fora de casa mexe a ferramenta
- **Escopo:** a ação `trabalhar` (8 quadros, em laço) para os quatro ofícios que o render já põe
  em `trabalhar` fora do prédio (`colhendo` e `semeando` em `src/sim/systems/especialistas.ts`):
  o pedreiro (picareta na rocha), o lenhador (machado na árvore), o fazendeiro (enxada, que serve
  para colher e para semear, no roçado e no canavial) e o pescador (lança a tarrafa). Os ofícios
  de dentro de casa não aparecem trabalhando e ficam de fora. Estimativa: 40 gerações.
- **Aceite (antes do código):**
  1. as entradas `stonemason`, `woodcutter`, `farmer` e `fisherman` têm `trabalhar` no atlas, nas 5
     direções, com o pé na linha 90 em todos os quadros;
  2. **no jogo, sem `?depuracao`:** um roteiro novo carrega o save do lenhador do D-TELA-05c, e o
     lenhador passa por pelo menos 3 quadros `woodcutter/trabalhar/…` do atlas real. Captura aberta;
  3. o validador do manifesto (`F17f`), o carregamento (`F-SPR-carregamento`) e o D-TELA-05c
     passam.

### G-ARTE-MORTE-DAS-UNIDADES — A unidade cai, e não some
- **Escopo:** **verificado em 2026-10-04:** `assets/manifest.json` não tem nenhuma animação
  `morrer` (a depuração tem 4). Como `mortes-de-unidades.ts` só desenha o corpo de quem tem
  `morrer`, toda unidade da arte nova some sem cair. O item dá `morrer` a todo tipo com atlas: os
  23 de hoje (serf, as 13 profissões e os 9 militares) e os 5 mercenários do item seguinte. São 8
  quadros de queda (PixelLab, `falling-back-death`) e mais 4 quadros que esmaecem o corpo no chão.
  Esses 4 são feitos localmente, pela transparência do último quadro (75, 50, 25 e 10 %), sem
  geração. Fica `laco: false` e `fps: 10`. Estimativa: 230 gerações.
- **Aceite (antes do código):**
  1. toda entrada `unidade` com `atlas` tem `morrer` com 12 quadros nas 5 direções, e o último
     quadro tem menos alfa que o primeiro. O teste lê o atlas e soma o alfa, sem varrer texto;
  2. **no jogo, sem `?depuracao`:** um roteiro carrega o save da morte do D-TELA-05c (o militar
     faminto). O corpo começa no quadro 0 do atlas real, passa por um quadro do meio e some ao fim
     da sequência. Captura aberta;
  3. não-regressão: o D-TELA-05c (com depuração) e os testes de manifesto passam.

### G-ARTE-MERCENARIOS — Os cinco mercenários da Prefeitura ganham corpo
- **Escopo:** os cinco tipos de `mercenarios` (`data/units.json`) não têm entrada no manifesto e
  aparecem como placeholder (D-TELA-05e). Cada um ganha personagem, `parado`, `andar`, `atacar` e
  `morrer`, pela camada sertão (`data/theme-sertao.json`): o Retirante (`rebel`, foice e roupa
  rasgada), o Emboscador (`rogue`, que atira de longe com a funda: `aDistancia`, projétil
  `funda`), o Andarilho (`vagabond`, montado num jumento ou cavalo magro), o Bruto do Mato
  (`barbarian`, porrete) e o Jagunço (`warrior`, rifle e peixeira). A célula é 64×96, e o montado
  fica em 128×128, como o vaqueiro. Estimativa: 170 gerações.
- **Aceite (antes do código):**
  1. as cinco entradas novas no manifesto passam no validador (`F17f`), com `id`, `tipo`,
     `footprint`, `tamanho`, `anchor`, `estados` (o `parado.png` de reserva), `atlas`, `animacoes`,
     `licenca` e `origem`, e o carregamento (`F-SPR-carregamento`) acha os cinco atlas;
  2. o teste das 8 direções da D-TELA-05e continua passando para os 28 tipos;
  3. uma folha com os cinco (parado e um quadro de ataque) é aberta. O roteiro em jogo fica de fora:
     contratar mercenário pela tela pede a Prefeitura de pé, e isso já tem roteiro próprio (F36).

### G-ARTE-RETOQUES-PIXEL-ART — Os defeitos vistos na D-ARTE-PIXEL-ART
- **Escopo:** gerar de novo só o que foi registrado como defeito nas duas entradas do PROGRESS. O
  aguilhadeiro perde a vara no ataque para o norte e o nordeste. O criador perde o cajado no andar
  para o leste e o nordeste. O andar dos dois montados mexe pouco as pernas do cavalo; a nova
  tentativa é o `v3` com o trote descrito. Lenhador, fazendeiro, padeiro e mineiro encostam a
  ferramenta na borda da célula de 64 px. Esse último fica só medido e registrado, porque mudar a
  célula é decisão do operador. Estimativa: 60 gerações.
- **Aceite (antes do código):**
  1. para cada retoque, a folha de antes e a de depois são abertas. Entra só o que ficou melhor, e o
     que não ficou é registrado no PROGRESS com o motivo;
  2. os testes de manifesto e o D-ARTE-PIXEL-ART-MILITARES continuam passando.


### Leva de bugs visuais do operador (2026-10-04, worktree `cangaco-game-serf-pixelart`, branch `dellanio/bugs-visuais-2026-10-04`)

O operador jogou e mandou sete defeitos visuais, com prints das bandeiras. Todos são de render e
arte, e **nada mexe em `src/sim/`**. Onde o item muda o render, ele é **feature de integração de
render e arte**, declarada aqui. A ordem de execução é a da lista, e o método da arte é o da Fase G.

#### G-TELA-ESTOQUE-SEM-PLACA — O estoque do prédio sem fundo preto, 20% maior
- **Pedido:** "o estoque de cada material dentro do edifício ainda está com fundo preto. Remover o
  fundo preto e aumentar o tamanho do material em 20%."
- **Causa (verificada em `src/render/scenes/WorldScene.ts`, `desenharPilhas`):** a pilha que cai no
  ícone da mercadoria desenha antes uma placa na cor `COR_DA_PLACA_DO_ICONE`. A placa servia para o
  ícone de traço claro do HUD, mas os 28 sprites de pixel art já têm fundo transparente.
- **Aceite (antes do código):** (1) a pilha desenhada com o ícone não cria placa; (2) o lado do
  ícone na pilha passa a ser 1,2 vez o de hoje, e o fator fica num dado de render; (3) a captura de
  um armazém com estoque é aberta.

#### G-ARTE-BANDEIRA-NO-TELHADO — A bandeira presa na cumeeira
- **Pedido (com prints):** a bandeira flutua à esquerda da casa do pescador, da pedreira, da
  serraria, do lenhador, da fazenda e do canavial, e as setas apontam a ponta da cumeeira.
- **Causa (verificada):** essas casas não têm `ancoras.bandeira` no manifesto, e o render usa a
  posição padrão. A escola, a bodega, o moinho e a padaria também estão sem âncora.
- **Aceite (antes do código):** (1) os 10 prédios sem âncora ganham `ancoras.bandeira`, medida no
  sprite `completo` na ponta da cumeeira; (2) um teste afirma que todo prédio tem a âncora e que o
  ponto cai a até 3 px de um pixel opaco do sprite; (3) a captura das seis casas dos prints é
  aberta.

#### G-ARTE-SERF-CARGA-PARADA — O serf carrega com as mãos paradas no centro do corpo
- **Pedido:** "os serfs ao carregar material estão balançando as mãos; deixe as mãos paradas e
  com foco no centro do corpo (estão carregando peso)".
- **Aceite (antes do código):** (1) a `carregando` do serf é gerada de novo nas 5 direções, com as
  mãos juntas à frente do corpo; (2) **medida, e não a olho:** nos 8 quadros de cada direção, o
  centro dos pixels de pele na faixa das mãos varia no máximo 4 px na horizontal, e o teste guarda
  a medida; (3) o ponto de `data/carga-nas-maos.json` é conferido, e a captura de um serf
  carregando é aberta.

#### G-ARTE-OBREIRO-MAIOR — O obreiro 10% maior
- **Pedido:** "aumente o tamanho do laborer em 10%; ele está pequeno em relação ao serf".
- **Como:** ampliar a pixel art por 1,1 estraga o pixel. O personagem é gerado de novo a 84 px a
  partir do de hoje (PixelLab v3 com imagem de referência), e as animações dele são geradas de novo
  junto com as do item seguinte.
- **Aceite (antes do código):** (1) a altura do obreiro no `parado` sul (a caixa dos pixels
  opacos) fica entre 1,07 e 1,13 vez a de hoje, com a tabela no teste; (2) o pé continua na
  linha 90.

#### G-TELA-OBREIRO-POR-TAREFA — O obreiro faz o gesto da tarefa
- **Pedido:** na estrada e na terra arada, ele não bate o martelo: agacha mexendo na terra, põe
  pedras na estrada e ara com a enxada no roçado e no canavial. No prédio, bate o martelo de cima
  para baixo e avança alguns pixels para dentro do lote da obra.
- **Feature de integração de render e arte.** O render já sabe a tarefa da unidade (`tarefa.tipo`
  em `estado.jobs`: `construir` e `reparar`, `assentar-estrada`, `arar`) e só lê.
- **Aceite (antes do código):**
  1. **a regra pura** "tipo da tarefa → animação", por tabela: `construir` e `reparar` → `martelar`;
     `assentar-estrada` → `assentar`; `arar` → `arar`; sem tarefa, ou sem a animação no manifesto,
     → `trabalhar` (o de hoje);
  2. **o avanço:** martelando, o desenho do obreiro anda N px na direção da obra, com N num dado de
     render, e a posição lógica não muda;
  3. o obreiro tem `martelar`, `assentar` e `arar` (8 quadros, 5 direções) no atlas;
  4. roteiro em jogo, sem `?depuracao`: um obreiro na obra passa por quadros `laborer/martelar/…`,
     e um na estrada por `laborer/assentar/…`. As capturas são abertas.

#### G-TELA-ROCEIRO-NO-CAMPO — O roceiro trabalha dentro do campo, com a ferramenta da fase
- **Pedido:** ele não faz a animação dentro do tile. Com o milho ou a cana verdes, usa a enxada com
  as duas mãos; na colheita, corta com foice ou facão; e volta para casa levando o milho ou a cana
  nas mãos, como o serf.
- **Causa (verificada em `especialistas.ts`):** a sim leva o roceiro ao tile **vizinho** do campo
  (`caminhoAteAproximacaoDoTile`), e ele trabalha dali. **Interpretação conservadora:** a sim não
  muda, porque mudar o caminho mexe no tempo do ciclo, e isso é balanceamento. O render desenha o
  roceiro deslocado para dentro do tile que ele trabalha, como o avanço do obreiro. Se o operador
  quiser o roceiro no tile de verdade, isso fica para a sim, registrado como pergunta.
- **Feature de integração de render e arte.**
- **Aceite (antes do código):**
  1. a regra pura "estado → animação do roceiro", por tabela: `semeando` → `semear` (enxada com as
     duas mãos); `colhendo` → `colher` (facão); `voltando` com a tarefa de colheita
     (`fsmData.tarefa`) → `carregando`, com o sprite da colheita entre as mãos; o resto fica como
     hoje;
  2. trabalhando, o centro do desenho do roceiro fica a menos de 1/4 de tile do centro do tile da
     tarefa, e a posição lógica não muda;
  3. o fazendeiro tem `semear`, `colher` e `carregando` no atlas, nas 5 direções;
  4. roteiro em jogo: o roceiro semeia dentro do campo, colhe e volta carregando. As capturas são
     abertas.

#### G-ARTE-TRABALHO-DENTRO-DO-PREDIO — O trabalhador aparece trabalhando no espaço da casa
- **Pedido:** cada edifício foi desenhado com um espaço para mostrar o trabalhador produzindo;
  achar esse lugar e fazer a animação.
- **O que já existe (verificado):** a F-VIVO-b já desenha os quadros de trabalho na
  `ancoras.trabalho.area` de cada prédio, e quem aparece hoje é o placeholder dos prints
  ("ocioso_7"). As áreas já estão medidas no manifesto para 2 prédios do caso `transforma`
  (pedreira e canavial) e 11 do caso `dentro` (serraria, moinho, padaria, açougue, curtume,
  fundição, ferraria, oficina de armas, oficina de armaduras e as duas forjas). Falta a arte.
- **Aceite (antes do código):**
  1. cada um desses 13 prédios ganha a entrada `trabalho` no manifesto, com os laços do caso dele
     (`inicio`, `meio`, `fim` ou `laco1`, `laco2`, de 8 quadros cada), e o validador das camadas
     vivas (`violacoesDaCamadaViva`) passa;
  2. o trabalhador de cada um é o personagem da profissão daquele prédio, fazendo o gesto da
     receita;
  3. a folha com os 13 é aberta, e também uma captura em jogo de um prédio trabalhando;
  4. o prédio cuja área medida não mostrar o trabalhador entra no relatório com uma captura, para
     o operador apontar o lugar.

#### G-ARTE-TRABALHADOR-RECORTADO — O trabalhador da casa na escala da rua, recortado pela área
- **Pedido (2026-10-04, depois de ver o G-ARTE-TRABALHO-DENTRO-DO-PREDIO):** "não precisa sempre
  exibir o corpo dele completo. Pode cortar uma parte e só exibir exatamente a parte do corpo,
  simulando o trabalhador dentro do prédio naquela visualização de câmera."
- **Medida (verificada):** os 13 prédios são desenhados na escala 1,0 (`escalaDoSprite`, régua de 64
  px por tile), e as unidades da rua também. Por isso o boneco da PixelLab, na escala 1, já tem o
  tamanho de quem anda na rua. Até aqui ele era reduzido para caber inteiro na área: a fundição ficou
  a 40% e o curtume, miúdo.
- **Regra do recorte:** o boneco não é reduzido. Se ele cabe na área, entra inteiro com o pé
  embaixo, como hoje. Se não cabe, a janela de altura da área começa no alto da cabeça, e o resto
  do corpo fica atrás da parede, cortado na borda de baixo da área. Na largura, se não couber, a
  janela é centrada no movimento dos 8 quadros, ou seja, nas mãos e na ferramenta.
- **Aceite (antes do código):**
  1. a origem de cada entrada `trabalho` registra `escala: 1`, e os quadros continuam com o tamanho
     da área e passam no `violacoesDaCamadaViva`;
  2. em todo prédio cuja área é mais baixa que o boneco, os 8 quadros têm pixel opaco na última linha
     (o corte encosta na borda, e o boneco não flutua) e o alto da cabeça fica a até 3 px do topo;
  3. a folha dos 13 sobre o sprite é aberta, e também a captura em jogo de prédios trabalhando;
  4. o prédio em que o recorte não mostrar o gesto (só a cabeça, por exemplo) entra no relatório com a
     captura, para o operador decidir.


## Fase H — O som

A F fechou e foi mesclada (`41d74fe`, 2026-10-03, aprovada pelo operador depois de jogar). O som
entra por decisão humana, como a arte (§9). **Decisão do operador (2026-10-03): os sons vêm de
bancos livres com licença CC0 (Freesound, OpenGameArt e afins), a sessão lista os candidatos com o
link e a licença, e o operador aprova cada um.** Nenhum som entra sem a aprovação dele.

O código não espera o som: **som que falta é silêncio**, como o placeholder da arte. A H entrega a
camada de som inteira com silêncio, e os arquivos entram à medida que o operador aprova.

Módulos: o código é TELA (o render toca, a interface mostra o volume); o arquivo de som é ARTE (o
asset em si, com entrada no `assets/manifest.json`), por ser a leitura mais próxima da lista
fechada. Módulo próprio para som é decisão do operador (PARA REVISÃO).

### H-ARTE-SONS-CANDIDATOS — A lista de sons para o operador aprovar
- **Escopo:** `docs/sons-candidatos.md`, com uma linha por som que a H usa (os efeitos do GDD §10,
  o ambiente do §9.8 e as duas músicas): o id neutro do som, o evento ou a situação que o toca, de 1
  a 3 candidatos com link, autor e licença conferida na página, e uma coluna "aprovado" vazia, que
  só o operador preenche. A sessão **não baixa** nada nesta etapa.
- **Aceite:** (a) todo id da tabela de eventos da H-TELA-CAMADA-DE-SOM tem pelo menos um candidato;
  (b) todo candidato tem licença CC0 conferida na página, com o link; (c) o arquivo está no git e o
  PROGRESS registra que ele espera o operador.

### H-TELA-CAMADA-DE-SOM — O render toca os eventos da sim
- **Escopo:** a camada de som em `src/render/`, que lê `state.events` depois de cada `step` (como o
  render já lê) e toca o som do evento. A tabela evento → id de som fica em `data/som.json`, que a
  `sim/` nunca lê. Os primeiros eventos: `building-completed`, `goods-produced`, `unit-trained`,
  `unit-struck`, `unit-killed`, `projectile-fired`, `stone-thrown`, `building-attacked`,
  `peace-ended`, `match-ended`, `command-rejected`, e a planta posicionada (que vem do input, sem
  evento). Som que não existe no manifesto é silêncio, sem erro de console. O mesmo evento repetido
  no mesmo quadro toca uma vez (teto por id, no dado). Evento de fora da vista do jogador (a névoa
  da F) não toca. A velocidade de jogo não muda o som.
- **Aceite:**
  - (a) a função pura "eventos do tick → sons a tocar" por tabela: o mapeamento, o teto por quadro,
    o evento fora da vista que não toca e o id sem arquivo que vira silêncio;
  - (b) nenhum import de `src/render/` ou de áudio em `src/sim/`, e a `sim/` não lê `data/som.json`
    (guarda estrutural, pelo grafo de import);
  - (c) roteiro com a partida andando e todo som faltando: zero erro de console, e o contador de sons
    pedidos (exposto ao roteiro) maior que zero;
  - (d) o `validate:data` recusa evento que a sim não emite e id de som fora do manifesto, quando o
    manifesto tiver o som.

### H-TELA-OPCOES-E-VOLUME — A tela de opções
- **Escopo:** a tela de opções, aberta pelo menu inicial (E-TELA-MENU-INICIAL) e pela ajuda em jogo,
  com o volume geral, dos efeitos, do ambiente e da música, e o mudo. A escolha fica no
  `localStorage`, fora do save da partida. Rótulos em `data/theme-sertao.json`.
- **Aceite:** (a) a regra pura do volume efetivo (geral × canal, mudo zera) por tabela; (b) o volume
  sobrevive a recarregar a página e não entra no save (o estado salvo é igual com e sem mudar o
  volume); (c) roteiro: abrir pelo menu e pelo jogo, mexer no volume (despausado, 150 ms, §8) e
  screenshot.

### H-TELA-AMBIENTE-E-MUSICA — O sertão de fundo
- **Escopo:** o ambiente em laço (vento seco, cigarra), que segue a câmera; o sino da bodega quando
  a Bodega está na vista; a música da paz e a do combate, trocadas com transição suave pelo estado
  (a paz da E, a luta perto da vila do jogador). Tudo em silêncio enquanto o arquivo não existe.
- **Aceite:** (a) a regra pura "estado → faixa de música" por tabela (paz, combate perto, combate
  longe, fim de partida); (b) a troca não corta no meio: a transição tem duração no dado; (c) o
  roteiro mede, pelo contador, que o ambiente toca no jogo e para no menu.

### H-ARTE-SONS-APROVADOS — Os sons aprovados entram no jogo
- **Escopo:** depois da aprovação do operador no `docs/sons-candidatos.md`, os sons aprovados são
  baixados, convertidos para o formato que o build serve, e entram em `assets/sons/` e no
  `assets/manifest.json` com `licença` e `origem` (o link). **Este item espera o operador** e só
  começa com a coluna "aprovado" preenchida. Sem ela, a sessão registra no PROGRESS e fecha a fase
  com ele aberto.
- **Aceite:** (a) todo som do manifesto tem licença CC0 e o link; (b) nenhum som sem aprovação no
  `docs/sons-candidatos.md`; (c) o build (E-ENTREGA-BUILD) leva os sons, e o tamanho deles vai para
  o PROGRESS como medida.

### H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA — O som de cada prédio vem do lugar dele (pedido do operador, 2026-10-04)
- **Pedido do operador, nas palavras dele:** "o som de cada edifício só deve aparecer quando o foco
  da tela estiver próximo da visão daquele edifício; se o foco sair de perto o som para de tocar, e
  quanto mais longe, o volume diminui". E faltam três sons: "o laborer construindo as coisas, tanto
  as ruas como os edifícios (som de batendo tábua)", e "a pedreira trabalhando, quebrando pedra ou
  batendo em pedras".
- **Ordem:** uma worktree por vez (decisão do operador). Este item roda **depois que a Fase I
  fechar**, e não na worktree dela.
- **Escopo (só tela; a sim não muda):**
  - **Som com lugar.** Todo som que nasce de um prédio ou de uma unidade tem posição: o
    `goods-produced`, o `building-completed`, o `building-hit`, o sino da Bodega e os três sons de
    trabalho novos. O volume dele cai com a distância entre essa posição e o **centro da câmera**,
    até um raio no dado (`data/som.json`). Fora do raio ele não toca, e o que está tocando em laço
    para. O que não tem lugar (fim da paz, vitória, derrota, recusa de comando, o ambiente e a
    música) não muda.
  - **Os três sons de trabalho**, derivados do estado por seletor puro, como a animação de trabalho
    (`src/render/acao-de-unidade.ts`), sem evento novo na sim: `build-wood` com o laborer
    `martelando` numa obra de prédio; `build-road` com o laborer `nivelando` ou `martelando` num
    tile de estrada; `quarry-work` com o cabouqueiro trabalhando a pedra. Tocam em laço enquanto o
    estado dura e há alguém trabalhando ali, com teto de vozes no dado.
  - **O tile de rua pedido** (pedido do operador, 2026-10-04: "um som simples para toda vez que eu
    solicitar a construção de um tile de rua"): `road-placed`, tocado pelo input a cada tile de rua
    que o `PlaceRoad` aceita, como a planta posicionada (`blueprint-placed`). Arrastar uma rua de N
    tiles toca no máximo um por quadro (o teto que já existe), e o tile recusado toca a recusa, não
    este. É som de interface, sem lugar: não cai com a distância.
  - Os candidatos CC0 estão em `docs/sons-candidatos.md` (`build-wood`, `build-road`,
    `quarry-work`, `road-placed`), com a licença conferida na página em 2026-10-04. **Nenhum se baixa sem a coluna
    "aprovado" preenchida pelo operador**; até lá, silêncio.
- **Aceite:**
  - (a) a função pura "posição do som + centro da câmera → volume" por tabela: o volume cheio no
    centro, caindo com a distância, e zero no raio e além dele;
  - (b) a função pura "estado → sons de trabalho a tocar" por tabela: o laborer na obra, o laborer
    na estrada, o cabouqueiro, ninguém trabalhando (silêncio), e o teto de vozes;
  - (c) roteiro com a câmera sobre uma obra, depois longe dela: o contador de sons mostra o laço
    tocando perto e parado longe, e o volume pedido menor a meia distância do que no centro;
  - (d) a mesma partida com e sem som dá o mesmo estado, byte a byte;
  - (f) a função pura do som do tile de rua por tabela: um tile aceito toca uma vez, N tiles no
    mesmo quadro tocam uma vez, e o tile recusado não toca o `road-placed`;
  - (e) os sons aprovados entram como na H-ARTE-SONS-APROVADOS, com licença e link no manifesto.

## Fase I — Para quem nunca jogou

A H fechou e foi mesclada (`55393a5`, 2026-10-04, aprovada pelo operador). O alvo da I é o critério de
"pronto" do operador: **alguém que nunca viu o jogo abre o link, entende e joga uma partida
inteira.** O que já existe e a I amplia: a tela de ajuda com as teclas (`ui/ajuda.ts`, que lê
`input/atalhos.ts`), o lembrete da primeira partida e o menu inicial da E.

Regras para os quatro itens:
- Todo texto que o jogador lê vem de `data/theme-sertao.json`. A `sim/` não lê o tema e não sabe
  que existe tutorial.
- O que é preferência de quem joga (já viu a dica, desligou as dicas) mora no `localStorage`, nunca
  no `GameState`, como a marca do lembrete de hoje.
- A condição de cada passo e de cada dica é **derivada do estado** por seletor puro. Nada no estado
  marca o tutorial.

### I-TELA-PARTIDA-GUIADA — Aprender a jogar
- **Escopo:** uma entrada **Aprender a jogar** no menu inicial abre o jogo livre com uma faixa de
  passos. Cada passo diz o que fazer, e passa sozinho quando a condição dele vale no estado. Os
  passos seguem a abertura do GDD §1.3: estrada até o armazém, escola, lenhador, pedreira,
  serraria, a primeira comida, e por fim o quartel e a escaramuça. A faixa se pula e se reabre. A
  lista de passos e a condição de cada um ficam num dado da tela, sem a `sim/` saber.
- **Aceite:**
  - (a) a função pura "estado → passo atual" por tabela, com a condição de cada passo;
  - (b) **headless, como prova de que o tutorial se cumpre:** os comandos que o passo pede, dados um
    a um ao `step`, levam do primeiro ao último passo, e nenhum passo pede o que a regra recusa;
  - (c) a mesma partida com e sem a faixa dá o mesmo estado, byte a byte (o tutorial não mexe na
    sim);
  - (d) roteiro pelo menu: a faixa aparece, o primeiro passo se cumpre com o gesto do jogador
    (despausado, 150 ms, §8), e o passo seguinte aparece. Screenshot de 3 passos.

### I-TELA-DICAS-NA-PRIMEIRA-VEZ — O jogo explica quando acontece
- **Escopo:** uma dica curta, uma vez por máquina, na primeira vez que acontece algo que confunde
  quem chega: prédio pronto sem trabalhador, prédio sem estrada, a primeira fome, a primeira névoa
  com inimigo, o fim da paz, a primeira ordem recusada (com o motivo que já existe). A dica aponta
  o lugar, como os alertas. Ela se desliga nas opções da H (H-TELA-OPCOES-E-VOLUME).
- **Aceite:** (a) a função pura "estado + o que já vi → dica a mostrar" por tabela, uma dica por vez
  e nunca repetida; (b) desligada nas opções, nenhuma dica aparece; (c) a marca fica no
  `localStorage`, e o save fica igual com e sem dica vista; (d) roteiro de duas dicas, com
  screenshot.

### I-TELA-AJUDA-DAS-CADEIAS — A ajuda mostra as cadeias de produção
- **Escopo:** a tela de ajuda ganha uma aba **Cadeias**: de onde vem cada mercadoria e para onde vai,
  pelo nome do tema. Ela é **derivada de `data/buildings.json` e `data/production.json`**, nunca
  escrita à mão, como as teclas vêm de `input/atalhos.ts`. Prédio ainda bloqueado mostra o "requer
  X" do menu de construir.
- **Aceite:** (a) toda receita do dado aparece na aba, e nenhuma linha da aba fica sem receita
  (igualdade de conjuntos, sem varrer texto); (b) mudar uma receita no dado muda a aba sem tocar no
  código (teste com dado alterado); (c) screenshot da aba.

### I-ENTREGA-PLAYTEST — Gente de fora joga
- **Escopo:**
  - `docs/playtest.md`: o roteiro para quem testa (o que tentar, sem ensinar) e as perguntas depois
    da partida;
  - um botão **Enviar relato** na ajuda em jogo, que baixa um arquivo com o save, o commit do build,
    o nível da IA e o texto que a pessoa escrever. Nada sai da máquina sozinho: a pessoa manda o
    arquivo para o operador;
  - **o playtest em si é do operador:** ele escolhe quem joga, recolhe os relatos, e o que eles
    trazem vai para `BUGS.md` e `BALANCE_LOG.md`.
- **Aceite:** (a) o arquivo do relato carrega de volta no jogo e dá o mesmo estado (o save dentro
  dele é o save de sempre); (b) o relato não leva nada além do que a tela diz que leva (pela lista
  de campos, no teste); (c) o `docs/playtest.md` está no git. **O fechamento da I é do operador:**
  os relatos registrados e a página do itch.io aberta para outras pessoas.

---

## Leva de 2026-10-04 — dez itens do operador, na ordem dele

Pedido do operador (2026-10-04): depois dos itens em curso, estes dez, nesta ordem. Uma worktree por
vez: a leva continua na **mesma worktree da Fase I**, depois que a I fechar. No fim, a sessão principal faz o
merge na `main` (pedido do operador, 2026-10-04: "faça merge na main no final"). O que pede decisão dele não é decidido: vai para "Perguntas em aberto", e a leva segue.

1. **H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA** (o som com lugar e os sons de trabalho), com o aceite já
   escrito na Fase H. Aprovados pelo operador: `build-wood` 1, `build-road` 1, `quarry-work` 2,
   `road-placed` 2 (primeiro impacto) e `command-rejected` 2. Os outros seguem em silêncio.
2. a 5. **A Fase I**: I-TELA-PARTIDA-GUIADA (aprender a jogar), I-TELA-DICAS-NA-PRIMEIRA-VEZ (o jogo
   explica quando acontece), I-TELA-AJUDA-DAS-CADEIAS (a ajuda mostra as cadeias) e
   I-ENTREGA-PLAYTEST (gente de fora joga), já em curso na worktree da I.
6. **BUG-SAVE-DO-ROTEIRO-TRANSLADADO** (os roteiros da 05c e da 05d leem o save do mundo
   transladado). Correção escrita no bug: gravar os saves em
   `${process.env.CANGACO_EVIDENCIA_DIR ?? 'test-output'}`. **Aceite:** `npm run verify` completo e
   depois `npm run shot -- D-TELA-05c` e `-- D-TELA-05d` saem 0, nessa ordem. As duas chaves voltam
   a passar no fechamento.
7. **BUG-ROTEIRO-04E-DELTA-DO-ATLAS** (o roteiro da D-TELA-04e mede menos memória que o atlas).
   Primeiro se mede a causa, que hoje é hipótese. Se o roteiro estiver errado, ele passa a medir o
   que a cena normal carrega de fato. Se a memória estiver errada, o defeito vai para o código.
   **Aceite:** o roteiro sai 0, e o PROGRESS diz qual dos dois era, com a medida.
8. **BUG-ROTEIRO-DE-DUAS-ETAPAS** (a costura dos tiles e o véu dos detalhes não rodam sozinhos).
   **Decisão do operador (2026-10-04): A, separar.** O roteiro, rodado sem variável, é só de
   não-regressão: ele afirma o que vale sozinho, no código de hoje, sem medida de outra corrida. A
   comparação antes/depois vira um modo pedido por variável (`CANGACO_COSTURA_ETAPA`), e só ele exige
   a medida "antes". **Aceite:** (a) os dois roteiros saem 0 numa worktree nova, sem nada em
   `test-output/`, inclusive dentro do `shot:todos`; (b) o modo de comparação continua existindo e
   recusa rodar sem a medida "antes", com a mensagem de hoje; (c) as asserções de não-regressão que
   valem sozinhas são as mesmas de hoje, e o PROGRESS lista quais saíram para o modo de comparação.
9. **BUG-ROTEIRO-F-D2-RELOGIO** (o roteiro da F-D2 afirma sobre relógio de parede). Pela §8, a
   aceleração da câmera se afirma num eixo determinístico, pelos quadros ou pelo passo por quadro,
   e não pelos pixels andados num tempo de parede. **Aceite:** o roteiro afirma a aceleração sem
   tempo de parede e sai 0 três vezes seguidas, inclusive dentro do `shot:todos`.
10. **BUG-CIVIS-EMPILHADOS** (vários serfs desenhados no mesmo tile). **Decisão do operador (2026-10-04): A, religar a
    colisão civil.** Ela revoga o "DEFINITIVO" de 2026-09-28 no GDD §6.4 (desligada porque duas faixas
    de rua não aliviavam a fila). O GDD §6.4 passa a dizer que civis colidem, com esta data e o
    motivo: o jogador vê civis empilhados, e isso não pode. É a feature de integração do mecanismo
    que já existe (D-MOVIMENTO-01), e muda a sim.
    - **Escopo:** `units.json colisaoCivil.ligada: true`; o defeito conhecido da permuta de frente
      (chega um passo mais cedo, D-MOVIMENTO-01) corrigido pelo conserto já escrito lá; os testes
      que mudam por ela, consertados no guarda e não na asserção; a recalibração, se a medida
      pedir, em lote no `BALANCE_LOG.md`, nunca item a item.
    - **Medida antes do código:** ligar a chave e rodar a suíte inteira e a longa. Contar o que
      reprova e por quê (empilhamento, tick exato, calibração). Se a calibração da cadeia de comida
      ou da madeira cair mais de 10 %, parar e registrar para o operador antes de girar número.
    - **Aceite:** (a) a invariante "um civil por tile" vale em todo tick de 20 000 ticks da
      escaramuça e do jogo livre (pelo `step`), fora dos estados "dentro"; (b) **não trava, por
      progresso**: cada civil avança (tile, entrega ou tarefa) dentro de um prazo no dado, como a
      lição escrita na D-MOVIMENTO-01; (c) a permuta de frente leva o mesmo tempo que andar sozinho
      (20 tiles: 100 ticks nos dois); (d) a suíte normal, a transladada e a longa verdes; (e) o
      `BUG-CIVIS-EMPILHADOS` sai do `BUGS.md` no mesmo commit; (f) screenshot da estrada da pedreira
      com os serfs em tiles distintos.

## Leva de 2026-10-04 (2) — a colisão civil fica, e a escaramuça é cenário de teste

Decisões do operador (2026-10-04), nas palavras dele, e o que muda por elas.

**Sobre a colisão:** "A colisão é justamente um dos desafios do jogo, para não criar serf demais. O
jogador precisa saber desenhar bem as ruas e rotas para ter eficiência logística. Pode deixar a
colisão e não se preocupe com produções: o jogador é que vai precisar resolver esse ponto na
partida. A nível de teste, pode remover esse teste inclusive; não podemos correlacionar os itens."
- Isso revoga a regra "parar se a calibração cair mais de 10 %" do item 10 da leva anterior e a
  recalibração em lote. **A produção com a colisão ligada não é defeito: é o desafio.**

**Sobre a escaramuça:** o operador lembrou que ela é um cenário de teste do desenvolvimento.
Quando houver história e várias fases, cada fase terá uma lógica própria: uma em que a IA tem muito
exército e demora a atacar, outra em que ela começa com pouco e constrói, e assim por diante.
- **Regra que sai disso, para todo teste daqui em diante:** teste afirma **mecânica** (a regra
  funciona, a partida anda, termina, é determinística), e **nunca o resultado de balanceamento de
  um cenário** (quem vence, quanto se produz). O resultado de cada cenário se acerta jogando, no
  dado do cenário.

### I-MOVIMENTO-COLISAO-CIVIL-LIGADA — Civis colidem (integração; muda a sim)
- **Escopo:** `units.json colisaoCivil.ligada: true` de vez. O GDD §6.4 passa a dizer que civis
  colidem, com a data, a decisão do operador e o motivo dele (o desafio da logística, rua bem
  desenhada contra serf demais), e o registro de 2026-09-28 fica como histórico. O defeito
  conhecido da permuta de frente (chega um passo mais cedo, D-MOVIMENTO-01) é corrigido pelo
  conserto já escrito lá. O `BUG-CIVIS-EMPILHADOS` sai do `BUGS.md` no mesmo commit.
- **Os testes que reprovam ao ligar** (a lista da medida está no PROGRESS, item 10 da leva
  anterior), cada um por um caminho:
  - **afirma produção ou calibração** (quanto se produz, quantas armas chegam no prazo, teto de nós
    do A* medido sem colisão): **sai**, por decisão do operador, ou passa a afirmar só a mecânica
    que ele protegia, se ela existir sem o número. O PROGRESS lista cada um e o que foi feito;
  - **afirma a chave desligada** (D-MOVIMENTO-01a): passa a afirmar a chave ligada;
  - **fica vácuo** (F09, o save sem a reserva pendente): o cenário muda até a reserva existir de
    novo, porque o que o teste guarda é a reserva no save;
  - **pode ser defeito real** (F20b-4, comensais a caminho além de `refeicoesGarantidas`): medir
    primeiro. Se for defeito, conserta-se o código. Se a regra estiver certa e o teste supuser a
    chave desligada, ajusta-se o guarda, e não a asserção;
  - **save versionado** (D-SAVE-VILA-PRONTA): regravado com a colisão ligada;
  - **prazo de teste** (I-TELA-PARTIDA-GUIADA (c), 5 s): o limite explícito, que é para o caso
    travar e não afirma tempo (§8).
- **Aceite:**
  - (a) a invariante "um civil por tile" vale em todo tick de 20 000 ticks da escaramuça e do jogo
    livre (pelo `step`), fora dos estados "dentro";
  - (b) não trava, **por progresso**: cada civil avança (tile, entrega ou tarefa) dentro de um prazo
    no dado;
  - (c) a permuta de frente leva o mesmo tempo que andar sozinho (20 tiles: 100 ticks nos dois);
  - (d) a suíte normal, a transladada e a longa verdes, sem teste pulado: o que sai, sai do arquivo;
  - (e) screenshot da estrada da pedreira com os serfs em tiles distintos.

### I-COMBATE-ESCARAMUCA-GANHAVEL — A escaramuça de teste volta a ser ganhável
- **Escopo:** a tropa inicial do jogador (`escaramuca.tropaDoJogador.quantidade`, hoje 18) sobe até
  a escaramuça de teste ser ganhável com a névoa. Mede-se 21 e 24, e fica o menor que vence em todos
  os caminhos de ataque que o agente da Fase F tentou (6). É número do cenário, não balanceamento
  (o mesmo registro do `BALANCE_LOG.md` de 2026-09-29).
- **O roteiro C-IA-03c e o teste longo da C-IA-03b** passam a afirmar **mecânica**: a tropa marcha
  pelo escuro, ataca o que vê, a IA ataca depois da paz e a partida termina por `match-ended`,
  determinística. A vitória com a tropa de teste fica afirmada só como "este cenário de teste é
  ganhável", com o comentário de que é dado do cenário e muda quando ele mudar.
- **Aceite:** (a) o C-IA-03c sai 0, inclusive dentro do `shot:todos`; (b) a chave da F-TELA-NEVOA
  (a névoa na tela) passa no fechamento; (c) a tabela "tropa → caminhos que vencem" no PROGRESS.

## Leva de 2026-10-04 (3) — bugs de jogo do operador: escola, entrega direta, minas

O operador jogou e mandou três pedidos. Os dois primeiros mudam a sim. O terceiro (minas perto da vila
no mapa atual) espera a decisão dele sobre os saves, registrada no PROGRESS.

### I-TRANSPORTE-OURO-SEMPRE-NA-ESCOLA — A escola fica abastecida de ouro, com ou sem fila
- **Pedido:** "a escola sempre precisa estar abastecida com dinheiro."
- **Hoje (verificado em `src/sim/insumo.ts:82-91` e `src/sim/escola.ts:66-74`):** o alvo de ouro da
  escola é `aguardando × custoOuroPorUnidade`. Com a fila vazia, o alvo é zero, e o ouro só sai do
  armazém depois que o jogador pede o treino.
- **KaM (`src/houses/KM_Houses.pas:2221-2258`, `src/common/KM_Defaults.pas:299`):** toda casa pede o
  insumo até a cota dela (5), com ou sem fila. A escola é uma casa cujo insumo é o ouro.
- **Regra:** o alvo de ouro da escola passa a ser `max(ouroEmEstoque, aguardando × custo)`, com
  `ouroEmEstoque` em `data/economy.json` (`schoolhouse`, 5, o do KaM). O `ouroNecessario` continua
  sendo `alvo − emCaixa`. Vale para a escola de qualquer lado, inclusive a da IA.
- **Aceite (antes do código):**
  1. por tabela: com a fila vazia, o alvo é `ouroEmEstoque`; com a fila pedindo mais que a cota, é o
     da fila; e `ouroNecessario === alvo − emCaixa` em todos os casos;
  2. pelo `step`: uma escola completa e ligada, de fila vazia, com ouro no armazém, recebe ouro até
     `ouroEmEstoque` e para aí. O ouro não volta ao armazém pelo nível 7 (excedente zero);
  3. pelo `step`: depois de abastecida, um treino enfileirado começa sem esperar entrega (o ouro já
     está lá);
  4. os testes que afirmavam "fila vazia, nenhum ouro pedido" passam a afirmar a regra nova (a
     não-regressão vai nesta tarefa).

### I-TRANSPORTE-MATERIAL-DIRETO-DA-CASA — Pedra e tábua vão da casa direto à obra
- **Pedido:** "Pedra e Tábua devem ter como prioridade construções pendentes antes do estoque." O
  pedido do milho (fazenda → moinho antes do armazém) foi **medido e já acontece**: numa sonda de 6 000
  ticks na vila pronta, as 33 entregas de milho foram da fazenda direto ao moinho, e nenhuma ao
  armazém. Fica no PROGRESS como medida, sem mudança.
- **Hoje (verificado em `src/sim/systems/jobs.ts:441-454`):** a tarefa `material-para-obra` só tem
  origem em **armazém** (`origemMaisPerto`). A pedra da pedreira e a tábua da serraria vão sempre ao
  armazém primeiro (na sonda, 30 de pedra e 26 de tábua, todas `saida-cheia-para-armazem`), e só
  depois à obra.
- **KaM (o mesmo lance de `delivery.lance`, `KM_HandLogistics.pas:1587-1590`):** a oferta de uma casa
  vai direto a quem pede, e o armazém paga a multa.
- **Regra:** a origem do material de obra passa a ser escolhida como a do insumo (`origemDoInsumo`): o
  armazém (ligação mais `ticksMultaDoArmazem`) ou a casa completa do mesmo lado com a mercadoria
  livre na `saida`, no modo do tipo (`livre`). Vale também para a pedra do canteiro de estrada
  (`pedra-para-canteiro`, a mesma classe da obra, D3).
- **Aceite (antes do código):**
  1. pelo `step`: com uma obra nivelada pedindo pedra, uma pedreira com pedra na `saida` e um armazém
     com pedra, os dois ligados, a pedra da obra sai da **pedreira**. Sem pedra na pedreira, sai do
     armazém (como hoje);
  2. o mesmo para a tábua da serraria;
  3. a pedra do canteiro de estrada sai da pedreira, nas mesmas condições;
  4. sem obra pendente, a saída da pedreira continua indo ao armazém (`saida-cheia-para-armazem`);
  5. as invariantes do JobBoard (reserva e release) continuam valendo no cenário longo do teste.

### I-MOVIMENTO-FILA-DE-CIVIS — Civis em fila, um por tile, sem empurrar (integração; muda a sim)
- **Pedido (operador, 2026-10-04, duas vezes):** com a colisão civil ligada, serf e obreiro "ficam
  travando e indo pra frente e pra trás… é como se estivessem empurrando uns aos outros". Decisão: **um
  civil por tile, como no KaM; quem chega atrás espera parado na fila, e quem vem de frente cruza**.
  Saem o contorno, a troca forçada que empurra para trás e o empurrão teleportado. O ocioso no caminho
  dá um passo de lado, andando, e só o ciclo de espera destrava sozinho.
- **Medida (sonda, jogo livre, 8 000 ticks):** 89 desvios de lado, 15 empurrões para trás e 1 874 ticks
  segurados no fim do passo. Desligada, zero.
- **KaM (`731a8a4`):** o tile seguinte é reservado **no início do passo**, e a espera acontece no
  centro do próprio tile:
  - `fUnit.Walk(...) //Pre-occupy next tile`, `src/units/actions/KM_UnitActionWalkTo.pas:1312`;
  - `TKMTerrain.UnitWalk`, `src/terrain/KM_Terrain.pas:4266-4279`;
  - `DoUnitInteraction` falso para a unidade, `KM_UnitActionWalkTo.pas:1289-1291`.

  Hoje nós conferimos no fim do passo (`passoCivil`). **Divergência declarada:** o KaM também tem
  AVOID, SIDESTEP, DODGE e a troca forçada do `WAITING_TIMEOUT` (`:125-131`, `:1066-1073`); aqui saem,
  por decisão do operador, e fica o PUSH do ocioso, andando.
- **Feature de integração de sim e render:** a regra é da sim (`src/sim/colisao.ts`,
  `src/sim/units/movimento.ts`), e o desenho do segurado sai do seletor. Plano em
  `C:\Users\della\.claude\plans\delightful-wobbling-gray.md`.
- **Aceite (antes do código):**
  1. **Fila:** pelo `step`, A atrás de B, que trabalha parado no tile. A espera com `progresso 0` no
     próprio tile, desenhado no centro dele, e nunca muda de tile até B sair; então anda.
  2. **De frente:** 20 tiles de frente numa rua de uma faixa levam 100 ticks nos dois, o mesmo de andar
     sozinho, e nenhum progresso fica abaixo de 0.
     - **Emenda do aceite 2 (pela medida, antes do commit do código):** com a reserva do tile no início
       do passo, o encontro **num tile** (distância par: 20 tiles) põe os dois atrás do mesmo tile vago,
       e só um o tem. O outro espera um passo: 100 e 105. O encontro **numa aresta** (distância ímpar: 19
       tiles) cruza no tempo de andar, 95 e 95. Para os dois cruzarem no tempo de andar num tile, eles
       teriam de dividir o tile por um instante, o que a regra do operador proíbe. O 100 e 100 de antes
       vinha da dívida de progresso negativo, que era o desenho atrás do próprio tile. O aceite 2 passa
       a ser: aresta, os dois no tempo de andar; tile, um espera exatamente um passo; nenhum progresso
       abaixo de 0.
  3. **Ciclo de 3**, montado à mão: os três largam no mesmo tick, e ninguém muda de tile para fora do
     próprio caminho.
  4. **Ocioso no caminho:** sai para o vizinho livre **andando** (o tile dele muda só no fim de um passo
     do caminho dele). Quem esperava passa.
  5. **Sem empurrão:** na vila pronta (3 000 ticks) e no jogo livre (8 000 ticks), todo civil que muda de
     tile vai ao próximo tile do próprio caminho. Zero para-trás, de-lado ou teleporte, contra 15 + 89
     hoje. Um civil por tile na ocupação lógica em todo tick.
  6. **Não trava:** o `prazoDeProgresso` de hoje (450 ticks) vale na escaramuça e no jogo livre. Se
     reprovar, paro e reporto com a medida, sem afrouxar o prazo.
  7. **Determinismo** (mesma corrida, mesmo estado). **Desligada**, o estado é byte a byte o de hoje.
  8. O roteiro `I-MOVIMENTO-COLISAO-CIVIL-LIGADA` sai 0, e a captura é aberta.
- **Fora do aceite:** o efeito no ritmo da produção não é asserção (o teste afirma mecânica). Vai para
  o PROGRESS como número da corrida.

## Leva de 2026-10-05 (noite) — o pacote do operador para rodar até as 6h

O operador mandou o pacote numa mensagem só. Decisões dele, registradas aqui:
- **a faixa no teste da escola** (I-MOVIMENTO-FILA-DE-CIVIS, F13a): **(a)**, aceitar a faixa só no
  caso da porta cercada;
- **as minas perto da vila**: **do lado esquerdo da vila atual**, no mapa atual. O operador decidiu
  mudar o mapa, sabendo que os saves antigos deixam de carregar.

A ordem de execução é a desta lista. Cada item tem o aceite abaixo, escrito antes do código.

### I-TELA-CURRAL — "Malhada" vira "Curral" em todo o jogo
- **Pedido:** "Alterar nome Malhada para Curral em todos os pontos do jogo."
- **Aceite:** (1) nenhum texto que o jogador lê diz "Malhada" (o tema, a ajuda, as dicas, as cadeias);
  um teste varre `data/theme-sertao.json` e o HTML; (2) o id neutro `swine_farm` não muda (a sim
  nunca lê o tema); (3) os comentários de código que citam o nome visível passam a dizer Curral.

### I-TELA-ABAS-MENORES — os quatro botões principais 20% menores
- **Pedido:** "Diminuir proporção dos 4 botões principais em 20%."
- **Aceite:** (1) altura, ícone e largura dos quatro botões de `#abas` ficam em 80% de hoje, com os
  números no CSS lidos por um teste do estilo; (2) a captura da barra é aberta.

### I-TELA-SUBABAS-DO-CONSTRUIR — o menu Construir em quatro sub-abas
- **Pedido:** dentro de Construir, sub-abas por categoria, em vez da lista vertical comprida:
  - **Vila:** Armazém, Casa do Coronel (escola), Bodega, Feira;
  - **De Comer:** Roçado de Milho, Canavial, Casa do Pescador, Moinho, Padaria, Curral, Casa de Carne;
  - **Mato e Pedra:** Lenhador, Serraria, Garimpo, Jazida de Carvão, Mina de Ferro, Fundição, Forja;
  - **Guerra:** Casa de Armas, Curtume, Casa do Ferro, Ferraria, Torre de Pedra, Quartel, Cocheira,
    Mercenários.

  Prédio novo, na dúvida, vai para Vila.
- **Interpretação conservadora, registrada como pergunta:** a lista do operador não cita a Pedreira
  (`quarry`) nem a Casa do Gibão (`armory_workshop`). A Pedreira vai para Mato e Pedra, que é pedra, e
  a Casa do Gibão vai para Guerra, que é armadura. A regra "na dúvida, Vila" fica para o prédio novo,
  sem grupo no dado.
- **Aceite:** (1) `data/menu-build.json` tem os quatro grupos na ordem do operador, e o validador do
  dado continua exigindo cada prédio num grupo só; (2) o render do menu mostra uma linha de quatro
  sub-abas, e só o corpo da sub-aba escolhida; a sub-aba lembra a escolha ao reabrir; (3) o prédio
  sem grupo no dado cai em Vila, com teste; (4) as ferramentas de estrada e roçado continuam no topo,
  fora das sub-abas; (5) o roteiro do menu despausa, aperta e segura 150 ms numa sub-aba (regra do
  §8), e a captura é aberta.

### I-ARTE-PREDIOS-MAIORES — Casa de Carne, Casa do Gibão e Curtume +20%, Cocheira +30%
- **Pedido:** os quatro prédios estão pequenos.
- **Como:** um campo novo de exibição por prédio no manifesto, `escalaDeExibicao` (1,2 e 1,3),
  multiplicado depois da regra de altura e largura (`escalaDoSprite`). O footprint e a sim não mudam.
  As âncoras (bandeira, trabalho, estoque) são frações do sprite e acompanham a escala.
- **Aceite:** (1) o tamanho desenhado dos quatro é 1,2 / 1,2 / 1,2 / 1,3 vez o de hoje, e o dos outros
  não muda (teste por tabela sobre `escalaDoSprite`); (2) o validador do manifesto aceita o campo só
  com número > 0; (3) a captura dos quatro em jogo é aberta.

### I-OBRA-UM-TILE-ENTRE-PREDIOS — prédio não encosta em prédio
- **Pedido:** "Os edifícios devem possuir uma distância um dos outros de pelo menos 1 tile."
- **Aceite:** (1) `canPlace` recusa, com o motivo `colado`, a planta cujo lote fica a menos de
  `distanciaMinimaEntrePredios_tiles` (1, em `data/buildings.json`) de outro prédio ou obra, em
  qualquer direção, inclusive na diagonal; (2) a planta a exatamente 1 tile passa; (3) a fantasma do
  render mostra a recusa como as outras (o motivo vem da sim); (4) os testes que plantavam prédios
  colados passam a plantar com o vão, e a contagem do que mudou vai para o PROGRESS.

### I-TERRENO-MINAS-PERTO-DA-VILA — carvão, ouro e ferro do lado esquerdo da vila
- **Pedido:** "Minas perto da vila: colocar do lado esquerdo da vila atual", para testar a fundição.
- **Como:** um bloco de montanha a oeste da vila, fora da moldura de 8 tiles e fora da reserva da vila,
  com os três veios na borda leste dele (como os veios do mapa: minério no tile de montanha da borda).
  Escrito por um script versionado em `tools/`, que registra a mudança no `_doc` do mapa. A semente vira
  registro histórico, como o próprio `_doc` prevê.
- **Aceite:** (1) há carvão, ferro e ouro a até 20 tiles do armazém inicial, a oeste dele; (2) as três
  minas cabem ao lado dos veios pelo `canPlace` e produzem pelo `step`; (3) a contagem de recursos e a
  de terreno do mapa conferem com o que o script escreveu, e o hash muda; (4) o save
  `teste-operador-vila-pronta` é refeito pelo caminho do teste; (5) a captura do lado esquerdo da vila
  é aberta.

### I-TELA-BALAO-DE-PENSAMENTO — o morador mostra o que quer fazer
- **Pedido:** como no KaM, um balão de pensamento sobre a cabeça indicando o que o morador deseja
  fazer, aparecendo de vez em quando no caminho até o destino.
- **KaM:** `TKMUnitThought` (`src/units/KM_Units.pas`, a conferir com arquivo:linha no PROGRESS): comer,
  casa, construir, pedra, madeira e assim por diante.
- **Regra (só render):** o balão sai do estado:
  - o serf indo buscar ou entregar mostra a mercadoria da tarefa;
  - quem vai comer mostra a comida;
  - o obreiro indo à obra mostra o martelo;
  - o especialista indo ocupar mostra a casa.

  Aparece por `duracao` a cada `intervalo`, com uma fase por unidade derivada do id, para não piscarem
  todos juntos. Os números ficam em `data/pensamento.json`.
- **Aceite:** (1) a regra pura "estado → pensamento", por tabela, e "tick → visível", com a fase por
  unidade; (2) sem destino (ocioso, trabalhando dentro), nenhum balão; (3) o roteiro em jogo publica os
  balões na ponte de debug, e a captura com um balão é aberta.

### I-TELA-OBRA-PARTE-A-PARTE — a obra sobe por partes, não como uma cortina
- **Pedido:** a obra hoje é a camada de madeira subindo de baixo para cima, e depois a de pedra por cima
  dela. No KaM, a sensação é de ver o prédio subir parte a parte.
- **Regra (só render, com os sprites atuais):** a revelação de cada camada deixa de ser um corte
  horizontal único. Passa a ser uma grade de blocos (linhas × colunas em `data/obra-revelacao.json`),
  revelada linha a linha de baixo para cima e, dentro da linha, numa ordem fixa embaralhada por prédio.
  Cada bloco aparece inteiro quando a fração dele é alcançada.
- **Aceite:** (1) a regra pura "fração → blocos visíveis", por tabela: 0 nada, 1 tudo, monotônica (o
  bloco que apareceu não some), a mesma ordem para o mesmo prédio e outra para outro; (2) a contagem de
  blocos visíveis segue a fração; (3) três capturas da mesma obra em frações diferentes são abertas.

### I-ARTE-ARVORE-SECA — o umbuzeiro pequeno vira árvore seca do sertão
- **Pedido (com print):** a árvore pequena (o estado `umbuzeiro` de `tree`) destoa. Trocar por uma
  árvore seca do sertão, no porte das outras árvores.
- **Aceite:** (1) o estado `umbuzeiro` aponta para a arte nova, com master em `assets/base/` e a origem
  registrada; (2) a silhueta tem altura comparável à do juazeiro (`presente`), medida no PNG; (3) os
  outros estados e o anchor não mudam; (4) a captura de uma mata com a árvore nova é aberta. A
  homologação da arte é do operador.

### I-ARTE-BODES-DO-CURRAL — os bodes do Curral, nas três idades
- **Pedido:** a animação dos bodes, com todas as fases de crescimento, para o Curral.
- **O consumidor (verificado em `src/render/manifesto-camadas.ts` e `animais.ts`):** o Curral
  (`swine_farm`) desenha o animal `pigs` em `idade1`, `idade2` e `idade3`, de 4 quadros cada. Hoje é
  placeholder.
- **Aceite:** (1) a entrada `animal` `pigs` no manifesto tem os 12 quadros (bode filhote, jovem,
  adulto), e o validador das camadas vivas passa; (2) o tamanho cresce com a idade, medido no PNG; (3) a
  captura do Curral ocupado em jogo é aberta. A homologação da arte é do operador.

### I-ARTE-PEDRA-DA-RUA — a pedra da rua com cara de pedra (delegado ao Codex)
- **Pedido:** um sprite novo para as pedras da cidade, que combine ao montar as ruas. Pedido expresso
  do operador: passar ao Codex.
- **Aceite:** (1) o pedido vai ao Codex pelo `/codex`, com o consumidor (a máscara de vizinhança da
  estrada) e as regras de albedo do contrato; (2) o resultado volta como candidata e só entra no jogo
  depois de conferido em captura de rua com curva e cruzamento.

### Itens 12 a 14 do pacote da noite (mandados pelo operador durante a madrugada)

#### I-TELA-BARRA-RAPIDA-DE-RECURSOS — a barra fina de recursos no meio da tela
- **Pedido (com imagem de inspiração):** uma barra rápida no meio da tela, fina, com ícone e
  quantidade:
  - os recursos (madeira, pedra, carvão, ouro e ferro);
  - o total de comida, todas as comidas somadas;
  - as armas em duas categorias: armas e armaduras. Os escudos vão em armaduras.
- **Aceite:**
  1. uma regra pura agrupa o estoque dos armazéns do jogador nas categorias. A lista de mercadorias
     de cada categoria fica num dado de interface (`data/barra-rapida.json`), e a comida vem do grupo
     `comida` do `economy.json`. O validador reprova a mercadoria que não existe e a categoria sem
     ícone;
  2. por tabela: o total de cada categoria é a soma das mercadorias dela nos armazéns completos do
     jogador, e o escudo conta em armaduras;
  3. a barra é DOM sobre o canvas, centrada no alto, com altura de até 28 px, e mostra os mesmos
     números do HUD da sim (`ui/` só lê);
  4. o roteiro em jogo confere os números contra o estado, e a captura é aberta.

#### I-PESQUISA-IGREJA — a pesquisa da Igreja e do padre (antes do código)
- **Pedido:** pesquisar e depois implementar um prédio novo, a Igreja, bem característica do Nordeste.
  A base de tamanho e proporção é a padaria, e o sprite vai para o Codex. Ela gera padres, com dois
  poderes:
  - **Bênção das Tropas:** uma aura de 8 tiles, com +x% de dano ou +x% de resistência; a aura de
    vários padres não acumula;
  - **Converter:** como no Age of Empires 2, converte uma unidade inimiga por vez depois de uma
    oração de x ticks, com a janela de sucesso entre ~5 e 9 intervalos.
- **Aceite da pesquisa:** `docs/pesquisas/2026-10-05-igreja-e-padre.md` traz:
  - a arquitetura das igrejas do sertão (fonte citada);
  - o padre no Age of Empires 2 (a conversão, a recarga, quem resiste);
  - a aura em jogos de RTS;
  - a proposta de números, todos em dado, com o que é decisão do operador marcado como pergunta.

  A implementação abre como itens próprios, depois da pesquisa, um de cada vez, com aceite próprio.
  O sprite vai ao Codex pelo `/codex`.

#### I-PLANO-ACUDE-E-CLIMA — o planejamento do Açude e do clima (só documento)
- **Pedido:** o planejamento, em `docs`, de um sistema de clima (inverno e seca) e de um prédio novo,
  o Açude, com o roteiro de pesquisa e as restrições do operador (não mexer em fome, sem sede
  individual, tudo em dado). Antes de implementar, o operador aprova.
- **Aceite:** `docs/planos/2026-10-05-acude-e-clima.md` responde os dez pontos do pedido:
  - a pesquisa histórica com fontes, e as culturas;
  - o benchmark de sete jogos;
  - o fluxo e o modelo de dados;
  - a integração com o que o Piancó já tem, com `arquivo:linha` (como a fazenda cresce, como o tick
    roda, onde fica o balanceamento);
  - o plano em etapas e os riscos.

  Nenhum código.

### Pedido do operador de 2026-10-05 (manhã): o aviso da tropa com fome e o jornal

#### I-COMIDA-AVISO-DA-TROPA-COM-FOME — a tropa com fome avisa, com som
- **Pedido:** "O exército, quando estiver com fome, precisa tocar um som indicando ao jogador que o
  exército está passando fome."
- **KaM (`731a8a4`):** `TKMUnitGroup.UpdateHungerMessage` (`src/units/KM_UnitGroup.pas:1975-2005`) avisa
  o dono quando alguém do grupo está abaixo da condição mínima, e repete o aviso a cada
  `TIME_BETWEEN_MESSAGES` = 4 min (`src/common/KM_Defaults.pas:390`) enquanto a fome continua. A
  mensagem entra no registro do jogador e toca a corneta (`src/game/KM_Game.pas:1696-1707`).
- **Regra (sim):** o `step` emite `troop-hungry` (`lado`, `unidades`: quantos militares do lado estão
  em alerta de fome, o `emAlertaDeFome` da F20c) em dois casos:
  - quando a contagem desse lado vai de 0 para mais de 0 entre o estado de antes e o de depois do
    passo;
  - e, enquanto ela continua acima de 0, no tick múltiplo do lembrete
    (`condition.json` `avisoDaTropaComFome.lembrete_segundos_base`: 240, a escala do arquivo).

  Não há estado novo. **Divergência declarada:** o KaM conta o lembrete a partir do primeiro aviso, e
  aqui ele cai no múltiplo do tick, sem estado. O KaM também pula quem já pediu comida, e aqui conta
  todo militar em alerta.
- **Som (dado):** `data/som.json` liga `troop-hungry` ao som `troop-hungry`, sem lugar (toca de
  qualquer ponto do mapa). O arquivo segue a regra dos sons (H-ARTE-SONS-CANDIDATOS): os candidatos CC0
  vão para `docs/sons-candidatos.md` com a licença conferida na página, e **o operador aprova**. Até lá,
  é silêncio, que é o comportamento normal.
- **Aceite:**
  1. pelo `step`: a tropa do jogador drenando cruza o limiar, e o evento sai **no tick** em que a
     contagem passa de 0 a 1, com `unidades` 1;
  2. o lembrete sai no múltiplo enquanto a fome continua, e **não** sai entre dois múltiplos;
  3. alimentada (acima do limiar), nenhum evento. O civil com fome não dispara;
  4. a tropa da IA dispara com o lado da IA;
  5. o determinismo (mesma corrida, mesmos eventos) e a guarda de que `sim/` não lê `som.json`;
  6. o `validate:data` aceita o campo novo e recusa o lembrete ≤ 0.
- **Emenda (2026-10-05, antes do código; pela medida do roteiro do I-TELA-JORNAL):** o lembrete no
  múltiplo do tick, sem estado, repetiu a notícia 300 ticks depois do primeiro aviso (fome no 11 700,
  múltiplo no 12 000). O lembrete passa a contar **a partir do último aviso**, como o KaM
  (`fTimeSinceHungryReminder`, `src/units/KM_UnitGroup.pas:1993-2005`). O tick do último aviso fica
  num campo opcional do estado, `avisoDaTropaComFome` (lado → tick), que sai quando o lado não tem
  mais tropa com fome. A primeira divergência declarada cai; a do pedido de comida fica. O aceite 2
  passa a ser: o lembrete sai `lembrete` ticks depois do aviso anterior enquanto a fome dura, e nunca
  antes; saindo da fome e voltando, o aviso é imediato. O campo entra na guarda
  `GUARDA-step-preserva-opcionais` e atravessa o save.
- **Nota (feature de integração, 2026-10-05, antes do código):** o evento novo entra também na lista
  `EVENTOS_DA_SIM` de `src/render/eventos-da-sim.ts`, que o compilador obriga a espelhar o `GameEvent` e
  o `validate:data` usa para conferir o `som.json`. É a única linha de `src/render/` desta feature.

#### I-TELA-JORNAL — o jornal das notícias importantes
- **Pedido:** um sistema de alertas para eventos importantes, como o da tropa com fome (e, no futuro,
  "a seca está chegando").
  - Um **ícone pequeno do lado esquerdo da tela** indica que há jornal.
  - O clique abre o **jornal aberto no meio da tela**, como popup, **sem bordas**, só a folha do
    jornal e o ícone de fechar.
- **KaM:** a pilha de mensagens no canto esquerdo, que abre a mensagem ao clicar
  (`src/gui/KM_InterfaceGamePlay.pas:2047-2055`).
- **Regra (só tela):**
  - **a regra pura** `noticiasDosEventos` transforma os eventos do passo em notícias, pela tabela de
    `data/jornal.json` (evento → manchete e texto no tema, só do lado do jogador). Começa com a
    `troop-hungry` e a `peace-ended`;
  - **a memória:** a interface guarda as últimas `maximoDeNoticias` (dado), a mais nova no alto. Ela
    não entra no save (memória de tela);
  - **o ícone** fica no canto inferior esquerdo da área do jogo, escondido sem notícia, com a marca de
    não lida;
  - **o jornal:** o clique abre a folha no centro: papel envelhecido em CSS, nome do jornal do tema,
    "Dia N" e as manchetes. Sem moldura de janela, com o ✕ de fechar; o Esc também fecha. Abrir marca
    tudo como lido, e o jogo não pausa.
- **Aceite:**
  1. a regra pura por tabela: o evento do jogador vira notícia com a manchete do tema; o evento da IA
     e o sem linha não viram nada; o teto de notícias vale; a mais nova fica no alto;
  2. o validador reprova o evento sem manchete no tema e o teto ≤ 0;
  3. o roteiro em jogo despausa e leva a tropa da escaramuça à fome pelo relógio. O ícone aparece com
     a marca. O roteiro aperta o ícone (down, 150 ms, up) com o jogo andando, e o jornal abre no
     centro com a manchete da fome. O ✕ fecha, e a marca some. A captura do jornal aberto é aberta.

### Pedido do operador de 2026-10-05 (noite): o menu da proposta e a água em pixel art

#### I-TELA-MENU-DA-PROPOSTA — o menu lateral no estilo da proposta do operador
- **Pedido:** restilizar o menu lateral, que "está com ícones muito dispersos e sem estilo profissional",
  o mais fiel possível à proposta (`proposta-menu.jpg`). O operador mandou as peças:
  - `fundo_menu.png`: a cidade no pé do menu;
  - `enfeite-laterial-01.png` e `enfeite-laterial-02.png`: os enfeites dos lados do minimapa;
  - `enfeite-01.png`: o divisor com o mandacaru, embaixo das abas;
  - `enfeite-rodape-01.png`: o rodapé com o sol;
  - `card-background.png`: o cartão de cada construção.

  Também pediu:
  - as sub-abas do Construir visíveis **como abas da imagem**, com ícones no mesmo estilo, **gerados pelo
    Codex**;
  - textos separando a construção das ruas e da terra (milho e cana) da seção das construções;
  - o ícone da rua trocado por um pequeno ícone de pedras.
- **Como:** só tela (CSS, `src/ui/menu-build.ts`, `index.html`) e arte (as peças do operador e os
  ícones do Codex em `assets/sprites/ui/menu/`, com a origem no manifesto `icones.interface`). A largura
  da barra continua 260 px. Na proposta, a coluna tem 784 px, e a escala é de mais ou menos 1/3.
- **Interpretação conservadora, registrada como pergunta:** na proposta, a linha de cima é de filtros
  ("Todos", "Apenas disponíveis", "Por tipo"...), que o jogo não tem. Os botões dessa linha continuam
  sendo as ferramentas de hoje (rua, desfazer rua, milho, cana, apagar roça), no mesmo quadro de madeira
  da proposta e com o nome embaixo. As construções vão em cartões de **3 por linha**, e não 4: com 260 px,
  4 cartões deixam o nome ilegível.
- **Aceite:**
  1. **a estrutura** (teste do DOM em jsdom ou da montagem):
     - as quatro sub-abas, cada uma com o ícone (`img` do manifesto) e o rótulo;
     - a seção de ferramentas com o título do tema ("Ruas e Roçados" e uma linha de explicação), cada
       ferramenta com o nome visível embaixo;
     - a seção de construções com o título do tema por sub-aba ("Construções da Vila" etc.) e uma linha
       de explicação;
     - cada construção num cartão com o retrato e o nome visível;
  2. **o manifesto:** cada peça e cada ícone novo em `icones.interface`, com o arquivo, a dimensão real e
     a origem (a peça do operador ou o job/prompt do Codex). O CSS só aponta arquivo que existe;
  3. **o ícone da rua** é o das pedras, um PNG, e não mais o glifo de barra;
  4. **o roteiro** em jogo, com uma regra:
     - abre o Construir e passa pelas quatro sub-abas com o jogo andando (down, 150 ms, up);
     - confere que nenhum rótulo é cortado (largura de rolagem ≤ largura do nó) e que nenhum cartão
       sai da barra;
     - confere que a cidade (`fundo_menu`) e o rodapé estão desenhados;
     - a captura é aberta e comparada com a proposta;
  5. a **não-regressão** dos roteiros que clicam no menu (F06, F17, F17g e os que usam o `_subaba.js`)
     sai 0.
- **Emenda (2026-10-05, antes do código):** o ícone da sub-aba e o da rua vão por CSS (`::before` /
  `background-image` com o PNG do manifesto), como os das abas principais, e não por `img`. A `ui/` não
  resolve URL do bundler (`src/ui/icones.ts`), e o CSS já é o caminho das abas. O aceite 1 confere, no
  CSS, que cada sub-aba e a rua apontam o PNG certo, e o aceite 2 confere que esse PNG existe e está no
  manifesto.

#### I-ARTE-AGUA-PIXEL-ART — a água em pixel art, para o operador ver
- **Pedido:** "Mude o sprite da água do jogo e suas animações para pixel art para eu ver como fica."
- **O consumidor (verificado):** a entrada `agua` do manifesto tem o miolo em quatro variantes
  (`padrao`, `v1`, `v2`, `v3`), que `src/render/agua-viva.ts` alterna a cada `periodo` (8 ticks,
  `data/agua.json`) com a fase por tile. Tem também as 16 margens (`borda-m*`), que são a areia sobre a
  água.
- **Como:** um gerador versionado e determinístico (semente fixa) desenha o miolo em pixel art.
  - Cada quadro é feito em 32×32, com paleta pequena, e ampliado 2× por vizinho mais próximo para 64×64.
  - Os quatro quadros emendam sem costura (o ruído é periódico em 32) e são quadros de uma mesma onda
    andando, para a troca de variante virar animação.
  - O manifesto aponta as quatro variantes para os arquivos novos. Os antigos ficam no disco, e voltar é
    trocar quatro linhas do manifesto. As margens não mudam neste item.
- **Aceite:**
  1. as quatro variantes 64×64, emendando nas quatro bordas (a coluna 0 continua a 63, e a linha 0 a 63,
     medido no PNG);
  2. no máximo N cores por quadro (N no gerador), e blocos de 2×2 iguais (o pixel art ampliado);
  3. o gerador refaz os quatro arquivos byte a byte (o determinismo);
  4. a captura do açude da vila em jogo é aberta, em dois ticks diferentes (a animação). A homologação
     é do operador.

### Pedido do operador de 2026-10-05 (noite, 3): o solo em pixel art e a escola da noru

#### I-ARTE-SOLO-PIXEL-ART — o chão padrão como solo do sertão, em pixel art
- **Pedido:** "Regere a vegetação padrão como um solo do cangaço nordestino em pixel art." A leitura
  é a do terreno padrão do mapa, `grama` no manifesto: o chão de caatinga que cobre quase todo o mapa,
  com as variantes `padrao`, `v1`, `v2` e `v3` sorteadas por tile.
- **Como** (o mesmo caminho da I-ARTE-AGUA-PIXEL-ART):
  - um gerador versionado e determinístico desenha as quatro variantes em 32×32, ampliadas 2× para
    64×64, com uma paleta curta da terra de hoje (os ocres medidos no PNG), dither e pedrinhas,
    rachaduras e tufos de capim seco;
  - o **chão de base é o mesmo** nas quatro e emenda em si mesmo, porque elas se encostam em qualquer
    combinação no mapa. O que muda entre elas são os detalhes, longe da borda;
  - o manifesto aponta as quatro para os arquivos novos, e os de antes ficam no disco.
- **Aceite:**
  1. as quatro variantes 64×64 emendam com elas mesmas e entre si: a coluna da borda de qualquer uma
     casa com a borda oposta de qualquer outra (o chão de base igual nas bordas, medido no PNG);
  2. a paleta é curta e os blocos são 2×2;
  3. o gerador refaz os arquivos byte a byte;
  4. a captura da vila em jogo é aberta. A homologação é do operador.

#### I-ARTE-ESCOLA-DA-NORU — a escola rural da branch `noru-novos-sprites` no jogo
- **Pedido:** "Lembro de ter uma escola vindo da branch noru-novos-sprites, aplique-a no jogo."
- **O que existe (verificado):** a branch registrou a escola rural D (`52af24c`, `SKILL_BUILDER_PROGRESS.md`)
  como candidata externa, em
  `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\schoolhouse\rodada-2026-10-03\`. Lá estão os 4
  PNGs (`stage/assets/...`), a entrada pronta do manifesto (`entry.json`) e os caminhos permitidos
  (`allowed-paths.txt`). Os assets nunca foram commitados: a branch esperava a homologação do
  operador, e o pedido de hoje é essa ordem.
- **Como:** copiar os 4 caminhos permitidos e trocar a entrada `schoolhouse` do manifesto pela
  `entry.json` (envelope 214×240, footprint 3×3, anchor e as exceções 1,33 e 1,12 iguais às de hoje).
  As âncoras novas são a da bandeira e a da área de treino. Os arquivos de antes ficam no disco.
- **Aceite:**
  1. o manifesto aponta a escola nova, os 4 arquivos existem com a dimensão declarada, e a origem é a
     master versionada;
  2. os testes que a branch rodou continuam verdes (F-SPR, F17f, C10, F-ESC, F-VIVO-h);
  3. os roteiros F17f e F-VIVO-h saem 0, e a captura da escola em jogo é aberta.

### Pedido do operador de 2026-10-06: a trilha sonora em playlist

#### I-TELA-TRILHA-SONORA — uma playlist de músicas que começa tocando no jogo
- **Pedido:** "Criar um sistema de soundtrack de uma playlist para o jogo, começando pela primeira
  (padrão), e que já começa tocando no jogo." A primeira faixa é
  `D:\projetos-pessoal\cangaco-game-candidatos\sound\music_pianco_01.mp3`, entregue pelo operador.
- **O que existe (verificado):** a música da paz (`data/som.json` `musica.paz` = `music-peace`) não tem
  arquivo, e por isso é silêncio. A do combate (`music-combat`) tem arquivo. A troca entre as duas é a
  passagem de `src/render/fundo-sonoro.ts`.
- **Como (só tela e dado):**
  - a camada da **paz** passa a ser a **playlist** (`data/som.json` `musica.playlist`: a lista de faixas,
    na ordem). Ela começa pela primeira, ao terminar uma faixa passa para a seguinte, e da última volta
    à primeira. Com uma faixa só, ela recomeça. O combate continua por cima, com a mesma passagem;
  - a faixa toca sem laço, e o fim dela (`ended`) avança a playlist. A regra "qual a próxima" é pura;
  - **"já começa tocando":** a música pede para tocar desde o primeiro quadro da partida. O navegador
    só libera som depois de um gesto do jogador, e o clique em "Nova partida" já é esse gesto. Antes de
    qualquer gesto, ela tenta de novo a cada segundo, como os laços de hoje;
  - **a origem:** a regra dos sons (H-ARTE-SONS-CANDIDATOS: só CC0, de Freesound ou OpenGameArt,
    aprovado na lista) vale para `sons` e não muda. A trilha entra numa seção **própria** do manifesto,
    `trilha`, com o arquivo, a base (o original do operador em `assets/base/trilha/`) e a origem
    ("entregue pelo operador"). **Pergunta:** a licença da faixa, que fica registrada como "do operador,
    a confirmar".
- **Aceite:**
  1. a regra pura por tabela: a primeira faixa é a padrão, a próxima de i é i+1, a da última é a
     primeira, e com uma faixa a próxima é ela mesma;
  2. pelo fundo sonoro, com o tocador falso: na paz toca a faixa atual da playlist; o fim dela passa
     para a seguinte; no combate a playlist desce e a música de combate sobe (a passagem de hoje);
  3. o validador recusa a playlist vazia, a faixa que não está na `trilha` do manifesto, e a entrada da
     trilha sem arquivo, base ou origem. A regra CC0 de `sons` continua igual;
  4. o roteiro em jogo, com o gesto: a faixa da playlist está tocando (o elemento de áudio da trilha
     não pausado, com o tempo andando), e não há erro de console.
- **Emenda (2026-10-06, pedido do operador no meio do trabalho, antes do código):** a segunda faixa,
  `music_pianco_02.mp3`, entra na playlist depois da primeira. E o jogador ganha os **controles da
  trilha** na aba Opções da barra (hoje ela só tem o botão de ajuda):
  - o nome da faixa que toca;
  - **pausar/continuar** (a pausa da trilha é do jogador e vale até ele continuar; o combate não a
    desfaz);
  - **passar** para a próxima faixa (da última, volta à primeira);
  - os **volumes**: o geral e o de cada canal (efeitos, ambiente e música), os mesmos da caixa de
    opções de som (`ui/opcoes-de-som.ts`), lidos e gravados pela mesma preferência. Mexer num muda o
    outro, e o mudo também.
  **Aceite emendado:**
  5. a regra pura de `passar` (com uma ou várias faixas) e o estado do player por tabela: pausado não
     toca a playlist e não avança; passar com a trilha pausada troca a faixa e continua pausada;
  6. pelo fundo sonoro, com o tocador falso: `pausar` para a faixa, `continuar` a retoma da mesma faixa,
     e `passar` para a atual e toca a seguinte desde o começo;
- **Emenda 2 (2026-10-06, antes do código):** a terceira faixa, `music_pianco_03.mp3`, entra depois da
  segunda. A playlist do dado passa a ter as três, na ordem 01, 02, 03.
  7. o roteiro em jogo, com o jogo andando, aperta os controles (down, 150 ms, up): passar troca o nome
     e a faixa que toca; pausar deixa o áudio da trilha pausado e continuar o retoma; o deslizador do
     volume da música muda o volume do áudio da trilha. A captura do player é aberta.

### Pedido do operador de 2026-10-06 (manhã): o lote de correções e a Igreja e o clima

#### I-TELA-BALAO-COM-MARTELO — o obreiro que pensa na obra mostra um martelo batendo
- **Pedido:** "No laborer, quando ele estiver pensando em Obra, coloque uma animação de martelo."
- **Como (só tela):** o balão do pensamento `construir` mostra o martelo da aba Construir
  (`sprites/ui/tab-construir-premium.png`, do manifesto), girando em torno do cabo como numa batida, em
  vez do texto "obra". O ângulo vem de uma regra pura "tick → ângulo", com a amplitude e o período em
  `data/pensamento.json`.
- **Aceite:** (1) a regra pura do ângulo, por tabela: periódica, dentro da amplitude e com a fase por
  unidade; (2) o balão de obra é ícone (`balaoComo: 'icone'`), e não mais texto; (3) a captura de um
  obreiro com o martelo é aberta.

#### I-TELA-BALAO-TRANSPARENTE — os balões com 10 % de transparência
- **Pedido:** "Nos balões de pensamento das unidades, aplique uma transparência de 10%."
- **Aceite:** o balão (fundo, ícone e texto) é desenhado com a opacidade `opacidade` 0,9 de
  `data/pensamento.json`; o validador recusa a opacidade fora de (0, 1]; a ponte publica a opacidade, e
  o roteiro a confere.

#### I-ARTE-ESCOLA-DE-VOLTA — a escola volta ao sprite anterior
- **Pedido:** "Devolve o sprite da schoolhouse anterior. O atual ficou muito ruim e fora das dimensões."
- **Como:** a entrada `schoolhouse` do manifesto volta à de antes do `a2a26a4` (a Casa do Coronel em
  sobrado), e os 4 arquivos da escola rural D saem do repositório (continuam na pasta de candidatos de
  fora).
- **Aceite:** a entrada é byte a byte a de `a2a26a4^`; os arquivos D não existem mais em `assets/`; os
  testes da escola (F-SPR, F17f, C10, F-ESC, F-VIVO-h) passam, e a captura do F17f é aberta.

#### I-TELA-RUAS-SO-NA-VILA — Ruas e Roçados só na sub-aba Vila
- **Pedido:** a seção "Ruas e Roçados" e as ferramentas (Rua, Desfazer rua, Milho, Cana, Apagar roça)
  aparecem só em Vila; as outras sub-abas mostram direto as construções.
- **Aceite:** (1) no roteiro, com a Vila escolhida, o título das ruas e as cinco ferramentas estão
  visíveis; nas outras três sub-abas, nenhum deles aparece, e o primeiro título é o da sub-aba; (2) os
  roteiros que miram uma ferramenta (`[data-ferramenta=...]`) abrem a Vila antes, como já abrem a
  sub-aba do prédio (`tools/shots/_subaba.js`); (3) a não-regressão dos roteiros do menu sai 0.

#### I-TELA-COR-DO-MENU — o fundo do corpo do menu na cor da cidade do pé
- **Pedido (com a amostra de cor):** o fundo do menu das sub-abas na mesma tonalidade da imagem do pé.
- **Medido:** a amostra do operador e o alto de `cidade.png` dão a mesma cor, ~`#edcf9d` (237, 207, 157).
- **Aceite:** o `background-color` do `#corpo-aba` que vale na cascata é `#edcf9d`, com teste do CSS, e a
  captura é aberta.

#### I-ARTE-SOM-DA-FOME — o som da tropa com fome
- **Pedido:** "Faltou um som para avisar quando as tropas estão com fome. Pode ser o som de uma barriga
  roncando ou uma pessoa resmungando."
- **Como:** a linha `troop-hungry` de `docs/sons-candidatos.md` já tem a barriga roncando como
  candidato 3 (CC0, conferido na página em 2026-10-05). A escolha do operador ("barriga roncando") é o
  3, e o `tools/baixar-sons.js` baixa, confere a licença, recorta e põe no manifesto.
- **Aceite:** (1) o som está no manifesto com CC0 e o link da página, e o arquivo existe; (2) o
  `H-ARTE-SONS-APROVADOS` passa com 23 aprovados; (3) pelo evento, o aviso do jogador toca o som.

#### O clima — a implementação (pedido do operador, 2026-10-06: "prossiga com a implementação do conceito de clima")
O plano é `docs/planos/2026-10-05-acude-e-clima.md`. O operador mandou prosseguir sem responder às oito
perguntas do plano. Pela regra (CLAUDE.md §14), vale a interpretação mais conservadora, e cada
resposta fica registrada como **decisão da sessão, revisável**:
- **P1 (efeito por cultura):** um efeito só, o mesmo para o milho e a cana;
- **P2 (escala):** a duração do ciclo declara o grupo `economia`, como manda o §5. Os valores base são
  a metade dos minutos do pedido, para que, com a escala 2,0 de hoje, o inverno dure os 5 min de
  relógio que o operador pediu (e assim por diante);
- **P5 (o crescimento):** o multiplicador é o da estação **na semeadura**: o tile semeado no inverno
  cresce como inverno até o fim. É a opção sem estado novo (o maduro continua derivado de `semeadoEm`);
- **P6 (a árvore):** fora do clima;
- **O Açude** (P3, P4, P7, P8) vem depois, em itens próprios: esta leva é o clima.

##### I-CLIMA-ESTACAO — a estação do ano, função do tick
- **Regra (sim):** `data/clima.json` (lido pela sim) tem o ciclo (inverno, transição para a seca, seca,
  transição para a chuva) com a duração de cada fase e o `multiplicadorDeCrescimento`, mais o `ligado`.
  A conversão para ticks acontece no carregamento. `estacaoNoTick(tick)` é pura, sem estado no
  `GameState`. O `step` emite `season-changed` (`estacao`) no tick em que a estação muda.
- **Aceite:** (1) por tabela, tick → estação nas bordas de cada fase e depois de um ciclo inteiro; (2)
  pelo `step`, o evento sai exatamente nos ticks de troca, e só neles; (3) com `ligado: false`, nenhum
  evento, e o estado é igual ao de hoje; (4) o validador recusa o ciclo vazio, a duração ≤ 0 e o
  multiplicador ≤ 0.

##### I-CLIMA-CRESCIMENTO — o milho e a cana crescem com a estação
- **Regra (sim):** o tile de uma cultura do clima (`culturas`: `corn`, `grapes`) amadurece em
  `ticksDeCrescer / multiplicador(estação na semeadura)`, arredondado. A árvore não muda.
- **Aceite:** (1) por tabela, o mesmo tile semeado no inverno e na seca: a razão dos tempos é
  1,20 / 0,65 (a menos do arredondamento); (2) a árvore amadurece igual com e sem clima; (3) com
  `ligado: false`, igual a hoje; (4) o consumo de comida por cabeça não muda (o teste da fome continua
  verde).

##### I-TELA-RELOGIO-DO-SOL — o relógio do sol no canto superior direito
- **Pedido:** "um relógio do SOL no canto superior direito, rodando e mostrando as estações do ano (peça
  ao Codex para gerar a arte e você faz a animação)".
- **Como:** o Codex gera a arte, que é o mostrador com as quatro fases em setores (inverno, chuva caindo,
  a seca, o sol rachando) e o ponteiro do sol, em PNG. A tela gira o ponteiro pela fração do ciclo
  (`fracaoDoCiclo(tick)`, pura), e o nome da estação e o tempo até a próxima ficam embaixo. É DOM, no canto
  superior direito do canvas, sem pegar clique.
- **Aceite:** (1) a regra pura da fração e do ângulo, por tabela; (2) a arte do Codex no manifesto, com
  a origem; (3) o roteiro anda o relógio e confere que o ângulo e o nome acompanham a estação do estado,
  e a captura é aberta.

##### I-TELA-CLIMA-VISUAL — o mundo muda com a estação, e o jornal avisa
- **Como (só tela):**
  - o chão ganha um véu de cor por estação, com a passagem suave nas transições: o verde do inverno, o
    ocre queimado da seca;
  - no inverno cai chuva (partículas, pelo tick, sem acaso de relógio);
  - na seca sobe o tremor de calor (partículas de poeira clara), com o número de cada coisa em
    `data/clima-visual.json`;
  - o jornal ganha as notícias `season-changed`: "A seca vem aí" na transição para a seca, "Chegou o
    inverno" etc.
- **Aceite:** (1) a regra pura "estação e fração → cor e opacidade do véu", por tabela, contínua nas
  trocas; (2) o jornal transforma `season-changed` em notícia com a manchete do tema; (3) o roteiro mostra
  o mesmo trecho da vila no inverno (com chuva) e na seca, com as capturas abertas, e a notícia da seca
  no jornal.

## Backlog com gatilho

Item que não está na fila. Ele entra na fila quando o gatilho escrito acontecer, e quem planeja a
feature do gatilho confere esta lista antes.

- **C-COMBATE-CUSTO-ENCOSTADO — o custo da checagem de inimigo encostado, todos contra todos
   (pedido do operador, 2026-09-30). Só medida, sem otimizar.**
   - O perfil de CPU da paz da escaramuça (leva 3, `PROGRESS.md`) pôs `inimigoEncostado`
     (`src/sim/systems/combate.ts:106`) como o maior custo da sim: ~400 ms de ~1,2 s em 6 000 ticks.
     Ele varre todas as unidades para cada militar.
   - **Aceite:** custo por tick do `step` com 50, 100 e 200 militares (metade de cada lado, longe
     um do outro para não lutar, em campo aberto), em tempo de parede (evidência da sessão, nunca
     asserção, §8) e no eixo determinístico de chamadas a `inimigoEncostado` por tick. Tabela no
     PROGRESS e aqui, com a razão entre as três. Nenhum código de `src/sim` muda.
   - **MEDIDO (2026-09-30), sem otimizar:**
     ```text
     militares  chamadas a hpMaximoDoTipo / tick   ms / tick (3 corridas: carregada, livre, livre)
     50         313                                 0,340   0,149   0,146
     100        1 268   (×4,05)                     0,944   0,417   0,384   (livre: ×2,7)
     200        5 898   (×4,65)                     3,910   1,914   1,876   (livre: ×4,7)
     ```
     O eixo determinístico cresce ~quadrático, e o tempo, com a máquina livre, também (×4,7 de 100
     para 200). Com 200 militares o `step` passa de 1,9 ms; a 10 Hz é ~2 % de um tick de 100 ms,
     sem render. Os números de tempo são da corrida, não asserção.
   - **Gatilho (decisão do operador, 2026-09-30):** entra antes de qualquer feature que aumente
     o número de unidades em jogo. Saiu da posição antes da C-IA-02 (economia da IA), que já
     estava entregue.
   - **O custo em tempo de jogo, com 200 militares** (aritmética sobre a medida acima, sem render;
     `data/time.json`: `tickHz` 10 e `velocidadeDeJogo.opcoes` [1, 2, 3]):

     ```text
     velocidade   ticks por segundo   ms de sim por segundo (máquina livre / carregada)   % de um segundo
     1x           10                  19 / 39                                              1,9 % / 3,9 %
     3x           30                  57 / 117                                             5,7 % / 11,7 %
     ```

## Regras da fila

- Fase A inteira antes de qualquer item da Fase B. Sem exceção.
- Item da Fase B em diante só é detalhado quando a fase anterior fechar. Detalhar
  agora é desperdício, porque o que você aprende na Fase A muda o resto.
- Se uma feature reprovar duas vezes seguidas na avaliação, pare o loop e escreva
  em `PROGRESS.md` o motivo. Insistir uma terceira vez com o mesmo prompt é
  queimar crédito.
