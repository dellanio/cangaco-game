# Plano — C2: o projétil voa (fila do operador, item 2)

Pedido: *"O projétil voa. Tempo de voo, e erra quem andou — é o que diferencia arqueiro de
corpo a corpo. Junto: a pedra da torre mata só o primeiro do tile hoje; decida com o KaM se
atinge todos."*

## A pedra atinge um ou todos? → **um** (decidido pelo KaM, sem mudança)
`KM_Projectiles.pas:333-337`: na chegada, `U := gTerrain.UnitsHitTestF(fTarget)` pega
**uma** unidade no ponto e `U.HitPointsDecrease(U.HitPointsMax)` a mata. Continua um só.

## O que o KaM faz (fonte, `KM_Projectiles.pas`)
- **Velocidade** (`:70`), em tiles por tick de 100 ms: flecha 0,75, virote 0,75, funda 0,6,
  pedra da torre 0,8. Mais um sorteio de ±0,05 (`:133`), que **não** adoto: seria número
  e RNG a mais para uma diferença de 7 %.
- **Tempo de voo:** `Round(comprimento / velocidade)` (`:276`).
- **Mira:** prevê onde o alvo estará, pelo vetor de movimento dele, e soma uma dispersão
  (`:113-165`).
- **Acerto na chegada** (`:305-306`): pega a unidade que está no ponto; se não há ninguém,
  erra. A chance cai com a distância entre a unidade e o ponto, e depois vem o sorteio de
  dano/defesa de sempre.

## A nossa versão (conservadora)
- **Mira no tile ATUAL do alvo, sem previsão e sem dispersão.**
  - Quem fica parado leva o tiro com a chance de sempre.
  - Quem andou para outro tile até a chegada não é atingido; atinge-se quem estiver no
    tile, amigo inclusive (o fogo amigo da F28d continua).
  - É exatamente "erra quem andou". A previsão do KaM faria o arqueiro acertar quem anda
    em linha reta, e fica PARA REVISÃO.
- **Tempo de voo** = `max(1, round(distância × ticksPorTile))`, com a distância euclidiana
  entre os centros dos tiles.
- **A pedra da torre também voa**, mas mantém a decisão da F28b (*"a pedra NUNCA erra"*):
  ela persegue o **alvo marcado** e o mata onde ele estiver na chegada. Se ele já morreu,
  cai no tile de onde ele saiu e mata quem estiver lá (um só, como no KaM). PARA REVISÃO,
  porque no KaM ela erraria quem andou.
- **A recarga da torre soma o voo**, como no `TKMTaskThrowRock` (o recruta "olha a pedra
  ir"): o intervalo entre pedras passa a ser `ticksRecarga + voo`.
- **Flecha em prédio (cerco) continua instantânea.** O prédio não anda, e o voo só
  atrasaria o dano. PARA REVISÃO.

## Dado (`combat.json`, grupo `combate`)
- `aDistancia.velocidade_tilesPorSegundo_base`: flecha 7,5, virote 7,5, funda 6,0,
  pedraDaTorre 8,0 (KaM × 10).
- **Conversão, feita uma vez no loader:** `milesimosDeTickPorTile = round(1000 × tickHz / (v ×
  escala))`, inteiro.
  - Na escala de combate 1,5: flecha 889, funda 1111, pedra 833.
  - Arredondar direto para ticks por tile daria 1 para todos, e apagaria a diferença
    entre eles.
  - O voo de uma distância é `max(1, round(d × milesimos / 1000))`: aritmética IEEE
    determinística, a mesma da distância euclidiana que a sim já usa.

## Estado
- **`GameState.projeteis?: Projetil[]`**, opcional; ausente = nenhum no ar, e o save não
  muda de versão. Cada projétil guarda:
  - `id`;
  - `projetil` (o tipo);
  - `de`, uma cópia de quem atirou (`id`, `tipo`, `lado`, `direcao`, `gx`, `gy`). É o que
    entra na chance, e vale mesmo se o atirador morrer antes da chegada;
  - `origem` e `alvoTile`;
  - `alvoUnidade`, só na pedra;
  - `predio`, só na pedra;
  - `lancadoNoTick` e `chegaNoTick`.
- **Evento novo `projectile-fired`** no lançamento. O `unit-struck`, o `unit-killed` e o
  `stone-thrown` continuam iguais; a diferença é que o `unit-struck` sai **na chegada**.

## Divisão
- **C2a (sim):** o dado, o estado, o `sistemaDosProjeteis` (depois do combate e da torre),
  o atirador e a torre lançando em vez de acertar, e a recarga da torre com o voo.
- **C2b (render):** desenhar cada projétil no ar a partir de `state.projeteis`, interpolando
  entre `lancadoNoTick` e `chegaNoTick`, com screenshot despausada.

## Aceite da C2a
- (a) O dado em milésimos de tick por tile, lido do dado.
- (b) Voo: o alvo parado a d tiles é atingido `max(1, round(d × m / 1000))` ticks depois do
  lançamento, e não no tick do tiro.
- (c) Erra quem andou: o alvo que sai do tile antes da chegada não é atingido, e o
  `unit-struck` não o cita. Com um amigo que entra no tile, é o amigo que leva o tiro.
- (d) O atirador que morre com a flecha no ar não cancela a flecha.
- (e) A torre: a pedra mata o alvo marcado mesmo que ele ande (a F28b segue verde), e o
  intervalo entre pedras é `recarga + voo`.
- (f) Save e load com projétil no ar: a viagem é byte a byte; o save sem o campo carrega.
- (g) Determinismo.
