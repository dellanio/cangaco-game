// BUG-SHOT-TODOS-ONZE-ROTEIROS-VERMELHOS (2026-10-10) — a corrida transladada nao escreve nas
// partidas salvas do mundo normal. Os roteiros (`npm run shot`) carregam `test-output/*.save.txt`
// num mapa NAO transladado; um teste que grava ali pela corrida de +K entrega ao roteiro uma
// partida de outro mundo, e o roteiro reprova longe da causa. A guarda e de comportamento: o
// conteudo de cada partida antes e depois da corrida inteira, e nao uma varredura do fonte.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const DIR = 'test-output';

export function digestDasPartidas(dir: string = DIR): Record<string, string> {
  if (!existsSync(dir)) return {};
  const digest: Record<string, string> = {};
  for (const nome of readdirSync(dir).filter((n) => n.endsWith('.save.txt')).sort()) {
    digest[nome] = createHash('sha256').update(readFileSync(`${dir}/${nome}`)).digest('hex');
  }
  return digest;
}

/** Os nomes cuja partida mudou ou nasceu entre os dois retratos. */
export function partidasTocadas(antes: Record<string, string>, depois: Record<string, string>): string[] {
  return Object.keys(depois).filter((nome) => antes[nome] !== depois[nome]).sort();
}

export default function guarda(): () => void {
  const antes = digestDasPartidas();
  return () => {
    const tocadas = partidasTocadas(antes, digestDasPartidas());
    if (tocadas.length > 0) {
      throw new Error(
        `a corrida transladada escreveu ${tocadas.length} partida(s) do mundo normal em ${DIR}/: ${tocadas.join(', ')}. `
        + 'Grave pelo CANGACO_EVIDENCIA_DIR.',
      );
    }
  };
}
