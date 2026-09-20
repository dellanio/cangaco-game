import { describe, it, expect } from 'vitest';
import type { Command } from '../src/sim/commands';
import { createRng, nextInt } from '../src/sim/rng';
import { tilesEntre } from '../src/input/arrasto';
import type { TileClicado } from '../src/input/colocar';
import { criarEntradaDoMapa } from '../src/input/colocar';
import { criarFerramenta } from '../src/input/ferramenta';
import { ligarTeclado } from '../src/input/teclado';

const t = (gx: number, gy: number): TileClicado => ({ gx, gy });

function orto(a: TileClicado, b: TileClicado): boolean {
  return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) === 1;
}

describe('F08 — tilesEntre: a linha 4-conectada que o arrasto preenche', () => {
  it('horizontal, vertical e um unico tile', () => {
    expect(tilesEntre(t(0, 0), t(3, 0))).toEqual([t(0, 0), t(1, 0), t(2, 0), t(3, 0)]);
    expect(tilesEntre(t(2, 5), t(2, 2))).toEqual([t(2, 5), t(2, 4), t(2, 3), t(2, 2)]);
    expect(tilesEntre(t(4, 4), t(4, 4))).toEqual([t(4, 4)]);
  });

  it('em diagonal sai uma escada de passos ortogonais, nunca um salto diagonal', () => {
    const caminho = tilesEntre(t(0, 0), t(3, 3));
    expect(caminho).toHaveLength(7);
    for (let i = 1; i < caminho.length; i++) expect(orto(caminho[i - 1] as TileClicado, caminho[i] as TileClicado)).toBe(true);
  });

  it('invariantes em 500 pares sorteados (RNG semeado): extremos, tamanho, ortogonal, sem repeticao', () => {
    let rng = createRng(20260921);
    for (let n = 0; n < 500; n++) {
      const p = [0, 0, 0, 0].map(() => {
        const passo = nextInt(rng, -30, 30);
        rng = passo.rng;
        return passo.value;
      }) as [number, number, number, number];
      const a = t(p[0], p[1]);
      const b = t(p[2], p[3]);
      const caminho = tilesEntre(a, b);
      expect(caminho[0]).toEqual(a);
      expect(caminho[caminho.length - 1]).toEqual(b);
      expect(caminho).toHaveLength(Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) + 1);
      for (let i = 1; i < caminho.length; i++) {
        expect(orto(caminho[i - 1] as TileClicado, caminho[i] as TileClicado)).toBe(true);
      }
      expect(new Set(caminho.map((c) => `${c.gx},${c.gy}`)).size).toBe(caminho.length);
    }
  });
});

describe('F08 — a Ferramenta ganha modos sem quebrar a API da F06/F07', () => {
  it('nasce em nenhum; selecionar(id) e o modo predio; estrada e demolicao tem modo proprio', () => {
    const f = criarFerramenta();
    expect(f.modo).toBe('nenhum');
    f.selecionar('quarry');
    expect([f.modo, f.predioAtivo]).toEqual(['predio', 'quarry']);
    f.selecionarEstrada();
    expect([f.modo, f.predioAtivo]).toEqual(['estrada', null]);
    f.selecionarDemolicao();
    expect([f.modo, f.predioAtivo]).toEqual(['demolir-estrada', null]);
    f.cancelar();
    expect([f.modo, f.predioAtivo]).toEqual(['nenhum', null]);
  });

  it('avisa a cada mudanca de modo ou de predio, e so entao', () => {
    const f = criarFerramenta();
    const avisos: string[] = [];
    f.aoMudar((predio, modo) => avisos.push(`${modo}:${predio ?? '-'}`));
    f.selecionarEstrada();
    f.selecionarEstrada();
    f.selecionar('quarry');
    f.selecionar('quarry');
    f.cancelar();
    f.cancelar();
    expect(avisos).toEqual(['estrada:-', 'predio:quarry', 'nenhum:-']);
  });
});

describe('F08 — o arrasto vira UM comando, ao soltar', () => {
  function montar(): {
    f: ReturnType<typeof criarFerramenta>;
    e: ReturnType<typeof criarEntradaDoMapa>;
    emitidos: Command[];
  } {
    const f = criarFerramenta();
    const emitidos: Command[] = [];
    const e = criarEntradaDoMapa(f, (c) => emitidos.push(c));
    return { f, e, emitidos };
  }

  it('estrada: pressionar, arrastar (com salto de varios tiles) e soltar emite PlaceRoad contiguo', () => {
    const { f, e, emitidos } = montar();
    f.selecionarEstrada();
    e.aoClicar(t(0, 0));
    e.aoArrastar(t(3, 0)); // o mouse "pulou" 3 tiles entre duas amostras
    e.aoArrastar(t(3, 2));
    expect(emitidos).toEqual([]); // enquanto arrasta, so ha previa
    e.aoSoltar(t(3, 2));
    expect(emitidos).toHaveLength(1);
    const comando = emitidos[0];
    if (comando?.type !== 'PlaceRoad') throw new Error('esperava PlaceRoad');
    expect(comando.tiles).toEqual([t(0, 0), t(1, 0), t(2, 0), t(3, 0), t(3, 1), t(3, 2)]);
  });

  it('soltar SEM mover emite uma estrada de um tile so', () => {
    const { f, e, emitidos } = montar();
    f.selecionarEstrada();
    e.aoClicar(t(5, 5));
    e.aoSoltar(t(5, 5));
    expect(emitidos).toEqual([{ type: 'PlaceRoad', tiles: [t(5, 5)] }]);
  });

  it('o tile do solto tambem conta, mesmo sem um aoArrastar final', () => {
    const { f, e, emitidos } = montar();
    f.selecionarEstrada();
    e.aoClicar(t(0, 0));
    e.aoSoltar(t(2, 0));
    expect(emitidos).toEqual([{ type: 'PlaceRoad', tiles: [t(0, 0), t(1, 0), t(2, 0)] }]);
  });

  it('voltar por cima do proprio caminho mantem os tiles repetidos: quem dedupe e a sim', () => {
    const { f, e, emitidos } = montar();
    f.selecionarEstrada();
    e.aoClicar(t(0, 0));
    e.aoArrastar(t(2, 0));
    e.aoSoltar(t(0, 0));
    const comando = emitidos[0];
    if (comando?.type !== 'PlaceRoad') throw new Error('esperava PlaceRoad');
    expect(comando.tiles).toHaveLength(5);
  });

  it('demolicao: o mesmo arrasto emite DemolishRoad', () => {
    const { f, e, emitidos } = montar();
    f.selecionarDemolicao();
    e.aoClicar(t(1, 1));
    e.aoArrastar(t(1, 3));
    e.aoSoltar(t(1, 3));
    expect(emitidos).toEqual([{ type: 'DemolishRoad', tiles: [t(1, 1), t(1, 2), t(1, 3)] }]);
  });

  it('trecho() mostra o que esta sendo arrastado e some ao terminar', () => {
    const { f, e } = montar();
    f.selecionarEstrada();
    expect(e.trecho()).toBeNull();
    e.aoClicar(t(0, 0));
    e.aoArrastar(t(2, 0));
    expect(e.trecho()).toEqual([t(0, 0), t(1, 0), t(2, 0)]);
    e.aoSoltar(t(2, 0));
    expect(e.trecho()).toBeNull();
  });
});

