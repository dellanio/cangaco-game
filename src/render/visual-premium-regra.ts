/**
 * I-TELA-PREMIUM-PROTOTIPO — as regras puras do visual premium (sem phaser, testaveis em Node): a chave da URL, quem
 * ganha sombra de contato e a elipse da sombra. A camada que desenha e `visual-premium.ts`.
 */
/** O protótipo liga com `?premium`; o padrao continua o jogo de hoje. */
export function visualPremium(busca: string): boolean {
  return new URLSearchParams(busca).has('premium');
}

/** O que ganha sombra, pelo prefixo da chave da textura: a largura da sombra em fracao da largura do objeto, e quanto
 *  o centro dela sobe do pe, em fracao da altura da sombra. O predio tem a base larga e alta: a sombra fica centrada no
 *  pe, um pouco a frente (subida negativa), e aparece a frente e dos lados; a unidade pisa um pouco a frente do meio. */
export const SOMBRA_POR_TIPO: Readonly<Record<string, { readonly largura: number; readonly subida: number }>> = {
  predio: { largura: 1.12, subida: -0.18 },
  vegetacao: { largura: 0.7, subida: 0.2 },
  enfeite: { largura: 0.7, subida: 0.2 },
  animal: { largura: 0.78, subida: 0.25 },
  unidade: { largura: 0.72, subida: 0.12 },
};
/** A sombra e uma elipse achatada: altura em fracao da largura. */
const ACHATAMENTO = 0.32;

export interface FormaDaSombra { readonly largura: number; readonly subida: number }

/** O estado do predio em obra (o esqueleto de madeira): obra nao tem sombra, so o predio pronto (pedido do operador,
 *  2026-10-16: a obra e revelada em blocos e a sombra escurecia o chao embaixo dela). */
export const ESTADO_DA_OBRA = 'madeira';

/** A forma da sombra pela chave da textura (`<tipo>:<id>:<estado>`), ou `null` se o objeto nao ganha sombra. */
export function fatorDaSombra(chave: string): FormaDaSombra | null {
  const [tipo = '', , estado] = chave.split(':');
  if (tipo === 'predio' && estado === ESTADO_DA_OBRA) return null;
  return SOMBRA_POR_TIPO[tipo] ?? null;
}

/** A elipse da sombra no mundo, a partir do pe e da largura do objeto. Regra pura. */
export function elipseDaSombra(pe: { x: number; y: number }, largura: number, forma: FormaDaSombra): { x: number; y: number; w: number; h: number } {
  const w = largura * forma.largura;
  const h = w * ACHATAMENTO;
  return { x: pe.x, y: pe.y - h * forma.subida, w, h };
}
