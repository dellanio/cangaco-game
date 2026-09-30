/**
 * D-TRANSPORTE-02a — o MENU DE DISTRIBUICAO (`KM_WareDistribution.pas`; plano em
 * docs/planos/2026-09-29-D-TRANSPORTE-02-menu-de-distribuicao.md). Por par
 * mercadoria/tipo de predio, o maximo que o predio quer na gaveta de entrada, contando o
 * que esta a caminho (`UpdateDemands` do KaM). O numero padrao vem de
 * `delivery.json: distribuicao`, e o estado guarda so o que o jogador mudou.
 *
 * A regra num lugar so, no molde de `armazem.ts`: o comando e `demandaDeInsumo` perguntam
 * AQUI.
 */
import type { GameState } from './state';
import type { GameData } from './data/types';

export type MotivoDeRecusaDeDistribuicao = 'par-desconhecido' | 'fora-da-faixa';

/** O valor padrao do par, do dado; `undefined` quando o par nao e disputado. */
function padraoDoPar(mercadoria: string, tipo: string, dados: GameData): number | undefined {
  return dados.entrega.distribuicao.padrao[mercadoria]?.[tipo];
}

/** `SetWareDistribution` so vale num par do dado e com inteiro em `0..maximo`. */
export function motivoDaRecusaDeDistribuicao(
  mercadoria: string, tipo: string, quantidade: number, dados: GameData,
): MotivoDeRecusaDeDistribuicao | null {
  if (padraoDoPar(mercadoria, tipo, dados) === undefined) return 'par-desconhecido';
  if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > dados.entrega.distribuicao.maximo) {
    return 'fora-da-faixa';
  }
  return null;
}

/** O limite do par no `lado`: o que o jogador escolheu, ou o padrao do dado; `null`
 *  quando o par nao e disputado e a demanda segue so a gaveta. */
export function limiteDeDistribuicao(
  state: GameState, lado: number, tipo: string, mercadoria: string, dados: GameData,
): number | null {
  const padrao = padraoDoPar(mercadoria, tipo, dados);
  if (padrao === undefined) return null;
  return state.distribuicao?.[String(lado)]?.[mercadoria]?.[tipo] ?? padrao;
}

/**
 * O estado com o limite do par no `lado` = `quantidade`. So a DIFERENCA do padrao fica
 * gravada: o valor padrao apaga a chave, e o objeto que esvazia some, ate o campo
 * inteiro — o estado de quem voltou tudo ao padrao e igual, byte a byte, ao de quem
 * nunca mexeu. O chamador ja validou o par (`motivoDaRecusaDeDistribuicao`).
 */
export function comDistribuicao(
  state: GameState, lado: number, mercadoria: string, tipo: string, quantidade: number, dados: GameData,
): GameState {
  const chaveDoLado = String(lado);
  const doLado = state.distribuicao?.[chaveDoLado] ?? {};
  const { [tipo]: _antigo, ...outrosTipos } = doLado[mercadoria] ?? {};
  const daMercadoria = quantidade === padraoDoPar(mercadoria, tipo, dados)
    ? outrosTipos : { ...outrosTipos, [tipo]: quantidade };
  const { [mercadoria]: _antiga, ...outrasMercadorias } = doLado;
  const novoLado = Object.keys(daMercadoria).length === 0
    ? outrasMercadorias : { ...outrasMercadorias, [mercadoria]: daMercadoria };
  const { [chaveDoLado]: _ladoAntigo, ...outrosLados } = state.distribuicao ?? {};
  const nova = Object.keys(novoLado).length === 0 ? outrosLados : { ...outrosLados, [chaveDoLado]: novoLado };
  const { distribuicao: _campo, ...semCampo } = state;
  return Object.keys(nova).length === 0 ? semCampo : { ...semCampo, distribuicao: nova };
}
