/**
 * D-PRODUCAO-01a (antes F29) — A CADEIA DO FERRO no mapa emitido: mina de ferro e de
 * carvao no veio da serra, fundicao, ferraria de armas e de armaduras.
 * Plano: docs/planos/2026-09-29-D-PRODUCAO-01-ferro-e-ferrarias.md.
 *
 * A sonda veio primeiro, como na F21 (ouro), e deu o mesmo resultado: a cadeia fecha
 * ate a arma sem codigo novo — colheita a distancia da F21b, producao generica da
 * F15a, tarefa de insumo da F15b, rodizio de peso 1 da F24a. O que se entrega e o
 * GUARDA. Tudo aqui passa pelo `step` (regra do operador, 2026-09-29).
 *
 * O que NAO se afirma, e esta na D-PRODUCAO-01b: a ferraria de armaduras produzir. Com
 * uma mina de carvao para tres consumidores, a tarefa de insumo vai sempre para o
 * destino de menor caminho, e a de armaduras nunca recebe carvao (sonda: 0 em 12 000
 * ticks). Afirmar isso codificaria o defeito; afirma-se so que o ferro chega nela.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import {
  cenarioDaCadeiaDoFerro, cenarioDoFerroSemCarvao, cenarioDoFerroSemMina, disponivelDe,
} from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;

/** Teto de SEGURANCA, nao afirmacao de desempenho: a sonda mediu a primeira arma no
 *  tick 2312. Cadeia que nao fecha em 5000 esta travada, nao lenta. */
const TETO_DA_CADEIA = 5000;

/** Os contra-exemplos rodam a mesma janela: se o ferro nao aparece em 2000 ticks, com a
 *  cadeia inteira fazendo o primeiro em ~1000, e porque falta o elo. */
const JANELA_DO_CONTRA_EXEMPLO = 2000;

const ARMAS = ['sword', 'pike', 'crossbow'] as const;

