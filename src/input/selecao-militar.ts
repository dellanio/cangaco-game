/**
 * F26b — o GRUPO militar que o jogador tem na mao. Estado de INTERFACE, irmao da
 * `selecao` de predio (F13b): vive fora do `GameState`, nao e salvo e nao entra em
 * comparacao de determinismo.
 *
 * So guarda ids, na ordem em que entraram (e a ordem da lista do `MoveUnits`, que da o
 * tile de cada um). Unidade que morre continua aqui ate a proxima selecao: quem le
 * filtra pelo estado. Como `selecao.ts`, NAO importa `sim/state`.
 */
export type OuvinteDaSelecaoMilitar = (ids: readonly string[]) => void;

export interface SelecaoMilitar {
  readonly ids: readonly string[];
  /** Troca o grupo inteiro. */
  definir(ids: readonly string[]): void;
  /** Soma ao grupo (shift), sem repetir. */
  somar(ids: readonly string[]): void;
  limpar(): void;
  aoMudar(ouvinte: OuvinteDaSelecaoMilitar): () => void;
}

export function criarSelecaoMilitar(): SelecaoMilitar {
  let ids: readonly string[] = [];
  const ouvintes = new Set<OuvinteDaSelecaoMilitar>();

  function trocar(novos: readonly string[]): void {
    const sem = [...new Set(novos)];
    if (sem.length === ids.length && sem.every((id, i) => id === ids[i])) return;
    ids = sem;
    for (const ouvinte of ouvintes) ouvinte(ids);
  }

  return {
    get ids() {
      return ids;
    },
    definir(novos) {
      trocar(novos);
    },
    somar(novos) {
      trocar([...ids, ...novos]);
    },
    limpar() {
      trocar([]);
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
