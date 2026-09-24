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

/** `desbloqueadoPor` vem explicito porque o JSON de hoje nao tem nenhum `null`:
 *  desde que o armazem ADICIONAL passou a exigir Serraria (GDD §5.2), a arvore
 *  ficou sem raiz, e a inferencia do import estreitaria o campo para `string`.
 *  O modelo continua admitindo predio sem pai — `tools/data-rules.js` o aceita
 *  desde que a semente o alcance, e a permissao por fase da campanha (GDD §5.3)
 *  vai precisar dele. Tipo que segue o dado do dia apaga a capacidade. */
export type PredioData = Omit<RawGameData['buildings']['predios'][number], 'desbloqueadoPor'> & {
  readonly desbloqueadoPor: string | null;
};

export interface ConstrucaoData {
  readonly hpPorMaterialEntregue: number;
  readonly hpPorMartelada: number;
  readonly laborersMaximosPorObra: number;
  readonly ticksPorMartelada: Ticks;
  readonly ticksNivelamentoPorTile: Ticks;
  readonly devolucaoAoDemolir: number;
}

/**
 * F15a — a receita de um predio, ja derivada em CICLO no carregamento.
 *
 * Nao guarda taxa nem ticks-por-unidade: guarda a duracao de UM ciclo e quantas
 * unidades inteiras ele consome e rende. `ticksDoCiclo` e o periodo da taxa mais
 * lenta entre `entra` e `sai`; as quantidades sao a razao dos periodos,
 * arredondada uma unica vez, aqui. E por isso que "1 tronco -> 2 timber" (GDD
 * §4.2) e consequencia das taxas, e nao um numero digitado em `.ts`.
 */
export interface ReceitaDePredio {
  readonly ticksDoCiclo: Ticks;
  /** Unidades tiradas da gaveta `entrada` no INICIO do ciclo. */
  readonly entra: Readonly<Record<string, number>>;
  /** Unidades postas na gaveta `saida` no FIM do ciclo. */
  readonly sai: Readonly<Record<string, number>>;
  /** F-T2a — de onde este predio TIRA o que produz, quando a fonte e o mapa;
   *  `null` = receita renovavel (sawmill, bakery: o insumo vem da gaveta).
   *  Substituiu `rendimentoDoVeio`, que punha o total no PREDIO e fazia com que
   *  demolir e reconstruir renovasse a fonte. */
  readonly colheita: ColheitaDeRecurso | null;
}

/** F-T2a — a colheita de um predio: o que ele corta e ate onde alcanca. */
export interface ColheitaDeRecurso {
  /** Chave de `recursos.tipos` (`data/resources.json`). */
  readonly recurso: string;
  /** Distancia de Chebyshev a partir do TILE MAIS PROXIMO do footprint. */
  readonly alcance: number;
}
export type ProducaoReceitas = Readonly<Record<string, ReceitaDePredio>>;

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

/**
 * F-T1 — o que um TILE DO MAPA pode ser. Nao e `TerrenoTipo`: `'estrada'` sai
 * (estrada e ESTADO, o jogador a constroi e ela mora em `state.estradas`) e
 * entram os tres intransponiveis de `terrain.json`. O loader confere esta uniao
 * contra o dado no carregamento — nenhum sistema decide por conta propria o que
 * e terreno valido.
 */
export type TerrenoDeMapa =
  | Exclude<TerrenoTipo, 'estrada'>
  | 'agua' | 'rocha' | 'montanha';

/**
 * A camada de terreno base, CARREGADA E CONGELADA COM O RESTO DE `GameData` —
 * fora do `GameState` de proposito. Ela e imutavel durante a partida: por um
 * `Record` denso de 128x128 o save passaria de 29 KB para ~0,35 MB so para
 * guardar dado que nunca muda, e o que nao esta no estado nao pode divergir.
 *
 * Guardada CODIFICADA (um char por tile, a legenda ao lado) e nao decodificada:
 * e a forma que o git revisa e a que o arquivo tem. Quem decodifica — uma vez,
 * em cache — e `sim/mapa.ts`, a unica porta de leitura.
 */
