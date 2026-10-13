import { expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState } from '../src/sim/state';
import { tiposContratadosEm, predioQueContrata, ehPredioDeContratoCompleto } from '../src/sim/prefeitura';
import { gravarEvidencia } from './helpers/evidence';

function observar(dados: GameData) {
  let leituras = 0;
  const tipos = new Proxy([...dados.unidades.mercenarios.tipos], {get(target,key,receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) leituras++;
    return Reflect.get(target,key,receiver);
  }});
  return {
    dados:{...dados,unidades:{...dados.unidades,mercenarios:{...dados.unidades.mercenarios,tipos}}},
    leituras:() => leituras,
  };
}

it('filtra N tipos com no maximo N leituras, preservando ordem e referencias', () => {
  const observado = observar(gameData);
  const esperado = gameData.unidades.mercenarios.tipos.filter(t => predioQueContrata(t.id) === 'town_hall');
  const resultado = tiposContratadosEm('town_hall',observado.dados);
  expect(resultado).toEqual(esperado);
  resultado.forEach((tipo,i) => expect(tipo).toBe(esperado[i]));
  gravarEvidencia('TIMEOUTS-contratacao-custo',{tipos:gameData.unidades.mercenarios.tipos.length,leituras:observado.leituras()});
  expect(observado.leituras()).toBeLessThanOrEqual(gameData.unidades.mercenarios.tipos.length);
});

it('predio contratante para na primeira correspondencia e rejeita obra', () => {
  const p = createInitialState(1).predios.porId['p1']!;
  const observado = observar(gameData);
  const primeiro = gameData.unidades.mercenarios.tipos[0]!;
  const contratante = predioQueContrata(primeiro.id)!;
  expect(ehPredioDeContratoCompleto({...p,tipo:contratante},observado.dados)).toBe(true);
  expect(observado.leituras()).toBe(1);
  expect(ehPredioDeContratoCompleto({...p,estado:'obra',obra:{faltam:{},nivelamento:0}},observado.dados)).toBe(false);
  expect(observado.leituras()).toBe(1);
});

it('dados injetados, desconhecido e consultas seguintes nao recebem cache antigo', () => {
  const antes = JSON.stringify(gameData);
  const priest = gameData.unidades.mercenarios.tipos.find(
    (t): t is Extract<GameData['unidades']['mercenarios']['tipos'][number], {predioQueTreina:string}> =>
      t.id === 'priest' && typeof t.predioQueTreina === 'string',
  )!;
  const tipos = [{...priest,predioQueTreina:'schoolhouse'}];
  const dados = {...gameData,unidades:{...gameData.unidades,mercenarios:{...gameData.unidades.mercenarios,tipos}}};
  expect(tiposContratadosEm('schoolhouse',dados)).toEqual(tipos);
  expect(tiposContratadosEm('church',dados)).toEqual([]);
  expect(predioQueContrata('desconhecido',dados)).toBeNull();
  tipos[0] = {...priest,predioQueTreina:'church'};
  expect(tiposContratadosEm('schoolhouse',dados)).toEqual([]);
  expect(tiposContratadosEm('church',dados)).toEqual(tipos);
  expect(JSON.stringify(gameData)).toBe(antes);
});
