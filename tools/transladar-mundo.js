'use strict';

// F18c-1a — o oraculo do literal absoluto: translada o MUNDO inteiro (+K) e roda
// a suite. Mapa, recursos e vila andam juntos num mapa de N+K, com faixa de grama
// a oeste e ao norte; toda distancia relativa fica igual, e so reprova quem
// escreveu coordenada absoluta. Dar a volta dentro do mesmo mapa inventaria falso
// positivo (a serra e as minas dando a volta), por isso o mapa cresce.
//
// Escreve os tres JSON, roda o vitest e REVERTE sempre — no `finally` e no
// Ctrl+C. Nao e parte do `npm run verify`: e instrumento de medida.
//
//   node tools/transladar-mundo.js [--k 32] [--saida arquivo.json] [-- <filtro do vitest>]
//
// A saida lista os arquivos que reprovam, com a primeira mensagem, e separa os
// que caem por `fixture: '<id>' nao ficou ligado` (o helper de cenario).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const ARQ = {
  economia: path.join(RAIZ, 'data', 'economy.json'),
  mapa: path.join(RAIZ, 'data', 'maps', 'sertao-128.json'),
  terreno: path.join(RAIZ, 'data', 'terrain.json'),
};

function argumentos(argv) {
  const sep = argv.indexOf('--');
  const proprios = sep < 0 ? argv : argv.slice(0, sep);
  const filtro = sep < 0 ? [] : argv.slice(sep + 1);
  const valor = (nome, padrao) => {
    const i = proprios.indexOf(nome);
    return i < 0 ? padrao : proprios[i + 1];
  };
  return { k: Number(valor('--k', '32')), saida: valor('--saida', null), filtro };
}

function transladar(originais, k) {
  const e = JSON.parse(originais.economia);
  for (const p of e.estadoInicial.predios) { p.gx += k; p.gy += k; }
  e.estadoInicial.spawnDeUnidades.gx += k;
  e.estadoInicial.spawnDeUnidades.gy += k;

  const m = JSON.parse(originais.mapa);
  const grama = Object.keys(m.legenda).find((c) => m.legenda[c] === 'grama');
  if (grama === undefined) throw new Error('transladar: a legenda do mapa nao tem grama');
  const n = m.largura;
  if (m.altura !== n) throw new Error('transladar: o instrumento assume mapa quadrado');
  const novo = n + k;
  m.linhas = [
    ...Array.from({ length: k }, () => grama.repeat(novo)),
    ...m.linhas.map((l) => grama.repeat(k) + l),
  ];
  for (const r of Object.keys(m.recursos)) m.recursos[r] = m.recursos[r].map(([x, y]) => [x + k, y + k]);
  m.largura = novo;
  m.altura = novo;

  const de = `"mapaPadrao": { "largura": ${n}, "altura": ${n} }`;
  if (!originais.terreno.includes(de)) throw new Error(`transladar: terrain.json nao tem ${de}`);
  const terreno = originais.terreno.replace(de, `"mapaPadrao": { "largura": ${novo}, "altura": ${novo} }`);

  fs.writeFileSync(ARQ.economia, `${JSON.stringify(e, null, 2)}\n`);
  fs.writeFileSync(ARQ.mapa, JSON.stringify(m));
  fs.writeFileSync(ARQ.terreno, terreno);
}

function resumir(relatorio) {
  const reprovados = {};
  for (const f of relatorio.testResults) {
    const falhas = f.assertionResults.filter((a) => a.status === 'failed');
    if (falhas.length === 0 && f.status !== 'failed') continue;
    const nome = path.relative(RAIZ, f.name).replace(/\\/g, '/');
    const msg = (falhas[0]?.failureMessages?.[0] ?? f.message ?? '').split('\n')[0].slice(0, 200);
    reprovados[nome] = { falhas: falhas.length, mensagem: msg };
  }
  const nomes = Object.keys(reprovados).sort();
  return {
    reprovados: nomes.length,
    porFixtureNaoLigado: nomes.filter((n) => /nao ficou ligado/.test(reprovados[n].mensagem)),
    arquivos: reprovados,
  };
}

function main() {
  const { k, saida, filtro } = argumentos(process.argv.slice(2));
  const originais = Object.fromEntries(Object.entries(ARQ).map(([id, f]) => [id, fs.readFileSync(f, 'utf8')]));
  const reverter = () => { for (const [id, f] of Object.entries(ARQ)) fs.writeFileSync(f, originais[id]); };
  const noSinal = () => { reverter(); process.exit(130); };
  process.on('SIGINT', noSinal);
  const json = path.join(RAIZ, 'test-output', '.transladar-mundo.vitest.json');
  let resumo;
  try {
    transladar(originais, k);
    spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${json}`, ...filtro], {
      cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'], shell: true,
    });
    resumo = { k, ...resumir(JSON.parse(fs.readFileSync(json, 'utf8'))) };
  } finally {
    reverter();
    process.off('SIGINT', noSinal);
    if (fs.existsSync(json)) fs.unlinkSync(json);
  }
  for (const [id, f] of Object.entries(ARQ)) {
    if (fs.readFileSync(f, 'utf8') !== originais[id]) throw new Error(`transladar: ${id} nao reverteu`);
  }
  const texto = JSON.stringify(resumo, null, 2);
  if (saida !== null) fs.writeFileSync(path.resolve(RAIZ, saida), `${texto}\n`);
  process.stdout.write(`${texto}\n`);
}

main();
