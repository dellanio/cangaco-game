/**
 * F21 — A CADEIA DO OURO: duas minas, uma metalurgia e a escola que gasta.
 *
 * A medicao veio primeiro (`tests/zz-probe-F21.test.ts`), como na F19 e na F19b,
 * e o resultado foi o mesmo: a cadeia inteira JA funciona sem uma linha de codigo
 * novo — producao generica da F15a, tarefa de insumo entre predios da F15b,
 * escada de entrega da F20a. Entao o que esta feature entrega e o GUARDA: o elo
 * que hoje fecha nao pode se abrir calado numa feature futura.
 *
 * O que estes testes NAO cobrem, e esta escrito na fila: a mina de ouro e a de
 * ferro nao esgotam. O item prometia que "ouro, carvao e ferro herdam a camada da
 * F-T2 prontos" e isso e falso, medido: `resources.json` tem quatro tipos (rock,
 * tree, fish, corn), o mapa emitido tem tres recursos, `gold_mine.colheita` e
 * `null` e o campo `producao.veio` nao existe mais. O aceite dessa perna esta na
 * F21b, nao aqui — inventar tile de minerio por iniciativa propria seria decidir
 * design sozinho.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { ID_DO_ARMAZEM } from '../src/sim/state';

import { step } from '../src/sim/tick';
import {
  cenarioDaCadeiaDoOuro, cenarioDoOuroSemCarvao, cenarioDoOuroSemMina,
} from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;

/** Teto de SEGURANCA, nao afirmacao de desempenho: a sonda mediu o primeiro ouro
 *  no armazem no tick 1030, e cadeia que nao fecha em 4000 esta travada, nao
 *  lenta. O que se afirma e a sequencia, nunca o instante. */
const TETO_DA_CADEIA = 4000;

const completo = (e: GameState, id: string): PredioCompleto | null => {
  const p = e.predios.porId[id];
  return p !== undefined && p.estado === 'completo' ? p : null;
};

/** Tudo o que o predio tem, nas duas gavetas: a pergunta e "passou por aqui", e
 *  entrada e saida sao dois momentos do mesmo bem. */
function estoqueDe(e: GameState, id: string): Record<string, number> {
  const p = completo(e, id);
  if (p === null) return {};
  const total: Record<string, number> = {};
  for (const gaveta of [p.estoque.entrada, p.estoque.saida]) {
    for (const [k, v] of Object.entries(gaveta)) total[k] = (total[k] ?? 0) + v;
  }
  return total;
}

/** O bem em TODO lugar: gaveta de predio e carga de unidade. E assim que "ouro no
 *  mundo" se mede contra a linha de base, e nao so no armazem que se olha. */
function totalNoMundo(e: GameState, bem: string): number {
  let total = 0;
  for (const id of e.predios.ordem) total += estoqueDe(e, id)[bem] ?? 0;
  // uma tarefa carrega UMA unidade de recurso (F09), entao a carga na mao e o id
  // do bem e vale 1 — nao ha quantidade a somar.
  for (const u of Object.values(e.unidades.porId)) {
    if (u.fsmData.carga === bem) total += 1;
  }
  return total;
}

const unidadesDoTipo = (e: GameState, tipo: string): number =>
  Object.values(e.unidades.porId).filter((u) => u.tipo === tipo).length;

/** O armazem da ALDEIA, cujo ouro de abertura a fixture zerou — `p1`, e nao
 *  `ID_DO_ARMAZEM`, que e o tipo. E o outro lugar de onde o ouro poderia ter
 *  vindo, e e por isso que o teste olha para ele. */
function armazemDaAldeia(e: GameState): string {
  for (const id of e.predios.ordem) {
    if (e.predios.porId[id]?.tipo === ID_DO_ARMAZEM && id !== 'arm') return id;
  }
  throw new Error('fixture: a aldeia inicial nao tem armazem');
}

/** Roda ate `pare` dizer sim, ou estoura com o motivo escrito. Devolve o tick em
 *  que aconteceu — que vai para a evidencia, nunca para um `expect`. */
function rodarAte(
  inicial: GameState, pare: (e: GameState) => boolean, teto: number, oQue: string,
): { readonly estado: GameState; readonly tick: number } {
  let s = inicial;
  for (let t = 1; t <= teto; t += 1) {
    s = step(s, [], DADOS);
    if (pare(s)) return { estado: s, tick: t };
  }
  throw new Error(`${oQue} nao aconteceu em ${teto} ticks`);
}

