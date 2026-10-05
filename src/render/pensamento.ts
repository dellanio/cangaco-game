/**
 * I-TELA-BALAO-DE-PENSAMENTO — o que o morador quer fazer, num balao sobre a cabeca, como o
 * `TKMUnitThought` do KaM (`src/common/KM_Defaults.pas:710`; a tarefa o acende, como em
 * `src/units/tasks/KM_UnitTaskGoEat.pas:111` e `src/units/tasks/KM_UnitTaskBuild.pas:157`, e o
 * desenho o le em `src/units/KM_Units.pas:524-525`).
 *
 * So apresentacao: a regra le o estado e nao decide nada. Sem import de `phaser`: o teste a
 * exercita por tabela. Os numeros vem de `data/pensamento.json`.
 */
import type { GameState, Unidade } from '../sim/state';

export type Pensamento =
  | { readonly tipo: 'mercadoria'; readonly mercadoria: string }
  | { readonly tipo: 'comer' }
  | { readonly tipo: 'construir' }
  | { readonly tipo: 'casa' };

export interface ConfigDoPensamento {
  readonly intervaloTicks: number;
  readonly duracaoTicks: number;
  readonly alturaEmLados: number;
  readonly ladoDoIconeEmLados: number;
  readonly iconeDeComer: string;
}

/** A mercadoria da tarefa da unidade, quando a tarefa leva uma; senao `null`. */
export function recursoDaTarefa(estado: GameState, u: Pick<Unidade, 'fsmData'>): string | null {
  const tarefa = u.fsmData.tarefa === undefined ? undefined : estado.jobs.tarefas.porId[u.fsmData.tarefa];
  return tarefa !== undefined && 'recurso' in tarefa ? tarefa.recurso : null;
}

/**
 * O pensamento de quem esta A CAMINHO: o serf indo buscar ou entregar pensa na mercadoria, quem vai
 * comer pensa na comida, o obreiro indo a obra no martelo, o especialista indo ocupar na casa. Quem
 * esta parado, trabalhando ou sem destino nao pensa em nada.
 */
export function pensamentoDaUnidade(u: Pick<Unidade, 'fsm' | 'fsmData'>, recurso: string | null): Pensamento | null {
  switch (u.fsm) {
    case 'indo_buscar':
      return recurso === null ? null : { tipo: 'mercadoria', mercadoria: recurso };
    case 'indo_entregar': {
      const mercadoria = u.fsmData.carga ?? recurso;
      return mercadoria === null ? null : { tipo: 'mercadoria', mercadoria };
    }
    case 'indo_comer':
      return { tipo: 'comer' };
    case 'indo_a_obra':
      return { tipo: 'construir' };
    case 'indo_ocupar':
      return { tipo: 'casa' };
    default:
      return null;
  }
}

/** A fase da unidade no ciclo, de 0 a `intervalo - 1`, derivada do id (FNV-1a): a mesma unidade
 *  tem sempre a mesma, e unidades diferentes se espalham pelo ciclo. */
export function faseDaUnidade(id: string, intervalo: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % intervalo;
}

/** O balao esta aceso neste tick? `duracaoTicks` a cada `intervaloTicks`, na fase da unidade. */
export function pensamentoAceso(tick: number, id: string, config: Pick<ConfigDoPensamento, 'intervaloTicks' | 'duracaoTicks'>): boolean {
  return (tick + faseDaUnidade(id, config.intervaloTicks)) % config.intervaloTicks < config.duracaoTicks;
}

/** O pensamento que se desenha agora, ou `null`: a regra do estado e a do relogio juntas. */
export function pensamentoNaTela(
  estado: GameState, u: Pick<Unidade, 'id' | 'fsm' | 'fsmData'>, config: ConfigDoPensamento,
): Pensamento | null {
  const pensamento = pensamentoDaUnidade(u, recursoDaTarefa(estado, u));
  return pensamento !== null && pensamentoAceso(estado.tick, u.id, config) ? pensamento : null;
}

/** A mercadoria cujo icone o balao mostra, ou `null` quando o balao e de texto (obra, casa). */
export function mercadoriaDoBalao(p: Pensamento, config: Pick<ConfigDoPensamento, 'iconeDeComer'>): string | null {
  if (p.tipo === 'mercadoria') return p.mercadoria;
  if (p.tipo === 'comer') return config.iconeDeComer;
  return null;
}
