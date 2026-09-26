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

## BUG-G — especialista preso dentro de um footprint plantado em cima dele
- feature: F-T3 (o especialista sai do prédio); achado na F-CAL-b2
- severidade: trava
- repro: a vila da F-CAL-a (`tests/helpers/cal-vila.ts`) com o campo do Roçado
  trocado por `40,28 41,28 42,28 42,29` (atrás da fazenda, a 2 tiles). O roceiro
  colhe de (41,30), e o Moinho é plantado com o canto em (41,30) no tick ~3386.
- esperado: a unidade que fica debaixo de um footprint novo sai dele e segue
  (o A* já libera a partida para isso), ou a tarefa é liberada.
- observado: o roceiro fica em `voltando` em (41,30) do tick 3385 até morrer de fome
  (7989), `fsmData` idêntico em todo tick (`caminho` começando em 41,31, `progresso`
  1). A vila inteira morre (26 civis), com 3 milhos produzidos.
- causa (lida no código, não corrigida): `executar` do A* (`src/sim/pathfinding.ts`,
  `liberados`) libera a CAIXA INTEIRA do prédio em que a partida está, então o
  caminho novo atravessa o Moinho até a porta (41,31 → 41,32 → 41,33). O
  `passoVoltando` (`src/sim/systems/especialistas.ts`) pergunta
  `tileAndavel(proximo, 'livre')`, que diz "bloqueado" para 41,31, recalcula,
  recebe o mesmo caminho e anda 1 de progresso — todo tick, para sempre. O A* e o
  passo discordam sobre o mesmo tile.
- correção proposta (a confirmar): o teste do próximo tile nos passos de
  movimento aceita tile da caixa em que a unidade está (a mesma regra de
  `liberados`), ou o A* libera só a partida e não a caixa. Os passos de serf e de
  laborer têm o mesmo padrão (`tileAndavel` antes de `andar`) e precisam do mesmo
  conserto; o `tileAndavel` sozinho não sabe de onde a unidade parte.
- evidência: `test-output/F-CAL-b2-sonda.json` (`atras-d2`, `atras-d3`: 3 milhos, 26 mortes)
- status: aberto

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
  referência aprovada, pelo `docs/BRIEF-ARTE.md`. Ao entrar, dois testes do
  `tests/F17f-manifesto.test.ts` reprovam por construção ("o armazem tem arte em tres
  dos seis estagios" e "estagio sem arte resolve null, mesmo num predio que tem
  arte"): eles afirmam os nomes e os estágios que faltam ao armazém ATUAL. O que
  fazer com eles é decisão do operador (`docs/planos/F17f-lista-derivada.md`).
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
