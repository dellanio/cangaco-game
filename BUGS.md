# Bugs abertos

Só o que está aberto. Bug corrigido **sai deste arquivo no mesmo commit que o
corrige** — o histórico do git é o arquivo morto. Isso mantém o arquivo curto e
barato de carregar em toda sessão.

Registre com `/bug` ou edite à mão. Se não souber a feature, escreva `?`.

**Severidades e o que cada uma provoca:**
- `trava` — interrompe a fila do BUILD_PLAN; é a próxima coisa a ser feita.
- `errado` — vira a chave da feature para `false` em `test-results.json`.
- `feio` — vai para `## Polimento` e não bloqueia nada.

---

## Modelo

```markdown
## BUG-000 — resumo em uma linha
- feature: F##-nome
- severidade: trava | errado | feio
- repro: repro/AAAA-MM-DD-x.json (semente, tick)
- esperado: o que a regra diz que deveria acontecer
- observado: o que aconteceu
- evidência: screenshots/bug-000.png
- status: aberto
```

---

## Abertos

## BUG-T — tropa travada: vaga bloqueada no MEIO do caminho (terceiro caso da família)
- feature: C-MOVIMENTO-02b (a vaga tomada por quem marcha) — limite conhecido dela
- severidade: a classificar. Não há repro, e o aceite escrito da C-MOVIMENTO-02 e da 02b
  continua passando, então a chave de nenhuma das duas cai. Se reproduzir em jogo, é `trava`:
  soldado que espera para sempre é travamento de regra, não balanceamento.
- repro: nenhum ainda. Quando acontecer, pause (P) e salve pelo painel H (botão Guardar): a
  partida vai para o `localStorage` do navegador. Diga o tick e quem ficou `marchando`.
- esperado: toda a tropa mandada para uma formação para, cada soldado numa vaga, em tempo
  finito.
- observado (hipótese, não medida): um soldado marcha para sempre quando o nó está num
  tile do MEIO do caminho dele, e não no próximo passo com a vaga como destino.
- **a família, para saber onde olhar sem reler os relatórios:**
  1. C-MOVIMENTO-02 (a tropa não trava): a vaga é o próximo tile e está ocupada por um
     PARADO do mesmo lado, sem contorno. Troca: `vagaEmparedadaPor`, em
     `src/sim/units/movimento.ts`.
  2. C-MOVIMENTO-02b: a vaga é o próximo tile e está ocupada por alguém que MARCHA para
     outra vaga, com `progresso` 0 e um parado à frente dele. Troca: `vagaTomadaPor`, em
     `src/sim/systems/marcha.ts`, chamada em `passoMarchando`.
  3. Este bug: o bloqueio não está no próximo passo com a vaga. As duas trocas exigem
     `caminho[0]` igual à vaga (ou o destino), então nenhuma dispara. Resta
     `esperarOuDesviar` (`units/movimento.ts`), que espera `ticksDesvioMilitar`, tenta o
     contorno e, sem contorno, "tenta de novo depois de outro período", para sempre.
- onde olhar primeiro: o soldado preso com `fsm: 'marchando'` e `fsmData.bloqueado`
  voltando a zero em ciclos. O `caminho[0]` dele e quem está naquele tile (parado ou
  marchando, de que lado, para onde) dizem qual dos três casos é.
- status: aberto

## BUG-U — arma produzida não chega ao Quartel
- feature: F25a (o quartel pede arma; nível 12 da escada, PARA REVISÃO) e C3 (a vaga do quartel)
- severidade: proposta `trava` — recruta que espera arma que nunca chega é espera
  indefinida, não balanceamento. Classificação final do operador: o aceite escrito da
  F25a passa no cenário isolado dele, então é lacuna de aceite, e a chave não cai sozinha.
