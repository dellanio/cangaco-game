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
import { createInitialState, LADO_DO_JOGADOR } from './sim/state';
import type { GameState } from './sim/state';
import { gameData } from './sim/data';
import { criarSessao } from './sessao';
import { acompanharFimDePartida, criarLaco, nascerPausadoPelaUrl, pausarAoOcultar } from './laco';
import { iniciarJogo } from './render/game';
import { montarHud } from './ui/hud';
import { montarMenuBuild } from './ui/menu-build';
import { resolvedorDeIcones } from './ui/icones';
import type { IconesDoManifesto } from './ui/icones';
import manifestoJson from '../assets/manifest.json';
import { urlsDeSprites } from './render/sprites-urls';
import { montarPainelPredio } from './ui/painel-predio';
import { montarAlertas } from './ui/alertas';
import { montarAvisoDoTempo } from './ui/aviso-tempo';
import { montarFimDePartida } from './ui/fim-de-partida';
import { montarAjuda } from './ui/ajuda';
import { montarBarra } from './ui/barra';
import { montarArquivo } from './ui/arquivo';
import { criarArquivoDaPartida } from './arquivo-da-partida';
import { criarFerramenta } from './input/ferramenta';
import { criarSelecao } from './input/selecao';
import { criarEntradaDoMapa } from './input/colocar';
import { ligarTeclado } from './input/teclado';
import { ligarTeclasDoTempo } from './input/teclas-do-tempo';
import { ligarNavegacao } from './input/navegacao';
import { configDoMapa } from './render/mapa';
import { predioNoTile } from './sim/selectors';
import { classeDaUnidade } from './sim/condicao';
import { criarSelecaoMilitar } from './input/selecao-militar';
import { montarPainelGrupo } from './ui/painel-grupo';
import { montarContadorDePaz } from './ui/contador-de-paz';
import { montarAvisoDeOrdem, recusaDaPaz } from './ui/aviso-de-ordem';
import { ordemDoBotaoDireito } from './ui/ordem-militar';
import { criarEscaramuca } from './sim/cenario';

// C-IA-03c — `?escaramuca` nasce na escaramuca (cenario provisorio, sim/cenario.ts); sem ele,
// o jogo livre de sempre. O botao "Nova escaramuca" do painel H faz o mesmo no meio do jogo.
const SEMENTE = gameData.economia.estadoInicial.semente;
const nascerNaEscaramuca = new URLSearchParams(window.location.search).has('escaramuca');
const sessao = criarSessao(nascerNaEscaramuca ? criarEscaramuca(SEMENTE) : createInitialState(SEMENTE));
const ferramenta = criarFerramenta();
// O predio aberto no painel (F13b). Estado de interface, como a ferramenta.
const selecao = criarSelecao();
// F26b — o grupo militar na mao. Estado de interface, como a selecao de predio: as duas
// nao convivem (selecionar soldado fecha o painel; abrir predio solta o grupo).
const selecaoMilitar = criarSelecaoMilitar();
// A ajuda (F-D1) precisa do `#logo` ja no DOM, e ele e estatico no index.html —
// entao ela pode nascer antes do resto da interface. Quem a abre e o teclado, e
// e por isso que ela e o quarto parametro: com a ajuda aberta, o `Esc` e dela.
const ajuda = montarAjuda();
ligarTeclado(ferramenta, window, selecao, ajuda);

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
/** F26b — so os soldados do JOGADOR entram no grupo: civil nao recebe ordem direta
 *  (§1), e o inimigo nao e do jogador. A lista vem do desenho (`jogo.unidadesNoPonto`),
 *  e o filtro, do estado. */
function soldadosDoJogador(ids: readonly string[]): string[] {
  return ids.filter((id) => {
    const u = sessao.estado.unidades.porId[id];
    return u !== undefined && u.lado === LADO_DO_JOGADOR && classeDaUnidade(u.tipo, gameData) === 'militar';
  });
}

const entrada = criarEntradaDoMapa(
  ferramenta,
  (comando) => {
    sessao.enviar(comando);
  },
  (tile) => {
    selecao.selecionar(predioNoTile(sessao.estado, tile.gx, tile.gy));
  },
  {
    aoClicarVazio(tile, ponto, somar) {
      // soldado sob o pixel vence o predio do tile: e ele que o jogador mirou
      const [soldado] = ponto === null ? [] : soldadosDoJogador(jogo.unidadesNoPonto(ponto));
      if (soldado !== undefined) {
        selecao.limpar();
        if (somar) selecaoMilitar.somar([soldado]);
        else selecaoMilitar.definir([soldado]);
        return;
      }
      if (!somar) selecaoMilitar.limpar();
      selecao.selecionar(predioNoTile(sessao.estado, tile.gx, tile.gy));
    },
    aoCaixa(a, b, somar) {
      const soldados = soldadosDoJogador(jogo.unidadesNaCaixa(a, b));
      selecao.limpar();
      if (somar) selecaoMilitar.somar(soldados);
      else selecaoMilitar.definir(soldados);
    },
    aoOrdenar(tile, ponto) {
      // unidade inimiga sob o ponteiro e ataque (C-TELA-04); predio de OUTRO lado tambem
      // (F26b); no resto e marcha (GDD §2.1). Quem decide e `ui/ordem-militar.ts`.
      const ordem = ordemDoBotaoDireito(
        sessao.estado, gameData, LADO_DO_JOGADOR, soldadosDoJogador(selecaoMilitar.ids), tile,
        ponto === null ? [] : jogo.unidadesNoPonto(ponto),
      );
      for (const comando of ordem.comandos) sessao.enviar(comando);
      // C-TELA-02: a marca aparece no clique, mesmo pausado (retorno imediato, GDD §10)
      if (ordem.marcarDestino !== null) jogo.marcarDestino(ordem.marcarDestino);
    },
  },
);

