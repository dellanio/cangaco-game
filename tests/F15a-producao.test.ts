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
  cabeNaSaida, consumirInsumos, ehPredioProdutivo, receitaDoTipo, temInsumo, unidadesPorCiclo, veioEsgotado,
} from '../src/sim/producao';
import { step } from '../src/sim/tick';
import {
  avancar, cenarioDePedreira, cenarioDeSerraria, comEntrada, comRendimento, comSaida, entradaDe,
  eventosNoTick, fsmDe, progressoDe, saidaDe, semAUnidade, semEstrada, semOcupante, veioDe,
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

describe('F15a — PredioCompleto.producao', () => {
  it('produtor nasce com relogio zerado e o veio semeado do dado', () => {
    const quarry = completarObra(obraDe('quarry'));
    expect(quarry.producao).toEqual({
      progresso: 0,
      veio: gameData.producao.receitas.quarry?.rendimentoDoVeio,
    });
    expect(quarry.producao?.veio).toBeGreaterThan(0);
  });

  it('produtor sem veio no dado nasce renovavel (`veio: null`)', () => {
    expect(completarObra(obraDe('sawmill')).producao).toEqual({ progresso: 0, veio: null });
    expect(completarObra(obraDe('woodcutters')).producao).toEqual({ progresso: 0, veio: null });
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
      else expect(p.producao, p.tipo).toEqual({ progresso: 0, veio: receita.rendimentoDoVeio });
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

  it('veioEsgotado e falso para receita renovavel, mesmo com o relogio cheio', () => {
    expect(veioEsgotado({ progresso: 999, veio: null }, receita('sawmill'))).toBe(false);
  });

  it('veioEsgotado ja e verdade quando o veio nao rende um CICLO inteiro', () => {
    const r: ReceitaDePredio = { ...receita('quarry'), sai: { stone: 2 } };
    expect(veioEsgotado({ progresso: 0, veio: 1 }, r)).toBe(true);
    expect(veioEsgotado({ progresso: 0, veio: 2 }, r)).toBe(false);
  });
});

describe('F15a — o especialista produz', () => {
  it('pedreira ocupada e ligada deposita 1 stone a cada 167 ticks', () => {
    let s = avancar(cenarioDePedreira(), 166);
    expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
    s = avancar(s, 1);
    expect(saidaDe(s, 'q1').stone).toBe(1); // tick 167
    s = avancar(s, 167);
    expect(saidaDe(s, 'q1').stone).toBe(2); // tick 334, intervalo EXATO
  });

  it('o especialista que produz nunca fica `ocioso`', () => {
    const s = avancar(cenarioDePedreira(), 400);
    expect(fsmDe(s, 'u1')).toBe('trabalhando');
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

  it('predio sem ligacao ao armazem nao produz e fica em `saida_cheia`', () => {
    const s = avancar(semEstrada(cenarioDePedreira()), 400);
    expect(saidaDe(s, 'q1').stone ?? 0).toBe(0);
    expect(progressoDe(s, 'q1')).toBe(0);       // o relogio nem comeca
    expect(fsmDe(s, 'u1')).toBe('saida_cheia'); // D6: nao escoa, GDD §5.1 + §6.2
  });

  it('saida cheia: para em `saida_cheia` e NAO perde o ciclo pronto', () => {
    const s = avancar(cenarioDePedreira(), 167 * 6);
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

  it('veio esgota: evento no tick exato, e depois a pedreira nao produz mais', () => {
    const dadosCurtos = comRendimento(gameData, 'quarry', 2); // 2 pedras e acabou
    expect(eventosNoTick(cenarioDePedreira(dadosCurtos), 334, dadosCurtos)).toContainEqual(
      { type: 'vein-exhausted', predio: 'q1', tipo: 'quarry' },
    );
    const s = avancar(cenarioDePedreira(dadosCurtos), 167 * 5, dadosCurtos);
    expect(saidaDe(s, 'q1').stone).toBe(2);
    expect(veioDe(s, 'q1')).toBe(0);
    expect(fsmDe(s, 'u1')).toBe('esperando_insumo');
  });

  it('o evento de veio esgotado sai UMA vez, nao a cada tick depois', () => {
    const dadosCurtos = comRendimento(gameData, 'quarry', 2);
    let s = cenarioDePedreira(dadosCurtos);
    let quantos = 0;
    for (let i = 0; i < 167 * 4; i++) {
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
  const semLigacao = (): GameState => avancar(semEstrada(cenarioDePedreira()), 2);

  it('estado de producao sem predio que o reconheca e acusado', () => {
    const s = semLigacao();
    expect(fsmDe(s, 'u1')).toBe('saida_cheia');
    expect(violacoesDaFsmDoEspecialista(s)).toEqual([]); // ocupada: sadio
    expect(violacoesDaFsmDoEspecialista(semOcupante(s, 'q1'))).toContain(
      'u1: saida_cheia sem predio que o reconheca',
    );
  });

  it('predio cujo ocupante esta em estado que NAO e de producao e acusado', () => {
    const s = semLigacao();
    const u = s.unidades.porId.u1;
    if (u === undefined) throw new Error('fixture: u1 sumiu');
    const ocioso = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, u1: { ...u, fsm: 'ocioso' } } } };
    expect(violacoesDaFsmDoEspecialista(ocioso)).toContain("q1: ocupante 'u1' esta em 'ocioso'");
  });

  it('estado fora do GDD §6.2 continua acusado', () => {
    const s = semLigacao();
    const u = s.unidades.porId.u1;
    if (u === undefined) throw new Error('fixture: u1 sumiu');
    const invalido = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, u1: { ...u, fsm: 'dancando' } } } };
    expect(violacoesDaFsmDoEspecialista(invalido)).toContain("u1: estado 'dancando' fora do GDD §6.2");
  });
});
