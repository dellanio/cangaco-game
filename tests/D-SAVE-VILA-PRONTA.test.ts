/**
 * D-SAVE-VILA-PRONTA — o save de teste do operador (pedido de 2026-10-01): uma partida em que ja existem, ligados por
 * estrada ao armazem, pedreira, lenhador, serraria, roca de milho e canavial, moinho, padaria,
 * Bodega, casa de armas e quartel, com recrutas no quartel e tabua na entrada da casa de armas. O
 * inimigo e o do estado inicial (a IA nasce com ele).
 *
 * Montagem: o MESMO caminho dos cenarios de teste (`producao-cenario.ts`). O predio nasce por
 * `completarObra`, o ocupante e posto na porta, e a estrada entra direto no estado. Depois roda
 * `step`, para a partida assentar. Nada em `src/sim/` nem em `data/` muda: o save sai do `salvar`
 * do jogo e e lido pelo `carregar` do jogo.
 *
 * O arquivo versionado e `saves/teste-operador-vila-pronta.txt`. O teste o refaz e afirma que ele
 * e byte a byte o que a montagem gera; o aceite roda A PARTIR DO ARQUIVO versionado.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, ID_DO_ARMAZEM, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import { criarEscaramuca } from '../src/sim/cenario';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { buscarCaminho } from '../src/sim/pathfinding';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../src/sim/estradas';
import { caixaDeTipo } from '../src/sim/footprint';
import { receitaDoTipo } from '../src/sim/producao';
import { tilesDeColheita } from '../src/sim/recursos';
import { carregar, salvar } from '../src/sim/save';
import { alertasDoEstado } from '../src/sim/selectors';
import { comProdutorOcupado, pedreiraDaVila } from './helpers/producao-cenario';
import { aberturaDaFaseA } from './helpers/abertura';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const ARQUIVO = 'saves/teste-operador-vila-pronta.txt';
const QUARTEL = 'quartel';
const CASA_DE_ARMAS = 'casa-de-armas';
/** Da fixture, nao do balanceamento: quantos recrutas o quartel tem esperando arma. */
const RECRUTAS = 5;
/** Da fixture: a tabua na entrada da casa de armas, para ela produzir sem esperar a serraria. */
const TABUA_NA_CASA_DE_ARMAS = 6;
/** Os ticks que a partida roda antes de ser salva, para os comandos e as tarefas assentarem. */
const TICKS_DE_ASSENTAMENTO = 20;
/** O aceite do operador: em ate 2 000 ticks depois de carregar. */
const TETO_DO_ACEITE = 2000;
/** Da fixture: a encomenda da casa de armas, dada pelo comando do jogador. */
const ARMA_DA_ENCOMENDA = 'hand_axe';
const ENCOMENDA = 3;
const ARMAS: readonly string[] = Object.keys(gameData.producao.receitas['weapons_workshop']?.sai ?? {});

const armazemDe = (s: GameState): PredioCompleto =>
  s.predios.porId[s.predios.ordem.find((i) => s.predios.porId[i]?.tipo === ID_DO_ARMAZEM && s.predios.porId[i]?.lado === LADO_DO_JOGADOR) as string] as PredioCompleto;

/** Os tipos ja construidos destravam o `canPlace` (desbloqueio): a busca pergunta como se a vila
 *  inteira ja estivesse de pe, que e o que o save descreve. */
const TIPOS = ['quarry', 'woodcutters', 'sawmill', 'farm', 'wineyard', 'mill', 'bakery', 'inn', 'weapons_workshop', 'barracks', 'storehouse', 'schoolhouse'];
const comTudoDestravado = (s: GameState): GameState => ({ ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, ...TIPOS])] });

/** O primeiro lugar, em aneis em volta da vila, onde o `canPlace` do jogador aceita o tipo sem
 *  cobrir recurso nem estrada. Lanca se nao couber. */
function lugarPara(s: GameState, tipo: string): { gx: number; gy: number } {
  const busca = comTudoDestravado(s);
  for (let r = 4; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      for (const p of [naVila(d, r), naVila(d, -r), naVila(r, d), naVila(-r, d)]) {
        if (canPlace(busca, tipo, p.gx, p.gy, gameData).ok && semRecursoEmVolta(s, tipo, p.gx, p.gy)) return p;
      }
    }
  }
  throw new Error(`fixture: ${tipo} nao coube perto da vila`);
}

