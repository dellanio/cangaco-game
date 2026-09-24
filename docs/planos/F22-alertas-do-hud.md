# F22 — Alertas do HUD — plano de implementação

> **Para quem executa:** os passos usam caixa (`- [ ]`) para acompanhamento.
> Uma tarefa por vez, com teste e commit próprios.

**Objetivo:** o jogador descobre que um prédio está parado **sem clicar nele** —
o HUD mostra, sem seleção, as causas que já existem no estado de hoje.

**Arquitetura:** nada de estado novo. A derivação já nasceu pronta em três
features anteriores (F14, F15a, F08); o que falta é **mecanismo de exibição**.
Um seletor puro em `sim/selectors.ts` devolve a lista de alertas derivada do
`GameState`; um módulo de `src/ui/` escreve DOM a partir dela e traduz pelo
tema. `src/render/` **não é tocado** — o alerta é HTML sobre o canvas, como o
HUD e o painel.

**Stack:** TypeScript estrito, Vitest, Playwright. Sem dependência nova.

**Fila:** F22, antecipada pelo operador. Item escrito em `BUILD_PLAN.md:1134`.

## Restrições globais

- `src/sim/` não importa `phaser`, não toca `window`/`document`, não usa
  `Math.random()`/`Date.now()`. O seletor é puro e serializável.
- `sim/` **nunca** lê `data/theme-sertao.json`. A causa é um id neutro
  (`sem-trabalhador`); o texto que o jogador lê vem do tema, na `ui/`.
- Número de balanceamento não entra em `.ts` (§2.3). Este plano não introduz
  nenhum: todo limiar é predicado, não constante.
- `src/render/` e `src/sim/` não se tocam na mesma feature (§10). Esta feature
  toca `src/sim/selectors.ts`, `src/ui/`, `index.html` e `src/main.ts` —
  **nenhum arquivo de `src/render/`**. É o mesmo par que a F13b e a F16b usaram
  (seletor em `sim/`, desenho em `ui/`).
- Alerta sem causa não nasce (regra do `terreno` na F06).

---

## Os três pontos do operador, respondidos antes do código

### 1. A derivação de "prédio sem trabalhador" nasce pronta na F14 — confirmado

Lido no código, não suposto:

- `src/sim/ocupacao.ts:16` — `trabalhadorDoTipo(tipo)` devolve
  `data/buildings.json: trabalhador`, ou `null` quando o tipo não pede ninguém.
- `src/sim/ocupacao.ts:22` — `ehPredioOcupavel(predio)` é exatamente
  "completo **e** o tipo pede trabalhador", já como type guard.
- `src/sim/selectors.ts:447` — `painelDoPredio` já publica `pedeTrabalhador`
  separado de `ocupante: null`, com o comentário dizendo por que são dois campos
  e não um: **prédio que não pede trabalhador nunca pode alertar**.
- `data/buildings.json`: `storehouse`, `schoolhouse`, `inn`, `barracks`,
  `marketplace` e `town_hall` têm `trabalhador: null` — os dois prédios da vila
  inicial estão nessa lista, então o jogo **não abre com alerta**.

O alerta reusa `ehPredioOcupavel` e `predio.ocupante === null`. Nada de campo
novo, nada de FSM, nada de evento.

### 2. Quais alertas ficam de fora, e por quê

O item da fila lista quatro: sem trabalhador, sem estrada, fome, mina esgotada.
Verifiquei **caso a caso** se a causa tem produtor com o dado publicado hoje:

| Causa | Produtor hoje | Entra? |
|---|---|---|
| sem trabalhador | `ehPredioOcupavel` + `ocupante === null` (F14) | **sim** |
| sem estrada | `predioLigadoAoArmazem` (F08); `systems/especialistas.ts:184` congela o ciclo com ele, e `motivoDaEspera` (F13b) já o usa | **sim** |
| mina esgotada | `veioEsgotado` (`sim/producao.ts:82`) e o evento `vein-exhausted` (`systems/especialistas.ts:153`); **`data/production.json:5` dá `veio.rendimento: 200` à `quarry`**, que é prédio construível hoje | **sim** |
| fome | ninguém: não há consumo nem estado de fome antes da F20 | **não** |
| sendo atacado | ninguém: não há combate antes da F28 | **não** |

