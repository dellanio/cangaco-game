/**
 * F-VIVO-b — o trabalho: o quadro de animacao de dentro do predio, por caso
 * (docs/BRIEF-ARTE.md §4a, BUILD_PLAN.md "Aceite da F-VIVO-b").
 *
 * `quadroDeTrabalho` e aritmetica pura sobre o `progresso` do ciclo: o teste roda o
 * ciclo inteiro de cada caso tick a tick, sem tela. O predio e a unidade de partida
 * saem de um cenario real (a serraria da F15a), e so `tipo`, `progresso`, `pausado`
 * e o rotulo da FSM mudam — os campos que a funcao le. A pedreira real confere os
 * rotulos contra a sim: um rotulo renomeado em `especialistas.ts` reprova aqui.
 */
import { describe, it, expect } from 'vitest';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { dadosDoTrabalho, contextoDasCamadas } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import type { AncorasDoPredio } from '../src/render/manifesto';
import { CASO_DO_PREDIO, LACOS_DO_CASO, violacoesDosCasos } from '../src/render/manifesto-camadas';
import type { ContextoDasCamadas } from '../src/render/manifesto-camadas';
import {
  quadroDeTrabalho, quadroDaFumaca, ROTULOS_DE_DENTRO, ROTULOS_QUE_ANIMAM, TICKS_POR_QUADRO,
} from '../src/render/trabalho';
import type { DadosDoTrabalho, QuadroDeTrabalho } from '../src/render/trabalho';
import {
  avancar, cenarioDePedreira, cenarioDeSerraria, fsmDe, semOcupante,
} from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados: DadosDoTrabalho = dadosDoTrabalho(semArte);

function completoDe(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}
function unidadeDe(s: GameState, id: string): Unidade {
  const u = s.unidades.porId[id];
  if (u === undefined) throw new Error(`fixture: unidade '${id}' nao existe`);
  return u;
}

const base = cenarioDeSerraria();
const predioBase = completoDe(base, 's1');
const unidadeBase = unidadeDe(base, 'u2');

/** O predio de `tipo` com o ciclo em `progresso`, ocupado por `unidade`. */
function predioEm(tipo: string, progresso: number, extra: Partial<PredioCompleto> = {}): PredioCompleto {
  const producao = predioBase.producao;
  if (producao === null) throw new Error('fixture: serraria sem producao');
  return { ...predioBase, tipo, producao: { ...producao, progresso }, ...extra };
}
const comFsm = (fsm: string): Unidade => ({ ...unidadeBase, fsm } as Unidade);
const trabalhando = comFsm('trabalhando');

const ticksDe = (tipo: string): number => {
  const t = dados.ticksDoCiclo[tipo];
  if (t === undefined) throw new Error(`fixture: '${tipo}' sem ticksDoCiclo`);
  return t;
};
/** F-VIVO-f — onde comeca a fase da casa: descanso + tile (0 para quem nao colhe). */
const casaDe = (tipo: string): number => (dados.ticksDeDescanso[tipo] ?? 0) + (dados.ticksNoTile[tipo] ?? 0);

/** Os quadros de um ciclo inteiro, progresso 0..T-1, com o ocupante no rotulo dado. */
function cicloDe(tipo: string, unidade: Unidade = trabalhando): (QuadroDeTrabalho | null)[] {
  return Array.from({ length: ticksDe(tipo) }, (_, p) => quadroDeTrabalho(predioEm(tipo, p), unidade, p, dados));
}
/** As corridas de laco: `inicio,inicio,meio` vira `[inicio, meio]`. */
function corridas(qs: readonly (QuadroDeTrabalho | null)[]): string[] {
  const out: string[] = [];
  for (const q of qs) if (q !== null && out[out.length - 1] !== q.laco) out.push(q.laco);
  return out;
}
/** Os saltos de `n` que nao sao 0, +1 nem a volta ao 1 (so de F para 1). */
function pulos(qs: readonly (QuadroDeTrabalho | null)[], caso: string): string[] {
  const erros: string[] = [];
  for (let i = 1; i < qs.length; i += 1) {
    const a = qs[i - 1]; const b = qs[i];
    if (a == null || b == null) { erros.push(`null no meio do ciclo em ${i}`); continue; }
    const f = LACOS_DO_CASO[caso as keyof typeof LACOS_DO_CASO][a.laco] ?? 0;
    const mesmoLaco = a.laco === b.laco;
    const ok = mesmoLaco ? (b.n === a.n || b.n === a.n + 1 || (a.n === f && b.n === 1)) : (a.n === f && b.n === 1);
    if (!ok) erros.push(`${i}: ${a.laco}_${a.n} -> ${b.laco}_${b.n}`);
  }
  return erros;
}

