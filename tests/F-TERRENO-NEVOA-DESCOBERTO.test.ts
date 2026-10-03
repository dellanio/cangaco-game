/**
 * F-TERRENO-NEVOA-DESCOBERTO — o que o lado do jogador ve e ja viu (GDD 6.5; aceite no BUILD_PLAN,
 * Fase F). `descoberto` no estado, 1 bit por tile; `visivel` derivado, fora do estado, carimbado
 * so por quem mudou (`sim/nevoa.ts`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { criarEscaramuca } from '../src/sim/cenario';
import { step } from '../src/sim/tick';
import { carregar, salvar } from '../src/sim/save';
import { caixaDoPredio } from '../src/sim/footprint';
import { tilesDoGrupo } from '../src/sim/systems/marcha';
import { ehDescoberto, ehVisivel, visaoDe } from '../src/sim/nevoa';
import type { Visao } from '../src/sim/nevoa';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';

const SEMENTE = gameData.economia.estadoInicial.semente;
const J = LADO_DO_JOGADOR;

const doJogador = (s: GameState): string[] => s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === J);
const tropa = (s: GameState): string[] =>
  doJogador(s).filter((id) => s.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
/** Um ponto longe, do dado: o ponto da primeira posicao de defesa da IA. */
const LONGE = (dados: GameData = gameData): { gx: number; gy: number } => {
  const p = dados.escaramuca.posicoes[0];
  if (p === undefined) throw new Error('fixture: a escaramuca nao tem posicao');
  return { gx: p.ponto.gx, gy: p.ponto.gy };
};

/** Quantos bits ligados. */
const ligados = (bits: readonly number[]): number =>
  bits.reduce((n, w) => { let x = w >>> 0, c = 0; while (x !== 0) { x &= x - 1; c += 1; } return n + c; }, 0);
const bitsDe = (s: GameState): readonly number[] => {
  const b = s.descoberto?.[String(J)];
  if (b === undefined) throw new Error('o estado nao tem descoberto do jogador');
  return b;
};
/** Os indices visiveis, para comparar duas visoes. */
const visiveis = (v: Visao): number[] => {
  const r: number[] = [];
  for (let i = 0; i < v.contagem.length; i++) if ((v.contagem[i] ?? 0) > 0) r.push(i);
  return r;
};
/** A visao do zero: o estado clonado nao tem cache. */
const visaoDoZero = (s: GameState): Visao => visaoDe(JSON.parse(JSON.stringify(s)) as GameState);

/** Todo tile de predio e de unidade do jogador. */
function tilesDoJogador(s: GameState): { gx: number; gy: number }[] {
  const tiles: { gx: number; gy: number }[] = [];
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p?.lado !== J) continue;
    const c = caixaDoPredio(p, gameData);
    if (c === null) continue;
    for (let gy = c.y0; gy < c.y1; gy++) for (let gx = c.x0; gx < c.x1; gx++) tiles.push({ gx, gy });
  }
  for (const id of doJogador(s)) {
    const u = s.unidades.porId[id];
    if (u !== undefined) tiles.push({ gx: u.gx, gy: u.gy });
  }
  return tiles;
}

describe('F-TERRENO-NEVOA-DESCOBERTO — (a) o tick 0 ve a vila inteira', () => {
  for (const [nome, criar] of [
    ['jogo livre', () => createInitialState(SEMENTE)],
    ['escaramuca', () => criarEscaramuca(SEMENTE)],
  ] as const) {
    it(`${nome}: todo tile de predio e unidade do jogador esta visivel e descoberto`, () => {
      const s = criar();
      const v = visaoDe(s);
      const tiles = tilesDoJogador(s);
      expect(tiles.length).toBeGreaterThan(0);
      const fora = tiles.filter((t) => !ehVisivel(v, t.gx, t.gy) || !ehDescoberto(s, J, t.gx, t.gy));
      expect(fora).toEqual([]);
      // e o resto do mapa esta escuro: a nevoa existe
      expect(ligados(bitsDe(s))).toBeLessThan(gameData.mapa.largura * gameData.mapa.altura / 4);
    });
  }

  it('o raio do predio e o menor que cobre a vila do tick 0 so pelos predios (medida, PARA REVISAO)', () => {
    // A vila: a caixa que envolve os predios do jogador, com a linha das portas ao sul (por onde a rua passa).
    const cobre = (s0: GameState, raio: number): boolean => {
      const dados: GameData = { ...gameData, visao: { ...gameData.visao, predio: raio } };
      const s: GameState = { ...s0, unidades: { porId: {}, ordem: [] } };
      const v = visaoDe(s, dados);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of s.predios.ordem) {
        const p = s.predios.porId[id];
        if (p?.lado !== J) continue;
        const c = caixaDoPredio(p, dados);
        if (c === null) continue;
        x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1 + 1);
      }
      for (let gy = y0; gy < y1; gy++) for (let gx = x0; gx < x1; gx++) if (!ehVisivel(v, gx, gy)) return false;
      return true;
    };
    const menor = (s: GameState): number => { for (let r = 0; r <= 9; r++) if (cobre(s, r)) return r; return -1; };
    const livre = menor(createInitialState(SEMENTE));
    const escaramuca = menor(criarEscaramuca(SEMENTE));
    gravarEvidencia('F-TERRENO-NEVOA-DESCOBERTO-raio-do-predio', {
      regra: 'menor raio em que a caixa dos predios do jogador, com a linha das portas, fica visivel so pelos predios',
      menorNoJogoLivre: livre, menorNaEscaramuca: escaramuca, noDado: gameData.visao.predio,
    });
    expect(cobre(createInitialState(SEMENTE), gameData.visao.predio)).toBe(true);
    expect(cobre(criarEscaramuca(SEMENTE), gameData.visao.predio)).toBe(true);
  });
});

