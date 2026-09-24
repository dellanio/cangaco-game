/**
 * F18d-1b — a tarefa `'assentar-estrada'`.
 *
 * Um tile planejado vira trabalho de laborer: a tarefa entra na escada de
 * `delivery.json` (nivel 8, `modo: 'livre'` — canteiro nao tem rua para chegar),
 * o DESTINO dela e um TILE e nao um predio, e ela reserva a pedra do
 * assentamento no armazem que vai pagar. A reserva vale desde `aberta`: e o
 * clique que compromete a pedra, senao dois tracados no mesmo tick gastariam a
 * mesma unidade.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { criarTarefaDeAssentamento, elegivelParaTarefa, modoDoTipo, nivelDoTipo } from '../src/sim/jobs';
import { armazemQuePagaAEstrada, MERCADORIA_DA_ESTRADA } from '../src/sim/estradas';
import { disponivelNaOrigem, reservadoNaOrigem } from '../src/sim/reservas';
import { ehTarefaDeAssentamento, ehTarefaDeTransporte } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { step } from '../src/sim/tick';
import { ehEstrada, ehPlanejada, tilesOrdenados } from '../src/sim/estradas';
import {
  armazemDoCenario, cenarioLigado, comPedraNaSaida, comPlanejadas, linhaH, semLaborers, tile,
} from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';

const TILE = { gx: 29, gy: 36 } as const;

function comPedra(pedra: number): GameState {
  const base = cenarioLigado({ stone: 2 });
  return comPedraNaSaida(base, armazemDoCenario(base).id, pedra);
}

describe('F18d-1b — a escada acolhe `assentar-estrada` sem mexer em nivel nenhum', () => {
  it('os SETE niveis de hoje continuam onde estavam, e o novo entra em oitavo', () => {
    // a lista inteira, lida do dado, comparada de uma vez: se a linha nova tivesse
    // entrado no meio, seis destes numeros mudariam de uma vez so.
    const escada = gameData.entrega.prioridades.map((p) => [p.id, nivelDoTipo(p.id as never)]);
    expect(escada).toEqual([
      ['comida-para-inn', 1],
      ['ouro-para-escola', 2],
      ['material-para-obra', 3],
      ['insumo-producao-parada', 4],
      ['insumo-producao-baixa', 5],
      ['saida-cheia-para-armazem', 6],
      ['excedente-para-armazem', 7],
      ['assentar-estrada', 8],
    ]);
  });

  it('o modo do nivel novo e `livre`: o canteiro nao tem rua para se chegar nele', () => {
    expect(modoDoTipo('assentar-estrada')).toBe('livre');
    // e o vizinho de baixo continua exigindo rua — a F18d-1a nao foi desfeita
    expect(modoDoTipo('excedente-para-armazem')).toBe('estrada');
  });

  it('so o laborer e elegivel: assentar e obra, nao carga', () => {
    expect(elegivelParaTarefa('assentar-estrada', 'laborer')).toBe(true);
    expect(elegivelParaTarefa('assentar-estrada', 'serf')).toBe(false);
  });
});

describe('F18d-1b — a tarefa nova reserva a pedra do assentamento', () => {
  it('a origem e o armazem que vai pagar, e a reserva vale desde ABERTA', () => {
    const antes = comPedra(5);
    const armazem = armazemDoCenario(antes).id;
    expect(armazemQuePagaAEstrada(antes)).toBe(armazem);
    expect(disponivelNaOrigem(antes, armazem, MERCADORIA_DA_ESTRADA)).toBe(5);

    const criada = criarTarefaDeAssentamento(antes, TILE);
    if (criada === null) throw new Error('fixture: armazem com pedra e a tarefa nao nasceu');
    const tarefa = criada.state.jobs.tarefas.porId[criada.id];
    expect(tarefa?.tipo).toBe('assentar-estrada');
    expect(tarefa?.estado).toBe('aberta');
    expect(tarefa && ehTarefaDeAssentamento(tarefa) ? tarefa.destinoTile : null).toEqual(TILE);

    expect(reservadoNaOrigem(criada.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(1);
    expect(disponivelNaOrigem(criada.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(4);
  });

  it('duas tarefas reservam duas unidades, e a reserva sobrevive ao JSON', () => {
    const uma = criarTarefaDeAssentamento(comPedra(5), TILE);
    if (uma === null) throw new Error('fixture: a primeira tarefa nao nasceu');
    const duas = criarTarefaDeAssentamento(uma.state, { gx: 30, gy: 36 });
    if (duas === null) throw new Error('fixture: a segunda tarefa nao nasceu');
    const armazem = armazemDoCenario(duas.state).id;
    expect(disponivelNaOrigem(duas.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(3);

    const ida = JSON.parse(JSON.stringify(duas.state)) as GameState;
    expect(ida).toEqual(duas.state);
    expect(disponivelNaOrigem(ida, armazem, MERCADORIA_DA_ESTRADA)).toBe(3);
  });

  it('sem pedra reservavel nao ha tarefa: `null`, e nada reservado', () => {
    const seco = comPedra(0);
    expect(armazemQuePagaAEstrada(seco)).toBe(null);
    expect(criarTarefaDeAssentamento(seco, TILE)).toBe(null);
  });

  it('nao e tarefa de transporte: nao tem `destino` de predio para consultar', () => {
    const criada = criarTarefaDeAssentamento(comPedra(5), TILE);
    if (criada === null) throw new Error('fixture: a tarefa nao nasceu');
    const tarefa = criada.state.jobs.tarefas.porId[criada.id];
    if (tarefa === undefined) throw new Error('fixture: tarefa criada e ausente do quadro');
    // a guarda e da FORMA: ela carrega mercadoria, mas nao entrega em predio —
    // deixar passar por transporte faria `vagaDoDestino` ler `undefined`.
    expect(ehTarefaDeTransporte(tarefa)).toBe(false);
    expect(ehTarefaDeAssentamento(tarefa)).toBe(true);
  });
});

describe('F18d-1b — a tarefa nao sobrevive ao tile que ela mira', () => {
  const comCanteiro = (pedra: number): GameState => comPlanejadas(comPedra(pedra), [TILE]);

  it('tile fora do canteiro cancela a tarefa aberta, e a pedra volta a ser gastavel', () => {
    const criada = criarTarefaDeAssentamento(comCanteiro(5), TILE);
    if (criada === null) throw new Error('fixture: a tarefa nao nasceu');
    const armazem = armazemDoCenario(criada.state).id;
    // com o tile no canteiro o saneamento nao mexe: a tarefa continua, a reserva tambem
    const intacto = sanearTarefas(criada.state).state;
    expect(intacto.jobs.tarefas.porId[criada.id]?.tipo).toBe('assentar-estrada');
    expect(disponivelNaOrigem(intacto, armazem, MERCADORIA_DA_ESTRADA)).toBe(4);

    // o tile saiu do canteiro (assentado ou demolido): a tarefa perdeu o objeto
    const semCanteiro = { ...criada.state, estradasPlanejadas: {} };
    const saneado = sanearTarefas(semCanteiro).state;
    expect(saneado.jobs.tarefas.porId[criada.id]).toBeUndefined();
    expect(disponivelNaOrigem(saneado, armazem, MERCADORIA_DA_ESTRADA)).toBe(5);
  });

  it('duas tarefas para o MESMO tile: a segunda cai, e sobra UMA pedra reservada', () => {
    const uma = criarTarefaDeAssentamento(comCanteiro(5), TILE);
    if (uma === null) throw new Error('fixture: a primeira tarefa nao nasceu');
    const duas = criarTarefaDeAssentamento(uma.state, TILE);
    if (duas === null) throw new Error('fixture: a segunda tarefa nao nasceu');
    const armazem = armazemDoCenario(duas.state).id;
    expect(disponivelNaOrigem(duas.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(3);

    const saneado = sanearTarefas(duas.state).state;
    expect(saneado.jobs.tarefas.porId[uma.id]?.tipo).toBe('assentar-estrada');
    expect(saneado.jobs.tarefas.porId[duas.id]).toBeUndefined();
    expect(disponivelNaOrigem(saneado, armazem, MERCADORIA_DA_ESTRADA)).toBe(4);
  });

  it('o verificador ACUSA a tarefa cujo tile nao esta no canteiro', () => {
    const criada = criarTarefaDeAssentamento(comCanteiro(5), TILE);
    if (criada === null) throw new Error('fixture: a tarefa nao nasceu');
    expect(violacoesDeInvariantes(criada.state)).toEqual([]);
    expect(violacoesDeInvariantes({ ...criada.state, estradasPlanejadas: {} }))
      .toEqual([`${criada.id}: tile '29,36' nao esta no canteiro`]);
  });
});

// --- Tarefa 4: o `PlaceRoad` desenha o canteiro; quem constroi e o laborer ---

/** O trecho fica LONGE dos predios do cenario, e os laborers saem: aqui se mede o
 *  COMANDO, e nao a corrida de quem vai assentar. */
