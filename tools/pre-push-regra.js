'use strict';
// O portao do push (CLAUDE.md §13, decisao do operador de 2026-10-01). Regra pura: o hook
// `.githooks/pre-push` le o selo e as linhas que o git passa no stdin e pergunta aqui.

const SHA_NULO = /^0+$/;

/** As linhas do stdin do pre-push: `<ref local> <sha local> <ref remota> <sha remoto>`. */
function lerRefs(texto) {
  return String(texto).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '').map((l) => {
    const [refLocal, shaLocal, refRemota, shaRemoto] = l.split(/\s+/);
    return { refLocal, shaLocal, refRemota, shaRemoto };
  });
}

/** O selo lido do `.verify-ok`, ou `null` se nao e um JSON de selo. */
function lerSelo(texto) {
  if (texto === null || texto === undefined) return null;
  try {
    const selo = JSON.parse(String(texto));
    return typeof selo === 'object' && selo !== null ? selo : null;
  } catch {
    return null;
  }
}

/**
 * O selo rapido cobre o push? O `commit` e o sha empurrado, e a `base` cobre o que o remoto nao tem:
 * e o sha remoto ou um ancestral dele; numa branch nova, a base esta numa ref remota.
 * `git.ehAncestral(a, b)` e `git.emRefRemota(a)` vem do hook (o teste os passa por tabela).
 */
function rapidoCobre(selo, r, git) {
  if (typeof selo.commit !== 'string' || typeof selo.base !== 'string') {
    return { ok: false, motivo: 'o selo rapido nao tem commit e base (formato antigo): rode `npm run verify:rapido`' };
  }
  if (selo.commit !== r.shaLocal) {
    return { ok: false, motivo: `o selo e do commit ${selo.commit.slice(0, 7)}, e o push leva ${String(r.shaLocal).slice(0, 7)} para ${r.refRemota}: rode \`npm run verify:rapido\` de novo` };
  }
  const nova = SHA_NULO.test(r.shaRemoto ?? '');
  const cobre = nova ? git.emRefRemota(selo.base) : git.ehAncestral(selo.base, r.shaRemoto);
  return cobre
    ? { ok: true, motivo: `selo rapido do ${selo.commit.slice(0, 7)} desde ${selo.base.slice(0, 7)}` }
    : { ok: false, motivo: `o selo rapido testou so desde ${selo.base.slice(0, 7)}, e o remoto nao tem esse ponto: rode \`npm run verify:rapido\` de novo` };
}

const SEM_GIT = { ehAncestral: () => false, emRefRemota: () => false };

/** `{ ok, motivo }`. So as branches pedem selo: apagar ref remota e empurrar tag nao. Passa o selo
 *  completo do sha empurrado, ou o rapido que o cobre (verify-rapido-no-push, CLAUDE.md §13). */
function decidirPush(textoDoSelo, refs, textoDoSeloRapido = null, git = SEM_GIT) {
  const branches = refs.filter((r) => !SHA_NULO.test(r.shaLocal ?? '') && String(r.refRemota ?? '').startsWith('refs/heads/'));
  if (branches.length === 0) return { ok: true, motivo: 'nada a conferir (tag ou ref apagada)' };
  const completo = lerSelo(textoDoSelo);
  if (completo !== null && completo.tipo === 'completo' && branches.every((r) => completo.commit === r.shaLocal)) {
    return { ok: true, motivo: `selo completo do ${String(completo.commit).slice(0, 7)}` };
  }
  const rapido = lerSelo(textoDoSeloRapido);
  if (rapido !== null && rapido.tipo === 'rapido') {
    let ultimo = null;
    for (const r of branches) {
      ultimo = rapidoCobre(rapido, r, git);
      if (!ultimo.ok) return ultimo;
    }
    return ultimo;
  }
  if (textoDoSelo !== null && textoDoSelo !== undefined && completo === null) {
    return { ok: false, motivo: 'o .verify-ok nao e um selo legivel (ou e o formato antigo, so a data), e nao ha selo rapido' };
  }
  if (completo !== null && completo.tipo !== 'completo') {
    return { ok: false, motivo: `o .verify-ok e do tipo '${String(completo.tipo)}', e nao ha selo rapido do HEAD` };
  }
  if (completo !== null) {
    return { ok: false, motivo: `o selo completo e do commit ${String(completo.commit).slice(0, 7)}, e nao ha selo rapido do HEAD: rode \`npm run verify:rapido\`` };
  }
  return { ok: false, motivo: 'sem selo do HEAD: rode `npm run verify:rapido`' };
}

module.exports = { lerRefs, lerSelo, decidirPush };
