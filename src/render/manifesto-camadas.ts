/**
 * F-VIVO-0 — as regras do manifesto para o predio vivo (docs/BRIEF-ARTE.md §4a):
 * os tres tipos de camada (`trabalho`, `pilha`, `animal`) e o campo `ancoras` da
 * entrada de predio.
 *
 * Aritmetica pura, so `import type`, como `manifesto.ts`: o dado do jogo chega por
 * parametro (`ContextoDasCamadas`), montado por quem tem acesso a `sim/data`. Quem
 * chama hoje e `tests/F17f-manifesto.test.ts`; o render da F-VIVO-a..c le as mesmas
 * tabelas daqui, para que o validado e o desenhado nao divirjam.
 *
 * Cada funcao devolve a LISTA de violacoes, com o id na frente, e nao um boolean:
 * a reprovacao diz onde olhar, e o teste prova que cada regra acusa.
 */
import type { AncorasDoPredio, EntradaDeAsset, EntradaDeCamada, PontoFracionario } from './manifesto';

/**
 * Os cinco casos do §4a. Classificacao de DESENHO, decidida pelo operador em
 * 2026-09-26, e nao derivavel inteira do dado: o dado distingue quem colhe
 * (`colheita`) e quem colhe de dentro (`aDistancia`), mas nao "so guarda" de
 * "transforma". `violacoesDosCasos` confere a tabela contra o dado no que o dado sabe.
 */
export type CasoDoPredioVivo = 'guarda' | 'transforma' | 'dentro' | 'luz' | 'criacao';

export const CASO_DO_PREDIO: Readonly<Record<string, CasoDoPredioVivo>> = {
  farm: 'guarda', woodcutters: 'guarda', fishermans: 'guarda',
  quarry: 'transforma', wineyard: 'transforma',
  sawmill: 'dentro', mill: 'dentro', bakery: 'dentro', butchers: 'dentro', tannery: 'dentro',
  metallurgists: 'dentro', iron_smithy: 'dentro', weapons_workshop: 'dentro',
  armory_workshop: 'dentro', weapon_smithy: 'dentro', armor_smithy: 'dentro',
  gold_mine: 'luz', coal_mine: 'luz', iron_mine: 'luz',
  swine_farm: 'criacao', stables: 'criacao',
};

/** Os lacos de cada caso e quantos quadros cada um tem (§4a "Os quadros"). */
export const LACOS_DO_CASO: Readonly<Record<CasoDoPredioVivo, Readonly<Record<string, number>>>> = {
  guarda: {},
  transforma: { inicio: 8, meio: 8, fim: 8 },
  dentro: { laco1: 8, laco2: 8 },
  luz: { luz: 4 },
  criacao: { laco1: 8, laco2: 8 },
};

/** A fumaca e generica: uma entrada `trabalho` com este id, um laco de 8. */
export const ID_DA_FUMACA = 'fumaca';
export const LACOS_DA_FUMACA: Readonly<Record<string, number>> = { fumaca: 8 };

/** F-VIVO-e — o ocioso tambem e generico: casa com gente dentro e sem trabalho. Um
 *  laco de 8 para todos os predios, no molde da fumaca (decisao A1/A2 do operador). */
export const ID_DO_OCIOSO = 'ocioso';
export const LACOS_DO_OCIOSO: Readonly<Record<string, number>> = { ocioso: 8 };

/** F-VIVO-h — a escola nao tem receita e anima mesmo assim, enquanto treina (A5/C1 do
 *  KaM). Excecao NOMEADA: o validador aceita `trabalho` sem receita so para este id. */
export const ID_DA_ESCOLA = 'schoolhouse';
export const LACO_DA_ESCOLA = 'treino';
export const LACOS_DA_ESCOLA: Readonly<Record<string, number>> = { [LACO_DA_ESCOLA]: 8 };

/** O animal de cada criacao: o id da entrada `animal` e a mercadoria que ele vira. */
export const ANIMAL_DA_CRIACAO: Readonly<Record<string, string>> = { swine_farm: 'pigs', stables: 'horses' };

