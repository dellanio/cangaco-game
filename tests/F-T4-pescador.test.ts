/**
 * F-T4a — O PESCADOR SAI PARA A MARGEM, E O CARDUME ACABA.
 *
 * A F-T3 fez o especialista sair do predio. Pedreiro e roceiro, porem, PISAM no
 * tile que colhem — rocha e milho nao bloqueiam passo. O pescador e o primeiro
 * oficio cujo alvo e inalcancavel POR DENTRO: agua e terreno intransponivel, e
 * nunca deixa de ser. E ele, entao, quem cobra a regra de aproximacao
 * (`alvosDeAproximacao`, `tileAlcancavelParaColheita`) no caso em que o proprio
 * tile do recurso nao entra na lista.
 *
 * Nenhuma linha de `sim/` muda aqui: a caminhada, a reserva do quadro e o
 * regime de esgotamento ja existem desde a F-T2a/F-T3. O que muda e o DADO —
 * `fishermans` ganha `colheita` —, e o que este arquivo afirma e o
 * comportamento que o dado libera:
 *
 *  (a) ele sai, anda tile a tile e pesca DA MARGEM: o tile em que fica nao e o
 *      do cardume, esta a exatamente um passo dele, e e andavel;
 *  (b) o cardume SOME do estado ao zerar — regime `nunca`, ao contrario da
 *      arvore e do milho, que ficam em quantidade zero;
 *  (c) lago seco nao trava ninguem: nada reclamado, `fsmData` limpo e o predio
 *      dizendo o motivo pelo mesmo alerta da pedreira sem veio;
 *  (d) no lago grande a escolha PULA o interior. E a licao do BUG-C: a media de
 *      tiles ao alcance esconde o que a forma mostra.
 */
