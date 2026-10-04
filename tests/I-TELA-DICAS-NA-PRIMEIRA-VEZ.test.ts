/**
 * I-TELA-DICAS-NA-PRIMEIRA-VEZ — o jogo explica quando acontece.
 *
 * (a) a funcao pura "estado + o que ja vi -> dica a mostrar", por tabela, uma dica por vez e nunca
 *     repetida;
 * (b) desligada nas opcoes, nenhuma dica aparece;
 * (c) a marca fica no `localStorage` (aqui, uma gaveta de mentira), e o save fica igual com e sem
 *     dica vista.
 * O (d) e o roteiro `tools/shots/I-TELA-DICAS-NA-PRIMEIRA-VEZ.js`, que carrega o save que este teste
 * grava (`<evidencia>/I-TELA-DICAS-NA-PRIMEIRA-VEZ.save.txt`): a escola com fila e sem estrada, e
 * uma pedreira pronta, ligada e sem pedreiro. Duas dicas, uma depois da outra.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { ID_DA_ESCOLA, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Predio, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { criarEscaramuca } from '../src/sim/cenario';
import { segundosDePazRestantes } from '../src/sim/paz';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { estadoNovo } from '../src/escolha-da-partida';
import { DICAS, dicaAMostrar, gatilhoDaDica, textoDaDica } from '../src/ui/dicas';
import { textoDaRecusa } from '../src/ui/aviso-de-ordem';
import { CHAVE_DAS_DICAS, criarDicasVivas, DICAS_PADRAO, lerDicas } from '../src/preferencias-de-dicas';
import type { Gaveta } from '../src/arquivo-da-partida';
import temaSertao from '../data/theme-sertao.json';
import { aberturaDaFaseA } from './helpers/abertura';
import { comPredio, comRua, predioDoTipo } from './helpers/vila-da-fase-i';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;

function gavetaDeMentira(): Gaveta & { readonly guardado: Map<string, string> } {
  const guardado = new Map<string, string>();
  return { guardado, getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => { guardado.set(k, v); } };
}

const comUnidade = (s: GameState, id: string, mexer: (u: Unidade) => Unidade): GameState => {
  const u = s.unidades.porId[id];
  if (u === undefined) throw new Error(`fixture: '${id}' nao existe`);
  return { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, [id]: mexer(u) } } };
};

// ---- os estados da tabela ---------------------------------------------------------------------

const s0 = estadoNovo({ modo: 'livre' });
const escola = predioDoTipo(s0, ID_DA_ESCOLA) as Predio;
const daAbertura = aberturaDaFaseA(s0).plantas.find((p) => p.tipo === 'quarry');
if (daAbertura === undefined) throw new Error('fixture: a abertura nao tem pedreira');

/** A pedreira pronta, ligada ao armazem por estrada calcada, sem pedreiro. */
const comPedreira = ((): GameState => {
  const s = comPredio(s0, 'quarry', { gx: daAbertura.gx, gy: daAbertura.gy });
  return comRua(s, predioDoTipo(s, 'quarry') as Predio, 'estradas');
})();
/** A escola com o lenhador na fila, sem estrada: o ouro nao tem por onde chegar. */
const comFilaSemEstrada = (s: GameState): GameState => ({ ...s, treino: { [escola.id]: [{ id: 'f900', unidade: 'woodcutter', estado: 'aguardando' }] } });
const doSave = comFilaSemEstrada(comPedreira);

const primeiroSerf = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.tipo === 'serf') as string;
const comFome = comUnidade(s0, primeiroSerf, (u) => ({ ...u, condicao: 0 }));

