#!/usr/bin/env node
'use strict';

// Forma minima esperada de cada arquivo de data/, e o registro de campos
// escalonados por tempo. Puro, sem dependencia (CLAUDE.md 4).
//
// Este arquivo e a fonte unica de verdade sobre "quais campos sao
// duracao/taxa e qual grupo os converte" — compartilhada por
// tools/data-rules.js (o validador) e src/sim/data/loader.ts (o carregador).
// Uma duracao nova em data/*.json so vira valida quando alguem a registra
// aqui; sem isso, tempo/duracao-nao-registrada reprova o validate:data.

const ARQUIVOS = [
  'time', 'buildings', 'production', 'units',
  'combat', 'condition', 'delivery', 'terrain', 'economy',
];

// Campos numericos cujo valor depende de escalas.<grupo> e por isso precisa
// virar tick inteiro (ou ticksPorTile/ticksPorUnidade) no carregamento.
// `caminho` e relativo a raiz do arquivo. `declaraEscalaEm` e o path, no
// MESMO arquivo, da chave que nomeia o grupo — pode valer `null` (decisao
// explicita de nao ter escala), mas a chave tem que existir.
const CAMPOS_ESCALONADOS = [
  { arquivo: 'delivery', caminho: 'alertaTarefaSemCandidato_segundos',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'buildings', caminho: 'construcao.segundosPorMartelada_base',
    unidade: 'segundos', declaraEscalaEm: 'construcao.escala' },
  { arquivo: 'buildings', caminho: 'construcao.segundosNivelamentoPorTile_base',
    unidade: 'segundos', declaraEscalaEm: 'construcao.escala' },
  { arquivo: 'economy', caminho: 'schoolhouse.segundosPorTreino_base',
    unidade: 'segundos', declaraEscalaEm: 'schoolhouse.escala' },
  { arquivo: 'combat', caminho: 'cadenciaDeAtaque_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'stormAttack.duracao_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'condition', caminho: 'duracaoCondicaoCheia_min_base.civil',
    unidade: 'min', declaraEscalaEm: 'escala' },
  { arquivo: 'condition', caminho: 'duracaoCondicaoCheia_min_base.militar',
    unidade: 'min', declaraEscalaEm: 'escala' },
  { arquivo: 'units', caminho: 'velocidadeBase_tilesPorSegundo.aPe',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escalaVelocidade' },
  { arquivo: 'units', caminho: 'velocidadeBase_tilesPorSegundo.montado',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escalaVelocidade' },
];

// production.json nao entra em CAMPOS_ESCALONADOS: as taxas de entra/sai sao
// dinamicas (uma por predio x mercadoria) e sao convertidas estruturalmente
// pelo carregador, nao campo a campo por nome. Ainda assim o arquivo declara
// grupo, e essa declaracao tem que existir e apontar para um grupo real —
// por isso entra na lista de declaracoes obrigatorias em separado.
const DECLARACOES_ESTRUTURAIS = [
  { arquivo: 'production', caminho: 'escala',
    motivo: 'declara o grupo das taxas de entra/sai; convertidas por predio, nao por nome de campo' },
];

// Campos que BATEM no varredor de nome (tempo/duracao-nao-registrada) mas
// nao sao duracao de jogo — cada um com o motivo escrito, para o proximo
// leitor nao achar que foi esquecimento.
const NAO_SAO_DURACAO = [
  { arquivo: 'time', caminho: 'duracaoAlvoDePartida_min',
    motivo: 'alvo de design da partida, nao duracao de jogo' },
  { arquivo: 'combat', caminho: 'formacao.colunasMin',
    motivo: 'numero minimo de colunas na formacao, nao duracao — "Min" de minimo' },
  { arquivo: 'condition', caminho: 'duracaoEfetiva_min_escala2.civil',
    motivo: 'oraculo redundante do autor, conferido so quando economia = 2.0' },
  { arquivo: 'condition', caminho: 'duracaoEfetiva_min_escala2.militar',
    motivo: 'oraculo redundante do autor, conferido so quando economia = 2.0' },
];

// Um campo "tem cara de duracao/taxa de tempo" se algum token do seu nome
// (dividido por camelCase e underscore) for exatamente "min" ou comecar com
// "segundo". Tokenizado para nao confundir "gold_mine"/"coal_mine" (contem a
// substring "min" dentro de "mine") com uma duracao de verdade.
function tokens(chave) {
  return chave
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function bateNomeDeTempo(chave) {
  const partes = tokens(chave);
  return partes.includes('min') || partes.some((t) => t.startsWith('segundo'));
}

module.exports = {
  ARQUIVOS,
  CAMPOS_ESCALONADOS,
  DECLARACOES_ESTRUTURAIS,
  NAO_SAO_DURACAO,
  bateNomeDeTempo,
};
