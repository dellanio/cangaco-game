/**
 * F21b — A MINA COLHE O VEIO DO TILE, E O VEIO ACABA.
 *
 * Garimpo, jazida e mina de ferro eram as ultimas fontes que produziam do NADA:
 * ouro, ferro e carvao apareciam na gaveta sem sair de lugar nenhum. Aqui os
 * tres viram recurso de tile, como a rocha da F-T2a e o cardume da F-T4a, e o
 * que muda e SO dado: `resources.json` ganha os tres tipos, `production.json` da
 * `colheita` as tres receitas e o gerador semeia os veios na serra. Nenhuma
 * linha de `sim/`, de `render/` ou de `ui/` muda — a caminhada, a reserva do
 * quadro, o esgotamento e o alerta ja sao regra de CLASSE desde a F-T3/F-T4a, e
 * o que este arquivo afirma e que a classe de fato pega os tres tipos novos.
 *
 * O que se afirma, na ordem:
 *  (1) os tres tipos existem com regime `nunca` e sem reposicao — veio nao
 *      rebrota;
 *  (2) os tres tem tile no mapa publicado E tile que uma mina LEGAL alcanca: o
 *      dado nao e decorativo (minerio no miolo da serra seria mapa bonito e
 *      morto, e `sim/aproximacao.ts` diz isso por escrito);
 *  (3) o que a mina entrega sai do veio: o acumulado entregue bate, ciclo a
 *      ciclo, com a QUEDA do total no mundo medida contra o tick 0;
 *  (4) veio zerado SAI do estado (regime `nunca`) e a mina para sem nada
 *      reclamado;
 *  (5) e o predio DIZ o motivo: `veio-esgotado`, nunca `sem-campo` — a mina nao
 *      tem reposicao, e o rotulo de espera de campo seria mentira;
 *  (6) `canPlace` recusa a mina em cima do veio, em TODO tile dos tres tipos
 *      (BUG-F: construcao sobre recurso e recusada, e a serra ainda e terreno
 *      intransponivel antes disso);
 *  (7) guarda estrutural: todo tipo de recurso tem cor e nome no tema. Tipo novo
 *      sem entrada derruba o carregamento do render, e o guarda prova que ACUSA
 *      com um tema fabricado sem a chave, nao so que fica quieto com o real.
 */
import { describe, expect, it } from 'vitest';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { step } from '../src/sim/tick';
import { chaveDeTile, tileDeChave } from '../src/sim/estradas';
import { caixaDeTipo } from '../src/sim/footprint';
import { canPlace } from '../src/sim/placement';
import { receitaDoTipo, unidadesPorCiclo } from '../src/sim/producao';
import {
  recursoNoTile, regimeDoTipo, tilesDeColheita, tilesDeColheitaNaCaixa,
} from '../src/sim/recursos';
import { tileAlcancavelParaColheita } from '../src/sim/aproximacao';
import { registrarTipoConstruido } from '../src/sim/desbloqueio';
import { alertasDoEstado, painelDoPredio } from '../src/sim/selectors';
import { criarRecursosDeRender } from '../src/render/mapa';
import { corDoRecurso, nomeDoRecurso } from '../src/render/alcance-de-colheita';
import temaSertao from '../data/theme-sertao.json';
import {
  cenarioDaCadeiaDoOuro, comEspacoNaSaida, comRendimentoPorTile, saidaDe,
} from './helpers/producao-cenario';
import { violacoesDaFsmDoEspecialista } from './helpers/especialista-invariantes';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

/** Os tres tipos que a F21b criou. */
const MINERIOS = ['coal', 'iron_ore', 'gold_ore'] as const;

/** O tipo de predio cuja receita colhe este recurso. Reprova se nao for um so:
 *  duas minas para o mesmo veio seria uma escolha que ninguem fez. */
