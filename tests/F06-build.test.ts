import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { GameState, Predio } from '../src/sim/state';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { estaDesbloqueado, registrarTipoConstruido } from '../src/sim/desbloqueio';
import { canPlace } from '../src/sim/placement';
import { deepFreeze } from '../src/sim/freeze';
import { opcoesDoMenuBuild } from '../src/sim/selectors';
import { criarFerramenta } from '../src/input/ferramenta';
import { ligarTeclado } from '../src/input/teclado';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

// --- montagem de estados e de dados injetados (so teste; nada disto entra em sim/) ---

/** Nada construido: sem predio E sem historico de tipos ja construidos. */
function semPredios(estado: GameState): GameState {
  return { ...estado, predios: { porId: {}, ordem: [] }, tiposJaConstruidos: [] };
}

/** Completa um predio: ele entra no estado E o tipo entra no historico, que e o
 *  que o desbloqueio consulta (a F12 chama `registrarTipoConstruido` no `step()`
 *  quando uma obra chega a 'completo'). */
function comPredio(estado: GameState, tipo: string, gx: number, gy: number): GameState {
  const id = `teste-${estado.predios.ordem.length}-${tipo}`;
  const predio: Predio = {
    id, tipo, gx, gy, estado: 'completo', hp: 0,
    capacidade: { entrada: null, saida: null },
    estoque: { entrada: {}, saida: {} },
    ocupante: null, producao: null, pausado: false,
  };
  return registrarTipoConstruido({
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [id]: predio },
      ordem: [...estado.predios.ordem, id],
    },
  }, tipo);
}

/** Tira do estado todo predio do tipo (demolir, no que importa aqui). O
 *  historico `tiposJaConstruidos` NAO e tocado. */
function semOsPrediosDoTipo(estado: GameState, tipo: string): GameState {
  const ordem = estado.predios.ordem.filter((id) => estado.predios.porId[id]?.tipo !== tipo);
  const porId: Record<string, Predio> = {};
  for (const id of ordem) {
    const p = estado.predios.porId[id];
    if (p) porId[id] = p;
  }
  return { ...estado, predios: { porId, ordem } };
}

function dadosSemMenuInicial(): GameData {
  return {
    ...gameData,
    economia: {
      ...gameData.economia,
      estadoInicial: { ...gameData.economia.estadoInicial, menuBuildInicial: [] },
    },
  };
}

describe('F06 — desbloqueio derivado de menuBuildInicial e da arvore', () => {
  const inicial = createInitialState(1);

  it('o estado inicial libera, so pela arvore, exatamente os filhos dos predios do cenario', () => {
    // esperado calculado do JSON (desbloqueadoPor x predios do cenario), sem passar por estaDesbloqueado
    const presentes = new Set(gameData.economia.estadoInicial.predios.map((p) => p.id));
    const esperado = gameData.predios
      .filter((p) => p.desbloqueadoPor !== null && presentes.has(p.desbloqueadoPor))
      .map((p) => p.id);
    expect(esperado.length).toBeGreaterThan(0);
    const liberados = gameData.predios.filter((p) => estaDesbloqueado(inicial, p.id)).map((p) => p.id);
    expect(liberados).toEqual(esperado);
  });

  it('o menu inicial do GDD §3.2 (Inn, Quarry, Woodcutter\'s) esta liberado no cenario', () => {
    for (const id of ['inn', 'quarry', 'woodcutters']) {
      expect(estaDesbloqueado(inicial, id), id).toBe(true);
    }
  });

  it('para cada aresta desbloqueadoPor: sem o pai completo bloqueia, com o pai completo libera', () => {
    const dados = dadosSemMenuInicial();
    const arestas = gameData.predios.filter((p) => p.desbloqueadoPor !== null);
    expect(arestas.length).toBeGreaterThan(0);
    for (const filho of arestas) {
      const pai = filho.desbloqueadoPor as string;
      const vazio = semPredios(inicial);
      expect(estaDesbloqueado(vazio, filho.id, dados), `${filho.id} sem ${pai}`).toBe(false);
      expect(estaDesbloqueado(comPredio(vazio, pai, 0, 0), filho.id, dados), `${filho.id} com ${pai}`).toBe(true);
    }
  });

  it('um pai completo de OUTRO tipo nao libera o filho', () => {
    const dados = dadosSemMenuInicial();
    // quarry depende de schoolhouse; um storehouse completo nao basta
    const soArmazem = comPredio(semPredios(inicial), 'storehouse', 0, 0);
    expect(estaDesbloqueado(soArmazem, 'quarry', dados)).toBe(false);
  });

  it('desbloqueadoPor null fora do menu inicial continua bloqueado, mesmo com o predio no mapa', () => {
    const dados = dadosSemMenuInicial();
    const raiz = gameData.predios.filter((p) => p.desbloqueadoPor === null);
    expect(raiz.length).toBeGreaterThan(0);
    for (const p of raiz) {
      expect(estaDesbloqueado(comPredio(semPredios(inicial), p.id, 0, 0), p.id, dados)).toBe(false);
    }
  });

  it('id que nao existe no dado esta bloqueado', () => {
    expect(estaDesbloqueado(inicial, 'nao-existe')).toBe(false);
  });

  it('a lista vem do dado: uma raiz sem pai posta em menuBuildInicial fica liberada sem nenhum predio', () => {
    const raiz = gameData.predios.find((p) => p.desbloqueadoPor === null);
    if (!raiz) throw new Error('o dado nao tem raiz sem pai');
    const dados: GameData = {
      ...gameData,
      economia: {
        ...gameData.economia,
        estadoInicial: { ...gameData.economia.estadoInicial, menuBuildInicial: [raiz.id] },
      },
    };
    expect(estaDesbloqueado(semPredios(inicial), raiz.id, dados)).toBe(true);
    expect(estaDesbloqueado(semPredios(inicial), raiz.id)).toBe(false);
  });
});

