# BUG-T (tropa travada: vaga bloqueada no meio do caminho) — plano com aceite

Pedido do operador (2026-09-30): "BUG-T (tropa travada, 2 em 400): severidade TRAVA. Só plano
com aceite, sem código." **Nenhum código de `src/` muda nesta entrega.** A severidade é do
operador: `trava`, então este plano é o próximo item da fila quando ele liberar o código.

## 1. O que está medido (sonda da leva de 2026-10-01; receita no `BUGS.md`)

- 400 ordens `MoveUnits` sorteadas na `criarEscaramuca`. 2 deixam soldados parados em
  `marchando`:
  - ordem 11: u24 com o tile do MEIO do caminho ocupado por u26 **ocioso** (caso 3), e o par
    u28/u33 em **troca mútua** (cada um quer o tile do outro). Presos 16 048 ticks;
  - ordem 19: o par u27/u28 em troca mútua, preso cerca de 1 750 ticks.

## 2. Onde cada caso escapa das trocas que existem (lido no código nesta sessão)

- **Troca mútua.** Os dois marcham, com `progresso` 0 e caminho de um passo até o tile do
  outro.
  - `andar` (`src/sim/units/movimento.ts`) vê o próximo tile ocupado e chama `esperarOuDesviar`.
  - Com `caminho.length === 1` não há contorno. O destino não tem militar **parado** (o outro
    marcha), e `cercadoPorParados` é falso. Resta "tenta de novo depois de outro período",
    para sempre.
  - `vagaTomadaPor` (`src/sim/systems/marcha.ts`, C-MOVIMENTO-02b) exige que o seguinte de
    quem ocupa tenha um militar PARADO (`militarParadoEm(state, seguinte, ...)`). Na troca
    mútua o seguinte dele é o tile de `u`, que marcha. Não dispara.
  - `vagaEmparedadaPor` (C-MOVIMENTO-02) exige parado no próximo tile e caminho > 1. Não dispara.
  - **Isto confirma a hipótese da leva:** a troca mútua é um quarto caso da família.
- **Caso 3 (u24).** O próximo tile tem u26 parado, do mesmo lado, e o caminho tem 2 passos,
  então `vagaEmparedadaPor` poderia disparar. Ele só não troca se o destino estiver ocupado
  (`militarOcupa`), ou se `desvio(..., soParados = true)` achar contorno.
  - **Hipótese, não medida:** o contorno contado só com os parados passa pelos tiles de
    u28/u33, que marcham e não contam. Então existe contorno para a regra da 02, mas não para
    o `esperarOuDesviar`, que conta todos. Se for isso, o caso 3 desta ordem é consequência da
    troca mútua ao lado, e some com ela.

## 3. Referência (KaM, clone `731a8a4`, `src/units/actions/KM_UnitActionWalkTo.pas`)

- `:125` `EXCHANGE_TIMEOUT = 0`: a troca com quem anda na direção oposta não espera.
- `:754-812` `IntSolutionExchange`:
  - `:787` se a próxima posição do oponente é a nossa, `PerformExchange`: "logically they
    simply walk through each-other". É a troca mútua.
  - `:799-802` se o oponente está em fase de espera (`kisWaiting`), força a troca e injeta a
    nossa posição no caminho dele.
- `:131` `WAITING_TIMEOUT = 40` e `:1076`: a unidade entra em espera depois de 40 ticks de
  interação, ou com o destino bloqueado.
- `:770-773`: não troca com inimigo que procura combate (`CheckForEnemy`).

## 4. Proposta de conserto (para o operador; nada feito)

