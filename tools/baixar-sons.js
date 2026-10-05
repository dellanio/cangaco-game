#!/usr/bin/env node
'use strict';
// H-ARTE-SONS-APROVADOS — baixa os sons que o operador aprovou em docs/sons-candidatos.md,
// recorta, converte para mp3 e escreve a secao `sons` do assets/manifest.json.
//
// So baixa com a coluna `aprovado` preenchida: o numero de um candidato da lista, ou um link novo
// do operador. ANTES de baixar, confere a licenca NA PAGINA do som (toda vez, inclusive a dos
// candidatos, que ja foi conferida na H-ARTE-SONS-CANDIDATOS): so CC0 passa. O que nao e CC0 fica
// de fora, em silencio, e sai listado no fim. Linha vazia ou `nenhum`: silencio.
//
// O original baixado fica em assets/base/sons/<id>/ (registro de geracao, nao entra no build,
// CLAUDE.md §9); o derivado que o jogo toca, em assets/sons/<id>.mp3. Ferramenta externa: o
// ffmpeg da maquina (`FFMPEG` troca o caminho). Nao e dependencia do projeto: so esta ferramenta o
// usa, e so quando o operador aprova som novo.
//
// Uso: node tools/baixar-sons.js        (baixa o que falta e reescreve a secao `sons`)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const { URL } = require('node:url');
const { lerSonsCandidatos, escolhaDoOperador } = require('./sons-candidatos.js');

const RAIZ = path.join(__dirname, '..');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const CC0 = 'creativecommons.org/publicdomain/zero/1.0';

/**
 * O recorte de cada id. `silencioInicial`: tira o silencio do comeco. `duracao` (s): corta ali, com
 * `fade` (s) de saida. Sem entrada: o arquivo inteiro, so convertido (os lacos e a musica).
 * Os numeros sao escolha da sessao, sem ouvir: PARA REVISAO do operador, que ouve.
 */
const RECORTES = {
  'blueprint-placed': { silencioInicial: true },
  'building-completed': { silencioInicial: true, duracao: 2.5, fade: 0.5 },
  'goods-produced': { silencioInicial: true, duracao: 1.0, fade: 0.2 },
  'unit-trained': { silencioInicial: true },
  'strike-hit': { silencioInicial: true },
  'strike-miss': { silencioInicial: true },
  'unit-killed': { silencioInicial: true },
  'troop-hungry': { silencioInicial: true, duracao: 3.0, fade: 0.5 },
  'shot-gun': { silencioInicial: true },
  'shot-sling': { silencioInicial: true },
  'stone-thrown': { silencioInicial: true, duracao: 1.5, fade: 0.3 },
  defeat: { silencioInicial: true },
  'inn-bell': { silencioInicial: true, duracao: 3.0, fade: 0.8 },
  // H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA: os tres de trabalho tocam em laco, entao o recorte e um
  // trecho curto que se repete; a rua e a recusa sao um so impacto
  'command-rejected': { silencioInicial: true, duracao: 0.8, fade: 0.2 },
  'build-wood': { silencioInicial: true, duracao: 2.0, fade: 0.1 },
  'build-road': { silencioInicial: true, duracao: 2.0, fade: 0.1 },
  'quarry-work': { silencioInicial: true, duracao: 2.5, fade: 0.1 },
  'road-placed': { silencioInicial: true, duracao: 0.7, fade: 0.2 },
};

async function texto(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (cangaco-game; baixar-sons)' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}
async function baixar(url, destino) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (cangaco-game; baixar-sons)' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

/** A pagina do som: licenca, autor, titulo e o arquivo a baixar. */
async function lerPagina(url) {
  const html = await texto(url);
  if (url.startsWith('https://freesound.org/')) {
    const licenca = /title="Go to the full license text" href="([^"]+)"[^>]*>([^<]+)/.exec(html);
    const titulo = /<title>Freesound - (.+?) by ([^<]+)<\/title>/.exec(html);
    const preview = /https:\/\/cdn\.freesound\.org\/previews\/[^"']+-hq\.mp3/.exec(html);
    return {
      cc0: licenca !== null && licenca[1].includes(CC0), licenca: licenca ? licenca[2].trim() : '?',
      titulo: titulo ? titulo[1] : '?', autor: titulo ? titulo[2].trim() : '?',
      arquivo: preview ? preview[0] : null, nota: 'preview HQ do Freesound (o original pede login)',
    };
  }
  const campo = /field-name-field-art-licenses.*/.exec(html);
  const nomes = campo ? [...campo[0].matchAll(/license-name'>([^<]+)/g)].map((m) => m[1].trim()) : [];
  const titulo = /<title>(.+?) \| OpenGameArt\.org<\/title>/.exec(html);
  const autor = /field-name-author-submitter[\s\S]*?href="\/users\/[^"]*">([^<]+)/.exec(html);
  const arquivo = /href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+\.(?:wav|mp3|ogg))"/.exec(html);
  return {
    cc0: nomes.length === 1 && nomes[0] === 'CC0', licenca: nomes.join(', ') || '?',
    titulo: titulo ? titulo[1] : '?', autor: autor ? autor[1].trim() : '?',
    arquivo: arquivo ? arquivo[1] : null, nota: 'arquivo da pagina do OpenGameArt',
  };
}

