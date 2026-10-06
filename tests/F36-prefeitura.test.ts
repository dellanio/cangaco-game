/**
 * F36 — a Prefeitura (BUILD_PLAN F36; plano em docs/planos/2026-09-28-A18-F36-prefeitura.md).
 * Alvo de ouro = o maior `custoOuro` do dado (8, decisao do operador). Aceites do item:
 *  (a) com ouro na gaveta, `HireMercenary` debita exatamente o `custoOuro` e a unidade
 *      existe no tick do comando, junto a porta;
 *  (b) sem ouro, recusa com motivo e o estado fica igual byte a byte;
 *  (c) com ouro para um so, dois comandos no mesmo tick: o primeiro passa, o segundo nao;
 *  (d) nenhum recruta, arma ou escola muda de estado na contratacao;
 *  (e) e a tela (roteiro tools/shots/F36.js).
 * E mais, da sessao autonoma (PARA REVISAO): o ouro chega pela escada ate 8 e para; o
 * mercenario e militar (recebe MoveUnits).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { classeDaUnidade } from '../src/sim/condicao';
import { hpDaUnidade, hpMaximoDoTipo } from '../src/sim/vida';
import { alvoDeOuroDaPrefeitura } from '../src/sim/prefeitura';
import { populacaoPorGrupo } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

// I-PREDIO-IGREJA (2026-10-06): o padre e pago em ouro mas contratado na Igreja; a Prefeitura e o resto
const MERCENARIOS = gameData.unidades.mercenarios.tipos.filter((t) => !('predioQueTreina' in t));
const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
const prefeituraDe = (s: GameState): PredioCompleto => s.predios.porId['prefeitura'] as PredioCompleto;
const ouro = (s: GameState): number => prefeituraDe(s).estoque.entrada['gold'] ?? 0;
const contratar = (tipo: string, predio = 'prefeitura'): Command => ({ type: 'HireMercenary', predio, tipo });

/** A vila da abertura mais uma Prefeitura COMPLETA com `ouro` na gaveta; `comRua` a liga
 *  ao armazem pela rua que o A* traca e poe `ouroNoArmazem` la. */
function vilaComPrefeitura(ouroNaGaveta: number, comRua = false, ouroNoArmazem = 0): GameState {
  let s = createInitialState(1);
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'metallurgists'])] };
  let lugar: { gx: number; gy: number } | null = null;
  for (let r = 4; r < 30 && lugar === null; r += 1) {
    for (let d = -r; d <= r && lugar === null; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, 'town_hall', p.gx, p.gy, gameData).ok) lugar = p;
    }
  }
  if (lugar === null) throw new Error('fixture: a prefeitura nao coube');
  const obra = completarObra({ lado: LADO_DO_JOGADOR, id: 'prefeitura', tipo: 'town_hall', ...lugar, estado: 'obra', hp: 550, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  const prefeitura: PredioCompleto = { ...obra, estoque: { ...obra.estoque, entrada: { gold: ouroNaGaveta } } };
  s = { ...s, predios: { porId: { ...s.predios.porId, prefeitura }, ordem: [...s.predios.ordem, 'prefeitura'] } };
  if (comRua) {
    const armazem = armazemDe(s);
    const porta = tilesDaPorta(prefeitura, gameData)[0] as { gx: number; gy: number };
    const rua = buscarCaminho(s, porta, tilesDaPorta(armazem, gameData), 'livre', gameData);
    if (rua === null) throw new Error('fixture: sem rua');
    s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...rua.tiles].map((t) => [chaveDeTile(t), true as const])) } };
    if (!predioLigadoAoArmazem(s, prefeitura, gameData)) throw new Error('fixture: prefeitura nao ligada');
    const comOuro: PredioCompleto = { ...armazem, estoque: { ...armazem.estoque, saida: { ...armazem.estoque.saida, gold: ouroNoArmazem } } };
    s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [armazem.id]: comOuro } } };
  }
  return s;
}

