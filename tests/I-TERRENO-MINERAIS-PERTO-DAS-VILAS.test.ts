import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { canPlace } from '../src/sim/placement';
import { canPlaceRoad } from '../src/sim/estradas';
import { tileAndavel } from '../src/sim/pathfinding';
import { comProdutorOcupado } from './helpers/producao-cenario';

interface Mapa {
  largura: number; altura: number; linhas: string[]; legenda: Record<string, string>;
  recursos: Record<string, [number, number][]>;
}
interface Jazida { tipo: string; gx: number; gy: number; largura: number; altura: number }
const publicado = JSON.parse(readFileSync('data/maps/sertao-128.json', 'utf8')) as Mapa;
const autoria = JSON.parse(execFileSync(process.execPath, ['-e',
  'const g=require("./tools/gerar-mapa.js");console.log(JSON.stringify({mapas:[g.montarArquivo(),g.montarArquivo()],config:require("./data/terrain.json").geracao.mineraisPertoDasVilas,vila:require("./data/escaramuca.json").predios.find(p=>p.id==="storehouse")}))',
], { encoding: 'utf8' })) as { mapas: Mapa[]; config: { raioMaximo: number; totais: Record<string, number>; jazidasDaAi: Jazida[] }; vila: { gx: number; gy: number } };
const deslocamento = gameData.mapa.largura - autoria.mapas[0]!.largura;
const { transladarMapa } = createRequire(import.meta.url)('../tools/transladar-mundo.js') as { transladarMapa: (m: Mapa, k: number) => Mapa };
// Estes testes afirmam passagem/mineracao; desligam clima no dado do teste,
// como I-CLIMA-ESTACAO, sem alterar as penalidades ou prazos do jogo.
const dados = { ...gameData, clima: { ...gameData.clima, ligado: false } };

