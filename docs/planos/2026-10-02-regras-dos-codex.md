# Regras comuns para os Codex em worktree (2026-10-02)

Toda tarefa do Codex numa worktree do Orca segue estas regras. Elas saem das revisões da sessão
Claude de 2026-10-02 (o PROGRESS do dia tem os casos).

## Antes de começar
- Leia o `CLAUDE.md` inteiro e o item da sua tarefa no `BUILD_PLAN.md`. **O aceite do item é o
  contrato:** não o altere. Se algum ponto se mostrar impossível, pare e reporte.
- A worktree nasce da `main` atual. Confira com `git log --oneline -1` que o commit do aceite
  está nela.

## Testes e a trava
- Só uma sessão roda teste por vez na máquina, e outros Codex estão rodando. Use os scripts do npm,
  que passam pela trava. Teste avulso: `node tools/trava-de-testes.js npx vitest run <arquivos>`.
  **Nunca** rode `npx vitest` direto. Se a trava estiver ocupada, espere.
- **O `vitest related` só segue import.** Teste que lê `assets/manifest.json`, `data/*.json` ou
  `saves/*.txt` por `readFileSync` não entra no `verify:rapido`. Sempre rode direto, pela trava,
  os testes que leem o dado que você mudou, mais `tests/F-SPR-carregamento.test.ts` e
  `tests/F17f-manifesto.test.ts`. (Foi assim que a `main` ficou vermelha no `254fe78`.)
- Se um roteiro pedir um save que não existe, gere-o pelo teste que o grava.

## O que nunca fazer
- Tocar em `src/sim/` (a não ser que o item diga o contrário, e nenhum desta leva diz).
- Usar `Math.random()`, `Date.now()` ou `performance.now()` em conta de animação: o movimento sai
  do tick, do alfa e do tile, com hash de semente.
- Medir custo pelo intervalo entre `requestAnimationFrame`: isso mede a cadência do navegador, e
  não o trabalho. Custo se mede dentro do quadro (`src/render/custo-do-quadro.ts`). Tempo nunca
  entra em `expect` (CLAUDE.md §8).
- Desativar, usar `skip` ou `eslint-disable`, ou ampliar `ignores` para passar.
- Mexer em `.claude/`, usar `--force` ou reescrever histórico.
- Marcar qualquer coisa em `test-results.json`.

## Como escrever o render animado
- Função pura em `src/render/<nome>.ts`, testável em Node, sem Phaser, e teste por tabela.
- Números de tela em `data/<nome>.json`, que é dado **de interface**: entra em
  `ARQUIVOS_DA_INTERFACE` (`tools/data-schema.js`), com uma regra `interface/<nome>` em
  `tools/data-rules.js` e um caso que reprova escrito no teste.
- Pool de objetos reaproveitados, sem criar ou destruir por quadro, e sem o emissor de partículas
  do Phaser.
- **Só trabalha quando algo muda** (o tick, o alfa ou a câmera), e só o que está na vista. A ponte
  publica um contador por quadro, e o roteiro afirma 0 com o jogo pausado e a câmera parada.
- Roteiro com a câmera pela ponte (`fixarCamera`), os ticks pela ponte (`avancar`) e um passo
  despausado com `press('p')` / `waitForTimeout(150)` / `press('p')`, ou, no painel, `mouse.down` /
  `waitForTimeout(150)` / `mouse.up` (CLAUDE.md §8). Abra as capturas.
- No `WorldScene.ts`, mexa só no seu trecho. Outros Codex mexem no mesmo arquivo.

## Antes do merge
- `npm run verify:rapido` verde, mais os testes diretos acima.
- Os roteiros que o aceite lista, com saída 0.
- `git diff main -- src/sim` vazio.
- Commits: `feat(<ID>): ...` e `docs(<ID>): ...`. O de docs abre uma seção NOVA no FIM do
  `PROGRESS.md`, com o título `## 2026-10-02 — <ID> (<nome>), pelo Codex`, e separa o que foi
  verificado do que é hipótese.

## Merge na `main`
1. `git -C D:/projetos-pessoal/cangaco-game status` precisa estar limpo. Se não estiver, outra
   sessão está trabalhando: NÃO mergeie. Pare e avise.
2. Faça rebase sobre a `main` atual. Em conflito (`WorldScene.ts`, `debug.ts`,
   `tools/data-rules.js`, `tools/data-schema.js`, `PROGRESS.md`), preserve as duas mudanças.
   Depois, rode de novo o `verify:rapido`, os testes diretos e o seu roteiro.
3. Na `main`: `git merge --ff-only <sua-branch>`. NÃO faça push.
4. Se o git recusar a escrita (`index.lock` / sandbox), não insista e não mexa no `.git`. Deixe
   tudo commitado na branch e avise.

## Entrega
Responda com: os commits, os arquivos, a saída de cada verificação (com os testes diretos), os
números que o aceite pede, se o merge foi feito e o que ficou fora do aceite.
