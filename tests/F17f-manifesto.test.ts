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
import type { EntradaDeAsset, Manifesto } from '../src/render/manifesto';
import { ORDEM_DOS_ESTAGIOS } from '../src/render/estagio-obra';
import { gravarEvidencia } from './helpers/evidence';

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

/** As chaves de `estados` que nao sao estagio do render: arte que nunca aparece na tela. */
function chavesForaDosEstagios(entrada: EntradaDeAsset): string[] {
  const validas = new Set<string>(ORDEM_DOS_ESTAGIOS);
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
      expect(e.anchor, e.id).toEqual([0.5, 1]);
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

  // A convencao que esta feature existe para fixar: a LARGURA manda. A altura
  // e o que a arte der — forcar um quadrado esticaria a arte 1,5x na vertical.
  it('a largura em px e a largura do footprint em tiles vezes o tile', () => {
    for (const e of predios) {
      expect(e.tamanho[0], e.id).toBe(e.footprint[0] * gameData.terreno.tilePx);
    }
  });

  it('o footprint do manifesto bate com o de buildings.json', () => {
    for (const e of predios) {
      const def = gameData.predios.find((p) => p.id === e.id);
      expect(def, `o manifesto declara '${e.id}', que nao existe em buildings.json`).toBeTruthy();
      expect([...e.footprint]).toEqual([...(def?.tamanho ?? [])]);
    }
  });

  // O guarda da F17e: o estagio do meio passou a se chamar `estrutura`, e o nome
  // antigo (`madeira`) nao pode ter ficado para tras — chave orfa e arte que nunca
  // mais aparece na tela, sem ninguem reprovar. Ate 2026-09-26 ele era afirmado so
  // no armazem, com os nomes dos arquivos de hoje, e reprovava quando o armazem
  // fosse refeito (BUG-H). Agora vale para TODA entrada, contra a lista do render.
  it('nenhuma entrada tem chave de estado fora dos seis estagios do render', () => {
    for (const e of predios) {
      expect(chavesForaDosEstagios(e), e.id).toEqual([]);
    }
    // e o guarda acusa: a chave antiga da F17e numa entrada sintetica
    const comChaveVelha = entradaSintetica('storehouse', {
      marcacao: 'sprites/x/marcacao.png',
      madeira: 'sprites/x/madeira.png',
    });
    expect(chavesForaDosEstagios(comChaveVelha)).toEqual(['madeira']);
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
