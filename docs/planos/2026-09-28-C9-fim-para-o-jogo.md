# Plano — C9: o fim de partida parando o jogo (fila do operador, item 9)

Pedido: *"O fim de partida parando o jogo. Hoje continua depois do aviso."* A F34 gravou o
fim na sim (`state.partida`) e deixou, de propósito, a sim andando: *"quem para o jogo é a
tela"* (CLAUDE.md §5: a pausa é do laço externo, nunca da simulação).

## A nossa versão
- **Laço (`src/laco.ts`)** ganha `encerrar()`, `reabrir()` e `encerrado`:
  - encerrado, o laço fica pausado;
  - `retomar`, `alternarPausa` e o `avancar` do roteiro não fazem nada;
  - `reabrir` tira o encerramento e deixa o laço pausado. O jogador retoma com P, como
    depois de carregar.
- **A fiação** vai num helper puro, `acompanharFimDePartida(laco, estado)`, no mesmo arquivo
  e testável em Node:
  - estado com `partida` → `encerrar`;
  - estado sem `partida` com o laço encerrado → `reabrir`. É o caso de carregar outro save
    pela ajuda.
  - O `main.ts` chama o helper no `sessao.aoMudar`.
- **A sim não muda.** Ela continua pura e continuaria andando, mas ninguém mais a faz andar.

## Aceite
- (a) Headless: encerrado, `tique` não roda passo; `retomar`, `alternarPausa` e `avancar`
  não fazem nada. Reaberto, volta a rodar depois de retomar.
- (b) Headless: o helper encerra no estado com fim e reabre no estado sem fim.
- (c) Tela: o roteiro F34, depois do aviso de vitória, aperta P e espera. O tick do estado
  não anda, e o aviso segue na tela.
