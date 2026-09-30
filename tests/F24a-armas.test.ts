/**
 * F24a — as armas separadas nas seis do GDD (BUILD_PLAN.md, "Aceite da F24a").
 *
 * O primeiro teste e o CAMINHO REAL: as tres oficinas saem de `PlaceBlueprint`,
 * sobem por laborer e serf, o carpinteiro e os dois ferreiros sao TREINADOS na
 * escola, ocupam, o serf abastece da `saida` do armazem, e cada uma das oito
 * saidas volta ao armazem no ombro de um serf. Fixture declarada, e so ela:
 *   - estradas (como F15a: `PlaceRoad` amarraria o aceite ao preco da estrada);
 *   - o desbloqueio (`tiposJaConstruidos` com a serraria e a Casa de Fundicao,
 *     que exigiriam a arvore inteira ate o ferro);
 *   - ferro e carvao no armazem (a abertura nao tem nenhum dos dois).
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, ID_DO_ARMAZEM } from '../src/sim/state';
import type { GameEvent, GameState, PredioCompleto } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { canPlaceRoad } from '../src/sim/estradas';
import { caixaDeTipo } from '../src/sim/footprint';
import { trabalhadorDoTipo } from '../src/sim/ocupacao';
import { escolhaNoComecoDoCiclo, receitaDoTipo } from '../src/sim/producao';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { readFileSync } from 'node:fs';
import { dadosDasPilhas } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { mercadoriasDoEstoque, pilhasDoPredio } from '../src/render/pilhas';
import { comEstradas } from './helpers/jobs-cenario';
import { escolaDoCenario, pedir } from './helpers/escola-cenario';
import { aberturaDaFaseA } from './helpers/abertura';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
import type { TileDeGrid } from '../src/sim/estradas';
import { LADO_DO_JOGADOR } from '../src/sim/state';

const OFICINAS = ['weapons_workshop', 'weapon_smithy', 'armor_smithy'] as const;
/** As oito saidas, lidas do DADO: a uniao de `sai` das tres receitas. */
const SAIDAS: readonly string[] = OFICINAS.flatMap((t) => Object.keys(gameData.producao.receitas[t]?.sai ?? {}));
const DESBLOQUEIO = ['sawmill', 'iron_smithy'];
/** Ferro e carvao no armazem: 3 oficinas, a de madeira nao usa; sobra para a corrida. */
const FERRO_E_CARVAO = 20;
/**
 * 6000 ticks: treino (~180), obra (~300), ocupar, e dois ferreiros que precisam de
 * 5 ciclos cada (sword/pike/crossbow e iron_armor/iron_shield) para passar por
 * todas as saidas. O ciclo das armas e de ~375 ticks; a volta ao armazem e do serf.
 */
const TICKS = 6000;
/** D-PRODUCAO-03a — a encomenda do caso "so lance": maior que as 2 que o caso exige,
 *  e o teto do que pode sair. */
const ENCOMENDA_DE_LANCE = 5;

const evidencia: Record<string, unknown> = {};

function tamanho(tipo: string): { largura: number; altura: number } {
  const c = caixaDeTipo(tipo, 0, 0, gameData);
  if (c === null) throw new Error(`fixture: '${tipo}' sem tamanho`);
  return { largura: c.x1, altura: c.y1 };
}

interface Montagem {
  readonly inicial: GameState;
  readonly plantas: readonly { tipo: string; gx: number; gy: number }[];
  readonly comandos: readonly Command[];
}

/**
 * As tres plantas a leste da escola, com a porta (a linha logo abaixo da caixa)
 * na linha da rua da abertura. Posicao por PREDICADO (`canPlace`), nunca por x
 * digitado; a rua se estende pela linha da porta ate a ultima oficina, cada tile
 * conferido por `canPlaceRoad`.
 */