describe('F21, aceite 1 — a cadeia do ouro fecha sozinha', () => {
  it('minerio e carvao viram ouro no armazem, e o ouro nao existia antes', () => {
    const inicio = cenarioDaCadeiaDoOuro();
    // linha de base: o ouro da abertura foi a zero na fixture, senao "apareceu
    // ouro" seria verdade desde o tick 0 e o teste nao mediria nada.
    expect(totalNoMundo(inicio, 'gold')).toBe(0);

    const { estado } = rodarAte(
      inicio, (e) => (estoqueDe(e, 'arm').gold ?? 0) > 0, TETO_DA_CADEIA,
      'o ouro chegar ao armazem da cadeia',
    );

    expect(estoqueDe(estado, 'arm').gold ?? 0).toBeGreaterThan(0);
    expect(totalNoMundo(estado, 'gold')).toBeGreaterThan(0);
    // e os dois insumos passaram pela metalurgia: sem isso "tem ouro" nao diz
    // que a cadeia fechou, so que alguem escreveu ouro em algum lugar.
    expect(totalNoMundo(estado, 'gold_ore')).toBeGreaterThan(0);
    expect(totalNoMundo(estado, 'coal')).toBeGreaterThan(0);
    expect(violacoesDeInvariantes(estado, DADOS)).toEqual([]);
    expect(violacoesDaFsmDoEspecialista(estado, DADOS)).toEqual([]);
  });

  it('a metalurgia consome os dois insumos, e o ouro sai DELA', () => {
    // O contra-exemplo do teste acima mora nos dois proximos `describe`; aqui a
    // pergunta e de origem: o primeiro ouro do mundo apareceu na metalurgia.
    const { estado, tick } = rodarAte(
      cenarioDaCadeiaDoOuro(), (e) => totalNoMundo(e, 'gold') > 0, TETO_DA_CADEIA,
      'o primeiro ouro do mundo',
    );
    expect(tick).toBeGreaterThan(0);
    expect(estoqueDe(estado, 'me1').gold ?? 0).toBeGreaterThan(0);
    expect(estoqueDe(estado, armazemDaAldeia(estado)).gold ?? 0).toBe(0);
  });
});

describe('F21, aceite 2 — sem os dois insumos nao ha ouro', () => {
  it('sem a mina de carvao, a metalurgia nao fabrica ouro nenhum', () => {
    let s = cenarioDoOuroSemCarvao();
    for (let t = 1; t <= TETO_DA_CADEIA; t += 1) s = step(s, [], DADOS);
    expect(totalNoMundo(s, 'gold')).toBe(0);
    expect(totalNoMundo(s, 'gold_ore')).toBeGreaterThan(0);
    expect(totalNoMundo(s, 'coal')).toBe(0);
  });

  it('sem a mina de ouro tambem nao: as duas entradas sao obrigatorias', () => {
    let s = cenarioDoOuroSemMina();
    for (let t = 1; t <= TETO_DA_CADEIA; t += 1) s = step(s, [], DADOS);
    expect(totalNoMundo(s, 'gold')).toBe(0);
    expect(totalNoMundo(s, 'coal')).toBeGreaterThan(0);
    expect(totalNoMundo(s, 'gold_ore')).toBe(0);
  });
});

describe('F21, aceite 3 — a escola gasta ouro MINERADO', () => {
  it('ouro da metalurgia paga um treino, e nasce um civil que nao existia', () => {
    const { estado: comOuro } = rodarAte(
      cenarioDaCadeiaDoOuro(), (e) => (estoqueDe(e, 'arm').gold ?? 0) > 0, TETO_DA_CADEIA,
      'o ouro chegar ao armazem da cadeia',
    );
    expect(unidadesDoTipo(comOuro, 'stonemason')).toBe(0);

    const pedido = step(comOuro, [{ type: 'EnqueueTraining', predio: 'esc1', unidade: 'stonemason' }], DADOS);
    // teto de seguranca: 150 ticks de treino (30 s DIVIDIDO pela escala
    // `construcao` 2,0 — `paraTicksDeDuracao` divide) mais a viagem do ouro do
    // armazem ate a escola. Medido em 229 ao todo; 6000 e folga, nao medida.
    const { estado: treinado, tick } = rodarAte(
      pedido, (e) => unidadesDoTipo(e, 'stonemason') > 0, 6000,
      'o pedreiro treinado com ouro minerado',
    );
    expect(tick).toBeGreaterThan(0);
    expect(unidadesDoTipo(treinado, 'stonemason')).toBe(1);
    expect(violacoesDeInvariantes(treinado, DADOS)).toEqual([]);
  });
});

