# F18d-1a — Modo de entrega por nível — plano de implementação

> **Para quem executa:** os passos usam caixa (`- [ ]`) para acompanhamento.
> Uma tarefa por vez, com teste próprio. Commit único no fim (feature de `sim/`
> que só fica coerente inteira: o dado sem os leitores não muda nada, e os
> leitores sem os testes velhos reescritos deixam a suíte vermelha).

**Objetivo:** entregar material **numa construção** passa a andar livre, por
qualquer tile; **coletar de produção** continua exigindo estrada. Quem decide é o
`modo` publicado por nível em `data/delivery.json`, não um literal digitado em
`.ts`. Aceite no `BUILD_PLAN.md`, item **F18d-1a**.

**Arquitetura:** a regra de hoje é o literal `'estrada'` passado a `buscarCaminho`
em quatro call sites de `sim/jobs.ts` e dois de `sim/systems/serfs.ts`, mais o
`distanciaEntrePredios` (BFS por estrada) que `systems/jobs.ts` usa para
existência e para escolher origem. Todos passam a receber o modo **derivado do
tipo da tarefa**, por um helper irmão de `nivelDoTipo`. Nada além disso muda: o
JobBoard, as reservas, a escada de prioridade e os estados da FSM ficam como
estão.

**Stack:** TypeScript estrito, Vitest, `tools/data-rules.js` para `validate:data`.

**Item do BUILD_PLAN:** `BUILD_PLAN.md`, `### F18d-1a` (linha ~1160).

## Restrições globais

- `src/sim/` puro: sem `phaser`, sem `window`, sem `Math.random()`/`Date.now()`.
- Nenhum número de balanceamento em `.ts`; o `modo` é dado, lido a partir de
  `GameData`.
- **Só `src/sim/` e `data/`.** Nada de `src/render/` — não é feature de
  integração (CLAUDE.md §10).
- `test-results.json` só depois de `npm run verify` verde.

## O que NÃO entra

- `estradasPlanejadas`, `'assentar-estrada'`, `PlaceRoad` que reserva: é a
  **F18d-1b**, item seguinte da fila.
- `predioLigadoAoArmazem` e seus três chamadores (`systems/especialistas.ts:184`,
  `selectors.ts:271`, `selectors.ts:563`): servem os níveis 2, 6 e 7, todos em
  **estrada**. Medido e registrado como Nota no item.
- A ordem da escada e o desempate: `nivelDoTipo` e `desempate` ficam intactos.

---

### Tarefa 1: o dado publica o modo, e há um único leitor

**Arquivos:**
- Modificar: `data/delivery.json`
- Modificar: `tools/data-rules.js` (`validarEscadaDePrioridade`)
- Modificar: `src/sim/jobs.ts` (ao lado de `nivelDoTipo`)
- Teste: `tests/F18d-1a-modo.test.ts` (novo)

**Interfaces:**
- Produz: `modoDoTipo(tipo: TarefaDeTransporte['tipo'], dados?: GameData): ModoDeBusca`
  — lê `dados.entrega.prioridades.find((p) => p.id === tipo).modo`; lança se o id
  não está na escada ou se o `modo` não é `'livre'` nem `'estrada'` (mesmo
  contrato de `nivelDoTipo`, que já lança).

- [ ] **Passo 1: teste que falha** — `modoDoTipo('material-para-obra')` é
      `'livre'`; os outros seis ids são `'estrada'`; um tipo fora da escada
      (`'construir'`) lança; um dado com `modo` inválido lança.
- [ ] **Passo 2:** rodar e ver falhar por `modoDoTipo` inexistente.
- [ ] **Passo 3:** `"modo": "livre"` no nível 3 e `"modo": "estrada"` nos níveis
      1, 2, 4, 5, 6 e 7 de `data/delivery.json`, com nota explicando o critério
      (destino é canteiro → livre; destino é porta de prédio pronto → estrada) e
      a fonte (Nota do operador, 2026-09-23).
- [ ] **Passo 4:** `validarEscadaDePrioridade` passa a exigir `modo` presente e
      em `{livre, estrada}` em **toda** linha. Regra positiva, não lista de
      exceções: linha nova sem modo reprova.
- [ ] **Passo 5:** `modoDoTipo` em `src/sim/jobs.ts`, logo abaixo de
      `nivelDoTipo`, com o mesmo formato de erro.
