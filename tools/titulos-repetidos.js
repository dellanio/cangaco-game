'use strict';
// Os titulos `## ` que aparecem mais de uma vez num markdown. Bloco de codigo (```) nao conta:
// o modelo do BUGS.md mostra um `## BUG-000` dentro de um bloco, e ele e exemplo, nao titulo.
// Pedido do operador (2026-09-30): o BUGS.md saiu duplicado duas vezes por um corte que achou a
// mencao de "## Polimento" no texto; esta regra reprova isso no `verify`.
function titulosRepetidos(texto) {
  const vistos = new Map();
  let emCodigo = false;
  for (const linha of texto.split(/\r?\n/)) {
    if (linha.startsWith('```')) { emCodigo = !emCodigo; continue; }
    if (emCodigo || !linha.startsWith('## ')) continue;
    const titulo = linha.trim();
    vistos.set(titulo, (vistos.get(titulo) ?? 0) + 1);
  }
  return [...vistos].filter(([, n]) => n > 1).map(([titulo, n]) => `${titulo} (${n}x)`);
}
module.exports = { titulosRepetidos };
