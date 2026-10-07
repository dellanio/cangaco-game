/**
 * I-TERRENO-MINAS-PERTO-DA-VILA — carvao, ferro e ouro do lado esquerdo da vila (decisao do
 * operador, 2026-10-05: "colocar do lado esquerdo da vila atual", para testar a fundicao).
 *
 * A serra do oeste sai do gerador (`tools/gerar-mapa.js`, `SERRA_DO_OESTE`), sem sortear nada.
 * O teste confere o mapa carregado pela sim contra a mesma serra, e as tres minas pelo `canPlace`
 * e pelo `step`.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { canPlace } from '../src/sim/placement';
import { recursoNoTile } from '../src/sim/recursos';
import { avancar, comProdutorOcupado, saidaDe } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const require = createRequire(import.meta.url);
interface Veio { readonly tipo: string; readonly y0: number; readonly y1: number }
interface Serra { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly veios: readonly Veio[] }
const gerador = require('../tools/gerar-mapa.js') as {
  readonly SERRA_DO_OESTE: Serra;
  readonly tilesDaSerraDoOeste: () => readonly (readonly [number, number])[];
  readonly montarArquivo: () => unknown;
  readonly serializar: (arquivo: unknown) => string;
};
/** O mapa como esta no disco (o que o jogo carrega). */
interface MapaDoTeste {
  readonly largura: number;
  readonly altura: number;
  readonly linhas: readonly string[];
  readonly legenda: Readonly<Record<string, string>>;
  readonly contagemDeRecursos: Readonly<Record<string, number>>;
  readonly recursos: Readonly<Record<string, readonly (readonly [number, number])[]>>;
}
const MAPA = JSON.parse(readFileSync('data/maps/sertao-128.json', 'utf8')) as MapaDoTeste;
// O gerador publicado não passa pelo plugin/setup de dados do Vitest. Regerar
// um mapa maior é diferente de deslocar o mapa publicado inteiro.
const GERADO = JSON.parse(execFileSync(process.execPath, ['-e',
  'process.stdout.write(JSON.stringify(require("./tools/gerar-mapa.js").montarArquivo()))',
], { encoding: 'utf8' })) as MapaDoTeste;
const deslocamento = gameData.mapa.largura - GERADO.largura;
const { transladarMapa } = require('../tools/transladar-mundo.js') as {
  transladarMapa: (mapa: MapaDoTeste, k: number) => MapaDoTeste;
};
const SERRA: Serra = {
  x0: gerador.SERRA_DO_OESTE.x0 + deslocamento,
  x1: gerador.SERRA_DO_OESTE.x1 + deslocamento,
  y0: gerador.SERRA_DO_OESTE.y0 + deslocamento,
  y1: gerador.SERRA_DO_OESTE.y1 + deslocamento,
  veios: gerador.SERRA_DO_OESTE.veios.map((v) => ({ ...v, y0: v.y0 + deslocamento, y1: v.y1 + deslocamento })),
};
function yDoVeio(tipo: string, ponta: 'y0' | 'y1'): number {
  const veio = SERRA.veios.find((v) => v.tipo === tipo);
  if (!veio) throw new Error(`sem veio de ${tipo}`);
  return veio[ponta];
}

const armazem = gameData.economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
if (armazem === undefined) throw new Error('sem armazem inicial');
/** As tres minas, encostadas na face leste da serra, uma por veio, com o vao entre lotes. */
const MINAS = [
  { tipo: 'coal_mine', id: 'mina-carvao', unidade: 'mineiro-carvao', gx: SERRA.x1 + 2, gy: yDoVeio('coal', 'y0'), recurso: 'coal' },
  { tipo: 'iron_mine', id: 'mina-ferro', unidade: 'mineiro-ferro', gx: SERRA.x1 + 2, gy: yDoVeio('iron_ore', 'y1'), recurso: 'iron_ore' },
  { tipo: 'gold_mine', id: 'mina-ouro', unidade: 'mineiro-ouro', gx: SERRA.x1 + 2, gy: yDoVeio('gold_ore', 'y1'), recurso: 'gold_ore' },
] as const;

