import console from 'node:console';
import process from 'node:process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png-rgba.mjs';
import { renderContactSheets } from './contact-sheet.mjs';

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const COUNTS = { idle: 4, walk: 8, attack: 6, die: 6, work: 6 };
const REGIONS = ['alto', 'meio', 'baixo'];

function error(errors, code, detail) { errors.push({ code, detail }); }
function samePair(a, b) { return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1]; }
function imageAt(image, x, y) { return (y * image.width + x) * 4; }

function visibleBounds(image) {
  let x0 = image.width, x1 = -1, y0 = image.height, y1 = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (image.data[imageAt(image, x, y) + 3] < 128) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}

function colorStats(image, mask, bounds) {
  const regions = REGIONS.map(() => ({ weight: 0, luma: 0, sin: 0, cos: 0, hueWeight: 0 }));
  let totalX = 0, totalWeight = 0;
  for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
    const i = imageAt(image, x, y), alpha = image.data[i + 3];
    if (alpha < 128 || (mask && mask.data[i + 3] > 0)) continue;
    const w = alpha / 255, r = image.data[i] / 255, g = image.data[i + 1] / 255, b = image.data[i + 2] / 255;
    const zone = Math.min(2, Math.floor(3 * (y - bounds.y0) / (bounds.y1 - bounds.y0 + 1)));
    const stat = regions[zone];
    stat.weight += w;
    stat.luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) * 255 * w;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    if (delta > 0.05) {
      let h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      if (h < 0) h += 6;
      const angle = h * Math.PI / 3;
      stat.sin += Math.sin(angle) * delta * w; stat.cos += Math.cos(angle) * delta * w; stat.hueWeight += delta * w;
    }
    totalX += x * w; totalWeight += w;
  }
  return {
    centroidX: totalWeight ? totalX / totalWeight : null,
    regions: regions.map((s) => ({
      luma: s.weight ? s.luma / s.weight : null,
      hue: s.hueWeight ? (Math.atan2(s.sin, s.cos) * 180 / Math.PI + 360) % 360 : null,
    })),
  };
}

function lightStats(image, mask, bounds) {
  const halves = [{ sum: 0, weight: 0 }, { sum: 0, weight: 0 }];
  const middleY = (bounds.y0 + bounds.y1) / 2;
  for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) {
    const i = imageAt(image, x, y), alpha = image.data[i + 3];
    if (alpha < 128 || (mask && mask.data[i + 3] > 0)) continue;
    const half = y <= middleY ? 0 : 1;
    const weight = alpha / 255;
    halves[half].sum += (0.2126 * image.data[i] + 0.7152 * image.data[i + 1] +
      0.0722 * image.data[i + 2]) * weight;
    halves[half].weight += weight;
  }
  if (!halves[0].weight || !halves[1].weight) return null;
  const north = halves[0].sum / halves[0].weight;
  const south = halves[1].sum / halves[1].weight;
  return { north, south, contrast: south - north };
}

function mirroredDifference(east, west) {
  if (east.width !== west.width || east.height !== west.height) return null;
  let sum = 0, count = 0, alphaMismatch = 0;
  for (let y = 0; y < east.height; y++) for (let x = 0; x < east.width; x++) {
    const a = imageAt(east, x, y), b = imageAt(west, east.width - 1 - x, y);
    const visibleA = east.data[a + 3] >= 128, visibleB = west.data[b + 3] >= 128;
    if (visibleA !== visibleB) { alphaMismatch++; continue; }
    if (!visibleA) continue;
    const luma = (data, i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += Math.abs(luma(east.data, a) - luma(west.data, b));
    count++;
  }
  return { meanLumaDelta: count ? sum / count : 0, alphaMismatch };
}

function edgeProblems(image, calibration) {
  let bleed = 0, matte = 0;
  const limit = calibration.edgeRgbDistance ?? 60;
  const mattes = calibration.matteColors ?? [];
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = imageAt(image, x, y), alpha = image.data[i + 3];
    if (alpha === 255) continue;
    let neighbor = -1, bestAlpha = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
      const j = imageAt(image, nx, ny), a = image.data[j + 3];
      if (a > bestAlpha) { bestAlpha = a; neighbor = j; }
    }
    if (neighbor < 0 || bestAlpha < 128) continue;
    const distance = Math.max(...[0, 1, 2].map((c) => Math.abs(image.data[i + c] - image.data[neighbor + c])));
    if (alpha === 0 && distance > limit) bleed++;
    if (alpha > 0 && alpha < 255 && bestAlpha >= 128 && distance > limit &&
      mattes.some((m) => m.length === 3 && Math.max(...[0, 1, 2].map((c) => Math.abs(image.data[i + c] - m[c]))) <= 16)) matte++;
  }
  return { bleed, matte };
}

