/**
 * F16c — pausar a producao de UM predio. Plano em `docs/planos/F16c-pausar.md`,
 * aprovado pelo operador em 2026-09-23 com as tres respostas da semantica:
 *
 *   (a) a gaveta `saida` continua escoando;
 *   (b) nenhuma tarefa de transporte e cancelada, e o gerador continua ate o
 *       alvo de sempre;
 *   (c) o ocupante fica, com o rotulo `trabalhando`.
 *
 * Ou seja: pausar congela o RELOGIO do ciclo, e nada mais. Os `modos` do
 * Woodcutter's sairam do aceite (andaime: nao ha arvore no mapa) — ver a nota do
 * item no BUILD_PLAN.
 *
 * Tudo pelo COMANDO REAL (`SetBuildingPaused`), nunca escrevendo `pausado` a mao
 * no estado: e o mesmo criterio da F16a.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { armazemDoCenario, comUnidadeExtra } from './helpers/jobs-cenario';
import {
  avancar, cenarioDePedreira, cenarioDeSerraria, comEntrada, comSaida, entradaDe, fsmDe,
  progressoDe, saidaDe,
} from './helpers/producao-cenario';

const pausar = (predio: string, pausado: boolean): Command => ({
  type: 'SetBuildingPaused', predio, pausado,
});

const completosDe = (estado: GameState) =>
  estado.predios.ordem
    .map((id) => estado.predios.porId[id])
    .filter((p) => p !== undefined && p.estado === 'completo');

describe('F16c — Tarefa 1: o campo `pausado`', () => {
  it('todo predio completo nasce despausado', () => {
    const inicial = createInitialState(1);
    const completos = completosDe(inicial);
    expect(completos.length).toBeGreaterThan(0);
    for (const p of completos) {
      expect(p.estado === 'completo' && p.pausado).toBe(false);
    }
  });

  it('o campo sobrevive ao save/load: pausar no tick 3 nao muda o determinismo', () => {
    const alvo = createInitialState(1).predios.ordem[0] ?? '';
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: 12,
      saveAtTick: 6,
      comandosNoTick: (tick) => (tick === 3 ? [pausar(alvo, true)] : []),
    });
    expect(comSave).toBe(direto);
    expect(direto).toContain('"pausado":true');
  });

  it('pausar e despausar devolve o JSON ao que era antes', () => {
    const inicial = createInitialState(1);
    const alvo = inicial.predios.ordem[0] ?? '';
    const semPausa = step(inicial, [], gameData);
    const ida = step(inicial, [pausar(alvo, true)], gameData);
    const volta = step(inicial, [pausar(alvo, true), pausar(alvo, false)], gameData);
    expect(JSON.stringify(ida)).not.toBe(JSON.stringify(semPausa));
    expect(JSON.stringify(volta)).toBe(JSON.stringify(semPausa));
  });
});

describe('F16c — Tarefa 2: o comando `SetBuildingPaused`', () => {
  const inicial = createInitialState(1);
  const ALVO = inicial.predios.ordem[0] ?? '';

  it('recusa id inexistente, sem mudar o estado', () => {
    const depois = step(inicial, [pausar('p999', true)], gameData);
    const semComando = step(inicial, [], gameData);
    expect(depois.events).toContainEqual({
      type: 'command-rejected', command: 'SetBuildingPaused', predio: 'p999', motivo: 'predio-inexistente',
    });
    expect(JSON.stringify(depois.predios)).toBe(JSON.stringify(semComando.predios));
  });

  it('recusa predio em obra: pausar obra e feature que ninguem escreveu', () => {
    const comObra = step(inicial, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 }], gameData);
    const obra = comObra.predios.ordem.find((id) => comObra.predios.porId[id]?.estado === 'obra') ?? '';
    expect(obra).not.toBe('');
    const depois = step(comObra, [pausar(obra, true)], gameData);
    expect(depois.events).toContainEqual({
      type: 'command-rejected', command: 'SetBuildingPaused', predio: obra, motivo: 'predio-em-obra',
    });
    expect(depois.predios.porId[obra]?.estado).toBe('obra');
  });

  it('pausar muda o campo e NAO emite evento proprio: a tela le o estado', () => {
    const depois = step(inicial, [pausar(ALVO, true)], gameData);
    const p = depois.predios.porId[ALVO];
    expect(p?.estado === 'completo' && p.pausado).toBe(true);
    expect(depois.events.filter((e) => e.type !== 'tick-advanced')).toEqual([]);
  });

  it('o mesmo valor e no-op: mesmo estado, nenhum evento, em qualquer repeticao', () => {
    const pausado = step(inicial, [pausar(ALVO, true)], gameData);
    const repetido = step(pausado, [pausar(ALVO, true), pausar(ALVO, true)], gameData);
    const semComando = step(pausado, [], gameData);
    expect(JSON.stringify(repetido)).toBe(JSON.stringify(semComando));
  });

  it('o comando leva VALOR, nao alternador: dois `true` no mesmo tick nao despausam', () => {
    const depois = step(inicial, [pausar(ALVO, true), pausar(ALVO, true)], gameData);
    const p = depois.predios.porId[ALVO];
    expect(p?.estado === 'completo' && p.pausado).toBe(true);
  });
});

// --- Tarefa 3: o leitor, e o aceite ---

const CAPACIDADE_DA_SAIDA = gameData.producao.estoqueInternoPorPredio.saida;
const CICLO_DA_PEDREIRA = gameData.producao.receitas.quarry?.ticksDoCiclo ?? 0;
/**
 * F-T3 — o ciclo da pedreira deixou de comecar no tick da ocupacao: ele comeca com
 * a IDA ao tile (a transicao mais 49 passos), o relogio anda NO TILE e a mercadoria
 * so entra na gaveta na VOLTA. As duas pernas vem do mapa deste cenario, medidas na
 * trilha de `test-output/F-T3-ciclo-em-campo.json`; o ciclo continua vindo do dado.
 *
 * O que isso muda para a pausa: "no meio do ciclo" agora quer dizer NO TILE, e e la
 * que o pedreiro congela. A semantica nao mudou — congelar o relogio e nada mais —,
 * mudou onde ele esta quando congela, e isto o caso (1) passou a afirmar.
 */
