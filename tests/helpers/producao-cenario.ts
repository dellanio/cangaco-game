/**
 * F15a — cenarios de PRODUCAO. O predio nasce pelo MESMO caminho do jogo
 * (`completarObra`, que semeia `capacidade`, `estoque` e `producao`); so a posse
 * e posta a mao, para nao gastar 40 ticks de `indo_ocupar` em cada teste — o
 * caminho inteiro (escola -> tarefa -> ocupar -> produzir) e o aceite da F15a.
 *
 * Os civis do cenario inicial saem: serf e laborer mexeriam no estoque por conta
 * propria e o que se mede aqui e o relogio do ciclo, sozinho.
 */
import { completarObra, createInitialState, ID_DA_BODEGA, ID_DO_ARMAZEM } from '../../src/sim/state';
import { condicaoCheiaDoTipo } from '../../src/sim/condicao';
import type { GameEvent, GameState, PredioCompleto, Producao, Unidade } from '../../src/sim/state';
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import { step } from '../../src/sim/tick';
import { chaveDeTile, predioLigadoAoArmazem, tilesDaPorta } from '../../src/sim/estradas';
import { caixaDeTipo, caixaDoPredio } from '../../src/sim/footprint';
import { canPlace } from '../../src/sim/placement';
import type { TileDeGrid } from '../../src/sim/estradas';
import { trabalhadorDoTipo } from '../../src/sim/ocupacao';
import { disponivelAoAlcance, tilesDeColheita } from '../../src/sim/recursos';
import { receitaDoTipo } from '../../src/sim/producao';
import { registrarTipoConstruido } from '../../src/sim/desbloqueio';
import { canPlowField, comOTileArado } from '../../src/sim/campos';
import { aberturaDaFaseA } from './abertura';
import {
  ancoraDaSerra, ancoraDaVila, ancoraDoLagamar, ancoraDoLagoPequeno, ancoraDoLajedo, ancoraDoRocadoDoNorte,
  relativoA,
} from './ancoras';
import type { Relativo } from './ancoras';
import { LADO_DO_JOGADOR } from '../../src/sim/state';

const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

/*
 * F18c-1a — toda posicao dos cenarios e DESLOCAMENTO a partir de uma ancora
 * (`ancoras.ts`), nunca coordenada absoluta. O comentario ao lado diz onde o
 * tile cai no mapa de hoje, para quem le; o numero que vale e o deslocamento.
 */
const vila = (dados: GameData): Relativo => relativoA(ancoraDaVila(dados));
/** O lajedo e camada de RECURSO, e `comJazida` a substitui: a ancora sai do mapa
 *  publicado, nunca do `dados` do teste, senao a pedreira anda junto com a jazida
 *  injetada e sai da rua. */
const lajedo = (): Relativo => relativoA(ancoraDoLajedo(gameData));
const norte = (dados: GameData): Relativo => relativoA(ancoraDoRocadoDoNorte(dados));
const lago = (dados: GameData): Relativo => relativoA(ancoraDoLagoPequeno(dados));
const lagamar = (dados: GameData): Relativo => relativoA(ancoraDoLagamar(dados));
const serra = (dados: GameData): Relativo => relativoA(ancoraDaSerra(dados));

/** A pedreira da vila: ao lado do lajedo, com a porta na rua que sobe ate o armazem.
 *  Exportada porque `fome-cenario.ts` pede a MESMA pedreira. */
export function pedreiraDaVila(): TileDeGrid {
  return lajedo()(4, 5); // (26,34) hoje
}

/** A rua da porta do armazem ate a porta de `pedreiraDaVila`. */
export function ruaDaPedreiraDaVila(dados: GameData = gameData): TileDeGrid[] {
  const v = vila(dados); // (29,33) .. (28,36) hoje
  return [v(0, 3), v(0, 4), v(0, 5), v(0, 6), v(-1, 6)];
}

/** O tile de rocha colado no footprint de `pedreiraDaVila`: o que os cenarios de
 *  esgotamento transformam em jazida unica (`comJazida`). */
export function rochaDaPedreiraDaVila(): readonly [number, number] {
  const t = lajedo()(3, 3); // (25,32) hoje
  return [t.gx, t.gy];
}

function semCivis(estado: GameState): GameState {
  return { ...estado, unidades: { porId: {}, ordem: [] } };
}

function comEstradas(estado: GameState, tiles: readonly TileDeGrid[]): GameState {
  const novas = Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const]));
  return { ...estado, estradas: { ...estado.estradas, ...novas } };
}

/**
 * Um produtor COMPLETO e ocupado, somado ao estado que veio. Exportado desde a
 * F18d-1a: o aceite dela precisa de uma pedreira viva DENTRO de um cenario que
 * ja tem civis e obra, e nao do cenario fechado de `cenarioDePedreira`.
 */
export function comProdutorOcupado(
  estado: GameState,
  opcoes: { readonly tipo: string; readonly id: string; readonly unidade: string; readonly gx: number; readonly gy: number },
  dados: GameData,
): GameState {
  const def = dados.predios.find((p) => p.id === opcoes.tipo);
  if (!def) throw new Error(`fixture: predio '${opcoes.tipo}' nao existe em buildings.json`);
  const tipoDoCivil = trabalhadorDoTipo(opcoes.tipo, dados);
  if (tipoDoCivil === null) throw new Error(`fixture: '${opcoes.tipo}' nao pede trabalhador`);
  const completo = completarObra({
    lado: LADO_DO_JOGADOR, id: opcoes.id, tipo: opcoes.tipo, gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: def.hp,
    obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  const predio: PredioCompleto = { ...completo, ocupante: opcoes.unidade };
  // na PORTA, que e onde o `indo_ocupar` da F14 larga a unidade — nao em cima do
  // footprint, que nem e andavel
  const porta = tilesDaPorta(predio, dados)[0];
  if (porta === undefined) throw new Error(`fixture: '${opcoes.id}' nao tem porta`);
  const u: Unidade = {
    lado: LADO_DO_JOGADOR, id: opcoes.unidade, tipo: tipoDoCivil, gx: porta.gx, gy: porta.gy, fsm: 'trabalhando', fsmData: {},
    condicao: condicaoCheiaDoTipo(tipoDoCivil),
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [predio.id]: predio }, ordem: [...estado.predios.ordem, predio.id] },
    // SOMA a unidade, nao substitui: os cenarios de um produtor so chamam isto
    // depois de `semCivis` (mapa vazio, resultado identico ao de antes), mas o
    // oraculo precisa de quatro produtores E dos serfs do cenario inicial.
    unidades: { porId: { ...estado.unidades.porId, [u.id]: u }, ordem: [...estado.unidades.ordem, u.id] },
  };
}

/**
 * F21 — um predio COMPLETO que nao pede trabalhador (armazem, escola, Bodega).
 * Generico de proposito: `comArmazemExtra` continua como esta, porque quem o
 * chama passa so a coordenada e nao deve ter que repetir o tipo.
 */
function comPredioSemTrabalhador(
  estado: GameState, tipo: string, id: string, gx: number, gy: number, dados: GameData,
): GameState {
  const def = dados.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`fixture: predio '${tipo}' nao existe em buildings.json`);
  if (trabalhadorDoTipo(tipo, dados) !== null) throw new Error(`fixture: '${tipo}' pede trabalhador`);
  const predio = completarObra({
    lado: LADO_DO_JOGADOR, id, tipo, gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: predio }, ordem: [...estado.predios.ordem, id] },
  };
}

