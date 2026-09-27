#!/usr/bin/env node
'use strict';

// validarTudo(dados) — puro: recebe os nove arquivos ja parseados (sem
// theme-sertao.json, CLAUDE.md 9) e devolve string[] de erros (vazio =
// valido). tools/validate-data.js (CLI) e o teste de F03 importam esta
// mesma funcao — uma fonte de verdade, nunca duas copias divergentes.

const {
  CAMPOS_ESCALONADOS, DECLARACOES_ESTRUTURAIS, NAO_SAO_DURACAO, PREFIXO_DE_MAPA,
  bateNomeDeTempo,
} = require('./data-schema');

function getByPath(obj, caminho) {
  const partes = caminho.split('.');
  let atual = obj;
  for (const parte of partes) {
    if (atual === null || typeof atual !== 'object' || !(parte in atual)) {
      return { existe: false, valor: undefined };
    }
    atual = atual[parte];
  }
  return { existe: true, valor: atual };
}

function validarForma(dados, erros) {
  if (!Array.isArray(dados.buildings && dados.buildings.predios)) {
    erros.push('forma/buildings: buildings.predios precisa ser array');
  }
  if (typeof (dados.time && dados.time.tickHz) !== 'number') {
    erros.push('forma/time: time.tickHz precisa ser number');
  }
  if (!dados.time || typeof dados.time.escalas !== 'object' || dados.time.escalas === null) {
    erros.push('forma/time: time.escalas precisa existir');
  }
  if (!dados.production || typeof dados.production.predios !== 'object') {
    erros.push('forma/production: production.predios precisa existir');
  }
  if (!dados.units || !dados.units.civis || !Array.isArray(dados.units.civis.tipos)) {
    erros.push('forma/units: units.civis.tipos precisa ser array');
  }
  if (!dados.terrain || typeof dados.terrain.custoDeMovimento !== 'object') {
    erros.push('forma/terrain: terrain.custoDeMovimento precisa existir');
  }
  if (!dados.economy || typeof dados.economy.estadoInicial !== 'object') {
    erros.push('forma/economy: economy.estadoInicial precisa existir');
  }
  if (!dados.resources || typeof dados.resources.tipos !== 'object') {
    erros.push('forma/resources: resources.tipos precisa existir');
  }
}

function validarPredios(dados, erros) {
  const predios = dados.buildings && dados.buildings.predios;
  if (!Array.isArray(predios)) return; // forma/* ja reportou

  if (predios.length !== 28) {
    erros.push(`predios/contagem: esperado 28 predios, achou ${predios.length}`);
  }

  const idsValidos = new Set(predios.map((p) => p.id));
  const idsDeCivis = new Set(
    ((dados.units && dados.units.civis && dados.units.civis.tipos) || []).map((t) => t.id),
  );
  const hpPorMartelada = dados.buildings && dados.buildings.construcao
    && dados.buildings.construcao.hpPorMartelada;
  const laborersMaximosPorObra = dados.buildings && dados.buildings.construcao
    && dados.buildings.construcao.laborersMaximosPorObra;
  if (!(Number.isInteger(laborersMaximosPorObra) && laborersMaximosPorObra >= 1)) {
    erros.push(`predios/laborers-maximos-por-obra: buildings.construcao.laborersMaximosPorObra=${laborersMaximosPorObra}, precisa ser inteiro >= 1`);
  }
  for (const p of predios) {
    const hpEsperado = (p.timber + p.stone) * 50;
    if (p.hp !== hpEsperado) {
      erros.push(`predios/hp: ${p.id} tem hp=${p.hp}, esperado (${p.timber}+${p.stone})*50=${hpEsperado}`);
    }
    if (typeof hpPorMartelada === 'number' && !Number.isInteger(p.hp / hpPorMartelada)) {
      erros.push(`predios/marteladas: ${p.id} tem hp=${p.hp}, nao divide inteiro por hpPorMartelada=${hpPorMartelada}`);
    }
    if (p.desbloqueadoPor !== null && !idsValidos.has(p.desbloqueadoPor)) {
      erros.push(`predios/desbloqueio-pendurado: ${p.id}.desbloqueadoPor='${p.desbloqueadoPor}' nao existe`);
    }
    if (p.trabalhador !== null && !idsDeCivis.has(p.trabalhador)) {
      erros.push(`predios/trabalhador: ${p.id}.trabalhador='${p.trabalhador}' nao existe em units.civis`);
    }
  }

  // A semente da arvore NAO e "pai nulo". E o que ja esta de pe quando a partida
  // comeca (`economy.estadoInicial.predios`) mais o que o menu inicial libera de
  // graca. O armazem da abertura vem pronto e o ADICIONAL exige Serraria (GDD
  // 5.2) — logo um predio pode ser semente e ter pai ao mesmo tempo, e a arvore
  // fica sem raiz. O que continua tendo de valer, e e o que estas duas regras
  // sempre protegeram de fato, e ALCANCE: todo predio do dado precisa ser
  // alcancavel a partir da semente, senao existe no JSON e nunca no jogo.
  const estadoInicial = (dados.economy && dados.economy.estadoInicial) || {};
  const semente = new Set([
    ...((estadoInicial.predios || []).map((p) => p.id)),
    ...(estadoInicial.menuBuildInicial || []),
  ].filter((id) => idsValidos.has(id)));
  if (semente.size === 0) {
    erros.push('predios/alcance: nenhuma semente — estadoInicial.predios e menuBuildInicial estao vazios, e entao nenhum predio pode ser construido');
  }
  const alcancados = new Set(semente);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const p of predios) {
      if (!alcancados.has(p.id) && p.desbloqueadoPor !== null && alcancados.has(p.desbloqueadoPor)) {
        alcancados.add(p.id);
        cresceu = true;
      }
    }
  }
  const inalcancaveis = predios.filter((p) => !alcancados.has(p.id)).map((p) => p.id);
  if (inalcancaveis.length > 0) {
    erros.push(`predios/alcance: ${inalcancaveis.length} predio(s) nunca desbloqueiam a partir da semente [${[...semente].join(', ')}]: ${inalcancaveis.join(', ')}`);
  }

  // Ciclo so e defeito quando NAO passa pela semente: `storehouse -> sawmill ->
  // woodcutters -> schoolhouse -> storehouse` e o dado correto de hoje, porque o
  // armazem inicial entra pela semente e quebra a volta. Um ciclo sem semente
  // nenhuma e um grupo que se tranca por fora — a regra de alcance ja o acusa,
  // e esta aqui diz POR QUE.
  const grafo = new Map(predios.map((p) => [p.id, p.desbloqueadoPor]));
  const emCicloJaReportado = new Set();
  for (const p of predios) {
    if (emCicloJaReportado.has(p.id)) continue;
    const caminho = [];
    let atual = p.id;
    while (atual !== null && atual !== undefined && grafo.has(atual)) {
      const idx = caminho.indexOf(atual);
      if (idx !== -1) {
        const ciclo = caminho.slice(idx);
        ciclo.forEach((id) => emCicloJaReportado.add(id));
        if (!ciclo.some((id) => semente.has(id))) {
          erros.push(`predios/ciclo: ciclo de desbloqueio sem semente: ${ciclo.join(' -> ')} -> ${atual}`);
        }
        break;
      }
      caminho.push(atual);
      atual = grafo.get(atual);
    }
  }
}

