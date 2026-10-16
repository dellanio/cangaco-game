/**
 * I-TELA-MODO-ADMIN (aceite 1) — a regra pura do modo admin, por tabela.
 */
import { describe, expect, it } from 'vitest';
import { modoAdmin } from '../src/render/modo-admin';

describe('I-TELA-MODO-ADMIN', () => {
  it.each([
    ['?admin', null, true, '1'],
    ['?admin=1', null, true, '1'],
    ['?pausado&admin', null, true, '1'],
    ['?admin=0', '1', false, null],
    ['?admin=0', null, false, null],
    ['', '1', true, undefined],
    ['?pausado', '1', true, undefined],
    ['', null, false, undefined],
    ['?pausado', 'x', false, undefined],
  ] as const)('busca %j com guardado %j: ligado %j, guardar %j', (busca, guardado, ligado, guardar) => {
    expect(modoAdmin(busca, guardado)).toEqual({ ligado, guardar });
  });
});
