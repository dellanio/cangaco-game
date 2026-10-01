'use strict';
// Roteiro da D-TELA-CAPTURA-DETERMINISTICA — aceite 1: a `fixarCamera` da ponte (harness) poe o scroll
// pedido, e a camera lida pela ponte devolve o mesmo valor. Os eixos sao independentes: pedir so o
// `scrollY` nao mexe no `scrollX`. Os alvos sao derivados do mapa e do canvas (dentro dos limites da
// camera), sem coordenada absoluta. Sem clique em painel: a regra do passo despausado (§8) nao se
// aplica.
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const { retanguloDoCanvas } = require('./_canvas');

const TILE_PX = terreno.tile_px;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // a ponte publica a camera no quadro seguinte
  const fixar = (scroll) => page.evaluate((s) => window.__cangaco.fixarCamera(s), scroll);

  const s0 = await estado();
  afirmar(typeof s0.camera.scrollX === 'number', `a ponte deveria publicar a camera: ${JSON.stringify(s0.camera)}`);
  // dentro dos limites: a camera tem bounds no tamanho do mapa em px, e o maximo e o mapa menos o vao
  const maxX = mapa.largura * TILE_PX - canvas.width;
  const maxY = mapa.altura * TILE_PX - canvas.height;
  afirmar(maxX > 0 && maxY > 0, `o mapa deveria ser maior que o canvas (maxX ${maxX}, maxY ${maxY})`);
  const alvo = { scrollX: Math.round(maxX / 3), scrollY: Math.round(maxY / 4) };
  afirmar(alvo.scrollX !== s0.camera.scrollX && alvo.scrollY !== s0.camera.scrollY,
    `o alvo deveria ser diferente de onde a camera abriu (${JSON.stringify(s0.camera)})`);

  // 1. os dois eixos de uma vez
  await fixar(alvo);
  await esperarFrame();
  let s = await estado();
  afirmar(s.camera.scrollX === alvo.scrollX && s.camera.scrollY === alvo.scrollY,
    `a camera deveria estar em ${JSON.stringify(alvo)}, veio ${JSON.stringify(s.camera)}`);

  // 2. so um eixo: o outro fica onde estava
  const soY = Math.round(maxY / 2);
  await fixar({ scrollY: soY });
  await esperarFrame();
  s = await estado();
  afirmar(s.camera.scrollY === soY && s.camera.scrollX === alvo.scrollX,
    `pedir so o scrollY (${soY}) nao deveria mexer no scrollX (${alvo.scrollX}); veio ${JSON.stringify(s.camera)}`);

  // 3. e fica parada: dois quadros depois, o mesmo lugar (nada a puxa de volta)
  await esperarFrame();
  await esperarFrame();
  const depois = await estado();
  afirmar(depois.camera.scrollX === s.camera.scrollX && depois.camera.scrollY === s.camera.scrollY,
    `a camera deveria ficar onde foi posta; antes ${JSON.stringify(s.camera)}, depois ${JSON.stringify(depois.camera)}`);
  await capturar('camera-fixada');
}

module.exports = { roteiro };
