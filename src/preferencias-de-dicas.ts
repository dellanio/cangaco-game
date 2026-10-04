/**
 * I-TELA-DICAS-NA-PRIMEIRA-VEZ — as dicas ligadas ou nao, e quais ja foram vistas nesta maquina.
 *
 * Preferencia de quem joga, e nao estado de partida: mora no `localStorage` (`CHAVE_DAS_DICAS`),
 * FORA do save, como o volume (`preferencias-de-som.ts`) e a marca da ajuda. Nada daqui entra no
 * `GameState`. TypeScript puro, sem DOM: a gaveta entra por parametro, e o teste passa uma de
 * mentira. Mora no laco externo porque o menu (as Opcoes) e o jogo a leem.
 */
import type { Gaveta } from './arquivo-da-partida';

export interface PreferenciasDeDicas {
  readonly ligadas: boolean;
  /** Os ids das dicas ja mostradas, na ordem em que apareceram. */
  readonly vistas: readonly string[];
}

/** A chave no `localStorage`. */
export const CHAVE_DAS_DICAS = 'cangaco:dicas';

export const DICAS_PADRAO: PreferenciasDeDicas = { ligadas: true, vistas: [] };

/** O que esta guardado, com o padrao no que faltar ou nao servir. A gaveta que lanca e o padrao. */
export function lerDicas(gaveta: Gaveta | null): PreferenciasDeDicas {
  let texto: string | null;
  try {
    texto = gaveta?.getItem(CHAVE_DAS_DICAS) ?? null;
  } catch {
    return DICAS_PADRAO;
  }
  if (texto === null) return DICAS_PADRAO;
  let lido: unknown;
  try {
    lido = JSON.parse(texto);
  } catch {
    return DICAS_PADRAO;
  }
  if (lido === null || typeof lido !== 'object') return DICAS_PADRAO;
  const o = lido as Record<string, unknown>;
  const vistas = Array.isArray(o['vistas']) ? o['vistas'].filter((v): v is string => typeof v === 'string') : [];
  return { ligadas: typeof o['ligadas'] === 'boolean' ? o['ligadas'] : DICAS_PADRAO.ligadas, vistas };
}

/** Guarda. A gaveta que lanca e engolida: sem `localStorage`, a dica pode voltar na proxima visita. */
export function gravarDicas(gaveta: Gaveta | null, p: PreferenciasDeDicas): void {
  try {
    gaveta?.setItem(CHAVE_DAS_DICAS, JSON.stringify(p));
  } catch {
    // o pior caso aceitavel: chato, nunca quebrado
  }
}

/** A preferencia em uso nesta pagina: as Opcoes e o jogo leem a mesma. */
export interface DicasVivas {
  readonly atual: PreferenciasDeDicas;
  ligar(ligadas: boolean): void;
  /** Marca a dica como vista, e guarda. Marcar de novo nao repete na lista. */
  marcar(id: string): void;
}

export function criarDicasVivas(gaveta: Gaveta | null): DicasVivas {
  let atual = lerDicas(gaveta);
  const trocar = (p: PreferenciasDeDicas): void => {
    atual = p;
    gravarDicas(gaveta, p);
  };
  return {
    get atual() {
      return atual;
    },
    ligar(ligadas) {
      trocar({ ...atual, ligadas });
    },
    marcar(id) {
      if (atual.vistas.includes(id)) return;
      trocar({ ...atual, vistas: [...atual.vistas, id] });
    },
  };
}
