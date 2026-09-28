import type { Command } from '../sim/commands';
import type { Ferramenta, ModoDaFerramenta } from './ferramenta';
import { tilesEntre } from './arrasto';

/** O tile do ponteiro, em coordenada de grid. Mesma forma do `Tile` de
 *  `render/grid.ts`, sem importa-lo: `input/` nao depende de `render/`. */
export interface TileClicado {
  readonly gx: number;
  readonly gy: number;
}

/** F26b — o ponto do ponteiro em px de MUNDO (o zoom ja desfeito pela cena). O teste de
 *  acerto da unidade mira o pixel, nao o tile: o desenho sai do centro (F18f). */
export interface PontoNoMundo {
  readonly x: number;
  readonly y: number;
}

/** F26b — os gestos da mao vazia que viram selecao ou ordem militar. Quem responde e o
 *  `main.ts`, que tem o estado e a cena; `input/` so reconhece o gesto. */
export interface GestosMilitares {
  /** Clique (esquerdo) de mao vazia, com o ponto e o shift. */
  aoClicarVazio(tile: TileClicado, ponto: PontoNoMundo | null, somar: boolean): void;
  /** Caixa arrastada de mao vazia, dos dois cantos, com o shift. */
  aoCaixa(a: PontoNoMundo, b: PontoNoMundo, somar: boolean): void;
  /** Botao direito de mao vazia no tile: a ordem militar do GDD §2.1. */
  aoOrdenar(tile: TileClicado): void;
}

/** F26b — quanto o ponteiro anda, em px de mundo, antes de o clique de mao vazia virar
 *  caixa. Numero de TELA, nao de jogo. */
export const LIMIAR_DA_CAIXA_PX = 8;

/**
 * Do mouse no mapa ao comando. A cena entrega so o TILE de cada evento; quem decide
 * o que aquilo significa e a ferramenta ativa.
 *
 *  - modo `predio` (F07): `aoClicar` emite `PlaceBlueprint` na hora. Arrastar e
 *    soltar nao fazem nada.
 *  - modo `estrada` / `demolir-estrada` (F08): um ARRASTO e UM comando, emitido ao
 *    soltar (`PlaceRoad` / `DemolishRoad`). Enquanto arrasta so ha previa
 *    (`trecho()`), que mora aqui — estado de interface, fora do `GameState`.
 *  - modo `campo` / `apagar-campo` (F18i): o MESMO arrasto, emitindo `PlowField`
 *    (com a cultura da ferramenta) ou `UnplanField`. Nenhum gesto novo: quem desenha
 *    estrada ja sabe desenhar roca.
 *  - modo `nenhum` (F13b): NENHUM comando. So avisa `aoClicarSemFerramenta`, que e
 *    quem cuida da selecao de predio. Mao vazia nunca gasta recurso.
 *
 * `aoClicar` e o botao esquerdo apertado; o nome ficou da F07.
 */
export interface EntradaDoMapa {
  aoClicar(tile: TileClicado, ponto?: PontoNoMundo, somar?: boolean): void;
  aoArrastar(tile: TileClicado, ponto?: PontoNoMundo): void;
  aoSoltar(tile: TileClicado, ponto?: PontoNoMundo): void;
  /** O ponteiro saiu do canvas com o botao apertado: CANCELA o arrasto, sem emitir. */
  aoSairDoMapa(): void;
  /**
   * BUG-A — botao direito no mapa. COM ferramenta ativa ele larga a ferramenta,
   * que e o padrao de RTS e a segunda saida do modo de construir. SEM ferramenta
   * ele nao faz nada aqui: o botao direito de mao vazia e a ordem de movimento
   * militar do GDD §2.1, e a F26 e quem a implementa.
   *
   * Devolve `true` quando CONSUMIU o gesto. Nao e enfeite: e a precedencia
   * escrita em codigo, para a F26 saber que so recebe o que voltar `false` em
   * vez de descobrir o conflito na tela.
   */
  aoClicarDireito(tile?: TileClicado): boolean;
  /** O trecho que esta sendo arrastado, em ordem; `null` fora de um arrasto. */
  trecho(): readonly TileClicado[] | null;
  /** F26b — a caixa de selecao em curso (mao vazia, ja alem do limiar), ou `null`. */
  caixa(): { readonly a: PontoNoMundo; readonly b: PontoNoMundo } | null;
}

/**
 * Sempre emite quando ha ferramenta, mesmo sobre um lugar que a sim vai recusar: a
 * decisao e de `sim/` (`canPlace` / `canPlaceRoad`, dentro do `step`). A planta e a
 * previa verde/vermelha sao so consultivas, e a sim devolve o motivo em
 * `command-rejected`.
 *
 * A ferramenta SEGUE ativa depois de emitir — o jogador planta varios predios e
 * arrasta varias estradas em sequencia. Quem a encerra e o `Esc`.
 *
 * Preencher o caminho: um `mousemove` rapido pula tiles, e uma estrada com buraco nao
 * conecta. Cada amostra e ligada a anterior por `tilesEntre` (8-conectada desde a F18e).
 *
 * SAIR DO CANVAS CANCELA o arrasto (padrao conservador): fora do canvas o Chromium
 * para de entregar `mousemove` (achado da F06), entao o ultimo trecho conhecido estaria
 * truncado num ponto que o jogador nao escolheu, e gastar pedra nisso em silencio e
 * pior que cancelar. Se o playtest mostrar irritacao, a troca para "confirma ate onde
 * chegou" e uma linha: chamar `soltar` em vez de descartar, em `aoSairDoMapa`.
 */
