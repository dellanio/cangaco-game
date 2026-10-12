# Bugs abertos

## BUG-PEDREIRO-DENTRO-DO-LAJEDO — extração sobre o recurso
- feature: I-MOVIMENTO-PEDREIRO-FORA-DO-LAJEDO
- severidade: errado
- repro: relato do operador em 2026-10-12; `rock.bloqueiaPasso=false` permite ao A* escolher o próprio tile de extração.
- esperado: Pedreiro extrai ao lado do lajedo, sem caminhar por dentro da massa de pedra; ouro, ferro e carvão continuam atravessáveis.
- bloqueio: os contratos F-T3-caminho e F-T2b-obstaculo ainda exigem rocha atravessável. A correção não foi aplicada nesta entrega de arte; nenhum teste foi afrouxado.

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
