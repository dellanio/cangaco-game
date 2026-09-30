# D-PRODUCAO-01 (antes F29) — Ferro e ferrarias: plano

Plano do lote do operador (2026-09-29). O item da fila não tinha aceite escrito, só a nota
da regra do `step`. O aceite abaixo vem do GDD §4.2 ("Iron | Iron mine + Coal → Iron
smithy | Weapon smithy, Armor smithy") e §4.5 ("1 Iron smithy : 1 Weapon smithy (ou 2 a 3
Armor smithies)"), e da sonda feita antes de qualquer código (memória "sonda o travamento
antes de construir em cima").

## O que já existe (verificado no código e nos dados)

- Receitas em `data/production.json`: `iron_mine` e `coal_mine` colhem o veio do mapa
  (`colheita`, alcance 6, F21b); `iron_smithy` {iron_ore 1, coal 1 → iron 1};
  `weapon_smithy` e `armor_smithy` com `escolheSaida` (rodízio de peso 1 da F24a).
- Prédios, unidades (`miner`, `metallurgist`, `blacksmith`) e desbloqueio em
  `buildings.json` / `units.json`. Veio de `iron_ore` e `coal` no mapa emitido, na serra.
- A F24a testou as ferrarias com ferro e carvão **injetados** no armazém. Nenhum cenário
  tinha rodado uma `iron_mine` até hoje.

## A sonda (`tests/zz-probe-ferro.test.ts`, apagada antes do commit)

Fixture nova `cenarioDaCadeiaDoFerro` na encosta norte da serra, posição por varredura
de caixa com o `canPlace` do jogador e rua por busca em largura com o `canPlaceRoad`
(nada de coordenada digitada). 12 000 ticks pelo `step`:

| Elo | Primeiro tick | Em 12 000 |
|---|---|---|
| minério de ferro (fe1) | 300 | 39 |
| carvão (co1) | 250 | 47 |
| ferro (fu1) | 981 | 37 |
| ferro chega na ferraria de armas / de armaduras | 1081 / 1403 | 9 / 2 |
| espada / lança / besta (ws1) | 2312 / 3849 / 5349 | 3 / 2 / 2 |
| carvão chega na fundição / armas / **armaduras** | 682 / 1938 / **nunca** | 39 / 7 / **0** |

Dois achados:

1. **A cadeia do ferro fecha sem código novo** até a arma. Como a F21 (ouro), o que se
   entrega é o guarda.
2. **A ferraria de armaduras nunca recebe carvão.** O carvão é escasso (uma mina, três
   consumidores) e a tarefa de insumo é escolhida por `(nível, custo A*, número)`
   (`ordenarTarefasDoSerf`, `sim/jobs.ts`): com as três gavetas vazias, empatam no nível
   `parada`, e vence sempre a de menor caminho. Não é balanceamento, é espera
   indefinida (memória "espera indefinida não é balanceamento"). O KaM trata isso de
   propósito (`KM_HandLogistics.pas`, 731a8a4, `TryCalculateBidBasic` :1512-1530): para
   fundição e casas com encomenda, com oferta ≤ 2 e destino com ≤ 1 na gaveta, o lance
   **ignora a distância** e usa a distribuição e um aleatório, "so weapon and armour
   smiths should get same amount of iron, even if one is closer". E `TryCalculateBid`
   :1613-1618 soma 20 por unidade já na gaveta ("prefer delivering to houses with fewer
   supply").

   Detalhe da sonda: a primeira versão pôs a mina de carvão na primeira posição com
   **algum** veio (um tile, 15), que secou no minuto 7. A fixture escolhe a posição de
   **mais** veio da caixa.

## Divisão (CLAUDE.md §6: a feature é maior que uma sessão)

- **D-PRODUCAO-01a — a cadeia do ferro no mapa real (guarda).** Só testes e fixture.
  Não toca `src/`.
- **D-PRODUCAO-01b — insumo escasso dividido entre fundição e ferrarias.** Muda a sim
  (ordem das tarefas de insumo). Plano próprio, a seguir no lote.

## Aceite da 01a

1. No mapa emitido, sem minério semeado, a mina de ferro e a de carvão colhem do veio ao
   alcance: o `disponivelAoAlcance` de cada uma cai contra o tick 0.
2. Minério e carvão viram ferro **na fundição**: o primeiro ferro do mundo sai de `fu1`
   (evento `goods-produced`), e os dois insumos chegaram a ela por tarefa.
3. O ferro da fundição chega às **duas** ferrarias (entrada de `ws1` e de `as1`).
4. A ferraria de armas faz arma (sword, pike ou crossbow) com o ferro da fundição, no
   rodízio de peso 1 da F24a (decisão do operador: vale até a 03a).
5. Contra-exemplo: sem a mina de carvão, nenhum ferro; sem a de ferro, nenhum ferro.
6. Tudo pelo `step`, com `violacoesDeInvariantes` e `violacoesDaFsmDoEspecialista` vazios.

Teto de segurança: 5 000 ticks (a sonda mediu a primeira arma em 2312). O tick vai para a
evidência, nunca para `expect` (§8).

**O que a 01a não cobre, e está escrito na 01b:** a ferraria de armaduras produzir. Um
teste que afirmasse "as1 nunca recebe carvão" codificaria o defeito; um que a pusesse
sozinha seria andaime. A 01a afirma só que o ferro chega nela.

## Tarefas

1. `cenarioDaCadeiaDoFerro`, `cenarioDoFerroSemCarvao`, `cenarioDoFerroSemMina` em
   `tests/helpers/producao-cenario.ts`.
2. `tests/D-PRODUCAO-01a-cadeia-do-ferro.test.ts`: os 6 pontos, evidência em
   `test-output/D-PRODUCAO-01a-cadeia-do-ferro.json`.
3. Apagar a sonda. `npm run verify`. BUILD_PLAN (aceite, 01a ENTREGUE, 01b com o achado
   e a regra do KaM), siglas, PROGRESS, test-results, commit, push.

Sem screenshot: a 01a não muda nada na tela.

## PARA REVISÃO

- A divisão em 01a/01b e o aceite escrito por mim a partir do GDD, porque o item não
  tinha aceite.
- A caixa da fixture (encosta norte) é decisão minha; a posição dentro dela, não.
