/**
 * Sonda de sessao da F-T3 (CLAUDE.md §8: vale como evidencia DESTA sessao, NAO
 * como cobertura continua — a protecao permanente e o teste da Tarefa 2 do
 * plano). Arquivo `zz-` para sair da suite quando a sessao fechar.
 *
 * Pergunta: no cenario de fazenda que ja existe, `melhorTileDeColheita` e
 * `melhorTileParaPlantio` escolhem um tile debaixo do PROPRIO footprint? E o
 * caso que a Nota herdada da F18 diz que vira bug no dia em que o especialista
 * sair do predio — o roceiro andaria ate um tile debaixo da propria fazenda.
 */
import { describe, expect, it } from 'vitest';
import { cenarioDeFazenda } from './helpers/producao-cenario';
import {
  melhorTileDeColheita, melhorTileParaPlantio, tilesReservadosParaColheita,
} from '../src/sim/recursos';
import { receitaDoTipo } from '../src/sim/producao';
import { caixaDoPredio } from '../src/sim/footprint';
import { chaveDeTile, tileDeChave } from '../src/sim/estradas';
import { gameData } from '../src/sim/data';
import { gravarEvidencia } from './helpers/evidence';

describe('sonda F-T3', () => {
  it('mede se a escolha do tile cai debaixo do proprio predio', () => {
    const estado = cenarioDeFazenda();
    const predio = estado.predios.porId['f1'];
    if (predio === undefined || predio.estado !== 'completo') throw new Error('sonda: f1 nao esta completo');
    const colheita = receitaDoTipo(predio.tipo, gameData)?.colheita;
    if (colheita === undefined || colheita === null) throw new Error('sonda: farm perdeu a colheita');
    const caixa = caixaDoPredio(predio, gameData);
    if (caixa === null) throw new Error('sonda: farm sem caixa');

    const dentro = (chave: string | null): boolean => {
      if (chave === null) return false;
      const t = tileDeChave(chave);
      return t.gx >= caixa.x0 && t.gx < caixa.x1 && t.gy >= caixa.y0 && t.gy < caixa.y1;
    };

    // A sonda tem de saber dizer NAO: o predicado e conferido contra um tile que
    // esta comprovadamente dentro (a ancora do predio) e um que esta fora (um
    // tile a oeste da caixa). Sonda que devolve `false` em tudo concordaria com
    // qualquer hipotese.
    const ancora = chaveDeTile({ gx: caixa.x0, gy: caixa.y0 });
    const foraDaCaixa = chaveDeTile({ gx: caixa.x0 - 2, gy: caixa.y0 });
    expect(dentro(ancora), 'o predicado deveria acusar a ancora do predio').toBe(true);
    expect(dentro(foraDaCaixa), 'o predicado nao pode acusar tile fora da caixa').toBe(false);
    expect(dentro(null)).toBe(false);

    const escolhidoParaColher = melhorTileDeColheita(
      estado, predio, colheita, 1, tilesReservadosParaColheita(estado), gameData,
    );
    const escolhidoParaPlantar = melhorTileParaPlantio(
      estado, predio, colheita, tilesReservadosParaColheita(estado), gameData,
    );

    gravarEvidencia('zz-probe-F-T3', {
      pergunta: 'a escolha do tile de colheita/plantio cai debaixo do proprio footprint?',
      predio: { id: 'f1', tipo: predio.tipo, gx: predio.gx, gy: predio.gy },
      caixa,
      escolhidoParaColher,
      escolhidoParaPlantar,
      colherCaiDebaixoDoPredio: dentro(escolhidoParaColher),
      plantarCaiDebaixoDoPredio: dentro(escolhidoParaPlantar),
      conferenciaDoPredicado: { ancora: dentro(ancora), foraDaCaixa: dentro(foraDaCaixa) },
    });
    expect(escolhidoParaColher ?? escolhidoParaPlantar).not.toBeNull();
  });
});
