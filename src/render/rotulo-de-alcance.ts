/**
 * F-TA — A FRASE do que ha ao alcance, em UM lugar.
 *
 * Nasceu dentro de `alcance-de-colheita.ts` na F-TP, para a planta fantasma.
 * Saiu para ca quando o painel do predio (F-TA) passou a escrever a mesma
 * informacao: painel e previa dizendo a mesma coisa com duas frases diferentes
 * seria a tela sugerindo que sao dois numeros, e o aceite da F-TA pede
 * justamente o contrario. `alcance-de-colheita.ts` reexporta as duas funcoes,
 * entao quem ja as importava de la continua funcionando.
 *
 * Este arquivo le SO o tema. Nem phaser, nem `sim/data`, nem `sim/` — e o que
 * permite `ui/painel-predio.ts` importa-lo sem furar a regra dos funis
 * (`tests/F04-grid-ortogonal.test.ts`): `ui/` nao le `sim/data`, e
 * `alcance-de-colheita.ts` le, por `render/mapa.ts`.
 */
import temaSertao from '../../data/theme-sertao.json';

const TEMA = temaSertao.plantaFantasma;

/** O nome que o jogador le, pelo id NEUTRO. Recurso sem nome no tema reprova
 *  aqui (CLAUDE.md §9): frase com o nome de OUTRO recurso e pior que frase
 *  nenhuma. */
export function nomeDoRecurso(recurso: string): string {
  const nomes = TEMA.recursos as Readonly<Record<string, string | undefined>>;
  const nome = nomes[recurso];
  if (typeof nome !== 'string') {
    throw new Error(`render/rotulo-de-alcance: theme-sertao.json nao tem nome para o recurso '${recurso}'.`);
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