- repro: sonda de 2026-09-30 (apagada; os números ficam aqui). `createInitialState(1)`,
  Oficina de Armas e Quartel pelo `PlaceBlueprint` a leste da escola, um carpinteiro e dois
  recrutas pedidos na escola, encomenda de 5 de cada arma, 12000 ticks.

  | corrida | armas feitas | entregues ao armazém | entregues ao quartel | no fim |
  |---|---|---|---|---|
  | base (tudo com estrada) | 15 | 15 | 15 | — |
  | A: quartel sem estrada | 15 | 15 | 0 | nenhuma `arma-para-quartel` criada; 2 recrutas lá |
  | B: base + 40 pedras a cada 200 ticks na saída da escola | 15 | 11 | 0 | 11 `arma-para-quartel` e 20 `saida-cheia-para-armazem` abertas; 2 recrutas lá |

- esperado: arma no armazém e vaga no quartel viram soldado em tempo finito.
- **causa B (medida): fome de prioridade.** O quartel registra a demanda
  (`gerarTarefasDoQuartel`, `src/sim/systems/jobs.ts:846-873`), mas `arma-para-quartel` é o
  nível 12, o último (`data/delivery.json:18`), e a ordem do serf é estrita por nível
  (`ordenarTarefasDoSerf`, `src/sim/jobs.ts:1186-1201`: `if (ca.nivel !== cb.nivel) return
  ca.nivel - cb.nivel`). Com qualquer tarefa de nível 1 a 11 aberta, nenhum serf pega a
  arma. O próprio `_doc` do nível 12 diz: "A posição no KaM não foi conferida no fonte".
- **causa A (medida): quartel sem estrada.** A origem passa por `origemMaisPerto`
  (`src/sim/systems/jobs.ts:433-446`) no modo `estrada`; sem ligação ela devolve `null` e a
  tarefa nem nasce. O recruta chega a pé (o `alistar` é outra tarefa). Isso o KaM também
  faz (abaixo). O defeito nosso é o silêncio: o alerta `sem-estrada`
  (`src/sim/selectors.ts:902-910`) só vale para prédio com `producao` e para a escola; o
  quartel devolve `false`.
- referência (KaM, clone 731a8a4):
  - `KM_Houses.pas:659`: o quartel pede `AddDemand(Self, nil, W, 1, dtAlways, diNorm)` —
    importância `diNorm`, a MESMA do insumo de produção (`KM_HandLogistics.pas:28-35`).
    Não é a última da fila: disputa por distância com as outras entregas normais.
  - `KM_HandLogistics.pas:1238-1246`: "Warfare has a preference to be delivered to
    Barracks" — arma só vai ao armazém se nenhum quartel aceita.
  - `KM_HandLogistics.pas:1587-1590`: armazém→quartel é isento da multa de +1000 que toda
    entrega que sai do armazém paga.
  - `KM_HandLogistics.pas:1220`: casa→casa exige rota por estrada (`tpWalkRoad`). A causa A
    é igual à do KaM.
- aceite proposto:
  1. Pelo `step`, o cenário B (a mesma carga de nível 8): as 15 armas entram no quartel e
     os dois recrutas viram soldado antes do teto de segurança. Hoje: 0.
  2. Com quartel ligado e com vaga, nenhuma arma vai para o armazém (a preferência do KaM):
     a tarefa que sai da oficina de armas tem destino no quartel.
  3. Quartel completo sem estrada até o armazém acende o alerta `sem-estrada`, pelo mesmo
     `temCausa`, com teste que reprova hoje.
- status: aberto. Mesma raiz do BUG-V, ver lá.

## BUG-V — tora passa pelo armazém antes de ir à Serraria
- feature: modelo de transporte do JobBoard (F05 em diante); não quebra aceite escrito
- severidade: proposta `errado`, de modelo. Mudar isto mexe em todas as entregas; é
  decisão do operador, e vira item de fila, não correção avulsa.
- repro: qualquer partida com Lenhador e Serraria. Não há sonda: o código decide sozinho,
  e não existe outro caminho (abaixo).
- esperado (KaM): a tora do lenhador vai direto à serraria que precisa dela; só vai ao
  armazém o que nenhuma casa pede.
