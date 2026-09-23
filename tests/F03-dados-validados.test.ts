import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { gameData, loadGameData, rawGameData } from '../src/sim/data';
import type { ConversaoRegistrada, GameData } from '../src/sim/data';
import { gravarEvidencia } from './helpers/evidence';

/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures mutam JSON
   heterogeneo; tipar cada forma aqui so pra este teste seria ruido. */

function carregarDadosReais(): Record<string, any> {
  const dados: Record<string, any> = {};
  for (const nome of ARQUIVOS) {
    dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
  }
  return dados;
}

function clonar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function acharPredio(d: Record<string, any>, id: string): any {
  const p = d.buildings.predios.find((x: any) => x.id === id);
  if (!p) throw new Error(`fixture: predio '${id}' nao existe no dado real`);
  return p;
}

interface Fixture {
  readonly nome: string;
  readonly regraEsperada: string;
  readonly quebrar: (d: Record<string, any>) => void;
}

const fixtures: Fixture[] = [
  { nome: 'storehouse.hp errado', regraEsperada: 'predios/hp',
    quebrar: (d) => { acharPredio(d, 'storehouse').hp = 999; } },
  { nome: 'remove um predio', regraEsperada: 'predios/contagem',
    quebrar: (d) => { d.buildings.predios.pop(); } },
  { nome: 'quarry.desbloqueadoPor fica pendurado', regraEsperada: 'predios/desbloqueio-pendurado',
    quebrar: (d) => { acharPredio(d, 'quarry').desbloqueadoPor = 'nao_existe'; } },
  { nome: 'storehouse.desbloqueadoPor cria ciclo', regraEsperada: 'predios/ciclo',
    quebrar: (d) => { acharPredio(d, 'storehouse').desbloqueadoPor = 'sawmill'; } },
  { nome: 'schoolhouse vira raiz tambem', regraEsperada: 'predios/raiz-unica',
    quebrar: (d) => { acharPredio(d, 'schoolhouse').desbloqueadoPor = null; } },
  { nome: 'quarry.trabalhador inexistente', regraEsperada: 'predios/trabalhador',
    quebrar: (d) => { acharPredio(d, 'quarry').trabalhador = 'ninguem'; } },
  { nome: 'production referencia predio fantasma', regraEsperada: 'producao/predio-inexistente',
    quebrar: (d) => { d.production.predios.fantasma = { entra: {}, sai: { ouro: 1 } }; } },
  { nome: 'quarry.sai.stone zerado', regraEsperada: 'producao/taxa-nao-positiva',
    quebrar: (d) => { d.production.predios.quarry.sai.stone = 0; } },
  // F15a: o carregador deriva a receita em ciclo e arredonda a razao das taxas
  // UMA vez. Estas tres provam que o dado que sairia distorcido nao passa.
  { nome: 'bakery com razao que o arredondamento distorce', regraEsperada: 'producao/razao-distorcida',
    quebrar: (d) => { d.production.predios.bakery.sai.loaves = d.production.predios.bakery.entra.flour * 1.9; } },
  { nome: 'veio com rendimento fracionario', regraEsperada: 'producao/veio-invalido',
    quebrar: (d) => { d.production.predios.quarry.veio.rendimento = 2.5; } },
  { nome: 'veio com rendimento zero', regraEsperada: 'producao/veio-invalido',
    quebrar: (d) => { d.production.predios.quarry.veio.rendimento = 0; } },
  { nome: 'production.escala aponta pra grupo inexistente', regraEsperada: 'tempo/grupo-inexistente',
    quebrar: (d) => { d.production.escala = 'inexistente'; } },
  { nome: 'delivery perde a chave escala', regraEsperada: 'tempo/duracao-sem-grupo',
    quebrar: (d) => { delete d.delivery.escala; } },
  { nome: 'condition ganha campo de tempo nao registrado', regraEsperada: 'tempo/duracao-nao-registrada',
    quebrar: (d) => { d.condition.novoCampo_segundos = 5; } },
];

