# F17 — Aceite da Fase A · plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, inline.
> Os passos usam `- [ ]` para acompanhamento. `subagent-driven-development` e
> `dispatching-parallel-agents` estão **proibidos** (CLAUDE.md §11).

**Objetivo:** provar, na tela e por clique, que a abertura da Fase A fecha — 2
Woodcutter's, 1 Quarry e 1 Sawmill completos e ocupados, ligados por estrada, e o
timber no armazém acima do estoque inicial — e **medir** o que a fila mandou medir.

**Arquitetura:** nada de `src/` muda. A feature é um **teste headless** que dirige
a abertura só com comandos reais (`PlaceRoad`, `PlaceBlueprint`, `EnqueueTraining`)
e grava a medição em `test-output/F17.json`, mais um **roteiro Playwright** que faz
a mesma abertura só com cliques e fotografa a vila.

**Stack:** Vitest (headless, `environment: node`), Playwright via `npm run shot`.

**Fonte do critério:** `BUILD_PLAN.md`, item F17 (e as três notas que a F16a e a
F16b deixaram lá). Escopo herdado: `docs/planos/F16b-painel-predio.md` §7.

## Restrições globais

- `src/sim/` não muda nesta feature. `src/render/` **também não** — ver D4.
- Nenhum número de balanceamento digitado em `.ts`/`.js`: geometria e custos saem
  de `data/*.json`; tempos saem da medição da Tarefa 1, com folga declarada.
- Iterar `ordem`, nunca `Object.keys` (contrato da F05a).
- **Nenhuma asserção sobre a gaveta `saida`/`entrada` de prédio de produção**
  (ponto 4 do operador; nota medida da F16b). Estoque se prova no **armazém**.
- Evidência de regressão é código de saída; abrir imagem com Read só a da F17
  (CLAUDE.md §8).

---

## 0. Escopo e autorização

O item diz "(integração)", e o escopo escrito é **roteiro Playwright**. Este plano
não toca `src/` — logo a exceção da §10 (render + sim na mesma feature) nem chega
a ser exercida. Se em execução aparecer necessidade de mexer em `src/sim/`, isso
**não** é ajuste desta feature: parar, registrar e reportar.

Fora de escopo, declarado: qualquer mudança de balanceamento (vai para
`BALANCE_LOG.md`, ajustada em lote — CLAUDE.md §12), a regra da porta de uma
coluna (é a saída *condicional* que a nota da F16a descreve, e só se a medição
mostrar aperto), e qualquer item da F18+.

---

## 1. Leitura desconfiada do critério (ponto 1 do operador)

O critério foi escrito antes de existir código. A F15a e a F15b já acharam dois
critérios impossíveis neste mesmo lote. Abaixo, cláusula por cláusula, o que eu
já consegui checar **na aritmética dos dados** antes de rodar qualquer coisa, e o
que só a Tarefa 1 responde. Nenhum destes números foi medido ainda: são
**previsões**, e existem para poder estar erradas.

| Cláusula | Satisfazível? | Conta | Confirma em |
|---|---|---|---|
| "2 Woodcutter's, 1 Quarry, 1 Sawmill **completos**" | sim, mas **serializado** | `sawmill.desbloqueadoPor = woodcutters`, e `estaDesbloqueado` olha `tiposJaConstruidos`, que é histórico de **`building-completed`**. A serraria só pode ser plantada depois que **uma** casa de lenhador terminar. | T1 |
| "**ocupados**" | sim | os quatro pedem trabalhador (`stonemason`, `woodcutter`×2, `carpenter`); treino custa 1 ouro (`custoOuroPorUnidade`), 4 de 20; a fila da escola tem 5 slots e `tiposTreinaveis` é a lista inteira de civis desde o tick 0 — dá para enfileirar os quatro antes de existir prédio. | T1 |
| "ligados por estrada" | sim | 14 tiles de rua na linha da porta (D1) × `estrada.custoStonePorTile = 1`. | T1 |
| "estoque de timber **maior que o inicial**" | sim, mas é a cláusula **cara** | inicial 40; as quatro plantas debitam 3+3+3+4 = **13** → sobram 27; para passar de 40 a serraria precisa entregar **14+**, a 2 timber por ciclo = **7 ciclos**. Ciclo medido na F15b: 273 ticks → **~1900 ticks** só de regime, mais a partida (primeiro tronco 628, primeiro timber 968 no oráculo). | T1 |
| pedra alcança? | sim, com folga | 30 iniciais − 14 de rua − 9 das quatro plantas (2+2+2+3) = **7 de sobra**, e a pedreira ainda repõe. | T1 |