/** A fixture confere a si mesma: coordenada errada falha AQUI, com o motivo
 *  escrito, e nao tres `expect` adiante como "produziu 0". */
function exigirLigado(estado: GameState, id: string, dados: GameData): GameState {
  const p = estado.predios.porId[id];
  if (p === undefined) throw new Error(`fixture: predio '${id}' nao entrou no estado`);
  if (!predioLigadoAoArmazem(estado, p, dados)) throw new Error(`fixture: '${id}' nao ficou ligado ao armazem`);
  return estado;
}

/** Pedreira `q1` (`pedreiraDaVila`) ocupada por `u1`, ligada a porta do armazem. */
export function cenarioDePedreira(dados: GameData = gameData): GameState {
  // `dados` VAI para `createInitialState`: desde a F-T2a a camada de recurso
  // nasce com o estado, entao um cenario de dado trocado que esquecesse de
  // passa-lo abriria com a jazida do arquivo, nao com a do teste.
  let s = semCivis(createInitialState(1, dados));
  s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q1', unidade: 'u1', ...pedreiraDaVila() }, dados);
  s = comEstradas(s, ruaDaPedreiraDaVila(dados));
  return exigirLigado(s, 'q1', dados);
}

/**
 * F15b — o cenario ORACULO do GDD §4.5: 2 Woodcutter's : 1 Sawmill, mais a
 * pedreira, todos ocupados e ligados a MESMA rede de estrada, e COM os civis do
 * cenario inicial — sao os serfs deles que entregam. E o cenario de medicao, nao
 * de unidade: ele existe para ser rodado por milhares de ticks e observado.
 *
 * Disposicao (y=36 e a rua que passa na porta de todos; x=29 sobe ate a porta do
 * armazem, em 29,33):
 *   w2 (18,34)  w1 (22,34)  q1 (26,34)  [armazem 29..31]  s1 (32,34)

 * TETO DE MEDICAO: ~11 500 TICKS (medido na F-T3, 2026-09-25). Este cenario NAO
 * tem Bodega, e desde a F20a comer exige uma `inn` completa: os paes do armazem
 * ficam la, ninguem os alcanca, e entre 11 500 e 12 000 ticks a populacao inteira
 * morre de fome — aos 12 000 nao ha um civil vivo e as quatro tarefas de `ocupar`
 * estao abertas. Nao e bug: e o que a regra da fome faz numa aldeia sem Bodega.
 * Para medicao mais longa, ponha uma Bodega abastecida no cenario; ate entao,
 * numero tirado depois de ~11 000 ticks e numero de aldeia morta.
 */
export function cenarioOraculo(dados: GameData = gameData): GameState {
  let s = createInitialState(1, dados);
  // Os dois lenhadores NAO tem coordenada propria: eles nascem onde a REGRA da
  // abertura pos a mata (`aberturaDaFaseA`, a mesma que a Fase A usa). Antes da
  // F-T4b eles ficavam em (18,34) e (22,34), que tem ZERO arvore ao alcance 6 —
  // com `colheita` declarada na receita isso deixou de ser detalhe e virou
  // `acumulado.timber === 0` no aceite: o carpinteiro esperava tronco que nunca
  // vinha. Fixture com coordenada digitada nao acompanha mudanca de regra.
  const daMata = aberturaDaFaseA(s, dados).plantas.filter((pl) => pl.tipo === 'woodcutters');
  const [m1, m2] = daMata;
  if (m1 === undefined || m2 === undefined) {
    throw new Error('fixture do oraculo: a abertura precisa derivar DOIS lenhadores');
  }
  s = comProdutorOcupado(s, { tipo: 'woodcutters', id: 'w2', unidade: 'lenhador-2', gx: m1.gx, gy: m1.gy }, dados);
  s = comProdutorOcupado(s, { tipo: 'woodcutters', id: 'w1', unidade: 'lenhador-1', gx: m2.gx, gy: m2.gy }, dados);
  const v = vila(dados);
  s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q1', unidade: 'pedreiro', ...pedreiraDaVila() }, dados);
  s = comProdutorOcupado(s, { tipo: 'sawmill', id: 's1', unidade: 'carpinteiro', ...v(3, 4) }, dados); // (32,34)
  // A rua do oraculo (y=36 na porta de todos, subindo em x=29 ate a porta do
  // armazem) mais a rua da propria abertura, que e quem alcanca a porta dos
  // lenhadores la em cima. As duas se encontram em (29,33) e viram UMA rede.
  const rua: TileDeGrid[] = [];
  for (let dx = -11; dx <= 6; dx++) rua.push(v(dx, 6)); // x 18..35, y=36
  for (let dy = 3; dy <= 5; dy++) rua.push(v(0, dy)); // x=29, y 33..35
  for (const t of aberturaDaFaseA(s, dados).rua) rua.push(tile(t.gx, t.gy));
  s = comEstradas(s, rua);
  for (const id of ['w1', 'w2', 'q1', 's1']) exigirLigado(s, id, dados);
  return s;
}

/**
 * F18 — Fazenda `f1` (112,30) ocupada por `roceiro`, no NORTE do mapa, ao lado
 * do bloco de terra arada que o gerador emitiu, com um armazem proprio em
 * (116,34) e a rua que liga os dois.
 *
 * Longe da aldeia de proposito: a terra arada do mapa esta onde esta, e um
 * cenario que injetasse campo ao lado do armazem da abertura provaria o ciclo
 * sobre um dado que o jogo nao tem. O armazem extra nao e artificio — e o que o
 * jogador faz quando produz longe, e `predioLigadoAoArmazem` aceita qualquer
 * armazem completo.
 *
 * A fazenda NAO fica em cima do proprio campo: o footprint escolhido nao
 * encosta em tile de milho. Ver a pergunta em aberto do PROGRESS.md sobre tile
 * de recurso debaixo de predio.
 */
export function cenarioDeFazenda(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const n = norte(dados);
  s = comArmazemExtra(s, 'armazem-do-roçado', n(8, 12).gx, n(8, 12).gy, dados); // (116,34)
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', ...n(4, 8) }, dados); // (112,30)
  const rua: TileDeGrid[] = [];
  for (let dy = 11; dy <= 15; dy++) rua.push(n(4, dy)); // x=112, y 33..37
  for (let dx = 4; dx <= 11; dx++) rua.push(n(dx, 15)); // x 112..119, y=37
  s = comEstradas(s, rua);
  return exigirLigado(s, 'f1', dados);
}

/**
 * F-CAMPO-a — a MESMA fazenda, com UM so tile de milho ao alcance: os outros tiles
 * que o alcance pega saem de `recursos` (voltam a ser terra, sem campo). Com o
 * crescer no tile o rodizio semeia tudo o que alcanca antes de colher, e o aceite
 * da F18 (produz, para quando zera, volta apos replantio) ficaria esperando o
 * roceiro semear catorze. Um tile prova a mesma regra sem a espera. O tile que
 * fica e o PRIMEIRO da ordem de `tilesDeColheita`, escolhido pelo estado.
 */
