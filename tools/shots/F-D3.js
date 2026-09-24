'use strict';

// Roteiro da F-D3 — A ABERTURA MOSTRA PAISAGEM, SEM O JOGADOR PROCURAR.
//
// O aceite 1 do item e uma MEDIDA, nao uma descricao: no retangulo visivel da
// camera inicial aparecem pelo menos tres tipos de terreno e dois tipos de
// recurso. Antes desta feature eram um e um — a faixa `LIVRE_A_PARTIR_DE`
// mantinha 31,6% do mapa em grama lisa, e o lago ficava a 4,5 km da vila.
//
// Por isso este roteiro nao anda com a camera em nenhum momento: o que ele mede
// e o QUADRO DE ABERTURA, tal como o jogador o recebe. Andar ate a paisagem
// provaria que ela existe em algum lugar, que nunca foi o problema.
//
// As duas contagens saem do estado publicado pela cena (CLAUDE.md §8), e sao
// conferidas contra `data/maps/sertao-128.json` — o mesmo arquivo que alimenta
// a simulacao. Nenhuma coordenada de paisagem esta digitada aqui: se o gerador
// mudar de geografia, este roteiro acompanha sozinho.

const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');

const TILE_PX = terreno.tile_px;

// O TIPO PRESENTE e a chave com contagem MAIOR QUE ZERO, e isso nao e detalhe:
// `contarTerrenoVisivel` e `atualizarRecursos` (`WorldScene.ts`) zeram TODO tipo
// conhecido antes de contar, para o roteiro poder afirmar `agua === 0` sem se
// preocupar com chave ausente. Logo `Object.keys(...).length` e constante e nao
// mede nada: contar chave daria 6 terrenos numa tela inteira de grama, e o
// aceite passaria sozinho. Medido ao escrever este roteiro, nao suposto.
//
// `esgotado` sai fora tambem: e ESTADO de recurso, nao tipo — a cena o publica
// na mesma contagem para a F-T2a poder afirmar que nada nasce esgotado.
const presentes = (contagem, ignorar = []) => Object.keys(contagem)
  .filter((k) => !ignorar.includes(k) && contagem[k] > 0);

/** O retangulo de MUNDO exibido, em pixel, com a origem 0.5 do Phaser. */
function mundoVisivel(canvas, camera) {
  const meioX = canvas.width / 2;
  const meioY = canvas.height / 2;
  return {
    x0: camera.scrollX + meioX - meioX / camera.zoom,
    x1: camera.scrollX + meioX + meioX / camera.zoom,
    y0: camera.scrollY + meioY - meioY / camera.zoom,
    y1: camera.scrollY + meioY + meioY / camera.zoom,
  };
}

/** Duas listas de tipos, e nao uma: `dentro` so junta o tile inteiramente
 *  dentro do quadro, `tocando` junta tambem o que a borda corta. A cena desenha
 *  tile parcial, entao afirmar uma so seria afirmar sobre arredondamento de
 *  borda em vez de sobre a paisagem. O aceite fica entre as duas: tudo que esta
 *  inteiro dentro TEM de aparecer, e nada pode aparecer sem ao menos tocar. */
function tiposDoArquivo(vista) {
  const terrenoDentro = new Set();
  const terrenoTocando = new Set();
  const recursoDentro = new Set();
  const recursoTocando = new Set();

  const marcar = (tipo, gx, gy, dentro, tocando) => {
    const x0 = gx * TILE_PX;
    const y0 = gy * TILE_PX;
    if (x0 + TILE_PX <= vista.x1 && x0 >= vista.x0 && y0 + TILE_PX <= vista.y1 && y0 >= vista.y0) {
      dentro.add(tipo);
    }
    if (x0 + TILE_PX > vista.x0 && x0 < vista.x1 && y0 + TILE_PX > vista.y0 && y0 < vista.y1) {
      tocando.add(tipo);
    }
  };

  const gx0 = Math.max(0, Math.floor(vista.x0 / TILE_PX));
  const gx1 = Math.min(mapa.largura - 1, Math.ceil(vista.x1 / TILE_PX));
  const gy0 = Math.max(0, Math.floor(vista.y0 / TILE_PX));
  const gy1 = Math.min(mapa.altura - 1, Math.ceil(vista.y1 / TILE_PX));
  for (let gy = gy0; gy <= gy1; gy += 1) {
    for (let gx = gx0; gx <= gx1; gx += 1) {
      marcar(mapa.legenda[mapa.linhas[gy][gx]], gx, gy, terrenoDentro, terrenoTocando);
    }
  }
  for (const [tipo, tiles] of Object.entries(mapa.recursos)) {
    for (const [gx, gy] of tiles) marcar(tipo, gx, gy, recursoDentro, recursoTocando);
  }
  return { terrenoDentro, terrenoTocando, recursoDentro, recursoTocando };
}

