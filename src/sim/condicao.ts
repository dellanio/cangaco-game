import { gameData } from './data';
import type { GameData, LimiaresEmTicks } from './data/types';
import type { GameEvent, GameState, Unidade } from './state';

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
  return classesDe(dados.unidades).get(tipo) ?? null;
}

/**
 * C-IA-02a — o indice tipo -> classe, uma vez por `dados.unidades` (que nao muda depois do
 * carregamento). A varredura das tres listas a cada chamada era metade do tick da
 * escaramuca: o `inimigoEncostado` pergunta por par de unidades. A ordem de precedencia e a
 * de antes: civil, militar, mercenario (o primeiro que declarar o tipo fica).
 */
const classesPorUnidades = new WeakMap<GameData['unidades'], ReadonlyMap<string, 'civil' | 'militar'>>();
function classesDe(unidades: GameData['unidades']): ReadonlyMap<string, 'civil' | 'militar'> {
  const pronto = classesPorUnidades.get(unidades);
  if (pronto !== undefined) return pronto;
  const indice = new Map<string, 'civil' | 'militar'>();
  const marcar = (tipos: readonly { readonly id: string }[], classe: 'civil' | 'militar'): void => {
    for (const t of tipos) if (!indice.has(t.id)) indice.set(t.id, classe);
  };
  marcar(unidades.civis.tipos, 'civil');
  marcar(unidades.militares.tipos, 'militar');
  // F36 — o mercenario e militar comum depois de contratado: recebe ordem, luta e conta
  // como tropa (BUILD_PLAN F36)
  marcar(unidades.mercenarios.tipos, 'militar');
  classesPorUnidades.set(unidades, indice);
  return indice;
}

/** O civil: vai a Bodega comer. O militar tambem sente fome (C-COMIDA-01c), mas come pelo Feed. */
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
 * A CLASSE desta unidade drena condicao?
 *
 * C-COMIDA-01c (fome militar com o Feed): civil e militar (o mercenario incluido, F36)
 * drenam; tipo desconhecido nao. Ate a C-COMIDA-01b so o civil drenava, porque o militar
 * nao tinha como comer; agora o `FeedUnits` e a tarefa `comida-para-tropa` existem.
 *
 * O ANDAIME da IA (L8) nao mora aqui: ele depende do LADO, e este predicado so ve a
 * unidade. Quem decide o dreno no tick e `drenaNoTick`.
 */
export function drenaCondicao(unidade: Unidade, dados: GameData = gameData): boolean {
  return classeDaUnidade(unidade.tipo, dados) !== null;
}

/**
 * A unidade drena NESTE estado? `drenaCondicao` menos o ANDAIME da IA (C-COMIDA-01c,
 * decisao L8): com `condicao.iaDrena` falso, o militar de um lado que tem `state.ia` nao
 * drena — a IA ainda nao tem armazem, comida e serf para alimentar a tropa. Sai quando o
 * item da economia da IA entregar (o dado vira true).
 */