**Previsão do total:** ~4000–4800 ticks (≈ 7–8 min de jogo a 1×). O GDD §1.3 diz
"[proposta] deve caber em 8–10 minutos". Se a medição der muito acima disso, o
achado é do **ritmo** (BALANCE_LOG), não do critério.

**O risco real não é nenhuma cláusula sozinha — é a soma:** um roteiro Playwright
de ~4500 ticks. Se a Tarefa 1 mostrar que o timber só passa de 40 perto dos 6000
ticks, a correção honesta do critério (**com a medição ao lado**, nunca fabricando
comportamento) é trocar "maior que o inicial" por "maior que o estoque **depois de
pagas as quatro plantas**, e a serraria entregando timber ao armazém" — que é o
que a cláusula quer dizer (a economia fechou o ciclo madeira → tronco → tábua) sem
exigir que o roteiro pague os 13 de volta. **Essa troca só entra com o número
medido ao lado, e vai reportada ao operador, não escondida no diff.**

---

## 2. O que já existe e vai ser reusado (nada de mecanismo novo)

| Preciso de | Já existe | Onde |
|---|---|---|
| rodar a sim headless com comandos | `step()` + fixtures dos testes | `tests/helpers/*.ts` |
| gravar evidência JSON | `gravarEvidencia(feature, dados)` | `tests/helpers/evidence.ts` |
| saber se um prédio está ligado | `predioLigadoAoArmazem(state, predio)` | `src/sim/estradas.ts:228` |
| estoque do armazém | `estoqueDosArmazens(state)` | `src/sim/selectors.ts:49` |
| desbloqueio | `estaDesbloqueado(state, id)` | `src/sim/desbloqueio.ts:20` |
| clicar tile ↔ pixel, arrastar rua | `pontoDoTile`, `arrastarDentroDoCanvas` | `tools/shots/F13b.js:41`, `tools/shots/_canvas.js` |
| achar prédio recém-construído | `window.__cangaco.prediosDoEstado` (tipo, estado, gx, gy, pausado, ocupante) | `src/render/debug.ts` (F16b) |
| andar o relógio pausado | `window.__cangaco.avancar(n)` | idem |
| mover a câmera | arrasto com **botão do meio** | `tools/shots/F04.js:63` |
| ler estoque na tela | `#hud .valor[data-campo="<mercadoria>"]` | `tools/shots/F05b.js:26` |

---

## 3. Mapa de arquivos

- **Criar** `tests/helpers/abertura.ts` — a abertura da Fase A como dado: a
  geometria derivada de `data/*.json` (D1) e o **roteiro de comandos** (D2). Sem
  asserção nenhuma; é fixture, usada pela sonda e pelo teste.
- **Criar** `tests/F17-aceite.test.ts` — roda a abertura, afirma o critério e
  grava `test-output/F17.json` (marcos + as três medições).
- **Criar** `tools/shots/F17.js` — o roteiro de cliques + `screenshots/F17-final.png`.
- **Modificar** `BALANCE_LOG.md` — o veredicto medido das três observações.
- **Modificar** `BUILD_PLAN.md` — só se o critério for corrigido (§1), e com o número.
- **Modificar** `PROGRESS.md`, `test-results.json`.
- **Modificar** este arquivo — §8, com a medição, que é versionada (`test-output/`
  é ignorado pelo git; foi o erro corrigido na F16b).

---

## 4. Decisões

**D1 — A geometria da abertura: os quatro na linha da porta do armazém, à esquerda.**
Derivada, não digitada: `yRua = armazem.gy + altura(armazem)` (= 33), prédios com
`gy = yRua - 2` (todos os quatro têm altura 2), encostados na horizontal, e a rua
é **uma linha reta** de `x` do prédio mais à esquerda até `armazem.gx`.

