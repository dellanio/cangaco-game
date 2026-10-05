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
 *
 * A FORMA (F-T4b, decisao do operador em 2026-09-25): dois grupos em volta do
 * armazem, nao uma fila so. A fila unica era conveniencia do cenario, nao
 * design — e, medida, ela punha os dois lenhadores a 14 tiles da arvore mais
 * proxima, com alcance de colheita 6: eles nunca produziam tora.
 *
 *   - o GRUPO DA PEDRA (serraria + pedreira) fica a oeste, na linha de porta do
 *     armazem, recuando ate caber (BUG-F). A pedreira encosta no lajedo, que e o
 *     unico lugar perto com rocha.
 *   - o GRUPO DA MATA (os dois lenhadores) fica na linha ACIMA do armazem e
 *     VARRE PARA LESTE, ate a posicao com mais mata ao alcance dos dois. A mata
 *     do mapa publicado esta a nordeste.
 *   - a rua e a reta de sempre MAIS um ramo em L ligando a porta do par.
 *
 * Nenhuma coordenada e digitada: tudo sai dos predicados. Se o mapa mudar, a
 * vila nasce noutro lugar sozinha — e se nao houver lugar com mata ao alcance,
 * este modulo LANCA, porque ai quem tem de ajustar e o gerador, nao a vila.
 */

/** Os lenhadores, que precisam de MATA ao alcance. */
export const GRUPO_DA_MATA = ['woodcutters', 'woodcutters'];
/** Serraria e pedreira: a pedreira e quem precisa da ROCHA, e a serraria mora
 *  junto porque o tronco vai dela para o armazem. */
export const GRUPO_DA_PEDRA = ['sawmill', 'quarry'];
/**
 * Os predios do aceite (BUILD_PLAN F17, GDD §1.3), na ordem em que entram na
 * fila de treino. Nao e numero de balanceamento: e a lista que o criterio nomeia.
 */
export const TIPOS_DA_ABERTURA = [...GRUPO_DA_MATA, ...GRUPO_DA_PEDRA];

function caixa(gx, gy, { largura, altura }) {
  return { x0: gx, y0: gy, x1: gx + largura - 1, y1: gy + altura - 1 };
}

/** Chebyshev de caixa a caixa: 0 quando elas se tocam ou se cruzam. E a mesma
 *  conta que `alcance_tiles` usa na sim (distancia do FOOTPRINT ao tile). */
function distanciaEntreCaixas(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return Math.max(dx, dy);
}

function alturaUnicaDe(tipos, tamanhoDe, ondeEstou) {
  const alturas = [...new Set(tipos.map((t) => tamanhoDe(t).altura))];
  if (alturas.length !== 1) {
    // Invariante de FORMA, nao numero magico: com alturas diferentes o grupo
    // deixaria de ter um `gy` so e a rua nao serviria a porta de todos.
    throw new Error(
      `abertura: ${ondeEstou} exige altura igual em todos, veio ${JSON.stringify(alturas)}`,
    );
  }
  return alturas[0];
}

function larguraTotalDe(tipos, tamanhoDe, vao = 0) {
  return tipos.reduce((s, t) => s + tamanhoDe(t).largura, 0) + vao * (tipos.length - 1);
}

function retanguloLivre(x0, y0, largura, altura, bloqueia) {
  for (let gy = y0; gy < y0 + altura; gy += 1) {
    for (let gx = x0; gx < x0 + largura; gx += 1) {
      if (bloqueia(gx, gy)) return false;
    }
  }
  return true;
}

/** Enfileira os tipos a partir de `x0`, na horizontal, com `vao` tiles entre eles
 *  (I-OBRA-UM-TILE-ENTRE-PREDIOS: o lote nao encosta em outro lote, como no KaM). */
function enfileirar(tipos, x0, gy, tamanhoDe, vao = 0) {
  let x = x0;
  return tipos.map((tipo) => {
    const planta = { tipo, gx: x, gy };
    x += tamanhoDe(tipo).largura + vao;
    return planta;
  });
}

function grupoCabe(tipos, x0, gy, tamanhoDe, bloqueia, vao = 0) {
  return enfileirar(tipos, x0, gy, tamanhoDe, vao).every((p) => {
    const { largura, altura } = tamanhoDe(p.tipo);
    return retanguloLivre(p.gx, p.gy, largura, altura, bloqueia);
  });
}

