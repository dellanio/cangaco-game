# F20a — A Bodega recebe comida

**Objetivo:** implementar o **nível 1** da escada de `delivery.json`
(`comida-para-inn`), o único que nunca teve implementação: a Bodega completa pede
`loaves` e `sausages` ao armazém até o teto de `condition.json`, e os serfs levam.

**Arquitetura:** só `src/sim/`. Um tipo de tarefa novo (`comida-para-inn`) entra nas
tabelas exaustivas de `state.ts`, um módulo derivado novo (`sim/bodega.ts`, irmão de
`sim/escola.ts`) responde "quem é Bodega" e "quanto ela ainda pede", e um gerador novo
em `systems/jobs.ts` cria as tarefas antes de todos os outros níveis. O transporte,
a reserva dupla, o saneamento e a devolução de carga são os que já existem — a feature
não escreve FSM nenhuma.

**Stack:** TypeScript estrito, Vitest, sim headless. Sem Playwright: `render/` não é
tocado (a Bodega já desenha como qualquer prédio, com placeholder se não houver PNG).

**Spec:** `BUILD_PLAN.md:2085-2136` (item F20a, com os seis critérios de aceite e a
não-regressão escrita).

## Restrições globais (CLAUDE.md, valem em toda tarefa)

- `src/sim/` não importa `phaser` e não toca `window`/`document`/`performance`.
- **Nenhum número de balanceamento em `.ts`**: o teto de comida vem de
  `condition.json:inn.estoquePorTipoDeComida`, a lista de comidas de
  `condition.json:restauracaoPorComida`, o nível de `delivery.json:prioridades[].nivel`
  e o modo de `prioridades[].modo`.
- Toda duração em **ticks**; nada de milissegundos.
- **Medida de relógio não entra em `expect`** (§8): as asserções usam eixo
  determinístico — tick, contagem de mercadoria, ordem de `tarefasEmOrdem`.
- `GameState` continua serializável: o tipo novo é string em união discriminada.
- Toda tarefa reclamada tem caminho de volta (§5): o aceite 6 é esse ramo.
- Nenhuma dependência nova. Nenhum `eslint-disable`, nenhum `skip`.
- Evidência aberta com Read antes de `passes: true`; `npm run verify` verde; commit
  `feat(F20a): …`.

## O que foi conferido no código antes de planejar (2026-09-24)

| pergunta | resposta, com o lugar |
|---|---|
| a Bodega existe no dado? | `data/buildings.json:8` — `inn`, Taverna, 4×3, timber 6, stone 5, hp 550, `desbloqueadoPor: storehouse`, `trabalhador: null` |
| e o teto de comida? | `data/condition.json:10` — `inn: { comensaisSimultaneos: 8, estoquePorTipoDeComida: 5 }` |
| o dado chega à sim? | sim, `dados.condicao` (`src/sim/data/loader.ts:414-434`), e **nenhum sistema o lê** — esta feature é a primeira leitora de `inn` |
| que capacidade a Bodega tem? | `{ entrada: null, saida: null }` — `state.ts:capacidadeParaTipo`, ramo "prédio sem receita e sem ser armazém". **O teto de 5 não pode vir de `capacidade`** |
| o nível 1 tem implementação? | não: `grep comida-para-inn src/` não devolve **nada**. Só `delivery.json` e dois testes que dizem "ainda não existe" |
| quantos lugares o tipo novo toca? | os mesmos 7 do `ouro-para-escola` (F13): `state.ts` (união + 2 `Record` exaustivos), `jobs.ts` (`UNIDADE_ELEGIVEL_POR_TIPO`, `criarTarefa…`), `reservas.ts` (`demandaNoDestino`), `systems/jobs.ts` (`motivoDoDestino`, gerador), `systems/serfs.ts` (`destinoQueRecebe`) |

## Decisões desta feature (todas para o PROGRESS.md, marcadas para revisão)

- **D1 — O id da Bodega é constante estrutural, como `ID_DA_ESCOLA`.**
  `ID_DA_BODEGA = 'inn'` em `state.ts`, ao lado de `ID_DO_ARMAZEM` e `ID_DA_ESCOLA`,
  com o mesmo comentário: *referência de id estrutural, não número de balanceamento*.
  O `inn` também é a **chave** de `condition.json:inn`, então o id liga dado e código.
