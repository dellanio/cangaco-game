/**
 * I-COMBATE-CAMPANHA-JOGADA (BUILD_PLAN.md) — os dois jogadores automaticos da campanha.
 *
 * Eles so dao ordens de exercito, os mesmos comandos do mouse (`AttackBuilding`, `AttackUnit`,
 * `MoveUnits`): nao ha jogador de economia automatico. O `passivo` nao da ordem nenhuma. O `ataque`,
 * a cada `CADA_TICKS`, da uma ordem a todo militar OCIOSO do jogador, conforme o objetivo da fase:
 *  - destruir predios: `AttackBuilding` no predio inimigo mais perto do grupo;
 *  - destruir tropas, ou inimigo a ate `RAIO_DE_REACAO` de um militar: `AttackUnit` no mais perto;
 *  - capturar: ataca a escolta perto do alvo; sem escolta, marcha para o lado do alvo;
 *  - defender (sobreviver, manter, proteger): so o inimigo a ate `RAIO_DE_REACAO` de um predio nosso.
 *
 * Estes numeros sao do JOGADOR de teste, nao do jogo: nao entram em `data/`.
 */
import type { Command } from '../../src/sim/commands';
import type { GameData } from '../../src/sim/data/types';
import type { GameState, Predio, Unidade } from '../../src/sim/state';
import { LADO_DO_JOGADOR } from '../../src/sim/state';
import { classeDaUnidade, condicaoCheiaDoTipo } from '../../src/sim/condicao';
import { ehADistancia } from '../../src/sim/combate';
import { predioNaVista, unidadeNaVista } from '../../src/sim/nevoa';
import { tilesDaPorta } from '../../src/sim/estradas';
import { tileAndavel } from '../../src/sim/pathfinding';
import { faseDaCampanha, tilesParaNascer } from '../../src/sim/fase';
import { step } from '../../src/sim/tick';
import { resultadoDaFase } from '../../src/sim/systems/fase';

export type Jogador = 'passivo' | 'ataque' | 'reforco';

/** De quantos em quantos ticks o `ataque` olha o exercito (2 s a 10 Hz). */
export const CADA_TICKS = 20;
/** O inimigo a ate esta distancia de um militar (ou de um predio, na defesa) e atacado. */
export const RAIO_DE_REACAO = 12;
/** Na defesa, a tropa ociosa mais longe que isto do predio protegido volta para ele. */
export const RAIO_DE_GUARDA = 6;

const cheb = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number =>
  Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

const vivas = (s: GameState): Unidade[] =>
  s.unidades.ordem.map((id) => s.unidades.porId[id]).filter((u): u is Unidade => u !== undefined);

const predios = (s: GameState): Predio[] =>
  s.predios.ordem.map((id) => s.predios.porId[id]).filter((p): p is Predio => p !== undefined);

export const militares = (s: GameState, dados: GameData, lado?: number): Unidade[] =>
  vivas(s).filter((u) => classeDaUnidade(u.tipo, dados) === 'militar'
    && (lado === undefined ? u.lado !== LADO_DO_JOGADOR : u.lado === lado));

function maisPerto<T extends { gx: number; gy: number }>(de: { gx: number; gy: number }, lista: readonly T[]): T | undefined {
  let melhor: T | undefined;
  let d = Infinity;
  for (const x of lista) {
    const dx = cheb(de, x);
    if (dx < d) { d = dx; melhor = x; }
  }
  return melhor;
}

function centro(us: readonly Unidade[]): { gx: number; gy: number } {
  const n = us.length;
  return {
    gx: Math.round(us.reduce((a, u) => a + u.gx, 0) / n),
    gy: Math.round(us.reduce((a, u) => a + u.gy, 0) / n),
  };
}

/** Atacar a unidade `alvo` como o clique do jogador (`src/ui/ordem-militar.ts`): o corpo a corpo recebe
 *  `AttackUnit` (a sim recusa o atirador nele) e o atirador marcha ate o alvo e atira sozinho. */
function atacarUnidade(s: GameState, ids: readonly string[], alvo: Unidade, dados: GameData): Command[] {
  const tipo = (id: string): string => s.unidades.porId[id]?.tipo ?? '';
  const perto = ids.filter((id) => !ehADistancia(tipo(id), dados));
  const longe = ids.filter((id) => ehADistancia(tipo(id), dados));
  if (!unidadeNaVista(s, alvo.id, dados)) return [{ type: 'MoveUnits', unidades: ids, destino: { gx: alvo.gx, gy: alvo.gy } }];
  const cmds: Command[] = [];
  if (perto.length > 0) cmds.push({ type: 'AttackUnit', unidades: perto, alvo: alvo.id });
  if (longe.length > 0) cmds.push({ type: 'MoveUnits', unidades: longe, destino: { gx: alvo.gx, gy: alvo.gy } });
  return cmds;
}

