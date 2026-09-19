#!/usr/bin/env node
// npm run verify -> este script. Cria .verify-ok somente se TUDO passar.
const { execSync } = require('child_process');
const fs = require('fs');

const etapas = ['typecheck', 'lint', 'validate:data', 'test'];

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

fs.writeFileSync('.verify-ok', new Date().toISOString());
console.log('\nVerificacao completa. Evidencia em test-output/ e screenshots/.');
