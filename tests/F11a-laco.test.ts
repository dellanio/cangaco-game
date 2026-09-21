// F11a — o laco de tempo fixo (src/laco.ts). O relogio e PURO: a fonte de tempo entra por
// parametro de `tique`, entao tudo aqui roda em Node com um relogio falso, sem timer, sem
// `performance` e sem browser. O que se prova, na ordem do aceite escrito no BUILD_PLAN:
//   1. N ms a 1x rodam floor(N / tickMs) passos e o resto sobra; 2x e 3x sao proporcionais;
//   2. mesma lista de comandos e mesmo numero de passos => o mesmo JSON a 1x e a 3x;
//   3. interpolacao entre ticks (src/render/interpolacao.ts, aritmetica pura);
//   4. pausado: zero passos; retomar nao recupera o tempo parado (sem rajada);
//   5. um quadro muito longo roda no maximo MAX_PASSOS_POR_QUADRO;
//   6. avancar(n) lanca se o timer nao esta pausado;
//  10. visibilitychange e ASSIMETRICO: ocultar pausa, voltar nao retoma;
//  11. `?pausado` na URL faz o laco nascer pausado.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  criarLaco,
  MAX_PASSOS_POR_QUADRO,
  nascerPausadoPelaUrl,
  pausarAoOcultar,
  type Laco,
} from '../src/laco';
import { criarMemoriaDePosicoes, interpolarPosicao } from '../src/render/interpolacao';
import { criarSessao } from '../src/sessao';
import { createInitialState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { gameData } from '../src/sim/data';
import { gravarEvidencia } from './helpers/evidence';

const TICK_MS = gameData.tempo.tickMs;
const VELOCIDADES = gameData.tempo.velocidadeDeJogo.opcoes;

/** Um laco que conta os passos, com o relogio na mao do teste. */
function lacoContador(opcoes: { velocidade?: number; nascerPausado?: boolean } = {}): {
  laco: Laco;
  passos: () => number;
} {
  let n = 0;
  const laco = criarLaco({
    passo: () => {
      n += 1;
    },
    tickMs: TICK_MS,
    velocidades: VELOCIDADES,
    velocidadePadrao: opcoes.velocidade ?? 1,
    ...(opcoes.nascerPausado === undefined ? {} : { nascerPausado: opcoes.nascerPausado }),
  });
  return { laco, passos: () => n };
}

const evidencia: Record<string, unknown> = {};
const evidenciaInterp: Record<string, unknown> = {};
afterAll(() => {
  gravarEvidencia('F11a', {
    feature: 'F11a-laco-de-tempo',
    tickMs: TICK_MS,
    velocidades: VELOCIDADES,
    ...evidencia,
    interpolacao: evidenciaInterp,
  });
});

describe('F11a — o acumulador de tempo fixo', () => {
  it('a 1x, N ms rodam floor(N / tickMs) passos, e o primeiro tique so marca o relogio', () => {
    const { laco, passos } = lacoContador();
    expect(laco.tique(5000)).toBe(0); // a primeira chamada nao tem intervalo: so fixa o zero
    expect(laco.tique(5000 + TICK_MS * 7 + 30)).toBe(7);
    expect(passos()).toBe(7);
  });

  it('o resto de um quadro nao se perde: dois quadros de meio tick somam um passo', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    expect(laco.tique(TICK_MS / 2)).toBe(0);
    expect(laco.tique(TICK_MS)).toBe(1);
    expect(passos()).toBe(1);
  });

  it('o resto de 30 ms sobra e completa o proximo passo quando faltam os 70 ms', () => {
    const { laco } = lacoContador();
    laco.tique(0);
    expect(laco.tique(TICK_MS + 30)).toBe(1);
    expect(laco.tique(TICK_MS + 30 + (TICK_MS - 30))).toBe(1);
  });

  // 10 quadros de um tick cada, e nao um quadro de 10 ticks: um quadro so pediria 10 * v
  // passos de uma vez e mediria o teto por quadro (aceite 5), nao a velocidade
  it.each(VELOCIDADES)('a %ix, o mesmo intervalo roda %i vezes mais passos', (v) => {
    const { laco, passos } = lacoContador({ velocidade: v });
    laco.tique(0);
    for (let i = 1; i <= 10; i++) laco.tique(i * TICK_MS);
    expect(passos()).toBe(10 * v);
    evidencia[`passosEm10QuadrosDeUmTick_a${v}x`] = passos();
  });

  it('o intervalo que nunca cabe em um tick vira passo por acumulo (16 ms x 100 quadros a 1x)', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    for (let i = 1; i <= 100; i++) laco.tique(i * 16);
    expect(passos()).toBe(Math.floor((100 * 16) / TICK_MS));
  });

  it('um relogio que anda para tras nao roda nem desfaz passo', () => {
    const { laco, passos } = lacoContador();
    laco.tique(1000);
    expect(laco.tique(900)).toBe(0);
    expect(passos()).toBe(0);
  });

  it('alfa() e a fracao do tick em curso, sempre em [0, 1)', () => {
    const { laco } = lacoContador();
    laco.tique(0);
    laco.tique(TICK_MS / 4);
    expect(laco.alfa()).toBeCloseTo(0.25, 10);
    laco.tique(TICK_MS + TICK_MS / 2);
    expect(laco.alfa()).toBeCloseTo(0.5, 10);
    for (let t = 0; t < 40; t++) {
      laco.tique(2000 + t * 13);
      expect(laco.alfa()).toBeGreaterThanOrEqual(0);
      expect(laco.alfa()).toBeLessThan(1);
    }
  });
});

