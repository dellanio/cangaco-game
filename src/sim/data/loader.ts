import type { RawGameData } from './raw';
import type {
  CombateData, CondicaoData, ConstrucaoData, ConversaoRegistrada, EconomiaData,
  EntregaData, GameData, MovimentoData, ProducaoData, ReceitaDePredio,
  MapaData, RecursosData, RegimeDeRecurso, TerrenoData, TerrenoDeMapa, TerrenoTipo,
  LimiaresEmTicks, Ticks, TileDeMapa, TipoDeRecurso, UnidadesData,
} from './types';
import { TERRENOS_DE_MAPA } from './terrenos';
import { hashDeTexto } from './hash';

/**
 * F-T1 — a camada de terreno base. O carregador confere a legenda contra
 * `TERRENOS_DE_MAPA` E contra `terrain.json`: um tipo que nao tem custo de
 * movimento nem esta em `intransponivel` seria terreno mudo, e o A* descobriria
 * isso dentro do navegador. Nada aqui decodifica o mapa tile a tile — quem
 * decodifica, uma vez e em cache, e `sim/mapa.ts`.
 */
function carregarMapa(raw: RawGameData): MapaData {
  const bruto = raw.mapa;
  const { largura, altura } = raw.terrain.mapaPadrao;
  if (bruto.largura !== largura || bruto.altura !== altura) {
    throw new Error(
      `loadGameData: o mapa '${bruto.id}' e ${bruto.largura}x${bruto.altura} e `
      + `terrain.mapaPadrao e ${largura}x${altura} — o mundo teria dois tamanhos`,
    );
  }
  if (bruto.linhas.length !== altura) {
    throw new Error(`loadGameData: o mapa '${bruto.id}' tem ${bruto.linhas.length} linhas, esperado ${altura}`);
  }
  const comCusto = new Set(Object.keys(raw.terrain.custoDeMovimento).filter((k) => k !== 'estrada'));
  const intransponivel = new Set(raw.terrain.intransponivel.filter((k) => k !== 'predio'));
  const legenda: Record<string, TerrenoDeMapa> = {};
  for (const [ch, tipo] of Object.entries(bruto.legenda)) {
    const conhecido = TERRENOS_DE_MAPA.find((t) => t === tipo);
    if (conhecido === undefined) {
      throw new Error(`loadGameData: o mapa '${bruto.id}' mapeia '${ch}' para o terreno desconhecido '${tipo}'`);
    }
    if (!comCusto.has(conhecido) && !intransponivel.has(conhecido)) {
      throw new Error(
        `loadGameData: o terreno '${conhecido}' do mapa '${bruto.id}' nao tem custo de movimento `
        + 'nem esta em terrain.intransponivel',
      );
    }
    legenda[ch] = conhecido;
  }
  for (let gy = 0; gy < altura; gy += 1) {
    const linha = bruto.linhas[gy] as string;
    if (linha.length !== largura) {
      throw new Error(`loadGameData: a linha ${gy} do mapa '${bruto.id}' tem ${linha.length} chars, esperado ${largura}`);
    }
    for (let gx = 0; gx < largura; gx += 1) {
      const ch = linha[gx] as string;
      if (!(ch in legenda)) {
        throw new Error(`loadGameData: o mapa '${bruto.id}' usa o char '${ch}' em (${gx},${gy}), fora da legenda`);
      }
    }
  }
  return {
    id: bruto.id, largura, altura, linhas: bruto.linhas, legenda,
    // F23 — o hash sai daqui, UMA vez, no carregamento: o save le este campo e
    // nunca recalcula. E do objeto ja parseado, nao do texto do arquivo, porque
    // e o objeto que `resolveJsonModule` entrega a `sim/` — a ordem das chaves e
    // a do arquivo, entao o mesmo conteudo da sempre o mesmo hash, e reindentar o
    // JSON de proposito nao invalida save nenhum. O que muda o hash e o que muda
    // o mapa: um char de terreno, um tile de recurso, a largura.
    hash: hashDeTexto(JSON.stringify(bruto)),
    recursos: carregarRecursosDoMapa(bruto, largura, altura, raw.resources.tipos),
  };
}

