// A fila de treino da escola (F13b), desde a F16b desenhada como uma SECAO
// dentro do painel de predio. So le o estado (via `painelDaEscola`, seletor puro
// de sim/) e emite comando; nao muta GameState, nao importa phaser e nao varre
// predios por conta propria (CLAUDE.md §3, §10).
//
// O que mudou na F16b: este arquivo nao possui mais elemento nenhum. Ele nao
// chama `getElementById`, nao mexe em `hidden` e nao conhece a selecao — quem
// decide se esta secao existe e `ui/painel-predio.ts`. `painelDaEscola` continua
// sendo a fonte dos dados, que e o que a nota do item F16b manda.
//
// Todo rotulo vem do tema. O painel mostra o NOME do civil no sertao e o MOTIVO
// de cada item parado — nunca o id neutro da simulacao.
import type { Command } from '../sim/commands';
import type { ItemDoPainelDeTreino, PainelDaEscola } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

const rotulos = temaSertao.painelEscola;
type TemaDeCivis = Readonly<Record<string, { readonly nome: string } | undefined>>;
const temaDeCivis = temaSertao.civis as TemaDeCivis;

export function nomeDoCivil(id: string): string {
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

function slotDoItem(
  dados: PainelDaEscola, item: ItemDoPainelDeTreino, i: number,
  emitir: (comando: Command) => void,
): HTMLElement {
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

/**
 * Desenha a fila de treino DENTRO de `raiz`, que o chamador acabou de criar.
 * Nao limpa nada: quem redesenha o painel inteiro a cada `atualizar` e o painel
 * de predio — sao no maximo 5 slots mais os botoes de tipo, e reaproveitar o no
 * de um item cancelado custaria mais em bug do que economiza em DOM.
 */
export function desenharSecaoDaEscola(
  raiz: HTMLElement, dados: PainelDaEscola, emitir: (comando: Command) => void,
): void {
  const fila = document.createElement('h3');
  fila.textContent = rotulos.fila;
  raiz.append(fila);

  // Os slots VAZIOS tambem aparecem: o jogador tem que ver quanto ainda cabe.
  for (let i = 0; i < dados.slots; i++) {
    const item = dados.itens[i];
    raiz.append(item === undefined ? slotVazio(i) : slotDoItem(dados, item, i, emitir));
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
  raiz.append(tipos);

  if (!dados.podeEnfileirar) {
    const cheia = document.createElement('span');
    cheia.className = 'fila-cheia';
    cheia.dataset.filaCheia = 'true';
    cheia.textContent = rotulos.filaCheia;
    raiz.append(cheia);
  }
}
