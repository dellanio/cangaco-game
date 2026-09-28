/**
 * Segundo funil de `render/` para `gameData` (o primeiro e `mapa.ts`). A cena
 * precisa do footprint e do nome que o jogador le por tipo de predio; nenhum
 * outro arquivo de `render/` importa `../sim/data` — teste estrutural em
 * `tests/F04-grid-ortogonal.test.ts`.
 */
import { gameData } from '../sim/data';
import type { GameData } from '../sim/data/types';
import { alvoDeNivelamento, custoDoPredio } from '../sim/obra';
import type { CaixaEmTiles } from '../sim/footprint';
import { caixaDeTipo } from '../sim/footprint';
import temaSertao from '../../data/theme-sertao.json';
import { ID_DA_BODEGA, ID_DO_ARMAZEM } from '../sim/state';
import { ehEntradaDePredio } from './manifesto';
import type { AncorasDoPredio, Manifesto } from './manifesto';
import { ANIMAL_DA_CRIACAO, CASO_DO_PREDIO } from './manifesto-camadas';
import type { ContextoDasCamadas } from './manifesto-camadas';
import type { DadosDosAnimais } from './animais';
import type { DadosDasPilhas } from './pilhas';
import type { DadosDoTrabalho } from './trabalho';

export interface AparenciaDoPredio {
  readonly largura: number; // em tiles
  readonly altura: number; // em tiles
  readonly nome: string; // o que o jogador le, vindo do tema
  readonly hpTotal: number; // F11c: os tres estagios da obra (estagio-obra.ts) precisam do teto
  /** F17b: o custo em material, do dado. O medidor da obra desenha
   *  `custo - faltam`; sem isto a cena nao tem o denominador. */
  readonly custo: Readonly<Record<string, number>>;
  /** F17d: `area do footprint x ticksNivelamentoPorTile`, do dado. O canteiro
   *  desenha `nivelamento / (alvo / tiles)`; sem isto a cena nao tem o
   *  denominador. Vale 0 no placeholder de tipo desconhecido. */
  readonly alvoDeNivelamento: number;
}

/** F17b: a ordem canonica das mercadorias, reexportada do funil para quem em
 *  `render/` nao pode importar `sim/data` (teste estrutural em
 *  `tests/F04-grid-ortogonal.test.ts`). Nao e copia: e a mesma lista. */
export const ordemDasMercadorias: readonly string[] = gameData.economia.mercadorias;

/**
 * F-TP: o retangulo em tiles de um TIPO posto em (gx, gy). Mesma razao de
 * `ordemDasMercadorias` — quem em `render/` nao pode importar `sim/data` pega o
 * dado pelo funil, e footprint por tipo de predio e exatamente o que este funil
 * existe para servir. Nao e copia da conta: chama `sim/footprint`, que e a mesma
 * funcao que `canPlace` e a colheita usam.
 *
 * `dados` explicito para o teste poder injetar uma variante; `undefined` cai no
 * `gameData` congelado, como em `sim/`.
 */
export function caixaDeTipoNoMapa(
  tipo: string, gx: number, gy: number, dados: GameData = gameData,
): CaixaEmTiles | null {
  return caixaDeTipo(tipo, gx, gy, dados);
}

type TemaDePredios = Readonly<Record<string, { readonly nome: string } | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;

function construirAparencias(): Readonly<Record<string, AparenciaDoPredio>> {
  const porTipo: Record<string, AparenciaDoPredio> = {};
  for (const p of gameData.predios) {
    const [largura, altura] = p.tamanho;
    if (largura === undefined || altura === undefined) continue;
    porTipo[p.id] = {
      largura, altura, nome: temaDePredios[p.id]?.nome ?? p.id, hpTotal: p.hp,
      custo: custoDoPredio(p),
      alvoDeNivelamento: alvoDeNivelamento(p.id),
    };
  }
  return porTipo;
}

const aparencias = construirAparencias();

/**
 * F-VIVO — o dado de que as regras do predio vivo precisam (`manifesto-camadas.ts`),
 * montado aqui, uma vez. E o MESMO objeto que o teste do manifesto valida e que a
 * cena desenha: duas montagens seriam duas listas, e e da segunda que a primeira
 * diverge.
 */
