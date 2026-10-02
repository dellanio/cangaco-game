import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../data/fumaca.json';
import { particulasDaFagulha } from '../src/render/fagulha';
import { dadosDoTrabalho } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { quadroDaFumaca } from '../src/render/trabalho';
import { gameData } from '../src/sim/data';
import { createInitialState, type PredioCompleto } from '../src/sim/state';
import { canPlace } from '../src/sim/placement';
import { step } from '../src/sim/tick';
import { salvar, carregar } from '../src/sim/save';
import { validarFumaca } from '../tools/data-rules.js';
import { comProdutorOcupado } from './helpers/producao-cenario';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const dados = dadosDoTrabalho(JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto);
const ponto = { x: 24, y: 36 };
const f = config.fagulha;

function cenario() {
  let s = createInitialState(1, gameData);
  s = { ...s, unidades: { porId: {}, ordem: [] }, tiposJaConstruidos: gameData.predios.map((p) => p.id) };
  for (const [id, tipo] of [['forja', 'iron_smithy'], ['fundicao', 'metallurgists']] as const) {
    let onde: { gx: number; gy: number } | null = null;
    for (let dy = -4; dy <= 5 && onde === null; dy += 1) for (let dx = 4; dx <= 14; dx += 1) {
      const t = naVila(dx, dy);
      if (canPlace(s, tipo, t.gx, t.gy, gameData).ok) { onde = t; break; }
    }
    if (onde === null) throw new Error(`fixture: ${tipo} nao coube`);
    s = comProdutorOcupado(s, { tipo, id, unidade: `${id}-ocupante`, ...onde }, gameData);
    const p = s.predios.porId[id] as PredioCompleto;
    const receita = gameData.producao.receitas[tipo];
    if (receita === undefined) throw new Error(`fixture: ${tipo} sem receita`);
    s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId,
      [id]: { ...p, estoque: { entrada: Object.fromEntries(Object.keys(receita.entra).map((m) => [m, 5])), saida: {} } } } } };
  }
  return step(s, [], gameData);
}

