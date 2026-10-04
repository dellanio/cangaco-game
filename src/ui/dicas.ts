// I-TELA-DICAS-NA-PRIMEIRA-VEZ — o jogo explica quando acontece.
//
// Uma dica curta, UMA VEZ POR MAQUINA, na primeira vez que acontece algo que confunde quem chega.
// O gatilho de cada dica e DERIVADO do estado por funcao pura (`dicaAMostrar`), lendo os mesmos
// seletores que a tela ja usa (os alertas da F22, a fome da C-COMIDA, a vista da nevoa, a paz, a
// recusa da ordem da C-TELA-01): nada no `GameState` marca dica, e a `sim/` nao sabe que ela
// existe. O que ja foi visto, e se as dicas estao ligadas, mora no `localStorage`
// (`preferencias-de-dicas.ts`). Os textos vem de `theme-sertao.json` (`dicas`).
import type { GameState } from '../sim/state';
import { LADO_DO_JOGADOR } from '../sim/state';
import type { GameData } from '../sim/data/types';
import type { TileDeGrid } from '../sim/estradas';
import { alertasDoEstado } from '../sim/selectors';
import type { CausaDeAlerta } from '../sim/selectors';
import { emAlertaDeFome } from '../sim/condicao';
import { predioNaVista, unidadeNaVista } from '../sim/nevoa';
import { segundosDePazRestantes } from '../sim/paz';
import { caixaDeTipo } from '../sim/footprint';
import type { DicasVivas } from '../preferencias-de-dicas';
import { textoDaRecusa } from './aviso-de-ordem';
import temaSertao from '../../data/theme-sertao.json';

/** As dicas, na ordem em que uma ganha da outra quando duas valem no mesmo instante: primeiro a
 *  resposta ao gesto que o jogador acabou de fazer, depois o que muda a partida, e por fim a casa
 *  parada (que espera). */
export const DICAS = ['ordem-recusada', 'fim-da-paz', 'inimigo-a-vista', 'fome', 'sem-estrada', 'sem-trabalhador'] as const;
export type IdDaDica = (typeof DICAS)[number];

export interface DicaNaTela {
  readonly id: IdDaDica;
  /** O lugar para onde a dica aponta (o "Ver onde"), ou `null` quando nao ha lugar. */
  readonly tile: TileDeGrid | null;
  /** O motivo que ja existe, quando a dica o repete (a ordem recusada). */
  readonly detalhe: string | null;
}

function centroDoPredio(s: GameState, id: string, dados: GameData): TileDeGrid | null {
  const p = s.predios.porId[id];
  const caixa = p === undefined ? null : caixaDeTipo(p.tipo, p.gx, p.gy, dados);
  if (caixa === null) return null;
  return { gx: Math.floor((caixa.x0 + caixa.x1 - 1) / 2), gy: Math.floor((caixa.y0 + caixa.y1 - 1) / 2) };
}

function casaComAlerta(s: GameState, causa: CausaDeAlerta, dados: GameData): DicaNaTela | null {
  const alerta = alertasDoEstado(s, dados, LADO_DO_JOGADOR).find((a) => a.causa === causa);
  if (alerta === undefined) return null;
  return { id: causa as IdDaDica, tile: centroDoPredio(s, alerta.predio, dados), detalhe: null };
}

/** A dica `id` vale neste estado? Devolve onde e o detalhe, ou `null`. Pura: so le. */
export function gatilhoDaDica(id: IdDaDica, s: GameState, dados: GameData): DicaNaTela | null {
  switch (id) {
    case 'ordem-recusada': {
      const motivo = textoDaRecusa(s.events, segundosDePazRestantes(s, dados));
      return motivo === null ? null : { id, tile: null, detalhe: motivo };
    }
    case 'fim-da-paz':
      // so a partida que TEVE paz: a escaramuca "sem paz" nasce com o fim no tick 0
      return s.pazAteTick !== undefined && s.pazAteTick > 0 && s.tick >= s.pazAteTick ? { id, tile: null, detalhe: null } : null;
    case 'inimigo-a-vista': {
      for (const uid of s.unidades.ordem) {
        const u = s.unidades.porId[uid];
        if (u !== undefined && u.lado !== LADO_DO_JOGADOR && unidadeNaVista(s, uid, dados)) return { id, tile: { gx: u.gx, gy: u.gy }, detalhe: null };
      }
      for (const pid of s.predios.ordem) {
        const p = s.predios.porId[pid];
        if (p !== undefined && p.lado !== LADO_DO_JOGADOR && predioNaVista(s, pid, dados)) return { id, tile: centroDoPredio(s, pid, dados), detalhe: null };
      }
      return null;
    }
    case 'fome': {
      for (const uid of s.unidades.ordem) {
        const u = s.unidades.porId[uid];
        if (u !== undefined && u.lado === LADO_DO_JOGADOR && emAlertaDeFome(u, dados)) return { id, tile: { gx: u.gx, gy: u.gy }, detalhe: null };
      }
      return null;
    }
    case 'sem-estrada':
    case 'sem-trabalhador':
      return casaComAlerta(s, id, dados);
  }
}

