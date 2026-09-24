/**
 * F18, tarefa 2 — A CAMADA DO ROÇADO E DERIVADA DO TERRENO.
 *
 * A camada de recurso responde ONDE, e ate a F-T2a esse "onde" era sempre uma
 * lista esparsa escrita no arquivo de mapa. O campo nao cabe nessa forma: ele
 * nao e uma jazida que alguem posicionou, e o terreno arado que o gerador ja
 * emite. Copiar 130 pares para dentro do JSON sairia do ar no dia em que o
 * gerador emitisse outro mapa, e o mapa e emitido por semente.
 *
 * O que se prova aqui:
 *   - a camada `corn` existe, tem um tile para CADA tile de campo arado e
 *     nenhum a mais — a contagem vem do mapa, nao esta digitada;
 *   - todo tile dela nasce em POUSIO (zero), nao maduro;
 *   - as listas esparsas (rocha, arvore, cardume) nao mudaram uma virgula;
 *   - a ordem e estavel entre duas cargas, que e o que o determinismo exige.
 */
import { describe, expect, it } from 'vitest';
import { gameData, loadGameData, rawGameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import { chaveDeTile } from '../src/sim/estradas';
import { tipoDoTile } from '../src/sim/mapa';

const TIPO = gameData.recursos.tipos.corn;

/** Os tiles de campo arado, contados pela PORTA DE TERRENO (`sim/mapa.ts`).
 *  Contar de novo aqui seria uma segunda copia da leitura do mapa. */
function tilesDeCampoArado(): string[] {
  const terreno = TIPO?.terreno;
  if (terreno === undefined || terreno === null) throw new Error('fixture: corn perdeu o `terreno` em resources.json');
  const achados: string[] = [];
  for (let gy = 0; gy < gameData.mapa.altura; gy += 1) {
    for (let gx = 0; gx < gameData.mapa.largura; gx += 1) {
      if (tipoDoTile(gx, gy, gameData) === terreno) achados.push(chaveDeTile({ gx, gy }));
    }
  }
  return achados;
}

describe('F18 — a camada do roçado sai do terreno', () => {
  it('tem exatamente um tile por tile de campo arado, na ordem de leitura', () => {
    const doTerreno = tilesDeCampoArado();
    expect(doTerreno.length).toBeGreaterThan(0); // senao o resto nao provaria nada
    const daCamada = (gameData.mapa.recursos.corn ?? []).map(([gx, gy]) => chaveDeTile({ gx, gy }));
    expect(daCamada).toEqual(doTerreno);
  });

  it('todo tile de roçado nasce em POUSIO, e nenhum outro tipo nasce zerado', () => {
    const estado = createInitialState(1, gameData);
    const doCampo = new Set(tilesDeCampoArado());
    let emPousio = 0;
    for (const [chave, recurso] of Object.entries(estado.recursos)) {
      if (recurso.tipo === 'corn') {
        expect(doCampo.has(chave), `${chave} deveria ser campo arado`).toBe(true);
        expect(recurso.quantidade, `${chave} nasceu maduro`).toBe(0);
        emPousio += 1;
      } else {
        // A conta do outro lado: o que veio de lista esparsa continua nascendo
        // cheio. Se `quantidadeInicial` vazasse para todo mundo, cai aqui.
        expect(recurso.quantidade, `${chave} (${recurso.tipo}) deveria nascer cheio`)
          .toBe(gameData.recursos.tipos[recurso.tipo]?.rendimentoPorTile);
      }
    }
    expect(emPousio).toBe(doCampo.size);
  });

  it('as listas esparsas do mapa nao mudaram ao ganhar a camada derivada', () => {
    // O arquivo de mapa e a fonte: o que ele escreve tem de chegar identico.
    const cru = rawGameData.mapa.recursos as Readonly<Record<string, readonly (readonly number[])[]>>;
    for (const [tipo, tiles] of Object.entries(cru)) {
      expect(gameData.mapa.recursos[tipo], tipo).toEqual(tiles.map(([gx, gy]) => [gx, gy]));
    }
    // E o milho NAO esta la: ele nao e escrito, e derivado.
    expect(Object.keys(cru)).not.toContain('corn');
  });

  it('duas cargas do mesmo dado dao a mesma camada, byte a byte', () => {
    const a = loadGameData(rawGameData);
    const b = loadGameData(rawGameData);
    expect(JSON.stringify(a.mapa.recursos)).toBe(JSON.stringify(b.mapa.recursos));
    expect(JSON.stringify(createInitialState(1, a).recursos))
      .toBe(JSON.stringify(createInitialState(1, b).recursos));
  });

  it('a reposicao virou ticks inteiros no carregamento, uma vez', () => {
    const reposicao = TIPO?.reposicao;
    expect(reposicao).not.toBeNull();
    expect(Number.isInteger(reposicao?.ticks)).toBe(true);
    expect(reposicao?.ticks).toBeGreaterThan(0);
    // Quem NAO se repoe por acao de predio nenhum continua com `null`: o campo
    // e o unico caso de hoje, e a diferenca e do DADO.
    expect(gameData.recursos.tipos.rock?.reposicao).toBeNull();
  });
});