**(A) Troca mútua de posição.** O militar `u` marchando, com `progresso` 0, tem no próximo
tile um militar `o` do mesmo lado, também marchando e com `progresso` 0, cujo próximo tile é o
de `u`. Os dois trocam de tile no mesmo passo, e cada um segue o próprio caminho (sem o
primeiro nó). O conjunto de tiles ocupados não muda, e a invariante de um militar por tile
continua. Vive em `passoMarchando`, ao lado das trocas da 02 e da 02b, com o mesmo formato:
um predicado exportado (`trocaMutuaCom`) e a troca aplicada ali.
- Espera antes de trocar: o KaM troca na hora (`:125`). Aqui a proposta é a mesma espera das
  outras duas trocas (`ticksDesvioMilitar`, já no dado, grupo `movimento`), para a família
  ter uma regra só. Decisão do operador: na hora (KaM) ou depois da espera (família).
- Inimigo nunca troca: só o mesmo lado, como na 02 e na 02b.

**(B) Só se a Tarefa 1 mostrar que o caso 3 não depende da troca mútua:** a troca forçada com
quem está esperando (`:799-802`), depois de uma espera nova no dado (grupo `movimento`, com o
40 do KaM como referência escrita no `_doc`). Número novo em `data/` é decisão do operador, e
por isso fica fora da (A).

## 5. Aceite (para quando o operador liberar o código)

1. **Tarefa 1, antes do código (sonda, depois apagada):** reproduz as ordens 11 e 19 pela
   receita do `BUGS.md`. Para cada preso, em cada ciclo de espera, registra qual condição de
   `vagaEmparedadaPor` e de `vagaTomadaPor` falha e quem está no próximo tile (parado ou
   marchando, e para onde). Depois refaz a ordem 11 com u28/u33 trocados à mão no primeiro
   ciclo e mede se o u24 se solta.
   - Se algum preso não for troca mútua nem caso 3 explicado por ela: **parar e trazer**,
     porque a (A) não cobre.
   - Se o u24 não se soltar: a (B) entra, e espera a decisão do número.
2. **Repro da troca mútua pelo `step`, vermelho antes do conserto:** dois soldados do mesmo
   lado, lado a lado, cada um mandado para o tile do outro. Hoje: 200 ticks depois os dois
   continuam `marchando`. Depois: os dois `ociosos`, cada um no tile que lhe foi mandado, em no
   máximo `ticksDesvioMilitar` + o custo de um passo (do dado).
3. **Inimigo não troca:** o mesmo cenário com os dois de lados opostos. Nenhuma troca de tile
   acontece (guarda: eles estão frente a frente no tick da ordem).
4. **A varredura das 400 ordens vira teste permanente:** a receita do `BUGS.md`, 0 de 400 com
   soldado ainda em `marchando` depois de 1 500 ticks. Em todo tick, um militar por tile
   (`violacoesDeInvariantes`). O eixo é contagem, e o teto de tempo do teste é só guarda de
   travamento (§8). Se a corrida inteira passar de 60 s, o teste fica com as ordens 11 e 19 e
   mais 50 sorteadas, e o número da corrida vai para a evidência.
5. **Não-regressão:** C-MOVIMENTO-01 (a tropa não cai no mesmo tile), -02 (a tropa não trava),
   -02b (a vaga tomada por quem marcha) e C5 (militar não entra em tile de militar) verdes, e o
   determinismo (mesma ordem, mesmo estado byte a byte).
6. **Guarda estrutural:** `passoMarchando` importa `trocaMutuaCom` do mesmo módulo que o teste
   do aceite 2 exercita. Prova de que acusa: com o predicado trocado por `null`, o aceite 2
   reprova (sonda de uma corrida, revertida, registrada no PROGRESS).

## 6. Severidade

`trava` (operador, 2026-09-30). O aceite escrito da C-MOVIMENTO-02 e da 02b continua passando,
então a chave de nenhuma das duas cai. O que fecha o BUG-T é o aceite 4 deste plano.

## 7. Emenda (operador, 2026-09-30): código liberado, troca mútua NA HORA

Esta emenda vai num commit próprio, antes do código (CLAUDE.md §6, item 10). Onde ela diverge
das seções 4 e 5, vale ela.

