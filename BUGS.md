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

## BUG-Q — só 2 soldados golpeiam o prédio; o resto fica em `indo_atacar` para sempre
- feature: C5 (colisão militar), regride F-CERCO-a2 (ataque a prédio); alcança F26b, C-IA-03c e F28-IA ponto 6
- severidade: errado
- repro: sonda do avaliador (`docs/avaliacoes/2026-09-29-segunda-leva.md`, achado 1): 4 soldados com `AttackBuilding` num armazém inimigo — 2 atacando e 2 parados após 300 ticks; com 12, 2 atacando e 10 parados. Bisect: 84aeb6c (C5).
- esperado: todo soldado do grupo chega a um tile do anel e golpeia (antes da C5: 4 atacando, prédio a 22 hp em 600 ticks).
- observado: `units/movimento.ts:136` zera o caminho quando o destino tem militar parado; `systems/cerco.ts:169` replaneja pelo A* (que ignora unidades) e devolve o mesmo tile ocupado. O log do roteiro C-IA-03c mostra `{"indo_atacar":10,"atacando":2}` por mais de 2000 ticks.
- status: aberto

## BUG-R — a pedra da estrada sai do armazém de OUTRO lado, e a tarefa fica aberta para sempre
- feature: C7 (lado no JobBoard)
- severidade: errado
- repro: sonda do avaliador (achado 2): na escaramuça, estrada planejada perto do armazém da IA; `pedra-para-canteiro` nasce com origem no armazém do lado 1 e segue `aberta` após 1500 ticks.
- esperado: a origem é um armazém do lado do jogador (o plano da C7 diz que tarefa sem quem possa reclamar fica aberta para sempre).
- observado: `systems/jobs.ts:708` `armazemMaisPertoDoTile` chama `armazensCompletos(state)` sem o lado.
- status: aberto

## BUG-S — `HireMercenary` passa em peacetime
- feature: C-IA-03b (peacetime e tropas)
- severidade: errado
- repro: sonda do avaliador (achado 3): prefeitura completa com 8 de ouro, em paz — sai `unit-trained`.
- esperado: a lista do KaM citada no código (`KM_GameInputProcess.pas:153-155`) inclui `gicHouseTownHallEquip`, e o PROGRESS registrou "equipar no quartel e na prefeitura".
- observado: `sim/paz.ts:46-58` recusa só `MoveUnits`, `AttackUnit`, `AttackBuilding` e `TrainSoldier`; o comentário diz que o resto "a sim ainda não tem", o que é falso desde a F36.
- status: aberto

---

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.

## BUG-N — cana em pousio parece mato cortado
- feature: F-CANA-b (a mancha de cana da vila); o desenho é de `src/render/mapa.ts`
- severidade: feio
- repro: `npm run shot -- F-CANA-b`, captura `screenshots/F-CANA-b-1-abertura-com-a-cana.png`
- esperado: a mancha de cana nova se lê como roça esperando plantio, como o roçado do milho.
- observado: a cana nasce em pousio (`quantidadeInicial: 0`) e o render a pinta com o
  código único de ESGOTADO (`render/mapa.ts`, `codigoEsgotado`: "havia recurso") — o
  mesmo losango escuro da árvore cortada, sobre grama.
- causa: falta o chão arado que o milho tem. O milho em pousio fica sobre o terreno
  `campoArado` (marrom), derivado do mapa; a cana não tem terreno (`grapes` sem `terreno`
  em `resources.json`) e fica sobre `grama`, e aí o esgotado não tem contexto.
- **conferido 2026-09-28, continua valendo:** `render/mapa.ts` `codigoDoRecurso` ainda
  devolve `codigoEsgotado` para quantidade ≤ 0, e `grapes` segue sem `terreno`.
- correção: é do render, com a sessão do render (instrução do operador, 2026-09-26).
  Dois caminhos, a decidir lá: um código de "em pousio" separado do "esgotado" para
  cultura (tipo com `aradura` em `resources.json`), ou o chão de roça desenhado sob
  tile de cultura.

