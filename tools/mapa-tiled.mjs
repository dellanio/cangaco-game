#!/usr/bin/env node
// I-TERRENO-MAPA-NO-TILED — a fase da campanha abre no Tiled (https://www.mapeditor.org) e volta.
//
//   node tools/mapa-tiled.mjs paleta                          # regrava tools/tiled/paleta.png + paleta.tsj
//   node tools/mapa-tiled.mjs exportar <fase.json> <saida.tmj>
//   node tools/mapa-tiled.mjs importar <entrada.tmj> <fase.json>
//
// O `.tmj` e o JSON do Tiled, ORTOGONAL (CLAUDE.md §4: grid quadrado, a arte e que e desenhada em
// angulo). Tres camadas:
//   - `terreno` (tiles): um tile da paleta por tile do mapa;
//   - `recursos` (tiles): pedra, arvore, peixe, cana e minerio, ou vazio;
//   - `missao` (objetos): os predios e as unidades de cada lado, como pontos com `lado` (e
//     `quantidade`, na unidade).
// O resto da fase (objetivos, ondas, o que libera, o texto) fica na propriedade `fase` do mapa, em JSON.
//
// A paleta e de cores chapadas, so para o editor: nao e arte do jogo e nao entra no bundle.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { escreverFase, LEGENDA, RECURSOS_DO_MAPA } from './fase-formato.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMA = JSON.parse(readFileSync(join(RAIZ, 'data', 'theme-sertao.json'), 'utf8'));
export const TILE_PX = 32;
export const PASTA_DA_PALETA = join(RAIZ, 'tools', 'tiled');

/** A paleta, na ordem dos ids do tileset: os seis terrenos da legenda e depois os recursos do mapa. */
export const PALETA = [
  ...Object.entries(LEGENDA).map(([letra, tipo]) => ({ camada: 'terreno', tipo, letra, cor: TEMA.terreno[tipo] })),
  ...RECURSOS_DO_MAPA.map((tipo) => ({ camada: 'recursos', tipo, cor: TEMA.recursos[tipo] })),
];
const GID = (camada, tipo) => PALETA.findIndex((p) => p.camada === camada && p.tipo === tipo) + 1;

// ---------- a paleta ----------
function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** O PNG da paleta: o terreno e um quadrado chapado com borda escura; o recurso e um losango
 *  colorido sobre transparente (para o terreno aparecer por baixo, na camada de cima). */
export function pngDaPaleta() {
  const width = TILE_PX * PALETA.length;
  const height = TILE_PX;
  const data = new Uint8Array(width * height * 4);
  PALETA.forEach((p, i) => {
    const [r, g, b] = rgb(p.cor);
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const o = (y * width + i * TILE_PX + x) * 4;
        const borda = x === 0 || y === 0 || x === TILE_PX - 1 || y === TILE_PX - 1;
        const meio = TILE_PX / 2 - 0.5;
        const dentro = Math.abs(x - meio) + Math.abs(y - meio) <= TILE_PX * 0.32;
        const contorno = Math.abs(Math.abs(x - meio) + Math.abs(y - meio) - TILE_PX * 0.32) < 1.2;
        if (p.camada === 'terreno') {
          const f = borda ? 0.7 : 1;
          data.set([Math.round(r * f), Math.round(g * f), Math.round(b * f), 255], o);
        } else if (contorno) data.set([20, 18, 16, 255], o);
        else if (dentro) data.set([r, g, b, 255], o);
      }
    }
  });
  return encodePng({ width, height, data });
}

/** O tileset em JSON do Tiled (`.tsj`; nao `.tsx`, que o ESLint le como TypeScript): cada tile diz a
 *  camada e o tipo, que o editor mostra. */
export function tsjDaPaleta() {
  const tileset = {
    columns: PALETA.length,
    image: 'paleta.png',
    imageheight: TILE_PX,
    imagewidth: TILE_PX * PALETA.length,
    margin: 0,
    name: 'paleta',
    spacing: 0,
    tilecount: PALETA.length,
    tiledversion: '1.10.2',
    tileheight: TILE_PX,
    tiles: PALETA.map((p, i) => ({
      id: i,
      properties: [{ name: 'camada', type: 'string', value: p.camada }, { name: 'tipo', type: 'string', value: p.tipo }],
    })),
    tilewidth: TILE_PX,
    type: 'tileset',
    version: '1.10',
  };
  return `${JSON.stringify(tileset, null, 2)}\n`;
}

