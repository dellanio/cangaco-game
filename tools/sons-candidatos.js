'use strict';

// H-ARTE-SONS-CANDIDATOS — le a tabela de `docs/sons-candidatos.md`. Funcao pura sobre o texto:
// uma linha por som, com o id, o "toca quando", os candidatos e a coluna `aprovado`, que so o
// operador preenche. Quem le: o teste da lista e, na H-ARTE-SONS-APROVADOS, quem baixa.

/** Um candidato: `N. [titulo — autor](url) · licenca · ...`. */
const CANDIDATO = /^(\d+)\.\s*\[(.+?)\]\((https?:\/\/[^)\s]+)\)\s*·\s*([^·]+?)\s*(?:·.*)?$/;

function lerCandidatos(celula) {
  return celula.split(/<br\s*\/?>/i).map((s) => s.trim()).filter((s) => s.length > 0).map((texto) => {
    const m = CANDIDATO.exec(texto);
    if (!m) return { valido: false, texto };
    return { valido: true, numero: Number(m[1]), titulo: m[2], url: m[3], licenca: m[4].trim(), texto };
  });
}

/** As linhas da tabela cujo primeiro campo e um id entre crases. */
function lerSonsCandidatos(md) {
  const linhas = [];
  for (const bruta of md.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha.startsWith('|')) continue;
    const campos = linha.slice(1, linha.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
    const id = /^`([a-z0-9-]+)`$/.exec(campos[0] ?? '');
    if (!id || campos.length !== 4) continue;
    linhas.push({ id: id[1], tocaQuando: campos[1], candidatos: lerCandidatos(campos[2]), aprovado: campos[3] });
  }
  return linhas;
}

/**
 * A escolha do operador numa linha: `null` (vazio, ainda nao olhou), `'nenhum'`, o candidato pelo
 * numero, ou um link novo do operador (`{ valido, url, novo: true }`: a licenca dele NAO foi
 * conferida pela lista, e quem baixa confere na pagina antes). Outro valor e `'invalido'`.
 */
function escolhaDoOperador(linha) {
  const bruto = linha.aprovado.trim();
  const v = bruto.toLowerCase();
  if (v === '') return null;
  if (v === 'nenhum') return 'nenhum';
  if (/^https:\/\/(freesound\.org\/people|opengameart\.org\/content)\/\S+$/.test(bruto)) {
    return { valido: true, url: bruto, novo: true, texto: bruto };
  }
  const c = linha.candidatos.find((x) => x.valido && String(x.numero) === v);
  return c ?? 'invalido';
}

module.exports = { lerSonsCandidatos, escolhaDoOperador };
