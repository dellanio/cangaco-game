/**
 * O laco de tempo fixo (CLAUDE.md §5): quem faz o tempo passar. TypeScript puro, sem DOM,
 * sem Phaser, sem `performance` — a fonte de tempo entra por parametro de `tique`, entao o
 * modulo roda em Node com um relogio falso (`tests/F11a-laco.test.ts`).
 *
 * Mora ao lado da `Sessao` (`src/sessao.ts`), no laco externo, e fora de `render/`: a guarda
 * da F04 mantem fechada a lista de arquivos de `render/` que leem `sim/data`, e o laco
 * precisa de `tickMs` e das velocidades. Ele nao le nada: quem o cria (`main.ts`) injeta.
 *
 * **A velocidade de jogo acelera o RELOGIO, nunca a simulacao.** `velocidade` multiplica o
 * tempo que se acumula; cada `passo()` continua sendo exatamente um `step()`. Mesma lista de
 * comandos e mesmo numero de passos dao o mesmo estado a 1x e a 3x (GDD §11.1).
 */

/**
 * Teto de passos que um unico quadro pode rodar. E SALVAGUARDA DE MOTOR, nao numero de
 * balanceamento: a protecao primaria contra o acumulador tentar recuperar centenas de ticks
 * e a pausa automatica ao ocultar a aba (`pausarAoOcultar`); este teto so cobre o que ela
 * nao pega (uma aba lenta, um quadro de segundos). Ao estourar, o excedente e DESCARTADO —
 * acumular divida so adiaria a rajada. Vive aqui, fora de `sim/`, e nao em `data/`.
 */
export const MAX_PASSOS_POR_QUADRO = 10;

export interface ConfigDoLaco {
  /** Roda UM passo da simulacao (na pratica, `sessao.passo()`). */
  readonly passo: () => void;
  /** Duracao de um tick em ms (`gameData.tempo.tickMs`). */
  readonly tickMs: number;
  /** As velocidades que o jogador pode escolher (`gameData.tempo.velocidadeDeJogo.opcoes`). */
  readonly velocidades: readonly number[];
  readonly velocidadePadrao: number;
  /** O laco nasce pausado (`?pausado` na URL, para o roteiro comecar no tick 0). */
  readonly nascerPausado?: boolean;
}

export interface Laco {
  /**
   * Chamado a cada quadro com o relogio do navegador em ms. Roda os passos devidos e
   * devolve quantos rodou. A primeira chamada so fixa o zero do relogio.
   */
  tique(agoraMs: number): number;
  readonly pausado: boolean;
  pausar(): void;
  retomar(): void;
  alternarPausa(): void;
  readonly velocidade: number;
  acelerar(): void;
  desacelerar(): void;
  /**
   * Fracao do tick em curso, em [0, 1): o que o render usa para interpolar ENTRE ticks.
   * Pausado vale 1, para o render mostrar o tick atual sem interpolar (a pausa e o que
   * deixa o screenshot determinístico).
   */
  alfa(): number;
  /**
   * Roda `passos` ticks. So com o timer pausado: com ele rodando, o passo manual disputaria
   * a mesma sessao com o acumulador e o resultado deixaria de ser reprodutivel. Ponte de
   * harness do roteiro de screenshot (BUILD_PLAN, notas da F11a).
   */
  avancar(passos: number): void;
}

export function criarLaco(config: ConfigDoLaco): Laco {
  const { passo, tickMs, velocidades, velocidadePadrao } = config;
  if (!Number.isFinite(tickMs) || tickMs <= 0) throw new Error(`laco: tickMs '${tickMs}' precisa ser positivo`);
  if (velocidades.length === 0) throw new Error('laco: velocidades esta vazia');
  let indice = velocidades.indexOf(velocidadePadrao);
  if (indice < 0) throw new Error(`laco: o padrao '${velocidadePadrao}' nao esta nas velocidades [${velocidades.join(', ')}]`);

  let pausado = config.nascerPausado === true;
  let acumulado = 0;
  /** `null` = ainda sem referencia: o proximo `tique` so fixa o zero (primeiro quadro ou depois de retomar). */
  let ultimo: number | null = null;

  return {
    tique(agoraMs) {
      if (ultimo === null) {
        ultimo = agoraMs;
        return 0;
      }
      const decorrido = Math.max(0, agoraMs - ultimo);
      ultimo = agoraMs;
      if (pausado) return 0;

      acumulado += decorrido * (velocidades[indice] as number);
      let rodados = 0;
      while (acumulado >= tickMs && rodados < MAX_PASSOS_POR_QUADRO) {
        passo();
        acumulado -= tickMs;
        rodados += 1;
      }
      // estourou o teto: descarta o que sobrou alem da fracao de tick
      if (acumulado >= tickMs) acumulado %= tickMs;
      return rodados;
    },
    get pausado() {
      return pausado;
    },
    pausar() {
      pausado = true;
    },
    retomar() {
      pausado = false;
      // O tempo parado nao se recupera. Sem quadros durante a pausa (aba oculta: o rAF para),
      // `ultimo` estaria velho e o primeiro quadro depois viria como uma rajada.
      ultimo = null;
    },
    alternarPausa() {
      if (pausado) this.retomar();
      else this.pausar();
    },
    get velocidade() {
      return velocidades[indice] as number;
    },
    acelerar() {
      indice = Math.min(indice + 1, velocidades.length - 1);
    },
    desacelerar() {
      indice = Math.max(indice - 1, 0);
    },
    alfa() {
      return pausado ? 1 : acumulado / tickMs;
    },
    avancar(passos) {
      if (!pausado) throw new Error('avancar: o timer esta rodando; so se avanca a mao com o jogo pausado');
      if (!Number.isInteger(passos) || passos < 0) throw new Error(`avancar: '${passos}' nao e um inteiro >= 0`);
      for (let i = 0; i < passos; i++) passo();
    },
  };
}

/**
 * Pausa quando a aba fica oculta; voltar a aba NAO retoma. O navegador estrangula timers em
 * aba escondida, e retomar sozinho devolveria o jogo despausado a quem pausou com `P`,
 * trocou de aba e voltou. O alvo entra por parametro (em producao, `document`).
 * Devolve o desligador.
 */
export function pausarAoOcultar(
  laco: Pick<Laco, 'pausar'>,
  documento: EventTarget & { readonly hidden: boolean },
): () => void {
  const aoMudar = (): void => {
    if (documento.hidden) laco.pausar();
  };
  documento.addEventListener('visibilitychange', aoMudar);
  return () => {
    documento.removeEventListener('visibilitychange', aoMudar);
  };
}

/** `?pausado` na URL, com ou sem valor. E o que o runner de screenshot usa para comecar no tick 0. */
export function nascerPausadoPelaUrl(search: string): boolean {
  return new URLSearchParams(search).has('pausado');
}
