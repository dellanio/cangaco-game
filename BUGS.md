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

_(nenhum ainda)_

---

## Polimento

## BUG-001 — tarefa de construir sobrevive UM tick a conclusao da obra
- feature: F11b/F11c (observado na F15a)
- severidade: feio
- repro: `tests/F15a-aceite.test.ts`, cenario do aceite, semente 1, tick 240 —
  o tick em que a obra da quarry vira predio completo
- esperado: no instante em que a obra vira `completo`, nenhuma tarefa de
  `construir` deveria continuar apontando para ela
- observado: no TICK da conclusao sobram 3 tarefas de `construir` com destino no
  predio ja completo (uma `reclamada`, duas `aberta`). `sanearTarefas` as
  cancela no tick SEGUINTE, entao a inconsistencia dura exatamente um tick e se
  cura sozinha; nenhum laborer chega a agir sobre elas
- evidência: `test-output/F15a.json`, campo `violacoes.noTickDaObraConcluida`
- por que nao é `errado`: nao quebra criterio de aceite escrito nenhum. So e
  visivel pelo helper `violacoesDeInvariantes`, e nenhuma suite anterior cruzava
  a transicao obra -> completo com o quadro carregado (a F14 montava o predio ja
  completo por fixture)
- status: aberto
