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
  `typecheck`, não previsto no plano.
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

## Perguntas em aberto

Nenhuma no momento.
