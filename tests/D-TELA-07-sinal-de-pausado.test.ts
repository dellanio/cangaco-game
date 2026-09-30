/**
 * D-TELA-07 — o sinal de pausado no mapa (BUILD_PLAN.md, "D-TELA-07").
 *
 * Aceite 1: a regra e a geometria, puras. Aceite 2: pelo `step`, a serraria pausada e a
 * serraria sem insumo mostram o MESMO ocioso (a ambiguidade que o pedido aponta) e so a
 * pausada tem sinal. O aceite 2 grava a partida do roteiro `tools/shots/D-TELA-07.js`.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { salvar } from '../src/sim/save';
import { dadosDoTrabalho } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { quadroDeTrabalho, quadroOcioso } from '../src/render/trabalho';
import { caixaDoSinalDePausado, temSinalDePausado, TEXTO_DO_SINAL_DE_PAUSADO } from '../src/render/sinal-de-pausado';
import { cenarioDeSerraria, comEntrada, comProdutorOcupado } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados = dadosDoTrabalho(semArte);
const TILE_PX = (JSON.parse(readFileSync('data/terrain.json', 'utf8')) as { tile_px: number }).tile_px;
const evidencia: Record<string, unknown> = {};

function completoDe(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}
const ocupanteDe = (s: GameState, p: PredioCompleto): Unidade | null =>
  p.ocupante === null ? null : s.unidades.porId[p.ocupante] ?? null;
const fsmDoOcupante = (s: GameState, id: string): string | undefined => ocupanteDe(s, completoDe(s, id))?.fsm;
const ociosoAceso = (s: GameState, id: string): boolean => {
  const p = completoDe(s, id);
  return quadroOcioso(p, ocupanteDe(s, p), s.tick, dados) !== null;
};

function ateQue(estado: GameState, ate: (s: GameState) => boolean, max: number): GameState {
  let s = estado;
  for (let i = 0; i < max; i += 1) {
    if (ate(s)) return s;
    s = step(s, [], gameData);
  }
  throw new Error(`fixture: a condicao nao veio em ${max} ticks`);
}

describe('D-TELA-07 aceite 1 — a regra e a geometria', () => {
  it('so o predio completo e pausado tem sinal', () => {
    const s1 = completoDe(cenarioDeSerraria(), 's1');
    const tabela = [
      { caso: 'completo, pausado', predio: { ...s1, pausado: true }, sinal: true },
      { caso: 'completo, nao pausado', predio: { ...s1, pausado: false }, sinal: false },
      {
        caso: 'obra',
        predio: { lado: s1.lado, id: 'o1', tipo: s1.tipo, gx: s1.gx, gy: s1.gy, estado: 'obra' as const, hp: 1, obra: { faltam: {}, nivelamento: 0 } },
        sinal: false,
      },
    ];
    for (const linha of tabela) expect(temSinalDePausado(linha.predio), linha.caso).toBe(linha.sinal);
    evidencia['aceite1'] = tabela.map((l) => ({ caso: l.caso, sinal: l.sinal }));
  });

  it('o texto e o do tema, a palavra do botao de pausar do painel (decisao do operador)', () => {
    const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { painelPredio: { pausar: string } };
    expect(TEXTO_DO_SINAL_DE_PAUSADO).toBe(tema.painelPredio.pausar);
    // a igualdade com o botao do painel e afirmada no roteiro, lida da pagina
  });

  it('a placa fica dentro da largura do corpo e na metade de cima', () => {
    for (const corpo of [
      { x: 0, y: 0, w: 4 * TILE_PX, h: 2 * TILE_PX },
      { x: -10, y: -40, w: 2 * TILE_PX, h: 3 * TILE_PX },
      { x: 0, y: 0, w: TILE_PX, h: TILE_PX },
    ]) {
      const c = caixaDoSinalDePausado(corpo, TILE_PX);
      expect(c.x).toBeGreaterThanOrEqual(corpo.x);
      expect(c.x + c.w).toBeLessThanOrEqual(corpo.x + corpo.w);
      expect(c.y).toBeGreaterThanOrEqual(corpo.y);
      expect(c.y + c.h).toBeLessThanOrEqual(corpo.y + corpo.h / 2);
    }
  });
});

describe('D-TELA-07 aceite 2 — pausada e sem insumo, lado a lado, pelo step', () => {
  it('as duas mostram o ocioso; so a pausada tem sinal', () => {
    const base = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 5 });
    const s1 = completoDe(base, 's1');
    // a segunda serraria onde o jogador poderia po-la, a leste da s1 (relativa: o mundo
    // transladado anda junto)
    // `canPlace` confere o LUGAR; o desbloqueio (a serraria pede o lenhador) vem marcado so
    // para a conferencia, como no teste do T2
    const desbloqueado: GameState = { ...base, tiposJaConstruidos: [...new Set([...base.tiposJaConstruidos, ...gameData.predios.map((p) => p.id)])] };
    const OUTRA = [5, 6, -5, -6].map((dx) => ({ gx: s1.gx + dx, gy: s1.gy })).find((t) => canPlace(desbloqueado, 'sawmill', t.gx, t.gy).ok);
    if (OUTRA === undefined) throw new Error('fixture: nenhum lugar livre para a s2');
    let s = comProdutorOcupado(base, { tipo: 'sawmill', id: 's2', unidade: 'u9', ...OUTRA }, gameData);
    // a s1 trabalhando antes de pausar; a s2 nasceu sem tora e cai em esperando_insumo
    s = ateQue(s, (e) => {
      const p = completoDe(e, 's1');
      return (p.producao?.progresso ?? 0) > 0 && quadroDeTrabalho(p, ocupanteDe(e, p), e.tick, dados) !== null
        && fsmDoOcupante(e, 's2') === 'esperando_insumo';
    }, 5_000);
    s = step(s, [{ type: 'SetBuildingPaused', predio: 's1', pausado: true }], gameData);
    s = step(s, [], gameData);
    expect(completoDe(s, 's1').pausado).toBe(true);
    expect(fsmDoOcupante(s, 's2')).toBe('esperando_insumo');

    const linhas: Array<{ tick: number; ocioso1: boolean; ocioso2: boolean; sinal1: boolean; sinal2: boolean }> = [];
    for (let i = 0; i < 30; i += 1) {
      const linha = {
        tick: s.tick,
        ocioso1: ociosoAceso(s, 's1'), ocioso2: ociosoAceso(s, 's2'),
        sinal1: temSinalDePausado(completoDe(s, 's1')), sinal2: temSinalDePausado(completoDe(s, 's2')),
      };
      linhas.push(linha);
      // guarda do cenario: a ambiguidade existe — o mesmo ocioso nas duas
      expect(linha, `tick ${s.tick}`).toEqual({ tick: s.tick, ocioso1: true, ocioso2: true, sinal1: true, sinal2: false });
      s = step(s, [], gameData);
    }

    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/D-TELA-07.save.txt`, salvar(s));
    const p1 = completoDe(s, 's1');
    const p2 = completoDe(s, 's2');
    const partida = {
      tick: s.tick, pausado: 's1', semInsumo: 's2', texto: TEXTO_DO_SINAL_DE_PAUSADO,
      meioDaPausada: { gx: p1.gx + 2, gy: p1.gy + 1 },
      meioDaSemInsumo: { gx: p2.gx + 2, gy: p2.gy + 1 },
      centro: { gx: (Math.min(p1.gx, p2.gx) + Math.max(p1.gx, p2.gx) + 4) / 2, gy: p1.gy + 1 },
    };
    writeFileSync(`${dir}/D-TELA-07.partida.json`, JSON.stringify(partida, null, 2));
    evidencia['aceite2'] = { partida, ticksMedidos: linhas.length, primeira: linhas[0], ultima: linhas[linhas.length - 1] };
    gravarEvidencia('D-TELA-07', evidencia);
  });
});
