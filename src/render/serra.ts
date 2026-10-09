/** I-TELA-SERRA-DESGASTE-LOCAL: leitura pura; nao conhece Phaser nem muda a sim. */
import dados from '../../data/serra.json';
import { mascaraCardinal } from './mascara-cardinal';

export interface ConfigDaSerra {
  readonly limiares: readonly number[];
  readonly volumes: readonly number[];
  readonly escala: number;
}
export const configDaSerra: ConfigDaSerra = dados;
export interface RochaLida { readonly tipo: string; readonly quantidade: number }
export type RecursosDaSerra = Readonly<Record<string, RochaLida>>;

export function validarConfigDaSerra(config: ConfigDaSerra): boolean {
  return config.limiares.length === 4
    && config.volumes.length === 5
    && Number.isFinite(config.escala) && config.escala > 0
    && config.volumes.every((v, i) => Number.isInteger(v) && v > 0 && (i === 0 || v < config.volumes[i - 1]!))
    && config.limiares.every((v, i) => Number.isFinite(v) && v > 0 && v < 1 && (i === 0 || v < config.limiares[i - 1]!));
}

/** Limite pertence ao patamar menor: 12 de 15 ja e volume 12. */
export function volumeDaSerra(quantidade: number, rendimento: number, config: ConfigDaSerra = configDaSerra): number | null {
  if (!Number.isFinite(quantidade) || !Number.isFinite(rendimento) || rendimento <= 0) throw new Error('serra: quantidade/rendimento invalidos');
  if (!validarConfigDaSerra(config)) throw new Error('serra: configuracao invalida');
  if (quantidade <= 0) return null;
  const fracao = quantidade / rendimento;
  const indice = config.limiares.findIndex(limiar => fracao > limiar);
  return config.volumes[indice === -1 ? config.volumes.length - 1 : indice]!;
}

export function trechoDaSerra(recursos: RecursosDaSerra, gx: number, gy: number, rendimento: number): { readonly volume: number; readonly mascara: number; readonly altura: number; readonly estado: string } | null {
  const rocha = recursos[`${gx},${gy}`];
  if (rocha?.tipo !== 'rock') return null;
  const volume = volumeDaSerra(rocha.quantidade, rendimento);
  if (volume === null) return null;
  const mascara = mascaraCardinal((dx, dy) => {
    const vizinho = recursos[`${gx + dx},${gy + dy}`];
    return vizinho?.tipo === 'rock' && vizinho.quantidade > 0;
  });
  const altura = mascaraCardinal((dx, dy) => {
    const vizinho = recursos[`${gx + dx},${gy + dy}`];
    return vizinho?.tipo === 'rock' && (volumeDaSerra(vizinho.quantidade, rendimento) ?? 0) >= volume;
  });
  return { volume, mascara, altura, estado: `v${volume}:h${altura}:m${mascara}` };
}

/** Sem o volume nativo carregado, conserva a arte anterior; zero nunca cai no fallback. */
export function texturaDaSerra(trecho: ReturnType<typeof trechoDaSerra>, carregada: (chave: string) => boolean, anterior: string): string | null {
  if (!trecho) return null;
  const chave = `vegetacao:rock:${trecho.estado}`;
  return carregada(chave) ? chave : anterior;
}

/** Cache de leitura: uma selecao por tick/partida; quadros repetidos nao recalculam. */
export class MemoriaDaSerra {
  private recursos: RecursosDaSerra | null = null;
  private tick = -1;
  readonly trechos = new Map<string, NonNullable<ReturnType<typeof trechoDaSerra>>>();
  recalculos = 0;

  atualizar(recursos: RecursosDaSerra, tick: number, rendimento: number): readonly string[] {
    if (recursos === this.recursos && tick === this.tick) return [];
    this.recursos = recursos;
    this.tick = tick;
    this.recalculos++;
    const mudou: string[] = [];
    const restantes = new Set(this.trechos.keys());
    for (const [chave, recurso] of Object.entries(recursos)) {
      if (recurso.tipo !== 'rock' || recurso.quantidade <= 0) continue;
      const [gx, gy] = chave.split(',').map(Number);
      const trecho = trechoDaSerra(recursos, gx!, gy!, rendimento)!;
      if (this.trechos.get(chave)?.estado !== trecho.estado) mudou.push(chave);
      this.trechos.set(chave, trecho);
      restantes.delete(chave);
    }
    for (const chave of restantes) { this.trechos.delete(chave); mudou.push(chave); }
    return mudou;
  }
}