// --- desbloqueio PERMANENTE: consulta o historico, nao a presenca atual ---

describe('F06 — desbloqueio permanente (tiposJaConstruidos)', () => {
  const inicial = createInitialState(1);

  it('o estado inicial nasce com os tipos dos predios ja completos, na ordem do dado', () => {
    const esperado = gameData.economia.estadoInicial.predios
      .filter((p) => p.estado === 'completo')
      .map((p) => p.id);
    expect(esperado.length).toBeGreaterThan(0);
    expect(inicial.tiposJaConstruidos).toEqual(esperado);
  });

  it("com um Woodcutter's completo e depois removido do estado, a Sawmill continua liberada", () => {
    const comLenhador = comPredio(inicial, 'woodcutters', 10, 10);
    expect(estaDesbloqueado(comLenhador, 'sawmill')).toBe(true);

    const demolido = semOsPrediosDoTipo(comLenhador, 'woodcutters');
    expect(demolido.predios.ordem.some((id) => demolido.predios.porId[id]?.tipo === 'woodcutters')).toBe(false);
    expect(estaDesbloqueado(demolido, 'sawmill')).toBe(true);
    expect(canPlace(demolido, 'sawmill', 0, 0)).toEqual({ ok: true });
    expect(opcoesDoMenuBuild(demolido).find((o) => o.id === 'sawmill')?.desbloqueado).toBe(true);
  });

  it('inclusive com uma Sawmill de pe: demolir o ultimo Woodcutter\'s nao a re-bloqueia', () => {
    const cadeia = comPredio(comPredio(inicial, 'woodcutters', 10, 10), 'sawmill', 20, 10);
    const demolido = semOsPrediosDoTipo(cadeia, 'woodcutters');
    expect(demolido.predios.ordem.some((id) => demolido.predios.porId[id]?.tipo === 'sawmill')).toBe(true);
    expect(estaDesbloqueado(demolido, 'sawmill')).toBe(true);
  });

  it('demolir o unico predio de um tipo (reposicionar) nao trava o que ele liberou nem o que ja estava liberado', () => {
    const semEscola = semOsPrediosDoTipo(inicial, 'schoolhouse');
    for (const id of ['quarry', 'woodcutters', 'schoolhouse']) {
      expect(estaDesbloqueado(semEscola, id), id).toBe(true);
    }
  });

  it('o que nunca foi construido segue bloqueado, mesmo depois de outras demolicoes', () => {
    const demolido = semOsPrediosDoTipo(comPredio(inicial, 'woodcutters', 10, 10), 'woodcutters');
    expect(estaDesbloqueado(demolido, 'farm')).toBe(false); // filho de sawmill, que nunca existiu
  });

  it('registrarTipoConstruido: acrescenta uma vez, mantem a ordem e nao muta o estado', () => {
    const congelado = deepFreeze(createInitialState(1));
    const a = registrarTipoConstruido(congelado, 'woodcutters');
    expect(a.tiposJaConstruidos).toEqual([...congelado.tiposJaConstruidos, 'woodcutters']);
    const b = registrarTipoConstruido(a, 'woodcutters');
    expect(b.tiposJaConstruidos).toEqual(a.tiposJaConstruidos); // idempotente
    expect(b).toBe(a); // nada mudou: mesma referencia
    expect(congelado.tiposJaConstruidos).toEqual(inicial.tiposJaConstruidos);
  });

  it('continua serializavel em JSON', () => {
    const estado = registrarTipoConstruido(inicial, 'woodcutters');
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });

  it('step() carrega o historico adiante: nao o perde a cada tick', () => {
    let estado = registrarTipoConstruido(inicial, 'woodcutters');
    for (let i = 0; i < 5; i++) estado = step(estado, []);
    expect(estado.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
    expect(estaDesbloqueado(estado, 'sawmill')).toBe(true);
  });
});

// --- canPlace: um caso do aceite por vez, afirmando o MOTIVO ---

function tamanhoDe(id: string): readonly [number, number] {
  const def = gameData.predios.find((p) => p.id === id);
  const [largura, altura] = def?.tamanho ?? [];
  if (largura === undefined || altura === undefined) throw new Error(`sem tamanho para '${id}'`);
  return [largura, altura];
}

function comTamanho(id: string, tamanho: readonly [number, number]): GameData {
  return {
    ...gameData,
    predios: gameData.predios.map((p) => (p.id === id ? { ...p, tamanho: [...tamanho] } : p)),
  };
}

describe('F06 — canPlace', () => {
  const inicial = createInitialState(1);
  const { largura: larguraDoMapa, altura: alturaDoMapa } = gameData.terreno.mapaPadrao;

  // o armazem do cenario inicial, lido do dado (nada digitado)
  const armazem = gameData.economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  if (!armazem) throw new Error('cenario inicial sem storehouse');
  const [, armazemA] = tamanhoDe('storehouse');
  const [pedreiraL, pedreiraA] = tamanhoDe('quarry'); // liberado no estado inicial

  it('posicao livre dentro do mapa, prédio liberado: ok', () => {
    expect(canPlace(inicial, 'quarry', 0, 0)).toEqual({ ok: true });
  });

  describe('sobreposicao', () => {
    it('em cima do armazem', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy)).toEqual({ ok: false, motivo: 'sobreposicao' });
    });

    it('por um unico tile', () => {
      const r = canPlace(inicial, 'quarry', armazem.gx - pedreiraL + 1, armazem.gy - pedreiraA + 1);
      expect(r).toEqual({ ok: false, motivo: 'sobreposicao' });
    });

    // Encostar PELOS LADOS continua valendo: o meio-aberto e o que separa encostar
    // de sobrepor. O encosto VERTICAL saiu daqui na F16a — nao virou sobreposicao,
    // virou `porta-sem-saida`, e esta no describe proprio mais abaixo.
    it('encostado (meio-aberto) pela esquerda: ok', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx - pedreiraL, armazem.gy)).toEqual({ ok: true });
    });

    it('um tile para dentro do encosto ja e sobreposicao (o limite e exato)', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx - pedreiraL + 1, armazem.gy))
        .toEqual({ ok: false, motivo: 'sobreposicao' });
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy + armazemA - 1))
        .toEqual({ ok: false, motivo: 'sobreposicao' });
    });

    it('o tamanho vem do dado: com o armazem 1x1 injetado, o mesmo ponto passa a ser livre', () => {
      const ponto = { gx: armazem.gx + 1, gy: armazem.gy + 1 };
      expect(canPlace(inicial, 'quarry', ponto.gx, ponto.gy)).toEqual({ ok: false, motivo: 'sobreposicao' });
      expect(canPlace(inicial, 'quarry', ponto.gx, ponto.gy, comTamanho('storehouse', [1, 1]))).toEqual({ ok: true });
    });
  });

  describe('fora do mapa', () => {
    it('canto superior esquerdo negativo', () => {
      expect(canPlace(inicial, 'quarry', -1, 0)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
      expect(canPlace(inicial, 'quarry', 0, -1)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });

    it('footprint que passa da borda direita ou de baixo', () => {
      expect(canPlace(inicial, 'quarry', larguraDoMapa - pedreiraL + 1, 0)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
      expect(canPlace(inicial, 'quarry', 0, alturaDoMapa - pedreiraA + 1)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });

    // Rente a borda DIREITA continua ok. Rente a borda de BAIXO nao: a porta cairia
    // fora do mapa, e o motivo passa a ser `porta-sem-saida` (F16a; o describe proprio
    // mais abaixo diz por que). Aqui fica so a fronteira do `fora-do-mapa`.
    it('rente a borda direita, com a linha da porta dentro do mapa: ok', () => {
      expect(canPlace(inicial, 'quarry', larguraDoMapa - pedreiraL, alturaDoMapa - pedreiraA - 1))
        .toEqual({ ok: true });
    });

    it('o tamanho vem do dado: a mesma posicao muda de resultado com outro footprint', () => {
      const gx = larguraDoMapa - 1;
      expect(canPlace(inicial, 'quarry', gx, 0)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
      expect(canPlace(inicial, 'quarry', gx, 0, comTamanho('quarry', [1, 1]))).toEqual({ ok: true });
    });

    it('as dimensoes do mapa vem do dado: mapa injetado menor recusa o que o padrao aceita', () => {
      const dados: GameData = {
        ...gameData,
        // A linha a mais na altura e a PORTA: num mapa com a altura exata do
        // footprint, nenhum predio cabe, porque a borda sul ficaria fora (F16a).
        terreno: { ...gameData.terreno, mapaPadrao: { largura: pedreiraL, altura: pedreiraA + 1 } },
      };
      expect(canPlace(inicial, 'quarry', 0, 0, dados)).toEqual({ ok: true });
      expect(canPlace(inicial, 'quarry', 1, 0, dados)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });
  });

  // A porta (GDD §5.1) e a borda sul: e por ela que entra todo material e sai toda
  // unidade. Ate a F16a o `canPlace` so olhava footprint contra footprint e aceitava
  // planta que tapava a porta alheia — com a escola, isso segura para sempre um treino
  // JA PAGO (medido em `F16a-porta.test.ts`, com a hipotese que a F13a tinha deixado
  // aberta). Uma regra, um motivo, um lugar: a borda sul precisa estar NO MAPA e LIVRE,
  // dos dois lados — nem tapar a porta de quem esta de pe, nem nascer sem a propria.
  describe('porta sem saida (achado da F16a que corrige a F06)', () => {
    it('tapar a porta de quem ja esta de pe (encostar por baixo)', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy + armazemA))
        .toEqual({ ok: false, motivo: 'porta-sem-saida' });
    });

    it('nascer com a propria porta coberta pelo vizinho (encostar por cima)', () => {
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy - pedreiraA))
        .toEqual({ ok: false, motivo: 'porta-sem-saida' });
    });

    it('nascer com a propria porta fora do mapa (rente a borda de baixo)', () => {
      expect(canPlace(inicial, 'quarry', 0, alturaDoMapa - pedreiraA))
        .toEqual({ ok: false, motivo: 'porta-sem-saida' });
    });

    // Sem isto o describe provaria so que a funcao recusa, nao que recusa no lugar
    // certo: um tile de folga em qualquer das tres formas e a mesma planta passa.
    it('um tile de folga e a mesma planta passa: o limite e exato', () => {
      expect(canPlace(inicial, 'quarry', 0, alturaDoMapa - pedreiraA - 1)).toEqual({ ok: true });
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy + armazemA + 1)).toEqual({ ok: true });
      expect(canPlace(inicial, 'quarry', armazem.gx, armazem.gy - pedreiraA - 1)).toEqual({ ok: true });
    });

    it('estrada na porta NAO e impedimento — e o caso normal', () => {
      const porta = [0, 1, 2].map((i) => `${10 + i},12`);
      const comRua: GameState = {
        ...inicial,
        estradas: { ...inicial.estradas, ...Object.fromEntries(porta.map((k) => [k, true as const])) },
      };
      expect(canPlace(comRua, 'quarry', 10, 10)).toEqual({ ok: true });
    });
  });

  describe('predio nao desbloqueado', () => {
    it('sawmill no estado inicial: bloqueado', () => {
      expect(canPlace(inicial, 'sawmill', 0, 0)).toEqual({ ok: false, motivo: 'bloqueado' });
    });

    it('com o pai (woodcutters) completo, o mesmo ponto vira ok', () => {
      const comPai = comPredio(inicial, 'woodcutters', 10, 10);
      expect(canPlace(comPai, 'sawmill', 0, 0)).toEqual({ ok: true });
    });
  });

  describe('outras recusas e a ordem entre elas', () => {
    it('id que nao existe no dado: predio-desconhecido', () => {
      expect(canPlace(inicial, 'nao-existe', 0, 0)).toEqual({ ok: false, motivo: 'predio-desconhecido' });
    });

    it('bloqueado vem antes de fora-do-mapa', () => {
      expect(canPlace(inicial, 'sawmill', -5, -5)).toEqual({ ok: false, motivo: 'bloqueado' });
    });

    it('fora-do-mapa vem antes de sobreposicao', () => {
      const comFantasma = comPredio(inicial, 'quarry', -1, -1);
      expect(canPlace(comFantasma, 'quarry', -1, -1)).toEqual({ ok: false, motivo: 'fora-do-mapa' });
    });
  });

  describe('pureza', () => {
    it('nao escreve no estado: roda sobre um GameState congelado e o resultado e estavel', () => {
      const congelado = deepFreeze(createInitialState(1));
      const antes = JSON.stringify(congelado);
      const a = canPlace(congelado, 'quarry', armazem.gx, armazem.gy);
      const b = canPlace(congelado, 'quarry', armazem.gx, armazem.gy);
      expect(a).toEqual(b);
      expect(JSON.stringify(congelado)).toBe(antes);
    });
  });
});

