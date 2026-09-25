/**
 * F-TP — O QUE A PLANTA FANTASMA PROMETE, antes do clique.
 *
 * Puro e sem Phaser: recebe (tipo de predio, tile) e devolve o que desenhar, ou
 * `null` quando aquele predio nao colhe nada. Quem desenha e
 * `render/planta-fantasma.ts`; quem testa headless e este arquivo.
 *
 * REGRA DA CLASSE, nao da Quarry. Nenhum id de predio e nenhum id de recurso
 * esta digitado aqui: o gatilho e ter `colheita` na receita
 * (`data/production.json`), o alcance e o recurso saem do dado e a cor sai do
 * tema. Predio novo com `colheita` ganha a previa sem uma linha de codigo — o
 * lenhador, o roceiro, o pescador e o mineiro herdam isto quando chegarem, e
 * `tests/F-TP-alcance-previa.test.ts` prova com um tipo FABRICADO em vez de
 * varrer este fonte atras de nome.
 *
 * O numero NAO e recalculado aqui: `colheitaAoAlcanceDaCaixa` e a mesma funcao
 * que `disponivelAoAlcance` usa dentro da simulacao. Segunda copia da regra
 * faria a previa e o predio discordarem, que e o defeito que esta feature
 * existe para nao criar.
 *
 * E previa, nao recusa: plantar longe do recurso e escolha legitima do jogador
 * (decisao do operador no item). Zero ao alcance mostra zero, e `canPlace`
 * segue sendo quem diz sim ou nao.
 */
import type { GameData } from '../sim/data/types';
import type { GameState } from '../sim/state';
import type { CaixaEmTiles } from '../sim/footprint';
import { receitaDoTipo } from '../sim/producao';
import { colheitaAoAlcanceDaCaixa } from '../sim/recursos';
import { recursosDeRender } from './mapa';
import type { RecursosDeRender } from './mapa';
import { caixaDeTipoNoMapa } from './predios';
import { rotuloDoAlcance } from './rotulo-de-alcance';

export interface PreviaDeAlcance {
  /** O id NEUTRO do recurso (`rock`), nao o nome do jogador. */
  readonly recurso: string;
  /** A caixa do predio JA expandida pelo alcance, em tiles, meio-aberta em
   *  `x1`/`y1` como toda `CaixaEmTiles`. E o retangulo a desenhar. */
  readonly moldura: CaixaEmTiles;
  /** Tiles ao alcance que AINDA tem o que colher. */
  readonly tiles: number;
  /** Quanto isso da somado. */
  readonly unidades: number;
  /** A cor do recurso, `#rrggbb`, do tema — a mesma do marcador no chao. */
  readonly cor: string;
  /** A frase do jogador, ja montada. */
  readonly rotulo: string;
}

/** A cor de um recurso pelo id neutro. Reusa a tabela do marcador de chao
 *  (`render/mapa.ts`): moldura de uma cor e marcador de outra seria a tela
 *  dizendo que sao coisas diferentes. */
export function corDoRecurso(
  recurso: string, config: RecursosDeRender = recursosDeRender,
): string {
  const indice = config.tipos.indexOf(recurso);
  const cor = indice < 0 ? undefined : config.cores[indice + 1];
  if (cor === undefined) {
    throw new Error(`render/alcance-de-colheita: sem cor para o recurso '${recurso}'.`);
  }
  return cor;
}

/** F-TA — o nome e a frase saem daqui, de `rotulo-de-alcance.ts`, que le so o
 *  tema. A reexportacao existe porque o painel do predio precisa da MESMA frase
 *  e nao pode importar este arquivo (ele le `sim/data` pelo funil
 *  `render/mapa.ts`, e `ui/` nao le `sim/data`). Quem ja importava daqui
 *  continua importando daqui. */
export { nomeDoRecurso, rotuloDoAlcance } from './rotulo-de-alcance';

/** `dados` e OPCIONAL e repassado como veio: `undefined` cai no default de cada
 *  funcao de `sim/`, que ja e o `gameData` congelado. E o que deixa o teste
 *  injetar uma variante sem que este arquivo vire um terceiro funil para
 *  `sim/data` — a lista de funis em `tests/F04-grid-ortogonal.test.ts` e fechada
 *  de proposito, e render que le dado por conta propria e o que ela impede. */
export function previaDeAlcance(
  estado: GameState, tipo: string, gx: number, gy: number, dados?: GameData,
): PreviaDeAlcance | null {
  const colheita = receitaDoTipo(tipo, dados)?.colheita ?? null;
  if (colheita === null) return null;
  const caixa = caixaDeTipoNoMapa(tipo, gx, gy, dados);
  if (caixa === null) return null;
  const { tiles, unidades } = colheitaAoAlcanceDaCaixa(estado, caixa, colheita, dados);
  const alcance = colheita.alcance;
  return {
    recurso: colheita.recurso,
    moldura: {
      x0: caixa.x0 - alcance, y0: caixa.y0 - alcance,
      x1: caixa.x1 + alcance, y1: caixa.y1 + alcance,
    },
    tiles,
    unidades,
    cor: corDoRecurso(colheita.recurso),
    rotulo: rotuloDoAlcance(colheita.recurso, tiles, unidades),
  };
}
