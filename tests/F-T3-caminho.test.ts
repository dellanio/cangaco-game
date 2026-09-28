/**
 * F-T3 — POR ONDE se chega ao tile de trabalho, e qual tile sai da escolha.
 *
 * Duas perguntas que a F18 deixou abertas e que passam a valer no dia em que o
 * especialista sai do predio:
 *
 *   1. de qual tile ele lavra? Arvore em pe fecha o passo (F-T2b), entao ele fica
 *      ao LADO; rocha e milho nao fecham, e nesses ele pisa em cima.
 *   2. quais tiles nao servem? O tile debaixo do footprint de um predio — o
 *      roceiro andaria ate um tile que esta debaixo da propria fazenda — e o tile
 *      sem nenhuma aproximacao andavel.
 *
 * PREMISSA DO PLANO CORRIGIDA AQUI (2026-09-25): o plano escreveu "o especialista
 * nao pisa no lajedo (rocha bloqueia passo)". O dado diz o contrario —
 * `resources.json: tipos.rock.bloqueiaPasso` e `false`, por decisao escrita do
 * BUG-C (a pedreira se assenta em cima do lajedo). Quem bloqueia passo e a
 * arvore. O teste afirma a premissa do dado explicitamente: se ela virar, ele
 * falha dizendo qual flag mudou, em vez de passar a medir outra coisa.
 */
import { describe, expect, it } from 'vitest';
import { cenarioDeFazenda, cenarioDePedreira } from './helpers/producao-cenario';
import { alvosDeAproximacao, tileAlcancavelParaColheita } from '../src/sim/aproximacao';
import { buscarCaminho, tileAndavel, tileCobertoPorPredio } from '../src/sim/pathfinding';
import {
  melhorTileDeColheita, melhorTileParaPlantio, tileColhivelAgora, tilePlantavel, tilesDeColheita,
} from '../src/sim/recursos';
import { receitaDoTipo } from '../src/sim/producao';
import { completarObra } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { chaveDeTile, tileDeChave } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import { caminhoAteAproximacaoDoTile, criarTarefaDeColheita, reclamar } from '../src/sim/jobs';
import type { Caminho } from '../src/sim/pathfinding';
import { canPlace } from '../src/sim/placement';
import { registrarTipoConstruido } from '../src/sim/desbloqueio';
import { gameData } from '../src/sim/data';
import type { ColheitaDeRecurso } from '../src/sim/data/types';
import { ancoraDoRocadoDoNorte, relativoA } from './helpers/ancoras';
import { LADO_DO_JOGADOR } from '../src/sim/state';

const DADOS = gameData;

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`teste: '${id}' nao e predio completo`);
  return p;
}

function colheitaDe(tipo: string): ColheitaDeRecurso {
  const c = receitaDoTipo(tipo, DADOS)?.colheita;
  if (c === undefined || c === null) throw new Error(`teste: '${tipo}' perdeu a colheita em production.json`);
  return c;
}

/** O primeiro tile do alcance de `predio` que da para colher agora — derivado do
 *  cenario, nunca digitado: o mapa e do gerador e pode mudar de semente. */
function primeiroTileColhivel(
  estado: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso,
): string {
  for (const k of tilesDeColheita(estado, predio, colheita, DADOS)) {
    if (tileColhivelAgora(estado, k, colheita, 1)) return k;
  }
  throw new Error('teste: o cenario nao tem tile colhivel ao alcance');
}

/**
 * O caso "cercado": um tile de recurso cujas nove casas (ele e os oito vizinhos)
 * o A* nao pisa. Sai do MAPA, nao de fixture — a serra tem lajedo no meio de
 * terreno intransponivel, e e o caso real de veio que ninguem alcanca.
 *
 * A busca usa `tileAndavel` (funcao que ja existia) para ESCOLHER a entrada, e o
 * `expect` e sobre `alvosDeAproximacao`: a funcao em teste nao participa da
 * escolha do proprio caso.
 */
function tileDeRecursoSemAproximacao(estado: GameState, tipo: string): TileDeGrid {
  for (const [gx, gy] of DADOS.mapa.recursos[tipo] ?? []) {
    let algumAndavel = false;
    for (let dy = -1; dy <= 1 && !algumAndavel; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (tileAndavel(estado, { gx: gx + dx, gy: gy + dy }, 'livre', DADOS)) {
          algumAndavel = true;
          break;
        }
      }
    }
    if (!algumAndavel) return { gx, gy };
  }
  throw new Error(`teste: o mapa nao tem tile de '${tipo}' sem nenhuma aproximacao`);
}

