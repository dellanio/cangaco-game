import dados from '../../data/caatinga-visual.json';
import type { FaseDoClima } from '../sim/clima';
import { pesoDoInverno } from './clima-visual';
import { hashDoEnfeite } from './enfeites';

export const configDaCaatinga = dados;

/** Quantizacao de tela: nao usa relogio real e nao muda o GameState. */
export function degrauDaCaatinga(fase: FaseDoClima | null): number {
  return fase === null ? 0 : Math.floor((1 - pesoDoInverno(fase)) * dados.degraus);
}

/** A ordem de cada tile e fixa em ambos os sentidos da transicao. */
export function vegetacaoSeca(gx: number, gy: number, degrau: number): boolean {
  return degrau > 0 && hashDoEnfeite(gx, gy, dados.semente) / 0x100000000 < degrau / dados.degraus;
}

/** Sem PNG sazonal carregado, conserva o normal. */
export function texturaDaCaatinga(
  normal: string, gx: number, gy: number, degrau: number, carregada: (chave: string) => boolean,
): string {
  if (!vegetacaoSeca(gx, gy, degrau)) return normal;
  const [tipo, id, ...partes] = normal.split(':');
  const estado = partes.join(':');
  const seca = `${tipo}:${id}:${estado === 'presente' ? 'seca' : `seca:${estado}`}`;
  return carregada(seca) ? seca : normal;
}
