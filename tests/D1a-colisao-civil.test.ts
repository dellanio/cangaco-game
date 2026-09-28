/**
 * D1a — o mecanismo da colisao civil, atras da chave `units.json colisaoCivil.ligada`
 * (plano em docs/planos/2026-09-28-D1-colisao-civil.md, secao 6). O mecanismo e o do WalkTo do
 * kam_remake: troca de frente, empurrao do ocioso, desvio e troca forcada.
 *
 * Os cenarios de mecanismo andam com um laco de movimento proprio (o empurrao e o `andar`
 * da sim, as mesmas funcoes que o `step` chama) para isolar o passo das FSMs: a vila inteira
 * com a chave ligada e o D1b e o D1c.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { andar, comUnidade } from '../src/sim/units/movimento';
import { POSICAO_DO_ESTADO, sistemaDoEmpurrao } from '../src/sim/colisao';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDaColisao } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

type Tile = { gx: number; gy: number };
const LIGADA: GameData = { ...gameData, movimento: { ...gameData.movimento, colisaoCivil: { ...gameData.movimento.colisaoCivil, ligada: true } } };
const C = LIGADA.movimento.colisaoCivil;

// ---------- a varredura dos estados ----------
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : [];
  });
}
/** Todo estado de FSM que `src/sim` escreve ou compara: `fsm: 'x'`, `FSM_X = 'x'`,
 *  `fsm === 'x'`, `comFsm(..., 'x')` e os `case 'x':` dos `switch (u.fsm)`. */
function estadosNoCodigo(): Set<string> {
  const achados = new Set<string>();
  for (const f of arquivos('src/sim')) {
    const src = readFileSync(f, 'utf8');
    for (const re of [/fsm: *'([a-z_]+)'/g, /FSM_[A-Z_]+ *= *'([a-z_]+)'/g, /fsm [!=]== *'([a-z_]+)'/g, /comFsm\([^)]*'([a-z_]+)'\)/g]) {
      for (const m of src.matchAll(re)) achados.add(m[1] as string);
    }
    for (const bloco of src.matchAll(/switch \(u\.fsm\) \{([\s\S]*?)default:/g)) {
      for (const m of (bloco[1] as string).matchAll(/case '([a-z_]+)':/g)) achados.add(m[1] as string);
    }
  }
  return achados;
}

// ---------- o laco de movimento ----------
function civil(id: string, t: Tile, fsm: string, caminho: Tile[] = []): Unidade {
  return {
    lado: LADO_DO_JOGADOR, id, tipo: 'serf', gx: t.gx, gy: t.gy, fsm,
    fsmData: caminho.length === 0 ? {} : { caminho, progresso: 0 }, condicao: condicaoCheiaDoTipo('serf'),
  };
}
function comUnidades(s: GameState, us: Unidade[]): GameState {
  return { ...s, unidades: { porId: Object.fromEntries(us.map((u) => [u.id, u])), ordem: us.map((u) => u.id) } };
}
/** Um tick: o empurrao e depois o `andar` de cada um, na ordem, como no `step`. */
function tickDeMovimento(s: GameState, dados: GameData): GameState {
  let atual = sistemaDoEmpurrao(s, dados);
  for (const id of atual.unidades.ordem) {
    const u = atual.unidades.porId[id] as Unidade;
    if ((u.fsmData.caminho ?? []).length > 0) atual = comUnidade(atual, andar(atual, u, dados));
  }
  return atual;
}
interface Corrida { s: GameState; violacoes: string[]; maiorEspera: number; ticks: number }
function correr(s0: GameState, ate: (s: GameState) => boolean, dados: GameData = LIGADA, limite = 2000): Corrida {
  let s = s0;
  const violacoes: string[] = [];
  let maiorEspera = 0;
  let t = 0;
  for (; t < limite && !ate(s); t += 1) {
    s = tickDeMovimento(s, dados);
    violacoes.push(...violacoesDaColisao(s, LIGADA).map((v) => `t${t}: ${v}`));
    for (const id of s.unidades.ordem) maiorEspera = Math.max(maiorEspera, s.unidades.porId[id]?.fsmData.bloqueado ?? 0);
  }
  return { s, violacoes, maiorEspera, ticks: t };
}
const em = (s: GameState, id: string): Tile => ({ gx: s.unidades.porId[id]?.gx as number, gy: s.unidades.porId[id]?.gy as number });
const todosChegaram = (s: GameState): boolean => s.unidades.ordem.every((id) => (s.unidades.porId[id]?.fsmData.caminho ?? []).length === 0);

