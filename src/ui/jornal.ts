// I-TELA-JORNAL — o jornal das noticias importantes (pedido do operador, 2026-10-05). Um icone
// pequeno no canto inferior esquerdo da area do jogo diz que ha noticia; o clique abre o jornal
// aberto no meio da tela, sem moldura, com o X de fechar. Como a pilha de mensagens do KaM
// (src/gui/KM_InterfaceGamePlay.pas:2047-2055), mas so de tela: le os eventos do passo e nunca muta
// GameState (CLAUDE.md §3). A lista vive aqui, na memoria da tela, e nao entra no save.
import type { GameEvent, GameState } from '../sim/state';
import { LADO_DO_JOGADOR } from '../sim/state';
import temaSertao from '../../data/theme-sertao.json';

export interface ConfigDoJornal {
  readonly maximoDeNoticias: number;
  readonly eventos: Readonly<Record<string, string>>;
}

export interface TextoDaNoticia {
  readonly manchete: string;
  readonly texto: string;
}

export interface Noticia {
  readonly tick: number;
  readonly chave: string;
  readonly manchete: string;
  readonly texto: string;
}

/** O texto com `{n}` trocado pelo numero do evento (a contagem da tropa), quando ele tem. */
function preencher(modelo: string, evento: GameEvent): string {
  const n = 'unidades' in evento ? String(evento.unidades) : '';
  return modelo.split('{n}').join(n);
}

/** As noticias de um passo: o evento com linha na tabela, e do lado do jogador quando tem lado.
 *  Regra pura. */
export function noticiasDosEventos(
  eventos: readonly GameEvent[], tick: number, config: ConfigDoJornal,
  textos: Readonly<Record<string, TextoDaNoticia>>,
): Noticia[] {
  const noticias: Noticia[] = [];
  for (const e of eventos) {
    const chave = config.eventos[e.type];
    if (chave === undefined) continue;
    if ('lado' in e && e.lado !== LADO_DO_JOGADOR) continue;
    // I-TELA-CLIMA-VISUAL: a noticia da estacao e uma por estacao (`estacao:seca`)
    const chaveDaNoticia = 'estacao' in e ? `${chave}:${e.estacao}` : chave;
    const t = textos[chaveDaNoticia];
    if (t === undefined) continue;
    noticias.push({ tick, chave: chaveDaNoticia, manchete: preencher(t.manchete, e), texto: preencher(t.texto, e) });
  }
  return noticias;
}

/** A lista nova: as noticias novas no alto (a ultima do passo primeiro), cortada no teto. Pura. */
export function acrescentarNoticias(lista: readonly Noticia[], novas: readonly Noticia[], maximo: number): Noticia[] {
  return [...[...novas].reverse(), ...lista].slice(0, maximo);
}

/** A hora de jogo do tick, `mm:ss` (ou `h:mm:ss`), pelo tamanho do tick em ms. */
export function horaDoJogo(tick: number, tickMs: number): string {
  const total = Math.floor((tick * tickMs) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

/** I-TELA-JORNAL-SO-A-ULTIMA — o icone aparece com noticia nao lida (ou com o jornal aberto) e some ao
 *  fechar: o jogador ja leu. Pura. */
export function iconeVisivel(naoLidas: number, aberto: boolean): boolean {
  return aberto || naoLidas > 0;
}

export interface Jornal {
  aoPasso(estado: GameState): void;
  readonly aberto: boolean;
  fechar(): void;
}

/** Monta o icone (`#jornal-icone`) e a folha (`#jornal`), escondidos ate a primeira noticia. */
export function montarJornal(config: ConfigDoJornal, tickMs: number, janela: Window = window): Jornal {
  const documento = janela.document;
  const icone = documento.getElementById('jornal-icone');
  const folha = documento.getElementById('jornal');
  if (!icone || !folha) throw new Error('jornal: #jornal-icone ou #jornal nao existe no index.html');
  const tema = temaSertao.jornal;
  const textos = tema.noticias as Readonly<Record<string, TextoDaNoticia>>;
  icone.title = tema.abrir;
  icone.setAttribute('aria-label', tema.abrir);

  let noticias: Noticia[] = [];
  let naoLidas = 0;
  let aberto = false;

  function desenharIcone(): void {
    icone!.hidden = !iconeVisivel(naoLidas, aberto);
    icone!.dataset.naoLidas = String(naoLidas);
    icone!.classList.toggle('nao-lida', naoLidas > 0);
  }

  function desenharFolha(): void {
    folha!.replaceChildren();
    const papel = documento.createElement('article');
    papel.className = 'papel';
    const fechar = documento.createElement('button');
    fechar.className = 'fechar';
    fechar.type = 'button';
    fechar.textContent = '✕';
    fechar.title = tema.fechar;
    fechar.setAttribute('aria-label', tema.fechar);
    fechar.addEventListener('click', () => { api.fechar(); });
    const cabeca = documento.createElement('header');
    const nome = documento.createElement('h1');
    nome.textContent = tema.nome;
    const linha = documento.createElement('p');
    linha.className = 'linha-da-data';
    linha.textContent = tema.lema;
    cabeca.append(nome, linha);
    const colunas = documento.createElement('div');
    colunas.className = 'colunas';
    for (const n of noticias) {
      const item = documento.createElement('section');
      item.className = 'noticia';
      item.dataset.chave = n.chave;
      const h = documento.createElement('h2');
      h.textContent = n.manchete;
      const hora = documento.createElement('p');
      hora.className = 'hora';
      hora.textContent = horaDoJogo(n.tick, tickMs);
      const p = documento.createElement('p');
      p.textContent = n.texto;
      item.append(h, hora, p);
      colunas.append(item);
    }
    papel.append(fechar, cabeca, colunas);
    folha!.append(papel);
  }

  const api: Jornal = {
    get aberto() { return aberto; },
    aoPasso(estado) {
      const novas = noticiasDosEventos(estado.events, estado.tick, config, textos);
      if (novas.length === 0) return;
      noticias = acrescentarNoticias(noticias, novas, config.maximoDeNoticias);
      if (aberto) desenharFolha();
      else naoLidas += novas.length;
      desenharIcone();
    },
    fechar() {
      if (!aberto) return;
      aberto = false;
      folha!.hidden = true;
      desenharIcone();
    },
  };

  icone.addEventListener('click', () => {
    if (aberto) { api.fechar(); return; }
    aberto = true;
    naoLidas = 0;
    desenharFolha();
    folha.hidden = false;
    desenharIcone();
  });
  // o Esc fecha o jornal antes de qualquer outro dono da tecla (fase de captura)
  janela.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && aberto) {
      api.fechar();
      ev.stopImmediatePropagation();
      ev.preventDefault();
    }
  }, true);
  desenharIcone();
  return api;
}
