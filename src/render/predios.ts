/**
 * Segundo funil de `render/` para `gameData` (o primeiro e `mapa.ts`). A cena
 * precisa do footprint e do nome que o jogador le por tipo de predio; nenhum
 * outro arquivo de `render/` importa `../sim/data` — teste estrutural em
 * `tests/F04-grid-ortogonal.test.ts`.
 */
import { gameData } from '../sim/data';
import { custoDoPredio } from '../sim/obra';
import temaSertao from '../../data/theme-sertao.json';

export interface AparenciaDoPredio {
  readonly largura: number; // em tiles
  readonly altura: number; // em tiles
  readonly nome: string; // o que o jogador le, vindo do tema
  readonly hpTotal: number; // F11c: os tres estagios da obra (estagio-obra.ts) precisam do teto
  /** F17b: o custo em material, do dado. O medidor da obra desenha
   *  `custo - faltam`; sem isto a cena nao tem o denominador. */
  readonly custo: Readonly<Record<string, number>>;
}

/** F17b: a ordem canonica das mercadorias, reexportada do funil para quem em
 *  `render/` nao pode importar `sim/data` (teste estrutural em
 *  `tests/F04-grid-ortogonal.test.ts`). Nao e copia: e a mesma lista. */
export const ordemDasMercadorias: readonly string[] = gameData.economia.mercadorias;

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
    };
  }
  return porTipo;
}

const aparencias = construirAparencias();

/** Tipo sem entrada no dado ou no tema cai no id neutro, footprint 1x1:
 *  placeholder e comportamento normal (CLAUDE.md §9), o jogo nao quebra por
 *  falta de arte ou de nome. */
export function aparenciaDoPredio(tipo: string): AparenciaDoPredio {
  return aparencias[tipo] ?? { largura: 1, altura: 1, nome: tipo, hpTotal: 0, custo: {} };
}
