# F20b — Fome: condição, dreno, comer na Bodega e morte

**Objetivo:** todo civil tem condição que drena; abaixo do limiar do dado ele vai à
Bodega, come e volta a trabalhar; a zero ele morre, e a morte não deixa prédio com
ocupante fantasma, tile de campo preso nem tarefa reclamada sem `release`.

**Arquitetura:** só `src/sim/`. Um módulo derivado puro (`sim/condicao.ts`, irmão de
`sim/bodega.ts`), um sistema novo (`sim/systems/fome.ts`, o `eat` que o cabeçalho de
`tick.ts` já anuncia), um tipo de tarefa fora da escada (`comer`, molde de `ocupar`) e
um portão no `reclamar`. Nenhum arquivo de `src/render/` ou `src/ui/`.

**Stack:** TypeScript estrito, Vitest. Nenhuma dependência nova.

**Spec:** `BUILD_PLAN.md:2137-2194` (item F20b). A F20a entregou a comida na Bodega.

## Restrições globais (CLAUDE.md, valem em toda tarefa)

- `sim/` não importa `phaser`, não toca `window`/`document`/`performance`, não usa
  `Math.random()` nem `Date.now()`.
- Todo número de balanceamento vem de `data/*.json`. Conversão para ticks **uma vez, no
  carregamento**, com `Math.round`.
- `GameState` serializável em JSON: nada de função, classe ou `Map`.
- FSM explícita em `unit.fsm` + `unit.fsmData`; sem `setTimeout`, sem async.
- Toda tarefa passa pelo JobBoard, com `claim` atômico que reserva e `release` em **todo**
  ramo de falha.
- Medida de relógio é evidência da sessão, nunca asserção (§8). O eixo é tick, contagem
  de unidade, contagem de mercadoria e ordem de tarefa.

## O que foi conferido no código ANTES de planejar

| Fato | Onde | Consequência |
|---|---|---|
| `condicao` chega ao carregador convertida: `ticksCondicaoCheia {civil, militar}` | `data/loader.ts:414-434` | o 12 000 não é digitado; `limiares` ainda é fração crua |
| `limiares {alertaVisual:0.35, civilVaiComer:0.50, morte:0.0}` sem leitor | `data/condition.json` | esta feature é a primeira leitora, junto com a F20c |
| `inn.comensaisSimultaneos: 8` sem leitor | `data/condition.json` | é o teto da vaga da tarefa `comer` |
| **Não há duração de refeição em dado nenhum** | grep em `data/` | `comendo` não pode ter duração inventada (D6) |
| `sanearOcupacao` já zera `ocupante` que não existe mais, e o cabeçalho cita "ocupante morto (F20)" | `systems/especialistas.ts:60-76` | o **caso 1 da morte já tem caminho**; o teste afirma, não reescreve |
| `'unidade-removida'` já é `MotivoDeLiberacao` de `sanearTarefas` | `systems/jobs.ts:142` | o saneamento é a rede de segurança; a morte libera explicitamente |
| `progresso` do ciclo mora no PRÉDIO (`Producao.progresso`), não na unidade | `state.ts:270-277` | o caso 2 da morte se responde sozinho: o progresso fica |
| `devolverMercadorias(predios, quantidades, destino)` devolve à `saida` de um armazém | `sim/deposito.ts:20` | é o caminho que a demolição usa; a carga do morto usa o mesmo |
| O `default` do `switch (u.fsm)` **lança** nos três sistemas de família | `systems/serfs.ts:335` e irmãos | estado novo de FSM exige pular a unidade nesses três laços (D12) |
| `podeReclamar` recebe o **tipo** da unidade, não a unidade | `jobs.ts:130` | o portão da fome não cabe lá; cabe no `reclamar` (D9) |
| `caminhoAtePredioCompleto` já busca no modo `'livre'` | `jobs.ts:486-493` | ir comer não depende de estrada, sem decisão nova |
| `civis.tipos` tem `vaiAoInn: true` **só** no `recruit`, e **nenhum leitor** | `data/units.json`, grep vazio | não vira regra aqui: todo tipo de `civis.tipos` vai à Bodega, o que **concorda** com a bandeira |
| Unidade nasce em dois lugares | `state.ts:985` e `systems/escolas.ts:160` | os dois precisam semear `condicao` |

