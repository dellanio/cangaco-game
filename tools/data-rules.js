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
const manifestoDeAssets = require('../assets/manifest.json');

function validarBandeira(bandeira, erros) {
  const e = (msg) => erros.push(`interface/bandeira: ${msg}`);
  if (!bandeira || typeof bandeira !== 'object' || Array.isArray(bandeira)) {
    e('data/bandeira.json precisa existir e ser objeto');
    return;
  }
  if (!Number.isInteger(bandeira.segmentos) || bandeira.segmentos < 2) e('segmentos precisa ser inteiro >= 2');
  for (const campo of ['amplitudeMaximaPx', 'comprimentoDeOndaPx', 'velocidadePxPorTick']) {
    if (!Number.isFinite(bandeira[campo]) || bandeira[campo] <= 0) e(`${campo} precisa ser > 0`);
  }
}

function validarVento(vento, erros, manifesto = manifestoDeAssets) {
  const e = (msg) => erros.push(`interface/vento: ${msg}`);
  if (!vento || typeof vento !== 'object' || Array.isArray(vento)) {
    e('data/vento.json precisa existir e ser objeto');
    return;
  }
  const estadosDeCrescimento = new Set(['muda', 'crescendo_1', 'crescendo_2']);
  const arvore = manifesto.assets.find((a) => a.tipo === 'vegetacao' && a.id === 'tree');
  const especies = Object.keys(arvore?.estados ?? {}).filter((estado) => !estadosDeCrescimento.has(estado));
  if (!vento.especies || typeof vento.especies !== 'object' || Array.isArray(vento.especies)) {
    e('especies precisa ser objeto com todas as especies de tree');
  } else {
    for (const especie of especies) {
      if (!Object.hasOwn(vento.especies, especie)) e(`especie '${especie}' sem entrada em especies`);
    }
    for (const [especie, fatores] of Object.entries(vento.especies)) {
      if (!especies.includes(especie)) e(`'${especie}' nao e especie de tree no manifesto`);
      for (const eixo of ['amplitude', 'velocidade']) {
        const valor = fatores?.[eixo];
        if (!Number.isFinite(valor) || valor <= 0 || valor > 1) e(`${especie}.${eixo} precisa estar em (0,1]`);
      }
    }
  }
  if (!Number.isFinite(vento.variacaoPorArvore) || vento.variacaoPorArvore < 0 || vento.variacaoPorArvore >= 0.5) {
    e('variacaoPorArvore precisa estar em [0,0.5)');
  }
  const positivo = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const inteiro = (n) => Number.isInteger(n) && n > 0;
  const direcao = vento.direcao;
  if (!direcao || !Number.isFinite(direcao.x) || !Number.isFinite(direcao.y)
    || Math.hypot(direcao.x, direcao.y) < 0.999 || Math.hypot(direcao.x, direcao.y) > 1.001) {
    e('direcao precisa ser vetor unitario {x,y}');
  }
  if (typeof vento.forca !== 'number' || !Number.isFinite(vento.forca) || vento.forca < 0 || vento.forca > 1) e('forca precisa estar em [0,1]');
  if (!positivo(vento.amplitudeMaximaGraus)) e('amplitudeMaximaGraus precisa ser > 0');
  if (!inteiro(vento.periodoTicks)) e('periodoTicks precisa ser inteiro > 0');
  const rajada = vento.rajada;
  if (!rajada || !inteiro(rajada.intervaloTicks) || !inteiro(rajada.duracaoTicks)
    || rajada.duracaoTicks >= rajada.intervaloTicks || !positivo(rajada.velocidadeTilesPorTick)) {
    e('rajada precisa de intervaloTicks > duracaoTicks > 0 e velocidadeTilesPorTick > 0');
  }
  if (!Array.isArray(vento.vegetacaoQueBalanca) || vento.vegetacaoQueBalanca.length === 0) {
    e('vegetacaoQueBalanca precisa ser lista nao vazia');
  } else {
    const ids = new Set(manifesto.assets.filter((a) => a.tipo === 'vegetacao').map((a) => a.id));
    for (const id of vento.vegetacaoQueBalanca) {
      if (!ids.has(id)) e(`'${id}' nao existe como vegetacao no manifesto`);
    }
    if (new Set(vento.vegetacaoQueBalanca).size !== vento.vegetacaoQueBalanca.length) e('vegetacaoQueBalanca tem id duplicado');
  }
}

function validarAguaPeixe(config, erros) {
  const e = (msg) => erros.push(`interface/agua-peixe: ${msg}`);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    e('data/agua-peixe.json precisa existir e ser objeto');
    return;
  }
  if (!Number.isInteger(config.semente)) e('semente precisa ser inteiro');
  for (const campo of ['maximoNaVista', 'vidaTicks', 'intervaloDoPeixeTicks', 'intervaloDoPescadorTicks']) {
    if (!Number.isInteger(config[campo]) || config[campo] <= 0) e(`${campo} precisa ser inteiro > 0`);
  }
  for (const campo of ['raioInicialTiles', 'raioFinalTiles', 'espessuraPx', 'opacidadeInicial']) {
    if (!Number.isFinite(config[campo]) || config[campo] <= 0) e(`${campo} precisa ser > 0`);
  }
  if (config.raioFinalTiles <= config.raioInicialTiles || config.raioFinalTiles > 0.5) e('raioFinalTiles precisa crescer dentro do tile');
  if (config.opacidadeInicial > 1) e('opacidadeInicial precisa ser <= 1');
  if (config.vidaTicks >= config.intervaloDoPeixeTicks) e('peixe precisa ser raro: vidaTicks < intervaloDoPeixeTicks');
  if (typeof config.cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(config.cor)) e('cor precisa ser #rrggbb');
}