- observado: tora sai do lenhador, entra no armazém e depois sai do armazém para a
  serraria. Duas viagens de serf onde o KaM faz uma.
- causa (medida no código): não existe casamento produtor→consumidor.
  - Saída de produtor tem um destino só, o armazém: `gerarTarefasParaArmazem`
    (`src/sim/systems/jobs.ts:546-566`, `saida-cheia-para-armazem`, nível 8).
  - Insumo tem uma origem só, o armazém: `origemMaisPerto`
    (`src/sim/systems/jobs.ts:433-446`) varre `armazensCompletos` e nada mais. Todos os
    geradores de entrega passam por ela (`:524`, `:607`, `:636`, `:852`, `:926`).
- referência (KaM, `KM_HandLogistics.pas`):
  - Oferta e demanda são duas listas; qualquer oferta casa com qualquer demanda que
    `ValidDelivery` aprova (`:1205-1285`). O armazém é só mais uma casa.
  - `TryCalculateBidBasic` (`:1492-1591`): lance = distância + aleatório, e `if (dWT =
    wtAll) or ((aOfferHouseType = htStore) and (dWT <> wtWarfare)) then IncAddition(1000)`
    — casa→casa ganha de casa→armazém e de armazém→casa.
- **BUG-U e BUG-V têm a mesma causa?** Em parte. A raiz comum: tudo passa pelo armazém, e a
  arma faz dois trechos (oficina→armazém no nível 8, armazém→quartel no 12). A fome do
  BUG-U vem de um defeito que se soma, o nível 12. Corrigir só o BUG-V (casamento direto)
  não resolve a fome se a entrega direta ao quartel herdar o nível 12; corrigir só a posição
  da arma na escada resolve o BUG-U e deixa o BUG-V. A causa A do BUG-U é à parte.
- aceite proposto:
  1. Pelo `step`: lenhador e serraria ligados, entrada da serraria abaixo do alvo. A tora
     vai numa tarefa só, origem no lenhador e destino na serraria, e o armazém não recebe
     tora enquanto a serraria tem vaga.
  2. Serraria cheia: a tora vai ao armazém (o comportamento de hoje continua como
     fallback).
  3. Guarda: nenhum cenário longo (F17, fase A) perde produção total contra a linha de
     base, e as viagens de serf por tora entregue caem.
- status: aberto

## BUG-X — especialista trabalha fora da casa, na porta
- feature: F14 (o especialista ocupa o prédio) e F-VIVO-b (o prédio anima)
- severidade: errado
- repro: qualquer casa de produção ocupada. O especialista chega, ocupa, e fica parado no
  tile da porta, ao sul, visível, enquanto produz e enquanto espera insumo.
- esperado (KaM): entra, some, e a casa toca a animação ociosa ou a de trabalho
  (`KM_Units.pas:662-667`, `KM_UnitActionGoInOut.pas:444`). Sai só para trabalhar fora
  (lenhador, fazenda, pescador), para mostrar fome, ou quando a casa é fechada.
- observado: a posse passa ao prédio com a unidade onde o caminho acabou
  (`src/sim/systems/especialistas.ts:146-149`); esse fim é a borda sul do footprint
  (`src/sim/footprint.ts:32-39`, `bordaSul`), e as trocas de rótulo da produção não mexem
  na posição (`especialistas.ts:206-208`, `comFsm`).
- conferido no código, não medido em jogo: a colisão já trata `trabalhando`,
  `esperando_insumo` e `saida_cheia` como `dentro` (`src/sim/colisao.ts`,
  `POSICAO_DO_ESTADO`), então a hipótese é que o especialista na porta NÃO bloqueia serf
  hoje e o defeito é de posição e de tela. A medida antes/depois está no plano.
- mesmo defeito da pergunta em aberto do PROGRESS (F-VIVO-b, caso 2: o laço de dentro com
  o trabalhador fora).