function montar(): Montagem {
  const base = createInitialState(1);
  const desbloqueado: GameState = {
    ...base, tiposJaConstruidos: [...new Set([...base.tiposJaConstruidos, ...DESBLOQUEIO])],
  };
  const ab = aberturaDaFaseA(desbloqueado);
  const escola = escolaDoCenario(desbloqueado);
  let x = escola.gx + tamanho(escola.tipo).largura;
  const plantas: { tipo: string; gx: number; gy: number }[] = [];
  let comPlantas = desbloqueado;
  for (const tipo of OFICINAS) {
    const { largura, altura } = tamanho(tipo);
    const gy = ab.yRua - altura;
    let achou = false;
    for (let tentativa = 0; tentativa < 30 && !achou; tentativa += 1, x += 1) {
      if (canPlace(comPlantas, tipo, x, gy).ok) {
        plantas.push({ tipo, gx: x, gy });
        achou = true;
        x += largura;
      }
    }
    if (!achou) throw new Error(`fixture: '${tipo}' nao cabe a leste da escola na linha ${gy}`);
    // O `canPlace` da proxima confere sobreposicao contra ESTA: poe a planta como
    // estrada seria mentir; basta nao reusar x (o `x += largura` acima).
    comPlantas = desbloqueado;
  }
  const ultima = plantas[plantas.length - 1];
  if (ultima === undefined) throw new Error('fixture: sem plantas');
  const xFim = ultima.gx + tamanho(ultima.tipo).largura;
  const xIni = Math.max(...ab.rua.filter((t) => t.gy === ab.yRua).map((t) => t.gx)) + 1;
  const extensao: TileDeGrid[] = [];
  for (let gx = xIni; gx < xFim; gx += 1) {
    const t = { gx, gy: ab.yRua };
    if (ab.rua.some((r) => r.gx === gx && r.gy === ab.yRua)) continue;
    const r = canPlaceRoad(desbloqueado, [t]);
    if (!r.ok) throw new Error(`fixture: a rua nao passa em ${gx},${ab.yRua} por '${r.motivo}'`);
    extensao.push(t);
  }
  const armazem = desbloqueado.predios.porId[ab.armazem];
  if (armazem === undefined || armazem.estado !== 'completo') throw new Error('fixture: sem armazem');
  const abastecido: PredioCompleto = {
    ...armazem,
    estoque: { ...armazem.estoque, saida: { ...armazem.estoque.saida, iron: FERRO_E_CARVAO, coal: FERRO_E_CARVAO } },
  };
  const inicial = comEstradas({
    ...desbloqueado, predios: { ...desbloqueado.predios, porId: { ...desbloqueado.predios.porId, [ab.armazem]: abastecido } },
  }, [...ab.rua, ...extensao]);
  const comandos: Command[] = [
    ...plantas.map((p) => ({ type: 'PlaceBlueprint', buildingId: p.tipo, gx: p.gx, gy: p.gy }) as const),
    ...OFICINAS.map((t) => pedir(ab.escola, trabalhadorDoTipo(t) ?? '')),
  ];
  return { inicial, plantas, comandos };
}

function predioDoTipo(e: GameState, tipo: string): PredioCompleto | null {
  for (const id of e.predios.ordem) {
    const p = e.predios.porId[id];
    if (p?.tipo === tipo && p.estado === 'completo') return p;
  }
  return null;
}

/**
 * D-PRODUCAO-03a — a oficina nasce SEM encomenda (troca do aceite aprovada pelo
 * operador). O caminho real encomenda o maximo do dado em cada saida no tick em que a
 * oficina fica pronta, pelo `SetProductionQuota`. `feitas` guarda quem ja recebeu.
 */
function encomendasDoTick(e: GameState, feitas: Set<string>): Command[] {
  const comandos: Command[] = [];
  for (const tipo of OFICINAS) {
    const p = predioDoTipo(e, tipo);
    if (p === null || feitas.has(p.id)) continue;
    feitas.add(p.id);
    const sai = Object.keys(gameData.producao.receitas[tipo]?.sai ?? {});
    comandos.push({ type: 'SetProductionQuota', predio: p.id, cota: Object.fromEntries(sai.map((m) => [m, gameData.producao.encomenda.maxima])) });
  }
  return comandos;
}