```
ordem da esquerda para a direita: woodcutters, woodcutters, quarry, sawmill, ARMAZÉM
x:                                16..18       19..21       22..24  25..28   29..31
rua: y=33, x=16..29  ->  14 tiles  ->  14 stone
```

Por quê: (a) a **serraria encostada no armazém** — é o par de maior tráfego
(tronco entra, tábua sai) e encurtar essa perna é o que mais mexe no ritmo;
(b) uma linha de porta só, uma rua só, zero coluna vertical: é o arranjo mais
barato em pedra que a regra da porta permite; (c) tudo cabe num quadro de câmera,
o que o roteiro precisa para clicar (D3).

A regra da porta (F16a) é respeitada por construção: nenhum prédio fica **abaixo**
de outro, e a linha `y=33` só tem rua. Os prédios se encostam na **horizontal**,
que a regra permite. Isso é exatamente a consequência que a nota da F16a manda
medir — ver D5.

**D2 — O roteiro de comandos reage ao estado, não ao relógio.** A serraria não pode
ser plantada antes de uma casa de lenhador **completar**. Então a fixture não é
uma lista de comandos no tick 0: é uma função `comandosNoTick(state, tick)` que
planta a serraria **no primeiro tick em que `estaDesbloqueado(state, 'sawmill')`**.
É o mesmo que o roteiro de cliques faz (avança em blocos até o prédio aparecer
completo, aí clica). Sem isso, o comando seria recusado e o teste mediria outra
coisa.

**D3 — O roteiro centraliza a câmera uma vez, no começo.** A câmera nasce centrada
na vila (≈ x33) e o trecho a clicar é x16..x29; com viewport 1280×720 e tile de
64px, x16 não está visível no boot. Um arrasto com o **botão do meio** (mecanismo
da F04, já provado) resolve, e `pontoDoTile` continua válido porque relê
`camera.scrollX` a cada chamada. O roteiro **afirma** que todo tile que vai clicar
caiu dentro do canvas — `pontoDoTile` já lança se não cair.

**D4 — Nada entra em `src/render/debug.ts`.** A tentação era publicar
`ligadoAoArmazem` na ponte para o roteiro afirmar "ligados por estrada" direto.
Não: a ponte é para o que a tela **mostra**, e a ligação já se prova por
consequência, mais forte que um booleano — prédio não ligado **nunca recebe
material**, então quatro obras que viraram `completo` e uma serraria cujo timber
**chegou ao armazém** só são possíveis com a rede de pé. O booleano fica no teste
headless (`predioLigadoAoArmazem`), que é onde ele é barato e direto.

**D5 — As três medições do BALANCE_LOG saem da sonda, não do roteiro.** As três
perguntam sobre o *interior* da simulação (para qual obra cada laborer foi, quanto
espaço a vila ocupou, quantos ticks cada etapa levou). Isso se mede em Node, com o
`GameState` na mão, não por DOM. O roteiro prova a mesma coisa **na tela**; a
medição fica no JSON e, versionada, no §8 deste arquivo.

**D6 — Estoque só se afirma no armazém.** Ponto 4 do operador e nota medida da
F16b: a gaveta `saida` de um prédio de produção fica vazia quase sempre (pedra
presente em 2 de 24 amostras). O roteiro lê `#hud [data-campo="timber"]`; o teste
lê `estoqueDosArmazens`. Nenhum dos dois toca em `[data-gaveta]` de produção.

**D7 — Se a cadeia travar, parar.** Se algum marco não fechar dentro do teto de
ticks da sonda, isso **não** se resolve improvisando regra de prioridade nem
afrouxando o critério: registra-se o travamento e reporta-se. (É a mesma
disciplina da sonda da F16b.)

---

## 5. Tarefas

### Tarefa 1 — A sonda que mede (sem asserção de aceite ainda)

**Arquivos:** criar `tests/helpers/abertura.ts`; criar (temporário)
`tests/F17-sonda.test.ts`.

**Interfaces produzidas** (as tarefas seguintes dependem destes nomes):

