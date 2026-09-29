# D-TRANSPORTE-01 — armazém com liga/desliga por mercadoria

**Item da fila (lote do operador, item 5):** "armazém com liga/desliga por mercadoria". É a
linha do GDD §7.2: "Painel do Storehouse | 28 mercadorias, quantidade e toggle
aceitar/bloquear | P1". O `BUILD_PLAN.md` não tem aceite escrito para o item; o aceite
abaixo é o deste plano.

## A regra no KaM (conferido em `KM_HouseStore.pas`, 731a8a4)

- `NotAcceptFlag[ware]` por armazém. `ShouldAbandonDeliveryTo` devolve verdadeiro quando
  a flag está ligada: a entrega a caminho de um armazém que passou a bloquear é
  abandonada.
- `Activate`: o armazém novo herda as flags do primeiro armazém do jogador.
- `NotAllowTakeOutFlag` (esvaziar) é só do Remake e fica fora.

## Divisão (feature grande demais para uma entrega; §6)

- **D-TRANSPORTE-01a (sim):** o campo, o comando, o roteamento e a herança.
- **D-TRANSPORTE-01b (ui):** o painel do armazém com as 28 mercadorias, a quantidade e
  o botão aceitar/bloquear.

## 01a — a regra (interpretação conservadora, PARA REVISÃO onde marcado)

- **Campo:** `naoAceita?: readonly string[]` em `PredioCompleto`, ordenado e sem
  repetição. Só o armazém tem o campo. Ausente quer dizer "aceita tudo", e a lista vazia
  some (o campo é apagado), para o estado continuar comparável byte a byte.
- **Comando:** `SetStorehouseAccept { predio, mercadoria, aceita: boolean }`. `aceita` é o
  valor, como em `SetBuildingRepair`: o mesmo valor devolve o mesmo estado. Recusado
  (`command-rejected`, com o estado intacto) quando:
  - o prédio não existe (`predio-inexistente`);
  - não é armazém completo (`nao-e-armazem`);
  - a mercadoria não está em `economia.mercadorias` (`mercadoria-desconhecida`).
  O comando não confere o lado, como os outros comandos de prédio.
- **Helper** `sim/armazem.ts`: `armazemAceita(predio, mercadoria)` e
  `motivoDaRecusaDeAceite(...)`, no molde de `sim/reparo.ts`: uma regra só, perguntada
  pelo gerador e pelo saneamento.
- **Roteamento, níveis 6 e 7** (`saida-cheia-para-armazem`, `excedente-para-armazem`):
  - `destinoMaisPerto` passa a escolher por mercadoria. As distâncias da origem aos
    armazéns ligados são medidas uma vez por prédio de origem, e cada mercadoria fica com
    o mais perto que a aceita. Quando nenhum aceita, não nasce tarefa e a carga fica na
    gaveta. A produção para quando a gaveta enche, como no KaM. É escolha do jogador, e
    não é espera de unidade.
  - `motivoDoDestino` devolve `'destino-completo'` à tarefa aberta ou reclamada cujo
    armazém passou a bloquear. O release é o do saneamento, e no mesmo tick o gerador a
    refaz para outro armazém, se houver.
  - **PARA REVISÃO:** a tarefa em `carregando` termina a entrega. O KaM abandona. Aqui ela
    segue, como na decisão do operador para a feira (F35): largar carga no meio do caminho
    é pior que entregar uma vez a mais.
- **Fora da regra (PARA REVISÃO):**
  - a devolução do serf (`passoDevolvendo`) ignora o bloqueio. Ela é o caminho de erro de
    uma tarefa, e bloquear ali criaria espera indefinida;
  - o reembolso da demolição e a carga de quem morre de fome também ignoram;
  - tirar mercadoria de um armazém que bloqueia continua valendo. Bloquear é "não
    receber", não é "esvaziar".
- **Herança:** o armazém que completa a obra herda o `naoAceita` do primeiro armazém
  completo do mesmo lado, em `predios.ordem` (o `Activate` do KaM). Isso acontece onde a
  obra completa (`systems/laborers.ts`). O cenário inicial não herda: todo armazém nasce
  aceitando tudo.
- **IA:** nunca emite o comando.

### Testes (`tests/D-TRANSPORTE-01a-armazem-aceita.test.ts`)

1. O comando liga e desliga, e a lista sai ordenada. Com o mesmo valor, o estado é o mesmo
   objeto. Tudo aceito apaga o campo.
2. As três recusas, com o estado intacto.
3. Dois armazéns ligados. O perto bloqueia `timber` e a serraria manda a tábua ao longe.
   Uma mercadoria que o perto aceita continua indo ao perto.
4. Os dois bloqueiam: não nasce tarefa para aquela mercadoria, e a gaveta segura a carga.
5. A tarefa aberta para o perto, bloqueado depois, sai no saneamento e renasce para o
   longe. A tarefa em `carregando` entrega no perto.
6. Herança: o armazém que completa a obra copia o `naoAceita` do primeiro.
7. Determinismo: a mesma lista de comandos dá o mesmo estado nas duas corridas.

Mutação: tirar o filtro de `destinoMaisPerto` derruba o teste 3; tirar o caso de
`motivoDoDestino` derruba o teste 5.

## 01b — o painel

- `painelDoPredio` (selector) ganha, só no armazém, `aceite: { mercadoria, quantidade,
  aceita }[]`, na ordem de `economia.mercadorias`. As 28 mercadorias aparecem sempre, e
  não só as que têm estoque.
- `ui/painel-predio.ts`: no armazém, a lista das 28 substitui a gaveta, com nome do tema,
  quantidade e um botão (`data-aceite`) que emite `SetStorehouseAccept` com o valor
  oposto. O botão usa o padrão `segurando` do BUG-B. A mercadoria bloqueada fica
  apagada.
- Textos no tema: `painel.armazem.aceita`, `painel.armazem.bloqueia`.

### Roteiro (`tools/shots/D-TRANSPORTE-01.js`)

1. Nova partida. Clicar no armazém e ver as 28 linhas.
2. Despausar e segurar o botão de `timber` por 150 ms (§8), depois pausar. O estado passa
   a ter `naoAceita` com `timber`, e a linha fica bloqueada.
3. Clicar de novo: volta a aceitar, e o campo some.
4. A captura com uma linha bloqueada é a evidência, aberta com Read.

Não-regressão pelo código de saída: F16c (pausar), F-CERCO-b (reparo) e F35 (feira), que
também usam o painel.
