# C-MOVIMENTO-02b — a vaga tomada por quem marcha (sim)

Achado pelo roteiro da C-COMBATE-01c (controles de formação). A tropa de 18 da escaramuça,
refeita em fileiras de 7 e mandada ao leste (`MoveUnits {destino (32,35), direcao 2,
colunas 7}`): **3 de 18 ficam `marchando` para sempre.** É determinístico e se reproduz sem
tela. É uma lacuna da C-MOVIMENTO-02 (a troca de vaga só acontece com um PARADO).

Isolado como item próprio porque a 01c toca `src/render/` e este conserto toca `src/sim/`
(§10). Commit separado, antes da 01c.

## A causa (medida na sonda)

- u22 em (30,33): a vaga dele é (31,34), o tile vizinho (`caminho` de 1).
- u27 está PARADO NA VAGA de u22, com `progresso` 0, mas em `marchando`. A vaga dele é
  (32,38). O caminho passa por (32,34), onde u24 está parado, e o contorno passaria por
  (30,33), onde u22 está.
- `vagaEmparedadaPor` não dispara, por dois motivos: o caminho de u22 tem 1 tile, e quem
  ocupa não está parado.
- `esperarOuDesviar` tenta de novo para sempre: o destino não tem parado, o contorno é
  `null` e o destino não está cercado de parados.
- u21 espera atrás, pelo mesmo nó.

## O conserto

A mesma troca de vaga da C-MOVIMENTO-02, agora com quem marcha e está preso. Em
`systems/marcha.ts`, `vagaTomadaPor(state, u, dados)` devolve a unidade com quem trocar.
Vale quando todas estas condições valem:
- `u` marcha, está com `progresso` 0 e chegou ao fim da espera (`ticksDesvioMilitar`);
- o tile seguinte de `u` é a VAGA dele (`alvoTile`);
- nesse tile há um militar do mesmo lado, em `marchando`, com `progresso` 0 (não saiu), e a
  vaga desse militar é outra.

A troca: quem ocupa FICA (a vaga de `u` passa a ser a dele, com a `direcaoFinal` de `u`), e
`u` herda a vaga e a `direcaoFinal` de quem ocupa, e replaneja. O conjunto de vagas não muda,
nenhum número novo entra, e nada de RNG.

Interpretação conservadora: a troca só acontece com a vaga como PRÓXIMO tile. Um
bloqueio no meio do caminho continua com a espera e o desvio de hoje.

## Aceite

`tests/C-MOVIMENTO-02b-vaga-tomada.test.ts`:
1. O cenário da sonda (escaramuça, formação 7 no lugar, depois marcha ao leste com 7
   colunas): os 18 param em até 1200 ticks.
   - Virados ao leste, as fileiras são linhas de gx: 3 linhas, a maior com 7.
   - Nenhum tile tem dois.
   - Evidência em `test-output/C-MOVIMENTO-02b-leste.json`.
2. O guarda de que o caso aconteceu (repro de ritmo se provoca): na mesma corrida,
   `vagaTomadaPor` (exportada) dá não-nulo para alguém da tropa em pelo menos um tick.
3. Determinismo: duas corridas dão o mesmo estado.

Não-regressão: `npm run verify`, com os testes da C-MOVIMENTO-01/02 e da F26 dentro.