const evidencia: Record<string, unknown> = {};

describe('F-VIVO-b — o quadro de trabalho por caso, num ciclo inteiro', () => {
  it('caso 1 (guarda, farm): sempre null; o caso 1 so anima fumaca, e so quando declarada', () => {
    const ciclo = cicloDe('farm', comFsm('colhendo'));
    expect(ciclo.every((q) => q === null)).toBe(true);
    // sem ancora de fumaca declarada: nada
    expect(quadroDaFumaca(predioEm('farm', 0), comFsm('colhendo'), 5, dados)).toBeNull();
    // com a ancora: 1..8 pelo relogio, sem pulo
    const ancoras: AncorasDoPredio = { trabalho: { area: [0.3, 0.35, 0.7, 0.75], fumaca: [0.5, 0.1] } };
    const comFumaca: DadosDoTrabalho = { ...dados, ancoras: { ...dados.ancoras, farm: ancoras } };
    const fumacas = Array.from({ length: 20 }, (_, t) => quadroDaFumaca(predioEm('farm', 3), comFsm('colhendo'), t, comFumaca));
    expect(fumacas.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1].map((n) => n));
    // parado (pausado), a fumaca some
    expect(quadroDaFumaca(predioEm('farm', 3, { pausado: true }), comFsm('colhendo'), 4, comFumaca)).toBeNull();
    evidencia['guarda'] = { ticksDoCiclo: ticksDe('farm'), quadros: 'todos null', fumacaDeclarada: fumacas };
  });

  it('caso 2 (transforma, quarry): so na fase da casa, inicio, meio e fim pelos tercos dela', () => {
    // F-VIVO-f: o caso 2 anima so em [descanso + tile, ciclo); antes, nada (o descanso e do
    // ocioso). O terco divide a FASE DA CASA, nao o ciclo inteiro.
    const casa = casaDe('quarry');
    expect(casa).toBeGreaterThan(0);
    expect(cicloDe('quarry').slice(0, casa).every((q) => q === null)).toBe(true);
    const t = ticksDe('quarry') - casa;
    const ciclo = cicloDe('quarry').slice(casa);
    // BUG-X: o caso 2 anima so com o ocupante dentro; no tile a casa fica parada
    expect(cicloDe('quarry', comFsm('colhendo')).every((q) => q === null)).toBe(true);
    expect(corridas(ciclo)).toEqual(['inicio', 'meio', 'fim']);
    const t1 = Math.floor(t / 3); const t2 = Math.floor((2 * t) / 3);
    expect(ciclo.slice(0, t1).every((q) => q?.laco === 'inicio')).toBe(true);
    expect(ciclo.slice(t1, t2).every((q) => q?.laco === 'meio')).toBe(true);
    expect(ciclo.slice(t2).every((q) => q?.laco === 'fim')).toBe(true);
    // inicio e fim tocam UMA vez: n nunca volta ao 1 dentro do terco
    const ns = (laco: string): number[] => ciclo.filter((q) => q?.laco === laco).map((q) => q!.n);
    const voltas = (xs: number[]): number => xs.filter((n, i) => i > 0 && n < xs[i - 1]!).length;
    expect(voltas(ns('inicio'))).toBe(0);
    expect(voltas(ns('fim'))).toBe(0);
    // o meio repete: k = floor(terco / (8 * TPQ)) voltas, portanto k-1 retornos ao 1
    const k = Math.max(1, Math.floor((t2 - t1) / (8 * TICKS_POR_QUADRO)));
    expect(voltas(ns('meio'))).toBe(k - 1);
    expect(pulos(ciclo, 'transforma')).toEqual([]);
    // o ultimo quadro do ciclo e o fim_8; o primeiro do seguinte, inicio_1
    expect(ciclo[ciclo.length - 1]).toEqual({ laco: 'fim', n: 8 });
    expect(ciclo[0]).toEqual({ laco: 'inicio', n: 1 });
    evidencia['transforma'] = { ticksDoCiclo: ticksDe('quarry'), inicioDaCasa: casa, faseDaCasa: t, tercos: [t1, t2], voltasDoMeio: k, sequencia: ciclo.map((q) => `${q?.laco}_${q?.n}`) };
  });

  it('caso 3 (dentro, sawmill): laco1 e laco2 alternando a cada volta completa', () => {
    const t = ticksDe('sawmill');
    const ciclo = cicloDe('sawmill');
    const k = Math.max(1, Math.floor(t / (8 * TICKS_POR_QUADRO)));
    const esperado = Array.from({ length: k }, (_, i) => (i % 2 === 0 ? 'laco1' : 'laco2'));
    expect(corridas(ciclo)).toEqual(esperado);
    expect(pulos(ciclo, 'dentro')).toEqual([]);
    // cada volta passa pelos 8 quadros
    for (let v = 0; v < k; v += 1) {
      const naVolta = new Set(ciclo.slice(Math.ceil((v * t) / k), Math.ceil(((v + 1) * t) / k)).map((q) => q!.n));
      expect([...naVolta].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
    evidencia['dentro'] = { ticksDoCiclo: t, voltas: k, corridas: corridas(ciclo) };
  });

  it('caso 4 (luz, gold_mine): luz, 4 quadros, repetido', () => {
    const t = ticksDe('gold_mine');
    const ciclo = cicloDe('gold_mine', comFsm('colhendo'));
    expect(corridas(ciclo)).toEqual(['luz']);
    expect(new Set(ciclo.map((q) => q!.n))).toEqual(new Set([1, 2, 3, 4]));
    expect(pulos(ciclo, 'luz')).toEqual([]);
    evidencia['luz'] = { ticksDoCiclo: t, voltas: Math.max(1, Math.floor(t / (4 * TICKS_POR_QUADRO))) };
  });

  it('caso 5 (criacao, swine_farm): laco1 e laco2 alternando, como o caso 3', () => {
    const t = ticksDe('swine_farm');
    const ciclo = cicloDe('swine_farm');
    const k = Math.max(1, Math.floor(t / (8 * TICKS_POR_QUADRO)));
    expect(corridas(ciclo)).toEqual(Array.from({ length: k }, (_, i) => (i % 2 === 0 ? 'laco1' : 'laco2')));
    expect(pulos(ciclo, 'criacao')).toEqual([]);
    evidencia['criacao'] = { ticksDoCiclo: t, voltas: k };
  });
});

describe('F-VIVO-b — os quatro estados parados devolvem null', () => {
  const tipos = Object.keys(CASO_DO_PREDIO).filter((t) => CASO_DO_PREDIO[t] !== 'guarda');

  it.each(tipos)('%s: sem ocupante, sem insumo, saida cheia e pausado', (tipo) => {
    const meio = Math.floor(ticksDe(tipo) / 2);
    // o controle: no meio do ciclo, trabalhando, anima
    const animam = CASO_DO_PREDIO[tipo] === 'transforma' ? ROTULOS_DE_DENTRO : ROTULOS_QUE_ANIMAM;
    for (const rotulo of animam) expect(quadroDeTrabalho(predioEm(tipo, meio), comFsm(rotulo), meio, dados)).not.toBeNull();
    // sem ocupante: o predio nao tem, ou a unidade passada nao e a dele
    expect(quadroDeTrabalho(predioEm(tipo, meio, { ocupante: null }), trabalhando, meio, dados)).toBeNull();
    expect(quadroDeTrabalho(predioEm(tipo, meio), null, meio, dados)).toBeNull();
    expect(quadroDeTrabalho(predioEm(tipo, meio), { ...trabalhando, id: 'outro' } as Unidade, meio, dados)).toBeNull();
    // sem insumo
    expect(quadroDeTrabalho(predioEm(tipo, 0), comFsm('esperando_insumo'), 0, dados)).toBeNull();
    // saida cheia: o ciclo pronto esperando caber na gaveta
    expect(quadroDeTrabalho(predioEm(tipo, ticksDe(tipo)), comFsm('saida_cheia'), meio, dados)).toBeNull();
    expect(quadroDeTrabalho(predioEm(tipo, ticksDe(tipo)), trabalhando, meio, dados)).toBeNull();
    // pausado: o rotulo continua `trabalhando` (F16c), a pausa se le no predio
    expect(quadroDeTrabalho(predioEm(tipo, meio, { pausado: true }), trabalhando, meio, dados)).toBeNull();
  });
});

describe('F-VIVO-b — n avanca e volta ao 1 sem pular, nas receitas reais', () => {
  it('todo predio com caso animado: um ciclo e o comeco do seguinte', () => {
    const vistos: Record<string, { ticks: number; quadros: number }> = {};
    for (const [tipo, caso] of Object.entries(CASO_DO_PREDIO)) {
      if (caso === 'guarda') continue;
      // F-VIVO-f: o caso 2 so tem quadro na fase da casa; o que vem antes e null por regra
      const ciclo = cicloDe(tipo).slice(caso === 'transforma' ? casaDe(tipo) : 0);
      expect(pulos(ciclo, caso), tipo).toEqual([]);
      expect(ciclo[0]?.n, tipo).toBe(1);
      // o ultimo quadro do ciclo fecha o laco (n = F), e o seguinte recomeca no 1
      const ultimo = ciclo[ciclo.length - 1]!;
      expect(ultimo.n, tipo).toBe(LACOS_DO_CASO[caso][ultimo.laco]);
      vistos[tipo] = { ticks: ciclo.length, quadros: new Set(ciclo.map((q) => `${q!.laco}_${q!.n}`)).size };
    }
    expect(Object.keys(vistos).length).toBeGreaterThan(0);
    evidencia['semPulo'] = vistos;
  });
});

describe('F-VIVO-b — a tabela de casos do render concorda com production.json', () => {
  const ctx: ContextoDasCamadas = contextoDasCamadas;
  const trocar = (id: string, colheita: { aDistancia: boolean } | null): ContextoDasCamadas => {
    const r = ctx.receitas[id];
    if (r === undefined) throw new Error(`fixture: '${id}' sem receita`);
    return { ...ctx, receitas: { ...ctx.receitas, [id]: { ...r, colheita } } };
  };

  it('o dado de hoje passa, e cada troca de caso no dado reprova', () => {
    expect(violacoesDosCasos(ctx)).toEqual([]);
    const casos: Record<string, string> = {
      serrariaQueColhe: violacoesDosCasos(trocar('sawmill', { aDistancia: false })).join(' | '),
      pedreiraQueNaoColhe: violacoesDosCasos(trocar('quarry', null)).join(' | '),
      minaQueColheAndando: violacoesDosCasos(trocar('gold_mine', { aDistancia: false })).join(' | '),
      criacaoQueColhe: violacoesDosCasos(trocar('swine_farm', { aDistancia: false })).join(' | '),
    };
    expect(casos['serrariaQueColhe']).toMatch(/sawmill/);
    expect(casos['pedreiraQueNaoColhe']).toMatch(/quarry/);
    expect(casos['minaQueColheAndando']).toMatch(/gold_mine/);
    expect(casos['criacaoQueColhe']).toMatch(/swine_farm/);
    // um predio novo com receita e sem caso tambem reprova
    const novo = { ...ctx, receitas: { ...ctx.receitas, forja_nova: { entra: [], sai: ['x'], colheita: null } } };
    expect(violacoesDosCasos(novo).join(' | ')).toMatch(/forja_nova/);
    // e o funil do render le a MESMA tabela
    expect(dados.casos).toBe(CASO_DO_PREDIO);
    evidencia['tabelaDeCasos'] = casos;
  });
});

describe('F-VIVO-b — contra a sim: a pedreira real e a serraria sem insumo', () => {
  it('a pedreira ocupada anima com o pedreiro dentro, fica parada com ele no lajedo, e nao sem ocupante ou pausada', () => {
    // BUG-X (decisao do operador, 2026-10-01): o caso 2 anima so enquanto o ocupante esta
    // dentro. O relogio anda nos dois lugares (descanso e casa dentro, `colhendo` no tile).
    let s = cenarioDePedreira();
    let colhendoNoTick = -1;
    let dentroNoTick = -1;
    const vistos: string[] = [];
    for (let t = 0; t < 2000; t += 1) {
      s = avancar(s, 1);
      const fsm = fsmDe(s, 'u1');
      const progresso = completoDe(s, 'q1').producao!.progresso;
      const q = quadroDeTrabalho(completoDe(s, 'q1'), unidadeDe(s, 'u1'), s.tick, dados);
      if (fsm === 'colhendo' && progresso > 0) {
        expect(q, `tick ${s.tick}, no lajedo`).toBeNull();
        if (colhendoNoTick < 0) colhendoNoTick = s.tick;
      }
      // F-VIVO-f: dentro no descanso, nada (o ocioso cobre); dentro na fase da casa, anima
      if (fsm === 'trabalhando' && progresso < (dados.ticksDeDescanso['quarry'] ?? 0)) {
        expect(q, `tick ${s.tick}, dentro no descanso`).toBeNull();
      }
      if (fsm === 'trabalhando' && progresso >= casaDe('quarry') && progresso < ticksDe('quarry')) {
        expect(q, `tick ${s.tick}, dentro`).not.toBeNull();
        if (dentroNoTick < 0) dentroNoTick = s.tick;
        vistos.push(`${q!.laco}_${q!.n}`);
      }
      if (colhendoNoTick > 0 && vistos.length >= 30) break;
    }
    expect(colhendoNoTick).toBeGreaterThan(0);
    expect(dentroNoTick).toBeGreaterThan(0);
    expect(new Set(vistos).size).toBeGreaterThan(1);
    // o mesmo instante, sem ocupante ou pausada: parado
    const q1 = completoDe(s, 'q1');
    expect(quadroDeTrabalho(completoDe(semOcupante(s, 'q1'), 'q1'), unidadeDe(s, 'u1'), s.tick, dados)).toBeNull();
    expect(quadroDeTrabalho({ ...q1, pausado: true }, unidadeDe(s, 'u1'), s.tick, dados)).toBeNull();
    evidencia['pedreiraReal'] = { primeiroColhendoNoTick: colhendoNoTick, primeiroDentroNoTick: dentroNoTick, quadros: vistos };
  });

  it('a serraria sem insumo fica no rotulo de espera e nao anima', () => {
    const s = avancar(cenarioDeSerraria(), 30);
    expect(fsmDe(s, 'u2')).toBe('esperando_insumo');
    expect(quadroDeTrabalho(completoDe(s, 's1'), unidadeDe(s, 'u2'), s.tick, dados)).toBeNull();
    evidencia['serrariaSemInsumo'] = { fsm: fsmDe(s, 'u2'), quadro: null };
    gravarEvidencia('F-VIVO-b', evidencia);
  });
});