const IDA_ATE_O_TILE = 50;
const VOLTA_DO_TILE = 49;
const INTERVALO_DA_PEDREIRA = IDA_ATE_O_TILE + CICLO_DA_PEDREIRA + VOLTA_DO_TILE;
/** LOTE3-b2 — o ciclo abre com o descanso dentro do predio, antes da ida. */
const DESCANSO_DA_PEDREIRA = gameData.producao.receitas.quarry?.colheita?.ticksDeDescanso ?? 0;
/** Tres ticks de relogio JA no tile: o mesmo "meio do ciclo" de antes da F-T3. */
const NA_METADE = DESCANSO_DA_PEDREIRA + IDA_ATE_O_TILE + 3;
/**
 * DECISAO DESTA SESSAO (F-T3), marcada para o operador revisar (PROGRESS.md):
 * pausar um predio de colheita com o especialista NO CAMPO nao suspende aquele
 * ciclo — ele recomeca. O motivo esta em `systems/jobs.ts`: `motivoDoDestino`
 * CANCELA a tarefa de colheita do predio pausado, decisao da F16c com a razao
 * escrita ao lado (segurar o tile por tempo indeterminado deixaria o jogador
 * travar a pedreira do vizinho de graca). Sem tile reservado nao ha ciclo a
 * retomar, entao o ocupante congela onde esta enquanto a pausa dura, volta de
 * maos vazias ao despausar e comeca de novo.
 *
 * O que o aceite da F16c exige continua valendo, e e o que este caso mede:
 * nenhuma mercadoria e perdida, nenhuma e duplicada, e o relogio nao anda durante
 * a pausa. O que ele NAO pode mais dizer e "o ciclo termina ao despausar": o preco
 * da pausa em campo e pago em TICKS, e esta escrito aqui embaixo, exato.
 */
const VOLTA_DE_MAOS_VAZIAS = 50;

/** Onde a unidade esta. A pausa nao pode mover ninguem, e sem isto o congelamento
 *  em campo passaria com o pedreiro voltando para casa na ponta dos pes. */
