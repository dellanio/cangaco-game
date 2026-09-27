/**
 * F19b — A SEGUNDA COMIDA: milho -> bode -> carne de sol, sem uma linha de
 * codigo nova.
 *
 * O item mandou MEDIR antes de implementar, como a F19, e a medicao respondeu
 * que a cadeia ja fecha: a producao e generica desde a F15a, a tarefa de insumo
 * entre predios existe desde a F15b, e a gaveta de saida com DUAS mercadorias
 * ja era prevista (`cabeNaSaida` soma a gaveta inteira: "a granja enche a mesma
 * gaveta com porco e couro"). O que faltava era PROVA — sonda prova o momento,
 * teste prova o amanha (CLAUDE.md §8).
 *
 * Tudo medido contra o TICK 0: o armazem da abertura abre com `sausages: 10`
 * (`economy.json estadoInicial.estoque`), e contra zero absoluto este teste
 * passaria com o presente da abertura em vez de uma carne produzida.
 *
 * "Chega ao armazem" e mais estrito do que a F19 mediu: o eixo e
 * `estoqueDosArmazens`, que so sobe quando a tarefa de transporte TERMINA no
 * armazem — gaveta de predio nao conta.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import { estoqueDosArmazens, opcoesDoMenuBuild } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';
import {
  cenarioDaCadeiaDaCarne, cenarioDaCarneSemFazenda, cenarioDaCarneSemGranja, fsmSeVivo,
} from './helpers/producao-cenario';

const FAZENDA = receitaDoTipo('farm', gameData);
const GRANJA = receitaDoTipo('swine_farm', gameData);
const ACOUGUE = receitaDoTipo('butchers', gameData);
if (FAZENDA?.colheita == null || GRANJA === null || ACOUGUE === null) {
  throw new Error('fixture: farm, swine_farm e butchers precisam de receita em data/production.json');
}

const GRAO = FAZENDA.colheita.recurso;
const BODE = Object.keys(ACOUGUE.entra)[0] ?? '';
const CARNE = Object.keys(ACOUGUE.sai)[0] ?? '';
/** A OUTRA saida da granja, qualquer que seja o id: o couro entra aqui por
 *  exclusao, nunca digitado. */
const COURO = Object.keys(GRANJA.sai).filter((m) => m !== BODE)[0] ?? '';

const PLANTIO = gameData.recursos.tipos[GRAO]?.reposicao?.ticksDeSemear ?? 0;
const GRAOS_POR_BODE = GRANJA.entra[GRAO] ?? 0;
const CARNES_POR_BODE = ACOUGUE.sai[CARNE] ?? 0;

/** A latencia minima da cadeia: plantar, colher, criar, carnear. Nenhum
 *  transporte cabe aqui, e e por isso que ela e um piso que nada pode furar. */
const PISO_DA_CADEIA = PLANTIO + FAZENDA.ticksDoCiclo + GRANJA.ticksDoCiclo + ACOUGUE.ticksDoCiclo;

/**
 * Tolerancia de TRANSPORTE, nao de balanceamento: o serf leva o milho da
 * fazenda ao armazem, do armazem a Malhada, o bode a Casa de Carne e a carne de
 * volta — quatro viagens na cadeia, e isso nao e de graca. A medicao desta
 * sessao deu 93 % do teto; 85 % e o mesmo numero e o mesmo motivo da F19.
 */
const PISO_DA_VAZAO = 0.85;

const JANELA = 20000;

