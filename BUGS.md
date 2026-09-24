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

### BUG-D — terceiro teste de tempo da mesma classe: o teto da F-T1 oscilou

- feature: F-T1-terreno-base
- severidade: feio (nao bloqueia: `npm run verify` na corrida seguinte deu 0)
- observado: `tests/F-T1-terreno.test.ts > a busca curta com terreno nao custa
  mais que o teto contra o mapa liso` falhou com **2,8899 contra teto 2,5** numa
  corrida de `npm run verify`; **isolado, o mesmo teste passa** (14/14, 547 ms).
  Medido em 2026-09-24.
- e a **mesma classe** de `tests/F17c-buffer.test.ts` e `tests/F09-sistema.test.ts`
  (razao/tempo medidos em maquina compartilhada), entao vale a regra do operador
  escrita abaixo: **teto mais largo com o numero medido no comentario, nunca
  `skip`, nunca reduzir a carga**. Nao apliquei ainda porque a regra nomeia os
  dois testes de la, e este e um terceiro caso — o alargamento e uma linha e cabe
  em qualquer sessao que o veja falhar de novo.

### BUG-E — quarto teste de tempo da mesma classe: a razão da F-T2b oscilou

- feature: F-T2b-obstaculo
- severidade: feio (não bloqueia: `npm run verify` na corrida seguinte deu 0,
  74 arquivos / 1176 testes)
- observado: `tests/F-T2b-obstaculo.test.ts > busca curta: o corredor limpo custa
  o mesmo, com ou sem floresta` falhou com **4,7387 contra `RAZAO_TEMPO_MAXIMA`
  = 2,5** (linha 419) numa corrida de `npm run test` durante a F-TP. Medido em
  2026-09-24.
- **não é da F-TP, e isto foi verificado, não suposto**: com o trabalho da F-TP
  guardado (`git stash`) a suíte passou; com o trabalho aplicado e o arquivo
  rodando **sozinho**, passou também; a suíte inteira passou nas corridas
  seguintes. O que mudou foi a carga paralela — a F-TP acrescentou o 74º arquivo
  de teste, e a razão é de relógio de parede.
- é a **mesma classe** de `tests/F17c-buffer.test.ts`, `tests/F09-sistema.test.ts`
  e do BUG-D acima. A regra escrita abaixo nomeia dois testes; este é o **quarto**
  caso, e com quatro a pergunta deixa de ser sobre cada teste: **generalizar a
  regra para toda razão de relógio de parede é decisão do operador**, e é o que
  está em aberto aqui. Não alarguei o teto: o teste é de outra feature, e alargar
  no meio da F-TP seria mudança de escopo por conta própria.
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

**Aplicada na F17c em 2026-09-24, e o BUG-003 saiu daqui com ela.** A oscilação
voltou e desta vez a mensagem foi capturada: quem caiu foi o **teto da razão**
(3,0599 contra `RAZAO_MAXIMA = 3.0`), não o timeout — exatamente a hipótese que o
BUG-003 dava como improvável. Teto alargado para 5,0 com os quatro números
medidos escritos no comentário de `tests/F17c-buffer.test.ts`. Resta o F09 sob a
mesma regra.
