/**
 * F23b — salvar e carregar pela tela, a metade headless.
 *
 * O formato e a garantia de determinismo sao da F23 e nao se repetem aqui. O que
 * esta feature acrescenta, e o que este arquivo prova, e o GESTO: a partida vai
 * para uma gaveta, uma sessao NOVA (a pagina recarregada) a le de volta e segue
 * igual; toda recusa deixa a partida em curso intocada e chega ao jogador com o
 * motivo. O roteiro `tools/shots/F23b.js` prova a mesma coisa na tela.
 */
import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { criarSessao } from '../src/sessao';
import type { Gaveta, ResultadoDoArquivo } from '../src/arquivo-da-partida';
import { CHAVE_DO_SAVE, criarArquivoDaPartida } from '../src/arquivo-da-partida';
import { textoDoRecado } from '../src/ui/arquivo';
import temaSertao from '../data/theme-sertao.json';
import { cenarioDaCadeiaDoOuro } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const TICKS_ANTES_DE_SALVAR = 300;
const TICKS_DEPOIS_DO_LOAD = 200;

function gavetaDeMentira(): Gaveta & { readonly itens: Map<string, string> } {
  const itens = new Map<string, string>();
  return {
    itens,
    getItem: (k) => itens.get(k) ?? null,
    setItem: (k, v) => {
      itens.set(k, v);
    },
  };
}

function rodar(estado: GameState, ticks: number): GameState {
  let s = estado;
  for (let i = 0; i < ticks; i += 1) s = step(s, [], gameData);
  return s;
}

const vilaEmCurso = (): GameState => rodar(cenarioDaCadeiaDoOuro(gameData), TICKS_ANTES_DE_SALVAR);
const partidaNova = (): GameState => createInitialState(gameData.economia.estadoInicial.semente);

const evidencia: Record<string, unknown> = {};

