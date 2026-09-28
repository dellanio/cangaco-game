# Plano — C3: os defeitos do quartel (fila do operador, item 3)

Pedido: *"F25b, o painel do Quartel [...] Inclua os quatro defeitos do F25a: teto de armas
puxadas, recruta perdido na demolição, e os nove botões passando da altura."* O painel já
está entregue (F25b). Entram os defeitos, mais duas ressalvas do avaliador sobre o mesmo
painel: o botão desabilitado parece igual ao habilitado, e a porta bloqueada não aparece.

## 1. Teto de armas puxadas
- **Hoje:** `alvoDeEntrada(quartel, requisito) = +∞`, e o quartel esvazia o armazém de
  armas.
- **KaM:** não tem teto. Cada arma tem um liga/desliga de aceitar (`NotAcceptFlag`,
  `houses/KM_HouseBarracks.pas:20,251-270`). O teto é pedido do operador.
- **Número:** nenhum novo. O quartel guarda até `producao.estoqueInternoPorPredio.entrada`
  (5) **de cada requisito**, a mesma gaveta de entrada de qualquer produtor. O que passar
  disso volta ao armazém pelo nível 7 (excedente), sem código novo. PARA REVISÃO: o
  liga/desliga por arma do KaM fica para depois.

## 2. Recruta perdido na demolição
- **Hoje:** `recrutas` é só um número no prédio. Demolir, ou perder em combate, apaga os
  recrutas.
- **KaM:** na demolição o quartel "esquece" os recrutas, e eles voltam a ser unidades no
  mapa (`KM_HouseBarracks.pas:143-149`).
- **A nossa versão:** `soltarRecrutas(state, quartel)` recria cada recruta como unidade
  `recruit` ociosa, do lado do quartel, na porta. Ela é chamada nos dois caminhos que tiram
  o quartel: `DemolishBuilding` (comando) e a queda no cerco (F-CERCO-a2).
  - Se não houver tile de porta andável, eles nascem no primeiro tile da porta, que fica
    livre com o prédio saindo.
  - Ociosos, eles voltam a pedir tarefa de alistamento pelo JobBoard.

## 3. Os nove botões passando da altura, e o desabilitado igual ao habilitado
- **Grade de duas colunas** para os botões de formar (e os de contratar da Prefeitura, que
  são iguais): o nome em cima e o motivo embaixo, em letra menor.
- **`button:disabled`** ganha aparência própria: opacidade reduzida, sem sombra e cursor
  `not-allowed`.
- **Aceite de tela:** a 1280×720, os nove botões **e** o Derrubar ficam inteiros dentro da
  área visível do corpo da aba, sem rolar. O desabilitado tem estilo computado diferente do
  habilitado (opacidade).

## 4. Porta bloqueada no painel
- O motivo do painel passa a sair de `motivoParaFormar` (novo, `systems/quartel.ts`), que é
  o `motivoDaRecusaDeSoldado` mais a porta. O `TrainSoldier` usa a MESMA função. Uma regra
  só, e o painel passa a dizer "porta bloqueada".

## Aceite
- (a) Com 12 machados no armazém, o quartel fica com 5, e os outros 7 ficam no armazém.
  Com 8 na entrada vindos de save antigo, volta a 5.
- (b) Demolir o quartel com 2 recrutas deixa 2 unidades `recruit` do lado dele na porta. Se
  cair em combate, o mesmo.
- (c) O painel mostra `porta-bloqueada` com a porta tapada, e o comando recusa com o mesmo
  motivo.
- (d) Tela: os nove botões e o Derrubar cabem sem rolar; o desabilitado tem opacidade
  diferente. Screenshot com roteiro despausado.
