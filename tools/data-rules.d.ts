// Assinatura de tipos para tools/data-rules.js (CommonJS deliberado — ver
// PROGRESS.md, "validador sem dependencia nova"). Permite que testes em
// TypeScript estrito importem o modulo sem `allowJs`.
export function validarTudo(dados: Record<string, unknown>): string[];
export function getByPath(obj: unknown, caminho: string): { existe: boolean; valor: unknown };
