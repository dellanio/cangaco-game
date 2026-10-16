/**
 * I-TELA-COMENSAIS-NA-BODEGA — quem esta `comendo` aparece sentado a mesa da Bodega, um por lugar do manifesto.
 * A parte pura (quem senta, o quadro) e a regra do manifesto; a captura e do roteiro.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { comensaisDaBodega, quadroDoComensal, TICKS_POR_QUADRO_DO_COMENSAL } from '../src/render/comensais';
import type { LugarDeComensal } from '../src/render/manifesto';
import { LACOS_DO_COMENSAL, LACO_DO_COMENSAL } from '../src/render/manifesto-camadas';
import { bodegaDoCenario } from './helpers/bodega-cenario';
import { avancarAte, cenarioDaVilaComBodegaCheia, comCondicao, unidadeDo } from './helpers/fome-cenario';
import { gameData } from '../src/sim/data';

interface Entrada { id: string; tipo: string; footprint: [number, number]; estados: Record<string, string>; ancoras?: { comensais?: LugarDeComensal[] } }
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Entrada[] };
const inn = manifesto.assets.find((a) => a.id === 'inn' && a.tipo === 'predio');
const LUGARES = inn?.ancoras?.comensais ?? [];
const FOOTPRINT = inn?.footprint ?? [0, 0];
const LIMIARES_CIVIS = gameData.condicao.ticksNoLimiar.civil;

describe('I-TELA-COMENSAIS-NA-BODEGA', () => {
  it('o manifesto: quatro lugares na Bodega, e o comensal com o laco comer de 4 quadros em PNG', () => {
    expect(LUGARES.length).toBe(4);
    const comensal = manifesto.assets.find((a) => a.id === 'comensal' && a.tipo === 'trabalho');
    const n = LACOS_DO_COMENSAL[LACO_DO_COMENSAL] ?? 0;
    expect(Object.keys(comensal?.estados ?? {}).sort()).toEqual(Array.from({ length: n }, (_, i) => `${LACO_DO_COMENSAL}_${i + 1}`));
  });

  it('ninguem comendo: nenhum comensal; o civil comendo na Bodega: um, no primeiro lugar', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    expect(comensaisDaBodega(estado, bodegaDoCenario(estado), FOOTPRINT, LUGARES)).toEqual([]);
    const partida = comCondicao(estado, { u3: LIMIARES_CIVIS.civilVaiComer });
    const comendo = avancarAte(partida, (e) => unidadeDo(e, 'u3').fsm === 'comendo', 200, 'u3 comer').estado;
    const mesa = comensaisDaBodega(comendo, bodegaDoCenario(comendo), FOOTPRINT, LUGARES);
    expect(mesa.map((c) => ({ i: c.i, unidade: c.unidade }))).toEqual([{ i: 0, unidade: 'u3' }]);
    expect(mesa[0]?.lugar).toEqual(LUGARES[0]);
  });

  it('mais gente comendo do que lugares: so os lugares que existem', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    const bodega = bodegaDoCenario(estado);
    const porId = { ...estado.unidades.porId };
    const ids = estado.unidades.ordem.slice(0, LUGARES.length + 2);
    for (const id of ids) {
      const u = porId[id];
      if (u !== undefined) porId[id] = { ...u, fsm: 'comendo', gx: bodega.gx, gy: bodega.gy - 1, lado: bodega.lado };
    }
    const cheia = { unidades: { ...estado.unidades, porId } };
    expect(ids.length).toBeGreaterThan(LUGARES.length);
    expect(comensaisDaBodega(cheia, bodega, FOOTPRINT, LUGARES).length).toBe(LUGARES.length);
  });

  it('o quadro anda com o tick, de 1 a 4, e a defasagem por lugar', () => {
    const quadros = Array.from({ length: 4 * TICKS_POR_QUADRO_DO_COMENSAL }, (_, t) => quadroDoComensal(t, 0));
    expect(new Set(quadros)).toEqual(new Set([1, 2, 3, 4]));
    expect(quadroDoComensal(0, 0)).not.toBe(quadroDoComensal(0, 1));
  });
});
