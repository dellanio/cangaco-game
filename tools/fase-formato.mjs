// I-TERRENO-MAPA-NO-TILED / I-TERRENO-DEZ-MAPAS-DA-CAMPANHA — o formato CANONICO de uma fase da campanha
// (`data/campanha/fase-NN-<local>.json`). Um lugar so decide a ordem das chaves e o texto do arquivo:
// o gerador (`tools/gerar-fases.mjs`) e o `importar` do Tiled (`tools/mapa-tiled.mjs`) escrevem por aqui,
// e por isso a ida e volta pelo Tiled e byte a byte.

/** A legenda do terreno, a mesma do `data/maps/sertao-128.json`. */
export const LEGENDA = { g: 'grama', c: 'campoArado', a: 'areia', w: 'agua', r: 'rocha', m: 'montanha' };

/** Os recursos que um mapa poe, na ordem do arquivo. O milho (`corn`) nasce em partida, no roçado. */
export const RECURSOS_DO_MAPA = ['rock', 'tree', 'fish', 'grapes', 'coal', 'iron_ore', 'gold_ore'];

const ORDEM_DA_FASE = [
  'id', 'fase', 'local', 'titulo', 'ato', 'modo', 'escala', 'semente', 'gerador', '_doc',
  'narrativa', 'desafio', 'libera', 'objetivos', 'ondas', 'lados', 'mapa',
];
const ORDEM_DO_LADO = ['lado', 'nome', 'estoque', 'predios', 'unidades'];
const ORDEM_DO_PREDIO = ['id', 'gx', 'gy'];
const ORDEM_DA_UNIDADE = ['tipo', 'quantidade', 'gx', 'gy'];
const ORDEM_DO_MAPA = ['largura', 'altura', 'legenda', 'linhas', 'recursos'];

function ordenar(objeto, ordem) {
  const saida = {};
  for (const k of ordem) if (objeto[k] !== undefined) saida[k] = objeto[k];
  const sobra = Object.keys(objeto).filter((k) => !ordem.includes(k));
  if (sobra.length > 0) throw new Error(`fase: chave desconhecida ${sobra.join(', ')}`);
  return saida;
}

/** Os recursos em ordem: o tipo na ordem de `RECURSOS_DO_MAPA`, e os tiles por linha e coluna. */
export function recursosCanonicos(recursos) {
  const saida = {};
  for (const tipo of Object.keys(recursos)) {
    if (!RECURSOS_DO_MAPA.includes(tipo)) throw new Error(`fase: recurso desconhecido '${tipo}'`);
  }
  for (const tipo of RECURSOS_DO_MAPA) {
    const tiles = recursos[tipo];
    if (tiles === undefined || tiles.length === 0) continue;
    saida[tipo] = [...tiles].map(([gx, gy]) => [gx, gy]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }
  return saida;
}

export function faseCanonica(fase) {
  const f = ordenar(fase, ORDEM_DA_FASE);
  f.lados = fase.lados.map((l) => {
    const lado = ordenar(l, ORDEM_DO_LADO);
    lado.predios = l.predios.map((p) => ordenar(p, ORDEM_DO_PREDIO));
    lado.unidades = l.unidades.map((u) => ordenar(u, ORDEM_DA_UNIDADE));
    return lado;
  });
  f.mapa = ordenar(fase.mapa, ORDEM_DO_MAPA);
  f.mapa.recursos = recursosCanonicos(fase.mapa.recursos);
  return f;
}

/** O texto do arquivo: JSON com 2 espacos, e cada par [gx,gy] numa linha so. */
export function escreverFase(fase) {
  const texto = JSON.stringify(faseCanonica(fase), null, 2);
  return `${texto.replace(/\[\n\s+(-?\d+),\n\s+(-?\d+)\n\s+\]/g, '[$1, $2]')}\n`;
}