export function cenarioDeFazendaDeUmTile(dados: GameData = gameData): GameState {
  const s = cenarioDeFazenda(dados);
  const predio = s.predios.porId.f1;
  const colheita = receitaDoTipo('farm', dados)?.colheita ?? null;
  if (predio?.estado !== 'completo' || colheita === null) {
    throw new Error('fixture: `farm` precisa de receita com colheita');
  }
  const [fica, ...saem] = tilesDeColheita(s, predio, colheita, dados);
  if (fica === undefined) throw new Error('fixture: a fazenda do norte nao alcanca campo nenhum');
  const recursos = { ...s.recursos };
  for (const k of saem) delete recursos[k];
  return { ...s, recursos };
}

/**
 * 2026-09-26 — o CANAVIAL no lugar da fazenda (`c1`, `wineyard`, porta em y=33
 * na mesma rua), com `partidos` tiles de cana ARADOS pelo caminho do jogo:
 * `canPlowField` aprova e `comOTileArado` assenta — so o laborer que ara e
 * pulado. Os tiles sao os de grama mais perto do footprint, dentro do alcance da
 * receita, escolhidos pelo estado e nao digitados.
 */
export function cenarioDeCanavial(dados: GameData = gameData, partidos: number = 2): GameState {
  let s = semCivis(createInitialState(1, dados));
  const n = norte(dados);
  s = comArmazemExtra(s, 'armazem-do-canavial', n(8, 12).gx, n(8, 12).gy, dados); // (116,34)
  s = comProdutorOcupado(s, { tipo: 'wineyard', id: 'c1', unidade: 'canavieiro', ...n(4, 9) }, dados); // (112,31)
  const rua: TileDeGrid[] = [];
  for (let dy = 11; dy <= 15; dy++) rua.push(n(4, dy)); // x=112, y 33..37
  for (let dx = 4; dx <= 11; dx++) rua.push(n(dx, 15)); // x 112..119, y=37
  s = comEstradas(s, rua);
  s = exigirLigado(s, 'c1', dados);
  const colheita = receitaDoTipo('wineyard', dados)?.colheita ?? null;
  const predio = s.predios.porId.c1;
  const caixa = predio === undefined ? null : caixaDoPredio(predio, dados);
  if (colheita === null || caixa === null) throw new Error('fixture: o Canavial nao colhe nada');
  const candidatos: { t: TileDeGrid; d: number }[] = [];
  for (let gy = caixa.y0 - colheita.alcance; gy < caixa.y1 + colheita.alcance; gy++) {
    for (let gx = caixa.x0 - colheita.alcance; gx < caixa.x1 + colheita.alcance; gx++) {
      const dx = gx < caixa.x0 ? caixa.x0 - gx : gx >= caixa.x1 ? gx - (caixa.x1 - 1) : 0;
      const dy = gy < caixa.y0 ? caixa.y0 - gy : gy >= caixa.y1 ? gy - (caixa.y1 - 1) : 0;
      const d = Math.max(dx, dy);
      if (d > 0 && canPlowField(s, colheita.recurso, [tile(gx, gy)], dados).ok) candidatos.push({ t: tile(gx, gy), d });
    }
  }
  if (candidatos.length < partidos) throw new Error(`fixture: so ${candidatos.length} tiles araveis ao alcance`);
  candidatos.sort((a, b) => a.d - b.d || a.t.gy - b.t.gy || a.t.gx - b.t.gx);
  for (const { t } of candidatos.slice(0, partidos)) {
    const planejado = { ...s, camposPlanejados: { ...s.camposPlanejados, [chaveDeTile(t)]: colheita.recurso } };
    const arado = comOTileArado(planejado, t, dados);
    if (arado === null) throw new Error(`fixture: o tile ${chaveDeTile(t)} nao foi arado`);
    s = arado;
  }
  return s;
}

/**
 * F-CANA-b — o Canavial `c1` posto na VILA, ao lado da mancha de cana que o
 * gerador semeia, e nenhum tile arado pela fixture: o partido e o do mapa. A
 * rua sai da porta do armazem por y=33, desce em x=33 e corre em y=37, na porta
 * do Canavial.
 */
export function cenarioDeCanavialDaVila(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const v = vila(dados);
  // Ao lado da faixa de cana (x 34..38, y 35..36), e nao em cima dela; a rua desce
  // pela coluna livre entre a roca e a cana, que nenhuma das duas ocupa.
  s = comProdutorOcupado(s, { tipo: 'wineyard', id: 'c1', unidade: 'canavieiro', ...v(10, 5) }, dados); // (39,35)
  const rua: TileDeGrid[] = [];
  for (let dx = 0; dx <= 3; dx++) rua.push(v(dx, 3)); // y=33, x 29..32: a porta do armazem
  for (let dy = 3; dy <= 7; dy++) rua.push(v(4, dy)); // x=33, y 33..37
  for (let dx = 5; dx <= 12; dx++) rua.push(v(dx, 7)); // x 34..41, y=37
  s = comEstradas(s, rua);
  return exigirLigado(s, 'c1', dados);
}

/**
 * F18 — a MESMA fazenda, posta na aldeia: ligada, ocupada, e sem um unico tile
 * de campo ao alcance. E o erro que o jogador comete antes de a planta fantasma
 * da F-TP existir, e e o cenario que produz o alerta `sem-campo`.
 *
 * A fixture confere a si mesma: se o mapa um dia tiver terra arada perto da
 * aldeia, isto falha aqui com o motivo escrito, em vez de o alerta sumir
 * calado tres testes adiante.
 */
export function cenarioDeFazendaSemCampo(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const v = vila(dados);
  // A LESTE da escola desde a noite 17: a roca da vila entrou na faixa sul
  // (x 26..30, y 35..36), e no lugar antigo, (33,30), o milho caia ao alcance.
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', ...v(9, 0) }, dados); // (38,30)
  s = comEstradas(s, Array.from({ length: 10 }, (_, dx) => v(dx, 3))); // y=33, x 29..38
  s = exigirLigado(s, 'f1', dados);
  const predio = s.predios.porId.f1;
  const colheita = receitaDoTipo('farm', dados)?.colheita ?? null;
  if (predio?.estado !== 'completo' || colheita === null) {
    throw new Error('fixture: `farm` precisa de receita com colheita');
  }
  for (const chave of tilesDeColheita(s, predio, colheita, dados)) {
    if (s.recursos[chave] !== undefined) {
      throw new Error(`fixture: a fazenda da aldeia alcanca o tile de recurso ${chave}`);
    }
  }
  return s;
}

/**
 * F19 — a CADEIA DO PAO na proporcao que o proprio dado publica como oraculo
 * (`production.json:proporcoesDeReferencia`, 1 fazenda : 1 moinho : 1 padaria),
 * mais o armazem por onde tudo passa e os serfs que carregam.
 *
 * Os serfs entram a MAO, e nao pelo cenario inicial: os do jogo nascem na vila,
 * a 80 tiles daqui, e gastariam o teste inteiro so chegando. Numero e posicao
 * sao do cenario, nao do balanceamento — o que se mede e se a cadeia FECHA.
 *
 * Disposicao (y=37 e a rua que passa na porta de todos):
 *   b1 (104,34)   m1 (108,34)   [f1 112,30, porta em y=33]   arm (116,34)
 */
