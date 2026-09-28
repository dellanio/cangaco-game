/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem Phaser): os SEIS
 * estagios visuais de um predio — cinco em obra mais o de pe. Ate a F17d eram
 * tres (`marcacao`, `madeira`, `completo`); a decisao de tres foi minha e estava
 * errada (BUILD_PLAN, Nota de correcao de aceite da F17e). O PROGRESS da F11c ja
 * registrava a saida: "a mesma funcao pura pode dividir a fase do meio pela
 * fracao de `hp`". E o que esta feito aqui.
 *
 * As tres entradas sao as unicas que existem: `hp`, `hpTotal` e o "ja nivelou"
 * que a F17d passou a calcular (`render/nivelamento-obra.ts`). Nenhuma delas e
 * dado novo — a fronteira `marcacao`/`fundacao` e a unica que olha o terreno.
 *
 * F17g (decisao do operador, 2026-09-26): a obra de um predio com o PAR no
 * manifesto (`madeira` e `completo`) deixa de pular de estagio e passa a ser
 * REVELADA pelo `hp` (`revelacaoDaObra`, no fim do arquivo). Os seis estagios
 * continuam aqui como o desenho de quem nao tem o par — hoje, 27 dos 28 predios.
 */
export type EstagioDaObra =
  | 'marcacao'
  | 'fundacao'
  | 'estrutura'
  | 'paredes'
  | 'cobertura'
  | 'completo';

/** Um estagio de OBRA: qualquer um menos o predio de pe. */
export type EstagioEmObra = Exclude<EstagioDaObra, 'completo'>;

/**
 * A ordem em que a obra sobe. Uma lista so, e dela saem a monotonicidade do
 * teste e a contagem do debug — duas listas paralelas e como elas divergem.
 */
export const ORDEM_DOS_ESTAGIOS: readonly EstagioDaObra[] = [
  'marcacao', 'fundacao', 'estrutura', 'paredes', 'cobertura', 'completo',
];

/**
 * As duas fronteiras do meio, em PARTES inteiras do HP total. Sao constantes de
 * DESENHO, nao balanceamento (decisao do operador, 2026-09-23): um jogador nao
 * distingue fronteira em 1/3 de fronteira em 0,35 — distingue a casa subindo.
 * Por isso ficam aqui e nao em `data/`; a guarda estrutural deste arquivo (zero
 * imports) nem deixaria ele ler `data/`. Se um dia virarem dado, passam pelo
 * funil `render/predios.ts`, como o custo e o alvo de nivelamento.
 *
 * INTEIRAS de proposito: `hp * PARTES <= hpTotal` e nunca `hp / hpTotal <= 1/3`.
 * A `barracks` tem 600 de HP e a fronteira cai exatamente em 200 — comparacao de
 * float ali e sorteio.
 */
const PARTES = 3;
const PARTES_ATE_ESTRUTURA = 1;
const PARTES_ATE_PAREDES = 2;

export function estagioDaObra(hp: number, hpTotal: number, nivelada: boolean): EstagioDaObra {
  if (hp >= hpTotal) return 'completo';
  if (hp <= 0) return nivelada ? 'fundacao' : 'marcacao';
  if (hp * PARTES <= hpTotal * PARTES_ATE_ESTRUTURA) return 'estrutura';
  if (hp * PARTES <= hpTotal * PARTES_ATE_PAREDES) return 'paredes';
  return 'cobertura';
}

/**
 * BUG-N2 — o estagio que a TELA desenha para um predio. O completo e SEMPRE `completo`,
 * com qualquer `hp`: desde a F-CERCO-a2 o predio de pe perde HP em combate, e o `hp`
 * abaixo do total ja nao quer dizer "em obra". So a obra passa por `estagioDaObra`.
 */
export function estagioDoPredio(
  estado: 'obra' | 'completo', hp: number, hpTotal: number, nivelada: boolean,
): EstagioDaObra {
  return estado === 'completo' ? 'completo' : estagioDaObra(hp, hpTotal, nivelada);
}

/**
 * Type guard, e nao um `!==` solto em cada chamador: e o que deixa o compilador
 * provar que o tema tem rotulo para todo estagio EM OBRA.
 */
export function estaEmObra(estagio: EstagioDaObra): estagio is EstagioEmObra {
  return estagio !== 'completo';
}

/**
 * O contador zerado dos seis estagios. Existe para a cena e o debug nascerem da
 * MESMA forma: o `Record` exige as seis chaves, entao acrescentar um estagio a
 * uniao quebra a compilacao aqui, e nao silenciosamente na tela.
 */
export function contagemDeEstagios(): Record<EstagioDaObra, number> {
  return { marcacao: 0, fundacao: 0, estrutura: 0, paredes: 0, cobertura: 0, completo: 0 };
}

/**
 * F17g — uma fracao em par INTEIRO: `[numerador, denominador]`, denominador > 0.
 * O render divide so na hora de desenhar; a comparacao de fronteira nunca e
 * feita em float, pelo mesmo motivo das `PARTES` acima.
 */
export type Fracao = readonly [number, number];

/** Quanto de cada imagem do par aparece, de baixo para cima. `pedra` e o
 *  `completo` do manifesto: o predio pronto, revelado por cima da madeira. */
export interface RevelacaoDaObra {
  readonly madeira: Fracao;
  readonly pedra: Fracao;
}

const NADA: Fracao = [0, 1];
const INTEIRA: Fracao = [1, 1];

/**
 * F17g — a obra revelada pelo `hp` (docs/BRIEF-ARTE.md §4). A fase da madeira e a
 * parte da tabua no custo: `hpMadeira = hpTotal * timber / (timber + stone)`.
 * Ate ela, a madeira sobe `hp / hpMadeira`; depois, a madeira fica inteira e a
 * pedra sobe `(hp - hpMadeira) / (hpTotal - hpMadeira)`.
 *
 * As duas contas multiplicadas por `timber + stone`, para ficar em inteiros:
 * `hp * material` contra `hpTotal * timber`. O custo chega por parametro (funil
 * `render/predios.ts`); este arquivo continua sem import nenhum.
 *
 * BUG-M (paliativo, decisao do operador, 2026-09-26): com `hp <= 0` NAO ha
 * revelacao — devolve `null`, e a cena cai nos seis estagios (`marcacao` ou
 * `fundacao`), que desenham o contorno do lote, o nome e o canteiro. Revelar
 * `[0,1]`/`[0,1]` desenhava nada: o jogador plantava e nao via a obra. E o que o
 * aceite da F17g ja pedia ("antes da primeira martelada, o canteiro da F17d").
 */
export function revelacaoDaObra(
  hp: number, hpTotal: number, timber: number, stone: number,
): RevelacaoDaObra | null {
  if (hp <= 0) return null;
  if (hp >= hpTotal) return { madeira: INTEIRA, pedra: INTEIRA };
  const material = timber + stone;
  // predio sem custo nao tem fase de madeira: a pedra sobe com o hp inteiro
  if (material <= 0) return { madeira: INTEIRA, pedra: [hp, hpTotal] };
  const subido = hp * material;
  const virada = hpTotal * timber;
  if (subido <= virada) return { madeira: [subido, virada], pedra: NADA };
  return { madeira: INTEIRA, pedra: [subido - virada, hpTotal * stone] };
}

/** A revelacao em texto, para a chave do diff da cena e para o debug. */
export function chaveDaRevelacao(r: RevelacaoDaObra): string {
  return `${r.madeira[0]}/${r.madeira[1]}|${r.pedra[0]}/${r.pedra[1]}`;
}
