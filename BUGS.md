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
- **DIAGNOSTICADO em 2026-09-24 (turno H). Nao e nenhum dos dois ramos: a
  pedreira do roteiro nunca teve pedra.** O numero pedido: **zero ticks**. Ela
  nao esgota o veio, ela nasce sem veio.
  - A pedreira da F22 fica em `(38,31)`, 3x2, com `alcance_tiles: 6`
    (`data/production.json`), o que cobre `gx 32..46`.
  - O lajedo da vila vai de `gx 22` a `gx 26` (`data/maps/sertao-128.json`), 13
    tiles, 195 de pedra ao todo.
  - **Tiles de `rock` ao alcance dessa pedreira: 0.** A borda leste do lajedo
    esta a 6 tiles de distancia da borda oeste do alcance; para alcancar
    qualquer pedra a pedreira teria de ficar em `gx <= 20`.
  - Logo `semRecursoAoAlcance` e verdade no primeiro tick em que o predio fica
    `completo`, e `veio-esgotado` e a resposta CERTA: aquela pedreira nunca vai
    produzir nada. O balanceamento nao tem culpa, e o roteiro nao roda longe
    demais — a geometria do roteiro foi escrita quando o veio morava no PREDIO
    (`veio: 200`, F15a) e o lugar nao importava.
- **Conserto, ja escrito (nao aplicado ainda)**: mover a pedreira do roteiro da
  F22 para dentro do alcance do lajedo, e afirmar no proprio roteiro que ela tem
  pedra ao alcance — a geometria passou a ser pre-condicao do cenario, e
  pre-condicao nao se deixa implicita.
- status: aberto — **espera a F-D3**. A F-D3 troca a reserva em faixa por reserva
  por raio e regrava `data/maps/sertao-128.json`: mexe exatamente nesta
  geografia. Mover a pedreira agora seria move-la duas vezes.
- nota: e a segunda vez que a F-T2a aparece num roteiro de outra feature. A
  contagem de tiles ao alcance ja esta no `BALANCE_LOG.md` desde `f57a3c1`.


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
