import {describe,it,expect} from 'vitest';
import {pilhasVisiveisDoPredio} from '../src/render/estoque-visual';
import {pilhasDoPredio} from '../src/render/pilhas';
import {dadosDasPilhas} from '../src/render/predios';
import type {Manifesto} from '../src/render/manifesto';
import type {PredioCompleto,PredioEmObra} from '../src/sim/state';
import manifesto from '../assets/manifest.json';

describe('I-TELA-ARMAZEM-SEM-PILHAS-EXTERNAS',()=>{
  const dados=dadosDasPilhas(manifesto as unknown as Manifesto);
  const p:PredioCompleto={id:'armazem',tipo:'storehouse',lado:0,gx:0,gy:0,estado:'completo',hp:1,capacidade:{entrada:null,saida:null},estoque:{entrada:{corn:7},saida:{timber:9,stone:4,fish:7,loaves:6}},ocupante:null,producao:null,pausado:false,reparo:false};
  it('oculta objetos externos mantendo as quatro pilhas logicas e os estoques intactos',()=>{
    const antes=JSON.stringify(p);
    expect(pilhasDoPredio(p,dados)).toHaveLength(4);
    expect(pilhasVisiveisDoPredio(p,dados)).toEqual([]);
    expect(JSON.stringify(p)).toBe(antes);
    expect(pilhasVisiveisDoPredio({...p,tipo:'quarry'},dados)).toHaveLength(1);
  });
  it('continua exibindo materiais entregues na obra do armazem',()=>{
    const obra:PredioEmObra={id:p.id,tipo:p.tipo,lado:0,gx:0,gy:0,estado:'obra',hp:0,obra:{faltam:{},nivelamento:0}};
    const esperadas=pilhasDoPredio(obra,dados);
    expect(esperadas.length).toBeGreaterThan(0);
    expect(pilhasVisiveisDoPredio(obra,dados)).toEqual(esperadas);
  });
});
