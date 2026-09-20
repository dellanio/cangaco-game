# PROGRESS

## F01 — Esqueleto do projeto (2026-09-19)

**Feito:** Vite + TypeScript estrito + Vitest + ESLint, estrutura de pastas da
seção 3 do CLAUDE.md (`src/sim/{systems,units}`, `src/render/scenes`, `src/ui`,
`src/input`, `assets`, `tools`, `tests`). Scripts do `package.json` completos
(`dev`, `build`, `test`, `typecheck`, `lint`, `validate:data`, `shot`, `sim`,
`verify`). `validate:data`, `shot` e `sim` são stubs que saem 0 — as
implementações reais vêm nas F03, F04 e F02. Teste trivial verde
(`tests/F01-esqueleto.test.ts`) confirmando `SIM_SKELETON` e gravando
`test-output/F01.json`. `npm run verify` roda os quatro passos
(`typecheck` → `lint` → `validate:data` → `test`) e sai 0, criando `.verify-ok`.
`F01-esqueleto: true` marcado depois de ler a evidência com a ferramenta Read.

**Decisões e por quê:**

- **`package.json` sem `"type": "module"`.** `scripts/verify.js` (harness
  pré-existente, instrução explícita de não reescrever) usa `require()`
  CommonJS. Marcar o pacote como ESM quebraria esse script.
- **`eslint.config.mjs`** em vez de `.js`: a extensão `.mjs` força ESM no
  arquivo de config independente do `type` do pacote.
- **Phaser adiado para a F04.** O escopo da F01 proíbe código de render;
  instalar a dependência agora não teria uso até a F04.
- **`vitest.config.mts`** (não `.ts`): força ESM no config do Vitest sem
  depender de `"type": "module"` no pacote — evita o aviso do Vite sobre
  config carregado como CommonJS.
- **`@types/node` adicionado como devDependency.** `tsconfig.json` já
  restringia `"types"` a `["vitest/globals"]`, o que desliga a resolução
  automática de tipos mesmo com o pacote instalado. Sem isso, `node:fs` em
  `tests/helpers/evidence.ts` não tipava e o `typecheck` falhava. Ajustado o
  array para `["vitest/globals", "node"]`.
- **`tests/helpers/evidence.ts`** como padrão de gravação de evidência
  (`gravarEvidencia(feature, dados)` grava `test-output/<feature>.json`,
  conforme CLAUDE.md §8). Toda feature seguinte deve reusar essa função em
  vez de reimplementar a escrita.
- **As invariantes 1 e 2 estão travadas em `eslint.config.mjs`**, não só
  documentadas: `no-restricted-imports` barra `phaser` e qualquer import de
  `render/ui/input` dentro de `src/sim/**/*.ts`; `no-restricted-properties`
  barra `Math.random` e `Date.now` no mesmo escopo. Verificado na sessão com
  um arquivo de prova temporário que violava as três regras de uma vez
  (3 erros distintos confirmados), depois removido — não ficou no repo.
- **`scripts/**` ficou fora do escopo de correção do lint, mas não fora da
  verificação.** `npm run lint` reprovava `scripts/verify.js` e
  `scripts/verify-gate.js` por `no-require-imports` e `no-empty` — regras
  erradas para CommonJS, não bugs reais nesses arquivos. Em vez de excluir
  `scripts/` do lint (mudança de escopo, proibida pela regra nova da seção
  10), as duas regras foram desligadas apenas dentro do bloco
  `files: ['**/*.js']`, onde fazem sentido para qualquer script CommonJS do
  repositório — `scripts/` continua lintado normalmente para todo o resto.
- **Os 10 JSON de configuração foram movidos da raiz para `data/`** (decisão
  tomada com o operador nesta sessão). Estavam soltos na raiz e `data/`
  vazia; `README-PACOTE.md` e a seção 3 do CLAUDE.md colocam os dois no
  mesmo lugar. Nada lia esses arquivos na F01, então o move não podia
  quebrar nenhum comando.
- **Commit de baseline separado do commit de F01.** Antes desta sessão, todo
  o harness/spec (`CLAUDE.md`, `BUILD_PLAN.md`, `.claude/`, `docs/`,
  `agents/`, `scripts/`, o rastreador, os JSON de configuração) estava
  untracked no git — nunca tinha sido commitado. Fiz um `git add -A`
  ingênuo na primeira tentativa e ele varreu tudo isso junto com o trabalho
  da F01; desfiz e separei em dois commits: `chore: spec, dados e harness`
  (baseline, mensagem do próprio `README-PACOTE.md`) e os commits de F01,
  um por task do plano.

