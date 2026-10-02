import { DIRECOES } from './manifesto';
import type { Direcao } from './manifesto';

/** Degraus de 45°; em 180° o desempate é sempre horário. */
export function direcaoNaVirada(anterior: Direcao, nova: Direcao, tempoDesdeATroca: number, passo: number): Direcao {
  const inicio = DIRECOES.indexOf(anterior);
  const diferenca = (DIRECOES.indexOf(nova) - inicio + DIRECOES.length) % DIRECOES.length;
  const sentido = diferenca <= 4 ? 1 : -1;
  const distancia = Math.min(diferenca, DIRECOES.length - diferenca);
  const razao = Math.max(0, tempoDesdeATroca) / passo;
  const avancados = Math.min(distancia, 1 + Math.floor(razao + Number.EPSILON * Math.max(1, razao) * 4));
  return DIRECOES[(inicio + sentido * avancados + DIRECOES.length) % DIRECOES.length] ?? nova;
}
export interface MemoriaDaVirada {
  readonly anterior: Direcao; readonly alvo: Direcao; readonly visivel: Direcao; readonly desde: number;
}
export function iniciarVirada(direcao: Direcao, tempo: number): MemoriaDaVirada {
  return { anterior: direcao, alvo: direcao, visivel: direcao, desde: tempo };
}
/** Memória só de render. Parada mantém inclusive um degrau ainda intermediário. */
export function atualizarVirada(
  memoria: MemoriaDaVirada, alvo: Direcao | null, tempo: number, passo: number,
): MemoriaDaVirada {
  if (alvo === null) return memoria;
  const inicio = alvo !== memoria.alvo || tempo < memoria.desde
    ? { anterior: memoria.visivel, alvo, desde: tempo } : memoria;
  return { ...inicio, visivel: direcaoNaVirada(inicio.anterior, alvo, tempo - inicio.desde, passo) };
}
