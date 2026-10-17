/**
 * I-TELA-LENHADOR-CORTA-E-DERRUBA (pedido do operador, 2026-10-16) — o corte da arvore na tela, lido do estado. So
 * apresentacao: a sim nao muda. A arvore rende `rendimento` troncos e a sim so a desconta no deposito, em casa (F-T2c);
 * daqui sai a arvore que cai no fim do PRIMEIRO corte e fica deitada, encolhendo a cada tronco levado, ate o toco.
 */
import type { GameState, Unidade } from '../sim/state';

export type ArvoreNaTela =
  | { readonly tipo: 'em-pe' }
  | { readonly tipo: 'caida'; readonly troncos: number }
  | { readonly tipo: 'toco' };

/**
 * Como a arvore aparece: em pe ate o primeiro tronco sair dela; depois, deitada, com os troncos que ainda estao nela
 * (os do estado menos o que esta a caminho de casa nas maos do lenhador); sem nenhum, o toco.
 */
export function arvoreNaTela(quantidade: number, rendimento: number, aCaminho: number): ArvoreNaTela {
  const naArvore = quantidade - aCaminho;
  if (naArvore <= 0) return { tipo: 'toco' };
  if (quantidade >= rendimento && aCaminho === 0) return { tipo: 'em-pe' };
  return { tipo: 'caida', troncos: Math.min(rendimento, naArvore) };
}

/** Quantos lenhadores voltam para casa com um tronco desta arvore (o tile em `gx,gy`). */
export function troncosACaminho(estado: GameState, chave: string): number {
  let n = 0;
  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (u === undefined || u.fsm !== 'voltando' || u.fsmData.tarefa === undefined) continue;
    const t = estado.jobs.tarefas.porId[u.fsmData.tarefa];
    if (t?.tipo === 'colher' && 'origemTile' in t && `${t.origemTile.gx},${t.origemTile.gy}` === chave
      && estado.recursos[chave]?.tipo === 'tree') n++;
  }
  return n;
}

/** O tile da arvore que o lenhador esta cortando, ou `null`. */
export function arvoreQueCorta(estado: GameState, u: Pick<Unidade, 'tipo' | 'fsm' | 'fsmData'>): { readonly gx: number; readonly gy: number } | null {
  if (u.fsm !== 'colhendo' || u.fsmData.tarefa === undefined) return null;
  const t = estado.jobs.tarefas.porId[u.fsmData.tarefa];
  if (t?.tipo !== 'colher' || !('origemTile' in t)) return null;
  return estado.recursos[`${t.origemTile.gx},${t.origemTile.gy}`]?.tipo === 'tree' ? t.origemTile : null;
}

/**
 * Quanto o desenho do lenhador anda, em tiles, para ficar a `distancia` tile do pe da arvore (o meio da borda de baixo
 * do tile dela, onde a arte poe o tronco), vindo do meio do tile dele.
 */
export function pertoDoTronco(
  unidade: { readonly gx: number; readonly gy: number }, arvore: { readonly gx: number; readonly gy: number }, distancia: number,
): { readonly dx: number; readonly dy: number } {
  const de = { x: unidade.gx + 0.5, y: unidade.gy + 0.5 };
  const pe = { x: arvore.gx + 0.5, y: arvore.gy + 1 };
  const vx = de.x - pe.x, vy = de.y - pe.y;
  const d = Math.hypot(vx, vy);
  if (d <= distancia) return { dx: 0, dy: 0 };
  return { dx: pe.x + (vx / d) * distancia - de.x, dy: pe.y + (vy / d) * distancia - de.y };
}

/** O quadro corrente e um golpe do machado (o quadro em que ele bate no tronco), e o anterior nao era. */
export function entrouNoGolpe(anterior: number | null, quadro: number, golpes: readonly number[]): boolean {
  return golpes.includes(quadro) && anterior !== quadro;
}
