/**
 * F-D2 — a NAVEGACAO da camera pelo teclado: setas, `WASD` e `Espaco`.
 *
 * Por que um modulo proprio e nao mais um `if` em `teclado.ts`: aquele e sem
 * memoria — recebe a tecla, chama o metodo, acabou. Navegacao tem estado
 * CONTINUO (quais direcoes estao seguras, e a velocidade que cresce enquanto se
 * segura), e estado continuo dentro de um ouvinte sem dono e como se perde
 * tecla presa.
 *
 * Nao toca DOM: o alvo do evento e injetado, como nos outros ouvintes de
 * `input/`. Quem soma ao scroll e a cena (`render/scenes/WorldScene.ts`) — este
 * arquivo nunca viu uma camera.
 *
 * Os numeros vem de `data/terrain.json` pelo funil `render/mapa.ts`
 * (CLAUDE.md §2, invariante 3). O segundo aqui e de RELOGIO DE PAREDE, nao de
 * jogo: a camera anda no quadro do navegador, e a velocidade de jogo (1x, 2x,
 * 3x) nao a acelera.
 */
import { atalhoDeId, casa } from './atalhos';

/** O que a navegacao precisa do dado. `render/mapa.ts` monta este recorte. */
export interface DadosDaCamera {
  readonly velocidadeInicialPxPorSegundo: number;
  readonly aceleracaoPxPorSegundo2: number;
  readonly tetoPxPorSegundo: number;
}

export interface Direcao {
  readonly x: -1 | 0 | 1;
  readonly y: -1 | 0 | 1;
}

/**
 * Tecla -> direcao. `WASD` e SINONIMO das setas (decisao do operador, turno H),
 * e nao um segundo esquema: as duas metades desta tabela apontam para os mesmos
 * quatro vetores.
 *
 * As chaves aqui e as `teclas` do atalho `camera-mover` sao a mesma lista, e
 * `tests/F-D2-navegacao.test.ts` afirma essa igualdade — declarar a tecla no
 * inventario sem dar direcao a ela produziria uma tecla anunciada na tela de
 * ajuda que nao move nada.
 */
const DIRECOES: Readonly<Record<string, Direcao>> = {
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

export interface Navegacao {
  /** `Espaco` segurado. A cena usa para arrastar e para trocar o cursor. */
  readonly espacoApertado: boolean;
  /** A velocidade agora, em px de mundo por segundo. Publicada no debug para o
   *  roteiro afirmar o teto sem cronometrar pixel. */
  readonly velocidade: number;
  /** A soma das direcoes seguras, ja normalizada em -1..1 por eixo. */
  readonly direcao: Direcao;
  /**
   * Quanto andar neste quadro, em px de MUNDO, e o passo onde a velocidade
   * cresce. Chamado uma vez por quadro pela cena.
   */
  avancar(deltaMs: number): { readonly dx: number; readonly dy: number };
  desligar(): void;
}

interface EventoDeTecla extends Event {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

/** A direcao dessa tecla, ou `undefined`. Sem caixa, como `casa()`. */
export function direcaoDaTecla(key: string): Direcao | undefined {
  return DIRECOES[key.toLowerCase()];
}

/** As teclas que movem, para o teste comparar com o inventario. */
export function teclasDeDirecao(): readonly string[] {
  return Object.keys(DIRECOES);
}

/**
 * A velocidade do proximo quadro. Pura de proposito: e a unica aritmetica da
 * feature, e e ela que o teste headless prende ao dado.
 *
 * Soltar tudo NAO desacelera aos poucos — volta direto ao inicio. Um toque
 * curto tem de ser sempre o mesmo passo, senao a mesma batidinha de seta anda
 * distancias diferentes conforme o que o jogador fez antes.
 */
export function proximaVelocidade(
  atual: number,
  deltaMs: number,
  movendo: boolean,
  dados: DadosDaCamera,
): number {
  if (!movendo) return dados.velocidadeInicialPxPorSegundo;
  const crescida = atual + (dados.aceleracaoPxPorSegundo2 * deltaMs) / 1000;
  return Math.min(crescida, dados.tetoPxPorSegundo);
}

export function ligarNavegacao(alvo: EventTarget, dados: DadosDaCamera): Navegacao {
  const mover = atalhoDeId('camera-mover');
  const arrastar = atalhoDeId('camera-arrastar');
  // Teclas apertadas AGORA, em minuscula. Set e nao contador: `keydown` repete
  // enquanto a tecla esta presa, e somar repeticao nunca mais zeraria.
  const seguras = new Set<string>();
  let espaco = false;
  let velocidade = dados.velocidadeInicialPxPorSegundo;

  const semModificador = (e: EventoDeTecla): boolean =>
    e.ctrlKey !== true && e.metaKey !== true && e.altKey !== true;

  const aoApertar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (tecla.key === undefined || !semModificador(tecla)) return;
    if (mover !== undefined && casa(mover, tecla)) {
      // Sem isto a seta rola a pagina inteira junto com a camera.
      evento.preventDefault();
      seguras.add(tecla.key.toLowerCase());
    } else if (arrastar !== undefined && casa(arrastar, tecla)) {
      // O `Espaco` e o caso do aceite 4: sem `preventDefault` ele rola a pagina
      // E dispara o botao do menu que estiver com foco — o jogador tentaria
      // arrastar o mapa e plantaria um predio.
      evento.preventDefault();
      espaco = true;
    }
  };

  const aoSoltar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (tecla.key === undefined) return;
    // Sem checar modificador: soltar tem de funcionar mesmo que o jogador tenha
    // apertado Ctrl no meio, senao a tecla fica presa e a camera nao para.
    seguras.delete(tecla.key.toLowerCase());
    if (arrastar !== undefined && casa(arrastar, tecla)) espaco = false;
  };

  // Trocar de janela com a seta presa deixaria a camera correndo sozinha: o
  // `keyup` chega para a outra janela, nunca para esta.
  const aoPerderFoco = (): void => {
    seguras.clear();
    espaco = false;
    velocidade = dados.velocidadeInicialPxPorSegundo;
  };

  alvo.addEventListener('keydown', aoApertar);
  alvo.addEventListener('keyup', aoSoltar);
  alvo.addEventListener('blur', aoPerderFoco);

  function direcaoAtual(): Direcao {
    let x = 0;
    let y = 0;
    for (const tecla of seguras) {
      const d = DIRECOES[tecla];
      if (d === undefined) continue;
      x += d.x;
      y += d.y;
    }
    // Esquerda e direita juntas se cancelam, e e o que o jogador espera.
    return { x: Math.sign(x) as -1 | 0 | 1, y: Math.sign(y) as -1 | 0 | 1 };
  }

  return {
    get espacoApertado() {
      return espaco;
    },
    get velocidade() {
      return velocidade;
    },
    get direcao() {
      return direcaoAtual();
    },
    avancar(deltaMs: number) {
      const { x, y } = direcaoAtual();
      const movendo = x !== 0 || y !== 0;
      velocidade = proximaVelocidade(velocidade, deltaMs, movendo, dados);
      if (!movendo) return { dx: 0, dy: 0 };
      // Na diagonal os dois eixos dividem a mesma velocidade: sem isto andar de
      // canto seria 41% mais rapido, e o teto do dado deixaria de ser teto.
      const fator = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
      const passo = (velocidade * deltaMs) / 1000;
      return { dx: x * passo * fator, dy: y * passo * fator };
    },
    desligar() {
      alvo.removeEventListener('keydown', aoApertar);
      alvo.removeEventListener('keyup', aoSoltar);
      alvo.removeEventListener('blur', aoPerderFoco);
    },
  };
}