**`bug.md` e `codex.md`:** já estão em `.claude/commands/` — o operador moveu
à mão durante a sessão. Resolvido, não é mais pendência.

## F02 — GameState e o contrato do tick (2026-09-19)

**Feito:** `src/sim/rng.ts` (RNG semeado, puro, mulberry32), `src/sim/state.ts`
(`GameState`, `GameEvent`, `createInitialState`), `src/sim/commands.ts`
(`Command`), `src/sim/tick.ts` (`step`). `tests/helpers/determinism.ts` com
`compararComESemSave`, o teste canônico de determinismo do projeto — F23 vai
reusá-lo em vez de escrever outro. 22 testes verdes em 3 arquivos
(`F02-rng`, `F02-tick-determinista`, mais o F01 herdado), `test-output/F02.json`
gravado e lido. `npm run verify` passou os quatro passos, `.verify-ok` criado.
`F02-tick-determinista: true` marcado por substituição no lugar, 17 chaves
preservadas (conferido com `git diff` antes do commit).

**Decisões e por quê:**

- **`events` é limpo a cada tick, e também é determinístico.** `step()` começa
  cada tick com lista vazia — mantém o `GameState` limitado ao longo de 1000+
  ticks. Mas eventos são função pura de estado e comandos: dois runs com a
  mesma semente emitem os mesmos eventos, na mesma ordem — provado em teste
  dedicado, não só documentado. Exigência explícita do operador.
- **`step()` não consome aleatoriedade nesta feature.** Decisão do operador,
  dentro do escopo literal da F02 ("nenhum sistema ainda"). `state.rng` passa
  adiante intocado; o primeiro consumidor real chega com o primeiro sistema
  (F09 em diante). Consequência visível na evidência: `rngFinal.cursor` é
  igual à semente depois de 1000 ticks.
- **`seed` guardado separado do `cursor` em `RngState`.** `BUGS.md` pede repro
  no formato "(semente, tick)" — sem a semente original sobrevivendo à parte,
  um bug não seria reproduzível a partir de um estado salvo no meio da
  corrida.
- **`nextInt` usa rejection sampling desde o início, não módulo puro.**
  Módulo enviesaria as faces baixas quando a amplitude não divide 2³². Como
  `nextInt` vai decidir desempate no JobBoard e chance de acerto no combate,
  corrigir depois significaria recalibrar balanceamento feito em cima do
  viés — mais caro que fazer certo agora. Provado com teste de distribuição
  (10000 sorteios em `[0,3)`, cada face a ±5% de 1/3, semente fixa — não é
  teste flaky). Sem contador de tentativas no laço de descarte: um limite
  arbitrário seria número mágico em `.ts` e mascararia um RNG quebrado em vez
  de expô-lo.
- **`Command = never`, não um `noop` de mentira.** Comando morto sobrevive ao
  projeto inteiro; a união nasce vazia e a F07 acrescenta o primeiro membro.
  Efeito colateral: o teste "step não muta a lista de comandos" perdeu força
  — com a união vazia, `[]` é a única lista válida e `step()` nem percorre o
  parâmetro (por isso o parâmetro é `_commands`), então não há elemento para
  provar que não é mutado. Renomeado para "step aceita uma lista de comandos
  congelada" — guarda de contrato, não prova de não-mutação de elemento. Essa
  cobertura real volta na F07. **A checagem de exaustividade também não existe
  ainda**: sem o `const naoTratado: never = command` dentro de um `switch`
  (que só faz sentido quando há um `case` para escrever), nada vai reprovar o
  `typecheck` sozinho quando a união ganhar o primeiro membro. Quem
  implementar a F07 precisa escrever o `switch` com `default` atribuindo a
  `never` — não é automático.
- **`argsIgnorePattern: '^_'` acrescentado ao `eslint.config.mjs`**, em bloco
  novo ao final do array, sem tocar nos blocos existentes. Necessário porque
  `tsc` já ignora parâmetro prefixado com `_` sob `noUnusedParameters`, mas o
  preset `tseslint.configs.recommended` liga `@typescript-eslint/no-unused-vars`
  como `'error'` **sem opções** (confirmado lendo
  `node_modules/@typescript-eslint/eslint-plugin/dist/configs/flat/recommended.js`)
  — sem configurar, `_commands` reprovaria o lint. Configuração do caso
  legítimo, não exceção: a regra continua `error` para tudo que não segue a
  convenção.
