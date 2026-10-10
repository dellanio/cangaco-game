/**
 * I-TELA-ACUDE-NA-TELA — o Acude na tela: o estado do sprite pelo nivel de agua. Puro e sem Phaser; os
 * numeros sao de `data/acude-visual.json`. A agua e a capacidade sao da sim (`PredioCompleto.agua`,
 * `acude.capacidade`), lidas, nunca escritas.
 */
export const ESTADOS_DO_ACUDE = ['vazio', 'baixo', 'medio', 'cheio'] as const;
export type EstadoDoAcude = (typeof ESTADOS_DO_ACUDE)[number];

export interface ConfigDoAcudeVisual {
  readonly cortes: { readonly baixo: number; readonly medio: number; readonly cheio: number };
  readonly raio: { readonly cor: string; readonly alfa: number; readonly espessuraPx: number; readonly preenchimentoAlfa: number };
}

/** O estado do sprite pela fracao `agua / capacidade`: o maior corte alcancado; abaixo de todos, `vazio`. */
export function estadoDoAcude(agua: number, capacidade: number, config: ConfigDoAcudeVisual): EstadoDoAcude {
  const f = capacidade <= 0 ? 0 : agua / capacidade;
  if (f >= config.cortes.cheio) return 'cheio';
  if (f >= config.cortes.medio) return 'medio';
  if (f >= config.cortes.baixo) return 'baixo';
  return 'vazio';
}