- **Decisão:** a troca mútua é na hora, como no KaM (`src/units/actions/KM_UnitActionWalkTo.pas:125`).
  Não usa `ticksDesvioMilitar`, e a (B) não entra.
- **Tarefa 1, feita** (sonda apagada): a receita do `BUGS.md` **não reproduz** as ordens 11 e 19.
  Testei o LCG avançado antes e depois do sorteio, a tropa por tipo, por classe e pelo lado
  inteiro, e a parada por "todos ociosos" e por "ninguém marchando". Nenhuma combinação dá o
  destino 36,43 da ordem 11. A receita fica **fixada** assim, e é a do aceite 4:
  - `x₀ = 12345`; cada sorteio faz primeiro `x = (x·1103515245 + 12345) mod 2³¹` e depois
    `rnd(n) = x mod n`;
  - a tropa são os soldados do lado do jogador com o tipo `escaramuca.tropaDoJogador.tipo`, e o
    líder de referência é o primeiro deles no estado inicial;
  - a ordem vai para a tropa inteira: destino `(líder.gx + rnd(17) − 8, líder.gy + rnd(17) − 8)`,
    `direcao rnd(8)`, `colunas 3 + rnd(7)`, nesta ordem de sorteio;
  - cada ordem roda até todos os vivos ficarem `ocioso`, ou no máximo 1 500 ticks.
  - **Medido:** 3 das 400 ordens deixam presos (k = 4, 9 e 11). Os 6 presos são **troca mútua**:
    cada par quer o tile do outro. O caso 3 (tile do meio) não aparece nesta receita. A (A) cobre.
- **Onde vive:** em `andar` (`src/sim/units/movimento.ts`), para todo militar que anda, e não só
  em `passoMarchando`: a colisão da largada e a da chegada estão lá. Predicado exportado
  `trocaMutuaCom`. As duas isenções:
  1. **largada:** o parceiro no meu próximo tile, do mesmo lado, com o próprio próximo tile igual
     ao meu tile, não me bloqueia;
  2. **chegada:** entro no tile do parceiro só se ele termina o passo neste mesmo tick, depois de
     mim na ordem (`progresso + 1 ≥` o custo dele). Se ele já foi processado neste tick, espero
     em `custo − 1`, sem contar espera, e no tick seguinte ele entra primeiro. Assim, nem com
     custos diferentes (estrada) dois militares ficam no mesmo tile no fim do tick, e cada passo
     custa o tempo de sempre.
- **Aceites que mudam:**
  - 2: pelo `step`, no campo aberto da C5 (militares colidem), dois soldados do mesmo lado,
    vizinhos, cada um mandado para o tile do outro. Vermelho antes do conserto (200 ticks depois,
    os dois `marchando`). Depois, os dois `ociosos` nos tiles trocados em no máximo o maior dos
    dois custos de passo + 2 ticks (custo lido de `custoDoPasso`, sem literal), e nenhuma
    sobreposição em tick nenhum. Mais um caso com um dos dois tiles em estrada (custos diferentes),
    com o mesmo afirmado.
  - 3: inimigo não troca. Os mesmos dois, de lados opostos: em nenhum tick um está no tile inicial
    do outro enquanto o outro está no dele.
  - 4: a receita fixada acima, 0 de 400 ordens com soldado em `marchando` no fim, e nenhuma
    sobreposição de militares em tick nenhum.
  - 6: sem guarda por import (o predicado e o `andar` moram no mesmo módulo). A prova de que
    acusa é uma sonda de uma corrida, com `trocaMutuaCom` devolvendo `null`: os aceites 2 e 4
    reprovam. É revertida e fica registrada no PROGRESS.

## 8. Emenda 2 (operador, 2026-09-30, depois do avaliador): o caso 3, a ordem perdida, e o escopo

Commit próprio, antes do código (CLAUDE.md §6, item 10). Onde diverge da seção 7, vale esta.

