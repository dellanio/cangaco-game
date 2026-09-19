/**
 * Congela em profundidade. `Object.freeze` sozinho so trava a raiz — um
 * objeto ou array aninhado continua mutavel. Usado pelo `gameData` singleton
 * (src/sim/data/index.ts): sem isto, `gameData.predios[0]` ou
 * `gameData.conversoes` ficariam graváveis, e um sistema que escrevesse ali
 * contaminaria todo mundo que importa `gameData`, quebrando o determinismo
 * sem deixar rastro.
 *
 * Promovido de tests/helpers/determinism.ts (F02) para utilitario de
 * producao na F03 — o teste de determinismo agora importa daqui em vez de
 * manter copia propria.
 */
export function deepFreeze<T>(valor: T): T {
  if (valor === null || typeof valor !== 'object') return valor;
  for (const chave of Object.getOwnPropertyNames(valor)) {
    deepFreeze((valor as Record<string, unknown>)[chave]);
  }
  return Object.freeze(valor);
}
