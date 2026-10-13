# Bugs abertos

Só o que está aberto. Bug corrigido **sai deste arquivo no mesmo commit que o
corrige** — o histórico do git é o arquivo morto. Isso mantém o arquivo curto e
barato de carregar em toda sessão.

Registre com `/bug` ou edite à mão. Se não souber a feature, escreva `?`.

**Severidades e o que cada uma provoca:**
- `trava` — interrompe a fila do BUILD_PLAN; é a próxima coisa a ser feita.
- `errado` — vira a chave da feature para `false` em `test-results.json`.
- `feio` — vai para `## Polimento` e não bloqueia nada.

---

## Modelo

```markdown
## BUG-000 — resumo em uma linha
- feature: F##-nome
- severidade: trava | errado | feio
- repro: repro/AAAA-MM-DD-x.json (semente, tick)
- esperado: o que a regra diz que deveria acontecer
- observado: o que aconteceu
- evidência: screenshots/bug-000.png
- status: aberto
```

---

## Abertos

## BUG-ONDA-PARA-DEPOIS-DA-LUTA — a onda da fase para de atacar a vila depois da primeira luta
- feature: I-COMBATE-FASE-ONDAS-E-OBJETIVOS ("as ondas nascem no tick delas e atacam a vila"), achado
  pela I-COMBATE-CAMPANHA-JOGADA
- severidade: errado
- repro: `node tools/jogar-campanha.js fase-04-boqueirao`, jogador `reforco`, 18 000 ticks
- esperado: a onda que perde o alvo (a tropa que a interceptou morreu, ou o prédio caiu) segue para o
  próximo prédio do jogador, como a IA da escaramuça (`atacarComASobra`)
- observado (medido em 2026-10-13): no fim, 21 inimigos das ondas `ocioso`, parados, com a vila de pé.
  O alvo é dado uma vez, no nascimento; a fase fica "em curso" para sempre
- status: aberto

## BUG-CAPTURADO-MORRE-NA-LUTA-AUTOMATICA — o Vicente da fase 7 morre antes de poder ser capturado
- feature: I-COMBATE-FASE-ONDAS-E-OBJETIVOS (o `capturar`, regra aprovada pelo operador em 2026-10-12:
  uma tropa a 1 tile dele por 10 s, sem escolta a até 3), achado pela I-COMBATE-CAMPANHA-JOGADA
- severidade: errado
- repro: `node tools/jogar-campanha.js fase-07-itabaiana`, jogador `reforco`
- esperado: dá para ficar a 1 tile dele por 10 s
- observado (medido em 2026-10-13): o militar do jogador que encosta nele luta sozinho (`inimigoEncostado`)
  e o mata no tick 743, sem ordem nenhuma. Encostar é lutar, e a regra aprovada não tem como acontecer;
  a fase só acaba quando todos morrem de fome aos 30 min
- status: aberto

## BUG-CARGA-INFINITA-SEM-VEZ — sob carga infinita, a tábua da oficina nunca ganha a pedra da escola
- feature: D-TRANSPORTE-03 (o lance do KaM e a classe comum), achado pela I-OBRA-UM-TILE-ENTRE-PREDIOS
- severidade: errado
- repro: `tests/D-TRANSPORTE-03-logistica-kam.test.ts`, corrida B (`carga: true`): 40 pedras repostas a
  cada 200 ticks na saída da escola
- esperado: as armas chegam ao quartel, mais devagar, mas chegam
- observado (medido em 2026-10-05): 0 arma produzida em 12 000 ticks. O carpinteiro fica em
  `esperando_insumo`, porque a tábua do armazém para a oficina perde sempre para a pedra da escola na
  mesma classe (5): as duas pagam a multa do armazém, e a pedra está mais perto. Antes do vão entre
  lotes, com a oficina 1 tile mais perto, chegavam 9. A carga é infinita (mais pedra do que 4 serfs
  carregam), e por isso um insumo pode esperar para sempre.
- correção prevista: decisão do operador. Uma vez por espera (o envelhecimento da tarefa aberta) ou um
  teto de vez para a saída cheia; o KaM não tem envelhecimento.
- status: aberto; a corrida B passou a gravar a contagem em vez de afirmar entrega

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.