// F15a: o carregador nao guarda mais taxa, guarda um CICLO — periodo da taxa mais
// lenta, e quantidade = razao dos periodos, arredondada uma vez. As regras abaixo
// replicam essa derivacao e conferem que a quantidade inteira ainda representa a
// proporcao DECLARADA nas taxas. Medir sobre ticks e deliberado: e o arredondamento
// em ticks que distorce, e ele depende de `escalas.economia` — trocar a escala por
// um valor que quebre uma receita e dado ruim, e a regra tem que acusar.
const TOLERANCIA_DA_RAZAO = 0.02; // dado atual: desvio 0,00% nas 21 receitas

function periodoEmTicks(taxaPorMinuto, escala, tickHz) {
  return Math.round((60 * tickHz) / (taxaPorMinuto * escala));
}

function validarCicloDaReceita(id, def, escala, tickHz, erros) {
  const taxas = { ...((def && def.entra) || {}), ...((def && def.sai) || {}) };
  const positivas = Object.entries(taxas).filter(([, taxa]) => taxa > 0);
  // taxa nao positiva ja foi reportada; escala invalida e problema de tempo/*
  if (positivas.length === 0 || !(escala > 0) || !(tickHz > 0)) return;

  const periodos = positivas.map(([m, taxa]) => [m, periodoEmTicks(taxa, escala, tickHz)]);
  const ciclo = Math.max(...periodos.map(([, p]) => p));
  const menorTaxa = Math.min(...positivas.map(([, taxa]) => taxa));
  for (const [mercadoria, periodo] of periodos) {
    const inteira = Math.round(ciclo / periodo);
    const declarada = taxas[mercadoria] / menorTaxa;
    if (inteira < 1) {
      erros.push(`producao/quantidade-zero: production.predios.${id}.${mercadoria} rende 0 unidade por ciclo`);
    } else if (Math.abs(inteira - declarada) / declarada > TOLERANCIA_DA_RAZAO) {
      erros.push(
        `producao/razao-distorcida: production.predios.${id}.${mercadoria} vira ${inteira} por ciclo, `
        + `mas a taxa declara ${declarada.toFixed(3)} (tolerancia ${TOLERANCIA_DA_RAZAO * 100}%)`,
      );
    }
  }
}

function validarProducao(dados, erros) {
  const predios = dados.production && dados.production.predios;
  if (!predios || typeof predios !== 'object') return; // forma/* ja reportou
  const idsDePredios = new Set(
    ((dados.buildings && dados.buildings.predios) || []).map((p) => p.id),
  );
  const escalas = (dados.time && dados.time.escalas) || {};
  const escala = escalas[dados.production && dados.production.escala];
  const tickHz = dados.time && dados.time.tickHz;
  // F24a: a saida que nao e mercadoria SOME no deposito (`depositar` so conhece
  // `economia.mercadorias`). Foi assim que tres oficinas consumiam insumo e nao
  // entregavam nada, com `arma_madeira`, `arma_ferro` e `armadura_ferro`.
  const mercadorias = new Set((dados.economy && dados.economy.mercadorias) || []);
  for (const [id, def] of Object.entries(predios)) {
    if (id.startsWith('_')) continue;
    if (!idsDePredios.has(id)) {
      erros.push(`producao/predio-inexistente: production.predios.${id} nao existe em buildings.predios`);
      continue;
    }
    for (const grupo of ['entra', 'sai']) {
      for (const [mercadoria, taxa] of Object.entries((def && def[grupo]) || {})) {
        if (!(taxa > 0)) {
          erros.push(`producao/taxa-nao-positiva: production.predios.${id}.${grupo}.${mercadoria}=${taxa}`);
        }
      }
    }
    for (const mercadoria of Object.keys((def && def.sai) || {})) {
      if (!mercadorias.has(mercadoria)) {
        erros.push(`producao/saida-desconhecida: production.predios.${id}.sai.${mercadoria} nao esta em economy.mercadorias`);
      }
    }
    if (def && def.escolheSaida === true && Object.keys(def.sai || {}).length < 2) {
      erros.push(`producao/escolha-sem-opcao: production.predios.${id} escolhe a saida mas declara menos de duas`);
    }
    validarCicloDaReceita(id, def, escala, tickHz, erros);
    // F-T2a: `producao/veio-invalido` saiu daqui junto com o campo `veio`. Quem
    // guarda o total agora e o TILE, e quem o valida e `validarRecursos`
    // (`recurso/rendimento` e `recurso/colheita`).
  }
}

function grupoValido(escalas, valor) {
  return valor === null || Object.prototype.hasOwnProperty.call(escalas, valor);
}

function varrerCamposDeTempo(valor, prefixo, achados, heranca) {
  if (valor === null || typeof valor !== 'object') return;
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => varrerCamposDeTempo(item, `${prefixo}[${i}]`, achados, heranca));
    return;
  }
  for (const [chave, filho] of Object.entries(valor)) {
    if (chave.startsWith('_')) continue;
    const caminho = `${prefixo}.${chave}`;
    const bate = heranca || bateNomeDeTempo(chave);
    if (typeof filho === 'number' && bate) {
      achados.push(caminho);
    } else if (filho !== null && typeof filho === 'object') {
      varrerCamposDeTempo(filho, caminho, achados, bate);
    }
  }
}

// F11a: a velocidade de jogo (1x, 2x, 3x) e consumida pelo laco de tempo (`src/laco.ts`), que
// lanca na criacao se o padrao nao esta nas opcoes. Sem esta regra o erro so apareceria no
// navegador. `opcoes`: array nao vazio de inteiros positivos sem repeticao; `padrao` e uma delas.
function validarVelocidadeDeJogo(dados, erros) {
  const v = dados.time && dados.time.velocidadeDeJogo;
  if (v === undefined || v === null || typeof v !== 'object') {
    erros.push('tempo/velocidade: time.velocidadeDeJogo precisa existir, com `opcoes` e `padrao`');
    return;
  }
  const { opcoes, padrao } = v;
  if (!Array.isArray(opcoes) || opcoes.length === 0) {
    erros.push(`tempo/velocidade: velocidadeDeJogo.opcoes precisa ser um array nao vazio, achou ${JSON.stringify(opcoes)}`);
    return;
  }
  if (!opcoes.every((o) => Number.isInteger(o) && o > 0)) {
    erros.push(`tempo/velocidade: velocidadeDeJogo.opcoes so aceita inteiros positivos, achou ${JSON.stringify(opcoes)}`);
    return;
  }
  if (new Set(opcoes).size !== opcoes.length) {
    erros.push(`tempo/velocidade: velocidadeDeJogo.opcoes tem valor repetido: ${JSON.stringify(opcoes)}`);
    return;
  }
  if (!opcoes.includes(padrao)) {
    erros.push(`tempo/velocidade: velocidadeDeJogo.padrao ${JSON.stringify(padrao)} nao esta em opcoes [${opcoes.join(', ')}]`);
  }
}

