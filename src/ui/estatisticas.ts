// D-TELA-01 — a aba de estatisticas (GDD §7.2; plano em
// docs/planos/2026-09-29-D-TELA-01-aba-de-estatisticas.md): predios e gente do jogador
// por tipo, com os parados em destaque. So le o estado pelo selector puro
// `estatisticasDaVila` e escreve texto — nunca muta GameState, nunca varre predio por
// conta propria (CLAUDE.md §3), como o `hud.ts`.
import type { GameState } from '../sim/state';
import { estatisticasDaVila } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

export interface Estatisticas {
  atualizar(estado: GameState): void;
}

type TemaDeNomes = Readonly<Record<string, { readonly nome: string } | undefined>>;
const nomesDePredio = temaSertao.predios as TemaDeNomes;
const nomesDeCivil = temaSertao.civis as TemaDeNomes;
const textos = temaSertao.barra.estatisticas;

interface LinhaNaTela {
  readonly tipo: string;
  readonly numero: string;
  readonly detalhe: string;
  readonly ociosos: number | null;
}

/** Uma lista com titulo. As linhas so sao recriadas quando o conjunto de tipos muda; no
 *  resto, so o `textContent` de quem mudou. */
function montarLista(raiz: HTMLElement, chave: 'predios' | 'gente', titulo: string, nomes: TemaDeNomes) {
  const secao = document.createElement('div');
  secao.className = 'lista-estatistica';
  secao.dataset.lista = chave;
  const h3 = document.createElement('h3');
  h3.textContent = titulo;
  const ul = document.createElement('ul');
  secao.append(h3, ul);
  raiz.append(secao);

  let tipos = '';
  const nos = new Map<string, { li: HTMLLIElement; numero: HTMLElement; detalhe: HTMLElement }>();

  function escrever(no: HTMLElement, texto: string): void {
    if (no.textContent !== texto) no.textContent = texto;
  }

  return (linhas: readonly LinhaNaTela[]): void => {
    const agora = linhas.map((l) => l.tipo).join(',');
    if (agora !== tipos) {
      tipos = agora;
      nos.clear();
      ul.replaceChildren(...linhas.map((l) => {
        const li = document.createElement('li');
        li.dataset.tipo = l.tipo;
        const nome = document.createElement('span');
        nome.className = 'nome';
        nome.textContent = nomes[l.tipo]?.nome ?? l.tipo;
        const numero = document.createElement('span');
        numero.className = 'numero';
        const detalhe = document.createElement('span');
        detalhe.className = 'detalhe';
        li.append(nome, numero, detalhe);
        nos.set(l.tipo, { li, numero, detalhe });
        return li;
      }));
    }
    for (const l of linhas) {
      const no = nos.get(l.tipo);
      if (no === undefined) continue;
      escrever(no.numero, l.numero);
      escrever(no.detalhe, l.detalhe);
      const parados = l.ociosos ?? 0;
      if (l.ociosos === null) delete no.li.dataset.ociosos;
      else if (no.li.dataset.ociosos !== String(l.ociosos)) no.li.dataset.ociosos = String(l.ociosos);
      no.li.classList.toggle('ocioso', parados > 0);
    }
  };
}

/** Monta as duas listas uma vez em `#estatisticas`, depois do `#hud`. */
export function montarEstatisticas(): Estatisticas {
  const raiz = document.getElementById('estatisticas');
  if (!raiz) throw new Error('estatisticas: #estatisticas nao existe no index.html');
  const predios = montarLista(raiz, 'predios', textos.predios, nomesDePredio);
  const gente = montarLista(raiz, 'gente', textos.gente, nomesDeCivil);

  return {
    atualizar(estado) {
      const est = estatisticasDaVila(estado);
      predios(est.predios.map((l) => ({
        tipo: l.tipo,
        numero: String(l.completos),
        detalhe: l.emObra > 0 ? textos.emObra.replace('{n}', String(l.emObra)) : '',
        ociosos: null,
      })));
      gente(est.gente.map((l) => ({
        tipo: l.tipo,
        numero: String(l.total),
        detalhe: l.ociosos !== null && l.ociosos > 0 ? textos.ociosos.replace('{n}', String(l.ociosos)) : '',
        ociosos: l.ociosos,
      })));
    },
  };
}
