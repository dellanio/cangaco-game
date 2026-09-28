# Plano — C5: colisão militar (fila do operador, item 5; GDD §6.4)

GDD §6.4: *"Civis não colidem entre si, para não travar a logística. Militares
colidem."* Decisão do operador: *"o GDD §6.4 manda, e é o que faz formação significar
alguma coisa."*

## O que o KaM faz (`units/actions/KM_UnitActionWalkTo.pas:119-131`)
Quando o próximo tile está ocupado, o KaM aplica, em ordem de tempo de espera:
- troca de lugar com quem vem de frente (0 ticks);
- empurrão de quem está parado (1 tick);
- desvio de quem está ocupado (10 ticks, depois a cada 50);
- passo para um tile vazio ao lado (10 ticks, depois a cada 15);
- troca forçada (40 ticks).

## A nossa versão (conservadora)
- **Quem colide:** militar com militar, de qualquer lado. Civil não colide com ninguém, e
  militar não colide com civil.
- **A regra**, em `andar` (`units/movimento.ts`), no instante em que o militar completaria
  o passo:
  - se o próximo tile tem outro militar, **o salto não acontece**; o progresso fica
    segurado e `fsmData.bloqueado` conta os ticks de espera;
  - com `bloqueado ≥ ticksDesvio`, vem o **passo para o lado**: o primeiro vizinho (8)
    andável, sem militar e não mais longe do destino final do que o tile atual, em ordem
    de distância ao destino (desempate pela ordem fixa dos vizinhos), de onde o A* normal
    ache caminho até o destino. O caminho vira `[vizinho, ...resto]`, e a espera zera;
  - se o próprio **destino final** tem militar e a espera passou do limite, a unidade **para
    ali** (caminho vazio): a FSM que a guiava a trata como chegada;
  - sem vizinho que sirva, a espera zera e a unidade tenta de novo depois de outro
    período.
- **A ordem de processamento** é a de `unidades.ordem`, então quem anda primeiro no tick
  ocupa primeiro. É determinístico.

## Dado
- `units.json: colisaoMilitar.desviarDepois_segundos_base = 1,0` (grupo `movimento`). São
  os 10 ticks de 100 ms do `AVOID_TIMEOUT` / `SIDESTEP_TIMEOUT` do KaM. Na escala de
  movimento 2,0 dá 5 ticks.

## Fora (PARA REVISÃO)
- A troca de lugar com quem vem de frente e o empurrão do parado. Sem eles, dois militares
  de frente num corredor de 1 tile esperam para sempre. Em campo aberto, o passo para o
  lado resolve.
- A busca de ocupação varre `unidades.ordem` (O(n) por passo bloqueado). Fica medido pela
  contagem, se pesar.

## Aceite
- (a) Dois militares de frente, em campo aberto: em nenhum tick dividem um tile, e os dois
  chegam ao destino.
- (b) Um militar parado no caminho de outro: o que anda nunca entra no tile dele, contorna
  e chega.
- (c) O destino ocupado por um militar parado: o que anda para colado, ocioso, no máximo
  `ticksDesvio + custo de um passo` depois de chegar ao lado.
- (d) Civil não colide: um serf e um militar podem dividir tile, e dois serfs também.
- (e) Um grupo de 9 marchando (F26a) chega sem nenhum par de militares no mesmo tile em
  tick nenhum.
- (f) Determinismo; os testes das F26 e F28 continuam verdes.
