/**
 * F15a — o estado de producao: o relogio do ciclo e o veio.
 *
 * O campo `PredioCompleto.producao` nasce em `completarObra` e em `criarPredios`,
 * os dois unicos lugares onde um predio completo passa a existir. `null` quando
 * o tipo nao tem receita: "nao produz" nao pode ser representavel como "produz,
 * parado".
 *
 * A segunda metade cobre `sim/producao.ts`: as derivacoes puras do ciclo
 * (receita, insumo, gaveta, veio), sem tick e sem FSM. Quem as usa e a Tarefa 5.
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto, PredioEmObra } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { ReceitaDePredio } from '../src/sim/data/types';
import {
  cabeNaSaida, consumirInsumos, ehPredioProdutivo, receitaDoTipo, semRecursoAoAlcance, temInsumo, unidadesPorCiclo,
} from '../src/sim/producao';
import { step } from '../src/sim/tick';
import {
  avancar, cenarioDePedreira, cenarioDeSerraria, comEntrada, comJazida, comSaida, disponivelDe, entradaDe,
  eventosNoTick, fsmDe, progressoDe, saidaDe, semAUnidade, semEstrada, semOcupante,
  rochaDaPedreiraDaVila,
} from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';

function obraDe(tipo: string): PredioEmObra {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`fixture: predio '${tipo}' nao existe em buildings.json`);
  return {
    id: 'obra1', tipo, gx: 5, gy: 5, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  };
}

// F-T3 — o ciclo da pedreira deixou de caber dentro do predio: ele inclui a IDA
// ao tile e a VOLTA. `ticksDoCiclo` continua vindo do dado; a viagem vem do
// MAPA — 49 ticks em cada perna, da porta (26,36) ao tile (24,29) que esta
// pedreira escolhe, mais o tick da transicao (medido na trilha de
// `test-output/F-T3-ciclo-em-campo.json`).
const VIAGEM = 99;
const INTERVALO = receita('quarry').ticksDoCiclo + VIAGEM;

describe('F15a — PredioCompleto.producao', () => {
  // F-T2a: o predio deixou de carregar o total. Ele nasce so com o relogio, e o
  // que ha para colher esta no MAPA desde o tick 0 — e continua la depois que
  // ele for demolido. E essa a diferenca que mata o exploit da F16a.
  //
  // F18: `plantio: null` entrou na forma, e o ponto do guarda nao mudou — o
  // predio continua nascendo sem NADA colhivel dentro dele. Plantio e trabalho
  // em curso, nao estoque: nenhum predio nasce com um.
  it('produtor nasce SO com o relogio zerado — o total nao mora nele', () => {
    expect(completarObra(obraDe('quarry')).producao).toEqual({ progresso: 0, plantio: null });
  });

  it('produtor sem colheita nasce com a mesma forma: nada o distingue no predio', () => {
    expect(completarObra(obraDe('sawmill')).producao).toEqual({ progresso: 0, plantio: null });
    expect(completarObra(obraDe('woodcutters')).producao).toEqual({ progresso: 0, plantio: null });
  });

  it('predio sem receita nasce com `producao: null`', () => {
    expect(completarObra(obraDe('storehouse')).producao).toBeNull();
    expect(completarObra(obraDe('schoolhouse')).producao).toBeNull();
  });

  it('os predios do estado inicial tambem passam pelo mesmo semeador', () => {
    const estado = createInitialState(1);
    for (const id of estado.predios.ordem) {
      const p = estado.predios.porId[id];
      if (p?.estado !== 'completo') continue;
      const receita = gameData.producao.receitas[p.tipo];
      if (receita === undefined) expect(p.producao, p.tipo).toBeNull();
      else expect(p.producao, p.tipo).toEqual({ progresso: 0, plantio: null });
    }
  });

  it('`producao` e `null`, nunca `undefined` — o estado tem que sobreviver ao JSON', () => {
    const ida = createInitialState(1);
    expect(JSON.parse(JSON.stringify(ida))).toEqual(ida);
  });
});

/** Um produtor completo (mesmo caminho do jogo), com as gavetas que o caso pede. */
function produtor(
  tipo: string,
  estoque: { entrada?: Record<string, number>; saida?: Record<string, number> } = {},
): PredioCompleto {
  const p = completarObra(obraDe(tipo));
  return { ...p, estoque: { entrada: estoque.entrada ?? {}, saida: estoque.saida ?? {} } };
}

