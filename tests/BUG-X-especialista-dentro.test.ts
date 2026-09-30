/**
 * BUG-X — o especialista trabalha DENTRO da casa, nao na porta
 * (docs/planos/2026-09-30-BUG-X-especialista-dentro-da-casa.md).
 *
 * Tarefa 1, a medida: o serf e barrado na porta pelo especialista que esta dentro? A
 * vila da calibracao roda pelo `step`, 8 000 ticks, com a colisao civil como o dado a
 * entrega (desligada) e ligada. Todo tick, cada serf com passo a dar olha o tile
 * seguinte: `encontros` conta quando la esta um especialista DENTRO (ocupante que a tela
 * esconde) e nenhum civil fora; `bloqueios` conta quando, nesse mesmo caso, o serf teve
 * o passo recusado (`fsmData.bloqueado` subiu) e o tile seguia sem civil fora DEPOIS do
 * tick. A hipotese do plano e bloqueios = 0 com encontros > 0; sair > 0 mudaria a
 * natureza do conserto (seria sim, nao tela).
 *
 * `entrouAntes` e o que a primeira corrida contou como bloqueio (9, ligada): outro serf
 * andou para o mesmo tile ANTES, no mesmo tick (ordem de `unidades.ordem`), e foi ele que
 * barrou. Medido tile a tile na sessao: todos na porta do Rocado, o outro serf no tile
 * depois do tick. E colisao civil comum, nao o especialista.
 *
 * O BUG-X so muda a tela; a sim e a mesma antes e depois, entao a medida DEPOIS e esta
 * mesma contagem, rodada na arvore com o conserto.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { GameData } from '../src/sim/data/types';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { POSICAO_DO_ESTADO, civisNoTile, ocupaTile } from '../src/sim/colisao';
import { salvar } from '../src/sim/save';
import { unidadesInvisiveis } from '../src/render/visibilidade';
import { unidadesNaCaixa, unidadesNoPonto } from '../src/render/acerto';
import type { UnidadeDesenhada } from '../src/render/acerto';
import { ROTULOS_DE_DENTRO } from '../src/render/trabalho';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

const TICKS = 8_000;
const LIGADA: GameData = {
  ...gameData, movimento: { ...gameData.movimento, colisaoCivil: { ...gameData.movimento.colisaoCivil, ligada: true } },
};

const mesmoTile = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): boolean => a.gx === b.gx && a.gy === b.gy;

interface Medida {
  readonly encontros: number;
  readonly bloqueios: number;
  /** Passo recusado porque outro civil entrou no tile no mesmo tick. */
  readonly entrouAntes: number;
  /** Todo passo recusado de serf, por qualquer causa: o contexto dos dois acima. */
  readonly bloqueiosDeSerf: number;
  readonly final: GameState;
}

function medir(dados: GameData): Medida {
  let s: GameState = createInitialState(dados.economia.estadoInicial.semente);
  const vila = vilaDaCalibracao(s, dados);
  let encontros = 0;
  let bloqueios = 0;
  let entrouAntes = 0;
  let bloqueiosDeSerf = 0;
  for (let i = 0; i < TICKS; i += 1) {
    const invisiveis = unidadesInvisiveis(s);
    const naPorta = new Map<string, number>();
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id];
      if (u === undefined || u.tipo !== 'serf') continue;
      const proximo = (u.fsmData.caminho ?? [])[0];
      if (proximo === undefined) continue;
      const dentroLa = s.unidades.ordem.some((o) => invisiveis.has(o) && mesmoTile(s.unidades.porId[o] as Unidade, proximo));
      if (dentroLa && civisNoTile(s, proximo, id, dados).length === 0) naPorta.set(id, u.fsmData.bloqueado ?? 0);
    }
    const antes = s;
    s = step(s, comandosDaVilaNoTick(s, vila, i, dados), dados);
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id];
      const a = antes.unidades.porId[id];
      if (u === undefined || a === undefined || u.tipo !== 'serf') continue;
      const subiu = (u.fsmData.bloqueado ?? 0) > (a.fsmData.bloqueado ?? 0);
      if (subiu) bloqueiosDeSerf += 1;
      const era = naPorta.get(id);
      const proximo = (a.fsmData.caminho ?? [])[0];
      if (era === undefined || proximo === undefined) continue;
      encontros += 1;
      if (!subiu) continue;
      if (civisNoTile(s, proximo, id, dados).length > 0) entrouAntes += 1;
      else bloqueios += 1;
    }
  }
  return { encontros, bloqueios, entrouAntes, bloqueiosDeSerf, final: s };
}

