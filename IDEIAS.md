# Ideias congeladas

Tudo que não está no `BUILD_PLAN.md` mora aqui até a **Fase A fechar**.

Isto não é uma lista de espera educada, é um mecanismo de defesa. O que mata
projeto solo de jogo não é dificuldade técnica: é perder o fôlego antes da
primeira partida jogável, geralmente porque uma ideia boa entrou no meio do
caminho. Ideia boa é justamente a mais perigosa.

**Regra:** nada sai deste arquivo antes de `F17-aceite-fase-a` estar em `true`.

---

## Congeladas

- Elevação de terreno (existe no original; a regra de altura está na seção 9 do GDD)
- Multiplayer
- Geração procedural de mapa
- Campanha com missões encadeadas
- Editor de mapas
- 8 direções para civis (hoje são 4; ver guia de estilo)
- Sistema de reputação entre os dois bandos
- Terreno de mapa variado (água/lago, rocha, veio na montanha) — falta uma
  feature de terreno antes da F11: quem produz o mapa, o formato do dado, o
  render e o motivo `'terreno'` de `canPlace`. Dependem dela o Fisherman's
  (lago), as minas (veio) e a estrada (solo transponível). O formato do dado deve
  nascer junto de quem o produz, não antes. Decisão de fila é do operador.
  **Dependentes registrados (atualizado na F16c, 2026-09-23): dois.** (1) o motivo
  `'terreno'` de `canPlace`, desde a F06; (2) os **modos do Woodcutter's**
  (`cortar`/`replantar`/`ambos`), que saíram do aceite da F16c por falta de árvore
  no mapa. Cada dependente novo aumenta o peso desta entrada na hora de decidir a
  **Fase B** — ela deixou de ser só "mapa mais bonito" e virou pré-condição de
  mecânica escrita no GDD.
- Estrada diagonal, fidelidade ao original — exige interpolação diagonal no arrasto, render
  inclinado e isConnected com 8 vizinhos sem cortar quina. (O GDD §5.4 traz "estradas diagonais
  funcionam se nada bloquear a passagem" **[fonte]**; a Fase A fica em 4 direções por decisão do
  operador. Ao adotar: o A\* por estrada da F10 só liga o que `isConnected` liga, e o teste de
  equivalência em `tests/F10-astar.test.ts` prende os dois — mudar um exige mudar o outro.)
- Ordenar os botões do painel da escola por "tem prédio vago" (F13b: os 14 tipos
  de civil viram 14 botões). Decisão do operador, 2026-09-22: **ordenar, nunca
  filtrar.** Esconder quem não tem prédio vago quebraria o fluxo do jogo — o
  jogador treina o lenhador **antes** de construir a casa dele, senão o prédio
  nasce parado esperando ocupante. A saída é quem tem vaga primeiro, o resto
  depois, sem esconder nenhum. É polimento de interface, não escopo da Fase A, e
  por isso não entrou na F14.
- Estrada como canteiro (laborer constrói a estrada tile a tile) — o GDD §5.4 diz "feita por
  laborers"; a Fase A fica com a estrada **instantânea** (F08: `PlaceRoad` debita a pedra no
  comando e o tile nasce pronto). Decisão do operador, 2026-09-21: virar canteiro por tile dobra a
  F11c e atrasa o aceite da Fase A. Ao adotar (o desenho já está na Nota de desvio do item F08 do
  `BUILD_PLAN.md`): a "estrada planejada" entra como **campo novo** no `GameState`, separado de
  `estradas` (que segue sendo só o que está de pé, e é o que `isConnected` consulta), e o débito
  da pedra migra do comando para a entrega.
- Prédio com veio esgotado devolve o trabalhador — medido na F15b (2026-09-23): quando o veio
  da Quarry zera, sai o evento `vein-exhausted` e o pedreiro entra em `esperando_insumo` e fica
  lá indefinidamente, ocupando a vaga de um prédio que nunca mais vai produzir. Não quebra
  critério de aceite escrito (o aceite da F15b-2 fala de `ocioso`), por isso não é bug. O
  desenho a decidir é de quem parte a iniciativa: o prédio se desocupa sozinho (e vira o quê:
  ruína, prédio vago, demolição automática?) ou o jogador precisa demolir. O original esgota
  pedreiras ao longo da partida, então isto vai acontecer em toda partida longa.
