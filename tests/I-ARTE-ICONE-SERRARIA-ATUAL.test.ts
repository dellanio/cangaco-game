import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifesto from '../assets/manifest.json';
import { urlDoIconeDePredio, type IconesDoManifesto } from '../src/ui/icones';

describe('I-ARTE-ICONE-SERRARIA-ATUAL — retrato do edificio atual', () => {
  it('deriva do completo atual, com origem, hash e tamanho conferidos no PNG', () => {
    const predio = manifesto.assets.find((a) => a.tipo === 'predio' && a.id === 'sawmill')!;
    const icone = manifesto.icones.predios.sawmill;
    expect(icone.origem.fonteCompleta).toBe(predio.estados.completo);
    expect(icone.origem.base).toBe(predio.origem.base);
    expect(icone.licenca).toBe(predio.licenca);
    expect(icone.origem.sha256).toBe(createHash('sha256')
      .update(readFileSync(`assets/${predio.estados.completo}`)).digest('hex'));
    const png = readFileSync(`assets/${icone.arquivo}`);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual(icone.tamanho);
    expect(icone.tamanho).toEqual([72, 72]);
    expect(png.equals(readFileSync('assets/sprites/sawmill/icone.png'))).toBe(false);
  });

  it('o resolvedor de menu usa o novo arquivo indicado pelo manifesto', () => {
    const arquivo = manifesto.icones.predios.sawmill.arquivo;
    expect(arquivo).toBe('sprites/sawmill/icone-atual.png');
    expect(urlDoIconeDePredio(manifesto.icones as unknown as IconesDoManifesto,
      { [arquivo]: '/icone-serraria-atual.png' }, 'sawmill'))
      .toBe('/icone-serraria-atual.png');
  });
});
