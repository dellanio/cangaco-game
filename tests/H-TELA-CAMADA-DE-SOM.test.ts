/**
 * H-TELA-CAMADA-DE-SOM — o render toca os eventos da sim (a metade headless).
 *
 * (a) a funcao pura "eventos do tick -> sons a tocar" por tabela: o mapeamento, o teto por quadro,
 *     o evento fora da vista que nao toca e o id sem arquivo que vira silencio;
 * (b) a sim nao alcanca, pelo grafo de import, nada de `src/render/`, `src/ui/`, biblioteca de
 *     audio nem `data/som.json`;
 * (d) o `validate:data` recusa evento que a sim nao emite e o som do manifesto que o `som.json`
 *     nao toca.
 * O (c) (a partida andando sem nenhum arquivo: zero erro de console e o contador > 0) e o roteiro
 * `tools/shots/H-TELA-CAMADA-DE-SOM.js`.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import ts from 'typescript';
import { gameData } from '../src/sim/data';
import { criarEscaramuca } from '../src/sim/cenario';
import { step } from '../src/sim/tick';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import { criarCamadaDeSom, idDoSom, sonsDoQuadro, sonsDoTick, urlsDosSons } from '../src/render/som';
import type { TabelaDeSom } from '../src/render/som';
import { EVENTOS_DA_SIM } from '../src/render/eventos-da-sim';
import { validarSom } from '../tools/data-rules.js';
import tabelaJson from '../data/som.json';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioDePedreira } from './helpers/producao-cenario';

const TABELA = tabelaJson as TabelaDeSom;
const SEMENTE = gameData.economia.estadoInicial.semente;
const evidencia: Record<string, unknown> = {};

function comEventos(s: GameState, events: GameEvent[]): GameState {
  return { ...s, events };
}

describe('H-TELA-CAMADA-DE-SOM — (a) o mapeamento', () => {
  it('cada evento da tabela vira o id dela; o campo escolhe o id; valor sem id e evento sem linha, nada', () => {
    const casos: [GameEvent, string | null][] = [
      [{ type: 'building-completed', predio: 'p1', tipo: 'inn' }, 'building-completed'],
      [{ type: 'goods-produced', predio: 'p1', mercadoria: 'stone', quantidade: 1 }, 'goods-produced'],
      [{ type: 'unit-trained', predio: 'p1', unidade: 'u1', tipo: 'serf' }, 'unit-trained'],
      [{ type: 'unit-struck', atacante: 'u1', alvo: 'u2', acertou: true, hp: 3 }, 'strike-hit'],
      [{ type: 'unit-struck', atacante: 'u1', alvo: 'u2', acertou: false, hp: 3 }, 'strike-miss'],
      [{ type: 'unit-killed', unidade: 'u2', tipo: 'militia', lado: 1, por: 'u1' }, 'unit-killed'],
      [{ type: 'projectile-fired', projetil: 'virote', de: 'u1', alvo: { gx: 1, gy: 1 }, voo: 3 }, 'shot-gun'],
      [{ type: 'projectile-fired', projetil: 'flecha', de: 'u1', alvo: { gx: 1, gy: 1 }, voo: 3 }, 'shot-sling'],
      [{ type: 'projectile-fired', projetil: 'funda', de: 'u1', alvo: { gx: 1, gy: 1 }, voo: 3 }, 'shot-sling'],
      [{ type: 'projectile-fired', projetil: 'pedraDaTorre', de: 'p1', alvo: { gx: 1, gy: 1 }, voo: 3 }, null],
      [{ type: 'stone-thrown', predio: 'p1', alvo: { gx: 1, gy: 1 }, vitima: 'u2' }, 'stone-thrown'],
      [{ type: 'building-attacked', predio: 'p1', unidade: 'u1', dano: 2, hp: 10 }, 'building-hit'],
      [{ type: 'peace-ended' }, 'peace-ended'],
      [{ type: 'match-ended', fim: 'vitoria' }, 'victory'],
      [{ type: 'match-ended', fim: 'derrota' }, 'defeat'],
      [{ type: 'command-rejected', command: 'PlaceBlueprint', buildingId: 'inn', gx: 1, gy: 1, motivo: 'fora-do-mapa' }, 'command-rejected'],
      [{ type: 'tick-advanced', tick: 1 }, null],
      [{ type: 'task-completed', tarefa: 't1', destino: 'p1', mercadoria: 'stone' }, null],
    ];
    for (const [e, id] of casos) expect(idDoSom(e, TABELA), JSON.stringify(e)).toBe(id);
    evidencia['mapeamento'] = casos.map(([e, id]) => `${e.type} -> ${id ?? 'nada'}`);
  });

  it('o teto por quadro: o mesmo id pedido tres vezes toca uma; ordem do primeiro pedido', () => {
    const r = sonsDoQuadro(['strike-hit', 'unit-killed', 'strike-hit', 'strike-hit'], TABELA, new Set(['strike-hit', 'unit-killed']));
    expect(r.tocar).toEqual(['strike-hit', 'unit-killed']);
    expect(r.silencio).toEqual([]);
    const dois = { ...TABELA, sons: { ...TABELA.sons, 'strike-hit': { tetoPorQuadro: 2 } } };
    expect(sonsDoQuadro(['strike-hit', 'strike-hit', 'strike-hit'], dois, new Set(['strike-hit'])).tocar).toEqual(['strike-hit', 'strike-hit']);
    // id fora de `sons` (erro de dado) nao toca
    expect(sonsDoQuadro(['nao-existe'], TABELA, new Set(['nao-existe'])).tocar).toEqual([]);
  });

  it('o id sem arquivo e silencio: o tocador nunca e chamado, e o contador conta o pedido', () => {
    const chamados: string[] = [];
    const camada = criarCamadaDeSom(TABELA, new Set(['goods-produced']), { tocar: (id) => chamados.push(id) });
    const s = criarEscaramuca(SEMENTE);
    const meu = s.predios.ordem.find((id) => s.predios.porId[id]?.lado === LADO_DO_JOGADOR) as string;
    camada.aoPasso(comEventos(s, [
      { type: 'goods-produced', predio: meu, mercadoria: 'stone', quantidade: 1 },
      { type: 'building-completed', predio: meu, tipo: 'inn' },
    ]), 0);
    camada.pedirPlanta();
    camada.quadro();
    expect(chamados).toEqual(['goods-produced']);
    expect(camada.contadores()).toEqual({
      pedidos: 3, tocados: 1, emSilencio: 2, porId: { 'goods-produced': 1, 'building-completed': 1, 'blueprint-placed': 1 },
    });
  });

  it('a velocidade de jogo nao muda o som: a 3x o quadro junta 3 ticks e o teto vale para o quadro', () => {
    const s = criarEscaramuca(SEMENTE);
    const meu = s.predios.ordem.find((id) => s.predios.porId[id]?.lado === LADO_DO_JOGADOR) as string;
    const ev = comEventos(s, [{ type: 'goods-produced', predio: meu, mercadoria: 'stone', quantidade: 1 }]);
    const umX: string[] = [];
    const tresX: string[] = [];
    const a = criarCamadaDeSom(TABELA, new Set(['goods-produced']), { tocar: (id) => umX.push(id) });
    const b = criarCamadaDeSom(TABELA, new Set(['goods-produced']), { tocar: (id) => tresX.push(id) });
    for (let i = 0; i < 3; i += 1) { a.aoPasso(ev, 0); a.quadro(); } // 1x: um tick por quadro
    for (let i = 0; i < 3; i += 1) b.aoPasso(ev, 0); // 3x: tres ticks num quadro
    b.quadro();
    expect(umX).toEqual(['goods-produced', 'goods-produced', 'goods-produced']);
    expect(tresX).toEqual(['goods-produced']);
  });
});

describe('H-TELA-CAMADA-DE-SOM — (a) a vista e a recusa', () => {
  const s = criarEscaramuca(SEMENTE);
  const meuPredio = s.predios.ordem.find((id) => s.predios.porId[id]?.lado === LADO_DO_JOGADOR) as string;
  const predioDaIA = s.predios.ordem.find((id) => s.predios.porId[id]?.lado === LADO_DA_IA) as string;
  const unidadeDaIA = s.unidades.ordem.find((id) => s.unidades.porId[id]?.lado === LADO_DA_IA) as string;
  const minhaUnidade = s.unidades.ordem.find((id) => s.unidades.porId[id]?.lado === LADO_DO_JOGADOR) as string;

  it('a escaramuca tem nevoa e a vila da IA esta fora da vista (premissa)', () => {
    expect(s.descoberto?.[String(LADO_DO_JOGADOR)]).toBeDefined();
    expect(predioDaIA && unidadeDaIA && meuPredio && minhaUnidade).toBeTruthy();
  });

  it('o evento da vila do jogador toca; o da vila da IA, no escuro, nao', () => {
    const casos: [GameEvent, boolean][] = [
      [{ type: 'goods-produced', predio: meuPredio, mercadoria: 'stone', quantidade: 1 }, true],
      [{ type: 'goods-produced', predio: predioDaIA, mercadoria: 'stone', quantidade: 1 }, false],
      [{ type: 'building-attacked', predio: predioDaIA, unidade: minhaUnidade, dano: 2, hp: 9 }, false],
      [{ type: 'unit-struck', atacante: unidadeDaIA, alvo: minhaUnidade, acertou: true, hp: 3 }, true],
      [{ type: 'unit-struck', atacante: minhaUnidade, alvo: unidadeDaIA, acertou: true, hp: 3 }, false],
      [{ type: 'projectile-fired', projetil: 'virote', de: unidadeDaIA, alvo: { gx: 0, gy: 0 }, voo: 3 }, false],
      [{ type: 'peace-ended' }, true],
      [{ type: 'match-ended', fim: 'vitoria' }, true],
    ];
    for (const [e, toca] of casos) {
      expect(sonsDoTick(comEventos(s, [e]), null, TABELA, 0).length, JSON.stringify(e)).toBe(toca ? 1 : 0);
    }
    evidencia['vista'] = casos.map(([e, toca]) => `${e.type}${'predio' in e ? ` ${e.predio}` : ''} -> ${toca ? 'toca' : 'nao toca'}`);
  });

  it('a unidade que morreu neste tick ja nao esta no estado: o lugar vem do estado anterior', () => {
    const semIA: GameState = {
      ...s,
      unidades: { porId: Object.fromEntries(Object.entries(s.unidades.porId).filter(([id]) => id !== unidadeDaIA)), ordem: s.unidades.ordem.filter((id) => id !== unidadeDaIA) },
    };
    const morte: GameEvent = { type: 'unit-killed', unidade: unidadeDaIA, tipo: 'militia', lado: LADO_DA_IA, por: minhaUnidade };
    expect(sonsDoTick(comEventos(semIA, [morte]), s, TABELA, 0)).toEqual([]);
    const semMinha: GameState = {
      ...s,
      unidades: { porId: Object.fromEntries(Object.entries(s.unidades.porId).filter(([id]) => id !== minhaUnidade)), ordem: s.unidades.ordem.filter((id) => id !== minhaUnidade) },
    };
    const minhaMorte: GameEvent = { type: 'unit-killed', unidade: minhaUnidade, tipo: 'militia', lado: LADO_DO_JOGADOR, por: unidadeDaIA };
    expect(sonsDoTick(comEventos(semMinha, [minhaMorte]), s, TABELA, 0)).toEqual(['unit-killed']);
  });

  it('a recusa so toca no tick que consumiu comando do jogador', () => {
    const recusa: GameEvent = { type: 'command-rejected', command: 'PlaceBlueprint', buildingId: 'inn', gx: 1, gy: 1, motivo: 'fora-do-mapa' };
    expect(sonsDoTick(comEventos(s, [recusa]), null, TABELA, 0)).toEqual([]);
    expect(sonsDoTick(comEventos(s, [recusa]), null, TABELA, 1)).toEqual(['command-rejected']);
  });

  it('sem nevoa (o jogo livre), tudo esta na vista', () => {
    const { descoberto: _semNevoa, ...livre } = s;
    const e: GameEvent = { type: 'goods-produced', predio: predioDaIA, mercadoria: 'stone', quantidade: 1 };
    expect(sonsDoTick(comEventos(livre, [e]), null, TABELA, 0)).toEqual(['goods-produced']);
  });

  it('a pedreira produzindo (sem nevoa): o goods-produced toca, pelo step de verdade (medida)', () => {
    // A escaramuca parada nao emite som nenhum em 1 500 ticks (medido): ninguem produz sem o
    // jogador mandar. A pedreira do cenario de producao produz sozinha.
    let atual = cenarioDePedreira();
    const porEvento: Record<string, number> = {};
    const tocados: Record<string, number> = {};
    for (let i = 0; i < 600; i += 1) {
      const antes = atual;
      atual = step(atual, [], gameData);
      for (const e of atual.events) if (idDoSom(e, TABELA) !== null) porEvento[e.type] = (porEvento[e.type] ?? 0) + 1;
      for (const id of sonsDoTick(atual, antes, TABELA, 0)) tocados[id] = (tocados[id] ?? 0) + 1;
    }
    expect(tocados['goods-produced'] ?? 0, JSON.stringify(porEvento)).toBeGreaterThan(0);
    expect(tocados['goods-produced']).toBe(porEvento['goods-produced']);
    evidencia['pedreira600ticks'] = { eventosComSom: porEvento, tocadosDepoisDaVista: tocados };
  });
});

/** Os arquivos alcancados por import a partir de `raizes`, resolvendo caminho relativo (.ts, .json,
 *  index.ts). Import sem ponto (biblioteca) vai para `externos`. Pelo parser do TypeScript. */