function validarTempo(dados, erros) {
  if (!Number.isInteger(dados.time && dados.time.tickHz) || dados.time.tickHz <= 0) {
    erros.push(`tempo/tickHz: time.tickHz precisa ser inteiro positivo, achou ${dados.time && dados.time.tickHz}`);
  }
  validarVelocidadeDeJogo(dados, erros);
  const escalas = (dados.time && dados.time.escalas) || {};

  const declaracoesObrigatorias = new Map();
  for (const campo of CAMPOS_ESCALONADOS) {
    declaracoesObrigatorias.set(`${campo.arquivo}:${campo.declaraEscalaEm}`, true);
  }
  for (const decl of DECLARACOES_ESTRUTURAIS) {
    declaracoesObrigatorias.set(`${decl.arquivo}:${decl.caminho}`, true);
  }
  for (const chave of declaracoesObrigatorias.keys()) {
    const [arquivo, caminho] = chave.split(':');
    const { existe, valor } = getByPath(dados[arquivo], caminho);
    if (!existe) {
      erros.push(`tempo/duracao-sem-grupo: ${arquivo}.${caminho} nao declara escala (chave ausente — ausente != null)`);
      continue;
    }
    if (!grupoValido(escalas, valor)) {
      erros.push(`tempo/grupo-inexistente: ${arquivo}.${caminho}='${valor}' nao existe em time.escalas e nao e null`);
    }
  }

  const registrados = new Set(CAMPOS_ESCALONADOS.map((c) => `${c.arquivo}.${c.caminho}`));
  const isentos = new Set(NAO_SAO_DURACAO.map((c) => `${c.arquivo}.${c.caminho}`));
  for (const arquivo of Object.keys(dados)) {
    const achados = [];
    varrerCamposDeTempo(dados[arquivo], arquivo, achados, false);
    for (const caminho of achados) {
      if (registrados.has(caminho) || isentos.has(caminho)) continue;
      erros.push(`tempo/duracao-nao-registrada: ${caminho} parece duracao/taxa de tempo mas nao esta no registro nem na allowlist`);
    }
  }
}

function validarCondicaoOraculo(dados, erros) {
  const economia = dados.time && dados.time.escalas && dados.time.escalas.economia;
  if (economia !== 2.0) return; // condicional: so vale conferir nessa escala
  const base = dados.condition && dados.condition.duracaoCondicaoCheia_min_base;
  const oraculo = dados.condition && dados.condition.duracaoEfetiva_min_escala2;
  if (!base || !oraculo) return;
  for (const chave of ['civil', 'militar']) {
    const esperado = base[chave] / economia;
    if (oraculo[chave] !== esperado) {
      erros.push(`condicao/oraculo: duracaoEfetiva_min_escala2.${chave}=${oraculo[chave]}, esperado base/escala=${esperado}`);
    }
  }
}

function retanguloDoPredio(estadoPredio, dados) {
  const def = ((dados.buildings && dados.buildings.predios) || []).find((p) => p.id === estadoPredio.id);
  if (!def || !Array.isArray(def.tamanho)) return null;
  const [largura, altura] = def.tamanho;
  return {
    id: estadoPredio.id,
    x0: estadoPredio.gx, y0: estadoPredio.gy,
    x1: estadoPredio.gx + largura - 1, y1: estadoPredio.gy + altura - 1,
  };
}

function retangulosSeSobrepoem(a, b) {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}

function validarEconomiaReferencia(dados, erros) {
  const idsDePredios = new Set(
    ((dados.buildings && dados.buildings.predios) || []).map((p) => p.id),
  );
  const idsDeCivis = new Set(
    ((dados.units && dados.units.civis && dados.units.civis.tipos) || []).map((t) => t.id),
  );
  const mercadoriasValidas = new Set((dados.economy && dados.economy.mercadorias) || []);
  const mapaPadrao = dados.terrain && dados.terrain.mapaPadrao;
  const estadoInicial = dados.economy && dados.economy.estadoInicial;
  if (!estadoInicial) return;

  for (const p of estadoInicial.predios || []) {
    if (!idsDePredios.has(p.id)) {
      erros.push(`economia/referencia: estadoInicial.predios referencia '${p.id}', que nao existe em buildings`);
    }
  }
  for (const id of estadoInicial.menuBuildInicial || []) {
    if (!idsDePredios.has(id)) {
      erros.push(`economia/referencia: menuBuildInicial referencia '${id}', que nao existe em buildings`);
    }
  }
  for (const mercadoria of Object.keys(estadoInicial.estoque || {})) {
    if (!mercadoriasValidas.has(mercadoria)) {
      erros.push(`economia/referencia: estadoInicial.estoque referencia '${mercadoria}', que nao existe em economy.mercadorias`);
    }
  }
  for (const tipo of Object.keys(estadoInicial.unidades || {})) {
    if (!idsDeCivis.has(tipo)) {
      erros.push(`economia/referencia: estadoInicial.unidades referencia '${tipo}', que nao existe em units.civis.tipos`);
    }
  }

  // posicao dos predios: gx/gy presentes, footprint dentro do mapa, sem sobreposicao
  const retangulos = [];
  for (const p of estadoInicial.predios || []) {
    if (!Number.isInteger(p.gx) || !Number.isInteger(p.gy)) {
      erros.push(`economia/posicao: estadoInicial.predios '${p.id}' precisa de gx/gy inteiros`);
      continue;
    }
    const retangulo = retanguloDoPredio(p, dados);
    if (!retangulo) continue; // id invalido ja reportado acima
    if (mapaPadrao) {
      if (retangulo.x0 < 0 || retangulo.y0 < 0 || retangulo.x1 >= mapaPadrao.largura || retangulo.y1 >= mapaPadrao.altura) {
        erros.push(`economia/posicao: estadoInicial.predios '${p.id}' com footprint fora do mapa ${mapaPadrao.largura}x${mapaPadrao.altura}`);
      }
    }
    retangulos.push(retangulo);
  }
  for (let i = 0; i < retangulos.length; i++) {
    for (let j = i + 1; j < retangulos.length; j++) {
      if (retangulosSeSobrepoem(retangulos[i], retangulos[j])) {
        erros.push(`economia/posicao: '${retangulos[i].id}' e '${retangulos[j].id}' se sobrepoem`);
      }
    }
  }

  const spawn = estadoInicial.spawnDeUnidades;
  if (!spawn || !Number.isInteger(spawn.gx) || !Number.isInteger(spawn.gy)) {
    erros.push('economia/posicao: estadoInicial.spawnDeUnidades precisa de gx/gy inteiros');
  } else if (mapaPadrao) {
    if (spawn.gx < 0 || spawn.gy < 0 || spawn.gx >= mapaPadrao.largura || spawn.gy >= mapaPadrao.altura) {
      erros.push('economia/posicao: estadoInicial.spawnDeUnidades fora do mapa');
    }
  }
}

// menuBuildInicial existe so para RAIZ sem pai (desbloqueadoPor: null). Quem tem
// pai na arvore e liberado pela arvore; repetir aqui o que ela ja faz esvazia o
// teste de desbloqueio (o aceite da F12 nao teria o que provar).
function validarMenuInicialSoRaiz(dados, erros) {
  const estadoInicial = dados.economy && dados.economy.estadoInicial;
  const predios = (dados.buildings && dados.buildings.predios) || [];
  for (const id of (estadoInicial && estadoInicial.menuBuildInicial) || []) {
    const def = predios.find((p) => p.id === id);
    if (def && def.desbloqueadoPor !== null) {
      erros.push(`economia/menu-inicial: '${id}' em menuBuildInicial tem desbloqueadoPor '${def.desbloqueadoPor}'; a lista existe so para raiz sem pai (a arvore ja libera o resto)`);
    }
  }
}