- **Onde vive a troca mútua (corrige a §7):** em `passoMarchando` (`src/sim/systems/marcha.ts`),
  ao lado das trocas da C-MOVIMENTO-02 e da 02b. Vale só para militar em `marchando`, que é quem
  recebe ordem de formação. Militar em outra FSM (`indo_lutar`) continua na regra da C5 (militares
  colidem). A troca é **atômica nas duas pontas**: os dois largam juntos e trocam de tile juntos,
  quando os dois terminam o passo. Medido: a versão com chegada separada da §7 deixava um terceiro
  entrar no tile vazio (7 ticks sobrepostos na varredura).
- **Cada um anda uma vez por tick:** quem a troca atômica já moveu (o parceiro) não é processado
  de novo no mesmo tick pela `sistemaDaMarcha`.
- **A ordem nova no meio da troca não se perde:** a troca atômica que termina o caminho respeita o
  `replanejar` da C-MOVIMENTO-02, como o passo normal, e a unidade segue para o destino novo.
- **Caso 3, pela extensão da vaga emparedada (C-MOVIMENTO-02), primeiro:** vale nas mesmas
  condições dela (em `marchando`, `progresso` 0, espera `ticksDesvioMilitar` cumprida, caminho > 1,
  um militar PARADO do mesmo lado no próximo tile), com o destino OCUPADO por outro do mesmo lado
  em `marchando`, cujo alvo é o tile de `u`. Os dois trocam de VAGA (`alvoTile` e `direcaoFinal`),
  cada um já está na vaga nova e para. O conjunto de vagas não muda, como na 02 e na 02b. Se isto
  não fechar o aceite 4, a troca forçada do KaM (`src/units/actions/KM_UnitActionWalkTo.pas:799-802`)
  vem ao operador com o número novo, **antes** de entrar no dado.
- **Aceites (substituem os da §7 onde repetem):**
  1. Tarefa 1: feita (§7).
  2. Troca mútua, no campo aberto e com estrada: os dois nos tiles trocados em no máximo o maior
     custo de passo + 2, sem sobreposição. Novo: nenhum dos dois soma mais de 1 de `progresso`
     por tick.
  3. Inimigo não troca (igual à §7).
  4. A varredura da §7: 0 de 400 ordens com soldado `marchando`, 0 sobreposições.
  5. **Novo (achado do avaliador), vermelho antes:** o par em troca recebe, no meio do passo, uma
     `MoveUnits` para um tile longe. Hoje ele para no tile trocado. Depois, ele chega ao tile novo,
     `ocioso`.
  6. **Novo, caso 3 isolado, vermelho antes:** dois do mesmo lado, cada um mandado ao tile do outro
     a dois passos, com um parado do mesmo lado no tile do meio. Hoje: `marchando` 200 ticks
     depois. Depois: os dois `ociosos`, cada um numa das duas vagas pedidas, o parado no lugar.
  7. Prova de que acusa (sonda de uma corrida, revertida, registrada no PROGRESS): sem a troca
     atômica, o aceite 2 reprova; sem a troca de vaga do caso 3, os aceites 6 e 4 reprovam; sem o
     `replanejar` na troca, o aceite 5 reprova.
  8. Não-regressão: C5, C-MOVIMENTO-02 e 02b, C6, C-COMBATE-01a, F26a e o `verify` inteiro.
- **Merge na `main` só com os aceites 1 a 6 verdes** (operador: "1 a 4"; 5 e 6 são os novos).

## 9. Registro da prova (2026-09-30, merge): o que a medida mostrou contra o aceite 7

Não muda critério nenhum; registra o que a sonda do aceite 7 mediu.
- Sem a troca atômica: os aceites 2, 5 e 4 reprovam.
- Sem o `replanejar` na troca: o aceite 5 reprova.
- **Sem a troca de vaga do caso 3: só o aceite 6 reprova.** O 4 continua verde. A previsão da §8
  ("os aceites 6 e 4") não se confirmou: com o "um passo por tick" (o `feitos` da
  `sistemaDaMarcha`), a ordem k = 37 não cai mais no caso 3. O caso 3 fica provado só pelo cenário
  isolado do aceite 6.