/**
 * F-T2a — a camada esparsa de recurso do mapa. O carregador confere aqui, uma
 * vez, o que nenhum sistema deveria reconferir por tile: tipo conhecido, tile
 * dentro do mundo e NENHUM tile com dois recursos. O ultimo e o que evita um
 * desempate em tempo de jogo — `state.recursos` e chaveado por tile, entao dois
 * tipos no mesmo tile seriam um deles sumindo em silencio.
 */
/**
 * A forma CRUA de um tipo de recurso. Os campos da F18 so existem em alguns
 * tipos do JSON, e o tipo que o `resolveJsonModule` infere e a uniao dos quatro
 * — perguntar `def.terreno` na uniao nao compila. Declarar a forma aqui, com os
 * campos novos opcionais, e o mesmo contrato de `raw.ts`: campo renomeado em
 * `data/` reprova no `typecheck`, nao em tempo de execucao.
 */
interface RawTipoDeRecurso {
  readonly regime: string;
  readonly rendimentoPorTile: number;
  readonly bloqueiaPasso?: boolean;
  readonly bloqueiaConstrucao?: boolean;
  readonly terreno?: string;
  readonly quantidadeInicial?: number;
  readonly reposicao?: {
    readonly segundos_base: number;
    readonly custo: Readonly<Record<string, number>>;
  };
}

/** As chaves `_doc*` sao comentario do arquivo de dado, nunca conteudo. */
function semChavesDeDoc(
  bruto: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const limpo: Record<string, number> = {};
  for (const [k, v] of Object.entries(bruto)) if (!k.startsWith('_')) limpo[k] = v;
  return limpo;
}

function carregarRecursosDoMapa(
  bruto: RawGameData['mapa'], largura: number, altura: number,
  tipos: RawGameData['resources']['tipos'],
): Readonly<Record<string, readonly TileDeMapa[]>> {
  const recursos: Record<string, readonly TileDeMapa[]> = {};
  const ocupado = new Map<string, string>();
  for (const [tipo, tiles] of Object.entries(bruto.recursos as Record<string, number[][]>)) {
    if (!(tipo in tipos)) {
      throw new Error(`loadGameData: o mapa '${bruto.id}' poe o recurso desconhecido '${tipo}' no mapa`);
    }
    const lista: TileDeMapa[] = [];
    for (const par of tiles) {
      const gx = par[0] as number;
      const gy = par[1] as number;
      if (!Number.isInteger(gx) || !Number.isInteger(gy) || gx < 0 || gy < 0 || gx >= largura || gy >= altura) {
        throw new Error(`loadGameData: o recurso '${tipo}' do mapa '${bruto.id}' esta em (${gx},${gy}), fora do mundo`);
      }
      const chave = `${gx},${gy}`;
      const jaTem = ocupado.get(chave);
      if (jaTem !== undefined) {
        throw new Error(
          `loadGameData: o tile (${gx},${gy}) do mapa '${bruto.id}' tem '${jaTem}' e '${tipo}' — um tile, um recurso`,
        );
      }
      ocupado.set(chave, tipo);
      lista.push([gx, gy]);
    }
    recursos[tipo] = lista;
  }
  derivarRecursosDoTerreno(bruto, tipos, recursos, ocupado);
  return recursos;
}

/**
 * F18 — as camadas DERIVADAS do terreno. Um tipo com `terreno` em
 * `resources.json` existe em todo tile daquele terreno: o milho nao aparece
 * tile a tile no arquivo de mapa, ele E o campo arado. Sem isto o roçado teria
 * de ser uma lista de 130 pares copiada do mapa, que sairia do ar no dia em que
 * o gerador emitisse um mapa novo.
 *
 * Vem DEPOIS das listas esparsas e respeita o mesmo `ocupado`: se um dia um
 * lajedo cair sobre campo arado, o conflito reprova o carregamento aqui — nao
 * vira um dos dois sumindo em silencio dentro da partida.
 *
 * A ordem e a de leitura do mapa (norte→sul, oeste→leste), fixa: e ela que
 * decide qual tile o roceiro trabalha primeiro, e o teste de determinismo
 * compara byte a byte.
 */