export function cenarioDaCadeiaDoPao(
  dados: GameData = gameData, serfs: number = 4,
): GameState {
  let s = semCivis(createInitialState(1, dados));
  const n = norte(dados);
  s = comArmazemExtra(s, 'arm', n(8, 12).gx, n(8, 12).gy, dados); // (116,34)
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', ...n(4, 8) }, dados); // (112,30)
  s = comProdutorOcupado(s, { tipo: 'mill', id: 'm1', unidade: 'moleiro', ...n(0, 12) }, dados); // (108,34)
  s = comProdutorOcupado(s, { tipo: 'bakery', id: 'b1', unidade: 'forneiro', ...n(-4, 12) }, dados); // (104,34)
  const rua: TileDeGrid[] = [];
  for (let dy = 11; dy <= 15; dy++) rua.push(n(4, dy)); // x=112, y 33..37
  for (let dx = -4; dx <= 11; dx++) rua.push(n(dx, 15)); // x 104..119, y=37
  s = comEstradas(s, rua);
  for (const id of ['f1', 'm1', 'b1']) s = exigirLigado(s, id, dados);
  // F20b: a Bodega entra no cenario porque a janela dele (12 000 ticks) E uma
  // condicao cheia de civil. Ela come do proprio cuscuz que a cadeia entrega.
  s = comBodegaAbastecida(s, 'bodega', 'arm', dados);
  return comHistoricoDosPredios(comSerfs(s, serfs, n(4, 15).gx, n(4, 15).gy)); // (112,37)
}

/**
 * F19b — a CADEIA DA CARNE: milho -> bode -> carne de sol, na MESMA geografia da
 * cadeia do pao (o milho do mapa esta no norte, e e de la que o milho sai), com o
 * armazem por onde tudo passa e os serfs que carregam.
 *
 * Disposicao (y=37 e a rua que passa na porta de todos):
 *   bu1 (103,34)   sf1 (107,34)   [f1 112,30, porta em y=33]   arm (116,34)
 *
 * A granja e o acougue ficam em GRAMA, ao sul da terra arada (medido no mapa:
 * `campoArado` vai de y=26 a y=30), para que nenhum footprint cubra tile de
 * plantio — o caso da nota herdada da F18, que e da F-T3 e nao deste cenario.
 */
export function cenarioDaCadeiaDaCarne(
  dados: GameData = gameData, serfs: number = 4,
): GameState {
  let s = semCivis(createInitialState(1, dados));
  const n = norte(dados);
  s = comArmazemExtra(s, 'arm', n(8, 12).gx, n(8, 12).gy, dados); // (116,34)
  s = comProdutorOcupado(s, { tipo: 'farm', id: 'f1', unidade: 'roceiro', ...n(4, 8) }, dados); // (112,30)
  s = comProdutorOcupado(s, { tipo: 'swine_farm', id: 'sf1', unidade: 'criador', ...n(-1, 12) }, dados); // (107,34)
  s = comProdutorOcupado(s, { tipo: 'butchers', id: 'bu1', unidade: 'carneador', ...n(-5, 12) }, dados); // (103,34)
  const rua: TileDeGrid[] = [];
  for (let dy = 11; dy <= 15; dy++) rua.push(n(4, dy)); // x=112, y 33..37
  for (let dx = -5; dx <= 11; dx++) rua.push(n(dx, 15)); // x 103..119, y=37
  s = comEstradas(s, rua);
  for (const id of ['f1', 'sf1', 'bu1']) s = exigirLigado(s, id, dados);
  // F20b: mesma razao da cadeia do pao, e aqui a janela e maior ainda (20 000
  // ticks). A carne de sol e comida em `condition.json`: a cadeia alimenta a vila.
  s = comBodegaAbastecida(s, 'bodega', 'arm', dados);
  return comHistoricoDosPredios(comSerfs(s, serfs, n(4, 15).gx, n(4, 15).gy)); // (112,37)
}

/**
 * F19b — a MESMA cadeia da carne sem um elo. Tira o predio E o ocupante, e refaz
 * `tiposJaConstruidos` a partir do que sobrou: sem isso o menu Build mentiria
 * sobre a arvore, e o teste mediria a fixture.
 */
function semPredioEOcupante(estado: GameState, predio: string, unidade: string): GameState {
  const porId = { ...estado.predios.porId };
  delete porId[predio];
  const uPorId = { ...estado.unidades.porId };
  delete uPorId[unidade];
  return comHistoricoDosPredios({
    ...estado,
    predios: { porId, ordem: estado.predios.ordem.filter((i) => i !== predio) },
    unidades: { porId: uPorId, ordem: estado.unidades.ordem.filter((i) => i !== unidade) },
    tiposJaConstruidos: [],
  });
}

/** Sem a Malhada: o milho se acumula e o acougue nunca ve um bode. E o que impede
 *  o aceite de passar por um acougue que fabrique carne do nada. */
export function cenarioDaCarneSemGranja(dados: GameData = gameData): GameState {
  return semPredioEOcupante(cenarioDaCadeiaDaCarne(dados), 'sf1', 'criador');
}

/** Sem a Fazenda: a fonte da cadeia inteira desaparece, e nada e produzido. */
export function cenarioDaCarneSemFazenda(dados: GameData = gameData): GameState {
  return semPredioEOcupante(cenarioDaCadeiaDaCarne(dados), 'f1', 'roceiro');
}

/** Serfs ociosos em cima de um tile, para o cenario que precisa de carga sem
 *  esperar a caminhada da vila. Ids `serf-1..n`, para nao colidir com os `u<n>`
 *  do cenario inicial. */
export function comSerfs(
  estado: GameState, quantos: number, gx: number, gy: number,
): GameState {
  const porId = { ...estado.unidades.porId };
  const ordem = [...estado.unidades.ordem];
  for (let i = 1; i <= quantos; i++) {
    const u: Unidade = { lado: LADO_DO_JOGADOR, id: `serf-${i}`, tipo: 'serf', gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('serf') };
    porId[u.id] = u;
    ordem.push(u.id);
  }
  return { ...estado, unidades: { porId, ordem } };
}

/** F19 — a MESMA cadeia sem o elo do meio: a padaria e a fazenda, e nenhum
 *  moinho. E o que impede o aceite de passar por a padaria fabricar pao do nada. */
export function cenarioDaCadeiaSemMoinho(dados: GameData = gameData): GameState {
  const completa = cenarioDaCadeiaDoPao(dados);
  const porId = { ...completa.predios.porId };
  delete porId.m1;
  return comHistoricoDosPredios({
    ...completa,
    predios: { porId, ordem: completa.predios.ordem.filter((id) => id !== 'm1') },
    unidades: {
      porId: Object.fromEntries(
        Object.entries(completa.unidades.porId).filter(([id]) => id !== 'moleiro'),
      ),
      ordem: completa.unidades.ordem.filter((id) => id !== 'moleiro'),
    },
    tiposJaConstruidos: [],
  });
}

/**
 * O historico de tipos (`tiposJaConstruidos`, F12) refeito a partir dos predios
 * que EXISTEM. Cenario montado a mao nunca passou por `registrarConclusoes`, e
 * sem isto uma vila com fazenda de pe aparece no menu Build como se nunca
 * tivesse construido uma — o que faria o teste do desbloqueio medir a fixture,
 * nao a regra.
 */
