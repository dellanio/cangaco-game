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
import { abreNoMenu, escolhaDaUrl, estadoDaEscolha, estadoNovo, opcoesDeNivelNaTela, opcoesDePazNaTela } from './escolha-da-partida';
import type { EscolhaDaPartida } from './escolha-da-partida';
import { lerGavetas, lerUltimoSave } from './arquivo-da-partida';
import type { Gaveta } from './arquivo-da-partida';
import { montarMenuInicial } from './ui/menu-inicial';
import type { SituacaoDoSave } from './ui/menu-inicial';
import { montarAjuda } from './ui/ajuda';
import { montarCarregamento } from './ui/carregamento';
import type { Ajuda } from './ui/ajuda';
import { montarOpcoesDeSom } from './ui/opcoes-de-som';
import type { OpcoesDeSom } from './ui/opcoes-de-som';
import { criarPreferenciasVivas } from './preferencias-de-som';
import type { PreferenciasVivas, VolumePadrao } from './preferencias-de-som';
import { criarDicasVivas } from './preferencias-de-dicas';
import type { DicasVivas } from './preferencias-de-dicas';
import tabelaDeSom from '../data/som.json';

/** O `localStorage`, ou `null` quando o navegador o bloqueia (o acesso pode lancar). */
function gavetaDoNavegador(): Gaveta | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** H-TELA-OPCOES-E-VOLUME — o volume do jogador e a caixa que o muda, uma vez por pagina: o menu
 *  e o jogo usam os mesmos. */
let som: { readonly preferencias: PreferenciasVivas; readonly opcoes: OpcoesDeSom; readonly dicas: DicasVivas } | null = null;
function somDaPagina(): { readonly preferencias: PreferenciasVivas; readonly opcoes: OpcoesDeSom; readonly dicas: DicasVivas } {
  if (som !== null) return som;
  const preferencias = criarPreferenciasVivas(gavetaDoNavegador(), tabelaDeSom.volumePadrao as VolumePadrao);
  // I-TELA-DICAS-NA-PRIMEIRA-VEZ: a chave das dicas mora na mesma caixa de Opcoes
  const dicas = criarDicasVivas(gavetaDoNavegador());
  som = {
    preferencias,
    dicas,
    opcoes: montarOpcoesDeSom(preferencias.atual, (p) => { preferencias.mudar(p); }, { ligadas: dicas.atual.ligadas, aoMudar: (l) => { dicas.ligar(l); } }),
  };
  return som;
}

/** Carrega o jogo com a partida escolhida. A ajuda do menu, se ja nasceu, segue para o jogo. */
async function jogar(escolha: EscolhaDaPartida, ajuda: Ajuda | null): Promise<void> {
  const gaveta = gavetaDoNavegador();
  const partida = estadoDaEscolha(escolha, gaveta);
  // o menu so oferece o save que abre; se ele sumiu entre o menu e o clique, o jogo livre
  const estado = partida.ok ? partida.estado : estadoNovo({ modo: 'livre' });
  // E-ENTREGA-BUILD: a tela de carregamento nasce antes de o `main.ts` (e o Phaser) chegar
  const carregamento = montarCarregamento();
  const modulo = await import('./main');
  const { preferencias, opcoes, dicas } = somDaPagina();
  opcoes.fechar();
  modulo.iniciarPartida(estado, ajuda, carregamento, preferencias, opcoes, escolha.modo === 'guiada', dicas);
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
    const menu = montarMenuInicial(situacaoDoSave(), lerGavetas(gavetaDoNavegador()), opcoesDePazNaTela(), opcoesDeNivelNaTela(), (escolha) => {
      window.removeEventListener('keydown', aoTeclar);
      ajuda?.fechar();
      menu.fechar();
      void jogar(escolha, ajuda).then(pronto);
    }, () => {
      ajuda ??= montarAjuda();
      ajuda.alternar();
    }, () => {
      somDaPagina().opcoes.abrir();
    });
  });
}

// E-ENTREGA-BUILD: a depuracao e a vitrine sao do dev server. No `npm run build` o `DEV` e falso,
// os dois `import()` saem como codigo morto, e as paginas de depuracao nao entram no `dist/`.
void iniciarSeHouverWebgl(document, async () => {
  if (import.meta.env.DEV && depuracaoDeUnidade(window.location.search)) {
    const modulo = await import('./render/depuracao-de-unidade');
    const tipos = tiposDeDepuracao(window.location.search);
    registrarDepuracao({ manifesto: { ...modulo.manifestoDeDepuracao,
      assets: modulo.manifestoDeDepuracao.assets.filter((a) => tipos.includes(a.id)) },
      atlas: modulo.atlasDeDepuracao,
      atlases: modulo.atlasesDeDepuracao.filter((a) => tipos.some((id) => a.chave === chaveDoAtlas(id))),
    });
  }
  if (import.meta.env.DEV && tiposDeDepuracao(window.location.search).includes(new URLSearchParams(window.location.search).get('vitrine') ?? '')) {
    return import('./render/vitrine-serf');
  }
  if (abreNoMenu(window.location.search)) return abrirMenu();
  return jogar(escolhaDaUrl(window.location.search), null);
});
