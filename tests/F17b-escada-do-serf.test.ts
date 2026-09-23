/**
 * A ESCADA DO SERF, coberta por comportamento. Nao e teste da F17b: e a sonda
 * que o operador pediu em 2026-09-23 virando cobertura permanente, hospedada
 * neste item por decisao dele.
 *
 * Por que aqui e por que agora: a regra esta INERTE na Fase A. Medido — em 4000
 * ticks da abertura inteira os serfs fizeram 88 escolhas e em ZERO tick havia
 * tarefa de obra e tarefa para o armazem abertas ao mesmo tempo (com 4 serfs a
 * fila do quadro nunca acumula, `BALANCE_LOG.md` 2026-09-23). Ela passa a
 * importar na Fase B, quando a cadeia de comida tiver mais consumidores que
 * serfs — e ai ninguem vai lembrar de provar que funciona.
 *
 * O que este arquivo prova, e o que NAO prova: prova a ESCOLHA, passando por
 * `step` de verdade. `tarefasEmOrdem` sozinha e a ordenacao, nao a escolha —
 * a suite existente cobre a escada como DADO (comparacoes de `nivelDoTipo`) e
 * um unico cruzamento de comportamento (`F13a-ouro.test.ts`, ouro nivel 2 na
 * frente de material nivel 3), e nenhum cruzamento entre material-para-obra e
 * os dois tipos que vao para o armazem.
 *
 * Nao toca `src/` nenhum: monta estado e chama `step`.
 */