## 10. Por que a extensão da vaga emparedada, e não a troca forçada do KaM (registrado em 2026-09-30, pedido do operador)

- A ordem do operador foi tentar primeiro a extensão da vaga emparedada da C-MOVIMENTO-02, e trazer
  a troca forçada do KaM (`src/units/actions/KM_UnitActionWalkTo.pas:799-802`) só se ela não
  fechasse.
- **Fechou:** a `vagaCruzadaCom` resolve o caso 3 (aceite 6) com a mesma regra que a família já
  usa. Os dois trocam de VAGA, sem ninguém entrar em tile ocupado, e o conjunto de vagas não muda.
- **A troca forçada não entrou porque:**
  1. pede um número novo no dado (a espera de 40 ticks do KaM, `:131`, `:1076`), e número novo é
     decisão do operador;
  2. empurra o parado do meio para fora da vaga dele. A extensão não mexe em quem já chegou;
  3. seria uma quarta mecânica na família. A extensão reaproveita a da C-MOVIMENTO-02.
- **O caso 3 continua coberto em teste permanente pelo aceite 6** (cenário isolado em
  `tests/BUG-T-troca-mutua.test.ts`), já que a varredura das 400 ordens não o exercita mais (§9).

## 11. Correção depois do avaliador da leva 3 (2026-09-30): o passo fechava um tick mais cedo

- **Achado (bloqueante, aceite 2 da §8):** com o parceiro já processado no tick, a chegada atômica
  o movia de novo. O passo de custo 7 fechava em 6 ticks. O teste não via isso: olhava
  `progresso > anterior + 1`, e a chegada zera o progresso.
- **Conserto, sem mudar critério:**
  - a marcha guarda quem já teve o passo deste tick (`processados`) e quem completou o passo da
    troca neste tick e ficou segurado (`prontos`). O parceiro já processado só é movido pela
    chegada se estiver em `prontos`, e a largada conjunta não o move de novo;
  - o teste passou a medir, por unidade, os ticks em que ela avançou no passo contra o custo dele,
    contando o tick do comando.
- **Achado no caminho (medido):** com o conserto, a varredura reprovou na ordem k = 32, com 8
  presos num ciclo de três. O u30 ia para o tile do u22 (troca mútua); o u22 não largava porque
  o u32 reivindicava o tile do u30; o u32 não chegava porque o u30 ainda estava lá. Com parceiro
  de troca, a largada passou a esperar só quem está de fato no tile (`temOutroMilitar`), e não
  a reivindicação. A entrada real só acontece na troca atômica, e a chegada confere quem está lá.
- **Prova de que acusa** (sondas de uma corrida, revertidas):
  - sem o `prontos`, o aceite 2 reprova;
  - **a largada física não tem prova**: revertida (para a reivindicação, ou sem a conferência),
    os seis aceites continuam verdes, porque a ordem k = 32 deixa de se formar. A regra fica pelo
    raciocínio do ciclo acima, e isso é **hipótese, sem teste que a exija**.

## 12. A regra da largada ganhou o teste que a exige (2026-09-30, decisão do operador)

O operador mandou: ou um cenário isolado que force o ciclo de três e reprove sem a regra, ou a
regra sai. **Reproduziu**, e a regra fica.
- **Cenário** (`tests/BUG-T-troca-mutua.test.ts`, "o ciclo de tres da ordem k = 32"): é o estado
  do meio da marcha, montado como estava na varredura.
  - P em T0 quer T1, e Q em T1 quer T0: troca mútua, cada um a **um** passo da vaga;
  - Q já completou o passo e está segurado esperando P;
  - R vem de T2 e já começou o passo para T1, então reivindica T1.
- **Sem a regra** (a largada de P contando a reivindicação de R), os três ficam em `marchando` por
  300 ticks. **Com a regra**, param no tick 20, sem sobreposição: P em T1, Q em T0 e R no fim dele.
