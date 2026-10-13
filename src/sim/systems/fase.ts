/**
 * I-COMBATE-FASE-ONDAS-E-OBJETIVOS (plano em docs/planos/2026-10-12-campanha-jogavel.md) — a missao da
 * fase roda dentro do `step`.
 *
 * - `sistemaDaFase`: a onda nasce no tick dela (contado do comeco da fase) e vai atacar o predio do
 *   jogador mais perto, pela mesma escolha de alvo da IA (`alvoDoAtaque`); e as contagens do `manter`
 *   e do `capturar` andam um tick.
 * - `resultadoDaFase`: vitoria quando TODOS os objetivos de vitoria valem; derrota quando QUALQUER um
 *   de derrota vale; a derrota conta antes. O `step` grava o resultado uma vez, como na F34.
 *
 * O vocabulario e o da secao 2 do desenho (docs/planos/2026-10-10-campanha-dez-fases.md), do
 * `ADD_GOAL`/`ADD_LOST_GOAL` do KaM. O capturar e a regra que o operador aprovou em 2026-10-12.
 */
import type { GameData, ObjetivoDaFaseData } from '../data/types';
import type { EstadoDaFase, GameState, Unidade } from '../state';
import { LADO_DO_JOGADOR } from '../state';
import { classeDaUnidade, condicaoCheiaDoTipo } from '../condicao';
import { faseDaCampanha, tilesParaNascer } from '../fase';
import { alvoDoAtaque } from './ia';
import { FSM_INDO_ATACAR } from './cerco';
import type { ResultadoDeSistema } from './jobs';
import type { FimDaPartida } from '../partida';

const vivas = (s: GameState): Unidade[] =>
  s.unidades.ordem.map((id) => s.unidades.porId[id]).filter((u): u is Unidade => u !== undefined);

/** Os tipos de predio de `lado` de pe (obra conta: ainda nao foi destruida, como na F34). */
function tiposDePe(s: GameState, lado: number): Set<string> {
  const tipos = new Set<string>();
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p !== undefined && p.lado === lado) tipos.add(p.tipo);
  }
  return tipos;
}

const militaresDoLado = (s: GameState, lado: number, dados: GameData): Unidade[] =>
  vivas(s).filter((u) => u.lado === lado && classeDaUnidade(u.tipo, dados) === 'militar');

const cheb = (a: { gx: number; gy: number }, b: { gx: number; gy: number }): number =>
  Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

/** O `capturar` vale NESTE tick: uma tropa do jogador a ate `raio_tiles` da unidade-alvo, e nenhum
 *  militar do lado dela (alem dela) a ate `raioDaEscolta_tiles`. */
function capturandoAgora(s: GameState, o: ObjetivoDaFaseData, dados: GameData): boolean {
  const lado = o.lado ?? -1;
  const { raio_tiles, raioDaEscolta_tiles } = dados.campanha.captura;
  const meus = militaresDoLado(s, LADO_DO_JOGADOR, dados);
  const escolta = militaresDoLado(s, lado, dados);
  return vivas(s).some((alvo) => alvo.lado === lado && alvo.tipo === o.unidade
    && meus.some((m) => cheb(m, alvo) <= raio_tiles)
    && !escolta.some((e) => e.id !== alvo.id && cheb(e, alvo) <= raioDaEscolta_tiles));
}

/** O `manter` vale NESTE tick: todos os tipos listados de pe para o lado. */
const mantendoAgora = (s: GameState, o: ObjetivoDaFaseData): boolean => {
  const tipos = tiposDePe(s, o.lado ?? LADO_DO_JOGADOR);
  return (o.predios ?? []).every((t) => tipos.has(t));
};

/** As ondas que vencem neste tick e as contagens de um tick. `tick` e o numero do tick que este
 *  `step` produz. */
