/**
 * D-TRANSPORTE-02b — o selector da aba Distribuicao (plano em
 * docs/planos/2026-09-29-D-TRANSPORTE-02-menu-de-distribuicao.md). A aba le so
 * `distribuicaoDaVila`: as mercadorias disputadas na ordem do dado, cada par com o valor do
 * lado do jogador, e o valor muda quando o COMANDO real passa pela sim.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { distribuicaoDaVila } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';

const { maximo, padrao } = gameData.entrega.distribuicao;

describe('D-TRANSPORTE-02b — distribuicaoDaVila', () => {
  const inicial = createInitialState(1);

  it('as linhas seguem o dado, em ordem, e abrem no padrao', () => {
    const dist = distribuicaoDaVila(inicial, gameData);
    expect(dist.maximo).toBe(maximo);
    expect(dist.linhas.map((l) => l.mercadoria)).toEqual(Object.keys(padrao));
    for (const linha of dist.linhas) {
      expect(linha.consumidores).toEqual(
        Object.entries(padrao[linha.mercadoria] ?? {}).map(([tipo, valor]) => ({ tipo, valor })),
      );
    }
  });

  it('o comando real muda so o par dele, e o padrao devolve a leitura inicial', () => {
    const baixado = step(inicial, [{ type: 'SetWareDistribution', mercadoria: 'corn', tipo: 'mill', quantidade: 3 }], gameData);
    const dist = distribuicaoDaVila(baixado, gameData);
    const valores = dist.linhas.flatMap((l) => l.consumidores.map((c) => [`${l.mercadoria}|${c.tipo}`, c.valor] as const));
    const mudados = valores.filter(([par, v]) => v !== padrao[par.split('|')[0] ?? '']?.[par.split('|')[1] ?? '']);
    expect(mudados).toEqual([['corn|mill', 3]]);
    const devolta = step(baixado, [{ type: 'SetWareDistribution', mercadoria: 'corn', tipo: 'mill', quantidade: maximo }], gameData);
    expect(distribuicaoDaVila(devolta, gameData)).toEqual(distribuicaoDaVila(inicial, gameData));
    gravarEvidencia('D-TRANSPORTE-02b-aba-distribuicao', { linhas: dist.linhas, mudados });
  });
});
