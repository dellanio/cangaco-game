// F34 — o aviso do fim da escaramuca, sobre o jogo. So LE o estado (`state.partida`,
// gravado pela sim em `sim/partida.ts`) e escreve texto: nunca muda o jogo, nunca
// importa phaser. Os rotulos vem de `data/theme-sertao.json` (`partida`).
import temaSertao from '../../data/theme-sertao.json';
import type { GameState } from '../sim/state';

export interface FimDePartida {
  atualizar(estado: GameState): void;
}

export interface TextoDoFim {
  readonly titulo: string;
  readonly descricao: string;
}

/** O texto do aviso, ou `null` enquanto a partida corre. Pura: e o que o teste prova. */
export function textoDoFim(estado: GameState, rotulos = temaSertao.partida): TextoDoFim | null {
  if (estado.partida === undefined) return null;
  return estado.partida.fim === 'vitoria'
    ? { titulo: rotulos.vitoria, descricao: rotulos.vitoriaDesc }
    : { titulo: rotulos.derrota, descricao: rotulos.derrotaDesc };
}

/** Cria o aviso uma vez, no `body` (fixo sobre a area do jogo, pelo CSS), e so reescreve
 *  quando o fim muda. */
export function montarFimDePartida(): FimDePartida {
  const elemento = document.createElement('div');
  elemento.id = 'fim-de-partida';
  elemento.setAttribute('role', 'status');
  elemento.hidden = true;
  const titulo = document.createElement('h2');
  const descricao = document.createElement('p');
  elemento.append(titulo, descricao);
  document.body.append(elemento);
  let ultimo: string | null = null;
  return {
    atualizar(estado) {
      const texto = textoDoFim(estado);
      const chave = estado.partida?.fim ?? null;
      if (chave === ultimo) return;
      ultimo = chave;
      elemento.hidden = texto === null;
      elemento.dataset.fim = chave ?? '';
      titulo.textContent = texto?.titulo ?? '';
      descricao.textContent = texto?.descricao ?? '';
    },
  };
}