/**
 * FIXTURE LOCAL — o milho debaixo de um predio, que e o caso que o BUG-F deixou
 * de proposito: rocha e arvore recusam construcao, milho NAO recusa, porque tile
 * de milho e tile que o jogador plantou (`resources.json`, `_docBloqueiaConstrucao`).
 * Entao o jogador constroi sobre o rocado, e esses tiles seguem na lista de
 * colheita da fazenda vizinha.
 *
 * Construir o caso aqui, e nao no cenario, e o que a Tarefa 1 do plano decidiu ao
 * medir: `cenarioDeFazenda` NAO produz a escolha debaixo do footprint
 * (test-output/zz-probe-F-T3.json).
 *
 * O galpao cai em (109,26) — 3x3 sobre campo arado, dentro do alcance de `f1` e
 * ANTES dele na varredura (norte->sul, oeste->leste). As quantidades sao semeadas
 * para que a primeira escolha de cada lado caia debaixo do galpao:
 *   (110,28) cheio e coberto    -> a colheita erraria aqui
 *   (111,28) em pousio, coberto -> o plantio erraria aqui
 *   (112,28) em pousio, livre   -> onde o plantio DEVE cair
 *   (113,28) cheio e livre      -> onde a colheita DEVE cair
 *
 * 2026-09-27 — o caso andou para dentro do alcance: o `farm.colheita.alcance_tiles`
 * caiu de 4 para 2 (decisao do operador, F-CAMPO), e (108,26) saiu do alcance de
 * `f1`. A forma e a mesma — os dois primeiros tiles da varredura cobertos, o
 * primeiro pousio e o primeiro cheio livres logo depois; o galpao so cobre dois
 * tiles da fileira, e nao tres como antes.
 */
const NORTE = relativoA(ancoraDoRocadoDoNorte());
const GALPAO = { id: 'galpao-no-campo', ...NORTE(1, 4) } as const; // (109,26) hoje
const CHEIO_E_COBERTO = chaveDeTile(NORTE(2, 6));
const POUSIO_E_COBERTO = chaveDeTile(NORTE(3, 6));
const POUSIO_E_LIVRE = chaveDeTile(NORTE(4, 6));
const CHEIO_E_LIVRE = chaveDeTile(NORTE(5, 6));

function comMilhoDebaixoDaFazenda(estado: GameState): GameState {
  const def = DADOS.predios.find((p) => p.id === 'storehouse');
  if (!def) throw new Error('fixture: storehouse saiu de buildings.json');
  // A fixture confere a si mesma: o ponto do caso e que o jogo PERMITE esta
  // planta — e ele permite, porque milho nao bloqueia construcao. Se `canPlace`
  // passar a recusar, o caso deixou de existir e isto falha aqui, com o motivo
  // escrito, em vez de o teste seguir medindo outra coisa.
  //
  // `registrarTipoConstruido` primeiro porque o cenario nasce sem serraria e o
  // armazem e desbloqueado por ela (`buildings.json: desbloqueadoPor`): sem isto
  // a recusa seria 'bloqueado', que e desbloqueio, nao posicao — a recusa que
  // interessa aqui.
  const comOArmazemLiberado = registrarTipoConstruido(estado, 'sawmill');
  const veredito = canPlace(comOArmazemLiberado, 'storehouse', GALPAO.gx, GALPAO.gy, DADOS);
  if (!veredito.ok) throw new Error(`fixture: o jogo recusou o galpao sobre o campo (${veredito.motivo})`);
  const galpao = completarObra({
    lado: LADO_DO_JOGADOR, id: GALPAO.id, tipo: 'storehouse', gx: GALPAO.gx, gy: GALPAO.gy, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  }, DADOS);
  const rendimento = DADOS.recursos.tipos['corn']?.rendimentoPorTile;
  if (rendimento === undefined) throw new Error('fixture: corn saiu de resources.json');
  return {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [GALPAO.id]: galpao },
      ordem: [...estado.predios.ordem, GALPAO.id],
    },
    recursos: {
      ...estado.recursos,
      [CHEIO_E_COBERTO]: { tipo: 'corn', quantidade: rendimento },
      [CHEIO_E_LIVRE]: { tipo: 'corn', quantidade: rendimento },
    },
  };
}

