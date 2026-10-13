import { expect, it } from 'vitest';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { avancarNevoa, visaoDe } from '../src/sim/nevoa';
import { gravarEvidencia } from './helpers/evidence';

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;

it('conferir descoberto de outra linha consulta apenas tiles visiveis', () => {
  const s = createInitialState(1);
  const v = visaoDe(s);
  const contagem = v.contagem;
  const visiveis = Array.from(contagem).filter(n => n > 0).length;
  let leituras = 0;
  Object.defineProperty(v, 'contagem', {value: new Proxy(contagem, {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) leituras++;
      return Reflect.get(target, key, target);
    },
  })});
  const antes = JSON.stringify(s);
  let resultado: GameState;
  try {
    resultado = avancarNevoa(s, clone(s));
  } finally {
    Object.defineProperty(v, 'contagem', {value: contagem});
  }
  expect(resultado.descoberto).toEqual(s.descoberto);
  expect(JSON.stringify(s)).toBe(antes);
  gravarEvidencia('TIMEOUTS-nevoa-custo', {area: contagem.length, visiveis, leituras});
  expect(leituras).toBeLessThanOrEqual(visiveis);
});

it('indice acompanha movimento, morte, lado, obra, demolicao e load', () => {
  let s = createInitialState(1);
  const unidade = s.unidades.ordem[0]!;
  const predio = s.predios.ordem[0]!;
  const conferir = (proximo: GameState): void => {
    s = avancarNevoa(s, proximo);
    const v = visaoDe(s);
    const indices = Array.from(v.contagem).flatMap((n,i) => n > 0 ? [i] : []);
    // Prova independente: reconstrucao completa de uma referencia sem cache.
    expect(Array.from(v.contagem)).toEqual(Array.from(visaoDe(clone(s)).contagem));
    expect([...v.tilesVisiveis].sort((a,b) => a-b)).toEqual(indices);
  };
  const u = s.unidades.porId[unidade]!;
  conferir({...s, unidades: {...s.unidades, porId: {...s.unidades.porId, [unidade]: {...u, gx:u.gx+2}}}});
  const movida = s.unidades.porId[unidade]!;
  conferir({...s, unidades: {...s.unidades, porId: {...s.unidades.porId, [unidade]: {...movida, lado:LADO_DO_JOGADOR+1}}}});
  const { [unidade]: _morta, ...vivas } = s.unidades.porId;
  conferir({...s, unidades: {porId:vivas, ordem:s.unidades.ordem.filter(id => id !== unidade)}});
  const p = s.predios.porId[predio]!;
  const obra = {...p, estado:'obra' as const, obra:{faltam:{}, nivelamento:0}};
  conferir({...s, predios:{...s.predios, porId:{...s.predios.porId,[predio]:obra}}});
  conferir({...s, predios:{...s.predios, porId:{...s.predios.porId,[predio]:p}}});
  const { [predio]: _demolido, ...restantes } = s.predios.porId;
  conferir({...s, predios:{porId:restantes, ordem:s.predios.ordem.filter(id => id !== predio)}});
  conferir(clone(s));
});
