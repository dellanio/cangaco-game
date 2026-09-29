# C-IA-02 — economia da IA, em partes; esta é a C-IA-02a (a vila da IA com produção)

Fila do operador, item 3. O modelo foi aprovado pelo operador em 2026-09-29:
- "vila pronta", sem AutoBuild;
- um prefeito mínimo que só treina gente;
- a vila da IA recebe PRODUÇÃO, não só estoque.

## A quebra

- **C-IA-02a — a vila da IA com produção** (dado + cenário; esta sessão).
  - O cenário da escaramuça ganha, do lado da IA:
    - roçado, moinho, padaria e estalagem;
    - a estrada da porta do armazém à porta de cada prédio;
    - campos de milho no alcance do roçado;
    - serfs, fazendeiro e padeiros.
  - Nenhuma regra nova: os sistemas do jogador já rodam por lado (C7).
- **C-IA-02b — o prefeito mínimo** (sim). É o `CheckUnitCount` do KaM: a IA manda à escola
  dela o treino que o jogador daria:
  - o especialista que falta em prédio sem ocupante;
  - serfs até 1 por prédio;
  - só com ouro.
- **C-IA-02c — tirar o andaime L8** (dado + teste longo). `condicao.iaDrena: true`. A IA
  alimenta a tropa pelo `comida-para-tropa`, que já existe (C-COMIDA-01e). O teste longo
  prova que a tropa da IA sente fome e come da produção. O andaime da C-IA-04 (os atacantes)
  continua: a reposição pelo quartel pede armas, e a cadeia de armas não é deste item.

## Sonda (feita antes do plano, apagada)

A escaramuça ganhou roçado, moinho e padaria da IA, 4 serfs, 1 fazendeiro e 2 padeiros:
- **Sem estrada**, o milho parou no roçado (5 na saída), e nada chegou ao moinho: os níveis
  de coleta são por estrada.
- **Com estrada** (A* da porta do armazém a cada porta), o armazém da IA foi de 20 a 62 pães
  em 9000 ticks.
- **Sem estalagem**, os civis perdem 1 de condição por tick e morrem no tick ~10500.
- **Com estalagem**, eles comem (condição de volta a ~11000), e o armazém chega a 67 pães no
  tick 12000.

## O desenho

- `data/escaramuca.json`:
  - `predios` ganha `farm` (81,70), `mill` (85,70), `bakery` (89,70) e `inn` (92,70), numa
    fileira a leste da escola, longe das posições de defesa (a oeste).
  - O bloco novo `producao` traz `_doc`, `campos {predio, recurso, quantidade}` e
    `civis {ponto, tipos {serf, farmer, baker}}`.
- `sim/cenario.ts`:
  - **Estrada:** da porta do armazém da IA à porta de cada outro prédio da IA, pelo
    `buscarCaminho` no modo `livre`. É determinístico, e tile que já é estrada não duplica.
  - **Campos:** os tiles no alcance da colheita (`production.farm.colheita.alcance_tiles`)
    em volta do roçado. Cada tile precisa ser andável, sem recurso, sem estrada e fora de
    prédio. A varredura é por linha (gy, depois gx), e fica com os primeiros `quantidade`.
    Cada campo vira `recursos[chave] = {tipo, quantidade inicial}`, o mesmo que
    `comOTileArado` grava.
  - **Civis:** nascem em `tilesDoGrupo(ponto)`, no lado da IA, na ordem dos tipos do dado.
- `tools/data-rules.js`:
  - os tipos dos civis são civis de `units.json`, com quantidade inteira ≥ 0;
  - o recurso do campo é uma cultura arável;
  - o prédio do campo está em `predios` e tem `colheita`.
- `tools/transladar-mundo.js`: translada o `civis.ponto`.

## Aceite

`tests/C-IA-02a-vila-da-ia.test.ts`:
1. **O cenário:**
   - os 4 prédios novos são da IA, completos;
   - cada prédio da IA fora do armazém tem o `predioLigadoAoArmazem`;
   - há `quantidade` campos da cultura, todos no alcance do roçado;
   - os civis da IA nascem no lado da IA, na contagem do dado;
   - o `canPlace` de cada prédio novo passa no mapa sem eles.
2. **Produção:** em 12000 ticks, o pão da IA (armazém mais estalagem) passa do inicial. A
   evidência vai em `test-output/C-IA-02a-producao.json`.
3. **Os civis vivem:** no tick 12000, todos os civis da IA estão vivos, com condição > 0.
4. **Determinismo:** duas corridas de 3000 ticks dão o mesmo estado (a de 12000 custava ~7 s a mais no verify paralelo e fazia a C-IA-03b estourar o `timeout`).

Não-regressão: `npm run verify` (a C-IA-03, a C-IA-04 e a corrida transladada dentro), e o
roteiro C-IA-03c pelo código de saída.

A tela mostra os prédios novos da IA. Um roteiro, `tools/shots/C-IA-02a.js`, leva a câmera à
vila da IA e captura. Ele afirma, pelo debug, os prédios e os civis da IA.

## O que a execução acrescentou (2026-09-29)

- **Cache do A\*:** o `buscarCaminho` guarda o raster pela identidade de `state.estradas`. A
  primeira versão do `estradasDaVila` mutava um só objeto entre as buscas, e o raster ficou
  velho: toda busca pela estrada dava `null`, e o serf da IA ficava parado. O conserto cria
  um objeto novo por trecho.
- **Tempo do tick:** os 7 civis e os 4 prédios deixaram a escaramuça 3,4× mais lenta, e os
  testes da C-IA-03b estouraram o `timeout` no verify paralelo. O perfil apontou a varredura
  linear de `hpMaximoDoTipo` e `classeDaUnidade`, que o `inimigoEncostado` chama por par de
  unidades. As duas viraram índice por `WeakMap` sobre `dados.unidades`, com a mesma
  precedência de antes. A medida de relógio é só evidência da sessão.
- **Roteiro C-IA-03c:** os 4 prédios novos consomem ids, a tropa da IA passou de u31 para
  u35, e o desvio de desenho da F18f, que vem do id, mudou. O roteiro clicava no centro do
  tile arredondado, errava o sprite, e a ordem virava marcha. Ele passou a mirar o centro
  DESENHADO (`gxDesenhado + deslocamentoPx`), como no `acerto.ts`.
- **Roteiro C-IA-02a:** foi escrito como estava planejado.
