import type { Ferramenta } from './ferramenta';
import type { Selecao } from './selecao';

type EventoDeTecla = Event & {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
};

/**
 * `Esc` larga a ferramenta ativa E fecha o painel aberto (F13b) — e UM `Esc` so,
 * neste mesmo ouvinte, para nao existirem dois `keydown` disputando a pagina.
 * `R` escolhe a estrada (GDD §2.2, proposta) — so sem Ctrl/Meta/Alt, porque
 * Ctrl+R e recarregar a pagina. `Delete` fica para a F16 (demolir predio). O
 * alvo do evento entra por parametro (em producao, `window`) para o teste
 * headless usar um `EventTarget` do Node, sem `window` nem `document`. Devolve o
 * desligador.
 */
export function ligarTeclado(
  ferramenta: Ferramenta, alvo: EventTarget,
  /** Opcional: quem nao passa mantem o comportamento anterior a F13b. */
  selecao?: Selecao,
): () => void {
  const aoTeclar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (tecla.key === 'Escape') {
      ferramenta.cancelar();
      selecao?.limpar();
    } else if (tecla.key?.toLowerCase() === 'r' && !tecla.ctrlKey && !tecla.metaKey && !tecla.altKey) {
      ferramenta.selecionarEstrada();
    }
  };
  alvo.addEventListener('keydown', aoTeclar);
  return () => {
    alvo.removeEventListener('keydown', aoTeclar);
  };
}
