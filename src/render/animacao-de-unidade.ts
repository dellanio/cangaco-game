import { ESPELHO_DO_OESTE, assetDaCamada } from './manifesto';
import type { AnimacaoDeUnidade, Direcao, Manifesto, SpriteDaUnidade } from './manifesto';
import type { PontoEmTiles } from './interpolacao';

export function quadroDoAndar(distanciaAcumulada: number, tilesPorCiclo: number, quadros: number): number {
  return Math.floor(distanciaAcumulada / tilesPorCiclo * quadros) % quadros;
}
export function tempoDeAnimacao(tick: number, alfa: number): number {
  return Math.max(0, tick - 1 + Math.min(1, Math.max(0, alfa)));
}
export function quadroPeloTempo(tempoTicks: number, tickHz: number, animacao: AnimacaoDeUnidade): number {
  const quadro = Math.floor(tempoTicks * (animacao.fps ?? tickHz) / tickHz);
  return animacao.laco ? quadro % animacao.quadros : Math.min(quadro, animacao.quadros - 1);
}
/** Reposicionamentos não viram passos. Chamador também informa o salto entre ticks. */
export function somarDistancia(
  acumulada: number, anterior: PontoEmTiles | null, atual: PontoEmTiles,
  saltoMaximo: number, reposicionado = false,
): number {
  if (anterior === null || reposicionado) return acumulada;
  const distancia = Math.hypot(atual.gx - anterior.gx, atual.gy - anterior.gy);
  return distancia > saltoMaximo ? acumulada : acumulada + distancia;
}
export function depuracaoDeUnidade(busca: string): boolean {
  const parametros = new URLSearchParams(busca);
  return parametros.has('depuracao') || parametros.get('vitrine') === 'serf';
}
export function chaveDoAtlas(id: string): string { return `unidade:${id}:atlas`; }
export function unidadeNaVista(
  pe: { readonly x: number; readonly y: number }, tamanho: readonly [number, number], anchor: readonly [number, number],
  vista: { readonly x: number; readonly y: number; readonly right: number; readonly bottom: number },
): boolean {
  const x = pe.x - tamanho[0] * anchor[0], y = pe.y - tamanho[1] * anchor[1];
  return x < vista.right && x + tamanho[0] > vista.x && y < vista.bottom && y + tamanho[1] > vista.y;
}
export function nomeDoQuadro(id: string, animacao: string, direcao: Direcao, quadro: number): string {
  return `${id}/${animacao}/${direcao}/${String(quadro).padStart(4, '0')}`;
}
export interface SpriteAnimado extends SpriteDaUnidade { readonly frame: string }
/** Atlas antes dos estados; só resolve quadros que o TextureManager realmente tem. */
export function spriteDoAtlas(
  manifesto: Manifesto, tipo: string, animacao: string, direcao: Direcao, quadro: number,
  temQuadro: (chave: string, frame: string) => boolean,
): SpriteAnimado | null {
  const entrada = assetDaCamada(manifesto, 'unidade', tipo);
  if (!entrada?.atlas || !entrada.animacoes?.[animacao]) return null;
  const chave = chaveDoAtlas(tipo);
  for (const [d, espelhar] of [[direcao, false], [ESPELHO_DO_OESTE[direcao], true]] as const) {
    if (!d) continue;
    const frame = nomeDoQuadro(tipo, animacao, d, quadro);
    if (temQuadro(chave, frame)) return { chave, frame, espelhar, entrada };
  }
  return null;
}