// --- ferramenta ativa e teclado (estado de interface, fora do GameState) ---

describe('F06 — ferramenta ativa', () => {
  it('nasce sem predio ativo', () => {
    expect(criarFerramenta().predioAtivo).toBeNull();
  });

  it('selecionar e cancelar mudam o predio ativo e avisam quem ouve', () => {
    const ferramenta = criarFerramenta();
    const avisos: Array<string | null> = [];
    ferramenta.aoMudar((p) => avisos.push(p));
    ferramenta.selecionar('quarry');
    expect(ferramenta.predioAtivo).toBe('quarry');
    ferramenta.cancelar();
    expect(ferramenta.predioAtivo).toBeNull();
    expect(avisos).toEqual(['quarry', null]);
  });

  it('nao avisa quando nada mudou', () => {
    const ferramenta = criarFerramenta();
    const avisos: Array<string | null> = [];
    ferramenta.aoMudar((p) => avisos.push(p));
    ferramenta.cancelar();
    ferramenta.selecionar('quarry');
    ferramenta.selecionar('quarry');
    expect(avisos).toEqual(['quarry']);
  });

  it('quem se desinscreve para de ouvir', () => {
    const ferramenta = criarFerramenta();
    const avisos: Array<string | null> = [];
    const desinscrever = ferramenta.aoMudar((p) => avisos.push(p));
    desinscrever();
    ferramenta.selecionar('quarry');
    expect(avisos).toEqual([]);
  });

  it('nao toca o GameState: rodar sobre um estado congelado nao lanca e nao o altera', () => {
    const congelado = deepFreeze(createInitialState(1));
    const antes = JSON.stringify(congelado);
    const ferramenta = criarFerramenta();
    ferramenta.selecionar('quarry');
    ferramenta.cancelar();
    expect(JSON.stringify(congelado)).toBe(antes);
  });
});

