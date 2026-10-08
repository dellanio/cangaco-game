import {describe,it,expect} from 'vitest';
import terreno from '../data/terrain.json';
import {transformacaoDoClima} from '../src/render/cobertura-clima';
describe('I-TELA-CLIMA-COBERTURA-ZOOM',()=>{
  it('cantos e centro ficam no mesmo pixel em cada zoom, origem e resize',()=>{
    for(const z of terreno.zoom.niveis) for(const [w,h] of [[1280,720],[1024,768]]) for(const [ox,oy] of [[0.5,0.5],[0,0],[1,1]]) {
      const a=transformacaoDoClima(w!,h!,z,ox!,oy!);
      for(const [x,y] of [[0,0],[w,0],[0,h],[w,h],[w!/2,h!/2]]) {
        expect((a.x+x!*a.escala-w!*ox!)*z+w!*ox!).toBeCloseTo(x!,8);
        expect((a.y+y!*a.escala-h!*oy!)*z+h!*oy!).toBeCloseTo(y!,8);
      }
    }
  });
});
