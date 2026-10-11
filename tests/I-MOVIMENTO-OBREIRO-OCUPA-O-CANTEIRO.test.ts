import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState, PredioEmObra, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { postosDaObra, postoLivreDaObra } from '../src/sim/jobs';
import { tilesDaPorta, chaveDeTile } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { caixaDoPredio } from '../src/sim/footprint';
import { tileAndavel, buscarCaminho } from '../src/sim/pathfinding';
import { colisaoCivilLigada, ehObreiroNoPosto } from '../src/sim/colisao';
import {
  armazemDoCenario, comEstradas, comObra, comUnidadeEm, comUnidadeExtra, inicial, laborersDoCenario,
  semAUnidade, semOPredio, serfsDoCenario,
} from './helpers/jobs-cenario';
import { violacoesDaColisao, violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { naVila } from './helpers/ancoras';

/**
 * I-MOVIMENTO-OBREIRO-OCUPA-O-CANTEIRO — o obreiro trabalha num POSTO em volta da obra, ocupa o tile, e
 * cede o lugar a quem espera (opcao (a) do operador, 2026-10-11). A porta fica para o serf.
 */
const evidencia: Record<string, unknown> = {};
afterAll(() => gravarEvidencia('I-MOVIMENTO-OBREIRO-OCUPA-O-CANTEIRO', evidencia));

const ID = 'obra-a';
const obraDe = (e: GameState): PredioEmObra => e.predios.porId[ID] as PredioEmObra;
const mesmo = (a: TileDeGrid, b: TileDeGrid): boolean => a.gx === b.gx && a.gy === b.gy;
const laborer = (e: GameState, id: string): Unidade => e.unidades.porId[id] as Unidade;

/** A obra da F11c (quarry, perto da vila) com material faltando, e os obreiros do cenario. */
function comAObra(faltam: Record<string, number>, nivelamento?: number): GameState {
  return comObra(inicial, ID, { ...naVila(-3, 4), faltam, ...(nivelamento === undefined ? {} : { nivelamento }) });
}

/** Roda ate `pare` ou `teto` ticks, conferindo a colisao e as invariantes em todo tick. */
function rodar(e: GameState, teto: number, pare: (s: GameState) => boolean = () => false): { estado: GameState; violacoes: string[]; ticks: number } {
  let atual = e;
  const violacoes: string[] = [];
  for (let i = 0; i < teto; i += 1) {
    atual = step(atual, []);
    violacoes.push(...violacoesDaColisao(atual), ...violacoesDeInvariantes(atual), ...violacoesDaFsmDoLaborer(atual));
    if (pare(atual)) return { estado: atual, violacoes, ticks: i + 1 };
  }
  return { estado: atual, violacoes, ticks: teto };
}

describe('I-MOVIMENTO-OBREIRO-OCUPA-O-CANTEIRO', () => {
  it('a premissa: a colisao civil esta ligada (sem ela nao ha posto)', () => {
    expect(colisaoCivilLigada(gameData)).toBe(true);
  });

  it('1. os postos excluem a porta, o footprint e tile nao andavel', () => {
    const e = comAObra({ timber: 3, stone: 2 });
    const obra = obraDe(e);
    const caixa = caixaDoPredio(obra, gameData);
    if (caixa === null) throw new Error('fixture: obra sem caixa');
    const postos = postosDaObra(e, obra);
    const porta = tilesDaPorta(obra);
    expect(postos.length).toBeGreaterThan(0);
    for (const t of postos) {
      expect(porta.some((p) => mesmo(p, t))).toBe(false);
      expect(t.gx >= caixa.x0 && t.gx < caixa.x1 && t.gy >= caixa.y0 && t.gy < caixa.y1).toBe(false);
      expect(tileAndavel(e, t, 'livre')).toBe(true);
      // no anel de 1 tile em volta
      expect(t.gx >= caixa.x0 - 1 && t.gx <= caixa.x1 && t.gy >= caixa.y0 - 1 && t.gy <= caixa.y1).toBe(true);
    }
    // a estrada sai dos postos
    const comRua = comEstradas(e, [postos[0] as TileDeGrid]);
    expect(postosDaObra(comRua, obraDe(comRua)).some((t) => mesmo(t, postos[0] as TileDeGrid))).toBe(false);
    evidencia['postos'] = { obra: { gx: obra.gx, gy: obra.gy }, postos: postos.length, porta: porta.length };
  });

  it('2. quatro obreiros e material chegando: a obra completa, nenhum posto repetido, nenhum tile com dois civis fora', () => {
    let e = comAObra({ timber: 3, stone: 2 }, 0);
    const base = naVila(-3, 4);
    e = comUnidadeExtra(e, 'lab-x1', 'laborer', base.gx + 4, base.gy + 5);
    e = comUnidadeExtra(e, 'lab-x2', 'laborer', base.gx + 5, base.gy + 5);
    let postosRepetidos = 0;
    let maxNoPosto = 0;
    let atual = e;
    const violacoes: string[] = [];
    let completa = -1;
    for (let i = 0; i < 3000 && completa === -1; i += 1) {
      atual = step(atual, []);
      violacoes.push(...violacoesDaColisao(atual), ...violacoesDeInvariantes(atual), ...violacoesDaFsmDoLaborer(atual));
      const vistos = new Set<string>();
      let noPosto = 0;
      for (const id of laborersDoCenario(atual)) {
        const p = laborer(atual, id).fsmData.posto;
        if (p === undefined) continue;
        if (vistos.has(chaveDeTile(p))) postosRepetidos += 1;
        vistos.add(chaveDeTile(p));
        if (ehObreiroNoPosto(laborer(atual, id))) noPosto += 1;
      }
      maxNoPosto = Math.max(maxNoPosto, noPosto);
      if (atual.predios.porId[ID]?.estado === 'completo') completa = atual.tick;
    }
    evidencia['quatroObreiros'] = { completaNoTick: completa, maxNoPosto, violacoes: violacoes.slice(0, 5) };
    expect(completa).toBeGreaterThan(-1);
    expect(postosRepetidos).toBe(0);
    expect(maxNoPosto).toBeGreaterThanOrEqual(2); // os obreiros trabalharam nos postos, e nao na porta
    expect(violacoes).toEqual([]);
    // obra pronta: ninguem segura posto
    for (const id of laborersDoCenario(atual)) expect(laborer(atual, id).fsmData.posto).toBeUndefined();
  });

  it('3. o posto e devolvido: obra demolida no meio e obreiro morto', () => {
    const e = comAObra({ timber: 3, stone: 2 }, 0);
    const meio = rodar(e, 400, (s) => laborersDoCenario(s).every((id) => ehObreiroNoPosto(laborer(s, id))));
    expect(laborersDoCenario(meio.estado).every((id) => ehObreiroNoPosto(laborer(meio.estado, id)))).toBe(true);
    // obreiro morto: o posto dele fica livre para outro
    const [um, dois] = laborersDoCenario(meio.estado) as [string, string];
    const postoDoUm = laborer(meio.estado, um).fsmData.posto as TileDeGrid;
    const semUm = semAUnidade(meio.estado, um);
    expect(postoLivreDaObra(semUm, ID, 'outro', gameData, (t) => !mesmo(t, postoDoUm))).toEqual(postoDoUm);
    const depoisDaMorte = rodar(semUm, 50);
    expect(depoisDaMorte.violacoes).toEqual([]);
    // obra demolida: os obreiros largam a tarefa e o posto
    const demolida = rodar(semOPredio(meio.estado, ID), 20);
    for (const id of laborersDoCenario(demolida.estado)) expect(laborer(demolida.estado, id).fsmData.posto).toBeUndefined();
    expect(demolida.violacoes).toEqual([]);
    evidencia['devolvido'] = { mortoLiberaPosto: postoDoUm, outro: dois };
  });

  /** O obreiro 1 no posto esperando material; o serf vai devolver carga por um caminho que pisa no posto. */
  function serfAtravessandoOPosto(estradaNosOutrosPostos: boolean): { e: GameState; obreiro: string; serf: string; posto: TileDeGrid } {
    let e = comAObra({ timber: 30 }); // nivelada, sem material: o obreiro espera no posto
    const [obreiro, outro] = laborersDoCenario(e) as [string, string];
    e = semAUnidade(e, outro);
    const assentado = rodar(e, 300, (s) => ehObreiroNoPosto(laborer(s, obreiro)));
    e = assentado.estado;
    const posto = laborer(e, obreiro).fsmData.posto as TileDeGrid;
    if (estradaNosOutrosPostos) e = comEstradas(e, postosDaObra(e, obraDe(e)).filter((t) => !mesmo(t, posto)));
    // o serf: um vizinho do posto do lado de fora do anel, indo ao armazem por um caminho que pisa no posto
    const serf = serfsDoCenario(e)[0] as string;
    const obra = obraDe(e);
    const caixa = caixaDoPredio(obra, gameData);
    if (caixa === null) throw new Error('fixture');
    const fora = [{ gx: posto.gx - 1, gy: posto.gy }, { gx: posto.gx + 1, gy: posto.gy }, { gx: posto.gx, gy: posto.gy - 1 }, { gx: posto.gx, gy: posto.gy + 1 }]
      .find((t) => tileAndavel(e, t, 'livre') && !(t.gx >= caixa.x0 - 1 && t.gx <= caixa.x1 && t.gy >= caixa.y0 - 1 && t.gy <= caixa.y1));
    if (fora === undefined) throw new Error('fixture: posto sem vizinho de fora');
    e = comUnidadeEm(e, serf, fora.gx, fora.gy);
    const armazem = armazemDoCenario(e);
    const resto = buscarCaminho(e, posto, tilesDaPorta(armazem), 'livre');
    if (resto === null) throw new Error('fixture: sem caminho do posto ao armazem');
    const s = e.unidades.porId[serf] as Unidade;
    const comCaminho: Unidade = { ...s, fsm: 'devolvendo', fsmData: { carga: 'timber', armazem: armazem.id, caminho: [posto, ...resto.tiles], progresso: 0 } };
    e = { ...e, unidades: { ...e.unidades, porId: { ...e.unidades.porId, [serf]: comCaminho } } };
    return { e, obreiro, serf, posto };
  }

  function atravessa(estradaNosOutrosPostos: boolean): Record<string, unknown> {
    const { e, obreiro, serf, posto } = serfAtravessandoOPosto(estradaNosOutrosPostos);
    const tarefa = laborer(e, obreiro).fsmData.tarefa;
    const nivelamento = obraDe(e).obra.nivelamento;
    const prazo = gameData.movimento.colisaoCivil.ticksPrazoDeProgresso;
    let pisou = -1;
    let atual = e;
    const violacoes: string[] = [];
    for (let i = 0; i < prazo + 40 && pisou === -1; i += 1) {
      atual = step(atual, []);
      violacoes.push(...violacoesDaColisao(atual));
      const s = atual.unidades.porId[serf] as Unidade;
      if (mesmo(s, posto)) pisou = i + 1;
    }
    // e o obreiro volta a trabalhar num posto
    const volta = rodar(atual, 60, (st) => ehObreiroNoPosto(laborer(st, obreiro)));
    const o = laborer(volta.estado, obreiro);
    return {
      pisouNoTick: pisou, prazo, violacoes: [...violacoes, ...volta.violacoes],
      mesmaTarefa: o.fsmData.tarefa === tarefa, noPosto: ehObreiroNoPosto(o),
      postoDaObra: o.fsmData.posto !== undefined && postosDaObra(volta.estado, obraDe(volta.estado)).some((t) => mesmo(t, o.fsmData.posto as TileDeGrid)),
      nivelamentoMantido: obraDe(volta.estado).obra.nivelamento >= nivelamento,
      voltouAoMesmoPosto: o.fsmData.posto !== undefined && mesmo(o.fsmData.posto, posto),
    };
  }

  it('6. o serf atravessa o posto antes do prazo; o obreiro vai a outro posto livre, na mesma tarefa', () => {
    const r = atravessa(false);
    evidencia['cedeAOutroPosto'] = r;
    expect(r['pisouNoTick']).toBeGreaterThan(0);
    expect(r['pisouNoTick'] as number).toBeLessThanOrEqual(r['prazo'] as number);
    expect(r['mesmaTarefa']).toBe(true);
    expect(r['noPosto']).toBe(true);
    expect(r['postoDaObra']).toBe(true);
    expect(r['nivelamentoMantido']).toBe(true);
    expect(r['voltouAoMesmoPosto']).toBe(false);
    expect(r['violacoes']).toEqual([]);
  });

  it('7. sem posto livre: troca de lugar com quem espera e volta ao posto, sem dois civis fora no tile', () => {
    const r = atravessa(true);
    evidencia['trocaDeLugar'] = r;
    expect(r['pisouNoTick']).toBeGreaterThan(0);
    expect(r['pisouNoTick'] as number).toBeLessThanOrEqual(r['prazo'] as number);
    expect(r['mesmaTarefa']).toBe(true);
    expect(r['noPosto']).toBe(true);
    expect(r['voltouAoMesmoPosto']).toBe(true);
    expect(r['violacoes']).toEqual([]);
  });
});
