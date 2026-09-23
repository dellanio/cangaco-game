import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameEvent, GameState, PredioEmObra, Tarefa } from '../src/sim/state';
import { completarObra } from '../src/sim/state';
import { step } from '../src/sim/tick';
import {
  alvoDeNivelamento, entreguesNaObra, hpTotalDoTipo, obraNivelada, obraTrabalhavel, tetoDeHp,
} from '../src/sim/obra';
import { criarTarefaDeConstrucao, reclamar, tarefasDeConstrucaoEmOrdem, TIPO_QUE_CONSTROI } from '../src/sim/jobs';
import { gerarTarefas } from '../src/sim/systems/jobs';
import { tilesDaPorta } from '../src/sim/estradas';
import {
  armazemDoCenario, comEstradas, comObra, comTarefas, comUnidadeEm, inicial, laborersDoCenario, linhaH, linhaV,
  semAUnidade, semOPredio, serfsDoCenario, tarefaDe, tile,
} from './helpers/jobs-cenario';
import { ate, liberacoes } from './helpers/serf-cenario';
import { bensPorMercadoria, violacoesDaFsm } from './helpers/serf-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { gravarEvidencia } from './helpers/evidence';

/** So para este arquivo: muda o `hp` (o martelado) de uma obra, sem tocar no resto. */
function comHp(estado: GameState, id: string, hp: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'obra') throw new Error(`fixture: '${id}' nao e uma obra`);
  const novo: PredioEmObra = { ...p, hp };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/*
 * A TOLERANCIA SAIU (BUG-001, 2026-09-23). Ate aqui existia um
 * `violacoesInesperadas` que deixava passar UMA forma de violacao: tarefa
 * 'construir' apontando para predio ja `completo`, o residuo de um tick entre a
 * conclusao da obra e o `sanearTarefas` do tick seguinte. Agora a conclusao
 * cancela as irmas no mesmo tick (`cancelarConstrucoesDe`), entao
 * `violacoesDeInvariantes` vale INTEIRO aqui, sem filtro — que e o ponto: o
 * verificador voltou a poder acusar essa forma, e ha um teste que prova que ele
 * acusa ("prova do guarda", no describe do BUG-001).
 */

describe('F11c — alvoDeNivelamento', () => {
  it('quarry (3x2 tiles, 10 ticks/tile): 60', () => {
    expect(alvoDeNivelamento('quarry')).toBe(60);
  });
});

describe('F11c — entreguesNaObra e tetoDeHp', () => {
  it('nada entregue (faltam === custo): entregues 0, teto 0', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 } });
    const obra = estado.predios.porId['obra-a'] as PredioEmObra;
    expect(entreguesNaObra(obra)).toBe(0);
    expect(tetoDeHp(obra)).toBe(0);
  });

  it('tudo entregue (faltam vazio): entregues 5, teto 250 (o hp total do quarry)', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const obra = estado.predios.porId['obra-a'] as PredioEmObra;
    expect(entreguesNaObra(obra)).toBe(5);
    expect(hpTotalDoTipo('quarry')).toBe(250);
    expect(tetoDeHp(obra)).toBe(250);
  });
});

describe('F11c — obraNivelada', () => {
  it('nivelamento 0: nao nivelada; no alvo: nivelada', () => {
    const zerada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {}, nivelamento: 0 });
    expect(obraNivelada(zerada.predios.porId['obra-a'] as PredioEmObra)).toBe(false);
    const nivelada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }); // default: ja nivelada
    expect(obraNivelada(nivelada.predios.porId['obra-a'] as PredioEmObra)).toBe(true);
  });
});

describe('F11c — obraTrabalhavel: uma clausula por vez', () => {
  it('nao nivelada, sem tarefa nenhuma: true (ha o que nivelar)', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 }, nivelamento: 0 });
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });

  it('nivelada, hp < teto, sem tarefa: true (ha o que martelar)', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }); // ja nivelada, hp 0, teto 250
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });

  it("nivelada, hp === teto, com tarefa de material 'carregando': true (material a caminho)", () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    estado = comTarefas(estado, [{
      id: 't1', numero: 1, tipo: 'material-para-obra', mercadoria: 'stone',
      origem: armazemDoCenario(inicial).id, destino: 'obra-a', estado: 'carregando', reclamadaPor: 'u1',
    }]);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });

  it('nivelada, hp === teto, SEM tarefa de material: false (nada a fazer)', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(false);
  });

  it('false volta a true assim que uma tarefa de material nasce para a obra', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(false);
    estado = comTarefas(estado, [tarefaDe({ numero: 1, destino: 'obra-a' })]);
    expect(obraTrabalhavel(estado, 'obra-a')).toBe(true);
  });
});

