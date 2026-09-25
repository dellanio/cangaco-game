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
- Ordenar os botões do painel da escola por "tem prédio vago" (F13b: os 14 tipos
  de civil viram 14 botões). Decisão do operador, 2026-09-22: **ordenar, nunca
  filtrar.** Esconder quem não tem prédio vago quebraria o fluxo do jogo — o
  jogador treina o lenhador **antes** de construir a casa dele, senão o prédio
  nasce parado esperando ocupante. A saída é quem tem vaga primeiro, o resto
  depois, sem esconder nenhum. É polimento de interface, não escopo da Fase A, e
  por isso não entrou na F14.
- Prédio com veio esgotado devolve o trabalhador — medido na F15b (2026-09-23): quando o veio
  da Quarry zera, sai o evento `vein-exhausted` e o pedreiro entra em `esperando_insumo` e fica
  lá indefinidamente, ocupando a vaga de um prédio que nunca mais vai produzir. Não quebra
  critério de aceite escrito (o aceite da F15b-2 fala de `ocioso`), por isso não é bug. O
  desenho a decidir é de quem parte a iniciativa: o prédio se desocupa sozinho (e vira o quê:
  ruína, prédio vago, demolição automática?) ou o jogador precisa demolir. O original esgota
  pedreiras ao longo da partida, então isto vai acontecer em toda partida longa.
- Modos do Woodcutter's (`cortar` / `replantar` / `ambos`) — GDD §2.3, uma linha `[geral]`. Tirado
  do aceite da F16c pelo operador (2026-09-23) por ser **andaime**: o comportamento que o modo
  governaria não existe. `ambos` é o comportamento de hoje; `replantar` (não produzir) seria
  `pausar` com outro nome; e `cortar` exigiria **estoque finito de árvore no terreno**. O campo
  `modos` continua em `data/production.json`, sem leitor e com `notas` dizendo isso; `ReceitaDePredio`
  não o carrega. **Pré-condição, atendida na F-T2a (2026-09-24)**: a árvore é recurso de regime
  `porAcao`, então tile cortado **fica** em `state.recursos` com `quantidade: 0` — *cortada* deixou
  de ser indistinguível de *inexistente*, que era o que faltava para `replantar` significar alguma
  coisa. Pré-condição não é implementação: os modos continuam item futuro, e quem os escrever
  precisa decidir de onde sai a árvore nova (regime `porTempo`, que existe e hoje não tem nenhuma
  instância no dado, é a candidata óbvia).
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
- Clicar no aviso do HUD centra a câmera no prédio — **fora da F22 por decisão do operador
  (2026-09-23)**, e esta entrada registra o gancho que ficou pronto, não uma pendência. O
  `Alerta` devolvido por `alertasDoEstado` já carrega `predio` (o id no estado) além da causa,
  justamente porque a contagem sozinha não bastaria para isso depois; hoje a tela usa só a causa
  e a contagem, e o id viaja sem leitor. Implementar é **só `render/` e `input/`**: o alerta vira
  alvo de clique e o handler resolve `gx`/`gy` pelo id. **Não há helper de centrar hoje** — o
  único uso é `camera.centerOn` na abertura (`src/render/scenes/WorldScene.ts:115`), e o clamp
  da F18a se aplica sozinho. **Nenhum comando novo, nada em `sim/`**: a sim não sabe onde está a
  câmera e não pode saber. O que falta decidir quando entrar: com uma causa em vários prédios,
  um clique leva a qual, e o segundo clique leva ao próximo ou repete o primeiro.
