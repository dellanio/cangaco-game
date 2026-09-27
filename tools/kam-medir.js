'use strict';

// Leitor de MEDIDA do Knights and Merchants original (decisao do operador,
// 2026-09-27). Le os binarios da instalacao do jogo NO LUGAR e imprime numeros:
// ritmo e producao dos predios (`houses.dat`), e largura, altura e pivot dos
// sprites (`houses.rx`, `units.rx`, `trees.rx`) — so o cabecalho de cada imagem,
// os pixels sao pulados sem serem lidos. Nada do KaM entra no repositorio: o
// que sai daqui vai para o BALANCE_LOG / BRIEF-ARTE como numero, com a fonte.
// Leia `tools/kam-medir.md` antes de usar.
//
//   node tools/kam-medir.js "<pasta do KaM>" [--remake <pasta>] [--saida arquivo.json]
//
// Os layouts sao os do kam_remake (reyandme/kam_remake, master), e cada bloco
// abaixo cita o arquivo de onde veio. O tamanho de cada .dat e conferido contra
// o layout antes de ler: arquivo de outra versao reprova, nao devolve lixo.
//
// O LOTE de cada casa e a especie de arvore adulta NAO estao nos binarios de um
// jeito legivel (o `BuildArea` do houses.dat nao e a area 4x4, e o kam_remake nao
// o le) e vivem em tabelas do codigo do kam_remake. Este script nao as copia: com
// `--remake`, le as tabelas de um checkout dele (`KM_ResTypes.pas`,
// `KM_ResHouses.pas`, `KM_ResMapElements.pas`, achados por nome em qualquer
// subpasta). Sem `--remake`, sai so o que o binario da.

const fs = require('fs');
const path = require('path');

// KM_Defaults.pas: CELL_SIZE_PX = 40, a largura de um tile em pixels.
const TILE_PX = 40;

// KM_ResTypes.pas: TKMAnimLoop = Step[1..30] SmallInt, Count SmallInt, MoveX, MoveY Integer.
const ANIM = 70;
const ANIM_COUNT = 60;

// KM_ResHouses.pas: fBeastAnim (2x5x3 TKMAnimLoop) e 29 TKMHouseSpecLegacy de 1688 bytes,
// na ordem HOUSE_ID_TO_TYPE, com os nomes do enum TKMHouseType sem o `ht`. O indice 26
// nao e casa.
const HOUSES_BEAST = 2 * 5 * 3 * ANIM;
const HOUSE_REC = 1688;
const HOUSE_IDS = ['Sawmill', 'IronSmithy', 'WeaponSmithy', 'CoalMine', 'IronMine', 'GoldMine',
  'Fishermans', 'Bakery', 'Farm', 'Woodcutters', 'ArmorSmithy', 'Store', 'Stables', 'School',
  'Quarry', 'Metallurgists', 'Swine', 'WatchTower', 'TownHall', 'WeaponWorkshop',
  'ArmorWorkshop', 'Barracks', 'Mill', 'SiegeWorkshop', 'Butchers', 'Tannery', null, 'Inn',
  'Vineyard'];
// Deslocamentos dentro de TKMHouseSpecLegacy (packed): StonePic 0, WoodPic 2, WoodPal 4,
// StonePal 6, SupplyIn/Out 8..87, Anim[19] 88..1417, WoodPicSteps/StonePicSteps 1418,
// a1 1422, EntranceOffsetX/Y 1424, EntranceOffsetXpx/Ypx 1426, BuildArea[10][10] 1428,
// WoodCost 1528, StoneCost 1529, BuildSupply 1530..1625, a5/SizeArea 1626, SizeX..sy2
// 1630, WorkerWork 1634, WorkerRest 1636, WareInput 1638, WareOutput 1642,
// ResProductionX 1646, MaxHealth 1647, Sight 1649, WorkerType 1651.
const H = {
  stonePic: 0, anim: 88, woodCost: 1528, stoneCost: 1529,
  workerWork: 1634, workerRest: 1636, resProductionX: 1646,
};
// THouseAnim: haWork1..haWork5 sao os indices 1..5 (0 e haIdle).
const HOUSE_ANIM_WORK = [1, 2, 3, 4, 5];
// KM_UnitWorkPlan.pas: o descanso e WorkerRest x 10 ticks.
const REST_TICKS = 10;

