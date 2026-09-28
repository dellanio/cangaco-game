/**
 * F26b — selecionar e comandar pela tela: as partes sem navegador (plano em
 * docs/planos/2026-09-28-A9-F26-grupo.md). O roteiro `tools/shots/F26b.js` prova o resto
 * na tela, carregando o save que este teste grava.
 *
 *  - o acerto mira o DESENHO (`deslocamentoDaUnidade`, nota da F18f): duas unidades no
 *    MESMO tile, cada clique no centro desenhado de uma devolve ela primeiro;
 *  - a caixa pega quem tem o centro desenhado dentro;
 *  - os gestos: clique curto nao vira caixa, arrasto alem do limiar vira; o botao
 *    direito de mao vazia vira ordem, e com ferramenta so larga a ferramenta.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { centroDesenhado, unidadesNaCaixa, unidadesNoPonto } from '../src/render/acerto';
import type { UnidadeDesenhada } from '../src/render/acerto';
import { deslocamentoDaUnidade, ESCALA_DO_MUNDO } from '../src/render/grid';
import { criarEntradaDoMapa, LIMIAR_DA_CAIXA_PX } from '../src/input/colocar';
import type { GestosMilitares, PontoNoMundo, TileClicado } from '../src/input/colocar';
import { criarFerramenta } from '../src/input/ferramenta';
import { criarSelecaoMilitar } from '../src/input/selecao-militar';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { canPlace } from '../src/sim/placement';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';

const TILE = gameData.terreno.tilePx;
const desenhada = (id: string, gx: number, gy: number): UnidadeDesenhada => ({
  id, gxDesenhado: gx, gyDesenhado: gy, deslocamentoPx: deslocamentoDaUnidade(id, TILE, ESCALA_DO_MUNDO),
});

describe('F26b — o acerto mira o desenho', () => {
  // ids escolhidos com desvios DIFERENTES (o anel da F18f e funcao do id)
  const ids = ['sold1', 'sold2', 'sold3', 'sold4', 'sold5', 'sold6'];
  const noMesmoTile = ids.map((id) => desenhada(id, 10, 10));

  it('duas unidades no mesmo tile: o clique no centro desenhado de cada uma a devolve primeiro', () => {
    const centros = new Set(noMesmoTile.map((u) => {
      const c = centroDesenhado(u, TILE);
      return `${c.x.toFixed(2)},${c.y.toFixed(2)}`;
    }));
    expect(centros.size, 'a fixture precisa de desvios distintos').toBeGreaterThan(1);
    for (const u of noMesmoTile) {
      const outros = noMesmoTile.filter((o) => {
        const a = centroDesenhado(o, TILE);
        const b = centroDesenhado(u, TILE);
        return o.id !== u.id && (a.x !== b.x || a.y !== b.y);
      });
      const [primeiro] = unidadesNoPonto([u, ...outros], centroDesenhado(u, TILE), TILE);
      expect(primeiro).toBe(u.id);
    }
  });

  it('longe de toda unidade, o clique nao acerta ninguem', () => {
    expect(unidadesNoPonto(noMesmoTile, { x: 0, y: 0 }, TILE)).toEqual([]);
  });

  it('a caixa pega quem tem o centro desenhado dentro, e so esses', () => {
    const espalhadas = [desenhada('a', 2, 2), desenhada('b', 3, 2), desenhada('c', 9, 9)];
    const caixa = unidadesNaCaixa(espalhadas, { x: 4 * TILE, y: 3 * TILE }, { x: 2 * TILE, y: 2 * TILE }, TILE);
    expect(caixa).toEqual(['a', 'b']);
  });
});

describe('F26b — os gestos da mao vazia', () => {
  function montar(): { entrada: ReturnType<typeof criarEntradaDoMapa>; log: string[]; ferramenta: ReturnType<typeof criarFerramenta> } {
    const log: string[] = [];
    const gestos: GestosMilitares = {
      aoClicarVazio: (t: TileClicado, _p: PontoNoMundo | null, somar: boolean) => log.push(`clique ${t.gx},${t.gy} ${somar}`),
      aoCaixa: (a, b, somar) => log.push(`caixa ${a.x},${a.y} ${b.x},${b.y} ${somar}`),
      aoOrdenar: (t) => log.push(`ordem ${t.gx},${t.gy}`),
    };
    const ferramenta = criarFerramenta();
    return { entrada: criarEntradaDoMapa(ferramenta, () => log.push('comando'), undefined, gestos), log, ferramenta };
  }

  it('clique curto seleciona e nao vira caixa; arrasto alem do limiar vira caixa com o shift', () => {
    const { entrada, log } = montar();
    entrada.aoClicar({ gx: 1, gy: 1 }, { x: 70, y: 70 }, false);
    entrada.aoSoltar({ gx: 1, gy: 1 }, { x: 70 + LIMIAR_DA_CAIXA_PX - 1, y: 70 });
    expect(log).toEqual(['clique 1,1 false']);
    entrada.aoClicar({ gx: 1, gy: 1 }, { x: 70, y: 70 }, true);
    entrada.aoArrastar({ gx: 3, gy: 3 }, { x: 200, y: 210 });
    expect(entrada.caixa()).toEqual({ a: { x: 70, y: 70 }, b: { x: 200, y: 210 } });
    entrada.aoSoltar({ gx: 3, gy: 3 }, { x: 200, y: 210 });
    expect(log.slice(1)).toEqual(['clique 1,1 true', 'caixa 70,70 200,210 true']);
    expect(entrada.caixa()).toBeNull();
  });

  it('botao direito de mao vazia vira ordem; com ferramenta so larga a ferramenta', () => {
    const { entrada, log, ferramenta } = montar();
    expect(entrada.aoClicarDireito({ gx: 5, gy: 6 })).toBe(false);
    expect(log).toEqual(['ordem 5,6']);
    ferramenta.selecionar('storehouse');
    expect(entrada.aoClicarDireito({ gx: 5, gy: 6 })).toBe(true);
    expect(log).toEqual(['ordem 5,6']);
    expect(ferramenta.modo).toBe('nenhum');
  });

  it('a selecao militar soma sem repetir e so avisa quando muda', () => {
    const sel = criarSelecaoMilitar();
    const vistos: string[][] = [];
    sel.aoMudar((ids) => vistos.push([...ids]));
    sel.definir(['a']);
    sel.somar(['b', 'a']);
    sel.definir(['a', 'b']);
    sel.limpar();
    expect(vistos).toEqual([['a'], ['a', 'b'], []]);
  });
});

describe('F26b — a partida que o roteiro carrega', () => {
  it('grava a vila com tres milicianos (dois no MESMO tile) e uma escola inimiga', () => {
    let s: GameState = createInitialState(1);
    const livre: { gx: number; gy: number }[] = [];
    for (let dx = 0; dx < 20 && livre.length < 2; dx += 1) {
      const t = naVila(2 + dx, 7);
      if (tileAndavel(s, t, 'livre', gameData)) livre.push(t);
    }
    const [t1, t2] = livre;
    if (t1 === undefined || t2 === undefined) throw new Error('fixture: sem tile livre para os soldados');
    const posicoes = [t1, t1, t2]; // sold1 e sold2 no MESMO tile: e o caso da nota da F18f
    const unidades = { porId: { ...s.unidades.porId }, ordem: [...s.unidades.ordem] };
    posicoes.forEach((t, i) => {
      const u: Unidade = {
        lado: LADO_DO_JOGADOR, id: `sold${i + 1}`, tipo: 'militia', gx: t.gx, gy: t.gy,
        fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia'),
      };
      unidades.porId[u.id] = u;
      unidades.ordem.push(u.id);
    });
    s = { ...s, unidades };
    let lugar: { gx: number; gy: number } | null = null;
    for (let r = 8; r < 30 && lugar === null; r += 1) {
      for (let d = -r; d <= r && lugar === null; d += 1) {
        const p = naVila(d, r);
        if (canPlace(s, 'schoolhouse', p.gx, p.gy, gameData).ok) lugar = p;
      }
    }
    if (lugar === null) throw new Error('fixture: sem lugar para a escola inimiga');
    const inimiga = completarObra({
      lado: LADO_DO_JOGADOR + 1, id: 'inimiga', tipo: 'schoolhouse', ...lugar, estado: 'obra', hp: 550,
      obra: { faltam: {}, nivelamento: 0 },
    }, gameData);
    s = { ...s, predios: { porId: { ...s.predios.porId, inimiga }, ordem: [...s.predios.ordem, 'inimiga'] } };
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F26b.save.txt`, salvar(s));
    expect(s.unidades.porId['sold1']).toMatchObject({ gx: t1.gx, gy: t1.gy });
    expect(s.unidades.porId['sold2']).toMatchObject({ gx: t1.gx, gy: t1.gy });
  });
});
