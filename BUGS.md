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

## BUG-TROPA-DE-24-PRESA — com a tropa de 24, a varredura do BUG-T deixa soldados marchando
- feature: C-MOVIMENTO / BUG-T (a tropa travada), exposto pela I-COMBATE-ESCARAMUCA-GANHAVEL
- severidade: errado
- repro: a varredura de `tests/BUG-T-troca-mutua.longo.test.ts` (as 400 ordens, a receita do plano
  `docs/planos/2026-09-30-BUG-T-tropa-travada.md` §7) com a tropa da escaramuca de 24
  (`criarEscaramuca(semente)` com o dado de hoje, em vez da fixture de 18): ordem k = 13, destino
  (24, 43), direcao 0, colunas 3.
- esperado: o aceite 4 do BUG-T: nenhuma ordem deixa soldado marchando.
- observado: depois de 1 500 ticks, `u19`, `u20`, `u22`, `u23`, `u24`, `u27`, `u34`, `u37` (e mais)
  seguem em `marchando`. Igual com a colisao civil ligada e desligada (medido): e a tropa maior, e
  nao a colisao. A varredura voltou a rodar com a fixture de 18 (a receita do plano), e por isso
  continua verde; este bug e o que ela acharia com 24. **Causa nao investigada.**
- evidência: a saida do `npm run test:longo` de 2026-10-04 (branch `dellanio/colisao-e-escaramuca`)
- status: aberto

## BUG-VERIFY-RAPIDO-LINHA-LONGA — o `verify:rapido` falha com muitos arquivos alterados
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

## BUG-ROTEIRO-D-TELA-03-MACHADO-COM-ICONE — o roteiro da D-TELA-03 supoe que o machado nao tem icone
- feature: D-TELA-03 (logistica na tela)
- severidade: errado
- repro: `npm run shot:todos` no `5b5f933` (fechamento da leva de 2026-10-04), depois do merge da `main`
- esperado: o roteiro escolhe uma mercadoria SEM PNG nem icone para afirmar o quadrado de reserva
- observado: "o machado nao tem PNG nem icone: deveria ser quadrado, veio {...\"fonte\":\"icone\"}".
  **Verificado:** o `8529594` (D-ARTE-PIXEL-ART-CIVIS, "as 28 mercadorias em pixel art"), que chegou
  pela `main`, deu icone ao `hand_axe`. O aceite (o quadrado para quem nao tem arte) continua valendo;
  o exemplo do roteiro e que ficou sem caso. Hipotese, nao conferida: com as 28 mercadorias com icone,
  nao sobra mercadoria sem arte, e o roteiro precisa provocar o caso (um id sem arte) em vez de
  procura-lo.
- evidência: test-output/shot-todos.json (corrida do `5b5f933`)
- status: aberto

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.