/** Copia data/ para o scratchpad da sessao, quebra um valor, roda o CLI de
 *  verdade e devolve o codigo de saida e o stderr. Prova ponta a ponta, nao
 *  so a funcao pura — a copia vive fora do repositorio. */
function rodarCliContraCopiaQuebrada(): { codigo: number | null; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cangaco-f03-'));
  cpSync('data', dir, { recursive: true });
  const buildings = JSON.parse(readFileSync(join(dir, 'buildings.json'), 'utf8'));
  buildings.predios[0].hp = 999;
  writeFileSync(join(dir, 'buildings.json'), JSON.stringify(buildings, null, 2));
  const resultado = spawnSync('node', ['tools/validate-data.js', '--dir', dir], { encoding: 'utf8' });
  return { codigo: resultado.status, stderr: resultado.stderr };
}

describe('F03 — validate:data reprova dado invalido', () => {
  const dadosReais = carregarDadosReais();

  it('o dado real passa limpo (senao os fixtures abaixo nao provariam nada)', () => {
    expect(validarTudo(clonar(dadosReais))).toEqual([]);
  });

  it.each(fixtures)('$nome dispara $regraEsperada', ({ quebrar, regraEsperada }) => {
    const quebrado = clonar(dadosReais);
    quebrar(quebrado);
    const erros = validarTudo(quebrado);
    expect(erros.some((e) => e.startsWith(`${regraEsperada}:`))).toBe(true);
  });

  it('delivery.escala=null (o valor real) NAO dispara tempo/grupo-inexistente', () => {
    const d = clonar(dadosReais);
    expect(d.delivery.escala).toBeNull();
    const erros = validarTudo(d);
    expect(erros.some((e) => e.startsWith('tempo/grupo-inexistente') && e.includes('delivery'))).toBe(false);
  });

  it('CLI ponta a ponta: copia quebrada no scratchpad sai com codigo 1', () => {
    const { codigo, stderr } = rodarCliContraCopiaQuebrada();
    expect(codigo).toBe(1);
    expect(stderr).toMatch(/predios\/hp/);
  });
});

// --- Task 4: aceite do carregamento e da escala ---

/** Varre um objeto atras de qualquer chave com o nome dado. Usado para
 *  provar que `escalas` nunca vaza para GameData. */
function acharChave(valor: unknown, chave: string, caminho = 'gameData'): string[] {
  const achados: string[] = [];
  const visitar = (v: unknown, p: string, vistos: Set<unknown>): void => {
    if (v === null || typeof v !== 'object') return;
    if (vistos.has(v)) return;
    vistos.add(v);
    for (const [k, filho] of Object.entries(v)) {
      if (k === chave) achados.push(`${p}.${k}`);
      visitar(filho, `${p}.${k}`, vistos);
    }
  };
  visitar(valor, caminho, new Set());
  return achados;
}

function verificarGrafoDeDesbloqueio(
  predios: readonly { readonly id: string; readonly desbloqueadoPor: string | null }[],
): { readonly raizes: string[]; readonly pendurados: string[]; readonly temCiclo: boolean } {
  const ids = new Set(predios.map((p) => p.id));
  const pendurados = predios
    .filter((p) => p.desbloqueadoPor !== null && !ids.has(p.desbloqueadoPor))
    .map((p) => p.id);
  const raizes = predios.filter((p) => p.desbloqueadoPor === null).map((p) => p.id);
  const grafo = new Map(predios.map((p) => [p.id, p.desbloqueadoPor]));
  let temCiclo = false;
  for (const p of predios) {
    const visitados = new Set<string>();
    let atual: string | null = p.id;
    while (atual !== null && grafo.has(atual)) {
      if (visitados.has(atual)) { temCiclo = true; break; }
      visitados.add(atual);
      atual = grafo.get(atual) ?? null;
    }
  }
  return { raizes, pendurados, temCiclo };
}

