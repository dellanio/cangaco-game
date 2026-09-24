import type { Ferramenta } from './ferramenta';
import type { Selecao } from './selecao';
import { atalhoDeId, casa } from './atalhos';

type EventoDeTecla = Event & {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
};

/**
 * F-D1 — o que o teclado precisa saber da tela de ajuda, e so isso. A interface
 * mora aqui, e nao em `ui/`, para `input/` nao importar `ui/`: a seta aponta
 * sempre de quem monta DOM para quem le evento.
 */
export interface AjudaParaTeclado {
  /** Fecha se estiver aberta; devolve se DE FATO fechou. E a precedencia do
   *  `Esc` escrita em codigo: com a ajuda aberta, e ela que o `Esc` fecha, e a
   *  ferramenta na mao sobrevive. */
  fechar(): boolean;
  alternar(): void;
}

/**
 * `Esc` larga a ferramenta ativa E fecha o painel aberto (F13b) — e UM `Esc` so,
 * neste mesmo ouvinte, para nao existirem dois `keydown` disputando a pagina.
 * `R` escolhe a estrada (GDD §2.2). `H`/`F1` abrem e fecham a tela de ajuda
 * (F-D1). `Delete` fica para a F16 (demolir predio). O alvo do evento entra por
 * parametro (em producao, `window`) para o teste headless usar um `EventTarget`
 * do Node, sem `window` nem `document`. Devolve o desligador.
 *
 * Desde a F-D1 nenhuma tecla e comparada aqui: quem compara e
 * `input/atalhos.ts`, e e por isso que a tela de ajuda pode afirmar que a lista
 * dela e a lista do que existe.
 */
export function ligarTeclado(
  ferramenta: Ferramenta, alvo: EventTarget,
  /** Opcional: quem nao passa mantem o comportamento anterior a F13b. */
  selecao?: Selecao,
  /** Opcional: quem nao passa mantem o comportamento anterior a F-D1. */
  ajuda?: AjudaParaTeclado,
): () => void {
  const cancelar = atalhoDeId('cancelar');
  const estrada = atalhoDeId('estrada');
  const telaDeAjuda = atalhoDeId('ajuda');

  const aoTeclar = (evento: Event): void => {
    const tecla = evento as EventoDeTecla;
    if (cancelar !== undefined && casa(cancelar, tecla)) {
      // A ajuda primeiro: com ela aberta, o `Esc` e dela e para ali.
      if (ajuda?.fechar() === true) return;
      ferramenta.cancelar();
      selecao?.limpar();
    } else if (estrada !== undefined && casa(estrada, tecla)) {
      ferramenta.selecionarEstrada();
    } else if (telaDeAjuda !== undefined && casa(telaDeAjuda, tecla)) {
      // Sem isto, `F1` abre a ajuda DO NAVEGADOR por cima do jogo.
      evento.preventDefault();
      ajuda?.alternar();
    }
  };
  alvo.addEventListener('keydown', aoTeclar);
  return () => {
    alvo.removeEventListener('keydown', aoTeclar);
  };
}
