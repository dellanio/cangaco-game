/**
 * D-ARTE-PIXEL-ART-CIVIS — onde o sprite da mercadoria fica quando o serf anda com a pose de
 * carregar (`carregando`): entre as maos, relativo ao pe (a origem do container da unidade).
 * Os numeros sao de tela e moram em `data/carga-nas-maos.json`. As tres direcoes do oeste sao o
 * espelho das do leste, como o atlas.
 */
import type { Direcao } from './manifesto';

export interface PontoDaCarga {
  readonly x: number;
  readonly y: number;
  /** De costas, a carga fica escondida atras do corpo. */
  readonly atras: boolean;
}

export interface CargaNasMaos {
  readonly tamanhoPx: number;
  readonly pontos: Readonly<Record<'n' | 'ne' | 'l' | 'se' | 's', PontoDaCarga>>;
}

const ESPELHO: Readonly<Record<string, 'ne' | 'l' | 'se'>> = { no: 'ne', o: 'l', so: 'se' };

export function pontoDaCargaNasMaos(direcao: Direcao, config: CargaNasMaos): PontoDaCarga {
  const espelhada = ESPELHO[direcao];
  if (espelhada !== undefined) {
    const p = config.pontos[espelhada];
    return { x: -p.x, y: p.y, atras: p.atras };
  }
  return config.pontos[direcao as 'n' | 'ne' | 'l' | 'se' | 's'];
}