describe('F03 — carregamento e regras', () => {
  it('carrega exatamente 28 predios, todos com hp = (timber+stone)*50', () => {
    expect(gameData.predios).toHaveLength(28);
    for (const p of gameData.predios) {
      expect(p.hp).toBe((p.timber + p.stone) * 50);
    }
  });

  it('todo desbloqueadoPor resolve, o grafo nao tem ciclo, e a raiz e unica (storehouse)', () => {
    const { raizes, pendurados, temCiclo } = verificarGrafoDeDesbloqueio(gameData.predios);
    expect(pendurados).toEqual([]);
    expect(temCiclo).toBe(false);
    expect(raizes).toEqual(['storehouse']);
  });

  it('toda conversao registrada e um tick inteiro >= 1', () => {
    expect(gameData.conversoes.length).toBeGreaterThan(0);
    for (const c of gameData.conversoes) {
      expect(Number.isInteger(c.ticks)).toBe(true);
      expect(c.ticks).toBeGreaterThanOrEqual(1);
    }
  });

  it('GameData nunca expoe escalas, em nenhum lugar', () => {
    expect(acharChave(gameData, 'escalas')).toEqual([]);
  });

  it('tempo.tickMs vem de tickHz (10 Hz = 100ms), nao esta hardcoded', () => {
    expect(gameData.tempo.tickHz).toBe(10);
    expect(gameData.tempo.tickMs).toBe(100);
  });

  it('gameData esta congelado em profundidade, nao so na raiz', () => {
    const [primeiroPredio] = gameData.predios;
    if (!primeiroPredio) throw new Error('fixture: gameData.predios vazio');

    expect(() => {
      (primeiroPredio as unknown as { timber: number }).timber = 999;
    }).toThrow(TypeError);

    expect(() => {
      (gameData.conversoes as unknown as ConversaoRegistrada[]).push({
        caminho: 'x', grupo: null, valorBase: 0, unidade: '', ticks: 1,
      });
    }).toThrow(TypeError);

    // objeto aninhado (nao a raiz, nem um item de array) — prova que o
    // congelamento desce mais de um nivel.
    expect(() => {
      (gameData.movimento.ticksPorTile.aPe as unknown as Record<string, number>).estrada = 999;
    }).toThrow(TypeError);
  });
});

describe('F03 — escala de tempo', () => {
  const comEconomia = (valor: number): GameData => loadGameData({
    ...rawGameData,
    time: {
      ...rawGameData.time,
      escalas: { ...rawGameData.time.escalas, economia: valor },
    },
  });
  const base = comEconomia(2.0);
  const rapido = comEconomia(3.0);

  const porGrupo = (dados: GameData, grupo: string | null): ConversaoRegistrada[] => (
    dados.conversoes.filter((c) => c.grupo === grupo)
  );

  it('trocar economia de 2.0 para 3.0 muda os ticks do grupo economia na proporcao 2/3', () => {
    const economiaBase = porGrupo(base, 'economia');
    const economiaRapido = new Map(porGrupo(rapido, 'economia').map((c) => [c.caminho, c]));
    expect(economiaBase.length).toBeGreaterThan(0);

    for (const c of economiaBase) {
      const r = economiaRapido.get(c.caminho);
      expect(r).toBeDefined();
      const esperado = c.ticks * (2 / 3);
      expect(Math.abs(r!.ticks - esperado)).toBeLessThanOrEqual(1);
    }
  });

  it('escala maior significa periodo menor (direcao certa, nao so proporcao)', () => {
    const economiaBase = porGrupo(base, 'economia');
    const economiaRapido = new Map(porGrupo(rapido, 'economia').map((c) => [c.caminho, c]));
    for (const c of economiaBase) {
      expect(economiaRapido.get(c.caminho)!.ticks).toBeLessThanOrEqual(c.ticks);
    }
    expect(economiaBase.some((c) => economiaRapido.get(c.caminho)!.ticks < c.ticks)).toBe(true);
  });

  it.each(['movimento', 'construcao', 'combate'])('grupo %s fica intacto quando so economia muda', (grupo) => {
    const doBase = porGrupo(base, grupo);
    const doRapido = porGrupo(rapido, grupo);
    expect(doBase.length).toBeGreaterThan(0); // sem isso o toEqual seria vacuo
    expect(doRapido).toEqual(doBase);
  });
});

