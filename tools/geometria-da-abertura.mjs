/**
 * A GEOMETRIA DA ABERTURA DA FASE A — escrita UMA vez, consumida por dois lados.
 *
 * Quem consome:
 *   - `tests/helpers/abertura.ts` (TS estrito, ESM) — liga os predicados na sim;
 *   - `tools/shots/F17.js` (CommonJS, Playwright) — liga os predicados nos JSON,
 *     por `await import('../geometria-da-abertura.mjs')`.
 *
 * Ate a F-T4b esta derivacao existia ESCRITA A MAO nos dois arquivos. Enquanto a
 * abertura era uma fila reta dava para manter as duas copias identicas de olho;
 * com dois grupos e rua em L, nao da — e a divergencia apareceria como o roteiro
 * clicando num tile e o headless plantando noutro. Por isso este modulo nao le
 * arquivo nenhum e nao conhece a sim: ele recebe PREDICADOS e devolve tiles. Ler
 * o dado continua sendo problema de cada lado (`caixaDeTipo` la, `_recursos.js` ca).
 *
 * `.mjs` e nao `.ts` nem `.js`: medido na F-T4b, nesta arvore — o vitest importa
 * este arquivo a partir de um teste TS e o `tsc --noEmit` aceita por causa do
 * `.d.mts` ao lado (o tsconfig nao tem `allowJs` e nao inclui `tools/`); o roteiro
 * CommonJS carrega com `await import()`. Um `.js` CJS quebraria do lado do vitest,
 * que trata `.js` local como ESM e perderia o `module.exports`.
 *
 * ---------------------------------------------------------------------------
 * ARMADILHA DA VARREDURA (F-T4b, 2026-09-25). Se voce vier medir "onde a
 * abertura cabe", NAO pergunte `canPlace(...).ok`. `sawmill.desbloqueadoPor =
 * woodcutters`, entao no tick 0 a serraria responde `{ok:false,
 * motivo:'bloqueado'}` em QUALQUER tile do mapa, e a varredura devolve ZERO
 * posicoes — que parece "nao existe lugar" quando o que houve foi a pergunta
 * errada. Custou uma rodada: 14 720 posicoes varridas, zero aprovadas, com a
 * fila de hoje existindo e funcionando na tela. Pergunte pelo recurso que
 * bloqueia (`recursoBloqueiaConstrucao`, que e o predicado `bloqueia` daqui), ou
 * aceite `motivo !== 'bloqueado'`.
 * ---------------------------------------------------------------------------
 */

/**
 * Os predios do aceite (BUILD_PLAN F17, GDD §1.3). Nao e numero de
 * balanceamento: e a lista que o criterio nomeia.
 */
export const TIPOS_DA_ABERTURA = ['woodcutters', 'woodcutters', 'sawmill', 'quarry'];

/**
 * A abertura: onde cada planta nasce e por onde passa a rua.
 *
 * @param {object} e Entrada. Nada aqui e lido de arquivo: quem chama injeta.
 * @param {{gx:number,gy:number,largura:number,altura:number}} e.armazem
 * @param {{gx:number,gy:number,largura:number,altura:number}} e.escola
 * @param {(tipo:string)=>{largura:number,altura:number}} e.tamanhoDe
 * @param {(gx:number,gy:number)=>boolean} e.bloqueia recurso que recusa obra E estrada
 */
export function geometriaDaAbertura({ armazem, escola, tamanhoDe, bloqueia }) {
  const yRua = armazem.gy + armazem.altura;
  // A rua tem que passar pela porta da ESCOLA tambem: sem estrada ate ela o ouro
  // do treino nao chega e a fila fica em `sem-estrada` para sempre (F13b) — os
  // predios sobem e ninguem os ocupa.
  if (escola.gy + escola.altura !== yRua) {
    throw new Error('abertura: esta geometria assume armazem e escola na MESMA linha de porta');
  }

  // Fila unica so fecha se os quatro tiverem a MESMA altura: com alturas
  // diferentes, `gy` deixaria de ser um so e a rua nao serviria todos. E
  // invariante de forma, nao numero magico.
  const alturas = [...new Set(TIPOS_DA_ABERTURA.map((t) => tamanhoDe(t).altura))];
  if (alturas.length !== 1) {
    throw new Error(`abertura: a fila unica exige altura igual nos quatro, veio ${JSON.stringify(alturas)}`);
  }
  const altura = alturas[0];
  const larguraTotal = TIPOS_DA_ABERTURA.reduce((s, t) => s + tamanhoDe(t).largura, 0);
  const gyDaFila = yRua - altura;

  // BUG-F (2026-09-24): encostada no armazem a fila cai no lajedo da vila, e
  // rocha recusa construcao. O comeco RECUA para oeste ate caber — por predicado,
  // NUNCA por x digitado. E por isso que a vila abre a oeste do lajedo.
  const filaCabe = (x0) => {
    let x = x0;
    for (const tipo of TIPOS_DA_ABERTURA) {
      const { largura, altura: alt } = tamanhoDe(tipo);
      for (let gy = gyDaFila; gy < gyDaFila + alt; gy += 1) {
        for (let gx = x; gx < x + largura; gx += 1) {
          if (bloqueia(gx, gy)) return false;
        }
      }
      x += largura;
    }
    return true;
  };
  let inicio = armazem.gx - larguraTotal;
  while (inicio >= 0 && !filaCabe(inicio)) inicio -= 1;
  if (inicio < 0) {
    throw new Error('abertura: a fila nao cabe a oeste do armazem sem pisar em recurso que bloqueia construcao');
  }

  let x = inicio;
  const plantas = TIPOS_DA_ABERTURA.map((tipo) => {
    const planta = { tipo, gx: x, gy: gyDaFila };
    x += tamanhoDe(tipo).largura;
    return planta;
  });

  // Uma reta, da ponta esquerda da fila ate o primeiro tile de porta da escola: e
  // o tracado mais barato em pedra que liga as quatro obras, o armazem e a escola
  // na mesma rede. Onde a reta bate em recurso que a estrada recusa (a rocha em
  // 24,33), desce UM tile e volta: a rede continua um componente so, porque tile
  // na diagonal conta como ligado (F-T2b), e um buraco na reta nao contaria.
  const rua = [];
  for (let gx = plantas[0].gx; gx <= escola.gx; gx += 1) {
    rua.push({ gx, gy: bloqueia(gx, yRua) ? yRua + 1 : yRua });
  }

  return { yRua, gyDaFila, plantas, rua };
}
