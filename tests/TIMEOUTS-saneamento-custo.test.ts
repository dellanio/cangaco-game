import { expect, it } from 'vitest';
import { sanearTarefas } from '../src/sim/systems/jobs';
import { criarTarefa } from '../src/sim/jobs';
import { armazemDoCenario, cenarioLigado } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';
import type { GameState } from '../src/sim/state';

function quadro(n: number, demanda: number): GameState {
  let s = cenarioLigado({stone:demanda});
  const armazem = armazemDoCenario(s);
  for (let i=0;i<n;i++) s = criarTarefa(s,{mercadoria:'stone',origem:armazem.id,destino:'obra-a'}).state;
  return {...s,jobs:{tarefas:{...s.jobs.tarefas,ordem:[...s.jobs.tarefas.ordem].reverse()}}};
}

it('ordena o mesmo quadro apenas uma vez por saneamento', () => {
  let enumeracoes = 0;
  const s0 = quadro(20,40);
  const ordem = new Proxy([...s0.jobs.tarefas.ordem],{get(target,key,receiver) {
    if (key === 'map') enumeracoes++;
    return Reflect.get(target,key,receiver);
  }});
  const s = {...s0,jobs:{tarefas:{...s0.jobs.tarefas,ordem}}};
  const antes = JSON.stringify(s);
  const r = sanearTarefas(s);
  expect(JSON.stringify(r.state)).toBe(antes);
  expect(JSON.stringify(s)).toBe(antes);
  expect(r.events).toEqual([]);
  gravarEvidencia('TIMEOUTS-saneamento-custo',{tarefas:20,enumeracoes});
  expect(enumeracoes).toBe(1);
});

it('reconsulta apos cancelar e em nova chamada, preservando menores numeros e JSON', () => {
  const s = quadro(6,3);
  const menores = Object.values(s.jobs.tarefas.porId).map(t => t.numero).sort((a,b) => a-b);
  const r = sanearTarefas(s);
  const numeros = (e: GameState) => Object.values(e.jobs.tarefas.porId).map(t => t.numero).sort((a,b) => a-b);
  expect(numeros(r.state)).toEqual(menores.slice(0,3));
  const obra = r.state.predios.porId['obra-a']!;
  if (obra.estado !== 'obra') throw new Error('fixture sem obra');
  const mudou = {...r.state,predios:{...r.state.predios,porId:{...r.state.predios.porId,'obra-a':{...obra,obra:{...obra.obra,faltam:{stone:2}}}}}};
  const seguinte = sanearTarefas(mudou);
  expect(numeros(seguinte.state)).toEqual(menores.slice(0,2));
  expect(seguinte).toEqual(sanearTarefas(JSON.parse(JSON.stringify(mudou)) as GameState));
  expect(s.jobs.tarefas.ordem).toHaveLength(6);
});
