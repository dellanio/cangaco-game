# Plano — C1: cadência própria para projétil e torre (fila do operador, item 1)

Pedido: *"Cadência própria para projétil e torre. É o número mais errado da leva — a
torre gasta 5 pedras em 1,5 s. Meça no kam_remake e traga a proporção; o dado ganha
cadência por tipo de ataque."*

## Medido no fonte do kam_remake (clone parcial de `src/`, 2026-09-28)
Tick do KaM = 100 ms (hipótese já registrada no PROGRESS; só o comentário de
`CORN_AGE_1` sustenta).

| Ataque | KaM | Fonte |
|---|---|---|
| Golpe corpo a corpo em prédio | 6 + 6 = 12 ticks | `units/tasks/KM_UnitTaskAttackHouse.pas:163,190` |
| Golpe corpo a corpo em unidade | quadros da animação (≥ 7: o golpe cai no quadro 5, e há pausas nos 0, 3 e 6) + 0–1 tick de pausa em cada um desses três quadros | `units/actions/KM_UnitActionFight.pas:50,289,309-321` |
| Mira do arco | 6 + sorteio(6) = 6–11 ticks | `units/KM_UnitWarrior.pas:790-800` |
| Mira da besta | 8 + sorteio(8) = 8–15 ticks | idem |
| Mira da funda | 0 + sorteio(4) = 0–3 ticks | idem |
| Disparo | o arco e a besta atiram no quadro 0 da animação; a funda, no quadro 15 | `KM_UnitWarrior.pas:771-785` |
| Ciclo do atirador | mira + quadros da animação de luta | `KM_UnitActionFight.pas:242-266`, `KM_UnitTaskAttackHouse.pas:120-128,182-184` |
| Pedra da torre | 2 (pegar) + 1 (arremessar) + voo + 20 (parado) | `units/tasks/KM_UnitTaskThrowRock.pas:86-98` |

**Não está no fonte:** o número de quadros das animações de luta. Ele fica no `unit.dat`,
que é dado do jogo original e não está no repositório. Medir no KaM original está
**PENDENTE** (o jogo não está disponível na nuvem).

## A proporção
- Torre: 23 ticks + voo, contra 3 hoje. Sem o voo, que é o item 2, já são **7,7× mais
  lenta** do que está.
- Atirador: mira de 0,6–1,1 s (arco), 0,8–1,5 s (besta) ou 0–0,3 s (funda), mais a
  animação. Hoje a mira é zero, e o arco atira no mesmo ritmo do golpe.

## Dado (`combat.json`, grupo `combate`, na escala 1,0)
- `aDistancia.cadencia.<projetil>` = `{ recarga_segundos_base, miraAleatoria_segundos_base }`.
  A recarga **soma a mira mínima e a animação**:
  - `flecha`: 0,6 + 0,5 = 1,1, com sorteio de 0,6;
  - `virote`: 0,8 + 0,5 = 1,3, com sorteio de 0,8;
  - `funda`: 0 + 1,6 = 1,6, com sorteio de 0,4.
- *Mudança na execução:* a primeira versão tinha a mira mínima num campo próprio, e a da
  funda é zero. O F03 garante que toda duração convertida é ≥ 1 tick. Em vez de abrir
  exceção nessa invariante, a mira mínima entrou na recarga, e a origem de cada parcela
  está no `_doc`.
  - A `recarga` é a animação:
    - **arco e besta: 0,5 s, a mesma do golpe (stand-in, PARA REVISÃO)** até medir o
      `unit.dat`;
    - **funda: 1,6 s**, o piso que o fonte garante, porque a pedra sai no 16º quadro.
- `watchtower.recarga_segundos_base` = 2,3 (2 + 1 + 20 ticks). O voo entra no item 2.
- Regra no `validate:data`: todo `projetil` usado em `units.json` tem cadência.

## Sim
- O loader converte tudo em ticks uma vez: `aDistancia.ticksCadencia[projetil] = {mira,
  miraAleatoria, recarga}` e `watchtower.ticksRecarga`.
- O atirador recarrega `recarga + sorteio`, com o sorteio de 0 a `miraAleatoria − 1` no
  RNG do estado, como o `KaMRandom(ADD)`. Vale ao começar a
  atirar, depois de cada tiro e para o atirador contra prédio (F-CERCO-a2).
- A torre recarrega `ticksRecarga`.
- O corpo a corpo não muda.

## Aceite
- (a) O dado convertido dá, na escala de combate 1,5, torre = 15 ticks, flecha = 7 + 0..3,
  virote = 9 + 0..4 e funda = 11 + 0..2. O teste lê o dado, não o literal.
- (c2) Acrescentado na execução: o atirador contra prédio (F-CERCO-a2) também usa a
  cadência do projetil.
- (b) Uma torre com 5 pedras e 5 inimigos no alcance gasta as 5 em ≥ 4 × 15 ticks, não
  em 1,5 s.
- (c) Os intervalos entre tiros de um arqueiro ficam todos na faixa [recarga+mira,
  recarga+mira+miraAleatoria−1], e aparecem pelo menos dois valores diferentes: o
  sorteio age.
- (d) A mesma corrida duas vezes dá o mesmo estado.
- (e) O corpo a corpo não muda: os testes da F28a ficam verdes sem mudar.

## Registro
- BALANCE_LOG: o golpe corpo a corpo de 0,5 s está abaixo do piso do KaM, que é ≥ 0,7 s
  de quadros mais ~0,15 s de pausa média. Fica para o lote de balanceamento; não mexo
  aqui.