- Demolir e reconstruir renova o veio da Quarry — achado da F16a (2026-09-23). O veio é semeado
  em `PredioCompleto.producao.veio` no instante em que a obra vira `completo` (contrato da F15a),
  então derrubar a pedreira esgotada e reerguer no mesmo tile devolve o veio cheio. O tamanho, que
  é o que decide: `production.json` dá `quarry.veio.rendimento = 200`, e `devolucaoAoDemolir = 0.5`
  devolve metade do material — 200 pedras renovadas por meio custo de construção é **exploit, não
  detalhe**. Não se conserta na F16a: quem decide é a **F21**, se passar o veio para o terreno; a
  âncora ficou na nota daquele item. Enquanto o veio morar no prédio, o exploit existe.
- Modos do Woodcutter's (`cortar` / `replantar` / `ambos`) — GDD §2.3, uma linha `[geral]`. Tirado
  do aceite da F16c pelo operador (2026-09-23) por ser **andaime**: o comportamento que o modo
  governaria não existe. `ambos` é o comportamento de hoje; `replantar` (não produzir) seria
  `pausar` com outro nome; e `cortar` exigiria **estoque finito de árvore no terreno** — a sim não
  tem camada de terreno, e é justamente por isso que o veio mora no prédio (F15a/D2). O campo
  `modos` continua em `data/production.json`, sem leitor e com `notas` dizendo isso; `ReceitaDePredio`
  não o carrega. **Pré-condição**: a camada de terreno com árvore (entrada "Terreno de mapa variado",
  acima). Enquanto ela não tiver dono na fila, implementar modos é dar ao jogador uma escolha que
  não muda nada — ou que duplica o botão de pausar.
- Confirmação antes de derrubar prédio — **decisão tomada pelo operador (2026-09-23): fica UM
  clique, sem confirmação**, e esta entrada registra o **custo** dessa escolha, não a reabre.
  O custo: `Derrubar` é o único botão do jogo que **destrói trabalho de forma irreversível**, e a
  devolução é **parcial** (`construcao.devolucaoAoDemolir = 0.5`), então o erro é caro — uma
  pedreira derrubada por engano custa meio prédio mais todo o tempo de obra e de treino do
  especialista que a ocupava (medido na sonda da F16b: 241 ticks do comando até a ocupação). O
  botão fica sozinho no rodapé do painel, com cor própria, separado das outras ações; é isso que
  segura o clique acidental hoje. Se a confirmação entrar um dia, o lugar é a tela (`ui/`): o
  comando `DemolishBuilding` não muda, porque a sim não pergunta nada a ninguém.
- Laborer percorrendo o canteiro tile a tile — no original ele **caminha de verdade** sobre a
  obra enquanto o terreno fica plano quadrado por quadrado; aqui ele fica parado na porta e quem
  se mexe é o canteiro (F17d). Exige **posição em `sim/` durante `nivelando`**: FSM nova e
  determinismo a provar, com teste próprio. Depende da escotilha do A* para unidade **dentro** de
  footprint (`liberados`, `sim/pathfinding.ts:295-300`, "civis nao colidem") — não trava, mas o
  laborer passaria todo o nivelamento ocupando um tile que é obstáculo para todo mundo, e cada
  caminho dele dependeria daquela saída. Isso é regra, não enfeite. **Decisão do operador,
  2026-09-23**: fora da F17d, e **sem substituto visual** — `render/` desenhar a unidade
  deslizando onde ela não está quebraria *"o render lê o estado, não decide"*, hoje inofensivo só
  porque civil não é selecionável, e desenhar caminhada falsa **mente sobre uma regra que não
  existe** em vez de assumir que ela falta.
