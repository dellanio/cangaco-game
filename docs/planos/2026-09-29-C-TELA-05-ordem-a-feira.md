# C-TELA-05 — ordem à Feira (ui)

Pedido do operador (2026-09-29): o painel da Feira emite `SetTrade`. **Aceite:** um roteiro.

## Como está

- A F35 (Feira: trocar mercadoria) entregou o comando `SetTrade { predio, da, para,
  quantidade }` e o painel que LÊ a ordem: A → B, feitas/quantidade e por que não troca.
  Nada na tela EMITE `SetTrade`: só os testes e o save da F35 põem ordem na feira. Na
  partida, a feira construída nunca troca.
- O painel se redesenha 10 vezes por segundo com `replaceChildren()`. O BUG-B ensinou que
  o aperto dentro do painel adia o redesenho. Um `<select>` nativo perderia a lista aberta
  a cada tick, então o controle é de botões.

## O desenho

- `src/ui/ordem-da-feira.ts` (novo, puro, sem DOM) guarda o RASCUNHO da ordem
  `{ da, para, quantidade }`:
  - `rascunhoInicial(feira, mercadorias)`: a ordem em vigor, se houver. Senão, as duas
    primeiras mercadorias e quantidade 1;
  - `girarMercadoria(r, campo, passo, mercadorias)`: anda na lista circular e pula a
    mercadoria do outro campo, porque A = B a sim recusa;
  - `mudarQuantidade(r, passo)`: nunca abaixo de 1. Zero é o Cancelar;
  - `comandoDaTroca(predio, r)` e `comandoDeCancelar(predio)`: os `SetTrade`.
- O painel (`painel-predio.ts`) guarda um rascunho por feira, no fecho de
  `montarPainelPredio`, que sobrevive ao redesenho. Na seção da feira ele desenha:
  - "Dar ◀ X ▶", "Receber ◀ Y ▶" e "Quanto − n +";
  - "Mandar a troca", que emite `comandoDaTroca`;
  - "Cancelar", só quando há ordem, que emite quantidade 0.
  - Os nós levam `data-feira-controle`, e os valores vão em `data-`.
- **A lista de mercadorias** vem de `gameData.economia.mercadorias`, injetada pelo
  `main.ts` em `montarPainelPredio`. O `ui/` continua sem importar `sim/data` (topo do
  `menu-build.ts`), e a lista não sai do tema, porque "nenhuma regra depende do tema".
- Os textos novos vão em `theme-sertao.json:painelPredio`.

Isto não toca `sim/`.

## Testes

- `tests/C-TELA-05-ordem-a-feira.test.ts`:
  - o giro pula a mercadoria do outro campo e dá a volta na lista;
  - a quantidade não desce de 1;
  - o rascunho inicial copia a ordem em vigor;
  - na vila da F35 com feira, sem madeira nem dinheiro no armazém, o comando do rascunho
    "pedra → dinheiro, 2" passa pelo `step` real sem recusa, e a feira faz as 2 trocas.
    Evidência em `test-output/C-TELA-05.json`;
  - o Cancelar tira a ordem.
- O roteiro `tools/shots/C-TELA-05.js` é o **aceite**. Ele carrega o save da F35 (ordem
  "madeira → dinheiro" sem madeira, parada). Depois, despausado e com o botão seguro 150 ms:
  1. abre o painel;
  2. gira "Dar" até Pedra e sobe a quantidade até 2;
  3. manda. O painel passa a mostrar a ordem pedra → dinheiro;
  4. rodando o jogo, `feitas` sobe;
  5. o Cancelar deixa "Sem ordem de troca".

## PARA REVISÃO

- A quantidade anda de 1 em 1. Para 20 trocas são 20 cliques. Se o jogo mostrar que isso
  cansa, a troca é um passo maior com shift.
- A lista oferece todas as mercadorias, e não só as que há no armazém: a ordem é
  permanente e espera a mercadoria chegar, como a F35 já diz no painel.
