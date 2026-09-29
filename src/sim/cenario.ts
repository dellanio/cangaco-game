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
import { completarObra, createInitialState, ID_DO_ARMAZEM, ID_DO_QUARTEL, LADO_DA_IA, LADO_DO_JOGADOR } from './state';
import { tilesDoGrupo } from './systems/marcha';
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
  const nascer = (lado: number, tipo: string, gx: number, gy: number): string => {
    const id = `u${contador}`;
    contador += 1;
    unidades[id] = { id, lado, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo, dados) };
    ordemDasUnidades.push(id);
    return id;
  };

  // C-IA-03b — a tropa do jogador, em fileiras ao sul da vila dele
  const tj = cenario.tropaDoJogador;
  for (let i = 0; i < tj.quantidade; i++) {
    nascer(LADO_DO_JOGADOR, tj.tipo, tj.spawn.gx + (i % tj.porFileira), tj.spawn.gy + Math.floor(i / tj.porFileira));
  }

  // A tropa da IA nasce JA nos tiles da posicao (`tilesDoGrupo`, os mesmos que o passo de
  // voltar ao ponto usaria): em peacetime a IA nao se reposiciona (sim/paz.ts).
  const comVila: GameState = { ...base, predios: { porId: predios, ordem: ordemDosPredios } };
  const posicoes: PosicaoDeDefesa[] = [];
  for (const pos of cenario.posicoes) {
    const tiles = tilesDoGrupo(comVila, pos.ponto, dados.combate.ia.tamanhoDoGrupo, dados);
    const membros: string[] = [];
    for (let i = 0; i < pos.tropa.quantidade; i++) {
      const tile = tiles[i];
      if (tile === undefined) throw new Error(`criarEscaramuca: a posicao '${pos.id}' nao tem ${pos.tropa.quantidade} tiles andaveis`);
      membros.push(nascer(LADO_DA_IA, pos.tropa.tipo, tile.gx, tile.gy));
    }
    posicoes.push({
      id: pos.id, ponto: { gx: pos.ponto.gx, gy: pos.ponto.gy },
      tipoDeGrupo: pos.tipoDeGrupo as PosicaoDeDefesa['tipoDeGrupo'], raio: pos.raio,
      linha: pos.linha as PosicaoDeDefesa['linha'], membros,
    });
  }

  // C-IA-04 — ANDAIME: o grupo fora das posicoes, a sobra que o `atacarComASobra` manda ao
  // ataque quando a paz acaba. Sai com a C-IA-02 (economia da IA): ver o `_doc` do dado.
  const at = cenario.atacantes;
  const tilesDosAtacantes = tilesDoGrupo(comVila, at.ponto, at.quantidade, dados);
  for (let i = 0; i < at.quantidade; i++) {
    const tile = tilesDosAtacantes[i];
    if (tile === undefined) throw new Error(`criarEscaramuca: os atacantes nao tem ${at.quantidade} tiles andaveis`);
    nascer(LADO_DA_IA, at.tipo, tile.gx, tile.gy);
  }

  return {
    ...base,
    predios: { porId: predios, ordem: ordemDosPredios },
    unidades: { porId: unidades, ordem: ordemDasUnidades },
    proximoId: contador,
    ia: { [String(LADO_DA_IA)]: { posicoes } },
    // C-IA-03b — o peacetime: fixo no cenario, parametro de fase depois (sim/paz.ts)
    pazAteTick: base.tick + dados.escaramuca.ticksDePaz,
  };
}
