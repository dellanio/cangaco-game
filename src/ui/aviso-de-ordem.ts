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
 * O texto da ULTIMA recusa de ordem militar do tick, ou `null`. So os dois motivos da paz:
 * os outros (destino inandavel, sem unidades) a tela nao provoca pelo botao direito.
 * Pura: e o que o teste headless prova.
 */
export function textoDaRecusa(
  eventos: readonly GameEvent[], segundosDePaz: number, rotulos: RotulosDaOrdem = temaSertao.ordem,
): string | null {
  let texto: string | null = null;
  for (const e of eventos) {
    if (e.type !== 'command-rejected' || !ORDENS_MILITARES.has(e.command)) continue;
    if (e.motivo === 'em-paz') texto = rotulos.emPaz.replace('{tempo}', mmss(segundosDePaz));
    else if (e.motivo === 'longe-na-paz') texto = rotulos.longeNaPaz;
  }
  return texto;
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