function validarPoeira(poeira, erros) {
  const e = (msg) => erros.push(`interface/poeira: ${msg}`);
  if (!poeira || typeof poeira !== 'object' || Array.isArray(poeira)) {
    e('data/poeira.json precisa existir e ser objeto');
    return;
  }
  for (const campo of ['maximoNaVista', 'vidaTicks', 'nascimentosPorTick', 'intervaloDoRedemoinhoTicks', 'duracaoDoRedemoinhoTicks']) {
    if (!Number.isInteger(poeira[campo]) || poeira[campo] <= 0) e(`${campo} precisa ser inteiro > 0`);
  }
  if (typeof poeira.limiarDaRajada !== 'number' || !Number.isFinite(poeira.limiarDaRajada)
    || poeira.limiarDaRajada <= 0 || poeira.limiarDaRajada >= 1) e('limiarDaRajada precisa estar em (0,1)');
  if (Number.isInteger(poeira.intervaloDoRedemoinhoTicks) && Number.isInteger(poeira.duracaoDoRedemoinhoTicks)
    && poeira.intervaloDoRedemoinhoTicks <= poeira.duracaoDoRedemoinhoTicks) {
    e('intervaloDoRedemoinhoTicks precisa ser maior que duracaoDoRedemoinhoTicks');
  }
  if (!Number.isInteger(poeira.semente)) e('semente precisa ser inteiro');
  if (typeof poeira.velocidadeTilesPorTick !== 'number' || !Number.isFinite(poeira.velocidadeTilesPorTick)
    || poeira.velocidadeTilesPorTick <= 0) e('velocidadeTilesPorTick precisa ser > 0');
  if (typeof poeira.fracaoPalha !== 'number' || !Number.isFinite(poeira.fracaoPalha)
    || poeira.fracaoPalha < 0 || poeira.fracaoPalha > 1) e('fracaoPalha precisa estar em [0,1]');
  for (const campo of ['corPoeira', 'corPalha']) {
    if (typeof poeira[campo] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(poeira[campo])) e(`${campo} precisa ser #rrggbb`);
  }
  if ('direcao' in poeira || 'forca' in poeira) e('o vento vem de data/vento.json');
}

function validarFumaca(fumaca, erros) {
  const e = (msg) => erros.push(`interface/fumaca: ${msg}`);
  if (!fumaca || typeof fumaca !== 'object' || Array.isArray(fumaca)) {
    e('data/fumaca.json precisa existir e ser objeto');
    return;
  }
  for (const campo of ['maximoPorChamine', 'vidaTicks', 'intervaloTicks']) {
    if (!Number.isInteger(fumaca[campo]) || fumaca[campo] <= 0) e(`${campo} precisa ser inteiro > 0`);
  }
  if (!Number.isInteger(fumaca.semente)) e('semente precisa ser inteiro');
  for (const campo of ['subidaTilesPorTick', 'velocidadeTilesPorTick', 'raioInicialTiles', 'crescimentoTilesPorTick']) {
    if (typeof fumaca[campo] !== 'number' || !Number.isFinite(fumaca[campo]) || fumaca[campo] <= 0) e(`${campo} precisa ser > 0`);
  }
  if (fumaca.subidaTilesPorTick <= fumaca.velocidadeTilesPorTick) e('subidaTilesPorTick precisa superar velocidadeTilesPorTick para subir em qualquer vento');
  if (typeof fumaca.opacidade !== 'number' || !Number.isFinite(fumaca.opacidade) || fumaca.opacidade <= 0 || fumaca.opacidade > 1) e('opacidade precisa estar em (0,1]');
  if (typeof fumaca.cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(fumaca.cor)) e('cor precisa ser #rrggbb');
  if ('direcao' in fumaca || 'forca' in fumaca) e('o vento vem de data/vento.json');
  const f = fumaca.fagulha;
  if (!f || typeof f !== 'object' || Array.isArray(f)) {
    e('fagulha precisa ser objeto');
    return;
  }
  for (const campo of ['maximoPorFogo', 'vidaTicks', 'intervaloPulsosTicks', 'particulasPorPulso']) {
    if (!Number.isInteger(f[campo]) || f[campo] <= 0) e(`fagulha.${campo} precisa ser inteiro > 0`);
  }
  if (!Number.isInteger(f.semente)) e('fagulha.semente precisa ser inteiro');
  for (const campo of ['subidaTilesPorTick', 'dispersaoTilesPorTick', 'raioTiles']) {
    if (typeof f[campo] !== 'number' || !Number.isFinite(f[campo]) || f[campo] <= 0) e(`fagulha.${campo} precisa ser > 0`);
  }
  if (!(f.vidaTicks < fumaca.vidaTicks)) e('fagulha.vidaTicks precisa ser menor que vidaTicks da fumaca');
  if (!(f.subidaTilesPorTick > fumaca.subidaTilesPorTick)) e('fagulha.subidaTilesPorTick precisa superar a fumaca');
  if (!(f.intervaloPulsosTicks > f.vidaTicks)) e('fagulha.intervaloPulsosTicks precisa superar vidaTicks para separar pulsos');
  if (!(f.particulasPorPulso <= f.maximoPorFogo)) e('fagulha.particulasPorPulso precisa caber no pool');
  if (typeof f.opacidade !== 'number' || !Number.isFinite(f.opacidade) || f.opacidade <= 0 || f.opacidade > 1) e('fagulha.opacidade precisa estar em (0,1]');
  if (typeof f.cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(f.cor)) e('fagulha.cor precisa ser #rrggbb');
}

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
  const requisitosDeSoldado = new Set(
    ((dados.units && dados.units.militares && dados.units.militares.tipos) || []).flatMap((t) => t.requisitos || []),
  );
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
    // F24c — o insumo de cada peca: so em quem escolhe, peca de `sai`, insumo de `entra`
    // (as mesmas recusas do carregador, aqui para o `validate:data` apontar o arquivo).
    if (def && def.entraPorSaida !== undefined) {
      if (def.escolheSaida !== true) {
        erros.push(`producao/entra-por-saida: production.predios.${id} declara entraPorSaida sem escolheSaida`);
      }
      for (const [saida, insumo] of Object.entries(def.entraPorSaida || {})) {
        if (!(saida in (def.sai || {}))) {
          erros.push(`producao/entra-por-saida: production.predios.${id}.entraPorSaida.${saida} nao esta em sai`);
        }
        for (const [m, taxa] of Object.entries(insumo || {})) {
          if (!(m in (def.entra || {}))) {
            erros.push(`producao/entra-por-saida: production.predios.${id}.entraPorSaida.${saida}.${m} nao esta em entra`);
          } else if (!(taxa > 0)) {
            erros.push(`producao/entra-por-saida: production.predios.${id}.entraPorSaida.${saida}.${m}=${taxa}`);
          }
        }
      }
    }
    // F24c (decisao do operador, 2026-09-29) — toda oficina de guerra trabalha por encomenda:
    // receita com duas saidas ou mais, alguma requisito de soldado, escolhe a saida.
    const saidas = Object.keys((def && def.sai) || {});
    if (saidas.length >= 2 && saidas.some((m) => requisitosDeSoldado.has(m)) && def.escolheSaida !== true) {
      erros.push(`producao/oficina-de-guerra-sem-encomenda: production.predios.${id} faz ${saidas.join(', ')} e nao escolhe a saida`);
    }
    // F-REPL-b: o padrao fora da lista e um predio que nasce num modo que nenhum
    // comando pede de volta; modo sem `planta` nao tem o que o rodizio le.
    if (def && (def.modos !== undefined || def.modoPadrao !== undefined)) {
      const modos = def.modos;
      if (!modos || typeof modos !== 'object' || Array.isArray(modos) || Object.keys(modos).length === 0) {
        erros.push(`producao/modos: production.predios.${id}.modos tem de ser objeto com pelo menos um modo`);
      } else {
        for (const [nome, m] of Object.entries(modos)) {
          if (!m || typeof m.planta !== 'boolean') {
            erros.push(`producao/modos: production.predios.${id}.modos.${nome}.planta tem de ser booleano`);
          }
        }
        if (typeof def.modoPadrao !== 'string' || !(def.modoPadrao in modos)) {
          erros.push(`producao/modo-padrao: production.predios.${id}.modoPadrao=${def.modoPadrao} nao esta em modos`);
        }
      }
      if (!def.colheita) {
        erros.push(`producao/modos: production.predios.${id} declara modos, e modos pedem colheita`);
      }
    }
    // LOTE3 — com `fases`, o ciclo e a soma delas e a razao entre taxas deixa de
    // existir na receita: quem confere e `validarFases`.
    if (def && def.colheita && def.colheita.fases !== undefined) validarFases(id, def, erros, dados);
    else validarCicloDaReceita(id, def, escala, tickHz, erros);
    // F-T2a: `producao/veio-invalido` saiu daqui junto com o campo `veio`. Quem
    // guarda o total agora e o TILE, e quem o valida e `validarRecursos`
    // (`recurso/rendimento` e `recurso/colheita`).
  }
}

