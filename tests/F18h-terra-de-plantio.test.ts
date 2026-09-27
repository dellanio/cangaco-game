/**
 * F18h — O ACEITE, nas tres pernas que o `BUILD_PLAN.md` escreve:
 *
 *   (a) no cenario real do operador (`cenarioDeFazendaSemCampo`), um `PlowField`
 *       sobre tiles de GRAMA ao alcance da fazenda faz o alerta `sem-campo` sumir
 *       e o milho aparecer. O teste afirma a TRANSICAO: no tick do comando, zero
 *       milho e `sem-campo` presente; depois, milho > 0 e `sem-campo` ausente;
 *   (b) as recusas nomeiam o motivo e NAO sujam o canteiro, e a tarefa de arar cujo
 *       tile saiu do canteiro cai com `'destino-sumiu'` devolvendo o laborer a
 *       `ocioso`;
 *   (c) o `sertao-128` regravado tem posicao de fazenda a MENOS de 15 tiles do
 *       armazem com tile aravel ao alcance — medida pelo predicado da producao, e
 *       nao por uma copia da regra. Antes da regravacao a mais proxima estava a 37,
 *       e era esse numero que fazia a fazenda da abertura nao produzir em lugar
 *       nenhum perto da vila.
 *
 * Nenhuma mancha do mapa participa da perna (a): os tiles sao grama que o jogador
 * mandou arar. E a perna (c) e sobre a mancha — as duas medem coisas diferentes de
 * proposito, porque a ferramenta sem a mancha resolveria metade do problema.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { Command } from '../src/sim/commands';
import type { GameState, TarefaArar, Unidade } from '../src/sim/state';
import { ID_DO_ARMAZEM, ehTarefaDeAradura } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { alertasDoEstado } from '../src/sim/selectors';
import { receitaDoTipo } from '../src/sim/producao';
import { recursoNoTile, recursosIniciais, tilesDeColheitaNaCaixa } from '../src/sim/recursos';
import { caixaDeTipo, caixaDoPredio } from '../src/sim/footprint';
import { chaveDeTile } from '../src/sim/estradas';
import { canPlowField, ehCampoPlanejado } from '../src/sim/campos';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { TIPO_QUE_CONSTROI } from '../src/sim/jobs';
import { tipoDoTile } from '../src/sim/mapa';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioDeFazendaSemCampo } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { ancoraDoLagoPequeno, ancoraDoLajedo, naVila, relativoA } from './helpers/ancoras';

const RECEITA = receitaDoTipo('farm', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `farm` precisa de receita com colheita em data/production.json');
}
const COLHEITA = RECEITA.colheita;
const GRAO = COLHEITA.recurso;
const ARADURA = gameData.recursos.tipos[GRAO]?.aradura ?? null;
if (ARADURA === null) {
  throw new Error(`fixture: '${GRAO}' precisa do bloco 'aradura' em data/resources.json`);
}

const PLANTIO = gameData.recursos.tipos[GRAO]?.reposicao?.ticksDeSemear ?? 0;
const CRESCER = gameData.recursos.tipos[GRAO]?.reposicao?.ticksDeCrescer ?? 0;

const tile = (gx: number, gy: number) => ({ gx, gy });

/** Um laborer OCIOSO no estado, somado. `cenarioDeFazendaSemCampo` passa por
 *  `semCivis` e fica sem nenhum; quem ara e o laborer, e sem ele o cenario
 *  provaria a recusa e nao o ciclo. */
function comLaborer(estado: GameState, id: string, gx: number, gy: number, dados: GameData): GameState {
  const u: Unidade = {
    id, tipo: TIPO_QUE_CONSTROI, gx, gy, fsm: 'ocioso', fsmData: {},
    condicao: condicaoCheiaDoTipo(TIPO_QUE_CONSTROI, dados),
  };
  return {
    ...estado,
    unidades: { porId: { ...estado.unidades.porId, [u.id]: u }, ordem: [...estado.unidades.ordem, u.id] },
  };
}

/** Anda `n` ticks sem comando, checando as invariantes do JobBoard a cada um — a
 *  tarefa de arar e tipo novo no quadro, e e aqui que ela responde por isso. */