describe('F11c — Obra.nivelamento sobrevive ao JSON', () => {
  it('ida e volta preserva o campo', () => {
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 1 }, nivelamento: 12 });
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
    expect((estado.predios.porId['obra-a'] as PredioEmObra).obra.nivelamento).toBe(12);
  });
});

describe('F11c — jobs.ts: o laborer acha e reclama tarefa (Task 4)', () => {
  it('laborer numa ilha, sem caminho a pe: sem-caminho', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 } });
    // o mesmo cerco da F10 (F10-desempate.test.ts): laborer em (0,0), fechado por
    // duas obras que ocupam (1,0) e (0,1) — sem ligacao a nenhuma porta de 'obra-a'.
    estado = comObra(estado, 'cerca1', { gx: 1, gy: 0, faltam: {} });
    estado = comObra(estado, 'cerca2', { gx: 0, gy: 1, faltam: {} });
    estado = comUnidadeEm(estado, laborer1, 0, 0);
    const { state, id } = criarTarefaDeConstrucao(estado, 'obra-a');
    expect(reclamar(state, id, laborer1)).toEqual({ ok: false, motivo: 'sem-caminho' });
  });

  it('laborer com caminho livre ate a porta: ok', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    // faltam {}: ja tudo entregue, hp 0 < teto 250 — ha o que martelar (obraTrabalhavel).
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const { state, id } = criarTarefaDeConstrucao(estado, 'obra-a');
    expect(reclamar(state, id, laborer1).ok).toBe(true);
  });

  it('obra nivelada, no teto, SEM tarefa de material: destino-sem-trabalho, e nem entra na ordenacao', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }); // ja nivelada (default)
    estado = comHp(estado, 'obra-a', 250); // no teto, sem tarefa de material
    const { state, id } = criarTarefaDeConstrucao(estado, 'obra-a');
    expect(reclamar(state, id, laborer1)).toEqual({ ok: false, motivo: 'destino-sem-trabalho' });
    expect(tarefasDeConstrucaoEmOrdem(state, laborer1).map((t) => t.id)).toEqual([]);
  });

  it('tarefasDeConstrucaoEmOrdem ordena pela obra mais perto', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    let estado = comObra(inicial, 'perto', { gx: 30, gy: 35, faltam: {} }); // trabalhavel: hp 0 < teto
    estado = comObra(estado, 'longe', { gx: 30, gy: 60, faltam: {} });
    estado = comUnidadeEm(estado, laborer1, 30, 34);
    const { state: comA, id: idPerto } = criarTarefaDeConstrucao(estado, 'perto');
    const { state: comAmbas, id: idLonge } = criarTarefaDeConstrucao(comA, 'longe');
    expect(tarefasDeConstrucaoEmOrdem(comAmbas, laborer1).map((t) => t.id)).toEqual([idPerto, idLonge]);
  });

  it('desempata por numero quando o custo e igual (duas tarefas para a mesma obra)', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const { state: comUma, id: primeira } = criarTarefaDeConstrucao(estado, 'obra-a');
    const { state: comDuas, id: segunda } = criarTarefaDeConstrucao(comUma, 'obra-a');
    expect(tarefasDeConstrucaoEmOrdem(comDuas, laborer1).map((t) => t.id)).toEqual([primeira, segunda]);
  });

  it('um serf continua recusado com unidade-invalida', () => {
    const [serf1] = serfsDoCenario(inicial);
    if (!serf1) throw new Error('fixture: sem serf');
    const estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const { state, id } = criarTarefaDeConstrucao(estado, 'obra-a');
    expect(reclamar(state, id, serf1)).toEqual({ ok: false, motivo: 'unidade-invalida' });
  });
});

