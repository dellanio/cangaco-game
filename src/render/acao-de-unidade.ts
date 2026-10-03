import type { GameState, Unidade } from '../sim/state';
import type { Direcao } from './manifesto';
import { direcaoDoPasso } from './manifesto';
import { tipoMilitar } from './direcao-de-unidade';

export type AcaoVisual = 'parado' | 'andar' | 'atacar' | 'trabalhar';
export interface MemoriaDeAcao { readonly animacao: AcaoVisual | null; readonly inicio: number }

/** Apresentacao apenas: nao dispara ataque nem avanca tarefa. */
export function acaoDaUnidade(u: Pick<Unidade, 'tipo' | 'fsm'>, andando: boolean, visivel: boolean): AcaoVisual | null {
  if (!visivel) return null;
  if (tipoMilitar(u.tipo) && ['lutando', 'atirando', 'atacando'].includes(u.fsm)) return 'atacar';
  if (u.tipo !== 'serf' && u.tipo !== 'recruit' && !tipoMilitar(u.tipo)
    && (['colhendo', 'semeando'].includes(u.fsm) || (u.tipo === 'laborer' && ['nivelando', 'martelando'].includes(u.fsm)))) return 'trabalhar';
  return andando ? 'andar' : 'parado';
}

export function atualizarAcao(anterior: MemoriaDeAcao | undefined, animacao: AcaoVisual | null, tick: number): MemoriaDeAcao {
  return anterior?.animacao === animacao && tick >= anterior.inicio ? anterior : { animacao, inicio: tick };
}

/** Tile da tarefa quando existe; trabalho no proprio tile preserva a direcao. */
export function direcaoDoTrabalho(estado: GameState, u: Unidade): Direcao | null {
  const tarefa = u.fsmData.tarefa ? estado.jobs.tarefas.porId[u.fsmData.tarefa] : undefined;
  if (!tarefa) return null;
  const alvo = 'origemTile' in tarefa ? tarefa.origemTile
    : 'destinoTile' in tarefa ? tarefa.destinoTile
      : 'destino' in tarefa ? estado.predios.porId[tarefa.destino] : undefined;
  return alvo ? direcaoDoPasso(alvo.gx - u.gx, alvo.gy - u.gy, 8) : null;
}
