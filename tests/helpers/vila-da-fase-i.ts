/**
 * Fase I — fixtures de vila para os testes da tela (I-TELA-PARTIDA-GUIADA, I-TELA-DICAS-NA-PRIMEIRA-VEZ):
 * achar o predio, pôr casa pronta ou em obra, achar lugar que o `canPlace` aceita e a rua do A* do
 * jogo ate a rede do armazem. Nada aqui afirma: quem afirma e o teste.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import { completarObra, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../../src/sim/state';
import type { GameState, Predio } from '../../src/sim/state';
import { canPlace } from '../../src/sim/placement';
import { buscarCaminho } from '../../src/sim/pathfinding';
import { canPlaceRoad, chaveDeTile, tilesDaPorta } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';
import { caixaDeTipo } from '../../src/sim/footprint';
import { naVila } from './ancoras';

export const predioDoTipo = (s: GameState, tipo: string, lado = LADO_DO_JOGADOR): Predio | undefined =>
  s.predios.ordem.map((id) => s.predios.porId[id]).find((p) => p?.tipo === tipo && p.lado === lado);

/** A rua da porta do predio ate a rede do armazem (estrada, canteiro ou a porta do armazem). */
export function ruaAteARede(s: GameState, p: Predio, dados: GameData = gameData): TileDeGrid[] | null {
  const armazem = predioDoTipo(s, ID_DO_ARMAZEM);
  if (armazem === undefined) return null;
  const rede = [...Object.keys(s.estradas), ...Object.keys(s.estradasPlanejadas)].map((k) => {
    const [gx, gy] = k.split(',').map(Number) as [number, number];
    return { gx, gy };
  });
  const alvos = [...tilesDaPorta(armazem, dados), ...rede];
  // o A* a pe passa por cima de recurso que nao bloqueia o passo, e a estrada nao: o jogador
  // desvia dele, e aqui o desvio e um custo alto no tile de recurso
  const largura = dados.terreno.mapaPadrao.largura;
  const desvio = new Map(Object.keys(s.recursos).map((k) => {
    const [gx, gy] = k.split(',').map(Number) as [number, number];
    return [gy * largura + gx, 1_000] as const;
  }));
  for (const porta of tilesDaPorta(p, dados)) {
    const caminho = buscarCaminho(s, porta, alvos, 'livre', dados, desvio);
    if (caminho === null) continue;
    const ja = (t: TileDeGrid): boolean => s.estradas[chaveDeTile(t)] !== undefined || s.estradasPlanejadas[chaveDeTile(t)] !== undefined;
    const tiles = [porta, ...caminho.tiles].filter((t, i, todos) => !ja(t) && todos.findIndex((u) => u.gx === t.gx && u.gy === t.gy) === i);
    if (canPlaceRoad(s, tiles, dados).ok) return tiles;
  }
  return null;
}

export function comRua(s: GameState, p: Predio, onde: 'estradas' | 'estradasPlanejadas'): GameState {
  const tiles = ruaAteARede(s, p);
  if (tiles === null) throw new Error(`fixture: sem rua de '${p.id}'`);
  return { ...s, [onde]: { ...s[onde], ...Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const])) } };
}

export function comPredio(s: GameState, tipo: string, onde: TileDeGrid, estado: 'completo' | 'obra' = 'completo', lado = LADO_DO_JOGADOR): GameState {
  const def = gameData.predios.find((x) => x.id === tipo);
  if (def === undefined) throw new Error(`fixture: '${tipo}' nao existe`);
  const id = `${tipo}-${lado}-${s.predios.ordem.length}`;
  const obra = { lado, id, tipo, ...onde, estado: 'obra' as const, hp: estado === 'obra' ? 0 : def.hp, obra: { faltam: {}, nivelamento: 0 } };
  const p = estado === 'obra' ? obra : completarObra(obra, gameData);
  return { ...s, predios: { porId: { ...s.predios.porId, [id]: p }, ordem: [...s.predios.ordem, id] } };
}

/** O footprint com um tile de folga nao cobre recurso, estrada nem canteiro. */
export function livreEmVolta(s: GameState, tipo: string, gx: number, gy: number): boolean {
  const caixa = caixaDeTipo(tipo, gx, gy, gameData);
  if (caixa === null) return false;
  for (let y = caixa.y0 - 1; y <= caixa.y1; y += 1) {
    for (let x = caixa.x0 - 1; x <= caixa.x1; x += 1) {
      const k = chaveDeTile({ gx: x, gy: y });
      if (s.recursos[k] !== undefined || s.estradas[k] !== undefined || s.estradasPlanejadas[k] !== undefined) return false;
    }
  }
  return true;
}

/** O primeiro lugar, em aneis em volta da vila, que o `canPlace` do jogo aceita AGORA (sem
 *  destravar nada: e o que o jogador pode fazer neste instante) e que deixa uma rua ate a rede. */
export function lugarPara(s: GameState, tipo: string): TileDeGrid | null {
  for (let r = 4; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      for (const p of [naVila(d, r), naVila(d, -r), naVila(r, d), naVila(-r, d)]) {
        if (!canPlace(s, tipo, p.gx, p.gy, gameData).ok || !livreEmVolta(s, tipo, p.gx, p.gy)) continue;
        const sonda = comPredio(s, tipo, p, 'obra');
        const nova = sonda.predios.porId[sonda.predios.ordem[sonda.predios.ordem.length - 1] as string] as Predio;
        if (ruaAteARede(sonda, nova) !== null) return p;
      }
    }
  }
  return null;
}

