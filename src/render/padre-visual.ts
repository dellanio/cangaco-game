/**
 * I-ARTE-PADRE — os poderes do padre na tela (so tela; a regra e da sim, `sim/systems/padre.ts`). Puro e
 * sem Phaser: a cena desenha o que sai daqui. Os numeros sao de `data/padre-visual.json`.
 */
import type { GameState } from '../sim/state';
import { LADO_DO_JOGADOR } from '../sim/state';
import { abencoado, FSM_CONVERTENDO, ID_DO_PADRE } from '../sim/systems/padre';

export interface ConfigDoPadreVisual {
  readonly aura: { readonly cor: string; readonly alfa: number; readonly alfaMinimo: number; readonly espessuraPx: number; readonly pulsoTicks: number };
  readonly brilho: { readonly cor: string; readonly alfa: number; readonly raioPx: number };
  readonly facho: { readonly cor: string; readonly alfa: number; readonly espessuraPx: number };
  readonly clarao: { readonly cor: string; readonly alfa: number; readonly raioPx: number; readonly duracaoTicks: number };
}

export interface DesenhoDoPadre {
  /** O anel da bencao: o centro (tile do padre) e o raio em tiles, com o alfa do pulso. */
  readonly aneis: readonly { readonly padre: string; readonly gx: number; readonly gy: number; readonly raio: number; readonly alfa: number }[];
  /** O facho do padre que reza ao alvo, em tiles. */
  /** Os militares do jogador abencoados agora (a regra e a da sim, `abencoado`), com o alfa do pulso. */
  readonly abencoados: readonly { readonly unidade: string; readonly gx: number; readonly gy: number; readonly alfa: number }[];
  readonly fachos: readonly { readonly padre: string; readonly alvo: string; readonly de: { readonly gx: number; readonly gy: number }; readonly para: { readonly gx: number; readonly gy: number }; readonly alfa: number }[];
}

/** O alfa do pulso no instante `tempo` (tick + alfa): entre o minimo e o maximo, num seno. */
export function alfaDoPulso(tempo: number, minimo: number, maximo: number, periodo: number): number {
  const f = (1 + Math.sin((2 * Math.PI * tempo) / periodo)) / 2;
  return minimo + (maximo - minimo) * f;
}

/** O que desenhar dos padres do JOGADOR (a aura do inimigo nao se mostra: seria informacao de mais). */
export function desenhoDoPadre(estado: GameState, raio: number, tempo: number, config: ConfigDoPadreVisual): DesenhoDoPadre {
  const aneis: DesenhoDoPadre['aneis'][number][] = [];
  const fachos: DesenhoDoPadre['fachos'][number][] = [];
  const alfa = alfaDoPulso(tempo, config.aura.alfaMinimo, config.aura.alfa, config.aura.pulsoTicks);
  for (const id of estado.unidades.ordem) {
    const p = estado.unidades.porId[id];
    if (p === undefined || p.tipo !== ID_DO_PADRE || p.lado !== LADO_DO_JOGADOR) continue;
    aneis.push({ padre: id, gx: p.gx, gy: p.gy, raio, alfa });
    if (p.fsm === FSM_CONVERTENDO && p.fsmData.alvoUnidade !== undefined) {
      const alvo = estado.unidades.porId[p.fsmData.alvoUnidade];
      if (alvo !== undefined) {
        fachos.push({ padre: id, alvo: alvo.id, de: { gx: p.gx, gy: p.gy }, para: { gx: alvo.gx, gy: alvo.gy }, alfa: alfaDoPulso(tempo, config.facho.alfa * 0.4, config.facho.alfa, config.aura.pulsoTicks / 2) });
      }
    }
  }
  const abencoados: DesenhoDoPadre['abencoados'][number][] = [];
  if (aneis.length > 0) {
    const brilho = alfaDoPulso(tempo, config.brilho.alfa * 0.4, config.brilho.alfa, config.aura.pulsoTicks);
    for (const id of estado.unidades.ordem) {
      const u = estado.unidades.porId[id];
      if (u !== undefined && u.lado === LADO_DO_JOGADOR && abencoado(estado, u)) abencoados.push({ unidade: id, gx: u.gx, gy: u.gy, alfa: brilho });
    }
  }
  return { aneis, abencoados, fachos };
}
