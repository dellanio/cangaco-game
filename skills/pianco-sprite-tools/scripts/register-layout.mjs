import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';

function fail(message) {
  throw new Error(`pianco-sprite-tools: ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function dimensionOfPng(path) {
  const bytes = readFileSync(resolve(path));
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') fail(`${path} nao e PNG valido`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function assetPath(path) {
  return relative(resolve('assets'), resolve(path)).replaceAll('\\', '/');
}

const [kind, ...layoutPaths] = process.argv.slice(2);
if (!['predio', 'unidade', 'recurso'].includes(kind) || layoutPaths.length === 0) {
  fail('uso: node register-layout.mjs <predio|unidade|recurso> <layout...>');
}

const layouts = layoutPaths.map((path) => readJson(path));
const cells = layouts.flatMap((layout) => layout.cells.map((cell) => ({
  ...cell,
  base: assetPath(layout.source),
})));
const buildings = new Map(readJson('data/buildings.json').predios.map((item) => [item.id, item]));
const unitsJson = readJson('data/units.json');
const directions = new Map();
for (const group of Object.values(unitsJson)) {
  if (!group || typeof group !== 'object' || !Array.isArray(group.tipos)) continue;
  const common = group._comum?.direcoesDeSprite ?? null;
  for (const item of group.tipos) directions.set(item.id, item.direcoesDeSprite ?? common);
}

const entries = cells.map((cell) => {
  const output = assetPath(cell.output);
  const size = dimensionOfPng(cell.output);
  const origin = {
    base: cell.base,
    semente: null,
    nota: `Derivado pela skill pianco-sprite-tools do layout ${cell.id}.`,
  };
  if (kind === 'predio') {
    const building = buildings.get(cell.id);
    if (!building) fail(`predio desconhecido: ${cell.id}`);
    return {
      id: cell.id, tipo: 'predio', footprint: building.tamanho, tamanho: size,
      anchor: [0.5, 1], estados: { completo: output },
      licenca: 'arte propria do projeto, gerada para o projeto em 2026-09-26', origem: origin,
    };
  }
  if (kind === 'unidade') {
    const n = directions.get(cell.id) ?? null;
    if (n !== 4 && n !== 8) fail(`unidade sem direcoesDeSprite: ${cell.id}`);
    const dirs = n === 4 ? ['n', 'l', 's'] : ['n', 'ne', 'l', 'se', 's'];
    return {
      id: cell.id, tipo: 'unidade', footprint: [1, 1], tamanho: size,
      anchor: [0.5, 1],
      estados: Object.fromEntries(dirs.map((dir) => [`parado:${dir}`, output])),
      licenca: 'arte propria do projeto, gerada para o projeto em 2026-09-26', origem: origin,
    };
  }
  return {
    id: cell.id, tipo: 'recurso', footprint: [1, 1], tamanho: size,
    anchor: [0.5, 1], estados: { presente: output },
    licenca: 'arte propria do projeto, gerada para o projeto em 2026-09-26', origem: origin,
  };
});

const manifestPath = resolve('assets/manifest.json');
const manifest = readJson(manifestPath);
const replacements = new Map(entries.map((entry) => [`${entry.tipo}:${entry.id}`, entry]));
for (const previous of manifest.assets) {
  const replacement = replacements.get(`${previous.tipo}:${previous.id}`);
  if (!replacement) continue;
  const droppedStates = Object.keys(previous.estados ?? {}).filter(
    (state) => !(state in replacement.estados),
  );
  const specialAnchor = JSON.stringify(previous.anchor) !== JSON.stringify(replacement.anchor);
  if (droppedStates.length || specialAnchor) {
    fail(`${previous.tipo}:${previous.id}: registro recusado; preservação manual necessária (estados: ${droppedStates.join(', ') || 'nenhum'}, anchor especial: ${specialAnchor})`);
  }
}
const kept = manifest.assets.filter((entry) => !replacements.has(`${entry.tipo}:${entry.id}`));
manifest.assets = [...kept, ...entries];
if (kind === 'predio') {
  manifest.icones ??= {};
  manifest.icones.predios ??= {};
  for (const cell of cells) {
    const icon = resolve(`assets/sprites/${cell.id}/icone.png`);
    mkdirSync(dirname(icon), { recursive: true });
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(cell.output),
      '-vf', 'scale=72:72:force_original_aspect_ratio=decrease:flags=lanczos,pad=72:72:(ow-iw)/2:(oh-ih):color=0x00000000',
      icon,
    ], { stdio: 'inherit' });
    manifest.icones.predios[cell.id] = {
      arquivo: assetPath(icon),
      tamanho: [72, 72],
      licenca: 'arte propria do projeto, gerada para o projeto em 2026-09-26',
      origem: { base: cell.base, semente: null, nota: 'Derivado do sprite completo pela skill pianco-sprite-tools.' },
    };
  }
  for (const entry of manifest.assets.filter((item) => item.tipo === 'predio')) {
    if (manifest.icones.predios[entry.id] || !entry.estados.completo) continue;
    const icon = resolve(`assets/sprites/${entry.id}/icone.png`);
    mkdirSync(dirname(icon), { recursive: true });
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve('assets', entry.estados.completo),
      '-vf', 'scale=72:72:force_original_aspect_ratio=decrease:flags=lanczos,pad=72:72:(ow-iw)/2:(oh-ih):color=0x00000000',
      icon,
    ], { stdio: 'inherit' });
    manifest.icones.predios[entry.id] = {
      arquivo: assetPath(icon), tamanho: [72, 72], licenca: entry.licenca,
      origem: { base: entry.origem.base, semente: null, nota: 'Derivado do sprite completo pela skill pianco-sprite-tools.' },
    };
  }
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${kind}: ${entries.length} entrada(s) registradas em assets/manifest.json\n`);