function comHistoricoDosPredios(estado: GameState): GameState {
  let s = estado;
  for (const id of s.predios.ordem) {
    const p = s.predios.porId[id];
    if (p?.estado === 'completo') s = registrarTipoConstruido(s, p.tipo);
  }
  return s;
}

/** Um armazem COMPLETO a mais, sem estoque e sem ocupante (armazem nao tem
 *  trabalhador). Existe para os cenarios que produzem longe da aldeia. */
export function comArmazemExtra(
  estado: GameState, id: string, gx: number, gy: number, dados: GameData = gameData,
): GameState {
  const def = dados.predios.find((p) => p.id === 'storehouse');
  if (!def) throw new Error('fixture: storehouse nao existe em buildings.json');
  const predio = completarObra({
    lado: LADO_DO_JOGADOR, id, tipo: 'storehouse', gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  return {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [id]: predio },
      ordem: [...estado.predios.ordem, id],
    },
  };
}

/**
 * F20b — uma Bodega COMPLETA a leste de um armazem do cenario, com a rua na porta
 * dela. Os cenarios LONGOS precisam dela por aritmetica do dado, nao por gosto:
 * `condicao.ticksCondicaoCheia.civil` e 12 000 ticks, que e exatamente a janela da
 * F19 (a da F19b e maior ainda), entao uma vila sem lugar para comer morre INTEIRA
 * dentro da janela que esses testes medem.
 *
 * A comida nao e semeada: ela chega pelo nivel 1 de `delivery.json`, do armazem
 * para a Bodega, pelo caminho que a F20a abriu — e o pao (ou a carne) que a
 * propria cadeia do cenario produziu. Bodega abastecida a mao provaria a
 * sobrevivencia contra um estoque que o jogo nao fez.
 *
 * O `x` nao e digitado: anda para o leste ate o primeiro em que `canPlace` — o
 * MESMO predicado que recusa a planta do jogador — diz sim, o molde de
 * `plantaDaBodega`. Lanca se nao couber, porque cenario que cala aqui mede a
 * fixture tres `expect` adiante.
 */
export function comBodegaAbastecida(
  estado: GameState, id: string, armazemId: string, dados: GameData = gameData,
): GameState {
  const armazem = estado.predios.porId[armazemId];
  if (armazem === undefined || armazem.estado !== 'completo') {
    throw new Error(`fixture: '${armazemId}' nao e armazem completo`);
  }
  const caixaDoArmazem = caixaDoPredio(armazem, dados);
  if (caixaDoArmazem === null) throw new Error(`fixture: '${armazemId}' nao tem tamanho`);
  const def = dados.predios.find((p) => p.id === ID_DA_BODEGA);
  if (!def) throw new Error(`fixture: '${ID_DA_BODEGA}' nao existe em buildings.json`);

  // na MESMA linha do armazem: a porta dos dois cai na mesma rua, que e o que liga
  // a Bodega a rede sem uma volta de estrada nova
  const gy = caixaDoArmazem.y0;
  const limite = dados.terreno.mapaPadrao.largura;
  let gx = caixaDoArmazem.x1;
  while (gx < limite && !canPlace(estado, ID_DA_BODEGA, gx, gy, dados).ok) gx += 1;
  if (gx >= limite) throw new Error('fixture: a Bodega nao cabe a leste do armazem');
  if (caixaDeTipo(ID_DA_BODEGA, gx, gy, dados) === null) throw new Error('fixture: Bodega sem tamanho');

  const predio = completarObra({
    lado: LADO_DO_JOGADOR, id, tipo: ID_DA_BODEGA, gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 },
  }, dados);
  const comBodega: GameState = {
    ...estado,
    predios: {
      porId: { ...estado.predios.porId, [id]: predio },
      ordem: [...estado.predios.ordem, id],
    },
  };
  return exigirLigado(comEstradas(comBodega, tilesDaPorta(predio, dados)), id, dados);
}

/**
 * F-T4a — a fixture confere a si mesma: cenario de pescador so vale se o cardume
 * ao alcance for o que o cenario diz que e. Numero EXATO, e nao minimo: se o
 * mapa mudar, o teste que conta margem contra interior falha AQUI, com a
 * coordenada escrita, e nao tres `expect` adiante como "escolheu o tile errado".
 */
