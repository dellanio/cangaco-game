/**
 * H-TELA-OPCOES-E-VOLUME — o volume que o jogador escolheu, e a regra do volume que toca.
 *
 * Preferencia de quem joga nesta maquina, e nao estado de partida: mora no `localStorage`
 * (`CHAVE_DO_SOM`), FORA do save — como a marca da ajuda (`ui/ajuda.ts`). Nada daqui entra no
 * `GameState`. TypeScript puro, sem DOM: a gaveta entra por parametro, e o teste passa uma de
 * mentira. Mora no laco externo porque o menu inicial (antes do Phaser) e o jogo a leem.
 */
import type { Gaveta } from './arquivo-da-partida';

export const CANAIS = ['efeitos', 'ambiente', 'musica'] as const;
export type Canal = (typeof CANAIS)[number];

export interface PreferenciasDeSom {
  readonly geral: number;
  readonly efeitos: number;
  readonly ambiente: number;
  readonly musica: number;
  readonly mudo: boolean;
}

/** A chave no `localStorage`. */
export const CHAVE_DO_SOM = 'cangaco:som';

/** Os volumes de `data/som.json` (`volumePadrao`), sem o mudo. */
export type VolumePadrao = Readonly<Record<'geral' | Canal, number>>;

export function preferenciasPadrao(padrao: VolumePadrao): PreferenciasDeSom {
  return { geral: padrao.geral, efeitos: padrao.efeitos, ambiente: padrao.ambiente, musica: padrao.musica, mudo: false };
}

const limitar = (v: number): number => Math.min(1, Math.max(0, v));

/** O volume que toca: geral x canal, de 0 a 1; o mudo zera. */
export function volumeEfetivo(p: PreferenciasDeSom, canal: Canal): number {
  if (p.mudo) return 0;
  return limitar(p.geral) * limitar(p[canal]);
}

/**
 * O que esta guardado, com o padrao no que faltar ou nao servir (texto que nao e JSON, numero
 * fora de [0, 1], campo de outro tipo). A gaveta que lanca (navegador que bloqueia) e o padrao.
 */
export function lerPreferencias(gaveta: Gaveta | null, padrao: VolumePadrao): PreferenciasDeSom {
  const base = preferenciasPadrao(padrao);
  let texto: string | null;
  try {
    texto = gaveta?.getItem(CHAVE_DO_SOM) ?? null;
  } catch {
    return base;
  }
  if (texto === null) return base;
  let lido: unknown;
  try {
    lido = JSON.parse(texto);
  } catch {
    return base;
  }
  if (lido === null || typeof lido !== 'object') return base;
  const o = lido as Record<string, unknown>;
  const numero = (chave: 'geral' | Canal): number => {
    const v = o[chave];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : base[chave];
  };
  return {
    geral: numero('geral'), efeitos: numero('efeitos'), ambiente: numero('ambiente'), musica: numero('musica'),
    mudo: typeof o['mudo'] === 'boolean' ? o['mudo'] : base.mudo,
  };
}

/** Guarda. A gaveta que lanca e engolida: sem `localStorage`, a escolha vale ate fechar a pagina. */
export function gravarPreferencias(gaveta: Gaveta | null, p: PreferenciasDeSom): void {
  try {
    gaveta?.setItem(CHAVE_DO_SOM, JSON.stringify(p));
  } catch {
    // o pior caso aceitavel: o volume volta ao padrao na proxima visita
  }
}

/** A preferencia em uso nesta pagina: o menu e o jogo leem a mesma. */
export interface PreferenciasVivas {
  readonly atual: PreferenciasDeSom;
  /** Troca e guarda na gaveta. */
  mudar(p: PreferenciasDeSom): void;
}

export function criarPreferenciasVivas(gaveta: Gaveta | null, padrao: VolumePadrao): PreferenciasVivas {
  let atual = lerPreferencias(gaveta, padrao);
  return {
    get atual() {
      return atual;
    },
    mudar(p) {
      atual = p;
      gravarPreferencias(gaveta, p);
    },
  };
}

/** O canal de um id de som pelo dado (`sons[id].canal`); sem canal, efeitos. */
export function canalDoSom(sons: Readonly<Record<string, { readonly canal?: string }>>, id: string): Canal {
  const c = sons[id]?.canal;
  return (CANAIS as readonly string[]).includes(c ?? '') ? (c as Canal) : 'efeitos';
}
