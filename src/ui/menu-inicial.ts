// E-TELA-MENU-INICIAL — a porta do jogo: Novo jogo (livre ou escaramuca), Continuar, Carregar e
// Ajuda, por cima da pagina, antes de o `Phaser.Game` existir.
//
// So escreve DOM e devolve a escolha por callback: quem transforma a escolha em estado e o laco
// externo (`src/escolha-da-partida.ts`), e quem carrega o jogo e o `inicio.ts`. `ui/` nunca toca
// no estado (CLAUDE.md §3). Os rotulos vem de `data/theme-sertao.json` (`menuInicial`).
import temaSertao from '../../data/theme-sertao.json';
import type { EscolhaDaPartida, OpcaoDeNivelNaTela, OpcaoDePazNaTela } from '../escolha-da-partida';
import type { SituacaoDaGaveta } from '../arquivo-da-partida';
import { textoDaGaveta } from './arquivo';
import { mmss } from './contador-de-paz';
import { faseAberta } from '../campanha';
import type { ResumoDaFase } from '../campanha';
import urlDoVideoDaCapa from '../../assets/sprites/ui/menu/capa-video.mp4?url';

/**
 * I-TELA-MENU-VIDEO-DE-CAPA (pedido do operador, 2026-10-16) — o video que anima a capa, sem som. Toca uma vez e, perto
 * do fim, some num fade lento, deixando a capa. A capa estatica (o fundo do `#menu-inicial` no CSS) continua por baixo: e o poster, e a volta. Para voltar so
 * para a imagem, troque por `null`.
 */
export const VIDEO_DA_CAPA: string | null = urlDoVideoDaCapa;

/** Quanto antes do ultimo quadro o video comeca a sumir; casa com a transicao de `.saindo` no CSS. */
const SEGUNDOS_DO_FADE_FINAL = 2.4;

/** O video toca nesta pagina: ha video, o jogador nao pediu menos movimento e a URL nao pede a capa fixa. */
export function tocaVideoNaCapa(video: string | null, busca: string, menosMovimento: boolean): boolean {
  return video !== null && !menosMovimento && !new URLSearchParams(busca).has('capaFixa');
}

const rotulos = temaSertao.menuInicial;

/** O que o menu sabe do save, ja lido pelo laco externo: so texto e se da para abrir. */
export type SituacaoDoSave =
  | { readonly pronto: true; readonly tick: number }
  | { readonly pronto: false; readonly causa: 'sem-save' | 'recusado' | 'gaveta'; readonly detalhe: string };

/** Por que o Continuar nao abre, ou `null` quando abre. Pura: e o que o teste headless prova. */
export function motivoDoContinuar(situacao: SituacaoDoSave): string | null {
  if (situacao.pronto) return null;
  return rotulos[situacao.causa].replace('{detalhe}', situacao.detalhe);
}

/** E-SAVE-GAVETAS — por que uma gaveta do Carregar nao abre, ou `null` quando abre. Pura. */
export function motivoDaGaveta(g: SituacaoDaGaveta): string | null {
  if (g.situacao === 'pronta') return null;
  if (g.situacao === 'vazia') return rotulos['sem-save'];
  return motivoDoContinuar({ pronto: false, causa: g.causa, detalhe: g.detalhe });
}

/** E-TELA-CONFIGURAR-PARTIDA — o rotulo de uma duracao da paz, em tempo de jogo. Pura. */
export function rotuloDaPaz(opcao: OpcaoDePazNaTela, rotulos: typeof temaSertao.menuInicial.configurar = temaSertao.menuInicial.configurar): string {
  const tempo = opcao.segundos === 0 ? rotulos.semPaz
    : opcao.segundos % 60 === 0 ? rotulos.minutos.replace('{min}', String(opcao.segundos / 60))
      : rotulos.minutos.replace('{min}', mmss(opcao.segundos));
  return opcao.padrao ? rotulos.padrao.replace('{rotulo}', tempo) : tempo;
}