function exigirColheitaAoAlcance(
  estado: GameState, id: string, esperado: number, dados: GameData,
): GameState {
  const predio = estado.predios.porId[id];
  const colheita = predio === undefined ? null : receitaDoTipo(predio.tipo, dados)?.colheita ?? null;
  if (predio?.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  if (colheita === null) throw new Error(`fixture: '${predio.tipo}' precisa de receita com colheita`);
  const tiles = tilesDeColheita(estado, predio, colheita, dados);
  if (tiles.length !== esperado) {
    throw new Error(
      `fixture: '${id}' deveria alcancar ${esperado} tiles de '${colheita.recurso}', alcanca ${tiles.length}`,
    );
  }
  return estado;
}

/**
 * F-T4a — Casa do Pescador `p1` (32,27), na margem SUL do lago pequeno, ligada
 * ao armazem da abertura (29,30) pela rua que desce a coluna 32.
 *
 * O lago pequeno esta a QUATRO tiles do armazem inicial (medido no plano da
 * F-T4): ao contrario da fazenda, o cenario do pescador nao precisa ir para o
 * norte do mapa nem levar armazem proprio. Uma cabana so, em (32,27), alcanca os
 * 31 tiles do lago com alcance 6 — e por isso e ela que responde "ele sai, anda
 * e pesca DA MARGEM", que e a perna nova desta feature: agua nao se pisa.
 *
 * O id e `pesc1`, e nao `p1`: `p1` e o ARMAZEM da abertura (`createInitialState`),
 * e `comProdutorOcupado` substitui por id — a cabana comia o armazem e o cenario
 * inteiro deixava de ter para onde entregar.
 */
export function cenarioDePescador(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const v = vila(dados);
  s = comProdutorOcupado(s, { tipo: 'fishermans', id: 'pesc1', unidade: 'pescador', ...lago(dados)(4, 3) }, dados); // (32,27)
  // a rua desce da porta da cabana ate a linha de porta do armazem: e rua da VILA
  s = comEstradas(s, [v(3, -1), v(3, 0), v(3, 1), v(3, 2), v(3, 3), v(2, 3)]); // x=32 y 29..33, e (31,33)
  return exigirColheitaAoAlcance(exigirLigado(s, 'pesc1', dados), 'pesc1', 31, dados);
}

/**
 * F-T4a — a mesma cabana com UM cardume so ao alcance: `p1` (45,26) alcanca
 * apenas o tile (39,26), a ponta leste do lago pequeno, e leva armazem proprio.
 *
 * E o cenario do ESGOTAMENTO. Com um tile so, zerar o alcance inteiro cabe num
 * teste: o regime do peixe e `nunca`, entao a entrada tem de SAIR do estado, e o
 * que se prova depois e que ninguem fica esperando o que nao volta.
 */
export function cenarioDePescadorDeUmCardume(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const l = lago(dados);
  s = comArmazemExtra(s, 'armazem-do-lago', l(21, 1).gx, l(21, 1).gy, dados); // (49,25)
  s = comProdutorOcupado(s, { tipo: 'fishermans', id: 'pesc1', unidade: 'pescador', ...l(17, 2) }, dados); // (45,26)
  const rua: TileDeGrid[] = [];
  for (let dx = 17; dx <= 23; dx++) rua.push(l(dx, 4)); // x 45..51, y=28
  s = comEstradas(s, rua);
  return exigirColheitaAoAlcance(exigirLigado(s, 'pesc1', dados), 'pesc1', 1, dados);
}

/**
 * F-T4a — a cabana no LAGO GRANDE: `p1` (91,37), com 70 tiles de cardume ao
 * alcance, dos quais a maior parte e INTERIOR de agua — tile que nenhuma
 * aproximacao andavel alcanca, hoje e sempre (agua nao vira andavel ao ser
 * pescada, ao contrario da arvore, que ao cair abre o anel seguinte).
 *
 * E o cenario que cobra a licao do BUG-C: o que importa nao e a media de tiles
 * ao alcance, e a FORMA. Uma cabana que escolhesse tile de interior mandaria o
 * pescador andar ate um lugar que nao existe caminho para alcancar.
 */
export function cenarioDePescadorNoLagoGrande(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const g = lagamar(dados);
  s = comArmazemExtra(s, 'armazem-do-lagamar', g(14, -4).gx, g(14, -4).gy, dados); // (95,36)
  s = comProdutorOcupado(s, { tipo: 'fishermans', id: 'pesc1', unidade: 'pescador', ...g(10, -3) }, dados); // (91,37)
  const rua: TileDeGrid[] = [];
  for (let dx = 10; dx <= 16; dx++) rua.push(g(dx, -1)); // x 91..97, y=39
  s = comEstradas(s, rua);
  return exigirColheitaAoAlcance(exigirLigado(s, 'pesc1', dados), 'pesc1', 70, dados);
}

/** Serraria `s1` (a leste do armazem) ocupada por `u2`, ligada, e com a entrada VAZIA. */
export function cenarioDeSerraria(dados: GameData = gameData): GameState {
  let s = semCivis(createInitialState(1, dados));
  const v = vila(dados);
  s = comProdutorOcupado(s, { tipo: 'sawmill', id: 's1', unidade: 'u2', ...v(3, 4) }, dados); // (32,34)
  s = comEstradas(s, [v(2, 3), v(2, 4), v(2, 5), v(2, 6), v(3, 6)]); // x=31 y 33..36, e (32,36)
  return exigirLigado(s, 's1', dados);
}

// --- avancar o relogio ---

export function avancar(estado: GameState, ticks: number, dados: GameData = gameData): GameState {
  let s = estado;
  for (let i = 0; i < ticks; i++) s = step(s, [], dados);
  return s;
}

/** Os eventos do tick `ticks` (1-based), e so dele: `state.events` carrega o
 *  tick corrente, entao basta avancar ate la. */
export function eventosNoTick(estado: GameState, ticks: number, dados: GameData = gameData): readonly GameEvent[] {
  return avancar(estado, ticks, dados).events;
}

// --- leitura ---

function completoDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  return p;
}

export const saidaDe = (estado: GameState, id: string): Readonly<Record<string, number>> =>
  completoDe(estado, id).estoque.saida;

export const entradaDe = (estado: GameState, id: string): Readonly<Record<string, number>> =>
  completoDe(estado, id).estoque.entrada;

function producaoDe(estado: GameState, id: string): Producao {
  const p = completoDe(estado, id).producao;
  if (p === null) throw new Error(`fixture: '${id}' nao tem producao`);
  return p;
}

export const progressoDe = (estado: GameState, id: string): number => producaoDe(estado, id).progresso;

/**
 * F-T2a: o que ANTES era `veioDe`. A pergunta continua sendo "quanto ainda ha
 * para este predio colher?", mas a resposta deixou de estar no predio: e a soma
 * do que sobrou nos tiles ao alcance dele. `null` para receita sem colheita
 * (serraria, lenhador), que e o que `veio: null` queria dizer.
 */
export function disponivelDe(estado: GameState, id: string, dados: GameData = gameData): number | null {
  const predio = completoDe(estado, id);
  const receita = receitaDoTipo(predio.tipo, dados);
  if (receita?.colheita == null) return null;
  return disponivelAoAlcance(estado, predio, receita.colheita, dados);
}

/**
 * O `fsm` desta unidade, ou `null` se ela nao esta mais no estado. Irmao FROUXO de
 * `fsmDe`, e existe por um motivo estreito: desde a F20b a unidade MORRE, e o
 * cenario a que falta um elo da cadeia nao produz comida nenhuma — quem ele
 * observa morre antes do fim da janela. Quem quer afirmar o estado de uma unidade
 * viva continua usando `fsmDe`, que lanca.
 */
export function fsmSeVivo(estado: GameState, unidadeId: string): string | null {
  return estado.unidades.porId[unidadeId]?.fsm ?? null;
}

/**
 * F20b — o acumulado que CHEGOU a um armazem, por mercadoria, contado por evento
 * `task-completed` ao longo de `ticks`.
 *
 * Por que nao o saldo das gavetas: desde que a vila COME, a comida entregue sai da
 * gaveta outra vez, e saldo passa a medir o que SOBROU, nao o que a cadeia
 * produziu — e o teto da fonte e sobre producao. O destino e filtrado por ARMAZEM
 * porque a mesma mercadoria viaja duas vezes (padaria -> armazem, armazem ->
 * Bodega, nivel 1 da F20a), e o segundo salto contaria o mesmo pao de novo.
 */
export function entregasNoArmazem(
  estado: GameState, ticks: number, mercadorias: readonly string[], dados: GameData = gameData,
): { readonly fim: GameState; readonly entregues: Readonly<Record<string, number>> } {
  const entregues: Record<string, number> = Object.fromEntries(mercadorias.map((m) => [m, 0]));
  let s = estado;
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], dados);
    for (const ev of s.events) {
      if (ev.type !== 'task-completed') continue;
      if (entregues[ev.mercadoria] === undefined) continue;
      if (s.predios.porId[ev.destino]?.tipo !== ID_DO_ARMAZEM) continue;
      entregues[ev.mercadoria] = (entregues[ev.mercadoria] ?? 0) + 1;
    }
  }
  return { fim: s, entregues };
}

export function fsmDe(estado: GameState, unidadeId: string): string {
  const u = estado.unidades.porId[unidadeId];
  if (u === undefined) throw new Error(`fixture: unidade '${unidadeId}' nao existe`);
  return u.fsm;
}

// --- variacoes ---

function comPredio(estado: GameState, predio: PredioCompleto): GameState {
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [predio.id]: predio } } };
}

/** Tira a unidade do estado (o especialista morreu, ou nunca houve um). */
export function semAUnidade(estado: GameState, id: string): GameState {
  const porId = { ...estado.unidades.porId };
  delete porId[id];
  return { ...estado, unidades: { porId, ordem: estado.unidades.ordem.filter((x) => x !== id) } };
}

/** Tira o ocupante do predio (a unidade continua no mapa, sem predio). */
export function semOcupante(estado: GameState, id: string): GameState {
  return comPredio(estado, { ...completoDe(estado, id), ocupante: null });
}