async function roteiro(ctx) {
  const { capturar, estado, afirmar, page } = ctx;

  const canvas = await retanguloDoCanvas(page);
  const s = await estado();

  // ---- 0. o quadro e mesmo o de abertura -----------------------------------
  // Se o roteiro tivesse andado com a camera, a medida abaixo nao seria sobre o
  // aceite. A afirmacao existe para que um passo acrescentado por engano no
  // futuro reprove aqui, e nao silenciosamente passe a medir outra vista.
  afirmar(
    s.tick === 0,
    `a medida do aceite 1 e no tick 0, com a camera onde a cena a poe; veio tick ${s.tick}`,
  );

  // ---- 1. tres terrenos e dois recursos, medidos do estado ------------------
  const terrenos = presentes(s.terrenoVisivel);
  const recursos = presentes(s.recursosVisiveis, ['esgotado']);
  afirmar(
    terrenos.length >= 3,
    `a abertura deveria mostrar ao menos 3 tipos de terreno, veio ${terrenos.length}: `
      + `${JSON.stringify(s.terrenoVisivel)}`,
  );
  afirmar(
    recursos.length >= 2,
    `a abertura deveria mostrar ao menos 2 tipos de recurso, veio ${recursos.length}: `
      + `${JSON.stringify(s.recursosVisiveis)}`,
  );

  // ---- 2. e e a paisagem do ARQUIVO, nao um enfeite da cena -----------------
  const vista = mundoVisivel(canvas, s.camera);
  const doArquivo = tiposDoArquivo(vista);
  for (const tipo of doArquivo.terrenoDentro) {
    afirmar(
      terrenos.includes(tipo),
      `o mapa poe '${tipo}' inteiro dentro do quadro de abertura e a cena nao o desenhou: `
        + `${JSON.stringify(s.terrenoVisivel)}`,
    );
  }
  for (const tipo of terrenos) {
    afirmar(
      doArquivo.terrenoTocando.has(tipo),
      `a cena desenhou terreno '${tipo}' que o arquivo de mapa nao poe nesta vista`,
    );
  }
  for (const tipo of doArquivo.recursoDentro) {
    afirmar(
      recursos.includes(tipo),
      `o mapa poe recurso '${tipo}' inteiro dentro do quadro de abertura e a cena nao o `
        + `desenhou: ${JSON.stringify(s.recursosVisiveis)}`,
    );
  }
  for (const tipo of recursos) {
    afirmar(
      doArquivo.recursoTocando.has(tipo),
      `a cena desenhou recurso '${tipo}' que o arquivo de mapa nao poe nesta vista`,
    );
  }

  await capturar('abertura');

  // ---- 3. a vila nasce em chao construivel ---------------------------------
  // A guarda de verdade do aceite 2 e headless e roda no `npm run verify`
  // (`tests/F-D3-geografia.test.ts`), tile a tile e pelo predicado do runtime.
  // Aqui fica so o que depende do jogo vivo: o prédio inicial esta de pe na
  // cena, e nenhum erro de colocacao foi publicado na abertura.
  const predios = Object.values(s.prediosDoEstado || {});
  afirmar(
    predios.length > 0,
    `a vila inicial deveria estar de pe na abertura, veio ${JSON.stringify(s.prediosDoEstado)}`,
  );
}

module.exports = { roteiro };
