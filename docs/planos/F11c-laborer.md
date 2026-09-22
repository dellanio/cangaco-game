# F11c — FSM do Laborer (construção em etapas) — Plano de implementação

> **Para o executor:** use `superpowers:executing-plans` tarefa a tarefa. **Não**
> use `subagent-driven-development` nem `dispatching-parallel-agents` — proibidos
> pelo CLAUDE.md §11. Passos usam checkbox (`- [ ]`).

**Destino final:** este documento vai para `docs/planos/F11c-laborer.md` assim que
o operador aprovar (é o que a instrução pediu; durante o plan mode só este arquivo
pode ser escrito).

---

## Context

A F11b entregou o JobBoard com tarefas `'construir'`, mas **ninguém as consome**:
os 2 laborers do cenário inicial nascem `ocioso` e nenhum sistema os toca. A obra,
por sua vez, tem um só campo (`faltam`) — não há nivelamento, não há martelada, e
uma obra **nunca vira `'completo'` em nenhum caminho de código**. Isso bloqueia a
F12 (desbloqueio por conclusão), cujo aceite exige "conduzir a obra até `'completo'`
pelo `step()`, sem injetar prédio pronto".

A F11c fecha esse arco: o laborer reclama a vaga de construção, nivela o terreno,
espera o material que o serf traz, martela até `hp === def.hp`, e o prédio nasce.
É a **única feature da fila com permissão explícita** (BUILD_PLAN.md:195-201) para
tocar `src/sim/` e `src/render/` no mesmo commit.

**Resultado pretendido:** um Quarry plantado pela UI sobe sozinho até ficar de pé,
com evidência headless (`test-output/F11c.json`) e três screenshots dos estágios.

---

## Decisões do operador (replicadas — não reabrir)

1. O laborer reclama as tarefas `'construir'` pelo JobBoard. Nada de varrer
   `predios.ordem`, nada de campo de posse em `Obra`.
2. Vários laborers por obra, até `laborersMaximosPorObra`. **Nivelamento e `hp`
   são da obra**, compartilhados por quem trabalha nela.
3. Estágios visuais derivados do `hp`, em `render/`, função pura: `hp = 0` é
   marcação, `0 < hp < total` é madeira, completo é prédio.
4. A obra vira `'completo'` **sem** chamar `registrarTipoConstruido` (isso é da
   F12). Emitir o evento `building-completed` para a F12 consumir.
5. Portão "obra já nivelada" em `gerarTarefas`, **só para as tarefas de material**.
6. **Obra trabalhável** (correção do operador na aprovação deste plano): o laborer
   só reclama, e só permanece, onde há o que fazer — senão a partida trava em
   silêncio. Ver a seção da Arquitetura; vale nas Tasks 4 e 5.

Aproveitamentos autorizados: campo de nivelamento em `Obra` com alvo derivado da
área do footprint; `completarObra`; extração do movimento para
`sim/units/movimento.ts`; teto de HP por `entregues × hpPorMaterialEntregue`;
ajuste de horizonte nos testes da F10.

---

## Estado verificado do código (base do plano)

Tudo abaixo foi confirmado por leitura nesta sessão.

| Fato | Onde |
|---|---|
| `Obra` tem **só** `faltam`; comentário diz "a F11 acrescenta o que precisar" | `src/sim/state.ts:137-149` |
| `capacidadeParaTipo` / `estoqueParaTipo` são **privadas** | `src/sim/state.ts:331`, `:345` |
| `GameEvent` tem 6 membros; **não existe** `building-completed` | `src/sim/state.ts:20-67` |
| `andar`, `noTile`, `chegou`, `dadosDaFsm`, `comUnidade`, `ficarOcioso` são privados do serf | `src/sim/systems/serfs.ts:45-96` |
| `tarefasEmOrdem` devolve **só** `TarefaMaterialParaObra`; `reclamarMelhor` a usa → **um laborer nunca acha tarefa hoje** | `src/sim/jobs.ts:330-357` |
| `reclamar` de `'construir'` **não checa caminho** (comentário: "a F11c decide") | `src/sim/jobs.ts:244-250` |
| `gerarTarefas`: laço de material (com portão de estrada/armazém) e laço de construir (sem portão) | `src/sim/systems/jobs.ts:185-202` |
| Ordem do `step`: comandos → `sanearTarefas` → `sistemaDosSerfs` → `gerarTarefas`; retorno montado **campo a campo** | `src/sim/tick.ts:62-83` |
| `caixaDeTipo(tipo, dados) → { x0,y0,x1,y1 }` (meio-aberto) | `src/sim/footprint.ts:18` |
| `custoDoPredio(def)` vive em `systems/build.ts` | `src/sim/systems/build.ts:10-12` |
| `tilesDaPorta` = borda sul inteira (não filtra estrada); `portasDeEstrada` filtra | `src/sim/estradas.ts:205-216`, `jobs.ts:158` |
| `posicaoDaUnidade` é genérica por tipo — serve ao laborer sem mudança | `src/sim/selectors.ts:234` |
| `registrarTipoConstruido` existe e **ninguém chama** (é da F12) | `src/sim/desbloqueio.ts:36` |

