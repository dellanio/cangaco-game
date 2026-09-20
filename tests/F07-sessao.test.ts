import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { criarSessao } from '../src/sessao';
import { criarFerramenta } from '../src/input/ferramenta';
import { criarEntradaDoMapa } from '../src/input/colocar';

function colocar(buildingId: string, gx: number, gy: number): Command {
  return { type: 'PlaceBlueprint', buildingId, gx, gy };
}

function contarObras(estado: GameState): number {
  return estado.predios.ordem.filter((id) => estado.predios.porId[id]?.estado === 'obra').length;
}

describe('F07 — a Sessao: dona do GameState e da fila de comandos', () => {
  it('nasce com o estado que recebeu', () => {
    const inicial = createInitialState(1);
    expect(criarSessao(inicial).estado).toBe(inicial);
  });

  it('enviar so ENFILEIRA: o estado e o tick nao mudam ate o passo()', () => {
    const inicial = createInitialState(1);
    const sessao = criarSessao(inicial);
    sessao.enviar(colocar('quarry', 0, 0));
    expect(sessao.estado).toBe(inicial);
    expect(sessao.estado.tick).toBe(0);
  });

  it('passo() drena a fila, roda um step e o estado novo tem a obra', () => {
    const sessao = criarSessao(createInitialState(1));
    sessao.enviar(colocar('quarry', 0, 0));
    const depois = sessao.passo();
    expect(depois).toBe(sessao.estado);
    expect(depois.tick).toBe(1);
    expect(contarObras(depois)).toBe(1);
  });

  it('a fila esvazia: um segundo passo() avanca o tempo sem repetir o comando', () => {
    const sessao = criarSessao(createInitialState(1));
    sessao.enviar(colocar('quarry', 0, 0));
    sessao.passo();
    const depois = sessao.passo();
    expect(depois.tick).toBe(2);
    expect(contarObras(depois)).toBe(1);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('varios comandos enfileirados rodam EM ORDEM no mesmo tick', () => {
    const sessao = criarSessao(createInitialState(1));
    sessao.enviar(colocar('quarry', 0, 0));
    sessao.enviar(colocar('quarry', 0, 0)); // o segundo ve a obra do primeiro
    const depois = sessao.passo();
    expect(depois.tick).toBe(1);
    expect(contarObras(depois)).toBe(1);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toHaveLength(1);
  });

  it('aoMudar recebe o estado novo a cada passo(); enviar nao dispara; desinscrever para', () => {
    const sessao = criarSessao(createInitialState(1));
    const vistos: GameState[] = [];
    const desinscrever = sessao.aoMudar((e) => vistos.push(e));
    sessao.enviar(colocar('quarry', 0, 0));
    expect(vistos).toHaveLength(0);
    const depois = sessao.passo();
    expect(vistos).toEqual([depois]);
    desinscrever();
    sessao.passo();
    expect(vistos).toHaveLength(1);
  });

  it('a fila NAO entra no GameState: as chaves do estado sao as de sempre', () => {
    const sessao = criarSessao(createInitialState(1));
    sessao.enviar(colocar('quarry', 0, 0));
    expect(Object.keys(sessao.passo()).sort()).toEqual(Object.keys(createInitialState(1)).sort());
  });

  it('a mesma sequencia de comandos, em duas sessoes, da o mesmo estado byte a byte', () => {
    const rodar = (): string => {
      const sessao = criarSessao(createInitialState(1));
      sessao.enviar(colocar('quarry', 0, 0));
      sessao.passo();
      sessao.enviar(colocar('woodcutters', 10, 10));
      sessao.passo();
      sessao.passo();
      return JSON.stringify(sessao.estado);
    };
    expect(rodar()).toBe(rodar());
  });
});

describe('F07 — clique no mapa vira comando (input/colocar.ts)', () => {
  it('sem ferramenta ativa, clicar nao emite nada', () => {
    const emitidos: Command[] = [];
    const entrada = criarEntradaDoMapa(criarFerramenta(), (c) => emitidos.push(c));
    entrada.aoClicar({ gx: 5, gy: 6 });
    expect(emitidos).toEqual([]);
  });

  it('com ferramenta ativa, emite PlaceBlueprint com o predio e o tile clicado', () => {
    const ferramenta = criarFerramenta();
    const emitidos: Command[] = [];
    const entrada = criarEntradaDoMapa(ferramenta, (c) => emitidos.push(c));
    ferramenta.selecionar('quarry');
    entrada.aoClicar({ gx: 5, gy: 6 });
    expect(emitidos).toEqual([{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 5, gy: 6 }]);
  });

  it('a ferramenta SEGUE ativa depois do clique (planta varios em sequencia); Esc encerra', () => {
    const ferramenta = criarFerramenta();
    const emitidos: Command[] = [];
    const entrada = criarEntradaDoMapa(ferramenta, (c) => emitidos.push(c));
    ferramenta.selecionar('quarry');
    entrada.aoClicar({ gx: 0, gy: 0 });
    entrada.aoClicar({ gx: 3, gy: 0 });
    expect(ferramenta.predioAtivo).toBe('quarry');
    expect(emitidos).toHaveLength(2);
    ferramenta.cancelar();
    entrada.aoClicar({ gx: 6, gy: 0 });
    expect(emitidos).toHaveLength(2);
  });

  it('emite MESMO sobre um lugar que a sim vai recusar: a decisao e da sim, nao do clique', () => {
    const ferramenta = criarFerramenta();
    const emitidos: Command[] = [];
    const entrada = criarEntradaDoMapa(ferramenta, (c) => emitidos.push(c));
    ferramenta.selecionar('sawmill'); // bloqueada no estado inicial
    entrada.aoClicar({ gx: 0, gy: 0 });
    expect(emitidos).toHaveLength(1);
  });
});

describe('F07 — do clique ao estado, sem tela (ferramenta + entrada + sessao)', () => {
  function montar(): { sessao: ReturnType<typeof criarSessao>; ferramenta: ReturnType<typeof criarFerramenta>; clicar: (gx: number, gy: number) => void } {
    const sessao = criarSessao(createInitialState(1));
    const ferramenta = criarFerramenta();
    // a mesma ligacao de main.ts: emitir = enfileirar e rodar um passo
    const entrada = criarEntradaDoMapa(ferramenta, (c) => { sessao.enviar(c); sessao.passo(); });
    return { sessao, ferramenta, clicar: (gx, gy) => entrada.aoClicar({ gx, gy }) };
  }

  it('um clique planta a obra; um segundo clique no mesmo tile e rejeitado', () => {
    const { sessao, ferramenta, clicar } = montar();
    ferramenta.selecionar('quarry');
    clicar(0, 0);
    expect(contarObras(sessao.estado)).toBe(1);
    clicar(0, 0);
    expect(contarObras(sessao.estado)).toBe(1);
    expect(sessao.estado.events.filter((e) => e.type === 'command-rejected')).toHaveLength(1);
  });

  it('dois cliques em tiles diferentes plantam duas obras, com a ferramenta ainda ativa', () => {
    const { sessao, ferramenta, clicar } = montar();
    ferramenta.selecionar('quarry');
    clicar(0, 0);
    clicar(3, 0);
    expect(contarObras(sessao.estado)).toBe(2);
    expect(ferramenta.predioAtivo).toBe('quarry');
  });
});

// --- guardas estruturais (por import) ---

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivosTs(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

function importa(arquivo: string, alvo: RegExp): boolean {
  return alvo.test(readFileSync(arquivo, 'utf-8'));
}

describe('F07 — guardas estruturais da Sessao', () => {
  it('src/sessao.ts nao importa phaser, render/ nem ui/: e o laco externo, sem tela', () => {
    for (const alvo of [/from\s+['"]phaser['"]/, /from\s+['"]\.\/render\//, /from\s+['"]\.\/ui\//]) {
      expect(importa('src/sessao.ts', alvo), String(alvo)).toBe(false);
    }
  });

  it('src/input/ continua sem importar phaser, sim/data nem sim/state (agora com colocar.ts)', () => {
    for (const arquivo of arquivosTs('src/input')) {
      for (const alvo of [/from\s+['"]phaser['"]/, /from\s+['"].*sim\/data['"]/, /from\s+['"].*sim\/state['"]/]) {
        expect(importa(arquivo, alvo), `${arquivo} ${String(alvo)}`).toBe(false);
      }
    }
  });
});
