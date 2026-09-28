/**
 * Unico arquivo de `render/` que le `gameData.terreno`. O resto de `render/`
 * recebe `configDoMapa` daqui — nunca importa `../sim/data` direto. E o que a
 * F04 verifica por teste estrutural (nenhum outro arquivo de `render/`
 * importa `../sim/data`), nao por convencao.
 */
import { gameData } from '../sim/data';
import type { RecursoNoTile } from '../sim/state';
import { TERRENOS_DE_MAPA } from '../sim/data/terrenos';
import type { TerrenoDeMapa } from '../sim/data/types';
import { tipoDoTile } from '../sim/mapa';
import temaSertao from '../../data/theme-sertao.json';

import type { DadosDaCamera } from '../input/navegacao';

export interface ConfigDoMapa {
  readonly tilePx: number;
  readonly largura: number;
  readonly altura: number;
  readonly larguraPx: number;
  readonly alturaPx: number;
  /** F18a — os passos de zoom e o nivel de abertura, de `data/terrain.json`.
   *  Dado de render: zoom nao muda regra nenhuma e `sim/` nao sabe que ele
   *  existe. Quem anda pela lista e `render/zoom.ts`. */
  readonly zoom: { readonly niveis: readonly number[]; readonly inicial: number };
  /** F-D2 — a navegacao por teclado, de `data/terrain.json`. Chega aqui pelo
   *  mesmo funil do zoom: nenhum outro arquivo de `render/` (nem `input/`)
   *  importa `sim/data` para ler isto. */
  readonly camera: DadosDaCamera;
}

export function criarConfigDoMapa(): ConfigDoMapa {
  const { tilePx, mapaPadrao, zoom, camera } = gameData.terreno;
  return {
    tilePx,
    largura: mapaPadrao.largura,
    altura: mapaPadrao.altura,
    larguraPx: mapaPadrao.largura * tilePx,
    alturaPx: mapaPadrao.altura * tilePx,
    zoom: { niveis: zoom.niveis, inicial: zoom.inicial },
    camera: {
      velocidadeInicialPxPorSegundo: camera.velocidadeInicialPxPorSegundo,
      aceleracaoPxPorSegundo2: camera.aceleracaoPxPorSegundo2,
      tetoPxPorSegundo: camera.tetoPxPorSegundo,
    },
  };
}

export const configDoMapa: ConfigDoMapa = criarConfigDoMapa();

/**
 * F-T1 — a camada de terreno para desenhar, e o segundo motivo de este arquivo
 * ser funil: ele e o UNICO de `render/` que importa `../sim/mapa`. A cena recebe
 * daqui uma grade de codigos e uma lista de cores no MESMO indice; ela nao sabe
 * o que e agua nem o que e montanha, so pinta o codigo.
 *
 * O codigo e o indice em `TERRENOS_DE_MAPA` (`sim/data/terrenos.ts`), o mesmo
 * que o A* usa. Um segundo vocabulario aqui seria a maneira mais rapida de a
 * tela discordar da simulacao — o jogador veria terra onde o caminho enxerga
 * agua.
 */
export interface TerrenoDeRender {
  /** Os tipos na ordem do codigo. Publicado porque o roteiro de screenshot
   *  conta por NOME, nao por indice. */
  readonly tipos: readonly TerrenoDeMapa[];
  /** A cor de cada codigo, em `#rrggbb`, vinda de `theme-sertao.json`. */
  readonly cores: readonly string[];
  /** Um codigo por tile, row-major pela largura abaixo. */
  readonly codigos: Uint8Array;
  readonly largura: number;
  readonly altura: number;
}

export function criarTerrenoDeRender(): TerrenoDeRender {
  const { largura, altura } = configDoMapa;
  const cores = TERRENOS_DE_MAPA.map((tipo) => {
    const cor = (temaSertao.terreno as Record<string, string | undefined>)[tipo];
    // Sem cor, a cena desenharia o terreno com a cor de outro (ou com nada) e o
    // jogador levaria a recusa de `canPlace` sem ter visto o motivo na tela.
    if (typeof cor !== 'string') {
      throw new Error(`render/mapa: theme-sertao.json nao tem cor para o terreno '${tipo}'.`);
    }
    return cor;
  });

  const codigos = new Uint8Array(largura * altura);
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      // `tipoDoTile` e a porta unica de leitura (F-T1): o render decodifica
      // linha/legenda tanto quanto a simulacao decodifica, ou seja, nunca.
      const tipo = tipoDoTile(gx, gy);
      codigos[gy * largura + gx] = tipo === null ? 0 : TERRENOS_DE_MAPA.indexOf(tipo);
    }
  }
  return { tipos: TERRENOS_DE_MAPA, cores, codigos, largura, altura };
}