**Dado — nada novo a criar.** `data/buildings.json:35-43` já traz
`hpPorMaterialEntregue: 50`, `hpPorMartelada: 5`, `laborersMaximosPorObra: 4`,
`segundosPorMartelada_base: 1.0`, `segundosNivelamentoPorTile_base: 2.0`. O loader
já converte e expõe `ticksPorMartelada` e `ticksNivelamentoPorTile`, e **nenhum dos
dois tem consumidor hoje** (`src/sim/data/types.ts:30-37`, `loader.ts:100-117`).

Com `tickHz: 10` e escala `construcao: 2.0`:
- **martelada = 5 ticks**; **nivelamento = 10 ticks por tile**.
- Quarry (`tamanho [3,2]`, 3 timber + 2 stone, hp 250): **6 tiles → 60 ticks** de
  nivelamento; **50 marteladas → 250 ticks** de martelada.

---

## Arquitetura

### FSM canônica (GDD.md:339-342 — não inventar estado)

```
ocioso → indo_a_obra → nivelando → esperando_material → martelando → ocioso
```

`esperando_material` é estado real e visível: o laborer fica parado na obra.
Um `fsm` fora desta lista é **erro** (save corrompido), como no serf.

### As três grandezas derivadas (nunca guardadas no estado)

```
alvoDeNivelamento(obra) = área do footprint × ticksNivelamentoPorTile
entregues(obra)         = Σ_m (custo[m] − faltam[m])          // sobre mercadorias
tetoDeHp(obra)          = min(entregues × hpPorMaterialEntregue, def.hp)
```

`Obra` ganha **um** campo: `nivelamento: number` (ticks já acumulados). Monotônico
— nunca decresce, por isso `obraNivelada` nunca fica retroativamente falso e
`sanearTarefas` não precisa de ramo novo por causa do portão.

### Obra trabalhável — a regra que impede a partida de travar em silêncio

Sem esta regra existe um soft-lock, e é o **erro mais provável do iniciante**:
plantar mais do que pode pagar. Uma obra que espera material que nunca vai chegar
(sem estoque, sem estrada) prende o laborer em `esperando_material` para sempre; a
obra vizinha — que *teria* material — nunca é nivelada; e como o portão da Task 6
exige nivelamento, tarefa de material nunca nasce para ela. A partida para, sem
erro, sem aviso.

Regra **derivada, sem estado novo**:

```
obraTrabalhavel(state, predioId) =
     !obraNivelada(obra)                          // há o que nivelar
  || obra.hp < tetoDeHp(obra)                     // há o que martelar
  || existe tarefa de material para ela           // material a caminho
     em 'aberta' | 'reclamada' | 'carregando'
```

Se nenhuma das três vale, não há nada que o laborer possa fazer ali — e ele **não
pode ficar**. Isso não contraria o GDD.md:341-342: `esperando_material` continua
sendo espera real e visível **enquanto houver material a caminho**. O que a regra
corta é a espera por material que não existe.

### Onde o laborer fica

Nos **tiles da porta** (`tilesDaPorta`, borda sul), como o serf — mas andando em
modo `'livre'`, não `'estrada'`: o laborer não carrega nada e precisa chegar à obra
**antes** de existir estrada ou material. É isso que permite nivelar primeiro.

### Ordem no tick

```
comandos → sanearTarefas → sistemaDosSerfs → sistemaDosLaborers → gerarTarefas
```

Laborers **depois** dos serfs e **antes** de `gerarTarefas`: o nivelamento que
termina neste tick já abre a tarefa de material no mesmo tick.

---

## Global Constraints