const desligada = medir(gameData);
const ligada = medir(LIGADA);
const evidencia: Record<string, unknown> = {};

describe('BUG-X — medida: o especialista dentro nao barra o serf na porta', () => {
  it('desligada (o dado de hoje) e ligada: encontros > 0, bloqueios 0', () => {
    for (const [nome, m] of [['desligada', desligada], ['ligada', ligada]] as const) {
      evidencia[nome] = { ticks: TICKS, encontros: m.encontros, bloqueios: m.bloqueios, entrouAntes: m.entrouAntes, bloqueiosDeSerf: m.bloqueiosDeSerf };
      expect(m.encontros, nome).toBeGreaterThan(0);
      expect(m.bloqueios, nome).toBe(0);
    }
    // a contagem enxerga passo recusado: ligada, o serf e barrado por civil fora
    expect(ligada.bloqueiosDeSerf).toBeGreaterThan(0);
  });
});

/** O estado `s` com a unidade `id` trocada por `mudar(u)`. */
function comUnidade(s: GameState, id: string, mudar: (u: Unidade) => Unidade): GameState {
  const u = s.unidades.porId[id] as Unidade;
  return { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, [id]: mudar(u) } } };
}

describe('BUG-X — quem a tela esconde', () => {
  const s = desligada.final;
  const casa = s.predios.ordem
    .map((id) => s.predios.porId[id])
    .find((p) => p !== undefined && p.estado === 'completo' && p.ocupante !== null && p.tipo === 'sawmill');
  if (casa === undefined || casa.estado !== 'completo' || casa.ocupante === null) throw new Error('fixture: a vila nao tem serraria ocupada');
  const ocupante = casa.ocupante;
  const comFsm = (fsm: string): GameState => comUnidade(s, ocupante, (u) => ({ ...u, fsm }));
  const escondido = (e: GameState, id: string): boolean => unidadesInvisiveis(e).has(id);

  it('ocupante dentro some, pausado ou nao; em campo ou andando, aparece', () => {
    const tabela: Record<string, boolean> = {};
    for (const fsm of ['trabalhando', 'esperando_insumo', 'saida_cheia']) {
      tabela[fsm] = escondido(comFsm(fsm), ocupante);
      expect(tabela[fsm], fsm).toBe(true);
    }
    for (const fsm of ['colhendo', 'indo_colher', 'voltando', 'indo_comer']) {
      tabela[fsm] = escondido(comFsm(fsm), ocupante);
      expect(tabela[fsm], fsm).toBe(false);
    }
    // pausado (F16c, D3 de 2026-10-01): "parar a producao" no KaM nao tira o homem
    // (KM_Houses.pas:904-960); ele fica dentro, escondido
    const pausado = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [casa.id]: { ...casa, pausado: true } } } };
    tabela['pausado'] = escondido(comUnidade(pausado, ocupante, (u) => ({ ...u, fsm: 'trabalhando' })), ocupante);
    expect(tabela['pausado']).toBe(true);
    // esperando a porta para sair (D-MOVIMENTO-01c): para os outros, ainda dentro
    tabela['saindo'] = escondido(comUnidade(s, ocupante, (u) => ({ ...u, fsm: 'indo_colher', saindo: 1 })), ocupante);
    expect(tabela['saindo']).toBe(true);
    evidencia['tabela'] = tabela;
  });

  it('comendo some (dentro da Bodega); laborer martelando continua visivel no canteiro', () => {
    const outro = s.unidades.ordem.find((id) => id !== ocupante && s.unidades.porId[id]?.tipo !== 'serf') as string;
    expect(escondido(comUnidade(s, outro, (u) => ({ ...u, fsm: 'comendo' })), outro)).toBe(true);
    expect(escondido(comUnidade(s, outro, (u) => ({ ...u, fsm: 'indo_comer' })), outro)).toBe(false);
    const laborer = s.unidades.ordem.find((id) => s.unidades.porId[id]?.tipo === 'laborer');
    expect(laborer).toBeDefined();
    expect(escondido(comUnidade(s, laborer as string, (u) => ({ ...u, fsm: 'martelando' })), laborer as string)).toBe(false);
  });

  it('contraprova: o escondido esta no estado, no tile da porta, e a tela antiga o desenhava', () => {
    const e = comFsm('trabalhando');
    const u = e.unidades.porId[ocupante] as Unidade;
    expect(e.unidades.ordem).toContain(ocupante);
    expect(ocupaTile(u)).toBe(false);
    expect(escondido(e, ocupante)).toBe(true);
  });

  it('a regra concorda com a colisao: todo estado `dentro` do ocupante e escondido, todo `fora` nao', () => {
    for (const [fsm, onde] of Object.entries(POSICAO_DO_ESTADO)) {
      if (fsm === 'comendo') continue;
      expect(escondido(comFsm(fsm), ocupante), fsm).toBe(onde === 'dentro');
    }
    // e os rotulos em que o caso 2 anima sao `dentro` para a colisao
    for (const r of ROTULOS_DE_DENTRO) expect(POSICAO_DO_ESTADO[r], r).toBe('dentro');
  });
});