- **D2 — O teto mora em `bodega.ts`, e `alvoDeEntrada` ganha um ramo.** `insumo.ts`
  já é o lugar único que responde "quanto este prédio quer na gaveta `entrada`", e tem
  ramo para produtor (receita) e para escola (fila). A Bodega é o terceiro ramo. De
  graça, isso dá o **nível 7** correto: comida acima do teto (dado editado, save antigo)
  volta ao armazém por `excedenteNaEntrada`, sem escrever uma linha para isso.
- **D3 — "Comida" é o conjunto de chaves de `restauracaoPorComida`.** É o único lugar
  do dado que declara o que é comida, e é o que a F20b vai ler para restaurar condição.
  Nenhum id de comida é digitado em `.ts` — nem `loaves`, nem `sausages`.
- **D4 — O gerador roda primeiro em `gerarTarefas`.** Pelo mesmo motivo que
  `gerarTarefasDeOuro` roda antes das obras: espelhar a escada na leitura do quadro. A
  prioridade de atendimento continua vindo de `nivelDoTipo`, não da ordem de criação —
  e o aceite 4 afirma isso por `tarefasEmOrdem`, não pela ordem dos ids.
- **D5 — `entregarInsumo` vira `entregarNaEntrada`.** O gesto é "a carga entra na gaveta
  `entrada` de um prédio completo", e é o mesmo para insumo e para comida. Renomear (duas
  chamadas, um arquivo) é mais honesto que chamar `entregarInsumo` para pão; não é
  refatoração ampla — é o nome do que a linha nova passa a fazer.
- **D6 — A Bodega não recebe nada além de comida, e isso é asserção.** `alvoDeEntrada`
  devolve **zero** para ouro, pedra e tronco na Bodega, então nenhum nível (1, 4, 5)
  cria tarefa deles para ela. O teste afirma o zero — sem isso, um ramo mal escrito
  faria a Bodega virar segundo armazém.

## Estrutura de arquivos

| arquivo | o que muda |
|---|---|
| `src/sim/bodega.ts` | **novo** — `ID_DA_BODEGA` reexportado, `ehBodegaCompleta`, `comidasConhecidas`, `tetoDeComidaNaBodega`, `comidaNecessaria` |
| `src/sim/state.ts` | `ID_DA_BODEGA`; `TarefaComidaParaInn`; `TarefaDeTransporte`; `GAVETA_DE_ORIGEM_POR_TIPO`; `ORIGEM_ESPERADA_POR_TIPO` |
| `src/sim/jobs.ts` | `UNIDADE_ELEGIVEL_POR_TIPO` + `criarTarefaDeComida` |
| `src/sim/insumo.ts` | ramo da Bodega em `alvoDeEntrada` |
| `src/sim/reservas.ts` | `case 'comida-para-inn'` em `demandaNoDestino` |
| `src/sim/systems/jobs.ts` | `case` em `motivoDoDestino` + `gerarTarefasDeComida` |
| `src/sim/systems/serfs.ts` | `case` em `destinoQueRecebe`; `entregarInsumo` → `entregarNaEntrada` |
| `tests/helpers/bodega-cenario.ts` | **novo** — a geometria da Bodega derivada do dado e o cenário por comando |
| `tests/F20a-bodega.test.ts` | **novo** — os seis critérios |
| `tests/F18d-1a-modo.test.ts` | a não-regressão escrita: `comida-para-inn` entra na lista dos tipos que existem |
| `test-output/F20a.json` | **novo** — evidência da corrida |
| `PROGRESS.md`, `test-results.json` | fecho da sessão |

## Tarefa 1 — `sim/bodega.ts`: quem é Bodega e quanto ela pede

**Arquivos:** criar `src/sim/bodega.ts`; `tests/F20a-bodega.test.ts` (primeiro
`describe`); `src/sim/state.ts` (`ID_DA_BODEGA`).

**Camada:** `bodega.ts` **não** importa `estradas`, `pathfinding` nem `jobs` — o mesmo
contrato que o cabeçalho de `escola.ts` explica, porque `reservas.ts` vai importá-lo.

- [ ] **Passo 1: escrever o teste que falha.**

