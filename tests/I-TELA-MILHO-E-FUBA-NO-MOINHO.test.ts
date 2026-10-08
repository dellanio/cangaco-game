import {describe,it,expect} from 'vitest';
import {ladoDaMercadoriaNoEstoque,ladoPadraoDoEstoque,pilhasVisiveisDoPredio} from '../src/render/estoque-visual';
import {dadosDasPilhas} from '../src/render/predios';
import type {Manifesto} from '../src/render/manifesto';
import manifesto from '../assets/manifest.json';
import terreno from '../data/terrain.json';
import type {PredioCompleto} from '../src/sim/state';
describe('I-TELA-MILHO-E-FUBA-NO-MOINHO',()=>{
 it('milho 1.30 e fuba 2.00 somente no moinho, nos dois eixos do desenho',()=>{
  const antes=ladoPadraoDoEstoque(terreno.tile_px);
  for(const [m,fator] of [['corn',1.3],['flour',2]] as const){
   expect(ladoDaMercadoriaNoEstoque('mill',m,antes)/antes).toBeCloseTo(fator);
   expect(ladoDaMercadoriaNoEstoque('storehouse',m,antes)).toBe(antes);
   expect(ladoDaMercadoriaNoEstoque('farm',m,antes)).toBe(antes);
  }
 });
 it('estoque zero/positivo conserva quantidade, ancora e estado',()=>{
  const dados=dadosDasPilhas(manifesto as unknown as Manifesto);
  const p:PredioCompleto={id:'moinho',lado:0,tipo:'mill',gx:0,gy:0,estado:'completo',hp:550,capacidade:{entrada:null,saida:null},estoque:{entrada:{corn:5},saida:{flour:5}},ocupante:null,producao:null,pausado:false,reparo:false};
  const antes=JSON.stringify(p),pilhas=pilhasVisiveisDoPredio(p,dados),e=manifesto.assets.find(a=>a.id==='mill')!;
  expect(pilhas.map(x=>[x.mercadoria,x.n,x.ponto])).toEqual([['corn',5,e.ancoras!.estoque!.entrada![0]],['flour',5,e.ancoras!.estoque!.saida![0]]]);
  expect(pilhasVisiveisDoPredio({...p,estoque:{entrada:{},saida:{}}},dados)).toEqual([]);
  expect(JSON.stringify(p)).toBe(antes);
 });
});
