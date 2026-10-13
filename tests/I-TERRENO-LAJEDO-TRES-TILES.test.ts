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
import { semRoca } from './helpers/roca';
import { pedreiraDaVila, ruaDaPedreiraDaVila } from './helpers/producao-cenario';

const require = createRequire(import.meta.url);
type MapaDeAutoria = { recursos: Record<string, number[][]>; contagemDeRecursos: Record<string, number>; linhas: string[]; contagemPorTipo?: unknown };
/** I-TERRENO-MINERAIS-PERTO-DAS-VILAS (emenda de 2026-10-13): as 34 casas de terreno que a autoria dos
 *  minerais muda (5 manchas). A guarda as mascara, junto com as camadas de minerio que ela redistribui. */
const CASAS_DOS_MINERAIS: readonly (readonly [number, number])[] = [[13,32],[13,33],[13,34],[57,82],[58,82],[59,82],[57,83],[58,83],[59,83],[63,84],[64,84],[65,84],[63,85],[64,85],[65,85],[100,89],[100,90],[100,91],[100,92],[101,93],[101,94],[102,95],[103,96],[104,96],[98,106],[98,107],[98,108],[98,109],[99,111],[99,112],[100,113],[101,114],[103,115],[104,115]];
const CAMADAS_DOS_MINERAIS = ['gold_ore', 'iron_ore', 'coal'] as const;
const { validarLajedoDaVila } = require('../tools/data-rules.js') as { validarLajedoDaVila: (c: unknown, m: unknown, erros: string[]) => void };
describe('I-TERRENO-LAJEDO-TRES-TILES', () => {
  it('pedreiras reposicionadas respeitam o vao e suas ruas sao legais e ligadas a vila', () => {
    // I-OBRA-SEM-PREDIO-NA-ROCA: o lote lajedo(10, 8) pega a cana de partida do mapa (a roca recusa com
    // `roca`, coberta no teste dela); o assunto aqui e o vao e a rua
    const inicial = semRoca(createInitialState(1)), lajedo = relativoA(ancoraDoLajedo());
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
    // I-TERRENO-MINERAIS-PERTO-DAS-VILAS (emenda de 2026-10-13): mascaradas tambem as 34 casas e as tres
    // camadas de minerio que a redistribuicao muda, e a contagem por tipo (derivada das linhas). Medido na
    // sessao: o mapa de antes e o de depois, mascarados assim, davam o mesmo hash; o hash era 2b835f60...
    // com o mapa inteiro
    const linhas = mapa.linhas.map((l) => l.split(''));
    for (const [x, y] of CASAS_DOS_MINERAIS) (linhas[y] as string[])[x] = '?';
    mapa.linhas = linhas.map((l) => l.join(''));
    for (const k of CAMADAS_DOS_MINERAIS) { delete mapa.recursos[k]; delete mapa.contagemDeRecursos[k]; }
    delete mapa.contagemPorTipo;
    expect(createHash('sha256').update(JSON.stringify(mapa)).digest('hex')).toBe('44d43325cb278b257b9a0b55a2c45dfa15fa8145f565c5a07de645dbcbdcaabe');
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
