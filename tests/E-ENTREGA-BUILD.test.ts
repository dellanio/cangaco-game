/**
 * E-ENTREGA-BUILD — o jogo fora do dev server, a metade headless.
 *
 * A regra de "o dist/ esta limpo" (`tools/conferir-dist-regra.js`), por tabela: arquivo de
 * `assets/base/` (pelo conteudo, nao pelo nome) e pagina de depuracao no manifesto do build
 * reprovam. Quem a roda contra o dist/ de verdade e o `npm run build` (`tools/conferir-dist.js`),
 * e o roteiro `tools/shots/E-ENTREGA-BUILD.js` (`npm run shot:dist`) joga o dist/ servido. Aqui
 * tambem: o texto da tela de carregamento.
 */
import { describe, it, expect } from 'vitest';
import { conferirDist, MODULOS_DE_DEPURACAO } from '../tools/conferir-dist-regra.js';
import { textoDoCarregamento } from '../src/ui/carregamento';
import temaSertao from '../data/theme-sertao.json';

const sprite = { caminho: 'dist/assets/storehouse-abc.png', sha256: 'aaa', bytes: 1000 };
const js = { caminho: 'dist/assets/index-xyz.js', sha256: 'bbb', bytes: 5000 };
const daBase = { caminho: 'assets/base/storehouse/base.png', sha256: 'ccc' };
const manifesto = { 'index.html': { file: 'assets/index-xyz.js' } };

describe('E-ENTREGA-BUILD — a regra do dist/ limpo', () => {
  it('limpo: sem arquivo da base e sem depuracao, e soma o tamanho', () => {
    const r = conferirDist({ dist: [sprite, js], base: [daBase], manifesto });
    expect(r).toEqual({ problemas: [], arquivos: 2, bytes: 6000 });
  });

  it('um arquivo da base, mesmo com outro nome, reprova', () => {
    const copiado = { caminho: 'dist/assets/nome-inocente-123.png', sha256: daBase.sha256, bytes: 9 };
    const r = conferirDist({ dist: [sprite, copiado], base: [daBase], manifesto });
    expect(r.problemas).toEqual([`${copiado.caminho} e o arquivo ${daBase.caminho} de assets/base/`]);
  });

  it('o mesmo NOME de um arquivo da base, com outro conteudo, nao reprova', () => {
    const homonimo = { caminho: 'dist/assets/base.png', sha256: 'ddd', bytes: 9 };
    expect(conferirDist({ dist: [homonimo], base: [daBase], manifesto }).problemas).toEqual([]);
  });

  it('cada pagina de depuracao no manifesto reprova', () => {
    expect(MODULOS_DE_DEPURACAO.length).toBeGreaterThan(0);
    for (const modulo of MODULOS_DE_DEPURACAO) {
      const r = conferirDist({ dist: [js], base: [], manifesto: { ...manifesto, [modulo]: { file: 'assets/x.js' } } });
      expect(r.problemas, modulo).toEqual([`a pagina de depuracao ${modulo} entrou no build`]);
    }
  });

  it('sem dist/ ou sem manifesto, reprova dizendo o que falta', () => {
    expect(conferirDist({ dist: [], base: [], manifesto }).problemas[0]).toMatch(/npm run build/);
    expect(conferirDist({ dist: [js], base: [], manifesto: null }).problemas[0]).toMatch(/--manifest/);
  });
});

describe('E-ENTREGA-BUILD — a tela de carregamento', () => {
  it('o texto do progresso, de 0 a 100, preso nas pontas', () => {
    const molde = temaSertao.carregamento.progresso;
    expect(textoDoCarregamento(0)).toBe(molde.replace('{pct}', '0'));
    expect(textoDoCarregamento(0.456)).toBe(molde.replace('{pct}', '46'));
    expect(textoDoCarregamento(1)).toBe(molde.replace('{pct}', '100'));
    expect(textoDoCarregamento(1.7)).toBe(molde.replace('{pct}', '100'));
    expect(textoDoCarregamento(-1)).toBe(molde.replace('{pct}', '0'));
  });
});