- [ ] **Passo 6:** `npm run validate:data` e o teste novo verdes.

---

### Tarefa 2: as portas e as duas pernas passam a depender do modo

**Arquivos:**
- Modificar: `src/sim/jobs.ts` (`portasDeEstrada`, `portasDeColeta`,
  `planoDaTarefa`, `custoDaTarefa`)
- Teste: `tests/F18d-1a-modo.test.ts`

**Interfaces:**
- Produz: `portasDaTarefa(state, predioId, modo, dados?): TileDeGrid[]`
  — em `'estrada'` é o `portasDeEstrada` de hoje (só os tiles de porta que são
  estrada); em `'livre'` é `tilesDaPorta` inteiro, a mesma porta que
  `caminhoAteAObra` já usa para o laborer.
- `portasDeEstrada` **continua existindo** com a assinatura de hoje: quem a usa
  fora daqui (`systems/serfs.ts`) migra na Tarefa 4.

- [ ] **Passo 1: teste que falha** — cenário sem nenhuma estrada, armazém com
      pedra e obra pedindo pedra: `planoDaTarefa` devolve plano (hoje devolve
      `null`), com `deEntrega.custo` igual ao A* livre entre as duas portas,
      medido no próprio teste a partir de `buscarCaminho`. No mesmo cenário,
      uma tarefa de nível 6 (`saida-cheia-para-armazem`) segue devolvendo `null`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** `portasDeColeta` recebe o modo: em `'livre'` não filtra por
      componente (componente é conceito da rede de estradas) e devolve as portas
      inteiras dos dois prédios; em `'estrada'` fica idêntica a hoje.
- [ ] **Passo 4:** `planoDaTarefa` e `custoDaTarefa` passam `modoDoTipo(t.tipo)`
      ao `buscarCaminho` da perna de entrega. A perna até a origem continua
      `'livre'` em todo nível — ela já era.
- [ ] **Passo 5:** rodar; o teste novo passa e os antigos de `F10-astar`,
      `F15b-entrega` e `F13a-ouro` seguem verdes (níveis 2 e 4–7 não mudaram).

---

### Tarefa 3: existência e escolha de origem, por modo

**Arquivos:**
- Modificar: `src/sim/estradas.ts` (`distanciaEntrePredios`)
- Modificar: `src/sim/jobs.ts` (`distanciaDaTarefa`)
- Modificar: `src/sim/systems/jobs.ts` (`motivoIndividual` ~109,
  `origemMaisPerto` ~259, `destinoMaisPerto` ~279)
- Teste: `tests/F18d-1a-modo.test.ts`

**Interfaces:**
- Produz: `distanciaEntrePredios(state, a, b, dados?, modo?: ModoDeBusca): number | null`
  — `'estrada'` (padrão) continua sendo o BFS em passos de `distanciaPorEstrada`,
  memoizado; `'livre'` é o menor custo A* em **ticks** entre as portas de `a` e
  as de `b`. As duas unidades nunca se comparam entre si: a comparação é sempre
  dentro de um nível, e um nível tem um modo só.

- [ ] **Passo 1: teste que falha** — dois armazéns com pedra e nenhuma estrada:
      a tarefa de nível 3 nasce (hoje não nasce) e a origem é a do menor caminho
      **a pé**, com o número medido ao lado; o armazém mais perto por estrada e
      mais longe a pé perde. Um segundo caso: nível 6 sem estrada continua sem
      tarefa.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar o parâmetro `modo` em `distanciaEntrePredios`;
      `origemMaisPerto` recebe o tipo da tarefa que vai criar e mede no modo
      dele; `destinoMaisPerto` (níveis 6/7) passa `'estrada'` explícito.
- [ ] **Passo 4:** `motivoIndividual` (saneamento) mede no modo do tipo da
      tarefa que está saneando.
- [ ] **Passo 5:** rodar; medir o tempo de `npm run test` antes e depois e
      registrar no PROGRESS — A* livre por par armazém×obra a cada tick é mais
      caro que o BFS memoizado, e o mapa grande da F18b é o cenário de risco.
      Se a suíte passar de 2× o tempo de hoje, **parar e registrar** em vez de
      otimizar por conta própria.

---

### Tarefa 4: o serf carregado não precisa de rua para entregar numa obra

