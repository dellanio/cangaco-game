/**
 * H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA — o som de cada predio vem do lugar dele.
 *
 * (a) "posicao do som + centro da camera -> volume", por tabela: cheio no centro, caindo com a
 *     distancia, zero no raio e alem;
 * (b) "estado -> sons de trabalho a tocar", por tabela: o laborer na obra, o laborer na estrada, o
 *     cabouqueiro, ninguem trabalhando (silencio), e o teto de vozes;
 * (d) a mesma partida com e sem som da o mesmo estado, byte a byte;
 * (f) o som do tile de rua por tabela: um tile aceito toca uma vez, N tiles no mesmo quadro tocam
 *     uma vez, e o tile recusado nao toca o `road-placed`.
 * O (c) e o roteiro `tools/shots/H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA.js`; o (e), os arquivos no
 * manifesto, e o `tests/H-ARTE-SONS-APROVADOS.test.ts`.
 *
 * Os estados de trabalho do (b) sao de uma partida de verdade: a abertura da Fase A
 * (`comandosNoTick`), que puxa a rua, engaja os especialistas e levanta as casas.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { salvar } from '../src/sim/save';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { chaveDeTile } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { criarCamadaDeSom, pedidosDaRua, sonsDoQuadro, volumeNaDistancia } from '../src/render/som';
import type { TabelaDeSom } from '../src/render/som';
import { criarSomDoTrabalho, fontesDeTrabalho, vozesDeTrabalho } from '../src/render/som-do-trabalho';
import type { DadosDoTrabalho, FonteDeTrabalho } from '../src/render/som-do-trabalho';
import tabelaJson from '../data/som.json';
import { aberturaDaFaseA, comandosNoTick } from './helpers/abertura';
import { gravarEvidencia } from './helpers/evidence';

const TABELA = tabelaJson as unknown as TabelaDeSom;
const TRABALHO = (tabelaJson as unknown as { trabalho: DadosDoTrabalho }).trabalho;
const RAIO = tabelaJson.distancia.raioTiles;
const TODOS = new Set(Object.keys(TABELA.sons));

/** A abertura da Fase A, tick a tick, ate `teto`; devolve os estados em que cada som de trabalho
 *  aparece primeiro, e a lista de comandos de cada tick (para o (d)). */
function abertura(teto: number): { primeiro: Map<string, GameState>; comandos: ReturnType<typeof comandosNoTick>[]; inicial: GameState } {
  const inicial = createInitialState(gameData.economia.estadoInicial.semente);
  const plano = aberturaDaFaseA(inicial);
  let s = inicial;
  const primeiro = new Map<string, GameState>();
  const comandos: ReturnType<typeof comandosNoTick>[] = [];
  for (let i = 0; i < teto; i += 1) {
    const c = comandosNoTick(s, plano, i);
    comandos.push(c);
    s = step(s, c, gameData);
    for (const f of fontesDeTrabalho(s, TRABALHO)) if (!primeiro.has(f.id)) primeiro.set(f.id, s);
    if (primeiro.size === 3 && comandos.length > 600) break;
  }
  return { primeiro, comandos, inicial };
}
const CORRIDA = abertura(5000);

