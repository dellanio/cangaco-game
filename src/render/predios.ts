/**
 * Segundo funil de `render/` para `gameData` (o primeiro e `mapa.ts`). A cena
 * precisa do footprint e do nome que o jogador le por tipo de predio; nenhum
 * outro arquivo de `render/` importa `../sim/data` — teste estrutural em
 * `tests/F04-grid-ortogonal.test.ts`.
 */
import { gameData } from '../sim/data';
import type { GameData } from '../sim/data/types';
import { alvoDeNivelamento, custoDoPredio } from '../sim/obra';
import type { CaixaEmTiles } from '../sim/footprint';
import { caixaDeTipo } from '../sim/footprint';
import temaSertao from '../../data/theme-sertao.json';

export interface AparenciaDoPredio {
  readonly largura: number; // em tiles
  readonly altura: number; // em tiles
  readonly nome: string; // o que o jogador le, vindo do tema
  readonly hpTotal: number; // F11c: os tres estagios da obra (estagio-obra.ts) precisam do teto
  /** F17b: o custo em material, do dado. O medidor da obra desenha
   *  `custo - faltam`; sem isto a cena nao tem o denominador. */
  readonly custo: Readonly<Record<string, number>>;
  /** F17d: `area do footprint x ticksNivelamentoPorTile`, do dado. O canteiro
   *  desenha `nivelamento / (alvo / tiles)`; sem isto a cena nao tem o
   *  denominador. Vale 0 no placeholder de tipo desconhecido. */
  readonly alvoDeNivelamento: number;
}

/** F17b: a ordem canonica das mercadorias, reexportada do funil para quem em
 *  `render/` nao pode importar `sim/data` (teste estrutural em
 *  `tests/F04-grid-ortogonal.test.ts`). Nao e copia: e a mesma lista. */
export const ordemDasMercadorias: readonly string[] = gameData.economia.mercadorias;

/**
 * F-TP: o retangulo em tiles de um TIPO posto em (gx, gy). Mesma razao de
 * `ordemDasMercadorias` — quem em `render/` nao pode importar `sim/data` pega o
 * dado pelo funil, e footprint por tipo de predio e exatamente o que este funil
 * existe para servir. Nao e copia da conta: chama `sim/footprint`, que e a mesma
 * funcao que `canPlace` e a colheita usam.
 *
 * `dados` explicito para o teste poder injetar uma variante; `undefined` cai no
 * `gameData` congelado, como em `sim/`.
 */
export function caixaDeTipoNoMapa(
  tipo: string, gx: number, gy: number, dados: GameData = gameData,
): CaixaEmTiles | null {
  return caixaDeTipo(tipo, gx, gy, dados);
}

type TemaDePredios = Readonly<Record<string, { readonly nome: string } | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;

function construirAparencias(): Readonly<Record<string, AparenciaDoPredio>> {
  const porTipo: Record<string, AparenciaDoPredio> = {};
  for (const p of gameData.predios) {
    const [largura, altura] = p.tamanho;
    if (largura === undefined || altura === undefined) continue;
    porTipo[p.id] = {
      largura, altura, nome: temaDePredios[p.id]?.nome ?? p.id, hpTotal: p.hp,
      custo: custoDoPredio(p),
      alvoDeNivelamento: alvoDeNivelamento(p.id),
    };
  }
  return porTipo;
}

const aparencias = construirAparencias();

/** Tipo sem entrada no dado ou no tema cai no id neutro, footprint 1x1:
 *  placeholder e comportamento normal (CLAUDE.md §9), o jogo nao quebra por
 *  falta de arte ou de nome. */
export function aparenciaDoPredio(tipo: string): AparenciaDoPredio {
  return aparencias[tipo]
    ?? { largura: 1, altura: 1, nome: tipo, hpTotal: 0, custo: {}, alvoDeNivelamento: 0 };
}
