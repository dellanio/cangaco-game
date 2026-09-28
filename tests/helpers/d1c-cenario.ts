/**
 * D1c — o cenario do aceite da colisao civil (plano em docs/planos/2026-09-28-D1-colisao-civil.md,
 * secao 8). Um armazem com tronco de sobra e SEIS serrarias completas e ocupadas, lado a lado,
 * as portas numa linha de rua; 16 serfs em tiles distintos. O tronco vai do armazem as
 * serrarias e a madeira volta: dois fluxos, sem terreno no meio.
 *
 * `ruas`:
 *  - 1: uma rua de uma faixa, que toca UM tile de porta do armazem;
 *  - 2: a mesma rua, mais uma SEGUNDA ROTA disjunta, uma linha abaixo com um tile de folga,
 *    que sai de OUTRO tile de porta do armazem e volta a linha das serrarias na outra ponta.
 * Nenhuma coordenada e digitada: o lugar sai de uma varredura por uma area aberta.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import { createInitialState, LADO_DO_JOGADOR } from '../../src/sim/state';
import type { GameState, PredioCompleto, Unidade } from '../../src/sim/state';
import { tileAndavel } from '../../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';
import { condicaoCheiaDoTipo } from '../../src/sim/condicao';
import { comArmazemExtra, comProdutorOcupado } from './producao-cenario';
import { naVila } from './ancoras';

export const SERRARIAS = 6;
export const SERFS = 16;
const LARGURA_DA_SERRARIA = 4;
const TRONCO_NO_ARMAZEM = 400;

/** O canto de uma area aberta de `largura` x `altura`, andavel inteira, varrendo a partir da vila. */
function areaAberta(s: GameState, largura: number, altura: number): TileDeGrid {
  for (let r = 6; r < 50; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = 0; dy < altura && livre; dy += 1) {
        for (let dx = 0; dx < largura && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      }
      if (livre) return c;
    }
  }
  throw new Error('d1c: sem area aberta');
}

export interface CenarioD1c {
  readonly estado: GameState;
  readonly serrarias: readonly string[];
  readonly armazem: string;
}

export function cenarioD1c(ruas: 1 | 2, dados: GameData = gameData): CenarioD1c {
  let s: GameState = { ...createInitialState(1, dados), unidades: { porId: {}, ordem: [] } };
  // armazem 3x3 a oeste, 12 tiles de rua ate a primeira serraria; a area cobre as duas rotas
  const larguraDasSerrarias = SERRARIAS * LARGURA_DA_SERRARIA;
  const o = areaAberta(s, 3 + 12 + larguraDasSerrarias + 2, 8);
  const x0 = o.gx + 1;
  const yPorta = o.gy + 3; // borda sul do armazem 3x3 em (x0, o.gy)
  s = comArmazemExtra(s, 'arm', x0, o.gy, dados);
  const xS = x0 + 3 + 12;
  const serrarias: string[] = [];
  for (let k = 0; k < SERRARIAS; k += 1) {
    const id = `serraria-${k}`;
    s = comProdutorOcupado(s, { tipo: 'sawmill', id, unidade: `carp-${k}`, gx: xS + k * LARGURA_DA_SERRARIA, gy: yPorta - 2 }, dados);
    serrarias.push(id);
  }
  const xFim = xS + larguraDasSerrarias - 1;
  const rua: TileDeGrid[] = [];
  for (let x = x0 + 2; x <= xFim; x += 1) rua.push({ gx: x, gy: yPorta });
  if (ruas === 2) {
    // a segunda rota: sai do tile de porta x0, desce duas linhas, corre a leste e sobe na ponta
    rua.push({ gx: x0, gy: yPorta }, { gx: x0, gy: yPorta + 1 });
    for (let x = x0; x <= xFim; x += 1) rua.push({ gx: x, gy: yPorta + 2 });
    rua.push({ gx: xFim, gy: yPorta + 1 });
  }
  s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries(rua.map((t) => [chaveDeTile(t), true as const])) } };
  const arm = s.predios.porId['arm'] as PredioCompleto;
  s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, arm: { ...arm, estoque: { ...arm.estoque, saida: { ...arm.estoque.saida, tree_trunk: TRONCO_NO_ARMAZEM } } } } } };
  for (const id of [...serrarias, 'arm']) {
    if (!predioLigadoAoArmazem(s, s.predios.porId[id] as PredioCompleto, dados)) throw new Error(`d1c: '${id}' nao ligado`);
  }
  // 16 serfs em tiles distintos, fora da rua, em duas linhas acima dela entre o armazem e as serrarias
  const unidades = { porId: { ...s.unidades.porId }, ordem: [...s.unidades.ordem] };
  for (let i = 0; i < SERFS; i += 1) {
    const t = { gx: x0 + 4 + (i % 8), gy: yPorta - 1 - Math.floor(i / 8) };
    if (!tileAndavel(s, t, 'livre', dados)) throw new Error(`d1c: serf ${i} em tile inandavel`);
    const u: Unidade = { lado: LADO_DO_JOGADOR, id: `serf-d1c-${i}`, tipo: 'serf', ...t, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('serf') };
    unidades.porId[u.id] = u;
    unidades.ordem.push(u.id);
  }
  return { estado: { ...s, unidades }, serrarias, armazem: 'arm' };
}
