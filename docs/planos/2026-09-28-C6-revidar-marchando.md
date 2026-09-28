# Plano — C6: revidar enquanto marcha (fila do operador, item 6)

Pedido: *"Revidar marchando: entra. No KaM quem é atacado revida, e tropa que apanha sem
reagir é defeito."* Hoje o contato de combate (F28a) só vale para quem está `ocioso`: a
tropa em marcha passa encostada no inimigo e apanha sem reagir.

## O que o KaM faz
`TKMUnitWarrior.CheckForEnemy`/`FindEnemy` (`units/KM_UnitWarrior.pas:664-702`):
- o guerreiro **corpo a corpo** procura inimigo **mesmo andando**, porque o `WalkTo` é
  interrompível na passagem de tile;
- achando inimigo ao alcance da luta (encostado), luta;
- o **atirador** não procura enquanto anda (`:666-667`);
- terminada a luta, o grupo retoma a ordem de andar.

## A nossa versão
- **Contato em marcha:** o militar corpo a corpo em `marchando` com um inimigo encostado
  passa a `lutando` contra ele, como o ocioso já fazia. Ele guarda o destino da marcha em
  **`Unidade.retomarMarcha?`**, um campo opcional fora do `fsmData`, porque a luta
  reescreve o `fsmData` várias vezes.
- **Retomar:** o militar `ocioso` com `retomarMarcha` e **sem** inimigo encostado volta a
  `marchando` para lá (a marcha recalcula a rota) e o campo some. Com inimigo encostado,
  luta de novo.
- **Ordem nova apaga o campo:** `MoveUnits`, `AttackUnit` e `AttackBuilding`. O jogador
  mandou outra coisa, e a marcha velha não volta.
- **O atirador continua sem revidar andando**, como no KaM.
- O save não muda de versão: o campo é opcional.

## Aceite
- (a) O militar marchando que passa encostado num inimigo luta com ele. A marcha de hoje
  (sem C6) passaria reto.
- (b) Vencida a luta, ele retoma a marcha e chega ao destino original.
- (c) Uma ordem nova durante a luta apaga o destino velho: depois da luta ele não volta
  para lá.
- (d) O arqueiro marchando não para para atirar.
- (e) Determinismo; os testes das F26, F28 e C5 continuam verdes.
