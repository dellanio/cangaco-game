import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import m from '../assets/manifest.json';
describe('I-ARTE-MENU-PREDIOS-ATUAL',()=>{
  it('os tres icones derivam do completo atual, com hash e dimensoes',()=>{
    for(const id of ['woodcutters','quarry','church'] as const){
      const a=m.assets.find(e=>e.id===id&&e.tipo==='predio')!;
      const i=m.icones.predios[id];
      expect(i.origem.fonteCompleta).toBe(a.estados.completo);
      expect(i.origem.sha256).toBe(createHash('sha256').update(readFileSync(`assets/${a.estados.completo}`)).digest('hex'));
      const png=readFileSync(`assets/${i.arquivo}`);
      expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual(i.tamanho);
    }
  });
});
