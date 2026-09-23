#!/usr/bin/env node
'use strict';

// validarTudo(dados) — puro: recebe os nove arquivos ja parseados (sem
// theme-sertao.json, CLAUDE.md 9) e devolve string[] de erros (vazio =
// valido). tools/validate-data.js (CLI) e o teste de F03 importam esta
// mesma funcao — uma fonte de verdade, nunca duas copias divergentes.

const {
  CAMPOS_ESCALONADOS, DECLARACOES_ESTRUTURAIS, NAO_SAO_DURACAO, bateNomeDeTempo,
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
    validarCicloDaReceita(id, def, escala, tickHz, erros);
    // F15a/D2: o veio mora no predio e e semeado deste campo. Ausente = renovavel;
    // presente tem de render pelo menos uma unidade inteira de saida.
    const veio = def && def.veio;
    if (veio !== undefined && veio !== null) {
      const rendimento = veio.rendimento;
      if (!Number.isInteger(rendimento) || rendimento < 1) {
        erros.push(`producao/veio-invalido: production.predios.${id}.veio.rendimento=${rendimento} (inteiro >= 1)`);
      }
    }
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

function validarTudo(dados) {
  const erros = [];
  validarForma(dados, erros);
  validarPredios(dados, erros);
  validarProducao(dados, erros);
  validarTempo(dados, erros);
  validarCondicaoOraculo(dados, erros);
  validarEconomiaReferencia(dados, erros);
  validarGruposDeComida(dados, erros);
  validarMenuInicialSoRaiz(dados, erros);
  validarDevolucaoDeEstrada(dados, erros);
  validarDevolucaoDePredio(dados, erros);
  validarEscadaDePrioridade(dados, erros);
  validarPoliticaDeTreino(dados, erros);
  return erros;
}

module.exports = { validarTudo, getByPath };
