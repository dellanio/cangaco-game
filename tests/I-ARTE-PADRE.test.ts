/**
 * I-ARTE-PADRE — o padre desenhado (PixelLab), andando e rezando, e os poderes na tela: a aura da bencao,
 * o brilho nos abencoados, o facho da conversao. Regras puras do render e o atlas conferido no disco.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { salvar } from '../src/sim/save';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { assetDaCamada, DIRECOES, type Manifesto } from '../src/render/manifesto';
import { spriteDoAtlas } from '../src/render/animacao-de-unidade';
import { acaoDaUnidade, direcaoDaOracao } from '../src/render/acao-de-unidade';
import { alfaDoPulso, desenhoDoPadre } from '../src/render/padre-visual';
import type { ConfigDoPadreVisual } from '../src/render/padre-visual';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const config = JSON.parse(readFileSync('data/padre-visual.json', 'utf8')) as ConfigDoPadreVisual;
const IA = LADO_DO_JOGADOR + 1;
const R = gameData.combate.padre.raioDaBencao_tiles;
const un = (id: string, tipo: string, gx: number, gy: number, lado = LADO_DO_JOGADOR, extra: Partial<Unidade> = {}): Unidade =>
  ({ id, lado, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: 100000, ...extra });
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } } as GameState;
}

describe('I-ARTE-PADRE', () => {
  it('(1) a entrada priest no manifesto: o atlas tem todo quadro de andar e rezar nas cinco direcoes', () => {
    const entrada = assetDaCamada(manifesto, 'unidade', 'priest');
    expect(entrada?.atlas).toBe('sprites/units/priest/priest.json');
    const atlas = JSON.parse(readFileSync(`assets/${entrada!.atlas!}`, 'utf8')) as { frames: Record<string, unknown> };
    const tem = (_chave: string, frame: string) => frame in atlas.frames;
    const faltando: string[] = [];
    for (const [anim, dado] of Object.entries(entrada!.animacoes ?? {})) {
      for (const d of ['n', 'ne', 'l', 'se', 's'] as const) {
        for (let q = 0; q < dado.quadros; q++) if (spriteDoAtlas(manifesto, 'priest', anim, d, q, tem)?.espelhar !== false) faltando.push(`${anim}/${d}/${q}`);
      }
    }
    expect(faltando).toEqual([]);
    expect(Object.keys(entrada!.animacoes ?? {}).sort()).toEqual(['andar', 'morrer', 'parado', 'rezar']);
    // o oeste e o espelho do leste
    expect(spriteDoAtlas(manifesto, 'priest', 'rezar', 'o', 0, tem)?.espelhar).toBe(true);
    gravarEvidencia('I-ARTE-PADRE', { quadros: Object.keys(atlas.frames).length, animacoes: entrada!.animacoes, tamanho: entrada!.tamanho });
  });

  it('(2) a acao visual: rezando (convertendo) e rezar, andando e andar, de frente para o alvo', () => {
    expect(acaoDaUnidade({ tipo: 'priest', fsm: 'convertendo' }, false, true)).toBe('rezar');
    expect(acaoDaUnidade({ tipo: 'priest', fsm: 'indo_converter' }, true, true)).toBe('andar');
    expect(acaoDaUnidade({ tipo: 'priest', fsm: 'ocioso' }, false, true)).toBe('parado');
    const p = un('p', 'priest', 40, 40, LADO_DO_JOGADOR, { fsm: 'convertendo', fsmData: { alvoUnidade: 'alvo' } });
    const s = com(p, un('alvo', 'militia', 44, 40, IA));
    expect(direcaoDaOracao(s, p)).toBe('l');
    expect(DIRECOES).toContain(direcaoDaOracao(s, p));
  });

  it('(3) a aura so do padre do jogador; o brilho so nos abencoados (a regra da sim); o facho so de quem reza', () => {
    const s = com(
      un('p', 'priest', 40, 40, LADO_DO_JOGADOR, { fsm: 'convertendo', fsmData: { alvoUnidade: 'alvo' } }),
      un('perto', 'militia', 40 + R, 40), un('longe', 'militia', 40 + R + 1, 40), un('civil', 'serf', 41, 40),
      un('alvo', 'militia', 44, 40, IA), un('pIA', 'priest', 10, 10, IA),
    );
    const d = desenhoDoPadre(s, R, 0, config);
    expect(d.aneis.map((a) => a.padre)).toEqual(['p']);
    expect(d.aneis[0]!.raio).toBe(R);
    expect(d.abencoados.map((a) => a.unidade)).toContain('perto');
    expect(d.abencoados.map((a) => a.unidade)).not.toContain('longe');
    expect(d.abencoados.map((a) => a.unidade)).not.toContain('civil');
    expect(d.abencoados.map((a) => a.unidade)).not.toContain('alvo');
    expect(d.fachos).toEqual([expect.objectContaining({ padre: 'p', de: { gx: 40, gy: 40 }, para: { gx: 44, gy: 40 } })]);
    // sem padre do jogador, nada
    const so = desenhoDoPadre(com(un('perto', 'militia', 40, 40), un('pIA', 'priest', 41, 40, IA)), R, 0, config);
    expect(so).toEqual({ aneis: [], abencoados: [], fachos: [] });
  });

  it('(4) o pulso fica entre o minimo e o maximo e volta no periodo', () => {
    const { alfaMinimo, alfa, pulsoTicks } = config.aura;
    for (let t = 0; t < pulsoTicks * 2; t += 0.5) {
      const a = alfaDoPulso(t, alfaMinimo, alfa, pulsoTicks);
      expect(a).toBeGreaterThanOrEqual(alfaMinimo - 1e-9);
      expect(a).toBeLessThanOrEqual(alfa + 1e-9);
      expect(alfaDoPulso(t + pulsoTicks, alfaMinimo, alfa, pulsoTicks)).toBeCloseTo(a, 9);
    }
  });

  it('grava a partida do roteiro: o padre do jogador, tres cabras em volta e um cabra inimigo a 6 tiles', () => {
    const base = createInitialState(gameData.economia.estadoInicial.semente);
    const s = { ...com(
      un('padre', 'priest', 40, 34), un('c1', 'militia', 39, 33), un('c2', 'militia', 41, 33), un('c3', 'militia', 40, 32),
      un('inimigo', 'militia', 46, 34, IA),
    ), rng: base.rng } as GameState;
    const d = desenhoDoPadre(s, R, 0, config);
    expect(d.abencoados.map((a) => a.unidade).filter((id) => id.startsWith('c'))).toEqual(['c1', 'c2', 'c3']);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-ARTE-PADRE.save.txt`, salvar(s));
  });

  it('o validador recusa a aura com o minimo acima do maximo', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    expect(validarInterface(dados, { ...interfaceUi, 'padre-visual': { ...config, aura: { ...config.aura, alfaMinimo: 0.9 } } }))
      .toContain('interface/padre-visual: aura precisa de cor, alfaMinimo <= alfa em [0, 1], espessuraPx > 0 e pulsoTicks > 0');
  });
});
