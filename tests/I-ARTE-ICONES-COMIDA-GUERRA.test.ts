import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifesto from '../assets/manifest.json';
import menu from '../data/menu-build.json';
import { urlDoIconeDePredio, type IconesDoManifesto } from '../src/ui/icones';

describe('I-ARTE-ICONES-COMIDA-GUERRA', () => {
  const icones = manifesto.icones.predios as Record<string, {
    arquivo: string; tamanho: number[]; licenca: string;
    origem: { fonteCompleta?: string; base: string; sha256?: string };
  }>;
  for (const grupo of menu.grupos.filter(g => ['comida', 'guerra'].includes(g.id))) {
    for (const id of grupo.predios) {
      it(`${grupo.id}/${id}: PNG atual e origem rastreável`, () => {
        const predio = manifesto.assets.find(a => a.tipo === 'predio' && a.id === id)!;
        const icone = icones[id];
        if (!icone) throw new Error(`ícone ausente: ${id}`);
        expect(icone.origem.fonteCompleta).toBe(predio.estados.completo);
        expect(icone.origem.base).toBe(predio.origem.base);
        expect(icone.licenca).toBe(predio.licenca);
        expect(icone.origem.sha256).toBe(createHash('sha256')
          .update(readFileSync(`assets/${predio.estados.completo}`)).digest('hex'));
        const png = readFileSync(`assets/${icone.arquivo}`);
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([72, 72]);
        expect(icone.tamanho).toEqual([72, 72]);
        expect(urlDoIconeDePredio(manifesto.icones as unknown as IconesDoManifesto,
          { [icone.arquivo]: '/atual.png' }, id)).toBe('/atual.png');
      });
    }
  }
});
