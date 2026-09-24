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

## BUG-C — o roteiro da F22 falha: o aviso "O veio secou" aparece onde ele afirma so "sem-trabalhador"

- feature: F22-avisos (o defeito nasceu na F-T2a)
- severidade: errado
- repro: `npm run shot -- F22` (saida 1). Nao depende de semente: o cenario do
  roteiro e fixo.
- esperado: o roteiro afirma que o painel de avisos mostra UM aviso,
  `sem-trabalhador`, com contagem 1.
- observado: vem `[{sem-trabalhador, 1}, {veio-esgotado, "O veio secou", 1}]`.
- evidencia: `test-output/F22-shot.json`. **Medido nesta sessao (2026-09-24):
  falha identica com as mudancas do BUG-A/BUG-B guardadas no stash**, ou seja,
  nao e regressao destes consertos — veio da F-T2a (`f57a3c1`), que trocou o
  `veio: 200` do predio por rendimento por tile e passou a esgotar a jazida.
- status: aberto — **a diagnosticar antes de corrigir**. Ha dois desfechos
  opostos e nao da para escolher no olho:
  (a) o comportamento novo esta CERTO e quem envelheceu foi a afirmacao do
      roteiro, que foi escrita quando nenhuma pedreira secava; ou
  (b) a pedreira do cenario da F22 esgota rapido demais, e ai o numero errado
      esta em `data/resources.json` (`rock.rendimentoPorTile`) ou no alcance da
      colheita — caso de `BALANCE_LOG.md`, nao de roteiro.
  Registrado sem corrigir por causa disso.
- nota: e a segunda vez que a F-T2a aparece num roteiro de outra feature. A
  contagem de tiles ao alcance ja esta no `BALANCE_LOG.md` desde `f57a3c1`.


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
