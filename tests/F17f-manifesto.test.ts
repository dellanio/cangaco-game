/**
 * F17f — o manifesto de assets e o resolvedor.
 *
 * Prova os DOIS lados do §9 do CLAUDE.md: predio com PNG resolve arquivo,
 * predio sem PNG resolve null e cai no retangulo. E fixa a convencao que esta
 * feature existe para fixar — a largura em px sai do footprint em tiles.
 *
 * Nenhuma imagem e aberta aqui: a dimensao sai do cabecalho IHDR do arquivo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { assetDoPredio, arquivoDoEstagio, chaveDaTextura, ehEntradaDePredio, TIPOS_DE_CAMADA } from '../src/render/manifesto';
import type { EntradaDeAsset, EntradaDeCamada, Manifesto } from '../src/render/manifesto';
import {
  ANIMAL_DA_CRIACAO, CASO_DO_PREDIO, violacoesDaCamadaViva, violacoesDasAncoras, violacoesDasCamadasRepetidas,
  violacoesDosCasos,
} from '../src/render/manifesto-camadas';
import type { ContextoDasCamadas } from '../src/render/manifesto-camadas';
import { contextoDasCamadas } from '../src/render/predios';
import { ORDEM_DOS_ESTAGIOS } from '../src/render/estagio-obra';
import { CHAVES_DA_REVELACAO } from '../src/render/manifesto';
import { entradasDosIcones, errosDosIconesDeMercadoria } from '../src/render/icone-da-mercadoria';
import type { IconesDeMercadoria } from '../src/render/icone-da-mercadoria';
import { gravarEvidencia } from './helpers/evidence';
import { violacoesDoAtlas } from '../src/render/atlas-de-unidade';
import type { AtlasDeUnidade } from '../src/render/atlas-de-unidade';

describe('D-TELA-04a (manifesto de animações)', () => {
  const depuracao = JSON.parse(readFileSync('assets/depuracao/manifesto.json', 'utf8')) as Manifesto;
  it('valida pela mesma regra todos os atlas declarados nos dois manifestos', () => {
    for (const m of [manifesto, depuracao]) for (const e of m.assets) {
      if (e.tipo === 'unidade' && e.atlas) {
        const atlas = JSON.parse(readFileSync(`assets/${e.atlas}`, 'utf8')) as AtlasDeUnidade;
        expect(violacoesDoAtlas(e, atlas), e.id).toEqual([]);
      }
    }
  });
  const entrada: EntradaDeCamada = {
    id: 'teste', tipo: 'unidade', footprint: [1,1], tamanho: [64,96], anchor: [0.5,1], estados: {},
    atlas: 'sintetico.json', animacoes: { andar: { quadros: 2, tilesPorCiclo: 2, laco: true } },
    licenca: 'teste', origem: { base: 'teste', semente: null },
  };
  const quadro = { sourceSize: { w: 64, h: 96 }, spriteSourceSize: { x: 0, y: 0, w: 64, h: 96 }, frame: { x: 0, y: 0, w: 64, h: 96 } };
  const sintetico = (): AtlasDeUnidade => ({ frames: {
    'teste/andar/n/0000': structuredClone(quadro), 'teste/andar/n/0001': structuredClone(quadro),
    'teste/andar/s/0000': structuredClone(quadro), 'teste/andar/s/0001': structuredClone(quadro),
  } });
  it('reprova quadro prometido ausente, mesmo preservando a contagem', () => {
    const a = sintetico(); const frames = { ...a.frames };
    frames['teste/andar/n/0002'] = structuredClone(quadro); delete frames['teste/andar/n/0001'];
    expect(violacoesDoAtlas(entrada, { frames })).toContain('quadro-ausente: teste/andar/n/0001');
  });
  it('reprova direção com contagem diferente', () => {
    const frames = { ...sintetico().frames }; delete frames['teste/andar/s/0001'];
    expect(violacoesDoAtlas(entrada, { frames })).toContain('contagem-de-direcao: teste/andar/s/');
  });
  it('reprova uma direção inteira ausente em uma das animações', () => {
    const frames = { ...sintetico().frames, 'teste/parado/n/0000': structuredClone(quadro) };
    const e = { ...entrada, animacoes: { ...entrada.animacoes, parado: { quadros: 1, fps: 10, laco: true } } };
    expect(violacoesDoAtlas(e, { frames })).toContain('quadro-ausente: teste/parado/s/0000');
  });
  it('reprova sourceSize diferente do tamanho declarado', () => {
    const frames = { ...sintetico().frames, 'teste/andar/n/0000': { ...quadro, sourceSize: { w: 63, h: 96 } } };
    expect(violacoesDoAtlas(entrada, { frames })).toContain('sourceSize: teste/andar/n/0000');
  });
});

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
/**
 * F-SPR: o manifesto passou a aceitar terreno, recurso, vegetacao e unidade. As
 * regras de PREDIO (anchor, largura, footprint de buildings.json, estagios) valem
 * para as entradas `predio`, e so para elas — sem afrouxar nenhuma. As regras da §9
 * que valem para qualquer asset (oito campos, arquivo existe com a dimensao
 * declarada, base versionada) continuam sobre todas.
 */
