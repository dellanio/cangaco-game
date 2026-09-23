import type { RawGameData } from './raw';
import type {
  CombateData, CondicaoData, ConstrucaoData, ConversaoRegistrada, EconomiaData,
  EntregaData, GameData, MovimentoData, ProducaoData, ReceitaDePredio,
  TerrenoData, TerrenoTipo, Ticks, UnidadesData,
} from './types';

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
    // `veio` e opcional no JSON e so a quarry o declara hoje: `in` estreita a
    // uniao que o `resolveJsonModule` produz, sem `any` e sem campo inventado.
    const veio = 'veio' in def ? def.veio : null;
    receitas[predioId] = {
      ticksDoCiclo,
      entra: quantidades(periodos.entra),
      sai: quantidades(periodos.sai),
      rendimentoDoVeio: veio === null ? null : veio.rendimento,
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
  const condicao: CondicaoData = {
    ticksCondicaoCheia: {
      civil: registrar(
        'condition.duracaoCondicaoCheia_min_base.civil', escalaCondicaoNome,
        raw.condition.duracaoCondicaoCheia_min_base.civil, 'min',
        paraTicksDeDuracao(raw.condition.duracaoCondicaoCheia_min_base.civil, 'min', escalaCondicao, tickHz),
      ),
      militar: registrar(
        'condition.duracaoCondicaoCheia_min_base.militar', escalaCondicaoNome,
        raw.condition.duracaoCondicaoCheia_min_base.militar, 'min',
        paraTicksDeDuracao(raw.condition.duracaoCondicaoCheia_min_base.militar, 'min', escalaCondicao, tickHz),
      ),
    },
    limiares: raw.condition.limiares,
    restauracaoPorComida: raw.condition.restauracaoPorComida,
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
    campos: raw.terrain.campos,
    custoDeMovimento: raw.terrain.custoDeMovimento,
    intransponivel: raw.terrain.intransponivel,
    colisao: raw.terrain.colisao,
    pathfinding: raw.terrain.pathfinding,
    mapaPadrao: raw.terrain.mapaPadrao,
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
    economia,
    conversoes,
  };
}