import { describe, expect, it } from 'vitest';
import type { GameState, PredioCompleto, TarefaDeTransporte } from '../src/sim/state';
import { ehTarefaDeTransporte } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { buscarCaminho } from '../src/sim/pathfinding';
import { cenarioDePedreira } from './helpers/producao-cenario';
import { comEstradas, comObra, comUnidadeExtra, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const SERF = 'serf-da-escada';
const OBRA = 'obra-longe';
const PEDREIRA = 'q1';

/** Onde o serf nasce: em cima da porta da pedreira, que e a ORIGEM das duas
 *  tarefas de nivel 6 e 7. Colado nelas, e a 15 tiles da obra. */
const POSTO_DO_SERF = { gx: 27, gy: 36 };

const PARA_O_ARMAZEM = ['saida-cheia-para-armazem', 'excedente-para-armazem'];

/**
 * A pedreira ganha carga nas DUAS gavetas:
 *  - `saida` com pedra  -> nivel 6 (`saida-cheia-para-armazem`);
 *  - `entrada` com tabua -> nivel 7 (`excedente-para-armazem`), porque a
 *    pedreira nao consome tabua, entao `alvoDeEntrada` e 0 e tudo ali e
 *    excedente.
 * As duas saem do MESMO predio, de proposito: e o predio que fica aos pes do serf.
 */
function comCargaNaPedreira(estado: GameState, id: string): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = {
    ...p,
    estoque: { entrada: { ...p.estoque.entrada, timber: 2 }, saida: { ...p.estoque.saida, stone: 2 } },
  };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/**
 * Pedreira `q1` (26,34) ja ligada ao armazem (porta 29,33). A rua de y=36 vai
 * ate x=45 e a obra fica em (42,34) — porta y=36, x 42..44.
 *
 * A fixture confere a si mesma: coordenada errada falha AQUI, com o motivo
 * escrito, e nao tres `expect` adiante como "nao reclamou nada".
 */
function cenario(comAObra: boolean): GameState {
  let s = comCargaNaPedreira(cenarioDePedreira(), PEDREIRA);
  s = comEstradas(s, Array.from({ length: 45 - 29 + 1 }, (_, i) => tile(29 + i, 36)));
  if (comAObra) {
    s = comObra(s, OBRA, { gx: 42, gy: 34, tipo: 'quarry', faltam: { stone: 2 } });
    const obra = s.predios.porId[OBRA];
    if (obra === undefined || !predioLigadoAoArmazem(s, obra)) {
      throw new Error('fixture: a obra longe nao ficou ligada ao armazem — geometria errada');
    }
  }
  return comUnidadeExtra(s, SERF, 'serf', POSTO_DO_SERF.gx, POSTO_DO_SERF.gy);
}

/** O tipo da primeira tarefa que o serf reclamou, deixando o `step` rodar. */
function oQueOSerfPegou(estado: GameState, ticks = 5): { tipo: string | null; cardapio: Record<string, number> } {
  let s = estado;
  for (let i = 0; i < ticks; i++) {
    const abertas: Record<string, number> = {};
    for (const id of s.jobs.tarefas.ordem) {
      const t = s.jobs.tarefas.porId[id];
      if (t === undefined || !ehTarefaDeTransporte(t) || t.estado !== 'aberta') continue;
      abertas[t.tipo] = (abertas[t.tipo] ?? 0) + 1;
    }
    s = step(s, []);
    for (const id of s.jobs.tarefas.ordem) {
      const t = s.jobs.tarefas.porId[id];
      if (t === undefined || !ehTarefaDeTransporte(t)) continue;
      const tt = t as TarefaDeTransporte;
      if (tt.reclamadaPor === SERF) return { tipo: tt.tipo, cardapio: abertas };
    }
  }
  return { tipo: null, cardapio: {} };
}

/** Custo A* a pe do posto do serf ate a porta de um predio. Derivado das
 *  posicoes, nunca digitado: uma distancia literal aqui deixaria de valer no
 *  dia em que alguem mexesse na geometria da fixture. */
function custoAtePortaDe(estado: GameState, predioId: string): number {
  const predio = estado.predios.porId[predioId];
  if (predio === undefined) throw new Error(`fixture: '${predioId}' fora do estado`);
  const portas = tilesDaPorta(predio, gameData);
  const caminho = buscarCaminho(estado, POSTO_DO_SERF, portas, 'livre', gameData);
  if (caminho === null) throw new Error(`fixture: nao ha caminho ate a porta de '${predioId}'`);
  return caminho.custo;
}

describe('a escada de delivery.json decide a escolha do serf, nao a distancia', () => {
  it('CONTROLE: sem obra no mapa, o serf reclama a tarefa que vai para o armazem', () => {
    // Sem isto, "foi para a obra" no teste seguinte poderia ser "nao conseguiu
    // reclamar a outra". O controle prova que a tarefa do armazem existia, era
    // alcancavel e ele a pegaria.
    const escolha = oQueOSerfPegou(cenario(false));
    expect(PARA_O_ARMAZEM).toContain(escolha.tipo);
  });

  it('a montagem e adversarial: a carga do armazem esta MAIS PERTO que a obra', () => {
    // Se a obra estivesse mais perto, o teste passaria provando distancia, nao
    // escada — e passaria pelo motivo errado. Os dois custos saem do A* real.
    const s = cenario(true);
    const ateAPedreira = custoAtePortaDe(s, PEDREIRA);
    const ateAObra = custoAtePortaDe(s, OBRA);
    expect(ateAPedreira).toBeLessThan(ateAObra);
    gravarEvidencia('F17b-escada', {
      montagem: 'pedreira (26,34) com carga nas duas gavetas; obra (42,34); serf em (27,36)',
      custoAtePortaDaPedreira: ateAPedreira,
      custoAtePortaDaObra: ateAObra,
    });
  });

  it('com material-para-obra, saida-cheia e excedente abertas, ele vai a OBRA', () => {
    const escolha = oQueOSerfPegou(cenario(true));
    // o cardapio tinha mesmo os tres tipos na mesa
    expect(Object.keys(escolha.cardapio).sort())
      .toEqual(['excedente-para-armazem', 'material-para-obra', 'saida-cheia-para-armazem']);
    expect(escolha.tipo).toBe('material-para-obra');
  });
});
