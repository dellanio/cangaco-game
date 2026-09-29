// F23b — os botoes de guardar e retomar a partida, e o recado do que aconteceu,
// numa secao no topo da tela de ajuda (H), que e o menu em jogo.
//
// Nao na barra do HUD, por medida: com a prancha fechada, o lembrete da primeira
// partida e o carimbo de pausa, a barra de 1280 px ja vai ate 1163 px, e os dois
// botoes pediam 170 px (o roteiro da F23b acusou 1364). O recado de recusa, com o
// motivo escrito, pede mais uns 250. O lembrete da barra ja manda o jogador a H.
//
// So chama quem o criou e escreve texto: quem salva e carrega e o laco externo (`src/arquivo-da-partida.ts`); `ui/` nunca toca no estado.
//
// Os rotulos vem de `data/theme-sertao.json` (`hud.arquivo`), como os do HUD.
import temaSertao from '../../data/theme-sertao.json';
import type { ResultadoDoArquivo } from '../arquivo-da-partida';

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

export interface PainelDoArquivo {
  mostrar(resultado: ResultadoDoArquivo): void;
}

/** Monta a secao em `#ajuda`, uma vez, logo abaixo do titulo. Nasce DEPOIS da
 *  ajuda (`montarAjuda`), que tambem monta o DOM uma vez e nunca o recria. */
export function montarArquivo(aoSalvar: () => void, aoCarregar: () => void, aoEscaramuca?: () => void): PainelDoArquivo {
  const ajuda = document.getElementById('ajuda');
  if (!ajuda) throw new Error('arquivo: #ajuda nao existe no index.html');
  const rotulos = temaSertao.hud.arquivo;

  const raiz = document.createElement('section');
  raiz.className = 'arquivo';
  const titulo = document.createElement('h3');
  titulo.textContent = rotulos.titulo;
  const botoes = document.createElement('div');
  botoes.className = 'botoes';

  function botao(acao: 'salvar' | 'carregar' | 'escaramuca', rotulo: string, aoClicar: () => void): HTMLButtonElement {
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

  const recado = document.createElement('span');
  recado.className = 'recado';
  recado.dataset.campo = 'arquivo';
  recado.setAttribute('role', 'status');
  recado.hidden = true;

  botoes.append(botao('salvar', rotulos.salvar, aoSalvar), botao('carregar', rotulos.carregar, aoCarregar));
  // C-IA-03c — comecar a escaramuca (cenario provisorio: vira uma fase no sistema de fases)
  if (aoEscaramuca !== undefined) botoes.append(botao('escaramuca', rotulos.escaramuca, aoEscaramuca));
  botoes.append(recado);
  raiz.append(titulo, botoes);
  ajuda.insertBefore(raiz, ajuda.querySelector('h2')?.nextSibling ?? null);

  return {
    mostrar(resultado) {
      recado.textContent = textoDoRecado(resultado, rotulos);
      recado.dataset.ok = String(resultado.ok);
      recado.hidden = false;
      // O mesmo recado duas vezes seguidas (guardar, guardar) nao muda o texto:
      // o pisca e o retorno de que o segundo clique tambem valeu (GDD §10).
      recado.classList.remove('pisca');
      void recado.offsetWidth;
      recado.classList.add('pisca');
    },
  };
}
