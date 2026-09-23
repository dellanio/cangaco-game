/**
 * F14 — quem ocupa qual predio. Modulo irmao de `obra.ts` e `escola.ts`: so le
 * o estado e o dado, nao muta nada e NAO conhece o JobBoard — e por isso que
 * `reservas.ts` pode importa-lo sem fechar ciclo.
 *
 * A regra inteira vem de `data/buildings.json: trabalhador`: cada tipo de predio
 * declara UM tipo de civil que o ocupa, ou `null` (armazem, escola, quartel,
 * mercado). Nenhum id de profissao e digitado aqui.
 */
import type { GameData } from './data/types';
import { gameData } from './data';
import type { GameState, Predio, PredioCompleto } from './state';

/** O tipo de civil que ocupa `tipoDePredio`; `null` se o predio nao pede
 *  trabalhador — ou se o tipo nem existe no dado (save de outra versao). */
export function trabalhadorDoTipo(tipoDePredio: string, dados: GameData = gameData): string | null {
  return dados.predios.find((p) => p.id === tipoDePredio)?.trabalhador ?? null;
}

/** Um predio COMPLETO cujo tipo pede trabalhador. Estreita a uniao `Predio`,
 *  como `ehEscolaCompleta` (`sim/escola.ts`). */
export function ehPredioOcupavel(
  predio: Predio | undefined,
  dados: GameData = gameData,
): predio is PredioCompleto {
  return predio !== undefined && predio.estado === 'completo'
    && trabalhadorDoTipo(predio.tipo, dados) !== null;
}

/**
 * Quantos ocupantes o predio ainda aceita, ANTES de descontar reserva: 1 vago,
 * 0 ocupado ou nao ocupavel. O `1` NAO e numero de balanceamento: e a
 * cardinalidade do campo `ocupante: string | null` (ver `PredioCompleto`) — nao
 * ha dado para mexer, e dois ocupantes nao sao representaveis. Irma de
 * `vagaDeConstrucao`, cujo teto vem do dado justamente porque la a obra aceita
 * varios laborers.
 */
export function vagasDoPredio(predio: Predio | undefined, dados: GameData = gameData): number {
  if (!ehPredioOcupavel(predio, dados)) return 0;
  return predio.ocupante === null ? 1 : 0;
}

/** O predio aceita ESTE tipo de civil? (`quarry` aceita o `trabalhador` que o
 *  dado declara para ela, e mais ninguem.) */
export function predioAceita(
  predio: Predio | undefined,
  tipoDaUnidade: string,
  dados: GameData = gameData,
): boolean {
  return predio !== undefined && trabalhadorDoTipo(predio.tipo, dados) === tipoDaUnidade;
}

/**
 * O predio que `unidadeId` ocupa, ou `null`. Varre `predios.ordem` (nunca
 * `Object.keys`): a posse mora SO no predio, para nao haver duas fontes de
 * verdade que possam dessincronizar num save. Custo O(nº de predios), como as
 * consultas de `reservas.ts`.
 */
export function predioDoOcupante(state: GameState, unidadeId: string): PredioCompleto | null {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p !== undefined && p.estado === 'completo' && p.ocupante === unidadeId) return p;
  }
  return null;
}

/** Os tipos de civil que ocupam algum predio, segundo `buildings.json`. Serf e
 *  laborer NAO aparecem la — e o que os mantem fora do sistema dos
 *  especialistas, sem nenhuma lista de excecao em `.ts`. */
export function tiposQueOcupam(dados: GameData = gameData): ReadonlySet<string> {
  return new Set(
    dados.predios.map((p) => p.trabalhador).filter((t): t is string => t !== null),
  );
}
