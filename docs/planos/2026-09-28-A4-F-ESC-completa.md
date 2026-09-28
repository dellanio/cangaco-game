# Plano — F-ESC completa (sessão autônoma, item 4)

Decisão do operador (2026-09-28): *"k = 1,0 padrão, exceção por prédio declarada no
dado. O sobrado usa 1,33. Implemente."* Os dois números já estão no manifesto desde a
fila noturna 4 (`regraDeAltura.k`, `alturaMaxPorLargura` no armazém e na Casa do
Coronel). Falta o aceite (c) e o texto final do aceite.

1. Render: `debug.caixasDesenhadas[id]` = `{tipo, textura, w, h, lote}` do sprite do
   prédio completo, lido da `Image` do container (`displayWidth`/`displayHeight`).
2. Roteiro `tools/shots/F-ESC.js`: roda a F17, confere `h ≤ teto × lote` para cada prédio
   com o teto lido do manifesto pelo roteiro, exige os seis da régua, e captura os seis
   num quadro a 0,5. Tabela em `test-output/F-ESC-caixas.json`.
3. Sonda: manifesto sem a exceção do armazém + render sem teto → reprova. Restaurar.
4. BUILD_PLAN (aceite escrito), PROGRESS, verify, chave `F-ESC-altura-pela-largura`, commit.