const CAMPOS_DAS_FASES = ['noTile_segundos_base', 'naCasa_segundos_base', 'descanso_segundos_base'];

/**
 * LOTE3 — a colheita em FASES, como o KaM: tempo no tile, na casa, descanso e
 * quantidade por viagem. A caminhada nao tem campo (sai do pathfinding).
 *
 * `producao/fases` e a forma. `producao/sai-conferido` e o que a taxa `sai` virou:
 * nao e mais entrada, e o numero que as fases CONFEREM. A caminhada so atrasa, entao
 * as fases sozinhas (na escala 1,0) tem de render pelo menos a taxa declarada; se
 * ja sao mais lentas que ela, o dado se contradiz. A conferencia COM caminhada so
 * existe rodando a sim, e fica nos testes.
 */
function validarFases(id, def, erros, dados) {
  const f = def.colheita.fases;
  const onde = `production.predios.${id}.colheita.fases`;
  if (!f || typeof f !== 'object') {
    erros.push(`producao/fases: ${onde} precisa ser objeto`);
    return;
  }
  let forma = true;
  for (const campo of CAMPOS_DAS_FASES) {
    const v = f[campo];
    const minimo = campo === 'noTile_segundos_base' ? 'maior que 0' : '>= 0';
    const ok = typeof v === 'number' && (campo === 'noTile_segundos_base' ? v > 0 : v >= 0);
    if (!ok) {
      erros.push(`producao/fases: ${onde}.${campo} precisa ser numero ${minimo}, achou ${v}`);
      forma = false;
    }
  }
  if (!Number.isInteger(f.porViagem) || f.porViagem < 1) {
    erros.push(`producao/fases: ${onde}.porViagem precisa ser inteiro >= 1, achou ${f.porViagem}`);
    forma = false;
  }
  if (def.colheita.aDistancia === true) {
    erros.push(`producao/fases: production.predios.${id} colhe aDistancia, e quem colhe de dentro nao tem tile nem fase`);
    forma = false;
  }
  const saidas = Object.keys(def.sai || {});
  if (Object.keys(def.entra || {}).length > 0 || saidas.length !== 1) {
    erros.push(`producao/fases: production.predios.${id} declara fases com entrada ou sem exatamente uma saida`);
    forma = false;
  }
  if (!forma) return;
  // LOTE3-c — o ciclo tira `porViagem` do tile de uma vez, e o claim exige tudo: num
  // tipo que nunca repoe, a sobra menor que `porViagem` ficaria no mapa para sempre.
  const tipo = dados.resources && dados.resources.tipos ? dados.resources.tipos[def.colheita.recurso] : undefined;
  if (tipo && tipo.regime === 'nunca' && tipo.rendimentoPorTile % f.porViagem !== 0) {
    erros.push(
      `producao/por-viagem-divide: production.predios.${id}.colheita.fases.porViagem=${f.porViagem} nao divide `
      + `resources.tipos.${def.colheita.recurso}.rendimentoPorTile=${tipo.rendimentoPorTile}, e o tipo nunca repoe: sobra no tile`,
    );
  }
  const segundos = CAMPOS_DAS_FASES.reduce((soma, campo) => soma + f[campo], 0);
  const rende = (f.porViagem * 60) / segundos;
  const taxa = def.sai[saidas[0]];
  if (rende < taxa * (1 - TOLERANCIA_DA_RAZAO)) {
    erros.push(
      `producao/sai-conferido: production.predios.${id}.sai.${saidas[0]}=${taxa}/min, mas as fases `
      + `(${segundos} s por ${f.porViagem}) rendem so ${rende.toFixed(3)}/min antes da caminhada`,
    );
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

// F09 e D-TRANSPORTE-03 T1: delivery.prioridades tem um `id` por linha — e por ele que o
// codigo referencia um tipo de tarefa, sem digitar numero em .ts (invariante 3). Ids unicos
// e nao vazios; `importancia` inteira >= 1 (classe do KaM) ou null (as do laborer, que nao
// sao entrega); as classes nao nulas cobrem 1..maxima sem buraco (uma classe vazia no meio
// faria "menor = mais urgente" enganar). Classe repetida e o normal: dentro dela decide o
// caminho.
function validarEscadaDePrioridade(dados, erros) {
  const escada = dados.delivery && dados.delivery.prioridades;
  if (!Array.isArray(escada)) {
    erros.push('entrega/escada: delivery.prioridades precisa ser array');
    return;
  }
  const ids = new Set();
  const classes = new Set();
  escada.forEach((linha, i) => {
    if (typeof linha.id !== 'string' || linha.id === '') {
      erros.push(`entrega/escada: prioridades[${i}] precisa de um id nao vazio`);
    } else if (ids.has(linha.id)) {
      erros.push(`entrega/escada: id '${linha.id}' repetido em delivery.prioridades`);
    } else {
      ids.add(linha.id);
    }
    // F18d-1a: o modo da perna de entrega e da linha, e TODA linha publica o seu.
    // Regra positiva, sem lista de excecao: linha nova sem modo reprova aqui, em
    // vez de cair num padrao escondido no .ts.
    if (linha.modo !== 'livre' && linha.modo !== 'estrada') {
      erros.push(`entrega/escada: prioridades[${i}] (${linha.id}) precisa de modo 'livre' ou 'estrada'`);
    }
    if (linha.importancia === null) return;
    if (!Number.isInteger(linha.importancia) || linha.importancia < 1) {
      erros.push(`entrega/escada: prioridades[${i}] (${linha.id}) precisa de importancia inteira >= 1, ou null`);
      return;
    }
    classes.add(linha.importancia);
  });
  const maxima = Math.max(0, ...classes);
  for (let c = 1; c <= maxima; c += 1) {
    if (!classes.has(c)) erros.push(`entrega/escada: a classe de importancia ${c} esta vazia; as classes cobrem 1..${maxima} sem buraco`);
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

// C-IA-02b: o prefeito enfileira enquanto a fila esta abaixo de `filaAlvo`; acima dos
// slots da escola ele pediria o que a fila recusa, e zero nunca pediria nada.
function validarPrefeito(dados, erros) {
  const prefeito = (dados.economy && dados.economy.prefeito) || {};
  const slots = ((dados.economy && dados.economy.schoolhouse) || {}).slotsDeFila;
  if (!Number.isInteger(prefeito.filaAlvo) || prefeito.filaAlvo < 1 || prefeito.filaAlvo > slots) {
    erros.push(`economia/prefeito: filaAlvo precisa ser inteiro de 1 a schoolhouse.slotsDeFila (${slots})`);
  }
  if (typeof prefeito.serfsPorPredio !== 'number' || prefeito.serfsPorPredio < 0) {
    erros.push('economia/prefeito: serfsPorPredio precisa ser numero >= 0');
  }
  if (!Number.isInteger(prefeito.ouroMinimoParaSerf) || prefeito.ouroMinimoParaSerf < 0) {
    erros.push('economia/prefeito: ouroMinimoParaSerf precisa ser inteiro >= 0');
  }
}

// F25a: o que o quartel consome para formar soldado (`units.json:
// militares.tipos[].requisitos`) tem de ser MERCADORIA, senao nenhuma entrega leva
// aquilo ao quartel e o tipo nunca se forma. Foi assim que `horse` (a mercadoria e
// `horses`) deixou batedor e cavaleiro impossiveis sem ninguem acusar.
function validarRequisitosDoQuartel(dados, erros) {
  const mercadorias = new Set((dados.economy && dados.economy.mercadorias) || []);
  const tipos = (dados.units && dados.units.militares && dados.units.militares.tipos) || [];
  for (const t of tipos) {
    for (const r of t.requisitos || []) {
      if (!mercadorias.has(r)) {
        erros.push(`unidades/requisitos: '${t.id}' pede '${r}', que nao esta em economy.mercadorias`);
      }
    }
  }
}

// F28d: o atirador declara o projetil, e o escudo sabe quanto defende contra ele; o
// escudo e mercadoria (senao ninguem o leva); o alcance minimo fica abaixo do maximo.
function validarAtiradores(dados, erros) {
  const combate = dados.combat || {};
  const escudo = combate.escudo || {};
  const contra = escudo.defesaContraProjetil || {};
  const mercadorias = new Set((dados.economy && dados.economy.mercadorias) || []);
  for (const m of escudo.mercadorias || []) {
    if (!mercadorias.has(m)) erros.push(`combate/escudo: '${m}' nao esta em economy.mercadorias`);
  }
  const u = dados.units || {};
  const tipos = [...((u.militares && u.militares.tipos) || []), ...((u.mercenarios && u.mercenarios.tipos) || [])];
  for (const t of tipos) {
    if (t.aDistancia !== true) continue;
    if (typeof t.projetil !== 'string') erros.push(`combate/atirador: '${t.id}' atira e nao declara 'projetil'`);
    else if (!(t.projetil in contra)) erros.push(`combate/atirador: o projetil '${t.projetil}' de '${t.id}' nao esta em escudo.defesaContraProjetil`);
    // C1: todo projetil em uso tem cadencia propria
    else if (!(combate.aDistancia && combate.aDistancia.cadencia && typeof combate.aDistancia.cadencia[t.projetil] === 'object')) {
      erros.push(`combate/cadencia: o projetil '${t.projetil}' de '${t.id}' nao tem aDistancia.cadencia`);
    }
  }
  const d = combate.aDistancia || {};
  for (const [projetil, c] of Object.entries(d.cadencia || {})) {
    if (projetil.startsWith('_')) continue;
    if (!(c.miraAleatoria_segundos_base > 0 && c.recarga_segundos_base > 0)) {
      erros.push(`combate/cadencia: '${projetil}' precisa de miraAleatoria > 0 e recarga > 0`);
    }
  }
  const torre = combate.watchtower || {};
  if (!(torre.recarga_segundos_base > 0)) erros.push('combate/torre: watchtower.recarga_segundos_base precisa ser > 0');
  if (!(d.alcanceMinimo_tiles >= 0 && d.alcanceMaximo_tiles > d.alcanceMinimo_tiles)) {
    erros.push('combate/alcance: aDistancia precisa de 0 <= alcanceMinimo_tiles < alcanceMaximo_tiles');
  }
  // C-COMBATE-01b: a carga. `apenas` e o unico criterio que `sim/carga.ts` sabe ler; a
  // distancia e sorteada com `nextInt(min, max + 1)`, entao inteiros com 1 <= min <= max.
  const storm = combate.stormAttack || {};
  if (storm.apenas !== 'infantariaCorpoACorpo') erros.push(`combate/storm: stormAttack.apenas '${storm.apenas}' nao e 'infantariaCorpoACorpo'`);
  if (!(storm.multiplicadorVelocidade > 0)) erros.push('combate/storm: stormAttack.multiplicadorVelocidade precisa ser > 0');
  const dist = storm.distancia_tiles || {};
  if (!(Number.isInteger(dist.min) && Number.isInteger(dist.max) && dist.min >= 1 && dist.max >= dist.min)) {
    erros.push('combate/storm: stormAttack.distancia_tiles precisa de inteiros 1 <= min <= max');
  }
  if (typeof storm.incontrolavel !== 'boolean') erros.push('combate/storm: stormAttack.incontrolavel precisa ser booleano');
}

// F35: a taxa da feira e quantas unidades de A se dao por uma de B — inteiro >= 1, ou a
// troca criaria mercadoria (taxa < 1) ou nao fecharia nunca.
// C8: a ordem de treino da IA lista militares do tipo de grupo da chave (o mesmo criterio de
// `sim/ia.ts: tipoDeGrupo`: montado, a distancia, ataque contra cavalo, ou corpo a corpo), e
// os alvos prioritarios sao predios que existem.
function validarPrioridadesDaIA(dados, erros) {
  const ia = (dados.combat && dados.combat.ia) || {};
  const militares = ((dados.units && dados.units.militares && dados.units.militares.tipos) || []);
  const porId = new Map(militares.map((t) => [t.id, t]));
  const grupoDe = (t) => (t.montado ? 'montado' : t.aDistancia ? 'distancia' : (t.attackVsCavalo || 0) > 0 ? 'antiCavalo' : 'corpoACorpo');
  for (const [grupo, lista] of Object.entries(ia.ordemDeTreino || {})) {
    for (const id of lista) {
      const t = porId.get(id);
      if (t === undefined) erros.push(`combate/ia: '${id}' em ordemDeTreino.${grupo} nao e militar de units.json`);
      else if (grupoDe(t) !== grupo) erros.push(`combate/ia: '${id}' em ordemDeTreino.${grupo} e do grupo '${grupoDe(t)}'`);
    }
  }
  const predios = new Set(((dados.buildings && dados.buildings.predios) || []).map((p) => p.id));
  for (const id of ia.alvosPrioritarios || []) {
    if (!predios.has(id)) erros.push(`combate/ia: o alvo prioritario '${id}' nao esta em buildings.json`);
  }
}

// C-IA-03a (cenario de escaramuca): a vila e a tropa da IA em data/escaramuca.json
// apontam para ids que existem, e a tropa cabe na posicao do tipo dela. O encaixe no
// MAPA (terreno livre, sem sobreposicao) e do teste da C-IA-03a, com o `canPlace` da sim:
// este validador nao conhece o mapa em tile.
function validarEscaramuca(dados, erros) {
  const e = dados.escaramuca;
  if (!e || !Array.isArray(e.predios) || !Array.isArray(e.posicoes)) {
    erros.push('escaramuca/forma: escaramuca.predios e escaramuca.posicoes precisam ser arrays');
    return;
  }
  const predios = new Set(((dados.buildings && dados.buildings.predios) || []).map((p) => p.id));
  for (const p of e.predios) {
    if (!predios.has(p.id)) erros.push(`escaramuca/predio: '${p.id}' nao esta em buildings.json`);
  }
  const mercadorias = new Set((dados.economy && dados.economy.mercadorias) || []);
  const conferirMercadorias = (onde, gaveta) => {
    for (const [m, n] of Object.entries(gaveta || {})) {
      if (!mercadorias.has(m)) erros.push(`escaramuca/mercadoria: '${m}' em ${onde} nao esta em economy.mercadorias`);
      if (!(Number.isInteger(n) && n >= 0)) erros.push(`escaramuca/mercadoria: ${onde}.${m} precisa ser inteiro >= 0`);
    }
  };
  conferirMercadorias('estoqueDoArmazem', e.estoqueDoArmazem);
  conferirMercadorias('quartel.entrada', e.quartel && e.quartel.entrada);
  if (!(e.quartel && Number.isInteger(e.quartel.recrutas) && e.quartel.recrutas >= 0)) {
    erros.push('escaramuca/quartel: quartel.recrutas precisa ser inteiro >= 0');
  }
  const ia = (dados.combat && dados.combat.ia) || {};
  const militares = new Map(((dados.units && dados.units.militares && dados.units.militares.tipos) || []).map((t) => [t.id, t]));
  // C-IA-03b: a tropa inicial do jogador e militar, e as fileiras tem gente
  const tj = e.tropaDoJogador;
  if (!tj || !militares.has(tj.tipo)) erros.push(`escaramuca/tropaDoJogador: '${tj && tj.tipo}' nao e militar de units.json`);
  if (!(tj && Number.isInteger(tj.quantidade) && tj.quantidade >= 0)) erros.push('escaramuca/tropaDoJogador: quantidade precisa ser inteiro >= 0');
  if (!(tj && Number.isInteger(tj.porFileira) && tj.porFileira >= 1)) erros.push('escaramuca/tropaDoJogador: porFileira precisa ser inteiro >= 1');
  // C-IA-04 (andaime): os atacantes sao militares, e a quantidade e inteiro >= 0
  const at = e.atacantes;
  if (!at || !militares.has(at.tipo)) erros.push(`escaramuca/atacantes: '${at && at.tipo}' nao e militar de units.json`);
  if (!(at && Number.isInteger(at.quantidade) && at.quantidade >= 0)) erros.push('escaramuca/atacantes: quantidade precisa ser inteiro >= 0');
  const grupoDe = (t) => (t.montado ? 'montado' : t.aDistancia ? 'distancia' : (t.attackVsCavalo || 0) > 0 ? 'antiCavalo' : 'corpoACorpo');
  // C-IA-02a: a vila da IA com producao. Os civis sao civis de units.json, o predio dos
  // campos esta na vila e colhe, e o recurso dos campos e o que ele colhe e se ara.
  const pr = e.producao;
  if (!pr || !pr.campos || !pr.civis || !pr.civis.tipos || !pr.civis.ponto) {
    erros.push('escaramuca/producao: producao.campos e producao.civis {ponto, tipos} sao obrigatorios');
  } else {
    const civis = new Set(((dados.units && dados.units.civis && dados.units.civis.tipos) || []).map((t) => t.id));
    for (const [tipo, n] of Object.entries(pr.civis.tipos)) {
      if (!civis.has(tipo)) erros.push(`escaramuca/producao: '${tipo}' em civis.tipos nao e civil de units.json`);
      if (!(Number.isInteger(n) && n >= 0)) erros.push(`escaramuca/producao: civis.tipos.${tipo} precisa ser inteiro >= 0`);
    }
    if (!e.predios.some((p) => p.id === pr.campos.predio)) erros.push(`escaramuca/producao: campos.predio '${pr.campos.predio}' nao esta em escaramuca.predios`);
    const receita = dados.production && dados.production.predios && dados.production.predios[pr.campos.predio];
    const colheita = receita && receita.colheita;
    if (!colheita) erros.push(`escaramuca/producao: '${pr.campos.predio}' nao tem colheita em production.json`);
    else if (colheita.recurso !== pr.campos.recurso) erros.push(`escaramuca/producao: '${pr.campos.predio}' colhe '${colheita.recurso}', e os campos sao de '${pr.campos.recurso}'`);
    const tipoDoRecurso = dados.resources && dados.resources.tipos && dados.resources.tipos[pr.campos.recurso];
    if (!(tipoDoRecurso && tipoDoRecurso.aradura)) erros.push(`escaramuca/producao: '${pr.campos.recurso}' nao se ara (resources.json sem aradura)`);
    if (!(Number.isInteger(pr.campos.quantidade) && pr.campos.quantidade >= 0)) erros.push('escaramuca/producao: campos.quantidade precisa ser inteiro >= 0');
  }
  const ids = new Set();
  for (const pos of e.posicoes) {
    if (ids.has(pos.id)) erros.push(`escaramuca/posicao: id '${pos.id}' repetido`);
    ids.add(pos.id);
    if (!Object.prototype.hasOwnProperty.call(ia.ordemDeTreino || {}, pos.tipoDeGrupo)) {
      erros.push(`escaramuca/posicao: '${pos.id}' tem tipoDeGrupo '${pos.tipoDeGrupo}' fora de combat.ia.ordemDeTreino`);
    }
    if (pos.linha !== 'frente' && pos.linha !== 'tras') erros.push(`escaramuca/posicao: '${pos.id}' tem linha '${pos.linha}'`);
    const t = pos.tropa && militares.get(pos.tropa.tipo);
    if (t === undefined) erros.push(`escaramuca/tropa: '${pos.tropa && pos.tropa.tipo}' em '${pos.id}' nao e militar de units.json`);
    else if (grupoDe(t) !== pos.tipoDeGrupo) erros.push(`escaramuca/tropa: '${t.id}' e do grupo '${grupoDe(t)}', e a posicao '${pos.id}' e '${pos.tipoDeGrupo}'`);
    const q = pos.tropa && pos.tropa.quantidade;
    if (!(Number.isInteger(q) && q >= 1 && q <= ia.tamanhoDoGrupo)) {
      erros.push(`escaramuca/tropa: '${pos.id}' tem ${q} homens; o grupo vai de 1 a combat.ia.tamanhoDoGrupo (${ia.tamanhoDoGrupo})`);
    }
  }
}

// C-COMIDA-01 (fome militar com o Feed): o militar pede comida abaixo de
// `militar.pedeComidaAbaixoDe`, e a IA alimenta a tropa abaixo de `limiares.civilVaiComer`
// (o limiar do civil, decisao do operador). A IA pedir ACIMA de onde o membro aceita pedir
// faria o Feed dela voltar `sem-fome` para sempre: por isso civilVaiComer < pedeComida.
function validarPedidoDeComida(dados, erros) {
  const c = dados.condition || {};
  const pede = c.militar && c.militar.pedeComidaAbaixoDe;
  const ia = c.limiares && c.limiares.civilVaiComer;
  if (typeof pede !== 'number' || !(pede > 0 && pede < 1)) {
    erros.push('condicao/pedido: militar.pedeComidaAbaixoDe precisa ser uma fracao em (0, 1)');
    return;
  }
  if (typeof ia !== 'number' || !(ia > 0 && ia < pede)) {
    erros.push('condicao/pedido: limiares.civilVaiComer (o limiar da IA) precisa ficar em (0, militar.pedeComidaAbaixoDe)');
  }
}

function validarFeira(dados, erros) {
  const feira = (dados.economy && dados.economy.marketplace) || {};
  if (!Number.isInteger(feira.taxa) || feira.taxa < 1) erros.push('economia/feira: marketplace.taxa precisa ser inteiro >= 1');
  if (!Number.isInteger(feira.maxSerfs) || feira.maxSerfs < 1) erros.push('economia/feira: marketplace.maxSerfs precisa ser inteiro >= 1');
}

// D-TRANSPORTE-02a: o menu de distribuicao. Todo par declarado e insumo real, todo valor
// cabe em 0..maximo, e toda mercadoria consumida por dois ou mais tipos esta declarada com
// TODOS os consumidores — e isso que impede uma cadeia nova (F24, ferro) de criar uma
// disputa que o menu nao mostra.
// D-PRODUCAO-01b: todo tipo que divide o insumo escasso tem receita com entrada (senao
// nunca recebe tarefa de insumo, e a linha no dado nao faz nada), e os dois limites sao
// inteiros >= 0.
function validarDivisaoDoEscasso(dados, erros) {
  const div = dados.delivery && dados.delivery.divisaoDoEscasso;
  const receitas = (dados.production && dados.production.predios) || {};
  if (!div || !Array.isArray(div.tipos)) {
    erros.push('entrega/divisaoDoEscasso: delivery.divisaoDoEscasso.tipos precisa existir');
    return;
  }
  for (const tipo of div.tipos) {
    const receita = receitas[tipo];
    if (!receita || Object.keys(receita.entra || {}).length === 0) {
      erros.push(`entrega/divisaoDoEscasso: ${tipo} nao tem receita com entrada`);
    }
  }
  for (const campo of ['ofertaMaxima', 'gavetaMaxima']) {
    if (!Number.isInteger(div[campo]) || div[campo] < 0) {
      erros.push(`entrega/divisaoDoEscasso: ${campo} precisa ser inteiro >= 0`);
    }
  }
}

// D-TRANSPORTE-03 T2: os dois termos do lance sao distancia em tiles; negativo premiaria o
// armazem e o destino cheio, o contrario do que o KaM faz.
function validarLance(dados, erros) {
  const lance = dados.delivery && dados.delivery.lance;
  for (const campo of ['multaDoArmazem_tiles', 'porUnidadeNaEntrada_tiles']) {
    const v = lance && lance[campo];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      erros.push(`entrega/lance: delivery.lance.${campo} precisa ser numero >= 0`);
    }
  }
}

function validarEncomenda(dados, erros) {
  const enc = dados.production && dados.production.encomenda;
  if (!enc || !Number.isInteger(enc.maxima) || enc.maxima < 1) {
    erros.push('producao/encomenda: production.encomenda.maxima precisa ser inteiro >= 1');
  }
}

function validarDistribuicao(dados, erros) {
  const dist = dados.delivery && dados.delivery.distribuicao;
  const receitas = (dados.production && dados.production.predios) || {};
  if (!dist || typeof dist.padrao !== 'object' || dist.padrao === null) {
    erros.push('entrega/distribuicao: delivery.distribuicao.padrao precisa existir');
    return;
  }
  if (!Number.isInteger(dist.maximo) || dist.maximo < 1) {
    erros.push('entrega/distribuicao: distribuicao.maximo precisa ser inteiro >= 1');
    return;
  }
  const consumidores = {};
  for (const [tipo, receita] of Object.entries(receitas)) {
    for (const mercadoria of Object.keys((receita && receita.entra) || {})) {
      (consumidores[mercadoria] = consumidores[mercadoria] || []).push(tipo);
    }
  }
  for (const [mercadoria, porTipo] of Object.entries(dist.padrao)) {
    for (const [tipo, valor] of Object.entries(porTipo || {})) {
      if (!(consumidores[mercadoria] || []).includes(tipo)) {
        erros.push(`entrega/distribuicao: ${mercadoria}/${tipo} nao e insumo da receita de ${tipo}`);
      }
      if (!Number.isInteger(valor) || valor < 0 || valor > dist.maximo) {
        erros.push(`entrega/distribuicao: ${mercadoria}/${tipo} precisa ser inteiro em 0..${dist.maximo}`);
      }
    }
  }
  for (const [mercadoria, tipos] of Object.entries(consumidores)) {
    if (tipos.length < 2) continue;
    for (const tipo of tipos) {
      if (!dist.padrao[mercadoria] || dist.padrao[mercadoria][tipo] === undefined) {
        erros.push(`entrega/distribuicao: ${mercadoria} e disputado e falta o consumidor ${tipo} em distribuicao.padrao`);
      }
    }
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
  // D-PRODUCAO-02 — booleano ou ausente: a sim le `=== true`, e `"true"` de texto seria falso
  if (r.replantaOQueCortou !== undefined && typeof r.replantaOQueCortou !== 'boolean') {
    erros.push(
      `recurso/reposicao: resources.tipos.${id}.reposicao.replantaOQueCortou precisa ser booleano, `
      + `achou ${JSON.stringify(r.replantaOQueCortou)}`,
    );
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

// F-REPL-b: o modo de trabalho (production.json:predios.<tipo>.modos) e escolhido
// no painel pelo id, e o jogador ve o nome do tema. Ida e volta, como o menu: todo
// modo tem `nome` em theme-sertao.predios.<tipo>.modos, e o tema nao nomeia modo
// que o dado nao tem.
function validarRotulosDeModo(dados, tema, erros) {
  const predios = (dados.production && dados.production.predios) || {};
  const doTema = (tema && tema.predios) || {};
  for (const [tipo, def] of Object.entries(predios)) {
    if (tipo.startsWith('_') || !def || typeof def !== 'object') continue;
    const modos = def.modos && typeof def.modos === 'object' ? Object.keys(def.modos) : [];
    const rotulos = (doTema[tipo] && doTema[tipo].modos) || {};
    for (const modo of modos) {
      const r = rotulos[modo];
      if (!r || typeof r.nome !== 'string' || r.nome.length === 0) {
        erros.push(`interface/modo-rotulo: modo '${modo}' de '${tipo}' sem nome em theme-sertao.predios.${tipo}.modos`);
      }
    }
  }
  for (const [tipo, t] of Object.entries(doTema)) {
    if (!t || typeof t !== 'object' || !t.modos) continue;
    const doDado = (predios[tipo] && predios[tipo].modos) || {};
    for (const modo of Object.keys(t.modos)) {
      if (!Object.hasOwn(doDado, modo)) {
        erros.push(`interface/modo-rotulo: theme-sertao.predios.${tipo}.modos.${modo} nao e modo de production.json`);
      }
    }
  }
}

// Layout 2, fatia 2 (docs/propostas/ui-releitura-rts.md §2): o agrupamento do
// menu Construir (data/menu-build.json) e dado de INTERFACE, validado a parte
// de validarTudo porque `sim/` nunca o le. O que a regra guarda: todo predio de
// buildings.json esta em exatamente um grupo; nenhum id inventado; a ORDEM
// dentro do grupo e a de buildings.json (a ordem nunca e digitada duas vezes);
// e cada grupo tem rotulo no tema, e so os grupos tem — o mesmo par ida-e-volta
// do guarda da F22 para as causas de alerta.
// D-TERRENO-ALTURA — data/relevo.json, o relevo so de render (docs/planos/relevo-a.md). As regras sao
// as que a conta da luz e o gerador pressupoem:
//   - chao plano = 1,0 exato: nao ha `fatorDoPlano` (o k de antes volta so por engano);
//   - o piso da luz fica abaixo de 1; o teto do tint do sprite em (0, 1], porque o setTint so
//     escurece; o teto da luz do chao, SE existir, acima de 1;
//   - a luz vem de cima inclinada para o sul, sem leste-oeste: so `inclinacaoParaOSulGraus`;
//   - todo tipo da legenda do mapa tem base, e todo degrau cabe no formato (0 a 35).
const DEGRAU_MAXIMO_DO_FORMATO = 35;

function validarRelevo(dados, relevo, erros) {
  const e = (msg) => erros.push(`interface/relevo: ${msg}`);
  if (!relevo || typeof relevo !== 'object') {
    e('data/relevo.json precisa existir e ser objeto');
    return;
  }
  const numero = (v) => typeof v === 'number' && Number.isFinite(v);
  if (typeof relevo.ligado !== 'boolean') e('`ligado` precisa ser booleano');
  if ('fatorDoPlano' in relevo) e('`fatorDoPlano` nao existe mais: o chao plano e 1,0 exato');
  if (!numero(relevo.fatorMinimo) || relevo.fatorMinimo <= 0 || relevo.fatorMinimo >= 1) {
    e('`fatorMinimo` precisa estar em (0, 1)');
  }
  if (!numero(relevo.tetoDoTintDoSprite) || relevo.tetoDoTintDoSprite <= 0 || relevo.tetoDoTintDoSprite > 1) {
    e('`tetoDoTintDoSprite` precisa estar em (0, 1]: o setTint so escurece');
  }
  if ('tetoDaLuzDoChao' in relevo
    && (!numero(relevo.tetoDaLuzDoChao) || relevo.tetoDaLuzDoChao <= 1 || relevo.tetoDaLuzDoChao > 2)) {
    e('`tetoDaLuzDoChao`, se existir, precisa estar em (1, 2]');
  }
  if (!numero(relevo.pxDeMundoPorDegrau) || relevo.pxDeMundoPorDegrau <= 0) e('`pxDeMundoPorDegrau` precisa ser > 0');
  const luz = relevo.luz;
  if (!luz || typeof luz !== 'object') {
    e('`luz` precisa existir');
  } else {
    const inclinacao = luz.inclinacaoParaOSulGraus;
    if (!numero(inclinacao) || inclinacao <= 0 || inclinacao >= 90) e('`luz.inclinacaoParaOSulGraus` precisa estar em (0, 90)');
    for (const campo of Object.keys(luz)) {
      if (campo !== 'inclinacaoParaOSulGraus' && !campo.startsWith('_')) {
        e(`\`luz.${campo}\` nao e permitido: a luz nao tem componente leste-oeste`);
      }
    }
  }
  const geracao = relevo.geracao;
  if (!geracao || typeof geracao !== 'object') {
    e('`geracao` precisa existir');
    return;
  }
  const degrau = (v) => Number.isInteger(v) && v >= 0 && v <= DEGRAU_MAXIMO_DO_FORMATO;
  if (!Number.isInteger(geracao.semente)) e('`geracao.semente` precisa ser inteiro');
  if (!numero(geracao.celulaDoRuidoEmTiles) || geracao.celulaDoRuidoEmTiles <= 0) e('`geracao.celulaDoRuidoEmTiles` precisa ser > 0');
  if (!degrau(geracao.amplitudeDoRuidoEmDegraus)) e(`\`geracao.amplitudeDoRuidoEmDegraus\` precisa ser inteiro de 0 a ${DEGRAU_MAXIMO_DO_FORMATO}`);
  if (!Number.isInteger(geracao.decliveMaximoEmDegraus) || geracao.decliveMaximoEmDegraus < 1) {
    e('`geracao.decliveMaximoEmDegraus` precisa ser inteiro >= 1');
  }
  const tiposDoMapa = new Set();
  for (const nome of Object.keys(dados)) {
    const legenda = nome.startsWith('maps/') && dados[nome] && dados[nome].legenda;
    if (legenda && typeof legenda === 'object') for (const tipo of Object.values(legenda)) tiposDoMapa.add(tipo);
  }
  const base = geracao.basePorTipo || {};
  for (const tipo of tiposDoMapa) {
    if (!(tipo in base)) e(`\`geracao.basePorTipo\` sem o tipo do mapa '${tipo}'`);
  }
  for (const [tipo, valor] of Object.entries(base)) {
    if (!degrau(valor)) e(`\`geracao.basePorTipo.${tipo}\` precisa ser inteiro de 0 a ${DEGRAU_MAXIMO_DO_FORMATO}`);
  }
  if (!Array.isArray(geracao.tiposSemLimiteDeDeclive)) {
    e('`geracao.tiposSemLimiteDeDeclive` precisa ser array');
  } else {
    for (const tipo of geracao.tiposSemLimiteDeDeclive) {
      if (!tiposDoMapa.has(tipo)) e(`\`geracao.tiposSemLimiteDeDeclive\`: '${tipo}' nao e tipo do mapa`);
    }
  }
}

function validarInterface(dados, interfaceUi) {
  const erros = [];
  const animacao = interfaceUi && interfaceUi['animacao-unidade'];
  for (const campo of ['saltoMaximoTiles', 'passoDaViradaTicks']) {
    if (!animacao || !Number.isFinite(animacao[campo]) || animacao[campo] <= 0) {
      erros.push(`interface/animacao-unidade: ${campo} precisa ser > 0`);
    }
  }
  const agua = interfaceUi && interfaceUi.agua;
  if (!agua || typeof agua !== 'object') {
    erros.push('interface/agua: data/agua.json precisa existir e ser objeto');
  } else {
    if (!Number.isInteger(agua.periodo) || agua.periodo <= 0) {
      erros.push('interface/agua: periodo precisa ser inteiro > 0');
    }
    const manifesto = require('../assets/manifest.json');
    const assetDaAgua = manifesto.assets.find((asset) => asset.id === 'agua');
    const estados = new Set(Object.keys(assetDaAgua?.estados ?? {}).filter((estado) =>
      estado === 'padrao' || /^v[1-3]$/.test(estado)));
    if (!Array.isArray(agua.variantes) || agua.variantes.length !== 4
      || new Set(agua.variantes).size !== 4
      || agua.variantes.some((estado) => !estados.has(estado))) {
      erros.push('interface/agua: variantes precisam ser as quatro do manifesto da agua');
    }
  }
  const menu = interfaceUi && interfaceUi['menu-build'];
  const tema = interfaceUi && interfaceUi['theme-sertao'];
  validarRotulosDeModo(dados, tema, erros);
  validarRelevo(dados, interfaceUi && interfaceUi.relevo, erros);
  validarBandeira(interfaceUi && interfaceUi.bandeira, erros);
  validarVento(interfaceUi && interfaceUi.vento, erros);
  validarAguaPeixe(interfaceUi && interfaceUi['agua-peixe'], erros);
  validarPoeira(interfaceUi && interfaceUi.poeira, erros);
  validarFumaca(interfaceUi && interfaceUi.fumaca, erros);
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
  validarPrefeito(dados, erros);
  validarRequisitosDoQuartel(dados, erros);
  validarAtiradores(dados, erros);
  validarFeira(dados, erros);
  validarDistribuicao(dados, erros);
  validarDivisaoDoEscasso(dados, erros);
  validarLance(dados, erros);
  validarEncomenda(dados, erros);
  validarPedidoDeComida(dados, erros);
  validarPrioridadesDaIA(dados, erros);
  validarEscaramuca(dados, erros);
  validarMapas(dados, erros);
  return erros;
}

module.exports = { validarBandeira, validarFumaca, validarTudo, validarInterface, validarVento, validarPoeira, getByPath };
