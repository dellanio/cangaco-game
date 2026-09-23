# F16a — Demolir prédio (sim)

Plano de implementação. Feature escolhida pelo operador; o critério de aceite vem
do `BUILD_PLAN.md` e não é reescrito aqui.

## 0. O corte

A F16 do `BUILD_PLAN.md` foi partida em duas pelo operador (2026-09-23), no molde
da F13:

| Ordem | Item | Escopo | Toca | Nota de integração |
|---|---|---|---|---|
| 1 | **F16a** | comando de demolir prédio, devolução, os três casos de demolição | só `src/sim/` | **não precisa** |
| 2 | **F16c** | `pausar` e os `modos` do Woodcutter's | só `src/sim/` | **não precisa** |
| 3 | **F16b** | o painel genérico, reusando `selecao.ts` e `predioNoTile` | `ui/`, `input/`, `render/` | **sim, escrita na fila antes do código** |

A F16c vem **antes** da F16b por decisão do operador: o botão pausar está no
escopo escrito da F16, e painel sem ele é entrega pela metade (§4, ponto B).

Razão registrada como o operador a deu: a metade de `sim/` carrega as duas notas
mais delicadas da fila (escola com tarefa de ouro reclamada; estrada da porta com
treino já pago), e se a segunda travar é travamento de regra — ele quer isso numa
feature focada. A nota de integração ele autorizaria se a metade de `sim/` fosse
trivial; não é.

**Este plano cobre só a F16a.** O da F16b nasce na sessão dela
(`docs/planos/F16b-painel.md`).

## 1. Escopo

**Entra:**
- `DemolishBuilding` na união `Command`, tratado em `step()`.
- Devolução de material **e do estoque interno** ao armazém (§3, Tarefa 3).
- Os três casos de demolição que as notas da fila exigem, pelo **comando real**.
- **A correção do `canPlace`** (decisão do operador): recusar posicionamento que
  cobre a borda sul de um prédio existente. É achado da F16a que **corrige a
  F06** — a regra fica onde pertence, não na escola. Condicionada à Tarefa 1b.

**Não entra (declarado, com destino):**
- Painel, botão, atalho `Delete`, evento consumido pelo render — F16b.
- `pausar` e `modos` do Woodcutter's — F16c, aprovada pelo operador (§4, B).
- Demolir unidade (*Dismiss*, GDD §2.3) — não está no escopo escrito da F16.
- Reposicionar prédio, confirmação de demolição, desfazer.

## 2. Os fatos que o desenho usa (verificados nesta sessão, com caminho)

1. **Não existe comando de demolir prédio.** `Command` tem cinco membros
   (`src/sim/commands.ts:12-67`); o `switch` de `step()` fecha com `never`
   (`src/sim/tick.ts:65-76`), então o membro novo não compila sem tratamento.
2. **A limpeza já existe, e é geral.** `sanearTarefas` roda logo depois dos
   comandos, no mesmo tick (`src/sim/tick.ts:86`), e `motivoDoDestino` devolve
   `'destino-sumiu'` para prédio ausente antes de olhar o tipo
   (`src/sim/systems/jobs.ts:65-67`); `motivoIndividual` cobre a origem
   (`:108`, `'origem-sumiu'`) e o caminho (`:109`). Tarefa `carregando` só olha
   unidade e destino (`:119-123`) e **sempre cancela** (`src/sim/jobs.ts:486`) —
   é por aí que o serf carregado vai a `devolvendo`.
3. **A fila da escola já se limpa.** `sanearFilas` apaga a fila de prédio que não
   é escola completa e diz na docstring que é da demolição
   (`src/sim/systems/escolas.ts:107-117`), chamada na primeira linha de
   `sistemaDasEscolas` (`:120`).
4. **O ocupante já volta a `ocioso`.** A posse mora no prédio; com o prédio fora
   do estado `predioDoOcupante` devolve `null` e o passo chama `ficarOcioso`
   (`src/sim/systems/especialistas.ts:198-203`). *(A nota do `BUILD_PLAN` chama
   essa função de `passoTrabalhando`; o nome real é `passoProduzindo` — corrijo a
   nota junto.)*
