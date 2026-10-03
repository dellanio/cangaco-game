# Bugs abertos

Só o que está aberto. Bug corrigido **sai deste arquivo no mesmo commit que o
corrige** — o histórico do git é o arquivo morto. Isso mantém o arquivo curto e
barato de carregar em toda sessão.

Registre com `/bug` ou edite à mão. Se não souber a feature, escreva `?`.

**Severidades e o que cada uma provoca:**
- `trava` — interrompe a fila do BUILD_PLAN; é a próxima coisa a ser feita.
- `errado` — vira a chave da feature para `false` em `test-results.json`.
- `feio` — vai para `## Polimento` e não bloqueia nada.

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

## BUG-SAVE-DO-ROTEIRO-TRANSLADADO — o roteiro da 05c e da 05d le um save do mundo transladado
- feature: D-TELA-05c (ataque, trabalho e morte), D-TELA-05d (carga de unidades por tipo)
- severidade: errado
- repro: `npm run verify` e depois `npm run shot -- D-TELA-05c` (ou `shot:todos`, como no
  fechamento da Fase D, 2026-10-03)
- esperado: o roteiro carrega o save `test-output/D-TELA-05c-morte.save.txt` (e o
  `D-TELA-05d-inicio.save.txt`) e segue
- observado: o Retomar recusa com "o mapa 'sertao-128' mudou desde o save (hash a2e426f9, agora
  7a1f4844)", e os roteiros falham ("save da fome carregado"; timeout de 30 s na 05d).
  `tests/D-TELA-05c.test.ts:51` e `tests/D-TELA-05d.test.ts:81,85` gravam em `test-output/` fixo,
  e nao no `CANGACO_EVIDENCIA_DIR` (como o `BUG-U`/`BUG-W`/`BUG-X` fazem); a corrida
  `test:transladado` do `verify` sobrescreve os saves com o mapa transladado. **Verificado:** rodar
  so os dois testes na suite normal e depois os dois roteiros da OK (6 e 2 capturas).
- correcao prevista: gravar os saves em `${process.env.CANGACO_EVIDENCIA_DIR ?? 'test-output'}`.
- evidência: test-output/shot-todos.json (corrida de 2026-10-03, commit 61d9e49)
- status: aberto

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

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.
