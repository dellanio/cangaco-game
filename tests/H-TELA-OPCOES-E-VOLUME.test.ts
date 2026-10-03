/**
 * H-TELA-OPCOES-E-VOLUME — a tela de opcoes (a metade headless).
 *
 * (a) a regra pura do volume efetivo (geral x canal, mudo zera), por tabela;
 * (b) o volume sobrevive a recarregar (a mesma gaveta lida de novo) e nao entra no save: o estado
 *     salvo e igual com e sem mudar o volume.
 * O (c) (abrir pelo menu e pelo jogo, mexer no volume despausado, a foto) e o roteiro
 * `tools/shots/H-TELA-OPCOES-E-VOLUME.js`.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import {
  CHAVE_DO_SOM, canalDoSom, criarPreferenciasVivas, lerPreferencias, preferenciasPadrao, volumeEfetivo,
} from '../src/preferencias-de-som';
import type { PreferenciasDeSom, VolumePadrao } from '../src/preferencias-de-som';
import type { Gaveta } from '../src/arquivo-da-partida';
import { criarCamadaDeSom } from '../src/render/som';
import type { TabelaDeSom } from '../src/render/som';
import { validarSom } from '../tools/data-rules.js';
import { EVENTOS_DA_SIM } from '../src/render/eventos-da-sim';
import tabelaJson from '../data/som.json';
import { gravarEvidencia } from './helpers/evidence';

const PADRAO = tabelaJson.volumePadrao as VolumePadrao;
const TABELA = tabelaJson as TabelaDeSom;
const evidencia: Record<string, unknown> = {};

function gaveta(itens: Record<string, string> = {}): Gaveta & { itens: Record<string, string> } {
  return { itens, getItem: (k) => itens[k] ?? null, setItem: (k, v) => { itens[k] = v; } };
}

describe('H-TELA-OPCOES-E-VOLUME — (a) o volume efetivo', () => {
  it('geral x canal, por tabela; o mudo zera; fora de [0, 1] se limita', () => {
    const p = (geral: number, efeitos: number, mudo = false): PreferenciasDeSom => ({ geral, efeitos, ambiente: 0.6, musica: 0.5, mudo });
    const casos: [PreferenciasDeSom, 'efeitos' | 'ambiente' | 'musica', number][] = [
      [p(1, 1), 'efeitos', 1],
      [p(0.5, 1), 'efeitos', 0.5],
      [p(0.5, 0.5), 'efeitos', 0.25],
      [p(0.8, 1), 'ambiente', 0.48],
      [p(0.8, 1), 'musica', 0.4],
      [p(0, 1), 'efeitos', 0],
      [p(1, 0), 'efeitos', 0],
      [p(1, 1, true), 'efeitos', 0],
      [p(1, 1, true), 'musica', 0],
      [p(2, 1), 'efeitos', 1],
    ];
    for (const [prefs, canal, esperado] of casos) expect(volumeEfetivo(prefs, canal), `${JSON.stringify(prefs)} ${canal}`).toBeCloseTo(esperado, 10);
    evidencia['volumeEfetivo'] = casos.map(([prefs, canal, v]) => `geral ${prefs.geral} x ${canal} ${prefs[canal]}${prefs.mudo ? ' mudo' : ''} = ${v}`);
  });

  it('o canal de cada som vem do dado; sem canal, efeitos', () => {
    for (const [id, def] of Object.entries(TABELA.sons)) expect(canalDoSom(TABELA.sons, id)).toBe(def.canal);
    expect(canalDoSom({}, 'nao-existe')).toBe('efeitos');
    expect(canalDoSom({ x: { canal: 'musica' } }, 'x')).toBe('musica');
  });

  it('a camada toca com o volume efetivo, e o mudo vira silencio (o tocador nao e chamado)', () => {
    const chamados: [string, number][] = [];
    let prefs = preferenciasPadrao(PADRAO);
    const camada = criarCamadaDeSom(TABELA, new Set(['blueprint-placed']), { tocar: (id, v) => chamados.push([id, v]) },
      (id) => volumeEfetivo(prefs, canalDoSom(TABELA.sons, id)));
    camada.pedirPlanta();
    camada.quadro();
    prefs = { ...prefs, mudo: true };
    camada.pedirPlanta();
    camada.quadro();
    expect(chamados).toEqual([['blueprint-placed', PADRAO.geral * PADRAO.efeitos]]);
    expect(camada.contadores()).toMatchObject({ pedidos: 2, tocados: 1, emSilencio: 1 });
  });

  it('o validate:data recusa canal fora da lista e volume padrao fora de [0, 1]', () => {
    const rodar = (s: unknown): string[] => {
      const erros: string[] = [];
      validarSom(s, erros, { eventosDaSim: EVENTOS_DA_SIM, manifesto: { assets: [] } });
      return erros;
    };
    expect(rodar(tabelaJson)).toEqual([]);
    const sons = { ...tabelaJson.sons, 'unit-killed': { canal: 'gritos', tetoPorQuadro: 1 } };
    expect(rodar({ ...tabelaJson, sons })).toEqual(["interface/som: 'unit-killed': canal precisa ser um de efeitos, ambiente, musica"]);
    expect(rodar({ ...tabelaJson, volumePadrao: { ...PADRAO, musica: 1.5 } })).toEqual(['interface/som: volumePadrao.musica precisa ser numero de 0 a 1']);
  });
});

describe('H-TELA-OPCOES-E-VOLUME — (b) o volume fica no navegador, fora do save', () => {
  it('sem nada guardado: o padrao do dado, sem mudo', () => {
    expect(lerPreferencias(gaveta(), PADRAO)).toEqual({ ...PADRAO, mudo: false });
    expect(lerPreferencias(null, PADRAO)).toEqual({ ...PADRAO, mudo: false });
  });

  it('mudar grava; recarregar (ler a mesma gaveta de novo) devolve o que foi escolhido', () => {
    const g = gaveta();
    const vivas = criarPreferenciasVivas(g, PADRAO);
    const escolhido = { geral: 0.3, efeitos: 0.7, ambiente: 0, musica: 1, mudo: true };
    vivas.mudar(escolhido);
    expect(vivas.atual).toEqual(escolhido);
    expect(Object.keys(g.itens)).toEqual([CHAVE_DO_SOM]);
    expect(criarPreferenciasVivas(g, PADRAO).atual).toEqual(escolhido);
    evidencia['guardado'] = g.itens[CHAVE_DO_SOM];
  });

  it('o que nao serve no guardado vira o padrao, campo a campo; a gaveta que lanca e o padrao', () => {
    expect(lerPreferencias(gaveta({ [CHAVE_DO_SOM]: 'nao e json' }), PADRAO)).toEqual({ ...PADRAO, mudo: false });
    expect(lerPreferencias(gaveta({ [CHAVE_DO_SOM]: '{"geral":0.2,"efeitos":7,"musica":"alto","mudo":1}' }), PADRAO))
      .toEqual({ ...PADRAO, geral: 0.2, mudo: false });
    const quebrada: Gaveta = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(lerPreferencias(quebrada, PADRAO)).toEqual({ ...PADRAO, mudo: false });
    expect(() => criarPreferenciasVivas(quebrada, PADRAO).mudar({ ...PADRAO, mudo: true })).not.toThrow();
  });

  it('o estado salvo e igual, byte a byte, com e sem mudar o volume', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    for (let i = 0; i < 20; i += 1) s = step(s, [], gameData);
    const g = gaveta();
    const antes = salvar(s);
    criarPreferenciasVivas(g, PADRAO).mudar({ geral: 0.1, efeitos: 0.2, ambiente: 0.3, musica: 0.4, mudo: true });
    const depois = salvar(s);
    expect(depois).toBe(antes);
    expect(antes.includes(CHAVE_DO_SOM)).toBe(false);
    expect(/"(mudo|volume)"/.test(antes)).toBe(false);
    gravarEvidencia('H-TELA-OPCOES-E-VOLUME', { ...evidencia, saveBytes: antes.length });
  });
});
