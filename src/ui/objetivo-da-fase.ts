// I-TELA-MENU-DA-CAMPANHA — a linha do objetivo da fase, no alto da tela. So LE o estado e escreve
// texto (`objetivoEmTexto`, em `src/campanha.ts`); fora da campanha fica escondida.
import temaSertao from '../../data/theme-sertao.json';
import type { GameState } from '../sim/state';

export interface ObjetivoDaFase {
  atualizar(estado: GameState): void;
}

/** Cria a linha uma vez. `texto` e quem traduz o estado em objetivo (o `objetivoEmTexto`). */
export function montarObjetivoDaFase(texto: (estado: GameState) => string | null): ObjetivoDaFase {
  const elemento = document.createElement('div');
  elemento.id = 'objetivo-da-fase';
  elemento.setAttribute('role', 'status');
  elemento.hidden = true;
  const rotulo = document.createElement('strong');
  rotulo.textContent = `${temaSertao.campanha.objetivo}: `;
  const corpo = document.createElement('span');
  elemento.append(rotulo, corpo);
  document.body.append(elemento);
  let ultimo: string | null = null;
  return {
    atualizar(estado) {
      const agora = texto(estado);
      if (agora === ultimo) return;
      ultimo = agora;
      elemento.hidden = agora === null;
      corpo.textContent = agora ?? '';
    },
  };
}