/** Atacar o predio como o clique do jogador: na vista, `AttackBuilding`; fora dela (a nevoa), a marcha
 *  ate a porta andavel mais perto do grupo (`destinoDaMarcha`, `src/ui/ordem-militar.ts`). */
function atacarPredio(s: GameState, ids: readonly string[], alvo: Predio, de: { gx: number; gy: number }, dados: GameData): Command[] {
  if (predioNaVista(s, alvo.id, dados)) return [{ type: 'AttackBuilding', unidades: ids, predio: alvo.id }];
  const portas = tilesDaPorta(alvo, dados).filter((t) => tileAndavel(s, t, 'livre', dados));
  const porta = maisPerto(de, portas);
  return porta === undefined ? [] : [{ type: 'MoveUnits', unidades: ids, destino: { gx: porta.gx, gy: porta.gy } }];
}

/** As ordens do jogador `ataque` neste estado (vazio fora do tick de olhar). */
export function ordensDoAtaque(s: GameState, dados: GameData): Command[] {
  if (s.fase === undefined || s.tick % CADA_TICKS !== 0) return [];
  const fase = faseDaCampanha(s.fase.id, dados);
  const meus = militares(s, dados, LADO_DO_JOGADOR);
  const ociosos = meus.filter((u) => u.fsm === 'ocioso');
  if (ociosos.length === 0) return [];
  // emenda 1: nunca a unidade que a fase manda capturar, nem o predio que a derrota manda proteger
  const capturados = fase.objetivos.vitoria.filter((o) => o.tipo === 'capturar');
  const ehCapturado = (u: Unidade): boolean => capturados.some((o) => u.lado === o.lado && u.tipo === o.unidade);
  const protegidos = fase.objetivos.derrota.filter((o) => o.tipo === 'proteger' && o.lado !== LADO_DO_JOGADOR);
  const ehProtegido = (p: Predio): boolean => protegidos.some((o) => p.lado === o.lado && (o.predios ?? []).includes(p.tipo));
  const inimigos = militares(s, dados).filter((u) => !ehCapturado(u));
  const nossosPredios = predios(s).filter((p) => p.lado === LADO_DO_JOGADOR);
  const deles = predios(s).filter((p) => p.lado !== LADO_DO_JOGADOR && !ehProtegido(p));
  // emenda 1: o primeiro objetivo de vitoria ainda nao cumprido
  const cumprido = (o: (typeof fase.objetivos.vitoria)[number]): boolean => {
    if (o.tipo !== 'destruir') return false;
    if (o.predios !== undefined) return !deles.some((p) => p.lado === o.lado && o.predios?.includes(p.tipo));
    if (o.alvo === 'tropas') return !inimigos.some((u) => u.lado === o.lado);
    return !deles.some((p) => p.lado === o.lado);
  };
  const v = fase.objetivos.vitoria.find((o) => !cumprido(o)) ?? fase.objetivos.vitoria[0];
  const ids = ociosos.map((u) => u.id);
  const c = centro(ociosos);

  const defesa = v === undefined || v.tipo === 'sobreviver' || v.tipo === 'manter';
  if (defesa) {
    const perto = inimigos.filter((e) => nossosPredios.some((p) => cheb(p, e) <= RAIO_DE_REACAO)
      || meus.some((m) => cheb(m, e) <= RAIO_DE_REACAO));
    const alvo = maisPerto(c, perto);
    if (alvo !== undefined) return atacarUnidade(s, ids, alvo, dados);
    // sem ameaca: a tropa guarda o predio que a fase manda proteger (ou manter)
    const guardar = [...fase.objetivos.derrota, ...fase.objetivos.vitoria]
      .filter((o) => (o.tipo === 'proteger' || o.tipo === 'manter') && (o.lado ?? LADO_DO_JOGADOR) === LADO_DO_JOGADOR)
      .flatMap((o) => o.predios ?? []);
    const casa = nossosPredios.find((p) => guardar.includes(p.tipo));
    if (casa === undefined) return [];
    const longe = ociosos.filter((u) => cheb(u, casa) > RAIO_DE_GUARDA).map((u) => u.id);
    const portas = tilesDaPorta(casa, dados).filter((t) => tileAndavel(s, t, 'livre', dados));
    const porta = maisPerto(c, portas);
    return longe.length === 0 || porta === undefined ? [] : [{ type: 'MoveUnits', unidades: longe, destino: { gx: porta.gx, gy: porta.gy } }];
  }

  if (v.tipo === 'capturar') {
    const preso = vivas(s).find((u) => u.lado === v.lado && u.tipo === v.unidade);
    if (preso === undefined) return [];
    const escolta = inimigos.filter((e) => cheb(e, preso) <= RAIO_DE_REACAO);
    const alvo = maisPerto(c, escolta.length > 0 ? escolta : inimigos.filter((e) => ociosos.some((m) => cheb(m, e) <= RAIO_DE_REACAO)));
    if (alvo !== undefined) return atacarUnidade(s, ids, alvo, dados);
    return [{ type: 'MoveUnits', unidades: ids, destino: { gx: preso.gx, gy: preso.gy + 1 } }];
  }

  const ameaca = maisPerto(c, inimigos.filter((e) => ociosos.some((m) => cheb(m, e) <= RAIO_DE_REACAO)));
  if (ameaca !== undefined) return atacarUnidade(s, ids, ameaca, dados);
  if (v.tipo === 'destruir' && v.alvo === 'tropas') {
    const alvo = maisPerto(c, inimigos);
    return alvo === undefined ? [] : atacarUnidade(s, ids, alvo, dados);
  }
  const alvosDePredio = v.predios !== undefined ? deles.filter((p) => v.predios?.includes(p.tipo)) : deles;
  const alvo = maisPerto(c, alvosDePredio);
  if (alvo !== undefined) return atacarPredio(s, ids, alvo, c, dados);
  const resto = maisPerto(c, inimigos);
  return resto === undefined ? [] : atacarUnidade(s, ids, resto, dados);
}

