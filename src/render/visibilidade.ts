/**
 * BUG-X — quem a tela NAO desenha: o especialista dentro da casa
 * (docs/planos/2026-09-30-BUG-X-especialista-dentro-da-casa.md).
 *
 * A sim deixa o ocupante no tile da porta (a posicao logica, de onde ele sai para colher
 * ou comer), e a colisao ja o trata como dentro (`POSICAO_DO_ESTADO`, `sim/colisao.ts`).
 * So a tela o desenhava na porta. Aqui a tela le a MESMA classificacao, sem campo novo:
 *
 * - o ocupante de um predio completo, em estado `dentro` (ou esperando a porta para sair,
 *   `saindo`), nao se desenha. Laborer `martelando` tambem e `dentro`, mas nao e ocupante
 *   de predio: continua visivel no canteiro, a obra se ve trabalhar;
 * - `comendo` nao se desenha: no KaM ele anda visivel ate a Bodega e come la dentro
 *   (`KM_UnitTaskGoEat.pas:99-135`, `SetActionGoIn(gdGoInside, fInn)`);
 * - predio pausado (a casa fechada da F16c): o ocupante SE desenha. No KaM o trabalhador
 *   sai da casa fechada e fica visivel fora (`KM_Units.pas:529-600`,
 *   `ProceedHouseClosedForWorker`). Decisao do operador, 2026-10-01.
 *
 * Pura e sem Phaser: o teste afirma a tabela em Node. A camada de unidades esconde o
 * desenho e o acerto pula quem ela escondeu, para clique e desenho nao divergirem.
 */
import { ocupaTile } from '../sim/colisao';
import type { GameState, Unidade } from '../sim/state';

/** Os ocupantes de predio completo NAO pausado: os que podem estar dentro de casa. */
function ocupantesDeCasaAberta(state: GameState): Set<string> {
  const r = new Set<string>();
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p !== undefined && p.estado === 'completo' && !p.pausado && p.ocupante !== null) r.add(p.ocupante);
  }
  return r;
}

function visivel(u: Unidade, ocupantes: ReadonlySet<string>): boolean {
  if (u.fsm === 'comendo') return false;
  if (!ocupantes.has(u.id)) return true;
  return ocupaTile(u) && u.saindo === undefined;
}

/** Os ids que a tela nao desenha neste estado. Uma passada pelos predios por quadro. */
export function unidadesInvisiveis(state: GameState): ReadonlySet<string> {
  const ocupantes = ocupantesDeCasaAberta(state);
  const r = new Set<string>();
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u !== undefined && !visivel(u, ocupantes)) r.add(id);
  }
  return r;
}
