# D-PRODUCAO-02 — o alcance do lenhador, e o replantio que não acontecia

Pedido do operador, depois da segunda partida (P2): "O LENHADOR tem alcance pequeno demais —
ele busca árvore longe e o alcance não acompanha. Dobre e meça o efeito na vazão. E responda:
ele está replantando? A F-REPL-b entregou os dois modos com 'cortar e plantar' como padrão,
e eu não vi árvore nova nascer."

Só `src/sim/` e `data/`: a §10 não se aplica.

## Medida (sondas apagadas)

`w1` do cenário do oráculo, `w2` pausado, 11 500 ticks (~19 min de jogo).

| Onde | Árvores ao alcance | Troncos | Replantios | Tocos no fim |
|---|---|---|---|---|
| abertura, alcance 6 | 9 | 20 | 0 | 5 |
| abertura, alcance 12 | 9 | 18 | 0 | — |
| mata densa (18,54), alcance 6 | 56 | 19 | 0 | — |
| mata densa, alcance 12 | 68 | 18 | 0 | — |

1. **A vazão não muda com o alcance.** O teto é o ciclo, ~1 tora por minuto. O alcance maior
   só estende a vida da mata onde ela é rala. No lugar da abertura, 12 não pega árvore
   nenhuma a mais do que 6.
2. **Ele não replanta, na prática.** O rodízio (`proximoTrabalhoDoRodizio`) continua
   cortando enquanto houver adulta à frente do cursor. Só volta ao toco depois de dar a
   volta inteira em toda adulta ao alcance: 0 replantios em 19 minutos. Dobrar o alcance
   aumenta essa volta.

## O conserto

1. `data/production.json`: `woodcutters.alcance_tiles` de 6 para 12, como o operador pediu.
2. **Replanta o toco que acabou de cortar.** O flag `replantaOQueCortou` vai no dado, em
   `recursos.tree.reposicao`. Quando o tile do cursor esgota e está plantável, o próximo
   trabalho é semear ali, antes de seguir o rodízio. Milho e uva não declaram o flag: a
   fazenda não muda.
   - É a interpretação conservadora do texto do jogo ("Planta no toco o que cortou").
   - Vai PARA REVISÃO no PROGRESS, porque custa ~15% dos troncos a curto prazo (20 → 17).

## Efeitos colaterais medidos

1. A abertura põe os lenhadores pela árvore ao alcance. Com 12, eles vão de x 34/37 para
   29/32, em cima de onde o F-T4d punha a cabana do pescador. O fixture passa a procurar a
   posição com a rua mais curta até a estrada e a assentar essa rua, com a busca limitada
   pela melhor rua até ali.
2. O F-REPL-a esperava a mata de 2 tiles ficar sem adulta. Com o replantio imediato, ela
   não fica: a asserção passa a afirmar isso.

## Aceite

`tests/D-PRODUCAO-02-lenhador.test.ts`, na mata inteira de `w1`:
1. O alcance lido pela receita é o de `production.json`: a leitura é estrutural.
2. Com o flag há replantio (> 0), e ao fim não sobra mais de um toco.
3. No mesmo dado com o flag desligado há 0 replantios e sobram tocos (> 1): o contraste é a
   regra antiga.
4. Só a árvore declara o flag.

Não-regressão:
- `npm run verify`;
- os roteiros que usam a abertura, conferindo o código de saída: F06, F17, F17b, F17d,
  F17g, F23b, F-D2, F-ESC, F-REPL-d e CORONEL.
