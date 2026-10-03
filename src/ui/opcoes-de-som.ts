// H-TELA-OPCOES-E-VOLUME — a caixa de opcoes de som: o volume geral, o de cada canal e o mudo.
//
// Aberta pelo menu inicial (antes do Phaser) e pela ajuda em jogo (o botao que este modulo poe
// em `#ajuda`). Monta o DOM UMA vez e so alterna `hidden`, como a ajuda (o BUG-B ensinou o preco de
// recriar arvore de DOM com o jogo andando). Nao toca no estado do jogo: a escolha sai por
// callback, e quem a guarda e quem a aplica e o laco externo. Rotulos de `theme-sertao.som`.
import temaSertao from '../../data/theme-sertao.json';
import { CANAIS } from '../preferencias-de-som';
import type { Canal, PreferenciasDeSom } from '../preferencias-de-som';

const rotulos = temaSertao.som;

export interface OpcoesDeSom {
  readonly aberta: boolean;
  abrir(): void;
  /** Devolve `true` se estava aberta (o `Esc` foi dela). */
  fechar(): boolean;
  /** Poe em `#ajuda` o botao que abre esta caixa. Uma vez so. */
  ligarNaAjuda(): void;
}

export function montarOpcoesDeSom(inicial: PreferenciasDeSom, aoMudar: (p: PreferenciasDeSom) => void): OpcoesDeSom {
  let prefs = inicial;
  const raiz = document.createElement('section');
  raiz.id = 'opcoes-de-som';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-label', rotulos.titulo);
  raiz.hidden = true;

  const titulo = document.createElement('h2');
  titulo.textContent = rotulos.titulo;
  raiz.append(titulo);

  function deslizador(campo: 'geral' | Canal, texto: string): HTMLElement {
    const linha = document.createElement('label');
    linha.className = 'campo';
    const nome = document.createElement('span');
    nome.textContent = texto;
    const entrada = document.createElement('input');
    entrada.type = 'range';
    entrada.min = '0';
    entrada.max = '100';
    entrada.step = '1';
    entrada.dataset.volume = campo;
    entrada.value = String(Math.round(prefs[campo] * 100));
    entrada.addEventListener('input', () => {
      prefs = { ...prefs, [campo]: Number(entrada.value) / 100 };
      aoMudar(prefs);
    });
    linha.append(nome, entrada);
    return linha;
  }

  raiz.append(deslizador('geral', rotulos.geral));
  for (const canal of CANAIS) raiz.append(deslizador(canal, rotulos.canais[canal]));

  const linhaDoMudo = document.createElement('label');
  linhaDoMudo.className = 'campo mudo';
  const mudo = document.createElement('input');
  mudo.type = 'checkbox';
  mudo.dataset.volume = 'mudo';
  mudo.checked = prefs.mudo;
  mudo.addEventListener('change', () => {
    prefs = { ...prefs, mudo: mudo.checked };
    aoMudar(prefs);
  });
  const nomeDoMudo = document.createElement('span');
  nomeDoMudo.textContent = rotulos.mudo;
  linhaDoMudo.append(mudo, nomeDoMudo);
  raiz.append(linhaDoMudo);

  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.dataset.acao = 'fechar';
  fechar.textContent = rotulos.fechar;
  fechar.addEventListener('click', () => {
    mostrar(false);
  });
  raiz.append(fechar);
  document.body.append(raiz);

  let aberta = false;
  function mostrar(valor: boolean): void {
    aberta = valor;
    raiz.hidden = !valor;
  }

  // O `Esc` fecha esta caixa antes de chegar a quem esta embaixo (a ajuda, o menu): ela e a de cima.
  window.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || !aberta) return;
    mostrar(false);
    evento.preventDefault();
    evento.stopImmediatePropagation();
  }, { capture: true });

  let ligada = false;
  return {
    get aberta() {
      return aberta;
    },
    abrir() {
      mostrar(true);
    },
    fechar() {
      if (!aberta) return false;
      mostrar(false);
      return true;
    },
    ligarNaAjuda() {
      if (ligada) return;
      const ajuda = document.getElementById('ajuda');
      if (!ajuda) return;
      ligada = true;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.dataset.acao = 'opcoes-de-som';
      botao.textContent = rotulos.abrirNaAjuda;
      botao.addEventListener('click', () => {
        mostrar(true);
        botao.blur();
      });
      ajuda.insertBefore(botao, ajuda.querySelector('h2')?.nextSibling ?? null);
    },
  };
}
