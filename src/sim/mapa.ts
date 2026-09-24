/**
 * F-T1 — A CAMADA DE TERRENO BASE, e a UNICA porta de leitura dela.
 *
 * O mapa vive em `GameData` (carregado e congelado com o resto do dado), nao no
 * `GameState`: ele nao muda durante a partida, e um `Record` denso de 128x128
 * levaria o save de 29 KB para ~0,35 MB so para guardar dado imutavel. O que
 * nao esta no estado nao pode divergir.
 *
 * O arquivo guarda o mapa CODIFICADO (um char por tile + legenda), que e a
 * forma que o git revisa. Aqui ele e decodificado UMA vez por mapa, para uma
 * grade de codigos (`Uint8Array`), e a tabela de custo e montada UMA vez por
 * `GameData`. Os dois caches sao `WeakMap` chaveados por referencia, como os do
 * A* — e a mesma tecnica de `pathfinding.ts`, pelo mesmo motivo: teste que monta
 * um `dados` proprio nao contamina o singleton nem paga a decodificacao de
 * novo.
 *
 * Ninguem mais le `dados.mapa.linhas`. Quem quer terreno chama `tipoDoTile`;
 * quem quer saber se da para pisar chama `ehTransponivel`; quem precisa do
 * custo tile a tile no laco quente (so o A*) usa `terrenoIndexado`.
 */
import type { GameData, MapaData, TerrenoDeMapa, TerrenoTipo } from './data/types';
import { gameData } from './data';
import { TERRENOS_DE_MAPA } from './data/terrenos';

/** A grade decodificada de UM mapa: um codigo (indice em `TERRENOS_DE_MAPA`)
 *  por tile, em row-major com a largura DO MAPA. */
interface GradeDoMapa {
  readonly codigos: Uint8Array;
  readonly largura: number;
  readonly altura: number;
}

/**
 * O que o A* precisa por tile, sem nenhuma indirecao de string no laco:
 * `codigos` e a grade do mapa; `reto`, `diagonal` e `transponivel` sao tabelas
 * por CODIGO (seis entradas), nao por tile — por isso trocar de `GameData`
 * custa quase nada e trocar de mapa custa uma passada.
 */
export interface TerrenoIndexado {
  readonly codigos: Uint8Array;
  readonly largura: number;
  readonly altura: number;
  /** Ticks do passo reto ao ENTRAR num tile deste codigo, a pe. */
  readonly reto: Float64Array;
  /** Ticks do passo diagonal, idem. */
  readonly diagonal: Float64Array;
  /** 1 = da para pisar; 0 = intransponivel (`terrain.json`). */
  readonly transponivel: Uint8Array;
}

/** O terreno de um tile que o arquivo de mapa nao cobre. Ver `tipoDoTile`. */
const TERRENO_PADRAO: TerrenoDeMapa = 'grama';
const CODIGO_PADRAO = TERRENOS_DE_MAPA.indexOf(TERRENO_PADRAO);

const gradePorMapa = new WeakMap<MapaData, GradeDoMapa>();
const indexadoPorDados = new WeakMap<GameData, TerrenoIndexado>();

function gradeDe(mapa: MapaData): GradeDoMapa {
  const existente = gradePorMapa.get(mapa);
  if (existente) return existente;

  const { largura, altura } = mapa;
  const codigos = new Uint8Array(largura * altura);
  // A legenda vira uma tabela char -> codigo antes do laco: o laco roda
  // largura*altura vezes e nao pode pagar `indexOf` por tile.
  const porChar = new Map<string, number>();
  for (const [ch, tipo] of Object.entries(mapa.legenda)) {
    porChar.set(ch, TERRENOS_DE_MAPA.indexOf(tipo));
  }
  for (let gy = 0; gy < altura; gy += 1) {
    const linha = mapa.linhas[gy] as string;
    const base = gy * largura;
    for (let gx = 0; gx < largura; gx += 1) {
      // O carregador ja reprovou char fora da legenda; aqui o `?? 0` so existe
      // porque o tipo diz que o Map pode nao ter a chave.
      codigos[base + gx] = porChar.get(linha[gx] as string) ?? 0;
    }
  }
  const grade: GradeDoMapa = { codigos, largura, altura };
  gradePorMapa.set(mapa, grade);
  return grade;
}