- **`TICK_MS` deliberadamente ausente.** `step()` só incrementa um contador
  inteiro; não precisa saber de milissegundos. Isso evita a pergunta de
  "número de balanceamento em `.ts`" (invariante 3) inteiramente nesta
  feature — entra quando o laço externo (render) existir.

## F03 — Dados, escala de tempo e validação (2026-09-19)

**Feito:** `tools/data-schema.js` (registro declarativo de forma e de campos
escalonados, compartilhado), `tools/data-rules.js` (`validarTudo`, puro,
CommonJS) e `tools/validate-data.js` (CLI reescrito, `--dir`, exit 0/1).
`src/sim/data/{types,raw,loader,index}.ts` — `loadGameData(raw)` puro,
converte os nove arquivos para `GameData`, toda duração/taxa vira tick
inteiro (`Math.round`) uma única vez, registrada em `GameData.conversoes`
para auditoria. `src/sim/freeze.ts` (`deepFreeze`, promovido de
`tests/helpers/determinism.ts`). `gameData` é o singleton congelado em
profundidade. 25 testes em `tests/F03-dados-validados.test.ts`: 11 fixtures
quebrados provando que `validate:data` reprova (mais sinal trocado e CLI
ponta a ponta), carregamento/grafo/congelamento, e a exigência de escala
(economia 2.0→3.0 na proporção 2/3 ±1 tick, direção correta, e
`movimento`/`construcao`/`combate` intactos por `toEqual`). `npm run verify`
verde (4 passos), `.verify-ok` criado, `test-output/F03.json` lido com a
ferramenta Read antes de marcar o rastreador. `F03-dados-validados: true`
por substituição no lugar, 17 chaves preservadas (conferido com `git diff`).

**Decisões e por quê:**

- **Validador sem dependência nova.** A parte que importa da spec — hp
  derivado, grafo acíclico, integridade referencial entre arquivos — não é
  expressável em JSON Schema puro; eu escreveria a regra à mão de qualquer
  jeito. `ajv` cobriria só a metade rasa (tipos/chaves obrigatórias) a custo
  de uma dependência nova. `tools/data-schema.js` guarda essa metade rasa,
  declarativa, em CommonJS sem lib. `tools/data-rules.d.ts` e
  `data-schema.d.ts` são só declarações de tipo ambiente, para os testes
  `.ts` estritos importarem sem `allowJs` — não mudam o runtime.
- **`GameData` não expõe `escalas` — enforcement por ausência, não por
  convenção.** `loadGameData` consome `time.escalas` e não o repassa;
  `GameData.tempo` só tem `tickHz`, `tickMs` e `velocidadeDeJogo`. Um sistema
  que tentasse escalar em tempo de execução não teria de onde tirar o
  número. Reforçado por teste (`acharChave(gameData, 'escalas')` vazio) e
  por regra ESLint nova (`no-restricted-imports` barra `**/theme-*.json` em
  `src/sim/**/*.ts` — CLAUDE.md §9, aproveitando o mesmo bloco).
- **Taxa vira período em ticks no carregamento, nunca float dividido em
  runtime.** `production.json` está em unidades/minuto;
  `ticksPorUnidade = round(60 * tickHz / (taxa * escala))`, guardado pronto.
  Mesma lógica pra movimento: velocidade × custo de terreno vira matriz
  `ticksPorTile[aPe|montado][terreno]`, arredondamento único a partir dos
  valores exatos — nunca arredondar a velocidade e depois multiplicar pelo
  terreno, que arredondaria duas vezes.
- **`TICK_MS` deixou de ser ausência (pendência da F02) e passou a nascer de
  `tickHz`.** `gameData.tempo.tickMs = Math.round(1000 / tickHz)`, confirmado
  em teste (`tickHz === 10 → tickMs === 100`) — não é mais número hardcoded
  em lugar nenhum.
- **`deepFreeze` promovido de `tests/helpers/determinism.ts` para
  `src/sim/freeze.ts`.** `Object.freeze` na raiz deixaria `predios[0]` e
  `conversoes` mutáveis; como `gameData` é singleton importado por todo
  `sim/`, uma escrita em qualquer lugar contaminaria todos os outros
  importadores e quebraria o determinismo sem deixar rastro. O helper de
  teste agora reexporta do utilitário de produção — duas cópias divergentes
  seria pior que nenhuma.
