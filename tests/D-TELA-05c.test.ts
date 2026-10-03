import { describe, it, expect } from 'vitest';
import type Phaser from 'phaser';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { acaoDaUnidade, atualizarAcao, direcaoDoTrabalho } from '../src/render/acao-de-unidade';
import { criarPonte } from '../src/render/ponte';
import { criarCamadaDeMortes, quadroDaMorte } from '../src/render/mortes-de-unidades';
import type { MorteVisual } from '../src/render/observacao-de-unidades';
import { registrarDepuracao } from '../src/render/registro-de-depuracao';
import type { Manifesto } from '../src/render/manifesto';
import { assetDaCamada } from '../src/render/manifesto';
import { quadroPeloTempo, spriteDoAtlas, tempoDeAnimacao } from '../src/render/animacao-de-unidade';
import { acompanharFimDePartida, criarLaco } from '../src/laco';
import { createInitialState, LADO_DO_JOGADOR, LADO_DA_IA } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { tileAndavel } from '../src/sim/pathfinding';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { cenarioOraculo } from './helpers/producao-cenario';
import { comObra } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/depuracao/manifesto.json', 'utf8')) as Manifesto;
const dadosDoAtlas = JSON.parse(readFileSync('assets/depuracao/militia/militia.json', 'utf8')) as { frames: Record<string, unknown> };
const morrer = assetDaCamada(manifesto, 'unidade', 'militia')!.animacoes!.morrer!;
function com(s: GameState, ...us: Unidade[]): GameState {
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map(u => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map(u => u.id)] } };
}
function u(id: string, tipo: string, p: { gx: number; gy: number }, extra: Partial<Unidade> = {}): Unidade {
  return { id, tipo, lado: LADO_DO_JOGADOR, ...p, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo), ...extra };
}
function campo(s: GameState) {
  for (let r = 6; r < 35; r++) for (let d = -r; d <= r; d++) {
    const p = naVila(d, r);
    if ([0, 1].every(dx => tileAndavel(s, { gx: p.gx + dx, gy: p.gy }, 'livre', gameData))) return p;
  }
  throw new Error('Fixture sem campo livre');
}
function duelo(): GameState {
  const s = createInitialState(1), p = campo(s);
  return com(s, u('atacante', 'militia', p, { direcao: 0 }), u('vitima', 'militia', { ...p, gx: p.gx + 1 }, { hp: 1, lado: LADO_DA_IA, direcao: 6 }));
}
function fome(): GameState {
  const s = createInitialState(1);
  return com(s, u('faminto', 'militia', campo(s), { condicao: 1 }));
}
function gravarSave(nome: string, s: GameState): void {
  mkdirSync('test-output', { recursive: true });
  writeFileSync(`test-output/D-TELA-05c-${nome}.save.txt`, salvar(s));
}

