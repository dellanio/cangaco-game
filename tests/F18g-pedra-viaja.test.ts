/**
 * F18g — A PEDRA DA ESTRADA VIRA CARGA QUE VIAJA (Opcao A: reserva por tile).
 *
 * O aceite (BUILD_PLAN.md): num cenario com rua desenhada, (a) uma carga de pedra
 * EXISTE EM TRANSITO (serf com `carga` a caminho do tile), (b) o laborer ESPERA NO
 * TILE enquanto ela nao chega, (c) a pedra sai do armazem na ENTREGA e nao no
 * assentamento, e (d) a conservacao de bens fecha com a pedra PARADA NO TILE contada.
 *
 * O cenario e o mesmo da F18d-1b-aceite: a rua que liga a escola ao armazem do estado
 * inicial, dois laborers e quatro serfs. As quatro afirmacoes sao medidas na MESMA
 * corrida, tick a tick, e nao numa ponta: o que se afirma e que o serf carregou, que o
 * laborer esperou, que o armazem so perdeu pedra em tick de coleta, e que
 * `armazem + mao + tile + rua x custo` nao se moveu um tick sequer.
 *
 * Mais a perna do save (F23 fechou antes desta feature, entao campo novo e migracao):
 * `VERSAO_DO_SAVE` subiu, um save da versao 1 e recusado com nome, e o teste canonico
 * de determinismo salva num tick escolhido pela condicao "ha pedra parada em tile" —
 * o ponto cego medido na F23 (a vila regenera tarefa e reconverge) vale aqui igual, por
 * isso a igualdade e afirmada tambem no INSTANTE do load.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import { ehTarefaDePedraParaCanteiro } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { MERCADORIA_DA_ESTRADA, pedraNoTile, predioLigadoAoArmazem, tilesDaPorta, tilesOrdenados } from '../src/sim/estradas';
import { carregar, salvar, VERSAO_DO_SAVE } from '../src/sim/save';
import { inicial, linhaH, tile } from './helpers/jobs-cenario';
import { bensPorMercadoria, violacoesDaFsm } from './helpers/serf-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

const CUSTO = gameData.terreno.estrada.custoStonePorTile;
const TETO = 600;

const predio = (e: GameState, tipo: string) => {
  const p = e.predios.ordem.map((id) => e.predios.porId[id]).find((x) => x?.tipo === tipo);
  if (!p) throw new Error(`fixture: cenario sem ${tipo}`);
  return p;
};
const armazem = predio(inicial, 'storehouse');
const escola = predio(inicial, 'schoolhouse');

/** A rua que ligaria as duas portas, correndo na linha logo abaixo do armazem. */
const RUA = (() => {
  const xs = [...tilesDaPorta(armazem, gameData), ...tilesDaPorta(escola, gameData)].map((t) => t.gx);
  return linhaH(Math.min(...xs), Math.max(...xs), armazem.gy + 3);
})();

const dePe = (e: GameState): number => Object.keys(e.estradas).length;
const desenhados = (e: GameState): number => Object.keys(e.estradasPlanejadas).length;
const noTile = (e: GameState): number => Object.values(e.pedraNoCanteiro).reduce((a, b) => a + b, 0);
const naSaidaDoArmazem = (e: GameState): number => {
  const p = e.predios.porId[armazem.id];
  return p && p.estado === 'completo' ? p.estoque.saida[MERCADORIA_DA_ESTRADA] ?? 0 : Number.NaN;
};
const bens = (e: GameState): number => bensPorMercadoria(e)[MERCADORIA_DA_ESTRADA] ?? 0;
/** A soma que nao pode se mover: pedra em qualquer lugar (armazem, mao, tile) mais a rua. */
const pedraMaisRua = (e: GameState): number => bens(e) + dePe(e) * CUSTO;

interface SerfEmTransito { readonly tick: number; readonly serf: string; readonly tarefa: string; readonly para: string }
interface LaborerEsperando { readonly tick: number; readonly laborer: string; readonly em: string; readonly pedraNoTile: number }