describe('F11c — completarObra', () => {
  it('quarry nivelado e martelado ao teto vira completo, com capacidade/estoque do tipo', () => {
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    estado = comHp(estado, 'obra-a', 250);
    const obra = estado.predios.porId['obra-a'] as PredioEmObra;
    const completo = completarObra(obra);
    expect(completo).toEqual({
      id: 'obra-a', tipo: 'quarry', gx: 26, gy: 34, estado: 'completo', hp: 250,
      capacidade: gameData.producao.estoqueInternoPorPredio,
      estoque: { entrada: {}, saida: {} },
      ocupante: null,
      pausado: false,
      producao: { progresso: 0, veio: gameData.producao.receitas.quarry?.rendimentoDoVeio },
    });
  });

  it('storehouse completado recebe a capacidade do armazem, sem estoque', () => {
    const obra: PredioEmObra = {
      id: 'obra-b', tipo: 'storehouse', gx: 10, gy: 10, estado: 'obra', hp: 1,
      obra: { faltam: {}, nivelamento: alvoDeNivelamento('storehouse') },
    };
    const completo = completarObra(obra);
    expect(completo.estado).toBe('completo');
    expect(completo.capacidade).toEqual({
      entrada: gameData.economia.storehouse.capacidade, saida: gameData.economia.storehouse.capacidade,
    });
    expect(completo.estoque).toEqual({ entrada: {}, saida: {} });
  });
});