/** Quanto resta de um recurso nos tiles do veio dele. */
function restoNoVeio(s: GameState, recurso: string): number {
  const veio = SERRA.veios.find((v) => v.tipo === recurso);
  if (veio === undefined) throw new Error(`sem veio de ${recurso}`);
  let total = 0;
  for (let gy = veio.y0; gy <= veio.y1; gy++) {
    const r = recursoNoTile(s, SERRA.x1, gy);
    if (r !== null && r.tipo === recurso) total += r.quantidade;
  }
  return total;
}

describe('I-TERRENO-MINAS-PERTO-DA-VILA', () => {
  it('(1) carvao, ferro e ouro a ate 20 tiles do armazem inicial, a oeste dele', () => {
    const s = createInitialState(gameData.economia.estadoInicial.semente);
    for (const recurso of ['coal', 'iron_ore', 'gold_ore']) {
      const perto: [number, number][] = [];
      for (let gy = armazem.gy - 20; gy <= armazem.gy + 20; gy++) {
        for (let gx = armazem.gx - 20; gx < armazem.gx; gx++) {
          if (recursoNoTile(s, gx, gy)?.tipo === recurso) perto.push([gx, gy]);
        }
      }
      expect(perto.length, recurso).toBeGreaterThan(0);
    }
  });

  it('(2) as tres minas cabem ao lado dos veios pelo canPlace e produzem pelo step', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    // as minas pedem a serraria (`desbloqueadoPor`): o historico de construidos, como o `step` o deixa
    s = { ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'sawmill'] };
    for (const m of MINAS) {
      expect(canPlace(s, m.tipo, m.gx, m.gy), m.tipo).toEqual({ ok: true });
    }
    const antes = Object.fromEntries(MINAS.map((m) => [m.recurso, restoNoVeio(s, m.recurso)]));
    for (const m of MINAS) s = comProdutorOcupado(s, m, gameData);
    s = avancar(s, 3000);
    const medida: Record<string, { saida: number; tiradoDoVeio: number }> = {};
    for (const m of MINAS) {
      const saida = saidaDe(s, m.id)[m.recurso] ?? 0;
      const tiradoDoVeio = (antes[m.recurso] ?? 0) - restoNoVeio(s, m.recurso);
      medida[m.tipo] = { saida, tiradoDoVeio };
      // a mina tirou do veio da serra do oeste: e ele que alimenta a producao
      expect(tiradoDoVeio, m.tipo).toBeGreaterThan(0);
    }
    gravarEvidencia('I-TERRENO-MINAS-PERTO-DA-VILA', { minas: MINAS, ticks: 3000, medida });
  });

  it('(3) o mapa no disco e o que o gerador emite, com a serra e os veios dele', () => {
    expect(deslocamento).toBeGreaterThanOrEqual(0);
    expect(MAPA).toEqual(transladarMapa(GERADO, deslocamento));
    const charDaMontanha = Object.entries(MAPA.legenda).find(([, tipo]) => tipo === 'montanha')?.[0];
    for (const [x, y] of gerador.tilesDaSerraDoOeste()) {
      const gx = x + deslocamento;
      const gy = y + deslocamento;
      expect(MAPA.linhas[gy]?.[gx], `${gx},${gy}`).toBe(charDaMontanha);
    }
    for (const veio of SERRA.veios) {
      const tiles = MAPA.recursos[veio.tipo]?.filter(([gx]) => gx === SERRA.x1) ?? [];
      expect(tiles.map(([, gy]) => gy).sort((a, b) => a - b), veio.tipo)
        .toEqual(Array.from({ length: veio.y1 - veio.y0 + 1 }, (_, i) => veio.y0 + i));
    }
    // a contagem do cabecalho e a da lista
    for (const [tipo, n] of Object.entries(MAPA.contagemDeRecursos)) expect(MAPA.recursos[tipo]?.length, tipo).toBe(n);
  });

  it('(3) o hash do mapa mudou: o save anterior a serra (hash 7a1f4844) nao vale mais', () => {
    expect(gameData.mapa.hash).not.toBe('7a1f4844');
  });
});