function derivarRecursosDoTerreno(
  bruto: RawGameData['mapa'], tipos: RawGameData['resources']['tipos'],
  recursos: Record<string, readonly TileDeMapa[]>, ocupado: Map<string, string>,
): void {
  const legenda = bruto.legenda as Record<string, string>;
  const porTerreno = new Map<string, string>();
  for (const [id, def] of Object.entries(tipos)) {
    const terreno = (def as RawTipoDeRecurso).terreno;
    if (terreno === undefined) continue;
    const jaTem = porTerreno.get(terreno);
    if (jaTem !== undefined) {
      throw new Error(
        `loadGameData: '${jaTem}' e '${id}' derivam do mesmo terreno '${terreno}' — um tile, um recurso`,
      );
    }
    porTerreno.set(terreno, id);
  }
  if (porTerreno.size === 0) return;

  const listas = new Map<string, TileDeMapa[]>();
  for (const id of porTerreno.values()) listas.set(id, []);
  for (let gy = 0; gy < bruto.linhas.length; gy += 1) {
    const linha = bruto.linhas[gy] as string;
    for (let gx = 0; gx < linha.length; gx += 1) {
      const id = porTerreno.get(legenda[linha[gx] as string] as string);
      if (id === undefined) continue;
      const chave = `${gx},${gy}`;
      const jaTem = ocupado.get(chave);
      if (jaTem !== undefined) {
        throw new Error(
          `loadGameData: o tile (${gx},${gy}) do mapa '${bruto.id}' tem '${jaTem}' e '${id}' — um tile, um recurso`,
        );
      }
      ocupado.set(chave, id);
      (listas.get(id) as TileDeMapa[]).push([gx, gy]);
    }
  }
  for (const [id, lista] of listas) recursos[id] = lista;
}

/**
 * F20b — os limiares de condicao em TICKS, a partir da fracao do dado e da duracao
 * ja convertida. `Math.round` como toda conversao do carregador: o que a simulacao
 * compara e inteiro contra inteiro.
 *
 * `morte: 0.0` vira 0, que e o que `Unidade.condicao` alcanca por decremento — nao
 * ha arredondamento que possa transformar a morte num numero inalcancavel.
 */
/**
 * F20b — quanto cada comida devolve, em TICKS, para uma condicao cheia de `cheia`.
 * Mesmo motivo e mesma regra de `limiaresEmTicks`: a conta e do carregamento.
 *
 * `Math.round` por comida, e nao a soma arredondada no fim: a refeicao pode
 * consumir dois tipos (`loaves + sausages`), e arredondar duas vezes o mesmo
 * numero em dois momentos diferentes daria dois resultados.
 */
function restauracaoEmTicks(
  restauracao: RawGameData['condition']['restauracaoPorComida'], cheia: Ticks,
): Readonly<Record<string, Ticks>> {
  const porComida: Record<string, Ticks> = {};
  for (const [comida, fracao] of Object.entries(restauracao)) {
    porComida[comida] = Math.round(fracao * cheia);
  }
  return porComida;
}

function limiaresEmTicks(
  limiares: RawGameData['condition']['limiares'], cheia: Ticks,
): LimiaresEmTicks {
  return {
    alertaVisual: Math.round(limiares.alertaVisual * cheia),
    civilVaiComer: Math.round(limiares.civilVaiComer * cheia),
    morte: Math.round(limiares.morte * cheia),
  };
}

/**
 * Converte para ticks inteiros UMA vez. Nenhum sistema repete isto.
 * `escala === null` significa "deliberadamente sem escala": o valor em
 * segundos vira tick direto, sem dividir por nada (caso de
 * `delivery.alertaTarefaSemCandidato_segundos`).
 */
