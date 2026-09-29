/**
 * C-COMIDA-01d + 01f (painel de grupo com o Alimentar, e o alerta de tropa com fome no
 * HUD; plano em docs/planos/2026-09-28-F-FEED-fome-militar.md §4 e §7). A parte headless:
 *  - o corpo da aba e o painel do grupo quando ha grupo, e o do predio vence;
 *  - o texto do painel: quantos de cada tipo (nome do tema), a condicao do mais faminto
 *    (arredondada para baixo) e "N esperando comida", que some com zero;
 *  - "Ninguem com fome" acende so com o Feed recusado `sem-fome`;
 *  - o alerta da tropa: conta os militares do JOGADOR no alerta de fome, e toma a
 *    primeira linha da faixa;
 *  - o tema tem todos os rotulos novos.
 * Grava `test-output/C-COMIDA-01d.save.txt`, que o roteiro `npm run shot -- C-COMIDA-01d`
 * carrega (as tres capturas do aceite: com fome, pao a caminho, cheio).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { resumoDoGrupo, tropaComFome, CAUSAS_DE_ALERTA } from '../src/sim/selectors';
import { salvar } from '../src/sim/save';
import { corpoDaAba } from '../src/ui/barra';
import { causasNaFaixa, LINHAS_NA_FAIXA } from '../src/ui/alertas';
import { feedSemFome, nomeDaTropa, textoDoGrupo } from '../src/ui/painel-grupo';
import temaSertao from '../data/theme-sertao.json';

const CHEIA = condicaoCheiaDoTipo('militia');
const SOLDADOS = ['cabra1', 'cabra2', 'cabra3'];

function soldado(id: string, gx: number, gy: number, fracao: number, tipo = 'militia', lado = LADO_DO_JOGADOR): Unidade {
  return { lado, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: Math.floor(fracao * condicaoCheiaDoTipo(tipo)) };
}
function com(s: GameState, ...us: Unidade[]): GameState {
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } };
}
const zeradas = (): Record<(typeof CAUSAS_DE_ALERTA)[number], number> =>
  Object.fromEntries(CAUSAS_DE_ALERTA.map((c) => [c, 0])) as Record<(typeof CAUSAS_DE_ALERTA)[number], number>;

describe('C-COMIDA-01d — o painel do grupo', () => {
  it('o corpo: grupo na mao abre o painel do grupo; predio escolhido vence; outras abas nao mudam', () => {
    expect(corpoDaAba('construir', false, true)).toBe('grupo');
    expect(corpoDaAba('construir', true, true)).toBe('painel');
    expect(corpoDaAba('construir', false, false)).toBe('grade');
    expect(corpoDaAba('opcoes', false, true)).toBe('opcoes');
    expect(corpoDaAba('estatisticas', false, true)).toBe('estatisticas');
  });

  it('o texto: tipos com o nome do tema, a condicao do mais faminto para baixo, e quem espera', () => {
    const s = com(createInitialState(1),
      // 5390/18000 = 29,94 %: o painel diz 29, nunca 30 (arredonda para baixo)
      { ...soldado('a', 30, 40, 0), condicao: Math.round(0.3 * CHEIA) - 10 }, soldado('b', 31, 40, 0.9), soldado('m', 32, 40, 0.5, 'rogue'));
    const s2 = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, a: { ...(s.unidades.porId['a'] as Unidade), pedidoDeComida: true as const } } } };
    const texto = textoDoGrupo(resumoDoGrupo(s2, ['a', 'b', 'm']));
    expect(texto.tipos).toEqual([
      { tipo: 'militia', texto: `2 ${temaSertao.militares.militia.nome}` },
      { tipo: 'rogue', texto: `1 ${temaSertao.mercenarios.rogue.nome}` },
    ]);
    expect(texto.condicao).toBe(temaSertao.grupo.condicao.replace('{n}', '29'));
    expect(texto.esperando).toBe(temaSertao.grupo.esperando.replace('{n}', '1'));
    expect(textoDoGrupo(resumoDoGrupo(s, ['b'])).esperando).toBeNull();
    expect(nomeDaTropa('tipo-sem-tema')).toBe('tipo-sem-tema');
  });

  it('"Ninguem com fome" acende so com o Feed recusado sem-fome', () => {
    const s = com(createInitialState(1), soldado('b', 31, 40, 0.9), soldado('a', 30, 40, 0.3));
    const recusado = step(s, [{ type: 'FeedUnits', unidades: ['b'] }], gameData);
    expect(feedSemFome(recusado.events)).toBe(true);
    const aceito = step(s, [{ type: 'FeedUnits', unidades: ['a', 'b'] }], gameData);
    expect(feedSemFome(aceito.events)).toBe(false);
    const outraRecusa = step(s, [{ type: 'FeedUnits', unidades: [] }], gameData);
    expect(feedSemFome(outraRecusa.events)).toBe(false);
  });

  it('o tema tem os rotulos do painel e do alerta', () => {
    for (const chave of ['titulo', 'condicao', 'esperando', 'alimentar', 'ninguemComFome'] as const) {
      expect(typeof temaSertao.grupo[chave], chave).toBe('string');
    }
    expect(temaSertao.grupo.condicao).toContain('{n}');
    expect(temaSertao.grupo.esperando).toContain('{n}');
    expect(typeof temaSertao.alertas.tropaComFome).toBe('string');
  });
});

describe('C-COMIDA-01f — o alerta de tropa com fome', () => {
  it('conta os militares do JOGADOR no alerta de fome; o do outro lado e o civil nao entram', () => {
    const LIMIAR = gameData.condicao.ticksNoLimiar.militar.alertaVisual;
    const s = com(createInitialState(1),
      { ...soldado('a', 30, 40, 0), condicao: LIMIAR },
      { ...soldado('b', 31, 40, 0), condicao: LIMIAR + 1 },
      soldado('x', 32, 40, 0.1, 'militia', LADO_DO_JOGADOR + 1));
    const serf = s.unidades.ordem.find((id) => s.unidades.porId[id]?.tipo === 'serf') as string;
    const comSerfFaminto = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, [serf]: { ...(s.unidades.porId[serf] as Unidade), condicao: 0 } } } };
    expect(tropaComFome(comSerfFaminto, LADO_DO_JOGADOR)).toBe(1);
    expect(tropaComFome(comSerfFaminto, LADO_DO_JOGADOR + 1)).toBe(1);
  });

  it('a tropa com fome toma a primeira linha da faixa; as causas ficam com o resto', () => {
    const todas = Object.fromEntries(CAUSAS_DE_ALERTA.map((c) => [c, 1])) as ReturnType<typeof zeradas>;
    expect(causasNaFaixa(todas)).toEqual({ visiveis: CAUSAS_DE_ALERTA.slice(0, LINHAS_NA_FAIXA), sobram: CAUSAS_DE_ALERTA.length - LINHAS_NA_FAIXA });
    expect(causasNaFaixa(todas, 3)).toEqual({
      visiveis: CAUSAS_DE_ALERTA.slice(0, LINHAS_NA_FAIXA - 1), sobram: CAUSAS_DE_ALERTA.length - LINHAS_NA_FAIXA + 1,
    });
    expect(causasNaFaixa(zeradas(), 3)).toEqual({ visiveis: [], sobram: 0 });
  });

  it('o save do roteiro: tres cabras a 30 %, abaixo do alerta e do pedido, perto do armazem', () => {
    const s = com(createInitialState(1), ...SOLDADOS.map((id, i) => soldado(id, 30 + 2 * i, 40, 0.3)));
    expect(tropaComFome(s, LADO_DO_JOGADOR)).toBe(3);
    expect(resumoDoGrupo(s, SOLDADOS).condicao).toBeLessThan(gameData.condicao.ticksPedeComida / CHEIA);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/C-COMIDA-01d.save.txt`, salvar(s));
  });
});
