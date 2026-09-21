/**
 * As teclas do tempo (F11a, GDD §2.2): `P` alterna a pausa; `+` acelera e `-` desacelera a
 * velocidade de jogo. Modulo proprio, ao lado de `teclado.ts` (que e da ferramenta: `Esc`, `R`)
 * — quem controla o tempo nao e a ferramenta, e cada um continua com a sua assinatura.
 *
 * So sem Ctrl/Meta/Alt: Ctrl+`+` e Ctrl+`-` sao o zoom do navegador. `=` vale como `+`, porque
 * e a mesma tecla sem Shift. `keydown` repetido (tecla segurada) e ignorado: `P` segurado nao
 * pode ligar e desligar a pausa trinta vezes. O alvo do evento entra por parametro (em
 * producao, `window`), para o teste headless usar um `EventTarget` do Node. Devolve o desligador.
 */
export interface ControleDoTempo {
  alternarPausa(): void;
  acelerar(): void;
  desacelerar(): void;
}

type EventoDeTecla = Event & {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly repeat?: boolean;
};

export function ligarTeclasDoTempo(controle: ControleDoTempo, alvo: EventTarget): () => void {
  const aoTeclar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (tecla.ctrlKey || tecla.metaKey || tecla.altKey || tecla.repeat) return;
    const k = tecla.key?.toLowerCase();
    if (k === 'p') controle.alternarPausa();
    else if (k === '+' || k === '=') controle.acelerar();
    else if (k === '-') controle.desacelerar();
  };
  alvo.addEventListener('keydown', aoTeclar);
  return () => {
    alvo.removeEventListener('keydown', aoTeclar);
  };
}