- **`delivery.alertaTarefaSemCandidato_segundos` declara `escala: null`,
  decisão do operador.** É aviso de interface, não balanceamento — comprimir
  a economia não muda o tempo de atenção humana. A distinção
  ausente-vs-`null` virou regra permanente do validador
  (`tempo/duracao-sem-grupo` vs. aceitar `null`): ausente é esquecimento,
  `null` é decisão registrada.
- **`src/sim/data/` e `src/sim/freeze.ts` não estão na árvore literal da
  seção 3 do CLAUDE.md.** O carregador precisava morar em algum lugar dentro
  de `sim/`, e não fazia sentido inflar `state.ts` ou `tick.ts` com nove
  imports de JSON. Registrado aqui por não ter sido decisão prévia do
  documento.
- **O `as`/tipo de `raw.ts` é uma promessa, não uma prova.** `sim/` assume
  que `npm run verify` roda `validate:data` antes de `test` — a ordem real do
  script. Rodar `npm run test` isolado, sem o passo de validação antes, não
  tem essa garantia; dado malformado chegaria ao carregador como erro
  confuso (`< 1 tick` ou não-inteiro) em vez de mensagem de regra clara.
  Preferido a duplicar o validador dentro de `sim/` (duplicação de fonte de
  verdade). Risco aceito, não resolvido nesta sessão.
- **Lacuna conhecida, não inventada agora:** `units.json` `militares.requisitos`
  referencia ids de item (`sword`, `longbow`, `horse`) sem lista canônica em
  `data/` — `economy.mercadorias` é parcial. Não dá para validar integridade
  referencial disso hoje; fica para a F24 (cadeia de armas).
- **Nenhum red real no TDD desta feature.** Regras e fórmulas foram
  verificadas contra o dado real por script antes de escrever
  regra/carregador (ver riscos do plano), então testes e `tsc`/`eslint`
  passaram limpos já na primeira rodada de cada task — não é desvio de
  processo, é o efeito de checar a aritmética antes de commitar a fórmula.

## F04 — Grid ortogonal e câmera (2026-09-19)

**Feito:** `src/render/grid.ts` puro (zero `import`): `gridToScreen`,
`gridToScreenCentro`, `screenToGrid` (`Math.floor`), `depthDeY`,
`tileDentroDoMapa`. `src/render/mapa.ts` — único leitor de `sim/data` dentro
de `render/`, expõe `configDoMapa` derivado de `gameData.terreno`. Cena
`WorldScene` com tilemap ortogonal 64×64, textura de grama procedural (cor de
`data/theme-sertao.json`), câmera com arrasto (botão do meio) e
`setBounds`, highlight do tile sob o mouse, dois marcadores placeholder
exercitando `depthDeY`. `window.__cangaco` (`src/render/debug.ts`) publica
`pronto`/`tileSobMouse`/`camera`/`tilesRenderizados` para o Playwright
verificar estado do app, não pixel. `tools/shot.js` reescrito como runner
genérico reusável (sobe Vite, Chromium headless viewport fixo, reprova em
erro de console) e `tools/shots/F04.js` como o primeiro roteiro. 16 testes
novos em `tests/F04-grid-ortogonal.test.ts` (ida e volta com 1000 amostras
+ jitter + coordenada negativa + 4 tamanhos de tile, guardas estruturais,
prova de fonte do dado). `npm run shot -- F04`: 4/4 afirmações, 0 erro de
console, PNGs abertos e conferidos com Read. `F04-grid-ortogonal: true`
marcado depois de `npm run verify` verde e evidência lida.

**Decisões e por quê:**

- **Projeção é a identidade** (`x = gx*tilePx`, `y = gy*tilePx`), sem
  achatamento nem skew. O grid por baixo é quadrado (CLAUDE.md §4); o 3/4
  está na arte, que ainda não existe. O screenshot da F04 é um gradeado
  verde chapado — resultado esperado, não feature incompleta.
- **`tilePx` é parâmetro de `grid.ts`, nunca lido de dentro do módulo.**
  Decisão do operador: permite testar a ida e volta em vários tamanhos de
  tile (16/32/48/64) e prova que a propriedade é da matemática, não
  coincidência do número 64. `mapa.ts` é o único arquivo de `render/` que
  importa `../sim/data`; todo o resto recebe `configDoMapa`.
