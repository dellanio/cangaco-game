/**
 * I-TELA-CLIMA-VISUAL e I-TELA-RELOGIO-DO-SOL — a tela do clima: o veu de cor, a chuva e o calor pela
 * estacao, o angulo do ponteiro do relogio do sol, e o jornal avisando a troca de estacao. Regras puras.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { faseNoTick } from '../src/sim/clima';
import type { FaseDoClima } from '../src/sim/clima';
import { gotasDaChuva, particulasDoCalor, pesoDoInverno, veuDaEstacao } from '../src/render/clima-visual';
import type { ConfigDoClimaVisual } from '../src/render/clima-visual';
import { anguloDoPonteiro, faltaEmTexto } from '../src/ui/relogio-do-sol';
import { noticiasDosEventos } from '../src/ui/jornal';
import type { ConfigDoJornal, TextoDaNoticia } from '../src/ui/jornal';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';

const config = JSON.parse(readFileSync('data/clima-visual.json', 'utf8')) as ConfigDoClimaVisual;
const ciclo = gameData.clima.ciclo;
const inicioDe = (i: number): number => ciclo.slice(0, i).reduce((s, f) => s + f.ticks, 0);
const fase = (i: number, fracao: number): FaseDoClima => faseNoTick(inicioDe(i) + Math.floor(ciclo[i]!.ticks * fracao))!;

describe('I-TELA-CLIMA-VISUAL', () => {
  it('(1) o veu: a cor do inverno no inverno, a da seca na seca, e passa continuo nas transicoes', () => {
    expect(veuDaEstacao(fase(0, 0.5), config)).toEqual(config.veu.inverno);
    expect(veuDaEstacao(fase(2, 0.5), config)).toEqual(config.veu.seca);
    // as transicoes sao rampas: o peso do inverno cai na transicao para a seca e sobe na outra
    expect(pesoDoInverno(fase(1, 0))).toBeCloseTo(1, 2);
    expect(pesoDoInverno(fase(1, 0.5))).toBeCloseTo(0.5, 1);
    expect(pesoDoInverno(fase(3, 0.5))).toBeCloseTo(0.5, 1);
    // continua nas bordas: o ultimo tick de uma fase e o primeiro da seguinte quase iguais
    for (let i = 0; i < ciclo.length; i++) {
      const fim = faseNoTick(inicioDe(i + 1) - 1)!;
      const comeco = faseNoTick(inicioDe(i + 1) % inicioDe(ciclo.length))!;
      expect(Math.abs(pesoDoInverno(fim) - pesoDoInverno(comeco)), `${fim.id} -> ${comeco.id}`).toBeLessThan(0.01);
    }
    expect(veuDaEstacao(null, config)).toBeNull();
  });

  it('a chuva cai no inverno e nao na seca; o calor sobe na seca e nao no inverno; deterministicos', () => {
    expect(gotasDaChuva(fase(0, 0.5), 10, 800, 600, config)).toHaveLength(config.chuva.maximo);
    expect(gotasDaChuva(fase(2, 0.5), 10, 800, 600, config)).toHaveLength(0);
    expect(particulasDoCalor(fase(2, 0.5), 10, 800, 600, config)).toHaveLength(config.calor.maximo);
    expect(particulasDoCalor(fase(0, 0.5), 10, 800, 600, config)).toHaveLength(0);
    expect(gotasDaChuva(fase(0, 0.5), 37.5, 800, 600, config)).toEqual(gotasDaChuva(fase(0, 0.5), 37.5, 800, 600, config));
    // e a chuva cai: a mesma gota mais embaixo um instante depois (dentro do ciclo de queda)
    const [a] = gotasDaChuva(fase(0, 0.5), 10, 800, 600, config);
    const [b] = gotasDaChuva(fase(0, 0.5), 10.2, 800, 600, config);
    expect(b!.y).not.toBe(a!.y);
  });

  it('(2) o jornal: season-changed vira a noticia da estacao, com a manchete do tema', () => {
    const jornal = JSON.parse(readFileSync('data/jornal.json', 'utf8')) as ConfigDoJornal;
    const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { jornal: { noticias: Record<string, TextoDaNoticia> } };
    const n = noticiasDosEventos([{ type: 'season-changed', estacao: 'transicaoSeca' }], 100, jornal, tema.jornal.noticias);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ chave: 'estacao:transicaoSeca', manchete: 'A seca vem aí' });
    for (const f of ciclo) {
      expect(noticiasDosEventos([{ type: 'season-changed', estacao: f.id }], 1, jornal, tema.jornal.noticias), f.id).toHaveLength(1);
    }
  });

  it('o validador recusa a noticia de estacao que falta e o veu sem cor', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    const tema = interfaceUi['theme-sertao'];
    const semSeca = { ...tema, jornal: { ...tema.jornal, noticias: { ...tema.jornal.noticias, 'estacao:seca': undefined } } };
    expect(validarInterface(dados, { ...interfaceUi, 'theme-sertao': semSeca }))
      .toContain("interface/jornal: evento 'season-changed': a noticia 'estacao:seca' precisa de manchete e texto em theme-sertao.json jornal.noticias");
    expect(validarInterface(dados, { ...interfaceUi, 'clima-visual': { ...config, veu: { ...config.veu, seca: { alfa: 0.1 } } } }))
      .toContain('interface/clima-visual: veu.seca precisa de cor #rrggbb e alfa em [0, 1]');
  });
});

describe('I-TELA-RELOGIO-DO-SOL', () => {
  it('(1) o ponteiro anda o setor da fase pela fracao dela (setores iguais, fases de tamanhos diferentes)', () => {
    const n = ciclo.length;
    expect(anguloDoPonteiro(fase(0, 0), n)).toBe(0);
    expect(anguloDoPonteiro(fase(0, 0.5), n)).toBeCloseTo(45, 0);
    expect(anguloDoPonteiro(fase(1, 0), n)).toBe(90);
    expect(anguloDoPonteiro(fase(2, 0.5), n)).toBeCloseTo(225, 0);
    expect(anguloDoPonteiro(fase(3, 0.999), n)).toBeLessThan(360);
    // monotono ao longo do ciclo
    let anterior = -1;
    for (let t = 0; t < inicioDe(n); t += 97) {
      const a = anguloDoPonteiro(faseNoTick(t)!, n);
      expect(a).toBeGreaterThanOrEqual(anterior);
      anterior = a;
    }
  });

  it('o tempo ate a proxima fase, em m:ss de relogio', () => {
    expect(faltaEmTexto(fase(0, 0), gameData.tempo.tickMs)).toBe('5:00');
    expect(faltaEmTexto(fase(1, 0), gameData.tempo.tickMs)).toBe('1:00');
    expect(faltaEmTexto(fase(2, 0.5), gameData.tempo.tickMs)).toBe('3:00');
  });

  it('(2) a arte do Codex esta no manifesto, com a dimensao e a origem', () => {
    const m = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { icones: { interface: Record<string, { arquivo: string; tamanho: number[]; origem: { base: string } }> } };
    for (const k of ['relogioMostrador', 'relogioPonteiro']) {
      const e = m.icones.interface[k]!;
      const b = readFileSync(`assets/${e.arquivo}`);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)], k).toEqual(e.tamanho);
      expect(readFileSync(`assets/${e.origem.base}`).length, k).toBeGreaterThan(0);
    }
  });
});