describe('F23b — guardar e retomar a partida', () => {
  it('guarda, uma sessao nova retoma, e as duas seguem iguais', () => {
    const gaveta = gavetaDeMentira();
    const original = criarSessao(vilaEmCurso());
    const salvou = criarArquivoDaPartida(original, gaveta).salvar();
    expect(salvou).toEqual({ ok: true, acao: 'salvou', tick: TICKS_ANTES_DE_SALVAR });
    expect(gaveta.itens.has(CHAVE_DO_SAVE)).toBe(true);

    // a pagina recarregada: outra sessao, na partida nova do tick 0
    const recarregada = criarSessao(partidaNova());
    expect(recarregada.estado.tick).toBe(0);
    const carregou = criarArquivoDaPartida(recarregada, gaveta).carregar();
    expect(carregou).toEqual({ ok: true, acao: 'carregou', tick: TICKS_ANTES_DE_SALVAR });
    // no instante do load (a F23 mediu que so os 500 ticks depois nao bastam)
    expect(recarregada.estado).toEqual(original.estado);

    for (let i = 0; i < TICKS_DEPOIS_DO_LOAD; i += 1) {
      original.passo();
      recarregada.passo();
    }
    expect(JSON.stringify(recarregada.estado)).toBe(JSON.stringify(original.estado));
    evidencia['ticks'] = { salvouNo: TICKS_ANTES_DE_SALVAR, depoisDoLoad: TICKS_DEPOIS_DO_LOAD };
    evidencia['bytesDoSave'] = gaveta.itens.get(CHAVE_DO_SAVE)?.length ?? 0;
  });

  it('retomar descarta a fila e avisa quem ouve', () => {
    const gaveta = gavetaDeMentira();
    const salva = vilaEmCurso();
    criarArquivoDaPartida(criarSessao(salva), gaveta).salvar();

    const sessao = criarSessao(partidaNova());
    const ouvidos: number[] = [];
    sessao.aoMudar((s) => ouvidos.push(s.tick));
    const qualquerPredio = Object.keys(sessao.estado.predios.porId)[0];
    expect(qualquerPredio).toBeDefined();
    // comando dado sobre a partida VELHA, ainda na fila na hora do load
    sessao.enviar({ type: 'SetBuildingPaused', predio: qualquerPredio!, pausado: true });

    criarArquivoDaPartida(sessao, gaveta).carregar();
    expect(ouvidos).toEqual([TICKS_ANTES_DE_SALVAR]);
    sessao.passo();
    expect(sessao.estado).toEqual(step(salva, [], gameData));
  });

  it('cada recusa deixa a partida em curso intocada e diz o motivo', () => {
    const recusas: Record<string, ResultadoDoArquivo> = {};
    const tentar = (gaveta: Gaveta, dados: GameData = gameData): ResultadoDoArquivo => {
      const sessao = criarSessao(partidaNova());
      const antes = sessao.estado;
      let publicou = false;
      sessao.aoMudar(() => {
        publicou = true;
      });
      const r = criarArquivoDaPartida(sessao, gaveta, dados).carregar();
      expect(sessao.estado).toBe(antes);
      expect(publicou).toBe(false);
      return r;
    };

    recusas['vazia'] = tentar(gavetaDeMentira());
    expect(recusas['vazia']).toEqual({ ok: false, causa: 'sem-save', detalhe: '' });

    const lixo = gavetaDeMentira();
    lixo.setItem(CHAVE_DO_SAVE, '{');
    recusas['lixo'] = tentar(lixo);
    expect(recusas['lixo']).toEqual({ ok: false, causa: 'recusado', detalhe: 'o save nao e JSON valido' });

    // o mesmo save lido por uma build cujo mapa mudou: recusa na hora, com o motivo da F23
    const boa = gavetaDeMentira();
    criarArquivoDaPartida(criarSessao(vilaEmCurso()), boa).salvar();
    const outroMapa: GameData = { ...gameData, mapa: { ...gameData.mapa, hash: 'outro' } };
    recusas['mapaMudou'] = tentar(boa, outroMapa);
    expect(recusas['mapaMudou'].ok).toBe(false);
    expect(!recusas['mapaMudou'].ok && recusas['mapaMudou'].detalhe).toMatch(/mudou desde o save/);

    const bloqueada: Gaveta = {
      getItem: () => {
        throw new Error('armazenamento bloqueado');
      },
      setItem: () => undefined,
    };
    recusas['bloqueada'] = tentar(bloqueada);
    expect(recusas['bloqueada']).toEqual({ ok: false, causa: 'gaveta', detalhe: 'armazenamento bloqueado' });
    evidencia['recusas'] = recusas;
  });

  it('gaveta cheia: guardar nao lanca, devolve o motivo e nao mexe na partida', () => {
    const sessao = criarSessao(vilaEmCurso());
    const antes = sessao.estado;
    const cheia: Gaveta = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(criarArquivoDaPartida(sessao, cheia).salvar()).toEqual({ ok: false, causa: 'gaveta', detalhe: 'QuotaExceededError' });
    expect(sessao.estado).toBe(antes);
  });

  it('o recado sai do tema, com o detalhe no lugar', () => {
    const r = temaSertao.hud.arquivo;
    const recados = {
      salvou: textoDoRecado({ ok: true, acao: 'salvou', tick: 1 }, r),
      carregou: textoDoRecado({ ok: true, acao: 'carregou', tick: 1 }, r),
      semSave: textoDoRecado({ ok: false, causa: 'sem-save', detalhe: '' }, r),
      recusado: textoDoRecado({ ok: false, causa: 'recusado', detalhe: 'o save nao e JSON valido' }, r),
      gaveta: textoDoRecado({ ok: false, causa: 'gaveta', detalhe: 'QuotaExceededError' }, r),
    };
    expect(recados.salvou).toBe(r.salvou);
    expect(recados.carregou).toBe(r.carregou);
    expect(recados.semSave).toBe(r.semSave);
    expect(recados.recusado).toBe(r.recusado.replace('{detalhe}', 'o save nao e JSON valido'));
    expect(recados.gaveta).toBe(r.gaveta.replace('{detalhe}', 'QuotaExceededError'));
    for (const texto of Object.values(recados)) expect(texto).not.toContain('{detalhe}');
    evidencia['recados'] = recados;
  });

  it('grava test-output/F23b.json', () => {
    gravarEvidencia('F23b', { feature: 'F23b-salvar-pela-tela', chave: CHAVE_DO_SAVE, ...evidencia });
  });
});
