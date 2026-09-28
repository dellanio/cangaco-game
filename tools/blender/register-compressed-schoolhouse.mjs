import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const project = process.cwd();
const manifestPath = path.join(project, 'assets', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const asset = manifest.assets.find((entry) => entry.tipo === 'predio' && entry.id === 'schoolhouse');

if (!asset) throw new Error('schoolhouse ausente do manifesto');

asset.tamanho = [214, 240];
asset.anchor = [0.5, 0.875];
asset.origem = {
  base: 'base/schoolhouse/schoolhouse_blender_compressed_premium_v3.png',
  semente: null,
  nota: 'Casa do Coronel sobrado 3x3 frontal. O telhado nao foi achatado: uma faixa interna de cada agua foi removida e as bordas originais foram reunidas, preservando inclinacao visual, tamanho das telhas, cumeeira, diagonais e beiral. A escada foi encurtada sem escalar a fachada. Madeira e completo usam o mesmo recorte. Saida 214x240; anchor [0.5,0.875] assenta o piso da varanda e reserva somente o acesso compacto abaixo do lote.',
};

const icon = manifest.icones?.predios?.schoolhouse;
if (icon) {
  icon.licenca = 'arte propria do projeto, modelada no Blender para o projeto em 2026-09-27';
  icon.origem = {
    base: asset.origem.base,
    semente: null,
    nota: 'Derivado do sprite completo comprimido da Schoolhouse.',
  };
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