```ts
// tests/helpers/abertura.ts
export interface PlantaDaAbertura {
  readonly tipo: string;            // 'woodcutters' | 'quarry' | 'sawmill'
  readonly gx: number; readonly gy: number;
  readonly civil: string;           // buildings[tipo].trabalhador
}
export interface Abertura {
  readonly plantas: readonly PlantaDaAbertura[];  // na ordem de plantio
  readonly rua: readonly { readonly gx: number; readonly gy: number }[];
  readonly armazem: string;         // id do armazém inicial
  readonly escola: string;          // id da escola inicial
  readonly tilesDeRua: number;
  readonly stoneDaRua: number;
}
export function aberturaDaFaseA(state: GameState, dados?: GameData): Abertura;
export function comandosNoTick(
  state: GameState, abertura: Abertura, tick: number,
): readonly Command[];
export interface Marcos { [nome: string]: number | null }
export function registrarMarcos(
  state: GameState, abertura: Abertura, marcos: Marcos,
): Marcos;
```

- [ ] **Passo 1: escrever `aberturaDaFaseA`.** Deriva D1 de `data/*.json`: acha o
  armazém e a escola completos em `state.predios.ordem`; `yRua = armazem.gy + alt`;
  monta as quatro plantas da esquerda para a direita nas larguras de
  `buildings.tamanho`, terminando encostada em `armazem.gx`; a rua é a linha
  `y = yRua` de `x` da primeira planta até `armazem.gx`. **Lança** se alguma altura
  não for 2 (a linha única só vale com alturas iguais) — invariante estrutural, não
  número mágico.

- [ ] **Passo 2: escrever `comandosNoTick`.** Tick 0: `PlaceRoad` da rua inteira,
  `PlaceBlueprint` das três plantas desbloqueadas de saída, e `EnqueueTraining` dos
  quatro civis (`plantas[i].civil`) na escola. Depois: no primeiro tick em que
  `estaDesbloqueado(state,'sawmill')` e a serraria ainda não foi plantada, emite o
  `PlaceBlueprint` dela. Nada mais.

- [ ] **Passo 3: escrever `registrarMarcos`.** Grava o **primeiro** tick em que cada
  coisa passa a valer, e nunca sobrescreve: `rua-pronta`, `plantadas-3`,
  `sawmill-desbloqueada`, `sawmill-plantada`, `<tipo>-completo` (por prédio),
  `todos-completos`, `todos-ocupados`, `primeira-pedra`, `primeiro-tronco`,
  `primeiro-timber`, `timber-acima-do-inicial`. Mais, a cada 50 ticks, uma amostra
  de: quantos laborers em cada obra (`unidade.fsmData` → obra alvo), estoque do
  armazém, e tarefas por tipo no JobBoard.

- [ ] **Passo 4: `tests/F17-sonda.test.ts`** — roda `createInitialState(semente)` por
  até **8000** ticks (teto generoso: a previsão é ~4500), aplicando
  `comandosNoTick` a cada passo, e grava tudo em `test-output/F17-sonda.json`.
  Uma asserção só, e frouxa: `expect(marcos['todos-ocupados']).not.toBeNull()`.

- [ ] **Passo 5: rodar e ABRIR o JSON com Read.** `npx vitest run tests/F17-sonda.test.ts`
  — e ler o arquivo, não descrever de memória.
  **Se algum marco vier `null`: PARAR, registrar em `PROGRESS.md` e reportar** (D7).

- [ ] **Passo 6: comparar com a linha de base da F16b** (ponto 3 do operador):
  treino 29–179, obra 220, ocupação 241, primeira pedra 408 — medidos com **uma**
  pedreira. Escrever a diferença, com as duas colunas lado a lado, no §8 deste
  arquivo. Não commitar ainda.

### Tarefa 2 — O teste de aceite (o guarda permanente)

**Arquivos:** criar `tests/F17-aceite.test.ts`; apagar `tests/F17-sonda.test.ts`.

- [ ] **Passo 1: escrever o teste** com o teto de ticks = marco medido + 25% de
  folga (o número vem da Tarefa 1, com o comentário dizendo de onde veio), e as
  asserções do critério, uma por cláusula:

