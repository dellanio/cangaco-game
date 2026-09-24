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

## BUG-F — prédio e estrada aceitam ser postos em cima de recurso natural, e o recurso continua sendo colhido por baixo
- feature: F06-placement (prédio) e F-T2b-obstaculo (estrada) — mas **nenhum aceite escrito quebra**: `canPlace` é de antes de existir camada de recurso (F-T2a), e o aceite da estrada só fala do que fecha o passo. É **lacuna de aceite**, não critério violado; qual chave virar (se alguma) é decisão do operador.
- severidade: `errado`
- relato: operador, jogando, 2026-09-24.
- repro: sem arquivo — é o estado inicial, `createInitialState(1)`. Âncoras medidas abaixo.
- esperado: indefinido no GDD e no BUILD_PLAN. As duas leituras possíveis (recusar / permitir-e-consumir) estão em aberto e **a escolha é do operador** — por isso este bug está registrado, não corrigido.
- observado (medido, não inferido):
  1. **É alcançável no mapa de abertura, com tipo já desbloqueado.** Das posições que `canPlace` aceita: `schoolhouse` **14038** aceitas, das quais **37** cobrem rocha, **706** cobrem árvore e **214** cobrem milho; da `quarry`, **30** cobrem rocha (exemplo: âncora `22,28` cobre o tile de rocha `24,29`) — dá para pôr a pedreira em cima do lajedo que ela veio lavrar.
  2. **Estrada tem o mesmo buraco, com um recorte.** `canPlaceRoad` aceita os **13** tiles de rocha transponíveis e os **130** de milho; recusa árvore (motivo `recurso`, via `recursoBloqueiaPasso`) e peixe (motivo `terreno`, porque é água). Dos 311 tiles de rocha do mapa, só 13 são de terreno transponível — os outros 298 já caem em `terreno`, e é por isso que o buraco parecia menor do que é.
  3. **O que a construção faz com o recurso: nada.** Das três hipóteses do relato, é a terceira. O recurso **continua lá e continua sendo colhido por baixo do prédio e por baixo da estrada**. Medido com a pedreira sobre o lajedo: os 4 tiles de rocha sob o próprio footprint dela entram na lista de colheita dela, e em 900 ticks a saída é **idêntica** nos três casos — sem nada por cima, com estrada por cima e com obra por cima: tile 15 → 10, 5 `stone` entregues. Nada é consumido e nada se perde.
  4. **Efeito colateral já visível:** o prédio deixa o tile **não-andável** enquanto ele segue na lista de colheita (medido: `andavel: false`, tile na lista `true`). Hoje é inofensivo porque o especialista não sai do prédio; **vira travamento na F-T3**, quando ele passar a andar até o tile.
- evidência: medições desta sessão, por sonda temporária (`tests/zz-probe-bug*.test.ts`, apagadas — sonda é evidência de sessão, não cobertura). Números transcritos acima.
- **decisão de desenho pendente** (é o que bloqueia a correção, não o código):
  - **recusar**: motivo próprio em `canPlace` (na ordem, junto de `terreno`, que é a outra recusa sobre o chão) e o mesmo motivo em `canPlaceRoad`, que já tem `'recurso'` de pé — seria alargar o predicado, não conceito novo.
  - **permitir e consumir**: exige retorno antes do clique (a prévia da F-TP é o lugar) e resolve o item 4 apagando o recurso.
  - **o que as duas precisam decidir junto**: a regra não pode ser "todo recurso". Milho é tile que o jogador plantou, e o campo em pousio continua sendo recurso com `quantidade: 0` — recusar construção sobre pousio seria proibir construir onde já se plantou uma vez. O recorte tem de vir de `resources.json` por tipo (uma bandeira ao lado de `bloqueiaPasso`), não de lista escrita em `.ts`.
- status: aberto — **investigado e medido, não corrigido** (o relato pediu nesta ordem)

---

## Polimento

_Nenhum._

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.
