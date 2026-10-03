/**
 * E-SAVE-GAVETAS — tres gavetas, a metade headless.
 *
 * Aceite (BUILD_PLAN, Fase E):
 *  (a) salvar, carregar e rodar N ticks da o mesmo estado que rodar N ticks sem salvar;
 *  (b) o save antigo de gaveta unica carrega como gaveta 1;
 *  (c) gaveta com save de versao incompativel aparece recusada, com o motivo, e nao derruba o menu;
 *  (d) roteiro: salvar na 2, voltar ao menu, Continuar abre a 2 (`tools/shots/E-SAVE-GAVETAS.js`).
 * E o escopo: a data vem do relogio do laco externo, e o save (o que a `sim/` produz) nao a contem.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { salvar, VERSAO_DO_SAVE } from '../src/sim/save';
import { criarEscaramuca } from '../src/sim/cenario';
import { criarSessao } from '../src/sessao';
import type { Gaveta } from '../src/arquivo-da-partida';
import {
  CHAVE_DO_INDICE, CHAVE_DO_SAVE, chaveDaGaveta, criarArquivoDaPartida, lerGavetas, lerUltimoSave, ultimaGaveta,
} from '../src/arquivo-da-partida';
import { estadoDaEscolha } from '../src/escolha-da-partida';
import { textoDaGaveta } from '../src/ui/arquivo';
import { motivoDaGaveta } from '../src/ui/menu-inicial';
import temaSertao from '../data/theme-sertao.json';
import { cenarioDaCadeiaDoOuro } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const DATA = '2026-10-03T12:34:56.000Z';
const relogio = (): string => DATA;
const evidencia: Record<string, unknown> = {};

function gavetaDeMentira(itens: Map<string, string> = new Map()): Gaveta & { readonly itens: Map<string, string> } {
  return { itens, getItem: (k) => itens.get(k) ?? null, setItem: (k, v) => { itens.set(k, v); } };
}

function rodar(s: GameState, ticks: number): GameState {
  let e = s;
  for (let i = 0; i < ticks; i += 1) e = step(e, [], gameData);
  return e;
}

describe('E-SAVE-GAVETAS — aceite (a): salvar e carregar nao mudam o futuro', () => {
  it('em cada gaveta: salvar, carregar numa sessao nova e rodar N da o mesmo que rodar N sem salvar', () => {
    const N = 300;
    const vila = rodar(cenarioDaCadeiaDoOuro(gameData), 200);
    const semSalvar = JSON.stringify(rodar(vila, N));
    for (const n of [1, 2, 3] as const) {
      const gaveta = gavetaDeMentira();
      expect(criarArquivoDaPartida(criarSessao(vila), gaveta, gameData, relogio).salvar(n)).toEqual({ ok: true, acao: 'salvou', tick: 200 });
      expect(gaveta.itens.has(chaveDaGaveta(n))).toBe(true);
      const nova = criarSessao(createInitialState(SEMENTE));
      expect(criarArquivoDaPartida(nova, gaveta, gameData, relogio).carregar(n)).toEqual({ ok: true, acao: 'carregou', tick: 200 });
      for (let i = 0; i < N; i += 1) nova.passo();
      expect(JSON.stringify(nova.estado), `gaveta ${n}`).toBe(semSalvar);
    }
    evidencia['a'] = { salvouNoTick: 200, ticksDepois: N };
  });

  it('as tres gavetas sao independentes, e a ultima salva e a do Continuar', () => {
    const gaveta = gavetaDeMentira();
    const livre = createInitialState(SEMENTE);
    const escaramuca = rodar(criarEscaramuca(SEMENTE), 10);
    criarArquivoDaPartida(criarSessao(livre), gaveta, gameData, relogio).salvar(1);
    criarArquivoDaPartida(criarSessao(escaramuca), gaveta, gameData, relogio).salvar(2);
    expect(ultimaGaveta(gaveta)).toBe(2);
    const gavetas = lerGavetas(gaveta);
    expect(gavetas.map((g) => g.situacao)).toEqual(['pronta', 'pronta', 'vazia']);
    expect(gavetas[0]).toMatchObject({ tipo: 'livre', tick: 0, data: DATA });
    expect(gavetas[1]).toMatchObject({ tipo: 'escaramuca', tick: 10, data: DATA });
    const continuar = estadoDaEscolha({ modo: 'continuar' }, gaveta);
    expect(continuar.ok && JSON.stringify(continuar.estado)).toBe(JSON.stringify(escaramuca));
    const um = estadoDaEscolha({ modo: 'carregar', gaveta: 1 }, gaveta);
    expect(um.ok && JSON.stringify(um.estado)).toBe(JSON.stringify(livre));
    // o texto de cada linha: tipo, tick e data, pelo tema
    const rotulos = temaSertao.hud.arquivo.gavetas;
    expect(textoDaGaveta(gavetas[1]!)).toContain(rotulos.tipos.escaramuca);
    expect(textoDaGaveta(gavetas[1]!)).toContain('tick 10');
    expect(textoDaGaveta(gavetas[2]!)).toContain(rotulos.vazia);
    evidencia['linhas'] = gavetas.map((g) => textoDaGaveta(g));
  });

  it('a data e do relogio do laco externo: o save da sim/ e o mesmo com qualquer relogio', () => {
    const vila = rodar(createInitialState(SEMENTE), 5);
    const a = gavetaDeMentira();
    const b = gavetaDeMentira();
    criarArquivoDaPartida(criarSessao(vila), a, gameData, () => '2001-01-01T00:00:00.000Z').salvar(2);
    criarArquivoDaPartida(criarSessao(vila), b, gameData, () => '2099-12-31T23:59:59.000Z').salvar(2);
    expect(a.itens.get(chaveDaGaveta(2))).toBe(b.itens.get(chaveDaGaveta(2)));
    expect(a.itens.get(chaveDaGaveta(2))).toBe(salvar(vila));
    expect(a.itens.get(CHAVE_DO_INDICE)).not.toBe(b.itens.get(CHAVE_DO_INDICE));
  });
});

describe('E-SAVE-GAVETAS — aceite (b): o save antigo e a gaveta 1', () => {
  it('so a chave da F23b, sem indice: gaveta 1 pronta, sem data, e o Continuar a abre', () => {
    const antiga = rodar(createInitialState(SEMENTE), 40);
    const gaveta = gavetaDeMentira(new Map([[CHAVE_DO_SAVE, salvar(antiga)]]));
    expect(chaveDaGaveta(1)).toBe(CHAVE_DO_SAVE);
    const gavetas = lerGavetas(gaveta);
    expect(gavetas[0]).toEqual({ n: 1, situacao: 'pronta', tipo: 'livre', tick: 40, data: null });
    expect(gavetas.slice(1).map((g) => g.situacao)).toEqual(['vazia', 'vazia']);
    expect(ultimaGaveta(gaveta)).toBe(1);
    const continuar = lerUltimoSave(gaveta);
    expect(continuar.ok && JSON.stringify(continuar.estado)).toBe(JSON.stringify(antiga));
    // o carregar da F23b (sem numero) e a gaveta 1
    const sessao = criarSessao(createInitialState(SEMENTE));
    expect(criarArquivoDaPartida(sessao, gaveta).carregar()).toEqual({ ok: true, acao: 'carregou', tick: 40 });
    evidencia['b'] = textoDaGaveta(gavetas[0]!);
  });
});

describe('E-SAVE-GAVETAS — aceite (c): a gaveta incompativel', () => {
  it('versao de outra build: recusada com o motivo, e as outras gavetas continuam', () => {
    const boa = rodar(createInitialState(SEMENTE), 7);
    const envelope = JSON.parse(salvar(boa)) as { versao: number };
    envelope.versao = VERSAO_DO_SAVE + 1;
    const gaveta = gavetaDeMentira(new Map([
      [chaveDaGaveta(1), salvar(boa)],
      [chaveDaGaveta(3), JSON.stringify(envelope)],
    ]));
    const gavetas = lerGavetas(gaveta);
    expect(gavetas.map((g) => g.situacao)).toEqual(['pronta', 'vazia', 'recusada']);
    const recusada = gavetas[2]!;
    expect(recusada.situacao === 'recusada' && recusada.detalhe).toMatch(/versao/);
    const motivo = motivoDaGaveta(recusada);
    expect(motivo).not.toBeNull();
    expect(motivo).toContain(recusada.situacao === 'recusada' ? recusada.detalhe : '');
    expect(textoDaGaveta(recusada)).toContain(recusada.situacao === 'recusada' ? recusada.detalhe : '');
    expect(motivoDaGaveta(gavetas[0]!)).toBeNull();
    // escolher a recusada nao derruba nada: o laco externo recebe a recusa
    const escolha = estadoDaEscolha({ modo: 'carregar', gaveta: 3 }, gaveta);
    expect(escolha.ok).toBe(false);
    evidencia['c'] = { motivo, texto: textoDaGaveta(recusada) };
  });

  it('indice ilegivel ou gaveta que lanca: a lista sai, sem lancar', () => {
    const lixo = gavetaDeMentira(new Map([[CHAVE_DO_INDICE, '{nao e json'], [CHAVE_DO_SAVE, '{']]));
    expect(() => lerGavetas(lixo)).not.toThrow();
    expect(lerGavetas(lixo)[0]!.situacao).toBe('recusada');
    expect(ultimaGaveta(lixo)).toBe(1);
    const bloqueada: Gaveta = { getItem: () => { throw new Error('armazenamento bloqueado'); }, setItem: () => undefined };
    expect(lerGavetas(bloqueada).map((g) => g.situacao)).toEqual(['recusada', 'recusada', 'recusada']);
    expect(ultimaGaveta(bloqueada)).toBeNull();
    expect(lerGavetas(null).map((g) => g.situacao)).toEqual(['recusada', 'recusada', 'recusada']);
    gravarEvidencia('E-SAVE-GAVETAS', evidencia);
  });
});
