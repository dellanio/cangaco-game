# Plano — F-CAL-b2: aplicar a decisão do operador (leva noturna, item 4)

A decisão do operador foi tomada e não tinha chegado ao arquivo. Ela diz:
- o critério (b) vale para o campo **do lado da porta**;
- `farm.sai.corn` continua **3.0**;
- a prévia de alcance que distingue o lado da porta vai para `IDEIAS.md`;
- (a) e (c) são reescritos, com a tabela das três geometrias ao lado.

## A tabela (BALANCE_LOG 2026-09-25, `test-output/F-CAL-b2-sonda.json`, com a sonda apagada)

| campo | ticks por milho | 1 Roçado alimenta | moinho esperando | milho máx. | mortes |
|---|---|---|---|---|---|
| colado à porta (sul) | 143 | 1,72 moinho | 0,1 % | 98, subindo | 0 |
| atrás, 1 tile | 299 | 0,82 moinho | 10,1 % | 5 | 0 |
| atrás, 4 tiles (alcance máx.) | 346 | 0,71 moinho | 22,5 % | 4 | 0 |

## A reescrita (a minha interpretação, a mais conservadora; fica marcada para revisão)

- **(a)** Com o campo do lado da porta, a fazenda **sustenta** o moinho: o intervalo médio
  de entrega até 24 000 é **≤ o ciclo do moinho** (`receitas.mill.ticksDoCiclo`, do dado).
  O ±10 % sai, porque a fazenda mais rápida que o moinho é recompensa por posicionar bem. Com
  o campo atrás, a fazenda não sustenta, e a tabela registra isso sem afirmar nada.
- **(b)** Continua como está, e a F-CAL-b1 já afirma na corrida com o campo do lado da porta.
- **(c)** "Milho nunca acima de 1" deixa de ser critério. Do lado da porta a sobra é
  recompensa. Longe da porta o moinho come tudo, com máximo de 4 a 5, mas isso é medida de
  sonda: não viro em asserção permanente uma geometria que a suíte não roda, e o BUG-G (trava)
  matou a vila a 2 e 3 tiles. O `c` na evidência fica `asserido: false`, com o porquê.

## Execução

1. Aplicar a decisão no BUILD_PLAN (F-CAL-b2), com a tabela.
2. Registrar a prévia de alcance no IDEIAS.md.
3. `tests/F-CAL-b-calibracao.test.ts`: um `it` novo para (a) sobre a mesma corrida, e a
   evidência de (a) e (c) com os critérios novos.
4. Rodar o verify, criar a chave `F-CAL-b2-faixa` e fazer o commit.
