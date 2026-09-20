/**
 * A ferramenta ativa: o que o jogador tem na mao agora — uma planta de predio
 * (F06/F07), a estrada ou a demolicao de estrada (F08). E estado de INTERFACE, nao
 * de jogo: vive aqui, fora do `GameState`, e some com `Esc`. Nenhum comando nasce
 * daqui; a cena so le `predioAtivo`/`modo` e a `EntradaDoMapa` decide se um clique
 * ou um arrasto vira comando.
 *
 * Este arquivo nao importa `sim/state` de proposito (guarda em
 * `tests/F06-build.test.ts`): se a ferramenta precisasse do estado para existir,
 * ela teria ido parar no lugar errado.
 *
 * Objeto mutavel simples, no molde da ponte da F05b (`render/ponte.ts`), mais
 * `aoMudar` para o painel destacar o item ativo sem varrer nada.
 */
export type ModoDaFerramenta = 'nenhum' | 'predio' | 'estrada' | 'demolir-estrada';

/** Recebe o predio ativo (`null` fora do modo `predio`) e o modo. A assinatura
 *  antiga, so com `predioAtivo`, continua compativel: o segundo argumento e extra. */
export type OuvinteDaFerramenta = (predioAtivo: string | null, modo: ModoDaFerramenta) => void;

export interface Ferramenta {
  readonly modo: ModoDaFerramenta;
  /** O predio da planta, ou `null` (modo diferente de `predio`). */
  readonly predioAtivo: string | null;
  /** Modo `predio` com esse id; `null` e o mesmo que `cancelar()`. */
  selecionar(idDoPredio: string | null): void;
  selecionarEstrada(): void;
  selecionarDemolicao(): void;
  cancelar(): void;
  /** Devolve o desinscrever. So avisa quando o modo ou o predio de fato mudou. */
  aoMudar(ouvinte: OuvinteDaFerramenta): () => void;
}

export function criarFerramenta(): Ferramenta {
  let modo: ModoDaFerramenta = 'nenhum';
  let predioAtivo: string | null = null;
  const ouvintes = new Set<OuvinteDaFerramenta>();

  function definir(novoModo: ModoDaFerramenta, novoPredio: string | null): void {
    if (novoModo === modo && novoPredio === predioAtivo) return;
    modo = novoModo;
    predioAtivo = novoPredio;
    for (const ouvinte of ouvintes) ouvinte(predioAtivo, modo);
  }

  return {
    get modo() {
      return modo;
    },
    get predioAtivo() {
      return predioAtivo;
    },
    selecionar(idDoPredio) {
      if (idDoPredio === null) definir('nenhum', null);
      else definir('predio', idDoPredio);
    },
    selecionarEstrada() {
      definir('estrada', null);
    },
    selecionarDemolicao() {
      definir('demolir-estrada', null);
    },
    cancelar() {
      definir('nenhum', null);
    },
    aoMudar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