5. **A fração de devolução já está no dado e carregada, e nunca foi lida.**
   `data/buildings.json:42` → `construcao.devolucaoAoDemolir: 0.5`, carregada em
   `src/sim/data/loader.ts:117`, tipada em `src/sim/data/types.ts:36`. É campo
   **próprio**, distinto de `terrain.estrada.devolucaoAoDemolir`
   (`data/terrain.json:8-9` diz isso em `_doc`), que é o da estrada.
6. **A conta da devolução já está escrita como contrato.** `PROGRESS.md`,
   "O contrato da obra": *F16 demolir — devolução = `devolucaoAoDemolir ×
   (custo − faltam)`*. Para prédio completo `faltam` não existe e a conta é o
   custo inteiro.
7. **O caminho de volta ao armazém existe, mas só para pedra.**
   `devolverPedra` (`src/sim/systems/estradas.ts:48-68`) entrega ao **primeiro
   armazém completo** de `predios.ordem`, na gaveta **`saida`**; sem armazém
   completo, nada muda. A mercadoria é constante do módulo.
8. **`tileDeSaida` não olha estrada.** Ele procura o primeiro tile da porta
   **andável em modo `'livre'`** (`src/sim/systems/escolas.ts:81-85`), e
   `tileAndavel` em `'livre'` só pergunta se há footprint em cima
   (`src/sim/pathfinding.ts:157-158`). Estrada só importa no modo `'estrada'`.
9. **A porta fica fora do footprint** — os tiles imediatamente ao sul
   (`src/sim/estradas.ts:205-216`) — e `canPlace` só recusa sobreposição de
   footprint contra footprint (`src/sim/placement.ts:57-62`). Nada impede
   plantar um prédio **em cima da porta** de outro.
10. **"Já pago" é `estado === 'treinando'`**, não um campo: o ouro sai na
    transição `aguardando → treinando` (`src/sim/systems/escolas.ts:130-142`), e
    `ItemDeFila` é união discriminada (`src/sim/state.ts:515-529`). Sem porta
    andável o item **segura**, e `restam` fica em 1 (`escolas.ts:153-154`).
11. **Demolir nunca re-bloqueia o menu.** `tiposJaConstruidos` só cresce
    (`src/sim/desbloqueio.ts`, travado por testes da F06); o `BUILD_PLAN` já
    registra isso na nota (origem: F12). Nenhum ramo novo.

## 3. As tarefas, em ordem

TDD em cada uma: teste que reprova primeiro, implementação depois.

### Tarefa 1 — a sonda da porta, **antes** de escrever o comando

Decisão do operador: o caso da estrada da porta é testado **primeiro**, porque
`DemolishRoad` já existe e um travamento de regra precisa aparecer antes de
qualquer coisa ser construída em cima.

Arquivo: `tests/F16a-porta.test.ts`. Cenário montado com os helpers que já
existem (`escola-cenario.ts`, `jobs-cenario.ts`), ouro chegando pelo caminho
real, até um item ficar `treinando` (ouro já cobrado).

1. **(1a) Demolir a estrada da porta com o item já pago.** Hipótese, derivada do
   fato 8 e **ainda não confirmada por execução**: a unidade **nasce mesmo
   assim**, porque a porta continua andável — estrada não entra na pergunta.
   Se isso se confirmar, **a premissa da nota da F13a está errada**, não o jogo:
   o teste fica como caracterização, com a razão escrita ao lado.
2. **(1b) O que de fato zera a porta.** Plantar uma obra cobrindo **todos** os
   tiles da porta (permitido pelo fato 9) e afirmar `tileDeSaida === null`, o
   item preso em `restam: 1` com o ouro cobrado, por N ticks. *(A confirmar na
   tarefa: obra entra em `footprintsDe`/`bloqueado` como prédio completo.)*
   Este teste **caracteriza o buraco**, e é escrito antes da correção.

**Se (1b) mostrar espera que nada desfaz por caminho nenhum, eu paro e reporto
antes de propor correção** — reembolsar o ouro, entregar a unidade por outro
tile ou deixar segurando é decisão de jogo, do operador.

