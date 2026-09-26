# Plano — pedra inicial de 34 para 30 (leva noturna, item 3)

Decisão do operador (2026-09-26): "Aceito — a tensão que eu defendi dependia do pagamento
à vista, e o pagamento à vista era o defeito." O limiar medido depois da F18g é 27.

1. `data/economy.json`: `estadoInicial.estoque.stone` 34 → 30.
2. Sonda `zz-` (a das pontas pós-F18g, reconstruída): janela de 12 000 ticks, critério da F17
   (`criterio-fechado`) mais os quatro ligados, varrendo de 30 para baixo nas pontas
   A (rua inteira no tick 0), B (15 tiles, o resto quando `pedraDisponivel` cobre) e
   D (o resto só com os 15 de pé).
3. Se alguma ponta não fechar com 30, subir para 32, registrar e parar.
4. Conferir o guarda de `tools/geometria-da-abertura.mjs` (rua 26 + reserva 4 = 30; `30 > 30` é falso).
5. `npm run verify`: teste que dependa do 34 é investigado, não afrouxado.
6. BALANCE_LOG com o giro e os números; sonda apagada no mesmo commit.
