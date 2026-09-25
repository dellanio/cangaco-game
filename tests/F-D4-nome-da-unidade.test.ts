/**
 * F-D4 — a unidade diz o oficio, nao o id.
 *
 * O que este teste guarda e o LADO DO DADO: todo tipo de unidade que
 * `data/units.json` conhece tem nome no tema, os nomes nao se repetem e os ids
 * nao colidem entre os tres grupos. Tipo novo sem verbete no tema reprova aqui,
 * que e onde o custo e baixo — na tela seria um rotulo errado ou um `undefined`.
 *
 * O que ele NAO guarda e o desenho: se o rotulo cabe sob a unidade, e quanto
 * ele mede em px, e medida de tela e vive no roteiro `tools/shots/F-D4.js`
 * (CLAUDE.md §8 — feature que muda a tela tem screenshot).
 */
import { describe, it, expect } from 'vitest';
import unitsJson from '../data/units.json';
import { nomeDaUnidade, GRUPOS_DE_UNIDADE } from '../src/render/nome-de-unidade';
import { gravarEvidencia } from './helpers/evidence';

type GrupoDoDado = { readonly tipos: readonly { readonly id: string }[] };

const TIPOS: readonly string[] = GRUPOS_DE_UNIDADE.flatMap(
  (grupo) => ((unitsJson as unknown as Record<string, GrupoDoDado>)[grupo]?.tipos ?? []).map((t) => t.id),
);

describe('F-D4 — o nome do oficio vem do tema, por tipo neutro', () => {
  it('todo tipo de data/units.json tem nome no tema', () => {
    expect(TIPOS.length).toBeGreaterThan(0);
    const semNome = TIPOS.filter((tipo) => {
      try {
        return nomeDaUnidade(tipo).length === 0;
      } catch {
        return true;
      }
    });
    expect(semNome).toEqual([]);
  });

  it('e tipo que o tema nao conhece REPROVA, em vez de virar rotulo generico', () => {
    // sem este caso o teste acima passaria com um `nomeDaUnidade` que devolve
    // sempre a mesma coisa.
    expect(() => nomeDaUnidade('tipo_que_nao_existe')).toThrow(/nao tem nome/);
  });

  it('dois oficios nunca leem igual, e os ids nao colidem entre os grupos', () => {
    const nomes = TIPOS.map(nomeDaUnidade);
    expect(new Set(nomes).size).toBe(nomes.length);
    expect(new Set(TIPOS).size).toBe(TIPOS.length);
  });

  it('grava test-output/F-D4.json', () => {
    const porTipo = Object.fromEntries(TIPOS.map((tipo) => [tipo, nomeDaUnidade(tipo)]));
    const maisLongo = TIPOS.map(nomeDaUnidade).reduce((a, b) => (b.length > a.length ? b : a));
    gravarEvidencia('F-D4', {
      feature: 'F-D4 — a unidade diz o oficio, nao o id',
      guarda: 'todo tipo de data/units.json tem nome em theme-sertao.json, os nomes sao distintos e os ids nao colidem',
      tiposCobertos: TIPOS.length,
      porTipo,
      rotuloMaisLongo: { texto: maisLongo, caracteres: maisLongo.length },
      oEncaixe: 'a largura em px e a decisao de onde o rotulo fica sao medidas no roteiro tools/shots/F-D4.js',
    });
    expect(Object.keys(porTipo)).toHaveLength(TIPOS.length);
  });
});