describe('D-TELA-05c - acao e morte', () => {
  it('tabela de FSM, visibilidade, caminhada e retorno ao repouso', () => {
    for (const fsm of ['lutando', 'atirando', 'atacando']) expect(acaoDaUnidade({ tipo: 'militia', fsm }, false, true)).toBe('atacar');
    for (const fsm of ['colhendo', 'semeando']) expect(acaoDaUnidade({ tipo: 'woodcutter', fsm }, false, true)).toBe('trabalhar');
    for (const fsm of ['nivelando', 'martelando']) expect(acaoDaUnidade({ tipo: 'laborer', fsm }, false, true)).toBe('trabalhar');
    for (const tipo of ['serf', 'recruit']) expect(acaoDaUnidade({ tipo, fsm: 'colhendo' }, false, true)).toBe('parado');
    expect(acaoDaUnidade({ tipo: 'woodcutter', fsm: 'colhendo' }, true, false)).toBeNull();
    expect(acaoDaUnidade({ tipo: 'militia', fsm: 'marchando' }, true, true)).toBe('andar');
    expect(acaoDaUnidade({ tipo: 'woodcutter', fsm: 'trabalhando' }, false, true)).toBe('parado');
    const inicio = atualizarAcao(undefined, 'atacar', 100);
    expect(atualizarAcao(inicio, 'atacar', 101)).toBe(inicio);
    expect(quadroPeloTempo(0, 10, morrer)).toBe(0);
    expect(atualizarAcao(atualizarAcao(inicio, 'parado', 102), 'atacar', 103).inicio).toBe(103);
    expect(spriteDoAtlas(manifesto, 'militia', 'trabalhar', 's', 2, () => true)).toBeNull();
  });

  it('observa luta real e conserva morte mesmo com varios ticks sem desenho; sim identica', () => {
    let s = duelo(), controle = s;
    const ponte = criarPonte(); ponte.atual = s;
    gravarSave('ataque', s);
    const mortes: MorteVisual[] = [];
    let viuAtaque = false, tickDaMorte = -1;
    for (let i = 0; i < 100; i++) {
      const comandos = i === 0 ? [{ type: 'AttackUnit' as const, unidades: ['atacante'], alvo: 'vitima' }] : [];
      s = step(s, comandos); controle = step(controle, comandos);
      ponte.atual = s;
      if (s.unidades.porId.atacante?.fsm === 'lutando') viuAtaque = true;
      if (s.events.some(e => e.type === 'unit-killed' && e.unidade === 'vitima')) {
        tickDaMorte = s.tick;
        expect(s.unidades.porId.vitima).toBeUndefined();
        expect(ponte.acoes?.has('vitima')).toBe(false);
      }
    }
    mortes.push(...ponte.consumirMortes!());
    expect(viuAtaque).toBe(true); expect(tickDaMorte).toBeGreaterThan(0);
    expect(mortes.filter(m => m.id === 'vitima')).toHaveLength(1);
    expect(ponte.consumirMortes!()).toEqual([]);
    expect(JSON.stringify(s)).toBe(JSON.stringify(controle));
    gravarEvidencia('D-TELA-05c-luta', { tickDaMorte, mortes, simIdentica: true });
  });

  it('morte por fome e projetil sao eventos reais; repeticao nao duplica e load limpa', () => {
    const inicial = fome(); gravarSave('morte', inicial);
    const ponte = criarPonte(); ponte.atual = inicial;
    const morto = step(inicial, []);
    gravarSave('morte-mesmo-tick', { ...inicial, tick: morto.tick });
    expect(morto.events.some(e => e.type === 'unit-starved' && e.unidade === 'faminto')).toBe(true);
    const repetido = { ...morto, events: [...morto.events, ...morto.events] };
    ponte.atual = repetido; ponte.atual = repetido;
    const mortes = ponte.consumirMortes!();
    expect(mortes).toHaveLength(1); expect(mortes[0]?.tick).toBe(morto.tick);
    ponte.reiniciar!(); ponte.atual = { ...inicial, tick: morto.tick };
    expect(ponte.consumirMortes!()).toEqual([]);
    const s = duelo();
    const vitima = s.unidades.porId.vitima!;
    const comPedra: GameState = { ...s, projeteis: [{ projetil: 'pedraDaTorre', de: { id: 'torre', tipo: 'militia', lado: LADO_DO_JOGADOR, gx: vitima.gx - 3, gy: vitima.gy }, origem: { gx: vitima.gx - 3, gy: vitima.gy }, alvoTile: { gx: vitima.gx, gy: vitima.gy }, alvoUnidade: vitima.id, voo: 1, restantes: 1 }] };
    const p = criarPonte(); p.atual = comPedra;
    p.atual = step(comPedra, []);
    expect(p.atual.events.some(e => e.type === 'unit-killed' && e.unidade === vitima.id)).toBe(true);
    expect(p.consumirMortes!().map(m => m.id)).toContain(vitima.id);
    const hidden = com(createInitialState(1), u('dentro', 'woodcutter', campo(s), { condicao: 1, fsm: 'comendo' }));
    const h = criarPonte(); h.atual = hidden; h.atual = step(hidden, []);
    expect(h.atual.unidades.porId.dentro).toBeUndefined(); expect(h.consumirMortes!()).toEqual([]);
    gravarEvidencia('D-TELA-05c-mortes', { fome: mortes, projetil: p.atual.events, escondida: 'sem corpo' });
  });

  it('tempo de morte termina sem laco; layer descarta ausente, libera objetos e reseta partida', () => {
    const morte: MorteVisual = { id: 'corpo', tipo: 'militia', lado: LADO_DO_JOGADOR, ...naVila(0, 5), direcao: 's', tick: 10 };
    for (let i = 0; i < 6; i++) expect(quadroDaMorte(morte, 10 + i, morrer)).toBe(i);
    expect(quadroDaMorte(morte, 16, morrer)).toBeNull();
    let destruidos = 0, criados = 0;
    const imagem = () => {
      criados++;
      return {
        y: 0, scaleY: 1, displayOriginY: 96, frame: { y: 0, height: 96 },
        setPosition(_x: number, y: number) { this.y = y; return this; },
        setDepth() { return this; }, setFrame() { return this; }, setFlipX() { return this; },
        setOrigin() { return this; }, setVisible() { return this; }, destroy() { destruidos++; },
      };
    };
    let disponivel = true;
    const cena = { add: { image: imagem }, textures: { exists: () => disponivel, get: () => ({ has: (frame: string) => frame in dadosDoAtlas.frames }) }, cameras: { main: { worldView: { x: 0, y: 0, right: 100000, bottom: 100000 } } } } as unknown as Phaser.Scene;
    const janelaAnterior = globalThis.window;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '?depuracao=militia' } } });
    registrarDepuracao({ manifesto, atlas: { chave: 'unidade:militia:atlas', url: 'fixture.png', dados: dadosDoAtlas } });
    try {
      const camada = criarCamadaDeMortes(cena, 64);
      expect(camada.atualizar([morte, morte], 10, 0)).toHaveLength(1);
      expect(criados).toBe(1);
      expect(camada.atualizar([], 12, 0)[0]?.quadro).toBe(2);
      let tick = 12;
      const relogio = criarLaco({ passo: () => { tick++; }, tickMs: 100, velocidades: [1], velocidadePadrao: 1 });
      acompanharFimDePartida(relogio, { partida: { fim: 'vitoria', tick } });
      relogio.avancar(20); relogio.retomar(); relogio.tique(2000); relogio.tique(3000);
      expect(tick).toBe(12);
      expect(camada.atualizar([], tempoDeAnimacao(tick, relogio.alfa()), 0)[0]?.quadro).toBe(2);
      expect(camada.atualizar([], 15, 0)[0]?.quadro).toBe(5);
      expect(camada.atualizar([], 16, 0)).toEqual([]);
      expect(camada.quantidade).toBe(0); expect(destruidos).toBe(1);
      expect(camada.atualizar([morte], 20, 0)).toEqual([]);
      expect(criados).toBe(1); // fila antiga nao recria corpo ja expirado
      disponivel = false; expect(camada.atualizar([morte], 10, 0)).toEqual([]);
      disponivel = true; camada.atualizar([morte], 10, 0);
      expect(camada.atualizar([], 10, 1)).toEqual([]); expect(destruidos).toBe(2);
      camada.limpar(); expect(camada.quantidade).toBe(0);
      gravarEvidencia('D-TELA-05c-vida-dos-corpos', { criados, destruidos, quantidade: camada.quantidade });
    } finally { Object.defineProperty(globalThis, 'window', { configurable: true, value: janelaAnterior }); }
  });

  it('colheita e construcao reais avancam; direcao vem da tarefa e nao inventa alvo', () => {
    let s = cenarioOraculo();
    let colhendo: GameState | undefined;
    for (let i = 0; i < 1000 && !colhendo; i++) { s = step(s, []); if (s.unidades.porId['lenhador-1']?.fsm === 'colhendo') colhendo = s; }
    expect(colhendo).toBeDefined();
    const lenhador = colhendo!.unidades.porId['lenhador-1']!;
    expect(acaoDaUnidade(lenhador, false, true)).toBe('trabalhar');
    expect(direcaoDoTrabalho(colhendo!, lenhador)).not.toBeNull();
    expect(direcaoDoTrabalho(colhendo!, { ...lenhador, fsmData: {} })).toBeNull();
    gravarSave('lenhador', colhendo!);
    const antes = colhendo!.predios.porId.w1;
    if (!antes || antes.estado !== 'completo') throw new Error('Fixture sem lenhador');
    const troncos = antes.estoque.saida.tree_trunk ?? 0;
    for (let i = 0; i < 1500; i++) { s = step(s, []); const p = s.predios.porId.w1; if (p?.estado === 'completo' && (p.estoque.saida.tree_trunk ?? 0) > troncos) break; }
    const fim = s.predios.porId.w1;
    expect(fim?.estado === 'completo' && (fim.estoque.saida.tree_trunk ?? 0) > troncos).toBe(true);
    let b = comObra(createInitialState(1), 'obra-animada', { ...naVila(-3, 4), faltam: {} });
    let trabalhando: GameState | undefined;
    for (let i = 0; i < 500 && !trabalhando; i++) { b = step(b, []); if (b.unidades.ordem.some(id => ['nivelando', 'martelando'].includes(b.unidades.porId[id]!.fsm))) trabalhando = b; }
    expect(trabalhando).toBeDefined(); gravarSave('laborer', trabalhando!);
    const hpAntes = b.predios.porId['obra-animada']!.hp;
    for (let i = 0; i < 100; i++) b = step(b, []);
    expect(b.predios.porId['obra-animada']!.hp).toBeGreaterThan(hpAntes);
    gravarEvidencia('D-TELA-05c-trabalho', { lenhador, troncos, fim, construcao: { hpAntes, hpDepois: b.predios.porId['obra-animada']!.hp } });
  });
});
