import {describe,it,expect} from 'vitest';
import {ladoDaMercadoriaNoEstoque,ladoPadraoDoEstoque} from '../src/render/estoque-visual';
import terreno from '../data/terrain.json';

describe('I-TELA-PEDRA-ESTOQUE-MAIOR',()=>{
  it('aumenta apenas a pedra no estoque da pedreira em 30%',()=>{
    const antes=ladoPadraoDoEstoque(terreno.tile_px);
    expect(ladoDaMercadoriaNoEstoque('quarry','stone',antes)/antes).toBeCloseTo(1.3);
    expect(ladoDaMercadoriaNoEstoque('storehouse','stone',antes)).toBe(antes);
    expect(ladoDaMercadoriaNoEstoque('quarry','wood',antes)).toBe(antes);
    expect(ladoDaMercadoriaNoEstoque('desconhecido','stone',antes)).toBe(antes);
  });
});
