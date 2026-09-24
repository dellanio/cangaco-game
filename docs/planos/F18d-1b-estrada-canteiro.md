# F18d-1b — Estrada como canteiro (sim)

> **Fila:** item `F18d-1b` do `BUILD_PLAN.md`. O critério de aceite vem de lá,
> intocado. Este plano só decide **como**.

**Objetivo:** a rua desenhada não liga nada no tick do comando; ela vira
**canteiro** (`estradasPlanejadas`), o laborer assenta tile a tile, e é o
assentamento que debita a pedra — exatamente uma vez.

**Aceite (BUILD_PLAN, verbatim):** "a rua desenhada não liga nada no tick do
comando e liga depois que o laborer assenta; a pedra sai do armazém exatamente
uma vez, no assentamento."

**Evidência:** `test-output/F18d-1b.json`. Sem screenshot — feature só de `sim/`
e `data/` (a tela é a F18d-2).

---

## Restrições globais (do CLAUDE.md e das Notas do item)

- `src/sim/` puro e determinístico; número de balanceamento só em `data/*.json`.
- **A FSM do laborer tem cinco estados e o GDD proíbe um sexto**
  (`src/sim/systems/laborers.ts:4`). Esta feature **não** cria estado novo.
- **A reserva não é campo: é derivada das tarefas** (`sim/reservas.ts`, contrato
  herdado em `state.ts:311`). "PlaceRoad reserva a pedra" se implementa criando a
  **tarefa**, não escrevendo um contador.
- `estradasPlanejadas` **não** entra no índice de `sim/estradas.ts` (Nota do
  item): tile planejado não liga nada, e isso é o próprio aceite.
- A regra da quina mora num lugar só, `passoPermitido` (`sim/estradas.ts`).
- Não tocar em `src/render/`: esta feature não é de integração.

## Decisões de desenho (e por que)

**D1 — O tile planejado é um canteiro, e o laborer o trata como obra.** É o
título do item. Consequência: **nenhum estado novo** na FSM. O laborer reclama,
caminha (`indo_a_obra`), assenta (`martelando`, um tick de martelo por tile, sem
nivelamento) e volta a `ocioso`. `esperando_material` não acontece: a pedra não
viaja, é debitada no assentamento.

**D2 — `'assentar-estrada'` entra na escada de `delivery.json`, em último lugar
(nível 8), com `"modo": "livre"`.** A Nota da F18d-1a manda entrar na escada; o
lugar é o fim porque **acrescentar no fim não desloca nível nenhum já medido** —
qualquer outra posição renumeraria os sete existentes e reescreveria testes que
não são desta feature. O nível dela só a compara com outras tarefas de laborer.
`modoDoTipo` passa a aceitar o tipo novo alargando o parâmetro para os tipos
**que estão na escada**, não para `TipoDeTarefa` inteiro (`'construir'` e
`'ocupar'` continuam fora, e continuam falhando alto).

**D3 — `destino` da tarefa nova é o **tile**, não um id de prédio.** É o custo
que a Nota do item manda pagar aqui. A união discriminada absorve isso com um
campo separado — `destinoTile: TileDeGrid` — e **sem** `destino: string`: assim
os 12 `predios.porId[…destino]` de hoje não compilam contra a tarefa nova, e o
compilador aponta cada lugar que precisa de ramo. Nada de `destino` com duas
interpretações.

**D4 — A origem da reserva é o armazém que o débito vai usar.** `debitarPedra`
varre `predios.ordem` e tira do primeiro armazém que tem; a tarefa reserva no
**mesmo** critério (helper compartilhado `armazemQuePagaAEstrada`). Reserva e
débito não podem divergir de armazém — é isso que garante "exatamente uma vez".
Distância não entra: o laborer não carrega a pedra.

**D5 — `PlaceRoad` cria a tarefa no próprio comando.** É o que torna a reserva
atômica no tick, como o item pede. `gerarTarefas` só cobre o buraco (tile
planejado que ficou sem tarefa depois de um cancelamento).

**Pergunta em aberto (interpretação conservadora aplicada):** o GDD não diz se
assentar consome tempo de martelo por tile ou é instantâneo ao chegar. Adotado:
**um ciclo de martelo por tile**, com o número em `data/buildings.json`
(`construcao`) — nunca literal em `.ts`. Registrar em `PROGRESS.md`.

---

## Estrutura de arquivos

- `src/sim/state.ts` — `estradasPlanejadas` no `GameState` e no estado inicial;
  `TarefaAssentarEstrada` na união; `TipoDeTarefa` derivado já a absorve.
- `src/sim/estradas.ts` — `ehPlanejada`, `canPlaceRoad` passa a recusar tile já
  planejado como "nada novo", `armazemQuePagaAEstrada`.
- `src/sim/jobs.ts` — `criarTarefaDeAssentamento`, elegibilidade, `modoDoTipo`
  alargado, ramo de tile em `portasDaTarefa`/`planoDaTarefa`/`custoDaTarefa`.