### Tarefa 1.5 — fechar o buraco onde ele mora: `canPlace`

Decisão do operador: **o 1b não é da F16.** `canPlace` só checa footprint contra
footprint desde a F06 (`src/sim/placement.ts:57-62`); plantar em cima da porta
alheia é buraco **dele**. A correção fica lá, com **motivo próprio** na união
`MotivoDeRecusa` (`placement.ts:8`), e o teste de 1b vira o inverso: o comando é
**recusado**, e por isso `tileDeSaida` nunca fica `null` com item pago.

- Verificado que isso **não** obriga a tocar fora de `sim/`: `MotivoDeRecusa` só
  atravessa `render/` como tipo (`src/render/planta-fantasma.ts:12,31`), não há
  `switch` exaustivo nem rótulo por motivo em `ui/`, `render/` ou no tema.
  Os roteiros que afirmam motivo usam só `'sobreposicao'` (`tools/shots/F06.js:108`,
  `F07.js:95`), que não muda.
- Guarda no molde da F06: um teste que prova que a recusa é **pela razão certa**
  (`placement.ts:34` já registra esse cuidado) — recusar por `'sobreposicao'`
  passaria pelo motivo errado.
- Consequência a registrar: fechado o buraco, `tileDeSaida === null` deixa de ser
  alcançável por comando de jogador, e o ramo `if (tile === null) continue`
  (`escolas.ts:154`) fica como **defesa sem caminho de jogo**, não como regra
  viva. A nota da F13a se resolve pelos dois lados: a premissa (estrada) estava
  errada, e a via real (footprint) deixa de existir.
- **Ponto aberto, §4 ponto E**: a borda sul **fora do mapa** é a mesma família e
  não está na sua frase.

### Tarefa 2 — o comando

- `DemolishBuilding { readonly type; readonly predio: string }` em `commands.ts`,
  com a docstring no molde dos outros.
- `aplicarDemolishBuilding` em **`src/sim/systems/demolicao.ts`** (arquivo novo;
  `build.ts` é do `PlaceBlueprint` e a demolição tem regra própria), despachado em
  `tick.ts` antes do saneamento, como todos os comandos.
- **Nunca recusa**: id inexistente é no-op sem evento, molde do `DemolishRoad` e
  do `CancelTraining` (`commands.ts:37-43`, `:59-62`). Demolir obra e demolir
  completo são o mesmo comando.
- Remove de `predios.porId` e de `predios.ordem`. **Não** mexe em `jobs`,
  `treino`, `unidades` nem `tiposJaConstruidos`: quem limpa é o saneamento do
  mesmo tick (fatos 2, 3, 4, 11). É isso que o teste tem que provar, e é o que
  diferencia o comando real do helper `semOPredio`, que só tira de `predios`
  (`tests/helpers/jobs-cenario.ts:192-197`).
- Emite **`building-demolished { predio, tipo, devolvido }`** em `state.ts`. Não
  é enfeite: a F16b precisa do gancho para som e partícula, e §5 diz que efeito
  colateral sai por evento.

### Tarefa 3 — a devolução

- Conta: por mercadoria, `floor(devolucaoAoDemolir × (custo[m] − faltam[m]))`,
  com `faltam` zerado para prédio completo (fato 6). Nenhum número no `.ts`.
- **O estoque interno vai junto, inteiro** (decisão do operador): a pedra da
  gaveta `saida`, o ouro da `entrada`, o tronco parado — tudo para o **armazém
  completo mais próximo alcançável**. Sem armazém alcançável, **se perde**, e o
  teste declara esse caso. Razão dele: os níveis 6 e 7 da escada existem desde a
  F15b exatamente para trazer essas mercadorias de volta; destruir o que o
  jogador recuperaria esperando um tick pune quem demole rápido — e a conservação
  de bens é uma das invariantes mais fortes do projeto, que não se troca por
  simplicidade de implementação. É o mesmo que o serf já faz em `devolvendo`.
