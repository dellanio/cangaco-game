import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import terreno from '../data/terrain.json';
import { createInitialState } from '../src/sim/state';
import { canPlaceRoad } from '../src/sim/estradas';
import { step } from '../src/sim/tick';
import { ancoraDoLajedo } from './helpers/ancoras';
import { relativoA } from './helpers/ancoras';
import { canPlace } from '../src/sim/placement';
import { pedreiraDaVila, ruaDaPedreiraDaVila } from './helpers/producao-cenario';

const require = createRequire(import.meta.url);
type MapaDeAutoria = { recursos: Record<string, number[][]>; contagemDeRecursos: Record<string, number> };
const { validarLajedoDaVila } = require('../tools/data-rules.js') as { validarLajedoDaVila: (c: unknown, m: unknown, erros: string[]) => void };
describe('I-TERRENO-LAJEDO-TRES-TILES', () => {
  it('pedreiras reposicionadas respeitam o vao e suas ruas sao legais e ligadas a vila', () => {
    const inicial = createInitialState(1), lajedo = relativoA(ancoraDoLajedo());
    for (const p of [pedreiraDaVila(), lajedo(-1, 5), lajedo(10, 8)]) {
      expect(canPlace(inicial, 'quarry', p.gx, p.gy)).toEqual({ ok: true });
      expect(canPlaceRoad(inicial, ruaDaPedreiraDaVila(undefined, p)).ok).toBe(true);
    }
    const posicoes = [lajedo(-1, 5), pedreiraDaVila()];
    const depois = step(inicial, posicoes.map(p => ({ type: 'PlaceBlueprint' as const, buildingId: 'quarry', ...p })));
    expect(depois.events.filter(e => e.type === 'command-rejected')).toEqual([]);
    expect(depois.predios.ordem.filter(id => depois.predios.porId[id]?.tipo === 'quarry')).toHaveLength(2);
  });
  it('autoria desloca exatamente os treze tiles e preserva o restante do mapa', () => {
    // Autoria e contrato do arquivo publicado: o processo filho le os dados do disco,
    // sem a interceptacao de fs da suite transladada. As sondas de sim acima andam +K.
    const mapa = JSON.parse(execFileSync(process.execPath, [
      '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1]).montarArquivo()))',
      fileURLToPath(new URL('../tools/gerar-mapa.js', import.meta.url)),
    ], { encoding: 'utf8' })) as MapaDeAutoria;
    const novos = mapa.recursos.rock!.filter(([x, y]) => (x! - 24) ** 2 + (y! - 28) ** 2 <= 4);
    const antigos = [[24,29],[23,30],[24,30],[25,30],[22,31],[23,31],[24,31],[25,31],[26,31],[23,32],[24,32],[25,32],[24,33]];
    expect(novos).toEqual(antigos.map(([x,y]) => [x, y! - 3])); expect(novos).toHaveLength(13);
    expect(mapa.contagemDeRecursos.rock).toBe(265);
    mapa.recursos.rock = mapa.recursos.rock!.filter(p => !novos.includes(p));
    // Registro do mapa homologado, retirando SOMENTE os treze tiles da vila:
    // terrenos, recursos restantes, legenda e metadados ficam byte a byte iguais.
    expect(createHash('sha256').update(JSON.stringify(mapa)).digest('hex')).toBe('2b835f6017d0f2643a765f5dabfe36cc7029b03ea7879a6188125038ad47baff');
  });
  it('canPlaceRoad e PlaceRoad pelo step recusam cada tile novo do lajedo real', () => {
    const inicial = createInitialState(1), a = ancoraDoLajedo();
    const tiles = Object.keys(inicial.recursos).map(k => k.split(',').map(Number)).filter(([x,y]) => (x! - (a.gx + 2)) ** 2 + (y! - (a.gy + 2)) ** 2 <= 4);
    expect(tiles).toHaveLength(13);
    for (const [gx,gy] of tiles) {
      const tile = { gx: gx!, gy: gy! }, chave = `${gx},${gy}`;
      expect(canPlaceRoad(inicial, [tile])).toEqual({ ok: false, motivo: 'recurso', tile });
      const depois = step(inicial, [{ type: 'PlaceRoad', tiles: [tile] }]);
      expect(depois.estradas[chave]).toBeUndefined(); expect(depois.estradasPlanejadas[chave]).toBeUndefined();
      expect(depois.events).toContainEqual({ type: 'command-rejected', command: 'PlaceRoad', motivo: 'recurso', tile });
      const recursos = { ...inicial.recursos }; delete recursos[chave];
      expect(canPlaceRoad({ ...inicial, recursos }, [tile]).ok).toBe(true);
    }
  });
  it('numeros de autoria validam centro/raio/destino', () => {
    const erros: string[] = []; validarLajedoDaVila(terreno.geracao.lajedoDaVila, terreno.mapaPadrao, erros); expect(erros).toEqual([]);
    for (const c of [null, {gx:24,gy:28,raio:0}, {gx:1,gy:1,raio:2}, {gx:24.5,gy:28,raio:2}]) {
      const erros: string[] = []; validarLajedoDaVila(c, terreno.mapaPadrao, erros); expect(erros.length).toBeGreaterThan(0);
    }
  });
});
