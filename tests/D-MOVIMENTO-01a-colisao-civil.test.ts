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
import { custoDeUnidadesNaRota, POSICAO_DO_ESTADO, sistemaDaPermuta, sistemaDaPorta, sistemaDoEmpurrao } from '../src/sim/colisao';
import { buscarCaminho, buscasComUnidades, tileAndavel, zerarEstatisticasDeBusca } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDaColisao } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

type Tile = { gx: number; gy: number };
const LIGADA: GameData = { ...gameData, movimento: { ...gameData.movimento, colisaoCivil: { ...gameData.movimento.colisaoCivil, ligada: true } } };
const C = LIGADA.movimento.colisaoCivil;
/** O modo desligado da chave, explicito: desde a I-MOVIMENTO-COLISAO-CIVIL-LIGADA o dado vem ligado. */
const DESLIGADA: GameData = { ...gameData, movimento: { ...gameData.movimento, colisaoCivil: { ...gameData.movimento.colisaoCivil, ligada: false } } };

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
/** Um tick: o empurrao, a permuta e depois o `andar` de cada um, na ordem, como no `step`. */
function tickDeMovimento(s: GameState, dados: GameData): GameState {
  let atual = sistemaDaPermuta(sistemaDoEmpurrao(s, dados), dados);
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
/** O ocupante `id` sai do mapa (terminou o trabalho e entrou num predio longe dali). */
const semUnidade = (x: GameState, id: string): GameState => ({ ...x, unidades: { porId: Object.fromEntries(Object.entries(x.unidades.porId).filter(([k]) => k !== id)), ordem: x.unidades.ordem.filter((k) => k !== id) } });
/** O maior numero de civis "fora" num tile so, neste estado. */
function maiorPorTile(x: GameState): number {
  const n = new Map<string, number>();
  for (const id of x.unidades.ordem) {
    const u = x.unidades.porId[id] as Unidade;
    if (POSICAO_DO_ESTADO[u.fsm] !== 'fora' || u.saindo !== undefined) continue;
    n.set(`${u.gx},${u.gy}`, (n.get(`${u.gx},${u.gy}`) ?? 0) + 1);
  }
  return Math.max(0, ...n.values());
}
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
  it('o dado: a chave vem LIGADA (I-MOVIMENTO-COLISAO-CIVIL-LIGADA), e as esperas sao as do KaM na escala do movimento', () => {
    expect(gameData.movimento.colisaoCivil.ligada).toBe(true);
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

  it('dois civis fora no mesmo tile e SEMPRE defeito: nao ha mais excecao de troca (D-MOVIMENTO-01j)', () => {
    const { s, tiles } = rua(6);
    const par = comUnidades(s, [civil('a', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 5)), civil('b', tiles[2] as Tile, 'indo_entregar', trecho(tiles, 2, 0))]);
    expect(violacoesDaColisao(par, LIGADA)).toEqual(['tile ' + `${(tiles[2] as Tile).gx},${(tiles[2] as Tile).gy}` + ': 2 civis empilhados (a:indo_buscar, b:indo_entregar)']);
    // quem espera a porta esta dentro: nao conta
    const saindo = comUnidades(s, [civil('a', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 5)), { ...civil('b', tiles[2] as Tile, 'indo_entregar'), saindo: 3 }]);
    expect(violacoesDaColisao(saindo, LIGADA)).toEqual([]);
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
      // de frente a permuta resolve o encontro ANTES do tempo de desvio: ninguem chega a
      // contornar. (Com a permuta, D-MOVIMENTO-01j, a maior espera medida foi 3 ticks, contra 1
      // da troca com dois no tile: a coluna que vem atras espera o da frente permutar.)
      expect(r.maiorEspera).toBeLessThan(C.ticksDesviar);
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

  it('um parado que nao se empurra no meio da rua de um tile: ninguem entra no tile dele; quando ele sai, o que espera passa', () => {
    const { s, tiles } = rua(8);
    let x = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 7)), civil('x', tiles[3] as Tile, 'colhendo')]);
    let maior = 0;
    const violacoes: string[] = [];
    for (let t = 0; t < 200 && !todosChegaram(x); t += 1) {
      if (t === 18) x = semUnidade(x, 'x'); // terminou o trabalho
      x = tickDeMovimento(x, LIGADA);
      maior = Math.max(maior, maiorPorTile(x));
      violacoes.push(...violacoesDaColisao(x, LIGADA));
    }
    expect(maior).toBe(1);
    expect(violacoes).toEqual([]);
    expect(em(x, 'w')).toEqual(tiles[7]);
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

  it('o destino ocupado por um parado: o que chega espera, nunca divide, e entra quando ele sai', () => {
    const { s, tiles } = rua(6);
    let x = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_entregar', trecho(tiles, 0, 5)), civil('x', tiles[5] as Tile, 'carregando')]);
    let maior = 0;
    for (let t = 0; t < 200 && !todosChegaram(x); t += 1) {
      if (t === 30) x = semUnidade(x, 'x');
      x = tickDeMovimento(x, LIGADA);
      maior = Math.max(maior, maiorPorTile(x));
      if (t < 30) expect(em(x, 'w')).not.toEqual(tiles[5]);
    }
    expect(maior).toBe(1);
    expect(em(x, 'w')).toEqual(tiles[5]);
  });

  it('um parado que NUNCA sai tranca a rua de uma faixa, e a invariante acusa a espera', () => {
    const { s, tiles } = rua(8);
    const s0 = comUnidades(s, [civil('w', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 7)), civil('x', tiles[3] as Tile, 'colhendo')]);
    // corre alem do prazo do "nao trava" (I-MOVIMENTO-COLISAO-CIVIL-LIGADA): so ai a invariante acusa
    const r = correr(s0, todosChegaram, LIGADA, C.ticksPrazoDeProgresso + 200);
    expect(todosChegaram(r.s)).toBe(false);
    expect(r.violacoes.some((v) => v.includes('w: bloqueado ha'))).toBe(true);
    expect(r.violacoes.some((v) => v.includes('empilhados'))).toBe(false);
  });

  it('permuta de frente: os dois trocam de tile no MESMO tick, e nunca ha dois num tile', () => {
    const { s, tiles } = rua(11);
    let x = comUnidades(s, [civil('a', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 10)), civil('b', tiles[10] as Tile, 'indo_buscar', trecho(tiles, 10, 0))]);
    let permutaram = false;
    for (let t = 0; t < 400 && !todosChegaram(x); t += 1) {
      const antes = [em(x, 'a'), em(x, 'b')];
      x = tickDeMovimento(x, LIGADA);
      expect(maiorPorTile(x)).toBe(1);
      permutaram ||= antes[0]?.gx === em(x, 'b').gx && antes[1]?.gx === em(x, 'a').gx;
    }
    expect(permutaram).toBe(true);
    expect([em(x, 'a'), em(x, 'b')]).toEqual([tiles[10], tiles[0]]);
  });

  it('permuta forcada: preso atras de quem tambem esta preso, no teto os dois trocam de lugar, e o outro volta um passo', () => {
    const { s, tiles } = rua(8);
    // `b` quer passar por `z` (parado para sempre); `a` vem atras de `b`
    let x = comUnidades(s, [civil('a', tiles[1] as Tile, 'indo_buscar', trecho(tiles, 1, 7)), civil('b', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 7)), civil('z', tiles[3] as Tile, 'colhendo')]);
    let t = 0;
    for (; t < 100 && em(x, 'a').gx === (tiles[1] as Tile).gx; t += 1) {
      x = tickDeMovimento(x, LIGADA);
      expect(maiorPorTile(x)).toBe(1);
    }
    expect([em(x, 'a'), em(x, 'b')]).toEqual([tiles[2], tiles[1]]);
    expect(x.unidades.porId['b']?.fsmData.caminho?.[0]).toEqual(tiles[2]);
    // o passo de `a` vence no 5o tick, e a espera conta dali ate o teto
    expect(t).toBeLessThanOrEqual(LIGADA.movimento.ticksPorTile.aPe.estrada + C.ticksTrocaForcada);
  });

  // I-MOVIMENTO-COLISAO-CIVIL-LIGADA, aceite (c): a permuta de frente nao adianta ninguem. O
  // defeito medido em 2026-09-29: dois de frente em 20 tiles chegavam em 95 ticks, contra 100
  // sozinho (o passo da permuta somava o tick do `andar` e entregava o caminho um passo antes).
  it('a permuta de frente leva o mesmo tempo que andar sozinho: 20 tiles, 100 ticks nos dois', () => {
    const { s, tiles } = rua(21);
    const passo = LIGADA.movimento.ticksPorTile.aPe.estrada;
    const ticksAte = (us: Unidade[]): Record<string, number> => {
      let x = comUnidades(s, us);
      const chegou: Record<string, number> = {};
      for (let t = 1; t <= 400 && Object.keys(chegou).length < us.length; t += 1) {
        x = tickDeMovimento(x, LIGADA);
        expect(maiorPorTile(x)).toBeLessThanOrEqual(1);
        for (const u of us) if (chegou[u.id] === undefined && (x.unidades.porId[u.id]?.fsmData.caminho ?? []).length === 0) chegou[u.id] = t;
      }
      return chegou;
    };
    const sozinho = ticksAte([civil('a', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 20))]);
    const deFrente = ticksAte([civil('a', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 20)), civil('b', tiles[20] as Tile, 'indo_buscar', trecho(tiles, 20, 0))]);
    gravarEvidencia('I-MOVIMENTO-COLISAO-CIVIL-LIGADA-permuta', { passo, sozinho, deFrente });
    expect(sozinho).toEqual({ a: 20 * passo });
    expect(deFrente).toEqual({ a: 20 * passo, b: 20 * passo });
  });

  it('desligada, o mesmo encontro de frente se atravessa, sem campo novo', () => {
    // distancia par: os dois chegam ao tile do meio no mesmo tick
    const { s, tiles } = rua(11);
    const s0 = comUnidades(s, [civil('a', tiles[0] as Tile, 'indo_buscar', trecho(tiles, 0, 10)), civil('b', tiles[10] as Tile, 'indo_buscar', trecho(tiles, 10, 0))]);
    let x = s0;
    let empilhou = false;
    for (let t = 0; t < 400 && !todosChegaram(x); t += 1) {
      x = tickDeMovimento(x, DESLIGADA);
      empilhou ||= em(x, 'a').gx === em(x, 'b').gx;
      expect(salvar(x, DESLIGADA)).not.toMatch(/bloqueado|saindo/);
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

    it('a espera da porta nao tem saida forcada: no teto ela ganha a prioridade, e sai quando o ocupante sai', () => {
      const { s, tiles } = rua(8);
      const antes = comUnidades(s, [civil('e', tiles[3] as Tile, 'trabalhando'), civil('x', tiles[3] as Tile, 'colhendo'), civil('n', tiles[4] as Tile, 'indo_buscar')]);
      let x = sistemaDaPorta(antes, comUnidade(antes, { ...(antes.unidades.porId['e'] as Unidade), fsm: 'indo_colher', fsmData: { caminho: trecho(tiles, 3, 7), progresso: 0 } }), LIGADA);
      for (let t = 0; t < 25; t += 1) {
        x = sistemaDaPorta(x, tickDeMovimento(x, LIGADA), LIGADA);
        expect(maiorPorTile(x)).toBe(1);
      }
      expect(x.unidades.porId['e']?.saindo).toBe(25);
      // o ocupante sai; `n` quer justamente aquele tile, mas `e` passou do teto: `n` cede
      x = semUnidade(x, 'x');
      x = comUnidade(x, { ...(x.unidades.porId['n'] as Unidade), fsmData: { caminho: trecho(tiles, 4, 0), progresso: 4 } });
      x = sistemaDaPorta(x, tickDeMovimento(x, LIGADA), LIGADA);
      expect(x.unidades.porId['e']?.saindo).toBeUndefined();
      expect(em(x, 'n')).toEqual(tiles[4]);
      expect(violacoesDaColisao(x, LIGADA)).toEqual([]);
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
  describe('D-MOVIMENTO-01g — prioridade de quem espera, e o ocioso sem vizinho livre', () => {
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
      // em angulo, para que depois de um entrar os dois nao fiquem de frente
      const { s: s0, c } = campo();
      const T = { gx: c.gx, gy: c.gy };
      const pronto = (id: string, de: Tile, depois: Tile): Unidade => ({ ...civil(id, de, 'indo_buscar'), fsmData: { caminho: [T, depois], progresso: 20, bloqueado: C.ticksTrocaForcada } });
      const a = pronto('a', { gx: c.gx - 1, gy: c.gy }, { gx: c.gx + 1, gy: c.gy });
      const b = pronto('b', { gx: c.gx, gy: c.gy - 1 }, { gx: c.gx, gy: c.gy + 1 });
      const x = tickDeMovimento(comUnidades(s0, [b, a]), LIGADA);
      expect([em(x, 'b'), em(x, 'a')]).toEqual([T, { gx: c.gx - 1, gy: c.gy }]);
      expect(maiorPorTile(x)).toBe(1);
    });

    it('entre dois acima do teto, anda um: o que espera ha mais tempo', () => {
      const { s: s0, tiles } = rua(7);
      const T = tiles[3] as Tile;
      const a: Unidade = { ...civil('a', tiles[2] as Tile, 'indo_buscar', trecho(tiles, 2, 6)), fsmData: { caminho: trecho(tiles, 2, 6), progresso: 4, bloqueado: C.ticksTrocaForcada } };
      const b: Unidade = { ...civil('b', tiles[4] as Tile, 'indo_buscar', trecho(tiles, 4, 0)), fsmData: { caminho: trecho(tiles, 4, 0), progresso: 4, bloqueado: C.ticksTrocaForcada + 3 } };
      const x = tickDeMovimento(comUnidades(s0, [a, b]), LIGADA);
      expect([em(x, 'a'), em(x, 'b')]).toEqual([tiles[2], T]);
    });

    it('o ocioso empilhado sem vizinho livre vai ao tile livre mais perto', () => {
      const { s: s0, c } = campo();
      // o ocioso `o` no centro, empilhado com `h`, e cercado por oito parados que nao se empurram
      const centro = { gx: c.gx, gy: c.gy };
      const cerco = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(([dx, dy], k) => civil(`c${k}`, { gx: c.gx + (dx as number), gy: c.gy + (dy as number) }, 'colhendo'));
      const x = tickDeMovimento(comUnidades(s0, [civil('h', centro, 'colhendo'), ...cerco, civil('o', centro, 'ocioso')]), LIGADA);
      const ondeO = em(x, 'o');
      expect(Math.max(Math.abs(ondeO.gx - c.gx), Math.abs(ondeO.gy - c.gy))).toBe(2);
      expect(violacoesDaColisao(x, LIGADA)).toEqual([]);
    });

    it('o prazo do "nao trava" vem do dado, e cobre mais que a troca forcada (I-MOVIMENTO-COLISAO-CIVIL-LIGADA)', () => {
      expect(C.ticksPrazoDeProgresso).toBeGreaterThan(C.ticksTrocaForcada);
    });
  });

  // ---------- D-MOVIMENTO-01h: a escolha de rota (o custo de unidade do KaM) ----------
  describe('D-MOVIMENTO-01h — a rota planejada ve os outros civis como custo', () => {
    /** Duas faixas de estrada paralelas, de mesmo comprimento, ligadas nas duas pontas. */
    function duasFaixas(): { s: GameState; cima: Tile[]; baixo: Tile[] } {
      const { s: s0, c } = campo();
      const cima = Array.from({ length: 11 }, (_, i) => ({ gx: c.gx - 5 + i, gy: c.gy }));
      const baixo = Array.from({ length: 11 }, (_, i) => ({ gx: c.gx - 5 + i, gy: c.gy + 2 }));
      const pontas = [{ gx: c.gx - 5, gy: c.gy + 1 }, { gx: c.gx + 5, gy: c.gy + 1 }];
      const estradas = Object.fromEntries([...cima, ...baixo, ...pontas].map((t) => [`${t.gx},${t.gy}`, true as const]));
      return { s: { ...s0, estradas: { ...s0.estradas, ...estradas } }, cima, baixo };
    }

    it('desligada: nenhum custo, e a busca segue no cache', () => {
      const { s: s0, cima } = duasFaixas();
      const x = comUnidades(s0, [civil('a', cima[3] as Tile, 'indo_buscar', [cima[4] as Tile])]);
      expect(custoDeUnidadesNaRota(x, 'w', 'estrada', DESLIGADA)).toBeUndefined();
    });

    it('ligada: com a faixa de cima cheia, a rota por estrada vai pela de baixo; vazia, vai pela de cima', () => {
      const { s: s0, cima, baixo } = duasFaixas();
      const de = cima[0] as Tile;
      const para = [cima[10] as Tile];
      const vazia = buscarCaminho(s0, de, para, 'estrada', LIGADA, custoDeUnidadesNaRota(s0, 'w', 'estrada', LIGADA));
      expect(vazia?.tiles.every((t) => t.gy === de.gy)).toBe(true);
      // tres civis ANDANDO na faixa de cima: por estrada, quem anda tambem pesa (como no KaM)
      const cheia = comUnidades(s0, [3, 5, 7].map((k) => civil(`a${k}`, cima[k] as Tile, 'indo_buscar', [cima[k + 1] as Tile])));
      zerarEstatisticasDeBusca();
      const desvia = buscarCaminho(cheia, de, para, 'estrada', LIGADA, custoDeUnidadesNaRota(cheia, 'w', 'estrada', LIGADA));
      expect(desvia?.tiles.some((t) => t.gy === (baixo[0] as Tile).gy)).toBe(true);
      expect(buscasComUnidades()).toBe(1);
      // a pe (`livre`), quem anda NAO pesa: so quem esta parado
      expect(custoDeUnidadesNaRota(cheia, 'w', 'livre', LIGADA)?.size).toBe(0);
    });

    it('o custo por unidade vem do dado: 1,5 tile vezes o passo a pe na estrada', () => {
      expect(C.ticksPorUnidadeNaRota).toBe(Math.round(1.5 * LIGADA.movimento.ticksPorTile.aPe.estrada));
    });
  });
});