/** Quem esta com pedra na mao a caminho de um TILE do canteiro, neste tick. */
function serfsEmTransito(e: GameState): SerfEmTransito[] {
  const lista: SerfEmTransito[] = [];
  for (const id of e.unidades.ordem) {
    const u = e.unidades.porId[id];
    if (!u || u.tipo !== 'serf' || u.fsm !== 'indo_entregar' || u.fsmData.carga !== MERCADORIA_DA_ESTRADA) continue;
    const t = u.fsmData.tarefa === undefined ? undefined : e.jobs.tarefas.porId[u.fsmData.tarefa];
    if (t !== undefined && ehTarefaDePedraParaCanteiro(t)) {
      lista.push({ tick: e.tick, serf: id, tarefa: t.id, para: `${t.destinoTile.gx},${t.destinoTile.gy}` });
    }
  }
  return lista;
}

/** Quem esta parado num tile do canteiro, esperando a pedra dele, neste tick. */
function laborersEsperando(e: GameState): LaborerEsperando[] {
  const lista: LaborerEsperando[] = [];
  for (const id of e.unidades.ordem) {
    const u = e.unidades.porId[id];
    if (!u || u.tipo !== 'laborer' || u.fsm !== 'esperando_material') continue;
    const t = u.fsmData.tarefa === undefined ? undefined : e.jobs.tarefas.porId[u.fsmData.tarefa];
    if (t?.tipo === 'assentar-estrada' && u.gx === t.destinoTile.gx && u.gy === t.destinoTile.gy) {
      lista.push({ tick: e.tick, laborer: id, em: `${u.gx},${u.gy}`, pedraNoTile: pedraNoTile(e, t.destinoTile) });
    }
  }
  return lista;
}

const evidencia: Record<string, unknown> = {};