// F09: a escada de prioridade de delivery.json tem um `id` por nivel — e por ele que
// o codigo referencia um tipo de tarefa, sem digitar o numero do nivel em .ts
// (invariante 3). Ids unicos e nao vazios; niveis inteiros, unicos e contiguos a
// partir de 1 (um buraco faria "nivel menor = mais urgente" enganar).
function validarEscadaDePrioridade(dados, erros) {
  const escada = dados.delivery && dados.delivery.prioridades;
  if (!Array.isArray(escada)) {
    erros.push('entrega/escada: delivery.prioridades precisa ser array');
    return;
  }
  const ids = new Set();
  const niveis = [];
  escada.forEach((linha, i) => {
    if (typeof linha.id !== 'string' || linha.id === '') {
      erros.push(`entrega/escada: prioridades[${i}] precisa de um id nao vazio`);
    } else if (ids.has(linha.id)) {
      erros.push(`entrega/escada: id '${linha.id}' repetido em delivery.prioridades`);
    } else {
      ids.add(linha.id);
    }
    // F18d-1a: o modo da perna de entrega e do nivel, e TODA linha publica o seu.
    // Regra positiva, sem lista de excecao: linha nova sem modo reprova aqui, em
    // vez de cair num padrao escondido no .ts.
    if (linha.modo !== 'livre' && linha.modo !== 'estrada') {
      erros.push(`entrega/escada: prioridades[${i}] (${linha.id}) precisa de modo 'livre' ou 'estrada'`);
    }
    niveis.push(linha.nivel);
  });
  const ordenados = [...niveis].sort((a, b) => a - b);
  const contiguos = ordenados.every((nivel, i) => Number.isInteger(nivel) && nivel === i + 1);
  if (!contiguos) {
    erros.push('entrega/escada: os niveis precisam ser inteiros, unicos e contiguos a partir de 1');
  }
}

// F13a: a sim cobra o ouro do treino ao INICIAR (economy.schoolhouse), e cancelar
// um item que ja comecou nao devolve nada. A politica alternativa — cobrar ao
// enfileirar e reembolsar quem for cancelado antes de comecar — NAO esta
// implementada; sem esta regra, `reembolsoSeNaoIniciado: false` seria um dado que
// ninguem le, dizendo do jogo uma coisa que o jogo nao faz.
function validarPoliticaDeTreino(dados, erros) {
  const escola = (dados.economy && dados.economy.schoolhouse) || {};
  if (escola.reembolsoSeNaoIniciado !== true) {
    erros.push(
      "economia/escola: economy.schoolhouse.reembolsoSeNaoIniciado precisa ser true — a sim cobra o ouro ao INICIAR o treino (F13a), entao so o item que ainda nao comecou sai de graca; 'false' nao esta implementado",
    );
  }
  if (!Number.isInteger(escola.slotsDeFila) || escola.slotsDeFila < 1) {
    erros.push('economia/escola: slotsDeFila precisa ser inteiro >= 1');
  }
  if (!Number.isInteger(escola.custoOuroPorUnidade) || escola.custoOuroPorUnidade < 0) {
    erros.push('economia/escola: custoOuroPorUnidade precisa ser inteiro >= 0');
  }
}

// F08: fracao da pedra devolvida ao demolir tiles de estrada. Campo proprio de
// terrain.estrada (nao o de buildings.construcao): estrada e predio podem
// divergir. Uma fracao fora de [0, 1] devolveria mais do que custou, ou negativo.
function validarDevolucaoDeEstrada(dados, erros) {
  const estrada = dados.terrain && dados.terrain.estrada;
  const valor = estrada && estrada.devolucaoAoDemolir;
  if (typeof valor !== 'number' || Number.isNaN(valor) || valor < 0 || valor > 1) {
    erros.push('terreno/estrada: devolucaoAoDemolir precisa ser um numero em [0, 1]');
  }
}

// F16a: fracao do material JA ENTREGUE que volta ao armazem ao demolir um predio.
// Irma da regra da estrada acima, e com campo separado de proposito. Fora de [0, 1]
// a demolicao devolveria mais do que o predio custou (moeda infinita) ou negativo.
function validarDevolucaoDePredio(dados, erros) {
  const construcao = dados.buildings && dados.buildings.construcao;
  const valor = construcao && construcao.devolucaoAoDemolir;
  if (typeof valor !== 'number' || Number.isNaN(valor) || valor < 0 || valor > 1) {
    erros.push('predios/construcao: devolucaoAoDemolir precisa ser um numero em [0, 1]');
  }
}

// F05b: comida no HUD e um grupo do dado (economy.grupos.comida), mas
// condition.restauracaoPorComida ja lista as mesmas mercadorias implicitamente
// (uma chave por comida, para saber quanto ela restaura). Sem esta regra as
// duas listas divergem em silencio: alguem acrescenta uma comida nova em um
// arquivo e o HUD (ou a restauracao de condicao) continua contando a lista
// velha.
function validarGruposDeComida(dados, erros) {
  const grupo = dados.economy && dados.economy.grupos && dados.economy.grupos.comida;
  const restauracao = dados.condition && dados.condition.restauracaoPorComida;
  if (!Array.isArray(grupo)) {
    erros.push('economia/grupos: economy.grupos.comida precisa ser array');
    return;
  }
  if (!restauracao || typeof restauracao !== 'object') {
    erros.push('economia/grupos: condition.restauracaoPorComida ausente');
    return;
  }
  const mercadorias = new Set((dados.economy && dados.economy.mercadorias) || []);
  const noGrupo = new Set(grupo);
  if (noGrupo.size !== grupo.length) {
    erros.push('economia/grupos: economy.grupos.comida tem id repetido');
  }
  const naCondicao = new Set(Object.keys(restauracao));
  for (const id of noGrupo) {
    if (!mercadorias.has(id)) {
      erros.push(`economia/grupos: '${id}' em grupos.comida nao existe em economy.mercadorias`);
    }
    if (!naCondicao.has(id)) {
      erros.push(`economia/grupos: '${id}' esta em grupos.comida mas nao em condition.restauracaoPorComida`);
    }
  }
  for (const id of naCondicao) {
    if (!noGrupo.has(id)) {
      erros.push(`economia/grupos: '${id}' esta em condition.restauracaoPorComida mas nao em grupos.comida`);
    }
  }
}

