/**
 * D-TELA-03a / D-TELA-03b (Leva 1 da animacao direcional): a partida do roteiro
 * `tools/shots/D-TELA-03.js`. A oficina de armas tem machados na saida e nenhuma tabua na
 * entrada; o quartel, ligado a ela por rua, quer arma; o armazem nao tem machado, entao a arma do
 * quartel so pode sair da oficina (D-TRANSPORTE-03 T1, oficina -> quartel). E so a partida: a
 * regra de jogo nao muda, e o teste afirma pelo `step` que as duas cargas acontecem (a tabua para a
 * oficina e o machado para o quartel), para o roteiro nao esperar o que nunca chega.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, tilesDaPorta } from '../src/sim/estradas';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const QUARTEL = 'quartel';
const OFICINA = 'oficina';
const ARMA = 'hand_axe';
const MACHADOS = 3;
/** Teto de SEGURANCA, nao afirmacao de desempenho. */
const TETO = 3000;
/** O tick em que a partida e gravada: depois do assentamento dos comandos do tick 0. */
const TICKS_ANTES_DO_SAVE = 10;

const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string] as PredioCompleto;
const comPredio = (s: GameState, p: Predio): GameState =>
  ({ ...s, predios: { porId: { ...s.predios.porId, [p.id]: p }, ordem: s.predios.ordem.includes(p.id) ? s.predios.ordem : [...s.predios.ordem, p.id] } });

function lugarPara(s: GameState, tipo: string, raioMinimo: number): { gx: number; gy: number } {
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill'])] };
  for (let r = raioMinimo; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, tipo, p.gx, p.gy, gameData).ok) return p;
    }
  }
  throw new Error(`fixture: ${tipo} nao coube`);
}

function ligar(s: GameState, de: Predio, para: Predio): GameState {
  const porta = tilesDaPorta(de, gameData)[0] as { gx: number; gy: number };
  const caminho = buscarCaminho(s, porta, tilesDaPorta(para, gameData), 'livre', gameData);
  if (caminho === null) throw new Error(`fixture: sem rua de ${de.id} a ${para.id}`);
  return { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...caminho.tiles].map((t) => [chaveDeTile(t), true as const])) } };
}

/** A vila inicial com o quartel e a oficina de armas prontos, ligados por rua entre si e ao armazem. */
function vilaComOficina(): GameState {
  let s = createInitialState(1);
  const arm = armazemDe(s);
  const semArma = Object.fromEntries(Object.entries(arm.estoque.saida).filter(([m]) => m !== ARMA));
  s = comPredio(s, { ...arm, estoque: { ...arm.estoque, saida: semArma } } as PredioCompleto);
  const q = completarObra({ lado: LADO_DO_JOGADOR, id: QUARTEL, tipo: 'barracks', ...lugarPara(s, 'barracks', 8), estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = comPredio(s, { ...q, estoque: { ...q.estoque, entrada: {} }, recrutas: 0 });
  const o = completarObra({ lado: LADO_DO_JOGADOR, id: OFICINA, tipo: 'weapons_workshop', ...lugarPara(s, 'weapons_workshop', 6), estado: 'obra', hp: 350, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = comPredio(s, { ...o, estoque: { ...o.estoque, entrada: {}, saida: { [ARMA]: MACHADOS } } });
  s = ligar(s, s.predios.porId[OFICINA] as Predio, s.predios.porId[QUARTEL] as Predio);
  s = ligar(s, s.predios.porId[OFICINA] as Predio, armazemDe(s));
  return s;
}

const saidaDaOficina = (s: GameState): number => (s.predios.porId[OFICINA] as PredioCompleto).estoque.saida[ARMA] ?? 0;
const quemCarrega = (s: GameState, m: string): string[] =>
  s.unidades.ordem.filter((id) => s.unidades.porId[id]?.fsmData.carga === m);

describe('D-TELA-03 — a partida do roteiro da logistica', () => {
  it('a tabua chega a oficina e o machado sai dela para o quartel, pelo step', () => {
    let s = vilaComOficina();
    for (let t = 0; t < TICKS_ANTES_DO_SAVE; t += 1) s = step(s, [], gameData);
    const salvo = s;
    let primeiraTabua: number | null = null;
    let primeiroMachado: number | null = null;
    let saidaNaRetirada: number | null = null;
    for (let t = 0; t < TETO && (primeiraTabua === null || primeiroMachado === null); t += 1) {
      s = step(s, [], gameData);
      if (primeiraTabua === null && quemCarrega(s, 'timber').length > 0) primeiraTabua = s.tick;
      if (primeiroMachado === null && quemCarrega(s, ARMA).length > 0) {
        primeiroMachado = s.tick;
        saidaNaRetirada = saidaDaOficina(s);
      }
    }
    expect(saidaDaOficina(salvo)).toBe(MACHADOS);
    expect(primeiraTabua).not.toBeNull();
    expect(primeiroMachado).not.toBeNull();
    // a retirada tira o machado da saida da oficina, e nao do armazem (que nao tem nenhum)
    expect(saidaNaRetirada).toBe(MACHADOS - 1);

    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/D-TELA-03.save.txt`, salvar(salvo));
    const o = salvo.predios.porId[OFICINA] as PredioCompleto;
    gravarEvidencia('D-TELA-03-logistica', {
      tickDoSave: salvo.tick, oficina: { gx: o.gx, gy: o.gy }, primeiraTabua, primeiroMachado, saidaNaRetirada,
    });
  });
});
