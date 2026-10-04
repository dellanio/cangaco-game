/**
 * I-TELA-PARTIDA-GUIADA — Aprender a jogar.
 *
 * (a) a funcao pura "estado -> passo atual", por tabela, com a condicao de cada passo;
 * (b) headless, como prova de que o tutorial se cumpre: os comandos que o passo pede, dados um a
 *     um ao `step`, levam do primeiro ao ultimo passo, e nenhum passo pede o que a regra recusa;
 * (c) a mesma partida com e sem a faixa da o mesmo estado, byte a byte.
 * O (d) e o roteiro `tools/shots/I-TELA-PARTIDA-GUIADA.js`.
 *
 * O jogador do (b) so faz o que o passo atual pede (`pede`), e acha o lugar como um jogador acharia:
 * as casas da abertura no lugar da geometria da Fase A (`aberturaDaFaseA`), o resto no primeiro
 * lugar em volta da vila que o `canPlace` do jogo aceita, e a estrada pelo A* do jogo ate a rede.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { ID_DA_ESCOLA, LADO_DA_IA } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import type { TileDeGrid } from '../src/sim/estradas';
import { estadoNovo } from '../src/escolha-da-partida';
import {
  condicaoCumprida, passoAtual, passosDaPartidaGuiada, predioDeComida, predioDeComidaSemInsumo, textoDoPasso,
} from '../src/ui/partida-guiada';
import type { PassoDaPartidaGuiada } from '../src/ui/partida-guiada';
import temaSertao from '../data/theme-sertao.json';
import { aberturaDaFaseA } from './helpers/abertura';
import { comPredio, comRua, lugarPara, predioDoTipo, ruaAteARede } from './helpers/vila-da-fase-i';
import { gravarEvidencia } from './helpers/evidence';

const PASSOS = passosDaPartidaGuiada(gameData);
const ULTIMO = PASSOS.length - 1;

/** Teto do (b), em ticks. MEDIDO na sessao da feature (2026-10-04): o ultimo passo apareceu no
 *  tick 4 856; +25% de folga para o balanceamento girar sem o teste virar alarme falso. O valor de
 *  cada corrida vai para a evidencia. */
const TETO = 6_100;

// ---- o jogador do (b) ------------------------------------------------------------------------

interface Corrida {
  readonly estado: GameState;
  /** O tick em que cada passo apareceu. */
  readonly passos: readonly { readonly passo: string; readonly tick: number }[];
  /** Os comandos dados, com o tick em que entraram no `step`. */
  readonly comandos: readonly { readonly tick: number; readonly comando: Command }[];
  readonly recusas: readonly string[];
}

/** O lugar da abertura da Fase A para o tipo, se a geometria tem um. */
function lugarDaAbertura(s0: GameState): (tipo: string) => TileDeGrid | null {
  const abertura = aberturaDaFaseA(s0);
  return (tipo) => {
    const p = abertura.plantas.find((x) => x.tipo === tipo);
    return p === undefined ? null : { gx: p.gx, gy: p.gy };
  };
}

function jogarOTutorial(): Corrida {
  let s = estadoNovo({ modo: 'livre' });
  const daAbertura = lugarDaAbertura(s);
  const passos: { passo: string; tick: number }[] = [];
  const comandos: { tick: number; comando: Command }[] = [];
  const recusas: string[] = [];
  let atual = -1;
  let fila: PassoDaPartidaGuiada['pede'][number][] = [];
  /** A planta que o passo atual pos: o alvo do `PlaceRoad`/`EnqueueTraining` com `null`. */
  let planta: { tipo: string; gx: number; gy: number } | null = null;

  for (let t = 0; t < TETO; t += 1) {
    const i = passoAtual(s, gameData);
    if (i !== atual) {
      atual = i;
      const passo = PASSOS[i] as PassoDaPartidaGuiada;
      passos.push({ passo: passo.id, tick: s.tick });
      if (i === ULTIMO) break;
      fila = [...passo.pede];
      planta = null;
    }
    const pedido = fila.shift();
    let comando: Command | null = null;
    if (pedido !== undefined) {
      if (pedido.comando === 'PlaceBlueprint') {
        for (const tipo of pedido.predios) {
          const onde = daAbertura(tipo) ?? lugarPara(s, tipo);
          if (onde === null || !canPlace(s, tipo, onde.gx, onde.gy, gameData).ok) continue;
          comando = { type: 'PlaceBlueprint', buildingId: tipo, gx: onde.gx, gy: onde.gy };
          planta = { tipo, ...onde };
          break;
        }
        if (comando === null) throw new Error(`o passo '${PASSOS[i]?.id}' pede ${pedido.predios.join('/')}, e o jogo recusa em todo lugar`);
      } else if (pedido.comando === 'PlaceRoad') {
        const daPlanta = planta;
        const alvo = pedido.ate !== null ? predioDoTipo(s, pedido.ate) : daPlanta === null ? undefined
          : s.predios.ordem.map((id) => s.predios.porId[id]).find((p) => p !== undefined && p.tipo === daPlanta.tipo && p.gx === daPlanta.gx && p.gy === daPlanta.gy);
        if (alvo === undefined) throw new Error(`o passo '${PASSOS[i]?.id}' pede estrada ate um predio que nao existe`);
        const tiles = ruaAteARede(s, alvo);
        if (tiles === null) throw new Error(`o passo '${PASSOS[i]?.id}' pede estrada, e o jogo recusa todo caminho`);
        if (tiles.length > 0) comando = { type: 'PlaceRoad', tiles };
      } else {
        const unidade = pedido.unidade ?? (planta === null ? null : gameData.predios.find((p) => p.id === planta?.tipo)?.trabalhador ?? null);
        const escola = predioDoTipo(s, ID_DA_ESCOLA);
        if (unidade === null || escola === undefined) throw new Error(`o passo '${PASSOS[i]?.id}' pede treino sem escola ou sem civil`);
        comando = { type: 'EnqueueTraining', predio: escola.id, unidade };
      }
    }
    if (comando !== null) comandos.push({ tick: s.tick, comando });
    s = step(s, comando === null ? [] : [comando], gameData);
    for (const e of s.events) if (e.type === 'command-rejected') recusas.push(JSON.stringify(e));
  }
  return { estado: s, passos, comandos, recusas };
}