// KM_ResUnits.pas: fSerfCarry (28 mercadorias x 8 direcoes de TKMAnimLoop) e 41 registros
// TKMUnitSpecLegacy: 22 bytes de campos, UnitAnim[14 acoes][8 direcoes], 36 bytes de fim.
const UNIT_CARRY = 28 * 8 * ANIM;
const UNIT_REC = 22 + 14 * 8 * ANIM + 36;
const UNIT_COUNT = 41;
// UNIT_ID_TO_TYPE: 0 Serf, 1 Woodcutter, 4 Farmer. Acao 0 = uaWalk; direcao 4 = dirS
// (N, NE, E, SE, S, SW, W, NW).
const UNIDADES = { Serf: 0, Woodcutter: 1, Farmer: 4 };
const UA_WALK = 0;
const DIR_S = 4;

// KM_ResMapElements.pas: mapelem.dat e uma sequencia de registros de 99 bytes, e o
// TKMAnimLoop e o primeiro campo.
const MAPELEM_REC = 99;

// KM_ResSpritesEdit.pas, LoadFromRXFile: Count Integer, Flag[Count] Byte, e para cada
// flag 1: SizeX Word, SizeY Word, PivotX Integer, PivotY Integer, SizeX*SizeY bytes de
// pixel. Os ids sao de base 1, e o render usa `Step + 1` / `StonePic + 1`.
function lerCabecalhosRx(arquivo) {
  const b = fs.readFileSync(arquivo);
  const count = b.readInt32LE(0);
  const sprites = new Map();
  let o = 4 + count;
  for (let id = 1; id <= count; id += 1) {
    if (b[4 + id - 1] !== 1) continue;
    const w = b.readUInt16LE(o);
    const h = b.readUInt16LE(o + 2);
    sprites.set(id, { w, h, pivotX: b.readInt32LE(o + 4), pivotY: b.readInt32LE(o + 8) });
    o += 12 + w * h;
  }
  if (o !== b.length) throw new Error(`${arquivo}: o layout nao fecha (${o} de ${b.length} bytes)`);
  return sprites;
}

function conferirTamanho(arquivo, b, esperado) {
  if (b.length !== esperado) {
    throw new Error(`${arquivo}: ${b.length} bytes, o layout pede ${esperado}. Outra versao do jogo?`);
  }
}

function acharArquivo(pasta, nome) {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isFile() && e.name === nome) return p;
    if (e.isDirectory() && e.name !== '.git') {
      const achado = acharArquivo(p, nome);
      if (achado !== null) return achado;
    }
  }
  return null;
}

function lerFonteDoRemake(pasta, nome) {
  const p = acharArquivo(pasta, nome);
  if (p === null) throw new Error(`--remake: ${nome} nao encontrado em ${pasta}`);
  return fs.readFileSync(p, 'latin1');
}

