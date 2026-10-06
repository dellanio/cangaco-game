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

## BUG-SOM-BAIXA-A-CADA-TOQUE — cada som tocado baixa o arquivo de novo
- feature: H-TELA-CAMADA-DE-SOM (o tocador do navegador), relatado pelo operador em 2026-10-05
- severidade: trava (o operador: "isso travou o game")
- repro: o console do operador mostrou `net::ERR_CACHE_OPERATION_NOT_SUPPORTED` em
  `/assets/sons/build-wood.mp3`, `building-completed.mp3` e `goods-produced.mp3`, e um 404. Sonda
  (`tools/shots`, apagada): a vila pronta a 3x por 60 s, com o cache desligado como no DevTools
  aberto. Deu 15 sons tocados e **15 downloads** de `/assets/sons/`, um por toque, porque
  `criarTocadorDoNavegador` faz `cloneNode()` de um `Audio` a cada toque, e cada clone é um player
  novo que busca o arquivo. Numa vila grande são centenas de downloads simultâneos.
- **o travamento em si não reproduziu** na sonda (o tick andou os 60 s). O que está verificado é o
  download por toque; o travamento fica como **hipótese** ligada a ele.
- o 404: nenhum arquivo do manifesto ou do CSS falta (conferido). O `index.html` não declara ícone, e o
  navegador pede `/favicon.ico` (hipótese forte: era ele).
- correção prevista: o som curto passa a ser Web Audio. Cada arquivo é buscado e decodificado uma vez,
  e cada toque é um `AudioBufferSourceNode` com o ganho. O `index.html` ganha um ícone (o da marca).
- **aceite (escrito antes do código):**
  1. por tabela, com o `fetch` e o `AudioContext` falsos injetados: N toques do mesmo id fazem 1
     busca e 1 decodificação, e cada toque cria uma fonte com o volume pedido. Id sem URL não busca.
     Com o contexto suspenso (antes do gesto), o toque é silêncio sem erro, e o contexto tenta
     `resume()`;
  2. no navegador, com o cache desligado: a vila pronta a 3x por 60 s faz no máximo 1 download por
     arquivo de som, enquanto os toques passam disso. O tick anda o tempo todo, sem erro de console;
  3. a página não pede `/favicon.ico` (nenhum 404 na sonda).
- status: aberto

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
