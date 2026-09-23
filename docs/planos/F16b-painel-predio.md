# F16b — Painel de seleção de prédio (integração)

> **Para quem executa:** `superpowers:executing-plans`. Passos com `- [ ]` são
> rastreáveis. **Não** usar `subagent-driven-development` (CLAUDE.md §11).

**Objetivo:** clicar em qualquer prédio abre UM painel que mostra nome, HP ou
progresso de obra, ocupante e estoques, e oferece os botões pausar e demolir
apoiados em comandos que já existem.

**Arquitetura:** um seletor puro em `sim/selectors.ts` devolve tudo pronto
(`painelDoPredio`); a `ui/` só escreve DOM e emite comando; a seleção continua
sendo a `input/selecao.ts` da F13b. O painel da escola deixa de ser dono do
`<aside>` e vira uma seção desenhada dentro do painel genérico.

**Stack:** TypeScript estrito · Vitest (`environment: 'node'`, sem DOM) ·
Playwright pelo runner `tools/shot.js`.

**Fila:** item `F16b` do `BUILD_PLAN.md` (linhas 636-663). O critério de aceite
escrito lá é intocado por este plano.

---

## 0. Autorização e escopo — confirmado antes do código

**A nota de feature de integração está escrita no item**, em `BUILD_PLAN.md`
(item F16b, "**Nota**: **feature de integração** (CLAUDE.md §10)"), autorizada
pelo operador em 2026-09-23 e registrada na sessão da F16a — isto é, **antes**
desta sessão escrever código. A exceção vale **só deste item**; a F16a e a F16c
não a herdam, e ela não se estende à F17.

A nota enumera `src/ui/`, `src/input/` e `src/render/`. Este plano também
acrescenta **um seletor de leitura** em `src/sim/selectors.ts`. Isso é o que a
exceção do §10 cobre (o par proibido é `render/` + `sim/` na mesma feature) e é
exatamente o precedente da F13b, que pôs `painelDaEscola` em `sim/selectors.ts`
pela razão escrita lá: **`ui/` não varre `GameState`**. Nenhuma regra de
simulação muda; nenhum campo de estado nasce; nenhum comando novo é criado.

### Dentro do escopo (o que o BUILD_PLAN pede)

nome · HP ou progresso de obra · ocupante · estoque de entrada e saída · botão
pausar · botão demolir.

### Fora, e por quê

| Fora | Razão |
|---|---|
| **Modo do Woodcutter's** | Saiu do aceite da F16c por emenda do operador: o comportamento que o modo governaria não existe, e cumpri-lo exigiria fabricá-lo. Pré-condição registrada: camada de terreno com árvore, hoje sem dono na fila. |
| **Botão pausar em armazém/escola/quartel** | Nota da F16c: a sim aceita pausar qualquer prédio completo, **quem esconde o botão é a tela**. Só aparece com `producao !== null`. |
| **Evento de pausa** | Decisão do operador: evento sem consumidor não nasce. Se a tela precisar de som ou toast, nasce na feature que o consome — não aqui, que não pede nenhum dos dois. |
| **Alerta "prédio sem trabalhador"** | É a F22. O painel mostra o **campo** ocupante; não constrói mecanismo de alerta. |
| **Realce do prédio selecionado no canvas** | O escopo não pede. Render só ganha um campo de depuração (Tarefa 6). |
| **Confirmação antes de demolir** | Ver §3, D7. **Decisão do operador (2026-09-23): fica com um clique, sem confirmação.** Vai para `IDEIAS.md` — decisão tomada, não pergunta em aberto. |

---

## 1. O que já existe e é reusado — não criar um segundo mecanismo de nada

| Origem | O que já existe | Onde |
|---|---|---|
| F13b | `criarSelecao()` — guarda só o id, estado de interface, fora do `GameState`, some com `Esc` | `src/input/selecao.ts` |
| F13b | `predioNoTile(state, gx, gy)` — footprint inteiro, varre `predios.ordem` | `src/sim/selectors.ts:313` |
| F13b | `painelDaEscola(state, id)` — **continua sendo a fonte** da fila de treino | `src/sim/selectors.ts:281` |
| F13b | `Esc` num **único** `keydown` que larga a ferramenta e fecha o painel | `src/input/teclado.ts` |
| F14 | `PredioCompleto.ocupante` (id de unidade ou `null`), `ehPredioOcupavel`, `trabalhadorDoTipo` | `src/sim/ocupacao.ts` |
| F15 | `PredioCompleto.producao` (`null` = tipo sem receita), `estoque.{entrada,saida}` | `src/sim/state.ts` |
| F16a | `DemolishBuilding { predio }` — nunca recusado, id inexistente é no-op | `src/sim/commands.ts` |
| F16c | `SetBuildingPaused { predio, pausado }` — **valor explícito**, nunca alternador | `src/sim/commands.ts` |
| F05a | `economia.mercadorias` — a lista canônica e **ordenada** de bens | `data/economy.json` |

**`src/input/selecao.ts` não muda.** Ela já é genérica: guarda um id qualquer. O
que era específico de escola era o **painel**, que devolvia `null` para todo
prédio que não fosse `schoolhouse` e por isso ficava escondido. É o painel que
esta feature generaliza — e a nota da F13b ("a seleção só reconhece schoolhouse")
descreve esse efeito, não o arquivo.

---

## 2. Arquivos

**Criar**
- `src/ui/painel-predio.ts` — dono do `<aside>`, do `hidden` e do redesenho.
- `tests/F16b-painel.test.ts` — testes do seletor (Vitest é `node`, sem DOM).
- `tools/shots/F16b.js` — roteiro Playwright.

**Modificar**
- `src/sim/selectors.ts` — acrescenta `painelDoPredio` e seus tipos.
- `src/ui/painel-escola.ts` — deixa de ser dono do DOM; vira
  `desenharSecaoDaEscola(raiz, dados, emitir)`.