- **Guardas estruturais, não varredura de literal.** Cheguei a planejar um
  teste que procurava o texto `64` em `src/render/` — o operador rejeitou:
  o número aparece em hex, em `4096`, em qualquer cor com esses dígitos (o
  mesmo erro de classe do `min`/`gold_mine` na F03). Trocado por duas
  guardas estruturais: `grid.ts` lido do disco não tem nenhum `import`; e
  nenhum arquivo de `render/` fora de `mapa.ts` importa `../sim/data`. A
  prova de que o valor vem do dado é a igualdade
  `configDoMapa.tilePx === gameData.terreno.tilePx`, rastreada até
  `tile_px` de `data/terrain.json`.
- **`screenToGrid` usa `Math.floor`, testado com jitter.** `floor` acerta
  coordenada negativa (`floor(-1/64) === -1`); o teste sorteia um ponto
  qualquer *dentro* do tile, não só os cantos — é o caso que distingue
  `floor` de `round`, sem ele o teste seria decorativo.
- **`window.__cangaco` como contrato de prontidão e de asserção.** Sem
  `pronto`, o Playwright fotografaria um canvas em branco. Sem `estado()`
  exposto, o roteiro teria que inferir "a câmera moveu" olhando pixel —
  fràgil. Perguntar ao app o que ele acha que fez é sólido e reusável pelas
  próximas 30 features.
- **`npm run shot` genérico, roteiro por feature.** `tools/shot.js` nunca
  muda; `tools/shots/<nome>.js` exporta `async roteiro(ctx)`. Erro de
  console reprova a captura — é o que transforma "tela preta" de achado
  manual em falha automática.
- **Phaser 3.90.0 e `@playwright/test` 1.63.0 fixados sem caret** (decisão
  do operador para o Playwright, estendida por mim ao Phaser pela mesma
  razão: a versão da engine muda o que é desenhado, um caret reintroduziria
  evidência que muda sozinha entre execuções). Cache do Chromium do
  Playwright fica fora do repo (`%LOCALAPPDATA%`), mas `ms-playwright/` e
  `.playwright/` entraram no `.gitignore` por precaução.
- **`sim/` não mudou uma linha nesta feature** — o carregador da F03 já
  expunha `gameData.terreno.tilePx` e `gameData.terreno.mapaPadrao`.
  Verificado com `git diff --stat` contra o commit que fechou a F03
  (vazio) e com um arquivo de prova temporário em `src/sim/` importando
  `phaser`/`../render/scenes/WorldScene` — reprovado por
  `no-restricted-imports` (2 erros) e apagado em seguida, não entra no
  repositório.
- **Marcadores de depth sorting são placeholder de render, não entram no
  `GameState`.** Equivalentes ao "retângulo com o id escrito" do CLAUDE.md
  §9 — desaparecem quando entidades reais chegarem, não violam "prédio não
  nasce sem comando do jogador" (§10) porque nunca foram um prédio.
  `depthDeY` é testada isoladamente (monotônica); os marcadores só a
  exercitam visualmente no screenshot.
- **Câmera: só arrasto e limite**, escopo literal do BUILD_PLAN e escolha
  do operador. Borda de tela, WASD e zoom ficam fora. Nota de dívida
  acrescentada ao item da F05 em `BUILD_PLAN.md` (não ao `Escopo`/`Aceite`):
  `gridToScreen`/`screenToGrid` são cegas a zoom hoje e vão precisar de
  parâmetro de escala quando ele entrar — nenhum item da fila agenda zoom
  ainda.
- **`npm run shot` fica fora do `npm run verify`.** As quatro etapas do
  `verify` continuam `typecheck → lint → validate:data → test`; screenshot
  segue passo manual da sessão, como o CLAUDE.md §8 já define — mantém o
  portão rápido e estável.

## F05a — Estado inicial em `sim/` (2026-09-19)

A F05 original juntava formato de entidade (`sim/`) e HUD/render numa feature
só. O operador quebrou em F05a e F05b — o formato do `GameState` que F07, F10,
F11 e F14 herdam precisa ser revisado isolado, sem decisão de render no meio.
Esta sessão entregou só a F05a. `test-results.json` passou de 17 para 18
chaves (intencional): `F05-estado-inicial-hud` virou `F05a-estado-inicial` +
`F05b-hud`.

