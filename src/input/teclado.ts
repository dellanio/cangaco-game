import type { Ferramenta } from './ferramenta';

type EventoDeTecla = Event & {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
};

/**
 * `Esc` cancela a ferramenta ativa; `R` escolhe a estrada (GDD §2.2, proposta) — so
 * sem Ctrl/Meta/Alt, porque Ctrl+R e recarregar a pagina. `Delete` fica para a F16
 * (demolir predio). O alvo do evento entra por parametro (em producao, `window`)
 * para o teste headless usar um `EventTarget` do Node, sem `window` nem `document`.
 * Devolve o desligador.
 */
export function ligarTeclado(ferramenta: Ferramenta, alvo: EventTarget): () => void {
  const aoTeclar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (tecla.key === 'Escape') {
      ferramenta.cancelar();
    } else if (tecla.key?.toLowerCase() === 'r' && !tecla.ctrlKey && !tecla.metaKey && !tecla.altKey) {
      ferramenta.selecionarEstrada();
    }
  };
  alvo.addEventListener('keydown', aoTeclar);
  return () => {
    alvo.removeEventListener('keydown', aoTeclar);
  };
}
