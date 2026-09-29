# C-COMBATE-02 — a cerca da paz (sim)

Decisão do operador (2026-09-29), divergindo do KaM: "Mover livre dentro de N tiles de um
prédio meu; atacar e treinar continuam proibidos." O motivo: posicionar a tropa na própria vila
é preparação, não ataque. A mensagem da tela é o item seguinte, C-TELA-01 (mensagem da ordem
recusada).

## A regra

- Em paz, `MoveUnits` passa se o DESTINO está a até N tiles, em distância Chebyshev, da caixa
  de um prédio PRONTO (`estado: 'completo'`) do mesmo lado das unidades. Se não está, a
  recusa sai com o motivo novo `longe-na-paz`.
- `AttackUnit`, `AttackBuilding`, `TrainSoldier` e `HireMercenary` seguem recusados com
  `em-paz`.
- Fora da paz, a cerca não existe.
- Só o destino é conferido. `tilesDoGrupo` espalha o grupo em anéis em volta dele, e as
  pontas podem cair um ou dois tiles fora da cerca. Aceito: o que a regra protege é a
  intenção do destino (PARA REVISÃO).

## A conta do N (escaramuça, `data/escaramuca.json`)

Medido com `caixaDoPredio` no estado da escaramuça (sessão de 2026-09-29):

| Lado | Prédio | Caixa |
|---|---|---|
| jogador | storehouse | x 29–32, y 30–33 |
| jogador | schoolhouse | x 34–37, y 30–33 |
| IA | storehouse | x 72–75, y 70–73 |
| IA | schoolhouse | x 77–80, y 70–73 |
| IA | barracks | x 72–76, y 75–79 |

- **Piso: a tropa precisa caber onde nasce.** As fileiras nascem em y 38–39, a 5–6 tiles da
  caixa da vila. Com N < 6, o jogador não consegue nem reorganizar a tropa onde ela está.
- **Folga para arrumar a defesa:** o dobro do piso, 12. Assim cabe uma linha de 9 de cada
  lado da vila, a uma fileira de distância, sem sair da cerca.
- **Teto: a cerca não pode encostar na defesa da IA.** A posição "frente" da IA fica em
  (67,67), com raio 8, e cobre x 59–75, y 59–75. A borda da cerca com N = 12, no canto
  (49,45), fica a Chebyshev max(59−49, 59−45) = 14 dessa zona. O arco da IA, em (73,66) com
  raio 8, cobre x 65–81, y 58–74; o bodoqueiro alcança 11 tiles. De (49,45) até (65,58) são
  16 tiles, fora do alcance.
- **N = 12.** Fica em `data/escaramuca.json` (`cercaDaPaz_tiles`) e a validação exige
  inteiro ≥ 0.

## Limite (PARA REVISÃO)

A cerca cresce com a vila, porque qualquer prédio pronto a estende. Um jogador que construa
um prédio perto da IA durante a paz ganha uma cerca ali. Hoje isso custa a obra inteira a
~45 tiles do armazém, com o serf levando o material até lá, e está fora do espírito da regra.
A interpretação conservadora é deixar assim e registrar. A saída pronta, se o operador quiser,
é contar só os prédios a até K tiles do armazém inicial.

## Testes (`tests/C-COMBATE-02-cerca-da-paz.test.ts`)

1. Em paz, `MoveUnits` para um tile dentro da cerca: a tropa anda.
2. Em paz, `MoveUnits` para fora da cerca: recusa com `longe-na-paz`, e ninguém anda.
3. Na borda: N passa, N+1 recusa. O teste deriva os dois tiles da caixa e do dado, sem
   literal.
4. Prédio em obra não estende a cerca.
5. Em paz, `AttackUnit` segue `em-paz`.
6. Depois da paz, o destino longe anda.
