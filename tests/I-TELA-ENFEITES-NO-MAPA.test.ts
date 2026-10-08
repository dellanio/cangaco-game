import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { criarTerrenoDeRender, sementeDoMapa, centroDaVilaInicial } from '../src/render/mapa';
import { candidatosAEnfeite, enfeiteNoTile, enfeitesLivres, configDosEnfeites, MemoriaDosEnfeites } from '../src/render/enfeites';

const terreno = criarTerrenoDeRender();
const candidatos = candidatosAEnfeite(terreno, sementeDoMapa, centroDaVilaInicial);
const chave = (e: { gx: number; gy: number }) => `${e.gx},${e.gy}`;
describe('I-TELA-ENFEITES-NO-MAPA', () => {
  it('mesma semente e mapa; outra muda; exclui terreno e raio; densidade real ±20%', () => {
    expect(candidatosAEnfeite(terreno, sementeDoMapa, centroDaVilaInicial)).toEqual(candidatos);
    expect(candidatosAEnfeite(terreno, sementeDoMapa+1, centroDaVilaInicial)).not.toEqual(candidatos);
    const cheia = { ...configDosEnfeites, densidade: 1 };
    for (const tipo of ['agua','rocha','montanha','campoArado']) expect(enfeiteNoTile(100,100,sementeDoMapa,tipo,centroDaVilaInicial,cheia)).toBeNull();
    expect(enfeiteNoTile(centroDaVilaInicial.gx,centroDaVilaInicial.gy,sementeDoMapa,'grama',centroDaVilaInicial,cheia)).toBeNull();
    let elegiveis = 0;
    for (let gy=0;gy<terreno.altura;gy++) for(let gx=0;gx<terreno.largura;gx++) if(enfeiteNoTile(gx,gy,sementeDoMapa,terreno.tipos[terreno.codigos[gy*terreno.largura+gx]!]!,centroDaVilaInicial,cheia)) elegiveis++;
    const densidade = candidatos.length/elegiveis;
    expect(densidade).toBeGreaterThanOrEqual(configDosEnfeites.densidade*0.8);
    expect(densidade).toBeLessThanOrEqual(configDosEnfeites.densidade*1.2);
    mkdirSync('test-output',{recursive:true});
    writeFileSync('test-output/I-TELA-ENFEITES-NO-MAPA-densidade.json',JSON.stringify({elegiveis,enfeites:candidatos.length,densidade,alvo:configDosEnfeites.densidade},null,2));
  });
  it('step com predio, rua e rocado oculta; demolicao devolve o mesmo enfeite', () => {
    // Fixture com a arvore de construcao ja liberada; os comandos continuam reais.
    const inicial = { ...createInitialState(sementeDoMapa), tiposJaConstruidos: gameData.predios.map(p => p.id) };
    const livres = enfeitesLivres(candidatos,inicial);
    const p = livres.find(e=>canPlace(inicial,'farm',e.gx,e.gy).ok)!;
    expect(p).toBeTruthy();
    const comPredio = step(inicial,[{type:'PlaceBlueprint',buildingId:'farm',gx:p.gx,gy:p.gy}]);
    expect(enfeitesLivres(candidatos,comPredio).some(e=>chave(e)===chave(p))).toBe(false);
    const predio = comPredio.predios.ordem.find(id=>comPredio.predios.porId[id]?.gx===p.gx && comPredio.predios.porId[id]?.gy===p.gy)!;
    expect(predio).toBeTruthy();
    const demolido = step(comPredio,[{type:'DemolishBuilding',predio}]);
    expect(enfeitesLivres(candidatos,demolido)).toContainEqual(p);
    const r = livres.find(e=>terreno.tipos[terreno.codigos[e.gy*terreno.largura+e.gx]!] === 'grama')!;
    const rua = step(inicial,[{type:'PlaceRoad',tiles:[r]}]);
    expect(rua.estradasPlanejadas[chave(r)]).toBe(true);
    expect(enfeitesLivres(candidatos,rua)).not.toContainEqual(r);
    const roca = step(inicial,[{type:'PlowField',recurso:'corn',tiles:[r]}]);
    expect(roca.camposPlanejados[chave(r)]).toBe('corn');
    expect(enfeitesLivres(candidatos,roca)).not.toContainEqual(r);
  });
  it('oculta recurso e unidade parada; cache nao trabalha a cada quadro', () => {
    const inicial = createInitialState(sementeDoMapa);
    const memoria = new MemoriaDosEnfeites(candidatos);
    const mapa = memoria.atualizar(inicial,1);
    const r = mapa[0]!;
    expect(r).toBeTruthy();
    const u = inicial.unidades.porId[inicial.unidades.ordem[0]!]!;
    const comUnidade = { ...inicial, unidades: { ordem: [u.id], porId: { [u.id]: { ...u, gx:r.gx,gy:r.gy,fsmData:{} } } } };
    expect(enfeitesLivres(candidatos,comUnidade)).not.toContainEqual(r);
    for(let i=0;i<100;i++) expect(memoria.atualizar(inicial,1)).toBe(mapa);
    expect(memoria.recalculos).toBe(1);
    memoria.atualizar(step(inicial,[]),1);
    expect(memoria.recalculos).toBe(2);
    memoria.atualizar(inicial,2);
    expect(memoria.recalculos).toBe(3);
    expect(enfeitesLivres(candidatos,inicial).every(e=>!inicial.recursos[chave(e)])).toBe(true);
  });
});
