import {describe,it,expect} from 'vitest';
import {gameData,loadGameData,rawGameData} from '../src/sim/data';
import type {GameData} from '../src/sim/data';
import {createInitialState} from '../src/sim/state';
import type {Unidade,GameState} from '../src/sim/state';
import {andar} from '../src/sim/units/movimento';
import {custoDoPassoDaUnidade,FSM_EM_CARGA} from '../src/sim/carga';
import {posicaoDaUnidade} from '../src/sim/selectors';
import {step} from '../src/sim/tick';
import {condicaoCheiaDoTipo} from '../src/sim/condicao';
import {tileAndavel} from '../src/sim/pathfinding';
import type {Command} from '../src/sim/commands';
import {naVila} from './helpers/ancoras';
import {validarTudo} from '../tools/data-rules.js';
import {ARQUIVOS} from '../tools/data-schema.js';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const seca=gameData.clima.ciclo.slice(0,2).reduce((s,f)=>s+f.ticks,0);
const chuva=gameData.clima.ciclo.slice(0,3).reduce((s,f)=>s+f.ticks,0);
const inicio=naVila(15,15);
function unidade(tipo:string,diagonal:boolean):Unidade {
 return {id:'teste',tipo,lado:0,...inicio,direcao:2,fsm:'marchando',fsmData:{caminho:[{gx:inicio.gx+1,gy:inicio.gy+(diagonal?1:0)}],progresso:0},condicao:100};
}
function cenario(u:Unidade,tick:number,estrada:boolean):GameState {
 const base=createInitialState(1),t=u.fsmData.caminho![0]!;
 return {...base,tick,estradas:estrada?{[`${t.gx},${t.gy}`]:true}:{},unidades:{ordem:[u.id],porId:{[u.id]:u}}};
}
function viagem(u:Unidade,tick:number,estrada:boolean,dados:GameData):number {
 let s=cenario(u,tick,estrada),n=0;
 while(u.fsmData.caminho!.length){u=andar(s,u,dados);n++;s={...s,tick:s.tick+1,unidades:{ordem:[u.id],porId:{[u.id]:u}}};if(n>100)throw Error('nao chegou');}
 return n;
}
describe('I-CLIMA-PENALIDADE-DE-MARCHA',()=>{
 it('pelo step: mesma marcha inverno/seca tem razao 0.8, inclusive investida sem dupla penalidade',()=>{
  const medidas=[];
  for(const estrada of [false,true])for(const diagonal of [false,true]){
   const u={...unidade('militia',diagonal),fsm:'ocioso',fsmData:{},condicao:condicaoCheiaDoTipo('militia'),direcao:diagonal?3:2};
   const destino={gx:u.gx+1,gy:u.gy+(diagonal?1:0)};
   const marcha:Command={type:'MoveUnits',unidades:[u.id],destino};
   const investida:Command={type:'StormAttack',unidades:[u.id]};
   function medir(tick:number,comando:Command):number{
    const base=createInitialState(1);
    let s:GameState={...base,tick,predios:{porId:{},ordem:[]},recursos:{},unidades:{porId:{[u.id]:u},ordem:[u.id]},estradas:estrada?{[`${destino.gx},${destino.gy}`]:true}:{}};
    expect(tileAndavel(s,u,'livre',gameData)).toBe(true);
    expect(tileAndavel(s,destino,'livre',gameData)).toBe(true);
    let n=0;
    do{
     s=step(s,n===0?[comando]:[],gameData);n++;
     expect(s.events.filter(e=>e.type==='command-rejected')).toEqual([]);
     expect(s.unidades.porId[u.id]).toBeDefined();
     if(n>100)throw Error('marcha nao concluiu um passo');
    }while(s.unidades.porId[u.id]!.gx===u.gx&&s.unidades.porId[u.id]!.gy===u.gy);
    expect(s.unidades.porId[u.id]).toMatchObject(destino);
    return n;
   }
   const normal=medir(0,marcha),seco=medir(seca,marcha);
   expect(Math.abs(seco-normal/0.8)).toBeLessThanOrEqual(1);
   const carga=medir(0,investida),cargaSeca=medir(seca,investida);
   const bonus=gameData.combate.stormAttack.multiplicadorVelocidade;
   expect(carga).toBe(Math.max(1,Math.round(normal/bonus)));
   expect(cargaSeca).toBe(Math.max(1,Math.round(normal/(bonus*0.8))));
   medidas.push({estrada,diagonal,normal,seco,carga,cargaSeca});
  }
  mkdirSync('test-output',{recursive:true});writeFileSync('test-output/I-CLIMA-PENALIDADE-DE-MARCHA-step.json',JSON.stringify(medidas,null,2));
 });
 it('todos os tipos, solo/estrada e reta/diagonal usam 80% com arredondamento unico',()=>{
  const medidas=[];
  for(const tipo of Object.keys(gameData.unidades))for(const estrada of [false,true])for(const diagonal of [false,true]){
   const u=unidade(tipo,diagonal),normal=viagem(u,0,estrada,gameData),seco=viagem(u,seca,estrada,gameData);
   expect(seco).toBe(Math.max(1,Math.round(normal/0.8)));
   expect(Math.abs(seco-normal/0.8)).toBeLessThanOrEqual(0.5);
   const s=cenario(u,seca,estrada),emCurso={...u,fsmData:{...u.fsmData,progresso:1}};
   const p=posicaoDaUnidade(s,emCurso,gameData);
   expect(p.gx).toBeCloseTo(u.gx+1/seco);
   const off={...gameData,clima:{...gameData.clima,ligado:false}};
   expect(viagem(u,seca,estrada,off)).toBe(normal);
   medidas.push({tipo,estrada,diagonal,normal,seco,velocidadeEfetiva:normal/seco});
  }
  mkdirSync('test-output',{recursive:true});writeFileSync('test-output/I-CLIMA-PENALIDADE-DE-MARCHA.json',JSON.stringify(medidas,null,2));
 });
 it('investida combina bonus e seca uma vez; parametros e crescimento permanecem carregados',()=>{
  const outro=loadGameData({...rawGameData,clima:{...rawGameData.clima,ciclo:rawGameData.clima.ciclo.map(f=>({...f,multiplicadorVelocidade:f.id==='seca'?0.5:1}))}});
  for(const estrada of [false,true])for(const diagonal of [false,true]){
   const u=unidade('militia',diagonal),s=cenario(u,seca,estrada),base=custoDoPassoDaUnidade({...s,tick:0},u,u.fsmData.caminho![0]!);
   expect(custoDoPassoDaUnidade(s,u,u.fsmData.caminho![0]!,outro)).toBe(Math.round(base/0.5));
   expect(custoDoPassoDaUnidade(s,{...u,fsm:FSM_EM_CARGA},u.fsmData.caminho![0]!)).toBe(Math.max(1,Math.round(base/(0.8*gameData.combate.stormAttack.multiplicadorVelocidade))));
  }
  expect(outro.clima.ciclo.map(f=>f.multiplicadorDeCrescimento)).toEqual(gameData.clima.ciclo.map(f=>f.multiplicadorDeCrescimento));
 });
 it('troca de fase mantem progresso e usa custo atual, deterministicamente',()=>{
  const u=unidade('militia',false),s=cenario(u,seca-1,false),a=andar(s,u,gameData);
  const seco={...s,tick:seca};
  expect(andar(seco,a,gameData)).toEqual(andar(seco,a,gameData));
  expect(andar(seco,a,gameData).fsmData.progresso).toBe(2);
  const custo=custoDoPassoDaUnidade({...s,tick:chuva},u,u.fsmData.caminho![0]!);
  const vencido={...u,fsmData:{...u.fsmData,progresso:custo}};
  expect(andar({...s,tick:chuva},vencido,gameData).fsmData.caminho).toEqual([]);
 });
 it('validador rejeita velocidade ausente, zero, negativa ou nao finita',()=>{
  const dados=Object.fromEntries(ARQUIVOS.map((id:string)=>[id,JSON.parse(readFileSync(`data/${id}.json`,'utf8'))]));
  for(const v of [undefined,0,-1,Infinity]){
   const clima={...rawGameData.clima,ciclo:rawGameData.clima.ciclo.map(f=>({...f,multiplicadorVelocidade:v}))};
   expect(validarTudo({...dados,clima}).some((e:string)=>e.includes('multiplicadorVelocidade'))).toBe(true);
  }
 });
});
