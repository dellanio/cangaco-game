'use strict';
// E-ENTREGA-BUILD — a regra pura de "o dist/ esta limpo". Separada do disco para o teste a cobrir
// por tabela (tests/E-ENTREGA-BUILD.test.ts); quem le o disco e tools/conferir-dist.js.
//
// Duas coisas nao podem estar no dist/:
//  1. arquivo de assets/base/ (a base e registro de geracao, CLAUDE.md §9). Conferido pelo
//     CONTEUDO (sha256), nao pelo nome: o Vite renomeia todo asset com hash, e um nome de base que
//     coincide com um de sprite nao prova nada;
//  2. as paginas de depuracao: os modulos de MODULOS_DE_DEPURACAO nao podem ser a fonte de nenhuma
//     saida no manifesto do build (`dist/.vite/manifest.json`, chave = modulo de origem).

/** Os modulos que so existem no dev server (`?depuracao=`, `?vitrine=`), atras de `import.meta.env.DEV`. */
const MODULOS_DE_DEPURACAO = ['src/render/depuracao-de-unidade.ts', 'src/render/vitrine-serf.ts'];

/**
 * @param {{ dist: {caminho: string, sha256: string, bytes: number}[],
 *           base: {caminho: string, sha256: string}[],
 *           manifesto: Record<string, unknown> | null }} entrada
 * @returns {{ problemas: string[], arquivos: number, bytes: number }}
 */
function conferirDist({ dist, base, manifesto }) {
  const problemas = [];
  if (dist.length === 0) problemas.push('o dist/ esta vazio ou nao existe: rode `npm run build`');
  if (manifesto === null) problemas.push('falta dist/.vite/manifest.json: o build precisa de --manifest');
  const daBase = new Map(base.map((b) => [b.sha256, b.caminho]));
  // A origem de cada saida, pelo manifesto (`file` -> `src`). Emenda de 2026-10-11: a saida igual a uma
  // base so passa quando o manifesto diz que ela veio de assets/sprites/ (a base e copia do sprite).
  const fonteDaSaida = new Map();
  for (const e of Object.values(manifesto ?? {})) {
    const entrada = /** @type {{file?: unknown, src?: unknown}} */ (e);
    if (typeof entrada?.file === 'string' && typeof entrada.src === 'string') fonteDaSaida.set(`dist/${entrada.file}`, entrada.src);
  }
  for (const d of dist) {
    const fonte = fonteDaSaida.get(d.caminho);
    if (fonte !== undefined && fonte.startsWith('assets/base/')) {
      problemas.push(`${d.caminho} vem de ${fonte}, em assets/base/`);
      continue;
    }
    const origem = daBase.get(d.sha256);
    if (origem !== undefined && !(fonte ?? '').startsWith('assets/sprites/')) {
      problemas.push(`${d.caminho} e o arquivo ${origem} de assets/base/`);
    }
  }
  for (const modulo of MODULOS_DE_DEPURACAO) {
    if (manifesto !== null && Object.prototype.hasOwnProperty.call(manifesto, modulo)) {
      problemas.push(`a pagina de depuracao ${modulo} entrou no build`);
    }
  }
  return { problemas, arquivos: dist.length, bytes: dist.reduce((t, d) => t + d.bytes, 0) };
}

module.exports = { conferirDist, MODULOS_DE_DEPURACAO };
