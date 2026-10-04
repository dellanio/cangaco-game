// F-D1 — a tela de ajuda, e o lembrete da primeira partida.
//
// Irmao de `ui/alertas.ts`: monta o DOM UMA vez, no nascimento, e depois so
// alterna `hidden`. O painel da F16b ensinou o preco de recriar arvore de DOM
// enquanto o jogo anda (BUG-B).
//
// A lista NAO e escrita aqui. Ela vem de `input/atalhos.ts`, que e a mesma fonte
// que os ouvintes de teclado usam para casar a tecla — e por isso que a tela nao
// pode anunciar tecla que nao existe. Os textos vem do tema (CLAUDE.md §9); o
// nome da tecla, nao: `Esc` e `F1` e o que esta escrito no teclado do jogador.
import { ATALHOS, GESTOS } from '../input/atalhos';
import type { GrupoDeAtalho } from '../input/atalhos';
import type { AjudaParaTeclado } from '../input/teclado';
import type { GameState } from '../sim/state';
import type { GameData } from '../sim/data/types';
import { linhasDasCadeias, requisitosNaTela, textoDaLinha } from './cadeias';
import temaSertao from '../../data/theme-sertao.json';

const tema = temaSertao.ajuda;
const ROTULOS = tema.rotulos as Readonly<Record<string, string>>;
const GRUPOS = tema.grupos as Readonly<Record<GrupoDeAtalho, string>>;
const GESTO_TEXTO = tema.gestos as Readonly<Record<string, string>>;

/** A marca de "ja vi o lembrete". Vive em `localStorage` e NUNCA no `GameState`:
 *  e preferencia de quem joga nesta maquina, nao estado de partida — entraria
 *  num save e viajaria junto, que e exatamente o que nao se quer. */
const CHAVE_DA_DICA = 'cangaco:ajuda-vista';

export interface Ajuda extends AjudaParaTeclado {
  readonly aberta: boolean;
  /** A aba Opcoes (UI-barra-a) abre a mesma caixa que o H. */
  abrir(): void;
  /** I-TELA-AJUDA-DAS-CADEIAS — o "requer X" dos predios bloqueados neste estado. So mexe no DOM com
   *  a ajuda aberta. */
  atualizar(estado: GameState): void;
}

/** O que sai impresso na tecla. `Escape` vira `Esc` porque e o que esta escrito
 *  no teclado; letra solta vira maiuscula pelo mesmo motivo. */
function capDaTecla(tecla: string): string {
  if (tecla === 'Escape') return 'Esc';
  if (tecla === ' ') return 'Espaco';
  return tecla.length === 1 ? tecla.toUpperCase() : tecla;
}

/** Guarda minimo do `localStorage`: em contexto sem ele (ou com ele bloqueado
 *  por politica do navegador) o jogo nao pode quebrar por causa de um lembrete. */
interface Marca {
  vista(): boolean;
  marcar(): void;
}

function marcaNoNavegador(): Marca {
  return {
    vista() {
      try {
        return window.localStorage.getItem(CHAVE_DA_DICA) !== null;
      } catch {
        return false;
      }
    },
    marcar() {
      try {
        window.localStorage.setItem(CHAVE_DA_DICA, '1');
      } catch {
        // sem localStorage o lembrete reaparece na proxima partida. E o pior
        // caso aceitavel: chato, nunca quebrado.
      }
    },
  };
}

function linha(cap: string, texto: string, id: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'atalho';
  item.dataset.atalho = id;

  const tecla = document.createElement('kbd');
  tecla.className = 'tecla';
  tecla.textContent = cap;

  const rotulo = document.createElement('span');
  rotulo.className = 'rotulo';
  rotulo.textContent = texto;

  item.append(tecla, rotulo);
  return item;
}

/** I-TELA-AJUDA-DAS-CADEIAS — a aba Cadeias: uma linha por receita do dado, montada uma vez. Devolve
 *  o que reescreve o "requer X" de cada linha. */
function montarCadeias(aba: HTMLElement, dados: GameData): (estado: GameState) => void {
  const t = tema.cadeias;
  const intro = document.createElement('p');
  intro.className = 'intro';
  intro.textContent = t.intro;
  aba.append(intro);
  const requer = new Map<string, HTMLElement>();
  for (const linha of linhasDasCadeias(dados)) {
    const texto = textoDaLinha(linha);
    const item = document.createElement('div');
    item.className = 'cadeia';
    item.dataset.cadeia = linha.predio;
    const nome = document.createElement('strong');
    nome.className = 'nome';
    nome.textContent = texto.predio;
    const trava = document.createElement('span');
    trava.className = 'requer';
    trava.hidden = true;
    requer.set(linha.predio, trava);
    const entra = document.createElement('div');
    entra.className = 'entra';
    entra.textContent = `${t.entra}: ${texto.entra}`;
    const sai = document.createElement('div');
    sai.className = 'sai';
    sai.textContent = `${t.sai}: ${texto.sai}`;
    item.append(nome, trava, entra, sai);
    aba.append(item);
  }
  return (estado) => {
    const bloqueados = requisitosNaTela(estado, dados);
    for (const [predio, trava] of requer) {
      const texto = bloqueados.get(predio) ?? '';
      trava.hidden = texto === '';
      if (trava.textContent !== texto) trava.textContent = texto;
    }
  };
}

