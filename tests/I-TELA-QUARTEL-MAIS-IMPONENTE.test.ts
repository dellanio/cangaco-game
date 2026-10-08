import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import manifesto from '../assets/manifest.json';
import type {Manifesto,EntradaDeAsset} from '../src/render/manifesto';
import {escalaDoSprite,regraDoManifesto,regraDeLarguraDoManifesto} from '../src/render/escala-predio';
import {createInitialState} from '../src/sim/state';
import {salvar} from '../src/sim/save';
import {step} from '../src/sim/tick';
import {comPredioCompletoEm} from './helpers/jobs-cenario';
import {naVila} from './helpers/ancoras';
import terreno from '../data/terrain.json';

describe('I-TELA-QUARTEL-MAIS-IMPONENTE',()=>{
  it('aumenta ambos os eixos 20%, mantendo footprint e ancora',()=>{
    const m=manifesto as unknown as Manifesto;
    const e=m.assets.find(a=>a.id==='barracks') as EntradaDeAsset;
    const base={...e,escalaDeExibicao:1};
    const args=[regraDoManifesto(m),terreno.tile_px,e.footprint[0]*terreno.tile_px,regraDeLarguraDoManifesto(m)] as const;
    const antes=escalaDoSprite(base,...args),depois=escalaDoSprite(e,...args);
    for(const lado of e.tamanho)expect(lado*depois/(lado*antes)).toBeCloseTo(1.2);
    expect(e.footprint).toEqual([4,4]);
    expect(e.anchor).toEqual([0.5,0.99204]);
    expect(Object.keys(e.estados).sort()).toEqual(['completo','madeira']);
  });
  it('prepara comparacao com igreja atraves de estado e save reais',()=>{
    let s=createInitialState(1);
    s=comPredioCompletoEm(s,'quartel',{tipo:'barracks',...naVila(2,9)});
    s=comPredioCompletoEm(s,'igreja',{tipo:'church',...naVila(-3,9)});
    s=step(s,[]);
    mkdirSync('test-output',{recursive:true});
    writeFileSync('test-output/I-TELA-QUARTEL-MAIS-IMPONENTE.save.txt',salvar(s));
    expect(s.predios.porId.quartel?.tipo).toBe('barracks');
    expect(s.predios.porId.igreja?.tipo).toBe('church');
  });
});