## Decisões desta feature (todas para o PROGRESS.md, marcadas para revisão)

- **D1 — a condição é `ticksRestantes`, inteiro, em `Unidade.condicao`.** Nunca fração
  acumulada: somar 0,0000833 doze mil vezes põe erro de arredondamento no determinismo.
  A fração de que o GDD fala é **derivada na leitura** (`condicao / ticksCheia`).
- **D2 — os limiares viram tick no CARREGADOR.** `condicao.ticksNoLimiar.{civil,militar}`
  com `Math.round(limiar × ticksCheia)`, uma vez, como manda a §5. Nenhum sistema
  multiplica fração por duração em tempo de execução.
- **D3 — só civil drena.** Militar não existe hoje e **não tem como comer**: `regraMilitar`
  diz que ele não vai à Bodega e depende do comando `Feed`, que é da F17+. Drenar quem não
  tem recurso seria travamento de regra, não balanceamento. O campo existe para todos; o
  dreno pergunta ao dado quem é civil (`unidades.civis.tipos`), como `populacaoPorGrupo`.
- **D4 — comer passa pelo JobBoard.** Tipo `comer`, **fora** da escada de `delivery.json`
  (como `ocupar`, `construir` e `colher`): quem reclama não disputa carga com serf nenhum.
  A vaga é `inn.comensaisSimultaneos`, do dado. A tarefa **só nasce em Bodega que TEM
  comida** — o mesmo portão que na F20a impediu tarefa para `wine`: ninguém caminha para
  encontrar prateleira vazia.
- **D5 — o assento é reservado; a comida, não.** O `claim` reserva a vaga no destino (é o
  que a vaga do `ocupar` já faz). A comida não é reservada porque uma refeição consome um
  **conjunto variável de tipos** (D7) e reservar uma unidade de um tipo seria uma reserva
  que mente sobre o que vai ser consumido. O que cobre a corrida é o portão do gerador
  acima mais o consumo **atômico na chegada**: quem chega e não acha comida não espera —
  volta a `ocioso` no mesmo tick (e morre, se for o caso, que é o aceite do cenário sem
  comida).
  - **Emenda (operador, 2026-09-30, BUG-Y — viagem inútil para comer, opção (A)):** a D5
    reservava o assento; passa a garantir uma refeição via `refeicoesGarantidas`. Uma
    refeição tira no máximo uma unidade de cada tipo (D7), então a prateleira serve pelo
    menos `max(quantidade de cada tipo)` refeições. O gerador não abre mais assentos que
    isso, e o `claim` recusa quando os comensais a caminho já cobrem esse piso. Não mente
    sobre o tipo, que era a objeção acima: reserva uma refeição, não uma broa. Medido antes
    do conserto: 13 de 13 viagens perdidas na vila da calibração eram prateleira vazia na
    chegada. Plano: `docs/planos/2026-10-01-BUG-Y-viagem-inutil-para-comer.md`.
- **D6 — a refeição é de um tick.** Não existe duração de refeição em `data/`, e inventar
  número de balanceamento em `.ts` é proibido. `comendo` existe como estado do GDD e dura
  um tick: chega, come, e no tick seguinte está `ocioso`.
- **D7 — cada tipo de comida entra na refeição no máximo uma vez**, na ordem do dado, até
  a condição encher. É a leitura já escrita no item da fila e a única que o dado sustenta:
  o máximo de um tipo só é 0,60 (`sausages`) e `loaves + sausages` dá exatamente 1,00.
  `regraCivil` continua **prosa sem leitor** — o número já responde, e registro isso em
  vez de transformar prosa em campo.
- **D8 — o especialista com fome VAGA o prédio.** `ocupante` volta a `null`, ele come e
  reocupa pela tarefa `ocupar` que existe desde a F14. **Não** implemento "ocupado, mas
  fora": isso é a perna caríssima da F-T3, que tem três casos de aceite próprios para ela.
  O progresso do ciclo mora no prédio, então nada se perde. Consequência aceita e honesta:
  enquanto ele come, o prédio está **de fato** sem trabalhador.
