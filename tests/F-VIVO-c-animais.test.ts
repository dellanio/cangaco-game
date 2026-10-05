/**
 * F-VIVO-c — os animais do curral: cinco posicoes no Curral e na Cocheira, idade
 * derivada do progresso da receita (docs/BRIEF-ARTE.md §4a, BUILD_PLAN.md "Aceite
 * da F-VIVO-c").
 *
 * `animaisDoCurral` e aritmetica pura sobre o `progresso`: o teste roda o ciclo
 * inteiro tick a tick, sem tela. O predio de partida sai de um cenario real (a
 * serraria da F15a) com o `tipo` trocado — so os campos que a funcao le mudam.
 */
import { describe, it, expect } from 'vitest';
import type { GameState, PredioCompleto, Unidade } from '../src/sim/state';
import { dadosDosAnimais } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { ANIMAIS_NO_CURRAL, ANIMAL_DA_CRIACAO, LACOS_DO_ANIMAL } from '../src/render/manifesto-camadas';
import {
  animaisDoCurral, idadeNaPosicao, IDADES_DO_ANIMAL, pontosPadraoDoCurral, quadroDoAnimal,
} from '../src/render/animais';
import type { DadosDosAnimais } from '../src/render/animais';
import { AREA_PADRAO } from '../src/render/trabalho';
import { mkdirSync, writeFileSync } from 'node:fs';
import { salvar } from '../src/sim/save';
import { avancar, cenarioDaCadeiaDaCarne, cenarioDeSerraria } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados: DadosDosAnimais = dadosDosAnimais(semArte);

function completoDe(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}
const base = cenarioDeSerraria();
const predioBase = completoDe(base, 's1');
const unidadeBase = ((): Unidade => {
  const u = base.unidades.porId['u2'];
  if (u === undefined) throw new Error('fixture: u2 nao existe');
  return u;
})();

const CRIACOES = Object.keys(ANIMAL_DA_CRIACAO);

const ticksDe = (tipo: string): number => {
  const t = dados.ticksDoCiclo[tipo];
  if (t === undefined) throw new Error(`fixture: '${tipo}' sem ticksDoCiclo`);
  return t;
};

/** A criacao `tipo`, ocupada, com milho na entrada e o ciclo em `progresso`. */
function criacaoEm(tipo: string, progresso: number, extra: Partial<PredioCompleto> = {}): PredioCompleto {
  const producao = predioBase.producao;
  if (producao === null) throw new Error('fixture: serraria sem producao');
  return {
    ...predioBase, tipo, producao: { ...producao, progresso },
    estoque: { entrada: { corn: 1 }, saida: {} }, ...extra,
  };
}
const idades = (p: PredioCompleto): number[] => animaisDoCurral(p, dados).map((a) => a.idade);

