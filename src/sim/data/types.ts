import type { RawGameData } from './raw';

/** Ticks inteiros — nunca segundos, nunca ponto flutuante de runtime. */
export type Ticks = number;

/**
 * `economia | movimento | construcao | combate`, ou `null` para "esta
 * conversao declara, de proposito, que nao tem escala" (caso de
 * `delivery.alertaTarefaSemCandidato_segundos`). Nao e a union literal
 * estreita de `time.json` porque o valor nasce dinamicamente do proprio
 * dado (`raw.combat.escala`, etc) — a garantia de que so existem esses
 * quatro grupos e responsabilidade do validador (`tempo/grupo-inexistente`),
 * nao do compilador.
 */
export type GrupoDeEscala = string | null;

/** Uma linha de auditoria: toda duracao/taxa convertida no carregamento
 *  aparece aqui. E o que torna "toda conversao e inteira" e "trocar a
 *  escala de um grupo nao mexe nos outros" verificaveis em teste. */
export interface ConversaoRegistrada {
  readonly caminho: string;
  readonly grupo: GrupoDeEscala;
  readonly valorBase: number;
  readonly unidade: string;
  readonly ticks: Ticks;
}

export type PredioData = RawGameData['buildings']['predios'][number];

export interface ConstrucaoData {
  readonly hpPorMaterialEntregue: number;
  readonly hpPorMartelada: number;
  readonly ticksPorMartelada: Ticks;
  readonly ticksNivelamentoPorTile: Ticks;
  readonly devolucaoAoDemolir: number;
}

export interface ProducaoPredio {
  readonly entra: Readonly<Record<string, Ticks>>;
  readonly sai: Readonly<Record<string, Ticks>>;
}
export type ProducaoReceitas = Readonly<Record<string, ProducaoPredio>>;

/** Capacidade do buffer interno de um predio de producao — quantas unidades
 *  cabem antes de bloquear (F09 reserva isto como "vaga no destino"). Numero
 *  fixo por predio, nao por mercadoria: vem de
 *  `production.json:estoqueInternoPorPredio`. */
export interface EstoqueInternoPorPredio {
  readonly entrada: number;
  readonly saida: number;
}

export interface ProducaoData {
  readonly receitas: ProducaoReceitas;
  readonly estoqueInternoPorPredio: EstoqueInternoPorPredio;
}

export type TerrenoTipo = 'estrada' | 'grama' | 'campoArado' | 'areia';

export interface MovimentoData {
  readonly ticksPorTile: {
    readonly aPe: Readonly<Record<TerrenoTipo, Ticks>>;
    readonly montado: Readonly<Record<TerrenoTipo, Ticks>>;
  };
}

export interface CombateData {
  readonly formula: string;
  readonly attackEfetivo: string;
  readonly pisoAcerto: number;
  readonly tetoAcerto: number;
  readonly multiplicadorDirecao: RawGameData['combat']['multiplicadorDirecao'];
  readonly multiplicadorHP: RawGameData['combat']['multiplicadorHP'];
  readonly ticksCadenciaDeAtaque: Ticks;
  readonly aDistancia: RawGameData['combat']['aDistancia'];
  readonly stormAttack: {
    readonly multiplicadorVelocidade: number;
    readonly ticksDuracao: Ticks;
    readonly incontrolavel: boolean;
  };
  readonly watchtower: RawGameData['combat']['watchtower'];
  readonly formacao: RawGameData['combat']['formacao'];
}

export interface CondicaoData {
  readonly ticksCondicaoCheia: { readonly civil: Ticks; readonly militar: Ticks };
  readonly limiares: RawGameData['condition']['limiares'];
  readonly restauracaoPorComida: RawGameData['condition']['restauracaoPorComida'];
  readonly regraCivil: string;
  readonly regraMilitar: string;
  readonly inn: RawGameData['condition']['inn'];
  readonly populacao: RawGameData['condition']['populacao'];
}

export interface EntregaData {
  readonly prioridades: RawGameData['delivery']['prioridades'];
  readonly desempate: RawGameData['delivery']['desempate'];
  readonly reserva: RawGameData['delivery']['reserva'];
  readonly ticksAlertaTarefaSemCandidato: Ticks;
  readonly maxSerfsNoMarketplace: number;
}

export interface TerrenoData {
  readonly tilePx: number;
  readonly estrada: RawGameData['terrain']['estrada'];
  readonly campos: RawGameData['terrain']['campos'];
  readonly custoDeMovimento: RawGameData['terrain']['custoDeMovimento'];
  readonly intransponivel: RawGameData['terrain']['intransponivel'];
  readonly colisao: RawGameData['terrain']['colisao'];
  readonly pathfinding: RawGameData['terrain']['pathfinding'];
  readonly mapaPadrao: RawGameData['terrain']['mapaPadrao'];
}

export interface EconomiaSchoolhouseData {
  readonly custoOuroPorUnidade: number;
  readonly slotsDeFila: number;
  readonly ticksPorTreino: Ticks;
  readonly reembolsoSeNaoIniciado: boolean;
}

export interface EconomiaData {
  readonly estadoInicial: Omit<RawGameData['economy']['estadoInicial'], 'menuBuildInicial'> & {
    /** So raiz sem pai na arvore (`tools/data-rules.js`). Tipo explicito: um `[]`
     *  importado de JSON tipa como `never[]` e nao aceitaria nem `.includes(id)`. */
    readonly menuBuildInicial: readonly string[];
  };
  readonly schoolhouse: EconomiaSchoolhouseData;
  readonly storehouse: RawGameData['economy']['storehouse'];
  readonly marketplace: RawGameData['economy']['marketplace'];
  readonly mercadorias: RawGameData['economy']['mercadorias'];
  readonly bloqueioPadraoNoArmazem: RawGameData['economy']['bloqueioPadraoNoArmazem'];
  readonly grupos: RawGameData['economy']['grupos'];
}

export interface UnidadesData {
  readonly civis: RawGameData['units']['civis'];
  readonly militares: RawGameData['units']['militares'];
  readonly mercenarios: RawGameData['units']['mercenarios'];
}

export interface TempoData {
  readonly tickHz: number;
  readonly tickMs: number;
  readonly velocidadeDeJogo: RawGameData['time']['velocidadeDeJogo'];
}

/**
 * A forma carregada e convertida dos nove arquivos de `data/`.
 * Deliberadamente NAO tem `escalas`: nenhum sistema de `sim/` pode ler um
 * multiplicador de escala em tempo de execucao porque nao ha de onde tirar
 * o numero. Ver `loader.ts`.
 */
export interface GameData {
  readonly tempo: TempoData;
  readonly predios: readonly PredioData[];
  readonly construcao: ConstrucaoData;
  readonly producao: ProducaoData;
  readonly unidades: UnidadesData;
  readonly movimento: MovimentoData;
  readonly combate: CombateData;
  readonly condicao: CondicaoData;
  readonly entrega: EntregaData;
  readonly terreno: TerrenoData;
  readonly economia: EconomiaData;
  readonly conversoes: readonly ConversaoRegistrada[];
}