- **Coleção indexada por id, com `ordem` explícita ao lado do `Record`.**
  `predios`/`unidades` são `{ porId, ordem }`. O `Record` dá acesso O(1); o
  array `ordem` existe porque a ordem de iteração de `Object.keys` num objeto
  JS não é uma garantia da linguagem para chave não numérica — só "na
  prática" os motores atuais preservam inserção. Todo sistema futuro varre
  `ordem`, nunca `Object.keys(porId)`. Os ids também são não numéricos
  (`p1`, `u3`, ...), que é uma segunda garantia independente da primeira.
- **Estoque e capacidade têm a mesma forma: duas gavetas, `entrada` e
  `saida`.** Decisão do operador, corrigindo um desenho meu que deixava
  `estoque` plano enquanto `capacidade` já tinha as duas gavetas. A razão:
  a F09 reserva vaga no destino, e numa Bakery a vaga de farinha é na entrada
  e a de pão é na saída — com estoque plano o JobBoard teria que inventar
  essa separação no meio, exatamente o cenário que modelar a capacidade cedo
  queria evitar. O armazém é o caso especial: capacidade `null` nas duas
  gavetas (de `economy.storehouse.capacidade`), e o estoque inicial inteiro
  entra em `saida` — é de lá que o serf retira. Um prédio de produção nasce
  com capacidade `{ entrada: 5, saida: 5 }` (de
  `production.estoqueInternoPorPredio`, que o carregador não expunha e passou
  a expor) e as duas gavetas de estoque vazias. A schoolhouse (nem armazém,
  nem produção) nasce sem limite e sem estoque.
- **Unidade é entidade endereçável desde já, não contagem.** `unidades: {
  serf: 4, laborer: 2 }` no JSON vira 6 entidades com `id`, `tipo`, `gx`,
  `gy`, `fsm: 'ocioso'`, `fsmData: {}`. Contagem economizaria hoje e custaria
  caro na F10, que precisa de estado por unidade.
- **`proximoId` é um contador único, compartilhado entre prédio e unidade.**
  F07 (posicionar planta) e F13 (treinar na schoolhouse) criam entidade em
  runtime e precisam de um id novo sem colidir com os que já existem — não
  há `Math.random`, não há UUID.
- **`estoqueTotal`/`contagemPorTipo` moram em `src/sim/selectors.ts`, puros,
  não em `ui/`.** Condição do operador: o HUD (F05b) não varre prédios por
  conta própria; se precisar de outro agregado, ele nasce ao lado, no mesmo
  arquivo.
- **`createInitialState(seed, dados = gameData)` aceita o dado como
  parâmetro explícito.** O default cobre os chamadores existentes
  (`tests/helpers/determinism.ts`); o parâmetro explícito é o que um teste
  usa para provar que nenhum valor da tabela foi digitado em `.ts` — injeta
  um `GameData` com outro estoque e confirma que o estado muda junto.
- **A vila vai para o meio do mapa 64×64**, decisão do operador na pergunta
  da câmera (`camera.centerOn` é F05b). `gx`/`gy` dos dois prédios e
  `spawnDeUnidades` entraram em `data/economy.json`, com seis regras novas em
  `validarEconomiaReferencia` (posição inteira, footprint dentro do mapa, sem
  sobreposição entre prédios, spawn dentro do mapa, chaves de estoque e de
  unidades existentes nos catálogos correspondentes). Verificado com um teste
  negativo manual (prédio fora do mapa reprova) e desfeito antes do commit.
- **O carregador passou a expor `production.estoqueInternoPorPredio`.**
  `GameData.producao` mudou de `Record<string, ProducaoPredio>` para
  `{ receitas, estoqueInternoPorPredio }` — as receitas não mudaram de forma,
  só de endereço. Nenhum chamador existente tocava `gameData.producao`, então
  não houve ponto de migração.
- **`npm run sim` deixou de ser stub da F01.** Sobe um servidor Vite em
  `middlewareMode` e carrega `state.ts`/`tick.ts`/`selectors.ts` via
  `ssrLoadModule` — zero dependência nova (`vite-node`/`tsx` não estão
  instalados e não entraram). `npm run sim -- inicial --ticks 0` imprime os
  mesmos valores de `data/economy.json`, conferido lado a lado com a
  ferramenta Read.
