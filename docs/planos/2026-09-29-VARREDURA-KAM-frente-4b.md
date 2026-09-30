# VARREDURA-KAM, frente 4b — o que o KaM tem e nós não, fora do combate: plano

Fila do operador, item 11 ("as frentes que faltam"). As frentes 1, 2 e 3 têm seção em
`docs/varredura-kam.md`; a frente 4 foi feita só para o combate ("a frente 4, só combate,
cobre o que falta"). Falta a frente 4 na economia, na logística e nos comandos de prédio.

## Método (leitura, sem subagente: a lista de comandos do KaM é o índice)

1. A lista de prédios do KaM (`TKMHouseType`, `KM_ResTypes.pas:49-57`) contra
   `data/buildings.json`.
2. A lista de comandos do jogador no KaM (`TKMGameInputCommandType`,
   `KM_GameInputProcess.pas:40-100`) contra `src/sim/commands.ts`: cada comando de casa
   ou de exército sem par aqui é uma candidata a lacuna.
3. Cada candidata conferida nos dois lados, abrindo a linha; o que não abri fica HIPÓTESE.
4. Recursos que o KaM repõe ou não repõe (o peixe) contra `data/resources.json`.

## Aceite (o da VARREDURA-KAM no BUILD_PLAN)

- Seção "Frente 4b" em `docs/varredura-kam.md`, cada achado com classe (correção,
  divergência deliberada, lacuna, confirmado) e as duas referências.
- Nada muda em dado, código ou critério de aceite: cada lacuna vira proposta ao operador.
- Nenhum arquivo fora de `docs/` e do PROGRESS muda no commit (por isso o item 11 da fila no
  BUILD_PLAN não é marcado nesta sessão: o estado fica no PROGRESS).
