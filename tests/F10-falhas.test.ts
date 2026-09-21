/**
 * F10 — falha graciosa do serf (GDD §6.2: "se a origem perder o recurso, se o destino sumir
 * ou encher, ou se o caminho for cortado, vai para `devolvendo` (leva a carga ao armazem mais
 * proximo) e libera a tarefa").
 *
 * O aceite escrito: demolir a obra com o serf a caminho e confirmar que a carga volta ao
 * armazem e a tarefa e liberada. E o pedido do operador: provar tambem com a ESTRADA CORTADA
 * no meio da viagem.
 *
 * NAO existe comando de demolir predio antes da F16: a obra sai do estado pelo helper
 * `semOPredio`, como na F09. A estrada, essa sim, e cortada pelo comando real `DemolishRoad`.
 */
import { describe, it, expect, afterAll } from 'vitest';
import type { Command } from '../src/sim/commands';
import type { GameEvent, GameState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { buscarCaminho, estatisticasDeBusca, zerarEstatisticasDeBusca } from '../src/sim/pathfinding';
import { planoDaTarefa, tarefasEmOrdem } from '../src/sim/jobs';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { createRng, nextInt } from '../src/sim/rng';
import type { RngState } from '../src/sim/rng';
import { custoDoPredio } from '../src/sim/systems/build';
import { tilesOrdenados } from '../src/sim/estradas';
import { caixaDeTipo } from '../src/sim/footprint';
import { reservadoNaOrigem, reservadoNoDestino } from '../src/sim/reservas';
import { step } from '../src/sim/tick';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { bensPorMercadoria, ESTADOS_DO_SERF, violacoesDaFsm } from './helpers/serf-invariantes';
import {
  armazemDoJogo, ate, cenarioDoMuro, cenarioLongo, faltamDe, fsmDe, liberacoes, quieto, rodarAte, saidaDe, serfDoJogo,
  SERF_DO_LADO_DE_A, SERF_DO_LADO_DE_B, soUmSerf,
} from './helpers/serf-cenario';
import {
  cenarioLigado, comArmazemCompleto, comEstoqueNaSaida, comEstradas, comObra, comPedraNaSaida, comUnidadeEm, inicial, linhaH,
  linhaV, semAUnidade,
  semOPredio, serfsDoCenario, tile,
} from './helpers/jobs-cenario';
import type { TileDeGrid } from '../src/sim/estradas';

const P1 = armazemDoJogo.id;
const dadosDoSerf = (e: GameState) => e.unidades.porId[serfDoJogo]?.fsmData ?? {};
const restante = (e: GameState): number => (dadosDoSerf(e).caminho ?? []).length;
const emViagem = (e: GameState): boolean => fsmDe(e) === 'indo_entregar' && restante(e) <= 10;
const tarefaDoSerf = (e: GameState): string => dadosDoSerf(e).tarefa ?? 't?';

describe('F10 — obra demolida com o serf a caminho: a carga volta ao armazem e a tarefa e liberada', () => {
  const meio = ate(cenarioLongo(), emViagem, 'serf carregado a meio caminho');

  it('ponto de partida: o serf leva 1 de pedra (que ja saiu do armazem) e a obra ainda nao recebeu', () => {
    expect(fsmDe(meio)).toBe('indo_entregar');
    expect(dadosDoSerf(meio).carga).toBe('stone');
    expect(saidaDe(meio, P1)).toBe(9);
    expect(faltamDe(meio, 'obra-a')).toBe(1);
    expect(meio.jobs.tarefas.porId[tarefaDoSerf(meio)]?.estado).toBe('carregando');
  });

  it('no tick da demolicao: tarefa CANCELADA (evento), reserva do destino de volta, serf em `devolvendo` com a carga', () => {
    const tarefa = tarefaDoSerf(meio);
    const depois = step(semOPredio(meio, 'obra-a'), []);
    expect(liberacoes(depois.events)).toEqual([{ type: 'task-released', tarefa, motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(depois.jobs.tarefas.porId[tarefa]).toBeUndefined();
    expect(reservadoNoDestino(depois, 'obra-a', 'stone')).toBe(0);
    expect(fsmDe(depois)).toBe('devolvendo');
    expect(dadosDoSerf(depois).carga).toBe('stone'); // a carga continua na mao dele
    expect(saidaDe(depois, P1)).toBe(9); // ainda em transito, nao no armazem
    expect(violacoesDaFsm(depois)).toEqual([]);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('o serf leva a carga ao armazem e deposita: a pedra volta (10), o serf fica ocioso e sem carga', () => {
    const { estado, eventos } = rodarAte(semOPredio(meio, 'obra-a'), quieto);
    expect(saidaDe(estado, P1)).toBe(10);
    expect(fsmDe(estado)).toBe('ocioso');
    expect(estado.unidades.porId[serfDoJogo]?.fsmData).toEqual({});
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toEqual([
      { type: 'cargo-returned', unidade: serfDoJogo, armazem: P1, mercadoria: 'stone' },
    ]);
    expect(estado.jobs.tarefas.ordem).toEqual([]);
    expect(violacoesDaFsm(estado)).toEqual([]);
  });

  it('os bens se conservam no meio da falha: cada tick da devolucao mantem a soma', () => {
    let atual = semOPredio(meio, 'obra-a');
    const bens = bensPorMercadoria(atual);
    for (let i = 0; i < 200 && !quieto(atual); i++) {
      atual = step(atual, []);
      expect(bensPorMercadoria(atual), `tick ${atual.tick}`).toEqual(bens);
    }
    expect(quieto(atual)).toBe(true);
  });

  it('devolve ao armazem MAIS PROXIMO do serf, que nao e o de origem', () => {
    // um segundo armazem perto do fim da rua; o serf esta quase la quando a obra some
    const base = comArmazemCompleto(cenarioLongo(), 'perto', { gx: 46, gy: 30, stone: 0 });
    const quaseLa = ate(base, (e) => fsmDe(e) === 'indo_entregar' && restante(e) <= 4, 'serf carregado quase na obra');
    const u = quaseLa.unidades.porId[serfDoJogo];
    if (!u) throw new Error('fixture');
    const custoAte = (id: string): number => {
      const p = quaseLa.predios.porId[id];
      if (!p) throw new Error(`fixture: sem ${id}`);
      const portas: TileDeGrid[] = [0, 1, 2].map((i) => ({ gx: p.gx + i, gy: p.gy + 3 }));
      return buscarCaminho(quaseLa, { gx: u.gx, gy: u.gy }, portas, 'livre')?.custo ?? Number.POSITIVE_INFINITY;
    };
    expect(custoAte('perto')).toBeLessThan(custoAte(P1)); // premissa: o de origem e o mais LONGE
    const { estado, eventos } = rodarAte(semOPredio(quaseLa, 'obra-a'), quieto);
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toMatchObject([{ armazem: 'perto', mercadoria: 'stone' }]);
    expect(saidaDe(estado, 'perto')).toBe(1);
    expect(saidaDe(estado, P1)).toBe(9); // a que saiu de la ficou no outro
  });
});

describe('F10 — obra demolida ANTES da coleta: nao ha carga a devolver, so a reserva volta', () => {
  it.each(['indo_buscar', 'carregando'] as const)('com o serf em `%s`: tarefa cancelada, serf ocioso, armazem intacto, nenhum cargo-returned', (fase) => {
    const antes = ate(cenarioLongo(), (e) => fsmDe(e) === fase, `serf em ${fase}`);
    const tarefa = tarefaDoSerf(antes);
    expect(antes.jobs.tarefas.porId[tarefa]?.estado).toBe('reclamada');
    expect(reservadoNaOrigem(antes, P1, 'stone')).toBe(1);

    const { estado, eventos } = rodarAte(semOPredio(antes, 'obra-a'), quieto);
    expect(liberacoes(eventos)).toEqual([{ type: 'task-released', tarefa, motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(reservadoNaOrigem(estado, P1, 'stone')).toBe(0); // as DUAS reservas voltaram
    expect(saidaDe(estado, P1)).toBe(10); // nada saiu do armazem
    expect(fsmDe(estado)).toBe('ocioso');
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toEqual([]);
    expect(violacoesDaFsm(estado)).toEqual([]);
  });

  it('e no tick de `entregando` (a obra some no ultimo instante): devolve em vez de entregar no vazio', () => {
    const chegando = ate(cenarioLongo(), (e) => fsmDe(e) === 'entregando', 'serf entregando');
    expect(faltamDe(chegando, 'obra-a')).toBe(1);
    const { estado, eventos } = rodarAte(semOPredio(chegando, 'obra-a'), quieto);
    expect(eventos.filter((e) => e.type === 'task-completed')).toEqual([]);
    expect(liberacoes(eventos)).toMatchObject([{ motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toHaveLength(1);
    expect(saidaDe(estado, P1)).toBe(10);
  });
});

describe('F10 — estrada cortada NO MEIO DA VIAGEM (o comando real DemolishRoad)', () => {
  const meio = ate(cenarioLongo(), emViagem, 'serf carregado a meio caminho');
  const aFrente = (dadosDoSerf(meio).caminho ?? [])[2] as TileDeGrid;
  const demolir = (tiles: TileDeGrid[]): Command[] => [{ type: 'DemolishRoad', tiles }];

  it('demolir um tile A FRENTE do serf carregado: a rede se parte, a tarefa e liberada e ele passa a devolver', () => {
    const tarefa = tarefaDoSerf(meio);
    const depois = step(meio, demolir([aFrente]));
    expect(liberacoes(depois.events)).toEqual([{ type: 'task-released', tarefa, motivo: 'caminho-cortado', resultado: 'cancelada' }]);
    expect(fsmDe(depois)).toBe('devolvendo');
    expect(dadosDoSerf(depois).carga).toBe('stone');
    expect(reservadoNoDestino(depois, 'obra-a', 'stone')).toBe(0);
    expect(violacoesDaFsm(depois)).toEqual([]);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('a carga volta ao armazem (10), o serf termina ocioso, e a obra segue esperando (nao ha estrada)', () => {
    const { estado, eventos } = rodarAte(meio, quieto, demolir([aFrente]));
    expect(saidaDe(estado, P1)).toBe(10);
    expect(fsmDe(estado)).toBe('ocioso');
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toHaveLength(1);
    expect(faltamDe(estado, 'obra-a')).toBe(1);
    expect(estado.jobs.tarefas.ordem).toEqual([]); // sem caminho, o gerador nao recria
  });

  it('REFAZER a estrada: o quadro se recompoe e a entrega acaba (o serf nao ficou travado)', () => {
    const { estado: parado } = rodarAte(meio, quieto, demolir([aFrente]));
    const refeito = step(parado, [{ type: 'PlaceRoad', tiles: [aFrente] }]);
    const { estado: fim, eventos } = rodarAte(refeito, quieto);
    expect(faltamDe(fim, 'obra-a')).toBe(0);
    expect(eventos.filter((e) => e.type === 'task-completed')).toHaveLength(1);
    // 10 - 1 da estrada refeita - 1 entregue
    expect(saidaDe(fim, P1)).toBe(8);
    expect(violacoesDaFsm(fim)).toEqual([]);
  });

  it('demolir o tile SOBRE o qual o serf esta: ele nao fica preso no ar, devolve', () => {
    const u = meio.unidades.porId[serfDoJogo];
    if (!u) throw new Error('fixture');
    const depois = step(meio, demolir([{ gx: u.gx, gy: u.gy }]));
    expect(liberacoes(depois.events)).toMatchObject([{ motivo: 'caminho-cortado', resultado: 'cancelada' }]);
    expect(fsmDe(depois)).toBe('devolvendo');
    const { estado } = rodarAte(meio, quieto, demolir([{ gx: u.gx, gy: u.gy }]));
    expect(saidaDe(estado, P1)).toBe(10);
  });

  it('cortar a rede com o serf AINDA INDO BUSCAR: o saneamento cancela, ele volta a ocioso, e refazer a estrada retoma', () => {
    const buscando = ate(cenarioLongo(), (e) => fsmDe(e) === 'indo_buscar', 'serf indo buscar');
    const tarefa = tarefaDoSerf(buscando);
    const corte = tile(36, 36);
    const { estado: parado, eventos } = rodarAte(buscando, quieto, demolir([corte]));
    expect(liberacoes(eventos)).toEqual([{ type: 'task-released', tarefa, motivo: 'caminho-cortado', resultado: 'cancelada' }]);
    expect(saidaDe(parado, P1)).toBe(10); // nada saiu
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toEqual([]);
    const refeito = step(parado, [{ type: 'PlaceRoad', tiles: [corte] }]);
    const { estado: fim } = rodarAte(refeito, quieto);
    expect(faltamDe(fim, 'obra-a')).toBe(0);
    expect(saidaDe(fim, P1)).toBe(8);
  });

  it('com uma rota ALTERNATIVA (rua de duas pistas), o serf replaneja e entrega SEM liberar nada', () => {
    const duasPistas = comEstradas(cenarioLongo(), linhaH(29, 46, 37));
    const viajando = ate(duasPistas, emViagem, 'serf carregado a meio caminho');
    const proximo = (dadosDoSerf(viajando).caminho ?? [])[0] as TileDeGrid;
    expect(proximo.gy).toBe(36); // esta na pista de cima; demolir o PROXIMO tile o obriga a desviar
    const { estado, eventos } = rodarAte(viajando, quieto, demolir([proximo]));
    expect(liberacoes(eventos)).toEqual([]);
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toEqual([]);
    expect(eventos.filter((e) => e.type === 'task-completed')).toHaveLength(1);
    expect(faltamDe(estado, 'obra-a')).toBe(0);
    expect(saidaDe(estado, P1)).toBe(9);
  });
});

describe('F10 — o que so o serf sabe: a perna livre bloqueada, e o `devolvendo` sem chao', () => {
  it('um predio plantado NO caminho do serf que vai buscar: ele desvia, sem liberar nada', () => {
    const longe = comUnidadeEm(cenarioLongo(), serfDoJogo, 20, 20);
    const andando = ate(longe, (e) => fsmDe(e) === 'indo_buscar' && restante(e) >= 5, 'serf longe da porta');
    const alvo = (dadosDoSerf(andando).caminho ?? [])[2] as TileDeGrid;
    const caixa = caixaDeTipo('quarry', alvo.gx, alvo.gy, gameData);
    if (!caixa) throw new Error('fixture: sem footprint de quarry');
    const dentro = (t: { gx: number; gy: number }): boolean => t.gx >= caixa.x0 && t.gx < caixa.x1 && t.gy >= caixa.y0 && t.gy < caixa.y1;
    expect(dentro(alvo)).toBe(true); // a planta CAI em cima de um tile do caminho dele

    let atual = step(andando, [{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: alvo.gx, gy: alvo.gy }]);
    const eventos: GameEvent[] = [...atual.events];
    expect(atual.predios.ordem.length).toBe(andando.predios.ordem.length + 1); // a planta foi aceita
    for (let i = 0; i < 600 && !quieto(atual); i++) {
      const u = atual.unidades.porId[serfDoJogo];
      if (u) expect(dentro({ gx: u.gx, gy: u.gy }), `o serf pisou no predio novo no tick ${atual.tick}`).toBe(false);
      atual = step(atual, []);
      eventos.push(...atual.events);
    }
    expect(quieto(atual)).toBe(true);
    expect(liberacoes(eventos)).toEqual([]);
    expect(faltamDe(atual, 'obra-a')).toBe(0);
  });

  it('serf CERCADO no caminho (sem rota): `pedido-da-unidade` reabre a tarefa, ele volta a ocioso e NAO ha laco reclama/libera', () => {
    const canto = comUnidadeEm(cenarioLongo(), serfDoJogo, 0, 0);
    const buscando = ate(canto, (e) => fsmDe(e) === 'indo_buscar', 'serf indo buscar do canto');
    const tarefa = tarefaDoSerf(buscando);
    // duas obras fecham (1,0), (0,1) e (1,1): o serf continua onde esta, sem nenhum vizinho livre
    const cercado = comObra(comObra(buscando, 'cerca1', { gx: 1, gy: 0, faltam: {} }), 'cerca2', { gx: 0, gy: 1, faltam: {} });
    const depois = step(cercado, []);
    expect(liberacoes(depois.events)).toEqual([{ type: 'task-released', tarefa, motivo: 'pedido-da-unidade', resultado: 'reaberta' }]);
    expect(fsmDe(depois)).toBe('ocioso');
    expect(depois.jobs.tarefas.porId[tarefa]?.estado).toBe('aberta');
    expect(reservadoNaOrigem(depois, P1, 'stone')).toBe(0);
    // e nos ticks seguintes NADA mais acontece: o claim recusa `sem-caminho`, entao nao reclama de novo
    let atual = depois;
    for (let i = 0; i < 40; i++) {
      atual = step(atual, []);
      expect(liberacoes(atual.events), `tick ${atual.tick}`).toEqual([]);
      expect(fsmDe(atual)).toBe('ocioso');
      expect(atual.jobs.tarefas.porId[tarefa]?.estado).toBe('aberta');
    }
  });

  it('sem armazem nenhum, o serf ESPERA com a carga (sem estado novo); quando um armazem nasce, deposita nele', () => {
    const meio = ate(cenarioLongo(), emViagem, 'serf carregado a meio caminho');
    const semChao = semOPredio(semOPredio(meio, 'obra-a'), P1);
    let atual = step(semChao, []);
    expect(fsmDe(atual)).toBe('devolvendo');
    for (let i = 0; i < 15; i++) {
      atual = step(atual, []);
      expect(fsmDe(atual)).toBe('devolvendo');
      expect(dadosDoSerf(atual).carga).toBe('stone');
      expect(atual.events.filter((e) => e.type === 'cargo-returned')).toEqual([]);
    }
    const comNovo = comArmazemCompleto(atual, 'novo', { gx: 40, gy: 30, stone: 0 });
    const { estado, eventos } = rodarAte(comNovo, quieto);
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toMatchObject([{ armazem: 'novo', mercadoria: 'stone' }]);
    expect(saidaDe(estado, 'novo')).toBe(1);
    expect(fsmDe(estado)).toBe('ocioso');
  });

  it('o armazem-alvo some NO CAMINHO da devolucao: o serf escolhe outro e deposita nele', () => {
    const base = comArmazemCompleto(cenarioLongo(), 'perto', { gx: 46, gy: 30, stone: 0 });
    const quaseLa = ate(base, (e) => fsmDe(e) === 'indo_entregar' && restante(e) <= 4, 'serf carregado quase na obra');
    let atual = step(semOPredio(quaseLa, 'obra-a'), []);
    expect(dadosDoSerf(atual).armazem).toBe('perto');
    atual = semOPredio(atual, 'perto'); // o alvo desaparece
    const { estado, eventos } = rodarAte(atual, quieto);
    expect(eventos.filter((e) => e.type === 'cargo-returned')).toMatchObject([{ armazem: P1 }]);
    expect(saidaDe(estado, P1)).toBe(10);
  });

  it('unidade removida COM carga: a carga se perde com ela (decisao registrada) e outro serf entrega a obra', () => {
    // um segundo serf esta no cenario desde o inicio (ocioso, porque so ha uma tarefa)
    const base = cenarioLongo();
    const u = base.unidades.porId[serfDoJogo];
    if (!u) throw new Error('fixture');
    const extra = 'u99';
    const comExtra: GameState = {
      ...base, proximoId: 100,
      unidades: { porId: { ...base.unidades.porId, [extra]: { ...u, id: extra, gx: 31, gy: 34 } }, ordem: [...base.unidades.ordem, extra] },
    };
    const meio = ate(comExtra, emViagem, 'serf carregado a meio caminho');
    const bensAntes = bensPorMercadoria(meio).stone as number;
    const tarefa = tarefaDoSerf(meio);
    const semDono: GameState = { ...meio, unidades: { porId: Object.fromEntries(Object.entries(meio.unidades.porId).filter(([id]) => id !== serfDoJogo)), ordem: meio.unidades.ordem.filter((id) => id !== serfDoJogo) } };
    const depois = step(semDono, []);
    expect(liberacoes(depois.events)).toEqual([{ type: 'task-released', tarefa, motivo: 'unidade-removida', resultado: 'cancelada' }]);
    expect(bensPorMercadoria(depois).stone).toBe(bensAntes - 1); // 1 unidade perdida, e so 1
    const { estado } = rodarAte(depois, quieto);
    expect(faltamDe(estado, 'obra-a')).toBe(0);
    expect(saidaDe(estado, P1)).toBe(8); // 10 - 1 perdida - 1 entregue
  });
});

// --- a propriedade estrutural: eventos aleatorios, invariantes e conservacao a CADA tick ---

interface CoberturaDoCaos {
  passos: number;
  estadosVistos: Record<string, number>;
  liberacoes: Record<string, number>;
  concluidas: number;
  devolvidas: number;
  comandos: number;
}

const coberturaVazia = (): CoberturaDoCaos => ({ passos: 0, estadosVistos: {}, liberacoes: {}, concluidas: 0, devolvidas: 0, comandos: 0 });
export const coberturaDoCaos = coberturaVazia();

const RUA_BASE = [...linhaH(20, 42, 36), ...linhaV(29, 33, 36)];
const SLOTS_DE_OBRA = [20, 26, 32, 38];

function baseDoCaos(): GameState {
  let e = comEstradas(comEstoqueNaSaida(cenarioLigado({ stone: 2, timber: 2 }), P1, { stone: 60, timber: 60 }), RUA_BASE);
  e = comObra(e, 'obra-b', { gx: 32, gy: 34, faltam: { stone: 2, timber: 2 } });
  return e;
}

const obrasComPendencia = (e: GameState): number => e.predios.ordem.filter((id) => {
  const p = e.predios.porId[id];
  return p?.estado === 'obra' && Object.values(p.obra.faltam).some((n) => n > 0);
}).length;

function rodarCaos(semente: number, passos: number, cobertura: CoberturaDoCaos): void {
  let rng: RngState = createRng(semente);
  const sorteio = (limite: number): number => {
    const r = nextInt(rng, 0, limite);
    rng = r.rng;
    return r.value;
  };
  let estado = baseDoCaos();

  for (let i = 0; i < passos; i++) {
    // 0..13 sao acoes; 14..47 so deixam o tempo passar: sem esse folego as destruicoes chegam mais
    // depressa que as entregas e o caminho feliz quase nao acontece entre as falhas
    const acao = sorteio(48);
    const comandos: Command[] = [];
    const todos = serfsDoCenario(estado);
    const ocupados = todos.filter((id) => fsmDe(estado, id) !== 'ocioso');
    const alvoId = ocupados[sorteio(Math.max(ocupados.length, 1))];
    const alvo = alvoId === undefined ? undefined : estado.unidades.porId[alvoId];
    const tarefaDoAlvo = alvo?.fsmData.tarefa === undefined ? undefined : estado.jobs.tarefas.porId[alvo.fsmData.tarefa];

    switch (acao) {
      case 4: { // demole um tile de estrada qualquer
        const tiles = tilesOrdenados(estado.estradas);
        const t = tiles[sorteio(Math.max(tiles.length, 1))];
        if (t !== undefined) comandos.push({ type: 'DemolishRoad', tiles: [t] });
        break;
      }
      case 5: { // demole o tile A FRENTE do serf ocupado, ou o que ele pisa
        if (alvo) {
          const frente = alvo.fsmData.caminho?.[0];
          comandos.push({ type: 'DemolishRoad', tiles: [sorteio(2) === 0 && frente ? frente : { gx: alvo.gx, gy: alvo.gy }] });
        }
        break;
      }
      case 6: estado = comEstradas(estado, RUA_BASE); break; // a rua e refeita (reposicao)
      case 7: { // o jogador estende a rua, por comando
        const gx = 20 + sorteio(24);
        const gy = 36 + sorteio(4);
        comandos.push({ type: 'PlaceRoad', tiles: linhaH(gx, gx + 1 + sorteio(5), gy) });
        break;
      }
      case 8: { // a obra do serf ocupado some
        if (tarefaDoAlvo) estado = semOPredio(estado, tarefaDoAlvo.destino);
        break;
      }
      case 9: { // um armazem some (e o mundo pode ficar sem nenhum: o serf espera)
        const armazens = estado.predios.ordem.filter((id) => estado.predios.porId[id]?.tipo === 'storehouse');
        const id = armazens[sorteio(Math.max(armazens.length, 1))];
        if (id !== undefined && sorteio(3) === 0) estado = semOPredio(estado, id);
        break;
      }
      case 10: { // um armazem novo, num ponto sorteado
        estado = comArmazemCompleto(estado, `novo-${i}`, { gx: 4 + 8 * sorteio(6), gy: 44 + sorteio(2), stone: 5, timber: 5 });
        break;
      }
      case 11: { // uma obra nova, num dos pontos ao longo da rua
        if (obrasComPendencia(estado) < 3) {
          const gx = SLOTS_DE_OBRA[sorteio(SLOTS_DE_OBRA.length)] ?? 20;
          const ocupado = estado.predios.ordem.some((id) => estado.predios.porId[id]?.gx === gx && estado.predios.porId[id]?.gy === 34);
          if (!ocupado) estado = comObra(estado, `obra-r${i}`, { gx, gy: 34, faltam: { stone: 2, timber: 2 } });
        }
        break;
      }
      case 12: { // reabastece o armazem de origem (ou o primeiro que houver)
        const a = estado.predios.ordem.map((id) => estado.predios.porId[id]).find((p) => p?.tipo === 'storehouse' && p.estado === 'completo');
        if (a) estado = comEstoqueNaSaida(estado, a.id, { stone: 60, timber: 60 });
        break;
      }
      case 13: { // um serf morre (o ocupado, de preferencia) ou nasce
        if (todos.length >= 4 || todos.length < 2) {
          if (todos.length < 4) estado = comSerfNovo(estado);
          else if (alvoId !== undefined) estado = semAUnidade(estado, alvoId);
        } else if (sorteio(2) === 0) estado = comSerfNovo(estado);
        else if (alvoId !== undefined) estado = semAUnidade(estado, alvoId);
        break;
      }
      default: break; // 0..3 e 14..47: so deixa o tempo passar
    }

    const bensAntes = bensPorMercadoria(estado);
    estado = step(estado, comandos);
    cobertura.passos += 1;
    cobertura.comandos += comandos.length;
    // comandos de estrada mexem no estoque (custo e devolucao): a conservacao vale nos ticks SEM comando
    if (comandos.length === 0) expect(bensPorMercadoria(estado), `bens, semente ${semente}, passo ${i}, acao ${acao}`).toEqual(bensAntes);
    expect(violacoesDeInvariantes(estado), `quadro, semente ${semente}, passo ${i}, acao ${acao}`).toEqual([]);
    expect(violacoesDaFsm(estado), `FSM, semente ${semente}, passo ${i}, acao ${acao}`).toEqual([]);

    for (const id of serfsDoCenario(estado)) {
      const f = fsmDe(estado, id);
      cobertura.estadosVistos[f] = (cobertura.estadosVistos[f] ?? 0) + 1;
    }
    for (const e of estado.events) {
      if (e.type === 'task-released') cobertura.liberacoes[e.motivo] = (cobertura.liberacoes[e.motivo] ?? 0) + 1;
      else if (e.type === 'task-completed') cobertura.concluidas += 1;
      else if (e.type === 'cargo-returned') cobertura.devolvidas += 1;
    }
  }
}

/** Um serf novo, clonado de um serf do cenario inicial. */
function comSerfNovo(estado: GameState): GameState {
  const molde = inicial.unidades.porId[serfDoJogo];
  if (!molde) throw new Error('fixture: sem serf-molde');
  const id = `u${estado.proximoId}`;
  return {
    ...estado, proximoId: estado.proximoId + 1,
    unidades: { porId: { ...estado.unidades.porId, [id]: { ...molde, id, fsm: 'ocioso', fsmData: {} } }, ordem: [...estado.unidades.ordem, id] },
  };
}

describe('F10 — propriedade estrutural: eventos aleatorios, e a cada tick invariantes + conservacao de bens', () => {
  it.each([1, 2, 3])('semente %i: 250 passos sem uma unica violacao', (semente) => {
    rodarCaos(semente, 250, coberturaDoCaos);
  });

  it('o caos exercitou o ciclo inteiro: todos os estados da FSM e os ramos de falha, ao menos uma vez', () => {
    for (const estadoDoSerf of ESTADOS_DO_SERF) {
      expect(coberturaDoCaos.estadosVistos[estadoDoSerf] ?? 0, `o caos nunca viu o estado '${estadoDoSerf}'`).toBeGreaterThan(0);
    }
    expect(coberturaDoCaos.concluidas, 'nenhuma entrega concluida').toBeGreaterThan(0);
    expect(coberturaDoCaos.devolvidas, 'nenhuma carga devolvida').toBeGreaterThan(0);
    for (const motivo of ['destino-sumiu', 'caminho-cortado', 'unidade-removida']) {
      expect(coberturaDoCaos.liberacoes[motivo] ?? 0, `o caos nunca provocou '${motivo}'`).toBeGreaterThan(0);
    }
  });
});

// --- o cenario de carga com serfs: o numero que fecha a pergunta do indice do JobBoard ---

export const metricasDeCarga = {
  obras: 0, serfs: 0, tarefasGeradas: 0, maximoSimultaneo: 0, ticks: 0, concluidas: 0, tarefasNoFim: 0,
  buscasExecutadas: 0, acertosDeCache: 0,
};

describe('F10 — cenario de carga: 20 obras e 4 serfs entregando de verdade', () => {
  it('entrega tudo, mantem as invariantes, e ANOTA tarefas e buscas A* (sem otimizar, sem medir tempo)', () => {
    const quarry = gameData.predios.find((p) => p.id === 'quarry');
    if (!quarry) throw new Error('fixture: sem quarry no dado');
    const faltam = { ...custoDoPredio(quarry) };
    const xs = [...Array.from({ length: 10 }, (_, i) => i * 3), ...Array.from({ length: 10 }, (_, i) => 33 + i * 3)];
    let estado = comEstoqueNaSaida(inicial, P1, { stone: 500, timber: 500 });
    estado = comEstradas(estado, [...linhaH(0, 62, 40), ...linhaV(31, 33, 40)]);
    xs.forEach((x, i) => { estado = comObra(estado, `obra-${i}`, { gx: x, gy: 38, faltam }); });
    const bensAntes = bensPorMercadoria(estado);
    const serfsDoInicio = serfsDoCenario(estado).length;

    zerarEstatisticasDeBusca();
    const idsAntes = estado.proximoId;
    const TETO = 9000; // com margem: 100 entregas de ate ~35 tiles cada, 4 serfs, terminam perto do tick 5500
    let maximo = 0;
    let concluidas = 0;
    let t = 0;
    for (; t < TETO; t++) {
      estado = step(estado, []);
      maximo = Math.max(maximo, estado.jobs.tarefas.ordem.length);
      concluidas += estado.events.filter((e) => e.type === 'task-completed').length;
      if (t < 5 || t % 200 === 0) {
        expect(violacoesDeInvariantes(estado), `quadro, tick ${t}`).toEqual([]);
        expect(violacoesDaFsm(estado), `FSM, tick ${t}`).toEqual([]);
        expect(bensPorMercadoria(estado), `bens, tick ${t}`).toEqual(bensAntes);
      }
      if (quieto(estado)) break;
    }
    expect(quieto(estado), `nao terminou em ${TETO} ticks`).toBe(true);
    const esperadas = 20 * (faltam.timber + faltam.stone);
    expect(concluidas).toBe(esperadas);
    for (const id of estado.predios.ordem) {
      const p = estado.predios.porId[id];
      if (p?.estado === 'obra') expect(Object.values(p.obra.faltam).every((n) => n === 0), `${id} ainda pede material`).toBe(true);
    }
    expect(bensPorMercadoria(estado)).toEqual(bensAntes);

    const buscas = estatisticasDeBusca();
    Object.assign(metricasDeCarga, {
      obras: 20, serfs: serfsDoInicio, tarefasGeradas: estado.proximoId - idsAntes, maximoSimultaneo: maximo, ticks: t + 1,
      concluidas, tarefasNoFim: estado.jobs.tarefas.ordem.length, buscasExecutadas: buscas.execucoes, acertosDeCache: buscas.acertos,
    });
    expect(metricasDeCarga.tarefasGeradas, 'churn: alguma tarefa foi criada mais de uma vez').toBe(esperadas);
  }, 120_000);
});

// --- a evidencia: recalcula os cenarios (nao copia asserts) e grava test-output/F10.json ---

afterAll(() => {
  const ticksDe = (e: GameState): string => JSON.stringify(Object.values(e.jobs.tarefas.porId).map((t) => `${t.id}:${t.estado}`));

  // ---- aceite (BUILD_PLAN): armazem com 10 stone, obra pedindo 2 -> obra recebeu 2, armazem tem 8
  const inicioDoAceite = comPedraNaSaida(cenarioLigado({ stone: 2 }), P1, 10);
  const aceite = rodarAte(inicioDoAceite, quieto);
  const bensDoAceite = { antes: bensPorMercadoria(inicioDoAceite).stone, depois: bensPorMercadoria(aceite.estado).stone };

  // ---- a sequencia de estados de UM serf, e o contrato de reservas em cada fase
  const inicioUm = soUmSerf(comPedraNaSaida(cenarioLigado({ stone: 1 }), P1, 10));
  const trilha: GameState[] = [inicioUm];
  for (let i = 0; i < 400 && !(i > 0 && quieto(trilha[trilha.length - 1] as GameState)); i++) {
    trilha.push(step(trilha[trilha.length - 1] as GameState, []));
  }
  const vistos = trilha.map((e) => fsmDe(e));
  const sequencia = vistos.filter((f, i) => i === 0 || f !== vistos[i - 1]);
  const fase = (f: string): Record<string, unknown> => {
    const e = trilha.find((t) => fsmDe(t) === f) as GameState;
    return {
      tick: e.tick, tarefas: ticksDe(e), reservadoNaOrigem: reservadoNaOrigem(e, P1, 'stone'),
      reservadoNoDestino: reservadoNoDestino(e, 'obra-a', 'stone'), saidaDoArmazem: saidaDe(e, P1), faltamDaObra: faltamDe(e, 'obra-a'),
      carga: e.unidades.porId[serfDoJogo]?.fsmData.carga ?? null,
    };
  };

  // ---- o movimento: o passo custa o dado e a posicao nunca teleporta
  const { aPe } = gameData.movimento.ticksPorTile;
  const { aPe: diagonal } = gameData.movimento.ticksPorTileDiagonal;
  const maximoPermitidoPorTick = Math.max(...Object.values(aPe).map((c) => 1 / c), ...Object.values(diagonal).map((c) => Math.SQRT2 / c));
  const longo = rodarAte(cenarioLongo(), quieto);
  let deslocamentoMaximoObservado = 0;
  {
    let e = cenarioLongo();
    let antes = posicaoDaUnidade(e, e.unidades.porId[serfDoJogo] as never);
    for (let i = 0; i < longo.ticks; i++) {
      e = step(e, []);
      const agora = posicaoDaUnidade(e, e.unidades.porId[serfDoJogo] as never);
      deslocamentoMaximoObservado = Math.max(deslocamentoMaximoObservado, Math.hypot(agora.gx - antes.gx, agora.gy - antes.gy));
      antes = agora;
    }
  }

  // ---- as falhas (o aceite escrito e o pedido do operador)
  const meio = ate(cenarioLongo(), emViagem, 'serf carregado a meio caminho');
  const tarefaEmCurso = tarefaDoSerf(meio);
  const demolida = step(semOPredio(meio, 'obra-a'), []);
  const demolidaAteOFim = rodarAte(semOPredio(meio, 'obra-a'), quieto);
  const buscando = ate(cenarioLongo(), (e) => fsmDe(e) === 'indo_buscar', 'serf indo buscar');
  const demolidaBuscando = rodarAte(semOPredio(buscando, 'obra-a'), quieto);
  const aFrente = (dadosDoSerf(meio).caminho ?? [])[2] as TileDeGrid;
  const cortada = step(meio, [{ type: 'DemolishRoad', tiles: [aFrente] }]);
  const cortadaAteOFim = rodarAte(meio, quieto, [{ type: 'DemolishRoad', tiles: [aFrente] }]);
  const refeita = rodarAte(step(cortadaAteOFim.estado, [{ type: 'PlaceRoad', tiles: [aFrente] }]), quieto);
  const duasPistas = ate(comEstradas(cenarioLongo(), linhaH(29, 46, 37)), emViagem, 'serf carregado, duas pistas');
  const proximoTile = (dadosDoSerf(duasPistas).caminho ?? [])[0] as TileDeGrid;
  const alternativa = rodarAte(duasPistas, quieto, [{ type: 'DemolishRoad', tiles: [proximoTile] }]);
  const canto = ate(comUnidadeEm(cenarioLongo(), serfDoJogo, 0, 0), (e) => fsmDe(e) === 'indo_buscar', 'serf do canto indo buscar');
  const cercado = step(comObra(comObra(canto, 'cerca1', { gx: 1, gy: 0, faltam: {} }), 'cerca2', { gx: 0, gy: 1, faltam: {} }), []);
  let ticksSemLaco = 0;
  {
    let e = cercado;
    for (let i = 0; i < 40; i++) {
      e = step(e, []);
      if (liberacoes(e.events).length === 0 && fsmDe(e) === 'ocioso') ticksSemLaco += 1;
    }
  }
  const resumoDeLiberacoes = (evs: readonly GameEvent[]): unknown => liberacoes(evs).map((l) => ({ motivo: l.motivo, resultado: l.resultado }));
  const devolucoes = (evs: readonly GameEvent[]): unknown => evs.filter((e) => e.type === 'cargo-returned');

  // ---- a distancia: A* a partir do serf, nunca a reta
  const muro = cenarioDoMuro();
  const [tarefaA, tarefaB] = [muro.jobs.tarefas.porId.t1, muro.jobs.tarefas.porId.t2];
  if (!tarefaA || !tarefaB) throw new Error('evidencia: cenario do muro sem tarefas');
  const planoA = planoDaTarefa(muro, tarefaA, SERF_DO_LADO_DE_B);
  const planoB = planoDaTarefa(muro, tarefaB, SERF_DO_LADO_DE_B);
  const euclid = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number => Math.hypot(a.gx - b.gx, a.gy - b.gy);

  // ---- o cache, numa amostra: a segunda pergunta e um acerto, e trocar o estoque nao invalida
  zerarEstatisticasDeBusca();
  const amostra = comEstradas(cenarioLongo(), []);
  const primeiraBusca = buscarCaminho(amostra, tile(29, 33), [tile(44, 36)], 'estrada');
  const segundaBusca = buscarCaminho(amostra, tile(29, 33), [tile(44, 36)], 'estrada');
  const comOutroEstoque = comPedraNaSaida(amostra, P1, 3);
  buscarCaminho(comOutroEstoque, tile(29, 33), [tile(44, 36)], 'estrada');
  const cacheDaAmostra = { ...estatisticasDeBusca(), mesmoObjetoNaSegundaPergunta: primeiraBusca === segundaBusca, referenciaDePrediosMudou: comOutroEstoque.predios !== amostra.predios, ordemDePrediosIgual: comOutroEstoque.predios.ordem === amostra.predios.ordem };

  gravarEvidencia('F10', {
    feature: 'F10-serf-fsm',
    // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
    aceite: {
      armazemAntes: saidaDe(inicioDoAceite, P1), obraPedia: faltamDe(inicioDoAceite, 'obra-a'),
      ticksAteAcabar: aceite.ticks,
      obraRecebeu: faltamDe(inicioDoAceite, 'obra-a') - faltamDe(aceite.estado, 'obra-a'),
      faltamDepois: faltamDe(aceite.estado, 'obra-a'), armazemDepois: saidaDe(aceite.estado, P1),
      tarefasNoFim: aceite.estado.jobs.tarefas.ordem.length,
      todosOsSerfsOciosos: serfsDoCenario(aceite.estado).every((id) => fsmDe(aceite.estado, id) === 'ocioso'),
      eventos: { concluidas: aceite.eventos.filter((e) => e.type === 'task-completed').length, liberacoes: liberacoes(aceite.eventos).length },
      bensDePedra: bensDoAceite,
    },
    // A FSM canonica do GDD §6.2, sem estado novo; `carregando` e `entregando` duram 1 tick.
    fsm: {
      sequenciaDeUmSerf: sequencia,
      ticksEmCarregando: vistos.filter((f) => f === 'carregando').length,
      ticksEmEntregando: vistos.filter((f) => f === 'entregando').length,
      porFase: { indo_buscar: fase('indo_buscar'), carregando: fase('carregando'), indo_entregar: fase('indo_entregar'), entregando: fase('entregando') },
      // a coleta tira do armazem no tick exato em que a tarefa vira `carregando`
      coleta: {
        armazemAntes: saidaDe(trilha[trilha.findIndex((e) => fsmDe(e) === 'indo_entregar') - 1] as GameState, P1),
        armazemDepois: saidaDe(trilha[trilha.findIndex((e) => fsmDe(e) === 'indo_entregar')] as GameState, P1),
      },
    },
    movimento: {
      ticksPorTileAPe: aPe, ticksPorTileDiagonalAPe: diagonal,
      viagemDe18PassosDeEstradaNoTeste: { ticks: longo.ticks },
      deslocamentoMaximoPorTickObservado: deslocamentoMaximoObservado,
      deslocamentoMaximoPermitidoPorTick: maximoPermitidoPorTick,
      posicaoContinua: deslocamentoMaximoObservado <= maximoPermitidoPorTick + 1e-9,
    },
    // Ponto 4 + pedido do operador: cada falha libera a tarefa e leva a carga a um armazem.
    falhas: {
      obraDemolidaComOSerfCarregado: {
        tarefa: tarefaEmCurso, noTickDaDemolicao: resumoDeLiberacoes(demolida.events), fsmDepois: fsmDe(demolida),
        cargaNaMao: demolida.unidades.porId[serfDoJogo]?.fsmData.carga ?? null, armazemAntes: saidaDe(meio, P1),
        armazemDepoisDeDevolver: saidaDe(demolidaAteOFim.estado, P1), devolucoes: devolucoes(demolidaAteOFim.eventos),
        serfNoFim: fsmDe(demolidaAteOFim.estado), tarefasNoFim: demolidaAteOFim.estado.jobs.tarefas.ordem.length,
      },
      obraDemolidaComOSerfIndoBuscar: {
        liberacoes: resumoDeLiberacoes(demolidaBuscando.eventos), armazemNoFim: saidaDe(demolidaBuscando.estado, P1),
        reservaNaOrigemNoFim: reservadoNaOrigem(demolidaBuscando.estado, P1, 'stone'), devolucoes: devolucoes(demolidaBuscando.eventos),
        serfNoFim: fsmDe(demolidaBuscando.estado),
      },
      estradaCortadaNoMeioDaViagem: {
        comando: 'DemolishRoad', tileDemolido: aFrente, noTickDoCorte: resumoDeLiberacoes(cortada.events), fsmDepois: fsmDe(cortada),
        armazemDepoisDeDevolver: saidaDe(cortadaAteOFim.estado, P1), devolucoes: devolucoes(cortadaAteOFim.eventos),
        obraSegueEsperando: faltamDe(cortadaAteOFim.estado, 'obra-a'),
        aposRefazerAEstrada: { faltamDaObra: faltamDe(refeita.estado, 'obra-a'), armazem: saidaDe(refeita.estado, P1), concluidas: refeita.eventos.filter((e) => e.type === 'task-completed').length },
      },
      estradaCortadaComRotaAlternativa: {
        liberacoes: liberacoes(alternativa.eventos).length, concluidas: alternativa.eventos.filter((e) => e.type === 'task-completed').length,
        faltamDaObra: faltamDe(alternativa.estado, 'obra-a'),
      },
      serfCercadoSemRota: {
        noTick: resumoDeLiberacoes(cercado.events), fsmDepois: fsmDe(cercado), ticksSeguidosSemLacoReclamaLibera: ticksSemLaco,
      },
    },
    // O aceite "nunca euclidiana" da F09 segue valendo (testes da F09 intocados) e a perna do serf tambem.
    distancia: {
      medida: 'A* em ticks: da posicao do serf ate a porta de coleta (livre) + da porta ate a porta da obra (so estrada)',
      cenarioDoMuro: {
        euclidianaAteA: euclid({ gx: 20, gy: 20 }, { gx: 20, gy: 13 }), euclidianaAteB: euclid({ gx: 20, gy: 20 }, { gx: 20, gy: 33 }),
        pernaDoSerfAteA: planoA?.ateAOrigem.custo ?? null, pernaDoSerfAteB: planoB?.ateAOrigem.custo ?? null,
        pernaDeEntregaA: planoA?.deEntrega.custo ?? null, pernaDeEntregaB: planoB?.deEntrega.custo ?? null,
        ordemParaOSerfDoOutroLadoDoMuro: tarefasEmOrdem(muro, SERF_DO_LADO_DE_B).map((t) => t.id),
        ordemParaOSerfDoLadoDeA: tarefasEmOrdem(muro, SERF_DO_LADO_DE_A).map((t) => t.id),
        ordemSemUnidade: tarefasEmOrdem(muro).map((t) => t.id),
      },
    },
    pathfinding: {
      // provado em tests/F10-astar.test.ts (nao recalculado aqui): custo igual ao de um oraculo independente
      // (relaxamento em fila) em 160 mapas livres e 240 redes por estrada sorteados com RNG semeado;
      // por estrada, A* acha caminho se e somente se `isConnected` da F08 acha (500 redes sorteadas).
      provadoEm: 'tests/F10-astar.test.ts',
      cache: cacheDaAmostra,
    },
    // Propriedade estrutural: eventos aleatorios, invariantes e conservacao de bens a cada tick.
    propriedadeEstrutural: {
      sementes: [1, 2, 3], passosPorSemente: 250, ...coberturaDoCaos,
    },
    // O numero que fecha a pergunta do indice do JobBoard (nota do item F10): 20 obras, 4 serfs.
    cargaComMuitasObras: {
      ...metricasDeCarga,
      tarefasDoF09ComNinguemReclamando: 100,
      observacao: 'sem medida de tempo: contagens. buscasExecutadas = A* de fato; acertosDeCache = perguntas respondidas sem buscar',
    },
    // So declarado, nao implementado nesta feature.
    declaradoApenas: [
      'tempo de manuseio em carregando/entregando (dado inexistente): 1 tick cada',
      'demolir obra por comando (F16): a demolicao aqui e injecao de estado',
      'laco de 10 Hz e interpolacao entre ticks (F11a); `avancar` era ponte de harness com prazo na F11a, que o resolveu (pausar/retomar/avancar)',
      'capacidade de carga do serf: uma unidade por viagem',
      'capacidade do armazem ao devolver (capacidade: null hoje)',
    ],
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F10 (test-output/F10-shot.json)',
  });
});
