#!/usr/bin/env node
'use strict';

// CLI que roda a sim sem tela e imprime o estado (BUILD_PLAN F05a).
// Carrega TypeScript de dentro do Node via `vite` (createServer +
// ssrLoadModule) — zero dependencia nova, o mesmo Vite que ja serve o dev
// server. Nenhum numero de balanceamento mora aqui: tudo vem de
// resumoDoEstado (src/sim/selectors.ts), que le do GameState, que leu de
// data/economy.json no carregamento.

const { createServer } = require('vite');

const CENARIOS = {
  // A F05a so tem um cenario: o estado inicial do GDD 3.2, sem nenhum
  // comando. Cenarios futuros (ex.: F10 "armazem com 10 stone") ganham
  // entrada propria aqui, sem tocar no runner.
  inicial: { seed: 1 },
};

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
    const { createInitialState } = await server.ssrLoadModule('/src/sim/state.ts');
    const { step } = await server.ssrLoadModule('/src/sim/tick.ts');
    const { resumoDoEstado } = await server.ssrLoadModule('/src/sim/selectors.ts');

    let state = createInitialState(config.seed);
    for (let i = 0; i < ticks; i++) {
      state = step(state, []);
    }

    imprimirResumo(resumoDoEstado(state));
  } finally {
    await server.close();
  }
}

main().catch((erro) => {
  console.error(`sim: ${erro.message}`);
  process.exitCode = 1;
});
