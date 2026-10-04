/**
 * H-TELA-AMBIENTE-E-MUSICA — o sertao de fundo (a metade headless).
 *
 * (a) a regra pura "estado -> faixa de musica" por tabela: paz, combate perto, combate longe, fim
 *     de partida (e o combate que dura depois da luta);
 * (b) a troca nao corta no meio: a passagem tem duracao no dado, e nenhum passo pula mais que a
 *     fracao do tempo que passou;
 * e o fundo inteiro: o ambiente ligado em jogo, o sino da Bodega na vista e o silencio sem arquivo.
 * O (c) (o contador do ambiente anda no jogo e nao existe no menu) e o roteiro
 * `tools/shots/H-TELA-AMBIENTE-E-MUSICA.js`.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { criarEscaramuca } from '../src/sim/cenario';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import {
  SILENCIO, bodegaNaVista, criarFundoSonoro, faixaDaMusica, houveLutaPertoDaVila, misturar,
} from '../src/render/fundo-sonoro';
import type { DadosDoFundo, Niveis } from '../src/render/fundo-sonoro';
import { validarSom } from '../tools/data-rules.js';
import { EVENTOS_DA_SIM } from '../src/render/eventos-da-sim';
import tabelaJson from '../data/som.json';
import { gravarEvidencia } from './helpers/evidence';

const DADOS = tabelaJson as DadosDoFundo;
const RAIO = DADOS.musica.raioDoCombateTiles;
const TICK_MS = gameData.tempo.tickMs;
const TICKS_DE_COMBATE = Math.round((DADOS.musica.segundosDeCombateDepoisDaLuta * 1000) / TICK_MS);
const SEMENTE = gameData.economia.estadoInicial.semente;
const evidencia: Record<string, unknown> = {};

const esc = criarEscaramuca(SEMENTE);
const meuPredio = esc.predios.porId[esc.predios.ordem.find((id) => esc.predios.porId[id]?.lado === LADO_DO_JOGADOR) as string]!;
const predioDaIA = esc.predios.porId[esc.predios.ordem.find((id) => esc.predios.porId[id]?.lado === LADO_DA_IA) as string]!;

function comEventos(s: GameState, events: GameEvent[], tick = s.tick): GameState {
  return { ...s, tick, events };
}
const tiro = (gx: number, gy: number): GameEvent => ({ type: 'projectile-fired', projetil: 'virote', de: 'u1', alvo: { gx, gy }, voo: 3 });

describe('H-TELA-AMBIENTE-E-MUSICA — (a) a faixa pelo estado', () => {
  it('a premissa: a vila da IA esta longe da do jogador (mais que o raio)', () => {
    expect(Math.max(Math.abs(predioDaIA.gx - meuPredio.gx), Math.abs(predioDaIA.gy - meuPredio.gy))).toBeGreaterThan(RAIO);
  });

  it('por tabela: paz, combate perto, combate longe, o combate que dura, e o fim da partida', () => {
    const perto = comEventos(esc, [tiro(meuPredio.gx + 2, meuPredio.gy)], 100);
    const longe = comEventos(esc, [tiro(predioDaIA.gx, predioDaIA.gy)], 100);
    const casos: [string, GameState, number | null, string | null][] = [
      ['paz: nenhuma luta', comEventos(esc, [], 100), null, 'paz'],
      ['combate perto: luta neste tick a 2 tiles de um predio do jogador', perto, houveLutaPertoDaVila(perto, null, RAIO) ? 100 : null, 'combate'],
      ['combate longe: luta na vila da IA', longe, houveLutaPertoDaVila(longe, null, RAIO) ? 100 : null, 'paz'],
      ['o combate dura depois da luta, ate o fim da espera', comEventos(esc, [], 100 + TICKS_DE_COMBATE), 100, 'combate'],
      ['passada a espera, volta a paz', comEventos(esc, [], 101 + TICKS_DE_COMBATE), 100, 'paz'],
      ['fim de partida: nenhuma, mesmo com luta perto', { ...comEventos(esc, [], 100), partida: { fim: 'vitoria', tick: 100 } }, 100, null],
      ['fim de partida na derrota tambem', { ...comEventos(esc, [], 100), partida: { fim: 'derrota', tick: 99 } }, null, null],
    ];
    for (const [nome, estado, ultima, esperado] of casos) expect(faixaDaMusica(estado, ultima, TICKS_DE_COMBATE), nome).toBe(esperado);
    evidencia['faixa'] = casos.map(([nome, , , f]) => `${nome} -> ${f ?? 'nenhuma'}`);
  });

  it('a luta perto vem de golpe, ataque a predio, tiro e pedra; a unidade morta no tick, do estado anterior', () => {
    const minha = esc.unidades.porId[esc.unidades.ordem.find((id) => esc.unidades.porId[id]?.lado === LADO_DO_JOGADOR) as string]!;
    expect(houveLutaPertoDaVila(comEventos(esc, [{ type: 'unit-struck', atacante: 'x', alvo: minha.id, acertou: true, hp: 2 }]), null, RAIO)).toBe(true);
    expect(houveLutaPertoDaVila(comEventos(esc, [{ type: 'building-attacked', predio: meuPredio.id, unidade: 'x', dano: 2, hp: 5 }]), null, RAIO)).toBe(true);
    expect(houveLutaPertoDaVila(comEventos(esc, [{ type: 'stone-thrown', predio: 'p', alvo: { gx: meuPredio.gx, gy: meuPredio.gy + 3 }, vitima: 'x' }]), null, RAIO)).toBe(true);
    expect(houveLutaPertoDaVila(comEventos(esc, [{ type: 'goods-produced', predio: meuPredio.id, mercadoria: 'stone', quantidade: 1 }]), null, RAIO)).toBe(false);
    const semMinha: GameState = { ...esc, unidades: { porId: { ...esc.unidades.porId }, ordem: esc.unidades.ordem.filter((id) => id !== minha.id) } };
    delete (semMinha.unidades.porId as Record<string, unknown>)[minha.id];
    const golpe: GameEvent = { type: 'unit-struck', atacante: 'x', alvo: minha.id, acertou: true, hp: 0 };
    expect(houveLutaPertoDaVila(comEventos(semMinha, [golpe]), null, RAIO)).toBe(false);
    expect(houveLutaPertoDaVila(comEventos(semMinha, [golpe]), esc, RAIO)).toBe(true);
  });
});

describe('H-TELA-AMBIENTE-E-MUSICA — (b) a troca nao corta', () => {
  const DURACAO = DADOS.musica.transicaoSegundos * 1000;

  it('a duracao esta no dado, e e maior que zero (o validate:data recusa zero)', () => {
    expect(DURACAO).toBeGreaterThan(0);
    const erros: string[] = [];
    validarSom({ ...tabelaJson, musica: { ...tabelaJson.musica, transicaoSegundos: 0 } }, erros, { eventosDaSim: EVENTOS_DA_SIM, manifesto: { assets: [] } });
    expect(erros).toEqual(['interface/som: musica.transicaoSegundos precisa ser > 0: a troca de faixa nao corta']);
  });

  it('da paz para o combate: a meio caminho as duas a meio volume; no fim, so o combate', () => {
    const paz: Niveis = { paz: 1, combate: 0 };
    expect(misturar(paz, 'combate', 0, DURACAO)).toEqual(paz);
    const meio = misturar(paz, 'combate', DURACAO / 2, DURACAO);
    expect(meio.paz).toBeCloseTo(0.5, 10);
    expect(meio.combate).toBeCloseTo(0.5, 10);
    expect(misturar(meio, 'combate', DURACAO / 2, DURACAO)).toEqual({ paz: 0, combate: 1 });
    expect(misturar({ paz: 0, combate: 1 }, 'combate', DURACAO * 5, DURACAO)).toEqual({ paz: 0, combate: 1 });
  });

  it('em quadros de 16 ms, nenhum passo pula mais que 16/duracao, e a troca leva a duracao inteira', () => {
    let n: Niveis = { paz: 1, combate: 0 };
    let quadros = 0;
    let maiorPulo = 0;
    while (n.combate < 1 && quadros < 10_000) {
      const prox = misturar(n, 'combate', 16, DURACAO);
      maiorPulo = Math.max(maiorPulo, Math.abs(prox.paz - n.paz), Math.abs(prox.combate - n.combate));
      n = prox;
      quadros += 1;
    }
    expect(maiorPulo).toBeLessThanOrEqual(16 / DURACAO + 1e-12);
    expect(quadros).toBe(Math.ceil(DURACAO / 16));
    evidencia['passagem'] = { duracaoMs: DURACAO, quadrosDe16ms: quadros, maiorPulo };
  });

  it('o fim da partida desce a musica em passagem, sem corte', () => {
    const meio = misturar({ paz: 1, combate: 0 }, null, DURACAO / 2, DURACAO);
    expect(meio.paz).toBeCloseTo(0.5, 10);
    expect(misturar(meio, null, DURACAO, DURACAO)).toEqual(SILENCIO);
  });
});

describe('H-TELA-AMBIENTE-E-MUSICA — o fundo inteiro', () => {
  function fundo(disponiveis: string[]) {
    const chamadas: string[] = [];
    const pedidos: string[] = [];
    const f = criarFundoSonoro({
      dados: DADOS, disponiveis: new Set(disponiveis), volume: () => 0.5, tickMs: TICK_MS,
      tocador: { tocar: (id, v) => chamadas.push(`tocar ${id} ${v.toFixed(2)}`), parar: (id) => chamadas.push(`parar ${id}`) },
      pedir: (id) => pedidos.push(id),
    });
    return { f, chamadas, pedidos };
  }

  it('sem arquivo nenhum: o ambiente fica ligado no contador e o tocador nunca e chamado', () => {
    const { f, chamadas } = fundo([]);
    for (let i = 0; i < 5; i += 1) f.quadro(i * 16, esc, null);
    expect(chamadas).toEqual([]);
    expect(f.contadores()).toMatchObject({ ambienteLigado: DADOS.ambiente.lacos, quadrosComAmbiente: 5, faixa: 'paz' });
  });

  it('com arquivo: o laco toca no volume do canal, e a musica sobe em passagem', () => {
    const { f, chamadas } = fundo(['ambient-wind', 'music-peace']);
    f.quadro(0, esc, null);
    expect(chamadas).toEqual(['tocar ambient-wind 0.50']);
    f.quadro(DADOS.musica.transicaoSegundos * 500, esc, null);
    expect(chamadas.slice(1)).toEqual(['tocar ambient-wind 0.50', 'tocar music-peace 0.25']);
  });

  it('o sino: a Bodega do jogador na vista pede o sino, de novo so depois do intervalo; fora da vista, nao', () => {
    expect(gameData.predios.some((p) => p.id === DADOS.ambiente.sino.predio)).toBe(true);
    const bodega = { ...meuPredio, id: 'bodega-x', tipo: DADOS.ambiente.sino.predio };
    const comBodega: GameState = { ...esc, predios: { porId: { ...esc.predios.porId, [bodega.id]: bodega }, ordem: [...esc.predios.ordem, bodega.id] } };
    const naVista = { x0: bodega.gx - 5, y0: bodega.gy - 5, x1: bodega.gx + 5, y1: bodega.gy + 5 };
    const longe = { x0: bodega.gx + 50, y0: bodega.gy + 50, x1: bodega.gx + 60, y1: bodega.gy + 60 };
    expect(bodegaNaVista(comBodega, DADOS.ambiente.sino.predio, naVista)).toBe(true);
    expect(bodegaNaVista(comBodega, DADOS.ambiente.sino.predio, longe)).toBe(false);
    expect(bodegaNaVista(esc, DADOS.ambiente.sino.predio, naVista)).toBe(false);
    const { f, pedidos } = fundo([]);
    const intervalo = DADOS.ambiente.sino.intervaloSegundos * 1000;
    f.quadro(0, comBodega, naVista);
    f.quadro(intervalo - 1, comBodega, naVista);
    f.quadro(intervalo, comBodega, naVista);
    f.quadro(intervalo + 10, comBodega, longe);
    f.quadro(intervalo + 20, comBodega, naVista);
    expect(pedidos).toEqual(['inn-bell', 'inn-bell', 'inn-bell']);
  });

  it('a luta perto vira combate pelo aoPasso, e volta a paz depois da espera', () => {
    const { f } = fundo([]);
    const luta = comEventos(esc, [tiro(meuPredio.gx, meuPredio.gy)], 50);
    f.aoPasso(luta, esc);
    f.quadro(0, luta, null);
    expect(f.contadores().faixa).toBe('combate');
    f.quadro(16, comEventos(esc, [], 50 + TICKS_DE_COMBATE + 1), null);
    expect(f.contadores().faixa).toBe('paz');
    gravarEvidencia('H-TELA-AMBIENTE-E-MUSICA', { ...evidencia, ticksDeCombate: TICKS_DE_COMBATE });
  });
});
