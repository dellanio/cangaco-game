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

type Linha = { readonly importancia: number | null; readonly id?: string };
const real = gameData.entrega.prioridades as ReadonlyArray<Linha>;

describe('F09 — delivery.json: cada linha tem id; D-TRANSPORTE-03 T1: classes de importancia', () => {
  // D-TRANSPORTE-03 T1 (2026-09-30): a escada estrita virou as classes de importancia do KaM
  // (KM_HandLogistics.pas:28-35). Classe repetida e o normal: dentro dela decide o caminho.
  // Sao as mesmas 12 linhas; as duas do laborer tem importancia null (so o `modo`).
  it('o dado real passa e cada uma das 12 linhas tem id', () => {
    expect(validarTudo(dadosReaisComEscada(real))).toEqual([]);
    expect(real).toHaveLength(12);
    for (const linha of real) expect(typeof linha.id).toBe('string');
  });

  it('id repetido reprova', () => {
    const repetida = real.map((l, i) => (i === 1 ? { ...l, id: real[0]?.id } : l));
    expect(errosDaEscada(repetida)).toHaveLength(1);
    expect(errosDaEscada(repetida)[0]).toContain('id');
  });

  it('importancia repetida PASSA: e a classe, e dentro dela decide o caminho', () => {
    expect(errosDaEscada(real.map((l) => (l.importancia === null ? l : { ...l, importancia: 1 })))).toEqual([]);
  });

  it('classe vazia no meio (1,2,4...) reprova', () => {
    const comBuraco = real.map((l) => (l.importancia !== null && l.importancia >= 3 ? { ...l, importancia: l.importancia + 1 } : l));
    expect(errosDaEscada(comBuraco).length).toBeGreaterThan(0);
  });

  it('importancia nao inteira, zero ou ausente reprova; null passa', () => {
    expect(errosDaEscada(real.map((l) => (l.id === 'arma-para-quartel' ? { ...l, importancia: 1.5 } : l))).length).toBeGreaterThan(0);
    expect(errosDaEscada(real.map((l) => (l.id === 'arma-para-quartel' ? { ...l, importancia: 0 } : l))).length).toBeGreaterThan(0);
    const { importancia: _fora, ...semImportancia } = real[0] as Linha;
    void _fora;
    expect(errosDaEscada([semImportancia, ...real.slice(1)]).length).toBeGreaterThan(0);
  });

  it('linha sem id, ou com id vazio, reprova', () => {
    const { id: _removido, ...semId } = real[0] as Linha;
    void _removido;
    expect(errosDaEscada([semId, ...real.slice(1)])).toHaveLength(1);
    expect(errosDaEscada(real.map((l, i) => (i === 0 ? { ...l, id: '' } : l)))).toHaveLength(1);
  });
});
