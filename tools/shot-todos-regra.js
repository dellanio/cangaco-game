'use strict';
// npm run shot:todos — a parte pura (CLAUDE.md §13, aceite de 2026-10-01): a lista dos roteiros e a
// decisao de parar por memoria. Quem a usa e tools/shot-todos.js; quem a testa,
// tests/SHOT-todos.test.ts.

/** Memoria livre minima, em MB, para comecar o proximo roteiro (regra das levas: sem memoria, para). */
const MEMORIA_MINIMA_MB = 1500;

/** Os roteiros: todo `.js` de tools/shots sem prefixo `_` (os helpers), na ordem do nome. */
function listarRoteiros(arquivos) {
  return arquivos.filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.slice(0, -3)).sort();
}

/** Para antes deste roteiro? So se a memoria foi medida e esta abaixo do minimo. */
function deveParar(memoriaLivreMb, minimoMb = MEMORIA_MINIMA_MB) {
  return typeof memoriaLivreMb === 'number' && Number.isFinite(memoriaLivreMb) && memoriaLivreMb < minimoMb;
}

module.exports = { MEMORIA_MINIMA_MB, listarRoteiros, deveParar };
