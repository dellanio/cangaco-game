import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  depuracaoDeUnidade, quadroDoAndar, quadroPeloTempo, somarDistancia, tempoDeAnimacao, spriteDoAtlas, unidadeNaVista,
} from '../src/render/animacao-de-unidade';
import { interpolarPosicao } from '../src/render/interpolacao';
import { DIRECOES } from '../src/render/manifesto';
import type { Manifesto } from '../src/render/manifesto';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';
import config from '../data/animacao-unidade.json';

describe('D-TELA-04b (animação por distância e tempo de jogo)', () => {
  it('só trabalha quando o canvas ancorado no pé intersecta a vista', () => {
    const vista = { x: 0, y: 0, right: 100, bottom: 100 };
    expect(unidadeNaVista({ x: 50, y: 0 }, [64,96], [0.5,1], vista)).toBe(false);
    expect(unidadeNaVista({ x: 50, y: 1 }, [64,96], [0.5,1], vista)).toBe(true);
    expect(unidadeNaVista({ x: 132, y: 50 }, [64,96], [0.5,1], vista)).toBe(false);
    expect(unidadeNaVista({ x: 131, y: 50 }, [64,96], [0.5,1], vista)).toBe(true);
  });
  it.each([[0,0], [0.25,1], [1,4], [1.75,7], [2,0], [2.25,1], [4,0]])('distância %s dá quadro %s', (distancia, quadro) => {
    expect(quadroDoAndar(distancia, 2, 8)).toBe(quadro);
  });
  it('diagonal soma distância euclidiana; parada e salto não somam', () => {
    const zero = { gx: 0, gy: 0 }, diagonal = { gx: 1, gy: 1 }, longe = { gx: 5, gy: 0 };
    expect(somarDistancia(1, zero, diagonal, config.saltoMaximoTiles)).toBeCloseTo(1 + Math.SQRT2);
    expect(somarDistancia(1, zero, zero, config.saltoMaximoTiles)).toBe(1);
    expect(somarDistancia(1, zero, interpolarPosicao(zero, longe, 0.5, config.saltoMaximoTiles), config.saltoMaximoTiles)).toBe(1);
    expect(somarDistancia(1, zero, diagonal, config.saltoMaximoTiles, true)).toBe(1);
  });
  it('mesmo trajeto em cadências diferentes dá os mesmos quadros por tile', () => {
    const caminhar = (passos: number) => {
      let anterior = { gx: 0, gy: 0 }, distancia = 0;
      for (let i = 1; i <= passos; i++) {
        const atual = { gx: i / passos, gy: i / passos };
        distancia = somarDistancia(distancia, anterior, atual, config.saltoMaximoTiles); anterior = atual;
      }
      return quadroDoAndar(distancia, 2, 8);
    };
    expect(caminhar(10)).toBe(caminhar(30));
  });
  it('parado usa tick e alfa, e pausa congela o quadro', () => {
    const a = { quadros: 4, fps: 10, laco: true };
    expect(quadroPeloTempo(tempoDeAnimacao(2, 1), 10, a)).toBe(2);
    expect(quadroPeloTempo(tempoDeAnimacao(3, 1), 10, a)).toBe(3);
    expect(quadroPeloTempo(tempoDeAnimacao(3, 1), 10, a)).toBe(quadroPeloTempo(tempoDeAnimacao(3, 1), 10, a));
    expect(quadroPeloTempo(100, 10, { quadros: 6, fps: 10, laco: false })).toBe(5);
  });
  it('atlas resolve oito direções; oeste espelha, arquivo ausente cai no fallback', () => {
    const manifesto = JSON.parse(readFileSync('assets/depuracao/manifesto.json', 'utf8')) as Manifesto;
    const atlas = JSON.parse(readFileSync('assets/depuracao/serf/serf.json', 'utf8'));
    for (const d of DIRECOES) {
      const sprite = spriteDoAtlas(manifesto, 'serf', 'andar', d, 3, (_chave, frame) => !!atlas.frames[frame]);
      expect(sprite?.espelhar).toBe(['so', 'o', 'no'].includes(d));
      expect(sprite?.frame).toContain('/0003');
    }
    expect(spriteDoAtlas(manifesto, 'serf', 'andar', 's', 0, () => false)).toBeNull();
  });
  it.each([['',false], ['?depuracao',true], ['?vitrine=serf',true], ['?vitrine=laborer',false]])('gate %s = %s', (busca, ativo) => {
    expect(depuracaoDeUnidade(busca)).toBe(ativo);
  });
  it('configuração só de interface, com rejeição no funil real', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(ARQUIVOS).not.toContain('animacao-unidade');
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    for (const campo of ['saltoMaximoTiles', 'passoDaViradaTicks']) {
      expect(validarInterface(dados, { ...interfaceUi, 'animacao-unidade': { ...config, [campo]: 0 } }))
        .toContain(`interface/animacao-unidade: ${campo} precisa ser > 0`);
    }
  });
});
