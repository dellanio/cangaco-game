/**
 * I-ARTE-ESCOLA-DE-VOLTA — a escola volta ao sprite anterior (pedido do operador, 2026-10-06: a escola
 * rural D "ficou muito ruim e fora das dimensoes"). A entrada do manifesto e a de antes do a2a26a4.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: { id: string; estados: Record<string, string>; tamanho: number[] }[] };

describe('I-ARTE-ESCOLA-DE-VOLTA', () => {
  it('a escola aponta o sobrado de antes, no envelope 214x240, e os arquivos da escola rural D sairam', () => {
    const escola = manifesto.assets.find((e) => e.id === 'schoolhouse')!;
    expect(escola.estados).toEqual({ madeira: 'sprites/schoolhouse/schoolhouse_madeira.png', completo: 'sprites/schoolhouse/schoolhouse_completo.png' });
    expect(escola.tamanho).toEqual([214, 240]);
    for (const e of Object.values(escola.estados)) expect(existsSync(`assets/${e}`), e).toBe(true);
    for (const f of ['sprites/schoolhouse/schoolhouse_completo-D-20261003.png', 'sprites/schoolhouse/schoolhouse_madeira-D-20261003.png',
      'base/schoolhouse/schoolhouse-D-20261003-completo-master-2x.png', 'base/schoolhouse/schoolhouse-D-20261003-madeira-master-2x.png']) {
      expect(existsSync(`assets/${f}`), f).toBe(false);
    }
  });
});
