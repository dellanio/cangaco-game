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
import { LADO_DO_JOGADOR } from './sim/state';
import type { GameState } from './sim/state';
import { gameData } from './sim/data';
import { criarSessao } from './sessao';
import { acompanharFimDePartida, criarLaco, nascerPausadoPelaUrl, pausarAoOcultar } from './laco';
import { iniciarJogo } from './render/game';
import { montarHud } from './ui/hud';
import { montarEstatisticas } from './ui/estatisticas';
import { montarDistribuicao } from './ui/distribuicao';
import { montarMenuBuild } from './ui/menu-build';
import { resolvedorDeIcones } from './ui/icones';
import type { IconesDoManifesto } from './ui/icones';
import manifestoJson from '../assets/manifest.json';
import { urlsDeSprites } from './render/sprites-urls';
import { montarPainelPredio } from './ui/painel-predio';
import { modosDoTipo } from './ui/modo-do-predio';
import { montarAlertas } from './ui/alertas';
import { montarAvisoDoTempo } from './ui/aviso-tempo';
import { montarFimDePartida } from './ui/fim-de-partida';
import { montarAjuda } from './ui/ajuda';
import type { Ajuda } from './ui/ajuda';
import type { TelaDeCarregamento } from './ui/carregamento';
import { montarBarra } from './ui/barra';
import { montarArquivo } from './ui/arquivo';
import { criarArquivoDaPartida } from './arquivo-da-partida';
import { criarFerramenta } from './input/ferramenta';
import { criarSelecao } from './input/selecao';
import { criarEntradaDoMapa } from './input/colocar';
import { ligarTeclado } from './input/teclado';
import { ligarTeclasDoTempo } from './input/teclas-do-tempo';
import { ligarNavegacao } from './input/navegacao';
import { configDoMapa, terrenoDeRender } from './render/mapa';
import { caixaDeTipoNoMapa } from './render/predios';
import { montarMinimapa } from './ui/minimapa';
import { predioNoTile } from './sim/selectors';
import { predioClicavel } from './render/nevoa';
import { classeDaUnidade } from './sim/condicao';
import { criarSelecaoMilitar } from './input/selecao-militar';
import { montarPainelGrupo } from './ui/painel-grupo';
import { montarContadorDePaz } from './ui/contador-de-paz';
import { montarAvisoDeOrdem, recusaDaPaz } from './ui/aviso-de-ordem';
import { ordemDoBotaoDireito } from './ui/ordem-militar';
import { direcaoDoArrasto } from './ui/formacao';
import { criarEscaramuca } from './sim/cenario';
import type { Command } from './sim/commands';
import { criarCamadaDeSom, urlsDosSons } from './render/som';
import type { SonsDoManifesto, TabelaDeSom, ContadoresDeSom } from './render/som';
import { criarTocadorDoNavegador } from './render/tocador-de-som';
import { urlsDeArquivosDeSom } from './render/sprites-urls';
import tabelaDeSom from '../data/som.json';
import { canalDoSom, volumeEfetivo } from './preferencias-de-som';
import type { PreferenciasVivas } from './preferencias-de-som';
import type { OpcoesDeSom } from './ui/opcoes-de-som';

// C-IA-03c — o botao "Nova escaramuca" do painel H comeca a escaramuca no meio do jogo.
const SEMENTE = gameData.economia.estadoInicial.semente;

declare global {
  interface Window {
    __cangacoPartida?: { estadoSerializado(): string };
    /** H-TELA-CAMADA-DE-SOM — HARNESS: os contadores da camada de som, para o roteiro. */
    __cangacoSom?: { contadores(): ContadoresDeSom };
  }
}

/**
 * E-TELA-MENU-INICIAL — monta o jogo inteiro em cima de `estadoInicial`. Antes do menu isto era o
 * corpo do modulo, e a partida vinha da URL; agora quem escolhe e o `inicio.ts` (menu ou URL,
 * `escolha-da-partida.ts`), e o Phaser so nasce aqui, depois da escolha. A ajuda que o menu ja
 * montou vem junto: o `#ajuda` e montado uma vez so.
 */
