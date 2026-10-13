/**
 * I-TERRENO-DEZ-MAPAS-DA-CAMPANHA — as dez fases da campanha em dado (`data/campanha/`), com mapa.
 * Desenho em `docs/planos/2026-10-10-campanha-dez-fases.md`. As fases ainda nao rodam como missao
 * (nao ha camada de missao na sim): o que se afirma aqui e que o DADO e jogavel pela sim de hoje,
 * pelo A* e pelo `step`.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { buscarCaminho, tileAndavel } from '../src/sim/pathfinding';
import type { TileDeGrid } from '../src/sim/estradas';
import { validarCampanha } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { escreverFase } from '../tools/fase-formato.mjs';
import type { Fase } from '../tools/fase-formato.mjs';
import { exportar, importar } from '../tools/mapa-tiled.mjs';
import type { Tmj } from '../tools/mapa-tiled.mjs';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const PASTA = join('data', 'campanha');
const semCr = (t: string): string => t.replace(/\r\n/g, '\n');
const ARQUIVOS_DAS_FASES = readdirSync(PASTA).filter((n) => n.endsWith('.json')).sort();
const FASES: Fase[] = ARQUIVOS_DAS_FASES.map((n) => JSON.parse(readFileSync(join(PASTA, n), 'utf8')) as Fase);
const DADOS: Record<string, unknown> = Object.fromEntries(ARQUIVOS.map((n) => [n, JSON.parse(readFileSync(join('data', `${n}.json`), 'utf8')) as unknown]));
const comoMapa = (fs: Record<string, Fase>): Record<string, unknown> => fs;

// I-TERRENO-FASE-NA-SIM: o dado e o estado da fase vem da sim (src/sim/fase.ts), que nasceu daqui.

/** Os tiles andaveis vizinhos de qualquer tile da lista (quem colhe para ao lado do recurso). */
function vizinhosAndaveis(s: GameState, dados: GameData, tiles: readonly (readonly [number, number])[]): TileDeGrid[] {
  const saida: TileDeGrid[] = [];
  for (const [gx, gy] of tiles) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = { gx: gx + dx, gy: gy + dy };
      if ((dx || dy) && tileAndavel(s, t, 'livre', dados)) saida.push(t);
    }
  }
  return saida;
}