describe('H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA', () => {
  it('(a) posicao + centro -> volume, por tabela', () => {
    const c = { gx: 50, gy: 50 };
    const tabela: readonly [string, TileDeGrid, number][] = [
      ['no centro', { gx: 50, gy: 50 }, 1],
      ['a meio raio', { gx: 50 + RAIO / 2, gy: 50 }, 0.5],
      ['a um quarto, na diagonal', { gx: 50 + (RAIO / 4) * Math.SQRT1_2, gy: 50 + (RAIO / 4) * Math.SQRT1_2 }, 0.75],
      ['no raio', { gx: 50, gy: 50 + RAIO }, 0],
      ['alem do raio', { gx: 50 + 3 * RAIO, gy: 50 }, 0],
    ];
    for (const [nome, lugar, esperado] of tabela) expect(volumeNaDistancia(lugar, c, RAIO), nome).toBeCloseTo(esperado, 9);
    // cai sempre: mais longe nunca e mais alto
    let antes = 2;
    for (let d = 0; d <= RAIO + 2; d += 1) {
      const v = volumeNaDistancia({ gx: 50 + d, gy: 50 }, c, RAIO);
      expect(v).toBeLessThanOrEqual(antes);
      antes = v;
    }
    // na camada: o pedido com lugar fora do raio nao toca; o sem lugar toca cheio
    const tocados: { id: string; volume: number }[] = [];
    const camada = criarCamadaDeSom(TABELA, TODOS, { tocar: (id, volume) => { tocados.push({ id, volume }); } });
    camada.pedir('goods-produced', { gx: 50 + RAIO + 1, gy: 50 });
    camada.pedir('peace-ended');
    camada.pedir('building-completed', { gx: 50 + RAIO / 2, gy: 50 });
    camada.quadro(c);
    expect(tocados.map((t) => t.id).sort()).toEqual(['building-completed', 'peace-ended']);
    expect(tocados.find((t) => t.id === 'building-completed')?.volume).toBeCloseTo(0.5, 9);
    expect(tocados.find((t) => t.id === 'peace-ended')?.volume).toBe(1);
    expect(camada.contadores().foraDoRaio).toBe(1);
    // dois do mesmo id no quadro: o teto e 1, e toca o mais perto
    tocados.length = 0;
    camada.pedir('goods-produced', { gx: 50 + RAIO / 2, gy: 50 });
    camada.pedir('goods-produced', { gx: 50, gy: 50 });
    camada.quadro(c);
    expect(tocados).toEqual([{ id: 'goods-produced', volume: 1 }]);
  });

  it('(b) estado -> sons de trabalho, por tabela', () => {
    const inicial = CORRIDA.inicial;
    const tabela: readonly [string, GameState, string][] = [
      ['o laborer na obra', CORRIDA.primeiro.get(TRABALHO.construir) as GameState, TRABALHO.construir],
      ['o laborer na estrada', CORRIDA.primeiro.get(TRABALHO.estrada) as GameState, TRABALHO.estrada],
      ['o cabouqueiro na pedra', CORRIDA.primeiro.get(TRABALHO.colheita['rock'] as string) as GameState, TRABALHO.colheita['rock'] as string],
    ];
    for (const [nome, estado, id] of tabela) {
      expect(estado, `${nome}: a abertura deveria passar por ele`).toBeDefined();
      const fontes = fontesDeTrabalho(estado, TRABALHO);
      expect(fontes.map((f) => f.id), nome).toContain(id);
      // a fonte e a unidade, no tile dela, no estado de trabalho que a animacao tambem le
      for (const f of fontes.filter((x) => x.id === id)) {
        const u = estado.unidades.porId[f.unidade];
        expect(u && { gx: u.gx, gy: u.gy }, nome).toEqual(f.tile);
        expect(['martelando', 'nivelando', 'colhendo'], nome).toContain(u?.fsm);
      }
    }
    // ninguem trabalhando: silencio
    expect(fontesDeTrabalho(inicial, TRABALHO)).toEqual([]);
    expect(vozesDeTrabalho([], { gx: 0, gy: 0 }, RAIO, TRABALHO.tetoDeVozes)).toEqual([]);
    // o teto de vozes: das cinco fontes no raio tocam as `tetoDeVozes` mais perto, e as fora do raio nunca
    const c = { gx: 40, gy: 40 };
    const fontes: FonteDeTrabalho[] = [
      { id: 'build-wood', unidade: 'u5', tile: { gx: 44, gy: 40 } },
      { id: 'build-wood', unidade: 'u1', tile: { gx: 41, gy: 40 } },
      { id: 'build-road', unidade: 'u2', tile: { gx: 40, gy: 42 } },
      { id: 'quarry-work', unidade: 'u3', tile: { gx: 40, gy: 46 } },
      { id: 'quarry-work', unidade: 'u4', tile: { gx: 40, gy: 40 + RAIO } },
      { id: 'build-road', unidade: 'u6', tile: { gx: 43, gy: 40 } },
    ];
    const vozes = vozesDeTrabalho(fontes, c, RAIO, 3);
    expect(vozes.map((v) => v.unidade)).toEqual(['u1', 'u2', 'u6']);
    expect(vozes.map((v) => v.voz)).toEqual(['build-wood:0', 'build-road:0', 'build-road:1']);
    expect(vozesDeTrabalho(fontes, c, RAIO, 10).map((v) => v.unidade)).not.toContain('u4');
    expect(vozesDeTrabalho(fontes, null, RAIO, 10)).toEqual([]);
    // na camada de trabalho: liga perto, para quando ninguem mais esta no raio
    const log: string[] = [];
    const somDoTrabalho = criarSomDoTrabalho({
      dados: TRABALHO, raioTiles: RAIO, disponiveis: TODOS, volume: () => 1,
      tocador: { tocar: (voz) => { log.push(`tocar ${voz}`); }, parar: (voz) => { log.push(`parar ${voz}`); } },
    });
    const naObra = CORRIDA.primeiro.get(TRABALHO.construir) as GameState;
    const pedreiro = fontesDeTrabalho(naObra, TRABALHO).find((f) => f.id === TRABALHO.construir) as FonteDeTrabalho;
    somDoTrabalho.quadro(naObra, pedreiro.tile);
    expect(log).toContain(`tocar ${TRABALHO.construir}:0`);
    log.length = 0;
    somDoTrabalho.quadro(naObra, { gx: pedreiro.tile.gx + 3 * RAIO, gy: pedreiro.tile.gy });
    expect(log).toContain(`parar ${TRABALHO.construir}:0`);
    expect(somDoTrabalho.contadores().vozes).toEqual([]);
    // o save do roteiro (c): o primeiro tick com um laborer batendo tabua numa obra, e o tile dele.
    // No diretorio da evidencia, como o BUG-SAVE-DO-ROTEIRO-TRANSLADADO ensinou.
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA.save.txt`, salvar(naObra, gameData));
    writeFileSync(`${dir}/H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA.partida.json`, JSON.stringify({ tick: naObra.tick, laborer: pedreiro.unidade, tile: pedreiro.tile }));
    gravarEvidencia('H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA', {
      primeiroTick: Object.fromEntries([...CORRIDA.primeiro].map(([id, s]) => [id, s.tick])),
      raioTiles: RAIO, tetoDeVozes: TRABALHO.tetoDeVozes,
    });
  });

  it('(d) a mesma partida com e sem som da o mesmo estado, byte a byte', () => {
    let com = CORRIDA.inicial;
    let sem = CORRIDA.inicial;
    const camada = criarCamadaDeSom(TABELA, TODOS, { tocar: () => undefined });
    const somDoTrabalho = criarSomDoTrabalho({ dados: TRABALHO, raioTiles: RAIO, disponiveis: TODOS, volume: () => 1, tocador: { tocar: () => undefined, parar: () => undefined } });
    const centro = { gx: 32, gy: 32 };
    for (const c of CORRIDA.comandos) {
      com = step(com, c, gameData);
      camada.aoPasso(com, c.length);
      for (const k of c) if (k.type === 'PlaceRoad') camada.pedirRua(com, k.tiles, gameData);
      somDoTrabalho.quadro(com, centro);
      camada.quadro(centro);
      sem = step(sem, c, gameData);
    }
    expect(somDoTrabalho.contadores().quadrosComVoz).toBeGreaterThan(0);
    expect(JSON.stringify(com)).toBe(JSON.stringify(sem));
  });

  it('(f) o tile de rua pedido, por tabela', () => {
    const s = CORRIDA.inicial;
    const plano = aberturaDaFaseA(s);
    const rua = plano.rua;
    const id = TABELA.rua as string;
    const tocaNoQuadro = (pedidos: readonly string[]): number => sonsDoQuadro(pedidos, TABELA, TODOS).tocar.filter((x) => x === id).length;
    // um tile aceito: um pedido, toca uma vez
    const um = pedidosDaRua(s, rua.slice(0, 1), id, gameData);
    expect(um).toEqual([id]);
    expect(tocaNoQuadro(um)).toBe(1);
    // N tiles no mesmo quadro: N pedidos, toca uma vez
    const varios = pedidosDaRua(s, rua, id, gameData);
    expect(varios.length).toBe(rua.length);
    expect(tocaNoQuadro(varios)).toBe(1);
    // o tile recusado (em cima de um recurso que bloqueia) nao toca o road-placed
    const recurso = Object.keys(s.recursos)[0] as string;
    const [gx, gy] = recurso.split(',').map(Number) as [number, number];
    expect(pedidosDaRua(s, [{ gx, gy }], id, gameData)).toEqual([]);
    // o tile que ja e canteiro nao conta de novo
    const comCanteiro: GameState = { ...s, estradasPlanejadas: { [chaveDeTile(rua[0] as TileDeGrid)]: true } };
    expect(pedidosDaRua(comCanteiro, rua.slice(0, 2), id, gameData)).toEqual([id]);
  });
});
