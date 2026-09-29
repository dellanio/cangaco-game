// C-TELA-01 (plano em docs/planos/2026-09-29-C-TELA-01-mensagem-da-ordem-recusada.md) — por
// que a ordem militar nao andou. O operador: "'Longe demais na paz' e diferente de 'Em paz —
// faltam mm:ss'". Antes, o botao direito em paz nao dava retorno nenhum (GDD §10).
//
// Le os eventos do tick (`command-rejected` que a sim ja emite) e o seletor puro
// `segundosDePazRestantes`, e escreve texto num aviso sobre a celula do canvas. Nunca muda
// o jogo, nunca importa phaser. Os rotulos vem de `theme-sertao.json` (`ordem`).
import type { GameEvent, GameState } from '../sim/state';
import { segundosDePazRestantes } from '../sim/paz';
import { mmss } from './contador-de-paz';
import temaSertao from '../../data/theme-sertao.json';

export interface RotulosDaOrdem {
  readonly emPaz: string;
  readonly longeNaPaz: string;
}

/** As ordens militares que a tela emite pelo botao direito e pela paz (C-IA-03b). */
const ORDENS_MILITARES: ReadonlySet<string> = new Set(['MoveUnits', 'AttackUnit', 'AttackBuilding']);

/**
 * O motivo da ULTIMA recusa de ordem militar do tick pela paz, ou `null`. So os dois motivos
 * da paz: os outros (destino inandavel, sem unidades) a tela nao provoca pelo botao direito.
 * C-TELA-02: e tambem o que apaga o marcador de destino.
 */
export function recusaDaPaz(eventos: readonly GameEvent[]): 'em-paz' | 'longe-na-paz' | null {
  let motivo: 'em-paz' | 'longe-na-paz' | null = null;
  for (const e of eventos) {
    if (e.type !== 'command-rejected' || !ORDENS_MILITARES.has(e.command)) continue;
    if (e.motivo === 'em-paz' || e.motivo === 'longe-na-paz') motivo = e.motivo;
  }
  return motivo;
}

/** O texto da recusa do tick (`recusaDaPaz`), ou `null`. Pura: e o que o teste headless prova. */
export function textoDaRecusa(
  eventos: readonly GameEvent[], segundosDePaz: number, rotulos: RotulosDaOrdem = temaSertao.ordem,
): string | null {
  const motivo = recusaDaPaz(eventos);
  if (motivo === 'em-paz') return rotulos.emPaz.replace('{tempo}', mmss(segundosDePaz));
  if (motivo === 'longe-na-paz') return rotulos.longeNaPaz;
  return null;
}

export interface AvisoDeOrdem {
  atualizar(estado: GameState): void;
}

/** Liga o `#aviso-de-ordem` do index.html. Some `segundosNaTela` depois da ultima recusa
 *  (relogio de parede: e tela, nao jogo). Recusa nova reinicia a conta. */
export function montarAvisoDeOrdem(): AvisoDeOrdem {
  const elemento = document.getElementById('aviso-de-ordem');
  if (!elemento) throw new Error('aviso-de-ordem: #aviso-de-ordem nao existe no index.html');
  let apagar: ReturnType<typeof setTimeout> | null = null;
  return {
    atualizar(estado) {
      const texto = textoDaRecusa(estado.events, segundosDePazRestantes(estado));
      if (texto === null) return;
      elemento.textContent = texto;
      elemento.hidden = false;
      if (apagar !== null) clearTimeout(apagar);
      apagar = setTimeout(() => {
        elemento.hidden = true;
        apagar = null;
      }, temaSertao.ordem.segundosNaTela * 1000);
    },
  };
}