- "Mais próximo alcançável" = por **estrada**, da porta do prédio demolido,
  medido antes da remoção com `distanciaEntrePredios` (`sim/estradas.ts:190`) —
  a mesma régua que ordena tarefa no quadro. O precedente de forma é
  `passoDevolvendo` (`systems/serfs.ts:69-87`: "armazém completo mais próximo",
  e sem armazém alcançável a carga espera).
- **Leitura minha, confirme se discordar:** aplico esse mesmo destino ao
  **material de construção devolvido** deste comando, em vez do "primeiro armazém
  de `predios.ordem`" do `devolverPedra`. Dois destinos diferentes no mesmo
  comando seria regra dupla sem razão. O `DemolishRoad` **não muda** — ele não
  tem porta de onde medir, e mexer nele seria alterar comportamento testado da
  F08 sem pedido.
- Para não haver duas implementações, **generalizo `devolverPedra` para
  `devolverMercadorias(predios, Record<string, number>, destino)`** e faço a
  versão da estrada chamá-la com o destino de hoje. É o único refactor deste
  plano, e existe só porque a F16a precisa da mesma regra com outra mercadoria.
- Regra de validação em `tools/data-rules.js` para
  `buildings.construcao.devolucaoAoDemolir` em `[0,1]`, irmã da que já existe
  para a estrada (`data-rules.js:433-440`) — hoje o campo não é validado por
  nada. O teste troca o dado e confirma que a devolução acompanha, como a F08 faz
  (`tests/F08-estradas.test.ts:382-385`).
- **Um caso a mais no teste por causa disso**: demolir com estoque **e** sem
  armazém alcançável é perda declarada, não conservação (Tarefa 4, caso 4).

### Tarefa 4 — os casos, pelo comando real

Arquivo: `tests/F16a-demolir.test.ts` (+ o fecho de (1c) em `F16a-porta.test.ts`).

1. **Obra demolida com o serf a caminho** — o que a F10 provou por injeção
   (`semOPredio`), agora pelo comando. Duas corridas: serf **carregando** e serf
   ainda **indo buscar**. Afirma: tarefa cancelada com o motivo certo, serf em
   `devolvendo` e depois `ocioso`, **a carga de volta no armazém**, nenhuma
   tarefa órfã, nenhum serf parado — `violacoesDeInvariantes` e `violacoesDaFsm`
   (`tests/helpers/`) a **cada tick** da corrida, não só no fim.
2. **Escola demolida com `'ouro-para-escola'` reclamada** — o ramo
   `ehEscolaCompleta(destino) ? null : 'destino-sumiu'`
   (`systems/jobs.ts:73`), que hoje é código sem teste. Afirma o motivo
   `destino-sumiu`, a fila apagada por `sanearFilas`, e a **conservação do ouro**
   (`totalDeOuro`, `escola-cenario.ts:54`): com a regra do ponto C, o ouro que
   estava na gaveta `entrada` volta ao armazém e o total do mapa não muda — nem
   o ouro em trânsito com o serf, que o `devolvendo` traz.
3. **A porta** — com a Tarefa 1.5 no lugar, o caso que travava deixa de ser
   alcançável: o teste afirma a **recusa** do posicionamento que cobre a porta e,
   no mesmo cenário, que o item pago nasce normalmente. É isso que fecha a nota
   da F13a, em vez do "demolir o bloqueador" que eu tinha proposto.
4. **Sem armazém alcançável** (ponto C): demolir prédio com estoque e sem
   armazém ligado perde a carga, e o teste **declara** a perda com o número, em
   vez de afirmar conservação onde ela não vale.

