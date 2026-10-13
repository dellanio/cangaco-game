/**
 * I-ARTE-ICONE-CAMPANHA — o icone do botao Campanha do menu inicial (aceite no BUILD_PLAN.md). Mede o
 * PNG pelo cabecalho e confere a entrada do manifesto e o registro da geracao. A homologacao da arte e
 * do operador.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gravarEvidencia } from './helpers/evidence';

const ICONE = 'assets/sprites/ui/menu/campanha.png';
const BASE = 'assets/base/ui/campanha/campanha-base.png';
const REGISTRO = 'assets/base/ui/campanha/geracao.json';

/** Largura, altura e tipo de cor do PNG, pelo IHDR. */
function cabecalho(caminho: string): { largura: number; altura: number; tipoDeCor: number } {
  const b = readFileSync(caminho);
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), tipoDeCor: b[25] as number };
}

interface EntradaDaInterface { arquivo: string; tamanho: [number, number]; licenca: string; origem: { base: string; id?: string } }

describe('I-ARTE-ICONE-CAMPANHA', () => {
  it('o icone e 96x96 RGBA, com a base e o registro da geracao versionados', () => {
    const c = cabecalho(ICONE);
    expect(c).toEqual({ largura: 96, altura: 96, tipoDeCor: 6 });
    expect(existsSync(BASE)).toBe(true);
    const registro = JSON.parse(readFileSync(REGISTRO, 'utf8')) as { derived?: string };
    expect(registro.derived).toBe(ICONE);
    gravarEvidencia('I-ARTE-ICONE-CAMPANHA', { icone: c });
  });

  it('o manifesto aponta para o icone, com o tamanho medido, a licenca e a origem na base', () => {
    const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Record<string, unknown>;
    const achar = (o: unknown): EntradaDaInterface | undefined => {
      if (o === null || typeof o !== 'object') return undefined;
      const r = o as Record<string, unknown>;
      if ('menuCampanha' in r) return r.menuCampanha as EntradaDaInterface;
      for (const v of Object.values(r)) { const e = achar(v); if (e !== undefined) return e; }
      return undefined;
    };
    const e = achar(manifesto);
    expect(e).toBeDefined();
    const entrada = e as EntradaDaInterface;
    expect(`assets/${entrada.arquivo}`).toBe(ICONE);
    const c = cabecalho(ICONE);
    expect(entrada.tamanho).toEqual([c.largura, c.altura]);
    expect(entrada.licenca.length).toBeGreaterThan(0);
    expect(`assets/${entrada.origem.base}`).toBe(BASE);
  });
});
