/**
 * F24b — A CADEIA DO COURO no mapa emitido: Malhada (bode e couro cru), Curtume, Casa do
 * Gibao (gibao e escudo). Plano: docs/planos/2026-09-29-F24b-cadeia-do-couro.md.
 *
 * A sonda veio primeiro, como na D-PRODUCAO-01a, e deu o mesmo resultado: a cadeia fecha
 * sem codigo novo. O que se entrega e o GUARDA. Tudo pelo `step` (regra do operador,
 * 2026-09-29).
 *
 * O que NAO se afirma aqui: a Casa do Gibao escolher a peca pela encomenda, como no KaM. Ela
 * faz as duas por ciclo, comendo couro e madeira; a divergencia esta registrada como F24c,
 * proposta, esperando o operador.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { cenarioDaCadeiaDoCouro, cenarioDoCouroSemCurtume } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;

/** Teto de SEGURANCA, nao afirmacao de desempenho: a sonda mediu o gibao no armazem no
 *  tick 4524. Cadeia que nao fecha em 9000 esta travada, nao lenta. */
const TETO_DA_CADEIA = 9000;

/** O contra-exemplo roda ate o couro cru estar ha 2000 ticks no mundo: com a cadeia inteira,
 *  o curtido nasce ~700 ticks depois do primeiro couro cru. */
const JANELA_DEPOIS_DO_COURO_CRU = 2000;

const PECAS = ['leather_armor', 'wooden_shield'] as const;

const evidencia: Record<string, unknown> = {};

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

function rodarAte(
  inicial: GameState, pare: (e: GameState, r: Registro, t: number) => boolean, teto: number, oQue: string,
): { readonly estado: GameState; readonly registro: Registro; readonly tick: number } {
  let s = inicial;
  const registro: Registro = { produziu: {}, entregou: {} };
  for (let t = 1; t <= teto; t += 1) {
    s = step(s, [], DADOS);
    for (const ev of s.events) {
      if (ev.type === 'goods-produced') registro.produziu[`${ev.predio}:${ev.mercadoria}`] ??= t;
      if (ev.type === 'task-completed') registro.entregou[`${ev.destino}:${ev.mercadoria}`] ??= t;
    }
    if (pare(s, registro, t)) return { estado: s, registro, tick: t };
  }
  throw new Error(`${oQue} nao aconteceu em ${teto} ticks`);
}

describe('F24b — a cadeia do couro fecha no mapa emitido', () => {
  const inicio = cenarioDaCadeiaDoCouro();
  const { estado, registro, tick } = rodarAte(
    inicio, (_e, r) => PECAS.every((p) => r.entregou[`arm:${p}`] !== undefined),
    TETO_DA_CADEIA, 'o gibao e o escudo no armazem',
  );

  it('linha de base: nenhum couro, curtido, gibao ou escudo no mundo no tick 0', () => {
    for (const bem of ['skins', 'leather', ...PECAS]) expect(totalNoMundo(inicio, bem), bem).toBe(0);
  });

  it('aceite 2 — a Malhada faz o couro cru junto com o bode', () => {
    expect(registro.produziu['sf1:skins']).toBeDefined();
    expect(registro.produziu['sf1:skins']).toBe(registro.produziu['sf1:pigs']);
  });

  it('aceite 3 — o curtido nasce no Curtume, depois do couro cru chegar a ele, e so la', () => {
    const curtido = registro.produziu['ta1:leather'];
    const cru = registro.entregou['ta1:skins'];
    expect(cru).toBeDefined();
    expect(curtido ?? 0).toBeGreaterThan(cru ?? Number.POSITIVE_INFINITY);
    expect(Object.keys(registro.produziu).filter((k) => k.endsWith(':leather'))).toEqual(['ta1:leather']);
  });

  it('aceite 4 — o curtido chega a Casa do Gibao, e gibao e escudo saem de la para o armazem', () => {
    const couro = registro.entregou['aw1:leather'];
    expect(couro).toBeDefined();
    for (const p of PECAS) {
      expect(registro.produziu[`aw1:${p}`] ?? 0, p).toBeGreaterThan(couro ?? Number.POSITIVE_INFINITY);
      expect(registro.entregou[`arm:${p}`] ?? 0, p).toBeGreaterThan(registro.produziu[`aw1:${p}`] ?? Number.POSITIVE_INFINITY);
      expect(Object.keys(registro.produziu).filter((k) => k.endsWith(`:${p}`)), p).toEqual([`aw1:${p}`]);
    }
  });

  it('aceite 6 — pelo step, sem violar invariante do JobBoard nem da FSM', () => {
    expect(violacoesDeInvariantes(estado, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(estado, DADOS)).toEqual([]);
    Object.assign(evidencia, {
      posicoes: Object.fromEntries(['arm', 'f1', 'sf1', 'ta1', 'aw1']
        .map((id) => [id, { tipo: completo(inicio, id).tipo, gx: completo(inicio, id).gx, gy: completo(inicio, id).gy }])),
      tickDaParada: tick,
      primeiroTick: registro,
      noArmazem: Object.fromEntries(['leather', ...PECAS].map((b) => [b, completo(estado, 'arm').estoque.saida[b] ?? 0])),
    });
  });
});

describe('F24b, aceite 5 — sem o Curtume, nenhum curtido nem peca', () => {
  it('o couro cru sai, e o curtido, o gibao e o escudo nao', () => {
    let desde: number | null = null;
    const r = rodarAte(cenarioDoCouroSemCurtume(), (e, _r, t) => {
      if (desde === null && totalNoMundo(e, 'skins') > 0) desde = t;
      return desde !== null && t - desde >= JANELA_DEPOIS_DO_COURO_CRU;
    }, TETO_DA_CADEIA + JANELA_DEPOIS_DO_COURO_CRU, 'o couro cru mais a janela');
    const totais = Object.fromEntries(['skins', 'leather', ...PECAS].map((b) => [b, totalNoMundo(r.estado, b)]));
    evidencia['semCurtume'] = { couroCruDesde: desde, tick: r.tick, totais, produziu: r.registro.produziu };
    expect(totais['skins']).toBeGreaterThan(0);
    expect(totais['leather']).toBe(0);
    for (const p of PECAS) expect(totais[p], p).toBe(0);
    // a Casa do Gibao tem a madeira: o que falta e so o couro
    expect(completo(r.estado, 'aw1').estoque.entrada['timber'] ?? 0).toBeGreaterThan(0);
    gravarEvidencia('F24b-cadeia-do-couro', evidencia);
  });
});