describe('F-T3 — por onde se chega ao tile', () => {
  it('a premissa do dado: arvore fecha o passo, rocha e milho nao', () => {
    expect(DADOS.recursos.tipos['tree']?.bloqueiaPasso).toBe(true);
    expect(DADOS.recursos.tipos['rock']?.bloqueiaPasso).toBe(false);
    expect(DADOS.recursos.tipos['corn']?.bloqueiaPasso).toBe(false);
  });

  it('todo alvo de aproximacao e andavel, e a ordem e fixa', () => {
    const estado = cenarioDePedreira(DADOS);
    const lajedo = tileDeChave(primeiroTileColhivel(estado, predioDe(estado, 'q1'), colheitaDe('quarry')));
    const alvos = alvosDeAproximacao(estado, lajedo, DADOS);

    expect(alvos.length).toBeGreaterThan(0);
    for (const a of alvos) expect(tileAndavel(estado, a, 'livre', DADOS)).toBe(true);
    // rocha nao fecha o passo: o pedreiro lavra de cima do lajedo, e o proprio
    // tile e o primeiro alvo — custo zero para quem ja esta nele.
    expect(alvos[0]).toEqual({ gx: lajedo.gx, gy: lajedo.gy });
    // ordem estavel: a mesma chamada devolve a mesma lista, e o desempate do A*
    // deixa de depender de quem chamou.
    expect(alvosDeAproximacao(estado, lajedo, DADOS)).toEqual(alvos);
    const fora = alvos.filter((a) => Math.abs(a.gx - lajedo.gx) > 1 || Math.abs(a.gy - lajedo.gy) > 1);
    expect(fora).toEqual([]);
    expect(alvos.length).toBeLessThanOrEqual(9);
  });

  it('a arvore em pe nao e alvo de si mesma: o lenhador fica ao lado', () => {
    const estado = cenarioDePedreira(DADOS);
    const arvores = DADOS.mapa.recursos['tree'] ?? [];
    const emPe = arvores.find(([gx, gy]) => (estado.recursos[chaveDeTile({ gx, gy })]?.quantidade ?? 0) > 0
      && alvosDeAproximacao(estado, { gx, gy }, DADOS).length > 0);
    if (emPe === undefined) throw new Error('teste: o mapa nao tem arvore em pe com aproximacao');
    const tile = { gx: emPe[0], gy: emPe[1] };
    const alvos = alvosDeAproximacao(estado, tile, DADOS);
    expect(alvos).not.toContainEqual(tile);
    expect(alvos.length).toBeGreaterThan(0);
    expect(tileAlcancavelParaColheita(estado, chaveDeTile(tile), DADOS)).toBe(true);
  });

  it('tile de recurso cercado de intransponivel nao se alcanca', () => {
    const estado = cenarioDePedreira(DADOS);
    const cercado = tileDeRecursoSemAproximacao(estado, 'rock');
    expect(alvosDeAproximacao(estado, cercado, DADOS)).toEqual([]);
    expect(tileAlcancavelParaColheita(estado, chaveDeTile(cercado), DADOS)).toBe(false);
    // e nao e o footprint que reprova: ali nao ha predio nenhum.
    expect(tileCobertoPorPredio(estado, cercado, DADOS)).toBe(false);
  });

  it('tile debaixo de um predio tem aproximacao, e ainda assim nao se trabalha nele', () => {
    const estado = comMilhoDebaixoDaFazenda(cenarioDeFazenda(DADOS));
    const debaixo = tileDeChave(CHEIO_E_COBERTO);
    expect(tileCobertoPorPredio(estado, debaixo, DADOS)).toBe(true);
    // as duas recusas sao independentes: da para CHEGAR perto, o que reprova e a
    // parede em cima. Se um dia `alvosDeAproximacao` passasse a devolver vazio
    // aqui, o teste do tile cercado teria perdido o sentido.
    expect(alvosDeAproximacao(estado, debaixo, DADOS).length).toBeGreaterThan(0);
    expect(tileAlcancavelParaColheita(estado, CHEIO_E_COBERTO, DADOS)).toBe(false);

    const livre = tileDeChave(CHEIO_E_LIVRE);
    expect(tileCobertoPorPredio(estado, livre, DADOS)).toBe(false);
    expect(tileAlcancavelParaColheita(estado, CHEIO_E_LIVRE, DADOS)).toBe(true);
  });

  it('a escolha da colheita erra sem o predicado e acerta com ele', () => {
    const estado = comMilhoDebaixoDaFazenda(cenarioDeFazenda(DADOS));
    const f1 = predioDe(estado, 'f1');
    const milho = colheitaDe('farm');
    const alcancavel = (k: string): boolean => tileAlcancavelParaColheita(estado, k, DADOS);

    // O guarda ACUSA: sem o predicado, a fazenda manda o roceiro para debaixo do
    // galpao. Sem esta metade, "o escolhido nao esta debaixo de predio" passaria
    // por sorte da ordem de varredura.
    const semGuarda = melhorTileDeColheita(estado, f1, milho, 1, undefined, DADOS);
    expect(semGuarda).toBe(CHEIO_E_COBERTO);
    expect(tileCobertoPorPredio(estado, tileDeChave(semGuarda as string), DADOS)).toBe(true);

    const comGuarda = melhorTileDeColheita(estado, f1, milho, 1, undefined, DADOS, alcancavel);
    expect(comGuarda).toBe(CHEIO_E_LIVRE);
    expect(tileCobertoPorPredio(estado, tileDeChave(comGuarda as string), DADOS)).toBe(false);
    expect(tileColhivelAgora(estado, comGuarda as string, milho, 1)).toBe(true);
  });

  it('o mesmo vale para o plantio: ninguem semeia debaixo do proprio celeiro', () => {
    const estado = comMilhoDebaixoDaFazenda(cenarioDeFazenda(DADOS));
    const f1 = predioDe(estado, 'f1');
    const milho = colheitaDe('farm');
    const alcancavel = (k: string): boolean => tileAlcancavelParaColheita(estado, k, DADOS);

    const semGuarda = melhorTileParaPlantio(estado, f1, milho, undefined, DADOS);
    expect(semGuarda).toBe(POUSIO_E_COBERTO);
    expect(tileCobertoPorPredio(estado, tileDeChave(semGuarda as string), DADOS)).toBe(true);

    const comGuarda = melhorTileParaPlantio(estado, f1, milho, undefined, DADOS, alcancavel);
    expect(comGuarda).toBe(POUSIO_E_LIVRE);
    expect(tileCobertoPorPredio(estado, tileDeChave(comGuarda as string), DADOS)).toBe(false);
    expect(tilePlantavel(estado, comGuarda as string, milho, DADOS)).toBe(true);
  });

  it('sem o parametro, as duas escolhas respondem o que respondiam antes', () => {
    const estado = cenarioDeFazenda(DADOS);
    const f1 = predioDe(estado, 'f1');
    const milho = colheitaDe('farm');
    const sempre = (): boolean => true;
    expect(melhorTileDeColheita(estado, f1, milho, 1, undefined, DADOS, sempre))
      .toBe(melhorTileDeColheita(estado, f1, milho, 1, undefined, DADOS));
    expect(melhorTileParaPlantio(estado, f1, milho, undefined, DADOS, sempre))
      .toBe(melhorTileParaPlantio(estado, f1, milho, undefined, DADOS));
  });
});