function avancar(estado: GameState, n: number, dados: GameData = gameData): GameState {
  let atual = estado;
  for (let i = 0; i < n; i += 1) {
    atual = step(atual, [], dados);
    const violacoes = violacoesDeInvariantes(atual, dados);
    if (violacoes.length > 0) throw new Error(`tick ${atual.tick}: ${violacoes.join(' | ')}`);
  }
  return atual;
}

/** Milho ENTREGUE: o que esta em gaveta de predio, qualquer uma — a mesma conta da
 *  F18, e nao "existe recurso no tile". O que o aceite quer e producao. */
function entregue(estado: GameState): number {
  let total = 0;
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (p?.estado !== 'completo') continue;
    total += (p.estoque.entrada[GRAO] ?? 0) + (p.estoque.saida[GRAO] ?? 0);
  }
  return total;
}

const temSemCampo = (estado: GameState): boolean =>
  alertasDoEstado(estado, gameData).some((a) => a.predio === 'f1' && a.causa === 'sem-campo');

/** Os tiles de GRAMA livres ao alcance da fazenda `f1`, em ordem. E daqui que sai o
 *  trecho que o jogador arrasta: grama de verdade, conferida no mapa, e nao uma
 *  coordenada escolhida a mao que um mapa novo poderia molhar. */
function gramaAoAlcanceDaFazenda(estado: GameState, dados: GameData = gameData): { gx: number; gy: number }[] {
  const predio = estado.predios.porId.f1;
  if (predio === undefined) throw new Error('fixture: f1 nao existe');
  const caixa = caixaDoPredio(predio, dados);
  if (caixa === null) throw new Error('fixture: f1 sem caixa');
  // A CAIXA DE ALCANCE, contada como a sim conta (`tilesDeColheitaNaCaixa`): o
  // ultimo tile ocupado e `x1 - 1`, e e dele que saem os `alcance` passos. Aqui a
  // varredura e da caixa inteira, e nao da camada de recurso — o que se procura e
  // chao LIVRE para arar, que por definicao ainda nao esta na camada.
  const alcance = COLHEITA.alcance;
  const livres: { gx: number; gy: number }[] = [];
  for (let gy = caixa.y0 - alcance; gy <= caixa.y1 - 1 + alcance; gy += 1) {
    for (let gx = caixa.x0 - alcance; gx <= caixa.x1 - 1 + alcance; gx += 1) {
      if (tipoDoTile(gx, gy, dados) !== 'grama') continue;
      if (canPlowField(estado, GRAO, [tile(gx, gy)], dados).ok) livres.push(tile(gx, gy));
    }
  }
  return livres;
}

const evidencia: Record<string, unknown> = {
  _doc: 'F18h — a terra de plantio desenhada pelo jogador. Numeros medidos na corrida, nao asseridos.',
  aradura: { ticks: ARADURA.ticks, terrenoPermitido: ARADURA.terrenoPermitido },
};

