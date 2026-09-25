/**
 * F-T4b — O LENHADOR SAI PARA COLHER, partindo do ESTADO INICIAL.
 *
 * A F15a afirma a forma do dado e a F17 afirma que a vila abre e que o timber
 * sobe. Nenhuma das duas afirma o CAMINHO: um lenhador produzindo parado dentro
 * da casa fecharia as duas de verde, e foi exatamente esse o defeito que a F-T3
 * corrigiu para a classe inteira. Aqui a perna que faltava — pedido do operador
 * em 2026-09-25: "partindo do estado inicial novo, o lenhador produz tora pelo
 * caminho real, e o timber no armazem volta a subir".
 *
 * O cenario NAO e fixture: e a abertura da Fase A rodando por comando, a mesma
 * de `tests/F17-aceite.test.ts`. O que este arquivo acrescenta e a trilha por
 * tick do ocupante da primeira casa de lenhador, do momento em que ele ocupa ate
 * a tora sair da casa e a tabua dela CHEGAR ao armazem.
 *
 * A medida do timber e o ACUMULADO ENTREGUE, nao o saldo: neste trecho da
 * partida o timber esta sendo GASTO nas obras da propria abertura (40 no tick 0,
 * 31 no tick 2500, com tabua entrando o tempo todo), e o saldo so volta a passar
 * do inicial no tick 4266 — que e a perna medida pela F17, com o teto dela. Aqui
 * o eixo e "a tora virou tabua e a tabua chegou", que e o que o caminho prova.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { chaveDeTile, tileDeChave } from '../src/sim/estradas';
import { caixaDeTipo } from '../src/sim/footprint';
import { tileAndavel } from '../src/sim/pathfinding';
import { estoqueDosArmazens } from '../src/sim/selectors';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { aberturaDaFaseA, comandosNoTick, criarMedidor } from './helpers/abertura';
import { gravarEvidencia } from './helpers/evidence';

/** Sonda desta sessao: ocupa em 499, primeira tora em 1247, tabua em 2417. */
const TETO = 3000;

interface PassoDoLenhador {
  readonly tick: number;
  readonly fsm: string;
  readonly gx: number;
  readonly gy: number;
  readonly arvore: string | null;
}

const cheb = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number =>
  Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

/** Chebyshev do tile ao FOOTPRINT do predio — zero se esta dentro dele. */
function doFootprint(predio: PredioCompleto, t: { gx: number; gy: number }): number {
  const caixa = caixaDeTipo(predio.tipo, predio.gx, predio.gy, gameData);
  if (caixa === null) throw new Error(`fixture: '${predio.tipo}' sem tamanho`);
  const dx = t.gx < caixa.x0 ? caixa.x0 - t.gx : t.gx >= caixa.x1 ? t.gx - (caixa.x1 - 1) : 0;
  const dy = t.gy < caixa.y0 ? caixa.y0 - t.gy : t.gy >= caixa.y1 ? t.gy - (caixa.y1 - 1) : 0;
  return Math.max(dx, dy);
}

function predioNoTile(estado: GameState, gx: number, gy: number): PredioCompleto {
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p !== undefined && p.gx === gx && p.gy === gy && p.estado === 'completo') return p;
  }
  throw new Error(`a abertura nao completou predio em ${gx},${gy}`);
}

