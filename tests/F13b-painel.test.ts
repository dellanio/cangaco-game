/**
 * F13b — os seletores que alimentam o painel da escola. Tudo puro: nenhum estado
 * novo, nenhum campo novo. O painel em si (DOM) nao tem teste unitario porque o
 * Vitest roda em `environment: 'node'` — quem prova a interface e o roteiro
 * `tools/shots/F13b.js`.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { painelDaEscola, predioNoTile } from '../src/sim/selectors';
import {
  armazemPorTipo, avancar, comOuroNaEscola, comOuroNoArmazem, escolaDoCenario, pedir,
} from './helpers/escola-cenario';
import { comEstradas, linhaH } from './helpers/jobs-cenario';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const TICKS = gameData.economia.schoolhouse.ticksPorTreino;
const SLOTS = gameData.economia.schoolhouse.slotsDeFila;
const CUSTO = gameData.economia.schoolhouse.custoOuroPorUnidade;
/** A linha de porta dos dois predios, como no aceite da F13a. */
const RUAS = linhaH(29, 36, 33);

describe('F13b — predioNoTile', () => {
  it('acha o predio pelo footprint inteiro, nao so pelo canto', () => {
    const escola = escolaDoCenario(inicial);
    expect(predioNoTile(inicial, escola.gx, escola.gy)).toBe(ESCOLA);
    // um tile adiante na diagonal ainda e a escola: ela e maior que 1x1, e o
    // jogador clica no meio do predio, nao no canto.
    expect(predioNoTile(inicial, escola.gx + 1, escola.gy + 1)).toBe(ESCOLA);
  });

  it('separa predios vizinhos', () => {
    const armazem = armazemPorTipo(inicial);
    expect(predioNoTile(inicial, armazem.gx, armazem.gy)).toBe(ARMAZEM);
    expect(predioNoTile(inicial, armazem.gx, armazem.gy)).not.toBe(ESCOLA);
  });

  it('tile vazio devolve null', () => {
    expect(predioNoTile(inicial, 0, 0)).toBeNull();
    // a porta fica FORA do footprint (borda sul): clicar nela nao seleciona
    const escola = escolaDoCenario(inicial);
    const [, altura] = gameData.predios.find((p) => p.id === escola.tipo)?.tamanho ?? [];
    expect(predioNoTile(inicial, escola.gx, escola.gy + (altura ?? 0))).toBeNull();
  });

  it('nao e afetado por tick: e derivado, nao guardado', () => {
    const escola = escolaDoCenario(inicial);
    const depois = step(inicial, []);
    expect(predioNoTile(depois, escola.gx + 1, escola.gy + 1)).toBe(ESCOLA);
  });
});

describe('F13b — painelDaEscola', () => {
  it('predio que nao e escola completa devolve null', () => {
    expect(painelDaEscola(inicial, ARMAZEM)).toBeNull();
    expect(painelDaEscola(inicial, 'p999')).toBeNull();
  });

  it('escola vazia: sem itens, com slots, custo e civis vindos do dado', () => {
    const painel = painelDaEscola(inicial, ESCOLA);
    expect(painel).not.toBeNull();
    expect(painel?.itens).toEqual([]);
    expect(painel?.slots).toBe(SLOTS);
    expect(painel?.custoPorUnidade).toBe(CUSTO);
    expect(painel?.tiposTreinaveis).toEqual(gameData.unidades.civis.tipos.map((c) => c.id));
    expect(painel?.podeEnfileirar).toBe(true);
  });

  // --- D2: as tres causas da espera, cada uma pedindo uma acao diferente ---

  it('sem estrada o item diz `sem-estrada`, e NAO `sem-ouro`', () => {
    // o cenario inicial tem ouro no armazem e nenhuma estrada. Se os dois casos
    // lessem igual, este teste nao distinguiria nada — por isso a guarda.
    expect(gameData.economia.estadoInicial.estoque.gold).toBeGreaterThan(0);
    const semRua = avancar(step(inicial, [pedir(ESCOLA, 'stonemason')]), 3);
    const painel = painelDaEscola(semRua, ESCOLA);
    expect(painel?.itens.map((i) => [i.estado, i.motivo]))
      .toEqual([['aguardando', 'sem-estrada']]);
    expect(painel?.itens[0]?.progresso).toBe(0);
  });

  it('com estrada e sem ouro no armazem o motivo vira `sem-ouro`', () => {
    const semOuro = comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 0);
    const pedido = avancar(step(semOuro, [pedir(ESCOLA, 'stonemason')]), 3);
    expect(painelDaEscola(pedido, ESCOLA)?.itens[0]?.motivo).toBe('sem-ouro');
  });

  it('com estrada e ouro o motivo vira `a-caminho`, e ha tarefa no quadro', () => {
    const cenario = comOuroNoArmazem(comEstradas(inicial, RUAS), ARMAZEM, 3);
    const comTarefa = avancar(step(cenario, [pedir(ESCOLA, 'stonemason')]), 3);
    expect(comTarefa.jobs.tarefas.ordem.length).toBeGreaterThan(0);
    expect(painelDaEscola(comTarefa, ESCOLA)?.itens[0]?.motivo).toBe('a-caminho');
  });

  it('ouro ja na escola: sem demanda, sem motivo', () => {
    const comOuro = comOuroNaEscola(step(inicial, [pedir(ESCOLA, 'stonemason')]), ESCOLA, CUSTO);
    expect(painelDaEscola(comOuro, ESCOLA)?.itens[0]?.motivo).toBeNull();
  });

  // --- D3/D4: o motivo e da fila; o progresso e derivado de `restam` ---

  it('treinando: progresso cresce com o tick e o motivo some', () => {
    const cheia = comOuroNaEscola(step(inicial, [pedir(ESCOLA, 'stonemason')]), ESCOLA, CUSTO);
    const meio = avancar(cheia, 1 + Math.floor(TICKS / 2));
    const item = painelDaEscola(meio, ESCOLA)?.itens[0];
    expect(item?.estado).toBe('treinando');
    expect(item?.motivo).toBeNull();
    expect(item?.progresso).toBeGreaterThan(0.4);
    expect(item?.progresso).toBeLessThan(1);
  });

  it('o item que treina nao tem motivo; os que esperam atras dele tem', () => {
    const dois = comOuroNaEscola(
      step(inicial, [pedir(ESCOLA, 'stonemason'), pedir(ESCOLA, 'woodcutter')]), ESCOLA, CUSTO,
    );
    const andando = avancar(dois, 5);
    expect(painelDaEscola(andando, ESCOLA)?.itens.map((i) => [i.estado, i.motivo]))
      .toEqual([['treinando', null], ['aguardando', 'sem-estrada']]);
  });

  it('fila no teto: `podeEnfileirar` fecha', () => {
    const teto = step(inicial, Array.from({ length: SLOTS }, () => pedir(ESCOLA, 'serf')));
    const painel = painelDaEscola(teto, ESCOLA);
    expect(painel?.itens).toHaveLength(SLOTS);
    expect(painel?.podeEnfileirar).toBe(false);
  });

  it('a ordem dos itens e a da fila, e o id neutro do civil chega intacto', () => {
    const fila = step(inicial, [pedir(ESCOLA, 'baker'), pedir(ESCOLA, 'miner')]);
    expect(painelDaEscola(fila, ESCOLA)?.itens.map((i) => i.unidade)).toEqual(['baker', 'miner']);
  });
});