- `src/sim/reservas.ts` — a tarefa nova reserva 1 de `stone` na origem; vaga no
  destino não existe (tile não tem gaveta).
- `src/sim/systems/estradas.ts` — `aplicarPlaceRoad` (planta + tarefa, **sem
  debitar**), `aplicarDemolishRoad` (três conjuntos).
- `src/sim/systems/jobs.ts` — geração e saneamento da tarefa nova.
- `src/sim/systems/laborers.ts` — o ramo de assentamento.
- `data/delivery.json`, `data/buildings.json`, `tools/data-rules.js`.
- `tests/F18d-1b-*.test.ts`.

---

## A ordem das tarefas, e por que ela não é a óbvia

Virar a chave do `PlaceRoad` **cedo** deixaria a suíte vermelha da Tarefa 1 até a
Tarefa 4: hoje 10 arquivos de teste e o `tests/helpers/abertura.ts` (a abertura
inteira da Fase A, do aceite da F17) montam cenário **emitindo `PlaceRoad`** e
contando que o tile ligue no mesmo tick. Enquanto o laborer não souber assentar,
não há substituto honesto para essas asserções — e feature com suíte vermelha no
meio não é entregável em pedaços.

Por isso a máquina de assentar é construída **antes** da troca de comportamento,
e a troca (com a migração de todos os cenários) é **uma tarefa só**, a 4. Cada
tarefa termina verde e commitada.

**Medido nesta sessão:** `PlaceRoad` aparece em **27** pontos de `tests/`, em 10
arquivos, mais `tests/helpers/abertura.ts` e `tools/shots/` (estes últimos são da
F18d-2, não desta).

---

### Tarefa 1: `estradasPlanejadas` no estado (inerte)

**Arquivos:** `src/sim/state.ts`, `src/sim/estradas.ts`,
`src/sim/systems/estradas.ts`, `tests/F18d-1b-planta.test.ts`.

- [ ] **Passo 1:** teste que falha: `createInitialState` tem
      `estradasPlanejadas` vazio; `ehPlanejada` responde pelo tile; um estado com
      tile planejado **não** liga nada (`predioLigadoAoArmazem` `false`,
      `isConnected` `false`) e sobrevive ao JSON de ida e volta; e o índice da
      rede **não** muda de referência por causa dele.
- [ ] **Passo 2:** rodar; esperar vermelho por `estradasPlanejadas` inexistente.
- [ ] **Passo 3:** campo `readonly estradasPlanejadas: Readonly<Record<string,
      true>>` no `GameState`, `{}` no inicial, com o comentário dizendo que ele
      **não** entra no índice da rede; `ehPlanejada` em `sim/estradas.ts`.
- [ ] **Passo 4:** `aplicarPlaceRoad` fica **como está** (ainda planta de pé e
      debita) — a troca é a Tarefa 4. Suíte inteira verde.
- [ ] **Passo 5:** `npm run verify`; commit
      `feat(F18d-1b): o canteiro de estrada existe no estado, ainda inerte`.

### Tarefa 2: a tarefa `'assentar-estrada'` (destino é tile)

**Arquivos:** `data/delivery.json`, `tools/data-rules.js`, `src/sim/state.ts`,
`src/sim/jobs.ts`, `src/sim/reservas.ts`, `tests/F18d-1b-tarefa.test.ts`.

**Interfaces produzidas:**
```ts
export interface TarefaAssentarEstrada extends TarefaBase {
  readonly tipo: 'assentar-estrada';
  readonly estado: 'aberta' | 'reclamada';
  readonly mercadoria: string;      // sempre MERCADORIA_DA_ESTRADA
  readonly origem: string;          // armazem que reserva e vai pagar
  readonly destinoTile: TileDeGrid; // NAO ha `destino: string`
}
export function criarTarefaDeAssentamento(
  state: GameState, tile: TileDeGrid, dados?: GameData,
): { readonly state: GameState; readonly id: string } | null; // null: sem armazem com pedra
```

- [ ] **Passo 1:** teste que falha: a linha nova da escada existe em
      `delivery.json` com `"modo": "livre"`; `nivelDoTipo` dos **sete** níveis de
      hoje **não muda** (a lista inteira comparada de uma vez, lida do dado);
      `modoDoTipo('assentar-estrada') === 'livre'`; `elegivelParaTarefa` só
      aceita `laborer`; a tarefa reserva **1** de `stone` na origem
      (`disponivelNaOrigem` cai, `reservadoNaOrigem` sobe) e sobrevive ao JSON.
- [ ] **Passo 2:** rodar; vermelho.
- [ ] **Passo 3:** escada + schema + o tipo na união + `criarTarefaDeAssentamento`
      usando `armazemQuePagaAEstrada`; `reservas.ts` conta a mercadoria da tarefa
      nova na origem e **não** procura vaga no destino.
- [ ] **Passo 4:** verde; typecheck (aqui aparecem os ramos que faltam — anotar,
      não consertar ainda); commit.

### Tarefa 3: o laborer assenta um tile planejado, e o assentamento debita