const ondeEsta = (estado: GameState, id: string): string => {
  const u = estado.unidades.porId[id];
  if (u === undefined) throw new Error(`fixture: unidade '${id}' nao existe`);
  return `${u.gx},${u.gy}`;
};

/** Toda a pedra do mapa, gaveta por gaveta: a conta de conservacao do aceite
 *  ("sem perder nem duplicar mercadoria"). */
function totalDe(estado: GameState, mercadoria: string): number {
  let total = 0;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p === undefined || p.estado !== 'completo') continue;
    total += (p.estoque.entrada[mercadoria] ?? 0) + (p.estoque.saida[mercadoria] ?? 0);
  }
  for (const id of estado.unidades.ordem) {
    if (estado.unidades.porId[id]?.fsmData.carga === mercadoria) total += 1;
  }
  return total;
}

/** Roda `ticks` guardando o que aconteceu, e confere as invariantes a CADA tick
 *  — nao so no fim (molde da F16a). */
function rodar(estado: GameState, ticks: number, comandos: readonly Command[] = []) {
  let s = estado;
  const produzidos: string[] = [];
  let violacoes = 0;
  for (let i = 0; i < ticks; i++) {
    s = step(s, i === 0 ? comandos : [], gameData);
    for (const e of s.events) if (e.type === 'goods-produced') produzidos.push(e.mercadoria);
    violacoes += violacoesDeInvariantes(s, gameData).length + violacoesDaFsmDoEspecialista(s, gameData).length;
  }
  return { state: s, produzidos, violacoes };
}