- **`sim/` continua sem tocar o tema.** Checagem manual desta sessão: um
  arquivo de prova temporário em `src/sim/` importando
  `theme-sertao.json` foi reprovado pelo ESLint (`no-restricted-imports`,
  regra já existente desde a F03) e apagado — resultado registrado em
  `test-output/F05a.json`.
- **`npm run shot -- F04` continua passando** mesmo com a vila agora no meio
  do mapa em `economy.json` — a câmera ainda não lê posição de prédio nesta
  feature (isso é F05b), então o roteiro da F04 não foi tocado.
- **Registrado no `BUILD_PLAN.md`**, não só aqui: em F05b, as notas de
  `atualizar(state)` e do roteiro da F04 precisar parar de assumir scroll
  fixo quando `camera.centerOn` chegar; em F11, a nota de que o laço de tempo
  fixo a 10 Hz ainda não existe e nasce ali.

## F05b — HUD e a vila na tela (2026-09-20)

A primeira feature de integração: atravessa `sim/` e `render/`/`ui/` na mesma
sessão, sob a exceção explícita da §10 do CLAUDE.md. A exceção foi escrita no
`BUILD_PLAN.md` **antes** de qualquer código (Task 0 do plano) — não inferida
no plano de implementação, por correção do operador durante a revisão do
plano: o mesmo raciocínio ("o escopo parece justificar a exceção") tinha sido
recusado antes, quando propus tratar a F05 inteira como integração. A nota diz
explicitamente que vale só para a F05b; nenhuma feature seguinte herda a
permissão por hábito.

- **A ponte (`src/render/ponte.ts`) é um campo mutável simples, não um
  `EventEmitter`.** `new Phaser.Game()` volta na hora, mas `Scene.create()`
  roda depois, assíncrono — a cena não pode receber o estado por parâmetro de
  construtor no sentido tradicional porque ele ainda não existe quando
  `iniciarJogo()` chama `new WorldScene(ponte)`. A ponte (`{ atual: GameState
  | null }`) é passada ao construtor e populada por `main.ts` chamando
  `jogo.atualizar(state)` antes do primeiro frame; a cena lê `ponte.atual`
  quando `create()` roda, e de novo a cada `POST_RENDER`. Não é
  `EventEmitter` porque o estado é imutável e trocado inteiro a cada chamada —
  quem lê só precisa da referência mais recente, um assinante de evento aqui
  seria cerimônia sem propósito.
- **`WorldScene` redesenha prédios por diff de id, não do zero a cada
  frame.** `atualizarPredios` mantém `Map<string, Container>` local da cena:
  id novo cria, id sumido destrói, id igual não mexe. Isso é memória de
  render (o handle do sprite que a própria cena criou), não estado de jogo
  guardado em sprite — o que a §10 proíbe é o inverso. Sem o diff, a F07
  (posicionar planta) recriaria todos os prédios a cada frame.
- **Os dois marcadores de demonstração da F04 saíram de `WorldScene.ts`.**
  Existiam só para exercitar o depth sorting sem ter entidade real; os
  prédios do `GameState` fazem o mesmo trabalho agora, e mantê-los deixaria
  dois retângulos fantasma em (6,8)/(6,9) sobre a screenshot do aceite.
- **`comidaTotal`/`populacaoPorGrupo`/`centroDaVila` nasceram em
  `sim/selectors.ts`**, ao lado de `estoqueTotal`/`contagemPorTipo` da F05a —
  é o arquivo que já se declarava aberto a isso. `centroDaVila` devolve
  `PontoEmTiles` (`{ gx, gy }`), um tipo novo e deliberadamente **não** o
  `Tile` de `render/grid.ts`: correção do operador na revisão do plano — o
  centro do bounding box dos dois prédios cai em (33, 31.5), meio tile, e
  reusar `Tile` (que carrega semântica de coordenada inteira, é o que indexa
  o mapa e o que pode ir para o `GameState`) convidaria alguém a guardar
  `31.5` num campo de coordenada depois. `PontoEmTiles` existe só para a
  câmera, nunca entra no `GameState`. A cadeia de fallback é explícita no
  código, não uma exceção: prédio → bounding box dos footprints; sem prédio
  mas com unidade → bounding box das unidades; nem um nem outro → centro de
  `terreno.mapaPadrao`. Os três ramos têm teste headless próprio.