export interface MapaData {
  readonly id: string;
  readonly largura: number;
  readonly altura: number;
  /** `altura` linhas de `largura` chars. */
  readonly linhas: readonly string[];
  /** char -> tipo. O loader ja garantiu que todo char usado esta aqui e que
   *  todo tipo existe em `terrain.json`. */
  readonly legenda: Readonly<Record<string, TerrenoDeMapa>>;
  /**
   * F-T2a — a camada de recurso, ESPARSA: tipo -> os tiles que o tem. Aqui esta
   * so ONDE; QUANTO cada tile rende e de `resources.json`, e a quantidade que
   * SOBRA e de `state.recursos` — esta e a semente, nao o estado.
   *
   * Esparsa e nao codificada como `linhas` porque recurso cobre ~5% do mapa: uma
   * segunda grade de 128x128 gastaria 16 KB para dizer "nao ha nada" 15 mil
   * vezes.
   */
  readonly recursos: Readonly<Record<string, readonly TileDeMapa[]>>;
}

/** Um par `[gx, gy]` do arquivo de mapa. Tupla e nao objeto: sao centenas por
 *  mapa, e `[24,31]` cabe numa linha de diff. */
export type TileDeMapa = readonly [number, number];

/** F-T2a — como um tipo de recurso se esgota. Um mecanismo, tres regimes. */
export type RegimeDeRecurso = 'nunca' | 'porAcao' | 'porTempo';

export interface TipoDeRecurso {
  readonly regime: RegimeDeRecurso;
  /** Unidades que UM tile rende quando o mapa nasce, e o teto do `porTempo`. */
  readonly rendimentoPorTile: number;
}

export interface RecursosData {
  readonly tipos: Readonly<Record<string, TipoDeRecurso>>;
  /** Ticks para o regime `porTempo` repor UMA unidade. Vale para todos os tipos
   *  desse regime: a taxa e do REGIME, nao do tipo, e por isso tem caminho fixo
   *  em `data/resources.json` (e so caminho fixo se registra em
   *  `tools/data-schema.js`). Nenhum tipo de hoje usa o regime. */
  readonly ticksPorUnidadeRegenerada: Ticks;
}

export interface MovimentoData {
  /** Passo reto (4 direcoes), por terreno de DESTINO. */
  readonly ticksPorTile: {
    readonly aPe: Readonly<Record<TerrenoTipo, Ticks>>;
    readonly montado: Readonly<Record<TerrenoTipo, Ticks>>;
  };
  /** Passo diagonal: `round(sqrt2 * custo)` num arredondamento so (F10, A* de vizinhanca 8). */
  readonly ticksPorTileDiagonal: {
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
  /** F18a: passos de zoom. Dado de RENDER — nenhum sistema de `sim/` le
   *  este campo; ele viaja junto so porque `data/terrain.json` e um arquivo
   *  so, e chega a `render/` pelo funil `render/mapa.ts`. */
  readonly zoom: RawGameData['terrain']['zoom'];
  /** F-D2: a navegacao por teclado da camera. Dado de RENDER pelo mesmo motivo
   *  do `zoom` acima, e com um agravante proprio: a unidade e px por segundo de
   *  RELOGIO DE PAREDE. Nao passa por `time.json`, nao vira tick, e nenhum
   *  sistema de `sim/` a le. */
  readonly camera: RawGameData['terrain']['camera'];
}

export interface EconomiaSchoolhouseData {
  readonly custoOuroPorUnidade: number;
  readonly slotsDeFila: number;
  readonly ticksPorTreino: Ticks;
  readonly reembolsoSeNaoIniciado: boolean;
}

export interface EconomiaData {
  readonly estadoInicial: Omit<RawGameData['economy']['estadoInicial'], 'menuBuildInicial'> & {
    /** So raiz sem pai na arvore (`tools/data-rules.js`) — e a arvore nao tem
     *  mais nenhuma (GDD §5.2), entao hoje esta lista so pode ficar vazia e quem
     *  abre a partida e `estadoInicial.predios`. E por aqui que a permissao por
     *  fase da campanha (GDD §5.3) vai entrar. Tipo explicito: um `[]` importado
     *  de JSON tipa como `never[]` e nao aceitaria nem `.includes(id)`. */
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
  /** F-T1 — a camada de terreno do mapa em jogo. Leia por `sim/mapa.ts`. */
  readonly mapa: MapaData;
  /** F-T2a — regime e rendimento por TIPO de recurso. Leia por `sim/recursos.ts`. */
  readonly recursos: RecursosData;
  readonly economia: EconomiaData;
  readonly conversoes: readonly ConversaoRegistrada[];
}
