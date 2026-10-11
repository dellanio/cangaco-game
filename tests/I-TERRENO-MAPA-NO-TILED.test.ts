/**
 * I-TERRENO-MAPA-NO-TILED — a fase da campanha vai ao Tiled (`.tmj`) e volta, byte a byte. A ida e
 * volta das dez fases de verdade e afirmada no teste do I-TERRENO-DEZ-MAPAS-DA-CAMPANHA, que e quem
 * as emite; aqui, uma fase montada no teste, com terreno, recursos e os dois lados.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { escreverFase, LEGENDA } from '../tools/fase-formato.mjs';
import type { Fase } from '../tools/fase-formato.mjs';
import { exportar, importar, PALETA, PASTA_DA_PALETA, tsjDaPaleta } from '../tools/mapa-tiled.mjs';
import type { TileLayer, Tmj } from '../tools/mapa-tiled.mjs';

const L = 128;
function faseDeTeste(): Fase {
  const linhas = Array.from({ length: L }, (_, gy) => Array.from({ length: L }, (_, gx) => {
    if (gx > 100) return 'w';
    if (gy < 4) return 'm';
    if (gy < 6) return 'r';
    return (gx + gy) % 17 === 0 ? 'a' : (gx * gy) % 23 === 0 ? 'c' : 'g';
  }).join(''));
  return {
    id: 'fase-99-teste', fase: 99, local: 'Teste', titulo: 'A fase do teste', ato: 'I', modo: 'construir', escala: 'combate',
    semente: 1, gerador: 'tests', _doc: 'fixture', narrativa: 'n', desafio: 'd',
    libera: { predios: ['quarry'], tropas: ['militia'] },
    objetivos: { vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'predios' }], derrota: [{ tipo: 'prazo', segundos: 60 }] },
    ondas: [{ aos_segundos: 30, lado: 1, de: { gx: 90, gy: 90 }, tropas: [{ tipo: 'militia', quantidade: 2 }] }],
    lados: [
      { lado: 0, nome: 'Moita Seca', estoque: { timber: 5 }, predios: [{ id: 'storehouse', gx: 20, gy: 20 }], unidades: [{ tipo: 'serf', quantidade: 3, gx: 22, gy: 26 }] },
      { lado: 1, nome: 'Cabo Branco', estoque: {}, predios: [{ id: 'barracks', gx: 80, gy: 80 }], unidades: [{ tipo: 'militia', quantidade: 4, gx: 82, gy: 88 }] },
    ],
    mapa: {
      largura: L, altura: L, legenda: { ...LEGENDA }, linhas,
      recursos: { rock: [[10, 5], [11, 5]], tree: [[40, 40], [41, 41]], fish: [[101, 50]], gold_ore: [[12, 4]] },
    },
  };
}
const camada = (tmj: Tmj, nome: string): TileLayer => tmj.layers.find((l) => l.name === nome) as TileLayer;
const gid = (camadaDoTipo: string, tipo: string): number => PALETA.findIndex((p) => p.camada === camadaDoTipo && p.tipo === tipo) + 1;

describe('I-TERRENO-MAPA-NO-TILED', () => {
  it('(1) ida e volta: importar(exportar(fase)) e a fase, byte a byte', () => {
    const fase = faseDeTeste();
    const tmj = exportar(fase);
    expect(tmj.orientation).toBe('orthogonal');
    expect(tmj.layers.map((l) => l.name)).toEqual(['terreno', 'recursos', 'missao']);
    // passa pelo texto, como o arquivo no disco
    const deVolta = importar(JSON.parse(JSON.stringify(tmj)) as Tmj);
    expect(escreverFase(deVolta)).toBe(escreverFase(fase));
  });

  it('(2) uma edicao no .tmj (um terreno e um recurso trocados, uma tropa arrastada) volta no importar', () => {
    const tmj = exportar(faseDeTeste());
    camada(tmj, 'terreno').data[0] = gid('terreno', 'agua');
    camada(tmj, 'recursos').data[30 * L + 30] = gid('recursos', 'tree');
    const missao = tmj.layers.find((l) => l.name === 'missao');
    if (missao === undefined || missao.type !== 'objectgroup') throw new Error('fixture: a camada missao');
    const serfs = missao.objects.find((o) => o.name === 'serf');
    if (serfs === undefined) throw new Error('fixture: o objeto dos serfs');
    serfs.x = 50 * 32 + 3;
    serfs.y = 51 * 32 + 29;
    const f = importar(tmj);
    expect(f.mapa.linhas[0]?.[0]).toBe('w');
    expect(f.mapa.recursos['tree']).toContainEqual([30, 30]);
    expect(f.lados[0]?.unidades[0]).toEqual({ tipo: 'serf', quantidade: 3, gx: 50, gy: 51 });
  });

  it('(3) tile ou objeto desconhecido e recusado com a posicao', () => {
    const t1 = exportar(faseDeTeste());
    camada(t1, 'terreno').data[5 * L + 7] = 99;
    expect(() => importar(t1)).toThrow(/\(7,5\)/);
    const t2 = exportar(faseDeTeste());
    camada(t2, 'terreno').data[0] = gid('recursos', 'rock'); // recurso pintado na camada de terreno
    expect(() => importar(t2)).toThrow(/camada 'terreno' em \(0,0\)/);
    const t3 = exportar(faseDeTeste());
    camada(t3, 'recursos').data[1] = gid('terreno', 'grama'); // terreno pintado na camada de recursos
    expect(() => importar(t3)).toThrow(/camada 'recursos' em \(1,0\)/);
    const t4 = exportar(faseDeTeste());
    const missao = t4.layers.find((l) => l.name === 'missao');
    if (missao?.type === 'objectgroup' && missao.objects[0]) missao.objects[0].type = 'dragao';
    expect(() => importar(t4)).toThrow(/classe 'dragao'/);
  });

  it('(4) o .tmj aponta a paleta pelo caminho relativo, e a paleta (tsj + png) esta no repositorio', () => {
    const tmj = exportar(faseDeTeste());
    const source = tmj.tilesets[0]?.source ?? '';
    expect(source).toBe('../paleta.tsj');
    const pastaDosTmj = join(PASTA_DA_PALETA, 'fases');
    const tsj = resolve(pastaDosTmj, source);
    expect(existsSync(tsj)).toBe(true);
    // o tsj do disco e o que o codigo gera, e a imagem que ele cita existe ao lado
    expect(readFileSync(tsj, 'utf8')).toBe(tsjDaPaleta());
    const tileset = JSON.parse(tsjDaPaleta()) as { image: string; tilecount: number; type: string };
    expect(tileset.type).toBe('tileset');
    expect(existsSync(join(dirname(tsj), tileset.image))).toBe(true);
    expect(tileset.tilecount).toBe(PALETA.length);
  });
});