Mais dois que saem de graça e o aceite escrito pede ("nenhuma tarefa órfã,
nenhum serf travado"): **prédio ocupado** (especialista volta a `ocioso`, fato 4)
e **determinismo** (mesma lista de comandos, mesmo estado byte a byte, pelo
helper `determinism.ts`).

### Tarefa 5 — evidência e fecho

- `gravarEvidencia('F16a', {...})` (`tests/helpers/evidence.ts`), no molde da F08:
  bloco `aceite` com as cláusulas escritas no `BUILD_PLAN`, blocos por caso, e
  todo número esperado vindo do dado.
- `npm run verify` verde; `test-results.json` só depois disso (o hook).
- **Sem screenshot nesta metade**: a F16a não muda um pixel. O screenshot que o
  item F16 pede é da F16b, e vai escrito na nota dela.
- `PROGRESS.md` com decisões, verificado x hipótese separados. Commit
  `feat(F16a): <resumo>`.

## 4. Os pontos de desenho — todos decididos pelo operador em 2026-09-23

### A — a nota da F13a: premissa errada, e o buraco é da F06 (decidido)

Pelo fato 8, demolir a estrada da porta **não** deixa o item preso: `tileDeSaida`
pergunta por footprint, não por estrada. A via real é porta **coberta por
prédio** — e **o operador decidiu que isso não é da F16**: `canPlace` só checa
footprint contra footprint desde a F06, e é lá que a recusa vai, com motivo
próprio (Tarefa 1.5). Registrado como **achado da F16a que corrige a F06**. A
nota da F13a é corrigida com a medição ao lado, molde da correção da F15a.

### B — `pausar` e `modos`: F16c, **antes** da F16b (decidido)

`pausar` e `modo` são campo novo em `PredioCompleto` e leitor no sistema de
produção: `sim/`, não painel — não cabem na F16b, que não toca `sim/`. O operador
aprovou o item próprio e **corrigiu a minha ordem**: a F16c vem **antes** da
F16b, porque o botão pausar está no escopo escrito da F16 e painel sem ele é
entrega pela metade. Fila: **F16a → F16c → F16b**.

A semântica de "pausado" continua sem fonte no GDD (uma linha `[geral]` em §2.3)
e é a primeira coisa a decidir na sessão da F16c: congela o relógio do ciclo?
para de pedir insumo? solta o ocupante? Isso fica na nota do item, não aqui.

### C — o estoque interno vai inteiro para o armazém (decidido)

Eu havia recomendado sumir com ele; **o operador discordou, e a razão dele fica
registrada**: os níveis 6 e 7 da escada existem desde a F15b para devolver o ouro
da escola e a pedra da Quarry, então destruir o que o jogador recuperaria
esperando um tick **pune quem demole rápido**; e a conservação de bens é uma das
invariantes mais fortes do projeto, que não se troca por simplicidade.

Regra: **estoque interno inteiro para o armazém mais próximo alcançável; sem
armazém alcançável, se perde, e o teste declara esse caso.** É o mesmo que o serf
já faz em `devolvendo`. A implementação está na Tarefa 3, com uma leitura minha
marcada lá (o material de construção passa a usar o mesmo destino).

### D — demolir renova o veio: `IDEIAS.md` + nota no F21 (decidido)

`producao.veio` é semeado no instante da conclusão (F15a/D2, contrato que a F21
herda). Demolir e reconstruir uma Quarry sobre o mesmo tile devolve o veio
**cheio**. **O tamanho, que é o que importa**: `production.json:5` dá
`quarry.veio.rendimento = 200` — 200 pedras renovadas por **metade** do custo de
construção (`devolucaoAoDemolir = 0.5`), contra ~55 min de produção contínua na
escala 2.0 que esse veio representa. É **exploit, não detalhe**. A F16a não é
dona disso: vai para `IDEIAS.md` e como nota no item F21, que decide se o veio
passa a ser do terreno — e aí o exploit some sozinho.

### E — a borda sul fora do mapa: recusar junto, no mesmo motivo (decidido)

Havia um irmão do buraco do ponto A que a sua frase não cobria: `canPlace` aceita
footprint colado na borda sul do mapa (`placement.ts:53` recusa só
`y1 > altura`, e a porta fica em `y1`), e esse prédio nasce sem porta no mapa.

Decidido: **uma regra, um motivo, um lugar** — a checagem é "a borda sul precisa
estar no mapa e livre", e cobre os dois casos com o mesmo motivo de recusa. A
razão que o operador deu, e que fecha o caso: prédio colado na borda sul do mapa
**nunca poderá receber entrega, porque não há onde passar a estrada**; recusar
não é rigor, é impedir que o jogador construa algo que nasce inútil.

Consequência para a Tarefa 1.5: o motivo é **um só**, e o teste cobre as duas
formas (porta coberta por vizinho; borda sul fora do mapa) com ele.

## 5. Definition of Done (CLAUDE.md §7)

- [ ] `npm run test` verde, com `F16a-porta.test.ts` e `F16a-demolir.test.ts`.
- [ ] `npm run typecheck` e `npm run lint` sem erro.
- [ ] Aceite do `BUILD_PLAN` verificado com `test-output/F16a.json` **aberto com
      Read**.
- [ ] `npm run validate:data` passa, com a regra nova de
      `construcao.devolucaoAoDemolir`.
- [ ] Nenhum import de `phaser` em `src/sim/`; nenhum arquivo de `render/`,
      `ui/` ou `input/` tocado — é o que dispensa a nota de integração.
- [ ] **O motivo novo de `MotivoDeRecusa` não vaza da sim.** Verificado antes de
      escrever a Tarefa 1.5: o único consumidor fora de `sim/` é
      `render/planta-fantasma.ts:12,31`, e ali o tipo só **passa**, sem `switch`
      exaustivo nem mapa de rótulo; os roteiros afirmam apenas `'sobreposicao'`
      (`tools/shots/F06.js:108`, `tools/shots/F07.js:95`). Se, ao implementar,
      aparecer um consumidor exaustivo, a Tarefa 1.5 **para** e vira item próprio
      — é ela que decidiria sozinha tocar `render/`, e isso não está autorizado.
- [ ] Não-regressão: roteiros da F06, F08, F10, F11c e F13b com código de saída 0
      (imagens **não** abertas, §8). A F06 entra na lista por causa da Tarefa 1.5.
- [ ] Commit `feat(F16a): ...`.

## 6. Tarefa 0 — a fila antes do código

O `BUILD_PLAN.md` ainda tem um item F16 só. Antes de qualquer código eu aplico a
edição abaixo (é a regra: a nota vai escrita na fila, não se infere):

- **F16 vira três itens, nesta ordem** — F16a, **F16c**, F16b — com escopo,
  aceite e evidência separados:
  - **F16a — Demolir prédio (sim)**: comando, devolução, os casos de demolição.
    Evidência: teste headless e `test-output/F16a.json`. Sem screenshot.
  - **F16c — Pausar e modos (sim)**: campo em `PredioCompleto` e leitor na
    produção. Vem antes da F16b por decisão do operador (§4, ponto B): o botão
    pausar está no escopo escrito da F16 e painel sem ele é entrega pela metade.
    A nota do item carrega a pergunta de semântica em aberto (congela o ciclo?
    para de pedir insumo? solta o ocupante?) — decidir é a primeira coisa
    daquela sessão, não desta.
  - **F16b — Painel de seleção (integração)**: o painel, com os botões demolir e
    pausar já apoiados em comando real. Evidência: `screenshots/F16b-*.png`.
- As notas de hoje são **redistribuídas**, não reescritas: as de demolição
  (origem F10, F13a, F14, F12) vão para a F16a; a de contrato herdado (origem
  F13b, `selecao.ts`/`predioNoTile`/`Esc` único) vai para a F16b.
- **Na F16b, e só nela**, a linha: *"feature de integração: toca `ui/`, `input/`
  e `render/`, autorizada pelo operador em 2026-09-23 — a exceção do §10 está
  aqui, escrita antes do código"*. A F16a e a F16c são só `sim/` e não a levam.
- A nota da F13a sobre a estrada da porta é **corrigida** no mesmo commit da
  fila, com a medição ao lado (§4, ponto A), e a correção do `canPlace` fica
  registrada no item da F16a como **achado que corrige a F06**.
- No item **F21**, a nota do veio (§4, ponto D), com o número: demolir e
  reconstruir renova `rendimento = 200` por metade do custo. A entrada gêmea vai
  para `IDEIAS.md`, que é onde ideia de design mora (§12).
- `test-results.json`: a chave `F16-painel-selecao-demolir` vira três, todas em
  `passes: false`, e só muda depois do `npm run verify`, pelo portão.