describe('I-TERRENO-MINERAIS-PERTO-DAS-VILAS — geografia autoral e passagem', () => {
  it('autoria deterministica, mapa publicado exato, totais e rendimentos intactos', () => {
    expect(autoria.mapas[0]).toEqual(autoria.mapas[1]);
    expect(publicado).toEqual(transladarMapa(autoria.mapas[0]!, deslocamento));
    for (const [tipo, total] of Object.entries(autoria.config.totais)) expect(publicado.recursos[tipo]).toHaveLength(total);
    expect(gameData.recursos.tipos.coal!.rendimentoPorTile).toBe(15);
    expect(gameData.recursos.tipos.iron_ore!.rendimentoPorTile).toBe(12);
    expect(gameData.recursos.tipos.gold_ore!.rendimentoPorTile).toBe(8);
  });
  it('ouro/ferro/carvao perto das duas vilas, sem invadir lotes iniciais', () => {
    const jogador = gameData.economia.estadoInicial.predios.find(p => p.id === 'storehouse')!;
    const ai = { gx: autoria.vila.gx + deslocamento, gy: autoria.vila.gy + deslocamento };
    const s = createInitialState(1, dados);
    for (const vila of [jogador, ai]) for (const tipo of Object.keys(autoria.config.totais)) {
      const distancias = publicado.recursos[tipo]!.map(([x, y]) => Math.max(Math.abs(x - vila.gx), Math.abs(y - vila.gy)));
      expect(Math.min(...distancias)).toBeLessThanOrEqual(autoria.config.raioMaximo);
    }
    const ocupados = new Set<string>();
    for (const p of [...gameData.economia.estadoInicial.predios, ...gameData.escaramuca.predios]) {
      const def = gameData.predios.find(d => d.id === p.id)!;
      const [largura, altura] = def.tamanho;
      if (largura === undefined || altura === undefined) throw new Error(`Footprint incompleto: ${p.id}`);
      for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) ocupados.add(`${p.gx + x},${p.gy + y}`);
      for (let x = 0; x < largura; x++) ocupados.add(`${p.gx + x},${p.gy + altura}`);
    }
    for (const tipo of Object.keys(autoria.config.totais)) for (const [x, y] of publicado.recursos[tipo]!) {
      expect(ocupados.has(`${x},${y}`)).toBe(false);
      expect(tileAndavel(s, { gx: x, gy: y }, 'livre', dados)).toBe(tipo === 'coal');
    }
  });
  it('soldado atravessa o veio do oeste e para sobre carvao pelo step', () => {
    let s = createInitialState(1, dados);
    const tiles = publicado.recursos.coal!.filter(([x]) => x === 13 + deslocamento).sort((a, b) => a[1] - b[1]);
    expect(tiles).toHaveLength(3);
    const [x, y] = tiles[0]!;
    const soldado: Unidade = { id: 'travessia-carvao', lado: LADO_DO_JOGADOR, tipo: 'militia', gx: x, gy: y - 1, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia', dados) };
    s = { ...s, unidades: { porId: { [soldado.id]: soldado }, ordem: [soldado.id] } };
    const destino = { gx: x, gy: tiles[2]![1] };
    s = step(s, [{ type: 'MoveUnits', unidades: [soldado.id], destino }], dados);
    expect(s.events.some(e => e.type === 'command-rejected')).toBe(false);
    const visitados = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const u = s.unidades.porId[soldado.id]!; visitados.add(`${u.gx},${u.gy}`);
      if (u.gx === destino.gx && u.gy === destino.gy && u.fsm === 'ocioso') break;
      s = step(s, [], dados);
    }
    for (const [gx, gy] of tiles) expect(visitados.has(`${gx},${gy}`)).toBe(true);
    expect(s.unidades.porId[soldado.id]).toMatchObject({ ...destino, fsm: 'ocioso' });
  });
  it('carvao ativo recusa rua e predio pelo step, sem afetar passagem', () => {
    let s = createInitialState(1, dados);
    s = { ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'sawmill'] };
    for (const [gx, gy] of publicado.recursos.coal!) {
      expect(tileAndavel(s, { gx, gy }, 'livre', dados)).toBe(true);
      expect(canPlaceRoad(s, [{ gx, gy }], dados).ok).toBe(false);
      expect(canPlace(s, 'coal_mine', gx, gy, dados).ok).toBe(false);
      const r = step(s, [{ type: 'PlaceRoad', tiles: [{ gx, gy }] }, { type: 'PlaceBlueprint', buildingId: 'coal_mine', gx, gy }], dados);
      expect(r.events.filter(e => e.type === 'command-rejected')).toHaveLength(2);
      expect(r.estradasPlanejadas[`${gx},${gy}`]).toBeUndefined();
    }
  });
  it('minas cabem e extraem as novas jazidas perto da AI pelo step', () => {
    let s = createInitialState(1, dados);
    s = { ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'sawmill'] };
    const opcoes = [
      { tipo: 'gold_mine', id: 'nova-ouro', unidade: 'mineiro-ouro', gx: 61 + deslocamento, gy: 83 + deslocamento, recurso: 'gold_ore' },
      { tipo: 'iron_mine', id: 'nova-ferro', unidade: 'mineiro-ferro', gx: 67 + deslocamento, gy: 83 + deslocamento, recurso: 'iron_ore' },
      { tipo: 'coal_mine', id: 'nova-carvao', unidade: 'mineiro-carvao', gx: 72 + deslocamento, gy: 84 + deslocamento, recurso: 'coal' },
    ];
    for (const m of opcoes) { expect(canPlace(s, m.tipo, m.gx, m.gy, dados)).toEqual({ ok: true }); s = comProdutorOcupado(s, m, dados); }
    for (let i = 0; i < 3000; i++) s = step(s, [], dados);
    for (const m of opcoes) {
      const p = s.predios.porId[m.id]!;
      expect(p.estado).toBe('completo');
      if (p.estado === 'completo') expect(p.estoque.saida[m.recurso] ?? 0).toBeGreaterThan(0);
    }
  });
});
