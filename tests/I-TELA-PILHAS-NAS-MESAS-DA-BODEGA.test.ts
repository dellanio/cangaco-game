import {describe,it,expect} from 'vitest';
import manifesto from '../assets/manifest.json';
import {pilhasDoPredio} from '../src/render/pilhas';
import {dadosDasPilhas} from '../src/render/predios';
import type {Manifesto} from '../src/render/manifesto';
import type {PredioCompleto} from '../src/sim/state';

describe('I-TELA-PILHAS-NAS-MESAS-DA-BODEGA',()=>{
  it('as quatro comidas usam as duas mesas, abaixo do telhado, sem alterar estoques',()=>{
    const dados=dadosDasPilhas(manifesto as unknown as Manifesto);
    const e=manifesto.assets.find(a=>a.id==='inn')!;
    const entrada=Object.fromEntries(dados.contexto.comidas.map(m=>[m,1]));
    const p:PredioCompleto={id:'bodega',lado:0,tipo:'inn',gx:0,gy:0,estado:'completo',hp:550,capacidade:{entrada:null,saida:null},estoque:{entrada,saida:{}},ocupante:null,producao:null,pausado:false,reparo:false};
    const antes=JSON.stringify(p);
    const pilhas=pilhasDoPredio(p,dados);
    expect(pilhas).toHaveLength(4);
    expect(pilhas.map(x=>x.mercadoria)).toEqual(dados.contexto.comidas);
    pilhas.forEach((pilha,i)=>{
      const x=pilha.ponto[0]*e.tamanho[0]!;
      const y=pilha.ponto[1]*e.tamanho[1]!;
      const mesa=i<2 ? [65,115,226,234] : [220,270,260,270];
      expect(x).toBeGreaterThanOrEqual(mesa[0]!);
      expect(x).toBeLessThanOrEqual(mesa[1]!);
      expect(y).toBeGreaterThanOrEqual(mesa[2]!);
      expect(y).toBeLessThanOrEqual(mesa[3]!);
      expect(pilha.n).toBe(1);
    });
    expect(JSON.stringify(p)).toBe(antes);
    expect(pilhasDoPredio({...p,estoque:{entrada:{},saida:{}}},dados)).toEqual([]);
  });
});