export function sistemaDaFase(state: GameState, dados: GameData, tick: number): ResultadoDeSistema {
  if (state.fase === undefined || state.partida !== undefined) return { state, events: [] };
  const fase = faseDaCampanha(state.fase.id, dados);
  let s = state;
  let estado: EstadoDaFase = state.fase;
  const decorrido = tick - estado.inicio;

  while (estado.ondasDisparadas < fase.ondas.length && (fase.ondas[estado.ondasDisparadas]?.tick ?? Infinity) <= decorrido) {
    const onda = fase.ondas[estado.ondasDisparadas];
    if (onda === undefined) break;
    const ocupado = new Set(vivas(s).map((u) => `${u.gx},${u.gy}`));
    const nascidas: Unidade[] = [];
    let n = s.proximoId;
    for (const tropa of onda.tropas) {
      for (const t of tilesParaNascer(s, onda.de.gx, onda.de.gy, tropa.quantidade, ocupado, dados)) {
        const id = `u${n++}`;
        nascidas.push({ id, lado: onda.lado, tipo: tropa.tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tropa.tipo, dados) });
      }
    }
    const alvo = alvoDoAtaque(s, nascidas, onda.lado, dados);
    const comAlvo = nascidas.map((u) => (alvo === null ? u : { ...u, fsm: FSM_INDO_ATACAR, fsmData: { alvo } }));
    const porId = { ...s.unidades.porId };
    for (const u of comAlvo) porId[u.id] = u;
    s = { ...s, proximoId: n, unidades: { porId, ordem: [...s.unidades.ordem, ...comAlvo.map((u) => u.id)] } };
    estado = { ...estado, ondasDisparadas: estado.ondasDisparadas + 1, tropasDasOndas: [...estado.tropasDasOndas, ...comAlvo.map((u) => u.id)] };
  }

  // BUG-ONDA-PARA-DEPOIS-DA-LUTA: a tropa da onda que ficou ociosa (o alvo caiu, ou ela lutou com quem
  // a interceptou) segue para o proximo predio do jogador, pela mesma escolha da IA
  const paradas = estado.tropasDasOndas
    .map((id) => s.unidades.porId[id])
    .filter((u): u is Unidade => u !== undefined && u.fsm === 'ocioso');
  for (const lado of [...new Set(paradas.map((u) => u.lado))].sort((a, b) => a - b)) {
    const grupo = paradas.filter((u) => u.lado === lado);
    const alvo = alvoDoAtaque(s, grupo, lado, dados);
    if (alvo === null) continue;
    const porId = { ...s.unidades.porId };
    for (const u of grupo) porId[u.id] = { ...u, fsm: FSM_INDO_ATACAR, fsmData: { alvo } };
    s = { ...s, unidades: { ...s.unidades, porId } };
  }

  const contagem: Record<string, number> = { ...estado.contagem };
  fase.objetivos.vitoria.forEach((o, i) => {
    const chave = `v${i}`;
    const vale = o.tipo === 'manter' ? mantendoAgora(s, o) : o.tipo === 'capturar' ? capturandoAgora(s, o, dados) : null;
    if (vale === null) return;
    contagem[chave] = vale ? (contagem[chave] ?? 0) + 1 : 0;
  });
  estado = { ...estado, contagem };
  return { state: { ...s, fase: estado }, events: [] };
}

/** Um objetivo de VITORIA vale no estado. */
function vitoriaVale(s: GameState, o: ObjetivoDaFaseData, i: number, f: EstadoDaFase, dados: GameData): boolean {
  const lado = o.lado ?? -1;
  switch (o.tipo) {
    case 'destruir':
      if (o.predios !== undefined) { const tipos = tiposDePe(s, lado); return o.predios.every((t) => !tipos.has(t)); }
      if (o.alvo === 'tropas') return militaresDoLado(s, lado, dados).length === 0;
      return tiposDePe(s, lado).size === 0;
    case 'sobreviver': {
      const ondas = o.ondas ?? 0;
      return f.ondasDisparadas >= ondas && !f.tropasDasOndas.some((id) => s.unidades.porId[id] !== undefined);
    }
    case 'manter':
      return (f.contagem[`v${i}`] ?? 0) >= (o.ticks ?? Infinity);
    case 'capturar':
      return (f.contagem[`v${i}`] ?? 0) >= dados.campanha.captura.ticks;
    default:
      return false;
  }
}

/** Um objetivo de DERROTA vale no estado, no tick `tick`. */
function derrotaVale(s: GameState, o: ObjetivoDaFaseData, f: EstadoDaFase, tick: number, dados: GameData): boolean {
  const lado = o.lado ?? LADO_DO_JOGADOR;
  switch (o.tipo) {
    case 'perder':
      if (o.alvo === 'tropas') return militaresDoLado(s, lado, dados).length === 0;
      { const tipos = tiposDePe(s, lado); return (o.predios ?? []).every((t) => !tipos.has(t)); }
    case 'proteger': {
      const tipos = tiposDePe(s, lado);
      return (o.predios ?? []).some((t) => !tipos.has(t));
    }
    case 'prazo':
      return tick - f.inicio >= (o.ticks ?? Infinity);
    default:
      return false;
  }
}

/** O fim da fase no estado, no tick `tick`, ou `null` enquanto ela corre. */
export function resultadoDaFase(state: GameState, dados: GameData, tick: number): FimDaPartida | null {
  const f = state.fase;
  if (f === undefined) return null;
  const fase = faseDaCampanha(f.id, dados);
  if (fase.objetivos.derrota.some((o) => derrotaVale(state, o, f, tick, dados))) return 'derrota';
  if (fase.objetivos.vitoria.length > 0 && fase.objetivos.vitoria.every((o, i) => vitoriaVale(state, o, i, f, dados))) return 'vitoria';
  return null;
}
