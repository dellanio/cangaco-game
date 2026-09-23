// Entrada do Vite. Ate a F04, isto era `export {}` — o render nao existia.
//
// A Sessao (src/sessao.ts) e dona do GameState e da fila de comandos; render, HUD
// e painel recebem o estado por chamada (`atualizar`), nunca guardam referencia no
// momento da criacao.
//
// O LACO (src/laco.ts, F11a) e quem faz o tempo passar: a cada quadro do navegador ele roda
// os `passo()` devidos a `TICK_MS`. Desde a F11a o clique so ENFILEIRA o comando; ele so e
// aplicado no proximo passo — e, com o jogo pausado, so quando o jogador retomar.
//
// A ferramenta ativa (F06) tambem nasce aqui, mas NAO e estado de jogo: e o que o
// jogador tem na mao (qual planta fantasma), some com Esc e nunca entra em
// GameState.
import { createInitialState } from './sim/state';
import type { GameState } from './sim/state';
import { gameData } from './sim/data';
import { criarSessao } from './sessao';
import { criarLaco, nascerPausadoPelaUrl, pausarAoOcultar } from './laco';
import { iniciarJogo } from './render/game';
import { montarHud } from './ui/hud';
import { montarMenuBuild } from './ui/menu-build';
import { montarPainelPredio } from './ui/painel-predio';
import { montarAvisoDoTempo } from './ui/aviso-tempo';
import { criarFerramenta } from './input/ferramenta';
import { criarSelecao } from './input/selecao';
import { criarEntradaDoMapa } from './input/colocar';
import { ligarTeclado } from './input/teclado';
import { ligarTeclasDoTempo } from './input/teclas-do-tempo';
import { predioNoTile } from './sim/selectors';

const sessao = criarSessao(createInitialState(gameData.economia.estadoInicial.semente));
const ferramenta = criarFerramenta();
// O predio aberto no painel (F13b). Estado de interface, como a ferramenta.
const selecao = criarSelecao();
ligarTeclado(ferramenta, window, selecao);

// O laco. `?pausado` na URL o faz NASCER pausado: e o que o runner de screenshot usa para todo
// roteiro comecar no tick 0, sem a janela de ticks que existiria entre carregar a pagina e
// pausar depois do aperto de mao. Nao e superficie de jogador.
const laco = criarLaco({
  passo: () => {
    sessao.passo();
  },
  tickMs: gameData.tempo.tickMs,
  velocidades: gameData.tempo.velocidadeDeJogo.opcoes,
  velocidadePadrao: gameData.tempo.velocidadeDeJogo.padrao,
  nascerPausado: nascerPausadoPelaUrl(window.location.search),
});
ligarTeclasDoTempo(laco, window);
// aba oculta pausa; voltar a aba NAO retoma (o jogador aperta P)
pausarAoOcultar(laco, document);

// So enfileira. Quem roda o passo que aplica o comando e o laco.
// O terceiro parametro e o clique de MAO VAZIA (F13b): quem sabe que predio esta
// naquele tile e este arquivo, que tem o estado — `input/` nao conhece GameState.
const entrada = criarEntradaDoMapa(
  ferramenta,
  (comando) => {
    sessao.enviar(comando);
  },
  (tile) => {
    selecao.selecionar(predioNoTile(sessao.estado, tile.gx, tile.gy));
  },
);

// HUD e painel ANTES do jogo: o Phaser mede o pai no boot e o layout tem que
// estar assentado (as dimensoes sao fixas no CSS, mas nao custa a ordem certa).
const hud = montarHud();
const aviso = montarAvisoDoTempo();
const menu = montarMenuBuild(ferramenta);
// UM painel para todo predio (F16b). A fila da escola virou uma secao dele.
const painel = montarPainelPredio(selecao, (comando) => {
  sessao.enviar(comando);
});

const jogo = iniciarJogo(ferramenta, entrada, laco);

function atualizar(s: GameState): void {
  jogo.atualizar(s);
  hud.atualizar(s);
  menu.atualizar(s);
  painel.atualizar(s);
}

sessao.aoMudar(atualizar);
// O painel abre NO CLIQUE, sem esperar o proximo tick: com o jogo pausado nao
// viria nenhum, e o painel so apareceria quando o jogador retomasse.
selecao.aoMudar(() => {
  painel.atualizar(sessao.estado);
});
atualizar(sessao.estado);
aviso.atualizar(laco.pausado, laco.velocidade);

// O relogio do navegador dirige o laco. Isto NAO e o `update()` da cena: o laco e do laco
// externo, nao do render (CLAUDE.md §10).
function quadro(agoraMs: number): void {
  laco.tique(agoraMs);
  aviso.atualizar(laco.pausado, laco.velocidade);
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