/** Tres idades, quatro quadros de um laco parado (§4a, `animal`). */
export const LACOS_DO_ANIMAL: Readonly<Record<string, number>> = { idade1: 4, idade2: 4, idade3: 4 };

/** A pilha tem UM estado: uma unidade da mercadoria. O render empilha ate 5. */
export const ESTADO_DA_PILHA = 'unidade';

/** O armazem mostra as quatro mercadorias mais abundantes (operador, 2026-09-26). */
export const PONTOS_DO_ARMAZEM = 4;

/** Quantos animais o curral mostra. */
export const ANIMAIS_NO_CURRAL = 5;

/** O dado do jogo de que as regras precisam. Montado por quem pode ler `sim/data`. */
export interface ContextoDasCamadas {
  readonly mercadorias: readonly string[];
  /** Por predio com receita: as mercadorias de `entra` e de `sai`, na ordem do
   *  dado, e a colheita (ou `null`). */
  readonly receitas: Readonly<Record<string, {
    readonly entra: readonly string[];
    readonly sai: readonly string[];
    readonly colheita: { readonly aDistancia: boolean } | null;
  }>>;
  /** Os materiais de obra de cada predio (os de custo > 0). */
  readonly materiaisDaObra: Readonly<Record<string, readonly string[]>>;
  readonly idDoArmazem: string;
  readonly idDaBodega: string;
  /** As comidas que a Bodega guarda (`economia.grupos.comida`). */
  readonly comidas: readonly string[];
}

/**
 * As chaves de estado de um conjunto de lacos: `<laco>_<n>`, n de 1 ao total.
 * Um laco PARCIAL e defeito (a animacao pularia), entao a regra e por laco
 * inteiro: cada laco declarado tem todos os quadros, e nenhuma chave fica de fora.
 */
function violacoesDosLacos(
  rotulo: string, estados: Readonly<Record<string, string>>, lacos: Readonly<Record<string, number>>,
): string[] {
  const erros: string[] = [];
  const presentes = new Map<string, Set<number>>();
  for (const chave of Object.keys(estados)) {
    const m = /^(.+)_(\d+)$/.exec(chave);
    const laco = m?.[1];
    const total = laco === undefined ? undefined : lacos[laco];
    const n = Number(m?.[2]);
    if (laco === undefined || total === undefined || n < 1 || n > total) {
      erros.push(`${rotulo}: estado '${chave}' nao e quadro de nenhum laco (${Object.keys(lacos).join(', ') || 'nenhum'})`);
      continue;
    }
    const ja = presentes.get(laco) ?? new Set<number>();
    ja.add(n);
    presentes.set(laco, ja);
  }
  for (const [laco, quadros] of presentes) {
    const total = lacos[laco] ?? 0;
    if (quadros.size !== total) erros.push(`${rotulo}: laco '${laco}' tem ${quadros.size} de ${total} quadros`);
  }
  return erros;
}

/** As regras dos tres tipos novos. Entrada de outro tipo devolve `[]`. */
export function violacoesDaCamadaViva(e: EntradaDeCamada, ctx: ContextoDasCamadas): string[] {
  const rotulo = `${e.tipo} '${e.id}'`;
  if (e.tipo === 'pilha') {
    const erros: string[] = [];
    if (!ctx.mercadorias.includes(e.id)) erros.push(`${rotulo}: nao e mercadoria de economy.json`);
    const chaves = Object.keys(e.estados);
    if (chaves.length !== 1 || chaves[0] !== ESTADO_DA_PILHA) {
      erros.push(`${rotulo}: o unico estado e '${ESTADO_DA_PILHA}', achou ${JSON.stringify(chaves)}`);
    }
    return erros;
  }
  if (e.tipo === 'animal') {
    if (!Object.values(ANIMAL_DA_CRIACAO).includes(e.id)) {
      return [`${rotulo}: nao e o animal de nenhuma criacao (${Object.values(ANIMAL_DA_CRIACAO).join(', ')})`];
    }
    return violacoesDosLacos(rotulo, e.estados, LACOS_DO_ANIMAL);
  }
  if (e.tipo === 'trabalho') {
    if (e.id === ID_DA_FUMACA) return violacoesDosLacos(rotulo, e.estados, LACOS_DA_FUMACA);
    if (e.id === ID_DO_OCIOSO) return violacoesDosLacos(rotulo, e.estados, LACOS_DO_OCIOSO);
    if (e.id === ID_DA_ESCOLA) return violacoesDosLacos(rotulo, e.estados, LACOS_DA_ESCOLA);
    const caso = CASO_DO_PREDIO[e.id];
    if (caso === undefined) return [`${rotulo}: nao e predio com receita nem '${ID_DA_FUMACA}', '${ID_DO_OCIOSO}' ou '${ID_DA_ESCOLA}'`];
    if (caso === 'guarda') return [`${rotulo}: caso 1 (so guarda) nao tem animacao dentro`];
    return violacoesDosLacos(rotulo, e.estados, LACOS_DO_CASO[caso]);
  }
  return [];
}