function receita(tipo: string): ReceitaDePredio {
  const r = gameData.producao.receitas[tipo];
  if (!r) throw new Error(`fixture: '${tipo}' nao tem receita em production.json`);
  return r;
}

describe('F15a — sim/producao.ts, as derivacoes puras', () => {
  it('receitaDoTipo devolve null para quem nao produz — nunca undefined', () => {
    expect(receitaDoTipo('storehouse')).toBeNull();
    expect(receitaDoTipo('tipo-que-nao-existe')).toBeNull();
    expect(receitaDoTipo('quarry')?.ticksDoCiclo).toBeGreaterThan(0);
  });

  it('ehPredioProdutivo: obra nao produz, armazem completo nao produz', () => {
    expect(ehPredioProdutivo(undefined)).toBe(false);
    expect(ehPredioProdutivo(obraDe('quarry'))).toBe(false);
    expect(ehPredioProdutivo(produtor('storehouse'))).toBe(false);
    expect(ehPredioProdutivo(produtor('quarry'))).toBe(true);
  });

  it('temInsumo exige TODAS as mercadorias da receita, nao uma', () => {
    const m = produtor('metallurgists', { entrada: { gold_ore: 1 } });
    expect(temInsumo(m, receita('metallurgists'))).toBe(false); // falta coal
    const completo = produtor('metallurgists', { entrada: { gold_ore: 1, coal: 1 } });
    expect(temInsumo(completo, receita('metallurgists'))).toBe(true);
  });

  it('temInsumo e verdade de vacuo para receita sem entrada (a quarry tira do veio)', () => {
    expect(temInsumo(produtor('quarry'), receita('quarry'))).toBe(true);
  });

  it('consumirInsumos debita so o que o ciclo pede e nao toca na saida', () => {
    const s = consumirInsumos(produtor('sawmill', { entrada: { tree_trunk: 3 } }), receita('sawmill'));
    expect(s.estoque.entrada.tree_trunk).toBe(2);
    expect(s.estoque.saida).toEqual({});
  });

  it('cabeNaSaida respeita a capacidade da GAVETA, nao o total do predio', () => {
    // capacidade.saida = 5 (estoqueInternoPorPredio); o ciclo da sawmill rende 2
    expect(cabeNaSaida(produtor('sawmill', { saida: { timber: 4 } }), receita('sawmill'))).toBe(false);
    expect(cabeNaSaida(produtor('sawmill', { saida: { timber: 3 } }), receita('sawmill'))).toBe(true);
  });

  it('cabeNaSaida conta a gaveta INTEIRA, somando mercadorias diferentes', () => {
    const p = produtor('swine_farm', { saida: { pigs: 2, skins: 2 } }); // 4 ocupados, ciclo rende 2
    expect(cabeNaSaida(p, receita('swine_farm'))).toBe(false);
  });

  it('unidadesPorCiclo soma as mercadorias de saida', () => {
    expect(unidadesPorCiclo(receita('quarry'))).toBe(1);
    expect(unidadesPorCiclo(receita('sawmill'))).toBe(2);
    expect(unidadesPorCiclo(receita('swine_farm'))).toBe(2); // 1 pig + 1 skin
  });

  // F-T2a: `veioEsgotado(producao, receita)` virou `semRecursoAoAlcance(state,
  // predio, receita)`. A propriedade que as duas assercoes provam e a MESMA — o
  // predicado congela o ciclo antes do zero, ja quando o que sobrou nao da um
  // ciclo inteiro; o que mudou foi so a quem ele pergunta.
  it('semRecursoAoAlcance e falso para receita sem colheita, mesmo com o relogio cheio', () => {
    expect(semRecursoAoAlcance(createInitialState(1), produtor('sawmill'), receita('sawmill'))).toBe(false);
  });

  it('semRecursoAoAlcance ja e verdade quando o que sobrou nao da um CICLO inteiro', () => {
    const r: ReceitaDePredio = { ...receita('quarry'), sai: { stone: 2 } };
    // um unico tile de rock ao alcance da pedreira de `obraDe` (5,5)
    const umaPedra = comJazida(gameData, 'rock', [[4, 4]], 1);
    const duasPedras = comJazida(gameData, 'rock', [[4, 4]], 2);
    expect(semRecursoAoAlcance(createInitialState(1, umaPedra), produtor('quarry'), r, umaPedra)).toBe(true);
    expect(semRecursoAoAlcance(createInitialState(1, duasPedras), produtor('quarry'), r, duasPedras)).toBe(false);
  });
});