/** Apaga a rede inteira: nenhum predio escoa. */
export function semEstrada(estado: GameState): GameState {
  return { ...estado, estradas: {} };
}

export function comEntrada(estado: GameState, id: string, entrada: Record<string, number>): GameState {
  const p = completoDe(estado, id);
  return comPredio(estado, { ...p, estoque: { ...p.estoque, entrada: { ...p.estoque.entrada, ...entrada } } });
}

export function comSaida(estado: GameState, id: string, saida: Record<string, number>): GameState {
  const p = completoDe(estado, id);
  return comPredio(estado, { ...p, estoque: { ...p.estoque, saida } });
}

/** Esvazia a gaveta de saida — o serf da F15b passando por aqui, em uma linha. */
export function comEspacoNaSaida(estado: GameState, id: string): GameState {
  return comSaida(estado, id, {});
}

/**
 * F-T2a: o que ANTES era `comRendimento(dados, 'quarry', n)`. O total deixou de
 * ser um numero do predio, entao encurtar a jazida e encurtar o MAPA: os tiles
 * de `recurso` passam a ser exatamente `tiles`, cada um valendo
 * `rendimentoPorTile`. O caminho continua sendo o dado de verdade com outro
 * numero — nao se fabrica recurso por fixture nem se mexe em `data/` para um
 * teste passar.
 *
 * Um tile de dois vale dois, e e assim que os cenarios de esgotamento da F15a e
 * da F22 continuam medindo o que mediam: `comJazida(gameData, 'rock',
 * [[25, 32]], 2)` da a mesma pedreira de duas pedras que `comRendimento(…, 2)`
 * dava — (25,32) e vizinho do footprint de `q1` em (26,34). Desde a F18c-1a o
 * tile sai de `rochaDaPedreiraDaVila`, e nao do numero.
 */
export function comJazida(
  dados: GameData, recurso: string, tiles: readonly (readonly [number, number])[], rendimentoPorTile: number,
): GameData {
  const tipo = dados.recursos.tipos[recurso];
  if (tipo === undefined) throw new Error(`fixture: recurso '${recurso}' nao existe em resources.json`);
  return {
    ...dados,
    recursos: {
      ...dados.recursos,
      tipos: { ...dados.recursos.tipos, [recurso]: { ...tipo, rendimentoPorTile } },
    },
    mapa: { ...dados.mapa, recursos: { ...dados.mapa.recursos, [recurso]: tiles } },
  };
}

/**
 * O MESMO mapa — a geografia de verdade, tile por tile —, so que cada tile
 * valendo `rendimentoPorTile`. E o que permite rodar ate o esgotamento dentro de
 * um teste: com 1 por tile, o total de uma pedreira E a contagem de tiles ao
 * alcance dela, e 13 ciclos cabem onde 195 nao caberiam.
 */
export function comRendimentoPorTile(dados: GameData, recurso: string, rendimentoPorTile: number): GameData {
  const tipo = dados.recursos.tipos[recurso];
  if (tipo === undefined) throw new Error(`fixture: recurso '${recurso}' nao existe em resources.json`);
  return {
    ...dados,
    recursos: {
      ...dados.recursos,
      tipos: { ...dados.recursos.tipos, [recurso]: { ...tipo, rendimentoPorTile } },
    },
  };
}

/** A mesma jazida, em outro alcance: o que muda e QUANTOS tiles o predio ve. */
export function comAlcance(dados: GameData, tipo: string, alcance: number): GameData {
  const receita = dados.producao.receitas[tipo];
  if (receita?.colheita == null) throw new Error(`fixture: '${tipo}' nao colhe`);
  return {
    ...dados,
    producao: {
      ...dados.producao,
      receitas: {
        ...dados.producao.receitas,
        [tipo]: { ...receita, colheita: { ...receita.colheita, alcance } },
      },
    },
  };
}

/**
 * F18 — o mesmo dado com OUTRO custo de plantio. Existe porque o custo do milho
 * e `{}` no dado publicado (arar e semear milho nao gasta mercadoria nenhuma), e
 * o ramo que cobra so tem consumidor de verdade quando o Wineyard chegar: a
 * videira nasce com `timber: 1` por campo, numero que ficou guardado na nota do
 * `wineyard` em `production.json`.
 *
 * Sem isto, a regra de cobrar entraria no jogo sem nenhum teste a exercitar, que
 * e a mesma falha do dado sem leitor.
 */
export function comCustoDePlantio(
  dados: GameData, recurso: string, custo: Readonly<Record<string, number>>,
): GameData {
  const tipo = dados.recursos.tipos[recurso];
  if (tipo?.reposicao == null) throw new Error(`fixture: '${recurso}' nao tem reposicao`);
  return {
    ...dados,
    recursos: {
      ...dados.recursos,
      tipos: {
        ...dados.recursos.tipos,
        [recurso]: { ...tipo, reposicao: { ...tipo.reposicao, custo } },
      },
    },
  };
}

/**
 * F21 — o id do armazem que `createInitialState` criou (`p1`, nao `storehouse`:
 * `ID_DO_ARMAZEM` e o TIPO). A fixture confere a si mesma — se a aldeia inicial
 * um dia nascer sem armazem, isto falha aqui com o motivo escrito.
 */
function armazemDaAldeia(estado: GameState): string {
  for (const id of estado.predios.ordem) {
    if (estado.predios.porId[id]?.tipo === ID_DO_ARMAZEM) return id;
  }
  throw new Error('fixture: a aldeia inicial nao tem armazem');
}

/**
 * F21 — A CADEIA DO OURO, longe da aldeia e ligada por uma rua so.
 *
 * `gold_mine` e `coal_mine` colhem o VEIO do tile (F21b), a `metallurgists` come
 * 1 minerio + 1 carvao e devolve 2 ouros, e a `schoolhouse` do fim da rua e quem
 * gasta. A porta de quase todos cai em y=105, e uma linha de estrada liga a
 * cadeia inteira ao armazem `arm`; a mina de carvao fica tres linhas ao sul,
 * encostada no veio dela, ligada por um cano que desce por x=93.
 *
 * F21b — a cadeia MUDOU DE LUGAR: ela morava em x=50..72, y=58..63, onde nunca
 * vai haver minerio. Com as tres minas colhendo do tile, aquele cenario passou a
 * ser uma mina produzindo do nada com outro nome. Semear minerio na grama ao lado
 * dela seria andaime: estado que partida nenhuma alcanca, so para o aceite
 * passar. Entao a cadeia desceu para a encosta OESTE da serra (x=78..96,
 * y=102..108), onde ha veio de verdade: 7 tiles de carvao ao alcance de `co1` e
 * os 6 tiles do veio de ouro ao alcance de `go1`, medidos no mapa emitido. O
 * resto da area e grama, sem recurso e sem terreno intransponivel, e a porta de
 * cada predio cai em tile de estrada.
 *
 * As duas minas ficam onde ficam por causa de `sim/aproximacao.ts`: um tile so e
 * colhivel se alguem consegue encostar nele, e o que a serra oferece disso e a
 * SAIA de rocha, nao o miolo de montanha. Por isso as duas encaram a encosta em
 * vez de subirem nela.
 *
 * Duas consequencias de fixture que importam:
 *   - o OURO INICIAL do armazem da aldeia vai a ZERO. Sem isso o teste nao sabe
 *     dizer se a escola pagou com ouro minerado ou com os 20 da abertura.
 *   - a Bodega entra abastecida, como nas cadeias do pao e da carne: sem ela a
 *     vila morre de fome antes da janela de medicao acabar (`cenarioOraculo` tem
 *     o aviso e o numero).
 */