describe('F-T4b — o lenhador da abertura sai, colhe e a tora chega', () => {
  let s = createInitialState(gameData.economia.estadoInicial.semente);
  const abertura = aberturaDaFaseA(s);
  const primeiroDaMata = abertura.plantas.find((p) => p.tipo === 'woodcutters');
  if (primeiroDaMata === undefined) throw new Error('a abertura nao tem casa de lenhador');
  const timberInicial = estoqueDosArmazens(s)['timber'] ?? 0;
  const medidor = criarMedidor(s, abertura);

  const trilha: PassoDoLenhador[] = [];
  let ocupante: string | null = null;
  let partida: { gx: number; gy: number } | null = null;
  let tickDaOcupacao: number | null = null;
  let tickDaTora: number | null = null;
  let toras = 0;

  for (let i = 0; i < TETO; i += 1) {
    s = step(s, comandosNoTick(s, abertura, i));
    medidor.observar(s);
    const idDaCasa = s.predios.ordem.find((id) => {
      const p = s.predios.porId[id];
      return p !== undefined && p.gx === primeiroDaMata.gx && p.gy === primeiroDaMata.gy;
    });
    const casa = idDaCasa === undefined ? undefined : s.predios.porId[idDaCasa];
    if (casa === undefined || casa.estado !== 'completo' || casa.ocupante === null) continue;
    if (ocupante === null) {
      ocupante = casa.ocupante;
      tickDaOcupacao = i;
      const inicio = s.unidades.porId[ocupante];
      if (inicio === undefined) throw new Error(`o ocupante '${ocupante}' nao existe`);
      partida = { gx: inicio.gx, gy: inicio.gy };
    }
    const u = s.unidades.porId[ocupante];
    if (u === undefined) throw new Error(`o ocupante '${ocupante}' sumiu no tick ${i}`);
    const tarefaId = u.fsmData.tarefa ?? null;
    const tarefa = typeof tarefaId === 'string' ? s.jobs.tarefas.porId[tarefaId] : undefined;
    const arvore = tarefa !== undefined && tarefa.tipo === 'colher' ? tarefa.origemTile : null;
    trilha.push({
      tick: i,
      fsm: u.fsm,
      gx: u.gx,
      gy: u.gy,
      arvore: arvore === null || arvore === undefined ? null : chaveDeTile(arvore),
    });
    expect(violacoesDaFsmDoEspecialista(s, gameData), `tick ${i}`).toEqual([]);
    expect(violacoesDeInvariantes(s, gameData), `tick ${i}`).toEqual([]);
    const naGaveta = casa.estoque.saida['tree_trunk'] ?? 0;
    if (naGaveta > toras) {
      toras = naGaveta;
      if (tickDaTora === null) tickDaTora = i;
    }
    if (tickDaTora !== null && (medidor.resultado().entregueAoArmazem['timber'] ?? 0) > 0) break;
  }

  const casaFinal = predioNoTile(s, primeiroDaMata.gx, primeiroDaMata.gy);
  const colhendo = trilha.filter((p) => p.fsm === 'colhendo');
  const noArmazem = estoqueDosArmazens(s);
  const entregue = medidor.resultado().entregueAoArmazem;

  gravarEvidencia('F-T4b-lenhador', {
    feature: 'F-T4b — o lenhador sai para colher',
    semente: gameData.economia.estadoInicial.semente,
    tetoDeTicks: TETO,
    casa: `${casaFinal.tipo}@${casaFinal.gx},${casaFinal.gy}`,
    ocupante,
    tickDaOcupacao,
    tickDaPrimeiraTora: tickDaTora,
    timberInicial,
    timberFinal: noArmazem['timber'] ?? 0,
    entregueAoArmazem: entregue,
    ticksDeTrilha: trilha.length,
    ticksColhendo: colhendo.length,
    arvoreReclamada: colhendo[0]?.arvore ?? null,
    distanciaDaArvoreAoFootprint:
      colhendo[0] === undefined
        ? null
        : doFootprint(casaFinal, tileDeChave(colhendo[0].arvore ?? '0,0')),
    sequenciaDeFsm: trilha.reduce<string[]>((acc, p) => {
      if (p.fsm !== acc[acc.length - 1]) acc.push(p.fsm);
      return acc;
    }, []),
    primeirosPassos: trilha.slice(0, 40),
  });

  it('(a) sai da casa, colhe e volta, e nunca salta mais de um tile por tick', () => {
    const sequencia: string[] = [];
    for (const p of trilha) if (p.fsm !== sequencia[sequencia.length - 1]) sequencia.push(p.fsm);
    // a trilha comeca no tick da OCUPACAO, com ele ja dentro da casa; o ciclo
    // inteiro e o que vem depois da primeira saida.
    expect(sequencia[0]).toBe('trabalhando');
    expect(sequencia.slice(1, 5)).toEqual(['indo_colher', 'colhendo', 'voltando', 'trabalhando']);
    if (partida === null) throw new Error('o lenhador nunca ocupou a casa');
    let anterior = partida;
    for (const p of trilha) {
      expect(cheb(anterior, p), `tick ${p.tick}`).toBeLessThanOrEqual(1);
      anterior = { gx: p.gx, gy: p.gy };
    }
  });

  it('(b) colhe DE FORA da casa, encostado na arvore, de tile que se pisa', () => {
    expect(colhendo.length).toBeGreaterThan(0);
    for (const p of colhendo) {
      expect(p.arvore, `tick ${p.tick}`).not.toBeNull();
      const arvore = tileDeChave(p.arvore ?? '0,0');
      expect(cheb(p, arvore), `tick ${p.tick}`).toBe(1);
      expect(doFootprint(casaFinal, p), `tick ${p.tick}`).toBeGreaterThan(0);
      expect(tileAndavel(s, { gx: p.gx, gy: p.gy }, 'livre', gameData), `tick ${p.tick}`).toBe(true);
      // e o que da sentido as duas de cima: a arvore NAO se pisa (F-T2b)
      expect(tileAndavel(s, arvore, 'livre', gameData), `tick ${p.tick}`).toBe(false);
    }
  });

  it('(c) a tora sai da casa e a tabua dela chega ao armazem', () => {
    expect(toras).toBeGreaterThan(0);
    expect(entregue['tree_trunk'] ?? 0).toBeGreaterThan(0);
    expect(entregue['timber'] ?? 0).toBeGreaterThan(0);
  });

  it('(d) e a abertura continua exercitando CAMINHADA: a mata nao encosta na casa', () => {
    const p = colhendo[0];
    if (p === undefined) throw new Error('trilha sem tick de colheita');
    // sem isto, (a) e (b) passariam com o lenhador saindo pela porta e voltando
    expect(doFootprint(casaFinal, tileDeChave(p.arvore ?? '0,0'))).toBeGreaterThan(1);
  });
});
