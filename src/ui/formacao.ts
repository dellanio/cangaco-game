// C-COMBATE-01c (plano em docs/planos/2026-09-29-C-COMBATE-01c-controles-de-formacao.md) — o
// que os controles de formacao MANDAM: +/− colunas, a direcao do arrasto do botao direito e a
// investida (storm). Puro: le o estado, devolve comando ou numero; quem envia e o `main.ts` e
// o painel do grupo. Nao importa phaser, nao muta GameState (CLAUDE.md §3).
import type { Command } from '../sim/commands';
import type { GameData } from '../sim/data/types';
import type { GameState } from '../sim/state';
import { direcaoAproximada, direcaoDe } from '../sim/combate';
import { carregaNaInvestida, emCargaIncontrolavel } from '../sim/carga';
import { colunasDaFormacao } from '../sim/systems/marcha';
import { LIMIAR_DA_CAIXA_PX } from '../input/colocar';
import type { PontoNoMundo } from '../input/colocar';

/** A direcao (0..7) do arrasto do botao direito, de `de` a `ate` em px de mundo; `null`
 *  abaixo do limiar da caixa (o clique curto nao escolhe direcao). */
export function direcaoDoArrasto(de: PontoNoMundo, ate: PontoNoMundo | null): number | null {
  if (ate === null) return null;
  const dx = ate.x - de.x;
  const dy = ate.y - de.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < LIMIAR_DA_CAIXA_PX) return null;
  return direcaoAproximada({ gx: 0, gy: 0 }, { gx: dx, gy: dy });
}

/** As colunas que o grupo de `n` usa: as guardadas pela tela, ou a padrao da sim. */
export function colunasAtuais(guardadas: number | null, n: number, dados: GameData): number {
  return colunasDaFormacao(guardadas ?? undefined, n, dados);
}

/** +1 / −1 coluna, preso no mesmo intervalo que a sim prende (`colunasDaFormacao`). */
export function colunasAjustadas(guardadas: number | null, delta: number, n: number, dados: GameData): number {
  return colunasDaFormacao(colunasAtuais(guardadas, n, dados) + delta, n, dados);
}

/** O grupo sem quem esta em carga incontrolavel: a ordem nao pega nele (C-COMBATE-01b), e a
 *  tela nao finge que pegou. */
export function quemAceitaOrdem(estado: GameState, grupo: readonly string[], dados: GameData): string[] {
  return grupo.filter((id) => !emCargaIncontrolavel(estado.unidades.porId[id], dados));
}

/** Refazer a formacao sem sair do lugar: `MoveUnits` com o destino no tile do lider, a
 *  direcao dele (a frente nao muda) e `colunas`. `null` sem ninguem que aceite ordem. */
export function ordemDeFormacao(
  estado: GameState, grupo: readonly string[], colunas: number, dados: GameData,
): Command | null {
  const unidades = quemAceitaOrdem(estado, grupo, dados);
  const lider = estado.unidades.porId[unidades[0] ?? ''];
  if (lider === undefined) return null;
  return { type: 'MoveUnits', unidades, destino: { gx: lider.gx, gy: lider.gy }, direcao: direcaoDe(lider), colunas };
}

/** Alguem do grupo pode investir agora? E o que habilita o botao. */
export function podeCarregar(estado: GameState, grupo: readonly string[], dados: GameData): boolean {
  return quemAceitaOrdem(estado, grupo, dados).some((id) => {
    const u = estado.unidades.porId[id];
    return u !== undefined && carregaNaInvestida(u.tipo, dados);
  });
}
