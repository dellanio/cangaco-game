// Painel da fila de treino da escola (F13b). So le o estado (via
// `painelDaEscola`, seletor puro de sim/) e emite comando; nao muta GameState,
// nao importa phaser e nao varre predios por conta propria (CLAUDE.md §3, §10).
//
// Todo rotulo vem do tema. O painel mostra o NOME do civil no sertao e o MOTIVO
// de cada item parado — nunca o id neutro da simulacao.
import type { GameState } from '../sim/state';
import type { Command } from '../sim/commands';
import { painelDaEscola } from '../sim/selectors';
import type { ItemDoPainelDeTreino, PainelDaEscola } from '../sim/selectors';
import type { Selecao } from '../input/selecao';
import temaSertao from '../../data/theme-sertao.json';

export interface PainelEscola {
  atualizar(estado: GameState): void;
}

const rotulos = temaSertao.painelEscola;
type TemaDeCivis = Readonly<Record<string, { readonly nome: string } | undefined>>;
const temaDeCivis = temaSertao.civis as TemaDeCivis;

function nomeDoCivil(id: string): string {
  return temaDeCivis[id]?.nome ?? id;
}

/**
 * O que o slot diz a direita. Os tres motivos sao textos DIFERENTES de proposito:
 * cada um aponta a acao que resolve aquele caso (puxar estrada nao e o mesmo
 * problema que nao ter dinheiro).
 */
function detalheDoItem(item: ItemDoPainelDeTreino): string {
  if (item.estado === 'treinando') return `${rotulos.treinando} ${Math.round(item.progresso * 100)}%`;
  if (item.motivo === 'a-caminho') return rotulos.ouroACaminho;
  if (item.motivo === 'sem-estrada') return rotulos.semEstrada;
  if (item.motivo === 'sem-ouro') return rotulos.semOuro;
  return rotulos.naFila;
}

/**
 * Reescreve o painel inteiro a cada `atualizar`. Sao no maximo 5 slots mais os
 * botoes de tipo: reaproveitar no de item cancelado custaria mais em bug do que
 * economiza em DOM.
 */
export function montarPainelEscola(
  selecao: Selecao, emitir: (comando: Command) => void,
): PainelEscola {
  const raiz = document.getElementById('painel-escola');
  if (!raiz) throw new Error('painel-escola: #painel-escola nao existe no index.html');
  const painel = raiz;

  function slotDoItem(dados: PainelDaEscola, item: ItemDoPainelDeTreino, i: number): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = String(i);
    slot.dataset.estado = item.estado;
    slot.dataset.item = item.id;
    slot.dataset.unidade = item.unidade;
    if (item.motivo !== null) slot.dataset.motivo = item.motivo;

    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = nomeDoCivil(item.unidade);

    const detalhe = document.createElement('span');
    detalhe.className = item.estado === 'treinando' ? 'progresso' : 'motivo';
    detalhe.textContent = detalheDoItem(item);

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.dataset.cancelar = item.id;
    cancelar.title = rotulos.cancelarItem;
    cancelar.textContent = '×';
    cancelar.addEventListener('click', () => {
      emitir({ type: 'CancelTraining', predio: dados.predio, item: item.id });
    });

    slot.append(nome, detalhe, cancelar);
    return slot;
  }

  function slotVazio(i: number): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = String(i);
    slot.dataset.estado = 'vazio';
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = rotulos.vazio;
    slot.append(nome);
    return slot;
  }

  function desenhar(dados: PainelDaEscola): void {
    painel.replaceChildren();

    const titulo = document.createElement('h2');
    titulo.textContent = rotulos.titulo;
    painel.append(titulo);

    // Os slots VAZIOS tambem aparecem: o jogador tem que ver quanto ainda cabe.
    for (let i = 0; i < dados.slots; i++) {
      const item = dados.itens[i];
      painel.append(item === undefined ? slotVazio(i) : slotDoItem(dados, item, i));
    }

    const tipos = document.createElement('div');
    tipos.className = 'tipos';
    for (const tipo of dados.tiposTreinaveis) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.dataset.treinar = tipo;
      botao.textContent = nomeDoCivil(tipo);
      botao.title = `${rotulos.custo} ${dados.custoPorUnidade}`;
      // aria-disabled e nao `disabled`, como no menu Build (F06): o clique CHEGA
      // e e ignorado aqui, entao o roteiro consegue provar que nao enfileirou.
      botao.setAttribute('aria-disabled', String(!dados.podeEnfileirar));
      botao.addEventListener('click', () => {
        if (botao.getAttribute('aria-disabled') === 'true') return;
        emitir({ type: 'EnqueueTraining', predio: dados.predio, unidade: tipo });
      });
      tipos.append(botao);
    }
    painel.append(tipos);

    if (!dados.podeEnfileirar) {
      const cheia = document.createElement('span');
      cheia.className = 'fila-cheia';
      cheia.dataset.filaCheia = 'true';
      cheia.textContent = rotulos.filaCheia;
      painel.append(cheia);
    }
  }

  return {
    atualizar(estado) {
      const id = selecao.predio;
      const dados = id === null ? null : painelDaEscola(estado, id);
      // Nada selecionado, ou o predio nao e (mais) uma escola completa: o painel
      // fecha. Nao mexe na selecao — quem a limpa e o `Esc` e o clique no mapa.
      if (dados === null) {
        painel.hidden = true;
        painel.replaceChildren();
        return;
      }
      painel.hidden = false;
      desenhar(dados);
    },
  };
}