function readPng(path, errors, label) {
  try { return decodePng(readFileSync(path)); }
  catch (e) { error(errors, 'png', `${label}: ${e.message}`); return null; }
}

function calibrationFor(spec, cwd, errors) {
  if (spec.mode === 'trial') return {};
  let c = spec.calibration;
  if (typeof c === 'string') {
    try { c = JSON.parse(readFileSync(resolve(cwd, c), 'utf8')); }
    catch (e) { error(errors, 'calibration', `Não foi possível ler calibração: ${e.message}`); return {}; }
  }
  if (c?.approved !== true || !Array.isArray(c.maxHueDegreesByRegion) || c.maxHueDegreesByRegion.length !== 3 ||
    !Array.isArray(c.maxLumaDeltaByRegion) || c.maxLumaDeltaByRegion.length !== 3 ||
    [...c.maxHueDegreesByRegion, ...c.maxLumaDeltaByRegion].some((n) => !Number.isFinite(n) || n < 0)) {
    error(errors, 'calibration', 'A folha de estilo aprovada deve fornecer três limites de matiz e luminância por região');
    return {};
  }
  if (typeof c.referencePath !== 'string' || !/^[a-f0-9]{64}$/i.test(c.referenceSha256 ?? '')) {
    error(errors, 'calibration', 'Informe caminho e SHA-256 da folha de estilo aprovada');
    return {};
  }
  try {
    const digest = createHash('sha256').update(readFileSync(resolve(cwd, c.referencePath))).digest('hex');
    if (digest.toLowerCase() !== c.referenceSha256.toLowerCase())
      error(errors, 'calibration', 'O hash da folha de estilo não corresponde à calibração');
  } catch (e) { error(errors, 'calibration', `Folha de estilo ausente: ${e.message}`); }
  return c;
}

function terrainPaths(spec, cwd) {
  if (spec.terrain) return Object.fromEntries(Object.entries(spec.terrain).map(([k, v]) => [k, resolve(cwd, v)]));
  const manifest = JSON.parse(readFileSync(resolve(cwd, 'assets/manifest.json'), 'utf8'));
  return Object.fromEntries(['grama', 'areia', 'rocha'].map((id) => {
    const entry = manifest.assets.find((a) => a.id === id && a.tipo === 'terreno');
    if (!entry?.estados?.padrao) throw new Error(`Manifesto sem terreno padrão: ${id}`);
    return [id, resolve(cwd, 'assets', entry.estados.padrao)];
  }));
}

function checkUnitCompleteness(spec, frames, errors) {
  if (spec.kind !== 'unit') return;
  if (spec.scope === 'sample' && spec.mode === 'trial') return;
  if (!Number.isFinite(spec.fps) || spec.fps < 10 || spec.fps > 12) error(errors, 'fps', 'Unidade requer 10–12 fps');
  if (!['civil', 'military', 'mercenary'].includes(spec.role)) error(errors, 'role', 'Classe da unidade ausente/inválida');
  const allowedStates = spec.role === 'civil' ? Object.keys(COUNTS) : Object.keys(COUNTS).filter((s) => s !== 'work');
  if (spec.scope === 'batch' && !allowedStates.includes(spec.state)) {
    error(errors, 'state', 'Lote requer um estado válido para a classe');
    return;
  }
  const states = spec.scope === 'batch' ? [spec.state] : allowedStates;
  if (spec.scope === 'batch' && frames.some((f) => f.meta.state !== spec.state)) {
    error(errors, 'state', 'Lote deve conter somente o estado declarado');
  }
  const requiredDirections = ['N', 'NE', 'E', 'SE', 'S'];
  for (const state of states) for (const dir of DIRECTIONS) {
    if (!requiredDirections.includes(dir) && !frames.some((f) => f.meta.state === state && f.meta.direction === dir)) continue;
    const indices = frames.filter((f) => f.meta.state === state && f.meta.direction === dir).map((f) => f.meta.index).sort((a, b) => a - b);
    if (indices.length !== COUNTS[state] || indices.some((n, i) => n !== i))
      error(errors, 'frames', `${state}/${dir}: esperados índices 0..${COUNTS[state] - 1}`);
  }
  if (frames.some((f) => !DIRECTIONS.includes(f.meta.direction))) error(errors, 'direction', 'Unidade contém direção inválida');
}

