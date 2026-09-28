import { gameData } from './data';
import type { GameData, LimiaresEmTicks } from './data/types';
import type { GameState, Unidade } from './state';

/**
 * F20b — os derivados puros da CONDICAO (fome): quem sente fome, quanto e "cheia",
 * que fracao a unidade tem e a que ponto da escada de limiares ela chegou. Nenhum
 * estado muda aqui.
 *
 * CAMADA: este modulo importa de `state.ts` **so tipo** (`import type`, que o
 * compilador apaga). Nao ha importacao de valor nenhuma vinda de `state.ts`,
 * `bodega.ts` ou `jobs.ts`, e e isso que permite `state.ts` chamar
 * `condicaoCheiaDoTipo` para semear a unidade recem-nascida sem ciclo em tempo de
 * execucao. A refeicao em si — que precisa da Bodega — mora em `systems/fome.ts`.
 *
 * Nenhum numero aqui: a duracao vem de `condition.duracaoCondicaoCheia_min_base`
 * (ja em ticks no carregador) e os limiares de `condition.limiares` (ja em ticks em
 * `condicao.ticksNoLimiar`).
 */

/** Os estados de FSM da fome, na ordem do GDD secao 6.2 (`indo_comer -> comendo`). */
export const FSM_INDO_COMER = 'indo_comer';
export const FSM_COMENDO = 'comendo';

/**
 * A unidade esta num estado da fome? Os tres sistemas de familia (serfs, laborers,
 * especialistas) pulam quem esta aqui: o passo dessa unidade e do `sistemaDaFome`.
 *
 * Existe como predicado UNICO, e nao como duas comparacoes repetidas em tres laços,
 * porque o `default` de cada `switch (u.fsm)` LANCA — esquecer um laço nao daria um
 * bug silencioso, daria um throw, e a lista de estados tem de ter uma fonte so.
 */
export function ehEstadoDeFome(fsm: string): boolean {
  return fsm === FSM_INDO_COMER || fsm === FSM_COMENDO;
}

/**
 * A classe da unidade para efeito de condicao, lida do dado: `civis.tipos`,
 * `militares.tipos` e (F36) `mercenarios.tipos` de `units.json`. Tipo desconhecido (save de outra versao) nao
 * vira civil por omissao — devolve `null`, e quem devolve `null` nao drena nem
 * morre. Mesma regra de `populacaoPorGrupo` (`sim/selectors.ts`).
 */
export function classeDaUnidade(
  tipo: string, dados: GameData = gameData,
): 'civil' | 'militar' | null {
  if (dados.unidades.civis.tipos.some((t) => t.id === tipo)) return 'civil';
  if (dados.unidades.militares.tipos.some((t) => t.id === tipo)) return 'militar';
  // F36 — o mercenario e militar comum depois de contratado: recebe ordem, luta e conta
  // como tropa (BUILD_PLAN F36)
  if (dados.unidades.mercenarios.tipos.some((t) => t.id === tipo)) return 'militar';
  return null;
}

/** So o civil sente fome nesta feature. Ver `drenaCondicao` para o porque. */
export function ehCivil(tipo: string, dados: GameData = gameData): boolean {
  return classeDaUnidade(tipo, dados) === 'civil';
}

/**
 * A condicao cheia desta unidade, em ticks. Classe desconhecida cai no valor do
 * civil: o campo `condicao` e obrigatorio em `Unidade`, e nascer com zero seria
 * nascer morto.
 */
export function condicaoCheiaDoTipo(tipo: string, dados: GameData = gameData): number {
  return classeDaUnidade(tipo, dados) === 'militar'
    ? dados.condicao.ticksCondicaoCheia.militar
    : dados.condicao.ticksCondicaoCheia.civil;
}