/**
 * O terreno de um tile do mundo, ou `null` se aquilo nem e um tile (coordenada
 * negativa ou nao inteira). A porta unica de leitura.
 *
 * O QUE ACONTECE ALEM DA GRADE DO ARQUIVO: o tile vale `TERRENO_PADRAO`. No
 * jogo isso nao ocorre — o carregador reprova mapa que discorde de
 * `terrain.mapaPadrao`, entao o arquivo cobre o mundo inteiro. O caso existe
 * para dado SINTETICO de teste, que redeclara o tamanho do mundo sem trocar o
 * mapa (F18b prova que nada presume 128; F17c mede em 64, 128 e 256). A borda
 * do MUNDO nao e assunto desta funcao: quem a checa e quem tem o candidato
 * (`canPlace` por `fora-do-mapa`, o A* pelo seu proprio limite).
 */
export function tipoDoTile(gx: number, gy: number, dados: GameData = gameData): TerrenoDeMapa | null {
  if (!(Number.isInteger(gx) && Number.isInteger(gy)) || gx < 0 || gy < 0) return null;
  const { codigos, largura, altura } = gradeDe(dados.mapa);
  if (gx >= largura || gy >= altura) return TERRENO_PADRAO;
  return TERRENOS_DE_MAPA[codigos[gy * largura + gx] as number] as TerrenoDeMapa;
}

/** O codigo de terreno de um tile na forma indexada, com a mesma regra de
 *  `tipoDoTile` alem da grade. Usado no laco quente do A*, onde `gx`/`gy` ja
 *  vieram validados e nao negativos. */
export function codigoDoTile(indexado: TerrenoIndexado, gx: number, gy: number): number {
  if (gx >= indexado.largura || gy >= indexado.altura) return CODIGO_PADRAO;
  return indexado.codigos[gy * indexado.largura + gx] as number;
}

/**
 * Da para pisar (ou construir) neste tile? Fora do mapa, nao — e a mesma
 * resposta que o A* e o `canPlace` ja davam por `fora-do-mapa`, so que agora
 * por um predicado so.
 *
 * Quem responde e `terrain.intransponivel`, o campo que ate a F-T1 chegava em
 * `GameData` sem nenhum leitor.
 */
export function ehTransponivel(gx: number, gy: number, dados: GameData = gameData): boolean {
  const tipo = tipoDoTile(gx, gy, dados);
  if (tipo === null) return false;
  return !dados.terreno.intransponivel.includes(tipo);
}

/** O custo do terreno de um tile em ticks, a pe — `null` se nao da para pisar.
 *  `estrada` nao sai daqui: ela e estado, e quem a soma e quem le
 *  `state.estradas`. */
export function custoDoTerreno(
  gx: number, gy: number, diagonal: boolean, dados: GameData = gameData,
): number | null {
  const indexado = terrenoIndexado(dados);
  const tipo = tipoDoTile(gx, gy, dados);
  if (tipo === null) return null;
  const codigo = TERRENOS_DE_MAPA.indexOf(tipo);
  if (codigo < 0) return null;
  if (indexado.transponivel[codigo] === 0) return null;
  return (diagonal ? indexado.diagonal[codigo] : indexado.reto[codigo]) as number;
}

/**
 * A forma indexada, para o laco quente do A*. Publica de proposito — o A* e o
 * unico chamador, e o unico com motivo para nao pagar uma string por vizinho.
 */
export function terrenoIndexado(dados: GameData = gameData): TerrenoIndexado {
  const existente = indexadoPorDados.get(dados);
  if (existente) return existente;

  const grade = gradeDe(dados.mapa);
  const n = TERRENOS_DE_MAPA.length;
  const reto = new Float64Array(n);
  const diagonal = new Float64Array(n);
  const transponivel = new Uint8Array(n);
  const intransponivel = new Set<string>(dados.terreno.intransponivel);
  for (let codigo = 0; codigo < n; codigo += 1) {
    const tipo = TERRENOS_DE_MAPA[codigo] as TerrenoDeMapa;
    if (intransponivel.has(tipo)) continue;
    // So terreno transponivel tem custo, e todo transponivel do mapa e uma
    // chave de `custoDeMovimento` — o carregador ja garantiu isso.
    const comCusto = tipo as Extract<TerrenoDeMapa, TerrenoTipo>;
    transponivel[codigo] = 1;
    reto[codigo] = dados.movimento.ticksPorTile.aPe[comCusto];
    diagonal[codigo] = dados.movimento.ticksPorTileDiagonal.aPe[comCusto];
  }
  const indexado: TerrenoIndexado = {
    codigos: grade.codigos, largura: grade.largura, altura: grade.altura,
    reto, diagonal, transponivel,
  };
  indexadoPorDados.set(dados, indexado);
  return indexado;
}