describe('F18g — a pedra viaja do armazem ao tile, e o laborer a espera la', () => {
  it('as quatro afirmacoes do aceite, medidas tick a tick numa corrida so', () => {
    let estado = step(inicial, [{ type: 'PlaceRoad', tiles: RUA }]);
    expect(estado.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(desenhados(estado)).toBe(RUA.length);
    expect(naSaidaDoArmazem(estado)).toBe(naSaidaDoArmazem(inicial)); // o comando nao debita
    const constante = pedraMaisRua(inicial);

    const transito: SerfEmTransito[] = [];
    const espera: LaborerEsperando[] = [];
    const coletas: { tick: number; saiu: number }[] = [];
    const assentamentos: { tick: number; novos: number; saidaDoArmazem: number }[] = [];
    let ticksComPedraNoTile = 0;
    let maxNoTile = 0;

    for (let n = 0; n < TETO && desenhados(estado) > 0; n += 1) {
      const antes = estado;
      estado = step(estado, []);

      // (d) a soma nao se move em tick nenhum: nem no comando, nem na coleta (armazem ->
      //     mao), nem na entrega (mao -> tile), nem no assentamento (tile -> rua)
      expect(pedraMaisRua(estado), `pedra + rua no tick ${estado.tick}`).toBe(constante);
      if (noTile(estado) > 0) ticksComPedraNoTile += 1;
      maxNoTile = Math.max(maxNoTile, noTile(estado));

      // (c) o armazem so perde pedra em tick de COLETA — e nunca no tick em que um
      //     tile e assentado sem coleta junto
      const saiu = naSaidaDoArmazem(antes) - naSaidaDoArmazem(estado);
      const novos = dePe(estado) - dePe(antes);
      if (saiu > 0) coletas.push({ tick: estado.tick, saiu });
      if (novos > 0) assentamentos.push({ tick: estado.tick, novos, saidaDoArmazem: naSaidaDoArmazem(estado) });
      if (saiu > 0) {
        // toda unidade que saiu do armazem esta na mao de um serf com tarefa de pedra
        // — ou ja foi entregue no mesmo tick; o que se afirma e que NAO ha saida
        // sem carga: `bens` (que conta mao e tile) nao caiu
        expect(bens(estado)).toBe(bens(antes));
      }
      if (novos > 0) {
        // assentar nao mexe no armazem: a saida so muda se houve coleta neste tick
        const coletouAgora = coletas.some((c) => c.tick === estado.tick);
        if (!coletouAgora) expect(naSaidaDoArmazem(estado)).toBe(naSaidaDoArmazem(antes));
      }

      transito.push(...serfsEmTransito(estado));
      espera.push(...laborersEsperando(estado));

      expect(violacoesDeInvariantes(estado), `quadro no tick ${estado.tick}`).toEqual([]);
      expect(violacoesDaFsm(estado), `serfs no tick ${estado.tick}`).toEqual([]);
      expect(violacoesDaFsmDoLaborer(estado), `laborers no tick ${estado.tick}`).toEqual([]);
    }

    // a rua inteira ficou de pe, e liga
    expect(desenhados(estado)).toBe(0);
    expect(dePe(estado)).toBe(RUA.length);
    expect(predioLigadoAoArmazem(estado, escola, gameData)).toBe(true);
    expect(estado.pedraNoCanteiro).toEqual({});
    expect(naSaidaDoArmazem(estado)).toBe(naSaidaDoArmazem(inicial) - RUA.length * CUSTO);

    // (a) houve carga em transito: serf com pedra na mao, a caminho de um tile
    expect(transito.length).toBeGreaterThan(0);
    expect(new Set(transito.map((t) => t.para)).size).toBeGreaterThan(1);
    // (b) houve laborer esperando NO tile — no proprio tile, com a pedra ainda por vir
    expect(espera.length).toBeGreaterThan(0);
    expect(espera.every((l) => l.pedraNoTile < CUSTO)).toBe(true);
    // (c) toda pedra saiu do armazem numa coleta (nunca no comando, nunca so no assentamento)
    expect(coletas.reduce((s, c) => s + c.saiu, 0)).toBe(RUA.length * CUSTO);
    expect(coletas[0]?.tick ?? 0).toBeGreaterThan(inicial.tick + 1);
    expect(assentamentos.reduce((s, a) => s + a.novos, 0)).toBe(RUA.length);
    // (d) a pedra parada no tile foi contada — e existiu de verdade nesta corrida
    expect(ticksComPedraNoTile).toBeGreaterThan(0);
    expect(maxNoTile).toBeGreaterThan(0);

    evidencia['aceite'] = {
      rua: { tiles: RUA.length, de: RUA[0], ate: RUA[RUA.length - 1] },
      tickDoUltimoAssentamento: estado.tick,
      a: { serfsEmTransito: transito.length, tilesDeDestinoDistintos: new Set(transito.map((t) => t.para)).size, primeira: transito[0] },
      b: { ticksDeLaborerEsperandoNoTile: espera.length, primeira: espera[0] },
      c: { coletas, assentamentos, pedraNoArmazemAntes: naSaidaDoArmazem(inicial), depois: naSaidaDoArmazem(estado) },
      d: { pedraMaisRuaConstante: constante, ticksComPedraNoTile, maximoParadoNoTile: maxNoTile },
    };
  });

  it('o tile demolido com a pedra ja na mao do serf: ele devolve ao armazem, e a soma nao se move', () => {
    let estado = step(inicial, [{ type: 'PlaceRoad', tiles: RUA }]);
    const constante = pedraMaisRua(inicial);
    let emTransito: SerfEmTransito | undefined;
    for (let n = 0; n < TETO && emTransito === undefined; n += 1) {
      estado = step(estado, []);
      emTransito = serfsEmTransito(estado)[0];
    }
    if (emTransito === undefined) throw new Error('fixture: nenhum serf saiu com pedra para o canteiro');
    const [gx, gy] = emTransito.para.split(',').map(Number) as [number, number];

    const demolido = step(estado, [{ type: 'DemolishRoad', tiles: [tile(gx, gy)] }]);
    expect(demolido.jobs.tarefas.porId[emTransito.tarefa]).toBeUndefined();
    expect(pedraMaisRua(demolido)).toBe(constante);
    const serf = demolido.unidades.porId[emTransito.serf];
    expect(serf?.fsm).toBe('devolvendo');
    expect(serf?.fsmData.carga).toBe(MERCADORIA_DA_ESTRADA);

    let devolveu = false;
    let atual = demolido;
    for (let n = 0; n < TETO && !devolveu; n += 1) {
      atual = step(atual, []);
      expect(pedraMaisRua(atual)).toBe(constante);
      devolveu = atual.events.some((e) => e.type === 'cargo-returned' && e.unidade === emTransito?.serf);
    }
    expect(devolveu).toBe(true);
    expect(violacoesDeInvariantes(atual)).toEqual([]);
    evidencia['demolidoEmTransito'] = { tileDemolido: emTransito.para, serf: emTransito.serf, devolveuNoTick: atual.tick };
  });
});

describe('F18g — o save: campo novo e migracao', () => {
  const comandosNoTick = (t: number): readonly { readonly type: 'PlaceRoad'; readonly tiles: typeof RUA }[] =>
    (t === 0 ? [{ type: 'PlaceRoad', tiles: RUA }] : []);
  const cenario = (e: GameState): GameState => (e.tick === 0 ? inicial : e);

  /** O primeiro tick com pedra PARADA em tile — escolhido pela condicao, nao digitado. */
  const tickComPedraNoTile = (): number => {
    let estado = inicial;
    for (let n = 0; n < TETO; n += 1) {
      estado = step(estado, comandosNoTick(estado.tick));
      if (noTile(estado) > 0) return estado.tick;
    }
    throw new Error('fixture: nenhuma pedra descansou em tile');
  };

  it('a versao do save subiu, e um save da versao anterior e recusado com nome', () => {
    // F-CERCO-a1 subiu de novo (3); o que a F18g guarda e ter passado da 1.
    expect(VERSAO_DO_SAVE).toBeGreaterThanOrEqual(2);
    const texto = salvar(inicial, gameData);
    const antigo = JSON.stringify({ ...(JSON.parse(texto) as Record<string, unknown>), versao: 1 });
    expect(() => carregar(antigo, gameData)).toThrow(/versao 1/);
  });

  it('salvar com pedra parada em tile: igual no INSTANTE do load, e igual 500 ticks depois', () => {
    const tickDoSave = tickComPedraNoTile();
    // o instante: o campo esta cheio nesse tick, e o round-trip pelo envelope nao o perde
    let estado = inicial;
    for (let n = 0; n < tickDoSave; n += 1) estado = step(estado, comandosNoTick(estado.tick));
    expect(noTile(estado)).toBeGreaterThan(0);
    const carregado = carregar(salvar(estado, gameData), gameData);
    expect(carregado).toEqual(estado);
    expect(carregado.pedraNoCanteiro).toEqual(estado.pedraNoCanteiro);

    // os 500 ticks: o teste canonico, com o cenario injetado e o envelope de verdade
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: tickDoSave + 500,
      saveAtTick: tickDoSave,
      antesDoStep: cenario,
      comandosNoTick,
      roundTrip: (e) => carregar(salvar(e, gameData), gameData),
    });
    expect(comSave).toBe(direto);
    evidencia['save'] = { tickDoSave, pedraNoTileNoSave: estado.pedraNoCanteiro, versao: VERSAO_DO_SAVE };
  });
});

afterAll(() => {
  gravarEvidencia('F18g', {
    feature: 'F18g — a pedra da estrada vira carga que viaja (Opcao A: reserva por tile)',
    aceite: '(a) carga em transito, (b) laborer espera no tile, (c) a pedra sai do armazem na entrega, (d) conservacao com a pedra parada no tile',
    custoStonePorTile: CUSTO,
    ruaDoCenario: tilesOrdenados(Object.fromEntries(RUA.map((t) => [`${t.gx},${t.gy}`, true as const]))),
    ...evidencia,
  });
});