function duracaoDe(arquivo) {
  const saida = execFileSync(path.join(path.dirname(FFMPEG), FFMPEG === 'ffmpeg' ? 'ffprobe' : 'ffprobe'),
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo], { encoding: 'utf8' });
  return Number(Number(saida.trim()).toFixed(3));
}

function converter(origem, destino, recorte) {
  const filtros = [];
  if (recorte && recorte.silencioInicial) filtros.push('silenceremove=start_periods=1:start_threshold=-45dB');
  if (recorte && recorte.duracao !== undefined) {
    filtros.push(`atrim=0:${recorte.duracao}`, `afade=t=out:st=${(recorte.duracao - recorte.fade).toFixed(3)}:d=${recorte.fade}`);
  }
  const args = ['-y', '-v', 'error', '-i', origem];
  if (filtros.length > 0) args.push('-af', filtros.join(','));
  args.push('-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', destino);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  execFileSync(FFMPEG, args);
}

/** Escreve `sons` como a ULTIMA chave do manifesto, sem reformatar o resto do arquivo. */
function escreverNoManifesto(sons) {
  const arquivo = path.join(RAIZ, 'assets', 'manifest.json');
  let t = fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n');
  t = t.replace(/,\n {2}"sons": \{[\s\S]*\}\n\}\n?$/, '\n}\n');
  const bloco = JSON.stringify(sons, null, 2).split('\n').map((l, i) => (i === 0 ? l : `  ${l}`)).join('\n');
  t = t.replace(/\n\}\n?$/, `,\n  "sons": ${bloco}\n}\n`);
  JSON.parse(t);
  fs.writeFileSync(arquivo, t);
}

async function main() {
  const linhas = lerSonsCandidatos(fs.readFileSync(path.join(RAIZ, 'docs', 'sons-candidatos.md'), 'utf8'));
  const sons = {
    _doc: 'H-ARTE-SONS-APROVADOS. Os sons aprovados pelo operador em docs/sons-candidatos.md, gerados por tools/baixar-sons.js. `arquivo` e o derivado que o jogo toca (relativo a esta pasta); `base` o original baixado (registro, fora do build); `origem` a pagina do som, onde a licenca foi conferida; `recorte` o que foi tirado do original (null = inteiro, so convertido para mp3 128 kbps).',
  };
  const fora = [];
  for (const linha of linhas) {
    const escolha = escolhaDoOperador(linha);
    if (escolha === null || escolha === 'nenhum') { fora.push(`${linha.id}: sem aprovacao, silencio`); continue; }
    if (escolha === 'invalido') { fora.push(`${linha.id}: aprovado '${linha.aprovado}' nao e candidato nem link`); continue; }
    const pagina = await lerPagina(escolha.url);
    if (!pagina.cc0) { fora.push(`${linha.id}: ${escolha.url} e '${pagina.licenca}', nao CC0; nao baixado`); continue; }
    if (pagina.arquivo === null) { fora.push(`${linha.id}: ${escolha.url} sem arquivo para baixar`); continue; }
    const extensao = path.extname(new URL(pagina.arquivo).pathname);
    const base = `base/sons/${linha.id}/original${extensao}`;
    const caminhoDaBase = path.join(RAIZ, 'assets', base);
    if (!fs.existsSync(caminhoDaBase)) await baixar(pagina.arquivo, caminhoDaBase);
    const recorte = RECORTES[linha.id] ?? null;
    const arquivo = `sons/${linha.id}.mp3`;
    converter(caminhoDaBase, path.join(RAIZ, 'assets', arquivo), recorte);
    sons[linha.id] = {
      arquivo, base, licenca: 'CC0 1.0', origem: escolha.url, autor: pagina.autor, titulo: pagina.titulo,
      baixadoDe: pagina.arquivo, nota: pagina.nota, aprovado: linha.aprovado.trim(),
      duracaoOriginal: duracaoDe(caminhoDaBase), duracao: duracaoDe(path.join(RAIZ, 'assets', arquivo)), recorte,
    };
    console.log(`${linha.id}: ${pagina.licenca}, ${sons[linha.id].duracaoOriginal} s -> ${sons[linha.id].duracao} s`);
  }
  escreverNoManifesto(sons);
  console.log(`\nbaixar-sons: ${Object.keys(sons).length - 1} sons no manifesto.`);
  for (const f of fora) console.log(`  fora: ${f}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
