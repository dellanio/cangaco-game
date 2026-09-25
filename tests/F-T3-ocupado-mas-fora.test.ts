/**
 * F-T3, aceite 2 — OCUPADO, MAS FORA.
 *
 * O especialista saiu do predio e o predio continua sendo dele. Isso cria um
 * estado que nao existia antes da F-T3 — ocupante ausente do footprint — e tres
 * perguntas que o plano fez antes de escrever codigo (`docs/planos/F-T3-*.md`):
 *
 *   1. o painel continua dizendo quem trabalha ali? SIM: a posse mora no predio.
 *   2. o alerta `sem-trabalhador` dispara? NAO: ele le `ocupante`, e o ocupante
 *      esta la — apenas na roca.
 *   3. e se o predio for demolido com ele em campo? Ele fica `ocioso` ONDE ESTA,
 *      sem tarefa presa e sem uma pedra a menos no lajedo.
 *
 * Mais os dois casos de borda das decisoes do plano: D6, pausar com ele fora
 * (congela onde esta), e D7, o caminho de volta desaparecer (a posse se desfaz
 * dos dois lados, e ninguem fica preso num tile).
 *
 * As invariantes novas entram aqui tambem pelo lado que importa — provando que
 * ACUSAM. Guarda que so diz "nao vi problema" nao e guarda.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto, TarefaColher, Unidade } from '../src/sim/state';
import { ehTarefaDeColheita } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { alertasDoEstado, painelDoPredio } from '../src/sim/selectors';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { caixaDoPredio } from '../src/sim/footprint';
import { avancar, cenarioDePedreira, fsmDe, progressoDe, semAUnidade, semOcupante } from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao esta completo`);
  return p;
}

function unidadeDe(estado: GameState, id: string): Unidade {
  const u = estado.unidades.porId[id];
  if (u === undefined) throw new Error(`fixture: a unidade '${id}' nao existe`);
  return u;
}

/** Distancia de Chebyshev ao footprint: 0 dentro, 1 na porta, mais que isso em
 *  campo aberto. E a medida de "fora" que o aceite 2 discute. */
function distanciaAoPredio(estado: GameState, unidadeId: string, predioId: string): number {
  const u = unidadeDe(estado, unidadeId);
  const caixa = caixaDoPredio(predioDe(estado, predioId), DADOS);
  if (caixa === null) throw new Error('fixture: predio sem footprint');
  return Math.max(
    Math.max(caixa.x0 - u.gx, 0, u.gx - (caixa.x1 - 1)),
    Math.max(caixa.y0 - u.gy, 0, u.gy - (caixa.y1 - 1)),
  );
}

const dentroDoFootprint = (estado: GameState, unidadeId: string, predioId: string): boolean =>
  distanciaAoPredio(estado, unidadeId, predioId) === 0;

function tarefasDeColheita(estado: GameState): readonly TarefaColher[] {
  return estado.jobs.tarefas.ordem.flatMap((id) => {
    const t = estado.jobs.tarefas.porId[id];
    return t !== undefined && ehTarefaDeColheita(t) ? [t] : [];
  });
}

function tarefaDe(estado: GameState, unidadeId: string): TarefaColher {
  const t = tarefasDeColheita(estado).find((x) => x.reclamadaPor === unidadeId);
  if (t === undefined) throw new Error(`fixture: '${unidadeId}' nao segura tarefa de colheita`);
  return t;
}

/**
 * Roda o cenario da pedreira ate o pedreiro estar EM CAMPO no sentido forte: em
 * `indo_colher` e a mais de um tile do footprint, isto e, fora tambem da porta.
 * O tick nao esta digitado: o que interessa e a CONDICAO, e ela e verificada.
 */
function emCampo(estado: GameState): GameState {
  let s = estado;
  for (let i = 1; i <= 60; i += 1) {
    s = step(s, [], DADOS);
    if (fsmDe(s, 'u1') === 'indo_colher' && distanciaAoPredio(s, 'u1', 'q1') > 1) return s;
  }
  throw new Error('fixture: o pedreiro nao chegou a sair da porta em 60 ticks');
}

/** Troca a FSM de uma unidade a mao — para os testes que provam que o guarda acusa. */
function comFsmDaUnidade(
  estado: GameState, id: string, fsm: string, fsmData: Unidade['fsmData'],
): GameState {
  const u = unidadeDe(estado, id);
  return {
    ...estado,
    unidades: { ...estado.unidades, porId: { ...estado.unidades.porId, [id]: { ...u, fsm, fsmData } } },
  };
}

/**
 * Arvores EM PE em toda a porta do predio: `bloqueiaPasso` esta no dado do
 * `tree` (`data/resources.json`), e o A* passa a nao achar caminho nenhum de
 * volta. E o cenario da D7 sem nenhuma regra nova — o mesmo bloqueio que uma
 * mata fechada produziria em jogo.
 */
function comMataNaPorta(estado: GameState, predioId: string): GameState {
  const recursos = { ...estado.recursos };
  for (const tile of tilesDaPorta(predioDe(estado, predioId), DADOS)) {
    recursos[chaveDeTile(tile)] = { tipo: 'tree', quantidade: 1 };
  }
  return { ...estado, recursos };
}