export const contextoDasCamadas: ContextoDasCamadas = {
  mercadorias: gameData.economia.mercadorias,
  receitas: Object.fromEntries(Object.entries(gameData.producao.receitas).flatMap(([id, r]) => (r === undefined ? [] : [[id, {
    entra: Object.keys(r.entra), sai: Object.keys(r.sai),
    colheita: r.colheita === null ? null : { aDistancia: r.colheita.aDistancia },
  }]]))),
  materiaisDaObra: Object.fromEntries(gameData.predios.map((p) => [
    p.id, Object.entries(custoDoPredio(p)).filter(([, q]) => q > 0).map(([m]) => m),
  ])),
  idDoArmazem: ID_DO_ARMAZEM,
  idDaBodega: ID_DA_BODEGA,
  comidas: gameData.economia.grupos.comida,
};

/** F-VIVO-a — o dado das pilhas; as ancoras vem do manifesto, por parametro. */
export function dadosDasPilhas(manifesto: Manifesto): DadosDasPilhas {
  const ancoras: Record<string, AncorasDoPredio | undefined> = {};
  for (const e of manifesto.assets) if (ehEntradaDePredio(e)) ancoras[e.id] = e.ancoras;
  return {
    contexto: contextoDasCamadas,
    custos: Object.fromEntries(Object.entries(aparencias).map(([id, a]) => [id, a.custo])),
    hpPorMaterialEntregue: gameData.construcao.hpPorMaterialEntregue,
    ancoras,
  };
}

/** F-VIVO-b — o dado do quadro de trabalho: a tabela de casos, o `ticksDoCiclo` de
 *  cada receita (ja convertido pelo carregador: o render nao inventa duracao) e as
 *  ancoras do manifesto, por parametro. */
export function dadosDoTrabalho(manifesto: Manifesto): DadosDoTrabalho {
  const ancoras: Record<string, AncorasDoPredio | undefined> = {};
  for (const e of manifesto.assets) if (ehEntradaDePredio(e)) ancoras[e.id] = e.ancoras;
  return {
    casos: CASO_DO_PREDIO,
    ticksDoCiclo: Object.fromEntries(Object.entries(gameData.producao.receitas)
      .flatMap(([id, r]) => (r === undefined ? [] : [[id, r.ticksDoCiclo]]))),
    ancoras,
  };
}

/** F-VIVO-c — o dado do curral: o animal de cada criacao, o mesmo `ticksDoCiclo` do
 *  trabalho (a idade anda com o ciclo da receita) e as ancoras do manifesto. */
export function dadosDosAnimais(manifesto: Manifesto): DadosDosAnimais {
  const { ticksDoCiclo, ancoras } = dadosDoTrabalho(manifesto);
  return { animais: ANIMAL_DA_CRIACAO, ticksDoCiclo, ancoras };
}

/** F-VIVO-a — a cor do placeholder da pilha, por mercadoria, do tema. Mercadoria
 *  sem cor reprova AQUI, no carregamento, como o terreno do `mapa.ts`: tela que
 *  mente por omissao e pior do que tela feia. */
const coresDasPilhas: Readonly<Record<string, string>> = (() => {
  const tema = temaSertao.pilhas as Readonly<Record<string, string | undefined>>;
  const cores: Record<string, string> = {};
  for (const m of gameData.economia.mercadorias) {
    const cor = tema[m];
    if (cor === undefined) throw new Error(`predios.ts: mercadoria '${m}' sem cor em theme-sertao.json pilhas`);
    cores[m] = cor;
  }
  return cores;
})();

export function corDaPilha(mercadoria: string): string {
  return coresDasPilhas[mercadoria] ?? '#ff00ff';
}

/** Tipo sem entrada no dado ou no tema cai no id neutro, footprint 1x1:
 *  placeholder e comportamento normal (CLAUDE.md §9), o jogo nao quebra por
 *  falta de arte ou de nome. */
export function aparenciaDoPredio(tipo: string): AparenciaDoPredio {
  return aparencias[tipo]
    ?? { largura: 1, altura: 1, nome: tipo, hpTotal: 0, custo: {}, alvoDeNivelamento: 0 };
}
