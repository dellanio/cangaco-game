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

## BUG-A — preso na ferramenta de construcao: nao ha saida obvia
- feature: F06-menu-build-planta
- severidade: trava
- repro: jogando (relato do operador, 2026-09-24). Abrir o jogo, clicar
  qualquer item do menu Construir.
- esperado: o jogador consegue largar a ferramenta com o gesto que ele tenta
  primeiro — clicar de novo no item ja selecionado — e com o gesto de RTS —
  botao direito. E consegue ver qual item esta ativo.
- observado: so `Esc` cancela, e nada na tela diz isso. Clicar no botao ja
  ativo nao desmarca (`menu-build.ts` chama `ferramenta.selecionar(id)` sempre,
  e `selecionar` so limpa quando recebe `null`). Botao direito nao faz nada:
  `WorldScene` so trata `leftButtonDown`/`leftButtonReleased` e o botao do meio.
  O destaque do item ativo e so `aria-pressed`, e o operador nao percebeu qual
  estava selecionado.
- evidencia: relato de sessao de jogo; `src/ui/menu-build.ts`,
  `src/input/ferramenta.ts:53`, `src/render/scenes/WorldScene.ts`
- status: aberto
- nota: o botao direito e **ordem de movimento militar** no GDD §2.1 (F26). A
  precedencia — com ferramenta ativa cancela, sem ferramenta fica livre para a
  ordem militar — tem de ficar escrita no GDD, ou a F26 descobre isso sozinha.

## BUG-B — o x da fila da Casa do Coronel nao remove o pedido
- feature: F13b-schoolhouse-painel
- severidade: errado
- repro: jogando (relato do operador, 2026-09-24). Abrir o painel da
  schoolhouse, enfileirar, clicar no x de um item.
- esperado: o escopo escrito da F13b diz "cancelamento de item, emitindo
  `EnqueueTraining`/`CancelTraining`". O clique no x tira o item da fila, ou o
  painel diz por que nao da.
- observado: clicar no x nao remove nada.
- evidencia: `screenshots/F13b-*.png` mostra o x por item; relato de sessao.
- status: aberto — **a diagnosticar antes de corrigir** (decisao do operador):
  (a) o clique nao chega ao botao; (b) chega e nao emite comando; (c) emite e a
  sim recusa, e ai o conserto e o painel dizer o motivo, nao permitir o
  cancelamento.


---

## Polimento

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

**Aplicada na F17c em 2026-09-24, e o BUG-003 saiu daqui com ela.** A oscilação
voltou e desta vez a mensagem foi capturada: quem caiu foi o **teto da razão**
(3,0599 contra `RAZAO_MAXIMA = 3.0`), não o timeout — exatamente a hipótese que o
BUG-003 dava como improvável. Teto alargado para 5,0 com os quatro números
medidos escritos no comentário de `tests/F17c-buffer.test.ts`. Resta o F09 sob a
mesma regra.
