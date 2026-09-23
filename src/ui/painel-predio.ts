// Painel de selecao de predio (F16b). UM painel para todo predio: ele junta o
// que cinco features deixaram prontas e NAO cria mecanismo novo de nada —
// `selecao` e `predioNoTile` vem da F13b, `DemolishBuilding` da F16a,
// `SetBuildingPaused` da F16c, estoque e producao da F15, ocupante da F14.
//
// Le o estado pelo seletor puro `painelDoPredio` e emite comando. Nao muta
// GameState, nao importa phaser, nao varre predios (CLAUDE.md §3, §10).
//
// A fila de treino da escola virou uma SECAO deste painel
// (`desenharSecaoDaEscola`), nao um segundo painel: dois paineis disputando o
// mesmo canto da tela seria o mecanismo duplicado que a nota do item proibe.
//
// Todo rotulo vem do tema. O nome do predio sai de `predios.<id>.nome`, que ja
// existia — o painel nao inventa um segundo lugar para o mesmo nome.
import type { GameState } from '../sim/state';
import type { Command } from '../sim/commands';
import { painelDaEscola, painelDoPredio } from '../sim/selectors';
import type { ItemDeEstoque, PainelDoPredio } from '../sim/selectors';
import type { Selecao } from '../input/selecao';
import { desenharSecaoDaEscola, nomeDoCivil } from './painel-escola';
import temaSertao from '../../data/theme-sertao.json';

export interface PainelPredio {
  atualizar(estado: GameState): void;
}

const rotulos = temaSertao.painelPredio;
type TemaDePredios = Readonly<Record<string, { readonly nome: string } | undefined>>;
type TemaDeMercadorias = Readonly<Record<string, string | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;
const temaDeMercadorias = temaSertao.mercadorias as TemaDeMercadorias;

function nomeDoPredio(tipo: string): string {
  return temaDePredios[tipo]?.nome ?? tipo;
}

function linha(classe: string, rotulo: string, valor: string): HTMLElement {
  const div = document.createElement('div');
  div.className = `linha ${classe}`;
  const r = document.createElement('span');
  r.className = 'rotulo';
  r.textContent = rotulo;
  const v = document.createElement('span');
  v.className = 'valor';
  v.textContent = valor;
  div.append(r, v);
  return div;
}

/** Uma gaveta. A ORDEM ja vem resolvida do seletor (`economia.mercadorias`). */
function gaveta(classe: string, rotulo: string, itens: readonly ItemDeEstoque[]): HTMLElement {
  const div = document.createElement('div');
  div.className = `gaveta ${classe}`;
  div.dataset.gaveta = classe;
  const r = document.createElement('span');
  r.className = 'rotulo';
  r.textContent = rotulo;
  div.append(r);

  if (itens.length === 0) {
    const vazia = document.createElement('span');
    vazia.className = 'vazia';
    vazia.textContent = rotulos.gavetaVazia;
    div.append(vazia);
    return div;
  }
  for (const item of itens) {
    const span = document.createElement('span');
    span.className = 'item';
    span.dataset.mercadoria = item.mercadoria;
    span.textContent = `${temaDeMercadorias[item.mercadoria] ?? item.mercadoria} ${item.quantidade}`;
    div.append(span);
  }
  return div;
}

function desenharObra(raiz: HTMLElement, dados: PainelDoPredio): void {
  raiz.append(linha('obra', rotulos.emObra, `${Math.round(dados.progresso * 100)}%`));
  const faltam = dados.faltam ?? [];
  raiz.append(gaveta('faltam', rotulos.faltaChegar, faltam));
}

