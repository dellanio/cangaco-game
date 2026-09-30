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