// HUD e painel ANTES do jogo: o Phaser mede o pai no boot e o layout tem que
// estar assentado (as dimensoes sao fixas no CSS, mas nao custa a ordem certa).
const hud = montarHud();
const aviso = montarAvisoDoTempo();
// Os icones do menu: o trecho `icones` do manifesto mais as URLs que o bundler
// resolveu. Juntados AQUI, na raiz de composicao, para `ui/` nao falar com o
// bundler nem parsear caminho (CLAUDE.md §9: quem mapeia e o manifesto).
const menu = montarMenuBuild(
  ferramenta,
  resolvedorDeIcones((manifestoJson as unknown as { icones?: IconesDoManifesto }).icones, urlsDeSprites),
);
// UM painel para todo predio (F16b). A fila da escola virou uma secao dele.
const painel = montarPainelPredio(selecao, (comando) => {
  sessao.enviar(comando);
});

// C-COMIDA-01d — o painel do grupo militar, com o Alimentar.
const painelGrupo = montarPainelGrupo(selecaoMilitar, (comando) => {
  sessao.enviar(comando);
}, soldadosDoJogador);
// predio e grupo nao convivem (F26b): escolher predio pela aba solta o grupo aqui tambem
selecao.aoMudar(() => {
  if (selecao.predio !== null) selecaoMilitar.limpar();
});

// F22 — o aviso de predio parado. Nao tem evento nem assinatura propria: e
// derivado do estado, entao basta ser atualizado junto dos outros.
const alertas = montarAlertas();

// C-IA-03c — o contador do peacetime, no quadro do minimapa. Derivado do estado.
const contadorDePaz = montarContadorDePaz();

// C-TELA-01 — por que a ordem militar nao andou (paz, cerca da paz), sobre o mapa.
const avisoDeOrdem = montarAvisoDeOrdem();

// F34 — o aviso do fim da escaramuca. Derivado do estado, como os alertas.
const fimDePartida = montarFimDePartida();

// UI-barra-a (docs/propostas/barra-lateral-unica.md): a barra lateral unica.
// Ela so escreve `data-corpo` no <body> — grade, painel ou opcoes no corpo da
// aba —, e a area do canvas nao muda com isso. Nasce ANTES do jogo pelo mesmo
// motivo do HUD: o Phaser mede o pai no boot.
montarBarra(selecao, () => {
  ajuda.abrir();
}, selecaoMilitar);

// F-D2 — a navegacao da camera. Ligada aqui, com os outros ouvintes de
// `input/`, e no `window` como eles. Os numeros vem de `data/terrain.json` pelo
// funil `render/mapa.ts`: `input/` nao le `sim/data`.
const navegacao = ligarNavegacao(window, configDoMapa.camera);

const jogo = iniciarJogo(ferramenta, entrada, laco, navegacao, selecaoMilitar);

function atualizar(s: GameState): void {
  jogo.atualizar(s);
  hud.atualizar(s);
  menu.atualizar(s);
  painel.atualizar(s);
  painelGrupo.atualizar(s);
  alertas.atualizar(s);
  contadorDePaz.atualizar(s);
  avisoDeOrdem.atualizar(s);
  // C-TELA-02: destino que ninguem vai alcancar nao fica marcado
  if (recusaDaPaz(s.events) !== null) jogo.apagarDestino();
  fimDePartida.atualizar(s);
  // C9: a partida acabou -> o laco para (e so outro save o reabre)
  acompanharFimDePartida(laco, s);
}

sessao.aoMudar(atualizar);

// F23b — guardar e retomar a partida. A gaveta e o `localStorage`, injetado aqui
// para o arquivo continuar testavel sem navegador. Retomar fecha o painel: o
// predio aberto e da partida velha e pode nao existir na nova.
const arquivo = criarArquivoDaPartida(sessao, window.localStorage);
const painelDoArquivo = montarArquivo(
  () => {
    painelDoArquivo.mostrar(arquivo.salvar());
  },
  () => {
    const resultado = arquivo.carregar();
    if (resultado.ok) selecao.selecionar(null);
    painelDoArquivo.mostrar(resultado);
  },
  () => {
    // C-IA-03c: a escaramuca do comeco, no lugar da partida em curso
    sessao.substituir(criarEscaramuca(SEMENTE));
    selecao.selecionar(null);
    selecaoMilitar.limpar();
    painelDoArquivo.mostrar({ ok: true, acao: 'escaramuca', tick: 0 });
  },
);
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