/** As causas de UM predio, do seletor de verdade: o teste nao reimplementa a
 *  derivacao que quer verificar. */
const causasDe = (estado: GameState, id: string): readonly string[] =>
  alertasDoEstado(estado, DADOS).filter((a) => a.predio === id).map((a) => a.causa);

describe('F-T3 — o guarda ACUSA o especialista em campo fora da regra', () => {
  it('acusa quem esta em campo sem predio que o reconheca', () => {
    const estado = semOcupante(emCampo(cenarioDePedreira(DADOS)), 'q1');
    expect(violacoesDaFsmDoEspecialista(estado, DADOS).join(' ')).toContain('sem predio que o reconheca');
  });

  it('acusa `indo_colher` parado longe do tile sem caminho nenhum', () => {
    // O travamento silencioso: caminho vazio, longe do tile, e o tick da chegada
    // nunca vem. Nenhuma contagem de tarefa pega isso — so a posicao pega.
    const estado = comFsmDaUnidade(emCampo(cenarioDePedreira(DADOS)), 'u1', 'indo_colher', {});
    const acusacoes = violacoesDaFsmDoEspecialista(estado, DADOS).join(' ');
    expect(acusacoes).toContain('indo_colher sem caminho');
  });

  it('acusa `voltando` parado longe da porta sem caminho nenhum', () => {
    const estado = comFsmDaUnidade(emCampo(cenarioDePedreira(DADOS)), 'u1', 'voltando', {});
    expect(violacoesDaFsmDoEspecialista(estado, DADOS).join(' ')).toContain('voltando sem caminho');
  });

  it('acusa quem colhe longe do tile que reclamou', () => {
    const emCurso = emCampo(cenarioDePedreira(DADOS));
    const tarefa = tarefaDe(emCurso, 'u1');
    const estado = comFsmDaUnidade(emCurso, 'u1', 'colhendo', { tarefa: tarefa.id });
    expect(violacoesDaFsmDoEspecialista(estado, DADOS).join(' ')).toContain('colhendo a ');
  });

  it('e nao acusa a trilha de verdade: o ciclo inteiro passa calado', () => {
    // A contraparte obrigatoria dos quatro acima. Sem ela, um guarda que acusasse
    // tudo passaria nos quatro e nao serviria para nada.
    let s = cenarioDePedreira(DADOS);
    for (let i = 1; i <= 300; i += 1) {
      s = step(s, [], DADOS);
      expect(violacoesDaFsmDoEspecialista(s, DADOS), `tick ${i}`).toEqual([]);
    }
  });
});

describe('F-T3 — aceite 2: ocupado, mas fora', () => {
  it('1. o painel continua dizendo quem trabalha ali', () => {
    const estado = emCampo(cenarioDePedreira(DADOS));
    expect(painelDoPredio(estado, 'q1', DADOS)?.ocupante).toEqual({ unidade: 'u1', tipo: 'stonemason' });
    expect(fsmDe(estado, 'u1')).toBe('indo_colher');
    // e ele esta MESMO fora: fora do footprint e fora da porta.
    expect(dentroDoFootprint(estado, 'u1', 'q1')).toBe(false);
    expect(distanciaAoPredio(estado, 'u1', 'q1')).toBeGreaterThan(1);
  });

  it('2. o alerta sem-trabalhador NAO dispara com o ocupante em campo', () => {
    const estado = emCampo(cenarioDePedreira(DADOS));
    expect(causasDe(estado, 'q1')).not.toContain('sem-trabalhador');
    // e a contraparte: some a UNIDADE e o alerta acende. Sem isto o teste acima
    // provaria so que este alerta nunca dispara neste cenario.
    const semEle = step(semAUnidade(estado, 'u1'), [], DADOS);
    expect(causasDe(semEle, 'q1')).toContain('sem-trabalhador');
  });

  it('3. demolir com ele em campo: ocioso onde esta, sem tarefa presa, lajedo intacto', () => {
    const estado = emCampo(cenarioDePedreira(DADOS));
    const antes = unidadeDe(estado, 'u1');
    const tile = chaveDeTile(tarefaDe(estado, 'u1').origemTile);
    const quantidadeAntes = estado.recursos[tile]?.quantidade;
    expect(quantidadeAntes).toBeGreaterThan(0);

    const depois = step(estado, [{ type: 'DemolishBuilding', predio: 'q1' }], DADOS);
    const u = unidadeDe(depois, 'u1');
    expect(u.fsm).toBe('ocioso');
    expect(u.fsmData).toEqual({});
    expect({ gx: u.gx, gy: u.gy }).toEqual({ gx: antes.gx, gy: antes.gy });
    // nenhuma tarefa presa e nenhuma pedra cobrada por um ciclo que nao fechou
    expect(tarefasDeColheita(depois)).toEqual([]);
    expect(depois.recursos[tile]?.quantidade).toBe(quantidadeAntes);
    expect(violacoesDeInvariantes(depois, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois, DADOS)).toEqual([]);
  });
});