function grafoDeImport(raizes: readonly string[]): { arquivos: Set<string>; externos: Set<string> } {
  const arquivos = new Set<string>();
  const externos = new Set<string>();
  const fila = raizes.map((r) => normalize(r));
  while (fila.length > 0) {
    const atual = fila.pop() as string;
    if (arquivos.has(atual)) continue;
    arquivos.add(atual);
    if (!atual.endsWith('.ts')) continue;
    const { importedFiles } = ts.preProcessFile(readFileSync(atual, 'utf8'), true, true);
    for (const { fileName } of importedFiles) {
      if (!fileName.startsWith('.')) {
        externos.add(fileName);
        continue;
      }
      const base = join(dirname(atual), fileName);
      const alvo = [base, `${base}.ts`, join(base, 'index.ts')].find((c) => existsSync(c) && statSync(c).isFile());
      if (alvo !== undefined) fila.push(normalize(alvo));
    }
  }
  return { arquivos, externos };
}

function arquivosTs(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    return statSync(c).isDirectory() ? arquivosTs(c) : c.endsWith('.ts') ? [c] : [];
  });
}

describe('H-TELA-CAMADA-DE-SOM — (b) a sim nao alcanca o som', () => {
  const proibido = (arquivo: string): boolean => {
    const r = relative('.', arquivo).replace(/\\/g, '/');
    return r.startsWith('src/render/') || r.startsWith('src/ui/') || r === 'data/som.json';
  };

  it('nada de src/sim/ alcanca src/render/, src/ui/ nem data/som.json, e nao ha biblioteca externa', () => {
    const { arquivos, externos } = grafoDeImport(arquivosTs('src/sim'));
    expect([...arquivos].filter(proibido)).toEqual([]);
    expect([...externos]).toEqual([]);
    evidencia['grafoDaSim'] = { arquivos: arquivos.size, externos: [...externos] };
  });

  it('o guarda acusa: do main.ts, o grafo alcanca o som e o data/som.json', () => {
    const { arquivos, externos } = grafoDeImport(['src/main.ts']);
    const achados = [...arquivos].filter(proibido).map((a) => relative('.', a).replace(/\\/g, '/'));
    expect(achados).toContain('data/som.json');
    expect(achados).toContain('src/render/som.ts');
    expect(externos.has('phaser')).toBe(true);
  });
});

