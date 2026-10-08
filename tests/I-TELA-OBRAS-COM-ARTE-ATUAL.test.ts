import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import manifesto from '../assets/manifest.json';
import grade from '../data/obra-revelacao.json';
import {blocosVisiveis,revelacaoVisualDaObra} from '../src/render/obra-revelacao';
import {aparenciaDoPredio} from '../src/render/predios';
import {createInitialState} from '../src/sim/state';
import {step} from '../src/sim/tick';
import {salvar} from '../src/sim/save';
import {comPredioCompletoEm} from './helpers/jobs-cenario';
import {naVila} from './helpers/ancoras';
const require=createRequire(import.meta.url);
const {decodePng}=require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as {decodePng:(p:Buffer)=>{width:number;height:number;data:Uint8Array}};
const pe=(png:ReturnType<typeof decodePng>):number=>{
  for(let y=png.height-1;y>=0;y--)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]!>0)return y;
  return -1;
};
describe('I-TELA-OBRAS-COM-ARTE-ATUAL',()=>{
  it('cada predio com completo cresce por partes, sem retirar partes ja construidas',()=>{
    for(const e of manifesto.assets.filter(a=>a.tipo==='predio')){
      const a=aparenciaDoPredio(e.id);
      if(a.hpTotal<=0)continue;
      let anteriores=new Set<string>();
      for(let n=0;n<=100;n++){
        const r=revelacaoVisualDaObra(Math.floor(a.hpTotal*n/100),a.hpTotal,a.custo.timber??0,a.custo.stone??0,'madeira' in e.estados);
        const partes=new Set(r===null?[]:[...blocosVisiveis(r.madeira,grade,`${e.id}:madeira`).map(b=>`m:${b.linha},${b.coluna}`),...blocosVisiveis(r.pedra,grade,`${e.id}:pedra`).map(b=>`p:${b.linha},${b.coluna}`)]);
        for(const b of anteriores)expect(partes.has(b),`${e.id} perdeu ${b} em ${n}%`).toBe(true);
        anteriores=partes;
      }
      expect(anteriores.size,e.id).toBe(('madeira' in e.estados?2:1)*grade.linhas*grade.colunas);
    }
    expect(revelacaoVisualDaObra(0,100,3,2,false)).toBeNull();
    expect(revelacaoVisualDaObra(50,100,3,2,false)).toEqual({madeira:[0,1],pedra:[50,100]});
  });
  it('madeira da pedreira tem arte atual, mesma dimensao e pe, com origem rastreavel',()=>{
    const e=manifesto.assets.find(a=>a.id==='quarry')!;
    const madeira=decodePng(readFileSync(`assets/${e.estados.madeira}`));
    const completo=decodePng(readFileSync(`assets/${e.estados.completo}`));
    expect([madeira.width,madeira.height]).toEqual([completo.width,completo.height]);
    expect(pe(madeira)).toBe(pe(completo));
    expect(e.estados.madeira).toBe('sprites/quarry/quarry_madeira-D-20261007.png');
    const origem=JSON.parse(readFileSync('assets/base/quarry/quarry-madeira-20261007-geracao.json','utf8'));
    expect(origem.referencia).toBe(e.estados.completo);
    expect(createHash('sha256').update(readFileSync(`assets/${origem.base}`)).digest('hex')).toBe(origem.sha256);
  });
  it('prepara quadro de pares e predios com somente completo em quatro progressos',()=>{
    mkdirSync('test-output',{recursive:true});
    const lista:[string,number,number][]=[['quarry',4,9],['mill',-3,9],['barracks',4,14],['church',-3,14]];
    for(const n of [25,50,60,75,100]){
      let s=createInitialState(1);
      for(const [tipo,dx,dy] of lista){
        s=comPredioCompletoEm(s,tipo,{tipo,...naVila(dx,dy)});
        const p=s.predios.porId[tipo]!;
        if(n<100)s={...s,predios:{...s.predios,porId:{...s.predios.porId,[tipo]:{id:tipo,tipo,lado:0,gx:p.gx,gy:p.gy,estado:'obra',hp:Math.floor(aparenciaDoPredio(tipo).hpTotal*n/100),obra:{faltam:{},nivelamento:aparenciaDoPredio(tipo).alvoDeNivelamento}}}}};
      }
      s=step(s,[]);
      // Cena comparativa de arte: sem nevoa no save, pelo contrato legado.
      const {descoberto,...visual}=s;
      void descoberto;
      writeFileSync(`test-output/I-TELA-OBRAS-COM-ARTE-ATUAL-${n}.save.txt`,salvar(visual));
      expect(lista.every(([id])=>s.predios.porId[id]!==undefined)).toBe(true);
    }
  });
});
