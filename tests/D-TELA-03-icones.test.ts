/**
 * D-TELA-03a (a carga sobre o serf com icone) e D-TELA-03b (a pilha da casa com icone): as duas
 * cadeias puras de `src/render/icone-da-mercadoria.ts`, sobre o `icones.mercadorias` real (D-ARTE-01).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import {
  chaveDoIcone, entradasDosIcones, fonteDaPilha, marcaDaCarga,
} from '../src/render/icone-da-mercadoria';
import type { IconesDeMercadoria } from '../src/render/icone-da-mercadoria';
import { chaveDeTextura, type Manifesto } from '../src/render/manifesto';
import { ESTADO_DA_PILHA } from '../src/render/manifesto-camadas';
import { rotuloDaCarga } from '../src/render/rotulo-da-carga';
import { texturasDosIcones, texturasParaCarregar } from '../src/render/sprites';
import { gravarEvidencia } from './helpers/evidence';

const icones = (JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { icones: { mercadorias: IconesDeMercadoria } })
  .icones.mercadorias;
const comIcone = entradasDosIcones(icones).map(([id]) => id);
const semIcone = gameData.economia.mercadorias.filter((m) => !comIcone.includes(m));
const tudoCarregado = (): boolean => true;
const nadaCarregado = (): boolean => false;

describe('D-TELA-03a — a marca da carga', () => {
  // D-ARTE-PIXEL-ART-CIVIS: as 28 mercadorias passaram a ter sprite (antes eram 8, D-ARTE-01).
  it('todas as mercadorias desenham o icone, na chave que o loader usa', () => {
    expect([...comIcone].sort()).toEqual([...gameData.economia.mercadorias].sort());
    for (const m of comIcone) {
      expect(marcaDaCarga(m, icones, tudoCarregado, rotuloDaCarga), m).toEqual({ como: 'icone', chave: chaveDoIcone(m) });
    }
  });

  it('sem icone, o texto de hoje (o nome do tema): nenhuma carga some', () => {
    expect(semIcone).toEqual([]);
    for (const m of gameData.economia.mercadorias) {
      expect(marcaDaCarga(m, undefined, tudoCarregado, rotuloDaCarga), m).toEqual({ como: 'texto', rotulo: rotuloDaCarga(m) });
    }
  });

  it('icone declarado mas nao carregado cai no texto, e nao some', () => {
    expect(marcaDaCarga('timber', icones, nadaCarregado, rotuloDaCarga)).toEqual({ como: 'texto', rotulo: rotuloDaCarga('timber') });
    expect(marcaDaCarga('timber', undefined, tudoCarregado, rotuloDaCarga).como).toBe('texto');
  });

  it('o loader enfileira um icone por mercadoria com arquivo resolvido, e nenhum sem ele', () => {
    const urls = Object.fromEntries(entradasDosIcones(icones).map(([, i]) => [i.arquivo, `/url/${i.arquivo}`]));
    const fila = texturasDosIcones(icones, urls);
    expect(fila.map((t) => t.chave).sort()).toEqual(comIcone.map(chaveDoIcone).sort());
    expect(texturasDosIcones(icones, {})).toEqual([]);
  });

  it('BUG-ROTEIRO-D-TELA-03-MACHADO-COM-ICONE: o `?semArte` tira o icone e a pilha da mercadoria, e so dela', () => {
    const urls = Object.fromEntries(entradasDosIcones(icones).map(([, i]) => [i.arquivo, `/url/${i.arquivo}`]));
    const semMachado = texturasDosIcones(icones, urls, new Set(['hand_axe'])).map((t) => t.chave);
    expect(comIcone).toContain('hand_axe');
    expect(semMachado).not.toContain(chaveDoIcone('hand_axe'));
    expect(semMachado).toContain(chaveDoIcone('timber'));
    expect(semMachado).toHaveLength(comIcone.length - 1);
    // a pilha (o PNG proprio da mercadoria) sai pelo mesmo conjunto; o vinho e a mercadoria que tem pilha
    const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
    const todasAsUrls = new Proxy({}, { get: (_a, k) => `/url/${String(k)}` }) as Readonly<Record<string, string>>;
    const comVinho = texturasParaCarregar(manifesto, todasAsUrls).map((t) => t.chave);
    const semVinho = texturasParaCarregar(manifesto, todasAsUrls, new Set(['wine'])).map((t) => t.chave);
    expect(comVinho.filter((c) => c.startsWith('pilha:wine:')).length).toBeGreaterThan(0);
    expect(semVinho.filter((c) => c.startsWith('pilha:wine:'))).toEqual([]);
    expect(semVinho.filter((c) => c.startsWith('pilha:fish:'))).toEqual(comVinho.filter((c) => c.startsWith('pilha:fish:')));
  });
});

describe('D-TELA-03b — a fonte da pilha: PNG pilha -> icone -> quadrado', () => {
  const pilha = (m: string): string => chaveDeTextura('pilha', m, ESTADO_DA_PILHA);

  it('com PNG pilha, ele vence o icone', () => {
    expect(fonteDaPilha('stone', icones, (c) => c === pilha('stone') || c === chaveDoIcone('stone')))
      .toEqual({ fonte: 'pilha', chave: pilha('stone') });
  });

  it('sem PNG pilha, o icone', () => {
    expect(fonteDaPilha('stone', icones, (c) => c === chaveDoIcone('stone'))).toEqual({ fonte: 'icone', chave: chaveDoIcone('stone') });
  });

  it('sem os dois, o quadrado: a mercadoria sem icone e o icone nao carregado', () => {
    // a mercadoria sem icone: desde a D-ARTE-PIXEL-ART-CIVIS todas tem, entao o caso vai num manifesto sem icones
    expect(fonteDaPilha('hand_axe', undefined, (c) => c !== pilha('hand_axe'))).toEqual({ fonte: 'quadrado' });
    expect(fonteDaPilha('stone', icones, nadaCarregado)).toEqual({ fonte: 'quadrado' });
    gravarEvidencia('D-TELA-03-icones', { comIcone, semIcone: semIcone.length });
  });
});
