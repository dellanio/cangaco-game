/**
 * Unico arquivo de `render/` que le `gameData.terreno`. O resto de `render/`
 * recebe `configDoMapa` daqui — nunca importa `../sim/data` direto. E o que a
 * F04 verifica por teste estrutural (nenhum outro arquivo de `render/`
 * importa `../sim/data`), nao por convencao.
 */
import { gameData } from '../sim/data';

export interface ConfigDoMapa {
  readonly tilePx: number;
  readonly largura: number;
  readonly altura: number;
  readonly larguraPx: number;
  readonly alturaPx: number;
}

export function criarConfigDoMapa(): ConfigDoMapa {
  const { tilePx, mapaPadrao } = gameData.terreno;
  return {
    tilePx,
    largura: mapaPadrao.largura,
    altura: mapaPadrao.altura,
    larguraPx: mapaPadrao.largura * tilePx,
    alturaPx: mapaPadrao.altura * tilePx,
  };
}

export const configDoMapa: ConfigDoMapa = criarConfigDoMapa();
