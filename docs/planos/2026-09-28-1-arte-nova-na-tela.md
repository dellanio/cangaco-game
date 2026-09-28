# Fila noturna 1 — a arte nova na tela (roteiros de screenshot)

Pedido do operador (2026-09-28): rodar todos os roteiros de `tools/shots/`, dizer quais
quebraram com a arte nova, consertar os quebrados **sem afrouxar o que eles provam**. Se
um roteiro afirma a REGRA e não o número, parar nele e registrar.

## Passos

1. `npm run shot -- <nome>` para cada `tools/shots/*.js` que não começa com `_`, em
   série (um dev server por vez). Código de saída e a linha `FALHOU` vão para o
   scratchpad. Screenshot de regressão não se abre com Read.
2. Cada reprovação é classificada em uma de três:
   - **artefato da sessão** (a página recarregou porque um `.ts` foi editado com o
     laço rodando): roda de novo, sem tocar no roteiro;
   - **premissa de número/posição** que a arte mudou: conserta o roteiro mantendo a
     asserção igual ou mais estrita, e a premissa passa a ser afirmada pelo dado
     (manifesto, `buildings.json`), não pela memória;
   - **premissa de regra** (ex.: "prédio sem arte vira retângulo" quando não sobra
     prédio sem arte): para, registra no PROGRESS para o operador, não mexe.
3. BUG-M: o lote do placeholder vai por baixo da obra revelada (render), e a F11c lê a
   estrutura de madeira pela revelação da F17g (`revelacaoDasObras`), não pelo estágio
   do fallback — a F17g afirma que a obra revelada **não** conta nos seis estágios, e é
   o contrato vigente.
4. Rodar de novo só os que reprovaram. `npm run verify` verde antes do commit.

## Fora

- Regenerar sprite; mexer em asserção da F17g; mudar o modelo de revelação.
