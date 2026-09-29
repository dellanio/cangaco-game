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
  /** F24a — cada ciclo entrega UMA das saidas de `sai`, e nao todas. Qual e a
   *  cota do predio (`Producao.escolha`). `false` e a receita de sempre: o ciclo
   *  deposita todas as saidas juntas (a granja: porco e couro). */
  readonly escolheSaida: boolean;
  /** F-REPL-b — o que o jogador escolhe neste predio (`Producao.modo`), ou `null`
   *  para quem nao escolhe nada. Hoje so o lenhador declara. */
  readonly modos: ModosDoPredio | null;
}

/**
 * F-REPL-b — os modos de um predio. O codigo le o que cada modo FAZ, nunca o nome:
 * o nome e o id que o comando `SetBuildingMode` leva e que o tema traduz.
 */
export interface ModosDoPredio {
  readonly porModo: Readonly<Record<string, ModoDeTrabalho>>;
  /** O modo de quem nasce. Esta em `porModo` (o loader recusa o contrario). */
  readonly padrao: string;
}

export interface ModoDeTrabalho {
  /** Repoe o tile que cortou (o rodizio). `false` so colhe, e o que colhe esgota. */
  readonly planta: boolean;
}

/** F-T2a — a colheita de um predio: o que ele corta e ate onde alcanca. */
export interface ColheitaDeRecurso {
  /** Chave de `recursos.tipos` (`data/resources.json`). */
  readonly recurso: string;
  /** Distancia de Chebyshev a partir do TILE MAIS PROXIMO do footprint. */
  readonly alcance: number;
  /** 2026-09-26 (operador) — colhe o tile SEM sair do predio: o relogio anda la
   *  dentro e o deposito consome o tile, como a mina do jogo original. Regra de
   *  classe, nao de tipo: qualquer receita com `colheita` pode declarar. */
  readonly aDistancia: boolean;
  /** LOTE3 — o ciclo em fases, na ordem: `ticksDeDescanso` dentro do predio (o
   *  descanso do KaM, que vem DEPOIS da entrega — aqui, no comeco do ciclo seguinte),
   *  `ticksNoTile` no tile (`colhendo`) e o resto, ate `ReceitaDePredio.ticksDoCiclo`,
   *  de volta dentro do predio (o trabalho na casa; zero para quem volta e deposita).
   *  Receita sem `fases` no dado: descanso 0 e o ciclo inteiro no tile, como antes. */
  readonly ticksDeDescanso: Ticks;
  readonly ticksNoTile: Ticks;
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
   * F23 — a impressao digital do arquivo de mapa, calculada uma vez no
   * carregamento (`loader.ts`, `hashDeTexto`). O save guarda `id` + `hash`, e o
   * load recusa na hora se qualquer um dos dois nao bater: o terreno nao esta no
   * `GameState` (F-T1), entao e este par que diz se o save fala do mesmo mundo.
   */
  readonly hash: string;
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
  /** F-T2b — o tile com este recurso EM PE reprova o passo, como terreno
   *  intransponivel. Por tipo e em dado: ninguem digita `'tree'` em `.ts`. */
  readonly bloqueiaPasso: boolean;
  /** BUG-F — nao se assenta predio nem estrada sobre este recurso EM PE. Por tipo
   *  e em dado, como o passo: a rocha bloqueia construcao sem bloquear passo (a
   *  pedreira lavrava o lajedo debaixo das proprias paredes), e o milho nao
   *  bloqueia nenhum dos dois, porque e tile que o jogador plantou. */
  readonly bloqueiaConstrucao: boolean;
  /** F18 — o tipo de TERRENO de onde a camada deste recurso e derivada, ou
   *  `null` para os que vem da lista esparsa do mapa (rocha, arvore, cardume).
   *  O milho nao e desenhado tile a tile no arquivo de mapa: ele EXISTE em todo
   *  tile de `campoArado`, e quem pergunta "ha campo aqui?" pergunta a camada,
   *  como pergunta pela rocha. */
  readonly terreno: string | null;
  /** F18 — quanto UM tile tem quando a partida comeca, ou `null` para "cheio".
   *  O `null` nao e detalhe: `rendimentoPorTile` e o teto do tipo e os testes o
   *  injetam para caber um esgotamento dentro de um cenario. Resolver o padrao
   *  aqui, no carregamento, congelaria o teto do dado real dentro de todo
   *  cenario injetado. Quem resolve e `recursosIniciais`, no momento de usar.
   *  Zero e o campo, que nasce em POUSIO e so rende depois que o roceiro ara. */
  readonly quantidadeInicial: number | null;
  /** F18 — o que um predio gasta e demora para repor UM tile, ou `null` para
   *  quem nao se repoe por acao nenhuma. */
  readonly reposicao: ReposicaoDeRecurso | null;
  /** F18h — como o JOGADOR cria um tile deste recurso, ou `null` para quem so
   *  vem do mapa (rocha, arvore, cardume). A presenca deste bloco e a permissao:
   *  tipo sem `aradura` nao tem ferramenta no menu e `canPlowField` o recusa. */
  readonly aradura: AraduraDeRecurso | null;
}

