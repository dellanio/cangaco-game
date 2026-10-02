// A porta de entrada da pagina. So pergunta pelo WebGL (`render/webgl.ts`) e, com ele,
// carrega `main.ts`, que monta o jogo inteiro. Sem WebGL, `main.ts` nunca roda: nem o
// Phaser.Game, nem o HUD pela metade.
import { iniciarSeHouverWebgl } from './render/webgl';
import { depuracaoDeUnidade } from './render/animacao-de-unidade';
import { registrarDepuracao } from './render/registro-de-depuracao';

void iniciarSeHouverWebgl(document, async () => {
  if (depuracaoDeUnidade(window.location.search)) {
    const modulo = await import('./render/depuracao-de-unidade');
    registrarDepuracao({ manifesto: modulo.manifestoDeDepuracao, atlas: modulo.atlasDeDepuracao });
  }
  return new URLSearchParams(window.location.search).get('vitrine') === 'serf'
    ? import('./render/vitrine-serf') : import('./main');
});