/** Repete os comandos de uma corrida, tick a tick; com `faixa`, le o passo e o texto a cada tick,
 *  como a tela faz. */
function repetir(corrida: Corrida, faixa: boolean): GameState {
  let s = estadoNovo({ modo: faixa ? 'guiada' : 'livre' });
  const porTick = new Map<number, Command[]>();
  for (const c of corrida.comandos) porTick.set(c.tick, [...(porTick.get(c.tick) ?? []), c.comando]);
  while (s.tick < corrida.estado.tick) {
    if (faixa) textoDoPasso(passoAtual(s, gameData), PASSOS, gameData);
    s = step(s, porTick.get(s.tick) ?? [], gameData);
  }
  return s;
}

const CORRIDA = jogarOTutorial();

describe('I-TELA-PARTIDA-GUIADA — aprender a jogar', () => {
  it('os passos seguem a abertura do GDD §1.3, e todo passo tem texto no tema (ida e volta)', () => {
    expect(PASSOS.map((p) => p.id)).toEqual(['estrada', 'escola', 'lenhador', 'pedreira', 'serraria', 'comida', 'quartel', 'escaramuca']);
    expect(Object.keys(temaSertao.partidaGuiada.passos).sort()).toEqual(PASSOS.map((p) => p.id).sort());
    for (let i = 0; i < PASSOS.length; i += 1) {
      const t = textoDoPasso(i, PASSOS, gameData);
      expect(`${t.titulo} ${t.texto}`, PASSOS[i]?.id).not.toMatch(/[{}]/);
    }
    // so o ultimo passo nao tem o que cumprir nem o que pedir
    expect(PASSOS.filter((p) => p.condicao.tipo === 'fim').map((p) => p.id)).toEqual(['escaramuca']);
    expect(PASSOS.filter((p) => p.pede.length === 0).map((p) => p.id)).toEqual(['escaramuca']);
  });

  it('a comida e derivada do dado: o que condition.json restaura, saindo da receita', () => {
    const comidas = new Set(Object.keys(gameData.condicao.restauracaoPorComida));
    for (const tipo of predioDeComida(gameData)) expect(Object.keys(gameData.producao.receitas[tipo]?.sai ?? {}).some((m) => comidas.has(m)), tipo).toBe(true);
    expect(predioDeComidaSemInsumo(gameData).length).toBeGreaterThan(0);
    for (const tipo of predioDeComidaSemInsumo(gameData)) {
      expect(predioDeComida(gameData)).toContain(tipo);
      expect(Object.keys(gameData.producao.receitas[tipo]?.entra ?? {})).toEqual([]);
    }
  });

  it('(a) estado -> passo atual, por tabela', () => {
    const s0 = estadoNovo({ modo: 'livre' });
    const escola = predioDoTipo(s0, ID_DA_ESCOLA) as Predio;
    const lugar = lugarDaAbertura(s0);
    const em = (tipo: string): TileDeGrid => lugar(tipo) ?? (lugarPara(s0, tipo) as TileDeGrid);
    const comida = predioDeComidaSemInsumo(gameData)[0] as string;

    const planejada = comRua(s0, escola, 'estradasPlanejadas');
    const calcada = comRua(s0, escola, 'estradas');
    const naFila: GameState = { ...planejada, treino: { [escola.id]: [{ id: 'f900', unidade: 'woodcutter', estado: 'aguardando' }] } };
    const lenhador = comPredio(naFila, 'woodcutters', em('woodcutters'));
    const pedreira = comPredio(lenhador, 'quarry', em('quarry'));
    const serraria = comPredio(pedreira, 'sawmill', em('sawmill'));
    const comComida = comPredio(serraria, comida, lugarPara(serraria, comida) as TileDeGrid);
    const quartel = comPredio(comComida, 'barracks', lugarPara(comComida, 'barracks') as TileDeGrid);

    const tabela: readonly [string, GameState, string][] = [
      ['o comeco', s0, 'estrada'],
      ['estrada planejada da escola ao armazem', planejada, 'escola'],
      ['estrada calcada da escola ao armazem', calcada, 'escola'],
      ['lenhador na fila da escola', naFila, 'lenhador'],
      ['lenhador ja formado (fora da fila)', { ...planejada, unidades: { porId: { ...s0.unidades.porId, u900: { ...(s0.unidades.porId[s0.unidades.ordem[0] as string] as GameState['unidades']['porId'][string]), id: 'u900', tipo: 'woodcutter' } }, ordem: [...s0.unidades.ordem, 'u900'] } }, 'lenhador'],
      ['lenhador em obra nao conta', comPredio(naFila, 'woodcutters', em('woodcutters'), 'obra'), 'lenhador'],
      ['lenhador do outro lado nao conta', comPredio(naFila, 'woodcutters', em('woodcutters'), 'completo', LADO_DA_IA), 'lenhador'],
      ['lenhador completo', lenhador, 'pedreira'],
      ['pedreira completa', pedreira, 'serraria'],
      ['serraria completa', serraria, 'comida'],
      [`${comida} completo`, comComida, 'quartel'],
      ['quartel completo', quartel, 'escaramuca'],
      // sem memoria: o que desfaz volta a pedir (a serraria sem lenhador volta ao lenhador)
      ['tudo de pe menos o lenhador', { ...quartel, predios: { ...quartel.predios, ordem: quartel.predios.ordem.filter((id) => quartel.predios.porId[id]?.tipo !== 'woodcutters') } }, 'lenhador'],
    ];
    for (const [nome, estado, esperado] of tabela) expect(PASSOS[passoAtual(estado, gameData)]?.id, nome).toBe(esperado);

    // cada condicao, sozinha: a que o passo diz e a que vale no estado em que ele passa
    const ondePassa: Readonly<Record<string, GameState>> = {
      estrada: planejada, escola: naFila, lenhador, pedreira, serraria, comida: comComida, quartel,
    };
    for (const passo of PASSOS) {
      const depois = ondePassa[passo.id];
      if (depois === undefined) {
        expect(condicaoCumprida(passo.condicao, quartel, gameData), passo.id).toBe(false);
        continue;
      }
      expect(condicaoCumprida(passo.condicao, s0, gameData), `${passo.id} no comeco`).toBe(false);
      expect(condicaoCumprida(passo.condicao, depois, gameData), `${passo.id} depois`).toBe(true);
    }
  });

  it('(b) os comandos que cada passo pede levam do primeiro ao ultimo passo, sem recusa', () => {
    gravarEvidencia('I-TELA-PARTIDA-GUIADA', {
      teto: TETO,
      tickFinal: CORRIDA.estado.tick,
      passos: CORRIDA.passos,
      comandos: CORRIDA.comandos.map((c) => ({ tick: c.tick, tipo: c.comando.type, ...(c.comando.type === 'PlaceBlueprint' ? { predio: c.comando.buildingId } : {}), ...(c.comando.type === 'EnqueueTraining' ? { unidade: c.comando.unidade } : {}), ...(c.comando.type === 'PlaceRoad' ? { tiles: c.comando.tiles.length } : {}) })),
      recusas: CORRIDA.recusas,
    });
    expect(CORRIDA.passos.map((p) => p.passo)).toEqual(PASSOS.map((p) => p.id));
    expect(CORRIDA.recusas).toEqual([]);
    // um comando por vez, e o passo so pede o que tem
    const ticks = CORRIDA.comandos.map((c) => c.tick);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it('(c) a mesma partida com e sem a faixa da o mesmo estado, byte a byte', () => {
    expect(JSON.stringify(estadoNovo({ modo: 'guiada' }))).toBe(JSON.stringify(estadoNovo({ modo: 'livre' })));
    const com = repetir(CORRIDA, true);
    const sem = repetir(CORRIDA, false);
    expect(com.tick).toBe(CORRIDA.estado.tick);
    expect(JSON.stringify(com)).toBe(JSON.stringify(sem));
    expect(JSON.stringify(sem)).toBe(JSON.stringify(CORRIDA.estado));
  });
});