export function montarAjuda(dados: GameData, marca: Marca = marcaNoNavegador()): Ajuda {
  const raiz = document.getElementById('ajuda');
  if (!raiz) throw new Error('ajuda: #ajuda nao existe no index.html');
  const logo = document.getElementById('logo');
  if (!logo) throw new Error('ajuda: #logo nao existe no index.html');

  const titulo = document.createElement('h2');
  titulo.textContent = tema.titulo;
  raiz.append(titulo);

  // I-TELA-AJUDA-DAS-CADEIAS — duas abas: os controles (o que havia) e as cadeias. A dos controles e
  // a que abre: os roteiros de antes acham tudo no mesmo lugar.
  const abas = document.createElement('div');
  abas.className = 'abas-da-ajuda';
  abas.setAttribute('role', 'tablist');
  const controles = document.createElement('div');
  controles.className = 'aba';
  controles.dataset.aba = 'controles';
  const cadeias = document.createElement('div');
  cadeias.className = 'aba';
  cadeias.dataset.aba = 'cadeias';
  cadeias.hidden = true;
  const botoesDasAbas = new Map<string, HTMLButtonElement>();
  for (const [id, painel] of [['controles', controles], ['cadeias', cadeias]] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.abaDaAjuda = id;
    b.textContent = tema.abas[id];
    b.setAttribute('aria-selected', String(id === 'controles'));
    b.addEventListener('click', () => {
      controles.hidden = painel !== controles;
      cadeias.hidden = painel !== cadeias;
      titulo.textContent = painel === cadeias ? tema.cadeias.titulo : tema.titulo;
      for (const [outro, botao] of botoesDasAbas) botao.setAttribute('aria-selected', String(outro === id));
      if (painel === cadeias && ultimo !== null) atualizarCadeias(ultimo);
      b.blur();
    });
    botoesDasAbas.set(id, b);
    abas.append(b);
  }
  raiz.append(abas, controles, cadeias);
  const atualizarCadeias = montarCadeias(cadeias, dados);
  let ultimo: GameState | null = null;

  // Um bloco por grupo, na ordem em que os grupos aparecem no inventario: a
  // ordem da tela e a ordem do dado, e nao uma terceira ordem digitada aqui.
  const grupos: GrupoDeAtalho[] = [];
  for (const a of ATALHOS) if (!grupos.includes(a.grupo)) grupos.push(a.grupo);
  for (const g of GESTOS) if (!grupos.includes(g.grupo)) grupos.push(g.grupo);

  for (const grupo of grupos) {
    const bloco = document.createElement('section');
    bloco.className = 'grupo';
    bloco.dataset.grupo = grupo;

    const nome = document.createElement('h3');
    nome.textContent = GRUPOS[grupo];
    bloco.append(nome);

    for (const atalho of ATALHOS) {
      if (atalho.grupo !== grupo) continue;
      // `h` e `F1` viram "H ou F1" numa linha so: sao o mesmo atalho, e duas
      // linhas fariam o jogador procurar a diferenca que nao existe.
      bloco.append(linha(atalho.teclas.map(capDaTecla).join(' ou '), ROTULOS[atalho.id] ?? atalho.id, atalho.id));
    }
    for (const gesto of GESTOS) {
      if (gesto.grupo !== grupo) continue;
      bloco.append(linha(GESTO_TEXTO[gesto.id] ?? gesto.id, ROTULOS[gesto.id] ?? gesto.id, gesto.id));
    }
    controles.append(bloco);
  }

  const rodape = document.createElement('p');
  rodape.className = 'rodape';
  rodape.textContent = tema.rodape;
  raiz.append(rodape);

  // O lembrete mora na BARRA, nao sobre o mapa, e logo ABAIXO DA LOGO
  // (UI-barra-a, decisao do operador 2026-09-26): o topo e onde o jogador novo
  // olha, e como some no primeiro H, ocupar o topo nao custa nada depois.
  const dica = document.createElement('div');
  dica.className = 'dica-ajuda';
  dica.id = 'dica-ajuda';
  dica.textContent = tema.dica;
  dica.hidden = marca.vista();
  logo.after(dica);

  let aberta = false;

  function mostrar(valor: boolean): void {
    aberta = valor;
    raiz!.hidden = !valor;
    if (!valor) return;
    if (ultimo !== null && !cadeias.hidden) atualizarCadeias(ultimo);
    // O lembrete cumpriu o que tinha a fazer no instante em que a ajuda abriu.
    dica.hidden = true;
    marca.marcar();
  }

  return {
    get aberta() {
      return aberta;
    },
    alternar() {
      mostrar(!aberta);
    },
    abrir() {
      mostrar(true);
    },
    fechar() {
      if (!aberta) return false;
      mostrar(false);
      return true;
    },
    atualizar(estado) {
      ultimo = estado;
      if (aberta && !cadeias.hidden) atualizarCadeias(estado);
    },
  };
}
