# C-COMBATE-02b — a cerca da paz sai

**Pedido (operador, 2026-09-29, segunda partida):** "REMOVA a cerca da paz (C-COMBATE-02,
N=12). Ela impede os meus soldados de avançar no mapa, e não é o que eu quis."

## Leitura

Há duas leituras de "remover a cerca":

1. Voltar à C-IA-03b, em que a marcha em paz era recusada inteira, como no KaM
   (`BLOCKED_BY_PEACETIME` inclui walk).
2. Tirar o limite: a marcha em paz passa para qualquer destino.

A leitura 1 prende a tropa mais ainda, e o pedido é que ela avance. Fica a leitura 2. Ela
diverge do KaM (PARA REVISÃO).

## O que muda

- **Na sim:**
  - `sim/paz.ts`: `recusaNaPaz` não trata mais `MoveUnits`, e `dentroDaCercaDaPaz` sai;
  - `state.ts`: sai o motivo `longe-na-paz`. `em-paz` na marcha fica ou sai conforme o
    compilador apontar leitor;
  - `data/escaramuca.json`: saem `cercaDaPaz_tiles` e a documentação dela; `tools/data-rules.js`
    perde a regra.
- **Na ui (não no render):** `ui/aviso-de-ordem.ts` perde o ramo `longe-na-paz`, e o tema
  perde `ordem.longeNaPaz`.
- **Testes:**
  - `C-COMBATE-02-cerca-da-paz.test.ts` vira `C-COMBATE-02b-sem-cerca.test.ts`: em paz, a
    marcha longe passa e as outras quatro ordens seguem `em-paz`;
  - C-IA-03b, C-TELA-01 e C-TELA-02 se ajustam à regra nova.
- **Roteiros:**
  - C-TELA-01: a recusa pela tela passa a ser só o ataque;
  - C-TELA-02: "a recusa apaga a marca" passa a usar o ataque em paz, se ele marcar;
    senão, o destino inandável;
  - C-IA-03c: a marcha longe em paz anda.

## Aceite

- Em paz, na escaramuça, `MoveUnits` para 30 tiles fora da vila é aceito, e a tropa chega.
- As outras quatro ordens seguem `em-paz`.
- Nenhum texto "Longe demais na paz" sobra no tema, na ui ou nos roteiros.
- `npm run verify` e os roteiros C-TELA-01, C-TELA-02 e C-IA-03c passam.
