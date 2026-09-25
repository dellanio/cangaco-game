/**
 * A ferramenta ativa: o que o jogador tem na mao agora — uma planta de predio
 * (F06/F07), a estrada ou a demolicao de estrada (F08), a terra de plantio ou a
 * borracha dela (F18i). E estado de INTERFACE, nao
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
export type ModoDaFerramenta =
  | 'nenhum' | 'predio' | 'estrada' | 'demolir-estrada' | 'campo' | 'apagar-campo';

/** Recebe o predio ativo (`null` fora do modo `predio`), o modo e a cultura ativa
 *  (`null` fora do modo `campo`). As assinaturas antigas, com um ou dois
 *  argumentos, continuam compativeis: os extras sao ignorados por quem nao os le. */
export type OuvinteDaFerramenta = (
  predioAtivo: string | null, modo: ModoDaFerramenta, culturaAtiva: string | null,
) => void;

export interface Ferramenta {
  readonly modo: ModoDaFerramenta;
  /** O predio da planta, ou `null` (modo diferente de `predio`). */
  readonly predioAtivo: string | null;
  /**
   * F18i — a cultura que a ferramenta de terra carrega (`corn`), ou `null` fora do
   * modo `campo`. Campo SEPARADO de `predioAtivo`, e nao o mesmo campo com dois
   * significados: `predioAtivo` e lido pela planta fantasma, e um id de recurso ali
   * faria a fantasma procurar um predio chamado `corn`.
   *
   * Existe porque a ferramenta de terra e UMA POR CULTURA (a lista vem do dado, de
   * `culturasAraveis`), e o comando `PlowField` precisa do id neutro. Nenhum literal
   * de cultura mora em `input/` nem em `ui/`.
   */
  readonly culturaAtiva: string | null;
  /** Modo `predio` com esse id; `null` e o mesmo que `cancelar()`. */
  selecionar(idDoPredio: string | null): void;
  selecionarEstrada(): void;
  selecionarDemolicao(): void;
  /** F18i — modo `campo` com essa cultura. Escolher a que JA esta na mao larga a
   *  ferramenta, pela mesma razao do `alternar` (BUG-A): e o primeiro gesto de quem
   *  quer sair do modo, e a comparacao mora aqui, nunca no botao. */
  alternarCampo(recurso: string): void;
  /**
   * BUG-A — escolher o que JA esta escolhido larga a ferramenta. E o primeiro
   * gesto que o jogador tenta quando quer sair do modo de construir, e sem ele a
   * unica saida era o `Esc`, que nada na tela anuncia. Nao substitui o `Esc`:
   * soma a ele.
   *
   * Existe aqui, e nao no botao do menu, porque a comparacao e com o estado da
   * ferramenta — no menu ela viraria uma segunda copia de `modo`/`predioAtivo`,
   * que e como duas verdades comecam a divergir.
   */
  alternar(novoModo: ModoDaFerramenta, novoPredio?: string | null): void;
  cancelar(): void;
  /** Devolve o desinscrever. So avisa quando o modo ou o predio de fato mudou. */
  aoMudar(ouvinte: OuvinteDaFerramenta): () => void;
}

export function criarFerramenta(): Ferramenta {
  let modo: ModoDaFerramenta = 'nenhum';
  let predioAtivo: string | null = null;
  let culturaAtiva: string | null = null;
  const ouvintes = new Set<OuvinteDaFerramenta>();

  function definir(
    novoModo: ModoDaFerramenta, novoPredio: string | null, novaCultura: string | null = null,
  ): void {
    if (novoModo === modo && novoPredio === predioAtivo && novaCultura === culturaAtiva) return;
    modo = novoModo;
    predioAtivo = novoPredio;
    culturaAtiva = novaCultura;
    for (const ouvinte of ouvintes) ouvinte(predioAtivo, modo, culturaAtiva);
  }

  return {
    get modo() {
      return modo;
    },
    get predioAtivo() {
      return predioAtivo;
    },
    get culturaAtiva() {
      return culturaAtiva;
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
    alternarCampo(recurso) {
      // mesma ordem do `alternar`: a comparacao antes do `definir`, senao o caso
      // "ja esta ativo" sairia calado em vez de largar a ferramenta.
      if (modo === 'campo' && culturaAtiva === recurso) definir('nenhum', null);
      else definir('campo', null, recurso);
    },
    alternar(novoModo, novoPredio = null) {
      // `definir` sai calado quando nada muda, entao a comparacao tem de vir
      // ANTES dela: e justamente o caso "ja esta ativo" que precisa virar
      // `nenhum` em vez de nao fazer nada.
      if (novoModo === modo && novoPredio === predioAtivo) definir('nenhum', null);
      else definir(novoModo, novoPredio);
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