const TRECHO = linhaH(10, 12, 40);
const placeRoad = (tiles: readonly { readonly gx: number; readonly gy: number }[]) => (
  { type: 'PlaceRoad', tiles } as const
);

function cenarioDoComando(pedra: number): GameState {
  const base = semLaborers(cenarioLigado({ stone: 2 }));
  return comPedraNaSaida(base, armazemDoCenario(base).id, pedra);
}

/** So as tarefas de assentamento: o cenario tem obras, e elas geram as suas. */
const assentamentosDe = (e: GameState): string[] => e.jobs.tarefas.ordem
  .filter((id) => { const t = e.jobs.tarefas.porId[id]; return t !== undefined && ehTarefaDeAssentamento(t); });

describe('F18d-1b — `PlaceRoad` planta canteiro, nao estrada', () => {
  it('tres tiles viram tres tarefas abertas e tres pedras reservadas, sem um metro de rua', () => {
    const antes = cenarioDoComando(10);
    const armazem = armazemDoCenario(antes).id;
    const depois = step(antes, [placeRoad(TRECHO)]);

    expect(tilesOrdenados(depois.estradasPlanejadas)).toEqual(TRECHO);
    for (const t of TRECHO) expect(ehEstrada(depois.estradas, t)).toBe(false);

    const tarefas = depois.jobs.tarefas.ordem
      .map((id) => depois.jobs.tarefas.porId[id])
      .filter((t) => t !== undefined && ehTarefaDeAssentamento(t));
    expect(tarefas).toHaveLength(3);
    expect(tarefas.every((t) => t?.estado === 'aberta')).toBe(true);

    const custo = gameData.terreno.estrada.custoStonePorTile;
    expect(reservadoNaOrigem(depois, armazem, MERCADORIA_DA_ESTRADA)).toBe(3 * custo);
    // a pedra ainda esta la: quem a gasta e o assentamento, um tile de cada vez.
    expect(depois.predios.porId[armazem]?.estado === 'completo'
      && depois.predios.porId[armazem].estoque.saida[MERCADORIA_DA_ESTRADA]).toBe(10);
    expect(disponivelNaOrigem(depois, armazem, MERCADORIA_DA_ESTRADA)).toBe(10 - 3 * custo);
  });

  it('a reserva do primeiro comando faz o segundo ser recusado por `sem-pedra`', () => {
    const custo = gameData.terreno.estrada.custoStonePorTile;
    const antes = cenarioDoComando(3 * custo);   // da para o primeiro trecho, e so
    const primeiro = step(antes, [placeRoad(TRECHO)]);
    expect(primeiro.events.filter((e) => e.type === 'command-rejected')).toEqual([]);

    const segundo = step(primeiro, [placeRoad([tile(10, 41)])]);
    expect(segundo.events.filter((e) => e.type === 'command-rejected')).toEqual([
      { type: 'command-rejected', command: 'PlaceRoad', motivo: 'sem-pedra', tile: null },
    ]);
    expect(ehPlanejada(segundo.estradasPlanejadas, tile(10, 41))).toBe(false);
  });

  it('desenhar de novo sobre o proprio canteiro nao cria tarefa nem custa de novo', () => {
    const uma = step(cenarioDoComando(10), [placeRoad(TRECHO)]);
    const duas = step(uma, [placeRoad(TRECHO)]);
    // os MESMOS ids: nenhuma tarefa nova nasceu, e por isso nenhuma pedra nova foi
    // comprometida (a reserva e derivada da tarefa, nao um contador a parte).
    expect(assentamentosDe(duas)).toEqual(assentamentosDe(uma));
    expect(tilesOrdenados(duas.estradasPlanejadas)).toEqual(TRECHO);
  });
});