describe('F-VIVO-c — os animais do curral', () => {
  it('as duas criacoes tem receita, e o animal de cada uma e a mercadoria que ela da', () => {
    for (const tipo of CRIACOES) {
      expect(ticksDe(tipo), tipo).toBeGreaterThan(0);
      const curral = animaisDoCurral(criacaoEm(tipo, 0), dados);
      expect(curral.length, tipo).toBe(ANIMAIS_NO_CURRAL);
      expect(new Set(curral.map((a) => a.animal)), tipo).toEqual(new Set([ANIMAL_DA_CRIACAO[tipo]]));
    }
  });

  it('a idade de cada posicao nos dois lados de cada fronteira, pela formula inteira', () => {
    for (const tipo of CRIACOES) {
      const t = ticksDe(tipo);
      for (let i = 0; i < ANIMAIS_NO_CURRAL; i++) {
        // a posicao i muda de idade quando 3*(5p + iT) cruza um multiplo de 5T
        for (let k = 1; k < IDADES_DO_ANIMAL; k++) {
          const volta = ANIMAIS_NO_CURRAL * t;
          const faseNaFronteira = (k * volta) / IDADES_DO_ANIMAL;
          const p = (faseNaFronteira - i * t) / ANIMAIS_NO_CURRAL;
          const pDepois = Math.ceil(p);
          const pAntes = pDepois - 1;
          if (pAntes < 0 || pDepois > t) continue;
          expect(idadeNaPosicao(pAntes, t, i), `${tipo} i=${i} antes de ${k + 1}`).toBe(k);
          expect(idadeNaPosicao(pDepois, t, i), `${tipo} i=${i} em ${k + 1}`).toBe(k + 1);
        }
      }
    }
  });

  it('as tres idades aparecem, a idade so cresce ate a propria virada, e cada posicao vira no maximo uma vez', () => {
    const evidencia: Record<string, unknown> = {};
    for (const tipo of CRIACOES) {
      const t = ticksDe(tipo);
      const vistas = new Set<number>();
      const viradas = new Array<number>(ANIMAIS_NO_CURRAL).fill(0);
      let anterior = idades(criacaoEm(tipo, 0));
      anterior.forEach((x) => vistas.add(x));
      for (let p = 1; p <= t; p++) {
        const agora = idades(criacaoEm(tipo, p));
        agora.forEach((x, i) => {
          vistas.add(x);
          const antes = anterior[i] ?? 0;
          if (x < antes) {
            // a unica queda permitida e a virada adulto -> filhote
            expect([antes, x], `${tipo} i=${i} p=${p}`).toEqual([IDADES_DO_ANIMAL, 1]);
            viradas[i] = (viradas[i] ?? 0) + 1;
          } else {
            expect(x - antes, `${tipo} i=${i} p=${p}`).toBeLessThanOrEqual(1);
          }
        });
        anterior = agora;
      }
      expect([...vistas].sort(), tipo).toEqual([1, 2, 3]);
      for (const v of viradas) expect(v).toBeLessThanOrEqual(1);
      // os cinco nao nascem juntos: no inicio do ciclo ha mais de uma idade no curral
      expect(new Set(idades(criacaoEm(tipo, 0))).size, tipo).toBeGreaterThan(1);
      evidencia[tipo] = {
        ticksDoCiclo: t,
        idadesPorQuinto: [0, 1, 2, 3, 4, 5].map((q) => idades(criacaoEm(tipo, Math.floor((q * t) / 5)))),
      };
    }
    gravarEvidencia('F-VIVO-c', {
      animais: ANIMAL_DA_CRIACAO, posicoes: ANIMAIS_NO_CURRAL, pontosPadrao: pontosPadraoDoCurral(),
      lacos: LACOS_DO_ANIMAL, ciclos: evidencia,
    });
  });

  it('curral vazio: predio que nao e criacao, obra, sem ocupante, sem insumo', () => {
    for (const tipo of CRIACOES) {
      expect(animaisDoCurral(criacaoEm('sawmill', 5), dados)).toEqual([]);
      expect(animaisDoCurral(criacaoEm(tipo, 5, { ocupante: null }), dados), tipo).toEqual([]);
      expect(animaisDoCurral(criacaoEm(tipo, 0, { estoque: { entrada: {}, saida: {} } }), dados), tipo).toEqual([]);
      const obra = { ...criacaoEm(tipo, 5), estado: 'obra' } as unknown as PredioCompleto;
      expect(animaisDoCurral(obra, dados), tipo).toEqual([]);
      // o milho acabou no meio do ciclo: o criador ainda termina, os animais ficam
      expect(animaisDoCurral(criacaoEm(tipo, 5, { estoque: { entrada: {}, saida: {} } }), dados).length).toBe(ANIMAIS_NO_CURRAL);
    }
  });

  it('pausado os animais ficam, na mesma idade, e o laco para no quadro 1', () => {
    for (const tipo of CRIACOES) {
      const p = Math.floor(ticksDe(tipo) / 2);
      const rodando = criacaoEm(tipo, p);
      const pausado = criacaoEm(tipo, p, { pausado: true });
      expect(idades(pausado), tipo).toEqual(idades(rodando));
      const criador = { ...unidadeBase, id: rodando.ocupante ?? '', fsm: 'trabalhando' } as Unidade;
      expect(quadroDoAnimal(pausado, criador, 7)).toBe(1);
      expect(quadroDoAnimal(rodando, { ...criador, fsm: 'esperando' } as Unidade, 7)).toBe(1);
      const quadros = [0, 1, 2, 3, 4].map((tick) => quadroDoAnimal(rodando, criador, tick));
      expect(quadros).toEqual([1, 2, 3, 4, 1]);
    }
  });

  it('os pontos padrao ficam na metade de tras, fora da area do trabalho', () => {
    const pontos = pontosPadraoDoCurral();
    expect(pontos.length).toBe(ANIMAIS_NO_CURRAL);
    for (const [x, y] of pontos) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeLessThan(0.5);
      expect(y).toBeLessThan(AREA_PADRAO[1]);
    }
  });

  it('o Curral da cadeia da carne (F19b) enche o curral: o save que o roteiro carrega', () => {
    // A tela nao constroi a cadeia pela abertura (serraria -> fazenda -> milho: o
    // precedente da F18). O roteiro `tools/shots/F-VIVO-c.js` carrega ESTE estado pelo
    // botao "carregar" do jogador: a fixture da F19b, andada ate o Curral ter milho.
    const PASSO = 50;
    const TETO = 20000;
    let s = cenarioDaCadeiaDaCarne();
    let malhada = completoDe(s, 'sf1');
    while (animaisDoCurral(malhada, dados).length === 0 && s.tick < TETO) {
      s = avancar(s, PASSO);
      malhada = completoDe(s, 'sf1');
    }
    expect(animaisDoCurral(malhada, dados).length).toBe(ANIMAIS_NO_CURRAL);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-VIVO-c.save.txt`, salvar(s));
  });
});