const esc0 = criarEscaramuca(SEMENTE);
const pazAte = esc0.pazAteTick ?? 0;
const armazemDoJogador = esc0.predios.ordem.map((id) => esc0.predios.porId[id]).find((p) => p?.tipo === 'storehouse' && p.lado === LADO_DO_JOGADOR) as Predio;
const inimigo = esc0.unidades.ordem.find((id) => esc0.unidades.porId[id]?.lado === LADO_DA_IA) as string;
const comInimigoAVista = comUnidade(esc0, inimigo, (u) => ({ ...u, gx: armazemDoJogador.gx, gy: armazemDoJogador.gy + 4 }));
const fimDaPaz: GameState = { ...esc0, tick: pazAte };
const recusa: GameEvent = { type: 'command-rejected', command: 'AttackBuilding', predio: 'x', unidade: null, motivo: 'em-paz' } as GameEvent;
const comRecusa: GameState = { ...esc0, events: [recusa] };

const TABELA: readonly [string, GameState, readonly string[], string | null][] = [
  ['o comeco do jogo livre', s0, [], null],
  ['o comeco da escaramuca (inimigo longe, em paz)', esc0, [], null],
  ['pedreira pronta sem pedreiro', comPedreira, [], 'sem-trabalhador'],
  ['a mesma, ja vista', comPedreira, ['sem-trabalhador'], null],
  ['escola com fila e sem estrada', comFilaSemEstrada(s0), [], 'sem-estrada'],
  // uma por vez: as duas valem, e a ordem de DICAS escolhe
  ['as duas casas', doSave, [], 'sem-estrada'],
  ['as duas casas, a primeira vista', doSave, ['sem-estrada'], 'sem-trabalhador'],
  ['as duas casas, as duas vistas', doSave, ['sem-estrada', 'sem-trabalhador'], null],
  ['um carregador com fome', comFome, [], 'fome'],
  ['inimigo na vista', comInimigoAVista, [], 'inimigo-a-vista'],
  ['o fim da paz', fimDaPaz, [], 'fim-da-paz'],
  ['um tick antes do fim da paz', { ...esc0, tick: pazAte - 1 }, [], null],
  ['a ordem recusada pela paz', comRecusa, [], 'ordem-recusada'],
];