/**
 * A segunda metade: o CLAIM. Uma tarefa de colheita reclamada e um tile
 * reservado; se o especialista nao tem como chegar, ele reclamaria e largaria a
 * cada tick, mantendo o lajedo reservado para ninguem. O claim passa a conferir o
 * caminho, e o predicado da escolha (Tarefa 2) recusa o MESMO tile — dois lados da
 * mesma elegibilidade, que e o que impede o predio de esperar o que nunca chega.
 */
describe('F-T3 — o claim de colheita exige caminho', () => {
  it('tile ilhado nao se reclama: o claim recusa por sem-caminho', () => {
    const estado = cenarioDePedreira(DADOS);
    // O lajedo cercado de serra existe NO MAPA (ver `tileDeRecursoSemAproximacao`):
    // e o veio real que ninguem alcanca. A tarefa e criada a mao porque a escolha
    // da Tarefa 2 ja nao devolve esse tile — e e exatamente esse par de recusas
    // que o teste seguinte amarra.
    const ilhado = tileDeRecursoSemAproximacao(estado, 'rock');
    const criada = criarTarefaDeColheita(estado, {
      destino: 'q1', origemTile: ilhado, recurso: 'rock', quantidade: 1,
    });
    // a recusa nao pode vir por falta de pedra nem por reserva alheia: o tile esta
    // cheio e a unica tarefa nele e esta.
    expect(criada.state.recursos[chaveDeTile(ilhado)]?.quantidade ?? 0).toBeGreaterThanOrEqual(1);
    expect(reclamar(criada.state, criada.id, 'u1', DADOS)).toEqual({ ok: false, motivo: 'sem-caminho' });
  });

  it('a escolha e o claim recusam o mesmo tile, e aceitam o mesmo tile', () => {
    const estado = cenarioDePedreira(DADOS);
    const lajedo = colheitaDe('quarry');
    const ilhado = chaveDeTile(tileDeRecursoSemAproximacao(estado, 'rock'));
    expect(tileAlcancavelParaColheita(estado, ilhado, DADOS)).toBe(false);

    // e o outro lado: o tile que a escolha devolve tem caminho, e o claim aceita.
    const escolhido = melhorTileDeColheita(
      estado, predioDe(estado, 'q1'), lajedo, 1, undefined, DADOS,
      (k) => tileAlcancavelParaColheita(estado, k, DADOS),
    );
    expect(escolhido).not.toBeNull();
    expect(escolhido).not.toBe(ilhado);
    expect(caminhoAteAproximacaoDoTile(estado, tileDeChave(escolhido as string), 'u1', DADOS)).not.toBeNull();
    const criada = criarTarefaDeColheita(estado, {
      destino: 'q1', origemTile: tileDeChave(escolhido as string), recurso: lajedo.recurso, quantidade: 1,
    });
    expect(reclamar(criada.state, criada.id, 'u1', DADOS).ok).toBe(true);
  });

  it('o caminho termina numa aproximacao: em cima do lajedo, ao lado da arvore', () => {
    const estado = cenarioDePedreira(DADOS);
    const lajedo = tileDeChave(primeiroTileColhivel(estado, predioDe(estado, 'q1'), colheitaDe('quarry')));
    const ateOLajedo = caminhoAteAproximacaoDoTile(estado, lajedo, 'u1', DADOS);
    expect(ateOLajedo).not.toBeNull();
    const alvosDoLajedo = alvosDeAproximacao(estado, lajedo, DADOS);
    const fimNoLajedo = (ateOLajedo as Caminho).tiles.at(-1) as TileDeGrid;
    expect(alvosDoLajedo).toContainEqual(fimNoLajedo);
    // rocha nao fecha o passo, entao o proprio tile e um alvo valido — mas o A*
    // para no alvo mais BARATO, que e o da borda por onde ele chegou. Por isso a
    // assercao nao e "termina em cima": e "termina numa das nove casas, e nunca
    // paga mais do que pagaria para ir em cima".
    expect(Math.max(Math.abs(fimNoLajedo.gx - lajedo.gx), Math.abs(fimNoLajedo.gy - lajedo.gy)))
      .toBeLessThanOrEqual(1);
    expect(alvosDoLajedo).toContainEqual({ gx: lajedo.gx, gy: lajedo.gy });
    const u1 = estado.unidades.porId['u1'];
    if (u1 === undefined) throw new Error('teste: u1 saiu do cenario da pedreira');
    const soEmCima = buscarCaminho(estado, { gx: u1.gx, gy: u1.gy }, [lajedo], 'livre', DADOS);
    expect(soEmCima).not.toBeNull();
    expect((ateOLajedo as Caminho).custo).toBeLessThanOrEqual((soEmCima as Caminho).custo);

    const arvores = DADOS.mapa.recursos['tree'] ?? [];
    const comCaminho = arvores.find(([gx, gy]) => (estado.recursos[chaveDeTile({ gx, gy })]?.quantidade ?? 0) > 0
      && caminhoAteAproximacaoDoTile(estado, { gx, gy }, 'u1', DADOS) !== null);
    if (comCaminho === undefined) throw new Error('teste: nenhuma arvore em pe com caminho a partir de u1');
    const arvore = { gx: comCaminho[0], gy: comCaminho[1] };
    const ateAArvore = caminhoAteAproximacaoDoTile(estado, arvore, 'u1', DADOS) as Caminho;
    const fimNaArvore = ateAArvore.tiles.at(-1) as TileDeGrid;
    // arvore em pe FECHA o passo: o caminho para ao lado, nunca em cima.
    expect(fimNaArvore).not.toEqual(arvore);
    expect(Math.max(Math.abs(fimNaArvore.gx - arvore.gx), Math.abs(fimNaArvore.gy - arvore.gy))).toBe(1);
    expect(alvosDeAproximacao(estado, arvore, DADOS)).toContainEqual(fimNaArvore);
  });

  it('unidade que nao existe nao tem caminho, e nao explode', () => {
    const estado = cenarioDePedreira(DADOS);
    const lajedo = tileDeChave(primeiroTileColhivel(estado, predioDe(estado, 'q1'), colheitaDe('quarry')));
    expect(caminhoAteAproximacaoDoTile(estado, lajedo, 'ninguem', DADOS)).toBeNull();
  });
});
