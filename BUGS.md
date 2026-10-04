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

## BUG-CIVIL-RECUA-NO-DESENHO — serf e obreiro andam para frente e para trás e "travam"
- feature: I-MOVIMENTO-COLISAO-CIVIL-LIGADA (`e9b1bd1`), no desenho do passo (`posicaoDaUnidade`)
- severidade: errado
- repro: o operador jogando a `main` (`54da7c6`), 2026-10-04: "ficam travando e indo pra frente e pra
  trás".
- esperado: o desenho de quem anda só vai para a frente; quem espera para na borda do tile sem voltar
- observado (medido, sonda de 3 000 ticks na vila pronta): o desenho de serf e obreiro recua 412 vezes
  com a colisão ligada, contra 140 com ela desligada (os 140 são as voltas de quem troca de caminho).
  Causa (verificada em `src/sim/selectors.ts:851-866`): (1) desde a permuta com dívida, o `progresso`
  fica negativo (220 ticks na sonda), e a fração `progresso/custo` desenha a unidade **atrás** do
  próprio tile; (2) o civil segurado salta de ~0,8 do passo para a borda (0,5) quando o tile da frente
  está ocupado (121 recuos).
- correção prevista: a fração nunca é negativa (a dívida é tempo, desenhado parado no tile); e o civil
  cujo tile seguinte tem um civil parado, ou que vem de frente, já anda limitado à borda (0,5), sem
  saltar para trás depois. Uma coluna andando no mesmo sentido não é limitada.
- **aceite (antes do código):** (1) por tabela, `posicaoDaUnidade`: progresso negativo desenha no tile;
  com civil parado no tile seguinte, a fração fica em no máximo 0,5; com civil vindo de frente, também;
  com o da frente andando para longe, a fração é a de hoje; (2) pela sonda transformada em teste: na
  vila pronta, em 3 000 ticks, os recuos do desenho com a colisão ligada ficam em no máximo 1,2 vez os
  da colisão desligada, e a razão vai para o `test-output`; (3) só o desenho muda: `step` e o dado não
  são tocados.
- **emenda do aceite (2), pela medida (antes do código):** a contagem do (2) misturava a volta legítima
  de quem chega ao centro de um tile e sai em ângulo maior que 90°. A medida certa é o recuo **dentro do
  mesmo passo** (mesmo tile, mesmo tile seguinte, a fração caindo). Sem a colisão ela dá **0**; com a
  colisão, antes da correção, dá **122**, mais **220** ticks desenhados atrás do próprio tile. O aceite
  (2) passa a ser: com a colisão, na vila pronta, em 3 000 ticks, (a) zero ticks atrás do tile; (b)
  todo recuo dentro do passo termina exatamente na borda (0,5), ou seja, é o civil que o tile da frente
  segurou naquele tick, e nenhum vai além dela; (c) a contagem vai para o `test-output`. O salto até a
  borda quando o tile fica ocupado no último instante é decisão do operador (pergunta no PROGRESS) e
  fica neste bug, aberto.
- **decisão do operador (2026-10-04, depois da correção parcial `02b95aa`):** "o serf precisa esperar
  ou ficar parado se houver fila nas ruas". O segurado no último instante **para onde está**, sem
  voltar à borda (a saída B da pergunta). Só desenho: a sim já espera.
- **aceite da decisão (antes do código):** (1) uma regra pura de render (`src/render/`, sem Phaser) com
  memória por unidade: dentro do mesmo passo (mesmo tile, mesmo tile seguinte) a fração desenhada nunca
  cai; trocou o passo, a memória recomeça. Por tabela: avançar passa; cair fica onde estava; passo
  novo aceita a fração dele; unidade esquecida recomeça; (2) a regra aplicada à vila pronta com a
  colisão, em 3 000 ticks: **zero** recuos dentro do passo (eram 112), e a contagem vai para o
  `test-output`; (3) `unidades.ts` passa a posição pela regra antes da interpolação; o roteiro
  `I-MOVIMENTO-COLISAO-CIVIL-LIGADA` continua saindo 0 e a captura dele é aberta.
- evidência: a sonda desta sessão (`test-output/zz-sonda-recuo.json`, apagado)
- status: aberto

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