describe('F-TERRENO-NEVOA-DESCOBERTO — (b) monotonico, e cresce quando a tropa marcha', () => {
  it('6 000 ticks da escaramuca sem paz: nenhum bit se perde, e a marcha descobre', { timeout: 120_000 }, () => {
    let s = criarEscaramuca(SEMENTE, gameData, { pazMinBase: 0 });
    const inicio = ligados(bitsDe(s));
    const perdas: string[] = [];
    let aposMarcha = 0;
    for (let t = 0; t < 6000; t++) {
      const cmds = t === 0 ? [{ type: 'MoveUnits' as const, unidades: tropa(s), destino: LONGE() }] : [];
      const antes = bitsDe(s);
      s = step(s, cmds, gameData);
      const depois = bitsDe(s);
      for (let w = 0; w < antes.length; w++) {
        if (((antes[w] ?? 0) & ~(depois[w] ?? 0)) !== 0) perdas.push(`t${s.tick} palavra ${w}`);
      }
      if (t === 300) aposMarcha = ligados(depois);
    }
    const fim = ligados(bitsDe(s));
    gravarEvidencia('F-TERRENO-NEVOA-DESCOBERTO-monotonico', { ticks: 6000, bitsNoInicio: inicio, bitsAos300: aposMarcha, bitsNoFim: fim, perdas: perdas.length });
    expect(perdas).toEqual([]);
    expect(aposMarcha).toBeGreaterThan(inicio);
    expect(fim).toBeGreaterThanOrEqual(aposMarcha);
  });

  it('a visao carimbada so por quem mudou e a mesma visao feita do zero, tick a tick', () => {
    let s = criarEscaramuca(SEMENTE, gameData, { pazMinBase: 0 });
    const difere: number[] = [];
    for (let t = 0; t < 200; t++) {
      s = step(s, t === 0 ? [{ type: 'MoveUnits', unidades: tropa(s), destino: LONGE() }] : [], gameData);
      if (JSON.stringify(visiveis(visaoDe(s))) !== JSON.stringify(visiveis(visaoDoZero(s)))) difere.push(s.tick);
    }
    expect(difere).toEqual([]);
  });
});

describe('F-TERRENO-NEVOA-DESCOBERTO — (c) salvar e carregar', () => {
  it('salvar no meio, carregar e rodar da o mesmo estado e o mesmo visivel que nao salvar', () => {
    const N = 150;
    let s = criarEscaramuca(SEMENTE, gameData, { pazMinBase: 0 });
    s = step(s, [{ type: 'MoveUnits', unidades: tropa(s), destino: LONGE() }], gameData);
    for (let t = 0; t < N; t++) s = step(s, [], gameData);
    let direto = s;
    let carregado = carregar(salvar(s));
    for (let t = 0; t < N; t++) {
      direto = step(direto, [], gameData);
      carregado = step(carregado, [], gameData);
    }
    expect(JSON.stringify(carregado)).toBe(JSON.stringify(direto));
    expect(visiveis(visaoDe(carregado))).toEqual(visiveis(visaoDe(direto)));
    expect(ligados(bitsDe(direto))).toBeGreaterThan(0);
  });
});

