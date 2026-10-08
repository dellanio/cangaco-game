import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import manifesto from '../assets/manifest.json';
import {posicoesDaMercadoriaNoEstoque,ladoDaMercadoriaNoEstoque,pilhasVisiveisDoPredio} from '../src/render/estoque-visual';
import {dadosDasPilhas} from '../src/render/predios';
import type {EntradaDeCamada, Manifesto} from '../src/render/manifesto';
import type {PredioCompleto} from '../src/sim/state';
import {violacoesDaCamadaViva} from '../src/render/manifesto-camadas';
const require=createRequire(import.meta.url);
const {decodePng}=require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as {decodePng:(b:Buffer)=>{width:number;height:number;data:Uint8Array}};
describe('I-ARTE-BARRIS-DE-CACHACA-NO-CANAVIAL',()=>{
 it('base original versionada, derivado transparente, manifesto e fonte de pilha validos',()=>{
  const e=(manifesto as unknown as Manifesto).assets.find(a=>a.id==='wine'&&a.tipo==='pilha') as EntradaDeCamada;
  expect(e).toBeDefined();expect(e.footprint).toEqual([1,1]);expect(e.anchor).toEqual([0.5,1]);
  const png=decodePng(readFileSync(`assets/${e.estados.unidade}`));expect([png.width,png.height]).toEqual(e.tamanho);
  expect(png.data[3]).toBe(0);expect(png.data.some((a,i)=>i%4===3&&a>=128)).toBe(true);
  const registro=JSON.parse(readFileSync('assets/base/wine-stock/geracao.json','utf8')) as {sha256:string};
  expect(createHash('sha256').update(readFileSync(`assets/${e.origem.base}`)).digest('hex')).toBe(registro.sha256);
  const d=dadosDasPilhas(manifesto as unknown as Manifesto);expect(violacoesDaCamadaViva(e,d.contexto)).toEqual([]);
 });
 it('estoque real 0 ate teto mostra barris lado a lado sem segundo andar',()=>{
  const dados=dadosDasPilhas(manifesto as unknown as Manifesto);
  for(const n of [0,1,2,3,4,5,10]){
   const p:PredioCompleto={id:'canavial',lado:0,tipo:'wineyard',gx:0,gy:0,estado:'completo',hp:550,capacidade:{entrada:null,saida:null},estoque:{entrada:{},saida:{wine:n}},ocupante:null,producao:null,pausado:false,reparo:false};
   const antes=JSON.stringify(p),pilhas=pilhasVisiveisDoPredio(p,dados);expect(pilhas.length).toBe(n===0?0:1);
   if(n>0){expect(pilhas[0]!.n).toBe(Math.min(n,5));const pontos=posicoesDaMercadoriaNoEstoque('wineyard','wine',pilhas[0]!.n);expect(pontos).toHaveLength(Math.min(n,5));expect(pontos.every(p=>p[1]===0)).toBe(true);expect(new Set(pontos.map(p=>p[0])).size).toBe(pontos.length);expect(pontos.reduce((s,p)=>s+p[0],0)).toBeCloseTo(0);}
   expect(JSON.stringify(p)).toBe(antes);
  }
  expect(posicoesDaMercadoriaNoEstoque('mill','corn',5).some(p=>p[1]<0)).toBe(true);
  expect(ladoDaMercadoriaNoEstoque('wineyard','wine',12.8)).toBeCloseTo(23.04);
 });
});