const completo = (e: GameState, id: string): PredioCompleto => {
  const p = e.predios.porId[id];
  if (p?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
};

/** O bem nas duas gavetas de todo predio e na mao de toda unidade. */
function totalNoMundo(e: GameState, bem: string): number {
  let total = 0;
  for (const id of e.predios.ordem) {
    const p = e.predios.porId[id];
    if (p?.estado !== 'completo') continue;
    total += (p.estoque.entrada[bem] ?? 0) + (p.estoque.saida[bem] ?? 0);
  }
  for (const u of Object.values(e.unidades.porId)) if (u.fsmData.carga === bem) total += 1;
  return total;
}

interface Registro {
  /** primeiro tick de cada `goods-produced`, por `predio:mercadoria` */
  readonly produziu: Record<string, number>;
  /** primeiro tick de cada `task-completed`, por `destino:mercadoria` */
  readonly entregou: Record<string, number>;
}

/** Roda pelo `step` ate `pare` dizer sim, ou estoura com o motivo. */
function rodarAte(
  inicial: GameState, pare: (e: GameState, r: Registro) => boolean, teto: number, oQue: string,
): { readonly estado: GameState; readonly registro: Registro; readonly tick: number } {
  let s = inicial;
  const registro: Registro = { produziu: {}, entregou: {} };
  for (let t = 1; t <= teto; t += 1) {
    s = step(s, [], DADOS);
    for (const ev of s.events) {
      if (ev.type === 'goods-produced') registro.produziu[`${ev.predio}:${ev.mercadoria}`] ??= t;
      if (ev.type === 'task-completed') registro.entregou[`${ev.destino}:${ev.mercadoria}`] ??= t;
    }
    if (pare(s, registro)) return { estado: s, registro, tick: t };
  }
  throw new Error(`${oQue} nao aconteceu em ${teto} ticks`);
}

const fezArma = (r: Registro): boolean => ARMAS.some((a) => r.produziu[`ws1:${a}`] !== undefined);

describe('D-PRODUCAO-01a — a cadeia do ferro fecha no mapa emitido', () => {
  const inicio = cenarioDaCadeiaDoFerro();
  const { estado, registro, tick } = rodarAte(
    inicio, (_e, r) => fezArma(r) && r.entregou['as1:iron'] !== undefined,
    TETO_DA_CADEIA, 'a primeira arma e o ferro na ferraria de armaduras',
  );

  it('linha de base: nenhum ferro, minerio ou carvao no mundo no tick 0', () => {
    for (const bem of ['iron', 'iron_ore', 'coal', ...ARMAS]) expect(totalNoMundo(inicio, bem), bem).toBe(0);
  });

  it('aceite 1 — as duas minas colhem do veio do mapa: o veio ao alcance cai', () => {
    const antes = { fe1: disponivelDe(inicio, 'fe1', DADOS) ?? 0, co1: disponivelDe(inicio, 'co1', DADOS) ?? 0 };
    const depois = { fe1: disponivelDe(estado, 'fe1', DADOS) ?? 0, co1: disponivelDe(estado, 'co1', DADOS) ?? 0 };
    expect(antes.fe1).toBeGreaterThan(0);
    expect(antes.co1).toBeGreaterThan(0);
    expect(depois.fe1).toBeLessThan(antes.fe1);
    expect(depois.co1).toBeLessThan(antes.co1);
    expect(registro.produziu['fe1:iron_ore']).toBeDefined();
    expect(registro.produziu['co1:coal']).toBeDefined();
  });

  it('aceite 2 — o ferro nasce na fundicao, depois de os dois insumos chegarem a ela', () => {
    const ferro = registro.produziu['fu1:iron'];
    const minerio = registro.entregou['fu1:iron_ore'];
    const carvao = registro.entregou['fu1:coal'];
    expect(ferro).toBeDefined();
    expect(minerio).toBeDefined();
    expect(carvao).toBeDefined();
    expect(ferro ?? 0).toBeGreaterThan(Math.max(minerio ?? 0, carvao ?? 0));
    // e ninguem mais fez ferro: a fundicao e a origem
    expect(Object.keys(registro.produziu).filter((k) => k.endsWith(':iron'))).toEqual(['fu1:iron']);
  });

  it('aceite 3 — o ferro da fundicao chega as duas ferrarias', () => {
    expect(registro.entregou['ws1:iron']).toBeDefined();
    expect(registro.entregou['as1:iron']).toBeDefined();
  });

  it('aceite 4 — a ferraria de armas faz arma com esse ferro', () => {
    const primeira = Math.min(...ARMAS.map((a) => registro.produziu[`ws1:${a}`] ?? Number.POSITIVE_INFINITY));
    expect(Number.isFinite(primeira)).toBe(true);
    expect(primeira).toBeGreaterThan(registro.entregou['ws1:iron'] ?? Number.POSITIVE_INFINITY);
    expect(ARMAS.reduce((n, a) => n + totalNoMundo(estado, a), 0)).toBeGreaterThan(0);
  });

  it('aceite 6 — pelo step, sem violar invariante do JobBoard nem da FSM', () => {
    expect(violacoesDeInvariantes(estado, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(estado, DADOS)).toEqual([]);
    gravarEvidencia('D-PRODUCAO-01a-cadeia-do-ferro', {
      posicoes: Object.fromEntries(['arm', 'fe1', 'co1', 'fu1', 'ws1', 'as1', 'bodega']
        .map((id) => [id, { tipo: completo(inicio, id).tipo, gx: completo(inicio, id).gx, gy: completo(inicio, id).gy }])),
      veioNoTick0: { fe1: disponivelDe(inicio, 'fe1', DADOS), co1: disponivelDe(inicio, 'co1', DADOS) },
      tickDaParada: tick,
      primeiroTick: registro,
    });
  });
});

describe('D-PRODUCAO-01a, aceite 5 — sem um dos dois insumos, nenhum ferro', () => {
  const semFerro = (inicial: GameState): { readonly ferro: number; readonly produziu: Record<string, number> } => {
    let s = inicial;
    const produziu: Record<string, number> = {};
    for (let t = 1; t <= JANELA_DO_CONTRA_EXEMPLO; t += 1) {
      s = step(s, [], DADOS);
      for (const ev of s.events) if (ev.type === 'goods-produced') produziu[`${ev.predio}:${ev.mercadoria}`] ??= t;
    }
    return { ferro: totalNoMundo(s, 'iron'), produziu };
  };

  it('sem a mina de carvao: o minerio sai, o ferro nao', () => {
    const r = semFerro(cenarioDoFerroSemCarvao());
    expect(r.produziu['fe1:iron_ore']).toBeDefined();
    expect(r.produziu['fu1:iron']).toBeUndefined();
    expect(r.ferro).toBe(0);
  });

  it('sem a mina de ferro: o carvao sai, o ferro nao', () => {
    const r = semFerro(cenarioDoFerroSemMina());
    expect(r.produziu['co1:coal']).toBeDefined();
    expect(r.produziu['fu1:iron']).toBeUndefined();
    expect(r.ferro).toBe(0);
  });
});
