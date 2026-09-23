/**
 * F17b — o medidor de material de uma obra. Plano em
 * `docs/planos/F17b-material-na-obra.md`.
 *
 * `medidor-obra.ts` e aritmetica pura SEM IMPORT NENHUM, como `estagio-obra.ts`
 * (F11c): e o que o deixa dentro da regra estrutural de `render/` — so
 * `mapa.ts` e `predios.ts` podem falar com `sim/data` (guarda em
 * `tests/F04-grid-ortogonal.test.ts`). A ordem das mercadorias chega por
 * parametro, nunca lida de dentro.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { aparenciaDoPredio, ordemDasMercadorias } from '../src/render/predios';
import { medidorDaObra } from '../src/render/medidor-obra';
import { custoDoPredio } from '../src/sim/obra';
import { gravarEvidencia } from './helpers/evidence';

// Recorte da ordem do dado. O arquivo sob teste nao conhece `economia`.
const ORDEM = ['tree_trunk', 'timber', 'stone'];

describe('F17b — a aritmetica do medidor', () => {
  it('nada entregue: todas as linhas em 0, na ordem dada', () => {
    expect(medidorDaObra({ timber: 3, stone: 5 }, { timber: 3, stone: 5 }, ORDEM)).toEqual([
      { mercadoria: 'timber', entregue: 0, total: 3 },
      { mercadoria: 'stone', entregue: 0, total: 5 },
    ]);
  });

  it('entrega parcial: entregue e o custo menos a falta', () => {
    const linhas = medidorDaObra({ timber: 1, stone: 5 }, { timber: 3, stone: 5 }, ORDEM);
    expect(linhas[0]).toEqual({ mercadoria: 'timber', entregue: 2, total: 3 });
  });

  // O buraco que o painel tinha ate a correcao da F16b, e que aqui nao pode
  // voltar: `faltam` nao guarda chave que ja zerou.
  it('material COMPLETO continua aparecendo, cheio', () => {
    expect(medidorDaObra({ stone: 5 }, { timber: 3, stone: 5 }, ORDEM)).toEqual([
      { mercadoria: 'timber', entregue: 3, total: 3 },
      { mercadoria: 'stone', entregue: 0, total: 5 },
    ]);
  });

  it('custo 0 nao vira linha', () => {
    expect(medidorDaObra({}, { timber: 0, stone: 4 }, ORDEM))
      .toEqual([{ mercadoria: 'stone', entregue: 4, total: 4 }]);
  });

  it('falta maior que o custo nao produz entregue negativo', () => {
    expect(medidorDaObra({ stone: 9 }, { stone: 4 }, ORDEM)[0]?.entregue).toBe(0);
  });

  it('a ordem e a dada, nao a de insercao do objeto', () => {
    const linhas = medidorDaObra({ stone: 1, timber: 1 }, { stone: 2, timber: 2 }, ORDEM);
    expect(linhas.map((l) => l.mercadoria)).toEqual(['timber', 'stone']);
  });
});

describe('F17b — o funil entrega o custo do dado', () => {
  it('a aparencia da quarry traz o custo de buildings.json', () => {
    const def = gameData.predios.find((p) => p.id === 'quarry');
    expect(def).toBeDefined();
    if (def === undefined) return;
    // igualdade contra o DADO, pela MESMA funcao que a obra usa para nascer
    // (`custoDoPredio`): um literal digitado aqui passaria a valer sozinho.
    expect(aparenciaDoPredio('quarry').custo).toEqual(custoDoPredio(def));
  });

  it('tipo desconhecido cai no placeholder, com custo vazio e sem quebrar', () => {
    expect(aparenciaDoPredio('nao-existe').custo).toEqual({});
  });

  it('a ordem exportada e a de economia.mercadorias, a mesma lista', () => {
    expect(ordemDasMercadorias).toEqual(gameData.economia.mercadorias);
  });

  it('o medidor de uma obra recem-posta, pelo funil, e o custo inteiro por entregar', () => {
    const { custo } = aparenciaDoPredio('quarry');
    const linhas = medidorDaObra(custo, custo, ordemDasMercadorias);
    expect(linhas.every((l) => l.entregue === 0)).toBe(true);
    expect(linhas.map((l) => l.mercadoria)).toEqual(
      gameData.economia.mercadorias.filter((m) => (custo[m] ?? 0) > 0),
    );
    gravarEvidencia('F17b-medidor', { quarryRecemPosta: linhas });
  });
});
