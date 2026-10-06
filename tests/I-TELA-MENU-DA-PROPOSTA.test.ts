/**
 * I-TELA-MENU-DA-PROPOSTA — o menu lateral no estilo da proposta do operador (2026-10-05). A parte
 * estatica do aceite: o CSS do bloco novo so aponta PNG que existe e esta no manifesto, com a
 * dimensao real e a origem; cada sub-aba e a rua apontam o icone certo; o tema tem o texto de cada
 * secao. A estrutura do DOM (rotulos, titulos, cartoes, sem corte) e afirmada no roteiro em jogo
 * (`tools/shots/I-TELA-MENU-DA-PROPOSTA.js`): o projeto nao tem DOM de teste.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const css = readFileSync('src/ui/estilo.css', 'utf8');
const bloco = css.slice(css.indexOf('I-TELA-MENU-DA-PROPOSTA (pedido do operador'));
interface IconeDaInterface { arquivo: string; tamanho: [number, number]; licenca: string; origem: { base: string } }
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { icones: { interface: Record<string, IconeDaInterface | string> } };
/** Toda entrada com `arquivo` do trecho `icones.interface`, em qualquer profundidade (as abas sao um grupo). */
function entradas(no: unknown): IconeDaInterface[] {
  if (no === null || typeof no !== 'object') return [];
  if ('arquivo' in no) return [no as IconeDaInterface];
  return Object.values(no).flatMap(entradas);
}
const interfaceDoManifesto = entradas(manifesto.icones.interface);
const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as {
  menuBuild: { secoes: Record<string, { titulo: string; sub: string }>; rotulos: Record<string, string> };
};
const grupos = (JSON.parse(readFileSync('data/menu-build.json', 'utf8')) as { grupos: { id: string }[] }).grupos;

function dimensaoDoPng(caminho: string): [number, number] {
  const b = readFileSync(caminho);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('I-TELA-MENU-DA-PROPOSTA', () => {
  it('(2) o bloco novo so aponta PNG que existe e esta no manifesto, com a dimensao real e a origem', () => {
    const urls = [...bloco.matchAll(/url\('\.\.\/\.\.\/assets\/([^']+)'\)/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(10);
    for (const arquivo of new Set(urls)) {
      expect(existsSync(`assets/${arquivo}`), arquivo).toBe(true);
      const entrada = interfaceDoManifesto.find((e) => e.arquivo === arquivo);
      expect(entrada, `${arquivo} no manifesto icones.interface`).toBeDefined();
      expect(dimensaoDoPng(`assets/${arquivo}`), arquivo).toEqual(entrada!.tamanho);
      expect(existsSync(`assets/${entrada!.origem.base}`), entrada!.origem.base).toBe(true);
    }
  });

  it('(1) cada sub-aba do dado tem o seu icone, e a rua e o calcamento de pedra (PNG, nao a barra de tinta)', () => {
    const iconeDaSubaba: Record<string, string> = { vila: 'subaba-vila', comida: 'subaba-comer', materia: 'subaba-materia', guerra: 'subaba-guerra' };
    for (const g of grupos) {
      expect(bloco, g.id).toContain(`.subaba[data-grupo="${g.id}"]::before { background-image: url('../../assets/sprites/ui/menu/${iconeDaSubaba[g.id]}.png'); }`);
    }
    expect(bloco).toMatch(/\.glifo-estrada::before,[\s\S]*?url\('\.\.\/\.\.\/assets\/sprites\/ui\/menu\/ferramenta-rua\.png'\)/);
  });

  it('(1) o tema tem o titulo e a explicacao das ruas e rocados e de cada sub-aba, e o nome curto das ferramentas', () => {
    for (const chave of ['ferramentas', ...grupos.map((g) => g.id)]) {
      const s = tema.menuBuild.secoes[chave];
      expect(s?.titulo, chave).toBeTruthy();
      expect(s?.sub, chave).toBeTruthy();
    }
    for (const chave of ['estrada', 'demolirEstrada', 'apagarCampo']) expect(tema.menuBuild.rotulos[chave], chave).toBeTruthy();
  });

  it('o ativo das construcoes continua destacado so por ele (o que o F06 mede): sombra so no ativo', () => {
    expect(bloco).toMatch(/\.grade\[data-grupo\] \.icone \{[^}]*box-shadow: none;/);
    expect(bloco).toMatch(/\.grade\[data-grupo\] \.icone\[aria-pressed="true"\] \{[^}]*box-shadow: 0 0 0 2px/);
  });

  it('I-TELA-COR-DO-MENU: o fundo do corpo que vale na cascata e a cor da cidade do pe (#edcf9d)', () => {
    const blocos = [...css.matchAll(/(^|\n)#corpo-aba \{([^}]*)\}/g)].map((m) => m[2]!);
    const cores = blocos.flatMap((b) => [...b.matchAll(/background-color:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase()));
    expect(cores.at(-1)).toBe('#edcf9d');
  });
});
