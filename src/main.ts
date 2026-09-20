// Entrada do Vite. Ate a F04, isto era `export {}` — o render nao existia.
// A partir da F05b, main.ts e o dono do GameState: render e HUD recebem por
// chamada, nunca guardam referencia no momento da criacao. Quando a F11
// trouxer o laco de 10 Hz, a ligacao vira uma linha
// (setInterval(() => atualizar(state = step(state, [])), TICK_MS)), nao uma
// refatoracao.
import { createInitialState } from './sim/state';
import type { GameState } from './sim/state';
import { gameData } from './sim/data';
import { iniciarJogo } from './render/game';
import { montarHud } from './ui/hud';

const estado = createInitialState(gameData.economia.estadoInicial.semente);
const jogo = iniciarJogo();
const hud = montarHud();

function atualizar(s: GameState): void {
  jogo.atualizar(s);
  hud.atualizar(s);
}

atualizar(estado);