describe('F08 — cancelar o arrasto nao emite nada', () => {
  function armar(): { f: ReturnType<typeof criarFerramenta>; e: ReturnType<typeof criarEntradaDoMapa>; emitidos: Command[] } {
    const f = criarFerramenta();
    const emitidos: Command[] = [];
    const e = criarEntradaDoMapa(f, (c) => emitidos.push(c));
    f.selecionarEstrada();
    e.aoClicar(t(0, 0));
    e.aoArrastar(t(2, 0));
    return { f, e, emitidos };
  }

  it('sair do canvas com o botao apertado cancela (o mouseup que vier depois e ignorado)', () => {
    const { e, emitidos } = armar();
    e.aoSairDoMapa();
    expect(e.trecho()).toBeNull();
    e.aoSoltar(t(9, 9));
    expect(emitidos).toEqual([]);
  });

  it('Esc (cancelar a ferramenta) no meio do arrasto cancela', () => {
    const { f, e, emitidos } = armar();
    f.cancelar();
    expect(e.trecho()).toBeNull();
    e.aoSoltar(t(2, 0));
    expect(emitidos).toEqual([]);
  });

  it('trocar de ferramenta no meio do arrasto cancela', () => {
    const { f, e, emitidos } = armar();
    f.selecionarDemolicao();
    expect(e.trecho()).toBeNull();
    e.aoSoltar(t(2, 0));
    expect(emitidos).toEqual([]);
  });

  it('arrastar ou soltar sem ter pressionado e ignorado', () => {
    const f = criarFerramenta();
    const emitidos: Command[] = [];
    const e = criarEntradaDoMapa(f, (c) => emitidos.push(c));
    f.selecionarEstrada();
    e.aoArrastar(t(1, 1));
    e.aoSoltar(t(2, 2));
    expect(emitidos).toEqual([]);
    expect(e.trecho()).toBeNull();
  });
});

describe('F08 — o modo predio (F07) segue igual', () => {
  it('pressionar emite PlaceBlueprint; arrastar e soltar nao fazem nada', () => {
    const f = criarFerramenta();
    const emitidos: Command[] = [];
    const e = criarEntradaDoMapa(f, (c) => emitidos.push(c));
    f.selecionar('quarry');
    e.aoClicar(t(4, 4));
    e.aoArrastar(t(6, 4));
    e.aoSoltar(t(6, 4));
    expect(emitidos).toEqual([{ type: 'PlaceBlueprint', buildingId: 'quarry', gx: 4, gy: 4 }]);
    expect(e.trecho()).toBeNull();
  });

  it('sem ferramenta, nada emite', () => {
    const emitidos: Command[] = [];
    const e = criarEntradaDoMapa(criarFerramenta(), (c) => emitidos.push(c));
    e.aoClicar(t(1, 1));
    e.aoSoltar(t(1, 1));
    expect(emitidos).toEqual([]);
  });
});

describe('F08 — a tecla R escolhe a estrada (GDD §2.2)', () => {
  function teclar(alvo: EventTarget, propriedades: Record<string, unknown>): void {
    alvo.dispatchEvent(Object.assign(new Event('keydown'), propriedades));
  }

  it('r e R selecionam a estrada; Escape ainda cancela', () => {
    const alvo = new EventTarget();
    const f = criarFerramenta();
    ligarTeclado(f, alvo);
    teclar(alvo, { key: 'r' });
    expect(f.modo).toBe('estrada');
    teclar(alvo, { key: 'Escape' });
    expect(f.modo).toBe('nenhum');
    teclar(alvo, { key: 'R' });
    expect(f.modo).toBe('estrada');
  });

  it('com Ctrl, Meta ou Alt nao seleciona (Ctrl+R e recarregar a pagina)', () => {
    const alvo = new EventTarget();
    const f = criarFerramenta();
    ligarTeclado(f, alvo);
    for (const modificador of ['ctrlKey', 'metaKey', 'altKey']) {
      teclar(alvo, { key: 'r', [modificador]: true });
      expect(f.modo).toBe('nenhum');
    }
  });
});
