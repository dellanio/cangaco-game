// F11a — `validate:data` passa a cobrir `time.velocidadeDeJogo`. A F11a e a primeira feature a
// CONSUMIR esse dado (as opcoes e o padrao do laco), e a praxe do projeto e que quem consome um
// dado acrescenta a regra que o protege. Ate aqui nada validava nem `opcoes` nao vazio nem
// `padrao` dentro de `opcoes`: um padrao fora das opcoes so explodiria em `criarLaco`, no
// navegador. Cobertura PERMANENTE contra `validarTudo` (roda em `npm run verify`), nao prova por
// arquivo temporario (CLAUDE.md §8).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validarTudo } from '../tools/data-rules.js';

const ARQUIVOS = ['time', 'buildings', 'production', 'units', 'combat', 'condition', 'delivery', 'terrain', 'economy'];

type Velocidade = { opcoes: unknown; padrao: unknown };

/** O dado real, com `time.velocidadeDeJogo` trocado por `velocidade` (ou como esta, se `null`). */
function dadosComVelocidade(velocidade: Velocidade | null): Record<string, unknown> {
  const dados: Record<string, unknown> = {};
  for (const nome of ARQUIVOS) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
  if (velocidade !== null) {
    (dados.time as { velocidadeDeJogo: Velocidade }).velocidadeDeJogo = velocidade;
  }
  return dados;
}

const errosDaRegra = (velocidade: Velocidade): string[] =>
  validarTudo(dadosComVelocidade(velocidade)).filter((e) => e.startsWith('tempo/velocidade'));

describe('F11a — validate:data: velocidadeDeJogo', () => {
  it('o dado real passa, e sem nenhum erro no arquivo inteiro', () => {
    expect(validarTudo(dadosComVelocidade(null))).toEqual([]);
  });

  it('padrao fora de opcoes reprova, e a mensagem nomeia o padrao e as opcoes', () => {
    const erros = errosDaRegra({ opcoes: [1, 2, 3], padrao: 4 });
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain('padrao');
    expect(erros[0]).toContain('4');
    expect(erros[0]).toContain('[1, 2, 3]');
  });

  it('opcoes vazio reprova', () => {
    const erros = errosDaRegra({ opcoes: [], padrao: 1 });
    expect(erros.some((e) => e.includes('opcoes'))).toBe(true);
  });

  it.each([
    ['nao e array', 'rapido'],
    ['tem zero', [0, 1]],
    ['tem negativo', [-1, 1]],
    ['tem fracao', [1, 1.5]],
    ['tem texto', [1, '2']],
    ['tem repetido', [1, 2, 2]],
  ])('opcoes que %s reprova', (_motivo, opcoes) => {
    expect(errosDaRegra({ opcoes, padrao: 1 }).length).toBeGreaterThan(0);
  });

  it('velocidadeDeJogo ausente reprova (esquecimento e erro)', () => {
    const dados = dadosComVelocidade(null);
    delete (dados.time as { velocidadeDeJogo?: unknown }).velocidadeDeJogo;
    expect(validarTudo(dados).some((e) => e.startsWith('tempo/velocidade'))).toBe(true);
  });

  it('um padrao que e uma das opcoes, em outra ordem ou com outra escolha, passa', () => {
    expect(errosDaRegra({ opcoes: [1, 2, 3], padrao: 2 })).toEqual([]);
    expect(errosDaRegra({ opcoes: [3, 2, 1], padrao: 3 })).toEqual([]);
    expect(errosDaRegra({ opcoes: [1], padrao: 1 })).toEqual([]);
  });
});