/** Os modos que se desenham ARRASTANDO. Um so lugar responde isso: `aoClicar`
 *  comeca o arrasto e `aoSoltar` o fecha, e dois criterios diferentes deixariam um
 *  modo que abre arrasto e nunca emite. */
export function ehModoDeArrasto(modo: ModoDaFerramenta): boolean {
  return modo === 'estrada' || modo === 'demolir-estrada'
    || modo === 'campo' || modo === 'apagar-campo';
}

/**
 * O comando de um arrasto fechado, ou `null` quando nao ha comando a emitir.
 *
 * `null` no modo `campo` sem cultura: a ferramenta de terra e uma por cultura, e sem
 * id neutro nao ha `PlowField` a montar. Nao e caso alcancavel pelo menu (quem entra
 * no modo entra com a cultura), e por isso e `null` e nao um `throw`: interface nao
 * derruba a partida por um estado que ela mesma nao cria.
 */
export function comandoDoArrasto(
  modo: ModoDaFerramenta, cultura: string | null, tiles: readonly TileClicado[],
): Command | null {
  switch (modo) {
    case 'estrada': return { type: 'PlaceRoad', tiles };
    case 'demolir-estrada': return { type: 'DemolishRoad', tiles };
    case 'campo': return cultura === null ? null : { type: 'PlowField', recurso: cultura, tiles };
    case 'apagar-campo': return { type: 'UnplanField', tiles };
    default: return null;
  }
}

export function criarEntradaDoMapa(
  ferramenta: Ferramenta, emitir: (comando: Command) => void,
  /** F13b — clique de mao vazia. Opcional: quem nao passa continua com o
   *  comportamento antigo (clique sem ferramenta nao faz nada). */
  aoClicarSemFerramenta?: (tile: TileClicado) => void,
  /** F26b — selecao e ordem militar. Quem passa isto assume o clique de mao vazia: o
   *  `aoClicarSemFerramenta` deixa de ser chamado (o `main.ts` decide soldado ou predio). */
  militares?: GestosMilitares,
): EntradaDoMapa {
  let arrasto: TileClicado[] | null = null;
  // F26b — o clique de mao vazia que pode virar caixa: onde comecou, onde esta, o shift
  let gesto: { inicio: PontoNoMundo; fim: PontoNoMundo; somar: boolean } | null = null;
  const alemDoLimiar = (g: { inicio: PontoNoMundo; fim: PontoNoMundo }): boolean =>
    Math.max(Math.abs(g.fim.x - g.inicio.x), Math.abs(g.fim.y - g.inicio.y)) >= LIMIAR_DA_CAIXA_PX;

  // Trocar de ferramenta, ou `Esc`, no meio do arrasto o cancela.
  ferramenta.aoMudar(() => {
    arrasto = null;
    gesto = null;
  });

  function estender(tile: TileClicado): void {
    if (arrasto === null) return;
    const ultimo = arrasto[arrasto.length - 1];
    if (ultimo === undefined) return;
    arrasto.push(...tilesEntre(ultimo, tile).slice(1));
  }

  return {
    aoClicar(tile, ponto, somar = false) {
      if (ferramenta.modo === 'predio' && ferramenta.predioAtivo !== null) {
        emitir({ type: 'PlaceBlueprint', buildingId: ferramenta.predioAtivo, gx: tile.gx, gy: tile.gy });
      } else if (ehModoDeArrasto(ferramenta.modo)) {
        arrasto = [tile];
      } else if (militares !== undefined) {
        // F26b: o clique seleciona NA HORA (soldado ou predio); se o ponteiro andar
        // alem do limiar antes de soltar, a caixa substitui o que o clique escolheu.
        gesto = ponto === undefined ? null : { inicio: ponto, fim: ponto, somar };
        militares.aoClicarVazio(tile, ponto ?? null, somar);
      } else {
        // Mao vazia (F13b): nao emite comando nenhum. Quem sabe que predio esta
        // neste tile e o `main.ts`, que tem o estado — `input/` nao conhece
        // `GameState` (mesma razao de `ferramenta.ts`).
        aoClicarSemFerramenta?.(tile);
      }
    },
    aoArrastar(tile, ponto) {
      if (gesto !== null && ponto !== undefined) gesto = { ...gesto, fim: ponto };
      estender(tile);
    },
    aoSoltar(tile, ponto) {
      if (gesto !== null) {
        const g = ponto === undefined ? gesto : { ...gesto, fim: ponto };
        gesto = null;
        if (alemDoLimiar(g)) militares?.aoCaixa(g.inicio, g.fim, g.somar);
        return;
      }
      if (arrasto === null) return;
      estender(tile);
      const tiles = arrasto;
      arrasto = null;
      const comando = comandoDoArrasto(ferramenta.modo, ferramenta.culturaAtiva, tiles);
      if (comando !== null) emitir(comando);
    },
    aoClicarDireito(tile) {
      if (ferramenta.modo === 'nenhum') {
        // F26b: o botao direito de mao vazia e a ordem militar (GDD §2.1)
        if (tile !== undefined) militares?.aoOrdenar(tile);
        return false;
      }
      // Cancelar tambem derruba o arrasto em curso: `criarEntradaDoMapa` ja
      // escuta `aoMudar` para isso, e nenhum comando sai daqui.
      ferramenta.cancelar();
      return true;
    },
    aoSairDoMapa() {
      arrasto = null;
      gesto = null;
    },
    trecho() {
      return arrasto === null ? null : [...arrasto];
    },
    caixa() {
      return gesto !== null && alemDoLimiar(gesto) ? { a: gesto.inicio, b: gesto.fim } : null;
    },
  };
}
