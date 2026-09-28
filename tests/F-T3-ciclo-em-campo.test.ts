/**
 * F-T3 — O ESPECIALISTA SAI DO PREDIO, LAVRA NO TILE E VOLTA PARA DEPOSITAR.
 *
 * Ate a F-T2c a pedra aparecia na gaveta com o pedreiro parado na porta: o tile
 * era reservado no quadro, o relogio andava dentro do predio e o mapa perdia
 * recurso a distancia. O aceite desta feature e o ciclo COMPLETO, medido tick a
 * tick sobre o cenario que ja existe:
 *
 *   trabalhando -> indo_colher -> colhendo -> voltando -> trabalhando
 *
 * O que este arquivo afirma, e que nenhum teste anterior podia afirmar:
 *
 * - a sequencia de estados, na ordem, em uma volta completa;
 * - a unidade ANDA — um tile por passo, nunca um salto — e chega ao tile da sua
 *   tarefa antes de `colhendo`;
 * - a gaveta `saida` NAO muda enquanto ele esta fora, e o tile do mapa tambem
 *   nao: os dois se movem no mesmo tick, o da volta;
 * - as invariantes da FSM e do quadro valem em TODOS os ticks do percurso, e nao
 *   so no comeco e no fim.
 *
 * Pedreira e fazenda, os dois oficios: a pedra nao bloqueia passo (o pedreiro
 * pisa no lajedo), o milho tambem nao, e a arvore bloqueia — quem prova a arvore
 * e a `F-T3-caminho`, na unidade certa para isso.
 */