describe('F11b — buildings.construcao.laborersMaximosPorObra', () => {
  it('o dado real e um inteiro >= 1', () => {
    expect(Number.isInteger(gameData.construcao.laborersMaximosPorObra)).toBe(true);
    expect(gameData.construcao.laborersMaximosPorObra).toBeGreaterThanOrEqual(1);
  });

  it('validate:data reprova nao-inteiro e reprova < 1', () => {
    const dados = carregarDadosReais();
    const naoInteiro = clonar(dados);
    naoInteiro.buildings.construcao.laborersMaximosPorObra = 2.5;
    expect(validarTudo(naoInteiro).some((e) => e.startsWith('predios/laborers-maximos-por-obra'))).toBe(true);

    const zero = clonar(dados);
    zero.buildings.construcao.laborersMaximosPorObra = 0;
    expect(validarTudo(zero).some((e) => e.startsWith('predios/laborers-maximos-por-obra'))).toBe(true);
  });
});

describe('F13a — economy.schoolhouse: a politica de treino que a sim implementa', () => {
  it('validate:data reprova reembolsoSeNaoIniciado=false, slots < 1 e custo nao-inteiro', () => {
    const dados = carregarDadosReais();

    const semReembolso = clonar(dados);
    semReembolso.economy.schoolhouse.reembolsoSeNaoIniciado = false;
    expect(validarTudo(semReembolso).some((e) => e.startsWith('economia/escola:'))).toBe(true);

    const semSlots = clonar(dados);
    semSlots.economy.schoolhouse.slotsDeFila = 0;
    expect(validarTudo(semSlots).some((e) => e.startsWith('economia/escola:'))).toBe(true);

    const custoQuebrado = clonar(dados);
    custoQuebrado.economy.schoolhouse.custoOuroPorUnidade = 1.5;
    expect(validarTudo(custoQuebrado).some((e) => e.startsWith('economia/escola:'))).toBe(true);
  });
});

afterAll(() => {
  const economiaPorGrupo = (dados: GameData, grupo: string): number => (
    dados.conversoes.filter((c) => c.grupo === grupo).length
  );
  const { raizes, pendurados, temCiclo } = verificarGrafoDeDesbloqueio(gameData.predios);
  const cliContraCopiaQuebrada = rodarCliContraCopiaQuebrada();
  const fixturesResultado = fixtures.map(({ nome, regraEsperada, quebrar }) => {
    const quebrado = clonar(carregarDadosReais());
    quebrar(quebrado);
    const erros = validarTudo(quebrado);
    return { nome, regraEsperada, disparou: erros.some((e) => e.startsWith(`${regraEsperada}:`)) };
  });

  gravarEvidencia('F03', {
    feature: 'F03-dados-validados',
    predios: { contagem: gameData.predios.length, raizes, pendurados, temCiclo },
    conversoes: {
      total: gameData.conversoes.length,
      todasInteirasEPositivas: gameData.conversoes.every((c) => Number.isInteger(c.ticks) && c.ticks >= 1),
      porGrupo: {
        economia: economiaPorGrupo(gameData, 'economia'),
        movimento: economiaPorGrupo(gameData, 'movimento'),
        construcao: economiaPorGrupo(gameData, 'construcao'),
        combate: economiaPorGrupo(gameData, 'combate'),
        semEscala: gameData.conversoes.filter((c) => c.grupo === null).length,
      },
    },
    tempo: { tickHz: gameData.tempo.tickHz, tickMs: gameData.tempo.tickMs, gameDataExpoeEscalas: acharChave(gameData, 'escalas') },
    fixturesQuebrados: fixturesResultado,
    cliContraCopiaQuebrada: { codigo: cliContraCopiaQuebrada.codigo, stderrContemRegra: /predios\/hp/.test(cliContraCopiaQuebrada.stderr) },
    validateDataNoDadoReal: validarTudo(clonar(carregarDadosReais())),
  });
});