describe('BUG-X — o acerto nao pega quem a tela escondeu', () => {
  const tilePx = 64;
  const base = { gxDesenhado: 10, gyDesenhado: 10, deslocamentoPx: { x: 0, y: 0 } };
  const lista: UnidadeDesenhada[] = [
    { ...base, id: 'dentro', visivel: false },
    { ...base, id: 'fora', visivel: true },
    { ...base, id: 'antigo' },
  ];
  it('clique e caixa sobre o tile: so o visivel e o sem campo', () => {
    const centro = { x: 10.5 * tilePx, y: 10.5 * tilePx };
    const noPonto = unidadesNoPonto(lista, centro, tilePx);
    expect(noPonto).not.toContain('dentro');
    expect(noPonto.sort()).toEqual(['antigo', 'fora']);
    const naCaixa = unidadesNaCaixa(lista, { x: 0, y: 0 }, { x: 20 * tilePx, y: 20 * tilePx }, tilePx);
    expect(naCaixa.sort()).toEqual(['antigo', 'fora']);
  });
});

describe('BUG-X — a partida que o roteiro carrega', () => {
  it('serraria ocupada trabalhando, porta sem mais ninguem, e um lenhador colhendo, no mesmo tick', () => {
    let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s);
    const quadro = (e: GameState): { serraria: string; serrador: string; lenhador: string } | null => {
      for (const pid of e.predios.ordem) {
        const p = e.predios.porId[pid];
        if (p === undefined || p.estado !== 'completo' || p.tipo !== 'sawmill' || p.pausado || p.ocupante === null) continue;
        const dono = e.unidades.porId[p.ocupante];
        if (dono?.fsm !== 'trabalhando') continue;
        // a porta sem mais ninguem: o quadro tem de mostrar que ela esta VAZIA, e serf ocioso
        // parado no mesmo tile (a vila os junta ali no comeco) tornaria a prova ambigua
        if (e.unidades.ordem.some((id) => id !== dono.id && mesmoTile(e.unidades.porId[id] as Unidade, dono))) continue;
        const lenhador = e.unidades.ordem.find((id) => {
          const u = e.unidades.porId[id];
          return u !== undefined && u.tipo === 'woodcutter' && u.fsm === 'colhendo';
        });
        if (lenhador !== undefined) return { serraria: pid, serrador: p.ocupante, lenhador };
      }
      return null;
    };
    let achado = null as ReturnType<typeof quadro>;
    for (let i = 0; i < 20_000 && achado === null; i += 1) {
      s = step(s, comandosDaVilaNoTick(s, vila, i));
      achado = quadro(s);
    }
    expect(achado).not.toBeNull();
    const a = achado as NonNullable<typeof achado>;
    const serrador = s.unidades.porId[a.serrador] as Unidade;
    const lenhador = s.unidades.porId[a.lenhador] as Unidade;
    expect(unidadesInvisiveis(s).has(a.serrador)).toBe(true);
    expect(unidadesInvisiveis(s).has(a.lenhador)).toBe(false);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/BUG-X.save.txt`, salvar(s));
    const partida = {
      tick: s.tick, ...a,
      porta: { gx: serrador.gx, gy: serrador.gy }, noLajedo: { gx: lenhador.gx, gy: lenhador.gy },
    };
    writeFileSync(`${dir}/BUG-X.partida.json`, JSON.stringify(partida, null, 2));
    evidencia['partida'] = partida;
    gravarEvidencia('BUG-X', evidencia);
  });
});
