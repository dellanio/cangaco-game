/**
 * D-MOVIMENTO-01a — o mecanismo da colisao civil, atras da chave `units.json colisaoCivil.ligada`
 * (plano em docs/planos/2026-09-28-D1-colisao-civil.md, secao 6). O mecanismo e o do WalkTo do
 * kam_remake: troca de frente, empurrao do ocioso, desvio e troca forcada.
 *
 * Os cenarios de mecanismo andam com um laco de movimento proprio (o empurrao e o `andar`
 * da sim, as mesmas funcoes que o `step` chama) para isolar o passo das FSMs: a vila inteira
 * com a chave ligada e o D-MOVIMENTO-01b (ligar e medir) e o D-MOVIMENTO-01e (aceite da colisao civil).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { andar, comUnidade } from '../src/sim/units/movimento';
import { POSICAO_DO_ESTADO, sistemaDaPorta, sistemaDoEmpurrao, tetoDaEspera } from '../src/sim/colisao';
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

describe('D-MOVIMENTO-01a — a colisao civil', () => {
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
      gravarEvidencia(`D-MOVIMENTO-01a-rua-${n}`, { serfs: n, ticks: r.ticks, maiorEspera: r.maiorEspera });
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
    expect(r.s.unidades.porId['w']?.trocaCom).toBe('x');
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
      expect(salvar(x)).not.toMatch(/bloqueado|trocaCom|saindo/);
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

  // ---------- D-MOVIMENTO-01c: o empilhamento de fora do passo ----------
  describe('D-MOVIMENTO-01c — o empilhamento que nasce fora do passo', () => {
    it('dois ociosos empilhados: o segundo e empurrado no tick seguinte, e a invariante fica limpa', () => {
      const { s, tiles } = rua(6);
      const s0 = comUnidades(s, [civil('a', tiles[2] as Tile, 'ocioso'), civil('b', tiles[2] as Tile, 'ocioso'), civil('c', tiles[2] as Tile, 'ocioso')]);
      expect(violacoesDaColisao(s0, LIGADA)).toHaveLength(1);
      const s1 = tickDeMovimento(s0, LIGADA);
      expect(violacoesDaColisao(s1, LIGADA)).toEqual([]);
      expect(em(s1, 'a')).toEqual(tiles[2]); // fica o primeiro
      expect(em(s1, 'b')).not.toEqual(em(s1, 'c'));
    });

    it('fica no tile quem nao e ocioso, e o ocioso sai', () => {
      const { s, tiles } = rua(6);
      const s1 = tickDeMovimento(comUnidades(s, [civil('o', tiles[2] as Tile, 'ocioso'), civil('x', tiles[2] as Tile, 'colhendo')]), LIGADA);
      expect(em(s1, 'x')).toEqual(tiles[2]);
      expect(em(s1, 'o')).not.toEqual(tiles[2]);
    });

    it('o trocaCom sobrevive a troca de estado da FSM', () => {
      const { s, tiles } = rua(6);
      const r = correr(comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_entregar', trecho(tiles, 0, 5)), civil('x', tiles[5] as Tile, 'colhendo')]), todosChegaram);
      const w = r.s.unidades.porId['w'] as Unidade;
      const depois = comUnidade(r.s, { ...w, fsm: 'entregando', fsmData: {} }); // a FSM reescreve o fsmData
      expect(depois.unidades.porId['w']?.trocaCom).toBe('x');
      expect(violacoesDaColisao(depois, LIGADA)).toEqual([]);
    });

    it('quem sai de dentro para a porta ocupada espera ela vagar, sem ocupar nem andar, e depois sai', () => {
      const { s, tiles } = rua(8);
      const antes = comUnidades(s, [civil('e', tiles[3] as Tile, 'trabalhando'), civil('x', tiles[3] as Tile, 'colhendo')]);
      const saiu = comUnidade(antes, { ...(antes.unidades.porId['e'] as Unidade), fsm: 'indo_colher', fsmData: { caminho: trecho(tiles, 3, 7), progresso: 0 } });
      let x = sistemaDaPorta(antes, saiu, LIGADA);
      expect(x.unidades.porId['e']?.saindo).toBe(0);
      expect(violacoesDaColisao(x, LIGADA)).toEqual([]);
      for (let t = 0; t < 5; t += 1) x = sistemaDaPorta(x, tickDeMovimento(x, LIGADA), LIGADA);
      expect(em(x, 'e')).toEqual(tiles[3]); // nao andou
      expect(x.unidades.porId['e']?.saindo).toBe(5);
      // o ocupante vai embora: no tick seguinte a porta libera, e ai ele anda
      x = comUnidade(x, { ...(x.unidades.porId['x'] as Unidade), gx: (tiles[0] as Tile).gx });
      x = sistemaDaPorta(x, tickDeMovimento(x, LIGADA), LIGADA);
      expect(x.unidades.porId['e']?.saindo).toBeUndefined();
      const r = correr(x, todosChegaram);
      expect(em(r.s, 'e')).toEqual(tiles[7]);
      expect(r.violacoes).toEqual([]);
    });

    it('a espera da porta tem o teto da troca forcada: passado ele, sai em troca com o ocupante', () => {
      const { s, tiles } = rua(8);
      const antes = comUnidades(s, [civil('e', tiles[3] as Tile, 'trabalhando'), civil('x', tiles[3] as Tile, 'colhendo')]);
      let x = sistemaDaPorta(antes, comUnidade(antes, { ...(antes.unidades.porId['e'] as Unidade), fsm: 'indo_colher', fsmData: { caminho: trecho(tiles, 3, 7), progresso: 0 } }), LIGADA);
      const violacoes: string[] = [];
      let maior = 0;
      for (let t = 0; t < 200 && !todosChegaram(x); t += 1) {
        x = sistemaDaPorta(x, tickDeMovimento(x, LIGADA), LIGADA);
        maior = Math.max(maior, x.unidades.porId['e']?.saindo ?? 0);
        violacoes.push(...violacoesDaColisao(x, LIGADA));
      }
      expect(violacoes).toEqual([]);
      expect(maior).toBe(C.ticksTrocaForcada - 1);
      expect(em(x, 'e')).toEqual(tiles[7]);
    });

    it('quem nasce numa porta ocupada tambem espera; e a porta livre nao marca ninguem', () => {
      const { s, tiles } = rua(6);
      const antes = comUnidades(s, [civil('x', tiles[2] as Tile, 'colhendo')]);
      const depois = comUnidades(s, [civil('x', tiles[2] as Tile, 'colhendo'), civil('novo', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 5)), civil('livre', tiles[4] as Tile, 'indo_buscar', trecho(tiles, 4, 5))]);
      const x = sistemaDaPorta(antes, depois, LIGADA);
      expect(x.unidades.porId['novo']?.saindo).toBe(0);
      expect(x.unidades.porId['livre']?.saindo).toBeUndefined();
    });

    it('o ocioso que sai de dentro para a porta ocupada nao tem o que esperar: e empurrado', () => {
      const { s, tiles } = rua(6);
      const antes = comUnidades(s, [civil('l', tiles[2] as Tile, 'martelando'), civil('x', tiles[2] as Tile, 'colhendo')]);
      const x = sistemaDaPorta(antes, comUnidade(antes, { ...(antes.unidades.porId['l'] as Unidade), fsm: 'ocioso' }), LIGADA);
      expect(x.unidades.porId['l']?.saindo).toBe(0);
      const y = tickDeMovimento(x, LIGADA);
      expect(em(y, 'l')).not.toEqual(tiles[2]);
      expect(y.unidades.porId['l']?.saindo).toBeUndefined();
    });
  });

  // ---------- D-MOVIMENTO-01g: a troca e de duas unidades; prioridade de quem espera ----------
  describe('D-MOVIMENTO-01g — os dois empilhamentos residuais', () => {
    const civisEm = (x: GameState, t: Tile): number => x.unidades.ordem.filter((id) => {
      const u = x.unidades.porId[id] as Unidade;
      return u.gx === t.gx && u.gy === t.gy && POSICAO_DO_ESTADO[u.fsm] === 'fora' && u.saindo === undefined;
    }).length;

    it('ninguem entra num tile com um par: nunca tres civis num tile, e quem espera entra quando o par se desfaz', () => {
      const { s: s0, tiles } = rua(10);
      const T = tiles[4] as Tile;
      // o par: `x` parado (colhendo) e `y`, que entrou em troca com ele e esta PRESO atras de
      // `z` (parado adiante), entao o par dura ate a troca forcada de `y`. `w` chega ao teto
      // com o par ainda no tile: e ali que entrar faria tres.
      const y: Unidade = { ...civil('y', T, 'indo_buscar', trecho(tiles, 4, 9)), trocaCom: 'x' };
      const x0 = comUnidades(s0, [civil('y0', tiles[0] as Tile, 'ocioso'), civil('w', tiles[3] as Tile, 'indo_buscar', trecho(tiles, 3, 9)), civil('x', T, 'colhendo'), y, civil('z', tiles[5] as Tile, 'colhendo')]);
      let x = x0;
      let maior = 0;
      const violacoes: string[] = [];
      for (let t = 0; t < 200 && em(x, 'w').gx !== (tiles[9] as Tile).gx; t += 1) {
        x = tickDeMovimento(x, LIGADA);
        maior = Math.max(maior, civisEm(x, T));
        violacoes.push(...violacoesDaColisao(x, LIGADA));
      }
      expect(maior).toBe(2);
      expect(violacoes).toEqual([]);
      expect(em(x, 'w')).toEqual(tiles[9]);
    });

    it('quem passou da troca forcada tem prioridade: o recem-chegado cede o tile vazio a ele', () => {
      const { s: s0, tiles } = rua(7);
      const T = tiles[3] as Tile;
      const custo = 5; // o passo na estrada, nesta escala (conferido abaixo)
      const w: Unidade = { ...civil('w', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 6)), fsmData: { caminho: trecho(tiles, 2, 6), progresso: custo - 2, bloqueado: C.ticksTrocaForcada } };
      const n: Unidade = { ...civil('n', tiles[4] as Tile, 'indo_buscar', trecho(tiles, 4, 0)), fsmData: { caminho: trecho(tiles, 4, 0), progresso: custo - 1 } };
      expect(LIGADA.movimento.ticksPorTile.aPe.estrada).toBe(custo);
      let x = comUnidades(s0, [n, w]); // `n` vem ANTES na ordem: sem a prioridade, entraria primeiro
      x = tickDeMovimento(x, LIGADA);
      expect(em(x, 'n')).toEqual(tiles[4]); // cedeu
      x = tickDeMovimento(x, LIGADA);
      expect(em(x, 'w')).toEqual(T);
    });

    it('entre dois acima do teto com a MESMA espera, anda um: o primeiro na ordem', () => {
      // em angulo, para que depois de um entrar os dois nao fiquem de frente (ai seria troca)
      const { s: s0, c } = campo();
      const T = { gx: c.gx, gy: c.gy };
      const pronto = (id: string, de: Tile, depois: Tile): Unidade => ({ ...civil(id, de, 'indo_buscar'), fsmData: { caminho: [T, depois], progresso: 20, bloqueado: C.ticksTrocaForcada } });
      const a = pronto('a', { gx: c.gx - 1, gy: c.gy }, { gx: c.gx + 1, gy: c.gy });
      const b = pronto('b', { gx: c.gx, gy: c.gy - 1 }, { gx: c.gx, gy: c.gy + 1 });
      const x = tickDeMovimento(comUnidades(s0, [b, a]), LIGADA);
      // `b` (primeiro na ordem) entra no tile vazio; `a`, tambem acima do teto, entra depois pela
      // troca forcada com o UNICO ocupante: um par ligado, nunca dois cedendo para sempre
      expect([em(x, 'b'), x.unidades.porId['b']?.trocaCom]).toEqual([T, undefined]);
      expect([em(x, 'a'), x.unidades.porId['a']?.trocaCom]).toEqual([T, 'b']);
    });

    it('entre dois acima do teto, anda um: o que espera ha mais tempo', () => {
      const { s: s0, tiles } = rua(7);
      const T = tiles[3] as Tile;
      const a: Unidade = { ...civil('a', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 6)), fsmData: { caminho: trecho(tiles, 2, 6), progresso: 4, bloqueado: C.ticksTrocaForcada } };
      const b: Unidade = { ...civil('b', tiles[4] as Tile, 'indo_buscar', trecho(tiles, 4, 0)), fsmData: { caminho: trecho(tiles, 4, 0), progresso: 4, bloqueado: C.ticksTrocaForcada + 3 } };
      const x = tickDeMovimento(comUnidades(s0, [a, b]), LIGADA);
      expect([em(x, 'a'), em(x, 'b')]).toEqual([tiles[2], T]);
    });

    it('o ocioso em troca tambem e empurrado, e sem vizinho livre vai ao tile livre mais perto', () => {
      const { s: s0, c } = campo();
      // o ocioso `o` no centro, cercado por oito parados que nao se empurram, com um `trocaCom`
      const centro = { gx: c.gx, gy: c.gy };
      const cerco = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(([dx, dy], k) => civil(`c${k}`, { gx: c.gx + (dx as number), gy: c.gy + (dy as number) }, 'colhendo'));
      const o: Unidade = { ...civil('o', centro, 'ocioso'), trocaCom: 'h' };
      const x = tickDeMovimento(comUnidades(s0, [civil('h', centro, 'colhendo'), ...cerco, o]), LIGADA);
      const ondeO = em(x, 'o');
      expect(Math.max(Math.abs(ondeO.gx - c.gx), Math.abs(ondeO.gy - c.gy))).toBe(2);
      expect(x.unidades.porId['o']?.trocaCom).toBeUndefined();
      expect(violacoesDaColisao(x, LIGADA)).toEqual([]);
    });

    it('o teto da invariante e a troca forcada mais o maior passo do dado', () => {
      expect(tetoDaEspera(LIGADA)).toBe(C.ticksTrocaForcada + Math.max(...Object.values(LIGADA.movimento.ticksPorTileDiagonal.aPe)));
    });
  });
});