describe('F-TERRENO-NEVOA-DESCOBERTO — (d) o carimbo cresce com quem anda, nao com o mapa', () => {
  /** O jogo livre so com `n` cabras do jogador, em campo aberto ao sul da vila, e todos marchando. */
  function soCabras(n: number): GameState {
    const base = createInitialState(SEMENTE);
    const spawn = gameData.escaramuca.tropaDoJogador.spawn;
    const tiles = tilesDoGrupo(base, { gx: spawn.gx, gy: spawn.gy }, n, gameData);
    const porId: Record<string, Unidade> = {};
    const ordem: string[] = [];
    tiles.slice(0, n).forEach((t, i) => {
      const id = `c${i}`;
      porId[id] = { id, lado: J, tipo: 'militia', gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: 1_000_000 };
      ordem.push(id);
    });
    if (ordem.length !== n) throw new Error(`fixture: so ${ordem.length} de ${n} tiles`);
    return { ...base, unidades: { porId, ordem } };
  }

  /** Soma dos carimbos e dos passos de tile, do tick 2 ao `ticks` (o 1 e a conta inteira, sem cache). */
  function medir(n: number, ticks: number): { carimbados: number; passos: number; parado: number } {
    let s = soCabras(n);
    // um tick parado: ninguem muda, nada se carimba
    s = step(s, [], gameData);
    s = step(s, [], gameData);
    const parado = visaoDe(s).carimbados;
    s = step(s, [{ type: 'MoveUnits', unidades: s.unidades.ordem, destino: LONGE() }], gameData);
    let carimbados = 0, passos = 0;
    for (let t = 0; t < ticks; t++) {
      const antes = s;
      s = step(s, [], gameData);
      carimbados += visaoDe(s).carimbados;
      for (const id of s.unidades.ordem) {
        const a = antes.unidades.porId[id], d = s.unidades.porId[id];
        if (a !== undefined && d !== undefined && (a.gx !== d.gx || a.gy !== d.gy)) passos += 1;
      }
    }
    return { carimbados, passos, parado };
  }

  it('1 e 50 cabras andando: zero parado, e o carimbo segue os passos (razao no PROGRESS)', () => {
    const TICKS = 100;
    const um = medir(1, TICKS);
    const cinquenta = medir(50, TICKS);
    const raio = gameData.visao.porTipoDeUnidade['militia'] ?? 0;
    const discoMax = (2 * raio + 1) ** 2;
    const area = gameData.mapa.largura * gameData.mapa.altura;
    gravarEvidencia('F-TERRENO-NEVOA-DESCOBERTO-carimbo', {
      ticks: TICKS, areaDoMapa: area, um, cinquenta,
      razaoDosCarimbos: cinquenta.carimbados / um.carimbados,
      razaoDosPassos: cinquenta.passos / um.passos,
      carimbosPorTickCom50: cinquenta.carimbados / TICKS,
    });
    expect(um.parado).toBe(0);
    expect(cinquenta.parado).toBe(0);
    expect(um.passos).toBeGreaterThan(0);
    // cada passo descarimba um disco e carimba outro, e nada mais se carimba
    expect(um.carimbados).toBeLessThanOrEqual(um.passos * 2 * discoMax);
    expect(cinquenta.carimbados).toBeLessThanOrEqual(cinquenta.passos * 2 * discoMax);
    // cresce com quem anda: 50 cabras carimbam ao menos 25 vezes o que 1 carimba
    expect(cinquenta.carimbados / um.carimbados).toBeGreaterThanOrEqual(25);
  });
});

describe('F-TERRENO-NEVOA-DESCOBERTO — (e) o tamanho do estado', () => {
  it('o estado serializado com e sem a camada (medida no PROGRESS)', () => {
    for (const [nome, s] of [['jogo livre', createInitialState(SEMENTE)], ['escaramuca', criarEscaramuca(SEMENTE)]] as const) {
      const { descoberto: _d, ...sem } = s;
      const com = JSON.stringify(s).length;
      const semCamada = JSON.stringify(sem).length;
      gravarEvidencia(`F-TERRENO-NEVOA-DESCOBERTO-tamanho-${nome === 'jogo livre' ? 'livre' : 'escaramuca'}`, {
        bytesSemACamada: semCamada, bytesComACamada: com, diferenca: com - semCamada,
        palavras: bitsDe(s).length,
      });
      expect(bitsDe(s).length).toBe(Math.ceil(gameData.mapa.largura * gameData.mapa.altura / 32));
    }
  });
});

describe('F-TERRENO-NEVOA-DESCOBERTO — o raio no dado', () => {
  it('o validate:data recusa civil sem raio, raio negativo e porTipo de predio que nao existe', () => {
    interface Cru {
      units: { civis: { _comum: { visao?: number } }; militares: { tipos: { visao: number }[] } };
      buildings: { visao: { predio_tiles: number; porTipo: Record<string, number> } };
    }
    const cru = (mexer: (d: Cru) => void): string[] => {
      const d: Record<string, unknown> = {};
      for (const n of readdirSync('data').filter((f) => f.endsWith('.json')).map((f) => f.replace(/[.]json$/, ''))) d[n] = JSON.parse(readFileSync(`data/${n}.json`, 'utf8'));
      mexer(d as unknown as Cru);
      return validarTudo(d).filter((e: string) => e.startsWith('visao/'));
    };
    expect(cru(() => undefined)).toEqual([]);
    expect(cru((d) => { delete d.units.civis._comum.visao; })).toHaveLength(1);
    expect(cru((d) => { const t = d.units.militares.tipos[0]; if (t !== undefined) t.visao = -1; })).toHaveLength(1);
    expect(cru((d) => { d.buildings.visao.porTipo['torre'] = 3; })).toHaveLength(1);
    expect(cru((d) => { d.buildings.visao.predio_tiles = 1.5; })).toHaveLength(1);
  });

  it('todo tipo de unidade tem raio no GameData', () => {
    const tipos = [...gameData.unidades.civis.tipos, ...gameData.unidades.militares.tipos, ...gameData.unidades.mercenarios.tipos].map((t) => t.id);
    expect(tipos.filter((t) => gameData.visao.porTipoDeUnidade[t] === undefined)).toEqual([]);
  });
});