function contarEntregas(e: GameState, entregues: Record<string, number>): void {
  for (const ev of e.events) {
    if (ev.type !== 'task-completed') continue;
    if (!SAIDAS.includes(ev.mercadoria)) continue;
    if (e.predios.porId[ev.destino]?.tipo !== ID_DO_ARMAZEM) continue;
    entregues[ev.mercadoria] = (entregues[ev.mercadoria] ?? 0) + 1;
  }
}

describe('F24a — as seis armas e as duas protecoes de ferro, pelo caminho real', () => {
  it('cada uma das oito saidas chega ao armazem partindo do estado inicial', () => {
    const { inicial, plantas, comandos } = montar();
    let s = inicial;
    const entregues: Record<string, number> = Object.fromEntries(SAIDAS.map((m) => [m, 0]));
    const primeiraEm: Record<string, number> = {};
    const produzidas: Record<string, number> = {};
    const feitas = new Set<string>();
    for (let t = 0; t < TICKS; t += 1) {
      s = step(s, t === 0 ? comandos : encomendasDoTick(s, feitas));
      contarEntregas(s, entregues);
      for (const ev of s.events as readonly GameEvent[]) {
        if (ev.type === 'goods-produced' && SAIDAS.includes(ev.mercadoria)) {
          produzidas[ev.mercadoria] = (produzidas[ev.mercadoria] ?? 0) + ev.quantidade;
        }
      }
      for (const m of SAIDAS) if ((entregues[m] ?? 0) > 0 && primeiraEm[m] === undefined) primeiraEm[m] = s.tick;
    }
    evidencia['caminhoReal'] = { plantas, ticks: TICKS, entregues, produzidas, primeiraEntregaNoTick: primeiraEm };
    for (const tipo of OFICINAS) expect(predioDoTipo(s, tipo), tipo).not.toBeNull();
    expect(SAIDAS.length).toBe(8);
    for (const m of SAIDAS) expect(entregues[m], m).toBeGreaterThan(0);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,76 / 0,83 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);

  it('D-PRODUCAO-03a: a oficina nasce sem encomenda, zero em cada saida, e nao comeca ciclo', () => {
    const { inicial, comandos } = montar();
    let s = inicial;
    for (let t = 0; t < 1200 && predioDoTipo(s, 'weapon_smithy') === null; t += 1) s = step(s, t === 0 ? comandos : []);
    const ferreiro = predioDoTipo(s, 'weapon_smithy');
    const escolha = ferreiro?.producao?.escolha;
    expect(escolha).toBeDefined();
    if (escolha === undefined) return;
    expect(escolha.cota).toEqual({ sword: 0, pike: 0, crossbow: 0 });
    const receita = receitaDoTipo('weapon_smithy', gameData);
    expect(receita).not.toBeNull();
    if (ferreiro === null || receita === null) return;
    expect(escolhaNoComecoDoCiclo(ferreiro, receita, gameData)).toBeNull();
    evidencia['escolhaAoNascer'] = { weapon_smithy: escolha };
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,10 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);
});

describe('F24a — a cota (SetProductionQuota)', () => {
  function comOficinasProntas(): { s: GameState; oficina: string } {
    const { inicial, comandos } = montar();
    let s = inicial;
    for (let t = 0; t < 1500 && predioDoTipo(s, 'weapons_workshop') === null; t += 1) s = step(s, t === 0 ? comandos : []);
    const p = predioDoTipo(s, 'weapons_workshop');
    if (p === null) throw new Error('fixture: a oficina nao ficou pronta em 1500 ticks');
    return { s, oficina: p.id };
  }

  it('com a encomenda so de lance, so sai lance, e nao mais que o encomendado', () => {
    const { s: pronto, oficina } = comOficinasProntas();
    let s = step(pronto, [{ type: 'SetProductionQuota', predio: oficina, cota: { lance: ENCOMENDA_DE_LANCE } }]);
    expect(s.events.some((e) => e.type === 'command-rejected')).toBe(false);
    const produzidas: Record<string, number> = {};
    for (let t = 0; t < 3000; t += 1) {
      s = step(s, []);
      for (const ev of s.events) {
        if (ev.type === 'goods-produced' && ev.predio === oficina) {
          produzidas[ev.mercadoria] = (produzidas[ev.mercadoria] ?? 0) + ev.quantidade;
        }
      }
    }
    evidencia['cotaSoLance'] = { produzidas };
    expect(produzidas['lance'] ?? 0).toBeGreaterThan(2);
    expect(produzidas['lance'] ?? 0).toBeLessThanOrEqual(ENCOMENDA_DE_LANCE);
    expect(Object.keys(produzidas).filter((m) => (produzidas[m] ?? 0) > 0)).toEqual(['lance']);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,41 / 0,43 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);

  it('recusa com um motivo por caso', () => {
    const { s: pronto, oficina } = comOficinasProntas();
    const armazem = predioDoTipo(pronto, ID_DO_ARMAZEM)?.id ?? '';
    const emObra = pronto.predios.ordem.find((id) => pronto.predios.porId[id]?.estado === 'obra');
    const casos: [string, Command][] = [
      ['predio-inexistente', { type: 'SetProductionQuota', predio: 'nao-existe', cota: { lance: 1 } }],
      ['sem-escolha', { type: 'SetProductionQuota', predio: armazem, cota: { lance: 1 } }],
      ['mercadoria-invalida', { type: 'SetProductionQuota', predio: oficina, cota: { sword: 1 } }],
      ['cota-invalida', { type: 'SetProductionQuota', predio: oficina, cota: { lance: 1.5 } }],
      ['cota-invalida', { type: 'SetProductionQuota', predio: oficina, cota: { lance: -1 } }],
      // D-PRODUCAO-03a — tudo zero deixou de ser recusa; acima do maximo do dado e
      ['cota-invalida', { type: 'SetProductionQuota', predio: oficina, cota: { lance: gameData.producao.encomenda.maxima + 1 } }],
    ];
    if (emObra !== undefined) casos.push(['predio-em-obra', { type: 'SetProductionQuota', predio: emObra, cota: { lance: 1 } }]);
    const vistos: string[] = [];
    for (const [motivo, cmd] of casos) {
      const depois = step(pronto, [cmd]);
      const recusa = depois.events.find((e) => e.type === 'command-rejected');
      expect(recusa, motivo).toBeDefined();
      if (recusa?.type === 'command-rejected' && recusa.command === 'SetProductionQuota') {
        expect(recusa.motivo, JSON.stringify(cmd)).toBe(motivo);
        vistos.push(recusa.motivo);
      }
    }
    evidencia['recusas'] = { vistos, predioEmObraExercitado: emObra !== undefined };
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,04 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);

  it('recusa predio-em-obra sobre a planta recem-posta', () => {
    const { inicial, plantas } = montar();
    const p = plantas[0];
    if (p === undefined) throw new Error('fixture: sem planta');
    let s = step(inicial, [{ type: 'PlaceBlueprint', buildingId: p.tipo, gx: p.gx, gy: p.gy }]);
    const obra = s.predios.ordem.find((id) => s.predios.porId[id]?.estado === 'obra');
    expect(obra).toBeDefined();
    s = step(s, [{ type: 'SetProductionQuota', predio: obra ?? '', cota: { lance: 1 } }]);
    const recusa = s.events.find((e) => e.type === 'command-rejected');
    expect(recusa?.type === 'command-rejected' && recusa.command === 'SetProductionQuota' ? recusa.motivo : null)
      .toBe('predio-em-obra');
  });
});

describe('F24a — dado', () => {
  it('a uniao de receitas.*.sai esta contida em economia.mercadorias', () => {
    const mercadorias = new Set(gameData.economia.mercadorias);
    const saidas = new Set(Object.values(gameData.producao.receitas).flatMap((r) => Object.keys(r?.sai ?? {})));
    const fora = [...saidas].filter((m) => !mercadorias.has(m));
    evidencia['saidasForaDasMercadorias'] = fora;
    expect(fora).toEqual([]);
    // E as oito das oficinas sao exatamente as seis armas de ferro/madeira e as duas protecoes de ferro.
    expect(new Set(SAIDAS)).toEqual(new Set(['hand_axe', 'lance', 'longbow', 'sword', 'pike', 'crossbow', 'iron_armor', 'iron_shield']));
  });

  it('validate:data reprova um produto sintetico arma_madeira em production.json', () => {
    const dados: Record<string, unknown> = {};
    for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8')) as unknown;
    expect(validarTudo(JSON.parse(JSON.stringify(dados)))).toEqual([]);
    const quebrado = JSON.parse(JSON.stringify(dados)) as { production: { predios: Record<string, { sai: Record<string, number> }> } };
    const oficina = quebrado.production.predios['weapons_workshop'];
    if (oficina === undefined) throw new Error('fixture: sem weapons_workshop no dado');
    oficina.sai = { arma_madeira: 0.8 };
    const erros = validarTudo(quebrado as unknown as Record<string, unknown>);
    evidencia['validacaoSintetica'] = erros;
    expect(erros.some((e: string) => e.includes('producao/saida-desconhecida') && e.includes('arma_madeira'))).toBe(true);
  });

  it('a saida das tres oficinas tem pilha no render (funil de dadosDasPilhas)', () => {
    const dados = dadosDasPilhas({ assets: [] } as unknown as Manifesto);
    const porTipo: Record<string, string[]> = {};
    for (const tipo of OFICINAS) {
      const sai = Object.keys(gameData.producao.receitas[tipo]?.sai ?? {});
      const predio: PredioCompleto = {
        lado: LADO_DO_JOGADOR, id: 'p1', tipo, gx: 0, gy: 0, hp: 1, estado: 'completo',
        capacidade: { entrada: null, saida: null },
        estoque: { entrada: {}, saida: Object.fromEntries(sai.map((m) => [m, 1])) },
        ocupante: null, producao: null, pausado: false, reparo: false,
      };
      expect(mercadoriasDoEstoque(predio, dados.contexto).saida.map(([m]) => m).sort()).toEqual([...sai].sort());
      porTipo[tipo] = pilhasDoPredio(predio, dados).filter((p) => p.gaveta === 'saida').map((p) => p.mercadoria);
      expect(porTipo[tipo]?.sort()).toEqual([...sai].sort());
    }
    evidencia['pilhasDaSaida'] = porTipo;
  });
});

describe('F24a — determinismo', () => {
  it('save/load no meio do rodizio da o mesmo estado', () => {
    const { inicial, comandos } = montar();
    // D-PRODUCAO-03a — os ticks das encomendas saem de uma corrida previa (a sim e
    // deterministica): o `comandosNoTick` so recebe o tick.
    const porTick = new Map<number, Command[]>();
    {
      let e = inicial;
      const feitas = new Set<string>();
      for (let t = 0; t < 2600; t += 1) {
        const c = t === 0 ? comandos : encomendasDoTick(e, feitas);
        if (t > 0 && c.length > 0) porTick.set(e.tick, [...c]);
        e = step(e, c);
      }
    }
    expect(porTick.size).toBe(OFICINAS.length);
    // `compararComESemSave` parte do createInitialState: o fixture entra pelo antesDoStep, no tick 0.
    const { direto, comSave } = compararComESemSave({
      seed: 1, totalTicks: 2600, saveAtTick: 1900,
      antesDoStep: (e) => (e.tick === 0 ? inicial : e),
      comandosNoTick: (t) => (t === 0 ? comandos : porTick.get(t) ?? []),
    });
    expect(comSave).toBe(direto);
    gravarEvidencia('F24a', evidencia);
    // `timeout` NAO e assercao de tempo (§8): existe para o caso travar. Medido: 0,65 s
    // isolado (2026-09-29); 5x daria menos, e o limite fica no piso, o padrao do Vitest.
  }, 5_000);
});