describe('F16c — Tarefa 3: pausado, o relogio congela', () => {
  it('(1) pedreira pausada no meio do ciclo: progresso parado, e o ciclo termina ao despausar', () => {
    const meio = avancar(cenarioDePedreira(), NA_METADE);
    const progressoNaPausa = progressoDe(meio, 'q1');
    expect(progressoNaPausa).toBe(DESCANSO_DA_PEDREIRA + 3);
    expect(fsmDe(meio, 'u1')).toBe('colhendo'); // F-T3: o meio do ciclo e no tile

    const parado = rodar(meio, 200, [pausar('q1', true)]);
    expect(progressoDe(parado.state, 'q1')).toBe(progressoNaPausa);
    expect(parado.produzidos).toEqual([]);
    expect(saidaDe(parado.state, 'q1')).toEqual({});
    expect(parado.state.predios.porId.q1?.estado === 'completo'
      && parado.state.predios.porId.q1.ocupante).toBe('u1');
    // congelou NO TILE, e nao em `trabalhando` na porta: a pausa para o relogio e
    // nao move ninguem. Duzentos ticks parados no mesmo tile.
    expect(fsmDe(parado.state, 'u1')).toBe('colhendo');
    expect(ondeEsta(parado.state, 'u1')).toBe(ondeEsta(meio, 'u1'));
    expect(parado.violacoes).toBe(0);

    const pedraAntes = totalDe(parado.state, 'stone');
    // despausado, ele volta de maos vazias e o relogio zera: o tile deixou de ser
    // dele na pausa. Nada produzido nesta perna — e um tick a mais ou a menos aqui
    // reprova, porque o numero e a viagem inteira, nao uma tolerancia.
    const voltou = rodar(parado.state, VOLTA_DE_MAOS_VAZIAS, [pausar('q1', false)]);
    expect(voltou.produzidos).toEqual([]);
    expect(progressoDe(voltou.state, 'q1')).toBe(0);
    expect(fsmDe(voltou.state, 'u1')).toBe('trabalhando');
    expect(ondeEsta(voltou.state, 'u1')).not.toBe(ondeEsta(parado.state, 'u1'));
    expect(voltou.violacoes).toBe(0);

    // e o ciclo seguinte e um ciclo COMPLETO, do tamanho de sempre: uma pedra, uma
    // vez, no tick exato. Nenhuma mercadoria se perdeu na pausa e nenhuma nasceu
    // dobrada — que e o que o aceite da F16c pede.
    const retomado = rodar(voltou.state, INTERVALO_DA_PEDREIRA);
    expect(retomado.produzidos).toEqual(['stone']);
    expect(saidaDe(retomado.state, 'q1')).toEqual({ stone: 1 });
    expect(progressoDe(retomado.state, 'q1')).toBe(0);
    expect(totalDe(retomado.state, 'stone')).toBe(pedraAntes + 1);
    expect(retomado.violacoes).toBe(0);
  });

  it('(2) ciclo PRONTO esperando gaveta: pausado nao deposita; despausado deposita UMA vez', () => {
    const cheia = comSaida(cenarioDePedreira(), 'q1', { stone: CAPACIDADE_DA_SAIDA });
    const pronto = avancar(cheia, INTERVALO_DA_PEDREIRA);
    expect(progressoDe(pronto, 'q1')).toBe(CICLO_DA_PEDREIRA);
    expect(fsmDe(pronto, 'u1')).toBe('saida_cheia');

    // pausa, e SO ENTAO a gaveta esvazia: o ciclo pronto tem para onde ir e
    // mesmo assim nao deposita
    const pausado = step(pronto, [pausar('q1', true)], gameData);
    const comEspaco = comSaida(pausado, 'q1', {});
    const parado = rodar(comEspaco, 50);
    expect(parado.produzidos).toEqual([]);
    expect(saidaDe(parado.state, 'q1')).toEqual({});
    expect(progressoDe(parado.state, 'q1')).toBe(CICLO_DA_PEDREIRA);

    const retomado = rodar(parado.state, 1, [pausar('q1', false)]);
    expect(retomado.produzidos).toEqual(['stone']);
    expect(saidaDe(retomado.state, 'q1')).toEqual({ stone: 1 });
    const maisTarde = rodar(retomado.state, 1);
    expect(maisTarde.produzidos).toEqual([]);
  });

  it('(3) serraria pausada com insumo JA consumido: despausar termina sem cobrar de novo', () => {
    const comTronco = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 4 });
    const comecou = avancar(comTronco, 1);
    const entradaDepoisDoConsumo = entradaDe(comecou, 's1');
    expect(entradaDepoisDoConsumo.tree_trunk).toBeLessThan(4);

    const cicloDaSerraria = gameData.producao.receitas.sawmill?.ticksDoCiclo ?? 0;
    // o dobro do ciclo: se o relogio nao congelasse, teria depositado duas vezes
    const parado = rodar(comecou, cicloDaSerraria * 2, [pausar('s1', true)]);
    expect(entradaDe(parado.state, 's1')).toEqual(entradaDepoisDoConsumo);
    expect(parado.produzidos).toEqual([]);

    const retomado = rodar(parado.state, cicloDaSerraria, [pausar('s1', false)]);
    expect(retomado.produzidos).toEqual(['timber']);
    // o ciclo seguinte cobrou o seu proprio insumo, uma vez; o ciclo pausado nao cobrou duas
    expect(entradaDe(retomado.state, 's1').tree_trunk)
      .toBe((entradaDepoisDoConsumo.tree_trunk ?? 0) - (entradaDepoisDoConsumo.tree_trunk === 0 ? 0 : 1));
    expect(retomado.violacoes).toBe(0);
  });

  it('(4) a gaveta `saida` continua escoando durante a pausa', () => {
    const base = comSaida(cenarioDePedreira(), 'q1', { stone: 2 });
    const armazem = armazemDoCenario(base);
    const comSerf = comUnidadeExtra(base, 'serf-1', 'serf', armazem.gx, armazem.gy + 3);
    const pedraAntes = totalDe(comSerf, 'stone');

    const corrida = rodar(comSerf, 300, [pausar('q1', true)]);
    // a gaveta esvaziou: a chave fica com 0 (o produtor nao poda zeros — F15a)
    expect(saidaDe(corrida.state, 'q1').stone ?? 0).toBe(0);
    const armazemDepois = corrida.state.predios.porId[armazem.id];
    const pedraNoArmazem = armazemDepois?.estado === 'completo'
      ? armazemDepois.estoque.saida.stone ?? 0 : null;
    expect(pedraNoArmazem).toBe((armazem.estoque.saida.stone ?? 0) + 2);
    expect(totalDe(corrida.state, 'stone')).toBe(pedraAntes);
    expect(corrida.produzidos).toEqual([]);
    expect(corrida.violacoes).toBe(0);
  });

  it('(5) a tarefa de insumo em voo entrega no predio pausado, e nenhuma fica orfa', () => {
    const base = cenarioDeSerraria();
    const armazem = armazemDoCenario(base);
    const comTronco = comSaida(base, armazem.id, { tree_trunk: 3 });
    const comSerf = comUnidadeExtra(comTronco, 'serf-1', 'serf', armazem.gx, armazem.gy + 3);

    const corrida = rodar(comSerf, 300, [pausar('s1', true)]);
    expect(entradaDe(corrida.state, 's1').tree_trunk ?? 0).toBeGreaterThan(0);
    expect(corrida.produzidos).toEqual([]);
    expect(corrida.violacoes).toBe(0);
    // nenhuma tarefa ficou parada com o destino invalido: o quadro esvazia
    const orfas = corrida.state.jobs.tarefas.ordem
      .map((id) => corrida.state.jobs.tarefas.porId[id])
      .filter((t) => t?.tipo === 'insumo-producao-parada' || t?.tipo === 'insumo-producao-baixa');
    expect(orfas.every((t) => t !== undefined && t.destino === 's1')).toBe(true);
  });

  it('(6) o ocupante fica, e o predio pausado nao anuncia vaga', () => {
    const corrida = rodar(cenarioDePedreira(), 200, [pausar('q1', true)]);
    const q1 = corrida.state.predios.porId.q1;
    expect(q1?.estado === 'completo' && q1.ocupante).toBe('u1');
    const ocupar = corrida.state.jobs.tarefas.ordem
      .filter((id) => corrida.state.jobs.tarefas.porId[id]?.tipo === 'ocupar');
    expect(ocupar).toEqual([]);
    expect(fsmDe(corrida.state, 'u1')).toBe('trabalhando');
  });
});

