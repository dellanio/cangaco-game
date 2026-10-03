import manifestoJson from '../../assets/depuracao/manifesto.json';
import atlasJson from '../../assets/depuracao/serf/serf.json';
import pngUrl from '../../assets/depuracao/serf/serf.png?url';
import militiaJson from '../../assets/depuracao/militia/militia.json';
import militiaUrl from '../../assets/depuracao/militia/militia.png?url';
import woodcutterJson from '../../assets/depuracao/woodcutter/woodcutter.json';
import woodcutterUrl from '../../assets/depuracao/woodcutter/woodcutter.png?url';
import laborerJson from '../../assets/depuracao/laborer/laborer.json';
import laborerUrl from '../../assets/depuracao/laborer/laborer.png?url';
import type { Manifesto } from './manifesto';
import { chaveDoAtlas } from './animacao-de-unidade';

export const manifestoDeDepuracao = manifestoJson as unknown as Manifesto;
/** JSON não gera requisição: o loader só busca o PNG quando a URL habilita depuração. */
export const atlasDeDepuracao = { chave: chaveDoAtlas('serf'), url: pngUrl, dados: atlasJson };
export const atlasesDeDepuracao = [atlasDeDepuracao,
  { chave: chaveDoAtlas('militia'), url: militiaUrl, dados: militiaJson },
  { chave: chaveDoAtlas('woodcutter'), url: woodcutterUrl, dados: woodcutterJson },
  { chave: chaveDoAtlas('laborer'), url: laborerUrl, dados: laborerJson },
];
