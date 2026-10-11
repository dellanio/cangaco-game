/**
 * I-MOVIMENTO-DEVOLVENDO-SEM-ARMAZEM-CEDE-O-TILE — o serf que espera para devolver a carga sem armazem
 * nenhum e "quem nao tem tarefa nem lugar": parado, ele e empurrado como o ocioso, com a carga. Medido:
 * no teste longo da C-IA-03b com a tropa de 27, o armazem da IA cai, um serf com pao fica parado na rua
 * em `devolvendo`, e outro serf fica bloqueado 458 ticks atras dele (prazo 450).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DO_ARMAZEM, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { ehEmpurravel } from '../src/sim/colisao';
import { armazemMaisProximo } from '../src/sim/deposito';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';

type Tile = { gx: number; gy: number };

function serf(id: string, lado: number, t: Tile, fsm: string, fsmData: Unidade['fsmData']): Unidade {
  return { lado, id, tipo: 'serf', gx: t.gx, gy: t.gy, fsm, fsmData, condicao: condicaoCheiaDoTipo('serf') };
}

describe('I-MOVIMENTO-DEVOLVENDO-SEM-ARMAZEM-CEDE-O-TILE', () => {
  it('(1) por tabela: quem e empurravel', () => {
    const t = { gx: 10, gy: 10 };
    const passo = [{ gx: 11, gy: 10 }];
    const casos: [string, Unidade, boolean][] = [
      ['ocioso parado', serf('a', 0, t, 'ocioso', {}), true],
      ['ocioso dando o passo de lado', serf('a', 0, t, 'ocioso', { caminho: passo, progresso: 0 }), false],
      ['devolvendo sem armazem, parado', serf('a', 0, t, 'devolvendo', { carga: 'loaves' }), true],
      ['devolvendo COM armazem', serf('a', 0, t, 'devolvendo', { carga: 'loaves', armazem: 'p1' }), false],
      ['devolvendo sem armazem, com caminho', serf('a', 0, t, 'devolvendo', { carga: 'loaves', caminho: passo, progresso: 0 }), false],
      ['indo_entregar', serf('a', 0, t, 'indo_entregar', { carga: 'loaves' }), false],
    ];
    for (const [nome, u, esperado] of casos) expect(ehEmpurravel(u), nome).toBe(esperado);
  });

  it('(2) pelo step: o serf parado sem armazem e empurrado com a carga, e o outro passa antes do prazo', () => {
    const base = createInitialState(gameData.economia.estadoInicial.semente);
    const armazem = base.predios.ordem.map((id) => base.predios.porId[id]!).find((p) => p.tipo === ID_DO_ARMAZEM && p.lado === LADO_DO_JOGADOR);
    expect(armazem, 'fixture: o armazem do jogador').toBeDefined();
    const vazio: GameState = { ...base, unidades: { porId: {}, ordem: [] } };
    // quem anda: um serf do jogador devolvendo, a 10 tiles do armazem; o caminho que ele vai fazer
    const partida = { gx: armazem!.gx + 1, gy: armazem!.gy + 12 };
    const rota = armazemMaisProximo(vazio, partida, LADO_DO_JOGADOR, gameData);
    expect(rota, 'fixture: o caminho ate o armazem').not.toBeNull();
    const tileDoBloqueio = rota!.caminho[3]!;
    // quem espera: um serf do OUTRO lado, que nao tem armazem nenhum, parado no caminho
    expect(armazemMaisProximo(vazio, tileDoBloqueio, LADO_DA_IA, gameData), 'fixture: o lado da IA sem armazem').toBeNull();
    const us = [
      serf('w', LADO_DO_JOGADOR, partida, 'devolvendo', { carga: 'stone' }),
      serf('b', LADO_DA_IA, tileDoBloqueio, 'devolvendo', { carga: 'loaves' }),
    ];
    let s: GameState = { ...vazio, unidades: { porId: Object.fromEntries(us.map((u) => [u.id, u])), ordem: us.map((u) => u.id) } };
    const prazo = gameData.movimento.colisaoCivil.ticksPrazoDeProgresso;
    let maiorEspera = 0;
    let entregou = false;
    const violacoes: string[] = [];
    for (let t = 0; t < 2000 && !entregou; t++) {
      s = step(s, [], gameData);
      entregou = s.events.some((e) => e.type === 'cargo-returned' && e.unidade === 'w');
      maiorEspera = Math.max(maiorEspera, s.unidades.porId['w']?.fsmData.bloqueado ?? 0);
      if (t % 20 === 0) violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `t${s.tick}: ${v}`));
    }
    expect(entregou, 'o serf do jogador devolveu a carga').toBe(true);
    expect(maiorEspera).toBeLessThan(prazo);
    expect(violacoes).toEqual([]);
    const b = s.unidades.porId['b']!;
    expect(b.fsm).toBe('devolvendo');
    expect(b.fsmData.carga).toBe('loaves');
  });
});