/** A dica a mostrar AGORA: a primeira de `DICAS` que vale e ainda nao foi vista. Desligadas,
 *  nenhuma. Uma por vez; quem marca a vista e quem mostra. Pura. */
export function dicaAMostrar(s: GameState, vistas: readonly string[], ligadas: boolean, dados: GameData): DicaNaTela | null {
  if (!ligadas) return null;
  for (const id of DICAS) {
    if (vistas.includes(id)) continue;
    const dica = gatilhoDaDica(id, s, dados);
    if (dica !== null) return dica;
  }
  return null;
}

/** O texto da dica, do tema, com o `{motivo}` preenchido. Pura. */
export function textoDaDica(dica: DicaNaTela, tema: typeof temaSertao = temaSertao): string {
  const textos = tema.dicas.textos as Readonly<Record<string, string | undefined>>;
  const t = textos[dica.id];
  if (t === undefined) throw new Error(`dicas: '${dica.id}' nao tem texto em theme-sertao.json`);
  return t.replace('{motivo}', dica.detalhe ?? '');
}

export interface CaixaDeDica {
  atualizar(estado: GameState): void;
}

/** Monta a caixa da dica em `<body>` uma vez; depois so troca texto e `hidden`. A dica que aparece
 *  e marcada como vista NA HORA (fechar a pagina com ela aberta nao a repete). Fica ate "Entendi";
 *  enquanto ela esta aberta, nenhuma outra aparece. "Ver onde" centra a camera no lugar. */
export function montarCaixaDeDica(dados: GameData, preferencias: DicasVivas, centrarEm: (tile: TileDeGrid) => void): CaixaDeDica {
  const tema = temaSertao.dicas;
  const caixa = document.createElement('aside');
  caixa.id = 'dica';
  caixa.setAttribute('role', 'status');
  caixa.hidden = true;
  const titulo = document.createElement('strong');
  titulo.className = 'titulo';
  titulo.textContent = tema.titulo;
  const texto = document.createElement('p');
  texto.className = 'texto';
  const botoes = document.createElement('div');
  botoes.className = 'botoes';
  const ver = document.createElement('button');
  ver.type = 'button';
  ver.dataset.acao = 'ver';
  ver.textContent = tema.ver;
  const entendi = document.createElement('button');
  entendi.type = 'button';
  entendi.dataset.acao = 'entendi';
  entendi.textContent = tema.entendi;
  botoes.append(ver, entendi);
  caixa.append(titulo, texto, botoes);
  document.body.append(caixa);

  let aberta: DicaNaTela | null = null;
  function fechar(): void {
    aberta = null;
    caixa.hidden = true;
    delete caixa.dataset.dica;
  }
  ver.addEventListener('click', () => {
    if (aberta?.tile) centrarEm(aberta.tile);
    ver.blur();
  });
  entendi.addEventListener('click', () => {
    fechar();
    entendi.blur();
  });

  return {
    atualizar(estado) {
      // desligar nas Opcoes some com a dica aberta tambem
      if (!preferencias.atual.ligadas) {
        if (aberta !== null) fechar();
        return;
      }
      if (aberta !== null) return;
      const dica = dicaAMostrar(estado, preferencias.atual.vistas, true, dados);
      if (dica === null) return;
      preferencias.marcar(dica.id);
      aberta = dica;
      caixa.dataset.dica = dica.id;
      texto.textContent = textoDaDica(dica);
      ver.hidden = dica.tile === null;
      caixa.hidden = false;
    },
  };
}
