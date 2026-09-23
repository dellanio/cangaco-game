/**
 * F15a — a receita de producao e um CICLO, derivado UMA vez no carregamento.
 *
 * Antes desta feature `producao.receitas[tipo]` guardava ticks-por-unidade, um
 * relogio por mercadoria. Consumir aquilo exigiria um contador por mercadoria
 * dentro do `GameState`. Aqui o carregador deriva um ciclo por predio:
 * `ticksDoCiclo` e o periodo da taxa MAIS LENTA, e as quantidades sao a razao
 * dos periodos, arredondada ali.
 *
 * O que isto prova de verdade: "1 tronco -> 2 timber" (GDD §4.2) sai das TAXAS,
 * sem a quantidade 2 estar digitada em lugar nenhum.
 */
import { describe, expect, it } from 'vitest';
import { gameData, loadGameData, rawGameData } from '../src/sim/data';

describe('F15a — a receita e um ciclo', () => {
  it('quarry: um ciclo de 167 ticks rende 1 stone, e o veio e finito', () => {
    const r = gameData.producao.receitas.quarry;
    expect(r).toBeDefined();
    expect(r?.ticksDoCiclo).toBe(167);
    expect(r?.entra).toEqual({});
    expect(r?.sai).toEqual({ stone: 1 });
    expect(r?.rendimentoDoVeio).toBeGreaterThan(0);
  });

  it('sawmill: 1 tronco -> 2 timber, a razao vindo das taxas e nao de um literal', () => {
    const r = gameData.producao.receitas.sawmill;
    expect(r?.ticksDoCiclo).toBe(273);
    expect(r?.entra).toEqual({ tree_trunk: 1 });
    expect(r?.sai).toEqual({ timber: 2 });
    expect(r?.rendimentoDoVeio).toBeNull();
  });

  it('woodcutters: 545 ticks por tronco, sem veio — ele replanta', () => {
    const r = gameData.producao.receitas.woodcutters;
    expect(r?.ticksDoCiclo).toBe(545);
    expect(r?.entra).toEqual({});
    expect(r?.sai).toEqual({ tree_trunk: 1 });
    expect(r?.rendimentoDoVeio).toBeNull();
  });

  it('as proporcoes que o GDD escreve em palavras saem do dado', () => {
    // Cada uma destas esta escrita em prosa no GDD §4.2/§5.2 e em `notas` do
    // production.json; nenhuma esta escrita como numero em `.ts`.
    expect(gameData.producao.receitas.swine_farm?.entra).toEqual({ corn: 4 });   // 4 corn por porco
    expect(gameData.producao.receitas.butchers?.sai).toEqual({ sausages: 3 });   // 3 salsichas por porco
    expect(gameData.producao.receitas.bakery?.sai).toEqual({ loaves: 2 });       // 2 paes por farinha
    expect(gameData.producao.receitas.metallurgists?.sai).toEqual({ gold: 2 });  // minerio + carvao -> 2 ouro
    expect(gameData.producao.receitas.weapons_workshop?.entra).toEqual({ timber: 2 });
  });

  it('TODA receita tem ciclo inteiro >= 1 e so quantidades inteiras >= 1', () => {
    const receitas = Object.entries(gameData.producao.receitas);
    expect(receitas.length).toBeGreaterThan(0);
    for (const [id, r] of receitas) {
      expect(Number.isInteger(r.ticksDoCiclo), id).toBe(true);
      expect(r.ticksDoCiclo, id).toBeGreaterThanOrEqual(1);
      expect(Object.keys(r.entra).length + Object.keys(r.sai).length, id).toBeGreaterThan(0);
      for (const [m, q] of [...Object.entries(r.entra), ...Object.entries(r.sai)]) {
        expect(Number.isInteger(q), `${id}.${m}`).toBe(true);
        expect(q, `${id}.${m}`).toBeGreaterThanOrEqual(1);
        // float nunca sobrevive ate aqui: quem divide e o carregador, uma vez so
        expect(q, `${id}.${m}`).toBe(Math.trunc(q));
      }
    }
  });

  it('o ciclo e o periodo da taxa MAIS LENTA — mexer na escala move os dois juntos', () => {
    // Prova estrutural de que nada foi digitado: com a escala de economia
    // dobrada, todo periodo cai pela metade e as RAZOES ficam de pe.
    const escalas = { ...rawGameData.time.escalas, economia: rawGameData.time.escalas.economia * 2 };
    const outro = loadGameData({ ...rawGameData, time: { ...rawGameData.time, escalas } });
    const sawmill = outro.producao.receitas.sawmill;
    expect(sawmill?.ticksDoCiclo).toBe(136);        // metade de 273, com o arredondamento do loader
    expect(sawmill?.entra).toEqual({ tree_trunk: 1 });
    expect(sawmill?.sai).toEqual({ timber: 2 });    // a proporcao NAO depende da escala
  });
});