interface Corrida {
  readonly produzido: Readonly<Record<string, number>>;
  readonly primeiroNoArmazem: Readonly<Record<string, number | null>>;
  readonly esperandoInsumo: Readonly<Record<string, number>>;
  readonly serie: Readonly<Record<number, Readonly<Record<string, number>>>>;
  readonly baseDosArmazens: Readonly<Record<string, number>>;
  readonly fim: GameState;
  /**
   * F20b — o ultimo `fsm` que cada especialista teve ENQUANTO VIVO. O cenario a
   * que falta um elo nao produz comida nenhuma (a carne de sol e o unico alimento
   * desta cadeia), entao quem ele observa morre de fome dentro da janela: ler `fsm`
   * no fim lancaria, e ler num tick digitado seria numero magico.
   */
  readonly ultimoFsm: Readonly<Record<string, string>>;
  /** Civis de pe no fim da janela, e mortes de fome na janela inteira. */
  readonly populacao: number;
  readonly mortes: number;
}

const OBSERVADAS: readonly string[] = [GRAO, BODE, COURO, CARNE];

/**
 * Roda a janela inteira anotando o que so uma serie responde: producao
 * ACUMULADA (por evento `goods-produced`, que nao desce quando o insumo e
 * consumido) e o primeiro tick em que cada mercadoria SOBE no armazem acima da
 * linha de base.
 */
function rodar(inicial: GameState, ticks: number, especialistas: readonly string[]): Corrida {
  const produzido: Record<string, number> = {};
  const primeiroNoArmazem: Record<string, number | null> = {};
  const esperandoInsumo: Record<string, number> = {};
  const serie: Record<number, Record<string, number>> = {};
  const baseDosArmazens = { ...estoqueDosArmazens(inicial) };
  const ultimoFsm: Record<string, string> = {};
  let mortes = 0;
  for (const m of OBSERVADAS) primeiroNoArmazem[m] = null;
  for (const u of especialistas) {
    esperandoInsumo[u] = 0;
    // a fixture confere a si mesma: nome errado falha AQUI, e nao como um contador
    // que fica em zero porque a unidade nunca existiu.
    if (fsmSeVivo(inicial, u) === null) throw new Error(`fixture: unidade '${u}' nao existe no cenario`);
  }

  let s = inicial;
  for (let t = 1; t <= ticks; t += 1) {
    s = step(s, [], gameData);
    for (const ev of s.events) {
      if (ev.type === 'goods-produced') {
        produzido[ev.mercadoria] = (produzido[ev.mercadoria] ?? 0) + ev.quantidade;
      }
      if (ev.type === 'unit-starved') mortes += 1;
    }
    const noArmazemAgora = estoqueDosArmazens(s);
    for (const m of OBSERVADAS) {
      if (primeiroNoArmazem[m] === null && (noArmazemAgora[m] ?? 0) > (baseDosArmazens[m] ?? 0)) {
        primeiroNoArmazem[m] = t;
      }
    }
    for (const u of especialistas) {
      const fsm = fsmSeVivo(s, u);
      if (fsm === null) continue;
      ultimoFsm[u] = fsm;
      if (fsm === 'esperando_insumo') esperandoInsumo[u] = (esperandoInsumo[u] ?? 0) + 1;
    }
    if (t % (ticks / 4) === 0) {
      serie[t] = Object.fromEntries(OBSERVADAS.map((m) => [m, produzido[m] ?? 0]));
    }
  }
  return {
    produzido, primeiroNoArmazem, esperandoInsumo, serie, baseDosArmazens, fim: s,
    ultimoFsm, populacao: s.unidades.ordem.length, mortes,
  };
}

/** Uma corrida por cenario, calculada na primeira vez que alguem pergunta: a sim
 *  e pura, entao tres testes lendo a MESMA corrida leem o mesmo estado. */
function umaVez(monta: () => Corrida): () => Corrida {
  let cache: Corrida | null = null;
  return () => (cache ??= monta());
}

/**
 * O `timeout` destas corridas NAO e assercao de desempenho (CLAUDE.md secao 8): ele
 * existe para o caso travar, como o dos 20 s de `tests/F09-sistema.test.ts`. Cada
 * corrida roda a janela inteira de simulacao, e o padrao de 5 s do Vitest reprova
 * por carga da maquina — o arquivo inteiro leva ~7 s medidos nesta sessao contra
 * ~4,6 s antes da fome, e em suite paralela isso estoura sozinho.
 */
