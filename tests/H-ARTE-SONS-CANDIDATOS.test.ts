/**
 * H-ARTE-SONS-CANDIDATOS — a lista de sons para o operador aprovar (`docs/sons-candidatos.md`).
 *
 * Aceite: (a) todo id da tabela de eventos da H-TELA-CAMADA-DE-SOM tem pelo menos um candidato
 * (a tabela e o `data/som.json`); (b) todo candidato
 * tem licenca CC0 e o link de um banco livre. A licenca foi conferida na pagina pela sessao
 * (2026-10-03); o teste guarda que a lista nao aceita outra licenca nem candidato sem link.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gravarEvidencia } from './helpers/evidence';
import { lerSonsCandidatos, escolhaDoOperador } from '../tools/sons-candidatos.js';

const MD = readFileSync('docs/sons-candidatos.md', 'utf8');
const BANCOS = ['https://freesound.org/people/', 'https://opengameart.org/content/'];

describe('H-ARTE-SONS-CANDIDATOS — a lista', () => {
  const linhas = lerSonsCandidatos(MD);

  it('le uma linha por som, sem id repetido', () => {
    expect(linhas.length).toBeGreaterThan(0);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(linhas.length);
  });

  it('(b) todo candidato e CC0, com link de banco livre; de 1 a 3 por som', () => {
    for (const l of linhas) {
      expect(l.candidatos.length, l.id).toBeGreaterThanOrEqual(1);
      expect(l.candidatos.length, l.id).toBeLessThanOrEqual(3);
      for (const c of l.candidatos) {
        expect(c.valido, `${l.id}: ${c.texto}`).toBe(true);
        expect(c.licenca, `${l.id}: ${c.texto}`).toBe('CC0');
        expect(BANCOS.some((b) => (c.url ?? '').startsWith(b)), `${l.id}: ${c.url}`).toBe(true);
      }
      expect(l.candidatos.map((c) => c.numero)).toEqual(l.candidatos.map((_, i) => i + 1));
    }
  });

  it('o leitor acusa: licenca que nao e CC0, candidato sem link, e a escolha fora da lista', () => {
    const md = [
      '| id | toca quando | candidatos | aprovado |',
      '|---|---|---|---|',
      '| `a` | x | 1. [t — a](https://freesound.org/people/a/sounds/1/) · CC-BY 4.0 · 1 s | 2 |',
      '| `b` | x | 1. t sem link · CC0 | nenhum |',
      '| `c` | x | 1. [t — a](https://freesound.org/people/a/sounds/1/) · CC0 | 1 |',
    ].join('\n');
    const [a, b, c] = lerSonsCandidatos(md);
    expect(a?.candidatos[0]?.licenca).toBe('CC-BY 4.0');
    expect(b?.candidatos[0]?.valido).toBe(false);
    expect(escolhaDoOperador(a!)).toBe('invalido');
    expect(escolhaDoOperador(b!)).toBe('nenhum');
    expect((escolhaDoOperador(c!) as { numero: number }).numero).toBe(1);
  });

  it('(a) todo id do data/som.json tem linha com candidato', () => {
    // A tabela de eventos e o data/som.json (H-TELA-CAMADA-DE-SOM): todo id dele tem linha aqui.
    const ids = new Set(linhas.map((l) => l.id));
    const som = JSON.parse(readFileSync('data/som.json', 'utf8')) as { sons: Record<string, unknown> };
    expect(Object.keys(som.sons).length).toBeGreaterThan(0);
    const faltam = Object.keys(som.sons).filter((id) => !id.startsWith('_') && !ids.has(id));
    expect(faltam).toEqual([]);
    gravarEvidencia('H-ARTE-SONS-CANDIDATOS', {
      sons: linhas.length,
      candidatos: linhas.reduce((n, l) => n + l.candidatos.length, 0),
      aprovados: linhas.filter((l) => l.aprovado.trim() !== '').map((l) => `${l.id}=${l.aprovado}`),
      ids: linhas.map((l) => l.id),
    });
  });
});