- A primeira tentativa, com P a dois passos da vaga, **não reproduziu**: em campo aberto, P
  contornava. Caminho de um passo não tem contorno (`esperarOuDesviar`), que era o caso do
  u22/u30 na varredura.
# Retomada de 2026-10-07 — cadeia de vagas com tropa de 24

Autorização: operador mandou prosseguir com as correções e implementações depois do
diagnóstico da ordem 13. Não muda os aceites anteriores nem o prazo de 1 500 ticks.

Correção: estender `vagaTomadaPor` para reconhecer a cadeia do ocupante da vaga:
militares aliados marchando, sem passo em andamento, cada um bloqueado pelo próximo,
até um aliado parado. Reutilizar a espera `ticksDesvioMilitar` e a troca de vagas já
existente. Não trocar posição, aumentar velocidade, encerrar ordem sem chegar nem
atravessar inimigos. Ciclo sem parado não é esta regra e conserva a troca mútua.

Aceites da retomada, escritos antes do código:
1. cenário isolado com três marchantes e um parado: pelo `step`, termina a marcha,
   preserva o conjunto das vagas finais e não sobrepõe militares em nenhum tick;
2. cadeia terminada em inimigo não permite troca de vaga;
3. manter a varredura original das 400 ordens com 18 soldados e acrescentar a mesma
   receita com 24: zero presos após 1 500 ticks e zero sobreposições;
4. testes anteriores de troca mútua, formação e colisão continuam passando;
5. evidência determinística em `test-output/`, registro em PROGRESS e remoção do
   BUG-TROPA-DE-24-PRESA somente depois dos aceites verdes.

## 13. Emenda 3 (operador, 2026-10-12, antes do código): a varredura roda em paz

O fechamento de 2026-10-11 (`ef391cf7`) deu o aceite 4 vermelho, e não por soldado preso: a escaramuça
mudou (clima, tropa de 27, IA), a paz acaba no meio da varredura e a IA mata 3 soldados na ordem 42
(tick 8612), antes de qualquer conferência de preso. Decisão do operador (opção a): a varredura mede
SÓ a marcha.

- A fixture da varredura põe a partida em paz durante toda ela (`pazAteTick` além do último tick
  possível da varredura). A IA não ataca, e nenhuma morte entra na conta.
- O resto do aceite 4 fica igual: as mesmas 400 ordens, a mesma semente do sorteio, as tropas de 18
  e 24, nenhum preso em `marchando` e nenhuma sobreposição, e todos vivos.
- Se aparecer preso (o Codex viu a ordem 99 com 24 em 2026-10-07), o teste fica vermelho e isso
  volta ao operador como demanda nova. Não se afrouxa o aceite.
- **Medida (2026-10-12, antes do código):** só com a paz, os 18 e os 24 morrem de fome antes do fim
  das 400 ordens (0 vivos), e o aceite cai no "todos vivos" sem chegar a conferir preso. A fixture
  também dá à tropa a condição cheia para o horizonte inteiro (`condicao.ticksCondicaoCheia.militar`
  acima de 400 x 1501 ticks, no dado do teste, usado na criação e no `step`). Nenhum soldado sai da
  conta por fome ou por ataque.

## 14. BUG-TROPA-PRESA-NA-VARREDURA — o DODGE do KaM (operador, 2026-10-13: "Corrija agora")

**Causa medida (2026-10-13, fase 4 da campanha, tick 11 000, 16 soldados presos):** um ciclo de TRÊS
marchantes, todos com `progresso` 0, cada um com o tile seguinte tomado pelo próximo: u15 (39,74) →
40,73 (u21), u21 (40,73) → 40,74 (u43), u43 (40,74) → 39,74 (u15). Os outros 13 estão na fila atrás.
A troca mútua só pega o ciclo de dois. O desvio (`esperarOuDesviar`) trata todo militar como parede, e
no corredor cheio não acha contorno: o contador zera e ele tenta de novo, para sempre.

