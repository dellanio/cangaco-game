# C-MOVIMENTO-02 — a tropa ainda trava ao andar

Pedido do operador, depois da segunda partida (P3): "A TROPA CONTINUA TRAVANDO ao andar. O
conserto do C-MOVIMENTO-01 não resolveu. Meça de novo, com a mesma sonda: quantos saltos
para trás, e de onde vêm agora. Se for outra causa, ache."

Só `src/sim/`: a §10 não se aplica.

## Medida (sonda `zz-trava`, apagada)

A tropa de 18 da escaramuça, em seis ordens: sul a 20 tiles, leste a 25, até (60,60),
norte atravessando a vila, reordenar no tick 60, virar 180° no lugar.

Métricas por unidade e por tick:
- recuo desenhado: a unidade continua no mesmo tile, e o desenho pula mais de meio tile;
- recuo no meio: a direção desenhada inverte fora do centro do tile;
- salto longo: o desenho anda mais de 0,75 tile num tick;
- parados, maior espera e quantos não chegam.

## As duas causas achadas

1. **A vaga emparedada.** Na ordem para o sul, 2 dos 18 nunca chegavam: 2774 ticks parados
   e "tenta de novo" para sempre. A formação enche as vagas de fora antes das de dentro.
   Quando a de dentro fica cercada de soldados parados, não há contorno, e
   `esperarOuDesviar` espera sem fim.
2. **A ordem no meio do passo.** `aplicarMoveUnits` zerava o `progresso`. O desenho, que
   estava a até 0,86 tile a caminho do próximo tile, voltava ao centro do tile de origem.
   Numa reordenação da tropa são 11 saltos para trás.

## O conserto

1. **A troca de vaga.** Esta é a regra em `vagaEmparedadaPor` (`units/movimento.ts`) e em
   `passoMarchando` (`systems/marcha.ts`). A troca acontece quando:
   - a espera chegou a `ticksDesvioMilitar`;
   - o tile seguinte tem um soldado PARADO do mesmo lado;
   - o destino está vazio;
   - nem contando só os parados existe caminho.

   Na troca, o parado passa a marchar para a vaga do que esperava, e o que esperava fica com
   o tile do parado, virado para onde ele estava virado. O conjunto de vagas não muda.
   - O `desvio` ganhou `soParados`: é a pergunta "há parede?", sem contar quem está só de
     passagem.
   - `militarParadoEm` deixou de contar quem tem `alvoTile`. Essa unidade está entre duas
     rotas (acabou de receber a ordem, ou a troca), e contá-la como parada largava o vizinho
     a dois tiles da vaga.
2. **Terminar o passo.** Quando a ordem chega no meio de um passo, a unidade termina o passo
   em curso (`caminho: [indo]`, `replanejar: true`) e só no tick seguinte planeja a rota nova.

## Aceite

`tests/C-MOVIMENTO-02-trava.test.ts`:
1. Na ordem para o sul, os 18 param, cada um numa das 18 vagas distribuídas.
2. A reordenação no tick 60 pega unidades no meio do passo, e nenhuma dá salto desenhado.
3. A mesma corrida duas vezes dá o mesmo estado.

No código antigo, 1 e 2 reprovam (2 presos, 11 saltos).

Não-regressão, com código 0 em todos:
- `npm run verify`;
- os roteiros C-TELA-03, F26b, C-TELA-02, C-TELA-04, C-IA-03c, C-TELA-01 e F06.