/** O footprint, com um tile de folga em volta (onde a rua passa), nao cobre recurso nem estrada:
 *  o predio posto em cima do campo de milho ou da cana tira o tile de quem colhe (medido: a
 *  primeira montagem pos a padaria sobre a cana, e as duas rocas acenderam `sem-campo`). */
function semRecursoEmVolta(s: GameState, tipo: string, gx: number, gy: number): boolean {
  const caixa = caixaDeTipo(tipo, gx, gy, gameData);
  if (caixa === null) return false;
  for (let y = caixa.y0 - 1; y <= caixa.y1; y += 1) {
    for (let x = caixa.x0 - 1; x <= caixa.x1; x += 1) {
      const k = chaveDeTile({ gx: x, gy: y });
      if (s.recursos[k] !== undefined || s.estradas[k] !== undefined) return false;
    }
  }
  return true;
}

/** Quantos tiles do recurso que a receita colhe o predio alcancaria ali. */
function tilesAoAlcance(s: GameState, tipo: string, gx: number, gy: number): number {
  const colheita = receitaDoTipo(tipo, gameData)?.colheita ?? null;
  if (colheita === null) return 0;
  const p = completarObra({ lado: LADO_DO_JOGADOR, id: 'sonda', tipo, gx, gy, estado: 'obra', hp: 1, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  return tilesDeColheita(s, p, colheita, gameData).length;
}

/** A roca no lugar que alcanca MAIS tiles do campo que o mapa ja tem na vila (empate: o primeiro
 *  dos aneis). Medido: o primeiro lugar que alcancava algum tile alcancava um so. */
function lugarDaRoca(s: GameState, tipo: string): { gx: number; gy: number } {
  const busca = comTudoDestravado(s);
  let melhor: { gx: number; gy: number; n: number } | null = null;
  for (let r = 1; r < 16; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      for (const p of [naVila(d, r), naVila(d, -r), naVila(r, d), naVila(-r, d)]) {
        if (!canPlace(busca, tipo, p.gx, p.gy, gameData).ok || !semRecursoEmVolta(s, tipo, p.gx, p.gy)) continue;
        const n = tilesAoAlcance(s, tipo, p.gx, p.gy);
        if (n > (melhor?.n ?? 0)) melhor = { ...p, n };
      }
    }
  }
  if (melhor === null) throw new Error(`fixture: ${tipo} nao alcanca campo nenhum perto da vila`);
  return { gx: melhor.gx, gy: melhor.gy };
}

/** A rua da porta do predio ate a rede do armazem, pelo A* do jogo em modo `livre`. */
function ligar(s: GameState, id: string): GameState {
  const p = s.predios.porId[id];
  if (p === undefined) throw new Error(`fixture: '${id}' nao existe`);
  if (predioLigadoAoArmazem(s, p, gameData)) return s;
  const porta = tilesDaPorta(p, gameData)[0] as { gx: number; gy: number };
  const caminho = buscarCaminho(s, porta, tilesDaPorta(armazemDe(s), gameData), 'livre', gameData);
  if (caminho === null) throw new Error(`fixture: sem rua de '${id}' ate o armazem`);
  const novo = { ...s, estradas: { ...s.estradas, ...Object.fromEntries([porta, ...caminho.tiles].map((t) => [chaveDeTile(t), true as const])) } };
  if (!predioLigadoAoArmazem(novo, p, gameData)) throw new Error(`fixture: '${id}' nao ficou ligado`);
  return novo;
}

function comPredio(s: GameState, tipo: string, id: string, onde: { gx: number; gy: number }, mexer: (p: PredioCompleto) => PredioCompleto = (p) => p): GameState {
  const def = gameData.predios.find((x) => x.id === tipo);
  if (def === undefined) throw new Error(`fixture: '${tipo}' nao existe`);
  const p = mexer(completarObra({ lado: LADO_DO_JOGADOR, id, tipo, ...onde, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData));
  return { ...s, predios: { porId: { ...s.predios.porId, [id]: p }, ordem: [...s.predios.ordem, id] } };
}

/** A partida do save, montada do zero. */
export function vilaPronta(): GameState {
  // a escaramuca do jogo (o botao "Nova escaramuca" e o `?escaramuca`): a vila do jogador mais a da IA
  let s = criarEscaramuca(gameData.economia.estadoInicial.semente);
  // sem arma no armazem: a arma do quartel so pode sair da casa de armas
  const arm = armazemDe(s);
  const saidaSemArma = Object.fromEntries(Object.entries(arm.estoque.saida).filter(([m]) => !ARMAS.includes(m)));
  s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [arm.id]: { ...arm, estoque: { ...arm.estoque, saida: saidaSemArma } } } } };

  // a abertura da Fase A: pedreira, serraria e lenhadores onde a geometria do jogo os poe
  const abertura = aberturaDaFaseA(s);
  abertura.plantas.forEach((p, i) => {
    s = comProdutorOcupado(s, { tipo: p.tipo, id: `${p.tipo}-${i + 1}`, unidade: `${p.civil}-${i + 1}`, gx: p.gx, gy: p.gy }, gameData);
  });
  s = { ...s, estradas: { ...s.estradas, ...Object.fromEntries(abertura.rua.map((t) => [chaveDeTile(t), true as const])) } };
  if (!s.predios.ordem.some((id) => s.predios.porId[id]?.tipo === 'quarry')) {
    s = comProdutorOcupado(s, { tipo: 'quarry', id: 'pedreira', unidade: 'pedreiro', ...pedreiraDaVila() }, gameData);
  }

  // as rocas ao lado do campo e da cana que o mapa ja tem na vila
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'roca-de-milho', unidade: 'roceiro', ...lugarDaRoca(s, 'farm') }, gameData);
  s = comProdutorOcupado(s, { tipo: 'wineyard', id: 'canavial', unidade: 'canavieiro', ...lugarDaRoca(s, 'wineyard') }, gameData);
  s = comProdutorOcupado(s, { tipo: 'mill', id: 'moinho', unidade: 'moleiro', ...lugarPara(s, 'mill') }, gameData);
  s = comProdutorOcupado(s, { tipo: 'bakery', id: 'padaria', unidade: 'forneiro', ...lugarPara(s, 'bakery') }, gameData);
  s = comProdutorOcupado(s, { tipo: 'weapons_workshop', id: CASA_DE_ARMAS, unidade: 'armeiro', ...lugarPara(s, 'weapons_workshop') }, gameData);
  const casa = s.predios.porId[CASA_DE_ARMAS] as PredioCompleto;
  s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [CASA_DE_ARMAS]: { ...casa, estoque: { ...casa.estoque, entrada: { timber: TABUA_NA_CASA_DE_ARMAS }, saida: {} } } } } };
  s = comPredio(s, 'barracks', QUARTEL, lugarPara(s, 'barracks'), (q) => ({ ...q, estoque: { ...q.estoque, entrada: {} }, recrutas: RECRUTAS }));

  s = comPredio(s, 'inn', 'bodega', lugarPara(s, 'inn'));

  for (const id of [...s.predios.ordem]) {
    const p = s.predios.porId[id];
    if (p?.lado === LADO_DO_JOGADOR && p.estado === 'completo') s = ligar(s, id);
  }
  s = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, ...s.predios.ordem.map((id) => s.predios.porId[id]?.tipo ?? '')])].filter((t) => t !== '') };

  // a encomenda pelo COMANDO do jogador (o + do painel da casa): tres facoes
  const encomenda = [{ type: 'SetProductionQuota' as const, predio: CASA_DE_ARMAS, cota: { [ARMA_DA_ENCOMENDA]: ENCOMENDA } }];
  for (let t = 0; t < TICKS_DE_ASSENTAMENTO; t += 1) s = step(s, t === 0 ? encomenda : [], gameData);
  return s;
}

