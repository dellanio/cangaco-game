import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { particulasDaFumaca, type ConfigDaFumaca } from '../src/render/fumaca';
import type { DadosDoVento } from '../src/render/vento';
import type { GameState } from '../src/sim/state';
import { ehEntradaDePredio, type Manifesto } from '../src/render/manifesto';
import { dadosDoTrabalho } from '../src/render/predios';
import { quadroDaFumaca } from '../src/render/trabalho';
import { validarFumaca, validarInterface } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/fumaca.json', 'utf8')) as ConfigDaFumaca;
const vento = JSON.parse(readFileSync('data/vento.json', 'utf8')) as DadosDoVento;
const ponto = { x: 24, y: 36 };
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;

describe('D-TELA-FUMACA-DA-PADARIA', () => {
  it('e deterministica, sobe, segue o vento e respeita o teto com tick e alfa', () => {
    let maior = 0;
    let pares = 0;
    for (const direcao of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const v = { ...vento, direcao };
      for (let tick = 0; tick < 200; tick += 1) for (const alfa of [0, 0.5, 0.9]) {
        const atual = particulasDaFumaca(config, v, tick, alfa, ponto, 0, null);
        expect(particulasDaFumaca(config, v, tick, alfa, ponto, 0, null)).toEqual(atual);
        expect(atual.length).toBeLessThanOrEqual(config.maximoPorChamine);
        maior = Math.max(maior, atual.length);
        const proximas = new Map(particulasDaFumaca(config, v, tick + 1, alfa, ponto, 0, null).map((p) => [p.id, p]));
        for (const p of atual) {
          const proxima = proximas.get(p.id);
          if (!proxima) continue;
          expect(proxima.y).toBeLessThan(p.y);
          // Retira a subida para medir apenas a componente carregada pelo vento.
          expect((proxima.x - p.x) * direcao.x
            + (proxima.y - p.y + config.subidaTilesPorTick) * direcao.y).toBeGreaterThan(0);
          expect(proxima.opacidade).toBeLessThan(p.opacidade);
          pares += 1;
        }
      }
    }
    expect(pares).toBeGreaterThan(0);
    expect(particulasDaFumaca({ ...config, maximoPorChamine: 2 }, vento, 100, 0, ponto, 0, null)).toHaveLength(2);
    expect(particulasDaFumaca(config, { ...vento, forca: 0 }, 15, 0.5, ponto, 0, null).every((p) => p.x === ponto.x)).toBe(true);
    gravarEvidencia('D-TELA-FUMACA-DA-PADARIA', { ticks: 200, alfas: [0, 0.5, 0.9], direcoes: 4, maior, pares,
      pontoNoPng: [147, 18], tamanhoDoPng: [192, 192], fracao: [147 / 192, 18 / 192] });
  });

  it('sem trabalho nao nasce nada e a parada deixa as particulas morrerem aos poucos', () => {
    expect(particulasDaFumaca(config, vento, 40, 0, ponto, null, null)).toEqual([]);
    expect(particulasDaFumaca(config, vento, 9, 0.9, ponto, 10, null)).toEqual([]);
    const parouEm = 100;
    const naParada = particulasDaFumaca(config, vento, parouEm, 0, ponto, 10, parouEm);
    expect(naParada.length).toBeGreaterThan(0);
    let anterior = naParada.length;
    const contagens = new Set<number>([anterior]);
    for (let tick = parouEm; tick <= parouEm + config.vidaTicks; tick += 1) {
      const atual = particulasDaFumaca(config, vento, tick, 0.5, ponto, 10, parouEm);
      expect(atual.every((p) => p.nascimento < parouEm)).toBe(true);
      expect(atual.length).toBeLessThanOrEqual(anterior);
      contagens.add(atual.length);
      anterior = atual.length;
    }
    expect(contagens.size).toBeGreaterThan(2);
    expect(particulasDaFumaca(config, vento, parouEm + config.vidaTicks, 0, ponto, 10, parouEm)).toEqual([]);
  });

  it('declara a chamine da bakery e usa o predicado existente', () => {
    const dados = dadosDoTrabalho(manifesto);
    // A arte dos 17 predios (PR #2, 2026-10-02) trouxe chamines medidas em outros predios; o
    // escopo deste item era a padaria, e nao "so a padaria". Toda chamine declarada chega aos
    // dados do render com o mesmo ponto do manifesto, e a da padaria continua a medida aqui.
    const comChamine = manifesto.assets.filter(ehEntradaDePredio).filter((a) => a.ancoras?.trabalho?.fumaca !== undefined);
    expect(comChamine.map((a) => a.id)).toContain('bakery');
    for (const a of comChamine) expect(dados.ancoras[a.id]?.trabalho?.fumaca, a.id).toEqual(a.ancoras?.trabalho?.fumaca);
    expect(dados.ancoras['bakery']?.trabalho?.fumaca).toEqual([147 / 192, 18 / 192]);
    const jogo = (JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8')) as { estado: GameState }).estado;
    const p = jogo.predios.porId['padaria'];
    const u = jogo.unidades.porId['forneiro'];
    if (p?.estado !== 'completo' || u === undefined || p.producao === null) throw new Error('save sem padaria e forneiro');
    const ativo = { ...p, producao: { ...p.producao, progresso: 1 } };
    const ocupante = { ...u, fsm: 'trabalhando' };
    expect(quadroDaFumaca(ativo, ocupante, 1, dados)).not.toBeNull();
    for (const parado of [{ ...ativo, pausado: true }, { ...ativo, ocupante: null }, { ...ativo, producao: null },
      { ...ativo, producao: { ...ativo.producao, progresso: -1 } }]) {
      expect(quadroDaFumaca(parado, ocupante, 1, dados)).toBeNull();
    }
    expect(quadroDaFumaca(ativo, { ...ocupante, fsm: 'esperando_insumo' }, 1, dados)).toBeNull();
  });

  it('valida como interface, inclusive pelo funil real, e reprova dado invalido', () => {
    expect(ARQUIVOS_DA_INTERFACE).toContain('fumaca');
    expect(ARQUIVOS).not.toContain('fumaca');
    const erros = (entrada: unknown) => { const saida: string[] = []; validarFumaca(entrada, saida); return saida; };
    expect(erros(config)).toEqual([]);
    for (const campo of ['maximoPorChamine', 'vidaTicks', 'intervaloTicks']) {
      expect(erros({ ...config, [campo]: 0 })).toContain(`interface/fumaca: ${campo} precisa ser inteiro > 0`);
    }
    expect(erros({ ...config, cor: 'cinza' })).toContain('interface/fumaca: cor precisa ser #rrggbb');
    expect(erros({ ...config, forca: 1 })).toContain('interface/fumaca: o vento vem de data/vento.json');
    expect(erros({ ...config, subidaTilesPorTick: 0.001 })).toContain('interface/fumaca: subidaTilesPorTick precisa superar velocidadeTilesPorTick para subir em qualquer vento');
    const dados = Object.fromEntries(ARQUIVOS.map((id) => [id, JSON.parse(readFileSync(`data/${id}.json`, 'utf8'))]));
    const ui = Object.fromEntries(ARQUIVOS_DA_INTERFACE.map((id) => [id, JSON.parse(readFileSync(`data/${id}.json`, 'utf8'))]));
    expect(validarInterface(dados, ui)).toEqual([]);
    expect(validarInterface(dados, { ...ui, fumaca: { ...config, vidaTicks: 0 } }))
      .toContain('interface/fumaca: vidaTicks precisa ser inteiro > 0');
  });
});