import { describe, expect, it } from 'vitest';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { tilesDaPorta } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import { caixaDoPredio } from '../src/sim/footprint';
import { recursoNoTile } from '../src/sim/recursos';
import { cenarioDeFazenda, cenarioDePedreira, comEspacoNaSaida, saidaDe } from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const chebyshev = (a: TileDeGrid, b: TileDeGrid): number => Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao esta completo`);
  return p;
}

interface Passo {
  readonly tick: number;
  readonly fsm: string;
  readonly gx: number;
  readonly gy: number;
  readonly saida: number;
  readonly progresso: number;
  readonly tarefa: string | null;
  readonly tileDaTarefa: string | null;
  readonly restaNoTile: number | null;
}

/**
 * Roda a sim ate a gaveta `saida` do predio subir, gravando UM registro por
 * tick. Nenhuma assercao aqui: o teste le a trilha depois. `limite` e teto de
 * seguranca (ciclo que nunca fecha falha com a trilha na mao, e nao por timeout
 * mudo) — nao e afirmacao de desempenho (CLAUDE.md §8).
 */
function trilhaDeUmCiclo(
  inicial: GameState, predioId: string, unidadeId: string, mercadoria: string, limite = 400,
): { readonly trilha: readonly Passo[]; readonly fim: GameState } {
  const trilha: Passo[] = [];
  let estado = inicial;
  const saidaInicial = saidaDe(estado, predioId)[mercadoria] ?? 0;
  for (let tick = 1; tick <= limite; tick += 1) {
    estado = step(estado, []);
    const u = estado.unidades.porId[unidadeId];
    if (u === undefined) throw new Error(`fixture: '${unidadeId}' desapareceu no tick ${tick}`);
    const tarefaId = u.fsmData.tarefa ?? null;
    const t = tarefaId === null ? undefined : estado.jobs.tarefas.porId[tarefaId];
    const tile = t !== undefined && t.tipo === 'colher' ? t.origemTile : null;
    const predio = predioDe(estado, predioId);
    const saida = saidaDe(estado, predioId)[mercadoria] ?? 0;
    trilha.push({
      tick,
      fsm: u.fsm,
      gx: u.gx,
      gy: u.gy,
      saida,
      progresso: predio.producao?.progresso ?? -1,
      tarefa: tarefaId,
      tileDaTarefa: tile === null ? null : `${tile.gx},${tile.gy}`,
      restaNoTile: tile === null ? null : (recursoNoTile(estado, tile.gx, tile.gy)?.quantidade ?? 0),
    });
    // as invariantes valem em TODO tick do percurso, nao so nas pontas
    expect(violacoesDaFsmDoEspecialista(estado), `tick ${tick}`).toEqual([]);
    expect(violacoesDeInvariantes(estado), `tick ${tick}`).toEqual([]);
    if (saida > saidaInicial) return { trilha, fim: estado };
  }
  throw new Error(`o ciclo de '${predioId}' nao fechou em ${limite} ticks: ${JSON.stringify(trilha.slice(-6))}`);
}

/** Os ticks em que o estado MUDOU. E o que vale guardar como evidencia: a trilha
 *  inteira sao centenas de linhas iguais, e a informacao esta nas bordas. */
function transicoes(trilha: readonly Passo[]): Passo[] {
  return trilha.filter((p, i) => i === 0 || p.fsm !== trilha[i - 1]?.fsm);
}

/** A trilha colapsada: `['indo_colher','colhendo',...]`, um item por MUDANCA de
 *  estado. E nisso que a sequencia do aceite se le sem depender de quantos ticks
 *  cada trecho durou — a duracao e dado (`production.json`), a ordem e regra. */
function sequencia(trilha: readonly Passo[]): string[] {
  const s: string[] = [];
  for (const p of trilha) if (p.fsm !== s[s.length - 1]) s.push(p.fsm);
  return s;
}

describe('F-T3 — o ciclo em campo da pedreira', () => {
  const inicial = comEspacoNaSaida(cenarioDePedreira(), 'q1');
  const { trilha, fim } = trilhaDeUmCiclo(inicial, 'q1', 'u1', 'stone');
  const chegada = trilha[trilha.length - 1];
  const emCampo = trilha.filter((p) => p.fsm === 'colhendo');

  it('sai, colhe no tile e volta, nessa ordem', () => {
    // LOTE3-b2: o ciclo abre com o descanso DENTRO do predio (`trabalhando`), e o
    // pedreiro volta do tile para trabalhar na casa (as fases do KaM)
    expect(sequencia(trilha)).toEqual(['trabalhando', 'indo_colher', 'colhendo', 'voltando', 'trabalhando']);
  });

  it('anda um tile por passo, sem salto, e sai da porta', () => {
    const partida = inicial.unidades.porId['u1'];
    if (partida === undefined) throw new Error('fixture: u1 nao existe');
    let anterior: TileDeGrid = { gx: partida.gx, gy: partida.gy };
    for (const p of trilha) {
      expect(chebyshev(anterior, p), `tick ${p.tick}`).toBeLessThanOrEqual(1);
      anterior = p;
    }
    // ele SAIU: em algum tick esteve fora de qualquer tile de porta do proprio predio
    const portas = tilesDaPorta(predioDe(inicial, 'q1'), gameData).map((t) => `${t.gx},${t.gy}`);
    expect(trilha.some((p) => !portas.includes(`${p.gx},${p.gy}`))).toBe(true);
  });

  it('colhe ao lado do tile da sua tarefa, nunca de longe', () => {
    expect(emCampo.length).toBeGreaterThan(0);
    for (const p of emCampo) {
      expect(p.tileDaTarefa, `tick ${p.tick}`).not.toBeNull();
      const [gx, gy] = (p.tileDaTarefa ?? '0,0').split(',').map(Number);
      expect(chebyshev(p, { gx: gx ?? -9, gy: gy ?? -9 }), `tick ${p.tick}`).toBeLessThanOrEqual(1);
    }
  });

  it('a gaveta e o tile se movem no MESMO tick, o da volta', () => {
    const receita = receitaDoTipo('quarry', gameData);
    if (receita === null) throw new Error('fixture: quarry perdeu a receita');
    const antes = trilha.slice(0, -1);
    // nada entrou na gaveta enquanto ele estava fora
    for (const p of antes) expect(p.saida, `tick ${p.tick}`).toBe(0);
    expect(chegada?.saida).toBe(receita.sai['stone']);
    expect(chegada?.fsm).toBe('trabalhando');
    // e o tile perdeu o que virou mercadoria, tambem no tick da volta
    const noTile = emCampo.map((p) => p.restaNoTile);
    const cheio = noTile[0];
    expect(cheio).not.toBeNull();
    for (const q of noTile) expect(q).toBe(cheio);
    const tile = emCampo[0]?.tileDaTarefa?.split(',').map(Number) ?? [];
    const restou = recursoNoTile(fim, tile[0] ?? -1, tile[1] ?? -1)?.quantidade ?? 0;
    expect(restou).toBe((cheio ?? 0) - unidadesPorCiclo(receita));
  });

  it('a tarefa sai do quadro com o deposito', () => {
    expect(chegada?.tarefa).toBeNull();
    expect(fim.jobs.tarefas.ordem.filter((id) => fim.jobs.tarefas.porId[id]?.tipo === 'colher')).toEqual([]);
  });

  it('grava a trilha como evidencia da sessao', () => {
    gravarEvidencia('F-T3-ciclo-em-campo', {
      pergunta: 'o especialista sai do predio, colhe no tile e volta para depositar?',
      pedreira: {
        sequencia: sequencia(trilha),
        ticks: trilha.length,
        ticksDoCiclo: receitaDoTipo('quarry', gameData)?.ticksDoCiclo,
        ticksEmCampo: emCampo.length,
        transicoes: transicoes(trilha),
        ultimo: chegada,
      },
    });
    expect(trilha.length).toBeGreaterThan(emCampo.length);
  });
});

describe('F-T3 — o mesmo ciclo no roçado', () => {
  it('o roceiro sai da fazenda, vai ao milho e volta com a colheita', () => {
    const inicial = comEspacoNaSaida(cenarioDeFazenda(), 'f1');
    // F-CAMPO-a — o milho agora CRESCE no tile depois de semeado, e o primeiro
    // ciclo que entrega vem depois do crescer inteiro. O teto de seguranca soma o
    // crescer do dado aos 1200 de antes: e teto contra travar, nao assercao (§8).
    const crescer = gameData.recursos.tipos.corn?.reposicao?.ticksDeCrescer ?? 0;
    const { trilha, fim } = trilhaDeUmCiclo(inicial, 'f1', 'roceiro', 'corn', 1200 + crescer);
    const receita = receitaDoTipo('farm', gameData);
    if (receita === null) throw new Error('fixture: farm perdeu a receita');
    // a fazenda pode PLANTAR antes de ter o que colher (F18): a sequencia do ciclo
    // que entrega e o SUFIXO da trilha, e e ele que esta sob teste aqui.
    expect(sequencia(trilha).slice(-4)).toEqual(['indo_colher', 'colhendo', 'voltando', 'trabalhando']);
    const chegada = trilha[trilha.length - 1];
    expect(chegada?.saida).toBe(receita.sai['corn']);
    expect(trilha.filter((p) => p.fsm === 'colhendo').length).toBeGreaterThan(0);
    // e ele colheu FORA do proprio footprint: o tile debaixo da fazenda nao entra
    // na escolha desde a Tarefa 2, e aqui isso se ve no percurso
    const caixa = caixaDoPredio(predioDe(fim, 'f1'), gameData);
    if (caixa === null) throw new Error('fixture: f1 sem caixa');
    for (const p of trilha) {
      const dentro = p.gx >= caixa.x0 && p.gx < caixa.x1 && p.gy >= caixa.y0 && p.gy < caixa.y1;
      expect(dentro, `tick ${p.tick}: pisou no proprio footprint`).toBe(false);
    }
    gravarEvidencia('F-T3-ciclo-do-rocado', {
      pergunta: 'o roceiro faz o mesmo ciclo, no milho?',
      sequencia: sequencia(trilha),
      ticks: trilha.length,
      colheu: chegada?.saida,
      transicoes: transicoes(trilha),
      ultimo: trilha[trilha.length - 1],
    });
  });
});
