import timeJson from '../../../data/time.json';
import buildingsJson from '../../../data/buildings.json';
import productionJson from '../../../data/production.json';
import unitsJson from '../../../data/units.json';
import combatJson from '../../../data/combat.json';
import conditionJson from '../../../data/condition.json';
import deliveryJson from '../../../data/delivery.json';
import terrainJson from '../../../data/terrain.json';
import economyJson from '../../../data/economy.json';
// F-T2a — regime e rendimento dos recursos naturais. ONDE eles estao e do mapa.
import resourcesJson from '../../../data/resources.json';
// C-IA-03a — o cenario de escaramuca (a vila e a tropa iniciais da IA).
import escaramucaJson from '../../../data/escaramuca.json';
// I-CLIMA-ESTACAO — o ciclo das estacoes e o efeito no crescimento.
import climaJson from '../../../data/clima.json';
// I-PRODUCAO-ACUDE-AGUA — a agua do Acude e a irrigacao.
import acudeJson from '../../../data/acude.json';
// F-T1 — a camada de terreno base. Um arquivo por mapa; o jogo carrega ESTE, e
// `tools/gerar-mapa.js` e quem o emite (autoria, nunca runtime).
import mapaSertaoJson from '../../../data/maps/sertao-128.json';
// I-TERRENO-FASE-NA-SIM — os numeros da missao e as dez fases da campanha, em ordem. Cada fase traz o
// proprio mapa; quem o poe no lugar do sertao-128 e o `dadosDaFase` (src/sim/fase.ts).
import missaoJson from '../../../data/missao.json';
import fase01Json from '../../../data/campanha/fase-01-pianco.json';
import fase02Json from '../../../data/campanha/fase-02-patos.json';
import fase03Json from '../../../data/campanha/fase-03-soledade.json';
import fase04Json from '../../../data/campanha/fase-04-boqueirao.json';
import fase05Json from '../../../data/campanha/fase-05-campina-grande.json';
import fase06Json from '../../../data/campanha/fase-06-areia.json';
import fase07Json from '../../../data/campanha/fase-07-itabaiana.json';
import fase08Json from '../../../data/campanha/fase-08-santa-rita.json';
import fase09Json from '../../../data/campanha/fase-09-joao-pessoa.json';
import fase10Json from '../../../data/campanha/fase-10-cabedelo.json';

// theme-sertao.json fica de fora deliberadamente. CLAUDE.md 9: sim/ nunca le
// o arquivo de tema — ele alimenta so a tela e o pipeline de arte. Reforcado
// em eslint.config.mjs (no-restricted-imports em src/sim/**/*.ts).

/**
 * Os arquivos crus, ja parseados pelo `resolveJsonModule` do
 * TypeScript — os tipos vem direto do JSON, entao um campo renomeado em
 * `data/` quebra o `typecheck` aqui, nao silenciosamente em tempo de
 * execucao.
 *
 * O carregador (`loader.ts`) confia nesse formato sem revalidar: `npm run
 * verify` roda `validate:data` antes de `test`, entao dado invalido nunca
 * chega aqui numa sessao que passou pelo portao. Rodar `npm run test`
 * sozinho, sem `validate:data` antes, nao tem essa garantia — risco
 * conhecido, registrado em PROGRESS.md.
 */
export const rawGameData = {
  time: timeJson,
  buildings: buildingsJson,
  production: productionJson,
  units: unitsJson,
  combat: combatJson,
  condition: conditionJson,
  delivery: deliveryJson,
  terrain: terrainJson,
  economy: economyJson,
  resources: resourcesJson,
  escaramuca: escaramucaJson,
  clima: climaJson,
  acude: acudeJson,
  mapa: mapaSertaoJson,
  missao: missaoJson,
  fases: [fase01Json, fase02Json, fase03Json, fase04Json, fase05Json, fase06Json, fase07Json, fase08Json, fase09Json, fase10Json],
};

export type RawGameData = typeof rawGameData;