describe('H-TELA-CAMADA-DE-SOM — (d) o validate:data', () => {
  const som = JSON.parse(readFileSync('data/som.json', 'utf8')) as Record<string, unknown>;
  const rodar = (s: unknown, manifesto: unknown = { assets: [] }): string[] => {
    const erros: string[] = [];
    validarSom(s, erros, { eventosDaSim: EVENTOS_DA_SIM, manifesto });
    return erros;
  };

  it('o data/som.json de verdade passa; a lista de eventos do CLI (sem passar a lista) e a mesma', () => {
    expect(rodar(som)).toEqual([]);
    const pelaLeituraDoCli: string[] = [];
    validarSom(som, pelaLeituraDoCli, { manifesto: { assets: [] } });
    expect(pelaLeituraDoCli).toEqual([]);
  });

  it('recusa evento que a sim nao emite', () => {
    const eventos = { ...(som['eventos'] as object), 'unit-danced': 'unit-killed' };
    expect(rodar({ ...som, eventos })).toEqual(["interface/som: evento 'unit-danced' nao e emitido pela sim"]);
  });

  it('recusa id tocado sem linha em sons, e teto que nao e inteiro >= 1', () => {
    const eventos = { ...(som['eventos'] as object), 'unit-starved': 'starve' };
    expect(rodar({ ...som, eventos })).toEqual(["interface/som: evento 'unit-starved' toca 'starve', que nao esta em sons"]);
    const sons = { ...(som['sons'] as object), 'unit-killed': { tetoPorQuadro: 0 } };
    expect(rodar({ ...som, sons })).toEqual(["interface/som: 'unit-killed': tetoPorQuadro precisa ser inteiro >= 1"]);
  });

  it('com o som no manifesto: o id que o som.json toca passa; o que ele nao toca e recusado', () => {
    expect(rodar(som, { assets: [], sons: { 'unit-killed': { arquivo: 'sons/unit-killed.ogg' } } })).toEqual([]);
    expect(rodar(som, { assets: [], sons: { 'goat-bleat': { arquivo: 'sons/goat-bleat.ogg' } } }))
      .toEqual(["interface/som: o manifesto tem o som 'goat-bleat', que data/som.json nao toca"]);
  });

  it('o arquivo do manifesto vira URL so quando o bundler o achou; id sem arquivo fica de fora', () => {
    const urls = urlsDosSons({ a: { arquivo: 'sons/a.ogg' }, b: { arquivo: 'sons/b.ogg' } }, { 'sons/a.ogg': '/assets/a-123.ogg' });
    expect(urls).toEqual({ a: '/assets/a-123.ogg' });
    gravarEvidencia('H-TELA-CAMADA-DE-SOM', evidencia);
  });
});
