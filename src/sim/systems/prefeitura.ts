/**
 * `HireMercenary` (F36): o jogador contrata um mercenario na Prefeitura (GDD Anexo A,
 * "ouro por mercenario, pronto na hora").
 *
 * Na hora: o comando aceito debita `custoOuro` da gaveta `entrada` e a unidade nasce na
 * porta NO MESMO TICK, com o lado da Prefeitura e o HP cheio (campo ausente,
 * `sim/vida.ts`). Nao toca recruta, arma nem escola. Dois comandos no mesmo tick: o
 * `step` aplica em sequencia, entao o segundo le a gaveta ja debitada.
 */
import type { Command } from '../commands';
import type { GameState, Unidade } from '../state';
import { MERCADORIA_DE_OURO } from '../state';
import type { GameData } from '../data/types';
import { condicaoCheiaDoTipo } from '../condicao';
import { tileDeSaida } from './escolas';
import { custoDoMercenario, ehPredioDeContratoCompleto, motivoDaRecusaDeMercenario, ouroNaPrefeitura } from '../prefeitura';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type HireMercenary = Extract<Command, { readonly type: 'HireMercenary' }>;

export function aplicarHireMercenary(state: GameState, comando: HireMercenary, dados: GameData): ResultadoDeSistema {
  const motivo = motivoDaRecusaDeMercenario(state, comando.predio, comando.tipo, dados);
  const prefeitura = state.predios.porId[comando.predio];
  const custo = custoDoMercenario(comando.tipo, dados);
  // a porta ANDAVEL, a mesma regra de onde a escola e o quartel soltam o formado
  const porta = ehPredioDeContratoCompleto(prefeitura, dados) ? tileDeSaida(state, prefeitura, dados) : null;
  const recusa = motivo ?? (porta === null ? 'porta-bloqueada' : null);
  if (recusa !== null || !ehPredioDeContratoCompleto(prefeitura, dados) || custo === null || porta === null) {
    return {
      state,
      events: [{
        type: 'command-rejected', command: 'HireMercenary', predio: comando.predio, tipo: comando.tipo,
        motivo: recusa ?? 'predio-nao-e-prefeitura',
      }],
    };
  }
  const entrada = { ...prefeitura.estoque.entrada, [MERCADORIA_DE_OURO]: ouroNaPrefeitura(prefeitura) - custo };
  const depois = comPredio(state, { ...prefeitura, estoque: { ...prefeitura.estoque, entrada } });
  const id = `u${depois.proximoId}`;
  const mercenario: Unidade = {
    id, lado: prefeitura.lado, tipo: comando.tipo, gx: porta.gx, gy: porta.gy,
    fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(comando.tipo, dados),
  };
  return {
    state: {
      ...depois,
      proximoId: depois.proximoId + 1,
      unidades: { porId: { ...depois.unidades.porId, [id]: mercenario }, ordem: [...depois.unidades.ordem, id] },
    },
    events: [{ type: 'unit-trained', predio: prefeitura.id, unidade: id, tipo: comando.tipo }],
  };
}
