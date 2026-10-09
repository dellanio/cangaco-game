import dados from '../../data/fontes-naturais.json';
export const configDasFontes = dados;
type Recursos = Readonly<Record<string, { readonly tipo: string; readonly quantidade: number }>>;
export interface FonteDesenhavel { readonly tipo: string; readonly estado: string; readonly quantidade: number }
export function estadoDaFonte(quantidade: number, rendimento: number, config = configDasFontes): string | null {
  if (!Number.isFinite(rendimento) || rendimento <= 0) throw new Error('Rendimento precisa ser positivo');
  if (config.limiares.length !== 2 || config.estados.length !== 3 || config.limiares.some((l, i) => !Number.isFinite(l) || l <= 0 || l >= 1 || (i > 0 && l >= config.limiares[i - 1]!))) throw new Error('Limiares invalidos');
  if (quantidade <= 0) return null;
  const fracao = quantidade / rendimento;
  return config.estados[fracao >= config.limiares[0]! ? 0 : fracao >= config.limiares[1]! ? 1 : 2]!;
}
export function texturaDaFonte(fonte: FonteDesenhavel | undefined, carregada: (chave: string) => boolean): string | null {
  if (!fonte) return null;
  const desejada = `recurso:${fonte.tipo}:${fonte.estado}`;
  if (carregada(desejada)) return desejada;
  const normal = `recurso:${fonte.tipo}:presente`;
  return carregada(normal) ? normal : null;
}
/** Leitura por tick/partida; so mudanca de estado causa repintura. */
export class MemoriaDasFontes {
  private recursos: Recursos | null = null;
  private tick = -1;
  readonly fontes = new Map<string, FonteDesenhavel>();
  recalculos = 0;
  atualizar(recursos: Recursos, tick: number, rendimentos: Readonly<Record<string, number>>): readonly string[] {
    if (recursos === this.recursos && tick === this.tick) return [];
    this.recursos = recursos; this.tick = tick; this.recalculos++;
    const mudou: string[] = [], restantes = new Set(this.fontes.keys());
    for (const [chave, recurso] of Object.entries(recursos)) {
      if (!configDasFontes.tipos.includes(recurso.tipo)) continue;
      const estado = estadoDaFonte(recurso.quantidade, rendimentos[recurso.tipo]!);
      if (estado === null) continue;
      const antiga = this.fontes.get(chave);
      if (antiga?.estado !== estado || antiga.tipo !== recurso.tipo) mudou.push(chave);
      this.fontes.set(chave, { tipo: recurso.tipo, estado, quantidade: recurso.quantidade }); restantes.delete(chave);
    }
    for (const chave of restantes) { this.fontes.delete(chave); mudou.push(chave); }
    return mudou;
  }
}
