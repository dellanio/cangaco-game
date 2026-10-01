/**
 * F-VIVO-e — o ocioso generico (BUILD_PLAN.md "Aceite da F-VIVO-e",
 * docs/planos/2026-09-30-F-VIVO-e-em-diante.md).
 *
 * Casa com o ocupante DENTRO e sem quadro de trabalho desenha o laco `ocioso`. "Dentro" e
 * o predicado que esconde a unidade no BUG-X (`dentroDaCasa`): o teste afirma que os dois
 * andam juntos em todo tick da vila, alem de que ocioso e trabalho nunca coincidem. Cada
 * ramo sai de um estado que o `step` produziu; o que so se varia no predio (pausado, obra,
 * comendo) parte desse estado e troca o campo que a funcao le.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInitialState } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { salvar } from '../src/sim/save';
import { dadosDoTrabalho } from '../src/render/predios';
import type { Manifesto } from '../src/render/manifesto';
import { LACOS_DO_OCIOSO, ID_DO_OCIOSO } from '../src/render/manifesto-camadas';
import { quadroDeTrabalho, quadroOcioso, TICKS_POR_QUADRO } from '../src/render/trabalho';
import type { DadosDoTrabalho } from '../src/render/trabalho';
import { dentroDaCasa, unidadesInvisiveis } from '../src/render/visibilidade';
import {
  cenarioDeFazenda, cenarioDePedreira, cenarioDeSerraria, comEntrada, comProdutorOcupado, pedreiraDaVila, semAUnidade, semOcupante,
} from './helpers/producao-cenario';
import { comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

const semArte = { assets: [] } as unknown as Manifesto;
const dados: DadosDoTrabalho = dadosDoTrabalho(semArte);
const QUADROS = LACOS_DO_OCIOSO[ID_DO_OCIOSO] ?? 0;
/** Os aceites gravam no mesmo arquivo: `gravarEvidencia` sobrescreve, entao acumula aqui. */
const evidencia: Record<string, unknown> = {};

function completoDe(s: GameState, id: string): PredioCompleto {
  const p = s.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}
function ocupanteDe(s: GameState, p: PredioCompleto): Unidade | null {
  return p.ocupante === null ? null : s.unidades.porId[p.ocupante] ?? null;
}
const ociosoEm = (s: GameState, id: string): number | null => {
  const p = completoDe(s, id);
  return quadroOcioso(p, ocupanteDe(s, p), s.tick, dados);
};

/** Roda `estado` pelo `step` ate `ate` valer, no maximo `max` ticks. Lanca se nao chegar. */
function ateQue(estado: GameState, ate: (s: GameState) => boolean, max: number): GameState {
  let s = estado;
  for (let i = 0; i < max; i += 1) {
    if (ate(s)) return s;
    s = step(s, [], gameData);
  }
  throw new Error(`fixture: a condicao nao veio em ${max} ticks`);
}
const fsmDoOcupante = (s: GameState, id: string): string | undefined => ocupanteDe(s, completoDe(s, id))?.fsm;