describe('F15a — o especialista produz', () => {

  // A assercao ficou mais ESTRITA, e nao mais larga: antes conferia dois
  // depositos, agora confere quatro; antes o tick anterior so nao tinha pedra,
  // agora tambem diz onde o relogio esta (ciclo PRONTO, ele volta carregado).
  it(`pedreira ocupada e ligada deposita 1 stone a cada ${INTERVALO} ticks`, () => {
    let s = avancar(cenarioDePedreira(), INTERVALO - 1);
    expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
    expect(progressoDe(s, 'q1')).toBe(receita('quarry').ticksDoCiclo);
    s = avancar(s, 1);
    expect(saidaDe(s, 'q1').stone).toBe(1);
    for (const n of [2, 3, 4]) {
      s = avancar(s, INTERVALO);
      expect(saidaDe(s, 'q1').stone, `deposito ${n}`).toBe(n); // intervalo EXATO
    }
  });

  it('o especialista que produz nunca fica `ocioso`', () => {
    // F-T3 — "esta em `trabalhando` no tick 400" deixou de ser a pergunta: o ciclo
    // passa por quatro estados legitimos e o tick 400 cai no meio da colheita. A
    // pergunta permanente sempre foi "ele nunca cai em `ocioso`" — e agora ela e
    // conferida nos 400 ticks, um por um, em vez de num so. E a lista de estados
    // VISTOS e exata: um estado a mais ou a menos reprova.
    let s = cenarioDePedreira();
    const vistos = new Set<string>();
    for (let t = 0; t < 400; t += 1) {
      s = avancar(s, 1);
      vistos.add(fsmDe(s, 'u1'));
    }
    expect(vistos.has('ocioso')).toBe(false);
    expect([...vistos].sort()).toEqual(['colhendo', 'indo_colher', 'trabalhando', 'voltando']);
  });

  it('predio sem ocupante nao produz (Nota da F14: quem produz e o ocupante)', () => {
    const vazia = semAUnidade(semOcupante(cenarioDePedreira(), 'q1'), 'u1');
    const s = avancar(vazia, 400);
    expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
    expect(progressoDe(s, 'q1')).toBe(0);
  });

  it('ocupante que perdeu o predio volta a procurar — a posse mora no predio (F14)', () => {
    const s = avancar(semOcupante(cenarioDePedreira(), 'q1'), 1);
    expect(fsmDe(s, 'u1')).toBe('ocioso');
  });

  // ESTA ASSERCAO FOI INVERTIDA DE PROPOSITO (2026-09-25). Ela afirmava o
  // contrario — "nao produz, o relogio nem comeca, fica em `saida_cheia`" — e era
  // o aceite da decisao D6 da F15a. O operador REVOGOU a D6: "a estrada serve para
  // escoar, nao para trabalhar; o lenhador corta arvore com machado, nao com
  // carroca". Ela ficou no lugar, com o mesmo nome de arquivo e a mesma vizinhanca,
  // para que o historico do git mostre a inversao — apagar e criar outro perderia o
  // rastro. Agora ela e o ACEITE DA REVOGACAO.
  it('predio sem ligacao ao armazem PRODUZ, e para quando a gaveta enche', () => {
    const CAPACIDADE = gameData.producao.estoqueInternoPorPredio.saida;
    let s = semEstrada(cenarioDePedreira());
    expect(Object.keys(s.estradas)).toHaveLength(0); // nenhuma rua, do primeiro tick
    // Sem rua a viagem e mais LENTA, entao o intervalo nao e o `INTERVALO` da
    // pedreira ligada: ele se mede aqui. O que se afirma e que produz, e o teto do
    // laco e generoso de proposito — quem afirma tick exato e o caso de cima.
    let primeiro: number | null = null;
    for (let i = 1; i <= INTERVALO * 3 && primeiro === null; i += 1) {
      s = step(s, []);
      if ((saidaDe(s, 'q1').stone ?? 0) > 0) primeiro = i;
    }
    expect(primeiro).not.toBeNull();
    expect(saidaDe(s, 'q1').stone).toBe(1);

    // e para no TETO DA GAVETA, nao antes: o que segura e a capacidade, nao a rua
    const cheio = avancar(s, (primeiro ?? 0) * (CAPACIDADE + 1));
    expect(saidaDe(cheio, 'q1').stone).toBe(CAPACIDADE);
    expect(fsmDe(cheio, 'u1')).toBe('saida_cheia'); // agora por gaveta, nao por rua
    expect(progressoDe(cheio, 'q1')).toBe(receita('quarry').ticksDoCiclo);

    // e segue parado: sem rua ninguem vem buscar, entao a gaveta nao esvazia
    const depois = avancar(cheio, (primeiro ?? 0) * 2);
    expect(saidaDe(depois, 'q1').stone).toBe(CAPACIDADE);
    expect(fsmDe(depois, 'u1')).toBe('saida_cheia');
  });

  it('saida cheia: para em `saida_cheia` e NAO perde o ciclo pronto', () => {
    // F-T3 — seis CICLOS, e o ciclo agora e `INTERVALO`: cinco couberam na gaveta
    // e o sexto volta do campo com a pedra na mao e sem lugar para ela.
    const s = avancar(cenarioDePedreira(), INTERVALO * 6);
    expect(saidaDe(s, 'q1').stone).toBe(5);  // o teto da gaveta
    expect(fsmDe(s, 'u1')).toBe('saida_cheia');
    expect(progressoDe(s, 'q1')).toBe(167);  // ciclo pronto, so nao coube
    const depois = avancar(comSaida(s, 'q1', { stone: 4 }), 1);
    expect(saidaDe(depois, 'q1').stone).toBe(5); // depositou no tick seguinte
    expect(progressoDe(depois, 'q1')).toBe(0);
    expect(fsmDe(depois, 'u1')).toBe('trabalhando');
  });

  it('sawmill sem tronco fica em `esperando_insumo` e nao gasta relogio', () => {
    const s = avancar(cenarioDeSerraria(), 300);
    expect(fsmDe(s, 'u2')).toBe('esperando_insumo');
    expect(progressoDe(s, 's1')).toBe(0);
    expect(saidaDe(s, 's1').timber ?? 0).toBe(0);
  });

  it('sawmill com 1 tronco consome 1 e rende 2 timber em 273 ticks', () => {
    let s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 1 });
    s = avancar(s, 1);
    expect(entradaDe(s, 's1').tree_trunk).toBe(0); // cobrado no INICIO do ciclo
    expect(saidaDe(s, 's1').timber ?? 0).toBe(0);
    s = avancar(s, 272);
    expect(saidaDe(s, 's1').timber).toBe(2);
    expect(fsmDe(s, 'u2')).toBe('trabalhando');
    s = avancar(s, 1); // sem outro tronco, volta a esperar
    expect(fsmDe(s, 'u2')).toBe('esperando_insumo');
  });

  it('cada ciclo emite `goods-produced` com a quantidade do ciclo', () => {
    const s = comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 1 });
    expect(eventosNoTick(s, 273)).toContainEqual(
      { type: 'goods-produced', predio: 's1', mercadoria: 'timber', quantidade: 2 },
    );
  });

  it('jazida esgota: evento no tick exato, e depois a pedreira nao produz mais', () => {
    const dadosCurtos = comJazida(gameData, 'rock', [rochaDaPedreiraDaVila()], 2); // 1 tile de 2 pedras e acabou
    // F-T3 — dois ciclos, e cada um agora inclui a viagem ate (25,32): 28 ticks de
    // ida, 29 de volta (este tile e mais perto que o do cenario cheio, e por isso o
    // intervalo aqui e menor que o de cima — a viagem e do MAPA, nao do dado).
    const CURTO = receita('quarry').ticksDoCiclo + 57;
    expect(eventosNoTick(cenarioDePedreira(dadosCurtos), CURTO * 2, dadosCurtos)).toContainEqual(
      { type: 'vein-exhausted', predio: 'q1', tipo: 'quarry' },
    );
    const s = avancar(cenarioDePedreira(dadosCurtos), CURTO * 5, dadosCurtos);
    expect(saidaDe(s, 'q1').stone).toBe(2);
    expect(disponivelDe(s, 'q1', dadosCurtos)).toBe(0);
    expect(fsmDe(s, 'u1')).toBe('esperando_insumo');
  });

  it('o evento de veio esgotado sai UMA vez, nao a cada tick depois', () => {
    const dadosCurtos = comJazida(gameData, 'rock', [rochaDaPedreiraDaVila()], 2);
    let s = cenarioDePedreira(dadosCurtos);
    let quantos = 0;
    for (let i = 0; i < (receita('quarry').ticksDoCiclo + 57) * 4; i++) {
      s = step(s, [], dadosCurtos);
      quantos += s.events.filter((e) => e.type === 'vein-exhausted').length;
    }
    expect(quantos).toBe(1);
  });
});