import { describe, expect, it } from 'vitest';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { step } from '../src/sim/tick';
import { chaveDeTile, tileDeChave, tilesDaPorta } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import { recursoNoTile, regimeDoTipo, tilesDeColheita } from '../src/sim/recursos';
import { tileAlcancavelParaColheita } from '../src/sim/aproximacao';
import { tileAndavel } from '../src/sim/pathfinding';
import { alertasDoEstado } from '../src/sim/selectors';
import {
  avancar, cenarioDePescador, cenarioDePescadorDeUmCardume, cenarioDePescadorNoLagoGrande,
  cenarioDeSerraria, comEspacoNaSaida, comRendimentoPorTile, saidaDe,
} from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const chebyshev = (a: TileDeGrid, b: TileDeGrid): number =>
  Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao esta completo`);
  return p;
}

function colheitaDe(estado: GameState, id: string, dados: GameData) {
  const colheita = receitaDoTipo(predioDe(estado, id).tipo, dados)?.colheita ?? null;
  if (colheita === null) throw new Error(`fixture: '${id}' nao tem receita com colheita`);
  return colheita;
}

/** O tile da tarefa de colheita reclamada por esta unidade, ou `null`. */
function tileDaTarefaDe(estado: GameState, unidadeId: string): TileDeGrid | null {
  const u = estado.unidades.porId[unidadeId];
  const tarefaId = u?.fsmData.tarefa ?? null;
  const t = tarefaId === null ? undefined : estado.jobs.tarefas.porId[tarefaId];
  return t !== undefined && t.tipo === 'colher' ? t.origemTile : null;
}

interface Passo {
  readonly tick: number;
  readonly fsm: string;
  readonly gx: number;
  readonly gy: number;
  readonly saida: number;
  readonly tileDaTarefa: string | null;
  readonly restaNoTile: number | null;
}

/**
 * Roda a sim ate a gaveta `saida` do predio subir, um registro por tick. As
 * invariantes valem em TODOS os ticks do percurso — nao so nas pontas —, e o
 * `limite` e teto de seguranca para o ciclo que nunca fecha falhar com a trilha
 * na mao, em vez de por timeout mudo. Nao e afirmacao de desempenho (§8).
 */
function trilhaDeUmCiclo(
  inicial: GameState, predioId: string, unidadeId: string, mercadoria: string,
  dados: GameData = gameData, limite = 800,
): { readonly trilha: readonly Passo[]; readonly fim: GameState } {
  const trilha: Passo[] = [];
  let estado = inicial;
  const saidaInicial = saidaDe(estado, predioId)[mercadoria] ?? 0;
  for (let tick = 1; tick <= limite; tick += 1) {
    estado = step(estado, [], dados);
    const u = estado.unidades.porId[unidadeId];
    if (u === undefined) throw new Error(`fixture: '${unidadeId}' desapareceu no tick ${tick}`);
    const tile = tileDaTarefaDe(estado, unidadeId);
    const saida = saidaDe(estado, predioId)[mercadoria] ?? 0;
    trilha.push({
      tick,
      fsm: u.fsm,
      gx: u.gx,
      gy: u.gy,
      saida,
      tileDaTarefa: tile === null ? null : chaveDeTile(tile),
      restaNoTile: tile === null ? null : (recursoNoTile(estado, tile.gx, tile.gy)?.quantidade ?? 0),
    });
    expect(violacoesDaFsmDoEspecialista(estado, dados), `tick ${tick}`).toEqual([]);
    expect(violacoesDeInvariantes(estado, dados), `tick ${tick}`).toEqual([]);
    if (saida > saidaInicial) return { trilha, fim: estado };
  }
  throw new Error(`o ciclo de '${predioId}' nao fechou em ${limite} ticks: ${JSON.stringify(trilha.slice(-6))}`);
}

/** A trilha colapsada em uma entrada por MUDANCA de estado: e nela que a ordem
 *  do ciclo se le sem depender de quantos ticks cada trecho durou. */
function sequencia(trilha: readonly Passo[]): string[] {
  const s: string[] = [];
  for (const p of trilha) if (p.fsm !== s[s.length - 1]) s.push(p.fsm);
  return s;
}

describe('F-T4a — (a) o pescador anda ate a margem e pesca de la', () => {
  const inicial = comEspacoNaSaida(cenarioDePescador(), 'pesc1');
  const { trilha, fim } = trilhaDeUmCiclo(inicial, 'pesc1', 'pescador', 'fish');
  const chegada = trilha[trilha.length - 1];
  const emCampo = trilha.filter((p) => p.fsm === 'colhendo');

  it('sai, pesca e volta, nessa ordem', () => {
    expect(sequencia(trilha)).toEqual(['indo_colher', 'colhendo', 'voltando', 'trabalhando']);
  });

  it('anda um tile por passo, sem salto, e sai da porta', () => {
    const partida = inicial.unidades.porId['pescador'];
    if (partida === undefined) throw new Error('fixture: pescador nao existe');
    let anterior: TileDeGrid = { gx: partida.gx, gy: partida.gy };
    for (const p of trilha) {
      expect(chebyshev(anterior, p), `tick ${p.tick}`).toBeLessThanOrEqual(1);
      anterior = p;
    }
    const portas = tilesDaPorta(predioDe(inicial, 'pesc1'), gameData).map((t) => chaveDeTile(t));
    expect(trilha.some((p) => !portas.includes(chaveDeTile(p)))).toBe(true);
  });

  it('pesca DA MARGEM: fica ao lado do cardume, em tile andavel, nunca sobre a agua', () => {
    expect(emCampo.length).toBeGreaterThan(0);
    for (const p of emCampo) {
      expect(p.tileDaTarefa, `tick ${p.tick}`).not.toBeNull();
      const alvo = tileDeChave(p.tileDaTarefa ?? '0,0');
      // exatamente UM passo: zero seria em cima da agua, dois seria pescar de longe
      expect(chebyshev(p, alvo), `tick ${p.tick}`).toBe(1);
      expect(tileAndavel(fim, { gx: p.gx, gy: p.gy }, 'livre', gameData), `tick ${p.tick}`).toBe(true);
      // e o que faz a afirmacao acima valer alguma coisa: o alvo NAO se pisa
      expect(tileAndavel(fim, alvo, 'livre', gameData), `tick ${p.tick}`).toBe(false);
    }
  });

  it('o peixe entra na gaveta no tick da VOLTA, junto com o que sai do tile', () => {
    const receita = receitaDoTipo('fishermans', gameData);
    if (receita === null) throw new Error('fixture: fishermans perdeu a receita');
    for (const p of trilha.slice(0, -1)) expect(p.saida, `tick ${p.tick}`).toBe(0);
    expect(chegada?.saida).toBe(receita.sai['fish']);
    expect(chegada?.fsm).toBe('trabalhando');
    const noTile = emCampo.map((p) => p.restaNoTile);
    const cheio = noTile[0];
    expect(cheio).not.toBeNull();
    for (const q of noTile) expect(q).toBe(cheio);
    const alvo = tileDeChave(emCampo[0]?.tileDaTarefa ?? '0,0');
    const restou = recursoNoTile(fim, alvo.gx, alvo.gy)?.quantidade ?? 0;
    expect(restou).toBe((cheio ?? 0) - unidadesPorCiclo(receita));
  });

  it('a tarefa sai do quadro com o deposito', () => {
    expect(chegada?.tileDaTarefa).toBeNull();
    expect(fim.jobs.tarefas.ordem.filter((id) => fim.jobs.tarefas.porId[id]?.tipo === 'colher')).toEqual([]);
  });
});

describe('F-T4a — (b) e (c) o cardume acaba, e o lago seco nao trava ninguem', () => {
  const receita = receitaDoTipo('fishermans', gameData);
  if (receita === null) throw new Error('fixture: fishermans perdeu a receita');
  // um tile que vale UM ciclo: o unico cardume ao alcance zera na primeira volta.
  // O caminho continua sendo o dado de verdade com outro numero (comRendimentoPorTile).
  const dados = comRendimentoPorTile(gameData, 'fish', unidadesPorCiclo(receita));
  const inicial = comEspacoNaSaida(cenarioDePescadorDeUmCardume(dados), 'pesc1');
  const { trilha, fim } = trilhaDeUmCiclo(inicial, 'pesc1', 'pescador', 'fish', dados);
  const alvo = tileDeChave(trilha.find((p) => p.fsm === 'colhendo')?.tileDaTarefa ?? '0,0');
  const depois = (() => {
    let s = fim;
    for (let i = 0; i < 200; i += 1) s = step(s, [], dados);
    return s;
  })();

  it('(b) o cardume vazio SAI do estado — o regime do peixe e `nunca`', () => {
    expect(regimeDoTipo('fish', dados)).toBe('nunca');
    expect(recursoNoTile(fim, alvo.gx, alvo.gy)).toBeNull();
    expect(tilesDeColheita(fim, predioDe(fim, 'pesc1'), colheitaDe(fim, 'pesc1', dados), dados)).toEqual([]);
  });

  it('(c) ninguem fica esperando o que nao volta: nada reclamado, `fsmData` limpo', () => {
    const colher = depois.jobs.tarefas.ordem.filter((id) => depois.jobs.tarefas.porId[id]?.tipo === 'colher');
    expect(colher).toEqual([]);
    const u = depois.unidades.porId['pescador'];
    // ESTRUTURAL, e nao o rotulo digitado: ele para no MESMO estado de espera de
    // quem esperaria insumo — a serraria de gaveta vazia —, e nao num estado
    // proprio de lago seco. Espera indefinida com tarefa presa seria travamento
    // de regra; espera parada, sem nada reclamado e com alerta na tela, e o
    // comportamento que o jogador resolve movendo a cabana.
    const serraria = avancar(cenarioDeSerraria(dados), 20, dados);
    expect(u?.fsm).toBe(serraria.unidades.porId['u2']?.fsm);
    expect(u?.fsmData).toEqual({});
    expect(violacoesDaFsmDoEspecialista(depois, dados)).toEqual([]);
    expect(violacoesDeInvariantes(depois, dados)).toEqual([]);
  });

  it('(c) e o predio DIZ o motivo, pelo mesmo alerta da pedreira sem veio', () => {
    const doPescador = alertasDoEstado(depois, dados).filter((a) => a.predio === 'pesc1');
    expect(doPescador).toEqual([{ predio: 'pesc1', tipo: 'fishermans', causa: 'veio-esgotado' }]);
  });
});

describe('F-T4a — (d) no lago grande, a escolha pula o interior', () => {
  const inicial = cenarioDePescadorNoLagoGrande();
  const colheita = colheitaDe(inicial, 'pesc1', gameData);
  const aoAlcance = tilesDeColheita(inicial, predioDe(inicial, 'pesc1'), colheita, gameData);
  const interior = aoAlcance.filter((k) => !tileAlcancavelParaColheita(inicial, k, gameData));
  const margem = aoAlcance.filter((k) => tileAlcancavelParaColheita(inicial, k, gameData));

  const escolhidos = new Set<string>();
  let estado = comEspacoNaSaida(inicial, 'pesc1');
  for (let i = 0; i < 200; i += 1) {
    estado = step(estado, [], gameData);
    const tile = tileDaTarefaDe(estado, 'pescador');
    if (tile !== null) escolhidos.add(chaveDeTile(tile));
    // a gaveta cheia pararia o ciclo; o que se mede aqui e a ESCOLHA
    estado = comEspacoNaSaida(estado, 'pesc1');
  }

  it('a geometria do lagamar tem interior de verdade — senao a afirmacao seria de vacuo', () => {
    expect(interior.length).toBeGreaterThan(0);
    expect(margem.length).toBeGreaterThan(0);
  });

  it('todo tile escolhido em 200 ticks e de margem, nenhum de interior', () => {
    expect(escolhidos.size).toBeGreaterThan(0);
    for (const k of escolhidos) {
      expect(tileAlcancavelParaColheita(estado, k, gameData), `tile ${k}`).toBe(true);
    }
    expect([...escolhidos].filter((k) => interior.includes(k))).toEqual([]);
  });
});

/**
 * A FORMA da distribuicao, nao a media (aceno 4 do operador, licao do BUG-C).
 * Numero de forma e EVIDENCIA da sessao; o que vira `expect` e a perna (d).
 */
describe('F-T4a — a forma do cardume e da mata', () => {
  /** Manchas por vizinhanca de 8, do jeito que o pescador e o lenhador as veem. */
  function manchas(tiles: readonly (readonly [number, number])[]): number[] {
    const restantes = new Set(tiles.map(([gx, gy]) => chaveDeTile({ gx, gy })));
    const tamanhos: number[] = [];
    while (restantes.size > 0) {
      const primeiro = [...restantes][0] ?? '';
      const pilha = [primeiro];
      restantes.delete(primeiro);
      let tamanho = 0;
      while (pilha.length > 0) {
        const k = pilha.pop() ?? '';
        const t = tileDeChave(k);
        tamanho += 1;
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            const vizinho = chaveDeTile({ gx: t.gx + dx, gy: t.gy + dy });
            if (restantes.delete(vizinho)) pilha.push(vizinho);
          }
        }
      }
      tamanhos.push(tamanho);
    }
    return tamanhos.sort((a, b) => b - a);
  }

  function forma(recurso: string) {
    const base = createInitialState(1, gameData);
    const tiles = gameData.mapa.recursos[recurso] ?? [];
    const chaves = tiles.map(([gx, gy]) => chaveDeTile({ gx, gy }));
    const alcancaveis = chaves.filter((k) => tileAlcancavelParaColheita(base, k, gameData));
    const porTile = gameData.recursos.tipos[recurso]?.rendimentoPorTile ?? 0;
    return {
      tiles: tiles.length,
      manchas: manchas(tiles),
      alcancaveisNoTick0: alcancaveis.length,
      unidadesNominais: tiles.length * porTile,
      unidadesAlcancaveisNoTick0: alcancaveis.length * porTile,
    };
  }

  it('grava manchas, margem e unidades colhiveis como evidencia da sessao', () => {
    const peixe = forma('fish');
    const arvore = forma('tree');
    const lagamar = cenarioDePescadorNoLagoGrande();
    const colheita = colheitaDe(lagamar, 'pesc1', gameData);
    const aoAlcance = tilesDeColheita(lagamar, predioDe(lagamar, 'pesc1'), colheita, gameData);
    gravarEvidencia('F-T4a', {
      pergunta: 'o pescador colhe do tile, da margem, e o cardume acaba — a FORMA do recurso permite?',
      peixe,
      arvore,
      cabanaDoLagamar: {
        tilesAoAlcance: aoAlcance.length,
        margem: aoAlcance.filter((k) => tileAlcancavelParaColheita(lagamar, k, gameData)).length,
        interior: aoAlcance.filter((k) => !tileAlcancavelParaColheita(lagamar, k, gameData)).length,
      },
      nota: 'agua NAO abre com a pesca (regime `nunca`, e o terreno segue intransponivel); '
        + 'a mata abre: arvore cortada vira andavel e o anel seguinte entra no alcance.',
    });
    expect(peixe.tiles).toBeGreaterThan(0);
    expect(arvore.tiles).toBeGreaterThan(0);
  });
});