export function validateSpriteSpec(spec, { cwd = process.cwd(), outputDir } = {}) {
  const errors = [], warnings = [], frames = [], used = new Set();
  if (spec.mode === 'trial') warnings.push('Ensaio técnico sem calibração cromática; não equivale a aprovação');
  const calibration = calibrationFor(spec, cwd, errors);
  if (!Array.isArray(spec.frameSize) || spec.frameSize.length !== 2 || spec.frameSize.some((n) => !Number.isInteger(n) || n < 1))
    error(errors, 'size', 'frameSize inválido');
  if (!Array.isArray(spec.masterSize) || spec.masterSize.length !== 2 ||
    spec.masterSize[0] !== spec.frameSize?.[0] * 2 || spec.masterSize[1] !== spec.frameSize?.[1] * 2)
    error(errors, 'master-size', 'masterSize deve ser exatamente 2× frameSize');
  if (spec.kind === 'unit' && ![[64, 96], [96, 128]].some((s) => samePair(s, spec.frameSize)))
    error(errors, 'size', 'Unidade deve usar 64×96 ou 96×128');
  if (spec.kind === 'vegetation' && spec.id === 'tree' && !samePair(spec.frameSize, [192, 256]))
    error(errors, 'size', 'tree deve usar 192×256');
  if (!Array.isArray(spec.frames) || spec.frames.length === 0) error(errors, 'frames', 'Nenhum frame informado');
  for (const meta of spec.frames ?? []) {
    const key = `${meta.state}/${meta.direction}/${meta.index}`;
    if (used.has(key)) error(errors, 'frames', `Frame duplicado: ${key}`);
    used.add(key);
    if (spec.kind === 'building' && meta.direction !== 'front') error(errors, 'direction', 'Prédio: somente front tem consumidor');
    const path = resolve(cwd, meta.path ?? '');
    const image = readPng(path, errors, key);
    if (!image) continue;
    if (!samePair([image.width, image.height], spec.frameSize)) error(errors, 'size', `${key}: ${image.width}×${image.height}`);
    if (!Array.isArray(meta.pivot) || meta.pivot.length !== 2 || meta.pivot.some((n) => !Number.isFinite(n)))
      error(errors, 'pivot', `${key}: pivô ausente/inválido`);
    if (spec.kind === 'unit' && !samePair(meta.pivot, [0.5, 1])) error(errors, 'pivot', `${key}: pés devem usar [0.5,1]`);
    if (!meta.masterPath && (spec.kind === 'unit' || spec.id === 'tree')) error(errors, 'master', `${key}: master 2× ausente`);
    if (meta.masterPath) {
      const master = readPng(resolve(cwd, meta.masterPath), errors, `${key} master`);
      if (master && !samePair([master.width, master.height], spec.masterSize)) error(errors, 'master-size', `${key}: master ${master.width}×${master.height}`);
    }
    let mask = null;
    if (!meta.teamMask && spec.kind === 'unit' && spec.factional !== false) error(errors, 'team-mask', `${key}: máscara de time ausente`);
    if (meta.teamMask) {
      mask = readPng(resolve(cwd, meta.teamMask), errors, `${key} máscara`);
      if (mask && (mask.width !== image.width || mask.height !== image.height)) {
        error(errors, 'team-mask', `${key}: dimensões da máscara diferentes`); mask = null;
      } else if (mask) {
        let outside = 0, colored = 0, covered = 0;
        for (let i = 0; i < image.width * image.height; i++) {
          const p = i * 4;
          if (mask.data[p + 3] === 0) continue;
          if (mask.data[p + 3] >= 128) covered++;
          if (image.data[p + 3] === 0) outside++;
          if (Math.max(mask.data[p], mask.data[p + 1], mask.data[p + 2]) -
              Math.min(mask.data[p], mask.data[p + 1], mask.data[p + 2]) > 2) colored++;
        }
        if (outside) error(errors, 'team-mask', `${key}: ${outside} pixels fora do alfa base`);
        if (colored) error(errors, 'team-mask', `${key}: ${colored} pixels não são cinza`);
        if (spec.kind === 'unit' && spec.factional !== false && covered < 48) {
          error(errors, 'team-mask-area', `${key}: máscara cobre ${covered} pixels, mínimo 48 no derivado`);
        }
      }
    }
    const bounds = visibleBounds(image);
    if (!bounds) error(errors, 'alpha', `${key}: sem pixels com alfa ≥128`);
    const stats = bounds ? colorStats(image, mask, bounds) : { centroidX: null, regions: [] };
    const light = bounds ? lightStats(image, mask, bounds) : null;
    if (light && !['terrain', 'road'].includes(spec.kind) && light.contrast < -(spec.light?.inversionTolerance ?? 0.5)) {
      error(errors, 'light-direction', `${key}: luz sul invertida (Δ=${light.contrast.toFixed(1)})`);
    }
    const edge = edgeProblems(image, calibration);
    if (edge.bleed) error(errors, 'alpha-bleed', `${key}: ${edge.bleed} pixels transparentes de borda sem bleed`);
    if (edge.matte) error(errors, 'matte-fringe', `${key}: ${edge.matte} pixels de franja de fundo`);
    frames.push({ meta, image, footline: bounds?.y1 ?? null, centroidX: stats.centroidX, regions: stats.regions, light });
  }
  checkUnitCompleteness(spec, frames, errors);
  if (spec.kind === 'unit') {
    const maxAdjacentDelta = spec.light?.maxAdjacentDelta ?? 32;
    for (const frame of frames) {
      const position = DIRECTIONS.indexOf(frame.meta.direction);
      if (position < 0 || !frame.light) continue;
      const neighbor = frames.find((candidate) =>
        candidate.meta.state === frame.meta.state &&
        candidate.meta.index === frame.meta.index &&
        candidate.meta.direction === DIRECTIONS[(position + 1) % DIRECTIONS.length]);
      if (neighbor?.light &&
          Math.abs(frame.light.contrast - neighbor.light.contrast) > maxAdjacentDelta) {
        error(errors, 'light-neighbor', `${frame.meta.state}/${frame.meta.index}: ${frame.meta.direction}→${neighbor.meta.direction} muda contraste de luz em mais de ${maxAdjacentDelta}`);
      }
    }
  }
  if (spec.kind === 'unit') {
    for (const [east, west] of [['E', 'W'], ['NE', 'NW'], ['SE', 'SW']]) {
      for (const source of frames.filter((f) => f.meta.direction === east)) {
        const mirrored = frames.find((f) => f.meta.direction === west &&
          f.meta.state === source.meta.state && f.meta.index === source.meta.index);
        if (!mirrored) continue; // O render pode derivar oeste com flipX.
        const diff = mirroredDifference(source.image, mirrored.image);
        if (!diff || diff.meanLumaDelta > (spec.light?.maxMirroredLumaDelta ?? 12) ||
          diff.alphaMismatch > (spec.light?.maxMirrorAlphaMismatch ?? 1)) {
          error(errors, 'light-mirror', `${source.meta.state}/${source.meta.index}: ${east} e ${west} divergem sob espelho`);
        }
      }
    }
  }
  if (frames.length > 1) {
    const pivot = frames[0].meta.pivot;
    for (const f of frames.slice(1)) if (!samePair(f.meta.pivot, pivot)) error(errors, 'pivot', `${f.meta.state}/${f.meta.direction}/${f.meta.index}: pivô varia`);
    const feet = frames.filter((f) => ['idle', 'walk', 'attack'].includes(f.meta.state) && f.footline !== null).map((f) => f.footline).sort((a, b) => a - b);
    if (feet.length) {
      const median = feet[Math.floor(feet.length / 2)];
      for (const f of frames) if (['idle', 'walk', 'attack'].includes(f.meta.state) && f.footline !== null && Math.abs(f.footline - median) > 1)
        error(errors, 'footline', `${f.meta.state}/${f.meta.direction}/${f.meta.index}: pé em y=${f.footline}, mediana=${median}`);
    }
    for (const dir of new Set(frames.map((f) => f.meta.direction))) {
      const idle = frames.filter((f) => f.meta.state === 'idle' && f.meta.direction === dir).sort((a, b) => a.meta.index - b.meta.index);
      for (let i = 1; i < idle.length; i++) if (idle[i].centroidX !== null && idle[i - 1].centroidX !== null &&
        Math.abs(idle[i].centroidX - idle[i - 1].centroidX) > 2)
        error(errors, 'idle-jitter', `${dir}: quadros ${idle[i - 1].meta.index}→${idle[i].meta.index}`);
    }
  for (const f of frames.filter((x) => spec.mode !== 'trial' && x.meta.direction !== 'S')) {
      const ref = frames.find((x) => x.meta.state === f.meta.state && x.meta.direction === 'S' && x.meta.index === f.meta.index);
      if (!ref) { if (spec.kind === 'unit') error(errors, 'color-reference', `${f.meta.state}/S/${f.meta.index} ausente`); continue; }
      for (let i = 0; i < 3; i++) {
        const a = f.regions[i], b = ref.regions[i];
        if (!a || !b || a.luma === null || b.luma === null) continue;
        const dl = Math.abs(a.luma - b.luma);
        if (Number.isFinite(calibration.maxLumaDeltaByRegion?.[i]) && dl > calibration.maxLumaDeltaByRegion[i])
          error(errors, 'color-luma', `${f.meta.state}/${f.meta.direction}/${f.meta.index} ${REGIONS[i]}: Δ=${dl.toFixed(1)}`);
        if (a.hue !== null && b.hue !== null) {
          const dh = Math.abs(a.hue - b.hue), circular = Math.min(dh, 360 - dh);
          if (Number.isFinite(calibration.maxHueDegreesByRegion?.[i]) && circular > calibration.maxHueDegreesByRegion[i])
            error(errors, 'color-hue', `${f.meta.state}/${f.meta.direction}/${f.meta.index} ${REGIONS[i]}: Δ=${circular.toFixed(1)}°`);
        }
      }
    }
  }
  let contactSheets = [];
  if (outputDir && frames.length) {
    try {
      const paths = terrainPaths(spec, cwd);
      const terrains = Object.fromEntries(Object.entries(paths).map(([id, p]) => [id, decodePng(readFileSync(p))]));
      contactSheets = renderContactSheets(frames, terrains, outputDir);
    } catch (e) { error(errors, 'contact-sheet', e.message); }
  }
  const report = {
    id: spec.id, kind: spec.kind, mode: spec.mode ?? 'calibrated',
    approved: false, success: errors.length === 0, errors, warnings,
    frames: frames.map((f) => ({ state: f.meta.state, direction: f.meta.direction, index: f.meta.index,
      path: f.meta.path, footline: f.footline, centroidX: f.centroidX, regions: f.regions })), contactSheets,
  };
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [specPath, outputDir] = process.argv.slice(2);
  if (!specPath || !outputDir) {
    console.error('uso: node validate-sprites.mjs <spec.json> <diretorio-saida>');
    process.exitCode = 2;
  } else {
    try {
      const report = validateSpriteSpec(JSON.parse(readFileSync(resolve(specPath), 'utf8')), { outputDir: resolve(outputDir) });
      console.log(JSON.stringify({ success: report.success, errors: report.errors, contactSheets: report.contactSheets }, null, 2));
      if (!report.success) process.exitCode = 1;
    } catch (e) { console.error(e.stack ?? String(e)); process.exitCode = 2; }
  }
}
