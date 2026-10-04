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