function teclar(alvo: EventTarget, tecla: string): void {
  alvo.dispatchEvent(Object.assign(new Event('keydown'), { key: tecla }));
}

describe('F06 — teclado', () => {
  it('Escape cancela a ferramenta; outra tecla nao', () => {
    const alvo = new EventTarget();
    const ferramenta = criarFerramenta();
    ligarTeclado(ferramenta, alvo);
    ferramenta.selecionar('quarry');
    teclar(alvo, 'a');
    expect(ferramenta.predioAtivo).toBe('quarry');
    teclar(alvo, 'Escape');
    expect(ferramenta.predioAtivo).toBeNull();
  });

  it('o desligador remove o ouvinte', () => {
    const alvo = new EventTarget();
    const ferramenta = criarFerramenta();
    const desligar = ligarTeclado(ferramenta, alvo);
    desligar();
    ferramenta.selecionar('quarry');
    teclar(alvo, 'Escape');
    expect(ferramenta.predioAtivo).toBe('quarry');
  });
});

// --- o que o painel mostra: um seletor, o painel nao varre predios ---

describe('F06 — opcoesDoMenuBuild', () => {
  const inicial = createInitialState(1);
  const opcoes = opcoesDoMenuBuild(inicial);

  it('uma opcao por predio do dado, na ordem do dado', () => {
    expect(opcoes.map((o) => o.id)).toEqual(gameData.predios.map((p) => p.id));
  });

  it('custo e tamanho vem do dado', () => {
    for (const def of gameData.predios) {
      const opcao = opcoes.find((o) => o.id === def.id);
      expect(opcao?.custo).toEqual({ timber: def.timber, stone: def.stone });
      expect(opcao?.tamanho).toEqual(def.tamanho);
    }
  });

  it('desbloqueado bate com estaDesbloqueado; requer e o pai da arvore so quando bloqueado', () => {
    for (const def of gameData.predios) {
      const opcao = opcoes.find((o) => o.id === def.id);
      expect(opcao?.desbloqueado).toBe(estaDesbloqueado(inicial, def.id));
      expect(opcao?.requer).toBe(opcao?.desbloqueado ? null : def.desbloqueadoPor);
    }
  });

  it('o menu inicial do GDD §3.2 aparece liberado e sawmill, bloqueado exigindo woodcutters', () => {
    for (const id of ['inn', 'quarry', 'woodcutters']) {
      expect(opcoes.find((o) => o.id === id)?.desbloqueado, id).toBe(true);
    }
    const serraria = opcoes.find((o) => o.id === 'sawmill');
    expect(serraria?.desbloqueado).toBe(false);
    expect(serraria?.requer).toBe('woodcutters');
  });

  it('bloqueado sem pai na arvore (storehouse) tem requer null: ninguem para nomear', () => {
    const armazem = opcoes.find((o) => o.id === 'storehouse');
    expect(armazem?.desbloqueado).toBe(false);
    expect(armazem?.requer).toBeNull();
  });
});