**Arquivos:**
- Modificar: `src/sim/systems/serfs.ts` (`passoIndoColetar` ~142,
  `passoIndoEntregar` ~168–188)
- Teste: `tests/F18d-1a-modo.test.ts`

- [ ] **Passo 1: teste que falha** — serf com tarefa de nível 3 reclamada, sem
      estrada nenhuma: coleta, sai carregado e **entrega**; a obra recebe. Hoje
      ele solta a tarefa com `'caminho-cortado'` no primeiro tick.
- [ ] **Passo 2:** rodar e ver falhar (o motivo publicado no evento é a prova).
- [ ] **Passo 3:** `passoIndoColetar` usa `portasDaTarefa(..., modo)` e
      `buscarCaminho(..., modo)`.
- [ ] **Passo 4:** `passoIndoEntregar`: em `'estrada'` a checagem de ligação fica
      exatamente como hoje (`ehEstrada(agora) && portas.some(isConnected)`); em
      `'livre'` a pergunta equivalente é "ainda existe caminho a pé até alguma
      porta", e o replanejamento dispara quando o próximo tile da rota deixou de
      ser andável (prédio novo em cima), não quando deixou de ser estrada.
- [ ] **Passo 5:** rodar; `F10-falhas` ainda acusa `caminho-cortado` nos níveis
      de estrada (a Tarefa 5 ajusta as asserções que eram de nível 3).

---

### Tarefa 5: os aceites antigos que codificavam a regra velha

**Arquivos:**
- Modificar: `tests/F09-sistema.test.ts` (`:76`, `:173`, `:207`, `:214`, `:232`)
- Modificar: `tests/F10-desempate.test.ts` (`:72`, `:82`, `:95`)
- Modificar: `tests/F10-falhas.test.ts` (`:160`, `:170`, `:191`, `:205`)
- Modificar: `tests/F09-jobboard.test.ts` (`:270`)
- Modificar: `tests/F10-ciclo.test.ts` (`:142`)

**Regra desta tarefa:** a asserção nova fica **mais estrita**, não só diferente —
quem afirmava "sem estrada não nasce tarefa" passa a afirmar "nasce, e a origem é
esta, por este custo medido", com o número no teste. Onde o cenário existia só
para provar a dependência de estrada, ele vira um cenário de **nível 6**, que
ainda depende — em vez de sumir.

- [ ] **Passo 1:** `F09-sistema.test.ts:214` primeiro, que é o citado no aceite:
      título e corpo passam a ser "a origem é o armazém de menor caminho **a
      pé**", com o número medido ao lado.
- [ ] **Passo 2:** os outros 13, um arquivo por vez, rodando entre eles.
- [ ] **Passo 3:** `npm run test` inteiro verde. Nenhum `skip`, nenhum teste
      apagado: se um deles não tiver substituto honesto, **parar e reportar**.

---

### Tarefa 6: o aceite, a evidência e o commit

**Arquivos:**
- Modificar: `tests/F18d-1a-modo.test.ts` (o cenário do aceite)
- Modificar: `PROGRESS.md`, `test-results.json`

- [ ] **Passo 1:** cenário do aceite, num teste só, sem nenhuma estrada no mapa:
      planta a obra da casa, roda até `completo` e afirma o estado; **no mesmo
      cenário** a pedreira pronta enche a saída e o pedreiro vai a `saida_cheia`;
      depois de ligar a rua, ela escoa.
- [ ] **Passo 2:** `gravarEvidencia('F18d-1a', …)` com: o tick em que a casa
      ficou pronta sem estrada, o estado do pedreiro antes e depois da rua, a
      origem escolhida e as duas distâncias (a pé e por estrada) que a
      justificam, e o tempo da suíte antes/depois.
- [ ] **Passo 3:** `npm run verify`.
- [ ] **Passo 4:** abrir `test-output/F18d-1a.json` com Read e conferir contra o
      aceite escrito no `BUILD_PLAN.md`.
- [ ] **Passo 5:** `PROGRESS.md` — o que mudou, a decisão de quebrar a F18d-1 em
      duas (com a medição que a motivou), o que ficou para a F18d-1b, e a
      medição de tempo da suíte.
- [ ] **Passo 6:** `test-results.json`: `"F18d-1a-modo-por-nivel": { "passes": true }`.
- [ ] **Passo 7:** commit `feat(F18d-1a): entregar em obra anda livre; coletar de producao exige estrada`.
