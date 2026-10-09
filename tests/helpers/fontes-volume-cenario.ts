import { gameData } from '../../src/sim/data';
import { step } from '../../src/sim/tick';
import type { GameState } from '../../src/sim/state';
import { estadoDaFonte } from '../../src/render/fontes-naturais';
import { cenarioDaCadeiaDoOuro, cenarioDaCadeiaDoFerro, comEspacoNaSaida } from './producao-cenario';

/** Fixture de extracao: mapa/rendimentos reais. Saida esvaziada imita transporte para liberar a mina. */
export function extracaoDaFonte(tipo: string): { chave: string; fases: { estado: string; jogo: GameState }[] } {
  let jogo = tipo === 'iron_ore' ? cenarioDaCadeiaDoFerro(gameData) : cenarioDaCadeiaDoOuro(gameData);
  const id = tipo === 'coal' ? 'co1' : tipo === 'iron_ore' ? 'fe1' : 'go1';
  const inicio = jogo;
  const rendimento = gameData.recursos.tipos[tipo]!.rendimentoPorTile;
  let chave: string | null = null;
  const fases: { estado: string; jogo: GameState }[] = [];
  for (let n = 0; n < 12000; n++) {
    jogo = comEspacoNaSaida(step(jogo, [], gameData), id);
    chave ??= Object.keys(inicio.recursos).find(k => inicio.recursos[k]?.tipo === tipo && (jogo.recursos[k]?.quantidade ?? 0) < inicio.recursos[k]!.quantidade) ?? null;
    if (chave === null) continue;
    if (fases.length === 0) fases.push({ estado: 'presente', jogo: inicio });
    const estado = estadoDaFonte(jogo.recursos[chave]?.quantidade ?? 0, rendimento) ?? 'zero';
    if (!fases.some(f => f.estado === estado)) fases.push({ estado, jogo });
    if (estado === 'zero') return { chave, fases };
  }
  throw new Error(`Extracao ${tipo} nao completou quatro fases em 12000 ticks`);
}
