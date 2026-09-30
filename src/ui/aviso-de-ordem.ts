// C-TELA-01 (plano em docs/planos/2026-09-29-C-TELA-01-mensagem-da-ordem-recusada.md) — por
// que a ordem militar nao andou. Antes, o botao direito em paz nao dava retorno nenhum
// (GDD §10). C-COMBATE-02b: a marcha em paz passou a andar, e sobrou so o "Em paz — faltam
// mm:ss" do ataque.
//
// Le os eventos do tick (`command-rejected` que a sim ja emite) e o seletor puro
// `segundosDePazRestantes`, e escreve texto num aviso sobre a celula do canvas. Nunca muda
// o jogo, nunca importa phaser. Os rotulos vem de `theme-sertao.json` (`ordem`).
//
// D-PRODUCAO-03b: sem recusa no tick, o mesmo aviso diz a encomenda de oficina cumprida
// (`textoDaEncomendaCumprida`). A recusa ganha: e resposta ao gesto que o jogador acabou de fazer.
import type { GameEvent, GameState } from '../sim/state';
import { segundosDePazRestantes } from '../sim/paz';
import { mmss } from './contador-de-paz';
import { textoDaEncomendaCumprida } from './encomenda';
import temaSertao from '../../data/theme-sertao.json';

export interface RotulosDaOrdem {
  readonly emPaz: string;
  readonly semInfantaria: string;
  readonly direcaoInvalida: string;
  readonly colunasInvalidas: string;
}

/** As ordens militares que a tela emite pelo botao direito e pela paz (C-IA-03b), e a
 *  investida do painel do grupo (C-COMBATE-01c), que a paz tambem recusa. */
const ORDENS_MILITARES: ReadonlySet<string> = new Set(['MoveUnits', 'AttackUnit', 'AttackBuilding', 'StormAttack']);

/** C-COMBATE-01c — os motivos que a tela pode provocar pelos controles de formacao e pela
 *  investida, e a chave do texto em `theme-sertao.json` (`ordem`). */
const MOTIVOS_COM_TEXTO = {
  'sem-infantaria-corpo-a-corpo': 'semInfantaria',
  'direcao-invalida': 'direcaoInvalida',
  'colunas-invalidas': 'colunasInvalidas',
} as const satisfies Readonly<Record<string, keyof RotulosDaOrdem>>;

function chaveDoMotivo(e: GameEvent): keyof RotulosDaOrdem | null {
  if (e.type !== 'command-rejected' || !ORDENS_MILITARES.has(e.command)) return null;
  return (MOTIVOS_COM_TEXTO as Readonly<Record<string, keyof RotulosDaOrdem>>)[e.motivo] ?? null;
}

/**
 * `'em-paz'` se alguma ordem militar do tick foi recusada pela paz, senao `null`. Os outros
 * motivos (destino inandavel, sem unidades) a tela nao provoca pelo botao direito.
 * C-TELA-02: e tambem o que apaga o marcador de destino.
 */
export function recusaDaPaz(eventos: readonly GameEvent[]): 'em-paz' | null {
  for (const e of eventos) {
    if (e.type === 'command-rejected' && ORDENS_MILITARES.has(e.command) && e.motivo === 'em-paz') return 'em-paz';
  }
  return null;
}

/** O texto da recusa do tick (`recusaDaPaz`), ou `null`. Pura: e o que o teste headless prova. */
export function textoDaRecusa(
  eventos: readonly GameEvent[], segundosDePaz: number, rotulos: RotulosDaOrdem = temaSertao.ordem,
): string | null {
  const motivo = recusaDaPaz(eventos);
  if (motivo === 'em-paz') return rotulos.emPaz.replace('{tempo}', mmss(segundosDePaz));
  for (const e of eventos) {
    const chave = chaveDoMotivo(e);
    if (chave !== null) return rotulos[chave];
  }
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
  const temaDePredios = temaSertao.predios as Readonly<Record<string, { readonly nome: string } | undefined>>;
  const nomeDoTipo = (tipo: string): string => temaDePredios[tipo]?.nome ?? tipo;
  return {
    atualizar(estado) {
      const texto = textoDaRecusa(estado.events, segundosDePazRestantes(estado))
        ?? textoDaEncomendaCumprida(estado, temaSertao.ordem.encomendaCumprida, nomeDoTipo);
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