/** F18h — o que o laborer precisa para arar UM tile deste recurso, ja em ticks.
 *  Sem custo em material: o milho nao cobra nada (GDD 5.4), e o dia em que a
 *  cana cobrar 1 timber por tile e o dia em que este bloco ganha o campo — com o
 *  Canavial ja sendo consumidor, que e o que falta (ver o item F18h da fila). */
export interface AraduraDeRecurso {
  /** Ticks de trabalho para UM tile virar campo em pousio. */
  readonly ticks: Ticks;
  /** Os terrenos do mapa em que este recurso pode ser desenhado. */
  readonly terrenoPermitido: readonly string[];
}

/** F18 — o custo de repor um tile, ja em ticks. So o regime `porAcao` tem. */
export interface ReposicaoDeRecurso {
  /** F-CAMPO-a — ticks do roceiro NO TILE para semea-lo. */
  readonly ticksDeSemear: Ticks;
  /** F-CAMPO-a — ticks do tile semeado ate maduro, sem ninguem la. Nao ha
   *  contador: o tile guarda `semeadoEm` e maduro e derivado. */
  readonly ticksDeCrescer: Ticks;
  /** Mercadoria -> quantidade que o predio gasta por tile reposto. Vazio quando
   *  a reposicao nao cobra nada (o milho de hoje: a semente vem do proprio
   *  roçado, decisao registrada no item da fila). */
  readonly custo: Readonly<Record<string, number>>;
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
  /** C5 — quantos ticks o militar espera um tile ocupado por outro militar antes do passo
   *  para o lado (`units.json: colisaoMilitar`). */
  readonly ticksDesvioMilitar: Ticks;
  /** C5 — a margem, em tiles, da caixa da busca local do desvio (limite de busca). */
  readonly margemDoDesvioMilitar: number;
  /** D-MOVIMENTO-01 — a colisao civil (`units.json: colisaoCivil`). `ligada` false: nada muda. */
  readonly colisaoCivil: ColisaoCivilData;
}

export interface ColisaoCivilData {
  readonly ligada: boolean;
  /** Quanto o civil bloqueado espera antes de empurrar o ocioso do tile seguinte. */
  readonly ticksEmpurrar: Ticks;
  /** Quanto espera antes do primeiro desvio. */
  readonly ticksDesviar: Ticks;
  /** De quanto em quanto tenta o desvio de novo. */
  readonly ticksRepetirDesvio: Ticks;
  /** Quanto espera antes de entrar no tile ocupado: o teto da espera. */
  readonly ticksTrocaForcada: Ticks;
  /** A margem, em tiles, da caixa da busca do desvio (limite de busca). */
  readonly margemDoDesvio: number;
  /** D-MOVIMENTO-01h — quanto um tile com outro civil custa a mais na rota que o serf
   *  planeja (o AVOID_UNIT_PENALTY do KaM), em ticks: `custoPorUnidade_tiles` vezes o passo
   *  a pe na estrada, convertido no carregamento. */
  readonly ticksPorUnidadeNaRota: Ticks;
}

