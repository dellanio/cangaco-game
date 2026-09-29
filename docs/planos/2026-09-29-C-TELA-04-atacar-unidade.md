# C-TELA-04 — atacar unidade pelo mouse (ui + input)

Pedido do operador (2026-09-29): o botão direito sobre um militar inimigo, com a tropa
selecionada, emite `AttackUnit`. **Aceite:** um roteiro.

## Como estava

- O `aoOrdenar` do `main.ts` recebia só o **tile**. Prédio de outro lado virava
  `AttackBuilding`, e todo o resto virava `MoveUnits`. Nada emitia `AttackUnit`, que existe
  desde a F28a (corpo a corpo) e só era usado pela IA e pelos testes.
- **Achado na execução:** o acerto de unidade (`render/acerto.ts`, `unidadesNoPonto`) usa
  um quadrado de ½ tile em volta do PÉ. O sprite do cabra tem 64×96, ancorado no pé
  (0.5, 1). O corpo, que é onde a mão mira, fica fora do quadrado. No primeiro roteiro, o
  botão direito no meio do tile do inimigo virou `MoveUnits`, e a marca foi para (67,67).

## O desenho

- `src/ui/ordem-militar.ts` (novo, puro), `ordemDoBotaoDireito(estado, dados, lado, grupo,
  tile, idsNoPonto)`, que devolve `{comandos, marcarDestino}`:
  1. se há **unidade inimiga com HP** sob o ponteiro, os de corpo a corpo do grupo recebem
     `AttackUnit`. O arqueiro seria recusado pela sim, e a recusa derruba o comando INTEIRO,
     então ele recebe `MoveUnits` para o tile do alvo, como antes. Só nesse caso há marca;
  2. se há **prédio de outro lado** no tile, `AttackBuilding` (F26b);
  3. no resto, `MoveUnits` e a marca (C-TELA-02).
- O **botão direito passa a levar o ponto de mundo**:
  - `WorldScene` o passa para `aoClicarDireito(tile, ponto)`;
  - daí vai para `aoOrdenar(tile, ponto)` e para `jogo.unidadesNoPonto(ponto)`.
- **O acerto mira o corpo:**
  - `UnidadeRenderizada` ganha `corpoPx`: o retângulo da imagem desenhada relativo ao pé, ou
    `null` no placeholder;
  - `unidadesNoPonto` aceita o quadrado OU o corpo. Quem o quadrado acerta vem antes, porque
    é a mira precisa e é o que separa duas unidades no mesmo tile (F18f). Entre as que só o
    corpo acerta, vence a desenhada na frente.
  - Isso vale também para o clique esquerdo de seleção. É a mesma função, e agora o clique
    no corpo do cabra seleciona.

Isto não toca `sim/`.

## Testes

`tests/C-TELA-04-atacar-unidade.test.ts`:

- um inimigo sob o ponteiro dá `AttackUnit` com os 18. O `step` real, sem a paz, aceita a
  ordem, e os 18 ficam `indo_lutar` com o alvo certo;
- a unidade vence o prédio do tile, e o próprio soldado sob o ponteiro não é alvo, o que dá
  `MoveUnits`;
- num grupo com arqueiro, o corpo a corpo ataca e o arqueiro marcha. O `AttackUnit` com
  todos seria recusado;
- o ponteiro no peito acerta com o corpo e erra sem ele. O quadrado de quem está atrás
  vence o corpo de quem está na frente, e entre corpos vence o da frente;
- sem tropa na mão, nenhum comando.

O roteiro `tools/shots/C-TELA-04.js`:

1. a paz acaba;
2. a caixa pega os 18;
3. despausado, o botão direito no meio do corpo de um cabra da IA: os 18 ficam `indo_lutar`
   ou `lutando`, sem marca;
4. rodando mais, a tropa trava a luta (`lutando`).

## PARA REVISÃO

- O arqueiro do grupo marcha até o alvo em vez de atirar nele. Hoje a sim não tem ordem de
  tiro contra unidade; a F28d (arqueiro) decide.
- O corpo agora pega o clique. Um prédio atrás de um soldado inimigo fica mais difícil de
  mirar: o soldado vence. É o padrão de RTS.
