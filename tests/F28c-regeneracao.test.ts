/**
 * F28c — a regeneracao de HP (BUILD_PLAN, F28c; plano em
 * docs/planos/2026-09-28-A7-F28c-regeneracao.md).
 *
 * Aceite do item: uma unidade ferida volta ao HP cheio no tempo que o dado diz, e
 * nunca passa do teto. Mais o que a decisao do operador pediu: MEDIR o efeito do
 * `multiplicadorHP` antes de fixar o numero — a tabela vai para test-output/F28c.json.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { hpDaUnidade, hpMaximoDoTipo } from '../src/sim/vida';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const { hp: GANHO, ticksIntervalo: INTERVALO } = gameData.combate.regeneracao;
const MULT = gameData.combate.multiplicadorHP.valor;

function comSoldado(s: GameState, tipo: string, hp: number | undefined, fsm = 'ocioso'): GameState {
  const t = naVila(0, 8);
  const u: Unidade = {
    lado: LADO_DO_JOGADOR, id: 'ferido', tipo, gx: t.gx, gy: t.gy, fsm, fsmData: {},
    condicao: condicaoCheiaDoTipo(tipo), ...(hp === undefined ? {} : { hp }),
  };
  return { ...s, unidades: { porId: { ...s.unidades.porId, ferido: u }, ordem: [...s.unidades.ordem, 'ferido'] } };
}

/** Anda ate o `ferido` encher; devolve em quantos ticks, e cada HP visto. */
function ateEncher(s0: GameState, teto: number): { readonly ticks: number | null; readonly hps: number[]; readonly final: GameState } {
  let s = s0;
  const hps: number[] = [];
  const maximo = hpMaximoDoTipo((s0.unidades.porId['ferido'] as Unidade).tipo) as number;
  for (let t = 1; t <= teto; t += 1) {
    s = step(s, [], gameData);
    const hp = (s.unidades.porId['ferido'] as Unidade).hp as number;
    if (hps[hps.length - 1] !== hp) hps.push(hp);
    if (hp >= maximo) return { ticks: t, hps, final: s };
  }
  return { ticks: null, hps, final: s };
}

describe('F28c — a regeneracao de HP', () => {
  const base = createInitialState(1);

  it('o HP cheio e o do dado vezes o multiplicador; civil nao tem HP', () => {
    expect(MULT).toBe(2);
    expect(hpMaximoDoTipo('militia')).toBe(3 * MULT);
    expect(hpMaximoDoTipo('serf')).toBeNull();
    const s = comSoldado(base, 'militia', undefined);
    expect(hpDaUnidade(s.unidades.porId['ferido'] as Unidade)).toBe(3 * MULT); // ausente = cheio
  });

  it('o miliciano com 1 HP volta ao cheio no tempo do dado, 1 por intervalo, e nunca passa', () => {
    // o relogio e global: o ferido de agora espera ate o proximo multiplo do intervalo
    const s0 = comSoldado(base, 'militia', 1);
    const r = ateEncher(s0, 20 * INTERVALO);
    const maximo = 3 * MULT;
    expect(r.hps).toEqual(Array.from({ length: maximo }, (_, i) => i + 1)); // 1, 2, ..., cheio
    // do primeiro multiplo do intervalo ate encher: (maximo - 1) / GANHO intervalos
    const primeiro = INTERVALO - (s0.tick % INTERVALO);
    expect(r.ticks).toBe(primeiro + ((maximo - 1) / GANHO - 1) * INTERVALO);
    let s = r.final;
    for (let t = 0; t < 3 * INTERVALO; t += 1) {
      s = step(s, [], gameData);
      expect((s.unidades.porId['ferido'] as Unidade).hp).toBe(maximo);
    }
  });

  it('regenera em luta: quem esta atacando sara no mesmo ritmo', () => {
    const s0 = comSoldado(base, 'militia', 1, 'atacando');
    let s = s0;
    for (let t = 0; t < INTERVALO * 2; t += 1) s = step(s, [], gameData);
    expect((s.unidades.porId['ferido'] as Unidade).hp).toBeGreaterThan(1);
  });

  it('civil e militar cheio passam intocados', () => {
    const s0 = comSoldado(base, 'militia', undefined);
    let s = s0;
    for (let t = 0; t < INTERVALO * 3; t += 1) s = step(s, [], gameData);
    expect((s.unidades.porId['ferido'] as Unidade).hp).toBeUndefined();
    for (const id of base.unidades.ordem) expect(s.unidades.porId[id]?.hp).toBeUndefined();
  });

  it('a mesma corrida duas vezes da o mesmo estado', () => {
    const a = ateEncher(comSoldado(base, 'knight', 1), 30 * INTERVALO).final;
    const b = ateEncher(comSoldado(base, 'knight', 1), 30 * INTERVALO).final;
    expect(salvar(b)).toBe(salvar(a));
  });

  it('a medida pedida pelo operador: o tempo ate encher, nosso contra o KaM', () => {
    // KaM: 1 HP a cada 10 s, HP do Anexo A (o mesmo numero de units.json). Nosso: o
    // mesmo 1 a cada 10 s (escala 1,0), com o HP multiplicado. Tempo em segundos na
    // escala 1,0 — a escala de combate de time.json encurta os dois igual.
    const intervaloBase = 10;
    const tipos = [...gameData.unidades.militares.tipos, ...gameData.unidades.mercenarios.tipos];
    const tabela = tipos.map((t) => {
      const kam = t.hp;
      const nosso = t.hp * MULT;
      return {
        tipo: t.id,
        hpKaM: kam,
        hpNosso: nosso,
        segundosAteEncherKaM: (kam - 1) * intervaloBase,
        segundosAteEncherNosso: (nosso - 1) * intervaloBase,
        fracaoDaVidaPorIntervaloKaM: Math.round((1 / kam) * 1000) / 1000,
        fracaoDaVidaPorIntervaloNosso: Math.round((1 / nosso) * 1000) / 1000,
      };
    });
    const soldado = tabela.find((l) => l.tipo === 'militia');
    expect(soldado).toMatchObject({ segundosAteEncherKaM: 20, segundosAteEncherNosso: 50 });
    gravarEvidencia('F28c', {
      ganhoPorIntervalo: GANHO, intervaloEmTicksNaEscalaDeHoje: INTERVALO, multiplicadorHP: MULT,
      leitura: 'com o HP dobrado, 1 HP a cada 10 s cura METADE da fracao da vida por intervalo; '
        + 'de 1 HP ao cheio leva (2h-1)x10 s contra (h-1)x10 s no KaM. Manter a proporcao do KaM '
        + 'seria 2 HP a cada 10 s (ou 1 a cada 5 s).',
      tabela,
    });
  });
});
