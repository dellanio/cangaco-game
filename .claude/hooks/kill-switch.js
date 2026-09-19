#!/usr/bin/env node
// PreToolUse: trava toda chamada de ferramenta enquanto existir AGENT_STOP na raiz.
// Freio do operador: crie o arquivo para parar o agente imediatamente.
const fs = require('fs');
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

if (fs.existsSync(path.join(root, 'AGENT_STOP'))) {
  console.error(
    'AGENT_STOP presente na raiz do projeto. O operador pediu parada imediata. ' +
    'Nao execute mais nada; responda apenas confirmando que parou.'
  );
  process.exit(2);
}
process.exit(0);
