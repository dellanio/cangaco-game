// D-TERRENO-01 — a altura SO DE RENDER, emitida pelo gerador de mapa.
//
// O relevo da opcao A (docs/planos/estudo-relevo.md, docs/planos/relevo-a.md) e desenho: a sim
// nunca le a altura. Quem a escreve e o `tools/gerar-mapa.js`, a partir dos tipos de terreno e de
// um ruido semeado. Quatro guardas:
//
// 1. determinismo: a mesma semente emite o MESMO arquivo, igual ao do disco; outra semente, outro
//    relevo. E o `--conferir` virado teste, como o F-D3 faz com o mapa;
// 2. so relevo suave: fora de `tiposSemLimiteDeDeclive`, os 4 cantos de um tile nao diferem mais
//    que `decliveMaximoEmDegraus`. A guarda e provada nos DOIS sentidos: passa no arquivo real e
//    ACUSA uma grade feita para reprovar;
// 3. o relevo existe: o mapa nao e liso (senao a guarda 2 passaria sozinha) e a montanha e alta;
// 4. o `data/relevo.json` e validado pelo `validate:data`, e a regra acusa o `k` de volta.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validarInterface } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

type Grade = string[][];
interface CfgDaGeracao {
  semente: number;
  celulaDoRuidoEmTiles: number;
  amplitudeDoRuidoEmDegraus: number;
  decliveMaximoEmDegraus: number;
  tiposSemLimiteDeDeclive: string[];
  basePorTipo: Record<string, number>;
}
interface ArquivoDeRelevo {
  id: string;
  mapa: string;
  semente: number;
  largura: number;
  altura: number;
  linhas: string[];
}

// Por `createRequire`, como o F-D3: o teste roda o MESMO codigo que grava o arquivo.
const requireCjs = createRequire(import.meta.url);
const gerador = requireCjs('../tools/gerar-mapa.js') as {
  montarArquivo: () => { largura: number; altura: number; legenda: Record<string, string>; linhas: string[] };
  montarRelevo: (grade: Grade, cfg: CfgDaGeracao) => { largura: number; altura: number; h: number[] };
  montarArquivoDeRelevo: (cfg?: CfgDaGeracao) => ArquivoDeRelevo;
  serializarRelevo: (arquivo: ArquivoDeRelevo) => string;
  forcarDecliveMaximo: (h: number[], grade: Grade, cfg: CfgDaGeracao) => number;
  declivesForaDoLimite: (h: number[], grade: Grade, cfg: CfgDaGeracao) => [number, number, number][];
  DIGITOS_DO_RELEVO: string;
};

const relevoJson = JSON.parse(readFileSync('data/relevo.json', 'utf8')) as { geracao: CfgDaGeracao } & Record<string, unknown>;
const cfg = relevoJson.geracao;
const mapa = gerador.montarArquivo();
const grade: Grade = mapa.linhas.map((linha) => [...linha].map((ch) => mapa.legenda[ch] as string));
const noDisco = readFileSync('data/maps/sertao-128.relevo.json', 'utf8').replace(/\r\n/g, '\n');
const arquivo = JSON.parse(noDisco) as ArquivoDeRelevo;
const h = arquivo.linhas.flatMap((linha) => [...linha].map((ch) => gerador.DIGITOS_DO_RELEVO.indexOf(ch)));

/** Os 4 cantos do tile (gx, gy), na grade de vertices de largura `vl`. */
const cantos = (gx: number, gy: number, vl: number): number[] =>
  [gy * vl + gx, gy * vl + gx + 1, (gy + 1) * vl + gx, (gy + 1) * vl + gx + 1];