describe('F11a — a velocidade de jogo', () => {
  it('as opcoes e o padrao vem de data/time.json, sem numero digitado', () => {
    expect(VELOCIDADES).toEqual([1, 2, 3]);
    expect(gameData.tempo.velocidadeDeJogo.padrao).toBe(1);
  });

  it('acelerar e desacelerar andam pelas opcoes e param nas pontas', () => {
    const { laco } = lacoContador({ velocidade: gameData.tempo.velocidadeDeJogo.padrao });
    const vistas = [laco.velocidade];
    for (let i = 0; i < 5; i++) {
      laco.acelerar();
      vistas.push(laco.velocidade);
    }
    for (let i = 0; i < 5; i++) {
      laco.desacelerar();
      vistas.push(laco.velocidade);
    }
    // padrao + 5 aceleracoes (2, 3, e tres vezes no teto) e 5 desaceleracoes (2, 1, e tres vezes no piso)
    expect(vistas).toEqual([1, 2, 3, 3, 3, 3, 2, 1, 1, 1, 1]);
    evidencia.passeioPelasVelocidades = vistas;
  });

  it('trocar a velocidade no meio vale so dali para a frente, sem reescrever o passado', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    laco.tique(TICK_MS * 2);
    expect(passos()).toBe(2);
    laco.acelerar(); // 2x
    laco.tique(TICK_MS * 4);
    expect(passos()).toBe(2 + 4);
  });

  it('um padrao fora das opcoes, ou opcoes vazias, e erro na criacao', () => {
    const base = { passo: () => undefined, tickMs: TICK_MS };
    expect(() => criarLaco({ ...base, velocidades: [1, 2, 3], velocidadePadrao: 4 })).toThrow(/padrao/);
    expect(() => criarLaco({ ...base, velocidades: [], velocidadePadrao: 1 })).toThrow(/velocidades/);
    expect(() => criarLaco({ ...base, tickMs: 0, velocidades: [1], velocidadePadrao: 1 })).toThrow(/tickMs/);
  });
});

describe('F11a — a velocidade NAO toca a simulacao (aceite 2)', () => {
  const comandos: Command[] = [
    { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 26, gy: 34 },
    {
      type: 'PlaceRoad',
      tiles: [
        { gx: 29, gy: 33 }, { gx: 29, gy: 34 }, { gx: 29, gy: 35 }, { gx: 29, gy: 36 }, { gx: 28, gy: 36 },
      ],
    },
  ];
  const TICKS = 200;

  /** Roda a Sessao de verdade ate `TICKS` passos, a `velocidade`, num relogio falso de quadros de 16 ms. */
  function rodarA(velocidade: number): { json: string; quadros: number } {
    const sessao = criarSessao(createInitialState(1));
    for (const c of comandos) sessao.enviar(c);
    const laco = criarLaco({
      passo: () => {
        sessao.passo();
      },
      tickMs: TICK_MS,
      velocidades: VELOCIDADES,
      velocidadePadrao: velocidade,
    });
    let agora = 0;
    let quadros = 0;
    laco.tique(agora);
    while (sessao.estado.tick < TICKS) {
      agora += 16;
      laco.tique(agora);
      quadros += 1;
      if (quadros > 100_000) throw new Error('o laco nao avanca');
    }
    return { json: JSON.stringify(sessao.estado), quadros };
  }

  it('mesma lista de comandos e mesmo numero de passos: JSON identico a 1x e a 3x', () => {
    const a1 = rodarA(1);
    const a3 = rodarA(3);
    expect(JSON.parse(a1.json).tick).toBe(TICKS);
    expect(JSON.parse(a3.json).tick).toBe(TICKS);
    expect(a3.json).toBe(a1.json);
    // e o tempo de parede foi de fato ~3x menor (senao o teste comparava a mesma corrida)
    expect(a1.quadros).toBeGreaterThan(a3.quadros * 2.5);
    evidencia.equivalenciaDeVelocidade = { ticks: TICKS, quadrosA1x: a1.quadros, quadrosA3x: a3.quadros, jsonIdentico: a3.json === a1.json };
  });

  it('a corrida nao e vacua: os serfs mexeram no estado (o JSON difere do inicial)', () => {
    const inicial = JSON.stringify(createInitialState(1));
    expect(rodarA(2).json).not.toBe(inicial);
  });
});

