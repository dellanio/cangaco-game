/**
 * F-REPL-b — os dois modos do lenhador (decisao do operador, 2026-09-27): `cortar` e
 * `cortar_e_plantar`, como no KaM (`wcm_Chop`, `wcm_ChopAndPlant`). Padrao: cortar e
 * plantar. `replantar` sozinho saiu: lenhador que so planta nao produz.
 *
 * O aceite, do item no BUILD_PLAN:
 *   - `cortar` reproduz, byte a byte, a corrida contra o dado sem `reposicao`;
 *   - `cortar_e_plantar` e o modo de um predio recem-construido;
 *   - o comando com o valor atual e no-op: devolve o MESMO estado.
 * E o que a memoria "espera indefinida" pede: em `cortar`, toco nao e trabalho nem
 * para o rodizio nem para o alerta.
 *
 * Tudo pelo COMANDO REAL (`SetBuildingMode`), nunca escrevendo `modo` a mao.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState } from '../src/sim/state';
import { receitaDoTipo, semTrabalhoAoAlcance } from '../src/sim/producao';
import { aplicarSetBuildingMode } from '../src/sim/systems/modo';
import { alertasDoEstado } from '../src/sim/selectors';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioOraculo, comEspacoNaSaida } from './helpers/producao-cenario';
import { correr, mataCurta, semReposicao } from './helpers/mata-curta';

const JANELA = 12000;
/** O `cenarioOraculo` nao tem comida: todo civil morre de fome em t12000 (sonda,
 *  2026-09-27, apagada). Corrida que afirma TRABALHO termina antes disso; a que so
 *  compara duas corridas pode ir ate a janela inteira. */
const ANTES_DA_FOME = 11500;
const RECEITA = receitaDoTipo('woodcutters', gameData);
const MODOS = RECEITA?.modos ?? null;
if (RECEITA === null || MODOS === null) throw new Error('fixture: woodcutters precisa de modos');
const RENDIMENTO = gameData.recursos.tipos.tree?.rendimentoPorTile ?? 0;

/** O modo que planta e o que nao planta, achados pelo que FAZEM, nao pelo nome. */
const nomeDoModo = (planta: boolean): string => {
  const achado = Object.entries(MODOS.porModo).find(([, m]) => m.planta === planta);
  if (achado === undefined) throw new Error(`fixture: nenhum modo com planta=${String(planta)}`);
  return achado[0];
};
const CORTAR = nomeDoModo(false);
const CORTAR_E_PLANTAR = nomeDoModo(true);

const modo = (predio: string, m: string): Command => ({ type: 'SetBuildingMode', predio, modo: m });

const modoDe = (s: GameState, id: string): string | undefined => {
  const p = s.predios.porId[id];
  return p?.estado === 'completo' ? p.producao?.modo : undefined;
};

function comPadrao(dados: GameData, padrao: string): GameData {
  const w = dados.producao.receitas.woodcutters;
  if (w?.modos === null || w === undefined) throw new Error('fixture');
  return {
    ...dados,
    producao: {
      ...dados.producao,
      receitas: { ...dados.producao.receitas, woodcutters: { ...w, modos: { ...w.modos, padrao } } },
    },
  };
}

describe('F-REPL-b — o dado', () => {
  it('dois modos, um que planta e um que nao, e o padrao e o que planta', () => {
    expect(Object.keys(MODOS.porModo)).toHaveLength(2);
    expect(MODOS.padrao).toBe(CORTAR_E_PLANTAR);
    expect(Object.keys(MODOS.porModo)).not.toContain('replantar');
  });
});

describe('F-REPL-b — o nascimento', () => {
  it('o lenhador recem-construido nasce no padrao do dado; quem nao tem modos nao ganha o campo', () => {
    const s = cenarioOraculo(gameData);
    expect(modoDe(s, 'w1')).toBe(MODOS.padrao);
    expect(modoDe(s, 'w2')).toBe(MODOS.padrao);
    const q1 = s.predios.porId.q1;
    expect(q1?.estado === 'completo' && q1.producao !== null && 'modo' in q1.producao).toBe(false);
    // o padrao vem do DADO: trocado no dado, o predio nasce no outro
    expect(modoDe(cenarioOraculo(comPadrao(gameData, CORTAR)), 'w1')).toBe(CORTAR);
  });
});

