// A porta de entrada da pagina. So pergunta pelo WebGL (`render/webgl.ts`) e, com ele,
// carrega `main.ts`, que monta o jogo inteiro. Sem WebGL, `main.ts` nunca roda: nem o
// Phaser.Game, nem o HUD pela metade.
//
// E-TELA-MENU-INICIAL — sem parametro na URL, o menu vem antes: o `main.ts` (e com ele o
// Phaser) so e importado depois da escolha. Com parametro, o jogo direto, como antes
// (`escolha-da-partida.ts`).
import { iniciarSeHouverWebgl } from './render/webgl';
import { depuracaoDeUnidade, tiposDeDepuracao, chaveDoAtlas } from './render/animacao-de-unidade';
import { registrarDepuracao } from './render/registro-de-depuracao';
import { abreNoMenu, escolhaDaUrl, estadoDaEscolha, estadoNovo } from './escolha-da-partida';
import type { EscolhaDaPartida } from './escolha-da-partida';
import { lerUltimoSave } from './arquivo-da-partida';
import type { Gaveta } from './arquivo-da-partida';
import { montarMenuInicial } from './ui/menu-inicial';
import type { SituacaoDoSave } from './ui/menu-inicial';
import { montarAjuda } from './ui/ajuda';
import type { Ajuda } from './ui/ajuda';

/** O `localStorage`, ou `null` quando o navegador o bloqueia (o acesso pode lancar). */
function gavetaDoNavegador(): Gaveta | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Carrega o jogo com a partida escolhida. A ajuda do menu, se ja nasceu, segue para o jogo. */
async function jogar(escolha: EscolhaDaPartida, ajuda: Ajuda | null): Promise<void> {
  const gaveta = gavetaDoNavegador();
  const partida = estadoDaEscolha(escolha, gaveta);
  // o menu so oferece o Continuar que abre; se o save sumiu entre o menu e o clique, o jogo livre
  const estado = partida.ok ? partida.estado : estadoNovo('livre');
  const modulo = await import('./main');
  modulo.iniciarPartida(estado, ajuda);
}

function situacaoDoSave(): SituacaoDoSave {
  const leitura = lerUltimoSave(gavetaDoNavegador());
  return leitura.ok ? { pronto: true, tick: leitura.estado.tick } : { pronto: false, causa: leitura.causa, detalhe: leitura.detalhe };
}

function abrirMenu(): Promise<void> {
  return new Promise((pronto) => {
    let ajuda: Ajuda | null = null;
    function aoTeclar(evento: KeyboardEvent): void {
      if (evento.key === 'Escape' && ajuda?.fechar() === true) evento.preventDefault();
    }
    window.addEventListener('keydown', aoTeclar);
    const menu = montarMenuInicial(situacaoDoSave(), (escolha) => {
      window.removeEventListener('keydown', aoTeclar);
      ajuda?.fechar();
      menu.fechar();
      void jogar(escolha, ajuda).then(pronto);
    }, () => {
      ajuda ??= montarAjuda();
      ajuda.alternar();
    });
  });
}

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
  if (tiposDeDepuracao(window.location.search).includes(new URLSearchParams(window.location.search).get('vitrine') ?? '')) {
    return import('./render/vitrine-serf');
  }
  if (abreNoMenu(window.location.search)) return abrirMenu();
  return jogar(escolhaDaUrl(window.location.search), null);
});