// F18a: zoom e dado de RENDER, nao balanceamento — nenhuma regra de jogo depende
// dele e `sim/` nao le este bloco. O que a regra guarda e a forma e a propriedade
// que o resto do codigo assume: passos crescentes, o neutro presente, e
// tile_px * nivel INTEIRO. Sem o inteiro, a ida e volta grid<->pixel acumula erro
// de ponto flutuante e o clique erra o tile em zoom nao-neutro.
function validarZoomDoTerreno(dados, erros) {
  const terrain = dados.terrain;
  if (!terrain) return; // forma/* ja reportou
  const zoom = terrain.zoom;
  if (!zoom || typeof zoom !== 'object') {
    erros.push('terreno/zoom: terrain.zoom precisa existir (F18a)');
    return;
  }
  if (!Array.isArray(zoom.niveis) || zoom.niveis.length < 3) {
    erros.push('terreno/zoom: terrain.zoom.niveis precisa ser uma lista com pelo menos 3 niveis');
    return;
  }
  let anterior = 0;
  for (const nivel of zoom.niveis) {
    if (typeof nivel !== 'number' || Number.isNaN(nivel) || !(nivel > 0)) {
      erros.push(`terreno/zoom: nivel invalido '${nivel}' (precisa ser numero > 0)`);
      continue;
    }
    if (nivel <= anterior) {
      erros.push(
        `terreno/zoom: os niveis precisam ser crescentes e sem repeticao (${nivel} depois de ${anterior})`,
      );
    }
    anterior = nivel;
    if (!Number.isInteger(terrain.tile_px * nivel)) {
      erros.push(
        `terreno/zoom: tile_px (${terrain.tile_px}) vezes o nivel ${nivel} nao e inteiro; `
        + 'a ida e volta grid<->pixel deixaria de ser exata',
      );
    }
  }
  if (!zoom.niveis.includes(zoom.inicial)) {
    erros.push(`terreno/zoom: inicial (${zoom.inicial}) precisa ser um dos niveis da lista`);
  }
}

// F-D2: a navegacao por teclado. Dado de RENDER, como o zoom. A regra guarda a
// forma e UMA coerencia que nao se ve lendo os numeros: teto abaixo da
// velocidade inicial faria "segurar a seta" FREAR a camera, o contrario do que
// o item pede. Os valores em si sao balanceamento e nao se validam aqui.
function validarCameraDoTerreno(dados, erros) {
  const terrain = dados.terrain;
  if (!terrain) return; // forma/* ja reportou
  const camera = terrain.camera;
  if (!camera || typeof camera !== 'object') {
    erros.push('terreno/camera: terrain.camera precisa existir (F-D2)');
    return;
  }
  const campos = ['velocidadeInicialPxPorSegundo', 'aceleracaoPxPorSegundo2', 'tetoPxPorSegundo'];
  let completo = true;
  for (const campo of campos) {
    const valor = camera[campo];
    if (typeof valor !== 'number' || Number.isNaN(valor) || !(valor > 0)) {
      erros.push(`terreno/camera: ${campo} precisa ser um numero > 0 (veio '${valor}')`);
      completo = false;
    }
  }
  if (!completo) return;
  if (camera.tetoPxPorSegundo < camera.velocidadeInicialPxPorSegundo) {
    erros.push(
      `terreno/camera: o teto (${camera.tetoPxPorSegundo}) nao pode ser menor que a velocidade `
        + `inicial (${camera.velocidadeInicialPxPorSegundo}): segurar a seta frearia a camera`,
    );
  }
}

// F-D3: a reserva da vila. Dado de AUTORIA — quem le e tools/gerar-mapa.js, e o
// jogo nunca roda o gerador. A regra guarda a forma e as duas coerencias que so
// aparecem quando se cruza o bloco com o resto do dado: terreno que a legenda de
// custo/intransponivel nao conhece nao existe para o mapa, e recurso que
// resources.json nao declara nao tem como nascer. Raio negativo nao e reserva.
function validarGeracaoDoTerreno(dados, erros) {
  const terrain = dados.terrain;
  if (!terrain) return; // forma/* ja reportou
  const geracao = terrain.geracao;
  if (!geracao || typeof geracao !== 'object') {
    erros.push('terreno/geracao: terrain.geracao precisa existir (F-D3)');
    return;
  }
  const reserva = geracao.reservaDaVila;
  if (!reserva || typeof reserva !== 'object') {
    erros.push('terreno/geracao: terrain.geracao.reservaDaVila precisa existir (F-D3)');
    return;
  }
  if (!Number.isInteger(reserva.raio) || reserva.raio < 0) {
    erros.push(
      `terreno/geracao: reservaDaVila.raio precisa ser inteiro >= 0 (veio '${reserva.raio}'): `
      + 'raio negativo nao reserva nada, e fracionario nao e tile',
    );
  }
  const terrenos = new Set([
    ...Object.keys(terrain.custoDeMovimento || {}).filter((k) => !k.startsWith('_')),
    ...(terrain.intransponivel || []),
  ]);
  if (!Array.isArray(reserva.terrenoPermitido) || reserva.terrenoPermitido.length === 0) {
    erros.push('terreno/geracao: reservaDaVila.terrenoPermitido precisa ser uma lista nao vazia');
    return;
  }
  for (const id of reserva.terrenoPermitido) {
    if (!terrenos.has(id)) {
      erros.push(
        `terreno/geracao: reservaDaVila.terrenoPermitido cita '${id}', que nao e um terreno `
        + 'conhecido (custoDeMovimento ou intransponivel)',
      );
    }
    // A regra que faz a lista ser segura de mexer: a reserva existe para a vila
    // caber, entao permitir nela um terreno que a propria terrain.json declara
    // intransponivel seria autorizar o gerador a afogar o armazem. Quem mudar a
    // lista nao precisa saber disto — o validate:data sabe.
    if ((terrain.intransponivel || []).includes(id)) {
      erros.push(
        `terreno/geracao: reservaDaVila.terrenoPermitido cita '${id}', que esta em `
        + 'terrain.intransponivel: a reserva da vila nao pode permitir terreno que nao se pisa',
      );
    }
  }
  if (!Array.isArray(reserva.recursoPermitido)) {
    erros.push('terreno/geracao: reservaDaVila.recursoPermitido precisa ser uma lista');
    return;
  }
  const tipos = Object.keys((dados.resources && dados.resources.tipos) || {});
  for (const id of reserva.recursoPermitido) {
    if (!tipos.includes(id)) {
      erros.push(
        `terreno/geracao: reservaDaVila.recursoPermitido cita '${id}', que nao e um tipo de `
        + 'resources.json',
      );
    }
  }
}

// --- F-T1: a camada de terreno base ------------------------------------------
//
// O mapa nao e um arquivo solto: cada tipo que ele desenha tem de EXISTIR no
// vocabulario de `terrain.json` — ou com custo de movimento, ou na lista de
// intransponivel. Sem esta regra um 'x' no meio de uma linha viraria terreno
// mudo, e o A* descobriria isso em tempo de execucao, dentro do navegador.
//
// Os mapas sao achados por prefixo (`maps/`), nunca por id: acrescentar o
// segundo mapa da campanha nao mexe nesta funcao.
function mapasDe(dados) {
  return Object.keys(dados)
    .filter((nome) => nome.startsWith(PREFIXO_DE_MAPA))
    .map((nome) => ({ nome, mapa: dados[nome] }));
}

/** Os tipos que um mapa PODE usar, derivados de terrain.json e nao digitados
 *  aqui: os transponiveis sao as chaves de custoDeMovimento menos 'estrada'
 *  (estrada e ESTADO, o jogador a constroi, nao terreno de mapa); os
 *  intransponiveis sao a lista menos 'predio' (idem: predio e estado). */
