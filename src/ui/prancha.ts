// A prancha (Layout 2, docs/propostas/ui-releitura-rts.md §8): a coluna de
// construir, a direita, RETRATIL. Aberta, e a coluna de 260 px que a F06 mede;
// fechada, e uma lombada de tinta na borda direita com o titulo do menu na
// vertical. Quem cresce no lugar dela e o canvas — o Phaser esta em
// `Scale.RESIZE` a 100 % do pai e acompanha a celula da grade sozinho.
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

export function montarPrancha(preferencia: PreferenciaDaPrancha = preferenciaNoNavegador()): Prancha {
  const raiz = document.getElementById('menu-build');
  if (!raiz) throw new Error('prancha: #menu-build nao existe no index.html');

  // O botao de recolher: fica no canto superior direito da coluna aberta.
  const recolher = document.createElement('button');
  recolher.type = 'button';
  recolher.className = 'recolher seta-dir';
  recolher.dataset.fechar = 'prancha';
  recolher.setAttribute('aria-label', temaSertao.paineis.prancha.recolher);
  recolher.title = temaSertao.paineis.prancha.recolher;

  // A lombada: a coluna inteira quando fechada. O rotulo e o TITULO do menu,
  // que ja existe no tema — a lombada e o menu dobrado, nao um botao novo.
  const lombada = document.createElement('button');
  lombada.type = 'button';
  lombada.className = 'lombada seta-esq';
  lombada.dataset.abrir = 'prancha';
  lombada.textContent = temaSertao.menuBuild.titulo;

  raiz.prepend(recolher, lombada);

  let estado: EstadoDaPrancha = preferencia.ler() ?? 'aberta';

  function aplicar(novo: EstadoDaPrancha): void {
    estado = novo;
    document.body.dataset.prancha = novo;
    preferencia.gravar(novo);
  }
  aplicar(estado);

  recolher.addEventListener('click', () => {
    aplicar('fechada');
  });
  lombada.addEventListener('click', () => {
    aplicar('aberta');
  });

  return {
    get estado() {
      return estado;
    },
    abrir() {
      aplicar('aberta');
    },
    fechar() {
      aplicar('fechada');
    },
  };
}
