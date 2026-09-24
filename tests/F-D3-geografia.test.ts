// F-D3 — a reserva da vila, e o mapa que a semente emite.
//
// Tres guardas, e nenhuma delas le o gerador para depois conferir o gerador:
//
// 1. mesma semente = mesmo arquivo. E o `node tools/gerar-mapa.js --conferir`
//    virado teste, e e por isso que ele passa a rodar no `npm run verify`:
//    ate a F-D3 o `--conferir` existia e ninguem o chamava.
// 2. a vila cabe. Sai de `createInitialState()` e pergunta ao PREDICADO DO
//    RUNTIME (`ehTransponivel`, `recursoNoTile`) — nao a uma releitura do JSON,
//    que so provaria que o JSON e igual a si mesmo.
// 3. a folga vale. O raio vem do dado; o teste nao digita 3.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createInitialState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { caixaDoPredio } from '../src/sim/footprint';
import { ehTransponivel, tipoDoTile } from '../src/sim/mapa';
import { recursoNoTile } from '../src/sim/recursos';
import { gravarEvidencia } from './helpers/evidence';

// O gerador e CommonJS e vive em tools/ — fora do tsconfig de src/. O teste o
// carrega assim mesmo de proposito: a guarda 1 so vale se ela rodar o MESMO
// codigo que grava o arquivo, e nao uma copia da regra.
//
// Por `createRequire` e nao por `require` solto: `require` em modulo ESM e erro
// de lint com razao, e desligar a regra seria mudar o escopo da verificacao em
// vez de resolver o caso (CLAUDE.md §10). Esta e a porta que o proprio Node
// oferece para carregar CommonJS de dentro de ESM.
const requireCjs = createRequire(import.meta.url);
const gerador = requireCjs('../tools/gerar-mapa.js') as {
  montarArquivo: () => unknown;
  serializar: (arquivo: unknown) => string;
  tilesDaVila: () => [number, number][];
  naVila: (gx: number, gy: number) => boolean;
  naReserva: (gx: number, gy: number) => boolean;
  RESERVA: { raio: number; terrenoPermitido: string[]; recursoPermitido: string[] };
};

const estado = createInitialState(gameData.economia.estadoInicial.semente);

/** Todo tile que a vila inicial ocupa, lido do ESTADO (footprint de cada predio
 *  + tile de cada estrada inicial), e nao da lista do gerador. */
function tilesDaVilaNoEstado(): { gx: number; gy: number; de: string }[] {
  const tiles: { gx: number; gy: number; de: string }[] = [];
  for (const id of estado.predios.ordem) {
    const predio = estado.predios.porId[id];
    const caixa = predio ? caixaDoPredio(predio, gameData) : null;
    if (!caixa) continue;
    for (let gy = caixa.y0; gy < caixa.y1; gy += 1) {
      for (let gx = caixa.x0; gx < caixa.x1; gx += 1) tiles.push({ gx, gy, de: `predio ${id}` });
    }
  }
  // `state.estradas` nasce vazio hoje (conferido, nao suposto). A varredura
  // fica escrita assim para a guarda passar a valer SOZINHA no dia em que a
  // vila nascer com estrada — que e a outra metade do aceite 2.
  for (const chave of Object.keys(estado.estradas)) {
    const [gx, gy] = chave.split(',').map(Number) as [number, number];
    tiles.push({ gx, gy, de: `estrada ${chave}` });
  }
  return tiles;
}

describe('F-D3 — mesma semente, mesmo mapa (aceite 3)', () => {
  it('o que a semente emite hoje e, byte a byte, o arquivo versionado', () => {
    const doDisco = readFileSync('data/maps/sertao-128.json', 'utf8').replace(/\r\n/g, '\n');
    expect(gerador.serializar(gerador.montarArquivo())).toBe(doDisco);
  });
});

