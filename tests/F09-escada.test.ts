import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { gameData } from '../src/sim/data';

/** Dados reais, com a escada de `delivery.json` trocada por `escada`. */
function dadosReaisComEscada(escada: unknown): Record<string, unknown> {
  const dados: Record<string, unknown> = {};
  for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
  (dados.delivery as { prioridades: unknown }).prioridades = escada;
  return dados;
}

const errosDaEscada = (escada: unknown): string[] =>
  validarTudo(dadosReaisComEscada(escada)).filter((e) => e.startsWith('entrega/escada'));

const real = gameData.entrega.prioridades as ReadonlyArray<{ readonly nivel: number; readonly id?: string }>;

describe('F09 — delivery.json: a escada de prioridade tem id por nivel', () => {
  it('o dado real passa e cada um dos 7 niveis tem id', () => {
    expect(validarTudo(dadosReaisComEscada(real))).toEqual([]);
    expect(real).toHaveLength(7);
    for (const linha of real) expect(typeof linha.id).toBe('string');
  });

  it('id repetido reprova', () => {
    const repetida = real.map((l, i) => (i === 1 ? { ...l, id: real[0]?.id } : l));
    expect(errosDaEscada(repetida)).toHaveLength(1);
    expect(errosDaEscada(repetida)[0]).toContain('id');
  });

  it('nivel repetido reprova', () => {
    const repetida = real.map((l, i) => (i === 1 ? { ...l, nivel: real[0]?.nivel } : l));
    expect(errosDaEscada(repetida).length).toBeGreaterThan(0);
  });

  it('buraco na sequencia de niveis (1,2,4...) reprova', () => {
    const comBuraco = real.map((l, i) => (i >= 2 ? { ...l, nivel: l.nivel + 1 } : l));
    expect(errosDaEscada(comBuraco).length).toBeGreaterThan(0);
  });

  it('linha sem id, ou com id vazio, reprova', () => {
    const { id: _removido, ...semId } = real[0] as { nivel: number; id?: string };
    void _removido;
    expect(errosDaEscada([semId, ...real.slice(1)])).toHaveLength(1);
    expect(errosDaEscada(real.map((l, i) => (i === 0 ? { ...l, id: '' } : l)))).toHaveLength(1);
  });
});