describe('F11a — pausa (aceite 4)', () => {
  it('pausado, 1 s de relogio falso roda zero passos', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    laco.pausar();
    for (let t = 1; t <= 10; t++) expect(laco.tique(t * 100)).toBe(0);
    expect(passos()).toBe(0);
    expect(laco.pausado).toBe(true);
  });

  it('retomar NAO recupera o tempo parado: nao ha rajada de passos', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    laco.tique(TICK_MS * 3);
    expect(passos()).toBe(3);
    laco.pausar();
    laco.tique(TICK_MS * 3 + 60_000); // um minuto parado (ou aba oculta, sem quadro nenhum)
    laco.retomar();
    const base = TICK_MS * 3 + 60_000 + 16;
    expect(laco.tique(base)).toBe(0); // o primeiro quadro depois de retomar so fixa o zero
    expect(passos()).toBe(3);
    expect(laco.tique(base + TICK_MS)).toBe(1); // e dai em diante o relogio anda normalmente
    evidencia.rajadaAoRetomar = 0;
  });

  it('retomar depois de um tempo SEM nenhum quadro (rAF parado em aba oculta) tambem nao faz rajada', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    laco.pausar();
    // nenhum tique durante a pausa; o proximo relogio esta a uma hora de distancia
    laco.retomar();
    laco.tique(3_600_000);
    expect(passos()).toBe(0);
  });

  it('alternarPausa liga e desliga; pausado o alfa vale 1 (o render mostra o tick atual, sem interpolar)', () => {
    const { laco } = lacoContador();
    laco.tique(0);
    laco.tique(TICK_MS / 2);
    expect(laco.alfa()).toBeCloseTo(0.5, 10);
    laco.alternarPausa();
    expect(laco.pausado).toBe(true);
    expect(laco.alfa()).toBe(1);
    laco.alternarPausa();
    expect(laco.pausado).toBe(false);
  });
});

describe('F11a — o teto de passos por quadro e salvaguarda, nao balanceamento (aceite 5)', () => {
  it('um quadro de 10 s roda no maximo MAX_PASSOS_POR_QUADRO passos', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    const rodados = laco.tique(10_000);
    expect(rodados).toBe(MAX_PASSOS_POR_QUADRO);
    expect(passos()).toBe(MAX_PASSOS_POR_QUADRO);
    evidencia.quadroDe10s = { rodados, teto: MAX_PASSOS_POR_QUADRO, passosSemTeto: Math.floor(10_000 / TICK_MS) };
  });

  it('o excedente e DESCARTADO, nao vira divida: o quadro seguinte volta ao ritmo normal', () => {
    const { laco } = lacoContador();
    laco.tique(0);
    laco.tique(10_000);
    expect(laco.tique(10_000 + TICK_MS)).toBe(1);
  });

  it('o teto e uma constante do motor e nao um campo de data/', () => {
    expect(Number.isInteger(MAX_PASSOS_POR_QUADRO)).toBe(true);
    expect(MAX_PASSOS_POR_QUADRO).toBeGreaterThan(0);
    expect(JSON.stringify(gameData.tempo)).not.toMatch(/MAX_PASSOS|maxPassos/i);
  });
});

