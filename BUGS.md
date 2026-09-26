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

_Nenhum._

---

## Polimento

## BUG-H — o sprite do armazém é isométrico e não preenche o footprint 3×3
- feature: F17f (o primeiro sprite real)
- severidade: feio
- repro: `npm run shot -- F17`, captura `screenshots/F17-5-final.png`; a base é
  `assets/base/storehouse/armazem_0{1,2,3}_*.png`
- esperado: top-down 3/4 sobre grid ortogonal (CLAUDE.md §4, GDD §9.3) — a base do
  prédio é um retângulo de arestas horizontais, como em `assets/base/woodcutters/`,
  e o prédio completo ocupa o footprint.
- observado: o chão do sprite é um losango ~2:1 (isométrico). Derivado a 192 px de
  largura, o completo cobre ~39 % do quadrado de chão; o resto do 3×3 fica vazio. A
  medida e a causa estão na nota de `origem` do armazém em `assets/manifest.json`:
  nenhuma escala concilia losango com footprint quadrado.
- correção: arte, não código. Refazer os seis estágios do armazém no ângulo da
  referência aprovada, pelo `docs/BRIEF-ARTE.md`. Nenhum teste reprova por isso
  desde `828a3d4`: trocar o armazém por seis estágios passou no `npm run verify`
  (teste de fumaça, 2026-09-26).
- nome: o operador chamava este defeito de "BUG-F"; esse id já é de outro bug,
  corrigido em 2026-09-24 (obra e estrada recusam recurso que bloqueia). Este é o H.
- evidência: a nota de medida em `assets/manifest.json` (entrada `storehouse`); e a
  captura `F17-5-final.png` aberta em 2026-09-26 num worktree descartável em
  `4a1b65d`, já apagado — rode o repro para ter a sua.
- status: aberto

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.