function desenharCompleto(
  raiz: HTMLElement, dados: PainelDoPredio, emitir: (comando: Command) => void,
): void {
  raiz.append(linha('hp', rotulos.hp, `${dados.hp}/${dados.hpTotal}`));

  // A linha do ocupante so existe em predio que PEDE trabalhador. Escrever "sem
  // trabalhador" num armazem seria acusar falta onde nao cabe ninguem — sao dois
  // campos no seletor justamente para nao juntar as duas causas.
  if (dados.pedeTrabalhador) {
    const l = linha(
      'ocupante', rotulos.ocupante,
      dados.ocupante === null ? rotulos.semTrabalhador : nomeDoCivil(dados.ocupante.tipo),
    );
    l.dataset.ocupante = dados.ocupante === null ? 'vago' : dados.ocupante.unidade;
    raiz.append(l);
  }

  if (dados.estoque !== null) {
    raiz.append(gaveta('entrada', rotulos.entrada, dados.estoque.entrada));
    raiz.append(gaveta('saida', rotulos.saida, dados.estoque.saida));
  }

  // O botao de pausar so nasce em predio COM producao, como a nota da F16c
  // registrou: pausar um armazem nao quer dizer nada.
  if (dados.temProducao) {
    const acoes = document.createElement('div');
    acoes.className = 'acoes';
    const botao = document.createElement('button');
    botao.type = 'button';
    // O botao manda o VALOR, nunca "inverta o que estiver ai": se a tela
    // estivesse um tick atrasada, um toggle pausaria o que o jogador acabou de
    // retomar. Mesmo criterio do comando (F16c).
    const alvo = !dados.pausado;
    botao.dataset.pausar = String(alvo);
    botao.textContent = dados.pausado ? rotulos.retomar : rotulos.pausar;
    botao.addEventListener('click', () => {
      emitir({ type: 'SetBuildingPaused', predio: dados.predio, pausado: alvo });
    });
    acoes.append(botao);
    if (dados.pausado) {
      const aviso = document.createElement('span');
      aviso.className = 'pausado';
      aviso.dataset.pausado = 'true';
      aviso.textContent = rotulos.pausado;
      acoes.append(aviso);
    }
    raiz.append(acoes);
  }
}

export function montarPainelPredio(
  selecao: Selecao, emitir: (comando: Command) => void,
): PainelPredio {
  const encontrado = document.getElementById('painel-predio');
  if (encontrado === null) throw new Error('painel-predio: falta #painel-predio no index.html');
  const raiz: HTMLElement = encontrado;

  function atualizar(estado: GameState): void {
    const id = selecao.predio;
    const dados = id === null ? null : painelDoPredio(estado, id);

    if (dados === null) {
      raiz.replaceChildren();
      raiz.hidden = true;
      raiz.removeAttribute('data-predio-aberto');
      // O predio saiu do estado (demolido) mas a selecao ainda aponta para ele:
      // limpar aqui e o que fecha o painel sozinho. `definir` so avisa quando
      // muda, entao a reentrada para no proximo passo.
      if (id !== null) selecao.limpar();
      return;
    }

    raiz.replaceChildren();
    raiz.hidden = false;
    // `data-predio-aberto`, e nao `data-predio`: este ultimo ja e o item do menu
    // Build (F06), e o mesmo atributo em dois papeis faria seletor de roteiro
    // pegar o elemento errado.
    raiz.dataset.predioAberto = dados.predio;
    raiz.dataset.tipo = dados.tipo;
    raiz.dataset.estadoDoPredio = dados.estado;
    raiz.dataset.pausado = String(dados.pausado);

    const titulo = document.createElement('h2');
    titulo.textContent = nomeDoPredio(dados.tipo);
    raiz.append(titulo);

    if (dados.estado === 'obra') desenharObra(raiz, dados);
    else desenharCompleto(raiz, dados, emitir);

    // A escola entra como SECAO, e so quando ela existe de fato no estado.
    const escola = dados.estado === 'completo' ? painelDaEscola(estado, dados.predio) : null;
    if (escola !== null) desenharSecaoDaEscola(raiz, escola, emitir);

    // Demolir e UM CLIQUE, sem confirmacao — decisao do operador (2026-09-23),
    // registrada com o custo em IDEIAS.md. Fica por ultimo e separado das outras
    // acoes de proposito: e o unico botao daqui que destroi trabalho.
    const derrubar = document.createElement('button');
    derrubar.type = 'button';
    derrubar.className = 'demolir';
    derrubar.dataset.demolir = dados.predio;
    derrubar.textContent = rotulos.demolir;
    derrubar.title = rotulos.demolirDesc;
    derrubar.addEventListener('click', () => {
      emitir({ type: 'DemolishBuilding', predio: dados.predio });
    });
    raiz.append(derrubar);
  }

  return { atualizar };
}