function vocabularioDeTerreno(dados) {
  const custo = (dados.terrain && dados.terrain.custoDeMovimento) || {};
  const transponiveis = Object.keys(custo).filter((k) => k !== 'estrada' && !k.startsWith('_'));
  const intransponiveis = ((dados.terrain && dados.terrain.intransponivel) || [])
    .filter((k) => k !== 'predio');
  return { transponiveis, intransponiveis, todos: new Set([...transponiveis, ...intransponiveis]) };
}

function validarMapas(dados, erros) {
  // Sem chave de mapa nao ha o que validar: quem carrega do disco (o CLI e os
  // testes que iteram ARQUIVOS) quebra antes daqui, no readFileSync, se o
  // arquivo sumir. Testes que montam `dados` a mao com um subconjunto dos
  // arquivos continuam valendo.
  const mapas = mapasDe(dados);
  if (mapas.length === 0) return;
  const vocabulario = vocabularioDeTerreno(dados);
  const mapaPadrao = (dados.terrain && dados.terrain.mapaPadrao) || {};

  for (const { nome, mapa } of mapas) {
    if (!mapa || typeof mapa !== 'object') {
      erros.push(`mapa/forma: ${nome} nao e um objeto`);
      continue;
    }
    if (typeof mapa.id !== 'string' || mapa.id.length === 0) {
      erros.push(`mapa/forma: ${nome}.id precisa ser string nao vazia`);
    }
    if (!Number.isInteger(mapa.largura) || !Number.isInteger(mapa.altura)
      || mapa.largura < 1 || mapa.altura < 1) {
      erros.push(`mapa/forma: ${nome} precisa de largura/altura inteiras >= 1`);
      continue;
    }
    // O mapa e o tamanho do mundo: se ele discordar de terrain.mapaPadrao, o
    // A* e o `canPlace` indexariam grades de tamanhos diferentes.
    if (mapa.largura !== mapaPadrao.largura || mapa.altura !== mapaPadrao.altura) {
      erros.push(
        `mapa/dimensao: ${nome} e ${mapa.largura}x${mapa.altura}, `
        + `terrain.mapaPadrao e ${mapaPadrao.largura}x${mapaPadrao.altura}`,
      );
    }
    if (!mapa.legenda || typeof mapa.legenda !== 'object') {
      erros.push(`mapa/legenda: ${nome}.legenda precisa existir`);
      continue;
    }
    for (const [ch, tipo] of Object.entries(mapa.legenda)) {
      if (ch.length !== 1) erros.push(`mapa/legenda: ${nome} tem a chave '${ch}', que nao e um char`);
      if (!vocabulario.todos.has(tipo)) {
        erros.push(
          `mapa/legenda: ${nome} mapeia '${ch}' para '${tipo}', que nao esta em `
          + 'terrain.custoDeMovimento nem em terrain.intransponivel',
        );
      }
    }
    if (!Array.isArray(mapa.linhas) || mapa.linhas.length !== mapa.altura) {
      erros.push(`mapa/linhas: ${nome}.linhas precisa ter ${mapa.altura} linhas`);
      continue;
    }
    let linhaTorta = false;
    for (let gy = 0; gy < mapa.linhas.length; gy += 1) {
      const linha = mapa.linhas[gy];
      if (typeof linha !== 'string' || linha.length !== mapa.largura) {
        erros.push(`mapa/linhas: ${nome}.linhas[${gy}] precisa ser string de ${mapa.largura} chars`);
        linhaTorta = true;
        break;
      }
      for (let gx = 0; gx < linha.length; gx += 1) {
        if (!(linha[gx] in mapa.legenda)) {
          erros.push(`mapa/linhas: ${nome} usa o char '${linha[gx]}' em (${gx},${gy}), fora da legenda`);
          linhaTorta = true;
          break;
        }
      }
      if (linhaTorta) break;
    }
    if (linhaTorta) continue;

    const tipoEm = (gx, gy) => mapa.legenda[mapa.linhas[gy][gx]];
    const transponivel = new Set(vocabulario.transponiveis);
    // A vila inicial tem de NASCER em chao construivel, inclusive a porta (a
    // borda sul do footprint, GDD §5.1) e o tile onde as unidades aparecem.
    // Sem esta regra, um mapa novo poria o armazem dentro do lago e o jogo
    // abriria travado — e o sintoma apareceria a 300 ticks de distancia.
    const estadoInicial = (dados.economy && dados.economy.estadoInicial) || {};
    for (const predio of estadoInicial.predios || []) {
      const r = retanguloDoPredio(predio, dados);
      if (r === null) continue;
      for (let gy = r.y0; gy <= r.y1 + 1; gy += 1) {
        for (let gx = r.x0; gx <= r.x1; gx += 1) {
          if (gx < 0 || gy < 0 || gx >= mapa.largura || gy >= mapa.altura) continue;
          if (!transponivel.has(tipoEm(gx, gy))) {
            erros.push(
              `mapa/vila: ${nome} poe '${tipoEm(gx, gy)}' em (${gx},${gy}), `
              + `sob o predio inicial '${predio.id}' (footprint ou porta)`,
            );
          }
        }
      }
    }
    // A camada esparsa de recurso (F-T2a): tile dentro do mundo e UM recurso por
    // tile. Dois recursos no mesmo tile fariam `state.recursos`, que e chaveado
    // por tile, perder um deles em silencio no nascimento da partida.
    if (!mapa.recursos || typeof mapa.recursos !== 'object') {
      erros.push(`mapa/recursos: ${nome}.recursos precisa existir (objeto tipo -> lista de [gx,gy])`);
    } else {
      const ocupado = new Map();
      for (const [tipo, tiles] of Object.entries(mapa.recursos)) {
        if (!Array.isArray(tiles)) {
          erros.push(`mapa/recursos: ${nome}.recursos.${tipo} precisa ser array de [gx,gy]`);
          continue;
        }
        for (const par of tiles) {
          if (!Array.isArray(par) || par.length !== 2
            || !Number.isInteger(par[0]) || !Number.isInteger(par[1])) {
            erros.push(`mapa/recursos: ${nome}.recursos.${tipo} tem ${JSON.stringify(par)}, que nao e [gx,gy]`);
            break;
          }
          const [gx, gy] = par;
          if (gx < 0 || gy < 0 || gx >= mapa.largura || gy >= mapa.altura) {
            erros.push(`mapa/recursos: ${nome} poe '${tipo}' em (${gx},${gy}), fora do mundo`);
            break;
          }
          const chave = `${gx},${gy}`;
          if (ocupado.has(chave)) {
            erros.push(`mapa/recursos: ${nome} poe '${ocupado.get(chave)}' e '${tipo}' no tile (${gx},${gy})`);
            break;
          }
          ocupado.set(chave, tipo);
        }
      }
    }

    const spawn = estadoInicial.spawnDeUnidades;
    if (spawn && Number.isInteger(spawn.gx) && Number.isInteger(spawn.gy)
      && spawn.gx >= 0 && spawn.gy >= 0 && spawn.gx < mapa.largura && spawn.gy < mapa.altura
      && !transponivel.has(tipoEm(spawn.gx, spawn.gy))) {
      erros.push(
        `mapa/vila: ${nome} poe '${tipoEm(spawn.gx, spawn.gy)}' em `
        + `(${spawn.gx},${spawn.gy}), onde as unidades iniciais aparecem`,
      );
    }
  }
}

