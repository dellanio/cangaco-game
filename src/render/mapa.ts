/**
 * Unico arquivo de `render/` que le `gameData.terreno`. O resto de `render/`
 * recebe `configDoMapa` daqui — nunca importa `../sim/data` direto. E o que a
 * F04 verifica por teste estrutural (nenhum outro arquivo de `render/`
 * importa `../sim/data`), nao por convencao.
 */
import { gameData } from '../sim/data';
import { TERRENOS_DE_MAPA } from '../sim/data/terrenos';
import type { TerrenoDeMapa } from '../sim/data/types';
import { tipoDoTile } from '../sim/mapa';
import temaSertao from '../../data/theme-sertao.json';

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
}

export function criarConfigDoMapa(): ConfigDoMapa {
  const { tilePx, mapaPadrao, zoom } = gameData.terreno;
  return {
    tilePx,
    largura: mapaPadrao.largura,
    altura: mapaPadrao.altura,
    larguraPx: mapaPadrao.largura * tilePx,
    alturaPx: mapaPadrao.altura * tilePx,
    zoom: { niveis: zoom.niveis, inicial: zoom.inicial },
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
