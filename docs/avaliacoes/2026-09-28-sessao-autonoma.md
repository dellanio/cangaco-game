# Avaliação das 20 entregas da sessão autônoma (2026-09-28)

Feita pelo subagente `evaluator` (só leitura), a pedido do operador: *"São dezoito features
sem ninguém conferir além de você."*

**Veredito: NEEDS_WORK.** Duas reprovadas (F25a, F26b), 18 aprovadas com ressalva, nenhuma
trava. Nenhum teste vermelho.

## O que o avaliador conferiu
- **Confirmado rodando** (HEAD e89b0a6):
  - os 18 arquivos de teste, com 103 testes verdes;
  - `tsc`, `eslint` e `validate-data` verdes;
  - `grep` sem `phaser`, `Math.random`, `Date.now`, `window` nem `document` em `src/sim`;
  - duas sondas no scratchpad.
- **Screenshots abertas:** F25b-2, F28b-1, F28b-2, F26b-3, F26b-5, F34-2, F35-1, F36-1,
  F-REPL-e-2, F-VIVO-d-4, F-TR-5 e F-ESC-8.
- **Aviso dele:** a C1 estava em curso na árvore durante a avaliação. Ele leu o código por
  `git show HEAD:`.

## Achados `errado` (entram no BUGS.md)
1. **F25a:** o JobBoard ignora o lado. O recruta do lado 0 se alista no quartel do lado 1,
   e o armazém do jogador manda armas para lá.
   - Confirmado por sonda: o quartel inimigo ficou com recrutas 1 e hand_axe 2, e o
     `TrainSoldier` formou soldado de lado 1.
   - Causa: `reclamarMelhorAlistamento` (`src/sim/jobs.ts:355`) e
     `gerarTarefasDoQuartel`/`origemMaisPerto` (`systems/jobs.ts:746`).
   - Alcança também a F28-IA (ponto 4), a F28b, a F35, a F36 e a F-CERCO-b (reparo sem
     lado).
2. **F26b, com origem na F-CERCO-a2:** prédio completo danificado é desenhado como obra e
   perde a arte (`WorldScene.ts:1265`, `estagioDaObra(hp, hpTotal)` também para o
   completo). Evidência: `F26b-5-grupo-atacando.png`, com a escola inimiga como
   "telhado por fechar".
3. **F-TR-b, na evidência:** a asserção de "tile que saiu e ainda tem sprite reprova" passa
   por construção. `lajedoDesenhado` pula chave que não está em `recursos`, e a rocha
   esgotada sai de `recursos`. Além disso, F-TR-2 e F-TR-3 têm o mesmo md5.

## Ressalvas por feature (resumo)
- **F-REPL-e:** o teste só afirma a muda ≥ 0,4; o 0,6 e o 0,8 não.
- **F-VIVO-d2 e F-TR-b:** as citações do operador que corrigem o aceite só aparecem nos
  commits do autor. [hipótese do avaliador: não conferiu a fonte]
- **F-ESC:** a largura sem regra (vira o C10).
- **F-CERCO-a2:**
  - fixture `arqueiro` sem uso no teste (`void arqueiro`);
  - as invariantes não são conferidas no tick da queda.
- **F-CERCO-b:** o reparo não olha o lado.
- **F28c:** o teste "regenera em luta" usa `fsm: 'atacando'` sem alvo, e o cerco o zera
  para ocioso no 1º tick. A cura em luta **não** é testada de fato.
- **F28a:**
  - o "1 HP por golpe" é literal no código (`systems/combate.ts:129,207`);
  - o civil não pode ser alvo.
- **F28d:**
  - a flecha em prédio ignora o arco de tiro (`cerco.ts:50`);
  - o teste de fogo amigo só afirma que o amigo foi alvo.
- **F28b:**
  - a recarga (resolvida na C1);
  - o abastecimento e o ocupante sem lado;
  - o sprite menor que o lote 2×2.
- **F28-IA:** os aceites dos pontos 2, 3 e 6 foram escritos pelo autor; a IA seria
  abastecida pela economia do jogador (o achado 1).
- **F34:**
  - nenhum caminho real de combate chega ao fim, só fixtures;
  - a F34-2 diz "perdeu… o quartel" para quem nunca teve quartel;
  - a sim continua depois do fim (vira o C9).
- **F35:**
  - **nenhuma UI emite `SetTrade`: o jogador não dá ordem à feira;**
  - o cabeçalho do teste ainda tem o aceite (d) antigo;
  - o aceite (b) usa o mesmo contador da implementação.
- **F36:** a F36-1 mostra a Prefeitura sobre o roçado. O avaliador confirmou por sonda que o
  `canPlace` aceita prédio sobre tile de `corn` com quantidade 0 (defeito antigo do
  `canPlace`).
- **F25b:**
  - o aceite (b) é tautológico, porque o painel e o comando chamam a mesma função;
  - com porta bloqueada, o botão fica habilitado;
  - na F25b-2, o botão desabilitado parece igual ao habilitado, e o último sai cortado.
- **Geral:** as screenshots da nuvem usam a fonte de reserva (`CANGACO_SHOT_NUVEM` bloqueia
  o Google Fonts). Os roteiros cumprem a §8.
