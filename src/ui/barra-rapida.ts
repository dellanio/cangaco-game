// I-TELA-BARRA-RAPIDA-DE-RECURSOS — a barra fina no alto do meio da tela: o icone e o total de cada
// categoria de `data/barra-rapida.json`. So le o estado, pelo seletor puro da sim
// (`estoqueDosArmazens`, o mesmo do HUD), e escreve texto: nunca muta GameState, nunca importa phaser
// (CLAUDE.md §3, §10). O nome da categoria vem do tema.
import type { GameState } from '../sim/state';
import { estoqueDosArmazens } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

export interface CategoriaDaBarra {
  readonly id: string;
  readonly mercadorias?: readonly string[];
  readonly grupo?: string;
  readonly icone: string;
}

export interface ConfigDaBarra {
  readonly categorias: readonly CategoriaDaBarra[];
}

/** As mercadorias que a categoria soma: a lista dela, ou o grupo de `economy.json`. */
export function mercadoriasDaCategoria(
  c: CategoriaDaBarra, grupos: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  if (c.grupo !== undefined) return grupos[c.grupo] ?? [];
  return c.mercadorias ?? [];
}

/** O total de cada categoria, a partir do estoque somado dos armazens. Regra pura. */
export function totaisDaBarra(
  estoque: Readonly<Record<string, number>>, config: ConfigDaBarra,
  grupos: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, number>> {
  const totais: Record<string, number> = {};
  for (const c of config.categorias) {
    totais[c.id] = mercadoriasDaCategoria(c, grupos).reduce((soma, m) => soma + (estoque[m] ?? 0), 0);
  }
  return totais;
}

export interface BarraRapida {
  atualizar(estado: GameState): void;
}

/** Monta a barra uma vez em `#barra-rapida`; `atualizar` reescreve so o numero que mudou.
 *  `urlDoIcone` devolve a URL do icone da mercadoria, ou null (sem icone, so o numero). */
export function montarBarraRapida(
  config: ConfigDaBarra, grupos: Readonly<Record<string, readonly string[]>>,
  urlDoIcone: (mercadoria: string) => string | null,
): BarraRapida {
  const raiz = document.getElementById('barra-rapida');
  if (!raiz) throw new Error('barra-rapida: #barra-rapida nao existe no index.html');
  const nomes = temaSertao.barraRapida as Readonly<Record<string, string>>;
  const valores = new Map<string, HTMLElement>();
  for (const c of config.categorias) {
    const item = document.createElement('span');
    item.className = 'item';
    item.dataset.categoria = c.id;
    item.title = nomes[c.id] ?? c.id;
    const url = urlDoIcone(c.icone);
    if (url !== null) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = nomes[c.id] ?? c.id;
      item.append(img);
    }
    const valor = document.createElement('span');
    valor.className = 'valor';
    valor.textContent = '0';
    item.append(valor);
    raiz.append(item);
    valores.set(c.id, valor);
  }
  return {
    atualizar(estado) {
      const totais = totaisDaBarra(estoqueDosArmazens(estado), config, grupos);
      for (const [id, elemento] of valores) {
        const texto = String(totais[id] ?? 0);
        if (elemento.textContent !== texto) elemento.textContent = texto;
      }
    },
  };
}