describe('F11c — sistemaDosLaborers (Task 5)', () => {
  it('um laborer nivela um quarry do zero: nivelamento sobe 1 por tick, leva alvoDeNivelamento ticks', () => {
    const [laborer1, laborer2] = laborersDoCenario(inicial);
    if (!laborer1 || !laborer2) throw new Error('fixture: precisa de 2 laborers');
    const estado = semAUnidade(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: 0 }),
      laborer2, // so um laborer, para medir o nivelamento sozinho
    );
    const alvo = alvoDeNivelamento('quarry');

    let atual = estado;
    let ticksNivelando = 0;
    let fsmAoNivelar = '';
    // sem horizonte fixo: a viagem do spawn padrao at a porta do quarry NAO e 1 tick por
    // tile (custoDoPasso em modo 'livre' custa mais que isso) — 800 e so a rede de
    // seguranca, o mesmo `maximo` default de `ate` (serf-cenario.ts).
    for (let i = 0; i < 800 && fsmAoNivelar === ''; i += 1) {
      atual = step(atual, []);
      const u = atual.unidades.porId[laborer1];
      if (u?.fsm === 'nivelando') ticksNivelando += 1;
      const obra = atual.predios.porId['obra-a'] as PredioEmObra;
      if (obra.obra.nivelamento === alvo) fsmAoNivelar = u?.fsm ?? '';
    }
    expect(fsmAoNivelar).not.toBe('');
    expect(ticksNivelando).toBe(alvo);
    // sem estrada nem armazem ligado: nada a martelar assim que nivela — so esperar material.
    expect(fsmAoNivelar).toBe('esperando_material');
  });

  it('dois laborers nivelam juntos em metade do tempo (a dobra sequencial soma no mesmo tick), sem nunca passar do alvo', () => {
    const [laborer1, laborer2] = laborersDoCenario(inicial);
    if (!laborer1 || !laborer2) throw new Error('fixture: precisa de 2 laborers');
    // o spawn padrao poe os dois laborers 1 tile apart — chegam em ticks diferentes, o que
    // faz um nivelar sozinho por um tempo antes do outro se juntar (nao 'metade do tempo'
    // certinho). Poe os dois JA na porta, no MESMO tile: nao ha checagem de ocupacao de
    // tile por unidade (pathfinding.ts:tileAndavel), e assim os dois chegam no mesmo tick.
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: 0 });
    const alvo = alvoDeNivelamento('quarry');
    const porta = tilesDaPorta(estado.predios.porId['obra-a'] as PredioEmObra)[0];
    if (!porta) throw new Error('fixture: obra sem porta');
    estado = comUnidadeEm(estado, laborer1, porta.gx, porta.gy);
    estado = comUnidadeEm(estado, laborer2, porta.gx, porta.gy);

    let atual = estado;
    let nivelamentoAnterior = 0;
    let ticksQueSubiram = 0; // conta os ticks em que `nivelamento` de fato avancou —
    // nao "desde a chegada": o tick em que `indo_a_obra` vira `nivelando` (reavaliar) ainda
    // nao soma nada; o incremento so comeca no tick seguinte.
    let fimDoNivelamento = -1;
    let maximoVisto = 0;
    // sem horizonte fixo (ver o comentario do teste anterior): 800 e a rede de seguranca.
    for (let i = 0; i < 800 && fimDoNivelamento === -1; i += 1) {
      atual = step(atual, []);
      const obra = atual.predios.porId['obra-a'] as PredioEmObra;
      maximoVisto = Math.max(maximoVisto, obra.obra.nivelamento);
      if (obra.obra.nivelamento > nivelamentoAnterior) ticksQueSubiram += 1;
      nivelamentoAnterior = obra.obra.nivelamento;
      if (obra.obra.nivelamento === alvo) fimDoNivelamento = atual.tick;
    }
    expect(fimDoNivelamento).toBeGreaterThan(-1);
    // uma folga depois do alvo, so para confirmar que o nivelamento fica capado (obra.ts):
    // ele e monotonico, entao alguns ticks extras bastam para provar que nao passa.
    for (let i = 0; i < 10; i += 1) {
      atual = step(atual, []);
      const obra = atual.predios.porId['obra-a'] as PredioEmObra;
      maximoVisto = Math.max(maximoVisto, obra.obra.nivelamento);
    }
    expect(maximoVisto).toBe(alvo); // nunca passa do alvo, nem com dois somando no mesmo tick
    expect(ticksQueSubiram).toBe(alvo / 2); // dois laborers somam 2/tick: metade dos ticks de um so
  });

  it('esperando_material volta a martelando quando o material chega (o teto sobe)', () => {
    const [laborer1, laborer2] = laborersDoCenario(inicial);
    if (!laborer1 || !laborer2) throw new Error('fixture: precisa de 2 laborers');
    // ja nivelada (default do helper); falta so 1 pedra: entregues 4, teto 200.
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 1 } });
    estado = comEstradas(estado, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
    estado = comHp(estado, 'obra-a', 200); // ja no teto atual: nao ha o que martelar agora
    estado = semAUnidade(estado, laborer2); // isola um laborer, para nao adiantar o hp
    // do spawn padrao, a viagem em modo 'livre' e mais lenta que a entrega do serf por
    // estrada — o laborer chegaria DEPOIS da pedra, pulando esperando_material direto para
    // martelando. Poe-lo ja na porta: garante que ele espera antes da pedra chegar.
    const porta = tilesDaPorta(estado.predios.porId['obra-a'] as PredioEmObra)[0];
    if (!porta) throw new Error('fixture: obra sem porta');
    estado = comUnidadeEm(estado, laborer1, porta.gx, porta.gy);

    const emEspera = ate(
      estado, (e) => e.unidades.porId[laborer1]?.fsm === 'esperando_material', 'laborer chega e espera a pedra',
    );
    expect((emEspera.predios.porId['obra-a'] as PredioEmObra).hp).toBe(200); // ainda nao martelou

    const martelandoDeNovo = ate(
      emEspera, (e) => e.unidades.porId[laborer1]?.fsm === 'martelando', 'a pedra chega, o teto sobe, volta a martelar',
    );
    const obraDepois = martelandoDeNovo.predios.porId['obra-a'] as PredioEmObra;
    expect(obraDepois.obra.faltam.stone ?? 0).toBe(0); // so virou martelando depois da pedra entregue
    expect(obraDepois.hp).toBe(200); // acabou de trocar de estado; ainda nao martelou de novo
  });

  it('hp sobe hpPorMartelada em hpPorMartelada, a cada ticksPorMartelada ticks', () => {
    const [laborer1, laborer2] = laborersDoCenario(inicial);
    if (!laborer1 || !laborer2) throw new Error('fixture: precisa de 2 laborers');
    // ja nivelada, tudo entregue (faltam {}): teto 250, o hp total do quarry.
    const estado = semAUnidade(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), laborer2);
    const { ticksPorMartelada, hpPorMartelada } = gameData.construcao;

    let atual = ate(estado, (e) => e.unidades.porId[laborer1]?.fsm === 'martelando', 'laborer chega e comeca a martelar');
    let hpAnterior = (atual.predios.porId['obra-a'] as PredioEmObra).hp;
    expect(hpAnterior).toBe(0);

    for (let martelada = 0; martelada < 4; martelada += 1) {
      for (let t = 0; t < ticksPorMartelada - 1; t += 1) {
        atual = step(atual, []);
        expect((atual.predios.porId['obra-a'] as PredioEmObra).hp).toBe(hpAnterior); // martelada em curso
      }
      atual = step(atual, []); // o tick que completa a martelada
      const hpAtual = (atual.predios.porId['obra-a'] as PredioEmObra).hp;
      expect(hpAtual).toBe(hpAnterior + hpPorMartelada);
      hpAnterior = hpAtual;
    }
  });

  it('obra demolida no meio libera a tarefa (destino-sumiu) e o laborer volta a ocioso no tick seguinte', () => {
    const [laborer1, laborer2] = laborersDoCenario(inicial);
    if (!laborer1 || !laborer2) throw new Error('fixture: precisa de 2 laborers');
    const estado = semAUnidade(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: 0 }),
      laborer2,
    );

    const nivelando = ate(estado, (e) => e.unidades.porId[laborer1]?.fsm === 'nivelando', 'laborer chega e comeca a nivelar');
    const tarefaId = nivelando.unidades.porId[laborer1]?.fsmData.tarefa;
    if (tarefaId === undefined) throw new Error('fixture: laborer sem tarefa');

    const depois = step(semOPredio(nivelando, 'obra-a'), []);
    expect(liberacoes(depois.events)).toEqual([{ type: 'task-released', tarefa: tarefaId, motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[tarefaId]).toBeUndefined();
    expect(depois.unidades.porId[laborer1]).toMatchObject({ fsm: 'ocioso', fsmData: {} });
  });

  it('invariantes (FSM do laborer, FSM do serf, JobBoard, conservacao de bens) vazias em todo tick, do nivelamento zero ao teto', () => {
    const estado = comEstradas(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 }, nivelamento: 0 }),
      [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
    );
    const totalInicial = bensPorMercadoria(estado);
    let atual = estado;
    for (let i = 0; i < 400; i += 1) {
      atual = step(atual, []);
      expect(violacoesDaFsmDoLaborer(atual)).toEqual([]);
      expect(violacoesDaFsm(atual)).toEqual([]);
      expect(violacoesDeInvariantes(atual)).toEqual([]);
      expect(bensPorMercadoria(atual)).toEqual(totalInicial);
    }
  });

  it('anti-travamento: os laborers nao ficam presos numa obra sem material possivel — migram, a outra termina, e a primeira se recupera quando o material aparece', () => {
    const [laborer1, laborer2] = laborersDoCenario(inicial);
    if (!laborer1 || !laborer2) throw new Error('fixture: precisa de 2 laborers');
    const alvo = alvoDeNivelamento('quarry');

    // fase 1: SO obra-a existe, sem estrada nenhuma — nenhum armazem e alcancavel, entao
    // nenhuma tarefa de material nasce para ela nunca, nem depois de nivelada.
    const fase1 = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 }, nivelamento: 0 });

    const eventosDaFase1: GameEvent[] = [];
    let atual = fase1;
    for (let i = 0; i < 400; i += 1) {
      atual = step(atual, []);
      eventosDaFase1.push(...atual.events);
      const presos = [laborer1, laborer2].every((id) => atual.unidades.porId[id]?.fsm === 'ocioso')
        && (atual.predios.porId['obra-a'] as PredioEmObra).obra.nivelamento === alvo;
      if (presos) break;
    }
    expect((atual.predios.porId['obra-a'] as PredioEmObra).obra.nivelamento).toBe(alvo); // nivelou antes de travar
    expect([laborer1, laborer2].every((id) => atual.unidades.porId[id]?.fsm === 'ocioso')).toBe(true);

    const liberacoesDaFase1 = liberacoes(eventosDaFase1).filter((e) => e.motivo === 'pedido-da-unidade');
    expect(liberacoesDaFase1).toHaveLength(2); // uma por laborer, nenhuma repetida
    for (const lib of liberacoesDaFase1) {
      expect(atual.jobs.tarefas.porId[lib.tarefa]?.destino).toBe('obra-a'); // so a obra sem material possivel
    }

    // fase 2: obra-b nasce, nivelada do zero, ligada e abastecida — os ociosos vao para ela,
    // porque obra-a continua nao-trabalhavel (`reclamar` a recusa, Task 4).
    let fase2 = comObra(atual, 'obra-b', { gx: 26, gy: 45, faltam: { stone: 2, timber: 3 }, nivelamento: 0 });
    fase2 = comEstradas(fase2, [...linhaV(29, 33, 47), ...linhaH(26, 29, 47)]);
    const comObraBFeita = ate(fase2, (e) => e.predios.porId['obra-b']?.estado === 'completo', 'obra-b termina — a partida nao travou');
    expect(comObraBFeita.predios.porId['obra-b']?.estado).toBe('completo');

    // fase 3: a estrada chega em obra-a — o armazem (ja abastecido) passa a ser alcancavel,
    // a tarefa de material nasce, obra-a volta a ser trabalhavel e tambem termina.
    const fase3 = comEstradas(comObraBFeita, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
    const ambasProntas = ate(fase3, (e) => e.predios.porId['obra-a']?.estado === 'completo', 'obra-a se recupera e tambem termina');
    expect(ambasProntas.predios.porId['obra-a']?.estado).toBe('completo');
    expect(ambasProntas.predios.porId['obra-b']?.estado).toBe('completo');
  });
});