describe('I-TELA-DICAS-NA-PRIMEIRA-VEZ — o jogo explica quando acontece', () => {
  it('toda dica tem texto no tema, e todo texto tem dica (ida e volta)', () => {
    expect(Object.keys(temaSertao.dicas.textos).sort()).toEqual([...DICAS].sort());
    expect(pazAte).toBeGreaterThan(0);
  });

  it('(a) estado + o que ja vi -> dica a mostrar, por tabela', () => {
    for (const [nome, estado, vistas, esperada] of TABELA) {
      expect(dicaAMostrar(estado, vistas, true, gameData)?.id ?? null, nome).toBe(esperada);
    }
    // a dica aponta o lugar: a casa do alerta, a unidade
    const pedreira = predioDoTipo(comPedreira, 'quarry') as Predio;
    const naPedreira = dicaAMostrar(comPedreira, [], true, gameData)?.tile;
    expect(naPedreira).toBeDefined();
    expect(Math.abs((naPedreira?.gx ?? -99) - pedreira.gx)).toBeLessThan(4);
    expect(Math.abs((naPedreira?.gy ?? -99) - pedreira.gy)).toBeLessThan(4);
    expect(dicaAMostrar(comInimigoAVista, [], true, gameData)?.tile).toEqual({ gx: armazemDoJogador.gx, gy: armazemDoJogador.gy + 4 });
    expect(dicaAMostrar(fimDaPaz, [], true, gameData)?.tile).toBeNull();
    // a ordem recusada repete o motivo que o aviso ja da
    const motivo = textoDaRecusa([recusa], segundosDePazRestantes(comRecusa, gameData));
    expect(motivo).not.toBeNull();
    const ordem = dicaAMostrar(comRecusa, [], true, gameData);
    expect(ordem?.detalhe).toBe(motivo);
    expect(textoDaDica(ordem as NonNullable<typeof ordem>)).toContain(motivo as string);
    // e o texto de toda dica sai sem chave por preencher
    for (const [, estado] of TABELA) {
      const d = dicaAMostrar(estado, [], true, gameData);
      if (d !== null) expect(textoDaDica(d), d.id).not.toMatch(/[{}]/);
    }
  });

  it('(a) nunca repetida: mostrar e marcar, uma por vez, ate acabar', () => {
    const vivas = criarDicasVivas(gavetaDeMentira());
    const vistas: string[] = [];
    for (let i = 0; i < DICAS.length + 2; i += 1) {
      const d = dicaAMostrar(doSave, vivas.atual.vistas, vivas.atual.ligadas, gameData);
      if (d === null) break;
      vistas.push(d.id);
      vivas.marcar(d.id);
    }
    expect(vistas).toEqual(['sem-estrada', 'sem-trabalhador']);
    expect(new Set(vistas).size).toBe(vistas.length);
    vivas.marcar('sem-estrada');
    expect(vivas.atual.vistas).toEqual(['sem-estrada', 'sem-trabalhador']);
  });

  it('(b) desligada nas opcoes, nenhuma dica aparece', () => {
    for (const [nome, estado] of TABELA) expect(dicaAMostrar(estado, [], false, gameData), nome).toBeNull();
    const gaveta = gavetaDeMentira();
    const vivas = criarDicasVivas(gaveta);
    vivas.ligar(false);
    expect(lerDicas(gaveta).ligadas).toBe(false);
    expect(dicaAMostrar(doSave, vivas.atual.vistas, vivas.atual.ligadas, gameData)).toBeNull();
    // e a chave volta ligada
    vivas.ligar(true);
    expect(dicaAMostrar(doSave, vivas.atual.vistas, vivas.atual.ligadas, gameData)?.id).toBe('sem-estrada');
  });

  it('(c) a marca fica no localStorage, e o save fica igual com e sem dica vista', () => {
    const gaveta = gavetaDeMentira();
    const vivas = criarDicasVivas(gaveta);
    expect(lerDicas(gaveta)).toEqual(DICAS_PADRAO);
    // a mesma partida, com a dica consultada e marcada a cada tick, e sem
    let com = doSave;
    let sem = doSave;
    const vistasNoCaminho: string[] = [];
    for (let t = 0; t < 300; t += 1) {
      const d = dicaAMostrar(com, vivas.atual.vistas, vivas.atual.ligadas, gameData);
      if (d !== null) { vivas.marcar(d.id); vistasNoCaminho.push(d.id); }
      com = step(com, [], gameData);
      sem = step(sem, [], gameData);
    }
    expect(vistasNoCaminho.length).toBeGreaterThan(0);
    expect(salvar(com)).toBe(salvar(sem));
    expect(salvar(com)).not.toContain('sem-estrada');
    // a marca e do navegador: esta na gaveta, na chave das dicas, e so nela
    expect([...gaveta.guardado.keys()]).toEqual([CHAVE_DAS_DICAS]);
    expect(lerDicas(gaveta).vistas).toEqual(vistasNoCaminho);
    // guardado estragado volta ao padrao, sem quebrar
    const estragada = gavetaDeMentira();
    estragada.setItem(CHAVE_DAS_DICAS, '{nao e json');
    expect(lerDicas(estragada)).toEqual(DICAS_PADRAO);
  });

  it('o save do roteiro: as duas casas, para duas dicas na tela', () => {
    expect(gatilhoDaDica('sem-estrada', doSave, gameData)).not.toBeNull();
    expect(gatilhoDaDica('sem-trabalhador', doSave, gameData)).not.toBeNull();
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-TELA-DICAS-NA-PRIMEIRA-VEZ.save.txt`, salvar(doSave));
    gravarEvidencia('I-TELA-DICAS-NA-PRIMEIRA-VEZ', {
      tabela: TABELA.map(([nome, estado, vistas]) => ({ nome, vistas, dica: dicaAMostrar(estado, vistas, true, gameData)?.id ?? null })),
      pazAteTick: pazAte,
      condicaoCheiaDoSerf: condicaoCheiaDoTipo('serf', gameData),
    });
  });
});
