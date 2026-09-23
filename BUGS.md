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

## BUG-002 — o armazém é permanentemente não construível, contra a árvore do GDD
- feature: F12-arvore-desbloqueio
- severidade: errado
- repro: abrir o jogo; o botão `Armazém` do menu Construir nasce `aria-disabled="true"`
  e nunca sai desse estado, em nenhuma ordem de construção.
- esperado: a árvore do GDD (`docs/GDD.md:262-282`) pendura `Storehouse (adicional)`
  na **Sawmill**, e a tabela (`docs/GDD.md:232`) escreve o desbloqueio como
  "inicial / Sawmill": o armazém da abertura vem de graça, e a Serraria libera
  armazéns adicionais.
- observado: `data/buildings.json` dá ao `storehouse` `"desbloqueadoPor": null`, e
  `data/economy.json` tem `menuBuildInicial: []` (vazio deliberadamente, ver Nota da
  F12). `estaDesbloqueado('storehouse')` (`src/sim/desbloqueio.ts`) exige uma das duas
  coisas — logo é **sempre false**. Nenhum segundo armazém pode existir.
- correção (pré-escrita, aplicar quando a fila chegar aqui): trocar em
  `data/buildings.json` o `"desbloqueadoPor": null` do `storehouse` por
  `"sawmill"`, e estender o teste da árvore da F12 com o caminho
  Casa do Lenhador → Serraria → **Armazém adicional**. O `null` de raiz continua
  correto só para prédio que nasce de pé e nunca se repete — e o armazém não é um.
- evidência: `tools/shots/F17f.js` não conseguiu plantar o tipo; o `page.click` no
  `[data-predio="storehouse"]` estourou 30 s com `element is not enabled`.
- consequência aberta: o aceite da F12 **como está escrito** (Casa do Lenhador →
  Serraria → Roçado) passa, então a chave dela **não foi virada** para `false`.
  O que falha é o "Storehouse (adicional)" da árvore, que o aceite da F12 nunca
  listou. Virar ou não a chave é decisão do operador.
- status: aberto


---

## Polimento

_(nenhum aberto)_
