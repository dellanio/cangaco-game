# C-TELA-01 — a mensagem da ordem recusada (tela)

Pedido do operador (2026-09-29): "a mensagem muda junto: 'Longe demais na paz' é diferente de
'Em paz — faltam mm:ss'." A regra da sim é a C-COMBATE-02 (a cerca da paz), já entregue; este
item só DIZ ao jogador por que a ordem não andou. Não toca em `src/sim/`.

## O que existe

- A sim já emite `command-rejected` com `motivo: 'em-paz'` (ataque em paz) ou
  `'longe-na-paz'` (marcha fora da cerca), no tick em que o comando é drenado.
- A `Sessao` avisa o ouvinte a cada `passo()`, então cada tick passa por `atualizar(s)` no
  `main.ts` e nenhum evento se perde, qualquer que seja a velocidade.
- Nenhuma tela consome esses dois motivos hoje: o botão direito em paz não dá retorno
  nenhum (GDD §10 exige retorno imediato).

## O desenho

- `src/ui/aviso-de-ordem.ts`:
  - `textoDaRecusa(eventos, segundosDePaz, rotulos)`, pura. Devolve o texto da ÚLTIMA recusa
    de ordem militar (`MoveUnits`, `AttackUnit`, `AttackBuilding`) do tick, ou `null`:
    - `em-paz` → `"Em paz — faltam {tempo}"`, com `mm:ss` de `segundosDePazRestantes`;
    - `longe-na-paz` → `"Longe demais na paz"`.
    Os outros motivos (destino inandável, sem unidades) ficam de fora: não é o pedido, e a
    tela nunca emite marcha sem unidade (PARA REVISÃO).
  - `montarAvisoDeOrdem()`: um `<aside id="aviso-de-ordem">` no `index.html`, sobre a
    célula do canvas (a mesma célula do `#ajuda`), no alto e ao centro, sem receber clique.
    Aparece com o texto e some depois de `segundosNaTela` de relógio de parede (UI, não sim).
    Uma recusa nova reinicia a conta.
- O `mm:ss` sai de uma função só, `mmss`, exportada de `contador-de-paz.ts`, que já o
  formatava.
- Os rótulos e o `segundosNaTela` vivem em `data/theme-sertao.json`, bloco `ordem`.

## Consequência conhecida

Com o jogo pausado, o comando só é drenado ao retomar (F11a), então a mensagem aparece ao
retomar. É o mesmo atraso de toda ordem pausada.

## Testes

- `tests/C-TELA-01-mensagem-da-ordem-recusada.test.ts` (headless):
  1. `longe-na-paz` real (step da escaramuça com destino longe) → "Longe demais na paz";
  2. `em-paz` real (`AttackBuilding` no armazém da IA) → "Em paz — faltam 10:00" no tick 1;
  3. recusa de outro comando (`FeedUnits sem-fome`) → `null`; lista sem recusa → `null`;
  4. dois motivos no mesmo tick → o último vence.
- Roteiro `tools/shots/C-TELA-01.js`: seleciona a tropa na escaramuça, botão direito longe
  (despausado, `mouse.down` / 150 ms / `mouse.up`, §8) → a mensagem "Longe demais na paz"
  na tela; botão direito no armazém da IA → "Em paz — faltam". Captura as duas.
- O `tools/shots/C-IA-03c.js` clicava 4 tiles acima da tropa e afirmava que ninguém andava.
  Com a cerca (C-COMBATE-02), esse tile fica dentro e a tropa anda. O passo passa a clicar
  fora da cerca e a afirmar também a mensagem.