/** Quantos tiles de mata este footprint alcanca. */
function mataAoAlcance(p, tamanhoDe, temArvore, alcance) {
  const c = caixa(p.gx, p.gy, tamanhoDe(p.tipo));
  let n = 0;
  for (let gy = c.y0 - alcance; gy <= c.y1 + alcance; gy += 1) {
    for (let gx = c.x0 - alcance; gx <= c.x1 + alcance; gx += 1) {
      if (temArvore(gx, gy)) n += 1;
    }
  }
  return n;
}

/**
 * A abertura: onde cada planta nasce e por onde passa a rua.
 *
 * @param {object} e Entrada. Nada aqui e lido de arquivo: quem chama injeta.
 * @param {{gx:number,gy:number,largura:number,altura:number}} e.armazem
 * @param {{gx:number,gy:number,largura:number,altura:number}} e.escola
 * @param {(tipo:string)=>{largura:number,altura:number}} e.tamanhoDe
 * @param {(gx:number,gy:number)=>boolean} e.bloqueia recurso que recusa obra E estrada
 * @param {(gx:number,gy:number)=>boolean} e.temArvore tile de mata
 * @param {number} e.alcanceDaMata o `colheita.alcance` do lenhador, lido do dado
 * @param {(tipo:string)=>number} e.stoneDe custo em pedra de um predio
 * @param {number} e.estoqueInicialDeStone pedra no armazem no tick 0
 * @param {number} e.custoStonePorTile pedra por tile de estrada
 * @param {number} [e.vaoEntrePredios] o vao minimo entre lotes (I-OBRA-UM-TILE-ENTRE-PREDIOS)
 */
