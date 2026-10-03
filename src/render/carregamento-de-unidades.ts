import type { GameState } from '../sim/state';
import type { Manifesto } from './manifesto';
import type { AtlasParaCarregar, TexturaParaCarregar } from './sprites';
import { texturasParaCarregar } from './sprites';

export type PedidoDeUnidade = TexturaParaCarregar & { readonly dados?: object };
export interface EstadoDaCarga {
  readonly estado: 'em-curso' | 'carregada' | 'falhou';
  readonly pedidos: number;
}

/** Inclui ambos os lados e unidades escondidas: visibilidade nao filtra preload. */
export function tiposPresentes(estado: GameState | null): ReadonlySet<string> {
  return new Set(estado?.unidades.ordem.flatMap(id => {
    const unidade = estado.unidades.porId[id];
    return unidade ? [unidade.tipo] : [];
  }) ?? []);
}

export function pedidosDeUnidade(
  manifesto: Manifesto,
  tipos: ReadonlySet<string>,
  urls: Readonly<Record<string, string>>,
  atlases: readonly AtlasParaCarregar[],
): PedidoDeUnidade[] {
  const somenteUnidades = {
    ...manifesto,
    assets: manifesto.assets.filter(a => a.tipo === 'unidade' && tipos.has(a.id)),
  };
  const chaves = new Set([...tipos].map(id => `unidade:${id}:atlas`));
  return [...texturasParaCarregar(somenteUnidades, urls), ...atlases.filter(a => chaves.has(a.chave))];
}

/** Fila local da cena; falhas ficam registradas, sem nova tentativa por quadro. */
export function criarCargaDeUnidades(
  carregada: (chave: string) => boolean,
  enfileirar: (pedido: PedidoDeUnidade) => void,
) {
  const cargas = new Map<string, EstadoDaCarga>();
  return {
    get estados(): Readonly<Record<string, EstadoDaCarga>> { return Object.fromEntries(cargas); },
    solicitar(pedidos: readonly PedidoDeUnidade[]): number {
      let novos = 0;
      for (const pedido of pedidos) {
        if (cargas.has(pedido.chave)) continue;
        if (carregada(pedido.chave)) {
          cargas.set(pedido.chave, { estado: 'carregada', pedidos: 0 });
          continue;
        }
        cargas.set(pedido.chave, { estado: 'em-curso', pedidos: 1 });
        enfileirar(pedido);
        novos++;
      }
      return novos;
    },
    concluir(chave: string): void {
      const carga = cargas.get(chave);
      if (carga?.estado === 'em-curso') cargas.set(chave, { ...carga, estado: 'carregada' });
    },
    falhar(chave: string): void {
      const carga = cargas.get(chave);
      if (carga) cargas.set(chave, { ...carga, estado: 'falhou' });
    },
  };
}