describe('F-D3 — a vila cabe (aceite 2)', () => {
  const tiles = tilesDaVilaNoEstado();

  it('o cenario tem o que medir: ha predio inicial de pe', () => {
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('nenhum tile de predio ou de estrada inicial tem terreno intransponivel', () => {
    for (const t of tiles) {
      expect(ehTransponivel(t.gx, t.gy), `(${t.gx},${t.gy}) de ${t.de}: ${tipoDoTile(t.gx, t.gy)}`)
        .toBe(true);
    }
  });

  it('nenhum tile de predio ou de estrada inicial tem recurso', () => {
    for (const t of tiles) {
      expect(recursoNoTile(estado, t.gx, t.gy), `(${t.gx},${t.gy}) de ${t.de}`).toBeNull();
    }
  });
});

describe('F-D3 — a folga vale ate o raio do DADO', () => {
  const { raio, terrenoPermitido, recursoPermitido } = gerador.RESERVA;

  it('o raio sai de data/terrain.json, e o gerador nao tem um proprio', () => {
    // Contra o JSON, e nao contra `gameData`: `geracao` e dado do GERADOR e
    // nao tem leitor em `src/` — o jogo carrega o mapa ja emitido. Por isso o
    // carregador nao o publica, e e certo que nao publique. O que a guarda
    // afirma e que o gerador nao guarda uma copia do numero.
    const doDisco = JSON.parse(readFileSync('data/terrain.json', 'utf8')) as {
      geracao: { reservaDaVila: unknown };
    };
    expect(gerador.RESERVA).toEqual(doDisco.geracao.reservaDaVila);
  });

  it('todo tile a ate `raio` de um tile da vila tem terreno permitido', () => {
    for (const [vx, vy] of gerador.tilesDaVila()) {
      for (let dy = -raio; dy <= raio; dy += 1) {
        for (let dx = -raio; dx <= raio; dx += 1) {
          const [gx, gy] = [vx + dx, vy + dy];
          const tipo = tipoDoTile(gx, gy);
          if (tipo === null) continue; // fora do mapa: a borda ja e outra regra
          expect(terrenoPermitido, `(${gx},${gy}) a ${Math.max(Math.abs(dx), Math.abs(dy))} da vila`)
            .toContain(tipo);
        }
      }
    }
  });

  it('e so os recursos permitidos, e nenhum em cima da vila', () => {
    for (const [vx, vy] of gerador.tilesDaVila()) {
      for (let dy = -raio; dy <= raio; dy += 1) {
        for (let dx = -raio; dx <= raio; dx += 1) {
          const [gx, gy] = [vx + dx, vy + dy];
          const recurso = recursoNoTile(estado, gx, gy);
          if (recurso === null) continue;
          expect(gerador.naVila(gx, gy), `(${gx},${gy}) tem ${recurso.tipo} EM CIMA da vila`)
            .toBe(false);
          expect(recursoPermitido, `(${gx},${gy}) na folga`).toContain(recurso.tipo);
        }
      }
    }
  });

  it('a lista de terreno permitido nao pode conter terreno que nao se pisa', () => {
    // O mesmo que `validate:data` afirma, dito aqui pelo PREDICADO do runtime:
    // se alguem trocar a regra do validador, esta continua acusando.
    for (const tipo of terrenoPermitido) {
      expect(gameData.terreno.intransponivel, tipo).not.toContain(tipo);
    }
  });
});

const escrituracaoDoMapa = JSON.parse(readFileSync('data/maps/sertao-128.json', 'utf8')) as {
  contagemPorTipo: Record<string, number>;
  contagemDeRecursos: Record<string, number>;
};

gravarEvidencia('F-D3-geografia', {
  reserva: gerador.RESERVA,
  tilesDaVila: gerador.tilesDaVila().length,
  tilesDeVilaNoEstado: tilesDaVilaNoEstado().length,
  estradasIniciais: Object.keys(estado.estradas).length,
  // Do ARQUIVO: `gameData.mapa` publica so o que a sim usa, e a contagem e
  // escrituracao do gerador. O carregador nao a expoe, e faz certo.
  contagemPorTipo: escrituracaoDoMapa.contagemPorTipo,
  contagemDeRecursos: escrituracaoDoMapa.contagemDeRecursos,
});
