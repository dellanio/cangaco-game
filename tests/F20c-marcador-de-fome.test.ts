/**
 * F20c — o marcador de fome sobre a unidade, no mundo.
 *
 * O que so a tela responde (o marcador APARECE no quadro, e some quando a
 * condicao sobe) fica no roteiro `tools/shots/F20c.js`, com screenshot: e
 * mudanca de tela e a §8 exige imagem. Aqui se prova o que e puro e o que
 * sustenta o roteiro:
 *
 *   1. o render NAO tem limiar proprio — `temMarcadorDeFome` E `emAlertaDeFome`;
 *   2. o marcador e de FALHA DE ABASTECIMENTO, nao de "vai comer": ele acende
 *      depois do limiar de ir comer, e existe faixa com fome e sem marcador;
 *   3. a conta que o roteiro usa (fracao <= `limiares.alertaVisual`) da
 *      exatamente o mesmo conjunto que a conta em tick da simulacao. Sem isto o
 *      roteiro afirmaria contra uma aritmetica que ninguem verificou.
 *
 * Nenhum limiar e digitado: tudo sai de `gameData.condicao`, que veio de
 * `data/condition.json` convertido no carregamento.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { Unidade } from '../src/sim/state';
import {
  condicaoCheiaDoTipo, drenaCondicao, emAlertaDeFome, fracaoDeCondicao, precisaComer,
} from '../src/sim/condicao';
import {
  ALTURA_DA_CARGA_EM_LADOS, ALTURA_DA_FOME_EM_LADOS, temMarcadorDeFome,
} from '../src/render/marcador-de-fome';
import { gravarEvidencia } from './helpers/evidence';

/** Um civil de verdade do estado de abertura — tipo real, nao inventado. */
function civilDaAbertura(): Unidade {
  const estado = createInitialState(1);
  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (u !== undefined && drenaCondicao(u)) return u;
  }
  throw new Error('fixture: a vila de abertura deveria ter pelo menos um civil');
}

const comCondicao = (unidade: Unidade, condicao: number): Unidade => ({ ...unidade, condicao });

const CIVIL = civilDaAbertura();
const CHEIA = condicaoCheiaDoTipo(CIVIL.tipo);
const LIMIARES = gameData.condicao.ticksNoLimiar.civil;
const FRACOES = gameData.condicao.limiares;

/** Uma condicao a cada `passo` ticks, de cheia a zero, sempre incluindo os limiares. */
function condicoesVarridas(passo = 37): readonly number[] {
  const valores = new Set<number>([CHEIA, 0]);
  for (let c = CHEIA; c >= 0; c -= passo) valores.add(c);
  for (const limiar of [LIMIARES.alertaVisual, LIMIARES.civilVaiComer, LIMIARES.morte]) {
    for (const d of [-1, 0, 1]) {
      const v = limiar + d;
      if (v >= 0 && v <= CHEIA) valores.add(v);
    }
  }
  return [...valores].sort((a, b) => b - a);
}

describe('F20c — o render nao tem limiar', () => {
  it('`temMarcadorDeFome` E a funcao da simulacao, nao uma copia dela', () => {
    // Guarda estrutural: identidade de funcao. Uma copia do `<=` no render
    // passaria por qualquer teste de comportamento e divergiria no dia em que o
    // dado mudasse — e o `data/condition.json` e o unico dono do 0,35.
    expect(temMarcadorDeFome).toBe(emAlertaDeFome);
  });

  it('o marcador acende exatamente nas condicoes em que a sim diz alerta', () => {
    const divergentes = condicoesVarridas().filter(
      (c) => temMarcadorDeFome(comCondicao(CIVIL, c)) !== emAlertaDeFome(comCondicao(CIVIL, c)),
    );
    expect(divergentes).toEqual([]);
  });

  it('quem nao drena nunca acende o marcador, nem com a condicao no chao', () => {
    const tipoMilitar = gameData.unidades.militares.tipos[0]?.id ?? '';
    expect(tipoMilitar).not.toBe('');
    const militar: Unidade = { ...CIVIL, tipo: tipoMilitar, condicao: 0 };
    expect(drenaCondicao(militar)).toBe(false);
    expect(temMarcadorDeFome(militar)).toBe(false);
  });
});