describe('D-TERRENO-01 — altura so de render no gerador', () => {
  it('1. a mesma semente emite o mesmo arquivo, igual ao do disco; outra semente, outro relevo', () => {
    const a = gerador.serializarRelevo(gerador.montarArquivoDeRelevo());
    const b = gerador.serializarRelevo(gerador.montarArquivoDeRelevo());
    expect(a).toBe(b);
    expect(a).toBe(noDisco);
    const outro = gerador.montarRelevo(grade, { ...cfg, semente: cfg.semente + 1 });
    expect(outro.h).not.toEqual(h);
  });

  it('o formato: um char por vertice, (L+1) x (A+1), na legenda de 0 a 35', () => {
    expect(arquivo.id).toBe('sertao-128');
    expect(arquivo.mapa).toBe('data/maps/sertao-128.json');
    expect(arquivo.semente).toBe(cfg.semente);
    expect(arquivo.largura).toBe(mapa.largura + 1);
    expect(arquivo.altura).toBe(mapa.altura + 1);
    expect(arquivo.linhas).toHaveLength(arquivo.altura);
    for (const linha of arquivo.linhas) expect(linha).toHaveLength(arquivo.largura);
    expect(gerador.DIGITOS_DO_RELEVO).toHaveLength(36);
    expect(h.every((v) => v >= 0 && v <= 35)).toBe(true);
  });

  it('2. so relevo suave: nenhum tile com limite passa do declive maximo', () => {
    expect(gerador.declivesForaDoLimite(h, grade, cfg)).toEqual([]);
  });

  it('2. a guarda acusa: um vertice a +5 no meio da grama reprova, e forcar o declive conserta', () => {
    const g: Grade = [['grama', 'grama'], ['grama', 'grama']];
    const alt = [4, 4, 4, 4, 9, 4, 4, 4, 4]; // 3x3 vertices, o do meio a +5
    const fora = gerador.declivesForaDoLimite(alt, g, cfg);
    expect(fora).toHaveLength(4);
    expect(fora.every(([, , amp]) => amp === 5)).toBe(true);
    const baixados = gerador.forcarDecliveMaximo(alt, g, cfg);
    expect(baixados).toBe(1);
    expect(alt[4]).toBe(4 + cfg.decliveMaximoEmDegraus);
    expect(gerador.declivesForaDoLimite(alt, g, cfg)).toEqual([]);
  });

  it('2. montanha e rocha nao tem limite: o mesmo vertice a +5 entre montanhas passa', () => {
    const g: Grade = [['montanha', 'montanha'], ['montanha', 'montanha']];
    const alt = [4, 4, 4, 4, 9, 4, 4, 4, 4];
    expect(gerador.declivesForaDoLimite(alt, g, cfg)).toEqual([]);
    expect(gerador.forcarDecliveMaximo(alt, g, cfg)).toBe(0);
  });

  it('3. o relevo existe: ha encosta no limite fora de montanha, e a montanha e mais alta', () => {
    const vl = arquivo.largura;
    const limitados: number[] = [];
    for (let gy = 0; gy < mapa.altura; gy += 1) {
      for (let gx = 0; gx < mapa.largura; gx += 1) {
        if (cfg.tiposSemLimiteDeDeclive.includes(grade[gy]![gx]!)) continue;
        const v = cantos(gx, gy, vl).map((i) => h[i]!);
        limitados.push(Math.max(...v) - Math.min(...v));
      }
    }
    const encostasNoLimite = limitados.filter((amp) => amp === cfg.decliveMaximoEmDegraus).length;
    const planos = limitados.filter((amp) => amp === 0).length;
    expect(encostasNoLimite).toBeGreaterThan(0);
    expect(planos).toBeGreaterThan(0);

    // vertice INTERIOR: os 4 tiles em volta sao do mesmo tipo
    const mediaInterior = (tipo: string): number => {
      const valores: number[] = [];
      for (let vy = 1; vy < mapa.altura; vy += 1) {
        for (let vx = 1; vx < mapa.largura; vx += 1) {
          const tiles = [grade[vy - 1]![vx - 1], grade[vy - 1]![vx], grade[vy]![vx - 1], grade[vy]![vx]];
          if (tiles.every((t) => t === tipo)) valores.push(h[vy * vl + vx]!);
        }
      }
      return valores.reduce((s, v) => s + v, 0) / valores.length;
    };
    const montanha = mediaInterior('montanha');
    const grama = mediaInterior('grama');
    const agua = mediaInterior('agua');
    expect(montanha).toBeGreaterThan(grama);
    expect(grama).toBeGreaterThan(agua);

    gravarEvidencia('D-TERRENO-01-relevo-do-gerador', {
      semente: cfg.semente,
      vertices: [arquivo.largura, arquivo.altura],
      degrauMinimo: Math.min(...h),
      degrauMaximo: Math.max(...h),
      tilesComLimite: limitados.length,
      tilesPlanos: planos,
      encostasNoLimite,
      mediaInterior: { montanha, grama, agua },
    });
  });

  it('o mapa do jogo nao muda: o sertao-128.json emitido continua igual ao do disco', () => {
    // O relevo tem semente propria e roda DEPOIS; o F-D3 guarda o mesmo, e este caso fica aqui
    // para a regressao aparecer no teste da feature que a causaria.
    const mapaNoDisco = readFileSync('data/maps/sertao-128.json', 'utf8').replace(/\r\n/g, '\n');
    const serializar = (requireCjs('../tools/gerar-mapa.js') as { serializar: (a: unknown) => string }).serializar;
    expect(serializar(gerador.montarArquivo())).toBe(mapaNoDisco);
  });
});