describe('F36 — a Prefeitura', () => {
  it('o dado: cinco mercenarios a 2/3/5/7/8, e o alvo e o maior (8)', () => {
    expect(MERCENARIOS.map((t) => t.custoOuro)).toEqual([2, 3, 5, 7, 8]);
    expect(alvoDeOuroDaPrefeitura(gameData)).toBe(8);
  });

  it('(a) cada tipo debita exatamente o custo, e a unidade nasce no tick, colada a porta', () => {
    for (const t of MERCENARIOS) {
      const s0 = vilaComPrefeitura(8);
      const s = step(s0, [contratar(t.id)], gameData);
      expect(ouro(s), t.id).toBe(8 - t.custoOuro);
      const ev = s.events.find((e) => e.type === 'unit-trained');
      expect(ev, t.id).toMatchObject({ predio: 'prefeitura', tipo: t.id });
      const u = s.unidades.porId[(ev as { unidade: string }).unidade];
      expect(u?.tipo).toBe(t.id);
      expect(u?.lado).toBe(LADO_DO_JOGADOR);
      const portas = tilesDaPorta(prefeituraDe(s), gameData);
      const colado = portas.some((p) => Math.max(Math.abs(p.gx - (u?.gx ?? -99)), Math.abs(p.gy - (u?.gy ?? -99))) <= 1);
      expect(colado, `${t.id} nasceu longe da porta`).toBe(true);
      expect(hpDaUnidade(u as NonNullable<typeof u>, gameData)).toBe(hpMaximoDoTipo(t.id, gameData));
    }
  });

  it('(b) recusas com motivo, e o estado fica igual byte a byte', () => {
    const s0 = vilaComPrefeitura(1);
    const casos: [Command, string][] = [
      [contratar('rebel'), 'sem-ouro'],
      [contratar('militia'), 'tipo-desconhecido'], // soldado do quartel nao e mercenario
      [contratar('rebel', armazemDe(s0).id), 'predio-nao-e-prefeitura'],
    ];
    const semNada = salvar({ ...step(s0, [], gameData), events: [] });
    for (const [cmd, motivo] of casos) {
      const r = step(s0, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'HireMercenary', motivo });
      expect(salvar({ ...r, events: [] }), motivo).toBe(semNada);
    }
  });

  it('(c) ouro para um so: dois comandos no mesmo tick, o primeiro passa e o segundo nao', () => {
    const s = step(vilaComPrefeitura(2), [contratar('rebel'), contratar('rebel')], gameData);
    expect(s.events.filter((e) => e.type === 'unit-trained')).toHaveLength(1);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([
      { type: 'command-rejected', command: 'HireMercenary', predio: 'prefeitura', tipo: 'rebel', motivo: 'sem-ouro' },
    ]);
    expect(ouro(s)).toBe(0);
  });

  it('(d) nenhum outro predio nem unidade muda na contratacao', () => {
    const s0 = vilaComPrefeitura(8);
    const com = step(s0, [contratar('warrior')], gameData);
    const sem = step(s0, [], gameData);
    for (const id of sem.predios.ordem.filter((i) => i !== 'prefeitura')) {
      expect(com.predios.porId[id], id).toEqual(sem.predios.porId[id]);
    }
    for (const id of sem.unidades.ordem) expect(com.unidades.porId[id], id).toEqual(sem.unidades.porId[id]);
    expect(com.unidades.ordem.length).toBe(sem.unidades.ordem.length + 1);
  });

  it('o ouro chega pela escada ate 8 e para; o resto fica no armazem', () => {
    let s = vilaComPrefeitura(0, true, 20);
    const violacoes: string[] = [];
    for (let t = 0; t < 3000 && ouro(s) < 8; t += 1) {
      s = step(s, [], gameData);
      violacoes.push(...violacoesDeInvariantes(s, gameData));
    }
    for (let t = 0; t < 300; t += 1) s = step(s, [], gameData);
    expect(violacoes).toEqual([]);
    expect(ouro(s)).toBe(8);
    expect(armazemDe(s).estoque.saida['gold']).toBe(12);
    // contratar reabre a demanda: o ouro volta a 8
    s = step(s, [contratar('barbarian')], gameData);
    expect(ouro(s)).toBe(1);
    for (let t = 0; t < 3000 && ouro(s) < 8; t += 1) s = step(s, [], gameData);
    expect(ouro(s)).toBe(8);
    expect(armazemDe(s).estoque.saida['gold']).toBe(5);
    gravarEvidencia('F36-ouro', { alvo: 8, noArmazem: armazemDe(s).estoque.saida['gold'], tick: s.tick });
  });

  it('o mercenario e militar: conta como tropa e recebe MoveUnits', () => {
    let s = step(vilaComPrefeitura(8), [contratar('rebel')], gameData);
    const id = (s.events.find((e) => e.type === 'unit-trained') as { unidade: string }).unidade;
    expect(classeDaUnidade('rebel', gameData)).toBe('militar');
    expect(populacaoPorGrupo(s, gameData).militar).toBe(1);
    const u = s.unidades.porId[id] as NonNullable<(typeof s.unidades.porId)[string]>;
    s = step(s, [{ type: 'MoveUnits', unidades: [id], destino: { gx: u.gx, gy: u.gy + 2 } }], gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('a mesma corrida duas vezes da o mesmo estado; e grava a partida do roteiro', () => {
    const correr = (): GameState => {
      let s = step(vilaComPrefeitura(0, true, 20), [], gameData);
      for (let t = 0; t < 400; t += 1) s = step(s, t === 200 ? [contratar('rogue')] : [], gameData);
      return s;
    };
    expect(salvar(correr())).toBe(salvar(correr()));
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    // sem rua: o ouro nao se repoe, e o roteiro ve a gaveta cair
    writeFileSync(`${dir}/F36.save.txt`, salvar(vilaComPrefeitura(5)));
  });
});