- **D9 — o portão da fome mora no `reclamar`.** Unidade abaixo de `civilVaiComer` só
  reclama tarefa `comer`; motivo novo `'unidade-com-fome'`. Um site, atômico, dentro do
  tick — e **nenhuma FSM de família muda por causa disso**: o `passoOcioso` de cada uma
  simplesmente não consegue mais reclamar.
- **D9-revisado (medido em 2026-09-25, durante a execução) — o portão recusa o
  ASSENTO, nunca o trabalho.** A metade "quem tem fome só reclama `comer`" foi escrita,
  rodada e **derrubada por medição**: sem Bodega no cenário, a cadeia do pão congela
  inteira no tick em que o primeiro civil cruza `civilVaiComer` (serf ocioso para sempre,
  tarefa aberta para sempre, **32 pães entregues em vez de 68**) — espera indefinida, não
  balanceamento. O que ficou: tarefa `comer` só é reclamável por quem tem fome (motivo
  `'unidade-invalida'`, que é o que "esta unidade não é elegível a ESTA tarefa" já
  significa), e o motivo novo `'unidade-com-fome'` **não existe**. A prioridade de comer
  vem da ORDEM DO TICK — `sistemaDaFome` roda antes das três famílias —, não de um portão.
  O guarda permanente está em `tests/F20b-fome.test.ts`: com fome e sem Bodega, o estado
  inteiro menos `condicao` é **idêntico** ao da mesma vila saciada.
- **D10 — a carga do serf morto volta ao armazém**, por `devolverMercadorias`, o mesmo
  caminho que a demolição usa para o estoque interno. Conservação de bens é invariante do
  projeto e a precedente existe. **Item no chão é mecânica nova** (GDD §6.2) e não a
  invento. Sem armazém ligado, a carga se perde — e isso está no teste, não implícito.
- **D11 — a morte libera explicitamente a tarefa reclamada**, não fica só na rede do
  `sanearTarefas` do tick seguinte: "toda tarefa reclamada precisa ter caminho de volta"
  (§5). O saneamento continua como segunda linha, e o teste afirma reserva zerada **no
  mesmo tick** da morte.
