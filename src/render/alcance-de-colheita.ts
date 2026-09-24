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
import temaSertao from '../../data/theme-sertao.json';
import type { GameData } from '../sim/data/types';
import type { GameState } from '../sim/state';
import type { CaixaEmTiles } from '../sim/footprint';
import { receitaDoTipo } from '../sim/producao';
import { colheitaAoAlcanceDaCaixa } from '../sim/recursos';
import { recursosDeRender } from './mapa';
import type { RecursosDeRender } from './mapa';
import { caixaDeTipoNoMapa } from './predios';

const TEMA = temaSertao.plantaFantasma;

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

/** O nome que o jogador le. Pelo mesmo criterio da cor (CLAUDE.md §9): recurso
 *  sem nome no tema reprova aqui, porque previa com o nome de OUTRO recurso e
 *  pior que previa nenhuma. */
export function nomeDoRecurso(recurso: string): string {
  const nomes = TEMA.recursos as Readonly<Record<string, string | undefined>>;
  const nome = nomes[recurso];
  if (typeof nome !== 'string') {
    throw new Error(`render/alcance-de-colheita: theme-sertao.json nao tem nome para o recurso '${recurso}'.`);
  }
  return nome;
}

/** O molde vem do tema; so os numeros e o nome entram. Zero ao alcance tem
 *  frase propria: "0 (0)" e ruido, e o que o jogador precisa ler e que ali nao
 *  ha nada — sem que isso seja uma recusa. */
export function rotuloDoAlcance(recurso: string, tiles: number, unidades: number): string {
  const nome = nomeDoRecurso(recurso);
  if (tiles === 0) return TEMA.vazio.replace('{recurso}', nome);
  return TEMA.alcance
    .replace('{recurso}', nome)
    .replace('{n}', String(tiles))
    .replace('{u}', String(unidades));
}

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
