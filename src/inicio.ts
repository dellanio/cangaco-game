// A porta de entrada da pagina. So pergunta pelo WebGL (`render/webgl.ts`) e, com ele,
// carrega `main.ts`, que monta o jogo inteiro. Sem WebGL, `main.ts` nunca roda: nem o
// Phaser.Game, nem o HUD pela metade.
import { iniciarSeHouverWebgl } from './render/webgl';

void iniciarSeHouverWebgl(document, () => new URLSearchParams(window.location.search).get('vitrine') === 'serf'
  ? import('./render/vitrine-serf') : import('./main'));
