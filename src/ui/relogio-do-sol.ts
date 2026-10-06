// I-TELA-RELOGIO-DO-SOL — o relogio do sol no canto superior direito (pedido do operador, 2026-10-06):
// o mostrador com as quatro fases (arte do Codex) e o ponteiro do sol girando. So le o estado, pela
// funcao pura da sim (`faseNoTick`); nunca muta GameState. O nome da estacao e o tempo ate a proxima
// ficam embaixo.
import type { GameState } from '../sim/state';
import { faseNoTick } from '../sim/clima';
import type { FaseDoClima } from '../sim/clima';
import temaSertao from '../../data/theme-sertao.json';

/**
 * O angulo do ponteiro, em graus a partir das 12h no sentido horario. O mostrador tem as `n` fases em
 * setores IGUAIS, e as fases duram tempos diferentes: o ponteiro anda o setor da fase pela fracao DELA.
 */
export function anguloDoPonteiro(fase: FaseDoClima, n: number): number {
  const setor = 360 / n;
  return setor * (fase.indice + fase.decorrido / (fase.decorrido + fase.falta));
}

/** O tempo de relogio que falta para a proxima fase, `m:ss`. */
export function faltaEmTexto(fase: FaseDoClima, tickMs: number): string {
  const s = Math.ceil((fase.falta * tickMs) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface RelogioDoSol {
  atualizar(estado: GameState): void;
}

export function montarRelogioDoSol(n: number, tickMs: number): RelogioDoSol {
  const raiz = document.getElementById('relogio-do-sol');
  if (!raiz) throw new Error('relogio-do-sol: #relogio-do-sol nao existe no index.html');
  const mostrador = document.createElement('div');
  mostrador.className = 'mostrador';
  const ponteiro = document.createElement('div');
  ponteiro.className = 'ponteiro';
  mostrador.append(ponteiro);
  const legenda = document.createElement('p');
  legenda.className = 'legenda';
  raiz.append(mostrador, legenda);
  const nomes = temaSertao.clima.estacoes as Readonly<Record<string, string>>;
  let ultimo = '';
  return {
    atualizar(estado) {
      const fase = faseNoTick(estado.tick);
      raiz.hidden = fase === null;
      if (fase === null) return;
      const angulo = anguloDoPonteiro(fase, n);
      const texto = `${nomes[fase.id] ?? fase.id} · ${faltaEmTexto(fase, tickMs)}`;
      const chave = `${angulo.toFixed(1)}|${texto}`;
      if (chave === ultimo) return;
      ultimo = chave;
      ponteiro.style.transform = `rotate(${angulo.toFixed(2)}deg)`;
      raiz.dataset.estacao = fase.id;
      raiz.dataset.angulo = angulo.toFixed(2);
      legenda.textContent = texto;
      raiz.title = `${temaSertao.clima.titulo}: ${texto}`;
    },
  };
}