/** Um campo aberto de 25 x 25 tiles andaveis, sem ninguem. */
function campo(): { s: GameState; c: Tile } {
  const s = { ...createInitialState(1), unidades: { porId: {}, ordem: [] } };
  for (let r = 8; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -12; dy <= 12 && livre; dy += 1) for (let dx = -12; dx <= 12 && livre; dx += 1) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return { s, c };
    }
  }
  throw new Error('fixture: sem campo aberto');
}
/** A rua de um tile: `comprimento` tiles de estrada em linha, da esquerda para a direita. */
function rua(comprimento: number): { s: GameState; tiles: Tile[] } {
  const { s, c } = campo();
  const tiles = Array.from({ length: comprimento }, (_, i) => ({ gx: c.gx - Math.floor(comprimento / 2) + i, gy: c.gy }));
  return { s: { ...s, estradas: { ...s.estradas, ...Object.fromEntries(tiles.map((t) => [`${t.gx},${t.gy}`, true as const])) } }, tiles };
}
const trecho = (tiles: Tile[], de: number, ate: number): Tile[] => {
  const r: Tile[] = [];
  if (ate > de) for (let i = de + 1; i <= ate; i += 1) r.push(tiles[i] as Tile);
  else for (let i = de - 1; i >= ate; i -= 1) r.push(tiles[i] as Tile);
  return r;
};

