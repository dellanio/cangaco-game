/**
 * C-IA-03c (cenario de escaramuca: jogar pela tela). A parte headless; a tela e o roteiro
 * `npm run shot -- C-IA-03c` (da abertura a vitoria, pelo mouse):
 *  - o contador da paz: `Paz: 10:00` no comeco, mm:ss arredondado para cima, e some com a paz
 *    e no jogo livre;
 *  - a cor de cada bando vem do tema (o do documento da campanha), e lado sem cor reprova;
 *  - o recado de "Nova escaramuca" vem do tema.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import { criarEscaramuca } from '../src/sim/cenario';
import { segundosDePazRestantes } from '../src/sim/paz';
import { textoDoContador } from '../src/ui/contador-de-paz';
import { corDoBando } from '../src/render/cor-do-bando';
import { textoDoRecado } from '../src/ui/arquivo';
import temaSertao from '../data/theme-sertao.json';

const SEMENTE = gameData.economia.estadoInicial.semente;

describe('C-IA-03c — a escaramuca na tela', () => {
  it('o contador: 10:00 no comeco, para cima no meio, some com a paz e no jogo livre', () => {
    const s0 = criarEscaramuca(SEMENTE);
    expect(textoDoContador(segundosDePazRestantes(s0))).toBe('Paz: 10:00');
    // 1 tick depois ainda mostra 10:00 (arredonda para cima: nunca 0:00 com paz valendo)
    expect(textoDoContador(segundosDePazRestantes({ ...s0, tick: 1 }))).toBe('Paz: 10:00');
    expect(textoDoContador(segundosDePazRestantes({ ...s0, tick: 10 }))).toBe('Paz: 9:59');
    expect(textoDoContador(segundosDePazRestantes({ ...s0, tick: gameData.escaramuca.ticksDePaz - 1 }))).toBe('Paz: 0:01');
    expect(textoDoContador(segundosDePazRestantes({ ...s0, tick: gameData.escaramuca.ticksDePaz }))).toBe('');
    expect(textoDoContador(segundosDePazRestantes(createInitialState(SEMENTE)))).toBe('');
    expect(temaSertao.paz.rotulo).toContain('{tempo}');
  });

  it('a cor do bando: vermelho do Moita Seca para o jogador, azul do Cabo Branco para a IA', () => {
    expect(corDoBando(LADO_DO_JOGADOR)).toBe('#D64B3F');
    expect(corDoBando(LADO_DA_IA)).toBe('#3F72D6');
    expect(() => corDoBando(7)).toThrow(/nao tem bando/);
  });

  it('o recado de "Nova escaramuca" vem do tema', () => {
    const r = temaSertao.hud.arquivo;
    expect(textoDoRecado({ ok: true, acao: 'escaramuca', tick: 0 }, r)).toBe(r.escaramucaIniciada);
    expect(typeof r.escaramuca).toBe('string');
  });
});