- `src/main.ts` — monta `painel-predio` no lugar de `painel-escola`.
- `index.html` — `<aside id="painel-predio">` e o CSS correspondente.
- `src/render/debug.ts` — campo `prediosDoEstado` para o roteiro afirmar.
- `src/render/scenes/` (o arquivo que preenche `EstadoDebug`) — preenche o campo.
- `data/theme-sertao.json` — bloco `painelPredio`.
- `tools/shots/F13b.js` — trocar `#painel-escola` por `#painel-predio` (o id do
  elemento mudou; sem isso o roteiro da F13b reprova).
- `BUILD_PLAN.md`, `PROGRESS.md`, `test-results.json`.

**Não modificar**: `src/input/selecao.ts`, `src/input/teclado.ts`,
`src/input/colocar.ts`, `tests/F13b-painel.test.ts` (só testa seletores, não
toca DOM).

---

## 3. Decisões

**D1 — A leitura mora em `sim/selectors.ts`, não na `ui/`.**
`painelDoPredio(state, predioId, dados)` devolve o painel inteiro pronto ou
`null`. *Alternativa rejeitada:* a `ui/` ler `state.predios.porId[id]` direto —
quebra o §3 (`ui/` não varre `GameState`) e deixaria o painel sem teste, porque
o Vitest roda em `node` e não desenha DOM. Com o seletor, a regra tem teste
unitário e o DOM fica com o roteiro, exatamente como na F13b.

**D2 — `null` é como o painel se fecha sozinho.**
Id que não está em `state.predios.porId` devolve `null` e o painel se esconde.
É o mesmo mecanismo que a F13b usa, e é o que faz o painel fechar **no mesmo
tick** em que o prédio é demolido, sem o `ui/` precisar ouvir evento nenhum.
Ninguém mexe na seleção: quem a limpa continua sendo o `Esc` e o clique no mapa.

**D3 — Ordem das gavetas vem de `economia.mercadorias`.**
As gavetas são `Record<string, number>`; iterar `Object.keys` é exatamente o que
o contrato da F05a proíbe. A ordem sai da lista do dado. *Alternativa
rejeitada:* ordem alfabética do id — determinística, mas inventa uma ordem em
código quando o dado já tem uma; e o tema, que é quem traduz, não pode ser lido
por `sim/` (§9).

**D4 — HP e progresso são o mesmo campo, lidos de dois jeitos.**
`PredioBase.hp` é o HP martelado em obra e o `hp` do dado quando completo; o
total nunca é guardado (vem de `buildings.json`, fonte única). O seletor devolve
`hp`, `hpTotal` e `progresso = hp / hpTotal`. O painel mostra **HP** quando
`estado === 'completo'` e **progresso + o que falta chegar** quando `'obra'`.
Nenhum campo novo no estado.

**D5 — Ocupante: três casos, três textos.**
`pedeTrabalhador` (de `trabalhadorDoTipo(tipo) !== null`) separa "não pede"
(armazém, escola: a linha nem aparece) de "pede e está vago" (rótulo próprio) e
de "ocupado" (nome do civil, pelo tema). Um rótulo só para causas diferentes é
o defeito que a F13b já corrigiu na fila da escola; não repetir aqui.

**D6 — O botão pausar manda o VALOR, e só existe com produção.**
O botão carrega `data-pausar="<valor a enviar>"` do último desenho e emite
`SetBuildingPaused { predio, pausado: <esse valor> }`. Reenviar o mesmo valor é
no-op silencioso na sim (contrato da F16c), então a defasagem de até um tick
entre desenho e clique é inofensiva — e um alternador, que a nota proíbe,
inverteria o estado nesse caso. O botão só é desenhado com
`temProducao === true`. **"Pausado" é composto** de `predio.pausado` + o
ocupante: não existe rótulo de FSM `pausado` para ler, e o especialista de um
prédio pausado continua em `trabalhando`, de propósito.

**D7 — Demolir é um clique, sem confirmação. Decisão do operador (2026-09-23).**
O escopo escreve "botões pausar e demolir". O GDD não fala em confirmação, e
inventá-la é acrescentar interface que ninguém pediu. O operador confirmou que
fica assim, e **o registro vai para `IDEIAS.md`, não para `## Perguntas em
aberto`**: a decisão está tomada, e uma pergunta em aberto convidaria uma sessão
futura a reabri-la. **O custo a registrar junto**: é o único botão do jogo que
destrói trabalho de forma irreversível, e a devolução é parcial
(`construcao.devolucaoAoDemolir = 0.5`) — então o erro é caro, e é esse o preço
que uma confirmação compraria se um dia ela entrar.

