// Gera docs/mapa-construcoes-profissoes.md a partir de data/buildings.json,
// data/production.json, data/units.json e data/theme-sertao.json.
//
// O documento e DERIVADO: ninguem edita o .md a mao. Numero e estrutura saem do
// dado; nome sai do tema. Rodar de novo depois de mexer em qualquer um dos
// quatro arquivos.
//
// A unica coisa que NAO vem do dado esta em FORA_DO_PREDIO: quem sai do predio
// para colher e decisao de arquitetura (operador, 2026-09-24,
// docs/planos/recursos-naturais-proposta.md), e nenhum campo de data/ a
// registra hoje. Ela esta declarada aqui, em um lugar so, e o documento diz que
// e decisao e nao dado.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (nome) => JSON.parse(fs.readFileSync(path.join(raiz, 'data', nome), 'utf8'));

const buildings = ler('buildings.json');
const production = ler('production.json');
const units = ler('units.json');
const tema = ler('theme-sertao.json');

const predios = buildings.predios;
const receitas = production.predios;
const civis = units.civis.tipos;

/** Profissoes que saem do predio para colher, e o recurso natural de cada uma.
 *  Decisao de arquitetura, nao campo de dado — ver cabecalho. */
const FORA_DO_PREDIO = {
  stonemason: 'rocha no mapa',
  woodcutter: 'arvore no mapa',
  farmer: 'campo arado (milho, cana)',
  fisherman: 'agua',
  miner: 'veio na serra',
};

const lacunas = [];

function nomePredio(id) {
  const t = tema.predios[id];
  if (!t) {
    lacunas.push(`predio \`${id}\` nao tem nome no tema`);
    return `\`${id}\``;
  }
  return t.nome;
}

function nomeCivil(id) {
  const t = tema.civis[id];
  if (!t) {
    lacunas.push(`profissao \`${id}\` nao tem nome no tema`);
    return `\`${id}\``;
  }
  return t.nome;
}

function nomeMercadoria(id) {
  const n = tema.mercadorias[id];
  if (!n) {
    lacunas.push(`mercadoria \`${id}\` aparece em production.json e nao tem nome no tema`);
    return `\`${id}\``;
  }
  return n;
}

const gaveta = (obj) =>
  Object.entries(obj || {}).map(([id, q]) => `${nomeMercadoria(id)} ${q}`).join(', ') || '—';

// --- 1. arvore de desbloqueio -------------------------------------------------
// `desbloqueadoPor` aponta para o PAI. O armazem e a raiz porque e ele que nasce
// pronto em economy.json; o pai dele (serraria) e uma aresta de volta, que vira
// nota em vez de laco infinito.
const filhos = new Map(predios.map((p) => [p.id, []]));
for (const p of predios) {
  if (p.desbloqueadoPor && filhos.has(p.desbloqueadoPor)) filhos.get(p.desbloqueadoPor).push(p.id);
}

const iniciais = new Set(
  (ler('economy.json').estadoInicial.predios || []).map((p) => p.id),
);
const pai = new Map(predios.map((p) => [p.id, p.desbloqueadoPor]));
/** A cadeia de pais de `id` volta para o proprio `id`? A raiz de verdade e quem
 *  nasce sem pai OU quem fecha um ciclo e ja esta de pe no cenario. */
function fechaCiclo(id) {
  const vistos = new Set();
  let atual = pai.get(id);
  while (atual && !vistos.has(atual)) {
    if (atual === id) return true;
    vistos.add(atual);
    atual = pai.get(atual);
  }
  return false;
}
const raizes = predios
  .filter((p) => p.desbloqueadoPor === null || (iniciais.has(p.id) && fechaCiclo(p.id)))
  .map((p) => p.id);

const visitados = new Set();
const arestasDeVolta = [];
const linhasDaArvore = [];

function desenhar(id, prefixo, ultimo, profundidade) {
  const galho = profundidade === 0 ? '' : `${prefixo}${ultimo ? '└─ ' : '├─ '}`;
  linhasDaArvore.push(`${galho}${nomePredio(id)}  (${id})`);
  visitados.add(id);
  const meus = filhos.get(id).filter((f) => {
    if (visitados.has(f)) {
      arestasDeVolta.push([f, id]);
      return false;
    }
    return true;
  });
  const novoPrefixo = profundidade === 0 ? '' : prefixo + (ultimo ? '   ' : '│  ');
  meus.forEach((f, i) => desenhar(f, novoPrefixo, i === meus.length - 1, profundidade + 1));
}
for (const r of raizes) if (!visitados.has(r)) desenhar(r, '', true, 0);
for (const p of predios) if (!visitados.has(p.id)) desenhar(p.id, '', true, 0);

// --- 2. tabela dos predios ----------------------------------------------------
const linhasDePredio = predios.map((p) => {
  const r = receitas[p.id];
  return [
    nomePredio(p.id),
    `\`${p.id}\``,
    `${p.tamanho[0]}x${p.tamanho[1]}`,
    p.timber,
    p.stone,
    p.hp,
    p.desbloqueadoPor ? nomePredio(p.desbloqueadoPor) : '—',
    p.trabalhador ? nomeCivil(p.trabalhador) : '—',
    r ? gaveta(r.entra) : '—',
    r ? gaveta(r.sai) : '—',
  ].join(' | ');
});

// --- 3. profissoes ------------------------------------------------------------
const prediosDe = new Map(civis.map((c) => [c.id, []]));
for (const p of predios) {
  if (p.trabalhador && prediosDe.has(p.trabalhador)) prediosDe.get(p.trabalhador).push(p.id);
}
const ocupam = civis.filter((c) => prediosDe.get(c.id).length > 0);
const naoOcupam = civis.filter((c) => prediosDe.get(c.id).length === 0);