const armasNoQuartel = (s: GameState): number => {
  const q = s.predios.porId[QUARTEL] as PredioCompleto;
  return ARMAS.reduce((n, m) => n + (q.estoque.entrada[m] ?? 0), 0);
};

describe('o save de teste do operador (vila pronta)', () => {
  it('o arquivo versionado e o que a montagem gera, e o carregar do jogo o aceita', () => {
    const texto = salvar(vilaPronta());
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/teste-operador-vila-pronta.txt`, texto);
    if (process.env['CANGACO_GRAVAR_SAVE_DO_OPERADOR'] === '1') {
      mkdirSync('saves', { recursive: true });
      writeFileSync(ARQUIVO, texto);
    }
    expect(existsSync(ARQUIVO)).toBe(true);
    expect(readFileSync(ARQUIVO, 'utf8')).toBe(texto);
    expect(() => carregar(texto, gameData)).not.toThrow();
  });

  it('a partida tem os onze predios pedidos, completos, do jogador e ligados por estrada; o inimigo existe', () => {
    const s = carregar(readFileSync(ARQUIVO, 'utf8'), gameData);
    const doJogador = s.predios.ordem.map((id) => s.predios.porId[id]).filter((p) => p?.lado === LADO_DO_JOGADOR && p.estado === 'completo');
    for (const tipo of ['quarry', 'woodcutters', 'sawmill', 'farm', 'wineyard', 'mill', 'bakery', 'inn', 'weapons_workshop', 'barracks']) {
      const dele = doJogador.filter((p) => p?.tipo === tipo);
      expect(dele.length, tipo).toBeGreaterThan(0);
      for (const p of dele) expect(predioLigadoAoArmazem(s, p as PredioCompleto, gameData), `${tipo} ${p?.id}`).toBe(true);
    }
    expect((s.predios.porId[QUARTEL] as PredioCompleto).recrutas).toBe(RECRUTAS);
    expect((s.predios.porId[CASA_DE_ARMAS] as PredioCompleto).estoque.entrada['timber']).toBeGreaterThan(0);
    expect(s.predios.ordem.some((id) => s.predios.porId[id]?.lado === LADO_DA_IA)).toBe(true);
    // nenhum predio do jogador abre com aviso: sem trabalhador, sem estrada, sem campo, veio esgotado
    const meus = new Set(doJogador.map((p) => p?.id));
    expect(alertasDoEstado(s, gameData).filter((a) => meus.has(a.predio)).map((a) => `${a.predio}:${a.causa}`)).toEqual([]);
  });

  it('aceite: carregado o save, em ate 2 000 ticks uma arma sai da casa de armas e entra no quartel', () => {
    let s = carregar(readFileSync(ARQUIVO, 'utf8'), gameData);
    const tick0 = s.tick;
    expect(armasNoQuartel(s)).toBe(0);
    // o armazem nao tem arma: a que chegar ao quartel saiu da casa de armas
    expect(ARMAS.some((m) => (armazemDe(s).estoque.saida[m] ?? 0) > 0)).toBe(false);
    let produzida: number | null = null;
    let retirada: number | null = null;
    let chegou: number | null = null;
    for (let t = 0; t < TETO_DO_ACEITE && chegou === null; t += 1) {
      s = step(s, [], gameData);
      const casa = s.predios.porId[CASA_DE_ARMAS] as PredioCompleto;
      if (produzida === null && ARMAS.some((m) => (casa.estoque.saida[m] ?? 0) > 0)) produzida = s.tick - tick0;
      if (retirada === null && s.unidades.ordem.some((id) => ARMAS.includes(s.unidades.porId[id]?.fsmData.carga ?? ''))) retirada = s.tick - tick0;
      if (armasNoQuartel(s) > 0 || ((s.predios.porId[QUARTEL] as PredioCompleto).recrutas ?? 0) < RECRUTAS) chegou = s.tick - tick0;
    }
    gravarEvidencia('D-SAVE-VILA-PRONTA', { tickDoSave: tick0, produzida, retirada, chegou, teto: TETO_DO_ACEITE });
    expect(produzida).not.toBeNull();
    expect(retirada).not.toBeNull();
    expect(chegou).not.toBeNull();
    expect(chegou as number).toBeLessThanOrEqual(TETO_DO_ACEITE);
  }, 60_000);
});
