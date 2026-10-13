import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

it('CLI real carrega a sim sem observar arquivos e fecha o Vite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cangaco-cli-observado-'));
  const arquivo = join(dir, 'observado.json');
  const preload = resolve('tests/helpers/observar-vite-cli.js').replaceAll('\\', '/');
  if (!resolve(dir).startsWith(resolve(tmpdir()) + '\\') && !resolve(dir).startsWith(resolve(tmpdir()) + '/')) {
    throw new Error('diretorio temporario fora do alvo esperado');
  }
  try {
    const saida = execFileSync(process.execPath, ['tools/sim.js', 'inicial', '--ticks', '0'], {
      encoding:'utf8', timeout:30_000,
      env:{...process.env,CANGACO_CLI_OBSERVADO:arquivo,NODE_OPTIONS:[process.env['NODE_OPTIONS'], `--require ${JSON.stringify(preload)}`].filter(Boolean).join(' ')},
    });
    expect(saida).toContain('tick: 0');
    expect(JSON.parse(readFileSync(arquivo,'utf8'))).toEqual({semWatch:true,diretoriosObservados:0});
  } finally {
    // Caminho criado acima exclusivamente para este teste, dentro do diretorio temporario.
    rmSync(dir,{recursive:true,force:true});
  }
}, 30_000);
