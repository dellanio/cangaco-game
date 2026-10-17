// F23b — os botoes de guardar e retomar a partida, e o recado do que aconteceu.
// I-TELA-PARTIDA-NAS-OPCOES (pedido do operador, 2026-10-17): o bloco Partida mora no alto da aba Opcoes da barra
// (Salvar, Carregar, Reiniciar fase, Nova escaramuca, Opcoes de som, Menu inicial e o recado); o Salvar e o Carregar
// abrem o popup `#gavetas` com as tres gavetas. Antes a secao ficava no topo da caixa do H.
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
import { cliqueNoReinicio } from './reinicio';

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
  /** I-TELA-PARTIDA-NAS-OPCOES — recomecar a partida do zero (depois da confirmacao). */
  aoReiniciar?: () => void;
  /** I-TELA-PARTIDA-NAS-OPCOES — abrir a caixa das opcoes de som. */
  aoOpcoesDeSom?: () => void;
  gavetas(): readonly SituacaoDaGaveta[];
}

/** Monta, uma vez, o bloco Partida no alto de `#opcoes` (a aba Opcoes da barra) e o popup `#gavetas`. */
export function montarArquivo(acoes: AcoesDoArquivo): PainelDoArquivo {
  const opcoes = document.getElementById('opcoes');
  if (!opcoes) throw new Error('arquivo: #opcoes nao existe no index.html');
  const rotulos = temaSertao.hud.arquivo;

  const raiz = document.createElement('section');
  raiz.className = 'arquivo';
  const titulo = document.createElement('h3');
  titulo.textContent = rotulos.titulo;

  // o popup das gavetas: o mesmo para guardar e retomar; `data-modo` diz qual botao de cada linha aparece
  const popup = document.createElement('div');
  popup.id = 'gavetas';
  popup.hidden = true;
  popup.setAttribute('role', 'dialog');
  const tituloDoPopup = document.createElement('h2');
  function abrirPopup(modo: 'salvar' | 'carregar'): void {
    popup.dataset.modo = modo;
    tituloDoPopup.textContent = modo === 'salvar' ? rotulos.tituloSalvar : rotulos.tituloCarregar;
    atualizarGavetas();
    popup.hidden = false;
  }
  function fecharPopup(): boolean {
    if (popup.hidden) return false;
    popup.hidden = true;
    return true;
  }
  // o Esc fecha o popup antes de chegar ao teclado do jogo
  window.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && fecharPopup()) evento.stopImmediatePropagation();
  }, { capture: true });

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
    // o Retomar que deu certo fecha o popup; o recusado deixa aberto, com o motivo no recado
    const retomar = botao('carregar', rotulos.carregar, () => { acoes.aoCarregar(g.n); if (recado.dataset.ok === 'true') fecharPopup(); });
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
  botoes.append(botao('abrir-salvar', rotulos.abrirSalvar, () => { abrirPopup('salvar'); }));
  botoes.append(botao('abrir-carregar', rotulos.abrirCarregar, () => { abrirPopup('carregar'); }));
  // I-TELA-PARTIDA-NAS-OPCOES: o Reiniciar pede a confirmacao (o primeiro clique arma, o segundo dispara)
  if (acoes.aoReiniciar !== undefined) {
    const aoReiniciar = acoes.aoReiniciar;
    let armado = false;
    const reiniciar = botao('reiniciar', rotulos.reiniciar, () => {
      const passo = cliqueNoReinicio(armado);
      armado = passo.armado;
      reiniciar.dataset.armado = String(armado);
      reiniciar.textContent = armado ? rotulos.confirmarReinicio : rotulos.reiniciar;
      if (passo.disparar) aoReiniciar();
    });
    reiniciar.dataset.armado = 'false';
    // sair da aba Opcoes desarma
    new MutationObserver(() => {
      if (document.body.dataset.corpo === 'opcoes' || !armado) return;
      armado = false;
      reiniciar.dataset.armado = 'false';
      reiniciar.textContent = rotulos.reiniciar;
    }).observe(document.body, { attributes: true, attributeFilter: ['data-corpo'] });
    botoes.append(reiniciar);
  }
  // C-IA-03c — comecar a escaramuca (cenario provisorio: vira uma fase no sistema de fases)
  if (acoes.aoEscaramuca !== undefined) botoes.append(botao('escaramuca', rotulos.escaramuca, acoes.aoEscaramuca));
  if (acoes.aoOpcoesDeSom !== undefined) botoes.append(botao('opcoes-de-som', temaSertao.som.abrirNaAjuda, acoes.aoOpcoesDeSom));
  if (acoes.aoMenu !== undefined) botoes.append(botao('menu', rotulos.menuInicial, acoes.aoMenu));
  botoes.append(recado);
  raiz.append(titulo, botoes);
  opcoes.prepend(raiz);
  const fechar = botao('fechar', rotulos.fechar, () => { fecharPopup(); });
  popup.append(tituloDoPopup, lista, fechar);
  document.body.append(popup);

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
