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

## BUG-T — tropa travada: vaga bloqueada no MEIO do caminho (terceiro caso da família)
- feature: C-MOVIMENTO-02b (a vaga tomada por quem marcha) — limite conhecido dela
- severidade: **`trava`** (operador, 2026-09-30). Soldado parado em `marchando` por 16 048
  ticks é travamento de regra, não balanceamento. O aceite escrito da C-MOVIMENTO-02 e da 02b
  continua passando: a chave de nenhuma das duas cai.
- **plano com aceite:** `docs/planos/2026-09-30-BUG-T-tropa-travada.md` (só plano; o código
  espera o operador). Conferido no código: a troca mútua escapa da `vagaTomadaPor` porque ela
  exige um PARADO no seguinte de quem ocupa. É o quarto caso da família.
- repro (medido; sonda apagada, receita determinística):
  - `criarEscaramuca(gameData.economia.estadoInicial.semente)` e a tropa do jogador inteira.
  - 400 ordens `MoveUnits` sorteadas por LCG `x = (x·1103515245 + 12345) mod 2³¹`, começando
    em `x = 12345`, com `rnd(n) = x mod n`:
    - destino `(líder0.gx + rnd(17) − 8, líder0.gy + rnd(17) − 8)`, com a posição inicial do
      primeiro soldado;
    - `direcao rnd(8)`, `colunas 3 + rnd(7)`.
  - Cada ordem roda até todos ociosos, ou no máximo 1 500 ticks. Presos: 2 das 400.
  - **Ordem 11** (tick 1 951, destino 36,43, direção 0, 4 colunas): três soldados parados
    até o tick +16 048.
    - u24 em 34,45, caminho `[35,45 → 36,45]`: o tile do MEIO é de u26, **ocioso**. É o caso
      3 abaixo, confirmado.
    - u28 em 37,47 quer 36,46 e u33 em 36,46 quer 37,47: **troca mútua**, os dois marchando
      com `progresso` 0 e caminho de um passo.
  - **Ordem 19** (tick 4 799, destino 35,36, direção 0, 5 colunas): u27 em 36,37 e u28 em 36,36
    trocam de tile, também em troca mútua. Presos até +1 737 e +1 791.
  - Reaplicada a ordem sobre o save de antes dela, depois de 20 000 ticks todos estão ociosos.
    Hipótese, não medida: o que solta os três em +16 048 é causa externa (combate ou IA da
    escaramuça).
- esperado: toda a tropa mandada para uma formação para, cada soldado numa vaga, em tempo
  finito.
- observado: medido acima. A troca mútua foi conferida no código (plano, seção 2).
- **a família, para saber onde olhar sem reler os relatórios:**
  1. C-MOVIMENTO-02 (a tropa não trava): a vaga é o próximo tile e está ocupada por um
     PARADO do mesmo lado, sem contorno. Troca: `vagaEmparedadaPor`, em
     `src/sim/units/movimento.ts`.
  2. C-MOVIMENTO-02b: a vaga é o próximo tile e está ocupada por alguém que MARCHA para
     outra vaga, com `progresso` 0 e um parado à frente dele. Troca: `vagaTomadaPor`, em
     `src/sim/systems/marcha.ts`, chamada em `passoMarchando`.
  3. Este bug: o bloqueio não está no próximo passo com a vaga. As duas trocas exigem
     `caminho[0]` igual à vaga (ou o destino), então nenhuma dispara. Resta
     `esperarOuDesviar` (`units/movimento.ts`), que espera `ticksDesvioMilitar`, tenta o
     contorno e, sem contorno, "tenta de novo depois de outro período", para sempre.
- onde olhar primeiro: o soldado preso com `fsm: 'marchando'` e `fsmData.bloqueado`
  voltando a zero em ciclos. O `caminho[0]` dele e quem está naquele tile (parado ou
  marchando, de que lado, para onde) dizem qual dos três casos é.
- status: aberto

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

