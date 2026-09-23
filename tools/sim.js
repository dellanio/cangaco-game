#!/usr/bin/env node
'use strict';

// CLI que roda a sim sem tela e imprime o estado (BUILD_PLAN F05a).
// Carrega TypeScript de dentro do Node via `vite` (createServer +
// ssrLoadModule) — zero dependencia nova, o mesmo Vite que ja serve o dev
// server. Nenhum numero de balanceamento mora aqui: tudo vem de
// resumoDoEstado (src/sim/selectors.ts), que le do GameState, que leu de
// data/economy.json no carregamento.

const { createServer } = require('vite');

const tile = (gx, gy) => ({ gx, gy });
const linhaH = (x0, x1, y) => Array.from({ length: x1 - x0 + 1 }, (_, i) => tile(x0 + i, y));

const CENARIOS = {
  // A F05a so tem um cenario: o estado inicial do GDD 3.2, sem nenhum
  // comando. Cenarios futuros (ex.: F10 "armazem com 10 stone") ganham
  // entrada propria aqui, sem tocar no runner.
  inicial: { seed: 1 },

  // F15a — o MESMO cenario de tests/F15a-aceite.test.ts, para reproduzir a
  // corrida a mao: `npm run sim -- producao --ticks 1300`. As estradas entram
  // direto no estado (como na fixture do teste) porque `PlaceRoad` debitaria
  // pedra e amarraria a corrida ao preco da estrada; o resto e comando de
  // verdade. Os numeros do ciclo NAO moram aqui: vem de data/production.json
  // pelo estado.
  producao: {
    seed: 1,
    estradas: [...linhaH(29, 36, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
    comandos: (state, mods) => [
      { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 26, gy: 34 },
      { type: 'EnqueueTraining', predio: predioDoTipo(state, mods.ID_DA_ESCOLA), unidade: mods.trabalhadorDoTipo('quarry') },
    ],
    producao: true,
  },
};

function predioDoTipo(state, tipo) {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p && p.tipo === tipo && p.estado === 'completo') return id;
  }
  throw new Error(`cenario sem '${tipo}' completo`);
}

function lerArgs(argv) {
  const posicionais = argv.filter((a) => !a.startsWith('--'));
  const cenario = posicionais[0];
  const idxTicks = argv.indexOf('--ticks');
  const ticks = idxTicks !== -1 && argv[idxTicks + 1] ? Number(argv[idxTicks + 1]) : 0;
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error(`--ticks precisa ser um inteiro >= 0, recebeu '${argv[idxTicks + 1]}'`);
  }
  return { cenario, ticks };
}

function formatarRegistro(rotulo, valores) {
  const linhas = Object.entries(valores).map(([k, v]) => `    ${k}: ${v}`);
  return [`  ${rotulo}`, ...linhas].join('\n');
}

/** So para cenarios de producao: o relogio do ciclo, o veio e a gaveta `saida`
 *  de cada predio produtivo, que o resumo geral nao carrega. */
function imprimirProducao(state) {
  console.log('producao:');
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (!p || p.estado !== 'completo' || !p.producao) continue;
    const saida = Object.entries(p.estoque.saida).map(([m, q]) => `${m}=${q}`).join(' ') || '(vazia)';
    const ocupante = p.ocupante ? `${p.ocupante} (${state.unidades.porId[p.ocupante]?.fsm ?? '?'})` : '(sem ocupante)';
    console.log(formatarRegistro(`${p.id} (${p.tipo})`, {
      progresso: p.producao.progresso, veio: p.producao.veio, saida, ocupante,
    }));
  }
}

function imprimirResumo(resumo) {
  console.log(`tick: ${resumo.tick}`);
  console.log('predios:');
  for (const p of resumo.predios) {
    console.log(formatarRegistro(`${p.id} (${p.tipo})`, {
      posicao: `${p.gx},${p.gy}`, estado: p.estado, hp: p.hp,
    }));
  }
  console.log('estoque (total, entrada+saida):');
  for (const [mercadoria, quantidade] of Object.entries(resumo.estoqueTotal)) {
    console.log(`    ${mercadoria}: ${quantidade}`);
  }
  console.log('unidades:');
  for (const [tipo, quantidade] of Object.entries(resumo.unidadesPorTipo)) {
    console.log(`    ${tipo}: ${quantidade}`);
  }
}

async function main() {
  const { cenario, ticks } = lerArgs(process.argv.slice(2));
  const config = cenario ? CENARIOS[cenario] : undefined;
  if (!config) {
    console.error(`sim: cenario '${cenario ?? ''}' desconhecido. Cenarios disponiveis: ${Object.keys(CENARIOS).join(', ')}`);
    process.exit(1);
    return;
  }

  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { createInitialState, ID_DA_ESCOLA } = await server.ssrLoadModule('/src/sim/state.ts');
    const { step } = await server.ssrLoadModule('/src/sim/tick.ts');
    const { resumoDoEstado } = await server.ssrLoadModule('/src/sim/selectors.ts');
    const { chaveDeTile } = await server.ssrLoadModule('/src/sim/estradas.ts');
    const { trabalhadorDoTipo } = await server.ssrLoadModule('/src/sim/ocupacao.ts');

    let state = createInitialState(config.seed);
    if (config.estradas) {
      const novas = Object.fromEntries(config.estradas.map((t) => [chaveDeTile(t), true]));
      state = { ...state, estradas: { ...state.estradas, ...novas } };
    }
    const comandos = config.comandos ? config.comandos(state, { ID_DA_ESCOLA, trabalhadorDoTipo }) : [];
    for (let i = 0; i < ticks; i++) {
      state = step(state, i === 0 ? comandos : []);
    }

    imprimirResumo(resumoDoEstado(state));
    if (config.producao) imprimirProducao(state);
  } finally {
    await server.close();
  }
}

main().catch((erro) => {
  console.error(`sim: ${erro.message}`);
  process.exitCode = 1;
});