// --- F-T2a: a camada de recursos naturais ------------------------------------
//
// Tres erros que so apareceriam dentro da partida, e tarde:
//   - regime que nenhum sistema entende vira "nao esgota nunca" em silencio;
//   - receita que colhe um recurso inexistente vira predio parado sem causa;
//   - tipo declarado sem NENHUM tile no mapa e dado sem leitor — o balanceamento
//     fala de um recurso que o mundo nao tem.
const REGIMES_DE_RECURSO = ['nunca', 'porAcao', 'porTempo'];

/** F18 — os tipos de terreno que este mapa REALMENTE desenha, pela legenda e
 *  pelas linhas. E a mesma pergunta que o carregador faz para montar a camada
 *  de um recurso derivado de terreno; contar a legenda sozinha diria que ha
 *  campo arado num mapa que nao tem nenhum 'c'. */
function terrenosComTile(mapa) {
  const legenda = (mapa && mapa.legenda) || {};
  const linhas = (mapa && mapa.linhas) || [];
  const achados = new Set();
  for (const linha of linhas) {
    for (const ch of String(linha)) {
      const terreno = legenda[ch];
      if (terreno !== undefined) achados.add(terreno);
    }
  }
  return achados;
}

/** F18 — `terreno` diz de qual terreno a camada deste recurso e derivada. E
 *  opcional (rocha, arvore e cardume vem da lista esparsa do mapa), mas quando
 *  esta la tem de ser terreno do vocabulario, senao a camada nasceria vazia em
 *  silencio e a fazenda nunca acharia campo. */
function validarCampoDerivadoDoTerreno(dados, id, def, erros) {
  if (def.terreno === undefined) return;
  const { todos } = vocabularioDeTerreno(dados);
  if (typeof def.terreno !== 'string' || !todos.has(def.terreno)) {
    erros.push(
      `recurso/terreno: resources.tipos.${id}.terreno e '${def.terreno}', `
      + `que nao esta no vocabulario de terrain.json (${[...todos].join('/')})`,
    );
  }
  if (def.quantidadeInicial !== undefined) {
    const q = def.quantidadeInicial;
    if (!Number.isInteger(q) || q < 0 || q > def.rendimentoPorTile) {
      erros.push(
        `recurso/quantidade-inicial: resources.tipos.${id}.quantidadeInicial precisa ser `
        + `inteiro entre 0 e rendimentoPorTile (${def.rendimentoPorTile}), achou ${q}`,
      );
    }
  }
}

/** F18 — `reposicao` e o que um predio gasta e demora para repor UM tile. So
 *  faz sentido no regime `porAcao`: no `nunca` seria a promessa de repor o que
 *  o regime diz que nao volta, e no `porTempo` seriam duas fontes para a mesma
 *  reposicao. A duracao tem de estar registrada em tools/data-schema.js — o
 *  varredor de tempo cobra isso sozinho; o que se cobra aqui e a FORMA. */
function validarReposicao(dados, id, def, erros) {
  if (def.reposicao === undefined) return;
  if (def.regime !== 'porAcao') {
    erros.push(
      `recurso/reposicao: resources.tipos.${id} declara reposicao com regime '${def.regime}' `
      + '(so `porAcao` se repoe por acao de um predio)',
    );
  }
  const r = def.reposicao;
  if (!r || typeof r !== 'object') {
    erros.push(`recurso/reposicao: resources.tipos.${id}.reposicao nao e um objeto`);
    return;
  }
  // F-CAMPO-a — dois tempos: `semear` (o roceiro no tile) e `crescer` (o tile
  // sozinho, sem ninguem la). O `segundos_base` unico que cobria os dois saiu.
  for (const campo of ['semear_segundos_base', 'crescer_segundos_base']) {
    if (typeof r[campo] !== 'number' || !(r[campo] > 0)) {
      erros.push(
        `recurso/reposicao: resources.tipos.${id}.reposicao.${campo} precisa ser numero > 0, `
        + `achou ${JSON.stringify(r[campo])}`,
      );
    }
  }
  if (!r.custo || typeof r.custo !== 'object') {
    erros.push(`recurso/reposicao: resources.tipos.${id}.reposicao.custo precisa ser objeto (vazio quando de graca)`);
    return;
  }
  const mercadorias = new Set((dados.economy && dados.economy.mercadorias) || []);
  for (const [mercadoria, q] of Object.entries(r.custo)) {
    if (mercadoria.startsWith('_')) continue;
    if (!mercadorias.has(mercadoria)) {
      erros.push(
        `recurso/reposicao: resources.tipos.${id}.reposicao.custo referencia '${mercadoria}', `
        + 'que nao existe em economy.mercadorias',
      );
    }
    if (!Number.isInteger(q) || q < 1) {
      erros.push(`recurso/reposicao: resources.tipos.${id}.reposicao.custo.${mercadoria} precisa ser inteiro >= 1`);
    }
  }
}

