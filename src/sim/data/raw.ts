import timeJson from '../../../data/time.json';
import buildingsJson from '../../../data/buildings.json';
import productionJson from '../../../data/production.json';
import unitsJson from '../../../data/units.json';
import combatJson from '../../../data/combat.json';
import conditionJson from '../../../data/condition.json';
import deliveryJson from '../../../data/delivery.json';
import terrainJson from '../../../data/terrain.json';
import economyJson from '../../../data/economy.json';

// theme-sertao.json fica de fora deliberadamente. CLAUDE.md 9: sim/ nunca le
// o arquivo de tema — ele alimenta so a tela e o pipeline de arte. Reforcado
// em eslint.config.mjs (no-restricted-imports em src/sim/**/*.ts).

/**
 * Os nove arquivos crus, ja parseados pelo `resolveJsonModule` do
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
};

export type RawGameData = typeof rawGameData;
