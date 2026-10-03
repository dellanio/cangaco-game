'use strict';
// E-ENTREGA-PUBLICACAO — a regra pura de "este dist/ pode ir para o itch.io". O CLI
// (tools/publicar.js) junta os fatos do disco e do git e pergunta aqui; o teste a cobre por tabela.
//
// Passa so com os quatro (BUILD_PLAN, Fase E):
//  1. a tag `teste-jogo-<n>` no HEAD (ela e a versao que o itch.io mostra);
//  2. a arvore limpa;
//  3. o selo `completo` do `npm run verify` (`.verify-ok`) com o commit do HEAD;
//  4. o `dist/` do mesmo commit, feito com a arvore limpa (`dist/build.json`, do tools/conferir-dist.js).

const TAG = /^teste-jogo-(\d+)$/;
/** O canal do itch.io para o jogo no navegador. */
const CANAL = 'html5';

/** A versao `teste-jogo-<n>` das tags do HEAD, ou null. Com mais de uma, a de maior `n`. */
function versaoDasTags(tags) {
  let melhor = null;
  for (const tag of tags) {
    const m = TAG.exec(String(tag).trim());
    if (m !== null && (melhor === null || Number(m[1]) > melhor.n)) melhor = { n: Number(m[1]), tag: m[0] };
  }
  return melhor === null ? null : melhor.tag;
}

/**
 * @param {{ head: string, tags: string[], arvoreLimpa: boolean, selo: unknown, build: unknown }} f
 * @returns {{ ok: boolean, problemas: string[], versao: string | null }}
 */
function podePublicar({ head, tags, arvoreLimpa, selo, build }) {
  const problemas = [];
  const versao = versaoDasTags(tags);
  const curto = String(head).slice(0, 7);
  if (versao === null) problemas.push(`o HEAD (${curto}) nao tem a tag teste-jogo-<n>: crie com \`git tag teste-jogo-<n>\``);
  if (!arvoreLimpa) problemas.push('a arvore tem mudanca nao commitada: o que sobe tem de ser um commit');
  const s = typeof selo === 'object' && selo !== null ? selo : {};
  if (s.tipo !== 'completo' || s.commit !== head) {
    problemas.push(`falta o selo completo do HEAD (${curto}) no .verify-ok: rode \`npm run verify\``);
  }
  const b = typeof build === 'object' && build !== null ? build : {};
  if (b.commit !== head || b.arvoreLimpa !== true) {
    problemas.push(`o dist/ nao e do HEAD (${curto}) com a arvore limpa: rode \`npm run build\``);
  }
  return { ok: problemas.length === 0, problemas, versao };
}

/** Os argumentos do `butler push`: o diretorio, `<alvo>:html5` e a versao. */
function argumentosDoButler(dist, alvo, versao) {
  return ['push', dist, `${alvo}:${CANAL}`, '--userversion', versao];
}

module.exports = { podePublicar, argumentosDoButler, versaoDasTags, CANAL };