- **D12 — `ehEstadoDeFome` é predicado único.** Os três laços de família pulam a unidade
  em `indo_comer`/`comendo`; o `default` que lança continua intacto para estado
  desconhecido de verdade.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/sim/condicao.ts` (novo) | derivados puros: quem é civil, condição cheia, fração, limiares em tick, `ehEstadoDeFome`, a refeição (`refeicaoNaBodega`) |
| `src/sim/systems/fome.ts` (novo) | o sistema: dreno, morte, FSM `indo_comer`/`comendo`, a saída para comer |
| `src/sim/state.ts` | `Unidade.condicao`, `TarefaComer`, semeadura em `criarUnidades` |
| `src/sim/data/types.ts` + `data/loader.ts` | `ticksNoLimiar` derivado no carregamento |
| `src/sim/jobs.ts` | `criarTarefaComer`, `tarefasDeComerEmOrdem`, `reclamarMelhorComer`, portão no `reclamar` |
| `src/sim/systems/jobs.ts` | `gerarTarefasDeComer`, `motivoDoDestino` do tipo novo |
| `src/sim/systems/escolas.ts` | condição cheia na unidade recém-nascida |
| `src/sim/systems/{serfs,laborers,especialistas}.ts` | pular os estados de fome |
| `src/sim/tick.ts` | `sistemaDaFome` depois de `sanearTarefas`, antes dos serfs |
| `tests/F20b-fome.test.ts` (novo) | o aceite |
| `tests/helpers/fome-cenario.ts` (novo) | cenários: com Bodega abastecida, sem comida, e o de morte |

## Tarefa 1 — `condicao.ts`, o campo e os limiares em tick

**Arquivos:** criar `src/sim/condicao.ts`; modificar `src/sim/data/types.ts`,
`src/sim/data/loader.ts`, `src/sim/state.ts`, `src/sim/systems/escolas.ts`.

- [ ] **Passo 1 — o teste que falha.** Em `tests/F20b-fome.test.ts`: toda unidade do
  estado inicial nasce com `condicao === ticksCondicaoCheia.civil`; `fracaoDeCondicao`
  devolve 1; `ticksNoLimiar.civil.civilVaiComer === Math.round(0.50 × ticksCheia)`.
- [ ] **Passo 2 — rodar e ver falhar** (`condicao` não existe no tipo).
- [ ] **Passo 3 — implementar.** `CondicaoData.ticksNoLimiar` derivado no loader com
  `Math.round`; `Unidade.condicao: number`; semeadura nos dois nascimentos.
- [ ] **Passo 4 — rodar verde, `npm run typecheck`.**

## Tarefa 2 — a tarefa `comer` e a ida à Bodega

**Arquivos:** `state.ts` (`TarefaComer` + tabelas), `jobs.ts`, `systems/jobs.ts`,
`systems/fome.ts` (novo), `tick.ts`, os três sistemas de família, o helper de invariantes.

- [ ] **Passo 1 — o teste que falha.** Cenário: Bodega com comida e um serf com
  `condicao` abaixo de `civilVaiComer`. Depois de N ticks ele está `comendo` na porta da
  Bodega, e no tick seguinte `ocioso` com `condicao` restaurada; o estoque da Bodega caiu
  **uma** unidade de cada tipo consumido.
- [ ] **Passo 2 — rodar e ver falhar.**
- [ ] **Passo 3 — implementar.** `TarefaComer` (destino = Bodega), vaga
  `comensaisSimultaneos − tarefas de comer naquele destino`; gerador só para Bodega com
  comida; `reclamarMelhorComer`; FSM `indo_comer → comendo → ocioso`; `refeicaoNaBodega`
  aplica D7. Portão no `reclamar` (D9).
- [ ] **Passo 4 — rodar verde.** `violacoesDeInvariantes` limpo em todo passo.

## Tarefa 3 — o dreno, o alerta e a saída para comer

**Arquivos:** `systems/fome.ts`.

- [ ] **Passo 1 — o teste que falha.** Um civil parado perde 1 de `condicao` por tick
  (medido contra o tick 0, não contra zero); cruzado `civilVaiComer`, ele deixa de
  reclamar carga (motivo `'unidade-com-fome'`) e passa a `indo_comer`; o especialista
  `trabalhando` vaga o prédio no mesmo tick (`ocupante === null`) e o `progresso` do ciclo
  **não** volta a zero.
- [ ] **Passo 2 — rodar e ver falhar.**
- [ ] **Passo 3 — implementar.**
- [ ] **Passo 4 — rodar verde.**

## Tarefa 4 — a morte e os três casos de "a unidade sumiu"

**Arquivos:** `systems/fome.ts`, `state.ts` (evento).

- [ ] **Passo 1 — os testes que falham.** (a) civil sem Bodega chega a `condicao === 0`,
  é removido de `unidades`, e o evento `unit-starved` sai no mesmo tick; (b) **caso 1** —
  o ocupante morre e `predio.ocupante` fica `null` no MESMO tick (via `sanearOcupacao`);
  (c) **caso 2** — o produtor morre no meio do ciclo com tile de colheita reclamado: a
  tarefa `colher` sai do quadro, o tile volta ao mercado (`tilesReservadosParaColheita`
  não o contém) e o `progresso` fica no prédio; (d) **caso 3** — o serf morre com carga: a
  carga volta à `saida` do armazém e o total da mercadoria no mundo não muda.
- [ ] **Passo 2 — rodar e ver falhar.**
- [ ] **Passo 3 — implementar** a remoção da unidade com `liberar` explícito e
  `devolverMercadorias`.
- [ ] **Passo 4 — rodar verde**, `violacoesDeInvariantes` limpo no tick da morte.

## Tarefa 5 — os cenários longos, e a prova de que a fome é real

**Arquivos:** `tests/F19-*.test.ts`, `tests/F19b-*.test.ts` (só a montagem do cenário).

- [ ] **Passo 1 — medir o estrago primeiro.** Rodar as duas suítes e registrar o que
  quebra. Sem medida não há como saber se a adaptação é Bodega ou só abastecimento.
- [ ] **Passo 2 — adaptar** pondo uma Bodega abastecida no cenário longo (a cadeia deles
  produz a comida), e afirmar o que o item pede: **população viva no fim**. Cadeia que
  continuasse produzindo com todos mortos seria a prova de que o dreno não chegou.
- [ ] **Passo 3 — cenário sem comida**: a população cai a zero e o evento sai. É o par
  do anterior, e é o que prova que a sobrevivência do outro não é acidente.

## Tarefa 6 — evidência, PROGRESS e commit

- [ ] `test-output/F20b.json` com: ticks de condição cheia, tick da primeira morte,
  população viva no cenário longo e no cenário sem comida, estoque da Bodega antes e
  depois da refeição, e a lista de decisões.
- [ ] `PROGRESS.md`: verificado × decisões (D1–D12).
- [ ] `npm run verify`, `test-results.json`, commit `feat(F20b): ...`.

## Riscos

1. **O cenário longo muda de número.** A Bodega puxa comida (nível 1, prioridade máxima)
   e desvia pão da cadeia; asserção de estoque da F19/F19b pode mudar de valor. Conserto
   legítimo: a asserção passa a medir o **acumulado entregue**, não o saldo — a regra do
   `medicao-contra-a-linha-de-base`. Proibido: afrouxar o número até passar.
2. **Serf preso comendo enquanto a obra espera.** A fome tem prioridade sobre carga por
   construção (D9), e isso pode parar uma obra. É balanceamento, vai para o
   `BALANCE_LOG.md`, não vira exceção no código.
3. **Reocupação do prédio por outro especialista** enquanto o faminto come. É consequência
   aceita de D8, e o caminho de volta existe (a vaga volta ao quadro). Se o operador quiser
   posse durante a refeição, isso é a F-T3.
4. **12 000 ticks por teste é caro.** Os cenários de fome semeiam `condicao` baixa direto
   no estado (fixture), como o teste da escola semeia fila. O caminho real de 12 000 ticks
   roda **uma vez**, no cenário longo da Tarefa 5.

## Emenda (operador, 2026-09-30): `inn.comensaisSimultaneos` sai do dado — opção (A)

Commit próprio, antes do código (CLAUDE.md §6, item 10). Medido na leva 2 (BALANCE_LOG,
2026-09-30): desde a emenda do BUG-Y na D5, o teto de comensais é `min(assentos,
refeicoesGarantidas)`. A garantia fica ≤ `inn.estoquePorTipoDeComida` (5), e o assento (8) nunca
limita. O mesmo valeria para os 6 do KaM (`src/houses/KM_HouseInn.pas:11`), porque aqui a
refeição dura um tick (D6).

- **O que muda:** a D4 ("a vaga é `inn.comensaisSimultaneos`") passa a "a vaga é
  `refeicoesGarantidas`". O campo sai de `data/condition.json`. O claim e o gerador leem só a
  garantia. A invariante de assentos (`tests/helpers/jobs-invariantes.ts`) passa a ser
  "comensais reservados ≤ refeições garantidas + os que já estão a caminho de uma Bodega que
  esvaziou". Na prática, ela é ≤ o teto de comida por tipo, que é o que o dado garante.
- **Aceite:**
  1. `data/condition.json` não tem `inn.comensaisSimultaneos`. `validate:data` e `typecheck`
     verdes, e nenhum `.ts` o lê (o tipo vem do JSON; o compilador acusa leitor sobrando).
  2. F20b-4 (o teto de comensais): com mais famintos que o teto de comida, os comensais reservados
     e os `indo_comer` nunca passam de `refeicoesGarantidas` no tick da saída, e chegam a ela.
     O caso "assento abaixo da garantia" sai, porque o assento não existe mais.
  3. BUG-Y aceites 2 a 5 inalterados e verdes.
  4. Não-regressão: F20b inteiro, F-CAL-a sem fome, invariantes.
- A opção (B) (refeição com duração e 6 assentos, como no KaM) vai para o `IDEIAS.md`.