**A correção, do KaM:** o DODGE (`src/units/actions/KM_UnitActionWalkTo.pas:846-902`, chamado em
`:1071`, depois do PUSH e do EXCHANGE e antes do AVOID; `DODGE_TIMEOUT = 5` em `:128`). O militar que
marcha, parado com o tile seguinte tomado (`progresso` 0) há `dodgeDepois` (0,5 s base, os 5 ticks do
KaM), olha os dois tiles ao lado do alvo: a direção do passo girada 45° para cada lado, a partir dele
(`KMPrevDirection`/`KMNextDirection`, o da esquerda primeiro). Se num deles há um militar do mesmo lado,
marchando, com `progresso` 0, cujo tile seguinte é o dele, e o passo até lá é andável (com a regra da
diagonal), o tile seguinte dele vira o desse vizinho (o caminho ganha esse tile na frente, vizinho do
alvo antigo). A troca mútua do BUG-T faz o resto, na hora. Inimigo nunca troca, como na troca mútua.

**Aceites (antes do código):**
1. Cenário isolado, pelo `step`, com o ciclo de três da medida (os três tiles e os três caminhos):
   sem a correção, ninguém sai do tile em 300 ticks; com ela, os três terminam a marcha nos destinos
   deles, sem dois militares no mesmo tile em nenhum tick.
2. O número novo em `data/units.json` (`colisaoMilitar.dodgeDepois_segundos_base`), no schema e no
   loader; nenhum número em `src/sim`.
3. O aceite 4 do BUG-T (a varredura das 400 ordens em paz, 18 e 24): zero presos, zero sobreposições,
   todos vivos. Se ainda houver preso, a medida do ciclo dele vai para cá antes de qualquer mudança.
4. Os testes de troca mútua, formação e colisão continuam passando (`verify:rapido`).
5. A fase 4 da campanha, medida de novo pelo `jogar-campanha` depois da correção (evidência).

**Emenda 14a (2026-10-13, antes do código; pela medida do aceite 3).** Com o DODGE, o ciclo de três sai,
mas a varredura ainda deixa presos (18: ordem 363, 4 presos; 24: ordens 85, 89 e 252). A forma é outra:
o marchante parado na largada tem o tile seguinte ocupado por um soldado PARADO (ocioso) da própria
formação, e o desvio não acha caminho em volta do bloco (ex.: 24, k = 85: u19 em 31,42 quer 31,41, de
u32 parado, e a vaga dele, 29,39, já tem um parado). As trocas de vaga que existem (emparedada, tomada,
cruzada) exigem casos de dois que não valem aqui.
- **A correção, do KaM:** o PUSH seguido da troca forçada (`KM_UnitActionWalkTo.pas:713-752` e `:754-830`;
  só o parado é empurrado, e sem tile livre o empurrado troca). Aqui, como ÚLTIMO recurso, depois das
  trocas de vaga que já existem: o marchante parado na largada há `ticksDesvioMilitar`, com um militar
  PARADO do mesmo lado no tile seguinte e sem contorno (o desvio, contando todos os militares), troca de
  tile com ele pela troca mútua. O parado volta para o tile dele depois. Se o tile do parado é o destino
  do marchante, o parado fica no tile de onde o marchante saiu (senão ele quereria de volta a vaga do outro).
- O aceite 3 fica igual (zero presos, zero sobreposições, todos vivos). Divergência declarada: o conjunto
  exato das vagas pode mudar nesse caso (o parado que estava fora da vaga dele termina no tile do
  marchante), e a varredura não confere vaga, só preso e sobreposição.
- Aceite novo **1b**: cenário isolado, pelo `step`, de uma fila de três parados entre o marchante e o
  destino, num corredor de um tile de largura: o marchante chega, os três parados voltam aos tiles
  deles, sem sobreposição em nenhum tick.

