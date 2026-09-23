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

_(nenhum aberto)_

---

## Polimento

## BUG-003 — a medição de tempo da F17c falhou uma vez e não reproduz
- feature: F17c-buffer-do-astar
- severidade: feio
- repro: `npx vitest run` com a suíte inteira, em 2026-09-23. Não reproduz
  isolado nem nas duas corridas completas seguintes, que passaram.
- esperado: `tests/F17c-buffer.test.ts`, caso `mede 64x64, 128x128 e 256x256`,
  fecha dentro do orçamento e com razão abaixo do teto.
- observado: uma falha, uma vez. **A mensagem não foi capturada** — ficou só o
  nome do arquivo e do caso, então qual das duas asserções caiu não está
  estabelecido. As duas candidatas, e o que cada uma implica:
  - **timeout padrão de 5 s do Vitest** (o caso não declara orçamento próprio):
    é a hipótese mais provável, porque o caso roda 3 tamanhos × 500 buscas, e o
    256² aloca um mapa de 65 536 tiles;
  - **teto da razão** (`RAZAO_MAXIMA = 3.0`): improvável. O medido tem ~4x de
    folga e a razão é estável entre corridas — 0,37 na corrida do fechamento e
    0,82 na de hoje.
- evidência: `test-output/F17c.json` (hoje: 22,3 / 24,4 / 18,4 µs, razão 0,82,
  `alocacoesDeRascunho: 0`) contra os 10,1 / 4,8 / 3,7 µs e razão 0,37 gravados
  no fechamento, `839c5ad`. O **tempo absoluto oscilou 2x entre corridas** com a
  mesma árvore; a razão, não.
- status: aberto

### A regra dos dois testes de tempo (decisão do operador, 2026-09-23)

São dois casos da mesma classe — medição de tempo em máquina compartilhada:
`tests/F17c-buffer.test.ts` (este) e `tests/F09-sistema.test.ts:429`
(`cargaComMuitasObras`, que foi o BUG-001, corrigido e fora deste arquivo desde
`839c5ad`).

**Se qualquer um dos dois voltar a oscilar, a correção é orçamento mais largo com
o número medido escrito no comentário — nunca `skip`, nunca reduzir a carga.**
Reduzir a carga troca o sintoma pela cobertura: a carga é o que o teste existe
para exercer. É o §10 do CLAUDE.md, e é o que já foi aplicado no F09: orçamento
explícito de 20 s, com "mede 3,5 s isolado e ~3,6 s na suíte morna" no
comentário, dando ~5x de folga.

**A separação que importa:** a proteção permanente da F17c é a **contagem de
alocação** (`estatisticasDoRascunho().alocacoes`), que é determinística e roda em
todo `npm run verify`. A medição de tempo é **evidência da sessão** — ela mostra
que a regra valia naquela corrida, não que continua valendo. Quando um dos dois
oscilar, é a evidência que se ajusta; a proteção não se toca.
