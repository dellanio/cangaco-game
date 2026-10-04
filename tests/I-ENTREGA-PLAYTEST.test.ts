/**
 * I-ENTREGA-PLAYTEST — gente de fora joga.
 *
 * (a) o arquivo do relato carrega de volta no jogo e da o mesmo estado (o save dentro dele e o save
 *     de sempre);
 * (b) o relato nao leva nada alem do que a tela diz que leva (pela lista de campos);
 * (c) o `docs/playtest.md` esta no git.
 * O roteiro `tools/shots/I-ENTREGA-PLAYTEST.js` baixa o relato pela tela e o abre de volta.
 */
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { criarEscaramuca } from '../src/sim/cenario';
import { estadoNovo } from '../src/escolha-da-partida';
import { CAMPOS_DO_RELATO, lerRelato, nivelDaIA, relatoDaPartida, textoDoRelato } from '../src/relato';
import { textoDoQueLeva } from '../src/ui/relato';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;

function partidaAndando(): ReturnType<typeof criarEscaramuca> {
  let s = criarEscaramuca(SEMENTE, gameData, { nivel: 'facil' });
  for (let t = 0; t < 200; t += 1) s = step(s, [], gameData);
  return s;
}

describe('I-ENTREGA-PLAYTEST — o relato', () => {
  it('(a) o relato carrega de volta no jogo e da o mesmo estado', () => {
    const s = partidaAndando();
    const arquivo = textoDoRelato(relatoDaPartida(s, 'abc1234', 'travou na serraria', gameData));
    const lido = lerRelato(arquivo, gameData);
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    expect(salvar(lido.estado, gameData)).toBe(salvar(s, gameData));
    expect(JSON.stringify(lido.estado)).toBe(JSON.stringify(s));
    expect(lido.relato).toEqual({ save: salvar(s, gameData), commit: 'abc1234', nivel: 'facil', texto: 'travou na serraria' });
    // e a partida segue igual depois de carregada
    expect(JSON.stringify(step(lido.estado, [], gameData))).toBe(JSON.stringify(step(s, [], gameData)));
    gravarEvidencia('I-ENTREGA-PLAYTEST', { tick: s.tick, bytesDoRelato: arquivo.length, campos: Object.keys(JSON.parse(arquivo) as object) });
  });

  it('(a) o arquivo que nao e relato, ou o save que o jogo recusa, e recusado com o motivo', () => {
    expect(lerRelato('nao e json', gameData).ok).toBe(false);
    const bom = JSON.parse(textoDoRelato(relatoDaPartida(estadoNovo({ modo: 'livre' }), 'x', '', gameData))) as Record<string, unknown>;
    expect(lerRelato(JSON.stringify({ ...bom, email: 'a@b' }), gameData).ok).toBe(false);
    const { texto: _texto, ...semTexto } = bom;
    expect(lerRelato(JSON.stringify(semTexto), gameData).ok).toBe(false);
    const saveRuim = lerRelato(JSON.stringify({ ...bom, save: '{"versao":-1}' }), gameData);
    expect(saveRuim.ok).toBe(false);
    if (!saveRuim.ok) expect(saveRuim.motivo).toMatch(/versao/);
  });

  it('(b) o relato leva exatamente os campos que a tela diz que leva', () => {
    const arquivo = textoDoRelato(relatoDaPartida(partidaAndando(), 'abc1234', 'oi', gameData));
    expect(Object.keys(JSON.parse(arquivo) as object)).toEqual([...CAMPOS_DO_RELATO]);
    // a tela tem um rotulo por campo, e nenhum a mais (ida e volta)
    expect(Object.keys(temaSertao.relato.campos).sort()).toEqual([...CAMPOS_DO_RELATO].sort());
    // e a frase da tela e montada da mesma lista: todo campo esta nela
    const leva = textoDoQueLeva();
    for (const c of CAMPOS_DO_RELATO) expect(leva, c).toContain(temaSertao.relato.campos[c]);
  });

  it('o nivel do adversario: o da escaramuca, e nenhum no jogo livre', () => {
    expect(nivelDaIA(estadoNovo({ modo: 'livre' }))).toBeNull();
    expect(nivelDaIA(criarEscaramuca(SEMENTE, gameData, { nivel: 'dificil' }))).toBe('dificil');
    expect(nivelDaIA(criarEscaramuca(SEMENTE, gameData))).toBe('normal');
  });

  it('(c) o docs/playtest.md esta no git', () => {
    expect(execSync('git ls-files docs/playtest.md', { encoding: 'utf8' }).trim()).toBe('docs/playtest.md');
  });
});