/**
 * O guarda `violacoesDaFsmDoEspecialista` passou a aceitar `esperando_insumo` e
 * `saida_cheia`. Alargar um guarda sem provar que ele ainda acusa e como
 * desliga-lo: toda a suite so o chama sobre estados SADIOS, o que mostra que
 * ele nao da falso positivo — nunca que ele acusa. Este bloco prova o outro
 * sentido (mesma razao de `F14-invariantes-destino.test.ts`).
 */
describe('F15a — o guarda da FSM do especialista ACUSA', () => {
  // O veiculo para chegar em `saida_cheia` era a AUSENCIA DE ESTRADA, pelo portao da
  // D6. Com a D6 revogada (2026-09-25) predio desligado PRODUZ, e o unico caminho
  // legitimo para esse rotulo e a GAVETA CHEIA: seis ciclos na pedreira ligada, como
  // no caso de cima — cinco couberam, o sexto volta do campo sem lugar para a pedra.
  // Encher a gaveta a mao nao serve: o especialista sai para colher antes de descobrir
  // que nao cabe, entao no tick 2 ele esta em `indo_colher` (medido). O guarda em si
  // nao mudou: quem e afirmado aqui e `violacoesDaFsmDoEspecialista`.
  const gavetaCheia = (): GameState => avancar(cenarioDePedreira(), INTERVALO * 6);

  it('estado de producao sem predio que o reconheca e acusado', () => {
    const s = gavetaCheia();
    expect(fsmDe(s, 'u1')).toBe('saida_cheia');
    expect(violacoesDaFsmDoEspecialista(s)).toEqual([]); // ocupada: sadio
    expect(violacoesDaFsmDoEspecialista(semOcupante(s, 'q1'))).toContain(
      'u1: saida_cheia sem predio que o reconheca',
    );
  });

  it('predio cujo ocupante esta em estado que NAO e de producao e acusado', () => {
    const s = gavetaCheia();
    const u = s.unidades.porId.u1;
    if (u === undefined) throw new Error('fixture: u1 sumiu');
    const ocioso = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, u1: { ...u, fsm: 'ocioso' } } } };
    expect(violacoesDaFsmDoEspecialista(ocioso)).toContain("q1: ocupante 'u1' esta em 'ocioso'");
  });

  it('estado fora do GDD §6.2 continua acusado', () => {
    const s = gavetaCheia();
    const u = s.unidades.porId.u1;
    if (u === undefined) throw new Error('fixture: u1 sumiu');
    const invalido = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, u1: { ...u, fsm: 'dancando' } } } };
    expect(violacoesDaFsmDoEspecialista(invalido)).toContain("u1: estado 'dancando' fora do GDD §6.2");
  });
});