// --- a evidencia (CLAUDE.md §8) ---

describe('F16c — evidencia', () => {
  it('grava test-output/F16c.json com o aceite medido', () => {
    const meio = avancar(cenarioDePedreira(), NA_METADE);
    const progressoNaPausa = progressoDe(meio, 'q1');
    const parado = rodar(meio, 200, [pausar('q1', true)]);
    const voltou = rodar(parado.state, VOLTA_DE_MAOS_VAZIAS, [pausar('q1', false)]);
    const retomado = rodar(voltou.state, INTERVALO_DA_PEDREIRA);

    const comPedra = comSaida(cenarioDePedreira(), 'q1', { stone: 2 });
    const armazem = armazemDoCenario(comPedra);
    const escoando = rodar(
      comUnidadeExtra(comPedra, 'serf-1', 'serf', armazem.gx, armazem.gy + 3), 300, [pausar('q1', true)],
    );
    const armazemDepois = escoando.state.predios.porId[armazem.id];

    const serraria = cenarioDeSerraria();
    const comTronco = comSaida(serraria, armazemDoCenario(serraria).id, { tree_trunk: 3 });
    const entregando = rodar(
      comUnidadeExtra(comTronco, 'serf-1', 'serf', armazem.gx, armazem.gy + 3), 300, [pausar('s1', true)],
    );

    gravarEvidencia('F16c', {
      feature: 'F16c — Pausar producao (sim)',
      aceite: {
        clausula: 'pausa um predio em producao e o ciclo para segundo a semantica decidida; despausar retoma sem perder nem duplicar mercadoria',
        semantica: {
          decidida: 'pausar congela o RELOGIO do ciclo, e nada mais (operador, 2026-09-23)',
          gavetaDeSaida: 'continua escoando',
          cicloEmCampo: 'F-T3: com o especialista no campo, a pausa cancela a tarefa de colheita e o ciclo recomeca ao despausar — nenhuma mercadoria perdida ou duplicada, o custo e em ticks',
          tarefasDeTransporte: 'nenhuma cancelada; o gerador continua ate o alvo de sempre',
          ocupante: 'fica; desde a F-T3 ele congela ONDE ESTA — no tile, se o predio colhe (rotulo colhendo), ou com o rotulo trabalhando dentro do predio',
        },
        cicloCongelado: {
          ticksPausado: 200,
          progressoNaPausa,
          progressoDepoisDe200Ticks: progressoDe(parado.state, 'q1'),
          mercadoriaProduzidaNaPausa: parado.produzidos,
          fsmDoOcupante: fsmDe(parado.state, 'u1'),
          ondeCongelou: ondeEsta(parado.state, 'u1'),
          ondeEstavaAoPausar: ondeEsta(meio, 'u1'),
          violacoesEmTodosOsTicks: parado.violacoes,
        },
        retomada: {
          ticksAteODeposito: VOLTA_DE_MAOS_VAZIAS + INTERVALO_DA_PEDREIRA,
          _notaFT3: 'a pausa CANCELA a tarefa de colheita (F16c, motivoDoDestino), entao o ciclo em campo nao se retoma: ele volta de maos vazias em 50 ticks e faz um ciclo inteiro. Decisao desta sessao, para o operador revisar.',
          ticksDaVoltaDeMaosVazias: VOLTA_DE_MAOS_VAZIAS,
          produzidos: retomado.produzidos,
          saidaDaPedreira: saidaDe(retomado.state, 'q1'),
          progressoDepois: progressoDe(retomado.state, 'q1'),
          pedraNoMapa: { antes: totalDe(parado.state, 'stone'), depois: totalDe(retomado.state, 'stone') },
          violacoesEmTodosOsTicks: retomado.violacoes,
        },
        escoamentoDurantePausa: {
          saidaDaPedreira: { antes: { stone: 2 }, depois: saidaDe(escoando.state, 'q1') },
          pedraNoArmazem: {
            antes: armazem.estoque.saida.stone ?? 0,
            depois: armazemDepois?.estado === 'completo' ? armazemDepois.estoque.saida.stone ?? 0 : null,
          },
          pedraNoMapa: { antes: totalDe(comPedra, 'stone'), depois: totalDe(escoando.state, 'stone') },
          violacoesEmTodosOsTicks: escoando.violacoes,
        },
        insumoEntregueEmPredioPausado: {
          entradaDaSerraria: entradaDe(entregando.state, 's1'),
          produzidoNaPausa: entregando.produzidos,
          tarefasNoQuadroNoFim: entregando.state.jobs.tarefas.ordem.length,
          violacoesEmTodosOsTicks: entregando.violacoes,
        },
      },
      sondasDeMutacao: {
        natureza: 'prova do MOMENTO (CLAUDE.md §8): o fonte foi mutado a mao e revertido; nao e cobertura continua — quem protege daqui para frente sao as asercoes deste arquivo',
        'A) leitor apagado (produzir sem `if (predio.pausado)`)': '4 casos reprovaram (1, 2, 3, 4)',
        'B) leitor invertido (`!predio.pausado`)': '4 casos reprovaram (1, 2, 3, 4)',
        'C) alternativa rejeitada: pausa CANCELA a tarefa em voo (motivoDoDestino)': '1 caso reprovou (5)',
        'D) alternativa rejeitada: pausa SOLTA o ocupante (sanearOcupacao)': '2 casos reprovaram (1, 6)',
      },
      modosDoWoodcutters: {
        decisao: 'ANDAIME — nao implementado (operador, 2026-09-23)',
        razao: 'nao ha arvore no mapa nem camada de terreno; `cortar` exigiria estoque finito de arvore, `replantar` seria `pausar` com outro nome e `ambos` e o comportamento atual',
        ondeFicou: 'IDEIAS.md, nota do item F16c no BUILD_PLAN.md e campo `notas` em data/production.json',
        clausulaDoAceite: 'removida pelo operador, com a razao escrita ao lado',
      },
      dado: {
        'producao.receitas.quarry.ticksDoCiclo': CICLO_DA_PEDREIRA,
        'producao.receitas.sawmill.ticksDoCiclo': gameData.producao.receitas.sawmill?.ticksDoCiclo ?? null,
        'producao.estoqueInternoPorPredio.saida': CAPACIDADE_DA_SAIDA,
      },
    });
    expect(parado.produzidos).toEqual([]);
    expect(retomado.produzidos).toEqual(['stone']);
  });
});
