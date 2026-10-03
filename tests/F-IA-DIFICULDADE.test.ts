/**
 * F-IA-DIFICULDADE — tres niveis de adversario (aceite no BUILD_PLAN, Fase F). Cada nivel troca so
 * os numeros que a IA ja le (`combat.json: ia.niveis`); o normal e o jogo de hoje.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { criarEscaramuca } from '../src/sim/cenario';
import { step } from '../src/sim/tick';
import { carregar, salvar } from '../src/sim/save';
import { numerosDaIA } from '../src/sim/ia';
import { FSM_INDO_ATACAR } from '../src/sim/systems/cerco';
import { estadoNovo, opcoesDeNivelNaTela } from '../src/escolha-da-partida';
import { rotuloDoNivel } from '../src/ui/menu-inicial';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';

const SEMENTE = gameData.economia.estadoInicial.semente;
const NIVEIS = ['facil', 'normal', 'dificil'] as const;
const rodar = (s0: GameState, n: number): GameState => {
  let s = s0;
  for (let i = 0; i < n; i++) s = step(s, [], gameData);
  return s;
};

describe('F-IA-DIFICULDADE — (a) o normal e a escaramuca de hoje', () => {
  it('escolher o normal da o mesmo estado que nao escolher, byte a byte, no tick 0 e 400 ticks depois', () => {
    const hoje = criarEscaramuca(SEMENTE);
    const normal = criarEscaramuca(SEMENTE, gameData, { nivel: 'normal' });
    expect(JSON.stringify(normal)).toBe(JSON.stringify(hoje));
    expect(normal.ia?.[String(LADO_DA_IA)]).not.toHaveProperty('nivel');
    expect(salvar(rodar(normal, 400))).toBe(salvar(rodar(hoje, 400)));
  });

  it('os numeros do normal sao os de hoje: o grupo, os atacantes e o ritmo do prefeito', () => {
    const n = gameData.combate.niveisDaIA['normal'];
    expect(n).toEqual({
      tamanhoDoGrupo: gameData.combate.ia.tamanhoDoGrupo,
      atacantes: gameData.escaramuca.atacantes.quantidade,
      ticksDaRevisao: gameData.economia.prefeito.ticksDaRevisao,
    });
  });
});

describe('F-IA-DIFICULDADE — (b) o mesmo nivel com os mesmos comandos da o mesmo estado', () => {
  for (const nivel of NIVEIS) {
    it(nivel, () => {
      const uma = (): string => salvar(rodar(criarEscaramuca(SEMENTE, gameData, { nivel, pazMinBase: 0 }), 300));
      expect(uma()).toBe(uma());
    });
  }
});

describe('F-IA-DIFICULDADE — (c) com o jogador parado, o ataque fica em ordem', () => {
  /** O tick do primeiro tick com soldado da IA indo atacar, e quantos. `Infinity` se nao veio. */
  function primeiroAtaque(nivel: string, paz: number, folga: number): { tick: number; tamanho: number } {
    let s = criarEscaramuca(SEMENTE, gameData, { nivel, pazMinBase: paz });
    const limite = (s.pazAteTick ?? 0) + folga;
    while (s.tick < limite) {
      s = step(s, [], gameData);
      const indo = s.unidades.ordem.filter((id) => {
        const u = s.unidades.porId[id];
        return u?.lado === LADO_DA_IA && u.fsm === FSM_INDO_ATACAR;
      }).length;
      if (indo > 0) return { tick: s.tick, tamanho: indo };
    }
    return { tick: Infinity, tamanho: 0 };
  }
  /** `a` ataca antes, ou no mesmo tick com mais. */
  const vemAntesOuComMais = (a: { tick: number; tamanho: number }, b: { tick: number; tamanho: number }): boolean =>
    a.tick < b.tick || (a.tick === b.tick && a.tamanho > b.tamanho);

  it('dificil antes ou com mais que normal, e normal antes ou com mais que facil (tabela no PROGRESS)', { timeout: 120_000 }, () => {
    const paz = gameData.escaramuca.opcoesDePaz.find((o) => o.ticks > 0)?.minBase ?? 0;
    const FOLGA = 2000;
    const tabela = Object.fromEntries(NIVEIS.map((n) => [n, primeiroAtaque(n, paz, FOLGA)]));
    gravarEvidencia('F-IA-DIFICULDADE-primeiro-ataque', {
      pazMinBase: paz, folgaDepoisDaPaz: FOLGA,
      tabela: Object.fromEntries(Object.entries(tabela).map(([n, r]) => [n, { tick: Number.isFinite(r.tick) ? r.tick : 'nao atacou', tamanho: r.tamanho }])),
    });
    const { facil, normal, dificil } = tabela as Record<(typeof NIVEIS)[number], { tick: number; tamanho: number }>;
    expect(Number.isFinite(normal.tick)).toBe(true);
    expect(vemAntesOuComMais(dificil, normal)).toBe(true);
    expect(vemAntesOuComMais(normal, facil)).toBe(true);
  });
});