```ts
const COMIDAS = Object.keys(gameData.condicao.restauracaoPorComida);
const TETO = gameData.condicao.inn.estoquePorTipoDeComida;

it('a comida e o teto vem do dado, e nenhum id de comida e digitado aqui', () => {
  expect(COMIDAS.length).toBeGreaterThan(1);
  expect(comidasConhecidas(gameData)).toEqual(COMIDAS);
  expect(tetoDeComidaNaBodega(gameData)).toBe(TETO);
});

it('a Bodega vazia pede o teto de cada comida, e zero de tudo o mais', () => {
  const estado = cenarioComBodegaCompleta();
  const bodega = bodegaDoCenario(estado).id;
  for (const comida of COMIDAS) {
    expect(comidaNecessaria(estado, bodega, comida)).toBe(TETO);
    expect(alvoDeEntrada(estado, bodega, comida)).toBe(TETO);
  }
  for (const outra of [MERCADORIA_DE_OURO, ...gameData.economia.mercadorias]) {
    expect(comidaNecessaria(estado, bodega, outra)).toBe(0);
    expect(alvoDeEntrada(estado, bodega, outra)).toBe(0);
  }
});
```

- [ ] **Passo 2: rodar e ver falhar** (`Cannot find module '../src/sim/bodega'`).
- [ ] **Passo 3: implementar `bodega.ts`** — `ehBodegaCompleta` (`estado === 'completo'`
      e `tipo === ID_DA_BODEGA`, no molde exato de `ehEscolaCompleta`),
      `comidasConhecidas` (as chaves de `restauracaoPorComida`, na ordem do dado, como
      `insumosDoPredio` faz), `ehComida`, `tetoDeComidaNaBodega`
      (`dados.condicao.inn.estoquePorTipoDeComida`) e `comidaNecessaria` =
      `Math.max(0, teto - (bodega.estoque.entrada[mercadoria] ?? 0))`, zero para quem
      não é Bodega e para o que não é comida. É o análogo de `ouroNecessario` e a "vaga
      no destino" da tarefa de nível 1.
- [ ] **Passo 4:** em `insumo.ts`, o ramo novo em `alvoDeEntrada`, antes do ramo da
      escola, com o comentário do porquê: a Bodega não tem receita e não tem teto de
      gaveta (`capacidade.entrada === null`), então o alvo vem de `condition.json`. O
      nível 7 sai de graça — comida acima do teto volta ao armazém por
      `excedenteNaEntrada`.
- [ ] **Passo 5:** rodar o `describe` e ver verde. **Commit.**

## Tarefa 2 — O tipo de tarefa `comida-para-inn` na escada

**Arquivos:** `src/sim/state.ts`, `src/sim/jobs.ts`, `src/sim/reservas.ts`,
`src/sim/systems/jobs.ts`, `src/sim/systems/serfs.ts`, `tests/F20a-bodega.test.ts`,
`tests/F18d-1a-modo.test.ts`.

**Interfaces produzidas:** `TarefaComidaParaInn` (`tipo: 'comida-para-inn'`, com a forma
de `TarefaDeCarga`: `mercadoria`, `origem`, `destino`, `estado`, `reclamadaPor`);
`criarTarefaDeComida(state, { mercadoria, origem, destino })` devolvendo
`{ state, id }`, como `criarTarefaDeOuro`.

- [ ] **Passo 1: escrever o teste que falha.**

```ts
it('o nivel novo e o 1, e a escada inteira continua onde estava', () => {
  expect(nivelDoTipo('comida-para-inn')).toBe(1);
  expect(nivelDoTipo('comida-para-inn')).toBeLessThan(nivelDoTipo('ouro-para-escola'));
  expect(modoDoTipo('comida-para-inn')).toBe('estrada');
});

it('so o serf carrega comida, e a carga sai da gaveta de saida do armazem', () => {
  expect(elegivelParaTarefa('comida-para-inn', TIPO_QUE_CARREGA)).toBe(true);
  expect(elegivelParaTarefa('comida-para-inn', TIPO_QUE_CONSTROI)).toBe(false);
  expect(gavetaDeOrigem('comida-para-inn')).toBe('saida');
  expect(ORIGEM_ESPERADA_POR_TIPO['comida-para-inn']).toBe('armazem');
});
```

- [ ] **Passo 2: rodar e ver falhar** (erro de compilação: o tipo não existe).
- [ ] **Passo 3: `state.ts`** — a interface, com o comentário que explica a diferença da
      tarefa de ouro (o destino não tem fila: tem **teto por tipo de comida**), a entrada
      nas duas tabelas exaustivas (`GAVETA_DE_ORIGEM_POR_TIPO: 'saida'`,
      `ORIGEM_ESPERADA_POR_TIPO: 'armazem'`) e a união `TarefaDeTransporte`. Mais
      `ID_DA_BODEGA = 'inn'`, ao lado de `ID_DA_ESCOLA`.