describe('D-TERRENO-01 — data/relevo.json validado', () => {
  const carregar = (lista: readonly string[]): Record<string, unknown> =>
    Object.fromEntries(lista.map((n) => [n, JSON.parse(readFileSync(`data/${n}.json`, 'utf8'))]));
  const jogo = carregar(ARQUIVOS);
  const ui = carregar(ARQUIVOS_DA_INTERFACE);
  const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const errosDoRelevo = (u: Record<string, unknown>): string[] =>
    validarInterface(jogo, u).filter((e) => e.startsWith('interface/relevo'));

  it('relevo e arquivo de interface: sim/ nao o carrega, o validate:data sim', () => {
    expect(ARQUIVOS_DA_INTERFACE).toContain('relevo');
    expect(ARQUIVOS).not.toContain('relevo');
  });

  it('o dado real passa, e nasce desligado e sem k', () => {
    expect(errosDoRelevo(ui)).toEqual([]);
    const r = ui['relevo'] as Record<string, unknown>;
    expect(r['ligado']).toBe(false);
    expect('fatorDoPlano' in r).toBe(false);
    expect(r['tetoDoTintDoSprite']).toBe(1);
  });

  const quebras: { nome: string; quebrar: (r: Record<string, any>) => void }[] = [
    { nome: 'o k de volta', quebrar: (r) => { r['fatorDoPlano'] = 0.85; } },
    { nome: 'teto do tint acima de 1', quebrar: (r) => { r['tetoDoTintDoSprite'] = 1.2; } },
    { nome: 'piso da luz em 1', quebrar: (r) => { r['fatorMinimo'] = 1; } },
    { nome: 'teto da luz do chao abaixo de 1', quebrar: (r) => { r['tetoDaLuzDoChao'] = 0.9; } },
    { nome: 'luz a pino (0 graus)', quebrar: (r) => { r['luz'].inclinacaoParaOSulGraus = 0; } },
    { nome: 'componente leste-oeste', quebrar: (r) => { r['luz'].inclinacaoParaOLesteGraus = 5; } },
    { nome: 'px por degrau zero', quebrar: (r) => { r['pxDeMundoPorDegrau'] = 0; } },
    { nome: 'tipo do mapa sem base', quebrar: (r) => { delete r['geracao'].basePorTipo.areia; } },
    { nome: 'base acima de 35', quebrar: (r) => { r['geracao'].basePorTipo.montanha = 36; } },
    { nome: 'declive maximo zero', quebrar: (r) => { r['geracao'].decliveMaximoEmDegraus = 0; } },
    { nome: 'tipo sem limite inexistente', quebrar: (r) => { r['geracao'].tiposSemLimiteDeDeclive = ['serra']; } },
    { nome: 'flag nao booleana', quebrar: (r) => { r['ligado'] = 'sim'; } },
  ];
  for (const q of quebras) {
    it(`acusa: ${q.nome}`, () => {
      const u = clonar(ui);
      q.quebrar(u['relevo'] as Record<string, any>);
      expect(errosDoRelevo(u).length).toBeGreaterThan(0);
    });
  }
});
