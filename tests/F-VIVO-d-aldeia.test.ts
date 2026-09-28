/**
 * F-VIVO-d1 — as partidas que o roteiro `tools/shots/F-VIVO-d.js` carrega para medir
 * cada camada a 0,75 (BUILD_PLAN.md "Aceite da F-VIVO-d", quebra d1/d2).
 *
 * Os cinco casos nao cabem num quadro do mapa real (docs/planos/2026-09-28-6-F-VIVO-d.md):
 * cada um mora na cadeia que ja existe, com o recurso no lugar dele. O teste anda cada
 * fixture ate o caso-alvo estar ativo PELAS FUNCOES DO RENDER (quadro de trabalho,
 * pilha, curral) e grava o save naquele tick. O teste prova que o instante existe; o
 * roteiro mede o px.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GameState, Predio } from '../src/sim/state';
import { salvar } from '../src/sim/save';
import type { Manifesto } from '../src/render/manifesto';
import { dadosDasPilhas, dadosDosAnimais, dadosDoTrabalho } from '../src/render/predios';
import { quadroDeTrabalho } from '../src/render/trabalho';
import { pilhasDoPredio } from '../src/render/pilhas';
import { animaisDoCurral } from '../src/render/animais';
import { CASO_DO_PREDIO } from '../src/render/manifesto-camadas';
import {
  avancar, cenarioDaCadeiaDaCarne, cenarioDaCadeiaDoOuro, cenarioDePedreira,
} from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const trabalho = dadosDoTrabalho(semArte);
const pilhas = dadosDasPilhas(semArte);
const animais = dadosDosAnimais(semArte);

/** O caso do predio esta ATIVO: a camada que o distingue foi desenhada. */
function ativo(s: GameState, id: string): boolean {
  const p: Predio | undefined = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') return false;
  const caso = CASO_DO_PREDIO[p.tipo];
  if (caso === 'guarda') return pilhasDoPredio(p, pilhas).length > 0;
  if (caso === 'criacao') return animaisDoCurral(p, animais).length > 0;
  const ocupante = p.ocupante === null ? null : s.unidades.porId[p.ocupante] ?? null;
  return quadroDeTrabalho(p, ocupante, s.tick, trabalho) !== null;
}

interface Cadeia {
  readonly nome: string;
  readonly cenario: () => GameState;
  readonly alvos: readonly string[];
}

/** Os ids saem das fixtures (`tests/helpers/producao-cenario.ts`). */
const CADEIAS: readonly Cadeia[] = [
  { nome: 'carne', cenario: () => cenarioDaCadeiaDaCarne(), alvos: ['f1', 'sf1', 'bu1'] },
  { nome: 'ouro', cenario: () => cenarioDaCadeiaDoOuro(), alvos: ['go1', 'co1', 'me1'] },
  { nome: 'pedreira', cenario: () => cenarioDePedreira(), alvos: ['q1'] },
];

const PASSO = 5;
const TETO = 30000;

describe('F-VIVO-d1 — as partidas medidas a 0,75', () => {
  it('cada cadeia alcanca o instante com todos os alvos ativos, e o save e gravado', () => {
    const evidencia: Record<string, unknown> = {};
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    for (const c of CADEIAS) {
      let s = c.cenario();
      const casos = c.alvos.map((id) => {
        const p = s.predios.porId[id];
        return p === undefined ? undefined : CASO_DO_PREDIO[p.tipo];
      });
      expect(casos.every((x) => x !== undefined), `${c.nome}: todo alvo tem caso`).toBe(true);
      // do-while: a fixture nasce com o ocupante em `trabalhando` no tick 0, rotulo
      // que a sim ainda nao deu; o instante medido tem de ser um que ela produziu.
      do s = avancar(s, PASSO); while (!c.alvos.every((id) => ativo(s, id)) && s.tick < TETO);
      expect(c.alvos.filter((id) => !ativo(s, id)), `${c.nome} no tick ${s.tick}`).toEqual([]);
      writeFileSync(`${dir}/F-VIVO-d-${c.nome}.save.txt`, salvar(s));
      evidencia[c.nome] = { tick: s.tick, alvos: c.alvos, casos };
    }
    // os cinco casos aparecem somando as tres cadeias
    const todos = new Set(Object.values(evidencia).flatMap((e) => (e as { casos: string[] }).casos));
    expect([...todos].sort()).toEqual(['criacao', 'dentro', 'guarda', 'luz', 'transforma']);
    gravarEvidencia('F-VIVO-d-saves', evidencia);
  });
});