describe('F18d-1b — `gerarTarefas` remenda o buraco do canteiro', () => {
  it('tile planejado sem tarefa ganha uma; tile que ja tem a sua nao ganha a segunda', () => {
    const base = comPlanejadas(cenarioDoComando(10), TRECHO);
    // o canteiro existe e nao ha uma tarefa de assentamento sequer: o buraco que o remendo cobre
    expect(assentamentosDe(base)).toEqual([]);

    const remendado = gerarTarefas(base);
    const doTile = (e: GameState, t: { readonly gx: number; readonly gy: number }): number => e.jobs.tarefas.ordem
      .map((id) => e.jobs.tarefas.porId[id])
      .filter((x) => x !== undefined && ehTarefaDeAssentamento(x) && x.destinoTile.gx === t.gx
        && x.destinoTile.gy === t.gy).length;
    for (const t of TRECHO) expect(doTile(remendado, t)).toBe(1);

    // de novo, e nada muda: uma tarefa por tile, nunca duas
    const outraVez = gerarTarefas(remendado);
    for (const t of TRECHO) expect(doTile(outraVez, t)).toBe(1);
    expect(assentamentosDe(outraVez)).toEqual(assentamentosDe(remendado));
  });

  it('sem armazem que pague, o canteiro fica desenhado e sem tarefa — e nada estoura', () => {
    const base = comPlanejadas(cenarioDoComando(0), TRECHO);
    const remendado = gerarTarefas(base);
    expect(assentamentosDe(remendado)).toEqual([]);
    expect(tilesOrdenados(remendado.estradasPlanejadas)).toEqual(TRECHO);
    expect(violacoesDeInvariantes(remendado)).toEqual([]);
  });
});
