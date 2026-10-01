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

/** `{ ok, motivo }`. So as branches pedem selo: apagar ref remota e empurrar tag nao. */
function decidirPush(textoDoSelo, refs) {
  const branches = refs.filter((r) => !SHA_NULO.test(r.shaLocal ?? '') && String(r.refRemota ?? '').startsWith('refs/heads/'));
  if (branches.length === 0) return { ok: true, motivo: 'nada a conferir (tag ou ref apagada)' };
  const selo = lerSelo(textoDoSelo);
  if (textoDoSelo === null || textoDoSelo === undefined) return { ok: false, motivo: 'sem .verify-ok: rode `npm run verify`' };
  if (selo === null) return { ok: false, motivo: 'o .verify-ok nao e um selo legivel (ou e o formato antigo, so a data)' };
  if (selo.tipo !== 'completo') return { ok: false, motivo: `o selo e do tipo '${String(selo.tipo)}', e o push pede o verify completo` };
  for (const r of branches) {
    if (selo.commit !== r.shaLocal) {
      return { ok: false, motivo: `o selo e do commit ${String(selo.commit).slice(0, 7)}, e o push leva ${String(r.shaLocal).slice(0, 7)} para ${r.refRemota}: rode \`npm run verify\` de novo` };
    }
  }
  return { ok: true, motivo: `selo completo do ${String(selo.commit).slice(0, 7)}` };
}

module.exports = { lerRefs, lerSelo, decidirPush };