describe('F-IA-DIFICULDADE — (d) o validate:data', () => {
  interface Cru { combat: { ia: { niveis: Record<string, Record<string, unknown>> } } }
  const cru = (mexer: (d: Cru) => void): string[] => {
    const d: Record<string, unknown> = {};
    for (const n of readdirSync('data').filter((f) => f.endsWith('.json')).map((f) => f.replace(/[.]json$/, ''))) d[n] = JSON.parse(readFileSync(`data/${n}.json`, 'utf8'));
    mexer(d as unknown as Cru);
    return validarTudo(d).filter((e: string) => e.startsWith('ia/niveis'));
  };
  it('aceita o dado de hoje', () => expect(cru(() => undefined)).toEqual([]));
  it('recusa nivel sem normal', () => expect(cru((d) => { delete d.combat.ia.niveis['normal']; })).toHaveLength(1));
  it('recusa campo de nivel que a IA nao le', () => {
    expect(cru((d) => { (d.combat.ia.niveis['dificil'] as Record<string, unknown>)['velocidade'] = 2; })).toHaveLength(1);
  });
  it('recusa grupo menor que a tropa de uma posicao, e numero invalido', () => {
    expect(cru((d) => { (d.combat.ia.niveis['facil'] as Record<string, unknown>)['tamanhoDoGrupo'] = 3; })).toHaveLength(1);
    expect(cru((d) => { (d.combat.ia.niveis['facil'] as Record<string, unknown>)['revisaoDoPrefeito_fator'] = 0; })).toHaveLength(1);
  });
});

describe('F-IA-DIFICULDADE — (e) a escolha e o save', () => {
  it('a tela oferece os niveis do dado, com o normal como padrao, e o rotulo vem do tema', () => {
    const opcoes = opcoesDeNivelNaTela();
    expect(opcoes.map((o) => o.valor)).toEqual([...NIVEIS]);
    expect(opcoes.filter((o) => o.padrao).map((o) => o.valor)).toEqual(['normal']);
    expect(opcoes.map((o) => rotuloDoNivel(o))).toEqual(['Fácil', 'Normal (padrão)', 'Difícil']);
  });

  it('o nivel escolhido entra no estado, sobrevive a salvar e carregar, e a IA o le depois', () => {
    const s = estadoNovo({ modo: 'escaramuca', nivel: 'dificil' });
    expect(s.ia?.[String(LADO_DA_IA)]?.nivel).toBe('dificil');
    expect(numerosDaIA(s, LADO_DA_IA).atacantes).toBe(gameData.combate.niveisDaIA['dificil']?.atacantes);
    const depois = carregar(salvar(rodar(s, 50)));
    expect(depois.ia?.[String(LADO_DA_IA)]?.nivel).toBe('dificil');
    expect(rodar(depois, 50).ia?.[String(LADO_DA_IA)]?.nivel).toBe('dificil');
  });
});