```ts
const contagem = contagemPorTipo(estado); // src/sim/selectors.ts
expect(contagem['woodcutters']).toBe(2);
expect(contagem['quarry']).toBe(1);
expect(contagem['sawmill']).toBe(1);
for (const p of prediosDaAbertura(estado, abertura)) {
  expect(p.estado).toBe('completo');
  expect(p.ocupante).not.toBeNull();
  expect(predioLigadoAoArmazem(estado, p.id)).toBe(true);
}
expect(estoqueDosArmazens(estado)['timber']).toBeGreaterThan(timberInicial);
```

- [ ] **Passo 2: rodar; tem que passar.** Se a última cláusula não passar dentro do
  teto, **não aumentar o teto em silêncio**: é o caso de §1 — corrigir o critério
  com o número ao lado e reportar.
- [ ] **Passo 3: `gravarEvidencia('F17', {...})`** com marcos, as três medições e o
  balanço de pedra/timber. É o `test-output/F17.json` que o item pede como evidência.
- [ ] **Passo 4: `npm run test`** inteiro — nenhum outro teste pode ter ficado mais
  lento a ponto de estourar, e nenhum pode quebrar.
- [ ] **Passo 5: commit** `feat(F17): abertura da Fase A fecha em teste headless, com medicao`.

### Tarefa 3 — As três medições viram texto (ponto 2 do operador)

**Arquivos:** `BALANCE_LOG.md`, §8 deste arquivo.

- [ ] **Passo 1: laborers na última obra plantada.** Da amostragem do Passo 3 da
  Tarefa 1: quantos laborers em cada obra ao longo do tempo, e se as obras fecharam
  na ordem de plantio ou a última monopolizou. Veredicto escrito: confirma a
  observação de 2026-09-22, ou ela era artefato do cenário sem entrega de material.
- [ ] **Passo 2: a vila esparsa.** Medir a **área ocupada**: largura em tiles de
  x mínimo a x máximo, quantos tiles de rua, e quantos tiles ficaram vazios só por
  causa da regra da porta. Veredicto: coube confortavelmente ou forçou espaçamento.
  Se apertou, **não mexer na regra**: registrar que a saída indicada é a porta de
  uma coluna (nota da F16a) e deixar para um lote de balanceamento.
- [ ] **Passo 3: o ritmo.** Total de ticks até o critério fechar, em minutos a 1×
  (`tick = 100ms`), contra o "8–10 minutos" do GDD §1.3, e contra a partida do
  oráculo já medida (primeira pedra 207, primeiro tronco 628, primeiro timber 968).
- [ ] **Passo 4: escrever os três veredictos em `BALANCE_LOG.md`**, datados, **sem
  ajustar número nenhum** (CLAUDE.md §12: balanceamento se ajusta em lote).
- [ ] **Passo 5: commit** `docs(F17): veredicto medido das tres observacoes do BALANCE_LOG`.

### Tarefa 4 — O roteiro de cliques

**Arquivos:** criar `tools/shots/F17.js`.

- [ ] **Passo 1: cabeçalho** dizendo o que o roteiro existe para provar na tela, e
  o que ele **não** afirma (gaveta de produção — D6).
- [ ] **Passo 2: geometria**, derivada dos JSON como em `F13b.js` (`noDado`,
  `defDe`) — a **mesma regra** de D1, não os números copiados. Afirmar
  `tilesDeRua × custoStonePorTile + custo das 4 plantas <= estoque inicial de stone`:
  se um dia o dado mudar, o roteiro falha dizendo *por quê*, em vez de sumir com a
  pedra no meio.
- [ ] **Passo 3: centralizar a câmera** (D3) com arrasto de botão do meio, e afirmar
  que `camera.scrollX` mudou.
- [ ] **Passo 4: puxar a rua** com `arrastarDentroDoCanvas`, `avancar(1)`, afirmar
  `estradasRenderizadas === tilesDeRua` e que a pedra no HUD caiu exatamente o custo.
- [ ] **Passo 5: plantar as três** (`[data-predio="<tipo>"]` → clique no tile),
  afirmando a cada uma que `prediosDoEstado` ganhou um prédio **naquele gx,gy**
  (isto também documenta que o tile clicado é o canto do footprint).
