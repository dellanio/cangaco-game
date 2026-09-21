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
- **`main.ts` passou a ser o dono do `GameState`** *(desde a F07 o dono é a
  `Sessão`, `src/sessao.ts`, que também guarda a fila de comandos; `main.ts` só a
  cria e liga o resto — ver a seção da F07).* `createInitialState`
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

## F06 — Menu Build e planta fantasma (2026-09-20)

Segunda feature de integração, com a nota de exceção da §10 escrita no
`BUILD_PLAN.md` **antes** de qualquer código (Task 0), valendo para a F06 e só.
A F06 não emite comando nenhum: o clique que posiciona é a F07.

**Decisões do operador na revisão do plano:** (1) a nota de integração foi
aprovada; (2) **"terreno inválido" saiu do aceite e do código.** O mapa não tem
terreno variado nem feature que o produza; uma lista `obstaculos` vazia só para
o teste injetar seria andaime — a verificação nunca dispara numa partida real e
fixa um formato de dado antes de existir quem o produza. O tipo antecipa, a
implementação não finge: `MotivoDeRecusa` declara `'terreno'`, inalcançável hoje.
Terreno de mapa não está na fila; foi registrado em `IDEIAS.md` como falta antes
da F11 (a decisão de fila é do operador). `data/terrain.json` **não foi tocado**.

### Verificado (aberto e rodado nesta sessão)

- `npm run verify` verde: typecheck, lint, `validate:data` (9 arquivos, 0 erros)
  e 128 testes (38 novos em `tests/F06-build.test.ts`). Evidência headless em
  `test-output/F06.json`, aberta com Read.
- `canPlace`: os três casos do aceite escrito, cada um isolado e afirmando o
  **motivo** (`sobreposicao`, `fora-do-mapa`, `bloqueado`), incluindo o limite
  meio-aberto (encostar é ok, um tile a mais já é sobreposição) e a precedência
  entre motivos. Nenhum número é digitado: os testes injetam `GameData` com outro
  `tamanho`, outro `mapaPadrao` e outro `menuBuildInicial` e o resultado muda.
  Roda sobre `GameState` congelado (`deepFreeze`).
- Desbloqueio: percorre as 27 arestas `desbloqueadoPor` de `buildings.json`
  (sem o pai bloqueia, com o pai completo libera).
- Guardas por import: `src/input/` não importa `phaser`, `sim/data` nem
  `sim/state`.
- **Visual** (`npm run shot -- F06`, fora do `verify`, §8): 22 afirmações e 3
  screenshots, todas abertas com Read — planta verde sobre tile livre, vermelha
  sobre o armazém, e o estado após `Esc`. Rodei o roteiro 3 vezes seguidas,
  estável. `npm run shot -- F04` e `-- F05b` continuam passando com o novo layout.

### O que foi decidido e por quê

- **Onde a planta mora.** Fora do `GameState`, em três camadas que não
  persistem: a *intenção* (qual prédio a ferramenta carrega) em
  `src/input/ferramenta.ts`, criada em `main.ts` no molde da ponte da F05b; a
  *posição* é o `tileSobMouse` efêmero da cena; o *desenho* é derivado a cada
  frame de intenção + posição + `canPlace`. `Esc` chama `cancelar()`. A fronteira
  é verificável: `ferramenta.ts` não importa `sim/state` (guarda por import) e o
  teste roda `selecionar/cancelar` sobre um estado congelado.
- **`canPlace` devolve motivo, não boolean.** Um teste que só afirma `false` para
  "sobreposição" passaria mesmo se a função recusasse pela razão errada; e a F07
  precisa rejeitar o segundo comando na mesma posição.
- **Desbloqueio derivado:** liberado se está em `menuBuildInicial` ou se o
  `desbloqueadoPor` está satisfeito. *(A primeira versão olhava a presença atual
  em `state.predios` e não criava campo no `GameState`; foi **substituída** logo
  depois pelo desbloqueio permanente — ver "Desbloqueio permanente" abaixo.)*
  A geometria de footprint foi extraída de `selectors.ts` (F05b) para
  `sim/footprint.ts` porque `canPlace` precisa da mesma.
- **O HUD/painel não podem ficar sob o canvas — corrigido na causa.** O problema
  não era "o HUD tem 38 px", era o canvas se estender por baixo de qualquer UI
  sobreposta. `index.html` virou uma grade CSS (HUD em cima, canvas e painel
  lado a lado embaixo); o ponteiro sobre a UI nunca chega ao Phaser. O número 38
  ficou só em CSS (`--altura-hud`), nenhum `.ts` o conhece. A cena esconde tile e
  planta no `GAME_OUT`. `#hud { pointer-events: none }` (F05b) saiu: existia só
  por causa da sobreposição. Provado por medição no roteiro (canvas abaixo do HUD
  e à esquerda do painel; mouse dentro do HUD e do painel deixa `tileSobMouse` e
  `plantaFantasma` nulos), não a olho.
- **`aria-disabled` e não `disabled`** nos itens bloqueados: o clique continua
  chegando e é ignorado, o que deixa o roteiro provar que clicar não ativa nada
  (com `force: true`, porque o Playwright recusa clicar em item não habilitado).
- **Acabamento achado na screenshot e corrigido:** depois do `Esc` o botão da
  Pedreira ficava com o anel de foco do navegador e parecia ainda selecionado;
  o painel agora tira o foco quando a ferramenta volta a `null`.
- **Corrida no roteiro, corrigida:** `window.__cangaco` só é publicado no
  `POST_RENDER`; ler logo depois de um clique falhava de vez em quando. O roteiro
  espera o frame, como nos outros passos.
- **Desvio do plano:** a mudança em `render/game.ts` (receber a ferramenta) foi
  feita na Task da cena, junto do consumidor, para cada commit compilar.
- **Roteiros existentes.** F04 e F05b assumiam o canvas em (0,0) da página; agora
  convertem pelo retângulo do canvas (`tools/shots/_canvas.js`).

### Não feito, de propósito (fora do Escopo da F06)

