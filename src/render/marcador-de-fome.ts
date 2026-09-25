/**
 * F20c — o marcador de fome sobre a unidade, no mundo.
 *
 * O render NAO tem limiar. Quem decide se a unidade esta em alerta e
 * `emAlertaDeFome` (`sim/condicao.ts`), que le `limiares.alertaVisual` de
 * `data/condition.json` convertido no carregamento. Aqui ele e REEXPORTADO, nao
 * copiado: o teste da F20c afirma a identidade das duas funcoes, e por isso nao
 * existe um segundo lugar onde o 0,35 possa ficar desatualizado.
 *
 * O marcador nao e permanente de proposito. `alertaVisual` (0,35) fica ABAIXO de
 * `civilVaiComer` (0,50): quem acende ja passou pelo limiar de ir comer e
 * continuou caindo, ou seja, o icone diz "foi e nao conseguiu" — falha de
 * abastecimento —, nao "vai comer agora". Icone aceso em todo civil o tempo todo
 * seria ruido, que e o que o item da fila pediu para evitar.
 *
 * Este arquivo NAO importa `sim/data` (guarda da F04: so `mapa.ts` e `predios.ts`
 * podem) nem `phaser`: e decisao e geometria, o desenho e do `unidades.ts`.
 */
import { emAlertaDeFome } from '../sim/condicao';

/** A unidade desenha o marcador de fome neste quadro? */
export const temMarcadorDeFome = emAlertaDeFome;

/**
 * Onde cada marcador fica acima do centro da unidade, em multiplos do lado dela.
 * Sao dois porque um serf com fome carregando pao mostra os DOIS: no mesmo y, o
 * de fome esconderia a carga, que e informacao da F10. A ordem entre as duas
 * alturas e afirmada no teste — trocar so uma delas empilha em silencio.
 */
export const ALTURA_DA_CARGA_EM_LADOS = 0.9;
export const ALTURA_DA_FOME_EM_LADOS = 1.75;