// --- guardas estruturais (por import, nunca por substring de numero) ---

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivosTs(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

function importam(dir: string, alvo: RegExp): string[] {
  return arquivosTs(dir).filter((f) => alvo.test(readFileSync(f, 'utf-8')));
}

describe('F06 — guardas estruturais de input/', () => {
  it('src/input/ nao importa phaser', () => {
    expect(importam('src/input', /from\s+['"]phaser['"]/)).toEqual([]);
  });

  it('src/input/ nao importa sim/data: le so intencao, nao tabela', () => {
    expect(importam('src/input', /from\s+['"].*sim\/data['"]/)).toEqual([]);
  });

  it('src/input/ nao importa sim/state: a planta fantasma nao mora no GameState', () => {
    expect(importam('src/input', /from\s+['"].*sim\/state['"]/)).toEqual([]);
  });
});

// --- a regra de dados: menuBuildInicial so para raiz sem pai ---

function dadosReaisComMenuInicial(menu: string[]): Record<string, unknown> {
  const dados: Record<string, unknown> = {};
  for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
  (dados.economy as { estadoInicial: { menuBuildInicial: string[] } }).estadoInicial.menuBuildInicial = menu;
  return dados;
}

describe('F06 — validate:data: menuBuildInicial so para raiz sem pai', () => {
  const errosDaRegra = (menu: string[]): string[] =>
    validarTudo(dadosReaisComMenuInicial(menu)).filter((e) => e.startsWith('economia/menu-inicial'));

  it('o dado real passa e nao repete nada da arvore', () => {
    expect(validarTudo(dadosReaisComMenuInicial([]))).toEqual([]);
    for (const id of gameData.economia.estadoInicial.menuBuildInicial) {
      expect(gameData.predios.find((p) => p.id === id)?.desbloqueadoPor).toBeNull();
    }
  });

  it('um predio com pai na arvore (quarry) em menuBuildInicial reprova, e a mensagem nomeia o pai', () => {
    const erros = errosDaRegra(['quarry']);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("'quarry'");
    expect(erros[0]).toContain("'schoolhouse'");
  });

  it('uma raiz sem pai (storehouse) em menuBuildInicial passa', () => {
    expect(errosDaRegra(['storehouse'])).toEqual([]);
  });
});

afterAll(() => {
  const inicial = createInitialState(1);
  const armazem = gameData.economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  if (!armazem) throw new Error('cenario inicial sem storehouse');
  const opcoes = opcoesDoMenuBuild(inicial);
  const menuInicial = gameData.economia.estadoInicial.menuBuildInicial;
  const desbloqueadosNoInicio = opcoes.filter((o) => o.desbloqueado).map((o) => o.id);

  gravarEvidencia('F06', {
    feature: 'F06-menu-build-planta',
    // VERIFICADO por teste headless: os tres casos do aceite escrito no
    // BUILD_PLAN.md, cada um com o motivo que canPlace devolveu.
    canPlace: {
      casosDoAceite: {
        sobreposicao: canPlace(inicial, 'quarry', armazem.gx, armazem.gy),
        foraDoMapa: canPlace(inicial, 'quarry', -1, 0),
        predioNaoDesbloqueado: canPlace(inicial, 'sawmill', 0, 0),
      },
      posicaoLivre: canPlace(inicial, 'quarry', 0, 0),
      ordemDeChecagemDocumentada: ['predio-desconhecido', 'bloqueado', 'fora-do-mapa', 'sobreposicao'],
    },
    desbloqueio: {
      menuBuildInicial: menuInicial,
      desbloqueadosNoEstadoInicial: desbloqueadosNoInicio,
      // Decisao do operador: menuBuildInicial so para raiz sem pai; o resto vem
      // da arvore. Schoolhouse liberada no inicio e aceitavel (o jogador pode
      // construir uma segunda).
      menuBuildInicialSoTemRaiz: menuInicial.every(
        (id) => gameData.predios.find((p) => p.id === id)?.desbloqueadoPor === null,
      ),
      arestasDaArvorePercorridas: gameData.predios.filter((p) => p.desbloqueadoPor !== null).length,
      // Decisao NOSSA (proposta, nao confirmada nas fontes): o desbloqueio e
      // permanente. Verificado por teste: demolir o Woodcutter's nao re-bloqueia
      // a Serraria, nem com uma Sawmill de pe.
      tiposJaConstruidosNoEstadoInicial: inicial.tiposJaConstruidos,
      demolirNaoReBloqueia: (() => {
        const cadeia = comPredio(comPredio(inicial, 'woodcutters', 10, 10), 'sawmill', 20, 10);
        const demolido = semOsPrediosDoTipo(cadeia, 'woodcutters');
        return {
          serrariaLiberadaAposDemolirLenhador: estaDesbloqueado(demolido, 'sawmill'),
          serrariaDePeNoEstado: demolido.predios.ordem.some((id) => demolido.predios.porId[id]?.tipo === 'sawmill'),
        };
      })(),
    },
    menu: {
      opcoes: opcoes.length,
      bloqueadosSemPaiNaArvore: opcoes.filter((o) => !o.desbloqueado && o.requer === null).map((o) => o.id),
    },
    // DECLARADO, NAO VERIFICADO: o membro existe no tipo e nenhum teste o
    // alcanca, de proposito. "Terreno invalido" saiu do aceite por decisao do
    // operador (nota da F06 no BUILD_PLAN.md; terreno de mapa esta em IDEIAS.md).
    terreno: {
      motivoDeclaradoNoTipo: 'terreno',
      alcancavelHoje: false,
      verificadoPorTeste: false,
    },
    // Verificacao visual e separada, fora do npm run verify (CLAUDE.md §8).
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F06 (test-output/F06-shot.json)',
  });
});