const linhasDeProfissao = ocupam.map((c) => {
  const fora = FORA_DO_PREDIO[c.id];
  return [
    nomeCivil(c.id),
    `\`${c.id}\``,
    prediosDe.get(c.id).map(nomePredio).join(', '),
    fora ? '**FORA** do predio' : 'dentro',
    fora || '—',
  ].join(' | ');
});

// --- 4. cadeias de producao ---------------------------------------------------
// Derivadas do grafo entra/sai: comeca em quem nao consome nada (o extrator) e
// segue por quem consome o que ele produz, ate um bem que ninguem consome.
const consomem = new Map();
for (const [id, r] of Object.entries(receitas)) {
  for (const bem of Object.keys(r.entra || {})) {
    if (!consomem.has(bem)) consomem.set(bem, []);
    consomem.get(bem).push(id);
  }
}
const extratores = Object.entries(receitas)
  .filter(([, r]) => Object.keys(r.entra || {}).length === 0)
  .map(([id]) => id);

const cadeias = [];
function seguir(predioId, trilha) {
  const saidas = Object.keys(receitas[predioId].sai || {});
  let avancou = false;
  for (const bem of saidas) {
    for (const proximo of consomem.get(bem) || []) {
      if (trilha.includes(proximo)) continue;
      avancou = true;
      seguir(proximo, [...trilha, `${nomeMercadoria(bem)} → ${nomePredio(proximo)}`]);
    }
  }
  if (!avancou) {
    const finais = saidas.map(nomeMercadoria).join(' + ');
    cadeias.push(`${trilha.join(' → ')}${finais ? ` → **${finais}**` : ''}`);
  }
}
for (const e of extratores) seguir(e, [nomePredio(e)]);

// --- montagem -----------------------------------------------------------------
const linhas = [];
const P = (...l) => linhas.push(...l);

P('# Mapa de construções e profissões', '');
P('> **Documento gerado.** Não edite à mão: rode `npm run docs:mapa`.');
P('> Fonte: `data/buildings.json`, `data/production.json`, `data/units.json` e');
P('> `data/theme-sertao.json`. Estrutura e número saem do dado; nome sai do tema.');
P('');
P(`**${predios.length} prédios, ${civis.length} profissões civis** — ${ocupam.length} ocupam prédio,`);
P(`${naoOcupam.length} não ocupam nenhum (${naoOcupam.map((c) => nomeCivil(c.id)).join(' e ')}).`);
P('');
P('---', '');
P('## 1. Árvore de desbloqueio', '');
P('Cada prédio libera os filhos quando fica pronto (`desbloqueadoPor`).', '');
P('```', ...linhasDaArvore, '```', '');
if (arestasDeVolta.length) {
  P('**Arestas de volta** — dependências que o desenho acima não mostra, porque');
  P('apontam para quem já apareceu:', '');
  for (const [filho, pai] of arestasDeVolta) {
    P(`- **${nomePredio(filho)}** (\`${filho}\`) requer **${nomePredio(pai)}** — o primeiro`);
    P('  nasce pronto no cenário; um segundo precisa do pai.');
  }
  P('');
}
P('---', '');
P('## 2. Os prédios', '');
P('Tábua e Pedra são o custo de construção. Entra/Sai em **unidades por minuto**');
P('na escala 1.0 (`production.json`), antes do multiplicador de tempo.', '');
P('| Prédio | id | Tam | Tábua | Pedra | HP | Requer | Trabalhador | Entra | Sai |');
P('|---|---|---|---|---|---|---|---|---|---|');
P(...linhasDePredio.map((l) => `| ${l} |`));
P('');
P('---', '');
P('## 3. As profissões, e quem sai do prédio', '');
P('Quem **colhe** sai para o mapa; quem **transforma** fica dentro, porque o');
P('insumo chega pelo carregador.', '');
P('> A coluna "Onde trabalha" é **decisão de arquitetura**, não campo de dado:');
P('> vem de `docs/planos/recursos-naturais-proposta.md` (operador, 2026-09-24) e');
P('> está declarada em `tools/gerar-mapa-construcoes.js`. Nenhum dos recursos');
P('> naturais existe no mapa hoje.', '');
P('| Profissão | id | Prédios | Onde trabalha | Recurso natural |');
P('|---|---|---|---|---|');
P(...linhasDeProfissao.map((l) => `| ${l} |`));
P('');
P('Fora da tabela, porque não ocupam prédio:', '');
P('| Profissão | id |');
P('|---|---|');
P(...naoOcupam.map((c) => `| ${nomeCivil(c.id)} | \`${c.id}\` |`));
P('');
P('---', '');
P('## 4. Cadeias de produção', '');
P('Da extração ao bem que ninguém mais consome. Derivadas do grafo `entra`/`sai`');
P('de `production.json`.', '');
P(...cadeias.map((c) => `- ${c}`));
P('');
if (lacunas.length) {
  P('---', '');
  P('## 5. Lacunas que o gerador encontrou', '');
  P('Ids que aparecem no dado e não têm nome no tema — na tela saem como id cru:', '');
  P(...[...new Set(lacunas)].map((l) => `- ${l}`));
  P('');
}

const destino = path.join(raiz, 'docs', 'mapa-construcoes-profissoes.md');
fs.writeFileSync(destino, linhas.join('\n'), 'utf8');
console.log(
  `gerado ${path.relative(raiz, destino)} — ${predios.length} predios, ${civis.length} civis, ` +
  `${cadeias.length} cadeias, ${new Set(lacunas).size} lacuna(s)`,
);