export function iniciarPartida(
  estadoInicial: GameState, ajudaDoMenu: Ajuda | null = null, carregamento: TelaDeCarregamento | null = null,
  /** H-TELA-OPCOES-E-VOLUME — o volume escolhido (o mesmo do menu) e a caixa que o muda. */
  preferenciasDeSom: PreferenciasVivas | null = null, opcoesDeSom: OpcoesDeSom | null = null,
): void {
  const sessao = criarSessao(estadoInicial);
  // H-TELA-CAMADA-DE-SOM — o som le os eventos de cada passo e toca no fim do quadro. O arquivo
  // vem do manifesto (secao `sons`) pela URL do bundler; sem arquivo, o id e silencio.
  const urlsDeSom = urlsDosSons((manifestoJson as unknown as { sons?: SonsDoManifesto }).sons, urlsDeArquivosDeSom);
  const tabela = tabelaDeSom as TabelaDeSom;
  const som = criarCamadaDeSom(tabela, new Set(Object.keys(urlsDeSom)), criarTocadorDoNavegador(urlsDeSom),
    (id) => (preferenciasDeSom === null ? 1 : volumeEfetivo(preferenciasDeSom.atual, canalDoSom(tabela.sons, id))));
  // Todo comando do jogador passa por aqui: a conta diz ao som que a recusa do proximo passo e
  // do jogador, e a planta posicionada pede o som seco no quadro do clique (GDD §10).
  let comandosDoJogador = 0;
  function enviar(comando: Command): void {
    sessao.enviar(comando);
    comandosDoJogador += 1;
    if (comando.type === 'PlaceBlueprint') som.pedirPlanta();
  }
  const ferramenta = criarFerramenta();
  // O predio aberto no painel (F13b). Estado de interface, como a ferramenta.
  const selecao = criarSelecao();
  // F26b — o grupo militar na mao. Estado de interface, como a selecao de predio: as duas
  // nao convivem (selecionar soldado fecha o painel; abrir predio solta o grupo).
  const selecaoMilitar = criarSelecaoMilitar();
  // A ajuda (F-D1) precisa do `#logo` ja no DOM, e ele e estatico no index.html —
  // entao ela pode nascer antes do resto da interface. Quem a abre e o teclado, e
  // e por isso que ela e o quarto parametro: com a ajuda aberta, o `Esc` e dela.
  const ajuda = ajudaDoMenu ?? montarAjuda();
  // H-TELA-OPCOES-E-VOLUME — a ajuda em jogo abre as opcoes de som
  opcoesDeSom?.ligarNaAjuda();
  ligarTeclado(ferramenta, window, selecao, ajuda);

  // O laco. `?pausado` na URL o faz NASCER pausado: e o que o runner de screenshot usa para todo
  // roteiro comecar no tick 0, sem a janela de ticks que existiria entre carregar a pagina e
  // pausar depois do aperto de mao. Nao e superficie de jogador.
  const laco = criarLaco({
    passo: () => {
      const doJogador = comandosDoJogador;
      comandosDoJogador = 0;
      som.aoPasso(sessao.passo(), doJogador);
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
      enviar(comando);
    },
    (tile) => {
      selecao.selecionar(predioClicavel(sessao.estado, predioNoTile(sessao.estado, tile.gx, tile.gy)));
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
        // F-TELA-NEVOA: o predio inimigo fora da vista nao existe para o clique
        selecao.selecionar(predioClicavel(sessao.estado, predioNoTile(sessao.estado, tile.gx, tile.gy)));
      },
      aoCaixa(a, b, somar) {
        const soldados = soldadosDoJogador(jogo.unidadesNaCaixa(a, b));
        selecao.limpar();
        if (somar) selecaoMilitar.somar(soldados);
        else selecaoMilitar.definir(soldados);
      },
      aoOrdenar(tile, ponto, fim) {
        // unidade inimiga sob o ponteiro e ataque (C-TELA-04); predio de OUTRO lado tambem
        // (F26b); no resto e marcha (GDD §2.1). Quem decide e `ui/ordem-militar.ts`.
        // C-COMBATE-01c: o arrasto do direito da a direcao; as colunas sao as do painel
        const direcao = ponto === null ? null : direcaoDoArrasto(ponto, fim);
        const colunas = painelGrupo.colunas();
        const ordem = ordemDoBotaoDireito(
          sessao.estado, gameData, LADO_DO_JOGADOR, soldadosDoJogador(selecaoMilitar.ids), tile,
          ponto === null ? [] : jogo.unidadesNoPonto(ponto),
          { ...(direcao === null ? {} : { direcao }), ...(colunas === null ? {} : { colunas }) },
        );
        for (const comando of ordem.comandos) enviar(comando);
        // C-TELA-02: a marca aparece no clique, mesmo pausado (retorno imediato, GDD §10)
        if (ordem.marcarDestino !== null) jogo.marcarDestino(ordem.marcarDestino);
      },
    },
  );

  // HUD e painel ANTES do jogo: o Phaser mede o pai no boot e o layout tem que
  // estar assentado (as dimensoes sao fixas no CSS, mas nao custa a ordem certa).
  const hud = montarHud();
  const estatisticas = montarEstatisticas();
  // D-TRANSPORTE-02b — a aba Distribuicao emite `SetWareDistribution`
  const distribuicao = montarDistribuicao((comando) => {
    enviar(comando);
  });
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
    enviar(comando);
  }, gameData.economia.mercadorias, (tipo) => modosDoTipo(gameData.producao.receitas, tipo));

  // C-COMIDA-01d — o painel do grupo militar, com o Alimentar.
  const painelGrupo = montarPainelGrupo(selecaoMilitar, (comando) => {
    enviar(comando);
  }, soldadosDoJogador, gameData);
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

  // E-ENTREGA-BUILD: o progresso do loader vai para a tela de carregamento do `inicio.ts`
  const jogo = iniciarJogo(ferramenta, entrada, laco, navegacao, selecaoMilitar, (fracao) => {
    carregamento?.atualizar(fracao);
  });

  // D-TELA-02 — o minimapa, depois da barra (ele toma o lugar do placeholder dela). O
  // terreno, o footprint e a camera chegam daqui: `ui/` nao le `sim/data` nem o funil.
  const minimapa = montarMinimapa({
    terreno: terrenoDeRender,
    tilePx: configDoMapa.tilePx,
    caixaDoPredio: caixaDeTipoNoMapa,
    vista: () => jogo.vistaDaCamera(),
    centrarEm: (tile) => jogo.centrarCameraEm(tile),
    nevoa: configDoMapa.nevoa,
  });

  function atualizar(s: GameState): void {
    // F-TELA-NEVOA: o predio inimigo que saiu da vista sai do painel (ele so existe a vista)
    if (selecao.predio !== null && predioClicavel(s, selecao.predio) === null) selecao.selecionar(null);
    jogo.atualizar(s);
    minimapa.atualizar(s);
    hud.atualizar(s);
    estatisticas.atualizar(s);
    distribuicao.atualizar(s);
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
  // E-SAVE-GAVETAS: tres gavetas; a data e do relogio do navegador, aqui no laco externo.
  const arquivo = criarArquivoDaPartida(sessao, window.localStorage, gameData, () => new Date().toISOString());
  const painelDoArquivo = montarArquivo({
    aoSalvar(n) {
      painelDoArquivo.mostrar(arquivo.salvar(n));
    },
    aoCarregar(n) {
      const resultado = arquivo.carregar(n);
      if (resultado.ok) {
        jogo.reiniciarApresentacao();
        som.reiniciar();
        selecao.selecionar(null);
      }
      painelDoArquivo.mostrar(resultado);
    },
    aoEscaramuca() {
      // C-IA-03c: a escaramuca do comeco, no lugar da partida em curso
      jogo.reiniciarApresentacao();
      som.reiniciar();
      sessao.substituir(criarEscaramuca(SEMENTE));
      selecao.selecionar(null);
      selecaoMilitar.limpar();
      painelDoArquivo.mostrar({ ok: true, acao: 'escaramuca', tick: 0 });
    },
    aoMenu() {
      // E-SAVE-GAVETAS: o menu inicial e a pagina sem parametro; o que nao foi guardado se perde
      window.location.assign(window.location.pathname);
    },
    gavetas: () => arquivo.gavetas(),
  });
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
    som.quadro();
    aviso.atualizar(laco.pausado, laco.velocidade);
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);

  // E-TELA-MENU-INICIAL — HARNESS, como o `__cangaco` do render: o estado serializado, para o
  // roteiro comparar a escaramuca do menu com a do `?escaramuca` no tick 0. Nao usar em jogo.
  window.__cangacoPartida = { estadoSerializado: () => JSON.stringify(sessao.estado) };
  window.__cangacoSom = { contadores: () => som.contadores() };

}