- plano: `docs/planos/2026-09-30-BUG-X-especialista-dentro-da-casa.md`. Entra depois do
  D-TRANSPORTE-03 T2 e antes do lote de recalibração do BALANCE_LOG.
- status: aberto

## BUG-Y — viagem inútil para comer: o especialista acha a prateleira vazia
- feature: F20b (fome e morte), decisão D5; aparece no D-TRANSPORTE-03 T2 (logística do KaM)
- severidade: a classificar pelo operador. Não quebra aceite escrito: a D5 prevê que "quem
  chega e não acha comida não espera".
- repro: vila da calibração (`tests/helpers/cal-vila.ts`, `comandosDaVilaNoTick`), 20 000
  ticks, na árvore `ebb2182` (branch `wip/D-TRANSPORTE-03-T2`). Os lenhadores u85/u86 saem
  para comer no tick 6 869, colhendo. Na base (`faf8590`), a mesma viagem sai no tick 7 286.
- observado: o lenhador vaga a casa (D8), anda até a Bodega, chega sem comida na prateleira, e
  a FSM vai `indo_comer → indo_ocupar`. Ele volta para a casa sem ter comido e perde ~110
  ticks por sentido. Nas duas árvores, a primeira viagem de comer do lenhador termina assim.
- esperado: o especialista não troca a produção por uma viagem que não alimenta.
- **o motivo registrado da D5** (`docs/planos/F20b-fome-e-morte.md:64-70`): "o assento é
  reservado; a comida, não. [...] A comida não é reservada porque uma refeição consome um
  **conjunto variável de tipos** (D7) e reservar uma unidade de um tipo seria uma reserva
  que mente sobre o que vai ser consumido. O que cobre a corrida é o portão do gerador [...]
  mais o consumo **atômico na chegada**: quem chega e não acha comida não espera — volta a
  `ocioso` no mesmo tick". O portão do gerador (a tarefa só nasce em Bodega com comida) vale
  no claim, e não na chegada: entre o claim e a chegada, outro comensal esvazia a prateleira.
- efeito medido: no T2 o pão chega mais cedo à Bodega, e a viagem perdida cai antes da 17ª
  tora, e não depois. Isso dá tree_trunk 50 contra 51 da base. Com 16 000, 20 000 e 30 000
  ticks, a diferença é sempre −1.
- saídas possíveis (não decididas, e sem correção nesta entrada): reservar comida por
  refeição (a D7 pede uma reserva de conjunto), ou o comensal conferir a prateleira de novo
  antes de vagar a casa.
- status: aberto

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.

## BUG-N — cana em pousio parece mato cortado
- feature: F-CANA-b (a mancha de cana da vila); o desenho é de `src/render/mapa.ts`
- severidade: feio
- repro: `npm run shot -- F-CANA-b`, captura `screenshots/F-CANA-b-1-abertura-com-a-cana.png`
- esperado: a mancha de cana nova se lê como roça esperando plantio, como o roçado do milho.
- observado: a cana nasce em pousio (`quantidadeInicial: 0`) e o render a pinta com o
  código único de ESGOTADO (`render/mapa.ts`, `codigoEsgotado`: "havia recurso") — o
  mesmo losango escuro da árvore cortada, sobre grama.
- causa: falta o chão arado que o milho tem. O milho em pousio fica sobre o terreno
  `campoArado` (marrom), derivado do mapa; a cana não tem terreno (`grapes` sem `terreno`
  em `resources.json`) e fica sobre `grama`, e aí o esgotado não tem contexto.
- **conferido 2026-09-28, continua valendo:** `render/mapa.ts` `codigoDoRecurso` ainda
  devolve `codigoEsgotado` para quantidade ≤ 0, e `grapes` segue sem `terreno`.
- correção: é do render, com a sessão do render (instrução do operador, 2026-09-26).
  Dois caminhos, a decidir lá: um código de "em pousio" separado do "esgotado" para
  cultura (tipo com `aradura` em `resources.json`), ou o chão de roça desenhado sob
  tile de cultura.

