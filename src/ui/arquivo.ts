// F23b — os botoes de guardar e retomar a partida, e o recado do que aconteceu,
// numa secao no topo da tela de ajuda (H), que e o menu em jogo.
//
// Nao na barra do HUD, por medida: com a prancha fechada, o lembrete da primeira
// partida e o carimbo de pausa, a barra de 1280 px ja vai ate 1163 px, e os dois
// botoes pediam 170 px (o roteiro da F23b acusou 1364). O recado de recusa, com o
// motivo escrito, pede mais uns 250. O lembrete da barra ja manda o jogador a H.
//
// E-SAVE-GAVETAS — uma linha por gaveta, com o que ela tem (tipo, tick e data, ou vazia, ou
// recusada com o motivo) e os dois botoes dela. A gaveta 1 vem primeiro: o seletor da F23b
// (`#ajuda .arquivo button[data-acao="salvar"]`) continua achando a gaveta dela. As linhas nascem
// UMA vez; depois so o texto muda (o BUG-B ensinou o preco de recriar o no sob o dedo).
//
// So chama quem o criou e escreve texto: quem salva e carrega e o laco externo (`src/arquivo-da-partida.ts`); `ui/` nunca toca no estado.
//
// Os rotulos vem de `data/theme-sertao.json` (`hud.arquivo`), como os do HUD.
import temaSertao from '../../data/theme-sertao.json';
import type { NumeroDaGaveta, ResultadoDoArquivo, SituacaoDaGaveta } from '../arquivo-da-partida';

export interface RotulosDoArquivo {
  readonly salvou: string;
  readonly carregou: string;
  /** C-IA-03c — o recado de "Nova escaramuca". */
  readonly escaramucaIniciada: string;
  readonly semSave: string;
  /** Com `{detalhe}`, trocado pelo motivo que `carregar` escreveu. */
  readonly recusado: string;
  readonly gaveta: string;
}

/** O recado de um resultado. Pura: e o que o teste headless prova. */
export function textoDoRecado(resultado: ResultadoDoArquivo, rotulos: RotulosDoArquivo): string {
  if (resultado.ok) {
    if (resultado.acao === 'escaramuca') return rotulos.escaramucaIniciada;
    return resultado.acao === 'salvou' ? rotulos.salvou : rotulos.carregou;
  }
  const molde = resultado.causa === 'sem-save' ? rotulos.semSave : rotulos[resultado.causa];
  return molde.replace('{detalhe}', resultado.detalhe);
}

export type RotulosDasGavetas = typeof temaSertao.hud.arquivo.gavetas;

