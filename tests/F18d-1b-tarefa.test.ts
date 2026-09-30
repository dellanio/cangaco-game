/**
 * F18d-1b — a tarefa `'assentar-estrada'`, e (F18g) a carga `'pedra-para-canteiro'`.
 *
 * Um tile planejado vira trabalho de laborer: a tarefa entra na escada de
 * `delivery.json` (`modo: 'livre'` — canteiro nao tem rua para chegar) e o DESTINO
 * dela e um TILE e nao um predio.
 *
 * F18g INVERTEU a metade da pedra, por decisao do operador (Opcao A do item): ate
 * aqui a tarefa de assentar reservava a pedra no armazem desde `aberta`, e o comando
 * recusava com `sem-pedra` o trecho que nao cabia. Agora a pedra VIAJA: a carga
 * `pedra-para-canteiro` (serf) reserva ao ser RECLAMADA, como toda carga; a de
 * assentar nao reserva nada e nasce para todo tile; e o comando desenha o canteiro
 * sem pagador. O que este arquivo guarda com o mesmo nome e o que nao mudou; o que
 * inverteu esta dito no proprio `it`.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import {
  criarTarefaDeAssentamento, criarTarefaDePedraParaCanteiro, elegivelParaTarefa, importanciaDoTipo, modoDoTipo, reclamar,
} from '../src/sim/jobs';
import { MERCADORIA_DA_ESTRADA } from '../src/sim/estradas';
import { disponivelNaOrigem, reservadoNaOrigem } from '../src/sim/reservas';
import {
  ehTarefaDeAssentamento, ehTarefaDeLaborer, ehTarefaDePedraParaCanteiro, ehTarefaDoSerf, ehTarefaDeTransporte,
} from '../src/sim/state';
import type { GameState, TipoComOrigem } from '../src/sim/state';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { step } from '../src/sim/tick';
import { ehEstrada, ehPlanejada, tilesOrdenados } from '../src/sim/estradas';
import {
  armazemDoCenario, cenarioLigado, comPedraNaSaida, comPlanejadas, linhaH, semLaborers, serfsDoCenario, tile,
} from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';

const TILE = { gx: 29, gy: 36 } as const;

function comPedra(pedra: number): GameState {
  const base = cenarioLigado({ stone: 2 });
  return comPedraNaSaida(base, armazemDoCenario(base).id, pedra);
}

const pedrasDe = (e: GameState): string[] => e.jobs.tarefas.ordem
  .filter((id) => { const t = e.jobs.tarefas.porId[id]; return t !== undefined && ehTarefaDePedraParaCanteiro(t); });

describe('F18d-1b — a escada acolhe `assentar-estrada` sem mexer em nivel nenhum', () => {
  it('a escada inteira, na ordem: a pedra da obra antes do excedente; o laborer no fim', () => {
    // a lista inteira, lida do dado, comparada de uma vez: se uma linha nova tivesse
    // entrado no meio, os numeros dos sete mudariam de uma vez so.
    // D-TRANSPORTE-03 T1: as classes de importancia do KaM no lugar da escada estrita
    const escada = gameData.entrega.prioridades.map((p) => [p.id, p.importancia]);
    expect(escada).toEqual([
      // D2: o ouro da escola primeiro (diHigh1)
      ['ouro-para-escola', 1],
      // D1: a Bodega acima da tropa, divergencia do KaM declarada no _doc do dado
      ['comida-para-inn', 2],
      ['comida-para-tropa', 3],
      // D3: a pedra do canteiro com a obra (diHigh4). Desde o lote 2 (2026-09-27) ela vem
      // antes do excedente; agora vem antes de toda a classe comum
      ['material-para-obra', 4],
      ['pedra-para-canteiro', 4],
      ['insumo-producao-parada', 5],
      ['insumo-producao-baixa', 5],
      ['saida-cheia-para-armazem', 5],
      ['excedente-para-armazem', 5],
      // F18d-1b e F18h: as duas do laborer nao sao entrega; estao aqui so pelo `modo`
      ['assentar-estrada', null],
      ['arar', null],
      ['arma-para-quartel', 5],
    ]);
    for (const [id, importancia] of escada) {
      if (importancia !== null) expect(importanciaDoTipo(id as TipoComOrigem)).toBe(importancia);
    }
  });

  it('o modo dos niveis de canteiro e `livre`: nao ha rua para se chegar nele', () => {
    expect(modoDoTipo('assentar-estrada')).toBe('livre');
    expect(modoDoTipo('pedra-para-canteiro')).toBe('livre');
    // e o vizinho de cima continua exigindo rua — a F18d-1a nao foi desfeita
    expect(modoDoTipo('excedente-para-armazem')).toBe('estrada');
  });

  it('so o laborer assenta e so o serf leva a pedra: obra e carga nao disputam', () => {
    expect(elegivelParaTarefa('assentar-estrada', 'laborer')).toBe(true);
    expect(elegivelParaTarefa('assentar-estrada', 'serf')).toBe(false);
    expect(elegivelParaTarefa('pedra-para-canteiro', 'serf')).toBe(true);
    expect(elegivelParaTarefa('pedra-para-canteiro', 'laborer')).toBe(false);
  });
});

describe('F18g — quem reserva a pedra e a carga, ao ser reclamada; a tarefa de assentar nao reserva', () => {
  it('a tarefa de assentar nasce aberta, so com o tile, e nao compromete uma pedra sequer', () => {
    // INVERTEU: ate a F18g "a origem e o armazem que vai pagar, e a reserva vale desde
    // ABERTA". Agora ela e irma da de arar — nem origem, nem mercadoria.
    const antes = comPedra(5);
    const armazem = armazemDoCenario(antes).id;
    const criada = criarTarefaDeAssentamento(antes, TILE);
    const tarefa = criada.state.jobs.tarefas.porId[criada.id];
    expect(tarefa?.tipo).toBe('assentar-estrada');
    expect(tarefa?.estado).toBe('aberta');
    expect(tarefa && ehTarefaDeAssentamento(tarefa) ? tarefa.destinoTile : null).toEqual(TILE);
    expect(tarefa !== undefined && 'origem' in tarefa).toBe(false);
    expect(reservadoNaOrigem(criada.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(disponivelNaOrigem(criada.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(5);
  });

  it('a carga de pedra reserva UMA unidade ao ser reclamada, e a reserva sobrevive ao JSON', () => {
    const base = comPlanejadas(comPedra(5), [TILE]);
    const armazem = armazemDoCenario(base).id;
    const [serf] = serfsDoCenario(base);
    if (serf === undefined) throw new Error('fixture: cenario sem serf');
    const criada = criarTarefaDePedraParaCanteiro(base, { origem: armazem, tile: TILE });
    expect(reservadoNaOrigem(criada.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(0); // aberta nao reserva
    const r = reclamar(criada.state, criada.id, serf);
    if (!r.ok) throw new Error(`fixture: claim recusado '${r.motivo}'`);
    expect(reservadoNaOrigem(r.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(1);
    expect(disponivelNaOrigem(r.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(4);

    const ida = JSON.parse(JSON.stringify(r.state)) as GameState;
    expect(ida).toEqual(r.state);
    expect(disponivelNaOrigem(ida, armazem, MERCADORIA_DA_ESTRADA)).toBe(4);
  });

  it('sem pedra livre a tarefa de assentar nasce mesmo assim, e a carga NAO: o gerador nao abre pedido sem lastro', () => {
    // INVERTEU: era "sem pedra reservavel nao ha tarefa: null". A de assentar nao
    // precisa de pagador; o que o estoque limita e a carga.
    const seco = comPlanejadas(comPedra(0), [TILE]);
    const criada = criarTarefaDeAssentamento(seco, TILE);
    expect(criada.state.jobs.tarefas.porId[criada.id]?.tipo).toBe('assentar-estrada');
    expect(pedrasDe(gerarTarefas(criada.state))).toEqual([]);
  });

  it('nenhuma das duas e tarefa de transporte; a carga e do serf e a de assentar e do laborer', () => {
    const base = comPlanejadas(comPedra(5), [TILE]);
    const assentar = criarTarefaDeAssentamento(base, TILE);
    const carga = criarTarefaDePedraParaCanteiro(assentar.state, { origem: armazemDoCenario(base).id, tile: TILE });
    const a = carga.state.jobs.tarefas.porId[assentar.id];
    const c = carga.state.jobs.tarefas.porId[carga.id];
    if (a === undefined || c === undefined) throw new Error('fixture: tarefa criada e ausente do quadro');
    // a guarda e da FORMA: transporte e mercadoria + destino de PREDIO. A carga tem
    // mercadoria e `destinoTile`; deixa-la passar por transporte faria
    // `vagaDoDestino` ler `undefined`.
    expect(ehTarefaDeTransporte(a)).toBe(false);
    expect(ehTarefaDeTransporte(c)).toBe(false);
    expect(ehTarefaDoSerf(c)).toBe(true);
    expect(ehTarefaDoSerf(a)).toBe(false);
    expect(ehTarefaDeLaborer(a)).toBe(true);
    expect(ehTarefaDeLaborer(c)).toBe(false);
  });
});

describe('F18d-1b — a tarefa nao sobrevive ao tile que ela mira', () => {
  const comCanteiro = (pedra: number): GameState => comPlanejadas(comPedra(pedra), [TILE]);

  it('tile fora do canteiro cancela a tarefa de assentar aberta', () => {
    const criada = criarTarefaDeAssentamento(comCanteiro(5), TILE);
    // com o tile no canteiro o saneamento nao mexe
    const intacto = sanearTarefas(criada.state).state;
    expect(intacto.jobs.tarefas.porId[criada.id]?.tipo).toBe('assentar-estrada');

    // o tile saiu do canteiro (assentado ou demolido): a tarefa perdeu o objeto
    const semCanteiro = { ...criada.state, estradasPlanejadas: {} };
    const saneado = sanearTarefas(semCanteiro).state;
    expect(saneado.jobs.tarefas.porId[criada.id]).toBeUndefined();
  });

  it('tile fora do canteiro cancela tambem a carga de pedra, e devolve a reserva dela', () => {
    const base = comCanteiro(5);
    const armazem = armazemDoCenario(base).id;
    const [serf] = serfsDoCenario(base);
    if (serf === undefined) throw new Error('fixture: cenario sem serf');
    const criada = criarTarefaDePedraParaCanteiro(base, { origem: armazem, tile: TILE });
    const r = reclamar(criada.state, criada.id, serf);
    if (!r.ok) throw new Error(`fixture: claim recusado '${r.motivo}'`);
    expect(disponivelNaOrigem(r.state, armazem, MERCADORIA_DA_ESTRADA)).toBe(4);
    const saneado = sanearTarefas({ ...r.state, estradasPlanejadas: {} }).state;
    expect(saneado.jobs.tarefas.porId[criada.id]).toBeUndefined();
    expect(disponivelNaOrigem(saneado, armazem, MERCADORIA_DA_ESTRADA)).toBe(5);
  });

  it('duas tarefas de assentar para o MESMO tile: a segunda cai', () => {
    const uma = criarTarefaDeAssentamento(comCanteiro(5), TILE);
    const duas = criarTarefaDeAssentamento(uma.state, TILE);
    const saneado = sanearTarefas(duas.state).state;
    expect(saneado.jobs.tarefas.porId[uma.id]?.tipo).toBe('assentar-estrada');
    expect(saneado.jobs.tarefas.porId[duas.id]).toBeUndefined();
  });

  it('mais cargas do que o tile pede: o excesso cai (um tile pede exatamente custoStonePorTile)', () => {
    const base = comCanteiro(5);
    const armazem = armazemDoCenario(base).id;
    const custo = gameData.terreno.estrada.custoStonePorTile;
    let estado = base;
    for (let i = 0; i < custo + 1; i += 1) {
      estado = criarTarefaDePedraParaCanteiro(estado, { origem: armazem, tile: TILE }).state;
    }
    expect(pedrasDe(estado)).toHaveLength(custo + 1);
    expect(pedrasDe(sanearTarefas(estado).state)).toHaveLength(custo);
  });

  it('o verificador ACUSA a tarefa cujo tile nao esta no canteiro, das duas familias', () => {
    const base = comCanteiro(5);
    const assentar = criarTarefaDeAssentamento(base, TILE);
    const carga = criarTarefaDePedraParaCanteiro(assentar.state, { origem: armazemDoCenario(base).id, tile: TILE });
    expect(violacoesDeInvariantes(carga.state)).toEqual([]);
    expect(violacoesDeInvariantes({ ...carga.state, estradasPlanejadas: {} }))
      .toEqual([
        `${assentar.id}: tile '29,36' nao esta no canteiro`,
        `${carga.id}: tile '29,36' nao esta no canteiro`,
        `29,36: 1 tarefas de pedra para um tile que pede 0`,
      ]);
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
  it('tres tiles viram tres tarefas de assentar e tres cargas de pedra, sem um metro de rua e sem reserva', () => {
    const antes = cenarioDoComando(10);
    const armazem = armazemDoCenario(antes).id;
    const depois = step(antes, [placeRoad(TRECHO)]);

    expect(tilesOrdenados(depois.estradasPlanejadas)).toEqual(TRECHO);
    for (const t of TRECHO) expect(ehEstrada(depois.estradas, t)).toBe(false);

    expect(assentamentosDe(depois)).toHaveLength(3);
    // F18g: as cargas nascem no `gerarTarefas` do fim do mesmo tick, uma por tile —
    // e o estoque cobre as tres. Abertas, e por isso nada reservado: o serf reclama
    // no tick seguinte.
    expect(pedrasDe(depois)).toHaveLength(3);
    expect(depois.jobs.tarefas.ordem.every((id) => depois.jobs.tarefas.porId[id]?.estado === 'aberta')).toBe(true);
    expect(reservadoNaOrigem(depois, armazem, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(depois.predios.porId[armazem]?.estado === 'completo'
      && depois.predios.porId[armazem].estoque.saida[MERCADORIA_DA_ESTRADA]).toBe(10);
  });

  it('o segundo comando e ACEITO mesmo sem pedra (F18g): o canteiro cresce, e a carga do tile novo espera pedreira', () => {
    // INVERTEU: era "a reserva do primeiro comando faz o segundo ser recusado por
    // `sem-pedra`". O comando deixou de olhar a pedra; quem olha e o gerador, e ele
    // simplesmente nao abre a quarta carga.
    const custo = gameData.terreno.estrada.custoStonePorTile;
    const antes = cenarioDoComando(3 * custo);   // da para as cargas do primeiro trecho, e so
    const primeiro = step(antes, [placeRoad(TRECHO)]);
    expect(primeiro.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(pedrasDe(primeiro)).toHaveLength(3 * custo);

    const segundo = step(primeiro, [placeRoad([tile(10, 41)])]);
    expect(segundo.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(ehPlanejada(segundo.estradasPlanejadas, tile(10, 41))).toBe(true);
    expect(assentamentosDe(segundo)).toHaveLength(4);
    expect(pedrasDe(segundo)).toHaveLength(3 * custo);
    expect(violacoesDeInvariantes(segundo)).toEqual([]);
  });

  it('desenhar de novo sobre o proprio canteiro nao cria tarefa nem custa de novo', () => {
    const uma = step(cenarioDoComando(10), [placeRoad(TRECHO)]);
    const duas = step(uma, [placeRoad(TRECHO)]);
    // os MESMOS ids: nenhuma tarefa nova nasceu de nenhuma das duas familias
    expect(assentamentosDe(duas)).toEqual(assentamentosDe(uma));
    expect(pedrasDe(duas)).toEqual(pedrasDe(uma));
    expect(tilesOrdenados(duas.estradasPlanejadas)).toEqual(TRECHO);
  });
});

describe('F18d-1b — `gerarTarefas` remenda o buraco do canteiro', () => {
  it('tile planejado sem tarefa ganha uma de assentar e uma carga; tile que ja tem as suas nao ganha a segunda', () => {
    const base = comPlanejadas(cenarioDoComando(10), TRECHO);
    expect(assentamentosDe(base)).toEqual([]);
    expect(pedrasDe(base)).toEqual([]);

    const remendado = gerarTarefas(base);
    const doTile = (e: GameState, t: { readonly gx: number; readonly gy: number }, familia: 'assentar' | 'pedra'): number => e.jobs.tarefas.ordem
      .map((id) => e.jobs.tarefas.porId[id])
      .filter((x) => {
        if (x === undefined) return false;
        const daFamilia = familia === 'assentar' ? ehTarefaDeAssentamento(x) : ehTarefaDePedraParaCanteiro(x);
        return daFamilia && 'destinoTile' in x && x.destinoTile.gx === t.gx && x.destinoTile.gy === t.gy;
      }).length;
    for (const t of TRECHO) {
      expect(doTile(remendado, t, 'assentar')).toBe(1);
      expect(doTile(remendado, t, 'pedra')).toBe(gameData.terreno.estrada.custoStonePorTile);
    }

    // de novo, e nada muda: uma de cada por tile, nunca duas
    const outraVez = gerarTarefas(remendado);
    for (const t of TRECHO) {
      expect(doTile(outraVez, t, 'assentar')).toBe(1);
      expect(doTile(outraVez, t, 'pedra')).toBe(gameData.terreno.estrada.custoStonePorTile);
    }
    expect(assentamentosDe(outraVez)).toEqual(assentamentosDe(remendado));
    expect(pedrasDe(outraVez)).toEqual(pedrasDe(remendado));
  });

  it('sem armazem que pague, o canteiro fica desenhado com as tarefas de assentar e SEM carga — e nada estoura', () => {
    const base = comPlanejadas(cenarioDoComando(0), TRECHO);
    const remendado = gerarTarefas(base);
    expect(assentamentosDe(remendado)).toHaveLength(3);
    expect(pedrasDe(remendado)).toEqual([]);
    expect(tilesOrdenados(remendado.estradasPlanejadas)).toEqual(TRECHO);
    expect(violacoesDeInvariantes(remendado)).toEqual([]);
  });
});
