/**
 * I-TERRENO-FASE-NA-SIM (plano em docs/planos/2026-10-12-campanha-jogavel.md) — uma fase da campanha
 * vira partida.
 *
 * - `dadosDaFase`: o `GameData` com o mapa da fase no lugar do `sertao-128` e sem a vila do jogo livre
 *   (o `SET_HOUSE`/`SET_GROUP` do KaM vem da fase, e nao do `economy.estadoInicial`).
 * - `criarFase`: o estado inicial da fase, com os predios completos e as tropas de cada lado, e o
 *   estoque no primeiro armazem de cada lado.
 *
 * As duas nasceram no teste das dez fases (`tests/I-TERRENO-DEZ-MAPAS-DA-CAMPANHA.test.ts`), que agora
 * as importa daqui.
 */
import { deepFreeze } from './freeze';
import { loadGameData } from './data/loader';
import { rawGameData } from './data/raw';
import type { RawGameData } from './data/raw';
import type { FaseData, GameData } from './data/types';
import { completarObra, createInitialState, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from './state';
import type { GameState, IADoLado, PosicaoDeDefesa, Predio, Unidade } from './state';
import { classeDaUnidade, condicaoCheiaDoTipo } from './condicao';
import { numerosDaIA, tipoDeGrupo } from './ia';
import { tileAndavel } from './pathfinding';
import { descobertoInicial } from './nevoa';

/** Quantos aneis em volta do ponto a unidade procura tile livre para nascer. */
const ANEIS_DO_SPAWN = 12;

/** A fase pelo id, ou erro: um id fora da campanha e defeito de quem chamou. */
export function faseDaCampanha(id: string, dados: GameData): FaseData {
  const fase = dados.campanha.fases.find((f) => f.id === id);
  if (fase === undefined) throw new Error(`faseDaCampanha: '${id}' nao e fase da campanha`);
  return fase;
}

/** A sim com o mapa da fase no lugar do `sertao-128`, e sem a vila inicial do jogo livre. Congelado,
 *  como o `gameData`. */
export function dadosDaFase(id: string, raw: RawGameData = rawGameData): GameData {
  const fase = raw.fases.find((f) => f.id === id);
  if (fase === undefined) throw new Error(`dadosDaFase: '${id}' nao e fase da campanha`);
  const { largura, altura } = fase.mapa;
  const mapa = { ...raw.mapa, id: fase.id, largura, altura, linhas: fase.mapa.linhas, recursos: fase.mapa.recursos };
  const economy = { ...raw.economy, estadoInicial: { ...raw.economy.estadoInicial, predios: [], unidades: {} } };
  // I-TERRENO-FASE-8-MAPA-MAIOR: o mundo da partida tem o tamanho do mapa da fase. O loader continua
  // recusando mapa e `mapaPadrao` diferentes; aqui os dois sao o mesmo numero
  const terrain = { ...raw.terrain, mapaPadrao: { largura, altura } };
  return deepFreeze(loadGameData({ ...raw, terrain, mapa, economy } as unknown as RawGameData));
}

/** Os tiles livres e andaveis em volta de `(gx, gy)`, anel por anel (o spawn da escaramuca). */
export function tilesParaNascer(
  s: GameState, gx: number, gy: number, quantos: number, ocupado: Set<string>, dados: GameData,
): { gx: number; gy: number }[] {
  const tiles: { gx: number; gy: number }[] = [];
  for (let r = 0; tiles.length < quantos && r < ANEIS_DO_SPAWN; r++) {
    for (let dy = -r; dy <= r && tiles.length < quantos; dy++) {
      for (let dx = -r; dx <= r && tiles.length < quantos; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const t = { gx: gx + dx, gy: gy + dy };
        const k = `${t.gx},${t.gy}`;
        if (ocupado.has(k) || !tileAndavel(s, t, 'livre', dados)) continue;
        ocupado.add(k);
        tiles.push(t);
      }
    }
  }
  return tiles;
}

/**
 * I-OBRA-FASE-LIBERA — o que a fase ja liberou: o `libera` das fases 1..N somado (o `RELEASE_HOUSE`
 * acumulado do KaM) mais os tipos que o jogador (lado 0) ja tem no comeco da fase.
 */
export function liberadosNaFase(fase: FaseData, dados: GameData): { readonly predios: ReadonlySet<string>; readonly tropas: ReadonlySet<string> } {
  const ate = dados.campanha.fases.filter((f) => f.numero <= fase.numero);
  const doJogador = fase.lados.find((l) => l.lado === LADO_DO_JOGADOR);
  return {
    predios: new Set([...ate.flatMap((f) => f.libera.predios), ...(doJogador?.predios ?? []).map((p) => p.id)]),
    tropas: new Set([...ate.flatMap((f) => f.libera.tropas), ...(doJogador?.unidades ?? []).map((u) => u.tipo)]),
  };
}

/**
 * I-OBRA-FASE-LIBERA — o tipo esta trancado nesta partida: ela e uma fase, o tipo e liberado por uma
 * fase DEPOIS desta, e ainda nao esta na lista dos liberados. Fora da campanha nada e trancado. Um
 * tipo que nenhuma fase cita nao e trancado (o conservador: a campanha so tranca o que ela libera).
 */
export function trancadoNaFase(state: GameState, tipo: string, lista: 'predios' | 'tropas', dados: GameData): boolean {
  if (state.fase === undefined) return false;
  const fase = faseDaCampanha(state.fase.id, dados);
  if (liberadosNaFase(fase, dados)[lista].has(tipo)) return false;
  return dados.campanha.fases.some((f) => f.numero > fase.numero && f.libera[lista].includes(tipo));
}

/**
 * BUG-CAPTURADO-MORRE-NA-LUTA-AUTOMATICA — a unidade que a fase manda capturar (o `capturar`, regra do
 * operador de 2026-10-12: uma tropa a 1 tile dela por 10 s, sem escolta). Ela nao luta, nao e escolhida
 * pela luta automatica nem pelo atirador, e a ordem de ataca-la e recusada: encostar nela tem de ser
 * possivel sem mata-la, ou a regra aprovada nunca acontece.
 */
export function ehAlvoDeCaptura(state: GameState, u: Unidade, dados: GameData): boolean {
  if (state.fase === undefined) return false;
  const fase = dados.campanha.fases.find((f) => f.id === state.fase?.id);
  return fase !== undefined && fase.objetivos.vitoria.some((o) => o.tipo === 'capturar' && o.lado === u.lado && o.unidade === u.tipo);
}

/** I-COMBATE-FASE-INIMIGO-DEFENDE — as posicoes de defesa de um grupo de militares da fase: blocos de
 *  `tamanho` (o maximo da posicao), `tras` para quem atira, `frente` para os outros, com o raio de
 *  `data/missao.json`. Nenhum membro fica de sobra para o ataque da IA. O primeiro bloco fica no ponto do
 *  grupo; os outros, no tile em que nasceu o primeiro membro deles, para as formacoes nao disputarem os
 *  mesmos tiles. */
function posicoesDoGrupo(
  id: string, ponto: { gx: number; gy: number }, grupo: PosicaoDeDefesa['tipoDeGrupo'], membros: readonly string[],
  tamanho: number, dados: GameData, onde: (id: string) => { gx: number; gy: number },
): PosicaoDeDefesa[] {
  const blocos: PosicaoDeDefesa[] = [];
  for (let i = 0; i < membros.length; i += tamanho) {
    blocos.push({
      id: `${id}-${i / tamanho}`, ponto: i === 0 ? ponto : onde(membros[i] as string), tipoDeGrupo: grupo, raio: dados.campanha.defesa.raio_tiles,
      linha: grupo === 'distancia' ? 'tras' : 'frente', membros: membros.slice(i, i + tamanho),
    });
  }
  return blocos;
}

/** O estado inicial da fase `id`. `dados` precisa ser o da fase (`dadosDaFase`): e o mapa dele. */
export function criarFase(id: string, dados: GameData): GameState {
  const fase = faseDaCampanha(id, dados);
  const base = createInitialState(fase.semente, dados);
  let n = base.proximoId;
  const predios: Record<string, Predio> = {};
  const ordemP: string[] = [];
  for (const lado of fase.lados) {
    let comEstoque = false;
    for (const p of lado.predios) {
      const def = dados.predios.find((d) => d.id === p.id);
      if (def === undefined) throw new Error(`criarFase: predio '${p.id}' de '${id}' nao existe em data/buildings.json`);
      const pid = `p${n++}`;
      let predio = completarObra({ lado: lado.lado, id: pid, tipo: p.id, gx: p.gx, gy: p.gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, dados);
      if (p.id === ID_DO_ARMAZEM && !comEstoque) {
        predio = { ...predio, estoque: { ...predio.estoque, saida: { ...predio.estoque.saida, ...lado.estoque } } };
        comEstoque = true;
      }
      predios[pid] = predio;
      ordemP.push(pid);
    }
  }
  const comPredios: GameState = { ...base, predios: { porId: predios, ordem: ordemP } };
  const unidades: Record<string, Unidade> = {};
  const ordemU: string[] = [];
  const ocupado = new Set<string>();
  // I-COMBATE-FASE-INIMIGO-DEFENDE: as posicoes de defesa de cada lado que nao e o jogador
  const posicoesPorLado: Record<string, PosicaoDeDefesa[]> = {};
  for (const lado of fase.lados) {
    for (const [g, u] of lado.unidades.entries()) {
      const tiles = tilesParaNascer(comPredios, u.gx, u.gy, u.quantidade, ocupado, dados);
      if (tiles.length < u.quantidade) throw new Error(`criarFase: '${id}' sem lugar para ${u.quantidade} '${u.tipo}' em (${u.gx},${u.gy})`);
      const nascidos: string[] = [];
      for (const t of tiles) {
        const uid = `u${n++}`;
        unidades[uid] = { id: uid, lado: lado.lado, tipo: u.tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(u.tipo, dados) };
        ordemU.push(uid);
        nascidos.push(uid);
      }
      const grupo = tipoDeGrupo(u.tipo, dados);
      // quem a fase manda capturar nao defende: a posicao o mandaria lutar (BUG-CAPTURADO-MORRE-NA-LUTA-AUTOMATICA)
      const capturado = fase.objetivos.vitoria.some((o) => o.tipo === 'capturar' && o.lado === lado.lado && o.unidade === u.tipo);
      if (lado.lado !== LADO_DO_JOGADOR && grupo !== null && classeDaUnidade(u.tipo, dados) === 'militar' && !capturado) {
        const posicoes = (posicoesPorLado[String(lado.lado)] ??= []);
        posicoes.push(...posicoesDoGrupo(`g${g}`, { gx: u.gx, gy: u.gy }, grupo, nascidos, numerosDaIA(comPredios, lado.lado, dados).tamanhoDoGrupo, dados,
          (uid) => { const x = unidades[uid] as Unidade; return { gx: x.gx, gy: x.gy }; }));
      }
    }
  }
  const ia: Record<string, IADoLado> = Object.fromEntries(Object.entries(posicoesPorLado).map(([lado, posicoes]) => [lado, { posicoes }]));
  // I-OBRA-FASE-LIBERA: os predios do jogador no comeco contam como ja construidos, para a arvore de
  // desbloqueio (GDD §5.2) valer na fase como no jogo livre
  const doJogador = fase.lados.find((l) => l.lado === LADO_DO_JOGADOR)?.predios.map((p) => p.id) ?? [];
  const tiposJaConstruidos = [...base.tiposJaConstruidos, ...doJogador.filter((t, i, a) => a.indexOf(t) === i && !base.tiposJaConstruidos.includes(t))];
  const estado: GameState = {
    ...comPredios,
    tiposJaConstruidos,
    unidades: { porId: unidades, ordem: ordemU },
    proximoId: n,
    ...(Object.keys(ia).length === 0 ? {} : { ia }),
    fase: { id, numero: fase.numero, inicio: base.tick, ondasDisparadas: 0, tropasDasOndas: [], contagem: {} },
  };
  return { ...estado, descoberto: descobertoInicial(estado, dados) };
}
