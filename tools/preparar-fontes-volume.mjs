import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import console from 'node:console';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { extracaoDaFonte } = await server.ssrLoadModule('/tests/helpers/fontes-volume-cenario.ts');
  const { salvar, carregar } = await server.ssrLoadModule('/src/sim/save.ts');
  const registros = [];
  mkdirSync('test-output/fontes-volume', { recursive: true });
  for (const tipo of ['coal', 'iron_ore', 'gold_ore']) {
    const { chave, fases } = extracaoDaFonte(tipo);
    for (const fase of fases) {
      const texto = salvar(fase.jogo); carregar(texto);
      const path = `test-output/fontes-volume/${tipo}-${fase.estado}.json`;
      writeFileSync(path, texto);
      registros.push({ tipo, chave, estado: fase.estado, tick: fase.jogo.tick, path });
    }
  }
  writeFileSync('test-output/fontes-volume/medidas.json', JSON.stringify(registros, null, 2));
  console.log(JSON.stringify(registros));
} finally { await server.close(); }
