/**
 * F26a — a ordem de MOVER a tropa (`MoveUnits`). Ordem direta (CLAUDE.md §1): nao
 * passa pelo JobBoard.
 *
 * O grupo nao e formacao (C-COMBATE-01, formação): cada unidade so recebe um tile andavel PROPRIO em volta
 * do destino, para nao parar empilhada. Os tiles saem em aneis de Chebyshev a partir do
 * destino, em varredura de linha (`gy`, depois `gx`), e a i-esima unidade da lista (sem
 * repetidos) fica com o i-esimo. Deterministico e sem RNG.
 */
import type { Command } from '../commands';
import type { GameState, MotivoDeRecusaDeMarcha, Unidade } from '../state';
import type { GameData } from '../data/types';
import type { TileDeGrid } from '../estradas';
import { classeDaUnidade } from '../condicao';
import { buscarCaminho, passoAndavel, tileAndavel } from '../pathfinding';
import { andar, chegou, comUnidade, noTile, ocioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';
import { semRetomar, viradaPeloPasso } from './combate';
import { DIRECAO_PADRAO, direcaoAproximada, direcaoDe, passoDaDirecao } from '../combate';

export type MoveUnits = Extract<Command, { readonly type: 'MoveUnits' }>;

export const FSM_MARCHANDO = 'marchando';

export function motivoDaRecusaDeMarcha(
  state: GameState, comando: MoveUnits, dados: GameData,
): { readonly motivo: MotivoDeRecusaDeMarcha; readonly unidade: string | null } | null {
  if (comando.unidades.length === 0) return { motivo: 'sem-unidades', unidade: null };
  let lado: number | null = null;
  for (const id of comando.unidades) {
    const u = state.unidades.porId[id];
    if (u === undefined) return { motivo: 'unidade-inexistente', unidade: id };
    if (classeDaUnidade(u.tipo, dados) !== 'militar') return { motivo: 'unidade-nao-militar', unidade: id };
    if (lado !== null && u.lado !== lado) return { motivo: 'lados-diferentes', unidade: id };
    lado = u.lado;
  }
  if (!tileAndavel(state, comando.destino, 'livre', dados)) return { motivo: 'destino-inandavel', unidade: null };
  const { direcao, colunas } = comando;
  if (direcao !== undefined && !(Number.isInteger(direcao) && direcao >= 0 && direcao < DIRECOES)) {
    return { motivo: 'direcao-invalida', unidade: null };
  }
  if (colunas !== undefined && !Number.isInteger(colunas)) return { motivo: 'colunas-invalidas', unidade: null };
  return null;
}

/** As oito direcoes de `Unidade.direcao`, e o quarto de volta (a direita de quem olha). */
const DIRECOES = 8;
const A_DIREITA = 2;

/** C-COMBATE-01a — `colunas` preso a `[formacao.colunasMin, n]` (`colunasMax` e
 *  `"tamanhoDoGrupo"`). Ausente, a raiz de n para cima: um bloco quase quadrado
 *  (PARA REVISAO: o KaM guarda o valor no grupo, e a sim nao tem grupo). */
export function colunasDaFormacao(colunas: number | undefined, n: number, dados: GameData): number {
  const pedido = colunas ?? Math.ceil(Math.sqrt(n));
  return Math.max(dados.combate.formacao.colunasMin, Math.min(n, pedido));
}

/** As colunas de uma fileira de `w` homens, do meio para fora: 0, +1, -1, +2, -2... O
 *  primeiro da fileira fica no meio (o lider, na da frente); com `w` par, sobra um a direita. */
function colunasDoMeioParaFora(w: number): number[] {
  const direita = Math.ceil((w - 1) / 2);
  const esquerda = Math.floor((w - 1) / 2);
  const colunas = [0];
  for (let d = 1; colunas.length < w; d += 1) {
    if (d <= direita) colunas.push(d);
    if (d <= esquerda) colunas.push(-d);
  }
  return colunas;
}

/**
 * C-COMBATE-01a — o tile de cada homem na formacao: fileiras de `colunas`, de frente para
 * `direcao`, a primeira centrada em `destino` (o lider no meio dela) e as outras atras. O tile do desenho
 * que nao serve (fora do mapa, sem andar, ja tomado) cai no primeiro livre dos aneis em
 * volta dele; so repete quando o mapa acaba.
 */
export function tilesDaFormacao(
  state: GameState, destino: TileDeGrid, n: number, direcao: number, colunas: number, dados: GameData,
): TileDeGrid[] {
  const [fx, fy] = passoDaDirecao(direcao);
  const [rx, ry] = passoDaDirecao(direcao + A_DIREITA);
  const { largura, altura } = dados.terreno.mapaPadrao;
  const maiorAnel = Math.max(largura, altura);
  const tomados = new Set<string>();
  const livre = (t: TileDeGrid): boolean => !tomados.has(`${t.gx},${t.gy}`) && tileAndavel(state, t, 'livre', dados);
  const tiles: TileDeGrid[] = [];
  for (let i = 0; i < n; i += 1) {
    const fileira = Math.floor(i / colunas);
    const naFileira = Math.min(colunas, n - fileira * colunas);
    const coluna = colunasDoMeioParaFora(naFileira)[i % colunas] ?? 0;
    const desenho = { gx: destino.gx + coluna * rx - fileira * fx, gy: destino.gy + coluna * ry - fileira * fy };
    let achado: TileDeGrid | null = null;
    for (let r = 0; r <= maiorAnel && achado === null; r += 1) {
      for (let gy = desenho.gy - r; gy <= desenho.gy + r && achado === null; gy += 1) {
        for (let gx = desenho.gx - r; gx <= desenho.gx + r && achado === null; gx += 1) {
          const naBorda = Math.max(Math.abs(gx - desenho.gx), Math.abs(gy - desenho.gy)) === r;
          if (naBorda && livre({ gx, gy })) achado = { gx, gy };
        }
      }
    }
    const tile = achado ?? tiles[tiles.length - 1] ?? destino;
    tomados.add(`${tile.gx},${tile.gy}`);
    tiles.push(tile);
  }
  return tiles;
}

/** Os `n` primeiros tiles andaveis em volta de `destino`, anel a anel. O anel para no
 *  lado do mapa: quando nao ha `n`, devolve os que ha, e as ultimas unidades repetem. */
export function tilesDoGrupo(state: GameState, destino: TileDeGrid, n: number, dados: GameData): TileDeGrid[] {
  const { largura, altura } = dados.terreno.mapaPadrao;
  const tiles: TileDeGrid[] = [];
  const maiorAnel = Math.max(largura, altura);
  for (let r = 0; r <= maiorAnel && tiles.length < n; r += 1) {
    for (let gy = destino.gy - r; gy <= destino.gy + r && tiles.length < n; gy += 1) {
      for (let gx = destino.gx - r; gx <= destino.gx + r && tiles.length < n; gx += 1) {
        const naBorda = Math.max(Math.abs(gx - destino.gx), Math.abs(gy - destino.gy)) === r;
        if (naBorda && tileAndavel(state, { gx, gy }, 'livre', dados)) tiles.push({ gx, gy });
      }
    }
  }
  return tiles;
}

/**
 * C-COMBATE-01a — quem vai para qual vaga: o lider (o primeiro) na vaga 0, a do meio da
 * frente; cada outro, na ordem da lista, na vaga livre mais perto de onde esta (Chebyshev;
 * empate, a vaga de menor indice). Por indice fixo, virar 180 graus trocaria os homens de
 * lado passando pelo lider, e dois deles ficariam um esperando o outro para sempre.
 */
export function vagasPorProximidade(
  posicoes: readonly TileDeGrid[], vagas: readonly TileDeGrid[],
): TileDeGrid[] {
  const livres = vagas.map((_, i) => i);
  return posicoes.map((p, i) => {
    let melhor = 0;
    if (i > 0) {
      let menor = Number.POSITIVE_INFINITY;
      livres.forEach((v, k) => {
        const t = vagas[v] as TileDeGrid;
        const d = Math.max(Math.abs(t.gx - p.gx), Math.abs(t.gy - p.gy));
        if (d < menor) {
          menor = d;
          melhor = k;
        }
      });
    }
    const [v] = livres.splice(melhor, 1);
    return vagas[v ?? vagas.length - 1] as TileDeGrid;
  });
}

export function aplicarMoveUnits(state: GameState, comando: MoveUnits, dados: GameData): ResultadoDeSistema {
  const recusa = motivoDaRecusaDeMarcha(state, comando, dados);
  if (recusa !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'MoveUnits', unidade: recusa.unidade, motivo: recusa.motivo }],
    };
  }
  const ids = [...new Set(comando.unidades)];
  const lider = state.unidades.porId[ids[0] ?? ''];
  const direcao = comando.direcao
    ?? (lider === undefined ? DIRECAO_PADRAO : direcaoAproximada(lider, comando.destino) ?? direcaoDe(lider));
  const colunas = colunasDaFormacao(comando.colunas, ids.length, dados);
  const posicoes = ids.map((id) => state.unidades.porId[id] ?? comando.destino);
  const alvos = vagasPorProximidade(posicoes, tilesDaFormacao(state, comando.destino, ids.length, direcao, colunas, dados));
  let atual = state;
  ids.forEach((id, i) => {
    const u = atual.unidades.porId[id];
    const alvo = alvos[Math.min(i, alvos.length - 1)];
    if (u === undefined || alvo === undefined) return;
    // o caminho e planejado no primeiro tick do sistema, de onde a unidade estiver
    atual = comUnidade(atual, {
      ...semRetomar(u), fsm: FSM_MARCHANDO,
      fsmData: { caminho: [], progresso: 0, alvoTile: alvo, direcaoFinal: direcao },
    });
  });
  return { state: atual, events: [] };
}

