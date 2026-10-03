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
 *
 * C-IA-02a (vila da IA com producao; plano em
 * docs/planos/2026-09-29-C-IA-02a-vila-da-ia-com-producao.md): a vila ganha a cadeia do pao
 * (`escaramuca.producao`). O cenario assenta a estrada de cada predio da IA ao armazem dela,
 * ara os campos no alcance do rocado e poe os civis. Nenhuma regra nova: os sistemas do
 * jogador ja rodam por lado (C7).
 */
import type { GameData } from './data/types';
import { gameData } from './data';
import { completarObra, createInitialState, ID_DO_ARMAZEM, ID_DO_QUARTEL, LADO_DA_IA, LADO_DO_JOGADOR } from './state';
import { tilesDoGrupo } from './systems/marcha';
import type { GameState, PosicaoDeDefesa, Predio, PredioCompleto, Unidade } from './state';
import { condicaoCheiaDoTipo } from './condicao';
import { chaveDeTile, tilesDaPorta } from './estradas';
import type { TileDeGrid } from './estradas';
import { buscarCaminho } from './pathfinding';
import { canPlowField } from './campos';
import { caixaDoPredio } from './footprint';
import { receitaDoTipo } from './producao';
import { descobertoInicial } from './nevoa';

/**
 * C-IA-02a — a estrada da porta do armazem da IA a porta de cada outro predio dela, pelo A*
 * no modo `livre`. Os niveis de coleta sao por estrada: sem ela o milho para no rocado.
 *
 * Cada trecho gera um objeto NOVO: o cache do A* e por identidade de `state.estradas`, e
 * mutar o objeto que ja foi a uma busca deixa o raster velho no cache (medido: toda busca
 * no modo `estrada` dava `null`).
 */
function estradasDaVila(state: GameState, ladoDaVila: readonly Predio[], dados: GameData): GameState['estradas'] {
  let estradas: GameState['estradas'] = state.estradas;
  const armazem = ladoDaVila.find((p) => p.tipo === ID_DO_ARMAZEM);
  const de = armazem === undefined ? undefined : tilesDaPorta(armazem, dados)[0];
  if (armazem === undefined || de === undefined) return estradas;
  for (const p of ladoDaVila) {
    if (p === armazem) continue;
    const portas = tilesDaPorta(p, dados);
    const caminho = buscarCaminho({ ...state, estradas }, de, portas, 'livre', dados);
    if (caminho === null) throw new Error(`criarEscaramuca: o predio '${p.tipo}' da IA nao alcanca o armazem`);
    const trecho: Record<string, true> = { ...estradas };
    for (const t of [de, ...caminho.tiles]) trecho[chaveDeTile(t)] = true;
    estradas = trecho;
  }
  return estradas;
}

/**
 * C-IA-02a — os campos da IA: os primeiros `quantidade` tiles araveis no alcance da colheita
 * do predio, varridos por linha (gy, depois gx). Aravel e o que o `canPlowField` do jogador
 * aceita; o campo nasce como o `comOTileArado` o grava.
 */
function camposDaVila(state: GameState, predio: Predio, recurso: string, quantidade: number, dados: GameData): GameState['recursos'] {
  const recursos = { ...state.recursos };
  const colheita = receitaDoTipo(predio.tipo, dados)?.colheita ?? null;
  const caixa = caixaDoPredio(predio, dados);
  const def = dados.recursos.tipos[recurso];
  if (colheita === null || caixa === null || def === undefined) throw new Error(`criarEscaramuca: '${predio.tipo}' nao colhe '${recurso}'`);
  let n = 0;
  for (let gy = caixa.y0 - colheita.alcance; gy < caixa.y1 + colheita.alcance && n < quantidade; gy += 1) {
    for (let gx = caixa.x0 - colheita.alcance; gx < caixa.x1 + colheita.alcance && n < quantidade; gx += 1) {
      const tile: TileDeGrid = { gx, gy };
      if (!canPlowField({ ...state, recursos }, recurso, [tile], dados).ok) continue;
      recursos[chaveDeTile(tile)] = { tipo: recurso, quantidade: def.quantidadeInicial ?? def.rendimentoPorTile };
      n += 1;
    }
  }
  if (n < quantidade) throw new Error(`criarEscaramuca: so ${n} de ${quantidade} campos no alcance do '${predio.tipo}'`);
  return recursos;
}