export interface CadenciaDoAtirador {
  /** A parte SORTEADA da mira: o sorteio vai de 0 a `miraAleatoria - 1`. */
  readonly miraAleatoria: Ticks;
  /** A animacao de luta mais a mira minima do KaM. */
  readonly recarga: Ticks;
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
  readonly stormAttack: RawGameData['combat']['stormAttack'];
  /** Cadencia PROPRIA do golpe contra predio, ja em ticks (ver combat.json). */
  readonly ataqueAPredio: {
    readonly danoCorpoACorpo: number;
    readonly danoProjetil: number;
    readonly rolagem: boolean;
    readonly ticksCadencia: Ticks;
  };
  /** F28b + C1 — a torre, com a recarga ja em ticks. */
  readonly watchtower: RawGameData['combat']['watchtower'] & { readonly ticksRecarga: Ticks };
  /** C1 — a cadencia do atirador por projetil (`aDistancia.cadencia`), em ticks: recarga +
   *  sorteio de 0 a `miraAleatoria - 1`. */
  readonly ticksCadenciaAtirador: Readonly<Record<string, CadenciaDoAtirador>>;
  /** C2 — milesimos de tick para o projetil voar um tile, por tipo (`flecha`, `virote`,
   *  `funda`, `pedraDaTorre`). Voo = max(1, round(distancia x m / 1000)). */
  readonly milesimosDeTickPorTile: Readonly<Record<string, number>>;
  readonly formacao: RawGameData['combat']['formacao'];
  /** F28-IA — o tamanho do grupo de defesa da IA. */
  readonly ia: RawGameData['combat']['ia'];
  /** F28d — quem tem escudo (pelos requisitos) e a defesa extra por tipo de projetil. */
  readonly escudo: RawGameData['combat']['escudo'];
  /** F28c — quanto HP volta e de quantos em quantos ticks (ja convertido). */
  readonly regeneracao: {
    readonly hp: number;
    readonly ticksIntervalo: Ticks;
  };
}

/**
 * F20b — os limiares de `condition.json` JA EM TICKS, por classe de unidade.
 *
 * A fracao (`0.50`, `0.35`) e do dado; o que a simulacao compara e inteiro, porque
 * `Unidade.condicao` e ticks restantes. A multiplicacao acontece UMA VEZ, aqui no
 * carregamento, com `Math.round` (CLAUDE.md secao 5): fazer a conta a cada tick
 * poria ponto flutuante no caminho do determinismo sem nenhum ganho.
 */
export interface LimiaresEmTicks {
  readonly alertaVisual: Ticks;
  readonly civilVaiComer: Ticks;
  readonly morte: Ticks;
}

export interface CondicaoData {
  readonly ticksCondicaoCheia: { readonly civil: Ticks; readonly militar: Ticks };
  readonly limiares: RawGameData['condition']['limiares'];
  /** F20b — `limiares` x `ticksCondicaoCheia`, arredondado no carregamento. */
  readonly ticksNoLimiar: { readonly civil: LimiaresEmTicks; readonly militar: LimiaresEmTicks };
  readonly restauracaoPorComida: RawGameData['condition']['restauracaoPorComida'];
  /**
   * F20b — `restauracaoPorComida` x `ticksCondicaoCheia`, arredondado no
   * carregamento: quantos TICKS de condicao cada comida devolve, por classe. A
   * refeicao soma inteiro em inteiro; a fracao nunca chega a `sim/`.
   */
  readonly ticksRestauradosPorComida: {
    readonly civil: Readonly<Record<string, Ticks>>;
    readonly militar: Readonly<Record<string, Ticks>>;
  };
  readonly regraCivil: string;
  readonly regraMilitar: string;
  /** C-COMIDA-01 (fome militar com o Feed) — no Feed, o militar so pede comida com a
   *  condicao ABAIXO de `ticksPedeComida` (`condition.json: militar.pedeComidaAbaixoDe` x
   *  a cheia do militar, convertido no carregamento). */
  readonly ticksPedeComida: Ticks;
  /** C-COMIDA-01c — ANDAIME (L8): a tropa de lado com IA drena? `condition.json: militar.iaDrena`.
   *  Sai (vira true) quando a IA tiver armazem, comida e serf. */
  readonly iaDrena: boolean;
  readonly inn: RawGameData['condition']['inn'];
  readonly populacao: RawGameData['condition']['populacao'];
}

export interface EntregaData {
  readonly prioridades: RawGameData['delivery']['prioridades'];
  readonly desempate: RawGameData['delivery']['desempate'];
  readonly reserva: RawGameData['delivery']['reserva'];
  readonly ticksAlertaTarefaSemCandidato: Ticks;
}

export interface TerrenoData {
  readonly tilePx: number;
  readonly estrada: RawGameData['terrain']['estrada'];
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