function passoMarchando(state: GameState, u: Unidade, dados: GameData): ResultadoDeSistema {
  const alvo = u.fsmData.alvoTile;
  const final = u.fsmData.direcaoFinal;
  // C-COMBATE-01a — quem chega vira para a frente da formacao
  const parar = (v: Unidade): Unidade => (final === undefined ? ocioso(v) : { ...ocioso(v), direcao: final });
  if (alvo === undefined || (u.gx === alvo.gx && u.gy === alvo.gy)) {
    return { state: comUnidade(state, parar(u)), events: [] };
  }
  let atual = u;
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0];
  if (proximo === undefined || !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    const rota = buscarCaminho(state, noTile(u), [alvo], 'livre', dados);
    if (rota === null || rota.tiles.length === 0) return { state: comUnidade(state, ocioso(u)), events: [] };
    atual = { ...u, fsmData: { alvoTile: alvo, caminho: rota.tiles, progresso: 0, ...(final === undefined ? {} : { direcaoFinal: final }) } };
  }
  // F28a: a unidade vira para onde anda (frente/flanco/costas e o arco do arqueiro)
  const andou = viradaPeloPasso(noTile(atual), andar(state, atual, dados));
  return { state: comUnidade(state, chegou(andou) ? parar(andou) : andou), events: [] };
}

/** Um tick de cada unidade marchando, em `unidades.ordem`. */
export function sistemaDaMarcha(state: GameState, dados: GameData): ResultadoDeSistema {
  let atual = state;
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.fsm !== FSM_MARCHANDO) continue;
    atual = passoMarchando(atual, u, dados).state;
  }
  return { state: atual, events: [] };
}
