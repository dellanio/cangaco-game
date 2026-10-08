import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import pares from '../data/caatinga-arte.json';
import manifesto from '../assets/manifest.json';
import { especiesDaVegetacao } from '../src/render/crescimento';
import vento from '../data/vento.json';
import { fatoresDaArvore, transformacaoDoVento } from '../src/render/vento';
import { validarVento } from '../tools/data-rules.js';
const require = createRequire(import.meta.url);
const { decodePng } = require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as { decodePng: (b: Uint8Array) => { width: number; height: number; data: Uint8Array } };
function pe(p: { width: number; height: number; data: Uint8Array }): number {
  for (let y = p.height - 1; y >= 0; y--) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3]! > 0) return y;
  return -1;
}
describe('I-ARTE-CAATINGA-NA-SECA', () => {
  it('cada estado sazonal balanca exatamente como seu inverno, sem heranca implicita', () => {
    const entrada = manifesto.assets.find(a => a.tipo === 'vegetacao' && a.id === 'tree')!;
    const especies: Readonly<Record<string, { amplitude: number; velocidade: number }>> = vento.especies;
    const erros: string[] = [];
    validarVento(vento, erros, manifesto);
    expect(erros).toEqual([]);
    for (const estado of Object.keys(entrada.estados).filter(e => e === 'seca' || e.startsWith('seca:'))) {
      const inverno = estado === 'seca' ? 'presente' : estado.slice('seca:'.length);
      expect(especies[estado]).toEqual(especies[inverno]);
      for (const [gx, gy] of [[0, 0], [24, 37], [127, 127]]) {
        expect(fatoresDaArvore(vento, estado, gx!, gy!)).toEqual(fatoresDaArvore(vento, inverno, gx!, gy!));
        expect(transformacaoDoVento(vento, 123, 0.5, gx!, gy!, 100, 200, estado))
          .toEqual(transformacaoDoVento(vento, 123, 0.5, gx!, gy!, 100, 200, inverno));
      }
    }
  });
  it.each(['presente', 'mandacaru', 'seca', 'seca:mandacaru'])('configuracao ausente de %s continua reprovada', especie => {
    const incompleto = structuredClone(vento);
    Reflect.deleteProperty(incompleto.especies, especie);
    const erros: string[] = [];
    validarVento(incompleto, erros, manifesto);
    expect(erros).toContain(`interface/vento: especie '${especie}' sem entrada em especies`);
  });
  it('seis estados existentes tem pares da seca; seca nunca entra no sorteio de inverno', () => {
    expect(pares.pares.map(p => p.id)).toEqual(['tree', 'mandacaru', 'xique-xique', 'facheiro', 'macambira', 'arvore-seca']);
    expect(especiesDaVegetacao(['presente', 'seca', 'mandacaru', 'seca:mandacaru', 'muda'])).toEqual(['presente', 'mandacaru']);
  });
  it.each(pares.pares)('$id: mesmo tamanho e pe medidos no PNG; origem de inverno versionada', par => {
    const entrada = manifesto.assets.find(a => a.tipo === 'vegetacao' && a.id === par.entrada)!;
    const chave = par.estado === 'presente' ? 'seca' : `seca:${par.estado}`;
    const estados = entrada.estados as Readonly<Record<string, string>>;
    const inverno = decodePng(readFileSync(`assets/${par.inverno}`)), seca = decodePng(readFileSync(`assets/${estados[chave]}`));
    expect([seca.width, seca.height]).toEqual([inverno.width, inverno.height]);
    expect(pe(seca)).toBe(pe(inverno));
    expect(pe(seca)).toBeGreaterThan(0);
    expect(entrada.anchor).toEqual([0.5, 1]);
    const registro = JSON.parse(readFileSync(`assets/base/${par.id}-seca/geracao.json`, 'utf8')) as { baseDoInverno: string; sha256Inverno: string; sha256: string };
    expect(createHash('sha256').update(readFileSync(`assets/${registro.baseDoInverno}`)).digest('hex')).toBe(registro.sha256Inverno);
    expect(createHash('sha256').update(readFileSync(`assets/base/${par.id}-seca/original-20261008.png`)).digest('hex')).toBe(registro.sha256);
    expect(readFileSync(`assets/${registro.baseDoInverno}`)).toEqual(readFileSync(`assets/${par.inverno}`));
  });
});