- Separar as armas genéricas nas seis do GDD — **pré-requisito da Fase C**
  (decisão do operador, 2026-09-24). Não é nome de tema faltando: é **dado
  incompleto**. Três ids agregados (`arma_madeira`, `arma_ferro`,
  `armadura_ferro`) existem em **um único lugar**, `data/production.json:22,24,25`,
  e as próprias `notas` de lá dizem o que eles escondem — *"jogador escolhe
  hand_axe, lance ou longbow"*, *"sword, pike ou crossbow"*, *"iron_armor ou
  iron_shield"*. O GDD §4.1 lista as seis armas como mercadoria (Hand axes,
  Swords, Lances, Pikes, Longbows, Crossbows), e o **Anexo A §12.1** diz qual
  tropa exige qual: Bowman pede `longbow + leather_armor`, Pikeman pede
  `pike + iron_armor`, e assim por diante. A Fase A não precisou distinguir
  porque ninguém consome arma ainda; o **Quartel consumindo arma específica por
  tropa** é o que torna o agregado insustentável, e isso é Fase C.
  **O que medi hoje**, e que dimensiona o trabalho: os três ids **não estão em
  `economia.mercadorias`** — a lista tem 28 ids e bate exatamente com o tema.
  Sem entrada lá eles não têm estoque, não têm linha de HUD e não viram linha de
  painel: a gaveta (`src/sim/selectors.ts:409`) itera `economia.mercadorias`, e
  saída fora da lista simplesmente **não aparece** — a Casa de Armas de Madeira
  mostra "Sai: —", não um id cru. Então separar não é só trocar três ids por
  seis: é **declarar as seis (mais as armaduras) em `economy.json`**, e aí cada
  uma ganha estoque, ordem no painel e o botão de "quantas de cada" que o GDD
  §2.3 pede em `[geral]` para as oficinas. Até lá os três ids têm nome
  provisório no tema (Arma de madeira, Arma de ferro, Proteção reforçada), pelo
  mesmo motivo de sempre: se um dia chegarem à tela, chegam com nome.
- Painel do prédio dizer **"está no campo"** quando o especialista sai — **fora da F-T3 por
  decisão do operador (2026-09-24)**, com a razão dele: *"o jogador vê o pedreiro andando no
  mapa, que é o lugar mais forte"*. O painel continua lendo só `predio.ocupante`
  (`src/sim/selectors.ts:511-517`) e **não lê `unidade.fsm`**, então o especialista em campo
  aparece como ocupante normal, que é o que ele é. Implementar depois seria campo novo no
  seletor (`ocupanteEmCampo: boolean`, derivado do `fsm` da unidade apontada por `ocupante`)
  mais uma linha no painel — nada em `state`, nada de comando.
- Descontar tile **inalcançável** da contagem do painel do extrator (F-TA) — **fora por decisão
  do operador (2026-09-24)**, e o motivo é de projeto, não de custo: *"tem aceite escrito em
  dois lugares, e 'alcançável' depende do caminho, que muda quando o jogador constrói — o número
  ficaria instável"*. A F-T3 passa a ter um predicado de alcançabilidade
  (`tileAlcancavelParaColheita`), então o desconto é barato de fazer; o que ele custaria é
  **estabilidade**: a mesma pedreira mostraria 13 ou 9 dependendo de o jogador ter posto um
  prédio no meio do caminho, e os aceites da F-TP e da F-TA afirmam o par `(tiles, unidades)`
  como geometria, não como logística. Se um dia entrar, entra como **segunda** linha ("9 dos 13
  com caminho"), nunca trocando o número que já está lá.
- **Pedra visível no braço do pedreiro na volta** — ideia, e o operador deixou o gatilho escrito
  (2026-09-24): *"Se a captura da Tarefa 7 mostrar que ele parece andar de mãos vazias sem
  motivo, aí vira aceite desta feature."* Hoje a colheita acontece **no depósito** (D3 do plano
  da F-T3): nada muda de mão durante a caminhada, e por isso não existe mercadoria órfã. Fazer
  seria render lendo um campo que a sim ainda não tem — a carga na mão do especialista **não
  existe** no estado, diferente da do serf.
- **O nome do ofício só quando o jogador pede** (F-D4, 2026-09-25). A F-D4 pôs o ofício sob
  cada unidade, e na vila da abertura (6 unidades) isso se lê bem. Medido no roteiro:
  `Carregador` desenha 71 px e `Obreiro` 51 px, num tile de 64 px — dois `Obreiro` em tiles
  vizinhos já se encostam (`screenshots/F-D4-3-oficio-de-perto.png`). Numa vila de 40
  unidades vira parede de texto. As saídas, todas de render: nome só ao passar o mouse, só na
  unidade selecionada, ou só acima de um nível de zoom. Não entra agora porque trocaria uma
  informação sempre visível por uma escondida sem que ninguém tenha reclamado ainda — e o
  retângulo é placeholder: quando virar sprite, a pergunta muda.
