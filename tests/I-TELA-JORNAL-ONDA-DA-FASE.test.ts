/**
 * I-TELA-JORNAL-ONDA-DA-FASE — o jornal avisa quando chega uma onda da fase (aceite no BUILD_PLAN.md).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { step } from '../src/sim/tick';
import type { GameEvent } from '../src/sim/state';
import { noticiasDosEventos } from '../src/ui/jornal';
import type { ConfigDoJornal, TextoDaNoticia } from '../src/ui/jornal';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/jornal.json', 'utf8')) as ConfigDoJornal;
const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { jornal: { noticias: Record<string, TextoDaNoticia> } };
const ID = 'fase-01-pianco';

describe('I-TELA-JORNAL-ONDA-DA-FASE', () => {
  it('aceite 1: um `wave-arrived` no tick da primeira onda, com quantos nasceram e o lado dela; nenhum antes', () => {
    const dados = dadosDaFase(ID);
    const fase = dados.campanha.fases.find((f) => f.id === ID);
    const onda = fase?.ondas[0];
    if (onda === undefined) throw new Error('a fase 1 sem onda');
    let s = criarFase(ID, dados);
    const vistos: { tick: number; e: GameEvent }[] = [];
    while (s.tick - (s.fase?.inicio ?? 0) < onda.tick) {
      s = step(s, [], dados);
      for (const e of s.events) if (e.type === 'wave-arrived') vistos.push({ tick: s.tick - (s.fase?.inicio ?? 0), e });
    }
    const quantos = onda.tropas.reduce((a, t) => a + t.quantidade, 0);
    expect(vistos).toEqual([{ tick: onda.tick, e: { type: 'wave-arrived', atacante: onda.lado, unidades: quantos } }]);
    gravarEvidencia('I-TELA-JORNAL-ONDA-DA-FASE', { tickDaOnda: onda.tick, evento: vistos[0]?.e });
  }, 60_000);

  it('aceite 2: o evento vira a noticia `ondaChegou`, com o numero no texto', () => {
    const [n] = noticiasDosEventos([{ type: 'wave-arrived', atacante: 1, unidades: 4 }], 10, config, tema.jornal.noticias);
    expect(n?.chave).toBe('ondaChegou');
    expect(n?.texto).toContain('4 ');
    expect(n?.manchete).toBe(tema.jornal.noticias['ondaChegou']?.manchete);
  });
});
