/**
 * As grandezas derivadas de uma obra em construcao (F11c). Nada aqui e
 * guardado no estado alem do que `Obra` ja expoe (`faltam`, `nivelamento`) —
 * o alvo de nivelamento, o entregue e o teto de HP sao calculados a partir do
 * dado e do estado atual, para nao haver uma segunda fonte de verdade quando
 * `data/buildings.json` mudar (CLAUDE.md §2.3).
 */
import type { GameState, PredioEmObra } from './state';
import type { GameData, PredioData } from './data/types';
import { gameData } from './data';
import { caixaDeTipo } from './footprint';

/** O custo em materiais de um tipo de predio, lido de `buildings.json`. Um
 *  ponto so: o menu Build (F06), a obra (F07) e a F11c leem por aqui. */
export function custoDoPredio(def: PredioData): { readonly timber: number; readonly stone: number } {
  return { timber: def.timber, stone: def.stone };
}

function defDoTipo(tipo: string, dados: GameData): PredioData {
  const def = dados.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`obra.ts: tipo de predio '${tipo}' nao existe em data/buildings.json`);
  return def;
}

/** Ticks de nivelamento que uma obra do tipo `tipo` precisa acumular: area do
 *  footprint x `construcao.ticksNivelamentoPorTile`. A translacao nao importa
 *  para a area — usa (0,0) so para ter uma caixa. */
export function alvoDeNivelamento(tipo: string, dados: GameData = gameData): number {
  const caixa = caixaDeTipo(tipo, 0, 0, dados);
  if (!caixa) throw new Error(`alvoDeNivelamento: tipo '${tipo}' sem footprint em buildings.json`);
  const area = (caixa.x1 - caixa.x0) * (caixa.y1 - caixa.y0);
  return area * dados.construcao.ticksNivelamentoPorTile;
}

/** A obra terminou de nivelar: `nivelamento` (monotonico, nunca decresce)
 *  atingiu o alvo do tipo. */
export function obraNivelada(predio: PredioEmObra, dados: GameData = gameData): boolean {
  return predio.obra.nivelamento >= alvoDeNivelamento(predio.tipo, dados);
}

/** Unidades de material JA ENTREGUES, somadas sobre as mercadorias do custo:
 *  `custo[m] - faltam[m]`. Derivado, nunca guardado (comentario de `Obra`,
 *  `state.ts`). */
export function entreguesNaObra(predio: PredioEmObra, dados: GameData = gameData): number {
  const custo = custoDoPredio(defDoTipo(predio.tipo, dados));
  let soma = 0;
  for (const [mercadoria, quantidade] of Object.entries(custo)) {
    soma += quantidade - (predio.obra.faltam[mercadoria] ?? 0);
  }
  return soma;
}

/** O HP total do tipo — o que o predio COMPLETO tem. */
export function hpTotalDoTipo(tipo: string, dados: GameData = gameData): number {
  return defDoTipo(tipo, dados).hp;
}

/** O teto de HP martelavel com o que ja foi entregue: `entregues *
 *  hpPorMaterialEntregue`, nunca passando do HP total do tipo. */
export function tetoDeHp(predio: PredioEmObra, dados: GameData = gameData): number {
  const teto = entreguesNaObra(predio, dados) * dados.construcao.hpPorMaterialEntregue;
  return Math.min(teto, hpTotalDoTipo(predio.tipo, dados));
}

/** Existe tarefa de MATERIAL para esta obra, em qualquer estado que ainda
 *  conte como "a caminho" ('aberta', 'reclamada' ou 'carregando' — as tres
 *  que `TarefaMaterialParaObra.estado` admite). */
function existeTarefaDeMaterial(state: GameState, predioId: string): boolean {
  return state.jobs.tarefas.ordem.some((id) => {
    const t = state.jobs.tarefas.porId[id];
    return t !== undefined && t.tipo === 'material-para-obra' && t.destino === predioId;
  });
}

/**
 * Ha algo que um laborer possa fazer nesta obra agora? Sem esta regra, uma
 * obra que espera material que nunca vai chegar (sem estoque, sem estrada)
 * prende o laborer em `esperando_material` para sempre — e a obra vizinha,
 * que teria material, nunca e nivelada, porque o portao de `gerarTarefas`
 * (Task 6) exige nivelamento. A partida trava em silencio. Decisao do
 * operador (aprovacao do plano F11c): nao e balanceamento, e regra.
 *
 * Uma clausula por motivo legitimo de permanecer: falta nivelar, falta
 * martelar (ja ha o que martelar com o que foi entregue), ou ha material a
 * caminho. Se nenhuma vale, nao ha nada que o laborer possa fazer ali.
 */
export function obraTrabalhavel(state: GameState, predioId: string, dados: GameData = gameData): boolean {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'obra') return false;
  if (!obraNivelada(predio, dados)) return true;
  if (predio.hp < tetoDeHp(predio, dados)) return true;
  return existeTarefaDeMaterial(state, predioId);
}