function paraTicksDeDuracao(
  valor: number, unidade: 'segundos' | 'min', escala: number | null, tickHz: number,
): Ticks {
  const segundos = unidade === 'min' ? valor * 60 : valor;
  const base = escala === null ? segundos : segundos / escala;
  const ticks = Math.round(base * tickHz);
  if (!Number.isFinite(ticks) || ticks < 1) {
    throw new Error(
      `loadGameData: duracao invalida apos conversao (${ticks} ticks; valor=${valor} ${unidade}, escala=${escala}) — deveria ter sido pega pelo validador`,
    );
  }
  return ticks;
}

/** Taxa (unidades por minuto) vira PERIODO em ticks — nunca taxa em float
 *  guardada para dividir depois em tempo de execucao. */
function taxaParaTicksPorUnidade(taxaPorMinuto: number, escala: number, tickHz: number): Ticks {
  const ticks = Math.round((60 * tickHz) / (taxaPorMinuto * escala));
  if (!Number.isFinite(ticks) || ticks < 1) {
    throw new Error(
      `loadGameData: taxa invalida apos conversao (${ticks} ticks; taxa=${taxaPorMinuto}/min, escala=${escala}) — deveria ter sido pega pelo validador`,
    );
  }
  return ticks;
}

/** Velocidade (tiles/segundo) + custo de terreno viram ticks por tile, num
 *  unico arredondamento — nao arredondar a velocidade e depois multiplicar
 *  pelo terreno, que arredondaria duas vezes. */
function ticksParaTile(
  velocidadeTilesPorSegundo: number, custoDeTerreno: number, escala: number, tickHz: number,
): Ticks {
  const ticks = Math.round((tickHz * custoDeTerreno) / (velocidadeTilesPorSegundo * escala));
  if (!Number.isFinite(ticks) || ticks < 1) {
    throw new Error(
      `loadGameData: movimento invalido apos conversao (${ticks} ticks; velocidade=${velocidadeTilesPorSegundo}, custo=${custoDeTerreno}, escala=${escala})`,
    );
  }
  return ticks;
}

/** Ticks do passo DIAGONAL: o passo reto vezes a raiz de 2 (geometria do grid, nao
 *  balanceamento), num unico arredondamento — `round(sqrt2 * x)`, nunca
 *  `round(sqrt2 * round(x))`, que arredondaria duas vezes (com custo 1.3, 9 e nao 10). */
function ticksParaTileDiagonal(
  velocidadeTilesPorSegundo: number, custoDeTerreno: number, escala: number, tickHz: number,
): Ticks {
  const ticks = Math.round((Math.SQRT2 * tickHz * custoDeTerreno) / (velocidadeTilesPorSegundo * escala));
  if (!Number.isFinite(ticks) || ticks < 1) {
    throw new Error(
      `loadGameData: movimento diagonal invalido apos conversao (${ticks} ticks; velocidade=${velocidadeTilesPorSegundo}, custo=${custoDeTerreno}, escala=${escala})`,
    );
  }
  return ticks;
}

/**
 * Busca o multiplicador de um grupo em `time.escalas` pelo nome que o
 * proprio arquivo declara (`raw.combat.escala`, `raw.units.escalaVelocidade`,
 * etc). O indexamento dinamico exige um `as`, mas o contrato e o mesmo de
 * `raw.ts`: `validate:data` (tempo/grupo-inexistente) ja garantiu que todo
 * nome declarado existe em `escalas` ou e `null` antes de `loadGameData`
 * rodar dentro de `npm run verify`.
 */
function escalaDe(escalas: RawGameData['time']['escalas'], nome: string | null): number | null {
  if (nome === null) return null;
  const valor = (escalas as unknown as Record<string, number>)[nome];
  if (typeof valor !== 'number') {
    throw new Error(`loadGameData: grupo de escala '${nome}' nao existe em time.escalas`);
  }
  return valor;
}

