#!/usr/bin/env node
// npm run verify -> este script. Cria .verify-ok somente se TUDO passar.
const { execSync } = require('child_process');
const fs = require('fs');

// F18c-1c: test:transladado roda a suite num mundo andado de +K; so reprova
// quem escreveu coordenada absoluta (vitest.transladado.config.mts).
const etapas = ['typecheck', 'lint', 'validate:data', 'test', 'test:transladado'];

try { fs.unlinkSync('.verify-ok'); } catch {}

for (const etapa of etapas) {
  console.log(`\n--- npm run ${etapa} ---`);
  try {
    execSync(`npm run ${etapa}`, { stdio: 'inherit' });
  } catch {
    console.error(`\nFALHOU: ${etapa}. O selo .verify-ok NAO foi criado.`);
    process.exit(1);
  }
}

// o selo do verify COMPLETO (camadas de teste, 2026-10-01): o portao do test-results.json confere o
// `tipo`, e o `verify:rapido` grava outro arquivo (.verify-rapido-ok), nunca este
let commit = '?';
try { commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { /* sem git */ }
fs.writeFileSync('.verify-ok', JSON.stringify({ tipo: 'completo', commit, quando: new Date().toISOString() }));
console.log('\nVerificacao completa. Evidencia em test-output/ e screenshots/.');
