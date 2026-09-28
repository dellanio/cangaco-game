# Siglas

Decisão do operador (2026-09-28).
- **Nada do que fechou é renomeado.** Renomear custaria cerca de 8 200 trocas em ~460 arquivos
  e deixaria 126 dos 145 commits órfãos.
- **O esquema novo vale para o que vier daqui em diante**, mais os itens abertos migrados na
  mesma data.
- **Sigla nunca aparece sozinha em relatório** (PROGRESS, avaliação, resposta ao operador):
  vem sempre com o nome ao lado, seja antiga ou nova. Exemplo: "F20b (fome e morte)",
  "D-MOVIMENTO-01e (colisão civil: aceite)".

## O esquema novo
- **Formato:** `<fase>-<MÓDULO>-<nn>`, com letra minúscula para sub-item. Exemplos:
  `D-MOVIMENTO-01a`, `C-IA-01`.
- **Fase:** a do `BUILD_PLAN.md` em que o item **nasceu**: A (loop de construção), B (comida e
  crescimento), C (militar) ou D (profundidade). A Fase 0 (fundação) está fechada e não recebe
  item novo. Se o item mudar de fase, a sigla não muda.
- **Módulo:** um da lista fechada abaixo. **Módulo novo só entra por decisão do operador.**
- **Número:** sequencial dentro de cada par fase-módulo, com dois dígitos. Uma sigla dada não
  é reaproveitada.
- **Onde a sigla nova vale:**
  - a chave do `test-results.json` (`<sigla>-<slug>`);
  - o escopo do commit (`feat(D-MOVIMENTO-01e): ...`);
  - o título no `BUILD_PLAN.md`;
  - o nome de arquivo de teste, roteiro e plano **novos**.

  Arquivos antigos mantêm o nome que têm.

## Os 11 módulos

| Módulo | O que cobre |
|---|---|
| OBRA | planta, canteiro, nivelamento, construção, demolição, reparo como obra |
| TRANSPORTE | JobBoard, serf, reservas, escada de entrega, armazém |
| PRODUCAO | ciclo de produção, especialistas, colheita, receitas |
| COMIDA | fome, Bodega, cadeias de comida, alimentar tropas |
| MOVIMENTO | A*, passo, colisão, estradas como rede de movimento |
| TERRENO | mapa, recursos no mapa, relevo, água, vegetação |
| COMBATE | luta, projétil, torre, ataque a prédio (o antigo "cerco" é combate), vitória e derrota |
| IA | o adversário: defesa, ataque, repor e alimentar tropas |
| TELA | o que o render desenha e a interface mostra (veja a fronteira abaixo) |
| ARTE | o asset em si (veja a fronteira abaixo) |
| SAVE | salvar, carregar, versão do save, determinismo entre saves |

### A fronteira entre TELA e ARTE
- **TELA** é o que o render desenha e a interface mostra: câmera, HUD, painéis, menus,
  camadas e ordem de desenho, animação **a partir** de quadros que já existem, o placeholder,
  a escala e a âncora aplicadas na tela, a regra de largura e altura **aplicada** pelo render.
  Mora em `src/render/` e `src/ui/`.
- **ARTE** é o asset em si: gerar ou derivar PNG, a imagem base em `assets/base/`, o sprite em
  `assets/sprites/`, a entrada no `assets/manifest.json` (tamanho, âncora, footprint, origem,
  licença). Segue a skill `skills/pianco-art-pipeline/`.
- **Na dúvida:** se o item muda um arquivo em `assets/`, é ARTE; se muda código em
  `src/render/` ou `src/ui/`, é TELA. Se muda os dois, são dois itens.

## Itens abertos migrados (2026-09-28)

| Sigla nova | Nome | Sigla antiga |
|---|---|---|
| D-MOVIMENTO-01a | colisão civil: o mecanismo, desligado | D1a |
| D-MOVIMENTO-01b | colisão civil: ligar e medir | D1b |
| D-MOVIMENTO-01c | colisão civil: empilhamento de fora do passo | D1a-2 |
| D-MOVIMENTO-01d | colisão civil: JobBoard sem A* na tarefa recusada, e "na porta" por estado da chave | D1a-3 |
| D-MOVIMENTO-01e | colisão civil: aceite (uma rua contra duas) | D1c |
| D-MOVIMENTO-01f | colisão civil: recalibração em lote | D1d |
| C-IA-01 | IA: alimentar tropas | F28-IA-ponto-5 |
| C-COMIDA-01 | fome militar (Feed) | F-FEED |
| B-TERRENO-01 | recentrar a vila | F18c-2 |
| C-COMBATE-01 | formação, virar e storm attack | F27 |
| D-PRODUCAO-01 | ferro e smithies | F29 |
| D-TRANSPORTE-01 | armazém com toggles por mercadoria | F30 |
| D-TRANSPORTE-02 | menu de distribuição | F31 |
| D-TELA-01 | aba de estatísticas | F32 |
| D-TELA-02 | minimapa | F33 |