- `src/sim/` não importa `phaser`, não toca `window`/`document`/`canvas`.
- Nenhum número de balanceamento novo em `.ts` — tudo de `data/buildings.json`.
- `src/render/` não importa `../sim/data` fora dos dois funis (`mapa.ts`,
  `predios.ts`) — travado por `tests/F04-grid-ortogonal.test.ts:120-131`.
- `src/render/grid.ts` continua com **zero imports** (mesmo teste).
- `registrarTipoConstruido` **não** é chamado (é da F12).
- Definition of Done do CLAUDE.md §7, incluindo screenshot (esta feature muda a
  tela).

---

## Tarefas

### Task 0 — branch

```bash
git status                 # working tree limpo
git switch -c F11c
```

---

### Task 1 — `sim/obra.ts`: as grandezas derivadas

**Files:** criar `src/sim/obra.ts`; modificar `src/sim/systems/build.ts`;
criar `tests/F11c-laborer.test.ts`.

**Produz:** `custoDoPredio` (movido de `build.ts` — segundo consumidor agora
existe), `alvoDeNivelamento`, `obraNivelada`, `entreguesNaObra`, `tetoDeHp`,
`hpTotalDoTipo`, `obraTrabalhavel`.

```ts
export function alvoDeNivelamento(tipo: string, dados: GameData = gameData): number {
  const caixa = caixaDeTipo(tipo, dados);          // footprint.ts:18, meio-aberto
  const area = (caixa.x1 - caixa.x0) * (caixa.y1 - caixa.y0);
  return area * dados.construcao.ticksNivelamentoPorTile;
}
export function obraNivelada(predio: PredioEmObra, dados?: GameData): boolean
export function entreguesNaObra(predio: PredioEmObra, dados?: GameData): number
export function tetoDeHp(predio: PredioEmObra, dados?: GameData): number

/** Há algo que um laborer possa fazer nesta obra? Ver "Obra trabalhável".
 *  Precisa do `state` inteiro: a terceira cláusula olha o quadro de tarefas. */
export function obraTrabalhavel(state: GameState, predioId: string, dados?: GameData): boolean
```

**Teste (vermelho primeiro):** Quarry → `alvoDeNivelamento === 60`; obra com
`faltam {timber:3, stone:2}` → `entregues 0`, `teto 0`; com `faltam {}` →
`entregues 5`, `teto 250`; o teto nunca passa de `def.hp`.

**Teste de `obraTrabalhavel`, uma cláusula por vez:** obra não nivelada e sem
tarefa nenhuma → `true`; nivelada, `hp < teto`, sem tarefa → `true`; nivelada,
`hp === teto`, com tarefa de material `'carregando'` → `true`; nivelada,
`hp === teto`, **sem** tarefa de material → `false`; e `false` volta a `true`
assim que uma tarefa de material nasce para ela.

`systems/build.ts` passa a importar `custoDoPredio` de `../obra` (corpo idêntico).

---

### Task 2 — `Obra.nivelamento`, `completarObra`, evento `building-completed`

**Files:** `src/sim/state.ts`, `src/sim/systems/build.ts`,
`tests/helpers/jobs-cenario.ts`, `tests/F11c-laborer.test.ts`.

1. `Obra` ganha `readonly nivelamento: number` — ticks acumulados. Comentário
   substitui o "deliberadamente fora" de `state.ts:145-147`.
2. `GameEvent` ganha o 7º membro:
   ```ts
   | { readonly type: 'building-completed'; readonly predio: string; readonly tipo: string }
   ```
   com comentário dizendo que a **F12** o consome para `registrarTipoConstruido`.
3. `state.ts` exporta a transição, que é onde as privadas já moram:
   ```ts
   /** A obra de pé. Reusa `capacidadeParaTipo`/`estoqueParaTipo` (privadas aqui)
    *  — é o que o contrato da F07 previa. NÃO desbloqueia nada: F12. */
   export function completarObra(predio: PredioEmObra, dados: GameData = gameData): PredioCompleto
   ```
   Preserva `id`, `tipo`, `gx`, `gy`, `hp`; nasce com estoque vazio.
4. `systems/build.ts` cria a obra com `nivelamento: 0`.
5. `comObra` (fixture) ganha o parâmetro — **ver Task 8 para o default**.

**Teste:** round-trip JSON de uma obra com `nivelamento`; `completarObra` de um
`quarry` devolve `estado: 'completo'` com `capacidade`/`estoque` do tipo e sem
`obra`; um `storehouse` completado recebe capacidade do armazém.

