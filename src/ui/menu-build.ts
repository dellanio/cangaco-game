// Painel lateral do menu Build. So le o estado (via `opcoesDoMenuBuild`, que e
// um seletor puro de sim/) e escreve DOM; a unica coisa que faz alem de
// mostrar e dizer a ferramenta qual predio o jogador escolheu. Nao emite
// comando (o PlaceBlueprint e a F07), nao importa phaser nem sim/data e nao
// varre predios por conta propria (CLAUDE.md §3, §10).
import type { GameState } from '../sim/state';
import { custoDaEstrada, opcoesDoMenuBuild } from '../sim/selectors';
import type { OpcaoDoMenuBuild } from '../sim/selectors';
import type { Ferramenta, ModoDaFerramenta } from '../input/ferramenta';
import temaSertao from '../../data/theme-sertao.json';

export interface MenuBuild {
  atualizar(estado: GameState): void;
}

type TemaDePredios = Readonly<Record<string, { readonly nome: string } | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;

function nomeDe(id: string): string {
  return temaDePredios[id]?.nome ?? id;
}

function textoDoCusto(opcao: OpcaoDoMenuBuild): string {
  const { timber, stone } = temaSertao.mercadorias;
  return `${timber} ${opcao.custo.timber} · ${stone} ${opcao.custo.stone}`;
}

/** "Pedra 1 por tile": o numero vem do dado, pelo seletor; os rotulos, do tema. */
function textoDoCustoDaEstrada(): string {
  return `${temaSertao.mercadorias.stone} ${custoDaEstrada().stone} ${temaSertao.menuBuild.porTile}`;
}

/** O ramo `semRequisito` ("ainda nao disponivel") nao tem produtor no dado de
 *  hoje: desde a correcao do BUG-002 nenhum predio tem `desbloqueadoPor` null
 *  (GDD §5.2), e `tools/shots/F06.js` afirma justamente que nenhum item do menu
 *  fica cinza sem dizer do que depende. Fica porque a permissao por fase da
 *  campanha (GDD §5.3) e quem volta a produzi-lo: "existe na arvore, mas esta
 *  missao nao libera". Apagar agora e apagar o rotulo que essa camada vai pedir.
 */
function textoDoRequisito(opcao: OpcaoDoMenuBuild): string {
  const { requer, semRequisito } = temaSertao.menuBuild;
  return opcao.requer === null ? semRequisito : `${requer} ${nomeDe(opcao.requer)}`;
}

interface ItemMontado {
  readonly botao: HTMLButtonElement;
  readonly requer: HTMLSpanElement;
}

/** Monta o painel em `#menu-build` na primeira `atualizar` (e la que se sabe a
 *  lista de predios) e depois so reescreve o que mudou. */
export function montarMenuBuild(ferramenta: Ferramenta): MenuBuild {
  const raiz = document.getElementById('menu-build');
  if (!raiz) throw new Error('menu-build: #menu-build nao existe no index.html');

  const itens = new Map<string, ItemMontado>();
  // As ferramentas que nao sao planta de predio (F08): estrada e demolir estrada.
  const ferramentas = new Map<ModoDaFerramenta, HTMLButtonElement>();

  function marcarAtivo(predioAtivo: string | null, modo: ModoDaFerramenta): void {
    for (const [id, item] of itens) {
      item.botao.setAttribute('aria-pressed', String(id === predioAtivo));
    }
    for (const [modoDoBotao, botao] of ferramentas) {
      botao.setAttribute('aria-pressed', String(modoDoBotao === modo));
    }
    // Sem ferramenta, nenhum item deve parecer selecionado: o anel de foco que
    // o navegador deixa no ultimo botao clicado (aparece de novo apos o Esc)
    // le como "ainda ativo".
    if (modo === 'nenhum') {
      const focado = document.activeElement;
      if (focado instanceof HTMLElement && raiz?.contains(focado)) focado.blur();
    }
  }

  function montar(opcoes: readonly OpcaoDoMenuBuild[]): void {
    const titulo = document.createElement('h2');
    titulo.textContent = temaSertao.menuBuild.titulo;
    raiz?.append(titulo);

    montarFerramenta('estrada', 'estrada', temaSertao.menuBuild.estrada, textoDoCustoDaEstrada(), () => {
      ferramenta.selecionarEstrada();
    });
    montarFerramenta('demolir-estrada', 'demolir-estrada', temaSertao.menuBuild.demolirEstrada,
      temaSertao.menuBuild.demolirEstradaDesc, () => {
        ferramenta.selecionarDemolicao();
      });

    for (const opcao of opcoes) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'item';
      botao.dataset.predio = opcao.id;

      const nome = document.createElement('span');
      nome.className = 'nome';
      nome.textContent = nomeDe(opcao.id);

      const custo = document.createElement('span');
      custo.className = 'custo';
      custo.textContent = textoDoCusto(opcao);

      const requer = document.createElement('span');
      requer.className = 'requer';

      botao.append(nome, custo, requer);
      // aria-disabled e nao `disabled`: o item bloqueado continua recebendo o
      // clique, que a ferramenta simplesmente ignora — o jogador nao fica sem
      // resposta e o roteiro consegue provar que clicar nele nao ativa nada.
      botao.addEventListener('click', () => {
        if (botao.getAttribute('aria-disabled') === 'true') return;
        ferramenta.selecionar(opcao.id);
      });

      raiz?.append(botao);
      itens.set(opcao.id, { botao, requer });
    }
    ferramenta.aoMudar(marcarAtivo);
    marcarAtivo(ferramenta.predioAtivo, ferramenta.modo);
  }

  /** Um botao de ferramenta (estrada, demolir estrada), acima da lista de predios.
   *  Sempre disponivel: nao depende da arvore de desbloqueio. */
  function montarFerramenta(
    modo: ModoDaFerramenta, id: string, nomeDoBotao: string, detalhe: string, aoClicar: () => void,
  ): void {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'item';
    botao.dataset.ferramenta = id;

    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = nomeDoBotao;

    const custo = document.createElement('span');
    custo.className = 'custo';
    custo.textContent = detalhe;

    botao.append(nome, custo);
    botao.addEventListener('click', aoClicar);
    raiz?.append(botao);
    ferramentas.set(modo, botao);
  }

  return {
    atualizar(estado) {
      const opcoes = opcoesDoMenuBuild(estado);
      if (itens.size === 0) montar(opcoes);
      for (const opcao of opcoes) {
        const item = itens.get(opcao.id);
        if (!item) continue;
        item.botao.setAttribute('aria-disabled', String(!opcao.desbloqueado));
        const texto = opcao.desbloqueado ? '' : textoDoRequisito(opcao);
        if (item.requer.textContent !== texto) item.requer.textContent = texto;
      }
    },
  };
}
