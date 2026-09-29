# C-IA-02b — o prefeito mínimo (sim)

**Item da fila (BUILD_PLAN.md):** "O `CheckUnitCount` do KaM: a IA pede à escola dela o
especialista que falta em prédio sem ocupante e serfs até 1 por prédio, só com ouro."

**Fonte:** kam_remake 731a8a4, `src/ai/KM_AIMayor.pas:142-270` (`CheckUnitCount`) e
`KM_AISetup.pas:76-79` (`SerfsPerHouse 1`). Cadência: `UpdateState` a cada
`MAX_HANDS*4` = 48 ticks.

## A regra, como o KaM faz

1. **Demanda de especialista:** para cada tipo de prédio COMPLETO do lado com
   `trabalhador` em `buildings.json` (o quartel já tem `null`), `demanda[trabalhador] += 1`.
   Conta por TIPO de unidade, não por prédio: moinho + padaria pedem 2 padeiros. Conta
   assim porque o especialista novo leva tempo para chegar ao prédio, e contar prédio vazio
   pediria outro a cada revisão.
2. **Existente:** unidades vivas do lado com esse tipo + itens da fila das escolas do lado
   (aguardando ou treinando) com esse tipo.
3. **Especialista:** para cada escola completa do lado com fila `< filaAlvo` (2), enfileira
   o PRIMEIRO tipo (ordem de `units.json: civis.tipos`) com `demanda > existente`, e passa à
   próxima escola (um por escola por revisão).
4. **Serfs:** enquanto a fila da escola `< filaAlvo` e há ouro para auxiliar
   (`ouro dos armazéns do lado > ouroMinimoParaSerf`, o `> 20` do KaM), enfileira serf se
   `serfs + serfs na fila < round(serfsPorPredio × prédios completos do lado)`.
5. **Peões (builder) e recrutas ficam de fora:** não há AutoBuild (decisão do operador) e
   a cadeia de armas não é deste item.

## Decisões conservadoras (PARA REVISÃO)

- **"Só com ouro" vale para os dois.** O KaM não olha ouro para o especialista; aqui o
  especialista só entra na fila se o lado tem ouro para pagar um treino
  (`ouro dos armazéns + ouro na entrada da escola ≥ custo × (itens aguardando + 1)`).
  Sem isso o item fica na fila esperando ouro que não vem (espera indefinida).
- **O limiar do serf é o do KaM, 20.** A escaramuça dá 20 de ouro à IA: com o limiar do
  KaM, a IA hoje **não** treina serf na partida (20 > 20 é falso). O teste injeta ouro.
  Saída pronta: baixar `economy.prefeito.ouroMinimoParaSerf` ou subir o ouro da IA.
- **A contagem inicial de civis não muda** (`escaramuca.producao.civis`): é balanceamento.
- **Revisão no tick múltiplo do período**, sem o deslocamento por dono do KaM.
- **Roda também em paz** (o KaM treina em paz).

## Dados (`data/economy.json`, bloco novo `prefeito`)

```json
"prefeito": {
  "_doc": "...",
  "serfsPorPredio": 1,
  "filaAlvo": 2,
  "ouroMinimoParaSerf": 20,
  "revisao_segundos_base": 4.8,
  "escala": "economia"
}
```

O loader converte `revisao_segundos_base` em `ticksDaRevisao` (48). A entrada vai em
`CAMPOS_ESCALONADOS` (`tools/data-schema.js`). Em `data-rules.js`: inteiros ≥ 1 para
`filaAlvo` (≤ `schoolhouse.slotsDeFila`), ≥ 0 para os outros dois.

## Código

- `src/sim/prefeito.ts`: `pedidosDoPrefeito(state, lado, dados)`, uma função pura que
  devolve a lista de `{ predio, unidade }` a enfileirar.
- `src/sim/systems/ia.ts`: o passo `prefeito` no `sistemaDaIA`, depois de
  alimentar e antes do `if (paz) continue`. Só no tick da revisão. Cada pedido vira
  `aplicarEnqueueTraining`, o mesmo do comando.

## Testes (`tests/C-IA-02b-prefeito.test.ts`)

1. A escaramuça sem mudança: nenhum pedido (os civis do dado cobrem a demanda de
   especialista, e o ouro está em 20).
2. Mata o fazendeiro da IA: na revisão seguinte a escola da IA tem `farmer` na fila, e
   rodando até o treino acabar nasce um `farmer` do lado da IA.
3. Um só pedido por tipo: mata os dois padeiros e roda 3 revisões. Aparecem no máximo 2
   padeiros entre vivos e fila, nunca mais.
4. Serfs: sobe o ouro da IA para 40. Na revisão a fila recebe serfs até `filaAlvo`, e com
   o tempo `serfs + fila` chega a `round(1 × prédios)` e para ali.
5. Sem ouro para serf: com o ouro em 20, mesmo com déficit, nenhum serf vai para a fila.
6. Sem ouro para o especialista: o ouro zerado e o fazendeiro morto não enfileiram nada.
7. Fora do tick da revisão não há pedido.
8. Determinismo: duas corridas de 3000 ticks com o fazendeiro morto dão o mesmo JSON.

Não-regressão: C-IA-02a, C-IA-03 e C-IA-04 no `npm run verify`, e o roteiro
`C-IA-02a` pelo código de saída. Não há mudança de tela, então não há screenshot novo.

## O que a execução acrescentou

- A revisão dá **24 ticks**, e não 48: os 4,8 s passam pela escala `economia` (2,0), como o
  resto da economia.
- O `sistemaDaIA` passou a receber o tick que o `step` produz, porque o `state.tick` ainda é
  o anterior quando os sistemas rodam.
- O teste 7 (fora do tick da revisão) virou uma asserção dentro do teste 2: o tick em que o
  farmer entra na fila é múltiplo da revisão.
- A corrida dos serfs caiu para 2000 ticks, porque o 7º serf nasce no tick ~1139. Esse
  teste e o de determinismo ganharam `timeout` de 20 s, só para o caso de travar.
