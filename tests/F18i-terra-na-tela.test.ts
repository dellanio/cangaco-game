/**
 * F18i — A PERNA HEADLESS: a BORRACHA do campo (`UnplanField`).
 *
 * O que a tela faz (a ferramenta no menu, o canteiro desenhado, a previa do arrasto) e
 * afirmado pelo roteiro `tools/shots/F18i.js`; aqui esta o que entrou em `sim/` — e so
 * isso entrou, pelo escopo escrito no item da fila.
 *
 * As quatro pernas que o `BUILD_PLAN.md` pede:
 *
 *   (a) sobre tile PLANEJADO: sai do canteiro, e a tarefa de arar que ja estava
 *       reclamada cai com `destino-sumiu`, devolvendo o laborer a `ocioso` sem
 *       violar invariante do JobBoard;
 *   (b) sobre tile JA ARADO: no-op. O recurso fica — campo arado e recurso do tile, e
 *       recurso nao se remove por comando (a mesma regra da rocha). E o que separa
 *       `UnplanField` de um `DemolishField`, que nao existe;
 *   (c) sobre chao vazio: no-op, e NUNCA recusa. Igual ao `DemolishRoad` sobre tile
 *       que nao e rua;
 *   (d) um arrasto misto (planejado + arado + vazio) apaga so o planejado.
 *
 * A perna (a) e a mesma que a F18h provou com o canteiro esvaziado A MAO — la nao
 * havia comando para isso, e o teste dizia por escrito que faltava. Agora ha, e a
 * prova passa pelo `step`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, TarefaArar, Unidade } from '../src/sim/state';
import { ehTarefaDeAradura } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { receitaDoTipo } from '../src/sim/producao';
import { recursoNoTile } from '../src/sim/recursos';
import { caixaDoPredio } from '../src/sim/footprint';
import { chaveDeTile } from '../src/sim/estradas';
import { canPlowField, culturasAraveis, ehCampoPlanejado } from '../src/sim/campos';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { TIPO_QUE_CONSTROI } from '../src/sim/jobs';
import { tipoDoTile } from '../src/sim/mapa';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioDeFazendaSemCampo } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { ancoraDaVila, relativoA } from './helpers/ancoras';
import { LADO_DO_JOGADOR } from '../src/sim/state';

const RECEITA = receitaDoTipo('farm', gameData);
if (RECEITA === null || RECEITA.colheita === null) {
  throw new Error('fixture: `farm` precisa de receita com colheita em data/production.json');
}
const COLHEITA = RECEITA.colheita;
const GRAO = COLHEITA.recurso;

const tile = (gx: number, gy: number) => ({ gx, gy });

/** Um laborer OCIOSO somado ao cenario (que nasce sem civis). Copia deliberada do
 *  helper da F18h: o cenario e o mesmo, e compartilhar helper entre dois arquivos de
 *  aceite amarra um teste a mudanca do outro. */
function comLaborer(estado: GameState, id: string, gx: number, gy: number, dados: GameData): GameState {
  const u: Unidade = {
    lado: LADO_DO_JOGADOR, id, tipo: TIPO_QUE_CONSTROI, gx, gy, fsm: 'ocioso', fsmData: {},
    condicao: condicaoCheiaDoTipo(TIPO_QUE_CONSTROI, dados),
  };
  return {
    ...estado,
    unidades: { porId: { ...estado.unidades.porId, [u.id]: u }, ordem: [...estado.unidades.ordem, u.id] },
  };
}

function avancar(estado: GameState, n: number, dados: GameData = gameData): GameState {
  let atual = estado;
  for (let i = 0; i < n; i += 1) {
    atual = step(atual, [], dados);
    const violacoes = violacoesDeInvariantes(atual, dados);
    if (violacoes.length > 0) throw new Error(`tick ${atual.tick}: ${violacoes.join(' | ')}`);
  }
  return atual;
}

/** Os tiles de GRAMA livres ao alcance da fazenda `f1`. Mesma varredura da F18h: a
 *  caixa de alcance contada como a sim a conta (`x1 - 1` e o ultimo tile ocupado). */