**Emenda 14b (2026-10-13, antes do código; pela medida do aceite 1b).** "O parado volta para o tile dele"
não funciona: o empurrado recebe como destino o tile em que ainda está, e a marcha o dá por chegado no
tick seguinte, antes de a troca andar; o marchante fica segurado no fim do passo. Como no PUSH do KaM
(o empurrado sai do caminho e não volta sozinho), **o empurrado fica no tile de onde o marchante saiu**.
O conjunto de tiles ocupados pela tropa não muda; quem está em qual tile muda. O aceite 1b passa a ter
o destino tomado (como na ordem 85) e afirma: ninguém em `marchando` no fim, nenhuma sobreposição, e o
marchante saiu do tile inicial.

**Emenda 14c (2026-10-13, antes do commit do código; pela medida do aceite 3).** Com 14a e 14b, a
varredura de 18 zera, e a de 24 deixa um preso na ordem 335: u28 (22,46) começou o passo para 22,45
quando o tile parecia livre, u29 parou nele, e u28 ficou segurado no FIM do passo (`progresso` = custo
− 1, contando `bloqueado`). O DODGE e a troca forçada exigiam `progresso` 0. Os dois passam a valer
também nesse estado (o soldado ainda está no tile dele), e quando agem o passo dele volta a 0.

**Emenda 14d (2026-10-13, antes do commit do código; pela medida do `verify:rapido`).** A troca forçada
sem recorte quebrou quatro testes de formação e colisão (C-COMBATE-01a, C-MOVIMENTO-02, C-MOVIMENTO-02b,
C5 (c)): ela agia onde as regras antigas já respondem. Ela passa a valer só no caso medido na varredura:
o DESTINO do marchante tomado por um parado, e o próximo passo não é o próprio destino (aí vale o "para
ali perto"). Com o destino vazio, as trocas de vaga que já existem respondem.

**Emenda 14e (2026-10-13, antes do commit do código; pela medida).** Com o recorte da 14d, a varredura
volta a deixar presos (18: ordem 363; 24: 154, 281 e 358). Na 363 o destino de u24 está VAZIO, mas ele e
u33 formam um nó de vagas, e a troca de vaga da C-MOVIMENTO-02 não age porque conta um contorno que passa
por quem também está preso. Sem recorte, o empurrão de tile deixava o empurrado fora da vaga e quebrava
a formação. A troca forçada passa a ser:
- **troca de VAGA**, a da C-MOVIMENTO-02: o parado recebe o destino do marchante e sai marchando; o
  marchante fica com a vaga do parado. O conjunto das vagas não muda;
- só depois do `WAITING_TIMEOUT` do KaM (`KM_UnitActionWalkTo.pas:131`, 40 ticks: "After this time we can
  be forced to exchange"), `colisaoMilitar.trocaForcadaDepois_segundos_base` = 4,0 em `data/units.json`,
  contado em tentativas de desvio que falharam no mesmo tile (`fsmData.tentativasDeDesvio`, zera quando o
  soldado muda de tile). Na primeira falha do desvio ela agia num engarrafamento passageiro de uma marcha
  normal (C-COMBATE-01a, 6 soldados em campo aberto);
- sem o próximo passo ser o destino, e sem alguém só de passagem no destino.
- O aceite 1b afirma: ninguém em `marchando` no fim e nenhuma sobreposição (o marchante pode ficar com a
  vaga do primeiro parado, no tile inicial).

**Emenda 14f (2026-10-13, antes do commit do código; pela medida do aceite 1b).** Com o destino tomado por
um parado, a troca de vaga da 14e entra em vaivém com a vaga tomada da C-MOVIMENTO-02b (p1 recebe o destino
tomado, fica preso, e m toma a vaga de volta). Passado o mesmo tempo (`trocaForcadaDepois`), sem contorno e
com o destino tomado por um parado, o marchante **para onde está** (o "para ali perto" de `esperarOuDesviar`,
que valia só no último passo, vale para o caminho inteiro). A troca de vaga fica para o destino vazio.
