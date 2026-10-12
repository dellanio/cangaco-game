import { describe, expect, it } from 'vitest';
import { recursoSubmerso } from '../src/render/recurso-submerso';
import resources from '../data/resources.json';
describe('I-TELA-PEIXES-SUBMERSOS', () => {
  it('deixa somente os peixes sob a camada de água', () => {
    for (const id of Object.keys(resources.tipos)) {
      expect(recursoSubmerso(id), id).toBe(id === 'fish');
    }
    expect(recursoSubmerso('')).toBe(false);
  });
});
