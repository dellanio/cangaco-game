// Painel lateral do menu Build. So le o estado (via `opcoesDoMenuBuild`, que e
// um seletor puro de sim/) e escreve DOM; a unica coisa que faz alem de
// mostrar e dizer a ferramenta qual predio o jogador escolheu. Nao emite
// comando (o PlaceBlueprint e a F07), nao importa phaser nem sim/data e nao
// varre predios por conta propria (CLAUDE.md §3, §10).
import type { GameState } from '../sim/state';
import { opcoesDoMenuBuild } from '../sim/selectors';
import type { OpcaoDoMenuBuild } from '../sim/selectors';
import type { Ferramenta } from '../input/ferramenta';
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

  function marcarAtivo(predioAtivo: string | null): void {
    for (const [id, item] of itens) {
      item.botao.setAttribute('aria-pressed', String(id === predioAtivo));
    }
  }

  function montar(opcoes: readonly OpcaoDoMenuBuild[]): void {
    const titulo = document.createElement('h2');
    titulo.textContent = temaSertao.menuBuild.titulo;
    raiz?.append(titulo);

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
    marcarAtivo(ferramenta.predioAtivo);
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
