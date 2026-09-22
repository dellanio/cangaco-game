/**
 * O predio que o jogador tem aberto (F13b). E estado de INTERFACE, irmao da
 * `ferramenta` (F06): vive fora do `GameState`, nao e salvo, nao entra em save
 * nem em comparacao de determinismo, e some com `Esc`.
 *
 * So guarda o id, nunca o objeto do predio. Se o predio cair, quem le descobre
 * pelo seletor (`painelDaEscola` devolve `null`) — nao ha copia de estado de
 * jogo aqui para ficar velha.
 *
 * Como `ferramenta.ts`, este arquivo NAO importa `sim/state` de proposito: uma
 * selecao que precisasse do estado para existir teria ido parar no lugar errado.
 * Quem resolve "que predio e este tile" e o `main.ts`, com `predioNoTile`.
 */
export type OuvinteDaSelecao = (predio: string | null) => void;

export interface Selecao {
  /** Id do predio selecionado, ou `null`. */
  readonly predio: string | null;
  selecionar(predio: string | null): void;
  limpar(): void;
  /** Devolve o desinscrever. So avisa quando de fato mudou. */
  aoMudar(ouvinte: OuvinteDaSelecao): () => void;
}

export function criarSelecao(): Selecao {
  let predio: string | null = null;
  const ouvintes = new Set<OuvinteDaSelecao>();

  function definir(novo: string | null): void {
    if (novo === predio) return;
    predio = novo;
    for (const ouvinte of ouvintes) ouvinte(predio);
  }

  return {
    get predio() {
      return predio;
    },
    selecionar(novo) {
      definir(novo);
    },
    limpar() {
      definir(null);
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
