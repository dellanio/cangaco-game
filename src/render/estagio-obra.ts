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
