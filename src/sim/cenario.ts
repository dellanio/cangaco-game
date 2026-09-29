/**
 * C-IA-03a (cenario de escaramuca; plano em docs/planos/2026-09-29-C-IA-03-cenario-de-escaramuca.md).
 *
 * A partida com adversario: a vila do jogador de `createInitialState`, mais a vila da IA de
 * `data/escaramuca.json` no lado `LADO_DA_IA` e o `state.ia` com as posicoes de defesa ja
 * guarnecidas. Decisao do operador (2026-09-29): "comece pelo minimo: a IA com a vila de pe
 * e tropa, sem economia" — armazem com estoque, escola, quartel com armas e recrutas finitos,
 * e a tropa nas posicoes. Sem serf e sem producao (isso e a C-IA-02, economia da IA).
 *
 * `createInitialState` NAO muda: o jogo livre continua sendo o que todos os testes e roteiros
 * usam. Como a tela comeca uma escaramuca e a C-IA-03b.
 *
 * Os ids seguem o contador unico (`p<n>`, `u<n>`, `proximoId`), como tudo que a sim cria.
 * Os predios nascem COMPLETOS por `completarObra` (o mesmo caminho que a obra usa), e nao
 * passam por `registrarTipoConstruido`: o menu Build e do jogador (C-IA-03a, desbloqueio por
 * lado).
 */
import type { GameData } from './data/types';
import { gameData } from './data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, ID_DO_QUARTEL, LADO_DA_IA } from './state';
import type { GameState, PosicaoDeDefesa, Predio, PredioCompleto, Unidade } from './state';
import { condicaoCheiaDoTipo } from './condicao';

export function criarEscaramuca(seed: number, dados: GameData = gameData): GameState {
  const base = createInitialState(seed, dados);
  const cenario = dados.escaramuca;
  let contador = base.proximoId;

  const predios: Record<string, Predio> = { ...base.predios.porId };
  const ordemDosPredios = [...base.predios.ordem];
  for (const p of cenario.predios) {
    const def = dados.predios.find((d) => d.id === p.id);
    if (def === undefined) throw new Error(`criarEscaramuca: predio '${p.id}' nao existe em data/buildings.json`);
    const id = `p${contador}`;
    contador += 1;
    let predio: PredioCompleto = completarObra(
      { id, lado: LADO_DA_IA, tipo: p.id, gx: p.gx, gy: p.gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } },
      dados,
    );
    if (p.id === ID_DO_ARMAZEM) predio = { ...predio, estoque: { ...predio.estoque, saida: { ...cenario.estoqueDoArmazem } } };
    if (p.id === ID_DO_QUARTEL) {
      predio = { ...predio, estoque: { ...predio.estoque, entrada: { ...cenario.quartel.entrada } }, recrutas: cenario.quartel.recrutas };
    }
    predios[id] = predio;
    ordemDosPredios.push(id);
  }

  const unidades: Record<string, Unidade> = { ...base.unidades.porId };
  const ordemDasUnidades = [...base.unidades.ordem];
  const posicoes: PosicaoDeDefesa[] = [];
  for (const pos of cenario.posicoes) {
    const membros: string[] = [];
    for (let i = 0; i < pos.tropa.quantidade; i++) {
      const id = `u${contador}`;
      contador += 1;
      unidades[id] = {
        id, lado: LADO_DA_IA, tipo: pos.tropa.tipo, gx: pos.spawn.gx + i, gy: pos.spawn.gy,
        fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(pos.tropa.tipo, dados),
      };
      ordemDasUnidades.push(id);
      membros.push(id);
    }
    posicoes.push({
      id: pos.id, ponto: { gx: pos.ponto.gx, gy: pos.ponto.gy },
      tipoDeGrupo: pos.tipoDeGrupo as PosicaoDeDefesa['tipoDeGrupo'], raio: pos.raio,
      linha: pos.linha as PosicaoDeDefesa['linha'], membros,
    });
  }

  return {
    ...base,
    predios: { porId: predios, ordem: ordemDosPredios },
    unidades: { porId: unidades, ordem: ordemDasUnidades },
    proximoId: contador,
    ia: { [String(LADO_DA_IA)]: { posicoes } },
  };
}