function gramaAoAlcanceDaFazenda(estado: GameState, dados: GameData = gameData): { gx: number; gy: number }[] {
  const predio = estado.predios.porId.f1;
  if (predio === undefined) throw new Error('fixture: f1 nao existe');
  const caixa = caixaDoPredio(predio, dados);
  if (caixa === null) throw new Error('fixture: f1 sem caixa');
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

/** Anda ate o tile virar campo de verdade (o laborer ara em `aradura.ticks`). */
function ararAteNascer(estado: GameState, alvo: { gx: number; gy: number }): GameState {
  let atual = estado;
  for (let i = 0; i < 400 && recursoNoTile(atual, alvo.gx, alvo.gy) === null; i += 1) {
    atual = avancar(atual, 1);
  }
  if (recursoNoTile(atual, alvo.gx, alvo.gy) === null) throw new Error('fixture: o tile nao virou campo');
  return atual;
}

// O obreiro nasce no spawn da vila, POR DESLOCAMENTO da ancora: (30,34) hoje. O
// literal absoluto o punha fora da vila no mundo transladado, e desde a noite 17
// (fazenda em (38,30)) a caminhada passou do limite de `ararAteNascer`.
const SPAWN = relativoA(ancoraDaVila())(1, 4);
const base = () => comLaborer(cenarioDeFazendaSemCampo(), 'obreiro', SPAWN.gx, SPAWN.gy, gameData);

const evidencia: Record<string, unknown> = {
  _doc: 'F18i — a borracha do campo. Numeros medidos na corrida, nao asseridos.',
  culturasComFerramenta: culturasAraveis(gameData),
};

describe('F18i (a) — a borracha tira o tile do canteiro e derruba a tarefa', () => {
  it('UnplanField sobre tile planejado esvazia o canteiro, cancela a tarefa e devolve o laborer a ocioso', () => {
    const inicial = base();
    const alvo = gramaAoAlcanceDaFazenda(inicial)[0];
    if (alvo === undefined) throw new Error('fixture: sem grama ao alcance');
    let atual = step(inicial, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    expect(ehCampoPlanejado(atual.camposPlanejados, alvo)).toBe(true);

    // andar ate o laborer TER a tarefa na mao: a borracha tem de valer com a tarefa
    // reclamada, que e o ramo onde as reservas precisam voltar.
    let reclamada: TarefaArar | null = null;
    for (let i = 0; i < 200 && reclamada === null; i += 1) {
      atual = avancar(atual, 1);
      for (const id of atual.jobs.tarefas.ordem) {
        const t = atual.jobs.tarefas.porId[id];
        if (t !== undefined && ehTarefaDeAradura(t) && t.reclamadaPor === 'obreiro') reclamada = t;
      }
    }
    expect(reclamada, 'o laborer reclamou a aradura').not.toBeNull();
    const idDaTarefa = reclamada === null ? 'sem-tarefa' : reclamada.id;

    const depois = step(atual, [{ type: 'UnplanField', tiles: [alvo] }], gameData);

    // o canteiro esvaziou e nada foi recusado
    expect(ehCampoPlanejado(depois.camposPlanejados, alvo)).toBe(false);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toHaveLength(0);
    // a tarefa caiu NO MESMO TICK, pelo motivo certo, e como CANCELADA (nao reaberta:
    // reabrir seria o laborer voltar a arar um tile que ninguem mais quer)
    const liberacoes = depois.events.filter((e) => e.type === 'task-released' && e.tarefa === idDaTarefa);
    expect(liberacoes, 'a liberacao da tarefa de arar').toHaveLength(1);
    const liberacao = liberacoes[0];
    expect(liberacao && 'motivo' in liberacao ? liberacao.motivo : null).toBe('destino-sumiu');
    expect(liberacao && 'resultado' in liberacao ? liberacao.resultado : null).toBe('cancelada');
    expect(depois.jobs.tarefas.porId[idDaTarefa]).toBeUndefined();
    expect(depois.unidades.porId.obreiro?.fsm).toBe('ocioso');
    expect(violacoesDeInvariantes(depois, gameData)).toEqual([]);
    // e nenhum campo nasceu de uma tarefa que caiu
    expect(recursoNoTile(depois, alvo.gx, alvo.gy)).toBeNull();

    evidencia.perna_a = {
      tile: chaveDeTile(alvo),
      tickDoApagar: depois.tick,
      tarefa: idDaTarefa,
      motivo: 'destino-sumiu',
      fsmDoLaborer: depois.unidades.porId.obreiro?.fsm ?? null,
    };
  });

  it('e o tile apagado pode ser desenhado de novo: a borracha nao queima a terra', () => {
    const inicial = base();
    const alvo = gramaAoAlcanceDaFazenda(inicial)[0];
    if (alvo === undefined) throw new Error('fixture: sem grama ao alcance');
    const planejado = step(inicial, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    const apagado = step(planejado, [{ type: 'UnplanField', tiles: [alvo] }], gameData);
    const denovo = step(apagado, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData);
    expect(denovo.events.filter((e) => e.type === 'command-rejected')).toHaveLength(0);
    expect(ehCampoPlanejado(denovo.camposPlanejados, alvo)).toBe(true);
  });
});

describe('F18i (b,c) — o que a borracha NAO alcanca', () => {
  it('sobre tile JA ARADO e no-op: o recurso fica, como a rocha fica', () => {
    const inicial = base();
    const alvo = gramaAoAlcanceDaFazenda(inicial)[0];
    if (alvo === undefined) throw new Error('fixture: sem grama ao alcance');
    const arado = ararAteNascer(step(inicial, [{ type: 'PlowField', recurso: GRAO, tiles: [alvo] }], gameData), alvo);
    const antes = recursoNoTile(arado, alvo.gx, alvo.gy);
    expect(antes?.tipo).toBe(GRAO);
    // o tile ja saiu do canteiro quando virou campo: e por isso que a borracha nao
    // tem o que apagar, e nao por uma segunda regra dizendo "arado nao se apaga".
    expect(ehCampoPlanejado(arado.camposPlanejados, alvo)).toBe(false);

    const depois = step(arado, [{ type: 'UnplanField', tiles: [alvo] }], gameData);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toHaveLength(0);
    expect(recursoNoTile(depois, alvo.gx, alvo.gy)).toEqual(antes);
    expect(depois.camposPlanejados).toEqual(arado.camposPlanejados);

    evidencia.perna_b = {
      tile: chaveDeTile(alvo),
      recursoAntes: antes,
      recursoDepois: recursoNoTile(depois, alvo.gx, alvo.gy),
    };
  });

  it('sobre chao vazio, rocha, agua ou fora do mapa e no-op, e nunca recusa', () => {
    const inicial = base();
    const casos = [
      { onde: 'grama livre', tiles: [tile(29, 27)] },
      { onde: 'rocha do lajedo', tiles: [tile(24, 31)] },
      { onde: 'agua do acude', tiles: [tile(33, 26)] },
      { onde: 'fora do mapa', tiles: [tile(-1, 40)] },
      { onde: 'trecho vazio', tiles: [] },
    ];
    const vistos: Record<string, unknown> = {};
    for (const caso of casos) {
      const depois = step(inicial, [{ type: 'UnplanField', tiles: caso.tiles }], gameData);
      expect(depois.events.filter((e) => e.type === 'command-rejected'), caso.onde).toHaveLength(0);
      expect(depois.camposPlanejados, caso.onde).toEqual(inicial.camposPlanejados);
      expect(depois.recursos, caso.onde).toEqual(inicial.recursos);
      vistos[caso.onde] = caso.tiles.map((t) => chaveDeTile(t));
    }
    evidencia.perna_c = vistos;
  });
});

describe('F18i (d) — o arrasto misto', () => {
  it('apaga so o planejado, e deixa o arado e o chao vazio como estavam', () => {
    const inicial = base();
    const livres = gramaAoAlcanceDaFazenda(inicial);
    const paraArar = livres[0];
    const paraPlanejar = livres[1];
    const vazio = livres[2];
    if (paraArar === undefined || paraPlanejar === undefined || vazio === undefined) {
      throw new Error('fixture: o alcance da fazenda precisa de tres tiles de grama livres');
    }
    // um tile ja virado campo, outro so desenhado, e um terceiro intocado
    const primeiro = step(inicial, [{ type: 'PlowField', recurso: GRAO, tiles: [paraArar] }], gameData);
    const arado = ararAteNascer(primeiro, paraArar);
    const planejado = step(arado, [{ type: 'PlowField', recurso: GRAO, tiles: [paraPlanejar] }], gameData);
    const recursoAntes = recursoNoTile(planejado, paraArar.gx, paraArar.gy);

    const depois = step(planejado, [{ type: 'UnplanField', tiles: [paraArar, paraPlanejar, vazio] }], gameData);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toHaveLength(0);
    expect(ehCampoPlanejado(depois.camposPlanejados, paraPlanejar)).toBe(false);
    expect(recursoNoTile(depois, paraArar.gx, paraArar.gy)).toEqual(recursoAntes);
    expect(recursoNoTile(depois, vazio.gx, vazio.gy)).toBeNull();
    expect(violacoesDeInvariantes(depois, gameData)).toEqual([]);

    evidencia.perna_d = {
      arado: chaveDeTile(paraArar),
      planejadoApagado: chaveDeTile(paraPlanejar),
      vazio: chaveDeTile(vazio),
      canteiroDepois: Object.keys(depois.camposPlanejados),
    };
  });
});

describe('F18i — a evidencia', () => {
  it('grava o que foi medido', () => {
    gravarEvidencia('F18i', evidencia);
    expect(Object.keys(evidencia)).toContain('perna_d');
  });
});