describe('F11c — gerarTarefas: o portao "obra ja nivelada" (Task 6)', () => {
  it('obra NAO nivelada, armazem ligado com estoque: zero tarefas de material, mas o teto de construir', () => {
    const estado = comEstradas(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 }, nivelamento: 0 }),
      [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
    );
    const depois = gerarTarefas(estado);
    const tarefas = depois.jobs.tarefas.ordem.map((id) => depois.jobs.tarefas.porId[id]);
    expect(tarefas.filter((t) => t?.tipo === 'material-para-obra')).toHaveLength(0);
    expect(tarefas.filter((t) => t?.tipo === 'construir')).toHaveLength(gameData.construcao.laborersMaximosPorObra);
  });

  it('ao nivelar, as tarefas de material aparecem no mesmo tick (mesma chamada de gerarTarefas)', () => {
    const nivelada = comEstradas(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2, timber: 3 } }), // default: ja nivelada
      [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
    );
    const depois = gerarTarefas(nivelada);
    const tarefas = depois.jobs.tarefas.ordem.map((id) => depois.jobs.tarefas.porId[id]);
    expect(tarefas.filter((t) => t?.tipo === 'material-para-obra')).toHaveLength(5); // 2 stone + 3 timber
    expect(tarefas.filter((t) => t?.tipo === 'construir')).toHaveLength(gameData.construcao.laborersMaximosPorObra);
  });
});