export function drenaNoTick(state: GameState, unidade: Unidade, dados: GameData = gameData): boolean {
  if (!drenaCondicao(unidade, dados)) return false;
  if (dados.condicao.iaDrena || classeDaUnidade(unidade.tipo, dados) !== 'militar') return true;
  return state.ia?.[String(unidade.lado)] === undefined;
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
 * Quanto cada comida devolve de condicao, em TICKS, na refeicao da Bodega
 * (`ticksRestauradosPorComida`, convertido no carregamento). So o civil come na
 * Bodega (`precisaComer`); o militar enche de uma vez pelo Feed (C-COMIDA-01b), e a
 * tabela dele saiu por nao ter leitor. `unidade` fica na assinatura porque e a
 * pergunta que o chamador faz: "quanto ESTA unidade recupera".
 */
export function restauracaoDaUnidade(
  _unidade: Unidade, dados: GameData = gameData,
): Readonly<Record<string, number>> {
  return dados.condicao.ticksRestauradosPorComida.civil;
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
  // C-COMIDA-01c — so o civil vai a Bodega; o militar come pelo Feed
  if (!ehCivil(unidade.tipo, dados)) return false;
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
 * Quantos civis e quantos militares do estado estao abaixo de cada limiar. Nao e usado
 * pela simulacao: e o resumo que o teste e a evidencia leem, num lugar so, para nao
 * haver duas contas da mesma coisa. C-COMIDA-01c separa as duas classes: `comFome` e
 * `emAlerta` continuam sendo so dos civis (o que a F20b sempre contou); o militar tem a
 * propria contagem, e "com fome" dele e o alerta, porque ele nao vai a Bodega.
 */
export function resumoDeCondicao(
  state: GameState, dados: GameData = gameData,
): {
  readonly civis: number; readonly comFome: number; readonly emAlerta: number;
  readonly militares: number; readonly militaresEmAlerta: number;
} {
  let civis = 0;
  let comFome = 0;
  let emAlerta = 0;
  let militares = 0;
  let militaresEmAlerta = 0;
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined) continue;
    const classe = classeDaUnidade(u.tipo, dados);
    if (classe === 'civil') {
      civis += 1;
      if (precisaComer(u, dados)) comFome += 1;
      if (emAlertaDeFome(u, dados)) emAlerta += 1;
    } else if (classe === 'militar') {
      militares += 1;
      if (emAlertaDeFome(u, dados)) militaresEmAlerta += 1;
    }
  }
  return { civis, comFome, emAlerta, militares, militaresEmAlerta };
}

/**
 * I-COMIDA-AVISO-DA-TROPA-COM-FOME — quantos MILITARES de cada lado estao em alerta de fome
 * (`emAlertaDeFome`), pela chave do lado em texto. Lado sem militar em alerta nao aparece.
 */
export function tropaComFomePorLado(state: GameState, dados: GameData = gameData): Readonly<Record<string, number>> {
  const porLado: Record<string, number> = {};
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || classeDaUnidade(u.tipo, dados) !== 'militar' || !emAlertaDeFome(u, dados)) continue;
    porLado[String(u.lado)] = (porLado[String(u.lado)] ?? 0) + 1;
  }
  return porLado;
}

/**
 * I-COMIDA-AVISO-DA-TROPA-COM-FOME — o aviso da tropa com fome, como o `UpdateHungerMessage` do KaM
 * (`src/units/KM_UnitGroup.pas:1975-2005`): o lado com tropa em alerta e sem aviso registrado avisa
 * na hora; com aviso registrado, avisa de novo quando passou o lembrete (`condition.json`
 * `avisoDaTropaComFome`) desde o ultimo, como o `fTimeSinceHungryReminder`. O lado sem tropa com fome
 * sai do registro, e a proxima fome avisa na hora. Os lados saem em ordem numerica. Devolve os
 * eventos e o registro novo (`undefined` quando vazio: o estado sem fome nao ganha o campo).
 */
export function avisosDaTropaComFome(
  depois: GameState, tick: number, dados: GameData = gameData,
): { readonly eventos: GameEvent[]; readonly registro: Readonly<Record<string, number>> | undefined } {
  const agora = tropaComFomePorLado(depois, dados);
  const anterior = depois.avisoDaTropaComFome ?? {};
  const registro: Record<string, number> = {};
  const eventos: GameEvent[] = [];
  for (const lado of Object.keys(agora).map(Number).sort((a, b) => a - b)) {
    const chave = String(lado);
    const ultimo = anterior[chave];
    if (ultimo === undefined || tick - ultimo >= dados.condicao.ticksDoLembreteDaTropaComFome) {
      eventos.push({ type: 'troop-hungry', lado, unidades: agora[chave] ?? 0 });
      registro[chave] = tick;
    } else {
      registro[chave] = ultimo;
    }
  }
  return { eventos, registro: Object.keys(registro).length === 0 ? undefined : registro };
}