/**
 * F-VIVO-e — cada camada uma entrada so por tipo e id. O laco generico (fumaca, ocioso)
 * tem UM tamanho: a cena o desenha na `area` de qualquer predio, e duas entradas com o
 * mesmo id dariam dois tamanhos, com a primeira achada vencendo em silencio.
 */
export function violacoesDasCamadasRepetidas(camadas: readonly EntradaDeCamada[]): string[] {
  const vistas = new Set<string>();
  const erros: string[] = [];
  for (const e of camadas) {
    const chave = `${e.tipo} '${e.id}'`;
    if (vistas.has(chave)) erros.push(`${chave}: entrada repetida no manifesto`);
    vistas.add(chave);
  }
  return erros;
}

/**
 * A tabela de casos contra o dado, no que o dado sabe: todo predio com receita tem
 * caso e todo caso e de predio com receita; `luz` se e so se colhe `aDistancia`;
 * `guarda`/`transforma` colhem andando; `dentro`/`criacao` nao colhem; a criacao
 * tem o seu animal entre as saidas.
 */
export function violacoesDosCasos(ctx: ContextoDasCamadas): string[] {
  const erros: string[] = [];
  const comReceita = Object.keys(ctx.receitas);
  for (const id of comReceita) if (CASO_DO_PREDIO[id] === undefined) erros.push(`'${id}' tem receita e nao tem caso`);
  for (const [id, caso] of Object.entries(CASO_DO_PREDIO)) {
    const r = ctx.receitas[id];
    if (r === undefined) { erros.push(`'${id}' tem caso e nao tem receita`); continue; }
    const colheAndando = r.colheita !== null && !r.colheita.aDistancia;
    if ((caso === 'luz') !== (r.colheita?.aDistancia === true)) erros.push(`'${id}': caso '${caso}' contra aDistancia`);
    if ((caso === 'guarda' || caso === 'transforma') && !colheAndando) erros.push(`'${id}': caso '${caso}' nao colhe andando`);
    if ((caso === 'dentro' || caso === 'criacao') && r.colheita !== null) erros.push(`'${id}': caso '${caso}' colhe`);
    const animal = ANIMAL_DA_CRIACAO[id];
    if ((caso === 'criacao') !== (animal !== undefined)) erros.push(`'${id}': criacao sem animal, ou animal fora da criacao`);
    if (animal !== undefined && !r.sai.includes(animal)) erros.push(`'${id}': o animal '${animal}' nao sai da receita`);
  }
  return erros;
}

const ehFracao = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const ehPonto = (p: unknown): p is PontoFracionario => Array.isArray(p) && p.length === 2 && p.every(ehFracao);

/** Quantos pontos de estoque o predio declara, por gaveta. `null` = nao guarda. */
export function pontosDeEstoqueEsperados(
  id: string, ctx: ContextoDasCamadas,
): { readonly entrada: number; readonly saida: number } | null {
  if (id === ctx.idDoArmazem) return { entrada: PONTOS_DO_ARMAZEM, saida: 0 };
  if (id === ctx.idDaBodega) return { entrada: ctx.comidas.length, saida: 0 };
  const r = ctx.receitas[id];
  return r === undefined ? null : { entrada: r.entra.length, saida: r.sai.length };
}