describe('F-VIVO-e — o ocioso generico', () => {
  it('aceite 1: na vila da calibracao, ocioso e trabalho nunca coincidem, e o ocioso anda com o esconder', () => {
    const TICKS = 6_000;
    let s: GameState = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s, gameData);
    let trabalho = 0;
    let ocioso = 0;
    let colisoes = 0;
    let divergencias = 0;
    const ociosoPorRotulo: Record<string, number> = {};
    for (let i = 0; i < TICKS; i += 1) {
      s = step(s, comandosDaVilaNoTick(s, vila, i, gameData), gameData);
      const invisiveis = unidadesInvisiveis(s);
      for (const id of s.predios.ordem) {
        const p = s.predios.porId[id];
        if (p === undefined || p.estado !== 'completo') continue;
        const u = ocupanteDe(s, p);
        const q = quadroDeTrabalho(p, u, s.tick, dados);
        const o = quadroOcioso(p, u, s.tick, dados);
        if (q !== null) trabalho += 1;
        if (o !== null) {
          ocioso += 1;
          ociosoPorRotulo[u?.fsm ?? '-'] = (ociosoPorRotulo[u?.fsm ?? '-'] ?? 0) + 1;
          if (u === null || !invisiveis.has(u.id)) divergencias += 1;
        }
        if (q !== null && o !== null) colisoes += 1;
      }
    }
    evidencia['aceite1'] = { ticks: TICKS, trabalho, ocioso, colisoes, divergencias, ociosoPorRotulo };
    gravarEvidencia('F-VIVO-e', evidencia);
    expect(trabalho).toBeGreaterThan(0);
    expect(ocioso).toBeGreaterThan(0);
    expect(colisoes).toBe(0);
    // ocioso aceso com o homem desenhado seria a casa com gente dentro e o homem na porta
    expect(divergencias).toBe(0);
  // `timeout` NAO e assercao de tempo (CLAUDE.md §8): existe para o caso travar. Sozinho ~1,4 s; na
  // suite, a disputa entre os workers do Vitest o levava ao limite padrao de 5 s (medido 2026-09-30).
  }, 20_000);

  it('aceite 2: acende em esperando_insumo e em saida_cheia com o ocupante dentro', () => {
    const semInsumo = ateQue(cenarioDeSerraria(), (s) => fsmDoOcupante(s, 's1') === 'esperando_insumo'
      && dentroDaCasa(completoDe(s, 's1'), ocupanteDe(s, completoDe(s, 's1')) as Unidade), 2_000);
    expect(ociosoEm(semInsumo, 's1')).not.toBeNull();

    // pedreira sem serf: a saida enche e ninguem a esvazia
    const cheia = ateQue(cenarioDePedreira(), (s) => fsmDoOcupante(s, 'q1') === 'saida_cheia', 20_000);
    expect(dentroDaCasa(completoDe(cheia, 'q1'), ocupanteDe(cheia, completoDe(cheia, 'q1')) as Unidade)).toBe(true);
    expect(ociosoEm(cheia, 'q1')).not.toBeNull();
    expect(quadroDeTrabalho(completoDe(cheia, 'q1'), ocupanteDe(cheia, completoDe(cheia, 'q1')), cheia.tick, dados)).toBeNull();
  });

  it('aceite 2: apagado sem ocupante, com ocupante fora, comendo, em obra e sem receita', () => {
    const semInsumo = ateQue(cenarioDeSerraria(), (s) => fsmDoOcupante(s, 's1') === 'esperando_insumo', 2_000);
    const p = completoDe(semInsumo, 's1');
    const u = ocupanteDe(semInsumo, p) as Unidade;
    const t = semInsumo.tick;
    expect(quadroOcioso(p, u, t, dados)).not.toBeNull();

    expect(quadroOcioso({ ...p, ocupante: null }, u, t, dados)).toBeNull();
    expect(quadroOcioso(p, null, t, dados)).toBeNull();
    expect(quadroOcioso(p, { ...u, fsm: 'comendo' } as Unidade, t, dados)).toBeNull();
    expect(quadroOcioso(p, { ...u, fsm: 'indo_comer' } as Unidade, t, dados)).toBeNull();
    // o storehouse nao tem receita: nao entra na regra
    expect(quadroOcioso({ ...p, tipo: 'storehouse', producao: null }, u, t, dados)).toBeNull();
    const obra = { ...p, estado: 'obra' } as unknown as Predio;
    expect(quadroOcioso(obra, u, t, dados)).toBeNull();
    // PAUSADO (D3, 2026-10-01): o homem fica dentro e o ocioso acende; o caminho pelo
    // comando esta no aceite 6
    expect(quadroOcioso({ ...p, pausado: true }, u, t, dados)).not.toBeNull();
    expect(dentroDaCasa({ ...p, pausado: true }, u)).toBe(true);

    // ocupante fora de verdade: a pedreira com o canteiro no lajedo
    const noTile = ateQue(cenarioDePedreira(), (s) => fsmDoOcupante(s, 'q1') === 'colhendo', 5_000);
    expect(ociosoEm(noTile, 'q1')).toBeNull();
  });

  it('aceite 3: no caso 1, o descanso mostra o ocioso e a fase no tile nao mostra nada', () => {
    let s = cenarioDeFazenda();
    let descansoComOcioso = 0;
    let foraSemOcioso = 0;
    const erros: string[] = [];
    for (let i = 0; i < 6_000; i += 1) {
      s = step(s, [], gameData);
      const p = completoDe(s, 'f1');
      const u = ocupanteDe(s, p);
      if (u === null) continue;
      const o = quadroOcioso(p, u, s.tick, dados);
      const dentro = dentroDaCasa(p, u);
      if (dentro && o !== null) descansoComOcioso += 1;
      if (!dentro && o === null) foraSemOcioso += 1;
      if (dentro !== (o !== null)) erros.push(`${s.tick}: ${u.fsm} dentro=${dentro} ocioso=${o}`);
    }
    evidencia['aceite3'] = { descansoComOcioso, foraSemOcioso, erros: erros.length };
    gravarEvidencia('F-VIVO-e', evidencia);
    expect(erros.slice(0, 5)).toEqual([]);
    expect(descansoComOcioso).toBeGreaterThan(0);
    expect(foraSemOcioso).toBeGreaterThan(0);
  });

  it('aceite 4: o n anda de 1 a 8 e volta a 1 sem pulo', () => {
    const semInsumo = ateQue(cenarioDeSerraria(), (s) => fsmDoOcupante(s, 's1') === 'esperando_insumo', 2_000);
    const p = completoDe(semInsumo, 's1');
    const u = ocupanteDe(semInsumo, p) as Unidade;
    const ns = Array.from({ length: 3 * QUADROS * TICKS_POR_QUADRO + 1 }, (_, t) => quadroOcioso(p, u, t, dados));
    expect(ns[0]).toBe(1);
    expect(new Set(ns)).toEqual(new Set(Array.from({ length: QUADROS }, (_, i) => i + 1)));
    for (let i = 1; i < ns.length; i += 1) {
      const a = ns[i - 1] as number;
      const b = ns[i] as number;
      expect(b === a || b === a + 1 || (a === QUADROS && b === 1), `${i}: ${a} -> ${b}`).toBe(true);
    }
  });

  it('aceite 6 (D3): pausar pelo comando mantem o homem dentro, escondido, e acende o ocioso', () => {
    // com tora na entrada: a serraria da fixture nasce vazia, e o `trabalhando` do tick 0 cai
    // em esperando_insumo no tick 1 — nao haveria trabalho para voltar depois de despausar
    const trabalhando = ateQue(comEntrada(cenarioDeSerraria(), 's1', { tree_trunk: 5 }), (s) => {
      const p = completoDe(s, 's1');
      return (p.producao?.progresso ?? 0) > 0 && quadroDeTrabalho(p, ocupanteDe(s, p), s.tick, dados) !== null;
    }, 5_000);
    const ocupante = completoDe(trabalhando, 's1').ocupante;
    expect(ocupante).not.toBeNull();
    let s = step(trabalhando, [{ type: 'SetBuildingPaused', predio: 's1', pausado: true }], gameData);
    // guarda do cenario: o comando pegou
    expect(completoDe(s, 's1').pausado).toBe(true);
    const tabela: Array<{ tick: number; fsm: string | undefined; dentro: boolean; escondido: boolean; ocioso: boolean }> = [];
    for (let i = 0; i < 50; i += 1) {
      s = step(s, [], gameData);
      const p = completoDe(s, 's1');
      const u = ocupanteDe(s, p);
      expect(p.ocupante).toBe(ocupante);
      if (u === null) throw new Error('o ocupante sumiu');
      const linha = { tick: s.tick, fsm: u.fsm, dentro: dentroDaCasa(p, u), escondido: unidadesInvisiveis(s).has(u.id), ocioso: quadroOcioso(p, u, s.tick, dados) !== null };
      tabela.push(linha);
      expect(linha, `tick ${s.tick}`).toMatchObject({ dentro: true, escondido: true, ocioso: true });
      expect(quadroDeTrabalho(p, u, s.tick, dados)).toBeNull();
    }
    // a partida do roteiro F-VIVO-e-pausado: a serraria pausada com o serrador dentro
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-VIVO-e-pausado.save.txt`, salvar(s));
    const s1 = completoDe(s, 's1');
    const partidaPausada = { tick: s.tick, predio: 's1', ocupante, centro: { gx: s1.gx + 1.5, gy: s1.gy + 1 } };
    writeFileSync(`${dir}/F-VIVO-e-pausado.partida.json`, JSON.stringify(partidaPausada, null, 2));
    // despausado, o trabalho volta e o ocioso apaga
    s = step(s, [{ type: 'SetBuildingPaused', predio: 's1', pausado: false }], gameData);
    s = ateQue(s, (e) => {
      const p = completoDe(e, 's1');
      return quadroDeTrabalho(p, ocupanteDe(e, p), e.tick, dados) !== null;
    }, 500);
    expect(ociosoEm(s, 's1')).toBeNull();
    evidencia['aceite6'] = { ocupante, pausadoPor: tabela.length, primeira: tabela[0], ultima: tabela[tabela.length - 1], voltouNoTick: s.tick };
    gravarEvidencia('F-VIVO-e', evidencia);
  });

  it('aceite 5 (partida do roteiro): pedreira de saida cheia ao lado de pedreira vazia', () => {
    // a segunda pedreira onde o jogador poderia pô-la, colada a oeste da q1 (relativa: o
    // mundo transladado da F18c-1c anda junto)
    const VAZIA = { gx: pedreiraDaVila().gx - 4, gy: pedreiraDaVila().gy };
    const base = cenarioDePedreira();
    expect(canPlace(base, 'quarry', VAZIA.gx, VAZIA.gy).ok).toBe(true);
    let s = comProdutorOcupado(base, { tipo: 'quarry', id: 'q2', unidade: 'u9', ...VAZIA }, gameData);
    s = semOcupante(semAUnidade(s, 'u9'), 'q2');
    s = ateQue(s, (e) => fsmDoOcupante(e, 'q1') === 'saida_cheia', 20_000);
    expect(ociosoEm(s, 'q1')).not.toBeNull();
    expect(completoDe(s, 'q2').ocupante).toBeNull();
    expect(ociosoEm(s, 'q2')).toBeNull();
    // e continua assim: sem serf, ninguem esvazia a q1 nem ocupa a q2
    const depois = ateQue(s, (e) => e.tick >= s.tick + 50, 60);
    expect(fsmDoOcupante(depois, 'q1')).toBe('saida_cheia');
    expect(completoDe(depois, 'q2').ocupante).toBeNull();
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F-VIVO-e.save.txt`, salvar(s));
    const q1 = completoDe(s, 'q1');
    const partida = { tick: s.tick, cheia: 'q1', vazia: 'q2', centro: { gx: (VAZIA.gx + q1.gx + 3) / 2, gy: q1.gy + 1 } };
    writeFileSync(`${dir}/F-VIVO-e.partida.json`, JSON.stringify(partida, null, 2));
    evidencia['partida'] = partida;
    gravarEvidencia('F-VIVO-e', evidencia);
  });
});
