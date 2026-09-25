/**
 * F23 — save e load.
 *
 * O aceite do BUILD_PLAN e um so: salvar num tick qualquer, carregar e rodar 500
 * ticks tem de dar o mesmo estado que rodar 500 ticks sem salvar. Ele NAO ganha
 * um teste proprio de save/load — reusa `compararComESemSave`
 * (`tests/helpers/determinism.ts`, F02), agora com o estado povoado e com o
 * round-trip trocado pelo par `salvar`/`carregar` de verdade. O que a F02
 * exercitava era `JSON.parse(JSON.stringify(...))`; aqui passa tambem o
 * envelope (versao, mapa, hash), que e o que uma partida salva mesmo carrega.
 *
 * O tick do save NAO esta digitado: e a condicao que o escolhe — a vila tem de
 * estar em movimento, com serf no meio de um passo carregando coisa e tarefa
 * reclamada na mao. Salvar numa vila parada provaria bem pouco.
 *
 * SAO DOIS EIXOS, e nenhum dos dois sobra (medido em `tests/zz-probe-F23.test.ts`,
 * 2026-09-25): a igualdade depois dos 500 ticks pega semente de rng, passo pela
 * metade e carga perdida, mas NAO pega o JobBoard apagado — a vila regenera a
 * tarefa e reconverge byte a byte. Quem pega essa perda e a igualdade no INSTANTE
 * do load, no terceiro teste daqui. Tirar um dos dois abre um buraco medido.
 */
