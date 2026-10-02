import { describe, expect, it } from 'vitest';
import { custoZerado, somarCusto } from '../src/render/custo-do-quadro';

describe('D-TELA-CUSTO-DO-QUADRO', () => {
  it('acumula cada camada e zera sem alterar o acumulado anterior', () => {
    const vazio = custoZerado();
    const vento = somarCusto(vazio, 'vento', 10, 7, () => 12);
    const agua = somarCusto(vento, 'agua', 12, 0, () => 15);
    const repetido = somarCusto(agua, 'vento', 15, 3, () => 19);
    expect(vazio.vento).toEqual({ ms: 0, chamadas: 0, itens: 0 });
    expect(repetido.vento).toEqual({ ms: 6, chamadas: 2, itens: 10 });
    expect(repetido.agua).toEqual({ ms: 3, chamadas: 1, itens: 0 });
    expect(custoZerado()).toEqual(vazio);
  });
});
