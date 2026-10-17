// I-ARTE-PARADO-RESPIRA-NAS-24-UNIDADES — baixa os quadros de uma animacao do PixelLab para a pasta que o
// tools/pixellab-atlas.mjs le (<pasta>/<anim>/<direcao-do-pixellab>/<i>.png).
// Uso: node tools/pixellab-baixar.mjs <pasta> <anim> <quadros> <direcao>=<url-com-{i}> [<direcao>=<url-com-{i}> ...]
// A url e a que o get_character devolve, com {i} no lugar do numero do quadro.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';

const { fetch } = globalThis;

const [pasta, anim, quadrosTexto, ...pares] = process.argv.slice(2);
const quadros = Number(quadrosTexto);
for (const par of pares) {
  const corte = par.indexOf('=');
  const direcao = par.slice(0, corte), url = par.slice(corte + 1);
  const destino = join(pasta, anim, direcao);
  mkdirSync(destino, { recursive: true });
  for (let i = 0; i < quadros; i++) {
    const resposta = await fetch(url.replace('{i}', String(i)));
    if (!resposta.ok) throw new Error(`${direcao} ${i}: HTTP ${resposta.status}`);
    writeFileSync(join(destino, `${i}.png`), Buffer.from(await resposta.arrayBuffer()));
  }
  console.log(`${anim}/${direcao}: ${quadros} quadros`);
}