**D8 — Um painel, uma seção.**
`painel-escola.ts` para de chamar `document.getElementById` e de mexer em
`hidden`: passa a exportar `desenharSecaoDaEscola(raiz, dados, emitir)`, uma
função de desenho pura em cima do `PainelDaEscola` que `painelDaEscola` já
devolve. Quem decide se a seção existe é o painel genérico. Isto é o que a nota
do item manda ("hospeda o bloco da escola como um trecho do painel de prédio
qualquer — `painelDaEscola` continua sendo a fonte") e é o **único** motivo de
tocar nesse arquivo: não é refatoração ampla.

**D9 — Um commit no fim.**
`writing-plans` pede commits frequentes; CLAUDE.md §6 pede um commit por sessão,
`feat(F16b): <resumo>`. CLAUDE.md governa.

---

## 4. Tarefas

### Tarefa 1 — Sonda: o cenário do aceite é alcançável pelo caminho real?

O aceite pede screenshot de **prédio completo e ocupado**. O estado inicial tem
só armazém e escola, e **nenhum dos dois é ocupável** (`trabalhador: null`). O
painel do aceite exige, portanto, a cadeia inteira: planta → estrada → serfs
entregam → laborers martelam → escola treina um `stonemason` → ele anda e ocupa.
Antes de construir o painel em cima disso, provar que a cadeia fecha e **medir
quantos ticks ela custa** — o roteiro precisa de uma constante, e chutá-la é o
jeito mais caro de descobrir que ela era pequena.

**Se a cadeia não fechar, PARAR e reportar**: é travamento de regra alcançável
por comando que já existe, não balanceamento, e não se constrói painel em cima.
Não improvisar correção.

**Decisão do operador (2026-09-23) — a sonda é medição, não só semáforo.** Se a
cadeia fechar, ela é **o aceite da Fase A acontecendo pela primeira vez**.
Gravar os números enquanto mede — o tick em que cada etapa fecha — em
`test-output/F16b-sonda.json`. A F17 vai comparar contra eles: com os números já
medidos, a F17 vira **confirmação** em vez de descoberta.

Etapas a cronometrar, cada uma com o tick em que fecha:
`obra-completa` · `treino-comeca` · `treino-termina` · `especialista-ocupa` ·
`primeira-pedra-produzida`.

**Arquivos:**
- Criar: `test-output/F16b-sonda.json` (medição, commitada)
- Script: scratchpad da sessão, **não** commitado

**Isto é probe** (§8): vale como evidência desta sessão e como linha de base
para a F17; **não** é cobertura contínua. Quem protege a cadeia de forma
permanente é o roteiro da Tarefa 7, que roda no `npm run shot`.

- [ ] **Passo 1: escrever a sonda em Node, com os comandos reais**

Usar o mesmo caminho que o roteiro vai clicar — `step()` com os comandos, nunca
injeção de estado. Geometria derivada dos JSON, nunca digitada:

```js
// storehouse (29,30) 3x3 e schoolhouse (34,30) 3x3 -> porta na linha y=33.
// A quarry e 3x2: gy=31 poe a borda sul dela na MESMA linha y=33.
// gx=38 deixa a coluna 37 livre entre a escola (ate x=36) e a quarry (38..40),
// e a linha y=33 sob a quarry esta vazia -> a regra da porta da F16a aceita.
const rua = linhaH(29, 40, 33);           // uma estrada so, do armazem a quarry
const comandos = [
  { type: 'PlaceRoad', tiles: rua },
  { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 38, gy: 31 },
  { type: 'EnqueueTraining', predio: ESCOLA, unidade: 'stonemason' },
];
```

O `EnqueueTraining` entra **no mesmo tick** que a planta, de propósito: o treino
(30s / escala `construcao` 2 = 150 ticks) roda em paralelo com a obra, em vez de
depois dela.

- [ ] **Passo 2: rodar em ticks e gravar o tick de cada marco**

Rodar com teto generoso (2000 ticks), registrando o **primeiro** tick em que
cada marco passa a valer. Gravar em `test-output/F16b-sonda.json`: os marcos, a
semente, os comandos emitidos e a geometria — sem isso o número não é
reproduzível e a F17 não tem contra o que comparar.

```js
{
  "feature": "F16b", "medicao": "sonda da cadeia do aceite da Fase A",
  "semente": 20260920,
  "geometria": { "quarry": { "gx": 38, "gy": 31 }, "rua": { "y": 33, "x0": 29, "x1": 40 } },
  "comandos": [ /* os comandos reais, na ordem e no tick em que entram */ ],
  "marcos": {
    "obra-completa": 0, "treino-comeca": 0, "treino-termina": 0,
    "especialista-ocupa": 0, "primeira-pedra-produzida": 0
  },
  "tetoDaSonda": 2000
}
```

Marco que não fecha entra como `null`, **com o motivo ao lado** — um `null` sem
motivo é um número que a F17 vai ler como fato.

Run: `node <scratchpad>/F16b-sonda.mjs`

- [ ] **Passo 3: decidir**

Cadeia fecha → anotar `TICKS_ATE_OCUPAR` (o marco `especialista-ocupa`, com
folga) e seguir para a Tarefa 2. Cadeia trava → **parar**, registrar em
`BUGS.md` com severidade `trava` e reportar ao operador. **Não improvisar
correção** e não começar a Tarefa 2.

---

### Tarefa 2 — `painelDoPredio`: o seletor e o teste

**Arquivos:**
- Modificar: `src/sim/selectors.ts`
- Criar: `tests/F16b-painel.test.ts`

**Interfaces — Produz** (é o que a Tarefa 5 e a Tarefa 7 consomem):

```ts
/** Uma linha de gaveta, como o painel a desenha. Ordem: `economia.mercadorias`. */
export interface ItemDeEstoque {
  /** Id NEUTRO ('stone'). Quem traduz e o tema, na `ui/`. */
  readonly mercadoria: string;
  readonly quantidade: number;
}

export interface OcupanteDoPainel {
  /** Id da unidade ('u7'). */
  readonly unidade: string;
  /** Id neutro do civil ('stonemason'). */
  readonly tipo: string;
}

/** Tudo que o painel de um predio qualquer desenha (F16b). */
export interface PainelDoPredio {
  readonly predio: string;
  /** Id neutro do tipo ('quarry'); o NOME vem do tema, na `ui/`. */
  readonly tipo: string;
  readonly estado: 'obra' | 'completo';
  /** HP martelado em obra; o `hp` do dado quando completo. */
  readonly hp: number;
  /** `def.hp` de buildings.json. Nao e guardado no estado (fonte unica). */
  readonly hpTotal: number;
  /** `hp / hpTotal`, em [0,1]. Vale 1 no predio completo. */
  readonly progresso: number;
  /** So em obra: o que ainda falta ENTREGAR. `null` no completo. */
  readonly faltam: readonly ItemDeEstoque[] | null;
  /** `null` em obra, no predio vago, e no tipo que nao pede trabalhador. */
  readonly ocupante: OcupanteDoPainel | null;
  /** O TIPO pede trabalhador. Separa "vago" de "nao pede" (D5). */
  readonly pedeTrabalhador: boolean;
  /** `null` em obra: obra nao guarda mercadoria (contrato da F07). */
  readonly estoque: {
    readonly entrada: readonly ItemDeEstoque[];
    readonly saida: readonly ItemDeEstoque[];
  } | null;
  /** `producao !== null`. E o que decide se o botao pausar aparece (nota F16c). */
  readonly temProducao: boolean;
  readonly pausado: boolean;
}

export function painelDoPredio(
  state: GameState, predioId: string, dados?: GameData,
): PainelDoPredio | null;
```

- [ ] **Passo 1: escrever o teste que falha**

`tests/F16b-painel.test.ts`, usando `cenarioDePedreira` (de
`tests/helpers/producao-cenario.ts`, que já entrega uma pedreira completa e
ocupada) e `createInitialState` para o armazém e a escola:

```ts
describe('F16b — painelDoPredio', () => {
  it('devolve null para id que nao esta no estado (e assim o painel fecha)', () => {
    expect(painelDoPredio(inicial, 'p999')).toBeNull();
  });

  it('pedreira completa e ocupada: ocupante com o TIPO do civil, e producao', () => {
    const p = painelDoPredio(pedreira, PEDREIRA);
    expect(p?.estado).toBe('completo');
    expect(p?.pedeTrabalhador).toBe(true);
    expect(p?.ocupante?.tipo).toBe(gameData.predios.find((b) => b.id === 'quarry')?.trabalhador);
    expect(p?.temProducao).toBe(true);
    expect(p?.pausado).toBe(false);
    expect(p?.hp).toBe(p?.hpTotal);
  });

  it('armazem: nao pede trabalhador e nao tem producao — o botao pausar nao existe', () => {
    const p = painelDoPredio(inicial, ARMAZEM);
    expect(p?.pedeTrabalhador).toBe(false);
    expect(p?.ocupante).toBeNull();
    expect(p?.temProducao).toBe(false);
  });

  it('pedreira vaga: pede trabalhador E esta sem ocupante — dois campos, nao um', () => {
    const p = painelDoPredio(semOcupante(pedreira, PEDREIRA), PEDREIRA);
    expect(p?.pedeTrabalhador).toBe(true);
    expect(p?.ocupante).toBeNull();
  });

  it('pausado sai do campo do predio, pelo comando real', () => {
    const depois = step(pedreira, [{ type: 'SetBuildingPaused', predio: PEDREIRA, pausado: true }]).state;
    expect(painelDoPredio(depois, PEDREIRA)?.pausado).toBe(true);
  });

  it('obra: progresso e faltam; sem estoque e sem ocupante', () => {
    const p = painelDoPredio(comObra, OBRA);
    expect(p?.estado).toBe('obra');
    expect(p?.estoque).toBeNull();
    expect(p?.ocupante).toBeNull();
    expect(p?.progresso).toBeCloseTo(p!.hp / p!.hpTotal);
    expect(p?.faltam?.map((i) => i.mercadoria)).toEqual(['timber', 'stone']); // ver o guarda abaixo
  });

  // GUARDA ESTRUTURAL: a ordem e a do DADO, nao a de Object.keys nem uma lista
  // literal digitada aqui. Comparar com o dado e o que faz o teste acusar se
  // alguem trocar a fonte da ordem.
  it('as gavetas saem na ordem de economia.mercadorias', () => {
    const ordemDoDado = gameData.economia.mercadorias;
    const saida = painelDoPredio(inicial, ARMAZEM)!.estoque!.saida.map((i) => i.mercadoria);
    const esperada = ordemDoDado.filter((m) => saida.includes(m));
    expect(saida).toEqual(esperada);
    expect(saida.length).toBeGreaterThan(1); // com 1 item a ordem nao prova nada
  });
});
```

> Nota para quem executa: o `faltam` da obra é `['timber', 'stone']` **porque é
> essa a ordem em `economia.mercadorias`** (`tree_trunk, timber, stone, ...`) —
> confira com o dado ao escrever, não copie daqui.

- [ ] **Passo 2: rodar e ver falhar**

Run: `npx vitest run tests/F16b-painel.test.ts`
Esperado: FALHA — `painelDoPredio is not a function`.

- [ ] **Passo 3: implementar**

```ts
function gaveta(
  quantidades: Readonly<Record<string, number>>, dados: GameData,
): readonly ItemDeEstoque[] {
  // Ordem do DADO, nunca Object.keys (contrato da F05a). Mercadoria zerada nao
  // vira linha: o painel mostra o que ha, e a gaveta vazia tem rotulo proprio.
  return dados.economia.mercadorias
    .filter((m) => (quantidades[m] ?? 0) > 0)
    .map((m) => ({ mercadoria: m, quantidade: quantidades[m] as number }));
}

export function painelDoPredio(
  state: GameState, predioId: string, dados: GameData = gameData,
): PainelDoPredio | null {
  const predio = state.predios.porId[predioId];
  if (predio === undefined) return null;
  const def = dados.predios.find((b) => b.id === predio.tipo);
  if (def === undefined) return null;

  const pedeTrabalhador = trabalhadorDoTipo(predio.tipo, dados) !== null;
  const comum = {
    predio: predioId, tipo: predio.tipo,
    hp: predio.hp, hpTotal: def.hp, progresso: predio.hp / def.hp,
    pedeTrabalhador,
  };

  if (predio.estado === 'obra') {
    return {
      ...comum, estado: 'obra',
      faltam: gaveta(predio.obra.faltam, dados),
      ocupante: null, estoque: null, temProducao: false, pausado: false,
    };
  }

  const ocupante = predio.ocupante === null ? null : state.unidades.porId[predio.ocupante];
  return {
    ...comum, estado: 'completo', faltam: null,
    ocupante: ocupante === undefined || ocupante === null
      ? null
      : { unidade: ocupante.id, tipo: ocupante.tipo },
    estoque: {
      entrada: gaveta(predio.estoque.entrada, dados),
      saida: gaveta(predio.estoque.saida, dados),
    },
    temProducao: predio.producao !== null,
    pausado: predio.pausado,
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `npx vitest run tests/F16b-painel.test.ts` → PASSA.
Run: `npm run typecheck` → sem erro.

---

### Tarefa 3 — Os rótulos do tema

**Arquivos:** Modificar `data/theme-sertao.json`

- [ ] **Passo 1: acrescentar o bloco `painelPredio`**

```json
"painelPredio": {
  "_doc": "Painel de predio (F16b). O NOME do predio nao vem daqui: vem de predios.<id>.nome. So os rotulos fixos moram neste bloco.",
  "hp": "Resistência",
  "emObra": "Em obra",
  "faltaChegar": "Falta chegar",
  "ocupante": "Quem trabalha",
  "semTrabalhador": "Sem trabalhador",
  "entrada": "Entra",
  "saida": "Sai",
  "gavetaVazia": "—",
  "pausar": "Parar",
  "retomar": "Voltar ao trabalho",
  "pausado": "Parado",
  "demolir": "Derrubar"
}
```

- [ ] **Passo 2: validar**

Run: `npm run validate:data`
Esperado: passa. (O validador não impõe schema de chaves ao tema; a regra do §9
que importa é que nenhum id neutro apareça na tela, e é o painel que garante
isso ao traduzir tudo por este bloco.)

---

### Tarefa 4 — A escola deixa de ser dona do DOM

**Arquivos:** Modificar `src/ui/painel-escola.ts`

**Interfaces — Produz:**

```ts
/** Desenha a fila de treino DENTRO de `raiz` (F16b). Nao possui elemento, nao
 *  mexe em `hidden` e nao conhece a selecao: quem decide se esta secao existe e
 *  o painel de predio. `painelDaEscola` continua sendo a fonte dos dados. */
export function desenharSecaoDaEscola(
  raiz: HTMLElement, dados: PainelDaEscola, emitir: (c: Command) => void,
): void;
```

- [ ] **Passo 1: converter**

Apagar `montarPainelEscola`, `PainelEscola` e o `getElementById`. O corpo de
`desenhar(dados)` vira o corpo de `desenharSecaoDaEscola`, trocando `painel` por
`raiz` e **sem** o `replaceChildren()` inicial (quem limpa é o painel de prédio,
que redesenha tudo). O `<h2>` com `rotulos.titulo` **sai**: o título do painel
agora é o nome do prédio, e dois títulos empilhados seria ruído. Os `slotDoItem`,
`slotVazio` e `detalheDoItem` ficam como estão — inclusive o `aria-disabled` em
vez de `disabled`, que é o que deixa o roteiro provar que o clique não enfileirou.

- [ ] **Passo 2: conferir que nada mais importa o símbolo antigo**

Run: `npx tsc --noEmit`
Esperado: erro **só** em `src/main.ts` (que a Tarefa 5 conserta). Se aparecer
erro em outro arquivo, há um consumidor que este plano não previu — pare e leia.

---

### Tarefa 5 — O painel de prédio

**Arquivos:**
- Criar: `src/ui/painel-predio.ts`
- Modificar: `index.html`, `src/main.ts`, `tools/shots/F13b.js`

- [ ] **Passo 1: o elemento e o CSS**

Em `index.html`, trocar `<aside id="painel-escola" hidden>` por
`<aside id="painel-predio" hidden>` e renomear os seletores CSS do bloco
`#painel-escola` para `#painel-predio`, **mantendo** a sobreposição no canto
inferior esquerdo do canvas (`grid-column: 1; grid-row: 2; place-self: end
start`). Isso não é preferência: uma terceira coluna encolheria o canvas e
reprovaria o roteiro da F06, que afirma `canvas.right <= painel.left`.

Acrescentar as regras novas, no mesmo registro visual do bloco existente:

```css
#painel-predio .linha { display: flex; justify-content: space-between; gap: 6px; }
#painel-predio .linha .rotulo { opacity: 0.7; }
#painel-predio .gaveta { display: flex; flex-wrap: wrap; gap: 4px; }
#painel-predio .gaveta .item { font-variant-numeric: tabular-nums; }
#painel-predio .acoes { display: flex; gap: 4px; margin-top: 4px; }
#painel-predio [data-pausado="true"] { border-color: #c9974b; }
```

- [ ] **Passo 2: escrever `src/ui/painel-predio.ts`**

O DOM abaixo é **contrato com o roteiro da Tarefa 7** — os `data-*` são o que o
Playwright afirma, e trocá-los quebra o roteiro:

```html
<aside id="painel-predio" data-predio="p3" data-tipo="quarry"
       data-estado="completo" data-pausado="false">
  <h2>Pedreira</h2>                                  <!-- tema.predios[tipo].nome -->
  <div class="linha" data-campo="hp">…250/250</div>   <!-- so quando completo -->
  <div class="linha" data-campo="obra">…40%</div>     <!-- so em obra -->
  <div class="gaveta" data-gaveta="faltam">…</div>    <!-- so em obra -->
  <div class="linha" data-campo="ocupante" data-ocupante="stonemason">…</div>
  <div class="gaveta" data-gaveta="entrada"><span class="item" data-mercadoria="stone">Pedra 3</span></div>
  <div class="gaveta" data-gaveta="saida">…</div>
  <div class="secao-escola">…</div>                   <!-- so em escola completa -->
  <div class="acoes">
    <button data-pausar="true">Parar</button>         <!-- so com temProducao -->
    <button data-demolir="p3">Derrubar</button>
  </div>
</aside>
```

Regras de desenho, uma a uma:

```ts
export interface PainelPredio { atualizar(estado: GameState): void; }

export function montarPainelPredio(
  selecao: Selecao, emitir: (comando: Command) => void,
): PainelPredio {
  const raiz = document.getElementById('painel-predio');
  if (!raiz) throw new Error('painel-predio: #painel-predio nao existe no index.html');
  // …
  return {
    atualizar(estado) {
      const id = selecao.predio;
      const dados = id === null ? null : painelDoPredio(estado, id);
      // Nada selecionado, ou o predio saiu do estado (demolido): o painel fecha.
      // Nao mexe na selecao — quem a limpa e o `Esc` e o clique no mapa (F13b).
      if (dados === null) { raiz.hidden = true; raiz.replaceChildren(); return; }
      raiz.hidden = false;
      desenhar(dados, estado);
    },
  };
}
```

- `h2` ← `tema.predios[dados.tipo]?.nome ?? dados.tipo` (mesmo molde do
  `nomeDoCivil` que a escola já usa: cai no id se o tema não tiver a entrada,
  em vez de quebrar).
- `data-campo="hp"` só com `estado === 'completo'`: `${tema.hp} ${hp}/${hpTotal}`.
- `data-campo="obra"` só com `estado === 'obra'`:
  `${tema.emObra} ${Math.round(progresso * 100)}%`, e a gaveta `faltam` logo
  abaixo com o rótulo `faltaChegar`.
- `data-campo="ocupante"`: desenhada **só** com `pedeTrabalhador === true`.
  Com ocupante, `data-ocupante` = `ocupante.tipo` e o texto é
  `nomeDoCivil(ocupante.tipo)`. Vago, `data-ocupante=""` e o texto é
  `tema.semTrabalhador`. Prédio que não pede trabalhador não ganha a linha —
  "vago" e "não se aplica" são coisas diferentes (D5).
- Gavetas `entrada` e `saida` só com `estoque !== null`. Cada item é
  `<span class="item" data-mercadoria="stone">Pedra 3</span>`, com
  `tema.mercadorias[m] ?? m`. Gaveta sem item recebe
  `<span class="item" data-vazia="true">—</span>`.
- `secao-escola`: chamar `painelDaEscola(estado, dados.predio)` e, se não for
  `null`, criar a `<div class="secao-escola">` e passá-la a
  `desenharSecaoDaEscola`. É o único lugar que sabe da escola.
- `acoes`: o botão pausar só com `temProducao === true`; texto `tema.retomar`
  quando `pausado`, `tema.pausar` quando não; `data-pausar` = `String(!pausado)`
  — **o valor a enviar** (D6). O clique emite
  `{ type: 'SetBuildingPaused', predio, pausado: botao.dataset.pausar === 'true' }`.
  O botão demolir é sempre desenhado e emite
  `{ type: 'DemolishBuilding', predio }`.
- `raiz.dataset.pausado = String(dados.pausado)` — é o que o roteiro lê para
  afirmar que a tela mudou, e o que o CSS usa para a borda.

- [ ] **Passo 3: ligar em `src/main.ts`**

Trocar o import e a montagem (`montarPainelEscola` → `montarPainelPredio`,
`painelEscola` → `painelPredio`) nas quatro linhas em que aparecem: import,
montagem, `atualizar()` e o `selecao.aoMudar`. O comentário do `aoMudar`
continua valendo palavra por palavra — o painel abre **no clique**, sem esperar
o próximo tick, porque com o jogo pausado não viria nenhum.

- [ ] **Passo 4: consertar o roteiro da F13b**

Em `tools/shots/F13b.js`, trocar todo `#painel-escola` por `#painel-predio`
(19 ocorrências). **Uma mudança a mais**: o passo que afirma
`textContent('#painel-escola h2') === tema.painelEscola.titulo` agora leria o
nome do prédio, porque o `<h2>` da seção saiu (Tarefa 4). Trocar a afirmação
para o nome da escola no tema:

```js
afirmar(
  (await page.textContent('#painel-predio h2')) === tema.predios.schoolhouse.nome,
  'o titulo deveria ser o nome do predio, vindo do tema',
);
```

Isto é **conserto do guarda, não afrouxamento da asserção**: a invariante
("todo rótulo vem do tema, nunca o id neutro") continua sendo afirmada; o que
mudou é qual entrada do tema alimenta o título.

- [ ] **Passo 5: typecheck e lint**

Run: `npm run typecheck && npm run lint`
Esperado: sem erro.

---

### Tarefa 6 — O estado dos prédios no contrato de depuração

**Arquivos:** Modificar `src/render/debug.ts` e a cena que o preenche

O roteiro precisa afirmar sobre o estado, não sobre pixel (§8): que
`pausado` virou `true` e que o prédio **saiu do estado** depois de demolido.
Hoje `EstadoDebug` só tem a contagem `prediosRenderizados`. O precedente é o
`filaDeTreino` da F13b, que publica um pedaço do `GameState` do tick desenhado.

- [ ] **Passo 1: acrescentar o campo**

```ts
/** F16b — os predios do tick desenhado, por id. E o que o roteiro le quando o
 *  aceite pede "o predio esta (ou nao esta) no estado". Mesmo molde do
 *  `filaDeTreino` (F13b): um pedaco do GameState, nao um resumo do render. */
prediosDoEstado: Readonly<Record<string, {
  readonly tipo: string;
  readonly estado: 'obra' | 'completo';
  readonly pausado: boolean;
  readonly ocupante: string | null;
}>>;
```

Inicializar com `{}` em `publicarEstadoDebug` e preencher na cena no mesmo ponto
em que `prediosRenderizados` e `filaDeTreino` já são preenchidos, varrendo
`state.predios.ordem` (nunca `Object.keys`). Prédio em obra entra com
`pausado: false` e `ocupante: null`.

- [ ] **Passo 2: typecheck**

Run: `npm run typecheck` → sem erro.

---

### Tarefa 7 — O roteiro e as screenshots

**Arquivos:** Criar `tools/shots/F16b.js`

Toda geometria e todo número esperado saem dos JSON, como no roteiro da F13b:
nada de tile digitado à mão a não ser o deslocamento que este cenário escolhe
(a coluna livre entre a escola e a pedreira), e mesmo esse é derivado.

- [ ] **Passo 1: escrever o roteiro**

```js
const TICKS_ATE_OCUPAR = /* medido na Tarefa 1, com folga; o comentario diz o numero medido */;
```

Sequência, com o que cada passo existe para provar:

1. **Painel nasce fechado.** `isHidden('#painel-predio')`.
2. **Armazém: painel de prédio sem produção.** Clicar no meio do footprint do
   armazém → painel visível, `h2` = `tema.predios.storehouse.nome`, a gaveta
   `saida` tem os bens do estoque inicial **na ordem de
   `economy.mercadorias`** (ler os `data-mercadoria` e comparar com a lista
   filtrada do dado), **não existe** `[data-pausar]` e **não existe**
   `[data-campo="ocupante"]`. → **captura `armazem`**.
   *Prova: a nota da F16c ("quem esconde o botão é a tela") e o D5.*
3. **Puxar a rua** de `x=29` a `x=40` em `y=33` e **posicionar a pedreira** em
   `(38,31)` com o menu Build. Afirmar que `plantaFantasma.valida` é `true`
   antes de clicar — se a regra da porta da F16a recusar este tile, o roteiro
   diz isso em vez de falhar num passo distante.
4. **Painel de obra.** Clicar na pedreira recém-posta →
   `data-estado="obra"`, existe `[data-campo="obra"]`, **não** existe
   `[data-campo="hp"]`, a gaveta `faltam` lista `timber` e `stone`.
   → **captura `obra`**.
5. **Enfileirar o `stonemason`** na escola, pelo painel (a seção da escola
   dentro do painel de prédio: `[data-treinar="stonemason"]`). Isso também
   prova que a seção herdada continua funcionando **dentro** do painel novo.
6. **`avancar(TICKS_ATE_OCUPAR)`**, e afirmar pelo estado:
   `prediosDoEstado[pedreira].estado === 'completo'` e `.ocupante !== null`.
7. **Painel de prédio completo e ocupado.** Reabrir o painel da pedreira →
   `data-estado="completo"`, `[data-campo="hp"]` mostra `250/250`,
   `[data-ocupante="stonemason"]` com o texto `tema.civis.stonemason.nome`,
   existe `[data-pausar="true"]`. → **captura `completo-ocupado`** — **esta é a
   screenshot do aceite**.
8. **Pausar por clique.** Clicar em `[data-pausar="true"]`, `avancar(1)` →
   `prediosDoEstado[pedreira].pausado === true`, o painel passa a
   `data-pausado="true"` e o botão agora é `[data-pausar="false"]` com o texto
   `tema.painelPredio.retomar`. → **captura `pausado`**.
9. **Despausar** clicando de novo → `pausado === false`. *Prova que o botão
   manda o valor e não alterna às cegas: os dois cliques mandaram valores
   diferentes, cada um lido do `data-pausar` do desenho.*
10. **Demolir por clique.** Anotar `prediosRenderizados` antes. Clicar em
    `[data-demolir]`, `avancar(1)` → `prediosDoEstado[pedreira] === undefined`,
    `prediosRenderizados` caiu exatamente 1, e `isHidden('#painel-predio')`.
    → **captura `depois-de-demolir`**.
11. **O tile ficou vazio.** Clicar de novo no mesmo ponto do mapa → o painel
    **continua** escondido. *Isto fecha a prova "fora do estado" pelos dois
    lados: o id sumiu e `predioNoTile` não acha mais nada ali.*

- [ ] **Passo 2: rodar**

Run: `npm run shot -- F16b`
Esperado: código de saída 0, sem erro de console, e os arquivos
`screenshots/F16b-*.png` gravados.

- [ ] **Passo 3: abrir a evidência do aceite**

Abrir com Read **só** `screenshots/F16b-3-completo-ocupado.png` — a screenshot
do aceite. Conferir com os olhos: nome do prédio, HP, o nome do civil ocupante,
as gavetas e os dois botões. As outras capturas valem pelo código de saída;
imagem é o que mais pesa na janela de contexto (§8).

- [ ] **Passo 4: não-regressão dos roteiros que tocam o painel**

Run: `npm run shot -- F13b` → código de saída 0.
Run: `npm run shot -- F06` → código de saída 0 (é ele que afirma
`canvas.right <= painel.left`; o `<aside>` mudou de id e o CSS foi mexido).
**Sem abrir screenshot**: código de saída basta em roteiro de outra feature.

---

### Tarefa 8 — Fechar a sessão

- [ ] **Passo 1: `npm run verify`**

Run: `npm run verify`
Esperado: typecheck + lint + validate:data + test verdes, e o selo `.verify-ok`
criado (vale 15 min — o portão de `test-results.json`).

- [ ] **Passo 2: `PROGRESS.md`**

Registrar, **separando verificado de concluído**:
- o que a sonda da Tarefa 1 mediu, apontando para
  `test-output/F16b-sonda.json`, e o número que virou `TICKS_ATE_OCUPAR`.
  Nomear como **probe**: é a medição desta sessão e a linha de base da F17,
  **não** cobertura contínua;
- as decisões D1-D9 com o porquê, e as alternativas rejeitadas;
- D7 como **decisão do operador**, não como pergunta em aberto.

**Nada de pergunta em aberto nova nesta sessão.**

- [ ] **Passo 3: `IDEIAS.md` — a confirmação de demolir**

Entrada nova, no formato do arquivo: demolir é hoje um clique só; o custo
registrado é que **é o único botão que destrói trabalho de forma irreversível**,
e a devolução é parcial (`construcao.devolucaoAoDemolir = 0.5`), então o erro é
caro. Decisão do operador em 2026-09-23; congelado até `F17-aceite-fase-a`
passar, como todo o arquivo.

- [ ] **Passo 4: notas de contrato herdado no `BUILD_PLAN.md`**

O que uma feature futura herda vai na **Nota do item dela**, não só no PROGRESS:
- **F17**: (a) o painel é o que o roteiro de aceite usa para conferir prédio
  completo e ocupado, e `prediosDoEstado` (debug) é o campo a ler; (b) **a
  cadeia do aceite da Fase A já foi medida aqui** —
  `test-output/F16b-sonda.json` tem o tick de cada etapa, e a F17 **compara**
  contra eles em vez de descobri-los. Divergência grande é achado da F17, não
  ruído.
- **F22**: o painel já mostra `ocupante === null` como "Sem trabalhador"; o
  alerta do HUD é outro mecanismo, e não pode alertar em prédio **pausado**.

- [ ] **Passo 5: `test-results.json`**

Marcar `F16b` como `"passes": true` — só depois do `verify` verde e da
screenshot aberta. O hook recusa a escrita sem o selo.

- [ ] **Passo 6: commit**

```bash
git add -A
git commit -m "feat(F16b): painel de predio com ocupante, estoque, pausar e demolir"
```

---

## 5. Autorrevisão contra o escopo do BUILD_PLAN

| O escopo pede | Onde está |
|---|---|
| nome | Tarefa 5, `h2` ← `tema.predios[tipo].nome`; roteiro passo 2 e 7 |
| HP **ou** progresso de obra | D4; Tarefa 2 (`hp`/`hpTotal`/`progresso`); roteiro passos 4 e 7 |
| ocupante | D5; Tarefa 2 (`ocupante`, `pedeTrabalhador`); roteiro passo 7 |
| estoque de entrada e saída | D3; Tarefa 2 (`estoque`); roteiro passos 2 e 7 |
| botão pausar, sobre comando que já existe | D6; Tarefa 5; roteiro passos 8 e 9 |
| botão demolir, sobre comando que já existe | Tarefa 5; roteiro passo 10 |
| screenshot de prédio completo e ocupado | Tarefa 7, captura `completo-ocupado` |
| roteiro que demole por clique e confirma o prédio fora do estado | Tarefa 7, passos 10 e 11 |
| reusar `selecao.ts`, `predioNoTile`, `painelDaEscola` | §1 e D8 — nenhum mecanismo novo de seleção |
| `Esc` num ouvinte só | `src/input/teclado.ts` **não é tocado** |
| modo do Woodcutter's | fora, §0 — saiu na F16c por emenda do operador |

## 6. Riscos

1. **A cadeia do aceite pode não fechar.** É o risco que a Tarefa 1 existe para
   descobrir **antes** de qualquer código. Se travar: parar, `BUGS.md`
   severidade `trava`, reportar.
2. **A pedreira em `(38,31)` pode ser recusada** pela regra da porta da F16a.
   O roteiro afirma `plantaFantasma.valida` antes de clicar (Tarefa 7, passo 3),
   então a falha aparece no lugar certo. Se acontecer, deslocar a pedreira e
   registrar a medida em `BALANCE_LOG.md` — é exatamente a consequência que a
   nota da F17 manda medir.
3. **A troca de `#painel-escola` por `#painel-predio` atinge o roteiro da F13b.**
   Prevista na Tarefa 5 passo 4 e verificada na Tarefa 7 passo 4.

---

## 7. Resultado da sonda (medido em 2026-09-23)

Esta seção existe porque **`test-output/` é ignorado pelo git**: o JSON cru da
sonda (`test-output/F16b-sonda.json`) é local e não sobrevive à sessão. Os
números ficam aqui, num arquivo versionado, porque a F17 vai comparar contra
eles — e um artefato ignorado não é linha de base para ninguém.

Cadeia rodada **pelo caminho real, só com comandos**, sem injeção de estado.
Semente `20260920` (a de `economy.json`), uma pedreira, o cenário inicial.

Geometria, derivada do dado: pedreira em `(38,31)` (3×2, borda sul em y=32);
rua em `y=33`, de `x=29` a `x=40` (12 tiles). Nenhum `command-rejected` no
tick 1 — este encaixe **passa** na regra da porta da F16a.

| etapa | tick |
|---|---|
| treino começa | 29 |
| treino termina | 179 |
| obra completa | 220 |
| especialista ocupa | 241 |
| primeira pedra produzida | 408 |

Reprodutível: duas execuções, os mesmos ticks.

**Achado, com consequência para quem escrever roteiro depois:** a gaveta `saida`
da pedreira fica **vazia quase o tempo todo** — o carregador leva a pedra assim
que ela sai (pedra presente em **2 de 24** amostras entre os ticks 240 e 700).
Afirmar conteúdo de gaveta de prédio de produção **oscila**. Estoque cheio se
prova no **armazém**, que é onde ele para.

A sonda é **prova do momento**. A proteção permanente é `tools/shots/F16b.js`,
que roda a mesma cadeia a cada `npm run shot -- F16b`.
