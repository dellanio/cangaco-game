// F18c-1c — a suite roda uma segunda vez num MUNDO TRANSLADADO de +K: mapa com
// faixa de grama a oeste e ao norte, recursos, vila e ponto de nascimento
// andando juntos (`tools/transladar-mundo.js`, `transladarTextos`). Toda
// distancia relativa fica igual; so reprova quem escreveu coordenada absoluta.
//
// Nada e escrito em `data/`. O plugin troca o texto dos tres JSON quando entram
// por `import`; `tests/helpers/mundo-transladado.ts` troca o que `fs.readFileSync`
// devolve, no processo do teste. Subprocesso (`npm run sim`) le o disco e ve o
// mundo versionado — por isso esta em FORA_DO_MUNDO_TRANSLADADO.
//
// Custo aceito pelo operador (2026-09-26): ~55 s a mais no verify. Se o verify
// inteiro passar de TRES MINUTOS, o operador revê. Numero de relogio: fica no
// PROGRESS, nunca em asserção (CLAUDE.md §8).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig, mergeConfig, type Plugin } from 'vitest/config';
import base from './vitest.config.mts';

const require = createRequire(import.meta.url);
const { ARQ, transladarTextos } = require('./tools/transladar-mundo.js') as {
  ARQ: Record<string, string>;
  transladarTextos: (originais: Record<string, string>, k: number) => Record<string, string>;
};

const K = 32;

const textos = transladarTextos(
  Object.fromEntries(Object.entries(ARQ).map(([id, f]) => [id, readFileSync(f, 'utf8')])),
  K,
);
const porCaminho = new Map(Object.entries(ARQ).map(([id, f]) => [resolve(f).toLowerCase(), textos[id]]));

const mundoTransladado: Plugin = {
  name: 'cangaco-mundo-transladado',
  enforce: 'pre',
  load(id) {
    return porCaminho.get(resolve(id.split('?')[0] ?? id).toLowerCase()) ?? null;
  },
};

/**
 * Os testes que NAO podem passar num mundo transladado, pelo que afirmam — nao
 * por literal. Nome completo (describe > it, o separador do vitest 5); nome que mudar volta a rodar e
 * reprova alto, nunca some calado. Todos continuam rodando na suite normal.
 */
const FORA_DO_MUNDO_TRANSLADADO = [
  // LIMITACAO DO MECANISMO, nao escolha: o subprocesso le data/ do disco e ve o
  // mundo versionado, e o teste compara com o gameData transladado. Se um dia a
  // troca passar por variavel de ambiente que o subprocesso herde, ele volta.
  'F05a — npm run sim, ponta a ponta > npm run sim -- inicial --ticks 0 imprime os valores da tabela e sai 0',
  // CONTRATO DO ARQUIVO PUBLICADO, fora de vez (decisao do operador, 2026-09-26):
  // - o gerador emite, byte a byte, o arquivo versionado (determinismo do gerador)
  'F-D3 — mesma semente, mesmo mapa (aceite 3) > o que a semente emite hoje e, byte a byte, o arquivo versionado',
  // - o gerador emite, byte a byte, o relevo versionado (D-TERRENO-ALTURA, aprovado pelo operador
  //   em 2026-09-30 pela mesma regra do F-D3 de 2026-09-26: contrato do arquivo publicado, nao do
  //   mundo). O gerador ve o mapa andado de +K e o `.relevo.json` do disco continua 129 x 129. As
  //   guardas do relevo que nao comparam com o disco continuam rodando aqui.
  'D-TERRENO-ALTURA — o arquivo publicado > o que a semente emite hoje e, byte a byte, o arquivo versionado',
  // - o tamanho publicado e a area x4 da Fase A
  'F18b — o mapa publicado > data/terrain.json publica 128x128, e o render espelha',
  'F18b — o mapa publicado > a area jogavel quadruplicou em relacao ao 64x64 da Fase A',
];

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default mergeConfig(base, defineConfig({
  plugins: [mundoTransladado],
  test: {
    setupFiles: ['tests/helpers/mundo-transladado.ts'],
    testNamePattern: new RegExp(`^(?!(?:${FORA_DO_MUNDO_TRANSLADADO.map(escapar).join('|')})$)`),
    env: {
      CANGACO_TRANSLADO_K: String(K),
      // A evidencia desta corrida tem numero de outro mundo: nao sobrescreve a da suite.
      CANGACO_EVIDENCIA_DIR: 'test-output/transladado',
    },
  },
}));
