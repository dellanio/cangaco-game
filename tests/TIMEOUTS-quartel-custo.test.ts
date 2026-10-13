import { expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { ehRequisitoDoQuartel, requisitosDoQuartel } from '../src/sim/quartel';
import { gravarEvidencia } from './helpers/evidence';

function observar(tipos = [...gameData.unidades.militares.tipos]) {
  let leituras = 0;
  const lista = new Proxy(tipos, {get(target,key,receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) leituras++;
    return Reflect.get(target,key,receiver);
  }});
  const dados: GameData = {...gameData,unidades:{...gameData.unidades,militares:{...gameData.unidades.militares,tipos:lista}}};
  return {dados,leituras:() => leituras};
}

it('mercadoria desconhecida nao percorre tipos militares', () => {
  const s = observar();
  expect(ehRequisitoDoQuartel('nao-publicada',s.dados)).toBe(false);
  gravarEvidencia('TIMEOUTS-quartel-custo',{tipos:gameData.unidades.militares.tipos.length,leituras:s.leituras()});
  expect(s.leituras()).toBe(0);
});

it('requisito do primeiro tipo interrompe a consulta', () => {
  const primeiro = gameData.unidades.militares.tipos.find(t => (t.requisitos?.length ?? 0) > 0)!;
  const requisito = primeiro.requisitos![0]!;
  const s = observar([primeiro,...gameData.unidades.militares.tipos]);
  expect(ehRequisitoDoQuartel(requisito,s.dados)).toBe(true);
  expect(s.leituras()).toBe(1);
});

it('booleana equivale a lista antiga com dados publicados e injetados mutaveis', () => {
  const primeiro = gameData.unidades.militares.tipos[0]!;
  const tipos = [{...primeiro,requisitos:['corn']}];
  const dados: GameData = {...gameData,unidades:{...gameData.unidades,militares:{...gameData.unidades.militares,tipos}}};
  const conferir = (d: GameData): void => {
    for (const m of [...d.economia.mercadorias,'desconhecida']) {
      expect(ehRequisitoDoQuartel(m,d),m).toBe(requisitosDoQuartel(d).includes(m));
    }
  };
  conferir(gameData);
  conferir(dados);
  expect(ehRequisitoDoQuartel('corn',dados)).toBe(true);
  tipos[0] = {...primeiro,requisitos:['nao-publicada']};
  conferir(dados);
  expect(ehRequisitoDoQuartel('corn',dados)).toBe(false);
  expect(ehRequisitoDoQuartel('nao-publicada',dados)).toBe(false);
});