- **Comida virou grupo no dado (`economy.json: grupos.comida`), com regra
  que fecha a costura contra `condition.json`.** Condição do operador: sem
  validação cruzada, `condition.restauracaoPorComida` e `economy.grupos.comida`
  seriam duas fontes de verdade independentes — alguém acrescenta uma comida
  nova num arquivo e o HUD continua somando as quatro antigas.
  `validarGruposDeComida` (`tools/data-rules.js`) exige conjuntos idênticos
  dos dois lados, mais todo id existindo em `economy.mercadorias`. Testado nos
  dois sentidos manualmente (tirar `fish` de um lado, acrescentar `corn` do
  outro) e revertido antes do commit.
- **Segundo funil de `render/` para `sim/data`: `render/predios.ts`.** Mesmo
  molde de `mapa.ts` (o primeiro funil, da F04): lê `gameData.predios` e
  `theme-sertao.json` uma vez, expõe `aparenciaDoPredio(tipo)`. A guarda
  estrutural de `tests/F04-grid-ortogonal.test.ts` passou a aceitar **dois**
  arquivos na whitelist, continua fechada para um terceiro.
- **Prédio sem PNG em `assets/base/` é o placeholder do §9, não uma falha.**
  Retângulo do tamanho do footprint (`largura × altura` de tiles, de
  `buildings.json`) com o nome temático (`theme-sertao.json: predios[tipo].nome`)
  escrito por cima — "Armazém", "Casa do Coronel" na screenshot do aceite.
- **HUD é DOM puro sobre o canvas (`src/ui/hud.ts` + `<div id="hud">` em
  `index.html`), `pointer-events: none`.** Sem isso o HUD roubaria o
  `pointermove` que a F04 testa (highlight de tile sob o mouse). Rótulos dos
  cinco campos vêm de `theme-sertao.json` (`mercadorias.*` para
  gold/timber/stone, `hud.comida`/`hud.populacao` para os dois agregados que
  não têm id de simulação) — nenhuma string visível digitada em `.ts`. Cada
  valor carrega `data-campo`, o gancho que o roteiro do Playwright usa para
  afirmar o número, não só "tem texto na tela".
- **`main.ts` passou a ser o dono do `GameState`.** `createInitialState`
  agora lê a semente de `gameData.economia.estadoInicial.semente` (novo campo
  em `economy.json`, não mais implícito) em vez de um literal. `iniciarJogo()`
  e `montarHud()` devolvem `{ atualizar(state) }`; `main.ts` chama as duas a
  partir de uma função só (`atualizar`). Quando o laço de 10 Hz entrar (F11),
  a ligação é uma linha nova chamando `atualizar` a cada tick, não uma
  refatoração de quem lê o estado.
- **`npm run shot -- F04` quebrou com a câmera centralizada e revelou um bug
  pré-existente no próprio roteiro, não só no literal de scroll fixo.** O
  passo 5 arrastava o mouse 5000px além da borda num único movimento; um
  script de depuração nesta sessão mostrou que um `mousemove` que sai da
  viewport (1280×720) para de gerar eventos no Chromium — o excesso pedido
  nunca virava scroll de verdade. Isso sempre esteve quebrado; ficou invisível
  antes porque a câmera partia de (0,0) e um delta parcial de ~250px já
  bastava para bater no limite. O conserto: passo 2 calcula o tile alvo a
  partir do `camera.scrollX/scrollY` publicado (não mais um `TILE_ALVO`
  fixo); passo 4 afirma o delta do arrasto contra o scroll medido antes dele
  (não mais `scrollX > 0`, que seria verdade mesmo sem arrastar com a câmera
  já longe da origem); passo 5 virou um loop de arrastos **dentro** da
  viewport, repetidos até a câmera não ter mais para onde ir.
- **Evidência em duas linhas separadas, nunca confundidas (CLAUDE.md §8).**
  Headless (`tests/F05b-hud.test.ts`, dentro do `npm run verify`) prova os
  selectors e as guardas estruturais → `test-output/F05b.json`. Visual
  (`npm run shot -- F05b`, fora do verify, rodado à mão) prova a tela → dois
  arquivos em `screenshots/`, abertos com a ferramenta Read: os dois prédios
  rotulados no meio do mapa e a barra de recursos legível no topo
  (Dinheiro 20, Tábua 40, Pedra 30, Comida 25, Gente 6/0), nenhum id neutro
  (`gold`/`timber`/`stone`) visível no texto do HUD.

## Perguntas em aberto

Nenhuma no momento.