/**
 * Task 7 — o aceite headless do BUILD_PLAN: um Quarry plantado do zero (sem nivelar,
 * armazem ligado e abastecido) sobe sozinho, so pelo `step()`, ate ficar de pe.
 * `gravarEvidencia('F11c', ...)` grava `test-output/F11c.json` (CLAUDE.md §8).
 */
describe('F11c — BUG-001: a conclusao da obra leva junto as tarefas irmas', () => {
  /** Toda tarefa `construir` que ainda aponta para `predioId`, qualquer estado. */
  const construirPara = (estado: GameState, predioId: string): Tarefa[] => estado.jobs.tarefas.ordem
    .map((id) => estado.jobs.tarefas.porId[id])
    .filter((t): t is Tarefa => t !== undefined && t.tipo === 'construir' && t.destino === predioId);

  it('no TICK da conclusao nao sobra nenhuma tarefa de construir apontando para o predio', () => {
    const estado = comEstradas(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: 0 }),
      [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
    );
    let atual = estado;
    let noTickDaConclusao: Tarefa[] | null = null;
    const invariantesNoCaminho: string[] = [];
    for (let i = 0; i < 2000 && noTickDaConclusao === null; i += 1) {
      atual = step(atual, []);
      invariantesNoCaminho.push(...violacoesDeInvariantes(atual));
      if (atual.events.some((e) => e.type === 'building-completed' && e.predio === 'obra-a')) {
        noTickDaConclusao = construirPara(atual, 'obra-a');
      }
    }
    expect(noTickDaConclusao).not.toBeNull();
    expect(noTickDaConclusao).toEqual([]);
    // e o invariante GERAL (sem tolerancia): nenhuma tarefa com destino fora de obra,
    // em nenhum tick do caminho — e isto que a tolerancia de `violacoesInesperadas`
    // existia para deixar passar.
    expect(invariantesNoCaminho).toEqual([]);
  });

  it('o verificador ACUSA a forma que a tolerancia deixava passar (prova do guarda)', () => {
    // sem isto, "nenhuma violacao em tick nenhum" poderia ser verdade so porque o
    // verificador ficou cego. Monta a mao o estado que o bug produzia.
    const comObraEComTarefa = gerarTarefas(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: alvoDeNivelamento('quarry') }),
    );
    const emObra = comObraEComTarefa.predios.porId['obra-a'] as PredioEmObra;
    const comPredioCompleto: GameState = {
      ...comObraEComTarefa,
      predios: {
        ...comObraEComTarefa.predios,
        porId: { ...comObraEComTarefa.predios.porId, 'obra-a': completarObra(emObra) },
      },
    };
    const construir = construirPara(comPredioCompleto, 'obra-a');
    expect(construir.length).toBeGreaterThan(0); // o cenario tem o que acusar
    expect(violacoesDeInvariantes(comPredioCompleto)).toEqual(
      construir.map((t) => `${t.id}: destino 'obra-a' nao e obra`),
    );
  });

  it('o laborer que nao terminou a obra fica ocioso, sem tarefa pendurada', () => {
    const estado = comEstradas(
      comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: 0 }),
      [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
    );
    let atual = estado;
    for (let i = 0; i < 2000 && atual.predios.porId['obra-a']?.estado !== 'completo'; i += 1) {
      atual = step(atual, []);
    }
    expect(atual.predios.porId['obra-a']?.estado).toBe('completo');
    // mais dois ticks: quem vem ANTES do concluinte em `unidades.ordem` so passa
    // pela propria FSM no tick seguinte, e e la que ele larga o id.
    atual = step(step(atual, []), []);
    const pendurados = atual.unidades.ordem
      .map((id) => atual.unidades.porId[id])
      .filter((u) => u !== undefined && u.tipo === TIPO_QUE_CONSTROI
        && u.fsmData.tarefa !== undefined && atual.jobs.tarefas.porId[u.fsmData.tarefa] === undefined)
      .map((u) => `${u?.id ?? '?'} segura '${u?.fsmData.tarefa ?? '?'}', que nao existe mais`);
    expect(pendurados).toEqual([]);
  });
});

