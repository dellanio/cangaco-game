// O balcao (Layout 2, docs/propostas/ui-releitura-rts.md §8): a faixa de
// contexto no rodape, onde mora o painel de predio (`#painel-predio`, F16b).
// Ela RETRAI para uma alca encostada a esquerda.
//
// A regra, em uma linha: o balcao abre quando ha algo escolhido e fecha quando
// nao ha. Selecionar e pedir detalhe; faixa vazia e 19,4 % do mapa pagos por
// nada (decisao do operador, 2026-09-25). O jogador pode recolher A MAO com um
// predio escolhido — a selecao fica, o contorno no mapa fica, a alca mostra o
// nome — e escolher OUTRO predio reabre, porque e um pedido novo de detalhe.
//
// Este modulo nao conhece o conteudo do painel: `painel-predio.ts` continua
// dono dele e escreve `data-nome` na raiz; a alca le de la. O estado vai em
// `data-balcao` no <body>, que e o que o CSS le. E estado de interface, irmao
// da selecao: nunca entra no `GameState`.
import type { Selecao } from '../input/selecao';
import temaSertao from '../../data/theme-sertao.json';

export type EstadoDoBalcao = 'aberto' | 'fechado';

/** A regra, pura — e o que o teste headless prova. */
export function estadoDoBalcao(haSelecao: boolean, recolhidoAMao: boolean): EstadoDoBalcao {
  if (!haSelecao) return 'fechado';
  return recolhidoAMao ? 'fechado' : 'aberto';
}

export interface Balcao {
  readonly estado: EstadoDoBalcao;
  /** Reescreve a alca com o nome do que esta aberto no painel. */
  atualizar(): void;
}

export function montarBalcao(selecao: Selecao): Balcao {
  const raiz = document.getElementById('balcao');
  if (!raiz) throw new Error('balcao: #balcao nao existe no index.html');
  const painel = document.getElementById('painel-predio');
  if (!painel) throw new Error('balcao: #painel-predio nao existe no index.html');

  const rotulos = temaSertao.paineis.balcao;

  const alca = document.createElement('button');
  alca.type = 'button';
  alca.className = 'alca';
  alca.dataset.alca = 'balcao';
  const nome = document.createElement('span');
  nome.className = 'nome';
  alca.append(nome);
  raiz.prepend(alca);

  let recolhidoAMao = false;
  let estado: EstadoDoBalcao = 'fechado';

  function aplicar(): void {
    estado = estadoDoBalcao(selecao.predio !== null, recolhidoAMao);
    document.body.dataset.balcao = estado;
    alca.classList.toggle('seta-baixo', estado === 'aberto');
    alca.classList.toggle('seta-cima', estado === 'fechado');
    // aria-disabled, nao `disabled`, como no menu Build (F06): o clique chega e
    // e ignorado, e a alca continua com o mesmo tamanho na grade.
    alca.setAttribute('aria-disabled', String(selecao.predio === null));
    const rotulo = estado === 'aberto' ? rotulos.recolher : rotulos.abrir;
    alca.setAttribute('aria-label', rotulo);
    alca.title = rotulo;
  }

  function atualizar(): void {
    const texto = selecao.predio === null ? rotulos.vazio : (painel!.dataset.nome ?? rotulos.vazio);
    if (nome.textContent !== texto) nome.textContent = texto;
  }

  // Escolher outro predio (ou o mesmo de novo, depois de limpar) e um pedido
  // novo de detalhe: o "recolhido a mao" so vale para a selecao em que nasceu.
  selecao.aoMudar(() => {
    recolhidoAMao = false;
    aplicar();
    atualizar();
  });

  alca.addEventListener('click', () => {
    if (selecao.predio === null) return;
    recolhidoAMao = !recolhidoAMao;
    aplicar();
  });

  aplicar();
  atualizar();

  return {
    get estado() {
      return estado;
    },
    atualizar,
  };
}
