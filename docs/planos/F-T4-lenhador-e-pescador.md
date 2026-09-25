# F-T4 — O lenhador e o pescador saem para colher (plano de implementação)

> Plano pedido pelo operador antes da execução (ordem de 2026-09-25: *"Os quatro
> acenos já foram dados e o plano está escrito. Executar."*). O plano **não**
> estava no repositório — `docs/planos/` não tinha arquivo de F-T4 e o item do
> `BUILD_PLAN.md` ainda descrevia o escopo antigo (roceiro + lenhador). Este
> arquivo é o plano escrito, com os quatro acenos dele transcritos e com **duas
> medições feitas antes de escrever código**, uma delas reordenando a entrega.

**Objetivo:** o Woodcutter's e o Fisherman's deixam de produzir do nada. Cada um
ganha `colheita` em `data/production.json`, e com isso o lenhador e o pescador
herdam, **sem código novo**, a caminhada de classe da F-T3.

**Arquitetura:** nenhuma linha nova de simulação. A regra é de classe desde a
F-T3 (`src/sim/systems/especialistas.ts`: prédio com `colheita` manda o ocupante
ao tile), o tile é reserva de JobBoard desde a F-T2c, o regime de esgotamento é
do dado desde a F-T2a (`colherDoTile` + `regimeDoTipo`) e a aproximação por
vizinho andável é da F-T3 (`src/sim/aproximacao.ts`). A feature é **dado mais
aceite**.

**Spec:** `BUILD_PLAN.md`, item F-T4, mais os quatro acenos do operador.

## Os quatro acenos (transcritos da ordem de 2026-09-25)

1. **Aceite da árvore:** tile cortado fica com `quantidade: 0` e **vira andável**;
   nunca some do estado.
2. **Aceite do peixe:** o cardume **some** ao zerar, e o **regime é `nunca`** —
   lago não repõe.
3. **Alcance 6 para os dois**, com a calibração registrada no `BALANCE_LOG.md`.
4. **Medir a FORMA da distribuição** dos 350 tiles de árvore e dos 274 de peixe,
   não só a média — é o que o BUG-C ensinou com a rocha aglomerada em 11 lajedos.

Os acenos 1 e 2 **já são o que o dado declara** (verificado em
`data/resources.json`: `tree.regime = porAcao` mais `bloqueiaPasso: true` lido
junto com a quantidade em `recursos.ts:recursoBloqueiaPasso`; `fish.regime =
nunca`, e `colherDoTile` apaga a entrada ao zerar quando o regime é `nunca`). O
aceite não inventa regra: ele **cobra na partida** o que o arquivo promete.

## Restrições globais

- `src/sim/` sem `phaser`, sem `Math.random()`, sem `Date.now()`; nada de número
  de balanceamento em `.ts`.
- **Proibido tocar `src/ui/` e `index.html`** (ordem do operador, 2026-09-25:
  outra branch está neles). Se a feature precisar, parar e reportar.
- Teste que quebra por mudança de comportamento se reescreve **mais estrito**, na
  tarefa que mudou o comportamento — nunca se afrouxa, nunca se pula.
- Medida de relógio é evidência, nunca asserção (CLAUDE.md §8).

---

## Medição 1 — a FORMA da distribuição (aceno 4)

Rodada sobre `data/maps/sertao-128.json`, com componentes 8-conectados e o
predicado de margem (tile com ao menos um vizinho de terreno transponível):

| tipo | tiles | manchas | tamanhos | alcançáveis |
|---|---|---|---|---|
| `tree` | 350 | **12** capoeiras | 68, 56, 47, 45, 41, 40, 20, 18, 6, 5, 2, 2 | **301 de 350** hoje |
| `fish` | 274 | **2** lagos | 243, 31 | **95 de 274** |
| `rock` | 311 | 11 lajedos | 88, 74, 30, ... | (BUG-C) |

Duas conclusões que mudam o aceite, e nenhuma delas aparece na média:

- **O lago grande é quase todo inútil.** 243 tiles, **70** de margem: o pescador
  só alcança a beira, e água nunca vira andável (ao contrário da árvore, que ao
  ser cortada abre o anel seguinte — é por isso que árvore dá 301 agora e 350 no
  fim, e peixe dá 95 e pronto). Do nominal de 5 480 unidades de peixe no mapa,
  **1 900** são colhíveis.
- **O lago pequeno (28..39, 24..26) está a 4 tiles do armazém inicial**, tem 31
  tiles, 25 deles de margem, e **uma única Casa do Pescador em (32,27) alcança os
  31 com alcance 6** — 500 unidades de peixe, finitas, ao lado da vila. É o
  cenário do aceite.

## Medição 2 — o custo de herança, medido antes de escrever o aceite

Experimento: `colheita` posta nos dois prédios, `npm run test`, e depois só no
pescador. Resultado:

| mudança | testes reprovados |
|---|---|
| `fishermans` + `woodcutters` | **3** — `F15a-receita`, `F15b-aceite` (oráculo), `F17-aceite` (Fase A) |
| **só `fishermans`** | **0** de 1 358 |

A causa das duas reprovações caras é uma só e **não é de código**: a capoeira
mais próxima da vila está a **12 tiles** do armazém, e os dois Woodcutter's que o
cenário oráculo (18,34 e 22,34) e a abertura da Fase A plantam ao lado do armazém
têm **zero árvore** em alcance 6 (medido; em alcance 12 teriam 7). Com `colheita`
no dado, eles param de produzir — e com eles param a serraria, o `timber` e o
aceite da Fase A.

Consertar isso é **mudar a geometria da abertura**: a fila única de quatro
prédios ao lado do armazém (`tests/helpers/abertura.ts`, com a invariante escrita
de "altura igual nos quatro" e a rua reta até a escola) deixa de servir, porque a
pedreira quer o lajedo da vila e o lenhador quer a mata a 12 tiles. Isso não é
não-regressão de fixture: é **redesenhar o aceite do marco F17**, e marco é
decisão do operador (CLAUDE.md §12 e §14).

## A quebra em dois itens (CLAUDE.md §6)

- **F-T4a — o pescador sai para colher.** `fishermans` ganha `colheita`. Custo de
  herança medido: **zero**. Entregável nesta sessão, com aceite, evidência e
  captura. **É o que este plano executa.**
- **F-T4b — o lenhador sai para colher.** `woodcutters` ganha `colheita`, e junto
  vem a pergunta que eu não respondo sozinho: **onde a abertura da Fase A planta
  o lenhador, agora que ele precisa de mata a 12 tiles da vila?** Fica registrada
  no `BUILD_PLAN.md` com as três reprovações nomeadas e os números acima.

---

## Tarefa 1 — as três fixtures do pescador

**Arquivos:** modificar `tests/helpers/producao-cenario.ts`.

Três cenários, todos no molde do `cenarioDeFazenda` (longe da vila quando o
recurso está longe, com armazém próprio e rua), e todos com **guarda própria**:
coordenada errada falha na fixture, com o motivo escrito, e não três `expect`
adiante como "produziu 0".

- `cenarioDePescador` — Casa do Pescador `p1` em **(32,27)**, ao lado do lago
  pequeno, ligada ao armazém inicial (29,30) pela rua (32,29) até (32,33) e
  (31,33). Guarda: pelo menos um tile de peixe ao alcance.
- `cenarioDePescadorDeUmCardume` — `p1` em **(45,26)**, onde só **1** tile de
  peixe cai no alcance 6, com armazém próprio. Guarda: exatamente 1 tile ao
  alcance. É o cenário do esgotamento.
- `cenarioDePescadorNoLagoGrande` — `p1` em **(92,38)**, onde **67** tiles de
  interior e **18** de margem caem no alcance. Guarda: interior maior que zero. É
  o cenário que prova que a escolha do tile pula o que ninguém alcança.

- [ ] **Passo 1:** escrever as três fixtures com as guardas.
- [ ] **Passo 2:** `npx vitest run tests/F-T4-pescador.test.ts` — falha porque o
      arquivo de teste ainda não existe. (A fixture sozinha não se prova.)

## Tarefa 2 — o aceite, em vermelho

**Arquivos:** criar `tests/F-T4-pescador.test.ts`.

Quatro pernas. Todas rodam contra o dado de verdade; nenhuma monta `GameData`
sintético.

- [ ] **Perna (a) — ele sai, e fica na MARGEM.** O pescador larga a porta, anda
      pelo A* (tile a tile, sem salto) e o tile em que ele fica em `colhendo`:
      (i) está a Chebyshev 1 do tile reservado; (ii) **não é o tile do cardume**;
      (iii) é andável por `tileAndavel`. É o caso que a F-T3 não cobriu: rocha e
      milho se pisa, água não — o pescador é o primeiro ofício cujo alvo é
      **inalcançável por dentro**. O peixe entra na gaveta no tick da **volta**.
- [ ] **Perna (b) — o cardume some, e o regime é `nunca`.** Com o único tile ao
      alcance posto na quantidade de um ciclo, um ciclo o zera: a entrada **sai**
      de `state.recursos` (`recursoNoTile === null`), e não fica em zero como a
      árvore e o milho. O regime vem do dado (`regimeDoTipo('fish')`), nunca de
      literal no teste.
- [ ] **Perna (c) — lago seco não trava ninguém.** Esgotado o alcance: nenhuma
      tarefa de colheita fica reclamada, o pescador volta a estado de espera com
      `fsmData` limpo, `violacoesDeInvariantes` e `violacoesDaFsmDoEspecialista`
      vêm vazias, e o prédio passa a dizer o motivo pelo mesmo caminho da fazenda
      sem campo (`alertasDoPredio`). Espera indefinida é travamento de regra, não
      balanceamento.
- [ ] **Perna (d) — a escolha pula o interior do lago.** No lago grande, em 200
      ticks de escolhas, **todo** tile escolhido é de margem — nenhum dos 67 tiles
      de interior é reservado uma vez sequer. A asserção é estrutural: compara o
      conjunto escolhido com `tileAlcancavelParaColheita`, não com uma lista de
      coordenadas digitada.
- [ ] **Passo 5:** rodar. Todas as pernas falham: `fishermans` ainda não tem
      `colheita`, então o pescador nunca sai.

## Tarefa 3 — o dado

**Arquivos:** modificar `data/production.json` (só o bloco `fishermans`).

- [ ] **Passo 1:** edição cirúrgica — `colheita` com `recurso: fish` e
      `alcance_tiles: 6`, mais a nota dizendo que o estoque virou o TILE. Não
      reserializar o arquivo: a indentação é dele, e um diff de 196 linhas
      esconde a mudança de 4.
- [ ] **Passo 2:** `npm run validate:data` — a regra `recurso/colheita` já cobre
      recurso inexistente e alcance não inteiro.
- [ ] **Passo 3:** rodar o aceite: verde.
- [ ] **Passo 4:** `npm run test` inteiro: 0 reprovações esperadas (medido na
      Medição 2).

## Tarefa 4 — a evidência da forma (aceno 4)

**Arquivos:** `tests/F-T4-pescador.test.ts` (bloco de medição).

- [ ] Gravar em `test-output/F-T4a.json`, via `gravarEvidencia`: manchas e
      tamanhos dos dois lagos, tiles de margem por lago, unidades colhíveis
      contra nominais, e o mesmo para a árvore (que é o número que a F-T4b vai
      herdar). Número de forma é **evidência**; o que vira `expect` é a perna (d).

## Tarefa 5 — captura

**Arquivos:** criar `tools/shots/F-T4a.js`.

O roteiro ergue Woodcutter's, Sawmill e Casa do Pescador pelo menu (a árvore de
desbloqueio exige os dois primeiros; eles não precisam de ocupante), abre a rua
pelo mesmo `_estradas.js` da F-T3, treina o pescador na escola e afirma **na
tela** o que só a tela prova: o tile **desenhado** do pescador sai do footprint e
cai num tile de terra **encostado na água** — ele pesca da margem. Um passo roda
despausado com `mouse.down` / 150 ms / `mouse.up` (§8), porque o roteiro aperta
`#painel-predio` e `#menu-build`.

## Tarefa 6 — fechamento

- [ ] `BALANCE_LOG.md`: alcance 6 dos dois ofícios como número a calibrar, com os
      500 peixes do lago da vila e os 95/274 do mapa.
- [ ] `BUILD_PLAN.md`: F-T4 vira F-T4a (entregue) e F-T4b (o lenhador, com a
      pergunta da geometria da Fase A e as três reprovações nomeadas).
- [ ] `npm run verify`; abrir a evidência com Read; virar a chave em
      `test-results.json`; `PROGRESS.md`; commit `feat(F-T4a): ...`.
