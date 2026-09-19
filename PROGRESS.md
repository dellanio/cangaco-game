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

## Perguntas em aberto

Nenhuma no momento.
