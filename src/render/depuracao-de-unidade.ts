import manifestoJson from '../../assets/depuracao/manifesto.json';
import atlasJson from '../../assets/depuracao/serf/serf.json';
import pngUrl from '../../assets/depuracao/serf/serf.png?url';
import type { Manifesto } from './manifesto';
import { chaveDoAtlas } from './animacao-de-unidade';

export const manifestoDeDepuracao = manifestoJson as unknown as Manifesto;
/** JSON não gera requisição: o loader só busca o PNG quando a URL habilita depuração. */
export const atlasDeDepuracao = { chave: chaveDoAtlas('serf'), url: pngUrl, dados: atlasJson };
