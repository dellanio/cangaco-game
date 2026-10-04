// I-ENTREGA-PLAYTEST — o unico ajuste do Vite: o commit do build entra no bundle, para o relato do
// playtest dizer que versao a pessoa jogou (`src/commit-do-build.ts`). Sem git (um zip do codigo),
// o valor e `desconhecido`. O resto e o padrao do Vite, como antes deste arquivo existir.
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function commitDoBuild(): string {
  try {
    return execSync('git describe --always --dirty --abbrev=7', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'desconhecido';
  }
}

export default defineConfig({
  define: { __COMMIT_DO_BUILD__: JSON.stringify(commitDoBuild()) },
});
