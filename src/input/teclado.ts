import type { Ferramenta } from './ferramenta';

/**
 * `Esc` cancela a ferramenta ativa. O alvo do evento entra por parametro (em
 * producao, `window`) para o teste headless usar um `EventTarget` do Node, sem
 * `window` nem `document`. Devolve o desligador.
 */
export function ligarTeclado(ferramenta: Ferramenta, alvo: EventTarget): () => void {
  const aoTeclar = (evento: Event): void => {
    if ((evento as Event & { readonly key?: string }).key === 'Escape') ferramenta.cancelar();
  };
  alvo.addEventListener('keydown', aoTeclar);
  return () => {
    alvo.removeEventListener('keydown', aoTeclar);
  };
}
