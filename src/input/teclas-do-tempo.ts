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
import { atalhoDeId, casa } from './atalhos';

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
  // F-D1: as teclas vem do inventario (`input/atalhos.ts`), nao de literal aqui.
  // O `repeat` continua sendo assunto deste modulo — e regra deste ouvinte, nao
  // do inventario: `P` segurado nao pode ligar e desligar a pausa trinta vezes.
  const pausa = atalhoDeId('pausa');
  const acelerar = atalhoDeId('acelerar');
  const desacelerar = atalhoDeId('desacelerar');

  const aoTeclar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (tecla.repeat) return;
    if (pausa !== undefined && casa(pausa, tecla)) controle.alternarPausa();
    else if (acelerar !== undefined && casa(acelerar, tecla)) controle.acelerar();
    else if (desacelerar !== undefined && casa(desacelerar, tecla)) controle.desacelerar();
  };
  alvo.addEventListener('keydown', aoTeclar);
  return () => {
    alvo.removeEventListener('keydown', aoTeclar);
  };
}
