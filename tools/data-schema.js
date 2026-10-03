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

// Caminho relativo a `data/`, sem a extensao — e assim que todo carregador do
// projeto usa a lista (`data/${nome}.json`), do CLI aos testes. Por isso o mapa
// da F-T1 entra AQUI e nao numa lista paralela: acrescentar um arquivo de dado
// passa a valer para todo mundo de uma vez, sem que cada carregador precise
// aprender que existe uma segunda lista.
const ARQUIVOS = [
  'time', 'buildings', 'production', 'units',
  'combat', 'condition', 'delivery', 'terrain', 'economy',
  // F-T2a — regime e rendimento dos recursos naturais.
  'resources',
  // C-IA-03a — o cenario de escaramuca: a vila e a tropa iniciais da IA.
  'escaramuca',
  // F-T1 — a camada de terreno base. Um arquivo por mapa; `maps/` e diretorio
  // porque a campanha vai ter varios (GDD Anexo B).
  'maps/sertao-128',
];

/** O prefixo que marca um arquivo de mapa dentro de `ARQUIVOS`. As regras de
 *  `data-rules.js` acham os mapas por ele, em vez de conhecer os ids. */
const PREFIXO_DE_MAPA = 'maps/';

// Os arquivos de INTERFACE: `sim/` nunca os le (CLAUDE.md 9), entao ficam
// FORA de ARQUIVOS — o carregador da simulacao nao os conhece e nenhuma regra
// de jogo pode depender deles. Quem os valida e `validarInterface`, em
// data-rules.js, contra os arquivos de jogo (o menu aponta ids de buildings).
// `relevo` (D-TERRENO-ALTURA): numeros do relevo SO DE RENDER. O gerador de mapa e o render o leem;
// sim/ nao. Validado por `validarRelevo`, dentro de `validarInterface`.
const ARQUIVOS_DA_INTERFACE = ['theme-sertao', 'menu-build', 'relevo', 'vento', 'agua', 'agua-peixe', 'poeira', 'fumaca', 'animacao-unidade', 'bandeira', 'carga-nas-maos'];

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
  { arquivo: 'economy', caminho: 'prefeito.revisao_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'prefeito.escala' },
  { arquivo: 'combat', caminho: 'cadenciaDeAtaque_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'ataqueAPredio.cadencia_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'regeneracao.intervalo_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // C1 — a cadencia propria do atirador (por projetil) e da torre.
  { arquivo: 'combat', caminho: 'aDistancia.cadencia.flecha.miraAleatoria_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.cadencia.flecha.recarga_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.cadencia.virote.miraAleatoria_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.cadencia.virote.recarga_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.cadencia.funda.miraAleatoria_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.cadencia.funda.recarga_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'watchtower.recarga_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // C2 — a velocidade de cada projetil.
  { arquivo: 'combat', caminho: 'aDistancia.velocidade_tilesPorSegundo_base.flecha',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.velocidade_tilesPorSegundo_base.virote',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.velocidade_tilesPorSegundo_base.funda',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escala' },
  { arquivo: 'combat', caminho: 'aDistancia.velocidade_tilesPorSegundo_base.pedraDaTorre',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escala' },
  // C-IA-03b — o peacetime da escaramuca (fixo; vira parametro de fase depois).
  { arquivo: 'escaramuca', caminho: 'peacetime_min_base',
    unidade: 'min', declaraEscalaEm: 'escala' },
  // E-TELA-CONFIGURAR-PARTIDA — as opcoes da paz. `[]` casa qualquer indice do array.
  { arquivo: 'escaramuca', caminho: 'peacetime_opcoes_min_base[]',
    unidade: 'min', declaraEscalaEm: 'escala' },
  { arquivo: 'condition', caminho: 'duracaoCondicaoCheia_min_base.civil',
    unidade: 'min', declaraEscalaEm: 'escala' },
  { arquivo: 'condition', caminho: 'duracaoCondicaoCheia_min_base.militar',
    unidade: 'min', declaraEscalaEm: 'escala' },
  { arquivo: 'units', caminho: 'velocidadeBase_tilesPorSegundo.aPe',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escalaVelocidade' },
  { arquivo: 'units', caminho: 'velocidadeBase_tilesPorSegundo.montado',
    unidade: 'tilesPorSegundo', declaraEscalaEm: 'escalaVelocidade' },
  // C5 — quanto o militar espera um tile ocupado antes de dar o passo para o lado.
  { arquivo: 'units', caminho: 'colisaoMilitar.desviarDepois_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escalaVelocidade' },
  // D-MOVIMENTO-01 — as esperas da colisao civil (as constantes do WalkTo do kam_remake).
  { arquivo: 'units', caminho: 'colisaoCivil.empurrarDepois_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escalaVelocidade' },
  { arquivo: 'units', caminho: 'colisaoCivil.desviarDepois_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escalaVelocidade' },
  { arquivo: 'units', caminho: 'colisaoCivil.repetirDesvio_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escalaVelocidade' },
  { arquivo: 'units', caminho: 'colisaoCivil.trocaForcadaDepois_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escalaVelocidade' },
  // A taxa e do REGIME e nao do tipo, e e por isso que ela cabe aqui: caminho
  // fixo se registra, caminho por tipo (como as taxas de production.json) nao.
  { arquivo: 'resources', caminho: 'regimes.porTempo.segundosPorUnidade_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // F18 — a reposicao e POR TIPO, e por isso cada tipo se registra em sua
  // linha. E de proposito: tipo `porAcao` novo (a uva, a arvore do replantio)
  // so passa no validate:data quando alguem escreve a linha dele aqui, que e o
  // contrato deste arquivo. Caminho por tipo nao vira curinga.
  // F-CAMPO-a — duas linhas por tipo: semear (o roceiro no tile) e crescer (o
  // tile sozinho). O `segundos_base` unico que cobria os dois saiu.
  { arquivo: 'resources', caminho: 'tipos.corn.reposicao.semear_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'resources', caminho: 'tipos.corn.reposicao.crescer_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // F18h — arar UM tile do tipo. Mesma regra por tipo da linha acima, e pelo
  // mesmo motivo: cultura nova so se desenha depois que alguem escreve a linha
  // dela aqui. Caminho por tipo nao vira curinga.
  { arquivo: 'resources', caminho: 'tipos.corn.aradura.segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // 2026-09-26 — `grapes` (cana, nao uva): as duas linhas por tipo que as de
  // cima pediam, com o Canavial passando a colher do tile.
  { arquivo: 'resources', caminho: 'tipos.grapes.reposicao.semear_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'resources', caminho: 'tipos.grapes.reposicao.crescer_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'resources', caminho: 'tipos.grapes.aradura.segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // F-REPL-a — a arvore do replantio: o lenhador planta no toco. Sem `aradura`:
  // mata nao se desenha, so rebrota onde ja houve arvore.
  { arquivo: 'resources', caminho: 'tipos.tree.reposicao.semear_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'resources', caminho: 'tipos.tree.reposicao.crescer_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  // LOTE3 — as fases da colheita, POR RECEITA, pelo mesmo contrato da reposicao:
  // quem ganha `fases` escreve as linhas dele aqui. O grupo e o `escala` de
  // production.json (economia), o mesmo das taxas.
  { arquivo: 'production', caminho: 'predios.quarry.colheita.fases.noTile_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.quarry.colheita.fases.naCasa_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.quarry.colheita.fases.descanso_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.woodcutters.colheita.fases.noTile_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.woodcutters.colheita.fases.naCasa_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.woodcutters.colheita.fases.descanso_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.farm.colheita.fases.noTile_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.farm.colheita.fases.naCasa_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.farm.colheita.fases.descanso_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.fishermans.colheita.fases.noTile_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.fishermans.colheita.fases.naCasa_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.fishermans.colheita.fases.descanso_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.wineyard.colheita.fases.noTile_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.wineyard.colheita.fases.naCasa_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
  { arquivo: 'production', caminho: 'predios.wineyard.colheita.fases.descanso_segundos_base',
    unidade: 'segundos', declaraEscalaEm: 'escala' },
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
  { arquivo: 'combat', caminho: 'stormAttack.distancia_tiles.min',
    motivo: 'folego da carga em TILES, nao duracao — "min" de minimo (correcao do operador, 2026-09-28)' },
  { arquivo: 'condition', caminho: 'duracaoEfetiva_min_escala2.civil',
    motivo: 'oraculo redundante do autor, conferido so quando economia = 2.0' },
  { arquivo: 'condition', caminho: 'duracaoEfetiva_min_escala2.militar',
    motivo: 'oraculo redundante do autor, conferido so quando economia = 2.0' },
  // F-D2: as tres sao taxas por segundo, e por isso batem no varredor. O
  // segundo delas e de RELOGIO DE PAREDE, nao de jogo: a camera anda no quadro
  // do navegador, nao no tick, e nao deve ser escalada por time.json nem
  // convertida para ticks. Escalar a camera com a economia faria o mapa andar
  // mais devagar porque o pao assa mais devagar.
  { arquivo: 'terrain', caminho: 'camera.velocidadeInicialPxPorSegundo',
    motivo: 'velocidade de camera em tempo real de render; nao e duracao de jogo nem vira tick' },
  { arquivo: 'terrain', caminho: 'camera.aceleracaoPxPorSegundo2',
    motivo: 'aceleracao de camera em tempo real de render; nao e duracao de jogo nem vira tick' },
  { arquivo: 'terrain', caminho: 'camera.tetoPxPorSegundo',
    motivo: 'teto de velocidade de camera em tempo real de render; nao e duracao de jogo' },
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
  ARQUIVOS_DA_INTERFACE,
  PREFIXO_DE_MAPA,
  CAMPOS_ESCALONADOS,
  DECLARACOES_ESTRUTURAIS,
  NAO_SAO_DURACAO,
  bateNomeDeTempo,
};