/** Timeout do caso lento deste arquivo — ver o comentario junto dele. */
const ORCAMENTO_DO_CASO = 10_000;

describe('F21 — a evidencia', () => {
  // ORCAMENTO de infraestrutura, nao assercao de tempo (CLAUDE.md §8: nenhum `expect`
  // aqui le relogio). Medido 1,8 s na maquina livre em 2026-09-25, e estourou
  // o padrao de 5 s do Vitest com duas sessoes e oito sims em paralelo (calibracao da
  // Fase B). 10 s e ~5x o medido — a mesma regra do caso de carga da F09.
  it('grava test-output/F21.json', () => {
    const inicio = cenarioDaCadeiaDoOuro();
    const marcos: Record<string, number> = {};
    const anota = (chave: string, tick: number): void => {
      if (marcos[chave] === undefined) marcos[chave] = tick;
    };
    let s = inicio;
    for (let t = 1; t <= TETO_DA_CADEIA; t += 1) {
      s = step(s, [], DADOS);
      if ((estoqueDe(s, 'co1').coal ?? 0) > 0) anota('primeiroCarvao', t);
      if ((estoqueDe(s, 'go1').gold_ore ?? 0) > 0) anota('primeiroMinerio', t);
      if ((estoqueDe(s, 'me1').gold ?? 0) > 0) anota('primeiroOuroFundido', t);
      if ((estoqueDe(s, 'arm').gold ?? 0) > 0) anota('ouroNoArmazem', t);
    }
    const pedido = step(s, [{ type: 'EnqueueTraining', predio: 'esc1', unidade: 'stonemason' }], DADOS);
    const { estado: treinado, tick: tickDoTreino } = rodarAte(
      pedido, (e) => unidadesDoTipo(e, 'stonemason') > 0, 6000, 'o treino pago com ouro minerado',
    );

    let semCarvao = cenarioDoOuroSemCarvao();
    let semMina = cenarioDoOuroSemMina();
    for (let t = 1; t <= TETO_DA_CADEIA; t += 1) {
      semCarvao = step(semCarvao, [], DADOS);
      semMina = step(semMina, [], DADOS);
    }

    gravarEvidencia('F21', {
      feature: 'F21 — a cadeia do ouro: gold_mine + coal_mine -> metallurgists -> escola',
      medicaoPrimeiro:
        'a cadeia ja funcionava sem codigo novo (sonda em test-output/zz-probe-F21.json); '
        + 'esta feature entrega o guarda permanente, e a mina que nao esgota virou F21b',
      linhaDeBase: { ouroNoMundoNoTick0: totalNoMundo(inicio, 'gold') },
      marcos,
      noFim: {
        tick: s.tick,
        go1: estoqueDe(s, 'go1'),
        co1: estoqueDe(s, 'co1'),
        me1: estoqueDe(s, 'me1'),
        arm: estoqueDe(s, 'arm'),
        ouroNoMundo: totalNoMundo(s, 'gold'),
      },
      escola: {
        tickDoTreinoDepoisDoPedido: tickDoTreino,
        pedreirosAntes: unidadesDoTipo(s, 'stonemason'),
        pedreirosDepois: unidadesDoTipo(treinado, 'stonemason'),
        ouroNoMundoDepois: totalNoMundo(treinado, 'gold'),
      },
      contraExemplos: {
        semCarvao: {
          ouro: totalNoMundo(semCarvao, 'gold'),
          minerio: totalNoMundo(semCarvao, 'gold_ore'),
          carvao: totalNoMundo(semCarvao, 'coal'),
        },
        semMina: {
          ouro: totalNoMundo(semMina, 'gold'),
          minerio: totalNoMundo(semMina, 'gold_ore'),
          carvao: totalNoMundo(semMina, 'coal'),
        },
      },
      oQueNaoFecha: {
        minaNaoEsgota:
          'gold_mine e iron_mine produzem para sempre: sem `colheita` na receita nao ha tile de onde tirar',
        tiposDeRecursoNoDado: Object.keys(DADOS.recursos.tipos),
        recursosNoMapaEmitido: ['rock', 'tree', 'fish'],
      },
    });

    expect(marcos.ouroNoArmazem).toBeGreaterThan(0);
  }, ORCAMENTO_DO_CASO);
});
