/**
 * I-COMIDA-REFEICAO-COM-TEMPO — a refeicao na Bodega dura `N x ticksComendoPorComida`, como no KaM
 * (`src/units/tasks/KM_UnitTaskGoEat.pas:139`, `SetActionLockedStay(29*4, uaEat)` por comida). Aceite no BUILD_PLAN.md.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { unidadesInvisiveis } from '../src/render/visibilidade';
import { bodegaDoCenario } from './helpers/bodega-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { avancarAte, cenarioDaVilaComBodegaCheia, comCondicao, comidasDaAbertura, unidadeDo } from './helpers/fome-cenario';

const LIMIARES_CIVIS = gameData.condicao.ticksNoLimiar.civil;

describe('I-COMIDA-REFEICAO-COM-TEMPO', () => {
  it('(1) o carregador converte o tempo por comida uma vez, na escala da condicao', () => {
    const raw = JSON.parse(readFileSync('data/condition.json', 'utf8')) as { escala: string; inn: { segundosComendoPorComida_base: number } };
    const tempo = JSON.parse(readFileSync('data/time.json', 'utf8')) as { tickHz: number; escalas: Record<string, number> };
    const escala = tempo.escalas[raw.escala] ?? Number.NaN;
    expect(raw.inn.segundosComendoPorComida_base).toBe(11.6);
    expect(gameData.condicao.ticksComendoPorComida).toBe(Math.round((raw.inn.segundosComendoPorComida_base / escala) * tempo.tickHz));
  });

  it('(2)(3) pelo step: come N comidas, fica comendo N x ticksComendoPorComida parado e sem tarefa, e volta a ocioso', () => {
    const { estado } = cenarioDaVilaComBodegaCheia();
    const partida = comCondicao(estado, { u3: LIMIARES_CIVIS.civilVaiComer });
    const antes = bodegaDoCenario(partida).estoque.entrada;
    const chegou = avancarAte(partida, (e) => unidadeDo(e, 'u3').fsm === 'comendo', 200, 'u3 comer');
    const depoisDaChegada = bodegaDoCenario(chegou.estado).estoque.entrada;
    const comidas = comidasDaAbertura().filter((c) => (depoisDaChegada[c] ?? 0) < (antes[c] ?? 0)).length;
    expect(comidas).toBeGreaterThan(0);
    const esperado = comidas * gameData.condicao.ticksComendoPorComida;

    const onde = unidadeDo(chegou.estado, 'u3');
    let s = chegou.estado;
    let ticksComendo = 1;
    for (let t = 0; t < esperado + 5; t++) {
      s = step(s, []);
      const u = unidadeDo(s, 'u3');
      if (u.fsm !== 'comendo') break;
      ticksComendo += 1;
      // parado, sem tarefa, invisivel (dentro da Bodega)
      expect({ gx: u.gx, gy: u.gy }).toEqual({ gx: onde.gx, gy: onde.gy });
      expect(u.fsmData.tarefa).toBeUndefined();
      expect(unidadeDo(s, 'u3').fsm === 'comendo' && unidadeidInvisivel(s, 'u3')).toBe(true);
      expect(violacoesDeInvariantes(s)).toEqual([]);
    }
    gravarEvidencia('I-COMIDA-REFEICAO-COM-TEMPO', { comidas, ticksComendoPorComida: gameData.condicao.ticksComendoPorComida, esperado, ticksComendo });
    expect(ticksComendo).toBe(esperado);
    expect(unidadeDo(s, 'u3').fsm).not.toBe('comendo');
  });
});

function unidadeidInvisivel(s: Parameters<typeof unidadesInvisiveis>[0], id: string): boolean {
  return unidadesInvisiveis(s).has(id);
}
