#!/usr/bin/env node
// UserPromptSubmit: injeta STEER.md uma vez e apaga.
// Permite redirecionar uma sessao em andamento sem reinicia-la.
const fs = require('fs');
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const steer = path.join(root, 'STEER.md');

if (fs.existsSync(steer)) {
  console.log('=== CORRECAO DE RUMO DO OPERADOR (ler e aplicar agora) ===');
  console.log(fs.readFileSync(steer, 'utf8'));
  console.log('=== FIM DA CORRECAO ===');
  fs.unlinkSync(steer);
}
process.exit(0);
