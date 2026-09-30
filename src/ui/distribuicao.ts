// D-TRANSPORTE-02b — a aba Distribuicao (GDD §7.2; plano em
// docs/planos/2026-09-29-D-TRANSPORTE-02-menu-de-distribuicao.md): por mercadoria
// disputada, quanto cada tipo de casa guarda na entrada, com `−` e `+`. Le o estado pelo
// selector puro `distribuicaoDaVila` e emite `SetWareDistribution` — nunca muta
// GameState (CLAUDE.md §3).
//
// Os pares vem do dado e nao mudam na partida: os nos sao montados UMA vez e o laco so
// troca texto e `disabled`. Recriar o botao a cada quadro destruiria o no sob o dedo
// entre o `mousedown` e o `mouseup` (BUG-B).
import type { Command } from '../sim/commands';
import type { GameState } from '../sim/state';
import { distribuicaoDaVila } from '../sim/selectors';
import type { DistribuicaoDaVila } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

export interface Distribuicao {
  atualizar(estado: GameState): void;
}

type TemaDeNomes = Readonly<Record<string, { readonly nome: string } | undefined>>;
const nomesDePredio = temaSertao.predios as TemaDeNomes;
const nomesDeMercadoria = temaSertao.mercadorias as Readonly<Record<string, string | undefined>>;
const textos = temaSertao.barra.distribuicao;

interface NosDoPar {
  readonly valor: HTMLElement;
  readonly menos: HTMLButtonElement;
  readonly mais: HTMLButtonElement;
}

function botao(par: string, passo: -1 | 1, texto: string, titulo: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.distribuicao = par;
  b.dataset.passo = String(passo);
  b.textContent = texto;
  b.title = titulo;
  return b;
}

/** Monta a aba uma vez em `#distribuicao`. */
export function montarDistribuicao(emitir: (comando: Command) => void): Distribuicao {
  const raiz = document.getElementById('distribuicao');
  if (!raiz) throw new Error('distribuicao: #distribuicao nao existe no index.html');
  const aba: HTMLElement = raiz;

  const titulo = document.createElement('h2');
  titulo.textContent = textos.titulo;
  const ajuda = document.createElement('p');
  ajuda.className = 'ajuda-distribuicao';
  ajuda.textContent = textos.ajuda;
  aba.append(titulo, ajuda);

  const nos = new Map<string, NosDoPar>();
  let ultimo: DistribuicaoDaVila | null = null;

  function montar(dist: DistribuicaoDaVila): void {
    for (const linha of dist.linhas) {
      const secao = document.createElement('div');
      secao.className = 'mercadoria-disputada';
      secao.dataset.mercadoria = linha.mercadoria;
      const h3 = document.createElement('h3');
      h3.textContent = nomesDeMercadoria[linha.mercadoria] ?? linha.mercadoria;
      const ul = document.createElement('ul');
      for (const c of linha.consumidores) {
        const par = `${linha.mercadoria}|${c.tipo}`;
        const li = document.createElement('li');
        li.dataset.par = par;
        const nome = document.createElement('span');
        nome.className = 'nome';
        nome.textContent = nomesDePredio[c.tipo]?.nome ?? c.tipo;
        const valor = document.createElement('span');
        valor.className = 'valor';
        const menos = botao(par, -1, '−', textos.menos);
        const mais = botao(par, 1, '+', textos.mais);
        li.append(nome, menos, valor, mais);
        ul.append(li);
        nos.set(par, { valor, menos, mais });
      }
      secao.append(h3, ul);
      aba.append(secao);
    }
  }

  aba.addEventListener('click', (evento) => {
    const alvo = (evento.target as HTMLElement).closest<HTMLButtonElement>('button[data-distribuicao]');
    if (!alvo || alvo.disabled || ultimo === null) return;
    const [mercadoria = '', tipo = ''] = (alvo.dataset.distribuicao ?? '').split('|');
    const atual = ultimo.linhas.find((l) => l.mercadoria === mercadoria)?.consumidores.find((c) => c.tipo === tipo);
    if (atual === undefined) return;
    const quantidade = atual.valor + Number(alvo.dataset.passo);
    if (quantidade < 0 || quantidade > ultimo.maximo) return;
    emitir({ type: 'SetWareDistribution', mercadoria, tipo, quantidade });
  });

  return {
    atualizar(estado) {
      const dist = distribuicaoDaVila(estado);
      if (ultimo === null) montar(dist);
      ultimo = dist;
      for (const linha of dist.linhas) {
        for (const c of linha.consumidores) {
          const no = nos.get(`${linha.mercadoria}|${c.tipo}`);
          if (no === undefined) continue;
          const texto = String(c.valor);
          if (no.valor.textContent !== texto) no.valor.textContent = texto;
          no.menos.disabled = c.valor <= 0;
          no.mais.disabled = c.valor >= dist.maximo;
        }
      }
    },
  };
}
