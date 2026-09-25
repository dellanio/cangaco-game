// A prancha (Layout 2, docs/propostas/ui-releitura-rts.md §8): a coluna de
// construir, a direita, RETRATIL. Aberta, e a coluna de 260 px que a F06 mede;
// fechada, ela SOME — a coluna da grade vai a zero e o canvas toma a largura
// toda — e o que fica e um BOTAO FLUTUANTE no canto superior direito, dentro
// da barra do HUD, que a traz de volta com uma animacao de entrada (pedido do
// operador, 2026-09-25: a lombada de 22 px lia como "menu comprimido").
//
// Quem cresce no lugar dela e o canvas — o Phaser esta em `Scale.RESIZE` a
// 100 % do pai e acompanha a celula da grade sozinho.
//
// So o jogador abre e fecha. A prancha nunca se mexe por conta propria: e onde
// a mao dele vai a cada poucos segundos, e um menu que some sozinho e um menu
// que o jogador procura.
//
// Este modulo nao conhece o conteudo da coluna (`menu-build.ts` continua dono
// dele): ele so pendura os dois botoes e escreve `data-prancha` no <body>, que
// e o que o CSS le. A preferencia vive em `localStorage`, como o lembrete da
// ajuda (F-D1): e de quem joga nesta maquina, nunca do `GameState`.
import temaSertao from '../../data/theme-sertao.json';

export type EstadoDaPrancha = 'aberta' | 'fechada';

const CHAVE_DA_PREFERENCIA = 'cangaco:prancha';

export interface PreferenciaDaPrancha {
  ler(): EstadoDaPrancha | null;
  gravar(estado: EstadoDaPrancha): void;
}

function preferenciaNoNavegador(): PreferenciaDaPrancha {
  return {
    ler() {
      try {
        const valor = window.localStorage.getItem(CHAVE_DA_PREFERENCIA);
        return valor === 'fechada' ? 'fechada' : valor === 'aberta' ? 'aberta' : null;
      } catch {
        return null;
      }
    },
    gravar(estado) {
      try {
        window.localStorage.setItem(CHAVE_DA_PREFERENCIA, estado);
      } catch {
        // sem localStorage a prancha nasce aberta na proxima partida. Chato, nunca quebrado.
      }
    },
  };
}

export interface Prancha {
  readonly estado: EstadoDaPrancha;
  abrir(): void;
  fechar(): void;
}

/** A classe que dispara a animacao de entrada; sai sozinha no `animationend`,
 *  para a proxima abertura animar de novo. */
const CLASSE_DE_ENTRADA = 'entrando';

export function montarPrancha(preferencia: PreferenciaDaPrancha = preferenciaNoNavegador()): Prancha {
  const raiz = document.getElementById('menu-build');
  if (!raiz) throw new Error('prancha: #menu-build nao existe no index.html');
  const barra = document.getElementById('hud');
  if (!barra) throw new Error('prancha: #hud nao existe no index.html');

  // O botao de recolher: fica no canto superior direito da coluna aberta.
  const recolher = document.createElement('button');
  recolher.type = 'button';
  recolher.className = 'recolher seta-dir';
  recolher.dataset.fechar = 'prancha';
  recolher.setAttribute('aria-label', temaSertao.paineis.prancha.recolher);
  recolher.title = temaSertao.paineis.prancha.recolher;
  raiz.prepend(recolher);

  // O botao flutuante: na barra, na ponta direita, sempre presente. Com a
  // prancha aberta ele fica "apertado" (`aria-pressed`) e o clique recolhe;
  // fechada, o clique abre. O rotulo e o TITULO do menu, que ja existe no
  // tema — o botao e o menu dobrado, nao um botao novo.
  const flutuante = document.createElement('button');
  flutuante.type = 'button';
  flutuante.className = 'abrir-prancha';
  flutuante.dataset.abrir = 'prancha';
  flutuante.textContent = temaSertao.menuBuild.titulo;
  barra.append(flutuante);

  let estado: EstadoDaPrancha = preferencia.ler() ?? 'aberta';

  function aplicar(novo: EstadoDaPrancha, animar: boolean): void {
    estado = novo;
    document.body.dataset.prancha = novo;
    flutuante.setAttribute('aria-pressed', String(novo === 'aberta'));
    const rotulo = novo === 'aberta' ? temaSertao.paineis.prancha.recolher : temaSertao.paineis.prancha.abrir;
    flutuante.setAttribute('aria-label', rotulo);
    flutuante.title = rotulo;
    if (animar && novo === 'aberta') raiz!.classList.add(CLASSE_DE_ENTRADA);
    preferencia.gravar(novo);
  }
  raiz.addEventListener('animationend', () => {
    raiz.classList.remove(CLASSE_DE_ENTRADA);
  });
  aplicar(estado, false);

  recolher.addEventListener('click', () => {
    aplicar('fechada', false);
  });
  flutuante.addEventListener('click', () => {
    aplicar(estado === 'aberta' ? 'fechada' : 'aberta', true);
  });

  return {
    get estado() {
      return estado;
    },
    abrir() {
      aplicar('aberta', true);
    },
    fechar() {
      aplicar('fechada', false);
    },
  };
}