describe('F11a — avancar so com o timer pausado (aceite 6)', () => {
  it('avancar(n) lanca com o timer rodando e nao roda nenhum passo', () => {
    const { laco, passos } = lacoContador();
    expect(() => laco.avancar(3)).toThrow(/pausado/);
    expect(passos()).toBe(0);
  });

  it('pausado, avancar(n) roda exatamente n passos, sem tocar o relogio', () => {
    const { laco, passos } = lacoContador();
    laco.tique(0);
    laco.pausar();
    laco.avancar(5);
    expect(passos()).toBe(5);
    laco.avancar(0);
    expect(passos()).toBe(5);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('avancar(%s) e erro, como era na F10', (n) => {
    const { laco } = lacoContador({ nascerPausado: true });
    expect(() => laco.avancar(n)).toThrow(/inteiro/);
  });

  it('depois de retomar, avancar volta a lancar', () => {
    const { laco } = lacoContador({ nascerPausado: true });
    laco.avancar(1);
    laco.retomar();
    expect(() => laco.avancar(1)).toThrow(/pausado/);
    evidencia.avancarLancaComTimerRodando = true;
  });
});

describe('F11a — nascer pausado e pausa por aba oculta (aceites 10 e 11)', () => {
  it('nascerPausado: o laco nasce pausado e o primeiro quadro roda zero passos', () => {
    const { laco, passos } = lacoContador({ nascerPausado: true });
    expect(laco.pausado).toBe(true);
    laco.tique(0);
    laco.tique(60_000);
    expect(passos()).toBe(0);
  });

  it('sem o parametro o laco nasce rodando', () => {
    expect(lacoContador().laco.pausado).toBe(false);
  });

  it('a URL com ?pausado (com ou sem valor, com outros parametros) faz nascer pausado', () => {
    expect(nascerPausadoPelaUrl('?pausado')).toBe(true);
    expect(nascerPausadoPelaUrl('?pausado=1')).toBe(true);
    expect(nascerPausadoPelaUrl('?x=1&pausado')).toBe(true);
    expect(nascerPausadoPelaUrl('')).toBe(false);
    expect(nascerPausadoPelaUrl('?x=1')).toBe(false);
    expect(nascerPausadoPelaUrl('?naopausado')).toBe(false);
  });

  /** Um "document" minimo: um EventTarget do Node com `hidden`, como o teclado usa um alvo de eventos. */
  function documentoFalso(): EventTarget & { hidden: boolean } {
    return Object.assign(new EventTarget(), { hidden: false });
  }

  it('ocultar a aba pausa o jogo que estava rodando', () => {
    const { laco } = lacoContador();
    const doc = documentoFalso();
    pausarAoOcultar(laco, doc);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(laco.pausado).toBe(true);
  });

  it('tornar a aba visivel NAO retoma', () => {
    const { laco } = lacoContador();
    const doc = documentoFalso();
    pausarAoOcultar(laco, doc);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(laco.pausado).toBe(true);
  });

  it('quem pausou com P, trocou de aba e voltou continua pausado', () => {
    const { laco } = lacoContador();
    const doc = documentoFalso();
    pausarAoOcultar(laco, doc);
    laco.alternarPausa(); // P
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(laco.pausado).toBe(true);
  });

  it('o desligador tira o ouvinte', () => {
    const { laco } = lacoContador();
    const doc = documentoFalso();
    const desligar = pausarAoOcultar(laco, doc);
    desligar();
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(laco.pausado).toBe(false);
    evidencia.pausaAssimetrica = { ocultarPausa: true, voltarRetoma: false };
  });
});

const SALTO = 2;
const a = { gx: 10, gy: 20 };
const b = { gx: 10.2, gy: 20 };

describe('F11a — interpolarPosicao', () => {
  it('alfa 0 devolve o tick anterior, alfa 1 o atual, alfa 1/2 o meio', () => {
    expect(interpolarPosicao(a, b, 0, SALTO)).toEqual(a);
    expect(interpolarPosicao(a, b, 1, SALTO)).toEqual(b);
    const meio = interpolarPosicao(a, b, 0.5, SALTO);
    expect(meio.gx).toBeCloseTo(10.1, 12);
    expect(meio.gy).toBe(20);
    evidenciaInterp.alfa = { em0: a, em1: b, emMeio: meio };
  });

  it('interpola nos dois eixos, inclusive andando em diagonal', () => {
    const p = interpolarPosicao({ gx: 0, gy: 0 }, { gx: 0.2, gy: 0.2 }, 0.25, SALTO);
    expect(p.gx).toBeCloseTo(0.05, 12);
    expect(p.gy).toBeCloseTo(0.05, 12);
  });

  it('e monotonica em alfa: nunca anda para tras dentro de um passo', () => {
    let ultimo = -Infinity;
    for (let alfa = 0; alfa <= 1; alfa += 0.05) {
      const { gx } = interpolarPosicao(a, b, alfa, SALTO);
      expect(gx).toBeGreaterThanOrEqual(ultimo);
      ultimo = gx;
    }
  });

  it('alfa fora de [0, 1] e fixado no extremo (um relogio ruim nao ejeta a unidade do mapa)', () => {
    expect(interpolarPosicao(a, b, -3, SALTO)).toEqual(a);
    expect(interpolarPosicao(a, b, 7, SALTO)).toEqual(b);
    expect(interpolarPosicao(a, b, Number.NaN, SALTO)).toEqual(b);
  });

  it('um salto acima do limiar ASSENTA na posicao nova, sem deslizar pelo mapa', () => {
    const longe = { gx: 10 + SALTO + 0.5, gy: 20 };
    expect(interpolarPosicao(a, longe, 0, SALTO)).toEqual(longe);
    expect(interpolarPosicao(a, longe, 0.5, SALTO)).toEqual(longe);
    evidenciaInterp.salto = { limiar: SALTO, distancia: SALTO + 0.5, assentouNaPosicaoNova: true };
  });

  it('a distancia EXATAMENTE no limiar ainda interpola (o limiar e estrito)', () => {
    const noLimite = { gx: 10 + SALTO, gy: 20 };
    expect(interpolarPosicao(a, noLimite, 0.5, SALTO).gx).toBeCloseTo(11, 12);
  });

  it('a distancia e medida em 2D, nao por eixo', () => {
    // 1.5 em cada eixo: cada eixo esta abaixo de 2, mas a diagonal (2.12) passa
    const diag = { gx: 11.5, gy: 21.5 };
    expect(interpolarPosicao(a, diag, 0.5, SALTO)).toEqual(diag);
  });

  it('nao muta os argumentos', () => {
    const x = Object.freeze({ gx: 1, gy: 1 });
    const y = Object.freeze({ gx: 1.2, gy: 1 });
    expect(() => interpolarPosicao(x, y, 0.5, SALTO)).not.toThrow();
  });
});

describe('F11a — memoria das posicoes do tick anterior', () => {
  it('uma unidade nova nao tem anterior: assenta onde nasceu', () => {
    const memoria = criarMemoriaDePosicoes();
    expect(memoria.observar('u1', 5, a)).toEqual(a);
  });

  it('quando o tick avanca, o anterior passa a ser a posicao do tick que se viu por ultimo', () => {
    const memoria = criarMemoriaDePosicoes();
    memoria.observar('u1', 5, a);
    expect(memoria.observar('u1', 6, b)).toEqual(a);
  });

  it('no MESMO tick, quadros diferentes veem o mesmo anterior (a memoria nao anda com o quadro)', () => {
    const memoria = criarMemoriaDePosicoes();
    memoria.observar('u1', 5, a);
    memoria.observar('u1', 6, b);
    for (let quadro = 0; quadro < 6; quadro++) expect(memoria.observar('u1', 6, b)).toEqual(a);
  });

  it('cada unidade tem a sua', () => {
    const memoria = criarMemoriaDePosicoes();
    memoria.observar('u1', 1, { gx: 0, gy: 0 });
    memoria.observar('u2', 1, { gx: 9, gy: 9 });
    expect(memoria.observar('u1', 2, { gx: 0.2, gy: 0 })).toEqual({ gx: 0, gy: 0 });
    expect(memoria.observar('u2', 2, { gx: 9.2, gy: 9 })).toEqual({ gx: 9, gy: 9 });
  });

  it('o tick voltou para tras (estado carregado): assenta, sem interpolar a partir de um futuro que nao existe', () => {
    const memoria = criarMemoriaDePosicoes();
    memoria.observar('u1', 50, b);
    expect(memoria.observar('u1', 10, a)).toEqual(a);
  });

  it('esquecer solta a unidade: se o id voltar, comeca de novo', () => {
    const memoria = criarMemoriaDePosicoes();
    memoria.observar('u1', 1, a);
    memoria.observar('u1', 2, b);
    memoria.esquecer('u1');
    expect(memoria.observar('u1', 3, b)).toEqual(b);
  });

  it('um passo de varios ticks entre dois quadros (avancar(n)) guarda o ultimo tick VISTO, nao o anterior real', () => {
    const memoria = criarMemoriaDePosicoes();
    memoria.observar('u1', 0, { gx: 0, gy: 0 });
    // avancar(5): o render so viu o tick 0 e agora o 5
    expect(memoria.observar('u1', 5, { gx: 1, gy: 0 })).toEqual({ gx: 0, gy: 0 });
  });
});

describe('F11a — guarda estrutural', () => {
  it('interpolacao.ts nao importa nada: e aritmetica pura, como grid.ts', () => {
    const fonte = readFileSync(join('src', 'render', 'interpolacao.ts'), 'utf8');
    expect(fonte).not.toMatch(/^\s*import\b/m);
  });
});