describe('F-REPL-b — o comando `SetBuildingMode`', () => {
  const s = cenarioOraculo(gameData);

  it('troca o modo e nao emite evento proprio', () => {
    const depois = step(s, [modo('w1', CORTAR)], gameData);
    expect(modoDe(depois, 'w1')).toBe(CORTAR);
    expect(modoDe(depois, 'w2')).toBe(MODOS.padrao);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('o modo que o predio ja tem e no-op: devolve o MESMO estado, sem evento', () => {
    const r = aplicarSetBuildingMode(s, { type: 'SetBuildingMode', predio: 'w1', modo: MODOS.padrao }, gameData);
    expect(r.state).toBe(s);
    expect(r.events).toEqual([]);
  });

  it('recusa: inexistente, em obra, sem modos, e modo que nao e dele', () => {
    const recusa = (st: GameState, predio: string, m: string): unknown =>
      step(st, [modo(predio, m)], gameData).events.find((e) => e.type === 'command-rejected');
    const r = (predio: string, motivo: string): unknown =>
      ({ type: 'command-rejected', command: 'SetBuildingMode', predio, motivo });
    expect(recusa(s, 'p999', CORTAR)).toEqual(r('p999', 'predio-inexistente'));
    expect(recusa(s, 'q1', CORTAR)).toEqual(r('q1', 'sem-modos'));
    // os dois nomes que o dado tinha antes da decisao do operador
    expect(recusa(s, 'w1', 'replantar')).toEqual(r('w1', 'modo-invalido'));
    expect(recusa(s, 'w1', 'ambos')).toEqual(r('w1', 'modo-invalido'));
    // chave herdada de Object nao e modo
    expect(recusa(s, 'w1', 'toString')).toEqual(r('w1', 'modo-invalido'));
    const inicial = createInitialState(1);
    const comObra = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }], gameData);
    const obra = comObra.predios.ordem.find((id) => comObra.predios.porId[id]?.estado === 'obra') ?? '';
    expect(obra).not.toBe('');
    expect(recusa(comObra, obra, CORTAR)).toEqual(r(obra, 'predio-em-obra'));
  });
});

