import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { atlasesParaCarregar } from '../src/render/sprites';
import { chaveDoAtlas } from '../src/render/animacao-de-unidade';
import { assetDaCamada, type Manifesto } from '../src/render/manifesto';

const real = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const atlas = (id: string) => assetDaCamada(real, 'unidade', id)?.atlas as string;
const dados = Object.fromEntries(['militia', 'laborer', 'serf'].map((id) =>
  [atlas(id), JSON.parse(readFileSync(`assets/${atlas(id)}`, 'utf8')) as object]));
const urls = Object.fromEntries(['militia', 'laborer', 'serf'].map((id) =>
  [`sprites/units/${id}/${id}.png`, `/${id}.png`]));
const chaves = (fila: ReadonlySet<string>) => atlasesParaCarregar(real, urls, dados, fila).map((a) => a.chave).sort();

describe('D-ARTE-PIXEL-ART-MILITARES — o atlas de depuracao vence o real do mesmo tipo', () => {
  it.each([
    ['sem depuracao, os tres reais', [], ['laborer', 'militia', 'serf']],
    ['depuracao do militia tira so o real dele', ['militia'], ['laborer', 'serf']],
    ['depuracao do militia e do laborer', ['militia', 'laborer'], ['serf']],
    ['depuracao de tipo sem atlas real nao muda nada', ['woodcutter'], ['laborer', 'militia', 'serf']],
  ])('%s', (_nome, depuracao, esperado) => {
    expect(chaves(new Set(depuracao.map(chaveDoAtlas)))).toEqual(esperado.map(chaveDoAtlas));
  });

  it('o cabra e o obreiro novos tem atlas com a acao deles (atacar, trabalhar)', () => {
    expect(Object.keys(assetDaCamada(real, 'unidade', 'militia')?.animacoes ?? {})).toContain('atacar');
    expect(Object.keys(assetDaCamada(real, 'unidade', 'laborer')?.animacoes ?? {})).toContain('trabalhar');
  });
});
