import { expect, it } from 'vitest';
import { atualizarVirada, direcaoNaVirada, iniciarVirada } from '../src/render/virada-de-unidade';
import { quadroDoAndar } from '../src/render/animacao-de-unidade';
import config from '../data/animacao-unidade.json';

it.each([
  ['l', 0, 'ne'], ['l', 0.7, 'l'],
  ['se', 0, 'ne'], ['se', 0.7, 'l'], ['se', 1.4, 'se'],
  ['s', 0, 'ne'], ['s', 0.7, 'l'], ['s', 1.4, 'se'], ['s', 2.1, 's'],
] as const)('D-TELA-04d (virada): n → %s em %s ticks mostra %s', (nova, ticks, visivel) => {
  expect(direcaoNaVirada('n', nova, ticks, config.passoDaViradaTicks)).toBe(visivel);
});
it('empate de 180° é horário nos dois sentidos e diagonal de 45° é imediata', () => {
  expect(direcaoNaVirada('s', 'n', 0, 0.7)).toBe('so');
  expect(direcaoNaVirada('no', 'n', 0, 0.7)).toBe('n');
});
it('parada congela o degrau e o walk continua independente durante a virada', () => {
  const inicio = iniciarVirada('n', 0);
  const primeiro = atualizarVirada(inicio, 's', 1, 0.7);
  expect(primeiro.visivel).toBe('ne');
  expect(atualizarVirada(primeiro, null, 20, 0.7)).toEqual(primeiro);
  expect(atualizarVirada(primeiro, 's', 1.7, 0.7).visivel).toBe('l');
  expect(quadroDoAndar(0.5, 2, 8)).toBe(2);
  expect(quadroDoAndar(0.75, 2, 8)).toBe(3);
});