// O lote: HOUSE_DAT_X (KM_ResHouses.pas) e indexado pelo enum TKMHouseType a partir de
// htArmorSmithy, e cada entrada traz `PlanYX` 4x4 (linha = Y, de cima para baixo;
// 1 ocupa, 2 e a porta). A celula [I, K] do plano (base 1) cai no tile
// `aLoc + (K - 3, I - 4)` (KM_Terrain.pas, SetHouse): a ORIGEM da casa, de onde o
// sprite e medido, e a coluna 3 da linha 4, fixa, e nao a celula da porta.
const ORIGEM_NO_PLANO = { x: 2, y: 3 };
function lotesDoRemake(pasta) {
  const tipos = lerFonteDoRemake(pasta, 'KM_ResTypes.pas');
  const enumTxt = /TKMHouseType\s*=\s*\(([^)]*)\)/.exec(tipos);
  if (enumTxt === null) throw new Error('--remake: enum TKMHouseType nao encontrado');
  const nomes = enumTxt[1].split(',').map((t) => t.trim().replace(/^ht/, ''))
    .filter((t) => t !== 'None' && t !== 'Any');
  const fonte = lerFonteDoRemake(pasta, 'KM_ResHouses.pas');
  const planos = [...fonte.slice(fonte.indexOf('HOUSE_DAT_X')).matchAll(/PlanYX:\s*\(([^;]*)\);/g)]
    .map((m) => [...m[1].matchAll(/\(([\d,\s]+)\)/g)].map((l) => l[1].split(',').map(Number)));
  if (planos.length < nomes.length) throw new Error(`--remake: ${planos.length} PlanYX para ${nomes.length} casas`);
  const lotes = new Map();
  nomes.forEach((nome, i) => {
    const plano = planos[i];
    let x0 = 9; let y0 = 9; let x1 = -1; let y1 = -1;
    plano.forEach((linha, y) => linha.forEach((v, x) => {
      if (v === 0) return;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }));
    lotes.set(nome, {
      x0, y0, x1, y1,
      celulas: plano.flat().filter((v) => v !== 0).length,
      plano: plano.map((l) => l.join('')),
    });
  });
  return lotes;
}

// CHOPABLE_TREES (KM_ResMapElements.pas): uma linha por especie; as colunas sao Age1..Age4,
// Falling, Stump. A arvore adulta e a coluna Age4.
function arvoresAdultasDoRemake(pasta) {
  const fonte = lerFonteDoRemake(pasta, 'KM_ResMapElements.pas');
  const i = fonte.indexOf('CHOPABLE_TREES');
  const bloco = fonte.slice(i, fonte.indexOf(');', fonte.indexOf('= (', i)) + 2);
  const seis = /\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  return [...bloco.matchAll(seis)].map((m) => Number(m[4]));
}

function medirCasas(pasta, rx, lotes) {
  const arquivo = path.join(pasta, 'data', 'defines', 'houses.dat');
  const b = fs.readFileSync(arquivo);
  conferirTamanho(arquivo, b, HOUSES_BEAST + HOUSE_IDS.length * HOUSE_REC);
  const casas = [];
  HOUSE_IDS.forEach((nome, i) => {
    if (nome === null) return;
    const r = b.subarray(HOUSES_BEAST + i * HOUSE_REC, HOUSES_BEAST + (i + 1) * HOUSE_REC);
    const area = lotes === null ? null : lotes.get(nome) ?? null;
    const spriteId = r.readInt16LE(H.stonePic) + 1;
    const s = rx.get(spriteId) ?? null;
    const casa = {
      casa: nome,
      resProductionX: r.readInt8(H.resProductionX),
      workerWork: r.readInt16LE(H.workerWork),
      workerRestTicks: r.readInt16LE(H.workerRest) * REST_TICKS,
      animWorkCount: HOUSE_ANIM_WORK.map((k) => r.readInt16LE(H.anim + k * ANIM + ANIM_COUNT)),
      custo: { madeira: r[H.woodCost], pedra: r[H.stoneCost] },
      lote: area === null ? null : {
        largura: area.x1 - area.x0 + 1, altura: area.y1 - area.y0 + 1,
        celulas: area.celulas, planYX: area.plano,
      },
      sprite: s === null ? null : { id: spriteId, ...s },
    };
    if (s !== null && area !== null) {
      // Em px, com a origem no canto superior esquerdo do tile `aLoc`: o sprite ocupa
      // [pivotX, pivotX + w] x [pivotY, pivotY + h] (AddHouse, KM_RenderPool.pas), e o
      // lote ocupa a caixa das celulas do PlanYX.
      const o = ORIGEM_NO_PLANO;
      const loteX0 = (area.x0 - o.x) * TILE_PX;
      const loteX1 = (area.x1 - o.x + 1) * TILE_PX;
      const loteY0 = (area.y0 - o.y) * TILE_PX;
      const loteY1 = (area.y1 - o.y + 1) * TILE_PX;
      casa.relacao = {
        alturaSobreLargura: +(s.h / s.w).toFixed(3),
        larguraSobreLote: +(s.w / (loteX1 - loteX0)).toFixed(3),
        alturaSobreLarguraDoLote: +(s.h / (loteX1 - loteX0)).toFixed(3),
        transbordaAcimaPx: loteY0 - s.pivotY,
        transbordaAbaixoPx: s.pivotY + s.h - loteY1,
        transbordaEsquerdaPx: loteX0 - s.pivotX,
        transbordaDireitaPx: s.pivotX + s.w - loteX1,
      };
    }
    casas.push(casa);
  });
  return casas;
}