/** E-TELA-CONFIGURAR-PARTIDA — o que o jogador escolhe antes da escaramuca. Ausente, o padrao. */
export interface OpcoesDaEscaramuca {
  /** A duracao da paz, um valor de `peacetime_opcoes_min_base`; ausente, `peacetime_min_base`. */
  readonly pazMinBase?: number;
}

/** Os ticks da paz escolhida. Valor fora da lista do dado e erro de quem chamou: a tela so
 *  oferece a lista. */
export function ticksDaPaz(dados: GameData, pazMinBase: number | undefined): number {
  if (pazMinBase === undefined) return dados.escaramuca.ticksDePaz;
  const opcao = dados.escaramuca.opcoesDePaz.find((o) => o.minBase === pazMinBase);
  if (opcao === undefined) throw new Error(`criarEscaramuca: paz de ${pazMinBase} min base nao esta em escaramuca.peacetime_opcoes_min_base`);
  return opcao.ticks;
}

export function criarEscaramuca(seed: number, dados: GameData = gameData, opcoes: OpcoesDaEscaramuca = {}): GameState {
  const ticksDePaz = ticksDaPaz(dados, opcoes.pazMinBase);
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

  // C-IA-02a — a estrada e os campos da IA, antes de qualquer unidade nascer
  const soPredios: GameState = { ...base, predios: { porId: predios, ordem: ordemDosPredios } };
  const daIa = ordemDosPredios.map((id) => predios[id] as Predio).filter((p) => p.lado === LADO_DA_IA);
  const comEstrada: GameState = { ...soPredios, estradas: estradasDaVila(soPredios, daIa, dados) };
  const pr = cenario.producao;
  const doCampo = daIa.find((p) => p.tipo === pr.campos.predio);
  if (doCampo === undefined) throw new Error(`criarEscaramuca: o predio dos campos '${pr.campos.predio}' nao esta na vila da IA`);
  const comVila: GameState = { ...comEstrada, recursos: camposDaVila(comEstrada, doCampo, pr.campos.recurso, pr.campos.quantidade, dados) };

  // A tropa da IA nasce JA nos tiles da posicao (`tilesDoGrupo`, os mesmos que o passo de
  // voltar ao ponto usaria): em peacetime a IA nao se reposiciona (sim/paz.ts).
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

  // C-IA-02a — os civis da IA, na ordem dos tipos do dado
  const civis = Object.entries(pr.civis.tipos).flatMap(([tipo, n]) => Array.from({ length: n }, () => tipo));
  const tilesDosCivis = tilesDoGrupo(comVila, pr.civis.ponto, civis.length, dados);
  civis.forEach((tipo, i) => {
    const tile = tilesDosCivis[i];
    if (tile === undefined) throw new Error(`criarEscaramuca: os civis da IA nao tem ${civis.length} tiles andaveis`);
    nascer(LADO_DA_IA, tipo, tile.gx, tile.gy);
  });

  const escaramuca: GameState = {
    ...comVila,
    unidades: { porId: unidades, ordem: ordemDasUnidades },
    proximoId: contador,
    ia: { [String(LADO_DA_IA)]: { posicoes } },
    // C-IA-03b — o peacetime (sim/paz.ts); E-TELA-CONFIGURAR-PARTIDA: o jogador escolhe a duracao
    pazAteTick: base.tick + ticksDePaz,
  };
  // F-TERRENO-NEVOA-DESCOBERTO: refeito com a tropa do jogador, que nasceu aqui
  return { ...escaramuca, descoberto: descobertoInicial(escaramuca, dados) };
}