export const terrenoDeRender: TerrenoDeRender = criarTerrenoDeRender();


/**
 * F-T2a (desenho MINIMO) — a camada de RECURSO para desenhar. Pelo mesmo
 * criterio do terreno: a cena recebe daqui codigos e cores no mesmo indice e
 * nao sabe o que e rocha nem o que e arvore.
 *
 * A diferenca em relacao ao terreno e de onde vem o dado. Terreno e imutavel e
 * sai de `gameData`; recurso tem ONDE imutavel (o mapa) e QUANTO mutavel
 * (`state.recursos`), e e o QUANTO que o jogador precisa ver mudar — o item
 * pede que ele veja o tile ESGOTAR. Por isso o codigo de cada tile se calcula do
 * ESTADO, a cada leitura, e nao uma vez no carregamento.
 *
 * Codigos: 0 e "nada aqui" (tile transparente), 1..N sao os tipos na ordem de
 * `tipos`, e N+1 e ESGOTADO — o tile que ja foi cortado e ficou com quantidade
 * zero (regime `porAcao`). Esgotado tem UM codigo so, nao um por tipo: o
 * desenho minimo distingue "ha recurso" de "havia recurso", e a arte por tipo e
 * a F-TR.
 */
export interface RecursosDeRender {
  /** Os tipos na ordem do codigo (codigo = indice + 1). O roteiro conta por
   *  NOME, como no terreno. */
  readonly tipos: readonly string[];
  /** Cor por CODIGO, em `#rrggbb`: indice 0 nao e usado (tile vazio), 1..N sao
   *  os tipos e N+1 e o esgotado. */
  readonly cores: readonly string[];
  readonly codigoEsgotado: number;
  /** F-REPL-e — ticks do tile replantado ate maduro, por tipo; 0 em quem nao repoe.
   *  E o numero que `render/crescimento.ts` divide em estados. */
  readonly ticksDeCrescer: Readonly<Record<string, number>>;
}

export function criarRecursosDeRender(): RecursosDeRender {
  const tipos = Object.keys(gameData.recursos.tipos);
  const doTema = (temaSertao as { recursos?: Record<string, string | undefined> }).recursos ?? {};
  const corDe = (chave: string): string => {
    const cor = doTema[chave];
    // Mesmo motivo do terreno: sem cor, o marcador sairia com a cor de outro
    // tipo (ou sumido), e o jogador plantaria a pedreira no escuro — que e
    // exatamente o que o desenho minimo existe para evitar.
    if (typeof cor !== 'string') {
      throw new Error(`render/mapa: theme-sertao.json nao tem cor para o recurso '${chave}'.`);
    }
    return cor;
  };
  return {
    tipos,
    cores: ['#000000', ...tipos.map(corDe), corDe('esgotado')],
    codigoEsgotado: tipos.length + 1,
    ticksDeCrescer: Object.fromEntries(tipos.map((tipo) => [
      tipo, gameData.recursos.tipos[tipo]?.reposicao?.ticksDeCrescer ?? 0,
    ])),
  };
}

export const recursosDeRender: RecursosDeRender = criarRecursosDeRender();

/**
 * F18i — a cor `#rrggbb` do marcador de um tipo de recurso, para quem desenha
 * FORA da camada de tiles (o canteiro do campo, `render/campos.ts`). Existe para
 * o casamento id -> cor continuar sendo UM, aqui, como diz o `_doc` do bloco
 * `recursos` do tema: ler `theme-sertao.json` numa segunda camada seria a
 * segunda verdade, e ela divergiria na primeira cultura nova.
 *
 * Tipo desconhecido cai na cor do esgotado em vez de lancar: `criarRecursosDeRender`
 * ja reprovou no carregamento se faltasse cor, e uma camada de desenho nao e o
 * lugar de derrubar a partida.
 */
export function corDoRecurso(tipo: string, config: RecursosDeRender = recursosDeRender): string {
  const indice = config.tipos.indexOf(tipo);
  return config.cores[indice + 1] ?? config.cores[config.codigoEsgotado] ?? '#000000';
}

/** O codigo do tile a partir do que o ESTADO diz que sobrou ali. Puro: e a
 *  mesma funcao que a cena usa para pintar e que o teste usa para afirmar. */
export function codigoDoRecurso(
  recurso: RecursoNoTile | undefined, config: RecursosDeRender = recursosDeRender,
): number {
  if (recurso === undefined) return 0;
  if (recurso.quantidade <= 0) return config.codigoEsgotado;
  const indice = config.tipos.indexOf(recurso.tipo);
  return indice < 0 ? 0 : indice + 1;
}