describe('F-REPL-b — o que cada modo faz', () => {
  it('`cortar` reproduz, byte a byte e a cada instante, a corrida contra a arvore sem `reposicao`', () => {
    const semRepo = semReposicao(gameData);
    const a = mataCurta(gameData, 2, [modo('w1', CORTAR)]);
    const b = mataCurta(semRepo, 2, [modo('w1', CORTAR)]);
    // o contraste: o modo padrao, com o dado real — este TEM de divergir
    const c = mataCurta(gameData, 2);
    const estadosB: string[] = [];
    const eventosB: string[] = [];
    const amostra = (s: GameState): boolean => s.tick % 100 === 0;
    const rb = correr(b.s, b.tiles, semRepo, JANELA, (s) => {
      eventosB.push(JSON.stringify(s.events));
      if (amostra(s)) estadosB.push(JSON.stringify(s));
    });
    let i = 0;
    let j = 0;
    let divergeEventos = 0;
    let divergeEstados = 0;
    const ra = correr(a.s, a.tiles, gameData, JANELA, (s) => {
      if (JSON.stringify(s.events) !== eventosB[i]) divergeEventos += 1;
      i += 1;
      if (amostra(s)) {
        if (JSON.stringify(s) !== estadosB[j]) divergeEstados += 1;
        j += 1;
      }
    });
    let k = 0;
    let primeiraDivergenciaDoPadrao: number | null = null;
    const rc = correr(c.s, c.tiles, gameData, JANELA, (s) => {
      if (amostra(s)) {
        if (primeiraDivergenciaDoPadrao === null && JSON.stringify(s) !== estadosB[k]) primeiraDivergenciaDoPadrao = s.tick;
        k += 1;
      }
    });
    expect(j).toBeGreaterThan(0);
    expect({ divergeEventos, divergeEstados }).toEqual({ divergeEventos: 0, divergeEstados: 0 });
    expect(JSON.stringify(ra.final)).toBe(JSON.stringify(rb.final));
    expect(ra.troncos).toBe(a.tiles.length * RENDIMENTO);
    expect(ra.replantios).toBe(0);
    // prova de que a comparacao acusa: o padrao, no mesmo cenario, diverge e da mais
    expect(primeiraDivergenciaDoPadrao).not.toBeNull();
    expect(rc.troncos).toBeGreaterThan(ra.troncos);
    gravarEvidencia('F-REPL-b', {
      _doc: 'F-REPL-b — os dois modos. w1 do cenarioOraculo, mata de 2 tiles, w2 pausado, gaveta esvaziada. Estado comparado a cada 100 ticks e no fim; eventos a cada tick.',
      janela: JANELA,
      modos: MODOS,
      cortar: { troncos: ra.troncos, replantios: ra.replantios, semAdulta: ra.semAdulta },
      cortarContraSemReposicao: { divergeEventos, divergeEstados, amostras: j },
      cortarEPlantar: { troncos: rc.troncos, replantios: rc.replantios, primeiraDivergenciaDoPadrao },
    });
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 3,4 s
    // isolado (2026-09-29); o limite e ~5x.
  }, 20_000);

  it('em `cortar`, toco nao e trabalho nem para o alerta: o predio se declara esgotado; de volta ao padrao, replanta', () => {
    // anda ate o `vein-exhausted` de w1: em `cortar` a mata de 2 tiles acaba
    const curta = mataCurta(gameData, 2, [modo('w1', CORTAR)]);
    const { tiles } = curta;
    let { s } = curta;
    let esgotou = false;
    for (let i = 0; i < ANTES_DA_FOME && !esgotou; i += 1) {
      s = comEspacoNaSaida(step(s, [], gameData), 'w1');
      esgotou = s.events.some((e) => e.type === 'vein-exhausted' && e.predio === 'w1');
    }
    expect(esgotou).toBe(true);
    const w1 = s.predios.porId.w1;
    if (w1?.estado !== 'completo' || RECEITA === null) throw new Error('fixture');
    expect(semTrabalhoAoAlcance(s, w1, RECEITA, gameData)).toBe(true);
    // o mesmo instante, no modo que planta: os tocos sao trabalho
    const devolta = aplicarSetBuildingMode(s, { type: 'SetBuildingMode', predio: 'w1', modo: CORTAR_E_PLANTAR }, gameData).state;
    const w1b = devolta.predios.porId.w1;
    if (w1b?.estado !== 'completo') throw new Error('fixture');
    expect(semTrabalhoAoAlcance(devolta, w1b, RECEITA, gameData)).toBe(false);
    // o HUD: esgotado em `cortar` e `veio-esgotado` (a mata acabou e ele nao a
    // repoe), nunca `sem-campo`; no modo que planta, com tocos, nenhum dos dois
    const causasDeW1 = (st: GameState): readonly string[] =>
      alertasDoEstado(st, gameData).filter((al) => al.predio === 'w1').map((al) => al.causa);
    expect(causasDeW1(s)).toContain('veio-esgotado');
    expect(causasDeW1(s)).not.toContain('sem-campo');
    expect(causasDeW1(devolta)).not.toContain('veio-esgotado');
    expect(causasDeW1(devolta)).not.toContain('sem-campo');
    // e o lenhador volta a entregar, antes de o cenario morrer de fome
    const rb = correr(devolta, tiles, gameData, ANTES_DA_FOME - devolta.tick);
    expect(rb.replantios).toBeGreaterThan(0);
    expect(rb.troncos).toBeGreaterThan(0);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 1,2 s
    // isolado (2026-09-29); o limite e ~5x.
  }, 10_000);

  it('trocar para `cortar` no meio de um plantio: a viagem termina, a reserva se solta, e nao planta mais', () => {
    let { s } = mataCurta(gameData, 2);
    const plantio = (st: GameState): unknown => {
      const p = st.predios.porId.w1;
      return p?.estado === 'completo' ? p.producao?.plantio ?? null : null;
    };
    for (let i = 0; i < 20000 && plantio(s) === null; i += 1) s = comEspacoNaSaida(step(s, [], gameData), 'w1');
    expect(plantio(s)).not.toBeNull();
    s = step(s, [modo('w1', CORTAR)], gameData);
    let soltou = 0;
    for (let i = 0; i < 3000 && plantio(s) !== null; i += 1) {
      s = comEspacoNaSaida(step(s, [], gameData), 'w1');
      soltou = s.tick;
    }
    expect(plantio(s)).toBeNull();
    expect(soltou).toBeGreaterThan(0);
    // a arvore plantada na viagem amadurece e e cortada: o lenhador esta vivo e
    // trabalhando na janela, e mesmo assim nao replanta
    const depois = correr(s, mataCurta(gameData, 2).tiles, gameData, ANTES_DA_FOME - s.tick);
    expect(depois.troncos).toBeGreaterThan(0);
    expect(depois.replantios).toBe(0);
    expect(depois.dentroDaArvore).toBe(0);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 1,2 s
    // isolado (2026-09-29); o limite e ~5x.
  }, 10_000);
});