**Arquivos:** `src/sim/systems/estradas.ts`, `src/sim/systems/jobs.ts`,
`tests/F18d-1b-tarefa.test.ts`.

- [ ] **Passo 1:** teste: `PlaceRoad` de 3 tiles cria **3** tarefas abertas e
      reserva 3 de pedra no mesmo tick; `canPlaceRoad` recusa com `'sem-pedra'`
      quando o que sobra já está reservado por tarefas anteriores (a reserva
      entra na conta de `pedraDisponivel` — provar com dois comandos seguidos);
      `gerarTarefas` recria a tarefa de um tile planejado que ficou sem nenhuma,
      e **não** duplica quando já existe.
- [ ] **Passo 2:** rodar; vermelho. **Passo 3:** implementar. **Passo 4:** verde.
- [ ] **Passo 5:** saneamento: tarefa cujo `destinoTile` não é mais planejado
      (virou estrada ou foi demolido) é **cancelada**, liberando a reserva;
      unidade morta reabre. Teste dos dois. Commit.

### Tarefa 4: a troca de comportamento do `PlaceRoad`, e a migração dos cenários

**Arquivos:** `src/sim/systems/laborers.ts`, `data/buildings.json`,
`tests/F18d-1b-laborer.test.ts`.

- [ ] **Passo 1:** teste do ciclo inteiro, sem tocar na FSM além dos cinco
      estados: laborer ocioso → `indo_a_obra` até o tile → `martelando` → o tile
      sai de `estradasPlanejadas` e entra em `estradas` → `ocioso`. No tick do
      assentamento: a pedra do armazém cai **exatamente 1** e a reserva
      desaparece (`reservadoNaOrigem` volta ao que era). `bensPorMercadoria`
      confere antes/depois: uma pedra some do mundo, e só uma.
- [ ] **Passo 2:** rodar; vermelho. **Passo 3:** implementar o ramo; o caminho
      até o tile usa `'livre'` **vindo de `modoDoTipo`**, nunca digitado.
- [ ] **Passo 4:** falhas com caminho de volta (§5 do CLAUDE.md): tile deixou de
      ser planejado no meio da viagem → `liberar` com motivo existente e a
      reserva devolvida; sem armazém com pedra na hora de assentar → a tarefa é
      liberada, não some pedra negativa. Teste de cada ramo.
- [ ] **Passo 5:** verde; invariantes (`violacoesDeInvariantes`,
      `violacoesDaFsmDoLaborer`, `bensPorMercadoria`) vazias em **todo** tick de
      uma corrida longa. Commit.

### Tarefa 5: `DemolishRoad` em três conjuntos

**Arquivos:** `src/sim/systems/estradas.ts`, `tests/F18d-1b-demolir.test.ts`.

- [ ] **Passo 1:** teste: um comando com os três tipos de tile de uma vez —
      de pé (devolve `floor(n × devolucaoAoDemolir)`, **contando só os de pé**),
      planejado (devolve **0**, sai de `estradasPlanejadas`, cancela a tarefa e
      libera a reserva), e nem um nem outro (no-op, sem evento).
- [ ] **Passo 2:** rodar; vermelho. **Passo 3:** implementar. **Passo 4:** verde.
- [ ] **Passo 5:** caso do laborer **a caminho** do tile demolido: a tarefa é
      cancelada e ele volta a `ocioso` no tick seguinte, sem reserva pendurada.
      Commit.

### Tarefa 6: o aceite, a evidência e o commit

**Arquivos:** `tests/F18d-1b-aceite.test.ts`, `PROGRESS.md`, `test-results.json`.

- [ ] **Passo 1:** um cenário só: desenha a rua que ligaria uma pedreira ao
      armazém. No tick do comando, `predioLigadoAoArmazem` é `false` e a pedra do
      armazém está **intacta**. Roda; quando o último tile é assentado,
      `predioLigadoAoArmazem` vira `true` e a pedra caiu **exatamente**
      `tiles × custoStonePorTile` — nem antes, nem duas vezes.
- [ ] **Passo 2:** `gravarEvidencia('F18d-1b', …)` com: o tick do comando (ligado
      `false`, pedra intacta), o tick de cada assentamento, o tick em que ligou, o
      total debitado contra o esperado do dado, e o saldo do `DemolishRoad` nos
      três conjuntos.
- [ ] **Passo 3:** `npm run verify`.
- [ ] **Passo 4:** abrir `test-output/F18d-1b.json` com Read e conferir contra o
      aceite escrito no `BUILD_PLAN.md`.
- [ ] **Passo 5:** `PROGRESS.md` — decisões D1–D5, a pergunta em aberto do tempo
      de assentamento e a interpretação conservadora adotada, e o que a F18d-2
      herda (o contrato do render já está na Nota do item dela).
- [ ] **Passo 6:** `test-results.json`: `"F18d-1b-estrada-canteiro": { "passes": true }`.
- [ ] **Passo 7:** commit `feat(F18d-1b): a estrada vira canteiro; o laborer assenta e paga`.
