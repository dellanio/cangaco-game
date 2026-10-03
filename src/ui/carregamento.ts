// E-ENTREGA-BUILD — a tela de carregamento: entre a escolha no menu (ou a URL) e o primeiro
// quadro do jogo. Ela nasce no `inicio.ts`, antes de o `main.ts` (e o Phaser, o maior pedaco do
// bundle) chegar pela rede, e mostra o progresso do loader de assets da cena, que o `main.ts`
// repassa. Some no 1. So DOM e texto; o rotulo vem de `data/theme-sertao.json` (`carregamento`).
import temaSertao from '../../data/theme-sertao.json';

const rotulos = temaSertao.carregamento;

/** O texto do progresso, de 0 a 1. Pura: e o que o teste headless prova. */
export function textoDoCarregamento(fracao: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, fracao)) * 100);
  return rotulos.progresso.replace('{pct}', String(pct));
}

export interface TelaDeCarregamento {
  /** De 0 a 1. No 1 a tela some, e nao volta. */
  atualizar(fracao: number): void;
}

export function montarCarregamento(): TelaDeCarregamento {
  const raiz = document.createElement('section');
  raiz.id = 'carregamento';
  raiz.setAttribute('role', 'progressbar');
  raiz.setAttribute('aria-valuemin', '0');
  raiz.setAttribute('aria-valuemax', '100');
  const caixa = document.createElement('div');
  caixa.className = 'caixa';
  const titulo = document.createElement('p');
  titulo.className = 'titulo';
  titulo.textContent = rotulos.titulo;
  const trilho = document.createElement('div');
  trilho.className = 'trilho';
  const barra = document.createElement('div');
  barra.className = 'barra';
  trilho.append(barra);
  const texto = document.createElement('p');
  texto.className = 'texto';
  texto.dataset.campo = 'carregamento';
  caixa.append(titulo, trilho, texto);
  raiz.append(caixa);
  document.body.append(raiz);

  function atualizar(fracao: number): void {
    const f = Math.min(1, Math.max(0, fracao));
    barra.style.width = `${Math.round(f * 100)}%`;
    texto.textContent = textoDoCarregamento(f);
    raiz.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    if (f >= 1) raiz.remove();
  }
  atualizar(0);
  return { atualizar };
}
