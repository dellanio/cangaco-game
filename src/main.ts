// Entrada do Vite. Ate a F04, isto era `export {}` — o render nao existia.
//
// A Sessao (src/sessao.ts) e dona do GameState e da fila de comandos; render, HUD
// e painel recebem o estado por chamada (`atualizar`), nunca guardam referencia no
// momento da criacao.
//
// A ferramenta ativa (F06) tambem nasce aqui, mas NAO e estado de jogo: e o que o
// jogador tem na mao (qual planta fantasma), some com Esc e nunca entra em
// GameState.
import { createInitialState } from './sim/state';
import type { GameState } from './sim/state';
import { gameData } from './sim/data';
import { criarSessao } from './sessao';
import { iniciarJogo } from './render/game';
import { montarHud } from './ui/hud';
import { montarMenuBuild } from './ui/menu-build';
import { criarFerramenta } from './input/ferramenta';
import { criarEntradaDoMapa } from './input/colocar';
import { ligarTeclado } from './input/teclado';

const sessao = criarSessao(createInitialState(gameData.economia.estadoInicial.semente));
const ferramenta = criarFerramenta();
ligarTeclado(ferramenta, window);

// PROVISORIO ATE A F11 (BUILD_PLAN, notas da F07 e da F11): cada clique enfileira o
// comando E roda um passo(), entao o tick avanca 1 por comando. Quando o relogio
// de 10 Hz chegar, a mudanca e SO esta linha — quem chama passo() vira um timer de
// TICK_MS —, e nem a fila nem a Sessao mudam.
const entrada = criarEntradaDoMapa(ferramenta, (comando) => {
  sessao.enviar(comando);
  sessao.passo();
});

// HUD e painel ANTES do jogo: o Phaser mede o pai no boot e o layout tem que
// estar assentado (as dimensoes sao fixas no CSS, mas nao custa a ordem certa).
const hud = montarHud();
const menu = montarMenuBuild(ferramenta);
const jogo = iniciarJogo(ferramenta, entrada);

function atualizar(s: GameState): void {
  jogo.atualizar(s);
  hud.atualizar(s);
  menu.atualizar(s);
}

sessao.aoMudar(atualizar);
atualizar(sessao.estado);