/** Emenda 1 — o `reforco`: cada militar do jogador ganha um igual, nascido ao lado (o tile livre mais
 *  perto). Medida da ferramenta, o que a economia daria; a fase de verdade nao da reforco. */
export function comReforco(s: GameState, dados: GameData): GameState {
  const ocupado = new Set(vivas(s).map((u) => `${u.gx},${u.gy}`));
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  let n = s.proximoId;
  for (const u of militares(s, dados, LADO_DO_JOGADOR)) {
    const [t] = tilesParaNascer(s, u.gx, u.gy, 1, ocupado, dados);
    if (t === undefined) continue;
    const id = `u${n++}`;
    porId[id] = { id, lado: u.lado, tipo: u.tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(u.tipo, dados) };
    ordem.push(id);
  }
  return { ...s, proximoId: n, unidades: { porId, ordem } };
}

export interface CorridaDaFase {
  readonly fase: string;
  readonly jogador: Jogador;
  readonly resultado: 'vitoria' | 'derrota' | 'em-curso';
  readonly tick: number;
  readonly segundosDeJogo: number;
  readonly militaresDoJogador: number;
  readonly militaresInimigos: number;
  readonly prediosInimigos: number;
  readonly ondasDisparadas: number;
  readonly ordens: number;
  readonly recusas: Record<string, number>;
}

/** Joga `ticks` ticks de `s` com o `jogador`; para no fim da fase. */
export function jogar(s0: GameState, jogador: Jogador, ticks: number, dados: GameData): { estado: GameState; corrida: CorridaDaFase } {
  let s = jogador === 'reforco' ? comReforco(s0, dados) : s0;
  let ordens = 0;
  const recusas: Record<string, number> = {};
  for (let i = 0; i < ticks; i++) {
    const cmds = jogador === 'passivo' ? [] : ordensDoAtaque(s, dados);
    ordens += cmds.length;
    s = step(s, cmds, dados);
    for (const e of s.events) {
      if (e.type === 'command-rejected') {
        const chave = `${e.command}:${String((e as { motivo?: unknown }).motivo)}`;
        recusas[chave] = (recusas[chave] ?? 0) + 1;
      }
    }
    if (s.partida !== undefined) break;
  }
  const fim = s.partida?.fim ?? resultadoDaFase(s, dados, s.tick);
  return {
    estado: s,
    corrida: {
      fase: s.fase?.id ?? '?',
      jogador,
      resultado: fim ?? 'em-curso',
      tick: s.tick - (s.fase?.inicio ?? 0),
      segundosDeJogo: Math.round((s.tick - (s.fase?.inicio ?? 0)) / 10),
      militaresDoJogador: militares(s, dados, LADO_DO_JOGADOR).length,
      militaresInimigos: militares(s, dados).length,
      prediosInimigos: predios(s).filter((p) => p.lado !== LADO_DO_JOGADOR).length,
      ondasDisparadas: s.fase?.ondasDisparadas ?? 0,
      ordens,
      recusas,
    },
  };
}