export function loadGameData(raw: RawGameData): GameData {
  const { tickHz } = raw.time;
  const tickMs = Math.round(1000 / tickHz);
  const { escalas } = raw.time; // consumido aqui, nunca reexportado em GameData

  const conversoes: ConversaoRegistrada[] = [];
  function registrar(
    caminho: string, grupo: string | null, valorBase: number, unidade: string, ticks: Ticks,
  ): Ticks {
    conversoes.push({ caminho, grupo, valorBase, unidade, ticks });
    return ticks;
  }

  // --- construcao ---
  const escalaConstrucaoNome = raw.buildings.construcao.escala;
  const escalaConstrucao = escalaDe(escalas, escalaConstrucaoNome);
  const construcao: ConstrucaoData = {
    hpPorMaterialEntregue: raw.buildings.construcao.hpPorMaterialEntregue,
    hpPorMartelada: raw.buildings.construcao.hpPorMartelada,
    laborersMaximosPorObra: raw.buildings.construcao.laborersMaximosPorObra,
    ticksPorMartelada: registrar(
      'buildings.construcao.segundosPorMartelada_base', escalaConstrucaoNome,
      raw.buildings.construcao.segundosPorMartelada_base, 'segundos',
      paraTicksDeDuracao(raw.buildings.construcao.segundosPorMartelada_base, 'segundos', escalaConstrucao, tickHz),
    ),
    ticksNivelamentoPorTile: registrar(
      'buildings.construcao.segundosNivelamentoPorTile_base', escalaConstrucaoNome,
      raw.buildings.construcao.segundosNivelamentoPorTile_base, 'segundos',
      paraTicksDeDuracao(raw.buildings.construcao.segundosNivelamentoPorTile_base, 'segundos', escalaConstrucao, tickHz),
    ),
    devolucaoAoDemolir: raw.buildings.construcao.devolucaoAoDemolir,
  };

  // --- producao: a receita vira um CICLO (F15a) ---
  // Cada taxa vira um periodo em ticks, como antes — a auditoria de conversao da
  // F03 continua registrando linha a linha. O CICLO e o periodo mais LENTO entre
  // entra e sai; as quantidades sao a razao dos periodos, arredondada UMA vez,
  // aqui. E isso que reproduz "1 tronco -> 2 timber" sem a quantidade estar
  // digitada em lugar nenhum: ela e a razao de duas taxas.
  const escalaEconomiaProducao = escalaDe(escalas, raw.production.escala);
  const receitas: Record<string, ReceitaDePredio> = {};
  for (const [predioId, def] of Object.entries(raw.production.predios)) {
    const periodos: { entra: Record<string, Ticks>; sai: Record<string, Ticks> } = { entra: {}, sai: {} };
    for (const grupo of ['entra', 'sai'] as const) {
      for (const [mercadoria, taxa] of Object.entries(def[grupo] as Record<string, number>)) {
        periodos[grupo][mercadoria] = registrar(
          `production.predios.${predioId}.${grupo}.${mercadoria}`, raw.production.escala,
          taxa, 'unidadesPorMinuto',
          taxaParaTicksPorUnidade(taxa, escalaEconomiaProducao as number, tickHz),
        );
      }
    }
    const todos = [...Object.values(periodos.entra), ...Object.values(periodos.sai)];
    if (todos.length === 0) {
      throw new Error(`loadGameData: receita '${predioId}' nao declara nem entrada nem saida`);
    }
    const ticksDoCiclo = Math.max(...todos);
    const quantidades = (p: Record<string, Ticks>): Record<string, number> => {
      const q: Record<string, number> = {};
      for (const [mercadoria, periodo] of Object.entries(p)) q[mercadoria] = Math.round(ticksDoCiclo / periodo);
      return q;
    };
    // `colheita` e opcional no JSON e so a quarry a declara hoje: `in` estreita a
    // uniao que o `resolveJsonModule` produz, sem `any` e sem campo inventado.
    const colheita = 'colheita' in def ? def.colheita : null;
    if (colheita !== null && !(colheita.recurso in raw.resources.tipos)) {
      throw new Error(
        `loadGameData: a receita '${predioId}' colhe '${colheita.recurso}', que nao existe em resources.tipos`,
      );
    }
    receitas[predioId] = {
      ticksDoCiclo,
      entra: quantidades(periodos.entra),
      sai: quantidades(periodos.sai),
      colheita: colheita === null ? null : { recurso: colheita.recurso, alcance: colheita.alcance_tiles },
    };
  }
  const producao: ProducaoData = {
    receitas,
    estoqueInternoPorPredio: raw.production.estoqueInternoPorPredio,
  };

  // --- movimento (velocidade x custo de terreno, matriz) ---
  const escalaMovimento = escalaDe(escalas, raw.units.escalaVelocidade) as number;
  const terrenos: readonly TerrenoTipo[] = ['estrada', 'grama', 'campoArado', 'areia'];
  function matrizPorModo(modo: 'aPe' | 'montado', velocidade: number): Record<TerrenoTipo, Ticks> {
    const linha = {} as Record<TerrenoTipo, Ticks>;
    for (const terreno of terrenos) {
      const custo = raw.terrain.custoDeMovimento[terreno];
      linha[terreno] = registrar(
        `movimento.ticksPorTile.${modo}.${terreno}`, raw.units.escalaVelocidade,
        custo / velocidade, 'segundosPorTile',
        ticksParaTile(velocidade, custo, escalaMovimento, tickHz),
      );
    }
    return linha;
  }
  function matrizDiagonalPorModo(modo: 'aPe' | 'montado', velocidade: number): Record<TerrenoTipo, Ticks> {
    const linha = {} as Record<TerrenoTipo, Ticks>;
    for (const terreno of terrenos) {
      const custo = raw.terrain.custoDeMovimento[terreno];
      linha[terreno] = registrar(
        `movimento.ticksPorTileDiagonal.${modo}.${terreno}`, raw.units.escalaVelocidade,
        (Math.SQRT2 * custo) / velocidade, 'segundosPorTile',
        ticksParaTileDiagonal(velocidade, custo, escalaMovimento, tickHz),
      );
    }
    return linha;
  }
  const movimento: MovimentoData = {
    ticksPorTile: {
      aPe: matrizPorModo('aPe', raw.units.velocidadeBase_tilesPorSegundo.aPe),
      montado: matrizPorModo('montado', raw.units.velocidadeBase_tilesPorSegundo.montado),
    },
    ticksPorTileDiagonal: {
      aPe: matrizDiagonalPorModo('aPe', raw.units.velocidadeBase_tilesPorSegundo.aPe),
      montado: matrizDiagonalPorModo('montado', raw.units.velocidadeBase_tilesPorSegundo.montado),
    },
  };

  // --- combate ---
  const escalaCombate = escalaDe(escalas, raw.combat.escala) as number;
  const combate: CombateData = {
    formula: raw.combat.formula,
    attackEfetivo: raw.combat.attackEfetivo,
    pisoAcerto: raw.combat.pisoAcerto,
    tetoAcerto: raw.combat.tetoAcerto,
    multiplicadorDirecao: raw.combat.multiplicadorDirecao,
    multiplicadorHP: raw.combat.multiplicadorHP,
    ticksCadenciaDeAtaque: registrar(
      'combat.cadenciaDeAtaque_segundos_base', raw.combat.escala,
      raw.combat.cadenciaDeAtaque_segundos_base, 'segundos',
      paraTicksDeDuracao(raw.combat.cadenciaDeAtaque_segundos_base, 'segundos', escalaCombate, tickHz),
    ),
    aDistancia: raw.combat.aDistancia,
    stormAttack: {
      multiplicadorVelocidade: raw.combat.stormAttack.multiplicadorVelocidade,
      ticksDuracao: registrar(
        'combat.stormAttack.duracao_segundos_base', raw.combat.escala,
        raw.combat.stormAttack.duracao_segundos_base, 'segundos',
        paraTicksDeDuracao(raw.combat.stormAttack.duracao_segundos_base, 'segundos', escalaCombate, tickHz),
      ),
      incontrolavel: raw.combat.stormAttack.incontrolavel,
    },
    watchtower: raw.combat.watchtower,
    formacao: raw.combat.formacao,
  };

  // --- condicao ---
  const escalaCondicaoNome = raw.condition.escala;
  const escalaCondicao = escalaDe(escalas, escalaCondicaoNome) as number;
  const ticksCondicaoCheiaCivil = registrar(
    'condition.duracaoCondicaoCheia_min_base.civil', escalaCondicaoNome,
    raw.condition.duracaoCondicaoCheia_min_base.civil, 'min',
    paraTicksDeDuracao(raw.condition.duracaoCondicaoCheia_min_base.civil, 'min', escalaCondicao, tickHz),
  );
  const ticksCondicaoCheiaMilitar = registrar(
    'condition.duracaoCondicaoCheia_min_base.militar', escalaCondicaoNome,
    raw.condition.duracaoCondicaoCheia_min_base.militar, 'min',
    paraTicksDeDuracao(raw.condition.duracaoCondicaoCheia_min_base.militar, 'min', escalaCondicao, tickHz),
  );
  const condicao: CondicaoData = {
    ticksCondicaoCheia: { civil: ticksCondicaoCheiaCivil, militar: ticksCondicaoCheiaMilitar },
    limiares: raw.condition.limiares,
    // F20b — os mesmos limiares JA EM TICKS, por classe. A conta acontece aqui e
    // so aqui (CLAUDE.md secao 5: converter em tempo de execucao quebra o
    // determinismo). NAO entra em `conversoes`: aquela tabela registra base ->
    // tick com unidade de tempo, e isto e fracao x duracao ja convertida.
    ticksNoLimiar: {
      civil: limiaresEmTicks(raw.condition.limiares, ticksCondicaoCheiaCivil),
      militar: limiaresEmTicks(raw.condition.limiares, ticksCondicaoCheiaMilitar),
    },
    restauracaoPorComida: raw.condition.restauracaoPorComida,
    ticksRestauradosPorComida: {
      civil: restauracaoEmTicks(raw.condition.restauracaoPorComida, ticksCondicaoCheiaCivil),
      militar: restauracaoEmTicks(raw.condition.restauracaoPorComida, ticksCondicaoCheiaMilitar),
    },
    regraCivil: raw.condition.regraCivil,
    regraMilitar: raw.condition.regraMilitar,
    inn: raw.condition.inn,
    populacao: raw.condition.populacao,
  };

  // --- entrega (delivery) — escala null e decisao explicita, nao ausencia ---
  const entrega: EntregaData = {
    prioridades: raw.delivery.prioridades,
    desempate: raw.delivery.desempate,
    reserva: raw.delivery.reserva,
    ticksAlertaTarefaSemCandidato: registrar(
      'delivery.alertaTarefaSemCandidato_segundos', raw.delivery.escala,
      raw.delivery.alertaTarefaSemCandidato_segundos, 'segundos',
      paraTicksDeDuracao(
        raw.delivery.alertaTarefaSemCandidato_segundos, 'segundos',
        escalaDe(escalas, raw.delivery.escala), tickHz,
      ),
    ),
    maxSerfsNoMarketplace: raw.delivery.maxSerfsNoMarketplace,
  };

  // --- terreno (sem duracao — custos sao multiplicadores adimensionais) ---
  const terreno: TerrenoData = {
    tilePx: raw.terrain.tile_px,
    estrada: raw.terrain.estrada,
    custoDeMovimento: raw.terrain.custoDeMovimento,
    intransponivel: raw.terrain.intransponivel,
    colisao: raw.terrain.colisao,
    pathfinding: raw.terrain.pathfinding,
    mapaPadrao: raw.terrain.mapaPadrao,
    zoom: raw.terrain.zoom,
    camera: raw.terrain.camera,
  };

  // --- recursos (resources.json): regime e rendimento por TIPO ---------------
  // O regime vem do dado como string e e conferido contra a uniao aqui, uma vez:
  // um regime novo em `data/` sem sistema que o entenda reprova o carregamento,
  // e nao vira "nao acontece nada" dentro da partida.
  const REGIMES: readonly RegimeDeRecurso[] = ['nunca', 'porAcao', 'porTempo'];
  const tiposDeRecurso: Record<string, TipoDeRecurso> = {};
  for (const [id, def] of Object.entries(raw.resources.tipos)) {
    const regime = REGIMES.find((r) => r === def.regime);
    if (regime === undefined) {
      throw new Error(`loadGameData: o recurso '${id}' declara o regime desconhecido '${def.regime}'`);
    }
    // F-T2b: `=== true` e nao coercao. Campo ausente ou `"true"` de string tem
    // de virar `false` aqui e ser acusado pelo `validate:data`, nao virar
    // "bloqueia" por acidente de tipo — o dado e a fonte, e ele e booleano.
    // F18: `terreno` diz que a camada deste tipo e DERIVADA do mapa base em vez
    // de vir da lista esparsa (ver `carregarRecursosDoMapa`), e `reposicao` e o
    // que um predio gasta para repor um tile. A duracao vira tick AQUI, uma vez,
    // como toda duracao — o caminho e por tipo e esta registrado em
    // `tools/data-schema.js`, um por linha, de proposito.
    const cru = def as RawTipoDeRecurso;
    const reposicao = cru.reposicao;
    tiposDeRecurso[id] = {
      regime, rendimentoPorTile: def.rendimentoPorTile, bloqueiaPasso: def.bloqueiaPasso === true,
      bloqueiaConstrucao: cru.bloqueiaConstrucao === true,
      terreno: cru.terreno ?? null,
      quantidadeInicial: cru.quantidadeInicial ?? null,
      reposicao: reposicao === undefined ? null : {
        ticks: registrar(
          `resources.tipos.${id}.reposicao.segundos_base`, raw.resources.escala,
          reposicao.segundos_base, 'segundos',
          paraTicksDeDuracao(
            reposicao.segundos_base, 'segundos', escalaDe(escalas, raw.resources.escala), tickHz,
          ),
        ),
        custo: semChavesDeDoc(reposicao.custo),
      },
    };
  }
  const recursos: RecursosData = {
    tipos: tiposDeRecurso,
    ticksPorUnidadeRegenerada: registrar(
      'resources.regimes.porTempo.segundosPorUnidade_base', raw.resources.escala,
      raw.resources.regimes.porTempo.segundosPorUnidade_base, 'segundos',
      paraTicksDeDuracao(
        raw.resources.regimes.porTempo.segundosPorUnidade_base, 'segundos',
        escalaDe(escalas, raw.resources.escala), tickHz,
      ),
    ),
  };

  // --- economia (economy.json) ---
  const escalaSchoolhouseNome = raw.economy.schoolhouse.escala;
  const escalaSchoolhouse = escalaDe(escalas, escalaSchoolhouseNome) as number;
  const economia: EconomiaData = {
    estadoInicial: raw.economy.estadoInicial,
    schoolhouse: {
      custoOuroPorUnidade: raw.economy.schoolhouse.custoOuroPorUnidade,
      slotsDeFila: raw.economy.schoolhouse.slotsDeFila,
      ticksPorTreino: registrar(
        'economy.schoolhouse.segundosPorTreino_base', escalaSchoolhouseNome,
        raw.economy.schoolhouse.segundosPorTreino_base, 'segundos',
        paraTicksDeDuracao(raw.economy.schoolhouse.segundosPorTreino_base, 'segundos', escalaSchoolhouse, tickHz),
      ),
      reembolsoSeNaoIniciado: raw.economy.schoolhouse.reembolsoSeNaoIniciado,
    },
    storehouse: raw.economy.storehouse,
    marketplace: raw.economy.marketplace,
    mercadorias: raw.economy.mercadorias,
    bloqueioPadraoNoArmazem: raw.economy.bloqueioPadraoNoArmazem,
    grupos: raw.economy.grupos,
  };

  // --- unidades (civis/militares/mercenarios — sem campo de tempo aqui;
  //     velocidade ja foi consumida pela matriz de movimento acima) ---
  const unidades: UnidadesData = {
    civis: raw.units.civis,
    militares: raw.units.militares,
    mercenarios: raw.units.mercenarios,
  };

  return {
    tempo: { tickHz, tickMs, velocidadeDeJogo: raw.time.velocidadeDeJogo },
    predios: raw.buildings.predios,
    construcao,
    producao,
    unidades,
    movimento,
    combate,
    condicao,
    entrega,
    terreno,
    mapa: carregarMapa(raw),
    recursos,
    economia,
    conversoes,
  };
}
