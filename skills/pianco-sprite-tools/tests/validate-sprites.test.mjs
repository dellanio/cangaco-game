import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from '../scripts/png-rgba.mjs';
import { validateSpriteSpec } from '../scripts/validate-sprites.mjs';

const CALIBRATION = {
  approved: true, maxHueDegreesByRegion: [20, 20, 20], maxLumaDeltaByRegion: [20, 20, 20],
  edgeRgbDistance: 60, matteColors: [[255, 255, 255]],
};

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pianco-validator-'));
  const path = realpathSync(dir), base = realpathSync(tmpdir());
  if (!path.startsWith(base + '\\') && !path.startsWith(base + '/')) throw new Error('Recusa apagar fora de tmp');
  try { return fn(dir); }
  finally { rmSync(path, { recursive: true, force: true }); }
}

function sprite({ width = 8, height = 12, x0 = 2, x1 = 5, y0 = 3, y1 = 10,
  color = [200, 70, 40], bleed = true, matte = false, topColor } = {}) {
  const data = new Uint8Array(width * height * 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4, rgb = topColor && y <= y0 + 2 ? topColor : color;
    data.set([...rgb, 255], p);
  }
  if (bleed) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4;
    if (data[p + 3] || x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
    const rgb = topColor && y <= y0 + 2 ? topColor : color;
    data.set([...rgb, 0], p);
  }
  if (matte) data.set([255, 255, 255, 96], (y0 * width + (x0 - 1)) * 4);
  return { width, height, data };
}

function save(dir, name, image) {
  const path = join(dir, `${name}.png`);
  writeFileSync(path, encodePng(image));
  return path;
}

function fixture(dir, a = sprite(), b = sprite()) {
  const styleSheet = save(dir, 'style-sheet-approved', sprite());
  const calibration = { ...CALIBRATION, referencePath: styleSheet,
    referenceSha256: createHash('sha256').update(readFileSync(styleSheet)).digest('hex') };
  const master = save(dir, 'master', sprite({ width: 16, height: 24, x0: 4, x1: 11, y0: 6, y1: 21 }));
  const pathA = save(dir, 'idle-s-0', a), pathB = save(dir, 'idle-n-0', b);
  return {
    id: 'fixture', kind: 'fixture', frameSize: [8, 12], masterSize: [16, 24], calibration,
    frames: [
      { state: 'idle', direction: 'S', index: 0, path: pathA, masterPath: master, pivot: [0.5, 1] },
      { state: 'idle', direction: 'N', index: 0, path: pathB, masterPath: master, pivot: [0.5, 1] },
    ],
  };
}

const codes = (report) => report.errors.map((e) => e.code);

test('lote de unidade aceita oito direções explícitas e luz sul', () => withDir((dir) => {
  const spec = fixture(dir);
  const base = save(dir, 'unit-idle', sprite({ width: 64, height: 96, x0: 28, x1: 35, y0: 50, y1: 94 }));
  const master = save(dir, 'unit-master', sprite({ width: 128, height: 192, x0: 56, x1: 71, y0: 100, y1: 189 }));
  const mask = save(dir, 'unit-mask', sprite({ width: 64, height: 96, x0: 28, x1: 31, y0: 50, y1: 61, color: [128, 128, 128] }));
  spec.kind = 'unit';
  spec.role = 'civil';
  spec.fps = 10;
  spec.scope = 'batch';
  spec.state = 'idle';
  spec.frameSize = [64, 96];
  spec.masterSize = [128, 192];
  spec.frames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].flatMap((direction) =>
    [0, 1, 2, 3].map((index) => ({
      state: 'idle', direction, index, path: base, masterPath: master,
      teamMask: mask, pivot: [0.5, 1],
    })));
  const report = validateSpriteSpec(spec, { outputDir: join(dir, 'out') });
  assert.equal(report.success, true, JSON.stringify(report.errors));
  const inverted = sprite({ width: 64, height: 96, x0: 28, x1: 35, y0: 50, y1: 94,
    color: [230, 230, 230] });
  for (let y = 50; y <= 94; y++) for (let x = 28; x <= 35; x++) {
    if (y > 72) {
      const p = (y * 64 + x) * 4;
      inverted.data.set([25, 25, 25], p);
    }
  }
  const invertedPath = save(dir, 'unit-light-inverted', inverted);
  spec.mode = 'trial';
  for (const frame of spec.frames) if (frame.direction === 'NE') frame.path = invertedPath;
  const lightReport = validateSpriteSpec(spec, { outputDir: join(dir, 'light-out') });
  assert.ok(codes(lightReport).includes('light-direction'));
  assert.ok(codes(lightReport).includes('light-neighbor'));
  assert.equal(lightReport.mode, 'trial');
  assert.equal(lightReport.approved, false);
  const sample = { ...spec, scope: 'sample', factional: false,
    frames: [{ ...spec.frames[0], teamMask: undefined }] };
  const sampleReport = validateSpriteSpec(sample, { outputDir: join(dir, 'sample-out') });
  assert.equal(sampleReport.success, true, JSON.stringify(sampleReport.errors));
  assert.equal(sampleReport.approved, false);
}));