const TIMEOUT_DA_CORRIDA = 60_000;

const TRES: readonly string[] = ['roceiro', 'criador', 'carneador'];
const completa = umaVez(() => rodar(cenarioDaCadeiaDaCarne(), JANELA, TRES));
const semGranja = umaVez(() => rodar(cenarioDaCarneSemGranja(), JANELA, ['roceiro', 'carneador']));
const semFazenda = umaVez(() => rodar(cenarioDaCarneSemFazenda(), JANELA, ['criador', 'carneador']));

const acimaDaBase = (c: Corrida, m: string): number =>
  (estoqueDosArmazens(c.fim)[m] ?? 0) - (c.baseDosArmazens[m] ?? 0);

describe('F19b — a cadeia fecha: milho vira bode, bode vira carne de sol', () => {
  it('os tres elos sao mesmo uma cadeia no dado, e nao tres receitas soltas', () => {
    // Guarda estrutural: se alguem trocar a saida da granja, os marcos abaixo
    // deixam de descrever a cadeia, e este teste cai antes deles.
    expect(FAZENDA.sai[GRAO]).toBeGreaterThan(0);
    expect(GRAOS_POR_BODE).toBeGreaterThan(0);
    expect(GRANJA.sai[BODE]).toBeGreaterThan(0);
    expect(CARNES_POR_BODE).toBeGreaterThan(0);
    expect([GRAO, BODE, COURO, CARNE]).toEqual(['corn', 'pigs', 'skins', 'sausages']);
  });

  it('a carne de sol CHEGA AO ARMAZEM, e nunca antes do que a cadeia permite', () => {
    const c = completa();
    expect(acimaDaBase(c, CARNE)).toBeGreaterThan(0);
    const primeira = c.primeiroNoArmazem[CARNE];
    expect(primeira).not.toBeNull();
    expect(primeira ?? 0).toBeGreaterThan(PISO_DA_CADEIA);
  }, TIMEOUT_DA_CORRIDA);

  it('e a vila sobrevive a janela inteira: a propria cadeia alimenta quem a move', () => {
    // F20b — a carne de sol E comida (`condition.json restauracaoPorComida.sausages`),
    // e a Bodega do cenario a puxa do armazem pelo nivel 1 da F20a. A janela de
    // 20 000 ticks e mais de uma condicao cheia de civil (12 000): cadeia que
    // continuasse entregando com todos mortos seria a prova de que o dreno nao chegou.
    const c = completa();
    expect(c.mortes).toBe(0);
    expect(c.populacao).toBe(cenarioDaCadeiaDaCarne().unidades.ordem.length);
    expect(TRES.map((u) => fsmSeVivo(c.fim, u))).not.toContain(null);
  }, TIMEOUT_DA_CORRIDA);

  it('e cada elo chega na sua vez: milho, depois bode, depois carne', () => {
    const c = completa();
    const milho = c.primeiroNoArmazem[GRAO] ?? 0;
    const bode = c.primeiroNoArmazem[BODE] ?? 0;
    const carne = c.primeiroNoArmazem[CARNE] ?? 0;
    expect(milho).toBeGreaterThan(0);
    expect(bode).toBeGreaterThan(milho);
    expect(carne).toBeGreaterThan(bode);
  }, TIMEOUT_DA_CORRIDA);
});