describe('F18h (a) — a fazenda que nao produzia passa a produzir, e o jogador e quem manda', () => {
  it('um PlowField sobre grama ao alcance tira o alerta `sem-campo` e entrega milho', () => {
    const base = comLaborer(cenarioDeFazendaSemCampo(), 'obreiro', naVila(1, 4).gx, naVila(1, 4).gy, gameData);
    const alvos = gramaAoAlcanceDaFazenda(base).slice(0, 3);
    expect(alvos.length, 'grama livre ao alcance da fazenda').toBe(3);

    // o PONTO DE PARTIDA, afirmado e nao suposto: nada de milho, alerta de pe.
    expect(temSemCampo(base)).toBe(true);
    expect(entregue(base)).toBe(0);

    const comando: Command = { type: 'PlowField', recurso: GRAO, tiles: alvos };
    const noClique = step(base, [comando], gameData);
    // o comando NAO cria campo: ele escreve o pedido e abre as tarefas.
    expect(alvos.every((t) => ehCampoPlanejado(noClique.camposPlanejados, t))).toBe(true);
    expect(alvos.every((t) => recursoNoTile(noClique, t.gx, t.gy) === null)).toBe(true);
    expect(temSemCampo(noClique)).toBe(true);

    // o laborer ara um tile por vez. Ao fim da primeira aradura o campo existe em
    // POUSIO — e pousio ja e trabalho, entao o alerta cai antes do primeiro grao.
    let atual = noClique;
    let tickDoPrimeiroCampo: number | null = null;
    let tickSemAlerta: number | null = null;
    let tickDoPrimeiroGrao: number | null = null;
    // A JANELA: os 2000 de antes cobriam aradura + viagem + colheita; o F-CAMPO-a pos
    // o campo a CRESCER no tile, e o primeiro grao so sai depois de semear e crescer.
    // A janela soma os dois do dado em vez de chutar um teto novo (medido 2026-09-27:
    // primeiro milho no tick 2037, com crescer 1650; janela de 3695).
    for (let i = 0; i < 2000 + PLANTIO + CRESCER; i += 1) {
      atual = avancar(atual, 1);
      if (tickDoPrimeiroCampo === null && alvos.some((t) => recursoNoTile(atual, t.gx, t.gy) !== null)) {
        tickDoPrimeiroCampo = atual.tick;
      }
      if (tickSemAlerta === null && !temSemCampo(atual)) tickSemAlerta = atual.tick;
      if (tickDoPrimeiroGrao === null && entregue(atual) > 0) {
        tickDoPrimeiroGrao = atual.tick;
        break;
      }
    }

    expect(tickDoPrimeiroCampo, 'tick em que o primeiro tile virou campo').not.toBeNull();
    expect(tickSemAlerta, 'tick em que `sem-campo` sumiu').not.toBeNull();
    expect(tickDoPrimeiroGrao, 'tick do primeiro milho entregue').not.toBeNull();
    // a TRANSICAO, que e o que o aceite pede: presente antes, ausente depois.
    expect(temSemCampo(atual)).toBe(false);
    expect(entregue(atual)).toBeGreaterThan(0);
    // e o canteiro esvaziou: todo tile pedido virou campo, nenhum ficou desenhado.
    expect(alvos.every((t) => ehCampoPlanejado(atual.camposPlanejados, t))).toBe(false);

    evidencia.perna_a = {
      fazenda: 'f1 em (33,30)',
      tilesArados: alvos.map((t) => chaveDeTile(t)),
      tickDoComando: noClique.tick,
      tickDoPrimeiroCampo,
      tickSemAlerta,
      tickDoPrimeiroGrao,
      milhoEntregue: entregue(atual),
    };
  });

  it('e o milho nasce em POUSIO, nao maduro: terra arada e por semear', () => {
    const base = comLaborer(cenarioDeFazendaSemCampo(), 'obreiro', naVila(1, 4).gx, naVila(1, 4).gy, gameData);
    const alvo = gramaAoAlcanceDaFazenda(base)[0];
    if (alvo === undefined) throw new Error('fixture: sem grama ao alcance');
    let atual = step(base, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    for (let i = 0; i < 400 && recursoNoTile(atual, alvo.gx, alvo.gy) === null; i += 1) {
      atual = avancar(atual, 1);
    }
    const nascido = recursoNoTile(atual, alvo.gx, alvo.gy);
    expect(nascido).not.toBeNull();
    expect(nascido?.tipo).toBe(GRAO);
    // do DADO, nao digitado: `quantidadeInicial` do tipo (0 para o milho).
    expect(nascido?.quantidade).toBe(gameData.recursos.tipos[GRAO]?.quantidadeInicial);
  });
});

describe('F18h (b) — as recusas e o caminho de volta', () => {
  const base = () => comLaborer(cenarioDeFazendaSemCampo(), 'obreiro', naVila(1, 4).gx, naVila(1, 4).gy, gameData);

  it('cada recusa nomeia o motivo e NAO suja o canteiro', () => {
    const inicial = base();
    const casos: { readonly motivo: string; readonly tiles: readonly { gx: number; gy: number }[] }[] = [
      // fora do mapa
      { motivo: 'fora-do-mapa', tiles: [tile(-1, 40)] },
      // terreno: a agua do acude do norte nao se ara
      { motivo: 'terreno', tiles: [relativoA(ancoraDoLagoPequeno())(5, 2)] },
      // recurso: o lajedo da vila ja tem pedra
      { motivo: 'recurso', tiles: [relativoA(ancoraDoLajedo())(2, 2)] },
      // sobreposicao: o footprint do armazem da vila
      { motivo: 'sobreposicao', tiles: [naVila(1, 1)] },
      // estrada: a rua que liga a fazenda ao armazem
      { motivo: 'estrada', tiles: [naVila(2, 3)] },
      // cultura-desconhecida: nenhum tile chega a ser olhado
      { motivo: 'cultura-desconhecida', tiles: [naVila(-3, 14)] },
    ];
    const vistos: Record<string, unknown> = {};
    for (const caso of casos) {
      const recurso = caso.motivo === 'cultura-desconhecida' ? 'pedra-lunar' : GRAO;
      const depois = step(inicial, [{ type: 'PlowField', recurso, tiles: caso.tiles }], gameData);
      const recusas = depois.events.filter((e) => e.type === 'command-rejected' && e.command === 'PlowField');
      expect(recusas, `recusa de '${caso.motivo}'`).toHaveLength(1);
      const recusa = recusas[0];
      expect(recusa && 'motivo' in recusa ? recusa.motivo : null).toBe(caso.motivo);
      // o canteiro nao mudou, e nenhuma tarefa de arar nasceu
      expect(depois.camposPlanejados).toEqual(inicial.camposPlanejados);
      expect(Object.values(depois.jobs.tarefas.porId).some((t) => t !== undefined && ehTarefaDeAradura(t))).toBe(false);
      vistos[caso.motivo] = caso.tiles.map((t) => chaveDeTile(t));
    }
    evidencia.perna_b_recusas = vistos;
  });

  it('o tile ja no canteiro nao recusa nem duplica: redesenhar o rascunho nao custa', () => {
    const inicial = base();
    const alvo = gramaAoAlcanceDaFazenda(inicial)[0];
    if (alvo === undefined) throw new Error('fixture: sem grama ao alcance');
    const uma = step(inicial, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    const duas = step(uma, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    expect(duas.events.filter((e) => e.type === 'command-rejected')).toHaveLength(0);
    expect(duas.camposPlanejados).toEqual(uma.camposPlanejados);
    const deArar = Object.values(duas.jobs.tarefas.porId).filter((t) => t !== undefined && ehTarefaDeAradura(t));
    expect(deArar).toHaveLength(1);
  });

  it('tarefa reclamada cujo tile saiu do canteiro cai com `destino-sumiu`, e o laborer volta a ocioso', () => {
    const inicial = base();
    const alvo = gramaAoAlcanceDaFazenda(inicial)[0];
    if (alvo === undefined) throw new Error('fixture: sem grama ao alcance');
    let atual = step(inicial, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    // andar ate o laborer TER a tarefa na mao (reclamada por ele)
    let reclamada: TarefaArar | null = null;
    for (let i = 0; i < 200 && reclamada === null; i += 1) {
      atual = avancar(atual, 1);
      for (const id of atual.jobs.tarefas.ordem) {
        const t = atual.jobs.tarefas.porId[id];
        if (t !== undefined && ehTarefaDeAradura(t) && t.reclamadaPor === 'obreiro') reclamada = t;
      }
    }
    expect(reclamada, 'o laborer reclamou a aradura').not.toBeNull();

    // o tile sai do canteiro POR FORA (o equivalente do `DemolishRoad` sobre um tile
    // desenhado, que a F18h ainda nao tem comando para fazer — ver PROGRESS.md).
    const canteiroVazio = { ...atual, camposPlanejados: {} };
    const depois = step(canteiroVazio, [], gameData);
    expect(depois.jobs.tarefas.porId[reclamada?.id ?? '']).toBeUndefined();
    expect(depois.unidades.porId.obreiro?.fsm).toBe('ocioso');
    expect(violacoesDeInvariantes(depois, gameData)).toEqual([]);
    // e nenhum campo nasceu de uma tarefa que caiu
    expect(recursoNoTile(depois, alvo.gx, alvo.gy)).toBeNull();
  });
});

describe('F18h (c) — o mapa regravado abre com terra arada ao alcance da vila', () => {
  it('ha posicao de fazenda a menos de 15 tiles do armazem com tile aravel ao alcance', () => {
    const iniciais = recursosIniciais(gameData);
    const estado = cenarioDeFazendaSemCampo();
    // a pergunta e sobre o MAPA REGRAVADO, e nao sobre o cenario: o estado aqui e o
    // cenario com a camada de recurso do tick 0, que e exatamente o que o mapa diz.
    const noTick0: GameState = { ...estado, recursos: iniciais };
    const armazem = estado.predios.ordem
      .map((id) => estado.predios.porId[id])
      .find((p) => p?.tipo === ID_DO_ARMAZEM);
    if (armazem === undefined) throw new Error('fixture: a vila inicial precisa de um armazem');
    const caixaDoArmazem = caixaDoPredio(armazem, gameData);
    if (caixaDoArmazem === null) throw new Error('fixture: armazem sem caixa');

    const { largura, altura } = gameData.terreno.mapaPadrao;
    let melhor: { gx: number; gy: number; distancia: number; tilesAoAlcance: number } | null = null;
    for (let gy = 0; gy < altura; gy += 1) {
      for (let gx = 0; gx < largura; gx += 1) {
        const caixa = caixaDeTipo('farm', gx, gy, gameData);
        if (caixa === null || caixa.x1 > largura || caixa.y1 > altura) continue;
        // a distancia de Chebyshev entre as duas CAIXAS: zero se encostam.
        const dx = Math.max(caixaDoArmazem.x0 - (caixa.x1 - 1), caixa.x0 - (caixaDoArmazem.x1 - 1), 0);
        const dy = Math.max(caixaDoArmazem.y0 - (caixa.y1 - 1), caixa.y0 - (caixaDoArmazem.y1 - 1), 0);
        const distancia = Math.max(dx, dy);
        if (melhor !== null && distancia >= melhor.distancia) continue;
        // o MESMO predicado da producao: os tiles de colheita da caixa, e o que ha
        // neles na camada inicial de recurso. Pousio conta — plantar e trabalho.
        const tilesAoAlcance = tilesDeColheitaNaCaixa(noTick0, caixa, COLHEITA, gameData).length;
        if (tilesAoAlcance === 0) continue;
        melhor = { gx, gy, distancia, tilesAoAlcance };
      }
    }

    expect(melhor, 'alguma posicao de fazenda com tile aravel ao alcance').not.toBeNull();
    expect(melhor?.distancia).toBeLessThan(15);
    evidencia.perna_c = {
      _doc: 'Distancia de Chebyshev entre as CAIXAS (armazem da vila x fazenda candidata). '
        + 'Antes da regravacao do mapa a mais proxima estava a 37, e por isso a fazenda da '
        + 'abertura nao produzia em lugar nenhum perto da vila.',
      armazem: `${armazem.id} em (${armazem.gx},${armazem.gy})`,
      melhorPosicao: melhor,
      tilesDeCampoNoMapa: Object.values(iniciais).filter((r) => r.tipo === GRAO).length,
    };
  });

  it('a mancha nova nao invade a folga da vila nem o cenario que prova a falta de campo', () => {
    // A `cenarioDeFazendaSemCampo` se confere sozinha (ela joga se alcancar recurso);
    // esta assercao diz a mesma coisa de fora, para que a quebra tenha nome aqui.
    const estado = cenarioDeFazendaSemCampo();
    const fazenda = estado.predios.porId.f1;
    if (fazenda?.estado !== 'completo') throw new Error('fixture: f1 nao esta completa');
    const caixa = caixaDoPredio(fazenda, gameData);
    if (caixa === null) throw new Error('fixture: f1 sem caixa');
    const aoAlcance = tilesDeColheitaNaCaixa(estado, caixa, COLHEITA, gameData);
    expect(aoAlcance).toEqual([]);
  });
});

describe('F18h — a evidencia', () => {
  it('grava o que foi medido', () => {
    gravarEvidencia('F18h', evidencia);
    expect(Object.keys(evidencia)).toContain('perna_c');
  });
});