- [ ] **Passo 4: `jobs.ts`** — `UNIDADE_ELEGIVEL_POR_TIPO['comida-para-inn'] =
      TIPO_QUE_CARREGA` e `criarTarefaDeComida`, irmã de `criarTarefaDeOuro` (a
      mercadoria é parâmetro: são duas comidas, não uma só).
- [ ] **Passo 5: `reservas.ts`** — em `demandaNoDestino`:
      `case 'comida-para-inn': return comidaNecessaria(state, tarefa.destino, tarefa.mercadoria, dados);`
- [ ] **Passo 6: `systems/jobs.ts`** — em `motivoDoDestino`:
      `case 'comida-para-inn': return ehBodegaCompleta(destino) ? null : 'destino-sumiu';`
- [ ] **Passo 7: `systems/serfs.ts`** — `entregarInsumo` vira `entregarNaEntrada` (D5) e
      o `case 'comida-para-inn'` a usa atrás do mesmo guarda de demanda que o ouro:
      `demandaNoDestino(...) >= 1 ? entregarNaEntrada(state, tarefa) : null`.
- [ ] **Passo 8: a não-regressão escrita.** Em `tests/F18d-1a-modo.test.ts`,
      `comida-para-inn` entra na lista dos tipos **que existem** e o comentário *"ainda
      não é tipo de tarefa — nasce na F20"* sai. A asserção nova é mais estrita, não só
      diferente.
- [ ] **Passo 9:** `npm run typecheck`. Os `Record` exaustivos e os `switch` sem
      `default` são o guarda: o compilador nomeia todo lugar que falta. Verde. **Commit.**

## Tarefa 3 — O gerador do nível 1

**Arquivos:** `src/sim/systems/jobs.ts`, `tests/helpers/bodega-cenario.ts`,
`tests/F20a-bodega.test.ts`.

- [ ] **Passo 1: escrever o teste que falha**, sobre um cenário montado (Bodega completa
      e armazém ligado por estrada, no molde de `cenarioLigado` +
      `comPredioCompletoEm`):

```ts
it('a Bodega vazia gera TETO tarefas de cada comida QUE O ARMAZEM TEM', () => {
  const t1 = avancar(cenarioComBodegaLigada(), 1);
  const daBodega = tarefasDoTipo(t1, 'comida-para-inn');
  expect(contarPorMercadoria(daBodega)).toEqual({ loaves: TETO, sausages: TETO });
  const semProdutor = COMIDAS.filter((c) => (baseDoArmazem[c] ?? 0) === 0);
  for (const t of daBodega) expect(semProdutor).not.toContain(t.mercadoria);
});

it('cheia, nao gera mais nenhuma — e nao passa do teto', () => { /* … */ });
it('sem estrada ate a Bodega, nenhuma tarefa nasce, e nada trava', () => { /* … */ });
```

- [ ] **Passo 2: rodar e ver falhar** (nenhuma tarefa gerada).
- [ ] **Passo 3: implementar `gerarTarefasDeComida`** no molde exato de
      `gerarTarefasDeOuro`: para cada Bodega completa em `predios.ordem` e cada comida de
      `comidasConhecidas`, `querem = comidaNecessaria(...)`, `existentes` = as tarefas de
      `comida-para-inn` daquele destino **e daquela mercadoria**, e cria a diferença a
      partir de `origemMaisPerto(atual, bodega, comida, 'comida-para-inn', dados)`.
      `origem === null` (nenhum armazém ligado, ou nenhum com aquela comida livre) é
      `continue`, não erro — a mesma regra do ouro e do material.
- [ ] **Passo 4:** `gerarTarefas` passa a começar por ela, na ordem da escada:
      `let atual = gerarTarefasDeComida(state, dados);` e a linha do ouro vira
      `atual = gerarTarefasDeOuro(atual, dados);`.
- [ ] **Passo 5:** rodar e ver verde. **Commit.**

## Tarefa 4 — O caminho real, do estado inicial (aceites 3, 4 e 6)

**Arquivos:** `tests/helpers/bodega-cenario.ts`, `tests/F20a-bodega.test.ts`.

- [ ] **Passo 1: a geometria, derivada — nunca digitada.** `plantaDaBodega(state)`:
      tamanho por `caixaDeTipo('inn')`, linha de porta do armazém por `caixaDoPredio`, e
      a Bodega na mesma linha de porta, **a leste da escola**, andando de um em um
      enquanto o footprint pisar em recurso que bloqueia construção
      (`recursoBloqueiaConstrucao`, o mesmo predicado da sim). O molde é
      `aberturaDaFaseA`, e o motivo de andar em vez de fixar x é o BUG-F. A rua é a reta
      na linha da porta, do armazém até a porta da Bodega, com o mesmo desvio de um tile
      onde `canPlaceRoad` recusar por `recurso`. Se não couber, o helper **lança**.