describe('D-TELA-FUMACA-DA-FORJA (fumaca e fagulha nas oficinas)', () => {
  it('por tabela: deterministica, sobe rapido, curta, em pulsos e limitada pelo pool', () => {
    let pares = 0;
    for (const inicio of [0, 10, 37]) for (let tick = 0; tick < 120; tick += 1) for (const alfa of [0, 0.5, 0.9]) {
      const atual = particulasDaFagulha(f, tick, alfa, ponto, inicio, null);
      expect(particulasDaFagulha(f, tick, alfa, ponto, inicio, null)).toEqual(atual);
      expect(atual.length).toBeLessThanOrEqual(f.maximoPorFogo);
      const proximas = new Map(particulasDaFagulha(f, tick + 1, alfa, ponto, inicio, null).map((p) => [p.id, p]));
      for (const p of atual) {
        expect(p.nascimento).toBeGreaterThanOrEqual(inicio);
        const depois = proximas.get(p.id);
        if (depois === undefined) continue;
        expect(p.y - depois.y).toBeGreaterThan(config.subidaTilesPorTick);
        expect(depois.opacidade).toBeLessThan(p.opacidade);
        pares += 1;
      }
    }
    expect(pares).toBeGreaterThan(0);
    expect(particulasDaFagulha({ ...f, semente: f.semente + 1 }, 1, 0.5, ponto, 0, null))
      .not.toEqual(particulasDaFagulha(f, 1, 0.5, ponto, 0, null));
    expect(f.vidaTicks).toBeLessThan(config.vidaTicks);
    expect(particulasDaFagulha(f, 0, 0, ponto, 0, null)).toHaveLength(f.particulasPorPulso);
    expect(particulasDaFagulha(f, f.vidaTicks, 0, ponto, 0, null)).toEqual([]);
    expect(particulasDaFagulha(f, f.intervaloPulsosTicks, 0, ponto, 0, null)).toHaveLength(f.particulasPorPulso);
    expect(particulasDaFagulha({ ...f, maximoPorFogo: 2 }, 0, 0, ponto, 0, null)).toHaveLength(2);
    gravarEvidencia('D-TELA-FUMACA-DA-FORJA', { pares, vidaFagulha: f.vidaTicks, vidaFumaca: config.vidaTicks,
      intervaloPulsos: f.intervaloPulsosTicks, forja: { tamanho: [256, 220], fumaca: [207, 48], fogo: [146, 156] },
      fundicao: { tamanho: [192, 192], fumaca: [149, 25] } });
  });

  it('sem trabalho nao nasce; parada corta nascimentos e extingue ate parouEm + vidaTicks', () => {
    for (const tick of [0, 10, 100]) expect(particulasDaFagulha(f, tick, 0.5, ponto, null, null)).toEqual([]);
    expect(particulasDaFagulha(f, 9, 0.9, ponto, 10, null)).toEqual([]);
    for (const parada of [1, 5, 12, 17, 37]) {
      for (let tick = parada; tick <= parada + f.vidaTicks; tick += 1) {
        expect(particulasDaFagulha(f, tick, 0.5, ponto, 0, parada).every((p) => p.nascimento < parada)).toBe(true);
      }
      expect(particulasDaFagulha(f, parada + f.vidaTicks, 0, ponto, 0, parada)).toEqual([]);
    }
  });

  it('pontos medidos e oficinas da sim usam o mesmo predicado, inclusive as paradas', () => {
    expect(dados.ancoras['iron_smithy']?.trabalho?.fumaca).toEqual([207 / 256, 48 / 220]);
    expect(dados.ancoras['iron_smithy']?.trabalho?.fogo).toEqual([146 / 256, 156 / 220]);
    expect(dados.ancoras['metallurgists']?.trabalho?.fumaca).toEqual([149 / 192, 25 / 192]);
    const s = cenario();
    for (const id of ['forja', 'fundicao']) {
      const p = s.predios.porId[id];
      const u = s.unidades.porId[`${id}-ocupante`];
      if (p?.estado !== 'completo' || u === undefined) throw new Error('fixture sem oficina');
      expect(quadroDaFumaca(p, u, s.tick, dados)).not.toBeNull();
      for (const parado of [{ ...p, pausado: true }, { ...p, ocupante: null }, { ...p, producao: null }]) {
        expect(quadroDaFumaca(parado, u, s.tick, dados)).toBeNull();
      }
      for (const fsm of ['esperando_insumo', 'saida_cheia', 'indo_ocupar']) {
        expect(quadroDaFumaca(p, { ...u, fsm }, s.tick, dados)).toBeNull();
      }
    }
    const texto = salvar(s);
    expect(carregar(texto, gameData)).toEqual(s);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/D-TELA-FUMACA-DA-FORJA-save.txt`, texto);
  });

  it('regra interface/fumaca rejeita cada campo invalido do bloco fagulha', () => {
    const erros = (fagulha: unknown) => { const e: string[] = []; validarFumaca({ ...config, fagulha }, e); return e; };
    expect(erros(f)).toEqual([]);
    expect(erros(null)).toContain('interface/fumaca: fagulha precisa ser objeto');
    for (const campo of ['maximoPorFogo', 'vidaTicks', 'intervaloPulsosTicks', 'particulasPorPulso',
      'subidaTilesPorTick', 'dispersaoTilesPorTick', 'raioTiles', 'opacidade']) expect(erros({ ...f, [campo]: 0 }).length).toBeGreaterThan(0);
    for (const invalido of [{ ...f, cor: 'laranja' }, { ...f, semente: 0.5 }, { ...f, vidaTicks: config.vidaTicks },
      { ...f, intervaloPulsosTicks: f.vidaTicks }, { ...f, particulasPorPulso: f.maximoPorFogo + 1 },
      { ...f, subidaTilesPorTick: config.subidaTilesPorTick }]) expect(erros(invalido).length).toBeGreaterThan(0);
  });
});
