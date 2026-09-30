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