- Texto do motivo da recusa ao lado do cursor (GDD §10, "a planta vermelha diz por
  quê"). `canPlace` já devolve o motivo; falta só desenhá-lo.
- Porta ao sul na planta (GDD §5.1); custo/estoque e obra pendente (F07).
- `'terreno'` em `canPlace` — declarado no tipo, **não verificado por nenhum
  teste** (`terreno.verificadoPorTeste: false` no `F06.json`).

### Hipóteses, não fatos (não verifiquei)

- `GAME_OUT` disparando ao sair para HUD/painel foi observado só no Chromium
  headless do Playwright, em 1280×720. Outros navegadores e outras resoluções
  não foram exercitados.
- Não testei redimensionar a janela com o jogo aberto: o Phaser em `Scale.RESIZE`
  reage ao resize da janela e as dimensões do HUD/painel são fixas no CSS, então
  espero que o canvas acompanhe a célula, mas é expectativa.
- A planta só foi exercitada em tela com `quarry` (3×2); footprints de outros
  tamanhos são cobertos pelo teste de `canPlace`, não por screenshot.

## Ajuste pós-F06 — `menuBuildInicial` só para raiz (2026-09-20)

Decisões do operador, fechando as três perguntas que a F06 deixou em aberto:

- **A árvore de desbloqueio fica como está.** Decisão tomada; não se reabre.
- **`menuBuildInicial` só para raiz sem pai** (`desbloqueadoPor: null`). Passou a
  ser `[]`: a lista duplicava o que a árvore já faz e era isso que deixava o
  aceite da F12 sem conteúdo — Quarry e Woodcutter's nasciam liberados pela
  lista, então não havia o que provar ao concluir um prédio.
- **Schoolhouse liberada no início é aceitável:** o jogador pode construir uma
  segunda. O Storehouse (raiz sem pai) continua bloqueado no menu, com "ainda não
  disponível", como antes.

**Verificado (rodado, não deduzido):** com Storehouse e Schoolhouse completos e
`menuBuildInicial` vazio, a árvore sozinha libera exatamente `schoolhouse`, `inn`,
`quarry` e `woodcutters` — o esperado, e mais nada.

**O que mudou**
- `data/economy.json`: `menuBuildInicial: []`, com uma chave `_docMenuBuildInicial`
  dizendo por que a lista existe e o que não deve voltar a conter.
- `tools/data-rules.js`: `validarMenuInicialSoRaiz` — todo id em `menuBuildInicial`
  tem que ter `desbloqueadoPor: null`. **Cobertura permanente**, em
  `tests/F06-build.test.ts`, contra `validarTudo` (dado real passa; `quarry` na
  lista reprova e a mensagem nomeia `schoolhouse`; `storehouse` passa). Não é só
  prova por arquivo temporário.
- `src/sim/data/types.ts`: `menuBuildInicial` ganhou tipo explícito
  (`readonly string[]`); um `[]` importado de JSON tipa como `never[]` e não
  aceitaria nem `.includes(id)`.
- Testes de desbloqueio da F06 que percorriam a lista (agora vazia, portanto
  vazios) foram trocados por asserções sobre a árvore: o estado inicial libera
  exatamente os filhos dos prédios do cenário, calculado do JSON sem passar por
  `estaDesbloqueado`, e o menu do GDD §3.2 (Inn, Quarry, Woodcutter's) continua
  liberado. `tools/shots/F06.js` deriva o item liberado da árvore em vez de ler
  `menuBuildInicial[0]`.
- `BUILD_PLAN.md`: "terreno" saiu do parêntese do Escopo da F06, que tinha ficado
  pendente da decisão sobre o aceite.

**Verificado nesta rodada:** `npm run verify` verde e `npm run shot -- F06`,
`-- F04` e `-- F05b` passando (ver o fechamento no commit).

## Desbloqueio permanente — `tiposJaConstruidos` (2026-09-20)

**Proposta nossa, não confirmada nas fontes.** O GDD §5.1 diz só "concluir um
prédio desbloqueia os próximos da árvore"; não diz se o desbloqueio persiste
depois de demolir, e o comportamento do jogo original **não foi confirmado** —
não o consultei. É uma decisão de design do projeto, marcada como proposta: se
uma fonte contradisser, muda-se aqui.

**Por quê.** A primeira versão derivava o desbloqueio da *presença atual* do pai
em `state.predios`. Isso re-bloqueia a Serraria ao demolir o último Woodcutter's
— inclusive com uma Sawmill de pé — e frustra um cenário banal: demolir para
reposicionar. Achado do operador na revisão; não é assunto só da F16 (demolir),
porque a regra que decide o desbloqueio nasceu na F06.

**O que foi feito**
- `GameState.tiposJaConstruidos: readonly string[]`: ids dos **tipos** que já
  chegaram a `'completo'`, na ordem em que chegaram, sem repetição. O estado
  inicial nasce com os tipos dos prédios já completos (`['storehouse',
  'schoolhouse']`).
- `estaDesbloqueado` consulta essa lista em vez da presença atual. Continua
  derivado do dado (`menuBuildInicial` + `desbloqueadoPor`) e serializável.
- `registrarTipoConstruido(state, tipo)` em `sim/desbloqueio.ts`: pura,
  idempotente (devolve o mesmo estado se o tipo já está). É o ponto único que
  alimenta a lista depois do estado inicial.
- `step()` monta o estado campo a campo e **perderia o campo novo no primeiro
  tick**; o `typecheck` pegou. Agora o carrega adiante, com teste próprio.

**Verificado (rodado):** 140 testes verdes. Com um Woodcutter's completo e depois
removido do estado, a Sawmill continua liberada — também com uma Sawmill de pé, e
também no `canPlace` e no menu; demolir o único Schoolhouse não trava Quarry nem
Woodcutter's; o que nunca foi construído (Farm) segue bloqueado.

**Ainda não feito:** nada chama `registrarTipoConstruido` numa transição real,
porque ainda não existe transição para `'completo'` (a F07 cria a obra, a F11 a
constrói). A F12 liga isso ao `step()`; o aceite dela (reescrito no
`BUILD_PLAN.md`) prova a ligação ao conduzir uma obra até o fim. Até lá, a
alimentação depois do estado inicial só é exercitada por teste, chamando a função
diretamente.

## F07 — Comando de posicionar planta (2026-09-20)

Terceira feature de integração, com a nota de exceção da §10 escrita no
`BUILD_PLAN.md` **antes** de qualquer código (Task 0), valendo para a F07 e só.
Também na fila, com aprovação do operador: `+ screenshots/F07-*.png` na linha
Evidência da F07 (só ela), e três notas novas no item F11 (o laço de tempo, o
nivelamento fora do contrato da obra, o teto de HP).

### Verificado (aberto e rodado nesta sessão)

- `npm run verify` verde: typecheck, lint, `validate:data` (9 arquivos, 0 erros) e
  177 testes (37 novos, em `tests/F07-posicionar.test.ts` e `tests/F07-sessao.test.ts`).
  Evidência headless em `test-output/F07.json`, aberta com Read.
- **Aceite escrito**, os dois casos: `PlaceBlueprint` produz uma obra com
  `estado 'obra'`, `hp 0` e `faltam` igual ao `timber`/`stone` de `buildings.json`
  (lido do dado; com outro custo injetado o resultado muda); e um segundo comando
  na mesma posição é rejeitado — em ticks separados e **dentro da mesma lista**
  (o segundo enxerga o estado que o primeiro deixou), com o evento
  `command-rejected` e o `motivo`.
- **O custo não sai no clique:** `estoqueTotal` idêntico antes e depois, e cada
  `estoque` de prédio existente é o mesmo objeto. Na tela, o HUD segue em
  Dinheiro 20 / Tábua 40 / Pedra 30 depois de plantar duas obras.
- **Obra não desbloqueia:** plantar um Woodcutter's não libera a Sawmill nem mexe
  em `tiposJaConstruidos`.
- **Determinismo com comandos de verdade:** mesma lista → mesmo JSON, e com
  save/load no meio (o helper canônico `compararComESemSave` ganhou um parâmetro
  opcional `comandosNoTick`, sem quebrar quem já o chama). `step` não muta uma
  lista de comandos congelada com elemento real — a cobertura que a F02 registrou
  como "volta na F07".
- **Visual** (`npm run shot -- F07`, fora do `verify`, §8): 18 afirmações e 3
  screenshots, todas abertas com Read — planta verde antes do clique; a obra
  "Pedreira (em obra)" translúcida com a planta vermelha por cima; duas obras em
  sequência. Rodei 3 vezes seguidas, estável. `shot -- F06`, `-- F05b` e `-- F04`
  continuam passando.

### Probe, não cobertura contínua (CLAUDE.md §8)

Para provar que o `default` do `switch` em `step()` de fato reprova: acrescentei
um membro fictício à união `Command`, rodei o `typecheck` — reprovou em
`tick.ts(42,15): Type '"ProbeFicticio"' is not assignable to type 'never'` — e
revertei. **Isso demonstra que a regra funciona hoje, não que continua
funcionando.** A proteção permanente é a própria atribuição a `never`, que o
`typecheck` do `npm run verify` checa a cada rodada; o `throw` em runtime (comando
fora da união) tem teste próprio.

### O contrato da obra (herdado por F09, F10, F11, F12 e F16 — aprovado pelo operador)

`Predio` virou **união discriminada por `estado`**: `PredioCompleto` (com
`capacidade` e `estoque`, como antes) e `PredioEmObra` (com `obra: { faltam }`, sem
`capacidade` nem `estoque`). Um prédio em obra sem `obra`, ou completo sem
`estoque`, não é representável.

- **`hp` da obra = HP já martelado**, de 0 até `def.hp`. O total vem do dado
  (`buildings.json` valida `(timber + stone) × 50`); não é guardado no estado.
- **`faltam` = o que ainda precisa ser entregue**, por mercadoria. Nasce igual ao
  custo do dado. O entregue é `custo − faltam`. Reservas de vaga (F09) **não**
  moram no prédio: moram no JobBoard.
- **Obra não guarda mercadoria.** O que o serf entrega **sai do estoque do armazém
  e entra em `faltam`** (decrementa): é aí que o custo é debitado, nunca no clique.

| Feature | Uso do contrato |
|---|---|
| **F09** JobBoard | destino de material = prédio `'obra'`; vaga = `faltam[m]` menos as reservas do próprio JobBoard |
| **F10** serf | entregar 1 de `m`: `faltam[m] −= 1` **e** `estoque.saida[m] −= 1` no armazém (aceite da F10: obra pedindo 2 stone recebe 2, armazém 10→8) |
| **F11** laborer | martelar `hp += hpPorMartelada` enquanto `hp < teto`, com `entregues = Σ_m (custo[m] − faltam[m])` e `teto = entregues × hpPorMaterialEntregue`; ao `hp === def.hp` reconstrói como `'completo'` (com `capacidade`/`estoque` do tipo, hoje privados em `state.ts`) |
| **F12** | ao virar `'completo'`, chama `registrarTipoConstruido`; obra não desbloqueia |
| **F16** demolir | remove o prédio; devolução = `devolucaoAoDemolir × (custo − faltam)` |
| render | estágio visual derivado de `hp` e `def.hp`, sem campo extra |

**Fora do contrato, de propósito:** o **nivelamento**. Sem consumidor hoje, sem
campo hoje; está registrado na Nota do item F11 do `BUILD_PLAN.md` (não só aqui),
porque é a F11 quem vai acrescentar campo em `Obra`. Também registrado lá: o
Escopo da F11 diz "cada material entregue soma 50 HP", e o contrato lê isso como o
GDD §5.1 diz — a entrega **habilita** 50 HP de martelada, e a martelada soma ao
`hp`.

### O que foi decidido e por quê

- **`step()` fecha o `switch` com `never` na *discriminante*.** Com um único membro
  na união, o TypeScript não estreita `command` para `never` no `default` (só filtra
  membros de uma união); estreita `command.type`. Atribuir `command.type` a `never`
  funciona com um membro e continua valendo quando a união crescer. Achado do
  `typecheck`, não previsto no plano. **CORRIGIDO NA F08: a última frase estava
  errada.** Assim que a união ganhou membros de verdade (F08), `command` passou a
  ser `never` no `default` e `command.type` deixou de compilar; voltou o idioma
  padrão (`const naoTratado: never = command`), que é o que vale com uma união real.
  A atribuição da discriminante só servia enquanto havia um membro. Descoberto pelo
  `typecheck`, não por mim: afirmei o que não tinha verificado.
- **A fila de comandos mora na `Sessão` (`src/sessao.ts`)**, o "laço externo" do
  CLAUDE.md §5: dona do `GameState` **e** da fila. `input/` só produz comandos (por
  callback), `sim/` só os recebe como parâmetro de `step`, `render/` e `ui/` nunca a
  tocam, e ela não entra no `GameState` (teste). `enviar` só enfileira; `passo()`
  drena, roda **um** `step` e avisa quem ouve.
- **O disparo é provisório, numa linha só de `main.ts`:** cada clique faz
  `enviar` + `passo()`. Consequência aceita: **o `tick` avança 1 por comando** até a
  F11, que traz o relógio de 10 Hz e passa a chamar `passo()` num timer — a mudança
  é só quem dispara, a fila e a Sessão não mudam. Inócuo hoje, porque nenhum sistema
  consome tempo antes da F09; mas **ninguém deve depender desse `tick` antes do
  relógio existir.** Descartado: `step(estado, [cmd])` direto no clique, que
  espalharia "avançar o relógio a cada clique" pelo código.
- **O clique sempre emite** (com ferramenta ativa), mesmo sobre um lugar que a sim
  vai recusar: a decisão é da `sim/` (`canPlace` dentro do `step`); a planta
  verde/vermelha é só consultiva. A rejeição sai como evento `command-rejected`
  (canal de `state.events` do CLAUDE.md §5) — o texto "por quê" ao lado do cursor
  (GDD §10) **continua fora do escopo**.
- **A ferramenta segue ativa depois de plantar** (decisão do operador): o jogador
  planta vários prédios em sequência e a estrada da F08 exige isso; `Esc` cancela.
- **Sem checagem de "tenho material?":** o jogador pode plantar sem ter; a obra
  espera as entregas.
- **A cena entrega o tile clicado e mais nada** (recalcula o tile no `pointerdown`,
  sem confiar no último `pointermove`); `src/input/` continua sem importar `phaser`.
- **O diff de prédios da cena passou a usar `id + estado`.** Antes só o id: uma
  obra que vira `'completo'` (mesmo id) ficaria desenhada como obra. Como `'obra'`
  nasce agora, é aqui que isso se resolve, não na F11.
- **`createInitialState` lança se o cenário descrever um prédio que não seja
  `'completo'`**, em vez de fabricar um prédio inválido por cast.
- **Refatoração mínima:** `custoDoPredio(def)` (em `sim/systems/build.ts`) é o
  único ponto que lê `timber`/`stone` do dado; o menu Build (F06) passou a usá-lo.
- **Tropeço meu, corrigido:** o rótulo da obra saiu com uma quebra de linha real
  dentro do template (o `\n` de um script de edição virou quebra literal). Vi na
  saída do `grep`, corrigi e commitei separado.

### Não feito, de propósito (fora do Escopo da F07)

- Texto do motivo ao lado do cursor (GDD §10). O evento `command-rejected` já
  carrega o `motivo`; falta só desenhá-lo.
- Nenhuma transição `obra → completo`, nenhuma entrega, nenhum laborer: F10/F11.
  `registrarTipoConstruido` (F06) continua sem chamador real; a F12 o liga.
- Estágios visuais da obra (madeira, pedra): F11. Hoje a obra é só a marcação.

### Hipóteses, não fatos (não verifiquei)

- O `pointerdown` foi exercitado só com o botão esquerdo, no Chromium headless do
  Playwright a 1280×720. Outros navegadores, botões e resoluções não foram testados.
- A obra translúcida com a planta vermelha por cima é legível na screenshot, mas
  não avaliei o contraste em telas reais nem com muitas obras sobrepostas à vista.

## F08 — Estradas (2026-09-20)

Quarta feature de integração, com a nota de exceção da §10 escrita no `BUILD_PLAN.md`
**antes** de qualquer código (Task 0), valendo para a F08 e só. Também na fila, com
aprovação do operador: a nota do **desvio provisório do custo**, a leitura de
"Demolir" e notas nos itens **F09, F10, F11 e F15** (o contrato que cada uma vai
precisar — para não ficar só aqui, a seis features de distância). `Escopo`, `Aceite` e
`Evidência` de nenhum item foram tocados.

### Verificado (aberto e rodado nesta sessão)

- `npm run verify` verde: typecheck, lint, `validate:data` (9 arquivos, 0 erros) e
  245 testes (68 novos, em `tests/F08-estradas.test.ts` e `tests/F08-arrasto.test.ts`).
  Evidência headless em `test-output/F08.json`, aberta com Read.
- **Aceite escrito:** estrada em L de 9 tiles → `isConnected(A, B)` verdadeiro; remove
  um tile do meio → falso, com os dois pedaços ainda conectados por dentro.
- **Custo no comando:** a pedra cai exatamente `novos × custoStonePorTile` (lido do
  dado; com o custo injetado o débito muda); só ela; tile que já é estrada não custa;
  débito em `predios.ordem`, gaveta `saida` antes de `entrada`, cobrindo com dois
  armazéns; `sem-pedra` e tile inválido no meio **não deixam estrada parcial**;
  fronteira exata (pedra = custo aceita, uma a menos recusa).
- **Devolução ao demolir:** 2 tiles demolidos devolvem 1 pedra (`floor(2 × 0.5)`, o
  0.5 vem de `terrain.json`); 1 tile devolve 0; vai à gaveta `saida` do **primeiro**
  armazém completo (o mesmo do débito); sem armazém completo nada é devolvido;
  fração injetada muda o resultado. A regra nova de `validate:data`
  (`estrada.devolucaoAoDemolir` em `[0, 1]`) tem teste **permanente** contra
  `validarTudo` (`1.5`, `-0.1`, `'0.5'`, `null` e `NaN` reprovam).
- **Prédio sem ligação:** com a rua ao longo da borda sul do armazém e da escola, os
  dois estão ligados; demolir um trecho do meio desliga a escola; o prédio segue o
  **mesmo objeto**, e as chaves do estado são as mesmas (não há campo "desligado").
- **Consulta O(1) entre mudanças (estrutural, sem teste de tempo — seria flaky):** o
  índice é o mesmo objeto para a mesma referência de `estradas`; `step` sem comando de
  estrada mantém a referência (`toBe`) por dezenas de ticks, com comandos de outros
  tipos no meio; um comando que muda algo troca a referência.
- **Conectividade:** 4 direções (diagonal não liga); trechos separados não ligam e o
  tile que falta os une; tile que não é estrada nunca está conectado.
- **Determinismo:** mesma lista → mesmo JSON, e com save/load no meio; `step` não muta
  lista congelada.
- **Arrasto (`input/`):** `tilesEntre` em 500 pares sorteados (RNG semeado) tem os
  extremos, `|dx|+|dy|+1` tiles, só passos ortogonais e nenhum tile repetido; um salto
  de vários tiles entre amostras sai contíguo; soltar sem mover = 1 tile; sair do
  canvas, `Esc` e trocar de ferramenta cancelam **sem emitir**; o modo prédio da F07
  segue idêntico; `R` escolhe a estrada (e Ctrl+R não).
- **Visual** (`npm run shot -- F08`, fora do `verify`, §8): 30 afirmações e 3
  screenshots, todas abertas com Read — a prévia verde do L ao longo da borda sul dos
  dois prédios (Pedra **ainda 30**); a estrada depois de soltar (Pedra **21**: o custo
  saiu); a rede partida ao demolir 2 tiles do meio (Pedra **22**: devolveu 1). Rodei 3
  vezes seguidas, estável. `shot -- F07`, `-- F06`, `-- F05b` e `-- F04` seguem verdes.

### Probe, não cobertura contínua (CLAUDE.md §8)

Acrescentei um membro fictício a `Command` e rodei o `typecheck`: reprovou em
`tick.ts(56,15): Type '{ readonly type: "ProbeFicticio"; }' is not assignable to type
'never'` — revertido. Demonstra que a regra funciona hoje, não que continua funcionando;
a proteção permanente é a atribuição a `never`, checada a cada `verify`.

### O contrato de `estradas` (herdado por F09, F10 e F15 — aprovado pelo operador)

`GameState.estradas: Readonly<Record<string, true>>` — chave `"gx,gy"`, só tiles **de pé**.

- `ehEstrada(estradas, tile)` é **O(1)** (lookup): é o que o A* do serf (F10) pergunta a
  cada passo.
- "Existe caminho de A até B?" é **O(1) amortizado** por um **índice de componentes
  conexos**, construído uma vez por mudança de estrada e **memoizado pela referência**
  de `state.estradas` (`WeakMap` em `sim/estradas.ts`). `step()` carrega a mesma
  referência enquanto nenhum comando de estrada muda algo; então os milhares de
  perguntas de um tick (F09) custam um lookup, não uma busca.
- **Não se guardam componentes no estado:** seria dado derivado serializado, que
  poderia ficar inconsistente com os tiles. O `WeakMap` é memória de cache, não estado
  de jogo: função pura da referência imutável, não entra no JSON, não afeta determinismo.
  (Se o operador preferir zero estado de módulo, a alternativa é guardar `componentes`
  no `GameState` — ao preço de uma segunda fonte de verdade.)
- **Conectividade em 4 direções.** O GDD não responde; o arrasto é 4-conectado e diagonal
  seria um atalho por dentro de dois cantos.
  *(Atualização pós-F10: o GDD **não** trazia a linha das diagonais e agora traz — ver "Ajuste
  pós-F10". A decisão é do operador: 4 direções na Fase A, diagonal em `IDEIAS.md`.)*
- **Determinismo:** os ids de componente vêm dos tiles **ordenados** (`gy`, depois `gx`),
  nunca de `Object.keys` na ordem de inserção; o índice depende só do *conjunto*.
- **Só o que está de pé.** Se a F11 fizer laborer construir estrada, a "estrada planejada"
  é **outro campo** (como `obra` é para prédio), e `isConnected` continua respondendo só
  sobre este.
- **API:** `chaveDeTile`, `ehEstrada`, `componenteDe`, `isConnected(state, from, to)`
  (`false` se algum lado não é estrada), `indiceDeEstradas`, `tilesDaPorta`,
  `predioLigadoAoArmazem`, `canPlaceRoad`, `pedraDisponivel`.

### O custo em pedra: de onde, quando, e por que difere da obra da F07

- **No comando**, **dos armazéns completos** (só armazém: pedra na saída de uma Quarry
  espera o serf, não é estoque gastável), em `predios.ordem`, gaveta `saida` e depois
  `entrada`. Atômico: sem pedra suficiente o comando inteiro é recusado.
- **Desvio consciente e provisório da regra "o custo sai na entrega".** Essa regra existe
  porque o material de um *prédio* **viaja**: o serf o leva ao canteiro e `faltam` cai. A
  regra de fundo é *o material sai do estoque quando é comprometido com o destino*. A
  estrada, na F08, não tem canteiro nem viagem — o aceite exige que o tile exista e
  conecte no próprio comando, e serf (F10) e laborer (F11) não existem. Aplicar a mesma
  regra com trânsito zero é debitar no momento em que o tile nasce. Contradiz o GDD §5.4
  ("feita por laborers"). Quando a F11 chegar, o operador escolhe: continua instantânea,
  ou vira canteiro por tile (campo novo) e o débito migra para a entrega. Registrado na
  nota da F08, na nota da F11 e no comentário de `aplicarPlaceRoad`.
- **Herdado por F09:** quando o JobBoard reservar pedra, o débito da estrada só pode tirar
  do **disponível** (estoque − reservado). Nota no item F09.
- **Efeito colateral a decidir na F15:** `estoqueTotal` (o HUD, F05a) soma **todos** os
  prédios; a estrada gasta só de **armazém**. Hoje idênticos; quando a Quarry guardar
  saída própria, o HUD pode mostrar mais pedra do que a estrada pode gastar. Nota no F15.

### Demolir devolve pedra (decisão do operador, não pergunta em aberto)

Sem devolução a ferramenta seria **punitiva sem justificativa de design**: o jogador
redesenha o traçado o tempo todo (o GDD pede duas rotas entre prédios relacionados e
atalhos desde cedo) e cada correção queimaria pedra para sempre. `terrain.json` ganhou
`estrada.devolucaoAoDemolir: 0.5` — o mesmo valor de `buildings.construcao`, mas **campo
próprio**, porque estrada e prédio podem divergir. A pedra volta ao mesmo armazém de onde
sairia o débito, arredondando para baixo.

**Consequência conhecida:** o `floor` é **por comando**, então **demolir tile a tile
devolve zero** — e esse é o gesto natural ao corrigir um traçado. Está escrito, não
escondido (o roteiro e os testes arrastam sobre vários tiles). **Se o playtest mostrar que
é sempre um a um, a alternativa é acumular a fração num resto por armazém** (a fração que
sobra de cada demolição soma na seguinte, e a pedra inteira é devolvida quando o resto
completa uma unidade). Não implementada agora, por decisão do operador.

### O que acontece com prédio que fica sem ligação (ponto 4)

**Nada.** O prédio segue de pé, com o mesmo `estado`, `hp` e `estoque` (o mesmo objeto).
"Desligado" **não é um campo**: é uma consulta derivada (`predioLigadoAoArmazem`),
calculada na hora — alguma **porta** do prédio é estrada e está no mesmo componente da
porta de algum armazém completo. A "porta ao sul" (GDD §5.1) é a **borda sul inteira** do
footprint, em vez de uma coluna escolhida: o GDD não diz qual, e escolher seria inventar;
qual tile o serf usa é da F10. Quem reage é quem consome: a F09 não cria tarefa para
destino sem ligação, a F10 solta a reserva quando o caminho some (já é o aceite dela).
Estrada não se constrói sobre prédio (nem obra), e o `canPlace` da F06 passou a recusar
prédio sobre estrada com o motivo `'estrada'`.

### O arrasto, e o que fazer se o playtest reclamar

- **Um arrasto = um comando**, ao soltar. Enquanto arrasta só há prévia (verde/vermelha,
  perguntando `canPlaceRoad`), que mora em `input/`, fora do `GameState`.
- **Interpolar:** um `mousemove` rápido pula tiles e uma estrada com buraco não conecta;
  `tilesEntre` liga cada amostra à anterior por uma linha 4-conectada.
- **Sair do canvas com o botão apertado CANCELA** — padrão conservador, aprovado pelo
  operador. Motivo: fora do canvas o Chromium para de entregar `mousemove` (achado da
  F06), então o último trecho conhecido estaria truncado num ponto que o jogador não
  escolheu; gastar pedra nisso em silêncio é pior que cancelar. **Se o playtest mostrar
  irritação, trocar para "confirma até onde chegou" é uma linha:** em `aoSairDoMapa`
  (`src/input/colocar.ts`), chamar o fechamento do arrasto em vez de descartá-lo.
- **No roteiro, o erro da F06 virou erro do helper:** `arrastarDentroDoCanvas` **lança** se
  qualquer ponto cair fora do canvas. O único movimento que sai (o que prova o
  cancelamento) é um `page.mouse.move` explícito, fora do helper, com o porquê escrito.
  Na primeira execução o passo do cancelamento falhou porque **escolhi tiles fora da área
  visível**; quem acusou foi a asserção de visibilidade do próprio roteiro — corrigi a
  geometria, não a asserção.

### O que foi decidido e por quê (o resto)

- **"Demolir" = tiles de estrada.** Demolir prédio é a F16 ("Painel de seleção e
  demolição"); `Delete` fica para ela. Só `R` (estrada) entrou no teclado.
- **Tudo ou nada:** um tile inválido no meio recusa o arrasto inteiro (`fora-do-mapa`,
  `sobreposicao`, `sem-pedra`), com o **tile culpado** no evento. Trecho vazio ou já
  construído: aceito, sem custo e sem evento. Demolir tile que não é estrada:
  idempotente, sem evento.
- **`terreno` não é motivo de recusa de estrada**, como não é de prédio: o mapa não tem
  terreno variado (IDEIAS.md).
- **Render:** todos os tiles num único `Graphics`, refeito só quando a referência de
  `state.estradas` muda — não um objeto por tile.
- **Tropeços que registro:** (1) a afirmação da F07 sobre o `never` na discriminante
  estava errada (ver a correção lá); (2) achei, e arrumei de passagem, um comentário da
  regra da F05b colado em cima da função errada em `tools/data-rules.js` (resíduo de uma
  sessão anterior).

### Não feito, de propósito (fora do Escopo da F08)

- Alerta "Sem estrada até o armazém" (GDD §10, P1) e qualquer marcação visual de prédio
  sem ligação: nenhum efeito visual do ponto 4 nesta feature.
- Prévia com o **custo acumulado no cursor** (GDD §10): `previaDeEstrada.custo` já é
  publicado; falta só desenhá-lo.
- Estrada como **canteiro** (laborer constrói): decisão da F11.
- Reserva de pedra pelo JobBoard: F09.

### Hipóteses, não fatos (não verifiquei)

- **Desempenho real:** a garantia é **estrutural** (referência reaproveitada), não medida em
  tempo. Não medi o custo de reconstruir o índice em um mapa cheio de estrada.
- O cancelamento ao sair do canvas e o arrasto inteiro foram exercitados só no Chromium
  headless do Playwright, a 1280×720, com o botão esquerdo.
- O `WeakMap` do índice assume que ninguém **muta** `state.estradas` no lugar (o estado é
  imutável por contrato e `deepFreeze` cobre os testes); não há guarda em runtime.
- A legibilidade da estrada (terra sobre grama) foi vista nas screenshots, não avaliada em
  telas reais nem com redes grandes.

## F09 — JobBoard (2026-09-20)

Só `sim/`, `data/`, `tools/` e `tests/`: **nenhum arquivo de `render/`, `ui/` ou `input/`**
mudou (`git diff --name-only f48f6ca..HEAD` conferido), então **não precisou da exceção
da §10** e não há nota de integração. Nada muda na tela; por isso não há screenshot novo
da F09 — rodei os roteiros F04–F08 só como não-regressão. Na fila (aprovado pelo
operador, antes do código): notas nos itens **F10, F11, F13 e F15** (o que cada uma
herda do JobBoard). `Escopo`, `Aceite` e `Evidência` de nenhum item foram tocados.

### Verificado (aberto e rodado nesta sessão)

- `npm run verify` verde: typecheck, lint, `validate:data` (9 arquivos, 0 erros) e
  **327 testes** (82 novos: 5 em `F09-escada`, 39 em `F09-jobboard`, 31 em
  `F09-sistema`, 7 em `F09-estrada-reserva`). Evidência headless em
  `test-output/F09.json`, **aberta com Read**.
- **Aceite escrito:** 1 tarefa e 2 unidades → só uma faz `claim` (a segunda recebe
  `tarefa-ja-reclamada`); depois do claim o disponível na origem cai 30 → 29 e o
  reservado sobe 0 → 1 (e a vaga no destino 2 → 1, reservado 0 → 1); `liberar`
  restaura o estado **inteiro** (`toEqual` e igualdade do JSON, byte a byte).
- **Reserva dupla, metade a metade** (ponto 1): com 1 unidade em estoque e vaga de
  sobra (4), o 2º claim falha por `origem-sem-recurso`; com estoque de sobra (29) e
  vaga 1, falha por `destino-sem-vaga`; em ambos a recusa **não deixa nada reservado**
  na outra ponta (reservado = 1 dos dois lados só pelo 1º claim) e o claim é atômico
  (uma única atribuição de estado depois de todas as checagens).
- **`release` em todo ramo** (ponto 2): um teste por ramo, cada um provocando a falha,
  rodando `step` e afirmando **as duas reservas de volta a 0**, o efeito e o evento
  `task-released`: `unidade-removida` e `pedido-da-unidade` **reabrem** a mesma tarefa;
  `caminho-cortado`, `origem-sumiu`, `origem-sem-recurso`, `destino-sumiu` e
  `destino-completo` (destino que encheu **e** destino que virou prédio completo)
  **cancelam**. Mais um caso de destino com duas reclamadas e `faltam` caindo a 1: solta
  só a de maior número.
- **Propriedade estrutural:** RNG semeado, 3 sementes × 200 passos, `violacoesDeInvariantes`
  vazia depois de **cada** `step` (tarefa reclamada sempre com unidade viva, origem com
  recurso, destino que ainda é obra com vaga e caminho; nenhuma unidade com duas tarefas;
  nunca mais tarefas que o `faltam`; `reservado ≤ disponível` nas duas pontas). Números
  reais de F09.json: 38 claims e liberações `unidade-removida` 10, `pedido-da-unidade` 6,
  `caminho-cortado` 10, `origem-sumiu` 4, `origem-sem-recurso` 2, `destino-sumiu` 1,
  `destino-completo` 3. Uma asserção **permanente** exige ≥ 1 de cada ramo.
- **Distância** (ponto 3): no cenário adversarial, a obra "perto" está a 4 em linha reta
  e a **21** por estrada; a "longe" a 15,03 em reta e a **17** por estrada. `reclamarMelhor`
  escolhe a "longe", mesmo com número de tarefa maior. `t2` vem antes de `t10`
  (comparação numérica do `numero`, não da string).
- **Save/load** (ponto 5): `compararComESemSave` passa sem o gancho novo, e **com uma
  reserva pendente atravessando o save** (tarefa reclamada no tick 3, save no tick 7,
  JSON final igual byte a byte, reserva ainda 1 na origem). O `JobBoard` é JSON puro.
- **A estrada respeita a reserva:** com 5 de pedra na saída e 2 reservadas, uma estrada
  de 4 tiles é recusada com `sem-pedra` e uma de 3 passa deixando exatamente a pedra
  reservada; esgotado o disponível da saída o débito vai à `entrada`; um armazém com a
  saída toda reservada é pulado. Os testes da F08 seguem verdes (são o alarme).
- **Não-regressão visual:** `shot -- F04`, `F05b`, `F06`, `F07` e `F08` passaram; abri
  `F08-2-estrada-desenhada.png` (Pedra **21** = 30 − 9 tiles, igual à F08).

### Probe, não cobertura contínua (CLAUDE.md §8)

Prova por mutação, **evidência desta sessão**, não proteção permanente: (1) trocar a
distância por euclidiana reprovou o teste da volta (Task 3); (2) em `sanearTarefas`,
nunca detectar `caminho-cortado` → 5 falhas; nunca soltar o excedente de reclamadas →
6 falhas; ignorar unidade removida → 5 falhas (arquivo restaurado e conferido com `cmp`).
Demonstra que os testes discriminam hoje. A proteção permanente são os próprios testes
(um por ramo + a propriedade com a asserção de cobertura) rodando no `verify`.

**Um tropeço que o próprio teste pegou:** a 1ª versão da propriedade só destruía o mundo
(nada era reposto), e a asserção de cobertura mostrou **`caminho-cortado` = 0** em 600
passos (e `pedido-da-unidade` = 0 porque eu não o contava). O limiar `> 20` de claims que
eu tinha chutado era arbitrário e caiu por isso; reescrevi o caos com destruição
**dirigida** ao que uma tarefa reclamada usa (unidade, armazém, porta, obra) e ações de
**reposição** (rua, obra, armazém, serf, estoque). Não afrouxei a asserção: ela exige
cada ramo ≥ 1. Fragilidade que registro: `destino-sumiu` aparece **1 vez** (semente
fixa, então determinístico; se o caos mudar e ele zerar, o teste diz qual ramo faltou).

### O contrato do `JobBoard` (herdado por F10, F11, F13 e F15)

`GameState.jobs: { tarefas: Colecao<Tarefa> }`. `Tarefa`: `id` (`t<numero>`, do **mesmo**
contador `proximoId` de prédios e unidades), `numero`, `tipo` (hoje só
`'material-para-obra'`), `mercadoria`, `origem` (armazém), `destino` (obra), `estado`
(`'aberta' | 'reclamada'`), `reclamadaPor` (`string | null`, nunca `undefined`).

- **A reserva é DERIVADA das tarefas `reclamada`, não um campo** (`sim/reservas.ts`):
  `reservadoNaOrigem`/`reservadoNoDestino` contam tarefas reclamadas; `disponivelNaOrigem`
  = `saida − reservado` (só a gaveta `saida`, só armazém completo); `vagaNoDestino` =
  `faltam − reservado`. Uma tarefa **aberta não reserva nada**. Como a reserva só existe
  *através* da tarefa, `liberar` devolve as duas metades **de uma vez** e não há contador
  para dessincronizar (a lição da F05b: uma fonte de verdade); e o save/load é de graça.
- **API** (`sim/jobs.ts`): `criarTarefa`, `reclamar` (atômico; recusa devolve só o motivo),
  `liberar(state, id, motivo)`, `tarefasEmOrdem`, `reclamarMelhor`, `nivelDoTipo`,
  `distanciaDaTarefa`. **Nada é `Command`:** o jogador não manda serf (§1).
- **`sanearTarefas` roda todo tick** (depois dos comandos, antes de `gerarTarefas`) e
  revalida cada tarefa; o release **não depende de alguém lembrar de chamá-lo**. A F10 só
  precisa chamar `liberar('pedido-da-unidade')` nos estados de erro da FSM do serf.
- **Reabrir × cancelar:** falha só da unidade reabre a mesma tarefa; falha de origem,
  caminho ou destino a **cancela**, e o gerador recria com a origem certa (id novo).
- **Ordem de escolha:** `(nível lido do dado pelo id, distância por estrada, numero)`.

### Decidido (e por quê)

- **Um nível da escada de prioridade, não dois** (ponto 4). Contei o nível 2 (ouro →
  escola) como alcançável porque a escola existe; o **operador corrigiu**: não há demanda
  de ouro até a F13. Só o **nível 3** (material → obra) tem produtor. Os outros seis
  ficam **só no dado**, com `id` em cada linha de `delivery.json` (regra nova de
  `validate:data`: ids e níveis únicos e contíguos, teste permanente), para o código
  referenciar `'material-para-obra'` sem o literal `3` (invariante 3). Mesma regra do
  `'terreno'` da F06: sem produtor, não se implementa.
- **Distância = caminho por estrada entre as portas** (ponto 3, aprovado): BFS em 4
  direções sobre o grafo da F08, entre a borda sul de cada prédio, memoizado pela
  referência de `estradas`. **Mede só a perna origem → destino da entrega**; não mede
  unidade → origem (as unidades nascem fora da estrada, e medir isso pede A* com custo de
  terreno). **A F10 substitui** por A* a partir da posição do serf; a nota está no item
  F10 do `BUILD_PLAN.md`. Não inventei pathfinding.
- **Uma tarefa = uma unidade de recurso** (sem campo `quantidade`): o GDD diz "a unidade
  de recurso" e não há dado de capacidade de carga do serf. Saída, se mudar: `Tarefa`
  ganha `quantidade` e as somas passam a somá-la. **Decidido pelo operador** (ver "Ajuste pós-F10").
- **Origem da tarefa gerada** = armazém completo, **ligado por estrada**, com `disponível > 0`
  e de menor caminho (empate: ordem em `predios`). O gerador **não** desconta as tarefas
  abertas do estoque (pode haver mais tarefas abertas que estoque; o `claim` é quem
  recusa). Tarefa **aberta** cuja origem ficou sem nada livre é cancelada e recriada de
  outro armazém, se houver.
- **O débito de pedra da estrada (F08) só tira do disponível** — a nota da própria F08
  exigia. Toca `pedraDisponivel` e `debitarPedra`; a `entrada` não é reservável.
- **Decisão E do operador — não otimizar; registrar o número.** Cenário de carga: **20
  obras** plantadas ao longo de uma rua, estoque de sobra, **300 ticks, ninguém
  reclamando** (o jogo real antes da F10). Resultado em F09.json: **100 tarefas geradas,
  máximo simultâneo 100, 100 no fim** — 5 por obra (uma pedreira pede 3 de tábua e 2 de
  pedra), **sem churn** (cada tarefa foi criada uma única vez). Invariantes checadas a
  cada tick nos primeiros 5 e a cada 25. **É o número que a F10 usa para decidir** se o
  índice por (prédio, mercadoria) é necessário. Não é um veredito: não medi tempo.

### Não feito, de propósito (fora do Escopo da F09)

- **`concluir`/entrega** e o ciclo em duas fases (coleta consome a reserva da origem →
  carga na unidade; entrega consome a vaga → `faltam − 1`): F10, com o estado
  `carregando`. Um `concluir` "teleporte" seria função sem consumidor e fixaria um
  contrato errado.
- Níveis **1, 2, 4, 5, 6 e 7** da escada (F13, F15, F20), `alertaTarefaSemCandidato` e
  `maxSerfsNoMarketplace`: continuam só no dado.
- O portão **"obra já nivelada"** do nível 3: a `Obra` da F07 não tem campo de
  nivelamento. Não criei predicado "sempre verdadeiro"; a F11 acrescenta o campo **e** o
  portão em `gerarTarefas` (nota no item F11). Hoje o gerador cria tarefa para toda obra
  ligada por estrada.
- **A ordenação por nível não é exercitável** com um único nível produzido; o comparador a
  tem (uma linha) e o nível vem do dado (teste com dado injetado), mas não montei
  tarefas de tipos que ninguém produz só para fingir cobertura.

### Hipóteses, não fatos (não verifiquei)

- **Custo por tick.** Pela leitura do código, `sanearTarefas`/`gerarTarefas` são O(n²) em
  nº de tarefas (cada reserva derivada é O(n) e é consultada por tarefa). Com 100
  tarefas o teste de 300 ticks roda dentro de uma suíte inteira de ~2,5 s, mas **não
  medi** nem testei 1.000 tarefas.
- **Reabrir a mesma tarefa quando a unidade morre** assume que a carga (se já coletada)
  se perde ou é tratada pela F10; a F09 não tem fase de carga para testar isso.
- O cancelamento de tarefa aberta por origem sem nada livre **poderia oscilar**
  (cancelar/recriar) se o estoque ficar rodando em torno de zero; o caos aleatório não
  mostrou violação, mas não é um teste dirigido a isso.
- O comportamento com **serfs reais** (F10) — filas, várias unidades disputando a mesma
  origem — só existe como propriedade sobre claims sorteados, não como jogo.

## F10 — FSM do Serf (2026-09-20)

Quinta feature de integração, com a nota de exceção da §10 escrita no `BUILD_PLAN.md`
**antes** de qualquer código (Task 0), valendo para a F10 e só: `sim/`, `render/` e o laço
externo (`main.ts`); `input/` e `ui/` **não** foram tocados (conferido por `git diff
--name-only`). Também na fila, aprovadas pelo operador: a decisão de como o serf se move sem
o laço, o que a F11 muda, a **decisão pendente do `avancar`** (Nota no item F11, não só
aqui) e a Nota do F16 (repetir a demolição pelo comando). `Escopo`, `Aceite` e `Evidência`
de nenhum item foram tocados.

### Verificado (aberto e rodado nesta sessão)

- `npm run verify` verde: typecheck, lint, `validate:data` (9 arquivos, 0 erros) e **456
  testes** (129 novos: 6 em `F10-movimento`, 33 em `F10-astar`, 30 em `F10-ciclo`, 12 em
  `F10-desempate`, 24 em `F10-fsm`, 24 em `F10-falhas`). Evidência headless em
  `test-output/F10.json`, **aberta com Read**.
- **Aceite escrito:** armazém com 10 stone e uma obra pedindo 2 → em **38 ticks** a obra recebeu
  2 (`faltam.stone` 0), o armazém ficou com **8**, sem tarefa no fim, todos os serfs ociosos, 2
  `task-completed` e nenhum `task-released`.
- **A FSM é a do GDD §6.2, sem estado novo:** um serf sozinho passa por `ocioso → indo_buscar →
  carregando → indo_entregar → entregando → ocioso`, e `carregando`/`entregando` duram 1 tick.
  Em cada fase as reservas são as do contrato: `indo_buscar` reserva origem **e** destino;
  na coleta o armazém cai 10 → 9 **no tick exato** em que a tarefa vira `carregando` (origem
  0, destino 1); a obra só recebe na entrega.
- **Falha graciosa (o aceite escrito e o pedido do operador):** obra tirada com o serf
  **carregado a caminho** → tarefa cancelada (`destino-sumiu`), serf em `devolvendo` com a
  carga na mão, e ao chegar ao armazém a pedra **volta (9 → 10)**, evento `cargo-returned`,
  serf ocioso. Com o serf **ainda indo buscar** (e nos ticks de `carregando` e `entregando`):
  as duas reservas voltam, nada sai do armazém. **Estrada cortada no meio da viagem** pelo
  comando **real** `DemolishRoad`: à frente do serf, **sob** o serf, com o serf indo buscar,
  e com rota alternativa (duas pistas: replaneja, **zero** liberações). **Refazer a estrada**
  retoma e a obra fecha (`faltam` 0, armazém 8 = 10 − 1 da rua − 1 entregue).
- **`devolvendo` completo:** escolhe o armazém de menor custo A\* **a partir de onde o serf
  está** (devolve ao `perto`, não ao de origem); recalcula se o alvo some no caminho; sem
  armazém nenhum **espera com a carga** e deposita quando nasce um.
- **A\* provado contra um oráculo independente** (relaxamento em fila, sem heap nem
  heurística): custo igual em 160 mapas livres e 240 redes por estrada sorteados com RNG
  semeado; por estrada, o A\* acha caminho **se e somente se** `isConnected` da F08 acha (500
  redes sorteadas): a vizinhança 8 sem cortar quina não liga o que a rede de 4 direções
  desliga. Cache: mesma pergunta devolve o **mesmo objeto**; referência nova de `estradas` ou
  de `predios.ordem` invalida; trocar só o estoque **não** invalida.
- **"Nunca euclidiana" segue valendo:** `F09-jobboard.test.ts` (o desempate da F09,
  `t2`×`t10`) **não foi editado** e passa contra a função nova. Caso novo, da perna do serf: um
  muro de obras faz a reta ao armazém A valer **7** e a pé **209 ticks**, e ao B 13 em reta e
  **96** a pé; com entregas iguais (190 = 190), o serf do outro lado do muro escolhe B, o do
  lado de A escolhe A, e sem unidade decide o número. Um serf **cercado** (sem rota) tem a
  tarefa reaberta (`pedido-da-unidade`) e **40 ticks seguidos sem laço reclama/libera**,
  porque `reclamar` passou a recusar `sem-caminho` quando a perna dele não existe.
- **Bens conservados:** estoques + cargas em trânsito − `faltam` é constante entre dois `step`
  em todo tick sem comando, no aceite, nos quatro serfs em paralelo e na propriedade; a única
  perda é a decisão abaixo (carga some com a unidade, e o teste afirma "exatamente 1").
- **Propriedade estrutural:** RNG semeado, 3 sementes × 250 passos, invariantes do quadro e da
  FSM em **todo** passo. Números reais do F10.json: os seis estados vistos, **8 entregas
  concluídas, 13 cargas devolvidas**, liberações `destino-sumiu` 13, `caminho-cortado` 15,
  `origem-sumiu` 6, `unidade-removida` 2. Asserção permanente: cada estado e cada motivo ≥ 1.
- **Carga (decisão E, F09):** 20 obras, 4 serfs, 100 tarefas: todas entregues em **5538 ticks**,
  sem churn (100 geradas, 100 concluídas), invariantes e conservação amostradas. Buscas A\*
  executadas: **44**; consultas respondidas pelo cache: **10 556**.
- **Visual** (`npm run shot -- F10`, fora do `verify`, §8): 24 afirmações e 4 screenshots,
  **todas abertas com Read**: os 6 serfs/laborers ociosos com a obra e a rua desenhadas (Pedra
  19); os serfs **entre dois tiles**; a etiqueta `timber` sobre os carregados com a Tábua **caindo
  para 38** (o que vai a caminho não é estoque de ninguém); a obra entregue (Tábua 37, Pedra 17).
  `shot -- F04`, `F05b`, `F06`, `F07` e `F08` seguem verdes.
- **Mutantes** (probe, não cobertura contínua): heurística ×3, corte de quina, cache ignorando
  `estradas` e passo diagonal com custo reto reprovam o A\*; a coleta sem tirar do armazém, a
  entrega sem abater `faltam`, o passo de 1 tick e a entrega sem remover a tarefa reprovam a
  FSM; `devolvendo` sem depositar, corte de estrada não detectado, "primeiro armazém em vez do
  mais próximo", sem replanejar e sem liberar reprovam as falhas; a perna do serf euclidiana
  reprova o desempate. Arquivos restaurados e conferidos com `cmp`. **Um tropeço que os próprios
  testes pegaram:** o A\* estava certo e o meu teste, errado (tomei 13 tiles retos; o footprint
  do armazém obriga a contornar: 96 = 1 diagonal + 11 retos + 2 de estrada, derivado à mão).
- **O agente errou um número e conferi:** a exploração disse "grama 13 ticks/tile"; o
  `loader.ts` e os JSON dão **estrada 5, grama 7** (`Math.round(6,5)`). O plano usou o valor
  conferido.

### O contrato da FSM (herdado por F11, F13 e F15)

- `Unidade.gx/gy` é o tile onde ela **está**; o movimento em curso vive em `fsmData`
  (`DadosDaFsm`: `tarefa`, `carga`, `caminho` **sem** o tile atual, `progresso` em ticks no
  passo, `armazem`). Campos ausentes são **omitidos**, nunca `undefined`; `{}` vale para laborer e
  serf ocioso. Um estado de FSM fora do GDD é **erro** (save corrompido), não ignorado.
- `Tarefa.estado`: `aberta → reclamada → carregando → (some na entrega)`. A reserva continua
  **derivada**: `reservadoNaOrigem` só conta `reclamada`; `reservadoNoDestino` conta `reclamada`
  **e** `carregando`. `liberar` de uma `carregando` **sempre cancela**.
- Ordem no `step()`: comandos → `sanearTarefas` → **`sistemaDosSerfs`** → `gerarTarefas`. O
  quadro que o serf vê já está saneado, e o que ele libera é recriado no mesmo tick.
- `sanearTarefas` sobre `carregando` olha só **unidade viva, destino e vaga**; na disputa por vaga
  solta a **reclamada antes da carregando** (quem tem carga na mão é o último a perder a vaga). O
  caminho do serf **carregado** é da FSM (só ela tem a posição).
- `posicaoDaUnidade` (`sim/selectors.ts`) é o que o render desenha: função **pura** do estado.
- **`andar` é privado de `systems/serfs.ts`.** O laborer da F11 vai precisar do mesmo movimento:
  extrair **lá**, quando houver o segundo consumidor (não antes, para não criar abstração sem uso).

### O que a F11 muda no movimento (registrado também no BUILD_PLAN)

(a) quem chama `passo()` passa a ser um timer de `TICK_MS`; (b) o render ganha a interpolação
**entre ticks** por cima da posição por `progresso`; (c) o roteiro precisa **pausar** o timer antes
de usar `avancar`; (d) a velocidade de jogo 1x/2x/3x acelera o relógio, nunca a sim. A FSM e o
`step()` não mudam.

### DÍVIDA COM DONO E PRAZO: o gancho `avancar` (operador: "nasce marcado para morrer")

`window.__cangaco.avancar(n)` roda `sessao.passo()` `n` vezes. É **ponte de harness**: escreve no
estado a partir do `window` do jogo real. Está publicado **no mesmo bloco** que já publica
`window.__cangaco` (`EstadoDebug`, `render/debug.ts`), com o comentário `PONTE DE HARNESS DA F10`
no campo, no `main.ts` e no `render/game.ts`; o `main.ts` (dono da Sessão) só injeta o callback.
Sem timer, tecla nem botão. **Dono: F11.** Ao criar o timer a F11 **decide** se ele **some** ou
**vira pausar/retomar** — decisão escrita na Nota do item F11 do `BUILD_PLAN.md`. Risco se ninguém
decidir: com o timer rodando, os screenshots deixam de ser determinísticos.

### Decidido (e por quê)

- **`devolvendo` só existe com carga.** Falha antes da coleta não tem o que devolver: a tarefa é
  liberada e o serf volta a `ocioso`. Justificativa, não estado novo.
- **`carregando` e `entregando` duram 1 tick** (o dado não tem tempo de manuseio; não inventei
  número). Decisão do operador registrada abaixo.
- **Só a perna carregada é obrigada a ir por estrada** (`obrigatoriaParaEntrega`); indo buscar e
  devolvendo andam por qualquer tile livre. Interpretação conservadora (o serf nasce na grama).
- **O custo do A\* é o tempo da viagem, em ticks inteiros** (`ticksPorTile` e a diagonal nova,
  `ticksPorTileDiagonal`, com **um único** `Math.round` — `round(√2 × 6,5) = 9`, não `10`).
  Sem float no A\*: empates exatos. Um serf **dentro** do footprint de uma obra plantada em cima
  dele sai (civis não colidem, GDD §6.4).
- **Cache pela referência de `predios.ordem`, não de `predios`:** `predios` troca a cada coleta e
  entrega e invalidaria o cache toda hora; só o conjunto de footprints importa.
- **A porta de coleta é a de menor perna livre** entre as que estão no componente da obra (guloso;
  não minimiza a soma das duas pernas).
- **A carga se perde com a unidade removida** (decisão registrada; a fome e o Dismiss decidem
  depois). O teste afirma "exatamente 1 unidade perdida".
- **Decisão E do operador — índice do JobBoard: não indexar agora.** O F09 registrou 100 tarefas;
  com serfs de verdade o A\* rodou 44 vezes contra 10 556 consultas de cache em 5538 ticks. É uma
  decisão sustentada por **contagens**, não por tempo (ver hipóteses).
- **Os testes da F09 que pressupunham "ninguém reclama" isolam a premissa, sem afrouxar a regra:**
  no release de "unidade removida" o cenário só tem o serf removido (senão outro serf reclama a
  tarefa reaberta no mesmo tick); o cenário de carga da F09 (o número `cargaComMuitasObras`) não
  tem serfs, como antes; o save/load da F09 usa o serf real e o gancho manual `reclamaNoTick3`
  saiu (era andaime do "sem unidade ainda"). Meus testes de saneamento da Task 3 passaram a testar
  o **quadro** (`sanearTarefas` + `gerarTarefas`), não o `step`.
- **O caos ganhou folego (38 dos 48 sorteios so deixam o tempo passar):** a primeira versão só destruía (1 entrega em
  750 passos); sem folego o caminho feliz quase não acontecia sob estresse. Não afrouxei nenhuma
  asserção; a distribuição é que estava enviesada.

### Decisões do operador sobre as perguntas da F10 (2026-09-20)

Eram quatro perguntas em aberto; o operador as decidiu e elas **saíram** de "Perguntas em aberto".
Registradas como decisão dele, cada uma com o porquê e a saída que ele deixou pronta:

1. **Manuseio de 1 tick ao carregar e ao entregar: fica.** É mínimo **estrutural** (a FSM precisa
   de um tick para mudar de estado), não número de balanceamento. **Saída pronta:** se o playtest
   mostrar que parece teleporte, vira campo em `data/` (`units.json`, em segundos, num grupo de
   escala) e `carregando`/`entregando` passam a durar `ticks`; a FSM não muda de forma.
2. **Estrada obrigatória só na perna carregada: fica.** O serf nasce na grama e precisa chegar ao
   armazém; o que o GDD exige é que a **entrega** dependa de estrada, e é isso que está
   implementado (`indo_entregar` só pisa em estrada; `indo_buscar` e `devolvendo` andam livres).
   **Alternativa descartada:** estrada obrigatória também nas outras pernas — o serf nascido fora da
   rede nunca chegaria a ela.
3. **Carga perdida quando a unidade some: fica, por enquanto.** Não existe item no chão, e nenhuma
   unidade morre antes da fome (F20) ou do combate. **Prazo:** Nota no item **F20** do
   `BUILD_PLAN.md` — revisitar quando uma unidade puder morrer carregando (alternativa: a carga cai
   no tile e é recolhida, o que pede item no chão).
4. **Bônus da estrada em 1,4 em vez de 1,3: fica.** É quantização do tick a 10 Hz (estrada 5
   ticks/tile, grama 6,5 → 7); corrigir exigiria mudar `tickHz`, que mexe em tudo. Favorece a estrada
   mais do que o pedido, na direção certa: o objetivo é a estrada importar. **A linha continua no
   `BALANCE_LOG.md`** (observação, não bug; sem mudança de dado).

### Não feito, de propósito (fora do Escopo da F10)

- Laço de 10 Hz, timer, interpolação entre ticks e pausa: F11. Laborer, nivelamento e martelada: F11.
- **Demolir prédio por comando:** é a F16. Aqui a obra sai do estado por injeção (`semOPredio`); a
  F16 repete o teste pelo comando (Nota no item F16).
- Tempo de manuseio ao carregar e entregar; capacidade de carga do serf (uma unidade por viagem);
  capacidade do armazém ao devolver (`capacidade: null` hoje: o depósito nunca é recusado).
- Cenário `f10` em `tools/sim.js` (o comentário do runner sugeria "armazém com 10 stone"): o
  aceite é provado por teste headless, e o `npm run sim` não imprime posição de unidade.

### Hipóteses, não fatos (não verifiquei)

- **Custo real por tick.** O F10.json conta buscas e acertos de cache, **não mede tempo**; e não
  cobre o custo das **reservas derivadas** (O(tarefas) por consulta), que não instrumentei. O
  vitest levou ~7 s para o arquivo inteiro de falhas, com o cenário de 5538 ticks dentro, o que é
  ordem de grandeza (~1 ms por tick com 100 tarefas), **não medição**. Nunca testei 1.000 tarefas.
- **A escolha gulosa da porta** pode não ser a de menor soma das duas pernas; não provei ótimo global.
- **O cache assume** que `predios.ordem` só troca de referência quando um prédio entra ou sai (vale
  por imutabilidade; não há guarda em runtime).
- **`entregando` é pouco visto sob caos** (8 ticks em 750 passos): as invariantes valem nele, mas o
  volume é pequeno; o caminho feliz é coberto por outros testes (aceite, quatro serfs, carga).
- **Os quatro serfs terminam empilhados no mesmo tile de porta** da obra (civis não colidem e é a
  única porta com estrada); na screenshot final só se vê um. Não avaliei se isso lê bem em jogo.
- O roteiro visual foi exercitado só no Chromium headless do Playwright, a 1280×720.

## Ajuste pós-F10 — HUD lê os armazéns, e as três últimas perguntas decididas (2026-09-21)

Não é uma feature da fila: é um ajuste pedido pelo operador. Toca `src/sim/selectors.ts` **e**
`src/ui/hud.ts` porque o operador **mandou explicitamente** criar o seletor em `sim/` e fazer o HUD
usá-lo (mesmo molde do "Ajuste pós-F06"). Nenhuma regra de jogo mudou de lado, nada em `render/` ou
`input/`, nenhum dado mudou.

### Decisões do operador (as três perguntas que sobravam; saíram de "Perguntas em aberto")

1. **Conectividade: 4 direções durante a Fase A.** Conferi o GDD §5.4 como pedido: a linha da
   pesquisa original, "estradas diagonais funcionam se nada bloquear a passagem" **[fonte]**, **não
   estava lá**, e `git log -S"diagona" -- docs/GDD.md` não mostra nenhum commit que a tenha tido —
   nem outro documento do repo a traz. Por isso **restaurei a linha** em §5.4 e acrescentei, ao lado,
   a divergência marcada **[proposta]**: 4 direções por decisão do operador. **A marca `[fonte]` é a
   palavra do operador, sem rastro que eu consiga verificar no repositório.** Com a linha no GDD,
   isto deixa de ser lacuna e passa a ser **divergência consciente do original**. Acrescentei ao
   `IDEIAS.md`: "estrada diagonal, fidelidade ao original — exige interpolação diagonal no arrasto,
   render inclinado e isConnected com 8 vizinhos sem cortar quina", mais uma frase minha e
   verificável: o A\* por estrada da F10 só liga o que `isConnected` liga, e o teste de equivalência
   em `tests/F10-astar.test.ts` prende os dois. **Não implementei.** (Na F08 escrevi "o GDD não
   responde": era verdade sobre o GDD que havia; a nota da F08 ganhou uma atualização.)
2. **O HUD mostra o estoque dos ARMAZÉNS, não `estoqueTotal`.** O número precisa prever o que o
   jogador pode gastar; a estrada e as obras só tiram de armazém. Novo seletor `estoqueDosArmazens`
   (`sim/selectors.ts`): as duas gavetas dos armazéns completos, e só deles. `estoqueTotal` continua
   existindo (o resumo do `npm run sim`, `comidaTotal` e vários testes o usam). **Reservado não é
   descontado** (a pedra ainda está lá; a prévia da estrada já explica a recusa); mercadoria em
   trânsito (na mão de um serf) e obra não contam. Nota do item F15 atualizada com a decisão.
3. **Uma unidade por viagem — decisão, não pergunta.** É o que o sprite do serf carregando pressupõe
   (GDD §10, "o sprite carrega visivelmente o recurso que está levando", conferido na linha 550) e o
   que o aceite da F10 já conta. Se um dia carregar mais, `Tarefa` ganha `quantidade` (saída pronta,
   sem mudar o contrato de `reclamar`/`liberar`). Nota do item F10 ajustada.

### Verificado

- Os dois seletores são **idênticos no estado inicial** (`toEqual`, e iguais a `estadoInicial.estoque`
  do dado): é a prova de que a troca não mudou nada visível hoje. `npm run shot -- F05b` passa **sem
  alteração no roteiro**.
- Onde divergem: com uma pedreira **completa** de estoque próprio (`saida: { stone: 7, ... }`),
  `estoqueTotal` sobe 7 e `estoqueDosArmazens` **não muda**. Testes em
  `tests/F05b-hud-armazens.test.ts` (7 do seletor: divergência, duas gavetas, vários armazéns, obra,
  reservado, trânsito, identidade; 2 do HUD).
- **A fiação do HUD é provada por comportamento, não por texto do fonte:** um `document` falso do
  tamanho do que `montarHud` usa (o vitest roda em `node`) mostra que, com estoque numa pedreira, a
  barra continua dando o que há nos armazéns. Antes da troca esse teste reprovava (o HUD somava tudo).

### Uma interpretação minha, para o operador confirmar

O `montarHud` lia `estoqueTotal` **uma vez** para os três materiais, e a decisão fala em "a pedra". Troquei
a fonte dos **três** (gold, timber, stone): o argumento ("prever o que se pode gastar") vale igual para
tábua e ouro, e deixar só a pedra viraria uma barra incoerente. **Comida não mudou** (`comidaTotal`,
que usa `estoqueTotal`): quem "gasta" comida é o Inn (F20), que decide se também é só a dos armazéns —
registrado na nota do F15. Se o operador quiser só a pedra, é reverter duas linhas do `hud.ts`.

## Perguntas em aberto

_(nenhuma no momento: as três que sobravam foram decididas pelo operador — ver "Ajuste pós-F10".)_
