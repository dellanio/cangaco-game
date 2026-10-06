/**
 * I-PREDIO-IGREJA e I-UNIDADE-PADRE — a Igreja no jogo (construida pelo step), o padre contratado nela por
 * ouro pelo `HireMercenary` generalizado por predio, e o padre que obedece e nao luta (pedido do
 * operador, 2026-10-06; pesquisa em docs/pesquisas/2026-10-05-igreja-e-padre.md).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { salvar } from '../src/sim/save';
import { gameData } from '../src/sim/data';
import { createInitialState, completarObra, LADO_DO_JOGADOR, MERCADORIA_DE_OURO } from '../src/sim/state';
import type { GameEvent, GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { painelDoPredio } from '../src/sim/selectors';
import { tiposContratadosEm } from '../src/sim/prefeitura';
import { gravarEvidencia } from './helpers/evidence';

const LADO_DA_IA = LADO_DO_JOGADOR + 1;
/** A Igreja a leste da escola, com o vao de 1 tile; a porta na linha 33, ligada ao armazem pela rua. */
const IGREJA = { gx: 38, gy: 30 };
const RUA = Array.from({ length: 41 - 29 }, (_, i) => ({ gx: 29 + i, gy: 33 }));

/** Um predio completo do tipo, com ouro na entrada, somado ao estado. */
function comPredio(s: GameState, tipo: string, id: string, gx: number, gy: number, ouro: number, lado = LADO_DO_JOGADOR): GameState {
  const def = gameData.predios.find((p) => p.id === tipo)!;
  const completo = completarObra({ lado, id, tipo, gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  const comOuro: PredioCompleto = { ...completo, estoque: { ...completo.estoque, entrada: { [MERCADORIA_DE_OURO]: ouro } } };
  return { ...s, predios: { porId: { ...s.predios.porId, [id]: comOuro }, ordem: [...s.predios.ordem, id] } };
}
const contratar = (s: GameState, predio: string, tipo = 'priest') => step(s, [{ type: 'HireMercenary', predio, tipo }]);
const recusas = (s: GameState) => s.events.filter((e): e is Extract<GameEvent, { type: 'command-rejected' }> => e.type === 'command-rejected');

describe('I-PREDIO-IGREJA', () => {
  it('(1) a Igreja planta, constroi e completa pelo step (desbloqueada pela Escola)', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    expect(canPlace(s, 'church', IGREJA.gx, IGREJA.gy)).toEqual({ ok: true });
    s = step(s, [{ type: 'PlaceRoad', tiles: RUA }, { type: 'PlaceBlueprint', buildingId: 'church', ...IGREJA }]);
    const id = s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === 'church')!;
    expect(id).toBeDefined();
    let t = 0;
    while (s.predios.porId[id]?.estado !== 'completo' && t < 8000) { s = step(s, []); t++; }
    expect(s.predios.porId[id]?.estado).toBe('completo');
    gravarEvidencia('I-PREDIO-IGREJA', { ticksAteCompletar: t });
  }, 30_000);

  it('(2) com ouro, o padre nasce na porta e o ouro sai; sem ouro, recusado; outro lado, recusado', () => {
    let s = comPredio(createInitialState(1), 'church', 'igreja', IGREJA.gx, IGREJA.gy, 5);
    const antes = s.unidades.ordem.length;
    s = contratar(s, 'igreja');
    expect(s.unidades.ordem.length).toBe(antes + 1);
    const padre = s.unidades.porId[s.unidades.ordem.at(-1)!]!;
    expect(padre).toMatchObject({ tipo: 'priest', lado: LADO_DO_JOGADOR, gy: IGREJA.gy + 3 });
    const custo = gameData.unidades.mercenarios.tipos.find((t) => t.id === 'priest')!.custoOuro;
    expect((s.predios.porId['igreja'] as PredioCompleto).estoque.entrada[MERCADORIA_DE_OURO]).toBe(5 - custo);

    const pobre = contratar(comPredio(createInitialState(1), 'church', 'igreja', IGREJA.gx, IGREJA.gy, 0), 'igreja');
    expect(recusas(pobre).map((r) => r.motivo)).toEqual(['sem-ouro']);
    // a Igreja nao contrata o mercenario da Prefeitura, e a Prefeitura nao contrata o padre
    const igreja = comPredio(createInitialState(1), 'church', 'igreja', IGREJA.gx, IGREJA.gy, 20);
    expect(recusas(contratar(igreja, 'igreja', 'warrior')).map((r) => r.motivo)).toEqual(['tipo-desconhecido']);
    const prefeitura = comPredio(createInitialState(1), 'town_hall', 'pref', IGREJA.gx, IGREJA.gy, 20);
    expect(recusas(contratar(prefeitura, 'pref', 'priest')).map((r) => r.motivo)).toEqual(['tipo-desconhecido']);
  });

  it('(3) o painel da Igreja lista so o padre, e a Prefeitura nao lista o padre; a Igreja esta no menu Vila', () => {
    expect(tiposContratadosEm('church').map((t) => t.id)).toEqual(['priest']);
    expect(tiposContratadosEm('town_hall').map((t) => t.id)).not.toContain('priest');
    const s = comPredio(createInitialState(1), 'church', 'igreja', IGREJA.gx, IGREJA.gy, 3);
    expect(painelDoPredio(s, 'igreja')?.prefeitura?.tipos.map((t) => t.tipo)).toEqual(['priest']);
    const menu = JSON.parse(readFileSync('data/menu-build.json', 'utf8')) as { grupos: { id: string; predios: string[] }[] };
    expect(menu.grupos.find((g) => g.id === 'vila')?.predios).toContain('church');
  });

  it('grava a partida do roteiro: a vila e a Igreja completa com 5 de ouro, sem rua (o ouro nao se repoe)', () => {
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-PREDIO-IGREJA.save.txt`, salvar(comPredio(createInitialState(gameData.economia.estadoInicial.semente), 'church', 'igreja', IGREJA.gx, IGREJA.gy, 5)));
  });

  it('(4) determinismo: a mesma contratacao da o mesmo estado', () => {
    const correr = () => JSON.stringify(contratar(comPredio(createInitialState(1), 'church', 'igreja', IGREJA.gx, IGREJA.gy, 5), 'igreja'));
    expect(correr()).toBe(correr());
  });
});

describe('I-UNIDADE-PADRE', () => {
  const padre = (gx: number, gy: number, lado = LADO_DO_JOGADOR): Unidade =>
    ({ id: `p${gx}`, lado, tipo: 'priest', gx, gy, fsm: 'ocioso', fsmData: {}, condicao: 100000 });
  const soldado = (id: string, gx: number, gy: number, lado: number): Unidade =>
    ({ id, lado, tipo: 'militia', gx, gy, fsm: 'ocioso', fsmData: {}, condicao: 100000 });
  const com = (...us: Unidade[]): GameState => {
    const s = createInitialState(1);
    return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } };
  };

  it('(1) anda com MoveUnits', () => {
    let s = step(com(padre(50, 50)), [{ type: 'MoveUnits', unidades: ['p50'], destino: { gx: 55, gy: 50 } }]);
    for (let i = 0; i < 200; i++) s = step(s, []);
    expect(s.unidades.porId['p50']).toMatchObject({ gx: 55, gy: 50 });
  });

  it('(2) com um inimigo encostado, o padre nao golpeia; e nao e mandado atacar', () => {
    let s = com(padre(60, 60), soldado('inimigo', 61, 60, LADO_DA_IA));
    s = { ...s, ia: { ...s.ia, [String(LADO_DA_IA)]: { posicoes: [] } } };
    const golpes: string[] = [];
    for (let i = 0; i < 100; i++) {
      s = step(s, []);
      for (const e of s.events) if (e.type === 'unit-struck') golpes.push(e.atacante);
    }
    expect(golpes).not.toContain('p60');
    const ordem = step(com(padre(60, 60), soldado('inimigo', 63, 60, LADO_DA_IA)), [{ type: 'AttackUnit', unidades: ['p60'], alvo: 'inimigo' }]);
    expect(recusas(ordem).map((r) => r.motivo)).toEqual(['unidade-nao-luta']);
  });
});