- [ ] **Passo 6: enfileirar os quatro treinos** pelo painel da escola
  (`[data-treinar="<civil>"]`), afirmando `filaDeTreino` com 4 itens no estado.
- [ ] **Passo 7: avançar em blocos de 50** até a primeira casa de lenhador ficar
  `completo`, teto = número medido na Tarefa 1 + folga; **plantar a serraria**;
  afirmar que o item dela **aparece** no menu Build só agora (é o desbloqueio na tela).
- [ ] **Passo 8: avançar até o critério fechar**, teto medido + folga. Afirmar:
  4 prédios `completo` com `ocupante !== null` em `prediosDoEstado`, e
  `#hud [data-campo="timber"]` maior que o valor inicial de `economy.json`.
- [ ] **Passo 9: `capturar('final')`** — a vila inteira, que é o screenshot do item.
- [ ] **Passo 10: rodar** `npm run shot -- F17`, **abrir `screenshots/F17-final.png`
  com Read** e descrever o que está lá de fato.
- [ ] **Passo 11: commit** `feat(F17): roteiro de aceite da Fase A, so com cliques`.

### Tarefa 5 — Fechar

- [ ] **Passo 1: regressões** — `npm run shot -- F16b`, `F13b`, `F07`, `F08`,
  `F06`: conferir **código de saída**, sem abrir imagem (CLAUDE.md §8).
- [ ] **Passo 2: `npm run verify`** (typecheck + lint + validate:data + test).
- [ ] **Passo 3: §8 deste arquivo** com a tabela de marcos medida — versionada,
  porque `test-output/` é ignorado pelo git.
- [ ] **Passo 4: `PROGRESS.md`** — decisões, **Verificado** separado de **Hipótese**,
  e o que ficou aberto.
- [ ] **Passo 5: `test-results.json`** → `"F17-aceite-fase-a": true` (só depois do
  selo do `verify`, que vale 15 min).
- [ ] **Passo 6: commit** `feat(F17): aceite da Fase A fecha, com medicao dos tres pontos`.
- [ ] **Passo 7:** lembrar ao operador que a F17 passando **descongela `IDEIAS.md`**
  (CLAUDE.md §12). Não agir sobre isso nesta sessão.

---

## 6. Auto-revisão contra o item do BUILD_PLAN

- "roteiro Playwright que executa sessão inteira, só com cliques" → Tarefa 4. ✔
- "2 Woodcutter's, 1 Quarry, 1 Sawmill completos e ocupados" → T2 P1, T4 P8. ✔
- "ligados por estrada" → T2 P1 (`predioLigadoAoArmazem`) + consequência na tela (D4). ✔
- "estoque de timber maior que o inicial" → T2 P1 e T4 P8, **com a ressalva de §1**. ✔
- "Screenshot final da vila" → T4 P9/P10. ✔
- "`test-output/F17.json`" → T2 P3. ✔
- Nota F16a (medir consequência da porta) → T3 P2. ✔
- Nota F16b (comparar com a linha de base) → T1 P6. ✔
- Nota F16b (não afirmar gaveta de produção) → D6. ✔

## 7. Riscos

1. **O teste fica lento.** ~4500 ticks entram na suíte. Se passar de ~5 s, medir e
   registrar; não fatiar o teste para esconder (seria andaime).
2. **A serraria demora a desbloquear** e o roteiro estoura o teto. O teto vem
   medido, não chutado — e se a medição der muito alto, o achado é de ritmo.
3. **Clique fora do canvas** depois do arrasto de câmera. `pontoDoTile` lança; o
   erro aparece nomeado.
4. **A última cláusula (timber) não fecha em tempo razoável.** Tratada em §1:
   corrigir o critério **com o número ao lado**, reportar, nunca fabricar o
   comportamento.
5. **Contexto.** O roteiro é longo. Abrir só `screenshots/F17-final.png` com Read.

## 8. Resultado da medição

*(preenchido na execução — Tarefa 1 Passo 6, Tarefa 3 e Tarefa 5 Passo 3)*