- A série D1 inteira migrou, inclusive os sub-itens já fechados, porque a série está aberta:
  duas siglas vivas para o mesmo trabalho é o que esta tabela existe para evitar.
- As 7 features que nunca começaram migraram também (decisão do operador, 2026-09-28: "a regra vale para todas"). A sigla sai da fase em que o item NASCEU: a B-TERRENO-01 (recentrar a vila) vem da F18c, na Fase B, embora esteja na fila depois da Fase C.

## Todas as siglas antigas

| Sigla antiga | Nome | Sigla nova | Situação | Chave no `test-results.json` |
|---|---|---|---|---|
| F01 | esqueleto do projeto | — | fechado | `F01-esqueleto` |
| F02 | tick determinístico | — | fechado | `F02-tick-determinista` |
| F03 | dados validados contra o schema | — | fechado | `F03-dados-validados` |
| F04 | grid ortogonal | — | fechado | `F04-grid-ortogonal` |
| F05a | estado inicial | — | fechado | `F05a-estado-inicial` |
| F05b | HUD | — | fechado | `F05b-hud` |
| F06 | menu de construção e planta | — | fechado | `F06-menu-build-planta` |
| F07 | posicionar a planta | — | fechado | `F07-posicionar-planta` |
| F08 | estradas | — | fechado | `F08-estradas` |
| F09 | JobBoard (criar, reclamar, liberar) | — | fechado | `F09-jobboard` |
| F10 | FSM do serf | — | fechado | `F10-serf-fsm` |
| F11a | laço de tempo | — | fechado | `F11a-laco-de-tempo` |
| F11b | JobBoard da construção | — | fechado | `F11b-jobboard-construir` |
| F11c | FSM do laborer | — | fechado | `F11c-laborer-fsm` |
| F12 | desbloqueio de prédios | — | fechado | `F12-desbloqueio` |
| F13a | escola: fila de treino | — | fechado | `F13a-schoolhouse-fila` |
| F13b | escola: painel | — | fechado | `F13b-schoolhouse-painel` |
| F14 | especialistas ocupam prédio | — | fechado | `F14-especialistas-ocupam` |
| F15a | ciclo de produção | — | fechado | `F15a-producao-ciclo` |
| F15b-1 | escada de entrega do produtor | — | fechado | `F15b-1-escada-do-produtor` |
| F15b-2 | oráculo e calibração da produção | — | fechado | `F15b-2-oraculo-e-calibracao` |
| F16a | demolir prédio | — | fechado | `F16a-demolir-predio` |
| F16c | pausar e modos | — | fechado | `F16c-pausar-e-modos` |
| F16b | painel de seleção | — | fechado | `F16b-painel-selecao` |
| F17 | aceite da Fase A | — | fechado | `F17-aceite-fase-a` |
| F17b | material na obra | — | fechado | `F17b-material-na-obra` |
| F17c | buffer do A* | — | fechado | `F17c-buffer-do-astar` |
| F17f | primeiro sprite | — | fechado | `F17f-primeiro-sprite` |
| F17d | nivelamento do canteiro | — | fechado | `F17d-nivelamento-canteiro` |
| F17e | estágios da obra | — | fechado | `F17e-estagios-da-obra` |
| F18a | zoom da câmera | — | fechado | `F18a-zoom-da-camera` |
| F18b | mapa grande | — | fechado | `F18b-mapa-grande` |
| F22 | alertas do HUD | — | fechado | `F22-alertas-do-hud` |
| F18e | estrada diagonal | — | fechado | `F18e-estrada-diagonal` |
| F18d-1a | modo de rota por nível | — | fechado | `F18d-1a-modo-por-nivel` |
| F18d-1b | estrada no canteiro | — | fechado | `F18d-1b-estrada-canteiro` |
| F18d-2 | estrada planejada na tela | — | fechado | `F18d-2-estrada-planejada-na-tela` |
| F18f | unidade empilhada | — | fechado | `F18f-unidade-empilhada` |
| F-T1 | terreno base | — | fechado | `F-T1-terreno-base` |
| F-T2a | recursos no mapa | — | fechado | `F-T2a-recursos-no-mapa` |
| F-D1 | tela de ajuda | — | fechado | `F-D1-tela-de-ajuda` |
| F-D2 | navegação da câmera | — | fechado | `F-D2-navegacao-camera` |
| F-D3 | reserva por raio | — | fechado | `F-D3-reserva-por-raio` |
| F-T2b | árvore como obstáculo | — | fechado | `F-T2b-arvore-obstaculo` |
| F-T2c | colheita pelo JobBoard | — | fechado | `F-T2c-colheita-pelo-jobboard` |
| F-TP | alcance na planta fantasma | — | fechado | `F-TP-alcance-na-planta-fantasma` |
| F18 | roçado de milho | — | fechado | `F18-rocado-de-milho` |
| F19 | moinho e padaria | — | fechado | `F19-moinho-e-padaria` |
| F-TA | painel de alcance | — | fechado | `F-TA-painel-alcance` |
| F19b | cadeia da carne | — | fechado | `F19b-cadeia-da-carne` |
| F20a | Bodega recebe comida | — | fechado | `F20a-bodega-recebe-comida` |
| F20b | fome e morte | — | fechado | `F20b-fome-e-morte` |
| F20c | marcador de fome | — | fechado | `F20c-marcador-de-fome` |
| F-T3 | o especialista sai do prédio | — | fechado | `F-T3-especialista-sai` |
| F21 | cadeia do ouro | — | fechado | `F21-cadeia-do-ouro` |
| F23 | salvar e carregar | — | fechado | `F23-save-e-load` |
| F-D4 | nome do ofício | — | fechado | `F-D4-nome-do-oficio` |
| F18h | terra de plantio | — | fechado | `F18h-terra-de-plantio` |
| F18i | terra na tela | — | fechado | `F18i-terra-na-tela` |
| F-T4a | pescador | — | fechado | `F-T4a-pescador` |
| F21b | mina esgota | — | fechado | `F21b-mina-esgota` |
| F-T4b | lenhador | — | fechado | `F-T4b-lenhador` |
| F-CAL-a | cenário da calibração | — | fechado | `F-CAL-a-cenario` |
| F-CAL-b1 | calibração medida na abertura | — | fechado | `F-CAL-b1-calibracao` |
| F-CAL-b2 | faixa da calibração | — | fechado | `F-CAL-b2-faixa` |
| F18g | a pedra viaja até a estrada | — | fechado | `F18g-pedra-viaja` |
| F-T4d | pescador em partida | — | fechado | `F-T4d-pescador-em-partida` |
| F-SPR | carregamento de sprites | — | fechado | `F-SPR-carregamento` |
| F-CANA | canavial e mina | — | fechado | `F-CANA-canavial-e-mina` |
| F-VIVO-0 | mundo vivo: base | — | fechado | `F-VIVO-0` |
| F23b | salvar pela tela | — | fechado | `F23b-salvar-pela-tela` |
| F-VIVO-a | pilhas de mercadoria | — | fechado | `F-VIVO-a-pilhas` |
| F18c-1a | helpers derivam a posição | — | fechado | `F18c-1a-helpers-derivam-posicao` |
| F18c-1b | literais diretos | — | fechado | `F18c-1b-literais-diretos` |
| F18c-1c | guarda do mundo transladado | — | fechado | `F18c-1c-guarda-transladado` |
| F24a | armas | — | fechado | `F24a-armas` |
| F-VIVO-b | animação de trabalho | — | fechado | `F-VIVO-b-trabalho` |
| F-VIVO-c | animais | — | fechado | `F-VIVO-c-animais` |
| F-VIVO-d1 | camadas a 0,75 | — | fechado | `F-VIVO-d1-camadas-a-075` |
| F-VIVO-d2 | quadro único | — | fechado | `F-VIVO-d2-quadro-unico` |
| F-TR-b | quadros e lajedo | — | fechado | `F-TR-b-quadros-e-lajedo` |
| F-ESC | altura do prédio pela largura | — | fechado | `F-ESC-altura-pela-largura` |
| F-CERCO-a2 | tropa ataca prédio | — | fechado | `F-CERCO-a2-ataque` |
| F-CERCO-b | reparo de prédio | — | fechado | `F-CERCO-b-reparo` |
| F28c | regeneração | — | fechado | `F28c-regeneracao` |
| F25a | quartel (sim) | — | fechado | `F25a-quartel-sim` |
| F25b | painel do quartel | — | fechado | `F25b-painel-do-quartel` |
| F26a | ordem de mover | — | fechado | `F26a-ordem-de-mover` |
| F26b | selecionar pela tela | — | fechado | `F26b-selecionar-pela-tela` |
| F28a | corpo a corpo | — | fechado | `F28a-corpo-a-corpo` |
| F28d | arqueiro | — | fechado | `F28d-arqueiro` |
| F28b | Torre de Pedra | — | fechado | `F28b-torre-de-pedra` |
| F28 | IA: defesa, pontos 1, 2 e 3 | — | fechado | `F28-IA-defesa-pontos-1-2-3` |
| F28-IA-ponto-4 | IA: repor tropas | — | fechado | `F28-IA-ponto-4-repor` |
| F28-IA-ponto-5 | IA: alimentar tropas | C-IA-01 | aberto | `F28-IA-ponto-5-alimentar` |
| F28-IA-ponto-6 | IA: ataque repetido | — | fechado | `F28-IA-ponto-6-ataque` |
| F34 | vitória e derrota | — | fechado | `F34-vitoria-e-derrota` |
| F35 | Feira | — | fechado | `F35-feira` |
| F36 | Prefeitura (mercenários) | — | fechado | `F36-prefeitura` |
| F-TR-a | textura e transição do terreno | — | fechado | `F-TR-a-textura-e-transicao` |
| F-REPL-e | estados da árvore | — | fechado | `F-REPL-e-estados-da-arvore` |
| F-CERCO-a1 | lado das unidades e prédios | — | fechado | `F-CERCO-a1-lado` |
| F17g | revelação da obra | — | fechado | `F17g-revelacao-da-obra` |
| UI-barra-a | barra lateral única | — | fechado | `UI-barra-a-barra-lateral-unica` |
| F-CANA-b | mancha de cana da vila | — | fechado | `F-CANA-b-mancha-de-cana-da-vila` |
| F-DEV | dev server sem órfão | — | fechado | `F-DEV-dev-server-sem-orfao` |
| F-CAMPO-a | campo cresce no tile | — | fechado | `F-CAMPO-a-campo-cresce-no-tile` |
| LOTE3-b1 | canavial em fases | — | fechado | `LOTE3-b1-canavial-em-fases` |
| LOTE3-b2 | quatro produtores em fases | — | fechado | `LOTE3-b2-quatro-em-fases` |
| LOTE3-c | pedreiro com três por viagem | — | fechado | `LOTE3-c-pedreiro-tres-por-viagem` |
| F-REPL-a | toco rebrota | — | fechado | `F-REPL-a-toco-rebrota` |
| F-REPL-b | modos do lenhador | — | fechado | `F-REPL-b-modos` |
| D1a | colisão civil: o mecanismo, desligado | D-MOVIMENTO-01a | fechado | `D1a-colisao-civil` |
| D1a-2 | colisão civil: empilhamento de fora do passo | D-MOVIMENTO-01c | fechado | `D1a-2-empilhamento-fora-do-passo` |
| D1a-3 | colisão civil: JobBoard sem A* na tarefa recusada e "na porta" por estado da chave | D-MOVIMENTO-01d | fechado | `D1a-3-jobboard-e-porta-por-estado` |
| F-REPL-c | replantio medido (sem mudança de código) | — | medido | — |
| C1 | cadência própria de projétil e torre | — | fechado | — |
| C2a | o projétil voa (sim) | — | fechado | — |
| C2b | o projétil na tela | — | fechado | — |
| C3 | defeitos do quartel | — | fechado | — |
| C4 | botão de reparo | — | fechado | — |
| C5 | colisão militar | — | fechado | — |
| C6 | revidar enquanto marcha | — | fechado | — |
| C7 | o lado filtra o JobBoard | — | fechado | — |
| C8 | prioridades da IA | — | fechado | — |
| C9 | o fim de partida para o jogo | — | fechado | — |
| C10 | exceção de largura por prédio | — | fechado | — |
| D1b | colisão civil: ligar e medir | D-MOVIMENTO-01b | fechado (medida) | — |
| D1c | colisão civil: aceite (uma rua contra duas) | D-MOVIMENTO-01e | aberto | — |
| D1d | colisão civil: recalibração em lote | D-MOVIMENTO-01f | aberto | — |
| F-FEED | fome militar (Feed) | C-COMIDA-01 | aberto, plano à espera | — |
| F18c-2 | recentrar a vila | B-TERRENO-01 | aberto, não iniciado | — |
| F27 | formação, virar e storm attack | C-COMBATE-01 | aberto, não iniciado | — |
| F29 | ferro e smithies | D-PRODUCAO-01 | aberto, não iniciado | — |
| F30 | armazém com toggles por mercadoria | D-TRANSPORTE-01 | aberto, não iniciado | — |
| F31 | menu de distribuição | D-TRANSPORTE-02 | aberto, não iniciado | — |
| F32 | aba de estatísticas | D-TELA-01 | aberto, não iniciado | — |
| F33 | minimapa | D-TELA-02 | aberto, não iniciado | — |