describe('F-T3 — as duas bordas das decisoes do plano', () => {
  it('D6 — predio pausado congela ele onde esta, sem meio passo', () => {
    const emCurso = emCampo(cenarioDePedreira(DADOS));
    const pausado = step(emCurso, [{ type: 'SetBuildingPaused', predio: 'q1', pausado: true }], DADOS);
    const antes = unidadeDe(pausado, 'u1');
    const relogioAntes = progressoDe(pausado, 'q1');

    const depois = avancar(pausado, 30, DADOS);
    const u = unidadeDe(depois, 'u1');
    expect({ gx: u.gx, gy: u.gy, fsm: u.fsm }).toEqual({ gx: antes.gx, gy: antes.gy, fsm: antes.fsm });
    expect(progressoDe(depois, 'q1')).toBe(relogioAntes);
    // nem meio passo: `progresso` de `fsmData` e o tick dentro do passo atual
    expect(u.fsmData.progresso).toBe(antes.fsmData.progresso);
    expect(u.fsmData.caminho).toEqual(antes.fsmData.caminho);
    // o predio continua sendo dele, e o tile NAO: a pausa devolveu o lajedo
    expect(predioDe(depois, 'q1').ocupante).toBe('u1');
    expect(tarefasDeColheita(depois)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois, DADOS)).toEqual([]);
  });

  it('D7 — sem caminho de volta, a posse se desfaz dos dois lados', () => {
    const emCurso = comMataNaPorta(emCampo(cenarioDePedreira(DADOS)), 'q1');
    // um ciclo inteiro e mais: ele colhe, tenta voltar, e nao ha por onde.
    const depois = avancar(emCurso, 300, DADOS);
    expect(fsmDe(depois, 'u1')).toBe('ocioso');
    expect(unidadeDe(depois, 'u1').fsmData).toEqual({});
    expect(predioDe(depois, 'q1').ocupante).toBeNull();
    expect(causasDe(depois, 'q1')).toContain('sem-trabalhador');
    // e nada ficou preso: nem tarefa, nem relogio de ciclo pela metade
    expect(tarefasDeColheita(depois)).toEqual([]);
    expect(progressoDe(depois, 'q1')).toBe(0);
    expect(violacoesDeInvariantes(depois, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(depois, DADOS)).toEqual([]);
  });
});

describe('F-T3 — evidencia do aceite 2', () => {
  it('grava test-output/F-T3-ocupado-mas-fora.json', () => {
    const estado = emCampo(cenarioDePedreira(DADOS));
    const u = unidadeDe(estado, 'u1');
    const demolido = step(estado, [{ type: 'DemolishBuilding', predio: 'q1' }], DADOS);
    const pausado = avancar(
      step(estado, [{ type: 'SetBuildingPaused', predio: 'q1', pausado: true }], DADOS), 30, DADOS,
    );
    const semVolta = avancar(comMataNaPorta(estado, 'q1'), 300, DADOS);
    gravarEvidencia('F-T3-ocupado-mas-fora', {
      feature: 'F-T3-especialista-sai',
      aceite: 'aceite 2 do plano: ocupado mas fora — painel, alerta e demolicao com ele em campo',
      emCampo: {
        tick: estado.tick,
        fsm: u.fsm,
        onde: { gx: u.gx, gy: u.gy },
        distanciaAoFootprint: distanciaAoPredio(estado, 'u1', 'q1'),
        tileDaTarefa: chaveDeTile(tarefaDe(estado, 'u1').origemTile),
        painelOcupante: painelDoPredio(estado, 'q1', DADOS)?.ocupante ?? null,
        alertasDoPredio: causasDe(estado, 'q1'),
      },
      demolidoComEleFora: {
        fsm: fsmDe(demolido, 'u1'),
        onde: { gx: unidadeDe(demolido, 'u1').gx, gy: unidadeDe(demolido, 'u1').gy },
        tarefasDeColheita: tarefasDeColheita(demolido).length,
        lajedo: demolido.recursos[chaveDeTile(tarefaDe(estado, 'u1').origemTile)]?.quantidade ?? null,
      },
      d6_pausadoEmCampo: {
        fsm: fsmDe(pausado, 'u1'),
        onde: { gx: unidadeDe(pausado, 'u1').gx, gy: unidadeDe(pausado, 'u1').gy },
        progressoDoCiclo: progressoDe(pausado, 'q1'),
        tarefasDeColheita: tarefasDeColheita(pausado).length,
        nota: 'congela onde esta; o tile volta ao conjunto livre porque a pausa cancela a tarefa (F16c)',
      },
      d7_semCaminhoDeVolta: {
        fsm: fsmDe(semVolta, 'u1'),
        ocupanteDoPredio: predioDe(semVolta, 'q1').ocupante,
        alertasDoPredio: causasDe(semVolta, 'q1'),
        nota: 'mata em pe na porta inteira: o A* nao acha volta e a posse se desfaz dos dois lados',
      },
    });
    expect(violacoesDaFsmDoEspecialista(estado, DADOS)).toEqual([]);
  });
});
