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
  const raizes = [];

  for (const p of predios) {
    const hpEsperado = (p.timber + p.stone) * 50;
    if (p.hp !== hpEsperado) {
      erros.push(`predios/hp: ${p.id} tem hp=${p.hp}, esperado (${p.timber}+${p.stone})*50=${hpEsperado}`);
    }
    if (typeof hpPorMartelada === 'number' && !Number.isInteger(p.hp / hpPorMartelada)) {
      erros.push(`predios/marteladas: ${p.id} tem hp=${p.hp}, nao divide inteiro por hpPorMartelada=${hpPorMartelada}`);
    }
    if (p.desbloqueadoPor === null) {
      raizes.push(p.id);
    } else if (!idsValidos.has(p.desbloqueadoPor)) {
      erros.push(`predios/desbloqueio-pendurado: ${p.id}.desbloqueadoPor='${p.desbloqueadoPor}' nao existe`);
    }
    if (p.trabalhador !== null && !idsDeCivis.has(p.trabalhador)) {
      erros.push(`predios/trabalhador: ${p.id}.trabalhador='${p.trabalhador}' nao existe em units.civis`);
    }
  }

  if (raizes.length !== 1) {
    erros.push(`predios/raiz-unica: esperada exatamente 1 raiz (desbloqueadoPor=null), achou ${raizes.length}: [${raizes.join(', ')}]`);
  } else if (raizes[0] !== 'storehouse') {
    erros.push(`predios/raiz-unica: raiz esperada 'storehouse', achou '${raizes[0]}'`);
  }

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
        erros.push(`predios/ciclo: ciclo de desbloqueio detectado: ${ciclo.join(' -> ')} -> ${atual}`);
        break;
      }
      caminho.push(atual);
      atual = grafo.get(atual);
    }
  }
}

function validarProducao(dados, erros) {
  const predios = dados.production && dados.production.predios;
  if (!predios || typeof predios !== 'object') return; // forma/* ja reportou
  const idsDePredios = new Set(
    ((dados.buildings && dados.buildings.predios) || []).map((p) => p.id),
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

function validarTempo(dados, erros) {
  if (!Number.isInteger(dados.time && dados.time.tickHz) || dados.time.tickHz <= 0) {
    erros.push(`tempo/tickHz: time.tickHz precisa ser inteiro positivo, achou ${dados.time && dados.time.tickHz}`);
  }
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

function validarEconomiaReferencia(dados, erros) {
  const idsDePredios = new Set(
    ((dados.buildings && dados.buildings.predios) || []).map((p) => p.id),
  );
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
}

function validarTudo(dados) {
  const erros = [];
  validarForma(dados, erros);
  validarPredios(dados, erros);
  validarProducao(dados, erros);
  validarTempo(dados, erros);
  validarCondicaoOraculo(dados, erros);
  validarEconomiaReferencia(dados, erros);
  return erros;
}

module.exports = { validarTudo, getByPath };
