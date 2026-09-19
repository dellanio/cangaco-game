#!/usr/bin/env node
// Stop: lembra de fechar a sessao direito. Nao commita sozinho.
const { execSync } = require('child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

try {
  const sujo = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim();
  if (sujo) {
    console.error(
      'Ha alteracoes nao commitadas. Antes de encerrar: atualize PROGRESS.md ' +
      '(o que foi feito, o que foi decidido e por que, o que ficou aberto) ' +
      'e faca o commit `feat(F##): <resumo>`.'
    );
  }
} catch {
  // Sem git ou fora de um repositorio: nao ha o que lembrar.
}
process.exit(0);