---

### Task 3 — extrair o movimento para `sim/units/movimento.ts`

**Files:** criar `src/sim/units/movimento.ts`; modificar
`src/sim/systems/serfs.ts`.

Mover **sem mudar corpo** (`serfs.ts:45-96`): `dadosDaFsm`, `noTile`, `ocioso`,
`ficarOcioso`, `comUnidade`, `andar`, `chegou`. `serfs.ts` passa a importá-las.

É o aproveitamento que o PROGRESS.md:134-135 previa ("extrair **lá**, quando
houver o segundo consumidor"). **Sem teste novo:** a evidência é a suíte F10
inteira continuar verde — refatoração pura. Commit separado, para o diff ficar
legível.

---

### Task 4 — o laborer acha e reclama tarefa (`sim/jobs.ts`)

**Files:** `src/sim/jobs.ts`, `tests/F11c-laborer.test.ts`.

Hoje `reclamarMelhor` → `tarefasEmOrdem` → filtra só material. **Um laborer nunca
acha nada.** Duas adições irmãs, não uma generalização:

```ts
/** As `'construir'` abertas na ordem de escolha do laborer: `(custo do caminho
 *  A* a pé até a porta, numero)`. SEM nível — `'construir'` não está na escada
 *  de `delivery.json` (decisão do operador, F11b).
 *  PULA obra não trabalhável: não adianta ir para onde não há o que fazer. */
export function tarefasDeConstrucaoEmOrdem(state, unidadeId, dados?): TarefaConstruir[]

export function reclamarMelhorConstrucao(state, unidadeId, dados?): ResultadoDoClaimMelhor
```

E `reclamar` fecha **dois** buracos no ramo `'construir'` — o caminho, que a F11b
deixou escrito, e a obra sem trabalho:

```ts
} else {
  if (vagaDeConstrucao(state, tarefa.destino, dados) < 1) return { ok:false, motivo:'destino-sem-vaga' };
  // F11c: agora HÁ consumidor, então o claim checa caminho — como o F10 fez
  // para o serf. Modo 'livre': o laborer não carrega nada e precisa chegar
  // ANTES de existir estrada (GDD §5.1: ele nivela primeiro).
  if (caminhoAteAObra(state, tarefa.destino, unidadeId, dados) === null)
    return { ok:false, motivo:'sem-caminho' };
  // O portão vive AQUI, e não só na ordenação, para que o laborer não reclame,
  // largue e reclame a mesma obra a cada tick.
  if (!obraTrabalhavel(state, tarefa.destino, dados)) return { ok:false, motivo:'destino-sem-trabalho' };
}
```

`MotivoDeRecusaDoClaim` (`jobs.ts:43-50`) ganha `'destino-sem-trabalho'` — os
motivos existentes não descrevem isto: não falta vaga, não falta caminho, não
falta recurso na origem; falta **trabalho no destino**. Usar um motivo alheio
esconderia a causa no log de `task-released`.

**Teste:** laborer numa ilha sem caminho → `'sem-caminho'`; laborer com caminho →
`ok`; obra nivelada, no teto, sem tarefa de material → `'destino-sem-trabalho'`,
e `tarefasDeConstrucaoEmOrdem` nem a lista; `tarefasDeConstrucaoEmOrdem` ordena
pela obra mais perto e desempata por `numero`; um serf continua recusado com
`'unidade-invalida'`.

---

### Task 5 — `sistemaDosLaborers` (o coração)

**Files:** criar `src/sim/systems/laborers.ts`; modificar `src/sim/tick.ts`;
`tests/F11c-laborer.test.ts`.

```ts
export function sistemaDosLaborers(state: GameState, dados: GameData = gameData): ResultadoDeSistema
```

Varre `state.unidades.ordem`, pula `u.tipo !== TIPO_QUE_CONSTROI`. Dobra sequencial
sobre o estado (é o que faz N laborers na mesma obra somarem no mesmo tick).
`default:` do switch **lança** com o `fsm` desconhecido, como o serf.

| estado | o que faz |
|---|---|
| `ocioso` | `reclamarMelhorConstrucao`; se ok, planeja o caminho até `tilesDaPorta` em modo `'livre'` e vai para `indo_a_obra`. Sem tarefa: fica parado. |
| `indo_a_obra` | Tarefa sumiu → `ficarOcioso`. Próximo tile deixou de ser `tileAndavel(...,'livre')` → replaneja; sem plano → `liberar('pedido-da-unidade')` + ocioso. `andar`; `chegou` → decide entre `nivelando` / `esperando_material` / `martelando`. |
| `nivelando` | `obra.nivelamento += 1` (limitado ao alvo). Ao atingir o alvo, reavalia. |
| `esperando_material` | Parado na obra. Se `hp < tetoDeHp` → `martelando`. Senão, se a obra **deixou de ser trabalhável** → `liberar('pedido-da-unidade')` + `ocioso`. Senão **fica** — material a caminho. **É o único estado que libera.** |
| `martelando` | `progresso += 1`; ao chegar em `ticksPorMartelada`, `hp += hpPorMartelada` (limitado a `def.hp`) e zera `progresso`. Se `hp >= def.hp` → **completa** (abaixo). Senão, se `hp >= tetoDeHp` → `esperando_material`. |

**Reavaliação (função única, usada ao sair de `indo_a_obra`, `nivelando` e
`martelando`) — ela NUNCA libera:** obra não nivelada → `nivelando`; nivelada e
`hp < tetoDeHp` → `martelando`; nivelada e sem teto → `esperando_material`,
**sempre**, sem consultar `obraTrabalhavel`.

Isto é ordem, não estilo. A reavaliação roda **antes** de `gerarTarefas` no mesmo
tick (ver "Ordem no tick"). Uma obra que acabou de ficar nivelada ainda não tem
tarefa de material — ela só nasce logo adiante, em `gerarTarefas`. Se a
reavaliação consultasse `obraTrabalhavel` nesse instante, a obra pareceria morta,
o laborer largaria a tarefa e a reclamaria de novo no tick seguinte: **toda obra
que termina de nivelar geraria uma liberação espúria por laborer**, exatamente o
laço `task-released` ↔ `claim` que o teste de anti-travamento conta.

**A saída por obra não trabalhável fica só no handler de `esperando_material`**,
que roda no tick seguinte — depois de `gerarTarefas` ter tido a chance de criar a
tarefa de material. Nesse ponto, "sem tarefa de material" é informação verdadeira.

`'pedido-da-unidade'` está em `MOTIVOS_QUE_REABREM` (`jobs.ts:41`), então a tarefa
**reabre** em vez de ser cancelada: assim que a obra voltar a ser trabalhável — o
estoque apareceu, a estrada foi ligada — ela é reclamável de novo, por este
laborer ou por outro. É o que faz o cenário se recuperar sozinho, sem comando do
jogador.

E `reclamar` também recusa obra não trabalhável (Task 4): sem os dois lados, o
laborer soltaria e reclamaria a mesma obra a cada tick.

**Conclusão da obra** (dentro de `martelando`):
1. `completarObra(obra, dados)` substitui o prédio;
2. emite `{ type:'building-completed', predio, tipo }`;
3. `removerTarefa` da **própria** tarefa e o laborer vai a `ocioso`.

As tarefas dos **outros** laborers na mesma obra caem no tick seguinte, por
`sanearTarefas` → `'destino-completo'` (que **cancela**, `jobs.ts:41`), e a FSM
deles vê "tarefa sumiu" → `ficarOcioso`. É exatamente o caminho que o serf já usa;
nenhum ramo novo em `sanearTarefas`.

`tick.ts`: inserir entre serfs e `gerarTarefas`, acumulando os eventos.

**Testes:** um laborer nivela um Quarry em 60 ticks; dois laborers nivelam em 30;
`nivelamento` nunca passa do alvo; laborer com teto 0 **e tarefa de material a
caminho** fica em `esperando_material` e volta a `martelando` quando `faltam` cai;
`hp` sobe de 5 em 5 a cada 5 ticks; obra demolida no meio devolve o laborer a
`ocioso` **no tick seguinte** (GDD.md:342); invariantes por tick.

**Teste do anti-travamento (o que a correção do operador exige):** duas obras e
dois laborers. A primeira pede material que **não há como entregar** (armazém sem
aquele estoque); a segunda está abastecida e ligada.

- os dois laborers nivelam a primeira, chegam ao teto, **não ficam presos** e
  migram para a segunda;
- a **segunda obra termina** — é a asserção que prova que a partida não travou;
- depois, o estoque da primeira aparece no armazém → nasce tarefa de material →
  os laborers **voltam** para ela e ela também termina;
- **as liberações são contadas, não só ausentes:** todo `task-released` com
  `'pedido-da-unidade'` tem por destino a obra **sem material possível**, e são
  **uma por laborer** — nenhuma na obra abastecida, nenhuma repetida. É o que
  separa "a regra funciona" de "a regra funciona e não fica batendo".

---

### Task 6 — o portão "obra já nivelada" em `gerarTarefas`

**Files:** `src/sim/systems/jobs.ts`, `tests/F11c-laborer.test.ts`.

No laço de **material** (`systems/jobs.ts:185-195`), antes de tudo:

```ts
if (!obraNivelada(obra, dados)) continue;   // nível 3 da escada: "material -> obra JÁ NIVELADA"
```

O laço de `'construir'` (`:197-202`) **não muda** — a tarefa de construir é o que
faz o nivelamento acontecer; pô-la atrás do portão seria deadlock.

Substitui o comentário-dívida de `systems/jobs.ts:171-178`.

**Teste:** obra não nivelada + armazém ligado com estoque → zero tarefas de
material, mas `laborersMaximosPorObra` tarefas de construir; ao nivelar, as
tarefas de material aparecem **no mesmo tick**.

---

### Task 7 — aceite headless + evidência

**Files:** `tests/F11c-laborer.test.ts` (`afterAll`).

Cenário do BUILD_PLAN: Quarry (3 timber + 2 stone, 250 HP), armazém abastecido,
estrada ligando, serfs e laborers. Roda `step` até `quieto` e afirma:

- o prédio ficou `estado === 'completo'`;
- `hp === 250 === def.hp`;
- `faltam` chegou a `{}` (os 5 materiais entregues) **antes** de `hp` chegar a 250;
- `nivelamento >= 60` e o **primeiro** `task-completed` de material veio **depois**
  do nivelamento terminar (prova o portão ponta a ponta);
- ao terminar o nivelamento, **nenhum** evento `task-released` com
  `'pedido-da-unidade'` — é a asserção que trava a regra de ordem da Task 5 (a
  reavaliação não libera). Sem ela, a liberação espúria por obra nivelada volta
  em silêncio numa sessão futura, porque o cenário ainda converge, só que sujo;
- exatamente **um** evento `building-completed`, com `tipo: 'quarry'`;
- `tiposJaConstruidos` **não** mudou (a F12 é que liga isso);
- conservação de bens por mercadoria em todo tick;
- `violacoesDeInvariantes` e `violacoesDaFsm` vazios em todo tick.

`gravarEvidencia('F11c', { feature: 'F11c-laborer-fsm', aceite: {...} })` no molde
de `tests/F11b-jobboard.test.ts:181`.

---

### Task 8 — adaptar as suítes F09/F10 (⚠️ o ponto de maior risco)

**Files:** `tests/helpers/jobs-cenario.ts`, `tests/helpers/serf-cenario.ts`,
testes F09/F10.

Duas mudanças desta feature vazam para as suítes existentes:

1. **O portão.** `comObra` cria obra com `nivelamento` — se o default for 0,
   nenhuma tarefa de material nasce e **toda a F09/F10 trava**.
2. **O laborer age.** Os 2 laborers do cenário inicial passam a reclamar, andar,
   nivelar e martelar. Em `cenarioLigado({stone:2})` o Quarry tem
   `entregues = 5 − 2 = 3` → teto 150 → os laborers martelam, e depois da entrega
   o teto vira 250 → **a obra completa** e deixa de ser obra. Helpers como
   `faltamDaObra` passam a devolver `undefined` e asserções da F10 quebram.

**Regra de correção (a mesma da Task 10 da F11b — universo implícito, não valor):**

- `comObra` recebe `nivelamento` com **default = já nivelada**
  (`alvoDeNivelamento(tipo)`), com comentário: *o universo implícito de F09/F10 é
  uma obra que aceita material, isto é, já nivelada.* Os testes da F11c passam
  `nivelamento: 0` explicitamente.
- Novo helper `semLaborers(estado)` em `jobs-cenario.ts`, aplicado às fixtures
  F09/F10 que afirmam comportamento **do serf**: *o universo implícito dessas
  suítes é o serf sozinho; o laborer chega na F11c.*
- Os testes que **plantam pela UI/comandos** (`F10-fsm.test.ts:304-320`
  `plantarERuar`, e os dois laços de `80` em `:312`/`:326`) **mantêm** os laborers
  — são o pipeline inteiro — e ganham horizonte maior (o nivelamento do Quarry
  custa 60 ticks / 2 laborers ≈ 30, mais a caminhada). Ajustar 80 → 200 e
  reconferir `:320`.
- Reconferir também: `F10-fsm.test.ts:89` (`toBeLessThan(200)`, valor real hoje
  38), `F10-falhas.test.ts:493` (`TETO = 9000`, 20 obras), defaults `800` de
  `ate`/`rodarAte` (`serf-cenario.ts:56,68`) e `600` de `rodar`
  (`F10-fsm.test.ts:55`).

**Portão de parada — obrigatório.** Ao fim desta task, rodar `git diff` dos testes
F09/F10 e conferir que **nenhum valor asserido** (`toBe`/`toEqual`/`toHaveLength`
de quantidade de pedra, de tarefa, de evento) mudou — só horizontes, filtros e
fixtures. **Se algum valor asserido precisar mudar, parar e reportar antes de
commitar.**

Também: `violacoesDaFsm` ganha os estados do laborer (`ESTADOS_DO_LABORER`), e
`quieto` (`serf-cenario.ts:50-53`) precisa decidir se espera o laborer — proposta:
`quieto` continua sobre o serf (é helper da F10) e a F11c usa um `quietoComObra`
próprio, para não mudar a semântica de 20+ testes.

---

### Task 9 — `render/`: os três estágios

**Files:** criar `src/render/estagio-obra.ts`; modificar `src/render/predios.ts`,
`src/render/scenes/WorldScene.ts`, `src/render/debug.ts`,
`data/theme-sertao.json`; teste headless novo.

```ts
// src/render/estagio-obra.ts — ZERO imports: aritmética pura, testável headless
export type EstagioDaObra = 'marcacao' | 'madeira' | 'completo';
export function estagioDaObra(hp: number, hpTotal: number): EstagioDaObra {
  if (hp >= hpTotal) return 'completo';
  return hp <= 0 ? 'marcacao' : 'madeira';
}
```

- `predios.ts` (funil autorizado para `sim/data`): `AparenciaDoPredio` ganha
  `hpTotal` (de `gameData.predios[].hp`).
- `WorldScene.atualizarPredios` (`:171-176`): a chave do diff passa de
  `predio.estado` para o **estágio** — hoje `hp` não redispara redesenho nenhum.
- `criarPredio` (`:199-226`): três aparências em vez de duas (alpha/stroke/rótulo).
  Rótulos novos em `theme-sertao.json`, sob a chave `obra` que já existe.
- `debug.ts`: publicar a contagem por estágio, para o roteiro **afirmar estado, não
  pixel** (é o contrato de `tools/shots/F10.js:1-17`).

**O "desenho do laborer" da Nota do BUILD_PLAN.** Verificado: `src/render/unidades.ts`
já é genérico por tipo — o laborer sai em `couro` (o serf sai em `ocre`,
`:68-71`) e o campo `fsm` já é publicado como string livre (`:24-38`), então os
estados novos aparecem no debug **sem mudança de contrato**. O que falta é
distinguir `esperando_material` de `martelando` na tela, que o GDD.md:341-342
chama de "estado real e visível": reusar a mecânica do `marcadorDeCarga` para
mostrar um marcador do estado do laborer, com os rótulos em
`theme-sertao.json`. **Passo separado e destacável** — se a sessão apertar, cai
sem comprometer o aceite, que é sobre os três estágios da obra.

**Registrar no PROGRESS:** o original sobe em **quatro** fases (madeira e depois
pedra); a mesma função pura pode dividir a fase intermediária pela fração de `hp`
quando houver arte. Hoje são três, por decisão do operador.

---

### Task 10 — `tools/shots/F11c.js`: os três screenshots

**Files:** criar `tools/shots/F11c.js`.

No molde de `tools/shots/F10.js`: monta o cenário **só pela UI** (planta o Quarry,
desenha a rua), números vindos dos JSON, `avancar(n)` com a página em `?pausado`.

1. `marcacao` — logo após plantar (`hp === 0`).
2. `madeira` — avança até o primeiro estágio `madeira` (`0 < hp < 250`).
3. `completo` — avança até `building-completed` / o prédio sair de obra.

Afirmar em cada passo a contagem por estágio publicada na Task 9 e, no último, que
não há mais obra. Horizonte com folga: 60 (nivelar) + entregas + 250 (martelar).
`npm run shot -- F11c` grava `test-output/F11c-shot.json` e
`screenshots/F11c-{1,2,3}-*.png`.

---

### Task 11 — documentação e referências cruzadas

**Files:** `BUILD_PLAN.md`, `PROGRESS.md`, `test-results.json`.

- `PROGRESS.md`: novo bloco `(origem: F11c)` com o contrato de `Obra` ampliado
  (`nivelamento`), a FSM do laborer, o evento `building-completed` como **contrato
  que a F12 herda**, e a extração de `movimento.ts`. Separar **verificado** de
  **hipótese**.
- **Registrar como regra verificada, não como hipótese:** obra trabalhável. Decisão
  do operador nesta sessão — plantar mais do que se pode pagar é o erro mais
  provável do iniciante, e sem a regra a partida trava em silêncio (o laborer
  espera material que nunca chega, a obra vizinha nunca é nivelada, o portão nunca
  deixa nascer tarefa para ela). Não é balanceamento e **não** vai para o
  `BALANCE_LOG.md`. O teste de duas obras da Task 5 é a evidência.
- `BUILD_PLAN.md` F12: nota de que `building-completed` já existe e é o gancho.
- `test-results.json`: `"F11c-laborer-fsm": { "passes": true }` — **só depois** de
  `npm run verify` passar (hook de 15 min).

---

### Task 12 — verificação final, evidência e merge

```bash
npm run verify                    # typecheck + lint + validate:data + test
npm run shot -- F11c              # 3 screenshots + test-output/F11c-shot.json
npm run shot -- F10               # não-regressão: conferir código de saída
npm run shot -- F11a              # idem
```

- Abrir com **Read**: `test-output/F11c.json` e os **três** screenshots da F11c.
- Para F10/F11a vale o **código de saída**, não abrir a imagem (imagem pesa na
  janela de contexto).
- Commit `feat(F11c): FSM do laborer — construção em etapas`, depois
  `git switch main && git merge --no-ff F11c`. **Sem push.**

---

## Verification

| Critério (BUILD_PLAN.md:191-193) | Como se prova |
|---|---|
| Quarry 3 timber + 2 stone, 250 HP | Task 7, cenário do `afterAll` |
| Após a entrega dos 5 materiais o HP é 250 | Task 7, asserção `hp === def.hp === 250` |
| O prédio fica `completo` | Task 7, `estado === 'completo'` + 1 `building-completed` |
| Screenshots dos três estágios | Task 10, `screenshots/F11c-{1,2,3}-*.png` abertos com Read |
| `npm run test` inteiro verde | Task 8 + Task 12 |
| Sem `phaser` em `src/sim/` | `npm run lint` (regra já existente) |
| Sem número mágico | `npm run validate:data` + revisão do diff |

**Riscos, em ordem:**
1. **Task 8** — o portão + o laborer ativo mexem em 20+ testes de F09/F10. É a
   task que pode estourar a sessão; tem portão de parada escrito.
2. **Task 5** — três pontos: a dobra sequencial com N laborers na mesma obra é
   onde mora o bug de determinismo, se houver (invariantes por tick cobrem); o
   portão precisa existir dos **dois** lados (aqui e no `reclamar` da Task 4),
   senão vira laço de claim/release; e **só `esperando_material` libera** — pôr
   `obraTrabalhavel` na reavaliação gera liberação espúria em toda obra que
   termina de nivelar, porque ela roda antes de `gerarTarefas`. As duas asserções
   de contagem de `task-released` (Tasks 5 e 7) são o que trava isso.
3. **Task 9** — a chave do diff em `WorldScene` é fácil de errar (hoje `hp` não
   redispara redesenho nenhum).

Se a Task 8 se revelar maior que a sessão, quebrar em sub-itens no `BUILD_PLAN.md`
e registrar no `PROGRESS.md` — **não improvisar** (CLAUDE.md §6).

---

## Nota de execução (Tasks 1-2)

Executadas no mesmo commit: `obraNivelada` (Task 1) lê `predio.obra.nivelamento`,
campo que só existe a partir da Task 2 — a ordem escrita acima tem uma dependência
que só aparece na implementação. `alvoDeNivelamento(tipo, dados)` chama
`caixaDeTipo(tipo, 0, 0, dados)`: a assinatura real de `footprint.ts` exige
`gx`/`gy` (o esboço acima omitia os dois); a área não depende da translação, então
`(0, 0)` é neutro. Sem mudança de intenção, só de assinatura. Ver PROGRESS.md para
o restante do detalhe de execução.