export function geometriaDaAbertura({
  armazem,
  escola,
  tamanhoDe,
  bloqueia,
  temArvore,
  alcanceDaMata,
  stoneDe,
  estoqueInicialDeStone,
  custoStonePorTile,
  vaoEntrePredios = 0,
}) {
  const vao = vaoEntrePredios;
  const yRua = armazem.gy + armazem.altura;
  // A rua tem que passar pela porta da ESCOLA tambem: sem estrada ate ela o ouro
  // do treino nao chega e a fila fica em `sem-estrada` para sempre (F13b) — os
  // predios sobem e ninguem os ocupa.
  if (escola.gy + escola.altura !== yRua) {
    throw new Error('abertura: esta geometria assume armazem e escola na MESMA linha de porta');
  }
  if (!Number.isInteger(alcanceDaMata) || alcanceDaMata < 1) {
    throw new Error(`abertura: alcanceDaMata tem de vir do dado, veio ${String(alcanceDaMata)}`);
  }

  // ---- grupo da pedra: encosta no armazem e RECUA ate caber -----------------
  // BUG-F (2026-09-24): encostado no armazem, o grupo cai no lajedo da vila, e
  // rocha recusa construcao. Recua por PREDICADO, nunca por x digitado — e por
  // isso que a pedreira acaba colada no lajedo, alcancando a rocha dele.
  const alturaDaPedra = alturaUnicaDe(GRUPO_DA_PEDRA, tamanhoDe, 'o grupo da pedra');
  const gyDaPedra = yRua - alturaDaPedra;
  const larguraDaPedra = larguraTotalDe(GRUPO_DA_PEDRA, tamanhoDe, vao);
  let xDaPedra = armazem.gx - larguraDaPedra - vao;
  while (xDaPedra >= 0 && !grupoCabe(GRUPO_DA_PEDRA, xDaPedra, gyDaPedra, tamanhoDe, bloqueia, vao)) {
    xDaPedra -= 1;
  }
  if (xDaPedra < 0) {
    throw new Error(
      'abertura: o grupo da pedra nao cabe a oeste do armazem sem pisar em recurso que bloqueia construcao',
    );
  }
  const plantasDaPedra = enfileirar(GRUPO_DA_PEDRA, xDaPedra, gyDaPedra, tamanhoDe, vao);

  // ---- grupo da mata: varre para LESTE na linha acima do armazem ------------
  const alturaDaMata = alturaUnicaDe(GRUPO_DA_MATA, tamanhoDe, 'o grupo da mata');
  const yPortaDoPar = armazem.gy - 1;
  const gyDaMata = yPortaDoPar - alturaDaMata;
  const larguraDaMata = larguraTotalDe(GRUPO_DA_MATA, tamanhoDe, vao);
  const caixaDoArmazem = caixa(armazem.gx, armazem.gy, armazem);
  if (gyDaMata < 0) throw new Error('abertura: nao ha linha acima do armazem para o grupo da mata');

  let escolhido = null;
  for (let gx = armazem.gx; ; gx += 1) {
    const daVez = caixa(gx, gyDaMata, { largura: larguraDaMata, altura: alturaDaMata });
    const distancia = distanciaEntreCaixas(daVez, caixaDoArmazem);
    // O par mora DENTRO do proprio alcance de colheita, contado do armazem: e o
    // que mantem a vila junta sem limiar digitado. Passou disso, para a varredura.
    if (distancia > alcanceDaMata) break;
    if (!grupoCabe(GRUPO_DA_MATA, gx, gyDaMata, tamanhoDe, bloqueia, vao)) continue;
    // A linha de porta do par tem de aceitar ESTRADA na largura toda: arvore
    // bloqueia estrada igual bloqueia obra, e porta sem rua e predio que
    // ninguem ocupa (F13b).
    if (!retanguloLivre(gx, yPortaDoPar, larguraDaMata, 1, bloqueia)) continue;
    const plantas = enfileirar(GRUPO_DA_MATA, gx, gyDaMata, tamanhoDe, vao);
    const arvores = plantas.map((p) => mataAoAlcance(p, tamanhoDe, temArvore, alcanceDaMata));
    const minimo = Math.min(...arvores);
    if (minimo < 1) continue;
    // Escolhe MAXIMIZANDO a mata do lenhador mais pobre dos dois — assim nao ha
    // limiar ("pelo menos 5 arvores") digitado em lugar nenhum. Empate: o mais
    // perto do armazem; empate de novo: o mais a oeste.
    const candidato = { gx, plantas, arvores, minimo, distancia };
    if (
      escolhido === null ||
      candidato.minimo > escolhido.minimo ||
      (candidato.minimo === escolhido.minimo && candidato.distancia < escolhido.distancia)
    ) {
      escolhido = candidato;
    }
  }
  if (escolhido === null) {
    throw new Error(
      'abertura: nao ha posicao para o par de lenhadores com mata ao alcance dos dois, perto do armazem. ' +
        'Quem ajusta nesse caso e o GERADOR DE MAPA, nao a vila: a abertura precisa de mato, rocha e ' +
        'terra ao alcance sem o jogador procurar.',
    );
  }
  const plantasDaMata = escolhido.plantas;

  // ---- a rua: uma reta na linha de porta, mais o ramo em L ate o par -------
  // O que LIGA um predio e UMA porta dele ser estrada e estar no componente do
  // armazem (`predioLigadoAoArmazem`) — nao a largura inteira do footprint. A
  // rua da abertura e mínima de proposito, porque o estoque inicial de pedra e
  // curto e a rua o come antes da pedreira: a versao larga custou 31 tiles contra
  // 30 de pedra e (ate a F18g) o comando saiu `sem-pedra`, com a vila inteira
  // parada (medido na F-T4b); desde a F18g o mesmo excesso vira pedreira em obra
  // para sempre (ver o guarda abaixo). Comeca no ULTIMO tile de porta do primeiro
  // predio da pedra e vai ate a primeira porta da escola.
  const rua = [];
  const vistos = new Set();
  const por = (gx, gy) => {
    const k = `${gx},${gy}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    rua.push({ gx, gy });
  };
  // Onde a reta bate em recurso que a estrada recusa (a rocha do lajedo), desce
  // UM tile e volta: buraco partiria a rede em dois componentes, e o desvio nao,
  // porque diagonal conta como ligado (F-T2b).
  const xInicioDaReta = plantasDaPedra[0].gx + tamanhoDe(plantasDaPedra[0].tipo).largura - 1;
  for (let gx = xInicioDaReta; gx <= escola.gx; gx += 1) {
    por(gx, bloqueia(gx, yRua) ? yRua + 1 : yRua);
  }

  // O ramo: uma coluna livre a LESTE do armazem (entre ele e a escola) sobe da
  // rua principal ate a linha de porta do par, e la corre o bastante para tocar
  // uma porta de CADA lenhador. Estrada em L existe desde a F08 e o arrasto
  // interpola — nao e mecanismo novo.
  const primeiraColunaLivre = () => {
    for (let gx = armazem.gx + armazem.largura; gx < escola.gx; gx += 1) {
      let livre = true;
      for (let gy = yPortaDoPar; gy <= yRua; gy += 1) if (bloqueia(gx, gy)) livre = false;
      if (livre) return gx;
    }
    return null;
  };
  const xDoRamo = primeiraColunaLivre();
  if (xDoRamo === null) {
    throw new Error('abertura: nao ha coluna livre entre o armazem e a escola para o ramo da rua');
  }
  for (let gy = yPortaDoPar; gy <= yRua; gy += 1) por(xDoRamo, gy);
  const ultimoDaMata = plantasDaMata[plantasDaMata.length - 1];
  for (
    let gx = Math.min(xDoRamo, plantasDaMata[0].gx);
    gx <= Math.max(xDoRamo, ultimoDaMata.gx);
    gx += 1
  ) {
    por(gx, yPortaDoPar);
  }

  // A rua e as duas obras do arranque CABEM no estoque inicial? O que tem de
  // sobrar da rua e a primeira casa de lenhador (que desbloqueia a serraria) e a
  // PEDREIRA, que e quem produz a pedra de todo o resto.
  //
  // Ate a F18g o comando era tudo ou nada, pago a vista no tick 0, e o sintoma de
  // nao caber era `sem-pedra` com a vila parada. Desde a F18g (2026-09-25) a
  // pedra viaja por tile e o comando NAO recusa mais — mas o guarda continua
  // guarda, porque o sintoma virou TRAVAMENTO: a rua se assenta com toda pedra que
  // aparece (a carga dela e nivel 8, mas nasce antes de a obra nivelar e pedir o
  // material dela), e a pedreira fica em obra para sempre. MEDIDO na F18g, com a
  // rua de 26 tiles: 27 de pedra fecha a Fase A (serraria ligada no tick 2691),
  // 26 trava (23 tiles de pe, pedreira e segunda casa em obra aos 12 000 ticks).
  // A conta abaixo (rua + 4) e PESSIMISTA por 3 em relacao a esse limiar — de
  // proposito: o limiar de 1 e de ordem de tick (a obra da pedreira ganha a
  // corrida por uma pedra), e um guarda no fio da navalha nao e guarda.
  const reserva = stoneDe(GRUPO_DA_MATA[0]) + stoneDe(GRUPO_DA_PEDRA[GRUPO_DA_PEDRA.length - 1]);
  const custoDaRua = rua.length * custoStonePorTile;
  if (custoDaRua + reserva > estoqueInicialDeStone) {
    // A mensagem carrega a MEDIDA dos dois lados, porque quem esbarrar nisto
    // daqui a cinco features precisa saber se falta pedra ou sobra distancia:
    // sem os dois numeros, "nao coube" nao diz qual dos dois mexer.
    const excesso = custoDaRua + reserva - estoqueInicialDeStone;
    throw new Error(
      `abertura: a rua comeria a pedra das obras do arranque. A rua precisa de ${rua.length} tiles ` +
        `a ${custoStonePorTile} de pedra = ${custoDaRua}; o estado inicial tem ` +
        `${estoqueInicialDeStone} de pedra; a reserva de ${reserva} (${GRUPO_DA_MATA[0]} + ` +
        `${GRUPO_DA_PEDRA[GRUPO_DA_PEDRA.length - 1]}) tem de sobrar, porque e o que sobe ` +
        'antes de existir producao de pedra — desde a F18g a rua nao e recusada, ela e ' +
        `assentada com a pedra que a pedreira precisava, e a vila trava. Faltam ${excesso} de pedra, ou seja ` +
        `${Math.ceil(excesso / custoStonePorTile)} tiles de rua a menos — ou mais pedra em ` +
        'data/economy.json (estadoInicial.estoque.stone).',
    );
  }

  return {
    yRua,
    yPortaDoPar,
    plantas: [...plantasDaMata, ...plantasDaPedra],
    mataAoAlcanceDoPar: escolhido.arvores,
    rua,
  };
}
