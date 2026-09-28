# F-REPL-c — medir antes de implementar (sessão autônoma, item 19)

Pedido do operador: *"F-REPL-c: medir se faz falta antes de implementar."* O item está
ADIADO no BUILD_PLAN, a voltar "se alguém sentir falta" do plantio em tile vazio.

## A pergunta
Com o replantio **só no toco** (F-REPL-a/b), o lenhador sustenta a produção numa partida
longa, ou a mata se esgota como acontecia antes do replantio (BALANCE_LOG, LOTE3-c)? Se
ela se sustenta, o tile vazio não faz falta.

## A medida (sonda, apagada depois; código abaixo para reproduzir)
- `cenarioOraculo`: a vila real (`createInitialState(1)`), os dois lenhadores onde a
  abertura põe a mata, a serraria, a pedreira e os serfs do início.
- 72 000 ticks, ou 2 h de jogo. A fome é neutralizada pela sonda: ela reenche a condição
  a cada 1000 ticks, porque o cenário não tem Bodega e morreria aos 12 000.
- Os troncos de `w1` e `w2` e as tábuas de `s1` vêm de `goods-produced`, em janelas de
  6000 ticks (10 min).

| janela (10 min) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `cortar_e_plantar` (padrão), troncos | 19 | 20 | 19 | 18 | 21 | 18 | 22 | 18 | 21 | 17 | 22 | 17 |
| `cortar_e_plantar`, tábuas | 34 | 44 | 34 | 38 | 40 | 36 | 44 | 36 | 42 | 36 | 42 | 38 |
| `cortar` (controle), troncos | 20 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Leitura
- O padrão fica em 17–22 troncos por 10 min durante as 2 h, sem tendência de queda, na
  mesma faixa da mata virgem (20 na primeira janela do `cortar`). O replantio no toco não
  é o gargalo.
- Sem replantio, a mata da abertura acaba no minuto 20.
- **Conclusão: a F-REPL-c não faz falta** no mapa de hoje. Continua ADIADA, agora com
  medida.
- **O que reabriria o item:** um mapa ou abertura com mata menor que o raio do lenhador
  (poucos tocos ao alcance), ou o jogador querendo levar mata para perto da vila. Nenhum
  dos dois existe hoje.

## A sonda
```ts
// tests/_sonda/repl-c.test.ts (apagado)
let s = cenarioOraculo(gameData);
// modo null = padrao; 'cortar' = SetBuildingMode em w1 e w2 no tick 0
for (let t = 0; t < 72000; t += 1) {
  s = step(s, t === 0 ? cmds : [], gameData);
  if (t % 1000 === 0) /* reenche a condicao de toda unidade */;
  // soma goods-produced de w1/w2 (lenha) e s1 (tabua) na janela floor(t / 6000)
}
```