/** A data do indice como o jogador le (dia/mes hora:min, no fuso dele). Nula: save da F23b. */
function dataLegivel(data: string | null): string {
  if (data === null) return '';
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** E-SAVE-GAVETAS — o texto de uma gaveta: o que ela guarda, ou por que nao abre. Pura. */
export function textoDaGaveta(g: SituacaoDaGaveta, rotulos: RotulosDasGavetas = temaSertao.hud.arquivo.gavetas): string {
  const nome = rotulos.nome.replace('{n}', String(g.n));
  if (g.situacao === 'vazia') return `${nome}: ${rotulos.vazia}`;
  if (g.situacao === 'recusada') return `${nome}: ${rotulos.recusada.replace('{detalhe}', g.detalhe)}`;
  const data = dataLegivel(g.data);
  const texto = rotulos.pronta
    .replace('{tipo}', rotulos.tipos[g.tipo])
    .replace('{tick}', String(g.tick));
  return `${nome}: ${texto}${data === '' ? '' : rotulos.data.replace('{data}', data)}`;
}

export interface PainelDoArquivo {
  mostrar(resultado: ResultadoDoArquivo): void;
  /** Reescreve o texto das gavetas (depois de guardar, ou ao abrir a ajuda). */
  atualizarGavetas(): void;
}

export interface AcoesDoArquivo {
  aoSalvar(n: NumeroDaGaveta): void;
  aoCarregar(n: NumeroDaGaveta): void;
  /** C-IA-03c — comecar a escaramuca no meio do jogo. */
  aoEscaramuca?: () => void;
  /** E-SAVE-GAVETAS — voltar ao menu inicial. */
  aoMenu?: () => void;
  gavetas(): readonly SituacaoDaGaveta[];
}

/** Monta a secao em `#ajuda`, uma vez, logo abaixo do titulo. Nasce DEPOIS da
 *  ajuda (`montarAjuda`), que tambem monta o DOM uma vez e nunca o recria. */
export function montarArquivo(acoes: AcoesDoArquivo): PainelDoArquivo {
  const ajuda = document.getElementById('ajuda');
  if (!ajuda) throw new Error('arquivo: #ajuda nao existe no index.html');
  const rotulos = temaSertao.hud.arquivo;

  const raiz = document.createElement('section');
  raiz.className = 'arquivo';
  const titulo = document.createElement('h3');
  titulo.textContent = rotulos.titulo;

  function botao(acao: string, rotulo: string, aoClicar: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.acao = acao;
    b.textContent = rotulo;
    b.addEventListener('click', () => {
      aoClicar();
      // Sem isto o botao fica com foco, e o proximo Espaco (arrastar o mapa, F-D2)
      // guardaria ou retomaria a partida de novo.
      b.blur();
    });
    return b;
  }

  const lista = document.createElement('div');
  lista.className = 'gavetas';
  const textos = new Map<NumeroDaGaveta, HTMLElement>();
  for (const g of acoes.gavetas()) {
    const linha = document.createElement('div');
    linha.className = 'gaveta';
    linha.dataset.gaveta = String(g.n);
    const texto = document.createElement('span');
    texto.className = 'texto';
    texto.dataset.campo = 'gaveta';
    textos.set(g.n, texto);
    const guardar = botao('salvar', rotulos.salvar, () => { acoes.aoSalvar(g.n); });
    const retomar = botao('carregar', rotulos.carregar, () => { acoes.aoCarregar(g.n); });
    guardar.dataset.gaveta = String(g.n);
    retomar.dataset.gaveta = String(g.n);
    linha.append(texto, guardar, retomar);
    lista.append(linha);
  }

  const botoes = document.createElement('div');
  botoes.className = 'botoes';
  const recado = document.createElement('span');
  recado.className = 'recado';
  recado.dataset.campo = 'arquivo';
  recado.setAttribute('role', 'status');
  recado.hidden = true;
  // C-IA-03c — comecar a escaramuca (cenario provisorio: vira uma fase no sistema de fases)
  if (acoes.aoEscaramuca !== undefined) botoes.append(botao('escaramuca', rotulos.escaramuca, acoes.aoEscaramuca));
  if (acoes.aoMenu !== undefined) botoes.append(botao('menu', rotulos.menuInicial, acoes.aoMenu));
  botoes.append(recado);
  raiz.append(titulo, lista, botoes);
  ajuda.insertBefore(raiz, ajuda.querySelector('h2')?.nextSibling ?? null);

  function atualizarGavetas(): void {
    for (const g of acoes.gavetas()) {
      const texto = textos.get(g.n);
      if (texto === undefined) continue;
      texto.textContent = textoDaGaveta(g);
      texto.dataset.situacao = g.situacao;
    }
  }
  atualizarGavetas();

  return {
    mostrar(resultado) {
      atualizarGavetas();
      recado.textContent = textoDoRecado(resultado, rotulos);
      recado.dataset.ok = String(resultado.ok);
      recado.hidden = false;
      // O mesmo recado duas vezes seguidas (guardar, guardar) nao muda o texto:
      // o pisca e o retorno de que o segundo clique tambem valeu (GDD §10).
      recado.classList.remove('pisca');
      void recado.offsetWidth;
      recado.classList.add('pisca');
    },
    atualizarGavetas,
  };
}