/**
 * A unidade DRENA condicao neste tick?
 *
 * So civil, e a razao e de regra, nao de escopo: `condition.regraMilitar` diz que o
 * militar **nao vai ao Inn** e depende do comando `Feed`, que e da F17 em diante.
 * Drenar quem nao tem como comer seria travamento de regra disfarçado de
 * balanceamento — a unidade esperaria o que nunca chega. Quando o `Feed` existir,
 * este predicado e o unico lugar a mudar.
 */
export function drenaCondicao(unidade: Unidade, dados: GameData = gameData): boolean {
  return ehCivil(unidade.tipo, dados);
}

/** Os limiares em tick da classe desta unidade. */
export function limiaresDaUnidade(
  unidade: Unidade, dados: GameData = gameData,
): LimiaresEmTicks {
  return classeDaUnidade(unidade.tipo, dados) === 'militar'
    ? dados.condicao.ticksNoLimiar.militar
    : dados.condicao.ticksNoLimiar.civil;
}

/**
 * Quanto cada comida devolve de condicao, em TICKS, para a classe desta unidade
 * (`ticksRestauradosPorComida`, convertido no carregamento). Irma de
 * `limiaresDaUnidade` — nenhuma fracao e multiplicada em tempo de execucao.
 */
export function restauracaoDaUnidade(
  unidade: Unidade, dados: GameData = gameData,
): Readonly<Record<string, number>> {
  return classeDaUnidade(unidade.tipo, dados) === 'militar'
    ? dados.condicao.ticksRestauradosPorComida.militar
    : dados.condicao.ticksRestauradosPorComida.civil;
}

/**
 * A condicao de 0 a 1 — o numero que o GDD e o HUD falam, DERIVADO, nunca guardado.
 * A F20c le isto para decidir o marcador.
 */
export function fracaoDeCondicao(unidade: Unidade, dados: GameData = gameData): number {
  const cheia = condicaoCheiaDoTipo(unidade.tipo, dados);
  if (cheia <= 0) return 0;
  return Math.min(1, Math.max(0, unidade.condicao / cheia));
}

/**
 * A unidade cruzou o limiar de ir comer (`limiares.civilVaiComer`, 50 % no dado)?
 *
 * `<=` e nao `<`: a condicao cai de tick em tick e passa EXATAMENTE pelo inteiro do
 * limiar, e o civil que esta na metade ja deve sair. Falso para quem nao drena — o
 * militar nao vai ao Inn.
 */
export function precisaComer(unidade: Unidade, dados: GameData = gameData): boolean {
  if (!drenaCondicao(unidade, dados)) return false;
  return unidade.condicao <= limiaresDaUnidade(unidade, dados).civilVaiComer;
}

/** A unidade cruzou o limiar de alerta visual (35 % no dado). E o leitor da F20c. */
export function emAlertaDeFome(unidade: Unidade, dados: GameData = gameData): boolean {
  if (!drenaCondicao(unidade, dados)) return false;
  return unidade.condicao <= limiaresDaUnidade(unidade, dados).alertaVisual;
}

/** A unidade chegou ao limiar de morte (0 no dado). */
export function morreuDeFome(unidade: Unidade, dados: GameData = gameData): boolean {
  if (!drenaCondicao(unidade, dados)) return false;
  return unidade.condicao <= limiaresDaUnidade(unidade, dados).morte;
}

/**
 * Quantos civis do estado estao abaixo de cada limiar. Nao e usado pela simulacao:
 * e o resumo que o teste e a evidencia leem, num lugar so, para nao haver duas
 * contas da mesma coisa.
 */
export function resumoDeCondicao(
  state: GameState, dados: GameData = gameData,
): { readonly civis: number; readonly comFome: number; readonly emAlerta: number } {
  let civis = 0;
  let comFome = 0;
  let emAlerta = 0;
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || !drenaCondicao(u, dados)) continue;
    civis += 1;
    if (precisaComer(u, dados)) comFome += 1;
    if (emAlertaDeFome(u, dados)) emAlerta += 1;
  }
  return { civis, comFome, emAlerta };
}
