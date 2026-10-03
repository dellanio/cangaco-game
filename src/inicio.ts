// A porta de entrada da pagina. So pergunta pelo WebGL (`render/webgl.ts`) e, com ele,
// carrega `main.ts`, que monta o jogo inteiro. Sem WebGL, `main.ts` nunca roda: nem o
// Phaser.Game, nem o HUD pela metade.
import { iniciarSeHouverWebgl } from './render/webgl';
import { depuracaoDeUnidade, tiposDeDepuracao, chaveDoAtlas } from './render/animacao-de-unidade';
import { registrarDepuracao } from './render/registro-de-depuracao';

void iniciarSeHouverWebgl(document, async () => {
  if (depuracaoDeUnidade(window.location.search)) {
    const modulo = await import('./render/depuracao-de-unidade');
    const tipos = tiposDeDepuracao(window.location.search);
    registrarDepuracao({ manifesto: { ...modulo.manifestoDeDepuracao,
      assets: modulo.manifestoDeDepuracao.assets.filter((a) => tipos.includes(a.id)) },
      atlas: modulo.atlasDeDepuracao,
      atlases: modulo.atlasesDeDepuracao.filter((a) => tipos.some((id) => a.chave === chaveDoAtlas(id))),
    });
  }
  return tiposDeDepuracao(window.location.search).includes(new URLSearchParams(window.location.search).get('vitrine') ?? '')
    ? import('./render/vitrine-serf') : import('./main');
});