function medirUnidades(pasta, rx) {
  const arquivo = path.join(pasta, 'data', 'defines', 'unit.dat');
  const b = fs.readFileSync(arquivo);
  conferirTamanho(arquivo, b, UNIT_CARRY + UNIT_COUNT * UNIT_REC);
  const saida = [];
  for (const [nome, i] of Object.entries(UNIDADES)) {
    const o = UNIT_CARRY + i * UNIT_REC + 22 + (UA_WALK * 8 + DIR_S) * ANIM;
    const count = b.readInt16LE(o + ANIM_COUNT);
    const quadros = [];
    for (let k = 0; k < count; k += 1) {
      const id = b.readInt16LE(o + k * 2) + 1;
      const s = rx.get(id);
      if (s) quadros.push({ id, ...s });
    }
    const alturas = quadros.map((q) => q.h);
    saida.push({
      unidade: nome, acao: 'Walk', direcao: 'S', quadros: quadros.length,
      primeiroQuadro: quadros[0] ?? null,
      alturaMinPx: Math.min(...alturas), alturaMaxPx: Math.max(...alturas),
    });
  }
  return saida;
}

function medirArvores(pasta, rx, adultas) {
  const arquivo = path.join(pasta, 'data', 'defines', 'mapelem.dat');
  const b = fs.readFileSync(arquivo);
  if (b.length % MAPELEM_REC !== 0) throw new Error(`${arquivo}: ${b.length} nao e multiplo de ${MAPELEM_REC}`);
  return adultas.map((obj) => {
    const id = b.readInt16LE(obj * MAPELEM_REC) + 1;
    const s = rx.get(id) ?? null;
    return { objeto: obj, sprite: s === null ? null : { id, ...s } };
  });
}

function main() {
  const args = process.argv.slice(2);
  const opcao = (nome) => {
    const i = args.indexOf(nome);
    return i >= 0 ? args[i + 1] ?? null : null;
  };
  const remake = opcao('--remake');
  const saida = opcao('--saida');
  const pasta = args.find((a, i) => !a.startsWith('--') && !['--remake', '--saida'].includes(args[i - 1]));
  if (pasta === undefined) {
    console.error('uso: node tools/kam-medir.js "<pasta do KaM>" [--remake <pasta>] [--saida arquivo.json]');
    process.exit(2);
  }
  const res = path.join(pasta, 'data', 'gfx', 'res');
  const resultado = {
    fonte: pasta,
    remake,
    tilePx: TILE_PX,
    casas: medirCasas(pasta, lerCabecalhosRx(path.join(res, 'houses.rx')),
      remake === null ? null : lotesDoRemake(remake)),
    unidades: medirUnidades(pasta, lerCabecalhosRx(path.join(res, 'units.rx'))),
    arvores: remake === null ? null
      : medirArvores(pasta, lerCabecalhosRx(path.join(res, 'trees.rx')), arvoresAdultasDoRemake(remake)),
  };
  const texto = JSON.stringify(resultado, null, 1);
  if (saida !== null) fs.writeFileSync(saida, texto);
  else console.log(texto);
}

main();
