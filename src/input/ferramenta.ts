/**
 * A ferramenta ativa: qual predio a planta fantasma carrega agora. E estado de
 * INTERFACE, nao de jogo — vive aqui, fora do `GameState`, e some com `Esc`.
 * Nenhum comando nasce daqui (o `PlaceBlueprint` e a F07); a cena so le
 * `predioAtivo` e pergunta `canPlace` a `sim/`.
 *
 * Este arquivo nao importa `sim/state` de proposito (guarda em
 * `tests/F06-build.test.ts`): se a ferramenta precisasse do estado para existir,
 * ela teria ido parar no lugar errado.
 *
 * Objeto mutavel simples, no molde da ponte da F05b (`render/ponte.ts`), mais
 * `aoMudar` para o painel destacar o item ativo sem varrer nada.
 */
export type OuvinteDaFerramenta = (predioAtivo: string | null) => void;

export interface Ferramenta {
  readonly predioAtivo: string | null;
  selecionar(idDoPredio: string | null): void;
  cancelar(): void;
  /** Devolve o desinscrever. So avisa quando o valor de fato mudou. */
  aoMudar(ouvinte: OuvinteDaFerramenta): () => void;
}

export function criarFerramenta(): Ferramenta {
  let predioAtivo: string | null = null;
  const ouvintes = new Set<OuvinteDaFerramenta>();

  function selecionar(idDoPredio: string | null): void {
    if (idDoPredio === predioAtivo) return;
    predioAtivo = idDoPredio;
    for (const ouvinte of ouvintes) ouvinte(predioAtivo);
  }

  return {
    get predioAtivo() {
      return predioAtivo;
    },
    selecionar,
    cancelar() {
      selecionar(null);
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