/** F-IA-DIFICULDADE — o rotulo de um nivel do adversario, do tema; o padrao leva a marca. Pura. */
export function rotuloDoNivel(opcao: OpcaoDeNivelNaTela, rotulos: typeof temaSertao.menuInicial.configurar = temaSertao.menuInicial.configurar): string {
  const nome = (rotulos.niveis as Readonly<Record<string, string | undefined>>)[opcao.valor] ?? opcao.valor;
  return opcao.padrao ? rotulos.padrao.replace('{rotulo}', nome) : nome;
}

export interface MenuInicial {
  fechar(): void;
}

/** Monta o menu em `<body>` e chama `aoEscolher` uma vez. `aoAjuda` abre a tela de ajuda. O
 *  Continuar abre a gaveta salva por ultimo (`situacao`); o Carregar, a que o jogador escolher. */
export function montarMenuInicial(
  situacao: SituacaoDoSave,
  gavetas: readonly SituacaoDaGaveta[],
  opcoesDePaz: readonly OpcaoDePazNaTela[],
  opcoesDeNivel: readonly OpcaoDeNivelNaTela[],
  aoEscolher: (escolha: EscolhaDaPartida) => void,
  aoAjuda: () => void,
  /** H-TELA-OPCOES-E-VOLUME — abre a caixa de opcoes de som. */
  aoOpcoes: () => void = () => undefined,
  /** I-TELA-MENU-DA-CAMPANHA — as fases (em ordem) e as ja vencidas: quais abrem e quais tem cadeado. */
  campanha: { readonly fases: readonly ResumoDaFase[]; readonly vencidas: readonly number[] } = { fases: [], vencidas: [] },
): MenuInicial {
  const raiz = document.createElement('section');
  raiz.id = 'menu-inicial';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-label', rotulos.titulo);
  document.body.dataset.menu = 'aberto';

  const caixa = document.createElement('div');
  caixa.className = 'caixa';
  const logo = document.createElement('div');
  logo.className = 'logo-do-menu';
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', rotulos.titulo);
  const lema = document.createElement('p');
  lema.className = 'lema';
  lema.textContent = temaSertao.barra.lema;

  let escolheu = false;
  function escolher(escolha: EscolhaDaPartida): void {
    if (escolheu) return;
    escolheu = true;
    aoEscolher(escolha);
  }

  function botao(acao: string, rotulo: string, aoClicar: () => void, motivo: string | null = null): HTMLElement {
    const linha = document.createElement('div');
    linha.className = 'opcao';
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.acao = acao;
    b.textContent = rotulo;
    if (motivo !== null) {
      // `aria-disabled`, e nao `disabled`: o botao continua focavel e o leitor de tela le o motivo
      b.setAttribute('aria-disabled', 'true');
      const porque = document.createElement('span');
      porque.className = 'motivo';
      porque.dataset.motivo = acao;
      porque.textContent = motivo;
      b.setAttribute('aria-describedby', `motivo-${acao}`);
      porque.id = `motivo-${acao}`;
      linha.append(b, porque);
    } else {
      linha.append(b);
    }
    b.addEventListener('click', () => {
      if (motivo !== null) return;
      aoClicar();
      b.blur();
    });
    return linha;
  }

  // Novo jogo abre as duas partidas na mesma caixa; Carregar abre a lista das gavetas.
  const principal = document.createElement('div');
  principal.className = 'opcoes';
  const novo = document.createElement('div');
  novo.className = 'opcoes';
  novo.dataset.tela = 'novo';
  novo.hidden = true;
  const carregar = document.createElement('div');
  carregar.className = 'opcoes';
  carregar.dataset.tela = 'carregar';
  carregar.hidden = true;
  // E-TELA-CONFIGURAR-PARTIDA — antes da escaramuca, a duracao da paz
  const configurar = document.createElement('div');
  configurar.className = 'opcoes';
  configurar.dataset.tela = 'configurar';
  configurar.hidden = true;

  // I-TELA-MENU-DA-CAMPANHA — a lista das fases e a fase escolhida (narrativa, desafio, Comecar)
  const listaDaCampanha = document.createElement('div');
  listaDaCampanha.className = 'opcoes';
  listaDaCampanha.dataset.tela = 'campanha';
  listaDaCampanha.hidden = true;
  const telaDaFase = document.createElement('div');
  telaDaFase.className = 'opcoes';
  telaDaFase.dataset.tela = 'fase';
  telaDaFase.hidden = true;

  function mostrar(tela: HTMLElement): void {
    for (const t of [principal, novo, carregar, configurar, listaDaCampanha, telaDaFase]) t.hidden = t !== tela;
  }

  const motivo = motivoDoContinuar(situacao);
  principal.append(
    // I-TELA-PARTIDA-GUIADA: o primeiro botao, para quem nunca jogou
    botao('aprender', rotulos.aprender, () => { escolher({ modo: 'guiada' }); }),
    botao('novo', rotulos.novoJogo, () => { mostrar(novo); }),
    botao('continuar', rotulos.continuar, () => { escolher({ modo: 'continuar' }); }, motivo),
    botao('carregar', rotulos.carregar, () => { mostrar(carregar); }),
    botao('ajuda', rotulos.ajuda, aoAjuda),
    botao('opcoes', rotulos.opcoes, aoOpcoes),
  );
  novo.append(
    botao('livre', rotulos.livre, () => { escolher({ modo: 'livre' }); }),
    botao('escaramuca', rotulos.escaramuca, () => { mostrar(configurar); }),
    botao('campanha', rotulos.campanha, () => { mostrar(listaDaCampanha); }),
    botao('voltar', rotulos.voltar, () => { mostrar(principal); }),
  );
  const textos = temaSertao.campanha;
  const tituloDaCampanha = document.createElement('h2');
  tituloDaCampanha.textContent = textos.titulo;
  listaDaCampanha.append(tituloDaCampanha);
  for (const fase of campanha.fases) {
    const nome = `${textos.fase.replace('{n}', String(fase.numero)).replace('{local}', fase.local)}: ${fase.titulo}`;
    const aberta = faseAberta(campanha.vencidas, fase.numero);
    listaDaCampanha.append(botao(`fase-${fase.numero}`, nome, () => { abrirFase(fase); }, aberta ? null : textos.trancada));
  }
  listaDaCampanha.append(botao('voltar', rotulos.voltar, () => { mostrar(novo); }));
  function abrirFase(fase: ResumoDaFase): void {
    const titulo = document.createElement('h2');
    titulo.textContent = textos.fase.replace('{n}', String(fase.numero)).replace('{local}', fase.local);
    const subtitulo = document.createElement('p');
    subtitulo.className = 'lema';
    subtitulo.textContent = fase.titulo;
    const narrativa = document.createElement('p');
    narrativa.className = 'narrativa';
    narrativa.textContent = fase.narrativa;
    const desafio = document.createElement('p');
    desafio.className = 'desafio';
    desafio.textContent = `${textos.desafio}: ${fase.desafio}`;
    telaDaFase.replaceChildren(
      titulo, subtitulo, narrativa, desafio,
      botao('comecar', textos.comecar, () => { escolher({ modo: 'campanha', fase: fase.id }); }),
      botao('voltar', rotulos.voltar, () => { mostrar(listaDaCampanha); }),
    );
    telaDaFase.dataset.fase = fase.id;
    mostrar(telaDaFase);
  }
  // E-SAVE-GAVETAS: as tres gavetas. A que nao abre fica desabilitada, com o motivo embaixo.
  for (const g of gavetas) {
    const motivoDela = motivoDaGaveta(g);
    const rotulo = motivoDela === null ? textoDaGaveta(g) : temaSertao.hud.arquivo.gavetas.nome.replace('{n}', String(g.n));
    carregar.append(botao(`gaveta-${g.n}`, rotulo, () => { escolher({ modo: 'carregar', gaveta: g.n }); }, motivoDela));
  }
  carregar.append(botao('voltar', rotulos.voltar, () => { mostrar(principal); }));

  const rotulosDaPaz = rotulos.configurar;
  const campoDaPaz = document.createElement('label');
  campoDaPaz.className = 'campo';
  const nomeDaPaz = document.createElement('span');
  nomeDaPaz.textContent = rotulosDaPaz.paz;
  const paz = document.createElement('select');
  paz.dataset.campo = 'paz';
  for (const opcao of opcoesDePaz) {
    const item = document.createElement('option');
    item.value = String(opcao.valor);
    item.textContent = rotuloDaPaz(opcao, rotulosDaPaz);
    item.selected = opcao.padrao;
    paz.append(item);
  }
  campoDaPaz.append(nomeDaPaz, paz);
  // F-IA-DIFICULDADE — o nivel do adversario, ao lado da paz
  const campoDoNivel = document.createElement('label');
  campoDoNivel.className = 'campo';
  const nomeDoNivel = document.createElement('span');
  nomeDoNivel.textContent = rotulosDaPaz.nivel;
  const nivel = document.createElement('select');
  nivel.dataset.campo = 'nivel';
  for (const opcao of opcoesDeNivel) {
    const item = document.createElement('option');
    item.value = opcao.valor;
    item.textContent = rotuloDoNivel(opcao, rotulosDaPaz);
    item.selected = opcao.padrao;
    nivel.append(item);
  }
  campoDoNivel.append(nomeDoNivel, nivel);
  const tituloDaConfiguracao = document.createElement('h2');
  tituloDaConfiguracao.textContent = rotulosDaPaz.titulo;
  configurar.append(
    tituloDaConfiguracao,
    campoDaPaz,
    campoDoNivel,
    botao('comecar', rotulosDaPaz.comecar, () => { escolher({ modo: 'escaramuca', pazMinBase: Number(paz.value), nivel: nivel.value }); }),
    botao('voltar', rotulos.voltar, () => { mostrar(novo); }),
  );

  caixa.append(logo, lema, principal, novo, carregar, configurar, listaDaCampanha, telaDaFase);
  // I-TELA-MENU-VIDEO-DE-CAPA: o video entra por cima da capa com um fade quando pode tocar; o veu (degrade, vinheta e
  // grao) fica por cima dos dois, e a caixa por cima de tudo. Sem controle, sem clique; se falhar, sai e fica a capa.
  const menosMovimento = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (VIDEO_DA_CAPA !== null && tocaVideoNaCapa(VIDEO_DA_CAPA, window.location.search, menosMovimento)) {
    const video = document.createElement('video');
    video.className = 'video-da-capa';
    video.muted = true;
    video.loop = false;
    video.autoplay = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    video.preload = 'auto';
    video.src = VIDEO_DA_CAPA;
    video.addEventListener('playing', () => { video.classList.add('tocando'); }, { once: true });
    // o fade comeca antes do fim, para o ultimo quadro nao congelar a vista; o elemento sai quando a transicao acaba
    const sumir = (): void => {
      if (video.classList.contains('saindo')) return;
      video.classList.add('saindo');
      window.setTimeout(() => { video.remove(); }, SEGUNDOS_DO_FADE_FINAL * 1000);
    };
    video.addEventListener('timeupdate', () => {
      if (Number.isFinite(video.duration) && video.currentTime >= video.duration - SEGUNDOS_DO_FADE_FINAL) sumir();
    });
    video.addEventListener('ended', sumir, { once: true });
    video.addEventListener('error', () => { video.remove(); }, { once: true });
    raiz.append(video);
    void video.play().catch(() => { video.remove(); });
  }
  const veu = document.createElement('div');
  veu.className = 'veu-da-capa';
  veu.setAttribute('aria-hidden', 'true');
  raiz.append(veu, caixa);
  document.body.append(raiz);

  return {
    fechar() {
      raiz.remove();
      delete document.body.dataset.menu;
    },
  };
}