describe('I-TERRENO-DEZ-MAPAS-DA-CAMPANHA', () => {
  it('sao dez fases, de 1 a 10, cada uma com o nome do arquivo', () => {
    expect(FASES.map((f) => f.fase)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(FASES.map((f) => `${f.id}.json`)).toEqual(ARQUIVOS_DAS_FASES);
  });

  it('(1) as dez passam no validador; e os defeitos de cada regra sao recusados', () => {
    const porNome = Object.fromEntries(FASES.map((f) => [f.id, f]));
    expect(validarCampanha(DADOS, comoMapa(porNome))).toEqual([]);
    const base = FASES[0] as Fase;
    // As coordenadas dos defeitos saem do mapa, e nao de literal: a suite tambem roda no mundo
    // transladado (F18c-1c), onde a fase anda +K. Agua: os dois primeiros tiles de agua da fase 1.
    const aguas: [number, number][] = [];
    base.mapa.linhas.forEach((l, gy) => { for (let gx = 0; gx < l.length; gx++) if (base.mapa.legenda[l[gx] as string] === 'agua') aguas.push([gx, gy]); });
    const [pa, ta] = [aguas[0] as [number, number], aguas[1] as [number, number]];
    const { largura: L, altura: A } = (DADOS['terrain'] as { mapaPadrao: { largura: number; altura: number } }).mapaPadrao;
    const casos: [string, (f: Fase) => void, RegExp][] = [
      ['peixe na terra', (f) => { f.mapa.recursos['fish']?.push([5, 5]); }, /'fish' em 'grama' em \(5,5\)/],
      ['pedra no chao', (f) => { f.mapa.recursos['rock'] = [...(f.mapa.recursos['rock'] ?? []), [6, 6]]; }, /'rock' em 'grama'/],
      ['predio na agua', (f) => { f.lados[0]?.predios.push({ id: 'quarry', gx: pa[0], gy: pa[1] }); }, new RegExp(`'quarry' em \\(${pa[0]},${pa[1]}\\) tem o tile`)],
      ['predio que nao existe', (f) => { f.lados[1]?.predios.push({ id: 'castelo', gx: 100, gy: 100 }); }, /predio 'castelo' nao existe/],
      ['tropa que nao existe', (f) => { f.lados[1]?.unidades.push({ tipo: 'dragao', quantidade: 1, gx: 90, gy: 90 }); }, /unidade 'dragao' nao existe/],
      ['tropa nascendo na agua', (f) => { f.lados[1]?.unidades.push({ tipo: 'militia', quantidade: 1, gx: ta[0], gy: ta[1] }); }, new RegExp(`nasce em \\(${ta[0]},${ta[1]}\\)`)],
      ['dois recursos no tile', (f) => { const [x, y] = f.mapa.recursos['tree']?.[0] ?? [0, 0]; f.mapa.recursos['grapes'] = [[x, y]]; }, /dois recursos/],
      ['objetivo fora do vocabulario', (f) => { f.objetivos.vitoria.push({ tipo: 'explorar' }); }, /objetivo 'explorar' fora do vocabulario/],
      ['onda de lado que nao existe', (f) => { f.ondas.push({ aos_segundos: 10, lado: 7, de: { gx: 100, gy: 100 }, tropas: [] }); }, /onda do lado 7/],
      ['mapa de outro tamanho', (f) => { f.mapa.largura = 64; }, new RegExp(`mapa precisa ser ${L}x${A}`)],
    ];
    for (const [nome, estragar, erro] of casos) {
      const f = structuredClone(base);
      estragar(f);
      expect(validarCampanha(DADOS, comoMapa({ [f.id]: f })).join('\n'), nome).toMatch(erro);
    }
    // a liberacao repetida e entre fases: a fase 2 liberando de novo a tropa da fase 1
    const f2 = structuredClone(FASES[1] as Fase);
    f2.libera.tropas.push('militia');
    expect(validarCampanha(DADOS, comoMapa({ [base.id]: base, [f2.id]: f2 })).join('\n')).toMatch(/'militia', ja liberada na fase 1/);
  });

  it('(1b) ida e volta pelo Tiled das dez fases, byte a byte (o aceite 1 do I-TERRENO-MAPA-NO-TILED)', () => {
    for (const [i, fase] of FASES.entries()) {
      const texto = semCr(readFileSync(join(PASTA, ARQUIVOS_DAS_FASES[i] as string), 'utf8'));
      expect(escreverFase(fase), fase.id).toBe(texto);
      const tmj = JSON.parse(semCr(readFileSync(join('tools', 'tiled', 'fases', `${fase.id}.tmj`), 'utf8'))) as Tmj;
      expect(tmj, `${fase.id}: o .tmj no disco e o exportar da fase`).toEqual(exportar(fase));
      expect(escreverFase(importar(tmj)), fase.id).toBe(texto);
    }
  });

  it('(2) pelo A* da sim: do inicio do jogador se chega a pedra e a arvore (fase de construir) e ao inimigo, em toda fase', () => {
    const medido: Record<string, Record<string, number | null>> = {};
    for (const fase of FASES) {
      const dados = dadosDaFase(fase.id);
      const s = criarFase(fase.id, dados);
      const inicio = fase.lados[0]?.unidades[0];
      if (inicio === undefined) throw new Error(`${fase.id}: sem unidade do jogador`);
      const de = { gx: inicio.gx, gy: inicio.gy };
      const custo = (alvos: TileDeGrid[]): number | null => (alvos.length === 0 ? null : buscarCaminho(s, de, alvos, 'livre', dados)?.custo ?? null);
      const inimigo = fase.lados.filter((l) => l.lado !== 0);
      const alvosDoInimigo: TileDeGrid[] = [
        ...inimigo.flatMap((l) => l.unidades.map((u) => ({ gx: u.gx, gy: u.gy }))),
        ...inimigo.flatMap((l) => l.predios.flatMap((p) => vizinhosAndaveis(s, dados, [[p.gx, p.gy - 1]]))),
        ...fase.ondas.map((o) => o.de),
      ].filter((t) => tileAndavel(s, t, 'livre', dados));
      medido[fase.id] = {
        pedra: custo(vizinhosAndaveis(s, dados, fase.mapa.recursos['rock'] ?? [])),
        arvore: custo(vizinhosAndaveis(s, dados, fase.mapa.recursos['tree'] ?? [])),
        inimigo: custo(alvosDoInimigo),
      };
      expect(medido[fase.id]?.['inimigo'], `${fase.id}: o inimigo`).not.toBeNull();
      if (fase.modo === 'construir') {
        expect(medido[fase.id]?.['pedra'], `${fase.id}: a pedra`).not.toBeNull();
        expect(medido[fase.id]?.['arvore'], `${fase.id}: a arvore`).not.toBeNull();
      }
    }
    gravarEvidencia('I-TERRENO-DEZ-MAPAS-DA-CAMPANHA-alcance', medido);
  });

  it('(2b) a fase 4 (Boqueirao): a vila tem uma entrada larga e duas estreitas pela serra, e o resto e agua', () => {
    const f4 = FASES[3] as Fase;
    const andavel = (gx: number, gy: number): boolean => ['g', 'c', 'a'].includes(f4.mapa.linhas[gy]?.[gx] ?? 'w');
    const agua = (gx: number, gy: number): boolean => f4.mapa.linhas[gy]?.[gx] === 'w';
    // o anel da serra tem centro 12 tiles a leste e 10 ao sul do armazem da vila (64,82 no mapa gerado)
    // e raio 18 a 25: percorre o meio dele (21,5) e conta as passagens. O centro sai do armazem, e nao
    // de literal: a suite tambem roda no mundo transladado (F18c-1c).
    const armazem = f4.lados[0]?.predios.find((p) => p.id === 'storehouse');
    if (armazem === undefined) throw new Error('a fase 4 precisa do armazem do jogador');
    const [cx, cy] = [armazem.gx + 12, armazem.gy + 10];
    const corridas: { inicio: number; tiles: Set<string>; agua: boolean }[] = [];
    let atual: { inicio: number; tiles: Set<string>; agua: boolean } | null = null;
    for (let passo = 0; passo < 3600; passo++) {
      const a = (passo / 3600) * 2 * Math.PI;
      const gx = Math.round(cx + 21.5 * Math.cos(a));
      const gy = Math.round(cy + 21.5 * Math.sin(a));
      const aberto = andavel(gx, gy) || agua(gx, gy);
      if (aberto) {
        if (atual === null) { atual = { inicio: passo, tiles: new Set(), agua: false }; corridas.push(atual); }
        atual.tiles.add(`${gx},${gy}`);
        if (agua(gx, gy)) atual.agua = true;
      } else atual = null;
    }
    // a corrida que da a volta no zero e a mesma
    if (corridas.length > 1 && corridas[0]?.inicio === 0 && atual !== null && atual !== corridas[0]) {
      for (const t of atual.tiles) corridas[0].tiles.add(t);
      corridas[0].agua ||= atual.agua;
      corridas.pop();
    }
    const passagens = corridas.filter((c) => !c.agua).map((c) => c.tiles.size).sort((a, b) => a - b);
    gravarEvidencia('I-TERRENO-DEZ-MAPAS-DA-CAMPANHA-boqueirao', { passagens, aguas: corridas.filter((c) => c.agua).length });
    expect(passagens).toHaveLength(3);
    expect(passagens[2]).toBeGreaterThanOrEqual(8);
    expect(passagens[0]).toBeLessThanOrEqual(4);
    expect(passagens[1]).toBeLessThanOrEqual(4);
    expect(corridas.filter((c) => c.agua)).toHaveLength(1);
  });

  it('(3) o gerador e deterministico: --conferir sai 0', () => {
    expect(() => execFileSync(process.execPath, ['tools/gerar-fases.mjs', '--conferir'], { stdio: 'pipe' })).not.toThrow();
  });

  it('(4) cada fase carrega na sim (o mapa no lugar do sertao-128) e roda 600 ticks sem violacao de invariante', () => {
    const resumo: Record<string, { unidades: number; predios: number; violacoes: number }> = {};
    for (const fase of FASES) {
      const dados = dadosDaFase(fase.id);
      expect(dados.mapa.hash, `${fase.id}: o mapa da fase e outro mapa`).not.toBe(gameData.mapa.hash);
      let s = criarFase(fase.id, dados);
      const violacoes: string[] = [];
      for (let t = 0; t < 600; t++) {
        s = step(s, [], dados);
        if (t % 100 === 0) violacoes.push(...violacoesDeInvariantes(s, dados).map((v) => `t${s.tick}: ${v}`));
      }
      resumo[fase.id] = { unidades: s.unidades.ordem.length, predios: s.predios.ordem.length, violacoes: violacoes.length };
      expect(violacoes, fase.id).toEqual([]);
    }
    gravarEvidencia('I-TERRENO-DEZ-MAPAS-DA-CAMPANHA-sim', resumo);
  }, 120_000);
});
