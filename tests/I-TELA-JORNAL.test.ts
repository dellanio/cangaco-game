/**
 * I-TELA-JORNAL — o jornal das noticias importantes (pedido do operador, 2026-10-05). A regra pura
 * "eventos do passo -> noticias", o teto e a ordem, e o validador.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { acrescentarNoticias, horaDoJogo, noticiasDosEventos } from '../src/ui/jornal';
import type { ConfigDoJornal, Noticia, TextoDaNoticia } from '../src/ui/jornal';
import type { GameEvent } from '../src/sim/state';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';

const config = JSON.parse(readFileSync('data/jornal.json', 'utf8')) as ConfigDoJornal;
const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { jornal: { noticias: Record<string, TextoDaNoticia> } };
const textos = tema.jornal.noticias;

describe('I-TELA-JORNAL', () => {
  it('(1) o evento do jogador vira noticia com a manchete do tema; o da IA e o sem linha, nada', () => {
    const eventos: GameEvent[] = [
      { type: 'tick-advanced', tick: 50 },
      { type: 'troop-hungry', lado: LADO_DO_JOGADOR, unidades: 3 },
      { type: 'troop-hungry', lado: LADO_DO_JOGADOR + 1, unidades: 9 },
      { type: 'peace-ended' },
    ];
    const n = noticiasDosEventos(eventos, 50, config, textos);
    expect(n.map((x) => x.chave)).toEqual(['tropaComFome', 'fimDaPaz']);
    expect(n[0]).toMatchObject({ tick: 50, manchete: textos['tropaComFome']!.manchete });
    // o {n} vira a contagem da tropa
    expect(n[0]!.texto).toContain('3');
    expect(n[0]!.texto).not.toContain('{n}');
    expect(noticiasDosEventos([{ type: 'tick-advanced', tick: 1 }], 1, config, textos)).toEqual([]);
  });

  it('(1) a mais nova fica no alto, e o teto de noticias vale', () => {
    const noticia = (tick: number): Noticia => ({ tick, chave: 'fimDaPaz', manchete: String(tick), texto: '' });
    let lista: Noticia[] = [];
    for (let t = 1; t <= config.maximoDeNoticias + 5; t++) lista = acrescentarNoticias(lista, [noticia(t)], config.maximoDeNoticias);
    expect(lista).toHaveLength(config.maximoDeNoticias);
    expect(lista[0]!.tick).toBe(config.maximoDeNoticias + 5);
    expect(lista.map((x) => x.tick)).toEqual([...lista.map((x) => x.tick)].sort((a, b) => b - a));
    // duas no mesmo passo: a ultima do passo vai primeiro
    expect(acrescentarNoticias([], [noticia(1), noticia(2)], 5).map((x) => x.tick)).toEqual([2, 1]);
  });

  it('a hora de jogo do tick', () => {
    expect(horaDoJogo(0, 100)).toBe('00:00');
    expect(horaDoJogo(615, 100)).toBe('01:01');
    expect(horaDoJogo(36_010, 100)).toBe('1:00:01');
  });

  it('(2) o validador reprova o evento sem manchete no tema e o teto <= 0', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    expect(validarInterface(dados, { ...interfaceUi, jornal: { ...config, maximoDeNoticias: 0 } }))
      .toContain('interface/jornal: maximoDeNoticias precisa ser inteiro > 0');
    expect(validarInterface(dados, { ...interfaceUi, jornal: { ...config, eventos: { ...config.eventos, 'unit-killed': 'morte' } } }))
      .toContain("interface/jornal: evento 'unit-killed': a noticia 'morte' precisa de manchete e texto em theme-sertao.json jornal.noticias");
  });
});
