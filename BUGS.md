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

## BUG-CARGA-INFINITA-SEM-VEZ — sob carga infinita, a tábua da oficina nunca ganha a pedra da escola
- feature: D-TRANSPORTE-03 (o lance do KaM e a classe comum), achado pela I-OBRA-UM-TILE-ENTRE-PREDIOS
- severidade: errado
- repro: `tests/D-TRANSPORTE-03-logistica-kam.test.ts`, corrida B (`carga: true`): 40 pedras repostas a
  cada 200 ticks na saída da escola
- esperado: as armas chegam ao quartel, mais devagar, mas chegam
- observado (medido em 2026-10-05): 0 arma produzida em 12 000 ticks. O carpinteiro fica em
  `esperando_insumo`, porque a tábua do armazém para a oficina perde sempre para a pedra da escola na
  mesma classe (5): as duas pagam a multa do armazém, e a pedra está mais perto. Antes do vão entre
  lotes, com a oficina 1 tile mais perto, chegavam 9. A carga é infinita (mais pedra do que 4 serfs
  carregam), e por isso um insumo pode esperar para sempre.
- correção prevista: decisão do operador. Uma vez por espera (o envelhecimento da tarefa aberta) ou um
  teto de vez para a saída cheia; o KaM não tem envelhecimento.
- status: aberto; a corrida B passou a gravar a contagem em vez de afirmar entrega

## BUG-F18F-PILHA-DE-TRES-NO-CANTEIRO — o roteiro F18f conta 3 no mesmo ponto na porta da obra
- feature: I-MOVIMENTO-FILA-DE-CIVIS (`1f9c150`), com a pergunta em aberto "o obreiro no canteiro ocupa
  o tile?" (`c13b168`)
- severidade: errado (o roteiro F18f sai 1)
- repro: `npm run shot -- F18f`, na `main` desde `1f9c150`
- esperado (o roteiro): nenhuma pilha de 3 ou mais em 600 ticks
- observado (medido no roteiro, 2026-10-05): ticks 172 a 257, no tile 38,33 (a porta da obra), dois
  obreiros `nivelando` ou `esperando_material`, que são "dentro" e não ocupam o tile, mais um serf
  `indo_entregar` ou `entregando`. Os três centros desenhados são distintos (o deslocamento da F18f), e
  a sim não tem dois civis "fora" no tile. É o caso exato da pergunta em aberto do `c13b168`.
- correção prevista: depende da decisão do operador. Se o obreiro no canteiro passar a ocupar o tile,
  o serf espera na fila e a pilha some; se não, o roteiro deve contar só quem ocupa.
- status: aberto, esperando a decisão

## BUG-SHOT-TODOS-ONZE-ROTEIROS-VERMELHOS — 11 roteiros saem 1 no fechamento de 2026-10-10
- feature: o fechamento do bloco (I-ENTREGA-VERSAO-PUBLICAVEL); cada roteiro é o aceite da sua feature
- severidade: errado (o bloco não fecha, e a tag `teste-jogo-2` espera)
- repro: `npm run shot:todos` em `1d974d2` (resumo em `test-output/shot-todos.json`), e cada um de novo
  sozinho por `npm run shot -- <nome>`
- observado (medido em 2026-10-10): 12 de 172 saem 1. Um é o BUG-F18F acima. Os outros 11:
  - `C-IA-03c`: "os tres predios da IA deveriam cair, sobraram 3" (380 s);
  - `D-TELA-AGUA-PEIXE`: o sha256 da captura difere entre as duas corridas do peixe;
  - `D-TELA-LUZ-RELEVO-recorte`: "a pedreira deveria estar plantada em (26,29)";
  - `F07`: "deveria haver 2 obras, veio 1";
- verificado: os 10 rápidos (todos menos o `C-IA-03c`) falham IGUAIS em `73833b0`, a `main` de antes do
  trabalho de 2026-10-10. Não vieram do Açude, das dicas, do som nem do roteiro do machado.
- hipótese (não conferida): vieram das levas de 2026-10-06 a 2026-10-09 (o jornal só com a última, os
  enfeites, a caatinga, a serra, as fontes naturais, a seca mais lenta), porque nenhum `shot:todos` rodou
  entre elas. Ressalva: na corrida da `73833b0` as partidas salvas (`test-output/*.save.txt`) foram
  copiadas da árvore atual, e um save mais novo pode ter falhado por formato.
- correção prevista: um por um, como roteiro desatualizado ou defeito de jogo, sem afrouxar asserção.
- consertados: `I-TELA-CLIMA-VISUAL` (o roteiro afirmava o jornal antigo) e `F25b` (a moldura do
  menu da proposta, `14b2d58d`, achado por bisect, empurrou o Derrubar 6 px para fora); e os cinco que
  carregavam partida salva (`G-TELA-GESTO-DO-TRABALHO`, `I-ARTE-PREDIOS-MAIORES`,
  `I-TELA-OBRAS-COM-ARTE-ATUAL`, `I-TELA-QUARTEL-MAIS-IMPONENTE`, `I-TELA-SELECAO-NO-PE`): o teste
  gravava em `test-output/` direto, e a corrida transladada do verify sobrescrevia a partida com o
  mundo de +32. Passam pelo `CANGACO_EVIDENCIA_DIR`, e a guarda global da corrida transladada reprova
  quem tocar numa partida do mundo normal (provado: sem o conserto, sai 1 e diz o arquivo).
- status: aberto

## Polimento

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.