describe('F20c — marcador de FALHA DE ABASTECIMENTO, nao de "vai comer"', () => {
  it('no dado, o limiar do marcador fica ABAIXO do limiar de ir comer', () => {
    // A ordem e o significado do icone. Se um dia o dado invertesse os dois
    // numeros, o marcador passaria a dizer "ele vai comer" — que e o ruido que o
    // item da fila mandou evitar — e este teste reprova antes da tela.
    expect(LIMIARES.alertaVisual).toBeLessThan(LIMIARES.civilVaiComer);
    expect(FRACOES.alertaVisual).toBeLessThan(FRACOES.civilVaiComer);
  });

  it('todo civil com marcador ja precisa comer, e existe faixa com fome e SEM marcador', () => {
    const varridas = condicoesVarridas();
    const comMarcadorSemFome = varridas.filter((c) => {
      const u = comCondicao(CIVIL, c);
      return temMarcadorDeFome(u) && !precisaComer(u);
    });
    expect(comMarcadorSemFome).toEqual([]);

    const comFomeSemMarcador = varridas.filter((c) => {
      const u = comCondicao(CIVIL, c);
      return precisaComer(u) && !temMarcadorDeFome(u);
    });
    // Nao e "> 0" por elegancia: essa faixa e o cenario do meio do roteiro, o
    // quadro em que o civil esta com fome e a tela continua limpa.
    expect(comFomeSemMarcador.length).toBeGreaterThan(0);
  });

  it('a unidade de condicao cheia nao tem marcador', () => {
    expect(temMarcadorDeFome(comCondicao(CIVIL, CHEIA))).toBe(false);
    expect(fracaoDeCondicao(comCondicao(CIVIL, CHEIA))).toBe(1);
  });
});

describe('F20c — a conta do roteiro e a mesma conta', () => {
  it('fracao <= limiares.alertaVisual da o MESMO conjunto que a conta em tick', () => {
    // O roteiro roda no browser e nao tem `gameData`: ele le `data/condition.json`
    // e compara a fracao publicada na ponte com a fracao do dado. Isto afirma que
    // essa comparacao concorda com a da simulacao em TODA condicao possivel — o
    // limiar em tick e `Math.round(fracao * cheia)`, e o arredondamento poderia
    // cair no meio de um tick.
    const divergentes: { condicao: number; sim: boolean; roteiro: boolean }[] = [];
    for (let c = 0; c <= CHEIA; c += 1) {
      const u = comCondicao(CIVIL, c);
      const sim = temMarcadorDeFome(u);
      const roteiro = fracaoDeCondicao(u) <= FRACOES.alertaVisual;
      if (sim !== roteiro) divergentes.push({ condicao: c, sim, roteiro });
    }
    expect(divergentes).toEqual([]);
  });
});

describe('F20c — os dois marcadores nao se empilham', () => {
  it('o de fome fica acima do de carga', () => {
    // Um serf com fome carregando pao mostra os dois. No mesmo y, o de fome
    // esconderia a carga, que e informacao da F10.
    expect(ALTURA_DA_FOME_EM_LADOS).toBeGreaterThan(ALTURA_DA_CARGA_EM_LADOS);
  });
});

describe('F20c — evidencia', () => {
  it('grava test-output/F20c.json', () => {
    const varridas = condicoesVarridas();
    const faixa = (nome: string, pred: (u: Unidade) => boolean): { de: number; ate: number } => {
      const valores = varridas.filter((c) => pred(comCondicao(CIVIL, c)));
      if (valores.length === 0) throw new Error(`evidencia: faixa '${nome}' veio vazia`);
      return { de: Math.max(...valores), ate: Math.min(...valores) };
    };

    gravarEvidencia('F20c', {
      aceite: 'BUILD_PLAN.md F20c: unidade acima do limiar nao tem marcador; a mesma abaixo dele tem',
      derivadoDoDado: {
        tipoDoCivilMedido: CIVIL.tipo,
        condicaoCheiaEmTicks: CHEIA,
        fracoesNoDado: FRACOES,
        limiaresEmTicks: LIMIARES,
      },
      faixas: {
        semMarcador: faixa('semMarcador', (u) => !temMarcadorDeFome(u)),
        comFomeSemMarcador: faixa(
          'comFomeSemMarcador', (u) => precisaComer(u) && !temMarcadorDeFome(u),
        ),
        comMarcador: faixa('comMarcador', (u) => temMarcadorDeFome(u)),
      },
      ticksDeDrenoAteOMarcador: CHEIA - LIMIARES.alertaVisual,
      alturasEmLados: { carga: ALTURA_DA_CARGA_EM_LADOS, fome: ALTURA_DA_FOME_EM_LADOS },
      decisoes: [
        'D — `temMarcadorDeFome` e REEXPORTACAO de `emAlertaDeFome`: identidade de funcao, nao copia do limiar',
        'D — o rotulo do marcador mora em `theme-sertao.json: marcadores.fome`, nao em `alertas.causas` (guarda da F22 exige igualdade com CAUSAS_DE_ALERTA)',
        'D — a causa `fome` no HUD (Nota da F22) NAO entra aqui: e `sim/` + `ui/`, e o item da F20c diz "so src/render/"',
      ],
    });
    expect(true).toBe(true);
  });
});