const predios = manifesto.assets.filter(ehEntradaDePredio);

/**
 * Largura e altura do IHDR, que sao os bytes 16..24 de todo PNG. Ler o
 * cabecalho e o que prova que o arquivo TEM a dimensao declarada no manifesto,
 * sem dependencia de decodificador e sem carregar a imagem.
 */
function dimensaoDoPng(caminho: string): [number, number] {
  const b = readFileSync(caminho);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/**
 * Entrada de manifesto escrita no teste, para provar o RESOLVEDOR sem depender de
 * qual predio tem arte hoje. Nenhum arquivo e lido: `assetDoPredio` e
 * `arquivoDoEstagio` so olham o objeto (docs/planos/F17f-lista-derivada.md).
 */
function entradaSintetica(id: string, estados: Record<string, string>): EntradaDeAsset {
  return {
    id,
    tipo: 'predio',
    footprint: [3, 3],
    tamanho: [192, 128],
    anchor: [0.5, 1],
    estados,
    licenca: 'sintetica, so no teste',
    origem: { base: `base/${id}/${id}.png`, semente: null },
  };
}

/** As chaves de `estados` que o render nao le (nem estagio, nem par da F17g):
 *  arte que nunca aparece na tela. */
function chavesForaDosEstagios(entrada: EntradaDeAsset): string[] {
  const validas = new Set<string>([...ORDEM_DOS_ESTAGIOS, ...CHAVES_DA_REVELACAO]);
  return Object.keys(entrada.estados).filter((k) => !validas.has(k));
}

describe('F17f — o manifesto descreve a arte que existe', () => {
  it('toda entrada tem os oito campos da §9', () => {
    expect(predios.length).toBeGreaterThan(0);
    const tipos = new Set<string>(['predio', ...TIPOS_DE_CAMADA]);
    for (const e of manifesto.assets) {
      expect(typeof e.id).toBe('string');
      expect(tipos.has(e.tipo), `${e.id}: tipo '${e.tipo}'`).toBe(true);
      expect(e.footprint).toHaveLength(2);
      expect(e.tamanho).toHaveLength(2);
      expect(e.anchor).toHaveLength(2);
      expect(Object.keys(e.estados).length).toBeGreaterThan(0);
      expect(typeof e.licenca).toBe('string');
      expect(e.origem.base).toBeTruthy();
    }
    for (const e of predios) {
      expect(e.anchor[0], `${e.id}: anchor x`).toBeGreaterThanOrEqual(0);
      expect(e.anchor[0], `${e.id}: anchor x`).toBeLessThanOrEqual(1);
      expect(e.anchor[1], `${e.id}: anchor y`).toBeGreaterThanOrEqual(0);
      expect(e.anchor[1], `${e.id}: anchor y`).toBeLessThanOrEqual(1);
    }
  });

  it('todo arquivo declarado existe e tem a dimensao declarada', () => {
    for (const e of manifesto.assets) {
      for (const rel of Object.values(e.estados)) {
        const caminho = `assets/${rel}`;
        expect(existsSync(caminho), caminho).toBe(true);
        expect(dimensaoDoPng(caminho), caminho).toEqual(e.tamanho);
      }
      // A base versionada tambem tem de estar la: sem ela nao ha como
      // reajustar um frame sem refazer o conjunto (§9).
      expect(existsSync(`assets/${e.origem.base}`), e.origem.base).toBe(true);
    }
  });

  // A base assenta no footprint, mas o canvas pode ultrapassa-lo. A regua e
  // 64 px por tile e o render nao reduz um canvas maior de volta ao lote.
  it('o canvas comporta o footprint na regua canonica e pode transbordar', () => {
    for (const e of predios) {
      expect(e.tamanho[0], e.id).toBeGreaterThanOrEqual(e.footprint[0] * gameData.terreno.tilePx);
      expect(e.tamanho[1], e.id).toBeGreaterThan(0);
    }
  });

  it('o footprint do manifesto bate com o de buildings.json', () => {
    for (const e of predios) {
      const def = gameData.predios.find((p) => p.id === e.id);
      expect(def, `o manifesto declara '${e.id}', que nao existe em buildings.json`).toBeTruthy();
      expect([...e.footprint]).toEqual([...(def?.tamanho ?? [])]);
    }
  });

  // O guarda da F17e: chave que o render nao le e arte que nunca aparece na tela,
  // sem ninguem reprovar. Ate 2026-09-26 ele era afirmado so no armazem (BUG-H);
  // vale para TODA entrada, contra as listas do render. F17g: o render le as seis
  // chaves de estagio (fallback) E as duas do par da revelacao — `madeira` voltou.
  it('nenhuma entrada tem chave de estado fora dos estagios e do par do render', () => {
    for (const e of predios) {
      expect(chavesForaDosEstagios(e), e.id).toEqual([]);
    }
    // o par passa: e o que o Codex vai registrar
    const comPar = entradaSintetica('storehouse', {
      madeira: 'sprites/x/madeira.png',
      completo: 'sprites/x/completo.png',
    });
    expect(chavesForaDosEstagios(comPar)).toEqual([]);
    // e o guarda acusa: `pedra` e o nome do tema, nao a chave (a pedra e o `completo`)
    const comChaveErrada = entradaSintetica('storehouse', {
      madeira: 'sprites/x/madeira.png',
      pedra: 'sprites/x/pedra.png',
    });
    expect(chavesForaDosEstagios(comChaveErrada)).toEqual(['pedra']);
  });

  // O outro lado do §9: placeholder e comportamento normal, nao e falha.
  //
  // 2026-09-26 (docs/planos/F17f-lista-derivada.md): a lista de quem tem arte sai
  // do MANIFESTO, nao do teste. Antes ela era fixada aqui (`quarry` e `schoolhouse`
  // sem arte, e "todos menos um") e reprovava a cada predio novo que a arte
  // trouxesse — o teste afirmava o retrato do dia, nao a regra. A regra e: o
  // resolvedor concorda com o manifesto, nos dois sentidos.
  it('predio resolve arte se e so se o manifesto tem entrada para ele', () => {
    const idsNoManifesto = new Set(predios.map((e) => e.id));
    for (const p of gameData.predios) {
      const entrada = assetDoPredio(manifesto, p.id);
      if (idsNoManifesto.has(p.id)) {
        expect(entrada?.id, p.id).toBe(p.id);
      } else {
        expect(entrada, p.id).toBeNull();
      }
    }
    expect(assetDoPredio(manifesto, 'tipo_que_nao_existe')).toBeNull();
  });

  // O lado `null` provado com um manifesto de UMA entrada: quando os 28 predios
  // tiverem arte, o teste de cima deixa de exercitar o ramo `null` com predio real,
  // e este continua exercitando.
  it('predio fora do manifesto resolve null, mesmo com outro predio dentro', () => {
    const [primeiro, ...outros] = gameData.predios;
    const umaEntrada: Manifesto = {
      versao: 1,
      assets: [entradaSintetica(primeiro!.id, { completo: 'sprites/x/completo.png' })],
    };
    expect(assetDoPredio(umaEntrada, primeiro!.id)?.id).toBe(primeiro!.id);
    expect(outros.length).toBeGreaterThan(0);
    for (const p of outros) {
      expect(assetDoPredio(umaEntrada, p.id), p.id).toBeNull();
    }
  });

  // F17e: estagio sem arte resolve null e a cena cai no retangulo DAQUELE
  // estagio — herdar o sprite do estagio vizinho mentiria sobre o progresso da
  // obra. Ate 2026-09-26 isto usava `paredes` e `cobertura` do armazem, que faltam
  // HOJE; com manifesto sintetico, continua provado quando o armazem tiver os seis.
  it('estagio sem arte resolve null, mesmo num predio que tem arte', () => {
    const comArte = ['marcacao', 'completo'];
    const estados = Object.fromEntries(comArte.map((s) => [s, `sprites/x/${s}.png`]));
    const entrada = entradaSintetica('storehouse', estados);
    const semArte = ORDEM_DOS_ESTAGIOS.filter((s) => !comArte.includes(s));
    expect(semArte.length).toBeGreaterThan(0);
    for (const s of comArte) {
      expect(arquivoDoEstagio(entrada, s), s).toBe(`sprites/x/${s}.png`);
    }
    for (const s of semArte) {
      expect(arquivoDoEstagio(entrada, s), s).toBeNull();
    }
    expect(arquivoDoEstagio(entrada, 'estagio_que_nao_existe')).toBeNull();
  });

  // Uma unica funcao monta a chave para quem carrega e para quem desenha:
  // duas formas de montar a mesma chave e como elas divergem (licao da F17b).
  it('a chave de textura e a mesma para quem carrega e para quem desenha', () => {
    expect(chaveDaTextura('storehouse', 'completo')).toBe('predio:storehouse:completo');
  });

  it('grava a evidencia', () => {
    gravarEvidencia('F17f', {
      feature: 'F17f-primeiro-sprite',
      camadasVivas: manifesto.assets.filter((e) => ['trabalho', 'pilha', 'animal'].includes(e.tipo)).length,
      prediosComAncoras: predios.filter((e) => e.ancoras !== undefined).map((e) => e.id),
      tilePx: gameData.terreno.tilePx,
      entradas: predios.map((e) => ({
        id: e.id,
        footprint: e.footprint,
        tamanho: e.tamanho,
        anchor: e.anchor,
        estados: e.estados,
        arquivosNoDisco: Object.values(e.estados).map((rel) => ({
          rel,
          dimensao: dimensaoDoPng(`assets/${rel}`),
        })),
        origem: e.origem,
      })),
      prediosComArte: gameData.predios.filter((p) => assetDoPredio(manifesto, p.id) !== null).length,
      prediosSemArte: gameData.predios.filter((p) => assetDoPredio(manifesto, p.id) === null).length,
      perspectiva:
        'ISOMETRICA — divergente do §9.3 do CLAUDE.md (3/4 sobre grid ortogonal). ' +
        'Conhecida e a substituir: esta feature valida manifesto, dimensao e ancoragem, nao a arte.',
    });
  });
});

/**
 * F-VIVO-0 — os tres tipos do predio vivo e o campo `ancoras` (docs/BRIEF-ARTE.md §4a).
 * O contexto sai do dado, nunca digitado, e e o MESMO do funil que o render le
 * (`contextoDasCamadas`, `src/render/predios.ts`); as regras moram em
 * `src/render/manifesto-camadas.ts`, que o render da F-VIVO le tambem. Cada regra tem
 * o caso que REPROVA, num manifesto escrito aqui: a arte de hoje nao declara nada
 * disto, e um teste so com o manifesto real passaria sem exercitar regra nenhuma.
 */
const contexto: ContextoDasCamadas = contextoDasCamadas;

function camadaSintetica(tipo: EntradaDeCamada['tipo'], id: string, estados: string[]): EntradaDeCamada {
  return {
    id, tipo, footprint: [1, 1], tamanho: [16, 16], anchor: [0.5, 1],
    estados: Object.fromEntries(estados.map((k) => [k, `sprites/${id}/${id}_${k}.png`])),
    licenca: 'sintetica, so no teste', origem: { base: `base/${id}/${id}.png`, semente: null },
  };
}
const quadros = (laco: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${laco}_${i + 1}`);
const comAncoras = (id: string, ancoras: NonNullable<EntradaDeAsset['ancoras']>): EntradaDeAsset => ({
  ...entradaSintetica(id, { completo: `sprites/${id}/completo.png` }), ancoras,
});

describe('F-VIVO-0 — o manifesto aceita o predio vivo', () => {
  it('o manifesto real passa nas regras novas', () => {
    const camadas = manifesto.assets.filter((e): e is EntradaDeCamada => !ehEntradaDePredio(e));
    expect(camadas.flatMap((e) => violacoesDaCamadaViva(e, contexto))).toEqual([]);
    expect(predios.flatMap((e) => violacoesDasAncoras(e, contexto))).toEqual([]);
  });

  it('a tabela de casos concorda com o dado: todo predio com receita num caso so', () => {
    expect(violacoesDosCasos(contexto)).toEqual([]);
    expect(Object.keys(CASO_DO_PREDIO).sort()).toEqual(Object.keys(contexto.receitas).sort());
    // e o guarda acusa: uma mina que deixasse de colher de dentro
    const mina = contexto.receitas['gold_mine'];
    expect(mina).toBeDefined();
    const semLuz: ContextoDasCamadas = {
      ...contexto, receitas: { ...contexto.receitas, gold_mine: { ...mina!, colheita: { aDistancia: false } } },
    };
    expect(violacoesDosCasos(semLuz).join(' | ')).toMatch(/gold_mine.*aDistancia/);
  });

  it('entradas completas dos tres tipos passam', () => {
    const boas = [
      camadaSintetica('pilha', 'stone', ['unidade']),
      camadaSintetica('animal', 'pigs', [...quadros('idade1', 4), ...quadros('idade2', 4), ...quadros('idade3', 4)]),
      camadaSintetica('trabalho', 'quarry', [...quadros('inicio', 8), ...quadros('meio', 8), ...quadros('fim', 8)]),
      camadaSintetica('trabalho', 'sawmill', [...quadros('laco1', 8), ...quadros('laco2', 8)]),
      camadaSintetica('trabalho', 'gold_mine', quadros('luz', 4)),
      camadaSintetica('trabalho', 'fumaca', quadros('fumaca', 8)),
      camadaSintetica('trabalho', 'ocioso', quadros('ocioso', 8)),
      // arte em parte: um laco inteiro de dois vale; o outro fica placeholder
      camadaSintetica('trabalho', 'bakery', quadros('laco1', 8)),
    ];
    expect(boas.flatMap((e) => violacoesDaCamadaViva(e, contexto))).toEqual([]);
  });

  it('cada regra dos tres tipos acusa', () => {
    const acusa = (e: EntradaDeCamada, padrao: RegExp): void => {
      expect(violacoesDaCamadaViva(e, contexto).join(' | '), `${e.tipo} ${e.id}`).toMatch(padrao);
    };
    acusa(camadaSintetica('pilha', 'arma_madeira', ['unidade']), /nao e mercadoria/);
    acusa(camadaSintetica('pilha', 'stone', ['unidade', 'pilha5']), /unico estado/);
    acusa(camadaSintetica('animal', 'corn', quadros('idade1', 4)), /nao e o animal/);
    acusa(camadaSintetica('animal', 'horses', quadros('idade1', 3)), /idade1.*3 de 4/);
    acusa(camadaSintetica('animal', 'horses', ['idade4_1']), /idade4_1/);
    acusa(camadaSintetica('trabalho', 'storehouse', quadros('laco1', 8)), /nem 'fumaca'/);
    acusa(camadaSintetica('trabalho', 'farm', quadros('laco1', 8)), /caso 1/);
    acusa(camadaSintetica('trabalho', 'sawmill', quadros('luz', 4)), /luz_1/);
    acusa(camadaSintetica('trabalho', 'gold_mine', quadros('luz', 8)), /luz_5/);
    acusa(camadaSintetica('trabalho', 'quarry', [...quadros('inicio', 8), ...quadros('meio', 6)]), /meio.*6 de 8/);
    // F-VIVO-e: o ocioso e um laco de 8, e nada alem dele
    acusa(camadaSintetica('trabalho', 'ocioso', [...quadros('ocioso', 8), 'ocioso_9']), /ocioso_9/);
    acusa(camadaSintetica('trabalho', 'ocioso', quadros('laco1', 8)), /laco1_1/);
  });

  it('F-VIVO-e: cada camada uma entrada so; o ocioso repetido (dois tamanhos) reprova', () => {
    const camadas = manifesto.assets.filter((e): e is EntradaDeCamada => !ehEntradaDePredio(e));
    expect(violacoesDasCamadasRepetidas(camadas)).toEqual([]);
    const ocioso = camadaSintetica('trabalho', 'ocioso', quadros('ocioso', 8));
    const outroTamanho: EntradaDeCamada = { ...ocioso, tamanho: [32, 32] };
    expect(violacoesDasCamadasRepetidas([...camadas, ocioso, outroTamanho]).join(' | '))
      .toMatch(/trabalho 'ocioso': entrada repetida/);
    // tipos diferentes com o mesmo id nao sao repeticao (a pilha e o animal podem dividir id)
    expect(violacoesDasCamadasRepetidas([ocioso, camadaSintetica('pilha', 'ocioso', ['unidade'])])).toEqual([]);
  });

  it('ancoras completas passam, e predio sem ancoras nao tem regra', () => {
    const pedreira = comAncoras('quarry', {
      trabalho: { area: [0.3, 0.45, 0.6, 0.75], fumaca: [0.72, 0.1] },
      estoque: { entrada: [], saida: [[0.8, 0.92]] },
      obra: Object.fromEntries((contexto.materiaisDaObra['quarry'] ?? []).map((m, i) => [m, [0.1 + i * 0.1, 0.95] as const])),
    });
    const malhada = comAncoras('swine_farm', {
      trabalho: { area: [0.3, 0.2, 0.6, 0.5] },
      estoque: { entrada: [[0.1, 0.9]], saida: [[0.8, 0.9], [0.9, 0.9]] },
      curral: [[0.2, 0.7], [0.35, 0.75], [0.5, 0.72], [0.65, 0.76], [0.8, 0.7]],
    });
    const quatro = [[0.1, 0.9], [0.3, 0.9], [0.6, 0.9], [0.8, 0.9]] as const;
    const armazem = comAncoras('storehouse', { estoque: { entrada: quatro } });
    const bodega = comAncoras('inn', { estoque: { entrada: quatro } });
    const roca = comAncoras('farm', { trabalho: { fumaca: [0.5, 0.1] }, estoque: { saida: [[0.8, 0.9]] } });
    for (const e of [pedreira, malhada, armazem, bodega, roca]) expect(violacoesDasAncoras(e, contexto), e.id).toEqual([]);
    expect(violacoesDasAncoras(entradaSintetica('quarry', { completo: 'x.png' }), contexto)).toEqual([]);
    expect(Object.keys(ANIMAL_DA_CRIACAO).sort()).toEqual(['stables', 'swine_farm']);
  });

  it('cada regra das ancoras acusa', () => {
    const acusa = (e: EntradaDeAsset, padrao: RegExp): void => {
      expect(violacoesDasAncoras(e, contexto).join(' | '), e.id).toMatch(padrao);
    };
    acusa(comAncoras('sawmill', { trabalho: { area: [0.3, 0.45, 1.2, 0.75] } }), /fracoes de 0 a 1/);
    acusa(comAncoras('sawmill', { trabalho: { area: [0.6, 0.45, 0.3, 0.75] } }), /x0 < x1/);
    acusa(comAncoras('farm', { trabalho: { area: [0.3, 0.45, 0.6, 0.75] } }), /sem animacao dentro/);
    acusa(comAncoras('sawmill', { trabalho: { fumaca: [0.5, -0.1] } }), /trabalho.fumaca nao e ponto/);
    acusa(comAncoras('iron_smithy', { trabalho: { fogo: [0.5, -0.1] } }), /trabalho.fogo nao e ponto/);
    acusa(comAncoras('sawmill', { estoque: { entrada: [[0.1, 0.9], [0.2, 0.9]], saida: [[0.8, 0.9]] } }), /entrada tem 2.*pede 1/);
    acusa(comAncoras('storehouse', { estoque: { entrada: [[0.1, 0.9]] } }), /entrada tem 1.*pede 4/);
    acusa(comAncoras('inn', { estoque: { entrada: [[0.1, 0.9], [0.2, 0.9], [0.3, 0.9], [0.4, 0.9]], saida: [[0.8, 0.9]] } }), /saida tem 1.*pede 0/);
    acusa(comAncoras('barracks', { estoque: { entrada: [] } }), /nao guarda mercadoria/);
    acusa(comAncoras('sawmill', { curral: [[0.1, 0.1], [0.2, 0.1], [0.3, 0.1], [0.4, 0.1], [0.5, 0.1]] }), /curral fora da criacao/);
    acusa(comAncoras('stables', { curral: [[0.1, 0.1], [0.2, 0.1]] }), /2 pontos, precisa de 5/);
    acusa(comAncoras('sawmill', { obra: { timber: [0.1, 0.9] } }), /o custo pede/);
    acusa(comAncoras('sawmill', {
      trabalho: { area: [0.3, 0.45, 0.6, 0.75] }, estoque: { entrada: [[0.4, 0.5]], saida: [[0.8, 0.9]] },
    }), /entrada\[0\] cai dentro de trabalho.area/);
  });
});

describe('D-ARTE-01 — icones.mercadorias aponta os icones que ja existem', () => {
  const icones = (manifesto as unknown as { icones?: { mercadorias?: IconesDeMercadoria } }).icones?.mercadorias;
  const mercadorias = gameData.economia.mercadorias;
  const dimensao = (arquivo: string): [number, number] | null =>
    existsSync(`assets/${arquivo}`) ? dimensaoDoPng(`assets/${arquivo}`) : null;
  // D-ARTE-PIXEL-ART-CIVIS (teste de pixel art): todas as 28 mercadorias tem sprite, e nao so as 8 da D-ARTE-01.
  const ESPERADAS = [...mercadorias].sort();

  it('o manifesto real passa: todo id e mercadoria, todo arquivo existe com o tamanho declarado', () => {
    expect(errosDosIconesDeMercadoria(icones, mercadorias, dimensao)).toEqual([]);
  });

  it('sao exatamente as 28 mercadorias da economia', () => {
    expect(entradasDosIcones(icones).map(([id]) => id).sort()).toEqual(ESPERADAS);
  });

  it('cada regra acusa, num manifesto escrito no teste', () => {
    const base = entradasDosIcones(icones)[0]?.[1];
    if (base === undefined) throw new Error('sem icone para copiar');
    const acusa = (falso: IconesDeMercadoria, padrao: RegExp): void => {
      expect(errosDosIconesDeMercadoria(falso, mercadorias, dimensao).join(' | ')).toMatch(padrao);
    };
    acusa({ arma_madeira: base }, /arma_madeira: nao e mercadoria/);
    acusa({ timber: { ...base, arquivo: 'sprites/ui/nao-existe.png' } }, /nao-existe\.png nao existe/);
    acusa({ timber: { ...base, tamanho: [base.tamanho[0] + 1, base.tamanho[1]] } }, /tamanho declarado/);
    // o comentario do dado nao e entrada
    expect(errosDosIconesDeMercadoria({ _doc: 'nota' }, mercadorias, dimensao)).toEqual([]);
  });
});
