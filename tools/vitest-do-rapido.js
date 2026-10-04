'use strict';
// BUG-VERIFY-RAPIDO-LINHA-LONGA: como o `verify:rapido` chama o vitest. Regra pura; o script
// `scripts/verify-rapido.js` pergunta aqui e roda o que voltar com `spawnSync(programa, args)`, sem
// shell. Pelo shell, o `cmd.exe` corta a linha em ~8 191 caracteres; sem ele, o Windows aceita 32 767.

/** Abaixo do limite do Windows para a linha de um processo (32 767), com folga para o caminho do node. */
const TETO_DA_LINHA = 30000;

/** Separa um comando em palavras, respeitando aspas duplas (`node "C:\a b\x.js"`). */
function palavras(comando) {
  return (String(comando).match(/"[^"]*"|\S+/g) ?? []).map((p) => p.replace(/^"|"$/g, ''));
}

/** O programa e os argumentos fixos do vitest: o `CANGACO_VITEST`, ou o node rodando o `vitest.mjs`. */
function comandoDoVitest(cangacoVitest, execPath, vitestMjs) {
  return cangacoVitest ? palavras(cangacoVitest) : [execPath, vitestMjs];
}

/** O tamanho da linha que o processo recebe: as palavras, cada uma entre aspas, separadas por espaco. */
function tamanhoDaLinha(argv) {
  return argv.reduce((total, a) => total + a.length + 3, 0);
}

/**
 * O modo da corrida: `related` com a lista quando a linha cabe no teto; senao, a suite inteira, e o
 * motivo vai para o selo. Devolve o vetor inteiro (`argv[0]` e o programa).
 */
function corridaDoVitest(base, arquivos, relatorio, teto = TETO_DA_LINHA) {
  const comum = ['--run', '--passWithNoTests', '--reporter=default', '--reporter=json', `--outputFile.json=${relatorio}`];
  const related = [...base, 'related', ...comum, ...arquivos];
  const tamanho = tamanhoDaLinha(related);
  if (tamanho <= teto) return { modo: 'related', argv: related, tamanho };
  return {
    modo: 'suite-inteira', argv: [...base, 'run', ...comum.slice(1)], tamanho,
    motivo: `a lista de ${arquivos.length} arquivo(s) daria ${tamanho} caracteres, acima do teto de ${teto}`,
  };
}

module.exports = { TETO_DA_LINHA, palavras, comandoDoVitest, tamanhoDaLinha, corridaDoVitest };
