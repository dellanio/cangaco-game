// Entrada do Vite. Ate a F04, isto era `export {}` — o render nao existia.
// A partir da F05b, main.ts e o dono do GameState: render e HUD recebem por
// chamada, nunca guardam referencia no momento da criacao. Quando a F11
// trouxer o laco de 10 Hz, a ligacao vira uma linha
// (setInterval(() => atualizar(state = step(state, [])), TICK_MS)), nao uma
// refatoracao.
//
// A ferramenta ativa (F06) tambem nasce aqui, mas NAO e estado de jogo: e o que
// o jogador tem na mao (qual planta fantasma), some com Esc e nunca entra em
// GameState.
import { createInitialState } from './sim/state';
import type { GameState } from './sim/state';
import { gameData } from './sim/data';
import { iniciarJogo } from './render/game';
import { montarHud } from './ui/hud';
import { montarMenuBuild } from './ui/menu-build';
import { criarFerramenta } from './input/ferramenta';
import { ligarTeclado } from './input/teclado';

const estado = createInitialState(gameData.economia.estadoInicial.semente);
const ferramenta = criarFerramenta();
ligarTeclado(ferramenta, window);

// HUD e painel ANTES do jogo: o Phaser mede o pai no boot e o layout tem que
// estar assentado (as dimensoes sao fixas no CSS, mas nao custa a ordem certa).
const hud = montarHud();
const menu = montarMenuBuild(ferramenta);
const jogo = iniciarJogo(ferramenta);

function atualizar(s: GameState): void {
  jogo.atualizar(s);
  hud.atualizar(s);
  menu.atualizar(s);
}

atualizar(estado);
