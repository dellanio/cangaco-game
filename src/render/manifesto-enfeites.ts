/** Validacao adicional SOMENTE do tipo decorativo; os demais contratos nao mudam. */
export function errosDoEnfeite(entrada: unknown): readonly string[] {
  if (!entrada || typeof entrada !== 'object') return ['entrada'];
  const e = entrada as Record<string, unknown>;
  if (e.tipo !== 'enfeite') return [];
  const erros: string[] = [];
  for (const campo of ['id', 'licenca']) if (typeof e[campo] !== 'string' || !e[campo]) erros.push(campo);
  const anchor = e.anchor;
  if (!Array.isArray(anchor) || anchor.length !== 2 || anchor.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) erros.push('anchor');
  // I-TELA-ENFEITES-EM-SITIOS: a tapera (a casa velha do sitio) ocupa 2x2; o resto, 1x1. O tamanho cabe nos tiles dele.
  const footprint = Array.isArray(e.footprint) && e.footprint.length === 2 && e.footprint.every(n => n === 1 || n === 2) ? e.footprint as number[] : null;
  if (footprint === null) erros.push('footprint');
  if (!Array.isArray(e.tamanho) || e.tamanho.length !== 2 || e.tamanho.some((n, i) => typeof n !== 'number' || !Number.isInteger(n) || n <= 0 || n > 64 * (footprint?.[i] ?? 1))) erros.push('tamanho');
  if (!e.estados || typeof e.estados !== 'object' || !Object.values(e.estados).length || Object.values(e.estados).some(n => typeof n !== 'string' || !n)) erros.push('estados');
  if (!e.origem || typeof e.origem !== 'object' || typeof (e.origem as Record<string, unknown>).base !== 'string') erros.push('origem');
  return erros;
}
