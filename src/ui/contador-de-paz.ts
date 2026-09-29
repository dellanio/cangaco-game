// C-IA-03c (cenario de escaramuca: jogar pela tela) — o contador do PEACETIME, carimbado no
// quadro do minimapa como o aviso de pausa (aviso-tempo.ts). O operador: "o jogador precisa
// ver quanto falta". Some quando a paz acaba, e nao aparece no jogo livre (sem paz).
//
// So le o estado por seletor puro de `sim/` (`segundosDePazRestantes`) e escreve texto —
// nunca muda o jogo, nunca importa phaser. O rotulo vem de `theme-sertao.json` (`paz`).
import type { GameState } from '../sim/state';
import { segundosDePazRestantes } from '../sim/paz';
import temaSertao from '../../data/theme-sertao.json';

export interface ContadorDePaz {
  atualizar(estado: GameState): void;
}

/** `m:ss` de segundos inteiros. Tambem e o tempo da recusa em paz (C-TELA-01). */
export function mmss(segundos: number): string {
  const mm = Math.floor(segundos / 60);
  const ss = segundos % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** O texto do contador (`Paz: 9:58`), ou `''` quando ele some. Pura: e o que o teste prova. */
export function textoDoContador(segundos: number, rotulo: string = temaSertao.paz.rotulo): string {
  if (segundos <= 0) return '';
  return rotulo.replace('{tempo}', mmss(segundos));
}

/** Cria o elemento uma vez, dentro de `#minimapa`, e so escreve quando o texto muda. */
export function montarContadorDePaz(): ContadorDePaz {
  const minimapa = document.getElementById('minimapa');
  if (!minimapa) throw new Error('contador-de-paz: #minimapa nao existe no index.html');
  const elemento = document.createElement('div');
  elemento.className = 'contador-de-paz';
  elemento.dataset.campo = 'paz';
  elemento.setAttribute('role', 'timer');
  elemento.hidden = true;
  minimapa.append(elemento);
  let ultimo = '';
  return {
    atualizar(estado) {
      const texto = textoDoContador(segundosDePazRestantes(estado));
      if (texto === ultimo) return;
      ultimo = texto;
      elemento.textContent = texto;
      elemento.hidden = texto === '';
    },
  };
}