import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/sim/state';
import type { GameData, RawGameData } from '../src/sim/data';
import { gameData, loadGameData, rawGameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import type { Save } from '../src/sim/save';
import { salvar, carregar, VERSAO_DO_SAVE } from '../src/sim/save';
import { compararComESemSave } from './helpers/determinism';
import { cenarioDaCadeiaDoOuro } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;
const TICKS_DEPOIS_DO_SAVE = 500;

/** Uma vila com quatro predios, estrada, bodega abastecida e seis serfs. */
const CENARIO = (): GameState => cenarioDaCadeiaDoOuro(DADOS);

const salvaECarrega = (estado: GameState): GameState => carregar(salvar(estado, DADOS), DADOS);

/** Serf no meio de um passo, com carga na mao e tarefa reclamada. */
function unidadesEmVoo(estado: GameState): readonly string[] {
  return Object.values(estado.unidades.porId)
    .filter((u) => u.fsmData.carga !== undefined
      && u.fsmData.tarefa !== undefined
      && (u.fsmData.caminho ?? []).length > 0
      && (u.fsmData.progresso ?? 0) > 0)
    .map((u) => u.id);
}

function tarefasReclamadas(estado: GameState): number {
  return Object.values(estado.jobs.tarefas.porId).filter((t) => t.estado === 'reclamada').length;
}

/**
 * O primeiro tick em que salvar DOI. O teto de 600 e seguranca contra cenario
 * que nunca anda — nao e afirmacao de desempenho: a primeira carga sai bem antes.
 */
function tickComAVilaEmMovimento(): number {
  let s = CENARIO();
  for (let t = 1; t <= 600; t += 1) {
    s = step(s, [], DADOS);
    if (unidadesEmVoo(s).length > 0 && tarefasReclamadas(s) > 0) return t;
  }
  throw new Error('fixture: a vila nao pos ninguem em movimento em 600 ticks');
}

const TICK_DO_SAVE = tickComAVilaEmMovimento();

function noTick(t: number): GameState {
  let s = CENARIO();
  for (let i = 0; i < t; i += 1) s = step(s, [], DADOS);
  return s;
}

const parDaComparacao = (): { readonly direto: string; readonly comSave: string } =>
  compararComESemSave({
    seed: 1,
    totalTicks: TICK_DO_SAVE + TICKS_DEPOIS_DO_SAVE,
    saveAtTick: TICK_DO_SAVE,
    antesDoStep: (e) => (e.tick === 0 ? CENARIO() : e),
    roundTrip: salvaECarrega,
  });

/** O mesmo dado, com UM char de terreno trocado no canto norte do mapa — longe
 *  da vila, que fica na faixa y 59..62. E o "mapa editado" do contrato da F-T1. */
function dadosComOMapaEditado(): GameData {
  const mapa = JSON.parse(JSON.stringify(rawGameData.mapa)) as { linhas: string[]; id: string };
  const linha = mapa.linhas[0] as string;
  const atual = linha[0] as string;
  const outro = Object.entries(gameData.mapa.legenda)
    .find(([char, tipo]) => char !== atual && tipo === 'montanha')?.[0]
    ?? (Object.keys(gameData.mapa.legenda).find((c) => c !== atual) as string);
  mapa.linhas[0] = outro + linha.slice(1);
  return loadGameData({ ...rawGameData, mapa } as unknown as RawGameData);
}

function dadosComOutroMapa(): GameData {
  const mapa = JSON.parse(JSON.stringify(rawGameData.mapa)) as { id: string };
  mapa.id = 'outro-mapa';
  return loadGameData({ ...rawGameData, mapa } as unknown as RawGameData);
}

function motivoDaRecusa(texto: string): string {
  try {
    carregar(texto, DADOS);
  } catch (erro) {
    return (erro as Error).message;
  }
  throw new Error('o load aceitou um save que devia recusar');
}

describe('F23, aceite — salvar, carregar e rodar 500 ticks da o mesmo estado', () => {
  it('a vila povoada chega ao mesmo byte com e sem save no meio', () => {
    const { direto, comSave } = parDaComparacao();
    expect(comSave).toBe(direto);
  });

  it('e o tick escolhido e mesmo o de uma vila em movimento, nao de uma parada', () => {
    const estado = noTick(TICK_DO_SAVE);
    expect(unidadesEmVoo(estado).length).toBeGreaterThan(0);
    expect(tarefasReclamadas(estado)).toBeGreaterThan(0);
    // e ha mundo de verdade em volta: quatro predios do cenario mais os da abertura.
    expect(estado.predios.ordem.length).toBeGreaterThan(4);
  });

  it('o round-trip pelo save nao muda nada, e as invariantes valem do outro lado', () => {
    // O contra-exemplo do primeiro teste: se o par salvar/carregar ja alterasse o
    // estado parado, a igualdade dos 500 ticks seria coincidencia.
    const estado = noTick(TICK_DO_SAVE);
    const revivido = salvaECarrega(estado);
    expect(JSON.stringify(revivido)).toBe(JSON.stringify(estado));
    expect(violacoesDeInvariantes(revivido, DADOS)).toEqual([]);
    expect(JSON.stringify(step(revivido, [], DADOS))).toBe(JSON.stringify(step(estado, [], DADOS)));
  });
});

describe('F23 — o envelope diz de qual mundo o save fala', () => {
  it('o save e texto, e carrega versao, id do mapa e hash', () => {
    const texto = salvar(noTick(TICK_DO_SAVE), DADOS);
    expect(typeof texto).toBe('string');
    const save = JSON.parse(texto) as Save;
    expect(save.versao).toBe(VERSAO_DO_SAVE);
    expect(save.mapa).toBe(DADOS.mapa.id);
    expect(save.hashDoMapa).toBe(DADOS.mapa.hash);
    expect(save.estado.tick).toBe(TICK_DO_SAVE);
  });

  it('o hash e do conteudo do mapa: o mesmo arquivo da o mesmo, um char muda o hash', () => {
    expect(loadGameData(rawGameData).mapa.hash).toBe(DADOS.mapa.hash);
    expect(dadosComOMapaEditado().mapa.hash).not.toBe(DADOS.mapa.hash);
    // e o id sozinho nao carrega a informacao: o mapa editado continua com o
    // MESMO id, e e so por isso que o hash precisa existir.
    expect(dadosComOMapaEditado().mapa.id).toBe(DADOS.mapa.id);
  });
});

describe('F23 — o load recusa na hora, nao 300 ticks depois', () => {
  it('save de outro mapa e recusado pelo id', () => {
    const texto = salvar(noTick(TICK_DO_SAVE), dadosComOutroMapa());
    expect(motivoDaRecusa(texto)).toMatch(/outro-mapa/);
  });

  it('save do mesmo mapa com o arquivo editado e recusado pelo hash', () => {
    const texto = salvar(noTick(TICK_DO_SAVE), dadosComOMapaEditado());
    const motivo = motivoDaRecusa(texto);
    expect(motivo).toMatch(/mudou desde o save/);
    // o id bateu: quem reprovou foi o hash, e nao o nome do arquivo.
    expect(motivo).toContain(DADOS.mapa.id);
  });

  it('save de outra versao de formato e recusado pela versao', () => {
    const save = JSON.parse(salvar(noTick(2), DADOS)) as Save;
    const texto = JSON.stringify({ ...save, versao: VERSAO_DO_SAVE + 1 });
    expect(motivoDaRecusa(texto)).toMatch(/versao/);
  });

  it('texto que nao e save nenhum tambem cai com motivo, nao com TypeError solto', () => {
    expect(motivoDaRecusa('isto nao e um save')).toMatch(/JSON/);
    expect(motivoDaRecusa('[]')).toMatch(/objeto/);
    const save = JSON.parse(salvar(noTick(2), DADOS)) as Save;
    expect(motivoDaRecusa(JSON.stringify({ ...save, estado: undefined }))).toMatch(/estado/);
    expect(motivoDaRecusa(JSON.stringify({ ...save, estado: { semTick: true } }))).toMatch(/tick/);
  });
});

describe('F23 — a evidencia', () => {
  it('grava test-output/F23.json', () => {
    const estado = noTick(TICK_DO_SAVE);
    const texto = salvar(estado, DADOS);
    const { direto, comSave } = parDaComparacao();
    gravarEvidencia('F23', {
      feature: 'F23 — save e load',
      aceite: 'salvar num tick qualquer, carregar e rodar 500 ticks = rodar 500 ticks sem salvar',
      reuso: 'compararComESemSave (F02), com roundTrip = carregar(salvar(...)) e o cenario da cadeia do ouro',
      oSave: {
        tickDoSave: TICK_DO_SAVE,
        escolhidoPor: 'primeiro tick com serf no meio de um passo, carga na mao e tarefa reclamada',
        unidadesEmVoo: unidadesEmVoo(estado),
        tarefasReclamadas: tarefasReclamadas(estado),
        prediosNoMundo: estado.predios.ordem.length,
        unidadesVivas: estado.unidades.ordem.length,
        bytesDoTexto: texto.length,
      },
      envelope: {
        versao: VERSAO_DO_SAVE,
        mapa: DADOS.mapa.id,
        hashDoMapa: DADOS.mapa.hash,
        hashComUmCharTrocado: dadosComOMapaEditado().mapa.hash,
      },
      determinismo: {
        ticksDepoisDoSave: TICKS_DEPOIS_DO_SAVE,
        iguais: direto === comSave,
        tickFinal: (JSON.parse(direto) as GameState).tick,
      },
      recusas: {
        outroMapa: motivoDaRecusa(salvar(estado, dadosComOutroMapa())),
        mapaEditado: motivoDaRecusa(salvar(estado, dadosComOMapaEditado())),
        outraVersao: motivoDaRecusa(JSON.stringify({
          ...(JSON.parse(texto) as Save), versao: VERSAO_DO_SAVE + 1,
        })),
        naoEJson: motivoDaRecusa('isto nao e um save'),
      },
      oQueNaoEntrou: 'botao de salvar na tela: o aceite escrito e de sim/, e src/ui nao foi tocado (ver PROGRESS.md)',
    });
    expect(direto).toBe(comSave);
  });
});