**Divergência do que o pedido supunha, com a evidência:** "mina esgotada" **tem**
produtor hoje. A `quarry` é a única com `veio` no dado, e ela aparece no menu
Construir desde a Fase A (Tábua 3 · Pedra 2, sem requisito). `tests/F15a-*.ts`
já afirmam `vein-exhausted` saindo uma vez com veio curto injetado. A F21 traz
`gold_mine`/`iron_mine`, que são **mais** minas, não a primeira: adiar o alerta
até lá seria deixar sem aviso a única mina que o jogador já consegue construir.
Por isso ela entra — e o teste a cobre com dado injetado, como a F15a faz, em
vez de esperar 55 min de produção.

**Ficam de fora: `fome` e `sendo atacado`** — e não ficam escritos em lugar
nenhum do código, nem como constante comentada. Quem os criar cria a causa junto.

### 3. Pausa deliberada não alerta — e o rótulo não serve

A Nota da F16c: o jogador que pausou sabe que parou; avisá-lo é ruído, e é o
caminho mais curto para ele desligar os alertas. E cuidado com o rótulo — o
especialista de um prédio pausado **continua em `trabalhando`**, porque a pausa
não é estado de FSM.

Decisão, mais conservadora que a nota pede: **prédio pausado não produz alerta
nenhum**, não só o de "parado". Um prédio pausado e vago é um prédio que o
jogador desligou; as duas coisas são a mesma decisão dele. A regra fica num
lugar só, na entrada do laço do seletor, e nenhum alerta é derivado de rótulo de
FSM — os três saem de campo (`ocupante`, `producao.veio`) ou de predicado
(`predioLigadoAoArmazem`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/sim/selectors.ts` (modificar) | `CAUSAS_DE_ALERTA`, `CausaDeAlerta`, `Alerta`, `alertasDoEstado(state, dados)`. Derivação pura, sem estado novo. |
| `src/ui/alertas.ts` (criar) | `montarAlertas()` → `{ atualizar(estado) }`. Agrupa por causa, conta, traduz pelo tema, some quando não há alerta. Irmão de `ui/hud.ts`. |
| `data/theme-sertao.json` (modificar) | seção `alertas`: um rótulo por causa. |
| `index.html` (modificar) | `<div id="alertas">` e o CSS: sobreposição no **canto superior direito** da célula do canvas. |
| `src/main.ts` (modificar) | monta e chama `alertas.atualizar(s)` junto de `hud`/`menu`/`painel`. |
| `tests/F22-alertas.test.ts` (criar) | o aceite headless e os guardas. |
| `tools/shots/F22.js` (criar) | o aceite visual. |
| `BUILD_PLAN.md`, `PROGRESS.md`, `test-results.json` | fila, memória, portão. |

**Por que o canto superior direito:** `#painel-predio` é `place-self: end start`
— canto **inferior esquerdo** da mesma célula (`index.html:60`). O alerta no
canto oposto não disputa espaço com ele nem com `#menu-build`, que está em outra
coluna da grade. Isso é **hipótese de layout**: o passo 0 do roteiro **mede** os
retângulos e reprova se houver interseção (§8 — causa visual só vale medida).

---

## Tarefa 1 — O seletor: os três alertas que têm causa hoje

**Arquivos:** modificar `src/sim/selectors.ts`; criar `tests/F22-alertas.test.ts`.

**Interfaces produzidas** (o que a Tarefa 2 consome):

```ts
export const CAUSAS_DE_ALERTA = ['sem-trabalhador', 'sem-estrada', 'veio-esgotado'] as const;
export type CausaDeAlerta = (typeof CAUSAS_DE_ALERTA)[number];
export interface Alerta {
  readonly predio: string;   // id no estado ('q1')
  readonly tipo: string;     // id NEUTRO do tipo ('quarry'); o tema traduz
  readonly causa: CausaDeAlerta;
}
export function alertasDoEstado(state: GameState, dados?: GameData): readonly Alerta[];
```

- [ ] **Passo 1: escrever o teste que falha**

Casos, cada um com o porquê no nome:

```ts
it('pedreira completa e vaga alerta sem-trabalhador', ...)
it('a mesma pedreira ocupada nao alerta', ...)
it('PAUSA DELIBERADA nao alerta nada, nem sem-trabalhador', ...)
it('predio que NAO pede trabalhador nunca alerta sem-trabalhador', ...)  // storehouse, schoolhouse
it('obra nao alerta: nao ha trabalhador a esperar antes de o predio existir', ...)
it('pedreira sem ligacao ao armazem alerta sem-estrada; ligada, nao', ...)
it('veio esgotado alerta, com o rendimento injetado pelo dado', ...)     // como a F15a
it('a ordem e a de predios.ordem, e as causas em ordem fixa', ...)       // determinismo
it('nenhuma causa sem produtor: fome e ataque nao existem na lista', ...)
```

- [ ] **Passo 2: rodar e ver falhar** — `npx vitest run tests/F22-alertas.test.ts`.
      Esperado: falha em `alertasDoEstado is not a function`.

- [ ] **Passo 3: implementar**

```ts
export function alertasDoEstado(
  state: GameState, dados: GameData = gameData,
): readonly Alerta[] {
  const alertas: Alerta[] = [];
  for (const id of state.predios.ordem) {          // ordem explicita, nunca Object.keys
    const predio = state.predios.porId[id];
    if (predio === undefined || predio.estado !== 'completo') continue;
    // Pausa deliberada nao alerta (Nota da F16c): quem pausou sabe que parou.
    // Le o CAMPO, nunca o rotulo da FSM — o especialista de um predio pausado
    // continua em `trabalhando`.
    if (predio.pausado) continue;
    for (const causa of CAUSAS_DE_ALERTA) {
      if (temCausa(state, predio, causa, dados)) alertas.push({ predio: id, tipo: predio.tipo, causa });
    }
  }
  return alertas;
}
```

`temCausa` é um `switch` sobre a união, sem `default`, para o typecheck acusar
quando uma causa nova entrar sem derivação:

- `sem-trabalhador`: `ehPredioOcupavel(predio, dados) && predio.ocupante === null`.
- `sem-estrada`: `precisaDoArmazem(state, predio, dados) && !predioLigadoAoArmazem(state, predio, dados)`,
  onde `precisaDoArmazem` é `predio.producao !== null` **ou** escola completa com
  item na fila aguardando (é o `motivoDaEspera` da F13b que já distingue
  `sem-estrada` de `sem-ouro`). Escola com fila vazia não espera nada e não alerta.
- `veio-esgotado`: `predio.producao !== null && veioEsgotado(predio.producao, receita)`.
  **Usa o predicado do runtime** (`sim/producao.ts:82`), não `veio === 0` como a
  Nota da F15a escreveu: é `veioEsgotado` que congela a produção, e ele reprova
  já em `veio < unidadesPorCiclo` — com receita de 2 por ciclo, o prédio para com
  `veio === 1` e o alerta tem de sair aí, não um ciclo depois de o jogador ter
  percebido sozinho.

- [ ] **Passo 4: rodar até o verde**, e conferir que o teste do veio usa dado
      injetado (`{...gameData, producao: {...}}`), nunca 200 unidades de espera.

- [ ] **Passo 5: gravar evidência** — `gravarEvidencia('F22', {...})` com a lista
      de alertas de cada cenário e as causas deixadas de fora, nomeadas.

- [ ] **Passo 6: commit** — `feat(F22): os tres alertas que tem causa hoje, derivados sem estado novo`.

---

## Tarefa 2 — A exibição: o HUD avisa sem seleção

**Arquivos:** criar `src/ui/alertas.ts`; modificar `data/theme-sertao.json`,
`index.html`, `src/main.ts`; acrescentar casos a `tests/F22-alertas.test.ts`.

- [ ] **Passo 1: o tema** — seção `alertas` em `data/theme-sertao.json`, uma
      chave por causa, no vocabulário do sertão. `npm run validate:data` tem de
      seguir verde (o tema não tem schema de chave fixa; o guarda é o do passo 2).

- [ ] **Passo 2: o guarda de que rótulo e causa não se separam**

Teste estrutural, não textual: itera `CAUSAS_DE_ALERTA` (a lista real,
importada) e exige chave no tema para cada uma; e exige que o tema não tenha
rótulo sobrando — rótulo sem causa é alerta que alguém tirou e esqueceu de
limpar. Roda no `npm run verify`, então a causa nova nasce com texto ou o
verify reprova.

- [ ] **Passo 3: `src/ui/alertas.ts`**

Irmão de `ui/hud.ts`: monta o DOM uma vez, `atualizar` só reescreve texto.
Agrupa por causa **na ordem de `CAUSAS_DE_ALERTA`** (ordem estável, não
`Object.keys`), uma linha por causa com a contagem; `hidden` quando a lista vem
vazia — HUD que mostra "0 alertas" é ruído permanente.

- [ ] **Passo 4: `index.html`** — `<div id="alertas" hidden>` na célula do canvas,
      `place-self: start end`, e o CSS nas cores do painel.

- [ ] **Passo 5: `src/main.ts`** — `const alertas = montarAlertas();` e
      `alertas.atualizar(s)` dentro de `atualizar`. Nada mais: o alerta é
      derivado, não tem evento nem assinatura própria.

- [ ] **Passo 6: `npm run verify`** e commit —
      `feat(F22): o alerta aparece no HUD, sem o jogador clicar em prédio nenhum`.

---

## Tarefa 3 — O aceite visual

**Arquivos:** criar `tools/shots/F22.js`.

- [ ] **Passo 1: escrever o roteiro**

Em prosa, antes de código. Passo 0 **mede o layout**: pega os retângulos de
`#alertas`, `#painel-predio` e do canvas e afirma que o alerta está dentro da
célula do canvas e **não intersecta** o painel (§8: causa visual só vale medida;
"está atrás do painel" já errou duas vezes nesta base). Depois:

1. abertura: nenhum alerta — a vila inicial só tem prédios que não pedem
   trabalhador. `#alertas` está `hidden`.
2. puxa estrada e planta uma pedreira; espera a obra fechar (teto de ticks com
   folga, e o roteiro **para no marco**, não no teto, como o da F17).
3. com a pedreira completa e sem cabra treinado: o alerta "sem trabalhador"
   aparece, com contagem 1. **Captura.**
4. pausa a pedreira pelo painel: o alerta some. **Captura** — é a prova da Nota
   da F16c, e é o que o teste headless não mostra.
5. retoma e demole um tile da estrada que liga a pedreira ao armazém: aparece
   também "sem estrada", contagem 2. **Captura.**

O texto afirmado vem de `data/theme-sertao.json` carregado pelo roteiro, nunca
digitado — mesma regra do F17.

- [ ] **Passo 2: rodar** — `npm run shot -- F22`. Esperado EXIT=0, `errosDeConsole: []`.
- [ ] **Passo 3: abrir com Read** só as capturas desta feature (§8).
- [ ] **Passo 4: não-regressão por CÓDIGO DE SAÍDA**, sem abrir imagem:
      `F04 F05b F06 F16b F17 F18a F18b`.
- [ ] **Passo 5: commit** — `feat(F22): o roteiro que prova o alerta na tela, e que pausa nao alerta`.

---

## Tarefa 4 — Fila, memória e portão

- [ ] **Passo 1: `BUILD_PLAN.md`** — o item F22 não tem **Escopo/Aceite/
      Evidência** escritos, só a linha de causas e as quatro Notas. Escrever os
      três, sem mexer nas Notas, e registrar em `PROGRESS.md` que o critério foi
      escrito nesta sessão a partir da linha de causas — é interpretação minha,
      não critério herdado (§14: na dúvida, a leitura mais conservadora, e
      registrada).
- [ ] **Passo 2: `PROGRESS.md`** — Verificado separado de Decidido; a tabela de
      produtor por causa; as duas causas deixadas de fora com o nome da feature
      que as cria; a divergência sobre "mina esgotada" com a evidência do dado.
- [ ] **Passo 3: `npm run verify`** e então `test-results.json`
      (`"F22-alertas-do-hud": { "passes": true }`). O selo vale 15 minutos.
- [ ] **Passo 4: commit** — `feat(F22): alertas do HUD, com as causas sem produtor deixadas de fora`.

---

## Auto-revisão

| Risco | Onde foi tratado |
|---|---|
| Alerta sem causa (regra do `terreno` na F06) | Ponto 2: tabela produtor-a-produtor; `fome` e `sendo atacado` não aparecem nem como constante. |
| Alerta derivado de rótulo de FSM (Nota F16c) | Tarefa 1 passo 3: os três saem de campo ou predicado; `pausado` barra na entrada do laço. |
| Ruído em pausa deliberada | Prédio pausado não gera alerta nenhum, decisão registrada. |
| `sim/` lendo o tema (§9) | A causa é id neutro; o rótulo mora no tema e é lido só pela `ui/`. |
| Rótulo e causa se separarem | Tarefa 2 passo 2: guarda estrutural itera a lista real e exige ida e volta. |
| Tocar `src/render/` e `src/sim/` juntos (§10) | `src/render/` não é tocado. |
| "Está atrás do painel" | Tarefa 3 passo 1: o passo 0 mede retângulo, não descreve. |
| Número mágico em `.ts` | Nenhum: todo limiar é predicado já existente. |
