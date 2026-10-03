import type { GameState } from '../sim/state';
import { posicaoDaUnidade } from '../sim/selectors';
import type { Direcao } from './manifesto';
import { alvoDaDirecao } from './direcao-de-unidade';
import { unidadesInvisiveis } from './visibilidade';
import { acaoDaUnidade, atualizarAcao, direcaoDoTrabalho } from './acao-de-unidade';
import type { MemoriaDeAcao } from './acao-de-unidade';

export interface MorteVisual {
  readonly id: string; readonly tipo: string; readonly lado: number;
  readonly gx: number; readonly gy: number; readonly direcao: Direcao; readonly tick: number;
}

/** Recebe cada tick, inclusive quando varios passos acontecem entre dois renders. */
export function criarObservadorDeUnidades() {
  const acoes = new Map<string, MemoriaDeAcao>();
  let mortes: MorteVisual[] = [];
  function observarAcoes(estado: GameState): void {
    const vivas = new Set(estado.unidades.ordem);
    for (const id of acoes.keys()) if (!vivas.has(id)) acoes.delete(id);
    const invisiveis = unidadesInvisiveis(estado);
    for (const id of estado.unidades.ordem) {
      const u = estado.unidades.porId[id];
      if (u) acoes.set(id, atualizarAcao(acoes.get(id), acaoDaUnidade(u, false, !invisiveis.has(id)), estado.tick));
    }
  }
  return {
    get acoes(): ReadonlyMap<string, MemoriaDeAcao> { return acoes; },
    observar(anterior: GameState | null, atual: GameState | null): void {
      if (!atual || atual === anterior) return;
      if (anterior && atual.tick === anterior.tick + 1) {
        const eventos = atual.events.filter(e => e.type === 'unit-killed' || e.type === 'unit-starved');
        if (eventos.length > 0) {
          const invisiveis = unidadesInvisiveis(anterior);
          const vistos = new Set<string>();
          for (const e of eventos) {
            const u = anterior.unidades.porId[e.unidade];
            if (!u || invisiveis.has(u.id) || vistos.has(u.id)) continue;
            vistos.add(u.id);
            const p = posicaoDaUnidade(anterior, u);
            const proximo = u.fsmData.caminho?.[0];
            const trabalho = acaoDaUnidade(u, false, true) === 'trabalhar' ? direcaoDoTrabalho(anterior, u) : null;
            mortes.push({ id: u.id, tipo: u.tipo, lado: u.lado, ...p, tick: atual.tick,
              direcao: trabalho ?? alvoDaDirecao(u.tipo, u.direcao, proximo ? proximo.gx - u.gx : 0, proximo ? proximo.gy - u.gy : 0, 8) ?? 's' });
          }
        }
      }
      observarAcoes(atual);
    },
    consumirMortes(): readonly MorteVisual[] { const r = mortes; mortes = []; return r; },
    reiniciar(estado: GameState | null): void { mortes = []; acoes.clear(); if (estado) observarAcoes(estado); },
  };
}
