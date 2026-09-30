/**
 * F-VIVO-g — o curral guarda o ultimo quadro enquanto ocupado (BUILD_PLAN.md "Aceite da
 * F-VIVO-g", docs/planos/2026-09-30-F-VIVO-e-em-diante.md).
 *
 * `animaisDoCurral` esvazia o curral quando a gaveta de entrada seca e o ciclo volta ao
 * zero: entre duas entregas de milho a Malhada ocupada piscava vazia. `curralDesenhado`
 * guarda o ultimo curral cheio enquanto o predio estiver ocupado. A memoria e de tela (um
 * `Map` da cena), nao entra no save: aqui ela e a variavel `anterior` do laco.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { salvar } from '../src/sim/save';
import { dadosDosAnimais } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { animaisDoCurral, curralDesenhado } from '../src/render/animais';
import type { AnimalDoCurral, DadosDosAnimais } from '../src/render/animais';
import { cenarioDaCadeiaDaCarne } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados: DadosDosAnimais = dadosDosAnimais(semArte);
const evidencia: Record<string, unknown> = {};

function completoDe(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}

describe('F-VIVO-g — o curral guarda', () => {
  const cheio = animaisDoCurral({ ...completoDe(cenarioDaCadeiaDaCarne(), 'sf1'), estoque: { entrada: { corn: 1 }, saida: {} } } as PredioCompleto, dados);

  it('aceite 1: vazio e ocupado guarda o anterior; cheio mostra o atual; desocupado esvazia', () => {
    expect(cheio.length).toBeGreaterThan(0);
    const outro: AnimalDoCurral[] = cheio.map((a) => ({ ...a, idade: a.idade === 3 ? 1 : ((a.idade + 1) as 1 | 2 | 3) }));
    expect(curralDesenhado(cheio, [], true)).toEqual(cheio);
    expect(curralDesenhado(cheio, outro, true)).toEqual(outro);
    expect(curralDesenhado(cheio, outro, false)).toEqual([]);
    expect(curralDesenhado(cheio, [], false)).toEqual([]);
    expect(curralDesenhado([], [], true)).toEqual([]);
  });

  it('aceite 2: na cadeia da carne, pelo step, o curral vazio com a Malhada ocupada cai a 0 depois da primeira entrega', () => {
    const TICKS = 20_000;
    let s = cenarioDaCadeiaDaCarne();
    let anterior: readonly AnimalDoCurral[] = [];
    let primeiraEntrega: number | null = null;
    let vazioOcupadoAntes = 0; // so `animaisDoCurral`, depois da primeira entrega
    let vazioOcupadoDepois = 0; // com `curralDesenhado`, depois da primeira entrega
    // a janela do roteiro: o primeiro tick, depois da primeira entrega, em que o curral
    // atual esvazia com a Malhada ocupada, e o tick em que ele volta a encher
    let esvazia: number | null = null;
    let reenche: number | null = null;
    let partida: GameState | null = null;
    const historico: GameState[] = [];
    for (let i = 0; i < TICKS; i += 1) {
      s = step(s, [], gameData);
      const p = completoDe(s, 'sf1');
      const ocupado = p.ocupante !== null;
      const atual = animaisDoCurral(p, dados);
      const desenhado = curralDesenhado(anterior, atual, ocupado);
      anterior = desenhado;
      if (primeiraEntrega === null && atual.length > 0) primeiraEntrega = s.tick;
      historico.push(s);
      if (historico.length > 40) historico.shift();
      if (primeiraEntrega === null || !ocupado) continue;
      if (atual.length === 0) {
        vazioOcupadoAntes += 1;
        if (esvazia === null) { esvazia = s.tick; partida = historico[0] ?? null; }
      } else if (esvazia !== null && reenche === null) {
        reenche = s.tick;
      }
      if (desenhado.length === 0) vazioOcupadoDepois += 1;
    }
    evidencia['aceite2'] = { ticks: TICKS, primeiraEntrega, antes: vazioOcupadoAntes, depois: vazioOcupadoDepois, esvazia, reenche };
    gravarEvidencia('F-VIVO-g', evidencia);
    expect(primeiraEntrega).not.toBeNull();
    // guarda do cenario: o curral atual esvazia de fato entre entregas, com a Malhada ocupada
    expect(vazioOcupadoAntes).toBeGreaterThan(0);
    expect(esvazia).not.toBeNull();
    expect(reenche).not.toBeNull();
    expect(vazioOcupadoDepois).toBe(0);
    // a partida do roteiro: 40 ticks antes de o curral atual esvaziar
    if (partida === null || esvazia === null || reenche === null) throw new Error('fixture: sem janela');
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-VIVO-g.save.txt`, salvar(partida));
    const sf1 = completoDe(partida, 'sf1');
    writeFileSync(`${dir}/F-VIVO-g.partida.json`, JSON.stringify({
      tick: partida.tick, predio: 'sf1', esvazia, reenche, centro: { gx: sf1.gx + 1.5, gy: sf1.gy + 1 },
    }, null, 2));
  });
});