describe('F11c — aceite headless do BUILD_PLAN (Task 7)', () => {
  const alvo = alvoDeNivelamento('quarry');
  const estado = comEstradas(
    comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { timber: 3, stone: 2 }, nivelamento: 0 }),
    [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)],
  );
  const totalInicial = bensPorMercadoria(estado);
  const tiposAntes = estado.tiposJaConstruidos;

  let atual = estado;
  const eventos: GameEvent[] = [];
  let tickNivelamentoPronto = -1;
  let tickFaltamVazio = -1;
  let tickHp250 = -1;
  let tickPrimeiroMaterialCompletado = -1;
  const violacoesEncontradas: string[] = [];
  const bensDivergentes: number[] = [];

  beforeAll(() => {
    for (let i = 0; i < 2000 && atual.predios.porId['obra-a']?.estado !== 'completo'; i += 1) {
      atual = step(atual, []);
      eventos.push(...atual.events);
      violacoesEncontradas.push(
        ...violacoesDaFsmDoLaborer(atual), ...violacoesDaFsm(atual), ...violacoesDeInvariantes(atual),
      );
      if (JSON.stringify(bensPorMercadoria(atual)) !== JSON.stringify(totalInicial)) bensDivergentes.push(atual.tick);

      const obra = atual.predios.porId['obra-a'];
      if (obra?.estado === 'obra') {
        if (tickNivelamentoPronto === -1 && obra.obra.nivelamento === alvo) tickNivelamentoPronto = atual.tick;
        if (tickFaltamVazio === -1 && Object.values(obra.obra.faltam).every((v) => (v ?? 0) === 0)) tickFaltamVazio = atual.tick;
      }
      if (tickHp250 === -1 && obra && obra.hp === 250) tickHp250 = atual.tick;
      if (tickPrimeiroMaterialCompletado === -1 && atual.events.some((e) => e.type === 'task-completed' && e.destino === 'obra-a')) {
        tickPrimeiroMaterialCompletado = atual.tick;
      }
    }
  });

  it('o quarry sobe do zero ate completo, so pelo step()', () => {
    const completo = atual.predios.porId['obra-a'];
    const construidos = eventos.filter((e) => e.type === 'building-completed');
    const liberacoesPorPedidoDaUnidade = liberacoes(eventos).filter((e) => e.motivo === 'pedido-da-unidade');

    expect(completo?.estado).toBe('completo');
    expect(completo?.estado === 'completo' ? completo.hp : null).toBe(250);
    expect(hpTotalDoTipo('quarry')).toBe(250);
    expect(tickFaltamVazio).toBeGreaterThan(-1);
    expect(tickHp250).toBeGreaterThan(-1);
    expect(tickFaltamVazio).toBeLessThanOrEqual(tickHp250); // os 5 materiais chegam antes (ou no tick) do hp bater 250
    expect(tickNivelamentoPronto).toBeGreaterThan(-1);
    expect(tickPrimeiroMaterialCompletado).toBeGreaterThan(-1);
    expect(tickNivelamentoPronto).toBeLessThan(tickPrimeiroMaterialCompletado); // o portao da Task 6, ponta a ponta
    expect(liberacoesPorPedidoDaUnidade).toEqual([]); // a reavaliacao nunca libera (Task 5)
    expect(construidos).toEqual([{ type: 'building-completed', predio: 'obra-a', tipo: 'quarry' }]);
    // F12 ligou `building-completed` a `registrarTipoConstruido` no `step()`: o tipo agora
    // ENTRA no historico, e a assercao de antes (escrita quando ninguem consumia o evento)
    // deixou de valer. O aceite da F11c nao depende disto — ele e hp 250 + `completo`. O que
    // a guarda antiga protegia ("concluir obra nao desbloqueia sozinho") virou invariante por
    // tick no teste da F12: historico cresceu => houve evento, e vice-versa.
    expect(atual.tiposJaConstruidos).toEqual([...tiposAntes, 'quarry']);
    expect(bensDivergentes).toEqual([]);
    expect(violacoesEncontradas).toEqual([]);
  });

  afterAll(() => {
    const completo = atual.predios.porId['obra-a'];
    const construidos = eventos.filter((e) => e.type === 'building-completed');
    const liberacoesPorPedidoDaUnidade = liberacoes(eventos).filter((e) => e.motivo === 'pedido-da-unidade');
    gravarEvidencia('F11c', {
      feature: 'F11c-laborer-fsm',
      // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
      aceite: {
        predioFicouCompleto: completo?.estado === 'completo',
        hpFinal: completo?.estado === 'completo' ? completo.hp : null,
        hpTotalDoTipo: hpTotalDoTipo('quarry'),
        tickFaltamVazio,
        tickHp250,
        faltamVazioAntesOuNoTickDoHp250: tickFaltamVazio !== -1 && tickHp250 !== -1 && tickFaltamVazio <= tickHp250,
        alvoDeNivelamento: alvo,
        tickNivelamentoPronto,
        tickPrimeiroMaterialCompletado,
        nivelamentoTerminaAntesDoPrimeiroMaterial: tickNivelamentoPronto !== -1 && tickPrimeiroMaterialCompletado !== -1
          && tickNivelamentoPronto < tickPrimeiroMaterialCompletado,
        liberacoesPorPedidoDaUnidade: liberacoesPorPedidoDaUnidade.length,
        buildingCompletedEventos: construidos,
        // F12: era `tiposJaConstruidosNaoMudou`. Virou o seu oposto no mesmo lugar, para a
        // evidencia gravada nao afirmar o que deixou de ser verdade.
        tiposJaConstruidosGanhouOTipoConcluido:
          JSON.stringify(atual.tiposJaConstruidos) === JSON.stringify([...tiposAntes, 'quarry']),
        conservacaoDeBensEmTodoTick: bensDivergentes.length === 0,
        invariantesVaziasEmTodoTick: violacoesEncontradas.length === 0,
      },
    });
  });
});
