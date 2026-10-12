/** Limita processos, nunca os testes executados nem seus prazos. */
export function workersDosTestes(valor) {
  if (valor === undefined) return '50%';
  if (!/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
    throw new Error('CANGACO_TEST_WORKERS deve ser um inteiro positivo');
  }
  return Number(valor);
}
