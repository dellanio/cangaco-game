// Assinatura de tipos para tools/data-rules.js (CommonJS deliberado — ver
// PROGRESS.md, "validador sem dependencia nova"). Permite que testes em
// TypeScript estrito importem o modulo sem `allowJs`.
export function validarTudo(dados: Record<string, unknown>): string[];
export function getByPath(obj: unknown, caminho: string): { existe: boolean; valor: unknown };
export function validarInterface(dados: Record<string, unknown>, interfaceUi: Record<string, unknown>): string[];
export function validarVento(vento: unknown, erros: string[], manifesto?: unknown): void;
export function validarPoeira(poeira: unknown, erros: string[]): void;

export function validarFumaca(fumaca: unknown, erros: string[]): void;
export function validarBandeira(bandeira: unknown, erros: string[]): void;
export function validarSom(
  som: unknown, erros: string[], opcoes?: { eventosDaSim?: readonly string[]; manifesto?: unknown },
): void;