describe('D1a — a colisao civil', () => {
  it('o dado: a chave comeca desligada, e as esperas sao as do KaM na escala do movimento', () => {
    expect(gameData.movimento.colisaoCivil.ligada).toBe(false);
    expect([C.ticksEmpurrar, C.ticksDesviar, C.ticksRepetirDesvio, C.ticksTrocaForcada]).toEqual([1, 5, 25, 20]);
  });

  it('todo estado de FSM do codigo esta classificado dentro ou fora, e nada sobra na lista', () => {
    const achados = estadosNoCodigo();
    expect(achados.size).toBeGreaterThanOrEqual(28); // a varredura nao e vazia
    expect([...achados].filter((e) => POSICAO_DO_ESTADO[e] === undefined)).toEqual([]);
    expect(Object.keys(POSICAO_DO_ESTADO).filter((e) => !achados.has(e))).toEqual([]);
    // a varredura pega um estado novo: o mesmo regex, sobre um trecho que o jogo nao tem
    expect([..."{ ...u, fsm: 'rezando' }".matchAll(/fsm: *'([a-z_]+)'/g)].map((m) => m[1])).toEqual(['rezando']);
  });

  it('estado sem classificacao lanca no passo, e a invariante o acusa', () => {
    const { s, tiles } = rua(6);
    const s0 = comUnidades(s, [civil('a', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 5)), civil('b', tiles[1] as Tile, 'rezando')]);
    expect(violacoesDaColisao(s0, LIGADA)).toEqual(["b: estado 'rezando' sem classificacao de colisao"]);
    expect(() => correr(s0, todosChegaram)).toThrow(/sem classificacao 'rezando'/);
  });

  for (const n of [2, 4, 8]) {
    it(`rua de um tile com ${n} serfs em sentidos opostos: todos chegam, trocando, e a invariante fica limpa`, () => {
      const L = 24;
      const { s, tiles } = rua(L);
      const us: Unidade[] = [];
      for (let i = 0; i < n / 2; i += 1) {
        us.push(civil(`d${i}`, tiles[n / 2 - 1 - i] as Tile, 'indo_buscar', trecho(tiles, n / 2 - 1 - i, L - 1 - i)));
        us.push(civil(`e${i}`, tiles[L - n / 2 + i] as Tile, 'indo_entregar', trecho(tiles, L - n / 2 + i, i)));
      }
      const r = correr(comUnidades(s, us), todosChegaram);
      expect(r.violacoes).toEqual([]);
      for (let i = 0; i < n / 2; i += 1) {
        expect(em(r.s, `d${i}`)).toEqual(tiles[L - 1 - i]);
        expect(em(r.s, `e${i}`)).toEqual(tiles[i]);
      }
      // de frente nao se espera: a troca e imediata, e o mesmo sentido anda em fila
      expect(r.maiorEspera).toBeLessThanOrEqual(1);
      gravarEvidencia(`D1a-rua-${n}`, { serfs: n, ticks: r.ticks, maiorEspera: r.maiorEspera });
    });
  }

  it('o ocioso no caminho e empurrado: 10 ociosos na rua, o que anda passa sem desviar nem forcar', () => {
    const { s, tiles } = rua(14);
    const ociosos = Array.from({ length: 10 }, (_, i) => civil(`o${i}`, tiles[i + 2] as Tile, 'ocioso'));
    const s0 = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 13)), ...ociosos]);
    const r = correr(s0, todosChegaram);
    expect(r.violacoes).toEqual([]);
    expect(em(r.s, 'w')).toEqual(tiles[13]);
    expect(r.maiorEspera).toBeLessThanOrEqual(C.ticksEmpurrar);
    // cada ocioso saiu da rua para um vizinho, e nenhum ficou empilhado
    expect(ociosos.filter((o) => em(r.s, o.id).gy === (tiles[0] as Tile).gy).length).toBe(0);
  });

  it('quem esta dentro nao ocupa: o especialista trabalhando no tile nao segura ninguem', () => {
    const { s, tiles } = rua(8);
    const s0 = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 7)), civil('x', tiles[3] as Tile, 'trabalhando')]);
    const r = correr(s0, todosChegaram);
    expect(r.violacoes).toEqual([]);
    expect(r.maiorEspera).toBe(0);
    expect(em(r.s, 'w')).toEqual(tiles[7]);
  });

  it('um parado que nao se empurra no meio da rua de um tile: espera ate a troca forcada, e so', () => {
    const { s, tiles } = rua(8);
    const s0 = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 7)), civil('x', tiles[3] as Tile, 'colhendo')]);
    const r = correr(s0, todosChegaram);
    expect(r.violacoes).toEqual([]);
    expect(r.maiorEspera).toBe(C.ticksTrocaForcada - 1); // no tick seguinte ja entrou
    expect(em(r.s, 'w')).toEqual(tiles[7]);
  });

  it('o mesmo parado em campo aberto: o que anda contorna no desvio e nunca pisa no tile dele', () => {
    const { s, c } = campo();
    const linha = Array.from({ length: 9 }, (_, i) => ({ gx: c.gx - 4 + i, gy: c.gy }));
    const s0 = comUnidades(s, [civil('w', linha[0] as Tile, 'indo_buscar', trecho(linha, 0, 8)), civil('x', linha[4] as Tile, 'colhendo')]);
    let pisou = false;
    const r = correr(s0, (x) => { pisou ||= em(x, 'w').gx === (linha[4] as Tile).gx && em(x, 'w').gy === c.gy; return todosChegaram(x); });
    expect(r.violacoes).toEqual([]);
    expect(pisou).toBe(false);
    expect(r.maiorEspera).toBe(C.ticksDesviar);
    expect(em(r.s, 'w')).toEqual(linha[8]);
  });

  it('o destino ocupado por um parado: o que chega entra pela troca forcada e divide o tile com ele', () => {
    const { s, tiles } = rua(6);
    const s0 = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_entregar', trecho(tiles, 0, 5)), civil('x', tiles[5] as Tile, 'colhendo')]);
    const r = correr(s0, todosChegaram);
    expect(r.violacoes).toEqual([]);
    expect(em(r.s, 'w')).toEqual(tiles[5]);
    expect(r.s.unidades.porId['w']?.fsmData.trocaCom).toBe('x');
  });

  it('sem a troca forcada, a invariante acusa o bloqueado para sempre', () => {
    const semTroca: GameData = { ...LIGADA, movimento: { ...LIGADA.movimento, colisaoCivil: { ...C, ticksTrocaForcada: 1_000_000 } } };
    const { s, tiles } = rua(8);
    const s0 = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 7)), civil('x', tiles[3] as Tile, 'colhendo')]);
    const r = correr(s0, todosChegaram, semTroca, 200);
    expect(todosChegaram(r.s)).toBe(false);
    expect(r.violacoes.some((v) => v.includes('w: bloqueado ha'))).toBe(true);
  });

  it('desligada, o mesmo encontro de frente se atravessa, sem campo novo', () => {
    // distancia par: os dois chegam ao tile do meio no mesmo tick
    const { s, tiles } = rua(11);
    const s0 = comUnidades(s, [civil('a', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 10)), civil('b', tiles[10] as Tile, 'indo_buscar', trecho(tiles, 10, 0))]);
    let x = s0;
    let empilhou = false;
    for (let t = 0; t < 400 && !todosChegaram(x); t += 1) {
      x = tickDeMovimento(x, gameData);
      empilhou ||= em(x, 'a').gx === em(x, 'b').gx;
      expect(salvar(x)).not.toMatch(/bloqueado|trocaCom/);
    }
    expect(todosChegaram(x)).toBe(true);
    expect(empilhou).toBe(true);
  });

  it('a mesma corrida duas vezes da o mesmo estado', () => {
    const montar = (): GameState => {
      const { s, tiles } = rua(24);
      const us: Unidade[] = [];
      for (let i = 0; i < 4; i += 1) {
        us.push(civil(`d${i}`, tiles[3 - i] as Tile, 'indo_buscar', trecho(tiles, 3 - i, 23 - i)));
        us.push(civil(`e${i}`, tiles[20 + i] as Tile, 'indo_entregar', trecho(tiles, 20 + i, i)));
      }
      us.push(civil('o', tiles[12] as Tile, 'ocioso'), civil('x', tiles[8] as Tile, 'colhendo'));
      return correr(comUnidades(s, us), todosChegaram).s;
    };
    expect(salvar(montar())).toBe(salvar(montar()));
  });
});
