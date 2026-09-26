/**
 * Icones da interface: o trecho `icones` do manifesto (CLAUDE.md §9) e o
 * resolvedor puro de `ui/icones.ts`.
 *
 * Como na F17f, nenhuma imagem e aberta: a dimensao do PNG sai do cabecalho
 * IHDR. O que se prova:
 *  - todo icone de predio aponta um predio que existe, um arquivo que existe
 *    com a dimensao declarada, e uma BASE versionada (sem ela nao ha como
 *    refazer o icone sem refazer o conjunto);
 *  - todo campo do HUD tem icone, e so os campos do HUD tem;
 *  - o resolvedor devolve URL para icone declarado e resolvido, e `null` nos
 *    dois outros casos — placeholder e comportamento normal, nunca 404.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { CAMPOS } from '../src/ui/hud';
import { urlDoIconeDePredio } from '../src/ui/icones';
import type { IconesDoManifesto } from '../src/ui/icones';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { icones?: IconesDoManifesto };
const icones = manifesto.icones ?? {};

function dimensaoDoPng(caminho: string): [number, number] {
  const b = readFileSync(caminho);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('icones da interface — o manifesto descreve o que existe', () => {
  it('todo icone de predio aponta predio, arquivo, dimensao e base reais', () => {
    const predios = icones.predios ?? {};
    expect(Object.keys(predios).length).toBeGreaterThan(0);
    for (const [id, e] of Object.entries(predios)) {
      expect(gameData.predios.some((p) => p.id === id), id).toBe(true);
      expect(e).toBeDefined();
      const caminho = `assets/${e!.arquivo}`;
      expect(existsSync(caminho), caminho).toBe(true);
      expect(dimensaoDoPng(caminho), caminho).toEqual([...e!.tamanho]);
      const origem = (e as { origem?: { base?: string } }).origem;
      expect(origem?.base, id).toBeTruthy();
      expect(existsSync(`assets/${origem!.base}`), origem!.base).toBe(true);
    }
  });

  it('cada campo do HUD tem icone PNG com a dimensao declarada, e so eles', () => {
    const hud = icones.hud ?? {};
    expect(Object.keys(hud).sort()).toEqual([...CAMPOS].sort());
    for (const campo of CAMPOS) {
      const e = hud[campo]!;
      const caminho = `assets/${e.arquivo}`;
      expect(e.arquivo.endsWith('.png'), caminho).toBe(true);
      expect(existsSync(caminho), caminho).toBe(true);
      expect(dimensaoDoPng(caminho), caminho).toEqual([...e.tamanho]);
    }
  });
});

describe('icones da interface — o resolvedor', () => {
  const urls = { 'sprites/storehouse/icone.png': '/x/storehouse.png' };
  const fixture: IconesDoManifesto = {
    predios: {
      storehouse: { arquivo: 'sprites/storehouse/icone.png', tamanho: [72, 72] },
      quarry: { arquivo: 'sprites/quarry/icone.png', tamanho: [72, 72] },
    },
  };

  it('icone declarado e resolvido pelo bundler vira URL', () => {
    expect(urlDoIconeDePredio(fixture, urls, 'storehouse')).toBe('/x/storehouse.png');
  });

  it('predio sem icone, ou icone que o bundler nao resolveu, e null — nunca 404', () => {
    expect(urlDoIconeDePredio(fixture, urls, 'sawmill')).toBeNull();
    expect(urlDoIconeDePredio(fixture, urls, 'quarry')).toBeNull();
    expect(urlDoIconeDePredio(undefined, urls, 'storehouse')).toBeNull();
  });
});

afterAll(() => {
  gravarEvidencia('icones-ui', {
    feature: 'icones-ui',
    prediosComIcone: Object.keys(icones.predios ?? {}),
    prediosSemIcone: gameData.predios.map((p) => p.id).filter((id) => !(icones.predios ?? {})[id]),
    hud: Object.keys(icones.hud ?? {}),
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F06 (menu) e F05b (HUD)',
  });
});