- [ ] **Passo 2: escrever o teste que falha.**

```ts
it('do estado inicial, por comando: a Bodega sobe e recebe o teto de cada comida', () => {
  const r = rodarAberturaDaBodega(20000);   // PlaceRoad + PlaceBlueprint no tick 0
  const bodega = bodegaDoCenario(r.fim);
  expect(bodega.estado).toBe('completo');
  for (const comida of COMIDAS_DA_ABERTURA) {
    expect(bodega.estoque.entrada[comida]).toBe(TETO);
    expect((baseDoArmazem[comida] ?? 0) - (estoqueDosArmazens(r.fim)[comida] ?? 0)).toBe(TETO);
  }
  expect(tarefasDoTipo(r.fim, 'comida-para-inn')).toHaveLength(0);
});
```

      `COMIDAS_DA_ABERTURA` é derivado, não digitado:
      `comidasConhecidas(gameData).filter((c) => (baseDoArmazem[c] ?? 0) > 0)`.
- [ ] **Passo 3:** rodar. Se falhar, o defeito é real (a Bodega é o primeiro destino de
      carga que não é obra, escola nem produtor) — depurar pelo estado, não por palpite.
- [ ] **Passo 4: aceite 4 (prioridade).** Cenário com obra nivelada pedindo material
      **e** Bodega vazia, com um serf ocioso: `tarefasEmOrdem(estado)[0].tipo` é
      `comida-para-inn`, e o serf que reclama pega essa. Eixo determinístico, sem
      relógio.
- [ ] **Passo 5: aceite 6 (ramo de erro).** Serf `carregando` comida e `Demolish` na
      Bodega no meio do caminho: a tarefa sai do quadro, a reserva volta
      (`violacoesDeInvariantes` limpo) e a carga volta ao armazém — o total de `loaves`
      no mundo não muda. Usa os helpers de invariante que já existem.
- [ ] **Passo 6:** rodar os seis critérios. **Commit.**

## Tarefa 5 — Evidência, registro e fecho

- [ ] **Passo 1:** um `it` de evidência grava `test-output/F20a.json` com
      `gravarEvidencia('F20a', …)`: o teto e a lista de comidas lidos do dado, o tick em
      que a Bodega ficou completa, o tick em que cada comida chegou ao teto, o saldo do
      armazém antes e depois, quantas tarefas de nível 1 nasceram no total, e a prova
      negativa (nenhuma tarefa das comidas sem produtor).
- [ ] **Passo 2:** abrir o JSON com **Read** e conferir os números.
- [ ] **Passo 3:** `PROGRESS.md` — o que foi **verificado** (comando rodado, arquivo
      aberto) separado das decisões D1–D6, marcadas como **decisão minha, para o operador
      revisar**, com a quebra da F20 em três sub-itens registrada.
- [ ] **Passo 4:** `npm run verify`; depois `test-results.json` com
      `"F20a-bodega-recebe-comida": { "passes": true }`; depois commit
      `feat(F20a): a Bodega pede comida ao armazém, e o nível 1 da escada estreia`.

## Riscos

- **A Bodega é o primeiro destino de carga que não é obra, escola nem produtor.** Se
  algum lugar do transporte assumir "destino é obra ou produtor" sem passar pelo tipo, o
  aceite 3 falha. É o risco que a Tarefa 4 existe para expor; a parte exaustiva o
  compilador já cobre.
- **A geometria pode não caber.** A vila inicial tem armazém em (29,30) e escola em
  (34,30), e a Bodega é 4×3. Se não couber a leste sem pisar em recurso que bloqueia, o
  helper lança (como `aberturaDaFaseA` faz) em vez de escolher um x qualquer, e a planta
  passa para o oeste. Não digitar coordenada: derivar e falhar alto.
- **O nível 1 atrasa tudo o mais enquanto a Bodega enche.** Dez viagens de comida na
  frente de material e ouro. É o que o dado manda (prioridade 1), e nenhum cenário atual
  tem Bodega — então nada existente muda. Se no playtest a aldeia parecer travada no
  começo, é `BALANCE_LOG.md`, não bug.
- **Comida sem produtor** (`wine`, `fish` em `restauracaoPorComida`): o aceite 5 fixa que
  isso não gera tarefa nem espera. Quando um produtor chegar, o gerador já as atende sem
  mudança.