describe('F19b — os dois elos do meio sao reais', () => {
  it('sem a Malhada nao ha uma carne, o milho se acumula, e o carneador espera', () => {
    const c = semGranja();
    expect(c.produzido[CARNE] ?? 0).toBe(0);
    expect(c.produzido[BODE] ?? 0).toBe(0);
    expect(acimaDaBase(c, CARNE)).toBe(0);
    // a fazenda continua produzindo: o que parou foi a cadeia, nao o mapa.
    expect(c.produzido[GRAO] ?? 0).toBeGreaterThan(0);
    expect(acimaDaBase(c, GRAO)).toBeGreaterThan(0);
    expect(c.ultimoFsm.carneador).toBe('esperando_insumo');
    // F20b: sem a Malhada nao ha carne, e sem carne nao ha comida — a vila inteira
    // morre de fome dentro da janela. A morte entra como assercao propria, mais
    // estrita do que a leitura antiga do `fsm` no fim.
    expect(c.mortes).toBeGreaterThan(0);
    expect(c.populacao).toBe(0);
  }, TIMEOUT_DA_CORRIDA);

  it('sem a Fazenda nao nasce um bode, e os dois especialistas esperam', () => {
    const c = semFazenda();
    expect(Object.keys(c.produzido)).toEqual([]);
    expect(acimaDaBase(c, CARNE)).toBe(0);
    expect(c.ultimoFsm.criador).toBe('esperando_insumo');
    expect(c.ultimoFsm.carneador).toBe('esperando_insumo');
    // F20b: mesma razao do cenario acima — vila sem comida nao tem civil de pe.
    expect(c.populacao).toBe(0);
  }, TIMEOUT_DA_CORRIDA);
});

describe('F19b — a vazao e limitada pela FONTE, e nada se perde', () => {
  it('o bode cabe no teto do milho, e a carne no teto do bode', () => {
    const c = completa();
    const graos = c.produzido[GRAO] ?? 0;
    const bodes = c.produzido[BODE] ?? 0;
    const carnes = c.produzido[CARNE] ?? 0;
    const tetoDeBodes = Math.floor(graos / GRAOS_POR_BODE);
    // TETO: passar disso seria mercadoria nascendo do nada.
    expect(bodes).toBeLessThanOrEqual(tetoDeBodes);
    expect(carnes).toBeLessThanOrEqual(CARNES_POR_BODE * bodes);
    // PISO: o transporte custa, mas nao pode ser o gargalo.
    expect(carnes).toBeGreaterThanOrEqual(PISO_DA_VAZAO * CARNES_POR_BODE * tetoDeBodes);
  }, TIMEOUT_DA_CORRIDA);

  it('o bode nao represa: nem na gaveta da Casa de Carne nem no armazem', () => {
    // Se o bode empilhasse, a cadeia estaria entregando sem consumir — e o teto
    // acima continuaria verde. Aqui a pergunta e outra: o elo escoa?
    const c = completa();
    const acougue = c.fim.predios.porId['bu1'];
    if (acougue?.estado !== 'completo') throw new Error('fixture: bu1 deveria estar completo');
    const teto = acougue.capacidade.entrada ?? Infinity;
    expect(acougue.estoque.entrada[BODE] ?? 0).toBeLessThan(teto);
    expect(acimaDaBase(c, BODE)).toBeLessThanOrEqual(GRANJA.sai[BODE] ?? 0);
  }, TIMEOUT_DA_CORRIDA);
});

describe('F19b — a granja tem DUAS saidas, e as duas chegam', () => {
  it('bode e couro saem do mesmo ciclo e a mesma gaveta carrega os dois', () => {
    // Uma receita de duas saidas que entregasse so a primeira passaria em todos
    // os criterios acima e ninguem veria.
    expect(Object.keys(GRANJA.sai)).toHaveLength(2);
    expect(unidadesPorCiclo(GRANJA)).toBe(2);
    const c = completa();
    expect(c.produzido[COURO] ?? 0).toBe(c.produzido[BODE] ?? 0);
    expect(acimaDaBase(c, COURO)).toBeGreaterThan(0);
  }, TIMEOUT_DA_CORRIDA);
});

