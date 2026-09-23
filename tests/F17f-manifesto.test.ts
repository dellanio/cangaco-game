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
import { assetDoPredio, arquivoDoEstagio, chaveDaTextura } from '../src/render/manifesto';
import type { Manifesto } from '../src/render/manifesto';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;

/**
 * Largura e altura do IHDR, que sao os bytes 16..24 de todo PNG. Ler o
 * cabecalho e o que prova que o arquivo TEM a dimensao declarada no manifesto,
 * sem dependencia de decodificador e sem carregar a imagem.
 */
function dimensaoDoPng(caminho: string): [number, number] {
  const b = readFileSync(caminho);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('F17f — o manifesto descreve a arte que existe', () => {
  it('toda entrada tem os oito campos da §9', () => {
    expect(manifesto.assets.length).toBeGreaterThan(0);
    for (const e of manifesto.assets) {
      expect(typeof e.id).toBe('string');
      expect(e.tipo).toBe('predio');
      expect(e.footprint).toHaveLength(2);
      expect(e.tamanho).toHaveLength(2);
      expect(e.anchor).toEqual([0.5, 1]);
      expect(Object.keys(e.estados).length).toBeGreaterThan(0);
      expect(typeof e.licenca).toBe('string');
      expect(e.origem.base).toBeTruthy();
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
    for (const e of manifesto.assets) {
      expect(e.tamanho[0], e.id).toBe(e.footprint[0] * gameData.terreno.tilePx);
    }
  });

  it('o footprint do manifesto bate com o de buildings.json', () => {
    for (const e of manifesto.assets) {
      const def = gameData.predios.find((p) => p.id === e.id);
      expect(def, `o manifesto declara '${e.id}', que nao existe em buildings.json`).toBeTruthy();
      expect([...e.footprint]).toEqual([...(def?.tamanho ?? [])]);
    }
  });

  it('o armazem tem arte em tres dos seis estagios', () => {
    const armazem = assetDoPredio(manifesto, 'storehouse');
    expect(armazem).not.toBeNull();
    expect(arquivoDoEstagio(armazem!, 'marcacao')).toBe('sprites/storehouse/storehouse_marcacao.png');
    // F17e: o estagio do meio passou a se chamar `estrutura`. O arquivo e o
    // mesmo (a base dele sempre se chamou `armazem_02_estrutura.png`); a chave e
    // que acompanha o vocabulario dos seis estagios.
    expect(arquivoDoEstagio(armazem!, 'estrutura')).toBe('sprites/storehouse/storehouse_madeira.png');
    expect(arquivoDoEstagio(armazem!, 'completo')).toBe('sprites/storehouse/storehouse_completo.png');
    // e o nome antigo nao pode ter ficado para tras: chave orfa e arte que nunca
    // mais aparece na tela, sem ninguem reprovar.
    expect(arquivoDoEstagio(armazem!, 'madeira')).toBeNull();
  });

  // O outro lado do §9: placeholder e comportamento normal, nao e falha.
  it('predio sem arte resolve null, e e a maioria', () => {
    expect(assetDoPredio(manifesto, 'quarry')).toBeNull();
    expect(assetDoPredio(manifesto, 'schoolhouse')).toBeNull();
    expect(assetDoPredio(manifesto, 'tipo_que_nao_existe')).toBeNull();

    const semArte = gameData.predios.filter((p) => assetDoPredio(manifesto, p.id) === null);
    expect(semArte.length).toBe(gameData.predios.length - 1);
  });

  it('estagio sem arte resolve null, mesmo num predio que tem arte', () => {
    const armazem = assetDoPredio(manifesto, 'storehouse');
    // F17e: `paredes` e `cobertura` existem no render e NAO tem arte. O
    // resolvedor devolve null e a cena cai no retangulo DAQUELE estagio — herdar
    // o sprite do estagio vizinho mentiria sobre o progresso da obra.
    expect(arquivoDoEstagio(armazem!, 'paredes')).toBeNull();
    expect(arquivoDoEstagio(armazem!, 'cobertura')).toBeNull();
    expect(arquivoDoEstagio(armazem!, 'estagio_que_nao_existe')).toBeNull();
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
      entradas: manifesto.assets.map((e) => ({
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
