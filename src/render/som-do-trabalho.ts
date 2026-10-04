/**
 * H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA — os sons de trabalho em laco: o laborer batendo tabua na
 * obra, o laborer na estrada, o cabouqueiro na pedra.
 *
 * Derivados do estado da unidade por funcao pura, como a animacao de trabalho
 * (`render/acao-de-unidade.ts`), sem evento novo na sim: o laco toca enquanto o estado dura e ha
 * alguem trabalhando ali, e para quando ninguem esta. Cada fonte tem lugar (a unidade), e o volume
 * cai com a distancia ao centro da camera (`volumeNaDistancia`); fora do raio, nao toca. No maximo
 * `tetoDeVozes` lacos juntos, os mais perto primeiro. Os ids e o teto sao de `data/som.json`
 * (`trabalho`). Puro e sem Phaser nem DOM: quem toca e o tocador de vozes injetado.
 */
import type { GameState } from '../sim/state';
import type { TileDoSom } from './som';
import { volumeNaDistancia } from './som';

export interface DadosDoTrabalho {
  /** O laborer `martelando` numa obra de predio. */
  readonly construir: string;
  /** O laborer `nivelando` ou `martelando` num tile de estrada. */
  readonly estrada: string;
  /** O especialista `colhendo`, pelo recurso que ele tira (`rock` -> a pedreira). */
  readonly colheita: Readonly<Record<string, string>>;
  readonly tetoDeVozes: number;
}

/** Alguem trabalhando agora: o id do som, quem e, e onde. */
export interface FonteDeTrabalho {
  readonly id: string;
  readonly unidade: string;
  readonly tile: TileDoSom;
}

/** Quem esta trabalhando neste estado, na ordem das unidades. Pura. */
export function fontesDeTrabalho(estado: GameState, dados: DadosDoTrabalho): FonteDeTrabalho[] {
  const fontes: FonteDeTrabalho[] = [];
  for (const uid of estado.unidades.ordem) {
    const u = estado.unidades.porId[uid];
    if (u === undefined || u.fsmData.tarefa === undefined) continue;
    const tarefa = estado.jobs.tarefas.porId[u.fsmData.tarefa];
    if (tarefa === undefined) continue;
    let id: string | null = null;
    if (u.tipo === 'laborer' && u.fsm === 'martelando' && tarefa.tipo === 'construir') id = dados.construir;
    else if (u.tipo === 'laborer' && (u.fsm === 'nivelando' || u.fsm === 'martelando') && tarefa.tipo === 'assentar-estrada') id = dados.estrada;
    else if (u.fsm === 'colhendo' && tarefa.tipo === 'colher') id = dados.colheita[tarefa.recurso] ?? null;
    if (id !== null) fontes.push({ id, unidade: uid, tile: { gx: u.gx, gy: u.gy } });
  }
  return fontes;
}

/** Uma voz: um laco tocando, com o fator da distancia. `voz` e a chave do laco (`id:n`). */
export interface VozDeTrabalho {
  readonly voz: string;
  readonly id: string;
  readonly unidade: string;
  readonly fator: number;
}

/**
 * As vozes a tocar: as fontes dentro do raio, as mais perto do centro primeiro (desempate pelo id
 * da unidade), ate o teto. Sem camera (`centro` nulo), nenhuma: o som com lugar precisa de onde o
 * jogador esta olhando. Pura.
 */
export function vozesDeTrabalho(
  fontes: readonly FonteDeTrabalho[], centro: TileDoSom | null, raioTiles: number, tetoDeVozes: number,
): VozDeTrabalho[] {
  if (centro === null) return [];
  const dentro = fontes
    .map((f) => ({ f, fator: volumeNaDistancia(f.tile, centro, raioTiles) }))
    .filter((x) => x.fator > 0)
    .sort((a, b) => b.fator - a.fator || (a.f.unidade < b.f.unidade ? -1 : a.f.unidade > b.f.unidade ? 1 : 0))
    .slice(0, Math.max(0, tetoDeVozes));
  const porId = new Map<string, number>();
  return dentro.map(({ f, fator }) => {
    const n = porId.get(f.id) ?? 0;
    porId.set(f.id, n + 1);
    return { voz: `${f.id}:${n}`, id: f.id, unidade: f.unidade, fator };
  });
}

/** Quem toca as vozes: `tocar` liga a voz com o arquivo do `id` (ou so ajusta o volume); `parar` desliga. */
export interface TocadorDeVozes {
  tocar(voz: string, id: string, volume: number): void;
  parar(voz: string): void;
}

export interface ContadoresDoTrabalho {
  /** As vozes do ultimo quadro (com e sem arquivo), com o volume pedido: o que o roteiro mede. */
  readonly vozes: readonly (VozDeTrabalho & { readonly volume: number })[];
  /** Quantos quadros tiveram ao menos uma voz. */
  readonly quadrosComVoz: number;
}

export interface SomDoTrabalho {
  quadro(estado: GameState, centro: TileDoSom | null): void;
  contadores(): ContadoresDoTrabalho;
}

export function criarSomDoTrabalho(opcoes: {
  readonly dados: DadosDoTrabalho;
  readonly raioTiles: number;
  readonly disponiveis: ReadonlySet<string>;
  readonly tocador: TocadorDeVozes;
  /** O volume efetivo do id agora (geral x canal, o mudo zera). */
  readonly volume: (id: string) => number;
}): SomDoTrabalho {
  const { dados, raioTiles, disponiveis, tocador, volume } = opcoes;
  const tocando = new Set<string>();
  let ultimas: (VozDeTrabalho & { readonly volume: number })[] = [];
  let quadrosComVoz = 0;
  return {
    quadro(estado, centro) {
      const vozes = vozesDeTrabalho(fontesDeTrabalho(estado, dados), centro, raioTiles, dados.tetoDeVozes);
      ultimas = vozes.map((v) => ({ ...v, volume: v.fator * volume(v.id) }));
      if (ultimas.length > 0) quadrosComVoz += 1;
      const agora = new Set<string>();
      for (const v of ultimas) {
        if (!disponiveis.has(v.id) || v.volume <= 0) continue;
        agora.add(v.voz);
        tocando.add(v.voz);
        tocador.tocar(v.voz, v.id, v.volume);
      }
      for (const voz of [...tocando]) {
        if (agora.has(voz)) continue;
        tocando.delete(voz);
        tocador.parar(voz);
      }
    },
    contadores() {
      return { vozes: ultimas, quadrosComVoz };
    },
  };
}