test('cinco direções canônicas bastam quando o oeste vem de flipX', () => withDir((dir) => {
  const spec = fixture(dir);
  const base = save(dir, 'unit', sprite({ width: 64, height: 96, x0: 28, x1: 35, y0: 50, y1: 94 }));
  const master = save(dir, 'master2x', sprite({ width: 128, height: 192, x0: 56, x1: 71, y0: 100, y1: 189 }));
  spec.kind = 'unit'; spec.role = 'civil'; spec.fps = 10; spec.scope = 'batch'; spec.state = 'idle';
  spec.factional = false; spec.frameSize = [64, 96]; spec.masterSize = [128, 192];
  spec.frames = ['N', 'NE', 'E', 'SE', 'S'].flatMap((direction) =>
    [0, 1, 2, 3].map((index) => ({ state: 'idle', direction, index, path: base, masterPath: master, pivot: [0.5, 1] })));
  const report = validateSpriteSpec(spec);
  assert.equal(report.success, true, JSON.stringify(report.errors));
}));

test('par leste-oeste explícito reprova se a luz não espelha', () => withDir((dir) => {
  const spec = fixture(dir);
  const east = sprite({ topColor: [210, 210, 210] });
  const west = sprite({ topColor: [40, 40, 40] });
  spec.mode = 'trial';
  spec.kind = 'unit'; spec.scope = 'sample'; spec.role = 'civil'; spec.factional = false;
  spec.frames[0] = { ...spec.frames[0], direction: 'E', path: save(dir, 'east', east) };
  spec.frames[1] = { ...spec.frames[1], direction: 'W', path: save(dir, 'west', west) };
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('light-mirror'));
}));

test('albedo de terreno não recebe exigência de luz direcional pintada', () => withDir((dir) => {
  const spec = fixture(dir, sprite({ topColor: [240, 240, 240] }), sprite({ topColor: [240, 240, 240] }));
  spec.kind = 'terrain';
  const report = validateSpriteSpec(spec);
  assert.ok(!codes(report).includes('light-direction'));
}));

test('alfa residual distante da silhueta não é franja de bleed', () => withDir((dir) => {
  const image = sprite();
  image.data.set([255, 255, 255, 20], 0);
  const report = validateSpriteSpec(fixture(dir, image), { outputDir: join(dir, 'out') });
  assert.equal(report.success, true, JSON.stringify(report.errors));
}));

test('PNG válido: passa e gera três contatos sobre os terrenos reais', () => withDir((dir) => {
  const report = validateSpriteSpec(fixture(dir), { outputDir: join(dir, 'out') });
  assert.equal(report.success, true, JSON.stringify(report.errors));
  assert.equal(report.contactSheets.length, 3);
  for (const file of report.contactSheets) {
    const image = decodePng(readFileSync(file));
    assert.ok(image.width > 8 && image.height > 12);
  }
  assert.equal(JSON.parse(readFileSync(join(dir, 'out', 'report.json'), 'utf8')).success, true);
}));

test('PNG inválido: reprova dimensão do derivado e do master', () => withDir((dir) => {
  const spec = fixture(dir);
  spec.frames[1].path = save(dir, 'wrong-size', sprite({ width: 9 }));
  spec.frames[1].masterPath = save(dir, 'wrong-master', sprite());
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('size'));
  assert.ok(codes(report).includes('master-size'));
}));

test('pivô variável e linha do pé fora de ±1 px reprovam', () => withDir((dir) => {
  const spec = fixture(dir, sprite(), sprite({ y1: 8 }));
  spec.frames[1].pivot = [0.45, 1];
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('pivot'));
  assert.ok(codes(report).includes('footline'));
}));

test('centroide de idle salta mais de 2 px', () => withDir((dir) => {
  const spec = fixture(dir);
  spec.frames.push({ ...spec.frames[0], index: 1, path: save(dir, 'idle-s-1', sprite({ x0: 5, x1: 7 })) });
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('idle-jitter'));
}));

test('falta de bleed na borda e franja de matte reprovam', () => withDir((dir) => {
  const noBleed = validateSpriteSpec(fixture(dir, sprite({ bleed: false }), sprite()));
  assert.ok(codes(noBleed).includes('alpha-bleed'));
  const fringe = validateSpriteSpec(fixture(dir, sprite({ matte: true }), sprite()));
  assert.ok(codes(fringe).includes('matte-fringe'));
}));

test('deriva cromática é avaliada por região contra S', () => withDir((dir) => {
  const spec = fixture(dir, sprite(), sprite({ topColor: [40, 180, 70] }));
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('color-hue'));
  assert.ok(report.errors.some((e) => e.detail.includes('alto')));
}));

test('máscara de time deve ter mesmo tamanho, cinza e ficar dentro do alfa', () => withDir((dir) => {
  const spec = fixture(dir);
  spec.frames[0].teamMask = save(dir, 'mask-wrong-size', sprite({ width: 9 }));
  let report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('team-mask'));
  const mask = sprite();
  mask.data.fill(0);
  mask.data.set([128, 10, 128, 255], (4 * mask.width + 3) * 4);
  mask.data.set([128, 128, 128, 255], (0 * mask.width + 0) * 4);
  spec.frames[0].teamMask = save(dir, 'mask-colored-outside', mask);
  report = validateSpriteSpec(spec);
  assert.ok(report.errors.filter((e) => e.code === 'team-mask').length >= 2);
}));

test('calibração não aprovada e vista lateral de prédio não passam', () => withDir((dir) => {
  const spec = fixture(dir);
  spec.calibration.approved = false;
  spec.kind = 'building'; spec.frames[1].direction = 'left_offset';
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('calibration'));
  assert.ok(codes(report).includes('direction'));
}));

test('perfil de unidade exige 8 direções, estados, fps e máscara', () => withDir((dir) => {
  const spec = fixture(dir);
  spec.kind = 'unit'; spec.role = 'civil'; spec.fps = 9;
  const report = validateSpriteSpec(spec);
  assert.ok(codes(report).includes('frames'));
  assert.ok(codes(report).includes('fps'));
  assert.ok(codes(report).includes('team-mask'));
}));
