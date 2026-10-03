/**
 * E-TELA-MENU-INICIAL — a porta do jogo, a metade headless.
 *
 * O que se prova aqui: a regra da URL (sem parametro, o menu; com parametro, o jogo direto, e
 * `?menu` forca o menu), a escaramuca do menu igual a do `?escaramuca` no tick 0 (aceite b, pelo
 * estado serializado), e o Continuar sem save desabilitado com o motivo (aceite c). O menu na
 * tela, sem canvas antes da escolha, e o roteiro `tools/shots/E-TELA-MENU-INICIAL.js`.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { criarEscaramuca } from '../src/sim/cenario';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { abreNoMenu, escolhaDaUrl, estadoDaEscolha } from '../src/escolha-da-partida';
import { CHAVE_DO_SAVE } from '../src/arquivo-da-partida';
import type { Gaveta } from '../src/arquivo-da-partida';
import { motivoDoContinuar, rotuloDaGaveta } from '../src/ui/menu-inicial';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const evidencia: Record<string, unknown> = {};

function gaveta(itens: Record<string, string> = {}): Gaveta {
  return { getItem: (k) => itens[k] ?? null, setItem: (k, v) => { itens[k] = v; } };
}

describe('E-TELA-MENU-INICIAL — a regra da URL', () => {
  it('sem parametro abre o menu; com qualquer parametro dos roteiros, nao; ?menu forca', () => {
    const casos: [string, boolean][] = [
      ['', true], ['?', true], ['?pausado', false], ['?escaramuca', false],
      ['?escaramuca&pausado', false], ['?vitrine=serf', false], ['?menu', true], ['?menu&pausado', true],
    ];
    for (const [busca, esperado] of casos) expect(abreNoMenu(busca), busca).toBe(esperado);
    evidencia['regraDaUrl'] = Object.fromEntries(casos);
  });

  it('a partida da URL e a de antes do menu: ?escaramuca a escaramuca, o resto o jogo livre', () => {
    expect(escolhaDaUrl('?escaramuca&pausado')).toEqual({ modo: 'escaramuca' });
    expect(escolhaDaUrl('?pausado')).toEqual({ modo: 'livre' });
  });
});

describe('E-TELA-MENU-INICIAL — aceite (b): a escaramuca do menu e a do ?escaramuca', () => {
  it('o estado serializado do tick 0 e igual, byte a byte, ao que o main.ts criava pela URL', () => {
    const peloMenu = estadoDaEscolha({ modo: 'escaramuca' }, null);
    const pelaUrl = estadoDaEscolha(escolhaDaUrl('?escaramuca'), null);
    expect(peloMenu.ok && pelaUrl.ok).toBe(true);
    if (!peloMenu.ok || !pelaUrl.ok) return;
    const antes = JSON.stringify(criarEscaramuca(SEMENTE));
    expect(JSON.stringify(peloMenu.estado)).toBe(antes);
    expect(JSON.stringify(pelaUrl.estado)).toBe(antes);
    expect(peloMenu.estado.tick).toBe(0);
    const livre = estadoDaEscolha({ modo: 'livre' }, null);
    expect(livre.ok && JSON.stringify(livre.estado)).toBe(JSON.stringify(createInitialState(SEMENTE)));
    evidencia['escaramucaIgual'] = { bytes: antes.length, tick: 0 };
  });
});

describe('E-TELA-MENU-INICIAL — aceite (c): o Continuar', () => {
  it('sem save: recusado, e o motivo e o texto do tema', () => {
    const r = estadoDaEscolha({ modo: 'continuar' }, gaveta());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.leitura.causa).toBe('sem-save');
    const motivo = motivoDoContinuar({ pronto: false, causa: r.leitura.causa, detalhe: r.leitura.detalhe });
    expect(motivo).toBe(temaSertao.menuInicial['sem-save']);
    evidencia['semSave'] = motivo;
  });

  it('sem navegador para guardar (gaveta nula): recusado com o motivo da gaveta', () => {
    const r = estadoDaEscolha({ modo: 'continuar' }, null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.leitura.causa).toBe('gaveta');
    expect(motivoDoContinuar({ pronto: false, causa: 'gaveta', detalhe: r.leitura.detalhe })).not.toBeNull();
  });

  it('save ilegivel: recusado com o motivo do carregar', () => {
    const r = estadoDaEscolha({ modo: 'continuar' }, gaveta({ [CHAVE_DO_SAVE]: '{"versao":1}' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.leitura.causa).toBe('recusado');
    const motivo = motivoDoContinuar({ pronto: false, causa: 'recusado', detalhe: r.leitura.detalhe });
    expect(motivo).toContain(r.leitura.detalhe);
    evidencia['recusado'] = motivo;
  });

  it('com save: abre a partida guardada, e o Continuar nao tem motivo', () => {
    let s = createInitialState(SEMENTE);
    for (let i = 0; i < 20; i += 1) s = step(s, [], gameData);
    const r = estadoDaEscolha({ modo: 'continuar' }, gaveta({ [CHAVE_DO_SAVE]: salvar(s) }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.estado)).toBe(JSON.stringify(s));
    expect(motivoDoContinuar({ pronto: true, tick: r.estado.tick })).toBeNull();
    expect(rotuloDaGaveta({ pronto: true, tick: 20 })).toContain('20');
    gravarEvidencia('E-TELA-MENU-INICIAL', evidencia);
  });
});