function minaDe(recurso: string, dados: GameData = gameData): string {
  const tipos = Object.entries(dados.producao.receitas)
    .filter(([, receita]) => receita?.colheita?.recurso === recurso)
    .map(([tipo]) => tipo);
  if (tipos.length !== 1 || tipos[0] === undefined) {
    throw new Error(`fixture: '${recurso}' precisa de UMA receita que o colhe (achou ${tipos.length})`);
  }
  return tipos[0];
}

function colheitaDaMina(recurso: string, dados: GameData = gameData) {
  const colheita = receitaDoTipo(minaDe(recurso, dados), dados)?.colheita ?? null;
  if (colheita === null) throw new Error(`fixture: a mina de '${recurso}' perdeu a colheita`);
  return colheita;
}

/** Quanto deste recurso ainda ha NO CHAO, no mundo inteiro. */
function noChao(estado: GameState, recurso: string): number {
  let total = 0;
  for (const r of Object.values(estado.recursos)) if (r.tipo === recurso) total += r.quantidade;
  return total;
}

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao esta completo`);
  return p;
}

/** Um estado com TUDO desbloqueado: a pergunta de (2) e (6) e de geografia, e
 *  `canPlace` recusa por `bloqueado` antes de olhar terreno. Sem isto a
 *  varredura mediria a arvore de desbloqueio, nao o mapa. */
function comTudoLiberado(dados: GameData = gameData): GameState {
  let s = createInitialState(1, dados);
  for (const predio of dados.predios) s = registrarTipoConstruido(s, predio.id);
  return s;
}

describe('F21b — (1) os tres minerios sao recurso de tile que nao rebrota', () => {
  it('existem em resources.json com regime `nunca` e sem reposicao', () => {
    for (const recurso of MINERIOS) {
      const tipo = gameData.recursos.tipos[recurso];
      expect(tipo, recurso).toBeDefined();
      expect(regimeDoTipo(recurso), recurso).toBe('nunca');
      // sem reposicao: o carregamento normaliza a ausencia para `null`
      expect(tipo?.reposicao ?? null, recurso).toBeNull();
      expect(tipo?.rendimentoPorTile ?? 0, recurso).toBeGreaterThan(0);
    }
  });

  it('cada um e colhido por exatamente UMA receita, e ela e uma mina', () => {
    expect(MINERIOS.map((r) => minaDe(r))).toEqual(['coal_mine', 'iron_mine', 'gold_mine']);
    for (const recurso of MINERIOS) {
      expect(colheitaDaMina(recurso).recurso, recurso).toBe(recurso);
      expect(colheitaDaMina(recurso).alcance, recurso).toBeGreaterThan(0);
    }
  });
});

describe('F21b — (2) o veio esta no mapa E uma mina legal o alcanca', () => {
  const base = comTudoLiberado();

  /** Uma posicao onde a mina deste recurso PODE ser plantada e de onde ela
   *  alcanca um tile trabalhavel de verdade. Varre a vizinhanca de cada tile de
   *  veio, que e onde a mina caberia — o mapa inteiro daria a mesma resposta
   *  mais devagar. */
  function primeiraMinaLegal(
    recurso: string,
  ): { readonly gx: number; readonly gy: number; readonly tiles: number } | null {
    const tipo = minaDe(recurso);
    const colheita = colheitaDaMina(recurso);
    const raio = colheita.alcance;
    for (const [vx, vy] of gameData.mapa.recursos[recurso] ?? []) {
      for (let gy = vy - raio; gy <= vy + raio; gy += 1) {
        for (let gx = vx - raio; gx <= vx + raio; gx += 1) {
          if (!canPlace(base, tipo, gx, gy).ok) continue;
          const caixa = caixaDeTipo(tipo, gx, gy, gameData);
          if (caixa === null) continue;
          const alcancaveis = tilesDeColheitaNaCaixa(base, caixa, colheita, gameData)
            .filter((k) => tileAlcancavelParaColheita(base, k, gameData));
          if (alcancaveis.length > 0) return { gx, gy, tiles: alcancaveis.length };
        }
      }
    }
    return null;
  }

  const medida = Object.fromEntries(MINERIOS.map((recurso) => {
    const tiles = gameData.mapa.recursos[recurso] ?? [];
    const alcancaveis = tiles
      .map(([gx, gy]) => chaveDeTile({ gx, gy }))
      .filter((k) => tileAlcancavelParaColheita(base, k, gameData));
    return [recurso, {
      tilesNoMapa: tiles.length,
      tilesAlcancaveis: alcancaveis.length,
      unidadesNoChaoNoTick0: noChao(base, recurso),
      minaLegal: primeiraMinaLegal(recurso),
    }];
  }));

  it('os tres tem tile no mapa publicado', () => {
    for (const recurso of MINERIOS) {
      expect(medida[recurso]?.tilesNoMapa ?? 0, recurso).toBeGreaterThan(0);
      expect(medida[recurso]?.unidadesNoChaoNoTick0 ?? 0, recurso).toBeGreaterThan(0);
    }
  });

  it('e cada um tem veio que uma mina LEGAL alcanca — dado com leitor, nao enfeite', () => {
    for (const recurso of MINERIOS) {
      expect(medida[recurso]?.tilesAlcancaveis ?? 0, recurso).toBeGreaterThan(0);
      expect(medida[recurso]?.minaLegal ?? null, recurso).not.toBeNull();
    }
    gravarEvidencia('F21b-veios-no-mapa', {
      pergunta: 'o minerio semeado e mineravel, ou e mapa bonito e morto?',
      regra: 'tile so e colhivel se `tileAlcancavelParaColheita` diz que alguem encosta nele',
      porTipo: medida,
    });
  });
});

describe('F21b — (3) o que a mina entrega sai do veio', () => {
  const recurso = 'coal';
  const receita = receitaDoTipo('coal_mine', gameData);
  if (receita === null) throw new Error('fixture: coal_mine perdeu a receita');
  const porCiclo = receita.sai[recurso] ?? 0;

  const corrida = (() => {
    let s = comEspacoNaSaida(cenarioDaCadeiaDoOuro(), 'co1');
    const noChaoNoTick0 = noChao(s, recurso);
    let entregue = 0;
    let ciclos = 0;
    for (let tick = 1; tick <= 1200; tick += 1) {
      s = step(s, [], gameData);
      const gaveta = saidaDe(s, 'co1')[recurso] ?? 0;
      if (gaveta > 0) { entregue += gaveta; ciclos += 1; }
      // a gaveta cheia pararia o ciclo; o que se mede aqui e a ENTREGA
      s = comEspacoNaSaida(s, 'co1');
    }
    return { fim: s, noChaoNoTick0, entregue, ciclos };
  })();

  it('a mina entrega de verdade, e cada entrega e um ciclo da receita', () => {
    expect(corrida.ciclos).toBeGreaterThan(0);
    expect(corrida.entregue).toBeCloseTo(corrida.ciclos * porCiclo, 6);
  });

  it('e o mundo fica com MENOS carvao, exatamente o que os ciclos tiraram', () => {
    const queda = corrida.noChaoNoTick0 - noChao(corrida.fim, recurso);
    expect(queda).toBeCloseTo(corrida.ciclos * unidadesPorCiclo(receita), 6);
    expect(queda).toBeGreaterThan(0);
    gravarEvidencia('F21b-mina-esgota', {
      pergunta: 'o que a mina entrega sai do chao, ou ela ainda fabrica do nada?',
      recurso,
      ticks: 1200,
      ciclos: corrida.ciclos,
      entregueNaGaveta: corrida.entregue,
      saiPorCiclo: porCiclo,
      consumoPorCiclo: unidadesPorCiclo(receita),
      noChaoNoTick0: corrida.noChaoNoTick0,
      noChaoNoFim: noChao(corrida.fim, recurso),
      quedaMedidaContraOTick0: queda,
    });
  });
});

describe('F21b — (4) e (5) o veio acaba, a mina para e diz o motivo', () => {
  const receita = receitaDoTipo('coal_mine', gameData);
  if (receita === null) throw new Error('fixture: coal_mine perdeu a receita');
  // um tile que vale UM ciclo: o mesmo mapa, com outro numero por tile, e o que
  // deixa o esgotamento caber num teste (o caminho continua sendo o dado).
  const dados = comRendimentoPorTile(gameData, 'coal', unidadesPorCiclo(receita));
  const colheita = colheitaDaMina('coal', dados);

  const corrida = (() => {
    let s = comEspacoNaSaida(cenarioDaCadeiaDoOuro(dados), 'co1');
    const aoAlcanceNoTick0 = tilesDeColheita(s, predioDe(s, 'co1'), colheita, dados);
    for (let tick = 1; tick <= 3000; tick += 1) {
      s = step(s, [], dados);
      s = comEspacoNaSaida(s, 'co1');
      if (tilesDeColheita(s, predioDe(s, 'co1'), colheita, dados).length === 0) {
        // mais um tanto DEPOIS de acabar: e ai que a espera indefinida apareceria
        for (let i = 0; i < 200; i += 1) s = step(s, [], dados);
        return { fim: s, aoAlcanceNoTick0, tickDoFim: tick };
      }
    }
    throw new Error('o veio de `co1` nao acabou em 3000 ticks');
  })();

  it('(4) o tile zerado SAI do estado — regime `nunca`, como o cardume', () => {
    expect(corrida.aoAlcanceNoTick0.length).toBeGreaterThan(0);
    for (const k of corrida.aoAlcanceNoTick0) {
      const t = tileDeChave(k);
      expect(recursoNoTile(corrida.fim, t.gx, t.gy), k).toBeNull();
    }
    expect(tilesDeColheita(corrida.fim, predioDe(corrida.fim, 'co1'), colheita, dados)).toEqual([]);
  });

  it('(4) e ninguem fica esperando o que nao volta: nada reclamado, `fsmData` limpo', () => {
    // as tarefas DESTA mina: a mina de ouro do mesmo cenario segue colhendo, e e
    // ela que faz a diferenca entre "o quadro esvaziou" e "a vila parou".
    const colher = corrida.fim.jobs.tarefas.ordem.filter((id) => {
      const t = corrida.fim.jobs.tarefas.porId[id];
      return t?.tipo === 'colher' && t.destino === 'co1';
    });
    expect(colher).toEqual([]);
    const u = corrida.fim.unidades.porId['mineiro-carvao'];
    expect(u?.fsm).toBe('esperando_insumo');
    expect(u?.fsmData).toEqual({});
    expect(violacoesDaFsmDoEspecialista(corrida.fim, dados)).toEqual([]);
    expect(violacoesDeInvariantes(corrida.fim, dados)).toEqual([]);
  });

  it('(5) o predio diz `veio-esgotado`, e nunca `sem-campo`', () => {
    const daMina = alertasDoEstado(corrida.fim, dados).filter((a) => a.predio === 'co1');
    expect(daMina).toEqual([{ predio: 'co1', tipo: 'coal_mine', causa: 'veio-esgotado' }]);
    gravarEvidencia('F21b-veio-esgotado', {
      pergunta: 'a mina sem veio para e avisa, ou fica esperando o que nunca chega?',
      tilesAoAlcanceNoTick0: corrida.aoAlcanceNoTick0.length,
      tickEmQueOVeioAcabou: corrida.tickDoFim,
      rendimentoPorTileUsado: unidadesPorCiclo(receita),
      alertaDaMina: daMina,
      fsmDoMineiro: corrida.fim.unidades.porId['mineiro-carvao']?.fsm ?? null,
    });
  });

  it('o painel da mina conta o veio ao alcance, e continua contando quando ele seca', () => {
    // A perna do aceite que chega a tela. `painelDoPredio` e a MESMA funcao que
    // `ui/painel-predio.ts` le e a mesma contagem de `previaDeAlcance` (F-TA):
    // um numero so, em um lugar so — painel e previa nao podem discordar.
    const inicio = cenarioDaCadeiaDoOuro(dados);
    const naoColhido = corrida.aoAlcanceNoTick0
      .map((k) => tileDeChave(k))
      .reduce((total, t) => total + (recursoNoTile(inicio, t.gx, t.gy)?.quantidade ?? 0), 0);
    expect(painelDoPredio(inicio, 'co1', dados)?.colheita).toEqual({
      recurso: 'coal', tiles: corrida.aoAlcanceNoTick0.length, unidades: naoColhido,
    });
    // Veio seco mostra ZERO, e nao some: e o estado que o jogador precisa ver
    // para entender por que a mina parou (F-TA), e o alerta acima ja nomeia.
    expect(painelDoPredio(corrida.fim, 'co1', dados)?.colheita).toEqual({
      recurso: 'coal', tiles: 0, unidades: 0,
    });
  });
});

describe('F21b — (6) mina nenhuma se assenta em cima do veio', () => {
  const base = comTudoLiberado();

  it('canPlace recusa em TODO tile de veio dos tres tipos', () => {
    const motivos: Record<string, Record<string, number>> = {};
    for (const recurso of MINERIOS) {
      const tipo = minaDe(recurso);
      const conta: Record<string, number> = {};
      for (const [gx, gy] of gameData.mapa.recursos[recurso] ?? []) {
        const r = canPlace(base, tipo, gx, gy);
        expect(r.ok, `${tipo} em ${gx},${gy}`).toBe(false);
        const motivo = r.ok ? 'ok' : r.motivo;
        conta[motivo] = (conta[motivo] ?? 0) + 1;
      }
      motivos[recurso] = conta;
    }
    gravarEvidencia('F21b-recusa-sobre-o-veio', {
      pergunta: 'da para plantar a mina em cima do proprio veio?',
      resposta: 'nao: a recusa e observada em todos os tiles; o motivo abaixo e medida, nao regra',
      motivosObservados: motivos,
    });
  });
});

describe('F21b — (7) todo recurso tem cor e nome no tema', () => {
  interface TemaDeRecursos {
    readonly recursos?: Readonly<Record<string, string | undefined>>;
    readonly plantaFantasma?: { readonly recursos?: Readonly<Record<string, string | undefined>> };
  }

  /** Os tipos sem cor de marcador ou sem nome de jogador. E a mesma pergunta que
   *  `criarRecursosDeRender` e `nomeDoRecurso` fazem no carregamento — aqui ela
   *  vira lista em vez de excecao, para poder ser medida nos dois sentidos. */
  function semTema(tipos: readonly string[], tema: TemaDeRecursos): string[] {
    const cores = tema.recursos ?? {};
    const nomes = tema.plantaFantasma?.recursos ?? {};
    return tipos.filter((id) => typeof cores[id] !== 'string' || typeof nomes[id] !== 'string');
  }

  const tipos = Object.keys(gameData.recursos.tipos);

  it('o tema publicado cobre todos os tipos, os tres novos inclusive', () => {
    expect(tipos).toEqual(expect.arrayContaining([...MINERIOS]));
    expect(semTema(tipos, temaSertao as TemaDeRecursos)).toEqual([]);
    // e as funcoes de verdade concordam com o guarda
    expect(() => criarRecursosDeRender()).not.toThrow();
    for (const id of tipos) {
      expect(corDoRecurso(id), id).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(nomeDoRecurso(id).length, id).toBeGreaterThan(0);
    }
  });

  it('e o guarda ACUSA: tema sem a chave reprova, nao passa quieto', () => {
    const semCor = {
      recursos: Object.fromEntries(tipos.filter((id) => id !== 'coal').map((id) => [id, '#123456'])),
      plantaFantasma: { recursos: Object.fromEntries(tipos.map((id) => [id, 'x'])) },
    };
    expect(semTema(tipos, semCor)).toEqual(['coal']);
    const semNome = {
      recursos: Object.fromEntries(tipos.map((id) => [id, '#123456'])),
      plantaFantasma: {
        recursos: Object.fromEntries(tipos.filter((id) => id !== 'gold_ore').map((id) => [id, 'x'])),
      },
    };
    expect(semTema(tipos, semNome)).toEqual(['gold_ore']);
    expect(semTema(tipos, {})).toEqual(tipos);
    // e a funcao de producao tambem acusa, com a tabela de cor amputada
    const cortada = { tipos: tipos.filter((id) => id !== 'coal'), cores: ['#000000'], codigoEsgotado: 1, ticksDeCrescer: {} };
    expect(() => corDoRecurso('coal', cortada)).toThrow();
  });
});

/**
 * (8) O MINEIRO NAO ANDA ATE O VEIO. Ate 2026-09-26 esta secao afirmava o
 * contrario (pedido do operador de 2026-09-25: "os tres mineiros herdam
 * caminhada"). O operador reverteu em 2026-09-26: a mina declara
 * `colheita.aDistancia: true` e o mineiro fica DENTRO, como no jogo original —
 * mas a mina CONTINUA com `colheita`, porque e ela que da o esgotamento, o alerta
 * e a previa de alcance. O que se afirma e as duas metades juntas: ninguem sai, e
 * o veio perde exatamente o que o ciclo entregou. E (e) prova que quem decide e o
 * DADO: a mesma fixture com a bandeira desligada volta a andar.
 */
describe('F21b — (8) o mineiro colhe o veio sem sair do predio (`aDistancia`)', () => {
  interface PassoDaMina {
    readonly tick: number; readonly fsm: string; readonly gx: number; readonly gy: number;
    readonly veio: string | null;
  }

  /** Roda ate a gaveta `saida` subir, um registro por tick. */
  function trilhaDaMina(
    inicial: GameState, predioId: string, unidadeId: string, mercadoria: string,
    dados: GameData = gameData, limite = 900,
  ): { trilha: PassoDaMina[]; fim: GameState } {
    const trilha: PassoDaMina[] = [];
    let estado = inicial;
    const saida0 = saidaDe(estado, predioId)[mercadoria] ?? 0;
    for (let tick = 1; tick <= limite; tick += 1) {
      estado = step(estado, [], dados);
      const u = estado.unidades.porId[unidadeId];
      if (u === undefined) throw new Error(`fixture: '${unidadeId}' sumiu no tick ${tick}`);
      // a posse mora no QUADRO (`reclamadaPor`), nao no `fsmData`: dentro do predio
      // o mineiro segura a tarefa sem carrega-la na FSM
      const tarefa = Object.values(estado.jobs.tarefas.porId)
        .find((t) => t.tipo === 'colher' && t.estado === 'reclamada' && t.reclamadaPor === unidadeId);
      const veio = tarefa !== undefined && tarefa.tipo === 'colher' ? tarefa.origemTile : null;
      trilha.push({
        tick, fsm: u.fsm, gx: u.gx, gy: u.gy, veio: veio === null ? null : chaveDeTile(veio),
      });
      expect(violacoesDaFsmDoEspecialista(estado, dados), `tick ${tick}`).toEqual([]);
      expect(violacoesDeInvariantes(estado, dados), `tick ${tick}`).toEqual([]);
      if ((saidaDe(estado, predioId)[mercadoria] ?? 0) > saida0) return { trilha, fim: estado };
    }
    throw new Error(`o ciclo de '${predioId}' nao fechou em ${limite} ticks`);
  }

  /** Distancia de Chebyshev do tile ao FOOTPRINT do predio — zero se esta dentro. */
  function doFootprint(estado: GameState, predioId: string, t: { gx: number; gy: number }): number {
    const p = predioDe(estado, predioId);
    const caixa = caixaDeTipo(p.tipo, p.gx, p.gy, gameData);
    if (caixa === null) throw new Error(`fixture: '${p.tipo}' sem tamanho`);
    const dx = t.gx < caixa.x0 ? caixa.x0 - t.gx : t.gx >= caixa.x1 ? t.gx - (caixa.x1 - 1) : 0;
    const dy = t.gy < caixa.y0 ? caixa.y0 - t.gy : t.gy >= caixa.y1 ? t.gy - (caixa.y1 - 1) : 0;
    return Math.max(dx, dy);
  }

  /** O mesmo dado, com a bandeira da mina de ouro desligada. */
  function semADistancia(dados: GameData): GameData {
    const receita = dados.producao.receitas['gold_mine'];
    if (receita === undefined || receita.colheita === null) throw new Error('fixture: gold_mine sem colheita');
    return {
      ...dados,
      producao: {
        ...dados.producao,
        receitas: {
          ...dados.producao.receitas,
          gold_mine: { ...receita, colheita: { ...receita.colheita, aDistancia: false } },
        },
      },
    };
  }

  // o mineiro do OURO: o veio dele NAO encosta na mina (afirmado em (d)), entao a
  // regra antiga o faria andar — e o caso que distingue as duas regras.
  const inicial = comEspacoNaSaida(cenarioDaCadeiaDoOuro(gameData), 'go1');
  const { trilha, fim } = trilhaDaMina(inicial, 'go1', 'mineiro-ouro', 'gold_ore');
  const partida = inicial.unidades.porId['mineiro-ouro'];
  const comVeio = trilha.filter((p) => p.veio !== null);

  it('a bandeira esta no dado das tres minas', () => {
    for (const minerio of MINERIOS) {
      expect(colheitaDaMina(minerio).aDistancia, minerio).toBe(true);
    }
  });

  it('(a) o ciclo inteiro e `trabalhando`, sem sair do lugar', () => {
    if (partida === undefined) throw new Error('fixture: mineiro-ouro nao existe');
    expect([...new Set(trilha.map((p) => p.fsm))]).toEqual(['trabalhando']);
    for (const p of trilha) {
      expect({ gx: p.gx, gy: p.gy }, `tick ${p.tick}`).toEqual({ gx: partida.gx, gy: partida.gy });
    }
  });

  it('(b) segura UM tile de veio o ciclo todo, e o deposito o larga', () => {
    expect(comVeio.length).toBeGreaterThan(0);
    expect(new Set(comVeio.map((p) => p.veio)).size).toBe(1);
    // todo tick menos o do deposito segura a tarefa; o do deposito ja a removeu
    expect(comVeio.length).toBe(trilha.length - 1);
    expect(trilha[trilha.length - 1]?.veio).toBeNull();
  });

  it('(c) o veio perde exatamente o que o ciclo entregou', () => {
    const veio = tileDeChave(comVeio[0]?.veio ?? '0,0');
    const receita = receitaDoTipo('gold_mine', gameData);
    if (receita === null) throw new Error('fixture: gold_mine sem receita');
    const antes = recursoNoTile(inicial, veio.gx, veio.gy)?.quantidade ?? 0;
    const depois = recursoNoTile(fim, veio.gx, veio.gy)?.quantidade ?? 0;
    expect(antes - depois).toBe(unidadesPorCiclo(receita));
    expect(noChao(inicial, 'gold_ore') - noChao(fim, 'gold_ore')).toBe(unidadesPorCiclo(receita));
  });

  it('(d) premissa da fixture: o veio NAO encosta na mina', () => {
    // sem isto, (a) passaria tambem com a regra antiga, por nao haver o que andar
    expect(doFootprint(fim, 'go1', tileDeChave(comVeio[0]?.veio ?? '0,0'))).toBeGreaterThan(1);
  });

  it('(e) quem decide e o DADO: sem a bandeira, a mesma fixture volta a andar', () => {
    const dados = semADistancia(gameData);
    const outro = comEspacoNaSaida(cenarioDaCadeiaDoOuro(dados), 'go1');
    const { trilha: andando } = trilhaDaMina(outro, 'go1', 'mineiro-ouro', 'gold_ore', dados);
    const sequencia: string[] = [];
    for (const p of andando) if (p.fsm !== sequencia[sequencia.length - 1]) sequencia.push(p.fsm);
    expect(sequencia).toEqual(['indo_colher', 'colhendo', 'voltando', 'trabalhando']);
  });
});
