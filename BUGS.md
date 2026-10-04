# Bugs abertos

Só o que está aberto. Bug corrigido **sai deste arquivo no mesmo commit que o
corrige** — o histórico do git é o arquivo morto. Isso mantém o arquivo curto e
barato de carregar em toda sessão.

Registre com `/bug` ou edite à mão. Se não souber a feature, escreva `?`.

**Severidades e o que cada uma provoca:**
- `trava` — interrompe a fila do BUILD_PLAN; é a próxima coisa a ser feita.
- `errado` — vira a chave da feature para `false` em `test-results.json`.
- `feio` — vai para `## BUG-VERIFY-RAPIDO-LINHA-LONGA — o `verify:rapido` falha com muitos arquivos alterados
- feature: camadas de teste (CLAUDE.md §13, `verify:rapido`)
- severidade: errado
- repro: na `main` com 55+ commits à frente do `origin/main` (217 arquivos alterados desde a
  base), `npm run verify:rapido` depois do merge da Fase H (`55393a5`, 2026-10-04)
- esperado: o `vitest related` roda nos arquivos alterados e o selo rápido é gravado
- observado: "Linha de comando muito longa." e "FALHOU: vitest related"; o selo não é criado.
  `scripts/verify-rapido.js:76` passa a lista inteira de arquivos na linha de comando, por
  `spawnSync(..., { shell: true })`, e o `cmd.exe` tem limite de ~8 191 caracteres. Typecheck, lint
  e validate:data passaram; o `npm run verify` completo do mesmo commit saiu 0 (2 475 testes).
  Sem push há tempo, a lista só cresce, então o rápido fica inutilizável até o próximo push.
- correção prevista: passar a lista sem shell (`spawnSync` com array de argumentos, que no Windows
  aguenta ~32 767), ou, acima de um teto, cair para a suíte inteira e dizer isso no selo.
- evidência: o log da corrida, nesta sessão (não guardado)
- status: aberto

## Polimento` e não bloqueia nada.

---

## Modelo

```markdown
## BUG-000 — resumo em uma linha
- feature: F##-nome
- severidade: trava | errado | feio
- repro: repro/AAAA-MM-DD-x.json (semente, tick)
- esperado: o que a regra diz que deveria acontecer
- observado: o que aconteceu
- evidência: screenshots/bug-000.png
- status: aberto
```

---

## Abertos

## BUG-ROTEIRO-DE-DUAS-ETAPAS — dois roteiros nao rodam sozinhos no `shot:todos`
- feature: D-TELA-COSTURA-DOS-TILES, D-TELA-VEU-DOS-DETALHES
- severidade: errado
- repro: `npm run shot:todos` com o `test-output/` sem a medida da etapa "antes"
- esperado: todo roteiro de `tools/shots/` sai 0 sozinho (aceite do `shot:todos`, CLAUDE.md §13)
- observado: a etapa padrao e "depois" (`CANGACO_COSTURA_ETAPA ?? 'depois'`,
  `tools/shots/D-TELA-COSTURA-DOS-TILES.js:10`), e ela exige a medida da etapa "antes", feita sobre
  o codigo de ANTES da mudanca: "baseline anterior a mudanca precisa existir" e "medida anterior
  existe". Numa worktree nova o arquivo nao existe e o roteiro nao tem como gera-lo.
- correcao: decisao do operador (separar a comparacao antes/depois do roteiro de nao-regressao, ou
  versionar a medida "antes").
- evidência: test-output/shot-todos.json (corrida de 2026-10-03, commit 61d9e49)
- status: aberto

## BUG-ROTEIRO-F-D2-RELOGIO — o roteiro F-D2 afirma sobre relogio de parede e falhou no `shot:todos`
- feature: F-D2 (navegacao da camera)
- severidade: feio
- repro: `npm run shot:todos` no `2fc4f8b` (fechamento da Fase H, 2026-10-03), com a maquina carregada
- esperado: o roteiro passar em qualquer carga; a §8 diz que medida de relogio e evidencia, nunca asserção
- observado: "segurar 1,2s (1091px) deveria andar mais que 4 toques de 300ms (1222px): a aceleracao
  nao esta acontecendo". Rodado sozinho logo depois, no mesmo commit, saiu 0 tres vezes. Hipotese,
  nao conferida: a distancia andada depende dos quadros que o navegador entrega no tempo de parede,
  e com a maquina carregada sao menos. Nao foi visto no `shot:todos` da Fase F.
- evidência: `test-output/shot-todos.json` do fechamento da Fase H
- status: aberto

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.

## BUG-CIVIS-EMPILHADOS — vários serfs desenhados no mesmo tile
- feature: D-MOVIMENTO-01 (colisão civil)
- severidade: feio
- repro: partida normal; serfs passando pela estrada na porta da pedreira (relato do operador,
  2026-10-03, com captura)
- esperado: o operador: "existem vários serfs ou unidades ocupando o mesmo tile, e não pode"
- observado: três serfs desenhados quase no mesmo lugar, na estrada em frente à pedreira.
  **Não viola regra escrita:** o GDD §6.4 diz "civis não colidem entre si", e a colisão civil
  (D-MOVIMENTO-01) foi fechada desligada como DEFINITIVA pelo operador em 2026-09-28
  (`units.json colisaoCivil.ligada: false`). Por isso a severidade é `feio`, e não `errado`.
  Mudar isso é decisão do operador: religar a colisão (a medida da época está no GDD §6.4) ou
  só espalhar na tela os civis do mesmo tile (render, sem mexer na sim).
- evidência: screenshots/bug-civis-empilhados.png (a captura do operador; `screenshots/` não vai
  para o git)
- status: aberto
