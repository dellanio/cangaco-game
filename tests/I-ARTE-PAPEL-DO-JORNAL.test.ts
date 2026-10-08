import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import m from '../assets/manifest.json';
describe('I-ARTE-PAPEL-DO-JORNAL',()=>{
  it('textura original tem base, procedencia e derivado na dimensao declarada',()=>{
    const e=m.assets.find(a=>a.id==='newspaper_paper')!;
    expect(e.tipo).toBe('interface');
    expect(existsSync(`assets/${e.origem.base}`)).toBe(true);
    expect(e.licenca).toBeTruthy();
    expect(e.anchor).toHaveLength(2);
    const png=readFileSync(`assets/${e.estados.normal}`);
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual(e.tamanho);
    expect(JSON.parse(readFileSync('assets/base/newspaper_paper/geracao.json','utf8')).sha256).toHaveLength(64);
  });
});
