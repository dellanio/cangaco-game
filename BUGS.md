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

## BUG-001 — F09-sistema:429 estoura o timeout de 5 s com cache frio
- feature: F09-jobboard
- severidade: feio
- repro: `npm run verify` com a suíte inteira e cache do Vitest frio (primeira
  corrida depois de `git checkout`, ou máquina sob carga). Não reproduz isolado.
- esperado: o teste de carga fecha dentro do orçamento de 5 s do Vitest.
- observado: dois estouros em 2026-09-23, `Test timed out in 5000ms`; todas as
  corridas seguintes passaram. Medido na mesma sessão: F09 sozinho **3,50 s** na
  árvore limpa e 3,61 s com as mudanças da F17b; suíte inteira **20,1 s morna**
  contra **29–30 s fria**. Margem de ~30% entre o medido quente e o orçamento,
  num teste de CARGA — é isso que a contenção de cache frio come.
- evidência: PROGRESS.md, seção "F17b — Material entregue visível na obra
  (2026-09-23)", sob "Hipótese, não fato". Não há repro determinístico: a causa
  é de agendamento, fora da simulação (F09 não é flaky por estado — é o mesmo
  estado toda corrida).
- **se reaparecer, a correção é orçamento maior NESTE teste** (`timeout` do caso,
  explícito e comentado com o número medido). **Não** é `skip`, não é reduzir a
  carga do cenário e não é afrouxar o orçamento global: a carga é justamente o
  que o teste existe para exercer, e diminuí-la trocaria o sintoma pela
  cobertura (CLAUDE.md §10).
- status: aberto
