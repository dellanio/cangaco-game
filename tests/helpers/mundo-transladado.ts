/**
 * F18c-1c — setup da corrida transladada (`vitest.transladado.config.mts`).
 *
 * O plugin da config troca o texto dos tres JSON quando eles entram por
 * `import`; este setup troca o que `fs.readFileSync` devolve para os MESMOS tres
 * arquivos, no processo do teste. Sem ele o teste que confere o `import` contra a
 * leitura crua (F-T4b: sim contra roteiro) veria dois mundos e reprovaria sem
 * literal nenhum. Nada e escrito em `data/`.
 */
import fs from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashDeTexto } from '../../src/sim/data/hash';
import { fixtureSaveTransladado } from './fixture-save-transladado';

const require = createRequire(import.meta.url);
const { ARQ, transladarTextos } = require('../../tools/transladar-mundo.js') as {
  ARQ: Record<string, string>;
  transladarTextos: (originais: Record<string, string>, k: number) => Record<string, string>;
};

const original = fs.readFileSync;
const k = Number(process.env['CANGACO_TRANSLADO_K']);
if (!Number.isInteger(k) || k <= 0) throw new Error('mundo-transladado: CANGACO_TRANSLADO_K ausente');

const textos = transladarTextos(
  Object.fromEntries(Object.entries(ARQ).map(([id, f]) => [id, original(f, 'utf8')])),
  k,
);
const porCaminho = new Map(Object.entries(ARQ).map(([id, f]) => [resolve(f).toLowerCase(), textos[id] as string]));

// Somente esta fixture versionada acompanha o mapa; saves arbitrários continuam
// sujeitos às recusas de produção e o arquivo do operador nunca é regravado.
const mapaDaOrigem = JSON.parse(original(ARQ['mapa'] as string, 'utf8')) as { id: string; largura: number; altura: number };
const mapaDoDestino = JSON.parse(textos['mapa'] as string) as typeof mapaDaOrigem;
const fixture = resolve('saves/teste-operador-vila-pronta.txt');
porCaminho.set(fixture.toLowerCase(), fixtureSaveTransladado(original(fixture, 'utf8'),
  { ...mapaDaOrigem, hash: hashDeTexto(JSON.stringify(mapaDaOrigem)) },
  { ...mapaDoDestino, hash: hashDeTexto(JSON.stringify(mapaDoDestino)) }, k));

function chave(caminho: unknown): string | null {
  if (typeof caminho === 'string') return resolve(caminho).toLowerCase();
  if (caminho instanceof URL && caminho.protocol === 'file:') return resolve(fileURLToPath(caminho)).toLowerCase();
  return null;
}

const transladado = function (this: unknown, caminho: unknown, opcoes?: unknown): string | Buffer {
  const c = chave(caminho);
  const texto = c === null ? undefined : porCaminho.get(c);
  if (texto === undefined) return (original as (...a: unknown[]) => string | Buffer).call(fs, caminho, opcoes);
  const codificacao = typeof opcoes === 'string' ? opcoes : (opcoes as { encoding?: string } | undefined)?.encoding;
  return codificacao ? texto : Buffer.from(texto, 'utf8');
};
fs.readFileSync = transladado as typeof fs.readFileSync;
syncBuiltinESMExports();

// O mundo VERSIONADO, para `F18c-1c-mundo-transladado.test.ts` conferir que a
// troca aconteceu: plugin que nao casa caminho vira no-op, e a corrida passaria
// por vacuidade.
const mapa = JSON.parse(original(ARQ['mapa'] as string, 'utf8')) as { largura: number; altura: number };
const economia = JSON.parse(original(ARQ['economia'] as string, 'utf8')) as {
  estadoInicial: { predios: { id: string; gx: number; gy: number }[] };
};
process.env['CANGACO_MUNDO_VERSIONADO'] = JSON.stringify({
  k,
  largura: mapa.largura,
  altura: mapa.altura,
  predios: economia.estadoInicial.predios,
});
