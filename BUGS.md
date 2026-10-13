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
