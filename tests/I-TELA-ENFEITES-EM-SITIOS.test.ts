/**
 * I-TELA-ENFEITES-EM-SITIOS (aceite 1) — no mapa do sertao: nenhum enfeite de gente fora de um sitio; no maximo a
 * quantidade do mapa, longe um do outro, com o arranjo inteiro em chao fora da vila; avulsos so o natural.
 */
import { describe, expect, it } from 'vitest';
import { criarTerrenoDeRender, sementeDoMapa, centroDaVilaInicial } from '../src/render/mapa';
import { candidatosAEnfeite, configDosEnfeites, sitiosDoMapa, tileDeEnfeite } from '../src/render/enfeites';

const terreno = criarTerrenoDeRender();
const tipo = (gx: number, gy: number): string => terreno.tipos[terreno.codigos[gy * terreno.largura + gx]!] ?? '';
const sitios = sitiosDoMapa(terreno, sementeDoMapa, centroDaVilaInicial);
const enfeites = candidatosAEnfeite(terreno, sementeDoMapa, centroDaVilaInicial);
const DE_GENTE = new Set(configDosEnfeites.sitios.arranjo.map((p) => p.id));

describe('I-TELA-ENFEITES-EM-SITIOS', () => {
  it('poucos sitios, longe um do outro, o arranjo inteiro em chao fora da vila', () => {
    const quantidade = Math.round(configDosEnfeites.sitios.quantidadePorArea * terreno.largura * terreno.altura);
    expect(quantidade).toBe(3);
    expect(sitios.length).toBeGreaterThan(0);
    expect(sitios.length).toBeLessThanOrEqual(quantidade);
    for (let i = 0; i < sitios.length; i++) for (let j = i + 1; j < sitios.length; j++) {
      expect(Math.hypot(sitios[i]!.gx - sitios[j]!.gx, sitios[i]!.gy - sitios[j]!.gy)).toBeGreaterThanOrEqual(configDosEnfeites.sitios.distanciaMinima);
    }
    for (const c of sitios) for (const p of configDosEnfeites.sitios.arranjo) {
      expect(tileDeEnfeite(c.gx + p.dx, c.gy + p.dy, tipo(c.gx + p.dx, c.gy + p.dy), centroDaVilaInicial)).toBe(true);
    }
  });
  it('nenhum enfeite de gente fora de um sitio, e cada um aparece no maximo uma vez por sitio (a cerca, tres)', () => {
    const doSitio = new Set(sitios.flatMap((c) => configDosEnfeites.sitios.arranjo.map((p) => `${c.gx + p.dx},${c.gy + p.dy}`)));
    for (const e of enfeites) if (DE_GENTE.has(e.id)) expect(doSitio.has(`${e.gx},${e.gy}`), `${e.id} em ${e.gx},${e.gy}`).toBe(true);
    const porTipo: Record<string, number> = {};
    for (const e of enfeites) porTipo[e.id] = (porTipo[e.id] ?? 0) + 1;
    for (const id of DE_GENTE) {
      const noArranjo = configDosEnfeites.sitios.arranjo.filter((p) => p.id === id).length;
      expect(porTipo[id] ?? 0, id).toBe(noArranjo * sitios.length);
    }
  });
  it('os avulsos sao so o natural, e a mesma semente da o mesmo mapa', () => {
    for (const e of enfeites) if (!DE_GENTE.has(e.id)) expect(Object.keys(configDosEnfeites.avulsos.pesos)).toContain(e.id);
    expect(candidatosAEnfeite(terreno, sementeDoMapa, centroDaVilaInicial)).toEqual(enfeites);
  });
});
