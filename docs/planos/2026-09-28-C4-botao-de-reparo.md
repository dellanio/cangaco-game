# Plano — C4: o botão de reparo (fila do operador, item 4)

Pedido: *"O botão de reparo (F-CERCO-b). Pequeno, e o reparo existe sem interface."* O
comando `SetBuildingRepair { predio, ligado }` existe desde a F-CERCO-b, e nenhuma UI o
emite: o prédio nasce com o reparo desligado, e o jogador nunca repara nada pela tela.

## Seletor (sim, sem regra nova)
- `PainelDoPredio.reparo`: `null` em obra; no completo traz:
  - `ligado`;
  - `danificado` (`hp` < total);
  - `emCurso`, quantas tarefas `reparar` reclamadas há no prédio.

## UI
- **Linha "Reparo"** no bloco de identidade, com `data-reparo="ligado|desligado"`. Quando o
  reparo está ligado e o prédio danificado, o texto diz "consertando" e o número de
  obreiros a caminho ou trabalhando.
- **Botão** nas ações: "Ligar reparo" ou "Desligar reparo". Ele manda o **valor**, como o
  pausar (F16c): nunca é alternador, e um painel um tick atrasado não desfaz o clique.
  Todo prédio completo tem o botão; em obra, não aparece.
- Os textos ficam no tema (`painelPredio`).

## Aceite
- (a) Headless: o seletor dá `ligado: false` no prédio recém-completo, e `null` na obra.
  Com `SetBuildingRepair`, dá `ligado: true`; com o prédio danificado, `danificado: true`;
  com um laborer reclamando, `emCurso: 1`.
- (b) Tela: o roteiro `tools/shots/C4.js` carrega uma vila com a escola danificada e o
  reparo desligado. Com o jogo andando, abre o painel e clica "Ligar reparo"
  (mouse.down/up).
  - Afirma `data-reparo="ligado"` e, esperando, o `hp` da escola subindo no estado de
    debug.
  - Captura o painel com o reparo ligado.
