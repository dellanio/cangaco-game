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

export function montarAjuda(marca: Marca = marcaNoNavegador()): Ajuda {
  const raiz = document.getElementById('ajuda');
  if (!raiz) throw new Error('ajuda: #ajuda nao existe no index.html');
  const barra = document.getElementById('hud');
  if (!barra) throw new Error('ajuda: #hud nao existe no index.html');

  const titulo = document.createElement('h2');
  titulo.textContent = tema.titulo;
  raiz.append(titulo);

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
    raiz.append(bloco);
  }

  const rodape = document.createElement('p');
  rodape.className = 'rodape';
  rodape.textContent = tema.rodape;
  raiz.append(rodape);

  // O lembrete mora na BARRA, nao sobre o mapa: sobreposicao nova na celula do
  // canvas mexeria nas medidas de retangulo que os roteiros da F06 e da F22
  // afirmam, e um aviso de primeira partida nao vale uma regressao de layout.
  const dica = document.createElement('span');
  dica.className = 'dica-ajuda';
  dica.id = 'dica-ajuda';
  dica.textContent = tema.dica;
  dica.hidden = marca.vista();
  barra.append(dica);

  let aberta = false;

  function mostrar(valor: boolean): void {
    aberta = valor;
    raiz!.hidden = !valor;
    if (!valor) return;
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
    fechar() {
      if (!aberta) return false;
      mostrar(false);
      return true;
    },
  };
}
