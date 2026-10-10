import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import medidas from '../data/pes-dos-militares.json';
import config from '../data/selecao-visual.json';
import tema from '../data/theme-sertao.json';
import terreno from '../data/terrain.json';
import {geometriaDoAnel} from '../src/render/selecao-visual';
import {createInitialState} from '../src/sim/state';
import type {Unidade} from '../src/sim/state';
import {condicaoCheiaDoTipo} from '../src/sim/condicao';
import {salvar} from '../src/sim/save';
import {naVila} from './helpers/ancoras';

// a corrida transladada grava noutro diretorio (F18c-1c): a partida do roteiro e a do mundo normal
const DIR_DA_EVIDENCIA = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
const require=createRequire(import.meta.url);
const {decodePng}=require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as {decodePng:(p:Buffer)=>{width:number;height:number;data:Uint8Array}};
describe('I-TELA-SELECAO-NO-PE',()=>{
  it('mede todos os quadros militares em fontes intactas e coloca o anel no ultimo pixel opaco',()=>{
    const ids=[...Object.keys(tema.militares),...Object.keys(tema.mercenarios)].sort();
    expect(medidas.fontes.map(f=>f.id).sort()).toEqual(ids);
    const porQuadro:Readonly<Record<string,{recuoInferiorPx:number;alturaDoQuadro:number}|undefined>>=medidas.porQuadro;
    for(const fonte of medidas.fontes){
      const bytes=readFileSync(fonte.imagem);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(fonte.sha256);
      const png=decodePng(bytes);
      const atlas=JSON.parse(readFileSync(fonte.atlas,'utf8')) as {frames:Record<string,{frame:{x:number;y:number;w:number;h:number}}>};
      for(const [nome,{frame:f}] of Object.entries(atlas.frames)){
        const m=porQuadro[nome]!;
        const linha=f.h-m.recuoInferiorPx-1;
        const alfa=(x:number,y:number):number=>png.data[((f.y+y)*png.width+f.x+x)*4+3]!;
        const opacos=Array.from({length:f.w},(_,x)=>alfa(x,linha)).some(a=>a>=config.alphaOpaco);
        if(!opacos){expect(m.recuoInferiorPx).toBe(0);continue;}
        let pixelsOpacosAbaixo=0;
        for(let y=linha+1;y<f.h;y++)for(let x=0;x<f.w;x++)if(alfa(x,y)>=config.alphaOpaco)pixelsOpacosAbaixo++;
        expect(pixelsOpacosAbaixo,nome).toBe(0);
        const u={id:nome,gxDesenhado:4.5,gyDesenhado:6.25,deslocamentoPx:{x:7,y:-3},peY:0,frame:nome,corpoPx:{x0:-f.w/2,y0:-f.h,x1:f.w/2,y1:0}};
        const g=geometriaDoAnel(u,terreno.tile_px);
        expect(g.y).toBeCloseTo((u.gyDesenhado+0.5)*terreno.tile_px-3-m.recuoInferiorPx+config.deslocamentoDoPePx);
        for(const zoom of [0.5,1,2])expect((g.y-((u.gyDesenhado+0.5)*terreno.tile_px-3-m.recuoInferiorPx))*zoom).toBe(config.deslocamentoDoPePx*zoom);
      }
    }
  });
  it('placeholder acompanha interpolacao e deslocamento sem inventar margem para o sul',()=>{
    const u={id:'sem-png',gxDesenhado:1.5,gyDesenhado:2.25,deslocamentoPx:{x:2,y:-8}};
    expect(geometriaDoAnel(u,64)).toMatchObject({x:130,y:168});
    expect(geometriaDoAnel({...u,gyDesenhado:2.75},64).y).toBe(200);
  });
  it('prepara galeria dos quinze militares para selecao pelo mouse',()=>{
    let s=createInitialState(1);
    const porId={...s.unidades.porId},ordem=[...s.unidades.ordem];
    [...Object.keys(tema.militares),...Object.keys(tema.mercenarios)].forEach((tipo,i)=>{
      const id=`galeria-${tipo}`;
      const u:Unidade={id,tipo,lado:0,...naVila(-5+(i%5)*2,8+Math.floor(i/5)*3),direcao:i%8,fsm:'ocioso',fsmData:{},condicao:condicaoCheiaDoTipo(tipo)};
      porId[id]=u;ordem.push(id);
    });
    s={...s,unidades:{porId,ordem}};
    const {descoberto,...visual}=s;void descoberto;
    mkdirSync(DIR_DA_EVIDENCIA, { recursive: true });
    writeFileSync(`${DIR_DA_EVIDENCIA}/I-TELA-SELECAO-NO-PE.save.txt`,salvar(visual));
    expect(ordem.filter(id=>id.startsWith('galeria-'))).toHaveLength(medidas.fontes.length);
  });
});