/** As regras do campo `ancoras` de uma entrada de predio. Sem `ancoras`, `[]`. */
export function violacoesDasAncoras(e: EntradaDeAsset, ctx: ContextoDasCamadas): string[] {
  const a: AncorasDoPredio | undefined = e.ancoras;
  if (a === undefined) return [];
  const erros: string[] = [];
  const r = `ancoras de '${e.id}'`;
  const pontos: { nome: string; p: PontoFracionario }[] = [];
  const guardar = (nome: string, p: unknown): void => {
    if (ehPonto(p)) pontos.push({ nome, p });
    else erros.push(`${r}: ${nome} nao e ponto [x, y] com fracoes de 0 a 1`);
  };

  if (a.bandeira !== undefined && !ehPonto(a.bandeira)) {
    erros.push(`${r}: bandeira nao e ponto [x, y] com fracoes de 0 a 1`);
  }

  const area = a.trabalho?.area;
  if (area !== undefined) {
    if (!(Array.isArray(area) && area.length === 4 && area.every(ehFracao))) {
      erros.push(`${r}: trabalho.area nao e [x0, y0, x1, y1] com fracoes de 0 a 1`);
    } else if (!(area[0] < area[2] && area[1] < area[3])) {
      erros.push(`${r}: trabalho.area precisa de x0 < x1 e y0 < y1`);
    }
    const caso = CASO_DO_PREDIO[e.id];
    const anima = e.id === ID_DA_ESCOLA || (caso !== undefined && caso !== 'guarda');
    if (!anima) erros.push(`${r}: trabalho.area em predio sem animacao dentro`);
  }
  if (a.trabalho?.fumaca !== undefined) guardar('trabalho.fumaca', a.trabalho.fumaca);
  if (a.trabalho?.fogo !== undefined) guardar('trabalho.fogo', a.trabalho.fogo);

  if (a.estoque !== undefined) {
    const esperado = pontosDeEstoqueEsperados(e.id, ctx);
    if (esperado === null) erros.push(`${r}: estoque em predio que nao guarda mercadoria`);
    for (const gaveta of ['entrada', 'saida'] as const) {
      const lista = a.estoque[gaveta] ?? [];
      if (esperado !== null && lista.length !== esperado[gaveta]) {
        erros.push(`${r}: estoque.${gaveta} tem ${lista.length} ponto(s), a receita pede ${esperado[gaveta]}`);
      }
      lista.forEach((p, i) => guardar(`estoque.${gaveta}[${i}]`, p));
    }
  }

  if (a.curral !== undefined) {
    if (ANIMAL_DA_CRIACAO[e.id] === undefined) erros.push(`${r}: curral fora da criacao`);
    if (a.curral.length !== ANIMAIS_NO_CURRAL) erros.push(`${r}: curral tem ${a.curral.length} pontos, precisa de ${ANIMAIS_NO_CURRAL}`);
    a.curral.forEach((p, i) => guardar(`curral[${i}]`, p));
  }

  if (a.obra !== undefined) {
    const materiais = [...(ctx.materiaisDaObra[e.id] ?? [])].sort();
    const declarados = Object.keys(a.obra).sort();
    if (JSON.stringify(materiais) !== JSON.stringify(declarados)) {
      erros.push(`${r}: obra declara ${JSON.stringify(declarados)}, o custo pede ${JSON.stringify(materiais)}`);
    }
    for (const [m, p] of Object.entries(a.obra)) guardar(`obra.${m}`, p);
  }

  // As areas nao se sobrepoem (§4a): nenhum ponto cai dentro da area de trabalho.
  if (area !== undefined && area.length === 4 && area.every(ehFracao)) {
    for (const { nome, p } of pontos) {
      if (nome === 'trabalho.fumaca' || nome === 'trabalho.fogo') continue;
      if (p[0] > area[0] && p[0] < area[2] && p[1] > area[1] && p[1] < area[3]) {
        erros.push(`${r}: ${nome} cai dentro de trabalho.area`);
      }
    }
  }
  return erros;
}