describe('F19b — o jogador alcanca a cadeia', () => {
  it('a arvore leva serraria -> fazenda -> Malhada -> Casa de Carne', () => {
    // Sem a corrente de `desbloqueadoPor` a cadeia existiria so dentro de teste,
    // que e onde ela NAO pode existir.
    const daVila = new Map(
      opcoesDoMenuBuild(createInitialState(gameData.economia.estadoInicial.semente, gameData))
        .map((o) => [o.id, o]),
    );
    expect(daVila.get('swine_farm')?.desbloqueado).toBe(false);
    expect(daVila.get('swine_farm')?.requer).toBe('farm');
    expect(daVila.get('butchers')?.desbloqueado).toBe(false);
    expect(daVila.get('butchers')?.requer).toBe('swine_farm');

    const comFazenda = new Map(opcoesDoMenuBuild(cenarioDaCarneSemGranja()).map((o) => [o.id, o]));
    expect(comFazenda.get('swine_farm')?.desbloqueado).toBe(true);
  });
});

describe('F19b — evidencia', () => {
  it('grava a serie medida', () => {
    const c = completa();
    const fracao = (v: number): number => Number((v / JANELA).toFixed(3));
    const tetoDeBodes = Math.floor((c.produzido[GRAO] ?? 0) / GRAOS_POR_BODE);
    gravarEvidencia('F19b', {
      feature: 'F19b-cadeia-da-carne',
      aceite: 'BUILD_PLAN.md F19b: a carne de sol chega ao armazem partindo do estado inicial',
      medicao: 'a cadeia fecha sem codigo novo; o escopo virou prova, evidencia e o que ela expos',
      derivadoDoDado: {
        elos: { GRAO, BODE, COURO, CARNE },
        ticksDoCiclo: {
          farm: FAZENDA.ticksDoCiclo, swine_farm: GRANJA.ticksDoCiclo, butchers: ACOUGUE.ticksDoCiclo,
        },
        ticksDePlantio: PLANTIO,
        graosPorBode: GRAOS_POR_BODE,
        carnesPorBode: CARNES_POR_BODE,
        saidasDaGranja: Object.keys(GRANJA.sai),
        pisoDaCadeia: PISO_DA_CADEIA,
      },
      linhaDeBaseDoTick0: {
        armazens: c.baseDosArmazens,
        nota: 'o armazem da abertura ja traz sausages: 10 — medir contra zero mediria o dado de abertura',
      },
      cadeiaCompleta: {
        janela: JANELA,
        primeiroNoArmazem: c.primeiroNoArmazem,
        produzido: c.produzido,
        serieDeProducao: c.serie,
        saldoAcimaDaBase: Object.fromEntries(OBSERVADAS.map((m) => [m, acimaDaBase(c, m)])),
        armazensNoFim: estoqueDosArmazens(c.fim),
        tetoDeBodes,
        fracaoDoTeto: Number(((c.produzido[CARNE] ?? 0) / (CARNES_POR_BODE * tetoDeBodes)).toFixed(3)),
        fracaoEsperandoInsumo: Object.fromEntries(
          Object.entries(c.esperandoInsumo).map(([k, v]) => [k, fracao(v)]),
        ),
        fome: { populacaoNoFim: c.populacao, mortesDeFome: c.mortes, ultimoFsm: c.ultimoFsm },
      },
      semAMalhada: {
        janela: JANELA,
        produzido: semGranja().produzido,
        milhoEmpilhadoNoArmazem: acimaDaBase(semGranja(), GRAO),
        carneador: semGranja().ultimoFsm.carneador,
        fome: { populacaoNoFim: semGranja().populacao, mortesDeFome: semGranja().mortes },
      },
      semAFazenda: {
        janela: JANELA,
        produzido: semFazenda().produzido,
        criador: semFazenda().ultimoFsm.criador,
        carneador: semFazenda().ultimoFsm.carneador,
        fome: { populacaoNoFim: semFazenda().populacao, mortesDeFome: semFazenda().mortes },
      },
    });
    expect(true).toBe(true);
  }, TIMEOUT_DA_CORRIDA);
});