export function cenarioDaCadeiaDoOuro(
  dados: GameData = gameData, serfs: number = 6,
): GameState {
  let s = semCivis(createInitialState(1, dados));
  const aldeia = armazemDaAldeia(s);
  // o ouro da abertura mora em `saida` (F05a: e de la que o serf retira), e so o
  // OURO vai a zero: tirar pao e carne junto mataria a vila de fome.
  s = comSaida(s, aldeia, { ...completoDe(s, aldeia).estoque.saida, gold: 0 });
  const m = serra(dados);
  s = comArmazemExtra(s, 'arm', m(-10, 18).gx, m(-10, 18).gy, dados); // (78,102)
  s = comProdutorOcupado(s, { tipo: 'metallurgists', id: 'me1', unidade: 'metalurgico', ...m(-2, 18) }, dados); // (86,102)
  s = comPredioSemTrabalhador(s, 'schoolhouse', 'esc1', m(2, 18).gx, m(2, 18).gy, dados); // (90,102)
  s = comProdutorOcupado(s, { tipo: 'gold_mine', id: 'go1', unidade: 'mineiro-ouro', ...m(5, 20) }, dados); // (93,104)
  s = comProdutorOcupado(s, { tipo: 'coal_mine', id: 'co1', unidade: 'mineiro-carvao', ...m(6, 22) }, dados); // (94,106)
  // A rua principal em y=105 pega a porta de todos, menos a da mina de carvao:
  // ela esta em y=108, encostada no veio, e o cano desce por x=93 - ao lado do
  // footprint dela, nunca por baixo.
  const rua: TileDeGrid[] = [];
  for (let dx = -10; dx <= 8; dx += 1) rua.push(m(dx, 21)); // x 78..96, y=105
  for (const t of [m(5, 22), m(5, 23), m(5, 24), m(6, 24)]) rua.push(t); // x=93 y 106..108, e (94,108)
  s = comEstradas(s, rua);
  for (const id of ['arm', 'go1', 'co1', 'me1', 'esc1']) s = exigirLigado(s, id, dados);
  s = comBodegaAbastecida(s, 'bodega', 'arm', dados);
  return comHistoricoDosPredios(comSerfs(s, serfs, m(-10, 21).gx, m(-10, 21).gy)); // (78,105)
}

/**
 * F-VIVO-d2 — A ALDEIA DE VITRINE: os cinco casos do predio vivo num quadro so a 0,75.
 *
 * Decisao do operador (2026-09-28): *"use dois quadros, ou monte cenario de fixture
 * com os casos juntos"*. No mapa real os cinco nao cabem num quadro (campo arado no
 * norte, veio na serra, lajedo na vila; docs/planos/2026-09-28-6-F-VIVO-d.md). A
 * serra tem, a 3..6 tiles da cadeia do ouro, um lajedo de rocha de verdade (x 80..87,
 * y 91..99 hoje). Entao a vitrine e a cadeia do ouro (luz nas minas, dentro na
 * metalurgia) MAIS tres predios no gramado em volta da rua y=105:
 *   - uma pedreira com rocha ao alcance (transforma) — recurso no lugar dele;
 *   - uma fazenda com milho na saida (guarda) — a pilha e semeada, o campo nao
 *     existe ali; a fazenda nao se liga a rua, e por isso a pilha fica;
 *   - uma Malhada com milho na entrada (criacao).
 * Nenhum recurso sai do lugar. A POSICAO nao e digitada: e a primeira que o mesmo
 * `canPlace` do jogador aceita, varrendo a caixa em ordem (y, depois x). A fazenda e
 * a Malhada nao sao alcancaveis assim por partida (sem campo, sem rua), e isso e o que
 * faz disto VITRINE: serve ao quadro do render, nunca a aceite de regra da sim.
 */
export function cenarioDaAldeiaDaSerra(dados: GameData = gameData): GameState {
  let s = cenarioDaCadeiaDoOuro(dados);
  const m = serra(dados);
  // as caixas de busca, relativas a ancora da serra: o gramado entre o lajedo e a rua
  // y=105 (pedreira e fazenda) e o gramado ao sul da rua, ao lado da mina de carvao
  // (Malhada). As duas ficam dentro de ~16x12 tiles com a mina e a metalurgia, que
  // cabem na vista de ~21x15 a 0,75.
  const norteDaRua = { dx0: -14, dx1: 4, dy0: 12, dy1: 17 }; // x 74..92, y 96..101 hoje
  const sulDaRua = { dx0: -8, dx1: 4, dy0: 22, dy1: 25 }; // x 80..92, y 106..109 hoje
  type Caixa = typeof norteDaRua;
  const colocar = (
    estado: GameState, tipo: string, id: string, unidade: string, caixa: Caixa,
    aceita: (candidato: GameState) => boolean,
  ): GameState => {
    // so para a BUSCA: destrava o tipo como se a arvore ja tivesse chegado nele
    const def = dados.predios.find((p) => p.id === tipo);
    const busca = def?.desbloqueadoPor ? registrarTipoConstruido(estado, def.desbloqueadoPor) : estado;
    for (let dy = caixa.dy0; dy <= caixa.dy1; dy += 1) {
      for (let dx = caixa.dx0; dx <= caixa.dx1; dx += 1) {
        const t = m(dx, dy);
        if (!canPlace(busca, tipo, t.gx, t.gy, dados).ok) continue;
        const candidato = comProdutorOcupado(estado, { tipo, id, unidade, gx: t.gx, gy: t.gy }, dados);
        if (aceita(candidato)) return candidato;
      }
    }
    throw new Error(`fixture: '${tipo}' nao coube na caixa da aldeia da serra`);
  };
  s = colocar(s, 'quarry', 'q2', 'pedreiro-serra', norteDaRua, (c) => (disponivelDe(c, 'q2', dados) ?? 0) > 0);
  s = colocar(s, 'farm', 'f2', 'roceiro-serra', norteDaRua, () => true);
  s = colocar(s, 'swine_farm', 'sf2', 'criador-serra', sulDaRua, () => true);
  s = comSaida(s, 'f2', { corn: 5 });
  s = comEntrada(s, 'sf2', { corn: 5 });
  return comHistoricoDosPredios(s);
}

/** Sem a mina de carvao: o metalurgico recebe minerio e nada mais. E o que impede
 *  o aceite de passar por uma metalurgia que fabrique ouro do nada. */
export function cenarioDoOuroSemCarvao(dados: GameData = gameData): GameState {
  return semPredioEOcupante(cenarioDaCadeiaDoOuro(dados), 'co1', 'mineiro-carvao');
}

/** Sem a mina de ouro: carvao sobrando e nenhum minerio. O outro lado do mesmo
 *  contra-exemplo — as duas entradas sao obrigatorias, nao uma. */
export function cenarioDoOuroSemMina(dados: GameData = gameData): GameState {
  return semPredioEOcupante(cenarioDaCadeiaDoOuro(dados), 'go1', 'mineiro-ouro');
}
