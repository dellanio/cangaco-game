# C-MOVIMENTO-01 — o passo confere o tile antes (sim)

Pedido do operador (2026-09-29): "Conserte como você propôs: conferir o tile antes de começar o
passo."

## O defeito, medido

`andar` (`src/sim/units/movimento.ts`) confere o tile seguinte só quando o passo COMPLETA
(`progresso >= custo`). O militar bloqueado fica com `progresso = custo - 1`, e a tela o
desenha a ~86% do caminho, dentro do tile ocupado. Quando ele desvia, `progresso` volta a 0 e o
desenho salta para trás. A sonda da sessão de 2026-09-29 contou:

| Caso | Passos | Recuos desenhados | Desvios |
|---|---|---|---|
| grupo de 18 junto | 505 | 25 | 25 |
| separar em dois | 217 | 17 | 17 |
| dois grupos de frente | 443 | 25 | 29 |

## A regra nova

- **Ocupação**, como no KaM: `UnitWalk` move a ocupação do tile de origem para o de destino no
  INÍCIO do passo. Um militar parado ocupa o próprio tile. Um militar no meio de um passo
  (`progresso > 0` e `caminho[0]` definido) ocupa `caminho[0]` e libera o tile de onde sai.
  Assim a coluna flui sem abrir um tile vazio entre cada soldado.
- **No início do passo** (`progresso` 0), o militar confere a ocupação do tile seguinte. Se
  estiver ocupado, espera no próprio tile com `progresso` 0 e conta `bloqueado`. Passado
  `ticksDesvioMilitar`, o ramo de desvio é o de hoje: parar colado ao destino ocupado, ou
  contornar pelo `desvio`. O "tenta de novo" também fica com `progresso` 0.
- **No fim do passo**, a conferência de hoje (pelo `gx/gy`) fica como rede de segurança da
  invariante do C5. Ela só dispara quando quem sai do tile anda num passo mais caro que o de
  quem entra, como na diagonal.
- Civis não mudam: a colisão civil (`passoCivil`) segue no fim do passo.

## Testes

Em `tests/C5-colisao-militar.test.ts`:

- os casos (a) a (f) seguem verdes (invariante e chegada);
- **novo (g)**: em (a), no grupo de 9 e no grupo de 18, o militar parado esperando nunca
  está desenhado dentro de outro tile. A medida é a distância de `posicaoDaUnidade` ao tile
  seguinte, que não cresce entre dois ticks com o mesmo `caminho[0]`. Para cobrir o recuo,
  conta-se também o salto de desenho maior que 0,5 tile para longe do alvo. Com o código
  antigo o total precisa ser > 0: o teste roda primeiro contra o antigo e tem de acusar.

## Números que podem mudar

O tick exato da vitória em C-IA-03b/03c e os tempos de chegada em testes de marcha. Só se
atualizam com a medida nova ao lado. A invariante não se afrouxa.
