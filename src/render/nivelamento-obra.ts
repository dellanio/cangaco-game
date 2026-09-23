/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem phaser), como
 * `estagio-obra.ts` (F11c) e `medidor-obra.ts` (F17b): quanto do terreno de uma
 * obra ja foi aplainado.
 *
 * O estado guarda `PredioEmObra.obra.nivelamento`, que sobe +1 por laborer por
 * tick com teto no alvo (`sim/systems/laborers.ts`); o alvo e `area do footprint
 * x construcao.ticksNivelamentoPorTile` (`sim/obra.ts`). Logo o numero de tiles
 * ja aplainados e `floor(nivelamento / ticksPorTile)`, e o resto da divisao e a
 * fracao do tile em curso. Nada disso e informacao nova: e a mesma informacao,
 * olhada com a lente da tela.
 *
 * `ticksPorTile` sai de `alvo / tilesTotais` em vez de virar um terceiro
 * parametro: assim os dois numeros que entram sao os dois que o resto do jogo ja
 * conhece, e nao ha como passar um trio inconsistente.
 *
 * A fracao do tile em curso sai QUANTIZADA EM OITAVOS, e e nessa forma que ela
 * entra na chave do diff da cena E no desenho. Se o desenho usasse a fracao
 * continua, existiria mudanca visivel que a chave nao ve — e o canteiro
 * congelaria na tela sem nenhum teste reprovar (armadilha medida na F17b).
 *
 * A F17d desenha isto de duas formas — tiles no mapa e `N/M` no painel. Uma
 * funcao so, de proposito: duas contas para o mesmo numero acabam divergindo.
 */
export interface CanteiroDaObra {
  /** Tiles do footprint ja aplainados. Nunca passa de `tilesTotais`. */
  readonly tilesProntos: number;
  /** Area do footprint, em tiles. */
  readonly tilesTotais: number;
  /** Fracao do tile em curso, em oitavos: 0..7. Vale 0 quando nao ha tile em curso. */
  readonly oitavosDoTileEmCurso: number;
  /** Terreno inteiro aplainado: a obra ja pode receber material. */
  readonly nivelada: boolean;
}

const OITAVOS = 8;

export function canteiroDaObra(
  nivelamento: number, alvo: number, tilesTotais: number,
): CanteiroDaObra {
  const tiles = Math.max(0, Math.floor(tilesTotais));
  // Tipo sem footprint ou sem alvo cai no placeholder do §9: sem terreno para
  // aplainar, nada a esperar. `nivelada: true` e o que mantem o medidor de
  // material aceso em vez de esmaecido para sempre.
  if (tiles <= 0 || alvo <= 0) {
    return { tilesProntos: 0, tilesTotais: tiles, oitavosDoTileEmCurso: 0, nivelada: true };
  }
  // O estado ja tem teto no alvo (`laborers.ts`); o piso e o teto aqui existem
  // porque o dado pode mudar entre um save e outro, e um `nivelamento` fora da
  // faixa viraria tile negativo ou canteiro maior que o predio.
  const feito = Math.min(Math.max(0, nivelamento), alvo);
  const ticksPorTile = alvo / tiles;
  const prontos = Math.min(tiles, Math.floor(feito / ticksPorTile));
  const nivelada = prontos >= tiles;
  const resto = feito - prontos * ticksPorTile;
  const oitavos = nivelada
    ? 0
    : Math.min(OITAVOS - 1, Math.floor((resto / ticksPorTile) * OITAVOS));
  return { tilesProntos: prontos, tilesTotais: tiles, oitavosDoTileEmCurso: oitavos, nivelada };
}

/**
 * A leitura do canteiro reduzida a uma string, para a chave do diff de
 * `atualizarPredios`. `null` (predio completo, sem canteiro) da string vazia.
 *
 * Carrega EXATAMENTE os campos que o desenho usa. E o que torna "mesma chave
 * implica mesmo desenho" verdade por construcao, e nao por disciplina.
 */
export function chaveDoCanteiro(canteiro: CanteiroDaObra | null): string {
  if (canteiro === null) return '';
  return `${canteiro.tilesProntos}/${canteiro.tilesTotais}:${canteiro.oitavosDoTileEmCurso}`;
}
