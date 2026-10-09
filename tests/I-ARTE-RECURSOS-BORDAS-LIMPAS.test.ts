import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
type Png={width:number;height:number;data:Uint8Array};
const require=createRequire(import.meta.url);
const {bleedRgba,bleedPng}=require('../tools/png-bleed.mjs') as {bleedRgba:(p:Png)=>Png;bleedPng:(b:Uint8Array)=>Uint8Array};
const {encodePng,decodePng}=require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as {encodePng:(p:Png)=>Uint8Array;decodePng:(b:Uint8Array)=>Png};
const {validateSpriteSpec}=require('../skills/pianco-sprite-tools/scripts/validate-sprites.mjs') as {validateSpriteSpec:(s:unknown,o?:{cwd:string})=>{success:boolean;errors:Array<{code:string}>}};
function amostra():Png{
  const p={width:16,height:16,data:new Uint8Array(16*16*4)};
  for(let y=4;y<12;y++)for(let x=4;x<12;x++){
    const i=(y*16+x)*4;p.data.set([180+y*2,150+y*2,90+y*2,x===4?100:255],i);
  }
  return p;
}
describe('I-ARTE-RECURSOS-BORDAS-LIMPAS — RGB invisivel deterministico',()=>{
  it('preserva alpha/canvas e todo pixel visivel, sem mutar entrada; idempotente',()=>{
    const antes=amostra(),copia=new Uint8Array(antes.data),depois=bleedRgba(antes);
    expect([depois.width,depois.height]).toEqual([antes.width,antes.height]);
    expect(antes.data).toEqual(copia);
    for(let i=0;i<antes.data.length;i+=4){
      expect(depois.data[i+3]).toBe(antes.data[i+3]);
      if(antes.data[i+3]!>0)expect(depois.data.slice(i,i+4)).toEqual(antes.data.slice(i,i+4));
    }
    expect(bleedRgba(depois)).toEqual(depois);
    expect(decodePng(bleedPng(encodePng(antes)))).toEqual(depois);
  });
  it('PNG vazio conserva todos os pixels',()=>{
    const vazio={width:4,height:4,data:new Uint8Array(64)};expect(bleedRgba(vazio)).toEqual(vazio);
  });
  it('validador original acusa a sonda sem bleed e aceita o mesmo desenho com bleed',()=>{
    const pasta=mkdtempSync(join(tmpdir(),'pianco-bleed-'));
    try{
      writeFileSync(join(pasta,'sem.png'),encodePng(amostra()));
      writeFileSync(join(pasta,'com.png'),bleedPng(encodePng(amostra())));
      const spec=(path:string)=>({id:'teste-borda',kind:'resource',mode:'trial',frameSize:[16,16],masterSize:[32,32],frames:[{state:'presente',direction:'front',index:0,path,pivot:[0.5,1]}]});
      const sem=validateSpriteSpec(spec('sem.png'),{cwd:pasta}),com=validateSpriteSpec(spec('com.png'),{cwd:pasta});
      expect(sem.errors.some(e=>e.code==='alpha-bleed')).toBe(true);
      expect(sem.success).toBe(false);expect(com.errors).toEqual([]);expect(com.success).toBe(true);
    }finally{rmSync(pasta,{recursive:true,force:true});}
  });
});
