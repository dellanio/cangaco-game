/**
 * E-TELA-CONFIGURAR-PARTIDA — a paz da escaramuca se escolhe (GDD §8.2, "Peacetime configuravel").
 *
 * Aceite (BUILD_PLAN, Fase E):
 *  (a) a mesma paz com os mesmos comandos da o mesmo estado, byte a byte;
 *  (b) com o padrao, o estado e igual ao da escaramuca de hoje (nenhum teste da C muda);
 *  (c) com cada opcao, o contador de paz mostra a duracao escolhida, e o ataque do jogador e a saida
 *      da IA sao recusados ate o tick dela e aceitos depois, pelo `step`;
 *  (d) o `validate:data` recusa opcao fora do intervalo do KaM (0 a 120, de 5 em 5) e padrao fora
 *      da lista.
 *
 * O (c) nao anda os ate 36 000 ticks de cada opcao: o estado e posto no tick antes do fim da paz
 * (`{ ...s, tick }`), e dali o `step` decide. O que se prova e a regra no limite de cada opcao; que o
 * relogio chega la andando e o `C-IA-03b` (paz curta, tick a tick). O tela (o seletor no menu) e o
 * roteiro `tools/shots/E-TELA-CONFIGURAR-PARTIDA.js`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData, rawGameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { emPaz, segundosDePazRestantes } from '../src/sim/paz';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { mmss, textoDoContador } from '../src/ui/contador-de-paz';
import { estadoNovo, opcoesDePazNaTela } from '../src/escolha-da-partida';
import { rotuloDaPaz } from '../src/ui/menu-inicial';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';
import { doLado, SEMENTE, tropaDoJogador } from './helpers/escaramuca-paz';
import { gravarEvidencia } from './helpers/evidence';

const OPCOES = gameData.escaramuca.opcoesDePaz;
const PADRAO = gameData.escaramuca.peacetime_min_base;
const FRENTE = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
const evidencia: Record<string, unknown> = {};

function rodar(s: GameState, ticks: number, comandos: readonly Command[] = []): GameState {
  let e = s;
  for (let t = 0; t < ticks; t++) e = step(e, t === 0 ? [...comandos] : [], gameData);
  return e;
}

const lutando = (e: GameState): number => doLado(e, LADO_DA_IA)
  .filter((id) => ['indo_lutar', 'lutando'].includes(e.unidades.porId[id]?.fsm ?? '')).length;

/** Um cabra do jogador DENTRO do raio da frente da IA, sem encostar em ninguem (como no C-IA-03b). */
function comIntruso(s: GameState): GameState {
  const intruso: Unidade = { id: 'intruso', lado: LADO_DO_JOGADOR, tipo: 'militia', gx: FRENTE.gx - 5, gy: FRENTE.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
  return { ...s, unidades: { porId: { ...s.unidades.porId, intruso }, ordem: [...s.unidades.ordem, 'intruso'] } };
}

function carregarDadosReais(): Record<string, unknown> {
  return Object.fromEntries(ARQUIVOS.map((nome: string) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8')) as unknown]));
}

describe('E-TELA-CONFIGURAR-PARTIDA — o dado', () => {
  it('as opcoes viram ticks no carregamento; o padrao esta na lista; 0 e sem paz', () => {
    expect(OPCOES.map((o) => o.minBase)).toEqual(rawGameData.escaramuca.peacetime_opcoes_min_base);
    expect(OPCOES.some((o) => o.minBase === PADRAO)).toBe(true);
    expect(OPCOES.find((o) => o.minBase === PADRAO)?.ticks).toBe(gameData.escaramuca.ticksDePaz);
    for (const o of OPCOES) {
      if (o.minBase === 0) {
        expect(o.ticks).toBe(0);
        continue;
      }
      expect(gameData.conversoes.find((c) => c.valorBase === o.minBase && c.caminho.startsWith('escaramuca.peacetime_opcoes_min_base['))).toMatchObject({ grupo: 'economia', unidade: 'min', ticks: o.ticks });
    }
    evidencia['opcoes'] = OPCOES.map((o) => ({ minBase: o.minBase, ticks: o.ticks }));
  });

  it('opcao fora da lista e erro de quem chamou', () => {
    expect(() => criarEscaramuca(SEMENTE, gameData, { pazMinBase: 7 })).toThrow(/nao esta em escaramuca.peacetime_opcoes_min_base/);
  });
});

describe('E-TELA-CONFIGURAR-PARTIDA — aceite (a) e (b)', () => {
  it('(a) a mesma paz com os mesmos comandos da o mesmo estado, byte a byte', () => {
    const paz = OPCOES.find((o) => o.minBase !== PADRAO && o.ticks > 0) as { minBase: number };
    const ordem = (s: GameState): Command[] => [{ type: 'MoveUnits', unidades: tropaDoJogador(s), destino: { gx: FRENTE.gx - 12, gy: FRENTE.gy - 12 } }];
    const a0 = criarEscaramuca(SEMENTE, gameData, { pazMinBase: paz.minBase });
    const b0 = criarEscaramuca(SEMENTE, gameData, { pazMinBase: paz.minBase });
    const a = rodar(a0, 200, ordem(a0));
    const b = rodar(b0, 200, ordem(b0));
    expect(salvar(a)).toBe(salvar(b));
    // e a paz entra no estado: outra opcao, outro estado
    const outra = criarEscaramuca(SEMENTE, gameData, { pazMinBase: PADRAO });
    expect(salvar(a0)).not.toBe(salvar(outra));
    evidencia['mesmaPaz'] = { paz: paz.minBase, tick: a.tick, bytes: salvar(a).length };
  });

  it('(b) com o padrao, o estado e o da escaramuca de hoje (sem opcao, com o padrao, pelo menu)', () => {
    const hoje = salvar(criarEscaramuca(SEMENTE));
    expect(salvar(criarEscaramuca(SEMENTE, gameData, { pazMinBase: PADRAO }))).toBe(hoje);
    expect(salvar(criarEscaramuca(SEMENTE, gameData, {}))).toBe(hoje);
    expect(salvar(estadoNovo({ modo: 'escaramuca' }))).toBe(hoje);
    expect(salvar(estadoNovo({ modo: 'escaramuca', pazMinBase: PADRAO }))).toBe(hoje);
  });
});

describe('E-TELA-CONFIGURAR-PARTIDA — aceite (c), cada opcao', () => {
  const porOpcao: Record<string, unknown>[] = [];

  for (const opcao of OPCOES) {
    it(`paz de ${opcao.minBase} min base (${opcao.ticks} ticks)`, () => {
      const s0 = criarEscaramuca(SEMENTE, gameData, { pazMinBase: opcao.minBase });
      const P = opcao.ticks;
      expect(s0.pazAteTick).toBe(P);

      // o contador mostra a duracao escolhida, no tick 0
      const segundos = segundosDePazRestantes(s0);
      expect(segundos).toBe(P / gameData.tempo.tickHz);
      const contador = textoDoContador(segundos);
      expect(contador).toBe(P === 0 ? '' : textoDoContador(P / gameData.tempo.tickHz));
      if (P > 0) expect(contador).toContain(mmss(P / gameData.tempo.tickHz));

      // o ataque do jogador: recusado no ultimo tick de paz, aceito no primeiro sem ela
      const tropa = tropaDoJogador(s0);
      const alvo = doLado(s0, LADO_DA_IA)[0] as string;
      const ataque: Command = { type: 'AttackUnit', unidades: tropa, alvo };
      const recusado = (s: GameState): boolean => step(s, [ataque], gameData).events
        .some((e) => e.type === 'command-rejected' && (e as { motivo?: string }).motivo === 'em-paz');
      if (P > 0) {
        const ultimo: GameState = { ...s0, tick: P - 1 };
        expect(emPaz(ultimo)).toBe(true);
        expect(recusado(ultimo)).toBe(true);
      }
      const depois: GameState = { ...s0, tick: P };
      expect(emPaz(depois)).toBe(false);
      expect(recusado(depois)).toBe(false);

      // a IA: com um intruso no raio, nao sai ate o fim da paz; depois, sai
      const JANELA = 30;
      let s = comIntruso({ ...s0, tick: Math.max(0, P - JANELA) });
      const antesDoFim = Math.min(JANELA, P);
      s = rodar(s, antesDoFim);
      if (P > 0) {
        expect(s.tick).toBe(P);
        expect(lutando(s)).toBe(0);
      }
      s = rodar(s, JANELA);
      expect(lutando(s)).toBeGreaterThan(0);

      porOpcao.push({ minBase: opcao.minBase, ticks: P, contador, iaLutandoDepois: lutando(s) });
      if (porOpcao.length === OPCOES.length) evidencia['porOpcao'] = porOpcao;
    });
  }

  it('a tela: cada opcao com o rotulo em tempo de JOGO, e o padrao marcado', () => {
    const tela = opcoesDePazNaTela();
    expect(tela.map((o) => o.valor)).toEqual(OPCOES.map((o) => o.minBase));
    expect(tela.filter((o) => o.padrao).map((o) => o.valor)).toEqual([PADRAO]);
    const rotulos = tela.map((o) => rotuloDaPaz(o));
    // 20 min base = 6000 ticks = 10 min de jogo (escala economia 2,0)
    const padrao = tela.find((o) => o.padrao) as { segundos: number };
    expect(rotulos[tela.findIndex((o) => o.padrao)]).toContain(String(padrao.segundos / 60));
    evidencia['rotulos'] = rotulos;
  });
});

describe('E-TELA-CONFIGURAR-PARTIDA — aceite (d), o validador', () => {
  const casos: [string, (e: Record<string, unknown>) => void, RegExp | null][] = [
    ['o dado real', () => undefined, null],
    ['opcao acima de 120', (e) => { e['peacetime_opcoes_min_base'] = [0, 20, 125]; }, /escaramuca\/paz: opcao 125 fora do intervalo/],
    ['opcao fora do passo de 5', (e) => { e['peacetime_opcoes_min_base'] = [0, 7, 20]; }, /escaramuca\/paz: opcao 7 fora do intervalo/],
    ['opcao negativa', (e) => { e['peacetime_opcoes_min_base'] = [-5, 20]; }, /escaramuca\/paz: opcao -5 fora do intervalo/],
    ['padrao fora da lista', (e) => { e['peacetime_min_base'] = 25; }, /escaramuca\/paz: o padrao peacetime_min_base \(25\) nao esta/],
    ['lista vazia', (e) => { e['peacetime_opcoes_min_base'] = []; }, /escaramuca\/paz: peacetime_opcoes_min_base precisa ser um array nao vazio/],
    ['repetida', (e) => { e['peacetime_opcoes_min_base'] = [20, 20]; }, /escaramuca\/paz: .*crescente, sem repetir/],
  ];
  for (const [nome, mexer, esperado] of casos) {
    it(nome, () => {
      const dados = carregarDadosReais();
      mexer(dados['escaramuca'] as Record<string, unknown>);
      const erros = validarTudo(dados).filter((e: string) => e.startsWith('escaramuca/paz'));
      if (esperado === null) expect(erros).toEqual([]);
      else expect(erros.some((e: string) => esperado.test(e)), JSON.stringify(erros)).toBe(true);
    });
  }

  it('grava a evidencia', () => {
    gravarEvidencia('E-TELA-CONFIGURAR-PARTIDA', evidencia);
  });
});
