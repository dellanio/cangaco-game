import type { GameState } from '../sim/state';

export interface ConfigDosAneis {
  readonly semente: number;
  readonly maximoNaVista: number;
  readonly vidaTicks: number;
  readonly intervaloDoPeixeTicks: number;
  readonly intervaloDoPescadorTicks: number;
  readonly raioInicialTiles: number;
  readonly raioFinalTiles: number;
  readonly opacidadeInicial: number;
  readonly espessuraPx: number;
  readonly cor: string;
}
export interface VistaDosAneis {
  readonly x: number; readonly y: number;
  readonly largura: number; readonly altura: number;
  readonly larguraMapa: number; readonly alturaMapa: number;
}
export interface PescadorNaAgua {
  readonly id: string; readonly fsm: string; readonly gx: number; readonly gy: number;
}
export interface AnelDaAgua {
  readonly id: string; readonly tipo: 'peixe' | 'pescador';
  readonly gx: number; readonly gy: number; readonly nascimento: number;
  readonly raio: number; readonly opacidade: number;
}

/** Le a tarefa, nunca o tile da unidade na margem; nao escreve na simulacao. */
export function pescadoresNaAgua(estado: GameState): PescadorNaAgua[] {
  return estado.unidades.ordem.flatMap((id) => {
    const u = estado.unidades.porId[id];
    if (!u || u.tipo !== 'fisherman' || u.fsm !== 'colhendo') return [];
    const tarefa = u.fsmData.tarefa ? estado.jobs.tarefas.porId[u.fsmData.tarefa] : undefined;
    return tarefa?.tipo === 'colher' ? [{ id, fsm: u.fsm, ...tarefa.origemTile }] : [];
  });
}

function hash(semente: number, ciclo: number, sal: number): number {
  let h = Math.imul(semente ^ sal, 0x9e3779b1) ^ Math.imul(ciclo, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Um nascimento por ciclo de peixe, com instante e tile por hash da semente.
 * Reconstrucao pelo tempo, sem RNG, objetos Phaser ou memoria entre quadros. */
export function aneisDaAgua(
  config: ConfigDosAneis, tick: number, alfa: number, vista: VistaDosAneis,
  ehAgua: (gx: number, gy: number) => boolean, pescadores: readonly PescadorNaAgua[],
): AnelDaAgua[] {
  const tempo = tick + alfa;
  const aneis: AnelDaAgua[] = [];
  const dentro = (gx: number, gy: number) => gx >= 0 && gy >= 0
    && gx < vista.larguraMapa && gy < vista.alturaMapa
    && gx + 0.5 >= vista.x && gx + 0.5 < vista.x + vista.largura
    && gy + 0.5 >= vista.y && gy + 0.5 < vista.y + vista.altura;
  const adicionar = (id: string, tipo: AnelDaAgua['tipo'], gx: number, gy: number, nascimento: number) => {
    const idade = tempo - nascimento;
    if (nascimento < 0 || idade < 0 || idade >= config.vidaTicks
      || !dentro(gx, gy) || !ehAgua(gx, gy) || aneis.length >= config.maximoNaVista) return;
    const fracao = idade / config.vidaTicks;
    aneis.push({ id, tipo, gx, gy, nascimento,
      raio: config.raioInicialTiles + (config.raioFinalTiles - config.raioInicialTiles) * fracao,
      opacidade: config.opacidadeInicial * (1 - fracao) });
  };
  for (const p of pescadores) {
    if (p.fsm !== 'colhendo' || !dentro(p.gx, p.gy)) continue;
    const intervalo = config.intervaloDoPescadorTicks;
    for (let n = Math.max(0, (Math.floor((tempo - config.vidaTicks) / intervalo) + 1)) * intervalo;
      n <= tempo; n += intervalo) adicionar(`pescador:${p.id}:${n}`, 'pescador', p.gx, p.gy, n);
  }
  const agua: { gx: number; gy: number }[] = [];
  for (let gy = Math.max(0, Math.floor(vista.y)); gy < Math.min(vista.alturaMapa, Math.ceil(vista.y + vista.altura)); gy += 1)
    for (let gx = Math.max(0, Math.floor(vista.x)); gx < Math.min(vista.larguraMapa, Math.ceil(vista.x + vista.largura)); gx += 1)
      if (dentro(gx, gy) && ehAgua(gx, gy)) agua.push({ gx, gy });
  if (agua.length === 0) return aneis;
  const intervalo = config.intervaloDoPeixeTicks;
  for (let ciclo = Math.max(0, Math.floor((tempo - config.vidaTicks) / intervalo)); ciclo <= Math.floor(tempo / intervalo); ciclo += 1) {
    const nascimento = ciclo * intervalo + hash(config.semente, ciclo, 1) % intervalo;
    const tile = agua[hash(config.semente, ciclo, 2) % agua.length];
    if (tile) adicionar(`peixe:${ciclo}`, 'peixe', tile.gx, tile.gy, nascimento);
  }
  return aneis;
}