function validarRecursos(dados, erros) {
  const tipos = (dados.resources && dados.resources.tipos) || null;
  if (tipos === null || typeof tipos !== 'object') return; // forma/* ja reportou
  for (const [id, def] of Object.entries(tipos)) {
    if (id.startsWith('_')) continue;
    if (!def || typeof def !== 'object') {
      erros.push(`recurso/forma: resources.tipos.${id} nao e um objeto`);
      continue;
    }
    if (!REGIMES_DE_RECURSO.includes(def.regime)) {
      erros.push(
        `recurso/regime: resources.tipos.${id}.regime e '${def.regime}', `
        + `fora de ${REGIMES_DE_RECURSO.join('/')}`,
      );
    }
    if (!Number.isInteger(def.rendimentoPorTile) || def.rendimentoPorTile < 1) {
      erros.push(`recurso/rendimento: resources.tipos.${id}.rendimentoPorTile precisa ser inteiro >= 1`);
    }
    // F-T2b: obrigatorio e booleano de verdade. Campo ausente leria como
    // "nao bloqueia" em silencio, que e o pior dos dois erros possiveis —
    // a floresta pararia de fechar o mapa sem ninguem perceber.
    if (typeof def.bloqueiaPasso !== 'boolean') {
      erros.push(
        `recurso/bloqueio: resources.tipos.${id}.bloqueiaPasso precisa ser true ou false `
        + '(ausente leria como "nao bloqueia" sem ninguem notar)',
      );
    }
    // BUG-F (2026-09-24): mesma forma e mesmo motivo do `bloqueiaPasso`. Campo
    // ausente leria como "pode construir em cima" em silencio, que e exatamente o
    // defeito que a bandeira existe para matar.
    if (typeof def.bloqueiaConstrucao !== 'boolean') {
      erros.push(
        `recurso/bloqueio: resources.tipos.${id}.bloqueiaConstrucao precisa ser true ou false `
        + '(ausente leria como "pode construir em cima" sem ninguem notar)',
      );
    }
    validarCampoDerivadoDoTerreno(dados, id, def, erros);
    validarReposicao(dados, id, def, erros);
  }

  // A receita que colhe tem de colher algo que existe, e ate uma distancia real.
  const receitas = (dados.production && dados.production.predios) || {};
  for (const [id, def] of Object.entries(receitas)) {
    if (!def || typeof def !== 'object' || !def.colheita) continue;
    if (!(def.colheita.recurso in tipos)) {
      erros.push(
        `recurso/colheita: production.predios.${id} colhe '${def.colheita.recurso}', `
        + 'que nao existe em resources.tipos',
      );
    }
    if (!Number.isInteger(def.colheita.alcance_tiles) || def.colheita.alcance_tiles < 1) {
      erros.push(`recurso/colheita: production.predios.${id}.colheita.alcance_tiles precisa ser inteiro >= 1`);
    }
    // 2026-09-26 (operador): `aDistancia` e regra de CLASSE — o especialista colhe o
    // tile sem sair do predio. Opcional; presente, so pode ser booleano, porque
    // qualquer outro valor leria como verdadeiro ou falso sem ninguem notar.
    if ('aDistancia' in def.colheita && typeof def.colheita.aDistancia !== 'boolean') {
      erros.push(`recurso/colheita: production.predios.${id}.colheita.aDistancia precisa ser true ou false`);
    }
  }

  // E cada tipo tem de aparecer em algum mapa. Sem mapa carregado nao ha o que
  // conferir (o mesmo caso de `validarMapas`: teste que monta um subconjunto).
  const mapas = mapasDe(dados);
  if (mapas.length === 0) return;
  const usados = new Set();
  for (const { nome, mapa } of mapas) {
    const recursos = mapa && mapa.recursos;
    if (recursos === undefined) continue; // mapa/recursos ja reportou
    for (const [tipo, tiles] of Object.entries(recursos)) {
      if (tiles.length > 0) usados.add(tipo);
      if (!(tipo in tipos)) {
        erros.push(`recurso/mapa: ${nome} poe o recurso '${tipo}', que nao existe em resources.tipos`);
      }
    }
  }
  // F18 — o tipo derivado de TERRENO (`corn`, em `campoArado`) nao aparece na
  // lista esparsa do arquivo de mapa: quem monta a camada dele e o carregador,
  // a partir das linhas. Contar so a lista reprovaria o dado CORRETO, entao a
  // pergunta aqui e a mesma que o runtime faz — ha tile deste recurso em algum
  // mapa, venha ele da lista ou do terreno?
  for (const { mapa } of mapas) {
    for (const terreno of terrenosComTile(mapa)) {
      for (const [id, def] of Object.entries(tipos)) {
        if (!id.startsWith('_') && def && def.terreno === terreno) usados.add(id);
      }
    }
  }
  // 2026-09-26 (operador) — cultura que o JOGADOR ara nao precisa nascer no
  // mapa: a instancia vem do comando de arar. A isencao vem do dado (o bloco
  // `aradura`, o mesmo que `culturasAraveis` le no runtime), nao de lista aqui.
  for (const id of Object.keys(tipos)) {
    if (id.startsWith('_') || usados.has(id)) continue;
    if (tipos[id] && tipos[id].aradura != null) continue;
    erros.push(`recurso/sem-instancia: resources.tipos.${id} nao tem nenhum tile em nenhum mapa`);
  }
}

// Layout 2, fatia 2 (docs/propostas/ui-releitura-rts.md §2): o agrupamento do
// menu Construir (data/menu-build.json) e dado de INTERFACE, validado a parte
// de validarTudo porque `sim/` nunca o le. O que a regra guarda: todo predio de
// buildings.json esta em exatamente um grupo; nenhum id inventado; a ORDEM
// dentro do grupo e a de buildings.json (a ordem nunca e digitada duas vezes);
// e cada grupo tem rotulo no tema, e so os grupos tem — o mesmo par ida-e-volta
// do guarda da F22 para as causas de alerta.
function validarInterface(dados, interfaceUi) {
  const erros = [];
  const menu = interfaceUi && interfaceUi['menu-build'];
  const tema = interfaceUi && interfaceUi['theme-sertao'];
  if (!menu || !Array.isArray(menu.grupos)) {
    erros.push('interface/menu-build-forma: menu-build.grupos precisa ser array');
    return erros;
  }
  const rotulos = tema && tema.menuBuild && tema.menuBuild.grupos;
  if (!rotulos || typeof rotulos !== 'object') {
    erros.push('interface/menu-build-forma: theme-sertao.menuBuild.grupos precisa existir');
    return erros;
  }
  const ordemDoDado = ((dados.buildings && dados.buildings.predios) || []).map((p) => p.id);
  const posicao = new Map(ordemDoDado.map((id, i) => [id, i]));

  const idsDeGrupo = new Set();
  const vistos = new Map(); // predio -> grupo
  for (const grupo of menu.grupos) {
    if (!grupo || typeof grupo.id !== 'string' || !Array.isArray(grupo.predios)) {
      erros.push('interface/menu-build-forma: cada grupo precisa de id string e predios array');
      continue;
    }
    if (idsDeGrupo.has(grupo.id)) erros.push(`interface/menu-build-grupo-repetido: grupo '${grupo.id}' aparece duas vezes`);
    idsDeGrupo.add(grupo.id);
    if (!(grupo.id in rotulos)) {
      erros.push(`interface/menu-build-rotulo: grupo '${grupo.id}' sem rotulo em theme-sertao.menuBuild.grupos`);
    }
    let anterior = -1;
    for (const id of grupo.predios) {
      if (!posicao.has(id)) {
        erros.push(`interface/menu-build-inexistente: '${id}' (grupo '${grupo.id}') nao existe em buildings.predios`);
        continue;
      }
      if (vistos.has(id)) {
        erros.push(`interface/menu-build-repetido: '${id}' esta em '${vistos.get(id)}' e em '${grupo.id}'`);
      }
      vistos.set(id, grupo.id);
      const pos = posicao.get(id);
      if (pos < anterior) {
        erros.push(`interface/menu-build-ordem: '${id}' (grupo '${grupo.id}') esta fora da ordem de buildings.json`);
      }
      anterior = Math.max(anterior, pos);
    }
  }
  for (const id of ordemDoDado) {
    if (!vistos.has(id)) erros.push(`interface/menu-build-sem-grupo: '${id}' nao esta em grupo nenhum`);
  }
  for (const id of Object.keys(rotulos)) {
    if (id.startsWith('_')) continue;
    if (!idsDeGrupo.has(id)) {
      erros.push(`interface/menu-build-rotulo: theme-sertao.menuBuild.grupos.${id} nao corresponde a grupo nenhum`);
    }
  }
  return erros;
}

function validarTudo(dados) {
  const erros = [];
  validarForma(dados, erros);
  validarPredios(dados, erros);
  validarRecursos(dados, erros);
  validarProducao(dados, erros);
  validarTempo(dados, erros);
  validarCondicaoOraculo(dados, erros);
  validarEconomiaReferencia(dados, erros);
  validarGruposDeComida(dados, erros);
  validarMenuInicialSoRaiz(dados, erros);
  validarDevolucaoDeEstrada(dados, erros);
  validarZoomDoTerreno(dados, erros);
  validarCameraDoTerreno(dados, erros);
  validarGeracaoDoTerreno(dados, erros);
  validarDevolucaoDePredio(dados, erros);
  validarEscadaDePrioridade(dados, erros);
  validarPoliticaDeTreino(dados, erros);
  validarMapas(dados, erros);
  return erros;
}

module.exports = { validarTudo, validarInterface, getByPath };