// ---------- fase -> tmj ----------
/** `paleta`: o caminho do `.tsj` relativo ao `.tmj` (o Tiled resolve por ele). */
export function exportar(fase, paleta = '../paleta.tsj') {
  const { largura, altura, linhas, recursos } = fase.mapa;
  const terreno = [];
  for (let gy = 0; gy < altura; gy++) {
    for (let gx = 0; gx < largura; gx++) terreno.push(GID('terreno', LEGENDA[linhas[gy][gx]]));
  }
  const camadaDeRecursos = new Array(largura * altura).fill(0);
  for (const [tipo, tiles] of Object.entries(recursos)) {
    for (const [gx, gy] of tiles) camadaDeRecursos[gy * largura + gx] = GID('recursos', tipo);
  }
  const objetos = [];
  for (const lado of fase.lados) {
    for (const p of lado.predios) {
      objetos.push({ classe: 'predio', nome: p.id, gx: p.gx, gy: p.gy, propriedades: [{ name: 'lado', type: 'int', value: lado.lado }] });
    }
    for (const u of lado.unidades) {
      objetos.push({
        classe: 'unidade', nome: u.tipo, gx: u.gx, gy: u.gy,
        propriedades: [{ name: 'lado', type: 'int', value: lado.lado }, { name: 'quantidade', type: 'int', value: u.quantidade }],
      });
    }
  }
  // o resto da fase: os lados sem o que virou objeto
  const { mapa: _m, lados, ...resto } = fase;
  void _m;
  const semPosicao = { ...resto, lados: lados.map(({ predios: _p, unidades: _u, ...l }) => { void _p; void _u; return l; }) };
  const camada = (id, name, data) => ({ data, height: altura, id, name, opacity: 1, type: 'tilelayer', visible: true, width: largura, x: 0, y: 0 });
  return {
    compressionlevel: -1,
    height: altura,
    infinite: false,
    layers: [
      camada(1, 'terreno', terreno),
      camada(2, 'recursos', camadaDeRecursos),
      {
        draworder: 'index', id: 3, name: 'missao', opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0,
        objects: objetos.map((o, i) => ({
          height: 0, id: i + 1, name: o.nome, point: true, properties: o.propriedades, rotation: 0,
          type: o.classe, visible: true, width: 0, x: o.gx * TILE_PX + TILE_PX / 2, y: o.gy * TILE_PX + TILE_PX / 2,
        })),
      },
    ],
    nextlayerid: 4,
    nextobjectid: objetos.length + 1,
    orientation: 'orthogonal',
    properties: [{ name: 'fase', type: 'string', value: JSON.stringify(semPosicao) }],
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: TILE_PX,
    tilesets: [{ firstgid: 1, source: paleta }],
    tilewidth: TILE_PX,
    type: 'map',
    version: '1.10',
    width: largura,
  };
}

// ---------- tmj -> fase ----------
const LETRA_DO_TIPO = Object.fromEntries(Object.entries(LEGENDA).map(([l, t]) => [t, l]));

export function importar(tmj) {
  const camada = (nome) => {
    const c = tmj.layers.find((l) => l.name === nome);
    if (c === undefined) throw new Error(`tmj: falta a camada '${nome}'`);
    return c;
  };
  const largura = tmj.width;
  const altura = tmj.height;
  const firstgid = tmj.tilesets?.[0]?.firstgid ?? 1;
  const daPaleta = (gid, nomeDaCamada, i) => {
    const p = PALETA[gid - firstgid];
    if (p === undefined || p.camada !== nomeDaCamada) {
      throw new Error(`tmj: tile ${gid} desconhecido na camada '${nomeDaCamada}' em (${i % largura},${Math.floor(i / largura)})`);
    }
    return p;
  };
  const terreno = camada('terreno').data;
  const linhas = [];
  for (let gy = 0; gy < altura; gy++) {
    let linha = '';
    for (let gx = 0; gx < largura; gx++) {
      const i = gy * largura + gx;
      linha += LETRA_DO_TIPO[daPaleta(terreno[i], 'terreno', i).tipo];
    }
    linhas.push(linha);
  }
  const recursos = {};
  camada('recursos').data.forEach((gid, i) => {
    if (gid === 0) return;
    const { tipo } = daPaleta(gid, 'recursos', i);
    (recursos[tipo] ??= []).push([i % largura, Math.floor(i / largura)]);
  });
  const propriedade = (tmj.properties ?? []).find((p) => p.name === 'fase');
  if (propriedade === undefined) throw new Error("tmj: falta a propriedade 'fase' do mapa");
  const fase = JSON.parse(propriedade.value);
  const lados = fase.lados.map((l) => ({ ...l, predios: [], unidades: [] }));
  const valor = (o, nome) => o.properties?.find((p) => p.name === nome)?.value;
  for (const o of camada('missao').objects) {
    const lado = lados.find((l) => l.lado === valor(o, 'lado'));
    if (lado === undefined) throw new Error(`tmj: objeto ${o.id} ('${o.name}') sem lado conhecido`);
    const gx = Math.floor(o.x / TILE_PX);
    const gy = Math.floor(o.y / TILE_PX);
    if (o.type === 'predio') lado.predios.push({ id: o.name, gx, gy });
    else if (o.type === 'unidade') lado.unidades.push({ tipo: o.name, quantidade: valor(o, 'quantidade'), gx, gy });
    else throw new Error(`tmj: objeto ${o.id} ('${o.name}') com classe '${o.type}', que nao e predio nem unidade`);
  }
  return { ...fase, lados, mapa: { largura, altura, legenda: { ...LEGENDA }, linhas, recursos } };
}

// ---------- CLI ----------
function principal(argv) {
  const [comando, entrada, saida] = argv;
  if (comando === 'paleta') {
    mkdirSync(PASTA_DA_PALETA, { recursive: true });
    writeFileSync(join(PASTA_DA_PALETA, 'paleta.png'), pngDaPaleta());
    writeFileSync(join(PASTA_DA_PALETA, 'paleta.tsj'), tsjDaPaleta());
    console.log(`paleta: ${PALETA.length} tiles em ${PASTA_DA_PALETA}`);
    return 0;
  }
  if (comando === 'exportar' && entrada && saida) {
    const fase = JSON.parse(readFileSync(entrada, 'utf8'));
    writeFileSync(saida, `${JSON.stringify(exportar(fase))}\n`);
    return 0;
  }
  if (comando === 'importar' && entrada && saida) {
    writeFileSync(saida, escreverFase(importar(JSON.parse(readFileSync(entrada, 'utf8')))));
    return 0;
  }
  console.error('uso: mapa-tiled.mjs paleta | exportar <fase.json> <saida.tmj> | importar <entrada.tmj> <fase.json>');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(principal(process.argv.slice(2)));
